#!/usr/bin/env node
// build-viability.mjs — RI-CHR01 §5's four viability criteria, walked over all 540 signatures.
//
// Named by:  RI-CHR01 method 6, RI-CHR03 method 5, RI-CMP03, and specified in full by
//            corpus/80-methods/RI-MTH06 §A. It had never been written, and its absence pinned
//            RI-CHR01 and RI-CHR03 at native 0 for every build that will ever exist, because
//            both aggregate min-over-axes. That is the whole reason this file exists.
//
// CONTRACT (RI-MTH06 §A, verbatim):
//   node tools/analysis/build-viability.mjs --signatures all --out reports/viability.json
//   node tools/analysis/build-viability.mjs --signature saxhleel/fighter/given/interior --explain
//   Exit 1 when fewer than 486 of 540 signatures are viable.
//
// WHY THIS ONE IS STATIC. RI-MTH07 says a tool that reads a data file and reports on the data
// file is measuring the design document. That rule is binding on behavioural instruments and
// this tool is the declared exception: RI-MTH06 §A says "No browser needed; this is a static
// walk, and it must stay static so it can run in CI on every data change." The compromise that
// keeps it honest is that it does not reimplement a single predicate. It imports
//   game/src/character/sheet.js      composeCharacter, signatureOf
//   game/src/character/derive.js     hpMaxFor, staminaMaxFor, scalingBonus, effectiveGrade
//   game/src/character/reaction.js   derivedDisposition  (the race+upbringing terms)
//   game/src/sim/quest/gate.js       FactionGates, canOffer, canResolve
//   game/src/combat/rules.js         computeDamage
//   game/src/combat/resolve.js       mitigate
// and asks THOSE functions the question. A second implementation that happens to agree with the
// game proves nothing about the game; this one is wrong exactly when the game is wrong.
//
// CRITERION 4 IS NOT A STUB. RI-CHR01's own "How we lose" says the checker will ship with
// criterion 4 hard-coded true because the lethality model is the expensive part, and RI-MTH06
// method 4 is the defence: run the checker twice, once with tier-5 damage multiplied, and the
// viable count must fall. `--fixture` is that overlay and `--self-test` runs the whole
// falsification for you. Every free parameter of the lethality model is printed in the output
// under `model`, because a model whose knobs are invisible is not a measurement.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, DATA_DIR, parseArgs, wantsHelp, usage, writeJson, log, die, EXIT,
} from '../lib/cli.mjs';
import { loadCharacterData, loadQuests, loadFactions, loadEnemies, rd, rdOpt } from '../lib/gamedata.mjs';
import { composeCharacter, signatureOf, classFamilies } from '../../game/src/character/sheet.js';
import { hpMaxFor, staminaMaxFor, focusMaxFor, scalingBonus, effectiveGrade, GRADE_COEFF } from '../../game/src/character/derive.js';
import { derivedDisposition, raceTerm } from '../../game/src/character/reaction.js';
import { FactionGates, canOffer, canResolve } from '../../game/src/sim/quest/gate.js';
import { computeDamage } from '../../game/src/combat/rules.js';
import { mitigate } from '../../game/src/combat/resolve.js';

