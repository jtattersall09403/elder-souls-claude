#!/usr/bin/env node
/**
 * character-face-relief.mjs — is there form on this head, or is the form inside the skull.
 *
 * WHY. Round 3's brief and its own status file both record the same thing: the seven `RI-VIS10` B4
 * facial landmarks ARE in the mesh and head-bone triangles went 1,180 -> 3,450, and **none of them
 * reads at conversation framing**. The instruction for this round was to find out whether that is
 * scale, shading, or landmark placement BEFORE adding more geometry. This is that instrument, and
 * it answers the question without adding a triangle.
 *
 * THE MEASUREMENT. Take every vertex whose dominant skin influence is the head bone, in head-bone
 * local space, as (direction, radius) about their own centroid. Bin the directions into a coarse
 * angular grid. Within one bin every vertex is on roughly the same ray out of the head, so:
 *
 *   BURIED     a vertex whose radius is more than `--buried-mm` BELOW the largest radius in its own
 *              bin is behind another surface along the same ray. It is geometry that cost triangles
 *              and cannot be seen from outside. `buried_fraction` is the share of the head that is.
 *
 *   RELIEF     for the OUTER shell only (the vertices that are not buried), the spread of radius
 *              within a bin is the local form — a brow ridge standing off the skull raises the max
 *              above the median. `relief_p95_mm` is the p95 of (r - bin median) over that shell.
 *              An egg has relief near zero by construction; a face does not.
 *
 * Neither number needs a single constant from `actor.js`, so this cannot drift with it, and neither
 * is a triangle count — `RI-VIS08` B2's own warning is that a statistic can fail a build and never
 * pass one, and "head-bone triangles went 1,180 -> 3,450" is exactly the statistic that passed a
 * head nobody could see the features on.
 *
 * MAKE IT FAIL ON PURPOSE:
 *   node tools/visual/character-face-relief.mjs --self-test
 * builds a bare sphere (relief ~0, buried ~0), then the same sphere with a ridge standing PROUD of
 * it (relief high, buried low), then the same sphere with the identical ridge sunk INSIDE it
 * (relief back to ~0, buried high). Three arms, required to disagree in two different ways — a
 * two-arm test here would not distinguish "no feature" from "feature in the wrong place", which is
 * the entire question.
 *
 * Usage:
 *   node tools/visual/character-face-relief.mjs
 *   node tools/visual/character-face-relief.mjs --sample=8 --json=out.json
 *   node tools/visual/character-face-relief.mjs --self-test
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');
const opts = { json: null, selfTest: false, sample: 5, bins: [28, 14], buriedMm: 3, bone: 'head' };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'sample') opts.sample = Number(v);
  else if (k === 'buried-mm') opts.buriedMm = Number(v);
  // A WITHIN-FIGURE BASELINE, and the reason it exists: 74.7% of head vertices measured buried on
  // the first run, and a number like that is only meaningful against how much burial this
  // construction style has ANYWAY. The whole body is built from deliberately overlapping welded
  // volumes, so some burial everywhere is by design. `--bone=spine_02` is the control.
  else if (k === 'bone') opts.bone = v;
}
const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);

function relief(points, binsTheta, binsPhi, buriedMm) {
  if (points.length < 12) return null;
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) { cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= points.length; cy /= points.length; cz /= points.length;
  const bins = new Map();
  const recs = [];
  for (const p of points) {
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
    const r = Math.hypot(dx, dy, dz);
    if (!(r > 1e-6)) continue;
    const theta = Math.atan2(dz, dx), phi = Math.acos(Math.max(-1, Math.min(1, dy / r)));
    const bt = Math.min(binsTheta - 1, Math.floor((theta + Math.PI) / (2 * Math.PI) * binsTheta));
    const bp = Math.min(binsPhi - 1, Math.floor(phi / Math.PI * binsPhi));
    const key = bt * binsPhi + bp;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(r);
    recs.push({ key, r });
  }
  const stat = new Map();
  for (const [key, rs] of bins) {
    rs.sort((a, b) => a - b);
    stat.set(key, { max: rs[rs.length - 1], med: rs[Math.floor(rs.length / 2)] });
  }
  let buried = 0;
  const shellDelta = [];
  for (const { key, r } of recs) {
    const s = stat.get(key);
    if ((s.max - r) * 1000 > buriedMm) { buried++; continue; }
    shellDelta.push((r - s.med) * 1000);
  }
  shellDelta.sort((a, b) => a - b);
  const q = (f) => (shellDelta.length ? shellDelta[Math.min(shellDelta.length - 1, Math.floor(f * shellDelta.length))] : 0);
  return {
    vertices: recs.length,
    bins_used: bins.size,
    buried_vertices: buried,
    buried_fraction: Number((buried / recs.length).toFixed(3)),
    relief_p95_mm: Number(q(0.95).toFixed(2)),
    relief_max_mm: Number((shellDelta.length ? shellDelta[shellDelta.length - 1] : 0).toFixed(2)),
  };
}

if (opts.selfTest) {
  const sphere = (rad, out, cx = 0, cy = 0, cz = 0) => {
    for (let j = 1; j < 40; j++) for (let i = 0; i < 60; i++) {
      const phi = j / 40 * Math.PI, th = i / 60 * Math.PI * 2;
      out.push([cx + rad * Math.sin(phi) * Math.cos(th), cy + rad * Math.cos(phi), cz + rad * Math.sin(phi) * Math.sin(th)]);
    }
    return out;
  };
  // arm 1: bare sphere
  const bare = sphere(0.10, []);
  // arm 2: the same sphere plus a ridge standing 8 mm PROUD of it, over a patch
  const proud = sphere(0.10, []);
  for (let j = 16; j < 22; j++) for (let i = 0; i < 8; i++) {
    const phi = j / 40 * Math.PI, th = i / 60 * Math.PI * 2;
    proud.push([0.108 * Math.sin(phi) * Math.cos(th), 0.108 * Math.cos(phi), 0.108 * Math.sin(phi) * Math.sin(th)]);
  }
  // arm 3: the IDENTICAL ridge, sunk 8 mm INSIDE the same sphere
  const sunk = sphere(0.10, []);
  for (let j = 16; j < 22; j++) for (let i = 0; i < 8; i++) {
    const phi = j / 40 * Math.PI, th = i / 60 * Math.PI * 2;
    sunk.push([0.092 * Math.sin(phi) * Math.cos(th), 0.092 * Math.cos(phi), 0.092 * Math.sin(phi) * Math.sin(th)]);
  }
  const a = relief(bare, 28, 14, opts.buriedMm), b = relief(proud, 28, 14, opts.buriedMm), c = relief(sunk, 28, 14, opts.buriedMm);
  for (const [n, r] of [['bare sphere', a], ['ridge PROUD of it', b], ['same ridge SUNK inside it', c]]) {
    console.log(`self-test  ${n.padEnd(28)} buried_fraction=${r.buried_fraction}  relief_p95=${r.relief_p95_mm} mm  relief_max=${r.relief_max_mm} mm`);
  }
  // HOW THE THREE ARMS ARE READ, and the first draft of this assertion was wrong about it.
  // I expected `buried_fraction` alone to separate proud from sunk. It does not, and it should not:
  // a ridge standing PROUD of a sphere buries the sphere surface underneath it just as surely as a
  // sunk ridge buries itself, so both arms report a few per cent. That is the instrument being
  // right and my expectation being wrong. The pair that actually discriminates is:
  //
  //   relief_max ~ 0  AND  buried ~ 0   -> there is no feature here at all      (bare)
  //   relief_max high                   -> the feature is on the outer shell    (proud)
  //   relief_max ~ 0  AND  buried > 0   -> the feature exists and is INSIDE     (sunk)
  //
  // which is exactly the three-way answer round 3's question needs, and it needs both numbers.
  const ok = a.relief_max_mm < 1 && a.buried_fraction < 0.005
    && b.relief_max_mm > 5
    && c.relief_max_mm < 1 && c.buried_fraction >= 0.015;
  console.log(`self-test  the three arms ${ok ? 'DISAGREE — a sunk feature is distinguished from an absent one, which needs BOTH numbers' : 'DO NOT DISAGREE AS REQUIRED'}`);
  if (!ok) { console.error('self-test FAILED.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

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
  for (const n of (Array.isArray(d) ? d : (d.npcs || d.records || []))) roster.push({ eid: n.eid || n.id, race: n.race });
}
const step = Math.max(1, Math.floor(roster.length / opts.sample));
const sample = [{ eid: 'player', race: 'saxhleel' }, ...roster.filter((_, i) => i % step === 0).slice(0, opts.sample)];

const rows = [];
for (const person of sample) {
  const family = artFamilyForRace(person.race);
  const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_loop || Object.values(clips.archetypes)[0], 0, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
  actorMod.poseFromRig(group, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20,
    move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } });
  const built = group.userData && group.userData.actor && group.userData.actor.built;
  if (!built) continue;
  const hi = built.index.get(opts.bone);
  if (hi === undefined) continue;
  const inv = built.restWorld[hi].clone().invert();
  const pts = [];
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.visible === false) return;
    if (!/^actor-body:/.test(o.name || '')) return;         // the skinned body only
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!si || !sw) return;
    for (let i = 0; i < pos.count; i++) {
      let best = -1, bw = -1;
      for (const ch of ['X', 'Y', 'Z', 'W']) { const w = sw[`get${ch}`](i); if (w > bw) { bw = w; best = si[`get${ch}`](i); } }
      if (best !== hi) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(inv);
      pts.push([v.x, v.y, v.z]);
    }
  });
  const r = relief(pts, opts.bins[0], opts.bins[1], opts.buriedMm);
  if (r) rows.push({ subject: person.eid, race: person.race, art_family: family, ...r });
}

console.log(`${opts.bone} relief — buried = geometry with another surface outside it on the same ray (> ${opts.buriedMm} mm)`);
console.log('subject                 family     verts  buried  buried_frac  relief_p95_mm  relief_max_mm');
for (const r of rows) {
  console.log(`${String(r.subject).padEnd(22)}  ${String(r.art_family).padEnd(9)}  ${String(r.vertices).padStart(5)}  ${String(r.buried_vertices).padStart(6)}  ${String(r.buried_fraction).padStart(11)}  ${String(r.relief_p95_mm).padStart(13)}  ${String(r.relief_max_mm).padStart(13)}`);
}
if (opts.json) writeFileSync(opts.json, JSON.stringify({ buried_mm: opts.buriedMm, rows }, null, 2));
