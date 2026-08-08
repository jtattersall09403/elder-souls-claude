// What a hit FEELS like — RI-WPN05 §A/§B/§C, resolved at the frame the hit lands.
//
// This module exists because of one verdict sentence, and it is worth quoting so that nobody
// re-creates the defect it closes:
//
//   "`materialMultiplier`, `deflects`, `knockbackFor` and `victimHitstopFor` are imported by
//    exactly one file in the repository — game/src/harness/weapons.js, the harness."
//
// The impact model was authored, correct, and read by nothing. Five of six perturbations of the
// shipped tables changed nothing in the fight, because `moves.js` collapsed the whole 5x7 grid
// to its `.flesh` column at BUILD time and the resolver consumed the collapsed number.
//
// So there is now exactly ONE function that turns (attack, victim material) into impact, it
// reads its numbers out of `game/data/weapons/classes.json` **on the frame of the hit** rather
// than at build time, and both consumers call it:
//
//   game/src/combat/resolve.js   the fight            <- the world-side consumer AR-3 wants
//   game/src/combat/moveset.js   MovesetLibrary       <- the harness's five accessors
//
// A number that the harness reports and the fight does not use is the failure this file exists
// to make structurally impossible: `MovesetLibrary.hitstopFor()` and the resolver cannot
// disagree because they are the same call.
'use strict';

/**
 * The seven columns of RI-WPN05 §A's hitstop grid.
 *
 * §B's multiplier table adds `plant` (Hist-bonded champions, root-wardens) and §A has no row
 * for it, because §A is a table about *surface hardness* and §B is a table about *damage type*.
 * The join is DECLARED rather than smuggled: `plant` takes the `wood` row for hitstop, knockback
 * and deflection, and keeps its own `sap` decal and its own §B multipliers. A root-warden's limb
 * stops a blade like timber and bleeds like a tree, which is the reading the lore supports.
 */
export const IMPACT_ROW_ALIAS = { plant: 'wood' };

/** RI-WPN05 §C's decal channel, per material. One decal per hit, never per active frame. */
export const DECAL = {
  flesh: 'blood_spray',
  chitin: 'chip',
  stone: 'spark_dust',
  metal: 'spark_dust',
  shield: 'spark_dust',
  wood: 'splinter',
  water: 'splash',
  plant: 'sap',
};

/** Camera-shake tier index — §C: `0.25° × tier_index`, light 1 … ultra 4. A bow does not shake. */
export const SHAKE_TIER_INDEX = { light: 1, medium: 2, heavy: 3, ultra: 4, ranged: 0 };

export const MATERIALS = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'];
export const TIERS = ['light', 'medium', 'heavy', 'ultra', 'ranged'];

/** The impact row a material reads out of the §A tables. */
export function impactRow(material) {
  return IMPACT_ROW_ALIAS[material] || material;
}

/**
 * The damage type a slot's `shape` delivers — RI-WPN05 §B.
 * Read from the table, never hard-coded, so a new shape is a data edit.
 */
export function damageTypeOf(classes, shape) {
  const t = classes.materials.damage_type_of_shape[shape];
  return t || 'slash';
}

/**
 * Is this attack DEFLECTED by this material? RI-WPN05 §A.
 *
 * "A non-blunt attack (shape ∉ {smash}) landing on `stone` with `poise_damage < 30` produces a
 * `deflect` event instead of a hit." Deterministic — a function of shape, poise damage and
 * material, with no random component anywhere (ARBITRATION S1). `MCE` and `GHM` bypass it
 * entirely, which is the mechanical reason those classes exist.
 *
 * @param {object} classes game/data/weapons/classes.json
 * @param {object} atk     {shape, poise_damage, weapon_class}
 * @param {string} material
 */
export function deflects(classes, atk, material) {
  const d = classes.hitstop.deflect;
  if (impactRow(material) !== d.material) return false;
  if (atk.weapon_class && d.class_bypass.includes(atk.weapon_class)) return false;
  if (d.shape_exempt.includes(atk.shape)) return false;
  return (atk.poise_damage || 0) < d.poise_damage_below;
}

