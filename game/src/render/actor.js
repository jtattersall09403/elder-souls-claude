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
import { registerRig, registerCharacter, character, charactersOf, resolveMorph, variantKey, SKELETON_ID }
  from './lib/rigs.js';

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

/**
 * `esCurvature` — MATERIAL_API.md §6a, which is a direct request to this file.
 *
 * W1-30C measured its own `wearFrom: 'texture'` path at 3.4% edge/face separation against an 8%
 * bar and published the reason rather than tuning past it: *a normal map's rate of change is
 * grain, and the arris of a plank is a property of the mesh.* So the curvature has to come from
 * geometry, and this is where geometry is made.
 *
 * It is computed, not authored. Hand-tagging each builder ("the tube rim is an edge, the ball is
 * not") would drift the moment somebody adds a shape, and it would encode an opinion rather than
 * the definition. This reads the definition literally: an edge shared by two faces whose normals
 * differ by more than `thresholdDeg` is an arris and scores 1; a face interior scores 0; a
 * boundary edge (an open rim) is an arris too. One smoothing pass spreads it a vertex inward so
 * the band has width at any texel density.
 *
 * Positions are quantised to 0.1 mm before pairing, so vertices split for UV or skin-weight
 * reasons still count as one point — otherwise every seam in a welded body reads as a boundary
 * and the whole character wears at once.
 */
export function bakeCurvature(geometry, thresholdDeg = 35) {
  const pos = geometry.attributes.position, idx = geometry.index;
  if (!pos || !idx) return geometry;
  const n = pos.count;
  const key = new Int32Array(n);
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let id = map.get(k);
    if (id === undefined) { id = map.size; map.set(k, id); }
    key[i] = id;
  }
  const faceN = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), u = new THREE.Vector3(), v2 = new THREE.Vector3();
  const edges = new Map();
  const tri = idx.array, tcount = idx.count / 3;
  for (let f = 0; f < tcount; f++) {
    const i0 = tri[f * 3], i1 = tri[f * 3 + 1], i2 = tri[f * 3 + 2];
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    u.subVectors(b, a); v2.subVectors(c, a);
    const nv = new THREE.Vector3().crossVectors(u, v2);
    if (nv.lengthSq() > 1e-20) nv.normalize();
    faceN.push(nv);
    for (const [x, y] of [[i0, i1], [i1, i2], [i2, i0]]) {
      const p = key[x], q = key[y], ek = p < q ? `${p}_${q}` : `${q}_${p}`;
      let e = edges.get(ek);
      if (!e) { e = { f: [], v: [x, y] }; edges.set(ek, e); }
      e.f.push(f);
    }
  }
  const cur = new Float32Array(n);
  const cosT = Math.cos((thresholdDeg * Math.PI) / 180);
  for (const e of edges.values()) {
    let sharp = 0;
    if (e.f.length === 1) sharp = 1;                                  // an open rim is an arris
    else {
      for (let i = 1; i < e.f.length; i++) {
        const d = faceN[e.f[0]].dot(faceN[e.f[i]]);
        if (d < cosT) sharp = Math.max(sharp, Math.min(1, (cosT - d) / (cosT + 1)));
      }
    }
    if (sharp <= 0) continue;
    for (let i = 0; i < n; i++) if (key[i] === key[e.v[0]] || key[i] === key[e.v[1]]) cur[i] = Math.max(cur[i], sharp);
  }
  // One outward smoothing pass, at half amplitude: the wear band should have width, not be a
  // one-vertex line that disappears the moment the mesh is decimated for LOD1.
  const soft = new Float32Array(cur);
  for (let f = 0; f < tcount; f++) {
    const i0 = tri[f * 3], i1 = tri[f * 3 + 1], i2 = tri[f * 3 + 2];
    const m = Math.max(cur[i0], cur[i1], cur[i2]) * 0.5;
    if (soft[i0] < m) soft[i0] = m;
    if (soft[i1] < m) soft[i1] = m;
    if (soft[i2] < m) soft[i2] = m;
  }
  geometry.setAttribute('esCurvature', new THREE.Float32BufferAttribute(soft, 1));
  return geometry;
}

/**
 * THE TRIANGLE WINDING OF EVERY PRIMITIVE IN THIS CLASS WAS INVERTED, AND IT DREW THE WHOLE BODY.
 *
 * Found 2026-08-15 by `tools/visual/mesh-winding.mjs`, after the owner passed on a diagnosis
 * another agent reached on a different Three.js project with the same symptom. Measured on the
 * shipped roster, 13 subjects, before the fix:
 *
 *     actor-body:<family>:skin    13 of 13 meshes  signed volume NEGATIVE   102,708 / 109,792
 *                                                                           triangles whose
 *                                                                           authored normal
 *                                                                           disagrees with winding
 *     actor-body:<family>:cloth   13 of 13 meshes  signed volume NEGATIVE    49,088 /  51,896
 *
 * Three.js's own `SphereGeometry` measures +1.075e-1 on the same instrument; ours measured the
 * same magnitude NEGATIVE. That comparison is what makes this a fact rather than an argument about
 * conventions: our generator disagreed with the engine's own geometry.
 *
 * WHAT IT LOOKED LIKE, and why five rounds of hole-filling never touched it. With `FrontSide`
 * (the default, and what every actor material uses — no mesh here is `DoubleSide`), WebGL culls
 * back faces by SCREEN-SPACE winding. Inverted winding means the near surface of the body is
 * classified as back-facing and culled, and the far surface — the inside of the character's back —
 * is what gets drawn. That is exactly the "you can see through the character" report. It is not a
 * hole, so a gap-pixel census counts it as one and filling holes cannot fix it; this project closed
 * five real geometric gaps (9,254 -> 2,204 px) and the characters still looked wrong, because this
 * was underneath all of it.
 *
 * AND IT BROKE THE SHADING, WHICH IS THE OTHER HALF. The authored vertex normals were always
 * correct — `vert()` is handed an outward normal by every call site — so with the far surface
 * drawn, 94% of the visible body was lit by a normal pointing away from the camera. Forms cannot
 * read as forms under an inverted normal: this is a direct contributor to the critic's finding #1,
 * "the shoulders are two glossy ellipsoids stuck to the sides of a flat rectangular torso plate".
 *
 * THE DEFECT WAS IN THE SIDE WALLS ONLY. `tube()`'s two end caps were always wound correctly, which
 * is why the disagreement was 94% and not 100% — one mesh carried both conventions at once. Derived
 * by hand and confirmed by the instrument: for `tube`, the surface frame (_u, _v, _w) is
 * right-handed with _u the outward radial, so the old order `A, C, B` gave a face normal of
 * `_w x _v = -_u`, i.e. inward.
 *
 * THE GUARD. `node tools/visual/mesh-winding.mjs` runs over the roster and exits non-zero on any
 * mesh with negative signed volume or any triangle whose authored normal disagrees with its
 * winding; `--self-test` proves it goes red by reversing a correct sphere. Do not "fix" a future
 * winding complaint by setting a material to `DoubleSide` — that hides the culling symptom and
 * leaves the lighting inverted, which is the worse half.
 */
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
        // WINDING. This read `tri(A, C, B); tri(B, C, D)` and was INVERTED — see the class header.
        this.tri(A, B, C); this.tri(B, D, C);
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
        // WINDING. This read `tri(A, C, B); tri(B, C, D)` and was INVERTED — see the class header.
        this.tri(A, B, C); this.tri(B, D, C);
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
      // WINDING. This read `tri(A,C,B);tri(B,C,D)` and was INVERTED — see the class header.
      this.tri(A,B,C);this.tri(B,D,C);
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
    return bakeCurvature(g);
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
  // CHAIN, DO NOT ASSIGN. (W1-ORPHANED-SURFACE-SHADERS)  `mat` is a `.clone()` of a `worldMaterial()`, and since the
  // copy seam in `visual-foundation.js` that clone now arrives with its detail-normal / wear /
  // wetness pass rebuilt. Assigning over the top would delete it again — and the player's own body
  // is the most visible thing this file builds, so the fix would have been inert exactly where it
  // matters most. This is the same chain `installSurfaceShader` already does, for the same reason.
  const prior = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prior) prior(shader, renderer);
    shader.uniforms.uWaterY = sharedUniforms.uWaterY;
    // Renamed uWetness -> uWaterlineWetness (W1-F1-SHADER-COLLISION): `installSurfaceShader`
    // (visual-foundation.js) now chains onto the same preamble instead of being replaced, and it
    // declares its own `uniform float uWetness`. Two declarations of one name in one fragment
    // shader is a GLSL redefinition error — a fatal link failure, not a cosmetic clash — so this
    // hook's identifiers must be unique against every other hook it now coexists with, not merely
    // against itself. Same reasoning for `esWet`/`esBand`/`esMeniscus` below.
    shader.uniforms.uWaterlineWetness = sharedUniforms.uWetness;
    shader.vertexShader = 'varying float vEsWaterY;\n' + shader.vertexShader.replace(
      '#include <skinning_vertex>',
      '#include <skinning_vertex>\n\tvEsWaterY = transformed.y;',
    );
    shader.fragmentShader = 'varying float vEsWaterY;\nuniform float uWaterY;\nuniform float uWaterlineWetness;\n'
      + shader.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n'
          // `esWaterlineBand`: metres BELOW the waterline (positive = submerged). The meniscus
          // itself is a ~5 cm soft band either side of the line, per §1's own "hard and
          // hysteretic" boundary language for the GAMEPLAY band — the RENDERED line is
          // deliberately a hair softer than that so it does not shimmer at 60 Hz the way a
          // one-pixel hard edge would.
          + '\tfloat esWaterlineBand = uWaterY - vEsWaterY;\n'
          + '\tfloat esWaterlineWet = smoothstep(-0.06, 0.02, esWaterlineBand) * uWaterlineWetness;\n'
          + '\tfloat esWaterlineMeniscus = (1.0 - smoothstep(0.0, 0.05, abs(esWaterlineBand))) * uWaterlineWetness;\n')
        .replace('#include <color_fragment>', '#include <color_fragment>\n'
          + '\tdiffuseColor.rgb *= mix(1.0, 0.42, esWaterlineWet);\n'
          + '\tdiffuseColor.rgb += vec3(0.07, 0.10, 0.09) * esWaterlineMeniscus;\n')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n'
          // Wet skin/cloth reads shinier, dry the same roughness it always was — RI-WLD10 §10.2
          // forbids a full-screen blue filter, not a material response, and this is bounded to
          // the band the fragment is actually inside.
          + '\troughnessFactor = mix(roughnessFactor, roughnessFactor * 0.30, esWaterlineWet);\n');
  };
  // three.js's DEFAULT `customProgramCacheKey` reads `this.onBeforeCompile.toString()`, so calling
  // a prior key detached throws inside the renderer's program lookup — a boot failure, not a
  // visual one. Only chain a key the material actually OWNS. (W1-ORPHANED-SURFACE-SHADERS)
  const priorKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : null;
  mat.customProgramCacheKey = () => `es-waterline-v1:${priorKey ? priorKey() : ''}`;
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
  spine_00: { to: 'spine_02', r0: 0.178, r1: 0.218, mat: 'cloth', blend: 0.4 },
  // `r1` was 0.142 — a 2x step down into a 0.072 neck. That step is not a joint, it is a ledge,
  // and it is why the derived joint radius below would otherwise put a 28 cm collar at the throat.
  // The chest VOLUME is the ellipsoid emitted further down (0.228 x 0.20 x 0.142); this tube only
  // needs to carry the taper into the neck, so it now ends near the neck's own radius.
  spine_02: { to: 'neck', r0: 0.218, r1: 0.095, mat: 'cloth', blend: 0.4 },
  neck: { to: 'head', r0: 0.082, r1: 0.070, mat: 'skin', blend: 0.5 },
  clavicle_l: { to: 'upperarm_l', r0: 0.105, r1: 0.088, mat: 'cloth', blend: 0.5 },
  clavicle_r: { to: 'upperarm_r', r0: 0.105, r1: 0.088, mat: 'cloth', blend: 0.5 },
  upperarm_l: { to: 'lowerarm_l', r0: 0.094, r1: 0.075, mat: 'skin', blend: 0.45 },
  upperarm_r: { to: 'lowerarm_r', r0: 0.094, r1: 0.075, mat: 'skin', blend: 0.45 },
  lowerarm_l: { to: 'hand_l', r0: 0.075, r1: 0.058, mat: 'skin', blend: 0.45 },
  lowerarm_r: { to: 'hand_r', r0: 0.075, r1: 0.058, mat: 'skin', blend: 0.45 },
  thigh_l: { to: 'calf_l', r0: 0.126, r1: 0.098, mat: 'cloth', blend: 0.4 },
  thigh_r: { to: 'calf_r', r0: 0.126, r1: 0.098, mat: 'cloth', blend: 0.4 },
  calf_l: { to: 'foot_l', r0: 0.098, r1: 0.068, mat: 'cloth', blend: 0.4 },
  calf_r: { to: 'foot_r', r0: 0.098, r1: 0.068, mat: 'cloth', blend: 0.4 },
  // Leaf bones: no child to measure against, so these carry an authored local extent.
  hand_l: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },
  hand_r: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },
  foot_l: { local: [0, -0.045, 0.155], r0: 0.062, r1: 0.048, mat: 'skin', blend: 0 },
  foot_r: { local: [0, -0.045, 0.155], r0: 0.062, r1: 0.048, mat: 'skin', blend: 0 },
};

