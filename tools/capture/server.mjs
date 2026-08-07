#!/usr/bin/env node
/**
 * server.mjs — the shared capture daemon. One browser, one booted engine, a queue.
 *
 * WHY THIS EXISTS (ARBITRATION.md S34, and the measurement behind it)
 * ------------------------------------------------------------------
 * Boot costs ~9 s and each further shot ~2.2 s, so batching inside a tool was never the problem.
 * The problem is that EVERY AGENT RUNS ITS OWN BROWSER: at peak, forty `headless_shell` processes
 * on four cores, each independently re-rendering the same world, driving load to 44-103 and a
 * 1280x720 frame from 25 s to 150-260 s. The W1-01 round-4 builder's 117-frame region pack managed
 * three frames in twelve minutes and had to be abandoned.
 *
 * So: one browser for the whole box, and a cache keyed on the build so the same picture is
 * rendered once.
 *
 *   node tools/capture/server.mjs                 # run in the foreground (debugging)
 *   node tools/capture/server.mjs --daemon        # detach; normally started FOR you by the client
 *   node tools/capture/server.mjs --status
 *   node tools/capture/server.mjs --stop
 *
 * PROTOCOL: newline-delimited JSON over a unix domain socket at reports/runs/.capture/capd.sock.
 *   -> {"op":"capture","id":"<client-req-id>","spec":{...}}
 *   <- {"id":"...","ok":true,"result":{path, cached, settle, provenance, ...}}
 *   <- {"id":"...","ok":false,"error":"...","code":"UNSETTLED|ARRIVAL_REFUSED|...","detail":{...}}
 *   other ops: ping, status, stop, flush-cache
 *
 * FAIRNESS. There is one browser, so captures are serial no matter what. The scheduler is
 * therefore not about parallelism, it is about who goes next: each CONNECTION gets its own FIFO
 * and the worker round-robins across connections. An agent submitting a 117-frame pack does not
 * make a second agent asking for one frame wait 117 frames — it waits one. Without this the queue
 * is first-come-first-served and the big job starves everyone behind it.
 *
 * A CLIENT THAT DIES. Its connection closes; its pending jobs are dropped from its queue. A job
 * already in flight runs to completion and is written to the cache — the work is done, throwing it
 * away would only mean rendering it again — and its reply is discarded without touching the
 * socket. The daemon never dies of an EPIPE.
 *
 * LIFECYCLE. Two idle timers: `--browser-idle` (default 180 s) closes the browser but keeps the
 * socket, so the next request pays a boot but no ceremony; `--idle` (default 1800 s) exits the
 * daemon entirely. The container gets reclaimed, so clients must cope with the daemon vanishing —
 * they do, by re-ensuring it (see client.mjs).
 *
 * BUILD STALENESS. The browser holds the code it loaded at boot. If game/ changes underneath it,
 * that browser is drawing the OLD game, so the daemon watches game/ with a cheap stat signature,
 * and on a change closes the browser and recomputes the build key. Captures then land in a new
 * cache bucket. A stale picture cannot outlive the code that drew it (S34).
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseArgs, wantsHelp, usage, ensureDir, sha256, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import {
  PROTOCOL, CAPD_DIR, SOCK_PATH, LOCK_PATH, LOG_PATH, CACHE_DIR, CACHE_KEY_PATH,
  canonicalSpec, cacheKey, cachePaths, stableJson, unknownKeys,
} from './protocol.mjs';
import { buildKey, statSignature } from './buildkey.mjs';
import { classify } from './arrival.mjs';
import {
  THUMB_SOURCE, THRESHOLD, GAP, SKIP_RULE,
  snap, diffSlots, triad, residency, judge, UnsettledError,
} from './settle.mjs';

const USAGE = `
server.mjs — the shared capture daemon (one browser for the whole box).

USAGE
  node tools/capture/server.mjs [--daemon] [--idle <s>] [--browser-idle <s>]
  node tools/capture/server.mjs --status
  node tools/capture/server.mjs --stop

OPTIONS
  --daemon           detach and return immediately (normally done for you by the client)
  --idle <s>         exit after this many idle seconds (default 1800)
  --browser-idle <s> close the browser after this many idle seconds (default 180)
  --job-timeout <s>  a single capture may take this long before it is failed (default 300)
  --status           print the running daemon's status as JSON and exit
  --stop             ask the running daemon to shut down
  --no-cache         serve nothing from cache and write nothing to it
  --pin-build        freeze the build key at boot: do not drop the browser when game/ changes.
                     For a long coherent pack (a 117-frame region pack must be drawn by ONE build
                     or it is a mixture of games). Every capture then records build_pinned: true
                     and, if the tree has since moved, tree_has_since_moved_to.

CLIENTS
  node tools/harness/shot.mjs --viewpoint VP01           one command, prints a path
  import { capture } from 'tools/capture/client.mjs'     from a tool
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const IDLE_MS = Number(args.idle || 1800) * 1000;
const BROWSER_IDLE_MS = Number(args['browser-idle'] || 180) * 1000;
const JOB_TIMEOUT_MS = Number(args['job-timeout'] || 300) * 1000;
const USE_CACHE = !args['no-cache'];
const PIN_BUILD = !!args['pin-build'];

ensureDir(CAPD_DIR);
ensureDir(CACHE_DIR);

// ---------------------------------------------------------------------------------------------
// one-shot client modes
// ---------------------------------------------------------------------------------------------
function ask(op, payload = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const c = net.connect(SOCK_PATH);
    let buf = '';
    const t = setTimeout(() => { c.destroy(); reject(new Error('timeout')); }, timeoutMs);
    c.on('error', (e) => { clearTimeout(t); reject(e); });
    c.on('connect', () => c.write(JSON.stringify({ op, id: 'cli', ...payload }) + '\n'));
    c.on('data', (d) => {
      buf += d;
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      clearTimeout(t);
      let msg; try { msg = JSON.parse(buf.slice(0, nl)); } catch (e) { reject(e); return; }
      c.end();
      resolve(msg);
    });
  });
}

if (args.status) {
  try { process.stdout.write(JSON.stringify(await ask('status'), null, 2) + '\n'); process.exit(0); }
  catch (e) { process.stdout.write(JSON.stringify({ running: false, reason: e.message }, null, 2) + '\n'); process.exit(1); }
}
if (args.stop) {
  try { await ask('stop'); process.stdout.write('stopped\n'); process.exit(0); }
  catch { process.stdout.write('not running\n'); process.exit(0); }
}

// ---------------------------------------------------------------------------------------------
// --daemon: re-exec ourselves detached, then wait for the socket to answer
// ---------------------------------------------------------------------------------------------
if (args.daemon) {
  const alive = await isServing();
  if (alive) { process.stdout.write(SOCK_PATH + '\n'); process.exit(0); }
  const fd = fs.openSync(LOG_PATH, 'a');
  const child = spawn(process.execPath, [
    path.join(REPO_ROOT, 'tools/capture/server.mjs'),
    '--idle', String(IDLE_MS / 1000),
    '--browser-idle', String(BROWSER_IDLE_MS / 1000),
    '--job-timeout', String(JOB_TIMEOUT_MS / 1000),
    ...(USE_CACHE ? [] : ['--no-cache']),
    ...(PIN_BUILD ? ['--pin-build'] : []),
  ], { detached: true, stdio: ['ignore', fd, fd], cwd: REPO_ROOT });
  child.unref();
  for (let i = 0; i < 200; i++) {
    if (await isServing()) { process.stdout.write(SOCK_PATH + '\n'); process.exit(0); }
    await sleep(100);
  }
  process.stderr.write('capture daemon did not come up; see ' + LOG_PATH + '\n');
  process.exit(EXIT.INTERNAL);
}

// ---------------------------------------------------------------------------------------------
// the daemon proper
// ---------------------------------------------------------------------------------------------
async function isServing() {
  if (!fs.existsSync(SOCK_PATH)) return false;
  return new Promise((resolve) => {
    const c = net.connect(SOCK_PATH);
    const done = (v) => { try { c.destroy(); } catch { /* */ } resolve(v); };
    c.on('error', () => done(false));
    c.on('connect', () => done(true));
    setTimeout(() => done(false), 2000);
  });
}