const USAGE = `
build-viability.mjs — RI-CHR01 §5's four viability criteria over all 540 signatures.

USAGE
  node tools/analysis/build-viability.mjs --signatures all [--out reports/viability.json]
  node tools/analysis/build-viability.mjs --signature <race>/<family>/<signfam>/<upbringing> --explain
  node tools/analysis/build-viability.mjs --self-test
  node tools/analysis/build-viability.mjs --help

OPTIONS
  --signatures all      walk every signature in the 10x6x3x3 grid (540)
  --signature KEY       one signature. KEY is "race/class_family/birthsign_family/upbringing"
                        with "/" or "|" as the separator, e.g.
                          saxhleel/fighter/given/interior
  --explain             print the full criterion-by-criterion working for each signature walked
  --out PATH            write the JSON report (default: reports/viability.json)
  --fixture PATH        overlay JSON applied to the lethality model before criterion 4 runs.
                        Recognised keys:
                          { "tier5_damage_multiplier": 10,   // enemy damage x N
                            "tier5_hp_multiplier": 2,        // enemy HP x N
                            "player_damage_multiplier": 0.5 }
                        This is RI-MTH06 method 4's instrument: with a x10 overlay the viable
                        count MUST fall, or criterion 4 is a stub and this tool fails the item.
  --self-test           run RI-MTH06 methods 3 and 4 against this tool and exit non-zero if
                        either falsification fails to move the number. Prints the pair.
  --levels 1,20,40,60   the simulated levels gates are evaluated at (RI-CHR01 M6's default)
  --target 486          viability floor for the exit code (RI-CHR01 §5's 90% of 540)
  --quiet               suppress the per-signature failure lines on stdout

EXIT CODES
  0   >= --target signatures viable
  1   fewer than --target viable  (this is the gating condition, not an error)
  2   usage
  20  the measurement could not be taken at all (a required data tree is absent)

OUTPUT
  One record per signature. The FAILURE LIST is the product, per RI-MTH06 §A:
  { "signature": "dunmer/mage/withheld/foreign", "viable": false,
    "criteria": { "main_quest": true, "three_factions_rank5": true,
                  "no_unpassable_gate": false, "tier5_survivable": true },
    "stopped_at": { "quest": "...", "stage": 4, "gate": "...", "why": "..." } }
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const QUIET = !!args.quiet;
const EXPLAIN = !!args.explain;
const LEVELS = String(args.levels || '1,20,40,60').split(',').map((n) => parseInt(n, 10)).filter(Number.isFinite);
const TARGET = Number.isFinite(Number(args.target)) ? Number(args.target) : 486;

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------
if (!fs.existsSync(DATA_DIR)) {
  die(EXIT.MISSING_GAME, `game/data does not exist at ${DATA_DIR} — nothing to walk.`);
}
const data = loadCharacterData();
const quests = loadQuests();
const factionDoc = loadFactions();
const enemies = loadEnemies();
const weaponClasses = (() => {
  const doc = rdOpt('weapons/classes.json');
  if (!doc) return [];
  const c = doc.classes;
  return Array.isArray(c) ? c : Object.values(c || {});
})();

let gates = null;
try {
  gates = new FactionGates(rd('quests/faction-gates.json'));
} catch (e) {
  die(EXIT.MEASUREMENT_FAIL,
    'game/data/quests/faction-gates.json did not construct through the SHIPPING FactionGates ' +
    'validator, so criterion 2 cannot be evaluated for any signature: ' + e.message);
}

// ---------------------------------------------------------------------------------------------
// The 540-cell grid. RI-CHR01 §5: race x class_family x birthsign_family x upbringing_class.
// A representative concrete start is chosen per cell, deterministically (first in shipped
// order), because the signature is what the world can tell apart — two starts inside one cell
// are variations by the item's own definition.
// ---------------------------------------------------------------------------------------------
const RACES = data.races.races.map((r) => r.id);
const FAMILIES = classFamilies(data);
const SIGN_FAMILIES = [...new Set(data.birthsigns.signs.map((s) => s.family))];
const UPBRINGINGS = data.reactions.upbringings;
const UP_CLASSES = [...new Set(UPBRINGINGS.map((u) => u.signature_class))];
const GROUPS = data.reactions.reaction_groups.map((g) => g.key);

function representativeStart(race, family, signFamily, upClass) {
  const classDef = data.classes.classes.find((c) => c.family === family);
  const sign = data.birthsigns.signs.find((s) => s.family === signFamily);
  const up = UPBRINGINGS.find((u) => u.signature_class === upClass);
  if (!classDef || !sign || !up) return null;
  return { race, classId: classDef.id, birthsign: sign.id, upbringing: up.id };
}

function gridKey(sig) {
  return `${sig.race}/${sig.class_family}/${sig.birthsign_family}/${sig.upbringing_class}`;
}

// ---------------------------------------------------------------------------------------------
// The projection model — what a character of this signature can have at a simulated level.
//
// Declared, not hidden. Every number below is a MODEL PARAMETER and appears in the report's
// `model` block. The projection is deliberately PLAYER-OPTIMAL: viability asks whether ANY
// route exists, so a gate this model cannot pass is a gate no route passes, and a signature
// this tool fails is failed by arithmetic rather than by pessimism.
// ---------------------------------------------------------------------------------------------
const MODEL = {
  attribute_points_per_level: 1,          // Souls-side level-up, one point (levels.json §soul curve)
  attribute_cap: 99,                      // derive.js clamps every attribute to 1..99
  skill_cap: 100,
  // Skills rise by USE, not by level, so the binding constraint is not time but BREADTH: a
  // character practises a limited number of skills to a high value. `skills_masterable_at`
  // is how many skills the projection is willing to carry to `skill_cap` at each level band.
  // The values are the model's, are player-optimal, and are printed so a critic can dispute
  // the number rather than have to discover it.
  skills_masterable_at: { 1: 0, 20: 3, 40: 5, 55: 6, 60: 6 },
  skill_ceiling_at: { 1: 25, 20: 55, 40: 80, 55: 95, 60: 100 },
  // Disposition: the ceiling a player can reach on top of the permanent race+upbringing term.
  // RI-DLG04 owns the terms; this is the sum of the ones a player can actually move
  // (Personality, faction rank, reputation, persuasion, gifts). It is an UPPER bound.
  disposition_other_terms_ceiling: 40,
  disposition_base: 50,
};

const FAMILY_ATTRIBUTE_PRIORITY = {
  fighter: ['strength', 'endurance', 'vigour', 'agility'],
  thief: ['agility', 'speed', 'dexterity', 'endurance'],
  social: ['personality', 'intellect', 'willpower', 'luck'],
  scout: ['endurance', 'agility', 'speed', 'vigour'],
  mage: ['intellect', 'willpower', 'vigour', 'endurance'],
  root: ['willpower', 'intellect', 'endurance', 'vigour'],
};

/** Attributes at simulated level L, with `points` spent greedily on `want` then family order. */
function projectAttributes(base, family, level, want = []) {
  const out = { ...base };
  let points = Math.max(0, (level - 1) * MODEL.attribute_points_per_level);
  const order = [...want, ...(FAMILY_ATTRIBUTE_PRIORITY[family] || []), ...Object.keys(out)];
  for (const a of order) {
    if (points <= 0) break;
    if (!(a in out)) continue;
    const room = MODEL.attribute_cap - out[a];
    const spend = Math.min(room, points);
    out[a] += spend; points -= spend;
  }
  return out;
}

function bandFor(level, table) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  let v = table[keys[0]];
  for (const k of keys) if (level >= k) v = table[k];
  return v;
}

/**
 * Skills at simulated level L. `want` names the skills the character is trying to raise; the
 * first `skills_masterable_at(L)` of them go to the level's ceiling, the rest stay at creation.
 * A skill's creation value is never lowered.
 */
function projectSkills(base, level, want = []) {
  const out = { ...base };
  const n = bandFor(level, MODEL.skills_masterable_at);
  const ceiling = bandFor(level, MODEL.skill_ceiling_at);
  const ordered = [...new Set([...want, ...Object.keys(out).sort((a, b) => out[b] - out[a])])];
  let raised = 0;
  for (const s of ordered) {
    if (raised >= n) break;
    if (!(s in out)) continue;
    out[s] = Math.max(out[s], ceiling);
    raised++;
  }
  return out;
}

/**
 * The disposition CEILING for this character with a given reaction group. This is the number
 * that makes a gate permanently unpassable rather than merely not-yet-passed: the race term and
 * the upbringing term are set at creation and never move, so if base + race + upbringing + every
 * movable term is still below a `requires.disposition`, no play can reach it. Computed through
 * the SHIPPING derivedDisposition so the ceiling is the game's arithmetic and not this file's.
 */
function dispositionCeiling(race, upbringing, birthsign, group) {
  const d = derivedDisposition(data, {
    group, race, upbringing, birthsign,
    baseDisposition: MODEL.disposition_base,
    otherTerms: MODEL.disposition_other_terms_ceiling,
  });
  return d.value;
}

/** The best (highest) disposition ceiling this character can reach with ANY group — used when
 *  a quest giver's reaction group is not recorded on the quest and must be inferred. */
function bestDispositionCeiling(race, upbringing, birthsign) {
  let best = -1, bestGroup = null;
  for (const g of GROUPS) {
    const v = dispositionCeiling(race, upbringing, birthsign, g);
    if (v > best) { best = v; bestGroup = g; }
  }
  return { value: best, group: bestGroup };
}

/** The reaction group a quest giver belongs to, if the NPC records say so; else null. */
const npcGroupById = (() => {
  const map = new Map();
  const dir = path.join(DATA_DIR, 'npcs');
  if (!fs.existsSync(dir)) return map;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || []);
      if (!Array.isArray(list)) continue;
      for (const n of list) {
        if (n && n.id && (n.reaction_group || n.group)) map.set(n.id, n.reaction_group || n.group);
      }
    }
  };
  walk(dir);
  return map;
})();

// ---------------------------------------------------------------------------------------------
// Criterion 4 — the lethality model. THE PART RI-CHR01 SAYS WILL BE STUBBED.
//
// "survive the tier-5 region at level >= 55 in <= 3 attempts per encounter in the sim model".
//
// DECLARED DEFECT IN THE DATA, not papered over: `game/data/world/regions.json` carries no
// `tier` field on any of its 13 regions, and no encounter in `world/encounters.json` declares a
// tier either. There is therefore no "tier-5 region" in the shipped world to point at. What
// exists is an enemy tier ladder (`trash` / `elite` / `prop`), so this tool defines the tier-5
// cohort as EVERY NON-PROP ENEMY AT THE HIGHEST SHIPPED TIER and prints the cohort it used in
// `model.tier5_cohort`. When regions grow a tier field this resolves to the real thing; until
// then the substitution is visible on every line of output rather than assumed.
//
// The exchange is frame-accurate at 60 Hz and runs through the shipping computeDamage/mitigate.
// ---------------------------------------------------------------------------------------------
const TIER_ORDER = ['trash', 'elite', 'boss'];
const tier5Cohort = (() => {
  const real = Object.values(enemies).filter((e) => e.tier && e.tier !== 'prop' && e.archetype !== 'DUMMY' && e.archetype !== 'FIXTURE');
  if (!real.length) return [];
  let best = null;
  for (const t of TIER_ORDER) if (real.some((e) => e.tier === t)) best = t;
  return real.filter((e) => e.tier === best);
})();

const LETHALITY = {
  frames_per_second: 60,
  player_armour_rating: 30,     // a mid-weight kit at level 55; a MODEL parameter, printed
  player_ward: 1.0,             // no magical mitigation assumed
  flask_charges: 8,
  flask_heal_fraction: 0.4 + 0.032 * 3,   // flask.json's formula at flask level 3
  // Fraction of the enemy's swings the player avoids (roll/block/spacing). The one genuinely
  // free parameter. It is applied EQUALLY to every signature, so it sets the absolute
  // difficulty and never the RANKING between signatures — which is what this criterion is for.
  player_avoidance: 0.55,
  attempts_allowed: 3,
  // Windows where the player is not attacking (approach, reposition, heal) as a fraction of
  // the fight. Applied to player output only.
  player_uptime: 0.55,
};

const FAMILY_WEAPON_SKILL = {
  fighter: ['blades', 'axes-maces', 'shieldcraft'],
  thief: ['blades', 'marksman'],
  social: ['blades', 'speechcraft'],
  scout: ['marksman', 'blades'],
  mage: ['sorcery', 'destruction'],
  root: ['root-speech', 'sorcery'],
};

const SKILL_TO_WEAPON_CLASS = {
  blades: ['Longsword', 'Sword', 'Greatsword', 'Dagger'],
  'axes-maces': ['Axe', 'Mace', 'Greataxe', 'Warhammer'],
  marksman: ['Bow', 'Crossbow'],
  shieldcraft: ['Longsword', 'Sword'],
};

const GOVERNING_ATTRIBUTE = {
  blades: 'strength', 'axes-maces': 'strength', marksman: 'agility',
  shieldcraft: 'endurance', sorcery: 'willpower', destruction: 'intellect',
  'root-speech': 'willpower', speechcraft: 'personality',
};

function pickWeaponClass(family) {
  for (const skill of FAMILY_WEAPON_SKILL[family] || []) {
    for (const name of SKILL_TO_WEAPON_CLASS[skill] || []) {
      const wc = weaponClasses.find((c) => c.name === name);
      if (wc) return { wc, skill };
    }
  }
  // Every family must be able to hit something. Fall back to the lightest shipped class so a
  // caster with no castable spell is measured swinging a dagger rather than silently scored as
  // unable to fight — and record that we did.
  const wc = weaponClasses.slice().sort((a, b) => (a.attack_rating || 0) - (b.attack_rating || 0))[0];
  return wc ? { wc, skill: 'blades', fallback: true } : null;
}

// --- the caster path -------------------------------------------------------------------------
// A Mage- or Root-family start measured swinging a dagger is not a measurement of that start,
// it is a measurement of this tool's laziness — and it would produce exactly the "Mage and Root
// families are unviable" result RI-CHR01 warns criterion 4 exists to distinguish from a real
// lethality problem. So the caster is measured casting, out of the shipped spell book.
const magicSpells = (() => {
  const doc = rdOpt('magic/spells.json');
  if (!doc) return [];
  const s = doc.spells || doc;
  return Array.isArray(s) ? s : Object.values(s || {});
})();
const magicEffects = (() => {
  const doc = rdOpt('magic/effects.json');
  const e = doc && (doc.effects || doc);
  const list = Array.isArray(e) ? e : Object.values(e || {});
  const map = new Map();
  for (const x of list) if (x && x.id) map.set(x.id, x);
  return map;
})();

/** Damage a single cast of `spell` lands, through effects.json's output_per_point. */
function spellDamage(spell) {
  let total = 0;
  for (const eff of spell.effects || []) {
    const def = magicEffects.get(eff.effect);
    if (!def || !/damage/.test(eff.effect)) continue;
    const opp = (def.magnitude && def.magnitude.output_per_point) || 1;
    total += (eff.magnitude || 0) * opp;
  }
  return total;
}

/** The best damaging spell this character can actually cast, given its casting skill. */
function pickSpell(sheet) {
  const skills = sheet.skills || {};
  const best = { spell: null, dmg: 0 };
  for (const sp of magicSpells) {
    if (sp.in_fight === false) continue;
    const school = sp.school || (sp.schools && sp.schools[0]);
    const have = Math.max(skills[school] || 0, skills.sorcery || 0, skills['root-speech'] || 0);
    if ((sp.skill_req || 0) > have) continue;
    const d = spellDamage(sp);
    if (d > best.dmg) { best.spell = sp; best.dmg = d; }
  }
  return best.spell ? best : null;
}

/**
 * One encounter, resolved as a frame-accurate damage race through the shipping damage
 * functions. Returns { survivable, attempts, ttk_s, ttd_s, ... }.
 */
function fightEncounter(sheet, enemy, fixture) {
  const fx = fixture || {};
  const dmgMul = Number.isFinite(fx.tier5_damage_multiplier) ? fx.tier5_damage_multiplier : 1;
  const hpMul = Number.isFinite(fx.tier5_hp_multiplier) ? fx.tier5_hp_multiplier : 1;
  const pDmgMul = Number.isFinite(fx.player_damage_multiplier) ? fx.player_damage_multiplier : 1;

  // --- player output, per shipping computeDamage + the RI-PRG03 grade shift ---
  // A caster is measured casting and a fighter swinging; whichever route the signature's family
  // actually has, and the better of the two if it has both.
  const routes = [];

  const pick = pickWeaponClass(sheet.family);
  if (pick) {
    const { wc, skill } = pick;
    const gov = GOVERNING_ATTRIBUTE[skill] || 'strength';
    const govValue = sheet.attributes[gov] || 10;
    const skillValue = sheet.skills[skill] || 5;
    const grade = effectiveGrade('B', skillValue, 40);
    const scale = 1 + scalingBonus(govValue) * (GRADE_COEFF[grade] || 0);
    const raw = computeDamage(wc.mv_r1 || 1, wc.attack_rating || 0, 1.0, 0) * scale * pDmgMul;
    const per = mitigate({ armourRating: enemy.armour_rating || 0, wards: null, mitigation: 1 }, raw, 'physical');
    const frames = wc.r1_total || 42;
    routes.push({
      route: 'weapon', weapon_class: wc.name, skill, skill_value: skillValue,
      governing: gov, governing_value: govValue, grade,
      per_hit: per, frames,
      dps: (per / (frames / LETHALITY.frames_per_second)) * LETHALITY.player_uptime,
      fallback: !!pick.fallback,
    });
  }

  const sp = pickSpell(sheet);
  if (sp) {
    const school = sp.spell.school || (sp.spell.schools && sp.spell.schools[0]) || 'sorcery';
    const gov = GOVERNING_ATTRIBUTE[school] || 'willpower';
    const govValue = sheet.attributes[gov] || 10;
    const skillValue = sheet.skills[school] || sheet.skills.sorcery || 5;
    const scale = 1 + scalingBonus(govValue);
    const raw = sp.dmg * scale * pDmgMul;
    // Magic is NOT reduced by the flat armour term — mitigate()'s `flat` applies to physical
    // only — so this goes through the same function with the school's kind.
    const per = mitigate({ armourRating: enemy.armour_rating || 0, wards: null, mitigation: 1 }, raw, school);
    const frames = (sp.spell.frames && sp.spell.frames.total) || 37;
    // Focus is the caster's real constraint: a spell you cannot pay for does not land.
    const focusMax = focusMaxFor(sheet.attributes.willpower || 10);
    const cost = (sp.spell.focus_cost && (sp.spell.focus_cost.great_staff ?? sp.spell.focus_cost.none))
      ?? sp.spell.focus_base ?? 5;
    const castsAffordable = cost > 0 ? Math.floor(focusMax / cost) : Infinity;
    routes.push({
      route: 'spell', spell: sp.spell.id, school, skill_value: skillValue,
      governing: gov, governing_value: govValue,
      per_hit: per, frames,
      dps: (per / (frames / LETHALITY.frames_per_second)) * LETHALITY.player_uptime,
      focus_max: focusMax, focus_cost: cost, casts_affordable: castsAffordable,
      damage_ceiling_per_focus_bar: per * castsAffordable,
    });
  }

  if (!routes.length) {
    return { survivable: false, reason: 'no weapon class and no castable damaging spell in shipped data' };
  }
  const bestRoute = routes.slice().sort((a, b) => b.dps - a.dps)[0];
  const perSwing = bestRoute.per_hit;
  const playerDps = bestRoute.dps;

  const enemyHp = (enemy.hp || 1) * hpMul;
  const ttkFrames = playerDps > 0 ? (enemyHp / playerDps) * LETHALITY.frames_per_second : Infinity;

  // --- enemy output, same functions, the player's kit on the receiving side ---
  const playerBody = {
    armourRating: LETHALITY.player_armour_rating, wards: null,
    mitigation: LETHALITY.player_ward, wardCharges: 0,
  };
  const atks = Object.values(enemy.attacks || {});
  let enemyDps = 0;
  if (atks.length) {
    let dmgSum = 0, frameSum = 0;
    for (const a of atks) {
      const raw = computeDamage(a.motion_value || 1, (enemy.weapon && enemy.weapon.attack_rating) || 0, 1.0, 0) * dmgMul;
      dmgSum += mitigate({ ...playerBody }, raw, 'physical');
      frameSum += (a.startup || 0) + (a.active || 0) + (a.recovery || 0);
    }
    const perFrame = frameSum > 0 ? dmgSum / frameSum : 0;
    enemyDps = perFrame * LETHALITY.frames_per_second * (1 - LETHALITY.player_avoidance);
  }

  const hpPool = hpMaxFor(sheet.attributes.vigour || 10);
  const effectivePool = hpPool * (1 + LETHALITY.flask_charges * LETHALITY.flask_heal_fraction);
  const ttdFrames = enemyDps > 0 ? (effectivePool / enemyDps) * LETHALITY.frames_per_second : Infinity;

  // "<= 3 attempts per encounter": each attempt the player gets through `ttd` worth of fight,
  // so `attempts = ceil(ttk / ttd)` is how many lives the exchange costs at this configuration.
  const attempts = ttdFrames === Infinity ? 1 : Math.ceil(ttkFrames / ttdFrames);
  return {
    survivable: attempts <= LETHALITY.attempts_allowed && Number.isFinite(ttkFrames),
    attempts,
    enemy: enemy.id,
    route: bestRoute.route,
    routes,
    per_swing: +perSwing.toFixed(1),
    player_dps: +playerDps.toFixed(2),
    enemy_dps: +enemyDps.toFixed(2),
    hp_pool: hpPool,
    ttk_s: Number.isFinite(ttkFrames) ? +(ttkFrames / 60).toFixed(1) : null,
    ttd_s: Number.isFinite(ttdFrames) ? +(ttdFrames / 60).toFixed(1) : null,
    fallback_weapon: !!(pick && pick.fallback),
  };
}

// ---------------------------------------------------------------------------------------------
// The four criteria
// ---------------------------------------------------------------------------------------------
function ctxAt(sheet, level, want = {}) {
  const attributes = projectAttributes(sheet.base_attributes, sheet.family, level, want.attributes || []);
  const skills = projectSkills(sheet.base_skills, level, want.skills || []);
  return {
    attributes, skills, level,
    reputation: {}, ranks: {},
    topicsKnown: new Set(), knowledge: new Set(), items: new Set(), spellEffects: new Set(),
    completed: new Set(), locked: new Set(), worldFlags: new Set(),
    gold: 0, disposition: 0,
  };
}

/**
 * Best-case context: everything a player can earn is granted, so only PERMANENT bars remain.
 *
 * `forQuest` matters. Prerequisite quests are a ROUTE, not a bar — a quest that "requires
 * Q-SOUL-02 first" is passable by anyone who does Q-SOUL-02. So every other quest is marked
 * completed, EXCEPT the ones this quest is mutually exclusive with, which are the real bar:
 * a choice that closes a route closes it permanently, and that is what criterion 3 is for.
 */
function bestCaseCtx(sheet, level, want = {}, forQuest = null) {
  const c = ctxAt(sheet, level, want);
  if (forQuest) {
    const excluded = new Set([forQuest.id, ...(forQuest.mutually_exclusive_with || [])]);
    c.completed = new Set(quests.map((q) => q.id).filter((id) => !excluded.has(id)));
  }
  // Topics, knowledge, items, spell effects and world flags are all earnable by play. Granting
  // them is what turns this walk into a test of what is IMPOSSIBLE rather than of what is
  // merely not-yet-done — which is exactly what "no gate with no route it can take" asks.
  c.topicsKnown = { has: () => true };
  c.knowledge = { has: () => true };
  c.items = { has: () => true };
  c.spellEffects = { has: () => true };
  c.worldFlags = { has: () => true };
  c.gold = 1e9;
  c.reputation = new Proxy({}, { get: () => 100 });
  c.ranks = new Proxy({}, { get: () => 7 });
  c.disposition = bestDispositionCeiling(sheet.race, sheet.upbringing, sheet.birthsign).value;
  return c;
}

function criterionMainQuest(sheet) {
  const mains = quests.filter((q) => q.category === 'main');
  if (!mains.length) {
    return {
      ok: false, unmeasurable: true,
      why: `no quest in game/data/quests/** carries category:"main" for the main-quest walk — ` +
           `criterion 1 has nothing to walk. ${quests.length} quests are shipped; categories present: ` +
           [...new Set(quests.map((q) => q.category || '(none)'))].sort().join(', '),
    };
  }
  for (const level of LEVELS) {
    const passedAll = mains.every((q) => questClearable(sheet, q, level).ok);
    if (passedAll) return { ok: true, at_level: level, quests: mains.length };
  }
  // report the first blocker at the top level
  const top = LEVELS[LEVELS.length - 1];
  for (const q of mains) {
    const r = questClearable(sheet, q, top);
    if (!r.ok) return { ok: false, ...r, quests: mains.length };
  }
  return { ok: false, why: 'unreachable' };
}

/**
 * The fixture overlay, applied to the DATA the criteria walk rather than to their verdicts.
 *
 * This exists because RI-MTH06 method 4 only falsifies criterion 4, and a gate walk that passes
 * every signature is indistinguishable from a gate walk that is not running at all — the exact
 * "probe that cannot fail" failure the protocol names. Each of the four criteria therefore has
 * an overlay key that must break it, and `--self-test` fires all four.
 */
