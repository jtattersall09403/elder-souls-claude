// The perception kernel — ONE implementation, read by every pair of eyes in the game.
//
// WHY THIS FILE EXISTS, stated plainly because it is the whole of the W1-15 round-1 verdict.
// Round 1 shipped two detection models. The civilian one multiplied `RI-AI01` §B's geometry by
// `RI-STL01` §2's visibility term `V` and behaved correctly. The enemy one was
//
//     if (sees) this.alert = Math.min(100, this.alert + 4);
//
// in `combat/enemy.js::_idleBehaviour` — a flat +4/frame inside a radius and a cone, which never
// read `V`, never read the sound radius, and never tested line of sight. An INFANTRY reached
// AGGRO in 0.500 s at `V` = 0.6669 and in 0.500 s at `V` = 0.0500. `RI-MTH07`'s coupling
// statistic on that pair is **0.00**, and under `ARBITRATION` §3's CONSUMPTION check a model
// with coupling 0 scores 0 exactly as a missing model would.
//
// The remedy is not "call the formula from the enemy too". It is to have exactly one place where
// an observer's alert meter is filled, so that a second model cannot drift into existence. That
// place is `fillFor()` below. It is called from:
//
//   * `sim/stealth/system.js` `stepPerception()`     — every entity in `sim.entities`, every frame
//   * `sim/stealth/system.js` `stepCivilians()`      — every civilian and guard, every frame
//   * `sim/crime/...` via `system.js` `deriveWitnesses()` — the witness predicate's `los` and `V`
//
// and by nothing else. `combat/enemy.js` no longer fills a meter; it reads the one this writes.
//
// UNITS. Every rate in this file is per SECOND. The single division by 60 happens in the caller
// (`stepAlert`), exactly as `detection.js` already documents. Seam S22: frame figures elsewhere
// in this piece carry `f@60`.
'use strict';

import * as DET from './detection.js';

export const HZ = 60;

/**
 * `RI-AI01` §B's hearing channel, verbatim: sprint 60/s, walk 40/s, crouch/sneak 25/s, and a
 * still character emits nothing at all. These are FLAT rates inside the sphere — RI-AI01 gives
 * one number per movement mode and no distance term — and `RI-STL01` §4 scales the sphere's
 * RADIUS rather than the rate, which is why `soundRadius()` lives in detection.js and this
 * table lives here.
 */
export const HEAR_RATE_PER_S = { sprint: 60, walk: 40, crouch_move: 25, still: 0 };

/** `RI-AI01` §B: "ignores LOS, walls attenuate x0.4". */
export const HEARING_WALL_ATTENUATION = 0.4;

/**
 * `RI-AI01` §B: the peripheral cone "cannot exceed `alert` 70 on its own". Enforced in
 * `stepAlert`, not here, because it is a property of the METER and not of the fill.
 */
export const PERIPHERAL_ALERT_CAP = 70;

/**
 * The LOS probe radius. A sight line that threads a 5 cm gap is not a sight line, and a zero
 * radius makes the conservative-advancement cast in `sim/collision.js` degenerate (it converges
 * on the surface without ever reaching it and then reports a grazing pass as a hit). 0.05 m is
 * the smallest radius at which the cast is well-conditioned against this build's cells.
 */
export const LOS_PROBE_R_M = 0.05;

/** Eye and chest node heights. `RI-CRM01` §2 and `RI-STL01` §2/§3 both name these two nodes. */
export const EYE_H_M = 1.55;
export const CHEST_H_M = 1.35;

// Module-scope scratch. The fixed step allocates nothing (RI-PLT01 P4).
const _a = [0, 0, 0];
const _b = [0, 0, 0];
const _ring = [0, 0, 0];

/**
 * Is the segment from `ax,ay,az` to `bx,by,bz` clear of static world geometry?
 *
 * THE CONSUMER OF THIS IS THE WHOLE POINT. Round 1 had no occlusion term of any kind:
 * `in_cover` was an authored boolean worth x0.80 and a wall between you and a pair of eyes
 * changed nothing. This casts against `sim.cell` — **the same static collision set the camera's
 * spring arm and the player's own body use** (`sim/collision.js`, `RI-CAM01` §C) — plus the
 * scenario-scratch occluder cell, so a wall that stops the camera stops sight.
 */
export function losClear(sim, ax, ay, az, bx, by, bz) {
  _a[0] = ax; _a[1] = ay; _a[2] = az;
  _b[0] = bx; _b[1] = by; _b[2] = bz;
  const cell = sim.cell;
  if (cell && cell.shapes.length && cell.sphereCast(_a, _b, LOS_PROBE_R_M) < 1) return false;
  const occ = sim.stealth && sim.stealth.occluders;
  if (occ && occ.shapes.length && occ.sphereCast(_a, _b, LOS_PROBE_R_M) < 1) return false;
  return true;
}

/** How many of the two collision sets the segment crosses. `RI-CRM01` §3a counts walls. */
export function wallsBetween(sim, ax, ay, az, bx, by, bz) {
  _a[0] = ax; _a[1] = ay; _a[2] = az;
  _b[0] = bx; _b[1] = by; _b[2] = bz;
  let n = 0;
  const cell = sim.cell;
  if (cell && cell.shapes.length && cell.sphereCast(_a, _b, LOS_PROBE_R_M) < 1) n++;
  const occ = sim.stealth && sim.stealth.occluders;
  if (occ && occ.shapes.length && occ.sphereCast(_a, _b, LOS_PROBE_R_M) < 1) n++;
  return n;
}

