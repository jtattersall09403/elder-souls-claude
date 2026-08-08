#!/usr/bin/env node
// timefidelity.mjs — RI-PLT01 M16 (Tier-S). The catch-up counters, finally read.
//
// WHY THIS EXISTS. `game/src/core/loop.js` has computed `stats.catchupClamps` and
// `stats.catchupDroppedMs` on every clamp since the loop was written. `engine.js:7887` exposes
// ONE of them (`catchupClamps`); `catchupDroppedMs` is exposed nowhere. Two critics printed the
// clamp count as an aside. **No item in the corpus stated a number either had to meet**, so for
// months the engine recorded the evidence of its own worst gameplay defect and nothing asked it.
// `RI-PLT01` §C.5 (added at c5292f7) is the threshold. This file is the instrument.
//
// THE DEFECT, STATED AS ARITHMETIC RATHER THAN AS AN ANECDOTE. R3 is a spiral-of-death guard:
// after a stall the sim catches up by at most MAX_CATCHUP = 5 fixed steps per rAF and DROPS the
// surplus. Written for recovery, it is correct. Applied to a steady state it is a permanent tax:
// at any SUSTAINED rAF rate below 12.00 Hz the world advances at
//
//     world_time_fidelity = min(1, MAX_CATCHUP * STEP_MS * raf_hz / 1000)
//
// of real time, for as long as the rate stays there, and reports nothing. At 2.32 rAF Hz that is
// 19.3%: the whole world in slow motion, every combat frame count still perfectly self-consistent,
// every determinism test still green.
//
// WHY NO BROWSER. Every number here is arithmetic over FixedLoop, so it is identical on a phone,
// on a workstation and on SwiftShader — RI-PLT01 §A Tier-S in the strong sense. Driving the
// SHIPPED loop from Node with a synthetic clock and a synthetic requestAnimationFrame also buys
// something no container can: an rAF rate chosen exactly, including rates a real box cannot be
// made to produce on demand. The 11.6 steps/s that started this investigation was a SwiftShader
// measurement on a shared box and under rule T1 may not be reported as a fact about a device
// (see §C.5's warning). The conditional above needs no device and is what this tool proves.
//
// THE NULL CONTROLS, AND THEY ARE RUN, NOT DESCRIBED (RULES 4, 6). A check that has never been
// seen to fail is not evidence. Four mutants of the SHIPPED source are generated on disk, each a
// single-line edit, each imported and run through the identical checker:
//
//   leak         the clamp branch stops zeroing the accumulator  -> P14 identity must go red
//   nocount      catchupDroppedMs stops being incremented        -> P14 identity must go red
//   rafsteps     rafDrivesSim returns true in every mode         -> P15 must go red
//   maxcatchup50 MAX_CATCHUP 5 -> 50                             -> the slow-motion law must go red
//
// Each mutant asserts its edit actually applied (a text replacement that matched nothing is an
// inert control, RULES 6) and the run FAILS if a control comes out green. The mutants are written
// to the scratchpad, never into game/src — a temporary file inside the game tree is a file a
// concurrent bank commits (RULES 17).
//
// EXIT CODES: 0 every arm passed and every control went red; 1 a check failed against the shipped
//             loop; 3 a control did not go red (the instrument is not trustworthy); 2 usage.
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const LOOP_SRC = path.join(REPO, 'game', 'src', 'core', 'loop.js');
const GUARDS_SRC = path.join(REPO, 'game', 'src', 'core', 'guards.js');
const TASK = 'PLT01-STEPRATE';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
if (argv.includes('--help')) {
  console.log(`timefidelity.mjs — RI-PLT01 M16, the catch-up counters as a measured requirement.

USAGE
  node tools/platform/timefidelity.mjs [--ticks 400] [--out <file.json>] [--json]

OPTIONS
  --ticks <n>   synthetic rAF ticks per swept rate (default 400)
  --out <file>  write the artifact here (default reports/platform/${TASK}/timefidelity.json)
  --json        print the artifact to stdout
`);
  process.exit(2);
}
const TICKS = Number(arg('ticks', 400));
const OUT = path.resolve(arg('out', path.join(REPO, 'reports', 'platform', TASK, 'timefidelity.json')));

