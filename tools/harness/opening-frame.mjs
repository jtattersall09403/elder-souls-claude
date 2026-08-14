#!/usr/bin/env node
// opening-frame.mjs — IS THE PLAYER IN THE FIRST FRAME THEY CONTROL, AND WHAT ARE THEY LOOKING AT?
//
// ---------------------------------------------------------------------------------------------
// THE TWO DEFECTS THIS MEASURES
// ---------------------------------------------------------------------------------------------
//
// `orchestration/status/SPAWN-YAW.json`'s `not_done` list carries two things the door-exit fix
// deliberately did not reach, both of them in the opening seconds:
//
//   1. **The census hand-back framing.** At the instant `censusAnswer()` resolves the last node
//      the camera is still on `character/scene.js`'s CONVERSATION pose — yaw 350, pitch -3,
//      pointed at the Warden-Scribe's desk and the wall of reed-cases behind it. Nothing re-aims
//      it when the scene hands control back, so the first frame anybody controls is shelving at
//      arm's length. This is BEFORE any door, so `sim/settlement.js`'s exit-facing fix cannot
//      reach it.
//
//   2. **The camera arm at the writ-house doorstep.** The body is turned correctly (yaw 70,
//      `door_to_doorstep`) and looking out over the marsh — and the player is not in the frame,
//      because the spring arm has nowhere to go.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS RUNS IN BARE NODE AND NOT IN A BROWSER
// ---------------------------------------------------------------------------------------------
//
// The box has been at 4-7 per core against a ceiling of 4.0 and starvation has produced three
// false defect reports in one day: a browser that misses its frame budget reports a camera that
// never settled as a camera that collapsed. So this tool takes the failing measurement by
// importing the SHIPPED MODULES and running the real fixed-step camera by hand:
//
//   `game/src/world/field.js`        WorldField, for the ground height under the town
//   `game/src/render/exterior.js`    planSettlement + settlementSolids — the SAME plan the meshes
//                                    are built from and the same call `world/province.js`
//                                    `settlementSolidsNear()` makes
//   `game/src/sim/collision.js`      CollisionCell — the same class `engine.js`
//                                    `_settleSettlementSolids()` constructs
//   `game/src/sim/camera.js`         `stepCamera()` ITSELF. Not a re-implementation of the arm:
//                                    the shipped function, stepped 60 times on a real SimState.
//   `game/src/sim/settlement.js`     `exitFacing()` — the yaw the shipped door actually writes
//   `game/src/character/scene.js`    `CENSUS_PLACES` — the pose the census actually hands back
//
// Nothing here has a frame budget to miss. The numbers are pure float arithmetic over shipped
// data, so a loaded box changes how long it takes and not what it says.
//
// ---------------------------------------------------------------------------------------------
// THE METRIC IS THE GAME'S OWN, NOT AN INVENTED ONE
// ---------------------------------------------------------------------------------------------
//
// "The player is not in the frame" is not a judgement here. `sim/camera.js#fadeOpacity()` fades
// the character out as the arm shortens — 1.0 at/above `fade_start_m` = 1.30 m, and **0.0 at or
// below `fade_zero_m` = 0.90 m** — and the renderer consumes `camera.charOpacity` without
// deciding anything. So `charOpacity === 0` is the shipped build's own statement that the body
// is not drawn. That is the number this tool reports, alongside the arm length that produced it.
//
// The second number is CLEARANCE: how far you can see at eye height along a facing, marched
// against the same collision set, capped at `--reach`. It is the same measure
// `tools/harness/door-exit-yaw.mjs` uses, restated here so the two tools can be compared.
//
// ---------------------------------------------------------------------------------------------
// THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER
// ---------------------------------------------------------------------------------------------
//
// The trivial control is "no framing at all" and it proves nothing: of course an unaimed camera
// is worse. The control that matters is **`body_only`** — the yaw written to the body and to the
// combat mirror, and NOT to `sim.camera.yaw`. That arm passes every state check anyone would
// think to write (`sim.player.yaw` is right, `combat.player.yaw` is right, the body is facing the
// marsh) and shows the player a wall for two seconds, because `stepCamera`'s auto-recentre is
// clamped to `recentre_yaw_clamp_deg_per_frame` = 1.5°/frame. This codebase has walked into that
// trap twice. If this tool cannot tell `body_only` from the fix, this tool is worthless.
//
// And per `orchestration/HAZARDS.md` §0b, a guard that only detects deviation in the direction
// you expected fails on half the number line: `--sweep` scores ALL 72 five-degree bearings from
// the same standing point, so a rule that is bad and a POINT that is bad can be told apart, and
// a "fix" that happens to be worse than the best available bearing is visible as such.
//
// USAGE
//   node tools/harness/opening-frame.mjs [--json <path>] [--reach 12] [--sweep] [--quiet]
'use strict';

