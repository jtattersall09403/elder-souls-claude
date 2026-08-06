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
// Run: node tools/harness/anim-author.mjs [--write]   (default is a dry run)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    cockPhase: 0.45, hitPhase: 1.45, followPhase: 2.2,
    root_forward: [[0.0, 0.0], [0.55, 0.04], [1.0, 0.34], [1.45, 0.86], [2.0, 0.98], [2.4, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, -0.05], [1.6, -0.11], [2.2, -0.09], [3.0, 0.0]],
    tracks: {
      pelvis: { ry: { cock: -16, hit: 12, follow: 16 } },
      spine_00: { rx: { cock: -8, hit: 12, follow: 15 }, ry: { cock: -20, hit: 14, follow: 18 } },
      spine_02: { ry: { cock: -34, hit: 20, follow: 26 }, rz: { cock: -12, hit: 10, follow: 12 } },
      neck: { ry: { cock: 24, hit: -12, follow: -8 } },
      clavicle_r: { rz: { cock: -26, hit: 12, follow: 15 } },
      upperarm_r: { rx: { cock: -80, hit: -22, follow: -14 }, rz: { cock: -22, hit: 16, follow: 21 } },
      lowerarm_r: { rx: { cock: -34, hit: -14, follow: -17 } },
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
    cockPhase: 0.5, hitPhase: 1.5, followPhase: 2.3,
    root_forward: [[0.0, 0.0], [0.6, 0.05], [1.0, 0.32], [1.5, 0.9], [2.0, 0.99], [2.4, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, 0.03], [1.6, -0.13], [2.3, -0.11], [3.0, 0.0]],
    tracks: {
      spine_00: { rx: { cock: -14, hit: 20, follow: 25 } },
      spine_02: { rx: { cock: -10, hit: 14, follow: 17 }, ry: { cock: -14, hit: 6, follow: 8 } },
      clavicle_r: { rz: { cock: -34, hit: 4, follow: 6 } },
      upperarm_r: { rx: { cock: -86, hit: -32, follow: -20 }, rz: { cock: -10, hit: 6, follow: 9 } },
      lowerarm_r: { rx: { cock: -30, hit: -13, follow: -18 } },
      hand_r: { rx: { cock: -14, hit: -2, follow: 5 } },
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
    cockPhase: 0.5, hitPhase: 1.4, followPhase: 2.2,
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
    cockPhase: 0.45, hitPhase: 1.5, followPhase: 2.25,
    root_forward: [[0.0, 0.0], [0.6, 0.05], [1.0, 0.33], [1.5, 0.88], [2.0, 0.98], [2.35, 1.0], [3.0, 1.0]],
    root_offset_y: [[0.0, 0.0], [1.0, -0.04], [1.6, -0.09], [2.3, -0.07], [3.0, 0.0]],
    tracks: {
      pelvis: { ry: { cock: -30, hit: 26, follow: 32 } },
      spine_00: { ry: { cock: -28, hit: 24, follow: 29 } },
      spine_02: { ry: { cock: -30, hit: 22, follow: 28 }, rx: { cock: -4, hit: 6, follow: 8 } },
      neck: { ry: { cock: 32, hit: -16, follow: -11 } },
      clavicle_r: { rz: { cock: -14, hit: 18, follow: 22 } },
      upperarm_r: { rx: { cock: -62, hit: -64, follow: -46 }, rz: { cock: -30, hit: 20, follow: 27 } },
      lowerarm_r: { rx: { cock: -44, hit: -30, follow: -34 } },
      hand_r: { rz: { cock: -28, hit: 18, follow: 22 } },
      upperarm_l: { rx: { cock: -60, hit: -66, follow: -54 }, rz: { cock: 30, hit: -16, follow: -10 } },
      lowerarm_l: { rx: { cock: -56, hit: -44, follow: -40 } },
      thigh_l: { rx: { cock: -18, hit: 10, follow: 13 } },
      thigh_r: { rx: { cock: 18, hit: -18, follow: -22 } },
      calf_l: { rx: { cock: 15, hit: -8, follow: -5 } },
      calf_r: { rx: { cock: -15, hit: 20, follow: 15 } },
    },
  },
};

