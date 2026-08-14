#!/usr/bin/env node
// door-yaw-offline.mjs — the whole 115-interior population, both directions, without a browser.
//
// WHY AN OFFLINE ARM EXISTS AT ALL. The in-game sweep (`tools/harness/door-yaw-sweep.mjs`) is the
// authority — it drives the real `useDoor()`/`leaveInterior()` verbs in the running engine and it
// is what any claim about the shipped game must rest on. It also costs a browser and ~20-30 s per
// interior on a box whose contention gate reads WAIT for hours at a time, which is exactly why the
// previous attempt at this sweep reached 8 of 115 rows and the one before it reached 0.
//
// So this tool measures the SAME GEOMETRY through the SAME MODULES, in Node, in seconds:
//
//   game/src/render/exterior.js  planSettlement() / settlementSolids()   the town's wall slabs
//   game/src/render/interior.js  interiorCollisionShapes()               the room's shell
//   game/src/sim/collision.js    CollisionCell.contains()                the containment test
//   game/src/sim/settlement.js   exitFacing() / entryFacing()            THE SHIPPED RULE ITSELF
//
// Nothing here re-implements a facing rule or a containment test. The one thing it does restate is
// `Province._meshY()` (province.js:768) — twelve lines of bilinear sampling of `WorldField` — and
// it is restated rather than imported because `world/province.js` pulls in THREE, the renderer's
// visual foundation and a live GPU context. That restatement is the tool's one soft joint, so it
// is NOT taken on trust: `--validate <in-game sweep json>` compares this tool's clearance against
// the browser's, row by row, on every interior both have measured, and prints the disagreement.
// An offline number that has not been validated against the running game is a hypothesis.
//
// THE BEFORE ARM IS A DISTRIBUTION, NOT A DRAW. Before the fix, a door wrote position and never
// orientation, so what you faced afterwards was whatever you faced before — and that is not one
// number. Worse, it is not even a number correlated with the world: inside a room the yaw is a
// LOCAL yaw in the room's own frame, and carrying it through the door reinterprets it as a WORLD
// yaw, so the prior facing arrives at the doorstep effectively arbitrary. A single seeded prior
// (the in-game sweep uses 200 deg, for comparability) measures one draw from that. Offline the
// whole distribution is free, so the baseline is reported as: over all 36 ten-degree prior yaws,
// what fraction of (interior x prior yaw) pairs fail, and how many interiors fail for at least
// one prior. That is the honest shape of "the old behaviour".
//
// THE DEFINITION is `tools/harness/door-yaw-sweep.mjs`'s, unchanged and deliberately duplicated
// nowhere: clearance_m to the first solid at eye height, 0.25 m march, 12 m cap; occluded_frac =
// the share of 21 rays across the forward 60 deg blocked closer than 3 m; PASS = clearance >= 3 m
// AND occluded <= 0.34.
//
// USAGE
//   node tools/world/door-yaw-offline.mjs [--json <path>] [--validate <sweep json>] [--only a,b]
//        [--reach 12] [--near 3] [--min-clear 3] [--max-occl 0.34] [--seed-yaw 200]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { planSettlement, settlementSolids, insideBuilding, applyInteriorBounds } from '../../game/src/render/exterior.js';
import { interiorCollisionShapes } from '../../game/src/render/interior.js';
import { CollisionCell } from '../../game/src/sim/collision.js';
import { exitFacing, entryFacing } from '../../game/src/sim/settlement.js';
import { WorldField } from '../../game/src/world/field.js';

