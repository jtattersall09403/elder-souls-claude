#!/usr/bin/env node
// CRITIC-OWNED allocation probe, v2. Fixes the confound in v1: N and 2N are each a SINGLE
// stepFrames() call, so the per-call constant (including the one render stepFrames does at
// the end) cancels in the slope and only per-step allocation survives.
// usage: node p2b-alloc.mjs <repoRoot> <out.json> [--steps=N] [--trace]
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const STEPS = Number((process.argv.find(a => a.startsWith('--steps=')) || '--steps=20000').split('=')[1]);
const TRACE = process.argv.includes('--trace');

const { launchGame } = await import(path.join(repoRoot, 'tools/lib/browser.mjs'));
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');

function totals(profile) {
  let total = 0; const byUrl = {}, bySite = {};
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
async function sample(fn, flags) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', flags
    ? { samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }
    : { samplingInterval: 64 });
  await fn();
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  return totals(profile);
}

// ---- self-tests: one escaping, one dying ---------------------------------
const escaping = () => page.evaluate(() => {
  window.__sink = [];
  for (let i = 0; i < 100000; i++) window.__sink.push({ a: i, b: i + 1, c: i + 2 });
  return window.__sink.length;
});
const dying = () => page.evaluate(() => {
  let s = 0;
  for (let i = 0; i < 100000; i++) { const o = { a: i, b: i + 1, c: i + 2 }; s += o.a + o.b + o.c; }
  window.__s = s; return s;
});
const st = {
  escaping_flags_on: (await sample(escaping, true)).total,
  escaping_defaults: (await sample(escaping, false)).total,
  dying_flags_on: (await (async () => { await page.evaluate(() => { window.__sink = null; }); return sample(dying, true); })()).total,
  dying_defaults: (await sample(dying, false)).total,
};
await page.evaluate(() => { window.__sink = null; });

// ---- the measurement -----------------------------------------------------
const FIXTURES = [
  { id: 'F1 fen', state: 'swamp_canopy', spawn: 0 },
  { id: 'F5 dungeon', state: 'dungeon_primary', spawn: 0 },
  { id: 'F4 six enemies', state: 'arena_flat', spawn: 6 },
];
const rows = [];
for (const fx of FIXTURES) {
  await page.evaluate(({ state, spawn, trace }) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState(state);
    for (let i = 0; i < spawn; i++) { const e = H.spawn('inf_trash', 2 + i, 4); H.aggro(e); }
    H.stepFrames(2000); H.stepFrames(2000);   // tier-up warm-up, discarded
    if (trace) H.traceStart();
  }, { state: fx.state, spawn: fx.spawn, trace: TRACE });

  const oneCall = (n) => () => page.evaluate((n) => {
    const H = window.__HARNESS;
    H.stepFrames(n);                       // ONE call: constant per-call cost cancels
    if (H.traceDrain) H.traceDrain();
    return H.getFrame();
  }, n);

  const at1 = [], at2 = [];
  for (let k = 0; k < 3; k++) at1.push(await sample(oneCall(STEPS), true));
  for (let k = 0; k < 3; k++) at2.push(await sample(oneCall(2 * STEPS), true));
  const min1 = Math.min(...at1.map(r => r.total));
  const min2 = Math.min(...at2.map(r => r.total));
  const best = at2.reduce((a, b) => (a.total >= b.total ? a : b));
  rows.push({
    fixture: fx.id, state: fx.state, spawned: fx.spawn, trace: TRACE, steps_N: STEPS,
    bytes_at_N: min1, bytes_at_2N: min2,
    b_per_step_slope: +((min2 - min1) / STEPS).toFixed(4),
    samples_at_N: at1.map(r => r.total), samples_at_2N: at2.map(r => r.total),
    top_sites_at_2N: Object.fromEntries(Object.entries(best.bySite).sort((a, b) => b[1] - a[1]).slice(0, 15)),
    top_urls_at_2N: Object.fromEntries(Object.entries(best.byUrl).sort((a, b) => b[1] - a[1]).slice(0, 10)),
  });
  if (TRACE) await page.evaluate(() => window.__HARNESS.traceStop());
}

const out = {
  produced_by: 'critic-owned p2b-alloc.mjs — CDP HeapProfiler.startSampling with includeObjectsCollectedByMinorGC/MajorGC: true, single-stepFrames-call slope',
  repo: repoRoot, trace_mode: TRACE, steps_N: STEPS,
  self_test: {
    ...st,
    escaping_b_per_literal_flags_on: +(st.escaping_flags_on / 100000).toFixed(3),
    escaping_b_per_literal_defaults: +(st.escaping_defaults / 100000).toFixed(3),
    dying_b_per_literal_flags_on: +(st.dying_flags_on / 100000).toFixed(3),
    dying_b_per_literal_defaults: +(st.dying_defaults / 100000).toFixed(3),
  },
  fixtures: rows,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ self_test: out.self_test, fixtures: rows.map(r => ({ f: r.fixture, N: r.bytes_at_N, N2: r.bytes_at_2N, bps: r.b_per_step_slope })) }, null, 2));
await h.close();