import fs from 'node:fs';
import path from 'node:path';

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
const REACH = Number(args.reach || 12);
const say = args.quiet ? () => {} : (s) => process.stdout.write(s + '\n');

const { WorldField } = await import(path.join(ROOT, 'game/src/world/field.js'));
const { planSettlement, settlementSolids, insideBuilding } = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const { CollisionCell, EMPTY_CELL } = await import(path.join(ROOT, 'game/src/sim/collision.js'));
const CAM = await import(path.join(ROOT, 'game/src/sim/camera.js'));
const { SimState } = await import(path.join(ROOT, 'game/src/sim/state.js'));
const { InputPipeline } = await import(path.join(ROOT, 'game/src/input/pipeline.js'));
const { exitFacing } = await import(path.join(ROOT, 'game/src/sim/settlement.js'));
const { CENSUS_PLACES, handBackFraming, doorwayLocal } = await import(path.join(ROOT, 'game/src/character/scene.js'));

const { stepCamera, CAMERA_CONST, fadeOpacity } = CAM;
const D2R = Math.PI / 180;
const norm360 = (a) => ((a % 360) + 360) % 360;
const fwd2 = (yaw) => { const r = yaw * D2R; return [Math.sin(r), Math.cos(r)]; };

// ---------------------------------------------------------------------------------------------
// the world, as the shipped code builds it
// ---------------------------------------------------------------------------------------------
const terrain = J('game/data/world/terrain.json');
const regions = J('game/data/world/regions.json');
const water = J('game/data/world/water.json');
const field = new WorldField(terrain, regions, water);

const interiors = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/interiors'))) {
  if (!f.endsWith('.json')) continue;
  const rec = J(`game/data/world/interiors/${f}`);
  interiors[rec.id] = rec;
}

/** The town cell exactly as `engine.js#_settleSettlementSolids()` builds it, at a world point. */
function townCellAt(settlementId, x, z, radius = 45) {
  const rec = J(`game/data/world/settlements/${settlementId}.json`);
  const plan = planSettlement(rec, interiors);
  const shapes = settlementSolids(plan, x, z, radius, (bx, bz) => field.heightAt(bx, bz));
  return {
    cell: new CollisionCell(`settlement:${settlementId}`, shapes, { class: 'exterior' }),
    plan,
  };
}

