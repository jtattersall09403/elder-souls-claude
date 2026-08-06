// What the sheet DOES. The half of W1-07 that round 1 did not build.
//
// Owner: W1-07. Binding sources: RI-PRG02 §3 (the soft-cap curves), RI-PRG03 §2/§3/§4 (the
// progress curve, the use-event table and the Cost Gate), RI-CHR03 §2 (birthsign powers and
// drawbacks), RI-MAG01 §A (the Focus reservoir).
//
// The round-1 verdict on this: "`getPlayerStats().attributes` returns the composed sheet, so
// this is not a data-file claim — the player entity really carries it. **And then nothing
// reads it.** ... Measured HP is constant at 620 and has zero dependence on the attribute."
// Everything below is the reading.
//
// ---------------------------------------------------------------------------------------
// TWO RECONCILIATIONS, DECLARED RATHER THAN QUIETLY PICKED
// ---------------------------------------------------------------------------------------
//
// 1. **The stamina pool.** RI-CMB03 §A (`game/data/combat/stamina.json`) says 90 at END 10,
//    +3/pt to 40, +0.4 after. RI-PRG02 §3 says 80 at END 10 with four bands ending at 181.
//    They agree exactly at END 20 = 120, which is the RI-CMB07 exemplar build and therefore
//    the only value any shipped combat measurement depends on. Resolution: a character
//    composed at the Writ House gets **RI-PRG02's curve**, because RI-PRG02 §3 explicitly
//    claims the pool ("this item owns only the pool and regen numbers those systems read");
//    a loadout with no character behind it keeps RI-CMB03's, so every existing W1-09
//    scenario measures exactly what it measured before. Nothing in the fight changes.
//
// 2. **The Dry Well's drawback.** RI-MAG01 §A is categorical: "Focus NEVER regenerates.
//    There is no `restoreFocus` function in this project." So RI-CHR03's `nu-ixtu` drawback,
//    read literally, removes a system that does not exist for anybody — which is exactly
//    what the round-1 critic measured and scored 0. RI-MAG01 §A permits exactly two things
//    to raise Focus: **a HEARTH rest and a respawn**. That is the regeneration this sign
//    takes away. A Dry Well character gets a 1.60× reservoir that is filled once, at
//    creation, and is never filled again by resting, by dying, or by anything except the
//    sign's own absorption clause. It is losable — you can walk into a boss with an empty
//    bar and no way to fill it — and it is measurable in one line: rest, and see whether the
//    number moved. Filed as `AMENDMENT-W1-07-03`.
'use strict';

// ---------------------------------------------------------------------------------------
// RI-PRG02 §3 — the curves
// ---------------------------------------------------------------------------------------

/** Piecewise-linear evaluation over [{at, per}] bands anchored at (x0, y0). */
function piecewise(x, x0, y0, bands) {
  let v = y0, prev = x0;
  if (x <= x0) return y0 + (x - x0) * bands[0].per;    // below the first anchor, first slope
  for (const b of bands) {
    const top = Math.min(x, b.to);
    if (top > prev) { v += (top - prev) * b.per; prev = top; }
    if (x <= b.to) break;
  }
  if (x > prev) v += (x - prev) * bands[bands.length - 1].per;
  return v;
}

/**
 * VIGOUR → max HP. Base 300 at VIG 10; 742 at 27, 924 at 40, 1,044 at 60, 1,122 at 99.
 * Below 10 the item publishes no band, so the first band's slope continues; the floor is 1,
 * because a character sheet may not produce a corpse.
 */
export function hpMaxFor(vig) {
  const v = clamp(vig, 1, 99);
  return Math.max(1, Math.round(piecewise(v, 10, 300, [
    { to: 27, per: 26 }, { to: 40, per: 14 }, { to: 60, per: 6 }, { to: 99, per: 2 },
  ])));
}

/** ENDURANCE → max stamina. 80 at 10, 120 at 20, 145 at 30, 157 at 40, 181 at 99. */
export function staminaMaxFor(end) {
  const e = clamp(end, 1, 99);
  return round1(Math.max(10, piecewise(e, 10, 80, [
    { to: 20, per: 4.0 }, { to: 30, per: 2.5 }, { to: 40, per: 1.2 }, { to: 99, per: 0.4 },
  ])));
}

