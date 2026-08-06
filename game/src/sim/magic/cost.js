// RI-MAG02 §D — the cost formula, and nothing else.
//
// This file is the ONLY implementation of the price of a spell in the project. The game
// imports it; `tools/analysis/magic-audit.mjs` imports the same file rather than
// re-implementing §D, so a critic recomputing every shipped cost is recomputing it against
// the code the game actually runs. RI-MAG02 M2 asserts the shipped `focus_base` equals the
// recomputed value for 100% of spells; if that check ever passed against a second copy of the
// formula it would be proving nothing.
//
//   focus_base = ceil( weight × ( M^1.30 + 0.7×D^0.95 + 0.55×M^0.80×D^0.45 )
//                             × ( 1 + 0.09×A^1.25 )
//                             × range_mult / 10 )
//   focus_cost = ceil( focus_base × class_mult × catalyst_mult × (1 − skill_discount) )
//
// The cross term `0.55 × M^0.80 × D^0.45` is load-bearing (RI-MAG02 §D): without it the
// magnitude and duration axes separate and the community-optimal spell is a one-second nuke.
// `nukeBalanceRatio()` below is the assertion that guards it and it lives next to the formula
// so that deleting the term breaks a test in the same file.
//
// DETERMINISM: every function here is pure and integer-valued at its boundary. Nothing draws
// from the PRNG, reads a clock, or allocates per call. RI-MAG01 M5 asserts `rng.draws` is
// unchanged across a cast, and the reason it can be is that the cost of a spell is arithmetic.
'use strict';

export const RANGE_MULT = Object.freeze({
  self: 0.70, touch: 0.85, target: 1.00, projectile: 1.15, area_at_range: 1.25,
});

/** RI-MAG01 §B. `RITUAL` is 1.00: its price is its clock, not its multiplier. */
export const CLASS_MULT = Object.freeze({
  CANTRIP: 0.50, LIGHT: 1.00, HEAVY: 2.10, GREAT: 4.40, RITUAL: 1.00,
});

/** RI-MAG01 §B. Multiplicative, applied AFTER the RI-PRG03 §6 skill discount. */
export const CATALYST_MULT = Object.freeze({
  great_staff: 0.80, rod: 1.00, enchanted_weapon: 1.15, none: 1.35,
});

/** RI-MAG02 §D tier bands, keyed to `focus_base`; skill req is RI-PRG03 §6's ladder. */
export const TIER_BANDS = Object.freeze([
  { tier: 1, max: 12, skill_req: 0 },
  { tier: 2, max: 30, skill_req: 25 },
  { tier: 3, max: 65, skill_req: 45 },
  { tier: 4, max: 120, skill_req: 65 },
  { tier: 5, max: Infinity, skill_req: 85 },
]);

/**
 * RI-MAG02 §D, exactly. `M` magnitude points, `D` seconds (0 = instantaneous), `A` radius m.
 * @returns {number} integer `focus_base`
 */
export function focusBase(weight, M, D, A, range) {
  const rm = RANGE_MULT[range];
  if (rm === undefined) throw new Error(`focusBase: unknown range '${range}'. Legal: ${Object.keys(RANGE_MULT).join(', ')}`);
  const m = Math.max(0, M), d = Math.max(0, D), a = Math.max(0, A);
  const core = Math.pow(m, 1.30) + 0.7 * Math.pow(d, 0.95) + 0.55 * Math.pow(m, 0.80) * Math.pow(d, 0.45);
  return Math.ceil(weight * core * (1 + 0.09 * Math.pow(a, 1.25)) * rm / 10);
}

/** A spell is a SET of effects; each pays its own base, and the set shares one range. */
export function spellFocusBase(effectTerms, effectsById, range) {
  let sum = 0;
  for (const t of effectTerms) {
    const e = effectsById[t.effect];
    if (!e) throw new Error(`spellFocusBase: no effect '${t.effect}' in the catalogue`);
    sum += focusBase(e.weight, t.magnitude, t.duration_s || 0, t.area_r_m || 0, range);
  }
  return sum;
}

