/**
 * footprint.js — THE ONE PLACE THAT KNOWS WHAT SHAPE A BUILDING IS.
 *
 * ------------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ------------------------------------------------------------------------------------------------
 *
 * `tools/world/building-overlap-census.mjs` counted, for the first time, how many buildings in this
 * world stand inside each other: **83 pairs across 8 of 8 settlements, 25 of them with a door
 * opening inside another building.** The cause was not eight bad settlement files. It was one defect
 * wearing two hats:
 *
 *   * `render/exterior.js#planSettlement()`'s shrink pass — the resolver that is supposed to keep
 *     buildings out of one another — compared AXIS-ALIGNED footprints.
 *   * `world/province.js#_deepOverlaps()` — the counter that reports what the resolver failed to
 *     resolve — compared AXIS-ALIGNED footprints, in a second copy of the same arithmetic.
 *
 * while `settlementSolids()` (what the player collides with) and `buildSettlementExterior()` (what
 * the player sees) both ROTATE the footprint by `yaw_deg`. At yaw 90 the width and the depth swap:
 * Thorn's barge hold is declared 7.00 x 16.02 and stands 16.02 x 7.00. The resolver measured a
 * rectangle that is not in the world, found nothing to do, and the counter agreed with it.
 * **63 of the 83 were invisible to the shipped check.**
 *
 * That is this project's most expensive shape, arriving from the geometry side: the number was
 * computed correctly, over the wrong shape. Same family as the region label that was faithfully
 * reported and updated by nothing.
 *
 * ------------------------------------------------------------------------------------------------
 * SO THERE IS ONE IMPLEMENTATION, AND EVERYBODY IMPORTS IT
 * ------------------------------------------------------------------------------------------------
 *
 * A third implementation of the same geometry is how the second and the first came to disagree.
 * These functions are therefore the single source for "what rectangle does this building occupy,
 * and how deeply do two of them interpenetrate":
 *
 *   render/exterior.js#planSettlement()  — the resolver, so it shrinks the shape it actually draws
 *   world/province.js#_deepOverlaps()    — the counter, so it counts the shape it actually draws
 *   tools/world/building-overlap-census.mjs — the census and the pre-commit ratchet's instrument
 *
 * The rotation convention is COPIED FROM `settlementSolids()`'s `push()`, not re-derived:
 *
 *     wx = b.x + cx * cos(yaw) + cz * sin(yaw)
 *     wz = b.z - cx * sin(yaw) + cz * cos(yaw)
 *
 * so a change to that convention shows up here as a disagreement, not as a silent drift. The
 * census's own self-test has an arm that REQUIRES the axis-aligned and yaw-90 answers to differ,
 * and an arm that requires the yaw-blind AABB view to miss the pair the oriented view catches; both
 * now exercise this file.
 *
 * This module imports nothing. It is pure arithmetic on plain objects, so `render/` may depend on it
 * without depending on `world/` state and a bare-Node tool may import it without a browser.
 */
'use strict';

/**
 * The world-space unit vectors of a building's own local x and z axes.
 * Local x -> (cos yaw, -sin yaw); local z -> (sin yaw, cos yaw). Read the convention above.
 * @returns {[[number, number], [number, number]]}
 */
export function orientedAxes(yawDeg) {
  const yaw = (yawDeg || 0) * Math.PI / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[c, -s], [s, c]];
}

/** The drawn footprint of a planned building — post-shrink where the plan has run, declared where it has not. */
export function footprintOf(b) {
  const fp = b.drawn_footprint_m || b.footprint_m;
  return [fp[0], fp[1]];
}

/**
 * The four world corners of a building's drawn footprint, in order.
 * @param {{x:number, z:number, yaw_deg?:number, drawn_footprint_m?:number[], footprint_m:number[]}} b
 * @returns {Array<[number, number]>}
 */
export function footprintCorners(b) {
  const [w, d] = footprintOf(b);
  const [ex, ez] = orientedAxes(b.yaw_deg);
  const hw = w / 2, hd = d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
    .map(([cx, cz]) => [b.x + cx * ex[0] + cz * ez[0], b.z + cx * ex[1] + cz * ez[1]]);
}

/**
 * Half the building's extent when projected onto the unit direction `n`.
 * For a rectangle this is exact: the support function of a box.
 */
export function halfExtentAlong(w, d, axes, n) {
  return (w / 2) * Math.abs(axes[0][0] * n[0] + axes[0][1] * n[1])
       + (d / 2) * Math.abs(axes[1][0] * n[0] + axes[1][1] * n[1]);
}

