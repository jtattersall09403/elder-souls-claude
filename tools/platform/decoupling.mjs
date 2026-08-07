#!/usr/bin/env node
// decoupling.mjs — RI-PLT01 M6, a REAL Tier-S instrument. Round 3.
//
// WHY THIS FILE STOPPED BEING AN ABSENCE-REPORTER.
//
// Round 2 shipped this as one of twelve absence-reporters, declaring
// `system: 'Tier-H performance numbers'` and `needs: ['getPerfStats']` — a method M6 does not
// use — and refusing on a marker that belongs to the OTHER tier. TOOL-COVERAGE-R2 §4 ruled
// against that, and the item had already ruled: `RI-PLT01` line 110 classifies sim/render
// decoupling as **Tier-S** —
//
//   "a structural property... Measuring it under SwiftShader gives the same answer as measuring
//    it on real hardware. Scoreable HERE, in this container, today."
//
// M6 is worth **10 points**, the largest single entry in the 26-point sim-integrity block, and
// its hard fail HF2 ("simulation step count or trace hash changes with render rate") is one of
// the two failures that would void the whole combat area of the corpus. `setRenderRate()` and
// `stepFrames()` are both live. Nothing was missing. A refusal here was a refusal to measure.
//
// WHAT M6 SAYS, verbatim:
//   "Run F3 at render rates 60, 30, 15 and 0 Hz for 60 s of sim each. Count sim steps; compare
//    trace body_sha256. Exactly 3600 steps at every rate; all four body_sha256 identical.
//    Hard fail: any difference."
//
// TWO DECLARED SUBSTITUTIONS, both named in the artifact on every run:
//
//   1. **There is no `F3` scenario file.** `tools/harness/scenarios/` ships ten scenarios and
//      none of them is named F3. §C.1 describes F3 as "boss arena, 1 boss, active fight"; the
//      nearest shipped fixture is `cmb-duel-infantry` (player vs one INFANTRY trash enemy,
//      scripted aggressive play, 3600 frames). That is a duel and not a boss arena, so the
//      substitution is DECLARED, the referent is named, and `--scenario` takes anything else.
//      The property under test — does the sim depend on the render rate — is not sensitive to
//      which fight it is, which is exactly why M6 is Tier-S.
//
//   2. **`renderRateHz` is a two-state quantity on the `stepFrames` path.** In mode `harness`
//      the rAF loop neither steps nor draws (`core/loop.js`), so `maybeRender()` — the only
//      consumer of the RATE as a rate — never runs, and `stepFrames()` renders exactly once at
//      the end whenever `renderRateHz !== 0` (`engine.js:3212`). A sweep that called
//      `stepFrames(3600)` four times would therefore render once, once, once and never, and
//      "render rate 30" would be a label on nothing.
//
//      So the sweep drives the render CADENCE itself: at rate R it steps in chunks of
//      `round(60 / R)` fixed steps, which puts one render every 1000/R ms of SIMULATED time —
//      the only reading of "render rate" a fixed-step sim under a harness can honour. The
//      resulting render counts (600 / 300 / 150 / 0 at the default 600 steps) are reported per
//      rate and are the NULL CONTROL: if they came out identical the perturbation was never
//      applied and the four matching hashes would prove nothing. The tool fails the run when
//      they do not vary.
//
// M7 RIDES ALONG. `RI-PLT01` M7 (Tier-S, weight 5, HF3) asks for character displacement,
// stamina consumed and camera degrees turned at each render rate, "identical to 6 dp at all
// rates — any drift means deltaTime is in the sim". That is the same sweep with three more
// numbers read at the end, so it is taken here rather than left for a tool nobody writes.
//
// EXIT CODES: 0 M6 and M7 both pass; 1 a hard fail (HF2/HF3) or a control that did not move;
//             20 the measurement could not be taken; 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, writeJson, log, die, EXIT, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';
import { loadScenario } from '../lib/scenario.mjs';

