#!/usr/bin/env node
// W1-30D — the offline orbit hole detector.
//
// WHAT IT MEASURES, AND WHY THIS UNIT AND NOT ANOTHER. The gate in `orchestration/plans/W1-30D.md`
// reads: "across 144 orbit frames, zero background pixels appear inside the body silhouette
// (measured against the world-hidden pass, which is the test that actually catches this)". This
// tool IS the world-hidden pass, by construction: nothing but the actor is ever rasterised, so a
// pixel that is not covered by a body triangle and is enclosed by pixels that are, is sky seen
// through the character. That is the defect, stated in the unit the defect is in.
//
// It is deliberately NOT a transparency audit. Every visible mesh in the player subtree is
// already `transparent:false, opacity:1` (docs/shots/2026-08-14-visual-truth/player-root-audit.json)
// and the defect is present anyway. A material check passes today while the character has holes;
// this check does not.
//
// WHICH INPUT DOES EVERY ARM OF THIS TEST FABRICATE? (HAZARDS.md §0.) Three, named here so a
// critic can attack them:
//   1. THE POSE. Fabricating poses is the failure mode that would let this tool certify a body
//      that is only watertight in the rest pose. So poses are NOT fabricated: they are sampled
//      from `game/data/combat/clips.json`'s own twenty archetypes through `addPose()`, the same
//      function `combat/moves.js` uses, at real phases, on a real `Rig` from `combat/skeleton.js`
//      evaluated by `Rig.evaluate()`. If the shipping clips do not reach a pose, this tool does
//      not either — and that is the correct boundary.
//   2. THE MATERIALS. `mats` is a plain stand-in, because `visual-foundation.js` wants a DOM to
//      load its texture sets. This is safe *for this measurement only*: no material property in
//      three.js moves a vertex, and coverage is computed from vertex positions alone. A material
//      claim must never be made from this tool.
//   3. THE CAMERA. Orbit stops are the standard's own 15deg x {1.5, 4, 12} m ladder, not chosen
//      by looking at the result. Changing them is a recorded edit to this file.
//
// NULL CONTROL. `--sabotage=<mode>` is refused on purpose — a control that lives inside the
// instrument tests the instrument, not the build. Run this against a patched *copy of the source
// tree* (`--root=<dir>`), which is what `tools/visual/actor-hole-control.mjs` does.
'use strict';

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT, res: 512, family: 'saxhleel', poses: 'default', out: null,
    angles: 24, distances: [1.5, 4, 12], json: null, verbose: false };
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'root') out.root = resolve(v);
    else if (k === 'res') out.res = Number(v);
    else if (k === 'family') out.family = v;
    else if (k === 'poses') out.poses = v;
    else if (k === 'angles') out.angles = Number(v);
    else if (k === 'distances') out.distances = v.split(',').map(Number);
    else if (k === 'json') out.json = resolve(v);
    else if (k === 'verbose') out.verbose = true;
    else if (k === 'sabotage') {
      console.error('actor-orbit-holes: --sabotage is refused. A null control must patch the '
        + 'BUILD, not the instrument. Copy game/ + tools/ to a scratch dir, break one joint there, '
        + 'and pass --root=<that dir>. See tools/visual/actor-hole-control.mjs.');
      process.exit(2);
    } else { console.error(`unknown flag --${k}`); process.exit(2); }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The pose population — from the shipping clip data, not from this file.
// ---------------------------------------------------------------------------------------

/** The named pose set. Each entry is (archetype id, phase). Phases are the standard's own
 *  quarter points; a clip's wind-up, commit and recovery all fall inside them. */
