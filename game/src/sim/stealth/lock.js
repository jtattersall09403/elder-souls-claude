// The ward-collar — RI-STL02 §3, seam S21.
//
// THE RULING THIS FILE EXISTS TO ENFORCE: no probability roll, no hidden die, no retry loop
// that converges on success. A 12%-per-attempt lock is a 100% chance of opening after eight
// attempts, so it gates nothing; the gate lives in the skill (Morrowind) and the uncertainty
// lives in the player's hands (Souls).
//
// This module imports NO RNG. That is the enforcement RI-STL02 method 3 asks for — it asserts
// `rng.draws` does not move across a whole lock interaction, which catches all three ways the
// die comes back through a side door at once: a critical-failure chance on the pick, a Luck
// term on breakage, and "a small random jitter on the collar rate so it doesn't feel robotic".
//
// It is also not a button. RI-STL02 "How we lose": *"The path of least resistance is
// `if (security >= req) open()`, which is deterministic, passes method 3 perfectly, and turns
// the most-used verb in the thief build into a keypress."* The collar below rotates at a
// constant 90 deg/s and the player presses `interact` inside a window whose WIDTH is the skill.
'use strict';

export const HZ = 60;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function tierOf(data, tier) {
  const t = data.tiers.find((x) => x.tier === tier);
  if (!t) throw new Error(`tierOf: no lock tier ${JSON.stringify(tier)}`);
  return t;
}

/** RI-PRG03's deterministic gate. Absolute: below EITHER requirement, nothing is offered. */
export function gate(data, tier, { security, agility }) {
  const t = tierOf(data, tier);
  if (security < t.security_req || agility < t.agility_req) {
    return {
      offered: false,
      prompt: data.ward_collar.below_requirement.prompt,
      picks_consumed: 0,
      shortfall: { security: Math.max(0, t.security_req - security), agility: Math.max(0, t.agility_req - agility) },
    };
  }
  return { offered: true, prompt: null, picks_consumed: 0, shortfall: null };
}

/** W = clamp( 4 + 0.55 * (Security - req_tier), 4, 34 ) degrees. RI-STL02 §3c. */
export function tolerance(data, tier, security) {
  const t = tierOf(data, tier);
  const w = data.ward_collar;
  return clamp(w.tolerance_min_deg + w.tolerance_slope * (security - t.security_req), w.tolerance_min_deg, w.tolerance_max_deg);
}

/** The window in f@60 the player has to press. Seam S22: the unit is stated, always. */
export function windowFrames(data, tier, security) {
  return tolerance(data, tier, security) / data.ward_collar.collar_rate_deg_per_s * HZ;
}

/**
 * A live lock interaction. Rotation is automatic and constant; `press()` is the only input.
 *
 * `ward_angles` come from the interior data, authored per lock instance. They are NEVER
 * generated at runtime — a generated angle is a die by another name (RI-STL02 method 5's
 * chi-square assertion exists for exactly this).
 */
export class LockAttempt {
  constructor(data, lockRecord, { security, agility, picks, startFrame = 0 }) {
    const t = tierOf(data, lockRecord.tier);
    const g = gate(data, lockRecord.tier, { security, agility });
    if (!g.offered) throw new Error(`LockAttempt: ${g.prompt} (tier ${lockRecord.tier} needs Security ${t.security_req} / Agility ${t.agility_req}; you have ${security}/${agility})`);
    if (lockRecord.ward_angles.length !== t.wards) {
      throw new Error(`LockAttempt: lock ${lockRecord.id} is tier ${lockRecord.tier} (${t.wards} wards) but carries ${lockRecord.ward_angles.length} authored angles`);
    }
    this.data = data;
    this.lock = lockRecord;
    this.tierRow = t;
    this.security = security;
    this.W = tolerance(data, lockRecord.tier, security);
    this.picks = picks;
    this.picksConsumedAtStart = t.picks_per_attempt;
    this.collarDeg = 0;
    this.startFrame = startFrame;
    this.frame = startFrame;
    this.set = 0;                      // wards set so far
    this.sweeps = 0;                   // sweeps used on the CURRENT ward
    this.broken = 0;                   // picks broken this attempt
    this.open = false;
    this.failed = false;
    this.events = [];
  }

  get currentWardAngle() { return this.lock.ward_angles[this.set]; }

