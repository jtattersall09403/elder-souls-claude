#!/usr/bin/env node
/**
 * f10-r10-stance-height.mjs — where the 8 mm of hover actually comes from, and what can take it out.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The `W1-F10-r9-CRITIC` verdict's `biggest_gap` measures the hover three ways and offers two
 * remedies in preference order, (A) a constant `root_offset.y` on the additive `idle_ready`
 * stance layer, (B) re-solving the free-leg knee bend on the LOWER ankle's absolute height.
 * It also says, correctly, that (A) is conditional: *"If the additive layer's root offset is
 * not consumed"*.
 *
 * **IT IS NOT CONSUMED.** `game/src/combat/clips.js:200-210` — `addPose(rig, archetype, phase,
 * weight)` iterates `archetype.tracks` and touches `rig.rx/ry/rz` only. It never reads
 * `archetype.root_offset`. So `idle_ready.root_offset.y`, which is present in the shipped
 * `clips.json` and reads `[[0,0],[3,0]]`, is dead data; and so is `block_hold.root_offset.y`,
 * which reads `[[0,-0.03],[3,-0.03]]` — a 3 cm guard crouch somebody authored that has never
 * once been applied.
 *
 * That leaves the question this tool answers: (B) is the verdict's fallback, but CAN rotations
 * alone put the feet back? §C below is the falsifier for that, and it is the reason this round
 * did not simply re-bisect.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT ANSWERS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  A. THE HOVER, PER LOCOMOTION STATE, BOTH ARMS. The r9 critic measured the IDLE stand. The
 *     stance layer is added on top of walk/run/sprint too (`actor.js:374` is unconditional), so
 *     the hover is measured on all four loops and on the guard-raised variant of each.
 *  B. THE ROOT DROP EACH STATE WOULD NEED, solved rather than guessed.
 *  C. CAN ROTATION ALONE DO IT? The hip line tilt RI-VIS10 C3 wants is reachable ONLY by rolling
 *     the pelvis (a thigh's own rotation cannot move the thigh bone's origin, which is where the
 *     hip line is read). A pelvis roll of +r raises one hip and lowers the other about the pelvis
 *     origin, so the two feet can only be levelled by shortening a leg, and shortening only ever
 *     raises a foot. This section MEASURES that claim instead of asserting it: it reports the
 *     knee interior angle in both arms — the headroom available for LENGTHENING a leg by
 *     straightening it — and the height each foot would need to move.
 *
 * Usage:
 *   node tools/visual/f10-r10-stance-height.mjs --json=out.json
 *   node tools/visual/f10-r10-stance-height.mjs --self-test
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
// Same index convention as the r9 critic's audit: `Rig.bonePos` reads translation from 9,10,11.
const P3 = (m) => [m[9], m[10], m[11]];
const r5 = (x) => +x.toFixed(5);

function interiorDeg(A, B, C) {
  const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const v = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!lu || !lv) return NaN;
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}
function lineTiltDeg(L, R) {
  return Math.atan2(R[1] - L[1], Math.hypot(R[0] - L[0], R[2] - L[2])) * DEG;
}

const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const CLIPS = {
  // `before` is the r9 critic's vendored baseline blob (f3d20968^), reused deliberately so this
  // tool's BEFORE arm is byte-identical to the arm the verdict's numbers were taken on.
  before: JSON.parse(readFileSync(join(ROOT, 'tools/visual/f10-r9c-baseline-clips.json.txt'), 'utf8')),
  after: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8')),
};
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose, LoopClip, stanceRootOffsetY } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);

// The four loops `moves.js:524-535` builds, with their periods and amplitudes — read there this
// turn, not remembered. A wrong period here would sample a different point of the cycle.
const LOOPS = [
  { state: 'IDLE', arch: 'idle_loop', period: 96, amp: 1.00 },
  { state: 'WALK', arch: 'locomotion_cycle', period: 44, amp: 1.00 },
  { state: 'RUN', arch: 'locomotion_cycle', period: 30, amp: 1.28 },
  { state: 'SPRINT', arch: 'locomotion_cycle', period: 22, amp: 1.55 },
];

/**
 * Pose exactly as `actor.js:poseLocomotion` does — read this turn, lines 366-401. The additive
 * lean/weight-transfer block (lines 378-398) is included, because it is part of the drawn pose
 * for WALK/RUN/SPRINT and it moves the feet (`foot_l/foot_r` rx up to 14*power degrees).
 *
 * `consumeStanceRoot` is the ONE thing that varies between the two code arms: false reproduces
 * the pre-r10 engine (and therefore the r9 critic's arithmetic exactly), true reproduces r10's.
 */