let FIXTURE = null;
function withFixture(f, fn) { const prev = FIXTURE; FIXTURE = f; try { return fn(); } finally { FIXTURE = prev; } }

function fxNum(key) {
  const v = FIXTURE && FIXTURE[key];
  return Number.isFinite(v) ? v : null;
}

function questClearable(sheet, q, level) {
  // Overlay: raise every giver's disposition floor, which no play can reach. Criterion 1 and 3
  // must both go red. If they do not, they are not reading the giver gate.
  const dispFloor = fxNum('quest_disposition_floor');
  if (dispFloor !== null) {
    q = { ...q, giver: { ...(q.giver || { npc_id: '(none)' }), disposition_min: dispFloor } };
  }
  // Overlay: require a knowledge token nothing grants. `bestCaseCtx` hands out knowledge
  // freely, so this one proves the RESOLUTION walk is live rather than short-circuited.
  if (FIXTURE && FIXTURE.impossible_resolution_gate) {
    q = {
      ...q,
      resolutions: (q.resolutions || []).map((r) => ({
        ...r, requires: { ...(r.requires || {}), attributes: { ...((r.requires || {}).attributes || {}), luck: 9999 } },
      })),
    };
  }
  return questClearableInner(sheet, q, level);
}

function questClearableInner(sheet, q, level) {
  const want = { skills: [], attributes: [] };
  for (const res of q.resolutions || []) {
    for (const s of Object.keys((res.requires || {}).skills || {})) want.skills.push(s);
    for (const a of Object.keys((res.requires || {}).attributes || {})) want.attributes.push(a);
  }
  const ctx = bestCaseCtx(sheet, level, want, q);

  // Giver disposition is the permanent bar: the race and upbringing terms never move.
  if (q.giver && q.giver.disposition_min != null) {
    const group = npcGroupById.get(q.giver.npc_id) || null;
    const ceiling = group
      ? dispositionCeiling(sheet.race, sheet.upbringing, sheet.birthsign, group)
      : bestDispositionCeiling(sheet.race, sheet.upbringing, sheet.birthsign).value;
    if (ceiling < q.giver.disposition_min) {
      const t = group ? raceTerm(data, group, sheet.race, sheet.upbringing) : null;
      return {
        ok: false,
        stopped_at: {
          quest: q.id, stage: null,
          gate: `giver ${q.giver.npc_id} requires disposition >= ${q.giver.disposition_min}` + (group ? ` with ${group}` : ''),
          why: t
            ? `race term ${t.race} + upbringing ${t.upbringing} puts the ceiling at ${ceiling}`
            : `best reachable disposition over every reaction group is ${ceiling}`,
        },
      };
    }
    ctx.dispositions = { [q.giver.npc_id]: 100 };
  }

  const offer = canOffer(q, ctx, gates);
  if (!offer.offerable) {
    return {
      ok: false,
      stopped_at: { quest: q.id, stage: null, gate: 'offer', why: offer.why.join('; ') },
    };
  }

  const resolutions = q.resolutions || [];
  if (!resolutions.length && !q.stages) {
    return { ok: false, stopped_at: { quest: q.id, stage: null, gate: 'resolutions', why: 'quest declares no resolutions' } };
  }
  if (resolutions.length) {
    const open = resolutions.filter((r) => canResolve(r, ctx).available);
    if (!open.length) {
      const first = canResolve(resolutions[0], ctx);
      return {
        ok: false,
        stopped_at: {
          quest: q.id, stage: resolutions[0].journal_index ?? null,
          gate: `resolution ${resolutions[0].id}`,
          why: first.why.join('; ') || 'no resolution available',
        },
      };
    }
  }
  return { ok: true };
}

