// The character and the weapon, drawn from the rig the fight already evaluates.
//
// THE DEFECT THIS FILE EXISTS TO CLOSE. Before it, `makeActor()` in scene.js welded a fixed
// group of primitives — including ONE 0.95 m box for all 87 weapons — and `Renderer.render()`
// wrote a position and a yaw onto it and nothing else. 1,133 authored clips existed and none
// of them reached a screen: three weapon classes 1.95 m, 2.85 m and 2.75 m long screenshotted
// byte-identical, and a full 60-frame attack moved 0.19% of the character box.
//
// THE RULE THIS FILE IS BUILT ON. `Rig.evaluate()` (combat/skeleton.js) already computes a
// world-space 3x4 transform for every one of the twenty bones, every frame, and
// `CombatBody.evaluateRig()` already double-buffers the two weapon sockets in world space.
// Hit resolution consumes those sockets today. **So nothing here re-derives a pose.** The
// bones are written straight into a THREE.Skeleton as world matrices and the weapon is drawn
// in the grip hand's own world frame. There is no second animation evaluation that could
// disagree with the first, because there is no second evaluation at all.
//
// WHAT YOU SEE IS WHAT HITS YOU — BY CONSTRUCTION, NOT BY CALIBRATION. The weapon mesh is
// authored in the grip hand's local frame along the blade axis skeleton.json declares
// (`weapon.blade_axis_local`, which is [0,-1,0]), and its tip vertex sits at exactly
// `socket_b_dist_m` along that axis. `Rig.evaluate()` places socket B at
// `hand_world * (blade_axis_local * socketBDist)`. The drawn tip and the hit socket are
// therefore the same point through the same matrix — not two numbers tuned to agree. If a
// future edit breaks that, `tools/harness/wpn-render-probe.mjs` §C measures the divergence in
// millimetres and fails.
//
// ALLOCATION. Geometry is built once per weapon id and once per actor, then mutated in place.
// The per-frame path (`poseFromRig`) allocates nothing.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { creatureArt } from './world-art.js';

// ---------------------------------------------------------------------------------------
// Geometry helpers. Everything is authored directly into typed arrays with skin indices and
// weights, because the pieces are simple and a full glTF pipeline for twenty capsules would
// be a great deal of machinery for no additional fidelity.
// ---------------------------------------------------------------------------------------

/** Scratch, module-level: the builders run at construction time, never per frame. */
const _v = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();

class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
  }

  get count() { return this.pos.length / 3; }

  vert(p, n, bones, weights) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.si.push(bones[0], bones[1], 0, 0);
    this.sw.push(weights[0], weights[1], 0, 0);
  }

  tri(a, b, c) { this.idx.push(a, b, c); }

  /**
   * A tapered tube from `a` to `b` in world (rest) space, skinned to `bone` and blended into
   * `parent` over the first `blend` of its length so an elbow bends rather than shears.
   */
  tube(a, b, r0, r1, bone, parent, blend, radial = 10, rings = 4) {
    _w.copy(b).sub(a);
    const len = _w.length();
    if (len < 1e-6) return;
    _w.multiplyScalar(1 / len);
    // any stable perpendicular
    _u.set(0, 0, 1);
    if (Math.abs(_w.z) > 0.9) _u.set(1, 0, 0);
    _u.crossVectors(_u, _w).normalize();
    _v.crossVectors(_w, _u).normalize();
    const base = this.count;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const r = r0 + (r1 - r0) * t;
      // taper the very ends inwards a touch so segments read as limbs, not pipes
      for (let i = 0; i < radial; i++) {
        const ang = (i / radial) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = _u.x * ca + _v.x * sa, ny = _u.y * ca + _v.y * sa, nz = _u.z * ca + _v.z * sa;
        const p = new THREE.Vector3(
          a.x + _w.x * len * t + nx * r,
          a.y + _w.y * len * t + ny * r,
          a.z + _w.z * len * t + nz * r,
        );
        const n = new THREE.Vector3(nx, ny, nz);
        // Skin weight: at the parent end (t=0) the vertex is shared with the parent bone, so
        // the joint creases instead of tearing. `blend` 0 gives a rigid segment.
        let wp = 0;
        if (blend > 0 && parent >= 0 && t < blend) {
          const s = t / blend;
          wp = 0.5 * (1 - s * s * (3 - 2 * s));
        }
        this.vert(p, n, [bone, parent < 0 ? bone : parent], [1 - wp, wp]);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < radial; i++) {
        const i2 = (i + 1) % radial;
        const A = base + j * radial + i, B = base + j * radial + i2;
        const C = base + (j + 1) * radial + i, D = base + (j + 1) * radial + i2;
        this.tri(A, C, B); this.tri(B, C, D);
      }
    }
  }

  /** A ball at a joint, rigidly skinned — shoulders, elbows, knees, skulls. */
  ball(c, r, bone, seg = 10, squash = 1, fwd = 0) {
    const base = this.count;
    for (let j = 0; j <= seg; j++) {
      const phi = (j / seg) * Math.PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let i = 0; i < seg * 2; i++) {
        const th = (i / (seg * 2)) * Math.PI * 2;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        const p = new THREE.Vector3(c.x + nx * r, c.y + ny * r * squash, c.z + nz * r + (nz > 0 ? nz * fwd : 0));
        this.vert(p, new THREE.Vector3(nx, ny, nz), [bone, bone], [1, 0]);
      }
    }
    const ring = seg * 2;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < ring; i++) {
        const i2 = (i + 1) % ring;
        const A = base + j * ring + i, B = base + j * ring + i2;
        const C = base + (j + 1) * ring + i, D = base + (j + 1) * ring + i2;
        this.tri(A, C, B); this.tri(B, C, D);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    return g;
  }
}

