#!/usr/bin/env node
// building-overlap-census.mjs — HOW MANY BUILDINGS IN THIS WORLD ARE INSIDE EACH OTHER?
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
//
// `reports/opening-frame/2026-08-14-opening-frame.md` §1 found the Writ House and the barge hold
// at Thorn — the first two structures a player meets, in the town the game starts in — overlapping
// by 7.02 x 4.00 m, with the writ house's front door opening INSIDE the barge hold. The ruling
// that commissioned this tool (`orchestration/status/RULING-D1-BUILDING-OVERLAP.json`) says the
// bigger half of the finding is that the class is unmeasured: one overlap found by accident, in
// the first two buildings anybody looked at closely, across eight settlements, is not evidence of
// one overlap — it is evidence that nobody counted.
//
// ---------------------------------------------------------------------------------------------
// WHAT THE SHIPPED CODE ALREADY DOES, AND THE HOLE IN IT
// ---------------------------------------------------------------------------------------------
//
// `render/exterior.js#planSettlement()` HAS an overlap resolver — the per-axis shrink pass at
// `MAX_OVERLAP_FRAC = 0.45` — and `world/province.js#_deepOverlaps()` HAS a counter for what it
// failed to resolve. Both compare AXIS-ALIGNED footprints:
//
//     const Dx = Math.abs(a.x - c.x), Dz = Math.abs(a.z - c.z);
//     const Sx = (aw + cw) / 2,       Sz = (ad + cd) / 2;
//
// `settlementSolids()` — the geometry the player actually collides with, and
// `buildSettlementExterior()` — the geometry the player actually SEES, both rotate the footprint
// by `yaw_deg`:
//
//     const wx = b.x + cx * c + cz * s, wz = b.z - cx * s + cz * c;
//
// So for any building whose yaw is not a multiple of 180 the resolver and its counter are
// measuring a rectangle that is not the one in the world. At yaw 90 the width and depth are
// swapped: Thorn's barge hold is declared 7.00 x 16.02 and stands 16.02 x 7.00. The resolver
// checked the wrong pair of axes, found no problem, and the counter agreed with it.
//
// This tool measures the ORIENTED rectangles — the ones that are drawn and collided with.
//
// ---------------------------------------------------------------------------------------------
// WHAT COUNTS AS AN OVERLAP, AND WHAT DOES NOT
// ---------------------------------------------------------------------------------------------
//
// A real town has buildings that share a wall, terraces, lean-tos and porches under an upper
// storey — Thorn's own record says so in as many words ("every structure is a lean-to and none is
// free-standing"). A census that folds those in inflates its own number and is useless. So the
// measure is SEPARATION DEPTH: the minimum translation distance (SAT) that would pull the two
// oriented rectangles apart. Not area, because a long thin graze of two big buildings has a big
// area and is architecturally nothing.
//
//   depth <= 0                shapes/nothing               NOT an overlap. Disjoint or touching.
//   0 < depth <= 0.36 m       `shared_wall`                NOT counted. 0.36 m is the shipped
//                                                          `SHELL_WALL_T`: two buildings whose
//                                                          wall slabs coincide is a terrace.
//   0.36 < depth <= 1.50 m    `borderline`                 REPORTED SEPARATELY, never folded in.
//                                                          A porch, an eave, a lean-to leaning.
//                                                          1.50 m is above the 1.10 m of roof
//                                                          overhang `settlementSolids()` itself
//                                                          adds (0.55 m a side) and below the
//                                                          5.00 m `MIN_ENTERABLE_SPAN_M` floor,
//                                                          so it cannot swallow a whole room.
//   depth > 1.50 m            `overlap`                    COUNTED. More than a wall, an eave and
//                                                          a porch: one building's floor area is
//                                                          inside another building's floor area.
//
// Two aggravating flags are reported on top, because they are what a player sees:
//   `door_inside_other`   — this building's door point is inside another building's footprint.
//                           This is the Thorn defect exactly, and it is the one that cannot be
//                           argued as architecture.
//   `centre_inside_other` — one building's centre is inside the other's footprint: swallowed.
//
// STRUCTURES (`kind: "structure"` — wells, posts, racks, kerbs) are censused SEPARATELY and never
// folded into the headline. `settlementSolids()` does not give them a footprint box at all; it
// builds feature volumes from `structureCollisionLocal()`, so their declared footprint is a plot,
// not a mass, and a bow rack "overlapping" a hall by its plot is not a defect.
//
// ---------------------------------------------------------------------------------------------
// USAGE
//   node tools/world/building-overlap-census.mjs [--json <path>] [--quiet]
//   node tools/world/building-overlap-census.mjs --self-test      # proves the instrument fails
//   node tools/world/building-overlap-census.mjs --gate           # exit 1 if any overlap counted
//   node tools/world/building-overlap-census.mjs --settlement thorn
//
// Exit codes: 0 nothing counted (or no --gate), 1 counted overlaps under --gate, 2 tool error.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname, '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
if (args.help || args.h) {
  process.stdout.write(fs.readFileSync(new URL(import.meta.url).pathname, 'utf8')
    .split('\n').filter((l) => l.startsWith('//')).join('\n') + '\n');
  process.exit(0);
}
const say = args.quiet ? () => {} : (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// the thresholds, in one place so a critic can move them and re-run
// ---------------------------------------------------------------------------------------------
export const SHARED_WALL_M = 0.36;   // === SHELL_WALL_T in render/exterior.js
export const BORDERLINE_M = 1.50;    // above the 1.10 m of roof overhang settlementSolids() adds

// ---------------------------------------------------------------------------------------------
// geometry — oriented rectangles, exactly as settlementSolids() orients them
// ---------------------------------------------------------------------------------------------

/**
 * The four world corners of a building's drawn footprint.
 *
 * The rotation is copied from `settlementSolids()`'s `push()`, not re-derived:
 *     wx = b.x + cx * cos(yaw) + cz * sin(yaw)
 *     wz = b.z - cx * sin(yaw) + cz * cos(yaw)
 * so a change to that convention shows up here as a disagreement, not as a silent drift.
 */
export function footprintCorners(b) {
  const w = (b.drawn_footprint_m ? b.drawn_footprint_m[0] : b.footprint_m[0]);
  const d = (b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1]);
  const yaw = (b.yaw_deg || 0) * Math.PI / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hw = w / 2, hd = d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
    .map(([cx, cz]) => [b.x + cx * c + cz * s, b.z - cx * s + cz * c]);
}

