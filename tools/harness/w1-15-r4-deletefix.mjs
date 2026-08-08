#!/usr/bin/env node
// DELETE THE FIX — W1-15 round 4, as a 2x2, on staged copies outside the repo.
//
// `RULES.md` rule 6 names four shapes and says which one you have must be reported. The round-3
// critic ran this round's predecessor as a 2x2 and found the third one absent and something more
// useful in its place:
//
// > *"It is neither an inert fix nor two-guards-for-one-defect: two independent sites, each
// > individually sufficient to change the measurement. ... But arm `01` is the finding, and only a
// > 2x2 could produce it. Keep the lamps, restore the old ambient, and the room reads flat 1.0000
// > — spread 0. **The lamps alone do not make the room discriminate; the ambient drop does.**"*
//
// This round's light fix also has two sites, and they are not the same two:
//
//   SITE A — THE LIT SET IS SHARED. `sim/stealth/system.js` reads `INTLIGHT.litLights(rec)`, the
//            same function `render/interior.js` builds its point lights from. Cut it and the
//            simulation goes back to its own dedupe-and-light-everything policy with no rescue for
//            a room declaring no lamps, against a renderer that caps at five and invents a hearth.
//   SITE B — THE AMBIENT IS DERIVED. `interiorAmbientNow()` reads the room's window aperture. Cut
//            it and every interior goes back to the flat `unlit` row 0.0400 at every hour.
//
// Two measurements, so the 2x2 can separate them: the number of floor cells where the drawn room
// and the simulated room disagree about shadow, and the darkest floor value in the eleven rooms
// that declare no `lights[]`. A single measurement could not tell the sites apart and would have
// reported an inert arm.
//
// Nothing here is a switch inside the shipped code. The staged copies are real edits to real files
// in a scratch directory, and the stager THROWS unless each cut string occurs exactly once — a cut
// that silently matched nothing is the inert-control failure rule 6 spends a paragraph on.
//
// USAGE
//   node tools/harness/w1-15-r4-deletefix.mjs [--json <path>] [--keep]
//
// No browser.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const JSON_OUT = val('--json', null);
const KEEP = argv.includes('--keep');

const STAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'w1-15-r4-dtf-'));

/** The two cuts. Each is [file, exact-string-that-must-occur-once, replacement]. */
const CUT_A = ['src/sim/stealth/system.js',
  'for (const L of INTLIGHT.litLights(rec)) {',
  'for (const L of __r3SimLamps(rec)) {'];
// The r3 simulation policy, appended to the staged file: dedupe, light every survivor, rescue
// nothing. Verbatim in behaviour with `9126e02`'s `syncInteriorLights` loop.
const CUT_A_TAIL = `
function __r3SimLamps(rec) {
  const seen = new Set(); const out = [];
  for (const L of (rec && rec.lights) || []) {
    const q = L.pos || [0, 1.4, 0];
    const key = \`\${Math.round(q[0] * 10)},\${Math.round(q[1] * 10)},\${Math.round(q[2] * 10)}\`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ id: L.id || \`\${rec.id}:\${key}\`, kind: L.kind || 'lamp', hearth: L.kind === 'hearth',
      pos: [q[0], q[1], q[2]], emit_pos: [q[0], q[1], q[2]],
      intensity: Number(L.intensity === undefined ? 0.55 : L.intensity),
      snuffable: !!L.snuffable, synthesized: false, shadow: false });
  }
  return out;
}
`;
const CUT_B = ['src/world/interior-lighting.js',
  '  const bleed = Math.max(0, skyL) * k * plan.aperture_ratio;',
  '  const bleed = 0;   // DTF SITE B CUT: the flat `unlit` row, at every hour, as round 3 shipped it'];

function stage(name, cuts) {
  const dir = path.join(STAGE, name);
  fs.cpSync(path.join(ROOT, 'game'), dir, { recursive: true });
  for (const [rel, find, replace, tail] of cuts) {
    const f = path.join(dir, rel);
    const src = fs.readFileSync(f, 'utf8');
    const n = src.split(find).length - 1;
    if (n !== 1) throw new Error(`stage ${name}: cut string occurs ${n} time(s) in ${rel}, expected exactly 1 — the teardown would not have bitten:\n  ${find}`);
    fs.writeFileSync(f, src.replace(find, replace) + (tail || ''));
  }
  return dir;
}

