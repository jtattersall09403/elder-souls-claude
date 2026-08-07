#!/usr/bin/env node
// cam-projectpoint-fix.mjs — W1-06 round 3.
//
// engine.projectPoint() was blind to every posed camera: engine.camera({pos, look}) wrote
// c.pos/c.pivot/c.fov but never c.yaw/c.pitch, and projectNDC()/project() build the view basis
// from c.yaw/c.pitch alone (sim/camera.js viewBasis -> basisAt). stepCamera() DOES solve
// yaw/pitch correctly from an override -- via applyOverride() -- but only once a fixed step
// runs, and a capture script that poses the camera then reads projectPoint() off a
// renderFrame() (a DRAW, not a step) never runs that step. See corpus/90-verdicts/wave1/W1-13-r3.md
// section 5/7: 0 of 96 posed-camera projectPoint reads on_screen:true, including 0 of 58 rows
// the same probe's own pixels scored visible.
//
// Fix: engine.camera() now calls the SAME applyOverride() stepCamera() calls, immediately, so
// c.yaw/c.pitch are solved from pos->look before any readback.
//
// This probe runs entirely in bare Node against sim/camera.js and sim/state.js directly -- no
// browser, no engine, no renderer -- because the defect and the fix are both fully contained in
// that module's own math (RULES.md 21: do the work that needs no browser when the box is loaded).
//
// RULES.md 4: "break the thing you measure on purpose and confirm your instrument goes red."
// §falsify below points a posed camera at a point KNOWN to be off-screen (directly behind the
// eye) and confirms projectNDC still correctly answers on_screen:false/in_front:false -- so a
// green pass here is not a probe that cannot fail.
//
// RULES.md 6: delete-the-fix. §prefix reproduces the exact pre-fix code path (apply pos/pivot/fov
// only, leave yaw/pitch stale) on a COPY of the camera object and confirms the old wrong number
// returns, and that the two arms differ.

import { CAMERA_CONST, projectNDC, applyOverride } from '../../game/src/sim/camera.js';

function freshCamera() {
  // Mirrors sim/state.js's camera defaults (pivot 1.55, arm 4.1, yaw 0, pitch -8) closely
  // enough for basis math -- only the fields project()/applyOverride() touch matter here.
  return {
    pos: [0, 1.55, -4.1], pivot: [0, 1.55, 0], yaw: 0, pitch: -8, fov: 50,
    dist: 4.1, armLen: 4.1, shakeYaw: 0, shakePitch: 0, charOpacity: 1,
    override: null,
  };
}

// The pre-fix engine.camera() body, verbatim (RULES 17: this is a copy for the delete-the-fix
// arm, not a second production implementation -- it exists only in this probe).
function applyOverridePreFix(c) {
  const o = c.override;
  c.pos[0] = o.pos[0]; c.pos[1] = o.pos[1]; c.pos[2] = o.pos[2];
  c.pivot[0] = o.look[0]; c.pivot[1] = o.look[1]; c.pivot[2] = o.look[2];
  c.fov = o.fov;
  // yaw/pitch: NOT TOUCHED. This is the bug.
}

function poseAndProject(c, pos, look, target) {
  c.override = { pos, look, fov: 50 };
  applyOverride(c); // the FIXED path -- same function stepCamera() calls
  const out = [0, 0, 0];
  const ok = projectNDC(c, target, out);
  return { ndc: [out[0], out[1]], z: out[2], in_front: ok, on_screen: ok && Math.abs(out[0]) <= 1 && Math.abs(out[1]) <= 1, yaw: c.yaw, pitch: c.pitch };
}

function poseAndProjectPreFix(c, pos, look, target) {
  c.override = { pos, look, fov: 50 };
  applyOverridePreFix(c); // the BUGGY path, reproduced for delete-the-fix only
  const out = [0, 0, 0];
  const ok = projectNDC(c, target, out);
  return { ndc: [out[0], out[1]], z: out[2], in_front: ok, on_screen: ok && Math.abs(out[0]) <= 1 && Math.abs(out[1]) <= 1, yaw: c.yaw, pitch: c.pitch };
}

const results = { fixed: [], pre_fix: [], falsify: null };
let fail = false;

