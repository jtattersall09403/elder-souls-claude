#!/usr/bin/env node
/**
 * character-texel-density.mjs — how many metres of character surface one texture tile covers.
 *
 * WHY THIS EXISTS. The `F10` round-2 appearance pass, having fixed the inverted winding, opened the
 * frames and reported the next defect as bigger than the one it had just closed:
 *
 *   "the surfaces are flat and uniform ... correct winding revealed that there is no material work
 *    at all, one colour of cloth over one colour of skin, no seam or fold anywhere."
 *
 * The obvious reading is "the characters have no textures". THAT READING IS WRONG, and this tool
 * exists because it is wrong. `game/src/render/scene.js` builds `mats.skin` and `mats.cloth` through
 * `worldMaterial()`, so every character body has been carrying the authored `brown_leather` and
 * `rough_linen` albedo/normal/roughness sets the whole time (they are on disk:
 * `ls game/assets/w1-30/materials/rough_linen/` returns three files).
 *
 * What is wrong is the SCALE those maps are pasted on at. `MATERIAL_API.md` §5 states the seam:
 * "Lay your UVs out so that one UV unit equals `metresPerTile` metres of surface." `lib/kits.js`
 * obeys it literally — every kit UV is `p[axis] / mpt`. `actor.js`'s MeshBuilder never did: its
 * tube emits `u = i/radial`, `v = t*2` — parametric coordinates with no metres in them at all — so
 * the tile size on a character is set by how long the limb happens to be. On a 0.42 m forearm that
 * puts a 1 k linen weave at roughly a tenth of a metre per tile, several times finer than the
 * 1.1 m the family declares. A texture that fine does not read as cloth at any framing a player
 * meets: the mip chain averages it to its own mean colour, which is precisely "one flat colour of
 * cloth over one flat colour of skin".
 *
 * WHAT IS MEASURED. Per body mesh, per triangle: world-space area in m^2 and UV-space area in
 * uv^2. `metres per UV unit = sqrt(worldArea / uvArea)`, and one TILE is `repeat` UV units, so
 *
 *     metresPerTile_measured = metresPerUVunit / repeat
 *
 * `repeat` is 2 on the authored path (`authoredMaps()`'s `setup()` sets `t.repeat.set(2,2)`), which
 * is the path that ships in a browser. Node has no `document`, so `worldMaterial()` falls back to
 * the procedural set at repeat 4; this tool therefore takes `repeat` as an argument (default 2, the
 * shipped browser value) rather than reading it from a material built in the wrong environment.
 *
 * The comparison is against `TEXEL_METRES[family] / repeat` — the same target `materialTiling()`
 * publishes and `kits.js` divides by. The ratio is reported as `x too dense` (>1) or `x too coarse`
 * (<1), because the direction matters: too dense reads as flat, too coarse reads as smeared.
 *
 * MAKE IT FAIL ON PURPOSE (RULES.md 4):
 *   node tools/visual/character-texel-density.mjs --self-test
 * builds a unit quad whose UVs are known-correct for a given family, asserts the tool reports
 * ratio 1.00, then multiplies its UVs by 8 and asserts the tool reports 8.00 and goes red. A
 * measurement that has never been seen to move is not a measurement.
 *
 * Usage:
 *   node tools/visual/character-texel-density.mjs                 # shipped roster
 *   node tools/visual/character-texel-density.mjs --sample=20
 *   node tools/visual/character-texel-density.mjs --tolerance=2.0  # ratio band, default 2.0x
 *   node tools/visual/character-texel-density.mjs --self-test
 *   node tools/visual/character-texel-density.mjs --json=out.json
 *
 * Exit code: non-zero if any body mesh sits outside the tolerance band, so this can guard the fix.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');
const opts = { json: null, selfTest: false, sample: 12, repeat: 2, tolerance: 2.0 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'sample') opts.sample = Number(v);
  else if (k === 'repeat') opts.repeat = Number(v);
  else if (k === 'tolerance') opts.tolerance = Number(v);
}

const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);
const { TEXEL_METRES } = await import(pathToFileURL(join(R, 'game/src/render/visual-foundation.js')).href);

/**
 * Area-weighted metres-per-UV-unit for one geometry.
 *
 * Area-weighted rather than a plain mean over triangles: a body is thousands of tiny cap triangles
 * and a few hundred large wall quads, and the mean over triangles is dominated by the caps, which
 * are the parts a viewer never resolves. Weighting by world area asks the question a viewer asks,
 * "what does most of the visible surface look like". The median is reported beside it so a single
 * pathological patch cannot move the headline unnoticed.
 */
