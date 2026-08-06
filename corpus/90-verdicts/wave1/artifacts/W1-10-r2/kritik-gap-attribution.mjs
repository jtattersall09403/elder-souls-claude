// Who owns the interior dead band? The W1-09 round-3 builder attributes the player spear and
// halberd gaps to W1-10's roster movesets. This tests that attribution directly.
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';

const OUT = process.argv[2] || '/dev/stdout';
const STEP = 0.05, LO = 0.20, HI = 3.60;
function mk(mutate) { const d = loadCombatData(); if (mutate) mutate(d); return d; }
function sweep(data, weapon, slot = 'r1.1') {
  const v = [];
  for (let x = LO; x <= HI + 1e-9; x += STEP) {
    const dist = +x.toFixed(2);
    const a = new NodeArena({ data, loadout: { weapon } });
    const e = a.spawn('t', 'dummy_passive', 0, dist, 180);
    a.lockOn('t');
    const btn = /r2|art/.test(slot) ? 'heavy' : 'light';
    a.queueInputs([{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
    const hp0 = e.hp;
    for (let i = 0; i < 400; i++) a.step();
    v.push(e.hp < hp0 ? 1 : 0);
  }
  const dist = (i) => +(LO + i * STEP).toFixed(2);
  const idx = v.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return { gaps: [], vector: v.join(''), min: null, max: null };
  const gaps = []; const min = idx[0], max = idx[idx.length - 1];
  for (let i = min; i <= max; i++) if (!v[i]) { const s = i; while (i <= max && !v[i]) i++; gaps.push([dist(s), dist(i - 1)]); }
  return { gaps, vector: v.join(''), min: dist(min), max: dist(max) };
}

const res = { generated: new Date().toISOString(), tests: [] };
function T(name, r, note) { res.tests.push({ name, ...r, note }); console.log(`${name.padEnd(52)} gaps ${JSON.stringify(r.gaps).padEnd(22)} band ${r.min}..${r.max}  ${note || ''}`); }

const D0 = mk(null);
// 1. is the gap a property of the CLASS or of the one baseline weapon?
console.log('--- 1. every SPR and HLB weapon, unmodified data ---');
for (const [id, m] of Object.entries(D0.weaponMovesets)) {
  if (m.class !== 'SPR' && m.class !== 'HLB') continue;
  T(`${m.class} ${id}`, sweep(D0, id), `root_dz=${m.slots['r1.1'].root_dz_m}`);
}
// 2. does the gap move when THIS PIECE's root_dz_m changes? (roster-owned datum)
console.log('\n--- 2. spr_drowned_harpoon r1.1 root_dz_m perturbed (W1-10-owned datum) ---');
for (const dz of [0, 0.2, 0.4, 0.575, 0.8, 1.2]) {
  T(`SPR root_dz_m = ${dz}`, sweep(mk((d) => { d.weaponMovesets.spr_drowned_harpoon.slots['r1.1'].root_dz_m = dz; }), 'spr_drowned_harpoon'), '');
}
// 3. does the gap move when the CLIP GEOMETRY changes? (also W1-10-owned)
console.log('\n--- 3. spr_drowned_harpoon r1.1 clip capsule_length_m perturbed ---');
const anim = D0.weaponMovesets.spr_drowned_harpoon.slots['r1.1'].anim;
for (const cl of [0.5, 1.0, 1.6, 2.2]) {
  T(`SPR capsule_length_m = ${cl}`, sweep(mk((d) => { d.clipRegistry.clips[anim].capsule_length_m = cl; }), 'spr_drowned_harpoon'), '');
}
// 4. is it slot-specific or does every slot of the class have it?
console.log('\n--- 4. other slots of the same weapon ---');
for (const s of ['r1.2', 'r2', 'run.r1', 'roll.r1']) {
  if (D0.weaponMovesets.spr_drowned_harpoon.slots[s]) T(`SPR slot ${s}`, sweep(D0, 'spr_drowned_harpoon', s), '');
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