/** Separating-axis test on two convex quads. Returns the minimum translation distance, or 0. */
export function penetrationDepth(A, B) {
  let best = Infinity;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      // outward normal of this edge
      let nx = -(q[1] - p[1]), nz = q[0] - p[0];
      const L = Math.hypot(nx, nz);
      if (L < 1e-9) continue;
      nx /= L; nz /= L;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of A) { const t = v[0] * nx + v[1] * nz; if (t < aMin) aMin = t; if (t > aMax) aMax = t; }
      for (const v of B) { const t = v[0] * nx + v[1] * nz; if (t < bMin) bMin = t; if (t > bMax) bMax = t; }
      const ov = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (ov <= 0) return 0;               // a separating axis exists: they do not overlap
      if (ov < best) best = ov;
    }
  }
  return best === Infinity ? 0 : best;
}

/** Sutherland-Hodgman clip of convex `subject` by convex `clip`. Both CCW or both CW is fine. */
export function intersectionArea(subject, clip) {
  const areaOf = (P) => {
    let a = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(a) / 2;
  };
  // orient both the same way (CCW positive by the shoelace)
  const ccw = (P) => {
    let a = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a >= 0 ? P : P.slice().reverse();
  };
  let out = ccw(subject.slice());
  const C = ccw(clip.slice());
  for (let i = 0; i < C.length && out.length; i++) {
    const p = C[i], q = C[(i + 1) % C.length];
    const inside = (v) => (q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]) >= -1e-12;
    const input = out; out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k], prev = input[(k + input.length - 1) % input.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci !== pi) {
        // segment prev->cur crosses the edge p->q
        const r = [cur[0] - prev[0], cur[1] - prev[1]], e = [q[0] - p[0], q[1] - p[1]];
        const den = r[0] * e[1] - r[1] * e[0];
        if (Math.abs(den) > 1e-12) {
          const t = ((p[0] - prev[0]) * e[1] - (p[1] - prev[1]) * e[0]) / den;
          out.push([prev[0] + t * r[0], prev[1] + t * r[1]]);
        }
      }
      if (ci) out.push(cur);
    }
  }
  return out.length < 3 ? 0 : areaOf(out);
}

