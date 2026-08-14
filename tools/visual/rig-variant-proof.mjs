#!/usr/bin/env node
// W1-30D — does the reuse claim survive contact with a measurement?
//
// The gate: *">= 12 visually distinct characters derived from <= 2 base meshes, and improving a
// base measurably improves all of them (change base albedo on a copy; >= 12 characters change)"*.
// Two halves, and the second is the one that is easy to fake — a registry of sixteen names that
// all build the same body passes any count and reuses nothing.
//
//   DISTINCTNESS is measured on the SILHOUETTE, not on the spec. Comparing variant specs would
//   prove only that the file has sixteen different rows in it. Each character is built through the
//   real `makeRiggedActor` -> `poseFromRig` path at one fixed pose, rasterised from front and 3/4,
//   and every pair is scored by silhouette IoU. Two characters count as distinct when at least one
//   view differs by more than `IOU_FLOOR`. Colour is excluded on purpose: the art-direction board
//   found Morrowind's own nine regions are not separable by colour alone (9.1% against an 11.1%
//   chance baseline), and the terrain builder found the same independently — so a variety claim
//   resting on palette is a claim resting on nothing. This measures shape.
//
//   PROPAGATION is measured by editing the BASE on a copy of the tree and counting how many
//   characters changed. That is the null control the plan names, and it is the only evidence that
//   distinguishes "one base, sixteen variants" from "sixteen hand-built characters that happen to
//   sit in one file". If fewer than 12 change, the reuse is decorative and this exits non-zero.
'use strict';

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SUBSET = ['game/src', 'game/data/combat', 'game/vendor'];

/** Two silhouettes this similar are the same character wearing two names. 0.985 is deliberately
 *  strict: a build multiplier of 0.86 against 1.18 moves far more than 1.5% of the outline, so a
 *  variant that cannot clear this bar is not varying anything a player would see. */
const IOU_FLOOR = 0.985;
const RES = 320;

async function build(root) {
  const THREE = await import(pathToFileURL(join(root, 'game/vendor/three/three.module.js')).href);
  const actor = await import(pathToFileURL(join(root, 'game/src/render/actor.js')).href);
  const rigs = await import(pathToFileURL(join(root, 'game/src/render/lib/rigs.js')).href);
  const { Rig } = await import(pathToFileURL(join(root, 'game/src/combat/skeleton.js')).href);
  const { addPose } = await import(pathToFileURL(join(root, 'game/src/combat/clips.js')).href);
  const tools = await import(pathToFileURL(join(ROOT, 'tools/visual/actor-orbit-holes.mjs')).href);
  const skel = JSON.parse(readFileSync(join(root, 'game/data/combat/skeleton.json'), 'utf8'));
  const hitgeo = JSON.parse(readFileSync(join(root, 'game/data/combat/hitgeometry.json'), 'utf8'));
  const clips = JSON.parse(readFileSync(join(root, 'game/data/combat/clips.json'), 'utf8'));

  const mats = {};
  for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
    'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
    const m = new THREE.MeshStandardMaterial({ color: 0x808080 });
    m.userData = { visualFamily: f };
    mats[f] = m;
  }
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_ready, 0.5, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);

  const masks = new Map();
  const census = rigs.rigCensus();
  for (const id of rigs.knownCharacters()) {
    const spec = rigs.character(id);
    const family = { 'base.saxhleel': 'saxhleel', 'base.humanoid': 'humanoid', 'base.slitherfang': 'beast' }[spec.base];
    const g = actor.makeRiggedActor(mats, undefined, undefined, family);
    // Name it as the renderer would, then override with the explicit id: this exercises the same
    // `ensureBuilt` path the game uses and pins the variant instead of hashing for it.
    g.name = `npc:${id}`;
    g.userData.actor.characterId = id;
    actor.poseFromRig(g, {
      rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 30, equipLoadPct: 20, move: null,
      hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null,
      moves: null,
    });
    const { tris, parts } = tools.collectTriangles(THREE, g, skel.bones.map((b) => b.id));
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
      if (tris[i] < minx) minx = tris[i]; if (tris[i] > maxx) maxx = tris[i];
      if (tris[i + 1] < miny) miny = tris[i + 1]; if (tris[i + 1] > maxy) maxy = tris[i + 1];
      if (tris[i + 2] < minz) minz = tris[i + 2]; if (tris[i + 2] > maxz) maxz = tris[i + 2];
    }
    // FRAMING IS SHARED, NOT PER-CHARACTER. Auto-framing each character would normalise away the
    // very size differences the morph creates, and every variant would score identical. The camera
    // is pinned to the SKELETON's own height so a stouter character is measurably stouter.
    const target = new THREE.Vector3(0, 0.95, 0);
    const views = [];
    for (const th of [0, Math.PI * 0.25]) {
      const d = 3.2;
      const eye = new THREE.Vector3(Math.sin(th) * d, target.y + 0.25, Math.cos(th) * d);
      const m = tools.viewProj(THREE, eye, target, 45, 1, 0.1, 30).elements;
      const { cov } = tools.rasterise(tris, parts, { m, half: RES / 2 }, RES);
      views.push(cov);
    }
    masks.set(id, { views, tris: tris.length / 9, bbox: [maxx - minx, maxy - miny, maxz - minz] });
  }
  return { masks, census, rigs };
}

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x && y) inter++; if (x || y) uni++; }
  return uni ? inter / uni : 1;
}

