// DOES THE ROOM THE PLAYER SEES AGREE WITH THE ROOM THE GAME SIMULATES?
//
// W1-15 round 4. This is the instrument for the round-3 verdict's §1, re-derived rather than
// inherited, and it is built so that it can go red: the two arms are taken from the two REAL
// code paths — `render/interior.js` is actually run into a Three.js scene graph and its
// `PointLight`s are read back off it, and `world/interior-lighting.js#litLights()` is asked
// separately — so if those two ever disagree again this tool says so.
//
// THE NUMBER IT EXISTS TO REPRODUCE, from `corpus/90-verdicts/wave1/W1-15-r3.md` §1:
//
//   | interiors with more deduped lamps than LIT_CAP | 77 / 115, max 14 |
//   | interiors declaring no lamp at all             | 11 / 115         |
//   | cells drawn dark, simulated lit                | 75               |
//   | cells drawn lit, simulated dark                | 1,584            |
//   | total                                          | 1,659 / 22,751 = 7.29% |
//
// `--control=r3` restores round 3's two policies (the renderer's `LIT_CAP = 5` and its private
// fail-open hearth, against a simulation that had neither) and must bring those numbers back.
// A run whose control does not go red is a run with one arm, and RULES.md 6 names that failure by
// name: *"a control you have never seen fail is not evidence, it is a second copy of the
// experiment."*
//
// USAGE
//   node tools/harness/w1-15-r4-lights.mjs [--control=r3] [--json <path>] [--hour <h>] [--verbose]
//   node tools/harness/w1-15-r4-lights.mjs --selftest
//
// No browser. Every number is a light value on a grid.

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import { buildInterior } from '../../game/src/render/interior.js';
import { litLights, windowPlan, interiorAmbientL, UNLIT_L, DAYLIGHT_K, CANOPY_DAY_L } from '../../game/src/world/interior-lighting.js';
import { LightField } from '../../game/src/sim/stealth/light.js';
import { planSettlement, applyInteriorBounds } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const has = (f) => argv.some((a) => a === f || a.startsWith(`${f}=`));
const val = (f, d) => { const a = argv.find((x) => x.startsWith(`${f}=`)); if (a) return a.slice(f.length + 1); const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const CONTROL = val('--control', null);
const JSON_OUT = val('--json', null);
const VERBOSE = has('--verbose');

const DET = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/stealth/detection.json'), 'utf8'));
const CFG = DET.interior_lamps;
const SCALE = CFG.authored_intensity_to_L_scale;
const REACH = CFG.reach_m;

/**
 * THE ROOMS THE WORLD BUILDS, NOT THE ROOMS THE FILES DECLARE.
 *
 * `render/exterior.js#applyInteriorBounds()` fits every room to the building drawn around it at
 * load and SHRINKS 112 of the 115 — `archon-apothecary` from 13.6 x 15.6 m to 9.83 x 4.98 m. An
 * offline tool that reads the JSON and stops has measured a different province from the one the
 * player walks around in, and this round nearly shipped a lighting constant derived that way. The
 * same join runs here, from the same module, before anything is sampled.
 *
 * `--declared` skips it, so the difference is a flag rather than an argument.
 */
function interiors() {
  const dir = path.join(ROOT, 'game/data/world/interiors');
  const list = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  if (has('--declared')) return list;
  const I = {};
  for (const r of list) I[r.id] = r;
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  const docs = fs.readdirSync(sdir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')));
  applyInteriorBounds(docs.map((d) => planSettlement(d, I)), I, docs, {});
  return list;
}

// ---- THE SKY, copied from `sim/stealth/system.js#skyAmbient` for the clear-weather case only ----
// Only the hours matter here and the weather is held at clear, so this is the day/night ramp and
// nothing else. If it ever disagrees with the sim's, `--selftest` arm 4 says so.
function skyClear(h) {
  const day = 1.00, night = 0.22;
  if (h >= 8 && h < 17) return day;
  if (h >= 21 || h < 4) return night;
  if (h >= 4 && h < 8) return night + (day - night) * ((h - 4) / 4);
  return day + (night - day) * ((h - 17) / 4);
}

// ---- ARM R: WHAT IS ACTUALLY DRAWN ------------------------------------------------------------
// `render/interior.js` is RUN, into a real scene graph, and the point lights are read back off it.
// Nothing here re-implements the renderer's policy; if the renderer changes, this arm changes.
function rendererArm(rec, opts) {
  const root = new THREE.Group();
  buildInterior(root, rec, opts || {});
  const out = [];
  root.traverse((o) => {
    if (!o.isPointLight) return;
    const hearth = o.color.getHex() === 0xffa050;
    // Undo the renderer's own Three.js scaling to recover the AUTHORING weight, which is the only
    // unit the simulation and the renderer share.
    const authored = o.intensity / (hearth ? 22 : 9);
    out.push({ pos: [o.position.x, o.position.y, o.position.z], authored, hearth });
  });
  return out;
}

// ---- ARM R', THE ROUND-3 CONTROL ---------------------------------------------------------------
// The renderer's policy as it stood at `9126e02`: dedupe, light the first five, and invent a
// hearth if none were lit. Reconstructed here rather than left in the shipped file.
function rendererArmR3(rec) {
  const b = rec.bounds_m || { x: [-6, 6], y: [0, 3.2], z: [-9, 9] };
  const seen = new Set();
  const unique = [];
  for (const L of rec.lights || []) {
    const p = L.pos || [0, 1.4, 0];
    const key = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key); unique.push(L);
  }
  const out = [];
  for (const L of unique) {
    if (out.length >= 5) break;                       // LIT_CAP
    const p = L.pos || [0, 1.4, 0];
    const hearth = L.kind === 'hearth';
    out.push({ pos: [p[0], p[1] + (hearth ? 0.5 : 0), p[2]], authored: Number(L.intensity === undefined ? 0.7 : L.intensity), hearth });
  }
  if (!out.length) {                                  // the renderer-only fail-open
    const key = rec.light || { pos: [0, 0.7, 0], intensity: 1.0 };
    out.push({ pos: [key.pos[0], b.y[0] + 1.0, key.pos[2]], authored: 20 / 22, hearth: true });
  }
  return out;
}

/** The simulation's answer, at `9126e02`: every deduped lamp, and no rescue. */
function simArmR3(rec) {
  const seen = new Set();
  const out = [];
  for (const L of rec.lights || []) {
    const p = L.pos || [0, 1.4, 0];
    const key = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pos: [p[0], p[1], p[2]], authored: Number(L.intensity === undefined ? 0.55 : L.intensity), hearth: L.kind === 'hearth' });
  }
  return out;
}

