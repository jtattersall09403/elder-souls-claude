#!/usr/bin/env node
/*
 * CRITIC W1-04 ROUND 6 — THE OFFLINE ARMS. Bare node, no browser.
 *
 * Written against the round's CLAIMS, not adapted from its tools. Sections:
 *
 *   M  MIRRORS      — render/ vs sim/ constants, re-read here so this file does not inherit the
 *                     round's own assertion that they agree.
 *   A  ARITHMETIC   — the round's whole argument is `SHELL_WALL_T/2 + PLAYER_RADIUS_M = 0.18 +
 *                     0.32 = 0.50`. A root cause that only explains the number already observed
 *                     is a story, so this section PREDICTS: it varies the body radius and the
 *                     slab thickness and checks the rest position lands where the arithmetic
 *                     says, against a REAL `CollisionCell` built from the shipped shapes.
 *   B  NOT-THE-SOLVER — the accept test is now "a fixed point of the collision solver". A test
 *                     that asks the solver where the body ends up can agree with the solver and
 *                     both be wrong about the world. So the slabs are checked against the DRAWN
 *                     geometry: `buildBuilding()`'s own `shellwall` meshes, measured off the
 *                     scene graph, not off `settlementSolids()`.
 *   H  THE HOLES    — the drawn doorway, the collision doorway and the INTERIOR doorway, for all
 *                     115. "By construction" is the phrase to distrust.
 *   O  ORDERING     — the derivation's own rule is "all doors in a town move before any doorstep
 *                     is derived". That is an ordering dependency. What happens if a settlement
 *                     gains a building?
 *   R  RE-ENTRY     — 112/115 leaves three. Name them, and say whether they are the orphans.
 *   P  PROPS        — both predicates, and what the reference item actually asks for.
 *
 *   node tools/world/critic-w1-04-r6-offline.mjs [--json <path>] [--self-break]
 *
 * IT GOES RED. `--self-break` scales every wall slab to a sliver, which must make section A's
 * predictions fail and section H's holes disagree. A probe that cannot fail is worse than none.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../game/vendor/three/three.module.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SELF_BREAK = has('--self-break');

const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
const COL = await import(path.join(ROOT, 'game/src/sim/collision.js'));
const WC = await import(path.join(ROOT, 'game/src/sim/world-collision.js'));
const SETT = await import(path.join(ROOT, 'game/src/sim/settlement.js'));

const readDir = (dir) => {
  const out = {};
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
    out[d.id] = d;
  }
  return out;
};
const RAW_S = readDir('game/data/world/settlements');
const RAW_I = readDir('game/data/world/interiors');
const clone = (o) => JSON.parse(JSON.stringify(o));

/** A whole fresh world + derivation, from the raw JSON, so no arm inherits another's mutations. */
function world(opts) {
  const S = clone(RAW_S), I = clone(RAW_I);
  if (opts && opts.mutate) opts.mutate(S, I);
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  const join = EX.applyInteriorBounds(plans, I, Object.values(S), (opts && opts.join) || {});
  return { S, I, plans, join, planById: new Map(plans.map((p) => [p.id, p])) };
}

const out = { tool: 'tools/world/critic-w1-04-r6-offline.mjs', when: new Date().toISOString(), commit: null, self_break: SELF_BREAK, findings: [], probe_failures: [] };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a git tree */ }

const SHIPPED = world({});

/* ================================ M — the mirrors ============================================ */
out.M = {
  body_radius: { render: EX.BODY_RADIUS_M, sim: WC.PLAYER_RADIUS_M, agree: EX.BODY_RADIUS_M === WC.PLAYER_RADIUS_M },
  door_reach: { render: EX.DOOR_REACH_M, sim: SETT.DOOR_REACH_M, agree: EX.DOOR_REACH_M === SETT.DOOR_REACH_M },
  shell_wall_t: EX.SHELL_WALL_T,
};
if (!out.M.body_radius.agree || !out.M.door_reach.agree) out.findings.push('MIRROR DRIFT between render/ and sim/');

/* ================================ A — the arithmetic ==========================================
 * The claim: a wall slab is SHELL_WALL_T thick and CENTRED ON the footprint edge, so it reaches
 * SHELL_WALL_T/2 outside; `resolveSphere` pushes until distance >= r; therefore a body placed on
 * the footprint edge comes to rest SHELL_WALL_T/2 + r outside it.
 *
 * That predicts a FAMILY of numbers, not one. Vary r; vary the slab thickness; check.
 * ==============================================================================================*/
const HEAD_Y = 0.90;                         // stepWorldCollision solves at pos[1] + 0.90

/** Rebuild a shape list with every box's HORIZONTAL half-extents scaled about its own centre. */
function scaleSlabs(shapes, k) {
  return shapes.map((s) => ({ ...s, h: [s.h[0], s.h[1], s.h[2]], c: s.c.slice() })).map((s) => {
    // Only the THIN axis is the wall thickness. Scaling it about the slab centre keeps the slab
    // centred on the footprint edge, which is the property under test.
    const thin = s.h[0] < s.h[2] ? 0 : 2;
    const h = s.h.slice(); h[thin] = s.h[thin] * k;
    return { ...s, h };
  });
}

function restPoint(cell, x, z, r, iters) {
  const p = [x, HEAD_Y, z];
  cell.resolveSphere(p, r, iters === undefined ? 6 : iters);
  return p;
}