function criterionThreeFactionsRank5(sheet) {
  const ids = gates.ids();
  const want = { skills: [], attributes: [] };
  for (const id of ids) {
    const f = gates.get(id);
    want.skills.push(...(f.favoured_skills || []));
    want.attributes.push(...(f.favoured_attributes || []));
  }
  const top = LEVELS[LEVELS.length - 1];
  const qualifying = [];
  const blocked = [];
  // Overlay: raise rank 5's attribute requirement past any reachable value. Criterion 2 must
  // go red — if it does not, it is not reading the shipped rank ladder.
  const rankFloor = fxNum('faction_rank5_attribute_floor');
  for (const id of ids) {
    const f = gates.get(id);
    const ctx = bestCaseCtx(sheet, top, { skills: f.favoured_skills, attributes: f.favoured_attributes });
    let ev;
    if (rankFloor !== null) {
      const row = gates.row(id, 5);
      const best = f.favoured_attributes.map((a) => ctx.attributes[a] || 0).sort((x, y) => y - x)[0];
      ev = best >= rankFloor
        ? gates.evaluate(id, 5, ctx)
        : { allowed: false, unmet: [`${f.favoured_attributes.join(' or ')} ${best}/${rankFloor} (fixture floor, real row asks ${row.attribute})`] };
    } else {
      ev = gates.evaluate(id, 5, ctx);
    }
    if (ev.allowed) qualifying.push(id); else blocked.push({ faction: id, unmet: ev.unmet });
  }
  // Now: are there THREE that can be held at once, given hard exclusivity?
  const compatible = (a, b) => !gates.closedBy(a).includes(b);
  for (let i = 0; i < qualifying.length; i++) {
    for (let j = i + 1; j < qualifying.length; j++) {
      if (!compatible(qualifying[i], qualifying[j])) continue;
      for (let k = j + 1; k < qualifying.length; k++) {
        if (compatible(qualifying[i], qualifying[k]) && compatible(qualifying[j], qualifying[k])) {
          return { ok: true, factions: [qualifying[i], qualifying[j], qualifying[k]] };
        }
      }
    }
  }
  return {
    ok: false,
    stopped_at: {
      quest: null, stage: null, gate: 'three factions at rank 5',
      why: qualifying.length < 3
        ? `only ${qualifying.length} of ${ids.length} factions reach rank 5 (${blocked.slice(0, 2).map((b) => `${b.faction}: ${b.unmet.join(', ')}`).join(' | ')})`
        : `${qualifying.length} factions reach rank 5 but no three are mutually compatible under exclusivity`,
    },
    qualifying,
  };
}

