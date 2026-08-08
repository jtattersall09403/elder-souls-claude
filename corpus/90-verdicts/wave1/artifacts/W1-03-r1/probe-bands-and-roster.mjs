// critic-w1-03 independent probe. Bare Node, real shipped modules, no browser.
// Angle 3: perturb a DEPTH and watch a body change what it can do — both races, both sides.
// Angle 4: fail-closed defaults on the dummies.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
import { Traversal, isAmphibiousRace, bandIndex } from '/home/user/elder-souls-claude/game/src/sim/traversal.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const ROOT = '/home/user/elder-souls-claude';
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const TERRAIN = rd('game/data/world/terrain.json');
const REGIONS = rd('game/data/world/regions.json');
const WATER = rd('game/data/world/water.json');
const TRAV = rd('game/data/world/traversal.json');

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

const field = new WorldField(TERRAIN, REGIONS, WATER);

// ---------------------------------------------------------------------------
// 0. Find REAL world points at each band, so nothing here is a synthetic depth.
// ---------------------------------------------------------------------------
const want = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5'];
const found = {};
outer:
for (let x = 20; x < field.sizeX - 20; x += 7) {
  for (let z = 20; z < field.sizeZ - 20; z += 7) {
    const w = field.waterAt(x, z);
    if (w && w.band && !found[w.band]) {
      found[w.band] = { x, z, depth: w.depth_m, band: w.band, surf: field.waterSurfaceAt(x, z) };
      if (want.every((b) => found[b])) break outer;
    }
  }
}
console.log('\n--- real world points, one per band (shipped field, no synthesis) ---');
for (const b of want) console.log(b, JSON.stringify(found[b]));

// ---------------------------------------------------------------------------
// 1. PLAYER SIDE. Same real point, two races. Perturb the DEPTH by moving the
//    body between real points and watch the legal action set change.
// ---------------------------------------------------------------------------
function runAt(pt, race, frames = 120, opts = {}) {
  const t = new Traversal(JSON.parse(JSON.stringify(TRAV)), field);
  const p = {
    pos: [pt.x, field.heightAt(pt.x, pt.z), pt.z], yaw: 0, hp: 1000, hpMax: 1000,
    stamina: 100, staminaMax: 100, state: 'IDLE', frameNow: 0, regenBlockUntil: 0,
  };
  if (opts.sink) p.pos[1] = field.heightAt(pt.x, pt.z);
  const stam0 = p.stamina;
  for (let i = 0; i < frames; i++) {
    p.frameNow = i;
    const px = p.pos[0], pz = p.pos[2];
    // a real requested displacement, so "moving" drains are exercised
    p.pos[0] += 0.5 / 60;
    t.step(p, px, pz, 1, true, null, race);
  }
  return {
    band: t.band, depth: +t.depth.toFixed(3), amphibious: t.amphibious,
    denies_attack: t.denies('attack'), denies_block: t.denies('block'),
    denies_sprint: t.denies('sprint'), denies_roll: t.denies('roll'),
    submerged: t.submerged, breath: +t.breath.toFixed(2),
    stam_spent: +(stam0 - p.stamina).toFixed(3),
    regen_suppressed: !!t.regenSuppressed, drain_per_s: +(t.staminaDrainPerS || 0).toFixed(3),
  };
}

console.log('\n=== 1. PLAYER SIDE — same point, two races ===');
const table = {};
for (const b of want) {
  if (!found[b]) continue;
  const nord = runAt(found[b], 'nord');
  const sax = runAt(found[b], 'saxhleel');
  table[b] = { nord, sax };
  console.log(`${b} d=${nord.depth}  NORD attack_denied=${nord.denies_attack} stam=${nord.stam_spent} drain/s=${nord.drain_per_s} regenSup=${nord.regen_suppressed}`);
  console.log(`${b} d=${sax.depth}  SAXH attack_denied=${sax.denies_attack} stam=${sax.stam_spent} drain/s=${sax.drain_per_s} regenSup=${sax.regen_suppressed} amph=${sax.amphibious}`);
}

// The three RI-WLD10 §3 privileges, each as an independent assertion.
check('P1 W4 attack denied for Nord, allowed for Saxhleel (§3 privilege 3 / §5 R2)',
  table.W4 && table.W4.nord.denies_attack === true && table.W4.sax.denies_attack === false,
  table.W4 ? `nord=${table.W4.nord.denies_attack} sax=${table.W4.sax.denies_attack}` : 'no W4 point found');
check('P2 W5 attack denied for BOTH (§3: "W5 remains no-attack for everyone")',
  table.W5 && table.W5.nord.denies_attack === true && table.W5.sax.denies_attack === true,
  table.W5 ? `nord=${table.W5.nord.denies_attack} sax=${table.W5.sax.denies_attack}` : 'no W5 point');
check('P3 W5 stamina drain zeroed for Saxhleel, non-zero for Nord (§3 privilege 2)',
  table.W5 && table.W5.nord.stam_spent > 0 && table.W5.sax.stam_spent === 0,
  table.W5 ? `nord=${table.W5.nord.stam_spent} sax=${table.W5.sax.stam_spent}` : 'no W5 point');