// --- Four bearings around a target at the origin, camera at 12 m, eye looking straight at it.
// This reproduces the W1-13-r3 shape: pose a camera pointed AT something and ask projectPoint
// whether it's on screen. Under the pre-fix bug, c.yaw/c.pitch are whatever the freshCamera()
// default left them (yaw 0), regardless of where the pose actually points.
const TARGET = [0, 1, 0];
const BEARINGS_DEG = [0, 90, 180, 270];
for (const deg of BEARINGS_DEG) {
  const rad = deg * Math.PI / 180;
  const R = 12;
  const eye = [TARGET[0] + Math.sin(rad) * R, TARGET[1] + 1.6, TARGET[2] + Math.cos(rad) * R];
  const look = [TARGET[0], TARGET[1], TARGET[2]];

  const c1 = freshCamera();
  const fixed = poseAndProject(c1, eye, look, TARGET);
  results.fixed.push({ bearing_deg: deg, ...fixed });
  if (!fixed.on_screen) { fail = true; console.error(`FAIL (fixed): bearing ${deg} deg, camera posed straight at its own look target, projectPoint says off-screen. ${JSON.stringify(fixed)}`); }

  const c2 = freshCamera();
  const pre = poseAndProjectPreFix(c2, eye, look, TARGET);
  results.pre_fix.push({ bearing_deg: deg, ...pre });
}

// delete-the-fix check: the two arms must actually differ, and the pre-fix arm must reproduce
// the reported symptom -- yaw pinned at the camera's PRIOR value (0, from freshCamera()) on
// every bearing, regardless of where the pose points.
const preYaws = new Set(results.pre_fix.map((r) => +r.yaw.toFixed(6)));
const fixedYaws = new Set(results.fixed.map((r) => +r.yaw.toFixed(6)));
const armsDiffer = JSON.stringify(results.fixed.map((r) => r.on_screen)) !== JSON.stringify(results.pre_fix.map((r) => r.on_screen));
const preFixReproducesPin = preYaws.size === 1; // stuck at one yaw across all 4 bearings
const preFixOnScreenCount = results.pre_fix.filter((r) => r.on_screen).length;
const fixedOnScreenCount = results.fixed.filter((r) => r.on_screen).length;

results.delete_the_fix = {
  arms_differ: armsDiffer,
  pre_fix_yaw_pinned: preFixReproducesPin,
  pre_fix_yaw_values: [...preYaws],
  fixed_yaw_values_are_distinct: fixedYaws.size === BEARINGS_DEG.length,
  pre_fix_on_screen_of_4: preFixOnScreenCount,
  fixed_on_screen_of_4: fixedOnScreenCount,
};
if (!armsDiffer) { fail = true; console.error('FAIL: fixed and pre-fix arms do not differ -- fix may be inert.'); }
if (!preFixReproducesPin) { fail = true; console.error('FAIL: pre-fix arm does not reproduce the reported symptom (yaw pinned regardless of bearing).'); }
if (fixedYaws.size !== BEARINGS_DEG.length) { fail = true; console.error('FAIL: fixed arm does not solve a distinct yaw per bearing.'); }

// --- RULES 4 falsifier: pose a camera looking AWAY from a point and confirm projectPoint still
// correctly reports it off-screen. If this probe could not go red, it would not be a probe.
{
  const c3 = freshCamera();
  const eye = [0, 1.6, -12];
  const lookAway = [0, 1.6, -13]; // looking further away from the target, i.e. away from it
  const knownOffScreen = [0, 1, 30]; // 42 m behind the camera's back, well outside any FOV
  const r = poseAndProject(c3, eye, lookAway, knownOffScreen);
  results.falsify = { ...r, expected: 'on_screen: false, in_front: false' };
  if (r.on_screen || r.in_front) {
    fail = true;
    console.error(`FAIL: falsifier did not go red -- projectPoint claims a point behind the camera is on-screen. ${JSON.stringify(r)}`);
  }
}

// --- A second falsifier shape closer to the actual W1-13-r3 rows: pose the camera at a
// bloom-sight-style eye/look pair, then ask projectPoint about a point 90 degrees off to the
// side of where the camera is aimed. Must read off-screen.
{
  const c4 = freshCamera();
  const eye = [0, 1.6, -12];
  const look = [0, 1, 0]; // aimed at the origin
  const sideTarget = [30, 1, -12]; // 90 deg to the right of the aim direction, same distance
  const r = poseAndProject(c4, eye, look, sideTarget);
  results.falsify_side = { ...r, expected: 'on_screen: false' };
  if (r.on_screen) {
    fail = true;
    console.error(`FAIL: falsifier (90 deg off-aim) did not go red. ${JSON.stringify(r)}`);
  }
}

console.log(JSON.stringify(results, null, 2));
console.log(fail ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(fail ? 1 : 0);