const args = new Set(process.argv.slice(2));
const { masks, census } = await build(ROOT);

console.log(`rig census: skeleton ${census.skeleton}, ${census.bases} bases `
  + `(${census.baseIds.join(', ')}), ${census.characters} characters, `
  + `${census.distinctVariants} distinct variant keys, ${census.duplicate.length} duplicate, `
  + `${census.orphanBase.length} orphan-base — ${census.pass ? 'PASS' : 'FAIL'}`);
for (const d of census.duplicate) console.log(`  duplicate: ${d}`);
for (const o of census.orphanBase) console.log(`  orphan base: ${o}`);

const ids = [...masks.keys()];
let worstPair = null, collapsed = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const A = masks.get(ids[i]), B = masks.get(ids[j]);
    const best = Math.min(iou(A.views[0], B.views[0]), iou(A.views[1], B.views[1]));
    if (!worstPair || best > worstPair.iou) worstPair = { iou: best, a: ids[i], b: ids[j] };
    if (best > IOU_FLOOR) collapsed.push(`${ids[i]} ~ ${ids[j]} (IoU ${best.toFixed(4)})`);
  }
}
const distinct = ids.length - new Set(collapsed.map((c) => c.split(' ~ ')[1].split(' ')[0])).size;
console.log(`silhouette distinctness: ${distinct}/${ids.length} characters distinct at IoU <= ${IOU_FLOOR}`);
console.log(`  most-similar pair: ${worstPair.a} vs ${worstPair.b} at IoU ${worstPair.iou.toFixed(4)}`);
for (const c of collapsed.slice(0, 6)) console.log(`  collapsed: ${c}`);

// --- propagation: edit the BASE on a copy, count how many characters move ------------------
let propagated = 0, propTotal = ids.length;
if (!args.has('--no-propagation')) {
  const dir = join(process.env.ES_SCRATCH || tmpdir(), `w1-30d-propagation-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  try {
    for (const rel of SUBSET) { mkdirSync(join(dir, dirname(rel)), { recursive: true }); cpSync(join(ROOT, rel), join(dir, rel), { recursive: true }); }
    const p = join(dir, 'game/src/render/actor.js');
    const src = readFileSync(p, 'utf8');
    // The base edit: widen every limb in the shared body plan by 6%. This is a change to the BASE,
    // touching no character spec — so any character that moves, moved because it is derived.
    const out = src.replace('const rScale = (r) => r * M.build;', 'const rScale = (r) => r * M.build * 1.06;   // PROPAGATION PROBE');
    if (out === src) throw new Error('propagation probe patched nothing — its anchor has moved');
    writeFileSync(p, out);
    const after = await build(dir);
    const byBase = {};
    for (const id of ids) {
      const B = after.masks.get(id);
      if (!B) continue;
      const A = masks.get(id);
      const base = after.rigs.character(id).base;
      byBase[base] = byBase[base] || [0, 0];
      byBase[base][1]++;
      const same = Math.min(iou(A.views[0], B.views[0]), iou(A.views[1], B.views[1]));
      if (same < 0.999) { propagated++; byBase[base][0]++; }
    }
    console.log(`base propagation: widening the shared HUMANOID body plan by 6% moved ${propagated}/${propTotal} characters`);
    for (const [b, [n, t]] of Object.entries(byBase)) console.log(`  ${b}: ${n}/${t}`);
    // Stated rather than smoothed over: `base.slitherfang` is expected NOT to move, because the
    // probe edits `rScale`, which is the humanoid tube plan, and the quadruped shares the skeleton
    // and not the body plan — the exemption recorded in actor.js. A probe that moved it would mean
    // the exemption is wrong, not that reuse is better.
    if ((byBase['base.slitherfang'] || [0])[0] > 0) {
      console.log('  !! the quadruped moved under a humanoid-plan probe: the written exemption is wrong.');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ok = census.pass && distinct >= 12 && propagated >= 12;
console.log(ok ? 'rig-variant-proof: PASS' : 'rig-variant-proof: FAIL');
process.exit(ok ? 0 : 1);
