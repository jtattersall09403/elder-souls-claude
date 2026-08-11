// RI-WPN05 §E.2 + RI-WPN02 §D D6 — per-clip motion integrity over EVERY clip in the game.
//
// §E.2 exists because "a roster can hold every band on those 28 clips and ship 1 100 others that
// snap, slide and teleport, and nothing in corpus/12-weapons/ would see it". So this walks every
// slot of every weapon in both stances and measures four rows on each:
//
//   arc conformance      measured arc_sweep_deg vs the SLOT's declared value, +/-10 deg
//   pose discontinuity   max per-frame world displacement, of a BONE and of the weapon SOCKET
//   tip-speed ceiling    max socket speed vs 1.25 x the tier's RI-WPN05 §E peak band ceiling
//   distinct keyframes   frames at which the tip's velocity direction changes, >= 3
//
// plus the recovery-vs-active comparison the round-1 and round-2 verdicts both raised, reported
// two ways — by bearing (the verdicts' measure) and by TIP PATH LENGTH in metres — because the
// bearing measure is unstable exactly where a recovery puts the weapon, and the difference
// between the two readings is itself the finding. See §NEAR_AXIS below.
//
//   node tools/weapons/motion-census.mjs [out.json] [--gate] [--full]
//
// Default samples every slot of the 15 class baselines plus every r1.1/r2 of all 87; `--full`
// walks all 87 x every slot x both stances.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const { MovesetLibrary } = await import(`${ROOT}/game/src/combat/moveset.js`);
const { Rig } = await import(`${ROOT}/game/src/combat/skeleton.js`);

const D = loadCombatData();
const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/classes.json`, 'utf8'));
const lib = new MovesetLibrary(
  { clips: JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/clip-registry.json`, 'utf8')).clips },
  CLASSES, D.weaponMovesets, D.skeleton, D.hitgeometry);

/** RI-WPN05 §E peak tip speed bands (m/s). §E.2's ceiling is 1.25x the band's top. */
const BAND_TOP = { light: 20, medium: 26, heavy: 32, ultra: 40, ranged: 20 };
/** RI-WPN05 §E anticipation-fraction floors, by tier. `ranged` has no §E row; use light's. */
const ANTI_MIN = { light: 0.08, medium: 0.15, heavy: 0.25, ultra: 0.30, ranged: 0.08 };
/** RI-WPN05 §E follow-through-fraction floors, by tier. */
const FOLLOW_MIN = { light: 0.20, medium: 0.20, heavy: 0.25, ultra: 0.30, ranged: 0.20 };
const POSE_CEIL = 0.25;      // §E.2 pose discontinuity, metres per frame at 60 Hz
const POSE_HARD = 1.00;      // §E.2 HARD FAIL: a teleport with a sword attached
const ARC_TOL = 10;          // §E.2 arc conformance

/**
 * The near-axis guard, and why the number it produces matters.
 *
 * A bearing about the character's own vertical axis is numerically meaningless when the thing
 * being measured is ON that axis: a tip 12 mm from the axis can sweep 180 degrees of bearing by
 * moving 24 mm. A recovery is exactly where a weapon is tucked against the body, so a
 * recovery-vs-active comparison made in bearing is measured at its least stable point. Both
 * readings are reported and the artifact is quantified per clip (`recovery_near_axis_frac`).
 */
const NEAR_AXIS = 0.20;

function trackOf(rig, weaponId, slotId) {
  const clip = lib.clipFor(weaponId, slotId);
  const sock = lib.socketsFor(weaponId, slotId);
  const slot = D.weaponMovesets[weaponId].slots[slotId];
  const startup = slot.startup_f + (slot.charge_max_f || 0);
  const rows = [];
  const pos = [0, 0, 0];
  for (let f = 1; f <= clip.total; f++) {
    pos[2] = clip.rootForwardAt(f);
    clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
    rows.push({
      f,
      A: [...rig.socketA], B: [...rig.socketB], pos: [...pos],
      bones: rig.world.map((m) => [m[9], m[10], m[11]]),
    });
  }
  return { rows, startup, active: slot.active_f, clip: clip.id, declared: slot.arc_sweep_deg };
}