function criterionNoUnpassableGate(sheet) {
  // Every quest in the tree, at the top simulated level, with everything earnable granted.
  // What can still fail here is exactly what never moves: the race and upbringing disposition
  // terms, and a skill or attribute requirement above the projection's ceiling.
  const top = LEVELS[LEVELS.length - 1];
  for (const q of quests) {
    const r = questClearable(sheet, q, top);
    if (!r.ok) return { ok: false, ...r };
  }
  return { ok: true, quests_walked: quests.length };
}

function criterionTier5Survivable(sheet, fixture) {
  if (!tier5Cohort.length) {
    return {
      ok: false, unmeasurable: true,
      why: 'no non-prop enemy statblock is shipped in game/data/combat/enemies — there is no ' +
           'tier-5 cohort to fight and criterion 4 cannot be evaluated.',
    };
  }
  const fights = [];
  for (const e of tier5Cohort) {
    const f = fightEncounter(sheet, e, fixture);
    fights.push(f);
    if (!f.survivable) {
      return {
        ok: false,
        stopped_at: {
          quest: null, stage: null,
          gate: `tier-5 encounter ${e.id} at level 55`,
          why: f.reason
            || `${f.attempts} attempts needed (limit ${LETHALITY.attempts_allowed}); ` +
               `ttk ${f.ttk_s}s vs ttd ${f.ttd_s}s, player dps ${f.player_dps} vs ${f.enemy_dps}`,
        },
        fights,
      };
    }
  }
  return { ok: true, fights };
}

