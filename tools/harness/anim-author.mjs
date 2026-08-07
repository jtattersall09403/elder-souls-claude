#!/usr/bin/env node
// anim-author.mjs — re-author the four attack clip archetypes and the idle base loop, and
// solve for the one free parameter each archetype has.
//
// WHY THIS EXISTS. The W1-09 verdict §2.5 found the frame data exact to the frame and the
// MOTION wrong in three independent ways, none of which a frame count can show:
//
//   1. peak tip speed over RI-CMB04 §B's declared column on all fourteen rows, ×1.00–×2.69;
//   2. a one-handed straight-sword R1 sweeping 615° in total and rotating FURTHER in recovery
//      (280°) than in its active window (156°) — "recovery in a Souls swing is the blade
//      coming to rest; here it is the blade carrying on";
//   3. the weapon snapping 1.42–2.54 m in ONE frame at the attack/idle boundary, because the
//      attack pose is instantiated rather than blended and — the actual mechanism — because
//      `poseLocomotion()` applied the `idle_ready` archetype TWICE (once as the idle LoopClip
//      and once as the additive stance layer), so the idle rig pose was 2 × idle_ready while
//      every attack clip ended near 1 × idle_ready.
//
// THE THREE FIXES, in the order they appear below.
//
// (a) `idle_loop` is a new archetype: a small breathing/weight-shift cycle with NO absolute
//     arm pose. `_idle` plays it and the stance layer supplies the arms, so idle = idle_loop +
//     idle_ready instead of idle_ready + idle_ready. Hurtboxes still move every frame, which
//     is what RI-CMB04 M1 tests for.
//
// (b) Every attack archetype now TERMINATES ON THE IDLE POSE: its phase-3.0 key for every
//     track is exactly `idle_ready`'s value for that bone (0 where idle_ready is silent). The
//     boundary is therefore continuous by construction rather than by luck, and it stays
//     continuous if anyone retimes the move, because it is a property of the curve and not of
//     a frame count.
//
// (c) The blade accelerates through the WINDUP and decelerates through the RECOVERY. The
//     archetypes below author two poses — `cock` (the loaded pose, at phase ~0.45) and `hit`
//     (maximum extension, at phase ~1.45, inside the active band, which is what preserves
//     RI-CMB02 §A's declared reach) — and the pose at phase 1.0, the LAST STARTUP FRAME, is
//     solved for as a blend `cock + t·(hit − cock)`. Raising `t` moves arc out of the active
//     window and into the startup where the hitbox is not live; the solver picks the largest
//     `t` on a 0.001 grid at which EVERY class using that archetype measures a peak tip speed
//     at or under RI-CMB04 §B's declared column, with a 1 % margin. One parameter, solved
//     against the item's own number, not fourteen hand-tuned curves.
//
// Run: node tools/harness/anim-author.mjs [--write | --out <path>] [--only <arch,...>]
//                                          [--gate [--gate-k <n>]]
//   --write        overwrite game/data/combat/clips.json in place
//   --out <path>   write the solve somewhere else, so it can be graded before it ships
//   --only <a,b>   re-solve only these archetypes; the rest are copied from the shipped file
//   --gate         choose among the ranked shortlist with `cmb-exchange.mjs --probe react`,
//                  i.e. with RI-CMB12's own instrument rather than with this file's pose proxy
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Clip, LoopClip, addPose } from '../../game/src/combat/clips.js';
import { Rig } from '../../game/src/combat/skeleton.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const clipsPath = path.join(ROOT, 'game/data/combat/clips.json');
const clipsDoc = JSON.parse(fs.readFileSync(clipsPath, 'utf8'));
const skel = J('combat/skeleton.json');
const hitgeo = J('combat/hitgeometry.json');
const CLASSES = ['dagger', 'straight-sword', 'spear', 'axe', 'halberd', 'greatsword', 'ultra-greatsword'];
const spine = Object.fromEntries(CLASSES.map((c) => [c, J(`combat/spine/${c}.json`)]));
const ENEMIES = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/combat/enemies'))) {
  if (!f.endsWith('.json')) continue;
  const doc = J('combat/enemies/' + f);
  ENEMIES[doc.id] = doc;
}

// ---- the standoff the weapon volume must reach ------------------------------------------
// `hitgeometry.json §bodies` says two humanoids are pushed apart until their centres are
// `player_radius_m + default_enemy_radius_m` apart, and `§body_hazard` says the hazard capsule
// is EXACTLY that collision volume so that "anything the attacker's body would shove, its body
// has already struck". The weapon owes the same promise and did not keep it: measured, every
// attack in the build kept its hitbox capsule 0.42-1.82 m from its own root axis for the whole
// active window, so a target standing ON the separation boundary was outside the blade at every
// frame of every swing. That is the ring `§body_hazard` claims cannot exist, sitting on the
// other side of the same seam.
//
// STANDOFF is where the target's CENTRE ends up; TARGET_HURTBOX is the radius of the thinnest
// hurtbox that centre carries (a forearm, 0.065 m) — no: the number that matters is the LARGEST
// trunk radius, because that is what a shove is resolved against and what a body hazard strikes
// (`§body_hazard.struck_part = torso_upper`, radius 0.170). So the blade must come within
// STANDOFF - TARGET_HURTBOX of its own root axis, measured to the capsule SURFACE.
const STANDOFF_M = 0.60;
const TARGET_HURTBOX_M = 0.17;
const MIN_AXIS_MAX = STANDOFF_M - TARGET_HURTBOX_M;   // 0.43 m, capsule surface to own root axis

// ---- RI-CMB12 ES-REACT/1, as a constraint on the clip ------------------------------------
// The six tracked joints are §A.1's, declared, the same six for every actor. `lie` is the number
// of telegraph frames that are NOT on the screen: a clip's state enters ATK_WINDUP on animation
// frame 1, so `t_label = startup` and `lie = f_vis - 1`. `t_react = (startup + 1) - f_vis`.
const TRACKED_JOINTS = ['hand_r', 'lowerarm_r', 'upperarm_r', 'clavicle_r', 'spine_02', 'head'];
const VIS_DEG = 12;        // §A.1 pose metric
//
// THIS FILE COMPUTES ONLY ONE OF §A.1's TWO METRICS, AND THE OTHER ONE IS SOMETIMES THE BINDING
// ONE. `cmb-exchange.mjs` takes `f_vis` as `min(pose, silhouette)`, or the LATER of the two
// where they disagree by more than four frames. Measured on the champion, in animation frames
// (r4b): chop pose 9 / silhouette 9, this file 9 — exact. thrust pose 10 / silhouette 12, this
// file 9. combo_b pose 6 / silhouette 5, this file 4. combo_a pose 8 / SILHOUETTE 16 — they
// disagree by eight, so the later wins and `lie` is 15 where this file reads 6.
//
// So the figures below are a LOWER BOUND on `lie` and an UPPER BOUND on `t_react`, not the
// numbers RI-CMB12 M1 scores. The budgets are tightened by one frame against the two rows where
// the gap is one frame; NO constant fixes the combo_a case, because the gap there is a metric
// this search cannot afford to run (a 96x96 raster of thirteen capsules per frame per row per
// grid point). `cmb-exchange.mjs --probe react --clips <candidate>` is therefore the ACCEPTANCE
// GATE for anything this solver emits, and the solver is not permitted to mark its own homework.
const LIE_MAX_F = 7;       // §A budget 8, tightened by the measured one-frame proxy error
const T_REACT_MIN_F = 20;  // §A budget 19, tightened by the same frame

