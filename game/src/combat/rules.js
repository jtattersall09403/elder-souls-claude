// The arithmetic of the fight: stamina, blocking, guard break, poise, hyperarmour, exhaustion.
//
// Every function here is pure and takes its constants from the data files. The reason is
// RI-CMB03 M2 and M4: the checks that catch a per-action cooldown pretending to be a global
// re-armed delay, and a shield whose stability has leaked into its damage reduction, are only
// meaningful if there is exactly one implementation of each formula. There is.
'use strict';

// ---- stamina (RI-CMB03 §A/§B, ES-STAM/1) --------------------------------------------------

/**
 * Spend, on the FIRST frame of an action, in full. RI-CMB03 M3 fails a deduction spread
 * across frames, and RI-CMB02 §D.6 fails a partially-executed action.
 *
 * The gate is `stamina >= cost`, which is OURS and not Souls' — see stamina.json
 * §regen.floor_provenance and orchestrator ruling R4. DS3 gates on `stamina > 0` and lets the
 * bar go to -60. We drop the input instead, because a dropped input is a discrete assertable
 * event in a trace and a debt is not.
 */
export function canAfford(actor, cost) { return actor.stamina >= cost; }

export function spendStamina(actor, cost, frame, delayFrames) {
  actor.stamina = Math.max(0, actor.stamina - cost);
  actor.regenBlockUntil = frame + delayFrames;      // re-armed by EVERY spend — RI-CMB03 M2
  return actor.stamina;
}

/**
 * One frame of regeneration. Multipliers stack multiplicatively (RI-CMB03 §A).
 * Returns the amount actually added, so the caller can assert the slope.
 */
export function regenStamina(actor, frame, C, ctx) {
  if (frame < actor.regenBlockUntil) return 0;
  if (actor.stamina >= actor.staminaMax) return 0;
  let rate = C.regen.per_frame;
  if (ctx.guardRaised) rate *= C.regen.multipliers.guard_raised;
  if (ctx.tier === 'OVERLOADED') rate *= C.regen.multipliers.overloaded;
  else if (ctx.tier === 'HEAVY') rate *= C.regen.multipliers.equip_load_over_70pct;
  if (ctx.hitstun) rate *= C.regen.multipliers.staggered_or_guard_broken;
  if (rate <= 0) return 0;
  const before = actor.stamina;
  actor.stamina = Math.min(actor.staminaMax, actor.stamina + rate);
  return actor.stamina - before;
}

/** Max stamina from Endurance — RI-CMB03 §A's piecewise curve. */
export function staminaMaxFor(endurance, C) {
  const p = C.pool;
  if (endurance <= 10) return p.base_max_at_endurance_10;
  if (endurance <= 40) return p.base_max_at_endurance_10 + (endurance - 10) * p.per_endurance_11_to_40;
  return p.base_max_at_endurance_10 + 30 * p.per_endurance_11_to_40 + (endurance - 40) * p.per_endurance_41_to_99;
}

// ---- blocking and guard break (RI-CMB03 §C/§D) ---------------------------------------------

/**
 * The block formula, spelled out exactly as RI-CMB03 §C spells it out. `stability` touches
 * ONLY the stamina cost and `absorption` touches ONLY the damage; RI-CMB03 M4 fails a build
 * where either crosses over, because conflating them turns the shield into passive armour and
 * deletes guard break entirely (How we lose #4).
 */
export function resolveBlock(defender, incomingDamage, shield) {
  const staminaCost = incomingDamage * (1 - shield.stability);
  const chip = incomingDamage * (1 - shield.absorption);
  const staminaBefore = defender.stamina;
  const guardBroken = (staminaBefore - staminaCost) <= 0;
  return {
    stamina_cost: staminaCost,
    chip,
    stamina_before: staminaBefore,
    stamina_after: Math.max(0, staminaBefore - staminaCost),
    poise_damage_taken: 0,
    guard_broken: guardBroken,
  };
}

/** RI-CMB04 §E rule 2: a 60-degree HALF-cone from the defender's forward. */
export function withinBlockCone(defenderYawDeg, incomingBearingDeg, halfConeDeg) {
  let d = (incomingBearingDeg - defenderYawDeg) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d) <= halfConeDeg;
}

// ---- poise (RI-CMB05 §A/§B/§C, ES-POISE/1) ---------------------------------------------------