check('P4 W5 regen suppression lifted for Saxhleel only',
  table.W5 && table.W5.nord.regen_suppressed === true && table.W5.sax.regen_suppressed === false,
  table.W5 ? `nord=${table.W5.nord.regen_suppressed} sax=${table.W5.sax.regen_suppressed}` : '-');
check('P5 W3/W4 drain halved for Saxhleel, not zeroed (§3: "still apply at x0.5")',
  table.W4 && table.W4.nord.drain_per_s > 0
    && Math.abs(table.W4.sax.drain_per_s - table.W4.nord.drain_per_s * 0.5) < 1e-6,
  table.W4 ? `nord=${table.W4.nord.drain_per_s}/s sax=${table.W4.sax.drain_per_s}/s` : '-');

// PERTURBATION, the real one: move ONE body across a real depth gradient and
// watch its legal action set flip. A still target hides every defect (rule 8).
console.log('\n=== 1b. PERTURBATION: walk one body down a real depth gradient ===');
function gradientWalk(race) {
  const t = new Traversal(JSON.parse(JSON.stringify(TRAV)), field);
  const a = found.W0, b = found.W5;
  const rows = [];
  const p = { pos: [a.x, field.heightAt(a.x, a.z), a.z], yaw: 0, hp: 1000, hpMax: 1000, stamina: 1e6, staminaMax: 1e6, state: 'IDLE', frameNow: 0, regenBlockUntil: 0 };
  const N = 200;
  let lastBand = null;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const px = p.pos[0], pz = p.pos[2];
    p.pos[0] = a.x + (b.x - a.x) * u; p.pos[2] = a.z + (b.z - a.z) * u;
    p.pos[1] = field.heightAt(p.pos[0], p.pos[2]);
    p.frameNow = i;
    t.step(p, px, pz, 1, true, null, race);
    if (t.band !== lastBand) { rows.push({ u: +u.toFixed(3), band: t.band, d: +t.depth.toFixed(2), atk: t.denies('attack'), spr: t.denies('sprint'), roll: t.denies('roll') }); lastBand = t.band; }
  }
  return rows;
}
const gN = gradientWalk('nord'), gS = gradientWalk('saxhleel');
console.log('NORD    ', JSON.stringify(gN));
console.log('SAXHLEEL', JSON.stringify(gS));
const nBands = gN.filter((r) => r.atk).map((r) => r.band);
const sBands = gS.filter((r) => r.atk).map((r) => r.band);
check('P6 a MOVING body flips its legal action set at a real depth boundary',
  gN.length >= 3 && nBands.length > 0, `nord band sequence ${gN.map((r) => r.band).join('>')}, attack denied in [${nBands}]`);
check('P7 the two races differ ON THE SAME WALK (M51 §5: "FAIL if the two are identical")',
  JSON.stringify(nBands) !== JSON.stringify(sBands), `nord denied in [${nBands}] vs saxhleel denied in [${sBands}]`);

// DELETE-THE-FIX (rule 6): drop the race argument, confirm the old number returns.
console.log('\n=== 1c. DELETE-THE-FIX: call step() with six arguments, as before ===');
function runNoRace(pt) {
  const t = new Traversal(JSON.parse(JSON.stringify(TRAV)), field);
  const p = { pos: [pt.x, field.heightAt(pt.x, pt.z), pt.z], yaw: 0, hp: 1000, hpMax: 1000, stamina: 100, staminaMax: 100, state: 'IDLE', frameNow: 0, regenBlockUntil: 0 };
  for (let i = 0; i < 120; i++) { p.frameNow = i; const px = p.pos[0], pz = p.pos[2]; p.pos[0] += 0.5 / 60; t.step(p, px, pz, 1, true, null); }
  return { band: t.band, amph: t.amphibious, atk: t.denies('attack'), stam: +(100 - p.stamina).toFixed(3) };
}
const old4 = runNoRace(found.W4), old5 = runNoRace(found.W5);
console.log('no-race W4', JSON.stringify(old4), ' W5', JSON.stringify(old5));
check('P8 delete-the-fix: dropping the 7th argument returns the pre-fix behaviour',
  old4.amph === false && old4.atk === true && old5.atk === true,
  `W4 amph=${old4.amph} atk_denied=${old4.atk}`);
check('P9 the two arms actually differ (rule 6: an inert fix has passed here twice)',
  old4.atk !== (table.W4 && table.W4.sax.denies_attack), `no-race=${old4.atk} saxhleel=${table.W4 && table.W4.sax.denies_attack}`);