// ---- the pose the whole fight returns to -----------------------------------------------
const IDLE = {
  spine_00: { rx: 3 },
  spine_02: { ry: -6 },
  upperarm_r: { rx: -18, rz: -6 },
  lowerarm_r: { rx: -38 },
  upperarm_l: { rx: -12, rz: 6 },
  lowerarm_l: { rx: -30 },
};
const idleOf = (bone, ch) => ((IDLE[bone] || {})[ch] !== undefined ? IDLE[bone][ch] : 0);

// ---- the pose a swing FINISHES in, and why it is inside the active window ----------------
// The blade BURIED: torso pitched over the blow, shoulder come home, elbow folded, the hands
// back at the belly and the weapon hanging down and forward through the attacker's own footprint.
// Every reference clip in corpus/70-visual/refs/souls-behaviour/anim ends its swing here — the
// W1-09 status file's own reading of er-ER_Moveset_Neutral_Attack_Chain_Longsword.gif is
// "recovery is the FOLLOW-THROUGH HELD low across the body" — and rounds 1-3 authored it at
// phase 2.3, i.e. AFTER the hitbox closes at phase 2.0. So the only part of the swing whose
// geometry covers the attacker's own body was the only part that could not hit anything.
//
// Solved, not guessed: these angles are the argmin of the worst-case `min_axis` over the six
// weapon geometries that use an arc archetype (champion 0.10-1.75, axe head 0.64-0.96, and the
// four guard-to-tip classes), subject to the tip staying above -0.50 m (a blade may bite the
// ground, it may not vanish into it), the tip staying in FRONT of the attacker, and the grip
// hand staying above 0.72 m and in front of the pelvis. Worst case at this pose is the axe head
// at 0.407 m axis / 0.317 m surface, against a 0.43 m budget.
const BURY = {
  spine_00: { rx: 14 },
  spine_02: { rx: 8 },
  clavicle_r: { rz: 4 },
  upperarm_r: { rx: 25, rz: -12 },
  lowerarm_r: { rx: -80 },
  hand_r: { rx: 0 },
  upperarm_l: { rx: -24 },
  lowerarm_l: { rx: -58 },
  thigh_l: { rx: 14 },
  thigh_r: { rx: -14 },
  calf_l: { rx: -8 },
  calf_r: { rx: 18 },
};
const buryOf = (bone, ch) => ((BURY[bone] || {})[ch]);

// ---- and the pose a LUNGE starts in ------------------------------------------------------
// The CHAMBER: the point already on line, the hands drawn back to the hip, the elbow closed.
// `RI-CMB04` §B's thrust note says exactly this — "the weapon is chambered beside the hip with
// the point already on line, the body drops into a lunge, and the whole displacement is LINEAR
// along the point" — and the shipped curve did not do it, because `swing` scales the cock TOWARDS
// the fully-extended aim pose, so a thrust solved for peak speed opens its hitbox already half
// extended. Measured on the shipped build: the dagger's own thrust kept its 0.28 m blade 0.62 m
// from its wielder's root axis for the whole active window.
//
// Same derivation as BURY: the argmin of the worst-case min_axis over the guard-to-tip
// geometries, subject to the weapon pointing FORWARD (direction cosine along +Z ≥ 0.80, so it is
// on line and not a chop), not pitched more than 25° off level, the hand between 0.85 m and
// 1.45 m and drawn back inside 0.30 m. Worst case 0.253 m axis against a 0.43 m budget.
const CHAMBER = {
  spine_00: { rx: 2 },
  spine_02: { rx: 1 },
  upperarm_r: { rx: 20, rz: -8 },
  lowerarm_r: { rx: -70 },
  hand_r: { rx: -20 },
  upperarm_l: { rx: -30 },
  lowerarm_l: { rx: -62 },
};
const chamberOf = (bone, ch) => ((CHAMBER[bone] || {})[ch]);

// ---- (a) the idle base loop: motion, no arms -------------------------------------------
const IDLE_LOOP = {
  note:
    'The idle BASE loop. A slow breathing/weight-shift cycle and nothing else — no absolute arm ' +
    'pose, because the arms come from the additive stance layer (idle_ready or block_hold). ' +
    'Before this archetype existed, `_idle` played idle_ready AND the stance layer added ' +
    'idle_ready on top, so a standing character held DOUBLE the authored idle pose and every ' +
    'attack clip ended a whole idle pose away from it: the 1.42-2.54 m single-frame weapon snap ' +
    'the W1-09 verdict §2.5 measured at the attack/idle boundary. It still moves every frame, ' +
    'which is the property RI-CMB04 M1 tests for.',
  root_forward: [[0.0, 0.0], [3.0, 0.0]],
  root_offset: { y: [[0.0, 0.0], [0.75, -0.008], [1.5, 0.0], [2.25, -0.008], [3.0, 0.0]] },
  tracks: {
    spine_00: { rx: [[0.0, 0], [0.75, 0.45], [1.5, 0], [2.25, -0.45], [3.0, 0]] },
    spine_02: { ry: [[0.0, 0], [1.0, 0.55], [2.0, -0.55], [3.0, 0]] },
    neck: { rx: [[0.0, 0], [1.5, 0.5], [3.0, 0]] },
    upperarm_r: { rx: [[0.0, 0], [1.5, 0.8], [3.0, 0]] },
    upperarm_l: { rx: [[0.0, 0], [1.5, -0.8], [3.0, 0]] },
    thigh_l: { rx: [[0.0, 0], [1.5, 0.35], [3.0, 0]] },
    thigh_r: { rx: [[0.0, 0], [1.5, -0.35], [3.0, 0]] },
  },
};

