// The settlement kit: twenty-five parts, eight grammars, and the curvature attribute C asked for.
//
// Owner: W1-30E. Consumers: `render/exterior.js` (the 205 settlement buildings), `render/places.js`
// (the five authored cells), and — by the two-consumer rule in `W1-30-LIBRARY.md` — anything after
// Wave 1 that needs a bevelled, trim-mapped, wear-ready piece of built form.
//
// WHY THIS FILE EXISTS, in one sentence from the parent plan: *"a box with a cone on it is a box
// with a cone on it."* `exterior.js` was 153 KB of thoughtfully-composed boxes and cylinders with
// no bevel, no edge break, no trim and no thickness where thickness reads, and blockout is the
// single strongest "unfinished" signal a game can send.
//
// THREE THINGS EVERY PART HERE CARRIES, and none of them are optional:
//
//   1. **A broken edge.** Every silhouette-forming edge is chamfered. A hard 90-degree step is a
//      step-function in the shading and the eye reads it as untextured geometry; a 2--4 cm chamfer
//      gives the light two facets to describe and the same edge reads as a made thing. The chamfer
//      is cut INWARD, so a part's outer extent is unchanged and every footprint, doorway and
//      collision measurement in `exterior.js` means exactly what it meant before.
//
//   2. **`esCurvature`, per vertex.** `MATERIAL_API.md` §6a is addressed to this file by name.
//      C measured its texture-derived wear mask at 3.4% edge-vs-face separation against an 8% bar
//      and published the diagnosis rather than tuning until the number went green: *"a normal map's
//      rate of change is grain, and the arris of a plank is a property of the mesh."* So the arris
//      is baked here — 1.0 on a chamfer strip, ~0.45 on the ring of face immediately inside it,
//      0.0 in the face interior — and every kit material asks for `wearFrom: 'geometry'`. Without
//      this attribute the wear on these buildings is inert; with it, edges wear and faces do not.
//
//   3. **Trim atlas UVs.** `TRIM_SLOTS` had zero consumers when this file was written. Courses,
//      planks, lashings and bands map their V straight onto `trimSlot(id).v0..v1`, so a settlement's
//      `trim` word in `world-art.js` selects a real band of a real shared atlas.
//
// AND THE ECONOMY RULE. Twenty-five ids, and the plan's gate is that ≥ 40 distinct buildings come
// out of them. Everything a settlement needs that is not in the list is a *variant spec* — a size,
// a palette, a wear amount, a trim slot, an asymmetry seed — never a twenty-sixth part. The eight
// grammars below are the only place a settlement is allowed to differ, and each of them is derived
// from the `grammar`/`support`/`trim` strings `world-art.js` already publishes, because a grammar
// invented here rather than derived there is a hard fail in the plan.
'use strict';

import * as THREE from '../../../vendor/three/three.module.js';
import { worldMaterial, trimSlot, TRIM_SLOTS, materialTiling, PALETTES, MATERIAL_FAMILIES } from '../visual-foundation.js';
import { settlementArt } from '../world-art.js';

/* ================================================================================================
 * SECTION 1 — GEOMETRY. Chamfers, curvature and world-scale UVs.
 * ==============================================================================================*/

export const KIT_LODS = Object.freeze(['near', 'far', 'impostor']);

/** Chamfer width, in metres, for a part whose smallest dimension is `m`. Clamped at both ends: a
 * chamfer under ~12 mm is invisible at 4 m and a chamfer over 60 mm starts eating the form. */
function chamferOf(m, lod) {
  if (lod === 'impostor') return 0;
  const b = Math.min(0.055, Math.max(0.012, m * 0.10));
  return Math.min(b, m * 0.32);
}

/** Curvature of the ring of face immediately inside a chamfer. Not 0 and not 1: the wear on a real
 * plank does not stop dead at the arris, it feathers. */
const RING_CURV = 0.45;
const FLAT_CURV = 0.0;
const EDGE_CURV = 1.0;

class Builder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.cur = []; }
  get count() { return this.pos.length / 3; }
  /** One triangle. `n` may be null, in which case the face normal is computed. */
  tri(a, b, c, n, uvs, curv) {
    let nx, ny, nz;
    if (n) { [nx, ny, nz] = n; } else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    }
    for (let i = 0; i < 3; i++) {
      const p = [a, b, c][i];
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.cur.push(curv[i]);
    }
  }
  /** One quad, wound a->b->c->d, flipped automatically if its normal opposes `ideal`. */
  quad(a, b, c, d, uvs, curv, ideal) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-12) return;
    nx /= L; ny /= L; nz /= L;
    if (ideal && (nx * ideal[0] + ny * ideal[1] + nz * ideal[2]) < 0) {
      this.tri(a, d, c, [-nx, -ny, -nz], [uvs[0], uvs[3], uvs[2]], [curv[0], curv[3], curv[2]]);
      this.tri(a, c, b, [-nx, -ny, -nz], [uvs[0], uvs[2], uvs[1]], [curv[0], curv[2], curv[1]]);
      return;
    }
    this.tri(a, b, c, [nx, ny, nz], [uvs[0], uvs[1], uvs[2]], [curv[0], curv[1], curv[2]]);
    this.tri(a, c, d, [nx, ny, nz], [uvs[0], uvs[2], uvs[3]], [curv[0], curv[2], curv[3]]);
  }
  geometry(key) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    // The attribute MATERIAL_API.md §6a asks for. Name is load-bearing: `installSurfaceShader()`
    // declares `attribute float esCurvature` verbatim when `wearFrom: 'geometry'`.
    g.setAttribute('esCurvature', new THREE.Float32BufferAttribute(this.cur, 1));
    g.computeBoundingSphere();
    if (key) g.userData.w130BatchKey = key;
    g.userData.w130Kit = true;
    return g;
  }
}

/** Grid stops along one half-extent `H` with an outer ring of width `r`, and their curvatures. */
function ringStops(H, r, subdivide) {
  if (!subdivide || H <= r * 1.6) return [[-H, RING_CURV], [H, RING_CURV]];
  return [[-H, RING_CURV], [-H + r, FLAT_CURV], [H - r, FLAT_CURV], [H, RING_CURV]];
}

/**
 * A box with every edge chamfered inward, UV'd at world scale, carrying `esCurvature`.
 *
 * `w/h/d` are the OUTER dimensions and they are exact — the chamfer removes material from the
 * corner, it never adds any. That is what makes this a drop-in for `new THREE.BoxGeometry(w,h,d)`
 * everywhere in `exterior.js` without moving a single footprint, doorway or collision bound.
 *
 * `opts.trim` maps V onto a band of C's shared 2048x1536 trim atlas instead of tiling at world
 * scale — that is how a `trim.course` becomes a real course rather than a differently-coloured box.
 */
export function chamferBoxGeometry(w, h, d, opts = {}) {
  const lod = opts.lod || 'near';
  const mpt = opts.mpt || 2.2;
  const H = [w / 2, h / 2, d / 2];
  const b = opts.bevel !== undefined ? opts.bevel : chamferOf(Math.min(w, h, d), lod);
  const band = opts.trim ? trimSlot(opts.trim) : null;
  const sub = lod === 'near';
  const ring = Math.min(0.26, Math.min(w, h, d) * 0.22);
  const B = new Builder();
  // UV for a point, given the two in-plane axes of the face it belongs to.
  const uvOf = (p, ui, vi, vSpan) => {
    if (band) return [p[ui] / mpt, band.v0 + ((p[vi] + vSpan) / (2 * vSpan || 1)) * (band.v1 - band.v0)];
    return [p[ui] / mpt, p[vi] / mpt];
  };
  if (b <= 0) {
    // `impostor`: a plain six-quad box, still carrying the attribute so a geometry-wear material
    // bound to it is merely uniform rather than a shader link failure.
    for (let ai = 0; ai < 3; ai++) for (const s of [-1, 1]) {
      const ui = (ai + 1) % 3, vi = (ai + 2) % 3;
      const mk = (su, sv) => { const p = [0, 0, 0]; p[ai] = s * H[ai]; p[ui] = su * H[ui]; p[vi] = sv * H[vi]; return p; };
      const c = [mk(-1, -1), mk(1, -1), mk(1, 1), mk(-1, 1)];
      const n = [0, 0, 0]; n[ai] = s;
      B.quad(c[0], c[1], c[2], c[3], c.map(p => uvOf(p, ui, vi, H[vi])), [0.25, 0.25, 0.25, 0.25], n);
    }
    return B.geometry(opts.key);
  }
  // --- the six faces, inset by the chamfer, optionally split into a ring plus an interior -------
  for (let ai = 0; ai < 3; ai++) for (const s of [-1, 1]) {
    const ui = (ai + 1) % 3, vi = (ai + 2) % 3;
    const U = ringStops(H[ui] - b, ring, sub), V = ringStops(H[vi] - b, ring, sub);
    const n = [0, 0, 0]; n[ai] = s;
    for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < V.length - 1; j++) {
      const mk = (iu, jv) => { const p = [0, 0, 0]; p[ai] = s * H[ai]; p[ui] = U[iu][0]; p[vi] = V[jv][0]; return p; };
      const cv = (iu, jv) => Math.max(U[iu][1], V[jv][1]);
      const c = [mk(i, j), mk(i + 1, j), mk(i + 1, j + 1), mk(i, j + 1)];
      B.quad(c[0], c[1], c[2], c[3], c.map(p => uvOf(p, ui, vi, H[vi])),
        [cv(i, j), cv(i + 1, j), cv(i + 1, j + 1), cv(i, j + 1)], n);
    }
  }
  // --- twelve chamfer strips --------------------------------------------------------------------
  for (let a = 0; a < 3; a++) for (let bx = a + 1; bx < 3; bx++) {
    const c = 3 - a - bx;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const mk = (whichFull, t) => {
        const p = [0, 0, 0];
        p[a] = sa * (whichFull === a ? H[a] : H[a] - b);
        p[bx] = sb * (whichFull === bx ? H[bx] : H[bx] - b);
        p[c] = t * (H[c] - b);
        return p;
      };
      const q = [mk(a, -1), mk(a, 1), mk(bx, 1), mk(bx, -1)];
      const ideal = [0, 0, 0]; ideal[a] = sa; ideal[bx] = sb;
      const L = Math.SQRT1_2; ideal[a] *= L; ideal[bx] *= L;
      // Chamfer UVs project onto the (c, a-or-b) plane; the strip is centimetres wide, so which
      // of the two adjacent faces it borrows its parameterisation from does not read.
      const uvs = q.map(p => (band ? [p[c] / mpt, band.v0 + (band.v1 - band.v0) * 0.5] : [p[c] / mpt, p[a] / mpt]));
      B.quad(q[0], q[1], q[2], q[3], uvs, [EDGE_CURV, EDGE_CURV, EDGE_CURV, EDGE_CURV], ideal);
    }
  }
  // --- eight corner triangles -------------------------------------------------------------------
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const S = [sx, sy, sz];
    const p = (full) => { const q = [0, 0, 0]; for (let k = 0; k < 3; k++) q[k] = S[k] * (k === full ? H[k] : H[k] - b); return q; };
    const A = p(0), C = p(1), D = p(2);
    const L = Math.sqrt(3);
    const ideal = [sx / L, sy / L, sz / L];
    const uvs = [A, C, D].map(q => (band ? [q[0] / mpt, band.v0 + (band.v1 - band.v0) * 0.5] : [q[0] / mpt, q[1] / mpt]));
    const ux = C[0] - A[0], uy = C[1] - A[1], uz = C[2] - A[2];
    const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * ideal[0] + ny * ideal[1] + nz * ideal[2] >= 0) B.tri(A, C, D, null, uvs, [EDGE_CURV, EDGE_CURV, EDGE_CURV]);
    else B.tri(A, D, C, null, [uvs[0], uvs[2], uvs[1]], [EDGE_CURV, EDGE_CURV, EDGE_CURV]);
  }
  return B.geometry(opts.key);
}