/** An interior cell, as `engine.js#_syncInteriorCollisionCell()` builds it, for a room's bounds. */
function interiorCellFor(id) {
  const rec = interiors[id];
  const bm = rec && rec.bounds_m;
  if (!bm) return EMPTY_CELL;
  const t = 0.25;
  const cx = (bm.x[0] + bm.x[1]) / 2, cz = (bm.z[0] + bm.z[1]) / 2;
  const hx = (bm.x[1] - bm.x[0]) / 2, hz = (bm.z[1] - bm.z[0]) / 2;
  const hy = (bm.y[1] - bm.y[0]) / 2, cy = (bm.y[0] + bm.y[1]) / 2;
  return new CollisionCell(`interior:${id}`, [
    { k: 'box', c: [bm.x[0] - t, cy, cz], h: [t, hy, hz + t * 2], id: 'wall-x0' },
    { k: 'box', c: [bm.x[1] + t, cy, cz], h: [t, hy, hz + t * 2], id: 'wall-x1' },
    { k: 'box', c: [cx, cy, bm.z[0] - t], h: [hx + t * 2, hy, t], id: 'wall-z0' },
    { k: 'box', c: [cx, cy, bm.z[1] + t], h: [hx + t * 2, hy, t], id: 'wall-z1' },
    { k: 'box', c: [cx, bm.y[1] + t, cz], h: [hx + t * 2, t, hz + t * 2], id: 'ceiling' },
  ], { class: 'interior' });
}

// ---------------------------------------------------------------------------------------------
// clearance, and the arm — the arm by running the shipped `stepCamera`
// ---------------------------------------------------------------------------------------------
function clearance(cell, x, y, z, yaw, reach = REACH) {
  const f = fwd2(yaw);
  for (let d = 0.25; d <= reach + 1e-9; d += 0.25) {
    if (cell.distance(x + f[0] * d, y, z + f[1] * d) <= 0) return +(d - 0.25).toFixed(2);
  }
  return reach;
}

/** Which shape the arm's sphere cast lands in, by name. Diagnosis, not a score. */
function armObstruction(cell, c) {
  const yaw = c.yaw * D2R, pitch = c.pitch * D2R, cp = Math.cos(pitch);
  const f = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const want = CAMERA_CONST.arm_free_m;
  const hits = [];
  for (let d = 0.2; d <= want + 1e-9; d += 0.1) {
    const px = c.pivot[0] - f[0] * d + r[0] * c.shoulderR + u[0] * c.shoulderU;
    const py = c.pivot[1] - f[1] * d + r[1] * c.shoulderR + u[1] * c.shoulderU;
    const pz = c.pivot[2] - f[2] * d + r[2] * c.shoulderR + u[2] * c.shoulderU;
    for (const s of cell.shapes) {
      const one = new CollisionCell('one', [], {});
      one.shapes = [s];
      if (one.distance(px, py, pz) <= CAMERA_CONST.cast_radius_m) {
        hits.push({ at_m: +d.toFixed(2), shape: s.id || `k${s.k}` });
        d = want + 1;
        break;
      }
    }
  }
  return hits[0] || null;
}

/**
 * Stand a body somewhere, aim it, and run the SHIPPED camera for `frames` fixed steps.
 *
 * `camYaw === null` is the `body_only` null control: the body's yaw is written and the camera's
 * is left where it was, which is what a fix that forgets `sim.camera.yaw` produces.
 */
