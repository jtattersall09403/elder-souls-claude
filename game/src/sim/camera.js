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
  // SEAM S32, and the reason these four live HERE and not in `input/`. The input piece owns
  // the RAW stick — which axes exist, which pad reports what, and the hardware deadzone that
  // decides whether a stick is being touched at all (`input/gamepad.js`, from
  // `data/input/profiles.json`). The RESPONSE CURVE above that — how a deflection of 0.6
  // becomes a number of degrees — is the camera's, because it is the thing a player calls
  // "the camera feels heavy". `input/pipeline.js:shapeLookStick()` reads them from here.
  look_stick_deadzone: 0.15,
  look_stick_saturation: 0.95,
  look_stick_exponent: 2.0,
  look_stick_yaw_deg_per_frame: 3.0,
  look_stick_pitch_deg_per_frame: 2.0,
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

// =========================================================================================
// THE DATA FILE GOVERNS. RI-MTH07 / ARBITRATION §3.
//
// Every number in `CAMERA_CONST` above was ALSO written down in `game/data/camera/rig.json`,
// and until this function existed the JSON was fetched at boot (engine.js `out.cameraRig`),
// assigned to a field, and read by nothing. Editing it changed nothing a player could see —
// the fifteenth instrumented model in this project with no world-side consumer, and the one
// in the piece whose whole job is what the player is looking through.
//
// So the literals above are now DEFAULTS AND A SCHEMA, not the authority. `applyCameraRig()`
// overwrites them from the file at boot; the derived alphas and the near-plane corner radius
// are recomputed from the new values; and `input/pipeline.js` reads its look curve from the
// same object. Perturb a line of rig.json and the camera moves differently on the next boot.
//
// The mapping is EXHAUSTIVE by assertion, not by hope. Every key of `CAMERA_CONST` is either
// in `RIG_MAP` or in `RIG_UNDECLARED`, and `applyCameraRig()` throws if a key is in neither,
// if a mapped path is missing from the document, or if the value is not finite. A rig.json
// that loses a field fails the boot instead of silently reverting to a literal — which is the
// exact failure this whole function exists to make impossible.
//
// `t` is the transform from the file's unit to the code's. It exists in five places only,
// all of them "per second in the file, per frame in the step", and each one is checked
// against the file's own pre-divided twin where the file carries one.
const P = (x) => x;                 // identity, named so the table reads as a table
const PER_FRAME = (x) => x / 60;    // deg/s or m/s in the file → per fixed step in the code
/** @type {Array<[string, string, (n: number) => number]>} */
const RIG_MAP = [
  ['pivot_height_m',                'rig.pivot_height_m', P],
  ['shoulder_right_free_m',         'rig.shoulder_right_free_m', P],
  ['shoulder_up_free_m',            'rig.shoulder_up_free_m', P],
  ['shoulder_right_locked_m',       'rig.shoulder_right_locked_m', P],
  ['shoulder_up_locked_m',          'rig.shoulder_up_locked_m', P],
  ['arm_free_m',                    'rig.arm_free_m', P],
  ['arm_locked_near_m',             'rig.arm_locked_near_m', P],
  ['arm_locked_far_m',              'rig.arm_locked_far_m', P],
  ['arm_locked_near_d_m',           'rig.arm_locked_near_at_target_dist_m', P],
  ['arm_locked_far_d_m',            'rig.arm_locked_far_at_target_dist_m', P],
  ['arm_max_m',                     'rig.arm_max_m', P],
  ['arm_min_m',                     'rig.arm_min_m', P],
  ['cast_radius_m',                 'rig.cast_radius_m', P],
  ['cast_backoff_m',                'rig.cast_backoff_m', P],
  ['fov_deg',                       'rig.fov_deg', P],
  ['near_m',                        'rig.near_m', P],
  ['far_m',                         'rig.far_m', P],
  ['aspect',                        'rig.aspect_canonical', P],
  ['pivot_y_half_life_s',           'pivot_follow.vertical_half_life_s', P],
  ['pivot_y_half_life_air_s',       'pivot_follow.vertical_half_life_airborne_s', P],
  ['pivot_y_lag_clamp_m',           'pivot_follow.vertical_lag_clamp_m', P],
  ['pull_in_m_per_frame',           'spring_arm.pull_in_mps', PER_FRAME],
  ['push_out_m_per_frame',          'spring_arm.push_out_mps', PER_FRAME],
  ['push_out_dwell_frames',         'spring_arm.push_out_dwell_frames', P],
  ['fade_start_m',                  'spring_arm.fade_start_m', P],
  ['fade_zero_m',                   'spring_arm.fade_zero_m', P],
  ['guard_radius_m',                'spring_arm.penetration_guard.guard_radius_m', P],
  ['arm_hard_min_m',                'spring_arm.penetration_guard.arm_hard_min_m', P],
  ['camera_to_head_min_m',          'spring_arm.penetration_guard.camera_to_head_min_m', P],
  ['head_height_m',                 'player_body.eye_height_m', P],
  ['chest_height_m',                'player_body.chest_height_m', P],
  ['look_stick_deadzone',           'look.stick_deadzone_radial', P],
  ['look_stick_saturation',         'look.stick_saturation', P],
  ['look_stick_exponent',           'look.magnitude_exponent', P],
  ['look_stick_yaw_deg_per_frame',  'look.max_yaw_rate_dps', PER_FRAME],
  ['look_stick_pitch_deg_per_frame', 'look.max_pitch_rate_dps', PER_FRAME],
  ['look_cap_yaw_deg_per_frame',    'look.cap_yaw_deg_per_frame', P],
  ['look_cap_pitch_deg_per_frame',  'look.cap_pitch_deg_per_frame', P],
  ['pitch_min_deg',                 'pitch_clamp.min_deg', P],
  ['pitch_max_deg',                 'pitch_clamp.max_deg', P],
  ['pitch_min_locked_deg',          'pitch_clamp.min_locked_deg', P],
  ['pitch_max_locked_deg',          'pitch_clamp.max_locked_deg', P],
  ['recentre_gate_frames',          'auto_recentre.gate_frames', P],
  ['recentre_speed_fraction',       'auto_recentre.gate_speed_fraction_of_sprint', P],
  ['recentre_forward_dominance',    'auto_recentre.gate_forward_dominance', P],
  ['recentre_yaw_half_life_s',      'auto_recentre.yaw_half_life_s', P],
  ['recentre_yaw_clamp_deg_per_frame', 'auto_recentre.yaw_rate_clamp_dps', PER_FRAME],
  ['recentre_pitch_target_deg',     'auto_recentre.pitch_target_deg', P],
  ['recentre_pitch_half_life_s',    'auto_recentre.pitch_half_life_s', P],
  ['lock_yaw_half_life_s',          'lock_framing.yaw_half_life_s', P],
  ['lock_pitch_half_life_s',        'lock_framing.pitch_half_life_s', P],
  ['lock_yaw_clamp_deg_per_frame',  'lock_framing.yaw_rate_clamp_deg_per_frame', P],
  ['safe_rect_x',                   'lock_framing.safe_rect_ndc_x', P],
  ['safe_rect_y',                   'lock_framing.safe_rect_ndc_y', P],
  ['contain_extend_m_per_frame',    'lock_framing.containment_arm_extend_m_per_frame', P],
  ['contain_retract_m_per_frame',   'lock_framing.containment_arm_retract_m_per_frame', P],
  ['contain_grab_m',                'lock_framing.containment_grab_m_per_frame', P],
  ['contain_release_m',             'lock_framing.containment_release_m_per_frame', P],
  ['contain_pitch_deg_per_frame',   'lock_framing.containment_pitch_deg_per_frame', P],
  ['contain_soft_cap_m',            'lock_framing.containment_drivers.contain_soft_cap_m', P],
  ['contain_pitch_max_deg',         'lock_framing.containment_drivers.contain_pitch_max_deg', P],
  ['contain_pitch_soft_deg',        'lock_framing.containment_drivers.contain_pitch_soft_deg', P],
  ['arm_half_life_s',               'lock_framing.arm_half_life_s', P],
  ['pitch_base_min_deg',            'lock_framing.pitch_base_min_deg', P],
  ['pitch_base_max_deg',            'lock_framing.pitch_base_max_deg', P],
  ['pitch_base_slope',              'lock_framing.pitch_base_slope_deg_per_m', P],
  ['pitch_base_ref_d_m',            'lock_framing.pitch_base_ref_dist_m', P],
  ['size_bias_per_m',               'lock_framing.size_bias_per_m', P],
  ['size_bias_ref_h_m',             'lock_framing.size_bias_height_ref_m', P],
  ['aim_k_div_m',                   'lock_framing.aim_k_divisor_m', P],
  ['aim_k_max',                     'lock_framing.aim_k_max', P],
  ['aim_base_w',                    'lock_framing.aim_base_weight', P],
  ['aim_k_span',                    'lock_framing.aim_k_span', P],
  ['dialogue_yaw_max_deg',          'dialogue.accommodation_max_yaw_deg', P],
  ['dialogue_arm_max_m',            'dialogue.accommodation_max_arm_m', P],
  ['dialogue_frames',               'dialogue.accommodation_frames', P],
  ['rest_arm_m',                    'rest.arm_to_m', P],
  ['rest_pitch_deg',                'rest.pitch_to_deg', P],
  ['rest_ease_frames',              'rest.ease_frames', P],
  ['shake_half_life_s',             'feel.shake.half_life_s', P],
  ['shake_max_deg',                 'feel.shake.max_deg', P],
  ['shake_max_frames',              'feel.shake.max_frames', P],
  ['death_arm_m',                   'feel.death.arm_to_m', P],
  ['death_pitch_deg',               'feel.death.pitch_to_deg', P],
  ['death_ease_frames',             'feel.death.ease_frames', P],
  ['death_orbit_deg_per_frame',     'feel.death.orbit_dps', PER_FRAME],
  ['death_orbit_until',             'feel.death.orbit_until_frame', P],
  ['death_pitch_rate_deg_per_frame', 'feel.death.pitch_rate_deg_per_frame', P],
  ['fog_frames',                    'feel.fog_gate.frames', P],
  ['fog_yaw_half_life_s',           'feel.fog_gate.yaw_half_life_s', P],
  ['fog_yaw_clamp_deg_per_frame',   'feel.fog_gate.yaw_rate_clamp_dps', PER_FRAME],
  ['fog_arm_m',                     'feel.fog_gate.arm_to_m', P],
  ['fog_arm_frames',                'feel.fog_gate.arm_ease_frames', P],
];
/** Keys the rig file deliberately does NOT declare, with the reason. Anything not here and
 *  not in `RIG_MAP` is a mapping hole and throws. */