/**
 * Exclusive start. N agents racing `--daemon` must end up with ONE daemon and ONE browser.
 *
 * THE FIRST VERSION OF THIS WAS WRONG, and its own log caught it. It used an O_EXCL lock file as
 * the rendezvous and treated a lock as stale when the holder's pid was alive but its socket did
 * not yet answer. That window — between taking the lock and finishing `listen()` — is exactly when
 * six agents arrive at once, so three challengers in a row declared the lock stale, unlinked it
 * AND the socket, and bound anyway. Measured, from capd.log: four processes logged "listening on"
 * within 300 ms of each other.
 *
 * The fix is to stop using the lock file as the exclusion at all. **`listen()` on a unix socket
 * path IS the atomic operation** — the kernel lets exactly one process bind a given path, and a
 * second gets EADDRINUSE. So:
 *
 *   1. try to bind. Bound => we own it, unconditionally.
 *   2. EADDRINUSE and something answers => a live daemon owns it; exit 0 quietly.
 *   3. EADDRINUSE and nothing answers => the file is a corpse from a killed daemon. THAT is the
 *      only thing the lock file now serialises: removing it, so two survivors do not unlink each
 *      other's fresh socket.
 *
 * A lock is broken only when its holder's pid is gone or it is older than LOCK_STALE_MS, which is
 * a bound on how long an unlink can take, not a guess about how long a boot takes.
 */
const LOCK_STALE_MS = 30000;
/** True only for the process that actually bound the socket. Guards the unlink on shutdown. */
let I_OWN_SOCKET = false;
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function tryListen() {
  return new Promise((resolve) => {
    const onErr = (e) => { server.removeListener('listening', onOk); resolve(e.code || 'ERR'); };
    const onOk = () => { server.removeListener('error', onErr); resolve(null); };
    server.once('error', onErr);
    server.once('listening', onOk);
    server.listen(SOCK_PATH);
  });
}

/** @returns 'owner' | 'loser' | 'failed' */
async function bindExclusive() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const err = await tryListen();
    if (!err) { I_OWN_SOCKET = true; return 'owner'; }
    if (err !== 'EADDRINUSE') { logLine('listen failed:', err); return 'failed'; }
    if (await isServing()) return 'loser';          // a live daemon owns the path

    // The socket file is a corpse. Serialise its removal through the lock file.
    let holdsLock = false;
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), sock: SOCK_PATH }));
      fs.closeSync(fd);
      holdsLock = true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let held = null;
      try { held = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8')); } catch { /* corrupt */ }
      const dead = !held || !held.pid || !pidAlive(held.pid);
      const ancient = !held || !held.at || (Date.now() - held.at > LOCK_STALE_MS);
      if (dead || ancient) { try { fs.unlinkSync(LOCK_PATH); } catch { /* raced */ } }
    }
    if (holdsLock) {
      if (!(await isServing())) { try { fs.unlinkSync(SOCK_PATH); } catch { /* raced */ } }
      try { fs.unlinkSync(LOCK_PATH); } catch { /* raced */ }
    }
    await sleep(80 + Math.random() * 220);
  }
  return 'failed';
}

const started = Date.now();
const logLine = (...a) => process.stdout.write(`[capd ${new Date().toISOString()}] ${a.join(' ')}\n`);

// ---- build identity -------------------------------------------------------------------------
let BUILD = buildKey();
let BUILD_SIG = statSignature().sig;
// (logged after the bind, so a losing process never writes a line that looks like a start)

/** Set when --pin-build is in force and the tree has moved on since the daemon booted. */
let DRIFTED_TO = null;

/**
 * Cheap; called before every job. Returns true if the browser must be thrown away.
 *
 * Under --pin-build the browser is NOT thrown away and the cache key does NOT move: the daemon
 * goes on serving the build it booted with, so a long pack is drawn by one game rather than by
 * four. This is not a convenience — measured during this piece's own headline run, another
 * builder edited game/ four times in three minutes, and an unpinned daemon correctly threw the
 * browser away each time, which makes a 117-frame pack a mixture of four different games.
 *
 * It still notices the drift and RECORDS it, because the alternative — serving a picture that
 * silently claims to be of the current tree — is exactly what S34's build key exists to prevent.
 * A pinned capture says "drawn by build X, and the tree has since moved to Y".
 */
function refreshBuild() {
  const sig = statSignature().sig;
  if (sig === BUILD_SIG) return false;
  BUILD_SIG = sig;
  const next = buildKey();
  if (next.build_key === BUILD.build_key) { DRIFTED_TO = null; return false; }  // mtimes moved, content did not
  if (PIN_BUILD) {
    if (DRIFTED_TO !== next.build_key) logLine('build drifted to', next.build_key, '- PINNED to', BUILD.build_key, ', not dropping the browser');
    DRIFTED_TO = next.build_key;
    return false;
  }
  logLine('BUILD CHANGED', BUILD.build_key, '->', next.build_key, '- dropping the browser');
  BUILD = next;
  return true;
}

/**
 * A harness call that THROWS instead of exiting the process.
 *
 * `handle.h()` in tools/lib/browser.mjs ends a harness error with `die()`, which calls
 * `process.exit()`. That is right for a one-shot tool and fatal for a shared daemon: one bad pose
 * from one client would take the browser down for everyone else queued behind it. Measured — a
 * single `camera({dir:null})` killed the daemon three times in a row before this existed.
 */
async function hx(h, method, ...callArgs) {
  const res = await h.page.evaluate(async ({ m, a }) => {
    const H = window.__HARNESS;
    if (!H) return { __err: 'window.__HARNESS is not defined' };
    if (typeof H[m] !== 'function') return { __err: `window.__HARNESS.${m} is not a function` };
    try { return { __ok: await H[m](...a) }; }
    catch (e) { return { __err: `${m}() threw: ${e && e.message || e}` }; }
  }, { m: method, a: callArgs });
  if (res && res.__err) { const e = new Error(res.__err); e.harness = true; throw e; }
  return res ? res.__ok : undefined;
}

/** Optional method: undefined instead of throwing when the game does not implement it. */
async function hxOpt(h, method, ...callArgs) {
  const present = await h.page.evaluate((m) => !!(window.__HARNESS && typeof window.__HARNESS[m] === 'function'), method);
  if (!present) return undefined;
  return hx(h, method, ...callArgs);
}

