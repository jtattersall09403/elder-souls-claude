// KRITIK3 — CONSUMPTION adjudication for the RI-WPN05 §A/§B impact + material model.
//
// TWO CONTRADICTORY READINGS ARE ON THE RECORD AND THIS FILE RULES BETWEEN THEM:
//
//   round-2 critic   `kritik-consumption3.mjs`        2 of 6 CONSUMED on the round-3 build
//   round-3 builder  `tools/weapons/impact-consumption.mjs`  17 of 17 CONSUMED
//
// Neither is trusted. Three things are wrong with taking either number at face value:
//
//   1. **Both write `game/data/weapons/classes.json` on disk.** Thirteen agents share this tree; a
//      probe that mutates tracked source and restores it in a `finally` is one crash away from
//      leaving a corrupted data file behind, and one concurrent `git commit -a` away from banking
//      it (which is exactly how HEAD acquired a reverted `socketsFor` this round). This instrument
//      mutates an in-memory copy and never touches the disk.
//   2. **"changed" is not "consumed".** `JSON.stringify(before) !== JSON.stringify(after)` fires
//      just as happily when the only field that moved is one the *trace record* copies out of the
//      perturbed table. A record echoing its own input is the CONSUMPTION check's own named
//      failure. Every probe here therefore splits its observation into
//         BEHAVIOURAL  — quantities produced by the simulation stepping (damage dealt, the frames
//                        the attacker's animation actually stalled, where the two bodies ended up,
//                        the move's real length)
//         RECORDED     — fields the impact record carries
//      and a probe is CONSUMED only if a BEHAVIOURAL quantity moved. A probe whose only movement
//      is in RECORDED is reported as ECHO, which is neither CONSUMED nor INERT.
//   3. **A probe that cannot fire is not evidence.** `AMENDMENT-W1-10-03` §E proposes calling
//      those VOID rather than INERT. That proposal is tested here rather than accepted: each of
//      the round-2 probes is run twice, once on the fixture it shipped with (flesh) and once on a
//      fixture that CAN read the row, and the pair is what decides whether §E is right.
//
//   node kritik3-consumption.mjs out.json
'use strict';
import fs from 'node:fs';

const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);

const BEHAVIOURAL = ['dmg', 'hitF', 'atk_stall_f', 'victim_dz', 'attacker_dz', 'move_real_total_f', 'victim_stall_f'];
const RECORDED = ['rec_material', 'rec_hitstop_f', 'rec_victim_hitstop_f', 'rec_knockback_m', 'rec_decal', 'rec_added_recovery_f', 'rec_via'];

/** One scripted swing, fully observed, with the class table supplied IN MEMORY. */
function fight({ material, weapon = 'ssw_garrison_sword', dist = 1.2, mutate = null }) {
  const d = loadCombatData();
  if (mutate) mutate(d.weaponClasses);
  const a = new NodeArena({ data: d, loadout: { weapon } });
  const e = a.spawn('t', 'mat_' + material, 0, dist, 180);
  a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp, ez0 = e.pos[2], px0 = a.player.pos[2];
  let hitF = null, stall = 0, prevA = -1, vStall = 0, prevE = -1, rec = null, maxAnim = 0, deflect = false;
  for (let i = 0; i < 400; i++) {
    a.step();
    for (const ev of a.drain()) {
      if ((ev.kind === 'HIT' || ev.kind === 'BLOCK' || ev.kind === 'DEFLECT') && hitF === null) hitF = ev.f;
      if (ev.kind === 'IMPACT' && !rec) rec = ev;
      if (ev.kind === 'DEFLECT') deflect = true;
    }
    if (hitF !== null && a.player.animFrame === prevA) stall++;
    if (hitF !== null && e.animFrame === prevE && e.move) vStall++;
    prevA = a.player.animFrame; prevE = e.animFrame;
    if (a.player.move) maxAnim = Math.max(maxAnim, a.player.animFrame);
  }
  return {
    dmg: +(hp0 - e.hp).toFixed(2), hitF,
    atk_stall_f: stall, victim_stall_f: vStall,
    victim_dz: +(e.pos[2] - ez0).toFixed(3), attacker_dz: +(a.player.pos[2] - px0).toFixed(3),
    move_real_total_f: maxAnim, deflect,
    rec_material: rec ? rec.material : null, rec_hitstop_f: rec ? rec.hitstop_f : null,
    rec_victim_hitstop_f: rec ? rec.victim_hitstop_f : null, rec_knockback_m: rec ? rec.knockback_m : null,
    rec_decal: rec ? rec.decal : null, rec_added_recovery_f: rec ? rec.added_recovery_f : null,
    rec_via: rec ? rec.via : null,
  };
}