const RIG_UNDECLARED = {
  pitch_scale_down_at: 'rig.pitch_arm_scale, a table — read separately below',
  pitch_scale_down: 'rig.pitch_arm_scale, a table — read separately below',
  pitch_scale_up_at: 'rig.pitch_arm_scale, a table — read separately below',
  pitch_scale_up: 'rig.pitch_arm_scale, a table — read separately below',
  sprint_mps: 'W1-08/W1-15 own the sprint speed; the camera only compares against it',
};

function dig(doc, dotted) {
  let o = doc;
  for (const k of dotted.split('.')) {
    if (o === null || typeof o !== 'object' || !(k in o)) return undefined;
    o = o[k];
  }
  return o;
}

/**
 * Install `game/data/camera/rig.json` over the defaults. Called once, from `Engine.loadState`,
 * BEFORE the first step — every constant here is read inside the fixed step and none may
 * change while the world is running.
 *
 * Returns the audit a probe needs to prove consumption: which keys the file moved, and by how
 * much. `tools/camera/cam-consume.mjs` perturbs the file, reads this, and then watches the
 * camera actually behave differently — the audit alone would be another promise.
 */
export function applyCameraRig(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('applyCameraRig: camera/rig.json missing');
  const mapped = new Set(RIG_MAP.map((r) => r[0]));
  for (const k of Object.keys(CAMERA_CONST)) {
    if (!mapped.has(k) && !(k in RIG_UNDECLARED)) {
      throw new Error(`applyCameraRig: CAMERA_CONST.${k} is declared by no path in rig.json and is ` +
        'not listed in RIG_UNDECLARED — the mapping is not exhaustive');
    }
  }
  const changed = [];
  for (const [key, dotted, t] of RIG_MAP) {
    const raw = dig(doc, dotted);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      throw new Error(`applyCameraRig: rig.json ${dotted} (-> CAMERA_CONST.${key}) is ` +
        `${JSON.stringify(raw)}, expected a finite number`);
    }
    const v = t(raw);
    const was = CAMERA_CONST[key];
    if (was !== v) changed.push({ key, path: dotted, was, now: v });
    CAMERA_CONST[key] = v;
  }
  // The pitch/arm scale table. Three rows, ordered, and the middle one must be the identity
  // at pitch 0 or the free arm length stops meaning what RI-CAM01 §A says it means.
  const tab = dig(doc, 'rig.pitch_arm_scale');
  if (!Array.isArray(tab) || tab.length !== 3) throw new Error('applyCameraRig: rig.pitch_arm_scale must be 3 rows');
  const rows = tab.slice().sort((a, b) => a.pitch_deg - b.pitch_deg);
  if (rows[1].pitch_deg !== 0 || rows[1].scale !== 1) {
    throw new Error('applyCameraRig: rig.pitch_arm_scale middle row must be {pitch_deg: 0, scale: 1}');
  }
  for (const [key, v] of [['pitch_scale_down_at', rows[0].pitch_deg], ['pitch_scale_down', rows[0].scale],
    ['pitch_scale_up_at', rows[2].pitch_deg], ['pitch_scale_up', rows[2].scale]]) {
    if (CAMERA_CONST[key] !== v) changed.push({ key, path: 'rig.pitch_arm_scale', was: CAMERA_CONST[key], now: v });
    CAMERA_CONST[key] = v;
  }
  recomputeDerived();
  return { keys: RIG_MAP.length + 4, changed };
}

