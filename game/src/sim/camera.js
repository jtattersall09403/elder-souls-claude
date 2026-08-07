// The third-person rig. Seam S18: this game is third-person ALWAYS, and this file is the
// only thing that decides where the camera is.
//
// It runs INSIDE the fixed 60 Hz step (RI-CAM06 §A) — that is why it lives in `sim/` and not
// in `render/`. The renderer reads the camera state and never writes it. There is no
// `deltaTime` on any path below; every smoothing constant is a per-frame alpha precomputed
// once from a half-life.
//
// ORDER OF OPERATIONS, fixed, and the reason each step is where it is:
//
//   1. mode           — RI-CAM05 §F's closed vocabulary. Everything else branches on it.
//   2. look           — RI-CAM02 §A. 1:1, lag 0, capped, surplus discarded, clamp after
//                        integration to the band the lock state selects (§B).
//   3. lock framing   — [CMB06] springs toward the aim point, then RI-CAM03 §C's CONTAINMENT
//                        LAW corrects the springs' TARGET (never their output — double
//                        smoothing is a named failure).
//   4. auto-recentre  — RI-CAM02 §E, gated behind 20 frames of committed sprinting and
//                        dropped the same frame the gate fails.
//   5. pivot          — RI-CAM01 §B. Rigid in XZ. Critically damped in Y. The asymmetry is
//                        not a taste: a springy XZ pivot makes strafing feel like ice and a
//                        rigid Y pivot pumps the view once per stair tread.
//   6. arm            — RI-CAM01 §C. Sphere cast from the PIVOT, pull-in 40 m/s, push-out
//                        3 m/s after a 6-frame dwell, penetration guard that ignores the
//                        rate limit because a rate limit is a smoothing device and never a
//                        correctness device.
//   7. pose + clip    — RI-CAM01 §D. `clip_through` is point containment of the camera origin
//                        and the four near-plane corners, tested against the same collision
//                        set the cast used.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO, each an automatic fail somewhere in RI-CAM01–07:
// no OrbitControls; no auto-yaw when the arm collides (the Elden-Ring corner behaviour, which
// RI-CAM01 §C.3 rejects by name); no FOV animation of any kind; no camera roll, ever; no
// positional shake; no head-bob (the pivot height is a constant, so there is nothing to bob);
// no first-person mode reachable by any input, option or API call.
'use strict';

import { rng } from '../core/rng.js';
import { EMPTY_CELL } from './collision.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** α for a critically damped per-frame ease, from a half-life in seconds, at 60 Hz.
 *
 *  RI-CAM06 §A states this formula AND a table of values. They disagree: the table was
 *  computed at dt = 0.010 s (100 Hz), not dt = 1/60 s. Worked — for T½ = 0.250 s the item
 *  prints 0.02734; 1 − 2^(−0.010/0.250) = 0.027187 and 1 − 2^(−(1/60)/0.250) = 0.045158.
 *  Every row of the table reproduces at dt = 0.010 to four decimal places and no row
 *  reproduces at 1/60. The FORMULA is what this build implements, because every bar that
 *  measures the smoothing measures the HALF-LIFE (RI-CAM02 M6, RI-CAM06 M7), and a table
 *  value from the wrong dt would miss those bars by 40%. Reported as a corpus defect. */
export function alphaFor(halfLifeSeconds) {
  return 1 - Math.pow(2, -(1 / 60) / halfLifeSeconds);
}

export const CAMERA_CONST = {
  // ---- rig geometry — RI-CAM01 §A -------------------------------------------------------
  pivot_height_m: 1.55,
  shoulder_right_free_m: 0.42,
  shoulder_up_free_m: 0.10,
  shoulder_right_locked_m: 0.26,
  shoulder_up_locked_m: 0.10,
  arm_free_m: 4.10,
  arm_locked_near_m: 3.60,
  arm_locked_far_m: 5.20,
  arm_locked_near_d_m: 4.0,
  arm_locked_far_d_m: 14.0,
  arm_max_m: 7.50,
  arm_min_m: 0.90,
  cast_radius_m: 0.28,
  cast_backoff_m: 0.02,
  fov_deg: 50.0,
  near_m: 0.10,
  far_m: 1200.0,
  aspect: 16 / 9,

  // ---- pitch-dependent arm scale — RI-CAM01 §A ------------------------------------------
  pitch_scale_down_at: -55.0, pitch_scale_down: 0.82,
  pitch_scale_up_at: 38.0, pitch_scale_up: 0.94,

  // ---- pivot follow — RI-CAM01 §B --------------------------------------------------------
  pivot_y_half_life_s: 0.250,
  pivot_y_half_life_air_s: 0.400,
  pivot_y_lag_clamp_m: 0.55,

  // ---- spring arm — RI-CAM01 §C ----------------------------------------------------------
  pull_in_m_per_frame: 40.0 / 60,
  push_out_m_per_frame: 3.0 / 60,
  push_out_dwell_frames: 6,
  fade_start_m: 1.30,
  fade_zero_m: 0.90,
  guard_radius_m: 0.18,
  arm_hard_min_m: 0.30,
  camera_to_head_min_m: 0.35,
  head_height_m: 1.66,

  // ---- look — RI-CAM02 §A/§B -------------------------------------------------------------
  look_cap_yaw_deg_per_frame: 30.0,
  look_cap_pitch_deg_per_frame: 20.0,
  pitch_min_deg: -55.0,
  pitch_max_deg: 38.0,
  pitch_min_locked_deg: -50.0,
  pitch_max_locked_deg: 32.0,

  // ---- auto-recentre — RI-CAM02 §E -------------------------------------------------------
  recentre_gate_frames: 20,
  recentre_speed_fraction: 0.90,
  recentre_forward_dominance: 0.70,
  recentre_yaw_half_life_s: 0.350,
  recentre_yaw_clamp_deg_per_frame: 90.0 / 60,
  recentre_pitch_target_deg: -6.0,
  recentre_pitch_half_life_s: 0.600,
  sprint_mps: 5.0,

  // ---- lock framing — [CMB06] §B + RI-CAM03 §C/§D ----------------------------------------
  lock_yaw_half_life_s: 0.120,
  lock_pitch_half_life_s: 0.180,
  lock_yaw_clamp_deg_per_frame: 7.0,
  safe_rect_x: 0.75,
  safe_rect_y: 0.70,
  contain_extend_m_per_frame: 0.150,
  contain_retract_m_per_frame: 0.080,
  contain_grab_m: 0.15,
  contain_release_m: 0.08,
  contain_pitch_deg_per_frame: 1.50,
  // The soft (target-left-the-safe-rect) driver's ceiling. Bounded so it cannot ratchet:
  // 5.20 m locked far ramp + 1.20 = 6.40 m worst case, short of the 7.50 m cap, which stays
  // reserved for the hard (anchor-off-screen) driver. See containment().
  contain_soft_cap_m: 1.20,
  contain_pitch_max_deg: 18.0,
  contain_pitch_soft_deg: 6.0,
  arm_half_life_s: 0.250,
  pitch_base_min_deg: -16.0,
  pitch_base_max_deg: -2.0,
  pitch_base_slope: 0.80,
  pitch_base_ref_d_m: 3.0,
  size_bias_per_m: 2.20,
  size_bias_ref_h_m: 2.5,
  aim_k_div_m: 4.0,
  aim_k_max: 0.75,
  aim_base_w: 0.35,
  aim_k_span: 0.65,
  chest_height_m: 1.38,

  // ---- outside the fight — RI-CAM05 §B/§C/§E ---------------------------------------------
  dialogue_yaw_max_deg: 12.0,
  dialogue_arm_max_m: 0.60,
  dialogue_frames: 12,
  rest_arm_m: 4.90,
  rest_pitch_deg: -12.0,
  rest_ease_frames: 30,

  // ---- feel — RI-CAM06 §G/§H/§I -----------------------------------------------------------
  shake_half_life_s: 0.080,
  shake_max_deg: 0.90,
  shake_max_frames: 12,
  death_arm_m: 5.20,
  death_pitch_deg: -22.0,
  death_ease_frames: 45,
  death_orbit_deg_per_frame: 0.100,
  death_orbit_until: 150,
  death_pitch_rate_deg_per_frame: 1.5,
  fog_frames: 90,
  fog_yaw_half_life_s: 0.180,
  fog_yaw_clamp_deg_per_frame: 90.0 / 60,
  fog_arm_m: 6.40,
  fog_arm_frames: 40,
};

