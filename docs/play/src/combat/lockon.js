// Lock-on: acquisition, retention with hysteresis, directional semantics, soft-lock steering,
// and the RI-CAM03 containment law measured rather than asserted.
//
// RI-CMB06's bar: "a roll that goes the wrong way once per fight destroys the player's trust
// in the input system permanently." The load-bearing rule is §C's fourth row — A LEFT ROLL
// UNDER LOCK CIRCLES THE TARGET. It does not move toward camera-left and it does not move
// toward world -X. Everything else here exists to make that rule expressible.
'use strict';

import { bearingDeg, angleDelta, norm360 } from './geometry.js';

const _chestA = [0, 0, 0], _chestB = [0, 0, 0];

export class LockOn {
  constructor(cfg) {
    this.C = cfg;                       // game/data/combat/lockon.json
    this.target = null;                 // body id
    this.losLostAt = -1;
    this.lastSwitchFrame = -9999;
    this.score = null;
    this.bothFramed = true;
  }

  /** RI-CMB06 §A: score = angle_from_camera_forward_deg + 2.0 * distance_m, minimised. */
  acquire(player, bodies, cameraYawDeg, frame) {
    const A = this.C.acquisition;
    let best = null, bestScore = Infinity;
    for (const b of bodies) {
      if (b === player || b.dead || b.yielded || b.side === player.side) continue;
      if (b.lockable === false) continue;                    // merchants, quest actors: never
      const dx = b.pos[0] - player.pos[0], dz = b.pos[2] - player.pos[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > A.range_m) continue;
      const ang = Math.abs(angleDelta(cameraYawDeg, bearingDeg(dx, dz)));
      if (ang > A.cone_horizontal_deg) continue;
      const s = ang + 2.0 * d;
      if (s < bestScore) { bestScore = s; best = b; }
    }
    if (!best) return null;
    this.target = best.id;
    this.score = round2(bestScore);
    this.losLostAt = -1;
    return { target: best.id, range_m: round2(Math.hypot(best.pos[0] - player.pos[0], best.pos[2] - player.pos[2])), score: this.score };
  }

  release() { const t = this.target; this.target = null; this.score = null; this.losLostAt = -1; return t; }

  /** Retention. Break at 18 m (deliberately > the 14 m acquisition range), on death, or after
   *  30 frames without line of sight. Auto-reacquire is NEVER. */
  update(player, bodies, frame, hasLOS) {
    if (!this.target) return null;
    const t = bodies.find((b) => b.id === this.target);
    if (!t || t.dead || t.yielded) { this.release(); return 'target_gone'; }
    const d = Math.hypot(t.pos[0] - player.pos[0], t.pos[2] - player.pos[2]);
    if (d > this.C.acquisition.break_range_m) { this.release(); return 'out_of_range'; }
    if (hasLOS === false) {
      if (this.losLostAt < 0) this.losLostAt = frame;
      if (frame - this.losLostAt >= this.C.acquisition.los_grace_frames) { this.release(); return 'los_lost'; }
    } else this.losLostAt = -1;
    return null;
  }

  /**
   * RI-CMB06 §C — the whole directional table, in one function.
   * @returns {{dirDeg:number, backstep:boolean, facingDeg:number, speedMult:number}}
   */
  resolveDirection(player, targetBody, stickX, stickY, cameraYawDeg, quantise) {
    const mag = Math.hypot(stickX, stickY);
    if (!targetBody) {
      // no lock: camera-relative, character turns to the direction of travel
      if (mag < 1e-6) return { dirDeg: player.yaw, backstep: true, facingDeg: player.yaw, speedMult: 1.0 };
      const dir = norm360(cameraYawDeg + Math.atan2(stickX, stickY) * 180 / Math.PI);
      return { dirDeg: dir, backstep: false, facingDeg: dir, speedMult: 1.0 };
    }
    const toTarget = bearingDeg(targetBody.pos[0] - player.pos[0], targetBody.pos[2] - player.pos[2]);
    if (mag < this.C.directional.stick_threshold) {
      // backstep, directly AWAY from the target, facing held ON the target
      return { dirDeg: norm360(toTarget + 180), backstep: true, facingDeg: toTarget, speedMult: 1.0 };
    }
    // TARGET-RELATIVE: forward is the vector to the target, right is that rotated +90.
    let rel = Math.atan2(stickX, stickY) * 180 / Math.PI;
    if (quantise) {
      const bin = this.C.directional.quantise_bins_deg;
      rel = Math.round(rel / bin) * bin;
    }
    const dir = norm360(toTarget + rel);
    return { dirDeg: dir, backstep: false, facingDeg: toTarget, speedMult: this.speedMultFor(rel) };
  }

  speedMultFor(relDeg) {
    const m = this.C.directional.speed_multipliers;
    const a = Math.abs(angleDelta(0, relDeg));
    if (a <= 22.5) return m.forward;
    if (a <= 67.5) return m.diagonal_forward;
    if (a <= 112.5) return m.lateral;
    if (a <= 157.5) return m.diagonal_back;
    return m.backward;
  }