/** Everything computed FROM `CAMERA_CONST` rather than stated in it. Re-derived whenever the
 *  file moves a constant, because an alpha left over from a default is exactly how a data
 *  file comes to be half-consumed. */
function recomputeDerived() {
  A_PIVOT_Y = alphaFor(CAMERA_CONST.pivot_y_half_life_s);
  A_PIVOT_Y_AIR = alphaFor(CAMERA_CONST.pivot_y_half_life_air_s);
  A_LOCK_YAW = alphaFor(CAMERA_CONST.lock_yaw_half_life_s);
  A_LOCK_PITCH = alphaFor(CAMERA_CONST.lock_pitch_half_life_s);
  A_ARM = alphaFor(CAMERA_CONST.arm_half_life_s);
  A_RECENTRE_YAW = alphaFor(CAMERA_CONST.recentre_yaw_half_life_s);
  A_RECENTRE_PITCH = alphaFor(CAMERA_CONST.recentre_pitch_half_life_s);
  A_SHAKE = alphaFor(CAMERA_CONST.shake_half_life_s);
  A_FOG_YAW = alphaFor(CAMERA_CONST.fog_yaw_half_life_s);
  for (const [k, v] of [['0.080', A_SHAKE], ['0.120', A_LOCK_YAW], ['0.180', A_LOCK_PITCH],
    ['0.250', A_ARM], ['0.350', A_RECENTRE_YAW], ['0.400', A_PIVOT_Y_AIR], ['0.600', A_RECENTRE_PITCH]]) {
    CAMERA_ALPHAS[k] = v;
  }
  const hh = CAMERA_CONST.near_m * Math.tan(CAMERA_CONST.fov_deg * DEG / 2);
  const hw = hh * CAMERA_CONST.aspect;
  NEAR_CORNER_R = Math.sqrt(CAMERA_CONST.near_m ** 2 + hh ** 2 + hw ** 2);
}

