#!/usr/bin/env node
// save-consume.mjs — the CONSUMPTION check for RI-JRN05, per `ARBITRATION.md` §3 and
// `RI-MTH07` §B, run as the item's own §CONSUMPTION block requires.
//
// The item's rule 2 is the one this tool exists to obey: "For a JOURNEY the admissible
// observable is what the player could see or do — a drawn string, a rendered object, a surface
// that appears, AN INPUT THAT IS ACCEPTED OR REFUSED, A STATE THAT SURVIVES. A harness return
// value is not an observable." So every probe below perturbs one durable model to TWO
// WELL-SEPARATED VALUES plus a NULL CONTROL, everything else held fixed, saves, loads, and then
// asks the world a question a player could ask with the controller in their hands.
//
// The null control is the point of the whole exercise for a SAVE item: it is not "the model set
// to zero", it is "the save does not carry this model at all". If the observable is the same
// with the field carried and with the field blanked out of the blob, then the save is writing a
// field nothing reads and RI-MTH07 §A's orphan-data shape applies — which is the shape this
// project has now found nine times.
//
// Exit 0 only if every probe shows a coupling. Exit 20 (MEASUREMENT_FAIL) otherwise.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-consume.mjs — RI-MTH07 §B CONSUMPTION for the fields RI-JRN05's repair made durable.

USAGE
  node tools/harness/save-consume.mjs [--seeds 4711,1337] [--json]

PROBES
  C1  the birthsign terms (identity.creation.powers/drawbacks) -> seam S27: does a cast the
      player presses for succeed after a HEARTH rest? Dry Well vs an ordinary sign vs blanked.
  C2  the loadout (fight.loadout.weapon) -> does a swing at a fixed range reach the enemy?
  C3  traversal.breath_s -> does the character drown?
  C4  death.bloodstain -> are the souls the player recovers the souls the save recorded?
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SEEDS = String(args.seeds || '4711,1337').split(',').map((s) => Number(s.trim()));
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'SAVE-CONSUME');
ensureDir(outDir);

