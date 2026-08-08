// The witness predicate and the report chain — RI-CRM01 §2 and §3.
//
// The gap between "somebody saw you" and "a guard heard about it" is where the entire system's
// texture lives: the fleeing witness you can chase, bribe, talk down, or kill. Everything below
// exists to keep that gap OPEN and legible, in frames, rather than collapsing it into a += .
'use strict';

export const HZ = 60;

/** RI-CRM01 §2. All five clauses, plus the two special cases. Pure. */
export function isWitness(data, npc, ctx) {
  const w = data.witness;
  if (!npc.alive) return { witness: false, why: 'dead' };
  const isGuard = npc.group === 'guard';
  const vMin = isGuard ? w.guard_V_min : w.V_min;
  if (!(npc.advancedToChallengeOrAlarmThisFrame || isGuard)) return { witness: false, why: 'did not advance to CHALLENGE or ALARM on the crime frame' };
  if (!ctx.los) return { witness: false, why: 'no line of sight' };
  if (ctx.V < vMin) return { witness: false, why: `V ${ctx.V.toFixed(3)} below ${vMin}` };
  if (ctx.dist > w.R_multiplier * npc.R) return { witness: false, why: `${ctx.dist.toFixed(1)} m beyond ${w.R_multiplier} x R (${(w.R_multiplier * npc.R).toFixed(1)} m)` };
  return { witness: true, identified: ctx.V >= w.identified_at_V, kind: 'sight' };
}

/** A partial witness: heard a death within 20 m, saw nothing. Cannot name you. */
export function isHearingWitness(data, npc, { distToDeath }) {
  const h = data.witness.hearing_only;
  if (!npc.alive) return { witness: false };
  if (distToDeath > h.radius_m) return { witness: false };
  return { witness: true, identified: false, kind: 'hearing' };
}

export const NEVER_WITNESS = new Set(['animal', 'mount', 'hostile_enemy', 'corpse']);

/**
 * Which report route this witness takes, and how long it will take. RI-CRM01 §3a.
 * Returns {route, latency_f, guard} — latency in f@60, seam S22.
 */
export function reportRoute(data, witnessNpc, { nearestGuardDist, nearestGuardWallsBetween, guardIsWitness, jurisdiction }) {
  const rc = data.report_chain;
  if (jurisdiction === 'interior') return { route: 'never', latency_f: null, why: 'the interior has no one to report to' };
  if (guardIsWitness) return { route: 'guard_witness', latency_f: 0 };
  const shout = rc.routes.find((r) => r.id === 'shout');
  if (nearestGuardDist !== null && nearestGuardDist <= shout.guard_range_m && (nearestGuardWallsBetween || 0) <= 1) {
    return { route: 'shout', latency_f: Math.round(shout.latency_s * HZ) };
  }
  const run = rc.routes.find((r) => r.id === 'run_to_guard');
  if (nearestGuardDist !== null && nearestGuardDist <= run.guard_range_m) {
    return { route: 'run_to_guard', latency_f: Math.round(nearestGuardDist / run.run_speed_mps * HZ), path_m: nearestGuardDist };
  }
  const del = rc.routes.find((r) => r.id === 'delayed');
  return { route: 'delayed', latency_f: null, max_hours: del.max_hours, why: 'no guard within 400 m; reports at their next contact with a guard' };
}

/**
 * A witness in flight. While `reported == false` they stop their schedule, face you or the
 * nearest exit, and RUN — "legible from across a street, and that legibility is what makes the
 * next thirty seconds a decision."
 */
export class PendingReport {
  constructor(data, { witnessRec, route, startFrame }) {
    this.data = data;
    this.w = witnessRec;
    this.route = route;
    this.startFrame = startFrame;
    this.landsAtF = route.latency_f === null ? null : startFrame + route.latency_f;
    this.state = 'fleeing';
    this.resolvedBy = null;
  }

  due(frame) { return this.state === 'fleeing' && this.landsAtF !== null && frame >= this.landsAtF; }

  /** The four legitimate responses (RI-CRM01 §3b). */
  bribe(gold, frame) {
    const need = this.bribeCost();
    if (gold < need) return { ok: false, need, short: need - gold };
    this.state = 'resolved'; this.resolvedBy = 'bribe'; this.w.reported = true;
    return { ok: true, paid: need, frame };
  }

  bribeCost() {
    const r = this.data.report_chain.responses.find((x) => x.id === 'bribe');
    return Math.round(this.quote * r.multiplier);
  }

  /**
   * The talk-down keeps its die under S21 — persuasion's failure is permanent (disposition is
   * lost and it is retryable only once per witness). This module does not own the persuasion
   * roll; it takes the result from RI-DLG04's system and applies the consequence.
   */
  talkDown(succeeded, frame) {
    if (succeeded) { this.state = 'resolved'; this.resolvedBy = 'talk_down'; this.w.reported = true; this.w.knows_something = (this.w.knows_something || 0) + 1; }
    else { this.w.talkdown_spent = true; }
    return { ok: succeeded, frame, retryable: false };
  }
}
