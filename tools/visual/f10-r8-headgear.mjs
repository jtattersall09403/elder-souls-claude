#!/usr/bin/env node
/**
 * f10-r8-headgear.mjs — can you see this person's eyes with their hat on.
 *
 * WHY. `orchestration/status/W1-F10-r7-appearance.json` §4 is titled *"a defect NOBODY has reported
 * and it is the first thing you see"*: **a wide-brim hat is drawn as a flat hexagonal plate sitting
 * at eyebrow height, projecting forward like a visor… on a saxhleel head it covers the eye sockets
 * entirely**, in BOTH arms of that capture, on every head that wears one. It undoes round 7's eye
 * work, which is the one change that round's own judgement called its clearest win.
 *
 * That claim was made by LOOKING at frames, which is the right way to find it and the wrong way to
 * know whether it is fixed. This is the number.
 *
 * WHAT IT MEASURES.
 *   head_w_m / hat_w_m / hat_over_head   the headgear's width against the head's own skinned width.
 *                                        A hat is wider than a head; 1.9x is a plank.
 *   hat_y_lo_m vs eye_y_hi_m             does the headgear's lower edge come below the top of the
 *                                        eye. If it does, it is drawn THROUGH the eye and no
 *                                        camera angle recovers it.
 *   eye_visible_frac                     the honest one. Rasterise the head from a fan of bearings
 *                                        and elevations with the eye/pupil geometry tagged, once
 *                                        with the headgear present and once with it hidden, and
 *                                        report what fraction of the eye pixels that ARE drawn
 *                                        without the hat survive with it. 1.00 = the hat is not in
 *                                        the way. 0.00 = the eyes are gone.
 *
 * WHICH INPUT DOES EVERY ARM FABRICATE? (HAZARDS §0.)
 *   1. THE GEOMETRY — the shipped `actor.js`, built through `makeRiggedActor` + `poseFromRig`, with
 *      the equipment-set selection driven the way `poseFromRig` drives it (`equipLoadPct`).
 *   2. THE CAMERA — orthographic, framed on the head only, over a fan that includes elevations
 *      ABOVE eye level. That is deliberate: the r7 frames that show the defect are looking slightly
 *      down at a standing NPC, which is where a forward-projecting brim occludes most.
 *   3. THE "WITHOUT" ARM — the SAME build with `mesh.visible = false` on the head-slot piece only.
 *      Nothing else differs, so a difference is the hat.
 *
 * MAKE IT FAIL ON PURPOSE:
 *   node tools/visual/f10-r8-headgear.mjs --self-test
 * three synthetic arms — no hat, a hat sitting on the crown, and the same hat lowered onto the eyes
 * — and `eye_visible_frac` is REQUIRED to separate them.
 *
 * Usage:
 *   node tools/visual/f10-r8-headgear.mjs
 *   node tools/visual/f10-r8-headgear.mjs --json=out.json
 *   node tools/visual/f10-r8-headgear.mjs --self-test
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

const opts = { res: 384, json: null, selfTest: false };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'res') opts.res = Number(v);
  else if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
}

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const { rasterise } = await import(pathToFileURL(join(ROOT, 'tools/visual/actor-orbit-holes.mjs')).href);

/** The bearings the r7 frames were taken from: eight around, three elevations, the middle one
 *  slightly ABOVE the eye because that is a standing NPC seen by a standing player. */
const BEARINGS = [];
for (let b = 0; b < 8; b++) for (const el of [-8, 6, 18]) BEARINGS.push([b * 45, el]);

/**
 * PERSPECTIVE, AND NOT BY PREFERENCE — THE INHERITED RASTERISER CANNOT Z-SORT AN ORTHOGRAPHIC VIEW.
 *
 * `actor-orbit-holes.mjs`'s `rasterise` writes `pz[k] = cw`, the clip-space w, as its depth. For a
 * PERSPECTIVE projection that is the eye-space distance and the z-buffer is correct — which is what
 * that tool was written for. For an ORTHOGRAPHIC projection the w row of the matrix is (0,0,0,1),
 * so `cw === 1` for every vertex in the scene: the z-buffer is a constant, `owner` degenerates to
 * "whichever triangle was submitted last", and an occlusion question cannot be asked of it.
 *
 * The first cut of this tool used an orthographic camera (copied from `f10-silhouette.mjs`, which
 * is safe because it reads only `cov`) and its self-test correctly refused to pass: a hat lowered
 * onto the eyes scored 0.80 where it should have scored ~0. That is the instrument catching the
 * instrument, and it is why the arms are required to disagree.
 *
 * So: a perspective camera at conversation distance, which is also the framing the r7 photographs
 * that found this defect were taken at.
 */
