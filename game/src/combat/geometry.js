// Swept-capsule collision geometry — the whole of RI-CMB04 §C's arithmetic.
//
// The one thing this file exists to make impossible:
//
//     if (target.position.distanceTo(player.position) < 2.0 && isFacing(target)) hit();
//
// RI-CMB04 "How we lose" #1. It is four lines, it works, and it is the death of the combat
// system. Everything below is the alternative: a weapon carries a CAPSULE between two bone
// sockets; the capsule MOVES between one frame's pose and the next; the region it sweeps is
// the convex hull of the two capsules; and a hit is an overlap of that region with a capsule
// bolted to the target's animated skeleton. There is no distance threshold, no facing test,
// no forgiveness radius and no random number anywhere in this file.
//
// EXACTNESS. The swept region of a capsule whose two endpoints move LINEARLY is exactly
//
//     hull{A0, B0, A1, B1}  (+)  sphere(r)
//
// so `overlap(swept, capsule(P,Q,rt))` is exactly `dist(hull{A0,B0,A1,B1}, seg(P,Q)) <= r+rt`.
// That distance is computed in CLOSED FORM below (segment vs tetrahedron, decomposed into
// segment-vs-triangle over the four faces plus a solid-interior test) rather than by an
// iterative solver, so the answer does not depend on an iteration count, a tolerance or a
// starting simplex — which is what makes RI-CMB04 M2's "compare the sim against the analytic
// answer" a comparison of two computations of the same function rather than a fitting
// exercise.
//
// ALLOCATION. Every routine here writes into caller-supplied or module-scope scratch. The
// fixed step must not allocate (RI-PLT01 P4).
'use strict';

const EPS = 1e-12;

// ---- small vector helpers ---------------------------------------------------------------