/**
 * Build one archetype's track key lists at a given startup-blend `t`.
 *
 * The active band 1.0 -> 2.0 is authored with FOUR EVENLY SPACED KEYS carrying evenly spaced
 * values, so the angular rate through the hitbox-active window is close to constant instead of
 * a single smoothstep hump. That is the whole reason the old curves broke RI-CMB04 §B: a
 * smoothstep segment peaks at 1.5x its own mean, and the old curves put the entire cock->hit
 * excursion in ONE such segment, so the instantaneous rate at the middle of the active window
 * was ~1.5x whatever the average implied. Splitting the band lets the average carry a real
 * Souls-sized arc (RI-CMB02 §A's reach is unchanged) while the PEAK stays under the declared
 * column.
 *
 * The recovery is authored front-loaded — 2.0 -> follow -> 55 % -> 88 % -> idle — so the
 * per-frame rate DECREASES monotonically across it. The blade comes to rest; it does not carry
 * on. There is no key beyond `follow` that moves away from the idle pose, which is the specific
 * defect the verdict measured (an overshoot peaking at phase 2.4 and then snapping back).
 */
function buildArch(def, t) {
  const tracks = {};
  for (const bone of Object.keys(def.tracks)) {
    tracks[bone] = {};
    for (const ch of Object.keys(def.tracks[bone])) {
      const k = def.tracks[bone][ch];
      const start = k.start !== undefined ? k.start : idleOf(bone, ch);
      const end = idleOf(bone, ch);
      const v1 = k.cock + t * (k.hit - k.cock);          // pose on the LAST STARTUP frame
      const v2 = k.hit;                                  // pose on the LAST ACTIVE frame
      const lin = (u) => v1 + (v2 - v1) * u;
      // `mid` lets a channel bulge off the linear ramp inside the active band — used for arm
      // EXTENSION, which peaks mid-swing rather than at the end of it, so RI-CMB02 §A's
      // declared reach is reached while the blade is still travelling.
      const mid = k.mid !== undefined ? k.mid : lin(0.5);
      const fol = k.follow;
      tracks[bone][ch] = [
        [0.0, r(start)],
        [def.cockPhase, r(k.cock)],
        [1.0, r(v1)],
        [1.25, r(lin(0.25) + 0.5 * (mid - lin(0.5)))],
        [1.5, r(mid)],
        [1.75, r(lin(0.75) + 0.5 * (mid - lin(0.5)))],
        [2.0, r(v2)],
        [def.followPhase, r(fol)],
        [2.0 + (def.followPhase - 2.0) + 0.45 * (3.0 - def.followPhase), r(fol + 0.55 * (end - fol))],
        [2.0 + (def.followPhase - 2.0) + 0.78 * (3.0 - def.followPhase), r(fol + 0.88 * (end - fol))],
        [3.0, r(end)],
      ];
    }
  }
  // Every channel `idle_ready` holds MUST appear in every attack archetype, even if the swing
  // does not move it: a channel the archetype is silent about is written as 0 by
  // Clip.applyPose(), which is NOT the idle value, so the first and last frames of the clip
  // would differ from the idle pose by exactly that channel. That is a boundary snap with no
  // motion in it at all — 6 degrees of shoulder is 0.27 m at a spear's tip — and it is why the
  // spear and halberd still stepped 0.11-0.22 m after the terminal-pose rule went in.
  for (const bone of Object.keys(IDLE)) {
    for (const ch of Object.keys(IDLE[bone])) {
      tracks[bone] = tracks[bone] || {};
      if (!tracks[bone][ch]) tracks[bone][ch] = [[0.0, IDLE[bone][ch]], [3.0, IDLE[bone][ch]]];
    }
  }
  return {
    note: def.note,
    solved_startup_blend: t,
    solved_note:
      'The pose on the last STARTUP frame is cock + ' + t.toFixed(3) + ' x (hit - cock); the ' +
      'active band then runs to `hit` in four evenly spaced keys, and the recovery decelerates ' +
      'onto the idle pose. `t` is solved by tools/harness/anim-author.mjs as the SMALLEST blend ' +
      'at which every class using this archetype measures a peak tip speed at or under its ' +
      'RI-CMB04 §B declared column with a 1 % margin — smallest, so that as much of the arc as ' +
      'possible is inside the hitbox-active window rather than hidden in the windup.',
    root_forward: def.root_forward,
    root_offset: { y: def.root_offset_y },
    tracks,
  };
}
function r(v) { return Math.round(v * 100) / 100; }