// ---- (b)+(c) the four attack archetypes -------------------------------------------------
// Each track is authored as {cock, hit, follow} plus optional `start`. `start` defaults to the
// idle value; the phase-3.0 key is ALWAYS the idle value. `follow` is the small continuation
// past the last active frame — the blade running out of energy, not the blade carrying on.
const ARCH = {
  cut_diagonal: {
    note:
      'Authored from corpus/70-visual/refs/souls-behaviour/anim/attacks/' +
      'er-ER_Moveset_Neutral_Attack_Chain_Longsword.gif (81 frames, 14.286 fps, MANIFEST record). ' +
      'What that clip shows and what this curve now reproduces: the blade drops back and down ' +
      'behind the right hip, rises to an overhead cock with the torso rotated away and the weight ' +
      'on the back foot, and the cut is a DIAGONAL arc through the centreline led by the hips. ' +
      'The recovery is a short follow-through that DECELERATES onto the ready pose — the ' +
      'reference clip\'s own per-frame motion energy decays monotonically to its resting baseline ' +
      'over the last third of the animation and ends at rest, which the previous curve did not: ' +
      'it over-rotated to a peak at phase 2.4 and then snapped back.',
    cockPhase: 0.45, hitPhase: 1.45, followPhase: 2.2, bury: true, hitFrac: 0.5,
    root_forward: [[0.0, 0.0], [0.55, 0.04], [1.0, 0.34], [1.45, 0.86], [2.0, 0.98], [2.4, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, -0.05], [1.6, -0.11], [2.2, -0.09], [3.0, 0.0]],
    tracks: {
      pelvis: { ry: { cock: -16, hit: 12, follow: 16 } },
      spine_00: { rx: { cock: -8, hit: 12, follow: 15 }, ry: { cock: -20, hit: 14, follow: 18 } },
      spine_02: { ry: { cock: -34, hit: 20, follow: 26 }, rz: { cock: -12, hit: 10, follow: 12 } },
      neck: { ry: { cock: 24, hit: -12, follow: -8 } },
      clavicle_r: { rz: { cock: -26, hit: 12, follow: 15 } },
      upperarm_r: { rx: { cock: -104, hit: -34, follow: -14 }, rz: { cock: -22, hit: 16, follow: 21 } },
      lowerarm_r: { rx: { cock: -40, hit: -10, follow: -18 } },
      hand_r: { rx: { cock: -14, hit: -3, follow: 4 }, rz: { cock: -10, hit: 6, follow: 7 } },
      upperarm_l: { rx: { cock: -22, hit: -32, follow: -28 }, rz: { cock: 16, hit: -6, follow: -3 } },
      lowerarm_l: { rx: { cock: -46, hit: -56, follow: -50 } },
      thigh_l: { rx: { cock: -16, hit: 10, follow: 13 } },
      thigh_r: { rx: { cock: 16, hit: -16, follow: -20 } },
      calf_l: { rx: { cock: 14, hit: -6, follow: -3 } },
      calf_r: { rx: { cock: -14, hit: 18, follow: 14 } },
    },
  },
  chop_overhead: {
    note:
      'Axe. Authored against ds1-boss-moves/Gargoyle-Smash.gif and Artorias_-_Heavy_Slam.gif: the ' +
      'head is raised straight over the shoulder, held, and driven down the centreline with almost ' +
      'no torso twist, and the settle is LONG — the head buries low and the body is pulled back off ' +
      'it. The settle is now authored as a deceleration onto the ready pose rather than a second ' +
      'excursion.',
    aimAtFraction: 0.45,
    cockPhase: 0.5, hitPhase: 1.5, followPhase: 2.3, bury: true, hitFrac: 0.5,
    root_forward: [[0.0, 0.0], [0.6, 0.05], [1.0, 0.32], [1.5, 0.9], [2.0, 0.99], [2.4, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, 0.03], [1.6, -0.13], [2.3, -0.11], [3.0, 0.0]],
    tracks: {
      spine_00: { rx: { cock: -14, hit: 20, follow: 25 } },
      spine_02: { rx: { cock: -10, hit: 14, follow: 17 }, ry: { cock: -14, hit: 6, follow: 8 } },
      clavicle_r: { rz: { cock: -34, hit: 4, follow: 6 } },
      upperarm_r: { rx: { cock: -118, hit: -14, follow: 2 }, rz: { cock: -10, hit: 6, follow: 9 } },
      lowerarm_r: { rx: { cock: -34, hit: -6, follow: -14 } },
      hand_r: { rx: { cock: -14, hit: 2, follow: 8 } },
      upperarm_l: { rx: { cock: -30, hit: -38, follow: -32 } },
      lowerarm_l: { rx: { cock: -52, hit: -62, follow: -54 } },
      thigh_l: { rx: { cock: -12, hit: 12, follow: 16 } },
      thigh_r: { rx: { cock: 12, hit: -12, follow: -16 } },
      calf_l: { rx: { cock: 12, hit: -8, follow: -5 } },
      calf_r: { rx: { cock: -12, hit: 20, follow: 15 } },
    },
  },
  thrust: {
    note:
      'Spear and dagger. Authored against ds1-boss-moves/Ornstein-Thrust.gif and Kings-Thrust.gif: ' +
      'the weapon is chambered beside the hip with the point already on line, the body drops into a ' +
      'lunge, and the whole displacement is LINEAR along the point. Almost no arc — which is exactly ' +
      'why a spear\'s swept volume is a narrow tube and why stepping 20 cm sideways beats it. The ' +
      'recovery pulls the point back off line and settles on the ready pose.',
    aim: 'hit',
    cockPhase: 0.5, hitPhase: 1.4, followPhase: 2.2, bury: false, chamber: true,
    root_forward: [[0.0, 0.0], [0.55, 0.03], [1.0, 0.34], [1.4, 0.9], [2.0, 0.99], [2.3, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, -0.05], [1.5, -0.15], [2.3, -0.12], [3.0, 0.0]],
    tracks: {
      pelvis: { ry: { cock: -26, hit: -4, follow: -6 } },
      spine_00: { rx: { cock: 6, hit: 16, follow: 18 }, ry: { cock: -22, hit: 4, follow: 2 } },
      spine_02: { ry: { cock: -30, hit: 6, follow: 8 } },
      clavicle_r: { rz: { cock: -8, hit: 18, follow: 20 } },
      upperarm_r: { rx: { cock: -46, hit: -84, follow: -78 }, ry: { cock: 18, hit: -6, follow: -4 } },
      lowerarm_r: { rx: { cock: -60, hit: -10, follow: -14 } },
      hand_r: { rx: { cock: 21, hit: 5, follow: 8 } },
      upperarm_l: { rx: { cock: -50, hit: -74, follow: -66 } },
      lowerarm_l: { rx: { cock: -68, hit: -32, follow: -36 } },
      thigh_l: { rx: { cock: -14, hit: 24, follow: 26 } },
      thigh_r: { rx: { cock: 18, hit: -26, follow: -28 } },
      calf_l: { rx: { cock: 10, hit: -20, follow: -16 } },
      calf_r: { rx: { cock: -20, hit: 30, follow: 24 } },
    },
  },
  sweep_wide: {
    note:
      'Halberd. Authored against ds1-boss-moves/Kings-Horizontal.gif and Golem-Side-Slash.gif: drawn ' +
      'to the right rear at shoulder height and swept HORIZONTALLY across the front arc. The old ' +
      'curve over-rotated PAST the target and then unwound, which is how a 108-frame R1 came to ' +
      'sweep 665° at 59.1 m/s. It now arrives on line as the hitbox opens, carries through the arc ' +
      'at a bounded rate, and unwinds onto the ready pose.',
    cockPhase: 0.45, hitPhase: 1.5, followPhase: 2.25, bury: true, hitFrac: 0.5,
    root_forward: [[0.0, 0.0], [0.6, 0.05], [1.0, 0.33], [1.5, 0.88], [2.0, 0.98], [2.35, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, -0.04], [1.6, -0.09], [2.3, -0.07], [3.0, 0.0]],
    tracks: {
      pelvis: { ry: { cock: -20.4, hit: 26, follow: 32 } },
      spine_00: { ry: { cock: -19.0, hit: 24, follow: 29 } },
      spine_02: { ry: { cock: -20.4, hit: 22, follow: 28 }, rx: { cock: -2.7, hit: 6, follow: 8 } },
      neck: { ry: { cock: 21.8, hit: -16, follow: -11 } },
      clavicle_r: { rz: { cock: -9.5, hit: 18, follow: 22 } },
      upperarm_r: { rx: { cock: -58, hit: -94, follow: -60 }, rz: { cock: -20.4, hit: 20, follow: 27 } },
      lowerarm_r: { rx: { cock: -30, hit: -4, follow: -20 } },
      hand_r: { rz: { cock: -19.0, hit: 18, follow: 22 } },
      upperarm_l: { rx: { cock: -40.8, hit: -66, follow: -54 }, rz: { cock: 20.4, hit: -16, follow: -10 } },
      lowerarm_l: { rx: { cock: -38.1, hit: -44, follow: -40 } },
      thigh_l: { rx: { cock: -12.2, hit: 10, follow: 13 } },
      thigh_r: { rx: { cock: 12.2, hit: -18, follow: -22 } },
      calf_l: { rx: { cock: 10.2, hit: -8, follow: -5 } },
      calf_r: { rx: { cock: -10.2, hit: 20, follow: 15 } },
    },
  },
};