// ---------------------------------------------------------------------------------------------
// The synthetic world: one clock, one rAF queue. Both are the ONLY time sources FixedLoop has.
// `wallNow()` in guards.js reads `installGuards._realPerfNow`, so setting that property routes
// the shipped loop onto our clock without patching the loop at all.
// ---------------------------------------------------------------------------------------------
const guards = await import(pathToFileURL(GUARDS_SRC).href);
let CLOCK = 0;
guards.installGuards._realPerfNow = () => CLOCK;

let rafQueue = [];
globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};

/** Advance the clock by dtMs and fire exactly one pending rAF callback. */
function tick(dtMs) {
  CLOCK += dtMs;
  const cbs = rafQueue; rafQueue = [];
  for (const cb of cbs) cb();
}

// ---------------------------------------------------------------------------------------------
// The checker. Everything below runs identically against the shipped loop and every mutant.
// ---------------------------------------------------------------------------------------------
const EPS = 1e-9;
const near = (a, b, eps = EPS) => Math.abs(a - b) <= eps;

/**
 * Arm (a) — P14. Per rAF tick, no world time may appear or vanish except through
 * catchupDroppedMs, and a clamp must occur exactly when the arrears reach (MAX_CATCHUP+1) steps.
 *
 * @returns {{violations: object[], ticks: number}}
 */
function armAccounting(mod, rafHz, ticks) {
  const { FixedLoop, STEP_MS, MAX_CATCHUP } = mod;
  const loop = new FixedLoop(() => {}, () => {});
  loop.setRenderRate(0);
  loop.setMode('play');
  CLOCK = 1000; loop.lastWallMs = CLOCK; loop.accumulatorMs = 0;
  loop.start();

  const dt = 1000 / rafHz;
  const violations = [];
  for (let i = 0; i < ticks; i++) {
    const s = loop.stats;
    const accBefore = loop.accumulatorMs;
    const stepsBefore = s.simStepsTotal, droppedBefore = s.catchupDroppedMs, clampsBefore = s.catchupClamps;
    tick(dt);
    const steps = s.simStepsTotal - stepsBefore;
    const dropped = s.catchupDroppedMs - droppedBefore;
    const clamped = s.catchupClamps - clampsBefore;
    const accAfter = loop.accumulatorMs;

    // dt is clamped by the loop at 1000 ms ("tab was backgrounded"); mirror that, do not assume it.
    const dtClamped = Math.min(Math.max(dt, 0), 1000);

    // P14, half one: conservation.
    const lhs = dtClamped;
    const rhs = steps * STEP_MS + dropped + (accAfter - accBefore);
    if (!near(lhs, rhs, 1e-7)) {
      violations.push({ tick: i, kind: 'conservation', dt_ms: dtClamped, steps, dropped_ms: dropped,
        acc_before: accBefore, acc_after: accAfter, lhs, rhs, delta: lhs - rhs });
    }
    // P14, half two: the iff. A clamp happens exactly when the arrears reach MAX_CATCHUP+1 steps.
    //
    // EVALUATED IN THE LOOP'S OWN FLOAT ORDER, and the closed form `arrears >= 6 * STEP_MS` is
    // NOT good enough — that cost this tool a second false FAIL. STEP_MS = 1000/60 is not
    // representable in binary, so at exactly 12.00 Hz the arrears come to 99.9999999999999 ms
    // while `6 * STEP_MS` is 100, and five repeated subtractions leave 16.66666666666...6, a
    // hair under STEP_MS. Whether that tick clamps is decided in the last bits of a double.
    // Asserting the closed form would be asserting real arithmetic against a machine that is
    // not doing real arithmetic; asserting the loop's own order is the honest predicate. It is
    // still an independent statement — the mutants break it — and it is what the spec means.
    let a = accBefore + dtClamped, n = 0;
    while (a >= STEP_MS && n < MAX_CATCHUP) { a -= STEP_MS; n++; }
    const shouldClamp = a >= STEP_MS;
    if (shouldClamp !== (clamped === 1) || n !== steps) {
      violations.push({ tick: i, kind: 'clamp_iff', arrears_ms: accBefore + dtClamped,
        closed_form_threshold_ms: (MAX_CATCHUP + 1) * STEP_MS,
        expected_clamp: shouldClamp, observed_clamps: clamped, expected_steps: n, observed_steps: steps });
    }
    // R3 itself: never more than MAX_CATCHUP steps, never a step of another size.
    if (steps > MAX_CATCHUP) violations.push({ tick: i, kind: 'catchup_bound', steps, bound: MAX_CATCHUP });
    if (violations.length > 12) break;
  }
  loop.stop(); rafQueue = [];
  return { violations, ticks };
}