/**
 * Joint balls, so a bent elbow reads as a joint rather than two disconnected tubes.
 *
 * WHY THE RADIUS IS NOW DERIVED AND NOT AUTHORED — this is the transparency defect, and the
 * previous rule was the cause of it.
 *
 * The old table set every ball "a HAIR under its segment's radius at that end", to avoid a lumpy
 * string of beads. That reasoning is right about a ball that is *bigger than the limb* and wrong
 * about the one case that matters. Two tapered tubes meeting at a joint and bending through an
 * angle cover everything except a wedge on the OUTSIDE of the bend, and the size of that wedge is
 * set by the tube radii, not by the ball. A ball smaller than either tube cannot reach the wedge —
 * so the wedge is open, and you can see the sky through the character's shoulder. Measured, before
 * this change, by `tools/visual/actor-orbit-holes.mjs` on the shipping clip poses: 9,254 enclosed
 * background pixels across 5,760 orbit frames, 1,562 frames affected.
 *
 * The rule now: **a joint ball's radius is the LARGEST radius any segment has at that joint.**
 * That is the smallest sphere that can bridge the wedge, and it is tangent to the widest tube by
 * construction, so it cannot read as a bead — a bead is a ball *larger* than its limb, which this
 * can never be. It is computed from `PLAN` so a future radius edit cannot silently reopen the gap.
 */
function jointRadius(id) {
  let r = 0;
  const own = PLAN[id];
  if (own) r = Math.max(r, own.r0);
  for (const spec of Object.values(PLAN)) if (spec.to === id) r = Math.max(r, spec.r1);
  return r;
}

/** Which surface a joint belongs to, and nothing else — the radius is derived above. The ankle
 *  was simply missing from the old list, which is why `foot_*` appears in the crack tally. */
const JOINT_SURFACE = {
  upperarm_l: 'skin', upperarm_r: 'skin',
  lowerarm_l: 'skin', lowerarm_r: 'skin',
  hand_l: 'skin', hand_r: 'skin',
  neck: 'skin', head: 'skin',
  // The two spine nodes are deliberately absent. Their derived radius would be the 0.218 chest
  // tube, and a 0.218 sphere is wider than the chest ellipsoid is deep (0.142) — it would be a
  // barrel, not a joint. The trunk articulates by a few degrees and is already carried by two
  // overlapping ellipsoids; adding a ball there would trade a hole nobody has for a lump
  // everybody sees.
  thigh_l: 'cloth', thigh_r: 'cloth',
  calf_l: 'cloth', calf_r: 'cloth',
  foot_l: 'skin', foot_r: 'skin',
};

/**
 * Build the two skinned meshes (skin and cloth) plus the bone hierarchy, from a live `Rig`.
 *
 * The skeleton is read off `rig.def.bones` rather than re-imported from skeleton.json, so the
 * drawn character cannot be built against a different bone list than the fight is using — the
 * arrays are the same length, in the same order, by construction.
 */
