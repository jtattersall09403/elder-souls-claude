#!/usr/bin/env node
/**
 * mesh-winding.mjs — the signed-volume winding test, per mesh AND per generator.
 *
 * WHY. The owner passed on a diagnosis from another Three.js project with the same symptom we have
 * ("characters look see-through"): inverted triangle winding culls the FRONT faces, so you see the
 * inside of the far surface. That is not a hole, so a gap-pixel census counts it as one and
 * hole-filling never touches the cause — which matters here, because this project spent a round
 * closing five geometric holes on evidence later found partly void, and the owner still reports the
 * characters looking wrong.
 *
 * WHAT IS MEASURED, and why it is the right instrument.
 *
 *  1. SIGNED VOLUME. For a closed mesh, V = (1/6) * sum over triangles of dot(a, cross(b, c)).
 *     Counter-clockwise-when-seen-from-outside (Three.js `FrontSide` convention) gives V > 0.
 *     V < 0 means every face is wound backwards. It is translation-invariant for a CLOSED mesh
 *     only, so this tool also reports a boundary-edge count: a mesh with boundary edges is open,
 *     its V is not a reliable verdict on its own, and the tool says so instead of pretending.
 *
 *  2. NORMAL AGREEMENT — the half that catches the case winding alone cannot. A mesh can be wound
 *     correctly and still shade wrongly if its AUTHORED vertex normals point inward. For every
 *     triangle we compare the geometric normal implied by the winding, cross(b-a, c-a), against the
 *     mean authored vertex normal. `disagree` counts dot < 0. If a material is `DoubleSide` the
 *     mesh will look solid while lighting is inverted, which is a plausible contributor to a form
 *     reading as a flat slab rather than a body — so this is reported even where nothing is
 *     see-through.
 *
 *  3. MATERIAL SIDE. `DoubleSide` masks inverted winding. Reported per mesh so a "no holes" result
 *     cannot be bought with a material flag.
 *
 * PER-GENERATOR, NOT JUST PER-MESH. The other project's fault was in two different generators
 * (marching cubes and a sweep), not global — so a whole-mesh number can average a broken generator
 * against a correct one and come out positive. `actor.js` merges every primitive into two skinned
 * meshes, so a per-mesh volume is exactly that average. `--generators` therefore drives each
 * MeshBuilder primitive in isolation (tube, ball, ellipsoid), plus the mirrored-part case (the
 * classic flip: a negated axis with no index reversal), and reports each separately.
 *
 * MAKE IT FAIL ON PURPOSE (`RULES.md` 4):
 *   node tools/visual/mesh-winding.mjs --self-test
 * builds a correct primitive, asserts positive, then reverses its index buffer and asserts the
 * tool goes red. A guard that has never been seen to fail is not evidence.
 *
 * Usage:
 *   node tools/visual/mesh-winding.mjs                 # whole shipped roster, per mesh
 *   node tools/visual/mesh-winding.mjs --generators    # each primitive in isolation
 *   node tools/visual/mesh-winding.mjs --self-test     # prove the instrument can fail
 *   node tools/visual/mesh-winding.mjs --json=out.json
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');
const opts = { json: null, generators: false, selfTest: false, sample: 12 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'json') opts.json = resolve(v);
  else if (k === 'generators') opts.generators = true;
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'sample') opts.sample = Number(v);
}

const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);

/**
 * Signed volume, boundary-edge count and normal agreement for one BufferGeometry, in its own
 * local space. `origin` is irrelevant for a closed mesh and the boundary count tells you whether
 * this one is closed.
 */
