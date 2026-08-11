#!/usr/bin/env node
// state-diff.mjs — RI-JRN05's round-trip instrument, named by the item (§ "Instruments",
// line 213) and absent until now: the W1-00 round-2 critic verified its absence.
//
// It measures four things and prints the FIELD NAMES for every one of them:
//
//   M1  round-trip hash        getStateHash() before and after saveState()->loadState()
//   M2  round-trip field diff  the field-level diff, excluding only manifest-declared volatile
//   M4  manifest completeness  set difference in BOTH directions, plus the entity RECORD's
//                              field set (which M4's path-level check cannot see inside)
//   M5  divergence after load  identical pre-roll on both sides, identical 600-frame script,
//                              same seed, control vs loaded — full field diff, not one hash
//
// WHY THIS TOOL EXISTS, stated so it is not re-litigated. Round 1 of this piece reported M5
// as PASSING. It was not passing: `enemies[].prev_state` was absent from the save and the
// control and loaded traces differed on 219 of 600 frames. The check went green because it
// compared ONE HASH of a window in which the field happened not to differ, and because the
// ladder's own R9 ran a bare named state with no entity in it at all. A round-trip check
// that compares a single hash is how a 219-frame divergence passes a critic. This one:
//
//   * compares every field of every frame and reports the differing NAMES and counts;
//   * spawns entities, aggros them, hits them and rolls, so the world at the save point has
//     entity state, hit-dedupe state, stagger state and hitstop in it;
//   * runs at several seeds, because the last save defect this project shipped was visible
//     at 36 seeds out of 40 and invisible at the corpus default;
//   * runs __HARNESS.getDurableFieldCensus(), which diffs the LIVE simulation across a save
//     and a load and needs no declaration to be right.
//
// Exit 0 only if every trial is clean. Exit 20 (MEASUREMENT_FAIL) otherwise.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
state-diff.mjs — RI-JRN05 M1/M2/M4/M5 with field-level evidence.

USAGE
  node tools/journey/state-diff.mjs [--seeds 4711,1337,90210] [--states arena_flat,sv1-midquest]
                                    [--frames 600] [--preroll 120] [--json]

OPTIONS
  --mode <m>        'round-trip' (RI-JRN05, default) or 'across-death' (RI-JRN06 M-D4)
  --in <dir>        a journey-run output directory to cross-check against (across-death)
  --seeds <a,b,c>   Seeds to sweep (default 4711,1337,90210,2147483647)
  --states <a,b>    Named states to run (default sv1-midquest,sv2-mid-dungeon,sv3-post-rank-up,sv4-bounty-pursuit,sv5-journal-bloodstain)
  --frames <n>      Scripted window after the save point (default 600, the item's own)
  --preroll <n>     Frames run IDENTICALLY on both sides before the save (default 120)
  --out <dir>       Where to write state-diff.json (default reports/runs/STATE-DIFF)
  --json            Print the whole report on stdout
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const SEEDS = String(args.seeds || '4711,1337,90210,2147483647').split(',').map((s) => Number(s.trim()));
const STATES = String(args.states || 'sv1-midquest,sv2-mid-dungeon,sv3-post-rank-up,sv4-bounty-pursuit,sv5-journal-bloodstain').split(',').map((s) => s.trim());
const FRAMES = Number(args.frames || 600);
const PREROLL = Number(args.preroll || 120);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'STATE-DIFF');
ensureDir(outDir);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fsExists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

/** Flatten to leaf paths, with array indices collapsed so a field name is a field name. */
function flat(o, p, acc) {
  if (o === null || typeof o !== 'object') { acc[p] = o; return acc; }
  if (Array.isArray(o)) {
    if (!o.length) { acc[p] = '[]'; return acc; }
    o.forEach((x, i) => flat(x, `${p}[${i}]`, acc));
    return acc;
  }
  const ks = Object.keys(o);
  if (!ks.length) { acc[p] = '{}'; return acc; }
  for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, acc);
  return acc;
}

/**
 * Re-base the two absolute frame indices the trace carries, exactly as RI-MTH02 R5 does:
 * loadState() resets the frame to 0 (RI-MTH01 A07), so the loaded run's indices are offset
 * from the control's by the pre-roll length. Nothing else is normalised and nothing is
 * dropped except `t_ms` (a pure function of `f`) — in particular `rng` IS compared, because
 * a restarted draw counter is precisely what M5 exists to catch.
 */
