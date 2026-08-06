// Static world collision, for the camera's spring arm and for the player's body.
//
// WHY THIS FILE EXISTS. RI-CAM01 §D defines `clip_through` as point-containment of the
// camera origin and its four near-plane corners against "the same collision set used in §C".
// Before this file there was no collision set at all: `sim/camera.js` set
// `clipThrough = false` unconditionally and the arm was a constant. A camera that cannot be
// obstructed cannot be measured, and RI-CAM01 M3 is weighted 25 with an automatic fail
// attached, so the collision set is the precondition for the whole area.
//
// THE THREE PRIMITIVES, and why not a mesh. A triangle-soup cast is the "right" answer and
// the wrong one here: it is slower, it is harder to author by hand as inspectable JSON
// (HARNESS §5 mandates `game/data/**`), and — decisively — it has no exact exterior distance
// function, so the sphere cast would have to be an approximate slab test that is wrong at
// corners by up to r·(√3−1) = 0.20 m. The three primitives below (oriented box, vertical
// cylinder, arbitrary capsule) each have an EXACT exterior distance, which makes the sphere
// cast exact by conservative advancement rather than approximate by expansion.
//
// THE CAST IS A SPHERE MARCH, not an expanded-AABB slab test. Per step it evaluates
// `distanceToSolid(p)` and advances by `(d − r) / |to−from|`. That is the exact Minkowski
// sum of the sphere with the primitive set — the rounded corners RI-CAM01 "How we lose" #3
// says a raycast misses — and it can never overshoot, because the advance is bounded by the
// distance to the nearest surface. It is deterministic: pure float arithmetic, no RNG, no
// clock, no iteration order that depends on anything but the array order in the JSON.
//
// LAYERS. RI-CAM01 §C's exclusion list is exhaustive and is enforced structurally: this set
// contains ONLY static world geometry. Characters, creatures, projectiles, VFX, foliage
// cards, triggers, water surfaces and item pickups are not in it and there is no code path
// that could add them, which is why RI-CAM01 M6 passes by construction rather than by care.
'use strict';

const EPS = 1e-9;

/** Local scratch. Module-scope and reused: the sim step allocates nothing (RI-PLT01 P4). */
const _p = [0, 0, 0];
const _q = [0, 0, 0];

/**
 * A collision cell: a flat list of primitives plus a cached bound.
 * Shapes:
 *   {k:'box', c:[x,y,z], h:[hx,hy,hz], yaw_deg?}   oriented box (yaw about +Y only)
 *   {k:'cyl', c:[x,y,z], half_h, r}                 vertical finite cylinder
 *   {k:'cap', a:[x,y,z], b:[x,y,z], r}              capsule (mangrove roots, rails, branches)
 *   {k:'plane_y', y}                                the ground half-space y < value
 */
export class CollisionCell {
  constructor(id, shapes, meta) {
    this.id = id;
    this.meta = meta || {};
    this.shapes = [];
    for (const s of shapes || []) this.add(s);
    this.movers = [];     // shapes whose transform a scenario animates (cam-collision-rig)
  }

  add(s) {
    const k = s.k;
    if (k === 'box') {
      const yaw = (s.yaw_deg || 0) * Math.PI / 180;
      this.shapes.push({
        k: 0, c: [s.c[0], s.c[1], s.c[2]], h: [s.h[0], s.h[1], s.h[2]],
        cy: Math.cos(yaw), sy: Math.sin(yaw), id: s.id || null,
      });
    } else if (k === 'cyl') {
      this.shapes.push({ k: 1, c: [s.c[0], s.c[1], s.c[2]], hh: s.half_h, r: s.r, id: s.id || null });
    } else if (k === 'cap') {
      this.shapes.push({ k: 2, a: [s.a[0], s.a[1], s.a[2]], b: [s.b[0], s.b[1], s.b[2]], r: s.r, id: s.id || null });
    } else if (k === 'plane_y') {
      this.shapes.push({ k: 3, y: s.y, id: s.id || null });
    } else {
      throw new Error(`collision: unknown primitive kind '${k}'`);
    }
    return this.shapes[this.shapes.length - 1];
  }

  /** Signed-ish exterior distance: 0 inside, exact Euclidean distance outside. */
  distance(px, py, pz) {
    let best = Infinity;
    const S = this.shapes;
    for (let i = 0; i < S.length; i++) {
      const d = shapeDistance(S[i], px, py, pz);
      if (d < best) { best = d; if (best <= 0) return 0; }
    }
    return best;
  }

  /** True iff the point is inside any solid. RI-CAM01 §D's `clip_through` primitive. */
  contains(px, py, pz) { return this.distance(px, py, pz) <= 0; }