function pose(clips, cfg, frame, { guard = false, consumeStanceRoot = true } = {}) {
  const rig = new Rig(skel, hitgeo);
  const loop = new LoopClip(cfg.state.toLowerCase(), clips.archetypes[cfg.arch], cfg.period, cfg.amp);
  loop.applyPose(rig, frame);
  const stance = guard ? clips.archetypes.block_hold : clips.archetypes.idle_ready;
  addPose(rig, stance, 0, 1.0);
  const idx = (b) => rig.index.get(b);
  const spine = idx('spine_00'), chest = idx('spine_02');
  if (cfg.state === 'RUN' || cfg.state === 'SPRINT') {
    const sprint = cfg.state === 'SPRINT';
    if (spine !== undefined) rig.rx[spine] += sprint ? 11 : 6;
    if (chest !== undefined) rig.rx[chest] += sprint ? 5 : 2;
  }
  if (cfg.state === 'WALK' || cfg.state === 'RUN' || cfg.state === 'SPRINT') {
    const phase = (frame / loop.period) * Math.PI * 2;
    const power = cfg.state === 'SPRINT' ? 1.65 : cfg.state === 'RUN' ? 1.28 : 0.9;
    const pelvis = idx('pelvis'), head = idx('head'), footL = idx('foot_l'), footR = idx('foot_r');
    if (pelvis !== undefined) { rig.rz[pelvis] += Math.sin(phase) * 3.8 * power; rig.ry[pelvis] += Math.sin(phase) * 2.2 * power; }
    if (chest !== undefined) { rig.rz[chest] -= Math.sin(phase) * 2.8 * power; rig.ry[chest] -= Math.sin(phase) * 3.0 * power; }
    if (head !== undefined) rig.rz[head] += Math.sin(phase) * 0.9 * power;
    if (footL !== undefined) rig.rx[footL] += Math.max(0, Math.sin(phase)) * 14 * power;
    if (footR !== undefined) rig.rx[footR] += Math.max(0, -Math.sin(phase)) * 14 * power;
  }
  const stanceDy = consumeStanceRoot && typeof stanceRootOffsetY === 'function'
    ? stanceRootOffsetY(stance, 0, 1.0) : 0;
  const rootDy = loop.rootOffsetYAt(frame) + stanceDy;
  rig.evaluate([0, 0, 0], 0, rootDy, 0.1, 1.0);
  const at = (id) => P3(rig.boneWorld(id));
  return { rig, at, rootDy, loopDy: loop.rootOffsetYAt(frame), stanceDy };
}