  /**
   * RI-CMB06 §D — soft-lock steering during an attack. Frame 1 snaps; thereafter the yaw rate
   * is capped and then frozen. This is the rule that decides whether spacing is a skill:
   * a player who strafes wider than the remaining angular budget is MISSED.
   */
  steerDuringAttack(body, targetBody, animFrame, startup) {
    if (!targetBody) return 0;
    const toTarget = bearingDeg(targetBody.pos[0] - body.pos[0], targetBody.pos[2] - body.pos[2]);
    if (animFrame <= 1) {                                        // frame-1 snap, one frame only
      body.yaw = toTarget; body.steerBudgetDeg = 0; return 0;
    }
    // ---- W1-06 / RI-CAM04 §D — THE COMMIT CUTOFF ---------------------------------------
    // RI-CMB06 §D gives band fractions; RI-AI02 §C gives a HARD rule, `Tc ≤ W − 8`, and a
    // total yaw budget. Both bind the player. The reconciliation is:
    //
    //     b1 = ceil(0.40 W)                   end of the fast band
    //     Tc = min(floor(0.80 W), W − 8)      the cutoff frame — FROZEN after it
    //     GLOBAL CAP: total post-snap yaw ≤ 45.0°, whichever binds first
    //
    // The `W − 8` term is what stops a long windup buying more correction than a short one,
    // and the 45° cap is what stops the slowest weapons becoming the most forgiving — the
    // inversion of the whole risk model that RI-CAM04 "How we lose" #9 names. Without them a
    // straight sword steered through frame 19 instead of 16 and an ultra greatsword R2 got
    // 154° of free aim. The fractions alone are not the law.
    const b1 = Math.ceil(0.40 * startup);
    const Tc = Math.min(Math.floor(0.80 * startup), startup - 8);
    if (animFrame > Tc) return 0;                                // frozen, and stays frozen
    const sch = this.C.soft_lock.steering_schedule;
    const rateDps = animFrame <= b1 ? sch[0].yaw_rate_dps : sch[1].yaw_rate_dps;
    if (rateDps === 0) return 0;
    const cap = this.C.soft_lock.global_cap_deg === undefined ? 45.0 : this.C.soft_lock.global_cap_deg;
    const spent = body.steerBudgetDeg || 0;
    if (spent >= cap) return 0;
    let maxStep = rateDps / 60;
    if (spent + maxStep > cap) maxStep = cap - spent;
    let d = angleDelta(body.yaw, toTarget);
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    body.yaw = norm360(body.yaw + d);
    body.steerBudgetDeg = spent + Math.abs(d);
    return d;
  }

  /** The §D table, computed rather than transcribed, so a critic can diff it against the
   *  reference item's own arithmetic without running the game. */
  static cutoffFor(startup) {
    return {
      W: startup,
      b1: Math.ceil(0.40 * startup),
      Tc: Math.min(Math.floor(0.80 * startup), startup - 8),
    };
  }

  /**
   * RI-CAM03's containment law, MEASURED. Both combatants' chest nodes are projected through
   * the camera basis; `both_framed` is true when both land inside the normalised screen box.
   * The trace carries it every frame, so "both combatants stay framed" is a statistic a critic
   * can compute over a fight rather than a claim a builder can make.
   */
  measureFraming(camera, player, targetBody, fovDeg, aspect) {
    if (!targetBody) { this.bothFramed = true; return { both_framed: true, p: null, t: null }; }
    player.chestPos(_chestA);
    targetBody.chestPos(_chestB);
    const p = project(camera, _chestA, fovDeg, aspect);
    const t = project(camera, _chestB, fovDeg, aspect);
    const inFrame = (q) => q && q.z > 0 && Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1;
    this.bothFramed = inFrame(p) && inFrame(t);
    return {
      both_framed: this.bothFramed,
      p: p ? [round3(p.x), round3(p.y)] : null,
      t: t ? [round3(t.x), round3(t.y)] : null,
    };
  }
}

/** Normalised device coordinates of a world point, from the camera's pos/pivot. */
function project(camera, world, fovDeg, aspect) {
  const fx = camera.pivot[0] - camera.pos[0];
  const fy = camera.pivot[1] - camera.pos[1];
  const fz = camera.pivot[2] - camera.pos[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const f = [fx / fl, fy / fl, fz / fl];
  // right = normalize(cross(f, up)); up' = cross(right, f)
  const rx = f[2] * 0 - f[1] * 0, ry = 0, rz = 0;   // placeholder, replaced below
  let r = [f[2], 0, -f[0]];
  const rl = Math.hypot(r[0], r[1], r[2]) || 1;
  r = [r[0] / rl, r[1] / rl, r[2] / rl];
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  const dx = world[0] - camera.pos[0], dy = world[1] - camera.pos[1], dz = world[2] - camera.pos[2];
  const z = dx * f[0] + dy * f[1] + dz * f[2];
  if (z <= 1e-4) return { x: 0, y: 0, z };
  const xr = dx * r[0] + dy * r[1] + dz * r[2];
  const yu = dx * u[0] + dy * u[1] + dz * u[2];
  const tanHalf = Math.tan(fovDeg * Math.PI / 360);
  return { x: xr / (z * tanHalf * aspect), y: yu / (z * tanHalf), z };
}

function round2(v) { return Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