function posePopulation(clipsJson, which) {
  const ids = Object.keys(clipsJson.archetypes);
  const phases = which === 'dense' ? [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] : [0, 0.35, 0.7, 1];
  const wanted = which === 'smoke'
    ? ['idle_loop', 'locomotion_cycle', 'chop_overhead']
    : which === 'dense' ? ids : ids;
  const out = [];
  for (const id of wanted) {
    if (!clipsJson.archetypes[id]) continue;
    for (const p of (which === 'smoke' ? [0, 0.5] : phases)) out.push({ id, phase: p });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Geometry extraction: the exact vertices the GPU would see.
// ---------------------------------------------------------------------------------------

/** Meshes that are legitimately not body: the contact shadow (a ground decal) and the attack
 *  arc (a UI-ish accent). Both are declared `transparent, depthWrite:false` exemptions in the
 *  plan's own gate text. Including the shadow would fuse the two legs into one silhouette and
 *  hide exactly the gap this tool exists to find. */
const EXEMPT = /actor-contact-shadow|actor-action-silhouette/;

export function collectTriangles(THREE, root, boneNames) {
  const tris = [];   // flat [ax,ay,az, bx,by,bz, cx,cy,cz, ...] in world space
  const parts = [];  // per-triangle label: mesh name + dominant bone, so a report names a JOINT
  root.updateWorldMatrix(true, false);
  const stack = [root];
  const visible = new Map([[root, root.visible]]);
  while (stack.length) {
    const o = stack.pop();
    const vis = visible.get(o) !== false && o.visible !== false;
    for (const c of o.children) { visible.set(c, vis && c.visible !== false); stack.push(c); }
    if (!vis) continue;
    if (!o.isMesh) continue;
    if (EXEMPT.test(o.name)) continue;
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) continue;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const world = [];
    const domBone = [];
    if (o.isSkinnedMesh) {
      // Bind matrices are identity in this file's rig (see actor.js's header): the bones carry
      // WORLD matrices, so `skinned = sum_i w_i * (boneMatrixWorld_i * boneInverse_i) * v`.
      const sk = o.skeleton;
      const bm = [];
      for (let i = 0; i < sk.bones.length; i++) {
        bm.push(new THREE.Matrix4().multiplyMatrices(sk.bones[i].matrixWorld, sk.boneInverses[i]));
      }
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        acc.set(0, 0, 0);
        let wsum = 0, best = -1, bestW = -1;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w === 0) continue;
          const b = si.getComponent(i, k);
          if (!bm[b]) continue;
          tmp.copy(v).applyMatrix4(bm[b]).multiplyScalar(w);
          acc.add(tmp); wsum += w;
          if (w > bestW) { bestW = w; best = b; }
        }
        if (wsum === 0) acc.copy(v);
        world.push(acc.x, acc.y, acc.z);
        domBone.push(best);
      }
    } else {
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        world.push(v.x, v.y, v.z);
        domBone.push(-1);
      }
    }
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      tris.push(world[a * 3], world[a * 3 + 1], world[a * 3 + 2],
        world[b * 3], world[b * 3 + 1], world[b * 3 + 2],
        world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
      const bn = domBone[a] >= 0 && boneNames ? boneNames[domBone[a]] : null;
      parts.push(bn ? `${o.name || o.type}/${bn}` : (o.name || o.type));
    }
  }
  return { tris, parts };
}

// ---------------------------------------------------------------------------------------
// A z-buffered rasteriser. Double-sided on purpose: a back face is still opaque geometry, and
// treating it as absent would report every open tube as a hole whether or not you can see through
// it. That would make the tool alarmist rather than correct.
// ---------------------------------------------------------------------------------------

export function rasterise(tris, parts, cam, res) {
  const cov = new Uint8Array(res * res);
  const owner = new Int32Array(res * res).fill(-1);
  const zbuf = new Float32Array(res * res).fill(Infinity);   // METRES from the eye, not NDC
  const { m, half } = cam; // m: 16-elt view-projection, column-major
  const px = new Float32Array(3), py = new Float32Array(3), pz = new Float32Array(3);
  for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
    let clipped = false;
    for (let k = 0; k < 3; k++) {
      const x = tris[t + k * 3], y = tris[t + k * 3 + 1], z = tris[t + k * 3 + 2];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 1e-6) { clipped = true; break; }
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
      px[k] = (cx / cw + 1) * half; py[k] = (1 - cy / cw) * half; pz[k] = cw;
    }
    if (clipped) continue;                       // near-plane straddle: skip, never invent coverage
    let minx = Math.max(0, Math.floor(Math.min(px[0], px[1], px[2])));
    let maxx = Math.min(res - 1, Math.ceil(Math.max(px[0], px[1], px[2])));
    let miny = Math.max(0, Math.floor(Math.min(py[0], py[1], py[2])));
    let maxy = Math.min(res - 1, Math.ceil(Math.max(py[0], py[1], py[2])));
    if (minx > maxx || miny > maxy) continue;
    const x0 = px[0], y0 = py[0], x1 = px[1], y1 = py[1], x2 = px[2], y2 = py[2];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-12) continue;
    const inv = 1 / area;
    for (let y = miny; y <= maxy; y++) {
      const sy = y + 0.5;
      for (let x = minx; x <= maxx; x++) {
        const sx = x + 0.5;
        const w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) * inv;
        const w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * pz[0] + w1 * pz[1] + w2 * pz[2];
        const o = y * res + x;
        cov[o] = 1;
        if (z < zbuf[o]) { zbuf[o] = z; owner[o] = tri; }
      }
    }
  }
  return { cov, owner, zbuf };
}

