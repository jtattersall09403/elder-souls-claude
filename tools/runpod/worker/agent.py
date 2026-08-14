#!/usr/bin/env python3
"""Elder Souls Pod agent — the control channel that survives the Claude Code egress proxy.

Why this exists
---------------
SSH cannot reach a RunPod Pod from this container: raw outbound TCP is blocked, and the agent
proxy's CONNECT re-terminates TLS, which SSH is not. What *does* work is ordinary HTTPS on 443,
and RunPod publishes every Pod's HTTP ports at https://<podId>-<port>.proxy.runpod.net. So the Pod
runs this agent, and the controller drives it with plain HTTPS requests.

That URL is public, so the agent is the only thing standing in front of a root shell: every route
requires `Authorization: Bearer $POD_AGENT_TOKEN`, compared in constant time, and the agent refuses
to start without a token of at least 32 characters.

Python 3 standard library only — it must start within seconds of the container, before anything is
installed, so that the controller can see the Pod is alive.
"""
import hmac
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

AGENT = "elder-souls-pod-agent@1"
TOKEN = os.environ.get("POD_AGENT_TOKEN", "")
PORT = int(os.environ.get("POD_AGENT_PORT", "8888"))
BIND = os.environ.get("POD_AGENT_BIND", "0.0.0.0")
JOB_ROOT = os.path.join(tempfile.gettempdir(), "pod-agent-jobs")
JOBS = {}
LOCK = threading.Lock()


def start_job(command, timeout, cwd, env):
    job_id = uuid.uuid4().hex
    directory = os.path.join(JOB_ROOT, job_id)
    os.makedirs(directory, exist_ok=True)
    out_path = os.path.join(directory, "stdout")
    err_path = os.path.join(directory, "stderr")
    out = open(out_path, "wb")
    err = open(err_path, "wb")
    environment = dict(os.environ)
    environment.update({str(k): str(v) for k, v in (env or {}).items()})
    process = subprocess.Popen(
        ["bash", "-lc", command],
        stdout=out,
        stderr=err,
        cwd=cwd or "/",
        env=environment,
        start_new_session=True,
    )
    job = {
        "id": job_id,
        "command": command,
        "stdout": out_path,
        "stderr": err_path,
        "startedAt": time.time(),
        "timeoutSec": timeout,
        "exitCode": None,
        "timedOut": False,
        "pid": process.pid,
    }
    with LOCK:
        JOBS[job_id] = job

    def waiter():
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            job["timedOut"] = True
            try:
                os.killpg(os.getpgid(process.pid), 15)
            except Exception:
                pass
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(process.pid), 9)
                except Exception:
                    pass
                process.wait()
        job["exitCode"] = process.returncode
        job["finishedAt"] = time.time()
        out.close()
        err.close()

    threading.Thread(target=waiter, daemon=True).start()
    return job


def read_from(path, offset):
    try:
        size = os.path.getsize(path)
    except OSError:
        return "", offset
    if offset >= size:
        return "", size
    with open(path, "rb") as handle:
        handle.seek(offset)
        chunk = handle.read(size - offset)
    return chunk.decode("utf-8", "replace"), offset + len(chunk)