/**
 * Build one archetype's track key lists.
 *
 * FOUR knobs, all solved rather than tuned by eye, against THREE of the corpus's own numbers.
 *
 *   `t`     the pose on the LAST STARTUP frame, as a blend cock -> hit. Rounds 1-3 pinned this
 *           at 0.32 and bought their peak-tip-speed budget with `swing` alone; that is the
 *           mechanism behind the defect this round exists to fix. See `swing`.
 *   `swing` scales the cock/hit excursion about the AIM pose. It buys peak tip speed — but the
 *           aim pose of an arc archetype is arm-forward, so shrinking `swing` parks the blade
 *           OUT IN FRONT for the whole active window. At the shipped 0.46 the champion's chop
 *           kept its capsule 0.67 m from its own root axis on every active frame, and a target
 *           standing against its chest could not be cut by anything. `swing` is therefore no
 *           longer allowed to be the only lever.
 *   `ext`   degrees of elbow/shoulder extension at the hit pose. Buys RI-CMB02 §A's reach.
 *   `bury`  0..1, how far the pose at phase 2.0 — the LAST ACTIVE FRAME — travels from `hit`
 *           to the shared BURY pose. This is the knob that did not exist. It buys `min_axis`:
 *           the blade finishes the swing through the attacker's own footprint, INSIDE the
 *           hitbox window, which is what every reference clip does and what makes the dead
 *           ring in front of an attacker impossible rather than merely unmeasured.
 *
 * Curve shape. The active band now carries the arc in TWO segments rather than one ramp:
 * 1.0 (entry) -> 1.0 + hitFrac (maximum extension, where reach is measured) -> 2.0 (buried).
 * Each segment is split once more so a smoothstep hump cannot double the local rate. The
 * recovery is the settle FROM the buried pose, front-loaded and monotone onto idle, so nothing
 * after phase 2.0 moves away from the pose free locomotion holds.
 */
const EXT_CH = { lowerarm_r: 'rx', upperarm_r: 'rx' };

function buildArch(def, t, swing, ext, bury, cham, hitFrac) {
  const tracks = {};
  const hp = def.bury ? (hitFrac === undefined ? (def.hitFrac === undefined ? 0.5 : def.hitFrac) : hitFrac) : 1.0;
  const B = def.bury ? bury : 0;
  const C = def.chamber ? cham : 0;
  for (const bone of Object.keys(def.tracks)) {
    tracks[bone] = {};
    for (const ch of Object.keys(def.tracks[bone])) {
      const k = def.tracks[bone][ch];
      const start = k.start !== undefined ? k.start : idleOf(bone, ch);
      const end = idleOf(bone, ch);
      // `swing` scales the excursion about the AIM pose — the pose in which the weapon is on
      // the target. For a sweep that is the middle of the arc (the blade crosses the
      // centreline mid-window); for a thrust it is the fully extended pose at the end of it.
      // Scaling about the wrong one is how a solve that satisfied RI-CMB04 §B's peak column
      // produced a spear whose point never came within 0.35 m of the centreline at all.
      const af = def.aim === 'hit' ? 1 : (def.aimAtFraction === undefined ? 0.5 : def.aimAtFraction);
      const aim = k.cock + (k.hit - k.cock) * af;
      const sc = (v) => aim + (v - aim) * swing;
      let cock = sc(k.cock), hit = sc(k.hit), fol = sc(k.follow);
      // elbow/shoulder extension, added only at and after the hit pose — it lengthens the
      // weapon's stand-off, which is what `reach_m` in RI-CMB02 §A actually measures.
      // `ext` points the whole arm further FORWARD through the swing rather than only at its
      // end: forward reach is set by where the arm is when the blade crosses the centreline,
      // which is the middle of the active window, not its last frame. On this rig a more
      // negative `upperarm_r.rx` raises the arm towards horizontal-forward (the `thrust`
      // archetype reaches 3.03 m at -84) and a less negative `lowerarm_r.rx` straightens the
      // elbow.
      if (bone === 'upperarm_r' && ch === 'rx') { cock -= ext; hit -= ext; fol -= ext * 0.5; }
      if (bone === 'lowerarm_r' && ch === 'rx') { cock += ext * 0.6; hit += ext * 0.6; fol += ext * 0.3; }
      // The pose at the LAST ACTIVE frame. For an arc archetype this is the blade buried
      // through the attacker's own footprint; for a thrust it is the fully extended point,
      // because a lunge that RETRACTS inside its own hitbox window is not a thrust.
      const bv = buryOf(bone, ch);
      const endActive = (B > 0 && bv !== undefined) ? hit + (bv - hit) * B : hit;
      // the settle: from the pose the swing ENDED in, monotonically onto idle
      const settle = endActive + (end - endActive) * 0.30;
      let v1 = cock + t * (hit - cock);
      // The pose the hitbox OPENS on. For a lunge that is the chamber, and it is authored
      // rather than left to fall out of `swing`.
      const cv = chamberOf(bone, ch);
      if (C > 0 && cv !== undefined) v1 = v1 + (cv - v1) * C;
      const seg = (a, b, u) => a + (b - a) * u;
      const keys = [
        [0.0, r(start)],
        [def.cockPhase, r(cock)],
        [1.0, r(v1)],
      ];
      if (hp < 1.0) {
        // Both active sub-segments are split into THREE, not one. A smoothstep segment peaks at
        // 1.5x its own mean rate, so a single key from `hit` to `bury` spends half the frames of
        // the swing travelling at 1.5x the speed the frame count implies — which is most of why
        // the arc archetypes could not fit under RI-CMB04 §B's column once the bury was inside
        // the window. Subdividing pushes the local rate toward the mean without changing a
        // single pose.
        for (let i = 1; i <= 2; i++) keys.push([1.0 + hp * (i / 3), r(seg(v1, hit, i / 3))]);
        keys.push([1.0 + hp, r(hit)]);
        for (let i = 1; i <= 3; i++) keys.push([1.0 + hp + (1 - hp) * (i / 4), r(seg(hit, endActive, i / 4))]);
        keys.push([2.0, r(endActive)]);
      } else {
        keys.push([1.25, r(seg(v1, hit, 0.25))]);
        keys.push([1.5, r(seg(v1, hit, 0.5))]);
        keys.push([1.75, r(seg(v1, hit, 0.75))]);
        keys.push([2.0, r(hit)]);
      }
      keys.push([def.followPhase, r(B > 0 && bv !== undefined ? settle : fol)]);
      const base = B > 0 && bv !== undefined ? settle : fol;
      keys.push([2.0 + (def.followPhase - 2.0) + 0.45 * (3.0 - def.followPhase), r(base + 0.55 * (end - base))]);
      keys.push([2.0 + (def.followPhase - 2.0) + 0.78 * (3.0 - def.followPhase), r(base + 0.88 * (end - base))]);
      keys.push([3.0, r(end)]);
      tracks[bone][ch] = keys;
    }
  }
  if (C > 0) {
    for (const bone of Object.keys(CHAMBER)) {
      for (const ch of Object.keys(CHAMBER[bone])) {
        if (tracks[bone] && tracks[bone][ch]) continue;
        const end = idleOf(bone, ch);
        const v1 = end + (CHAMBER[bone][ch] - end) * C;
        tracks[bone] = tracks[bone] || {};
        tracks[bone][ch] = [
          [0.0, r(end)], [def.cockPhase, r(v1)], [1.0, r(v1)],
          [2.0, r(end)], [3.0, r(end)],
        ];
      }
    }
  }
  // Bones the BURY pose moves that the archetype's own swing never touched still have to get
  // there and back, or the arm arrives at the buried pose with half of itself still in the
  // swing. They are authored as a pure 1.0 -> 2.0 -> idle excursion.
  if (B > 0) {
    for (const bone of Object.keys(BURY)) {
      for (const ch of Object.keys(BURY[bone])) {
        if (tracks[bone] && tracks[bone][ch]) continue;
        const end = idleOf(bone, ch);
        const endActive = end + (BURY[bone][ch] - end) * B;
        const settle = endActive + (end - endActive) * 0.30;
        tracks[bone] = tracks[bone] || {};
        tracks[bone][ch] = [
          [0.0, r(end)], [def.cockPhase, r(end)], [1.0, r(end)],
          [2.0, r(endActive)], [def.followPhase, r(settle)],
          [2.0 + (def.followPhase - 2.0) + 0.45 * (3.0 - def.followPhase), r(settle + 0.55 * (end - settle))],
          [3.0, r(end)],
        ];
      }
    }
  }
  // Every channel `idle_ready` holds MUST appear in every attack archetype, even if the swing
  // does not move it: a channel the archetype is silent about is written as 0 by
  // Clip.applyPose(), which is NOT the idle value, so the first and last frames of the clip
  // would differ from the idle pose by exactly that channel. That is a boundary snap with no
  // motion in it at all — 6 degrees of shoulder is 0.27 m at a spear's tip.
  for (const bone of Object.keys(IDLE)) {
    for (const ch of Object.keys(IDLE[bone])) {
      tracks[bone] = tracks[bone] || {};
      if (!tracks[bone][ch]) tracks[bone][ch] = [[0.0, IDLE[bone][ch]], [3.0, IDLE[bone][ch]]];
    }
  }
  return {
    note: def.note,
    solved: {
      startup_blend: +t.toFixed(3), swing_scale: +swing.toFixed(3),
      elbow_extension_deg: +ext.toFixed(1), bury: +(def.bury ? bury : 0).toFixed(3),
      chamber: +(def.chamber ? cham : 0).toFixed(3),
      hit_phase_fraction: hp,
    },
    solved_note:
      'Solved by tools/harness/anim-author.mjs against THREE of the corpus\'s own numbers at once, ' +
      'for every player class AND every enemy statblock that selects this archetype: ' +
      '(1) RI-CMB04 §B\'s peak_tip_speed_mps as a ceiling, measured over EVERY frame of the clip ' +
      'and not only the active ones — the round-3 build satisfied it on the active window and ran ' +
      'at x2.4 in the startup of a chain clip; (2) RI-CMB02 §A\'s reach_m as a floor; and (3) ' +
      'min_axis — the distance from the swept hitbox capsule\'s SURFACE to the attacker\'s own root ' +
      'axis at its closest approach during the active window — as a ceiling of ' +
      '`bodies.player_radius_m + bodies.default_enemy_radius_m - torso_upper.radius_m` = 0.43 m, ' +
      'so that anything the attacker\'s body can shove, its weapon can also cut. The search takes ' +
      'the LARGEST swing and the SMALLEST elbow extension that satisfy all three.',
    root_forward: def.root_forward,
    root_offset: { y: def.root_offset_y },
    tracks,
  };
}
function r(v) { return Math.round(v * 100) / 100; }