function analyse(t) {
  const { rows, startup, active } = t;
  const isAct = (r) => r.f > startup && r.f <= startup + active;
  const isRec = (r) => r.f > startup + active;
  const bearingTravel = (sel) => {
    let prev = null, tr = 0, n = 0, near = 0, tot = 0;
    for (const r of rows) {
      if (!sel(r)) continue;
      tot++;
      const dx = r.B[0] - r.pos[0], dz = r.B[2] - r.pos[2];
      if (Math.hypot(dx, dz) < NEAR_AXIS) { prev = null; near++; continue; }
      const b = Math.atan2(dx, dz);
      if (prev !== null) {
        let d = b - prev;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        // `arc_sweep_deg` is directed start-to-end angular sweep. Do not turn small corrective
        // elbow/shoulder wobble into extra authored arc by summing absolute path length.
        tr += d; n++;
      }
      prev = b;
    }
    return { deg: +(Math.abs((tr * 180) / Math.PI)).toFixed(1), n, near_frac: tot ? +(near / tot).toFixed(3) : 0 };
  };
  const pathLen = (sel) => {
    let L = 0, prev = null;
    for (const r of rows) { if (!sel(r)) { prev = null; continue; } if (prev) L += Math.hypot(r.B[0] - prev[0], r.B[1] - prev[1], r.B[2] - prev[2]); prev = r.B; }
    return +L.toFixed(3);
  };
  // pose discontinuity: bones and weapon sockets measured separately (see §amendment note)
  let boneStep = 0, sockStep = 0, tipSpeed = 0;
  for (let i = 1; i < rows.length; i++) {
    for (let b = 0; b < rows[i].bones.length; b++) {
      const p = rows[i - 1].bones[b], q = rows[i].bones[b];
      boneStep = Math.max(boneStep, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    }
    for (const k of ['A', 'B']) {
      const p = rows[i - 1][k], q = rows[i][k];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      sockStep = Math.max(sockStep, d);
      if (k === 'B') tipSpeed = Math.max(tipSpeed, d * 60);
    }
  }
  // distinct keyframes: sign changes in the tip's velocity direction
  let keys = 0, pv = null;
  for (let i = 1; i < rows.length; i++) {
    const v = [rows[i].B[0] - rows[i - 1].B[0], rows[i].B[1] - rows[i - 1].B[1], rows[i].B[2] - rows[i - 1].B[2]];
    const n = Math.hypot(v[0], v[1], v[2]);
    if (n < 1e-6) continue;
    const u = [v[0] / n, v[1] / n, v[2] / n];
    // "number of frames at which the tip's velocity direction changes". A two-pose lerp has a
    // CONSTANT direction and scores zero; the threshold only has to exceed float noise, so it is
    // ~8 degrees of turn. A tighter threshold measures curvature rather than authorship and would
    // fail hand-authored clips for being smooth.
    if (pv) { const dot = u[0] * pv[0] + u[1] * pv[1] + u[2] * pv[2]; if (dot < 0.99) keys++; }
    pv = u;
  }
  // ---- RI-WPN05 §E ANTICIPATION and FOLLOW-THROUGH, per clip. -------------------------------
  //
  // §E defines both as fractions along "the swing direction", and the swing direction is not a
  // world axis — it is the direction the tip is travelling while the hitbox is live. So it is
  // taken here as the mean unit tip velocity over the ACTIVE window, and the two rows are:
  //
  //   anticipation  fraction of STARTUP frames whose tip velocity has a NEGATIVE component
  //                 along that direction (the weapon travelling back before it travels forward)
  //   follow        fraction of RECOVERY frames, BEFORE the first reversal, whose tip velocity
  //                 still has a POSITIVE component along it ("the tip continues along the swing
  //                 arc for >=20% of recovery frames before reversing")
  //
  // §E's own bands are per tier and are applied by the caller. Neither row had an instrument
  // anywhere in the tree before this: M5 names `corpus/80-methods/m-wpn05-impact.mjs`, which does
  // not exist, so §E's follow-through row has never been measured on any build. Added by W1-MASS
  // because it is the row the calibrateExcursion off-by-two was silently failing.
  //
  // THE SWING DIRECTION IS TAKEN AT THE BOUNDARY, NOT AS A MEAN, and the difference is not
  // cosmetic. A first cut of this used the MEAN unit tip velocity over the whole active window,
  // and on a wide arc that is wrong by construction: the tangent of a 300-degree sweep rotates
  // most of the way round, so its mean points somewhere the tip is never actually going, and the
  // last active frame's true direction can sit at 150 degrees to it. Measured that way the fix
  // to `calibrateExcursion` appeared to make the follow-through row WORSE (64.4% against 59.4%)
  // while `follow_scale` had gone from 122 clips pinned at zero to none — the instrument, not
  // the build. §E says "continues along the swing ARC", so the reference is the instantaneous
  // direction at the boundary: the FIRST active frame for anticipation, the LAST for follow.
  const vel = [];
  for (let i = 1; i < rows.length; i++) {
    vel.push({ f: rows[i].f, v: [rows[i].B[0] - rows[i - 1].B[0], rows[i].B[1] - rows[i - 1].B[1], rows[i].B[2] - rows[i - 1].B[2]] });
  }
  const unitAt = (f) => {
    const e = vel.find((x) => x.f === f);
    if (!e) return null;
    const n = Math.hypot(e.v[0], e.v[1], e.v[2]);
    return n > 1e-9 ? [e.v[0] / n, e.v[1] / n, e.v[2] / n] : null;
  };
  const dirIn = unitAt(startup + 2);              // the swing direction as the hitbox opens
  const dirOut = unitAt(startup + active);        // the swing direction as the hitbox closes
  const dot = (e, u) => e.v[0] * u[0] + e.v[1] * u[1] + e.v[2] * u[2];
  let antiN = 0, antiD = 0, folN = 0, folD = 0;
  if (dirIn) for (const e of vel) if (e.f <= startup) { antiD++; if (dot(e, dirIn) < 0) antiN++; }
  // "before reversing": count forward recovery frames up to the FIRST frame that reverses.
  if (dirOut) {
    for (const e of vel) {
      if (e.f <= startup + active) continue;
      folD++;
      if (folN === folD - 1 && dot(e, dirOut) > 0) folN++;
    }
  }

  const act = bearingTravel(isAct), rec = bearingTravel(isRec);
  return {
    anticipation_frac: antiD ? +(antiN / antiD).toFixed(3) : null,
    follow_through_frac: folD ? +(folN / folD).toFixed(3) : null,
    arc_active: act.deg,
    arc_recovery: rec.deg,
    recovery_near_axis_frac: rec.near_frac,
    path_active_m: pathLen(isAct),
    path_recovery_m: pathLen(isRec),
    pose_step_bone_m: +boneStep.toFixed(4),
    pose_step_socket_m: +sockStep.toFixed(4),
    tip_speed_mps: +tipSpeed.toFixed(2),
    distinct_keyframes: keys,
  };
}

// ---- pick the sample -------------------------------------------------------------------------
const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
for (const k of Object.keys(byClass)) byClass[k].sort();
const FULL = process.argv.includes('--full');
const jobs = [];
for (const [c, ids] of Object.entries(byClass)) {
  for (const wid of ids) {
    const ms = D.weaponMovesets[wid];
    const isBase = wid === ids[0];
    for (const slotId of Object.keys(ms.slots)) {
      const core = slotId === 'r1.1' || slotId === 'r2' || slotId === 'bow.quick' || slotId === 'bow.aimed';
      if (FULL || isBase || core) jobs.push({ c, wid, slotId, tier: ms.weight_tier });
    }
  }
}

const rig = new Rig(D.skeleton, D.hitgeometry);
const rows = [];
for (const j of jobs) {
  const t = trackOf(rig, j.wid, j.slotId);
  const a = analyse(t);
  const declared = Math.abs(t.declared);
  const err = +(a.arc_active - declared).toFixed(1);
  rows.push({
    ...j, clip: t.clip, declared, ...a, arc_err: err,
    arc_ok: Math.abs(err) <= ARC_TOL,
    pose_ok_bone: a.pose_step_bone_m <= POSE_CEIL,
    pose_hard: a.pose_step_socket_m > POSE_HARD,
    tip_ok: a.tip_speed_mps <= BAND_TOP[j.tier] * 1.25,
    keys_ok: a.distinct_keyframes >= 3,
    anti_ok: a.anticipation_frac === null ? null : a.anticipation_frac >= ANTI_MIN[j.tier],
    follow_ok: a.follow_through_frac === null ? null : a.follow_through_frac >= FOLLOW_MIN[j.tier],
    rec_gt_act_bearing: a.arc_recovery > a.arc_active,
    rec_gt_act_path: a.path_recovery_m > a.path_active_m,
  });
}

const n = rows.length;
const pct = (k) => +((100 * rows.filter((r) => !r[k]).length) / n).toFixed(2);
const worst = (k, dir = -1) => [...rows].sort((a, b) => dir * (a[k] - b[k])).slice(0, 10)
  .map((r) => `${r.wid}/${r.slotId} ${r[k]}`);

const out = {
  generated: new Date().toISOString(),
  sample: FULL ? 'every slot of all 87 weapons' : 'every slot of the 15 class baselines + r1.1/r2 of all 87',
  clips_measured: n,
  arc: { nonconforming: rows.filter((r) => !r.arc_ok).length, pct_violating: pct('arc_ok'),
    worst: [...rows].sort((a, b) => Math.abs(b.arc_err) - Math.abs(a.arc_err)).slice(0, 10)
      .map((r) => `${r.wid}/${r.slotId} decl ${r.declared} meas ${r.arc_active} err ${r.arc_err}`) },
  pose_bone: { pct_violating: pct('pose_ok_bone'), worst: worst('pose_step_bone_m') },
  pose_socket_hard_fail: rows.filter((r) => r.pose_hard).map((r) => `${r.wid}/${r.slotId} ${r.pose_step_socket_m} m`),
  pose_socket_worst: worst('pose_step_socket_m'),
  tip_speed: { pct_violating: pct('tip_ok'), worst: worst('tip_speed_mps') },
  anticipation: { pct_violating: pct('anti_ok'), worst: worst('anticipation_frac', 1) },
  follow_through: {
    pct_violating: pct('follow_ok'),
    dead: rows.filter((r) => r.follow_through_frac !== null && r.follow_through_frac <= 0.02).length,
    worst: worst('follow_through_frac', 1),
  },
  keyframes: { pct_violating: pct('keys_ok'), worst: worst('distinct_keyframes', 1) },
  recovery_exceeds_active: {
    by_bearing: rows.filter((r) => r.rec_gt_act_bearing).length,
    by_tip_path: rows.filter((r) => r.rec_gt_act_path).length,
    of: n,
    bearing_offenders_mostly_near_axis: rows.filter((r) => r.rec_gt_act_bearing && r.recovery_near_axis_frac > 0.3).length,
  },
  rows,
};
fs.writeFileSync(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/dev/stdout', JSON.stringify(out, null, 1));
console.log(`clips measured                 ${n}`);
console.log(`arc nonconforming (+/-10 deg)  ${out.arc.nonconforming}  (${out.arc.pct_violating}% — E.2 FAILs above 2%)`);
console.log(`pose step > 0.25 m, BONE       ${out.pose_bone.pct_violating}%`);
console.log(`pose step > 1.00 m, SOCKET     ${out.pose_socket_hard_fail.length}  (E.2 HARD FAIL if any)`);
console.log(`   worst socket step           ${out.pose_socket_worst[0]}`);
console.log(`tip speed over 1.25x band      ${out.tip_speed.pct_violating}%   worst ${out.tip_speed.worst[0]}`);
console.log(`distinct keyframes < 3         ${out.keyframes.pct_violating}%  (E.2 HARD FAIL above 5%)`);
console.log(`§E anticipation under band     ${out.anticipation.pct_violating}%`);
console.log(`§E follow-through under band   ${out.follow_through.pct_violating}%   DEAD (<=0.02): ${out.follow_through.dead}`);
console.log(`recovery > active, by bearing  ${out.recovery_exceeds_active.by_bearing}/${n}  (${out.recovery_exceeds_active.bearing_offenders_mostly_near_axis} of them near-axis artefacts)`);
console.log(`recovery > active, by tip path ${out.recovery_exceeds_active.by_tip_path}/${n}`);
if (process.argv.includes('--gate') && (out.arc.pct_violating > 2 || out.pose_socket_hard_fail.length || out.keyframes.pct_violating > 5)) process.exit(1);