/**
 * Bake `esCurvature` onto a geometry this file did not author, by measuring it.
 *
 * `MATERIAL_API.md` §6a defines the attribute as *"an edge between two faces meeting above a
 * threshold angle is 1, a face interior is 0, smoothed"*. That is a property of the mesh and it
 * can be read off any mesh: gather the face normals meeting at each position, and take the
 * largest disagreement between any pair of them. A vertex in the middle of a flat facet sees one
 * normal and scores 0; a vertex on an arris sees two normals `theta` apart and scores 1 once
 * `theta` passes the threshold, ramping below it.
 *
 * Two reasons this exists rather than a hand-written constant. First, `exterior.js` builds
 * icosahedral masses — moss cushions, clay swellings, egg terraces — that this kit has no part
 * for and should not pretend to; measuring them is the only honest way to give them wear.
 * Second, an attribute set is part of a `BatchedMesh` group key, so a geometry WITHOUT the
 * attribute cannot share a batch with one that has it. Baking it on the strays is what keeps the
 * settlement inside its existing ≤ 140 render-mesh budget.
 */
export function bakeCurvatureFromFaces(geometry, thresholdDeg = 26) {
  const pos = geometry.attributes.position;
  if (!pos) return geometry;
  const idx = geometry.index ? geometry.index.array : null;
  const n = idx ? idx.length : pos.count;
  const at = (i) => (idx ? idx[i] : i);
  const keyOf = (v) => `${Math.round(pos.getX(v) * 2048)},${Math.round(pos.getY(v) * 2048)},${Math.round(pos.getZ(v) * 2048)}`;
  const normals = new Map();
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (let t = 0; t < n; t += 3) {
    const a = at(t), b = at(t + 1), c = at(t + 2);
    A[0] = pos.getX(a); A[1] = pos.getY(a); A[2] = pos.getZ(a);
    B[0] = pos.getX(b); B[1] = pos.getY(b); B[2] = pos.getZ(b);
    C[0] = pos.getX(c); C[1] = pos.getY(c); C[2] = pos.getZ(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    for (const v of [a, b, c]) {
      const k = keyOf(v);
      let list = normals.get(k);
      if (!list) { list = []; normals.set(k, list); }
      list.push(nx, ny, nz);
    }
  }
  const cosT = Math.cos(thresholdDeg * Math.PI / 180);
  const out = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const list = normals.get(keyOf(v));
    if (!list) { out[v] = 0; continue; }
    let worst = 1;
    for (let i = 0; i < list.length; i += 3) for (let j = i + 3; j < list.length; j += 3) {
      const dot = list[i] * list[j] + list[i + 1] * list[j + 1] + list[i + 2] * list[j + 2];
      if (dot < worst) worst = dot;
    }
    // 1 at or beyond the threshold angle, ramping linearly to 0 at coplanar.
    out[v] = worst >= cosT ? Math.max(0, (1 - worst) / Math.max(1e-6, 1 - cosT)) : 1;
  }
  geometry.setAttribute('esCurvature', new THREE.BufferAttribute(out, 1));
  return geometry;
}

/**
 * A faceted prism — the round parts of the kit (posts, piles, barrels, lantern housings).
 *
 * A `CylinderGeometry` at 6 segments is a hexagonal tube whose vertical arrises are shaded smooth,
 * which is precisely the "no edge break" defect one axis over: the silhouette is faceted and the
 * shading pretends it is not. Here each facet is genuinely flat, the vertical arris between facets
 * carries `esCurvature = 1`, and so does the rim where the side meets the cap.
 */
export function prismGeometry(rTop, rBot, h, sides, opts = {}) {
  const lod = opts.lod || 'near';
  const mpt = opts.mpt || 2.2;
  const n = Math.max(3, lod === 'impostor' ? Math.min(sides, 5) : sides);
  const B = new Builder();
  const cols = lod === 'near' ? [0, 0.26, 0.74, 1] : [0, 1];
  const rows = lod === 'near' ? [0, 0.10, 0.90, 1] : [0, 1];
  const rowCurv = lod === 'near' ? [EDGE_CURV, FLAT_CURV, FLAT_CURV, EDGE_CURV] : [RING_CURV, RING_CURV];
  const colCurv = lod === 'near' ? [EDGE_CURV, FLAT_CURV, FLAT_CURV, EDGE_CURV] : [RING_CURV, RING_CURV];
  const at = (i, cu, rv) => {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const r = rBot + (rTop - rBot) * rv;
    const p0 = [Math.cos(a0) * r, -h / 2 + rv * h, Math.sin(a0) * r];
    const p1 = [Math.cos(a1) * r, -h / 2 + rv * h, Math.sin(a1) * r];
    return [p0[0] + (p1[0] - p0[0]) * cu, p0[1], p0[2] + (p1[2] - p0[2]) * cu];
  };
  const circ = Math.PI * (rTop + rBot);
  for (let i = 0; i < n; i++) {
    for (let ci = 0; ci < cols.length - 1; ci++) for (let ri = 0; ri < rows.length - 1; ri++) {
      const q = [at(i, cols[ci], rows[ri]), at(i, cols[ci + 1], rows[ri]), at(i, cols[ci + 1], rows[ri + 1]), at(i, cols[ci], rows[ri + 1])];
      const a = (i + 0.5) / n * Math.PI * 2;
      const uvs = q.map(p => [((i + cols[0]) / n) * circ / mpt + Math.hypot(p[0], p[2]) * 0 + (p[0] * Math.cos(a) + p[2] * Math.sin(a)) / mpt, p[1] / mpt]);
      B.quad(q[0], q[1], q[2], q[3], uvs, [
        Math.max(colCurv[ci], rowCurv[ri]), Math.max(colCurv[ci + 1], rowCurv[ri]),
        Math.max(colCurv[ci + 1], rowCurv[ri + 1]), Math.max(colCurv[ci], rowCurv[ri + 1])],
        [Math.cos(a), 0, Math.sin(a)]);
    }
  }
  if (opts.caps !== false) for (const [rv, r, s] of [[1, rTop, 1], [0, rBot, -1]]) {
    if (r <= 1e-5) continue;
    const y = -h / 2 + rv * h;
    const cen = [0, y, 0];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = [Math.cos(a0) * r, y, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, y, Math.sin(a1) * r];
      const uvs = [cen, p0, p1].map(p => [p[0] / mpt, p[2] / mpt]);
      const ideal = [0, s, 0];
      if (s > 0) B.quad(cen, p0, p1, cen, uvs.concat([uvs[0]]), [FLAT_CURV, EDGE_CURV, EDGE_CURV, FLAT_CURV], ideal);
      else B.quad(cen, p1, p0, cen, [uvs[0], uvs[2], uvs[1], uvs[0]], [FLAT_CURV, EDGE_CURV, EDGE_CURV, FLAT_CURV], ideal);
    }
  }
  return B.geometry(opts.key);
}

/* ================================================================================================
 * SECTION 2 — MATERIALS. The library consumption, in one place.
 *
 * Every material a kit part is drawn with comes from C's factory, with the region palette swatch,
 * a wear amount, `wearFrom: 'geometry'` (see the header), and, where the part is a trim member,
 * the settlement's trim slot. Nothing here constructs a `MeshStandardMaterial`.
 *
 * Cached, for the reason `interior.js` records: a material is a shader program the first time it
 * is drawn, and a fresh set per building means a compile hitch per building.
 * ==============================================================================================*/

const MAT_CACHE = new Map();

/**
 * A kit ROLE IS a material family. There is deliberately no second vocabulary here: inventing a
 * kit-side name for `clay` is how two registries drift, and `MATERIAL_API.md` §2 says plainly that
 * a surface which does not fit one of the twenty is a variant spec, not a twenty-first family.
 * `KIT_ROLES` therefore maps each family to itself, and exists only so a caller can enumerate.
 */
export const KIT_ROLES = Object.freeze(Object.fromEntries(MATERIAL_FAMILIES.map(f => [f, f])));

/**
 * `spec` is a variant, never a definition: `{role, colour, roughness, metalness, palette, wear,
 * trim, tilingScale}`. Two towns' stone is two palette swatches over one stone family, which is
 * the rule `MATERIAL_API.md` §4 states and the census enforces.
 */
