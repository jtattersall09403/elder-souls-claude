// Pickpocketing — RI-STL02 §5 as RECONCILED to ARBITRATION seam S21.
//
// THE CONFLICT, stated once, in the file that resolves it:
//
//   RI-STL02 §5 opens "Same ruling, same reasons: **no roll**", and its method 7 asserts
//   "100 identical scripted pickpockets at 100 seeds: assert 100/100 identical."
//
//   ARBITRATION §2 seam S21, as amended by intent audit 02 (ND-01), says the opposite and says
//   it by name: "this ruling named three surviving dice and the corpus then deleted two of them
//   — RI-STL02's pickpocket check and RI-MAG03's blanket 'no dice anywhere' ... **Pickpocketing
//   keeps its roll (getting caught is permanent and consequential)** ... RI-STL02 and RI-MAG03
//   must be reconciled to this."
//
// ARBITRATION §5's precedence order puts the seam rulings (rung 2) above "the specific reference
// item's stated comparison method" (rung 3), and S21 names RI-STL02 as the item to be
// reconciled rather than the other way round. So the die is built.
//
// THE SHAPE OF THE RECONCILIATION, which is the part that matters: everything RI-STL02 §5
// specifies *deterministically* stays deterministic — eligibility geometry, the slot count, the
// weight ceiling, the hold duration T, the suspicion fill during T, and the caught-by-CHALLENGE
// path. Exactly ONE draw is taken, once, on the completion frame, and it decides only whether
// the target felt the hand. Every geometry gate in method 7 still fires and is still assertable
// at 100/100. What changed is that the outcome varies across SEEDS, which is what a die is.
'use strict';

export const HZ = 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** RI-STL02 §5's eligibility. Fully deterministic — this is the half S21 did not touch. */
export function eligibility(data, q) {
  const p = data.pickpocket;
  const fails = [];
  if (q.targetCivState !== 'CALM') fails.push(`target civ_state is ${q.targetCivState}, not CALM`);
  if (!q.crouched) fails.push('you are not crouched');
  if (q.dist > p.range_m) fails.push(`${q.dist.toFixed(2)} m exceeds the ${p.range_m} m reach`);
  if (Math.abs(normalise(q.bearingDeg)) <= p.rear_arc_deg) fails.push(`bearing ${normalise(q.bearingDeg).toFixed(1)} deg is not inside the >±${p.rear_arc_deg} deg rear arc`);
  if (q.moving) fails.push('you are moving');
  return { offered: fails.length === 0, refusals: fails };
}

export function slotCount(data, agility) {
  const p = data.pickpocket;
  return clamp(1 + Math.floor((agility - 10) / 8), p.slot_min, p.slot_max);
}

export function weightCeilingKg(data, sneak) {
  return 0.5 + 0.25 * Math.max(0, sneak - 20);
}

/** T = 2.60 - 0.014 * Sneak seconds, floored at 0.90 s. */
export function holdSeconds(data, sneak) {
  return Math.max(data.pickpocket.hold_floor_s, 2.60 - 0.014 * sneak);
}

/** The same number in f@60 — seam S22 requires the unit to be stated, so both are exported. */
export function holdFrames(data, sneak) { return Math.round(holdSeconds(data, sneak) * HZ); }

/**
 * The visible inventory — what an NPC is CARRYING, not their whole sheet, and never anything
 * equipped. RI-STL02 §5: "the alternative is a game where the answer to every Legion patrol is
 * to undress it."
 */
export function offeredSlots(data, npc, { agility, sneak }) {
  const n = slotCount(data, agility);
  const ceil = weightCeilingKg(data, sneak);
  return (npc.carried || [])
    .filter((it) => !it.equipped && it.weight_kg <= ceil)
    .slice(0, n);
}

/**
 * THE DIE — the one draw in this module, taken once, on the completion frame.
 * `draw` is a function returning a uniform [0,1) from the simulation's seeded PRNG.
 */
export function noticeChance(data, { contextWeight, V, sneak, raceSuspicion }) {
  const d = data.pickpocket.the_die;
  const T = holdSeconds(data, sneak);
  const cwTerm = contextWeight / 1.60;
  const vTerm = clamp(V / 0.30, 0.35, 2.0);
  const tTerm = T / 2.60;
  const sTerm = Math.max(0.40, 1 - 0.006 * sneak);
  return clamp(d.base * cwTerm * vTerm * tTerm * raceSuspicion * sTerm, d.clamp[0], d.clamp[1]);
}

/**
 * Resolve a completed hold. Returns the outcome and the number of draws taken (exactly 1),
 * so a critic can assert the RNG counter moved by one and only one.
 */
export function resolve(data, q, draw) {
  const p = noticeChance(data, q);
  const roll = draw();
  const caught = roll < p;
  return {
    caught,
    notice_chance: round6(p),
    roll: round6(roll),
    draws: 1,
    crime: caught ? 'pickpocket_caught' : null,
    stolen_from: caught ? null : q.ownerId,
    disposition_delta: caught ? -25 : 0,
    disposition_gmst: caught ? 'fDispPickPocketMod' : null,
  };
}

/**
 * A live hold. The player holds `interact`; releasing early costs nothing at all, which is what
 * makes this a "held-breath commitment window" rather than a gamble you are forced to finish.
 */
export class PickpocketAttempt {
  constructor(data, q) {
    const e = eligibility(data, q);
    if (!e.offered) throw new Error(`pickpocket not offered: ${e.refusals.join('; ')}`);
    this.data = data;
    this.q = q;
    this.needFrames = holdFrames(data, q.sneak);
    this.heldFrames = 0;
    this.done = false;
    this.aborted = false;
  }

  /** One fixed step of the hold. `suspicionPerSecond` is the target's base fill this frame. */
  step(suspicionPerSecond) {
    if (this.done || this.aborted) return null;
    this.heldFrames++;
    // §5: "During T the target's suspicion fills at 3x contextWeight."
    return suspicionPerSecond * this.data.pickpocket.suspicion_multiplier_during_T;
  }

  release() { if (!this.done) this.aborted = true; return { taken: null, crime: null, lost: null }; }

  get complete() { return this.heldFrames >= this.needFrames; }
}

function normalise(d) {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
function round6(v) { return Math.round(v * 1e6) / 1e6; }