/** RI-CAM05 §F: the closed `camera.mode` vocabulary. Anything else in a trace is a fail. */
export const CAMERA_MODES = ['free', 'locked', 'dialogue', 'menu', 'rest', 'death', 'fog_gate'];
/** RI-CAM05 §F: `listPerspectiveModes()` must return exactly this, and nothing may add to it. */
export const PERSPECTIVE_MODES = ['third'];

const A_PIVOT_Y = alphaFor(CAMERA_CONST.pivot_y_half_life_s);
const A_PIVOT_Y_AIR = alphaFor(CAMERA_CONST.pivot_y_half_life_air_s);
const A_LOCK_YAW = alphaFor(CAMERA_CONST.lock_yaw_half_life_s);
const A_LOCK_PITCH = alphaFor(CAMERA_CONST.lock_pitch_half_life_s);
const A_ARM = alphaFor(CAMERA_CONST.arm_half_life_s);
const A_RECENTRE_YAW = alphaFor(CAMERA_CONST.recentre_yaw_half_life_s);
const A_RECENTRE_PITCH = alphaFor(CAMERA_CONST.recentre_pitch_half_life_s);
const A_SHAKE = alphaFor(CAMERA_CONST.shake_half_life_s);
const A_FOG_YAW = alphaFor(CAMERA_CONST.fog_yaw_half_life_s);
export const CAMERA_ALPHAS = {
  '0.080': A_SHAKE, '0.120': A_LOCK_YAW, '0.180': A_LOCK_PITCH, '0.250': A_ARM,
  '0.350': A_RECENTRE_YAW, '0.400': A_PIVOT_Y_AIR, '0.600': A_RECENTRE_PITCH,
};

/** Near-plane corner radius: the distance from the camera origin to a corner of the near
 *  plane. The penetration guard's sphere is deliberately larger than this, which is what
 *  makes `clip_through == false` a structural property rather than a lucky one. */
export const NEAR_CORNER_R = (() => {
  const hh = CAMERA_CONST.near_m * Math.tan(CAMERA_CONST.fov_deg * DEG / 2);
  const hw = hh * CAMERA_CONST.aspect;
  return Math.sqrt(CAMERA_CONST.near_m ** 2 + hh ** 2 + hw ** 2);
})();

// Module-scope scratch. The fixed step allocates nothing (RI-PLT01 P4).
const _from = [0, 0, 0], _to = [0, 0, 0], _pt = [0, 0, 0];
const _fwd = [0, 0, 0], _right = [0, 0, 0], _up = [0, 0, 0];
const _aim = [0, 0, 0], _pchest = [0, 0, 0], _tchest = [0, 0, 0], _thead = [0, 0, 0];
const _ndc = [0, 0, 0];
/** The boom length this frame's sphere cast was run at — the reference the shoulder offset
 *  is measured against (see desiredPoint). Recomputed every frame; never state, never saved. */
let _castRef = CAMERA_CONST.arm_free_m;