/** A structural read of the slab geometry, straight off `settlementSolids()`. */
function slabGeometry(plan) {
  const shapes = EX.settlementSolids(plan, plan.pos ? plan.pos[0] : 0, plan.pos ? plan.pos[2] : 0, 1e9, null);
  const rows = [];
  for (const b of plan.buildings) {
    const w = b.drawn_footprint_m ? b.drawn_footprint_m[0] : b.footprint_m[0];
    const d = b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1];
    const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const sh of shapes) {
      if (!sh.id || !sh.id.startsWith(`${b.id}:`)) continue;
      // Back into the building's local frame.
      const rx = sh.c[0] - b.x, rz = sh.c[2] - b.z;
      const lx = rx * c - rz * s, lz = rx * s + rz * c;
      const tag = sh.id.slice(b.id.length + 1);
      const side = tag.slice(0, 2);
      const thin = (side === '-x' || side === '+x') ? 'x' : 'z';
      const half = thin === 'x' ? sh.h[0] : sh.h[2];
      const edge = thin === 'x' ? w / 2 : d / 2;
      const centreOn = thin === 'x' ? Math.abs(lx) : Math.abs(lz);
      rows.push({ building: b.id, tag, thin, slab_half_thickness: +half.toFixed(4), footprint_half_extent: +edge.toFixed(4), slab_centre_local: +centreOn.toFixed(4), centred_on_edge: Math.abs(centreOn - edge) < 1e-6, reaches_outside_m: +(centreOn + half - edge).toFixed(4) });
    }
  }
  return rows;
}