function rebase(recs) {
  const o = recs[0].f;
  return recs.map((x) => {
    const c = JSON.parse(JSON.stringify(x));
    c.f -= o;
    delete c.t_ms;
    for (const e of c.events || []) if (typeof e.f === 'number') e.f -= o;
    for (const e of c.enemies || []) {
      if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < o ? 'pre-window' : e.state_entered_f - o;
    }
    return c;
  });
}

function fieldCensus(A, B) {
  const n = Math.min(A.length, B.length);
  const fields = {};
  let first = null;
  for (let i = 0; i < n; i++) {
    const a = flat(A[i], '', {}), b = flat(B[i], '', {});
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        const nk = k.replace(/\[\d+\]/g, '[]');
        fields[nk] = (fields[nk] || 0) + 1;
        if (!first) first = { frame: i, field: nk, control: a[k] === undefined ? null : a[k], loaded: b[k] === undefined ? null : b[k] };
      }
    }
  }
  return { frames: n, fields, first };
}

// =================================================================================================
// --mode across-death — RI-JRN06 M-D4, ADDED by W1-13.
//
// RI-JRN06's Comparison method names this file and this flag:
//     node tools/journey/state-diff.mjs --in reports/journeys/<runId> --mode across-death
// and says why: "the across-death diff is the same instrument as RI-JRN05's round-trip diff,
// pointed at a different transition". Neither flag was implemented and both were silently
// ignored — the run answered the RI-JRN05 question and exited 0, which is a flag that lies
// (TOOL-LOOP rule 3, question 5).
//
// The transition is: state hash + full save blob immediately before the killing blow, and
// immediately after respawn, with the `death-volatile` group excluded BY NAME. Anything else
// that moved is HF2 and a seam-S6 failure.
// =================================================================================================
const MODE = String(args.mode || 'round-trip');
if (!['round-trip', 'across-death'].includes(MODE)) {
  log(`--mode must be 'round-trip' (RI-JRN05, the default) or 'across-death' (RI-JRN06 M-D4); got ${JSON.stringify(MODE)}`);
  process.exit(EXIT.USAGE);
}

