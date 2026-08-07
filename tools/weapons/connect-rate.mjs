// `CR` — the connect rate. Proposed by BAR-CRITIQUE / the W1-10 round-2 verdict §4 as a new
// measure, and built here because it is the tenth-hour question none of the nine headline numbers
// asks:
//
//   > "A player ten hours in complains that swings which visually connect do not damage. Nothing
//   >  in the nine numbers asks how often a swing at a stationary target at ordinary spacing
//   >  lands — and the blind pack answered it by accident: 0 to 4 hits from ~10 attacks per trace,
//   >  and two traces landing nothing at all."
//   >
//   > **Proposed new measure `CR` (connect rate):** the fraction of scripted `r1.1` presses that
//   > damage a stationary dummy at the class's own declared reach minus 0.20 m; floor **0.95**.
//
// Implemented exactly as proposed, over all 87 weapons, plus two supporting readings the proposal
// implies but does not name:
//
//   CR_reach   at `reach_m - 0.20` — the measure as written
//   CR_band    the fraction of a 0.20 m -> declared-reach sweep at which the weapon connects at
//              all, which is what a player experiences while closing distance
//   CR_zero    weapons that land NOTHING anywhere in that sweep (the round-2 finding's worst case)
//
//   node tools/weapons/connect-rate.mjs [out.json] [--gate]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const D = loadCombatData();

const FLOOR = 0.95;
const PRESSES = 10;

/**
 * `PRESSES` scripted light presses at one distance, against a stationary dummy that cannot die,
 * cannot stagger and cannot be pushed out of range. Anything else would measure the dummy.
 */
function run(weapon, dist) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  const e = a.spawn('t', 'mat_flesh', 0, dist, 180);
  e.knockbackImmune = true;
  a.lockOn('t');
  // Presses are spaced by the weapon's OWN r1.1 length plus a margin. Spacing them on a fixed
  // clock measures how many presses land inside a commitment the character has not finished —
  // which is `RI-CMB02` §D's commitment rule doing its job, not a reach failure — and an ultra
  // greatsword's 152-frame swing would score 0.2 on a 90-frame cadence however well it reached.
  const r11 = D.weaponMovesets[weapon].slots['r1.1'];
  const gap = r11.startup_f + r11.active_f + r11.recovery_f + 30;
  const script = [];
  for (let i = 0; i < PRESSES; i++) script.push({ f: 4 + i * gap, press: ['light'] }, { f: 6 + i * gap, press: [], release: ['light'] });
  a.queueInputs(script);
  let hits = 0, presses = 0;
  for (let i = 1; i <= gap * PRESSES + 200; i++) {
    // Re-seat BEFORE the frame that presses, and only then. Every attack in this build lunges
    // (RI-WPN02 §B's `root_dz_m`), so a ten-swing script walks itself out of the distance under
    // test by swing three; re-seating at the start of each press cycle is what makes each of the
    // ten presses a measurement at the SAME distance. Re-seating every frame, which the first
    // version of this tool did, corrupts the swept volume instead: the rig is evaluated at the
    // lunged pose and `prev` is left at the reset one.
    if ((i - 4) % gap === 0 && i >= 4) {
      a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0;
      e.pos[0] = 0; e.pos[2] = dist;
      presses++;
    }
    a.step();
    for (const ev of a.drain()) if (ev.kind === 'IMPACT') hits++;
  }
  return { hits, presses };
}

const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);

const rows = [];
for (const c of Object.keys(byClass).sort()) {
  for (const wid of byClass[c].sort()) {
    const ms = D.weaponMovesets[wid];
    if (!ms.slots['r1.1']) continue;                     // BOW has no r1.1 (RI-WPN01 §A)
    const reach = ms.reach_m;
    const d = Math.max(0.3, +(reach - 0.20).toFixed(2));
    const at = run(wid, d);
    // the band sweep
    let band = 0, cells = 0, any = 0;
    for (let x = 0.3; x <= reach + 0.001; x += 0.2) {
      cells++;
      const r = run(wid, +x.toFixed(2));
      if (r.hits > 0) { band++; any += r.hits; }
    }
    rows.push({
      class: c, weapon: wid, reach_m: reach, at_m: d,
      CR_reach: at.presses ? +(Math.min(at.hits, at.presses) / at.presses).toFixed(3) : 0,
      hits_at_reach: at.hits,
      CR_band: +(band / cells).toFixed(3), band_cells: cells,
      lands_nothing_anywhere: any === 0,
    });
  }
}

const CR = rows.length ? +(rows.reduce((s, r) => s + r.CR_reach, 0) / rows.length).toFixed(4) : 0;
const below = rows.filter((r) => r.CR_reach < FLOOR);
const zero = rows.filter((r) => r.lands_nothing_anywhere);
const out = {
  generated: new Date().toISOString(),
  definition: "fraction of scripted r1.1 presses that damage a stationary dummy at the weapon's own declared reach - 0.20 m",
  presses_per_weapon: PRESSES, floor: FLOOR,
  weapons: rows.length,
  CR_mean: CR,
  CR_min: rows.length ? Math.min(...rows.map((r) => r.CR_reach)) : 0,
  weapons_below_floor: below.length,
  weapons_below_floor_list: below.map((r) => `${r.weapon} ${r.CR_reach}`),
  weapons_landing_nothing: zero.map((r) => r.weapon),
  CR_band_mean: rows.length ? +(rows.reduce((s, r) => s + r.CR_band, 0) / rows.length).toFixed(4) : 0,
  rows,
};
fs.writeFileSync(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/dev/stdout', JSON.stringify(out, null, 1));
console.log(`weapons measured        ${rows.length}`);
console.log(`CR mean                 ${out.CR_mean}   (floor ${FLOOR})`);
console.log(`CR min                  ${out.CR_min}`);
console.log(`weapons below floor     ${below.length}${below.length ? ' -> ' + out.weapons_below_floor_list.slice(0, 8).join(', ') : ''}`);
console.log(`weapons landing nothing ${zero.length}${zero.length ? ' -> ' + out.weapons_landing_nothing.join(', ') : ''}`);
console.log(`CR_band mean            ${out.CR_band_mean}`);
if (process.argv.includes('--gate') && (out.CR_min < FLOOR || zero.length)) process.exit(1);