function analyse(g) {
  const pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
  if (!pos || !uv) return null;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cr = new THREE.Vector3();
  let sumArea = 0, sumWeighted = 0, degenerate = 0;
  const samples = [];
  for (let i = 0; i < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    ab.subVectors(b, a); ac.subVectors(c, a);
    const worldArea = cr.crossVectors(ab, ac).length() / 2;
    const u0 = uv.getX(ia), v0 = uv.getY(ia), u1 = uv.getX(ib), v1 = uv.getY(ib), u2 = uv.getX(ic), v2 = uv.getY(ic);
    const uvArea = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2;
    if (!(worldArea > 1e-12) || !(uvArea > 1e-12)) { degenerate++; continue; }
    const mpu = Math.sqrt(worldArea / uvArea);
    sumArea += worldArea; sumWeighted += mpu * worldArea;
    samples.push({ mpu, worldArea });
  }
  if (sumArea <= 0) return null;
  samples.sort((x, y) => x.mpu - y.mpu);
  let acc = 0, median = samples[0].mpu;
  for (const s of samples) { acc += s.worldArea; if (acc >= sumArea / 2) { median = s.mpu; break; } }
  return {
    tris_used: samples.length,
    tris_degenerate_uv: degenerate,
    world_area_m2: sumArea,
    metres_per_uv_unit_area_weighted: sumWeighted / sumArea,
    metres_per_uv_unit_median: median,
  };
}

