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
//   2. SAMPLING PROFILER — `HeapProfiler.startSampling`, which counts ALLOCATION, live or
//      dead, and attributes it to a call frame. It is 30x finer than the item's stated
//      method and it is the number this tool reports as authoritative, with the retained
//      slope printed alongside as the leak check (P5/P6).
//
// *** `includeObjectsCollectedByMinorGC` / `...MajorGC` MUST BE TRUE. ***
// They default to FALSE, and with the defaults the profile contains only allocations that
// SURVIVED — which for a game loop is almost nothing, because per-frame garbage is exactly
// what dies in the nursery. Measured here: 100,000 escaping `{a,b,c}` object literals report
// as 7,572 bytes (0.08 B each) with the defaults and 2,934,752 bytes (29.3 B each, correct)
// with the flags on. A build that allocated 815 B/step read as 5 B/step. An instrument that
// cannot see allocation will always report an allocation-free loop, so this tool SELF-TESTS
// before it measures: it allocates a known quantity, and dies rather than reporting a zero
// it has not earned.
//
// The instrument's own machinery allocates, so a BASELINE is taken: the same number of
// iterations of an empty loop, profiled identically. Without it the floor is the tool.
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
  --repeats <n>     Samples per step-count, minimum taken (default 3)
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
const REPEATS = Number(args.repeats || 3);
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
  repeats: REPEATS,
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

// The simulation path, by FILE. Attribution by "is this frame beneath sim/step.js's
// stepOnce()" is not sound: V8 inlines stepOnce away and the profile then reads
// `stepOnce @ loop.js -> stepEntities @ entities.js` with no step.js frame at all, so a
// stack-walk classifier silently reports zero. Classifying by module is inlining-proof.
//
// `sim/record.js` is deliberately EXCLUDED: RI-PLT01 §C.3 excludes the trace record from P4
// by name. It is counted separately, below, precisely so the exclusion is visible rather
// than assumed.
const SIM_MODULES = [
  '/sim/step.js', '/sim/player.js', '/sim/entities.js', '/sim/camera.js', '/sim/events.js',
  '/sim/state.js', '/input/pipeline.js', '/input/actions.js',
  '/core/loop.js', '/core/guards.js', '/core/rng.js', '/engine.js',
];
const RECORD_MODULE = '/sim/record.js';
// The record builder reaches one function outside record.js: EventBus.snapshotInto(), which
// exists only to copy pooled events into the record. It is record-path, not step-path, and
// classifying it by file would put it in the sim budget it is excluded from.
const RECORD_FUNCTIONS = new Set(['snapshotInto']);

/** Allocation attributed to the simulation's own modules, and to the trace record. */
function simPathSites(profile) {
  const sim = [];
  const record = [];
  const walk = (node, stack) => {
    const cf = node.callFrame || {};
    const url = String(cf.url || '');
    const name = `${cf.functionName || '(anonymous)'} @ ${url.split('/').pop()}:${cf.lineNumber + 1}`;
    const here = [...stack, name];
    if (node.selfSize) {
      if (url.includes(RECORD_MODULE) || RECORD_FUNCTIONS.has(cf.functionName)) record.push({ site: name, bytes: node.selfSize, stack: here.slice(-8) });
      else if (SIM_MODULES.some((m) => url.includes(m))) sim.push({ site: name, bytes: node.selfSize, stack: here.slice(-8) });
    }
    for (const c of node.children || []) walk(c, here);
  };
  walk(profile.head, []);
  return { sim, record };
}

async function sample(fn) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', {
    samplingInterval: INTERVAL,
    // Non-negotiable. See the header: with these false the profile shows only survivors and
    // every per-frame allocation in a game loop is invisible.
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const r = await fn();
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  return { profile, result: r };
}

/**
 * Prove the instrument can see allocation before believing a zero from it.
 * 100,000 escaping `{a,b,c}` literals are ~28-32 bytes each in V8. Anything below 20 B/iter
 * means the profiler is reporting survivors only and every number after it is worthless.
 */