export function stepCamera(sim) {
  const c = sim.camera;
  const cell = sim.cell || EMPTY_CELL;

  if (c.override) {
    applyOverride(c);
    sim.input.lookXConsumed = 0;
    sim.input.lookYConsumed = 0;
    evaluateClip(sim, c, cell);
    return;
  }

  // ---- hitstop — RI-CAM06 §F. The rig HOLDS. The look delta is BUFFERED, not dropped, and
  // is applied on the first non-hitstop frame (M6 differences Σ input.look against Σ Δyaw and
  // requires they agree to 0.01°, so dropping it is measurable).
  if (sim.hitstopUntil > sim.frame) {
    c.hitstop = true;
    c.lookBufX += sim.input.lookX;
    c.lookBufY += sim.input.lookY;
    sim.input.lookXConsumed = 0;
    sim.input.lookYConsumed = 0;
    sim.input.lookX = 0; sim.input.lookY = 0;
    stepShake(sim, c);
    return;
  }
  c.hitstop = false;

  const p = sim.player;
  const locked = p.lockOn !== null && p.lockOn !== undefined;
  resolveMode(sim, c, locked);

  const frozen = c.mode === 'menu' || c.mode === 'dialogue';

  // ---- 2. manual look ---------------------------------------------------------------------
  let dx = 0, dy = 0;
  if (!frozen && c.mode !== 'death' && c.mode !== 'fog_gate') {
    // The buffered hitstop delta is released here, on the first non-hitstop frame.
    const rawX = sim.input.lookX + c.lookBufX;
    const rawY = sim.input.lookY + c.lookBufY;
    c.lookBufX = 0; c.lookBufY = 0;
    dx = clamp(rawX, -CAMERA_CONST.look_cap_yaw_deg_per_frame, CAMERA_CONST.look_cap_yaw_deg_per_frame);
    dy = clamp(rawY, -CAMERA_CONST.look_cap_pitch_deg_per_frame, CAMERA_CONST.look_cap_pitch_deg_per_frame);
  } else {
    // RI-CAM05 §B/§C: look input is IGNORED, not buffered, while a panel is open; the same
    // holds through the death sequence and the fog gate's 90-frame lockout.
    c.lookBufX = 0; c.lookBufY = 0;
  }
  sim.input.lookXConsumed = dx;
  sim.input.lookYConsumed = dy;
  c.lookActive = (dx !== 0 || dy !== 0);
  sim.input.lookX = 0; sim.input.lookY = 0;

  if (c.mode === 'locked') {
    lockOrientation(sim, c, dx, dy);
    c.recentreFrames = 0; c.recentreActive = false;
  } else if (c.mode === 'fog_gate') {
    fogOrientation(sim, c);
  } else if (c.mode === 'death') {
    deathOrientation(sim, c);
  } else {
    c.yaw = norm360(c.yaw + dx);
    c.pitch = clampPitch(c.pitch - dy, false);
    if (c.mode === 'rest') {
      c.pitch += (CAMERA_CONST.rest_pitch_deg - c.pitch) / CAMERA_CONST.rest_ease_frames;
    }
    if (c.mode === 'free') autoRecentre(sim, c, dx, dy);
    else { c.recentreFrames = 0; c.recentreActive = false; }
  }
  stepDialogueAccommodation(sim);

  stepShake(sim, c);

  // ---- 5. pivot ---------------------------------------------------------------------------
  // RI-CAM06 §H: on death the pivot DETACHES and holds its last world position.
  //
  // RI-CAM05 §B/§C: in `dialogue` and `menu` the camera POSE is frozen — "Σ|Δcamera.pos| ≤
  // 0.001 m ... for the whole time any menu is open". Freezing only the angles is not enough
  // and the probe proved it: with the world still simulating (S14 forbids a combat pause), the
  // character walked, the rigid XZ pivot followed, and the world camera drifted 13.5 m over
  // 300 menu frames. The pivot detaches for the same reason it detaches on death, and by the
  // same mechanism, so there is still exactly one camera in this build.
  if (c.mode !== 'death' && !frozen) {
    c.pivot[0] = p.pos[0];
    c.pivot[2] = p.pos[2];
    const want = p.pos[1] + CAMERA_CONST.pivot_height_m;
    if (c.pivotSnap) { c.pivot[1] = want; c.pivotSnap = false; } else {
      const a = p.grounded === false ? A_PIVOT_Y_AIR : A_PIVOT_Y;
      c.pivot[1] += (want - c.pivot[1]) * a;
      const lag = want - c.pivot[1];
      if (lag > CAMERA_CONST.pivot_y_lag_clamp_m) c.pivot[1] = want - CAMERA_CONST.pivot_y_lag_clamp_m;
      else if (lag < -CAMERA_CONST.pivot_y_lag_clamp_m) c.pivot[1] = want + CAMERA_CONST.pivot_y_lag_clamp_m;
    }
  }

  // ---- 6. arm -----------------------------------------------------------------------------
  solveArm(sim, c, cell);

  // ---- 7. pose ----------------------------------------------------------------------------
  writePose(c);
  evaluateClip(sim, c, cell);
  c.charOpacity = fadeOpacity(c.armLen);
  if (c.mode === 'locked') measureOnScreen(sim, c);
  else clearOnScreen(c);
}

// =========================================================================================
// mode
// =========================================================================================
function resolveMode(sim, c, locked) {
  if (c.uiMode === 'menu') { c.mode = 'menu'; return; }
  if (c.uiMode === 'dialogue') { c.mode = 'dialogue'; return; }
  // `!== -1` and not `>= 0`. -1 is the sentinel; every other value is a frame index. A save
  // taken during the death sequence rebases that index against a frame counter that
  // `loadState()` resets to 0 (RI-MTH01 A07), so a death that began before the save comes
  // back NEGATIVE — still a death, and `sim.frame - c.deathFrame` in deathOrientation() is
  // still the correct elapsed count. `>= 0` silently cancelled it.
  if (c.deathFrame !== -1) { c.mode = 'death'; return; }
  if (c.fogUntil > sim.frame) { c.mode = 'fog_gate'; return; }
  if (c.uiMode === 'rest') { c.mode = 'rest'; return; }
  c.mode = locked ? 'locked' : 'free';
}

// =========================================================================================
// lock — [CMB06] springs, then RI-CAM03 §C containment, which corrects the springs' TARGET
// =========================================================================================
function lockOrientation(sim, c, dx, dy) {
  const t = sim.findEntity(sim.player.lockOn);
  if (!t) { c.yaw = norm360(c.yaw + dx); c.pitch = clampPitch(c.pitch - dy, true); return; }
  const p = sim.player;

  const h = targetHeight(sim, t);
  const ddx = t.pos[0] - p.pos[0], ddz = t.pos[2] - p.pos[2];
  const d = Math.sqrt(ddx * ddx + ddz * ddz);
  c.lockDist = d;
  c.lockHeight = h;

  aimPoint(sim, p, t, h, _aim);

  // Yaw/pitch targets from the aim point, measured FROM THE CAMERA'S CURRENT POSITION —
  // which is what closes the loop between the containment correction (which moves the
  // camera) and the orientation that has to keep both anchors inside the frame.
  const ax = _aim[0] - c.pos[0], ay = _aim[1] - c.pos[1], az = _aim[2] - c.pos[2];
  const flat = Math.sqrt(ax * ax + az * az);
  const yawT = norm360(Math.atan2(ax, az) * RAD);
  let pitchT = Math.atan2(ay, flat) * RAD;

  // §D: distance- and size-dependent pitch, and §C step 5's containment correction, are both
  // applied to the spring TARGET. Never to its output — that is the double-smoothing failure.
  pitchT += pitchBias(d, h);
  pitchT += c.containPitch;

  // THE SPRING ALONE CANNOT SATISFY §E, AND THE ARITHMETIC SAYS SO.
  //
  // A first-order ease lags a constantly-moving target by (rate / α) in steady state. The
  // [CMB06] yaw half-life is 0.120 s, so α = 0.0904 per frame, and RI-CAM03 M3's adversarial
  // target orbits the player at 300 °/s = 5.00 °/frame. Steady-state lag = 5.00 / 0.0904 =
  // 55.3°. The vertical FOV is 50.0° at 16:9, so the horizontal half-angle is 42.8° — the
  // target is not merely outside the safe rect, it is off the screen entirely. The first full
  // probe run measured exactly that: onscreen_fraction(T_a) of 0.61, 0.35, 0.83, 0.57 across
  // the scenarios, against a 0.995 bar.
  //
  // §C's priority order is the resolution: "(1) T_a on screen ... It never sacrifices (1) or
  // (2)." And [CMB06]'s 7.000 °/frame is a CLAMP — a ceiling on what the camera may do, not a
  // budget it must leave unspent. So the spring runs at its declared half-life while the
  // framing holds, and hands over to the clamp as the target approaches the frame edge.
  //
  // `catchUp` is 0 while the target is inside the safe rect (so RI-CMB06 M5, which measures
  // the 0.120 s half-life, sees an untouched spring), and ramps to 1 as the anchor travels
  // from the safe rect edge to the frame edge. At 1 the camera turns at the full clamp. There
  // is no second smoothing stage anywhere on this path: the blend is on the STEP, evaluated
  // once, which is what keeps §C's "correction is smoothed once" true.
  const err = angle180(yawT - c.yaw);
  const cl = CAMERA_CONST.lock_yaw_clamp_deg_per_frame;
  // If the anchor is already off screen — or behind the near plane, where the projection has
  // no meaningful NDC to report — the catch-up is full. Reading a projected x of 0 for an
  // anchor that is behind the camera would hand back the spring's slowest response at the one
  // moment the framing has already failed.
  const excursion = Math.abs(c.onscreen.tNdc[0]);
  const catchUp = c.onscreen.t
    ? clamp((excursion - CAMERA_CONST.safe_rect_x) / (1 - CAMERA_CONST.safe_rect_x), 0, 1)
    : 1;
  const a = A_LOCK_YAW + (1 - A_LOCK_YAW) * catchUp;
  let dyaw = err * a;
  if (dyaw > cl) dyaw = cl; else if (dyaw < -cl) dyaw = -cl;
  c.yaw = norm360(c.yaw + dyaw);
  c.yawRate = Math.abs(dyaw);

  const dp = (pitchT - c.pitch) * A_LOCK_PITCH;
  c.pitch = clampPitch(c.pitch + dp, true);
}