/**
 * Arm (b) — the slow-motion law. In steady state at a sustained rAF rate the world advances at
 * min(1, MAX_CATCHUP * STEP_MS * raf_hz / 1000) of real time. This is what makes "19.3%" a
 * derivation instead of a SwiftShader anecdote.
 */
function armLaw(mod, rafHz, ticks) {
  const { FixedLoop, STEP_MS, MAX_CATCHUP } = mod;
  const loop = new FixedLoop(() => {}, () => {});
  loop.setRenderRate(0);
  loop.setMode('play');
  CLOCK = 1000; loop.lastWallMs = CLOCK; loop.accumulatorMs = 0;
  loop.start();

  const dt = 1000 / rafHz;
  const t0 = CLOCK;
  let clampRun = 0, maxClampRun = 0, prevClamps = 0;
  for (let i = 0; i < ticks; i++) {
    tick(dt);
    const c = loop.stats.catchupClamps;
    if (c > prevClamps) { clampRun++; if (clampRun > maxClampRun) maxClampRun = clampRun; }
    else clampRun = 0;
    prevClamps = c;
  }
  const wallMs = CLOCK - t0;
  const s = loop.stats;
  const worldMs = s.simStepsTotal * STEP_MS;
  // FIDELITY IS DEFINED ON THE COUNTER, NOT ON THE STEP TOTAL, and the first version of this
  // file got that wrong in a way that produced a false FAIL at 12.00 Hz. `worldMs / wallMs`
  // carries a window-boundary artefact: at the instant the window closes, up to STEP_MS of real
  // time is sitting in the accumulator, neither simulated yet nor thrown away. Over a 33 s
  // window that is 0.05% and it pushed the 12 Hz row under P10's 0.999 line on its own.
  // Real time is in exactly one of three places — simulated, pending in the accumulator, or
  // DROPPED — and only the third is a loss, so:
  const measured = 1 - (s.catchupDroppedMs / wallMs);
  const simTimeRatio = worldMs / wallMs;    // reported too; this is r2-framerate.mjs's `sim_time_ratio`
  const predicted = Math.min(1, MAX_CATCHUP * STEP_MS * rafHz / 1000);
  // TWO DIFFERENT FLOORS, and conflating them cost this tool a false FAIL on its first run.
  //
  //   per-tick   a SINGLE tick clamps iff its arrears reach (MAX_CATCHUP+1) * STEP_MS = 100 ms,
  //              i.e. 10.00 Hz. That is the iff armAccounting() checks.
  //   sustained  a SUSTAINED rate keeps real time only at >= MAX_CATCHUP * STEP_MS per tick,
  //              i.e. 12.00 Hz — because below that each tick leaves a residue in the
  //              accumulator, the residues ADD UP, and the clamp that eventually fires ZEROES
  //              the accumulator and throws the lot away. So the slow-motion regime begins at
  //              12.00 Hz, not at 10.00 Hz. S39's 12.00 Hz is the right number for the right
  //              reason and this tool confirms it.
  //
  // AND 12.00 HZ ITSELF IS NOT SAFE. At exactly 12.00 Hz, dt = 83.3333... ms and 5 steps cost
  // 83.3333... ms; the two differ only in the last bits of a double, and over 400 ticks that
  // residue crosses STEP_MS and clamps once. The floor is a limit, not an inclusive bound: a
  // device sitting exactly on it still loses world time. Reported, not failed.
  const sustainedFloorHz = 1000 / (MAX_CATCHUP * STEP_MS);
  const atOrAboveFloor = rafHz >= sustainedFloorHz - 1e-9;
  const tol = atOrAboveFloor ? 1 - 0.999 : 1e-9;   // P10's session-wide 0.999 above the floor; exact below it
  loop.stop(); rafQueue = [];
  return {
    raf_hz: +rafHz.toFixed(4),
    wall_ms: +wallMs.toFixed(3),
    world_ms: +worldMs.toFixed(3),
    sim_steps: s.simStepsTotal,
    steps_per_raf: +(s.simStepsTotal / ticks).toFixed(4),
    catchup_clamps: s.catchupClamps,
    catchup_dropped_ms: +s.catchupDroppedMs.toFixed(3),
    dropped_ms_per_s: +(s.catchupDroppedMs / (wallMs / 1000)).toFixed(2),
    world_time_fidelity: +measured.toFixed(6),
    sim_time_ratio: +simTimeRatio.toFixed(6),
    predicted_fidelity: +predicted.toFixed(6),
    max_clamp_run: maxClampRun,
    at_or_above_sustained_floor: atOrAboveFloor,
    law_holds: near(measured, predicted, tol),
  };
}