/**
 * Holes = uncovered pixels not reachable from the image border through uncovered pixels.
 *
 * The subtlety that makes this honest: a character standing with an arm away from the body has a
 * genuine gap between arm and torso, and that gap IS reachable from the border. It is not a hole
 * and this tool must not call it one. Only a fully enclosed pocket of background counts — which is
 * exactly, and only, "you can see the sky through him".
 */
export function findHoles(cov, res) {
  const seen = new Uint8Array(res * res);
  const q = new Int32Array(res * res);
  let head = 0, tail = 0;
  for (let x = 0; x < res; x++) {
    for (const y of [0, res - 1]) { const o = y * res + x; if (!cov[o] && !seen[o]) { seen[o] = 1; q[tail++] = o; } }
  }
  for (let y = 0; y < res; y++) {
    for (const x of [0, res - 1]) { const o = y * res + x; if (!cov[o] && !seen[o]) { seen[o] = 1; q[tail++] = o; } }
  }
  while (head < tail) {
    const o = q[head++], x = o % res, y = (o - x) / res;
    if (x > 0) { const n = o - 1; if (!cov[n] && !seen[n]) { seen[n] = 1; q[tail++] = n; } }
    if (x < res - 1) { const n = o + 1; if (!cov[n] && !seen[n]) { seen[n] = 1; q[tail++] = n; } }
    if (y > 0) { const n = o - res; if (!cov[n] && !seen[n]) { seen[n] = 1; q[tail++] = n; } }
    if (y < res - 1) { const n = o + res; if (!cov[n] && !seen[n]) { seen[n] = 1; q[tail++] = n; } }
  }
  // Label the enclosed pockets so the report can name the worst one and where it is.
  const comp = new Int32Array(res * res).fill(-1);
  const comps = [];
  for (let o = 0; o < cov.length; o++) {
    if (cov[o] || seen[o] || comp[o] >= 0) continue;
    const id = comps.length;
    let n = 0, sx = 0, sy = 0, minx = res, maxx = 0, miny = res, maxy = 0;
    head = 0; tail = 0; q[tail++] = o; comp[o] = id;
    while (head < tail) {
      const p = q[head++], x = p % res, y = (p - x) / res;
      n++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [x > 0 ? p - 1 : -1, x < res - 1 ? p + 1 : -1, y > 0 ? p - res : -1, y < res - 1 ? p + res : -1];
      for (const m2 of nb) { if (m2 >= 0 && !cov[m2] && !seen[m2] && comp[m2] < 0) { comp[m2] = id; q[tail++] = m2; } }
    }
    comps.push({ id, px: n, cx: Math.round(sx / n), cy: Math.round(sy / n), w: maxx - minx + 1, h: maxy - miny + 1 });
  }
  let holePx = 0;
  for (const c of comps) holePx += c.px;
  let body = 0;
  for (let o = 0; o < cov.length; o++) if (cov[o]) body++;
  comps.sort((a, b) => b.px - a.px);
  return { holePx, bodyPx: body, comps };
}