// ---- the browser ------------------------------------------------------------------------------
let handle = null;
let handleW = 0, handleH = 0;
let handleBuild = null;
let booting = null;

const stats = {
  requests: 0, cache_hits: 0, cache_misses: 0, refusals: 0, unsettled: 0, errors: 0,
  browser_boots: 0, boot_ms_total: 0, capture_ms_total: 0, captures: 0,
};

/**
 * `launchGame()` reports every failure through `die()`, which calls `process.exit()`. For a
 * one-shot tool that is right. For a shared daemon it is fatal in the literal sense: while this
 * was being built another builder's in-flight edit left `game/` throwing at boot
 * (`_assertGiversAreVisibleToRace`), and the daemon died, respawned, died again — a flap that
 * would have taken every other agent's captures down with it.
 *
 * So the boot is run with `process.exit` swapped for a throw, restored in a `finally`. The
 * failure then becomes an ordinary job error (`GAME_BROKEN`) that names the reason, and the
 * daemon stays up to serve cache hits and to answer `--status`. A broken game/ is the game's
 * problem; it must not also be an outage.
 */
async function guardedBoot(fn) {
  const realExit = process.exit;
  process.exit = (code) => { const e = new Error('launchGame() exited with code ' + code); e.bootExit = code; throw e; };
  try { return await fn(); } finally { process.exit = realExit; }
}

/** Backoff after a failed boot, so a broken game/ is not re-booted once per queued job. */
let bootFailedAt = 0, bootFailReason = null;
const BOOT_BACKOFF_MS = 15000;

async function ensureBrowser(width, height) {
  if (booting) await booting;
  if (handle && handleBuild !== BUILD.build_key) await dropBrowser('build changed');
  if (!handle) {
    if (bootFailedAt && Date.now() - bootFailedAt < BOOT_BACKOFF_MS) {
      const e = new Error(bootFailReason); e.gameBroken = true; throw e;
    }
    booting = (async () => {
      const t0 = Date.now();
      stats.browser_boots++;
      logLine('booting browser', `${width}x${height}`);
      const h = await guardedBoot(() => launchGame({ width, height }));
      await h.page.addInitScript(THUMB_SOURCE);
      await h.page.evaluate(THUMB_SOURCE);
      await hx(h, 'setRenderRate', 0);   // AGENT-PROTOCOL: never step with the renderer live
      handle = h; handleW = width; handleH = height; handleBuild = BUILD.build_key;
      bootFailedAt = 0; bootFailReason = null;
      stats.boot_ms_total += Date.now() - t0;
      logLine('browser up in', (Date.now() - t0) + 'ms');
    })();
    try { await booting; }
    catch (e) {
      stats.boot_failures = (stats.boot_failures || 0) + 1;
      bootFailedAt = Date.now();
      bootFailReason = 'the game does not boot on this build (' + BUILD.build_key + '): ' + String(e && e.message || e) +
        ' — see ' + LOG_PATH + '. The capture daemon is still up; it cannot render until game/ boots.';
      logLine('BOOT FAILED:', bootFailReason);
      const err = new Error(bootFailReason); err.gameBroken = true; throw err;
    }
    finally { booting = null; }
  }
  if (handleW !== width || handleH !== height) {
    // The page listens for `resize` (game/src/main.js) and calls renderer.setSize(), so the
    // drawing buffer follows the viewport. No reboot needed to change capture resolution.
    await handle.page.setViewportSize({ width, height });
    await handle.page.evaluate(() => window.dispatchEvent(new Event('resize')));
    handleW = width; handleH = height;
  }
  return handle;
}

async function dropBrowser(why) {
  if (!handle) return;
  logLine('closing browser:', why);
  const h = handle; handle = null; handleBuild = null; handleW = handleH = 0;
  loadedState = null; loadedSeed = null; worldDirty = false;   // a new browser is a new world
  try { await h.close(); } catch { /* */ }
}

// ---- the capture itself -------------------------------------------------------------------------
let loadedState = null;
let loadedSeed = null;
/**
 * Set whenever a job leaves the world in a state its spec does not fully describe — a spawned
 * entity, an opened menu, an arbitrary `ops` call. The next job then reloads before it starts.
 *
 * This is a CACHE-SOUNDNESS requirement, not tidiness. The cache promises that a key determines a
 * picture; if a capture's result depended on which job ran before it, two agents asking the same
 * question on the same build would get different pictures and one of them would be cached as the
 * answer. So: a capture that does not itself say where the player is (no `place`) reloads, and a
 * capture that follows a world-mutating one reloads. A `place` capture after a clean `place`
 * capture does not — which is the whole of the region pack, and its fast path is preserved.
 */
let worldDirty = false;

/**
 * WHICH ENVIRONMENT DIMENSIONS THE LAST JOB LEFT SET, AND WHY THIS EXISTS.
 *
 * `setTimeOfDay`, `setWeather` and `setTide` write `sim.env` and NOTHING PUTS THEM BACK. The R1
 * critic broke the cache's central promise with exactly that: `place(A)` with no time and no
 * weather, then `place(A)` with `time: 1, weather: storm`, then the byte-identical first spec again
 * — three renders, and rows 1 and 3 came out as different pictures (`54822b05d5de` vs
 * `ce6b6e011369`, against a control of the same spec three times running at `3da4742d0c0d` x3).
 * The mechanism was that a `place` -> `place` sequence never reloads, so a spec that omits a
 * condition INHERITS the previous job's condition, and `canonicalSpec` banked a night storm under
 * `time: null, weather: null`. That is not an exotic path: it is what `shot.mjs --at <x>,<z>` sends
 * whenever the caller does not pass `--time`, which is the documented headline usage.
 *
 * The fix is per-dimension rather than a blanket reload, because a blanket reload would destroy the
 * region pack's fast path (its whole cost is the 25 province tiles a `loadState` throws away). A
 * dimension is DIRTY once some job has set it. The next job must reload if, and only if, it leaves a
 * dirty dimension UNPINNED — because only then does its picture depend on a job it never named.
 * Pin all three and the fast path is preserved; pin none and nothing was dirtied and it is also
 * preserved. Reloading clears all three.
 */
const envDirty = { time: false, weather: false, tide: false };