/** The simulation's answer, shipped. */
function simArm(rec) {
  return litLights(rec).map((L) => ({ pos: L.emit_pos, authored: L.intensity, hearth: L.hearth }));
}

// ---- THE FIELD, the simulation's own, on BOTH arms so the only variable is which lamps are lit --
function fieldFor(lamps, ambient, scale = SCALE) {
  const f = new LightField(DET);
  f.defaultAmbient = ambient;
  let i = 0;
  for (const L of lamps) {
    f.addSource({
      id: `x${i++}`, pos: L.pos, intensity: L.authored * scale,
      reach_m: L.hearth ? REACH.hearth : REACH.flame, zone: null,
    });
  }
  return f;
}

/**
 * The 1 m chest-height grid the round-3 verdict measured on, and the DENOMINATOR IS THE CHECK.
 *
 * The verdict's grid is 22,751 cells over the 115 interiors. Stepping 1 m from `bounds_m.x[0]`
 * inclusive of both ends reproduces that exactly; snapping to integer coordinates instead
 * (`ceil(x0)..floor(x1)`) gives 21,708, and rounding the extents gives 20,586. This tool uses the
 * one that lands on the published denominator, so its 0 and the verdict's 1,659 are counted over
 * the same floor rather than over two floors that happen to be the same shape.
 */
function cells(rec) {
  const b = rec.bounds_m || { x: [-6, 6], y: [0, 3.2], z: [-9, 9] };
  const out = [];
  for (let x = b.x[0]; x <= b.x[1]; x += 1) {
    for (let z = b.z[0]; z <= b.z[1]; z += 1) out.push([x, b.y[0] + 1.35, z]);
  }
  return out;
}

/** RI-STL01 §3's own boundary between "in shadow" and "lit": the `flame_far` row. */
const SHADOW_L = DET.light_table_L.find((r) => r.key === 'flame_far').L;   // 0.25

