#!/usr/bin/env node
/**
 * f10-r9-stance.mjs — score `RI-VIS10` §C3, "the stand is not a mannequin".
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CHECK, QUOTED FROM THE ITEM RATHER THAN PARAPHRASED
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `corpus/70-visual/RI-VIS10-character-design.md` §C, row **C3**:
 *
 *   Instrument — *"From the idle at frame 0 and frame 120: (a) shoulder-line tilt off horizontal,
 *   (b) hip-line tilt, (c) left-vs-right elbow angle difference. **Publish the three numbers at
 *   both frames**"*
 *   Pass — *"≥ 2 of the 3 exceed **3°**, and the two frames differ"*
 *   Fail — *"all three ≈ 0 at both frames → an A-pose with the arms lowered"*
 *
 * And §F#6, the tell it is written against: *"The mannequin stand. A symmetric A-pose with the
 * arms lowered, identical on every NPC."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IT MEASURES THE POSE THE GAME ACTUALLY DRAWS, WHICH IS NOT ONE CLIP
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Read this turn in `game/src/combat/actor.js` (the `_loopFrame` block) — a standing character is
 * **two layers**, not one:
 *
 *   loop.applyPose(rig, this._loopFrame)                       // `_idle` = LoopClip(idle_loop, 96)
 *   addPose(rig, guardRaised ? _blockPose : _idlePose, 0, 1.0) // additive `idle_ready`
 *
 * `moves.js` line 524/537 and `enemy.js` 141/145 bind those two names, so the PLAYER and every
 * NPC stand in the same pose. Scoring `idle_loop` alone would score a pose nothing in the game is
 * ever in — `idle_loop`'s own note says it carries *"no absolute arm pose"* — and would report the
 * arms as identical because the arm pose lives entirely in the other layer. Both layers are
 * applied here, in that order, with the same weights.
 *
 * Angles are read from **world joint positions after `rig.evaluate()`** — the same transforms the
 * hurtboxes, the sockets and the renderer consume — not from the clip's authored Euler numbers. A
 * degree in `clips.json` is a degree in a bone's LOCAL frame and says nothing about where the
 * shoulder ends up; this reads where it ended up.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE SHOULDER LINE IS READ AT TWO DIFFERENT PAIRS OF BONES
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `skeleton.json` (20 bones, read this turn) has both `clavicle_l/r` and `upperarm_l/r`. The
 * clavicles are the anatomical shoulder line; the upperarm joints are where the silhouette's
 * shoulder corner actually sits, because that is where the arm mass hangs from. They can disagree
 * — a clavicle roll tilts one and not the other — so **both are published** and C3 is scored on
 * the upperarm pair, which is the one a viewer sees. A critic who prefers the clavicle reading has
 * the number in the same table and does not have to re-run anything.
 *
 * Usage:
 *   node tools/visual/f10-r9-stance.mjs                       # score C3, publish the census
 *   node tools/visual/f10-r9-stance.mjs --json=out.json
 *   node tools/visual/f10-r9-stance.mjs --self-test           # arms required to disagree
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

const DEG = 180 / Math.PI;
const posOf = (m) => [m[9], m[10], m[11]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Tilt of the segment L→R off the horizontal plane, SIGNED, in degrees. */
function tiltDeg(pl, pr) {
  const d = sub(pr, pl);
  const horiz = Math.hypot(d[0], d[2]);
  return Math.atan2(d[1], horiz) * DEG;
}

/** Interior angle at the middle joint, in degrees. 180 = straight limb. */
function jointAngleDeg(a, b, c) {
  const u = sub(a, b), v = sub(c, b);
  const denom = len(u) * len(v);
  if (denom === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / denom))) * DEG;
}

/**
 * Build the standing pose the game draws, at loop frame `f`, and read the three C3 numbers.
 * `apply` lets the self-test perturb the rig between the pose layers and the evaluate, which is
 * the only way to prove the instrument can see an asymmetry that is really there.
 */