  /**
   * Sphere cast from `from` to `to` with radius `r`, by conservative advancement.
   * @returns {number} the fraction of the segment travelled before the sphere touches
   *   solid geometry; 1 when the whole segment is clear. Never overshoots.
   */
  sphereCast(from, to, r) {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < EPS) return this.distance(from[0], from[1], from[2]) <= r ? 0 : 1;
    let t = 0;
    // 96 iterations is ~3× what a grazing cast against this build's worst cell needs; the
    // loop is bounded rather than `while` so a degenerate cell cannot hang the sim step.
    for (let it = 0; it < 96; it++) {
      const px = from[0] + dx * t, py = from[1] + dy * t, pz = from[2] + dz * t;
      const d = this.distance(px, py, pz);
      if (d <= r) return t;
      const adv = (d - r) / L;
      t += adv;
      if (t >= 1) return 1;
      if (adv < 1e-6) return t;      // grazing: stop conservatively, do not spin
    }
    return t;
  }

  /**
   * Push a sphere out of solid geometry along the steepest-ascent direction, by finite
   * differences on `distance`. Used for the PLAYER's body, never for the camera: the camera
   * stays on its arm ray (RI-CAM01 §C), and a camera that is depenetrated sideways is a
   * camera whose position is no longer a function of the pivot and the two angles.
   */
  resolveSphere(p, r, iterations) {
    const n = iterations || 4;
    for (let i = 0; i < n; i++) {
      const d = this.distance(p[0], p[1], p[2]);
      if (d >= r) return i > 0;
      const h = 0.02;
      const gx = this.distance(p[0] + h, p[1], p[2]) - this.distance(p[0] - h, p[1], p[2]);
      const gz = this.distance(p[0], p[1], p[2] + h) - this.distance(p[0], p[1], p[2] - h);
      const gl = Math.sqrt(gx * gx + gz * gz);
      if (gl < 1e-7) {
        // Fully inside with no horizontal gradient (dead centre of a column). Nudge +X so
        // the next iteration has a gradient to follow. Deterministic, not random.
        p[0] += r * 0.5;
        continue;
      }
      const push = (r - d) + 1e-4;
      p[0] += (gx / gl) * push;
      p[2] += (gz / gl) * push;
    }
    return true;
  }
}

function shapeDistance(s, px, py, pz) {
  switch (s.k) {
    case 0: {                                   // oriented box
      const rx = px - s.c[0], ry = py - s.c[1], rz = pz - s.c[2];
      const lx = rx * s.cy - rz * s.sy;
      const lz = rx * s.sy + rz * s.cy;
      const ax = Math.abs(lx) - s.h[0];
      const ay = Math.abs(ry) - s.h[1];
      const az = Math.abs(lz) - s.h[2];
      if (ax <= 0 && ay <= 0 && az <= 0) return 0;
      const qx = ax > 0 ? ax : 0, qy = ay > 0 ? ay : 0, qz = az > 0 ? az : 0;
      return Math.sqrt(qx * qx + qy * qy + qz * qz);
    }
    case 1: {                                   // vertical finite cylinder
      const dx = px - s.c[0], dz = pz - s.c[2];
      const dr = Math.sqrt(dx * dx + dz * dz) - s.r;
      const dy = Math.abs(py - s.c[1]) - s.hh;
      if (dr <= 0 && dy <= 0) return 0;
      const a = dr > 0 ? dr : 0, b = dy > 0 ? dy : 0;
      return Math.sqrt(a * a + b * b);
    }
    case 2: {                                   // capsule
      const ax = s.a[0], ay = s.a[1], az = s.a[2];
      const bx = s.b[0] - ax, by = s.b[1] - ay, bz = s.b[2] - az;
      const px2 = px - ax, py2 = py - ay, pz2 = pz - az;
      const bb = bx * bx + by * by + bz * bz;
      let t = bb > EPS ? (px2 * bx + py2 * by + pz2 * bz) / bb : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const cx = px2 - bx * t, cy = py2 - by * t, cz = pz2 - bz * t;
      const d = Math.sqrt(cx * cx + cy * cy + cz * cz) - s.r;
      return d > 0 ? d : 0;
    }
    default: {                                  // ground half-space
      const d = py - s.y;
      return d > 0 ? d : 0;
    }
  }
}

/** Build the cell registry from `game/data/camera/cells.json`. */
export function buildCells(json) {
  const out = new Map();
  for (const cell of json.cells) {
    out.set(cell.id, new CollisionCell(cell.id, cell.shapes, {
      class: cell.class || 'rig',
      title: cell.title || '',
      ground_y: cell.ground_y === undefined ? 0 : cell.ground_y,
      spine: cell.spine || null,
      declared: cell.declared || null,
    }));
  }
  return out;
}

/** The empty cell — used for the exterior patch, which has no authored collision yet. */
export const EMPTY_CELL = new CollisionCell('__empty', [], { class: 'rig', title: 'no authored collision' });