async function performCapture(spec, raw, outPng) {
  const T = {};
  const tick = (k, t) => { T[k] = (T[k] || 0) + (Date.now() - t); };
  const h = await ensureBrowser(spec.width, spec.height);
  if (h !== handle) worldDirty = true;   // a fresh browser is a fresh world; belt and braces

  let t = Date.now();
  if (loadedSeed !== spec.seed) { await hx(h, 'setSeed', spec.seed); loadedSeed = spec.seed; }
  // A dirty environment dimension this spec does not pin is inherited condition — see `envDirty`.
  const inheritsEnv = (envDirty.time && spec.time === null)
    || (envDirty.weather && spec.weather === null)
    || (envDirty.tide && spec.tide === null);
  const mustReload = loadedState !== spec.state || worldDirty || !spec.place || inheritsEnv;
  if (mustReload) {
    await hx(h, 'loadState', spec.state);
    loadedState = spec.state; worldDirty = false;
    envDirty.time = envDirty.weather = envDirty.tide = false;
  }
  // A MENU LEFT OPEN BY THE PREVIOUS JOB PAUSES THE WORLD, AND THE NEXT JOB'S `ops` THEN
  // SIMULATE NOTHING. Found by W1-MAP after three map captures in a row came back showing an
  // empty map: `loadState` does not close a menu, a menu pauses the simulation outside combat,
  // and `engine._step()`'s paused branch latches input WITHOUT calling `stepOnce()`. So every
  // `['stepFrames', n]` in `spec.ops` advanced nothing, while `teleport` still moved the body —
  // the body was placed and no frame was ever simulated there. The first capture after a browser
  // boot looked right and every one after it was quietly unsimulated, which is the worst shape a
  // defect can have in a service that other agents cite as evidence.
  //
  // Closed unconditionally and before placement: a menu opened by a previous spec is never part
  // of this spec's declaration, and a spec that wants one opens it after `ops` below.
  await hxOpt(h, 'closeMenu');
  await hxOpt(h, 'setUIVisible', !!spec.ui);
  tick('setup_ms', t);

  // ---- placement. Everything this daemon does is PLACED (S34); there is no walking mode. ----
  t = Date.now();
  let camX = null, camZ = null;
  if (spec.place) {
    // `teleport()` streams and drains around the BODY (engine.js), which is where most of the
    // cost of a fresh location lives: 25 province tiles built from nothing.
    await hx(h, 'teleport', spec.place.x, spec.place.z, spec.place.y === null ? {} : { y: spec.place.y });
    camX = spec.place.x; camZ = spec.place.z;
  }
  if (spec.time !== null) { await hxOpt(h, 'setTimeOfDay', spec.time); envDirty.time = true; }
  if (spec.weather !== null) { await hxOpt(h, 'setWeather', spec.weather); envDirty.weather = true; }
  if (spec.tide !== null) { await hxOpt(h, 'setTide', spec.tide); envDirty.tide = true; }
  if (spec.ops.length || spec.menu) worldDirty = true;
  for (const op of spec.ops) await hx(h, op[0], ...op.slice(1));
  if (spec.menu) await hxOpt(h, 'openMenu', spec.menu.name, spec.menu.opts || {});
  tick('place_ms', t);

  t = Date.now();
  if (spec.pose) {
    // Ground-relative: resolve the eye height against the terrain the body is standing on, then
    // build the same pose shoot.mjs and province-shots.mjs build by hand.
    const at = spec.place ? spec.place : null;
    let gy = 0;
    if (at) { const tt = await hx(h, 'getTerrainAt', at.x, at.z); gy = tt && tt.y !== undefined ? tt.y : 0; }
    const yaw = spec.pose.yaw_deg * Math.PI / 180, pitch = spec.pose.pitch_deg * Math.PI / 180;
    const R = 40, ex = at ? at.x : 0, ez = at ? at.z : 0, ey = gy + spec.pose.eye_m;
    await hx(h, 'camera', {
      pos: [ex, ey, ez],
      look: [ex + Math.sin(yaw) * R, ey - Math.tan(pitch) * R, ez + Math.cos(yaw) * R],
      fov: spec.pose.fov,
    });
    camX = ex; camZ = ez;
  } else if (spec.camera) {
    await hx(h, 'camera', spec.camera);
    if (Array.isArray(spec.camera.pos)) { camX = spec.camera.pos[0]; camZ = spec.camera.pos[2]; }
  }
  if (camX === null) {
    const p = await h.page.evaluate(() => {
      const st = window.__HARNESS.snapshot ? window.__HARNESS.snapshot({ minimal: true }) : null;
      const q = st && st.player && st.player.pos;
      return q ? [q[0], q[1], q[2]] : null;
    });
    if (p) { camX = p[0]; camZ = p[2]; }
  }
  tick('pose_ms', t);

  // Stream around the CAMERA, not around the player. A pose is allowed to sit a long way from the
  // body, and `teleport()` only streams around the body — which is exactly how a capture ends up
  // being a photograph of nothing. This is the remedy; G1 below is the check that it worked.
  //
  // `__no_camera_stream` is a FALSIFICATION HOOK, and it is here on purpose. It removes this
  // remedy — nothing else. It does not touch G1/G2/G3, so a request that sets it must be REFUSED
  // by the settle gate; that is how an independent critic confirms the gate is real rather than
  // decorative. See tools/capture/falsify.mjs. TOOL-LOOP rule 3.2: a probe that cannot fail is
  // worse than no probe.
  t = Date.now();
  const inProvince = camX !== null && !raw.__no_camera_stream;
  if (inProvince) { try { await hx(h, 'streamAround', camX, camZ); } catch { /* not in the province */ } }
  tick('stream_ms', t);

  // THE CONDITIONS THE FRAME WAS ACTUALLY TAKEN IN, read back off the engine rather than copied
  // from the request. `spec.time: null` means "the caller did not pin it", which is not the same
  // statement as "it was noon", and the R1 critic's P4 turned exactly that silence into a night
  // storm banked under a daylight key. The reload rule above is what makes the picture
  // deterministic; this is what makes it AUDITABLE — a reader of the sidecar can see the conditions
  // without re-deriving them, and a future divergence between `spec.time` and
  // `env_observed.time_of_day` is visible instead of silent.
  const envObserved = (await hxOpt(h, 'getEnvConditions')) || null;

  // ---- the settle proof: A(t), B(t+gap), C(t+2gap) ----
  //
  // RETRY, AND WHY IT IS NOT A WEAKENING OF THE GATE.
  // G3 compares the first interval's change against the second, and the second is a ONE-SAMPLE
  // estimate of a noisy quantity. On a coast under weather that estimate is occasionally low
  // enough to make a perfectly settled frame look unsettled: measured once in ~40 frames of the
  // region pack (d1=0.0293, ambient floor d2=0.0174, excess=0.0120 against a 0.005 threshold).
  // The correct response to "something may still have been arriving" is to WAIT LONGER AND
  // RE-PROVE — that is what a settle test is for — not to raise the threshold until nothing
  // fires. So: up to SETTLE_ATTEMPTS attempts, each stepping four more gaps of settle frames than
  // the last, and the frame is delivered only if an attempt PASSES all three gates. The number of
  // attempts and the frames actually spent are recorded in the proof, so a reader can see a frame
  // that needed persuading. A capture that never passes is still an error, never a quiet pass.
  const SETTLE_ATTEMPTS = 3;
  const gap = spec.settle_gap;
  let proof = null, resid = null, lastErr = null, attempts = 0, framesSpent = 0;
  for (let a = 0; a < SETTLE_ATTEMPTS; a++) {
    attempts++;
    const extra = a === 0 ? spec.settle_frames : gap * 4;
    framesSpent += extra;
    t = Date.now();
    if (extra > 0) await hx(h, 'stepFrames', extra);
    await hx(h, 'renderFrame');
    await snap(h.page, 'A');
    resid = { queued: 0, built: 0, tiles_queued: 0, tiles_resident: null, not_in_province: true };
    if (camX !== null) {
      try { resid = await residency({ h: (m, ...ar) => hx(h, m, ...ar), hOpt: (m, ...ar) => hxOpt(h, m, ...ar) }, camX, camZ); }
      catch (e) { resid = { queued: 0, built: 0, tiles_queued: 0, tiles_resident: null, not_in_province: true, note: String(e.message) }; }
    }
    await hx(h, 'stepFrames', gap);
    await hx(h, 'renderFrame');
    await snap(h.page, 'B');
    framesSpent += gap;
    // B is the DELIVERED frame, and it is written to disk before C is taken. What the settle proof
    // judges is therefore the picture that ships, not a neighbour of it.
    const ts = Date.now();
    await h.page.screenshot({ path: outPng, type: 'png', animations: 'disabled', caret: 'hide', timeout: JOB_TIMEOUT_MS });
    tick('screenshot_ms', ts);
    // ---- G3's EVIDENCE IS A TRIAD, NOT A PAIR. --------------------------------------------------
    //
    // The rebuilt judge() needs |A-C| as well as |A-B| and |B-C|, because a steady arrival and a
    // live-but-settled scene are INDISTINGUISHABLE in (d1, d2) — measured, the settled
    // marauders-coast frame is (0.0644, 0.0640) and the critic's slow loader is (0.060, 0.055).
    // Ambient motion is stationary, so |A-C| stays at the size of one interval; arrival accumulates,
    // so |A-C| approaches their sum. This is where that third comparison is taken, and it costs no
    // extra frame: A and C are frames the proof already holds.
    //
    // Until this call existed, server.mjs computed only two diffSlots() and handed judge() no d13 at
    // all, so the rebuilt gate would have failed CLOSED on every capture with any motion in it. A
    // gate wired to nothing refuses everything, which is a different way of not working.
    let d1 = await diffSlots(h.page, 'A', 'B');
    let d2 = null, d13 = null, set = null, frameC = true;

    // THE SKIP. See SKIP_RULE in settle.mjs: C is taken UNLESS A and B are block-identical and the
    // streamer is both fully resident and idle, in which case there is no source of arrival left to
    // see. Measured across the 18 G1-clean calibration frames: d1 = 0 in 10 of them and every one of
    // those 10 also had d2 = 0. `settle_always_c` in the spec disables the skip (and is in the cache
    // key, because it changes what is PROVED about the picture).
    const g1g2Clean = resid && resid.ran === true && resid.queued === 0 &&
      resid.built === 0 && resid.tiles_queued === 0;
    if (!spec.settle_always_c && d1.frac === 0 && g1g2Clean) {
      frameC = false;
    } else {
      await hx(h, 'stepFrames', gap);
      await hx(h, 'renderFrame');
      await snap(h.page, 'C');
      framesSpent += gap;
      const tri = await triad(h.page, 'A', 'B', 'C');
      d1 = tri.d1; d2 = tri.d2; d13 = tri.d13; set = tri.set;
    }
    tick('settle_ms', t);
    try {
      proof = judge({
        resid, d1, d2, d13, set, frame_c: frameC,
        threshold: spec.settle_threshold, gap, frames: spec.settle_frames,
      });
      break;
    } catch (e) {
      if (!(e instanceof UnsettledError)) throw e;
      lastErr = e;
      // A residency failure is NOT a "wait longer" problem — the world is absent, not late — so
      // do not burn two more attempts pretending it might settle.
      if (!e.proof.gates.G1_residency.pass || !e.proof.gates.G2_quiescence.pass) break;
    }
  }
  if (!proof) {
    lastErr.proof.settle_attempts = attempts;
    lastErr.proof.settle_frames_spent = framesSpent;
    throw lastErr;
  }
  proof.settle_attempts = attempts;
  proof.settle_frames_spent = framesSpent;

  return {
    proof, resid, env_observed: envObserved, reloaded: mustReload,
    camera_at: camX === null ? null : [camX, camZ], page_errors: h.errors.length, phases: T,
  };
}

