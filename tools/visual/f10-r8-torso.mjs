#!/usr/bin/env node
/**
 * f10-r8-torso.mjs — does this trunk have a waist, or is it a sandwich board.
 *
 * WHY THIS TOOL EXISTS. Four consecutive `F10` rounds have been judged with the same sentence:
 * *"Still slabs. Eight orbit angles of the player: a flat pale-blue sandwich-board torso, no waist,
 * no shoulder line"* (`orchestration/status/W1-F10-r7-appearance.json`, key
 * `does_it_look_better.3_the_body_at_figure_distance_NO_UNCHANGED_STILL_SLABS`). That is a judgement
 * about a SHAPE, and no instrument in `tools/visual/` reports one: `f10-silhouette.mjs` reports the
 * head-count ratio `R` and pairwise IoU (is this figure the same as that one), `actor-orbit-holes`
 * reports enclosed background, `character-face-relief` reports the head. None of them can tell a
 * cone from a body.
 *
 * WHAT IT MEASURES, and every number is a shape number — no colour, material or light claim may be
 * made from this tool (the same limit `f10-silhouette.mjs` states for itself).
 *
 *   waist_pinch      1 - w(waist) / mean(w(chest), w(hip)), from the FRONT silhouette, with the
 *                    three heights taken from the rig's own `spine_02` / `spine_00` / `pelvis` rest
 *                    positions rather than from fractions of the figure height — so a heavy or a
 *                    slight morph is measured at its own waist and not at a nominal one.
 *                    0 or below = the trunk is a cone or a column: THERE IS NO WAIST.
 *   hip_flare        w(hip) / w(waist). Below 1.0 the garment is narrowest where a body is widest.
 *   torso_solidity   silhouette area / convex-hull area over the band [pelvis, neck]. A flat plate
 *                    or a cone is convex and scores ~1.00; a figure with a waist and an arm gap
 *                    does not.
 *   chest_depth_ratio  w90(chest) / w0(chest) — how deep the trunk is against how wide.
 *   shoulder_step    (max w over the chest band) / w(chest) at the widest, i.e. whether the width
 *                    CHANGES at the shoulder line at all.
 *
 * WHICH INPUT DOES EVERY ARM FABRICATE? (HAZARDS §0.)
 *   1. THE POSE — not fabricated: `clips.json`'s own archetype through the same `addPose` the game
 *      calls. If the shipped idle is a mannequin, that is what is measured.
 *   2. THE ROSTER — the shipped NPC files, with `renderer.js`'s own `artFamilyForRace` imported
 *      rather than mirrored, and `group.name` written in renderer.js's format so `characterFor()`
 *      picks the same body the game picks.
 *   3. THE CAMERA — orthographic, so a width is a width and not a function of the distance the
 *      operator happened to choose.
 *   4. THE THRESHOLDS — constructed, stated below, and NOT validated against a measured human
 *      population. They are set where the three synthetic arms of `--self-test` separate.
 *
 * MAKE IT FAIL ON PURPOSE:
 *   node tools/visual/f10-r8-torso.mjs --self-test
 * rasterises three synthetic trunks — a slab, a cone, and a waisted figure — and REQUIRES that
 * `waist_pinch` separates them. A two-arm test would not distinguish "no waist" from "tapered",
 * and "tapered" is exactly what the shipped body already is.
 *
 * Usage:
 *   node tools/visual/f10-r8-torso.mjs                      # the shipped roster sample
 *   node tools/visual/f10-r8-torso.mjs --sample=8 --json=out.json
 *   node tools/visual/f10-r8-torso.mjs --self-test
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
// THE MAIN-MODULE GUARD, and it is not decoration. HAZARDS §16 records that importing
// `f10-r3-materials.mjs` ran its entire capture and exited out of the importer, and §17 records the
// same family. Everything below the guard runs only when this file is argv[1].
const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

const opts = { res: 768, json: null, selfTest: false, sample: 6, pose: 'idle', phase: 0 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'res') opts.res = Number(v);
  else if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'sample') opts.sample = Number(v);
  else if (k === 'pose') opts.pose = v;
  else if (k === 'phase') opts.phase = Number(v);
}

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const { collectTriangles, rasterise } = await import(pathToFileURL(join(ROOT, 'tools/visual/actor-orbit-holes.mjs')).href);

/** Orthographic view-projection looking along -Z after a yaw, framing a world box. Copied in
 *  behaviour from `f10-silhouette.mjs`'s `orthoVP` because both need a width that does not depend
 *  on camera distance; kept local so this tool does not import a module that runs on load. */