const USAGE = `
door-yaw-offline.mjs — all 115 interiors, both directions, offline, through the game's own modules.

USAGE
  node tools/world/door-yaw-offline.mjs [--json <path>] [--validate <in-game sweep json>]
       [--only a,b] [--reach 12] [--near 3] [--min-clear 3] [--max-occl 0.34] [--seed-yaw 200]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const REACH = Number(args.reach || 12);
const NEAR = Number(args.near || 3);
const MIN_CLEAR = Number(args['min-clear'] || 3);
const MAX_OCCL = Number(args['max-occl'] || 0.34);
const SEED_YAW = args['seed-yaw'] === undefined ? 200 : Number(args['seed-yaw']);
const say = (s) => process.stdout.write(s + '\n');

const DATA = path.join(REPO_ROOT, 'game/data');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readDir = (rel) => {
  const dir = path.join(DATA, rel);
  const out = {};
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) out[f.replace(/\.json$/, '')] = readJson(path.join(dir, f));
  return out;
};

// ---- the ground, restated from Province._meshY (province.js:768) -------------------------------
// TILE_M / TILE_SEG are province.js:22 and :29. `onDeckAt` chooses the bare height on a built deck,
// exactly as the drawn mesh does; the building slabs are based on this, so getting it wrong lifts
// or sinks a wall relative to the eye. See the module header on why it is restated.
const TILE_M = 300, TILE_SEG = 44;
function makeMeshY(field) {
  const G = TILE_M / TILE_SEG;
  const cache = new Map();
  const at = (i, j) => {
    const k = i * 1000003 + j;
    let v = cache.get(k);
    if (v === undefined) {
      const px = i * G, pz = j * G;
      v = field.onDeckAt(px, pz) ? field.bareHeightAt(px, pz) : field.heightAt(px, pz);
      cache.set(k, v);
    }
    return v;
  };
  return (x, z) => {
    const i = Math.floor(x / G), j = Math.floor(z / G);
    const tx = x / G - i, tz = z / G - j;
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return a + (b - a) * tz;
  };
}

// ---- the definition ---------------------------------------------------------------------------
const d2r = Math.PI / 180;
const norm = (a) => ((a % 360) + 360) % 360;
const fwd = (yaw) => [Math.sin(yaw * d2r), Math.cos(yaw * d2r)];

function clearance(cell, x, z, yaw, eye) {
  const f = fwd(yaw);
  for (let d = 0.25; d <= REACH + 1e-9; d += 0.25) {
    if (cell.contains(x + f[0] * d, eye, z + f[1] * d)) return +(d - 0.25).toFixed(2);
  }
  return REACH;
}
function occluded(cell, x, z, yaw, eye) {
  let blocked = 0, n = 0;
  for (let a = -30; a <= 30 + 1e-9; a += 3) { n++; if (clearance(cell, x, z, yaw + a, eye) < NEAR) blocked++; }
  return +(blocked / n).toFixed(4);
}
const passes = (c, o) => c >= MIN_CLEAR && o <= MAX_OCCL;

/* ---- AND THE ROOM BEHIND YOU, WHICH IS A DIFFERENT DEFECT ------------------------------------
 *
 * The owner's complaint was "facing a building's wall", and turning the body fixes that. It does
 * NOT fix the other half the predecessor's report named and did not own: at the writ house
 * doorstep the third-person arm is collapsed against the wall behind the player, so the camera
 * sits AT the body and the player character is not in the frame at all.
 *
 * That is a property of what is BEHIND the facing, not in front of it, and it is measured here as
 * a proxy for `Engine.castCameraArm()`: a straight ray backwards from the camera pivot height.
 * The real cast is a sphere of radius `cast_radius_m` with a shoulder offset, so this is an
 * OPTIMISTIC proxy — it can only under-report the collapse — and it is labelled a proxy
 * everywhere it appears. `arm_free_m` (4.10 m) is the length the arm wants; below `fade_start_m`
 * (1.30 m) the character model starts to fade out of its own picture. Both from
 * `game/src/sim/camera.js#CAMERA_CONST`.
 */
const CAM_PIVOT_H_M = 1.55, CAM_ARM_FREE_M = 4.10, CAM_FADE_START_M = 1.30;
/** Does the side pass AFTER the engine's refinement? Unrefined rows fall back to the proposal. */
const passesRefined = (side) => {
  const rp = side.refined_predicted;
  if (!rp) return side.fixed ? side.fixed.pass : false;
  return !!rp.pass;
};

/** Every ten-degree bearing scored once — the ceiling, the floor, and the whole prior-yaw sweep. */
function scan(cell, x, z, eye) {
  const rows = [];
  for (let a = 0; a < 360; a += 10) {
    const c = clearance(cell, x, z, a, eye);
    const o = occluded(cell, x, z, a, eye);
    rows.push({ yaw_deg: a, clearance_m: c, occluded_frac: o, pass: passes(c, o) });
  }
  const cs = rows.map((r) => r.clearance_m);
  return {
    rows,
    best_clearance_m: Math.max(...cs),
    worst_clearance_m: Math.min(...cs),
    best_yaw_deg: rows[cs.indexOf(Math.max(...cs))].yaw_deg,
    passing_bearings: rows.filter((r) => r.pass).length,
    point_can_pass: rows.some((r) => r.pass),
    // RULES.md rule 4: a probe that cannot fail is worse than no probe. If even the WORST of 36
    // bearings runs to the cap, this point saw no geometry and its PASS is not a measurement.
    no_geometry_visible: Math.min(...cs) >= REACH,
  };
}

