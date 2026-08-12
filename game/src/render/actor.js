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
const _directionMaterialCache=new WeakMap();
const _equipmentMaterialCache=new WeakMap();

class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
  }

  get count() { return this.pos.length / 3; }

  vert(p, n, bones, weights, uv=[0,0]) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.si.push(bones[0], bones[1], 0, 0);
    this.sw.push(weights[0], weights[1], 0, 0);
    this.uv.push(uv[0],uv[1]);
  }

  tri(a, b, c) { this.idx.push(a, b, c); }

  /**
   * A tapered tube from `a` to `b` in world (rest) space, skinned to `bone` and blended into
   * `parent` over the first `blend` of its length so an elbow bends rather than shears.
   */
  tube(a, b, r0, r1, bone, parent, blend, radial = 12, rings = 5) {
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
        this.vert(p, n, [bone, parent < 0 ? bone : parent], [1 - wp, wp],[i/radial,t*2]);
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
    // Close both ends. Open limb tubes expose their back faces at elbows, wrists and armour
    // junctions during motion; against the sky that reads as a translucent or hollow body even
    // though the material itself is opaque. The caps carry the same terminal skin weights as
    // their rings, so they remain sealed through deformation.
    const start=this.count, end=this.count+1;
    const startParent=(blend>0&&parent>=0) ? .5 : 0;
    this.vert(a.clone(),_w.clone().multiplyScalar(-1),[bone,parent<0?bone:parent],[1-startParent,startParent],[.5,.5]);
    this.vert(b.clone(),_w.clone(),[bone,bone],[1,0],[.5,.5]);
    for(let i=0;i<radial;i++){
      const i2=(i+1)%radial, first=base+i, last=base+rings*radial+i;
      this.tri(start,base+i2,first);
      this.tri(end,last,base+rings*radial+i2);
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
        this.vert(p, new THREE.Vector3(nx, ny, nz), [bone, bone], [1, 0],[i/(seg*2),j/seg]);
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

  /** Ellipsoidal terminal mass, emitted into the sealed skinned surface. */
  ellipsoid(c, radii, bone, seg = 14) {
    const [rx,ry,rz]=radii,base=this.count,ring=seg*2;
    for(let j=0;j<=seg;j++){
      const phi=(j/seg)*Math.PI,sp=Math.sin(phi),cp=Math.cos(phi);
      for(let i=0;i<ring;i++){
        const th=(i/ring)*Math.PI*2,ct=Math.cos(th),st=Math.sin(th);
        const x=sp*ct,y=cp,z=sp*st;
        const p=new THREE.Vector3(c.x+x*rx,c.y+y*ry,c.z+z*rz);
        const n=new THREE.Vector3(x/rx,y/ry,z/rz).normalize();
        this.vert(p,n,[bone,bone],[1,0],[i/ring,j/seg]);
      }
    }
    for(let j=0;j<seg;j++)for(let i=0;i<ring;i++){
      const i2=(i+1)%ring,A=base+j*ring+i,B=base+j*ring+i2,C=base+(j+1)*ring+i,D=base+(j+1)*ring+i2;
      this.tri(A,C,B);this.tri(B,C,D);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
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
function buildSkeleton(rig, mats, tintHex, skinHex, artFamily='saxhleel') {
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
    B[mat].ball(originOf(id), r, bi, 10);
  }

  // Anatomical volumes bridge the mechanically useful skeleton tubes into a readable body.
  // They are emitted into the same sealed, skinned surfaces, so they cannot lag behind motion
  // or recreate the translucent-overlap defect that separate transparent shells produced.
  const pelvisI=index.get('pelvis');
  if(pelvisI!==undefined)B.cloth.ellipsoid(originOf('pelvis').add(new THREE.Vector3(0,.035,0)),[.17,.12,.125],pelvisI,12);
  const chestI=index.get('spine_02');
  if(chestI!==undefined)B.cloth.ellipsoid(originOf('spine_02').add(new THREE.Vector3(0,.025,0)),[.205,.19,.13],chestI,14);

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
    if(artFamily==='saxhleel'){
      B.skin.ellipsoid(P(0,0.085,0.005),[.108,.132,.126],hi,12);          // skull
      B.skin.tube(P(0, 0.070, 0.075), P(0, 0.028, 0.235), 0.085, 0.047, hi, hi, 0, 8, 2); // snout
      B.skin.tube(P(0, 0.035, 0.065), P(0, 0.012, 0.205), 0.062, 0.036, hi, hi, 0, 8, 2); // jaw
      for (let k = 0; k < 3; k++) {
        const t = k / 3;
        B.skin.tube(P(0, 0.150 - t * 0.030, 0.030 - t * 0.075),
          P(0, 0.215 - t * 0.055, -0.010 - t * 0.090), 0.030, 0.008, hi, hi, 0, 6, 2);
      }
    }else if(artFamily==='humanoid'){
      B.skin.ellipsoid(P(0,.080,.004),[.100,.132,.098],hi,14);
      B.skin.ellipsoid(P(0,.045,.096),[.025,.040,.034],hi,9);             // nose
      B.skin.ellipsoid(P(0,.002,.071),[.072,.040,.070],hi,10);            // jaw/chin
      B.skin.ellipsoid(P(-.105,.076,0),[.018,.038,.014],hi,8);
      B.skin.ellipsoid(P( .105,.076,0),[.018,.038,.014],hi,8);
    }else if(artFamily==='undead'){
      // A narrow corpse volume supports the separate bone skull/ribs without smuggling the
      // player's reptile snout and crest underneath them.
      B.skin.ellipsoid(P(0,.072,.006),[.083,.116,.079],hi,10);
    }
  }

  // Hands and feet need terminal anatomy. A tapered forearm ending in one capped tube was the
  // canonical "rubber hose" failure in the hardware close-up. Three splayed digits and forward
  // toes remain rigid to their terminal bones, so they cannot disturb hit volumes or IK.
  for (const [id, sideSign] of [['hand_l',-1],['hand_r',1]]) {
    const bi=index.get(id); if (bi===undefined) continue;
    const hm=restWorld[bi], P=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(hm);
    B.skin.ellipsoid(P(0,-.055,.025),[.070,.090,.048],bi,10);
    for(let k=-1;k<=1;k++) B.skin.tube(P(k*.025,-.084,.022),P(k*.038,-.174,.045+Math.abs(k)*.012),.016,.006,bi,bi,0,7,3);
    B.skin.tube(P(sideSign*.052,-.060,.018),P(sideSign*.098,-.132,.060),.015,.006,bi,bi,0,7,3);
  }
  for (const id of ['foot_l','foot_r']) {
    const bi=index.get(id); if (bi===undefined) continue;
    const fm=restWorld[bi], P=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(fm);
    B.skin.ellipsoid(P(0,-.035,.115),[.075,.052,.135],bi,10);
    for(let k=-1;k<=1;k++) B.skin.tube(P(k*.030,-.038,.155),P(k*.045,-.040,.275-Math.abs(k)*.018),.018,.006,bi,bi,0,7,3);
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
  if (pi !== undefined && artFamily==='saxhleel') {
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
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.082 - i * 0.014, 0.25 - i * 0.025, 7), frillMat);
    mesh.name = `actor-secondary-frill:${i}`;
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    secondary.push({ mesh, delayF: 4 + i * 3, localY: 0.10 - i * 0.105, localZ: -0.145 - i * 0.018 });
  }

  // Three authored visible sets across all five equipment slots.  The simulation's equip-load
  // tier selects the set; this layer cannot change stats, timing or sockets.  Geometry, scale
  // and material response all change, so a loadout transition is not a tint swap.
  const equipment=[];
  let equipMat=_equipmentMaterialCache.get(mats);
  if(!equipMat){equipMat={reed:mats.reed.clone(),chitin:(mats.chitin||mats.bark).clone(),xanmeer:mats.darkStone.clone()};equipMat.reed.color.setHex(0x91885b);equipMat.chitin.color.setHex(0x805d42);equipMat.xanmeer.color.setHex(0x969987);equipMat.reed.roughness=.78;equipMat.chitin.roughness=.48;equipMat.xanmeer.roughness=.38;_equipmentMaterialCache.set(mats,equipMat);}
  const addEquip=(set,slot,boneId,geo,offset,scale=[1,1,1],rot=[0,0,0])=>{const bi=index.get(boneId);if(bi===undefined)return;const mesh=new THREE.Mesh(geo,equipMat[set]);mesh.name=`actor-equipment:${set}:${slot}`;mesh.castShadow=true;mesh.matrixAutoUpdate=false;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));const local=new THREE.Matrix4().compose(new THREE.Vector3(...offset),q,new THREE.Vector3(...scale));group.add(mesh);equipment.push({set,slot,bi,mesh,local});};
  for(const set of ['reed','chitin','xanmeer']){
    const heavy=set==='xanmeer',mid=set==='chitin';
    addEquip(set,'head','head',heavy?new THREE.CylinderGeometry(.145,.17,.20,10):mid?new THREE.SphereGeometry(.155,12,7,0,Math.PI*2,0,Math.PI*.58):new THREE.TorusGeometry(.145,.022,5,12,Math.PI*1.55),[0,.14,-.015],heavy?[1.08,1,1.08]:[1,1,1],heavy?[0,0,0]:[Math.PI/2,0,.35]);
    // Chest plates follow the torso as a tapered shell. A capsule transformed by the live spine
    // read as one horizontal log from shoulder to shoulder in the canonical rear camera.
    addEquip(set,'chest','spine_02',torsoShellGeometry(set),[0,-.04,-.012],[1,1,1]);
    // Layered gorget and shoulder shells keep armour readable without obscuring the pose.
    addEquip(set,'chest','spine_02',new THREE.TorusGeometry(.176,.018,5,14,Math.PI*1.65),[0,.142,.015],[1,1,.74],[Math.PI/2,0,.28]);
    for(const s of [-1,1])addEquip(set,'chest',s<0?'upperarm_l':'upperarm_r',new THREE.SphereGeometry(heavy?.078:.064,12,7,0,Math.PI*2,0,Math.PI*.55),[0,.002,0],[1.02,.48,.72],[0,0,s*.22]);
    for(const s of [-1,1])addEquip(set,'hands',s<0?'hand_l':'hand_r',taperedGuardGeometry(heavy?.105:mid?.095:.078,heavy?.088:mid?.078:.062,heavy?.22:.19,heavy?.86:.76),[0,-.055,0],[1,1,1]);
    for(const s of [-1,1])addEquip(set,'legs',s<0?'calf_l':'calf_r',taperedGuardGeometry(heavy?.13:mid?.115:.095,heavy?.10:mid?.09:.072,heavy?.38:.34,heavy?.86:.78),[0,-.17,0],[1,1,1]);
    // A belt, hanging front panel and oblique bindings integrate the set across the torso and
    // pelvis. Without these junctions every slot read as an unrelated primitive glued to a rig.
    addEquip(set,'chest','spine_00',new THREE.TorusGeometry(.205,heavy?.035:.024,6,18),[0,-.04,0],[1,.72,1],[Math.PI/2,0,0]);
    addEquip(set,'legs','pelvis',garmentTabGeometry(heavy?.25:.215,heavy?.42:.36,.025),[0,-.20,.105],[1,1,1],[0,0,0]);
    for(const s of [-1,1]) addEquip(set,'chest','spine_02',new THREE.BoxGeometry(.035,.40,.025),[s*.105,-.06,.125],[1,1,1],[0,0,s*.24]);
    addEquip(set,'back','spine_02',heavy?new THREE.CylinderGeometry(.205,.205,.050,14):mid?new THREE.DodecahedronGeometry(.18,1):new THREE.CapsuleGeometry(.105,.20,4,8),[0,-.07,-.178],heavy?[1,.66,1]:mid?[.78,1,.32]:[.76,1,.34],[heavy?Math.PI/2:.08,0,mid?.10:-.06]);
  }

  // Family-specific articulated presentation pieces. These ride evaluated bones just like
  // equipment, so quadruped mass, plated Saxhleel features and undead ribs participate in every
  // locomotion/combat pose instead of being a static metadata ornament around a humanoid rig.
  const presentation=[];
  let familyMat=artFamily==='beast'?(mats.wet_chitin||mats.chitin):artFamily==='undead'?mats.bone:mats.skin;
  if(artFamily==='beast'){
    familyMat=familyMat.clone();const hsl={h:0,s:0,l:0};familyMat.color.getHSL(hsl);
    familyMat.color.setHSL(hsl.h,Math.min(.58,hsl.s+.08),Math.max(.31,hsl.l+.12));
    familyMat.roughness=.36;familyMat.envMapIntensity=1.35;familyMat.name='actor-beast-wet-chitin';
  }
  const addPresentation=(boneId,geo,offset,scale=[1,1,1],rot=[0,0,0],label='form',material=familyMat)=>{const bi=index.get(boneId);if(bi===undefined)return;const mesh=new THREE.Mesh(geo,material);mesh.name=`actor-family-form:${artFamily}:${label}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));const local=new THREE.Matrix4().compose(new THREE.Vector3(...offset),q,new THREE.Vector3(...scale));group.add(mesh);presentation.push({bi,mesh,local});};
  if(artFamily==='beast'){
    // A complete quadruped presentation, not an ornament around the humanoid skin. The combat
    // rig remains the one authority for pose and sockets; its arm chain drives the forelegs and
    // its leg chain drives the haunches. Local fore/aft offsets reinterpret those chains into a
    // low four-point stance while every segment still follows the evaluated animation.
    // The skeleton has spine_00/spine_02 (never spine_01). The former version attached the
    // thorax to that nonexistent id, silently deleting the creature's defining horizontal
    // mass and leaving a shiny pelvis with humanoid limbs. Keep the load-bearing volumes on
    // real trunk bones and deliberately lower the head from the biped rest pose.
    const slitherBody=tubePath([[0,.00,-.88],[-.07,.03,-.56],[.04,.06,-.16],[-.05,.05,.25],[.03,.02,.62],[0,-.02,.90]],.24,40,12);
    addPresentation('spine_00',slitherBody,[0,-.11,.04],[1.12,.82,1],[0,0,0],'continuous-slither-body');
    addPresentation('spine_00',new THREE.SphereGeometry(.27,16,10),[0,-.11,.38],[1.08,.74,1.16],[0,0,0],'shoulder-mass');
    addPresentation('spine_00',tubePath([[0,0,.38],[0,-.01,.62],[0,-.05,.83]],.145,18,10),[0,-.12,.02],[1,.90,1],[0,0,0],'neck');
    addPresentation('spine_00',new THREE.DodecahedronGeometry(.21,2),[0,-.17,.96],[1.08,.76,1.34],[0,0,0],'skull');
    addPresentation('spine_00',new THREE.ConeGeometry(.115,.40,10),[0,-.20,1.22],[1,.70,1],[Math.PI/2,0,0],'muzzle');
    const eyeMat=mats.bone.clone();eyeMat.color.setHex(0xd3b957);eyeMat.emissive.setHex(0x5a3108);eyeMat.emissiveIntensity=.7;
    for(const sx of [-1,1])addPresentation('spine_00',new THREE.SphereGeometry(.030,10,7),[sx*.110,-.12,1.14],[1,.72,.58],[0,0,0],`eye-${sx<0?'l':'r'}`,eyeMat);
    for(const sx of [-1,1]){
      addPresentation('spine_00',new THREE.ConeGeometry(.026,.13,6),[sx*.065,-.30,1.37],[1,1,1],[Math.PI/2,0,sx*.08],`fang-${sx<0?'l':'r'}`,mats.bone);
      // Short splayed legs stay on the trunk frame. This creature's authored locomotion is a
      // slither with stabilising feet; humanoid arm animation no longer turns forelegs into
      // waving antlers during attacks.
      addPresentation('spine_00',new THREE.CapsuleGeometry(.075,.26,5,9),[sx*.26,-.27,.38],[1,1,.82],[0,0,sx*.52],`foreleg-${sx<0?'l':'r'}`);
      addPresentation('spine_00',new THREE.SphereGeometry(.085,10,7),[sx*.38,-.43,.42],[1.45,.48,1.18],[0,0,0],`foreclaw-${sx<0?'l':'r'}`);
      addPresentation('spine_00',new THREE.CapsuleGeometry(.090,.30,5,10),[sx*.28,-.25,-.46],[1,1,.88],[0,0,sx*.48],`hindleg-${sx<0?'l':'r'}`);
      addPresentation('spine_00',new THREE.SphereGeometry(.10,10,7),[sx*.41,-.44,-.48],[1.48,.50,1.24],[0,0,0],`hindclaw-${sx<0?'l':'r'}`);
    }
    for(let i=0;i<7;i++)addPresentation('spine_00',new THREE.ConeGeometry(.060-i*.005,.22-i*.014,7),[0,.12,-.48+i*.18],[1,1,1],[-Math.PI/2-.18,0,0],`dorsal-${i}`);
  }else if(artFamily==='undead'){
    // Use the declared upper-spine bone. A typo to spine_01 previously suppressed every rib,
    // making this family merely a brown humanoid. The staggered open arcs, sternum, exposed
    // long bones and faceted jaw now survive every animation while retaining a broken rhythm.
    for(let i=0;i<6;i++) addPresentation('spine_02',new THREE.TorusGeometry(.155+i*.010,.016,6,14,Math.PI*1.58),[0,.135-i*.064,.025],[1,1,.70],[Math.PI/2,0,(i%2?-.13:.13)],`rib-${i}`);
    addPresentation('spine_02',new THREE.BoxGeometry(.035,.34,.035),[0,-.015,.105],[1,1,1],[.10,0,.05],'sternum');
    addPresentation('head',new THREE.DodecahedronGeometry(.13,1),[0,.07,.02],[.88,1.08,.86],[0,0,.12],'skull');
    addPresentation('head',new THREE.BoxGeometry(.115,.055,.10),[0,-.035,.035],[1,1,1],[.08,0,-.08],'jaw');
    for(const side of ['l','r']){
      addPresentation(`upperarm_${side}`,new THREE.CapsuleGeometry(.026,.25,4,8),[0,-.13,.012],[1,1,1],[0,0,side==='l'?.08:-.08],`humerus-${side}`);
      addPresentation(`lowerarm_${side}`,new THREE.CapsuleGeometry(.021,.23,4,8),[0,-.12,.015],[1,1,1],[0,0,side==='l'?-.08:.08],`radius-${side}`);
    }
  }else if(artFamily==='saxhleel'){
    const eyeMat=(mats.bone||mats.metal).clone();eyeMat.color.setHex(0xe2c46c);eyeMat.emissive?.setHex(0x352006);eyeMat.emissiveIntensity=.45;
    const pupilMat=mats.darkStone.clone();pupilMat.color.setHex(0x090b08);
    addPresentation('head',new THREE.SphereGeometry(.026,10,7),[-.052,.09,.112],[1,.72,.58],[0,0,0],'eye-l',eyeMat);
    addPresentation('head',new THREE.SphereGeometry(.026,10,7),[ .052,.09,.112],[1,.72,.58],[0,0,0],'eye-r',eyeMat);
    addPresentation('head',new THREE.SphereGeometry(.010,8,5),[-.052,.09,.132],[.62,1,.40],[0,0,0],'pupil-l',pupilMat);
    addPresentation('head',new THREE.SphereGeometry(.010,8,5),[ .052,.09,.132],[.62,1,.40],[0,0,0],'pupil-r',pupilMat);
    for(const s of [-1,1]) addPresentation('head',new THREE.ConeGeometry(.045,.16,7),[s*.055,.18,-.055],[1,1,1],[-.30,0,s*.10],`brow-horn-${s<0?'l':'r'}`);
    for(let i=0;i<4;i++) addPresentation('spine_02',new THREE.ConeGeometry(.045-i*.006,.16-i*.018,6),[0,.12-i*.13,-.16-i*.11],[1,1,1],[-Math.PI/2-.18,0,0],`spine-scale-${i}`);
    for(const s of [-1,1]) addPresentation(s<0?'upperarm_l':'upperarm_r',new THREE.SphereGeometry(.10,10,5,0,Math.PI*2,0,Math.PI*.58),[0,.02,0],[1.15,.58,1],[0,0,s*.16],'shoulder-scale');
  }else{
    // Civilian clothing needs the same shoulder/chest/waist hierarchy as armour. The old
    // horizontally compressed capsule made every unarmoured NPC read as an egg with limbs,
    // especially in the room census. This lighter tailored shell remains distinct from an
    // equipment chest piece while following the evaluated spine bone in every action.
    addPresentation('spine_02',torsoShellGeometry('reed'),[0,-.045,-.014],[1.05,1.08,1.02],[0,0,0],'tailored-tunic');
    addPresentation('head',new THREE.SphereGeometry(.12,12,8,0,Math.PI*2,0,Math.PI*.48),[0,.13,-.015],[1,1,.9],[0,0,0],'hair-cap');
  }

  return { group, bones, index, skeleton, meshes, rootBone, restWorld, waterU, secondary, secondaryMat: frillMat, equipment, equipmentMat:equipMat, presentation };
}

/** Closed elliptical ring shell used by all three equipment families. The profile creates a
 * shoulder/chest/waist hierarchy instead of wrapping the torso in a cylinder or box. */
function torsoShellGeometry(kind='reed') {
  const profiles={
    reed:[[-.22,.14,.10],[-.14,.17,.12],[.01,.192,.128],[.13,.202,.132],[.21,.158,.108]],
    chitin:[[-.23,.15,.11],[-.14,.181,.132],[.02,.205,.145],[.14,.218,.150],[.22,.168,.12]],
    xanmeer:[[-.24,.16,.12],[-.14,.195,.145],[.03,.222,.16],[.16,.232,.168],[.23,.18,.13]],
  };
  const rings=profiles[kind]||profiles.reed,radial=18,pos=[],nrm=[],uv=[],idx=[];
  for(let r=0;r<rings.length;r++){
    const [y,rx,rz]=rings[r];
    for(let i=0;i<radial;i++){
      const a=i/radial*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      pos.push(c*rx,y,s*rz);const n=new THREE.Vector3(c/rx,0,s/rz).normalize();nrm.push(n.x,n.y,n.z);uv.push(i/radial,r/(rings.length-1));
    }
  }
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<radial;i++){
    const q=(i+1)%radial,A=r*radial+i,B=r*radial+q,C=(r+1)*radial+i,D=(r+1)*radial+q;idx.push(A,C,B,B,C,D);
  }
  // cap with separate centres, preventing a visible hollow at neck and waist in extreme poses
  for(const [r,flip] of [[0,true],[rings.length-1,false]]){
    const centre=pos.length/3,[y]=rings[r];pos.push(0,y,0);nrm.push(0,flip?-1:1,0);uv.push(.5,.5);
    for(let i=0;i<radial;i++){const q=(i+1)%radial;if(flip)idx.push(centre,r*radial+q,r*radial+i);else idx.push(centre,r*radial+i,r*radial+q);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
}

function taperedGuardGeometry(top=.105,bottom=.078,length=.30,depth=.78,radial=12){
  const g=new THREE.CylinderGeometry(bottom,top,length,radial,2,false);g.scale(1,1,depth);return g;
}

/** Closed, tapered garment/armour tab.  The old one-sided plane vanished edge-on and read as a
 * floating rectangular UI plate when front-lit.  This shallow wedge keeps a textile thickness
 * and narrows toward the knees, while remaining rigidly attached to the pelvis socket. */
function garmentTabGeometry(width=.22,height=.38,depth=.025){
  const w=width/2,t=width*.34,y0=height/2,y1=-height/2,z=depth/2;
  const p=[-w,y0,-z,w,y0,-z,t,y1,-z,-t,y1,-z,-w,y0,z,w,y0,z,t,y1,z,-t,y1,z];
  const i=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(i);g.computeVertexNormals();return g;
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

/** A faceted, tapered blade with a raised medial ridge. Unlike a scaled box this preserves a
 * readable point, edge and cross-section in silhouette and in specular light. */
function blade(width, length, thickness, y, curve = 0) {
  const hw=width*.5, ht=thickness*.5, y0=y+length*.5, y1=y-length*.5;
  const p=[-hw,y0,-ht, hw,y0,-ht, hw,y0,ht, -hw,y0,ht,
    -hw*.72,y1+length*.12,-ht*.35, hw*.72,y1+length*.12,-ht*.35,
    hw*.72,y1+length*.12,ht*.35, -hw*.72,y1+length*.12,ht*.35,
    curve,y1,0];
  const f=[0,1,2,0,2,3, 0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0,
    4,8,5,5,8,6,6,8,7,7,8,4];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(f);g.computeVertexNormals();return g;
}

/** One continuous swept blade for sickles/falxes. Each ring follows the curved centreline, so
 * no animation or camera angle can expose the detached boxes used by the old approximation. */
function curvedBlade(width,length,thickness,haftTop,curve=.20){
  const rings=12,pos=[],idx=[];
  for(let r=0;r<rings;r++){
    const t=r/(rings-1), taper=Math.max(.06,1-t*.82), cy=haftTop-length*t;
    const cz=length*curve*t*t, hw=width*.5*taper, ht=thickness*.5*taper;
    pos.push(-hw,cy,cz-ht, hw,cy,cz-ht, hw,cy,cz+ht, -hw,cy,cz+ht);
  }
  for(let r=0;r<rings-1;r++)for(let i=0;i<4;i++){
    const q=(i+1)%4,A=r*4+i,B=r*4+q,C=(r+1)*4+i,D=(r+1)*4+q;idx.push(A,C,B,B,C,D);
  }
  idx.push(0,2,1,0,3,2);const e=(rings-1)*4;idx.push(e,e+1,e+2,e,e+2,e+3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

/** An axe/halberd bit extruded across X. The irregular YZ profile gives it a heel, convex edge
 * and narrow eye instead of scaling a box until it obscures the wielder. */
function axeBit(height,reach,thickness,centreY,halberd=false){
  const h=height*.5,r=reach, yz=halberd
    ? [[h*.72,-r*.16],[h,r*.32],[h*.38,r],[-h*.62,r*.76],[-h,-r*.02],[-h*.28,-r*.18]]
    : [[h*.72,-r*.15],[h,r*.30],[h*.58,r*.92],[-h*.52,r],[-h,r*.36],[-h*.44,-r*.16]];
  const pos=[],idx=[],n=yz.length;
  for(const x of [-thickness*.5,thickness*.5])for(const [y,z] of yz)pos.push(x,centreY+y,z);
  for(let i=1;i<n-1;i++){idx.push(0,i+1,i,n,n+i,n+i+1);}
  for(let i=0;i<n;i++){const q=(i+1)%n;idx.push(i,q,n+i,q,n+q,n+i);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

function tubePath(points,radius,segments=18,radial=7){
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,radial,false);
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
      metal.push(blade(R * 1.35, span, R * 0.46, tip + span / 2));
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
      const wide = cls === 'CGS' ? R * 1.5 : R * 1.05;
      metal.push(curvedBlade(wide,span,R*.28,haftTop,cls==='CGS'?.235:.19));
      metal.push(box(R * (cls === 'CGS' ? 4.2 : 3.0), 0.035, R * 0.8, haftTop));
      break;
    }
    case 'TSW':                                     // thrusting: narrow, long, a swept guard
      metal.push(blade(R * 0.72, span, R * 0.34, tip + span / 2));
      metal.push(box(R * 2.2, 0.030, R * 2.2, haftTop));
      metal.push(box(R * 0.30, 0.16, R * 2.0, haftTop + 0.08));
      break;
    case 'SSW': case 'GSW': case 'UGS': {
      const wide = cls === 'UGS' ? R * 1.9 : cls === 'GSW' ? R * 1.5 : R * 1.0;
      metal.push(blade(wide, span, R * 0.34, tip + span / 2));
      metal.push(box(wide * 0.22, span * 0.82, R * 0.40, tip + span * 0.47)); // medial ridge
      metal.push(box(wide * 3.0, 0.042, R * 0.9, haftTop));                 // crossguard
      metal.push(box(R * 0.9, 0.06, R * 0.9, 0.075));                       // pommel
      break;
    }
    case 'SPR':                                     // long haft, small leaf head at the tip
      if (haftLen > 0) wood.push(box(R * 0.7, haftLen, R * 0.7, haftTop + haftLen / 2));
      metal.push(blade(R * 2.0, span * 0.55, R * 0.42, tip + span * 0.28));
      metal.push(box(R * 0.8, span * 0.5, R * 0.5, tip + span * 0.72));
      break;
    case 'WHP': {                                   // a segmented cord: span is nearly all of it
      if (haftLen > 0) wood.push(box(R * 0.9, haftLen, R * 0.9, haftTop + haftLen / 2));
      metal.push(tubePath([[0,haftTop,0],[0,haftTop-span*.28,span*.045],[0,haftTop-span*.66,span*.135],[0,tip,span*.035]],R*.24,24,6));
      // Weighted thorn at the live end keeps the class readable when the cord foreshortens.
      const thorn=new THREE.ConeGeometry(R*.66,Math.max(.12,span*.10),7);thorn.translate(0,tip-span*.04,span*.035);metal.push(thorn);
      break;
    }
    case 'AXE': case 'HLB': {
      if (haftLen > 0) wood.push(box(R * 0.62, haftLen, R * 0.62, haftTop + haftLen / 2));
      // the bit hangs off ONE side of the haft — the asymmetry is the class's silhouette
      const bitH = cls === 'HLB' ? span * 0.42 : span * 0.86;
      const bitY = cls === 'HLB' ? tip + span * 0.62 : tip + span * 0.48;
      metal.push(axeBit(bitH,R*(cls==='HLB'?3.0:3.35),R*.55,bitY,cls==='HLB'));
      if (cls === 'HLB') {
        metal.push(box(R * 0.55, span * 0.55, R * 0.55, tip + span * 0.24));   // top spike
        const fluke=new THREE.ConeGeometry(R*.72,R*2.4,6);fluke.rotateX(Math.PI/2);fluke.translate(0,bitY,-R*1.15);metal.push(fluke);
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
      const limb=L*.5,curve=R*2.8;
      wood.push(tubePath([[0,limb,0],[0,limb*.53,curve],[0,0,curve*.45],[0,-limb*.53,curve],[0,-limb,0]],R*.38,28,7));
      metal.push(tubePath([[0,limb,0],[0,0,-R*.36],[0,-limb,0]],Math.max(.005,R*.085),18,5));
      // Nock collars and wrapped grip give highlights to the otherwise dark wooden profile.
      for(const y of [-limb*.90,0,limb*.90]){const ring=new THREE.TorusGeometry(R*(y===0?.66:.48),R*.10,5,9);ring.rotateX(Math.PI/2);ring.translate(0,y,y===0?curve*.45:curve*.18);metal.push(ring);}
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

/** Authored body for the resolved offhand taxonomy. A shield participates in combat resolution
 * as both a verb and a material surface; without this body, guard was only an arm pose. */
function shieldMesh(id,row,mats){
  const cls=String(row&&row.class||'medium'),great=cls==='great'||cls==='greatshield',small=cls==='small'||cls==='buckler';
  const w=great?.86:small?.46:.68,h=great?1.42:small?.54:1.02,d=great?.085:.060;
  const shape=new THREE.Shape();shape.moveTo(0,h*.52);shape.lineTo(w*.48,h*.34);shape.lineTo(w*.44,-h*.23);shape.lineTo(0,-h*.52);shape.lineTo(-w*.44,-h*.23);shape.lineTo(-w*.48,h*.34);shape.closePath();
  const boardGeo=new THREE.ExtrudeGeometry(shape,{depth:d,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.018});boardGeo.translate(0,-h*.12,-d*.5);
  const g=new THREE.Group();g.name=`actor-shield:${id||cls}`;g.matrixAutoUpdate=false;
  const board=new THREE.Mesh(boardGeo,great?mats.darkStone:mats.bark);board.castShadow=true;board.receiveShadow=true;g.add(board);
  const boss=new THREE.Mesh(new THREE.SphereGeometry(small?.13:.16,14,8,0,Math.PI*2,0,Math.PI*.52),mats.metal);boss.scale.z=.45;boss.position.set(0,0,d*.66);boss.castShadow=true;g.add(boss);
  for(const sx of [-1,1]){const rib=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,h*.72,7),mats.metal);rib.position.set(sx*w*.32,-h*.05,d*.62);rib.rotation.z=sx*.13;rib.castShadow=true;g.add(rib);}
  const cross=new THREE.Mesh(new THREE.CylinderGeometry(.018,.024,w*.68,7),mats.metal);cross.position.set(0,h*.25,d*.62);cross.rotation.z=Math.PI/2;cross.castShadow=true;g.add(cross);
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
  const sourceMat=artFamily==='beast' && mats.wet_chitin ? mats.wet_chitin : mats.bark;
  let byFamily=_directionMaterialCache.get(sourceMat);if(!byFamily){byFamily=new Map();_directionMaterialCache.set(sourceMat,byFamily);}
  let directionMat=byFamily.get(artFamily);
  if(!directionMat){directionMat=new THREE.MeshStandardMaterial({color:art.colour,roughness:art.roughness,
    metalness:artFamily==='beast'?.16:0,bumpMap:sourceMat.bumpMap,bumpScale:sourceMat.bumpScale,
    aoMap:sourceMat.aoMap,aoMapIntensity:sourceMat.aoMapIntensity,envMapIntensity:sourceMat.envMapIntensity});
    directionMat.name=`visual-family:${sourceMat.userData.visualFamily||'bark'}:creature-accent`;
    directionMat.userData={...sourceMat.userData,visualFamily:sourceMat.userData.visualFamily||'bark'};byFamily.set(artFamily,directionMat);}
  // This marker group deliberately carries no geometry. The previous species accents lived
  // here at actor level, so head horns stayed behind while the evaluated head turned and every
  // beast/undead ornament had the same defect. All visible family forms now live in
  // `buildSkeleton().presentation` and consume a live bone matrix each rendered frame.
  direction.scale.set(...art.scale); g.add(direction);
  // Contact grounding and action readability are renderer-owned presentation. They never feed
  // back into the fixed-step rig, sockets, hit windows or camera.
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,20),new THREE.MeshBasicMaterial({color:0x080b09,transparent:true,opacity:.34,depthWrite:false}));
  shadow.name='actor-contact-shadow'; shadow.rotation.x=-Math.PI/2; shadow.renderOrder=2; g.add(shadow);
  const action=new THREE.Mesh(new THREE.TorusGeometry(.48,.014,5,36,Math.PI*1.18),new THREE.MeshBasicMaterial({color:0xd6a65f,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  action.name='actor-action-silhouette'; action.rotation.x=Math.PI/2; action.visible=false; g.add(action);
  g.userData.actor = { built: null, mats, tintHex, skinHex, weapon: null, weaponKey: null, rigged: false, shadow, action, direction, artFamily, art };
  g.userData.worldArt={creature:artFamily,silhouette:art.silhouette,visibleConsumer:`actor-family-form:${artFamily}`};
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
    A.built = buildSkeleton(rig, A.mats, A.tintHex, A.skinHex, A.artFamily);
    group.add(A.built.group);
  }
  const S = A.built;
  const creatureOnly=A.artFamily==='beast';
  // The beast's presentation is its entire authored skin. Showing the shared humanoid surface
  // beneath it is the exact "humanoid wearing creature accents" defect this body plan replaces.
  for(const mesh of S.meshes||[])mesh.visible=!creatureOnly;
  const root=body.rig.world[0], groundY=(body.pos&&body.pos[1])||0;
  if(A.direction&&root) A.direction.position.set(root[9],groundY,root[11]);
  if(A.shadow&&root){ const air=Math.max(0,root[10]-groundY); A.shadow.position.set(root[9],groundY+.018,root[11]); A.shadow.scale.setScalar(Math.max(.42,1-air*.22)); A.shadow.material.opacity=Math.max(.08,.34-air*.12); }
  if(A.action&&root){
    // This is an understated weapon-motion accent, not a state/debug indicator. In review
    // clips the old bright green ring wrapped around rolls, blocks and hit reactions and read
    // as prototype UI embedded in the world. Only a live damaging window now earns the arc.
    const attacking=!!body.move && !!body.hitboxActive;
    A.action.visible=attacking; A.action.material.opacity=attacking ? .16 : 0;
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
  // Never pin an airborne foot to the terrain. That made the torso rise while both legs
  // stretched back to ground through the whole jump, destroying the jump/fall silhouette.
  if (!body.airborne && water && typeof water.groundAt === 'function') {
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
      seg.mesh.visible=A.artFamily==='saxhleel';
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

  if(S.equipment){const set=Number(body.equipLoadPct||0)<30?'reed':Number(body.equipLoadPct||0)<70?'chitin':'xanmeer';for(const p of S.equipment){p.mesh.visible=!creatureOnly&&p.set===set;if(!p.mesh.visible)continue;const s=rig.world[p.bi],e=p.mesh.matrix.elements;e[0]=s[0];e[1]=s[3];e[2]=s[6];e[3]=0;e[4]=s[1];e[5]=s[4];e[6]=s[7];e[7]=0;e[8]=s[2];e[9]=s[5];e[10]=s[8];e[11]=0;e[12]=s[9];e[13]=s[10];e[14]=s[11];e[15]=1;p.mesh.matrix.multiply(p.local);p.mesh.matrixWorld.copy(p.mesh.matrix);p.mesh.matrixWorldNeedsUpdate=false;}}
  if(S.presentation){for(const p of S.presentation){const s=rig.world[p.bi],e=p.mesh.matrix.elements;e[0]=s[0];e[1]=s[3];e[2]=s[6];e[3]=0;e[4]=s[1];e[5]=s[4];e[6]=s[7];e[7]=0;e[8]=s[2];e[9]=s[5];e[10]=s[8];e[11]=0;e[12]=s[9];e[13]=s[10];e[14]=s[11];e[15]=1;p.mesh.matrix.multiply(p.local);p.mesh.matrixWorld.copy(p.mesh.matrix);p.mesh.matrixWorldNeedsUpdate=false;}}

  // Offhand surface follows the evaluated left hand in every gait, guard, reaction and swap.
  const shieldVisible=!creatureOnly&&!!body.shield&&!body.twoHanded&&body.offhandKind!=='weapon'&&body.offhandKind!=='catalyst';
  const shieldKey=shieldVisible?`${body.shieldId||'shield'}|${body.shield.class||'medium'}`:null;
  if(shieldKey!==A.shieldKey){if(A.shield)group.remove(A.shield);A.shield=shieldVisible?shieldMesh(body.shieldId,body.shield,A.mats):null;A.shieldKey=shieldKey;if(A.shield)group.add(A.shield);}
  if(A.shield){
    const li=rig.index.get('hand_l'),hm=li===undefined?null:rig.world[li];
    if(hm){const e=A.shield.matrix.elements;e[0]=hm[0];e[1]=hm[3];e[2]=hm[6];e[3]=0;e[4]=hm[1];e[5]=hm[4];e[6]=hm[7];e[7]=0;e[8]=hm[2];e[9]=hm[5];e[10]=hm[8];e[11]=0;e[12]=hm[9];e[13]=hm[10]-.12;e[14]=hm[11]+.08;e[15]=1;A.shield.matrixWorld.copy(A.shield.matrix);A.shield.matrixWorldNeedsUpdate=false;for(const c of A.shield.children){c.updateMatrix();c.matrixWorld.multiplyMatrices(A.shield.matrixWorld,c.matrix);c.matrixWorldNeedsUpdate=false;}A.shield.visible=true;}else A.shield.visible=false;
  }

  // ---- the weapon ----------------------------------------------------------------------
  const w = (body.moves && body.moves._weapon) || null;
  if (w && !creatureOnly) {
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
    A.built = buildSkeleton(rigDefSource, A.mats, A.tintHex, A.skinHex, A.artFamily);
    group.add(A.built.group);
  }
  if (A.rigged) return false;                 // already world-driven; do not fight it
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.y = (yawDeg * Math.PI) / 180;
  // Non-combat people use the rig's authored rest pose, but their equipment/species forms are
  // separate bone-bound presentation meshes. Previously only poseFromRig() evaluated those
  // bindings: a static NPC left every helmet, shoulder shell, horn and garment at actor origin,
  // stacking them into the giant bulbous silhouettes visible in populated interiors. Bind once
  // against the stored actor-local rest matrices; the outer group still supplies position/yaw.
  if (!A.staticPresentationBound) {
    const S=A.built;
    const apply=(item)=>{
      const bone=S.restWorld&&S.restWorld[item.bi];if(!bone)return;
      item.mesh.matrix.copy(bone).multiply(item.local);
      item.mesh.matrixWorldNeedsUpdate=true;
    };
    // Civilians have no combat equip-load field. Give them the light reed set and explicitly
    // suppress the other two authored sets; leaving all three visible stacked three helmets,
    // three breastplates and three greaves on every NPC even after their sockets were fixed.
    for(const item of S.equipment||[]){item.mesh.visible=!A.civilian&&item.set==='reed';apply(item);}
    for(const item of S.presentation||[])apply(item);
    const spineI=S.index.get('spine_02'),spine=spineI===undefined?null:S.restWorld[spineI];
    for(const item of S.secondary||[]){
      if(!spine)continue;
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
      const local=new THREE.Matrix4().compose(new THREE.Vector3(0,item.localY,item.localZ),q,new THREE.Vector3(1,1,1));
      item.mesh.matrix.copy(spine).multiply(local);item.mesh.matrixWorldNeedsUpdate=true;
    }
    A.staticPresentationBound=true;
  }
  return true;
}
