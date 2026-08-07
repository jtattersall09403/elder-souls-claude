// client.mjs — what a tool imports to get a picture.
//
// The whole point of S34's remedy is that an agent should not have to know whether the capture
// daemon is running. It calls `capture(spec)` and gets a path back. If the daemon is up, the call
// costs a socket round-trip and (on a cache hit) a few milliseconds. If it is not up, this starts
// it — idempotently, so two agents racing end up with one daemon — and then calls it.
//
//   import { capture, captureMany } from '../capture/client.mjs';
//   const shot = await capture({ viewpoint: 'VP01', evidence_of: 'appearance' });
//   console.log(shot.path, shot.cached, shot.settle.settled);
//
// THE DAEMON CAN VANISH. This container has been reclaimed once already and killed seven agents.
// So every call is retried across a dead socket: connect, and if the socket is gone or the write
// fails, re-ensure the daemon and try again (bounded). A caller never has to think about it.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REPO_ROOT } from '../lib/cli.mjs';
import { SOCK_PATH, LOG_PATH, CAPD_DIR } from './protocol.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SERVER = path.join(REPO_ROOT, 'tools/capture/server.mjs');

/** Is something answering on the socket right now? */
export function isServing(sock = SOCK_PATH, timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(sock)) return resolve(false);
    const c = net.connect(sock);
    const done = (v) => { try { c.destroy(); } catch { /* */ } resolve(v); };
    c.on('error', () => done(false));
    c.on('connect', () => done(true));
    setTimeout(() => done(false), timeoutMs);
  });
}

/**
 * Start the daemon if it is not up. Idempotent and race-safe: the daemon itself takes an O_EXCL
 * lock and a loser exits 0 without touching anything, so N clients racing produce one daemon.
 * Safe to call from every tool, every time.
 */
export async function ensureServer(opts = {}) {
  if (await isServing()) return { started: false, sock: SOCK_PATH };
  fs.mkdirSync(CAPD_DIR, { recursive: true });
  const fd = fs.openSync(LOG_PATH, 'a');
  const argv = [SERVER];
  if (opts.idle) argv.push('--idle', String(opts.idle));
  if (opts.browserIdle) argv.push('--browser-idle', String(opts.browserIdle));
  if (opts.noCache) argv.push('--no-cache');
  if (opts.pinBuild) argv.push('--pin-build');
  const child = spawn(process.execPath, argv, { detached: true, stdio: ['ignore', fd, fd], cwd: REPO_ROOT });
  child.unref();
  const deadline = Date.now() + (opts.startTimeoutMs || 30000);
  while (Date.now() < deadline) {
    if (await isServing()) return { started: true, sock: SOCK_PATH };
    await sleep(120);
  }
  throw new Error(`capture daemon did not come up within ${(opts.startTimeoutMs || 30000)}ms; see ${LOG_PATH}`);
}

export class CaptureError extends Error {
  constructor(msg, code, detail) { super(msg); this.name = 'CaptureError'; this.code = code; this.detail = detail; }
}

/**
 * A persistent session. Use this when you want many captures: one connection means the daemon's
 * round-robin scheduler treats you as ONE claimant rather than N, and it can tell when you die.
 */
export class CaptureSession {
  constructor(opts = {}) { this.opts = opts; this.sock = null; this.pending = new Map(); this.seq = 0; this.buf = ''; }

  async connect() {
    if (this.sock && !this.sock.destroyed) return;
    await ensureServer(this.opts);
    await new Promise((resolve, reject) => {
      const c = net.connect(SOCK_PATH);
      c.on('connect', () => { this.sock = c; resolve(); });
      c.on('error', reject);
      c.on('data', (d) => {
        this.buf += d;
        let nl;
        while ((nl = this.buf.indexOf('\n')) !== -1) {
          const line = this.buf.slice(0, nl); this.buf = this.buf.slice(nl + 1);
          if (!line.trim()) continue;
          let msg; try { msg = JSON.parse(line); } catch { continue; }
          const p = this.pending.get(msg.id);
          if (!p) continue;
          this.pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.result !== undefined ? msg.result : msg);
          else p.reject(new CaptureError(msg.error || 'capture failed', msg.code || 'ERROR', msg.detail));
        }
      });
      c.on('close', () => {
        const err = new CaptureError('capture daemon connection closed', 'DISCONNECTED');
        for (const [, p] of this.pending) p.reject(err);
        this.pending.clear();
        this.sock = null;
      });
    });
  }

  send(op, payload) {
    const id = 'c' + (++this.seq);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try { this.sock.write(JSON.stringify({ op, id, ...payload }) + '\n'); }
      catch (e) { this.pending.delete(id); reject(e); }
    });
  }

  /** One capture. Retries once across a daemon that died between calls. */
  async capture(spec) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.connect();
      try { return await this.send('capture', { spec }); }
      catch (e) {
        // A refusal or an unsettled frame is a RESULT, not a transport failure: never retry it,
        // and never soften it. S34: an unsettled frame is an error, never a quiet pass.
        if (e instanceof CaptureError && e.code !== 'DISCONNECTED') throw e;
        if (attempt === 1) throw e;
        this.sock = null;
        await sleep(300);
      }
    }
  }

  /**
   * Read-only world queries against the warm engine, batched into one round trip.
   *   const r = await s.query([['getTerrainAt', x, z], ['getWaterAt', x, z]]);
   * This is what lets a sampling tool stop booting a browser just to ask where the ground is.
   */
  async query(calls, opts = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.connect();
      try { return await this.send('query', { calls, ...opts }); }
      catch (e) {
        if (e instanceof CaptureError && e.code !== 'DISCONNECTED') throw e;
        if (attempt === 1) throw e;
        this.sock = null; await sleep(300);
      }
    }
  }

  async status() { await this.connect(); return this.send('status', {}); }
  close() { if (this.sock) { try { this.sock.end(); } catch { /* */ } this.sock = null; } }
}

/** One-shot: connect, capture, disconnect. */
export async function capture(spec, opts = {}) {
  const s = new CaptureSession(opts);
  try { return await s.capture(spec); } finally { s.close(); }
}

/**
 * Many captures over ONE connection, in order, with a progress callback.
 * `concurrency` is how many are allowed to be OUTSTANDING on the wire at once — the daemon still
 * renders them one at a time (there is one browser), but pipelining removes the round-trip
 * between frames. It is not a licence to spawn browsers; that is the whole point.
 */
export async function captureMany(specs, opts = {}) {
  const s = new CaptureSession(opts);
  const conc = Math.max(1, Number(opts.concurrency || 2));
  const out = new Array(specs.length);
  let next = 0, done = 0;
  try {
    await s.connect();
    await Promise.all(Array.from({ length: Math.min(conc, specs.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= specs.length) return;
        try { out[i] = { ok: true, ...(await s.capture(specs[i])) }; }
        catch (e) { out[i] = { ok: false, code: e.code, error: e.message, detail: e.detail }; }
        done++;
        if (opts.onProgress) opts.onProgress(done, specs.length, out[i], i);
      }
    }));
  } finally { s.close(); }
  return out;
}

export async function serverStatus() {
  const s = new CaptureSession();
  try { return await s.status(); } finally { s.close(); }
}