// ---- the measurement the solver optimises against ---------------------------------------
// Rows are (clip, weapon geometry, frame counts) triples. EVERY consumer of an archetype is a
// row, player and enemy alike: rounds 1-3 solved against the seven player spine rows only, and
// the champion — whose weapon is 1.75 m and whose chop is the attack the whole remediation is
// about — was never in the objective at all.
function rowsFor(archName) {
  const rows = [];
  for (const id of CLASSES) {
    const ms = spine[id];
    for (const mv of ['light', 'heavy']) {
      const base = ms.moves[mv];
      const variants = [[base, true]];
      const th = ms.moves.two_handed && ms.moves.two_handed[mv];
      if (th) variants.push([Object.assign({}, base, th), false]);
      for (const [m, isOneHanded] of variants) {
        if (m.archetype !== archName) continue;
        rows.push({
          label: id + ':' + mv + (isOneHanded ? '' : ':2h'),
          anim: m.anim, amplitude: m.amplitude, root_dz_m: m.root_dz_m,
          timing: { startup: base.startup, active: base.active, total: base.total },
          weapon: ms.weapon, hitboxR: ms.weapon.radius_m,
          declPeak: ms.weapon.peak_tip_speed_mps_declared,
          declReach: isOneHanded ? (base.reach_m_declared || null) : null,
          coversStandoff: coversStandoff(ms.weapon.socket_a_dist_m),
          played: false,
        });
      }
    }
  }
  for (const eid of Object.keys(ENEMIES)) {
    const st = ENEMIES[eid];
    if (st.id === 'probe_pulse') continue;         // an 8 m instrument pulse, not a weapon
    // (enemy rows are marked `played: true` below — see the note on `played` above rowsFor.)
    for (const k of Object.keys(st.attacks || {})) {
      const a = st.attacks[k];
      if ((a.archetype || 'cut_diagonal') !== archName) continue;
      rows.push({
        label: eid + ':' + k, anim: a.anim, amplitude: 1.0, root_dz_m: a.root_dz_m || 0,
        timing: { startup: a.startup, active: a.active, total: a.startup + a.active + a.recovery },
        weapon: st.weapon, hitboxR: a.hitbox_radius_m !== undefined ? a.hitbox_radius_m : st.weapon.radius_m,
        declPeak: st.weapon.peak_tip_speed_mps_declared || null,
        declReach: null,
        coversStandoff: coversStandoff(st.weapon.socket_a_dist_m),
        played: true,
      });
    }
  }
  // Many statblocks are the same weapon with the same frame data under different names (the
  // material-probe roster, the camera roster). Identical rows measure identically; keeping one
  // of each is what makes the three-constraint search finish.
  const seen = new Map();
  for (const row of rows) {
    const w = row.weapon;
    const key = [w.socket_a_dist_m, w.socket_b_dist_m, row.hitboxR, row.declPeak, row.declReach,
      row.timing.startup, row.timing.active, row.timing.total, row.amplitude, row.root_dz_m,
      row.played].join('|');
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

/**
 * Can this weapon's hitbox capsule geometrically reach its wielder's own standoff boundary?
 *
 * The near end of the capsule sits `socket_a_dist_m` from the grip hand, and the grip hand
 * cannot be drawn closer to the root axis than about 0.10 m without putting the arm through the
 * pelvis. A hafted weapon whose hitbox is declared to START a metre down the shaft — RI-CMB04
 * §B gives the spear `wpn_mid` and the halberd `wpn_head_a`, which `spine/*.json` place at 1.31 m
 * and 1.11 m from the hand — therefore has a MINIMUM ENGAGEMENT RANGE, and no pose can remove it.
 * That is not a defect: it is what a polearm is, and it is why you roll INTO a spearman. It is
 * declared per class rather than tuned away, and the body corridor (`§body_hazard`, which now
 * deals BODY damage) is what covers it.
 */
function coversStandoff(socketADist) { return socketADist <= 0.35; }

function measureArch(archName, archObj, rowsCache) {
  const rows = rowsCache || rowsFor(archName);
  let worstPeak = 0, worstPeakRow = null;
  let worstReach = Infinity, worstReachRow = null;
  let worstAxis = 0, worstAxisRow = null;
  let worstWorld = 0, worstTravel = 0, worstTravelRow = null;
  let worstLie = 0, worstLieRow = null, worstReact = Infinity, worstReactRow = null;
  for (const row of rows) {
    const clip = new Clip(row.anim, archObj, row.timing, row.amplitude, row.root_dz_m);
    const t = trackOf(clip, row.weapon, row.timing, row.hitboxR);
    if (row.declPeak) {
      const pr = t.peak / row.declPeak;
      if (pr > worstPeak) { worstPeak = pr; worstPeakRow = row.label; }
    }
    if (row.declReach) {
      const rr = t.reach / row.declReach;
      if (rr < worstReach) { worstReach = rr; worstReachRow = row.label; }
    }
    // MIN-AXIS BINDS ONLY ON ROWS THE GAME ACTUALLY PLAYS.
    //
    // `game/data/combat/spine/*.json` is the seven-class W1-09 spine. `moveset.js` states
    // plainly that it "is no longer read by the fight at all — its ids survive as aliases onto
    // the roster baselines": every player swing in the running game is synthesised by
    // `swing.js buildSwing()` from `clip-registry.json`, whose capsule already runs GRIP-to-tip
    // (`socketsFor`: `a: GRIP_OFFSET_M`), so the player side has no dead inboard band to close.
    // The consumers of `clips.json §archetypes` are the ENEMY statblocks.
    //
    // Rounds 1-3 solved against the spine rows ONLY and the champion — whose chop is the attack
    // the whole remediation is about — was never in the objective. This is the opposite error
    // and it is guarded the opposite way: peak tip speed and reach still bind on EVERY row,
    // played or not, so a spine row cannot be quietly allowed to break RI-CMB04 §B. Only
    // `min_axis` is restricted, and only because an unplayed row's inboard geometry cannot put
    // a hole in a fight. Measured: with the spine rows binding, `sweep_wide` has NO feasible
    // point at all (best 0.536 m, set by `greatsword:heavy:2h`, a move the fight never plays)
    // and the archetype every enemy sweep uses stays at round 3's geometry.
    if (row.played && row.coversStandoff && t.minAxis > worstAxis) { worstAxis = t.minAxis; worstAxisRow = row.label; }
    // RI-CMB12 §A, on the rows the game plays. A clip that buys peak tip speed by shrinking its
    // whole excursion is a clip whose windup is invisible.
    if (row.played) {
      const lie = t.visFrame - 1;
      const tReact = (row.timing.startup + 1) - t.visFrame;
      if (lie > worstLie) { worstLie = lie; worstLieRow = row.label; }
      if (tReact < worstReact) { worstReact = tReact; worstReactRow = row.label; }
    }
    if (t.peakWorld > worstWorld) worstWorld = t.peakWorld;
    if (t.travel / row.hitboxR > worstTravel) { worstTravel = t.travel / row.hitboxR; worstTravelRow = row.label; }
  }
  if (worstReach === Infinity) worstReach = 1;
  if (worstReact === Infinity) worstReact = 999;
  return { peak: worstPeak, peakRow: worstPeakRow, reach: worstReach, reachRow: worstReachRow,
    axis: worstAxis, axisRow: worstAxisRow, world: worstWorld, travelRadii: worstTravel, travelRow: worstTravelRow,
    lie: worstLie, lieRow: worstLieRow, react: worstReact, reactRow: worstReactRow };
}

// One rig, reused. `evaluate()` allocates nothing, and the solver runs this tens of thousands
// of times.
const _rig = new Rig(skel, hitgeo);
function trackOf(clip, w, m, hitboxR) {
  const rig = _rig;
  const pos = [0, 0, 0];
  const r = hitboxR === undefined ? w.radius_m : hitboxR;
  let z = 0, px = 0, py = 0, pz = 0, pz0 = 0, hasPrev = false;
  let ax = 0, ay = 0, az = 0;
  let peak = 0, peakWorld = 0, travel = 0, reach = 0, minAxis = Infinity;
  // RI-CMB12 §A.1's POSE METRIC, computed here so the reactability budget is a CONSTRAINT on the
  // clip rather than a measurement taken after it ships. `f_vis` is the first animation frame at
  // which the max absolute Euler deviation over the six declared tracked joints reaches 12°
  // against the pose the actor held before it committed — which, for a clip played from idle, is
  // the idle stance. Round 4's first solve shrank `swing_scale` to 0.22 to buy peak tip speed
  // for a bury inside the active window, and that pushed `f_vis` from 20 to 27 on the champion's
  // combo_a: `lie` 6 -> 15 f@60 and `t_react` 38 -> 29. Trading RI-CMB04 §B against RI-CMB12 §A
  // is exactly the "closed the named gap by moving the defect elsewhere" failure this round was
  // dispatched to stop, so both are in the objective now.
  let visFrame = null;
  for (let f = 1; f <= m.total; f++) {
    z += clip.rootDeltaAt(f);
    clip.applyPose(rig, f);
    pos[2] = z;
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), w.socket_a_dist_m, w.socket_b_dist_m);
    const a = rig.socketA, b = rig.socketB;
    // RI-CMB04 §B's peak_tip_speed_mps is a property of the WEAPON, not of a window: round 3
    // measured it over the ACTIVE frames only and shipped a chain clip whose STARTUP ran at
    // 39.6-45.2 m/s against a declared 18.5. Every frame of the clip counts here.
    //
    // And it is a property of the SWING, measured in the attacker's own frame. A weapon's peak
    // tip speed is how fast you can swing it; it is not raised by the fact that you are also
    // running. Held in WORLD space the column becomes a speed limit on root motion — the
    // slitherfang's 2.2 m lunge alone puts its fang through a 22 m/s ceiling with the arm
    // completely still — and RI-CMB01/RI-CMB02 own root_dz, not RI-CMB04. What world-space
    // travel governs instead is SWEEP CONTINUITY, and that is `travel`, which is what the
    // substep count is derived from (hitgeometry.json §sweep.substeps).
    if (hasPrev) {
      const d = Math.hypot(b[0] - px, b[1] - py, (b[2] - z) - pz) * 60;
      if (d > peak) peak = d;
      const dw = Math.hypot(b[0] - px, b[1] - py, b[2] - pz0) * 60;
      if (dw > peakWorld) peakWorld = dw;
      const da = Math.hypot(a[0] - ax, a[1] - ay, a[2] - az);
      if (dw / 60 > travel) travel = dw / 60;
      if (da > travel) travel = da;
    }
    if (f > m.startup && f <= m.startup + m.active) {
      for (let u = 0; u <= 1.0001; u += 0.05) {
        const qx = a[0] + (b[0] - a[0]) * u, qz = a[2] + (b[2] - a[2]) * u, qy = a[1] + (b[1] - a[1]) * u;
        if (Math.abs(qx) <= 0.35 && qz > reach) reach = qz;
        // min_axis: closest approach of the capsule SURFACE to the attacker's own root axis,
        // counted only where a hurtbox could be — a blade that passes 3 m over your head or
        // 0.5 m under the floor is not covering your body.
        if (qy < 0.10 || qy > 1.85) continue;
        const dd = Math.hypot(qx, qz - z) - r;
        if (dd < minAxis) minAxis = dd;
      }
    }
    if (visFrame === null) {
      let dev = 0;
      for (const bone of TRACKED_JOINTS) {
        const i = rig.index.get(bone);
        if (i === undefined) continue;
        const d = Math.max(Math.abs(rig.rx[i] - idleOf(bone, 'rx')), Math.abs(rig.ry[i] - idleOf(bone, 'ry')), Math.abs(rig.rz[i] - idleOf(bone, 'rz')));
        if (d > dev) dev = d;
      }
      if (dev >= VIS_DEG) visFrame = f;
    }
    px = b[0]; py = b[1]; pz = b[2] - z; pz0 = b[2]; ax = a[0]; ay = a[1]; az = a[2]; hasPrev = true;
  }
  return { peak, peakWorld, travel, reach, minAxis: minAxis === Infinity ? 99 : minAxis,
    visFrame: visFrame === null ? m.total : visFrame };
}