/**
 * QUANTISATION, and it is a draw-call gate rather than an aesthetic choice.
 *
 * `compressSettlementMeshes()` batches one draw per MATERIAL, so a continuous wear value is a
 * continuous supply of new draw calls. The first version of this file wrote `wear + 0.15` at one
 * call site and `wear + 0.22` at another and took a settlement from 113 render meshes to 194,
 * failing `w1-30-settlement-batching.mjs`'s ≤ 140 row that already existed. Wear now snaps to
 * 0.05, roughness and metalness to 0.05, and colour to 5 bits a channel — none of which is
 * distinguishable in a frame, all of which is distinguishable to the batcher.
 */
const q = (v, step) => (v === undefined ? undefined : Math.round(v / step) * step);
const qColour = (c) => (c === undefined ? undefined : ((c >> 19 & 31) << 19) | ((c >> 11 & 31) << 11) | ((c >> 3 & 31) << 3));

export function kitMaterial(spec) {
  const role = spec.role || 'timber';
  const family = KIT_ROLES[role];
  if (!family) throw new Error(`kits.js: unknown kit role '${role}' (known: ${Object.keys(KIT_ROLES).join(', ')})`);
  // A TRIM MEMBER TAKES THE SETTLEMENT'S COLOUR, NOT THE BUILDING'S. A course, a lashing or a
  // bone binding is the town's band — `world-art.js` names it per settlement, not per building —
  // so it drops the per-building tint and keeps only the family and the region palette swatch.
  // That is also what collapses three colour buckets of every trim material into one, and it is
  // the difference between passing and failing the ≤ 140 render-mesh row.
  const colour = spec.trim ? undefined : qColour(spec.colour);
  const rough = q(spec.roughness, 0.05), metal = q(spec.metalness, 0.05);
  const wear = q(Math.min(1, spec.wear ?? 0), 0.05), wet = q(Math.min(1, spec.wetness ?? 0), 0.05);
  const key = [role, colour ?? '-', rough ?? '-', metal ?? '-', spec.palette ?? '-',
    wear, spec.trim ?? '-', spec.tilingScale ?? 1, wet].join('|');
  const hit = MAT_CACHE.get(key);
  if (hit) return hit;
  const opts = { wearFrom: 'geometry' };
  if (colour !== undefined) opts.color = colour;
  if (rough !== undefined) opts.roughness = rough;
  if (metal !== undefined) opts.metalness = metal;
  if (spec.palette) opts.palette = spec.palette;
  opts.wear = wear;
  if (wet) opts.wetness = wet;
  if (spec.trim) opts.trim = spec.trim;
  if (spec.tilingScale) opts.tilingScale = spec.tilingScale;
  const mat = worldMaterial(family, opts);
  mat.userData.w130Kit = { role, family, trim: spec.trim || null, palette: spec.palette || null };
  MAT_CACHE.set(key, mat);
  return mat;
}

/** Metres of surface one texture tile covers, for the family a role maps onto. Kit UVs are laid
 * out so one UV unit is this many metres — `MATERIAL_API.md` §5, the texel-density seam. */
export function kitTexelMetres(role) {
  return materialTiling(KIT_ROLES[role] || 'timber', {}).metresPerTile;
}

/* ================================================================================================
 * SECTION 3 — THE TWENTY-FIVE PARTS.
 *
 * A part factory takes `(spec)` and returns a `THREE.Group` or `THREE.Mesh` carrying
 * `userData.kitId`. Sizes are metres and are exact outer dimensions. Every factory honours
 * `spec.lod` ∈ near | far | impostor — a part without LODs is a hard fail in the plan.
 * ==============================================================================================*/

const REGISTRY = new Map();

/** Register a kit part factory under `id`. Throws on a duplicate id: a second definition of an
 * existing kit part is a variant spec against the first (directive §3), never a silent
 * overwrite. */
export function registerKit(id, factory) {
  if (typeof factory !== 'function') throw new Error(`registerKit('${id}') requires a factory function`);
  if (REGISTRY.has(id)) throw new Error(`kits.js: kit '${id}' is already registered`);
  REGISTRY.set(id, factory);
  return factory;
}

/** Build one instance of kit part `id`, in `spec`. Fails closed on an unknown id. */
export function kit(id, spec = {}) {
  const factory = REGISTRY.get(id);
  if (!factory) throw new Error(`kits.js: unknown kit id '${id}' (known: ${[...REGISTRY.keys()].join(', ') || 'none registered yet'})`);
  const lod = spec.lod || 'near';
  if (!KIT_LODS.includes(lod)) throw new Error(`kits.js: unknown lod '${lod}' (known: ${KIT_LODS.join(', ')})`);
  const node = factory({ ...spec, lod });
  node.userData.kitId = id;
  node.userData.kitLod = lod;
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = spec.castShadow !== false;
    o.receiveShadow = true;
    if (!o.userData.kitId) o.userData.kitId = id;
  });
  return node;
}

export function knownKits() { return [...REGISTRY.keys()].sort(); }

/**
 * HOW BIG IS THE ROOF? — the question nothing outside this file could ask, and the reason a
 * roof twice its building's size lived in four settlements until somebody rendered a frame.
 *
 * Every clearance test in the tree — `settlementFootprintClearance()`, `build-deck.mjs`'s street
 * stand, the camera's spring arm — reasons about `drawn_footprint_m`. A roof is not a footprint,
 * so all of them were structurally blind to `roof.shell` drawing 1.97x its building's plan and
 * standing a player under a roof out in the open (`reports/w1-30de-remediation/README.md` §4).
 * Fixing the eave closes that instance; publishing the extent closes the CLASS, which is the half
 * that survives the fix.
 *
 * Returns the union roof plan under `node`, in the node's own local frame, in metres, or `null`
 * if there is no roof under it. `over` is the largest authored eave found. Offline: no renderer,
 * no raycast, no world — a caller can build one building in Node and ask.
 *
 * IT IS THE AUTHORED PLAN, NOT THE MESH BOUNDING BOX, and the difference is measured rather than
 * hoped at. `tools/render/w1-30e-roof-extent.mjs --self-test` compares this against the drawn box
 * on all 149 roofed buildings in the province: `roof.shell` agrees to **1.000–1.001**, `roof.reed`
 * to 1.011, and `roof.hip` runs up to **1.050** — the eave board's own depth and the chamfer,
 * which sit proud of the plan. So the drawn roof can be up to 5% wider than this number, and a
 * clearance consumer must therefore apply a margin (1.1 is comfortable) rather than treat this as
 * an upper bound. Under-stating a roof is the dangerous direction; the size of the understatement
 * is bounded, checked on every build, and written here so nobody has to rediscover it.
 *
 * The intended consumers are named rather than assumed, because a published number nobody reads
 * is the failure this project has a rule about: `tools/visual/build-deck.mjs` should gate its
 * street stand on `footprintClearance - roofOverhang` instead of on the footprint alone, and
 * `tools/render/w1-30e-roof-extent.mjs` is the regression gate. Neither wiring is in this change —
 * `build-deck.mjs` belongs to W1-30V and W1-30DE-REMEDIATION — and saying so is more use than
 * pretending the join exists.
 */
export function roofPlanExtent(node) {
  let w = 0, d = 0, over = 0, found = false;
  node.traverse((o) => {
    const rp = o.userData && o.userData.roofPlan;
    if (!rp) return;
    found = true;
    // The roof group may be scaled or rotated by its placer; take the placer's scale into account
    // and swap the axes on a quarter turn, which is the only rotation `buildKitRoof()` applies.
    const sx = o.scale ? Math.abs(o.scale.x) : 1, sz = o.scale ? Math.abs(o.scale.z) : 1;
    const quarter = o.rotation ? Math.abs(Math.round(o.rotation.y / (Math.PI / 2))) % 2 === 1 : false;
    const pw = (quarter ? rp.d : rp.w) * (quarter ? sz : sx);
    const pd = (quarter ? rp.w : rp.d) * (quarter ? sx : sz);
    if (pw > w) w = pw;
    if (pd > d) d = pd;
    if (rp.over > over) over = rp.over;
  });
  return found ? { w, d, over } : null;
}

/* --- small helpers the factories share -------------------------------------------------------- */

const cache = new Map();
/** Geometry cache. Kit parts repeat by the thousand across a settlement and an identical geometry
 * must be one object, or `compressBuildingMeshes()` cannot batch it and the draw budget goes. */
function geo(key, make) {
  const hit = cache.get(key);
  if (hit) return hit;
  const g = make();
  g.userData.w130BatchKey = key;
  cache.set(key, g);
  return g;
}
const r2 = (v) => Math.round(v * 100) / 100;

function slab(w, h, d, mat, spec, tag, trim) {
  const mpt = kitTexelMetres(spec.role || 'timber');
  const key = `kit:${tag}:${spec.lod}:${r2(w)}:${r2(h)}:${r2(d)}:${trim || '-'}:${r2(mpt)}`;
  return new THREE.Mesh(geo(key, () => chamferBoxGeometry(r2(w), r2(h), r2(d), { lod: spec.lod, mpt, trim })), mat);
}
function drum(rt, rb, h, sides, mat, spec, tag) {
  const mpt = kitTexelMetres(spec.role || 'timber');
  const key = `kit:${tag}:${spec.lod}:${r2(rt)}:${r2(rb)}:${r2(h)}:${sides}:${r2(mpt)}`;
  return new THREE.Mesh(geo(key, () => prismGeometry(r2(rt), r2(rb), r2(h), sides, { lod: spec.lod, mpt })), mat);
}
/** Place a part. Rotations ACCUMULATE rather than overwrite, because several factories set a rake
 * or a pitch on the mesh before placing it and a `set()` here would silently flatten them. */
function at(parent, mesh, x = 0, y = 0, z = 0, ry = 0, rz = 0, rx = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(mesh.rotation.x + rx, mesh.rotation.y + ry, mesh.rotation.z + rz);
  parent.add(mesh);
  return mesh;
}
/** Deterministic 0..1 from an integer seed and a channel. No `Math.random` anywhere in this file:
 * the same plan must build the same town every time or captures stop hashing. */
function jitter(seed, ch) { const x = Math.sin((seed + 1) * 12.9898 + ch * 78.233) * 43758.5453; return x - Math.floor(x); }

const M = (spec, over) => kitMaterial({ ...spec.mat, ...over });

/** How much MORE worn a trim member is than the surface it sits on. One number, everywhere. Nine
 * slightly different numbers is nine slightly different materials, and a material is a draw call
 * (see the quantisation note above). A course, a strap and a rail are all "the bit hands and
 * weather reach first" and there is no frame in which they differ by 0.03. */
