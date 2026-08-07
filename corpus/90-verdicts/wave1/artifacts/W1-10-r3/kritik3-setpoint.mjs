// KRITIK3 — is the OBSERVED fingerprint column a measurement, or a readback of its own setpoint?
//
// WEAPON-CRITIC §3.3 clause 1, binding from wave 2 and applied here as the governing standard:
//
//   > "The `observed` column is the score. A number computable from
//   >  `game/data/combat/movesets/*.json` with the game disconnected is `unmeasurable => 0`."
//
// Round 3 added two solvers to `game/src/combat/moveset.js`:
//
//   `_yawGain(weaponId, slotId, ...)`   solves a per-clip yaw gain so that the arc the rig sweeps
//                                        equals the SLOT's declared `arc_sweep_deg`
//   `_bladeLength(weaponId)`             solves the socket-B distance so that the tip's max
//                                        horizontal radius over the lead slot's active window
//                                        equals the weapon's declared `reach_m`
//
// D5 (`reach_m`) and D6 (`arc_sweep_deg`) are two of `RI-WPN02` §D's twelve fingerprint
// dimensions, two of the nine `GRAMMAR_DIMS`, and two of the columns `F87`/`SEP` reads. If the
// runtime is fitted to the declaration and the observed column is then read off the fitted
// runtime, the observed column is the declaration wearing a lab coat.
//
// Three tests, and only the third can distinguish a measurement from an echo:
//
//   T1  RESIDUAL       |observed - declared| for reach and arc, all 87 weapons, r1.1.
//                      A solver's fixed point is ~0. A measurement of an authored animation is not.
//   T2  ANIMATION-BLIND  perturb the ANIMATION (the clip registry's own capsule length, and the
//                      registry arc profile) and re-read the observed column. If the observed
//                      column does not move, the animation is not an input to it.
//   T3  DECLARATION-BOUND  perturb the DECLARATION (`reach_m` / `arc_sweep_deg` in
//                      `game/data/combat/movesets/*.json`) and re-read. If the observed column
//                      moves by exactly the perturbation, the JSON is the only input.
//
//   node kritik3-setpoint.mjs out.json
'use strict';
import fs from 'node:fs';

const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';

const { loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const { MovesetLibrary } = await import(`${ROOT}/game/src/combat/moveset.js`);
const { Rig } = await import(`${ROOT}/game/src/combat/skeleton.js`);

const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/classes.json`, 'utf8'));
const REG_SRC = JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/clip-registry.json`, 'utf8'));
const NEAR_AXIS = 0.20;

/**
 * Walk one slot on the real rig and report what the tip actually did. This is the SAME walk the
 * build's own `tools/weapons/fingerprint.mjs` performs for its observed column — deliberately, so
 * that any disagreement below is about the inputs and not about the ruler.
 */
function walk(lib, movesets, weaponId, slotId, rig) {
  const slot = movesets[weaponId].slots[slotId];
  if (!slot) return null;
  const clip = lib.clipFor(weaponId, slotId);
  const sock = lib.socketsFor(weaponId, slotId);
  const startup = slot.startup_f + (slot.charge_max_f || 0);
  const pos = [0, 0, 0];
  let prev = null, arc = 0, reach = 0;
  for (let f = 1; f <= clip.total; f++) {
    pos[2] = clip.rootForwardAt(f);
    clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
    if (f <= startup || f > startup + slot.active_f) continue;
    const dx = rig.socketB[0] - pos[0], dz = rig.socketB[2] - pos[2];
    const r = Math.hypot(dx, dz);
    if (r > reach) reach = r;
    if (r < NEAR_AXIS) { prev = null; continue; }
    const b = Math.atan2(dx, dz);
    if (prev !== null) { let d = b - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; arc += Math.abs(d); }
    prev = b;
  }
  return { reach_m: +reach.toFixed(4), arc_deg: +(arc * 180 / Math.PI).toFixed(2), socket_b: sock.b };
}

/** A fresh library + data pair, optionally mutated first. */
function build(mutate) {
  const D = loadCombatData();
  const reg = JSON.parse(JSON.stringify(REG_SRC));
  if (mutate) mutate(D, reg);
  const lib = new MovesetLibrary({ clips: reg.clips }, CLASSES, D.weaponMovesets, D.skeleton, D.hitgeometry);
  return { D, lib, rig: new Rig(D.skeleton, D.hitgeometry) };
}

function readAll(ctx) {
  const rows = {};
  for (const [id, ms] of Object.entries(ctx.D.weaponMovesets)) {
    if (!ms.slots['r1.1']) continue;
    const w = walk(ctx.lib, ctx.D.weaponMovesets, id, 'r1.1', ctx.rig);
    if (!w) continue;
    rows[id] = { class: ms.class, declared_reach: ms.reach_m, declared_arc: ms.slots['r1.1'].arc_sweep_deg, ...w };
  }
  return rows;
}

const out = { generated: new Date().toISOString(), instrument: 'kritik3-setpoint.mjs (critic-authored, round 3)' };

