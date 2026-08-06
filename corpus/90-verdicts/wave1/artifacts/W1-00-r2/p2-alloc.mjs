#!/usr/bin/env node
// CRITIC-OWNED allocation probe. CDP HeapProfiler sampling with the minor/major-GC
// inclusion flags explicitly ON, plus its own known-quantity self-test.
// usage: node p2-alloc.mjs <repoRoot> <out.json> [--steps N] [--trace]
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const STEPS = Number((process.argv.find(a => a.startsWith('--steps=')) || '--steps=60000').split('=')[1]);
const TRACE = process.argv.includes('--trace');

const { launchGame } = await import(path.join(repoRoot, 'tools/lib/browser.mjs'));
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');

function totals(profile) {
  let total = 0;
  const byUrl = {}, bySite = {};
  const walk = (node) => {
    const cf = node.callFrame || {};
    const url = (cf.url || '(anonymous)').split('/').slice(-2).join('/');
    const site = `${cf.functionName || '(anon)'} @ ${url}:${cf.lineNumber}`;
    if (node.selfSize) {
      total += node.selfSize;
      byUrl[url] = (byUrl[url] || 0) + node.selfSize;
      bySite[site] = (bySite[site] || 0) + node.selfSize;
    }
    (node.children || []).forEach(walk);
  };
  walk(profile.head);
  return { total, byUrl, bySite };
}

async function sample(fn, { flags = true } = {}) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', flags
    ? { samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }
    : { samplingInterval: 64 });
  await fn();
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  return totals(profile);
}

// --- self-test: 100,000 escaping {a,b,c} literals ---------------------------
const selfTestFn = () => page.evaluate(() => {
  window.__sink = [];
  for (let i = 0; i < 100000; i++) window.__sink.push({ a: i, b: i + 1, c: i + 2 });
  return window.__sink.length;
});
const stOn = await sample(selfTestFn, { flags: true });
await page.evaluate(() => { window.__sink = null; });
const stOff = await sample(selfTestFn, { flags: false });
await page.evaluate(() => { window.__sink = null; });

// --- the measurement -------------------------------------------------------
const FIXTURES = [
  { id: 'F1 fen', state: 'swamp_canopy', spawn: 0 },
  { id: 'F5 dungeon', state: 'dungeon_primary', spawn: 0 },
  { id: 'F4 six enemies', state: 'arena_flat', spawn: 6 },
];
const rows = [];
for (const fx of FIXTURES) {
  await page.evaluate(({ state, spawn, trace }) => {
    const H = window.__HARNESS;
    H.setSeed(1337);
    H.loadState(state);
    for (let i = 0; i < spawn; i++) { const e = H.spawn('inf_trash', 2 + i, 4); H.aggro(e); }
    H.stepFrames(600); // warm-up / tier-up
    H.stepFrames(600);
    if (trace) H.traceStart();
  }, { state: fx.state, spawn: fx.spawn, trace: TRACE });

  const run = (n) => () => page.evaluate((n) => {
    const H = window.__HARNESS;
    const CH = 2000;
    for (let i = 0; i < n; i += CH) { H.stepFrames(Math.min(CH, n - i)); if (H.traceDrain) H.traceDrain(); }
    return H.getFrame();
  }, n);

  const at1 = [], at2 = [];
  for (let k = 0; k < 3; k++) at1.push(await sample(run(STEPS)));
  for (let k = 0; k < 3; k++) at2.push(await sample(run(2 * STEPS)));
  const min1 = Math.min(...at1.map(r => r.total));
  const min2 = Math.min(...at2.map(r => r.total));
  const slope = (min2 - min1) / STEPS;
  // module attribution from the largest 2N sample
  const best = at2.reduce((a, b) => (a.total >= b.total ? a : b));
  const gameSites = Object.entries(best.bySite).filter(([s]) => /game\/src|\/sim\/|\/core\//.test(s))
    .sort((a, b) => b[1] - a[1]).slice(0, 12);
  rows.push({
    fixture: fx.id, state: fx.state, spawned: fx.spawn, trace: TRACE,
    steps_N: STEPS, bytes_at_N: min1, bytes_at_2N: min2,
    b_per_step_slope: +slope.toFixed(4),
    b_per_step_naive_at_N: +(min1 / STEPS).toFixed(4),
    samples_at_N: at1.map(r => r.total), samples_at_2N: at2.map(r => r.total),
    top_urls_at_2N: Object.fromEntries(Object.entries(best.byUrl).sort((a, b) => b[1] - a[1]).slice(0, 10)),
    top_game_sites_at_2N: Object.fromEntries(gameSites),
  });
  if (TRACE) await page.evaluate(() => window.__HARNESS.traceStop());
}

const out = {
  produced_by: 'critic-owned p2-alloc.mjs (CDP HeapProfiler, includeObjectsCollectedByMinor/MajorGC: true)',
  repo: repoRoot,
  trace_mode: TRACE,
  self_test: {
    with_flags_bytes: stOn.total, with_flags_b_per_literal: +(stOn.total / 100000).toFixed(3),
    defaults_bytes: stOff.total, defaults_b_per_literal: +(stOff.total / 100000).toFixed(3),
    under_report_factor: +(stOn.total / Math.max(1, stOff.total)).toFixed(1),
  },
  fixtures: rows,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ self_test: out.self_test, fixtures: rows.map(r => ({ f: r.fixture, N: r.bytes_at_N, N2: r.bytes_at_2N, bps: r.b_per_step_slope, naive: r.b_per_step_naive_at_N })) }, null, 2));
await h.close();