export function v3(x = 0, y = 0, z = 0) { return [x, y, z]; }
export function sub(o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; }
export function add(o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; }
export function scale(o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(o, a, b) {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z; return o;
}
export function len(a) { return Math.sqrt(dot(a, a)); }
export function dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
export function lerp3(o, a, b, t) {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
  return o;
}

// ---- segment / segment ------------------------------------------------------------------

/**
 * Squared distance between segments [p1,q1] and [p2,q2]. Ericson, Real-Time Collision
 * Detection §5.1.9, with the degenerate cases (either segment a point) handled explicitly.
 */
export function segSegDist2(p1, q1, p2, q2) {
  const d1x = q1[0] - p1[0], d1y = q1[1] - p1[1], d1z = q1[2] - p1[2];
  const d2x = q2[0] - p2[0], d2y = q2[1] - p2[1], d2z = q2[2] - p2[2];
  const rx = p1[0] - p2[0], ry = p1[1] - p2[1], rz = p1[2] - p2[2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= EPS && e <= EPS) {
    return rx * rx + ry * ry + rz * rz;
  }
  if (a <= EPS) {
    s = 0; t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0; s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const cx = p1[0] + d1x * s - (p2[0] + d2x * t);
  const cy = p1[1] + d1y * s - (p2[1] + d2y * t);
  const cz = p1[2] + d1z * s - (p2[2] + d2z * t);
  return cx * cx + cy * cy + cz * cz;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Capsule-vs-capsule overlap: the primitive both hitboxes and hurtboxes reduce to. */
export function capsuleOverlap(a0, a1, ra, b0, b1, rb) {
  const r = ra + rb;
  return segSegDist2(a0, a1, b0, b1) <= r * r;
}
export function capsuleGap(a0, a1, ra, b0, b1, rb) {
  return Math.sqrt(segSegDist2(a0, a1, b0, b1)) - (ra + rb);
}

// ---- segment / triangle -----------------------------------------------------------------

const _e1 = v3(), _e2 = v3(), _n = v3(), _tmp = v3(), _pv = v3();

/** True if segment [p,q] crosses triangle (a,b,c). Möller–Trumbore, segment-clamped. */
function segTriIntersect(p, q, a, b, c) {
  sub(_e1, b, a); sub(_e2, c, a);
  sub(_tmp, q, p);                       // segment direction
  cross(_n, _tmp, _e2);
  const det = dot(_e1, _n);
  if (det > -1e-10 && det < 1e-10) return false;   // parallel or degenerate
  const inv = 1 / det;
  sub(_pv, p, a);
  const u = dot(_pv, _n) * inv;
  if (u < 0 || u > 1) return false;
  cross(_n, _pv, _e1);
  const v = dot(_tmp, _n) * inv;
  if (v < 0 || u + v > 1) return false;
  const t = dot(_e2, _n) * inv;
  return t >= 0 && t <= 1;
}

const _ab = v3(), _ac = v3(), _ap = v3(), _nrm = v3();

/** Perpendicular distance from point p to triangle (a,b,c) IF p projects inside it, else -1. */
function pointTriInteriorDist(p, a, b, c) {
  sub(_ab, b, a); sub(_ac, c, a); cross(_nrm, _ab, _ac);
  const n2 = dot(_nrm, _nrm);
  if (n2 <= 1e-16) return -1;                 // degenerate triangle: edges cover it
  sub(_ap, p, a);
  const d = dot(_ap, _nrm) / Math.sqrt(n2);
  // barycentric of the projection
  const d00 = dot(_ab, _ab), d01 = dot(_ab, _ac), d11 = dot(_ac, _ac);
  const d20 = dot(_ap, _ab), d21 = dot(_ap, _ac);
  const den = d00 * d11 - d01 * d01;
  if (Math.abs(den) <= 1e-16) return -1;
  const v = (d11 * d20 - d01 * d21) / den;
  const w = (d00 * d21 - d01 * d20) / den;
  if (v < 0 || w < 0 || v + w > 1) return -1;
  return Math.abs(d);
}

/** Exact distance between segment [p,q] and triangle (a,b,c). */
export function segTriDist(p, q, a, b, c) {
  if (segTriIntersect(p, q, a, b, c)) return 0;
  let best = segSegDist2(p, q, a, b);
  const d2 = segSegDist2(p, q, b, c); if (d2 < best) best = d2;
  const d3 = segSegDist2(p, q, c, a); if (d3 < best) best = d3;
  best = Math.sqrt(best);
  const ip = pointTriInteriorDist(p, a, b, c); if (ip >= 0 && ip < best) best = ip;
  const iq = pointTriInteriorDist(q, a, b, c); if (iq >= 0 && iq < best) best = iq;
  return best;
}

// ---- segment / tetrahedron (= segment / convex hull of 4 points) -------------------------

const _t0 = v3(), _t1 = v3(), _t2 = v3(), _tn = v3(), _tp = v3();

/** True if p is inside (or on) the tetrahedron (a,b,c,d). Degenerate tetra -> false. */
function pointInTetra(p, a, b, c, d) {
  const s = orient(a, b, c, d);
  if (Math.abs(s) < 1e-12) return false;              // flat hull has no interior
  const sg = s > 0 ? 1 : -1;
  return orient(p, b, c, d) * sg >= -1e-12
    && orient(a, p, c, d) * sg >= -1e-12
    && orient(a, b, p, d) * sg >= -1e-12
    && orient(a, b, c, p) * sg >= -1e-12;
}

function orient(a, b, c, d) {
  sub(_t0, b, a); sub(_t1, c, a); sub(_t2, d, a);
  cross(_tn, _t0, _t1);
  return dot(_tn, _t2);
}

/**
 * Exact distance from segment [p,q] to the convex hull of {h0,h1,h2,h3}.
 *
 * Decomposition: 0 if either endpoint is inside the solid, else the minimum over the four
 * triangular faces. This is correct for a degenerate (flat, collinear or coincident) hull
 * too, because `pointInTetra` reports no interior and the face distances then reduce to the
 * flat hull's own distance — which matters, since a straight thrust produces exactly that
 * degenerate case and it is the attack a naive sweep is most likely to get wrong.
 */
export function segHullDist(p, q, h0, h1, h2, h3) {
  if (pointInTetra(p, h0, h1, h2, h3) || pointInTetra(q, h0, h1, h2, h3)) return 0;
  let best = segTriDist(p, q, h0, h1, h2);
  let d = segTriDist(p, q, h0, h1, h3); if (d < best) best = d;
  d = segTriDist(p, q, h0, h2, h3); if (d < best) best = d;
  d = segTriDist(p, q, h1, h2, h3); if (d < best) best = d;
  return best;
}

// ---- the sweep --------------------------------------------------------------------------

const _A0 = v3(), _A1 = v3(), _B0 = v3(), _B1 = v3();
const _aabbMin = v3(), _aabbMax = v3();

/**
 * RI-CMB04 §C, verbatim. Sweeps the weapon capsule from its previous pose to its current one
 * in `substeps` linear sub-intervals and tests each swept hull against one target capsule.
 *
 * @returns {number} the substep index of the FIRST overlap, or -1. The index is reported
 *   (rather than a bare boolean) because it is the sub-frame time of contact, and RI-CMB07's
 *   trace carries it so a critic can see that a hit landed at t = (s+0.5)/substeps of the
 *   frame rather than "on the frame".
 */
export function sweepCapsuleVsCapsule(prevA, prevB, nowA, nowB, r, tgtP, tgtQ, tgtR, substeps) {
  const reach = r + tgtR;
  for (let s = 0; s < substeps; s++) {
    const t0 = s / substeps, t1 = (s + 1) / substeps;
    lerp3(_A0, prevA, nowA, t0); lerp3(_B0, prevB, nowB, t0);
    lerp3(_A1, prevA, nowA, t1); lerp3(_B1, prevB, nowB, t1);
    if (segHullDist(tgtP, tgtQ, _A0, _B0, _A1, _B1) <= reach) return s;
  }
  return -1;
}

/**
 * Broadphase: AABB of the whole swept region, expanded by `pad` (RI-CMB04 §C = 0.05 m).
 * Written into `outMin`/`outMax`.
 */
export function sweptAABB(prevA, prevB, nowA, nowB, r, pad, outMin, outMax) {
  for (let i = 0; i < 3; i++) {
    outMin[i] = Math.min(prevA[i], prevB[i], nowA[i], nowB[i]) - r - pad;
    outMax[i] = Math.max(prevA[i], prevB[i], nowA[i], nowB[i]) + r + pad;
  }
}

export function aabbVsCapsule(min, max, p, q, r) {
  for (let i = 0; i < 3; i++) {
    if (Math.min(p[i], q[i]) - r > max[i]) return false;
    if (Math.max(p[i], q[i]) + r < min[i]) return false;
  }
  return true;
}

export { _aabbMin as scratchMin, _aabbMax as scratchMax };

// ---- angles ------------------------------------------------------------------------------

/** Signed smallest angle from `fromDeg` to `toDeg`, in (-180, 180]. */
export function angleDelta(fromDeg, toDeg) {
  let d = (toDeg - fromDeg) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }

/** Horizontal bearing, in degrees, of the vector (dx, dz) — matching the controller's yaw. */
export function bearingDeg(dx, dz) { return norm360(Math.atan2(dx, dz) * 180 / Math.PI); }
