// W1-30S seam pass.
//
// The joint, socket and weapon-grip names the shipping rig, hitboxes and presentation layer
// all agree on. `render/actor.js` is presentation and currently spells these bone/socket
// strings inline (its `PLAN`/`JOINTS` tables, `hand_l`/`hand_r` literals, `socket_a`/
// `socket_b` reads off statblocks); `game/data/combat/skeleton.json` is the canonical source
// combat already evaluates against. This file publishes that vocabulary as one importable
// contract so a future rig change (W1-30D) has one place to check it against, rather than
// grepping actor.js for string literals.
//
// This commit does NOT rewire actor.js to import from here — actor.js is unmodified, so this
// is purely additive and carries zero pixel risk. Future owner: W1-30D, who owns actor.js,
// models.js and the rigs registry and can safely retire the inline literals when it lands.
'use strict';

/** The twenty bones `game/data/combat/skeleton.json` declares, in the file's own order.
 * `Rig.evaluate()` (combat/skeleton.js) computes a world transform for each of these every
 * frame; `render/actor.js` reads them by these exact ids. */
export const JOINT_NAMES = Object.freeze([
  'root', 'pelvis', 'spine_00', 'spine_02', 'neck', 'head',
  'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r',
  'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r',
]);

/** The two named grip bones a weapon reads off `skeleton.json`'s `weapon` block. */
export const GRIP_BONES = Object.freeze({ main: 'hand_r', off: 'hand_l' });

/** The five named points along a weapon's blade axis (`skeleton.json` `weapon.sockets`),
 * plus the two combat-facing socket keys every statblock declares (`socket_a`/`socket_b`,
 * read by `render/actor.js` off the live weapon record — see its header comment on
 * `socket_b_dist_m`). */
export const SOCKET_NAMES = Object.freeze([
  'wpn_guard', 'wpn_mid', 'wpn_tip', 'wpn_head_a', 'wpn_head_b',
]);
export const HIT_SOCKET_KEYS = Object.freeze(['socket_a', 'socket_b']);

/** Hurtbox capsule ids `skeleton.json`'s `hurtbox_axes` names. Not bone ids — a hurtbox can
 * span more than one bone (`torso_upper`/`torso_lower` against `spine_00`/`spine_02`) — but
 * every rig consumer needs the same closed list, so it is published beside the joint names
 * rather than re-declared per consumer. */
export const HURTBOX_NAMES = Object.freeze([
  'head', 'torso_upper', 'torso_lower', 'pelvis',
  'upper_arm_l', 'upper_arm_r', 'forearm_l', 'forearm_r',
  'thigh_l', 'thigh_r', 'shin_l', 'shin_r',
]);

/** Animation clip *phase* names used across the moveset/combat data (windup/active/recovery
 * style phases a clip is cut into), published here as an empty, growing registry rather than
 * a guessed enumeration: no single file in the current tree declares a closed clip-name list,
 * and inventing one under a move-only commit would be new behaviour, not a move. W1-30D fills
 * this in when it consolidates animation ownership. */
export const CLIP_NAMES = Object.freeze([]);