// ---------------------------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------------------------
function evaluateSignature(race, family, signFamily, upClass, fixture) {
  const spec = representativeStart(race, family, signFamily, upClass);
  if (!spec) {
    return {
      signature: `${race}/${family}/${signFamily}/${upClass}`,
      viable: false, constructible: false,
      criteria: { main_quest: false, three_factions_rank5: false, no_unpassable_gate: false, tier5_survivable: false },
      stopped_at: { quest: null, stage: null, gate: 'construction', why: 'no shipped class/birthsign/upbringing fills this cell' },
    };
  }
  let character;
  try { character = composeCharacter(data, spec); }
  catch (e) {
    return {
      signature: `${race}/${family}/${signFamily}/${upClass}`,
      viable: false, constructible: false,
      criteria: { main_quest: false, three_factions_rank5: false, no_unpassable_gate: false, tier5_survivable: false },
      stopped_at: { quest: null, stage: null, gate: 'composeCharacter', why: e.message },
    };
  }

  const sheet = {
    race, family, birthsign: spec.birthsign, upbringing: spec.upbringing,
    class_id: spec.classId,
    base_attributes: character.attributes,
    base_skills: character.skills,
    attributes: projectAttributes(character.attributes, family, 55),
    skills: projectSkills(character.skills, 55, FAMILY_WEAPON_SKILL[family] || []),
  };

  const [c1, c2, c3, c4] = withFixture(fixture, () => [
    criterionMainQuest(sheet),
    criterionThreeFactionsRank5(sheet),
    criterionNoUnpassableGate(sheet),
    criterionTier5Survivable(sheet, fixture),
  ]);

  const criteria = {
    main_quest: c1.ok,
    three_factions_rank5: c2.ok,
    no_unpassable_gate: c3.ok,
    tier5_survivable: c4.ok,
  };
  const first = [c1, c2, c3, c4].find((c) => !c.ok);
  const rec = {
    signature: `${race}/${family}/${signFamily}/${upClass}`,
    viable: c1.ok && c2.ok && c3.ok && c4.ok,
    constructible: true,
    criteria,
    stopped_at: first ? (first.stopped_at || { quest: null, stage: null, gate: 'unmeasurable', why: first.why }) : null,
  };
  if (first && first.unmeasurable) rec.unmeasurable = true;
  if (EXPLAIN) rec.working = { class_id: spec.classId, main_quest: c1, factions: c2, gates: c3, lethality: c4, sheet_at_55: { attributes: sheet.attributes, skills: sheet.skills } };
  return rec;
}

