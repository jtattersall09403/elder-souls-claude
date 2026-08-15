#!/usr/bin/env node
/**
 * f10-r9c-c3-audit.mjs — the CRITIC's independent re-derivation of RI-VIS10 C3, plus the two
 * things round 9 asserted about its own change and did not evidence.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY A SECOND INSTRUMENT AND NOT A RE-RUN OF THE BUILDER'S
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `CRITIC-DOCTRINE` §8: the critic does not take the builder's census. Re-running
 * `f10-r9-stance.mjs` would reproduce its numbers *and its definitions* — if its shoulder line is
 * read at the wrong pair of bones, or its tilt sign convention is wrong, or it reads a pose the
 * game never draws, a re-run agrees with it perfectly. So the angles here are written fresh. What
 * is deliberately NOT re-implemented is the rig: `Rig`, `LoopClip` and `addPose` are imported from
 * `game/src/combat/`, because those ARE the built article and a hand-rolled second skeleton would
 * measure a model of the game rather than the game.
 *
 * Both arms are measured in one process from two clip blobs — the shipped
 * `game/data/combat/clips.json` and the vendored `f10-r9c-baseline-clips.json.txt`
 * (`f3d20968^`) — so nothing has to be swapped on disk and no sibling can be hurt.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT ANSWERS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  A. C3's three numbers, both arms, frames 0 and 120, published (the item's own requirement).
 *  B. THE FEET. `W1-F10-r9.json`: *"both feet are now 8.9 mm higher relative to the root… r7/r8's
 *     foot conform is designed to absorb exactly this… plausibly is not measured."* This walks the
 *     whole 96-frame loop and publishes the ankle height above the root and the left/right
 *     difference, both arms, per frame.
 *  C. THE "SOLVED, NOT TUNED" CLAIM. Round 9 says the spine roll was derived from a measured
 *     sensitivity — `spine_00.rz +10` moving the shoulder line +9.929, the pelvis being the spine's
 *     PARENT and so adding its own +5 to the shoulder line. A solved number and a tuned one look
 *     identical in a report, so the sensitivities are re-measured here and the arithmetic the
 *     builder says it did is re-run from them and checked against the shipped file.
 *
 * Usage:
 *   node tools/visual/f10-r9c-c3-audit.mjs --json=out.json
 *   node tools/visual/f10-r9c-c3-audit.mjs --self-test
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
// `Rig.bonePos` (game/src/combat/skeleton.js:177) reads translation from elements 9,10,11 — a 3x4
// row layout, NOT three.js's column-major 16. Checked in the file, not assumed, because a wrong
// index here produces plausible small numbers rather than an error.
const P3 = (m) => [m[9], m[10], m[11]];

/** Signed elevation of the ray L→R above horizontal, degrees. Positive = R is higher than L. */
function lineTiltDeg(L, R) {
  const dy = R[1] - L[1];
  const run = Math.hypot(R[0] - L[0], R[2] - L[2]);
  return Math.atan2(dy, run) * DEG;
}
/** Interior angle ABC at B, degrees; 180 = straight. */
function interiorDeg(A, B, C) {
  const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const v = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!lu || !lv) return NaN;
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const CLIPS = {
  after: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8')),
  before: JSON.parse(readFileSync(join(ROOT, 'tools/visual/f10-r9c-baseline-clips.json.txt'), 'utf8')),
};
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose, LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);

/**
 * Pose the rig exactly as `actor.js:poseLocomotion` does for a standing character — read there this
 * turn, lines 366-374: `loop.applyPose(rig, frame)` then `addPose(rig, _idlePose, 0, 1.0)`. The
 * root is placed at the origin with the clip's own root offset, which is what `Rig.evaluate` takes.
 */
function pose(clips, frame, perturb = null) {
  const rig = new Rig(skel, hitgeo);
  const loop = new LoopClip('idle', clips.archetypes.idle_loop, 96);
  loop.applyPose(rig, frame);
  addPose(rig, clips.archetypes.idle_ready, 0, 1.0);
  if (perturb) perturb(rig);
  rig.evaluate([0, 0, 0], 0, loop.rootOffsetYAt(frame), 0.1, 1.0);
  const at = (id) => P3(rig.boneWorld(id));
  return { rig, at, rootDy: loop.rootOffsetYAt(frame) };
}

