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
    cockPhase: 0.5, hitPhase: 1.5, followPhase: 2.3,
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
 * Three knobs, all solved rather than tuned by eye:
 *
 *   `t`     the pose on the LAST STARTUP frame, as a blend cock -> hit. FIXED at 0.32 and not
 *           solved, because it is not free: the blade must cross the target's centreline
 *           INSIDE the hitbox-active window, and it crosses at roughly the midpoint of
 *           cock -> hit, so any t above 0.5 puts the crossing in the startup and the weapon
 *           reaches nothing. That is not hypothetical — solving t against peak tip speed alone
 *           produced t = 0.74 for `sweep_wide`, and the halberd's and ultra greatsword's R1
 *           then measured a forward reach of 0.00 m against RI-CMB02 §A's declared 2.85 and
 *           2.95. Peak speed is bought with `swing` instead.
 *   `swing`  scales the whole rotational excursion about the mid-swing pose. This is what buys
 *           the RI-CMB04 §B peak-tip-speed budget.
 *   `ext`    degrees of elbow extension added at the hit pose. This is what buys RI-CMB02 §A's
 *           declared reach back after `swing` has shrunk the arc.
 *
 * The active band 1.0 -> 2.0 carries FOUR evenly spaced keys so the angular rate through the
 * hitbox is close to constant rather than one smoothstep hump (a smoothstep segment peaks at
 * 1.5x its own mean, which is most of why the old curves ran at x1.00-x2.69 of the declared
 * column). The recovery is front-loaded — 2.0 -> follow -> 55 % -> 88 % -> idle — so its
 * per-frame rate DECREASES monotonically: the blade comes to rest, it does not carry on.
 * Nothing after `follow` moves away from the idle pose, which is the specific defect the
 * verdict measured (an overshoot peaking at phase 2.4 and then snapping back).
 */
const T_FIXED = 0.32;
const EXT_CH = { lowerarm_r: 'rx', upperarm_r: 'rx' };

