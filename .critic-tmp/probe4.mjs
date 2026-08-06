// CRITIC-OWNED probe 4: the decisive per-step allocation measurement.
// RI-PLT01 M4 asks for (a) heap delta per step over steady-state steps and (b) the identity
// of the top 5 allocation sites from a CDP sampling heap profile. A-JRN9 is absent from
// window.__HARNESS, so both are taken runner-side over CDP.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await cdp.send('Runtime.enable');
const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); };
const heap = async () => (await cdp.send('Runtime.getHeapUsage')).usedSize;

const report = { schema: 'critic/w1-00-alloc@1', at: new Date().toISOString() };
await page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0); });

const SCEN = {
  F1_fen: { state: 'swamp_canopy', enemies: 0 },
  F5_dungeon: { state: 'dungeon_primary', enemies: 0 },
  F3_boss: { state: 'arena_flat', enemies: 1 },
  F4_six: { state: 'arena_flat', enemies: 6 },
};

report.runs = {};
for (const [id, sc] of Object.entries(SCEN)) {
  const reps = [];
  for (let rep = 0; rep < 3; rep++) {
    await page.evaluate(({ state, enemies }) => {
      const H = window.__HARNESS;
      H.setSeed(4711); H.loadState(state); H.clearInputs(); H.setRenderRate(0);
      for (let i = 0; i < enemies; i++) { const e = H.spawn('inf_trash', (i - 3) * 2, 6 + i, { as: 'z' + i }); try { H.aggro(e); } catch {} }
      H.queueInputs([{ f: 0, move: [0, 1] }]);
      H.stepFrames(1200); // out of first-touch
    }, sc);
    await gc(); await gc(); await gc();
    const h0 = await heap();
    const N = 20000;
    await page.evaluate((n) => window.__HARNESS.stepFrames(n), N);
    const h1 = await heap();
    reps.push({ rep, N, before: h0, after: h1, delta: h1 - h0, bytes_per_step: (h1 - h0) / N });
  }
  report.runs[id] = { state: sc.state, enemies: sc.enemies, reps,
    median_bytes_per_step: reps.map(r => r.bytes_per_step).sort((a, b) => a - b)[1] };
}

// ---- sampling heap profile of the sim loop only ----
await page.evaluate(() => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('arena_flat'); H.clearInputs(); H.setRenderRate(0);
  for (let i = 0; i < 6; i++) { const e = H.spawn('inf_trash', (i - 3) * 2, 6 + i, { as: 'p' + i }); try { H.aggro(e); } catch {} }
  H.queueInputs([{ f: 0, move: [0, 1] }]);
  H.stepFrames(1200);
});
await gc();
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 2048 });
await page.evaluate(() => window.__HARNESS.stepFrames(40000));
const prof = await cdp.send('HeapProfiler.stopSampling');

// flatten the sampling profile into per-node self sizes
function flatten(node, path, acc) {
  const cf = node.callFrame || {};
  const name = `${cf.functionName || '(anon)'} @ ${String(cf.url || '').split('/').slice(-1)[0]}:${cf.lineNumber ?? '?'}`;
  const self = (node.selfSize || 0);
  if (self > 0) acc.push({ site: name, selfSize: self, stack: path.concat(name).slice(-6) });
  for (const c of node.children || []) flatten(c, path.concat(name), acc);
  return acc;
}
const sites = flatten(prof.profile.head, [], []).sort((a, b) => b.selfSize - a.selfSize);
const total = sites.reduce((a, s) => a + s.selfSize, 0);
report.sampling_profile = {
  steps_sampled: 40000, sampling_interval_bytes: 2048,
  total_sampled_bytes: total,
  bytes_per_step_from_profile: total / 40000,
  top_sites: sites.slice(0, 12),
};

report.page_errors = handle.errors;
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