/**
 * CAN THE PLAN'S OWN LEVER REACH THIS PAIR? — the question the ruling's falsifier turns on.
 *
 * `planSettlement()`'s comment is explicit that positions are never moved and only sizes are
 * touched, and the shrink has floors: `MIN_ENTERABLE_SPAN_M` 5.0 m for a building you can walk
 * into, `MIN_FOOTPRINT_M` 3.4 m otherwise. So the most a size-only resolver can EVER do to a pair
 * is take both buildings to their floors. Do that, and re-measure:
 *
 *   * separated at the floors  -> shrinking can reach it. Nothing moves, no street layout, quest
 *     coordinate or door registration changes, and the fix is a code fix in one function.
 *   * still overlapping at the floors -> shrinking cannot reach it. Only moving a position can,
 *     and that is the layout migration the falsifier describes.
 *
 * This is a bound, not a proposal: it says what is REACHABLE, not what should be shipped.
 */
export function shrinkFeasible(a, b, limit = BORDERLINE_M, minEnterable = 5.0, minOther = 3.4) {
  const floored = (o) => {
    const fp = (o.drawn_footprint_m || o.footprint_m);
    const floor = o.enterable ? minEnterable : minOther;
    return { ...o, drawn_footprint_m: [Math.min(fp[0], floor), Math.min(fp[1], floor)] };
  };
  return penetrationDepth(footprintCorners(floored(a)), footprintCorners(floored(b))) <= limit;
}

/** Is world point (x, z) inside this convex quad? */
export function pointInside(P, x, z) {
  let sign = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const cr = (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
    if (Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// the census over one plan
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} plan  a `planSettlement()` result (post-`applyInteriorBounds`, as the game holds it)
 * @returns {object} { id, buildings, pairs: [...], counts: {...} }
 */
export function censusPlan(plan) {
  const B = plan.buildings.map((b) => ({ b, poly: footprintCorners(b) }));
  const pairs = [];
  for (let i = 0; i < B.length; i++) {
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j];
      // cheap reject on the circumscribed radii before the SAT
      const ra = Math.hypot(...(a.b.drawn_footprint_m || a.b.footprint_m)) / 2;
      const rc = Math.hypot(...(c.b.drawn_footprint_m || c.b.footprint_m)) / 2;
      const dd = Math.hypot(a.b.x - c.b.x, a.b.z - c.b.z);
      if (dd > ra + rc) continue;
      const depth = penetrationDepth(a.poly, c.poly);
      if (depth <= 1e-6) continue;
      const area = intersectionArea(a.poly, c.poly);
      const aArea = (a.b.drawn_footprint_m || a.b.footprint_m).reduce((p, q) => p * q, 1);
      const cArea = (c.b.drawn_footprint_m || c.b.footprint_m).reduce((p, q) => p * q, 1);
      const structural = a.b.kind === 'structure' || c.b.kind === 'structure';
      const klass = depth <= SHARED_WALL_M ? 'shared_wall' : depth <= BORDERLINE_M ? 'borderline' : 'overlap';
      // the two aggravating flags
      const doors = [];
      if (a.b.door && pointInside(c.poly, a.b.door[0], a.b.door[2])) doors.push(a.b.id);
      if (c.b.door && pointInside(a.poly, c.b.door[0], c.b.door[2])) doors.push(c.b.id);
      const centres = [];
      if (pointInside(c.poly, a.b.x, a.b.z)) centres.push(a.b.id);
      if (pointInside(a.poly, c.b.x, c.b.z)) centres.push(c.b.id);
      // the AABB view — what the shipped resolver and `_deepOverlaps()` see
      const aw = (a.b.drawn_footprint_m || a.b.footprint_m)[0], ad = (a.b.drawn_footprint_m || a.b.footprint_m)[1];
      const cw = (c.b.drawn_footprint_m || c.b.footprint_m)[0], cd = (c.b.drawn_footprint_m || c.b.footprint_m)[1];
      const ox = (aw + cw) / 2 - Math.abs(a.b.x - c.b.x), oz = (ad + cd) / 2 - Math.abs(a.b.z - c.b.z);
      const yawBlindDeep = ox > Math.min(aw, cw) * 0.45 + 1e-6 && oz > Math.min(ad, cd) * 0.45 + 1e-6;
      pairs.push({
        settlement: plan.id,
        a: a.b.id, b: c.b.id,
        a_kind: a.b.kind, b_kind: c.b.kind,
        a_enterable: !!a.b.enterable, b_enterable: !!c.b.enterable,
        a_yaw: a.b.yaw_deg || 0, b_yaw: c.b.yaw_deg || 0,
        a_footprint_m: [+aw.toFixed(2), +ad.toFixed(2)],
        b_footprint_m: [+cw.toFixed(2), +cd.toFixed(2)],
        depth_m: +depth.toFixed(3),
        area_m2: +area.toFixed(2),
        frac_of_smaller: +(area / Math.min(aArea, cArea)).toFixed(4),
        class: klass,
        structural,
        door_inside_other: doors,
        centre_inside_other: centres,
        yaw_blind_deep_overlap: yawBlindDeep,
        yawed: (a.b.yaw_deg || 0) % 180 !== 0 || (c.b.yaw_deg || 0) % 180 !== 0,
        shrink_feasible: klass === 'overlap' ? shrinkFeasible(a.b, c.b) : null,
        centre_gap_m: +dd.toFixed(2),
      });
    }
  }
  pairs.sort((p, q) => q.depth_m - p.depth_m);
  const mass = pairs.filter((p) => !p.structural);
  const counts = {
    buildings: plan.buildings.length,
    mass_buildings: plan.buildings.filter((b) => b.kind !== 'structure').length,
    overlap: mass.filter((p) => p.class === 'overlap').length,
    borderline: mass.filter((p) => p.class === 'borderline').length,
    shared_wall: mass.filter((p) => p.class === 'shared_wall').length,
    door_inside_other: mass.filter((p) => p.door_inside_other.length).length,
    centre_inside_other: mass.filter((p) => p.centre_inside_other.length).length,
    structure_pairs_overlap: pairs.filter((p) => p.structural && p.class === 'overlap').length,
    yaw_blind_deep_overlaps: pairs.filter((p) => p.yaw_blind_deep_overlap).length,
    overlap_shrink_feasible: mass.filter((p) => p.class === 'overlap' && p.shrink_feasible).length,
    overlap_needs_move: mass.filter((p) => p.class === 'overlap' && !p.shrink_feasible).length,
  };
  return { id: plan.id, name: plan.name, counts, pairs };
}