function c3At(clips, frame, perturb = null) {
  const { at } = pose(clips, frame, perturb);
  const r = (x) => +x.toFixed(4);
  const eL = interiorDeg(at('upperarm_l'), at('lowerarm_l'), at('hand_l'));
  const eR = interiorDeg(at('upperarm_r'), at('lowerarm_r'), at('hand_r'));
  return {
    frame,
    a_shoulder_line_tilt_deg: r(lineTiltDeg(at('upperarm_l'), at('upperarm_r'))),
    b_hip_line_tilt_deg: r(lineTiltDeg(at('thigh_l'), at('thigh_r'))),
    c_elbow_difference_deg: r(Math.abs(eL - eR)),
    aux_clavicle_line_tilt_deg: r(lineTiltDeg(at('clavicle_l'), at('clavicle_r'))),
    aux_elbow_l_deg: r(eL), aux_elbow_r_deg: r(eR),
    aux_ankle_l_y: r(at('foot_l')[1]), aux_ankle_r_y: r(at('foot_r')[1]),
    aux_pelvis_y: r(at('pelvis')[1]), aux_head_y: r(at('head')[1]),
  };
}

const T = 3;                                    // RI-VIS10 C3's own threshold, in degrees
function scoreC3(f0, f120) {
  const over = (r) => [Math.abs(r.a_shoulder_line_tilt_deg) > T, Math.abs(r.b_hip_line_tilt_deg) > T, Math.abs(r.c_elbow_difference_deg) > T];
  const n0 = over(f0).filter(Boolean).length, n1 = over(f120).filter(Boolean).length;
  const deltas = {
    a: +(f120.a_shoulder_line_tilt_deg - f0.a_shoulder_line_tilt_deg).toFixed(4),
    b: +(f120.b_hip_line_tilt_deg - f0.b_hip_line_tilt_deg).toFixed(4),
    c: +(f120.c_elbow_difference_deg - f0.c_elbow_difference_deg).toFixed(4),
  };
  // The item says "the two frames differ" and states NO tolerance. Both readings are published so a
  // second critic can apply its own; the boolean below uses exact inequality on the rounded values,
  // which is the weakest reading of the words and therefore the one most favourable to the build.
  const differ = deltas.a !== 0 || deltas.b !== 0 || deltas.c !== 0;
  return {
    threshold_deg: T, over_at_frame_0: n0, over_at_frame_120: n1,
    which_over_frame_0: over(f0), which_over_frame_120: over(f120),
    frame_deltas_deg: deltas, frames_differ_any_nonzero: differ,
    largest_frame_delta_deg: Math.max(...Object.values(deltas).map(Math.abs)),
    verdict: (n0 >= 2 && n1 >= 2 && differ) ? 'PASS' : 'FAIL',
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — arms REQUIRED to disagree, and one arm with an answer known off the rig.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const results = [];
  const bump = (bone, axis, deg) => (rig) => { const i = rig.index.get(bone); rig[axis][i] += deg; };
  const flat = c3At(CLIPS.before, 0);
  const rolled = c3At(CLIPS.before, 0, bump('spine_02', 'rz', 9));
  results.push({
    arm: 'a 9 deg chest roll must move the shoulder line across the 3 deg line',
    ok: Math.abs(flat.a_shoulder_line_tilt_deg) < T && Math.abs(rolled.a_shoulder_line_tilt_deg) > T,
    flat: flat.a_shoulder_line_tilt_deg, rolled: rolled.a_shoulder_line_tilt_deg,
  });
  const hip = c3At(CLIPS.before, 0, bump('pelvis', 'rz', 7));
  results.push({
    arm: 'a 7 deg pelvis roll must move the HIP line and is allowed to move the shoulder line too (the pelvis is the spine parent)',
    ok: Math.abs(flat.b_hip_line_tilt_deg) < T && Math.abs(hip.b_hip_line_tilt_deg) > T,
    flat: flat.b_hip_line_tilt_deg, rolled: hip.b_hip_line_tilt_deg,
  });
  // the sign convention is a real risk and it has a knowable answer: rolling the pelvis one way
  // must raise thigh_r relative to thigh_l, i.e. flip the SIGN of the hip tilt when the roll flips.
  const hipNeg = c3At(CLIPS.before, 0, bump('pelvis', 'rz', -7));
  results.push({
    arm: 'flipping the roll flips the sign of the measured tilt',
    ok: Math.sign(hip.b_hip_line_tilt_deg) === -Math.sign(hipNeg.b_hip_line_tilt_deg) && hip.b_hip_line_tilt_deg !== 0,
    plus: hip.b_hip_line_tilt_deg, minus: hipNeg.b_hip_line_tilt_deg,
  });
  const straight = c3At(CLIPS.before, 0, (rig) => {
    for (const b of ['upperarm_l', 'lowerarm_l']) { const i = rig.index.get(b); rig.rx[i] = 0; rig.ry[i] = 0; rig.rz[i] = 0; }
  });
  results.push({ arm: 'a straightened left arm reads 180 deg at the elbow (known off the rig)', ok: Math.abs(straight.aux_elbow_l_deg - 180) < 0.001, read: straight.aux_elbow_l_deg });
  // NOT VACUOUS: the two blobs must produce DIFFERENT C3 verdicts, or this audit cannot discriminate.
  const vb = scoreC3(c3At(CLIPS.before, 0), c3At(CLIPS.before, 120)).verdict;
  const va = scoreC3(c3At(CLIPS.after, 0), c3At(CLIPS.after, 120)).verdict;
  results.push({ arm: 'the two clip blobs land on OPPOSITE C3 verdicts', ok: vb !== va, before: vb, after: va });
  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r9c-c3-audit --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A. THE C3 CENSUS, BOTH ARMS
// ══════════════════════════════════════════════════════════════════════════════════════════════
const census = {};
for (const arm of ['before', 'after']) {
  const f0 = c3At(CLIPS[arm], 0), f120 = c3At(CLIPS[arm], 120);
  census[arm] = { frame_0: f0, frame_120: f120, score: scoreC3(f0, f120) };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B. THE FEET, ACROSS THE WHOLE LOOP. Round 9 fixed the left/right ASYMMETRY and left an absolute
// rise it called "plausibly absorbed" by the foot conform. Ankle height is measured relative to the
// rig root (which `evaluate` places at [0,0,0] plus the clip's own root offset), so this number is
// exactly the quantity a root drop would have cancelled.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const feet = { per_frame: [], summary: {} };
for (let f = 0; f < 96; f++) {
  const row = { frame: f };
  for (const arm of ['before', 'after']) {
    const { at, rootDy } = pose(CLIPS[arm], f);
    const l = at('foot_l')[1], r = at('foot_r')[1];
    row[arm] = { ankle_l_y: +l.toFixed(5), ankle_r_y: +r.toFixed(5), lower_y: +Math.min(l, r).toFixed(5), lr_diff_m: +Math.abs(l - r).toFixed(5), root_dy: +rootDy.toFixed(5) };
  }
  row.lower_rise_m = +(row.after.lower_y - row.before.lower_y).toFixed(5);
  feet.per_frame.push(row);
}
const col = (arm, k) => feet.per_frame.map((r) => r[arm][k]);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
feet.summary = {
  before: { lower_ankle_y_min: Math.min(...col('before', 'lower_y')), lower_ankle_y_mean: +mean(col('before', 'lower_y')).toFixed(5), lr_diff_max_m: Math.max(...col('before', 'lr_diff_m')) },
  after: { lower_ankle_y_min: Math.min(...col('after', 'lower_y')), lower_ankle_y_mean: +mean(col('after', 'lower_y')).toFixed(5), lr_diff_max_m: Math.max(...col('after', 'lr_diff_m')) },
};
feet.summary.rise_of_lower_ankle_m = {
  min: Math.min(...feet.per_frame.map((r) => r.lower_rise_m)),
  mean: +mean(feet.per_frame.map((r) => r.lower_rise_m)).toFixed(5),
  max: Math.max(...feet.per_frame.map((r) => r.lower_rise_m)),
};
// The sole is not the ankle. `game/src/render/actor.js` (the conform block, read this turn) states
// its own measured geometry: `foot_l` rest world y = 0.0900 and the skinned sole spans down to
// y = 0.0020 on the un-conformed NPC path — i.e. 2 mm of clearance. That constant is quoted, not
// re-derived, and is labelled as quoted.
feet.sole_note = {
  source: 'game/src/render/actor.js — the footConformDelta block, quoted not re-derived',
  rest_ankle_y_m: 0.0900,
  skinned_sole_low_y_m_no_conform: 0.0020,
  sole_clearance_before_m: 0.0020,
  sole_clearance_after_m: +(0.0020 + feet.summary.rise_of_lower_ankle_m.mean).toFixed(5),
};

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C. WAS THE SPINE NUMBER SOLVED OR TUNED? Re-measure the sensitivities round 9 says it measured,
// then re-run its stated arithmetic and compare with what is actually in the file.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const bump = (bone, axis, deg) => (rig) => { const i = rig.index.get(bone); rig[axis][i] += deg; };
const base = c3At(CLIPS.before, 0);
const sens = {};
for (const [bone, axis, deg] of [['spine_00', 'rz', 10], ['spine_02', 'rz', 10], ['pelvis', 'rz', 10], ['clavicle_l', 'rz', 10], ['neck', 'rz', 10]]) {
  const p = c3At(CLIPS.before, 0, bump(bone, axis, deg));
  sens[`${bone}.${axis}+${deg}`] = {
    d_shoulder_deg: +(p.a_shoulder_line_tilt_deg - base.a_shoulder_line_tilt_deg).toFixed(4),
    d_hip_deg: +(p.b_hip_line_tilt_deg - base.b_hip_line_tilt_deg).toFixed(4),
  };
}
const shipped = CLIPS.after.archetypes.idle_ready.tracks;
const v = (b, c) => (shipped[b] && shipped[b][c] ? shipped[b][c][0][1] : 0);
const predicted = base.a_shoulder_line_tilt_deg
  + (sens['spine_00.rz+10'].d_shoulder_deg / 10) * v('spine_00', 'rz')
  + (sens['spine_02.rz+10'].d_shoulder_deg / 10) * v('spine_02', 'rz')
  + (sens['pelvis.rz+10'].d_shoulder_deg / 10) * v('pelvis', 'rz');
const solved = {
  shipped_channels: { pelvis_rz: v('pelvis', 'rz'), spine_00_rz: v('spine_00', 'rz'), spine_02_rz: v('spine_02', 'rz'), thigh_l_rz: v('thigh_l', 'rz'), thigh_r_rz: v('thigh_r', 'rz'), neck_rz: v('neck', 'rz') },
  linear_prediction_of_shoulder_tilt_deg: +predicted.toFixed(4),
  actually_measured_shoulder_tilt_deg: census.after.frame_0.a_shoulder_line_tilt_deg,
  residual_deg: +(census.after.frame_0.a_shoulder_line_tilt_deg - predicted).toFixed(4),
  pelvis_is_spine_parent: skel.bones.find((b) => b.id === 'spine_00').parent === 'pelvis',
  reading: 'if the pelvis contribution to the SHOULDER line is materially non-zero, the builder\'s stated mechanism is real; a near-zero linear residual says the shipped numbers are consistent with a solve rather than a walk',
};

const out = {
  tool: 'f10-r9c-c3-audit.mjs',
  role: 'independent critic re-derivation, W1-F10-r9',
  generated: new Date().toISOString(),
  item: 'RI-VIS10 §C3',
  arms: { before: 'tools/visual/f10-r9c-baseline-clips.json.txt (f3d20968^)', after: 'game/data/combat/clips.json' },
  pose_layers_read_this_turn: 'game/src/combat/actor.js:366-374 poseLocomotion — LoopClip(idle_loop,96).applyPose then addPose(idle_ready,0,1.0)',
  A_c3_census: census,
  B_feet: feet,
  C_solved_or_tuned: { base_shoulder_tilt_deg: base.a_shoulder_line_tilt_deg, sensitivities_per_10_deg: sens, ...solved },
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ...out, B_feet: { ...feet, per_frame: `${feet.per_frame.length} rows (in the json)` } }, null, 2));