function aimPoint(sim, p, t, h, out) {
  // RI-CAM03 §D: the aim point's Y shifts toward the target's HEAD for large targets; XZ
  // keeps [CMB06]'s constant 0.35 lerp.
  const k = clamp((h - CAMERA_CONST.size_bias_ref_h_m) / CAMERA_CONST.aim_k_div_m, 0, CAMERA_CONST.aim_k_max);
  const wy = CAMERA_CONST.aim_base_w + k * CAMERA_CONST.aim_k_span;
  const pcy = p.pos[1] + CAMERA_CONST.chest_height_m;
  const tcy = t.pos[1] + h * 0.72;                 // chest node
  const thy = t.pos[1] + h * 0.94;                 // head / topmost tell-bearing node
  out[0] = p.pos[0] + (t.pos[0] - p.pos[0]) * CAMERA_CONST.aim_base_w;
  out[2] = p.pos[2] + (t.pos[2] - p.pos[2]) * CAMERA_CONST.aim_base_w;
  out[1] = pcy + ((k > 0 ? thy : tcy) - pcy) * wy + 0.25;
}

function pitchBias(d, h) {
  const base = clamp(
    CAMERA_CONST.pitch_base_min_deg + CAMERA_CONST.pitch_base_slope * (d - CAMERA_CONST.pitch_base_ref_d_m),
    CAMERA_CONST.pitch_base_min_deg, CAMERA_CONST.pitch_base_max_deg);
  const size = CAMERA_CONST.size_bias_per_m * Math.max(0, h - CAMERA_CONST.size_bias_ref_h_m);
  return base + size;
}
export { pitchBias };

/** Target collision height. Declared per enemy in `game/data/camera/targets.json`, because
 *  RI-CAM03 §D's `size_bias(h)` is a function of it and a camera that guesses the height of
 *  the thing it is framing has an unfalsifiable boss camera. */
function targetHeight(sim, t) {
  const table = sim.cameraTargets;
  if (table && t.archetype_id && table[t.archetype_id] !== undefined) return table[t.archetype_id];
  if (t.height_m) return t.height_m;
  return (table && table._default) || 1.9;
}

// =========================================================================================
// RI-CAM03 §C — THE CONTAINMENT LAW. Both fighters stay framed; the arm and the pitch bias
// are the two knobs and they move at bounded rates, so nothing whips.
// =========================================================================================
function containment(sim, c, armWant) {
  const t = sim.findEntity(sim.player.lockOn);
  if (!t) { c.containArm = 0; c.containPitch = 0; return armWant; }
  const p = sim.player;
  const h = c.lockHeight;

  // Anchors are projected with the pose the player was shown last frame. Projecting the pose
  // we are about to compute would require the arm we are computing.
  _pchest[0] = p.pos[0]; _pchest[1] = p.pos[1] + CAMERA_CONST.chest_height_m; _pchest[2] = p.pos[2];
  _tchest[0] = t.pos[0]; _tchest[1] = t.pos[1] + h * 0.72; _tchest[2] = t.pos[2];

  const pOk = project(c, _pchest, _ndc);
  const pOn = pOk && Math.abs(_ndc[0]) <= 1 && Math.abs(_ndc[1]) <= 1;
  const pIn = pOk && Math.abs(_ndc[0]) <= CAMERA_CONST.safe_rect_x && Math.abs(_ndc[1]) <= CAMERA_CONST.safe_rect_y;
  const pY = _ndc[1];
  const tOk = project(c, _tchest, _ndc);
  const tOn = tOk && Math.abs(_ndc[0]) <= 1 && Math.abs(_ndc[1]) <= 1;
  const tIn = tOk && Math.abs(_ndc[0]) <= CAMERA_CONST.safe_rect_x && Math.abs(_ndc[1]) <= CAMERA_CONST.safe_rect_y;
  const tY = _ndc[1];

  // TWO DRIVERS, NOT ONE, AND THIS IS THE MOST CONSEQUENTIAL DECISION IN THE FILE.
  //
  // §C step 5 reads "if P_a outside safe_rect OR T_a outside safe_rect: arm_want += 0.15 (per
  // frame, cumulative)". Implemented literally that is a ratchet, and against a large boss it
  // runs to the 7.50 m cap and stays there — which is RI-CAM03's own *How we lose* #5, the
  // strategy-game camera, the failure the 7.50 m cap exists to prevent.
  //
  // It is not a hypothetical. Measured off the reference clip
  // (game/data/camera/reference-framing.json, conclusion R2 — Elden Ring, Godrick, 60 fps,
  // five sampled frames): the PLAYER anchor sits at NDC y between −0.40 and −0.75 for the
  // whole fight, i.e. outside the ±0.70 safe rect much of the time, on screen throughout, and
  // the upstream camera never extends its boom to bring it back in.
  //
  // The item's own text resolves it, in two places:
  //   1. §C's priority order — "(1) T_a on screen, (2) P_a on screen, (3) T_h on screen,
  //      (4) anchors inside safe_rect. It never sacrifices (1) or (2)." Safe-rect containment
  //      is the LOWEST priority, and the two on-screen guarantees are the hard ones.
  //   2. §E's measurables — there is a `fraction(T_a ∈ safe_rect) ≥ 0.960` bar and there is
  //      NO safe-rect bar on P_a anywhere in the item. The player gets an on-screen bar
  //      (≥ 0.980) and nothing else.
  //
  // So: losing an anchor OFF SCREEN is the hard driver and may grab the full arm range.
  // The TARGET leaving the safe rect is a soft driver, bounded so it cannot ratchet. The
  // PLAYER low in the frame but on screen is not a fault at all — it is the reference framing.
  const hard = !pOn || !tOn;
  const soft = !tIn;

  if (hard) {
    c.containArm += CAMERA_CONST.contain_grab_m;
    const side = (!tOn ? (tY > 0 ? 1 : -1) : (pY > 0 ? 1 : -1));
    c.containPitch = clamp(c.containPitch + side * CAMERA_CONST.contain_pitch_deg_per_frame,
      -CAMERA_CONST.contain_pitch_max_deg, CAMERA_CONST.contain_pitch_max_deg);
  } else if (soft) {
    c.containArm = Math.min(c.containArm + CAMERA_CONST.contain_grab_m, CAMERA_CONST.contain_soft_cap_m);
    c.containPitch = clamp(c.containPitch + (tY > 0 ? 1 : -1) * CAMERA_CONST.contain_pitch_deg_per_frame,
      -CAMERA_CONST.contain_pitch_soft_deg, CAMERA_CONST.contain_pitch_soft_deg);
  } else if (c.containArm > 0 || c.containPitch !== 0) {
    c.containArm = Math.max(0, c.containArm - CAMERA_CONST.contain_release_m);
    c.containPitch *= 0.94;                        // release, slower than grab
    if (Math.abs(c.containPitch) < 0.01) c.containPitch = 0;
  }
  c.containArm = Math.min(c.containArm, CAMERA_CONST.arm_max_m);
  return armWant + c.containArm;
}

