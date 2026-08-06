#!/usr/bin/env node
// alloc-probe.mjs — `RI-PLT01` M4 / P4: bytes allocated per fixed simulation step.
//
// The item names this tool and the W1-00 critic recorded its absence as a method deviation,
// having to build a critic-owned CDP probe instead. This is that probe, in the repository,
// so the number is reproducible by anyone.
//
// TWO independent instruments, because the first one is the one that lied:
//
//   1. RETAINED SLOPE — `HeapProfiler.collectGarbage` then `Runtime.getHeapUsage`, bracketing
//      N steady-state steps. This is the item's stated procedure. It is also the instrument
//      that reported "0 B/step" on a build that allocated: `performance.memory` quantises to
//      ~30 B/step and a forced-GC delta only sees what SURVIVES collection, so a loop that
//      allocates a megabyte of immediately-dead garbage per second reads as zero.
//
//   2. SAMPLING PROFILER — `HeapProfiler.startSampling({samplingInterval})`, which counts
//      ALLOCATION, live or dead, and attributes it to a call frame. This is what the W1-00
//      critic used to find 0.78-1.73 B/step and the six named sites behind it. It is 30x
//      finer than the item's stated method and it is the number this tool reports as
//      authoritative, with the retained slope printed alongside as the leak check (P5/P6).
//
// The sampling profiler's own machinery allocates, so a BASELINE is taken: the same number
// of iterations of an empty loop, profiled identically, is subtracted. Without it the floor
// is the instrument, not the game.
//
// Rendering is DISABLED for every measurement (`setRenderRate(0)`): P4 is the SIMULATION
// budget, and Three.js's draw path is not the simulation.
//
// USAGE
//   node tools/platform/alloc-probe.mjs [--steps 60000] [--interval 64] [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const USAGE = `
alloc-probe.mjs — RI-PLT01 P4: bytes allocated per fixed step, per scenario.

USAGE
  node tools/platform/alloc-probe.mjs [options]

OPTIONS
  --steps <n>       Steps per scenario (default 60000)
  --interval <n>    Sampling heap profiler interval in BYTES (default 64; the smaller the
                    finer, and the more the instrument itself costs)
  --trace           Also measure with traceStart() active. RI-PLT01 C.3 excludes the trace
                    record from P4 BY NAME, but also requires it to be built outside the sim
                    step — so this run reports the record's cost and, more importantly,
                    whether any of it is attributed to a frame beneath stepFrames.
  --out <dir>       Output directory (default reports/platform/ALLOC)
  --json            Print the report
  --help            This message

SCENARIOS (RI-PLT01 §B fixtures, closest executable variants)
  F1 fen exterior       swamp_canopy, walking
  F5 dungeon interior   dungeon_primary, walking
  F4 six enemies        arena_flat + 6 spawned and aggroed, walking
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const STEPS = Number(args.steps || 60000);
const INTERVAL = Number(args.interval || 64);
const WANT_TRACE = !!args.trace;
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, '..', 'platform', 'ALLOC');
ensureDir(outDir);

const SCENARIOS = [
  { id: 'F1', label: 'fen exterior', state: 'swamp_canopy', enemies: 0, budget: 0 },
  { id: 'F5', label: 'dungeon interior', state: 'dungeon_primary', enemies: 0, budget: 0 },
  { id: 'F4', label: 'six enemies', state: 'arena_flat', enemies: 6, budget: 2048 },
];

const handle = await launchGame({ ...args, chromiumArgs: [...DETERMINISTIC_CHROMIUM_ARGS, '--js-flags=--expose-gc'] });
const cdp = await handle.page.context().newCDPSession(handle.page);
await cdp.send('HeapProfiler.enable');
await cdp.send('Runtime.enable');

const report = {
  schema: 'elder-souls/alloc-probe@1',
  spec: 'RI-PLT01 §C.3 P4 — 0 bytes/step in F1/F5, <= 2 KB/step in F3/F4',
  steps_per_scenario: STEPS,
  sampling_interval_bytes: INTERVAL,
  render: 'disabled (setRenderRate(0))',
  trace_active: WANT_TRACE,
  baseline: null,
  scenarios: [],
};

