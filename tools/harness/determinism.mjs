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
    // Scenario contract: the scripted window opens on a warm-up-independent world. This
    // re-anchors free-running per-entity clocks and REPORTS what it changed (AM-W1-00-02).
    const reanchor = H.reanchorFreeRunning();
    H.queueInputs(s.inputs);
    H.traceStart(s.trace);
    return { frame: H.getFrame(), seed: H.getSeed(), reanchor };
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
  return { hash: h.digest('hex'), records: parts, startFrame: setupRes.frame, reanchor: setupRes.reanchor };
}

/**
 * Field-level census: WHICH paths differ, not just whether any do. A verdict needs the
 * field name. `skip` is a set of exact paths to ignore (R4 ignores `rng.seed`).
 * Accumulates into `into` (path -> count of frames in which it differed).
 */
function fieldDiff(a, b, into, skip = new Set()) {
  const walk = (x, y, p) => {
    if (skip.has(p)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p ? `${p}.${k}` : k);
      return;
    }
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
      for (let i = 0; i < x.length; i++) walk(x[i], y[i], `${p}[]`);
      return;
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) into.set(p, (into.get(p) || 0) + 1);
  };
  walk(a, b, '');
  return into;
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
  // AM-W1-00-C1 (filed by the W1-00 critic, adopted here). The rung as originally written
  // counted a frame as "differing" if ANY field differed — including `rng.seed`, which is a
  // pure function of the independent variable and therefore differs on 100% of frames in
  // ANY build, including one whose PRNG is never drawn from. That is exactly what this build
  // was: `rng.draws == 0` on every frame, R4 reported PASS at 100%, and the seed reached
  // nothing. Two changes, neither of which moves a threshold:
  //   1. `.rng.seed` is dropped before the frame-difference count;
  //   2. the rung fails with reason `prng_never_drawn` when max(rng.draws) == 0 in either
  //      run — a scenario that never draws cannot demonstrate seed sensitivity at all.
  const s2 = await run({ seed: SEED2 });
  const stripSeedEcho = (r) => {
    // Structured clone minus the one tautological field. Everything else is compared.
    const c = JSON.parse(JSON.stringify(r));
    if (c.rng) delete c.rng.seed;
    return JSON.stringify(c);
  };
  let differing = 0;
  const fieldsR4 = new Map();
  const n = Math.min(a.records.length, s2.records.length);
  for (let i = 0; i < n; i++) {
    if (stripSeedEcho(a.records[i]) !== stripSeedEcho(s2.records[i])) {
      differing++;
      fieldDiff(a.records[i], s2.records[i], fieldsR4, new Set(['rng.seed']));
    }
  }
  const pct = n ? (differing / n) * 100 : 0;
  const maxDrawsA = a.records.reduce((m, r) => Math.max(m, (r.rng && r.rng.draws) || 0), 0);
  const maxDrawsB = s2.records.reduce((m, r) => Math.max(m, (r.rng && r.rng.draws) || 0), 0);
  const drawn = maxDrawsA > 0 && maxDrawsB > 0;
  rung('R4', 'seed-sensitive: different seed diverges, >=5% of frames differ in a field OTHER than rng.seed, and the PRNG is actually drawn from',
    a.hash !== s2.hash && pct >= 5 && drawn,
    {
      seed_a: SEED, hash_a: a.hash, seed_b: SEED2, hash_b: s2.hash,
      frames_differing_pct_excluding_rng_seed: +pct.toFixed(2),
      max_rng_draws: { [SEED]: maxDrawsA, [SEED2]: maxDrawsB },
      reason: drawn ? undefined : 'prng_never_drawn',
      differing_fields_excluding_rng_seed: [...fieldsR4.keys()].sort(),
      note: 'AM-W1-00-C1: rng.seed is a pure function of the independent variable and is excluded from the count. Before this fix the same build reported 100% with max_rng_draws 0.',
    });

  // ---- R5: warm-up invariance ----------------------------------------------------------------
  const w30 = await run({ warmup: 30, frames: 600 });
  const w90 = await run({ warmup: 90, frames: 600 });
  // AM-W1-00-02. R5's literal procedure re-bases `f` and drops `rng.draws`. The trace
  // carries THREE absolute frame indices, not one — `f`, `events[].f` and
  // `enemies[].state_entered_f` — and the rung reaches only the first, so R5 failed on
  // arena_flat with NO ENEMY AT ALL, on `events[].f` alone (W1-00 verdict §2.2). All three
  // are named and re-based here. An index that refers to a moment BEFORE the window opened
  // re-bases negative and is normalised to the sentinel "pre-window": "it happened before
  // the window" is the only warm-up-independent fact about it, and the exact pre-window
  // index is a warm-up artefact by construction.
  //
  // NOTHING is excluded. In particular `enemies[].anim_frame` is compared, which is what
  // AM-W1-00-01 asked to exclude permanently; the fixture re-anchors it instead
  // (__HARNESS.reanchorFreeRunning(), called by run() after warm-up).
  const ABSOLUTE_FRAME_INDICES = ['f', 'events[].f', 'enemies[].state_entered_f'];
  const rebase = (recs) => {
    const f0 = recs[0].f;
    const norm = (v) => (typeof v === 'number' ? (v - f0 < 0 ? 'pre-window' : v - f0) : v);
    return recs.map((r) => {
      const c2 = JSON.parse(JSON.stringify(r));
      c2.f = norm(c2.f); c2.t_ms = null; delete c2.rng;
      for (const ev of c2.events || []) ev.f = norm(ev.f);
      for (const en of c2.enemies || []) en.state_entered_f = norm(en.state_entered_f);
      return c2;
    });
  };
  const r30 = rebase(w30.records), r90 = rebase(w90.records);
  const fieldDiffs = new Map();
  const nCmp = Math.min(r30.length, r90.length);
  for (let i = 0; i < nCmp; i++) fieldDiff(r30[i], r90[i], fieldDiffs);
  const differingFields = [...fieldDiffs.keys()].sort();
  const playerOnly = differingFields.filter((p) => p.startsWith('player') || p.startsWith('input') || p.startsWith('camera') || p.startsWith('events'));
  rung('R5', 'warm-up-invariant: scripted-window records identical after re-basing every absolute frame index',
    differingFields.length === 0, {
      warmup_30_frames: r30.length, warmup_90_frames: r90.length,
      absolute_frame_indices_rebased: ABSOLUTE_FRAME_INDICES,
      fields_excluded_from_the_comparison: ['rng (R5 drops rng.draws; the whole block is dropped because rng.seed is identical between the two runs anyway)'],
      differing_fields: differingFields,
      differing_fields_outside_the_enemy_block: playerOnly,
      window_reanchor: w30.reanchor,
      note: 'enemies[].anim_frame IS compared. See orchestration/amendments/AM-W1-00-02-mth02-r5-absolute-frame-indices.md, which withdraws and replaces AM-W1-00-01.',
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
  // TWO holes in this rung cost the project a hard fail, and both are closed here.
  //
  //  1. It ran the bare named state and NEVER RAN THE SCENARIO'S SETUP, so there was no
  //     entity in the world it round-tripped. `enemies[].prev_state` was missing from the
  //     save; a rung with no enemy in it cannot see a missing enemy field. The scenario's
  //     setup ops and its input script now both run, and the rung asserts that the world it
  //     measured actually contained an entity.
  //  2. It compared ONE sha256 of the two 600-frame tails. When those hashes differ, "they
  //     differ" is not a finding — the FIELD NAME is. The full field census now runs on
  //     every R9 comparison and the differing names and counts are in the evidence, pass or
  //     fail. The round-1 verdict recorded M5 as passing on a build that diverged on 219 of
  //     600 frames in one named field; a rung that prints the name cannot do that again.
  const rt = await handle.page.evaluate(async (s) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const preroll = () => {
      H.setSeed(s.seed); H.loadState(s.state);
      // A save round trip with no entity in it cannot see a missing entity field, and that
      // is not a hypothetical: it is why this rung passed while `enemies[].prev_state` was
      // absent from the save. If the scenario spawns nothing, the rung spawns one itself and
      // says so in the evidence, rather than testing an empty world and calling it a pass.
      if (!s.setup.some((op) => op.op === 'spawn')) H.spawn('inf_trash', 0, 7, { as: 'r9probe' });
      for (const op of s.setup) {
        if (op.op === 'teleport') H.teleport(op.x, op.z, op.opts || {});
        else if (op.op === 'spawn') H.spawn(op.id, op.x, op.z, { as: op.as });
        else if (op.op === 'aggro') H.aggro(op.target || op.eid || op.as);
        else if (op.op === 'lockOn') H.lockOn(op.target || op.eid || op.as);
        else if (op.op === 'despawn') H.despawn(op.eid || op.as);
      }
      H.clearInputs(); H.queueInputs(s.inputs);
      H.stepFrames(s.preroll);
    };
    // Both sides get the IDENTICAL pre-roll, so the only difference between them is the
    // save and the load. (Round 1's version ran the pre-roll once and compared a session
    // against its own continuation.)
    preroll();
    const hash0 = H.getStateHash();
    const entitiesAtSave = H.listEntities().length;
    const blob = JSON.parse(JSON.stringify(H.saveState()));
    const roundTrip = H.saveRoundTrip();

    preroll();
    H.clearInputs(); H.queueInputs(s.inputs);
    H.traceStart(s.trace); H.stepFrames(600);
    const control = H.traceStop();

    preroll();
    H.loadState(JSON.parse(JSON.stringify(blob)));
    const hash1 = H.getStateHash();
    H.clearInputs(); H.queueInputs(s.inputs);
    H.traceStart(s.trace); H.stepFrames(600);
    const loaded = H.traceStop();

    preroll();
    const census = H.getDurableFieldCensus();
    return { hash0, hash1, roundTrip, control, loaded, census, entitiesAtSave };
  }, {
    seed: SEED, state: scenario.state || 'default', trace: scenario.trace,
    setup: scenario.setup, inputs: scenario.inputs, preroll: Math.max(30, scenario.warmupFrames || 120),
  });

  // The loaded run's frame indices are offset from the control's by the pre-roll, so the
  // three absolute indices are re-based exactly as R5 re-bases them. NOTHING else is
  // normalised: `rng` is compared, because a restarted draw counter is what M5 exists to
  // catch, and `enemies[].anim_frame` is compared, because a re-drawn idle phase is what
  // `anim_phase0` exists to prevent.
  const rebaseTail = (recs) => {
    const f0 = recs[0].f;
    return recs.map((r) => {
      const c2 = JSON.parse(JSON.stringify(r));
      c2.f -= f0; c2.t_ms = null;
      for (const ev of c2.events || []) if (typeof ev.f === 'number') ev.f -= f0;
      for (const en of c2.enemies || []) {
        if (typeof en.state_entered_f === 'number') en.state_entered_f = en.state_entered_f < f0 ? 'pre-window' : en.state_entered_f - f0;
      }
      return c2;
    });
  };
  const ctlRecs = rebaseTail(rt.control), loadRecs = rebaseTail(rt.loaded);
  const r9Fields = new Map();
  const nR9 = Math.min(ctlRecs.length, loadRecs.length);
  for (let i = 0; i < nR9; i++) fieldDiff(ctlRecs[i], loadRecs[i], r9Fields);
  const r9Differing = [...r9Fields.entries()].sort().map(([k, v]) => `${k} (${v} frames)`);
  const cH = crypto.createHash('sha256'); for (const r of ctlRecs) cH.update(JSON.stringify(r) + '\n');
  const lH = crypto.createHash('sha256'); for (const r of loadRecs) lH.update(JSON.stringify(r) + '\n');
  const cd = cH.digest('hex'), ld = lH.digest('hex');

  // R9 SWEEPS. This is the direct lesson of the W1-00 verdict: the round trip failed on 36
  // of 40 seeds and this rung reported PASS, because it ran the corpus default seed 1337 —
  // one of the only two seeds in twenty whose PRNG state words are all positive as int32.
  // A rung that can only be checked at one seed is a rung that cannot see a seed-dependent
  // defect, so it is checked at several. `tools/harness/seed-sweep.mjs` does the wide sweep;
  // this is the ladder's own tripwire.
  const R9_SEEDS = [SEED, SEED2, 104729, 112648, 4711];
  const sweep = [];
  for (const s of R9_SEEDS) {
    sweep.push(await handle.page.evaluate(async (o) => {
      const H = window.__HARNESS;
      H.setRenderRate(0);
      H.setSeed(o.seed); H.loadState(o.state);
      H.stepFrames(240);
      const h0 = H.getStateHash();
      H.loadState(JSON.parse(JSON.stringify(H.saveState())));
      return { seed: o.seed, equal: h0 === H.getStateHash(), before: h0, after: H.getStateHash() };
    }, { seed: s, state: scenario.state || 'default' }));
  }
  const sweepFails = sweep.filter((r) => !r.equal);

  rung('R9', 'save round trip: state hash equal at EVERY swept seed, and the next 600 frames match the control FIELD BY FIELD',
    rt.hash0 === rt.hash1 && cd === ld && r9Differing.length === 0 && rt.roundTrip.diff.length === 0
      && sweepFails.length === 0 && rt.entitiesAtSave > 0 && rt.census.ok,
    {
      state_hash_before: rt.hash0, state_hash_after: rt.hash1,
      entities_in_the_world_at_the_save_point: rt.entitiesAtSave,
      entity_spawned_by_the_rung: !((scenario.setup || []).some((op) => op.op === 'spawn')),
      post_load_frames_compared: nR9,
      post_load_differing_fields: r9Differing,
      durable_field_census_ok: rt.census.ok,
      durable_field_census_unaccounted: rt.census.unaccounted,
      entity_keys_live_not_declared: rt.census.entity_keys.live_not_declared_anywhere,
      round_trip_equal: rt.roundTrip.equal, round_trip_diff_fields: rt.roundTrip.diff.length,
      round_trip_diff: rt.roundTrip.diff.slice(0, 10),
      canonical_bytes: rt.roundTrip.canonical_bytes,
      control_tail_sha256: cd, loaded_tail_sha256: ld,
      seed_sweep: `${sweep.length - sweepFails.length}/${sweep.length} seeds hash-stable`,
      seed_sweep_seeds: R9_SEEDS,
      seed_sweep_failures: sweepFails,
      wide_sweep: 'node tools/harness/seed-sweep.mjs — 20 seeds x 2 states, both trips',
      field_level_sweep: 'node tools/journey/state-diff.mjs — RI-JRN05 M1/M2/M4/M5 across states x seeds, with the differing field names',
      note: 'The rung runs the SCENARIO (setup ops and input script), not a bare named state: the version that reported PASS while enemies[].prev_state was missing from the save had no entity in the world it round-tripped, and compared one hash instead of the field set.',
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