function vp(centre, half, yawDeg, elevDeg) {
  const yaw = yawDeg * Math.PI / 180, el = elevDeg * Math.PI / 180;
  const d = 1.4;                                   // conversation distance, metres
  const eye = new THREE.Vector3(
    centre.x + Math.sin(yaw) * Math.cos(el) * d,
    centre.y + Math.sin(el) * d,
    centre.z + Math.cos(yaw) * Math.cos(el) * d);
  const fov = 2 * Math.atan((half * 1.15) / d) * 180 / Math.PI;
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const proj = new THREE.Matrix4().makePerspective(-1, 1, 1, -1, 1, 200, THREE.WebGLCoordinateSystem);
  // makePerspective takes frustum planes at the near distance; derive them from the fov instead so
  // the framing is stated as an angle and cannot drift with `half`.
  const t = Math.tan(fov * Math.PI / 360) * 0.05;
  proj.makePerspective(-t, t, t, -t, 0.05, 200, THREE.WebGLCoordinateSystem);
  return new THREE.Matrix4().multiplyMatrices(proj, inv);
}

/**
 * `tagged` is a flat triangle array with a parallel `tag` array of 'eye' | 'hat' | 'other'.
 * Returns the fraction of eye pixels drawn in the no-hat arm that survive in the with-hat arm.
 */
export function eyeVisibility(tris, tag, centre, half, res = 384) {
  const parts = tag;
  // the "without" arm: drop the hat triangles entirely
  const bare = [], bareTag = [];
  for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
    if (tag[tri] === 'hat') continue;
    for (let k = 0; k < 9; k++) bare.push(tris[t + k]);
    bareTag.push(tag[tri]);
  }
  const bareF32 = Float32Array.from(bare);
  let withHat = 0, without = 0, lost = 0, seen = 0, worst = 1;
  const per = [];
  for (const [yaw, el] of BEARINGS) {
    const m = vp(centre, half, yaw, el).elements;
    const a = rasterise(bareF32, bareTag, { m, half: res / 2 }, res);
    const b = rasterise(tris, parts, { m, half: res / 2 }, res);
    let w = 0, o = 0;
    for (let i = 0; i < a.owner.length; i++) {
      if (a.owner[i] < 0 || bareTag[a.owner[i]] !== 'eye') continue;
      o++;
      if (b.owner[i] >= 0 && parts[b.owner[i]] === 'eye') w++;
    }
    without += o; withHat += w;
    // A BEARING WHERE THE EYE IS BARELY DRAWN AT ALL CANNOT VOTE. At yaw 180 the eye is behind
    // the head in both arms, and averaging that in dilutes exactly the bearings the defect lives
    // at. The floor is 40 px, which on a 384 px head crop is a tenth of a fully-facing eye pair.
    if (o >= 40) { seen++; const f = w / o; if (f < worst) worst = f; if (f < 0.5) lost++; per.push({ yaw, el, frac: +f.toFixed(3) }); }
  }
  return {
    eye_px_without_hat: without, eye_px_with_hat: withHat,
    eye_visible_frac: without ? +(withHat / without).toFixed(4) : null,
    bearings_scored: seen, bearings_eye_lost: lost,
    eye_visible_worst_bearing: seen ? +worst.toFixed(4) : null,
    per_bearing: per,
  };
}