/**
 * READ-ONLY WORLD QUERIES.
 *
 * A batch tool that samples the world before it photographs it — province-shots.mjs rejects up to
 * 20,000 candidate points against `getTerrainAt`/`getWaterAt` before it takes a frame — used to
 * need its own browser purely to ask those questions. It does not any more: it asks this one.
 *
 * The whitelist is not decoration. A query runs on the SAME engine an in-flight capture is using,
 * so anything that can move the world, the clock, the camera or the player is forbidden here; a
 * mutating call belongs in a capture spec's `ops`, where it is part of the cache key. Calls are
 * BATCHED into a single page.evaluate, because 20,000 socket round-trips would cost more than the
 * browser this exists to save.
 */
const QUERY_WHITELIST = new Set([
  'getTerrainAt', 'getWaterAt', 'getRegionAt', 'getRegionSignature', 'getSignatures',
  'getWorldStats', 'getProvinceStats', 'getTraversalReport', 'getHazardReport', 'getRoutes',
  'getTravelNetwork', 'getTravelState', 'listStations', 'listAnchors', 'listEntities',
  'getPlayerStats', 'getBuildInfo', 'getTide', 'getFrame', 'getSeed', 'getStateHash',
  'listMenus', 'listCameraModes', 'listPerspectiveModes', 'getCameraRig', 'getCameraFrame',
  'signatureAudit', 'getQuestState', 'projectPoint', 'solidAt',
]);