/**
 * What `Engine._refineFacing()` will do to this proposal — PREDICTED, not observed.
 *
 * The engine keeps a proposal that passes, otherwise takes the nearest of the 36 ten-degree
 * bearings that passes, otherwise keeps the proposal. Its predicate is identical to this file's
 * despite marching only to 3 m: `pass` asks `clearance >= 3` and `occluded` counts rays under
 * 3 m, and neither question can be answered differently by a march that continues past 3 m.
 *
 * It is still a PREDICTION of another module's behaviour, so it is labelled as one and it is
 * checked against the running engine by `tools/harness/door-yaw-sweep.mjs`. An offline forecast
 * that has never been confronted with the engine is a hypothesis, not a result.
 */
function predictRefine(sc, proposedYaw, scoreExact, rearAt) {
  if (!Number.isFinite(proposedYaw)) return null;
  // THE PROPOSAL IS SCORED AT ITS OWN ANGLE, not at the nearest ten-degree bearing. The first
  // version of this function snapped it, and `helstrom-house-2` — proposal 341.0 deg, failing on
  // occlusion at 0.381, with 340 deg passing one degree away — came back "proposal_clear" and was
  // reported as an unfixable row. A predictor that rounds its own input is measuring a different
  // door from the one the engine places the body at.
  const p = scoreExact(proposedYaw);
  const rear = rearAt ? rearAt(proposedYaw) : CAM_ARM_FREE_M;
  // Mirrors Engine._refineFacing() exactly, INCLUDING its ruling that a facing which clears ahead
  // is kept even when the camera is boxed in behind it. See that function's comment for why, and
  // for the numbers both ways.
  if (p.pass) {
    return { yaw_deg: +proposedYaw.toFixed(1), refined: false, reason: 'proposal_clear',
      clearance_m: p.clearance_m, occluded_frac: p.occluded_frac, rear_m: rear, pass: true,
      camera_ok: rear >= CAM_ARM_FREE_M, player_visible: rear >= CAM_FADE_START_M };
  }
  let best = null;
  for (const r of sc.rows) {
    if (!r.pass) continue;
    const rr = rearAt ? rearAt(r.yaw_deg) : CAM_ARM_FREE_M;
    const dev = Math.abs(((r.yaw_deg - proposedYaw + 540) % 360) - 180);
    const key = [rr < CAM_FADE_START_M ? 1 : 0, rr < CAM_ARM_FREE_M ? 1 : 0, dev];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])
      || (key[0] === best.key[0] && key[1] === best.key[1] && key[2] < best.key[2])) {
      best = { r, dev, rear_m: rr, key };
    }
  }
  if (!best) {
    return { yaw_deg: +proposedYaw.toFixed(1), refined: false, reason: 'no_bearing_passes',
      clearance_m: p.clearance_m, occluded_frac: p.occluded_frac, rear_m: rear, pass: false, camera_ok: rear >= CAM_ARM_FREE_M };
  }
  return { yaw_deg: best.r.yaw_deg, refined: true, reason: 'nearest_clear_bearing',
    turned_deg: +best.dev.toFixed(1), clearance_m: best.r.clearance_m, occluded_frac: best.r.occluded_frac,
    rear_m: best.rear_m, rear_was_m: rear, pass: true, camera_ok: best.rear_m >= CAM_ARM_FREE_M,
    player_visible: best.rear_m >= CAM_FADE_START_M };
}

