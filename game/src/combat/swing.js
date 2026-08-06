// Swing synthesis — how a clip id becomes an actual animation.
//
// W1-10. This module exists to make one sentence true: **two different clip ids play two
// different animations.** RI-WPN03 M2 (the anti-forgery check) drives one slot per clip id and
// compares per-frame root tracks and per-frame hitbox capsule poses; ids whose tracks match
// within 0.01 m / 0.02 m are declared cosmetic and the whole Animation Reuse Index becomes a
// fiction. So a clip cannot be a name. It has to be a cause.
//
// The cause here is a **swing profile**: seven physically-meaningful controls that describe how
// a weapon travels, from which the per-bone Euler curves the existing `Clip` class consumes are
// derived analytically.
//
//   arc_deg     total angular travel of the blade about the character's Y axis, start -> end.
//               This is the SAME number the moveset declares as `arc_sweep_deg`, so the declared
//               arc is the cause of the animation rather than a label attached to it. RI-WPN02
//               M5 ("a weapon labelled thrust that sweeps 140 degrees is mislabelled data") can
//               only fail here if the synthesiser is broken, not if an author was careless.
//   start_deg   where the blade begins the active window, measured from forward, +ve = the
//               character's right. A right-to-left horizontal cut starts at +55 and ends at -55.
//   plane_deg   tilt of the swing plane. 0 = horizontal, 90 = a vertical chop straight down,
//               -30 = a rising cut. This is what makes `slash_h`, `slash_d`, `slash_v` and
//               `sweep` four different animations rather than four labels on one.
//   cock_frac   how far back past `start_deg` the windup travels, as a fraction of arc. This is
//               ANTICIPATION (RI-WPN05 §E) and it is the diagnostic the item names: an animation
//               that starts moving forward on frame 1 was interpolated, not authored.
//   follow_frac how far past `end_deg` the follow-through overshoots before it reverses.
//   extend      arm extension at the moment of contact, 0 = tucked (a chop), 1 = straight (a
//               thrust). Moves the hand, so it moves the socket, so it moves the hitbox.
//   crouch_m    pelvis vertical offset at contact. A rolling attack is low; a plunge is falling.
//
// Plus `root_forward` (the displacement profile) and a small set of stance offsets.
//
// The blade's world yaw is the sum of the ry of every bone from pelvis to hand (the chain is
// rigid and the weapon is parented to hand_r), so distributing `arc_deg` across those five bones
// in fixed proportions makes the measured arc equal the declared arc up to the cosine of the
// plane tilt. The build tool measures the REAL arc off the REAL rig and records both, so the
// approximation is auditable rather than assumed (tools/weapons/measure-clips.mjs).
'use strict';

/** Bones that carry the horizontal component of a swing, and their share of the total yaw. */
const YAW_CHAIN = [
  ['pelvis', 0.14],
  ['spine_00', 0.18],
  ['spine_02', 0.26],
  ['clavicle_r', 0.08],
  ['upperarm_r', 0.34],
];

/** Bones that carry the vertical component (the plane tilt), and their share. */
const PITCH_CHAIN = [
  ['spine_00', 0.16],
  ['spine_02', 0.20],
  ['upperarm_r', 0.44],
  ['hand_r', 0.20],
];

/** Phase of the deepest cock, by weight tier. Sets the anticipation fraction directly. */
export const COCK_PHASE = { light: 0.45, medium: 0.50, heavy: 0.58, ultra: 0.62, ranged: 0.40 };
/** Phase (past p=2) at which the follow-through reverses. Sets the follow-through fraction. */
export const FOLLOW_PHASE = { light: 0.24, medium: 0.26, heavy: 0.34, ultra: 0.38, ranged: 0.20 };
/** Root-forward overshoot at the end of the active window — the "settle" of RI-WPN05 §E. */
const SETTLE = { light: 0.00, medium: 0.035, heavy: 0.055, ultra: 0.075, ranged: 0.0 };

function r2(x) { return Math.round(x * 1000) / 1000; }

/**
 * Build a `Clip`-compatible archetype object from a swing profile.
 *
 * @param {object} p swing profile
 * @param {number} p.arc_deg      total blade yaw travel across the active window
 * @param {number} p.start_deg    blade yaw at the first active frame
 * @param {number} p.plane_deg    swing-plane tilt (+ve = downward, -ve = rising)
 * @param {number} p.cock_frac    anticipation depth as a fraction of arc (may exceed 1 for small arcs)
 * @param {number} p.follow_frac  follow-through overshoot as a fraction of arc
 * @param {number} p.extend       arm extension at contact, 0..1
 * @param {number} p.crouch_m     pelvis vertical offset at contact, metres (-ve = lower)
 * @param {number} p.lean_deg     torso pitch at contact (forward lean)
 * @param {string} p.tier         weight tier, selects the cock / follow / settle constants
 * @param {number} [p.twist_deg]  blade roll about its own axis at contact (a cut vs a flat)
 * @param {number} [p.offhand]    0..1, how much the LEFT arm mirrors the swing (two-handed grip)
 * @param {number[][]} [p.root_shape] override for the root-forward curve
 * @returns {{root_forward:number[][], root_offset:{y:number[][]}, tracks:object, profile:object}}
 */