/** The renderer's arm, at round 3: cap 5, private fail-open. Only used for the CONTROL check. */
async function measure(dir, label) {
  const THREE = await import(path.join(dir, 'vendor/three/three.module.js'));
  const { buildInterior } = await import(path.join(dir, 'src/render/interior.js'));
  const IL = await import(path.join(dir, 'src/world/interior-lighting.js'));
  const { LightField } = await import(path.join(dir, 'src/sim/stealth/light.js'));
  const { planSettlement, applyInteriorBounds } = await import(path.join(dir, 'src/render/exterior.js'));
  const DET = JSON.parse(fs.readFileSync(path.join(dir, 'data/stealth/detection.json'), 'utf8'));
  const CFG = DET.interior_lamps, SCALE = CFG.authored_intensity_to_L_scale, REACH = CFG.reach_m;
  const SHADOW_L = DET.light_table_L.find((r) => r.key === 'flame_far').L;

  // The staged copy of the SIM's lamp policy, reached the only honest way: read the staged
  // `system.js` and pull the function the cut swapped in, if it is there.
  const sysSrc = fs.readFileSync(path.join(dir, 'src/sim/stealth/system.js'), 'utf8');
  const simCut = sysSrc.includes('__r3SimLamps');
  const simLamps = simCut
    ? (rec) => {
      const seen = new Set(); const out = [];
      for (const L of (rec && rec.lights) || []) {
        const q = L.pos || [0, 1.4, 0];
        const key = `${Math.round(q[0] * 10)},${Math.round(q[1] * 10)},${Math.round(q[2] * 10)}`;
        if (seen.has(key)) continue; seen.add(key);
        out.push({ pos: [q[0], q[1], q[2]], authored: Number(L.intensity === undefined ? 0.55 : L.intensity), hearth: L.kind === 'hearth' });
      }
      return out;
    }
    : (rec) => IL.litLights(rec).map((L) => ({ pos: L.emit_pos, authored: L.intensity, hearth: L.hearth }));

  const idir = path.join(dir, 'data/world/interiors');
  const list = fs.readdirSync(idir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(idir, f), 'utf8')));
  const I = {}; for (const r of list) I[r.id] = r;
  const sdir = path.join(dir, 'data/world/settlements');
  const docs = fs.readdirSync(sdir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')));
  applyInteriorBounds(docs.map((d) => planSettlement(d, I)), I, docs, {});

  const field = (lamps, amb) => {
    const f = new LightField(DET); f.defaultAmbient = amb; let i = 0;
    for (const L of lamps) f.addSource({ id: `x${i++}`, pos: L.pos, intensity: L.authored * SCALE, reach_m: L.hearth ? REACH.hearth : REACH.flame, zone: null });
    return f;
  };
  const renderLamps = (rec) => {
    const root = new THREE.Group();
    buildInterior(root, rec, {});
    const out = [];
    root.traverse((o) => { if (o.isPointLight) { const hearth = o.color.getHex() === 0xffa050; out.push({ pos: [o.position.x, o.position.y, o.position.z], authored: o.intensity / (hearth ? 22 : 9), hearth }); } });
    return out;
  };

  let cells = 0, disagree = 0, litDark = 0;
  let worstNoLights = Infinity;
  for (const rec of list) {
    const b = rec.bounds_m;
    const amb = IL.interiorAmbientL(rec, 1.00, { unlit_L: CFG.interior_ambient_L, daylight_k: CFG.window_daylight_k }).L;
    const fr = field(renderLamps(rec), amb), fs2 = field(simLamps(rec), amb);
    const bare = !((rec.lights || []).length);
    for (let x = b.x[0]; x <= b.x[1]; x += 1) {
      for (let z = b.z[0]; z <= b.z[1]; z += 1) {
        cells++;
        const lr = fr.sample(x, b.y[0] + 1.35, z, null), ls = fs2.sample(x, b.y[0] + 1.35, z, null);
        if ((lr >= SHADOW_L) !== (ls >= SHADOW_L)) { disagree++; if (lr >= SHADOW_L) litDark++; }
        if (bare && ls < worstNoLights) worstNoLights = ls;
      }
    }
  }
  return { arm: label, cells, disagree, drawn_lit_sim_dark: litDark,
    worst_floor_in_the_eleven_rooms: +worstNoLights.toFixed(4),
    ambient_of_a_windowed_shop_at_full_sun: +IL.interiorAmbientL(I['thorn-inn'], 1.00, { unlit_L: CFG.interior_ambient_L, daylight_k: CFG.window_daylight_k }).L.toFixed(4) };
}

const arms = [
  ['00_shipped', []],
  ['10_lit_set_cut', [[...CUT_A, CUT_A_TAIL]]],
  ['01_ambient_cut', [CUT_B]],
  ['11_both_cut', [[...CUT_A, CUT_A_TAIL], CUT_B]],
];
const results = [];
for (const [name, cuts] of arms) results.push(await measure(stage(name, cuts), name));