/**
 * Stamina regen, per second. RI-PRG02 §3: "+0.30/s per point from END 10 to END 25, flat
 * thereafter". Anchored on RI-CMB03's measured 45.0/s at the END-20 exemplar so the two
 * items agree where they overlap.
 */
export function staminaRegenPerSecond(end) {
  const e = clamp(end, 1, 99);
  return round3(45.0 + (Math.min(e, 25) - 20) * 0.30);
}

/** RI-MAG01 §A's WILLPOWER curve, re-exported here so one module owns "the pools". */
export function focusMaxFor(wil) {
  const w = clamp(wil, 1, 99);
  let f = 30;
  if (w <= 10) return 30;
  f += 3.2 * Math.min(w, 30) - 32;
  if (w > 30) f += 0.9 * (Math.min(w, 50) - 30);
  if (w > 50) f += 0.25 * (w - 50);
  return Math.round(f);
}

/** RI-PRG02 §3 via RI-MAG01 §A: base 2, +1 at WIL 15/25/35/50. */
export function spellSlotsFor(wil) {
  let n = 2;
  for (const t of [15, 25, 35, 50]) if (wil >= t) n++;
  return n;
}

/** STRENGTH → max equip load. RI-PRG02 §1: the one uncapped return. */
export function equipLoadMaxFor(str) {
  return round1(40 + clamp(str, 1, 99) * 2.2);
}

/** RI-PRG02 §4's scaling ramp, so damage reads the sheet the same way HP does. */
const SCALING_TABLE = [
  [1, 0.000], [10, 0.160], [18, 0.320], [20, 0.371], [25, 0.500], [30, 0.620],
  [35, 0.740], [40, 0.850], [45, 0.890], [50, 0.920], [60, 0.950], [70, 0.970],
  [80, 0.985], [99, 1.000],
];
export function scalingBonus(stat) {
  const s = clamp(stat, 1, 99);
  for (let i = 1; i < SCALING_TABLE.length; i++) {
    const [x1, y1] = SCALING_TABLE[i];
    if (s <= x1) {
      const [x0, y0] = SCALING_TABLE[i - 1];
      return round4(y0 + (y1 - y0) * ((s - x0) / (x1 - x0)));
    }
  }
  return 1.0;
}

export const GRADE_COEFF = { S: 1.00, A: 0.80, B: 0.62, C: 0.46, D: 0.32, E: 0.18, none: 0 };
const GRADE_ORDER = ['none', 'E', 'D', 'C', 'B', 'A', 'S'];

/** RI-PRG03 §5: the weapon skill shifts the EFFECTIVE grade. It never touches the hit test. */
export function effectiveGrade(printed, skill, req) {
  let i = GRADE_ORDER.indexOf(printed);
  if (i < 0) return printed;
  if (skill < req - 20) i -= 3;
  else if (skill < req - 10) i -= 2;
  else if (skill < req) i -= 1;
  else if (skill >= req + 25) i += 1;
  if (i < 0) i = 0;
  if (i > GRADE_ORDER.length - 1) i = GRADE_ORDER.length - 1;
  return GRADE_ORDER[i];
}

// ---------------------------------------------------------------------------------------
// The pools a character has, in one object
// ---------------------------------------------------------------------------------------

/**
 * @param {object} attributes  the ten composed attributes
 * @returns {object} every pool the simulation reads, derived and nothing else
 */
export function derivePools(attributes) {
  const a = attributes || {};
  const vig = num(a.vigour, 10), end = num(a.endurance, 10), wil = num(a.willpower, 10);
  const str = num(a.strength, 10);
  return {
    hp_max: hpMaxFor(vig),
    stamina_max: staminaMaxFor(end),
    stamina_regen_per_s: staminaRegenPerSecond(end),
    stamina_regen_per_frame: round4(staminaRegenPerSecond(end) / 60),
    focus_max: focusMaxFor(wil),
    spell_slots: spellSlotsFor(wil),
    equip_load_max: equipLoadMaxFor(str),
    from: { vigour: vig, endurance: end, willpower: wil, strength: str },
  };
}