async function runQuery(job) {
  const calls = Array.isArray(job.raw.calls) ? job.raw.calls : [];
  const bad = calls.map((c) => c[0]).filter((m) => !QUERY_WHITELIST.has(m));
  if (bad.length) {
    return { ok: false, code: 'QUERY_FORBIDDEN',
      error: `query() is read-only; ${[...new Set(bad)].join(', ')} can mutate the world. ` +
        'Put a mutating call in a capture spec\'s `ops`, where it is part of the cache key.' };
  }
  if (refreshBuild()) await dropBrowser('build changed');
  let h;
  try { h = await ensureBrowser(job.raw.width || 1280, job.raw.height || 720); }
  catch (e) { return { ok: false, code: e.gameBroken ? 'GAME_BROKEN' : 'QUERY_ERROR', error: String(e && e.message || e) }; }
  if (loadedSeed !== (job.raw.seed ?? 1337)) { await hx(h, 'setSeed', job.raw.seed ?? 1337); loadedSeed = job.raw.seed ?? 1337; }
  if (loadedState !== (job.raw.state ?? 'default') || worldDirty) {
    await hx(h, 'loadState', job.raw.state ?? 'default');
    loadedState = job.raw.state ?? 'default'; worldDirty = false;
  }
  const out = await h.page.evaluate((cs) => cs.map((c) => {
    try { return { ok: true, value: window.__HARNESS[c[0]](...c.slice(1)) }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }), calls);
  return { ok: true, result: { results: out, build_key: BUILD.build_key } };
}

// =================================================================================================
// THE CACHE IS NOT A SOURCE OF PROVENANCE. It is a store of PIXELS.
// =================================================================================================
// The single worst finding in CAPTURE-SERVICE-R1: `runJob()` read the sidecar `.json` out of the
// cache bucket, checked two fields, and returned `{...man}` — the whole manifest, verbatim — as the
// service's OWN answer. The critic wrote a manifest by hand next to a 1x1 PNG and asked for it
// through the ordinary client API:
//
//     SERVED in 24 ms: arrival=walked, evidence_of=arrival, settled=true,
//     sha256 recorded=not-even-the-hash-of-this-file, actual=c414cd0e204de974...
//
// No browser booted, no gate ran, and the caller was handed "the player walked here from the south
// gate, unaided" over the service's own front door. S34(b) broken by writing a file.
//
// THREE INDEPENDENT LAYERS NOW STAND BETWEEN THE BUCKET AND THE CALLER, and they are ordered so
// that the load-bearing one needs no secret:
//
//   1. THE DAEMON RE-DERIVES PROVENANCE, ALWAYS. `provenanceBlock()` below is the ONLY thing that
//      ever constructs a provenance block, on a render and on a hit alike, and it stamps
//      `arrival: 'placed'` unconditionally because this daemon knows unconditionally that it has no
//      walking mode. Nothing read off disk can contribute to it. Even a perfectly-signed manifest
//      claiming `walked` cannot make the service say `walked`, because the field is not copied from
//      anywhere — it is asserted. This layer holds against an attacker who has everything.
//   2. THE BYTES ARE CHECKED. `sha256(png)` must equal the manifest's own recorded hash. This is not
//      only an attack surface: a truncated, half-copied or foreign PNG in a gitignored directory
//      shared by every agent on this box was previously served as a settled capture under an
//      authoritative-looking hash. The daemon's own write path is not atomic across the pair
//      (rename the png, then write the json), so it can produce a mismatched pair by being killed.
//   3. THE MANIFEST IS AUTHENTICATED. Every manifest this daemon writes carries an HMAC over the
//      fields that matter; a manifest without a valid one was not written by this daemon and is a
//      MISS. Defence in depth, and the honest limit is stated where the key is generated.
//
// A failure of any layer is a CACHE MISS — re-render, re-prove, overwrite — not an error and not a
// refusal. The world is allowed to have a corrupt file in it; what it is not allowed to do is
// believe one.

/**
 * The daemon's manifest-signing key.
 *
 * HONEST LIMIT, STATED HERE RATHER THAN IMPLIED: this authenticates "this daemon wrote this
 * manifest", nothing more. Every agent on this box runs as the same user, so anyone who can write
 * the cache directory can also read this file. It is not a defence against a hostile local process
 * and is not claimed as one — layer 1 above is what holds in that case. What it IS a defence
 * against is the thing that actually happens: a stray, half-written, hand-edited or foreign
 * `.json` in a shared gitignored bucket being replayed as the service's own testimony.
 *
 * Losing the key invalidates every cached manifest (they all become misses and are re-rendered).
 * That is the safe direction, and it is the same direction the build key already errs in.
 */
let MAC_KEY = null;
function macKey() {
  if (MAC_KEY) return MAC_KEY;
  try {
    MAC_KEY = fs.readFileSync(CACHE_KEY_PATH);
    if (MAC_KEY.length >= 32) return MAC_KEY;
  } catch { /* first run */ }
  MAC_KEY = crypto.randomBytes(32);
  ensureDir(path.dirname(CACHE_KEY_PATH));
  fs.writeFileSync(CACHE_KEY_PATH, MAC_KEY, { mode: 0o600 });
  logLine('generated a new cache manifest signing key at', CACHE_KEY_PATH,
    '- every manifest signed with the previous key is now a miss');
  return MAC_KEY;
}

/**
 * What is signed. Deliberately NOT the whole manifest: `provenance` is excluded because it is
 * re-derived rather than trusted, and including it would invite a future reader to think a valid
 * MAC made it safe to copy. Signing exactly what is later relied upon, and nothing else, is the
 * point — a signature over fields nobody checks is the cryptographic form of a gate that cannot
 * fail.
 */
function macPayload(man) {
  return stableJson({
    protocol: PROTOCOL,
    cache_key: man.cache_key,
    sha256: man.sha256,
    bytes: man.bytes,
    spec: man.spec,
    settle: man.settle,
    build_key: man.build && man.build.build_key,
    captured_at: man.captured_at,
  });
}

function signManifest(man) {
  return crypto.createHmac('sha256', macKey()).update(macPayload(man)).digest('hex');
}

function macValid(man) {
  if (!man || typeof man.mac !== 'string' || man.mac.length !== 64) return false;
  const want = Buffer.from(signManifest(man), 'hex');
  let got;
  try { got = Buffer.from(man.mac, 'hex'); } catch { return false; }
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(got, want);
}

/**
 * THE ONLY CONSTRUCTOR OF A PROVENANCE BLOCK. Called on a fresh render and on a cache hit, and it
 * takes nothing from disk. `arrival` is not a parameter — there is no argument you can pass this
 * function that makes it say anything other than `placed`.
 *
 * @param evidenceOf  the purpose the CURRENT request declared and the arrival gate accepted. Note
 *                    it is the current caller's declaration, not the one banked with the pixels:
 *                    two callers may legitimately want the same picture for different appearance
 *                    purposes, and each one's sidecar should record its own.
 */
function provenanceBlock({ evidenceOf, cameraAt, fromCache }) {
  return {
    arrival: 'placed',
    evidence_of: evidenceOf,
    placement: 'teleport + camera pose; the player did not walk here',
    build_key: BUILD.build_key,
    git_sha: BUILD.git_sha,
    git_dirty: BUILD.git_dirty,
    game_content_sha256: BUILD.game_content_sha256,
    // S34 names this flag and HARNESS.md 6 repeats it. It used to be written once at render time
    // and replayed unchanged, so the sidecar on disk said `false` for ever and a reader doing what
    // the documentation told them to do could never learn that a capture came from cache.
    served_from_cache: !!fromCache,
    build_pinned: PIN_BUILD,
    tree_has_since_moved_to: DRIFTED_TO,
    ruling: 'ARBITRATION.md S34(a) — admissible as evidence of APPEARANCE only. A verdict citing ' +
      'this capture for an ARRIVAL claim (reachability, traversal, the crossing, RI-JRN*, or ' +
      'anything timing something) is VOID.',
    camera_at: cameraAt,
  };
}

/**
 * Read a cache entry, or explain why it is a miss. Never throws, never trusts, never returns a
 * provenance block: the caller re-derives that.
 */
function readCache(paths, key) {
  let man;
  try { man = JSON.parse(fs.readFileSync(paths.json, 'utf8')); }
  catch (e) { return { hit: false, why: 'manifest unreadable: ' + (e && e.message) }; }

  if (!man || typeof man !== 'object') return { hit: false, why: 'manifest is not an object' };
  if (man.cache_key !== key) return { hit: false, why: 'manifest is filed under a different cache key' };
  if (!man.build || man.build.build_key !== BUILD.build_key) {
    return { hit: false, why: 'manifest was written by a different build' };
  }
  if (!man.settle || man.settle.settled !== true) return { hit: false, why: 'manifest carries no passing settle proof' };
  if (!macValid(man)) {
    return { hit: false, why: 'manifest is not signed by this daemon — it was not written by the ' +
      'thing that takes the pictures, so nothing in it is this service\'s testimony' };
  }
  let bytes;
  try { bytes = fs.readFileSync(paths.png); }
  catch (e) { return { hit: false, why: 'image unreadable: ' + (e && e.message) }; }
  const actual = sha256(bytes);
  if (actual !== man.sha256) {
    return { hit: false, why: `image bytes contradict the manifest's own sha256 (recorded ` +
      `${String(man.sha256).slice(0, 16)}, actual ${actual.slice(0, 16)})` };
  }
  return { hit: true, man, bytes: bytes.length, sha256: actual };
}

// ---- jobs ---------------------------------------------------------------------------------------
async function runJob(job) {
  const t0 = Date.now();
  stats.requests++;

  // 1. S34(b). Refuse before doing any work at all.
  const verdict = classify(job.raw);
  if (!verdict.ok) {
    stats.refusals++;
    return { ok: false, code: 'ARRIVAL_REFUSED', error: verdict.reason, detail: { matched: verdict.matched, ruling: 'ARBITRATION.md S34(b)' } };
  }

  if (refreshBuild()) await dropBrowser('build changed');

  const spec = canonicalSpec(job.raw);
  const { key, canon } = cacheKey(BUILD.build_key, job.raw);
  const paths = cachePaths(BUILD.build_key, key);
  ensureDir(paths.bucket);

  // 2. Cache.
  if (USE_CACHE && !job.raw.no_cache && fs.existsSync(paths.png) && fs.existsSync(paths.json)) {
    const c = readCache(paths, key);
    if (c.hit) {
      stats.cache_hits++;
      // RE-DERIVED, NOT REPLAYED. The pixels come from the bucket; every claim made about them is
      // made here, now, by the thing that is answering. `provenance` and `arrival` are rebuilt from
      // this daemon's own knowledge, and the manifest's own copies are dropped on the floor.
      const provenance = provenanceBlock({
        evidenceOf: verdict.evidence_of,
        cameraAt: (c.man.provenance && c.man.provenance.camera_at) || null,
        fromCache: true,
      });
      const served = {
        ...c.man,
        provenance,
        arrival_gate: { evidence_of: verdict.evidence_of, purpose_class: verdict.purpose_class, audit: verdict.audit },
        cached: true,
        cache_key: key,
        path: paths.png,
        manifest: paths.json,
        served_in_ms: Date.now() - t0,
      };
      delete served.mac;   // the signature authenticates the entry on disk; it is not a wire field
      // The sidecar must agree with what the caller was told (HARNESS.md 6 tells readers to read
      // the sidecar). Rewrite it with the cache flag set and re-sign, so disk and answer match.
      try {
        const onDisk = { ...c.man, provenance, served_from_cache_last: new Date().toISOString() };
        onDisk.mac = signManifest(onDisk);
        fs.writeFileSync(paths.json, JSON.stringify(onDisk, null, 2));
      } catch { /* a read-only bucket is not a reason to refuse a good picture */ }
      return { ok: true, result: served };
    }
    stats.cache_rejects = (stats.cache_rejects || 0) + 1;
    logLine('cache MISS on an existing entry:', c.why, '-', key.slice(0, 12));
  }
  stats.cache_misses++;

  // 3. Render.
  //
  // A capture that will not be banked does not get to touch the banked filename either. `no_cache`
  // used to render straight over `paths.png` and only decline to READ, so a request that altered
  // how the picture was produced could destroy a good cache entry as well as poison one. It renders
  // to its own name now, and the bucket's signed pair is left exactly as it was.
  const banking = USE_CACHE && !job.raw.no_cache;
  const finalPng = banking ? paths.png : paths.png.replace(/\.png$/, `.nocache.${process.pid}.${stats.requests}.png`);
  const tmp = finalPng + '.' + process.pid + '.tmp';
  let out;
  try {
    out = await performCapture(spec, job.raw, tmp);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* */ }
    if (e instanceof UnsettledError) {
      stats.unsettled++;
      // NOT a picture. S34: "an unsettled frame is an error, never a quiet pass."
      return { ok: false, code: 'UNSETTLED', error: e.message, detail: { settle: e.proof, spec: canon, ruling: 'ARBITRATION.md S34 anti-loophole' } };
    }
    if (e.gameBroken) {
      stats.errors++;
      return { ok: false, code: 'GAME_BROKEN', error: String(e && e.message || e), detail: { build_key: BUILD.build_key, log: LOG_PATH } };
    }
    stats.errors++;
    await dropBrowser('capture threw: ' + e.message);   // never let one bad job wedge the queue
    return { ok: false, code: 'CAPTURE_ERROR', error: String(e && e.message || e), detail: { spec: canon } };
  }

  fs.renameSync(tmp, finalPng);
  const bytes = fs.statSync(finalPng).size;
  const manifest = {
    schema: 'elder-souls/capture@1',
    protocol: PROTOCOL,
    cache_key: key,
    path: finalPng,
    bytes,
    sha256: sha256(fs.readFileSync(finalPng)),
    captured_at: new Date().toISOString(),
    spec: canon,
    // The conditions the frame was ACTUALLY taken in, read off the engine — not the ones the caller
    // did or did not ask for. See performCapture().
    env_observed: out.env_observed,
    world_reloaded: out.reloaded,
    // ---- PROVENANCE. S34 requires all four of these on every capture. Derived, never copied. ----
    provenance: provenanceBlock({
      evidenceOf: verdict.evidence_of,
      cameraAt: out.camera_at,
      fromCache: false,
    }),
    // R3(f): acceptance used to be SILENT — a laundered capture left no trace of what it was
    // requested for and no later audit could find one. The gate's own audit block is now banked
    // beside the picture.
    arrival_gate: { evidence_of: verdict.evidence_of, purpose_class: verdict.purpose_class, audit: verdict.audit },
    build: BUILD,
    settle: out.proof,
    phase_ms: out.phases,
    page_errors: out.page_errors,
    render_ms: Date.now() - t0,
  };
  manifest.mac = signManifest(manifest);
  // `no_cache` means WHAT IT SAYS. It used to mean "do not read" while still writing, so a request
  // that deliberately altered how the picture was produced — `__no_camera_stream` removes the
  // camera stream-drain and photographs an emptier world — could bank the result under the
  // legitimate key. That is a cache-poisoning primitive, and G1 closed it only by luck (the emptier
  // world usually fails residency). It does not write now.
  if (banking) fs.writeFileSync(paths.json, JSON.stringify(manifest, null, 2));
  stats.captures++;
  stats.capture_ms_total += Date.now() - t0;
  const served = { ...manifest, cached: false, manifest: banking ? paths.json : null, banked: banking, served_in_ms: Date.now() - t0 };
  delete served.mac;   // the signature authenticates the entry on disk; it is not a wire field
  return { ok: true, result: served };
}