{
  const A = { what: 'is 0.18 + 0.32 = 0.50 the mechanism, or a coincidence that fits?' };
  // ---- A0: the geometry, structurally, over every slab in every town.
  const geo = [];
  for (const plan of SHIPPED.plans) geo.push(...slabGeometry(plan));
  const notCentred = geo.filter((g) => !g.centred_on_edge);
  const thick = new Set(geo.map((g) => g.slab_half_thickness));
  A.slabs_measured = geo.length;
  A.slab_half_thicknesses = [...thick].sort();
  A.slabs_not_centred_on_the_footprint_edge = notCentred.length;
  A.reaches_outside_footprint_m = [...new Set(geo.map((g) => g.reaches_outside_m))].sort();
  if (notCentred.length) out.findings.push(`A: ${notCentred.length} wall slabs are NOT centred on the footprint edge — the round's premise does not hold for them`);

  // ---- A1: the prediction. One town, one real CollisionCell, a body on the footprint edge.
  // For every non-entry wall of every building in `helstrom` (the deep-overlap town), place the
  // body exactly on the footprint edge and resolve. Predicted rest clearance from the edge, along
  // the wall's outward normal, is `slab_half_thickness * k + r`.
  const preds = [];
  for (const planId of ['helstrom', 'blackrose', 'archon', 'lilmoth', 'soulrest', 'thorn', 'gideon', 'stormhold']) {
    const plan = SHIPPED.planById.get(planId);
    if (!plan) continue;
    const base = EX.settlementSolids(plan, plan.pos[0], plan.pos[2], 1e9, null);
    for (const k of [1, 0.5, 2]) {
      const shapes = k === 1 ? base : scaleSlabs(base, k);
      for (const r of [0.16, 0.32, 0.48, 0.64]) {
        const cell = new COL.CollisionCell('pred', shapes, {});
        for (const b of plan.buildings) {
          const w = b.drawn_footprint_m ? b.drawn_footprint_m[0] : b.footprint_m[0];
          const d = b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1];
          const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
          const entry = (() => {
            const n = EX.entryOutwardWorld(b);
            const cc = Math.cos(-yaw), ss = Math.sin(-yaw);
            const lx = n[0] * cc + n[1] * ss, lz = -n[0] * ss + n[1] * cc;
            return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? '+x' : '-x') : (lz > 0 ? '+z' : '-z');
          })();
          // Nothing but this building's own slabs, so the prediction is about ONE slab.
          const others = shapes.filter((sh) => !sh.id || !sh.id.startsWith(`${b.id}:`));
          for (const [lx, lz, nlx, nlz, tag] of [[0, -d / 2, 0, -1, '-z'], [0, d / 2, 0, 1, '+z'], [-w / 2, 0, -1, 0, '-x'], [w / 2, 0, 1, 0, '+x']]) {
            // The entry wall's midpoint is the DOORWAY — a hole, not a slab. Excluded: my first
            // run judged those and read "observed 0" for every one of them, which was the probe
            // measuring a body standing in an open door and calling the law broken.
            if (tag === entry) continue;
            const wx = b.x + lx * c + lz * s, wz = b.z - lx * s + lz * c;
            const nx = nlx * c + nlz * s, nz = -nlx * s + nlz * c;
            const p = restPoint(cell, wx, wz, r, 24);
            const alongNormal = (p[0] - wx) * nx + (p[2] - wz) * nz;
            const lateral = Math.hypot(p[0] - wx - alongNormal * nx, p[2] - wz - alongNormal * nz);
            // Isolation measured on the GEOMETRY, not on shape centres: no other building's slab
            // within 3 m of the start or the rest point.
            const iso = Math.min(EX.horizontalClearance(others, wx, wz), EX.horizontalClearance(others, p[0], p[2]));
            preds.push({
              town: planId, building: b.id, wall: tag, k, r,
              predicted_m: +(EX.SHELL_WALL_T / 2 * k + r).toFixed(4),
              observed_m: +alongNormal.toFixed(4),
              lateral_m: +lateral.toFixed(4),
              isolation_m: +iso.toFixed(3),
              clean: iso > 3,
            });
          }
        }
      }
    }
  }
  const clean = preds.filter((p) => p.clean);
  const wrong = clean.filter((p) => Math.abs(p.observed_m - p.predicted_m) > 0.01);
  A.prediction = {
    what: 'a body placed exactly on the footprint edge of an ISOLATED wall, resolved against a real CollisionCell built from the shipped shapes',
    law: 'rest distance outside the footprint edge = SHELL_WALL_T/2 * k + r',
    varied: { body_radius_r: [0.16, 0.32, 0.48, 0.64], slab_thickness_scale_k: [1, 0.5, 2] },
    cases: preds.length, clean_cases: clean.length,
    cases_off_the_prediction_by_more_than_0_01m: wrong.length,
    worst_error_m: clean.length ? +Math.max(...clean.map((p) => Math.abs(p.observed_m - p.predicted_m))).toFixed(5) : null,
    by_cell: [0.16, 0.32, 0.48, 0.64].flatMap((r) => [1, 0.5, 2].map((k) => {
      const g = clean.filter((p) => p.r === r && p.k === k);
      return { r, k, n: g.length, predicted_m: +(EX.SHELL_WALL_T / 2 * k + r).toFixed(4), observed_mean_m: g.length ? +(g.reduce((a, p) => a + p.observed_m, 0) / g.length).toFixed(4) : null, worst_err_m: g.length ? +Math.max(...g.map((p) => Math.abs(p.observed_m - p.predicted_m))).toFixed(4) : null, mean_lateral_m: g.length ? +(g.reduce((a, p) => a + p.lateral_m, 0) / g.length).toFixed(4) : null };
    })),
    examples_wrong: wrong.slice(0, 8),
  };
  if (!clean.length) out.probe_failures.push('A: no clean prediction case at all — the probe measured nothing');
  if (wrong.length) out.findings.push(`A: ${wrong.length} of ${clean.length} isolated-wall cases do NOT land where the arithmetic predicts`);

  // ---- A1b: THE DIRECTION. The round says the solver "pushes down the steepest-ascent gradient,
  // which between two close buildings points at the neighbour". But `shapeDistance()` returns 0
  // EVERYWHERE inside a box, so a body inside a slab has NO gradient: `resolveSphere()` falls
  // into its `gl < 1e-7` branch and nudges `p[0] += r * 0.5` — WORLD +X, whatever the wall is
  // doing. One isolated slab, long in Z and thin in X, with the body at its centre, separates the
  // two stories: steepest ascent leaves by the near (±X) face; the code leaves by whichever face
  // the +X march reaches, and marches +X regardless.
  {
    const trials = [];
    for (const [name, h] of [['thin in X, long in Z', [0.18, 3.7, 8]], ['thin in Z, long in X', [8, 3.7, 0.18]]]) {
      for (const r of [0.32, 0.64]) {
        const cell = new COL.CollisionCell('one', [{ k: 'box', c: [0, 3.7, 0], h, id: 'slab' }], {});
        const p = [0, 0.9, 0];
        cell.resolveSphere(p, r, 24);
        trials.push({ slab: name, r, rest: [+p[0].toFixed(3), +p[2].toFixed(3)], left_by: Math.abs(p[0]) > Math.abs(p[2]) ? '+/-X face' : '+/-Z face', nearest_face_was: h[0] < h[2] ? '+/-X face' : '+/-Z face', travelled_m: +Math.hypot(p[0], p[2]).toFixed(3) });
      }
    }
    A.direction = {
      what: 'which way does resolveSphere() push a body that is INSIDE a slab?',
      the_rounds_claim: 'down the steepest-ascent gradient',
      the_code: "sim/collision.js shapeDistance() returns 0 everywhere inside a box, so the finite-difference gradient is 0 and resolveSphere() takes its `gl < 1e-7` branch: `p[0] += r * 0.5` — world +X, unconditionally",
      trials,
      gradient_is_zero_inside: (() => {
        const cell = new COL.CollisionCell('one', [{ k: 'box', c: [0, 3.7, 0], h: [8, 3.7, 0.18], id: 'slab' }], {});
        const h = 0.02;
        return { d_at_centre: cell.distance(0, 0.9, 0), d_plus_h: cell.distance(h, 0.9, 0), d_minus_h: cell.distance(-h, 0.9, 0), gradient: cell.distance(h, 0.9, 0) - cell.distance(-h, 0.9, 0) };
      })(),
    };
    const wrongWay = trials.filter((t) => t.left_by !== t.nearest_face_was);
    A.direction.trials_that_left_by_the_FAR_face = wrongWay.length;
    if (wrongWay.length) out.findings.push(`A: ${wrongWay.length} of ${trials.length} single-slab trials leave by the FAR face — the push inside a slab is world +X, not steepest ascent`);
  }

  // ---- A2: does the arithmetic explain the ROUND-5 SLIDE it is offered as the cause of?
  // Reproduce round 5's doorsteps (`r6: false`), then resolve each against a real cell at three
  // body radii. If the mechanism is the claimed one, the rest point sits `r` from the nearest
  // slab and the SLIDE moves with `r`.
  const r5 = world({ join: { r6: false } });
  const slides = [];
  for (const plan of r5.plans) {
    const shapes = EX.settlementSolids(plan, plan.pos[0], plan.pos[2], 1e9, null);
    for (const b of plan.buildings) {
      if (!b.interior) continue;
      const rec = r5.I[b.interior];
      const sp = rec && rec.continuity && rec.continuity.exterior_spawn;
      if (!sp) continue;
      const row = { town: plan.id, interior: b.interior, start_clearance_m: +EX.horizontalClearance(shapes, sp[0], sp[2]).toFixed(4), arms: {} };
      for (const r of [0.16, 0.32, 0.48]) {
        const cell = new COL.CollisionCell('slide', shapes, {});
        const p = restPoint(cell, sp[0], sp[2], r, 6);
        row.arms[r] = {
          slide_m: +Math.hypot(p[0] - sp[0], p[2] - sp[2]).toFixed(4),
          end_clearance_m: +EX.horizontalClearance(shapes, p[0], p[2]).toFixed(4),
          ends_inside: EX.insideBuilding(plan, p[0], p[2], 0),
        };
      }
      slides.push(row);
    }
  }
  const moved = slides.filter((s) => s.arms[0.32].slide_m > 0.001);
  const endClear = moved.map((s) => s.arms[0.32].end_clearance_m);
  A.round5_slide = {
    what: "round 5's own doorsteps, resolved against a real CollisionCell at three body radii",
    records: slides.length,
    moved_by_the_solver_at_r_0_32: moved.length,
    end_clearance_at_r_0_32: { min: endClear.length ? +Math.min(...endClear).toFixed(4) : null, max: endClear.length ? +Math.max(...endClear).toFixed(4) : null },
    end_clearance_equals_r_within_0_01: moved.filter((s) => Math.abs(s.arms[0.32].end_clearance_m - 0.32) <= 0.01).length,
    mean_slide_by_radius: [0.16, 0.32, 0.48].map((r) => ({ r, moved: slides.filter((s) => s.arms[r].slide_m > 0.001).length, mean_slide_m: +(slides.reduce((a, s) => a + s.arms[r].slide_m, 0) / slides.length).toFixed(4) })),
    end_inside_a_building_by_radius: [0.16, 0.32, 0.48].map((r) => ({ r, n: slides.filter((s) => s.arms[r].ends_inside).length })),
    rows: slides.filter((s) => s.arms[0.32].slide_m > 0.001).map((s) => ({ interior: s.interior, start_clearance_m: s.start_clearance_m, slide_016: s.arms[0.16].slide_m, slide_032: s.arms[0.32].slide_m, slide_048: s.arms[0.48].slide_m, ends_inside_032: s.arms[0.32].ends_inside })),
  };
  out.A = A;
}

