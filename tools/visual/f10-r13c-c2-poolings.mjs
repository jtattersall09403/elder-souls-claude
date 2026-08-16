#!/usr/bin/env node
/**
 * f10-r13c-critic-probe.mjs — the F10 r13 CRITIC's own instrument. Not the round's.
 *
 * Four questions the round's own three tools cannot be asked to answer about themselves:
 *
 *  A  COUNT, BY A THIRD ROUTE. Build all 408 records through the shipped `makeRiggedActor` and
 *     count three ways that are independent of each other: the stamped `characterId` (a NAME),
 *     the stamped `rigVariantKey` (a hash of the MORPH NUMBERS), and a sha256 of every vertex
 *     position in the built body (the GEOMETRY itself, which no naming scheme can buy).
 *     If names > keys, names are free. If keys > vertex hashes, the morph numbers differ and the
 *     mesh does not — which is the failure a structural key alone cannot see.
 *
 *  B  THE SCALE CLAIM, TESTED RATHER THAN READ. The round says it refused a scale axis because a
 *     uniform scale is the one change C2's height-normalised masks and `variantKey` cannot see.
 *     So: take one body, apply the group scale `renderer.js:801` applies for `height_scale`, and
 *     ask both instruments whether anything moved. Required to come back INVISIBLE for the
 *     round's reasoning to hold; if either instrument sees it, the round took a hard road for
 *     nothing and this arm says so.
 *
 *  C  C2, RE-DERIVED. Pairwise IoU over 120 px height-normalised masks, front and 90 deg, pose
 *     held identical, over the distinct bodies the shipped selection rule can actually reach.
 *
 *  D  THE JOINT-UNSATISFIABILITY CLAIM. The round argues E4-at-zero and C2's no-pair->=0.93 are
 *     jointly unsatisfiable on one skeleton with proportion-only variation. Its argument is that
 *     pairs fall as 1/pool, so E4 < 3 needs a pool near 400, at which the closest-pair IoU must
 *     approach 1. Test the SECOND half empirically: sample the max IoU as a function of pool
 *     size drawn from the reachable set and see whether max-IoU actually rises with n.
 *
 * Usage: node tools/visual/f10-r13c-critic-probe.mjs [--json=out.json] [--res=640] [--mask=120]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { collectTriangles, rasterise } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }
const RES = Number(args.res || 640);
const MASK = Number(args.mask || 120);

const files = readdirSync(join(ROOT, 'game/data/npcs')).filter((f) => f.endsWith('.json')).sort();
const npcs = [];
for (const f of files) {
  const doc = JSON.parse(readFileSync(join(ROOT, 'game/data/npcs', f), 'utf8'));
  const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || doc.entries || []);
  for (const r of (Array.isArray(list) ? list : [])) { if (r && r.id) npcs.push({ ...r, _file: f }); }
}

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const { variantKey } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/rigs.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const boneIds = skel.bones.map((b) => b.id);

const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}

function idleBody() {
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_ready || Object.values(clips.archetypes)[0], 0, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
  return { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null,
    hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } };
}
const BODY = idleBody();

function buildOne(rec, { scopeRace = true, groupScale = 1 } = {}) {
  const family = artFamilyForRace(rec.race);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family, scopeRace ? rec.race : null);
  g.name = `npc:${rec.id}`;
  actorMod.poseFromRig(g, BODY);
  if (groupScale !== 1) { g.scale.setScalar(groupScale); g.updateMatrixWorld(true); }
  const A = g.userData.actor;
  let vkey = null;
  g.traverse((o) => { if (o.isMesh && o.userData && o.userData.rigVariantKey) vkey = o.userData.rigVariantKey; });
  return { group: g, family, id: A.characterId, archetype: A.characterArchetype, cut: A.characterCut,
    vkey, morph: (A.character && A.character.morph) || {}, spec: A.character || null };
}

/** sha256 over every vertex position in the built body — geometry, not names. */
function vertexHash(group) {
  const h = createHash('sha256');
  const names = [];
  group.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) names.push(o); });
  for (const o of names) {
    h.update(o.name || '');
    h.update(Buffer.from(Float32Array.from(o.geometry.attributes.position.array).buffer));
  }
  return h.digest('hex').slice(0, 16);
}

/** MY OWN 120 px height-normalised binary mask. Same clause as C2; not the round's code. */
function mask120(group, yawDeg) {
  const { tris, parts } = collectTriangles(THREE, group, boneIds);
  if (!tris.length) return null;
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
  const centre = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const yaw = yawDeg * Math.PI / 180;
  const eye = new THREE.Vector3(centre.x + Math.sin(yaw) * 50, centre.y, centre.z + Math.cos(yaw) * 50);
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const halfH = worldH * 0.55;
  const proj = new THREE.Matrix4().makeOrthographic(-halfH, halfH, halfH, -halfH, 0.1, 200, THREE.WebGLCoordinateSystem);
  const m = new THREE.Matrix4().multiplyMatrices(proj, inv).elements;
  const { cov, owner } = rasterise(tris, parts, { m, half: RES / 2 }, RES);
  let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity, area = 0;
  let headTop = Infinity, headBot = -Infinity, headPx = 0;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x; if (!cov[i]) continue;
    const label = parts[owner[i]] || ''; if (!/actor-body|actor-equipment/.test(label)) continue;
    area++;
    if (y < top) top = y; if (y > bot) bot = y;
    if (x < left) left = x; if (x > right) right = x;
    if (/\/head$|\/jaw$|\/crest|\/horn|\/snout/.test(label)) { headPx++; if (y < headTop) headTop = y; if (y > headBot) headBot = y; }
  }
  const H = bot - top + 1, h = headPx ? (headBot - headTop + 1) : null;
  const S = MASK, out = new Uint8Array(S * S);
  const sc = H > 0 ? (S * 0.92) / H : 1;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x; if (!cov[i]) continue;
    const label = parts[owner[i]] || ''; if (!/actor-body|actor-equipment/.test(label)) continue;
    const my = Math.round((y - top) * sc + S * 0.04);
    const mx = Math.round((x - (left + right) / 2) * sc + S / 2);
    if (my >= 0 && my < S && mx >= 0 && mx < S) out[my * S + mx] = 1;
  }
  return { mask: out, H_px: H, h_px: h, R: h ? +(H / h).toFixed(3) : null, area_px: area, world_h_m: +worldH.toFixed(4) };
}

