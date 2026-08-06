// CONSUMPTION, part 3: the RI-WPN05 §A/§B impact + material model.
'use strict';
import fs from 'node:fs';
const ROOT = '/home/user/elder-souls-claude';
const CL = `${ROOT}/game/data/weapons/classes.json`;
async function fight() {
  const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs?v=${Math.random()}`);
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon: 'straight-sword' } });
  const e = a.spawn('t', 'dummy_passive', 0, 1.2, 180); a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp; let hitF = null, holdF = 0, prevAnim = -1, held = 0;
  for (let i = 0; i < 240; i++) {
    a.step();
    for (const ev of a.drain()) if (ev.kind === 'HIT' && hitF === null) hitF = ev.f;
    if (hitF !== null && a.player.animFrame === prevAnim) held++;
    prevAnim = a.player.animFrame;
  }
  return { dmg: +(hp0 - e.hp).toFixed(2), hitF, hitstop_held_frames: held };
}
function patch(file, fn) { const o = fs.readFileSync(file, 'utf8'); const d = JSON.parse(o); fn(d); fs.writeFileSync(file, JSON.stringify(d, null, 1)); return () => fs.writeFileSync(file, o); }
const results = [];
async function probe(name, mutate) {
  const before = await fight(); const r = patch(CL, mutate); let after;
  try { after = await fight(); } finally { r(); }
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  results.push({ name, changed, before, after });
  console.log(`${changed ? 'CONSUMED  ' : 'INERT     '} ${name}\n     before ${JSON.stringify(before)}  after ${JSON.stringify(after)}`);
}
await probe('hitstop.attacker.<tier>.flesh  8 -> 40', (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].flesh = 40; });
await probe('hitstop.attacker.<tier>.stone  -> 99', (d) => { for (const t of Object.keys(d.hitstop.attacker)) d.hitstop.attacker[t].stone = 99; });
await probe('hitstop.attacker.<tier>.metal/chitin/wood/shield -> 99', (d) => { for (const t of Object.keys(d.hitstop.attacker)) for (const m of ['metal', 'chitin', 'wood', 'shield']) d.hitstop.attacker[t][m] = 99; });
await probe('materials.multipliers ALL -> 0.01', (d) => { for (const m of Object.keys(d.materials.multipliers)) for (const k of Object.keys(d.materials.multipliers[m])) d.materials.multipliers[m][k] = 0.01; });
await probe('hitstop.knockback_m ALL -> 9', (d) => { for (const t of Object.keys(d.hitstop.knockback_m)) for (const m of Object.keys(d.hitstop.knockback_m[t])) d.hitstop.knockback_m[t][m] = 9; });
await probe('hitstop.deflect.hitstop_multiplier 1.5 -> 20', (d) => { d.hitstop.deflect.hitstop_multiplier = 20; });
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify({ results }, null, 1));
const inert = results.filter((r) => !r.changed);
console.log(`\n${results.length - inert.length}/${results.length} consumed. INERT: ${inert.map((r) => r.name).join(' | ') || 'none'}`);