// ---- solve ------------------------------------------------------------------------------
const PEAK_MAX = 0.99;     // fraction of RI-CMB04 §B's declared column, every frame of the clip
const REACH_MIN = 0.90;    // fraction of RI-CMB02 §A's declared reach
const solved = {};

/**
 * WHAT IS HARD AND WHAT IS RANKED, and why round 4a got this wrong twice.
 *
 * HARD: `RI-CMB04` §B's peak tip speed column and `RI-CMB02` §A's reach floor. Both are numbers
 * the corpus declares and both are measured on EVERY row, played or not.
 *
 * RANKED, in this order, over the points that clear both:
 *   1. `lie`      — RI-CMB12 §A. A windup nobody can see is the defect this round exists to stop.
 *   2. `t_react`  — the same item's other budget.
 *   3. `min_axis` — RI-CMB04 M8's inboard geometry, on the rows the game plays.
 *   4. `swing`    — the largest excursion, then 5. the smallest elbow extension.
 *
 * Round 4a's search made three mistakes that this ordering and the loop below remove.
 *
 * (a) It `break`ed out of the `ext` loop on the first feasible point, so a whole region was
 *     never examined. Measured: `thrust` shipped at `ext 0, swing 0.22` with `lie 8`, while
 *     `ext 50, swing 0.49` clears every hard constraint (peak 0.989x, reach 1.014x) at
 *     `lie 6` and `min_axis 0.235` — strictly better on all five keys. It was invisible to the
 *     search because `ext 0` had already produced *a* feasible point at that `t`.
 * (b) It folded `min_axis` into a weighted `miss` alongside peak and reach, so an archetype with
 *     NO feasible `min_axis` (`sweep_wide` — a horizontal sweep cannot pass 0.43 m from its own
 *     root axis, §11.3) fell through to `closest`, which minimises the weighted sum and
 *     therefore bought inboard geometry it could never reach with excursion it needed for the
 *     telegraph. That is how `sweep_wide` came to ship at `swing 0.13` and `lie 15`.
 * (c) The `swing` step was coarsened to 0.09 to make the solve finish, and the answer for
 *     `sweep_wide` lives between two grid points: 0.13 reads `lie 15` live and 0.18 reads 7,
 *     and the grid samples 0.13 then 0.22. A local refinement pass at 0.01 now follows the
 *     coarse pass, so the coarse grid only has to find the right basin.
 */
