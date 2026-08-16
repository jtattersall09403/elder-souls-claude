#!/usr/bin/env node
/**
 * f10-r13c-critic-probe2.mjs — the F10 r13 critic's second instrument.
 *
 * Probe 1's arm B was CONTAMINATED and this file says why rather than deleting it.
 * It applied the scale the way `renderer.js:801` applies `height_scale` — a GROUP scale on the
 * built mesh — and asked whether the 120 px mask moved. It moved (front IoU 0.7913). But
 * `actor-orbit-holes.mjs:collectTriangles` reads a SKINNED mesh from
 * `bone.matrixWorld * boneInverse` and never touches the group's own `matrixWorld`, while it reads
 * a NON-skinned mesh through `o.matrixWorld` — which does carry the group scale. So probe 1
 * scaled the equipment and the presentation pieces and left the skinned body alone. That is not a
 * uniform scale and it is not the thing the round claimed was invisible.
 *
 * Arm B1 below is the honest test: scale every collected TRIANGLE uniformly, which is what a
 * uniform figure scale is, and ask the same two instruments.
 *
 * Arm B2 keeps the contaminated result as its own finding, because the contamination is a fact
 * about `height_scale` and about every offline instrument in this family, and the round's own
 * top recommendation for the next round is "STATURE, AS DATA" through exactly that field.
 *
 * Arm E measures the round's joint-unsatisfiability claim on the half it can be measured on:
 * how does E4's adjacent-identical-pair count actually fall as the body pool grows, over the REAL
 * settlement adjacency, rather than under the 1/pool approximation the round argued from.
 *
 * Usage: node tools/visual/f10-r13c-critic-probe2.mjs [--json=out.json]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  for (const r of (Array.isArray(list) ? list : [])) { if (r && r.id) npcs.push(r); }
}

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
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

function buildOne(rec) {
  const family = artFamilyForRace(rec.race);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family, rec.race);
  g.name = `npc:${rec.id}`;
  actorMod.poseFromRig(g, BODY);
  const A = g.userData.actor;
  let vkey = null;
  g.traverse((o) => { if (o.isMesh && o.userData && o.userData.rigVariantKey) vkey = o.userData.rigVariantKey; });
  return { group: g, id: A.characterId, vkey };
}

/** 120 px mask built from a triangle soup, with an optional UNIFORM scale on every vertex. */
function maskFromTris(tris0, parts, k = 1) {
  const tris = k === 1 ? tris0 : Float32Array.from(tris0, (v) => v * k);
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
    if (!/actor-body|actor-equipment/.test(parts[tri])) continue;
    for (let j = 0; j < 9; j += 3) {
      const x = tris[t + j], y = tris[t + j + 1], z = tris[t + j + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const worldH = maxY - minY;
  const centre = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const eye = new THREE.Vector3(centre.x, centre.y, centre.z + 50 * Math.max(1, k));
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const halfH = worldH * 0.55;
  const proj = new THREE.Matrix4().makeOrthographic(-halfH, halfH, halfH, -halfH, 0.1, 200 * Math.max(1, k), THREE.WebGLCoordinateSystem);
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

const report = { tool: 'f10-r13c-critic-probe2', generated: new Date().toISOString() };

// ── B1: the honest test — a genuinely uniform figure scale ───────────────────────────────────
{
  const rec = npcs.find((n) => artFamilyForRace(n.race) === 'saxhleel') || npcs[0];
  const b = buildOne(rec);
  const { tris, parts } = collectTriangles(THREE, b.group, boneIds);
  const rows = [];
  const base = maskFromTris(tris, parts, 1);
  for (const k of [1.05, 1.15, 1.30, 0.85]) {
    const s = maskFromTris(tris, parts, k);
    rows.push({ uniform_scale: k, world_h_m: s.world_h_m, H_px: s.H_px, h_px: s.h_px, R: s.R,
      mask_IoU_against_unscaled: +iou(base.mask, s.mask).toFixed(6) });
  }
  report.B1_uniform_figure_scale_is_it_visible = {
    method: 'every collected triangle multiplied by k — a genuinely uniform figure scale — then the same 120 px height-normalised mask',
    probe_record: rec.id,
    unscaled: { world_h_m: base.world_h_m, H_px: base.H_px, h_px: base.h_px, R: base.R },
    rows,
    variantKey_hashes_a_scale_axis: null, // filled below
    verdict: rows.every((r) => r.mask_IoU_against_unscaled === 1)
      ? 'INVISIBLE — a uniform figure scale moves the 120 px mask by nothing at all, at every k tested'
      : 'VISIBLE at some k — see rows',
  };
  const { variantKey } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/rigs.js')).href);
  report.B1_uniform_figure_scale_is_it_visible.variantKey_hashes_a_scale_axis =
    variantKey('base.saxhleel', { scale: [1, 1, 1] }) !== variantKey('base.saxhleel', { scale: [3, 3, 3] });
  report.B1_uniform_figure_scale_is_it_visible.variantKey_note =
    '`scale` is a declared VARIANT_AXIS (rigs.js:36) and variantKey (rigs.js:153) hashes base|morph|material|sockets|clips. It never reads `variant.scale`.';
}

// ── B2: the contamination, kept as its own finding about height_scale ────────────────────────
{
  const rec = npcs.find((n) => artFamilyForRace(n.race) === 'saxhleel') || npcs[0];
  const a = buildOne(rec);
  const t0 = collectTriangles(THREE, a.group, boneIds);
  const m0 = maskFromTris(t0.tris, t0.parts, 1);
  const b = buildOne(rec);
  b.group.scale.setScalar(1.15); b.group.updateMatrixWorld(true);
  const t1 = collectTriangles(THREE, b.group, boneIds);
  const m1 = maskFromTris(t1.tris, t1.parts, 1);
  // which parts moved and which did not
  const skinned = [], rigid = [];
  b.group.traverse((o) => { if (o.isMesh) (o.isSkinnedMesh ? skinned : rigid).push(o.name); });
  report.B2_group_scale_is_NOT_a_uniform_scale_in_this_measurement_path = {
    method: 'mesh.scale.setScalar(1.15) exactly as renderer.js:801 applies height_scale, then the same mask',
    world_h_m_before: m0.world_h_m, world_h_m_after: m1.world_h_m,
    world_h_ratio: +(m1.world_h_m / m0.world_h_m).toFixed(4),
    expected_ratio_if_uniform: 1.15,
    C1_R_before: m0.R, C1_R_after: m1.R,
    mask_IoU: +iou(m0.mask, m1.mask).toFixed(6),
    mechanism: 'actor-orbit-holes.mjs:collectTriangles reads a SkinnedMesh as bone.matrixWorld * boneInverse (line 116-135) and never applies the group matrixWorld; it reads a non-skinned mesh through o.matrixWorld (line 146), which does carry the group scale. So the group scale reaches the equipment and presentation pieces and not the skinned body.',
    n_skinned_meshes: skinned.length, n_rigid_meshes: rigid.length,
    rigid_mesh_names: rigid.slice(0, 24),
    reading: 'This is NOT evidence that a uniform scale is visible. It is evidence that height_scale, applied as a group scale, is not a uniform scale as far as every offline instrument in this family is concerned — which matters because the round names height_scale as the next round\'s largest visible win.',
  };
}

// ── E: how does E4 actually fall as the pool grows, over the REAL adjacency ──────────────────
{
  // Reproduce the adjacency the census uses: same settlement, posts within 15 m.
  const posts = [];
  for (const n of npcs) {
    const p = n.post || {};
    if (!p.settlement || !p.pos) continue;
    posts.push({ id: n.id, race: n.race, s: String(p.settlement).toLowerCase(), x: p.pos[0], z: p.pos[2] });
  }
  const bySet = new Map();
  for (const p of posts) { if (!bySet.has(p.s)) bySet.set(p.s, []); bySet.get(p.s).push(p); }
  const adj = [];
  for (const [, list] of bySet) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const dx = list[i].x - list[j].x, dz = list[i].z - list[j].z;
      if (Math.sqrt(dx * dx + dz * dz) <= 15 && list[i].race === list[j].race) adj.push([list[i], list[j]]);
    }
  }
  // FNV-1a over 'npc:'+id, exactly as characterFor hashes, so the draw is the shipped draw shape.
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  const rows = [];
  for (const P of [5, 9, 14, 24, 36, 50, 72, 100, 150, 200, 300, 400, 600, 700, 900]) {
    // per-race pools of size ~P/nRaces would be the real structure; the round's own arithmetic is
    // over the GLOBAL pool, so this reproduces the round's own model on the real adjacency graph.
    let pairs = 0;
    for (const [a, b] of adj) if ((fnv('npc:' + a.id) % P) === (fnv('npc:' + b.id) % P)) pairs++;
    rows.push({ pool_P: P, identical_adjacent_pairs: pairs });
  }
  report.E_how_E4_falls_with_pool_size = {
    method: 'the real same-settlement/within-15 m/same-race adjacency graph, with each person dealt a body by FNV-1a(\'npc:\'+id) % P — the shipped draw shape at a hypothetical pool size P',
    n_posts_with_coordinates: posts.length,
    n_same_race_adjacent_pairs_total: adj.length,
    rows,
    smallest_P_reaching_under_3: (rows.find((r) => r.identical_adjacent_pairs < 3) || {}).pool_P || 'not reached at P<=900',
    smallest_P_reaching_zero: (rows.find((r) => r.identical_adjacent_pairs === 0) || {}).pool_P || 'not reached at P<=900',
  };
}

const out = args.json || null;
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
