// CRITIC-OWNED probe 2: worldstats truth, aggro truth, camera settle workflow,
// determinism-trap defeat attempts, catch-up bound, allocation.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const report = { schema: 'critic/w1-00-probe2@1', at: new Date().toISOString() };

// ---- A. getWorldStats with an explicit render before the read, per state ----
report.worldstats_rendered = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness');
  const res = {};
  for (const st of ['arena_flat', 'settlement_primary_street', 'dungeon_primary', 'vista_primary', 'swamp_canopy', 'interior_firelit', 'npc_showcase', 'water_shallows', 'material_showcase']) {
    H.loadState(st); H.stepFrames(24); H.renderFrame();
    const w = H.getWorldStats();
    res[st] = { drawCalls: w.drawCalls, triangles: w.triangles, programs: w.programs, materials: w.materials,
                stateChanges: w.stateChanges, skinnedMeshes: w.skinnedMeshes, shadowLights: w.shadowLights,
                textureMB: w.textureMB, geometryMB: w.geometryMB, regions: w.regions, settlements: w.settlements,
                pois: w.pois, interiors: w.interiors, npcs: w.npcs, areaKm2: w.areaKm2 };
  }
  return res;
});

// ---- B. aggro on a real entity ----
report.aggro = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const o = {};
  H.loadState('arena_flat');
  const eid = H.spawn('inf_trash', 0, 6, { as: 'ea' });
  H.stepFrames(1);
  const before = JSON.parse(JSON.stringify(H.snapshot().enemies));
  let aggroRet = null, aggroErr = null;
  try { aggroRet = H.aggro(eid); } catch (e) { aggroErr = String(e && e.message || e); }
  H.stepFrames(120);
  const after = JSON.parse(JSON.stringify(H.snapshot().enemies));
  o.eid = eid; o.aggroRet = aggroRet; o.aggroErr = aggroErr;
  o.before = before; o.after = after;
  // Did it move at all over 120 frames after aggro?
  o.moved_m = before[0] && after[0] ? Math.hypot(after[0].pos[0] - before[0].pos[0], after[0].pos[2] - before[0].pos[2]) : null;
  // dummy_passive
  const eid2 = H.spawn('dummy_passive', 3, 6, { as: 'eb' });
  let a2 = null, e2 = null;
  try { a2 = H.aggro(eid2); } catch (e) { e2 = String(e && e.message || e); }
  o.dummy = { eid: eid2, ret: a2, err: e2 };
  return o;
});

// ---- C. camera settle workflow (HARNESS.md §6: pose, 24 steps, render) ----
report.camera_settle = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.loadState('vista_primary'); H.setTimeOfDay(12); H.setWeather('clear'); H.setUIVisible(false);
  H.camera({ pos: [10, 2, 10], look: [0, 1, 0], fov: 55 });
  const immediately = JSON.parse(JSON.stringify(H.snapshot().camera));
  H.stepFrames(24);
  const after24 = JSON.parse(JSON.stringify(H.snapshot().camera));
  H.renderFrame();
  const after_render = JSON.parse(JSON.stringify(H.snapshot().camera));
  return { immediately, after24, after_render };
});
const camShotA = await page.screenshot();
const camShotA2 = await page.evaluate(() => {
  const H = window.__HARNESS;
  H.camera({ pos: [-30, 12, 40], look: [0, 0, 0], fov: 70 }); H.stepFrames(24); H.renderFrame();
  H.camera({ pos: [10, 2, 10], look: [0, 1, 0], fov: 55 }); H.stepFrames(24); H.renderFrame();
  return JSON.parse(JSON.stringify(H.snapshot().camera));
});
const camShotB = await page.screenshot();
report.camera_settle.repeat_pose = camShotA2;
report.camera_settle.sha_first = sha(camShotA);
report.camera_settle.sha_repeat = sha(camShotB);
report.camera_settle.identical = sha(camShotA) === sha(camShotB);

// ---- D. determinism trap: can I defeat it? ----
report.trap = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  const t = (k, fn) => { try { o[k] = { threw: false, v: JSON.parse(JSON.stringify(fn() ?? null)) }; } catch (e) { o[k] = { threw: true, msg: String(e && e.message || e) }; } };
  H.loadState('arena_flat');
  // baseline: are the globals actually replaced?
  o.globals_outside_step = {
    math_random_is_native: /\[native code\]/.test(String(Math.random)),
    date_now_is_native: /\[native code\]/.test(String(Date.now)),
    perf_now_is_native: /\[native code\]/.test(String(performance.now)),
  };
  t('math_random_outside_step', () => Math.random());
  t('date_now_outside_step', () => Date.now());
  // Inside a step: install a hook that fires from within the sim by patching an object the
  // sim iterates? Not available. Instead call from a queued microtask that lands inside the step.
  // Direct: call from inside a synchronous callback the harness invokes -- use a getter on the
  // input script object, which the sim reads while stepping.
  const evil = [];
  const ev = { f: 0 };
  Object.defineProperty(ev, 'press', { enumerable: true, get() { try { evil.push(['Math.random', Math.random()]); } catch (e) { evil.push(['Math.random-threw', String(e.message || e)]); } try { evil.push(['Date.now', Date.now()]); } catch (e) { evil.push(['Date.now-threw', String(e.message || e)]); } return ['light']; } });
  try { H.queueInputs([ev]); } catch (e) { evil.push(['queueInputs-threw', String(e.message || e)]); }
  H.stepFrames(2);
  o.getter_injection = evil;
  // Try Three.js / Web API sources of nondeterminism reachable from the sim: none callable
  // directly, but check whether the trap is scoped to the step or global.
  return o;
});

// ---- E. catch-up bound / stallMainThread (RI-PLT01 M8) ----
report.catchup = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  o.has_stallMainThread = typeof H.stallMainThread === 'function';
  o.has_setRenderRate = typeof H.setRenderRate === 'function';
  o.has_getPerfStats = typeof H.getPerfStats === 'function';
  o.has_getLoadState = typeof H.getLoadState === 'function';
  o.has_forceGC = typeof H.forceGC === 'function';
  o.has_getHeapUsage = typeof H.getHeapUsage === 'function';
  o.all_methods = Object.keys(H).sort();
  return o;
});

report.page_errors = handle.errors;
report.console_errors = handle.console.filter(c => c.type === 'error').slice(0, 20);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