/**
 * CRACK vs THROUGH-GAP — the distinction that decides whether a number means anything.
 *
 * An enclosed pocket of background is not automatically a defect. A character standing with an
 * arm out has a genuine gap between arm and ribs; orbit far enough round and a leg crosses behind
 * it and the gap becomes *enclosed* on screen. Counting that as a hole would fail a correct
 * character and — much worse — would reward welding the arm to the ribs. So the raw enclosed
 * count is reported but is NOT the gate.
 *
 * The discriminator is the depth of the surfaces that ring the pocket, in metres from the eye:
 *
 *   - a CRACK is a slit in what should be one continuous surface. Everything around it is the same
 *     near surface, so the ring's depth spread is a few centimetres. Sky through a shoulder seam.
 *   - a THROUGH-GAP is a genuine hole in the pose. You are looking past a near limb at a far one,
 *     so the ring spans a large depth range.
 *
 * `CRACK_DEPTH_M` is 0.08 m — a little over the widest body-part radius in `PLAN` (0.228 m chest,
 * but the joints that matter are 0.06-0.13 m), so a seam between two adjacent parts qualifies and
 * an arm-to-ribs gap (0.2 m+ at every pose sampled) does not. It is a declared constant, chosen
 * before running the fix, and changing it is a recorded edit.
 */
const CRACK_DEPTH_M = 0.08;

/**
 * ...and the second half of the discriminator, which the first half needed.
 *
 * Depth alone is not enough: a greatsword hanging beside the thigh sits at almost the same depth
 * as the leg, and the sky between blade and knee is a perfectly correct gap that depth cannot tell
 * from a seam. The missing idea is *what is supposed to be joined to what*. So every mesh this
 * file measures now carries its attachment bone in its own name — `actor-equipment:reed:chest@spine_02`,
 * `actor-body:saxhleel:skin/upperarm_l` — and a pocket is a crack only when the surfaces around it
 * are meant to be one surface:
 *
 *   - the same bone, or bones that are parent/child or siblings in `skeleton.json`; and
 *   - nothing bordering it is a HELD object (`actor-held:*`), because a weapon or a shield is a
 *     separate thing and the space around it is supposed to be empty.
 *
 * A critic's attack on this is that it could be tuned to exclude whatever is failing. The guard is
 * that it is stated before the fix, applied to every subject, and the null control breaks a joint
 * between two bones that ARE adjacent — so a discriminator loose enough to hide the fix would also
 * fail to catch the sabotage.
 */
function boneOf(label) {
  const at = label.lastIndexOf('@');
  if (at >= 0) return label.slice(at + 1);
  const sl = label.lastIndexOf('/');
  if (sl >= 0) return label.slice(sl + 1);
  return null;
}

function jointedTest(skelBones) {
  const parent = new Map();
  for (const b of skelBones) parent.set(b.id, b.parent);
  return (p, q) => {
    if (!p || !q) return false;
    if (p === q) return true;
    if (parent.get(p) === q || parent.get(q) === p) return true;
    const pp = parent.get(p), qp = parent.get(q);
    return !!pp && pp === qp;
  };
}