if (MODE === 'across-death') {
  const { DEATH_VOLATILE } = await import('./jrn06-death.mjs');
  const inDir = args.in ? path.resolve(String(args.in)) : null;
  const handle = await launchGame(args);
  const rep = {
    schema: 'elder-souls/state-diff@1', mode: 'across-death',
    item: 'RI-JRN06 M-D4 (with RI-JRN05 as the instrument)',
    death_volatile_group: DEATH_VOLATILE, seeds: SEEDS, trials: [],
  };
  try {
    await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
    await handle.page.evaluate(() => window.__HARNESS.ready());
    const present = await handle.page.evaluate(() => typeof window.__HARNESS.getDeathState === 'function');
    if (!present) {
      log('across-death: __HARNESS.getDeathState() is absent. There is no death loop to diff across.');
      rep.unmeasurable = 'no death system in the build';
      writeJson(path.join(outDir, 'state-diff-across-death.json'), rep);
      await handle.close();
      process.exit(EXIT.MEASUREMENT_FAIL);
    }
    for (const seed of SEEDS) {
      const t = await handle.page.evaluate(async (o) => {
        const H = window.__HARNESS;
        H.setRenderRate(0);
        H.setSeed(o.seed);
        H.loadState('default');
        const hs = H.listHearths();
        const hr = hs.hearths.find((x) => x.kind === 'settlement') || hs.hearths[0];
        H.teleport(hr.pos[0], hr.pos[2]); H.stepFrames(2);
        H.restAt(hr.id);
        // Real state at the death point: a mutated world, a bank of souls, an entity alive
        // and one killed. A death diffed over an empty world proves nothing about a death.
        const b0 = H.saveState();
        b0.character.souls_held = 4200;
        b0.world.containers_emptied = ['chest:a', 'chest:b'];
        b0.world.doors_unlocked = ['door:a'];
        b0.world.shortcuts_opened = ['short:a'];
        b0.world.npcs_dead = ['warden-eshi'];
        b0.world.fog_gates_passed = ['gate-ceyatatar-vault'];
        b0.flags = Object.assign({}, b0.flags, { 'across-death': true });
        b0.crime.bounty = { legion: 500 };
        b0.crime.witnesses = ['w1', 'w2'];
        b0.factions = Object.assign({}, b0.factions, { legion: { rank: 3, expelled: false } });
        b0.progression.souls_spent = 11240;
        H.restoreState(b0);
        H.teleport(hr.pos[0] + 55, hr.pos[2] + 22); H.stepFrames(6);
        const hashBefore = H.getStateHash();
        const before = JSON.parse(JSON.stringify(H.saveState()));
        H.damagePlayer(1e6, { stagger: false });
        H.stepFrames(1);
        H.stepFrames(220);
        const after = JSON.parse(JSON.stringify(H.saveState()));
        const hashAfter = H.getStateHash();
        return { hashBefore, hashAfter, before, after, death: H.getDeathState() };
      }, { seed });

      const A = flat(t.before, '', {}), B = flat(t.after, '', {});
      const isVol = (p) => DEATH_VOLATILE.some((v) => p === v || p.startsWith(v + '.') || p.startsWith(v + '[') || (v.endsWith('.') && p.startsWith(v)));
      const changed = [];
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
        if (JSON.stringify(A[k]) === JSON.stringify(B[k])) continue;
        changed.push({ path: k.replace(/\[\d+\]/g, '[]'), before: A[k] === undefined ? null : A[k], after: B[k] === undefined ? null : B[k], volatile: isVol(k) });
      }
      const offend = changed.filter((c) => !c.volatile);
      const trial = {
        seed,
        hash_before: t.hashBefore, hash_after: t.hashAfter,
        souls_at_death: 4200,
        stain: t.death.bloodstain,
        changed_total: changed.length,
        changed_volatile: changed.length - offend.length,
        changed_non_volatile: offend.length,
        offending_fields: offend.slice(0, 30),
        pass: offend.length === 0,
      };
      rep.trials.push(trial);
      log(`${trial.pass ? 'PASS' : 'FAIL'} across-death seed ${seed} — ${trial.changed_total} paths moved, ${trial.changed_volatile} of them death-volatile, ${offend.length} NOT: ${offend.slice(0, 6).map((o) => o.path).join(', ') || 'none'}`);
    }
    if (inDir && fsExists(path.join(inDir, 'journey.json'))) {
      rep.cross_check = { journey_run: path.join(inDir, 'journey.json'), note: 'RI-JRN06 M-D4 is also computed inside journey-run; the two must agree.' };
    }

    // ---- THE EXCLUSION LIST MUST STILL BE ABLE TO GO RED -----------------------------------
    //
    // ROUND 2 added eleven names to `DEATH_VOLATILE` — the player's own animation phase, weapon
    // sockets, stagger and actionability — because round 1's list named `pose.` but not the
    // `fight.*` block another piece had since added to the save, and 108 bone rotations were
    // being reported as seam-S6 violations. Widening an exclusion list is the single easiest way
    // to turn a red instrument green while changing nothing, so the widening is not allowed to
    // stand on the author's word: this control moves a path that is NOT in the list, in the same
    // window, and the run fails if the diff does not notice.
    //
    // The mutation is a bounty and a faction rank — a crime record and a standing, two of the
    // exact things HF2 exists to protect and neither of them anywhere near the group.
    {
      const t = await handle.page.evaluate(async () => {
        const H = window.__HARNESS;
        H.setRenderRate(0);
        H.loadState('default');
        const hs = H.listHearths();
        const hr = hs.hearths.find((x) => x.kind === 'settlement') || hs.hearths[0];
        H.teleport(hr.pos[0], hr.pos[2]); H.stepFrames(2);
        H.restAt(hr.id);
        const b0 = H.saveState();
        b0.character.souls_held = 4200;
        b0.crime.bounty = { legion: 500 };
        b0.factions = Object.assign({}, b0.factions, { legion: { rank: 3, expelled: false } });
        H.restoreState(b0);
        H.teleport(hr.pos[0] + 55, hr.pos[2] + 22); H.stepFrames(6);
        const before = JSON.parse(JSON.stringify(H.saveState()));
        H.damagePlayer(1e6, { stagger: false });
        H.stepFrames(1);
        // THE BREAK: something a death must never touch, moved WHILE the surface is up.
        //
        // The bounty is perturbed at `crime.ledger`, NOT at `crime.bounty`. The first attempt
        // moved `crime.bounty` and the diff did not see it — correctly: `crime.bounty` is a
        // PROJECTION that `sim.stealth.mirrorToSave()` rewrites from the ledger every frame, so
        // a hand-edit there is overwritten within one step and the control was measuring its own
        // mistake rather than the instrument. The ledger is the source and it survives.
        const mid = H.saveState();
        if (mid.crime.ledger) mid.crime.ledger.bounty = { imperial: 4000, settlement: {}, interior: 0 };
        mid.factions = Object.assign({}, mid.factions, { legion: { rank: 0, expelled: true } });
        mid.character.hp = 0;
        H.restoreState(mid);
        H.stepFrames(220);
        const after = JSON.parse(JSON.stringify(H.saveState()));
        return { before, after };
      });
      const A = flat(t.before, '', {}), B = flat(t.after, '', {});
      const isVol = (p) => DEATH_VOLATILE.some((v) => p === v || p.startsWith(v + '.') || p.startsWith(v + '[') || (v.endsWith('.') && p.startsWith(v)));
      const offend = [];
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
        if (JSON.stringify(A[k]) === JSON.stringify(B[k])) continue;
        if (!isVol(k)) offend.push({ path: k.replace(/\[\d+\]/g, '[]'), before: A[k] ?? null, after: B[k] ?? null });
      }
      const sawBounty = offend.some((o) => o.path.startsWith('crime.bounty'));
      const sawFaction = offend.some((o) => o.path.startsWith('factions'));
      rep.falsifiability = {
        what: 'a bounty and a faction rank moved across the death on purpose; neither is in DEATH_VOLATILE',
        non_volatile_paths_seen: offend.length,
        saw_the_bounty: sawBounty,
        saw_the_faction: sawFaction,
        sample: offend.slice(0, 8),
        instrument_goes_red: sawBounty && sawFaction,
      };
      log(`${rep.falsifiability.instrument_goes_red ? 'RED  ' : 'GREEN'} falsifiability control — ${offend.length} non-volatile paths seen (bounty ${sawBounty}, faction ${sawFaction})`);
    }
  } finally {
    rep.page_errors = handle.errors;
    await handle.close();
  }
  // A green run is only worth reading if the control went red. An exclusion list that swallows
  // a bounty and a faction rank is not an instrument, and this run must not exit 0 pretending
  // otherwise.
  rep.pass = rep.trials.every((t) => t.pass) && rep.page_errors.length === 0
    && !!(rep.falsifiability && rep.falsifiability.instrument_goes_red);
  writeJson(path.join(outDir, 'state-diff-across-death.json'), rep);
  if (args.json) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  else process.stdout.write(path.join(outDir, 'state-diff-across-death.json') + '\n');
  log(`${rep.trials.filter((t) => t.pass).length}/${rep.trials.length} deaths lost nothing outside the death-volatile group`);
  process.exit(rep.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
}

