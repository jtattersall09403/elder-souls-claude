#!/usr/bin/env node
// seed-sweep.mjs — the instrument the W1-00 remediation exists to make possible.
//
// Both of that piece's hard fails were INVISIBLE under the corpus default seed 1337:
//
//   * `RI-JRN05` M1/HF1 — `getStateHash()` differed across a save round trip for every seed
//     whose PRNG state words were negative as int32, i.e. ~90% of seeds. 1337 was one of the
//     two seeds in twenty that happened to be all-positive, so every single-seed instrument
//     in the repository reported PASS.
//   * `RI-MTH02` R4 — the seed reached nothing, and the rung's frame-difference clause was
//     satisfied by the trace echoing its own seed back.
//
// The lesson is not "fix three integers". It is that a single-seed test cannot detect a
// seed-dependent bug, so this tool sweeps. It is deliberately independent of
// determinism.mjs and save-audit.mjs: it re-derives the round-trip diff host-side from
// saveState()'s own bytes rather than trusting the game's `saveRoundTrip()`.
//
// USAGE
//   node tools/harness/seed-sweep.mjs [--seeds 20] [--states arena_flat,swamp_canopy]
//                                     [--frames 240] [--out reports/runs/SEED-SWEEP]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
seed-sweep.mjs — sweep seeds over the two properties a single seed cannot check.

USAGE
  node tools/harness/seed-sweep.mjs [options]

OPTIONS
  --seeds <n>       How many seeds (default 20). 1337 and 60606 are always included: they
                    are the two the W1-00 critic found passing by luck, so a sweep that
                    dropped them would be weaker than the one that found the bug.
  --states <list>   Comma-separated named states (default arena_flat,swamp_canopy)
  --frames <n>      Frames stepped before saving (default 240)
  --scenario-frames <n>  Frames per R4 trace (default 600)
  --out <dir>       Output directory (default reports/runs/SEED-SWEEP)
  --json            Print the report on stdout
  --help            This message

CHECKS
  A. save round trip     getStateHash() before vs after loadState(saveState()), per seed and
                         state, PLUS a second trip (to catch "unstable once, stable after").
                         The rng.* words are compared as raw values, so a signed/unsigned
                         representation flip is a FAIL, not a rounding note.
  B. seed sensitivity    per seed pair (s[i] vs s[0]): frames differing in a field OTHER than
                         rng.seed, and max(rng.draws). AM-W1-00-C1's discriminator, swept.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const N_SEEDS = Number(args.seeds || 20);
const STATES = String(args.states || 'arena_flat,swamp_canopy').split(',').map((s) => s.trim()).filter(Boolean);
const FRAMES = Number(args.frames || 240);
const SCN_FRAMES = Number(args['scenario-frames'] || 600);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'SEED-SWEEP');
ensureDir(outDir);

// A spread of seeds, deterministic in itself, plus the two known-lucky ones.
const seeds = [1337, 60606];
for (let i = 0; seeds.length < N_SEEDS; i++) {
  const s = (i * 7919 + 104729) >>> 0;
  if (!seeds.includes(s)) seeds.push(s);
}