/* ================================ B — not the solver ==========================================
 * The accept test asks `horizontalClearance()` over `settlementSolids()`. `resolveSphere()` asks
 * `CollisionCell.distance()` over the same list. Those two agreeing proves nothing about the
 * WORLD. The third thing, which is neither, is the geometry that is DRAWN: `buildBuilding()`'s
 * `shellwall` meshes. This section measures those off the scene graph and compares.
 * ==============================================================================================*/
{
  const B = { what: 'the drawn wall, measured off buildBuilding()\'s own meshes, against settlementSolids()' };
  const rows = [];
  for (const plan of SHIPPED.plans) {
    const shapes = EX.settlementSolids(plan, plan.pos[0], plan.pos[2], 1e9, null);
    for (const b of plan.buildings) {
      let g;
      try { g = EX.buildBuilding(b, plan.id).group; } catch (e) { out.probe_failures.push(`B: buildBuilding(${b.id}) threw: ${e.message}`); continue; }
      if (!g || typeof g.traverse !== 'function') { out.probe_failures.push(`B: buildBuilding(${b.id}) returned no group`); continue; }
      const drawn = [];
      g.traverse((m) => {
        if (m.name !== 'shellwall' || !m.geometry || !m.geometry.parameters) return;
        const par = m.geometry.parameters;
        drawn.push({ c: [m.position.x, m.position.z], h: [par.width / 2, par.depth / 2] });
      });
      const mine = shapes.filter((s) => s.id && s.id.startsWith(`${b.id}:`));
      // Both are axis-aligned in the building's LOCAL frame. Put the solids back into it.
      const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
      const solidsLocal = mine.map((sh) => {
        const rx = sh.c[0] - b.x, rz = sh.c[2] - b.z;
        return { c: [rx * c - rz * s, rx * s + rz * c], h: [sh.h[0], sh.h[2]], id: sh.id };
      });
      const f3 = (v) => (Math.abs(v) < 5e-4 ? '0.000' : v.toFixed(3));
      const key = (o) => `${f3(o.c[0])},${f3(o.c[1])},${f3(o.h[0])},${f3(o.h[1])}`;
      const dset = new Set(drawn.map(key));
      const sset = new Set(solidsLocal.map(key));
      const solidOnly = solidsLocal.filter((o) => !dset.has(key(o)));
      const drawnOnly = drawn.filter((o) => !sset.has(key(o)));
      rows.push({
        building: b.id, town: plan.id, enterable: !!b.enterable,
        drawn_shellwall_slabs: drawn.length, collision_slabs: solidsLocal.length,
        collision_slabs_with_no_identical_drawn_slab: solidOnly.map((o) => o.id),
        drawn_slabs_with_no_identical_collision_slab: drawnOnly.length,
        // The measure that matters: does the drawn wall cover ground the collision wall does not,
        // or vice versa? Reported as the worst half-extent difference on the matching slab.
        worst_mismatch_m: (() => {
          let worst = 0;
          for (const o of solidsLocal) {
            let best = Infinity, bd = null;
            for (const dd of drawn) { const e = Math.hypot(o.c[0] - dd.c[0], o.c[1] - dd.c[1]); if (e < best) { best = e; bd = dd; } }
            if (!bd) continue;
            worst = Math.max(worst, best, Math.abs(o.h[0] - bd.h[0]), Math.abs(o.h[1] - bd.h[1]));
          }
          return +worst.toFixed(4);
        })(),
      });
    }
  }
  B.buildings = rows.length;
  B.buildings_where_drawn_and_collision_walls_are_byte_identical = rows.filter((r) => !r.collision_slabs_with_no_identical_drawn_slab.length && !r.drawn_slabs_with_no_identical_collision_slab).length;
  B.buildings_that_differ = rows.filter((r) => r.collision_slabs_with_no_identical_drawn_slab.length || r.drawn_slabs_with_no_identical_collision_slab).length;
  B.worst_mismatch_m = rows.length ? +Math.max(...rows.map((r) => r.worst_mismatch_m)).toFixed(4) : null;
  B.differing = rows.filter((r) => r.worst_mismatch_m > 0.001).map((r) => ({ building: r.building, worst_mismatch_m: r.worst_mismatch_m, drawn: r.drawn_shellwall_slabs, collision: r.collision_slabs }));
  if (!rows.length) out.probe_failures.push('B: no building produced any drawn shellwall mesh');
  if (B.buildings_that_differ) out.findings.push(`B: the drawn wall and the collision wall differ on ${B.buildings_that_differ} building(s), worst ${B.worst_mismatch_m} m`);
  out.B = B;
}