// ---------------------------------------------------------------------------------------
// The waterline.
//
// ARBITRATION S25: "Depth is read off the player's own silhouette against anatomical
// landmarks... which is why S18's permanent third person is load-bearing for water." RI-WLD10
// §10 point 3 is not a suggestion: "The waterline is on the character. A meniscus band on the
// mesh at height `d`, wet-shading below it that persists 20 s after leaving the water and dries
// visibly. This is the player's only depth readout and it is not optional." Before this,
// `game/src/render/` had no code anywhere that read water state and changed how the character
// was drawn — confirmed by grep across the whole render tree.
//
// WHY A SHADER AND NOT A SECOND MESH. The skinned geometry above is built ONCE per actor (see
// `poseFromRig`'s own header) and is skinned to a live rig every frame after that; there is no
// per-frame re-cut of the mesh, and the water surface the body is standing in moves every
// frame. A per-fragment world-space cutoff, fed a uniform, is the only place a dynamic waterline
// can live without rebuilding the character sixty times a second.
//
// WHY THE VERTEX SHADER'S "transformed" IS ALREADY WORLD SPACE. `poseFromRig`'s own header
// explains the trick this depends on: the bones are written as WORLD matrices, and the actor's
// own `group`/mesh transforms are pinned to identity (`group.position.set(0,0,0)` etc., below).
// So `boneMatrix * bindMatrix`, i.e. the position after `#include <skinning_vertex>`, already
// IS the world-space vertex position — there is no separate model matrix to fold in.
function installWaterline(mat, sharedUniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterY = sharedUniforms.uWaterY;
    shader.uniforms.uWetness = sharedUniforms.uWetness;
    shader.vertexShader = 'varying float vEsWaterY;\n' + shader.vertexShader.replace(
      '#include <skinning_vertex>',
      '#include <skinning_vertex>\n\tvEsWaterY = transformed.y;',
    );
    shader.fragmentShader = 'varying float vEsWaterY;\nuniform float uWaterY;\nuniform float uWetness;\n'
      + shader.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n'
          // `esBand`: metres BELOW the waterline (positive = submerged). The meniscus itself is a
          // ~5 cm soft band either side of the line, per §1's own "hard and hysteretic" boundary
          // language for the GAMEPLAY band — the RENDERED line is deliberately a hair softer than
          // that so it does not shimmer at 60 Hz the way a one-pixel hard edge would.
          + '\tfloat esBand = uWaterY - vEsWaterY;\n'
          + '\tfloat esWet = smoothstep(-0.06, 0.02, esBand) * uWetness;\n'
          + '\tfloat esMeniscus = (1.0 - smoothstep(0.0, 0.05, abs(esBand))) * uWetness;\n')
        .replace('#include <color_fragment>', '#include <color_fragment>\n'
          + '\tdiffuseColor.rgb *= mix(1.0, 0.42, esWet);\n'
          + '\tdiffuseColor.rgb += vec3(0.07, 0.10, 0.09) * esMeniscus;\n')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n'
          // Wet skin/cloth reads shinier, dry the same roughness it always was — RI-WLD10 §10.2
          // forbids a full-screen blue filter, not a material response, and this is bounded to
          // the band the fragment is actually inside.
          + '\troughnessFactor = mix(roughnessFactor, roughnessFactor * 0.30, esWet);\n');
  };
  mat.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------
// The body plan.
//
// Every length here is read from skeleton.json's own bone offsets at build time, never
// re-declared: a segment runs from its bone's origin to the CHILD bone's origin, so a forearm
// is exactly as long as the rig says a forearm is and the two cannot drift. Only radii and the
// few pieces with no child bone (head, hands, feet) carry authored numbers.
// ---------------------------------------------------------------------------------------

/** bone id -> { to, r0, r1, mat, blend } ; `to` is the child bone whose offset gives length. */
const PLAN = {
  pelvis: { to: 'spine_00', r0: 0.185, r1: 0.170, mat: 'cloth', blend: 0 },
  spine_00: { to: 'spine_02', r0: 0.170, r1: 0.205, mat: 'cloth', blend: 0.4 },
  spine_02: { to: 'neck', r0: 0.205, r1: 0.135, mat: 'cloth', blend: 0.4 },
  neck: { to: 'head', r0: 0.072, r1: 0.070, mat: 'skin', blend: 0.5 },
  clavicle_l: { to: 'upperarm_l', r0: 0.090, r1: 0.078, mat: 'cloth', blend: 0.5 },
  clavicle_r: { to: 'upperarm_r', r0: 0.090, r1: 0.078, mat: 'cloth', blend: 0.5 },
  upperarm_l: { to: 'lowerarm_l', r0: 0.083, r1: 0.070, mat: 'skin', blend: 0.45 },
  upperarm_r: { to: 'lowerarm_r', r0: 0.083, r1: 0.070, mat: 'skin', blend: 0.45 },
  lowerarm_l: { to: 'hand_l', r0: 0.070, r1: 0.053, mat: 'skin', blend: 0.45 },
  lowerarm_r: { to: 'hand_r', r0: 0.070, r1: 0.053, mat: 'skin', blend: 0.45 },
  thigh_l: { to: 'calf_l', r0: 0.113, r1: 0.090, mat: 'cloth', blend: 0.4 },
  thigh_r: { to: 'calf_r', r0: 0.113, r1: 0.090, mat: 'cloth', blend: 0.4 },
  calf_l: { to: 'foot_l', r0: 0.090, r1: 0.062, mat: 'cloth', blend: 0.4 },
  calf_r: { to: 'foot_r', r0: 0.090, r1: 0.062, mat: 'cloth', blend: 0.4 },
  // Leaf bones: no child to measure against, so these carry an authored local extent.
  hand_l: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },
  hand_r: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },
  foot_l: { local: [0, -0.045, 0.155], r0: 0.062, r1: 0.048, mat: 'skin', blend: 0 },
  foot_r: { local: [0, -0.045, 0.155], r0: 0.062, r1: 0.048, mat: 'skin', blend: 0 },
};

/**
 * Joint balls, so a bent elbow reads as a joint rather than two disconnected tubes.
 *
 * Each radius is a HAIR under its segment's radius at that end. Larger reads as a lumpy string
 * of beads — the first capture had a pelvis ball at 0.190 sitting proud of the 0.185 hip tube
 * and two 0.114 thigh balls inside it, which at VP07 distance is three overlapping spheres
 * where a hip should be. The pelvis has no ball at all now: its own tube already spans the
 * joint, so a ball there could only ever stick out of it.
 */