export function poiseResist(armourPoise, C) {
  return Math.min(C.pool.poise_resist_cap, Math.max(0, armourPoise / 120));
}

export function poiseHealthMax(armourPoise, C) {
  return C.pool.player_base_poise_health_naked + armourPoise;
}

/**
 * Apply poise damage. Returns {staggered, tier, frames, applied}.
 *
 * `hyperArmourPool` is non-null only inside a declared hyperarmour window (RI-CMB05 §C.1):
 * incoming poise damage depletes THAT pool, not the normal one, and the pool refills the
 * instant the window ends — it is not a shared budget across the animation's life.
 */
export function applyPoiseDamage(actor, poiseDamage, C, opts) {
  const resist = poiseResist(actor.armourPoise, C);
  let effective = poiseDamage * (1 - resist);
  if (opts && opts.exhausted) effective /= 0.5;   // exhaustion halves poise -> doubles effect
  const inHA = opts && opts.hyperArmour;
  if (inHA) {
    actor.haPool -= effective;
    if (actor.haPool > 0) return { staggered: false, tier: null, frames: 0, applied: effective, hyperarmour: true };
    // The HA pool broke. RI-CMB05 §C.2: hyperarmour prevents stagger, it does not prevent
    // damage — and a BROKEN hyperarmour pool staggers you like anything else.
  }
  actor.poiseHealth -= effective;
  actor.poiseRegenBlockUntil = opts && opts.frame !== undefined ? opts.frame + C.pool.regen_delay_f : 0;
  if (actor.poiseHealth > 0) return { staggered: false, tier: null, frames: 0, applied: effective, hyperarmour: !!inHA };
  const tier = staggerTierFor(poiseDamage, C);
  return { staggered: true, tier: tier.tier, frames: tier.frames, applied: effective, hyperarmour: !!inHA, tierDef: tier };
}

/** RI-CMB05 §B: stagger length is a function of the POISE DAMAGE OF THE BLOW THAT BROKE THE
 *  POOL, not of the damage dealt. A dagger that breaks poise staggers briefly; a UGS flattens. */
export function staggerTierFor(poiseDamage, C) {
  for (const t of C.stagger.tiers) {
    if (poiseDamage >= t.poise_damage[0] && poiseDamage <= t.poise_damage[1]) return t;
  }
  return C.stagger.tiers[C.stagger.tiers.length - 1];
}

export function regenPoise(actor, frame, C) {
  if (frame < actor.poiseRegenBlockUntil) return 0;
  if (actor.poiseHealth >= actor.poiseHealthMax) return 0;
  const before = actor.poiseHealth;
  actor.poiseHealth = Math.min(actor.poiseHealthMax, actor.poiseHealth + C.pool.regen_per_second / 60);
  return actor.poiseHealth - before;
}

/** Is `animFrame` inside the move's declared hyperarmour window? RI-CMB05 §C.4. */
export function inHyperArmour(move, animFrame) {
  const w = move && move.hyperarmour_window;
  return !!w && animFrame >= w[0] && animFrame <= w[1];
}

// ---- exhaustion (RI-CMB09 §4, ES-EXHAUST/1) ------------------------------------------------

/**
 * Entry is stamina EXACTLY zero — "not a threshold; you have to actually spend it all".
 * Exit is a hysteresis at 30% of max so the state does not flicker at 1 stamina.
 * Returns 'enter' | 'exit' | null.
 */
export function updateExhaustion(actor, C) {
  const ex = C.exhaustion;
  if (!actor.exhausted && actor.stamina === 0) { actor.exhausted = true; return 'enter'; }
  if (actor.exhausted && actor.stamina >= ex.exit_at_fraction_of_max * actor.staminaMax) {
    actor.exhausted = false; return 'exit';
  }
  return null;
}

// ---- damage (RI-CMB04 §E rule 5) ---------------------------------------------------------------

/**
 * damage = motion_value * weapon_ar * hurtbox.damage_mult * (1 - target.absorption[type])
 *
 * Deterministic, by construction. No range, no variance, no crit chance. RI-CMB04 §E's
 * corollary table deletes all three by name and each is independently an automatic fail.
 */
export function computeDamage(motionValue, weaponAR, hurtboxMult, targetAbsorption) {
  return motionValue * weaponAR * hurtboxMult * (1 - (targetAbsorption || 0));
}