/** Arm (c) — P15 / HF10. rAF must never advance the sim in harness or play-instrumented. */
function armHarnessInvariant(mod, ticks) {
  const { FixedLoop } = mod;
  const out = [];
  for (const mode of ['harness', 'play-instrumented']) {
    const loop = new FixedLoop(() => {}, () => {});
    loop.setRenderRate(0);
    loop.setMode(mode);
    CLOCK = 1000; loop.lastWallMs = CLOCK;
    loop.start();
    for (let i = 0; i < ticks; i++) tick(431);   // the measured starved-rAF interval
    const s = loop.stats;
    out.push({ mode, raf_ticks: s.rafTicks, sim_steps: s.simStepsTotal,
      catchup_clamps: s.catchupClamps, catchup_dropped_ms: s.catchupDroppedMs,
      ok: s.rafTicks === ticks && s.simStepsTotal === 0 && s.catchupClamps === 0 && s.catchupDroppedMs === 0 });
    loop.stop(); rafQueue = [];
  }
  return out;
}

/** The full checker over one module. Returns a verdict object; `pass` is the single bit. */
function runAll(mod, label) {
  const { STEP_MS, MAX_CATCHUP } = mod;
  const floorHz = 1000 / ((MAX_CATCHUP + 1) * STEP_MS);
  // Swept rates: well above the floor, straddling it, and the two that matter — the measured
  // 2.32 Hz and the rate implied by the 11.6 steps/s figure that started this.
  const rates = [60, 30, 20, 15, 12.5, 12.0, 11.5, 8, 4, 2.32, 1.5];
  const acc = [];
  for (const r of rates) acc.push({ raf_hz: r, ...armAccounting(mod, r, Math.min(TICKS, 200)) });
  const law = rates.map((r) => armLaw(mod, r, TICKS));
  const harness = armHarnessInvariant(mod, 10000);

  const accFail = acc.filter((a) => a.violations.length);
  const lawFail = law.filter((l) => !l.law_holds);
  const harnessFail = harness.filter((h) => !h.ok);
  return {
    label,
    MAX_CATCHUP, STEP_MS: +STEP_MS.toFixed(6),
    raf_floor_hz: +floorHz.toFixed(4),
    p14_accounting: { rates_checked: rates.length, failures: accFail },
    law: law,
    p15_harness: harness,
    pass: accFail.length === 0 && lawFail.length === 0 && harnessFail.length === 0,
    failed_arms: [
      ...(accFail.length ? ['P14 accounting'] : []),
      ...(lawFail.length ? [`slow-motion law (${lawFail.map((l) => l.raf_hz + ' Hz').join(', ')})`] : []),
      ...(harnessFail.length ? ['P15 harness invariant'] : []),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Mutants. Each is the SHIPPED source with one text edit, written to the scratchpad (never into
// game/src — RULES 17) with its guards import rewritten to an absolute URL so it shares this
// process's clock. A replacement that matched nothing throws: an edit that did not apply is an
// inert control and is the failure RULES 6 names.
// ---------------------------------------------------------------------------------------------
const SCRATCH = path.join(os.tmpdir(), `es-${TASK}-mutants`);
fs.mkdirSync(SCRATCH, { recursive: true });
const SHIPPED = fs.readFileSync(LOOP_SRC, 'utf8');

const MUTANTS = [
  { name: 'leak', breaks: 'P14 accounting',
    why: 'the clamp branch stops zeroing the accumulator: the surplus is counted as dropped AND kept',
    from: '        this.stats.catchupClamps++;\n        this.accumulatorMs = 0;',
    to:   '        this.stats.catchupClamps++;' },
  { name: 'nocount', breaks: 'P14 accounting',
    why: 'catchupDroppedMs stops being incremented: world time vanishes with no counter recording it',
    from: '        this.stats.catchupDroppedMs += this.accumulatorMs;\n',
    to:   '' },
  { name: 'rafsteps', breaks: 'P15 harness invariant',
    why: 'rAF drives the sim in every mode: no trace this fleet takes is reproducible any more',
    from: "  get rafDrivesSim() { return this.mode === 'play'; }",
    to:   '  get rafDrivesSim() { return true; }' },
  // THE FOURTH CONTROL CAME OUT INERT ON RUN 1 AND IS REPORTED, NOT QUIETLY REPAIRED.
  // Aimed at the slow-motion law, MAX_CATCHUP 5 -> 50 changed nothing: `predicted` is computed
  // FROM the module's own MAX_CATCHUP, so the law self-adjusted and the mutant passed every arm.
  // That is exactly RULES 6's inert control — a teardown that leaves both arms identical — and
  // it is also a true statement about the law: **§C.5's law cannot detect a change to
  // MAX_CATCHUP, because the constant appears on both sides.** R3 and M8 own that constant
  // (max 5 steps per rAF, checked directly), and they catch it; the law does not and does not
  // claim to. So the control keeps the mutation and changes what it is a control FOR: it now
  // tests the HEADLINE — that 19.3% at 2.32 Hz is a consequence of MAX_CATCHUP = 5 and not an
  // artefact of this harness. Raise the cap and the number must move.
  { name: 'maxcatchup50', breaks: 'headline fidelity at 2.32 Hz',
    why: 'MAX_CATCHUP 5 -> 50: if 19.3% is really a consequence of the cap, this must move it',
    predicate: 'headline',
    from: 'export const MAX_CATCHUP = 5;',
    to:   'export const MAX_CATCHUP = 50;' },
];

async function loadMutant(m) {
  let src = SHIPPED;
  if (!src.includes(m.from)) {
    throw new Error(`INERT CONTROL: mutant '${m.name}' anchor text not found in ${LOOP_SRC}. ` +
      'The edit would not have applied and the control would have been a second copy of the ' +
      'positive arm (RULES 6). Fix the anchor, do not skip the control.');
  }
  src = src.replace(m.from, m.to);
  if (src === SHIPPED) throw new Error(`INERT CONTROL: mutant '${m.name}' produced byte-identical source.`);
  src = src.replace("from './guards.js'", `from ${JSON.stringify(pathToFileURL(GUARDS_SRC).href)}`);
  const p = path.join(SCRATCH, `loop.${m.name}.${TASK}.mjs`);
  fs.writeFileSync(p, src);
  return import(pathToFileURL(p).href + `?v=${Date.now()}`);
}

// ---------------------------------------------------------------------------------------------
const shippedMod = await import(pathToFileURL(LOOP_SRC).href);
const shipped = runAll(shippedMod, 'shipped');

const shippedHeadline = (shipped.law.find((l) => l.raf_hz === 2.32) || {}).world_time_fidelity;
const controls = [];
for (const m of MUTANTS) {
  let verdict, err = null;
  try { verdict = runAll(await loadMutant(m), `mutant:${m.name}`); }
  catch (e) { err = String(e && e.message || e); verdict = null; }
  const fid232 = verdict ? (verdict.law.find((l) => l.raf_hz === 2.32) || {}).world_time_fidelity : null;
  // Each control declares WHAT must move. A control that goes red on some other arm has not
  // demonstrated the check it was aimed at, so `broke_the_right_arm` is scored separately from
  // `went_red` and the run is VOID unless both hold.
  const rightArm = m.predicate === 'headline'
    ? (fid232 !== null && !near(fid232, shippedHeadline, 1e-6))
    : !!(verdict && verdict.failed_arms.some((a) => a.startsWith(m.breaks.split(' ')[0])));
  controls.push({
    name: m.name, why: m.why, expected_to_break: m.breaks, predicate: m.predicate || 'arm-goes-red',
    error: err,
    went_red: m.predicate === 'headline' ? rightArm : !!(verdict && verdict.pass === false),
    failed_arms: verdict ? verdict.failed_arms : [],
    broke_the_right_arm: rightArm,
    fidelity_at_2_32hz: fid232,
    shipped_fidelity_at_2_32hz: shippedHeadline,
  });
}
try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* scratch cleanup is best-effort */ }

const deadControls = controls.filter((c) => !c.went_red || !c.broke_the_right_arm);
const at232 = shipped.law.find((l) => l.raf_hz === 2.32);
const artifact = {
  schema: 'elder-souls/timefidelity@1',
  item: 'RI-PLT01 §C.5 P14/P15, check M16',
  task: TASK,
  commit: (process.env.ES_COMMIT || ''),
  taken_at: new Date().toISOString(),
  tier: 'S',
  tier_note: 'Arithmetic over FixedLoop with a synthetic clock and synthetic rAF. No renderer is ' +
    'involved, so this number is identical on a phone, a workstation and SwiftShader (RI-PLT01 §A). ' +
    'It makes no claim about any device\'s frame rate — that is Tier-H and is P10-P13/M17.',
  ticks_per_rate: TICKS,
  shipped,
  headline: at232 ? {
    raf_hz: 2.32,
    world_time_fidelity: at232.world_time_fidelity,
    reading: `At a SUSTAINED 2.32 rAF Hz the shipped loop advances the world at ` +
      `${(at232.world_time_fidelity * 100).toFixed(1)}% of real time, deleting ` +
      `${at232.dropped_ms_per_s} ms of world per second of the player's life, with a clamp run of ` +
      `${at232.max_clamp_run} consecutive ticks — and RI-PLT01 had no check that would have said so.`,
  } : null,
  null_controls: controls,
  verdict: shipped.pass && deadControls.length === 0 ? 'PASS'
    : !shipped.pass ? 'FAIL — the shipped loop violates RI-PLT01 §C.5'
    : 'VOID — a null control did not go red; this instrument is not trustworthy',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2));

const line = (s) => process.stdout.write(s + '\n');
line(`timefidelity — RI-PLT01 M16 (Tier-S, no browser). MAX_CATCHUP=${shipped.MAX_CATCHUP}, rAF floor ${shipped.raf_floor_hz} Hz`);
line('');
line('  raf_hz  steps/raf   fidelity  predicted  dropped_ms/s  clamp_run  law');
for (const l of shipped.law) {
  line(`  ${String(l.raf_hz).padStart(6)}  ${String(l.steps_per_raf).padStart(9)}  ` +
       `${l.world_time_fidelity.toFixed(4).padStart(8)}  ${l.predicted_fidelity.toFixed(4).padStart(9)}  ` +
       `${String(l.dropped_ms_per_s).padStart(12)}  ${String(l.max_clamp_run).padStart(9)}  ${l.law_holds ? 'ok' : 'RED'}`);
}
line('');
for (const h of shipped.p15_harness) line(`  P15 ${h.mode.padEnd(18)} rAF ticks ${h.raf_ticks}, sim steps ${h.sim_steps}, clamps ${h.catchup_clamps}, dropped ${h.catchup_dropped_ms} ms — ${h.ok ? 'ok' : 'RED'}`);
line('');
line('  null controls (each must go red, and must break the arm it was aimed at):');
for (const c of controls) {
  line(`    ${c.name.padEnd(13)} ${(c.went_red && c.broke_the_right_arm) ? 'RED  ' : 'GREEN'} ` +
       `expected ${c.expected_to_break}; got [${c.failed_arms.join(' | ') || 'nothing'}]` +
       (c.error ? `  ERROR ${c.error}` : ''));
}
line('');
line(`  ${artifact.verdict}`);
if (artifact.headline) line(`  ${artifact.headline.reading}`);
line(`  artifact: ${path.relative(REPO, OUT)}`);
if (argv.includes('--json')) line(JSON.stringify(artifact, null, 2));

if (deadControls.length) process.exit(3);
if (!shipped.pass) process.exit(1);
process.exit(0);