function orthoVP(centre, halfW, halfH, yawDeg) {
  const yaw = yawDeg * Math.PI / 180;
  const eye = new THREE.Vector3(centre.x + Math.sin(yaw) * 50, centre.y, centre.z + Math.cos(yaw) * 50);
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const proj = new THREE.Matrix4().makeOrthographic(-halfW, halfW, halfH, -halfH, 0.1, 200, THREE.WebGLCoordinateSystem);
  return new THREE.Matrix4().multiplyMatrices(proj, inv);
}

/** Per-row span of a binary mask, plus the mapping back to world metres. */
function rowSpans(cov, res) {
  const lo = new Int32Array(res).fill(-1), hi = new Int32Array(res).fill(-1);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      if (!cov[y * res + x]) continue;
      if (lo[y] < 0) lo[y] = x;
      hi[y] = x;
    }
  }
  return { lo, hi };
}

/** Monotone-chain convex hull over integer points. */
function hullArea(points) {
  if (points.length < 3) return 0;
  const p = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  let a2 = 0;
  for (let i = 0; i < h.length; i++) { const j = (i + 1) % h.length; a2 += h[i][0] * h[j][1] - h[j][0] * h[i][1]; }
  return Math.abs(a2) / 2;
}

/**
 * The whole measurement, over one figure already reduced to world-space triangles.
 * `landmarks` are WORLD Y metres for hip, waist, chest and neck — taken from the rig, never guessed.
 */
export function torsoShape(tris, landmarks, res = 768) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let t = 0; t < tris.length; t += 3) {
    const x = tris[t], y = tris[t + 1], z = tris[t + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const worldH = maxY - minY;
  const centre = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const halfH = worldH * 0.55, halfW = halfH;
  const parts = new Array(tris.length / 9).fill('x');   // labels are unused here; shape only
  const metresPerPx = (2 * halfH) / res;
  const yToRow = (yw) => Math.round((1 - ((yw - centre.y) / halfH)) * res / 2);

  const view = {};
  for (const yawDeg of [0, 90]) {
    const m = orthoVP(centre, halfW, halfH, yawDeg).elements;
    const { cov } = rasterise(tris, parts, { m, half: res / 2 }, res);
    const { lo, hi } = rowSpans(cov, res);
    const widthAt = (yw) => {
      const r = yToRow(yw);
      if (r < 0 || r >= res || lo[r] < 0) return null;
      return (hi[r] - lo[r] + 1) * metresPerPx;
    };
    view[yawDeg] = { cov, lo, hi, widthAt };
  }

  const front = view[0];
  const w = (yw) => front.widthAt(yw);
  const wHip = w(landmarks.hip), wWaist = w(landmarks.waist), wChest = w(landmarks.chest);
  const dChest = view[90].widthAt(landmarks.chest);

  // solidity over the trunk band only — hip to neck, so legs and head cannot flatter it.
  const rTop = yToRow(landmarks.neck), rBot = yToRow(landmarks.hip);
  const pts = [];
  let area = 0;
  for (let y = Math.max(0, rTop); y <= Math.min(res - 1, rBot); y++) {
    if (front.lo[y] < 0) continue;
    area += front.hi[y] - front.lo[y] + 1;
    pts.push([front.lo[y], y], [front.hi[y], y]);
  }
  const hull = hullArea(pts);

  // the widest row anywhere in the trunk band, for the shoulder-step number
  let wMax = 0;
  for (let y = Math.max(0, rTop); y <= Math.min(res - 1, rBot); y++) {
    if (front.lo[y] < 0) continue;
    wMax = Math.max(wMax, (front.hi[y] - front.lo[y] + 1) * metresPerPx);
  }

  const mean = (a, b) => (a + b) / 2;
  return {
    figure_height_m: +worldH.toFixed(4),
    w_hip_m: wHip === null ? null : +wHip.toFixed(4),
    w_waist_m: wWaist === null ? null : +wWaist.toFixed(4),
    w_chest_m: wChest === null ? null : +wChest.toFixed(4),
    w_max_trunk_m: +wMax.toFixed(4),
    waist_pinch: (wHip && wWaist && wChest) ? +(1 - wWaist / mean(wChest, wHip)).toFixed(4) : null,
    hip_flare: (wHip && wWaist) ? +(wHip / wWaist).toFixed(4) : null,
    chest_depth_ratio: (dChest && wChest) ? +(dChest / wChest).toFixed(4) : null,
    torso_solidity: hull > 0 ? +(area / hull).toFixed(4) : null,
  };
}

// ---------------------------------------------------------------------------------------
// self-test — three synthetic trunks whose `waist_pinch` is REQUIRED to disagree.
// ---------------------------------------------------------------------------------------
function boxTris(out, cx, cy, cz, hx, hy, hz) {
  const v = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]].map((p) => [p[0] + cx, p[1] + cy, p[2] + cz]);
  const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1],
    [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]];
  for (const t of f) for (const i of t) out.push(v[i][0], v[i][1], v[i][2]);
  return out;
}
/** A stack of boxes whose half-width follows `profile(t)` — enough to make a silhouette. */
function stack(profile, y0 = 0.9, y1 = 1.55, n = 40) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = y0 + (y1 - y0) * t, h = (y1 - y0) / n / 2;
    const hx = profile(t);
    boxTris(out, 0, y, 0, hx, h * 1.05, hx * 0.62);
  }
  // legs and a head, so the figure has a real height and the band clipping is exercised
  boxTris(out, -0.10, 0.45, 0, 0.06, 0.45, 0.06);
  boxTris(out, 0.10, 0.45, 0, 0.06, 0.45, 0.06);
  boxTris(out, 0, 1.66, 0, 0.09, 0.11, 0.09);
  return out;
}

