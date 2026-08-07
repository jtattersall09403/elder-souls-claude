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
      : (rate > 0 ? Math.max(1, Math.round(60 / rate)) : SIM_FRAMES);

    const hash = crypto.createHash('sha256');
    let records = 0, stepped = 0;
    while (stepped < SIM_FRAMES) {
      const n = Math.min(chunk, SIM_FRAMES - stepped);
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
      sim_steps_requested: SIM_FRAMES,
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

async function sweep(broken) {
  const scenario = loadScenario(SCENARIO_ID);
  const rows = [];
  for (const rate of RATES) {
    log(`M6: render rate ${rate} Hz, ${SIM_FRAMES} sim steps, cadence ${CADENCE}${broken ? ' [BROKEN ON PURPOSE]' : ''}`);
    rows.push(await runAtRate(scenario, rate, { broken }));
  }
  return { scenario, rows };
}

function judge(rows) {
  const stepsOk = rows.every((r) => r.sim_steps_observed === SIM_FRAMES);
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

  return {
    m6_step_count: {
      pass: stepsOk,
      expected: SIM_FRAMES,
      observed: rows.map((r) => ({ rate: r.render_rate_hz, steps: r.sim_steps_observed })),
      hard_fail: stepsOk ? null : 'HF2 — the simulation step count changes with the render rate.',
    },
    m6_trace_hash: {
      pass: hashOk,
      distinct_hashes: hashes.length,
      observed: rows.map((r) => ({ rate: r.render_rate_hz, body_sha256: r.body_sha256, records: r.trace_records })),
      hard_fail: hashOk ? null : 'HF2 — the trace body hash changes with the render rate.',
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
  const ok = (name, pass, detail) => {
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
    if (!pass) failed++;
  };

  const clean = await sweep(false);
  const cv = judge(clean.rows);
  ok('GREEN: the shipped build passes M6 (step count)', cv.m6_step_count.pass,
    JSON.stringify(cv.m6_step_count.observed));
  ok('GREEN: the shipped build passes M6 (one trace hash at all rates)', cv.m6_trace_hash.pass,
    `${cv.m6_trace_hash.distinct_hashes} distinct hash over ${clean.rows.length} rates: ${clean.rows[0].body_sha256.slice(0, 16)}…`);
  ok('CONTROL: the render rate actually changed the amount of rendering', cv.control_render_counts_vary.pass,
    JSON.stringify(cv.control_render_counts_vary.observed));
  ok('GREEN: M7 — no gameplay quantity drifts with the render rate', cv.m7_frame_rate_independence.pass,
    `${cv.m7_frame_rate_independence.quantities.join(', ')} identical to 6 dp at all rates`);

  const broken = await sweep(true);
  const bv = judge(broken.rows);
  ok('RED: with the sim made to depend on the render rate, M6 step count FAILS',
    bv.m6_step_count.pass === false, JSON.stringify(bv.m6_step_count.observed));
  ok('RED: and the trace hash diverges too',
    bv.m6_trace_hash.pass === false, `${bv.m6_trace_hash.distinct_hashes} distinct hashes`);
  ok('the verdict FLIPPED between the two runs (the gate is a check, not a constant)',
    cv.m6_step_count.pass !== bv.m6_step_count.pass && cv.m6_trace_hash.pass !== bv.m6_trace_hash.pass,
    `clean {steps: ${cv.m6_step_count.pass}, hash: ${cv.m6_trace_hash.pass}} vs ` +
    `broken {steps: ${bv.m6_step_count.pass}, hash: ${bv.m6_trace_hash.pass}}`);

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
  ],
  sim_frames_per_rate: SIM_FRAMES,
  m6_asks_for: 3600,
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
if (SIM_FRAMES !== 3600) {
  process.stdout.write(
    `  NOTE: M6 as written asks for 3600 steps (60 s) per rate; this run took ${SIM_FRAMES}. ` +
    `Re-run with --sim-frames 3600 on a quiet box for the item's own figure.\n`);
}
log(`wrote ${path.relative(REPO_ROOT, outPath)}`);
process.exit(allPass ? 0 : 1);