// ---------------------------------------------------------------------------------------------
// the world, built the way `world/province.js#setSettlements()` builds it
// ---------------------------------------------------------------------------------------------
export async function buildPlans() {
  const { planSettlement, applyInteriorBounds } = await import(path.join(ROOT, 'game/src/render/exterior.js'));
  const interiors = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/interiors'))) {
    if (!f.endsWith('.json')) continue;
    const rec = J(`game/data/world/interiors/${f}`);
    interiors[rec.id] = rec;
  }
  const docs = fs.readdirSync(path.join(ROOT, 'game/data/world/settlements'))
    .filter((f) => f.endsWith('.json')).sort()
    .map((f) => J(`game/data/world/settlements/${f}`));
  const plans = docs.map((d) => planSettlement(d, interiors));
  // The join runs in the game before anything is drawn, and it MOVES DOORS onto the entry wall.
  // Censusing pre-join doors would ask the question of a door the world does not have.
  applyInteriorBounds(plans, interiors, docs);
  return plans;
}

// ---------------------------------------------------------------------------------------------
// self-test — rule 4: break the thing on purpose and confirm the instrument goes red
// ---------------------------------------------------------------------------------------------
function selfTest() {
  const fail = [];
  const ok = (name, cond, detail) => {
    say(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    if (!cond) fail.push(name);
  };
  const mk = (id, x, z, w, d, yaw, extra = {}) => ({
    id, kind: 'interior', enterable: true, yaw_deg: yaw, x, y: 0, z,
    footprint_m: [w, d], drawn_footprint_m: [w, d], door: null, ...extra,
  });
  const P = (bs) => ({ id: 'synthetic', name: 'synthetic', buildings: bs });

  say('  --- the arms must disagree, or the instrument is a second copy of the experiment ---');

  // 1. two buildings 20 m apart: nothing at all.
  ok('disjoint pair reports no pair',
    censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 40, 0, 10, 10, 0)])).pairs.length === 0);

  // 2. exactly touching: not an overlap.
  ok('touching pair is not an overlap',
    censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 10, 0, 10, 10, 0)])).counts.overlap === 0);

  // 3. shared wall (0.3 m of coincident masonry): classified, not counted.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 9.7, 0, 10, 10, 0)]));
    ok('shared wall classifies as shared_wall and is not counted',
      r.counts.shared_wall === 1 && r.counts.overlap === 0, `depth ${r.pairs[0].depth_m} m`);
  }

  // 4. a porch-depth graze: borderline, still not counted.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 8.8, 0, 10, 10, 0)]));
    ok('1.2 m graze classifies as borderline and is not counted',
      r.counts.borderline === 1 && r.counts.overlap === 0, `depth ${r.pairs[0].depth_m} m`);
  }

  // 5. a real overlap: counted, and the depth is right.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 6, 0, 10, 10, 0)]));
    ok('4 m interpenetration is counted as an overlap',
      r.counts.overlap === 1 && Math.abs(r.pairs[0].depth_m - 4) < 1e-3, `depth ${r.pairs[0].depth_m} m`);
  }

  // 6. THE YAW ARM. Identical centres and footprints; one arm yawed 90. This is the arm the
  //    shipped resolver cannot see, and the two arms are REQUIRED to disagree.
  {
    const flat = censusPlan(P([mk('a', 0, 0, 16, 7, 0), mk('b', 0, 8, 16, 7, 0)]));
    const yawed = censusPlan(P([mk('a', 0, 0, 16, 7, 0), mk('b', 0, 8, 16, 7, 90)]));
    ok('yaw 90 changes the answer (the arms disagree)',
      flat.counts.overlap === 0 && yawed.counts.overlap === 1,
      `axis-aligned ${flat.counts.overlap}, yawed ${yawed.counts.overlap}`);
    ok('and the yaw-blind AABB view misses exactly that pair',
      yawed.pairs[0].yaw_blind_deep_overlap === false && yawed.pairs[0].class === 'overlap');
  }

  // 7. the door flag fires, and only when the door is really inside.
  {
    const inside = censusPlan(P([mk('a', 0, 0, 10, 10, 0, { door: [4, 0, 4] }), mk('b', 6, 0, 10, 10, 0)]));
    const outside = censusPlan(P([mk('a', 0, 0, 10, 10, 0, { door: [-4, 0, -4] }), mk('b', 6, 0, 10, 10, 0)]));
    ok('door_inside_other fires on a door inside the neighbour',
      inside.counts.door_inside_other === 1 && outside.counts.door_inside_other === 0);
  }

  // 8. structures are separated, never folded into the headline.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('p', 3, 0, 4, 4, 0, { kind: 'structure' })]));
    ok('a structure inside a building does not enter the headline count',
      r.counts.overlap === 0 && r.counts.structure_pairs_overlap === 1);
  }

  // 9. area is exact, not approximated.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 6, 0, 10, 10, 0)]));
    ok('intersection area is exact', Math.abs(r.pairs[0].area_m2 - 40) < 0.01, `${r.pairs[0].area_m2} m2`);
  }

  // 10. a rotated square against itself at 45 degrees — the polygon clipper has to be real.
  {
    const r = censusPlan(P([mk('a', 0, 0, 10, 10, 0), mk('b', 0, 0, 10, 10, 45)]));
    const want = 100 * (2 * Math.SQRT2 - 2);   // area of the octagonal intersection
    ok('45-degree rotated square intersection is the analytic octagon',
      Math.abs(r.pairs[0].area_m2 - want) < 0.05, `${r.pairs[0].area_m2} vs ${want.toFixed(2)} m2`);
  }

  say(fail.length ? `\nself-test: ${fail.length} FAILED — ${fail.join(', ')}` : '\nself-test: 10/10 passed');
  return fail.length ? 2 : 0;
}