  /** True while the deterministic audio/visual tell is playing — 0.25 s (22.5 deg) before centre. */
  get tellActive() {
    const lead = this.data.ward_collar.tell.lead_deg;
    const d = angleDelta(this.collarDeg, this.currentWardAngle);
    return d <= 0 && d >= -lead;
  }

  /** One fixed step of collar rotation. Constant rate, never randomised. */
  step() {
    if (this.open || this.failed) return;
    const before = this.collarDeg;
    this.collarDeg = (this.collarDeg + this.data.ward_collar.collar_rate_deg_per_s / HZ) % 360;
    // A sweep completes when the collar wraps past the current ward angle.
    if (passed(before, this.collarDeg, this.currentWardAngle)) {
      this.sweeps++;
      if (this.sweeps >= this.data.ward_collar.sweeps_per_ward) {
        this.failed = true;
        this.events.push({ type: 'lock_attempt', result: 'out_of_sweeps', ward: this.set, frame: this.frame });
      }
    }
    this.frame++;
  }

  /** The press. Deterministic: inside W the ward sets, outside it a pick breaks. */
  press() {
    if (this.open || this.failed) return { result: 'inert' };
    const d = Math.abs(angleDelta(this.collarDeg, this.currentWardAngle));
    if (d <= this.W / 2) {
      this.set++;
      this.sweeps = 0;
      const ev = { type: 'lock_ward_set', ward: this.set, of: this.tierRow.wards, frame: this.frame, delta_deg: round4(d) };
      this.events.push(ev);
      if (this.set >= this.tierRow.wards) {
        this.open = true;
        this.events.push({ type: 'lock_open', lock: this.lock.id, tier: this.lock.tier, frame: this.frame });
      }
      return { result: 'ward_set', set: this.set, of: this.tierRow.wards, open: this.open, delta_deg: round4(d) };
    }
    this.broken++;
    this.picks--;
    this.sweeps = 0;
    const snd = this.data.ward_collar.press_outside_W;
    this.events.push({ type: 'pick_break', lock: this.lock.id, frame: this.frame, sound_r_m: snd.sound_radius_m, alert: snd.alert, delta_deg: round4(d) });
    if (this.picks <= 0) {
      this.failed = true;
      this.events.push({ type: 'lock_attempt', result: 'out_of_picks', frame: this.frame });
    }
    return { result: 'pick_break', picks_left: this.picks, sound_r_m: snd.sound_radius_m, alert: snd.alert, delta_deg: round4(d) };
  }

  /** The `player.lock` block RI-STL02's Comparison method asks the trace to carry. */
  block() {
    return {
      tier: this.lock.tier,
      wards: this.tierRow.wards,
      set: this.set,
      collar_deg: round4(this.collarDeg),
      ward_deg: this.open ? null : this.currentWardAngle,
      delta_deg: this.open ? null : round4(angleDelta(this.collarDeg, this.currentWardAngle)),
      tell: this.open ? false : this.tellActive,
      W_deg: round4(this.W),
      sweeps: this.sweeps,
      picks: this.picks,
      broken: this.broken,
      open: this.open,
      failed: this.failed,
    };
  }
}

/** Signed shortest angular delta from `a` to `b`, in (-180, 180]. */
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function passed(before, after, target) {
  // Handles the 359 -> 1 wrap.
  if (after >= before) return target > before && target <= after;
  return target > before || target <= after;
}

function round4(v) { return Math.round(v * 1e4) / 1e4; }

/**
 * The Unbind spell (RI-STL02 §3d). Deterministic, no roll, no interaction, costs Focus, and
 * strictly more expensive per door than picking. It is the alternate route for characters who
 * invested elsewhere — not a solvent, which is why the four quest-variant tier-5 locks refuse it.
 */
export function unbind(data, lockRecord, sorceryTier) {
  const u = data.unbind_spell;
  if (lockRecord.quest_variant) return { ok: false, reason: 'this lock answers to a key, not a spell (S19: a spell that opens everything is a level-design solvent)' };
  const need = u.tiers[String(lockRecord.tier)];
  if (need === undefined) return { ok: false, reason: `Unbind does not reach tier ${lockRecord.tier}` };
  if (sorceryTier < need) return { ok: false, reason: `Unbind ${need} required; you have ${sorceryTier}` };
  return { ok: true, deterministic: true, draws: 0 };
}
