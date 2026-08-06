// The camera rig, updated INSIDE the fixed step — RI-CAM06 §A, binding.
//
// "Every camera update runs inside the fixed 60 Hz sim step." That is why this file is in
// `sim/` and not in `render/`: the renderer reads the camera state, it never writes it.
// Render-time interpolation would be permitted but must be pure; wave 1 does none, so the
// displayed pose is exactly the simulated pose and RI-CAM06 M1's byte-identical check has
// nothing to trip over.
//
// Properties this file is built to satisfy, each cited:
//   * manual look is 1:1 at lag 0 — the look delta for frame f is applied on frame f
//     (RI-CAM02 §, RI-CAM06 §C);
//   * no output smoothing, no coast, no lead;
//   * pivot horizontal lag ≤ 0.001 m — the pivot IS the controller position (RI-CAM01 §B);
//   * roll is exactly 0.000° everywhere (RI-CAM06 §E);
//   * FOV never changes (RI-CAM06 §D) — one constant, no sprint punch;
//   * no head-bob: pivot height is a constant, never driven by the walk cycle;
//   * shake is rotational only, seeded, and never touches camera.pos (RI-CAM06 §G);
//   * during hitstop the rig holds (RI-CAM06 §F).
//
// `__HARNESS.camera(pose)` sets an override. While an override is active the rig does NOT
// run, so the pose cannot be overwritten by the follow-cam on the next update — that is
// RI-MTH01 "How we lose" #3, and it is the reason the override is a first-class state
// rather than a one-shot assignment.
'use strict';

import { rng } from '../core/rng.js';

const DEG = Math.PI / 180;

export const CAMERA_CONST = {
  pivot_height_m: 1.55,
  arm_length_m: 3.60,
  fov_deg: 60,
  pitch_min_deg: -70,
  pitch_max_deg: 60,
  shake_half_life_frames: 4.8,      // 0.080 s at 60 Hz — RI-CAM06 §G
  shake_max_deg: 0.90,
  shake_max_frames: 12,
};

export function stepCamera(sim) {
  const c = sim.camera;

  if (c.override) {
    // A harness-posed camera is authoritative until it is cleared. The rig does not fight it.
    applyOverride(c);
    sim.input.lookXConsumed = 0;
    sim.input.lookYConsumed = 0;
    return;
  }

  if (sim.hitstopUntil > sim.frame) {
    c.hitstop = true;
    // Held: pivot follow, arm spring and recentre all hold. |Δpos| = 0 exactly, and the
    // look delta is NOT dropped — it stays latched and is applied on the frame after
    // hitstop ends (RI-CAM06 M6).
    sim.input.lookXConsumed = 0;
    sim.input.lookYConsumed = 0;
    return;
  }
  c.hitstop = false;

  // 1:1 manual look, applied on the frame the input arrives. No smoothing, no easing.
  sim.input.lookXConsumed = sim.input.lookX;
  sim.input.lookYConsumed = sim.input.lookY;
  c.yaw = norm360(c.yaw + sim.input.lookX);
  c.pitch = clamp(c.pitch - sim.input.lookY, CAMERA_CONST.pitch_min_deg, CAMERA_CONST.pitch_max_deg);
  sim.input.lookX = 0;
  sim.input.lookY = 0;

  // Shake: rotational only, seeded, decaying. Never positional, never roll.
  if (sim.frame < c.shakeUntil) {
    const k = (c.shakeUntil - sim.frame) / CAMERA_CONST.shake_max_frames;
    const decay = Math.pow(0.5, (CAMERA_CONST.shake_max_frames - (c.shakeUntil - sim.frame)) / CAMERA_CONST.shake_half_life_frames);
    c.shakeYaw = (rng.next() * 2 - 1) * c.shakeAmp * decay * k;
    c.shakePitch = (rng.next() * 2 - 1) * c.shakeAmp * decay * k;
  } else { c.shakeYaw = 0; c.shakePitch = 0; }

  recomputePose(sim, c);
}

function recomputePose(sim, c) {
  const p = sim.player.pos;
  // Zero-lag pivot. A constant height: no head-bob is enforced structurally, not by tuning.
  c.pivot[0] = p[0];
  c.pivot[1] = p[1] + CAMERA_CONST.pivot_height_m;
  c.pivot[2] = p[2];

  c.distTarget = CAMERA_CONST.arm_length_m;
  c.dist = c.distTarget;             // wave 1: no occluders to spring against yet
  c.fov = CAMERA_CONST.fov_deg;

  const yaw = (c.yaw + c.shakeYaw) * DEG;
  const pitch = (c.pitch + c.shakePitch) * DEG;
  const cp = Math.cos(pitch);
  c.pos[0] = c.pivot[0] - Math.sin(yaw) * cp * c.dist;
  c.pos[1] = c.pivot[1] - Math.sin(pitch) * c.dist;
  c.pos[2] = c.pivot[2] - Math.cos(yaw) * cp * c.dist;
  c.clipThrough = false;
}

function applyOverride(c) {
  const o = c.override;
  c.pos[0] = o.pos[0]; c.pos[1] = o.pos[1]; c.pos[2] = o.pos[2];
  c.pivot[0] = o.look[0]; c.pivot[1] = o.look[1]; c.pivot[2] = o.look[2];
  c.fov = o.fov;
  const dx = o.look[0] - o.pos[0], dy = o.look[1] - o.pos[1], dz = o.look[2] - o.pos[2];
  const flat = Math.hypot(dx, dz);
  c.yaw = norm360(Math.atan2(dx, dz) / DEG);
  c.pitch = Math.atan2(dy, flat) / DEG;
  c.dist = Math.hypot(dx, dy, dz);
  c.shakeYaw = 0; c.shakePitch = 0;
}

/** Called by damage resolution. Amplitude scales with the fraction of max hp taken. */
export function triggerShake(sim, hpFraction) {
  const c = sim.camera;
  c.shakeAmp = Math.min(CAMERA_CONST.shake_max_deg, CAMERA_CONST.shake_max_deg * hpFraction / 0.6);
  c.shakeUntil = sim.frame + CAMERA_CONST.shake_max_frames;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
