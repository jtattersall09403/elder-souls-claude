// CRITIC-OWNED probe 5: fine-grained sampling heap profile of the sim loop.
// samplingInterval 64 B so the sample count is statistically meaningful.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await cdp.send('Runtime.enable');
const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); };

function flatten(node, path, acc) {
  const cf = node.callFrame || {};
  const name = `${cf.functionName || '(anon)'} @ ${String(cf.url || '').split('/').slice(-1)[0]}:${cf.lineNumber ?? '?'}:${cf.columnNumber ?? '?'}`;
  if ((node.selfSize || 0) > 0) acc.push({ site: name, selfSize: node.selfSize, stack: path.concat(name).slice(-8) });
  for (const c of node.children || []) flatten(c, path.concat(name), acc);
  return acc;
}

const report = { schema: 'critic/w1-00-alloc-fine@1', at: new Date().toISOString(), samplingInterval: 64 };
await page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0); });

const CASES = {
  F1_fen: { state: 'swamp_canopy', enemies: 0, steps: 60000 },
  F5_dungeon: { state: 'dungeon_primary', enemies: 0, steps: 60000 },
  F4_six: { state: 'arena_flat', enemies: 6, steps: 60000 },
  F4_six_tracing: { state: 'arena_flat', enemies: 6, steps: 20000, trace: true },
};

report.cases = {};
for (const [id, c] of Object.entries(CASES)) {
  await page.evaluate(({ state, enemies, trace }) => {
    const H = window.__HARNESS;
    H.setSeed(4711); H.loadState(state); H.clearInputs(); H.setRenderRate(0);
    for (let i = 0; i < enemies; i++) { const e = H.spawn('inf_trash', (i - 3) * 2, 6 + i, { as: 'q' + i }); try { H.aggro(e); } catch {} }
    H.queueInputs([{ f: 0, move: [0, 1] }]);
    H.stepFrames(1200);
    if (trace) H.traceStart({});
  }, c);
  await gc(); await gc();
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64 });
  await page.evaluate((n) => window.__HARNESS.stepFrames(n), c.steps);
  const prof = await cdp.send('HeapProfiler.stopSampling');
  await page.evaluate(({ trace }) => { if (trace) window.__HARNESS.traceStop(); }, c);
  const sites = flatten(prof.profile.head, [], []).sort((a, b) => b.selfSize - a.selfSize);
  // sites inside the game bundle only (exclude the runner's own evaluate frames)
  const game = sites.filter(s => !/^evaluate @ :/.test(s.site));
  const totalAll = sites.reduce((a, s) => a + s.selfSize, 0);
  const totalGame = game.reduce((a, s) => a + s.selfSize, 0);
  report.cases[id] = {
    state: c.state, enemies: c.enemies, steps: c.steps, tracing: !!c.trace,
    total_sampled_bytes_all: totalAll,
    total_sampled_bytes_game: totalGame,
    bytes_per_step_game: totalGame / c.steps,
    approx_samples: Math.round(totalGame / 64),
    top_sites: game.slice(0, 15),
  };
}

report.page_errors = handle.errors;
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