// =========================================================================================
// RI-CAM02 §E — auto-recentre. 20 frames of committed sprinting to arm, zero frames to disarm.
// =========================================================================================
function autoRecentre(sim, c, dx, dy) {
  const p = sim.player;
  const s = sim.input;
  const mag = Math.sqrt(s.moveX * s.moveX + s.moveY * s.moveY);
  const forwardDominant = mag > 1e-6 && s.moveY >= CAMERA_CONST.recentre_forward_dominance * mag;
  const gate = p.state === 'SPRINT'
    && p.speedMps >= CAMERA_CONST.recentre_speed_fraction * CAMERA_CONST.sprint_mps
    && forwardDominant
    && dx === 0 && dy === 0
    && p.grounded !== false
    && (p.lockOn === null || p.lockOn === undefined)
    && p.moveData === null;

  if (!gate) { c.recentreFrames = 0; c.recentreActive = false; return; }
  c.recentreFrames++;
  if (c.recentreFrames <= CAMERA_CONST.recentre_gate_frames) { c.recentreActive = false; return; }
  c.recentreActive = true;

  let d = angle180(p.yaw - c.yaw) * A_RECENTRE_YAW;
  const cl = CAMERA_CONST.recentre_yaw_clamp_deg_per_frame;
  if (d > cl) d = cl; else if (d < -cl) d = -cl;
  c.yaw = norm360(c.yaw + d);
  c.pitch = clampPitch(c.pitch + (CAMERA_CONST.recentre_pitch_target_deg - c.pitch) * A_RECENTRE_PITCH, false);
}

// =========================================================================================
// RI-CAM01 §C — the spring arm.
// =========================================================================================
function solveArm(sim, c, cell) {
  const mode = c.mode;
  let want;
  if (mode === 'locked') {
    const d = c.lockDist;
    const k = clamp((d - CAMERA_CONST.arm_locked_near_d_m)
      / (CAMERA_CONST.arm_locked_far_d_m - CAMERA_CONST.arm_locked_near_d_m), 0, 1);
    want = CAMERA_CONST.arm_locked_near_m + k * (CAMERA_CONST.arm_locked_far_m - CAMERA_CONST.arm_locked_near_m);
    want = containment(sim, c, want);
  } else if (mode === 'rest') {
    want = CAMERA_CONST.rest_arm_m;
    c.containArm = 0; c.containPitch = 0;
  } else if (mode === 'death') {
    want = CAMERA_CONST.death_arm_m;
  } else if (mode === 'fog_gate') {
    want = CAMERA_CONST.fog_arm_m;
  } else {
    want = CAMERA_CONST.arm_free_m + c.dialogueArm;
    c.containArm = 0; c.containPitch = 0;
  }
  want *= pitchArmScale(c.pitch);
  want = clamp(want, CAMERA_CONST.arm_min_m, CAMERA_CONST.arm_max_m);
  c.armDesired = want;

  // The arm-length TARGET eases under lock and in the two scripted states (RI-CAM03 §C step
  // 8; RI-CAM06 §H/§I), rate-clamped. Free-camera arm length is not eased: the desired
  // length is a constant, so an ease would only add a lag with nothing to lag behind.
  let target = want;
  if (mode === 'locked' || mode === 'death' || mode === 'fog_gate' || mode === 'rest') {
    let step = (want - c.armEased) * A_ARM;
    const ex = CAMERA_CONST.contain_extend_m_per_frame, re = CAMERA_CONST.contain_retract_m_per_frame;
    if (step > ex) step = ex; else if (step < -re) step = -re;
    c.armEased += step;
    target = c.armEased;
  } else {
    c.armEased = want;
  }

  // The desired camera POINT includes the shoulder offset (RI-CAM01 §C step 2), so the sphere
  // cast runs along the ray the camera actually travels along rather than a parallel one.
  const sr = mode === 'locked' ? CAMERA_CONST.shoulder_right_locked_m : CAMERA_CONST.shoulder_right_free_m;
  const su = mode === 'locked' ? CAMERA_CONST.shoulder_up_locked_m : CAMERA_CONST.shoulder_up_free_m;
  c.shoulderR = sr; c.shoulderU = su;

  _from[0] = c.pivot[0]; _from[1] = c.pivot[1]; _from[2] = c.pivot[2];
  _castRef = target;
  desiredPoint(c, target, sr, su, _to, _castRef);

  const tHit = cell.sphereCast(_from, _to, CAMERA_CONST.cast_radius_m);
  c.armHit = tHit < 1;
  let safe;
  if (c.armHit) {
    const segLen = Math.sqrt((_to[0] - _from[0]) ** 2 + (_to[1] - _from[1]) ** 2 + (_to[2] - _from[2]) ** 2);
    const along = segLen * tHit - CAMERA_CONST.cast_backoff_m;
    safe = target * (along / Math.max(segLen, 1e-6));
  } else safe = target;
  c.armCast = safe;
  safe = clamp(safe, CAMERA_CONST.arm_min_m, CAMERA_CONST.arm_max_m);

  // Rate limit — RI-CAM01 §C's table. Pull-in is 13.3× push-out, and push-out waits out a
  // 6-frame dwell so that brushing a pillar row cannot make the arm pump.
  if (safe < c.armLen) {
    c.armLen -= Math.min(c.armLen - safe, CAMERA_CONST.pull_in_m_per_frame);
    c.clearFrames = 0;
  } else if (safe > c.armLen) {
    if (c.armHit) c.clearFrames = 0; else c.clearFrames++;
    if (c.clearFrames > CAMERA_CONST.push_out_dwell_frames) {
      c.armLen += Math.min(safe - c.armLen, CAMERA_CONST.push_out_m_per_frame);
    }
  } else if (!c.armHit) c.clearFrames++;
  else c.clearFrames = 0;

  // ---- penetration guard — §C step 7. Unbounded, same frame, ignoring the rate limit AND
  // step 5's 0.90 m floor, because step 7 comes after step 5 and correctness wins over
  // smoothing. Every frame it fires is flagged, which is the flag RI-CAM01 M4 already names.
  c.armGuard = false;
  desiredPoint(c, c.armLen, sr, su, _pt, _castRef);
  if (cell !== EMPTY_CELL && cell.distance(_pt[0], _pt[1], _pt[2]) < CAMERA_CONST.guard_radius_m) {
    desiredPoint(c, c.armDesired, sr, su, _to, c.armDesired);
    const tg = cell.sphereCast(_from, _to, CAMERA_CONST.guard_radius_m);
    let g = c.armDesired * tg - 0.005;
    // THE 0.90 m FLOOR IS ABSOLUTE. RI-CAM01 §A calls it "arm length, absolute min (collision)
    // [CMB06]", and RI-CAM05 §F makes it an invariant "on every frame of every state, forever"
    // whose breach is "an automatic fail of the piece, whatever it is called in the build".
    //
    // §C step 7's penetration guard is "unbounded, same frame" — but read the sentence it is
    // in: "The rate limit is a smoothing device, never a correctness device." What step 7
    // overrides is step 6's RATE LIMIT, not step 5's clamp. This build previously let the
    // guard drive to `arm_hard_min_m` = 0.30 m, and the first full probe run duly reported
    // min arm_len 0.3499 m on two of the three worst routes. That is the automatic fail.
    //
    // The consequence is stated rather than hidden: in a space too tight for a 0.90 m boom the
    // camera now STAYS at 0.90 m and `clip_through` may go true. That is the correct failure —
    // it is visible, it is counted, and RI-CAM05 §D's answer to it is architectural (a wider
    // corridor), not a shorter arm.
    const dyHead = CAMERA_CONST.head_height_m - CAMERA_CONST.pivot_height_m - su;
    const headMin = Math.sqrt(Math.max(0, CAMERA_CONST.camera_to_head_min_m ** 2 - dyHead * dyHead));
    g = clamp(g, Math.max(CAMERA_CONST.arm_min_m, headMin), c.armLen);
    if (g < c.armLen) { c.armLen = g; c.armGuard = true; }
  }
  c.dist = c.armLen;
  c.distTarget = c.armDesired;
}