/**
 * Separating-axis test on two convex quads. Returns the minimum translation distance, or 0 when a
 * separating axis exists. In 2D the edge normals of both polygons are a complete axis set for
 * convex shapes, so this is exact, not a bound.
 */
export function penetrationDepth(A, B) {
  let best = Infinity;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      let nx = -(q[1] - p[1]), nz = q[0] - p[0];
      const L = Math.hypot(nx, nz);
      if (L < 1e-9) continue;
      nx /= L; nz /= L;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of A) { const t = v[0] * nx + v[1] * nz; if (t < aMin) aMin = t; if (t > aMax) aMax = t; }
      for (const v of B) { const t = v[0] * nx + v[1] * nz; if (t < bMin) bMin = t; if (t > bMax) bMax = t; }
      const ov = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (ov <= 0) return 0;
      if (ov < best) best = ov;
    }
  }
  return best === Infinity ? 0 : best;
}

/**
 * The separation depth of two PLANNED buildings, on the rectangles the world actually draws.
 * This is the same number `tools/world/building-overlap-census.mjs` reports as `depth_m`, because it
 * is the same function.
 */
export function pairDepth(a, b) {
  const ra = Math.hypot(...footprintOf(a)) / 2;
  const rb = Math.hypot(...footprintOf(b)) / 2;
  if (Math.hypot(a.x - b.x, a.z - b.z) > ra + rb) return 0;   // cheap reject on circumscribed radii
  return penetrationDepth(footprintCorners(a), footprintCorners(b));
}

/**
 * THE ORIENTED VIEW OF ONE PAIR, in the form the resolver needs to act on it.
 *
 * Returns, for each of the four candidate separating axes (both buildings' two edge normals), the
 * numbers the shrink pass solves against:
 *
 *   n      the unit axis
 *   ha,hb  each building's half-extent projected onto it
 *   D      the distance between the centres projected onto it
 *   ov     ha + hb - D — the overlap on this axis. min over the four axes IS the SAT depth.
 *   ka,kb  WHICH LOCAL AXIS of each building the shrink should pull on to close this overlap:
 *          the one whose world direction is most aligned with `n`. At yaw 0 with n = world x this
 *          is local axis 0 for both, which is exactly what the axis-aligned code did — so the fix
 *          is a generalisation of the shipped rule and not a replacement for it.
 *   ca,cb  how much of `ha`/`hb` that lever controls. Scaling local axis `ka` by t takes `ha` to
 *          `ha - (1 - t) * ca`. When `ca` is ~0 the lever cannot close this axis at all and the
 *          resolver must look at another one rather than shrinking a building for nothing.
 *
 * @returns {null|{depth:number, axes:Array<object>}} null when the two are disjoint.
 */
export function pairAxes(a, b, aw, ad, bw, bd) {
  const axA = orientedAxes(a.yaw_deg), axB = orientedAxes(b.yaw_deg);
  const dx = a.x - b.x, dz = a.z - b.z;
  const out = [];
  let depth = Infinity;
  for (const [owner, n] of [[0, axA[0]], [0, axA[1]], [1, axB[0]], [1, axB[1]]]) {
    const ha = halfExtentAlong(aw, ad, axA, n);
    const hb = halfExtentAlong(bw, bd, axB, n);
    const D = Math.abs(dx * n[0] + dz * n[1]);
    const ov = ha + hb - D;
    if (ov <= 0) return null;                       // a separating axis exists: disjoint
    if (ov < depth) depth = ov;
    // the most-aligned local axis of each building, and the share of the half-extent it owns
    const pa0 = Math.abs(axA[0][0] * n[0] + axA[0][1] * n[1]);
    const pa1 = Math.abs(axA[1][0] * n[0] + axA[1][1] * n[1]);
    const pb0 = Math.abs(axB[0][0] * n[0] + axB[0][1] * n[1]);
    const pb1 = Math.abs(axB[1][0] * n[0] + axB[1][1] * n[1]);
    const ka = pa0 >= pa1 ? 0 : 1, kb = pb0 >= pb1 ? 0 : 1;
    out.push({
      owner, n, ha, hb, D, ov, ka, kb,
      ca: ka === 0 ? (aw / 2) * pa0 : (ad / 2) * pa1,
      cb: kb === 0 ? (bw / 2) * pb0 : (bd / 2) * pb1,
    });
  }
  return { depth, axes: out };
}