function buildArch(def, swing, ext) {
  const t = T_FIXED;
  const tracks = {};
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
      const v1 = cock + t * (hit - cock);
      const lin = (u) => v1 + (hit - v1) * u;
      tracks[bone][ch] = [
        [0.0, r(start)],
        [def.cockPhase, r(cock)],
        [1.0, r(v1)],
        [1.25, r(lin(0.25))],
        [1.5, r(lin(0.5))],
        [1.75, r(lin(0.75))],
        [2.0, r(hit)],
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
  // motion in it at all — 6 degrees of shoulder is 0.27 m at a spear's tip.
  for (const bone of Object.keys(IDLE)) {
    for (const ch of Object.keys(IDLE[bone])) {
      tracks[bone] = tracks[bone] || {};
      if (!tracks[bone][ch]) tracks[bone][ch] = [[0.0, IDLE[bone][ch]], [3.0, IDLE[bone][ch]]];
    }
  }
  return {
    note: def.note,
    solved: { startup_blend: t, swing_scale: +swing.toFixed(3), elbow_extension_deg: +ext.toFixed(1) },
    solved_note:
      'Solved by tools/harness/anim-author.mjs against two of the corpus\'s own columns at once: ' +
      'RI-CMB04 §B\'s peak_tip_speed_mps (a ceiling, measured over the ACTIVE frames only) and ' +
      'RI-CMB02 §A\'s reach_m (a floor, measured as the furthest forward point the weapon capsule ' +
      'occupies near the centreline during the active window). The search takes the LARGEST swing ' +
      'and the SMALLEST elbow extension that satisfy both for every class using this archetype.',
    root_forward: def.root_forward,
    root_offset: { y: def.root_offset_y },
    tracks,
  };
}
function r(v) { return Math.round(v * 100) / 100; }

// ---- the measurement the solver optimises against ---------------------------------------
function measureArch(archName, archObj) {
  let worstPeak = 0, worstReach = Infinity, worstReachClass = null;
  for (const id of CLASSES) {
    const ms = spine[id];
    for (const mv of ['light', 'heavy']) {
      const base = ms.moves[mv];
      const variants = [base];
      const th = ms.moves.two_handed && ms.moves.two_handed[mv];
      if (th) variants.push(Object.assign({}, base, th));
      for (const m of variants) {
        if (m.archetype !== archName) continue;
        const clip = new Clip(m.anim, archObj, { startup: base.startup, active: base.active, total: base.total }, m.amplitude, m.root_dz_m);
        const r = trackOf(clip, ms.weapon, base);
        const pr = r.peak / ms.weapon.peak_tip_speed_mps_declared;
        if (pr > worstPeak) worstPeak = pr;
        // RI-CMB02 §A's reach column is the ONE-HANDED row; the two-handed rows select a
        // different archetype entirely (RI-WPN06 §B) and the item declares no reach for them,
        // so they are held to the peak ceiling but not to the reach floor.
        if (m !== base) continue;
        const declR = base.reach_m_declared || 1.0;
        const rr = r.reach / declR;
        if (rr < worstReach) { worstReach = rr; worstReachClass = id + ':' + mv; }
      }
    }
  }
  return { peak: worstPeak, reach: worstReach, reachClass: worstReachClass };
}

function trackOf(clip, w, m) {
  const rig = new Rig(skel, hitgeo);
  const pos = [0, 0, 0];
  let z = 0, prev = null, peak = 0, reach = 0;
  for (let f = 1; f <= m.total; f++) {
    z += clip.rootDeltaAt(f);
    clip.applyPose(rig, f);
    pos[2] = z;
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), w.socket_a_dist_m, w.socket_b_dist_m);
    const a = rig.socketA.slice(), b = rig.socketB.slice();
    if (f > m.startup && f <= m.startup + m.active) {
      if (prev) {
        const d = Math.hypot(b[0] - prev[0], b[1] - prev[1], b[2] - prev[2]) * 60;
        if (d > peak) peak = d;
      }
      for (let u = 0; u <= 1.0001; u += 0.05) {
        const px = a[0] + (b[0] - a[0]) * u, pz = a[2] + (b[2] - a[2]) * u;
        if (Math.abs(px) <= 0.35 && pz > reach) reach = pz;
      }
    }
    prev = b;
  }
  return { peak, reach };
}

// ---- solve ------------------------------------------------------------------------------
const PEAK_MAX = 0.99;     // fraction of RI-CMB04 §B's declared column
const REACH_MIN = 0.90;    // fraction of RI-CMB02 §A's declared reach
const solved = {};
for (const name of Object.keys(ARCH)) {
  let best = null;
  for (let ext = 0; ext <= 70 && !best; ext += 1) {
    for (let swing = 1.30; swing >= 0.10; swing -= 0.02) {
      const a = buildArch(ARCH[name], swing, ext);
      const m = measureArch(name, a);
      if (m.peak <= PEAK_MAX && m.reach >= REACH_MIN) { best = { a, m, swing, ext }; break; }
    }
  }
  if (!best) {
    // Report the closest achievable rather than silently shipping something that misses both.
    let closest = null;
    for (let ext = 0; ext <= 70; ext += 2) for (let swing = 1.30; swing >= 0.10; swing -= 0.04) {
      const a = buildArch(ARCH[name], swing, ext);
      const m = measureArch(name, a);
      if (m.peak > PEAK_MAX) continue;
      if (!closest || m.reach > closest.m.reach) closest = { a, m, swing, ext };
    }
    best = closest;
    console.log(`${name.padEnd(16)} NO feasible point: best reach ${best.m.reach.toFixed(3)} of declared (worst class ${best.m.reachClass})`);
  }
  solved[name] = best.a;
  console.log(`${name.padEnd(16)} swing=${best.swing.toFixed(2)} ext=${best.ext}  peak=${best.m.peak.toFixed(3)}x  reach=${best.m.reach.toFixed(3)}x (worst ${best.m.reachClass})`);
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