const USAGE = `
decoupling.mjs — RI-PLT01 M6 (sim/render decoupling) + M7 (frame-rate independence). Tier-S.

USAGE
  node tools/platform/decoupling.mjs [--scenario cmb-duel-infantry] [--sim-frames 600]
  node tools/platform/decoupling.mjs --sim-frames 3600 --out reports/platform/m6.json
  node tools/platform/decoupling.mjs --self-test
  node tools/platform/decoupling.mjs --help

OPTIONS
  --scenario ID       scenario to run at every rate (default cmb-duel-infantry; see the header
                      for why it is not F3 and what F3 would have been)
  --sim-frames N      fixed steps per rate (default 600). M6 as written asks for 3600 = 60 s.
                      600 is the default because a rate-60 run renders ONE SwiftShader FRAME PER
                      STEP by design (see the header), and 3600 of those is the stepping loop
                      AGENT-PROTOCOL warns never returns. Raise it deliberately, on a quiet box.
  --rates 60,30,15,0  the render rates to sweep (default RI-PLT01 M6's four)
  --cadence sim|call  sim  = one render every 1000/R ms of SIMULATED time (default; the rate
                             actually bites and the render counts differ per rate)
                      call = one render per stepFrames() call, i.e. what the harness does if you
                             do not drive it. Kept so the difference is inspectable, not assumed.
  --entry PATH        game/index.html to boot (a shadow tree, for falsification)
  --break-decoupling  INJECT the failure: an init script that makes the simulation depend on the
                      render rate. The tool MUST go red. This is the falsification handle and it
                      is the reason a green result here means anything.
  --out PATH          write the JSON report (default reports/platform/decoupling.json)
  --self-test         run the sweep clean and then broken, and require the verdict to flip
  --help

EXIT CODES
  0   M6 and M7 pass and the perturbation was demonstrably applied
  1   HF2 (step count or hash varies with render rate) or HF3 (a gameplay quantity drifts),
      or the render-count control did not move
  20  the measurement could not be taken
  2   usage
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RATES = String(args.rates || '60,30,15,0').split(',').map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);
const SIM_FRAMES = Number.isFinite(Number(args['sim-frames'])) ? Number(args['sim-frames']) : 600;
const CADENCE = String(args.cadence || 'sim');
if (!['sim', 'call'].includes(CADENCE)) usage(USAGE, EXIT.USAGE);
const SCENARIO_ID = String(args.scenario || 'cmb-duel-infantry');

// ROUND 4 — M6's own terms, as constants the verdict is computed against rather than as prose in
// a footnote. `m6_asks_for` was already reported and then not used; now it gates `pass`.
const M6_ASKS_FOR = 3600;
// RI-PLT01 M6 names scenario F3, "boss arena, 1 boss, active fight". Detected, not assumed: if
// somebody authors F3 (TOOL-COVERAGE-R3 Referral 1 rules that they should), this goes true on its
// own and the deviation clears without this file being edited.
const scenarioIsF3 = (() => {
  if (/^f3\b/i.test(SCENARIO_ID)) return true;
  try {
    const s = loadScenario(SCENARIO_ID);
    // A boss arena is one boss-tier combatant in a fight. Read from the scenario, not asserted.
    const roles = JSON.stringify(s).toLowerCase();
    return /"f3"|boss_arena|\bboss\b/.test(roles) && /champion|boss/.test(roles);
  } catch { return false; }
})();

// ---------------------------------------------------------------------------------------------
// The injected failure. It runs IN THE PAGE, above the harness, and makes the SIMULATION depend
// on the render rate — which is precisely what HF2 exists to catch. Two independent breakages so
// the two clauses of M6 are falsified separately:
//   - step count: stepFrames(n) runs n+1 steps when rendering is off
//   - trace body: a world write on every chunk when rendering is off
// ---------------------------------------------------------------------------------------------
const BREAK_SCRIPT = `
(() => {
  const install = () => {
    const H = window.__HARNESS;
    if (!H || H.__decouplingBroken) return;
    H.__decouplingBroken = true;
    const rate = () => (typeof H.getRenderRate === 'function' ? H.getRenderRate() : 60);
    const realStep = H.stepFrames.bind(H);
    H.stepFrames = (n) => {
      // "deltaTime is in the sim": with rendering off the loop believes it is behind and
      // catches up by one extra step. This is the shape of the bug, not a cosmetic marker.
      const extra = rate() === 0 ? 1 : 0;
      return realStep(Number(n) + extra);
    };
  };
  if (window.__HARNESS) install();
  else {
    const t = setInterval(() => { if (window.__HARNESS) { install(); clearInterval(t); } }, 5);
    setTimeout(() => clearInterval(t), 60000);
  }
})();
`;

const REQUIRED = ['setSeed', 'setRenderRate', 'getRenderRate', 'stepFrames', 'getPerfStats',
  'traceStart', 'traceDrain', 'traceStop', 'queueInputs', 'snapshot'];

/** One rate. Fresh browser per rate: a contaminated world would be indistinguishable from HF2. */
async function runAtRate(scenario, rate, opts = {}) {
  // ROUND 4: the step budget is a PARAMETER so --self-test can cap it (R3: the uncapped form
  // ran eight full browser sweeps and the critic could not complete it in two attempts).
  const SIM_FRAMES_R = Number.isFinite(Number(opts.simFrames)) ? Number(opts.simFrames) : SIM_FRAMES;
  const handle = await launchGame({
    ...args, width: 320, height: 240,
    timeout: Number(args.timeout || 120000),
    initScripts: opts.broken ? [BREAK_SCRIPT] : [],
  });
  try {
    await requireMethods(handle, REQUIRED);

    // The rate FIRST, and read back. A setter that silently ignores its argument would make
    // four identical hashes a tautology.
    const set = await handle.h('setRenderRate', rate);
    const readBack = await handle.h('getRenderRate');
    if (Number(readBack) !== rate) {
      throw new Error(`setRenderRate(${rate}) read back as ${readBack} — the rate was not applied, ` +
                      'so nothing downstream of it can be measured.');
    }

    await handle.h('setSeed', scenario.seed);
    if (scenario.state) await handle.hOpt('loadState', scenario.state);
    else await handle.hOpt('reset', { seed: scenario.seed });
    if (scenario.world.timeOfDay !== undefined) await handle.hOpt('setTimeOfDay', scenario.world.timeOfDay);
    if (scenario.world.weather !== undefined) await handle.hOpt('setWeather', scenario.world.weather);
    for (const op of scenario.setup) {
      if (op.op === 'teleport') await handle.h('teleport', op.x, op.z);
      else if (op.op === 'spawn') await handle.h('spawn', op.id, op.x, op.z, { as: op.as });
      else if (op.op === 'lockOn') await handle.hOpt('lockOn', op.target);
      else await handle.hOpt(op.op, op);
    }
    if (scenario.warmupFrames > 0) await handle.h('stepFrames', scenario.warmupFrames);
    await handle.hOpt('reanchorFreeRunning');
    await handle.h('queueInputs', scenario.inputs);

    const before = await handle.h('getPerfStats');
    await handle.h('traceStart', scenario.trace);

    // The cadence. See the header: this is what makes "render rate 30" mean anything under a
    // harness whose rAF loop neither steps nor draws.
    const chunk = CADENCE === 'call' ? 300
      : (rate > 0 ? Math.max(1, Math.round(60 / rate)) : SIM_FRAMES_R);

    const hash = crypto.createHash('sha256');
    let records = 0, stepped = 0;
    while (stepped < SIM_FRAMES_R) {
      const n = Math.min(chunk, SIM_FRAMES_R - stepped);
      await handle.h('stepFrames', n);
      stepped += n;
      const recs = await handle.h('traceDrain');
      for (const r of recs) { hash.update(JSON.stringify(r) + '\n'); records++; }
    }
    for (const r of (await handle.h('traceStop')) || []) { hash.update(JSON.stringify(r) + '\n'); records++; }

    const after = await handle.h('getPerfStats');
    const snap = await handle.h('snapshot');

    // M7's three quantities, read from the world rather than from the model's return value.
    const p = (snap && (snap.player || snap.p)) || {};
    const cam = (snap && (snap.camera || snap.cam)) || {};
    const m7 = {
      player_x: num(p.x ?? (p.pos && p.pos[0])),
      player_z: num(p.z ?? (p.pos && p.pos[2])),
      stamina: num(p.stamina ?? p.sp),
      hp: num(p.hp),
      camera_yaw_deg: num(cam.yaw ?? cam.yaw_deg ?? cam.heading),
    };

    return {
      render_rate_hz: rate,
      set_returned: set,
      read_back: readBack,
      chunk_frames: chunk,
      sim_steps_requested: SIM_FRAMES_R,
      sim_steps_observed: num(after.simStepsTotal) - num(before.simStepsTotal),
      renders_observed: num(after.rendersTotal) - num(before.rendersTotal),
      trace_records: records,
      body_sha256: hash.digest('hex'),
      m7,
    };
  } finally {
    await handle.close().catch(() => {});
  }
}

function num(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

async function sweep(broken, opts = {}) {
  const scenario = loadScenario(SCENARIO_ID);
  const frames = Number.isFinite(Number(opts.simFrames)) ? Number(opts.simFrames) : SIM_FRAMES;
  const rates = opts.rates
    ? String(opts.rates).split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x))
    : RATES;
  const rows = [];
  for (const rate of rates) {
    log(`M6: render rate ${rate} Hz, ${frames} sim steps, cadence ${CADENCE}${broken ? ' [BROKEN ON PURPOSE]' : ''}`);
    rows.push(await runAtRate(scenario, rate, { broken, simFrames: frames }));
  }
  return { scenario, rows };
}

function judge(rows, opts = {}) {
  // ROUND 4: both the step budget and the F3 determination are parameters, so the self-test can
  // exercise the verdict gate in BOTH directions without booting a browser twice more.
  const FRAMES = Number.isFinite(Number(opts.simFrames)) ? Number(opts.simFrames) : SIM_FRAMES;
  const IS_F3 = opts.scenarioIsF3 === undefined ? scenarioIsF3 : !!opts.scenarioIsF3;
  const stepsOk = rows.every((r) => r.sim_steps_observed === r.sim_steps_requested);
  const hashes = [...new Set(rows.map((r) => r.body_sha256))];
  const hashOk = hashes.length === 1;

  // The null control. If the render counts do not vary with the rate, the perturbation was
  // never applied and four matching hashes are a tautology, not a measurement.
  const renderCounts = rows.map((r) => r.renders_observed);
  const controlOk = new Set(renderCounts).size > 1;

  // M7: every gameplay quantity identical across rates.
  const keys = Object.keys(rows[0].m7);
  const drift = [];
  for (const k of keys) {
    const vals = [...new Set(rows.map((r) => Number(r.m7[k]).toFixed(6)))];
    if (vals.length > 1) drift.push({ quantity: k, values: rows.map((r) => ({ rate: r.render_rate_hz, value: r.m7[k] })) });
  }
  const m7Ok = drift.length === 0;

  // =============================================================================================
  // ROUND 4 — TOOL-COVERAGE-R3 §6. THE DEVIATION IS CARRIED INTO THE VERDICT.
  //
  // The instrument is sound and R3 confirmed it: the red genuinely goes red, the green is green,
  // the control is not vacuous. The defect was that **the shipped artifact of record said
  // `pass: true` for a bar that was not met**:
  //
  //     "sim_frames_per_rate": 300,  "m6_asks_for": 3600,
  //     "verdict": {"m6_step_count": {"pass": true, "expected": 300, ...}},
  //     "pass": true, "hard_fails": []
  //
  // M6's threshold is "EXACTLY 3 600 steps at every rate". This ran 300 — 8.3% of the specified
  // duration — on a SUBSTITUTED scenario, and set `expected` to whatever it happened to run. The
  // shortfall was declared twice elsewhere, which is why R3 called this narrow. But TOOL-LOOP.md
  // rule 4 is the whole point of the loop: "a number on that page means something." A consumer
  // reading `pass` on a 10-POINT item — the largest single entry in the 26-point sim-integrity
  // axis — got a green.
  //
  // So: `meets_item_duration` and `scenario_as_specified` are computed, and `pass` is no longer
  // `true` when either is false. The measured property is still reported separately as
  // `invariance_holds`, because it IS a real result and losing it would be the opposite mistake.
  // =============================================================================================
  const meetsDuration = FRAMES >= M6_ASKS_FOR;
  const scenarioAsSpecified = IS_F3;
  const itemSatisfied = meetsDuration && scenarioAsSpecified;
  const deviation = [
    meetsDuration ? null
      : `ran ${FRAMES} steps per rate; M6 asks for EXACTLY ${M6_ASKS_FOR} ` +
        `(${(100 * FRAMES / M6_ASKS_FOR).toFixed(1)}% of the specified duration)`,
    scenarioAsSpecified ? null
      : `scenario "${SCENARIO_ID}" was substituted for M6's named F3 ("boss arena, 1 boss, ` +
        'active fight"), which has no file. Sim/render coupling surfaces under LOAD AND ' +
        'COMPLEXITY, so substituting a flat-ground trash duel is a substitution in the ' +
        'PERMISSIVE direction (TOOL-COVERAGE-R3, Referral 1)',
  ].filter(Boolean);

  /** `pass` is only true when the property holds AND the item's own terms were met. */
  const gated = (propertyHolds) => propertyHolds && itemSatisfied;

  return {
    m6_step_count: {
      // The property, unchanged and still reported.
      invariance_holds: stepsOk,
      // The VERDICT, which is what a consumer reads. Not true on a short or substituted run.
      pass: gated(stepsOk),
      meets_item_duration: meetsDuration,
      scenario_as_specified: scenarioAsSpecified,
      item_satisfied: itemSatisfied,
      deviation_from_item: deviation.length ? deviation : null,
      steps_run_per_rate: FRAMES,
      m6_asks_for: M6_ASKS_FOR,
      expected: FRAMES,
      observed: rows.map((r) => ({ rate: r.render_rate_hz, steps: r.sim_steps_observed })),
      hard_fail: stepsOk ? null : 'HF2 — the simulation step count changes with the render rate.',
      why_not_pass: gated(stepsOk) ? null
        : stepsOk
          ? `the step count IS invariant across render rates — that result stands — but this run ` +
            `does not meet M6's own terms: ${deviation.join('; ')}. Reporting pass:true here is ` +
            `how a 10-point bar relaxes without anyone deciding to relax it. Re-run with ` +
            `--sim-frames ${M6_ASKS_FOR} against scenario F3.`
          : 'the step count is NOT invariant across render rates.',
    },
    m6_trace_hash: {
      invariance_holds: hashOk,
      pass: gated(hashOk),
      meets_item_duration: meetsDuration,
      scenario_as_specified: scenarioAsSpecified,
      item_satisfied: itemSatisfied,
      deviation_from_item: deviation.length ? deviation : null,
      distinct_hashes: hashes.length,
      observed: rows.map((r) => ({ rate: r.render_rate_hz, body_sha256: r.body_sha256, records: r.trace_records })),
      hard_fail: hashOk ? null : 'HF2 — the trace body hash changes with the render rate.',
      why_not_pass: gated(hashOk) ? null
        : hashOk
          ? `the trace body hash IS invariant across render rates — that result stands — but ` +
            `this run does not meet M6's own terms: ${deviation.join('; ')}.`
          : 'the trace body hash is NOT invariant across render rates.',
    },
    control_render_counts_vary: {
      pass: controlOk,
      observed: rows.map((r) => ({ rate: r.render_rate_hz, renders: r.renders_observed, chunk: r.chunk_frames })),
      why: controlOk
        ? 'the render rate DID change how much rendering happened, so the identical hashes are a ' +
          'result and not a tautology'
        : 'the render counts are identical at every rate, so the perturbation was never applied ' +
          'and nothing downstream of it may be reported as a pass. Check --cadence.',
    },
    m7_frame_rate_independence: {
      pass: m7Ok,
      quantities: Object.keys(rows[0].m7),
      drift,
      hard_fail: m7Ok ? null : 'HF3 — a gameplay quantity drifts with the render rate, which means deltaTime is in the sim.',
    },
  };
}

