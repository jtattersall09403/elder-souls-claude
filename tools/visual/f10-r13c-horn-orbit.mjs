#!/usr/bin/env node
/**
 * f10-r13c-horn-orbit.mjs — B3 on the two rows round 13 put OUTSIDE the shipped horn range.
 *
 * The round's own status names them and asks a critic to shoot them: `sax.hist-priest` at
 * `horn 1.85` and `sax.naga-broad` at `horn 1.95`, against a shipped maximum of 1.6. `RI-VIS10`
 * B3's instrument is the orbit-30 pair — *"check whether the feature's occluding contour moves
 * against the silhouette between the two frames"*. So: build each row through the shipped
 * registry, rasterise the silhouette at 0 and 30 deg, and measure the head-region contour.
 *
 * The arm that makes this mean anything is the CONTROL: the same measurement on the same row with
 * `horn` forced to 0. A horn that is geometry must make the two rows' silhouettes differ; a horn
 * that is paint cannot.
 *
 * Usage: node tools/visual/f10-r13c-horn-orbit.mjs [--json=out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectTriangles, rasterise } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }
const RES = Number(args.res || 768);

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const rigsMod = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/rigs.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const boneIds = skel.bones.map((b) => b.id);

const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}
const rig = new Rig(skel, hitgeo);
rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
addPose(rig, clips.archetypes.idle_ready, 0, 1);
rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
const BODY = { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null,
  hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } };

/** Build a NAMED registry row directly, through the shipped `characterId` override path. */
function buildRow(id) {
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, 'saxhleel', 'saxhleel');
  g.userData.actor.characterId = id;
  g.name = 'probe:' + id;
  actorMod.poseFromRig(g, BODY);
  return g;
}
/** The same row with `horn` forced to a value — the required-to-disagree control. */
function buildRowHorn(id, hornValue) {
  const spec = rigsMod.character(id);
  const alt = id + '__hornprobe' + String(hornValue).replace('.', '_');
  try { rigsMod.character(alt); } catch {
    rigsMod.registerCharacter(alt, { ...spec, morph: { ...(spec.morph || {}), horn: hornValue } });
  }
  return buildRow(alt);
}

/** Head-region silhouette at a bearing: the binary mask of the head/crest/horn/snout parts only. */
function headMask(group, yawDeg) {
  const { tris, parts } = collectTriangles(THREE, group, boneIds);
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
    if (!/actor-body|actor-equipment/.test(parts[tri])) continue;
    for (let k = 0; k < 9; k += 3) {
      const x = tris[t + k], y = tris[t + k + 1], z = tris[t + k + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const worldH = maxY - minY;
  // Frame the HEAD, not the whole figure: the top 22% of the bounding box.
  const cy = maxY - worldH * 0.11;
  const centre = new THREE.Vector3((minX + maxX) / 2, cy, (minZ + maxZ) / 2);
  const yaw = yawDeg * Math.PI / 180;
  const eye = new THREE.Vector3(centre.x + Math.sin(yaw) * 50, centre.y, centre.z + Math.cos(yaw) * 50);
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const half = worldH * 0.13;
  const proj = new THREE.Matrix4().makeOrthographic(-half, half, half, -half, 0.1, 200, THREE.WebGLCoordinateSystem);
  const m = new THREE.Matrix4().multiplyMatrices(proj, inv).elements;
  const { cov, owner } = rasterise(tris, parts, { m, half: RES / 2 }, RES);
  const all = new Uint8Array(RES * RES), horn = new Uint8Array(RES * RES);
  let allN = 0, hornN = 0;
  for (let i = 0; i < RES * RES; i++) {
    if (!cov[i]) continue;
    const label = parts[owner[i]] || '';
    if (!/actor-body|actor-equipment/.test(label)) continue;
    all[i] = 1; allN++;
    if (/\/horn/.test(label)) { horn[i] = 1; hornN++; }
  }
  return { all, horn, all_px: allN, horn_px: hornN };
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k], y = b[k]; if (x || y) u++; if (x && y) i++; } return u ? i / u : 0; };

const rows = [];
for (const [id, declared] of [['sax.hist-priest', 1.85], ['sax.naga-broad', 1.95]]) {
  const g0 = buildRow(id);
  const morph = (g0.userData.actor.character || {}).morph || {};
  const a0 = headMask(g0, 0), a30 = headMask(g0, 30);
  const gC = buildRowHorn(id, 0);
  const c0 = headMask(gC, 0), c30 = headMask(gC, 30);
  rows.push({
    row: id, declared_horn: declared, morph_horn_read_off_the_built_actor: morph.horn ?? null,
    shipped: {
      horn_pixels_at_0deg: a0.horn_px, horn_pixels_at_30deg: a30.horn_px,
      head_silhouette_px_0: a0.all_px, head_silhouette_px_30: a30.all_px,
      head_silhouette_IoU_0_vs_30: +iou(a0.all, a30.all).toFixed(4),
    },
    control_horn_forced_to_0: {
      horn_pixels_at_0deg: c0.horn_px, horn_pixels_at_30deg: c30.horn_px,
      head_silhouette_px_0: c0.all_px, head_silhouette_px_30: c30.all_px,
    },
    horn_is_geometry: {
      silhouette_changes_when_the_horn_is_removed_at_0deg: a0.all_px !== c0.all_px,
      silhouette_IoU_shipped_vs_hornless_at_0deg: +iou(a0.all, c0.all).toFixed(4),
      silhouette_IoU_shipped_vs_hornless_at_30deg: +iou(a30.all, c30.all).toFixed(4),
      horn_px_delta_0deg: a0.all_px - c0.all_px,
      contour_moves_between_bearings: a0.horn_px !== a30.horn_px,
      verdict: (a0.horn_px > 0 && a0.all_px !== c0.all_px && a0.horn_px !== a30.horn_px)
        ? 'GEOMETRY — the horn occupies silhouette pixels, removing it changes the silhouette, and its contour moves between the two bearings'
        : 'NOT ESTABLISHED — see the numbers',
    },
  });
}
const report = { tool: 'f10-r13c-horn-orbit', generated: new Date().toISOString(), res: RES,
  bar: 'RI-VIS10 B3 — the feature\'s occluding contour must move against the silhouette between the orbit-30 pair; absent or texture-only fails',
  note: 'shipped max horn before this round was 1.6; these two rows are the ONLY ones the round put outside it and it asked a critic to shoot them',
  rows };
if (args.json) writeFileSync(args.json, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