const KEY = (c) => [c.m.lie, -c.m.react, c.m.axis, -c.swing, c.ext];
function better(a, b) {                     // true when `a` beats `b`
  if (!b) return true;
  const ka = KEY(a), kb = KEY(b);
  for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i] - 1e-9) return true; if (ka[i] > kb[i] + 1e-9) return false; }
  return false;
}

// ---- `--gate`: let the instrument that SCORES the build choose, not the proxy ---------------
//
// The ranking above uses this file's `lie`, which is §A.1's POSE metric only. Measured (r4b),
// that proxy MISRANKS on two of the four archetypes, and not by a constant:
//
//   chop_overhead   proxy prefers swing 0.29 / bury 0.85 (lie 8, min_axis 0.188)
//                   -> `cmb-exchange` reads lie 9 on champion:chop.  REJECTED.
//   sweep_wide      proxy prefers swing 0.11 / hitFrac 0.40 (lie 5)
//                   -> `cmb-exchange` reads lie 14 on champion:combo_a.  REJECTED.
//
// So the solver keeps a ranked SHORTLIST rather than a single winner, and `--gate` walks it in
// rank order, writing each candidate to a scratch file and grading it with
// `cmb-exchange.mjs --probe react --clips <that file>`. The first candidate whose champion rows
// clear RI-CMB12 §A's own budgets wins. This is slow — about 25 s a candidate — and it is the
// only way the answer is not a hand-pick.
const GATE = process.argv.includes('--gate');
const GATE_K = Number(process.argv.includes('--gate-k') ? process.argv[process.argv.indexOf('--gate-k') + 1] : 24);
const ONLY = process.argv.includes('--only') ? String(process.argv[process.argv.indexOf('--only') + 1]).split(',') : null;
const SHORTLIST = [];
/** Keep the best GATE_K distinct (t, swing, ext, bury, cham, hitFrac) points, in rank order. */
function shortlistPush(list, c) {
  const k = [c.t, c.swing, c.ext, c.bury, c.cham, c.hitFrac].map((v) => Number(v).toFixed(3)).join('|');
  if (list.some((x) => x._k === k)) return;
  c._k = k;
  list.push(c);
  list.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
  if (list.length > GATE_K) list.length = GATE_K;
}
/**
 * Grade a shortlist with `cmb-exchange.mjs` and return the first candidate that clears
 * `RI-CMB12` §A on every champion attack this archetype drives. Returns null when none does,
 * in which case the proxy's own winner stands and the report has to say so.
 */
function gate(name, list) {
  const tmp = path.join(ROOT, 'reports/w1-09/_gate-candidate.json');
  const moves = [];
  for (const eid of Object.keys(ENEMIES)) {
    if (eid !== 'champion_hist_marked') continue;
    for (const k of Object.keys(ENEMIES[eid].attacks || {})) {
      if ((ENEMIES[eid].attacks[k].archetype || 'cut_diagonal') === name) moves.push(k);
    }
  }
  if (!moves.length) return null;
  let bestGraded = null;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const doc = JSON.parse(fs.readFileSync(clipsPath, 'utf8'));
    doc.archetypes[name] = c.a;
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 1) + '\n');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/harness/cmb-exchange.mjs'),
      '--probe', 'react', '--moves', moves.join(','), '--clips', tmp, '--out', tmp + '.out'],
    { encoding: 'utf8', timeout: 300000 });
    if (r.status !== 0 && !fs.existsSync(tmp + '.out')) continue;
    const R = JSON.parse(fs.readFileSync(tmp + '.out', 'utf8'));
    const per = (R.probes && R.probes.react && R.probes.react.per_attack) || [];
    const lie = Math.max(...per.map((p) => p.lie));
    const react = Math.min(...per.map((p) => p.t_react));
    const ok = lie <= 8 && per.every((p) => p.declared_reactable === false || p.t_react >= 19);
    console.log(`    gate ${name} #${i} swing=${c.swing.toFixed(2)} ext=${c.ext} bury=${c.bury} hf=${c.hitFrac}  proxy lie ${c.m.lie} -> LIVE lie ${lie}, t_react ${react}  ${ok ? 'PASS' : 'reject'}`);
    if (!bestGraded || lie < bestGraded.lie) bestGraded = { lie, react, c };
    if (ok) { try { fs.unlinkSync(tmp); fs.unlinkSync(tmp + '.out'); } catch (e) { /* */ } return c; }
  }
  try { fs.unlinkSync(tmp); fs.unlinkSync(tmp + '.out'); } catch (e) { /* */ }
  if (bestGraded) {
    console.log(`    gate ${name}: NO candidate clears RI-CMB12 §A; best live lie ${bestGraded.lie}, t_react ${bestGraded.react}`);
    return bestGraded.c;
  }
  return null;
}