if (IS_CLI && opts.selfTest) {
  const land = { hip: 0.98, waist: 1.10, chest: 1.34, neck: 1.54 };
  const arms = {
    // a SLAB: one width from hip to shoulder
    slab: stack(() => 0.22),
    // a CONE: monotone widening from hip to chest — this is what the shipped body already is,
    // and it is the arm a two-arm test would wrongly call a pass
    cone: stack((t) => 0.17 + 0.09 * t),
    // a WAISTED figure: narrow in the middle, flared at the hip and the chest
    waisted: stack((t) => 0.225 - 0.075 * Math.exp(-((t - 0.28) ** 2) / 0.02)),
  };
  const got = {};
  for (const [name, tris] of Object.entries(arms)) {
    got[name] = torsoShape(Float32Array.from(tris), land, 512);
    const r = got[name];
    console.log(`self-test  ${name.padEnd(8)} waist_pinch=${String(r.waist_pinch).padStart(8)}  hip_flare=${String(r.hip_flare).padStart(7)}  solidity=${r.torso_solidity}`);
  }
  // THE CONE IS NOT REQUIRED TO READ AS ZERO, and the first cut of this assertion demanded that
  // and failed. A monotone taper genuinely does put a little less width at the waist than the mean
  // of hip and chest — measured here, 0.037 — so a threshold that calls that zero is wrong about
  // the arithmetic. What the instrument must do is separate it from a real waist BY AN ORDER, and
  // that is what is asserted: the waisted arm's pinch is required to be 4x the cone's.
  const ok = Math.abs(got.slab.waist_pinch) < 0.02
    && got.cone.waist_pinch < 0.08
    && got.waisted.waist_pinch > 4 * Math.max(Math.abs(got.slab.waist_pinch), got.cone.waist_pinch)
    && got.waisted.hip_flare > 1.15 && got.cone.hip_flare < 1.0
    && got.slab.torso_solidity > 0.99 && got.waisted.torso_solidity < 0.98;
  console.log(`self-test  the three arms ${ok ? 'DISAGREE — a CONE reads as no-waist just as a SLAB does, which is the whole point: the shipped trunk is a cone and a taper is not a waist' : 'DO NOT DISAGREE AS REQUIRED'}`);
  if (!ok) { console.error('self-test FAILED.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// the shipped roster
// ---------------------------------------------------------------------------------------
if (IS_CLI) {
  const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
    'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
  const mats = {};
  for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }
  const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
  const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
  const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
  const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
  const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
  const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
  const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));

  const roster = [];
  for (const f of readdirSync(join(ROOT, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(join(ROOT, 'game/data/npcs', f), 'utf8'));
    for (const n of (Array.isArray(d) ? d : (d.npcs || d.records || []))) roster.push({ eid: n.eid || n.id, race: n.race });
  }
  const step = Math.max(1, Math.floor(roster.length / opts.sample));
  const sample = [{ eid: 'player', race: 'saxhleel' }, ...roster.filter((_, i) => i % step === 0).slice(0, opts.sample)];

  const rows = [];
  for (const person of sample) {
    const family = artFamilyForRace(person.race);
    if (family === 'beast') continue;                       // quadruped: no trunk landmark applies
    const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
    group.name = person.eid === 'player' ? 'player' : `npc:${person.eid}`;
    const rig = new Rig(skel, hitgeo);
    rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
    addPose(rig, clips.archetypes[opts.pose] || Object.values(clips.archetypes)[0], opts.phase, 1);
    rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
    actorMod.poseFromRig(group, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20,
      move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } });
    const built = group.userData.actor.built;
    if (!built) continue;
    const boneY = (id) => {
      const i = built.index.get(id);
      return i === undefined ? null : new THREE.Vector3().setFromMatrixPosition(built.restWorld[i]).y;
    };
    const land = { hip: boneY('pelvis'), waist: boneY('spine_00'), chest: boneY('spine_02'), neck: boneY('neck') };
    if (Object.values(land).some((v) => v === null)) continue;
    const { tris, parts } = collectTriangles(THREE, group, skel.bones.map((b) => b.id));
    // The FIGURE, not its kit: weapons and shields are not part of a body's silhouette, and a
    // shield held at the side would otherwise be counted as trunk width.
    //
    // TWO POPULATIONS, AND THE SECOND ONE IS THE ANSWER TO THE QUESTION. The first run of this
    // tool measured the whole figure and reported `waist_pinch = 0.12` on a trunk that plainly has
    // no waist. It is not wrong — it is measuring the ARMS: at the chest bone the front silhouette
    // is shoulder-to-shoulder across two hanging arms, so `w_chest` is an arm span and the
    // "pinch" is the arms tapering toward the hands. `TRUNK` drops every triangle whose dominant
    // bone is not one of the three trunk bones, and every rigid piece not socketed to one, so the
    // number is about the trunk and only the trunk. Both are reported: the figure column is what a
    // viewer's eye integrates, the trunk column is what the four rounds of judgement are about.
    const TRUNK = /(@|\/)(pelvis|spine_00|spine_02)$/;
    const keep = [], trunk = [];
    for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
      const label = parts[tri] || '';
      if (!/actor-body|actor-equipment|actor-family-form/.test(label)) continue;
      for (let k = 0; k < 9; k++) keep.push(tris[t + k]);
      if (TRUNK.test(label)) for (let k = 0; k < 9; k++) trunk.push(tris[t + k]);
    }
    if (!keep.length) continue;
    const shape = torsoShape(Float32Array.from(keep), land, opts.res);
    const tShape = trunk.length ? torsoShape(Float32Array.from(trunk), land, opts.res) : null;
    if (tShape) {
      shape.trunk_waist_pinch = tShape.waist_pinch;
      shape.trunk_hip_flare = tShape.hip_flare;
      shape.trunk_solidity = tShape.torso_solidity;
      shape.trunk_w_hip_m = tShape.w_hip_m;
      shape.trunk_w_waist_m = tShape.w_waist_m;
      shape.trunk_w_chest_m = tShape.w_chest_m;
      shape.trunk_depth_ratio = tShape.chest_depth_ratio;
    }
    let tri = 0;
    group.traverse((o) => { if (o.isMesh && o.visible && o.geometry && !/contact-shadow|action-silhouette/.test(o.name || '')) tri += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
    rows.push({ subject: person.eid, race: person.race, family, triangles: tri, ...shape });
  }

  console.log('trunk shape — TRUNK columns exclude the arms; pinch <= 0 means the trunk is a cone or a column: THERE IS NO WAIST');
  console.log('subject                 family     tris   | figure: pinch   flare  | TRUNK: hip     waist   chest   pinch    flare   depth/w  solidity');
  for (const r of rows) {
    console.log(`${String(r.subject).padEnd(22)}  ${String(r.family).padEnd(9)}  ${String(r.triangles).padStart(5)}  | ${String(r.waist_pinch).padStart(7)}  ${String(r.hip_flare).padStart(6)}  | ${String(r.trunk_w_hip_m).padStart(6)}  ${String(r.trunk_w_waist_m).padStart(6)}  ${String(r.trunk_w_chest_m).padStart(6)}  ${String(r.trunk_waist_pinch).padStart(7)}  ${String(r.trunk_hip_flare).padStart(6)}  ${String(r.trunk_depth_ratio).padStart(7)}  ${String(r.trunk_solidity).padStart(8)}`);
  }
  const med = (k) => { const a = rows.map((r) => r[k]).filter((v) => v !== null && v !== undefined).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length / 2)].toFixed(4) : null; };
  const medians = {};
  for (const k of ['waist_pinch', 'hip_flare', 'chest_depth_ratio', 'torso_solidity',
    'trunk_waist_pinch', 'trunk_hip_flare', 'trunk_depth_ratio', 'trunk_solidity', 'triangles']) medians[k] = med(k);
  console.log(`\nmedian over ${rows.length} figures — FIGURE waist_pinch=${medians.waist_pinch} hip_flare=${medians.hip_flare}`);
  console.log(`                            TRUNK  waist_pinch=${medians.trunk_waist_pinch} hip_flare=${medians.trunk_hip_flare} depth/w=${medians.trunk_depth_ratio} solidity=${medians.trunk_solidity}  triangles=${medians.triangles}`);
  if (opts.json) writeFileSync(opts.json, `${JSON.stringify({ tool: 'f10-r8-torso', pose: `${opts.pose}@${opts.phase}`, res: opts.res, note: 'shape numbers only — no colour, material or light claim may be made from this tool', rows, median: medians }, null, 2)}\n`);
}