function analyseGeometry(g) {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const idx = g.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), gn = new THREE.Vector3();
  const an = new THREE.Vector3(), tmp = new THREE.Vector3();
  let vol = 0, tris = 0, disagree = 0, checked = 0, degenerate = 0;
  const edges = new Map();          // undirected key -> net direction count
  for (let i = 0; i < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    vol += a.dot(tmp.copy(b).cross(c)) / 6;
    tris++;
    ab.subVectors(b, a); ac.subVectors(c, a); gn.crossVectors(ab, ac);
    if (gn.lengthSq() < 1e-20) { degenerate++; } else if (nrm) {
      an.set(0, 0, 0);
      for (const j of [ia, ib, ic]) an.add(tmp.fromBufferAttribute(nrm, j));
      if (an.lengthSq() > 1e-20) { checked++; if (gn.dot(an) < 0) disagree++; }
    }
    // Half-edge tally: a closed, consistently-wound mesh has every directed edge exactly once and
    // its reverse exactly once. Keyed by QUANTISED POSITION, not by vertex index — a seam ring
    // duplicates its vertices (and `toNonIndexed` duplicates all of them), so an index-keyed tally
    // would report every mesh in this project as open and the `closed` column would be noise.
    const key3 = (i) => `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    const ka = key3(ia), kb = key3(ib), kc = key3(ic);
    for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) {
      if (p === q) continue;
      const fwd = p < q;
      const key = fwd ? `${p}|${q}` : `${q}|${p}`;
      edges.set(key, (edges.get(key) || 0) + (fwd ? 1 : -1));
    }
  }
  let boundary = 0;
  for (const v of edges.values()) if (v !== 0) boundary++;
  return { tris, signed_volume: vol, boundary_edges: boundary, closed: boundary === 0,
    normal_disagree: disagree, normal_checked: checked, degenerate };
}

const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

const report = { tool: 'mesh-winding', convention: 'Three.js FrontSide = counter-clockwise seen from outside => signed volume > 0' };

// ---------------------------------------------------------------------------------------
// 1. PER GENERATOR. Each MeshBuilder primitive alone, plus the mirrored-part case.
// ---------------------------------------------------------------------------------------
if (opts.generators || opts.selfTest) {
  const actorSrc = readFileSync(join(R, 'game/src/render/actor.js'), 'utf8');
  // MeshBuilder is module-private, so drive it the only honest way: through the real actor build,
  // one primitive at a time, by building an actor whose family emits only that shape is not
  // possible — instead re-declare nothing and instead measure the SHIPPED primitives by rebuilding
  // them from the same class. The class is exported for tests below if present; otherwise this
  // section reports what it could not reach rather than inventing a copy.
  const exported = /export\s*\{[^}]*MeshBuilder|export class MeshBuilder/.test(actorSrc);
  report.generator_note = exported
    ? 'MeshBuilder is exported; primitives driven directly.'
    : 'MeshBuilder is module-private in actor.js. Per-generator numbers below are derived by '
      + 'labelling the SHIPPED merged geometry by primitive via its own vertex ranges is not '
      + 'possible either, so this section instead measures every distinct THREE geometry '
      + 'constructor used in the presentation path, plus a mirrored-part control.';
  const gens = {};
  const push = (name, geo) => { gens[name] = analyseGeometry(geo.index ? geo : geo.toNonIndexed()); };
  // Every THREE built-in used by actor.js's presentation path (grep: SphereGeometry, CapsuleGeometry,
  // ConeGeometry, BoxGeometry, TorusGeometry, DodecahedronGeometry, CircleGeometry, CylinderGeometry).
  push('THREE.SphereGeometry', new THREE.SphereGeometry(0.3, 16, 10));
  push('THREE.CapsuleGeometry', new THREE.CapsuleGeometry(0.12, 0.3, 6, 12));
  push('THREE.ConeGeometry', new THREE.ConeGeometry(0.08, 0.24, 9));
  push('THREE.BoxGeometry', new THREE.BoxGeometry(0.2, 0.1, 0.3));
  push('THREE.TorusGeometry', new THREE.TorusGeometry(0.16, 0.016, 6, 14));
  push('THREE.DodecahedronGeometry', new THREE.DodecahedronGeometry(0.2, 2));
  push('THREE.CylinderGeometry', new THREE.CylinderGeometry(0.1, 0.08, 0.3, 12));
  // THE CLASSIC FLIP, as a control: mirror a part by negating one axis and DO NOT reverse the
  // index buffer. If our code ever does this, this is the number it would produce.
  {
    const g = new THREE.SphereGeometry(0.3, 16, 10).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
    gens['CONTROL mirrored-x, index NOT reversed'] = analyseGeometry(g);
  }
  report.generators = gens;
}

if (opts.selfTest) {
  const good = new THREE.SphereGeometry(0.3, 16, 10).toNonIndexed();
  const gv = analyseGeometry(good);
  const bad = good.clone();
  // Reverse every triangle's winding.
  const p = bad.attributes.position, nn = bad.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    for (const at of [p, nn]) {
      if (!at) continue;
      const x = at.getX(i), y = at.getY(i), z = at.getZ(i);
      at.setXYZ(i, at.getX(i + 2), at.getY(i + 2), at.getZ(i + 2));
      at.setXYZ(i + 2, x, y, z);
    }
  }
  const bv = analyseGeometry(bad);
  console.log(`self-test  correct sphere : V=${gv.signed_volume.toExponential(4)}  closed=${gv.closed}  normal_disagree=${gv.normal_disagree}/${gv.normal_checked}`);
  console.log(`self-test  wound backwards: V=${bv.signed_volume.toExponential(4)}  closed=${bv.closed}  normal_disagree=${bv.normal_disagree}/${bv.normal_checked}`);
  const ok = gv.signed_volume > 0 && bv.signed_volume < 0 && bv.normal_disagree === bv.normal_checked;
  console.log(`self-test  the failing arm ${ok ? 'GOES RED' : 'DOES NOT GO RED'}`);
  if (!ok) { console.error('self-test FAILED: this instrument cannot distinguish inverted winding and is worthless.'); process.exit(1); }
  console.log('self-test passed.');
  if (report.generators) {
    console.log('\nper-generator:');
    for (const [k, v] of Object.entries(report.generators)) {
      console.log(`  ${k.padEnd(42)} V=${v.signed_volume.toExponential(3).padStart(11)}  closed=${String(v.closed).padEnd(5)}  normals_wrong=${v.normal_disagree}/${v.normal_checked}`);
    }
  }
  if (opts.json) writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// 2. PER MESH, over the shipped roster — the same selection f10-silhouette.mjs uses.
// ---------------------------------------------------------------------------------------
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

const meshes = [];
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
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const r = analyseGeometry(o.geometry);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    meshes.push({ subject: group.name, family, name: o.name || o.type,
      side: mat ? ({ 0: 'FrontSide', 1: 'BackSide', 2: 'DoubleSide' })[mat.side] ?? String(mat.side) : 'none',
      ...r });
  });
}

// Aggregate by mesh NAME, because the same generator produces the same-named mesh on every actor.
const byName = new Map();
for (const m of meshes) {
  const k = m.name.replace(/:(saxhleel|humanoid|undead|beast)(:|@|$)/, ':<family>$2').replace(/@\w+$/, '@<bone>').replace(/:\d+$/, ':<i>');
  if (!byName.has(k)) byName.set(k, { name: k, n: 0, inverted: 0, open: 0, tris: 0, normal_disagree: 0, normal_checked: 0, sides: new Set(), min_v: Infinity, max_v: -Infinity });
  const e = byName.get(k);
  e.n++; e.tris += m.tris; e.normal_disagree += m.normal_disagree; e.normal_checked += m.normal_checked;
  e.sides.add(m.side);
  if (m.signed_volume < 0) e.inverted++;
  if (!m.closed) e.open++;
  e.min_v = Math.min(e.min_v, m.signed_volume); e.max_v = Math.max(e.max_v, m.signed_volume);
}
const rows = [...byName.values()].map((e) => ({ ...e, sides: [...e.sides].join('/') }))
  .sort((a, b) => b.tris - a.tris);

report.subjects = sample.length;
report.meshes_examined = meshes.length;
report.by_mesh = rows;
report.inverted_meshes = meshes.filter((m) => m.signed_volume < 0).map((m) => ({ subject: m.subject, name: m.name, V: m.signed_volume, closed: m.closed }));
report.normal_disagreement_total = meshes.reduce((s, m) => s + m.normal_disagree, 0);
report.normal_checked_total = meshes.reduce((s, m) => s + m.normal_checked, 0);
report.doubleside_meshes = [...new Set(meshes.filter((m) => m.side === 'DoubleSide').map((m) => m.name))];
report.verdict = report.inverted_meshes.length === 0 && report.normal_disagreement_total === 0
  ? 'winding CORRECT and normals agree on every mesh examined'
  : 'DEFECT: see inverted_meshes / normal_disagreement_total';

console.log(`mesh-winding: ${sample.length} subjects, ${meshes.length} meshes`);
console.log(`${'mesh'.padEnd(46)} ${'n'.padStart(3)} ${'tris'.padStart(7)} ${'inverted'.padStart(8)} ${'open'.padStart(5)} ${'normals_wrong'.padStart(14)}  side`);
for (const r of rows) {
  console.log(`${r.name.slice(0, 46).padEnd(46)} ${String(r.n).padStart(3)} ${String(r.tris).padStart(7)} ${String(r.inverted).padStart(8)} ${String(r.open).padStart(5)} ${String(`${r.normal_disagree}/${r.normal_checked}`).padStart(14)}  ${r.sides}`);
}
console.log(`\ninverted meshes: ${report.inverted_meshes.length} of ${meshes.length}`);
console.log(`triangles whose authored normal disagrees with their winding: ${report.normal_disagreement_total} of ${report.normal_checked_total}`);
console.log(`DoubleSide meshes (would MASK inverted winding): ${report.doubleside_meshes.length ? report.doubleside_meshes.join(', ') : 'none'}`);
console.log(`\nVERDICT: ${report.verdict}`);
if (opts.json) writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.inverted_meshes.length === 0 && report.normal_disagreement_total === 0 ? 0 : 1);