class Handler(BaseHTTPRequestHandler):
    server_version = "PodAgent/1"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # keep the container log readable
        sys.stderr.write("[agent] %s\n" % (fmt % args))

    def _drain(self):
        """Consume any request body.

        A rejected POST that leaves its body in the socket poisons the next keep-alive request on
        that connection — the self-test caught exactly that, as a nonsense 400 on an unrelated GET.
        """
        remaining = int(self.headers.get("Content-Length", "0") or 0)
        while remaining > 0:
            chunk = self.rfile.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            remaining -= len(chunk)

    def _authorized(self):
        header = self.headers.get("Authorization", "")
        expected = "Bearer " + TOKEN
        if not hmac.compare_digest(header, expected):
            self._drain()
            self.close_connection = True
            self._json(401, {"error": "unauthorized"})
            return False
        return True

    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, status, body, content_type="application/octet-stream"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path, content_type="application/octet-stream"):
        size = os.path.getsize(path)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(size))
        self.end_headers()
        with open(path, "rb") as handle:
            shutil.copyfileobj(handle, self.wfile, 1024 * 1024)

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        if not self._authorized():
            return
        if url.path == "/healthz":
            gpu = ""
            try:
                gpu = subprocess.run(
                    ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
                    capture_output=True, text=True, timeout=20,
                ).stdout.strip()
            except Exception as error:
                gpu = "nvidia-smi unavailable: %s" % error
            return self._json(200, {
                "ok": True,
                "agent": AGENT,
                "hostname": os.uname().nodename,
                "time": time.time(),
                "uptimeSec": time.time() - START,
                "gpu": gpu,
                "python": sys.version.split()[0],
            })
        if url.path == "/job":
            job_id = (query.get("id") or [""])[0]
            with LOCK:
                job = JOBS.get(job_id)
            if not job:
                return self._json(404, {"error": "no such job", "id": job_id})
            out_offset = int((query.get("outOffset") or ["0"])[0])
            err_offset = int((query.get("errOffset") or ["0"])[0])
            stdout, out_next = read_from(job["stdout"], out_offset)
            stderr, err_next = read_from(job["stderr"], err_offset)
            return self._json(200, {
                "id": job["id"],
                "running": job["exitCode"] is None,
                "exitCode": job["exitCode"],
                "timedOut": job["timedOut"],
                "stdout": stdout,
                "stderr": stderr,
                "outOffset": out_next,
                "errOffset": err_next,
                "elapsedSec": time.time() - job["startedAt"],
            })
        if url.path == "/download":
            path = unquote((query.get("path") or [""])[0])
            if not path or not os.path.isfile(path):
                return self._json(404, {"error": "no such file", "path": path})
            return self._file(path)
        if url.path == "/tar":
            path = unquote((query.get("path") or [""])[0])
            if not path or not os.path.isdir(path):
                return self._json(404, {"error": "no such directory", "path": path})
            handle, archive = tempfile.mkstemp(suffix=".tar.gz")
            os.close(handle)
            try:
                result = subprocess.run(
                    ["tar", "-czf", archive, "-C", path, "."],
                    capture_output=True, text=True, timeout=900,
                )
                if result.returncode != 0:
                    return self._json(500, {"error": "tar failed", "detail": result.stderr[-2000:]})
                return self._file(archive, "application/gzip")
            finally:
                try:
                    os.unlink(archive)
                except OSError:
                    pass
        if url.path == "/df":
            path = unquote((query.get("path") or ["/"])[0])
            stats = os.statvfs(path)
            return self._json(200, {
                "path": path,
                "freeBytes": stats.f_bavail * stats.f_frsize,
                "totalBytes": stats.f_blocks * stats.f_frsize,
            })
        return self._json(404, {"error": "unknown route", "path": url.path})

    def do_POST(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        if not self._authorized():
            return
        length = int(self.headers.get("Content-Length", "0"))
        if url.path == "/exec":
            payload = json.loads(self.rfile.read(length) or b"{}")
            command = payload.get("command")
            if not command:
                return self._json(400, {"error": "command is required"})
            job = start_job(
                command,
                float(payload.get("timeoutSec", 900)),
                payload.get("cwd"),
                payload.get("env"),
            )
            return self._json(200, {"id": job["id"], "pid": job["pid"]})
        if url.path == "/upload":
            path = unquote((query.get("path") or [""])[0])
            if not path:
                return self._json(400, {"error": "path is required"})
            append = (query.get("append") or ["0"])[0] == "1"
            os.makedirs(os.path.dirname(path) or "/", exist_ok=True)
            written = 0
            try:
                with open(path, "ab" if append else "wb") as handle:
                    remaining = length
                    while remaining > 0:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        handle.write(chunk)
                        remaining -= len(chunk)
                        written += len(chunk)
            except OSError as error:
                # A full Pod disk must be an error the controller sees, never a short write that
                # reads as success.
                return self._json(507, {"error": "write failed", "code": error.errno, "detail": str(error)})
            return self._json(200, {"path": path, "bytes": written, "append": append})
        return self._json(404, {"error": "unknown route", "path": url.path})


START = time.time()

if __name__ == "__main__":
    if len(TOKEN) < 32:
        sys.stderr.write("POD_AGENT_TOKEN must be at least 32 characters; refusing to start\n")
        sys.exit(2)
    os.makedirs(JOB_ROOT, exist_ok=True)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    server.daemon_threads = True
    sys.stderr.write("[agent] %s listening on %s:%d\n" % (AGENT, BIND, PORT))
    server.serve_forever()
