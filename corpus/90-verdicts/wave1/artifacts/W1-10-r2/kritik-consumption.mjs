// CONSUMPTION (ARBITRATION §3 / RI-MTH07), critic-authored. For each model this piece ships,
// perturb the SHIPPED data file and observe an entity change behaviour. Nothing here calls a
// builder tool; the perturbation is a byte edit to game/data and the observation is a fight.
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user/elder-souls-claude';
const MS = path.join(ROOT, 'game/data/combat/movesets/ssw_garrison_sword.json');
const REG = path.join(ROOT, 'game/data/weapons/clip-registry.json');

async function fight(loadout = { weapon: 'straight-sword' }, dist = 1.2, script = null) {
  // fresh module graph each run so the JSON is re-read from disk
  const { NodeArena, loadCombatData } = await import(
    `${ROOT}/tools/lib/combat-node.mjs?v=${Math.random()}`);
  const D = loadCombatData();
  const a = new NodeArena({ data: D, loadout });
  const e = a.spawn('t', 'dummy_passive', 0, dist, 180);
  a.lockOn('t');
  a.queueInputs(script || [{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const out = { start: null, hits: [], hp0: e.hp };
  for (let i = 0; i < 240; i++) {
    a.step();
    for (const ev of a.drain()) {
      if (ev.kind === 'ACTION_START' && ev.tag === 'attack' && !out.start) {
        out.start = { f: ev.f, slot: ev.anim_slot, anim: ev.anim, startup: ev.startup, active: ev.active, recovery: ev.recovery, arc: ev.arc_sweep_deg };
      }
      if (ev.kind === 'HIT') out.hits.push({ f: ev.f, dmg: ev.dmg });
    }
  }
  out.hp = e.hp; out.dmg_total = out.hp0 - e.hp;
  return out;
}

function patch(file, fn) {
  const orig = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(orig);
  fn(doc);
  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  return () => fs.writeFileSync(file, orig);
}

const results = [];
async function probe(name, file, mutate, expectation) {
  const before = await fight();
  const restore = patch(file, mutate);
  let after;
  try { after = await fight(); } finally { restore(); }
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  results.push({ name, expectation, changed, before, after });
  console.log(`${changed ? 'CONSUMED  ' : 'INERT     '} ${name}`);
  console.log(`   before: ${JSON.stringify(before.start)} dmg=${before.dmg_total} hits@${before.hits.map((h) => h.f).join(',')}`);
  console.log(`   after : ${JSON.stringify(after.start)} dmg=${after.dmg_total} hits@${after.hits.map((h) => h.f).join(',')}`);
}

// 1. frame data: does the runtime read startup_f from the moveset file?
await probe('moveset slot r1.1 startup_f 24 -> 60', MS,
  (d) => { d.slots['r1.1'].startup_f = 60; }, 'attack starts later, hit lands later');
// 2. motion value: does damage read the slot's own motion_value?
await probe('moveset slot r1.1 motion_value x0.25', MS,
  (d) => { d.slots['r1.1'].motion_value = d.slots['r1.1'].motion_value * 0.25; }, 'damage falls');
// 3. clip id: does the runtime read the anim field?
await probe('moveset slot r1.1 anim -> another registry clip', MS,
  (d) => { d.slots['r1.1'].anim = 'clip_garrison_roll_r1'; }, 'a different clip plays');
// 4. hitbox geometry: does the swept volume read the clip registry?
await probe('clip-registry capsule_length_m of r1.1 clip 1.05 -> 0.20', REG,
  (d) => { d.clips.clip_w_ssw_garrison_sword_r1_1.capsule_length_m = 0.20; }, 'the swing no longer reaches 1.2 m');
// 5. animation profile: does the pose read the registry profile?
await probe('clip-registry profile arc_deg of r1.1 clip -> 5 deg', REG,
  (d) => { d.clips.clip_w_ssw_garrison_sword_r1_1.profile.arc_deg = 5; }, 'the arc collapses, hit timing/geometry changes');
// 6. chains_to: does the chain read the declared successor?
await probe('moveset r1.1 chains_to r1.2 -> null', MS,
  (d) => { delete d.slots['r1.1'].chains_to; }, 'the chain stops after one link');
// 7. root translation
await probe('moveset slot r1.1 root_dz_m -> 0', MS,
  (d) => { d.slots['r1.1'].root_dz_m = 0; }, 'the attacker no longer steps in');

fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify({ generated: new Date().toISOString(), results }, null, 1));
const inert = results.filter((r) => !r.changed);
console.log(`\n${results.length - inert.length}/${results.length} models demonstrably CONSUMED by the fight.`);
if (inert.length) console.log('INERT:', inert.map((r) => r.name).join('; '));