const JOINTS = [
  ['upperarm_l', 0.080, 'skin'], ['upperarm_r', 0.080, 'skin'],
  ['lowerarm_l', 0.068, 'skin'], ['lowerarm_r', 0.068, 'skin'],
  ['hand_l', 0.052, 'skin'], ['hand_r', 0.052, 'skin'],
  ['thigh_l', 0.106, 'cloth'], ['thigh_r', 0.106, 'cloth'],
  ['calf_l', 0.086, 'cloth'], ['calf_r', 0.086, 'cloth'],
];

/**
 * Build the two skinned meshes (skin and cloth) plus the bone hierarchy, from a live `Rig`.
 *
 * The skeleton is read off `rig.def.bones` rather than re-imported from skeleton.json, so the
 * drawn character cannot be built against a different bone list than the fight is using — the
 * arrays are the same length, in the same order, by construction.
 */
function buildSkeleton(rig, mats, tintHex, skinHex) {
  const defs = rig.def.bones;
  const bones = [];
  const index = new Map();
  for (let i = 0; i < defs.length; i++) {
    const b = new THREE.Bone();
    b.position.set(defs[i].offset[0], defs[i].offset[1], defs[i].offset[2]);
    bones.push(b);
    index.set(defs[i].id, i);
  }
  for (let i = 0; i < defs.length; i++) {
    const p = defs[i].parent;
    if (p !== null) bones[index.get(p)].add(bones[i]);
  }
  const rootBone = bones[0];
  rootBone.updateMatrixWorld(true);            // the REST pose, in actor-local space

  const restWorld = bones.map((b) => b.matrixWorld.clone());
  const boneInverses = restWorld.map((m) => m.clone().invert());

  const B = { skin: new MeshBuilder(), cloth: new MeshBuilder() };
  const originOf = (id) => new THREE.Vector3().setFromMatrixPosition(restWorld[index.get(id)]);

  for (const [id, spec] of Object.entries(PLAN)) {
    const bi = index.get(id);
    if (bi === undefined) continue;
    const a = originOf(id);
    let b;
    if (spec.to !== undefined) {
      if (index.get(spec.to) === undefined) continue;
      b = originOf(spec.to);
    } else {
      b = new THREE.Vector3(spec.local[0], spec.local[1], spec.local[2]).applyMatrix4(restWorld[bi]);
    }
    const parent = defs[bi].parent === null ? -1 : index.get(defs[bi].parent);
    B[spec.mat].tube(a, b, spec.r0, spec.r1, bi, parent, spec.blend);
  }
  for (const [id, r, mat] of JOINTS) {
    const bi = index.get(id);
    if (bi === undefined) continue;
    B[mat].ball(originOf(id), r, bi, 8);
  }

  // ---- the head ------------------------------------------------------------------------
  // This is Black Marsh and the player is Saxhleel, so the skull is long, the snout carries
  // forward off it, and a low crest runs back over the neck. Morrowind's own Argonian head is
  // the art-direction reference (corpus/70-visual/refs/morrowind/); the fidelity reference is
  // the modern set, which is why it is a shaped skull with a jaw rather than the sphere and
  // cone the previous actor used.
  const hi = index.get('head');
  if (hi !== undefined) {
    const hm = restWorld[hi];
    const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(hm);
    B.skin.ball(P(0, 0.085, 0.005), 0.115, hi, 9, 1.06, 0.03);          // skull
    B.skin.tube(P(0, 0.070, 0.075), P(0, 0.028, 0.235), 0.085, 0.047, hi, hi, 0, 8, 2); // snout
    B.skin.tube(P(0, 0.035, 0.065), P(0, 0.012, 0.205), 0.062, 0.036, hi, hi, 0, 8, 2); // jaw
    // the crest: three low spines back over the skull, the silhouette cue that reads at range
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      B.skin.tube(P(0, 0.150 - t * 0.030, 0.030 - t * 0.075),
        P(0, 0.215 - t * 0.055, -0.010 - t * 0.090), 0.030, 0.008, hi, hi, 0, 6, 2);
    }
  }

  // ---- the tail ------------------------------------------------------------------------
  // RI-CAM07 §F2 names the canonical Saxhleel read as "digitigrade stance, head crest/horns,
  // TAIL", and F1 asks the back silhouette to be distinguishable from the common humanoid
  // enemies at 32 px. A tail is the single cheapest thing that does both, and the back is the
  // shot the player looks at for ten hours (§F4).
  //
  // The combat skeleton intentionally has no tail bones, so the tail remains combat-rigid;
  // the separate spine frill below is the deterministic delayed secondary-motion carrier.
  const pi = index.get('pelvis');
  const s0 = index.get('spine_00');
  if (pi !== undefined) {
    const pm = restWorld[pi];
    const T = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(pm);
    const spine = [
      [T(0, 0.02, -0.13), T(0, -0.10, -0.36), 0.085, 0.068],
      [T(0, -0.10, -0.36), T(0, -0.30, -0.55), 0.068, 0.048],
      [T(0, -0.30, -0.55), T(0, -0.50, -0.66), 0.048, 0.030],
      [T(0, -0.50, -0.66), T(0, -0.66, -0.70), 0.030, 0.012],
    ];
    for (let k = 0; k < spine.length; k++) {
      const [a, b, r0, r1] = spine[k];
      B.skin.tube(a, b, r0, r1, pi, k === 0 && s0 !== undefined ? s0 : pi, k === 0 ? 0.35 : 0, 8, 2);
    }
  }

  const skeleton = new THREE.Skeleton(bones, boneInverses);
  const group = new THREE.Group();
  group.add(rootBone);

  // One pair of uniforms per ACTOR, shared by both its materials (skin and cloth wet and dry
  // together — they are one body), and updated once a frame by `poseFromRig`'s caller. -9999 so
  // an actor nobody has fed water data to this frame draws bone dry, not soaked at y=0.
  const waterU = { uWaterY: { value: -9999 }, uWetness: { value: 0 } };

  const meshes = [];
  for (const key of ['cloth', 'skin']) {
    if (B[key].count === 0) continue;
    const mat = (key === 'skin' ? mats.skin : mats.cloth).clone();
    if (key === 'skin' && skinHex !== undefined) mat.color.setHex(skinHex);
    if (key === 'cloth' && tintHex !== undefined) mat.color.setHex(tintHex);
    installWaterline(mat, waterU);
    const mesh = new THREE.SkinnedMesh(B[key].build(), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // The bones are written in WORLD space by `poseFromRig`, so the mesh's own transform must
    // not be applied twice. Binding with identity and leaving the group at identity makes the
    // shader's `bindMatrixInverse * boneMatrix * bindMatrix` resolve to `boneWorld * restInv`,
    // i.e. exactly the rig's own world transform (see the file header).
    mesh.bind(skeleton, new THREE.Matrix4());
    // A world-space skeleton defeats the bind-pose bounding sphere, which would cull the
    // character the moment it walked away from the origin.
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes.push(mesh);
  }

  // A small, authored back frill is the secondary-motion carrier.  It is deliberately outside
  // the simulation skeleton: combat owns the evaluated pose and sockets, while presentation is
  // allowed to lag behind that pose.  Each strip samples the same deterministic simulation frame
  // at a different fixed delay (4/7/10 f@60); there is no wall clock, random source or integration
  // error to make two captures diverge.  The strips are transformed from spine_02 below, so an
  // equipment/animation transition cannot detach them from the body.
  const secondary = [];
  const frillMat = mats.cloth.clone();
  if (tintHex !== undefined) frillMat.color.setHex(tintHex).offsetHSL(0.03, 0.08, -0.08);
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.11 - i * 0.018, 0.34 - i * 0.035, 5), frillMat);
    mesh.name = `actor-secondary-frill:${i}`;
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    secondary.push({ mesh, delayF: 4 + i * 3, localY: 0.08 - i * 0.13, localZ: -0.17 - i * 0.025 });
  }

  // Three authored visible sets across all five equipment slots.  The simulation's equip-load
  // tier selects the set; this layer cannot change stats, timing or sockets.  Geometry, scale
  // and material response all change, so a loadout transition is not a tint swap.
  const equipment=[];
  const equipMat={reed:mats.reed.clone(),chitin:mats.bark.clone(),xanmeer:mats.darkStone.clone()};
  equipMat.reed.color.setHex(0x7b7548);equipMat.chitin.color.setHex(0x6f4d31);equipMat.xanmeer.color.setHex(0x777964);
  const addEquip=(set,slot,boneId,geo,offset,scale=[1,1,1],rot=[0,0,0])=>{const bi=index.get(boneId);if(bi===undefined)return;const mesh=new THREE.Mesh(geo,equipMat[set]);mesh.name=`actor-equipment:${set}:${slot}`;mesh.castShadow=true;mesh.matrixAutoUpdate=false;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));const local=new THREE.Matrix4().compose(new THREE.Vector3(...offset),q,new THREE.Vector3(...scale));group.add(mesh);equipment.push({set,slot,bi,mesh,local});};
  for(const set of ['reed','chitin','xanmeer']){
    const heavy=set==='xanmeer',mid=set==='chitin';
    addEquip(set,'head','head',heavy?new THREE.ConeGeometry(.18,.34,4):mid?new THREE.CylinderGeometry(.14,.18,.23,7):new THREE.ConeGeometry(.17,.28,7),[0,.16,-.015],heavy?[1.15,1,1.15]:[1,1,1]);
    addEquip(set,'chest','spine_02',heavy?new THREE.BoxGeometry(.48,.48,.26):mid?new THREE.IcosahedronGeometry(.29,1):new THREE.ConeGeometry(.34,.58,7),[0,-.08,-.02],heavy?[1.12,1,1]:[1,1,1]);
    for(const s of [-1,1])addEquip(set,'hands',s<0?'hand_l':'hand_r',heavy?new THREE.BoxGeometry(.15,.22,.16):mid?new THREE.CylinderGeometry(.10,.12,.22,6):new THREE.CylinderGeometry(.075,.09,.20,7),[0,-.03,0]);
    for(const s of [-1,1])addEquip(set,'legs',s<0?'calf_l':'calf_r',heavy?new THREE.BoxGeometry(.20,.40,.20):mid?new THREE.CylinderGeometry(.105,.14,.38,7):new THREE.CylinderGeometry(.075,.095,.34,7),[0,-.18,0]);
    addEquip(set,'back','spine_02',heavy?new THREE.BoxGeometry(.42,.58,.18):mid?new THREE.ConeGeometry(.29,.64,6):new THREE.BoxGeometry(.30,.42,.12),[0,-.08,-.22],heavy?[1.15,1,1]:[1,1,1],[heavy?.12:0,0,mid?.12:-.08]);
  }

  return { group, bones, index, skeleton, meshes, rootBone, waterU, secondary, secondaryMat: frillMat, equipment, equipmentMat:equipMat };
}

