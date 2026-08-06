// CONSUMPTION gate for the RI-WPN05 §A/§B impact and material model (ARBITRATION §3).
//
// The W1-10 round-2 verdict named this area's biggest gap as an authored model with no world-side
// consumer, and proposed its own probe suite for promotion into tools/ "since it is the check that
// would have caught this round's biggest gap in minutes". This is that promotion, with one
// correction the round-2 probe needed and could not have had:
//
//   **The round-2 suite drove every perturbation against a FLESH dummy.** Four of its six probes —
//   the stone column, the metal/chitin/wood/shield columns, knockback, and the deflect multiplier —
//   address rows that a flesh hit never reads, and it observed only {dmg, hit frame, attacker
//   hitstop}, which cannot see a knockback at all. Those four therefore report INERT on a build
//   where they are fully consumed. A perturbation must be driven against the thing it perturbs.
//
// So each probe below names the target material it is about, lands a real hit on a dummy carrying
// that material, and observes the whole impact: damage, both hitstop clocks, the attacker's and the
// victim's world position, the deflect flag and the added recovery.
//
//   node tools/weapons/impact-consumption.mjs [out.json] [--gate]
//
// `--gate` exits non-zero if any probe is INERT.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CL = `${ROOT}/game/data/weapons/classes.json`;

/**
 * One scripted swing at one material dummy, observed completely.
 *
 * `weapon` picks the damage type through its slot's shape: `straight-sword` slashes,
 * `tsw_bog_rapier` thrusts, `mce_bog_iron_mace` strikes. That triple is exactly RI-WPN05 M2's
 * ("one class per type: SSW slash, SPR thrust, MCE strike").
 */