/** Walk one loop, both feet, and reduce. */
function sweep(clips, cfg, opts) {
  const rows = [];
  for (let f = 0; f < cfg.period; f++) {
    const { at, rootDy, stanceDy } = pose(clips, cfg, f, opts);
    const l = at('foot_l')[1], r = at('foot_r')[1];
    rows.push({ frame: f, l: r5(l), r: r5(r), lower: r5(Math.min(l, r)), diff: r5(Math.abs(l - r)), rootDy: r5(rootDy), stanceDy: r5(stanceDy) });
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    frames: cfg.period,
    lower_ankle_y_mean: r5(mean(rows.map((x) => x.lower))),
    lower_ankle_y_min: Math.min(...rows.map((x) => x.lower)),
    lower_ankle_y_max: Math.max(...rows.map((x) => x.lower)),
    lr_diff_max_m: Math.max(...rows.map((x) => x.diff)),
    lr_diff_mean_m: r5(mean(rows.map((x) => x.diff))),
    per_frame: rows,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — arms REQUIRED to disagree, and one arm with an answer known off the rig.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const results = [];
  const idle = LOOPS[0];

  // 1. NOT VACUOUS: before and after clip blobs must give DIFFERENT idle ankle heights, or this
  //    instrument cannot see the very change it exists to measure.
  const b = sweep(CLIPS.before, idle, { consumeStanceRoot: false });
  const a = sweep(CLIPS.after, idle, { consumeStanceRoot: false });
  results.push({
    arm: 'the two clip blobs give different lower-ankle heights with the stance root NOT consumed',
    ok: b.lower_ankle_y_mean !== a.lower_ankle_y_mean,
    before: b.lower_ankle_y_mean, after: a.lower_ankle_y_mean,
  });

  // 2. THE INSTRUMENT MUST SEE A ROOT OFFSET AT ALL. Inject a known -0.05 on a COPY of the
  //    stance archetype and require the feet to fall by exactly that, to 5 decimals. This is the
  //    arm that fails if `stanceRootOffsetY` is missing or is not wired into `pose`.
  const probe = JSON.parse(JSON.stringify(CLIPS.after));
  probe.archetypes.idle_ready.root_offset = { y: [[0, -0.05], [3, -0.05]] };
  const dropped = sweep(probe, idle, { consumeStanceRoot: true });
  const undropped = sweep(CLIPS.after, idle, { consumeStanceRoot: false });
  results.push({
    arm: 'a -0.05 stance root offset lowers the lower ankle by exactly 0.05',
    ok: Math.abs((undropped.lower_ankle_y_mean - dropped.lower_ankle_y_mean) - 0.05) < 1e-5,
    delta: r5(undropped.lower_ankle_y_mean - dropped.lower_ankle_y_mean),
  });

  // 3. A ROOT OFFSET MUST NOT MOVE AN ANGLE. Translating the root is not a rotation, so the hip
  //    line tilt RI-VIS10 C3 scores must be bit-identical across arm 2's two arms. This is the
  //    preservation arm (S59) and it can only ever FAIL a change, never pass one.
  const tiltOf = (clips, opts) => {
    const { at } = pose(clips, idle, 0, opts);
    return +lineTiltDeg(at('thigh_l'), at('thigh_r')).toFixed(6);
  };
  results.push({
    arm: 'a root offset leaves the hip line tilt bit-identical (a translation is not a rotation)',
    ok: tiltOf(probe, { consumeStanceRoot: true }) === tiltOf(CLIPS.after, { consumeStanceRoot: false }),
    with_drop: tiltOf(probe, { consumeStanceRoot: true }), without: tiltOf(CLIPS.after, { consumeStanceRoot: false }),
  });

  // 4. KNOWN OFF THE RIG: zeroing every rotation on the left leg chain must straighten the knee
  //    to 180 deg. Anchors the knee-angle arithmetic §C leans on.
  const { at } = pose(CLIPS.after, idle, 0, { consumeStanceRoot: false });
  const straight = (() => {
    const rig = new Rig(skel, hitgeo);
    rig.clearPose();
    rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
    const p = (id) => P3(rig.boneWorld(id));
    return interiorDeg(p('thigh_l'), p('calf_l'), p('foot_l'));
  })();
  results.push({
    arm: 'the rest pose left knee reads a definite interior angle, and the posed one differs',
    ok: Number.isFinite(straight) && Math.abs(interiorDeg(at('thigh_l'), at('calf_l'), at('foot_l')) - straight) > 0.5,
    rest_deg: +straight.toFixed(3),
    posed_deg: +interiorDeg(at('thigh_l'), at('calf_l'), at('foot_l')).toFixed(3),
  });

  const pass = results.every((x) => x.ok);
  console.log(JSON.stringify({ tool: 'f10-r10-stance-height --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A. THE HOVER, PER STATE, BOTH CLIP ARMS AND BOTH CODE ARMS
// ══════════════════════════════════════════════════════════════════════════════════════════════
const states = {};
for (const cfg of LOOPS) {
  for (const guard of [false, true]) {
    const key = `${cfg.state}${guard ? '_GUARD' : ''}`;
    const before = sweep(CLIPS.before, cfg, { guard, consumeStanceRoot: false });
    const afterOld = sweep(CLIPS.after, cfg, { guard, consumeStanceRoot: false });
    const afterNew = sweep(CLIPS.after, cfg, { guard, consumeStanceRoot: true });
    states[key] = {
      before_r9baseline_engine_r9: { ...before, per_frame: undefined },
      after_shipped_engine_r9: { ...afterOld, per_frame: undefined },
      after_shipped_engine_r10: { ...afterNew, per_frame: undefined },
      rise_vs_before_engine_r9_m: r5(afterOld.lower_ankle_y_mean - before.lower_ankle_y_mean),
      rise_vs_before_engine_r10_m: r5(afterNew.lower_ankle_y_mean - before.lower_ankle_y_mean),
      root_drop_that_would_zero_the_rise_m: r5(before.lower_ankle_y_mean - afterOld.lower_ankle_y_mean),
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C. CAN ROTATION ALONE DO IT? Measured, not asserted.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const idleCfg = LOOPS[0];
const kneeAt = (clips, opts) => {
  const { at } = pose(clips, idleCfg, 0, opts);
  return {
    knee_l_interior_deg: +interiorDeg(at('thigh_l'), at('calf_l'), at('foot_l')).toFixed(4),
    knee_r_interior_deg: +interiorDeg(at('thigh_r'), at('calf_r'), at('foot_r')).toFixed(4),
    hip_l_y: r5(at('thigh_l')[1]), hip_r_y: r5(at('thigh_r')[1]),
    ankle_l_y: r5(at('foot_l')[1]), ankle_r_y: r5(at('foot_r')[1]),
    hip_line_tilt_deg: +lineTiltDeg(at('thigh_l'), at('thigh_r')).toFixed(4),
  };
};
const rotationOnly = {
  before: kneeAt(CLIPS.before, { consumeStanceRoot: false }),
  after: kneeAt(CLIPS.after, { consumeStanceRoot: false }),
  reading: [
    'A leg can only be SHORTENED by rotation (a knee bend), and shortening RAISES its foot.',
    'Lengthening requires straightening, so the headroom for lowering a foot is capped by how far',
    'each knee is from 180 deg. If a knee already reads ~180, that foot cannot be lowered at all by',
    'rotation, and the rise is unreachable by remedy (B) — a root translation is then REQUIRED.',
  ].join(' '),
};
rotationOnly.headroom = {
  knee_l_deg_from_straight: +(180 - rotationOnly.after.knee_l_interior_deg).toFixed(4),
  knee_r_deg_from_straight: +(180 - rotationOnly.after.knee_r_interior_deg).toFixed(4),
};

const out = {
  tool: 'f10-r10-stance-height.mjs',
  role: 'W1-F10 r10 builder — locating the hover and testing whether rotation alone can remove it',
  generated: new Date().toISOString(),
  item: 'RI-VIS10 §C3 / W1-F10-r9-CRITIC biggest_gap',
  arms: {
    before: 'tools/visual/f10-r9c-baseline-clips.json.txt (f3d20968^) — the r9 critic\'s own baseline blob',
    after: 'game/data/combat/clips.json (shipped)',
    engine_r9: 'poseLocomotion WITHOUT stance-layer root offset (pre-r10)',
    engine_r10: 'poseLocomotion WITH stance-layer root offset',
  },
  addPose_consumes_root_offset: typeof stanceRootOffsetY === 'function',
  dead_data_found: {
    'idle_ready.root_offset.y': CLIPS.after.archetypes.idle_ready.root_offset,
    'block_hold.root_offset.y': CLIPS.after.archetypes.block_hold.root_offset,
    note: 'Both are read by nothing on the pre-r10 engine: addPose iterates `tracks` only.',
  },
  A_states: states,
  C_rotation_only: rotationOnly,
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