export function normaliseDeg(d) {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

/**
 * `RI-STL01` §2's `A` term, DERIVED from the world instead of authored.
 *
 * The item defines cover as "any collider between chest node and eye node for >= 60% of the
 * cone". The cone of *what* is not stated — the term is observer-independent in the formula, so
 * it cannot be one observer's cone. The reading implemented here, which is the only one that
 * makes `A` a single global number: **fire a horizontal ring of probes from the player's chest
 * node out to the sight radius of the archetype with the longest reach in the roster (20 m,
 * ELITE/DUELIST); you are in cover when >= 60% of them are stopped by geometry.** That is a
 * character wedged into an alcove, and it is not a character standing in the open.
 *
 * `RI-MTH07` §C3's hand-feed audit is why this exists: round 1 reached `A` = 0.80 only by a
 * critic passing `inCover: true`. It is now reachable by standing somewhere.
 */
export function deriveInCover(sim, px, py, pz, samples, radiusM) {
  const n = samples || 12;
  const r = radiusM || 20;
  const cy = py + CHEST_H_M;
  let blocked = 0;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    _ring[0] = px + Math.sin(th) * r;
    _ring[1] = py + EYE_H_M;
    _ring[2] = pz + Math.cos(th) * r;
    if (!losClear(sim, px, cy, pz, _ring[0], _ring[1], _ring[2])) blocked++;
  }
  return { in_cover: blocked / n >= 0.60, blocked, samples: n, fraction: blocked / n };
}

/**
 * ONE observer, ONE frame. Returns the per-second fill and the channel that produced it.
 *
 * `out` is a caller-owned object, mutated in place (RI-PLT01 P4). Fields:
 *   dist, bearing_deg, cone, los, sight_per_s, hear_per_s, per_s, channel
 *
 * `channel` is `RI-STL01`'s requested `alert_channel`, whose absence from the enemy record the
 * round-1 verdict called "its own answer": `"sight" | "peripheral" | "hearing" | "shout" |
 * "damage" | null`.
 *
 * THE CHANNELS DO NOT SUM. `RI-AI01` §B lists them as alternatives with their own rates and
 * asks the trace to name *which channel filled `alert` this frame*, which is only answerable if
 * one of them did. The frame's fill is therefore `max(sight, hearing)` and the channel is the
 * argmax. Summing would also make `RI-STL01` method 2's five worked times wrong by whatever the
 * hearing term happened to be.
 */
export function perceiveInto(out, data, sim, obs, q) {
  const dx = q.px - obs.x, dz = q.pz - obs.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const bearing = normaliseDeg(Math.atan2(dx, dz) * 180 / Math.PI - obs.yaw);
  const cone = DET.coneOf(data, bearing);

  // LOS is evaluated once and used by BOTH channels — by sight as a gate, by hearing as an
  // attenuation. It is the expensive term, so it is skipped when neither channel can fire.
  const inSight = cone !== 'none' && dist < obs.R;
  const hearR = q.soundR || 0;
  const inEar = hearR > 0 && dist <= hearR;
  const los = (inSight || inEar) ? losClear(sim, obs.x, obs.y + EYE_H_M, obs.z, q.px, q.py + CHEST_H_M, q.pz) : true;

  let sight = 0;
  if (inSight && los) sight = DET.baseFillPerSecond(data, { V: q.V, dist, R: obs.R, cone });
  let hear = 0;
  if (inEar) hear = (HEAR_RATE_PER_S[q.motion] || 0) * (los ? 1 : HEARING_WALL_ATTENUATION);

  out.dist = dist;
  out.bearing_deg = bearing;
  out.cone = cone;
  out.los = los;
  out.sight_per_s = sight;
  out.hear_per_s = hear;
  if (sight >= hear && sight > 0) { out.per_s = sight; out.channel = cone === 'peripheral' ? 'peripheral' : 'sight'; }
  else if (hear > 0) { out.per_s = hear; out.channel = 'hearing'; }
  else { out.per_s = 0; out.channel = null; }
  return out;
}

export function newPerceptOut() {
  return { dist: 0, bearing_deg: 0, cone: 'none', los: true, sight_per_s: 0, hear_per_s: 0, per_s: 0, channel: null };
}

/**
 * Advance an alert meter one frame. `RI-AI01` §B: fill from the frame's channel, decay at 12/s
 * when nothing is filling, floor 0, `SUSPICIOUS` at 50, `AGGRO` at 100, and the peripheral cone
 * cannot pass 70 on its own.
 *
 * Decay runs only on frames with no fill — the same rule `detection.js::stepCivilian` documents,
 * and for the same reason: `RI-STL01` §2's worked table gives 1.03 s at 97.5/s, which is
 * 100/97.5 exactly. Net-of-decay would be 100/(97.5-12) = 1.17 s and the item's table would be
 * unreproducible.
 *
 * @returns the alert value after the step.
 */
export function stepAlert(e, per, decayPerS, baseline) {
  const floor = baseline || 0;
  if (per.per_s > 0) {
    let cap = 100;
    if (per.channel === 'peripheral' && e.alert < PERIPHERAL_ALERT_CAP) cap = PERIPHERAL_ALERT_CAP;
    else if (per.channel === 'peripheral') cap = e.alert;      // already above the cap by sight
    e.alert = Math.min(cap, e.alert + per.per_s / HZ);
    e.alertChannel = per.channel;
  } else {
    e.alert = Math.max(floor, e.alert - decayPerS / HZ);
    e.alertChannel = null;
  }
  return e.alert;
}

/** An instant channel — `RI-AI01` §B's damage / impact / shout rows and `RI-STL01` §4's four. */
export function bumpAlert(e, amount, channel) {
  e.alert = Math.min(100, e.alert + amount);
  e.alertChannel = channel;
  return e.alert;
}