function measure({ Rig, addPose, LoopClip, skel, hitgeo, clips }, f, apply = null) {
  const rig = new Rig(skel, hitgeo);
  const loop = new LoopClip('idle', clips.archetypes.idle_loop, 96);
  loop.applyPose(rig, f);                                       // base: breathing / weight shift
  addPose(rig, clips.archetypes.idle_ready, 0, 1.0);            // additive: the stance layer
  if (apply) apply(rig);
  rig.evaluate([0, 0, 0], 0, loop.rootOffsetYAt(f), 0.1, 1.0);

  const P = (id) => posOf(rig.boneWorld(id));
  const shoulder_tilt_deg = tiltDeg(P('upperarm_l'), P('upperarm_r'));
  const clavicle_tilt_deg = tiltDeg(P('clavicle_l'), P('clavicle_r'));
  const hip_tilt_deg = tiltDeg(P('thigh_l'), P('thigh_r'));
  const elbow_l_deg = jointAngleDeg(P('upperarm_l'), P('lowerarm_l'), P('hand_l'));
  const elbow_r_deg = jointAngleDeg(P('upperarm_r'), P('lowerarm_r'), P('hand_r'));
  const elbow_difference_deg = Math.abs(elbow_l_deg - elbow_r_deg);

  const r3 = (x) => +x.toFixed(3);
  return {
    frame: f,
    phase: +loop.phaseAt(f).toFixed(4),
    a_shoulder_tilt_deg: r3(shoulder_tilt_deg),
    b_hip_tilt_deg: r3(hip_tilt_deg),
    c_elbow_difference_deg: r3(elbow_difference_deg),
    also_clavicle_tilt_deg: r3(clavicle_tilt_deg),
    elbow_l_deg: r3(elbow_l_deg),
    elbow_r_deg: r3(elbow_r_deg),
    abs: { a: r3(Math.abs(shoulder_tilt_deg)), b: r3(Math.abs(hip_tilt_deg)), c: r3(elbow_difference_deg) },
  };
}