// ---------------------------------------------------------------------------------------
// Weapons.
//
// Fifteen classes, fifteen silhouettes, every dimension read from the weapon block the fight
// itself is holding. Nothing here carries a hardcoded length: `length_m` is the solved blade
// length (`MovesetLibrary._bladeLength`, the same number that puts socket B where the hitbox
// is), `hitbox_span_m` is the class's EDGED span, and `radius_m` is the hit capsule radius.
// Perturb any of the three in the data and the drawn weapon changes shape — which is what
// `tools/harness/wpn-render-probe.mjs` §D checks, and it is the whole point.
// ---------------------------------------------------------------------------------------

/** Local frame: the grip hand is the origin and the blade runs along -Y (skeleton.json). */
function box(w, h, d, y, z = 0, x = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/**
 * The class an ENEMY's weapon belongs to.
 *
 * Enemy weapons do not come from the 87-weapon roster — `CombatSystem.spawn` reads a statblock's
 * own `weapon` block (game/data/combat/enemies/*.json), which carries no `class` at all. Without
 * this, every enemy in the game drew the same default blade, which is the piece's own defect
 * wearing a different hat.
 *
 * Nothing is invented: the statblocks already declare `socket_a`/`socket_b` by NAME, and those
 * names are the shape. `wpn_head_a`/`wpn_head_b` is skeleton.json's headed-weapon pair — the
 * hit volume is a lump near the end, which is an axe or a set of jaws — while `wpn_guard`/
 * `wpn_tip` is a blade running the length of the weapon. `capsule_length_m` is the declared
 * edged span. So the enemy silhouette is read off the same two fields the hit resolution uses.
 */
function classOfUnrostered(w) {
  const a = String(w.socket_a || ''), b = String(w.socket_b || '');
  if (a === 'wpn_head_a' || b === 'wpn_head_b') return 'AXE';
  // Length bands, chosen to match the statblocks' OWN notes: every `cam_*` enemy declares a
  // 1.45 m weapon and says in `_peak_declared_note` that it took its speed ceiling from
  // RI-CMB04 §B's greatsword row, so 1.45 m reading as a greatsword is the statblock agreeing
  // with itself rather than this file guessing.
  const L = Number(w.length_m) || 0;
  if (L >= 2.20) return 'UGS';
  if (L >= 1.25) return 'GSW';
  return 'SSW';
}

function buildWeaponGeo(w) {
  // L: hand -> tip. span: the edged portion, measured back from the tip. Both from data.
  const L = Math.max(0.15, Number(w.length_m) || 0.95);
  // `hitbox_span_m` is the roster's edged span; `capsule_length_m` is the same quantity as an
  // enemy statblock declares it. Fall back to the latter before guessing a fraction of L.
  const rawSpan = isFinite(Number(w.hitbox_span_m)) && Number(w.hitbox_span_m) > 0
    ? Number(w.hitbox_span_m) : Number(w.capsule_length_m);
  const span = Math.min(L * 0.98, Math.max(0.06, isFinite(rawSpan) && rawSpan > 0 ? rawSpan : L * 0.7));
  const R = Math.max(0.012, (Number(w.radius_m) || 0.06));
  const cls = String(w.class || classOfUnrostered(w));
  const haftTop = -(L - span);              // where the edged part begins, in -Y
  const tip = -L;
  const metal = [], wood = [];

  // The grip: always present, always above the guard, always the same 0.10 m the rig uses.
  const gripLen = Math.max(0.10, Math.min(0.42, L * 0.13));
  wood.push(box(R * 0.55, gripLen, R * 0.45, -gripLen * 0.5 + 0.06));

  const haftLen = Math.max(0, -haftTop - 0.06);

  switch (cls) {
    case 'DGR':
      metal.push(box(R * 0.9, span, R * 0.30, tip + span / 2));
      metal.push(box(R * 2.0, 0.028, R * 0.9, haftTop));
      break;
    case 'FST': {                                   // claw: three short blades off a knuckle bar
      metal.push(box(R * 2.6, 0.045, R * 1.1, -0.06));
      for (let k = -1; k <= 1; k++) {
        const g = box(R * 0.5, span, R * 0.22, tip + span / 2, 0, k * R * 0.9);
        g.rotateX(k * 0.10);
        metal.push(g);
      }
      break;
    }
    case 'CSW': case 'CGS': {                       // curved: the blade is built as an arc
      const segs = 9;
      const wide = cls === 'CGS' ? R * 1.5 : R * 1.05;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs, t1 = (k + 1) / segs;
        const y0 = haftTop - span * t0, y1 = haftTop - span * t1;
        // the curve: the tip rakes forward, which is what makes a curved sword read as one
        const c0 = span * 0.20 * t0 * t0, c1 = span * 0.20 * t1 * t1;
        // 1.45, not 1.12: the segments are individually ROTATED to follow the curve, so a
        // segment only as long as its own step leaves a wedge-shaped gap at every joint and
        // the blade reads as a chain of loose plates rather than one piece of steel. The
        // first capture of a curved greatsword showed exactly that.
        const seg = box(wide * (1 - 0.35 * t0), Math.abs(y1 - y0) * 1.45, R * 0.24,
          (y0 + y1) / 2, (c0 + c1) / 2);
        seg.rotateX(-Math.atan2(c1 - c0, Math.abs(y1 - y0)));
        metal.push(seg);
      }
      metal.push(box(R * (cls === 'CGS' ? 4.2 : 3.0), 0.035, R * 0.8, haftTop));
      break;
    }
    case 'TSW':                                     // thrusting: narrow, long, a swept guard
      metal.push(box(R * 0.55, span, R * 0.30, tip + span / 2));
      metal.push(box(R * 2.2, 0.030, R * 2.2, haftTop));
      metal.push(box(R * 0.30, 0.16, R * 2.0, haftTop + 0.08));
      break;
    case 'SSW': case 'GSW': case 'UGS': {
      const wide = cls === 'UGS' ? R * 1.9 : cls === 'GSW' ? R * 1.5 : R * 1.0;
      metal.push(box(wide, span, R * 0.26, tip + span / 2));
      metal.push(box(wide * 0.55, span * 0.9, R * 0.34, tip + span / 2));   // the fuller ridge
      metal.push(box(wide * 3.0, 0.042, R * 0.9, haftTop));                 // crossguard
      metal.push(box(R * 0.9, 0.06, R * 0.9, 0.075));                       // pommel
      break;
    }
    case 'SPR':                                     // long haft, small leaf head at the tip
      if (haftLen > 0) wood.push(box(R * 0.7, haftLen, R * 0.7, haftTop + haftLen / 2));
      metal.push(box(R * 1.5, span * 0.55, R * 0.30, tip + span * 0.28));
      metal.push(box(R * 0.8, span * 0.5, R * 0.5, tip + span * 0.72));
      break;
    case 'WHP': {                                   // a segmented cord: span is nearly all of it
      if (haftLen > 0) wood.push(box(R * 0.9, haftLen, R * 0.9, haftTop + haftLen / 2));
      const links = 14;
      for (let k = 0; k < links; k++) {
        const t = k / links;
        metal.push(box(R * (0.55 - 0.30 * t), span / links * 0.78, R * (0.55 - 0.30 * t),
          haftTop - span * (t + 0.5 / links), span * 0.16 * Math.sin(t * 3.1)));
      }
      break;
    }
    case 'AXE': case 'HLB': {
      if (haftLen > 0) wood.push(box(R * 0.62, haftLen, R * 0.62, haftTop + haftLen / 2));
      // the bit hangs off ONE side of the haft — the asymmetry is the class's silhouette
      const bitH = cls === 'HLB' ? span * 0.42 : span * 0.86;
      const bitY = cls === 'HLB' ? tip + span * 0.62 : tip + span * 0.48;
      metal.push(box(R * 0.5, bitH, R * 3.1, bitY, R * 1.7));
      metal.push(box(R * 0.5, bitH * 0.5, R * 1.2, bitY + bitH * 0.42, R * 0.6));
      if (cls === 'HLB') {
        metal.push(box(R * 0.55, span * 0.55, R * 0.55, tip + span * 0.24));   // top spike
        metal.push(box(R * 0.45, R * 1.4, R * 1.4, bitY - bitH * 0.2, -R * 0.9)); // rear fluke
      } else {
        metal.push(box(R * 1.2, 0.035, R * 1.2, haftTop));
      }
      break;
    }
    case 'MCE': case 'GHM': {
      if (haftLen > 0) wood.push(box(R * 0.62, haftLen, R * 0.62, haftTop + haftLen / 2));
      const headH = span * (cls === 'GHM' ? 0.85 : 0.9);
      const headY = tip + headH / 2;
      if (cls === 'GHM') {
        metal.push(box(R * 2.6, headH, R * 2.6, headY));                     // a block hammer
        metal.push(box(R * 3.0, headH * 0.22, R * 3.0, headY + headH * 0.36));
      } else {
        for (let k = 0; k < 4; k++) {                                        // flanges
          const g = box(R * 0.55, headH, R * 2.1, headY);
          g.rotateY((k / 4) * Math.PI * 2);
          metal.push(g);
        }
        metal.push(box(R * 1.0, headH * 1.02, R * 1.0, headY));
      }
      metal.push(box(R * 1.1, 0.035, R * 1.1, haftTop));
      break;
    }
    case 'BOW': {
      // Limbs and a string, centred on the hand rather than running to the "tip": for a bow
      // `socket_b_dist_m` is the melee capsule the resolver keeps for a bash, not the stave's
      // length, so drawing to it would give a bow half again too long. The per-weapon numbers
      // are sane here (bow_marsh_longbow solves to 1.405 m), so the stave is drawn at the
      // solved length and simply CENTRED on the grip, which is where a bow is actually held.
      const limb = L * 0.5;
      for (const s of [1, -1]) {
        const g = box(R * 0.7, limb, R * 0.35, s * limb * 0.5);
        g.rotateX(s * 0.22);
        wood.push(g);
      }
      metal.push(box(0.006, limb * 1.92, 0.006, 0, -R * 0.9));
      break;
    }
    default:
      metal.push(box(R * 1.0, span, R * 0.26, tip + span / 2));
      metal.push(box(R * 2.6, 0.04, R * 0.9, haftTop));
  }
  return { metal, wood };
}