// ---------------------------------------------------------------------------------------
if (IS_CLI && opts.selfTest) {
  const push = (out, tag, label, verts, faces) => {
    for (const f of faces) { for (const i of f) out.push(verts[i][0], verts[i][1], verts[i][2]); tag.push(label); }
  };
  const boxOf = (cx, cy, cz, hx, hy, hz) => [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]].map((p) => [p[0] + cx, p[1] + cy, p[2] + cz]);
  const F = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]];
  const make = (hatY) => {
    const tris = [], tag = [];
    push(tris, tag, 'other', boxOf(0, 1.65, 0, .09, .11, .09), F);           // the head
    for (const s of [-1, 1]) push(tris, tag, 'eye', boxOf(s * .042, 1.67, .092, .022, .014, .006), F);  // the eyes, proud
    if (hatY !== null) push(tris, tag, 'hat', boxOf(0, hatY, 0, .17, .026, .17), F);
    return { tris: Float32Array.from(tris), tag };
  };
  const centre = new THREE.Vector3(0, 1.66, 0);
  const arms = { no_hat: make(null), on_the_crown: make(1.785), on_the_eyes: make(1.672) };
  const got = {};
  for (const [name, a] of Object.entries(arms)) {
    got[name] = eyeVisibility(a.tris, a.tag, centre, 0.20, 256);
    const r = got[name];
    console.log(`self-test  ${name.padEnd(14)} eye_visible_frac=${r.eye_visible_frac}  worst_bearing=${r.eye_visible_worst_bearing}  bearings_lost=${r.bearings_eye_lost}/${r.bearings_scored}`);
  }
  // THE AGGREGATE FRACTION IS THE WRONG ARM TO ASSERT ON, and the first cut of this self-test
  // asserted on it and failed. A brim occludes from ABOVE; average it over a fan that includes
  // bearings from below and behind and a hat that erases the eye at every camera a player
  // actually uses still scores 0.91. WORST BEARING and BEARINGS LOST are the numbers that carry
  // the claim, and they are what this asserts.
  const ok = got.no_hat.eye_visible_worst_bearing === 1 && got.no_hat.bearings_eye_lost === 0
    && got.on_the_crown.bearings_eye_lost === 0
    && got.on_the_eyes.bearings_eye_lost >= 2
    && got.on_the_eyes.eye_visible_worst_bearing < 0.25;
  console.log(`self-test  the three arms ${ok ? 'DISAGREE — a hat on the crown loses the eye at no bearing and the same hat lowered onto it loses it at several, which is the only difference between the two' : 'DO NOT DISAGREE AS REQUIRED'}`);
  if (!ok) { console.error('self-test FAILED.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
if (IS_CLI) {
  const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
    'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
  const mats = {};
  for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }
  const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
  const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
  const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
  const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
  const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
  const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));

  // `poseFromRig` picks the set from equip load: <30 reed, <70 chitin, else xanmeer.
  const SETS = [['reed', 20], ['chitin', 50], ['xanmeer', 90]];
  const rows = [];
  for (const family of ['saxhleel', 'humanoid']) {
    for (const [set, load] of SETS) {
      const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
      group.name = family === 'saxhleel' ? 'player' : 'npc:probe';
      const rig = new Rig(skel, hitgeo);
      rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
      addPose(rig, clips.archetypes.idle || Object.values(clips.archetypes)[0], 0, 1);
      rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
      actorMod.poseFromRig(group, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: load,
        move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } });
      group.updateMatrixWorld(true);
      const built = group.userData.actor.built;
      const hi = built.index.get('head');

      // head skinned extent, eyes, and the visible head-slot equipment
      const headBox = new THREE.Box3(), eyeBox = new THREE.Box3(), hatBox = new THREE.Box3();
      const v = new THREE.Vector3();
      for (const m of built.meshes) {
        const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
        for (let i = 0; i < pos.count; i++) {
          let best = -1, bw = -1;
          for (const ch of ['X', 'Y', 'Z', 'W']) { const w = sw[`get${ch}`](i); if (w > bw) { bw = w; best = si[`get${ch}`](i); } }
          if (best !== hi) continue;
          headBox.expandByPoint(v.fromBufferAttribute(pos, i));
        }
      }
      // `precise`, and it matters: `Box3.expandByObject` without it transforms the GEOMETRY's own
      // axis-aligned box, so a rotated torus is measured as its rotated bounding CUBE. That
      // over-reported the band's width by 54% on the first run of this tool. `true` walks vertices.
      for (const p of built.presentation || []) if (/eye-|pupil-/.test(p.mesh.name) && p.mesh.visible) eyeBox.expandByObject(p.mesh, true);
      for (const e of built.equipment) if (e.slot === 'head' && e.mesh.visible) hatBox.expandByObject(e.mesh, true);

      // the tagged triangle soup for the occlusion arm
      const tris = [], tag = [];
      const tmp = new THREE.Vector3();
      const emit = (mesh, label, skinned) => {
        const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
        const n = idx ? idx.count : pos.count;
        const world = [];
        if (skinned) {
          const bm = mesh.skeleton.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[i]));
          const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, acc = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i); acc.set(0, 0, 0); let ws = 0;
            for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const b = si.getComponent(i, k); if (!bm[b]) continue; tmp.copy(v).applyMatrix4(bm[b]).multiplyScalar(w); acc.add(tmp); ws += w; }
            if (!ws) acc.copy(v);
            world.push(acc.x, acc.y, acc.z);
          }
        } else {
          for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); world.push(v.x, v.y, v.z); }
        }
        for (let i = 0; i < n; i += 3) {
          const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
          tris.push(world[a * 3], world[a * 3 + 1], world[a * 3 + 2], world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
          tag.push(label);
        }
      };
      for (const m of built.meshes) emit(m, 'other', true);
      for (const p of built.presentation || []) if (p.mesh.visible) emit(p.mesh, /eye-|pupil-/.test(p.mesh.name) ? 'eye' : 'other', false);
      for (const e of built.equipment) if (e.mesh.visible) emit(e.mesh, e.slot === 'head' ? 'hat' : 'other', false);

      const centre = eyeBox.isEmpty() ? headBox.getCenter(new THREE.Vector3()) : headBox.getCenter(new THREE.Vector3());
      const half = Math.max(headBox.getSize(new THREE.Vector3()).length() * 0.45, 0.14);
      const occ = eyeVisibility(Float32Array.from(tris), tag, centre, half, opts.res);

      const headW = headBox.max.x - headBox.min.x, hatW = hatBox.isEmpty() ? null : hatBox.max.x - hatBox.min.x;
      rows.push({
        family, set,
        head_w_m: +headW.toFixed(4),
        hat_w_m: hatW === null ? null : +hatW.toFixed(4),
        hat_over_head: hatW === null ? null : +(hatW / headW).toFixed(3),
        hat_y_lo_m: hatBox.isEmpty() ? null : +hatBox.min.y.toFixed(4),
        eye_y_hi_m: eyeBox.isEmpty() ? null : +eyeBox.max.y.toFixed(4),
        hat_below_eye_top_mm: (hatBox.isEmpty() || eyeBox.isEmpty()) ? null : +((eyeBox.max.y - hatBox.min.y) * 1000).toFixed(1),
        ...occ,
      });
    }
  }

  console.log('headgear — hat_over_head > 1.6 is a plank; hat_below_eye_top_mm > 0 means it is drawn THROUGH the eye');
  console.log('family     set       head_w  hat_w   ratio   hat_y_lo  eye_y_hi  below_eye_mm  eye_vis   worst_br  lost');
  for (const r of rows) {
    console.log(`${r.family.padEnd(9)}  ${r.set.padEnd(8)}  ${String(r.head_w_m).padStart(6)}  ${String(r.hat_w_m).padStart(6)}  ${String(r.hat_over_head).padStart(6)}  ${String(r.hat_y_lo_m).padStart(8)}  ${String(r.eye_y_hi_m).padStart(8)}  ${String(r.hat_below_eye_top_mm).padStart(12)}  ${String(r.eye_visible_frac).padStart(9)}  ${String(r.eye_visible_worst_bearing).padStart(9)}  ${String(r.bearings_eye_lost + '/' + r.bearings_scored).padStart(6)}`);
  }
  const fr = rows.map((r) => r.eye_visible_worst_bearing).filter((x) => x !== null);
  console.log(`\nworst-bearing eye visibility over ${rows.length} family x set combinations: min=${Math.min(...fr)}   bearings lost total=${rows.reduce((a, r) => a + r.bearings_eye_lost, 0)}   max hat_over_head=${Math.max(...rows.map((r) => r.hat_over_head))}   max below_eye_top=${Math.max(...rows.map((r) => r.hat_below_eye_top_mm))} mm`);
  if (opts.json) writeFileSync(opts.json, `${JSON.stringify({ tool: 'f10-r8-headgear', bearings: BEARINGS.length, res: opts.res, rows }, null, 2)}\n`);
}