// ---------------------------------------------------------------------------
// 2. ENEMY SIDE. The producer expression is in engine.js and cannot be imported
//    in bare Node. Reproduce it EXACTLY from the source text, then assert the
//    reproduction matches the source, so this is not a second definition.
// ---------------------------------------------------------------------------
console.log('\n=== 2. ENEMY SIDE — declared bands over the real field ===');
const engSrc = readFileSync(join(ROOT, 'game/src/engine.js'), 'utf8');
const producer = /b\.waterDeniesAttack = bandIndex\(w\.band\) > bandIndex\(maxBand\);/.test(engSrc)
  && /const maxBand = stat\.water_max_band \|\| 'W0';/.test(engSrc);
check('E0 producer expression in engine.js is the one reproduced below', producer,
  "b.waterDeniesAttack = bandIndex(w.band) > bandIndex(stat.water_max_band || 'W0')");

const gate = engSrc.match(/_settleEnemyWater\(\) \{\n(.*)\n/);
console.log('  gate:', (engSrc.split('_settleEnemyWater() {')[1] || '').split('\n')[1].trim());

const eDir = join(ROOT, 'game/data/combat/enemies');
const stats = readdirSync(eDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(eDir, f), 'utf8')));
const denyAt = (stat, band) => bandIndex(band) > bandIndex(stat.water_max_band || 'W0');

console.log('\n  archetype              ai           native  max  denied at W0/W1/W2/W3/W4/W5');
for (const s of stats) {
  const row = want.map((b) => (denyAt(s, b) ? 'X' : '.')).join(' ');
  console.log(`  ${s.id.padEnd(22)} ${String(s.ai).padEnd(12)} ${String(!!s.water_native).padEnd(7)} ${String(s.water_max_band).padEnd(4)} ${row}`);
}

const natives = stats.filter((s) => s.water_native === true);
check('E1 >= 4 archetypes declare water_native (R6 count)', natives.length >= 4,
  `${natives.length}: ${natives.map((s) => s.id).join(', ')}`);
check('E2 every water_native declares water_max_band W5 (R6)',
  natives.every((s) => s.water_max_band === 'W5'), natives.map((s) => `${s.id}=${s.water_max_band}`).join(' '));

// R6's SECOND clause: "they must be genuinely dangerous there ... a water enemy that
// cannot hurt you is scenery" (M53.6: DPS in W5 >= 60% of the roster median on land).
// An `ai: 'none'` body never starts an action anywhere — enemy.js `_idleBehaviour`
// returns at the top — so its DPS is identically 0 in every band.
const inert = natives.filter((s) => s.ai === 'none' || s.ai === 'hold_ground');
check('E3 R6 second clause: every water_native can actually act (DPS in W5 > 0)',
  inert.length === 0,
  inert.length ? `${inert.length} of ${natives.length} natives have ai=${inert.map((s) => `${s.id}:${s.ai}`).join(',')} — never start an action, so DPS_W5 = 0` : 'all can act');
const dangerous = natives.filter((s) => s.ai === 'scripted');
check('E4 >= 4 water_native archetypes that are dangerous in W5 (R6 as written)',
  dangerous.length >= 4, `only ${dangerous.length}: ${dangerous.map((s) => s.id).join(', ')}`);

// FAIL-CLOSED: the 15 fixtures. Angle 4 — do they actually fail closed?
console.log('\n=== 2b. FAIL-CLOSED DEFAULTS ON THE FIXTURES ===');
const fixtures = stats.filter((s) => /^(cam_|mat_|dummy_|probe_)/.test(s.id));
check('E5 15 fixtures present', fixtures.length === 15, `${fixtures.length}: ${fixtures.map((s) => s.id).join(',')}`);
check('E6 every fixture declares W0 / native=false', fixtures.every((s) => s.water_max_band === 'W0' && s.water_native === false),
  fixtures.filter((s) => !(s.water_max_band === 'W0' && s.water_native === false)).map((s) => s.id).join(',') || 'all W0/false');
// break the instrument on purpose (rule 4): delete the field and confirm the
// default is still W0, i.e. the declared value and the fail-closed value agree.
const stripped = fixtures.map((s) => { const c = { ...s }; delete c.water_max_band; delete c.water_native; return c; });
check('E7 fail-closed: deleting the field on a fixture still denies above W0',
  stripped.every((s) => denyAt(s, 'W1') && denyAt(s, 'W5') && !denyAt(s, 'W0')),
  'declared W0 and absent-field W0 are the same stance — the declaration is documentation, not a behaviour change');
// ...which means the declaration on the fixtures is UNFALSIFIABLE by the code:
// deleting it changes nothing. Rule 4: a probe that cannot fail.
const actable = fixtures.filter((s) => s.ai === 'scripted');
check('E8 a fixture that could ever OBSERVE its denial exists',
  actable.length > 0, `${actable.length} of 15 fixtures have ai='scripted' (${actable.map((s) => s.id).join(',')}); the other ${15 - actable.length} have ai='none' and never start an action, so their declared stance is never read`);

console.log('\n=====================================');
const pass = results.filter((r) => r.ok).length;
console.log(`${pass}/${results.length} checks pass`);
for (const r of results.filter((x) => !x.ok)) console.log('  FAILED:', r.name, '--', r.detail);