/** RI-CAM05 §F: the closed `camera.mode` vocabulary. Anything else in a trace is a fail. */
export const CAMERA_MODES = ['free', 'locked', 'dialogue', 'menu', 'rest', 'death', 'fog_gate'];
/** RI-CAM05 §F: `listPerspectiveModes()` must return exactly this, and nothing may add to it. */
export const PERSPECTIVE_MODES = ['third'];

let A_PIVOT_Y = alphaFor(CAMERA_CONST.pivot_y_half_life_s);
let A_PIVOT_Y_AIR = alphaFor(CAMERA_CONST.pivot_y_half_life_air_s);
let A_LOCK_YAW = alphaFor(CAMERA_CONST.lock_yaw_half_life_s);
let A_LOCK_PITCH = alphaFor(CAMERA_CONST.lock_pitch_half_life_s);
let A_ARM = alphaFor(CAMERA_CONST.arm_half_life_s);
let A_RECENTRE_YAW = alphaFor(CAMERA_CONST.recentre_yaw_half_life_s);
let A_RECENTRE_PITCH = alphaFor(CAMERA_CONST.recentre_pitch_half_life_s);
let A_SHAKE = alphaFor(CAMERA_CONST.shake_half_life_s);
let A_FOG_YAW = alphaFor(CAMERA_CONST.fog_yaw_half_life_s);
export const CAMERA_ALPHAS = {
  '0.080': A_SHAKE, '0.120': A_LOCK_YAW, '0.180': A_LOCK_PITCH, '0.250': A_ARM,
  '0.350': A_RECENTRE_YAW, '0.400': A_PIVOT_Y_AIR, '0.600': A_RECENTRE_PITCH,
};

/** Near-plane corner radius: the distance from the camera origin to a corner of the near
 *  plane. The penetration guard's sphere is deliberately larger than this, which is what
 *  makes `clip_through == false` a structural property rather than a lucky one. */
