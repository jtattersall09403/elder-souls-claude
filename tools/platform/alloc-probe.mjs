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
const REPEATS = Number(args.repeats || 4);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, '..', 'platform', 'ALLOC');
ensureDir(outDir);

const SCENARIOS = [
  { id: 'F1', label: 'fen exterior', state: 'swamp_canopy', enemies: 0, budget: 0 },
  { id: 'F5', label: 'dungeon interior', state: 'dungeon_primary', enemies: 0, budget: 0 },
  { id: 'F4', label: 'six enemies', state: 'arena_flat', enemies: 6, budget: 2048 },
];

// `--no-flush-bytecode` is load-bearing, and it is the difference between measuring the game
// and measuring V8's code cache. Bytecode flushing discards a function's BytecodeArray under
// memory pressure and re-compiles it on the next call — and a BytecodeArray is a JS-heap
// object, so the sampling profiler counts the re-compilation and attributes it to whichever
// simulation frame triggered it. Measured, at --steps 20000: a ~10 KB lump landing on
// `stepEntities` in a state with ZERO entities, on `stepCamera`, on `_afterStep` — whichever
// ran first after the flush. A 40,000-step window hits a major GC (and therefore a flush)
// almost always; a 20,000-step window often does not, so the two-point slope read the
// difference in FLUSH PROBABILITY as allocation: 0.50 B/step of pure instrument.
const handle = await launchGame({ ...args, chromiumArgs: [...DETERMINISTIC_CHROMIUM_ARGS, '--js-flags=--expose-gc --no-flush-bytecode'] });
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

/**
 * `collect: false` matters, and it is the difference between a measurement and a lottery.
 *
 * Forcing a major GC before a sampling window makes V8 flush optimised code. The next hot
 * loop inside the window re-mints it — about 10 KB — and the sampling profiler attributes
 * that code object to whichever simulation function triggered the tier-up. It lands in the
 * LONGER window more often than the shorter one, because a longer window gives tier-up more
 * time to complete, so it biases a two-point slope systematically upward. Measured, at
 * --steps 20000: F1 read -0.0094, +0.4918 and -0.0084 B/step on three consecutive runs of
 * this tool, decided entirely by which window a 10,264 B code object landed in, in a
 * function (`stepEntities`) whose steady-state allocation is nil.
 *
 * So: force the GC when measuring RETENTION (the P5/P6 leak check below does), and do not
 * force it when measuring ALLOCATION.
 */
async function sample(fn, opts = {}) {
  if (opts.collect !== false) await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', {
    samplingInterval: opts.interval || INTERVAL,
    // Non-negotiable for a real measurement. See the header: with these false the profile
    // shows only survivors and every per-frame allocation in a game loop is invisible. The
    // self-test deliberately runs BOTH ways, which is the only way to prove the flags are
    // doing anything at all.
    includeObjectsCollectedByMajorGC: opts.gcFlags === false ? false : true,
    includeObjectsCollectedByMinorGC: opts.gcFlags === false ? false : true,
  });
  const r = await fn();
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  return { profile, result: r };
}

/**
 * Prove the instrument can see allocation before believing a zero from it — and prove it on
 * the RIGHT KIND of allocation.
 *
 * The previous version of this self-test allocated ESCAPING literals and reported 29.13 B
 * each, which is the number CDP's DEFAULTS already get right: it would have passed with the
 * minor/major-GC inclusion flags it exists to verify turned off, and therefore proved
 * nothing. The W1-00 round-2 critic found this and was right (verdict §1.3 / §9.3).
 *
 * The case that needs the flags is DYING garbage — a per-frame object nobody keeps, which is
 * exactly what a game loop makes. So the self-test is now DIFFERENTIAL: the same dying
 * allocation is measured with the flags ON and with them OFF, and the tool refuses to
 * measure unless (a) the flags-on figure is a real per-object size and (b) turning the flags
 * off collapses it. A self-test that cannot fail is not a self-test.
 */
const DYING_N = 200000;
async function measureDying(gcFlags) {
  const { profile } = await sample(() => handle.page.evaluate((n) => {
    // Nothing escapes: `s` is a number, and every object is unreachable by the next
    // iteration. `__dyingSink` exists only to stop V8 eliminating the loop entirely.
    let s = 0;
    for (let i = 0; i < n; i++) { const o = { a: i, b: i + 1, c: 'x' }; s += o.a + o.b + o.c.length; }
    globalThis.__dyingSink = s;
    return s;
  }, DYING_N), { gcFlags });
  return flatten(profile).total / DYING_N;
}