/* ================================ H — the three holes =========================================
 * "Both ends of the door move together and N2 holds by construction." Three apertures exist:
 * the hole in the DRAWN exterior wall, the hole in the COLLISION wall, and the hole in the
 * INTERIOR room shell. RI-WLD13 N4: *each exterior aperture has an interior counterpart within
 * 0.50 m in world space*, and it says in terms that it applies to doors.
 * ==============================================================================================*/
{
  const H = { what: 'the drawn doorway, the collision doorway, the interior doorway and the interior spawn' };
  const rows = [];
  for (const plan of SHIPPED.plans) {
    for (const b of plan.buildings) {
      if (!b.enterable || !b.interior) continue;
      const rec = SHIPPED.I[b.interior];
      if (!rec) continue;
      const w = b.drawn_footprint_m ? b.drawn_footprint_m[0] : b.footprint_m[0];
      const d = b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1];
      const u = EX.doorAlongLocal(b);
      const side = (rec.continuity && rec.continuity.entry_side) || null;
      const declaredSide = rec.continuity && rec.continuity.entry_side_declared;
      // The drawn wall uses minLen 0.4; the collision wall uses minLen 0.3. Same `u`, same span —
      // different floor on a sliver segment, so the two holes are not the same width.
      const localSide = (() => {
        // mirror of entrySideLocal via the exported normal
        const n = EX.entryOutwardWorld(b);
        const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(-yaw), s = Math.sin(-yaw);
        const lx = n[0] * c + n[1] * s, lz = -n[0] * s + n[1] * c;
        return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? '+x' : '-x') : (lz > 0 ? '+z' : '-z');
      })();
      const span = (localSide === '+x' || localSide === '-x') ? d : w;
      const dr = EX.doorwaySegments(span, u, 0.4);
      const co = EX.doorwaySegments(span, u, 0.3);
      // hole = the gap between the inner faces of the two segments
      const holeOf = (segs) => [segs[0].c + segs[0].len / 2, segs[1].c - segs[1].len / 2];
      const hd = holeOf(dr), hc = holeOf(co);
      // The interior doorway is ALWAYS at the middle of its wall (render/interior.js addWall).
      const bounds = rec.bounds_m;
      const interiorSpawn = rec.continuity && rec.continuity.interior_spawn;
      let spawnToDoorwayWall = null, spawnAlong = null;
      if (bounds && interiorSpawn) {
        const bxm = (bounds.x[0] + bounds.x[1]) / 2, bzm = (bounds.z[0] + bounds.z[1]) / 2;
        const at = side === 'north' ? [bxm, bounds.z[0]] : side === 'south' ? [bxm, bounds.z[1]] : side === 'west' ? [bounds.x[0], bzm] : [bounds.x[1], bzm];
        spawnToDoorwayWall = +Math.hypot(interiorSpawn[0] - at[0], interiorSpawn[2] - at[1]).toFixed(3);
        spawnAlong = (side === 'north' || side === 'south') ? +(interiorSpawn[0] - at[0]).toFixed(3) : +(interiorSpawn[2] - at[1]).toFixed(3);
      }
      rows.push({
        town: plan.id, building: b.id, interior: b.interior,
        entry_side: side, entry_side_declared: declaredSide === undefined ? null : declaredSide,
        rotated: declaredSide !== undefined && declaredSide !== null && side !== declaredSide,
        door_along_m: +u.toFixed(3),
        drawn_hole: [+hd[0].toFixed(3), +hd[1].toFixed(3)],
        collision_hole: [+hc[0].toFixed(3), +hc[1].toFixed(3)],
        hole_mismatch_m: +Math.max(Math.abs(hd[0] - hc[0]), Math.abs(hd[1] - hc[1])).toFixed(4),
        interior_doorway_along_m: 0,
        exterior_to_interior_aperture_offset_m: +Math.abs(u).toFixed(3),
        interior_spawn_distance_to_its_own_doorway_wall_m: spawnToDoorwayWall,
        interior_spawn_offset_along_that_wall_m: spawnAlong,
      });
    }
  }
  H.doors = rows.length;
  H.drawn_and_collision_hole_identical = rows.filter((r) => r.hole_mismatch_m < 1e-6).length;
  H.drawn_and_collision_hole_differ = rows.filter((r) => r.hole_mismatch_m >= 1e-6);
  H.doors_slid_along_the_wall = rows.filter((r) => Math.abs(r.door_along_m) > 1e-9).length;
  H.doors_rotated = rows.filter((r) => r.rotated).length;
  H.N4_exterior_aperture_more_than_0_50m_from_its_interior_counterpart = rows.filter((r) => r.exterior_to_interior_aperture_offset_m > 0.5);
  H.worst_aperture_offset_m = rows.length ? +Math.max(...rows.map((r) => r.exterior_to_interior_aperture_offset_m)).toFixed(3) : null;
  H.rotated_rows = rows.filter((r) => r.rotated);
  H.slid_rows = rows.filter((r) => Math.abs(r.door_along_m) > 1e-9);
  H.rows = rows;
  if (H.drawn_and_collision_hole_differ.length) out.findings.push(`H: the drawn doorway and the collision doorway differ on ${H.drawn_and_collision_hole_differ.length} door(s)`);
  if (H.N4_exterior_aperture_more_than_0_50m_from_its_interior_counterpart.length) out.findings.push(`H: RI-WLD13 N4 — ${H.N4_exterior_aperture_more_than_0_50m_from_its_interior_counterpart.length} exterior doorways are more than 0.50 m from their interior counterpart`);
  out.H = H;
}