// ---- the measurement the solver optimises against ---------------------------------------
function peakRatioFor(archName, archObj) {
  let worst = 0;
  for (const id of CLASSES) {
    const ms = spine[id];
    for (const mv of ['light', 'heavy']) {
      const m = ms.moves[mv];
      if (m.archetype !== archName) continue;
      const clip = new Clip(m.anim, archObj, { startup: m.startup, active: m.active, total: m.total }, m.amplitude, m.root_dz_m);
      const peak = peakActiveTip(clip, ms.weapon, m);
      const ratio = peak / ms.weapon.peak_tip_speed_mps_declared;
      if (ratio > worst) worst = ratio;
    }
  }
  return worst;
}
function peakActiveTip(clip, w, m) {
  const rig = new Rig(skel, hitgeo);
  const pos = [0, 0, 0];
  let z = 0, prev = null, peak = 0;
  for (let f = 1; f <= m.total; f++) {
    z += clip.rootDeltaAt(f);
    clip.applyPose(rig, f);
    pos[2] = z;
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), w.socket_a_dist_m, w.socket_b_dist_m);
    const b = rig.socketB.slice();
    if (prev && f > m.startup && f <= m.startup + m.active) {
      const d = Math.hypot(b[0] - prev[0], b[1] - prev[1], b[2] - prev[2]) * 60;
      if (d > peak) peak = d;
    }
    prev = b;
  }
  return peak;
}

// ---- solve ------------------------------------------------------------------------------
const MARGIN = 0.99;      // 1 % under the declared column
const solved = {};
for (const name of Object.keys(ARCH)) {
  let best = 0;
  for (let t = 0; t <= 0.999; t += 0.001) {
    const a = buildArch(ARCH[name], t);
    if (peakRatioFor(name, a) <= MARGIN) { best = t; break; }
  }
  const a = buildArch(ARCH[name], best);
  solved[name] = a;
  console.log(`${name.padEnd(16)} t=${best.toFixed(3)}  worst peak ratio ${peakRatioFor(name, a).toFixed(3)}`);
}

if (process.argv.includes('--write')) {
  for (const name of Object.keys(solved)) clipsDoc.archetypes[name] = solved[name];
  clipsDoc.archetypes.idle_loop = IDLE_LOOP;
  clipsDoc.phase_parameterisation.termination_rule =
    'BINDING. Every non-looping archetype whose clip can be followed by free locomotion must ' +
    'have, at phase 3.0, exactly the value the `idle_ready` stance layer holds for that bone ' +
    '(0 where idle_ready is silent). The attack/idle boundary is then continuous by ' +
    'construction. Before this rule, a straight-sword R1 moved its tip 1.42 m and a halberd R1 ' +
    '2.54 m in the single frame the move retired — 85 to 152 m/s of pose discontinuity, ' +
    'W1-09 verdict §2.5.';
  fs.writeFileSync(clipsPath, JSON.stringify(clipsDoc, null, 1) + '\n');
  console.log('written game/data/combat/clips.json');
}