function buildSkeleton(rig, mats, tintHex, skinHex, artFamily='saxhleel', morphSpec=null) {
  // The morph is the variant axis that has to REBUILD geometry rather than tint it, or "twelve
  // distinct characters" is twelve colours of one character. Every multiplier below lands on a
  // radius or an ornament dimension; none of them touches a bone offset, because a bone offset is
  // where the hurtboxes are (see `lib/rigs.js`'s header).
  const M = resolveMorph(morphSpec);
  const rScale = (r) => r * M.build;
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
    const k = /^clavicle/.test(id) ? M.shoulders : /^(pelvis|spine_00)$/.test(id) ? M.belly
      : id === 'neck' ? M.neck : /^hand_/.test(id) ? M.hand : 1;
    B[spec.mat].tube(a, b, rScale(spec.r0) * k, rScale(spec.r1) * k, bi, parent, spec.blend);
  }
  for (const [id, mat] of Object.entries(JOINT_SURFACE)) {
    const bi = index.get(id);
    if (bi === undefined) continue;
    // The joint ball must track the morph exactly, or a heavy build re-opens the wedge the derived
    // radius exists to close: a 1.15x limb against a 1.0x ball is the old defect with extra steps.
    const k = id === 'neck' ? M.neck : /^hand_/.test(id) ? M.hand : 1;
    const r = rScale(jointRadius(id)) * k;
    if (r <= 0) continue;
    B[mat].ball(originOf(id), r, bi, 10);
  }

  // Anatomical volumes bridge the mechanically useful skeleton tubes into a readable body.
  // They are emitted into the same sealed, skinned surfaces, so they cannot lag behind motion
  // or recreate the translucent-overlap defect that separate transparent shells produced.
  const pelvisI=index.get('pelvis');
  if(pelvisI!==undefined)B.cloth.ellipsoid(originOf('pelvis').add(new THREE.Vector3(0,.035,0)),[.185*M.build*M.belly,.13*M.build,.135*M.build*M.belly],pelvisI,12);
  const chestI=index.get('spine_02');
  if(chestI!==undefined)B.cloth.ellipsoid(originOf('spine_02').add(new THREE.Vector3(0,.025,0)),[.228*M.build*M.shoulders,.20*M.build,.142*M.build],chestI,14);

  // ---- the head ------------------------------------------------------------------------
  // This is Black Marsh and the player is Saxhleel, so the skull is long, the snout carries
  // forward off it, and a low crest runs back over the neck. Morrowind's own Argonian head is
  // the art-direction reference (corpus/70-visual/refs/morrowind/); the fidelity reference is
  // the modern set, which is why it is a shaped skull with a jaw rather than the sphere and
  // cone the previous actor used.
  // THE CANON OF PROPORTION, AND WHY IT IS A SCALE ON THE HEAD RATHER THAN ON ANYTHING ELSE.
  // `W1-F10-CHARACTERS` C1, measured over the 41 shipped figures: R = figure height / head height
  // ran 5.87-6.84 with a median of 6.58, and **0 of 41** sat inside RI-VIS10's 7.0-8.0 band. A
  // 6.5-head figure reads as stunted — it is one of the two numbers the critic says carries the
  // whole ART verdict, and it is visible before any texture or material is considered.
  //
  // Bone lengths are not available as a lever and that is deliberate, not an oversight:
  // `skeleton.json` declares the rest offsets `Rig.evaluate()` uses and `hitgeometry.json`
  // declares every hurtbox as a segment OF a bone, so lengthening a leg to raise R would move the
  // drawn body off the thing that can be hit. The head is the one end of the ratio that is pure
  // presentation. `HEAD_SCALE` is applied about the head bone's ORIGIN, so the jaw and crown move
  // toward the neck joint together and the neck reads longer — which is also what the ESO
  // Argonian plates show (`refs/context/ESO-argonian_character__steam-1634540211.jpg`: a small
  // skull on a long scaled neck, nothing like our previous head).
  //
  // The joint ball at `head` is deliberately NOT scaled with it. Its radius is derived from the
  // neck tube's own r1 precisely so it can bridge the wedge on the outside of a neck bend; shrink
  // it and the transparency defect that derivation exists to close reopens.
  // AND WHY IT IS SOLVED RATHER THAN A CONSTANT. A flat 0.80 moved the median from 6.58 to 7.43
  // but left 7 of 41 figures outside the band, and the residual was not noise — it tracked
  // `build`. The head's measured vertical extent is the skull ABOVE the head bone plus the neck
  // joint ball BELOW it, and that ball's radius is derived from the neck tube's r1 and therefore
  // scales with `build`. So a heavy character grew the lower half of its own head measurement
  // while the skull stayed put, and R fell; a slight character did the reverse. Compensating for
  // it is one line of algebra rather than seven hand-tuned numbers:
  //
  //     extent = 0.070 * build            (the joint ball, below the bone)
  //            + headTopLocal * hs        (the skull and crest, above it)
  //     hs     = (TARGET_EXTENT - 0.070 * build) / headTopLocal
  //
  // The crest enters through `headTopLocal` and only when it actually rises above the crown —
  // below M.crest ~1.03 the crest tubes finish under the skull ellipsoid and change nothing,
  // which is why a high-crest variant was low and a crestless one was not.
  //
  // THE DESIGN RULE THIS ENCODES, stated so it can be argued with: build and crest are ornament
  // axes. A character may be heavier, leaner or more crested than another; it may not thereby be
  // a different number of heads tall. The canon of proportion is held, and the variant axes vary
  // around it.
  const TARGET_EXTENT = 0.2443;   // metres. ~1.82 m figure / R 7.45, the centre of RI-VIS10's band.
  const headTopLocal = artFamily === 'saxhleel' ? Math.max(0.217, 0.150 + 0.065 * M.crest)
    : artFamily === 'humanoid' ? 0.212
      : artFamily === 'undead' ? 0.188 : 0.217;
  const headScale = artFamily === 'beast' ? 1
    : Math.max(0.55, Math.min(1.05, (TARGET_EXTENT - 0.070 * M.build) / headTopLocal)) * M.head;
  const hi = index.get('head');
  if (hi !== undefined) {
    const hm = restWorld[hi];
    const hs = headScale;
    const P = (x, y, z) => new THREE.Vector3(x * hs, y * hs, z * hs).applyMatrix4(hm);
    const S = (r) => r * hs;
    // THE FACE IS BUILT, NOT IMPLIED. RI-VIS10 B4 scored **1 of 7** landmarks and the critic's
    // word for the result was "a smooth blank"; §5.2 lists exactly what was missing — no brow
    // ridge, no orbit rim, no naris, no cheek-to-jaw line, no mandible line, no chin underside.
    // All seven are emitted below as real geometry into the same sealed skinned surface as the
    // rest of the body, so they cannot detach in a pose (that is what happened to the crest when
    // it was four floating cones) and they shade as form under a key light rather than as paint.
    // Read against `refs/context/ESO-argonian_character__steam-1362731834.jpg` opened side by
    // side: heavy supraorbital shelf, a raised bony rim around a small eye, nostril bosses on top
    // of the muzzle, a cheek line running back to the jaw angle, and a pale throat mass under the
    // mandible. RI-VIS08 refuses Morrowind references for characters (~1,000 triangles), so the
    // construction target is the modern plate; the art direction stays Black Marsh.
    if(artFamily==='saxhleel'){
      B.skin.ellipsoid(P(0,0.085,0.005),[S(.108),S(.132),S(.126)],hi,14);          // skull
      B.skin.tube(P(0, 0.070, 0.075), P(0, 0.028, 0.075+0.160*M.snout), S(0.085), S(0.047), hi, hi, 0, 10, 3); // snout
      B.skin.tube(P(0, 0.035, 0.065), P(0, 0.012, 0.065+0.140*M.snout), S(0.062), S(0.036), hi, hi, 0, 10, 3); // jaw
      for (let k = 0; k < 3 && M.crest > 0.01; k++) {
        const t = k / 3;
        B.skin.tube(P(0, 0.150 - t * 0.030, 0.030 - t * 0.075),
          P(0, 0.150 + (0.065 - t * 0.055) * M.crest, 0.030 - t * 0.075 - (0.040 + t * 0.090) * M.crest),
          S(0.030 * M.crest), S(0.008), hi, hi, 0, 7, 2);
      }
      for (const s of [-1, 1]) {
        // 1. brow ridge — the supraorbital shelf, heaviest landmark on the ESO plate
        B.skin.tube(P(s*.014,.146,.052), P(s*.090,.120,.086), S(.024), S(.013), hi, hi, 0, 7, 2);
        // 2. orbit rim — a raised bony ring around the socket, six arcs
        for (let k = 0; k < 6; k++) {
          const a0 = (k/6)*Math.PI*2, a1 = ((k+1)/6)*Math.PI*2, rr = .042;
          B.skin.tube(P(s*.052 + Math.cos(a0)*rr, .090 + Math.sin(a0)*rr, .100),
            P(s*.052 + Math.cos(a1)*rr, .090 + Math.sin(a1)*rr, .100), S(.009), S(.009), hi, hi, 0, 5, 1);
        }
        // 3. naris — nostril boss on the top of the muzzle, near the tip
        B.skin.ellipsoid(P(s*.020,.056,.196),[S(.016),S(.012),S(.019)],hi,8);
        // 4. cheek-to-jaw — the zygomatic sweep, orbit down and back to the jaw angle
        B.skin.tube(P(s*.078,.072,.088), P(s*.056,.020,.008), S(.020), S(.028), hi, hi, 0, 7, 2);
        // 5. mandible line — the lower jaw edge, chin back to the angle under the ear
        B.skin.tube(P(s*.028,.008,.176), P(s*.070,.030,.004), S(.012), S(.021), hi, hi, 0, 7, 2);
      }
      // 6. chin underside — the pale throat mass the plates carry under the jaw
      B.skin.ellipsoid(P(0,-.004,.136),[S(.052),S(.028),S(.072)],hi,10);
      // 7. crest root — the raised boss the crest actually leaves the skull from, so the crest
      //    grows out of a head instead of being stuck onto one
      if (M.crest > 0.01) B.skin.ellipsoid(P(0,.140,.008),[S(.070),S(.030),S(.058)],hi,10);
    }else if(artFamily==='humanoid'){
      B.skin.ellipsoid(P(0,.080,.004),[S(.100),S(.132),S(.098)],hi,16);
      B.skin.ellipsoid(P(0,.045,.096),[S(.025),S(.040),S(.034)],hi,10);             // nose
      B.skin.ellipsoid(P(0,.002,.071),[S(.072),S(.040),S(.070)],hi,12);            // jaw/chin
      B.skin.ellipsoid(P(-.105,.076,0),[S(.018),S(.038),S(.014)],hi,8);
      B.skin.ellipsoid(P( .105,.076,0),[S(.018),S(.038),S(.014)],hi,8);
      // The same seven landmarks, against `refs/modern/character_closeup/REF-ER__steam-dyules-
      // 2764067250.jpg` opened rather than described: brow, orbit rim, nostril wing, cheekbone,
      // jaw edge and the underside of the chin all read as form there under a soft key. The
      // seventh, "crest root", has no human referent, so this family carries the nasal bridge
      // (glabella to tip) in its place — stated here rather than quietly counted as the same thing.
      for (const s of [-1, 1]) {
        B.skin.tube(P(s*.010,.120,.070), P(s*.072,.106,.056), S(.020), S(.012), hi, hi, 0, 7, 2);  // brow ridge
        for (let k = 0; k < 6; k++) {
          const a0 = (k/6)*Math.PI*2, a1 = ((k+1)/6)*Math.PI*2, rr = .034;
          B.skin.tube(P(s*.042 + Math.cos(a0)*rr, .086 + Math.sin(a0)*rr, .066),
            P(s*.042 + Math.cos(a1)*rr, .086 + Math.sin(a1)*rr, .066), S(.008), S(.008), hi, hi, 0, 5, 1);  // orbit rim
        }
        B.skin.ellipsoid(P(s*.021,.034,.098),[S(.014),S(.012),S(.015)],hi,8);                       // naris
        B.skin.tube(P(s*.074,.064,.058), P(s*.052,.012,.036), S(.019), S(.024), hi, hi, 0, 7, 2);   // cheek-to-jaw
        B.skin.tube(P(s*.018,-.018,.092), P(s*.064,.022,.006), S(.012), S(.019), hi, hi, 0, 7, 2);  // mandible line
      }
      B.skin.ellipsoid(P(0,-.020,.074),[S(.036),S(.020),S(.046)],hi,10);                            // chin underside
      B.skin.tube(P(0,.108,.058), P(0,.062,.092), S(.013), S(.020), hi, hi, 0, 7, 2);               // nasal bridge
    }else if(artFamily==='undead'){
      // A narrow corpse volume supports the separate bone skull/ribs without smuggling the
      // player's reptile snout and crest underneath them.
      B.skin.ellipsoid(P(0,.072,.006),[S(.083),S(.116),S(.079)],hi,10);
    }
  }

  // Hands and feet need terminal anatomy. A tapered forearm ending in one capped tube was the
  // canonical "rubber hose" failure in the hardware close-up. Three splayed digits and forward
  // toes remain rigid to their terminal bones, so they cannot disturb hit volumes or IK.
  for (const [id, sideSign] of [['hand_l',-1],['hand_r',1]]) {
    const bi=index.get(id); if (bi===undefined) continue;
    const h=M.hand*M.build;
    const hm=restWorld[bi], P=(x,y,z)=>new THREE.Vector3(x*h,y*h,z*h).applyMatrix4(hm);
    B.skin.ellipsoid(P(0,-.055,.025),[.070*h,.090*h,.048*h],bi,10);
    // Three fingers and an opposed thumb. The gate reads "hands have separated digits"; a hand
    // whose thumb is one of four parallel tubes has digits but not a thumb, so the fourth tube
    // leaves the palm sideways and forward, from a different origin.
    for(let k=-1;k<=1;k++) B.skin.tube(P(k*.025,-.084,.022),P(k*.038,-.174,.045+Math.abs(k)*.012),.016*h,.006*h,bi,bi,0,7,3);
    B.skin.tube(P(sideSign*.052,-.060,.018),P(sideSign*.098,-.132,.060),.015*h,.006*h,bi,bi,0,7,3);
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
  const s2 = index.get('spine_02');
  if (pi !== undefined && artFamily==='saxhleel') {
    const pm = restWorld[pi];
    const T = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(pm);
    // THE TAIL ROOT WAS THE SINGLE LARGEST HOLE IN THE CHARACTER. Two causes, both fixed here.
    //
    // (1) The first segment started at z = -0.13, which is the exact back surface of the pelvis
    //     ellipsoid (rz = 0.135) — tangent, not embedded. Any pose that swung the pelvis opened
    //     a slit between the tail and the rump. It now starts at z = -0.045, well inside the
    //     pelvis volume, and at 0.115 rather than 0.085 so it leaves the body at the body's own
    //     width instead of stepping down to it.
    // (2) Its start ring was 50% weighted to `spine_00` (`blend: 0.35`). The tail is not part of
    //     the spine and does not follow it; that weight dragged the root away from the pelvis
    //     every time the character bent. The whole tail is now rigid to `pelvis`, which is also
    //     what the combat rig assumes — `skeleton.json` declares no tail bones at all.
    const spine = [
      [T(0, 0.010, -0.045), T(0, -0.10, -0.36), 0.115, 0.068],
      [T(0, -0.10, -0.36), T(0, -0.30, -0.55), 0.068, 0.048],
      [T(0, -0.30, -0.55), T(0, -0.50, -0.66), 0.048, 0.030],
      [T(0, -0.50, -0.66), T(0, -0.66, -0.70), 0.030, 0.012],
    ];
    for (const [a, b, r0, r1] of spine) B.skin.tube(a, b, r0, r1, pi, pi, 0, 8, 2);
    // THE DORSAL CREST IS NOW PART OF THE BODY, not four cones hovering behind it.
    //
    // It used to be four `ConeGeometry` presentation meshes at z = -0.16 .. -0.49 off `spine_02`,
    // i.e. up to 35 cm behind a back whose ellipsoid is 14 cm deep. They floated, and the gap
    // between crest and back was the largest single contributor to the crack count. Emitting them
    // into the same skinned surface as everything else means the weld is structural: there is no
    // pose in which a crest plate and the back can separate, because they are one mesh.
    const crest = [
      [s2, [0, 0.150, -0.055], [0, 0.230, -0.130], 0.042, 0.010],
      [s2, [0, 0.020, -0.070], [0, 0.080, -0.170], 0.040, 0.010],
      [s0, [0, 0.060, -0.075], [0, 0.110, -0.180], 0.036, 0.009],
      [s0, [0, -0.060, -0.070], [0, -0.020, -0.175], 0.032, 0.008],
      [pi, [0, 0.030, -0.060], [0, 0.070, -0.160], 0.028, 0.007],
    ];
    for (const [bi, a, b, r0, r1] of crest) {
      if (bi === undefined || M.crest <= 0.01) continue;
      const m = restWorld[bi];
      // The crest's ROOT stays where it is (inside the body) and only its tip and section scale
      // with the morph. Scaling both ends would lift a small crest out of the back — which is the
      // defect this block was written to remove, reintroduced by a variant axis.
      const tip = [a[0] + (b[0] - a[0]) * M.crest, a[1] + (b[1] - a[1]) * M.crest, a[2] + (b[2] - a[2]) * M.crest];
      B.skin.tube(new THREE.Vector3(...a).applyMatrix4(m), new THREE.Vector3(...tip).applyMatrix4(m), r0 * M.crest, r1, bi, bi, 0, 6, 2);
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
    mesh.name = `actor-body:${artFamily}:${key}`;
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
    mesh.name = `actor-secondary-frill:${i}@spine_02`;
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
  const addEquip=(set,slot,boneId,geo,offset,scale=[1,1,1],rot=[0,0,0])=>{const bi=index.get(boneId);if(bi===undefined)return;bakeCurvature(geo);const mesh=new THREE.Mesh(geo,equipMat[set]);mesh.name=`actor-equipment:${set}:${slot}@${boneId}`;mesh.castShadow=true;mesh.matrixAutoUpdate=false;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));const local=new THREE.Matrix4().compose(new THREE.Vector3(...offset),q,new THREE.Vector3(...scale));group.add(mesh);equipment.push({set,slot,bi,mesh,local});};
  for(const set of ['reed','chitin','xanmeer']){
    const heavy=set==='xanmeer',mid=set==='chitin';
    // Headgear sat a clean 4-5 cm off the skull (a 0.145 circlet around a 0.098 skull radius at
    // that height), so `stagger_recoil` opened sky between helm and head. Each set now sits on the
    // skull it is worn on: the circlet inside the skull radius, the chitin cap lowered so its rim
    // meets the temple rather than hovering above it.
    addEquip(set,'head','head',heavy?new THREE.CylinderGeometry(.132,.152,.20,10):mid?new THREE.SphereGeometry(.126,12,7,0,Math.PI*2,0,Math.PI*.58):new THREE.TorusGeometry(.104,.028,5,12,Math.PI*1.55),[0,heavy?.125:mid?.062:.105,-.010],heavy?[1.06,1,1.06]:[1,1,1],heavy?[0,0,0]:mid?[0,0,0]:[Math.PI/2,0,.35]);
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
    // EVERY RIGID PIECE THAT RIDES A BONE MUST INTERSECT THE BODY, not rest against it.
    //
    // A skinned surface can be welded; a separate mesh cannot, so the only weld available to it is
    // overlap. The belt used to be a torus of radius 0.205 with a 0.024 section — inner edge 0.181,
    // against a waist of about 0.178. Three millimetres of clearance. At rest it looked closed; the
    // moment the spine bent it opened, and it was the largest remaining crack in the orbit after
    // the body itself was fixed. The rule applied here and to the pack and the oblique straps is
    // that a fitting's inner surface sits at least 3 cm INSIDE the body radius at that height.
    addEquip(set,'chest','spine_00',new THREE.TorusGeometry(.178,heavy?.050:.042,6,18),[0,-.04,0],[1,.72,1],[Math.PI/2,0,0]);
    addEquip(set,'legs','pelvis',garmentTabGeometry(heavy?.25:.215,heavy?.42:.36,.025),[0,-.20,.085],[1,1,1],[0,0,0]);
    for(const s of [-1,1]) addEquip(set,'chest','spine_02',new THREE.BoxGeometry(.035,.30,.025),[s*.100,-.02,.100],[1,1,1],[0,0,s*.24]);
    addEquip(set,'back','spine_02',heavy?new THREE.CylinderGeometry(.205,.205,.050,14):mid?new THREE.DodecahedronGeometry(.18,1):new THREE.CapsuleGeometry(.105,.20,4,8),[0,-.07,-.128],heavy?[1,.66,1]:mid?[.78,1,.32]:[.76,1,.34],[heavy?Math.PI/2:.08,0,mid?.10:-.06]);
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
  // THE MORPH HAS TO REACH THE PRESENTATION PIECES OR THE VARIANT CLAIM IS FALSE FOR TWO FAMILIES.
  // Measured, before this line existed: `beast.slitherfang` and `beast.slitherfang-pale` had a
  // silhouette IoU of 1.0000 — the same character with two names — and a 6% widening of the shared
  // body plan moved 15 of 17 characters rather than all of them, because the quadruped's whole body
  // is presentation geometry and none of it read the morph. `tools/visual/rig-variant-proof.mjs`
  // is what caught it; the registry alone said PASS.
  // `extra` multiplies offset AND scale on top of `M.build`. Head-attached pieces pass the family
  // head scale through it, so eyes, pupils and horns shrink with the skull rather than staying at
  // their old size on a smaller head — which would have turned the proportion fix into bug eyes.
  const addPresentation=(boneId,geo,offset,scale=[1,1,1],rot=[0,0,0],label='form',material=familyMat,extra=1)=>{const bi=index.get(boneId);if(bi===undefined)return;bakeCurvature(geo);const mesh=new THREE.Mesh(geo,material);mesh.name=`actor-family-form:${artFamily}:${label}@${boneId}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));const bs=M.build*extra,local=new THREE.Matrix4().compose(new THREE.Vector3(offset[0]*bs,offset[1]*bs,offset[2]*bs),q,new THREE.Vector3(scale[0]*bs,scale[1]*bs,scale[2]*bs));const rootLocal=artFamily==='beast'?restWorld[bi].clone().multiply(local):null;group.add(mesh);presentation.push({bi,mesh,local,rootLocal});};
  // The SAME `headScale` the skinned head block above solved for — one binding, read twice, so a
  // future change to the canon cannot leave the eyes at the old size on a new skull.
  const hScale = headScale;
  if(artFamily==='beast'){
    // The slitherfang is a low, weight-bearing animal with different widths at ribcage, loin,
    // neck and tail. A constant-radius TubeGeometry made it a glossy capsule. Overlapping closed
    // masses give it scapulae, a tapered waist and a descending tail, while the combat rig remains
    // the sole pose authority. Limb pieces below ride upper/lower/terminal bones separately so a
    // lunge bends at shoulder, wrist, hip and hock rather than translating four glued pegs.
    addPresentation('spine_00',new THREE.SphereGeometry(.30,18,12),[0,-.10,.28],[1.18,.78,1.42],[0,0,0],'ribcage');
    addPresentation('pelvis',new THREE.SphereGeometry(.27,16,10),[0,.03,-.20],[1.02,.80,1.30],[0,0,0],'haunch-mass');
    addPresentation('spine_00',new THREE.SphereGeometry(.22,14,9),[0,-.11,-.10],[.90,.72,1.32],[0,0,0],'tapered-loin');
    addPresentation('spine_02',new THREE.CapsuleGeometry(.135,.34,6,12),[0,-.18,.27],[1,.80,1],[Math.PI/2,0,0],'neck');
    addPresentation('spine_02',new THREE.DodecahedronGeometry(.20,2),[0,-.19,.60],[1.12,.80,1.40],[0,0,0],'wedge-skull');
    addPresentation('spine_02',new THREE.SphereGeometry(.145,14,9),[0,-.245,.79],[.78,.55,1.42],[0,0,0],'muzzle-mass');
    addPresentation('spine_02',new THREE.BoxGeometry(.19,.045,.32),[0,-.32,.78],[1,1,1],[.08,0,0],'lower-jaw');
    // Three diminishing, slightly offset tail sections avoid the pipe silhouette and carry the
    // pelvis motion through a heavy base into a narrow terminal whip.
    addPresentation('pelvis',new THREE.CapsuleGeometry(.16,.36,6,11),[.015,.00,-.49],[1,.84,1],[Math.PI/2-.10,0,.03],'tail-base');
    addPresentation('pelvis',new THREE.CapsuleGeometry(.105,.40,6,10),[-.025,-.055,-.80],[1,.82,1],[Math.PI/2-.20,.05,-.06],'tail-mid');
    addPresentation('pelvis',new THREE.ConeGeometry(.082,.48,9),[.035,-.13,-1.11],[1,1,1],[-Math.PI/2+.28,.04,.08],'tail-whip');
    const eyeMat=mats.bone.clone();eyeMat.color.setHex(0xd3b957);eyeMat.emissive.setHex(0x5a3108);eyeMat.emissiveIntensity=.7;
    for(const sx of [-1,1])addPresentation('spine_02',new THREE.SphereGeometry(.032,10,7),[sx*.118,-.145,.715],[1,.78,.62],[0,0,0],`eye-${sx<0?'l':'r'}`,eyeMat);
    for(const sx of [-1,1]){
      const side=sx<0?'l':'r';
      addPresentation('spine_02',new THREE.ConeGeometry(.025,.14,7),[sx*.070,-.31,.94],[1,1,1],[Math.PI/2,0,sx*.08],`fang-${side}`,mats.bone);
      // These segments share the trunk bone intentionally. The biped's shoulder/hip rest
      // offsets are metres above the beast's low body and produced disconnected feet even when
      // transformed coherently. Connected local chains supply the quadruped's true attachment
      // points while the bounded lunge deformation below moves the complete chain together.
      addPresentation('spine_00',new THREE.CapsuleGeometry(.070,.20,5,9),[sx*.235,-.255,.40],[1,.92,.86],[0,0,sx*.52],`fore-upper-${side}`);
      addPresentation('spine_00',new THREE.CapsuleGeometry(.052,.17,5,9),[sx*.345,-.405,.43],[1,.96,.84],[0,0,-sx*.16],`fore-lower-${side}`);
      addPresentation('spine_00',new THREE.SphereGeometry(.076,11,7),[sx*.37,-.515,.50],[1.42,.42,1.30],[0,0,0],`fore-paw-${side}`);
      addPresentation('spine_00',new THREE.SphereGeometry(.115,12,8),[sx*.225,-.22,-.35],[1.12,1.32,1.18],[0,0,0],`hind-haunch-${side}`);
      addPresentation('spine_00',new THREE.CapsuleGeometry(.065,.22,5,9),[sx*.365,-.39,-.43],[1,.96,.88],[0,0,sx*.22],`hind-hock-${side}`);
      addPresentation('spine_00',new THREE.SphereGeometry(.085,11,7),[sx*.42,-.515,-.50],[1.55,.45,1.48],[0,0,0],`hind-paw-${side}`);
      for(let toe=-1;toe<=1;toe++)addPresentation('spine_00',new THREE.ConeGeometry(.016,.12,6),[sx*.42+toe*.032,-.525,-.39-Math.abs(toe)*.018],[1,1,1],[Math.PI/2,0,0],`hind-toe-${side}-${toe+1}`,mats.bone);
    }
    for(let i=0;i<7;i++)addPresentation(i<3?'pelvis':'spine_00',new THREE.ConeGeometry(.062-i*.005,.21-i*.013,7),[(i%2?1:-1)*.018,.13,-.40+i*.17],[1,.72,1],[-Math.PI/2-.18,0,(i%2?1:-1)*.12],`dorsal-${i}`);
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
    addPresentation('head',new THREE.SphereGeometry(.026,10,7),[-.052,.09,.112],[1,.72,.58],[0,0,0],'eye-l',eyeMat,hScale);
    addPresentation('head',new THREE.SphereGeometry(.026,10,7),[ .052,.09,.112],[1,.72,.58],[0,0,0],'eye-r',eyeMat,hScale);
    addPresentation('head',new THREE.SphereGeometry(.010,8,5),[-.052,.09,.132],[.62,1,.40],[0,0,0],'pupil-l',pupilMat,hScale);
    addPresentation('head',new THREE.SphereGeometry(.010,8,5),[ .052,.09,.132],[.62,1,.40],[0,0,0],'pupil-r',pupilMat,hScale);
    if(M.horn>.01)for(const s of [-1,1]) addPresentation('head',new THREE.ConeGeometry(.045*M.horn,.16*M.horn,7),[s*.055,.16,-.045],[1,1,1],[-.30,0,s*.10],`brow-horn-${s<0?'l':'r'}`,familyMat,hScale);
    // The four `spine-scale-*` cones that used to hang here are gone. They are now welded crest
    // tubes inside the skinned surface (see `buildSkeleton`'s tail/crest block) — same read, no
    // gap. Deleting a floating ornament is not "hiding the defect": the crest is still drawn, at
    // the same place, and `actor-orbit-holes` reports mean silhouette area so a shrunken character
    // cannot pass as a fixed one.
    for(const s of [-1,1]) addPresentation(s<0?'upperarm_l':'upperarm_r',new THREE.SphereGeometry(.10,10,5,0,Math.PI*2,0,Math.PI*.58),[0,.02,0],[1.15,.58,1],[0,0,s*.16],'shoulder-scale');
  }else{
    // Civilian clothing needs the same shoulder/chest/waist hierarchy as armour. The old
    // horizontally compressed capsule made every unarmoured NPC read as an egg with limbs,
    // especially in the room census. This lighter tailored shell remains distinct from an
    // equipment chest piece while following the evaluated spine bone in every action.
    addPresentation('spine_02',torsoShellGeometry('reed'),[0,-.045,-.014],[1.05,1.08,1.02],[0,0,0],'tailored-tunic');
    addPresentation('head',new THREE.SphereGeometry(.12,12,8,0,Math.PI*2,0,Math.PI*.48),[0,.13,-.015],[1,1,.9],[0,0,0],'hair-cap',familyMat,hScale);
    // `base.humanoid` HAD NO EYE GEOMETRY AT ALL. RI-VIS08 B8 is a MINIMUM across characters, not
    // the player's score, and this family's only two family-form parts were `hair-cap` and
    // `tailored-tunic` — so every human and mer in the game was a bald egg with no face, which is
    // what `C1__npc-blackwood-company-factor__closeup-lit.png` shows and why the critic's word for
    // it was "a wooden artist's mannequin". It carried 329 of 408 NPCs before the race routing fix
    // and still carries 148. Eye and pupil are separate geometry, as B8 requires, and they are cut
    // from the same cloth as the saxhleel pair immediately above so improving one improves both.
    const hEyeMat=(mats.bone||mats.metal).clone();hEyeMat.color.setHex(0xd8d2c4);hEyeMat.roughness=.28;
    const hPupilMat=mats.darkStone.clone();hPupilMat.color.setHex(0x140f0c);
    for(const s of [-1,1]){
      const side=s<0?'l':'r';
      addPresentation('head',new THREE.SphereGeometry(.021,10,7),[s*.042,.086,.074],[1,.80,.62],[0,0,0],`eye-${side}`,hEyeMat,hScale);
      addPresentation('head',new THREE.SphereGeometry(.0085,8,6),[s*.042,.086,.090],[.78,1,.42],[0,0,0],`pupil-${side}`,hPupilMat,hScale);
    }
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
    // WINDING — the third generator found inverted on 2026-08-15, and note that only its CAPS were
    // wrong while its side walls were always right (the wall loop's frame is +y by +angle, which
    // comes out outward; `MeshBuilder.tube`'s is +axis by +angle in a different handedness, which
    // did not). Both caps were wound against their own authored normal: `(centre, q, i)` on the
    // bottom rim gives a face normal of +y while `nrm` declares -y. 36 triangles per shell,
    // matching the measured 144/720 disagreement on `tailored-tunic` over 4 meshes exactly.
    const centre=pos.length/3,[y]=rings[r];pos.push(0,y,0);nrm.push(0,flip?-1:1,0);uv.push(.5,.5);
    for(let i=0;i<radial;i++){const q=(i+1)%radial;if(flip)idx.push(centre,r*radial+i,r*radial+q);else idx.push(centre,r*radial+q,r*radial+i);}
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
  // WINDING — the second of the three generators found inverted on 2026-08-15. This list read
  // `[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]`, whose first face
  // (0,2,1) on the z=-depth/2 side has a face normal of +z, i.e. pointing INTO the wedge. Every
  // triple below is that list with its winding reversed. It is invisible to a normal-agreement
  // check because `computeVertexNormals()` derives the normals FROM the winding, so the normals
  // agreed with a wrong surface — only the signed volume caught it (13 of 13 `:legs` meshes
  // negative). That is why the instrument measures both and not just one.
  const i=[0,1,2,0,2,3,4,6,5,4,7,6,0,5,1,0,4,5,3,6,7,3,2,6,0,7,4,0,3,7,1,6,2,1,5,6];
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
  wood.push(box(R * 0.72, gripLen, R * 0.62, -gripLen * 0.5 + 0.06));

  const haftLen = Math.max(0, -haftTop - 0.06);

  switch (cls) {
    case 'DGR':
      // The data-defined unedged length is still physical weapon: tang, grip and guard shoulder.
      // Leaving it empty made the blade hover 20-35 cm beyond the closed hand while the far tip
      // remained perfectly socket-accurate, a defect the old tip-only control could not see.
      if(haftTop<.06-gripLen)wood.push(box(R*.68,(.06-gripLen)-haftTop,R*.58,(haftTop+.06-gripLen)*.5));
      metal.push(blade(R * 1.35, span, R * 0.46, tip + span / 2));
      metal.push(box(R * 3.0, 0.045, R * 1.15, haftTop));
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
      if(haftTop<.06-gripLen)wood.push(box(R*.72,(.06-gripLen)-haftTop,R*.62,(haftTop+.06-gripLen)*.5));
      const wide = cls === 'CGS' ? R * 1.5 : R * 1.05;
      metal.push(curvedBlade(wide,span,R*.28,haftTop,cls==='CGS'?.235:.19));
      metal.push(box(R * (cls === 'CGS' ? 4.2 : 3.0), 0.035, R * 0.8, haftTop));
      break;
    }
    case 'TSW':                                     // thrusting: narrow, long, a swept guard
      if(haftTop<.06-gripLen)wood.push(box(R*.68,(.06-gripLen)-haftTop,R*.58,(haftTop+.06-gripLen)*.5));
      metal.push(blade(R * 0.72, span, R * 0.34, tip + span / 2));
      metal.push(box(R * 2.2, 0.030, R * 2.2, haftTop));
      metal.push(box(R * 0.30, 0.16, R * 2.0, haftTop + 0.08));
      break;
    case 'SSW': case 'GSW': case 'UGS': {
      if(haftTop<.06-gripLen)wood.push(box(R*.76,(.06-gripLen)-haftTop,R*.66,(haftTop+.06-gripLen)*.5));
      const wide = cls === 'UGS' ? R * 2.15 : cls === 'GSW' ? R * 1.75 : R * 1.42;
      metal.push(blade(wide, span, R * 0.34, tip + span / 2));
      metal.push(box(wide * 0.22, span * 0.82, R * 0.40, tip + span * 0.47)); // medial ridge
      metal.push(box(wide * 3.15, 0.055, R * 1.25, haftTop));                // crossguard
      metal.push(box(R * 1.15, 0.085, R * 1.15, 0.085));                     // pommel
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
  return bakeCurvature(out);
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
  // Held equipment must remain readable on the shadowed side of the body. These are bounded
  // material variants on the weapon itself, not a full-scene exposure lift.
  // Broad weapon faces cross the key light several times during an attack. Preserve their
  // construction on the shadow half of the sweep with a bounded, material-local floor; the
  // former near-black response erased axe bits, hammer heads and great-blade ridges in motion.
  const metal=mats.metal.clone();metal.color.setHex(0xd0d6d9);metal.metalness=.68;metal.roughness=.32;metal.emissive.setHex(0x30363a);metal.emissiveIntensity=.24;metal.flatShading=true;metal.needsUpdate=true;metal.name='visual-family:metal:held-weapon';
  const grip=mats.bark.clone();grip.color.setHex(0x765237);grip.roughness=.76;grip.name='visual-family:bark:held-grip';
  if (entry.metal) { const m = new THREE.Mesh(entry.metal, metal); m.name=`actor-held:weapon:${w.class||'?'}:metal`; m.castShadow = true; m.receiveShadow=true; g.add(m); }
  if (entry.wood) { const m = new THREE.Mesh(entry.wood, grip); m.name=`actor-held:weapon:${w.class||'?'}:haft`; m.castShadow = true; m.receiveShadow=true; g.add(m); }
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
  const panelGeo=new THREE.ShapeGeometry(shape,10);panelGeo.translate(0,-h*.12,0);
  const g=new THREE.Group();g.name=`actor-held:shield:${id||cls}`;g.matrixAutoUpdate=false;
  const rimMat=mats.metal.clone();rimMat.color.setHex(great?0x8b9495:0xb09665);rimMat.roughness=.38;rimMat.emissive.setHex(0x100d08);rimMat.emissiveIntensity=.10;rimMat.side=THREE.DoubleSide;rimMat.name='visual-family:metal:shield-rim';
  const faceMat=(great?mats.darkStone:mats.bark).clone();faceMat.color.setHex(great?0x686e70:0x926846);faceMat.roughness=.72;faceMat.emissive.setHex(great?0x090b0c:0x100b07);faceMat.emissiveIntensity=.10;faceMat.side=THREE.DoubleSide;faceMat.name=`visual-family:${great?'stone':'bark'}:shield-face`;
  const rim=new THREE.Mesh(boardGeo,rimMat);rim.castShadow=true;rim.receiveShadow=true;g.add(rim);
  const face=new THREE.Mesh(panelGeo,faceMat);face.scale.set(.88,.88,1);face.position.z=d*.67;face.castShadow=true;face.receiveShadow=true;g.add(face);
  // The inner face is what the ordinary chase camera sees. It needs authored construction too;
  // otherwise even a detailed exterior collapses to the shadowed extrusion silhouette in play.
  const innerMat=faceMat.clone();innerMat.color.offsetHSL(0,-.04,.075);innerMat.name=`${faceMat.name}:inner`;
  const inner=new THREE.Mesh(panelGeo.clone(),innerMat);inner.scale.set(.86,.86,1);inner.position.z=-d*.67;inner.castShadow=true;inner.receiveShadow=true;g.add(inner);
  const boss=new THREE.Mesh(new THREE.SphereGeometry(small?.13:.16,18,10,0,Math.PI*2,0,Math.PI*.52),rimMat);boss.scale.z=.45;boss.position.set(0,0,d*.66);boss.castShadow=true;g.add(boss);
  for(const sx of [-1,1]){const rib=new THREE.Mesh(new THREE.BoxGeometry(.035,h*.62,d*.32),rimMat);rib.position.set(sx*w*.25,-h*.10,d*.82);rib.rotation.z=-sx*.13;rib.castShadow=true;g.add(rib);}
  for(const sx of [-1,1]){const rib=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,h*.72,7),rimMat);rib.position.set(sx*w*.32,-h*.05,d*.62);rib.rotation.z=sx*.13;rib.castShadow=true;g.add(rib);}
  const cross=new THREE.Mesh(new THREE.CylinderGeometry(.018,.024,w*.68,7),rimMat);cross.position.set(0,h*.25,d*.62);cross.rotation.z=Math.PI/2;cross.castShadow=true;g.add(cross);
  const strapMat=mats.bark.clone();strapMat.color.setHex(0x4c2f20);strapMat.roughness=.9;strapMat.side=THREE.DoubleSide;strapMat.name='visual-family:bark:shield-straps';
  for(const y of [-h*.17,h*.19]){const strap=new THREE.Mesh(new THREE.BoxGeometry(w*.58,.052,.022),strapMat);strap.position.set(0,y,-d*.96);strap.rotation.z=y>0?.10:-.08;strap.castShadow=true;g.add(strap);}
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.026,.032,w*.32,8),rimMat);grip.position.set(0,.01,-d*1.25);grip.rotation.z=Math.PI/2;grip.castShadow=true;g.add(grip);
  return g;
}

// ---------------------------------------------------------------------------------------
// The public surface.
// ---------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------
// The registry — two bases, one skeleton, and every character a variant spec.
//
// `W1-30-LIBRARY.md` §5 is the contract: `base.saxhleel` and `base.humanoid` on `es.humanoid.v1`,
// and *"the census fails if any character in the shipped world carries a mesh that is neither a
// base nor a variant of one."* The bases are the body plans above; the characters below are
// numbers. Nothing here is a second mesh.
//
// `base.slitherfang` is a THIRD base and it carries a written exemption, because pretending a
// quadruped is a variant of a biped would be a reuse claim rather than reuse: it shares the
// skeleton and shares nothing of the body plan (`poseFromRig` hides the humanoid surface entirely
// for it). Saying so is cheaper than a census row that reads green and means nothing.
// ---------------------------------------------------------------------------------------

const FAMILY_BASE = { saxhleel: 'base.saxhleel', humanoid: 'base.humanoid', undead: 'base.humanoid', beast: 'base.slitherfang' };

for (const [id, family] of [['base.saxhleel', 'saxhleel'], ['base.humanoid', 'humanoid'], ['base.slitherfang', 'beast']]) {
  registerRig(id, (variant = {}) => ({ id, family, skeleton: SKELETON_ID, morph: resolveMorph(variant.morph), variant }),
    { family, skeleton: SKELETON_ID, note: id === 'base.slitherfang' ? 'exempt: quadruped body plan, shares the skeleton only' : null });
}

/**
 * Sixteen characters from three bases. Each row is what the owner asked for, written down: a build,
 * a set of proportions, a palette and a kit — never a mesh.
 *
 * The morph numbers are chosen to be visible at 4 m, not merely different in the file. A `build` of
 * 0.86 against 1.18 is a 37% difference in limb section; a `crest` of 0 against 1.35 changes the
 * head silhouette outright, which is what `RI-CAM07` §F1 asks the back of a character to do.
 */
const CHARACTER_SPECS = {
  // --- base.saxhleel -----------------------------------------------------------------------
  'player.saxhleel':        { base: 'base.saxhleel', morph: { build: 1.00, crest: 1.00, snout: 1.00 }, material: { skin: 0x8d9a72, cloth: 0x8f9aa6, palette: 'deep-marshes', wear: 0.25 }, clips: 'clipset.player' },
  'sax.marsh-lean':         { base: 'base.saxhleel', morph: { build: 0.86, crest: 0.75, snout: 1.18, hand: 0.94 }, material: { skin: 0x6f8a5e, cloth: 0x5d6b4a, palette: 'deep-marshes', wear: 0.55 }, clips: 'clipset.civilian' },
  'sax.hist-broad':         { base: 'base.saxhleel', morph: { build: 1.18, shoulders: 1.14, crest: 1.35, snout: 0.90 }, material: { skin: 0x4a6b52, cloth: 0x3f4d3a, palette: 'eastern-rootlands', wear: 0.40 }, clips: 'clipset.civilian' },
  'sax.naga-tall':          { base: 'base.saxhleel', morph: { build: 0.94, neck: 1.30, snout: 1.32, crest: 0.45, horn: 1.6 }, material: { skin: 0x3f6357, cloth: 0x2f3f3c, palette: 'crimson-coast', wear: 0.30 }, clips: 'clipset.civilian' },
  'sax.helstrom-guard':     { base: 'base.saxhleel', morph: { build: 1.12, shoulders: 1.20, crest: 0.60, horn: 0.0 }, material: { skin: 0x5a7a5f, cloth: 0x6b5a3a, palette: 'thornmarsh', wear: 0.20 }, sockets: { set: 'chitin' }, clips: 'clipset.guard' },
  'sax.thorn-hunter':       { base: 'base.saxhleel', morph: { build: 0.90, belly: 0.88, crest: 1.10, snout: 1.10, hand: 1.08 }, material: { skin: 0x77694a, cloth: 0x4a3b28, palette: 'thornmarsh', wear: 0.70 }, clips: 'clipset.civilian' },
  'sax.salt-elder':         { base: 'base.saxhleel', morph: { build: 1.04, belly: 1.22, neck: 0.86, crest: 0.30, snout: 0.94 }, material: { skin: 0x9aa08a, cloth: 0x8a8470, palette: 'salt-hills', wear: 0.85 }, clips: 'clipset.civilian' },
  // Skin was 0x8a7a3f — CIELAB C* 34.3, sitting on W1-30K's province chroma ceiling of 34.64
  // BEFORE any light touches it. A frame cannot come in under a 95th-percentile ceiling if a
  // character's raw albedo is already at it, so this swatch is pulled back to C* 24.
  'sax.hive-drone':         { base: 'base.saxhleel', morph: { build: 0.80, shoulders: 0.86, crest: 0.0, horn: 0.0, snout: 0.82 }, material: { skin: 0x877c56, cloth: 0x6a6041, palette: 'hive', wear: 0.45 }, clips: 'clipset.civilian' },
  'sax.deep-warden':        { base: 'base.saxhleel', morph: { build: 1.22, shoulders: 1.10, belly: 1.10, crest: 1.20, horn: 1.3 }, material: { skin: 0x2f4a3f, cloth: 0x24302c, palette: 'deep-marshes', wear: 0.15 }, sockets: { set: 'xanmeer' }, clips: 'clipset.guard' },
  // --- base.humanoid -----------------------------------------------------------------------
  'hum.imperial-clerk':     { base: 'base.humanoid', morph: { build: 0.94, shoulders: 0.94, belly: 1.06 }, material: { skin: 0xb9a184, cloth: 0x6b6357, palette: 'stone-wastes', wear: 0.30 }, clips: 'clipset.civilian' },
  'hum.legion-heavy':       { base: 'base.humanoid', morph: { build: 1.20, shoulders: 1.24, neck: 1.14 }, material: { skin: 0xa08a6b, cloth: 0x4a4a52, palette: 'stone-wastes', wear: 0.35 }, sockets: { set: 'xanmeer' }, clips: 'clipset.guard' },
  'hum.dunmer-lean':        { base: 'base.humanoid', morph: { build: 0.84, shoulders: 0.92, neck: 1.08, hand: 0.92 }, material: { skin: 0x7a6f78, cloth: 0x53303a, palette: 'valus-ridge', wear: 0.50 }, clips: 'clipset.civilian' },
  'hum.breton-stout':       { base: 'base.humanoid', morph: { build: 1.10, belly: 1.24, shoulders: 1.02 }, material: { skin: 0xc2a98c, cloth: 0x5a4a2f, palette: 'blackwood', wear: 0.60 }, clips: 'clipset.civilian' },
  'hum.marauder':           { base: 'base.humanoid', morph: { build: 1.14, shoulders: 1.16, hand: 1.12, belly: 0.92 }, material: { skin: 0x8a7256, cloth: 0x3f2f24, palette: 'marauders-coast', wear: 0.80 }, sockets: { set: 'chitin' }, clips: 'clipset.guard' },
  'hum.drowned':            { base: 'base.humanoid', morph: { build: 0.78, belly: 0.80, neck: 0.88, hand: 0.90 }, material: { skin: 0xc4bfa7, cloth: 0x555044, palette: 'salt-hills', wear: 0.95 }, clips: 'clipset.undead' },
  // --- base.slitherfang (exempt: see above) -------------------------------------------------
  'beast.slitherfang':      { base: 'base.slitherfang', morph: { build: 0.92 }, material: { skin: 0x47382b, cloth: 0x3a2f24, palette: 'deep-marshes', wear: 0.5 }, clips: 'clipset.beast' },
  'beast.slitherfang-pale': { base: 'base.slitherfang', morph: { build: 1.18 }, material: { skin: 0x7a7360, cloth: 0x5f5a4a, palette: 'salt-hills', wear: 0.7 }, clips: 'clipset.beast' },
};
for (const [id, spec] of Object.entries(CHARACTER_SPECS)) registerCharacter(id, spec);

/**
 * WHICH VARIANT AN ACTOR GETS, and why it is derived rather than passed.
 *
 * `renderer.js` belongs to W1-30A and calls `makeRiggedActor(mats, tint, skin, family)` — four
 * arguments, no character id. Adding a fifth at every call site is a cross-child edit, and a
 * registry of sixteen characters that nothing in the running world reads scores zero
 * (`CLAUDE.md`, method line 3). So the variant is selected from something the caller ALREADY sets
 * and that is stable per person: `group.name`, which `renderer.js` writes as `npc:<eid>` or
 * `enemy:<eid>` before the body is built on the first pose.
 *
 * That makes it deterministic — the same eid picks the same body in every capture, so frame hashes
 * still reproduce — and it makes the variants real without touching a file this child does not own.
 * An explicit `group.userData.actor.characterId` overrides it, so the one-line renderer change that
 * would make the choice authored rather than derived needs no further work here.
 */
function characterFor(group, artFamily) {
  const A = group.userData.actor;
  if (A.characterId) return character(A.characterId);
  const base = FAMILY_BASE[artFamily] || 'base.humanoid';
  const pool = charactersOf(base).filter((id) => (artFamily === 'undead') === /drowned|undead/.test(id));
  const list = pool.length ? pool : charactersOf(base);
  if (!list.length) return null;
  if (artFamily === 'saxhleel' && /^player$|player/.test(group.name || '')) return character('player.saxhleel');
  const key = String(group.name || 'anon');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return character(list[h % list.length]);
}

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
 * Build the body ONCE, through the registry, and stamp the identity the census reads.
 *
 * Both pose paths funnel through here so a combat actor and a static villager cannot end up on
 * different rules — which is exactly how, before this, an NPC could stack three armour sets while
 * the player wore one.
 *
 * `userData.rigId` on every mesh is what `W1-30-LIBRARY.md` §4 calls for: *"a character lacks
 * `userData.rigId`"* is a census `bypass`, and a bypass is a hard fail. Stamping it here means it
 * is impossible to add a character path that forgets to.
 */
function ensureBuilt(group, rigSource) {
  const A = group.userData.actor;
  if (A.built) return A.built;
  const spec = characterFor(group, A.artFamily);
  A.character = spec;
  A.characterId = A.characterId || (spec && Object.keys(CHARACTER_SPECS).find((k) => CHARACTER_SPECS[k] === spec)) || null;
  const mat = (spec && spec.material) || {};
  // A variant's material is part of the variant, but a caller that named an explicit tint keeps it:
  // `renderer.js` hands per-race colours in and silently overriding them would make every Dunmer
  // and Imperial in a room the same person again.
  const skinHex = A.skinHex !== undefined ? A.skinHex : mat.skin;
  const tintHex = A.tintHex !== undefined ? A.tintHex : mat.cloth;
  A.built = buildSkeleton(rigSource, A.mats, tintHex, skinHex, A.artFamily, spec && spec.morph);
  const rigId = (spec && spec.base) || FAMILY_BASE[A.artFamily] || 'base.humanoid';
  const vkey = spec ? variantKey(spec.base, spec) : null;
  A.built.group.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.rigId = rigId;
    o.userData.characterId = A.characterId;
    o.userData.rigVariantKey = vkey;
  });
  for (const p of [...(A.built.equipment || []), ...(A.built.presentation || []), ...(A.built.secondary || [])]) {
    p.mesh.userData.rigId = rigId;
    p.mesh.userData.characterId = A.characterId;
    p.mesh.userData.rigVariantKey = vkey;
  }
  group.userData.rigId = rigId;
  group.userData.characterId = A.characterId;
  group.add(A.built.group);
  return A.built;
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
  const S = ensureBuilt(group, rig);
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
  if(S.presentation){
    const beastRoot=creatureOnly?rig.world[0]:null,beastBaseY=creatureOnly?((body.pos&&body.pos[1])||beastRoot[10]):0;
    // Beast animation is presentation deformation of one coherent quadruped, not a reuse of the
    // biped limb arcs. Root/yaw/translation and fixed-step action timing still come directly from
    // the combat rig. A lunge compresses the body then extends head/tail/feet by bounded local
    // offsets; every part remains in the same root frame, so no foot or dorsal plate can detach.
    const attackPhase=creatureOnly&&body.move?Math.sin(Math.min(1,Math.max(0,Number(body.animFrame||0)/Math.max(1,Number(body.move.total||body.move.total_frames||60))))*Math.PI):0;
    for(const p of S.presentation){
      const s=beastRoot||rig.world[p.bi],e=p.mesh.matrix.elements;e[0]=s[0];e[1]=s[3];e[2]=s[6];e[3]=0;e[4]=s[1];e[5]=s[4];e[6]=s[7];e[7]=0;e[8]=s[2];e[9]=s[5];e[10]=s[8];e[11]=0;e[12]=s[9];e[13]=creatureOnly?beastBaseY:s[10];e[14]=s[11];e[15]=1;
      p.mesh.matrix.multiply(creatureOnly?p.rootLocal:p.local);
      if(creatureOnly){const label=p.mesh.name,front=/skull|muzzle|jaw|eye|fang|neck/.test(label),tail=/tail/.test(label),paw=/paw|toe|hock|upper|lower|haunch/.test(label),forward=(front?.38:tail?-.18:paw?.08:0)*attackPhase,down=(front?.06:0)*attackPhase;p.mesh.matrix.elements[12]+=s[2]*forward-s[1]*down;p.mesh.matrix.elements[13]+=s[5]*forward-s[4]*down;p.mesh.matrix.elements[14]+=s[8]*forward-s[7]*down;}
      p.mesh.matrixWorld.copy(p.mesh.matrix);p.mesh.matrixWorldNeedsUpdate=false;
    }
  }

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
    ensureBuilt(group, rigDefSource);
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