/* ================================ O — the ordering dependency =================================
 * "All doors in a town move before any doorstep is derived, and the doorstep must have its own
 * door nearest." That is a rule about a whole table. What happens if a settlement gains a
 * building? Three perturbations, each a fresh world from the raw JSON.
 * ==============================================================================================*/
{
  const O = { what: 'the derivation is a function of the whole door table. Perturb the table.' };
  const baseline = new Map();
  for (const plan of SHIPPED.plans) for (const b of plan.buildings) if (b.interior) {
    const rec = SHIPPED.I[b.interior];
    baseline.set(b.interior, { spawn: rec.continuity.exterior_spawn.slice(), door: b.door.slice(), side: b.entry_side, u: b.door_along_m || 0 });
  }
  const classify = (W) => {
    // Reimplement `doorAt()` over the FINAL table, as the sim sees it.
    const res = new Map();
    for (const plan of W.plans) {
      const doc = Object.values(W.S).find((s) => s.id === plan.id);
      const rowsD = ((doc && doc.buildings) || []).filter((r) => r && r.kind === 'interior' && r.door);
      for (const b of plan.buildings) {
        if (!b.interior) continue;
        const rec = W.I[b.interior];
        const sp = rec && rec.continuity && rec.continuity.exterior_spawn;
        if (!sp) { res.set(b.interior, 'no-spawn'); continue; }
        let best = null, bd = Infinity;
        for (const r of rowsD) { const dd = Math.hypot(r.door[0] - sp[0], r.door[2] - sp[2]); if (dd <= SETT.DOOR_REACH_M && dd < bd) { bd = dd; best = r; } }
        const mine = rowsD.find((r) => r.id === b.id);
        res.set(b.interior, !best ? 'none' : best === mine ? 'own' : `other:${best.interior || best.id}`);
      }
    }
    return res;
  };
  const shippedClass = classify(SHIPPED);
  const arms = [];
  // (1) a settlement GAINS a building — a new interior in an existing town, placed next to an
  //     existing one, which is what a content author does between rounds.
  for (const town of ['blackrose', 'helstrom']) {
    const W = world({
      mutate: (S, I) => {
        const doc = S[town];
        const donor = doc.buildings.find((r) => r.kind === 'interior' && r.door);
        if (!donor) return;
        const nb = clone(donor);
        nb.id = `${donor.id}-critic-new`;
        nb.interior = `${donor.interior}-critic-new`;
        nb.name = `${nb.name || nb.id} (critic)`;
        if (nb.offset_m) { nb.offset_m = [nb.offset_m[0] + 3, nb.offset_m[1] || 0, nb.offset_m[2] + 3]; }
        if (nb.door) { nb.door = [nb.door[0] + 3, nb.door[1], nb.door[2] + 3]; }
        doc.buildings.push(nb);
        const ni = clone(I[donor.interior]);
        ni.id = nb.interior;
        if (ni.continuity && ni.continuity.building) ni.continuity.building = nb.id;
        if (ni.continuity && Array.isArray(ni.continuity.exterior_spawn)) { ni.continuity.exterior_spawn = [ni.continuity.exterior_spawn[0] + 3, ni.continuity.exterior_spawn[1], ni.continuity.exterior_spawn[2] + 3]; }
        I[ni.id] = ni;
      },
    });
    const cls = classify(W);
    const changed = [], regressed = [];
    for (const [id, was] of baseline) {
      const rec = W.I[id];
      if (!rec) continue;
      const now = rec.continuity.exterior_spawn;
      const moved = Math.hypot(now[0] - was.spawn[0], now[2] - was.spawn[2]);
      if (moved > 0.001) changed.push({ interior: id, moved_m: +moved.toFixed(3) });
      const c0 = shippedClass.get(id), c1 = cls.get(id);
      if (c0 === 'own' && c1 !== 'own') regressed.push({ interior: id, was: c0, now: c1 });
    }
    arms.push({
      arm: `${town} gains one building`,
      pre_existing_doorsteps_that_moved: changed.length,
      worst_move_m: changed.length ? +Math.max(...changed.map((c) => c.moved_m)).toFixed(3) : 0,
      pre_existing_doors_that_went_from_own_to_not_own: regressed.length,
      regressed,
      own_before: [...shippedClass.values()].filter((v) => v === 'own').length,
      own_after_excluding_the_new_one: [...cls.entries()].filter(([id, v]) => v === 'own' && baseline.has(id)).length,
    });
  }
  // (2) the derivation run TWICE on one world (idempotence), and (3) the settlement documents
  //     presented in the opposite order — the join takes `Object.values(S)`, so order is a real
  //     input.
  {
    const W = world({});
    const before = new Map();
    for (const plan of W.plans) for (const b of plan.buildings) if (b.interior) before.set(b.interior, W.I[b.interior].continuity.exterior_spawn.slice());
    EX.applyInteriorBounds(W.plans, W.I, Object.values(W.S), {});
    let diff = 0;
    for (const [id, sp] of before) { const now = W.I[id].continuity.exterior_spawn; if (Math.hypot(now[0] - sp[0], now[2] - sp[2]) > 1e-6) diff++; }
    arms.push({ arm: 'applyInteriorBounds() run a second time on the same objects', doorsteps_that_moved: diff });
  }
  {
    const S = clone(RAW_S), I = clone(RAW_I);
    const plans = Object.keys(S).sort().reverse().map((id) => EX.planSettlement(S[id], I));
    EX.applyInteriorBounds(plans, I, Object.values(S).reverse(), {});
    let diff = 0, worst = 0;
    for (const [id, was] of baseline) {
      const rec = I[id]; if (!rec) continue;
      const now = rec.continuity.exterior_spawn;
      const m = Math.hypot(now[0] - was.spawn[0], now[2] - was.spawn[2]);
      if (m > 1e-6) { diff++; worst = Math.max(worst, m); }
    }
    arms.push({ arm: 'the eight settlement documents presented in reverse order', doorsteps_that_differ: diff, worst_m: +worst.toFixed(3) });
  }
  O.arms = arms;
  for (const a of arms) if (a.pre_existing_doors_that_went_from_own_to_not_own) out.findings.push(`O: ${a.arm} — ${a.pre_existing_doors_that_went_from_own_to_not_own} pre-existing door(s) stopped opening their own room`);
  out.O = O;
}