const handle = await launchGame(args);
const report = {
  schema: 'elder-souls/seed-sweep@1',
  seeds, states: STATES, frames_before_save: FRAMES, scenario_frames: SCN_FRAMES,
  round_trip: { trials: [], first_trip_mismatches: 0, second_trip_mismatches: 0, seeds_failing: [] },
  seed_sensitivity: { pairs: [], min_pct_differing_excluding_rng_seed: null, min_max_rng_draws: null },
};

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));

  // ---- A. save round trip, every seed x every state ------------------------------------
  for (const seed of seeds) {
    for (const state of STATES) {
      const t = await handle.page.evaluate(async (o) => {
        const H = window.__HARNESS;
        await H.ready();
        H.setRenderRate(0);
        H.setSeed(o.seed);
        H.loadState(o.state);
        H.stepFrames(o.frames);
        const h0 = H.getStateHash();
        const blob0 = JSON.parse(JSON.stringify(H.saveState()));
        H.loadState(JSON.parse(JSON.stringify(blob0)));
        const h1 = H.getStateHash();
        const blob1 = JSON.parse(JSON.stringify(H.saveState()));
        H.loadState(JSON.parse(JSON.stringify(blob1)));
        const h2 = H.getStateHash();
        return { h0, h1, h2, rng0: blob0.rng, rng1: blob1.rng };
      }, { seed, state, frames: FRAMES });
      const trial = {
        seed, state,
        first_trip_equal: t.h0 === t.h1,
        second_trip_equal: t.h1 === t.h2,
        hash_before: t.h0, hash_after: t.h1, hash_after_2: t.h2,
        rng_words_live: t.rng0, rng_words_roundtripped: t.rng1,
        rng_words_all_uint32: [t.rng0.a, t.rng0.b, t.rng0.c, t.rng0.d].every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff),
      };
      if (!trial.first_trip_equal) { report.round_trip.first_trip_mismatches++; report.round_trip.seeds_failing.push(`${seed}/${state}`); }
      if (!trial.second_trip_equal) report.round_trip.second_trip_mismatches++;
      report.round_trip.trials.push(trial);
    }
  }
  const nTrials = report.round_trip.trials.length;
  log(`A. save round trip: ${nTrials - report.round_trip.first_trip_mismatches}/${nTrials} first trips hash-stable, ` +
      `${nTrials - report.round_trip.second_trip_mismatches}/${nTrials} second trips`);

  // ---- B. seed sensitivity, every seed against the first --------------------------------
  const traceFor = (seed) => handle.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.setSeed(o.seed);
    H.loadState('arena_flat');
    H.teleport(0, 0);
    H.spawn('inf_trash', 0, 7, { as: 'e0' });
    H.lockOn('e0');
    H.stepFrames(30);
    H.reanchorFreeRunning();
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 90, move: [0, 0] }, { f: 100, press: ['light'] }, { f: 103, release: ['light'] }]);
    H.traceStart({ enemies: true, hitboxes: true, events: true });
    H.stepFrames(o.frames);
    return H.traceStop();
  }, { seed, frames: SCN_FRAMES });

  const base = await traceFor(seeds[0]);
  for (let i = 1; i < seeds.length; i++) {
    const other = await traceFor(seeds[i]);
    const n = Math.min(base.length, other.length);
    let differing = 0, maxDrawsA = 0, maxDrawsB = 0;
    const fields = new Map();
    for (let k = 0; k < n; k++) {
      const m = new Map();
      diffInto(base[k], other[k], '', m);
      m.delete('rng.seed');
      if (m.size) { differing++; for (const [p, c] of m) fields.set(p, (fields.get(p) || 0) + c); }
      maxDrawsA = Math.max(maxDrawsA, base[k].rng.draws);
      maxDrawsB = Math.max(maxDrawsB, other[k].rng.draws);
    }
    const pct = n ? +(differing / n * 100).toFixed(2) : 0;
    report.seed_sensitivity.pairs.push({
      seed_a: seeds[0], seed_b: seeds[i], frames: n,
      pct_frames_differing_excluding_rng_seed: pct,
      max_rng_draws: { a: maxDrawsA, b: maxDrawsB },
      differing_fields: [...fields.keys()].sort(),
      passes_R4: pct >= 5 && maxDrawsA > 0 && maxDrawsB > 0,
    });
  }
  const pcts = report.seed_sensitivity.pairs.map((p) => p.pct_frames_differing_excluding_rng_seed);
  const draws = report.seed_sensitivity.pairs.flatMap((p) => [p.max_rng_draws.a, p.max_rng_draws.b]);
  report.seed_sensitivity.min_pct_differing_excluding_rng_seed = Math.min(...pcts);
  report.seed_sensitivity.min_max_rng_draws = Math.min(...draws);
  const pairsPassing = report.seed_sensitivity.pairs.filter((p) => p.passes_R4).length;
  log(`B. seed sensitivity: ${pairsPassing}/${report.seed_sensitivity.pairs.length} pairs pass R4 ` +
      `(min ${report.seed_sensitivity.min_pct_differing_excluding_rng_seed}% of frames differ outside rng.seed; ` +
      `min max(rng.draws) ${report.seed_sensitivity.min_max_rng_draws})`);
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

function diffInto(x, y, p, into) {
  if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) diffInto(x[k], y[k], p ? `${p}.${k}` : k, into);
    return;
  }
  if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
    for (let i = 0; i < x.length; i++) diffInto(x[i], y[i], `${p}[]`, into);
    return;
  }
  if (JSON.stringify(x) !== JSON.stringify(y)) into.set(p, (into.get(p) || 0) + 1);
}

report.pass = report.round_trip.first_trip_mismatches === 0
  && report.round_trip.second_trip_mismatches === 0
  && report.seed_sensitivity.pairs.every((p) => p.passes_R4)
  && report.page_errors.length === 0;
writeJson(path.join(outDir, 'seed-sweep.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'seed-sweep.json') + '\n');
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