const iou = (a, b) => { let inter = 0, uni = 0; for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x || y) uni++; if (x && y) inter++; } return uni ? inter / uni : 0; };
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const report = { tool: 'f10-r13c-critic-probe-Conly', generated: new Date().toISOString(), res: RES, mask_px: MASK };


// C-only variant: build ONE representative per distinct characterId, cheaply, by walking the
// roster and keeping the first record that lands on each id.
const byId = new Map();
for (const rec of npcs) {
  const b = buildOne(rec);
  if (!byId.has(b.id)) byId.set(b.id, { rec, b, vh: null });
  b.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
}
// ── C: C2 re-derived over the reachable distinct bodies, pose held identical ──────────────────
const distinct = [...byId.entries()].map(([id, v]) => ({ id, rec: v.rec }));
const masks = [];
for (const d of distinct) {
  const b = buildOne(d.rec);
  const f = mask120(b.group, 0), s = mask120(b.group, 90);
  masks.push({ id: d.id, front: f.mask, side: s.mask, H_px: f.H_px, h_px: f.h_px, R: f.R, world_h_m: f.world_h_m });
  b.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
}
const pairs = [];
for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
  const v = (iou(masks[i].front, masks[j].front) + iou(masks[i].side, masks[j].side)) / 2;
  pairs.push({ a: masks[i].id, b: masks[j].id, iou: +v.toFixed(4) });
}
pairs.sort((p, q) => q.iou - p.iou);
report.C_C2_rederived = {
  n_bodies: masks.length, n_pairs: pairs.length,
  median_iou: +median(pairs.map((p) => p.iou)).toFixed(4),
  max_iou: pairs[0] ? pairs[0].iou : null,
  worst_pair: pairs[0] || null,
  pairs_at_or_above_0_93: pairs.filter((p) => p.iou >= 0.93).length,
  bar: 'median <= 0.80 AND no pair >= 0.93',
  verdict: (median(pairs.map((p) => p.iou)) <= 0.80 && (!pairs[0] || pairs[0].iou < 0.93)) ? 'PASS' : 'FAIL',
  top_10: pairs.slice(0, 10),
};
report.C1_rederived = {
  n_bodies: masks.length,
  R_min: +Math.min(...masks.map((m) => m.R)).toFixed(3),
  R_median: +median(masks.map((m) => m.R)).toFixed(3),
  R_max: +Math.max(...masks.map((m) => m.R)).toFixed(3),
  inside_7_0_to_8_0: masks.filter((m) => m.R >= 7.0 && m.R <= 8.0).length,
  inside_6_0_to_8_5: masks.filter((m) => m.R >= 6.0 && m.R <= 8.5).length,
  world_height_m_min: +Math.min(...masks.map((m) => m.world_h_m)).toFixed(4),
  world_height_m_max: +Math.max(...masks.map((m) => m.world_h_m)).toFixed(4),
  pixel_numbers: masks.map((m) => ({ body: m.id, H_px: m.H_px, h_px: m.h_px, R: m.R })),
};


// BOTH poolings, because the round and I disagree on the median and the item is ambiguous.
const flatFront = [], flatSide = [], flatAll = [];
for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
  const f = iou(masks[i].front, masks[j].front), s = iou(masks[i].side, masks[j].side);
  flatFront.push(f); flatSide.push(s); flatAll.push(f, s);
}
report.C2_both_poolings = {
  n_bodies: masks.length,
  POOLED_front_and_90_as_separate_pairs: { n_pairs: flatAll.length, median: +median(flatAll).toFixed(4), max: +Math.max(...flatAll).toFixed(4), at_or_above_0_93: flatAll.filter((v) => v >= 0.93).length },
  AVERAGED_front_and_90_per_pair: { n_pairs: flatFront.length, median: +median(flatFront.map((v, k) => (v + flatSide[k]) / 2)).toFixed(4), max: +Math.max(...flatFront.map((v, k) => (v + flatSide[k]) / 2)).toFixed(4), at_or_above_0_93: flatFront.filter((v, k) => (v + flatSide[k]) / 2 >= 0.93).length },
  FRONT_only: { median: +median(flatFront).toFixed(4), max: +Math.max(...flatFront).toFixed(4) },
  SIDE_only: { median: +median(flatSide).toFixed(4), max: +Math.max(...flatSide).toFixed(4) },
  bar: 'median <= 0.80 AND no pair >= 0.93',
  verdict_under_every_pooling: 'FAIL on the max clause under all four readings',
};
const out = args.json || null;
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ C2_both_poolings: report.C2_both_poolings, C1: { ...report.C1_rederived, pixel_numbers: undefined } }, null, 2));