// ---------------------------------------------------------------------------------------
// SELF-TEST — the instrument has to be seen to move before any number it prints is worth reading.
// ---------------------------------------------------------------------------------------
if (opts.selfTest) {
  const family = 'cloth';
  const target = TEXEL_METRES[family] / opts.repeat;
  // A 1 m x 1 m quad whose UVs are laid out exactly as MATERIAL_API §5 and kits.js require:
  // uv = metres / metresPerTile, where metresPerTile is TEXEL_METRES[family].
  const mpt = TEXEL_METRES[family];
  const make = (uvScale) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    const s = uvScale / mpt;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, s, 0, s, s, 0, s], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  const good = analyse(make(1));
  const bad = analyse(make(8));
  // metresPerTile measured = metresPerUVunit / repeat
  const goodTile = good.metres_per_uv_unit_area_weighted / opts.repeat;
  const badTile = bad.metres_per_uv_unit_area_weighted / opts.repeat;
  const goodRatio = target / goodTile, badRatio = target / badTile;
  console.log(`self-test  correct UVs (1 uv unit = ${mpt} m): metresPerTile=${goodTile.toFixed(4)}  target=${target.toFixed(4)}  ratio=${goodRatio.toFixed(2)}x`);
  console.log(`self-test  UVs 8x too dense               : metresPerTile=${badTile.toFixed(4)}  target=${target.toFixed(4)}  ratio=${badRatio.toFixed(2)}x`);
  const ok = Math.abs(goodRatio - 1) < 0.01 && Math.abs(badRatio - 8) < 0.05;
  console.log(`self-test  the failing arm ${ok ? 'GOES RED' : 'DOES NOT GO RED'}`);
  if (!ok) { console.error('self-test FAILED: this instrument cannot distinguish a correct UV layout from an 8x one.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// The shipped roster — the same selection mesh-winding.mjs uses, for the same reason.
// ---------------------------------------------------------------------------------------
const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

const actorMod = await import(pathToFileURL(join(R, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(R, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(R, 'game/src/combat/clips.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(R, 'game/src/render/lib/race-art.js')).href);
const skel = JSON.parse(readFileSync(join(R, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(R, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(R, 'game/data/combat/clips.json'), 'utf8'));

const roster = [];
for (const f of readdirSync(join(R, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(R, 'game/data/npcs', f), 'utf8'));
  for (const n of (Array.isArray(d) ? d : (d.npcs || d.records || []))) roster.push({ eid: n.eid || n.id, race: n.race, actor: n.actor });
}
const step = Math.max(1, Math.floor(roster.length / opts.sample));
const sample = [{ eid: 'player', race: 'saxhleel', actor: 'player' },
  ...roster.filter((_, i) => i % step === 0).slice(0, opts.sample)];

// Which visual family each body mesh is drawn with. `actor-body:<family>:<key>` names the KEY,
// which is also the material family, so the mapping is the identity for the two body surfaces.
const familyOfMesh = (name) => {
  const m = /^actor-body:[a-z]+:([a-z_]+)$/.exec(name);
  return m ? m[1] : null;
};

const rows = [];
for (const person of sample) {
  const family = artFamilyForRace(person.race);
  const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  group.name = person.eid === 'player' ? 'player' : `npc:${person.eid}`;
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_loop || Object.values(clips.archetypes)[0], 0, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
  actorMod.poseFromRig(group, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20,
    move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false,
    offhandKind: null, moves: { _weapon: null } });
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const mf = familyOfMesh(o.name || '');
    if (!mf) return;                       // body surfaces only; equipment is E's texel problem
    const r = analyse(o.geometry);
    if (!r) return;
    const measuredTile = r.metres_per_uv_unit_area_weighted / opts.repeat;
    const target = TEXEL_METRES[mf] / opts.repeat;
    rows.push({ subject: group.name, art_family: family, mesh: o.name, material_family: mf,
      target_metres_per_tile: target, measured_metres_per_tile: measuredTile,
      ratio_too_dense: target / measuredTile, ...r });
  });
}

// Aggregate by (art family, material family) — the same generator produces the same surface on
// every actor of a family, so seventeen rows of the same number is noise, not evidence.
const byKey = new Map();
for (const r of rows) {
  const k = `${r.art_family}:${r.material_family}`;
  if (!byKey.has(k)) byKey.set(k, { key: k, n: 0, min: Infinity, max: -Infinity, sum: 0, target: r.target_metres_per_tile });
  const e = byKey.get(k);
  e.n++; e.sum += r.measured_metres_per_tile;
  e.min = Math.min(e.min, r.measured_metres_per_tile);
  e.max = Math.max(e.max, r.measured_metres_per_tile);
}
const agg = [...byKey.values()].map((e) => ({
  key: e.key, n: e.n, target_metres_per_tile: e.target,
  measured_mean: e.sum / e.n, measured_min: e.min, measured_max: e.max,
  ratio_too_dense_mean: e.target / (e.sum / e.n),
})).sort((a, b) => b.ratio_too_dense_mean - a.ratio_too_dense_mean);

const worst = agg.reduce((m, r) => Math.max(m, Math.max(r.ratio_too_dense_mean, 1 / r.ratio_too_dense_mean)), 0);
const failing = agg.filter((r) => Math.max(r.ratio_too_dense_mean, 1 / r.ratio_too_dense_mean) > opts.tolerance);

console.log(`character-texel-density: ${sample.length} subjects, ${rows.length} body meshes, repeat=${opts.repeat}, tolerance=${opts.tolerance}x`);
console.log(`${'art:material'.padEnd(22)} ${'n'.padStart(3)} ${'target m/tile'.padStart(14)} ${'measured m/tile'.padStart(16)} ${'ratio'.padStart(10)}`);
for (const r of agg) {
  const ratio = r.ratio_too_dense_mean;
  const label = ratio >= 1 ? `${ratio.toFixed(2)}x dense` : `${(1 / ratio).toFixed(2)}x coarse`;
  console.log(`${r.key.padEnd(22)} ${String(r.n).padStart(3)} ${r.target_metres_per_tile.toFixed(4).padStart(14)} ${r.measured_mean.toFixed(4).padStart(16)} ${label.padStart(10)}`);
}
console.log(`worst deviation: ${worst.toFixed(2)}x   ${failing.length ? `FAIL (${failing.length} of ${agg.length} surfaces outside ${opts.tolerance}x)` : 'PASS'}`);

const report = {
  tool: 'character-texel-density',
  convention: 'metresPerTile = sqrt(worldArea/uvArea) / repeat; target = TEXEL_METRES[family] / repeat',
  repeat: opts.repeat, tolerance: opts.tolerance,
  subjects: sample.length, body_meshes: rows.length,
  worst_deviation: worst,
  verdict: failing.length ? 'FAIL' : 'PASS',
  by_surface: agg, per_mesh: rows,
};
if (opts.json) writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
process.exit(failing.length ? 1 : 0);