function poseAndSettle(cell, pos, bodyYaw, camYaw, opts = {}) {
  const sim = new SimState();
  // `Engine`'s constructor does exactly this — the camera reads `sim.input.lookX/lookY` and
  // writes the `*Consumed` counters back, so the real pipeline object is what it must have.
  sim.input = new InputPipeline();
  sim.cell = cell;
  const p = sim.player;
  p.pos[0] = pos[0]; p.pos[1] = pos[1]; p.pos[2] = pos[2];
  p.yaw = norm360(bodyYaw);
  p.lockOn = null;
  const c = sim.camera;
  c.yaw = camYaw === null ? norm360(opts.priorCamYaw ?? bodyYaw + 180) : norm360(camYaw);
  c.pitch = opts.pitch === undefined ? -8 : opts.pitch;
  c.pivot[0] = p.pos[0]; c.pivot[1] = p.pos[1] + CAMERA_CONST.pivot_height_m; c.pivot[2] = p.pos[2];
  c.pivotSnap = true;
  if (opts.settled !== false) {
    // What `engine._settleCamera()` does: hand the arm its full length before the first step, so
    // a collapsed reading is the CELL saying no and not the spring still easing out.
    const want = CAMERA_CONST.arm_free_m;
    c.armDesired = want; c.armEased = want; c.armLen = want; c.armCast = want;
    c.dist = want; c.distTarget = want; c.clearFrames = 0;
  }
  const frames = opts.frames === undefined ? 60 : opts.frames;
  const trace = [];
  for (let i = 0; i < frames; i++) {
    sim.frame = i;
    sim.input.lookX = 0; sim.input.lookY = 0;
    stepCamera(sim);
    trace.push({ f: i, arm: +c.armLen.toFixed(3), opacity: +c.charOpacity.toFixed(3), yaw: +c.yaw.toFixed(1) });
  }
  return {
    arm_m: +c.armLen.toFixed(3),
    char_opacity: +c.charOpacity.toFixed(3),
    player_drawn: c.charOpacity > 0,
    arm_guard: !!c.armGuard,
    arm_floor_emergency: !!c.armFloorEmergency,
    arm_legal_connected_max_m: +Number(c.armLegalConnectedMax ?? -1).toFixed(3),
    clip_through: !!c.clipThrough,
    cam_yaw_deg: +c.yaw.toFixed(1),
    body_yaw_deg: +p.yaw.toFixed(1),
    frame0: trace[0], frame30: trace[30] || null, last: trace[trace.length - 1],
    obstruction: armObstruction(cell, c),
    clearance_m: clearance(cell, p.pos[0], p.pos[1] + 1.6, p.pos[2], c.yaw),
  };
}

// ---------------------------------------------------------------------------------------------
// the two sites
// ---------------------------------------------------------------------------------------------
const out = {
  schema: 'elder-souls/opening-frame@1',
  generated_at: new Date().toISOString(),
  loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  measured_in: 'bare node, shipped modules, no browser and no frame budget',
  reach_m: REACH,
  fade: { start_m: CAMERA_CONST.fade_start_m, zero_m: CAMERA_CONST.fade_zero_m, arm_min_m: CAMERA_CONST.arm_min_m },
  sites: {},
};