async function load() {
  const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
  const { addPose, LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
  return {
    Rig, addPose, LoopClip,
    skel: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8')),
    hitgeo: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8')),
    clips: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8')),
  };
}

const THRESHOLD = 3;   // RI-VIS10 C3's own number

function score(f0, f120) {
  const over = (r) => [r.abs.a > THRESHOLD, r.abs.b > THRESHOLD, r.abs.c > THRESHOLD];
  const n0 = over(f0).filter(Boolean).length;
  const n120 = over(f120).filter(Boolean).length;
  // "the two frames differ" — on the three scored numbers, not on some unrelated wobble.
  const differ = ['a_shoulder_tilt_deg', 'b_hip_tilt_deg', 'c_elbow_difference_deg']
    .some((k) => Math.abs(f0[k] - f120[k]) > 0.05);
  const pass = n0 >= 2 && n120 >= 2 && differ;
  return {
    threshold_deg: THRESHOLD,
    exceeding_at_frame_0: n0, exceeding_at_frame_120: n120,
    which_exceed_frame_0: over(f0), which_exceed_frame_120: over(f120),
    frames_differ: differ,
    verdict: pass ? 'PASS' : 'FAIL',
    why: pass ? 'at least 2 of 3 exceed 3 degrees at both frames, and the frames differ'
      : `RI-VIS10 C3 needs >=2 of 3 over ${THRESHOLD} deg at both frames and the frames to differ; `
        + `got ${n0} and ${n120}, frames_differ=${differ}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — THE ARMS ARE REQUIRED TO DISAGREE.
//
// The failure this guards against is the one r8 recorded twice against its own instruments: a
// measurement that returns a plausible number while reading nothing. A stance meter that always
// returns ~0 would "correctly" fail today's mannequin and would go on failing a stance that had
// actually been fixed — and nobody would notice, because the number it prints is the number the
// author expects. So every arm below asserts a DIRECTION, and the suite declares itself vacuous
// unless the flat arm and the tilted arm land on opposite sides of C3's own 3 degree line.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const ctx = await load();
  const bump = (bone, axis, deg) => (rig) => { const i = rig.index.get(bone); rig[axis][i] += deg; };
  const results = [];

  const flat = measure(ctx, 0);
  results.push({ arm: 'the shipped idle as-is', ok: true, read: flat.abs });

  // A clavicle roll IS a shoulder-line tilt. If the meter cannot see 8 deg of it, it is broken.
  const rolled = measure(ctx, 0, (rig) => { bump('spine_02', 'rz', 8)(rig); });
  results.push({
    arm: 'an 8 deg chest roll must show as shoulder tilt > 3 deg',
    ok: rolled.abs.a > THRESHOLD, read: rolled.abs.a, was: flat.abs.a,
  });

  // A pelvis roll IS a hip-line tilt, and must NOT be confused with the shoulder reading.
  const hip = measure(ctx, 0, bump('pelvis', 'rz', 7));
  results.push({
    arm: 'a 7 deg pelvis roll must show as hip tilt > 3 deg',
    ok: hip.abs.b > THRESHOLD, read: hip.abs.b, was: flat.abs.b,
  });

  // An elbow difference must move c and NOT move a or b — a meter whose three numbers all move
  // together is measuring one thing three times.
  // ASSERT THE PHYSICAL QUANTITY, NOT A GUESSED DELTA. A -25 deg local bend at `lowerarm_l` must
  // move the LEFT ELBOW ANGLE by 25 deg; how much the left-right DIFFERENCE moves depends on which
  // side the two arms started, which is a property of the shipped pose and not of the meter. The
  // first version of this arm asserted the difference moved by >10 and failed on a true reading of
  // 9 — the assertion was wrong, not the instrument, and guessing a delta is how that happens.
  const elbow = measure(ctx, 0, bump('lowerarm_l', 'rx', -25));
  results.push({
    arm: 'a -25 deg bend at lowerarm_l moves the LEFT elbow by 25 deg and leaves a, b and the RIGHT elbow alone',
    ok: Math.abs(Math.abs(elbow.elbow_l_deg - flat.elbow_l_deg) - 25) < 0.001
      && Math.abs(elbow.elbow_r_deg - flat.elbow_r_deg) < 0.001
      && Math.abs(elbow.abs.a - flat.abs.a) < 0.01
      && Math.abs(elbow.abs.b - flat.abs.b) < 0.01,
    read: { elbow_l: elbow.elbow_l_deg, elbow_r: elbow.elbow_r_deg, ...elbow.abs },
    was: { elbow_l: flat.elbow_l_deg, elbow_r: flat.elbow_r_deg, ...flat.abs },
  });

  // A straight limb must read 180 deg. This is the one arm with an answer known off the rig.
  const straight = measure(ctx, 0, (rig) => {
    for (const b of ['upperarm_l', 'lowerarm_l']) { const i = rig.index.get(b); rig.rx[i] = 0; rig.ry[i] = 0; rig.rz[i] = 0; }
  });
  results.push({
    arm: 'a straightened left arm reads 180 deg at the elbow', ok: Math.abs(straight.elbow_l_deg - 180) < 0.001,
    read: straight.elbow_l_deg,
  });

  // NOT VACUOUS: the flat arm and the rolled arm must land on OPPOSITE sides of the 3 deg line.
  const vacuous = (flat.abs.a > THRESHOLD) === (rolled.abs.a > THRESHOLD);
  const pass = results.every((r) => r.ok) && !vacuous;
  console.log(JSON.stringify({ tool: 'f10-r9-stance --self-test', threshold_deg: THRESHOLD, results, vacuous, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE CENSUS
// ══════════════════════════════════════════════════════════════════════════════════════════════
const ctx = await load();
const frames = String(args.frames || '0,120').split(',').map((s) => parseInt(s, 10));
const rows = frames.map((f) => measure(ctx, f));
const verdict = score(rows[0], rows[rows.length - 1]);

const out = {
  tool: 'f10-r9-stance.mjs',
  generated: new Date().toISOString(),
  item: 'RI-VIS10 §C3 — the stand is not a mannequin',
  roadmap_item: 'F10',
  pose_layers: [
    'base  : LoopClip(clips.archetypes.idle_loop, period 96)   — game/src/combat/moves.js:524',
    'layer : addPose(clips.archetypes.idle_ready, phase 0, w 1) — game/src/combat/actor.js:374',
  ],
  measured_from: 'world joint positions after Rig.evaluate(), game/src/combat/skeleton.js',
  census: rows,
  c3: verdict,
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
process.exit(verdict.verdict === 'PASS' ? 0 : 1);