/** The camera point for a boom of `len`, with the shoulder offset applied at the camera end.
 *
 *  THE SHOULDER IS CONSTANT. RI-CAM01 §A fixes it at +0.42 / +0.10 m (free) and +0.26 / +0.10
 *  (locked) in the camera basis, and §C step 2 writes the desired point as
 *  `pivot + (−forward · desired_len) + shoulder_offset` with no scale term. M1's static census
 *  fails a build that reports anything else.
 *
 *  This build previously scaled the shoulder by `len / 4.10`, which meant the census read
 *  0.42 only at pitch 0 and unlocked — at −55° the pitch-dependent arm scale alone shrank it
 *  to 0.344, and under lock at 3.60 m to 0.369. The scale existed for a real reason: when
 *  collision shortens the boom, a fixed shoulder moves the camera OFF the ray the sphere cast
 *  just cleared, and it can land in the wall beside it.
 *
 *  Both are satisfied by scaling against the length the cast was run at rather than against
 *  the free arm. Unobstructed, `len == castRef` and the shoulder is exactly its declared value
 *  at every pitch, in every mode. Obstructed, the camera slides along the cleared ray, which
 *  is what the cast measured in the first place. */
function desiredPoint(c, len, sr, su, out, castRef) {
  basis(c, _fwd, _right, _up);
  const ref = castRef === undefined ? len : castRef;
  const s = ref > 1e-6 ? Math.min(1, len / ref) : 1;
  out[0] = c.pivot[0] - _fwd[0] * len + (_right[0] * sr + _up[0] * su) * s;
  out[1] = c.pivot[1] - _fwd[1] * len + (_right[1] * sr + _up[1] * su) * s;
  out[2] = c.pivot[2] - _fwd[2] * len + (_right[2] * sr + _up[2] * su) * s;
}

function pitchArmScale(pitch) {
  if (pitch < 0) {
    const k = clamp(pitch / CAMERA_CONST.pitch_scale_down_at, 0, 1);
    return 1.0 + k * (CAMERA_CONST.pitch_scale_down - 1.0);
  }
  const k = clamp(pitch / CAMERA_CONST.pitch_scale_up_at, 0, 1);
  return 1.0 + k * (CAMERA_CONST.pitch_scale_up - 1.0);
}
export { pitchArmScale };

/** RI-CAM01 §C: a dither fade on the MATERIAL, not a mesh toggle, and the shadow is retained
 *  at full opacity throughout — which is how the player still reads their own animation with
 *  their body faded. The renderer consumes this number; it never decides it. */
function fadeOpacity(len) {
  if (len >= CAMERA_CONST.fade_start_m) return 1.0;
  if (len <= CAMERA_CONST.fade_zero_m) return 0.0;
  return (len - CAMERA_CONST.fade_zero_m) / (CAMERA_CONST.fade_start_m - CAMERA_CONST.fade_zero_m);
}
export { fadeOpacity };

// =========================================================================================
// pose, projection, clipping
// =========================================================================================
/** The RIG basis: the camera's own yaw and pitch, with NO shake.
 *
 *  RI-CAM06 §G: the shake is "rotational only ... applied AFTER the rig, BEFORE the
 *  projection. Never positional", and its effect on `camera.pos` is "none. Σ|Δcamera.pos|
 *  attributable to shake = 0." Folding the shake into this basis makes `desiredPoint` build
 *  the camera POSITION from a shaken forward vector, which is a positional shake wearing a
 *  rotational coat — and the probe measured 0.277 m of it over twenty 12-frame events.
 *  Positional shake is an automatic fail of RI-CAM06 and it also pushes the camera into the
 *  geometry RI-CAM01's collision step already resolved. */