const results = [];
function probe(name, spec, mutate, tag) {
  const before = fight(spec);
  const after = fight({ ...spec, mutate });
  const movedB = BEHAVIOURAL.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const movedR = RECORDED.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const deflectMoved = before.deflect !== after.deflect;
  const verdict = movedB.length || deflectMoved ? 'CONSUMED' : (movedR.length ? 'ECHO' : 'INERT');
  results.push({ name, tag, fixture: spec, verdict, moved_behavioural: movedB, moved_recorded: movedR, before, after });
  console.log(`${verdict.padEnd(9)} ${name}  [${tag}] vs ${spec.material}  behav=${JSON.stringify(movedB)} rec=${JSON.stringify(movedR)}`);
  return verdict;
}

// ============================================================================================
// PART 1 — the round-2 suite's six rows, each run on ITS OWN fixture and on a fixture that can
// read the row. This is the pair that adjudicates AMENDMENT-W1-10-03 §E.
// ============================================================================================
const R2 = [
  ['hitstop.attacker.<tier>.flesh 8 -> 40', (c) => { for (const t of Object.keys(c.hitstop.attacker)) c.hitstop.attacker[t].flesh = 40; }, 'flesh', 'flesh', 'ssw_garrison_sword'],
  ['hitstop.attacker.<tier>.stone -> 99', (c) => { for (const t of Object.keys(c.hitstop.attacker)) c.hitstop.attacker[t].stone = 99; }, 'flesh', 'stone', 'mce_bog_iron_mace'],
  ['hitstop.attacker.<tier>.metal/chitin/wood/shield -> 99', (c) => { for (const t of Object.keys(c.hitstop.attacker)) for (const m of ['metal', 'chitin', 'wood', 'shield']) c.hitstop.attacker[t][m] = 99; }, 'flesh', 'chitin', 'ssw_garrison_sword'],
  ['materials.multipliers ALL -> 0.01', (c) => { for (const m of Object.keys(c.materials.multipliers)) for (const k of Object.keys(c.materials.multipliers[m])) c.materials.multipliers[m][k] = 0.01; }, 'flesh', 'flesh', 'ssw_garrison_sword'],
  ['hitstop.knockback_m ALL -> 9', (c) => { for (const t of Object.keys(c.hitstop.knockback_m)) for (const m of Object.keys(c.hitstop.knockback_m[t])) c.hitstop.knockback_m[t][m] = 9; }, 'flesh', 'flesh', 'ssw_garrison_sword'],
  ['hitstop.deflect.hitstop_multiplier 1.5 -> 20', (c) => { c.hitstop.deflect.hitstop_multiplier = 20; }, 'flesh', 'stone', 'ssw_garrison_sword'],
];
console.log('--- PART 1: the round-2 six, on their own fixture then on a fixture that can read the row');
const pairs = [];
for (const [name, mut, ownMat, ableMat, ableWeapon] of R2) {
  const a = probe(name, { material: ownMat, weapon: 'ssw_garrison_sword' }, mut, 'r2-own-fixture');
  const b = probe(name, { material: ableMat, weapon: ableWeapon }, mut, 'r2-able-fixture');
  pairs.push({ name, on_own_fixture: a, on_able_fixture: b });
}