// ---------------------------------------------------------------------------------------------
// main — guarded, so another tool can import `censusPlan`/`penetrationDepth` without this file
// reading the CALLER's process.argv and censusing the world as a side effect of being imported.
// ---------------------------------------------------------------------------------------------
const RUN_AS_SCRIPT = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!RUN_AS_SCRIPT) { /* imported as a library: export only */ }
else {

if (args['self-test']) process.exit(selfTest());

const plans = await buildPlans();
const wanted = typeof args.settlement === 'string' ? String(args.settlement).split(',') : null;
const results = plans.filter((p) => !wanted || wanted.includes(p.id)).map(censusPlan);

const total = {
  settlements: results.length,
  buildings: results.reduce((n, r) => n + r.counts.buildings, 0),
  mass_buildings: results.reduce((n, r) => n + r.counts.mass_buildings, 0),
  overlap: results.reduce((n, r) => n + r.counts.overlap, 0),
  borderline: results.reduce((n, r) => n + r.counts.borderline, 0),
  shared_wall: results.reduce((n, r) => n + r.counts.shared_wall, 0),
  door_inside_other: results.reduce((n, r) => n + r.counts.door_inside_other, 0),
  centre_inside_other: results.reduce((n, r) => n + r.counts.centre_inside_other, 0),
  structure_pairs_overlap: results.reduce((n, r) => n + r.counts.structure_pairs_overlap, 0),
  yaw_blind_deep_overlaps: results.reduce((n, r) => n + r.counts.yaw_blind_deep_overlaps, 0),
  overlap_shrink_feasible: results.reduce((n, r) => n + r.counts.overlap_shrink_feasible, 0),
  overlap_needs_move: results.reduce((n, r) => n + r.counts.overlap_needs_move, 0),
  settlements_with_overlap: results.filter((r) => r.counts.overlap > 0).length,
};

say('building overlap census — oriented footprints, as drawn and collided with');
say(`  thresholds: shared_wall <= ${SHARED_WALL_M} m < borderline <= ${BORDERLINE_M} m < overlap`);
say('');
say('  settlement    bldgs  mass  OVERLAP  borderline  shared-wall  door-in  centre-in');
for (const r of results) {
  const c = r.counts;
  say(`  ${r.id.padEnd(12)}  ${String(c.buildings).padStart(5)}  ${String(c.mass_buildings).padStart(4)}  ${String(c.overlap).padStart(7)}  ${String(c.borderline).padStart(10)}  ${String(c.shared_wall).padStart(11)}  ${String(c.door_inside_other).padStart(7)}  ${String(c.centre_inside_other).padStart(9)}`);
}
say(`  ${'TOTAL'.padEnd(12)}  ${String(total.buildings).padStart(5)}  ${String(total.mass_buildings).padStart(4)}  ${String(total.overlap).padStart(7)}  ${String(total.borderline).padStart(10)}  ${String(total.shared_wall).padStart(11)}  ${String(total.door_inside_other).padStart(7)}  ${String(total.centre_inside_other).padStart(9)}`);
say('');
const counted = results.flatMap((r) => r.pairs).filter((p) => !p.structural && p.class === 'overlap');
if (counted.length) {
  say(`  the ${counted.length} counted overlap(s), deepest first:`);
  for (const p of counted) {
    say(`    ${p.settlement.padEnd(10)} ${p.a} <-> ${p.b}   depth ${p.depth_m.toFixed(2)} m   area ${p.area_m2.toFixed(1)} m2 (${(p.frac_of_smaller * 100).toFixed(0)}% of the smaller)   yaw ${p.a_yaw}/${p.b_yaw}${p.door_inside_other.length ? '   DOOR INSIDE: ' + p.door_inside_other.join(',') : ''}${p.yaw_blind_deep_overlap ? '' : '   [invisible to the shipped AABB check]'}`);
  }
} else {
  say('  no counted overlaps.');
}
say('');
say(`  the shipped yaw-blind check (_deepOverlaps) would report: ${total.yaw_blind_deep_overlaps}`);
say(`  structure-vs-anything overlaps, reported separately and not in the headline: ${total.structure_pairs_overlap}`);
say(`  reachable by the plan's own size-only lever (shrink to the floors): ${total.overlap_shrink_feasible} of ${total.overlap}`);
say(`  reachable only by MOVING a position (the layout migration): ${total.overlap_needs_move} of ${total.overlap}`);

if (args.json) {
  const out = path.isAbsolute(String(args.json)) ? String(args.json) : path.join(ROOT, String(args.json));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    tool: 'tools/world/building-overlap-census.mjs',
    generated_utc: new Date().toISOString(),
    thresholds_m: { shared_wall: SHARED_WALL_M, borderline: BORDERLINE_M },
    total,
    settlements: results,
  }, null, 2) + '\n');
  say(`  json: ${path.relative(ROOT, out)}`);
}

if (args.gate && total.overlap > 0) process.exit(1);

} // end RUN_AS_SCRIPT
