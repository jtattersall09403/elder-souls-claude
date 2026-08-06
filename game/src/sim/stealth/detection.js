// The detection model — RI-STL01 §2 §3 §4 §6.
//
// Everything here is a CONTINUOUS, DETERMINISTIC function evaluated per fixed step. There is
// no roll in this file and there must never be one. RI-STL01 "How we lose": *"Detection becomes
// a dice roll. 'Sneak 60 means a 60% chance to remain unseen, rolled every second.' This is
// Morrowind's actual implementation, it is the most natural thing in the world to write, and it
// is banned."* The module imports no RNG, which is the cheapest possible enforcement.
//
// Every rate constant below is per SECOND, and is divided by 60 exactly once — in `fillPerFrame`
// — to reach f@60 (seam S22). No other file may divide by 60 again.
'use strict';

export const HZ = 60;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** RI-STL01 §2's V. Pure, allocation-free, and the single source of the number. */
export function visibility(data, { L, motion, sneak, load, inCover }) {
  const vis = data.visibility;
  const M = vis.motion_M[motion];
  if (M === undefined) throw new Error(`visibility: unknown motion ${JSON.stringify(motion)}; expected ${Object.keys(vis.motion_M).join('|')}`);
  const E = vis.equip_E[load];
  if (E === undefined) throw new Error(`visibility: unknown equip band ${JSON.stringify(load)}; expected ${Object.keys(vis.equip_E).join('|')}`);
  const S = Math.max(vis.sneak_S.floor, 1.00 - 0.006 * sneak);
  const A = inCover ? vis.cover_A.in_cover : vis.cover_A.default;
  const raw = Math.pow(clamp(L, 0, 1), vis.light_exponent) * M * S * E * A;
  return clamp(raw, vis.clamp[0], vis.clamp[1]);
}

/** The unclamped product, so a critic can see which clamp fired and why. */
export function visibilityRaw(data, q) {
  const vis = data.visibility;
  const S = Math.max(vis.sneak_S.floor, 1.00 - 0.006 * q.sneak);
  const A = q.inCover ? vis.cover_A.in_cover : vis.cover_A.default;
  return Math.pow(clamp(q.L, 0, 1), vis.light_exponent) * vis.motion_M[q.motion] * S * vis.equip_E[q.load] * A;
}

/**
 * RI-AI01 §B's cone geometry with RI-STL01 §2's V in front of it. Per SECOND.
 *
 * The constant 150 is not free: it is pinned by RI-STL01 §2's own worked table, where an
 * INFANTRY (R = 16 m) at 8 m fills at 97.5/s when V = 1.30. 150 x 1.30 x (1 - 8/16) = 97.5.
 */
export function baseFillPerSecond(data, { V, dist, R, cone }) {
  if (cone === 'none' || dist >= R) return 0;
  const geom = 150 * (1 - dist / R);
  if (cone === 'primary') return geom * V;
  if (cone === 'peripheral') return geom * V * data.perception_inherited_from_RI_AI01.peripheral_rate_scale;
  throw new Error(`baseFillPerSecond: unknown cone ${JSON.stringify(cone)}`);
}

/** The single place a per-second rate becomes an f@60 rate. */
export function fillPerFrame(perSecond) { return perSecond / HZ; }

/**
 * Which cone a target sits in, given the observer's facing. Angles in degrees.
 * `bearingDeg` is the signed angle from the observer's forward to the target.
 */
export function coneOf(data, bearingDeg) {
  const p = data.perception_inherited_from_RI_AI01;
  const a = Math.abs(normaliseDeg(bearingDeg));
  if (a <= p.primary_cone_deg) return 'primary';
  if (a <= p.peripheral_cone_deg) return 'peripheral';
  return 'none';                                  // the dead rear arc
}

