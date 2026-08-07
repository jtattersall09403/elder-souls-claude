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
import { spawn } from 'node:child_process';
import { parseArgs, wantsHelp, usage, ensureDir, sha256, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import {
  PROTOCOL, CAPD_DIR, SOCK_PATH, LOCK_PATH, LOG_PATH, CACHE_DIR,
  canonicalSpec, cacheKey, cachePaths,
} from './protocol.mjs';
import { buildKey, statSignature } from './buildkey.mjs';
import { classify } from './arrival.mjs';
import {
  THUMB_SOURCE, THRESHOLD, GAP,
  snap, diffSlots, residency, judge, UnsettledError,
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
 * Exclusive start. Two agents racing `--daemon` must end up with ONE daemon.
 *
 * The rendezvous is an O_EXCL lock file, not the socket: two servers that both find the socket
 * dead, both unlink it and both call listen() would BOTH succeed (the second unlinks the first's
 * socket out from under it) and the box would quietly hold two browsers. O_CREAT|O_EXCL is atomic
 * on this filesystem, so exactly one wins.
 *
 * A lock whose pid is gone, or whose pid is alive but whose socket does not answer, is stale and
 * is broken. That is what makes it safe after a container reclaim.
 */
async function acquireLock() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, sock: SOCK_PATH, started: new Date().toISOString() }));
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let held = null;
      try { held = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8')); } catch { /* corrupt */ }
      const pidAlive = held && held.pid ? (() => { try { process.kill(held.pid, 0); return true; } catch { return false; } })() : false;
      if (pidAlive && await isServing()) return false;            // someone else genuinely owns it
      // stale: the holder is gone, or is alive but not answering.
      try { fs.unlinkSync(LOCK_PATH); } catch { /* raced */ }
      try { fs.unlinkSync(SOCK_PATH); } catch { /* raced */ }
      await sleep(50 + Math.random() * 100);
    }
  }
  return false;
}

if (!(await acquireLock())) {
  process.stderr.write('[capd] another capture daemon already owns ' + SOCK_PATH + '\n');
  process.exit(0);
}

const started = Date.now();
const logLine = (...a) => process.stdout.write(`[capd ${new Date().toISOString()}] ${a.join(' ')}\n`);

// ---- build identity -------------------------------------------------------------------------
let BUILD = buildKey();
let BUILD_SIG = statSignature().sig;
logLine('build', BUILD.build_key, 'git', BUILD.git_sha && BUILD.git_sha.slice(0, 8), BUILD.git_dirty ? '(dirty)' : '');