const main = () => {
  const settlements = readDir('world/settlements');
  const interiors = readDir('world/interiors');
  const field = new WorldField(readJson(path.join(DATA, 'world/terrain.json')),
    readJson(path.join(DATA, 'world/regions.json')), readJson(path.join(DATA, 'world/water.json')));
  const meshY = makeMeshY(field);

  const docs = Object.values(settlements);
  const plans = docs.map((d) => planSettlement(d, interiors));
  applyInteriorBounds(plans, interiors, docs);
  const planFor = new Map(plans.map((p) => [p.id, p]));

  const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
  const ids = Object.keys(interiors).filter((i) => !only || only.includes(i)).sort();

  const out = {
    schema: 'elder-souls/door-yaw-offline@1',
    generated_at: new Date().toISOString(),
    commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { return null; } })(),
    population: Object.keys(interiors).length,
    definition: {
      clearance_m: `first solid at eye height (ground + 1.6), 0.25 m march, ${REACH} m cap, CollisionCell.contains()`,
      occluded_frac: `share of 21 rays across the forward 60 deg blocked closer than ${NEAR} m`,
      pass: `clearance_m >= ${MIN_CLEAR} AND occluded_frac <= ${MAX_OCCL}`,
      before_arm: 'the prior yaw survives the placement — swept over all 36 ten-degree priors, and separately at the seeded prior for comparability with the in-game run',
      seed_yaw_deg: SEED_YAW,
    },
    rows: [],
  };

  for (const id of ids) {
    const rec = interiors[id];
    const cont = rec.continuity || {};
    const plan = planFor.get(rec.settlement);
    const row = { id, settlement: rec.settlement, entry_side: cont.entry_side,
      declared_bearing_deg: Number(rec.door_world_bearing_deg) };

    // ---- OUT: the doorstep, in world coordinates, against the town's own wall slabs -----------
    const out3 = cont.exterior_spawn || rec.exterior_door;
    if (!plan) row.exit = { skipped: `no settlement plan for ${rec.settlement}` };
    else if (!Array.isArray(out3)) row.exit = { skipped: 'no exterior spawn' };
    else {
      const gy = meshY(out3[0], out3[2]);
      const eye = gy + 1.6;
      const solids = settlementSolids(plan, out3[0], out3[2], 45, (bx, bz) => meshY(bx, bz));
      const cell = new CollisionCell(`settlement:${plan.id}`, solids, { class: 'exterior' });
      const face = exitFacing(rec);
      const sc = scan(cell, out3[0], out3[2], eye);
      const exact = (yaw) => { const c = clearance(cell, out3[0], out3[2], yaw, eye), o = occluded(cell, out3[0], out3[2], yaw, eye); return { clearance_m: c, occluded_frac: o, pass: passes(c, o) }; };
      const rearAt = (yaw) => Math.min(CAM_ARM_FREE_M, clearance(cell, out3[0], out3[2], yaw + 180, gy + CAM_PIVOT_H_M));
      const fixC = face ? clearance(cell, out3[0], out3[2], face.yaw_deg, eye) : null;
      const fixO = face ? occluded(cell, out3[0], out3[2], face.yaw_deg, eye) : null;
      const seedC = clearance(cell, out3[0], out3[2], SEED_YAW, eye);
      const seedO = occluded(cell, out3[0], out3[2], SEED_YAW, eye);
      row.exit = {
        pos: [out3[0], +gy.toFixed(2), out3[2]], shapes: solids.length,
        fixed: face ? { yaw_deg: +face.yaw_deg.toFixed(1), source: face.source, clearance_m: fixC, occluded_frac: fixO, pass: passes(fixC, fixO) } : null,
        seeded_prior: { yaw_deg: SEED_YAW, clearance_m: seedC, occluded_frac: seedO, pass: passes(seedC, seedO) },
        any_prior: { passing_of_36: sc.passing_bearings, failing_of_36: 36 - sc.passing_bearings },
        best_clearance_m: sc.best_clearance_m, best_yaw_deg: sc.best_yaw_deg,
        worst_clearance_m: sc.worst_clearance_m,
        point_can_pass: sc.point_can_pass, no_geometry_visible: sc.no_geometry_visible,
        inside_a_building: !!insideBuilding(plan, out3[0], out3[2]),
        camera_arm_proxy: (() => {
          const behind = (yaw) => clearance(cell, out3[0], out3[2], yaw + 180, gy + CAM_PIVOT_H_M);
          const shipped = face ? behind(face.yaw_deg) : null;
          const rp = face ? predictRefine(sc, face.yaw_deg, exact, rearAt) : null;
          const refined = rp ? behind(rp.yaw_deg) : null;
          // The best any facing could do for the camera, ignoring what is in front — the ceiling,
          // so a bad rule can be told from a doorstep with a wall on every side.
          let bestBehind = -1, bestYaw = null;
          for (let a = 0; a < 360; a += 10) { const b = behind(a); if (b > bestBehind) { bestBehind = b; bestYaw = a; } }
          return {
            proxy: 'straight ray back from pivot height 1.55 m; the real cast is a 0.28 m sphere with a shoulder offset, so this UNDER-reports collapse',
            shipped_rear_m: shipped, refined_rear_m: refined,
            best_rear_m: bestBehind, best_rear_yaw_deg: bestYaw,
            arm_wants_m: CAM_ARM_FREE_M, fade_below_m: CAM_FADE_START_M,
            shipped_arm_collapsed: shipped !== null && shipped < CAM_FADE_START_M,
            shipped_arm_shortened: shipped !== null && shipped < CAM_ARM_FREE_M,
          };
        })(),
        refined_predicted: face ? predictRefine(sc, face.yaw_deg, exact, rearAt) : null,
        bearings: sc.rows,
      };
    }

    // ---- IN: the room, in its own local frame, against its own shell --------------------------
    const isp = cont.interior_spawn;
    if (!Array.isArray(isp)) row.enter = { skipped: 'no interior spawn' };
    else {
      const shapes = interiorCollisionShapes(rec);
      const cell = new CollisionCell(`interior:${id}`, shapes, { class: 'interior' });
      const eye = isp[1] + 1.6;
      const face = entryFacing(rec);
      const sc = scan(cell, isp[0], isp[2], eye);
      const exact = (yaw) => { const c = clearance(cell, isp[0], isp[2], yaw, eye), o = occluded(cell, isp[0], isp[2], yaw, eye); return { clearance_m: c, occluded_frac: o, pass: passes(c, o) }; };
      const rearAt = (yaw) => Math.min(CAM_ARM_FREE_M, clearance(cell, isp[0], isp[2], yaw + 180, isp[1] + CAM_PIVOT_H_M));
      const fixC = face ? clearance(cell, isp[0], isp[2], face.yaw_deg, eye) : null;
      const fixO = face ? occluded(cell, isp[0], isp[2], face.yaw_deg, eye) : null;
      const seedC = clearance(cell, isp[0], isp[2], SEED_YAW, eye);
      const seedO = occluded(cell, isp[0], isp[2], SEED_YAW, eye);
      row.enter = {
        pos: isp.slice(), shapes: shapes.length,
        fixed: face ? { yaw_deg: +face.yaw_deg.toFixed(1), source: face.source, clearance_m: fixC, occluded_frac: fixO, pass: passes(fixC, fixO) } : null,
        seeded_prior: { yaw_deg: SEED_YAW, clearance_m: seedC, occluded_frac: seedO, pass: passes(seedC, seedO) },
        any_prior: { passing_of_36: sc.passing_bearings, failing_of_36: 36 - sc.passing_bearings },
        best_clearance_m: sc.best_clearance_m, best_yaw_deg: sc.best_yaw_deg,
        worst_clearance_m: sc.worst_clearance_m,
        point_can_pass: sc.point_can_pass, no_geometry_visible: sc.no_geometry_visible,
        refined_predicted: face ? predictRefine(sc, face.yaw_deg, exact, rearAt) : null,
        bearings: sc.rows,
      };
    }
    out.rows.push(row);
  }

  // ---- roll-up ---------------------------------------------------------------------------------
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const side = (key) => {
    const rs = out.rows.filter((r) => r[key] && !r[key].skipped);
    const fixed = rs.filter((r) => r[key].fixed);
    const priorPairs = rs.reduce((a, r) => a + r[key].any_prior.failing_of_36, 0);
    return {
      n: rs.length,
      fixed_failing: fixed.filter((r) => !r[key].fixed.pass).length,
      fixed_failing_ids: fixed.filter((r) => !r[key].fixed.pass).map((r) => r.id),
      fixed_median_clearance_m: med(fixed.map((r) => r[key].fixed.clearance_m)),
      fixed_median_occluded: med(fixed.map((r) => r[key].fixed.occluded_frac)),
      seeded_prior_failing: rs.filter((r) => !r[key].seeded_prior.pass).length,
      seeded_prior_median_clearance_m: med(rs.map((r) => r[key].seeded_prior.clearance_m)),
      any_prior_failing_pairs: priorPairs,
      any_prior_total_pairs: rs.length * 36,
      any_prior_failing_share: +(priorPairs / (rs.length * 36)).toFixed(4),
      interiors_failing_for_some_prior: rs.filter((r) => r[key].any_prior.failing_of_36 > 0).length,
      refined_failing: rs.filter((r) => r[key].refined_predicted && !passesRefined(r[key])).length,
      refined_failing_ids: rs.filter((r) => r[key].refined_predicted && !passesRefined(r[key])).map((r) => r.id),
      refined_changed: rs.filter((r) => r[key].refined_predicted && r[key].refined_predicted.refined).length,
      refined_changed_ids: rs.filter((r) => r[key].refined_predicted && r[key].refined_predicted.refined).map((r) => r.id),
      point_cannot_pass: rs.filter((r) => !r[key].point_can_pass).map((r) => r.id),
      no_geometry_visible: rs.filter((r) => r[key].no_geometry_visible).map((r) => r.id),
      camera_arm: key !== 'exit' ? null : (() => {
        const c = rs.map((r) => r[key].camera_arm_proxy).filter(Boolean);
        return {
          n: c.length,
          collapsed_under_fade: c.filter((x) => x.shipped_arm_collapsed).length,
          shortened_under_arm_free: c.filter((x) => x.shipped_arm_shortened).length,
          median_rear_m: med(c.map((x) => x.shipped_rear_m)),
          median_best_rear_m: med(c.map((x) => x.best_rear_m)),
          doorsteps_where_no_facing_gives_the_arm_room: c.filter((x) => x.best_rear_m < CAM_ARM_FREE_M).length,
          after_refine_collapsed_under_fade: rs.filter((r) => {
            const rp = r[key].refined_predicted; const cp = r[key].camera_arm_proxy;
            if (!rp || !cp) return false;
            const rm = rp.rear_m === undefined ? cp.shipped_rear_m : rp.rear_m;
            return rm !== null && rm < CAM_FADE_START_M;
          }).length,
          after_refine_shortened: rs.filter((r) => {
            const rp = r[key].refined_predicted; const cp = r[key].camera_arm_proxy;
            if (!rp || !cp) return false;
            const rm = rp.rear_m === undefined ? cp.shipped_rear_m : rp.rear_m;
            return rm !== null && rm < CAM_ARM_FREE_M;
          }).length,
        };
      })(),
      no_rule: rs.filter((r) => !r[key].fixed).map((r) => r.id),
      sources: rs.reduce((a, r) => { const k = r[key].fixed ? r[key].fixed.source : '(none)'; a[k] = (a[k] || 0) + 1; return a; }, {}),
    };
  };
  out.summary = { exit: side('exit'), enter: side('enter') };

  // ---- validation against the running game -----------------------------------------------------
  if (args.validate) {
    const v = JSON.parse(fs.readFileSync(path.resolve(String(args.validate)), 'utf8'));
    const byId = new Map(out.rows.map((r) => [r.id, r]));
    const pairs = [];
    for (const r of v.rows || []) {
      const mine = byId.get(r.id);
      if (!mine) continue;
      const ex = r.exit && r.exit.marks && r.exit.marks.f1;
      if (ex && mine.exit && mine.exit.fixed) {
        pairs.push({ id: r.id, side: 'exit', in_game_m: ex.clearance_m, offline_m: mine.exit.fixed.clearance_m,
          in_game_yaw: ex.cam_yaw_deg, offline_yaw: mine.exit.fixed.yaw_deg,
          in_game_occl: ex.occluded_frac, offline_occl: mine.exit.fixed.occluded_frac });
      }
      const en = r.enter && r.enter.marks && r.enter.marks.f1;
      if (en && mine.enter && mine.enter.fixed) {
        pairs.push({ id: r.id, side: 'enter', in_game_m: en.clearance_m, offline_m: mine.enter.fixed.clearance_m,
          in_game_yaw: en.cam_yaw_deg, offline_yaw: mine.enter.fixed.yaw_deg,
          in_game_occl: en.occluded_frac, offline_occl: mine.enter.fixed.occluded_frac });
      }
    }
    const yawAgree = pairs.filter((p) => Math.abs(((p.in_game_yaw - p.offline_yaw + 540) % 360) - 180) < 1).length;
    const clearAgree = pairs.filter((p) => Math.abs(p.in_game_m - p.offline_m) <= 0.5).length;
    const verdictAgree = pairs.filter((p) => passes(p.in_game_m, p.in_game_occl) === passes(p.offline_m, p.offline_occl)).length;
    out.validation = {
      against: String(args.validate), pairs: pairs.length,
      yaw_agrees_within_1deg: yawAgree, clearance_agrees_within_0p5m: clearAgree, verdict_agrees: verdictAgree,
      disagreements: pairs.filter((p) => passes(p.in_game_m, p.in_game_occl) !== passes(p.offline_m, p.offline_occl)),
      worst_clearance_gap_m: pairs.length ? +Math.max(...pairs.map((p) => Math.abs(p.in_game_m - p.offline_m))).toFixed(2) : null,
      detail: pairs,
    };
  }

  const outDir = path.join(REPORTS_DIR, 'door-yaw');
  ensureDir(outDir);
  const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'offline-115.json');
  writeJson(jsonPath, out);

  say(`door-yaw-offline — ${out.rows.length} of ${out.population} interiors, commit ${out.commit}`);
  say(`  PASS = clearance >= ${MIN_CLEAR} m AND occluded_frac <= ${MAX_OCCL} (near ${NEAR} m, cap ${REACH} m)`);
  for (const k of ['exit', 'enter']) {
    const s = out.summary[k];
    say(`  ${k.toUpperCase()}  n=${s.n}`);
    say(`    DATA RULE ALONE      failing ${s.fixed_failing}/${s.n}   median clear ${s.fixed_median_clearance_m} m   median occl ${s.fixed_median_occluded}`);
    say(`    + GEOMETRY REFINE    failing ${s.refined_failing}/${s.n}   (predicted; ${s.refined_changed} facing(s) changed${s.refined_changed ? ': ' + s.refined_changed_ids.join(', ') : ''})`);
    say(`    BEFORE, seeded prior ${SEED_YAW} deg   failing ${s.seeded_prior_failing}/${s.n}   median clear ${s.seeded_prior_median_clearance_m} m`);
    say(`    BEFORE, ANY prior (36 per interior)   failing pairs ${s.any_prior_failing_pairs}/${s.any_prior_total_pairs} = ${(s.any_prior_failing_share * 100).toFixed(1)}%   interiors failing for at least one prior: ${s.interiors_failing_for_some_prior}/${s.n}`);
    say(`    points where NO bearing passes: ${s.point_cannot_pass.length}${s.point_cannot_pass.length ? ' — ' + s.point_cannot_pass.join(', ') : ''}`);
    say(`    instrument saw no geometry: ${s.no_geometry_visible.length}${s.no_geometry_visible.length ? ' — ' + s.no_geometry_visible.slice(0, 10).join(', ') : ''}`);
    say(`    rule sources: ${JSON.stringify(s.sources)}`);
    if (s.camera_arm) {
      const c = s.camera_arm;
      say(`    CAMERA ARM (proxy, behind the facing at pivot height): median rear ${c.median_rear_m} m against ${CAM_ARM_FREE_M} m wanted`);
      say(`      arm shortened (< ${CAM_ARM_FREE_M} m): ${c.shortened_under_arm_free}/${c.n}   player fades out of frame (< ${CAM_FADE_START_M} m): ${c.collapsed_under_fade}/${c.n}`);
      say(`      doorsteps where NO facing gives the arm its full room: ${c.doorsteps_where_no_facing_gives_the_arm_room}/${c.n} (median best rear ${c.median_best_rear_m} m)`);
      say(`      AFTER the refinement: player fades out of frame ${c.after_refine_collapsed_under_fade}/${c.n}, arm shortened ${c.after_refine_shortened}/${c.n}`);
    }
    if (s.fixed_failing) say(`    FAILING: ${s.fixed_failing_ids.join(', ')}`);
  }
  if (out.validation) {
    const V = out.validation;
    say(`  VALIDATION against the running game (${path.basename(V.against)}): ${V.pairs} paired measurement(s)`);
    say(`    yaw agrees within 1 deg: ${V.yaw_agrees_within_1deg}/${V.pairs}   clearance within 0.5 m: ${V.clearance_agrees_within_0p5m}/${V.pairs}   PASS/FAIL verdict agrees: ${V.verdict_agrees}/${V.pairs}   worst gap ${V.worst_clearance_gap_m} m`);
    for (const d of V.disagreements.slice(0, 8)) say(`    DISAGREES  ${d.id} ${d.side}: in-game ${d.in_game_m} m / ${d.in_game_occl}, offline ${d.offline_m} m / ${d.offline_occl}`);
  }
  say(`  json: ${path.relative(REPO_ROOT, jsonPath)}`);
};

main();