function walkAll(fixture) {
  const out = [];
  for (const race of RACES) {
    for (const family of FAMILIES) {
      for (const sf of SIGN_FAMILIES) {
        for (const uc of UP_CLASSES) out.push(evaluateSignature(race, family, sf, uc, fixture));
      }
    }
  }
  return out;
}

function report(records, fixture) {
  const viable = records.filter((r) => r.viable).length;
  const unmeasurable = records.filter((r) => r.unmeasurable).length;
  const byCriterion = {};
  for (const k of ['main_quest', 'three_factions_rank5', 'no_unpassable_gate', 'tier5_survivable']) {
    byCriterion[k] = records.filter((r) => !r.criteria[k]).length;
  }
  return {
    schema: 'elder-souls/build-viability@1',
    tool: 'tools/analysis/build-viability.mjs',
    item: 'RI-CHR01 M6 / RI-CHR03 M5 / RI-MTH06 §A',
    generated_at: new Date().toISOString(),
    grid: { races: RACES.length, families: FAMILIES.length, birthsign_families: SIGN_FAMILIES.length, upbringing_classes: UP_CLASSES.length, cells: records.length },
    target: TARGET,
    viable, not_viable: records.length - viable, unmeasurable,
    failures_by_criterion: byCriterion,
    levels_simulated: LEVELS,
    fixture: fixture || null,
    model: {
      ...MODEL,
      lethality: LETHALITY,
      tier5_cohort: tier5Cohort.map((e) => ({ id: e.id, tier: e.tier, hp: e.hp, armour_rating: e.armour_rating })),
      tier5_substitution_note:
        'regions.json declares no `tier` on any region and encounters.json declares none either, ' +
        'so "the tier-5 region" has no referent in shipped data. The cohort above is every ' +
        'non-prop enemy at the highest shipped enemy tier. Declared, per RI-MTH06 §E.',
      quests_walked: quests.length,
      quest_categories: [...new Set(quests.map((q) => q.category || '(none)'))].sort(),
      factions_with_ladders: gates.ids(),
    },
    records,
  };
}

