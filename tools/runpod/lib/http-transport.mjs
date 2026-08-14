// HTTPS control channel to a RunPod Pod, for containers where SSH cannot work.
//
// The transport question, settled by measurement (2026-08-14):
//   raw TCP to the Pod                      blocked in this container
//   SSH through the agent proxy's CONNECT   dies at kex_exchange_identification — the proxy
//                                           re-terminates TLS and SSH is not TLS
//   https://<podId>-<port>.proxy.runpod.net reachable: HTTP/2 through the proxy, 404 from
//                                           Cloudflare for an unknown Pod, i.e. the host is
//                                           allowed by egress policy and TLS terminates cleanly
//
// So the Pod exposes an HTTP port, RunPod publishes it on 443, and this client drives it. The
// server side is worker/agent.py.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { DiskError, classifyWriteError } from './disk.mjs';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AGENT_SCRIPT_PATH = path.join(HERE, '..', 'worker', 'agent.py');
export const DEFAULT_AGENT_PORT = 8888;
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

export function podAgentScript() {
  return fs.readFileSync(AGENT_SCRIPT_PATH, 'utf8');
}

export function podProxyUrl(podId, port = DEFAULT_AGENT_PORT) {
  return `https://${podId}-${port}.proxy.runpod.net`;
}

export function newAgentToken() {
  return crypto.randomBytes(24).toString('hex'); // 48 chars, over the agent's 32-char floor
}

export class PodAgentError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = 'PodAgentError';
    this.status = status;
    this.body = body;
  }
}