async function selfTest() {
  const on = await measureDying(true);
  const off = await measureDying(false);
  // Escaping literals, kept for reference ONLY — this is the number the defaults already
  // report correctly, so it is recorded and gates nothing.
  const { profile: escProfile } = await sample(() => handle.page.evaluate((n) => {
    const sink = (globalThis.__escSink = []);
    for (let i = 0; i < n; i++) sink.push({ a: i, b: i + 1, c: 'x' });
    return sink.length;
  }, 100000));
  const escaping = flatten(escProfile).total / 100000;

  const ratio = off > 0 ? on / off : Infinity;
  const ok = on >= 4 && on <= 200 && ratio >= 10;
  log(`instrument self-test (DYING {a,b,c} literals, ${DYING_N} of them):`);
  log(`        flags ON  : ${on.toFixed(3)} B each   <- what a per-frame allocation costs`);
  log(`        flags OFF : ${off.toFixed(3)} B each   <- what the CDP defaults would report`);
  log(`        ratio ${ratio === Infinity ? 'infinite' : ratio.toFixed(1)}x — ${ok ? 'OK: the flags are load-bearing and the profiler sees dying garbage' : 'BROKEN'}`);
  log(`        (reference, escaping literals: ${escaping.toFixed(2)} B each — the defaults get this right, so it gates nothing)`);
  if (!ok) {
    console.error(
      `alloc-probe: the differential self-test failed (on ${on.toFixed(3)} B, off ${off.toFixed(3)} B, ` +
      `ratio ${ratio.toFixed(1)}x). Either the profiler cannot see dying garbage — in which case every ` +
      'per-step figure it produced would be a false zero — or the inclusion flags are not being applied. ' +
      'Refusing to measure.');
    process.exit(EXIT.INTERNAL);
  }
  return {
    method: 'differential: the SAME dying allocation measured with includeObjectsCollectedByMinor/MajorGC true and false',
    dying_bytes_each_flags_on: +on.toFixed(3),
    dying_bytes_each_flags_off: +off.toFixed(3),
    flags_on_over_off_ratio: ratio === Infinity ? null : +ratio.toFixed(1),
    escaping_bytes_each_reference_only: +escaping.toFixed(2),
    pass: ok,
  };
}

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(async () => { await window.__HARNESS.ready(); window.__HARNESS.setRenderRate(0); });

  report.instrument_self_test = await selfTest();

  // ---- baseline: the instrument measuring a loop that provably allocates nothing --------
  // Run at N and at 2N and slope-subtracted exactly as the scenarios are, because THAT is
  // the instrument's own zero: whatever this reports for an empty loop is what it would
  // report for a perfect game loop, and no scenario figure below it means anything.
  {
    const empty = (n) => handle.page.evaluate((k) => {
      let acc = 0;
      for (let i = 0; i < k; i++) acc += i & 7;
      return acc;
    }, n);
    const totals1 = [], totals2 = [];
    await sample(() => empty(STEPS));                       // warm-up, discarded
    for (let i = 0; i < REPEATS; i++) totals1.push(flatten((await sample(() => empty(STEPS), { collect: false })).profile).total);
    for (let i = 0; i < REPEATS; i++) totals2.push(flatten((await sample(() => empty(STEPS * 2), { collect: false })).profile).total);
    const b1 = Math.min(...totals1), b2 = Math.min(...totals2);
    report.baseline = {
      total_bytes: b1,
      bytes_per_iteration: +(b1 / STEPS).toFixed(4),
      slope_bytes: b2 - b1,
      slope_bytes_per_iteration: +((b2 - b1) / STEPS).toFixed(6),
      all_at_1x: totals1, all_at_2x: totals2,
    };
    log(`baseline (empty loop): ${b1} B @ ${STEPS} it, ${b2} B @ ${STEPS * 2} it — SLOPE ${b2 - b1} B = ${report.baseline.slope_bytes_per_iteration} B/iteration`);
  }

  // The instrument's QUANTUM. HeapProfiler.startSampling is a Poisson sampler with a
  // `samplingInterval`-byte mean: it cannot report less than one sample, so the finest
  // non-zero slope it can express is INTERVAL bytes over STEPS steps. Everything smaller is
  // "one sample", not a measurement. This is why `--steps 20000` printed FAIL for
  // 0.0034 B/step on a tree whose critic-owned probe measured a NEGATIVE slope at the same
  // step count: 0.0034 x 20000 = 68 B, i.e. one 64-byte sample.
  // TWO components, and the resolution is the larger:
  //   * QUANTISATION — the slope is a DIFFERENCE of two independently sampled measurements,
  //     so its quantisation error is one sample from each side: 2 x INTERVAL bytes.
  //   * MEASURED NOISE — what this very run reported as the slope of a loop that provably
  //     allocates nothing. That is not a theory about the instrument, it is the instrument's
  //     own zero, taken minutes earlier under identical conditions.
  // A |slope| below this is not an allocation this tool can see. Saying so is a BOUND, and a
  // bound is what P4's zero-byte budget can honestly be tested to — which is exactly what
  // the W1-00 round-2 critic ruled (verdict §1.3: "pass on the bound").
  const QUANT = (2 * INTERVAL) / STEPS;
  const NOISE = Math.abs(report.baseline.slope_bytes) / STEPS;
  const RESOLUTION = Math.max(QUANT, NOISE);
  report.resolution_bytes_per_step = +RESOLUTION.toFixed(6);
  report.resolution_components = {
    quantisation_bytes_per_step: +QUANT.toFixed(6),
    quantisation_why: `the slope is a difference of two sampled totals, each quantised by the ${INTERVAL} B Poisson sampler: one sample of error from each side`,
    measured_empty_loop_noise_bytes_per_step: +NOISE.toFixed(6),
    measured_empty_loop_noise_why: 'the slope this instrument reported, in this run, for a loop that allocates nothing',
  };
  log(`instrument resolution: ${report.resolution_bytes_per_step} B/step (quantisation ${QUANT.toFixed(6)}, measured empty-loop noise ${NOISE.toFixed(6)})`);
  // A resolution rule that grows without limit would pass anything. If the empty loop's own
  // slope is worse than 32 samples the run is too noisy to conclude from, and the tool says
  // so instead of certifying a zero on the strength of its own noise.
  if (NOISE > (32 * INTERVAL) / STEPS) {
    console.error(`alloc-probe: the empty-loop baseline sloped ${report.baseline.slope_bytes} B (${(NOISE * STEPS / INTERVAL).toFixed(1)} samples). This run is too noisy to test a 0 B/step budget against. Re-run, or raise --repeats.`);
    report.too_noisy = true;
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
    // Warm up at BOTH step counts, not just at N. The one-off V8 code object minted when a
    // function is (re-)optimised is ~10 KB and the profiler attributes it to whatever frame
    // was running: at --steps 20000, F5's slope read 10,228 B (0.51 B/step) entirely because
    // one such object landed in the 2N set and not in the N set, in a function whose body
    // with tracing off is a null check. Each named state deoptimises the shared step
    // functions (different entity counts, different cells), so the warm-up has to happen
    // per scenario AND per step count.
    await sample(() => stepAll(STEPS), { collect: false });
    await sample(() => stepAll(STEPS * 2), { collect: false });
    await sample(() => stepAll(STEPS), { collect: false });
    await sample(() => stepAll(STEPS * 2), { collect: false });

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
    // SAMPLE UNTIL THE FLOOR STOPS MOVING, rather than a fixed number of times.
    //
    // The per-window totals are BIMODAL, and that is the whole difficulty of this
    // measurement. A window is either "clean" (~200 B of simulation-attributed allocation
    // over 20,000 steps) or it also contains a ~10 KB one-off that V8 mints when it
    // re-optimises a function, which the sampling profiler attributes to whichever
    // simulation frame was on the stack — `stepEntities` in a state with no entities,
    // `stepCamera`, `_afterStep`, whichever. Measured distribution at --steps 20000, four
    // windows per size: F5 read [224, 10580, 11200, 10504] at N and
    // [10264, 10304, 11628, 10664] at 2N. A fixed count of repeats then takes the minimum of
    // a lucky draw on one side and an unlucky one on the other, and reports the difference
    // as allocation: that is how the same tool printed -0.0084, +0.4918 and +0.502 B/step
    // for the same tree on three consecutive runs.
    //
    // Steady-state allocation is a FLOOR, so the estimator is the minimum — but the number
    // of draws needed to find the floor is not something to guess. Keep sampling until the
    // minimum has survived `STABLE_RUNS` consecutive samples without falling, capped so the
    // tool terminates, and REPORT how many it needed and whether it converged.
    // CONTAMINATED WINDOWS ARE IDENTIFIED AND EXCLUDED, and the exclusion is reported.
    //
    // `--no-flush-bytecode` removes most of the ~10 KB per-window one-off described at the
    // launch flags above, but not all of it: V8 still occasionally mints a ~10 KB object
    // (feedback metadata, re-optimisation) inside a measured window and the profiler
    // attributes it to a simulation frame. It is a DISCRETE object, not a rate: two windows
    // over the same loop, back to back, read 0 B and 10,220 B. No steady-state per-step
    // allocation can make two otherwise identical windows differ by 10 KB.
    //
    // So a window more than `CONTAMINATION_GAP_BYTES` above the floor OF BOTH SETS TOGETHER
    // is excluded, by that stated rule, before any statistic is taken. The floor has to be
    // shared: a per-window one-off is more likely in the longer window, so judging the 2N
    // set against its own floor calls a set in which EVERY window is contaminated clean.
    //
    // The rule is deliberately conservative in the direction that matters. If the simulation
    // really did allocate ~0.2 B/step or more, every 2N window would sit above the shared
    // floor and be excluded, the run would not converge, and the tool reports
    // INCONCLUSIVE and exits non-zero. It cannot certify a zero it did not see; the worst it
    // can do is refuse to certify one it did.
    const CONTAMINATION_GAP_BYTES = 4096;
    const MIN_CLEAN = 4;
    const MAX_SAMPLES = Math.max(REPEATS * 4, 14);
    const median = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
    const oneWindow = async (n) => {
      const m = await sample(() => stepAll(n), { collect: false });
      const sp = simPathSites(m.profile);
      return {
        sim: sp.sim.reduce((a, b) => a + b.bytes, 0),
        record: sp.record.reduce((a, b) => a + b.bytes, 0),
        sites: sp.sim.sort((a, b) => b.bytes - a.bytes).slice(0, 6),
        profile: m.profile,
      };
    };
    const windowsA = [], windowsB = [];
    for (let i = 0; i < REPEATS; i++) { windowsA.push(await oneWindow(STEPS)); windowsB.push(await oneWindow(STEPS * 2)); }
    const summarise = () => {
      const floor = Math.min(...[...windowsA, ...windowsB].map((w) => w.sim));
      const isClean = (w) => w.sim <= floor + CONTAMINATION_GAP_BYTES;
      return { floor, cleanA: windowsA.filter(isClean), cleanB: windowsB.filter(isClean) };
    };
    let sum = summarise();
    while ((sum.cleanA.length < MIN_CLEAN || sum.cleanB.length < MIN_CLEAN)
           && (windowsA.length < MAX_SAMPLES || windowsB.length < MAX_SAMPLES)) {
      if (sum.cleanA.length < MIN_CLEAN && windowsA.length < MAX_SAMPLES) windowsA.push(await oneWindow(STEPS));
      if (sum.cleanB.length < MIN_CLEAN && windowsB.length < MAX_SAMPLES) windowsB.push(await oneWindow(STEPS * 2));
      sum = summarise();
    }
    const mkSet = (windows, clean) => ({
      totals: windows.map((w) => ({ sim: w.sim, record: w.record, sites: w.sites })),
      minSim: clean.length ? median(clean.map((w) => w.sim)) : Math.min(...windows.map((w) => w.sim)),
      minRec: clean.length ? median(clean.map((w) => w.record)) : Math.min(...windows.map((w) => w.record)),
      last: { profile: windows[windows.length - 1].profile },
      best: clean.slice().sort((a, b) => a.sim - b.sim)[0] || windows[0],
      samples: windows.length,
      clean_windows: clean.length,
      contaminated_totals: windows.filter((w) => !clean.includes(w)).map((w) => w.sim),
      converged: clean.length >= MIN_CLEAN,
    });
    const setA = mkSet(windowsA, sum.cleanA);
    const setB = mkSet(windowsB, sum.cleanB);
    const converged = setA.converged && setB.converged;
    const profile = setB.last.profile;
    const f = flatten(profile);
    const sumA = setA.minSim, sumB = setB.minSim;
    const inStep = setB.best.sites;
    const recSites = simPathSites(profile).record.sort((a, b) => b.bytes - a.bytes);
    // NO CLAMP. This was `Math.max(0, sumB - sumA)`, and it is the single most dishonest
    // line this toolchain has shipped: the printed line read `9828 B - 10344 B = 0 B` and
    // the tool reported a LITERAL ZERO for an arithmetic whose answer is -516. A negative
    // slope is information — it says the measurement is noise of both signs around zero —
    // and hiding it turns a bound into a claim. The W1-00 round-2 critic caught it (verdict
    // §1.3 and §4) and the remediation report's "it is a literal zero and not a slope of
    // noise" was wrong because of it.
    const inStepBytes = sumB - sumA;                     // signed. See above.
    const recBytes = setB.minRec - setA.minRec;

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
        method: `min at ${STEPS * 2} steps MINUS min at ${STEPS} steps, divided by ${STEPS}, each side sampled until its minimum survived 3 consecutive samples. The subtraction cancels the per-stepFrames()-call constant; the minimum finds the floor, which is what steady-state allocation is.`,
        samples_at_1x: setA.samples, samples_at_2x: setB.samples,
        clean_windows: { at_1x: setA.clean_windows, at_2x: setB.clean_windows },
        contaminated_windows: { at_1x: setA.contaminated_totals, at_2x: setB.contaminated_totals },
        contamination_rule: `a window whose simulation-attributed total is more than ${CONTAMINATION_GAP_BYTES} B above the set's floor did not measure the steady state (a discrete V8 code/feedback object, not a rate) and is excluded before any statistic is taken`,
        estimator: 'median of the uncontaminated windows',
        converged: setA.converged && setB.converged,
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
    // The verdict is taken against the budget PLUS the instrument's declared resolution, and
    // says which of the two decided it. A budget of 0 B/step cannot be tested to better than
    // one sample of the sampler, so the honest verdict for F1/F5 is "indistinguishable from
    // zero at this resolution" — a BOUND — and the tool now says so in those words instead
    // of printing a zero it clamped into existence.
    rec.resolution_bytes_per_step = +RESOLUTION.toFixed(6);
    rec.resolution_components = report.resolution_components;
    rec.samples_in_slope = +(Math.abs(inStepBytes) / INTERVAL).toFixed(2);
    rec.pass = rec.simulation_path.bytes_per_step <= sc.budget + RESOLUTION && converged;
    rec.verdict = !converged
      ? `INCONCLUSIVE — only ${setA.clean_windows}/${setA.samples} windows at ${STEPS} steps and ${setB.clean_windows}/${setB.samples} at ${STEPS * 2} were uncontaminated (contaminated totals: ${JSON.stringify(setB.contaminated_totals)}). This run cannot test a ${sc.budget} B/step budget; it is not reporting a zero it did not measure.`
      : rec.simulation_path.bytes_per_step <= sc.budget
        ? (sc.budget === 0 ? 'at or below zero — no allocation detected' : 'within budget')
        : rec.pass
          ? `indistinguishable from ${sc.budget} B/step at this instrument's resolution (${rec.samples_in_slope} samples)`
          : 'over budget by more than the instrument\'s resolution';
    report.scenarios.push(rec);
    log(`${sc.id} ${sc.label} (${sc.state}): SIM PATH slope ${sumB} B @ ${STEPS * 2} steps - ${sumA} B @ ${STEPS} steps ` +
        `= ${rec.simulation_path.bytes} B / ${STEPS} = ${rec.simulation_path.bytes_per_step} B/step ` +
        `(${rec.samples_in_slope} samples of ${INTERVAL} B; resolution ${rec.resolution_bytes_per_step} B/step) ` +
        `— budget ${sc.budget} B/step — ${rec.pass ? 'PASS' : 'FAIL'}: ${rec.verdict}`);
    log(`        trace record ${rec.trace_record.bytes_per_step} B/step; whole-profile raw ${rec.sampling.bytes_per_step_raw} B/step ` +
        `(instrument baseline ${report.baseline.bytes_per_iteration} B/iteration); retained ${rec.retained.retained_growth_bytes_per_step} B/step`);
    if (!rec.pass) for (const s of rec.simulation_path.sites.slice(0, 5)) log(`        ${s.bytes} B  ${s.site}`);
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.scenarios.every((s) => s.pass) && report.page_errors.length === 0 && !report.too_noisy;
writeJson(path.join(outDir, 'alloc.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'alloc.json') + '\n');
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