async function selfTest() {
  const { profile } = await sample(() => handle.page.evaluate((n) => {
    const slot = [null];
    let s = 0;
    for (let i = 0; i < n; i++) { const o = { a: i, b: i + 1, c: 'x' }; slot[0] = o; s += o.a; }
    globalThis.__allocSink = s;
    return s;
  }, 100000));
  const per = flatten(profile).total / 100000;
  const ok = per >= 20 && per <= 64;
  log(`instrument self-test: ${per.toFixed(2)} B per escaping {a,b,c} literal (expect ~28-32) — ${ok ? 'OK' : 'BROKEN'}`);
  if (!ok) {
    console.error(
      `alloc-probe: the sampling heap profiler reports ${per.toFixed(2)} B for an allocation that is ` +
      '28-32 B. It is not seeing allocation, so any per-step figure it produced would be a ' +
      'false zero. Check includeObjectsCollectedByMinorGC/MajorGC. Refusing to measure.');
    process.exit(EXIT.INTERNAL);
  }
  return { bytes_per_known_32B_allocation: +per.toFixed(2), pass: ok };
}

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(async () => { await window.__HARNESS.ready(); window.__HARNESS.setRenderRate(0); });

  report.instrument_self_test = await selfTest();

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

    const stepAllForRetained = (n) => handle.page.evaluate((o) => {
      const H = window.__HARNESS;
      if (!o.trace) { H.stepFrames(o.k); return; }
      const chunk = 2000;
      for (let done = 0; done < o.k; done += chunk) { H.stepFrames(Math.min(chunk, o.k - done)); H.traceDrain(); }
    }, { k: n, trace: WANT_TRACE });

    // 1. retained slope (the item's stated procedure)
    await cdp.send('HeapProfiler.collectGarbage');
    const u0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await stepAllForRetained(STEPS);
    const u1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await cdp.send('HeapProfiler.collectGarbage');
    const u2 = (await cdp.send('Runtime.getHeapUsage')).usedSize;

    // 2. sampling profiler (the authoritative number). Sampled TWICE: the first pass is
    //    discarded because TurboFan tiers up under it and code objects are allocation the
    //    steady state does not have. The reported figure is the second, fully warm pass.
    // ONE stepFrames() call for the whole measurement when tracing is off: P4 is bytes per
    // STEP, and a per-call cost (the {frame, t_ms} return object) would otherwise be divided
    // into it. With tracing on the records must be drained or the page runs out of memory,
    // so the run is chunked and the per-call cost is reported rather than hidden.
    const stepAll = (n) => handle.page.evaluate((o) => {
      const H = window.__HARNESS;
      if (!o.trace) { H.stepFrames(o.k); return H.getFrame(); }
      const chunk = 2000;
      for (let done = 0; done < o.k; done += chunk) { H.stepFrames(Math.min(chunk, o.k - done)); H.traceDrain(); }
      return H.getFrame();
    }, { k: n, trace: WANT_TRACE });
    // Warm-up passes, discarded. TurboFan tiers up under the profiler and the code objects
    // it mints are attributed to whatever sim function happened to be running, which shows
    // up as a five-figure "allocation" in a function whose body did not execute at all
    // (measured: 523,864 B attributed to stepEntities in a state with ZERO entities).
    await sample(() => stepAll(STEPS));
    await sample(() => stepAll(STEPS));

    // Then REPEATED measurements, and the MINIMUM of each set. Steady-state allocation is a
    // floor: compilation churn, GC scheduling and CDP traffic can only add to a sample, never
    // subtract, so the minimum is the closest available estimate of the steady state and the
    // spread is reported so a reader can see how noisy the instrument was.
    //
    // Two step counts, because a single one cannot separate per-STEP from per-CALL
    // allocation: stepFrames() returns a {frame, t_ms} object, ~96 B, whether the call runs
    // 1 step or 60,000. The reported figure is the SLOPE, which is what RI-PLT01 §C.3's
    // detection paragraph asks for in so many words and the only figure that can honestly be
    // compared against a budget of ZERO.
    const runSet = async (n) => {
      const totals = [];
      let last = null;
      for (let i = 0; i < REPEATS; i++) {
        const m = await sample(() => stepAll(n));
        const sp = simPathSites(m.profile);
        totals.push({
          sim: sp.sim.reduce((a, b) => a + b.bytes, 0),
          record: sp.record.reduce((a, b) => a + b.bytes, 0),
          sites: sp.sim.sort((a, b) => b.bytes - a.bytes).slice(0, 6),
        });
        last = m;
      }
      const minSim = Math.min(...totals.map((t) => t.sim));
      const minRec = Math.min(...totals.map((t) => t.record));
      return { totals, minSim, minRec, last, best: totals.find((t) => t.sim === minSim) };
    };
    const setA = await runSet(STEPS);
    const setB = await runSet(STEPS * 2);
    const profile = setB.last.profile;
    const f = flatten(profile);
    const sumA = setA.minSim, sumB = setB.minSim;
    const inStep = setB.best.sites;
    const recSites = simPathSites(profile).record.sort((a, b) => b.bytes - a.bytes);
    const inStepBytes = Math.max(0, sumB - sumA);        // the slope numerator
    const recBytes = Math.max(0, setB.minRec - setA.minRec);

    const rec = {
      id: sc.id, label: sc.label, state: sc.state, enemies: sc.enemies, budget_bytes_per_step: sc.budget,
      sampling: {
        total_bytes: f.total,
        bytes_per_step_raw: +(f.total / STEPS).toFixed(4),
        bytes_per_step_net_of_baseline: +Math.max(0, (f.total - report.baseline.total_bytes) / STEPS).toFixed(4),
        samples_estimate: Math.round(f.total / INTERVAL),
        top_sites: f.sites.slice(0, 8),
      },
      simulation_path: {
        method: `min of ${REPEATS} samples at ${STEPS * 2} steps MINUS min of ${REPEATS} at ${STEPS} steps, divided by ${STEPS}. The subtraction cancels the per-stepFrames()-call constant; the minimum removes JIT/GC churn, which can only add.`,
        bytes_at_1x_min: sumA, bytes_at_1x_all: setA.totals.map((t) => t.sim),
        bytes_at_2x_min: sumB, bytes_at_2x_all: setB.totals.map((t) => t.sim),
        bytes: inStepBytes,
        bytes_per_step: +(inStepBytes / STEPS).toFixed(4),
        modules: SIM_MODULES,
        sites: inStep.sort((a, b) => b.bytes - a.bytes).slice(0, 8),
        note: 'Allocation attributed to the simulation\'s OWN modules during stepFrames(). This is the P4 number: everything else in the profile is CDP, the V8 API, the bytecode compiler and Playwright\'s serialiser, none of which the game ships.',
      },
      trace_record: {
        bytes: recBytes,
        bytes_per_step: +(recBytes / STEPS).toFixed(4),
        sites: recSites.sort((a, b) => b.bytes - a.bytes).slice(0, 5),
        note: 'sim/record.js. RI-PLT01 C.3 excludes the trace record from P4 BY NAME and requires it to be built OUTSIDE the sim step. Counted here so the exclusion is visible; with --trace this should be non-zero AND every stack should show it outside stepOnce.',
      },
      retained: {
        before_bytes: u0, after_bytes: u1, after_gc_bytes: u2,
        retained_growth_bytes_per_step: +((u2 - u0) / STEPS).toFixed(4),
        note: 'P5/P6 leak check. A steady-state loop must not retain.',
      },
    };
    rec.pass = rec.simulation_path.bytes <= sc.budget * STEPS;
    report.scenarios.push(rec);
    log(`${sc.id} ${sc.label} (${sc.state}): SIM PATH slope ${sumB} B @ ${STEPS * 2} steps - ${sumA} B @ ${STEPS} steps ` +
        `= ${rec.simulation_path.bytes} B / ${STEPS} = ${rec.simulation_path.bytes_per_step} B/step — budget ${sc.budget} B/step — ${rec.pass ? 'PASS' : 'FAIL'}`);
    log(`        trace record ${rec.trace_record.bytes_per_step} B/step; whole-profile raw ${rec.sampling.bytes_per_step_raw} B/step ` +
        `(instrument baseline ${report.baseline.bytes_per_iteration} B/iteration); retained ${rec.retained.retained_growth_bytes_per_step} B/step`);
    if (!rec.pass) for (const s of rec.simulation_path.sites.slice(0, 5)) log(`        ${s.bytes} B  ${s.site}`);
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