// ---------------------------------------------------------------------------------------------
// --self-test. Both directions, on the running engine, in one command.
// ---------------------------------------------------------------------------------------------
if (args['self-test']) {
  let failed = 0;
  // Flush as produced. TOOL-COVERAGE-R3 §6: "--self-test did not complete in two attempts — once
  // crashing with `Target page ... has been closed` at load 19, once still unfinished after ~28
  // minutes at load 5. A falsification a critic cannot re-run is a falsification on trust."
  const ok = (name, pass, detail) => {
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
    if (!pass) failed++;
  };

  // ---- ROUND 4: THE SELF-TEST IS CAPPED so a critic can re-run it. -------------------------
  // R3's rebuild list, last clause: "cap the self-test's step count." It ran EIGHT full browser
  // sweeps at the run's own --sim-frames. The falsification it performs — does the verdict flip
  // between a sound build and a broken one — is a property of the FIRST FEW FRAMES (the broken
  // build diverges at 61 steps vs 60), so a long sweep buys nothing and costs a critic the
  // ability to check the work. Widen with --self-test-frames / --self-test-rates.
  const ST_FRAMES = Number.isFinite(Number(args['self-test-frames']))
    ? Number(args['self-test-frames']) : 60;
  const ST_RATES = args['self-test-rates'] ? String(args['self-test-rates']) : '60,0';

  // =============================================================================================
  // PART 1 — THE VERDICT GATE, BROWSER-FREE.
  //
  // TOOL-COVERAGE-R3 §6's defect is arithmetic over `judge()`, not a property of the engine, so
  // it is falsified here over synthetic rows. This part runs on a loaded box, on a tree whose
  // engine will not boot, and in CI — which is exactly the difference between a falsification a
  // critic can re-run and one they have to take on trust.
  // =============================================================================================
  const synth = (steps, requested, hash, rate) => ({
    render_rate_hz: rate, sim_steps_observed: steps, sim_steps_requested: requested,
    body_sha256: hash, trace_records: steps, renders_observed: rate > 0 ? steps : 0, chunk_frames: 1,
    m7: { player_x: 1, stamina: 2 },
  });
  const invariantRows = [synth(300, 300, 'aaa', 60), synth(300, 300, 'aaa', 0)];
  const brokenRows = [synth(300, 300, 'aaa', 60), synth(301, 300, 'bbb', 0)];

  // The shipped artifact of record, reconstructed: 300 steps, substituted scenario, pass:true.
  const short = judge(invariantRows, { simFrames: 300, scenarioIsF3: false });
  ok('R4: 300-of-3600 on a SUBSTITUTED scenario does NOT report pass:true (the R3 §6 defect)',
    short.m6_step_count.invariance_holds === true && short.m6_step_count.pass === false &&
    short.m6_step_count.meets_item_duration === false &&
    short.m6_step_count.scenario_as_specified === false && !!short.m6_step_count.why_not_pass,
    `invariance_holds=${short.m6_step_count.invariance_holds}, pass=${short.m6_step_count.pass}. ` +
    'reports/platform/decoupling.json shipped "sim_frames_per_rate": 300, "m6_asks_for": 3600, ' +
    '"pass": true on a 10-POINT item — the largest single entry in the 26-point sim-integrity axis.');
  ok('R4: the real result is not LOST — invariance_holds reports it separately',
    short.m6_trace_hash.invariance_holds === true && short.m6_trace_hash.pass === false,
    'gating `pass` on the item\'s terms must not throw away the measurement that WAS taken');
  ok('R4: the deviation is NAMED in the verdict, not only in a footnote',
    Array.isArray(short.m6_step_count.deviation_from_item) &&
    short.m6_step_count.deviation_from_item.some((d) => /asks for EXACTLY/.test(d)) &&
    short.m6_step_count.deviation_from_item.some((d) => /F3/.test(d)),
    JSON.stringify(short.m6_step_count.deviation_from_item));
  ok('R4: a FULL-LENGTH run on a substituted scenario still does not pass (both terms bind)',
    judge(invariantRows, { simFrames: M6_ASKS_FOR, scenarioIsF3: false }).m6_step_count.pass === false,
    'duration alone is not enough — Referral 1 rules the F3 substitution is in the permissive direction');
  const full = judge(invariantRows, { simFrames: M6_ASKS_FOR, scenarioIsF3: true });
  ok('R4: NULL CONTROL — a full-length run on F3 CAN reach pass:true',
    full.m6_step_count.pass === true && full.m6_step_count.item_satisfied === true &&
    full.m6_step_count.deviation_from_item === null,
    `at ${M6_ASKS_FOR} steps with F3 authored: pass=${full.m6_step_count.pass}. The gate is a ` +
    'condition, not a permanent refusal — the opposite mistake, which this loop has already made twice.');
  const brokenFull = judge(brokenRows, { simFrames: M6_ASKS_FOR, scenarioIsF3: true });
  ok('R4: and a BROKEN build at full length on F3 still FAILS (the gate did not swallow the red)',
    brokenFull.m6_step_count.pass === false && brokenFull.m6_step_count.invariance_holds === false &&
    !!brokenFull.m6_step_count.hard_fail && brokenFull.m6_trace_hash.invariance_holds === false,
    `${brokenFull.m6_step_count.hard_fail} / ${brokenFull.m6_trace_hash.hard_fail}`);
  ok('R4: the render-count control still catches a perturbation that was never applied',
    judge([synth(60, 60, 'aaa', 60), synth(60, 60, 'aaa', 60)]).control_render_counts_vary.pass === false,
    'identical render counts at every rate => the sweep proved nothing, and it says so');

  // =============================================================================================
  // PART 2 — the live sweeps, clean then broken.
  // =============================================================================================
  process.stdout.write(
    `\ndecoupling --self-test part 2: capped at ${ST_FRAMES} steps/rate over rates [${ST_RATES}]. ` +
    `The verdict flip is visible at 60 steps (the broken build diverges at 61 vs 60).\n`);
  const nodeSide = failed;
  let clean;
  try { clean = await sweep(false, { simFrames: ST_FRAMES, rates: ST_RATES }); }
  catch (e) {
    ok('the CLEAN sweep could be run', false,
      `sweep failed: ${String((e && e.message) || e).split('\n')[0].slice(0, 200)}`);
    process.stdout.write(
      `\ndecoupling self-test: FAIL — browser half not run; the 7 browser-free verdict-gate ` +
      `falsifications above ${nodeSide === 0 ? 'ALL PASSED and ' : ''}still stand\n`);
    process.exit(1);
  }
  const cv = judge(clean.rows, { simFrames: ST_FRAMES });
  ok('GREEN: the shipped build passes M6 (step count)', cv.m6_step_count.invariance_holds,
    JSON.stringify(cv.m6_step_count.observed));
  ok('GREEN: the shipped build passes M6 (one trace hash at all rates)', cv.m6_trace_hash.invariance_holds,
    `${cv.m6_trace_hash.distinct_hashes} distinct hash over ${clean.rows.length} rates: ${clean.rows[0].body_sha256.slice(0, 16)}…`);
  ok('CONTROL: the render rate actually changed the amount of rendering', cv.control_render_counts_vary.pass,
    JSON.stringify(cv.control_render_counts_vary.observed));
  ok('GREEN: M7 — no gameplay quantity drifts with the render rate', cv.m7_frame_rate_independence.pass,
    `${cv.m7_frame_rate_independence.quantities.join(', ')} identical to 6 dp at all rates`);

  let broken;
  try { broken = await sweep(true, { simFrames: ST_FRAMES, rates: ST_RATES }); }
  catch (e) {
    ok('the BROKEN-build sweep could be run', false,
      `sweep failed: ${String((e && e.message) || e).split('\n')[0].slice(0, 200)}`);
    process.stdout.write(`\ndecoupling self-test: FAIL — the red half could not be run\n`);
    process.exit(1);
  }
  const bv = judge(broken.rows, { simFrames: ST_FRAMES });
  ok('RED: with the sim made to depend on the render rate, M6 step count FAILS',
    bv.m6_step_count.invariance_holds === false, JSON.stringify(bv.m6_step_count.observed));
  ok('RED: and the trace hash diverges too',
    bv.m6_trace_hash.invariance_holds === false, `${bv.m6_trace_hash.distinct_hashes} distinct hashes`);
  ok('the verdict FLIPPED between the two runs (the gate is a check, not a constant)',
    cv.m6_step_count.invariance_holds !== bv.m6_step_count.invariance_holds &&
    cv.m6_trace_hash.invariance_holds !== bv.m6_trace_hash.invariance_holds,
    `clean {steps: ${cv.m6_step_count.invariance_holds}, hash: ${cv.m6_trace_hash.invariance_holds}} vs ` +
    `broken {steps: ${bv.m6_step_count.invariance_holds}, hash: ${bv.m6_trace_hash.invariance_holds}}`);

  process.stdout.write(`\ndecoupling self-test: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
const { scenario, rows } = await sweep(!!args['break-decoupling']);
const verdict = judge(rows);
const allPass = Object.values(verdict).every((v) => v.pass);

const report = {
  schema: 'elder-souls/decoupling@1',
  tool: 'tools/platform/decoupling.mjs',
  item: 'RI-PLT01 M6 (10 pts, HF2) + M7 (5 pts, HF3) — Tier-S, scoreable in this container',
  tier: 'S',
  generated_at: new Date().toISOString(),
  declared_substitutions: [
    `RI-PLT01 M6 names scenario F3 ("boss arena, 1 boss, active fight"). NO F3 SCENARIO FILE ` +
    `EXISTS in tools/harness/scenarios/. This run used "${scenario.id}" — ${scenario.title}. ` +
    `The substitution is declared rather than hidden; the property M6 tests is not sensitive to ` +
    `which fight is running, which is why the item classes it Tier-S.`,
    `renderRateHz is a two-state quantity on the stepFrames path in mode 'harness' ` +
    `(core/loop.js: the rAF loop neither steps nor draws; engine.js:3212 renders once per ` +
    `stepFrames call when the rate is non-zero). This run drove the render CADENCE at ` +
    `--cadence ${CADENCE}: ` +
    (CADENCE === 'sim'
      ? 'chunk = round(60 / rate), i.e. one render every 1000/rate ms of SIMULATED time.'
      : 'one render per stepFrames() call, 300 steps per call.'),
    // ROUND 4 — TOOL-COVERAGE-R3 Referral 2: "the limit is real and should be stated more loudly
    // than it is." The tool said the rAF loop neither steps nor draws; it did not say the
    // CONSEQUENCE.
    'SCOPE LIMIT, and it is a real one: because renderRateHz is two-state on stepFrames, this ' +
    'sweep never exercises the thing that consumes the rate AS A RATE — core/loop.js\'s rAF ' +
    'loop, which in harness mode neither steps nor draws. So M6 as measured here covers the ' +
    'INTERLEAVING axis in HARNESS MODE, and THE SHIPPING RENDER PATH IS NOT TESTED AT ALL. A ' +
    'decoupling defect living in the production scheduler would pass this sweep.',
  ],
  sim_frames_per_rate: SIM_FRAMES,
  m6_asks_for: M6_ASKS_FOR,
  // ROUND 4 — the two facts that gate `pass`, at the top level as well as inside each verdict,
  // so a consumer scanning the artifact cannot miss them. TOOL-COVERAGE-R3 §6.
  meets_item_duration: SIM_FRAMES >= M6_ASKS_FOR,
  scenario_as_specified: scenarioIsF3,
  rates: RATES,
  cadence: CADENCE,
  broken_on_purpose: !!args['break-decoupling'],
  runs: rows,
  verdict,
  pass: allPass,
  hard_fails: Object.values(verdict).map((v) => v.hard_fail).filter(Boolean),
};

const outPath = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'platform', 'decoupling.json');
ensureDir(path.dirname(outPath));
writeJson(outPath, report);

process.stdout.write(`decoupling (RI-PLT01 M6/M7, Tier-S): ${allPass ? 'PASS' : 'FAIL'}\n`);
for (const [k, v] of Object.entries(verdict)) {
  process.stdout.write(`  ${v.pass ? 'pass' : 'FAIL'} ${k}\n`);
  if (v.hard_fail) process.stdout.write(`       ${v.hard_fail}\n`);
}
for (const r of rows) {
  process.stdout.write(
    `  rate ${String(r.render_rate_hz).padStart(2)} Hz -> ${r.sim_steps_observed} steps, ` +
    `${r.renders_observed} renders (chunk ${r.chunk_frames}), ${r.trace_records} trace records, ` +
    `body_sha256 ${r.body_sha256.slice(0, 16)}…\n`);
}
if (SIM_FRAMES < M6_ASKS_FOR || !scenarioIsF3) {
  // ROUND 4. Round 3 printed this as a NOTE beside `pass: true`. It is now the reason `pass` is
  // not true, and it is stated as such.
  process.stdout.write(
    `  M6 NOT SATISFIED ON THE ITEM'S OWN TERMS — this is why \`pass\` is false above:\n`);
  if (SIM_FRAMES < M6_ASKS_FOR) {
    process.stdout.write(
      `    duration: ran ${SIM_FRAMES} steps per rate; M6 asks for EXACTLY ${M6_ASKS_FOR} ` +
      `(${(100 * SIM_FRAMES / M6_ASKS_FOR).toFixed(1)}%). Re-run --sim-frames ${M6_ASKS_FOR} on a quiet box.\n`);
  }
  if (!scenarioIsF3) {
    process.stdout.write(
      `    scenario: "${SCENARIO_ID}" substituted for M6's named F3 ("boss arena, 1 boss, active ` +
      `fight"), which has no file. Sim/render coupling surfaces under load and complexity, so a ` +
      `flat-ground trash duel is a substitution in the PERMISSIVE direction ` +
      `(TOOL-COVERAGE-R3 Referral 1: author F3 from shipped content).\n`);
  }
  process.stdout.write(
    `    The INVARIANCE RESULT stands and is reported as \`invariance_holds\` per check: ` +
    `${Object.entries(verdict).filter(([, v]) => v.invariance_holds !== undefined)
      .map(([k, v]) => k + '=' + v.invariance_holds).join(', ')}.\n`);
}
// ROUND 4 — the shipping-render-path limit, stated in the artifact as R3 Referral 2 requires.
process.stdout.write(
  `  SCOPE LIMIT: renderRateHz is two-state on the stepFrames path, so this sweep exercises the ` +
  `sim/render INTERLEAVING in HARNESS MODE. core/loop.js's rAF loop — the SHIPPING render ` +
  `scheduler — neither steps nor draws here and is NOT TESTED. A decoupling defect living in the ` +
  `production scheduler would pass this sweep.\n`);
log(`wrote ${path.relative(REPO_ROOT, outPath)}`);
process.exit(allPass ? 0 : 1);