/* ================================ R — re-entry, and the three ================================= */
{
  const R = { what: 'press interact on the doorstep, offline, by reimplementing doorAt() over the FINAL table' };
  const rows = [];
  const orphanIds = new Set(SHIPPED.join.orphan_ids || []);
  const claimed = new Set();
  for (const plan of SHIPPED.plans) for (const b of plan.buildings) if (b.interior) claimed.add(b.interior);
  for (const id of Object.keys(SHIPPED.I).sort()) {
    const rec = SHIPPED.I[id];
    const sp = rec.continuity && rec.continuity.exterior_spawn;
    const plan = SHIPPED.planById.get(rec.settlement);
    const doc = Object.values(SHIPPED.S).find((s) => s.id === rec.settlement);
    const rowsD = ((doc && doc.buildings) || []).filter((r) => r && r.kind === 'interior' && r.door);
    let best = null, bd = Infinity;
    if (sp) for (const r of rowsD) { const dd = Math.hypot(r.door[0] - sp[0], r.door[2] - sp[2]); if (dd <= SETT.DOOR_REACH_M && dd < bd) { bd = dd; best = r; } }
    const mine = rowsD.find((r) => r.interior === id);
    const shapes = plan ? EX.settlementSolids(plan, plan.pos[0], plan.pos[2], 1e9, null) : [];
    rows.push({
      interior: id, settlement: rec.settlement || null,
      orphan: !claimed.has(id), in_join_orphan_list: orphanIds.has(id),
      has_spawn: !!sp,
      opens: !best ? null : (best.interior || best.id),
      own: !!(best && mine && best === mine),
      dist_m: best ? +bd.toFixed(3) : null,
      inside_a_footprint: plan && sp ? EX.insideBuilding(plan, sp[0], sp[2], 0) : null,
      clearance_m: plan && sp ? +EX.horizontalClearance(shapes, sp[0], sp[2]).toFixed(3) : null,
    });
  }
  R.records = rows.length;
  R.back_in_the_room_you_left = rows.filter((r) => r.own).length;
  R.opens_a_different_building = rows.filter((r) => !r.own && r.opens);
  R.opens_nothing = rows.filter((r) => !r.own && !r.opens);
  R.failures = rows.filter((r) => !r.own).map((r) => ({ interior: r.interior, settlement: r.settlement, orphan: r.orphan, opens: r.opens, dist_m: r.dist_m }));
  R.orphans = rows.filter((r) => r.orphan).map((r) => ({ interior: r.interior, settlement: r.settlement, own: r.own, opens: r.opens }));
  R.the_three_are_the_orphans = R.failures.length === R.orphans.length && R.failures.every((f) => f.orphan);
  R.doorsteps_inside_a_footprint = rows.filter((r) => r.inside_a_footprint).length;
  R.doorsteps_with_clearance_below_body_radius = rows.filter((r) => r.clearance_m !== null && r.clearance_m < EX.BODY_RADIUS_M).map((r) => ({ interior: r.interior, clearance_m: r.clearance_m }));
  out.R = R;
}