export function normaliseDeg(d) {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

/** True if the target is inside the observer's rear arc — the backstab / pickpocket gate. */
export function inRearArc(data, bearingDeg) {
  return Math.abs(normaliseDeg(bearingDeg)) > data.perception_inherited_from_RI_AI01.rear_arc_deg;
}

// ---- sound ---------------------------------------------------------------------------------

/** RI-STL01 §4. Returns the radius in metres at which this movement is audible. */
export function soundRadius(data, { motion, sneak, load, surface }) {
  const s = data.sound;
  const rBase = data.perception_inherited_from_RI_AI01.hearing_r_m[motion];
  if (rBase === undefined) throw new Error(`soundRadius: unknown motion ${JSON.stringify(motion)}`);
  const E = s.E_sound[load];
  if (E === undefined) throw new Error(`soundRadius: unknown equip band ${JSON.stringify(load)}`);
  const surf = s.surface[surface];
  if (surf === undefined) throw new Error(`soundRadius: unknown surface ${JSON.stringify(surface)}; expected ${Object.keys(s.surface).join('|')}`);
  const S = Math.max(s.S_sound.floor, 1.00 - 0.005 * sneak);
  return rBase * E * S * surf;
}

/** The four discrete sound events. None is scaled by Sneak — they are not you moving. */
export function discreteSound(data, id) {
  const e = data.sound.discrete_events.find((x) => x.event === id);
  if (!e) throw new Error(`discreteSound: unknown event ${JSON.stringify(id)}`);
  return e;
}

// ---- civilians -----------------------------------------------------------------------------

export const CIV_STATES = ['CALM', 'WATCHING', 'CHALLENGE', 'ALARM'];

export function contextWeight(data, context) {
  const row = data.civilian.context_weight.find((c) => c.context === context);
  if (!row) throw new Error(`contextWeight: unknown context ${JSON.stringify(context)}`);
  return row.weight;
}

/**
 * The civilian model. NOT the enemy state machine, and the difference is load-bearing:
 * RI-STL01 "How we lose" — *"Civilians get the enemy state machine ... This collapses the
 * entire crime system into combat and destroys the CHALLENGE off-ramp, which is the
 * interaction that makes non-combat resolution reachable while you are misbehaving."*
 */
export function civSuspicionPerSecond(data, { V, dist, R, cone, raceSuspicion, context }) {
  const w = typeof context === 'number' ? context : contextWeight(data, context);
  if (w === 0) return 0;                        // a sheathed weapon in a public street: never
  return baseFillPerSecond(data, { V, dist, R, cone }) * raceSuspicion * w;
}

export function civStateFor(data, suspicion) {
  const t = data.civilian.thresholds;
  if (suspicion >= t.ALARM) return 'ALARM';
  if (suspicion >= t.CHALLENGE) return 'CHALLENGE';
  if (suspicion >= t.WATCHING) return 'WATCHING';
  return 'CALM';
}

/**
 * One civilian, one frame. Mutates `civ` in place (allocation discipline, RI-PLT01 P4) and
 * returns the state it transitioned INTO this frame, or null.
 *
 * Decay runs only on frames with no fill. That is not a simplification: RI-STL01 §2's worked
 * table gives 1.03 s to AGGRO at 97.5/s, which is 100/97.5 exactly — net-of-decay would be
 * 100/(97.5-12) = 1.17 s and the table would be wrong. Filling and decaying are alternatives.
 */
export function stepCivilian(data, civ, perSecond) {
  const before = civ.civ_state;
  if (perSecond > 0) civ.suspicion = Math.min(data.civilian.thresholds.ALARM, civ.suspicion + perSecond / HZ);
  else civ.suspicion = Math.max(0, civ.suspicion - data.civilian.decay_per_s / HZ);
  civ.civ_state = civStateFor(data, civ.suspicion);
  return civ.civ_state === before ? null : civ.civ_state;
}

/** ALARM-on-sight zones skip CHALLENGE entirely (RI-STL02 §4, the restricted class). */
export function isAlarmOnSight(data, context) {
  const row = data.civilian.context_weight.find((c) => c.context === context);
  return !!row && row.threshold === 'ALARM_ON_SIGHT';
}

// ---- the sneak state ------------------------------------------------------------------------

/**
 * Whether crouching is permitted this frame. RI-STL01 §5: you may not crouch your way out of
 * an active fight. Returns {allowed, reason}.
 */
export function crouchAllowed(data, { aggroEnemiesWithinM }) {
  const r = data.sneak_state.blocked_while;
  if (aggroEnemiesWithinM !== null && aggroEnemiesWithinM !== undefined && aggroEnemiesWithinM <= 8) {
    return { allowed: false, reason: r };
  }
  return { allowed: true, reason: null };
}

/**
 * THE SEAM (RI-STL01 §8). Whether a light attack landing right now is a stealth opener.
 *
 * This function's entire output is a BOOLEAN. It decides whether the attack routes to
 * W1-09's existing backstab critical — it never touches damage, frames, i-frames, the crit
 * multiplier or the rear-arc angle. Sneak enters exactly once, as a >= comparison against an
 * authored integer. That is the AR-1 guard and it is enforced by the shape of the return type:
 * there is no number here for a damage formula to multiply by.
 */
export function isStealthOpener(data, { targetAlertState, bearingDeg, sneak }) {
  const ok = targetAlertState === 'IDLE' || targetAlertState === 'PATROL' || targetAlertState === 'SUSPICIOUS';
  if (!ok) return false;
  if (!inRearArc(data, bearingDeg)) return false;
  return sneak >= data.sneak_state.opener_sneak_requirement;
}