export class PodAgentClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch, requestTimeoutMs = 120_000 }) {
    if (!baseUrl) throw new Error('PodAgentClient requires a baseUrl');
    if (!token) throw new Error('PodAgentClient requires a token');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async #request(method, route, { body, headers = {}, timeoutMs, raw = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`${method} ${route} timed out`)), timeoutMs || this.requestTimeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}${route}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, ...headers },
        body,
        signal: controller.signal,
        duplex: body && typeof body.pipe === 'function' ? 'half' : undefined,
      });
      if (raw) {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new PodAgentError(`${method} ${route} failed with HTTP ${response.status}${text ? `: ${text.slice(0, 400)}` : ''}`, { status: response.status });
        }
        return response;
      }
      const text = await response.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      if (!response.ok) {
        throw new PodAgentError(`${method} ${route} failed with HTTP ${response.status}${text ? `: ${String(text).slice(0, 400)}` : ''}`, {
          status: response.status,
          body: parsed,
        });
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  health({ timeoutMs = 20_000 } = {}) {
    return this.#request('GET', '/healthz', { timeoutMs });
  }

  /** Wait for the agent to answer through whatever is between us and it. */
  async waitUntilHealthy({ deadline, log = () => {}, intervalMs = 5_000, signal } = {}) {
    let attempt = 0;
    let lastError = 'no attempt made';
    while (Date.now() < deadline) {
      if (signal?.aborted) throw signal.reason || new Error('cancelled');
      attempt++;
      try {
        const health = await this.health({ timeoutMs: 20_000 });
        log(`Pod agent healthy after ${attempt} attempt(s): ${health.gpu || 'no GPU line'}`);
        return health;
      } catch (error) {
        lastError = error.message;
        if (error.status === 401) throw new PodAgentError('Pod agent answered 401: the run token does not match the one injected into the Pod', { status: 401 });
        if (attempt === 1 || attempt % 6 === 0) log(`Pod agent not ready (attempt ${attempt}): ${error.message.slice(0, 200)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new PodAgentError(`Pod agent never became reachable at ${this.baseUrl}: ${lastError}`);
  }

  /**
   * Run a command on the Pod. Long jobs are started and then polled, because an HTTP request held
   * open for the length of a render would be cut by an intermediary long before the render ended.
   */
  async exec(command, { timeoutSec = 900, cwd = null, env = null, onLog = null, pollMs = 2_000, signal } = {}) {
    const started = await this.#request('POST', '/exec', {
      body: JSON.stringify({ command, timeoutSec, cwd, env }),
      headers: { 'content-type': 'application/json' },
      timeoutMs: 60_000,
    });
    let outOffset = 0;
    let errOffset = 0;
    let stdout = '';
    let stderr = '';
    const hardDeadline = Date.now() + (timeoutSec + 120) * 1000;
    for (;;) {
      if (signal?.aborted) throw signal.reason || new Error('cancelled');
      const status = await this.#request('GET', `/job?id=${encodeURIComponent(started.id)}&outOffset=${outOffset}&errOffset=${errOffset}`, { timeoutMs: 60_000 });
      outOffset = status.outOffset;
      errOffset = status.errOffset;
      if (status.stdout) { stdout += status.stdout; if (onLog) onLog(status.stdout, 'stdout'); }
      if (status.stderr) { stderr += status.stderr; if (onLog) onLog(status.stderr, 'stderr'); }
      if (!status.running) {
        return { exitCode: status.exitCode, timedOut: status.timedOut, stdout, stderr, elapsedSec: status.elapsedSec };
      }
      if (Date.now() > hardDeadline) throw new PodAgentError(`command did not finish within ${timeoutSec}s plus grace: ${command}`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  /**
   * Push a local file to the Pod in chunks small enough to survive any intermediary body limit.
   *
   * RETRIED AS A WHOLE, deliberately. On 2026-08-14 a 20 MiB snapshot upload died at 16 MiB with a
   * bodyless `HTTP 404` — the shape the RunPod proxy returns while it is still settling, not
   * something the agent said — and the run was over before a single frame was captured. A
   * *chunk* cannot be retried safely: if the response was lost but the append succeeded, resending
   * duplicates bytes into the middle of a tarball. Restarting the whole upload with `append=0` is
   * idempotent by construction, and 20 MiB is cheap next to the Pod-minute it saves.
   */
  async upload(localPath, remotePath, { log = () => {}, attempts = 3 } = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.#uploadOnce(localPath, remotePath, { log });
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        log(`upload of ${path.basename(localPath)} failed on attempt ${attempt}/${attempts} (${String(error.message).slice(0, 160)}); restarting it from byte 0`, 'stderr');
        await new Promise((resolve) => setTimeout(resolve, 3_000 * attempt));
      }
    }
    throw lastError;
  }

  async #uploadOnce(localPath, remotePath, { log = () => {} } = {}) {
    const size = fs.statSync(localPath).size;
    const handle = await fsp.open(localPath, 'r');
    try {
      let position = 0;
      let append = false;
      while (position < size) {
        const length = Math.min(UPLOAD_CHUNK_BYTES, size - position);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, position);
        const result = await this.#request('POST', `/upload?path=${encodeURIComponent(remotePath)}&append=${append ? 1 : 0}`, {
          body: buffer,
          headers: { 'content-type': 'application/octet-stream' },
          timeoutMs: 300_000,
        });
        if (result.bytes !== length) throw new PodAgentError(`short write on Pod: sent ${length} bytes, agent stored ${result.bytes}`);
        position += length;
        append = true;
        if (size > UPLOAD_CHUNK_BYTES) log(`uploaded ${(position / 1048576).toFixed(1)}/${(size / 1048576).toFixed(1)} MiB`);
      }
    } finally {
      await handle.close();
    }
    return { bytes: size, remotePath };
  }

  /** Pull a whole remote directory as one tar.gz and unpack it locally. */
  async downloadDirectory(remoteDir, localDir, { log = () => {} } = {}) {
    const response = await this.#request('GET', `/tar?path=${encodeURIComponent(remoteDir)}`, { raw: true, timeoutMs: 900_000 });
    await fsp.mkdir(localDir, { recursive: true });
    const archive = path.join(localDir, `.transfer-${Date.now()}.tar.gz`);
    const bytes = Buffer.from(await response.arrayBuffer());
    try {
      await fsp.writeFile(archive, bytes);
    } catch (error) {
      // A full local disk here would otherwise look like an empty artifact directory.
      throw new DiskError(classifyWriteError(error, archive), archive);
    }
    try {
      await execFileAsync('tar', ['-xzf', archive, '-C', localDir]);
    } catch (error) {
      throw new PodAgentError(`could not unpack artifacts from ${remoteDir}: ${error.message}`);
    } finally {
      await fsp.rm(archive, { force: true });
    }
    const entries = await fsp.readdir(localDir, { recursive: true, withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).length;
    log(`Retrieved ${files} file(s), ${(bytes.length / 1048576).toFixed(2)} MiB compressed, from ${remoteDir}`);
    return files;
  }

  freeSpace(remotePath = '/') {
    return this.#request('GET', `/df?path=${encodeURIComponent(remotePath)}`, { timeoutMs: 30_000 });
  }
}

/**
 * The container start command. RunPod applies a template's dockerStartCmd instead of the image
 * CMD, so this is the whole of what the Pod does until the controller talks to it: write the agent
 * out of a base64 blob and run it. Nothing is fetched from the internet, so it is live in seconds.
 */
export function agentStartCommand({ port = DEFAULT_AGENT_PORT } = {}) {
  const script = Buffer.from(podAgentScript()).toString('base64');
  return [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    'mkdir -p /opt/elder-souls',
    `printf '%s' '${script}' | base64 -d > /opt/elder-souls/agent.py`,
    'if ! command -v python3 >/dev/null 2>&1; then',
    '  export DEBIAN_FRONTEND=noninteractive',
    '  apt-get update && apt-get install -y --no-install-recommends python3',
    'fi',
    `export POD_AGENT_PORT=${port}`,
    'echo "[start] launching elder-souls pod agent on port ${POD_AGENT_PORT}"',
    'exec python3 /opt/elder-souls/agent.py',
  ].join('\n');
}