function basis(c, fwd, right, up) { basisAt(c.yaw, c.pitch, fwd, right, up); }

/** The VIEW basis: the rig's angles plus the shake. Used for projection and for the
 *  near-plane clip test — what the player sees — and never for placing the camera. */
function viewBasis(c, fwd, right, up) { basisAt(c.yaw + c.shakeYaw, c.pitch + c.shakePitch, fwd, right, up); }

function basisAt(yawDeg, pitchDeg, fwd, right, up) {
  const yaw = yawDeg * DEG;
  const pitch = pitchDeg * DEG;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  fwd[0] = Math.sin(yaw) * cp; fwd[1] = sp; fwd[2] = Math.cos(yaw) * cp;
  right[0] = Math.cos(yaw); right[1] = 0; right[2] = -Math.sin(yaw);
  up[0] = right[1] * fwd[2] - right[2] * fwd[1];
  up[1] = right[2] * fwd[0] - right[0] * fwd[2];
  up[2] = right[0] * fwd[1] - right[1] * fwd[0];
}
export { basis as cameraBasis, viewBasis as cameraViewBasis };

function writePose(c) {
  desiredPoint(c, c.armLen, c.shoulderR, c.shoulderU, _pt, _castRef);
  c.pos[0] = _pt[0]; c.pos[1] = _pt[1]; c.pos[2] = _pt[2];
  c.fov = CAMERA_CONST.fov_deg;                  // one constant, every state, forever
}

/** RI-CAM01 §D. `clip_through` is true iff the camera origin OR any of the four near-plane
 *  corners lies inside solid world collision. Not a heuristic, not "does it look wrong". */
function evaluateClip(sim, c, cell) {
  if (cell === EMPTY_CELL) { c.clipThrough = false; return; }
  if (cell.contains(c.pos[0], c.pos[1], c.pos[2])) { c.clipThrough = true; return; }
  viewBasis(c, _fwd, _right, _up);
  const hh = CAMERA_CONST.near_m * Math.tan(CAMERA_CONST.fov_deg * DEG / 2);
  const hw = hh * CAMERA_CONST.aspect;
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      const x = c.pos[0] + _fwd[0] * CAMERA_CONST.near_m + _right[0] * hw * sx + _up[0] * hh * sy;
      const y = c.pos[1] + _fwd[1] * CAMERA_CONST.near_m + _right[1] * hw * sx + _up[1] * hh * sy;
      const z = c.pos[2] + _fwd[2] * CAMERA_CONST.near_m + _right[2] * hw * sx + _up[2] * hh * sy;
      if (cell.contains(x, y, z)) { c.clipThrough = true; return; }
    }
  }
  c.clipThrough = false;
}

/** NDC projection of a world point. Returns true when in front of the near plane. */
function project(c, world, out) {
  viewBasis(c, _fwd, _right, _up);
  const dx = world[0] - c.pos[0], dy = world[1] - c.pos[1], dz = world[2] - c.pos[2];
  const z = dx * _fwd[0] + dy * _fwd[1] + dz * _fwd[2];
  if (z <= CAMERA_CONST.near_m) { out[0] = 0; out[1] = 0; out[2] = z; return false; }
  const xr = dx * _right[0] + dy * _right[1] + dz * _right[2];
  const yu = dx * _up[0] + dy * _up[1] + dz * _up[2];
  const tanHalf = Math.tan(CAMERA_CONST.fov_deg * DEG / 2);
  out[0] = xr / (z * tanHalf * CAMERA_CONST.aspect);
  out[1] = yu / (z * tanHalf);
  out[2] = z;
  return true;
}
export { project as projectNDC };

/** RI-CAM03 §E's measurables, emitted every locked frame so the containment law is a
 *  statistic a critic computes rather than a claim a builder makes. */
function measureOnScreen(sim, c) {
  const t = sim.findEntity(sim.player.lockOn);
  const p = sim.player;
  if (!t) { clearOnScreen(c); return; }
  const h = c.lockHeight;
  _pchest[0] = p.pos[0]; _pchest[1] = p.pos[1] + CAMERA_CONST.chest_height_m; _pchest[2] = p.pos[2];
  _tchest[0] = t.pos[0]; _tchest[1] = t.pos[1] + h * 0.72; _tchest[2] = t.pos[2];
  _thead[0] = t.pos[0]; _thead[1] = t.pos[1] + h * 0.94; _thead[2] = t.pos[2];
  const o = c.onscreen;
  o.p = anchor(c, _pchest, o.pNdc);
  o.t = anchor(c, _tchest, o.tNdc);
  o.th = anchor(c, _thead, o.thNdc);
  o.pSafe = o.p && Math.abs(o.pNdc[0]) <= CAMERA_CONST.safe_rect_x && Math.abs(o.pNdc[1]) <= CAMERA_CONST.safe_rect_y;
  o.tSafe = o.t && Math.abs(o.tNdc[0]) <= CAMERA_CONST.safe_rect_x && Math.abs(o.tNdc[1]) <= CAMERA_CONST.safe_rect_y;
  // [CMB06]'s vertical framing band, as a fraction of screen height measured from the top.
  o.tBandY = o.t ? (1 - o.tNdc[1]) * 0.5 : -1;
  o.tBand = o.t && o.tBandY >= 0.38 && o.tBandY <= 0.62;
  o.both = o.p && o.t;
}

function anchor(c, world, out) {
  const ok = project(c, world, _ndc);
  out[0] = _ndc[0]; out[1] = _ndc[1];
  return ok && Math.abs(_ndc[0]) <= 1 && Math.abs(_ndc[1]) <= 1;
}

function clearOnScreen(c) {
  const o = c.onscreen;
  o.p = false; o.t = false; o.th = false; o.pSafe = false; o.tSafe = false;
  o.both = false; o.tBand = false; o.tBandY = -1;
  o.pNdc[0] = 0; o.pNdc[1] = 0; o.tNdc[0] = 0; o.tNdc[1] = 0; o.thNdc[0] = 0; o.thNdc[1] = 0;
}

// =========================================================================================
// scripted camera states — RI-CAM06 §H/§I. THE SAME RIG, driven to a different target.
// There is no second camera object anywhere in this build, which is what makes §I's
// reproducibility test passable at all.
// =========================================================================================
function deathOrientation(sim, c) {
  const k = sim.frame - c.deathFrame;
  if (k <= CAMERA_CONST.death_ease_frames) {
    let dp = (CAMERA_CONST.death_pitch_deg - c.pitch) * A_ARM;
    const r = CAMERA_CONST.death_pitch_rate_deg_per_frame;
    if (dp > r) dp = r; else if (dp < -r) dp = -r;
    c.pitch = clampPitch(c.pitch + dp, false);
  }
  if (k <= CAMERA_CONST.death_orbit_until) c.yaw = norm360(c.yaw + CAMERA_CONST.death_orbit_deg_per_frame);
}