/**
 * RI-CHR03: what the sign does to the pools, and what it takes away.
 *
 * Powers compose at their declared scale (Kaal-Kaal's second sign at 0.5); drawbacks compose
 * at FULL magnitude, which is RI-CHR03 method 9 and the one asymmetry the round-1 build got
 * right and nothing consumed.
 */
export function applyBirthsignToPools(pools, character) {
  const out = { ...pools, birthsign_terms: [], focus_restores_at_hearth: true, focus_max_base: pools.focus_max };
  if (!character) return out;
  for (const p of character.powers || []) {
    for (const e of (p.power && p.power.effects) || []) {
      if (e.kind === 'focus_max_multiplier') {
        // scale 0.5 halves the DEVIATION from 1, not the multiplier: a ×1.60 at half strength
        // is ×1.30, which is what RI-CHR03 §Kaal-Kaal states in prose ("×1.30 Focus").
        const mult = 1 + (e.value - 1) * (p.scale === undefined ? 1 : p.scale);
        out.focus_max = Math.round(out.focus_max * mult);
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: round3(mult), scale: p.scale });
      }
      if (e.kind === 'flask_charges') {
        out.flask_charge_delta = (out.flask_charge_delta || 0) + Math.round(e.delta * (p.scale === undefined ? 1 : p.scale));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: e.delta, scale: p.scale });
      }
      if (e.kind === 'resistance') {
        out.resistances = out.resistances || {};
        out.resistances[e.element] = round3((out.resistances[e.element] || 0) + e.value * (p.scale === undefined ? 1 : p.scale));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, element: e.element, applied: e.value, scale: p.scale });
      }
      if (e.kind === 'spell_absorption' || e.kind === 'spell_absorb_fraction') {
        out.spell_absorption = round3((out.spell_absorption || 0) + (e.value || 0) * (p.scale === undefined ? 1 : p.scale));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: e.value, scale: p.scale });
      }
      if (e.kind === 'detection_radius_multiplier') {
        out.detection_radius_multiplier = round3((out.detection_radius_multiplier || 1) * (1 + (e.value - 1) * (p.scale === undefined ? 1 : p.scale)));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: e.value, scale: p.scale });
      }
      if (e.kind === 'travel_fare') {
        out.travel_fare_multiplier = round3((out.travel_fare_multiplier || 1) * (1 + (e.multiplier - 1) * (p.scale === undefined ? 1 : p.scale)));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: e.multiplier, scale: p.scale });
      }
      if (e.kind === 'merchant_disposition') {
        out.merchant_disposition_delta = (out.merchant_disposition_delta || 0) + Math.round(e.delta * (p.scale === undefined ? 1 : p.scale));
        out.birthsign_terms.push({ sign: p.sign, kind: e.kind, applied: e.delta, scale: p.scale });
      }
    }
  }
  for (const d of character.drawbacks || []) {
    const db = d.drawback || {};
    if (db.removes_system === 'focus_regeneration') {
      // See the header. This is the one thing RI-MAG01 §A leaves that CAN be removed.
      out.focus_restores_at_hearth = false;
      out.birthsign_terms.push({ sign: d.sign, kind: 'drawback', removes: 'focus_restore_at_hearth', scale: 1.0, via: d.via || null });
    }
    if (db.removes_system === 'nearest_well_respawn_and_recall_targeting') {
      out.respawn_rank = 2;                        // the SECOND-nearest sapwell
      out.birthsign_terms.push({ sign: d.sign, kind: 'drawback', removes: 'nearest_well_respawn', scale: 1.0, via: d.via || null });
    }
    if (db.flag) {
      out.flags = out.flags || [];
      if (out.flags.indexOf(db.flag) < 0) out.flags.push(db.flag);
      out.birthsign_terms.push({ sign: d.sign, kind: 'drawback', flag: db.flag, scale: 1.0, via: d.via || null });
    }
    if (/respawn density/i.test(db.detail || '') || /re-grows more/i.test(db.summary || '')) {
      out.respawn_density_multiplier = 1.5;
      out.birthsign_terms.push({ sign: d.sign, kind: 'drawback', respawn_density: 1.5, scale: 1.0, via: d.via || null });
    }
    if (/rootkeeper disposition -25/i.test(db.detail || '')) {
      out.rootkeeper_disposition_delta = -25;
      out.birthsign_terms.push({ sign: d.sign, kind: 'drawback', rootkeeper_disposition: -25, scale: 1.0, via: d.via || null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// RI-PRG03 — skills that improve by use
// ---------------------------------------------------------------------------------------

/** §2: one curve for all nineteen. */
export function progressToNext(skill) { return Math.round(1.6 * skill + 6); }

/**
 * Weapon class → the skill that governs it, in BOTH vocabularies the build uses.
 *
 * `game/data/weapons/classes.json` keys the fifteen classes as DGR/SSW/AXE/…, and W1-09's
 * seven spine files carry `class_key` as `straight_sword`/`ultra_greatsword`/…, which is what
 * a live body's `moves._classKey` actually is. Round 2 shipped only the first set and the
 * first live probe came back `refused: "no skill governs weapon class 'straight_sword'"` on
 * every one of 35 connecting hits — which is the fail-closed path working exactly as intended
 * and is why the refusal carries the class name.
 */
export const CLASS_TO_SKILL = {
  // RI-WPN02's fifteen class ids
  DGR: 'blades', SSW: 'blades', CSW: 'blades', TSW: 'blades',
  AXE: 'axes-maces', MCE: 'axes-maces', WHP: 'axes-maces',
  SPR: 'polearms', HLB: 'polearms',
  GSW: 'greatweapons', CGS: 'greatweapons', GHM: 'greatweapons', UGS: 'greatweapons',
  FST: 'claw-fang',
  BOW: 'marksman',
  // W1-09's spine class_keys, which is what a live CombatBody reports
  dagger: 'blades', straight_sword: 'blades', curved_sword: 'blades', thrusting_sword: 'blades',
  axe: 'axes-maces', mace: 'axes-maces', whip: 'axes-maces',
  spear: 'polearms', halberd: 'polearms',
  greatsword: 'greatweapons', curved_greatsword: 'greatweapons', great_hammer: 'greatweapons',
  ultra_greatsword: 'greatweapons',
  fist: 'claw-fang', claw: 'claw-fang',
  bow: 'marksman', crossbow: 'marksman',
};

/**
 * §3's table, keyed by the event this build can actually observe. Every row names what it
 * consumed, because §4's Cost Gate is the rule and not a comment: "A use event grants
 * progress only if it consumed something the world can run out of."
 */
export const USE_EVENTS = {
  weapon_hit: { points: 1, consumes: 'an enemy\'s health', skill: 'from_weapon_class' },
  riposte: { points: 2, consumes: 'an enemy\'s health, from a critical', skill: 'from_weapon_class' },
  backstab: { points: 2, consumes: 'an enemy\'s health, from a critical', skill: 'from_weapon_class' },
  marksman_hit: { points: 2, consumes: 'an arrow and an enemy\'s health', skill: 'marksman', min_range_m: 12 },
  shield_absorb: { points: 1, consumes: 'stamina against a real blow', skill: 'shieldcraft' },
  parry: { points: 3, consumes: 'a parry window against a real blow', skill: 'shieldcraft' },
  cast_effective: { points: 12, consumes: 'Focus, which does not come back', skill: 'from_spell_class' },
  potion_brewed: { points: 35, consumes: 'reagents', skill: 'alchemy' },
  novel_recipe: { points: 90, consumes: 'reagents, first time', skill: 'alchemy' },
  lock_picked: { points: 25, consumes: 'a lockpick', skill: 'security' },
  lock_failed: { points: 6, consumes: 'a lockpick', skill: 'security' },
  sneak_interval: { points: 4, consumes: 'time inside a live hostile cone', skill: 'sneak' },
  stealth_opener: { points: 30, consumes: 'an unaware enemy', skill: 'sneak' },
  persuade_success: { points: 55, consumes: 'an NPC\'s disposition', skill: 'speechcraft' },
  persuade_failure: { points: 15, consumes: 'an NPC\'s disposition', skill: 'speechcraft' },
  barter_turnover: { points: 1, consumes: 'gold that changed hands', skill: 'mercantile', per_gold: 25 },
  sprint_interval: { points: 3, consumes: 'stamina', skill: 'athletics' },
  drop_landed: { points: 8, consumes: 'HP risk on a real drop', skill: 'acrobatics' },
  fall_survived: { points: 20, consumes: 'HP on a real fall', skill: 'acrobatics' },
  creature_harvested: { points: 20, consumes: 'a corpse the world had one of', skill: 'survival' },
  flora_gathered: { points: 10, consumes: 'a plant the world had one of', skill: 'survival' },
};

/**
 * The Cost Gate in one function. Returns the skill id and points, or null.
 *
 * The `cost` argument is the thing the event consumed, as observed — not as declared. A
 * swing that connects with nothing passes `cost: 0` and is refused here, which is why
 * standing in a doorway swinging at air is worth exactly zero and always will be.
 */
export function skillProgressFor(eventKind, ctx = {}) {
  const row = USE_EVENTS[eventKind];
  if (!row) return null;
  if (!ctx.cost) return { skill: null, points: 0, refused: 'cost_gate', consumes: row.consumes };
  let skill = row.skill;
  if (skill === 'from_weapon_class') {
    skill = CLASS_TO_SKILL[ctx.weapon_class] || null;
    if (!skill) return { skill: null, points: 0, refused: `no skill governs weapon class '${ctx.weapon_class}'` };
  }
  if (skill === 'from_spell_class') {
    skill = ctx.spell_skill || 'sorcery';
  }
  if (row.min_range_m !== undefined && !(ctx.range_m >= row.min_range_m)) {
    return { skill, points: 0, refused: `range ${ctx.range_m} m is under the ${row.min_range_m} m floor` };
  }
  let points = row.points;
  if (row.per_gold) points = Math.floor((ctx.gold || 0) / row.per_gold) * row.points;
  return { skill, points, consumes: row.consumes };
}

/**
 * Bank progress into a skill, applying §2's curve, §4's rest clamp (+3 levels between
 * HEARTH rests) and RI-PRG02 §2's earned-attribute grant at every multiple of 15.
 *
 * @returns {object} what happened, for the trace and for the critic
 */
export function bankProgress(progression, skillId, points, governingOf) {
  const rec = progression.skills[skillId];
  if (!rec) return { skill: skillId, granted: 0, refused: 'no such skill on this character' };
  if (points <= 0) return { skill: skillId, granted: 0, value: rec.value };
  const before = rec.value;
  rec.useProgress = (rec.useProgress || 0) + points;
  const levelsThisRest = (rec.levelsSinceRest || 0);
  let gained = 0;
  const attributesGranted = [];
  while (rec.value < 100) {
    // §4's rest clamp: at most +3 levels in a single skill between HEARTH rests.
    if (levelsThisRest + gained >= 3) { rec.restClamped = true; break; }
    const need = progressToNext(rec.value);
    if (rec.useProgress < need) break;
    rec.useProgress -= need;
    rec.value++;
    gained++;
    // RI-PRG02 §2's earned stream: crossing a multiple of 15 grants +1 to the governor.
    if (rec.value % 15 === 0) {
      const attr = governingOf(skillId);
      if (attr && progression.attributes[attr] !== undefined && progression.attributes[attr] < 99) {
        progression.attributes[attr]++;
        progression.earnedAttributePoints = (progression.earnedAttributePoints || 0) + 1;
        attributesGranted.push({ attribute: attr, at_skill: rec.value, to: progression.attributes[attr] });
      }
    }
  }
  rec.levelsSinceRest = levelsThisRest + gained;
  return {
    skill: skillId, granted: points, from: before, value: rec.value, gained,
    progress: round3(rec.useProgress), to_next: progressToNext(rec.value),
    attributes_granted: attributesGranted,
    rest_clamped: !!rec.restClamped,
  };
}

function clamp(v, lo, hi) { const n = Number(v); return !Number.isFinite(n) ? lo : n < lo ? lo : n > hi ? hi : n; }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function round1(v) { return Math.round(v * 10) / 10; }
function round3(v) { return Math.round(v * 1000) / 1000; }
function round4(v) { return Math.round(v * 1e4) / 1e4; }