/** Total bytes in a sampling profile, and the per-frame attribution, flattened. */
function flatten(profile) {
  const sites = new Map();
  let total = 0;
  const walk = (node, stack) => {
    const cf = node.callFrame || {};
    const name = `${cf.functionName || '(anonymous)'} @ ${String(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;
    const here = [...stack, name];
    if (node.selfSize) {
      total += node.selfSize;
      const key = name;
      const prev = sites.get(key) || { site: key, bytes: 0, stack: here.slice(-6) };
      prev.bytes += node.selfSize;
      sites.set(key, prev);
    }
    for (const c of node.children || []) walk(c, here);
  };
  walk(profile.head, []);
  return { total, sites: [...sites.values()].sort((a, b) => b.bytes - a.bytes) };
}

/** Does any sample's stack pass through the fixed step? That is the C.3 question. */
function sitesUnderStep(profile) {
  const out = [];
  const walk = (node, stack, underStep) => {
    const cf = node.callFrame || {};
    const fn = cf.functionName || '';
    const name = `${fn || '(anonymous)'} @ ${String(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;
    // `stepOnce` (sim/step.js) is the fixed step. Everything beneath it is IN the step.
    const inStep = underStep || (fn === 'stepOnce' && String(cf.url || '').includes('/sim/step.js'));
    if (inStep && node.selfSize) out.push({ site: name, bytes: node.selfSize, stack: [...stack, name].slice(-8) });
    for (const c of node.children || []) walk(c, [...stack, name], inStep);
  };
  walk(profile.head, [], false);
  return out;
}

async function sample(fn) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: INTERVAL });
  const r = await fn();
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  return { profile, result: r };
}

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(async () => { await window.__HARNESS.ready(); window.__HARNESS.setRenderRate(0); });

  // ---- baseline: the instrument's own cost over the same iteration count ----------------
  {
    const { profile } = await sample(() => handle.page.evaluate((n) => {
      let acc = 0;
      for (let i = 0; i < n; i++) acc += i & 7;
      return acc;
    }, STEPS));
    const f = flatten(profile);
    report.baseline = { total_bytes: f.total, bytes_per_iteration: +(f.total / STEPS).toFixed(4), top: f.sites.slice(0, 3) };
    log(`baseline (empty loop, ${STEPS} iterations): ${f.total} B total = ${report.baseline.bytes_per_iteration} B/iteration`);
  }

  for (const sc of SCENARIOS) {
    await handle.page.evaluate(async (o) => {
      const H = window.__HARNESS;
      H.setRenderRate(0);
      H.setSeed(1337);
      H.loadState(o.state);
      for (let i = 0; i < o.enemies; i++) {
        const eid = H.spawn('inf_trash', (i - 2.5) * 2, 6, { as: `a${i}` });
        H.aggro(eid);
      }
      H.queueInputs([{ f: 0, move: [0, 1] }]);
      H.stepFrames(600);                       // reach steady state before measuring
      if (o.trace) H.traceStart({ enemies: true, hitboxes: true, events: true });
    }, { state: sc.state, enemies: sc.enemies, trace: WANT_TRACE });

    // 1. retained slope (the item's stated procedure)
    await cdp.send('HeapProfiler.collectGarbage');
    const u0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await handle.page.evaluate((n) => {
      const H = window.__HARNESS;
      const chunk = 2000;
      for (let done = 0; done < n; done += chunk) { H.stepFrames(Math.min(chunk, n - done)); if (H.traceDrain) H.traceDrain(); }
    }, STEPS);
    const u1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await cdp.send('HeapProfiler.collectGarbage');
    const u2 = (await cdp.send('Runtime.getHeapUsage')).usedSize;

    // 2. sampling profiler (the authoritative number)
    const { profile } = await sample(() => handle.page.evaluate((n) => {
      const H = window.__HARNESS;
      const chunk = 2000;
      for (let done = 0; done < n; done += chunk) { H.stepFrames(Math.min(chunk, n - done)); if (H.traceDrain) H.traceDrain(); }
      return H.getFrame();
    }, STEPS));
    const f = flatten(profile);
    const inStep = sitesUnderStep(profile);
    const inStepBytes = inStep.reduce((a, b) => a + b.bytes, 0);

    const rec = {
      id: sc.id, label: sc.label, state: sc.state, enemies: sc.enemies, budget_bytes_per_step: sc.budget,
      sampling: {
        total_bytes: f.total,
        bytes_per_step_raw: +(f.total / STEPS).toFixed(4),
        bytes_per_step_net_of_baseline: +Math.max(0, (f.total - report.baseline.total_bytes) / STEPS).toFixed(4),
        samples_estimate: Math.round(f.total / INTERVAL),
        top_sites: f.sites.slice(0, 8),
      },
      inside_the_fixed_step: {
        bytes: inStepBytes,
        bytes_per_step: +(inStepBytes / STEPS).toFixed(4),
        sites: inStep.slice(0, 8),
        note: 'Anything here is allocation attributed to a call frame BENEATH sim/step.js stepOnce(). RI-PLT01 C.3 requires the trace record to be outside it.',
      },
      retained: {
        before_bytes: u0, after_bytes: u1, after_gc_bytes: u2,
        retained_growth_bytes_per_step: +((u2 - u0) / STEPS).toFixed(4),
        note: 'P5/P6 leak check. A steady-state loop must not retain.',
      },
    };
    rec.pass = rec.sampling.bytes_per_step_net_of_baseline <= sc.budget && rec.inside_the_fixed_step.bytes === 0;
    report.scenarios.push(rec);
    log(`${sc.id} ${sc.label} (${sc.state}): ${rec.sampling.bytes_per_step_net_of_baseline} B/step net ` +
        `(raw ${rec.sampling.bytes_per_step_raw}), inside the fixed step ${rec.inside_the_fixed_step.bytes_per_step} B/step, ` +
        `retained ${rec.retained.retained_growth_bytes_per_step} B/step — budget ${sc.budget} B/step — ${rec.pass ? 'PASS' : 'FAIL'}`);
    if (!rec.pass) for (const s of rec.sampling.top_sites.slice(0, 5)) log(`        ${s.bytes} B  ${s.site}`);
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.scenarios.every((s) => s.pass) && report.page_errors.length === 0;
writeJson(path.join(outDir, 'alloc.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'alloc.json') + '\n');
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