export let NEAR_CORNER_R = (() => {
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

  // YAW target from the aim point, measured from the camera's current position — which closes
  // the loop between the containment correction (which moves the camera) and the orientation
  // that has to keep both anchors inside the frame. This is stable: swinging the yaw carries
  // the camera around the pivot on a radius shorter than its distance to the aim point, so the
  // loop gain is ≈ arm/|A − camera| ≈ 0.4, and it converges on the pivot→A bearing.
  const ax = _aim[0] - c.pos[0], az = _aim[2] - c.pos[2];
  const yawT = norm360(Math.atan2(ax, az) * RAD);

  // PITCH target — AND THIS ONE MAY NOT BE MEASURED FROM c.pos. THAT WAS THE PIN.
  //
  // `c.pos[1] = c.pivot[1] − sin(pitch)·armLen` (writePose → desiredPoint). So taking the
  // elevation of A from the camera makes the pitch target a function of the pitch, and the
  // same-sign one: tilting DOWN raises the camera, which drops A further below it, which
  // demands more down-tilt. Differentiating at the mid-boss case (h 4.5, d 6.0, arm ≈ 3.9,
  // baseline ≈ 6 m) gives d(pitchT)/d(pitch) ≈ (−9.6 °/m)·(−0.27 m/°) ≈ +2.5.
  //
  // A loop gain above 1 does not settle. It DIVERGES from any starting pitch until a clamp
  // catches it, and which clamp it reaches is decided by the sign of the initial error, not by
  // the world. Measured both ways with the real module: in the boss arena it ran to −50.000°,
  // exactly `pitch_min_locked_deg`, and stared at the tops of everyone's heads for the rest of
  // the fight and past the kill; in `cam-pitch-instrument.mjs` on flat ground it ran the other
  // way to +24.6° with the camera 0.1 m UNDER the floor. Both are the same defect. Neither is
  // a tuning problem in pitchBias() or aimPoint(), which is why round 1 was right to refuse to
  // guess: pitchBias(6, 4.5) is −9.2° and tilts UP, and A sits 2.0 m ABOVE the pivot.
  //
  // The elevation is therefore taken over a baseline that does not move with the pitch: the
  // pivot's height, and the horizontal distance the camera actually has to work with — the
  // boom plus the pivot-to-A run. That is the same composition the real rig has (the camera
  // sits `armLen` behind the pivot and A is 0.35·d in front of it), it is well-posed, and it
  // makes RI-CAM03 §E M2's "the pitch the aim-point spring alone would produce" a quantity
  // that exists. Residual feedback through pitchArmScale() is −0.04 and damping.
  const aimRun = Math.sqrt((_aim[0] - c.pivot[0]) * (_aim[0] - c.pivot[0])
    + (_aim[2] - c.pivot[2]) * (_aim[2] - c.pivot[2]));
  let pitchT = Math.atan2(_aim[1] - c.pivot[1], c.armLen + aimRun) * RAD;

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
  // up = fwd × right. THE ORDER IS LOAD-BEARING AND IT WAS BACKWARDS.
  //
  // This was `right × fwd`, which is the NEGATIVE of the up vector. At yaw 0, pitch 0 that is
  // (1,0,0) × (0,0,1) = (0,−1,0) — it points at the ground — and in general its y component is
  // −cos(pitch), negative across the whole legal pitch band [−55°, +38°]. Eighteen of eighteen
  // sampled poses pointed down (`tools/camera/cam-pitch-instrument.mjs --basis`).
  //
  // It survived because NOTHING THE PLAYER SEES READS IT. render/renderer.js builds the view
  // with `camera.lookAt(pivot)` and `camera.up.set(0,1,0)`, so the picture is upright no matter
  // what this function returns. The only consumers are inside this file — project(), which is
  // the sim's own screen-space reasoning, and the shoulder offset — so the sign error showed up
  // as a *behaviour* rather than as an upside-down frame:
  //
  //   · project()'s NDC y came out sign-inverted, so containment() read a target that was HIGH
  //     in the frame as LOW and drove `containPitch` the wrong way — positive feedback into the
  //     pitch clamp, which is half of the −50° pin this round exists to fix.
  //   · every on-screen test is |ndc| ≤ 1, which is SIGN-SYMMETRIC, so "both fighters on screen"
  //     stayed true throughout and no check ever went red.
  //   · measureOnScreen()'s `tBandY = (1 − tNdc[1]) · 0.5` — [CMB06]'s 38–62% framing band,
  //     measured from the top of the screen — was mirrored about mid-screen.
  //   · desiredPoint() adds `up · shoulder_up`, so RI-CAM01 §A's +0.10 m shoulder RISE was
  //     applied downward. A census that measures it by dotting this same vector reads +0.10 and
  //     agrees with itself, which is how it passed.
  up[0] = fwd[1] * right[2] - fwd[2] * right[1];
  up[1] = fwd[2] * right[0] - fwd[0] * right[2];
  up[2] = fwd[0] * right[1] - fwd[1] * right[0];
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