async function fight(material, weapon = 'straight-sword', dist = 1.2) {
  const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs?v=${Math.random()}`);
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon } });
  const e = a.spawn('t', 'mat_' + material, 0, dist, 180);
  a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp;
  const ez0 = e.pos[2], px0 = a.player.pos[2];
  let hitF = null, held = 0, prevAnim = -1, vHeld = 0, prevE = -1, seen = null, deflect = false;
  let totalF = 0;
  for (let i = 0; i < 400; i++) {
    a.step();
    for (const ev of a.drain()) {
      if ((ev.kind === 'HIT' || ev.kind === 'BLOCK' || ev.kind === 'DEFLECT') && hitF === null) hitF = ev.f;
      if (ev.kind === 'IMPACT' && !seen) seen = ev;
      if (ev.kind === 'DEFLECT') deflect = true;
    }
    if (hitF !== null && a.player.animFrame === prevAnim) held++;
    if (hitF !== null && e.animFrame === prevE && e.move) vHeld++;
    prevAnim = a.player.animFrame; prevE = e.animFrame;
    if (a.player.move) totalF = a.player.animFrame;
  }
  return {
    dmg: +(hp0 - e.hp).toFixed(2),
    hitF,
    atk_hitstop_held_f: held,
    victim_dz: +(e.pos[2] - ez0).toFixed(3),
    attacker_dz: +(a.player.pos[2] - px0).toFixed(3),
    deflect,
    impact_material: seen ? seen.material : null,
    impact_hitstop_f: seen ? seen.hitstop_f : null,
    impact_victim_hitstop_f: seen ? seen.victim_hitstop_f : null,
    impact_knockback_m: seen ? seen.knockback_m : null,
    impact_decal: seen ? seen.decal : null,
    added_recovery_f: seen ? seen.added_recovery_f : null,
    move_total_f: totalF,
  };
}

function patch(file, fn) {
  const o = fs.readFileSync(file, 'utf8');
  const d = JSON.parse(o);
  fn(d);
  fs.writeFileSync(file, JSON.stringify(d, null, 1));
  return () => fs.writeFileSync(file, o);
}

const results = [];
async function probe(name, material, mutate, weapon) {
  const before = await fight(material, weapon);
  const restore = patch(CL, mutate);
  let after;
  try { after = await fight(material, weapon); } finally { restore(); }
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  results.push({ name, material, weapon: weapon || 'straight-sword', changed, before, after });
  console.log(`${changed ? 'CONSUMED  ' : 'INERT     '} ${name}   [vs ${material}]`);
  console.log(`     before ${JSON.stringify(before)}`);
  console.log(`     after  ${JSON.stringify(after)}`);
}

// --- the six round-2 probes, each driven against the material it is ABOUT --------------------
await probe('hitstop.attacker.<tier>.flesh 8 -> 40', 'flesh',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].flesh = 40; });
await probe('hitstop.attacker.<tier>.stone -> 99', 'stone',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].stone = 99; },
  'mce_bog_iron_mace');
await probe('hitstop.attacker.<tier>.chitin -> 99', 'chitin',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].chitin = 99; });
await probe('hitstop.attacker.<tier>.metal -> 99', 'metal',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].metal = 99; });
await probe('hitstop.attacker.<tier>.wood -> 99', 'wood',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].wood = 99; });
await probe('hitstop.attacker.<tier>.shield -> 99', 'shield',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].shield = 99; });
await probe('hitstop.attacker.<tier>.water -> 99', 'water',
  (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].water = 99; });
await probe('materials.multipliers ALL -> 0.01', 'flesh',
  (d) => { for (const m of Object.keys(d.materials.multipliers)) for (const k of Object.keys(d.materials.multipliers[m])) d.materials.multipliers[m][k] = 0.01; });
await probe('materials.multipliers.stone.strike 1.35 -> 0.01', 'stone',
  (d) => { d.materials.multipliers.stone.strike = 0.01; }, 'mce_bog_iron_mace');
await probe('materials.multipliers.plant.slash 1.25 -> 0.01', 'plant',
  (d) => { d.materials.multipliers.plant.slash = 0.01; });
await probe('hitstop.knockback_m ALL -> 9', 'flesh',
  (d) => { for (const t of Object.keys(d.hitstop.knockback_m)) for (const m of Object.keys(d.hitstop.knockback_m[t])) d.hitstop.knockback_m[t][m] = 9; });
await probe('hitstop.knockback_m.<tier>.stone -0.2 -> -4 (attacker bounce)', 'stone',
  (d) => { for (const t of Object.keys(d.hitstop.knockback_m)) d.hitstop.knockback_m[t].stone = -4; },
  'mce_bog_iron_mace');
await probe('hitstop.deflect.hitstop_multiplier 1.5 -> 20', 'stone',
  (d) => { d.hitstop.deflect.hitstop_multiplier = 20; });
await probe('hitstop.deflect.added_recovery_f 16 -> 200', 'stone',
  (d) => { d.hitstop.deflect.added_recovery_f = 200; });
await probe('hitstop.deflect.poise_damage_below 30 -> 0 (nothing deflects)', 'stone',
  (d) => { d.hitstop.deflect.poise_damage_below = 0; });
await probe('hitstop.victim_delta.flesh 4 -> 60', 'flesh',
  (d) => { d.hitstop.victim_delta.flesh = 60; });
// Driven against PLANT, not stone: a straight sword on stone DEFLECTS, and a deflect is a
// function of `shape` rather than of damage type, so a stone probe reads 0 damage either way and
// the perturbation is masked. Plant does not deflect, so the slash(1.25) -> strike(0.85) swap is
// visible as damage. A probe that cannot see the thing it perturbs is not evidence of inertness.
await probe('materials.damage_type_of_shape ALL -> strike', 'plant',
  (d) => { for (const k of Object.keys(d.materials.damage_type_of_shape)) d.materials.damage_type_of_shape[k] = 'strike'; });

const inert = results.filter((r) => !r.changed);
const out = {
  generated: new Date().toISOString(),
  consumed: results.length - inert.length,
  total: results.length,
  inert: inert.map((r) => r.name),
  results,
};
fs.writeFileSync(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/dev/stdout', JSON.stringify(out, null, 1));
console.log(`\n${out.consumed}/${out.total} CONSUMED. INERT: ${out.inert.join(' | ') || 'none'}`);
if (process.argv.includes('--gate') && inert.length) process.exit(1);