function fogOrientation(sim, c) {
  const t = (c.fogTarget !== null && c.fogTarget !== undefined) ? sim.findEntity(c.fogTarget) : null;
  if (!t) return;
  const p = sim.player;
  const dx = t.pos[0] - p.pos[0], dz = t.pos[2] - p.pos[2];
  const yawT = norm360(Math.atan2(dx, dz) * RAD);
  let d = angle180(yawT - c.yaw) * A_FOG_YAW;
  const cl = CAMERA_CONST.fog_yaw_clamp_deg_per_frame;
  if (d > cl) d = cl; else if (d < -cl) d = -cl;
  c.yaw = norm360(c.yaw + d);
  const h = targetHeight(sim, t);
  const pitchT = clamp(pitchBias(Math.sqrt(dx * dx + dz * dz), h),
    CAMERA_CONST.pitch_min_deg, CAMERA_CONST.pitch_max_deg);
  c.pitch = clampPitch(c.pitch + (pitchT - c.pitch) * A_LOCK_PITCH, false);
}

// =========================================================================================
// shake — RI-CAM06 §G. Rotational only, seeded, decaying, 12 frames hard, never positional,
// never roll. It is applied to the BASIS, so it moves the frame without moving the arm and
// `Σ|Δcamera.pos|` attributable to shake is exactly 0.
// =========================================================================================
function stepShake(sim, c) {
  if (sim.frame < c.shakeUntil) {
    c.shakeAge++;
    const decay = Math.pow(1 - A_SHAKE, c.shakeAge);
    c.shakeYaw = (rng.next() * 2 - 1) * c.shakeAmp * decay;
    c.shakePitch = (rng.next() * 2 - 1) * c.shakeAmp * decay;
  } else if (c.shakeYaw !== 0 || c.shakePitch !== 0) {
    c.shakeYaw = 0; c.shakePitch = 0; c.shakeAge = 0;
  }
}

/** Called by damage resolution when the PLAYER takes damage. Never on block, parry, enemy
 *  death or landing (RI-CAM06 §G). */
export function triggerShake(sim, hpFraction) {
  const c = sim.camera;
  c.shakeAmp = CAMERA_CONST.shake_max_deg * Math.min(1, hpFraction / 0.25);
  c.shakeUntil = sim.frame + CAMERA_CONST.shake_max_frames;
  c.shakeAge = 0;
}

// =========================================================================================
// state transitions the harness and the game drive
// =========================================================================================
export function openUI(sim, kind, npcHeadNdcX) {
  const c = sim.camera;
  const wasDialogue = c.uiMode === 'dialogue';
  c.uiMode = kind;
  // RI-CAM05 §B: the accommodation fires "once, at open. Never again, not on a topic change,
  // not on a new NPC line." A topic change re-enters through the same call, so re-arming here
  // is precisely the failure the sentence forbids — and the probe caught it, measuring a
  // second 1.92° swing on a re-open.
  if (kind === 'dialogue' && wasDialogue) return c.uiMode;
  if (kind === 'dialogue') {
    // RI-CAM05 §B: ONE bounded accommodation, at open, never again — not on a topic change,
    // not on a new NPC line. Pitch never moves.
    c.dialogueFrames = 0;
    c.dialogueArm = 0;
    c.dialogueYawTotal = 0;
    const x = npcHeadNdcX === undefined ? 0.5 : npcHeadNdcX;
    const need = x < 0.10 ? (0.10 - x) : x > 0.92 ? (0.92 - x) : 0;
    const yaw = clamp(need * 24.0, -CAMERA_CONST.dialogue_yaw_max_deg, CAMERA_CONST.dialogue_yaw_max_deg);
    c.dialogueYawStep = yaw / CAMERA_CONST.dialogue_frames;
    c.dialogueArmStep = (need !== 0 ? CAMERA_CONST.dialogue_arm_max_m : 0) / CAMERA_CONST.dialogue_frames;
  }
  return c.uiMode;
}

export function closeUI(sim) {
  const c = sim.camera;
  const was = c.uiMode;
  c.uiMode = null;
  if (was === 'dialogue') c.dialogueFrames = -CAMERA_CONST.dialogue_frames;   // reversed over 12 f
  return true;
}

/** The dialogue accommodation, stepped inside the sim step so it is frame-exact. */
function stepDialogueAccommodation(sim) {
  const c = sim.camera;
  if (c.uiMode === 'dialogue') {
    if (c.dialogueFrames < CAMERA_CONST.dialogue_frames) {
      c.dialogueFrames++;
      c.yaw = norm360(c.yaw + c.dialogueYawStep);
      c.dialogueYawTotal += Math.abs(c.dialogueYawStep);
      c.dialogueArm += c.dialogueArmStep;
    }
  } else if (c.dialogueFrames < 0) {
    c.dialogueFrames++;
    c.yaw = norm360(c.yaw - c.dialogueYawStep);
    c.dialogueArm = Math.max(0, c.dialogueArm - c.dialogueArmStep);
    if (c.dialogueFrames === 0) { c.dialogueArm = 0; c.dialogueYawStep = 0; c.dialogueArmStep = 0; }
  }
}

export function beginFogGate(sim, targetEid) {
  const c = sim.camera;
  c.fogUntil = sim.frame + CAMERA_CONST.fog_frames;
  c.fogTarget = targetEid === undefined ? null : targetEid;
  return c.fogUntil;
}

export function beginDeathCamera(sim) {
  sim.camera.deathFrame = sim.frame;
  return true;
}

// =========================================================================================
function applyOverride(c) {
  const o = c.override;
  c.pos[0] = o.pos[0]; c.pos[1] = o.pos[1]; c.pos[2] = o.pos[2];
  c.pivot[0] = o.look[0]; c.pivot[1] = o.look[1]; c.pivot[2] = o.look[2];
  c.fov = o.fov;
  const dx = o.look[0] - o.pos[0], dy = o.look[1] - o.pos[1], dz = o.look[2] - o.pos[2];
  const flat = Math.sqrt(dx * dx + dz * dz);
  c.yaw = norm360(Math.atan2(dx, dz) * RAD);
  c.pitch = Math.atan2(dy, flat) * RAD;
  c.dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  c.armLen = c.dist;
  c.shakeYaw = 0; c.shakePitch = 0;
  c.charOpacity = 1;
}

function clampPitch(v, locked) {
  return clamp(v,
    locked ? CAMERA_CONST.pitch_min_locked_deg : CAMERA_CONST.pitch_min_deg,
    locked ? CAMERA_CONST.pitch_max_locked_deg : CAMERA_CONST.pitch_max_deg);
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function angle180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