// ---- SITE 1: the census hand-back, inside the writ house ------------------------------------
//
// THE MEASURE HERE IS NOT CLEARANCE, IT IS WHETHER THE WAY OUT IS IN THE PICTURE.
//
// Clearance-in-metres is the right question at a doorstep and the wrong one in a 9 x 12 m room:
// the census pose and the fix both see the far wall, so both score the same and the number is
// blind to the entire complaint. What separates them is angular — where the room's own doorway
// falls relative to where the camera is pointed, against the rig's real horizontal field of view,
// which is `2*atan(tan(fov/2) * aspect)` = 79.3 deg at fov 50 and 16:9. Off by more than half of
// that and the exit is not on the screen.
{
  const place = CENSUS_PLACES['writ-house'];
  const cell = interiorCellFor('writ-house');
  const pos = [place.player_pos[0], 0, place.player_pos[2]];
  const rec = interiors['writ-house'];
  const door = doorwayLocal(rec);
  const fixed = handBackFraming(rec, pos);
  const halfH = Math.atan(Math.tan(CAMERA_CONST.fov_deg / 2 * D2R) * CAMERA_CONST.aspect) / D2R;

  /** Where the doorway sits in the frame: degrees off the view axis, and is that on screen. */
  const doorInFrame = (camYaw) => {
    const b = norm360(Math.atan2(door.pos[0] - pos[0], door.pos[2] - pos[2]) / D2R);
    const off = ((b - camYaw + 540) % 360) - 180;
    return { bearing_deg: +b.toFixed(1), off_axis_deg: +off.toFixed(1), on_screen: Math.abs(off) <= halfH };
  };

  const arm = (bodyYaw, camYaw, opts) => {
    const r = poseAndSettle(cell, pos, bodyYaw, camYaw, opts);
    return { ...r, way_out: doorInFrame(r.cam_yaw_deg) };
  };

  out.sites.census_handback = {
    what: 'the frame at the instant the last census answer resolves, before any door is used',
    room_bounds_m: rec.bounds_m,
    player_pos_local: pos,
    doorway_local: door ? door.pos : null,
    doorway_side: door ? door.side : null,
    interior_spawn_local: rec.continuity.interior_spawn,
    note_interior_spawn: 'NOT the door. `continuity.interior_spawn` is where useDoor() puts you and '
      + 'on this record it is [0,0,-4.6], against the -z wall, 11 m from the +z doorway the shell '
      + 'plan cuts and the world door stands on. Named here so nobody aims at it again.',
    horizontal_half_fov_deg: +halfH.toFixed(1),
    arms: {
      // The pose the scene left behind: a CONVERSATION framing, still live after the conversation.
      as_shipped: { rule: 'CENSUS_PLACES.writ-house.camera', ...arm(place.player_yaw, place.camera.yaw, { pitch: place.camera.pitch }) },
      // The fix: `handBackFraming()`, body and camera together.
      fixed: { rule: `handBackFraming (${fixed ? fixed.source : 'null'})`, ...arm(fixed.yaw_deg, fixed.yaw_deg, { pitch: fixed.pitch_deg }) },
      // THE NULL CONTROL, and it is the plausible wrong answer: the body and the combat mirror are
      // turned to the door and `sim.camera.yaw` is not. Every state check passes. The player is
      // shown the wall, and then shown it sliding away at 1.5 deg/frame.
      NULL_body_only: {
        rule: 'body + combat mirror only, sim.camera.yaw untouched',
        ...arm(fixed.yaw_deg, null, { pitch: place.camera.pitch, priorCamYaw: place.camera.yaw }),
      },
    },
  };
  // How long the null control takes to arrive, in frames, at 1.5 deg/frame — the cost of the trap.
  const gap = Math.abs(((fixed.yaw_deg - place.camera.yaw + 540) % 360) - 180);
  out.sites.census_handback.null_recentre = {
    yaw_gap_deg: +gap.toFixed(1),
    clamp_deg_per_frame: CAMERA_CONST.recentre_yaw_clamp_deg_per_frame,
    frames_to_arrive: Math.ceil(gap / CAMERA_CONST.recentre_yaw_clamp_deg_per_frame),
    and_only_once: 'auto-recentre needs the stick held forward for recentre_gate_frames first, so '
      + 'a player who does not move never arrives at all',
  };
}

// ---- SITE 2: the writ-house doorstep ---------------------------------------------------------
{
  const rec = interiors['writ-house'];
  const spawn = rec.continuity.exterior_spawn;
  const y = field.heightAt(spawn[0], spawn[2]);
  const pos = [spawn[0], y, spawn[2]];
  const { cell, plan } = townCellAt('thorn', spawn[0], spawn[2]);
  const face = exitFacing(rec);
  const shipped = face ? face.yaw_deg : 0;
  const site = {
    what: 'the first controlled OUTDOOR frame, after leaveInterior() puts the body on the doorstep',
    pos, ground_y_m: +y.toFixed(2),
    shipped_exit_yaw_deg: +shipped.toFixed(1), yaw_source: face ? face.source : null,
    inside_a_building: insideBuilding(plan, spawn[0], spawn[2]),
    town_cell_shapes: cell.shapes.length,
    arms: {},
  };
  site.arms.as_shipped = { yaw_deg: +shipped.toFixed(1), ...poseAndSettle(cell, pos, shipped, shipped) };
  site.arms.NULL_body_only = {
    yaw_deg: +shipped.toFixed(1),
    note: 'the plausible wrong fix: body yaw written, sim.camera.yaw left facing back at the door',
    ...poseAndSettle(cell, pos, shipped, null, { priorCamYaw: norm360(shipped + 180) }),
  };
  // The full number line, both directions, so a bad POINT and a bad RULE are distinguishable.
  const sweep = [];
  for (let a = 0; a < 360; a += 5) {
    const r = poseAndSettle(cell, pos, a, a, { frames: 30 });
    sweep.push({ yaw_deg: a, arm_m: r.arm_m, char_opacity: r.char_opacity, clearance_m: r.clearance_m });
  }
  site.sweep = sweep;
  const drawn = sweep.filter((s) => s.char_opacity > 0);
  site.sweep_summary = {
    n: sweep.length,
    bearings_with_player_drawn: drawn.length,
    best_by_arm: sweep.slice().sort((a, b) => b.arm_m - a.arm_m || b.clearance_m - a.clearance_m)[0],
    best_by_clearance: sweep.slice().sort((a, b) => b.clearance_m - a.clearance_m || b.arm_m - a.arm_m)[0],
    // The bearing that keeps the player in the frame AND sees furthest. Empty when the STANDING
    // POINT, not the rule, is the problem — which is the distinction this sweep exists to make.
    best_drawn_and_clear: drawn.slice().sort((a, b) => b.clearance_m - a.clearance_m || b.arm_m - a.arm_m)[0] || null,
  };
  out.sites.writ_house_doorstep = site;
}