const handle = await launchGame(args);
const report = {
  schema: 'elder-souls/state-diff@1',
  mode: 'round-trip',
  item: 'RI-JRN05 M1/M2/M4/M5',
  seeds: SEEDS, states: STATES, frames: FRAMES, preroll_frames: PREROLL,
  trials: [],
};

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());

  for (const state of STATES) {
    for (const seed of SEEDS) {
      const t = await handle.page.evaluate(async (o) => {
        const H = window.__HARNESS;
        H.setRenderRate(0);
        // A pre-roll that leaves REAL state at the save point: two entities, one of them
        // aggroed and struck (so hit-dedupe, poise, stagger and hitstop are all live), the
        // player mid-locomotion, the camera turned. A save taken over an idle world proves
        // nothing about a save.
        const preroll = () => {
          H.setSeed(o.seed);
          H.loadState(o.state);
          H.teleport(0, 0);
          H.spawn('inf_trash', 0, 7, { as: 'sdA' });
          H.spawn('inf_trash', 3, 6, { as: 'sdB' });
          H.aggro('sdA');
          H.lockOn('sdA');
          H.clearInputs();
          H.queueInputs([
            { f: 0, move: [0, 1], look: [4, 1] },
            { f: 20, move: [0.4, 0.6] },
            { f: 40, press: ['light'] }, { f: 43, release: ['light'] },
            { f: 70, press: ['roll'] }, { f: 73, release: ['roll'] },
            { f: 100, move: [0, 0] },
          ]);
          H.stepFrames(o.preroll);
        };
        const script = [
          { f: 0, move: [0, 1] }, { f: 60, move: [0, 0] },
          { f: 70, press: ['light'] }, { f: 73, release: ['light'] },
          { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] },
          { f: 400, press: ['heavy'] }, { f: 422, release: ['heavy'] },
        ];

        // ---- the save point, and M1/M2/M4 taken on it ----------------------------------
        preroll();
        const hashBefore = H.getStateHash();
        const blob = JSON.parse(JSON.stringify(H.saveState()));
        const roundTrip = H.saveRoundTrip();
        const manifest = H.getSaveManifest().computed;

        // ---- M5(a): the never-saved control --------------------------------------------
        preroll();
        H.clearInputs(); H.queueInputs(script);
        H.traceStart(); H.stepFrames(o.frames);
        const control = H.traceStop();

        // ---- M5(b): identical pre-roll, then the save taken at the same point -----------
        preroll();
        H.loadState(JSON.parse(JSON.stringify(blob)));
        const hashAfterLoad = H.getStateHash();
        H.clearInputs(); H.queueInputs(script);
        H.traceStart(); H.stepFrames(o.frames);
        const loaded = H.traceStop();

        // ---- the live-object census (destructive; last) ---------------------------------
        preroll();
        const census = H.getDurableFieldCensus();

        return { hashBefore, hashAfterLoad, roundTrip, manifest, control, loaded, census, savedEntities: blob.world.entities };
      }, { seed, state, frames: FRAMES, preroll: PREROLL });

      const A = rebase(t.control), B = rebase(t.loaded);
      const cen = fieldCensus(A, B);
      const controlSha = sha(A.map((x) => JSON.stringify(x)).join('\n'));
      const loadedSha = sha(B.map((x) => JSON.stringify(x)).join('\n'));

      const trial = {
        state, seed,
        m1_hash_before: t.hashBefore,
        m1_hash_after_load: t.hashAfterLoad,
        m1_pass: t.hashBefore === t.hashAfterLoad && t.roundTrip.equal,
        m2_round_trip_diff: t.roundTrip.diff,
        m2_pass: t.roundTrip.diff.length === 0,
        m4_in_save_not_on_manifest: t.manifest.in_save_not_on_manifest,
        m4_on_manifest_not_in_save: t.manifest.on_manifest_not_in_save,
        m4_entity_keys: t.census.entity_keys,
        m4_pass: t.manifest.in_save_not_on_manifest.length === 0
          && t.manifest.on_manifest_not_in_save.length === 0
          && t.census.entity_keys.live_not_declared_anywhere.length === 0
          && t.census.entity_keys.declared_durable_not_in_save.length === 0
          && t.census.entity_keys.in_save_not_declared.length === 0
          && t.census.entity_keys.declared_absent_but_non_empty.length === 0,
        m5_frames: cen.frames,
        m5_control_body_sha256: controlSha,
        m5_loaded_body_sha256: loadedSha,
        m5_identical: controlSha === loadedSha,
        m5_differing_fields: cen.fields,
        m5_first_divergence: cen.first,
        m5_pass: controlSha === loadedSha && Object.keys(cen.fields).length === 0,
        census_ok: t.census.ok,
        census_unaccounted: t.census.unaccounted,
        saved_entity_record: t.savedEntities[0] || null,
      };
      trial.pass = trial.m1_pass && trial.m2_pass && trial.m4_pass && trial.m5_pass && trial.census_ok;
      report.trials.push(trial);
      log(`${trial.pass ? 'PASS' : 'FAIL'} ${state} seed ${seed} — M1 ${trial.m1_pass ? 'ok' : 'FAIL'}, M2 ${trial.m2_pass ? 'ok' : 'FAIL'}, M4 ${trial.m4_pass ? 'ok' : 'FAIL'}, M5 ${trial.m5_identical ? 'identical' : 'DIVERGED'} ${JSON.stringify(trial.m5_differing_fields)}, census ${trial.census_ok ? 'ok' : JSON.stringify(trial.census_unaccounted)}`);
      log(`        control ${controlSha.slice(0, 16)}  loaded ${loadedSha.slice(0, 16)}  over ${cen.frames} frames`);
    }
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.trials_passed = report.trials.filter((t) => t.pass).length;
report.pass = report.trials.every((t) => t.pass) && report.page_errors.length === 0;
writeJson(path.join(outDir, 'state-diff.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'state-diff.json') + '\n');
log(`${report.trials_passed}/${report.trials.length} trials clean (M1, M2, M4, M5 and the live-object census)`);
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