/** Cheap; called before every job. Returns true if the browser must be thrown away. */
function refreshBuild() {
  const sig = statSignature().sig;
  if (sig === BUILD_SIG) return false;
  BUILD_SIG = sig;
  const next = buildKey();
  if (next.build_key === BUILD.build_key) return false;   // mtimes moved, content did not
  logLine('BUILD CHANGED', BUILD.build_key, '->', next.build_key, '— dropping the browser');
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

async function ensureBrowser(width, height) {
  if (booting) await booting;
  if (handle && handleBuild !== BUILD.build_key) await dropBrowser('build changed');
  if (!handle) {
    booting = (async () => {
      const t0 = Date.now();
      stats.browser_boots++;
      logLine('booting browser', `${width}x${height}`);
      const h = await launchGame({ width, height });
      await h.page.addInitScript(THUMB_SOURCE);
      await h.page.evaluate(THUMB_SOURCE);
      await hx(h, 'setRenderRate', 0);   // AGENT-PROTOCOL: never step with the renderer live
      handle = h; handleW = width; handleH = height; handleBuild = BUILD.build_key;
      stats.boot_ms_total += Date.now() - t0;
      logLine('browser up in', (Date.now() - t0) + 'ms');
    })();
    try { await booting; } finally { booting = null; }
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
  try { await h.close(); } catch { /* */ }
}

// ---- the capture itself -------------------------------------------------------------------------
let loadedState = null;
let loadedSeed = null;

async function performCapture(spec, raw, outPng) {
  const h = await ensureBrowser(spec.width, spec.height);

  if (loadedSeed !== spec.seed) { await hx(h, 'setSeed', spec.seed); loadedSeed = spec.seed; }
  if (loadedState !== spec.state) { await hx(h, 'loadState', spec.state); loadedState = spec.state; }
  await hxOpt(h, 'setUIVisible', !!spec.ui);

  // ---- placement. Everything this daemon does is PLACED (S34); there is no walking mode. ----
  let camX = null, camZ = null;
  if (spec.place) {
    await hx(h, 'teleport', spec.place.x, spec.place.z, spec.place.y === null ? {} : { y: spec.place.y });
    camX = spec.place.x; camZ = spec.place.z;
  }
  if (spec.time !== null) await hxOpt(h, 'setTimeOfDay', spec.time);
  if (spec.weather !== null) await hxOpt(h, 'setWeather', spec.weather);
  if (spec.tide !== null) await hxOpt(h, 'setTide', spec.tide);
  for (const op of spec.ops) await hx(h, op[0], ...op.slice(1));
  if (spec.menu) await hxOpt(h, 'openMenu', spec.menu.name, spec.menu.opts || {});

  if (spec.pose) {
    // Ground-relative: resolve the eye height against the terrain the body is standing on, then
    // build the same pose shoot.mjs and province-shots.mjs build by hand.
    const at = spec.place ? spec.place : null;
    let gy = 0;
    if (at) { const t = await hx(h, 'getTerrainAt', at.x, at.z); gy = t && t.y !== undefined ? t.y : 0; }
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
      const s = window.__HARNESS.snapshot ? window.__HARNESS.snapshot({ minimal: true }) : null;
      const q = s && s.player && s.player.pos;
      return q ? [q[0], q[1], q[2]] : null;
    });
    if (p) { camX = p[0]; camZ = p[2]; }
  }

  // Stream around the CAMERA, not around the player. A pose is allowed to sit a long way from the
  // body, and `teleport()` only streams around the body — which is exactly how a capture ends up
  // being a photograph of nothing. This is the remedy; G1 below is the check that it worked.
  // `__no_camera_stream` is a FALSIFICATION HOOK, and it is here on purpose. It removes the
  // remedy above — nothing else. It does not touch G1/G2/G3, so a request that sets it must be
  // REFUSED by the settle gate; that is how an independent critic confirms the gate is real
  // rather than decorative. See tools/capture/falsify.mjs. TOOL-LOOP rule 3.2: a probe that
  // cannot fail is worse than no probe.
  const inProvince = camX !== null && !raw.__no_camera_stream;
  if (inProvince) { try { await hx(h, 'streamAround', camX, camZ); } catch { /* not in the province */ } }

  if (spec.settle_frames > 0) await hx(h, 'stepFrames', spec.settle_frames);
  await hx(h, 'renderFrame');

  // ---- the settle proof: A(t), B(t+gap), C(t+2gap) ----
  const gap = spec.settle_gap;
  await snap(h.page, 'A');
  let resid = { queued: 0, built: 0, tiles_queued: 0, tiles_resident: null, not_in_province: true };
  if (camX !== null) {
    try { resid = await residency({ h: (m, ...a) => hx(h, m, ...a), hOpt: (m, ...a) => hxOpt(h, m, ...a) }, camX, camZ); }
    catch (e) { resid = { queued: 0, built: 0, tiles_queued: 0, tiles_resident: null, not_in_province: true, note: String(e.message) }; }
  }
  await hx(h, 'stepFrames', gap);
  await hx(h, 'renderFrame');
  await snap(h.page, 'B');
  // B is the DELIVERED frame, and it is written to disk before C is taken. What the settle proof
  // judges is therefore the picture that ships, not a neighbour of it.
  await h.page.screenshot({ path: outPng, type: 'png', animations: 'disabled', caret: 'hide', timeout: JOB_TIMEOUT_MS });
  await hx(h, 'stepFrames', gap);
  await hx(h, 'renderFrame');
  await snap(h.page, 'C');

  const d1 = await diffSlots(h.page, 'A', 'B');
  const d2 = await diffSlots(h.page, 'B', 'C');
  const proof = judge({ resid, d1, d2, threshold: spec.settle_threshold, gap, frames: spec.settle_frames });

  return { proof, resid, camera_at: camX === null ? null : [camX, camZ], page_errors: handle.errors.length };
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
  const h = await ensureBrowser(job.raw.width || 1280, job.raw.height || 720);
  if (loadedSeed !== (job.raw.seed ?? 1337)) { await hx(h, 'setSeed', job.raw.seed ?? 1337); loadedSeed = job.raw.seed ?? 1337; }
  if (loadedState !== (job.raw.state ?? 'default')) { await hx(h, 'loadState', job.raw.state ?? 'default'); loadedState = job.raw.state ?? 'default'; }
  const out = await h.page.evaluate((cs) => cs.map((c) => {
    try { return { ok: true, value: window.__HARNESS[c[0]](...c.slice(1)) }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }), calls);
  return { ok: true, result: { results: out, build_key: BUILD.build_key } };
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
    try {
      const man = JSON.parse(fs.readFileSync(paths.json, 'utf8'));
      if (man.build && man.build.build_key === BUILD.build_key && man.settle && man.settle.settled) {
        stats.cache_hits++;
        return { ok: true, result: { ...man, cached: true, cache_key: key, path: paths.png, manifest: paths.json, served_in_ms: Date.now() - t0 } };
      }
    } catch { /* corrupt manifest: re-render */ }
  }
  stats.cache_misses++;

  // 3. Render.
  const tmp = paths.png + '.' + process.pid + '.tmp';
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
    stats.errors++;
    await dropBrowser('capture threw: ' + e.message);   // never let one bad job wedge the queue
    return { ok: false, code: 'CAPTURE_ERROR', error: String(e && e.message || e), detail: { spec: canon } };
  }

  fs.renameSync(tmp, paths.png);
  const bytes = fs.statSync(paths.png).size;
  const manifest = {
    schema: 'elder-souls/capture@1',
    protocol: PROTOCOL,
    cache_key: key,
    path: paths.png,
    bytes,
    sha256: sha256(fs.readFileSync(paths.png)),
    captured_at: new Date().toISOString(),
    spec: canon,
    // ---- PROVENANCE. S34 requires all four of these on every capture. ----
    provenance: {
      arrival: 'placed',
      evidence_of: 'appearance',
      placement: 'teleport + camera pose; the player did not walk here',
      build_key: BUILD.build_key,
      git_sha: BUILD.git_sha,
      git_dirty: BUILD.git_dirty,
      game_content_sha256: BUILD.game_content_sha256,
      served_from_cache: false,
      ruling: 'ARBITRATION.md S34(a) — admissible as evidence of APPEARANCE only. A verdict citing ' +
        'this capture for an ARRIVAL claim (reachability, traversal, the crossing, RI-JRN*, or ' +
        'anything timing something) is VOID.',
      camera_at: out.camera_at,
    },
    build: BUILD,
    settle: out.proof,
    page_errors: out.page_errors,
    render_ms: Date.now() - t0,
  };
  fs.writeFileSync(paths.json, JSON.stringify(manifest, null, 2));
  stats.captures++;
  stats.capture_ms_total += Date.now() - t0;
  return { ok: true, result: { ...manifest, cached: false, manifest: paths.json, served_in_ms: Date.now() - t0 } };
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
try { fs.unlinkSync(SOCK_PATH); } catch { /* */ }
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
        build: { build_key: BUILD.build_key, git_sha: BUILD.git_sha, git_dirty: BUILD.git_dirty },
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
  try { fs.unlinkSync(SOCK_PATH); } catch { /* */ }
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

server.listen(SOCK_PATH, () => {
  fs.chmodSync(SOCK_PATH, 0o600);
  logLine('listening on', SOCK_PATH, '| idle', IDLE_MS / 1000 + 's', '| browser-idle', BROWSER_IDLE_MS / 1000 + 's');
  logLine('settle threshold', THRESHOLD, 'gap', GAP, '| cache', USE_CACHE ? CACHE_DIR : 'DISABLED');
});