const TRIM_WEAR = 0.2;

const GLOW_CACHE = new Map();
function lanternGlow(emissive, intensity) {
  const key = `${emissive}|${intensity}`;
  const hit = GLOW_CACHE.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: 0x3a1e08, emissive, emissiveIntensity: intensity, roughness: 0.6, toneMapped: true });
  m.userData.visualFamily = 'resin';
  m.userData.w130Kit = { role: 'resin', family: 'resin', trim: null, palette: null };
  GLOW_CACHE.set(key, m);
  return m;
}

/* --- 1..3 : the wall family -------------------------------------------------------------------- */

registerKit('wall', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 3, h = s.h ?? 3.2, t = s.t ?? 0.36;
  at(g, slab(w, h, t, M(s), s, 'wall'), 0, h / 2, 0);
  return g;
});

registerKit('wall.window', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 3, h = s.h ?? 3.2, t = s.t ?? 0.36;
  const ow = Math.min(s.openW ?? 0.95, w - 0.6), oh = s.openH ?? 0.95, sillY = s.sillY ?? Math.min(h - oh - 0.4, 1.25);
  const side = (w - ow) / 2;
  const wall = M(s);
  at(g, slab(side, h, t, wall, s, 'wall'), -(ow + side) / 2, h / 2, 0);
  at(g, slab(side, h, t, wall, s, 'wall'), (ow + side) / 2, h / 2, 0);
  at(g, slab(ow, sillY, t, wall, s, 'wall'), 0, sillY / 2, 0);
  at(g, slab(ow, Math.max(0.15, h - sillY - oh), t, wall, s, 'wall'), 0, sillY + oh + Math.max(0.15, h - sillY - oh) / 2, 0);
  // Reveal, sill and lintel: the thickness that makes a hole in a wall read as a window rather
  // than as a dark rectangle painted on it.
  const trimMat = M(s, { role: s.trimRole || 'timber', trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  at(g, slab(ow + 0.34, 0.14, t + 0.20, trimMat, s, 'sill', s.trim), 0, sillY - 0.05, 0);
  at(g, slab(ow + 0.30, 0.13, t + 0.16, trimMat, s, 'lintel', s.trim), 0, sillY + oh + 0.05, 0);
  for (const sx of [-1, 1]) at(g, slab(0.10, oh, t + 0.10, trimMat, s, 'jamb'), sx * (ow / 2 + 0.05), sillY + oh / 2, 0);
  if (s.glazed !== false) at(g, slab(ow - 0.05, oh - 0.05, 0.05, M(s, { role: 'resin', colour: s.glassColour ?? 0xbcd6e0, roughness: 0.18, wear: 0 }), s, 'pane'), 0, sillY + oh / 2, 0.02);
  return g;
});

registerKit('corner', (s) => {
  // A corner is not a post: it is the vertical the two wall planes die into, and it is slightly
  // proud of both so the junction casts its own line down the elevation.
  const g = new THREE.Group();
  const h = s.h ?? 3.2, t = s.t ?? 0.26;
  at(g, slab(t, h, t, M(s), s, 'corner'), 0, h / 2, 0);
  at(g, slab(t + 0.14, 0.18, t + 0.14, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'cornercap', s.trim), 0, h - 0.09, 0);
  return g;
});

/* --- 4..6 : the three rooflines ----------------------------------------------------------------
 * Roof selection is where a skyline comes from, and the plan's approach-shot gate is decided here
 * more than anywhere else in the file. Three profiles, and the grammars mix them: a hip, a reed
 * thatch of stacked courses, and a grown shell of radial facets.
 * --------------------------------------------------------------------------------------------- */

registerKit('roof.hip', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 5, d = s.d ?? 5, rise = s.rise ?? Math.min(w, d) * 0.30, over = s.over ?? 0.55;
  const pitchN = s.lod === 'near' ? 3 : 1;
  const mat = M(s);
  // Four trapezoidal slabs, each a real slab with thickness and a chamfered eave, meeting at a
  // ridge. Not a cone with four segments — a cone has no eave and no thickness, and the eave is
  // the single line that says "roof" at 60 m.
  const W = w + over * 2, D = d + over * 2;
  for (let i = 0; i < 4; i++) {
    const along = i % 2 === 0 ? W : D;
    const run = (i % 2 === 0 ? D : W) / 2;
    const slope = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    const panel = new THREE.Group();
    // The pitch is stepped into `pitchN` courses at `near` so the slope carries shadow lines
    // instead of being one unbroken plane; at `far` it is a single slab and the silhouette is
    // identical, which is the whole point of an LOD.
    for (let k = 0; k < pitchN; k++) {
      const t0 = k / pitchN, t1 = (k + 1) / pitchN, mid = (t0 + t1) / 2;
      // Width is taken from the LOWER edge of the course, not its middle. Taking it from the
      // middle made every course 12% narrower than the wall it sits on, and `w1-04-r4-join.mjs`
      // raycasts straight down for exactly that: 56 of 205 roofs stopped covering their own
      // building. Courses lap; a course that is a little wide is a roof, a course that is a
      // little narrow is a hole.
      const p = slab(Math.max(0.5, along * (1 - t0 * 0.70)), 0.17, (t1 - t0) * slope + 0.06, mat, s, 'roofpanel');
      at(panel, p, 0, mid * rise, run * (1 - mid), 0, 0, -ang);
    }
    // The eave board — the shadow line under the overhang, and the part that carries the trim.
    at(panel, slab(along, 0.16, 0.22, M(s, { trim: s.trim, role: s.trimRole || s.mat?.role, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'eave', s.trim), 0, -0.02, run);
    panel.rotation.y = i * Math.PI / 2;
    g.add(panel);
  }
  at(g, slab(Math.min(w, d) * 0.22, 0.16, Math.min(w, d) * 0.22, mat, s, 'ridgecap'), 0, rise + 0.02, 0);
  g.userData.roofPlan = { w: W, d: D, over, footprint: [w, d] };
  return g;
});

registerKit('roof.reed', (s) => {
  // Thatch is courses. Each course is a slab that overhangs the one below, so the profile is a
  // stack of shadow lines rather than a single canted plane — which is exactly the thing that
  // makes a reed roof read as reed at any distance.
  const g = new THREE.Group();
  const w = s.w ?? 5, d = s.d ?? 5, rise = s.rise ?? Math.min(w, d) * 0.34, over = s.over ?? 0.5;
  const n = s.lod === 'near' ? 6 : s.lod === 'far' ? 4 : 2;
  const mat = M(s);
  for (const sign of [-1, 1]) for (let i = 0; i < n; i++) {
    const t = i / n, t1 = (i + 1) / n;
    const y = rise * t, depth = (d / 2 + over) * (1 - t);
    const c = slab(w + over * 2 - t * w * 0.16, 0.14 + (1 - t) * 0.05, (d / 2 + over) / n + 0.14, mat, s, 'thatch');
    c.rotation.x = sign * Math.atan2(rise / n, (d / 2 + over) / n);
    at(g, c, 0, y + 0.05, sign * (depth - (d / 2 + over) / n / 2));
    void t1;
  }
  // The ridge bundle, lashed. This is the settlement's trim band, on the one line of the roof a
  // player sees from every approach.
  at(g, drum(0.16, 0.16, w + over, s.lod === 'near' ? 7 : 5, M(s, { role: s.trimRole || 'reed', trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'ridgebundle'), 0, rise + 0.10, 0, 0, Math.PI / 2);
  g.userData.roofPlan = { w: w + over * 2, d: d + over * 2, over, footprint: [w, d] };
  return g;
});

registerKit('roof.needle', (s) => {
  /* THE THORN THATCH — the fourth roof, and the first new roof profile the game has had.
   *
   * WHY IT EXISTS. `game/data/world/settlements/thorn.json` `architecture_kit.silhouette` promises
   * *"the thorn thatch — black needle-wood laid in courses, WHICH NO OTHER SETTLEMENT USES"*, and
   * until now the renderer had three roof ids in total and Thorn drew reed and hip like everybody
   * else. The one thing the starting town's own record says is unique to it did not exist.
   * `reports/thorn-plates/2026-08-14-thorn-plates.md` §1a is the measurement.
   *
   * WHAT MAKES IT A DIFFERENT SILHOUETTE, rather than a reed roof with a different material — which
   * is the failure mode this part has to avoid, because Ruling E1 counts SILHOUETTES, not parts:
   *
   *  1. IT IS STEEP. `rise = min(w,d) * 0.62` against `roof.reed`'s 0.34 and `roof.hip`'s 0.30. At
   *     60 m the profile is a dark wedge about twice the height of anything else in the province,
   *     and steepness is the one roof property that survives distance, fog and a 640x360 capture.
   *  2. IT IS A GABLE, NOT A HIP. Two pitches, so the end elevations are open triangles. `roof.hip`
   *     closes all four sides and `roof.shell` is a dome; a gable end is a third shape.
   *  3. THE RIDGE BRISTLES. Needle-wood is laid in courses and the butts are not trimmed, so spars
   *     project past the ridge line in both directions. That is the detail the record names, and it
   *     is what breaks the skyline into something you can pick out of a row of roofs.
   *
   * THE EAVE DISCIPLINE `roof.shell` HAD TO LEARN THE HARD WAY (see its header): the plan of this
   * roof is its building plus the eave the caller authored, and nothing else. Every projecting
   * needle is held to 0.35 m past the gable end, which is INSIDE `over` at every call site
   * `exterior.js buildKitRoof()` makes (0.45-0.80 m) — so the bristle cannot become an 8 m canopy
   * the way the shell's did, and `roofPlanExtent()` reports the same number it would without them.
   */
  const g = new THREE.Group();
  const w = s.w ?? 5, d = s.d ?? 5;
  const rise = s.rise ?? Math.min(w, d) * 0.62;
  const over = s.over ?? 0.5;
  const W = w + over * 2, D = d + over * 2;
  const n = s.lod === 'near' ? 5 : s.lod === 'far' ? 3 : 2;
  const mat = M(s);
  // The courses. Each one laps the one below, like `roof.reed`, but there are fewer and they are
  // thicker: needle-wood is a coarser bundle than reed and the shadow lines are further apart.
  for (const sign of [-1, 1]) for (let i = 0; i < n; i++) {
    const t = i / n;
    const y = rise * t;
    const halfD = D / 2;
    const depth = halfD * (1 - t);
    const course = slab(W - t * w * 0.10, 0.20 + (1 - t) * 0.08, halfD / n + 0.20, mat, s, 'needlecourse');
    course.rotation.x = sign * Math.atan2(rise / n, halfD / n);
    at(g, course, 0, y + 0.06, sign * (depth - halfD / n / 2));
  }
  // The gable infill — the triangle each end, which is what makes this read as a gable at all.
  // Stepped, because a chamfered slab is the only primitive here and three of them make a
  // serviceable raking edge at the distance this is seen from.
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
    const t0 = k / 3, t1 = (k + 1) / 3;
    at(g, slab(W * (1 - t1) * 0.92, rise / 3 + 0.05, 0.22, mat, s, 'needlegable'),
      0, rise * (t0 + t1) / 2, sz * (D / 2 - 0.14));
  }
  // THE BRISTLE. The ridge bundle, and the needle butts projecting past it. `sides: 5` keeps each
  // spar a cheap prism; the count is the only thing that scales with LOD, because at `far` the
  // bristle is a texture-free silhouette detail and five of them read the same as eleven.
  const trimMat = M(s, { role: s.trimRole || 'thorn', trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  at(g, drum(0.17, 0.17, W - over * 0.6, 5, trimMat, s, 'needleridge'), 0, rise + 0.10, 0, 0, Math.PI / 2);
  const spars = s.lod === 'near' ? 11 : s.lod === 'far' ? 7 : 4;
  for (let i = 0; i < spars; i++) {
    const u = (i / (spars - 1) - 0.5) * (W - over * 0.8);
    const lean = ((i % 3) - 1) * 0.16;
    const spar = drum(0.045, 0.06, 0.78 + (i % 2) * 0.22, 4, trimMat, s, 'needlespar');
    spar.rotation.z = lean;
    at(g, spar, u, rise + 0.42, ((i % 2) - 0.5) * 0.22, 0, 0, ((i % 4) - 1.5) * 0.09);
  }
  // Both gable ends get a short projecting butt — 0.35 m, inside the authored eave, see the header.
  for (const sz of [-1, 1]) {
    const butt = drum(0.05, 0.07, 0.35, 4, trimMat, s, 'needlebutt');
    butt.rotation.x = Math.PI / 2;
    at(g, butt, 0, rise + 0.10, sz * (D / 2 - 0.05 + 0.175));
  }
  g.userData.roofPlan = { w: W, d: D, over, footprint: [w, d] };
  return g;
});

/**
 * THE SHELL'S EAVE — the null-control lever, and it is not a debug flag.
 *
 * `null` means "use the eave the caller passed", which is the shipped behaviour. A number
 * overrides it, and `0` is the arm `tools/render/w1-30e-roof-extent.mjs` runs as `null:no-eave`:
 * the shell shrunk to exactly its building's footprint. That is the PLAUSIBLE wrong answer to the
 * defect below rather than the trivial one — it clears the street stand, it makes the approach
 * shot resolve, and it costs the overhang that is the only thing separating a grown shell from a
 * box with a lid. "No roof at all" would fail everything by accident and is not an arm.
 *
 * Public and settable from outside for the reason `world/province.js` gives about `drawBuildings`:
 * a claim that the eave is what moved a number is only a claim until the eave can be perturbed
 * from outside and the number watched to move.
 */
let SHELL_EAVE_OVERRIDE_M = null;
export function setShellEave(metres) {
  SHELL_EAVE_OVERRIDE_M = (metres === null || metres === undefined) ? null : Number(metres);
}
export function shellEaveOverride() { return SHELL_EAVE_OVERRIDE_M; }

registerKit('roof.shell', (s) => {
  /* THE ROOF THAT SWALLOWED THE TOWN — what was wrong, and why a footprint proxy could never see it.
   *
   * This part used to draw a roof **1.97x its building's own footprint** — an ~8 m overhang on
   * every side of a 16 m building — in archon, helstrom, lilmoth and soulrest, against 1.17x for
   * `roof.hip` and `roof.reed`. `reports/w1-30de-remediation/README.md` §4 found it by RENDERING A
   * FRAME: a player standing 3.79 m clear of every footprint in Soulrest was still under a roof,
   * and Soulrest's street shot failed at every light in both hardware runs because of it. No
   * geometric gate in this tree could have found it, because every one of them measures building
   * FOOTPRINTS and a roof is not a footprint.
   *
   * THE RULING (reversible): the eave was wrong, not the footprint. Three pieces of evidence, in
   * increasing order of how hard they are to argue with.
   *
   *  1. `exterior.js buildKitRoof()` passes `over: 0.45 + jitter * 0.35` to ALL THREE roof kits.
   *     `roof.hip` reads it, `roof.reed` reads it, and this part never did. The authored eave for
   *     this roof exists, is 0.45-0.80 m, and had no consumer — so an 8 m overhang cannot be
   *     authored intent, because the author wrote 0.6 m one call up and it was thrown away.
   *  2. `drum()`'s parameters are RADII — `prismGeometry` uses them as `Math.cos(a) * r`. Fifteen
   *     of its sixteen call sites in this file pass a radius. This one passed `r0 * 2`, where
   *     `r0 = 0.5 * cos(0) = 0.5` is the half-extent of a unit plan meant to be scaled by (w, d)
   *     into exactly w x d. Doubling it made the plan 2w x 2d. It is a units slip, in one place.
   *  3. The measured ratio was 1.97, not "about two" — which is what a 9-sided prism's bounding
   *     box does to a diameter of exactly 2. The arithmetic predicts the observed number.
   *
   * WHAT WOULD OVERTURN IT: a settlement document, art-direction plate or region record asking for
   * a deep sheltering canopy over the street in the shell towns. Nothing in `docs/art-direction/`
   * or the four settlements' records says any such thing; if one turns up, the right answer is not
   * to re-widen this part but to build the canopy as public realm, where the street can be planned
   * around it and collision can know about it.
   *
   * AND THE PART THAT IS NOT A UNITS SLIP, because deleting the `* 2` alone would have been wrong.
   * An ellipse with the same span as a rectangle does not cover the rectangle: `w1-04-r4-join.mjs`
   * §4 says so in its own header — "an ellipsoid dome scaled to w x d has a bounding box exactly
   * w x d and leaves all four corners open to the sky" — and that hole was photographed once
   * already. A circumscribing ellipse needs 1.41x span before the eave, which still stands a
   * player under a roof outdoors. So the dome does not carry the corners at all: it sits on a
   * SQUARED EAVES PLATE, which is how a round roof meets a rectangular building everywhere it is
   * built that way, covers the plan exactly, spans footprint + the authored eave, and gives this
   * roof the one thing it never had — the eave shadow line that `roof.hip`'s own comment calls
   * "the single line that says 'roof' at 60 m".
   */
  const g = new THREE.Group();
  const w = s.w ?? 5, d = s.d ?? 5, rise = s.rise ?? Math.min(w, d) * 0.42;
  const over = SHELL_EAVE_OVERRIDE_M === null ? (s.over ?? 0.5) : SHELL_EAVE_OVERRIDE_M;
  // Same idiom, same line, as `roof.hip` twenty lines up. The plan of this roof is its building
  // plus its eave, and nothing else.
  const W = w + over * 2, D = d + over * 2;
  const rings = s.lod === 'near' ? 3 : s.lod === 'far' ? 2 : 1;
  const sides = s.lod === 'near' ? 9 : s.lod === 'far' ? 7 : 5;
  const mat = M(s);
  // The eaves plate. Thin, chamfered, and the full plan — it is what keeps the rain out of the
  // four corners the dome above it cannot reach, and what casts the eave line.
  at(g, slab(W, 0.18, D, mat, s, 'shelleaves'), 0, 0.09, 0);
  for (let r = 0; r < rings; r++) {
    const t0 = r / rings, t1 = (r + 1) / rings;
    const r0 = 0.5 * Math.cos(t0 * Math.PI / 2), r1 = 0.5 * Math.cos(t1 * Math.PI / 2);
    const y0 = rise * Math.sin(t0 * Math.PI / 2), y1 = rise * Math.sin(t1 * Math.PI / 2);
    const band = drum(r1, r0, Math.max(0.12, y1 - y0), sides, mat, s, 'shellband');
    band.scale.set(W, 1, D);
    at(g, band, 0, 0.14 + (y0 + y1) / 2, 0);
  }
  // Ribs, on the shell's arrises, in the settlement trim.
  //
  // Each rib's length is the shell's OWN chord at that bearing, not `max(W, D)`. The same probe
  // that caught the eave caught this: on `archon-shrine`, a 5.18 x 14.41 m building, the ribs were
  // cut to the long axis and swung across the short one, so a rib at 72 degrees projected 4.5 m
  // past a wall 2.6 m from the centre and the roof measured **2.77x** its own building on that
  // axis — a bigger ratio than the eave defect itself, in a part nobody was looking at. A member
  // sized from `max()` of a plan it is placed radially in will always overhang the narrow axis of
  // an elongated plan; the chord is the only length that stays on the shell it is supposed to
  // trace.
  const ribMat = M(s, { role: s.trimRole || 'bone', trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  const ribN = s.lod === 'near' ? 5 : 3;
  for (let i = 0; i < ribN; i++) {
    const a = (i / ribN) * Math.PI;
    // Half-chord of the ellipse (W/2, D/2) along the rib's own bearing. The rib is placed with a
    // Y rotation of `a` and runs along its local +z, so its world direction is (sin a, cos a).
    const half = 1 / Math.hypot(Math.sin(a) / (W / 2), Math.cos(a) / (D / 2));
    const rib = slab(0.13, 0.11, half * 2 * 0.96, ribMat, s, 'shellrib', s.trim);
    rib.rotation.x = -0.20;
    at(g, rib, 0, rise * 0.52, 0, a);
  }
  // PUBLISH THE EXTENT. This is the half of the defect that survives the fix: nothing outside this
  // file could ask how big a roof was, so `build-deck.mjs`'s street stand, the camera's spring arm
  // and every clearance test reasoned about footprints and were structurally blind to a roof of
  // any size. `roofPlanExtent()` below reads this off a built node with no renderer, so the next
  // roof that overhangs by eight metres is a number somebody can gate on instead of a frame
  // somebody has to notice.
  g.userData.roofPlan = { w: W, d: D, over, footprint: [w, d] };
  return g;
});

/* --- 7..10 : openings and the ways up ---------------------------------------------------------- */

registerKit('door', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 1.8, h = s.h ?? 2.3, t = s.t ?? 0.14;
  const frame = M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  for (const sx of [-1, 1]) at(g, slab(0.16, h + 0.18, t + 0.16, frame, s, 'doorjamb', s.trim), sx * (w / 2 + 0.08), (h + 0.18) / 2, 0);
  at(g, slab(w + 0.5, 0.22, t + 0.24, frame, s, 'doorlintel', s.trim), 0, h + 0.11, 0);
  at(g, slab(w + 0.7, 0.16, 0.9, M(s, { role: 'stone', wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'threshold'), 0, 0.07, 0.34);
  if (s.leaf !== false) {
    const leaf = new THREE.Group();
    const lm = M(s);
    at(leaf, slab(w * 0.94, h - 0.10, t, lm, s, 'doorleaf'), w * 0.47, (h - 0.10) / 2, 0);
    // Boards and two straps: a plank door, not a painted rectangle.
    if (s.lod !== 'impostor') {
      const strap = M(s, { role: 'metal', roughness: 0.5, metalness: 0.7, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
      for (const y of [h * 0.24, h * 0.74]) at(leaf, slab(w * 0.9, 0.07, t + 0.05, strap, s, 'doorstrap'), w * 0.47, y, 0);
      at(leaf, drum(0.05, 0.05, 0.22, 5, strap, s, 'doorhandle'), w * 0.86, h * 0.5, t * 0.7, 0, 0, Math.PI / 2);
    }
    leaf.position.set(-w / 2, 0, 0);
    leaf.rotation.y = s.swing ?? 0.55;
    g.add(leaf);
  }
  return g;
});

registerKit('shutter', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 0.55, h = s.h ?? 0.95;
  const mat = M(s);
  at(g, slab(w, h, 0.05, mat, s, 'shutterleaf'), 0, 0, 0);
  const n = s.lod === 'near' ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const l = slab(w - 0.06, 0.055, 0.07, mat, s, 'louvre');
    l.rotation.x = 0.32;
    at(g, l, 0, -h / 2 + (i + 0.7) * (h / (n + 0.4)), 0.035);
  }
  return g;
});

registerKit('stair', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 1.3, rise = s.rise ?? 2.4, run = s.run ?? 2.2;
  const n = Math.max(3, Math.round(rise / 0.22));
  const mat = M(s);
  const steps = s.lod === 'impostor' ? Math.min(4, n) : n;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    at(g, slab(w, 0.14, run / steps + 0.10, mat, s, 'tread'), 0, t * rise, -t * run);
  }
  for (const sx of [-1, 1]) {
    const str = slab(0.13, 0.20, Math.hypot(rise, run), M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'stringer', s.trim);
    str.rotation.x = Math.atan2(rise, run);
    at(g, str, sx * (w / 2 + 0.06), rise / 2 - 0.10, -run / 2);
  }
  return g;
});

registerKit('balcony', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 2.6, d = s.d ?? 1.1;
  const mat = M(s);
  at(g, slab(w, 0.16, d, mat, s, 'deck'), 0, 0, d / 2);
  const nb = s.lod === 'near' ? 3 : 2;
  for (let i = 0; i < nb; i++) {
    const br = slab(0.12, 0.14, d * 0.9, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'bracket', s.trim);
    br.rotation.x = -0.62;
    at(g, br, -w / 2 + (i + 0.5) * (w / nb), -0.36, d * 0.42);
  }
  const rail = kit('railing', { ...s, w, h: 0.95 });
  rail.position.set(0, 0.08, d - 0.06);
  g.add(rail);
  return g;
});

/* --- 11..14 : the members that carry the settlement's identity --------------------------------- */

registerKit('trim.course', (s) => {
  // The single most-repeated part in the kit and the whole reason `TRIM_SLOTS` exists. Its V is
  // mapped straight onto the settlement's band of C's shared atlas; its U runs along the course.
  const g = new THREE.Group();
  const w = s.w ?? 4, h = s.h ?? 0.20, d = s.d ?? 0.22;
  at(g, slab(w, h, d, M(s, { trim: s.trim || 'moulding', wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'course', s.trim || 'moulding'), 0, 0, 0);
  return g;
});

registerKit('awning', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 2.4, d = s.d ?? 1.3;
  const canopy = slab(w, 0.10, d, M(s, { role: s.canopyRole || 'cloth' }), s, 'canopy');
  canopy.rotation.x = -(s.pitch ?? 0.22);
  at(g, canopy, 0, 0, d / 2);
  for (const sx of [-1, 1]) {
    const strut = slab(0.09, 0.09, Math.hypot(d, 0.6), M(s, { role: 'timber' }), s, 'strut');
    strut.rotation.x = -0.9;
    at(g, strut, sx * (w / 2 - 0.12), -0.28, d * 0.44);
  }
  return g;
});

registerKit('sign', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 0.85, h = s.h ?? 0.55;
  at(g, slab(0.08, 0.08, s.arm ?? 0.7, M(s, { role: 'timber' }), s, 'signarm'), 0, 0, (s.arm ?? 0.7) / 2);
  const board = slab(w, h, 0.06, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'signboard', s.trim);
  at(g, board, 0, -h / 2 - 0.10, (s.arm ?? 0.7) * 0.82);
  for (const sx of [-1, 1]) at(g, drum(0.018, 0.018, 0.14, 4, M(s, { role: 'metal', metalness: 0.7, roughness: 0.5 }), s, 'signhook'), sx * w * 0.32, -0.06, (s.arm ?? 0.7) * 0.82);
  return g;
});

registerKit('pier', (s) => {
  // The support the marsh towns stand on. Splayed piles under a cap beam, and the splay is the
  // grammar's, not a constant — Lilmoth's reed bundles splay hard, Gideon's ordered piers do not.
  const g = new THREE.Group();
  const h = s.h ?? 2.6, n = s.piles ?? 4, spread = s.spread ?? 0.9, splay = s.splay ?? 0.16;
  const mat = M(s);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (s.seed ? jitter(s.seed, i) * 0.4 : 0);
    const p = drum(s.r ?? 0.15, (s.r ?? 0.15) * 1.35, h, s.lod === 'near' ? 7 : 5, mat, s, 'pile');
    p.rotation.z = Math.cos(a) * splay;
    p.rotation.x = Math.sin(a) * splay;
    at(g, p, Math.cos(a) * spread * 0.5, h / 2, Math.sin(a) * spread * 0.5);
    p.rotation.z = Math.cos(a) * splay; p.rotation.x = Math.sin(a) * splay;
  }
  at(g, slab(spread + 0.7, 0.22, spread + 0.7, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'piercap', s.trim), 0, h + 0.09, 0);
  return g;
});

registerKit('buttress', (s) => {
  const g = new THREE.Group();
  const h = s.h ?? 2.8, reach = s.reach ?? 1.1;
  const mat = M(s);
  const rake = slab(0.30, Math.hypot(h, reach), 0.42, mat, s, 'rake');
  rake.rotation.x = Math.atan2(reach, h);
  at(g, rake, 0, h / 2, reach / 2);
  at(g, slab(0.52, 0.26, 0.72, M(s, { role: 'stone', wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'buttressfoot'), 0, 0.13, reach);
  return g;
});

/* --- 15..18 : posts, rails, rope, planks -------------------------------------------------------- */

registerKit('post', (s) => {
  // Post, pile, mast, drying pole, banner stave and chimney stack are ONE part with six variant
  // specs. The plan's list has twenty-five ids and the skyline needs verticals; a twenty-sixth id
  // called `mast` would have been a definition where a spec was available (LIBRARY.md §3).
  const g = new THREE.Group();
  const h = s.h ?? 2.6, r = s.r ?? 0.13;
  at(g, s.square ? slab(r * 2, h, r * 2, M(s), s, 'postsq') : drum(r * (s.taper ?? 0.86), r, h, s.lod === 'near' ? 7 : 5, M(s), s, 'post'), 0, h / 2, 0);
  if (s.capped !== false) at(g, slab(r * 2.6, 0.12, r * 2.6, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'postcap', s.trim), 0, h + 0.06, 0);
  if (s.yard && s.lod !== 'impostor') at(g, drum(r * 0.5, r * 0.5, s.yardW ?? h * 0.42, 4, M(s), s, 'yard'), 0, h * 0.76, 0, 0, Math.PI / 2);
  if (s.banner) {
    const cloth = slab(s.bannerW ?? 0.55, s.bannerH ?? 1.5, 0.04, M(s, { role: 'cloth', trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'banner', s.trim);
    cloth.rotation.z = 0.06;
    at(g, cloth, (s.bannerW ?? 0.55) / 2 + r, h * 0.74 - (s.bannerH ?? 1.5) / 2, 0);
  }
  return g;
});

registerKit('railing', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 2.4, h = s.h ?? 0.98;
  const mat = M(s);
  at(g, slab(w, 0.09, 0.11, M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR }), s, 'toprail', s.trim), 0, h, 0);
  at(g, slab(w, 0.07, 0.09, mat, s, 'midrail'), 0, h * 0.52, 0);
  const n = Math.max(2, Math.round(w / (s.lod === 'near' ? 0.42 : 0.85)));
  for (let i = 0; i <= n; i++) at(g, slab(0.07, h, 0.07, mat, s, 'baluster'), -w / 2 + i * (w / n), h / 2, 0);
  return g;
});

registerKit('rope', (s) => {
  // A catenary of short segments. Ropes and lashings are what tie a marsh town together visually;
  // a straight cylinder between two points reads as a pipe.
  const g = new THREE.Group();
  const span = s.span ?? 3.0, sag = s.sag ?? 0.45, r = s.r ?? 0.035;
  const n = s.lod === 'near' ? 6 : s.lod === 'far' ? 4 : 2;
  const mat = M(s, { role: s.mat?.role === 'cloth' ? 'cloth' : 'reed' });
  const yOf = (t) => -sag * Math.sin(Math.PI * t);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const x0 = -span / 2 + t0 * span, x1 = -span / 2 + t1 * span;
    const y0 = yOf(t0), y1 = yOf(t1);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const seg = drum(r, r, len, 4, mat, s, 'ropeseg');
    at(g, seg, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, Math.PI / 2 - Math.atan2(y1 - y0, x1 - x0));
  }
  return g;
});

registerKit('plank', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 2.2, h = s.h ?? 0.06, d = s.d ?? 0.26;
  at(g, slab(w, h, d, M(s, { trim: s.trim }), s, 'plank', s.trim), 0, 0, 0);
  return g;
});

/* --- 19..22 : the cargo of an inhabited place ---------------------------------------------------- */

registerKit('crate', (s) => {
  const g = new THREE.Group();
  const w = s.w ?? 0.8, h = s.h ?? 0.7, d = s.d ?? 0.75;
  at(g, slab(w, h, d, M(s), s, 'crate'), 0, h / 2, 0);
  if (s.lod !== 'impostor') {
    const strap = M(s, { trim: s.trim || 'bolt', wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
    at(g, slab(w + 0.04, 0.06, d + 0.04, strap, s, 'cratestrap', s.trim || 'bolt'), 0, h * 0.72, 0);
    at(g, slab(w + 0.04, 0.06, d + 0.04, strap, s, 'cratestrap', s.trim || 'bolt'), 0, h * 0.26, 0);
  }
  return g;
});

registerKit('barrel', (s) => {
  const g = new THREE.Group();
  const r = s.r ?? 0.30, h = s.h ?? 0.82;
  const mat = M(s);
  at(g, drum(r * 0.86, r * 0.86, h * 0.24, s.lod === 'near' ? 9 : 6, mat, s, 'barrelend'), 0, h * 0.12, 0);
  at(g, drum(r, r, h * 0.55, s.lod === 'near' ? 9 : 6, mat, s, 'barrelbelly'), 0, h * 0.5, 0);
  at(g, drum(r * 0.86, r * 0.86, h * 0.24, s.lod === 'near' ? 9 : 6, mat, s, 'barrelend'), 0, h * 0.88, 0);
  if (s.lod === 'near') {
    const hoop = M(s, { role: 'metal', metalness: 0.72, roughness: 0.44, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
    for (const y of [h * 0.26, h * 0.74]) at(g, drum(r * 1.03, r * 1.03, 0.05, 9, hoop, s, 'hoop'), 0, y, 0);
  }
  return g;
});

registerKit('basket', (s) => {
  const g = new THREE.Group();
  const r = s.r ?? 0.28, h = s.h ?? 0.42;
  at(g, drum(r, r * 0.66, h, s.lod === 'near' ? 8 : 5, M(s, { role: 'reed' }), s, 'basket'), 0, h / 2, 0);
  if (s.lod !== 'impostor') at(g, drum(r * 1.06, r * 1.06, 0.05, s.lod === 'near' ? 8 : 5, M(s, { role: 'reed', trim: s.trim || 'lashing', wear: 0.5 }), s, 'basketrim'), 0, h - 0.02, 0);
  return g;
});

registerKit('net', (s) => {
  // Drying nets. Crossed strips on a frame — the accumulated stuff that makes a place inhabited.
  const g = new THREE.Group();
  const w = s.w ?? 2.2, h = s.h ?? 1.5;
  const mat = M(s, { role: 'reed', wear: 0.55 });
  const n = s.lod === 'near' ? 5 : s.lod === 'far' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    at(g, slab(0.035, h, 0.035, mat, s, 'netwarp'), -w / 2 + (i + 0.5) * (w / n), -h / 2, 0);
    at(g, slab(w, 0.035, 0.035, mat, s, 'netweft'), 0, -(i + 0.5) * (h / n), 0);
  }
  return g;
});

/* --- 23..25 : light, brackets, and the one part that emits ---------------------------------------*/

registerKit('lantern', (s) => {
  const g = new THREE.Group();
  const r = s.r ?? 0.15, h = s.h ?? 0.34;
  const cage = M(s, { role: 'metal', metalness: 0.68, roughness: 0.42, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  at(g, drum(r * 0.7, r, h, s.lod === 'near' ? 6 : 4, cage, s, 'lanterncage'), 0, h / 2, 0);
  at(g, slab(r * 2.2, 0.06, r * 2.2, cage, s, 'lanternhood'), 0, h + 0.03, 0);
  // The one emissive in the kit. B's practicals light the street; this is the fitting you see.
  // Cached: the first version built a fresh material per lantern and thirteen lanterns in Lilmoth
  // were thirteen extra settlement draw calls.
  const glow = lanternGlow(s.emissive ?? 0xffb257, s.emissiveIntensity ?? 1.35);
  at(g, drum(r * 0.55, r * 0.55, h * 0.62, 5, glow, s, 'lanternflame'), 0, h * 0.48, 0);
  return g;
});

registerKit('bracket', (s) => {
  const g = new THREE.Group();
  const h = s.h ?? 0.55, reach = s.reach ?? 0.5;
  const mat = M(s, { trim: s.trim, wear: (s.mat?.wear ?? 0.3) + TRIM_WEAR });
  at(g, slab(0.09, h, 0.10, mat, s, 'bracketleg', s.trim), 0, h / 2, 0);
  at(g, slab(0.09, 0.10, reach, mat, s, 'bracketarm', s.trim), 0, h, reach / 2);
  const diag = slab(0.08, Math.hypot(h, reach) * 0.72, 0.08, mat, s, 'bracketdiag');
  diag.rotation.x = -Math.atan2(reach, h);
  at(g, diag, 0, h * 0.42, reach * 0.42);
  return g;
});

/* ================================================================================================
 * SECTION 4 — THE EIGHT GRAMMARS.
 *
 * A grammar is the ONLY place a settlement is allowed to differ, and every one of them is derived
 * from the `grammar` / `support` / `trim` strings `world-art.js` already publishes — the plan's
 * hard fail is *"a settlement whose grammar is not derived from `world-art.js`"*. The derivation is
 * asserted at import time by `assertGrammarsDerived()` below, so the two files cannot drift the way
 * `world-art.js` and `PALETTES` cannot drift.
 *
 * `region` is the region id in `game/data/world/settlements/<id>.json § region`, and it selects the
 * palette swatch. It is written here rather than read, because this module must not read the disk.
 * ==============================================================================================*/

/** `world-art.js` trim words map onto C's twelve atlas bands. All twelve are used across the eight
 * grammars, which is what makes this file the trim atlas's first — and second — consumer. */
const TRIM_WORD = Object.freeze({
  'dye-resin': 'dye-band', 'chitin-bars': 'chitin-bar', 'metal-course': 'metal-course',
  'bone-lashings': 'bone-binding', 'shell-rings': 'shell-ring', 'bleached-timber': 'bleached-timber',
  'legion-resin': 'bolt', 'black-resin': 'resin-seam',
});

export const GRAMMARS = Object.freeze({
  // ---- Archon: terraced kiln. Fired clay in stepped terraces, dyed bands, smoke. ---------------
  archon: {
    town: 'archon', region: 'crimson-coast',
    roofs: ['roof.hip', 'roof.shell'], roofMix: [0.62, 0.38],
    support: 'buttress', supportTrim: 'moulding',
    wallRole: 'clay', frameRole: 'timber', roofRole: 'clay',
    storey: { base: 1, tall: 3, tallEvery: 5 }, terrace: 0.55,
    wear: 0.42, decor: 0.55, asym: 0.10,
    skyline: ['chimney', 'chimney', 'banner'], skylineRate: 0.55,
    dressing: ['barrel', 'crate', 'basket'],
  },
  // ---- Blackrose: root stockade. A fortress the marsh has furred over. -------------------------
  blackrose: {
    town: 'blackrose', region: 'western-rootlands',
    roofs: ['roof.hip'], roofMix: [1],
    support: 'buttress', supportTrim: 'bone-binding',
    wallRole: 'stone', frameRole: 'root', roofRole: 'stone',
    storey: { base: 2, tall: 3, tallEvery: 4 }, terrace: 0,
    wear: 0.58, decor: 0.30, asym: 0.04,
    skyline: ['watchpost', 'watchpost', 'chimney'], skylineRate: 0.42,
    dressing: ['crate', 'crate'],
  },
  // ---- Gideon: an imported plan. Right angles, courses, and roots breaking the grid. -----------
  gideon: {
    town: 'gideon', region: 'blackwood',
    roofs: ['roof.hip'], roofMix: [1],
    support: 'post', supportTrim: 'moulding',
    wallRole: 'stone', frameRole: 'timber', roofRole: 'clay',
    storey: { base: 2, tall: 3, tallEvery: 3 }, terrace: 0,
    wear: 0.24, decor: 0.42, asym: 0.0,
    skyline: ['chimney', 'banner', 'chimney'], skylineRate: 0.62,
    dressing: ['crate', 'barrel'], imperial: true,
  },
  // ---- Helstrom: shell-pier market. Grown, not built, over walking root piles. -----------------
  helstrom: {
    town: 'helstrom', region: 'stone-forest',
    roofs: ['roof.shell', 'roof.reed'], roofMix: [0.68, 0.32],
    support: 'pier', supportTrim: 'lashing',
    wallRole: 'root', frameRole: 'root', roofRole: 'shell',
    storey: { base: 1, tall: 2, tallEvery: 3 }, terrace: 0.30,
    wear: 0.50, decor: 0.78, asym: 0.16,
    skyline: ['mast', 'dryingrack', 'banner', 'mast'], skylineRate: 0.72,
    dressing: ['basket', 'crate', 'net', 'barrel'],
  },
  // ---- Lilmoth: reed-dome tidal court. Two cities stacked, and the lower one is drowning. ------
  // The starting town, the weakest of the eight in the visual sweep, and the one a demo opens on.
  // Its grammar is the most specified in the file on purpose: a drowned stone storey with a
  // tideline, a reed-and-salvage town on top of it, splayed reed bundles carrying the whole thing,
  // and a skyline of masts, drying racks and net frames over the water.
  lilmoth: {
    town: 'lilmoth', region: 'western-rootlands',
    roofs: ['roof.reed', 'roof.shell', 'roof.hip'], roofMix: [0.54, 0.28, 0.18],
    support: 'pier', supportTrim: 'plank',
    wallRole: 'reed', frameRole: 'timber', roofRole: 'reed',
    drownedRole: 'stone', tideline: 1.45,
    storey: { base: 2, tall: 3, tallEvery: 2 }, terrace: 0.42,
    wear: 0.62, wetness: 0.45, decor: 0.86, asym: 0.22,
    skyline: ['mast', 'dryingrack', 'mast', 'netframe', 'banner'], skylineRate: 0.88,
    skylineBudget: 3, skylineScale: 1.25,
    dressing: ['net', 'basket', 'crate', 'barrel', 'net'],
  },
  // ---- Soulrest: harbour rib. Bone and salt, and no green in it. -------------------------------
  soulrest: {
    town: 'soulrest', region: 'stone-wastes',
    roofs: ['roof.shell', 'roof.hip'], roofMix: [0.55, 0.45],
    support: 'buttress', supportTrim: 'bleached-timber',
    wallRole: 'salt', frameRole: 'bone', roofRole: 'bone',
    storey: { base: 1, tall: 2, tallEvery: 4 }, terrace: 0.22,
    wear: 0.66, decor: 0.44, asym: 0.12,
    skyline: ['rib', 'rib', 'mast'], skylineRate: 0.58,
    dressing: ['barrel', 'net', 'crate'],
  },
  // ---- Stormhold: root-bridge tiers. Legion block on a stone-root buttress. --------------------
  stormhold: {
    town: 'stormhold', region: 'salt-hills',
    roofs: ['roof.hip'], roofMix: [1],
    support: 'buttress', supportTrim: 'metal-course',
    wallRole: 'stone', frameRole: 'timber', roofRole: 'stone',
    storey: { base: 2, tall: 4, tallEvery: 3 }, terrace: 0.70,
    wear: 0.30, decor: 0.36, asym: 0.02,
    skyline: ['banner', 'watchpost', 'banner'], skylineRate: 0.66,
    dressing: ['crate', 'barrel'], imperial: true,
  },
  // ---- Thorn: spiral palisade. Black needle-thorn, steep, and leaning. -------------------------
  // THE STARTING TOWN. `reports/spawn-truth/2026-08-14-spawn-truth.md` settled that title -> New
  // puts the player here, not in Lilmoth, and this grammar is now written on that basis.
  //
  // `roof.needle` leads the mix because the settlement record says it is the one thing no other
  // settlement has: *"the thorn thatch — black needle-wood laid in courses, which no other
  // settlement uses"*. Before this, Thorn drew `roof.reed` and `roof.hip` — the same two Lilmoth
  // and Helstrom draw — and its declared signature existed nowhere in the renderer.
  //
  // WHAT THIS DOES AND DOES NOT BUY, stated so nobody has to re-measure it: Thorn goes from 2
  // distinct roof profiles over 18 buildings to 3. Ruling E1 asks for >= 5 and **>= 5 is still not
  // reachable** — the kit now defines FOUR roof ids in total, so no grammar in the game can mix
  // five. That is a kit gap, not a Thorn gap, and it is recorded rather than papered over.
  thorn: {
    town: 'thorn', region: 'thornmarsh',
    roofs: ['roof.needle', 'roof.reed', 'roof.hip'], roofMix: [0.58, 0.24, 0.18],
    support: 'post', supportTrim: 'edge',
    wallRole: 'thorn', frameRole: 'thorn', roofRole: 'thorn',
    storey: { base: 1, tall: 2, tallEvery: 3 }, terrace: 0.34,
    wear: 0.54, decor: 0.50, asym: 0.26,
    skyline: ['spike', 'spike', 'banner'], skylineRate: 0.70,
    dressing: ['basket', 'crate'],
  },
});

/**
 * The check that keeps the grammars honest. Every grammar must exist for a settlement
 * `world-art.js` declares, must carry that settlement's `trim` word as a real atlas slot, must
 * agree with its `imperial` flag, and must name a region that has a palette swatch. Run at import
 * — the same discipline `visual-foundation.js` uses to stop `PALETTES` drifting from the regions.
 */
function assertGrammarsDerived() {
  for (const [town, g] of Object.entries(GRAMMARS)) {
    const art = settlementArt(town);
    const slot = TRIM_WORD[art.trim];
    if (!slot) throw new Error(`kits.js: settlement '${town}' trim word '${art.trim}' has no atlas slot`);
    if (!(slot in TRIM_SLOTS)) throw new Error(`kits.js: '${town}' maps to unknown trim slot '${slot}'`);
    if (!(g.supportTrim in TRIM_SLOTS)) throw new Error(`kits.js: '${town}' support trim '${g.supportTrim}' is not an atlas slot`);
    if (!PALETTES[g.region]) throw new Error(`kits.js: '${town}' names region '${g.region}' with no palette swatch`);
    if (Boolean(g.imperial) !== Boolean(art.imperial)) throw new Error(`kits.js: '${town}' imperial flag disagrees with world-art.js`);
    g.trim = slot;
    g.grammarWord = art.grammar;
    g.supportWord = art.support;
    Object.freeze(g);
  }
  const covered = new Set(Object.values(GRAMMARS).flatMap(g => [g.trim, g.supportTrim]));
  for (const slot of Object.keys(TRIM_SLOTS)) {
    if (!covered.has(slot)) throw new Error(`kits.js: trim slot '${slot}' has no consuming grammar — the atlas must be fully consumed or the slot removed`);
  }
}
assertGrammarsDerived();

/** The grammar for a settlement. Fails closed, like every other vocabulary in the render tree. */
export function grammarFor(town) {
  const g = GRAMMARS[town];
  if (!g) throw new Error(`kits.js: no grammar for settlement '${town}' (known: ${Object.keys(GRAMMARS).join(', ')})`);
  return g;
}

/** The material spec a grammar hands a kit part for a given role. This is the variant, and it is
 * what makes Helstrom stone and Thorn stone two swatches over one family rather than two sets. */
export function grammarMat(g, role, extra = {}) {
  return {
    role, palette: g.region, wear: Math.min(1, (g.wear ?? 0.3) + (extra.wear ?? 0)),
    wetness: extra.wetness ?? g.wetness ?? 0,
    trim: extra.trim, colour: extra.colour, roughness: extra.roughness, metalness: extra.metalness,
    tilingScale: extra.tilingScale,
  };
}

/**
 * The roof this building gets, chosen from the grammar's mix by a stable per-building hash.
 * Deterministic, and the reason two neighbours in one street do not share a silhouette.
 */
export function roofChoice(g, seed) {
  const t = jitter(seed, 7);
  let acc = 0;
  for (let i = 0; i < g.roofs.length; i++) { acc += g.roofMix[i]; if (t <= acc) return g.roofs[i]; }
  return g.roofs[g.roofs.length - 1];
}

/** Storey count for a building, from the grammar's rule and its index in the settlement. */
export function storeyChoice(g, seed, index) {
  const tall = index % g.storey.tallEvery === 0 || jitter(seed, 11) > 0.86;
  return tall ? g.storey.tall : g.storey.base + (jitter(seed, 13) > 0.65 ? 1 : 0);
}

/** A stable silhouette signature for one building, used by the offline variation gate: the roof
 * profile, the storey count, the footprint aspect banded, and the skyline features. Two adjacent
 * buildings sharing this string are the defect the plan's `variation within a street` row names. */
export function silhouetteHash(parts) {
  return [parts.roof, parts.storeys, Math.round((parts.w / parts.d) * 4) / 4, Math.round(parts.h * 2) / 2,
    (parts.skyline || []).slice().sort().join('+')].join('|');
}

export { jitter as kitJitter };

/* ================================================================================================
 * SECTION 5 — THE CENSUS. What an offline gate reads.
 * ==============================================================================================*/

/**
 * Walk a built scene and report the kit economy. `bypass` is the number of world-surface meshes
 * carrying no `kitId` — the plan's `kit economy` row goes red on it, and its null control is to
 * hand-author one building outside the kit and watch the number move.
 */
export function kitCensus(root) {
  const parts = new Map();
  const materials = new Map();
  let meshes = 0, bypass = 0, triangles = 0, curvature = 0, trimmed = 0, kitMeshes = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const tri = o.isBatchedMesh ? (o.userData.logicalTriangles || 0)
      : (g?.index ? g.index.count / 3 : (g?.attributes?.position?.count || 0) / 3);
    triangles += tri;
    const id = o.userData.kitId;
    // A `BatchedMesh` stands for the meshes it swallowed: `carryKitProvenance()` in `exterior.js`
    // records their ids and how many of them were NOT kit parts, so a batch neither hides a
    // bypass nor is counted as one.
    if (o.userData.kitBypass) bypass += o.userData.kitBypass;
    if (Array.isArray(o.userData.kitIds)) {
      for (const k of o.userData.kitIds) parts.set(k, (parts.get(k) || 0) + 1);
      kitMeshes += Math.max(0, (o.userData.kitMembers || 1) - (o.userData.kitBypass || 0));
      if (o.geometry?.attributes?.esCurvature) curvature++;
      return;
    }
    if (!id) { if (!o.userData.kitBypass) bypass++; return; }
    kitMeshes++;
    parts.set(id, (parts.get(id) || 0) + 1);
    if (g?.attributes?.esCurvature) curvature++;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.userData?.w130Kit) {
      materials.set(m.userData.w130Kit.role + '|' + (m.userData.w130Kit.palette || '-') + '|' + (m.userData.w130Kit.trim || '-'), 1);
      if (m.userData.w130Kit.trim) trimmed++;
    }
  });
  return {
    meshes, bypass, triangles: Math.round(triangles), kitMeshes,
    kitFraction: kitMeshes + bypass ? Math.round((kitMeshes / (kitMeshes + bypass)) * 1000) / 1000 : 0,
    distinctParts: parts.size, parts: Object.fromEntries([...parts].sort((a, b) => b[1] - a[1])),
    curvatureMeshes: curvature, trimMeshes: trimmed,
    materialVariants: materials.size,
  };
}

/** Every id this kit publishes, in the order the plan lists them. */
export const KIT_PART_IDS = Object.freeze(knownKits());