// ---------------------------------------------------------------------------------------------
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(ROOT, 'reports/opening-frame/opening-frame.json');
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));

const pct = (v) => `${(v * 100).toFixed(0)}%`;
say(`opening-frame — loadavg ${out.loadavg.split(' ').slice(0, 3).join(' ')}`);
say('');
const C = out.sites.census_handback;
say(`SITE 1 — the census hand-back, inside the Writ House (before any door). Doorway at local ${C.doorway_local.map((n) => n.toFixed(2)).join(', ')} (${C.doorway_side}); horizontal half-FOV ${C.horizontal_half_fov_deg}°:`);
for (const [k, v] of Object.entries(C.arms)) {
  say(`  ${k.padEnd(16)} cam yaw ${String(v.cam_yaw_deg).padStart(5)}  arm ${String(v.arm_m).padStart(6)} m  opacity ${pct(v.char_opacity).padStart(4)}`
    + `  WAY OUT ${v.way_out.on_screen ? 'ON SCREEN ' : 'off screen'} (${String(v.way_out.off_axis_deg).padStart(6)}° off axis)`);
}
say(`  the null control needs ${C.null_recentre.frames_to_arrive} frames at ${C.null_recentre.clamp_deg_per_frame}°/frame to close its ${C.null_recentre.yaw_gap_deg}° gap — and only if the player walks`);
say('');
const S = out.sites.writ_house_doorstep;
say(`SITE 2 — the Writ House doorstep, ${S.pos.map((n) => n.toFixed(2)).join(', ')} (ground ${S.ground_y_m} m), ${S.town_cell_shapes} solids:`);
for (const [k, v] of Object.entries(S.arms)) {
  say(`  ${k.padEnd(16)} cam yaw ${String(v.cam_yaw_deg).padStart(5)}  arm ${String(v.arm_m).padStart(6)} m  char opacity ${pct(v.char_opacity).padStart(4)}  clearance ${String(v.clearance_m).padStart(5)} m`
    + `  guard ${v.arm_guard ? 'Y' : 'n'}  hit ${v.obstruction ? `${v.obstruction.shape} @ ${v.obstruction.at_m} m` : '-'}`);
}
say(`  sweep: ${S.sweep_summary.bearings_with_player_drawn}/${S.sweep_summary.n} bearings keep the player drawn`);
say(`  best arm       ${JSON.stringify(S.sweep_summary.best_by_arm)}`);
say(`  best clearance ${JSON.stringify(S.sweep_summary.best_by_clearance)}`);
say(`  best of both   ${JSON.stringify(S.sweep_summary.best_drawn_and_clear)}`);
say('');
say(`json: ${path.relative(ROOT, jsonPath)}`);