// ---- the scheduler -------------------------------------------------------------------------------
const conns = new Map();          // connId -> {sock, queue:[], alive:true}
let nextConnId = 1;
let rrCursor = 0;
let working = false;
let lastActivity = Date.now();
let inflight = null;

/** Round-robin the next job across connections, so a 117-frame pack cannot starve a one-shot. */
function nextJob() {
  const ids = [...conns.keys()];
  if (!ids.length) return null;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[(rrCursor + i) % ids.length];
    const c = conns.get(id);
    if (c && c.queue.length) { rrCursor = (rrCursor + i + 1) % ids.length; return c.queue.shift(); }
  }
  return null;
}

function queueDepth() { let n = 0; for (const c of conns.values()) n += c.queue.length; return n; }

async function pump() {
  if (working) return;
  working = true;
  try {
    for (;;) {
      const job = nextJob();
      if (!job) break;
      lastActivity = Date.now();
      inflight = { id: job.id, conn: job.connId, since: Date.now(), spec_summary: summarise(job.raw) };
      let res;
      try {
        res = await Promise.race([
          job.op === 'query' ? runQuery(job) : runJob(job),
          new Promise((_, rej) => setTimeout(() => rej(new Error(`job exceeded ${JOB_TIMEOUT_MS}ms`)), JOB_TIMEOUT_MS)),
        ]);
      } catch (e) {
        stats.errors++;
        // A timed-out job may have left the page wedged. Throw the browser away rather than let
        // every job behind it inherit the problem.
        await dropBrowser('job timeout');
        res = { ok: false, code: 'TIMEOUT', error: String(e && e.message || e) };
      }
      inflight = null;
      lastActivity = Date.now();
      // The client may have died while we worked. The capture is still in the cache; only the
      // reply is lost. Writing to a dead socket must never take the daemon down.
      const c = conns.get(job.connId);
      if (c && c.alive) { try { c.sock.write(JSON.stringify({ id: job.id, ...res }) + '\n'); } catch { /* */ } }
      else logLine('dropped reply for', job.id, '- client gone (capture is cached)');
    }
  } finally { working = false; }
}