// ============================================================================================
// PART 2 — negative controls. A consumption instrument that fires on everything measures nothing.
// Each row below is one a CORRECT build must NOT respond to in this scenario.
// ============================================================================================
console.log('\n--- PART 2: negative controls (a correct build leaves these INERT)');
const controls = [];
controls.push(['victim_hitstop_mode.<all> flipped to a nonsense key', probe('victim_hitstop_mode -> "zzz" (unknown mode)',
  { material: 'flesh' }, (c) => { for (const k of Object.keys(c.hitstop.victim_hitstop_mode || {})) c.hitstop.victim_hitstop_mode[k] = 'zzz'; }, 'control')]);
controls.push(['a material row nothing in this fixture is', probe('materials.multipliers.water.* -> 99 (vs a FLESH target)',
  { material: 'flesh' }, (c) => { for (const k of Object.keys(c.materials.multipliers.water)) c.materials.multipliers.water[k] = 99; }, 'control')]);
controls.push(['an unrelated class column', probe('classes.<all>.parry_class -> "zzz" (vs a FLESH target, no shield)',
  { material: 'flesh' }, (c) => { for (const k of Object.keys(c.classes)) c.classes[k].parry_class = 'zzz'; }, 'control')]);

// ============================================================================================
// PART 3 — the load-bearing rows, driven on able fixtures. These are the ones a correct build
// MUST move, and the ones a remediation should be graded against.
// ============================================================================================
console.log('\n--- PART 3: load-bearing rows on able fixtures');
const load = [];
load.push(probe('materials.multipliers.stone.strike 1.35 -> 0.01', { material: 'stone', weapon: 'mce_bog_iron_mace' }, (c) => { c.materials.multipliers.stone.strike = 0.01; }, 'load'));
load.push(probe('materials.multipliers.plant.slash 1.25 -> 0.01', { material: 'plant' }, (c) => { c.materials.multipliers.plant.slash = 0.01; }, 'load'));
load.push(probe('hitstop.deflect.poise_damage_below 30 -> 0 (nothing deflects)', { material: 'stone' }, (c) => { c.hitstop.deflect.poise_damage_below = 0; }, 'load'));
load.push(probe('hitstop.deflect.added_recovery_f 16 -> 200', { material: 'stone' }, (c) => { c.hitstop.deflect.added_recovery_f = 200; }, 'load'));
load.push(probe('hitstop.victim_delta.flesh 4 -> 60', { material: 'flesh' }, (c) => { c.hitstop.victim_delta.flesh = 60; }, 'load'));
load.push(probe('hitstop.knockback_m.<tier>.chitin -> 9', { material: 'chitin' }, (c) => { for (const t of Object.keys(c.hitstop.knockback_m)) c.hitstop.knockback_m[t].chitin = 9; }, 'load'));
load.push(probe('materials.damage_type_of_shape ALL -> strike', { material: 'plant' }, (c) => { for (const k of Object.keys(c.materials.damage_type_of_shape)) c.materials.damage_type_of_shape[k] = 'strike'; }, 'load'));

const tally = (t) => {
  const r = results.filter((x) => x.tag === t);
  return { n: r.length, consumed: r.filter((x) => x.verdict === 'CONSUMED').length, echo: r.filter((x) => x.verdict === 'ECHO').length, inert: r.filter((x) => x.verdict === 'INERT').length };
};
const out = {
  generated: new Date().toISOString(),
  instrument: 'kritik3-consumption.mjs (critic-authored, round 3, in-memory, behavioural/recorded split)',
  tally: { r2_own_fixture: tally('r2-own-fixture'), r2_able_fixture: tally('r2-able-fixture'), controls: tally('control'), load_bearing: tally('load') },
  r2_pairs: pairs,
  results,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nTALLY', JSON.stringify(out.tally, null, 1));