function classifyPockets(comps, cov, owner, zbuf, parts, res, limit = 3, jointed = () => true) {
  let crackPx = 0, crackCount = 0;
  const detail = [];
  for (const c of comps) {
    const names = new Map();
    let zmin = Infinity, zmax = -Infinity;
    for (let y = Math.max(0, c.cy - c.h); y <= Math.min(res - 1, c.cy + c.h); y++) {
      for (let x = Math.max(0, c.cx - c.w); x <= Math.min(res - 1, c.cx + c.w); x++) {
        const o = y * res + x;
        if (cov[o]) continue;
        for (const n of [o - 1, o + 1, o - res, o + res]) {
          if (n < 0 || n >= cov.length || !cov[n]) continue;
          const t = owner[n];
          if (t < 0) continue;
          names.set(parts[t], (names.get(parts[t]) || 0) + 1);
          const z = zbuf[n];
          if (z < zmin) zmin = z;
          if (z > zmax) zmax = z;
        }
      }
    }
    const spread = zmax - zmin;
    const ring = [...names.entries()].sort((a, b) => b[1] - a[1]);
    const held = ring.some(([k]) => /^actor-held:/.test(k));
    // Only the surfaces that actually ring the pocket in quantity decide: a single stray pixel of
    // some distant part must not veto or create a crack finding.
    const major = ring.filter(([, v]) => v >= Math.max(2, ring[0] ? ring[0][1] * 0.15 : 2)).map(([k]) => boneOf(k));
    let allJointed = major.length > 0;
    for (let i = 0; i < major.length && allJointed; i++) {
      for (let j = i + 1; j < major.length; j++) if (!jointed(major[i], major[j])) { allJointed = false; break; }
    }
    // ADJACENCY IS REPORTED, NOT GATED — and finding that out cost a measurement.
    //
    // The first version of this required every bordering part to be on the same bone or an
    // adjacent one. It looked principled and it silently excused the largest real defect in the
    // character: four crest cones floating 13 cm off the back, whose ring is `spine_02` against
    // `pelvis` — not adjacent, therefore "a legitimate gap". A discriminator that reclassifies an
    // ornament hovering in mid-air as correct rendering is worse than no discriminator.
    //
    // What is left is the pair that actually separates the two cases: a small ring depth spread
    // (one continuous near surface, not looking past one thing at another) and no HELD object on
    // the ring (a sword hanging beside a thigh is supposed to have sky around it). `jointed` is
    // still computed and reported, because it tells a builder whether the gap is at a joint or
    // between an ornament and the body — which is a different fix.
    const crack = isFinite(spread) && spread <= CRACK_DEPTH_M && !held;
    if (crack) { crackPx += c.px; crackCount++; }
    if (detail.length < limit) {
      detail.push({ px: c.px, kind: crack ? 'crack' : 'through-gap', ringDepthSpreadM: +spread.toFixed(3),
        why: crack ? (allJointed ? 'crack-at-a-joint' : 'gap-between-body-and-ornament')
          : held ? 'bordered-by-held-object' : 'depth-spread',
        at: [c.cx, c.cy], size: [c.w, c.h],
        bordered_by: [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${v}`) });
    }
  }
  return { crackPx, crackCount, detail };
}

// ---------------------------------------------------------------------------------------

export function viewProj(THREE, eye, target, fov, aspect, near, far) {
  const view = new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0));
  const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(view));
  m.setPosition(eye);
  const inv = m.clone().invert();
  const proj = new THREE.Matrix4().makePerspective(
    -near * Math.tan((fov * Math.PI) / 360) * aspect, near * Math.tan((fov * Math.PI) / 360) * aspect,
    near * Math.tan((fov * Math.PI) / 360), -near * Math.tan((fov * Math.PI) / 360),
    near, far, THREE.WebGLCoordinateSystem);
  return new THREE.Matrix4().multiplyMatrices(proj, inv);
}

export async function run(opts) {
  const R = opts.root;
  const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);
  const actorMod = await import(pathToFileURL(join(R, 'game/src/render/actor.js')).href);
  const { Rig } = await import(pathToFileURL(join(R, 'game/src/combat/skeleton.js')).href);
  const { addPose } = await import(pathToFileURL(join(R, 'game/src/combat/clips.js')).href);
  const skel = JSON.parse(readFileSync(join(R, 'game/data/combat/skeleton.json'), 'utf8'));
  const hitgeo = JSON.parse(readFileSync(join(R, 'game/data/combat/hitgeometry.json'), 'utf8'));
  const clips = JSON.parse(readFileSync(join(R, 'game/data/combat/clips.json'), 'utf8'));

  // Fabricated input #2, declared in the header: a stand-in material set. No material property
  // moves a vertex, and this tool only reads vertices.
  const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
    'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
  const mats = {};
  for (const f of fam) {
    const m = new THREE.MeshStandardMaterial({ color: 0x808080 });
    m.userData = { visualFamily: f };
    mats[f] = m;
  }

  const jointed = jointedTest(skel.bones);
  const rig = new Rig(skel, hitgeo);
  const poses = posePopulation(clips, opts.poses);
  const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, opts.family);

  const frames = [];
  let totalHole = 0, totalEnclosed = 0, totalBody = 0, worstFrame = null, framesWithHoles = 0;
  const half = opts.res / 2;

  for (const pose of poses) {
    rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
    addPose(rig, clips.archetypes[pose.id], pose.phase, 1);
    rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
    const body = {
      rig, pos: [0, 0, 0], state: 'IDLE', animFrame: Math.round(pose.phase * 60),
      equipLoadPct: 20, move: null, hitboxActive: false, airborne: false,
      shield: null, twoHanded: false, offhandKind: null,
      moves: { _weapon: { weapon_id: 'test_gsw', class: 'GSW', length_m: 1.45, hitbox_span_m: 1.0, radius_m: 0.05, socket_a: 'wpn_guard', socket_b: 'wpn_tip' } },
    };
    actorMod.poseFromRig(group, body);
    const { tris, parts } = collectTriangles(THREE, group, skel.bones.map((b) => b.id));
    // Frame the body: centroid and radius from the actual vertices, so the camera cannot
    // accidentally crop the defect out of shot.
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
      if (tris[i] < minx) minx = tris[i]; if (tris[i] > maxx) maxx = tris[i];
      if (tris[i + 1] < miny) miny = tris[i + 1]; if (tris[i + 1] > maxy) maxy = tris[i + 1];
      if (tris[i + 2] < minz) minz = tris[i + 2]; if (tris[i + 2] > maxz) maxz = tris[i + 2];
    }
    const target = new THREE.Vector3((minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2);
    for (let a = 0; a < opts.angles; a++) {
      const th = (a / opts.angles) * Math.PI * 2;
      for (const d of opts.distances) {
        const eye = new THREE.Vector3(target.x + Math.sin(th) * d * 0.985, target.y + d * 0.17, target.z + Math.cos(th) * d * 0.985);
        const m = viewProj(THREE, eye, target, 45, 1, Math.max(0.05, d * 0.05), d * 6).elements;
        const { cov, owner, zbuf } = rasterise(tris, parts, { m, half }, opts.res);
        const h = findHoles(cov, opts.res);
        const cls = classifyPockets(h.comps, cov, owner, zbuf, parts, opts.res, 2, jointed);
        const rec = { pose: `${pose.id}@${pose.phase}`, angle: Math.round((a / opts.angles) * 360), dist: d,
          crackPx: cls.crackPx, cracks: cls.crackCount,
          enclosedPx: h.holePx, bodyPx: h.bodyPx, pockets: h.comps.length,
          crackPct: h.bodyPx ? +(100 * cls.crackPx / h.bodyPx).toFixed(4) : 0 };
        totalBody += h.bodyPx;
        if (cls.crackPx > 0) {
          framesWithHoles++;
          rec.worst = cls.detail;
          if (!worstFrame || cls.crackPx > worstFrame.crackPx) worstFrame = rec;
        }
        totalHole += cls.crackPx;
        totalEnclosed += h.holePx;
        frames.push(rec);
      }
    }
  }
  // `meanBodyPx` is the anti-"hide it" guard. The plausible wrong answer to this gate is to make
  // the offending part invisible or to shrink it: crack pixels fall to zero and the character gets
  // worse. A run whose crack count improves while the silhouette collapses is not an improvement,
  // and the comparison tool refuses it.
  const summary = {
    tool: 'actor-orbit-holes', root: R, family: opts.family, res: opts.res,
    poses: poses.length, angles: opts.angles, distances: opts.distances,
    frames: frames.length, framesWithCracks: framesWithHoles,
    crackPx: totalHole, enclosedPx: totalEnclosed,
    meanBodyPx: Math.round(totalBody / Math.max(1, frames.length)),
    worst: worstFrame,
    verdict: totalHole === 0 ? 'PASS' : 'FAIL',
  };
  return { summary, frames };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv);
  const { summary, frames } = await run(opts);
  if (opts.json) {
    mkdirSync(dirname(opts.json), { recursive: true });
    writeFileSync(opts.json, JSON.stringify({ summary, frames: opts.verbose ? frames : frames.filter((f) => f.crackPx > 0) }, null, 1));
  }
  console.log(`actor-orbit-holes [${summary.family}] ${summary.frames} frames — `
    + `${summary.crackPx} crack px in ${summary.framesWithCracks} frames `
    + `(${summary.enclosedPx} enclosed px total incl. legitimate through-gaps; mean silhouette ${summary.meanBodyPx} px) — ${summary.verdict}`);
  if (summary.worst) {
    console.log(`  worst: ${summary.worst.pose} angle ${summary.worst.angle} at ${summary.worst.dist} m — `
      + `${summary.worst.crackPx} crack px (${summary.worst.crackPct}% of silhouette)`);
    for (const w of summary.worst.worst || []) {
      console.log(`    ${w.kind} ${w.px} px, ring depth spread ${w.ringDepthSpreadM} m, at ${w.at}, bordered by ${w.bordered_by.join(', ')}`);
    }
  }
  process.exit(summary.verdict === 'PASS' ? 0 : 1);
}