function mergeBoxes(list) {
  // Hand-rolled merge: the vendored three build carries no BufferGeometryUtils.
  let vcount = 0, icount = 0;
  for (const g of list) { vcount += g.attributes.position.count; icount += g.index.count; }
  const pos = new Float32Array(vcount * 3), nrm = new Float32Array(vcount * 3);
  const idx = new Uint16Array(icount);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    pos.set(p, vo * 3); nrm.set(n, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
  return out;
}

/**
 * The drawn weapon, in the grip hand's local frame. Cached per (weapon, length, span, radius)
 * so that PERTURBING THE DATA REBUILDS THE MESH — a cache keyed on the weapon id alone would
 * have made this file's own consumption test pass while nothing consumed anything.
 */
const _weaponCache = new Map();

/**
 * The cache key, in ONE place because two copies of it is how a cache and its invalidator
 * drift. Every field `buildWeaponGeo` reads is in the key, including the two an enemy
 * statblock varies (`socket_a`, `capsule_length_m`) — a key built only from the roster's
 * fields collapses every unrostered weapon onto the string "||1.45||0.095" and hands the
 * beast's jaws the boss's greatsword.
 */
export function weaponKeyOf(w) {
  return [w.weapon_id, w.class, w.length_m, w.hitbox_span_m,
    w.capsule_length_m, w.socket_a, w.socket_b, w.radius_m].join('|');
}

function weaponMesh(w, mats) {
  const key = weaponKeyOf(w);
  let entry = _weaponCache.get(key);
  if (!entry) {
    const { metal, wood } = buildWeaponGeo(w);
    entry = { metal: metal.length ? mergeBoxes(metal) : null, wood: wood.length ? mergeBoxes(wood) : null };
    _weaponCache.set(key, entry);
  }
  const g = new THREE.Group();
  if (entry.metal) { const m = new THREE.Mesh(entry.metal, mats.metal); m.castShadow = true; g.add(m); }
  if (entry.wood) { const m = new THREE.Mesh(entry.wood, mats.bark); m.castShadow = true; g.add(m); }
  g.matrixAutoUpdate = false;
  return g;
}

// ---------------------------------------------------------------------------------------
// The public surface.
// ---------------------------------------------------------------------------------------

/**
 * An actor that can be posed. Cheap to make and inert until `poseFromRig` is first called
 * with a live rig — so an NPC that has no combat body still gets a proper humanoid, standing
 * in the rest pose, driven by the group transform as before.
 */
export function makeRiggedActor(mats, tintHex, skinHex, artFamily='saxhleel') {
  const g = new THREE.Group();
  const art=creatureArt(artFamily);
  const direction=new THREE.Group();
  direction.name=`world-art-creature:${artFamily}:${art.shape}`;
  const directionMat=new THREE.MeshStandardMaterial({color:art.colour,roughness:art.roughness,metalness:artFamily==='beast'?.18:0});
  const add=(geo,x,y,z,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,directionMat);m.position.set(x,y,z);m.rotation.set(rx,0,rz);m.castShadow=true;direction.add(m);};
  if(artFamily==='saxhleel') {
    add(new THREE.ConeGeometry(.09,.34,5),0,1.82,-.08,-.35);
    for(let i=0;i<4;i++) add(new THREE.ConeGeometry(.085-i*.012,.28,5),0,1.03-i*.13,-.18-i*.18,-Math.PI/2-.18);
  } else if(artFamily==='humanoid') {
    add(new THREE.ConeGeometry(.5,.7,6),0,1.42,-.05,0);
    add(new THREE.BoxGeometry(.42,.62,.18),0,1.18,-.24);
  } else if(artFamily==='beast') {
    add(new THREE.IcosahedronGeometry(.48,1),0,.76,0);
    for(const sx of [-1,1]) add(new THREE.ConeGeometry(.09,.55,5),sx*.28,.75,.42,Math.PI/2,sx*.2);
  } else {
    for(const sx of [-1,1]) for(let i=0;i<3;i++) add(new THREE.CylinderGeometry(.025,.045,.48,5),sx*(.15+i*.04),1.25-i*.12,0,Math.PI/2,sx*.22);
    add(new THREE.ConeGeometry(.1,.4,5),.22,1.7,0,0,.55);
  }
  direction.scale.set(...art.scale); g.add(direction);
  // Contact grounding and action readability are renderer-owned presentation. They never feed
  // back into the fixed-step rig, sockets, hit windows or camera.
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,20),new THREE.MeshBasicMaterial({color:0x080b09,transparent:true,opacity:.34,depthWrite:false}));
  shadow.name='actor-contact-shadow'; shadow.rotation.x=-Math.PI/2; shadow.renderOrder=2; g.add(shadow);
  const action=new THREE.Mesh(new THREE.TorusGeometry(.48,.025,5,24,Math.PI*1.35),new THREE.MeshBasicMaterial({color:0xa8d8b0,transparent:true,opacity:.0,depthWrite:false}));
  action.name='actor-action-silhouette'; action.rotation.x=Math.PI/2; action.visible=false; g.add(action);
  g.userData.actor = { built: null, mats, tintHex, skinHex, weapon: null, weaponKey: null, rigged: false, shadow, action, direction, artFamily, art };
  g.userData.worldArt={creature:artFamily,silhouette:art.silhouette,visibleConsumer:direction.name};
  return g;
}