/** RI-PRG03 §6 verbatim: 0.5%/point over the tier requirement, clamped to [0, 0.35]. */
export function skillDiscount(skill, tierReq) {
  return Math.min(0.35, Math.max(0, 0.005 * (skill - tierReq)));
}

/** The number actually deducted from the reservoir on frame 1 of the cast. */
export function focusCost(base, weightClass, catalyst, skill, tierReq) {
  const cm = CLASS_MULT[weightClass];
  if (cm === undefined) throw new Error(`focusCost: unknown class '${weightClass}'`);
  const km = CATALYST_MULT[catalyst];
  if (km === undefined) throw new Error(`focusCost: unknown catalyst '${catalyst}'`);
  return Math.ceil(base * cm * km * (1 - skillDiscount(skill, tierReq)));
}

export function tierFor(base) {
  for (const b of TIER_BANDS) if (base <= b.max) return b.tier;
  return 5;
}
export function skillReqFor(base) {
  for (const b of TIER_BANDS) if (base <= b.max) return b.skill_req;
  return 85;
}

/**
 * RI-MAG02 §D's gold price, fitted to RI-PRG05 §2's published 220/900/3,400 at base 10/22/48.
 * The four S7/S19 teleport spells are priced by `min_tier` instead (RI-MAG02 §D amendment,
 * queue B11) because their magnitude is either nil (`mark`) or a function of where the customer
 * is standing (`recall`), and a price that moves when the customer walks is not a price.
 */
export const TELEPORT_TIER_PRICE = Object.freeze({ 2: 900, 3: 3400 });
export const TELEPORT_SPELLS = Object.freeze(['mark', 'recall', 'intervention_root', 'intervention_imperial']);

export function goldPrice(base, spellId, minTier) {
  if (spellId && TELEPORT_SPELLS.includes(spellId)) {
    const p = TELEPORT_TIER_PRICE[minTier];
    if (p === undefined) throw new Error(`goldPrice: teleport spell '${spellId}' declares min_tier ${minTier}, which has no published price`);
    return p;
  }
  return Math.round(3.9 * Math.pow(base, 1.75));
}

/** RI-MAG03 §A: the spellwright's markup. Making is always dearer than buying. */
export function commissionPrice(base, spellId, minTier) {
  return Math.round(1.6 * goldPrice(base, spellId, minTier)) + 150;
}

/**
 * The cross-term guard, RI-MAG02 M2. `fire_damage` weight 1.5, projectile.
 * Balanced M30/D30 = 25, nuke M100/D1 = 73, long-and-weak M1/D100 = 11.
 * Assert `nuke / balanced ∈ [2.6, 3.2]`; below 2.0 the term has been removed.
 */
export function nukeBalanceRatio(weight = 1.5, range = 'projectile') {
  const balanced = focusBase(weight, 30, 30, 0, range);
  const nuke = focusBase(weight, 100, 1, 0, range);
  const weak = focusBase(weight, 1, 100, 0, range);
  return { balanced, nuke, weak, ratio: nuke / balanced };
}

// ---- RI-MAG01 §A — the reservoir ------------------------------------------------------------
// Focus NEVER regenerates. There is no `restoreFocus` function in this project and this comment
// is where a future author looking for one finds out why: RI-MAG01 M3 asserts `focus` is
// monotonically non-increasing outside a HEARTH rest or a respawn, and every bound in
// RI-MAG02 §F2 (levitation altitude) and §G (recall range) is denominated in it.

/** RI-MAG01 §A's WILLPOWER curve. Sampled: 10→30, 15→46, 20→62, 30→94, 40→103, 50→112, 99→124. */
export function focusMaxFor(wil) {
  const w = Math.max(1, Math.min(99, wil | 0));
  let f = 30;
  if (w <= 10) return 30;
  f += 3.2 * Math.min(w, 30) - 32;
  if (w > 30) f += 0.9 * (Math.min(w, 50) - 30);
  if (w > 50) f += 0.25 * (w - 50);
  return Math.round(f);
}

/** RI-PRG02 §3 via RI-MAG01 §A: base 2, +1 at WIL 15/25/35/50, max 6. */
export function spellSlotsFor(wil) {
  let n = 2;
  for (const t of [15, 25, 35, 50]) if (wil >= t) n++;
  return n;
}