/* ================================ P — the props =============================================== */
{
  const P = { what: 'OVERHANG vs CLEARANCE, both measured, and what RI-WLD13 actually asks' };
  const measure = (propInset) => {
    const W = world({});
    const over = [], clear = [];
    for (const id of Object.keys(W.I).sort()) {
      const rec = W.I[id];
      let s;
      try { s = IN.buildInterior(new THREE.Group(), rec, { propInset }); } catch (e) { out.probe_failures.push(`P: buildInterior(${id}) threw ${e.message}`); continue; }
      void s;
      const root = new THREE.Group();
      IN.buildInterior(root, rec, { propInset });
      const bounds = rec.bounds_m;
      if (!bounds) continue;
      const bx = bounds.x, bz = bounds.z;
      root.updateMatrixWorld(true);
      root.traverse((m) => {
        if (!m.geometry || m.name === 'roomshell') return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const box = new THREE.Box3().setFromObject(m);
        if (!Number.isFinite(box.min.x)) return;
        const ox = Math.max(bx[0] - box.min.x, box.max.x - bx[1]);
        const oz = Math.max(bz[0] - box.min.z, box.max.z - bz[1]);
        const o = Math.max(ox, oz);
        const dx = Math.max(bx[0] - box.max.x, box.min.x - bx[1], 0);
        const dz = Math.max(bz[0] - box.max.z, box.min.z - bz[1], 0);
        const c = Math.hypot(dx, dz);
        if (o > 0.6) over.push({ room: id, mesh: m.name, overhang_m: +o.toFixed(3) });
        if (c > 0.6) clear.push({ room: id, mesh: m.name, clearance_m: +c.toFixed(3) });
      });
    }
    return { overhang: over, clearance: clear };
  };
  const shipped = measure(true);
  const cut = measure(false);
  P.shipped = { overhang_meshes: shipped.overhang.length, overhang_rooms: new Set(shipped.overhang.map((r) => r.room)).size, clearance_meshes: shipped.clearance.length, worst_overhang_m: shipped.overhang.length ? Math.max(...shipped.overhang.map((r) => r.overhang_m)) : 0 };
  P.prop_inset_cut = { overhang_meshes: cut.overhang.length, overhang_rooms: new Set(cut.overhang.map((r) => r.room)).size, clearance_meshes: cut.clearance.length, worst_overhang_m: cut.overhang.length ? Math.max(...cut.overhang.map((r) => r.overhang_m)) : 0 };
  const byMesh = {};
  for (const r of cut.overhang) byMesh[r.mesh] = (byMesh[r.mesh] || 0) + 1;
  P.prop_inset_cut.by_mesh = byMesh;
  P.shipped_examples = shipped.overhang.slice(0, 10);
  if (shipped.overhang.length) out.findings.push(`P: ${shipped.overhang.length} meshes still overhang by more than 0.6 m on the shipped tree`);
  out.P = P;
}

/* ================================ self-break ================================================== */
if (SELF_BREAK) {
  // Break the geometry the predictions are about: every slab a sliver. Section A's law must fail.
  const plan = SHIPPED.planById.get('helstrom');
  const base = EX.settlementSolids(plan, plan.pos[0], plan.pos[2], 1e9, null);
  const shapes = scaleSlabs(base, 0.01);
  const cell = new COL.CollisionCell('broken', shapes, {});
  let wrong = 0, n = 0;
  for (const b of plan.buildings) {
    const d = b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1];
    const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    const lz = -d / 2;
    const wx = b.x + lz * s, wz = b.z + lz * c;
    const p = restPoint(cell, wx, wz, 0.32, 12);
    const along = Math.abs((p[0] - wx) * (0 * c + -1 * s) + (p[2] - wz) * (-0 * s + -1 * c));
    n++;
    if (Math.abs(along - (EX.SHELL_WALL_T / 2 + 0.32)) > 0.01) wrong++;
  }
  out.self_break_result = { walls_tested: n, off_the_unbroken_prediction: wrong };
  if (!wrong) { console.error('SELF-BREAK DID NOT GO RED — the prediction survived slivered walls; this probe cannot fail'); process.exit(1); }
  console.error(`self-break: ${wrong}/${n} walls off the prediction with slivered slabs — the probe can fail`);
}

const dest = argOf('--json', path.join(ROOT, 'reports/critic-w1-04-r6/offline.json'));
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`-> ${path.relative(ROOT, dest)}`);
console.log(`A  prediction: ${out.A.prediction.clean_cases} clean cases, ${out.A.prediction.cases_off_the_prediction_by_more_than_0_01m} off the law, worst ${out.A.prediction.worst_error_m} m`);
console.log(`A  slab half-thicknesses ${JSON.stringify(out.A.slab_half_thicknesses)}, reach outside footprint ${JSON.stringify(out.A.reaches_outside_footprint_m)}`);
console.log(`B  drawn vs collision walls: ${out.B.buildings_where_drawn_and_collision_walls_are_byte_identical}/${out.B.buildings} identical, ${out.B.buildings_that_differ} differ (worst ${out.B.worst_mismatch_m} m)`);
console.log(`H  ${out.H.doors} doors; drawn hole == collision hole on ${out.H.drawn_and_collision_hole_identical}; slid ${out.H.doors_slid_along_the_wall}; rotated ${out.H.doors_rotated}; N4 breaches ${out.H.N4_exterior_aperture_more_than_0_50m_from_its_interior_counterpart.length} (worst ${out.H.worst_aperture_offset_m} m)`);
console.log(`R  ${out.R.back_in_the_room_you_left}/${out.R.records} back into the room you left; failures ${JSON.stringify(out.R.failures.map((f) => f.interior))}`);
console.log(`P  shipped overhang ${out.P.shipped.overhang_meshes}, inset cut ${out.P.prop_inset_cut.overhang_meshes}`);
for (const f of out.probe_failures) console.error(`PROBE FAILURE: ${f}`);
for (const f of out.findings) console.error(`FINDING: ${f}`);
if (out.probe_failures.length) process.exit(2);