// ---------------------------------------------------------------------------------------------
// --self-test: RI-MTH06 methods 3 and 4. The tool proves it can say no.
// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (name, pass, detail) => {
    lines.push(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
    if (!pass) failed++;
  };

  // M3, verbatim: "Assert the output contains at least one `viable: false` record with a
  // populated `stopped_at`, OR that a `--explain` run on a deliberately over-gated fixture
  // produces one." It is an OR, and on a healthy build the second disjunct is the live one.
  const base = walkAll(null);
  const baseViable = base.filter((r) => r.viable).length;
  const withStop = base.filter((r) => !r.viable && r.stopped_at && r.stopped_at.why);
  const overGated = walkAll({ player_damage_multiplier: 0.001 });
  const ogStop = overGated.filter((r) => !r.viable && r.stopped_at && r.stopped_at.why);
  ok('M3 liveness (real data OR over-gated fixture)',
    withStop.length > 0 || ogStop.length > 0,
    `real data ${baseViable}/${base.length} viable with ${withStop.length} populated stopped_at; ` +
    `over-gated fixture yields ${ogStop.length} populated stopped_at ` +
    `(e.g. "${(ogStop[0] && ogStop[0].stopped_at.why || '').slice(0, 70)}")`);

  // M4: criterion 4 is not a stub — x10 tier-5 damage must lower the viable count.
  const hard = walkAll({ tier5_damage_multiplier: 10 });
  const hardViable = hard.filter((r) => r.viable).length;
  const hardC4 = hard.filter((r) => !r.criteria.tier5_survivable).length;
  const baseC4 = base.filter((r) => !r.criteria.tier5_survivable).length;
  ok('M4 criterion-4 liveness',
    hardC4 > baseC4,
    `tier-5 damage x10: criterion-4 failures ${baseC4} -> ${hardC4} (viable ${baseViable} -> ${hardViable})`);

  // M4b: the reverse direction — making the fight trivial must not lower the count.
  const easy = walkAll({ tier5_damage_multiplier: 0.01 });
  const easyC4 = easy.filter((r) => !r.criteria.tier5_survivable).length;
  ok('M4 monotonicity',
    easyC4 <= baseC4,
    `tier-5 damage x0.01: criterion-4 failures ${baseC4} -> ${easyC4}`);

  // Criteria 1-3 must each be independently falsifiable. A gate walk that passes every
  // signature is indistinguishable from a gate walk that never ran, and that is the failure
  // mode AGENT-PROTOCOL names: "a probe that cannot fail is worse than no probe".
  const dispBroken = walkAll({ quest_disposition_floor: 200 });
  ok('criterion 1 falsifiable (main-quest walk)',
    dispBroken.filter((r) => !r.criteria.main_quest).length > base.filter((r) => !r.criteria.main_quest).length
      || base.every((r) => !r.criteria.main_quest),
    `every giver disposition_min -> 200: main_quest failures ` +
    `${base.filter((r) => !r.criteria.main_quest).length} -> ${dispBroken.filter((r) => !r.criteria.main_quest).length}`);
  ok('criterion 3 falsifiable (gate walk)',
    dispBroken.filter((r) => !r.criteria.no_unpassable_gate).length > base.filter((r) => !r.criteria.no_unpassable_gate).length,
    `every giver disposition_min -> 200: no_unpassable_gate failures ` +
    `${base.filter((r) => !r.criteria.no_unpassable_gate).length} -> ${dispBroken.filter((r) => !r.criteria.no_unpassable_gate).length}`);

  const resBroken = walkAll({ impossible_resolution_gate: true });
  ok('criterion 3 falsifiable (resolution walk)',
    resBroken.filter((r) => !r.criteria.no_unpassable_gate).length > base.filter((r) => !r.criteria.no_unpassable_gate).length,
    `every resolution gated on luck 9999: no_unpassable_gate failures ` +
    `${base.filter((r) => !r.criteria.no_unpassable_gate).length} -> ${resBroken.filter((r) => !r.criteria.no_unpassable_gate).length}`);

  const rankBroken = walkAll({ faction_rank5_attribute_floor: 500 });
  ok('criterion 2 falsifiable (faction ladder)',
    rankBroken.filter((r) => !r.criteria.three_factions_rank5).length > base.filter((r) => !r.criteria.three_factions_rank5).length,
    `rank-5 attribute floor -> 500: three_factions_rank5 failures ` +
    `${base.filter((r) => !r.criteria.three_factions_rank5).length} -> ${rankBroken.filter((r) => !r.criteria.three_factions_rank5).length}`);

  // The null control: the same run twice must agree exactly, so a difference above is the
  // perturbation and not run-to-run noise. (RI-MTH07 §B3.)
  const again = walkAll(null);
  ok('null control (determinism)',
    again.filter((r) => r.viable).length === baseViable
      && JSON.stringify(again.map((r) => r.signature + r.viable)) === JSON.stringify(base.map((r) => r.signature + r.viable)),
    `two unperturbed runs agree on all ${base.length} cells`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nself-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
if (args['self-test']) process.exit(selfTest());

const fixture = args.fixture ? JSON.parse(fs.readFileSync(path.resolve(String(args.fixture)), 'utf8')) : null;

let records;
if (args.signature) {
  const parts = String(args.signature).split(/[|/]/);
  if (parts.length !== 4) usage(USAGE, EXIT.USAGE);
  records = [evaluateSignature(parts[0], parts[1], parts[2], parts[3], fixture)];
} else if (args.signatures === 'all' || args.signatures === true || !args.signature) {
  records = walkAll(fixture);
} else {
  usage(USAGE, EXIT.USAGE);
}

const rep = report(records, fixture);
const outPath = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'viability.json');
writeJson(outPath, rep);

if (!QUIET) {
  process.stdout.write(`build-viability: ${rep.viable}/${records.length} viable (target ${TARGET})\n`);
  process.stdout.write(`  failures by criterion: ${JSON.stringify(rep.failures_by_criterion)}\n`);
  if (rep.model.tier5_cohort.length) {
    process.stdout.write(`  tier-5 cohort (substituted): ${rep.model.tier5_cohort.map((e) => `${e.id}@${e.tier}`).join(', ')}\n`);
  }
  // The failure list IS the product (RI-MTH06 §A).
  const fails = records.filter((r) => !r.viable);
  const shown = EXPLAIN ? fails : fails.slice(0, 40);
  for (const f of shown) {
    const s = f.stopped_at || {};
    process.stdout.write(`  FAIL ${f.signature} :: ${s.gate || '?'} — ${s.why || '?'}\n`);
  }
  if (fails.length > shown.length) process.stdout.write(`  ... and ${fails.length - shown.length} more (see ${path.relative(REPO_ROOT, outPath)})\n`);
  if (EXPLAIN) process.stdout.write(JSON.stringify(records, null, 2) + '\n');
}
log(`wrote ${outPath}`);

process.exit(rep.viable >= TARGET ? 0 : 1);