for (const name of Object.keys(ARCH)) {
  if (ONLY && !ONLY.includes(name)) { solved[name] = clipsDoc.archetypes[name]; continue; }
  const _t0 = Date.now();
  const rows = rowsFor(name);
  const def = ARCH[name];
  const buryOpts = def.bury ? [1.0, 0.85, 0.7, 0.55, 0.4] : [0];
  const chamOpts = def.chamber ? [1.0, 0.85, 0.7, 0.55] : [0];
  let best = null, closest = null;
  /** The largest `swing` at this cell that clears BOTH hard constraints, or null. Peak rises
   *  monotonically with excursion and `lie` falls with it, so the largest feasible swing is
   *  also the lie-minimal one for the cell; that is what licenses the inner break. */
  const cell = (t, swing0, swing1, dsw, ext, bury, cham, hitFrac) => {
    for (let swing = swing0; swing >= swing1 - 1e-9; swing -= dsw) {
      const a = buildArch(def, t, swing, ext, bury, cham, hitFrac);
      const m = measureArch(name, a, rows);
      const miss = Math.max(0, m.peak - PEAK_MAX) * 6 + Math.max(0, REACH_MIN - m.reach) * 3
        + Math.max(0, m.axis - MIN_AXIS_MAX)
        + Math.max(0, m.lie - LIE_MAX_F) * 0.05 + Math.max(0, T_REACT_MIN_F - m.react) * 0.05;
      if (!closest || miss < closest.miss - 1e-9) closest = { a, m, t, swing, ext, bury, cham, hitFrac, miss };
      if (m.peak <= PEAK_MAX && m.reach >= REACH_MIN) return { a, m, t, swing, ext, bury, cham, hitFrac };
    }
    return null;
  };
  for (const bury of buryOpts) {
   for (const cham of chamOpts) {
    for (const hitFrac of (def.bury ? [0.2, 0.3, 0.45, 0.6] : [1])) {
     for (let t = 0.00; t <= 0.801; t += 0.10) {
      for (let ext = 0; ext <= 70; ext += 10) {
        const hit = cell(t, 1.30, 0.05, 0.09, ext, bury, cham, hitFrac);
        if (hit) { if (better(hit, best)) best = hit; if (GATE) shortlistPush(SHORTLIST, hit); }
      }
     }
    }
   }
  }
  if (!best) {
    best = closest;
    console.log(`${name.padEnd(16)} NO feasible point: peak ${best.m.peak.toFixed(3)}x (${best.m.peakRow}) reach ${best.m.reach.toFixed(3)}x (${best.m.reachRow}) min_axis ${best.m.axis.toFixed(3)} m (${best.m.axisRow}) lie ${best.m.lie}f t_react ${best.m.react}f`);
  } else {
    // LOCAL REFINEMENT. The coarse pass located the basin; this walks it at the resolution the
    // answer actually lives at. `sweep_wide` moves from `lie 6 / swing 0.13` to the 0.14-0.21
    // band the coarse grid steps straight over.
    // Every knob is refined, not just `t` and `ext`: `sweep_wide`'s only feasible corner sits at
    // `hitFrac 0.50`, which is not on the coarse list [0.2, 0.3, 0.45, 0.6] at all, and holding
    // the coarse pass's `hitFrac` fixed while refining the others would step straight past it.
    const b0 = best;
    const span = (v, d, step, lo, hi) => { const o = []; for (let x = Math.max(lo, v - d); x <= Math.min(hi, v + d) + 1e-9; x += step) o.push(+x.toFixed(3)); return o; };
    const tS = span(b0.t, 0.10, 0.05, 0, 0.80);
    const eS = span(b0.ext, 10, 5, 0, 70);
    const hS = def.bury ? span(b0.hitFrac, 0.10, 0.05, 0.10, 0.90) : [1];
    const bS = def.bury ? span(b0.bury, 0.15, 0.05, 0.10, 1.00) : [0];
    const cS = def.chamber ? span(b0.cham, 0.15, 0.05, 0.10, 1.00) : [0];
    for (const t of tS) for (const ext of eS) for (const hitFrac of hS) for (const bury of bS) for (const cham of cS) {
      const hit = cell(t, Math.min(1.30, b0.swing + 0.09), Math.max(0.05, b0.swing - 0.09), 0.01,
        ext, bury, cham, hitFrac);
      if (hit) { if (better(hit, best)) best = hit; if (GATE) shortlistPush(SHORTLIST, hit); }
    }
  }
  if (GATE && SHORTLIST.length) {
    const g = gate(name, SHORTLIST);
    if (g) best = g;
    SHORTLIST.length = 0;
  }
  solved[name] = best.a;
  console.log(`[${((Date.now() - _t0) / 1000).toFixed(0)}s] ${name.padEnd(16)} t=${best.t.toFixed(2)} swing=${best.swing.toFixed(2)} ext=${best.ext} bury=${best.bury} chamber=${best.cham} hitFrac=${best.hitFrac}  ` +
    `peak=${best.m.peak.toFixed(3)}x (${best.m.peakRow})  reach=${best.m.reach.toFixed(3)}x (${best.m.reachRow})  min_axis=${best.m.axis.toFixed(3)} m (${best.m.axisRow})  ` +
    `lie=${best.m.lie}f (${best.m.lieRow})  t_react=${best.m.react}f (${best.m.reactRow})  ` +
    `world_peak=${best.m.world.toFixed(1)} m/s  travel=${best.m.travelRadii.toFixed(2)} radii/frame (${best.m.travelRow})`);
}

// `--out <path>` writes the solve somewhere ELSE. Round 4a's solve wrote straight into
// `game/data/combat/clips.json` and the regression it carried (`RI-CMB12` M1: lie 9/13/15/4
// against an 8-frame budget) was in the shipping data for the rest of the session, because the
// only copy of the answer was the game's own file. A solve is a candidate until
// `cmb-exchange.mjs --probe react --clips <that file>` has passed it; `--out` is what lets that
// sentence be true.
const OUT_PATH = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
if (process.argv.includes('--write') || OUT_PATH) {
  for (const name of Object.keys(solved)) clipsDoc.archetypes[name] = solved[name];
  clipsDoc.archetypes.idle_loop = IDLE_LOOP;
  clipsDoc.phase_parameterisation.termination_rule =
    'BINDING. Every non-looping archetype whose clip can be followed by free locomotion must ' +
    'have, at phase 3.0, exactly the value the `idle_ready` stance layer holds for that bone ' +
    '(0 where idle_ready is silent). The attack/idle boundary is then continuous by ' +
    'construction. Before this rule, a straight-sword R1 moved its tip 1.42 m and a halberd R1 ' +
    '2.54 m in the single frame the move retired — 85 to 152 m/s of pose discontinuity, ' +
    'W1-09 verdict §2.5.';
  const dest = OUT_PATH || clipsPath;
  fs.writeFileSync(dest, JSON.stringify(clipsDoc, null, 1) + '\n');
  console.log('written ' + dest);
}