// ---- T1 residual ------------------------------------------------------------------------------
const base = build(null);
const R0 = readAll(base);
const ids = Object.keys(R0);
const dr = ids.map((i) => Math.abs(R0[i].reach_m - R0[i].declared_reach));
const da = ids.map((i) => Math.abs(R0[i].arc_deg - R0[i].declared_arc));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(4); };
out.T1_residual = {
  weapons: ids.length,
  reach_abs_err: { median: q(dr, 0.5), p90: q(dr, 0.9), max: +Math.max(...dr).toFixed(4), within_0_01: dr.filter((x) => x <= 0.01).length, within_0_10: dr.filter((x) => x <= 0.10).length },
  arc_abs_err_deg: { median: q(da, 0.5), p90: q(da, 0.9), max: +Math.max(...da).toFixed(3), within_0_1: da.filter((x) => x <= 0.1).length, within_1_0: da.filter((x) => x <= 1.0).length },
};
console.log('T1  reach |obs-decl|  median', out.T1_residual.reach_abs_err.median, ' max', out.T1_residual.reach_abs_err.max,
  ` within 0.01 m: ${out.T1_residual.reach_abs_err.within_0_01}/${ids.length}`);
console.log('T1  arc   |obs-decl|  median', out.T1_residual.arc_abs_err_deg.median, ' max', out.T1_residual.arc_abs_err_deg.max,
  ` within 0.1 deg: ${out.T1_residual.arc_abs_err_deg.within_0_1}/${ids.length}`);

// ---- T2 animation-blind ----------------------------------------------------------------------
// Halve every clip's own capsule length in the registry — the animation's blade — and scale every
// registry arc profile by 0.4. Nothing in movesets/*.json is touched.
const anim = build((D, reg) => {
  for (const c of Object.values(reg.clips)) {
    if (c.capsule_length_m !== undefined) c.capsule_length_m = +(c.capsule_length_m * 0.5).toFixed(4);
    if (c.profile && c.profile.arc_deg !== undefined) c.profile.arc_deg = +(c.profile.arc_deg * 0.4).toFixed(3);
  }
});
const R2 = readAll(anim);
const moved_r = ids.filter((i) => R2[i] && Math.abs(R2[i].reach_m - R0[i].reach_m) > 0.02);
const moved_a = ids.filter((i) => R2[i] && Math.abs(R2[i].arc_deg - R0[i].arc_deg) > 1.0);
out.T2_animation_blind = {
  perturbation: 'clip-registry capsule_length_m x0.5 AND profile.arc_deg x0.4 on every clip',
  weapons_whose_observed_reach_moved_over_0_02m: moved_r.length,
  weapons_whose_observed_arc_moved_over_1deg: moved_a.length,
  max_reach_shift_m: +Math.max(...ids.map((i) => (R2[i] ? Math.abs(R2[i].reach_m - R0[i].reach_m) : 0))).toFixed(4),
  max_arc_shift_deg: +Math.max(...ids.map((i) => (R2[i] ? Math.abs(R2[i].arc_deg - R0[i].arc_deg) : 0))).toFixed(3),
  sample: ids.slice(0, 4).map((i) => ({ w: i, reach_before: R0[i].reach_m, reach_after: R2[i].reach_m, arc_before: R0[i].arc_deg, arc_after: R2[i].arc_deg })),
};
console.log('T2  observed reach moved on', moved_r.length, '/', ids.length, 'weapons (max', out.T2_animation_blind.max_reach_shift_m, 'm);',
  'observed arc moved on', moved_a.length, '(max', out.T2_animation_blind.max_arc_shift_deg, 'deg)');

// ---- T3 declaration-bound --------------------------------------------------------------------
const decl = build((D) => {
  for (const ms of Object.values(D.weaponMovesets)) {
    if (ms.reach_m !== undefined) ms.reach_m = +(ms.reach_m + 0.50).toFixed(4);
    const s = ms.slots['r1.1'];
    if (s && s.arc_sweep_deg !== undefined) s.arc_sweep_deg = +(Math.abs(s.arc_sweep_deg) * 1.30).toFixed(2);
  }
});
const R3 = readAll(decl);
const followed_r = ids.filter((i) => R3[i] && Math.abs((R3[i].reach_m - R0[i].reach_m) - 0.50) <= 0.05);
const followed_a = ids.filter((i) => R3[i] && R0[i].declared_arc > 5 && Math.abs(R3[i].arc_deg / Math.max(1e-6, R0[i].arc_deg) - 1.30) <= 0.10);
out.T3_declaration_bound = {
  perturbation: 'movesets/*.json reach_m +0.50 m and r1.1 arc_sweep_deg x1.30',
  weapons_whose_observed_reach_followed_within_0_05m: followed_r.length,
  weapons_with_arc_over_5deg: ids.filter((i) => R0[i].declared_arc > 5).length,
  weapons_whose_observed_arc_followed_within_10pct: followed_a.length,
  sample: ids.slice(0, 4).map((i) => ({ w: i, reach_before: R0[i].reach_m, reach_after: R3[i].reach_m, arc_before: R0[i].arc_deg, arc_after: R3[i].arc_deg })),
};
console.log('T3  observed reach followed the declaration on', followed_r.length, '/', ids.length,
  '; observed arc followed on', followed_a.length, '/', out.T3_declaration_bound.weapons_with_arc_over_5deg);

out.ruling = {
  question: 'Is the OBSERVED column of D5/D6 a measurement of the shipping animation, or a readback of the JSON setpoint?',
  finding: `residual ~${out.T1_residual.reach_abs_err.median} m / ${out.T1_residual.arc_abs_err_deg.median} deg; ` +
    `animation perturbation moved ${moved_r.length}/${ids.length} reaches; declaration perturbation moved ${followed_r.length}/${ids.length}.`,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nwrote', OUT);