export function buildSwing(p) {
  const tier = p.tier || 'medium';
  const cockP = COCK_PHASE[tier] !== undefined ? COCK_PHASE[tier] : 0.5;
  const folP = FOLLOW_PHASE[tier] !== undefined ? FOLLOW_PHASE[tier] : 0.25;
  const settle = SETTLE[tier] !== undefined ? SETTLE[tier] : 0.03;

  const arc = p.arc_deg;
  const dir = arc >= 0 ? 1 : -1;              // swing handedness
  const a0 = p.start_deg;                      // yaw at first active frame
  const a1 = p.start_deg + arc;                // yaw at last active frame
  const aCock = a0 - dir * Math.abs(arc) * p.cock_frac;
  const aFollow = a1 + dir * Math.abs(arc) * p.follow_frac;
  const aRest = p.rest_deg !== undefined ? p.rest_deg : a0 * 0.35;

  // Yaw keyframes, in blade-space degrees. Phase anchors: 0 = frame 1, 1 = last startup frame,
  // 2 = last active frame, 3 = last frame.
  const yawKeys = [
    [0.0, aRest],
    [cockP, aCock],
    [1.0, a0],
    [2.0, a1],
    [2.0 + folP, aFollow],
    [3.0, aRest + (a1 - aRest) * 0.22],
  ];

  // Pitch keyframes. The blade rises during the cock and falls through the swing; a rising cut
  // (negative plane) does the reverse. `lean_deg` is the torso pitching into the blow.
  const tilt = p.plane_deg;
  const pitchKeys = [
    [0.0, -6],
    [cockP, -tilt * 0.85 - 10],
    [1.0, -tilt * 0.55 - 4],
    [2.0, tilt * 0.75],
    [2.0 + folP, tilt * 1.0 + 6],
    [3.0, tilt * 0.25],
  ];

  const tracks = {};
  const put = (bone, axis, keys) => {
    tracks[bone] = tracks[bone] || {};
    tracks[bone][axis] = keys.map(([ph, v]) => [r2(ph), r2(v)]);
  };

  for (const [bone, share] of YAW_CHAIN) put(bone, 'ry', yawKeys.map(([ph, v]) => [ph, v * share]));
  for (const [bone, share] of PITCH_CHAIN) put(bone, 'rx', pitchKeys.map(([ph, v]) => [ph, v * share]));

  // Torso lean — an independent forward pitch so a great hammer falls into its own swing while a
  // thrusting sword stays upright. Added on top of the pitch chain's share of spine_00.
  const lean = p.lean_deg || 0;
  const leanKeys = [[0.0, 2], [cockP, -lean * 0.5], [1.0, -lean * 0.2], [2.0, lean], [2.0 + folP, lean * 1.15], [3.0, lean * 0.3]];
  tracks.spine_00.rx = tracks.spine_00.rx.map(([ph, v], i) => [ph, r2(v + leanKeys[i][1] * 0.45)]);
  put('pelvis', 'rx', leanKeys.map(([ph, v]) => [ph, r2(v * 0.25)]));

  // Arm extension: upperarm and lowerarm straighten toward contact. `extend` 1 is a lunge with a
  // locked elbow (a thrust), 0 is a chop with the elbow tucked. This is what moves the weapon
  // SOCKET, so it is what moves the hitbox capsule, so it is what T4 of RI-WPN04 §D measures.
  const e = p.extend;
  const upperKeys = [
    [0.0, -14], [cockP, -34 - 30 * (1 - e)], [1.0, -30 - 24 * (1 - e)],
    [2.0, -8 - 46 * (1 - e)], [2.0 + folP, 2 - 40 * (1 - e)], [3.0, -12 - 14 * (1 - e)],
  ];
  const lowerKeys = [
    [0.0, -32], [cockP, -68 + 30 * e], [1.0, -58 + 40 * e],
    [2.0, -78 + 74 * e], [2.0 + folP, -62 + 58 * e], [3.0, -40 + 18 * e],
  ];
  tracks.upperarm_r.rx = tracks.upperarm_r.rx.map(([ph, v], i) => [ph, r2(v + upperKeys[i][1])]);
  put('lowerarm_r', 'rx', lowerKeys.map(([ph, v]) => [ph, r2(v)]));

  // Blade roll — a cut lands edge-on, a flat lands flat, and the two sweep different capsule
  // paths even at identical yaw.
  const tw = p.twist_deg || 0;
  put('hand_r', 'rz', [[0.0, 4], [cockP, tw * 0.4 - 12], [1.0, tw * 0.7], [2.0, tw], [2.0 + folP, tw * 0.8 + 8], [3.0, tw * 0.2]]);
  put('clavicle_r', 'rz', [[0.0, 0], [cockP, -22 - 10 * (1 - e)], [1.0, -16], [2.0, 16 + 8 * e], [2.0 + folP, 20], [3.0, 3]]);

  // The offhand. A two-handed grip drags the left arm across; a one-handed swing counterbalances
  // it the other way. This is a whole-body difference between the 1h and 2h clip of one move and
  // it is measured by RI-WPN06 M1's application of T3/T4 across stances.
  const oh = p.offhand === undefined ? 0 : p.offhand;
  const ohSign = oh > 0 ? 1 : -1;
  put('clavicle_l', 'rz', [[0.0, 0], [cockP, 14 * ohSign], [1.0, 10 * ohSign], [2.0, -12 * ohSign], [3.0, -2 * ohSign]]);
  put('upperarm_l', 'rx', [[0.0, -10 - 44 * oh], [cockP, -26 - 52 * oh], [1.0, -24 - 50 * oh], [2.0, -6 - 60 * oh], [2.0 + folP, 4 - 52 * oh], [3.0, -10 - 30 * oh]]);
  put('upperarm_l', 'ry', [[0.0, 0], [cockP, aCock * 0.30 * oh], [1.0, a0 * 0.30 * oh], [2.0, a1 * 0.30 * oh], [3.0, aRest * 0.30 * oh]]);
  put('lowerarm_l', 'rx', [[0.0, -26 - 30 * oh], [cockP, -50 - 22 * oh], [1.0, -46 - 20 * oh], [2.0, -60 - 6 * oh], [3.0, -34 - 20 * oh]]);

  // Legs: weight shifts to the back foot on the cock and onto the front foot at contact. Crouch
  // lowers the pelvis, which lowers every socket with it.
  const cr = p.crouch_m || 0;
  put('thigh_r', 'rx', [[0.0, 4], [cockP, 22 + 40 * -cr], [1.0, 16 + 30 * -cr], [2.0, -14 + 50 * -cr], [2.0 + folP, -18 + 44 * -cr], [3.0, 2 + 20 * -cr]]);
  put('thigh_l', 'rx', [[0.0, -4], [cockP, -20 + 20 * -cr], [1.0, -14 + 16 * -cr], [2.0, 20 + 50 * -cr], [2.0 + folP, 24 + 44 * -cr], [3.0, -2 + 20 * -cr]]);
  put('calf_r', 'rx', [[0.0, -6], [cockP, -34 - 60 * -cr], [1.0, -26 - 50 * -cr], [2.0, -8 - 70 * -cr], [3.0, -6 - 30 * -cr]]);
  put('calf_l', 'rx', [[0.0, -6], [cockP, -10 - 30 * -cr], [1.0, -8 - 26 * -cr], [2.0, -36 - 70 * -cr], [3.0, -8 - 30 * -cr]]);

  // Head tracks the target: it leads the swing on the cock and follows through with it.
  put('neck', 'ry', [[0.0, 2], [cockP, -aCock * 0.30], [1.0, -a0 * 0.22], [2.0, -a1 * 0.16], [3.0, 0]]);

  // Root: the forward displacement profile. Deliberately non-linear — RI-CMB01 M3 fails a
  // constant per-frame delta explicitly, and the settle overshoot is RI-WPN05 §E's requirement
  // that heavy weapons carry the player past their own stopping point.
  const rootShape = p.root_shape || [
    [0.0, 0.0],
    [cockP, -0.05 - 0.06 * (tier === 'ultra' ? 2 : tier === 'heavy' ? 1.4 : 1)],
    [1.0, 0.10],
    [1.55, 0.52 + 0.10 * e],
    [2.0, 1.0 + settle],
    [2.0 + folP, 1.0 + settle * 1.4],
    [2.55, 1.0],
    [3.0, 1.0],
  ];

  const rootY = [
    [0.0, 0.0],
    [cockP, -0.02 + cr * 0.55],
    [1.0, -0.03 + cr * 0.8],
    [2.0, -0.06 + cr],
    [2.0 + folP, -0.08 + cr * 0.9],
    [3.0, -0.01 + cr * 0.25],
  ];

  return {
    note: p.note || '',
    ref: p.ref || null,
    root_forward: rootShape.map(([ph, v]) => [r2(ph), r2(v)]),
    root_offset: { y: rootY.map(([ph, v]) => [r2(ph), r2(v)]) },
    tracks,
    profile: {
      arc_deg: arc, start_deg: p.start_deg, plane_deg: p.plane_deg,
      cock_frac: p.cock_frac, follow_frac: p.follow_frac, extend: e,
      crouch_m: cr, lean_deg: lean, twist_deg: tw, offhand: oh, tier,
    },
  };
}

/**
 * The distance between two swing profiles, in profile space. Used by the build tool to prove
 * that two clip ids are not the same animation BEFORE the expensive rig comparison runs, and to
 * report which knob carries the difference.
 */
export function profileDistance(a, b) {
  const w = {
    arc_deg: 1 / 40, start_deg: 1 / 25, plane_deg: 1 / 20, cock_frac: 1 / 0.15,
    follow_frac: 1 / 0.12, extend: 1 / 0.15, crouch_m: 1 / 0.10, lean_deg: 1 / 8,
    twist_deg: 1 / 20, offhand: 1 / 0.35,
  };
  let s = 0;
  for (const k in w) {
    const d = ((a[k] || 0) - (b[k] || 0)) * w[k];
    s += d * d;
  }
  return Math.sqrt(s);
}