function summarise(raw) {
  return [raw.viewpoint || null, raw.place ? `@${Math.round(raw.place.x)},${Math.round(raw.place.z)}` : null,
    raw.time !== undefined ? `t=${raw.time}` : null, raw.weather || null].filter(Boolean).join(' ') || '(default)';
}

// ---- the socket ----------------------------------------------------------------------------------
// NOTE: no pre-emptive unlink here. Unlinking before listening is what let four daemons bind the
// same path at once — see bindExclusive() above.
const server = net.createServer((sock) => {
  const connId = nextConnId++;
  const c = { sock, queue: [], alive: true, opened: Date.now() };
  conns.set(connId, c);
  let buf = '';
  sock.on('error', () => { c.alive = false; });
  sock.on('close', () => {
    c.alive = false;
    if (c.queue.length) logLine(`client ${connId} vanished, dropping ${c.queue.length} queued job(s)`);
    conns.delete(connId);
  });
  sock.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { safeWrite(sock, { ok: false, error: 'bad JSON' }); continue; }
      handleMessage(connId, c, msg);
    }
  });
});

function safeWrite(sock, obj) { try { sock.write(JSON.stringify(obj) + '\n'); } catch { /* */ } }

function handleMessage(connId, c, msg) {
  lastActivity = Date.now();
  switch (msg.op) {
    case 'ping':
      return safeWrite(c.sock, { id: msg.id, ok: true, protocol: PROTOCOL, pid: process.pid, build: BUILD.build_key });
    case 'status':
      return safeWrite(c.sock, {
        id: msg.id, ok: true, running: true, protocol: PROTOCOL, pid: process.pid,
        uptime_s: Math.round((Date.now() - started) / 1000),
        build: { build_key: BUILD.build_key, git_sha: BUILD.git_sha, git_dirty: BUILD.git_dirty, pinned: PIN_BUILD, drifted_to: DRIFTED_TO },
        browser: handle ? { up: true, viewport: [handleW, handleH], build: handleBuild } : { up: false },
        clients: conns.size, queue_depth: queueDepth(), inflight,
        cache_dir: CACHE_DIR, cache_enabled: USE_CACHE,
        settle: { threshold: THRESHOLD, gap_frames: GAP, calibration: 'reports/capture/SETTLE-CALIBRATION.json' },
        stats,
      });
    case 'flush-cache': {
      let n = 0;
      const bucket = cachePaths(BUILD.build_key, 'x').bucket;
      if (fs.existsSync(bucket)) for (const f of fs.readdirSync(bucket)) { fs.unlinkSync(path.join(bucket, f)); n++; }
      return safeWrite(c.sock, { id: msg.id, ok: true, removed: n, bucket });
    }
    case 'stop':
      safeWrite(c.sock, { id: msg.id, ok: true, stopping: true });
      setTimeout(() => shutdown('client asked'), 50);
      return;
    case 'capture':
      c.queue.push({ id: msg.id, connId, op: 'capture', raw: msg.spec || {} });
      pump();
      return;
    case 'query':
      c.queue.push({ id: msg.id, connId, op: 'query', raw: msg });
      pump();
      return;
    default:
      return safeWrite(c.sock, { id: msg.id, ok: false, error: `unknown op ${JSON.stringify(msg.op)}` });
  }
}

// ---- lifecycle ------------------------------------------------------------------------------------
let shuttingDown = false;
async function shutdown(why) {
  if (shuttingDown) return;
  shuttingDown = true;
  logLine('shutting down:', why);
  clearInterval(idleTimer);
  try { server.close(); } catch { /* */ }
  for (const c of conns.values()) { try { c.sock.end(); } catch { /* */ } }
  await dropBrowser('shutdown');
  // ONLY the process that bound the socket may remove it. Found the hard way: a leftover daemon
  // that had lost the bind race was killed, and its shutdown unlinked the LIVE daemon's socket
  // out from under a 40-frame job that was halfway through. A process must not clean up a
  // resource it does not own.
  if (I_OWN_SOCKET) { try { fs.unlinkSync(SOCK_PATH); } catch { /* */ } }
  try {
    const held = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    if (held.pid === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch { /* */ }
  process.exit(0);
}

const idleTimer = setInterval(() => {
  if (working || queueDepth()) return;
  const idle = Date.now() - lastActivity;
  if (handle && idle > BROWSER_IDLE_MS) dropBrowser(`idle ${Math.round(idle / 1000)}s`);
  if (idle > IDLE_MS && conns.size === 0) shutdown(`idle ${Math.round(idle / 1000)}s`);
}, 5000);

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => shutdown(sig));
process.on('uncaughtException', (e) => { logLine('UNCAUGHT', e && e.stack || e); });
process.on('unhandledRejection', (e) => { logLine('UNHANDLED', e && e.stack || e); });

const outcome = await bindExclusive();
if (outcome === 'loser') {
  process.stderr.write('[capd] another capture daemon already owns ' + SOCK_PATH + ' - exiting\n');
  process.exit(0);
}
if (outcome !== 'owner') {
  process.stderr.write('[capd] could not bind ' + SOCK_PATH + '\n');
  process.exit(EXIT.INTERNAL);
}
fs.chmodSync(SOCK_PATH, 0o600);
logLine('build', BUILD.build_key, 'git', BUILD.git_sha && BUILD.git_sha.slice(0, 8), BUILD.git_dirty ? '(dirty)' : '');
logLine('listening on', SOCK_PATH, '| idle', IDLE_MS / 1000 + 's', '| browser-idle', BROWSER_IDLE_MS / 1000 + 's');
logLine('settle threshold', THRESHOLD, 'gap', GAP, '| cache', USE_CACHE ? CACHE_DIR : 'DISABLED',
  PIN_BUILD ? '| BUILD PINNED' : '');