function run(mode, hour) {
  const list = interiors();
  const rows = [];
  let totalCells = 0, disagree = 0, drawnLitSimDark = 0, drawnDarkSimLit = 0, overCap = 0, maxLamps = 0, noLights = 0;
  for (const rec of list) {
    const declaredUnique = new Set((rec.lights || []).map((L) => {
      const p = L.pos || [0, 1.4, 0];
      return `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
    })).size;
    if (declaredUnique > 5) overCap++;
    if (declaredUnique > maxLamps) maxLamps = declaredUnique;
    if (declaredUnique === 0) noLights++;

    const R = mode === 'r3' ? rendererArmR3(rec) : rendererArm(rec);
    const S = mode === 'r3' ? simArmR3(rec) : simArm(rec);
    // Round 3 pinned every interior at the flat constant; the shipped build derives it. Both arms
    // of one run share an ambient, because the ambient is not what this comparison is about.
    const amb = mode === 'r3' ? CFG.interior_ambient_L : interiorAmbientL(rec, skyClear(hour)).L;
    const fr = fieldFor(R, amb), fsim = fieldFor(S, amb);
    let dis = 0, lit_dark = 0, dark_lit = 0, cs = 0;
    for (const c of cells(rec)) {
      cs++;
      const lr = fr.sample(c[0], c[1], c[2], null);
      const ls = fsim.sample(c[0], c[1], c[2], null);
      const rLit = lr >= SHADOW_L, sLit = ls >= SHADOW_L;
      if (rLit !== sLit) { dis++; if (rLit) lit_dark++; else dark_lit++; }
    }
    totalCells += cs; disagree += dis; drawnLitSimDark += lit_dark; drawnDarkSimLit += dark_lit;
    rows.push({ id: rec.id, kind: rec.interior_kind, declared_unique: declaredUnique,
      renderer_lights: R.length, sim_sources: S.length, cells: cs, disagree: dis,
      drawn_lit_sim_dark: lit_dark, drawn_dark_sim_lit: dark_lit, ambient: +amb.toFixed(4) });
  }
  return { mode, hour, interiors: list.length, cells: totalCells, disagree, drawnLitSimDark,
    drawnDarkSimLit, over_cap: overCap, max_lamps: maxLamps, no_lights: noLights,
    pct: +(disagree / totalCells * 100).toFixed(2), rows };
}

/** The eleven rooms round 3 regressed, at four hours, before and after. */
function regressedRooms() {
  const list = interiors().filter((r) => !(r.lights || []).length);
  const out = [];
  for (const rec of list) {
    const row = { id: rec.id, kind: rec.interior_kind, windows: windowPlan(rec).count, hours: {} };
    for (const h of [3, 9, 12, 21]) {
      const amb = interiorAmbientL(rec, skyClear(h));
      const lamps = simArm(rec);
      const f = fieldFor(lamps, amb.L);
      const cs = cells(rec);
      let min = Infinity, max = -Infinity;
      for (const c of cs) { const L = f.sample(c[0], c[1], c[2], null); if (L < min) min = L; if (L > max) max = L; }
      row.hours[h] = { ambient: +amb.L.toFixed(4), L_min: +min.toFixed(4), L_max: +max.toFixed(4),
        spread: +(max - min).toFixed(4), r3_L_was: CFG.interior_ambient_L, sources: lamps.length };
    }
    out.push(row);
  }
  return out;
}

// ---- SELFTEST: five arms, each broken on purpose -----------------------------------------------
if (has('--selftest')) {
  const fail = (m) => { process.stderr.write(`SELFTEST FAILED: ${m}\n`); process.exit(21); };
  // 1. A synthetic 14-lamp room must disagree under the ROUND-3 policy and agree under the shipped one.
  const big = { id: 'selftest-14', interior_kind: 'shop', bounds_m: { x: [-7, 7], y: [0, 3.2], z: [-8, 8] },
    lights: Array.from({ length: 14 }, (_, i) => ({ id: `l${i}`, kind: 'oil-lamp', intensity: 0.55, pos: [-6.5 + i, 1.6, i % 2 ? 6 : -6] })) };
  const bigR3r = rendererArmR3(big), bigR3s = simArmR3(big);
  if (bigR3r.length !== 5) fail(`round-3 renderer arm lit ${bigR3r.length} of 14, expected the cap's 5`);
  if (bigR3s.length !== 14) fail(`round-3 sim arm lit ${bigR3s.length} of 14, expected all of them`);
  const bigNow = litLights(big);
  if (bigNow.length !== 14) fail(`shipped lit set is ${bigNow.length} of 14; the cap is supposed to be gone`);
  // 2. A room with NO lights must be rescued identically on both sides now, and asymmetrically before.
  const bare = { id: 'selftest-bare', interior_kind: 'shop', bounds_m: { x: [-4, 4], y: [0, 3.2], z: [-5, 5] }, light: { pos: [0, 0.7, 0] } };
  if (rendererArmR3(bare).length !== 1) fail('round-3 renderer arm did not fail open on a room with no lights');
  if (simArmR3(bare).length !== 0) fail('round-3 sim arm rescued a room it never rescued');
  if (litLights(bare).length !== 1 || !litLights(bare)[0].synthesized) fail('the shipped fail-open is missing or unflagged');
  // 3. The windowless three must not move with the sky, and a windowed room must.
  const gaol = interiors().find((r) => r.interior_kind === 'prison');
  const shop = interiors().find((r) => r.interior_kind === 'shop');
  if (interiorAmbientL(gaol, 1.0).L !== interiorAmbientL(gaol, 0.09).L) fail('a windowless room changed with the sky');
  if (interiorAmbientL(gaol, 1.0).L !== UNLIT_L) fail(`a windowless room does not read ${UNLIT_L}`);
  if (!(interiorAmbientL(shop, 1.0).L > interiorAmbientL(shop, 0.09).L)) fail('a windowed room did not get brighter at noon');
  // 4. The anchor: the brightest room in the corpus at full sun must read `canopy_day`.
  const brightest = interiors().map((r) => ({ r, a: windowPlan(r).aperture_ratio })).sort((x, y) => y.a - x.a)[0];
  const at = interiorAmbientL(brightest.r, 1.0).L;
  if (Math.abs(at - 0.30) > 0.001) fail(`the brightest room reads ${at.toFixed(4)} at full sun; the derivation anchors it at 0.30`);
  // 5. THE CONTROL MUST GO RED. If the round-3 policy does not reproduce a large disagreement, this
  //    instrument cannot tell the two policies apart and its 0 means nothing.
  const ctl = run('r3', 12);
  if (ctl.disagree < 500) fail(`the round-3 control disagreed on only ${ctl.disagree} cells; it is not biting`);
  process.stdout.write(`selftest: PASS — 5 arms. The round-3 control disagrees on ${ctl.disagree} cells; the shipped policy is measured below.\n`);
}

/**
 * DOES THE ROOM STILL DISCRIMINATE, and what did the derived ambient cost?
 *
 * Raising an interior's floor from a flat 0.04 to a daylight-derived value cannot be waved through:
 * the round-3 critic's 2x2 arm 01 showed that flattening the ambient is what destroys the light
 * term, and a brighter floor clamps more of the room at L 1.0000. So the cost is measured, both
 * ways, over the whole province, and published whichever way it comes out.
 */
function discrimination() {
  const list = interiors();
  const arms = [
    { id: 'r3_flat_0.04', amb: () => UNLIT_L },
    { id: 'r4_derived_noon_clear', amb: (r) => interiorAmbientL(r, 1.00).L },
    { id: 'r4_derived_noon_overcast', amb: (r) => interiorAmbientL(r, 0.75).L },
    { id: 'r4_derived_0300_overcast', amb: (r) => interiorAmbientL(r, 0.09).L },
    { id: 'CONTROL_r3_critic_arm01_0.75', amb: () => 0.75 },
    { id: 'CONTROL_old_lamp_scale_9.3275', amb: (r) => interiorAmbientL(r, 1.00).L, scale: 9.3275 },
  ];
  const out = [];
  for (const arm of arms) {
    let disc = 0, flat = 0, sum = 0, saturated = 0, cells = 0, saturatedRooms = 0;
    for (const rec of list) {
      const f = fieldFor(simArm(rec), arm.amb(rec), arm.scale);
      let mn = Infinity, mx = -Infinity, roomSaturated = 0, roomCells = 0;
      const b = rec.bounds_m;
      for (let x = b.x[0] + 0.2; x <= b.x[1] - 0.2; x += 0.4) {
        for (let z = b.z[0] + 0.2; z <= b.z[1] - 0.2; z += 0.4) {
          const L = f.sample(x, b.y[0] + 1.35, z, null);
          roomCells++; cells++;
          if (L >= 0.9999) { roomSaturated++; saturated++; }
          if (L < mn) mn = L; if (L > mx) mx = L;
        }
      }
      const sp = mx - mn;
      sum += sp;
      if (sp > 0.30) disc++;
      if (sp < 1e-9) flat++;
      if (roomCells > 0 && roomSaturated === roomCells) saturatedRooms++;
    }
    out.push({ arm: arm.id, rooms: list.length, discriminating: disc, flat,
      saturated_cells: saturated, cells, saturated_fraction: +(saturated / cells).toFixed(4),
      saturated_rooms: saturatedRooms, mean_spread: +(sum / list.length).toFixed(4) });
  }
  return out;
}

if (has('--apertures')) {
  const rows = interiors().map((r) => ({ id: r.id, ...windowPlan(r) })).sort((a, b) => b.aperture_ratio - a.aperture_ratio);
  const windowed = rows.filter((r) => !r.windowless);
  process.stdout.write(`\naperture ratios over ${rows.length} interiors (${has('--declared') ? 'DECLARED' : 'JOINED'} bounds)\n`);
  for (const r of windowed.slice(0, 3)) process.stdout.write(`  ${r.id.padEnd(26)} ${r.count} panes / ${r.floor_area_m2.toFixed(1)} m2 = ${r.aperture_ratio.toFixed(5)}\n`);
  process.stdout.write(`  ...\n`);
  for (const r of windowed.slice(-3)) process.stdout.write(`  ${r.id.padEnd(26)} ${r.count} panes / ${r.floor_area_m2.toFixed(1)} m2 = ${r.aperture_ratio.toFixed(5)}\n`);
  process.stdout.write(`  windowless: ${rows.filter((r) => r.windowless).map((r) => r.id).join(', ')}\n`);
  process.stdout.write(`  MAX = ${windowed[0].aperture_ratio.toFixed(6)}  ->  DAYLIGHT_K = (${CANOPY_DAY_L} - ${UNLIT_L}) / MAX = ${((CANOPY_DAY_L - UNLIT_L) / windowed[0].aperture_ratio).toFixed(4)}  (shipped: ${DAYLIGHT_K.toFixed(4)})\n\n`);
  process.exit(0);
}

const hour = Number(val('--hour', 12));
const shipped = run('now', hour);
const control = run('r3', hour);
const regressed = regressedRooms();

const bar = '='.repeat(84);
process.stdout.write(`\nW1-15 r4 — DRAWN vs SIMULATED LIGHT, all ${shipped.interiors} interiors, 1 m chest-height grid\n${bar}\n`);
process.stdout.write(`  shadow boundary: L < ${SHADOW_L} (light_table_L 'flame_far'), hour ${hour}, clear\n\n`);
const line = (t, r) => process.stdout.write(
  `  ${t.padEnd(34)} ${String(r.disagree).padStart(6)} / ${String(r.cells).padStart(6)}  ` +
  `= ${String(r.pct).padStart(5)}%   drawn-lit-sim-dark ${String(r.drawnLitSimDark).padStart(5)}   drawn-dark-sim-lit ${String(r.drawnDarkSimLit).padStart(4)}\n`);
line('ROUND 3 (cap + private fail-open)', control);
line('SHIPPED (one shared policy)', shipped);
process.stdout.write(`\n  interiors over round 3's LIT_CAP of 5: ${control.over_cap} / ${control.interiors}, worst room ${control.max_lamps} lamps\n`);
process.stdout.write(`  interiors declaring no lamp at all:    ${control.no_lights} / ${control.interiors}\n`);

process.stdout.write(`\n  THE ELEVEN ROOMS ROUND 3 REGRESSED — every one read a flat ${CFG.interior_ambient_L} at every hour\n${'-'.repeat(84)}\n`);
process.stdout.write(`  ${'room'.padEnd(24)} ${'win'.padStart(4)} ${'src'.padStart(4)}  ${'L@03'.padStart(7)} ${'L@09'.padStart(7)} ${'L@12'.padStart(7)} ${'L@21'.padStart(7)}   (min over the floor)\n`);
for (const r of regressed) {
  process.stdout.write(`  ${r.id.padEnd(24)} ${String(r.windows).padStart(4)} ${String(r.hours[12].sources).padStart(4)}  ` +
    [3, 9, 12, 21].map((h) => String(r.hours[h].L_min.toFixed(4)).padStart(7)).join(' ') + '\n');
}
const worstRegressed = Math.min(...regressed.map((r) => Math.min(...[3, 9, 12, 21].map((h) => r.hours[h].L_min))));
process.stdout.write(`  worst floor value across all eleven rooms and all four hours: ${worstRegressed.toFixed(4)}  (round 3: ${CFG.interior_ambient_L})\n`);

if (VERBOSE) {
  const bad = shipped.rows.filter((r) => r.disagree);
  process.stdout.write(`\n  rooms still disagreeing: ${bad.length}\n`);
  for (const r of bad.slice(0, 30)) process.stdout.write(`    ${r.id.padEnd(26)} ${r.disagree}/${r.cells}  renderer ${r.renderer_lights} sim ${r.sim_sources}\n`);
}

const disc = discrimination();
process.stdout.write(`\n  DOES THE ROOM STILL DISCRIMINATE — spread over each room's floor, all ${shipped.interiors} interiors\n${'-'.repeat(84)}\n`);
process.stdout.write(`  ${'ambient arm'.padEnd(32)} ${'spread>0.30'.padStart(12)} ${'flat'.padStart(6)} ${'sat cells'.padStart(10)} ${'sat rooms'.padStart(10)} ${'mean spread'.padStart(12)}\n`);
for (const d of disc) process.stdout.write(`  ${d.arm.padEnd(32)} ${String(`${d.discriminating}/${d.rooms}`).padStart(12)} ${String(d.flat).padStart(6)} ${String(`${(100 * d.saturated_fraction).toFixed(1)}%`).padStart(10)} ${String(d.saturated_rooms).padStart(10)} ${String(d.mean_spread).padStart(12)}\n`);
process.stdout.write('  The last row is the round-3 critic\'s 2x2 arm 01 — the old 0.75 ambient with the lamps kept.\n');

const r3arm = disc.find((d) => d.arm === 'r3_flat_0.04');
const r4arm = disc.find((d) => d.arm === 'r4_derived_noon_clear');
const ctlArm = disc.find((d) => d.arm === 'CONTROL_r3_critic_arm01_0.75');
const oldScaleArm = disc.find((d) => d.arm === 'CONTROL_old_lamp_scale_9.3275');
const pass = shipped.disagree === 0 && worstRegressed > CFG.interior_ambient_L && control.disagree > 0
  && r4arm.discriminating >= r3arm.discriminating - 3 && r4arm.discriminating > ctlArm.discriminating
  && r4arm.saturated_fraction < 0.40 && r4arm.saturated_rooms <= 3
  && oldScaleArm.saturated_fraction > 0.70 && oldScaleArm.saturated_rooms > 3;
process.stdout.write(`\n  ${pass ? 'PASS' : 'FAIL'}  0 disagreeing cells (got ${shipped.disagree}); the eleven rooms above ${CFG.interior_ambient_L} (got ${worstRegressed.toFixed(4)}); the control bites (got ${control.disagree}); the derived ambient costs at most 3 discriminating rooms against round 3's constant (${r3arm.discriminating} -> ${r4arm.discriminating}) and beats the 0.75 arm (${ctlArm.discriminating}).\n`);
process.stdout.write(`  ambient constants in play: unlit ${UNLIT_L}, daylight_k ${DAYLIGHT_K.toFixed(4)}\n\n`);
process.stdout.write(`  saturation hard gate: ${(100 * r4arm.saturated_fraction).toFixed(1)}% < 40.0%, ${r4arm.saturated_rooms} fully saturated rooms <= 3.\n\n`);

if (JSON_OUT) {
  fs.mkdirSync(path.dirname(path.join(ROOT, JSON_OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, JSON_OUT), JSON.stringify({ shipped, control, regressed, discrimination: disc, shadow_L: SHADOW_L, hour, joined_bounds: !has('--declared') }, null, 2) + '\n');
  process.stdout.write(`  wrote ${JSON_OUT}\n\n`);
}
process.exit(pass ? 0 : 1);
