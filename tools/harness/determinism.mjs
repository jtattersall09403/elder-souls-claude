#!/usr/bin/env node
// determinism.mjs — run the RI-MTH02 reproducibility ladder against the game and report
// every rung with the evidence that decided it.
//
// Spec: corpus/80-methods/RI-MTH02-determinism-reproducibility.md §A (rungs R1–R9) and
// corpus/80-methods/HARNESS.md §8 (D1–D7).
//
// This is an instrument, not a verdict: it prints what it measured and exits non-zero if a
// rung fails. A critic runs it, reads the hashes, and scores the item itself.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, log, die, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { loadScenario } from '../lib/scenario.mjs';

const USAGE = `
determinism.mjs — the RI-MTH02 reproducibility ladder (R1-R9).

USAGE
  node tools/harness/determinism.mjs [--scenario cmb-duel-infantry] [--frames 1800]

OPTIONS
  --scenario <id>   Scenario to drive (default cmb-duel-infantry)
  --frames <n>      Frames per run (default: the scenario's own)
  --seed <n>        Primary seed (default: the scenario's own)
  --seed2 <n>       Contrast seed for R4 (default 4242)
  --entry <path>    HTML entry (default game/index.html)
  --out <dir>       Where to write determinism.json (default reports/runs/DETERMINISM)
  --json            Print the full report on stdout
  --help            This message

RUNGS
  R1 run-to-run   R2 process-to-process*  R3 batch-invariant  R4 seed-sensitive
  R5 warm-up-invariant  R6 load-order documented  R7 wall-clock-invariant
  R8 resolution-invariant  R9 save round trip

  * R2 is checked here by reloading the page into a fresh JS realm; the stronger
    separate-OS-process check is two invocations of tools/harness/trace.mjs, and this tool
    prints the exact command to run for it.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const scenario = loadScenario(args.scenario || 'cmb-duel-infantry');
const SEED = args.seed !== undefined ? Number(args.seed) : scenario.seed;
const SEED2 = args.seed2 !== undefined ? Number(args.seed2) : 4242;
const FRAMES = args.frames !== undefined ? Number(args.frames) : Math.min(1800, scenario.frames);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'DETERMINISM');
ensureDir(outDir);

const handle = await launchGame(args);
const report = { schema: 'elder-souls/determinism@1', scenario: scenario.id, seed: SEED, seed2: SEED2, frames: FRAMES, rungs: [] };

/**
 * Run the scenario in-page and return {hash, records}. All stepping happens inside one
 * page.evaluate so host-side latency cannot influence it.
 * @param {object} o {seed, frames, chunk, warmup, sleepMsBetweenChunks, loadOrder}
 */
async function run(o) {
  const spec = {
    state: scenario.state || 'default',
    setup: scenario.setup,
    inputs: scenario.inputs,
    world: scenario.world,
    seed: o.seed ?? SEED,
    frames: o.frames ?? FRAMES,
    chunk: o.chunk ?? (o.frames ?? FRAMES),
    warmup: o.warmup ?? scenario.warmupFrames,
    loadOrder: o.loadOrder || 'seed-then-load',
    trace: scenario.trace,
  };
  if (o.freshRealm) await handle.page.reload({ waitUntil: 'load' });
  if (o.viewport) await handle.page.setViewportSize(o.viewport);
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));

  const chunks = [];
  const total = spec.frames;
  for (let done = 0; done < total; done += spec.chunk) chunks.push(Math.min(spec.chunk, total - done));

  const parts = [];
  const setupRes = await handle.page.evaluate(async (s) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);                       // A-JRN11: render disabled; the sim must not care
    if (s.loadOrder === 'seed-then-load') { H.setSeed(s.seed); H.loadState(s.state); }
    else { H.loadState(s.state); H.setSeed(s.seed); }
    if (s.world && s.world.timeOfDay !== undefined) H.setTimeOfDay(s.world.timeOfDay);
    if (s.world && s.world.weather !== undefined) H.setWeather(s.world.weather);
    for (const op of s.setup) {
      if (op.op === 'teleport') H.teleport(op.x, op.z, op.opts || {});
      else if (op.op === 'spawn') H.spawn(op.id, op.x, op.z, { as: op.as });
      else if (op.op === 'aggro') H.aggro(op.target || op.eid || op.as);
      else if (op.op === 'lockOn') H.lockOn(op.target || op.eid || op.as);
      else if (op.op === 'despawn') H.despawn(op.eid || op.as);
    }
    if (s.warmup > 0) H.stepFrames(s.warmup);
    H.queueInputs(s.inputs);
    H.traceStart(s.trace);
    return { frame: H.getFrame(), seed: H.getSeed() };
  }, spec);

  for (const n of chunks) {
    if (o.sleepMsBetweenChunks) await new Promise((r) => setTimeout(r, o.sleepMsBetweenChunks));
    const recs = await handle.page.evaluate((k) => {
      window.__HARNESS.stepFrames(k);
      return window.__HARNESS.traceDrain();
    }, n);
    parts.push(...recs);
  }
  const tail = await handle.page.evaluate(() => window.__HARNESS.traceStop());
  parts.push(...tail);

  const h = crypto.createHash('sha256');
  for (const r of parts) h.update(JSON.stringify(r) + '\n');
  return { hash: h.digest('hex'), records: parts, startFrame: setupRes.frame };
}

function rung(id, property, pass, evidence) {
  report.rungs.push({ id, property, pass, evidence });
  log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${property}`);
  for (const [k, v] of Object.entries(evidence)) log(`        ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return pass;
}

try {
  // ---- R1: run to run, same process ---------------------------------------------------
  const a = await run({});
  const b = await run({});
  rung('R1', 'run-to-run identical', a.hash === b.hash, { run_a: a.hash, run_b: b.hash, frames: a.records.length });

  // ---- R2: fresh JS realm (page reload) ------------------------------------------------
  const c = await run({ freshRealm: true });
  rung('R2', 'process-to-process identical (fresh realm; see note for the OS-process check)',
    a.hash === c.hash, {
      run_a: a.hash, fresh_realm: c.hash,
      os_process_check: `node tools/harness/trace.mjs --scenario ${scenario.id} --out reports/runs/DET-A  (twice, compare body_sha256)`,
    });

  // ---- R3: batch invariance -------------------------------------------------------------
  const d1 = await run({ chunk: 1, frames: Math.min(FRAMES, 600) });
  const dN = await run({ chunk: Math.min(FRAMES, 600), frames: Math.min(FRAMES, 600) });
  const d60 = await run({ chunk: 60, frames: Math.min(FRAMES, 600) });
  rung('R3', 'batch-invariant: stepFrames(1)xN == stepFrames(N)x1 == stepFrames(60)xM',
    d1.hash === dN.hash && d1.hash === d60.hash,
    { chunk_1: d1.hash, chunk_N: dN.hash, chunk_60: d60.hash, frames: d1.records.length });

  // ---- R4: seed sensitivity ---------------------------------------------------------------
  const s2 = await run({ seed: SEED2 });
  let differing = 0;
  const n = Math.min(a.records.length, s2.records.length);
  for (let i = 0; i < n; i++) if (JSON.stringify(a.records[i]) !== JSON.stringify(s2.records[i])) differing++;
  const pct = n ? (differing / n) * 100 : 0;
  rung('R4', 'seed-sensitive: different seed diverges, >=5% of frames differ',
    a.hash !== s2.hash && pct >= 5,
    { seed_a: SEED, hash_a: a.hash, seed_b: SEED2, hash_b: s2.hash, frames_differing_pct: +pct.toFixed(2) });

  // ---- R5: warm-up invariance ----------------------------------------------------------------
  const w30 = await run({ warmup: 30, frames: 600 });
  const w90 = await run({ warmup: 90, frames: 600 });
  // RI-MTH02 R5's literal procedure: "Re-base `f` by subtracting the first frame index in
  // each, drop the `rng.draws` field, and compare the remaining records."
  const rebaseLiteral = (recs) => {
    const f0 = recs[0].f;
    return recs.map((r) => {
      const c2 = JSON.parse(JSON.stringify(r));
      c2.f -= f0; c2.t_ms = null; delete c2.rng;
      for (const ev of c2.events || []) { ev.f -= f0; }
      return c2;
    });
  };
  const r30 = rebaseLiteral(w30.records), r90 = rebaseLiteral(w90.records);
  // Census: WHICH fields differ, not just whether any do. A verdict needs the field name.
  const fieldDiffs = new Map();
  const walk = (x, y, path) => {
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], path ? `${path}.${k}` : k);
      return;
    }
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
      for (let i = 0; i < x.length; i++) walk(x[i], y[i], `${path}[]`);
      return;
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) fieldDiffs.set(path, (fieldDiffs.get(path) || 0) + 1);
  };
  const nCmp = Math.min(r30.length, r90.length);
  for (let i = 0; i < nCmp; i++) walk(r30[i], r90[i], '');
  const differingFields = [...fieldDiffs.keys()].sort();
  const playerOnly = differingFields.filter((p) => p.startsWith('player') || p.startsWith('input') || p.startsWith('camera') || p.startsWith('events'));
  rung('R5', 'warm-up-invariant: scripted-window records identical after re-basing f',
    differingFields.length === 0, {
      warmup_30_frames: r30.length, warmup_90_frames: r90.length,
      differing_fields: differingFields,
      differing_fields_outside_the_enemy_block: playerOnly,
      note: playerOnly.length === 0 && differingFields.length > 0
        ? 'Every differing field is in the enemy block, and both are warm-up-dependent BY CONSTRUCTION: enemies[].state_entered_f is an absolute frame index that the item does not re-base, and enemies[].anim_frame is the phase of a looping idle animation, which genuinely differs when the entity has been idling for 60 more frames. See orchestration/amendments/AM-W1-00-01-mth02-r5.md.'
        : undefined,
    });

  // ---- R6: load order -----------------------------------------------------------------------
  const lo1 = await run({ loadOrder: 'seed-then-load' });
  const lo2 = await run({ loadOrder: 'seed-then-load' });
  const lo3 = await run({ loadOrder: 'load-then-seed' });
  rung('R6', 'load-order documented and reproducible: setSeed -> loadState is authoritative',
    lo1.hash === lo2.hash,
    {
      documented_order: 'setSeed() then loadState() — HARNESS.md D6, implemented in tools/lib/run.mjs',
      seed_then_load: lo1.hash, seed_then_load_again: lo2.hash, load_then_seed: lo3.hash,
      note: 'load-then-seed is NOT the documented order; its hash is printed for information only.',
    });

  // ---- R7: wall-clock invariance ----------------------------------------------------------------
  const slow = await run({ chunk: Math.ceil(FRAMES / 4), sleepMsBetweenChunks: 800 });
  rung('R7', 'wall-clock-invariant: host sleeps between chunks change nothing',
    a.hash === slow.hash, { normal: a.hash, with_800ms_sleeps: slow.hash });

  // ---- R8: resolution invariance --------------------------------------------------------------
  const small = await run({ viewport: { width: 640, height: 360 } });
  await handle.page.setViewportSize({ width: 1920, height: 1080 });
  rung('R8', 'resolution-invariant: the simulation does not know the viewport size',
    a.hash === small.hash, { at_1920x1080: a.hash, at_640x360: small.hash });

  // ---- R9: save round trip ------------------------------------------------------------------
  const rt = await handle.page.evaluate(async (s) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    H.setSeed(s.seed); H.loadState(s.state);
    H.stepFrames(600);
    const hash0 = H.getStateHash();
    const blob = H.saveState();
    const control = (() => {
      H.traceStart(s.trace);
      H.stepFrames(600);
      const recs = H.traceStop();
      return recs;
    })();
    // Fresh session from the blob, then the identical 600 frames.
    H.loadState(JSON.parse(JSON.stringify(blob)));
    const hash1 = H.getStateHash();
    H.traceStart(s.trace);
    H.stepFrames(600);
    const loaded = H.traceStop();
    return {
      hash0, hash1, roundTrip: H.saveRoundTrip(),
      controlJson: control.map((r) => { const c = JSON.parse(JSON.stringify(r)); c.f = null; c.t_ms = null; return JSON.stringify(c); }),
      loadedJson: loaded.map((r) => { const c = JSON.parse(JSON.stringify(r)); c.f = null; c.t_ms = null; return JSON.stringify(c); }),
    };
  }, { seed: SEED, state: scenario.state || 'default', trace: scenario.trace });

  const cH = crypto.createHash('sha256'); for (const l of rt.controlJson) cH.update(l + '\n');
  const lH = crypto.createHash('sha256'); for (const l of rt.loadedJson) lH.update(l + '\n');
  const cd = cH.digest('hex'), ld = lH.digest('hex');
  rung('R9', 'save round trip: state hash equal, and the next 600 frames match the control',
    rt.hash0 === rt.hash1 && cd === ld && rt.roundTrip.diff.length === 0,
    {
      state_hash_before: rt.hash0, state_hash_after: rt.hash1,
      round_trip_equal: rt.roundTrip.equal, round_trip_diff_fields: rt.roundTrip.diff.length,
      round_trip_diff: rt.roundTrip.diff.slice(0, 10),
      canonical_bytes: rt.roundTrip.canonical_bytes,
      control_tail_sha256: cd, loaded_tail_sha256: ld,
    });

  // ---- guard report --------------------------------------------------------------------------
  const det = await handle.page.evaluate(() => window.__HARNESS.getDeterminismReport());
  report.guards = det;
  log(`guard violations this session: ${det.violations}`);
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.rungs.every((r) => r.pass) && report.page_errors.length === 0;
report.rungs_passed = report.rungs.filter((r) => r.pass).map((r) => r.id);
report.rungs_failed = report.rungs.filter((r) => !r.pass).map((r) => r.id);
writeJson(path.join(outDir, 'determinism.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'determinism.json') + '\n');
log(`ladder: ${report.rungs_passed.length}/${report.rungs.length} rungs pass`);
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