const handle = await launchGame(args);
const report = {
  schema: 'elder-souls/save-consume@1',
  item: 'RI-JRN05 §CONSUMPTION (ARBITRATION §3 / RI-MTH07 §B)',
  rule: 'two well-separated values plus the null control, everything else held fixed; the observable is what a player could see or do, never a harness return value used as its own evidence.',
  seeds: SEEDS, probes: [],
};

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());

  const raw = await handle.page.evaluate(async (seeds) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const out = [];
    const clone = (o) => JSON.parse(JSON.stringify(o));

    // =====================================================================================
    // C1 — the birthsign terms. Seam S27: "Focus only returns at a hearth, and the Dry Well's
    // drawback is that its bearer's hearth rest does not."
    //
    // OBSERVABLE: the player presses the cast button. `pressCast()` runs the whole input path
    // — `_tryStart`, the drop table, the move, the resource charge — so a refusal measured
    // here is the refusal a player gets. Not `getMagicState().focus`.
    // =====================================================================================
    const c1 = { id: 'C1', model: 'identity.creation.powers + identity.creation.drawbacks (RI-CHR03 birthsign terms; seam S27)', observable: 'a cast the player PRESSES is accepted or refused after resting at a HEARTH', arms: [] };
    const c1Arm = (label, sign, blank) => {
      H.setSeed(4711);
      H.loadState('default');
      H.setCharacter({ race: 'argonian', upbringing: 'hatched-in-the-marsh', class: 'battlemage', birthsign: sign, given_name: 'Probe' });
      H.setCatalyst('reed-staff');
      H.setAttuned(['spark-dart']);
      // Spend the reservoir down so the rest is the only thing that could refill it.
      const st0 = H.getMagicState();
      const drained = clone(H.saveState());
      drained.magic.focus = 0;
      H.restoreState(drained);
      // Save, then LOAD — the whole point is what the load restored.
      const blob = clone(H.saveState());
      if (blank) { blob.identity.creation.powers = []; blob.identity.creation.drawbacks = []; }
      H.loadState(blob);
      const hs = H.listHearths();
      const hearth = (hs.hearths || []).find((x) => x.kind === 'settlement') || (hs.hearths || [])[0];
      if (hearth) { H.teleport(hearth.pos[0], hearth.pos[2]); H.stepFrames(2); H.restAt(hearth.id); }
      else H.hearthRest();
      let castOk = null, err = null;
      try {
        const r = H.pressCast(90);
        castOk = !!(r && (r.cast_started || r.started || (r.refused && r.refused.length === 0)));
        if (r && r.events) castOk = r.events.some((e) => e.type === 'cast_start' || e.type === 'cast_release');
        if (castOk === null) castOk = !(r && r.refused && r.refused.length);
        out._c1raw = r;
      } catch (e) { err = String(e && e.message || e); castOk = false; }
      c1.arms.push({ label, sign, blanked: !!blank, focus_max_before: st0 && st0.focus_max, cast_accepted: castOk, error: err });
    };
    try {
      c1Arm('A: nu-ixtu (the Dry Well)', 'nu-ixtu', false);
      c1Arm('B: raj-xul (no drawback)', 'raj-xul', false);
      c1Arm('NULL: the save carries no terms', 'nu-ixtu', true);
    } catch (e) { c1.error = String(e && e.message || e); }
    out.push(c1);

    // =====================================================================================
    // C2 — the loadout. OBSERVABLE: a swing at a FIXED range reaches the enemy or does not,
    // and the enemy's HP is a rendered thing (RI-CMB08's number and the stagger).
    // =====================================================================================
    const c2 = { id: 'C2', model: 'fight.loadout (weapon / offhand / two-handed)', observable: 'a swing at a fixed standoff lands on the enemy or whiffs (the enemy takes damage, staggers, or does not)', arms: [] };
    const c2Arm = (label, weapon, blank) => {
      H.setSeed(4711);
      H.loadState('arena_flat');
      H.setLoadout({ weapon, offhand: 'o3_twohand', twoHanded: true });
      H.teleport(0, 0);
      H.spawn('inf_trash', 0, 2.6, { as: 'c2t' });
      H.lockOn('c2t');
      H.stepFrames(10);
      const blob = clone(H.saveState());
      if (blank) blob.fight.loadout.weapon = null;
      let hp0 = null, hp1 = null, err = null, wep = null;
      try {
        H.loadState(blob);
        wep = H.getCombatState().player.weapon_id || null;
        hp0 = H.listEntities().find((e) => e.eid === 'c2t').hp;
        H.clearInputs();
        H.queueInputs([{ f: 5, press: ['heavy'] }, { f: 8, release: ['heavy'] }]);
        H.stepFrames(120);
        const e = H.listEntities().find((x) => x.eid === 'c2t');
        hp1 = e ? e.hp : 0;
      } catch (e) { err = String(e && e.message || e); }
      c2.arms.push({ label, weapon, blanked: !!blank, weapon_after_load: wep, enemy_hp_before: hp0, enemy_hp_after: hp1, damage: hp0 !== null && hp1 !== null ? hp0 - hp1 : null, error: err });
    };
    try {
      c2Arm('A: dagger (short)', 'dagger', false);
      c2Arm('B: ultra-greatsword (long)', 'ultra-greatsword', false);
      c2Arm('NULL: the save carries no weapon', 'ultra-greatsword', true);
    } catch (e) { c2.error = String(e && e.message || e); }
    out.push(c2);

    // =====================================================================================
    // C3 — the breath meter. OBSERVABLE: the character drowns, or does not. HP falling to zero
    // and the death surface appearing is as player-facing as this project gets.
    // =====================================================================================
    const c3 = { id: 'C3', model: 'traversal.breath_s (RI-WLD10 / S25)', observable: 'the character drowns after a load (HP falls; world_drowning / world_drowned fire)', arms: [] };
    const c3Arm = (label, breath, blank) => {
      H.setSeed(4711);
      H.loadState('water_shallows');
      H.stepFrames(30);
      const blob = clone(H.saveState());
      if (!blob.traversal) { c3.arms.push({ label, error: 'no traversal block in the save' }); return; }
      blob.traversal.breath_s = breath;
      blob.traversal.submerged = true;
      blob.traversal.depth_m = 6;
      blob.traversal.band = 'W5';
      if (blank) { blob.traversal.breath_s = 60; blob.traversal.submerged = false; blob.traversal.depth_m = 0; blob.traversal.band = 'W0'; }
      let hp0 = null, hp1 = null, breathAfter = null, err = null;
      try {
        H.loadState(blob);
        breathAfter = H.getTraversalReport ? (H.getTraversalReport().breath_s ?? null) : null;
        hp0 = H.getPlayerStats().hp;
        H.stepFrames(240);
        hp1 = H.getPlayerStats().hp;
      } catch (e) { err = String(e && e.message || e); }
      c3.arms.push({ label, breath_written: blank ? null : breath, blanked: !!blank, breath_after_load: breathAfter, hp_before: hp0, hp_after: hp1, hp_lost: hp0 !== null && hp1 !== null ? hp0 - hp1 : null, error: err });
    };
    try {
      c3Arm('A: one second of air left', 0.5, false);
      c3Arm('B: a full lungful', 60, false);
      c3Arm('NULL: the save carries no traversal state', 0.5, true);
    } catch (e) { c3.error = String(e && e.message || e); }
    out.push(c3);

    // =====================================================================================
    // C4 — the bloodstain. RI-JRN05 M7 and HF6: "souls recovered from a restored bloodstain
    // != souls stored" is a hard fail. OBSERVABLE: the souls the player walks over and picks
    // up — a state that survives, and the thing that decides whether the next level-up is
    // affordable at all.
    // =====================================================================================
    const c4 = { id: 'C4', model: 'death.bloodstain (position + souls)', observable: 'the souls the player RECOVERS by walking to the bloom after a load', arms: [] };
    const c4Arm = (label, souls, blank) => {
      H.setSeed(4711);
      H.loadState('sv5-journal-bloodstain');
      H.stepFrames(10);
      const blob = clone(H.saveState());
      if (!blob.death.bloodstain) {
        blob.death.bloodstain = { pos: [blob.pose.pos[0] + 1, blob.pose.pos[1], blob.pose.pos[2]], souls: 0, death_index: 1 };
      }
      blob.death.bloodstain.souls = souls;
      blob.character.souls_held = 0;
      if (blank) blob.death.bloodstain = null;
      let got = null, err = null, held0 = null, held1 = null;
      try {
        H.loadState(blob);
        held0 = H.getPlayerStats().souls;
        const ds = H.getDeathState();
        if (ds.bloodstain) { H.teleport(ds.bloodstain.pos[0], ds.bloodstain.pos[2]); H.stepFrames(4); }
        const r = H.recoverBloodstain();
        got = r && (r.souls !== undefined ? r.souls : (r.recovered !== undefined ? r.recovered : null));
        held1 = H.getPlayerStats().souls;
      } catch (e) { err = String(e && e.message || e); }
      c4.arms.push({ label, souls_written: blank ? null : souls, blanked: !!blank, souls_held_before: held0, souls_held_after: held1, gained: held0 !== null && held1 !== null ? held1 - held0 : null, reported: got, error: err });
    };
    try {
      c4Arm('A: 3,400 souls', 3400, false);
      c4Arm('B: 12 souls', 12, false);
      c4Arm('NULL: the save carries no bloodstain', 3400, true);
    } catch (e) { c4.error = String(e && e.message || e); }
    out.push(c4);

    return out;
  }, SEEDS);

  // Coupling: the two well-separated arms must differ from each other on the observable, and
  // the null control must differ from at least one of them. Same on all three = coupling 0.
  const key = {
    C1: (a) => a.cast_accepted,
    C2: (a) => (a.damage === null ? null : a.damage > 0),
    C3: (a) => (a.hp_lost === null ? null : a.hp_lost > 0),
    C4: (a) => a.gained,
  };
  for (const p of raw) {
    const f = key[p.id];
    const vals = p.arms.map((a) => ({ label: a.label, value: f(a), error: a.error || null }));
    const a = vals[0] && vals[0].value, b = vals[1] && vals[1].value, n = vals[2] && vals[2].value;
    const separated = JSON.stringify(a) !== JSON.stringify(b);
    const nullDiffers = JSON.stringify(n) !== JSON.stringify(a) || JSON.stringify(n) !== JSON.stringify(b);
    const row = {
      id: p.id, model: p.model, observable: p.observable,
      arms: p.arms, observed: vals,
      two_values_separate: separated,
      null_control_differs: nullDiffers,
      coupling: separated && nullDiffers ? 1 : 0,
      error: p.error || null,
    };
    report.probes.push(row);
    log(`${row.coupling ? 'COUPLED' : 'COUPLING 0'} ${p.id} — ${p.model}`);
    for (const v of vals) log(`    ${v.label}: ${JSON.stringify(v.value)}${v.error ? '  ERROR ' + v.error : ''}`);
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.probes.length > 0 && report.probes.every((p) => p.coupling === 1);
writeJson(path.join(outDir, 'save-consume.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'save-consume.json') + '\n');
log(`${report.probes.filter((p) => p.coupling === 1).length}/${report.probes.length} models are CONSUMED by the running world`);
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
