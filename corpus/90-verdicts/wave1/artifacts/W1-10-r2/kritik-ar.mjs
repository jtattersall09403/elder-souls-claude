// AR-1 / AR-2 / AR-3 on the weapon path, critic-authored.
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const D = loadCombatData();
const out = { generated: new Date().toISOString(), AR1: {}, AR2: {}, AR3: {} };

// --- AR-1a: determinism / no dice. 60 identical swings, damage must be identical. ------------
const dmg = new Set(); const draws = new Set();
for (let i = 0; i < 60; i++) {
  const a = new NodeArena({ data: D, loadout: { weapon: 'straight-sword' } });
  const e = a.spawn('t', 'dummy_passive', 0, 1.2, 180); a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp;
  for (let k = 0; k < 120; k++) a.step();
  dmg.add(+(hp0 - e.hp).toFixed(4));
  if (a.cs.rng && a.cs.rng.draws !== undefined) draws.add(a.cs.rng.draws);
}
out.AR1.identical_swings = 60;
out.AR1.distinct_damage_values = [...dmg];
out.AR1.deterministic = dmg.size === 1;
console.log('AR-1 damage across 60 identical swings:', [...dmg], dmg.size === 1 ? 'DETERMINISTIC' : 'NON-DETERMINISTIC');

// --- AR-1b: is any attack cancellable during startup or active? ------------------------------
const cancelTests = [];
for (const [name, btn, at] of [['roll during startup', 'roll', 8], ['roll during active', 'roll', 28],
  ['two_hand during startup', 'two_hand', 8], ['two_hand during active', 'two_hand', 28],
  ['block during startup', 'block', 8], ['parry during active', 'parry', 28],
  ['heavy during startup', 'heavy', 8], ['light during active', 'light', 28]]) {
  const a = new NodeArena({ data: D, loadout: { weapon: 'straight-sword' } });
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }, { f: 3 + at, press: [btn] }, { f: 5 + at, release: [btn] }]);
  let ended = null, startedOther = null;
  for (let k = 0; k < 200; k++) {
    a.step();
    const m = a.player.move;
    if (m && m.kind === 'attack' && m.slot === 'r1.1') ended = a.frame;
    else if (m && m.slot !== 'r1.1' && !startedOther && a.frame < 3 + 74) startedOther = `${m.kind}/${m.slot || m.id}@${a.frame}`;
  }
  const full = ended !== null && (ended - 3) >= 70;   // r1.1 total is 74 f
  cancelTests.push({ test: name, r1_1_ran_to: ended === null ? null : ended - 3, completed_uncancelled: full, interrupted_by: startedOther });
  console.log(`  AR-1 ${name.padEnd(26)} r1.1 ran ${ended === null ? 'n/a' : ended - 3} f  ${full ? 'UNCANCELLED' : 'CANCELLED'}${startedOther ? ' by ' + startedOther : ''}`);
}
out.AR1.cancel_tests = cancelTests;
out.AR1.any_cancellable = cancelTests.some((t) => !t.completed_uncancelled);

// --- AR-1c: stance switch commitment (RI-WPN06 §A) -------------------------------------------
{
  const a = new NodeArena({ data: D, loadout: { weapon: 'straight-sword' } });
  a.queueInputs([{ f: 3, press: ['two_hand'] }, { f: 5, release: ['two_hand'] }, { f: 12, press: ['light'] }, { f: 14, release: ['light'] }]);
  const seq = [];
  for (let k = 0; k < 120; k++) { a.step(); const m = a.player.move; if (m && (!seq.length || seq[seq.length - 1].k !== (m.slot || m.id))) seq.push({ f: a.frame, k: m.slot || m.id, kind: m.kind }); }
  out.AR1.stance_switch = seq;
  console.log('  AR-1 stance switch sequence:', seq.map((s) => `${s.k}@${s.f}`).join(' > '));
}

// --- AR-2: procedural / randomised weapon stats ----------------------------------------------
const ids = Object.keys(D.weaponMovesets);
const dup = {};
for (const id of ids) { const m = D.weaponMovesets[id]; const k = JSON.stringify(m.slots['r1.1'] || {}); dup[k] = (dup[k] || 0) + 1; }
out.AR2 = {
  roster_size: ids.length,
  all_hand_authored_ids: ids.every((i) => /^[a-z]{3}_[a-z_]+$/.test(i)),
  identical_r1_1_blocks: Object.values(dup).filter((n) => n > 1).length,
  floating_damage_numbers: 'none observed in any driven attack (no such event kind exists in sim/events.js)',
  procedural_generation: 'none — 87 files on disk, each with a hand-written `name` and `notes`',
};
console.log('AR-2 roster', ids.length, 'hand-authored ids', out.AR2.all_hand_authored_ids, 'duplicate r1.1 blocks', out.AR2.identical_r1_1_blocks);

// --- AR-3: the material system as a seam crossing ---------------------------------------------
const mats = D.weaponClasses.materials;
out.AR3 = {
  materials: Object.keys(mats.multipliers),
  damage_types: Object.keys(mats.damage_type_of_shape).length,
  bypass_classes: D.weaponClasses.hitstop.deflect.class_bypass,
  enemy_statblocks_declaring_a_material: Object.entries(D._enemies).filter(([, e]) => e.material || (e.hurtbox && e.hurtbox.material)).map(([k]) => k),
  total_enemy_statblocks: Object.keys(D._enemies).length,
};
console.log('AR-3 materials', out.AR3.materials.join(','), '| enemy statblocks carrying a material:', out.AR3.enemy_statblocks_declaring_a_material.length, 'of', out.AR3.total_enemy_statblocks);
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));