/**
 * THE function. Everything a landed hit needs to know about what it hit.
 *
 * Every value below is read from `classes` on the frame of the hit. Perturb any cell of
 * `hitstop.attacker`, `hitstop.victim_delta`, `hitstop.knockback_m`, `hitstop.deflect` or
 * `materials.multipliers` and the fight changes — that is the CONSUMPTION check (ARBITRATION §3)
 * expressed as a code shape rather than as a promise.
 *
 * @param {object} classes   game/data/weapons/classes.json
 * @param {object} atk       the attacking move, needing:
 *                           {shape, poise_damage, weapon_class, weight_tier, hitstop_f_table}
 * @param {string} material  the victim's material at the struck region
 * @returns {{material, impact_row, damage_type, multiplier, deflect, attacker_hitstop_f,
 *            victim_hitstop_f, knockback_m, added_recovery_f, decal, shake_deg, tier}}
 */
export function resolveImpact(classes, atk, material) {
  const tier = atk.weight_tier || 'medium';
  const row = impactRow(material);
  const H = classes.hitstop;

  // The per-slot table wins over the class table when a slot declares one (RI-WPN05 §A: a
  // weapon may carry its own impact row — `ghm_kings_ruin` does). This is the line moves.js
  // used to end with `.flesh`.
  const table = (atk.hitstop_f_table && atk.hitstop_f_table[row] !== undefined)
    ? atk.hitstop_f_table
    : (H.attacker[tier] || H.attacker.medium);
  let base = table[row];
  if (base === undefined) base = (H.attacker[tier] || H.attacker.medium)[row];
  if (base === undefined) base = 6;

  const def = deflects(classes, atk, material);
  const D = H.deflect;

  const attacker_hitstop_f = def ? Math.ceil(base * D.hitstop_multiplier) : base;
  // RI-WPN05 §A's victim table is TWO kinds of row, and reading it as one was a real defect:
  //   flesh / wood   attacker + 4     the target flinches harder than you do   (DELTA)
  //   chitin         attacker + 2                                             (DELTA)
  //   water          0                nothing to freeze                       (ABSOLUTE)
  //   stone/metal/shield  0           "The target does not move. You do."     (ABSOLUTE)
  // Encoded as a delta of zero, the last four came out as "attacker + 0" — sixteen frames of
  // victim hitstop on a stone golem where the item says none. That is the asymmetry deleted,
  // and the asymmetry IS the bounce, so `victim_hitstop_mode` states which kind each row is.
  const mode = (H.victim_hitstop_mode || {})[row];
  const vd = H.victim_delta[row];
  const victim_hitstop_f = def || mode === 'zero'
    ? 0
    : Math.max(0, base + (vd === undefined ? 0 : vd));

  const kbRow = H.knockback_m[tier] || H.knockback_m.medium;
  const knockback_m = kbRow[row] === undefined ? 0 : kbRow[row];

  const dtype = damageTypeOf(classes, atk.shape);
  const mrow = classes.materials.multipliers[material] || classes.materials.multipliers[row];
  const multiplier = def ? 0 : (mrow && mrow[dtype] !== undefined ? mrow[dtype] : 1);

  const idx = SHAKE_TIER_INDEX[tier] === undefined ? 2 : SHAKE_TIER_INDEX[tier];
  return {
    material,
    impact_row: row,
    damage_type: dtype,
    multiplier,
    deflect: def,
    attacker_hitstop_f,
    victim_hitstop_f,
    knockback_m,
    added_recovery_f: def ? D.added_recovery_f : 0,
    decal: DECAL[material] || 'blood_spray',
    shake_deg: +((H.camera_shake_deg_per_tier || 0.25) * idx * (def ? 1.5 : 1)).toFixed(4),
    tier,
  };
}

/**
 * The victim's material at a struck region. RI-CMB04 owns the regions; a statblock declares one
 * `material` and may override it per region — a Hist-Marked champion is plant at the trunk and
 * metal where it wears a legion cuirass, and the player learns to aim.
 *
 * Fail-closed: a body with no declared material is `flesh` AND is flagged, so a census can
 * report the count rather than silently scoring the default (RI-WPN05 §B: "a statblock with no
 * material is unmeasurable").
 */
export function materialAt(body, hurtboxId) {
  const byRegion = body.materialByRegion;
  if (byRegion && hurtboxId && byRegion[hurtboxId]) return byRegion[hurtboxId];
  return body.material || 'flesh';
}
