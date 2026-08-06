// CRITIC-OWNED probe 3: allocation measured with CDP forced GC (A-JRN9 is absent, so the
// item's own procedure is unrunnable; this is the closest executable variant and is recorded
// as a method deviation). Plus RI-PLT01 M6/M7/M8 (decoupling, frame-rate independence,
// catch-up bound) and M3 sim CPU time.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await cdp.send('Runtime.enable');

const report = { schema: 'critic/w1-00-probe3@1', at: new Date().toISOString(), method: 'CDP HeapProfiler.collectGarbage + Runtime.getHeapUsage; A-JRN9 absent from window.__HARNESS' };

const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); };
const heap = async () => (await cdp.send('Runtime.getHeapUsage')).usedSize;

await page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); H.setMode('harness'); });

// ---------- A. per-step allocation, per scenario, differential ----------
// Method: force GC, read heap, run N steps with NO tracing, force nothing, read heap.
// Repeat at several N so the per-step slope is a regression, not a single difference.
const scenarios = [
  { id: 'F1_fen', state: 'swamp_canopy', setup: null },
  { id: 'F5_dungeon', state: 'dungeon_primary', setup: null },
  { id: 'F3_boss', state: 'arena_flat', setup: 'one' },
  { id: 'F4_six', state: 'arena_flat', setup: 'six' },
  { id: 'F2_settlement', state: 'settlement_primary_street', setup: null },
];

report.alloc = {};
for (const sc of scenarios) {
  await page.evaluate(({ state, setup }) => {
    const H = window.__HARNESS;
    H.loadState(state); H.clearInputs(); H.setRenderRate(0);
    if (setup === 'one') { H.spawn('inf_trash', 0, 6, { as: 'x0' }); try { H.aggro('x0'); } catch {} }
    if (setup === 'six') { for (let i = 0; i < 6; i++) { const e = H.spawn('inf_trash', (i - 3) * 2, 6 + i, { as: 'x' + i }); try { H.aggro(e); } catch {} } }
    // steady state: walk forward and swing continuously
    H.queueInputs([{ f: 0, move: [0, 1] }]);
    H.stepFrames(600); // warm up out of first-touch allocations
  }, sc);

  const points = [];
  for (const N of [0, 500, 1000, 2000, 4000]) {
    await gc(); await gc();
    const h0 = await heap();
    if (N > 0) await page.evaluate((n) => window.__HARNESS.stepFrames(n), N);
    const h1raw = await heap();
    await gc(); await gc();
    const h1 = await heap();
    points.push({ N, before: h0, after_raw: h1raw, after_gc: h1, delta_raw: h1raw - h0, delta_retained: h1 - h0 });
  }
  // slope of delta_raw vs N -> bytes allocated per step that survive until the next read
  const xs = points.map(p => p.N), ys = points.map(p => p.delta_raw);
  const n = xs.length, sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  report.alloc[sc.id] = { state: sc.state, points, bytes_per_step_slope: slope };
}

// ---------- B. long-run monotonic heap growth (leak / retained allocation) ----------
await page.evaluate(() => { const H = window.__HARNESS; H.loadState('arena_flat'); H.setRenderRate(0); H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }]); H.stepFrames(600); });
const growth = [];
for (let i = 0; i < 10; i++) {
  await gc(); await gc();
  const h = await heap();
  growth.push({ block: i, steps_done: i * 3000, heap_after_gc: h });
  await page.evaluate(() => window.__HARNESS.stepFrames(3000));
}
await gc(); await gc();
growth.push({ block: 10, steps_done: 30000, heap_after_gc: await heap() });
report.retained_growth = { series: growth, bytes_per_step_retained: (growth[growth.length - 1].heap_after_gc - growth[1].heap_after_gc) / 27000 };

// ---------- C. M6 decoupling: sim step count and hash at render rates 60/30/15/0 ----------
report.decoupling = await page.evaluate(async () => {
  const H = window.__HARNESS; const res = [];
  for (const hz of [60, 30, 15, 0]) {
    H.setSeed(4711); H.loadState('arena_flat'); H.clearInputs();
    H.setRenderRate(hz);
    const e = H.spawn('inf_trash', 0, 6, { as: 'y0' }); try { H.aggro(e); } catch {}
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 60, tap: 'light' }]);
    const f0 = H.getFrame();
    H.traceStart({});
    H.stepFrames(3600);
    const recs = H.traceStop();
    const f1 = H.getFrame();
    // hash the records in-page
    const s = JSON.stringify(recs);
    let hsh = 0; for (let i = 0; i < s.length; i++) { hsh = (Math.imul(31, hsh) + s.charCodeAt(i)) | 0; }
    res.push({ render_hz: hz, steps: f1 - f0, records: recs.length, js_hash: hsh >>> 0, len: s.length, render_rate_readback: H.getRenderRate() });
  }
  return res;
});

// ---------- D. M7 frame-rate independence of gameplay ----------
report.rate_independence = await page.evaluate(async () => {
  const H = window.__HARNESS; const res = [];
  for (const hz of [60, 30, 15, 0]) {
    H.setSeed(4711); H.loadState('arena_flat'); H.clearInputs(); H.setRenderRate(hz);
    H.teleport(0, 0);
    H.queueInputs([{ f: 0, move: [0, 1], look: [2, 0] }, { f: 10, hold: ['sprint'], until: 600 }]);
    H.stepFrames(600);
    const s = H.snapshot();
    res.push({ render_hz: hz, pos: s.player.pos, stamina: s.player.stamina, cam_yaw: s.camera.yaw_deg, frame: s.f });
  }
  return res;
});

// ---------- E. M8 catch-up bound after a 400 ms main-thread stall ----------
report.catchup = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const o = {};
  H.loadState('arena_flat'); H.setMode('play'); H.setRenderRate(60);
  await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => setTimeout(r, 200));
  const before = H.getFrame();
  const t0 = performance.now();
  H.stallMainThread(400);
  const stall_ms = performance.now() - t0;
  // let exactly one rAF pass
  const perRaf = [];
  let last = H.getFrame();
  for (let i = 0; i < 6; i++) {
    await new Promise(r => requestAnimationFrame(() => r()));
    const now = H.getFrame();
    perRaf.push(now - last); last = now;
  }
  o.before = before; o.stall_ms = stall_ms; o.steps_per_raf_after_stall = perRaf;
  o.max_steps_in_one_raf = Math.max(...perRaf);
  // check every step was 1/60: t_ms/f must stay exact
  const s = H.snapshot();
  o.t_ms = s.t_ms; o.f = s.f; o.t_over_f = s.f ? s.t_ms / s.f : null; o.expect = 1000 / 60;
  o.perf = H.getPerfStats ? JSON.parse(JSON.stringify(H.getPerfStats())) : null;
  H.setMode('harness');
  return o;
});

report.page_errors = handle.errors;
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