/** Does this group have a skinned body yet? */
export function isBuilt(group) {
  return !!(group.userData.actor && group.userData.actor.built);
}

/**
 * Drive the actor from a live `CombatBody`. This is the whole consumer: it writes the rig's
 * own world matrices into the skeleton and hangs the weapon off the grip hand's world frame.
 *
 * @param {THREE.Group} group  from makeRiggedActor
 * @param {object} body        a CombatBody — needs `.rig`, `.socketA/B`, `.moves._weapon`
 * @param {{y:number, wetness:number}} [water]  RI-WLD10 §10.3's waterline: `y` is the water
 *        surface's world-space height at this body's position (any finite number; unreachable
 *        while `wetness` is 0), `wetness` is 0..1 — 1 while at or below the surface, fading to 0
 *        over the drying window. Omitted (or `wetness` 0) draws the body exactly as before this
 *        existed.
 */
export function poseFromRig(group, body, water) {
  const A = group.userData.actor;
  if (!A || !body || !body.rig) return false;
  const rig = body.rig;
  if (!A.built) {
    A.built = buildSkeleton(rig, A.mats, A.tintHex, A.skinHex);
    group.add(A.built.group);
  }
  const S = A.built;
  const root=body.rig.world[0], groundY=(body.pos&&body.pos[1])||0;
  if(A.direction&&root) A.direction.position.set(root[9],groundY,root[11]);
  if(A.shadow&&root){ const air=Math.max(0,root[10]-groundY); A.shadow.position.set(root[9],groundY+.018,root[11]); A.shadow.scale.setScalar(Math.max(.42,1-air*.22)); A.shadow.material.opacity=Math.max(.08,.34-air*.12); }
  if(A.action&&root){
    const attacking=!!body.move && (body.hitboxActive || /ROLL|BLOCK|STAGGER|RECOVERY/.test(body.state));
    A.action.visible=attacking; A.action.material.opacity=body.hitboxActive ? .42 : .18;
    A.action.position.set(root[9],root[10]+.82,root[11]); A.action.rotation.z=(body.animFrame||0)*.085;
    A.action.scale.setScalar(body.airborne?1.3:1);
  }
  if (S.waterU) {
    S.waterU.uWaterY.value = water ? water.y : -9999;
    S.waterU.uWetness.value = water ? water.wetness : 0;
  }

  // ---- the body ------------------------------------------------------------------------
  // `rig.world[i]` is a 3x4 row-major [m00..m22, tx,ty,tz]; THREE.Matrix4.elements is
  // COLUMN-major. This is the only place the two conventions meet and it is written out
  // longhand rather than through `.set()` so the transpose is visible.
  const bones = S.bones;
  const n = Math.min(bones.length, rig.world.length);
  for (let i = 0; i < n; i++) {
    const s = rig.world[i];
    const e = bones[i].matrixWorld.elements;
    e[0] = s[0]; e[1] = s[3]; e[2] = s[6]; e[3] = 0;
    e[4] = s[1]; e[5] = s[4]; e[6] = s[7]; e[7] = 0;
    e[8] = s[2]; e[9] = s[5]; e[10] = s[8]; e[11] = 0;
    e[12] = s[9]; e[13] = s[10]; e[14] = s[11]; e[15] = 1;
  }
  // Presentation IK: the fixed-step rig remains authoritative for root motion, attacks,
  // sockets and hurtboxes; only the two terminal foot bones conform to the visible surface.
  // This is evaluated from the same WorldField height function that draws/collides terrain.
  if (water && typeof water.groundAt === 'function') {
    for (const id of ['foot_l', 'foot_r']) {
      const i = S.index.get(id); if (i === undefined || i >= n) continue;
      const e = bones[i].matrixWorld.elements, x=e[12], z=e[14], d=.20;
      const gy=water.groundAt(x,z), gx=water.groundAt(x+d,z)-water.groundAt(x-d,z), gz=water.groundAt(x,z+d)-water.groundAt(x,z-d);
      const nl=Math.hypot(gx,2*d,gz)||1, nx=-gx/nl, ny=2*d/nl, nz=-gz/nl;
      // Preserve the animated facing axis and replace only the sole-up axis; Gram-Schmidt
      // keeps the matrix orthonormal on slopes and stairs without changing animation timing.
      let xx=e[0],xy=e[1],xz=e[2],dot=xx*nx+xy*ny+xz*nz;xx-=dot*nx;xy-=dot*ny;xz-=dot*nz;const xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;
      const zx=xy*nz-xz*ny,zy=xz*nx-xx*nz,zz=xx*ny-xy*nx;
      e[0]=xx;e[1]=xy;e[2]=xz;e[4]=nx;e[5]=ny;e[6]=nz;e[8]=zx;e[9]=zy;e[10]=zz;e[13]=gy+.02;
    }
  }
  if (!A.rigged) {
    // Stop the scene graph recomputing what we just wrote — on EVERY bone, not only the root.
    //
    // This is not defensive tidying, it is the whole thing working. `Object3D.updateMatrixWorld`
    // clears `matrixWorldAutoUpdate` for the node it is called on and then RECURSES INTO THE
    // CHILDREN WITH force=true, and each child whose own flag is still true recomputes
    // `matrixWorld = parent.matrixWorld * matrix` from its REST local offset. Setting the flag
    // on the root alone therefore threw away all nineteen written poses and rebuilt the rest
    // pose, rigidly carried by the root — which measured as a swinging weapon (the weapon rides
    // the hand matrix directly) attached to a body whose every bone moved 0.00% relative to its
    // own root. That is the pre-fix defect wearing this file's clothes, and it is exactly what
    // §C of the probe is shaped to catch.
    for (const b of S.bones) {
      b.matrixAutoUpdate = false;
      b.matrixWorldAutoUpdate = false;
    }
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrix();
    A.rigged = true;
  }
  S.skeleton.update();

  // ---- deterministic secondary motion -------------------------------------------------
  // Phase-delayed procedural lag is presentation-only.  It cannot change the rig, root motion,
  // hit windows or sockets, but it gives the permanently visible back silhouette a readable
  // follow-through during locomotion, turns, rolls, attacks, stops and recovery.  `animFrame`
  // is a fixed-step counter, so identical state+seed produces byte-identical transforms.
  const spineIdx = S.index.get('spine_02');
  const spine = spineIdx === undefined ? null : rig.world[spineIdx];
  if (spine && S.secondary) {
    const f = Number(body.animFrame || 0);
    const speed = body.state === 'SPRINT' ? 1.0 : body.state === 'WALK' ? 0.55 : body.move ? 0.8 : 0.22;
    for (let i = 0; i < S.secondary.length; i++) {
      const seg = S.secondary[i];
      const phase = (f - seg.delayF) * 0.19 + i * 0.72;
      const follow = Math.sin(phase) * (0.10 + speed * 0.16);
      const lift = Math.abs(Math.sin(phase * 0.5)) * speed * 0.045;
      const e = seg.mesh.matrix.elements;
      // spine rotation with a local Z-axis follow-through.  Translation is spine-local too.
      const c = Math.cos(follow), s = Math.sin(follow);
      e[0] = spine[0] * c + spine[1] * s; e[1] = spine[3] * c + spine[4] * s; e[2] = spine[6] * c + spine[7] * s; e[3] = 0;
      e[4] = spine[1] * c - spine[0] * s; e[5] = spine[4] * c - spine[3] * s; e[6] = spine[7] * c - spine[6] * s; e[7] = 0;
      e[8] = spine[2]; e[9] = spine[5]; e[10] = spine[8]; e[11] = 0;
      e[12] = spine[9] + spine[1] * seg.localY + spine[2] * seg.localZ;
      e[13] = spine[10] + spine[4] * seg.localY + spine[5] * seg.localZ + lift;
      e[14] = spine[11] + spine[7] * seg.localY + spine[8] * seg.localZ;
      e[15] = 1;
      seg.mesh.matrixWorld.copy(seg.mesh.matrix);
      seg.mesh.matrixWorldNeedsUpdate = false;
    }
  }

  if(S.equipment){const set=Number(body.equipLoadPct||0)<30?'reed':Number(body.equipLoadPct||0)<70?'chitin':'xanmeer';for(const p of S.equipment){p.mesh.visible=p.set===set;if(!p.mesh.visible)continue;const s=rig.world[p.bi],e=p.mesh.matrix.elements;e[0]=s[0];e[1]=s[3];e[2]=s[6];e[3]=0;e[4]=s[1];e[5]=s[4];e[6]=s[7];e[7]=0;e[8]=s[2];e[9]=s[5];e[10]=s[8];e[11]=0;e[12]=s[9];e[13]=s[10];e[14]=s[11];e[15]=1;p.mesh.matrix.multiply(p.local);p.mesh.matrixWorld.copy(p.mesh.matrix);p.mesh.matrixWorldNeedsUpdate=false;}}

  // ---- the weapon ----------------------------------------------------------------------
  const w = (body.moves && body.moves._weapon) || null;
  if (w) {
    const key = weaponKeyOf(w);
    if (key !== A.weaponKey) {
      if (A.weapon) group.remove(A.weapon);
      A.weapon = weaponMesh(w, A.mats);
      A.weaponKey = key;
      group.add(A.weapon);
    }
    // The weapon rides the GRIP HAND's world matrix, which is the same matrix
    // `Rig.evaluate()` puts the sockets on. There is no separate weapon transform to drift.
    const hm = rig.world[rig.gripIdx];
    const e = A.weapon.matrix.elements;
    e[0] = hm[0]; e[1] = hm[3]; e[2] = hm[6]; e[3] = 0;
    e[4] = hm[1]; e[5] = hm[4]; e[6] = hm[7]; e[7] = 0;
    e[8] = hm[2]; e[9] = hm[5]; e[10] = hm[8]; e[11] = 0;
    e[12] = hm[9]; e[13] = hm[10]; e[14] = hm[11]; e[15] = 1;
    A.weapon.matrixWorld.copy(A.weapon.matrix);
    A.weapon.matrixWorldNeedsUpdate = false;
    for (const c of A.weapon.children) c.matrixWorld.copy(A.weapon.matrixWorld);
    A.weapon.visible = true;
  } else if (A.weapon) {
    A.weapon.visible = false;
  }
  return true;
}

/**
 * The fallback for an actor with no combat body: build the body at the rest pose against a
 * borrowed rig definition and pose it with the group transform, as before.
 */
export function poseStatic(group, rigDefSource, pos, yawDeg) {
  const A = group.userData.actor;
  if (!A) return false;
  if (!A.built) {
    if (!rigDefSource || !rigDefSource.def) return false;
    A.built = buildSkeleton(rigDefSource, A.mats, A.tintHex, A.skinHex);
    group.add(A.built.group);
  }
  if (A.rigged) return false;                 // already world-driven; do not fight it
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.y = (yawDeg * Math.PI) / 180;
  return true;
}