const bar = '='.repeat(96);
process.stdout.write(`\nW1-15 r4 — DELETE THE FIX, 2x2 over the light fix's two sites\n${bar}\n`);
process.stdout.write(`  ${'arm'.padEnd(18)} ${'lit set'.padEnd(9)} ${'ambient'.padEnd(9)} ${'disagreeing'.padStart(12)} ${'drawn-lit-sim-dark'.padStart(19)} ${'worst floor, the 11'.padStart(20)} ${'shop @ sun'.padStart(11)}\n`);
const label = { '00_shipped': ['shared', 'derived'], '10_lit_set_cut': ['CUT', 'derived'], '01_ambient_cut': ['shared', 'CUT'], '11_both_cut': ['CUT', 'CUT'] };
for (const r of results) {
  const [a, b] = label[r.arm];
  process.stdout.write(`  ${r.arm.padEnd(18)} ${a.padEnd(9)} ${b.padEnd(9)} ${String(r.disagree).padStart(12)} ${String(r.drawn_lit_sim_dark).padStart(19)} ${String(r.worst_floor_in_the_eleven_rooms).padStart(20)} ${String(r.ambient_of_a_windowed_shop_at_full_sun).padStart(11)}\n`);
}

const shipped = results[0], cutA = results[1], cutB = results[2], both = results[3];
const aBites = cutA.disagree > shipped.disagree;
const bBites = cutB.worst_floor_in_the_eleven_rooms < shipped.worst_floor_in_the_eleven_rooms
  || cutB.ambient_of_a_windowed_shop_at_full_sun < shipped.ambient_of_a_windowed_shop_at_full_sun;
const independent = aBites && bBites;
process.stdout.write(`\n  WHICH OF RULE 6'S SHAPES: `);
if (!aBites && !bBites) process.stdout.write('AN INERT FIX — neither cut moved anything. The measurement was carried by something else.\n');
else if (!aBites || !bBites) process.stdout.write(`TWO GUARDS FOR ONE DEFECT, or one inert site: ${aBites ? 'B' : 'A'} did not move its own measurement alone.\n`);
else process.stdout.write('TWO INDEPENDENT SITES, each individually sufficient on its OWN measurement and neither on the other\'s.\n');
process.stdout.write(`    site A (the shared lit set) owns the drawn-vs-simulated disagreement: ${shipped.disagree} -> ${cutA.disagree} cells when cut.\n`);
process.stdout.write(`    site B (the derived ambient) owns the eleven rooms and the daylight: floor ${shipped.worst_floor_in_the_eleven_rooms} -> ${cutB.worst_floor_in_the_eleven_rooms}, shop ambient ${shipped.ambient_of_a_windowed_shop_at_full_sun} -> ${cutB.ambient_of_a_windowed_shop_at_full_sun}.\n`);
process.stdout.write(`    cutting BOTH gives ${both.disagree} disagreeing cells and a floor of ${both.worst_floor_in_the_eleven_rooms} — round 3's build.\n`);
// AND THE HONEST QUALIFICATION, because rule 6 says to say WHICH shape you have and this number
// has a different one from the one above. Cutting either site alone leaves the eleven rooms above
// the `unlit` row — site A alone because the derived ambient still lets daylight in, site B alone
// because the shared fail-open still gives them a hearth — and only cutting BOTH puts them back at
// 0.0400. On THAT measurement this is rule 6's fourth shape, two guards for one defect, and
// reporting it as "two independent sites" without this line would be the overclaim the rule warns
// about. It is two independent sites for the DISAGREEMENT and two guards for the ELEVEN ROOMS.
const guards = cutA.worst_floor_in_the_eleven_rooms > 0.0401 && cutB.worst_floor_in_the_eleven_rooms > 0.0401
  && Math.abs(both.worst_floor_in_the_eleven_rooms - 0.04) < 1e-6;
process.stdout.write(`    ON THE ELEVEN ROOMS SPECIFICALLY it is the OTHER shape: ${guards ? 'TWO GUARDS FOR ONE DEFECT' : 'not two guards'} — ` +
  `A alone ${cutA.worst_floor_in_the_eleven_rooms}, B alone ${cutB.worst_floor_in_the_eleven_rooms}, both ${both.worst_floor_in_the_eleven_rooms}. ` +
  'Either fix alone lifts them off the `unlit` row; only removing both puts them back.\n');
process.stdout.write(`\n  ${independent && shipped.disagree === 0 ? 'PASS' : 'FAIL'}  the shipped arm must be 0 (got ${shipped.disagree}) and BOTH cuts must bite on their own measurement.\n\n`);

if (JSON_OUT) {
  fs.mkdirSync(path.dirname(path.join(ROOT, JSON_OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, JSON_OUT), JSON.stringify({ arms: results, stage: KEEP ? STAGE : null, a_bites: aBites, b_bites: bBites, independent }, null, 2) + '\n');
  process.stdout.write(`  wrote ${JSON_OUT}\n\n`);
}
if (!KEEP) fs.rmSync(STAGE, { recursive: true, force: true });
else process.stdout.write(`  staged trees kept at ${STAGE}\n`);
process.exit(independent && shipped.disagree === 0 ? 0 : 1);
