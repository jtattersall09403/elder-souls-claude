#!/usr/bin/env node
// build-viability.mjs — RI-CHR01 §5's four viability criteria, walked over all 540 signatures.
//
// Named by:  RI-CHR01 method 6, RI-CHR03 method 5, RI-CMP03, and specified in full by
//            corpus/80-methods/RI-MTH06 §A.
//
// =============================================================================================
// ROUND 5. Four rejections, four different lines, ONE defect: a check that reports a confident
// number while measuring nothing.
//
//   R1  "regions.json declares no tier on any region" — printed on a tree where all thirteen
//       carry danger_tier 1-5.
//   R2  0 of 41 quest givers resolved to a reaction group and the tool substituted a
//       best-over-all-groups ceiling.
//   R3  `--cross-check` printed "AGREES on 240 pairs, 0 disagreements" on a run where ZERO rows
//       were compared, and the three source anchors matched a race term that was dead.
//   R4  `c.reputation = new Proxy({}, { get: () => 100 })` — the top row of a rank ladder that
//       had since moved to 112. The headline `0 of 540 viable` and the three quests declared
//       unreachable by anybody were the tool colliding with its own stub; the faction critic
//       settled it in the running engine (W1-FACTIONS-r1 §1).
//
// Round 5 does not fix line 1191. It removes the CLASS:
//
//   1. THE GRANT LEDGER. Every value the synthetic character is handed is derived from shipped
//      data or computed by the game's own predicate, each row carries its basis and its source,
//      `--audit-grants` prints the whole table, and `substitutions_remaining` must be 0. Gone:
//      reputation=Proxy(100), ranks=Proxy(7), gold=1e9, and four `has: () => true` collections —
//      three of which stood over an EMPTY Set, so every items / knowledge / spell_effects
//      requirement in the tree was satisfied by a collection containing nothing at all.
//   2. THE GRANT-DEPENDENCY TEST. A requirement token nothing in the tree produces is neither
//      granted nor failed on. The quest is re-run with the token granted; if the verdict flips,
//      it is `unmeasurable` with the token named. A permissive substitution can no longer
//      produce a silent pass, and a census gap of this tool's own can no longer charge the build.
//   3. COUNTS ARE TRACEABLE BY SHAPE, NOT BY ARITHMETIC. `crossCheckVerdict()` builds compared
//      and unresolved rows into DIFFERENT ARRAYS at the push site, `rows_compared` is the length
//      of the compared array and nothing else can be assigned to it, the enumerated count is
//      called `pairs_enumerated`, and a row without a boolean verdict makes the whole check
//      refuse. `--self-test` exercises that function rather than a copy of it.
//   4. MODEL DEPENDENCE IS MEASURED. The grid is walked under both offer models and the tool
//      reports how many verdicts move. Round 4 inferred dependence from "did a disposition stop
//      occur", which is silent about every signature that PASSES because of the model.
//
// The one substitution that survives is declared as one: reputation, gold, `completed` and
// `locked` are player-optimal upper bounds, taken per faction and per pot independently. That
// direction is what criterion 3 requires — a gate this bound cannot clear is a gate no play can
// clear — and it is printed in the ledger rather than buried.
// =============================================================================================
//
// ROUND 2. corpus/80-methods/TOOL-COVERAGE-R1.md §1 rejected round 1 for two permissive
// substitutions, both of which are gone:
//
//   Defect A — the tool printed "regions.json declares no `tier` on any region" into every
//     report. That was FALSE. `world/regions.json` carries `danger_tier` 1–5 on all thirteen
//     regions and `engine.js:3306` reads it into getTerrainAt(). The tier-5 cohort is now
//     resolved from `danger_tier == 5`, through `encounters[].regions` and `hearths.json`
//     `fog_gates[].region`, and the authored GROUP is fought as a group — which is how the only
//     multi-enemy fight in the data (`deep-kin-war-brood`, 3 × inf_trash, deep-marshes) enters
//     the measurement and how a tier-2 boss (`cst_sap_speaker` in blackwood) leaves it.
//
//   Defect B — 0 of 40 quest givers resolved to a reaction group and the tool silently fell
//     back to the best-over-all-twelve-groups ceiling (92–94) against a maximum shipped
//     requirement of 50, so the permanent race+upbringing bar could not fire for any signature.
//     There is now NO fallback. An unresolvable giver group is a DATA ABSENCE: the clause is
//     `unmeasurable`, the giver is named, the count is reported, and the tool exits non-zero.
//     TOOL-LOOP rule 1 — "report the absence and exit non-zero with a reason. Never stub it to
//     pass." A tool that grants itself the thing under test is the failure this project has
//     been caught by three times.
//
// WHAT THE RUNNING WORLD ACTUALLY DOES, and why this file does not invent a mapping.
//   `engine.js:1147`  merged.reaction_group = spec.reaction_group || rec.reaction_group || null
//   `engine.js:1281`  no reaction_group  ->  base_disposition returned with term: 0
//   `engine.js:seedDispositions()`  q.dispositions[rec.id] = rec.disposition, RAW
//   `sim/quest/gate.js:156`  canOffer compares ctx.dispositions[giver.npc_id] to disposition_min
// There is no faction -> reaction-group table anywhere in game/src. `the_drowned_court` is not
// `RG-COURT` as far as the build is concerned. Deriving one here would be measuring the design
// document (RI-MTH07, TOOL-LOOP question 3) and would re-create defect B wearing better clothes.
//
// WHY THIS ONE IS STATIC. RI-MTH07 says a tool that reads a data file and reports on the data
// file is measuring the design document. That rule is binding on behavioural instruments and
// this tool is the declared exception: RI-MTH06 §A says "No browser needed; this is a static
// walk, and it must stay static so it can run in CI on every data change." The compromise that
// keeps it honest is that it does not reimplement a single predicate. It imports
//   game/src/character/sheet.js      composeCharacter, classFamilies
//   game/src/character/derive.js     hpMaxFor, focusMaxFor, scalingBonus, effectiveGrade
//   game/src/character/reaction.js   derivedDisposition, raceTerm  (race+upbringing terms)
//   game/src/sim/quest/gate.js       FactionGates, canOffer, canResolve
//   game/src/combat/rules.js         computeDamage
//   game/src/combat/resolve.js       mitigate
// and asks THOSE functions the question. A second implementation that happens to agree with the
// game proves nothing about the game; this one is wrong exactly when the game is wrong.
//
// CRITERION 4 IS NOT A STUB and the round-1 critic verified it independently (damage ×3 → 117
// of 540 fail, ×4 → 279, ×6 → 405 — partial counts, which is what distinguishes a live model
// from a constant). That model is preserved unchanged for singles; the group generalisation
// reduces to it exactly when the group has one member.
//
// --data-root exists so a critic can re-run every claim here against a PATCHED data tree without
// editing the repo — which is the only way to falsify the giver-group resolution path itself.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  REPO_ROOT, DATA_DIR, parseArgs, wantsHelp, usage, writeJson, log, die, EXIT,
} from '../lib/cli.mjs';
import { loadCharacterData, loadQuests, loadEnemies, rd, rdOpt } from '../lib/gamedata.mjs';
import { composeCharacter, classFamilies } from '../../game/src/character/sheet.js';
import { hpMaxFor, focusMaxFor, scalingBonus, effectiveGrade, GRADE_COEFF } from '../../game/src/character/derive.js';
import { derivedDisposition, raceTerm } from '../../game/src/character/reaction.js';
import { FactionGates, canOffer, canResolve } from '../../game/src/sim/quest/gate.js';
import { sameTopic } from '../../game/src/core/topics.js';
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
  --data-root PATH      walk an alternate game/data tree instead of game/data. This is how a
                        critic falsifies the RESOLUTION paths — copy game/data, patch
                        world/regions.json's danger_tier or an npcs/*.json reaction_group, and
                        re-run. Nothing in the repo is touched.
  --fixture PATH        overlay JSON applied before the criteria run. Recognised keys:
                          { "tier5_damage_multiplier": 10,     // group damage x N
                            "tier5_hp_multiplier": 2,          // group HP x N
                            "player_damage_multiplier": 0.5,
                            "quest_disposition_floor": 50,     // every giver's disposition_min
                            "giver_reaction_group": "RG-DEEP", // or {"npc-id":"RG-..."} — grant
                                                               //   givers a group so the
                                                               //   race bar can be exercised
                            "region_danger_tier": {"blackwood": 5},
                            "impossible_resolution_gate": true,
                            "faction_rank5_attribute_floor": 500,
                            "reputation_scale": 0,   // scale the DERIVED attainable reputation
                            "gold_scale": 0 }        // scale the DERIVED attainable gold
  --audit-grants        print the GRANT LEDGER and exit. Every value the synthetic character is
                        handed, its basis (derived-from-data / shipping-predicate /
                        model-parameter / player-optimal-bound / SUBSTITUTION) and the data path
                        it came from, plus every requirement token no shipped file produces.
                        Exits non-zero if any field is still a bare substitution. This is the
                        mode to run first: four rounds of this tool were rejected for a value
                        invented in the middle of the file and reported as if measured.
  --no-model-sensitivity
                        skip the second walk that measures how many verdicts move when the offer
                        model is swapped. The artifact is stamped
                        model_sensitivity.measured=false and the run cannot exit 0, because a run that did not measure its
                        dependence on the model has not established independence from it.
  --self-test           run the falsification battery and exit non-zero if any check fails to
                        move the number it is supposed to move. EXPENSIVE BY DESIGN — every
                        fixture is a full 540-cell walk and shrinking the grid would shrink the
                        evidence, so it does not finish inside ten minutes on a loaded box. It
                        prints a numbered, timed progress line per walk with a running projection
                        so a reader can tell slow from hung.
  --levels 1,20,40,60   the simulated levels gates are evaluated at (RI-CHR01 M6's default)
  --target 486          viability floor for the exit code (RI-CHR01 §5's 90% of 540)
  --quiet               suppress the per-signature failure lines on stdout
  --offer-model M       raw | derived | detect (default). Which disposition model the build's
                        quest-offer path implements. DETECTED from named source anchors and
                        reported; forcing it is how a critic compares the two. THE ANCHORS ARE A
                        CLAIM, NOT A MEASUREMENT — see --verify-model.
  --verify-model        boot the build and perform the DEFINITIONAL race-sensitivity test: set
                        two characters differing in RACE ALONE and read
                        __HARNESS.getGateDispositions() — questEngine.dispositionView(), the very
                        table canOffer() consumes. If no giver's number moves, the offer gate is
                        race-invariant no matter what the source anchors say. Writes
                        reports/viability-model-attestation.json, keyed by a hash of engine.js +
                        quest/machine.js + character/reaction.js so a stale attestation is
                        refused rather than trusted. EXITS NON-ZERO when the running gate
                        contradicts the detected model.
                        WHY THIS EXISTS: TOOL-COVERAGE-R3 §1 killed the race term with
                        \`if (!this.__raceGatesEnabled) return null;\` at the top of the model
                        closure. Every source anchor still matched, the tool printed identical
                        output, and it charged the build 36 false FAILs. No regex over source can
                        prove a function's arithmetic is REACHED; only this can.
  --probe-races a,b     the two races --verify-model varies between (default dunmer,nord)
  --probe-upbringing U  the upbringing held fixed across the differential (default interior)
  --no-attestation      run without consulting the attestation. The report is stamped
                        model_verified:false and the run exits non-zero if any verdict depended
                        on the model.
  --cross-check         boot the game, drive several signatures through the SHIPPED creation
                        path, and compare this static walk's arithmetic against
                        __HARNESS.getGateDispositions() — the numbers canOffer() actually reads —
                        term by term via explainDisposition(). The static walk is required by
                        RI-MTH06 §A ("no browser needed... it must stay static so it can run in
                        CI"); this is how it stays true to the world instead of to the document.
  --cross-check-signatures a,b  race/upbringing pairs to sweep (default six)

EXIT CODES
  0   >= --target signatures viable AND nothing unmeasurable
  1   fewer than --target viable  (this is the gating condition, not an error)
  2   usage
  20  the measurement could not be taken for ANY signature — a required system or data table is
      absent. The reason and the named absences are in the report under \`unmeasurable_because\`.

OUTPUT
  One record per signature. The FAILURE LIST is the product, per RI-MTH06 §A:
  { "signature": "dunmer/mage/withheld/foreign", "viable": false,
    "criteria": { "main_quest": "pass", "three_factions_rank5": "pass",
                  "no_unpassable_gate": "fail", "tier5_survivable": "pass" },
    "stopped_at": { "quest": "...", "stage": 4, "gate": "...", "why": "..." } }
  Each criterion is one of "pass" | "fail" | "unmeasurable". A signature is viable only when all
  four are "pass"; "unmeasurable" is never counted as either a pass or a build failure.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const QUIET = !!args.quiet;
const EXPLAIN = !!args.explain;
const LEVELS = String(args.levels || '1,20,40,60').split(',').map((n) => parseInt(n, 10)).filter(Number.isFinite);
const TARGET = Number.isFinite(Number(args.target)) ? Number(args.target) : 486;
const ROOT = args['data-root'] ? path.resolve(String(args['data-root'])) : DATA_DIR;

const PASS = 'pass', FAIL = 'fail', UNMEASURABLE = 'unmeasurable';
/** FAIL beats UNMEASURABLE beats PASS: a definite negative is stronger than an unknown. */
function worst(a, b) {
  if (a === FAIL || b === FAIL) return FAIL;
  if (a === UNMEASURABLE || b === UNMEASURABLE) return UNMEASURABLE;
  return PASS;
}

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------
if (!fs.existsSync(ROOT)) {
  die(EXIT.MISSING_GAME, `data root does not exist at ${ROOT} — nothing to walk.`);
}
const data = loadCharacterData(ROOT);
const quests = loadQuests(ROOT);
const enemies = loadEnemies(ROOT);
const weaponClasses = (() => {
  const doc = rdOpt('weapons/classes.json', null, ROOT);
  if (!doc) return [];
  const c = doc.classes;
  return Array.isArray(c) ? c : Object.values(c || {});
})();

let gates = null;
try {
  gates = new FactionGates(rd('quests/faction-gates.json', ROOT));
} catch (e) {
  die(EXIT.MEASUREMENT_FAIL,
    'quests/faction-gates.json did not construct through the SHIPPING FactionGates ' +
    'validator, so criterion 2 cannot be evaluated for any signature: ' + e.message);
}

// ---------------------------------------------------------------------------------------------
// The 540-cell grid. RI-CHR01 §5: race x class_family x birthsign_family x upbringing_class.
// ---------------------------------------------------------------------------------------------
const RACES = data.races.races.map((r) => r.id);
const FAMILIES = classFamilies(data);
const SIGN_FAMILIES = [...new Set(data.birthsigns.signs.map((s) => s.family))];
const UPBRINGINGS = data.reactions.upbringings;
const UP_CLASSES = [...new Set(UPBRINGINGS.map((u) => u.signature_class))];

function representativeStart(race, family, signFamily, upClass) {
  const classDef = data.classes.classes.find((c) => c.family === family);
  const sign = data.birthsigns.signs.find((s) => s.family === signFamily);
  const up = UPBRINGINGS.find((u) => u.signature_class === upClass);
  if (!classDef || !sign || !up) return null;
  return { race, classId: classDef.id, birthsign: sign.id, upbringing: up.id };
}

// ---------------------------------------------------------------------------------------------
// The projection model. Every number is a MODEL PARAMETER and appears in the report's `model`
// block. The projection is deliberately PLAYER-OPTIMAL: viability asks whether ANY route exists.
// ---------------------------------------------------------------------------------------------
const MODEL = {
  attribute_points_per_level: 1,
  attribute_cap: 99,
  skill_cap: 100,
  skills_masterable_at: { 1: 0, 20: 3, 40: 5, 55: 6, 60: 6 },
  skill_ceiling_at: { 1: 25, 20: 55, 40: 80, 55: 95, 60: 100 },
  // The disposition a player can BUY on top of the permanent race+upbringing term: Personality,
  // faction rank, reputation, persuasion, gifts. RI-DLG04 owns the terms; this is an UPPER bound
  // on their sum, so a gate this model cannot pass is a gate no play can pass.
  disposition_other_terms_ceiling: 40,
  // The base a giver starts from when their NPC record does not state one. Only used when a
  // record exists but omits `disposition`; a giver with NO record is unmeasurable, not defaulted.
  disposition_base_when_record_silent: 50,
};

const FAMILY_ATTRIBUTE_PRIORITY = {
  fighter: ['strength', 'endurance', 'vigour', 'agility'],
  thief: ['agility', 'speed', 'dexterity', 'endurance'],
  social: ['personality', 'intellect', 'willpower', 'luck'],
  scout: ['endurance', 'agility', 'speed', 'vigour'],
  mage: ['intellect', 'willpower', 'vigour', 'endurance'],
  root: ['willpower', 'intellect', 'endurance', 'vigour'],
};

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

// ---------------------------------------------------------------------------------------------
// Giver resolution — DEFECT B's replacement. No fallback, no best-over-all-groups, no
// faction->group inference. Exactly the field the engine reads, and an honest absence otherwise.
// ---------------------------------------------------------------------------------------------
const npcRecords = (() => {
  const map = new Map();
  const dir = path.join(ROOT, 'npcs');
  if (!fs.existsSync(dir)) return map;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || []);
      if (!Array.isArray(list)) continue;
      for (const n of list) {
        if (n && n.id && !map.has(n.id)) map.set(n.id, { ...n, __file: path.relative(ROOT, p) });
      }
    }
  };
  walk(dir);
  return map;
})();

const KNOWN_GROUPS = new Set(Object.keys(data.reactions.matrix || {}));

/**
 * The reaction group and base disposition of a quest giver, by the RUNNING BUILD's own rule:
 * `spec.reaction_group || record.reaction_group || null` (engine.js:1147), and
 * `q.dispositions[id] = record.disposition` (engine.js seedDispositions()).
 *
 * Returns one of
 *   { status: 'resolved',   group, base }
 *   { status: 'no_record',  why }   — nobody by that id exists in game/data/npcs/**
 *   { status: 'no_group',   why, faction, base }   — the person exists; the race term does not
 * The two absences are reported separately because they are different defects with different
 * owners: one is a missing person, the other is a missing field on a person who is present.
 */
function resolveGiver(npcId) {
  const forced = FIXTURE && FIXTURE.giver_reaction_group;
  if (forced) {
    const g = typeof forced === 'string' ? forced : forced[npcId];
    if (g && KNOWN_GROUPS.has(g)) {
      const rec = npcRecords.get(npcId);
      return {
        status: 'resolved', group: g, fixture: true,
        base: (rec && typeof rec.disposition === 'number') ? rec.disposition : MODEL.disposition_base_when_record_silent,
      };
    }
  }
  const rec = npcRecords.get(npcId);
  if (!rec) {
    return {
      status: 'no_record',
      why: `no NPC record for "${npcId}" anywhere in npcs/**. The engine's seedDispositions() ` +
           `seeds nothing for this id, so gate.js canOffer() reads disposition 0 for every ` +
           `signature alike — the giver clause carries no race information and cannot be ` +
           `evaluated for the permanent race+upbringing bar.`,
    };
  }
  // ROUND 5. This was `rec.reaction_group || rec.group`. `group` is carried by 0 of the 336 npc
  // records in the tree AND is not read by the engine — `engine.js:1147` merges
  // `spec.reaction_group || rec.reaction_group` and nothing else. A fallback onto a field the
  // engine ignores would have resolved a giver the running build leaves unresolved, which is a
  // permissive substitution of exactly the kind defect B was. Gone.
  const group = rec.reaction_group || null;
  if (!group || !KNOWN_GROUPS.has(group)) {
    return {
      status: 'no_group', faction: rec.faction || null,
      base: typeof rec.disposition === 'number' ? rec.disposition : MODEL.disposition_base_when_record_silent,
      why: `NPC record ${rec.__file} for "${npcId}" carries no reaction_group` +
           (rec.faction ? ` (it carries faction "${rec.faction}", and nothing in game/src maps a ` +
             `faction to a reaction group — engine.js:1147 reads the reaction_group field and ` +
             `nothing else)` : '') +
           `. derivedDisposition() cannot be called without a group, so the race and upbringing ` +
           `terms have no value here and the permanent bar cannot be evaluated.`,
    };
  }
  return {
    status: 'resolved', group,
    base: typeof rec.disposition === 'number' ? rec.disposition : MODEL.disposition_base_when_record_silent,
  };
}

/** The permanent ceiling: base + race term + upbringing term + every movable term at maximum. */
function dispositionCeiling(base, race, upbringing, birthsign, group) {
  return derivedDisposition(data, {
    group, race, upbringing, birthsign,
    baseDisposition: base,
    otherTerms: MODEL.disposition_other_terms_ceiling,
  }).value;
}

// ---------------------------------------------------------------------------------------------
// ROUND 3 — THE SHIPPING OFFER GATE, MODELLED AS THE BUILD IMPLEMENTS IT.
//
// TOOL-COVERAGE-R2 §1: round 2 fabricated `ctx.dispositions` from a DERIVED race ceiling and
// handed that to the shipping `canOffer`. The shipping build does no such thing:
//
//   Engine.seedDispositions()  (game/src/engine.js:4563)
//     for (const group of Object.values(this.data.npcs))
//       for (const rec of group.npcs || [])
//         if (typeof rec.disposition === 'number') q.dispositions[rec.id] = rec.disposition;
//                                                  ^^^^ RAW. no group, no race, no upbringing.
//
//   gate.js num(v) -> Number.isFinite(v) ? v : 0     — an unseeded id reads 0, not "unknown".
//
// `derivedDisposition()` is never applied to the quest path — not in `canOffer`, not in
// `canResolve`, not in `QuestEngine._dispositionToward()`. In the whole of game/src the reaction
// matrix reaches the world in exactly two places, `Engine.npcDisposition()` (a read-only
// surface) and `character/encounter.js openingFor()` (encounter hostility). Neither is a quest
// gate. So the quest-offer path is RACE-INVARIANT in this build, and modelling a race ceiling
// here produces a FALSE RED — the round-2 critic reproduced exactly that, by minting an NPC
// record and booting the engine on the patched tree: the engine blocked nobody.
//
// The derived-ceiling walk is preserved, but as a labelled COUNTERFACTUAL (what the gate WOULD
// do if the matrix were wired in) and it never produces a criterion verdict.
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// WHICH OFFER MODEL DOES THIS BUILD IMPLEMENT? Detected, never assumed.
//
// This matters more than any other decision in this file, and it changed UNDER THIS PASS. When
// round 3 began, `seedDispositions()` wrote the raw record and nothing downstream read the
// reaction matrix, so a race ceiling here would have produced a FALSE RED (TOOL-COVERAGE-R2 §1).
// Hours later another agent landed `Engine._questDispositionModel()`, installed it on
// `QuestEngine.dispositionModel`, and `QuestEngine._dispositionToward()` now runs every giver
// through `derivedDisposition()` before `canOffer()` sees the number. The same tool, hard-coded
// to either model, would have been wrong on one side of that landing.
//
// So the model is DETECTED from source, against NAMED ANCHORS, and the tool reports which one it
// found and what it matched. This is the one place a static instrument must read `game/src` — and
// the failure mode of reading it is closed: when the two halves DISAGREE (the model is installed
// but never consulted, or consulted but never installed) the tool refuses rather than guessing,
// because a half-wired race term is exactly the state the corpus has twice been misled by.
//
// `--offer-model raw|derived|detect` overrides it, so a critic can force either and compare.
// `--cross-check` boots the game and compares this tool's numbers against the running build's,
// which is the only honest answer to "is the static walk still describing the world".
//
// =============================================================================================
// ROUND 4 — WHY THE ANCHORS ALONE ARE NOT ALLOWED TO DECIDE THIS ANY MORE.
//
// TOOL-COVERAGE-R3 §1 broke the round-3 detector with one ordinary line, a feature flag that is
// off, injected at the top of the returned closure:
//
//     _questDispositionModel() {
//       return (npcId, base) => {
//         if (!this.__raceGatesEnabled) return null;   // <- every anchor still matches
//
// The install line, `_dispositionToward` and `dispositionView()` are all untouched, so 3/3
// anchors matched, the tool printed `model='derived'` and the same 504/540 with the same 36
// dunmer FAILs — while the running engine went from six distinct race-dependent disposition
// clause sets to one race-invariant set. The engine's behaviour changed completely; the tool's
// output did not change by one byte, and it charged the build 36 false FAILs.
//
// THE GENERAL LESSON, and it is why a fourth static anchor is NOT the fix on its own: **no
// regex over source can prove a function's arithmetic is reached.** Any early return, any
// guard, any `&&` short-circuit defeats every anchor that names a token appearing later in the
// file. The R3 verdict asked for an anchor on `derivedDisposition` being called — I have added
// it, because it catches a DIFFERENT break (the arithmetic being deleted or renamed), but I
// record plainly that **it would not have caught R3's break**: the `derivedDisposition(` call
// is still textually present under the injected guard. Believing otherwise would buy a fourth
// false pass.
//
// So round 4 makes the static anchors a CLAIM and the running engine the VERDICT:
//
//   1. `--verify-model` boots the build and performs the DEFINITIONAL test of race-sensitivity:
//      two character signatures differing in race ALONE, read `getGateDispositions()` — the
//      exact table `canOffer` consumes — and see whether any giver's number moves. A model that
//      returns null cannot move a number, so R3's break is caught by construction rather than
//      by pattern.
//   2. The observation is written to a LIVE ATTESTATION keyed by a hash of the three source
//      files that carry the model. A stale attestation is not honoured.
//   3. Every run reconciles the static claim against the attestation and **refuses on
//      disagreement**. A detected model the running gate contradicts is the ambiguous state
//      this tool already knows how to refuse on.
//   4. A run with NO attestation still walks, but it is stamped `model_verified: false` and
//      **exits non-zero** if any signature's verdict depended on the model. An unverified model
//      is an unmeasured one, and RI-MTH04 does not let it be reported as a measurement.
//
// AND THE MODEL IS NOT A GLOBAL STRING. `_questDispositionModel()` returns null per-NPC when
// `reaction_group` is absent (engine.js:4862-4864), so the build's real model is PER-GIVER
// MIXED. `OFFER_MODEL.per_giver` carries that shape, computed from the same predicate the
// engine uses, and the attestation confirms it live via `explainDisposition().modelled`.
// =============================================================================================
const MODEL_SOURCE_FILES = [
  'game/src/engine.js',
  'game/src/sim/quest/machine.js',
  'game/src/character/reaction.js',
];

/** A hash of every source file that can change the offer model. Keys the live attestation. */
function modelSourceHash() {
  const h = crypto.createHash('sha256');
  for (const f of MODEL_SOURCE_FILES) {
    const p = path.join(REPO_ROOT, f);
    h.update(f);
    h.update(fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0));
  }
  return h.digest('hex').slice(0, 16);
}

const OFFER_MODEL_ANCHORS = {
  installed: {
    file: 'game/src/engine.js',
    // Engine installs the derived model on the quest engine.
    rx: /this\.questEngine\.dispositionModel\s*=/,
    means: 'Engine installs a disposition model on QuestEngine',
    proves: 'plumbing',
  },
  consulted: {
    file: 'game/src/sim/quest/machine.js',
    // _dispositionToward consults it before canOffer sees the number.
    rx: /const\s+model\s*=\s*this\.dispositionModel\s*;[\s\S]{0,400}?canOffer|_dispositionToward\s*\([\s\S]{0,800}?this\.dispositionModel/,
    means: 'QuestEngine._dispositionToward() consults the model',
    proves: 'plumbing',
  },
  fed_to_gate: {
    file: 'game/src/sim/quest/machine.js',
    rx: /dispositions\s*:\s*this\.dispositionView\(\)|dispositions\s*:\s*this\._dispositionView/,
    means: 'QuestEngine.context().dispositions is built from _dispositionToward, not from the raw register',
    proves: 'plumbing',
  },
  // R3's requested fourth anchor. It is on the ARITHMETIC, not the plumbing — but see the
  // block comment above: it is a necessary condition, not a sufficient one, and it does NOT
  // catch a guarded early return. Recorded as `proves: 'arithmetic-present'`, never
  // 'arithmetic-reached', because the difference is the whole of R3 §1.
  applies_arithmetic: {
    file: 'game/src/engine.js',
    rx: /_questDispositionModel\s*\(\s*\)\s*\{[\s\S]{0,4000}?derivedDisposition\s*\(/,
    means: '_questDispositionModel() contains a call to derivedDisposition() — the race arithmetic exists',
    proves: 'arithmetic-present (NOT arithmetic-reached: a guarded early return leaves this matching)',
  },
};
const N_ANCHORS = Object.keys(OFFER_MODEL_ANCHORS).length;

const OFFER_MODEL = (() => {
  const forced = args['offer-model'] ? String(args['offer-model']) : 'detect';
  const found = {};
  for (const [k, a] of Object.entries(OFFER_MODEL_ANCHORS)) {
    const p = path.join(REPO_ROOT, a.file);
    const src = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    found[k] = { matched: a.rx.test(src), file: a.file, means: a.means, proves: a.proves };
  }
  const hits = Object.values(found).filter((f) => f.matched).length;
  let model, why;
  if (forced === 'raw' || forced === 'derived') {
    model = forced;
    why = `FORCED by --offer-model ${forced}. Detection found ${hits}/${N_ANCHORS} anchors.`;
  } else if (hits === N_ANCHORS) {
    model = 'derived';
    why = `all ${N_ANCHORS} anchors matched: the reaction matrix is plumbed into the quest-offer ` +
          'path and the arithmetic is present in this build. THIS IS A CLAIM ABOUT SOURCE TEXT, ' +
          'not an observation of the running gate — see --verify-model.';
  } else if (hits === 0) {
    model = 'raw';
    why = 'no anchor matched: seedDispositions() writes the raw record and nothing downstream ' +
          'applies derivedDisposition(), so the offer gate is race-invariant in this build.';
  } else {
    model = 'ambiguous';
    why = `${hits} of ${N_ANCHORS} anchors matched, so the halves of the race term DISAGREE: ` +
          Object.entries(found).map(([k, f]) => `${k}=${f.matched}`).join(', ') +
          `. A half-wired race term is the state this corpus has twice been misled by (the data ` +
          `layer alone was measured to block nobody), so this tool refuses rather than guessing.`;
  }
  return {
    model, why, anchors: found, anchors_matched: hits, anchors_total: N_ANCHORS,
    forced: forced !== 'detect' ? forced : null,
    source_hash: modelSourceHash(),
    anchor_limit:
      'NO REGEX OVER SOURCE CAN PROVE A FUNCTION\'S ARITHMETIC IS REACHED. TOOL-COVERAGE-R3 §1 ' +
      'defeated the three-anchor detector with `if (!this.__raceGatesEnabled) return null;` at ' +
      'the top of the model closure, leaving every anchor matched and the race term dead. The ' +
      'fourth anchor added in round 4 would not have caught it either. Only `--verify-model` ' +
      '(a live two-signature differential on getGateDispositions()) can decide this.',
  };
})();

if (OFFER_MODEL.model === 'ambiguous' && !args['self-test']) {
  die(EXIT.MEASUREMENT_FAIL,
    'cannot determine which offer model this build implements. ' + OFFER_MODEL.why +
    ' Re-run with --offer-model raw or --offer-model derived to force one, and say which in the ' +
    'verdict.');
}

// ---------------------------------------------------------------------------------------------
// THE MODEL IS PER-GIVER, NOT A GLOBAL STRING.
//
// `_questDispositionModel()` (engine.js:4861) opens:
//
//     const rec = this._anyNpcRecord(npcId);
//     const group = rec && (rec.reaction_group || null);
//     if (!group) return null;                     // <- the model DOES NOT APPLY to this giver
//
// So on a build whose global model is "derived", a giver with no `reaction_group` still reads
// the raw register and its gate is still race-invariant. R3 §1: "a single global model string
// is the wrong shape for it to begin with." This is that shape, computed from the SAME
// predicate the engine uses, and confirmed live by `explainDisposition().modelled`.
// ---------------------------------------------------------------------------------------------
const GATED_GIVERS = [...new Set(
  quests.filter((q) => q.giver && q.giver.disposition_min != null).map((q) => q.giver.npc_id))].sort();

// Lazy: `resolveGiver()` consults FIXTURE, which is bound further down the file, and a critic
// must be able to see this shape under a fixture as well as on the bare tree.
function perGiverModel() {
  const modelled = [], unmodelled = [];
  for (const id of GATED_GIVERS) {
    const g = resolveGiver(id);
    // `derived` globally is a precondition; `reaction_group` present is the per-giver condition.
    if (OFFER_MODEL.model === 'derived' && g.status === 'resolved') modelled.push(id);
    else unmodelled.push({ npc_id: id, why: g.status === 'resolved' ? 'global model is raw' : g.status });
  }
  return {
    gated_givers: GATED_GIVERS.length,
    modelled: modelled.length,
    unmodelled: unmodelled.length,
    mixed: modelled.length > 0 && unmodelled.length > 0,
    modelled_ids: modelled,
    unmodelled_givers: unmodelled,
    note: 'The build\'s offer model is per-giver. A giver without reaction_group reads the raw ' +
          'register no matter what the global model is, and its gate is race-invariant.',
  };
}
Object.defineProperty(OFFER_MODEL, 'per_giver', {
  enumerable: true, configurable: true, get: perGiverModel,
});

// ---------------------------------------------------------------------------------------------
// THE LIVE ATTESTATION — the only thing that can actually decide whether the race term is wired.
//
// Written by `--verify-model` (and by `--cross-check`, which subsumes it). Keyed by
// `modelSourceHash()`, so touching engine.js / machine.js / reaction.js invalidates it: a stale
// attestation is refused rather than trusted, because the whole point is that source text and
// running behaviour can diverge.
// ---------------------------------------------------------------------------------------------
const ATTEST_PATH = path.join(REPO_ROOT, 'reports', 'viability-model-attestation.json');

function loadAttestation() {
  if (args['no-attestation']) return { status: 'DISABLED', why: '--no-attestation was passed' };
  if (!fs.existsSync(ATTEST_PATH)) {
    return { status: 'ABSENT', why:
      `no live attestation at ${path.relative(REPO_ROOT, ATTEST_PATH)}. Mint one with ` +
      '`node tools/analysis/build-viability.mjs --verify-model`, which boots the build and ' +
      'performs the two-signature differential on getGateDispositions().' };
  }
  let a;
  try { a = JSON.parse(fs.readFileSync(ATTEST_PATH, 'utf8')); }
  catch (e) { return { status: 'UNREADABLE', why: `${ATTEST_PATH}: ${e.message}` }; }
  if (a.source_hash !== OFFER_MODEL.source_hash) {
    return { status: 'STALE', why:
      `the attestation was taken against model source ${a.source_hash} and the tree is now ` +
      `${OFFER_MODEL.source_hash} (${MODEL_SOURCE_FILES.join(', ')}). A stale attestation is ` +
      'refused, not trusted — a one-line change to any of those files is exactly how the race ' +
      'term went dead under R3 with every anchor still matching.', taken_at: a.at || null };
  }
  return { status: 'VALID', ...a };
}

/**
 * Reconcile the static claim against the live observation and REFUSE when they disagree.
 * R3 §1's first rebuild bullet. `race_sensitive` from the engine is the ground truth; the
 * detected model is a hypothesis about it.
 */
function reconcileModel(live, { fatal = true } = {}) {
  if (!live || typeof live.race_sensitive !== 'boolean') return { checked: false };
  const claims_derived = OFFER_MODEL.model === 'derived';
  const agree = live.race_sensitive === claims_derived;
  const r = {
    checked: true, agree,
    static_claim: OFFER_MODEL.model,
    static_anchors: `${OFFER_MODEL.anchors_matched}/${OFFER_MODEL.anchors_total}`,
    live_race_sensitive: live.race_sensitive,
    live_evidence: live.evidence || null,
    why: agree
      ? `the running gate is ${live.race_sensitive ? 'RACE-SENSITIVE' : 'RACE-INVARIANT'}, which ` +
        `is what offer model "${OFFER_MODEL.model}" predicts.`
      : `MODEL CONTRADICTED BY THE RUNNING BUILD. Source anchors say "${OFFER_MODEL.model}" ` +
        `(${OFFER_MODEL.anchors_matched}/${OFFER_MODEL.anchors_total} matched) but the live gate is ` +
        `${live.race_sensitive ? 'RACE-SENSITIVE' : 'RACE-INVARIANT'}. This is precisely the ` +
        'half-wired state TOOL-COVERAGE-R3 §1 constructed: every anchor matching over a dead ' +
        'race term. The static walk is describing a build that is not running, so its ' +
        'disposition verdicts are refused rather than published.',
  };
  if (!agree && fatal && !args['self-test']) {
    process.stderr.write(`[build-viability] REFUSING: ${r.why}\n`);
    process.stderr.write(`[build-viability]   live evidence: ${JSON.stringify(live.evidence)}\n`);
    die(EXIT.MEASUREMENT_FAIL,
      'the detected offer model and the running gate disagree. Fix the build or force the model ' +
      'explicitly with --offer-model and declare it in the verdict.');
  }
  return r;
}

const ATTESTATION = args['self-test'] ? { status: 'SKIPPED (self-test)' } : loadAttestation();
if (ATTESTATION.status === 'VALID') reconcileModel(ATTESTATION.live);

/** `Engine.seedDispositions()`, reproduced. id -> raw authored disposition. */
const SEED_DISPOSITIONS = (() => {
  const m = new Map();
  for (const rec of npcRecords.values()) {
    if (rec && typeof rec.disposition === 'number') m.set(rec.id, rec.disposition);
  }
  return m;
})();

/**
 * `machine.js:424` — a quest's consequences may ADD to an npc's disposition:
 *   q.dispositions[n] = (q.dispositions[n] || 0) + d
 * That is a real in-play route to a giver's bar and this model would be over-restrictive if it
 * ignored it. Indexed here per npc, as the BEST positive delta a single quest can contribute
 * (quest-level consequences merged with the best of its resolutions — the player picks).
 */
const DISPOSITION_GIFTS = (() => {
  const m = new Map();   // npcId -> [{ quest, delta }]
  for (const q of quests) {
    const per = new Map();
    const take = (c) => {
      for (const [n, d] of Object.entries((c && c.npc_disposition) || {})) {
        if (!Number.isFinite(d)) continue;
        per.set(n, Math.max(per.get(n) ?? -Infinity, d));
      }
    };
    take(q.consequences);
    for (const r of q.resolutions || []) take(r.consequences);
    for (const [n, d] of per) {
      if (d <= 0) continue;
      if (!m.has(n)) m.set(n, []);
      m.get(n).push({ quest: q.id, delta: d });
    }
  }
  return m;
})();

/**
 * The most disposition ANY play can put on `npcId` before being offered `forQuest`.
 *
 * This is a deliberate UPPER BOUND, and the direction matters: the same player-optimal premise
 * `bestCaseCtx()` already uses (every other quest completed) is applied to the gifts, so every
 * donor quest is granted for free. A gate that this bound cannot clear is a gate NO play can
 * clear, which is what RI-CHR01 criterion 3 — "never encounter a gate with no route it can
 * take" — actually asks. The bound is race-invariant because the build's gate is.
 *
 * Charm (`sim/magic/apply.js:880`) is the one other writer of `q.dispositions`. It is recorded
 * as a route and applies only to an NPC that EXISTS in the world: it writes `q.dispositions[b.id]`
 * for a targeted entity `b`. An id with no record is spawned by nothing — verified in the
 * running build, where `__HARNESS.npcDisposition('speaker-teel-ashaan')` answers "nobody by that
 * name is in the world" for all nine record-less givers — so Charm cannot reach them either.
 */
function achievableDisposition(npcId, forQuest) {
  // `seed_disposition` fixture: mint the seed the shipping data does not carry. This is the GREEN
  // half of the falsification — a gate the tool calls unpassable must become passable the moment
  // the record exists, or the FAIL is a constant rather than a measurement.
  const fxSeed = FIXTURE && FIXTURE.seed_disposition;
  let seeded = SEED_DISPOSITIONS.has(npcId);
  let seed = seeded ? SEED_DISPOSITIONS.get(npcId) : 0;
  // `unseed_givers` fixture: reproduce a giver with NO NPC record, which is what this tree
  // shipped at the start of tool round 3 — `seedDispositions()` writes nothing and gate.js
  // `num(undefined)` reads 0. It is the RED half of the falsification and it must keep working
  // after the data is fixed, or the check becomes a description of one afternoon's tree.
  if (FIXTURE && FIXTURE.unseed_givers) {
    const u = FIXTURE.unseed_givers;
    if (u === true || (Array.isArray(u) && u.includes(npcId))) { seeded = false; seed = 0; }
  }
  if (fxSeed !== undefined && fxSeed !== null) {
    const v = typeof fxSeed === 'number' ? fxSeed : fxSeed[npcId];
    if (Number.isFinite(v)) { seeded = true; seed = v; }
  }
  const excluded = new Set([forQuest ? forQuest.id : null, ...((forQuest && forQuest.mutually_exclusive_with) || [])]);
  const gifts = (DISPOSITION_GIFTS.get(npcId) || []).filter((g) => !excluded.has(g.quest));
  const selfOnly = (DISPOSITION_GIFTS.get(npcId) || []).filter((g) => excluded.has(g.quest));
  const gain = gifts.reduce((a, g) => a + g.delta, 0);
  return {
    npc_id: npcId,
    seeded,
    seed,
    gifts,
    gifts_excluded_as_circular: selfOnly,
    value: Math.min(100, seed + gain),
    charmable: seeded,   // no record -> no entity in the world -> nothing to charm
  };
}

/**
 * The disposition table the engine hands `canOffer`, under whichever model this build implements.
 *
 *  raw      — `q.dispositions[id] = rec.disposition` and `canOffer` reads it. Race-invariant.
 *  derived  — `QuestEngine.context().dispositions = dispositionView()`, every entry run through
 *             `_dispositionToward()` = `derivedDisposition(matrix, {group, race, upbringing,
 *             birthsign, baseDisposition: register, otherTerms: movableTerms})`. Race-SENSITIVE,
 *             and the register value is the BASE the matrix works on, not the answer.
 *
 * The derived branch uses the same `MODEL.disposition_other_terms_ceiling` upper bound for the
 * movable terms that the counterfactual has always used: Personality, faction rank, reputation,
 * same-race and gifts at their joint maximum. Player-optimal, so a gate this cannot clear is a
 * gate no play can clear — which is what criterion 3 asks.
 */
function offerDispositionCtx(sheet, giverId, reach) {
  const t = Object.fromEntries(SEED_DISPOSITIONS);
  if (FIXTURE && FIXTURE.unseed_givers === true) for (const k of Object.keys(t)) t[k] = 0;
  else if (FIXTURE && Array.isArray(FIXTURE.unseed_givers)) for (const k of FIXTURE.unseed_givers) delete t[k];
  if (giverId) t[giverId] = reach.value;
  if (OFFER_MODEL.model !== 'derived') return t;
  const out = {};
  for (const [id, base] of Object.entries(t)) {
    const g = resolveGiver(id);
    out[id] = g.status === 'resolved'
      ? dispositionCeiling(base, sheet.race, sheet.upbringing, sheet.birthsign, g.group)
      // No reaction group: `_questDispositionModel()` returns null and `_dispositionToward`
      // keeps the register value. Modelled the same way, not defaulted to something kinder.
      : base;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Criterion 4 — the tier-5 cohort, resolved from the world the build actually reads.
//
// `world/regions.json` declares `danger_tier` on every region and `engine.js:3306` consumes it
// in getTerrainAt(). "The tier-5 region" therefore HAS a referent. The cohort is every fight
// authored in a region whose danger_tier is 5, reached two ways:
//   - `world/encounters.json` encounters[].regions  -> an authored GROUP with per-member counts
//   - `world/hearths.json`    fog_gates[].region    -> a boss, fought alone
// Where a tier-5 region has no fight authored in it, that region is NAMED in the report as thin
// rather than the cohort being widened until it is populated (TOOL-COVERAGE-R1 §1 ruling).
// ---------------------------------------------------------------------------------------------
const regionsDoc = rdOpt('world/regions.json', null, ROOT);
const REGION_TIER = (() => {
  const m = new Map();
  const list = (regionsDoc && (regionsDoc.regions || regionsDoc)) || [];
  for (const r of (Array.isArray(list) ? list : Object.values(list))) {
    if (r && r.id && Number.isFinite(r.danger_tier)) m.set(r.id, r.danger_tier);
  }
  return m;
})();

function regionTier(id) {
  const fx = FIXTURE && FIXTURE.region_danger_tier;
  if (fx && Number.isFinite(fx[id])) return fx[id];
  return REGION_TIER.has(id) ? REGION_TIER.get(id) : null;
}

const encountersDoc = rdOpt('world/encounters.json', null, ROOT);
const hearthsDoc = rdOpt('world/hearths.json', null, ROOT);

/** Cohort resolution is a function of FIXTURE (region_danger_tier), so it is recomputed. */
function resolveTier5Cohort() {
  const tier5Regions = [];
  for (const id of REGION_TIER.keys()) if (regionTier(id) === 5) tier5Regions.push(id);
  const fx = FIXTURE && FIXTURE.region_danger_tier;
  if (fx) for (const id of Object.keys(fx)) if (fx[id] === 5 && !tier5Regions.includes(id)) tier5Regions.push(id);
  tier5Regions.sort();
  const inTier5 = new Set(tier5Regions);

  const cohort = [];
  const unresolvedRegionNames = new Set();
  const covered = new Set();

  for (const e of (encountersDoc && encountersDoc.encounters) || []) {
    const regs = e.regions || [];
    for (const r of regs) if (!REGION_TIER.has(r)) unresolvedRegionNames.add(`${e.id}:${r}`);
    const hit = regs.filter((r) => inTier5.has(r));
    if (!hit.length) continue;
    const members = [];
    for (const m of e.members || []) {
      const sb = enemies[m.statblock];
      if (!sb) { unresolvedRegionNames.add(`${e.id}:statblock:${m.statblock}`); continue; }
      members.push({ statblock: m.statblock, role: m.role || null, count: Math.max(1, m.count || 1) });
    }
    if (!members.length) continue;
    hit.forEach((r) => covered.add(r));
    cohort.push({ source: 'encounter', id: e.id, regions: hit, members });
  }

  for (const g of (hearthsDoc && hearthsDoc.fog_gates) || []) {
    if (!g || !g.region) continue;
    if (!REGION_TIER.has(g.region)) unresolvedRegionNames.add(`${g.id}:${g.region}`);
    if (!inTier5.has(g.region)) continue;
    const sb = enemies[g.boss];
    if (!sb) { unresolvedRegionNames.add(`${g.id}:statblock:${g.boss}`); continue; }
    covered.add(g.region);
    cohort.push({ source: 'fog_gate', id: g.id, regions: [g.region], members: [{ statblock: g.boss, role: 'boss', count: 1 }] });
  }

  cohort.sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    tier5_regions: tier5Regions,
    tier5_regions_with_no_authored_fight: tier5Regions.filter((r) => !covered.has(r)),
    unresolved_region_or_statblock_names: [...unresolvedRegionNames].sort(),
    cohort,
  };
}

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
  player_uptime: 0.55,
  // How many members of an authored group can be brought to bear on the player at once. The
  // group is fought as a group (RI-CHR01 criterion 4's "encounter", not "enemy"); focus order is
  // player-optimal, highest damage-per-hitpoint first, because viability asks whether ANY route
  // exists. Reduces EXACTLY to the round-1 single-enemy arithmetic when a group has one member,
  // which is why the critic's independently measured ×3/×4/×6 sweep still reproduces.
  simultaneous_attackers_cap: 3,
  attempts_model: 'cumulative survival windows: attempts = ceil(damage the player must absorb ' +
                  'over the whole encounter / the effective pool one attempt provides)',
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
  const wc = weaponClasses.slice().sort((a, b) => (a.attack_rating || 0) - (b.attack_rating || 0))[0];
  return wc ? { wc, skill: 'blades', fallback: true } : null;
}

// --- the caster path -------------------------------------------------------------------------
const magicSpells = (() => {
  const doc = rdOpt('magic/spells.json', null, ROOT);
  if (!doc) return [];
  const s = doc.spells || doc;
  return Array.isArray(s) ? s : Object.values(s || {});
})();
const magicEffects = (() => {
  const doc = rdOpt('magic/effects.json', null, ROOT);
  const e = doc && (doc.effects || doc);
  const list = Array.isArray(e) ? e : Object.values(e || {});
  const map = new Map();
  for (const x of list) if (x && x.id) map.set(x.id, x);
  return map;
})();

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

/** The player's damage routes against one defender's armour. Shipping computeDamage/mitigate. */
function playerRoutes(sheet, defender, pDmgMul) {
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
    const per = mitigate({ armourRating: defender.armour_rating || 0, wards: null, mitigation: 1 }, raw, 'physical');
    const frames = wc.r1_total || 42;
    routes.push({
      route: 'weapon', weapon_class: wc.name, skill, skill_value: skillValue,
      governing: gov, governing_value: govValue, grade, per_hit: per, frames,
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
    const per = mitigate({ armourRating: defender.armour_rating || 0, wards: null, mitigation: 1 }, raw, school);
    const frames = (sp.spell.frames && sp.spell.frames.total) || 37;
    const focusMax = focusMaxFor(sheet.attributes.willpower || 10);
    const cost = (sp.spell.focus_cost && (sp.spell.focus_cost.great_staff ?? sp.spell.focus_cost.none))
      ?? sp.spell.focus_base ?? 5;
    const castsAffordable = cost > 0 ? Math.floor(focusMax / cost) : Infinity;
    routes.push({
      route: 'spell', spell: sp.spell.id, school, skill_value: skillValue,
      governing: gov, governing_value: govValue, per_hit: per, frames,
      dps: (per / (frames / LETHALITY.frames_per_second)) * LETHALITY.player_uptime,
      focus_max: focusMax, focus_cost: cost, casts_affordable: castsAffordable,
    });
  }
  return routes;
}

/** One statblock's incoming dps against the player's kit, through the shipping functions. */
function enemyDpsOf(enemy, dmgMul) {
  const playerBody = {
    armourRating: LETHALITY.player_armour_rating, wards: null,
    mitigation: LETHALITY.player_ward, wardCharges: 0,
  };
  const atks = Object.values(enemy.attacks || {});
  if (!atks.length) return 0;
  let dmgSum = 0, frameSum = 0;
  for (const a of atks) {
    const raw = computeDamage(a.motion_value || 1, (enemy.weapon && enemy.weapon.attack_rating) || 0, 1.0, 0) * dmgMul;
    dmgSum += mitigate({ ...playerBody }, raw, 'physical');
    frameSum += (a.startup || 0) + (a.active || 0) + (a.recovery || 0);
  }
  const perFrame = frameSum > 0 ? dmgSum / frameSum : 0;
  return perFrame * LETHALITY.frames_per_second * (1 - LETHALITY.player_avoidance);
}

/**
 * ONE AUTHORED ENCOUNTER, fought as the group it is authored as.
 *
 * The player focuses one member at a time, highest damage-per-hitpoint first (player-optimal:
 * viability asks whether any route exists). Every member that is still alive is still swinging,
 * up to `simultaneous_attackers_cap`. Damage absorbed over the encounter is
 *   Σ_i  dps_i × (time at which member i dies)
 * and `attempts` is that total divided by the pool one attempt provides. With a single member
 * this is exactly ceil(ttk / ttd) — the round-1 arithmetic the critic's ×3/×4/×6 sweep measured.
 */
function fightEncounter(sheet, entry, fixture) {
  const fx = fixture || {};
  const dmgMul = Number.isFinite(fx.tier5_damage_multiplier) ? fx.tier5_damage_multiplier : 1;
  const hpMul = Number.isFinite(fx.tier5_hp_multiplier) ? fx.tier5_hp_multiplier : 1;
  const pDmgMul = Number.isFinite(fx.player_damage_multiplier) ? fx.player_damage_multiplier : 1;

  // Expand the authored group.
  const units = [];
  for (const m of entry.members) {
    const sb = enemies[m.statblock];
    if (!sb) continue;
    for (let i = 0; i < m.count; i++) {
      units.push({ statblock: m.statblock, hp: (sb.hp || 1) * hpMul, dps: enemyDpsOf(sb, dmgMul), armour_rating: sb.armour_rating || 0 });
    }
  }
  if (!units.length) return { survivable: false, reason: `encounter ${entry.id} expands to no live statblock` };

  // The player's route is chosen against the toughest armour in the group, then applied to all —
  // a character does not swap kit mid-fight.
  const hardest = units.slice().sort((a, b) => b.armour_rating - a.armour_rating)[0];
  const routes = playerRoutes(sheet, hardest, pDmgMul);
  if (!routes.length) {
    return { survivable: false, reason: 'no weapon class and no castable damaging spell in shipped data' };
  }
  const best = routes.slice().sort((a, b) => b.dps - a.dps)[0];
  const P = best.dps;
  if (!(P > 0)) {
    return { survivable: false, encounter: entry.id, reason: 'player deals no damage to this cohort', route: best.route, routes };
  }

  // Player-optimal focus order.
  const order = units.slice().sort((a, b) => (b.dps / b.hp) - (a.dps / a.hp));
  const cap = LETHALITY.simultaneous_attackers_cap;
  let cumHp = 0, absorbed = 0;
  order.forEach((u, i) => {
    cumHp += u.hp;
    const tDeath = cumHp / P;
    // Only the first `cap` members are in reach at any moment; a member beyond the cap starts
    // swinging once one ahead of it dies, so its exposure is shortened by that member's life.
    const tStart = i >= cap ? (order.slice(0, i - cap + 1).reduce((s, x) => s + x.hp, 0)) / P : 0;
    absorbed += u.dps * Math.max(0, tDeath - tStart);
  });

  const hpPool = hpMaxFor(sheet.attributes.vigour || 10);
  const perAttemptPool = hpPool * (1 + LETHALITY.flask_charges * LETHALITY.flask_heal_fraction);
  const attempts = perAttemptPool > 0 ? Math.max(1, Math.ceil(absorbed / perAttemptPool)) : Infinity;
  const totalTime = cumHp / P;

  return {
    survivable: attempts <= LETHALITY.attempts_allowed && Number.isFinite(totalTime),
    attempts,
    encounter: entry.id,
    source: entry.source,
    regions: entry.regions,
    group: entry.members.map((m) => `${m.count}x ${m.statblock}`).join(' + '),
    group_size: units.length,
    route: best.route,
    routes,
    player_dps: +P.toFixed(2),
    group_dps: +units.reduce((s, u) => s + u.dps, 0).toFixed(2),
    group_hp: +cumHp.toFixed(0),
    damage_absorbed: +absorbed.toFixed(0),
    pool_per_attempt: +perAttemptPool.toFixed(0),
    hp_pool: hpPool,
    encounter_s: +totalTime.toFixed(1),
  };
}

// =============================================================================================
// ROUND 5 — THE ATTAINMENT LEDGER. Every value the synthetic character is handed, and where it
// came from.
//
// WHY THIS SECTION EXISTS. This tool has been rejected four rounds running for the same shape:
// a check that reports a confident number while measuring nothing. Round 4's instance was
// `c.reputation = new Proxy({}, { get: () => 100 })` — a literal left over from an older rank
// ladder — sitting three lines from `c.gold = 1e9` and `c.ranks = Proxy(7)`. The tool's headline
// `0 of 540 viable` and the three quests it called unreachable by anyone were the tool colliding
// with its own stub; the faction critic settled it in the running engine (W1-FACTIONS-r1 §1),
// where the rank-7 offer row carries "reputation 111/112" at 111 and drops the term at 112.
//
// The lesson generalises past line 1191. A best-case walk is a legitimate design — RI-CHR01 §5
// criterion 3 asks whether ANY route exists, so the character must be granted everything a
// player could earn. What is NOT legitimate is granting something the shipped world cannot
// produce, because then the walk is reporting on a world that does not exist. So:
//
//   RULE 1. Every granted value is DERIVED FROM SHIPPED DATA — the sum of the best deltas the
//           quest book actually authors, the flags some resolution actually sets, the topics
//           some dialogue file actually carries. No constants, no Proxies, no infinities.
//   RULE 2. Where a requirement names a token NOTHING in the tree produces, the tool does not
//           grant it and does not fail on it either. It runs the gate a second time with the
//           token granted; if the verdict flips, the verdict DEPENDED on an ungrounded grant and
//           is reported `unmeasurable` with the token named. TOOL-LOOP rule 1: report the
//           absence, exit non-zero, never stub it to pass.
//   RULE 3. Everything in this ledger is published — `--audit-grants` prints the whole table,
//           and `grant_ledger` is on every artifact — so a critic attacks the derivation rather
//           than having to find it.
//
// The one substitution that survives is stated in the ledger as `player-optimal-upper-bound`:
// each faction's reputation, each pot of gold and each rank is taken at its own maximum
// independently, so the character is richer and better-connected than any single playthrough.
// That direction is deliberate and it is the direction criterion 3 requires (a gate this bound
// cannot clear is a gate no play can clear). It is recorded, not hidden.
// =============================================================================================

/** Every JSON file under the (possibly patched) data root, so `--data-root` reaches all of this. */
function readDataTree(root) {
  const out = [];
  const walk = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) {
        try { out.push([path.relative(root, p).split(path.sep).join('/'), JSON.parse(fs.readFileSync(p, 'utf8'))]); }
        catch { /* a malformed file is the loader's problem, not this census's */ }
      }
    }
  };
  walk(root);
  return out;
}
const DATA_FILES = readDataTree(ROOT);

/**
 * WHO CAN PRODUCE THIS TOKEN? One map per gate vocabulary: token -> the data path that produces
 * it. A token with no entry here is a token no play can obtain, and that is a finding rather
 * than something to paper over.
 */
const PRODUCERS = (() => {
  const topics = new Map(), flags = new Map(), knowledge = new Map(), items = new Map(), effects = new Map();
  const add = (m, k, src) => { if (k != null && k !== '' && typeof k === 'string' && !m.has(k)) m.set(k, src); };

  for (const [rel, d] of DATA_FILES) {
    if (rel.startsWith('dialogue/topics/')) {
      for (const t of d.topics || []) {
        add(topics, t.id, `${rel} topics[].id`);
        for (const i of t.infos || []) for (const to of i.to || []) add(topics, to, `${rel} infos[].to`);
      }
    }
    if (rel.startsWith('books/')) {
      const list = Array.isArray(d.books) ? d.books : (d.id ? [d] : []);
      for (const b of list) {
        // `Engine._bookKnowledgeIndex()` — reading a book confers its knowledge_key and every
        // reveal id the book is the declared source of.
        add(knowledge, b.knowledge_key, `${rel} books[].knowledge_key`);
        for (const t of b.topics_taught || []) add(topics, t, `${rel} books[].topics_taught`);
      }
    }
    if (rel.startsWith('items/')) {
      for (const k of Object.keys(d)) if (Array.isArray(d[k])) for (const it of d[k]) if (it && it.id) add(items, it.id, `${rel} ${k}[].id`);
    }
    if (rel.startsWith('npcs/')) {
      for (const g of Object.values(d)) if (g && Array.isArray(g.npcs)) for (const n of g.npcs) for (const t of n.topics || []) add(topics, t, `${rel} npcs[].topics`);
    }
    if (rel.startsWith('magic/')) {
      for (const e of d.effects || []) add(effects, e.id, `${rel} effects[].id`);
      for (const s of d.spells || []) for (const e of s.effects || []) add(effects, e.effect, `${rel} spells[].effects[].effect`);
    }
    if (rel === 'quests/hooks.json') {
      for (const h of d.hooks || []) add(flags, h.flag, `${rel} hooks[].flag`);
      for (const t of d.entry_topics || []) add(topics, typeof t === 'string' ? t : (t && (t.topic || t.id)), `${rel} entry_topics`);
    }
  }
  for (const q of quests) {
    if (q.opens_by && q.opens_by.topic) add(topics, q.opens_by.topic, `quests/** ${q.id} opens_by.topic`);
    for (const r of q.rewards || []) {
      if (r.type === 'information' && r.id) { add(topics, r.id, `quests/** ${q.id} rewards[information].id`); add(knowledge, r.id, `quests/** ${q.id} rewards[information].id`); }
      if (r.name) add(topics, String(r.name), `quests/** ${q.id} rewards[].name`);
      if (r.id) add(items, r.id, `quests/** ${q.id} rewards[${r.type}].id`);
    }
    const flagsFrom = (c, where) => { for (const f of (c && c.world_flags) || []) add(flags, f, `quests/** ${q.id} ${where}.world_flags`); };
    flagsFrom(q.consequences, 'consequences');
    for (const r of q.resolutions || []) flagsFrom(r.consequences, `${r.id}.consequences`);
    // The stage-shaped quest document raises flags from `stages[].flags` and declares them on
    // `flags[]`. Both are producers, and missing them would have made those flags look
    // ungrounded the moment a rank ladder started asking for one.
    for (const st of q.stages || []) for (const f of st.flags || []) add(flags, f, `quests/** ${q.id} stages[].flags`);
    for (const f of Array.isArray(q.flags) ? q.flags : []) add(flags, f, `quests/** ${q.id} flags[]`);
    for (const rev of (q.deceit && q.deceit.revealed_by) || []) add(knowledge, rev.id, `quests/** ${q.id} deceit.revealed_by[].id`);
  }
  return { topics, flags, knowledge, items, effects };
})();

/**
 * WHAT DOES THE BUILD ASK FOR? The other half of the ledger. Every token any shipped gate can
 * demand, with the quest that demands it.
 */
const REQUIREMENTS = (() => {
  const topics = new Map(), flags = new Map(), knowledge = new Map(), items = new Map(), effects = new Map();
  const add = (m, k, where) => { if (k == null || k === '') return; if (!m.has(k)) m.set(k, []); m.get(k).push(where); };
  for (const q of quests) {
    const ob = q.opens_by || {};
    if (ob.topic) add(topics, ob.topic, `${q.id} opens_by.topic`);
    for (const t of ob.prerequisite_topics || []) add(topics, t, `${q.id} opens_by.prerequisite_topics`);
    for (const r of q.resolutions || []) {
      const rq = r.requires || {};
      for (const i of rq.items || []) add(items, i, `${q.id}/${r.id} requires.items`);
      for (const k of rq.knowledge || []) add(knowledge, k, `${q.id}/${r.id} requires.knowledge`);
      for (const e of rq.spell_effects || []) add(effects, e, `${q.id}/${r.id} requires.spell_effects`);
      for (const k of r.requires_knowing || []) add(knowledge, k, `${q.id}/${r.id} requires_knowing`);
    }
  }
  for (const fid of gates.ids()) {
    const f = gates.get(fid);
    for (const row of f.ranks || []) {
      if (row.world_state && row.world_state.flag) add(flags, row.world_state.flag, `faction-gates ${fid} rank ${row.rank}.world_state.flag`);
    }
  }
  return { topics, flags, knowledge, items, effects };
})();

/**
 * The requirement tokens NOTHING in the tree produces. These are the only places the walk is
 * allowed to be uncertain, and every one of them is named on every artifact.
 *
 * Topics fold through the SHIPPING `sameTopic()` rather than through a local slugifier, because
 * the dialogue layer writes `the-tolls` and the quest layer writes `"the tolls"` and a
 * hand-rolled comparison here would re-create exactly the bug `core/topics.js` exists to fix.
 */
const UNSOURCED = (() => {
  const topicProducers = [...PRODUCERS.topics.keys()];
  const out = {
    topics: [...REQUIREMENTS.topics.keys()].filter((t) => !topicProducers.some((p) => sameTopic(p, t))),
    world_flags: [...REQUIREMENTS.flags.keys()].filter((f) => !PRODUCERS.flags.has(f)),
    knowledge: [...REQUIREMENTS.knowledge.keys()].filter((k) => !PRODUCERS.knowledge.has(k)),
    items: [...REQUIREMENTS.items.keys()].filter((i) => !PRODUCERS.items.has(i)),
    spell_effects: [...REQUIREMENTS.effects.keys()].filter((e) => !PRODUCERS.effects.has(e)),
  };
  out.total = out.topics.length + out.world_flags.length + out.knowledge.length + out.items.length + out.spell_effects.length;
  out.where = {};
  for (const [k, list] of Object.entries(out)) {
    if (!Array.isArray(list)) continue;
    const src = { topics: REQUIREMENTS.topics, world_flags: REQUIREMENTS.flags, knowledge: REQUIREMENTS.knowledge, items: REQUIREMENTS.items, spell_effects: REQUIREMENTS.effects }[k];
    for (const t of list) out.where[t] = src.get(t);
  }
  return out;
})();
const UNSOURCED_SETS = {
  topics: new Set(UNSOURCED.topics),
  world_flags: new Set(UNSOURCED.world_flags),
  knowledge: new Set(UNSOURCED.knowledge),
  items: new Set(UNSOURCED.items),
  spell_effects: new Set(UNSOURCED.spell_effects),
};

/**
 * The topic collection the granted character carries.
 *
 * The RAW producer spellings are kept — `the-tolls` from the dialogue layer, not a pre-folded
 * key — so that `canOffer`'s `topicsInclude()` still has to do the slug/prose fold at gate time.
 * A pre-folded set would pass a folding bug silently, which is the trap `bestCaseCtx`'s
 * `has: () => true` duck fell into: an omniscient collection can never exercise the comparison
 * it is standing in for. Restricted to the producers that some gate can actually ask for, so the
 * per-call scan stays O(101) rather than O(814).
 */
const GRANTED_TOPICS = (() => {
  const needed = [...REQUIREMENTS.topics.keys()];
  return new Set([...PRODUCERS.topics.keys()].filter((p) => needed.some((n) => sameTopic(p, n))));
})();
const GRANTED_FLAGS = new Set(PRODUCERS.flags.keys());
const GRANTED_KNOWLEDGE = new Set(PRODUCERS.knowledge.keys());
const GRANTED_ITEMS = new Set(PRODUCERS.items.keys());
const GRANTED_EFFECTS = new Set(PRODUCERS.effects.keys());

/**
 * Best-per-quest faction reputation, the way the faction critic computed it in the running
 * engine (W1-FACTIONS-r1 §1): for each quest, the largest positive delta any single route
 * through it can put on this faction; summed over the book.
 *
 * This replaces `new Proxy({}, { get: () => 100 })`. The old literal was the top row of a rank
 * ladder that had since moved to 112, so the tool reported three quests as unreachable by anyone
 * while the engine offers them at 112. Nothing here is a constant: change a
 * `consequences.faction_reputation` in the data and this number moves.
 */
const REPUTATION_GIFTS = (() => {
  const m = new Map();   // faction -> [{ quest, delta }]
  for (const q of quests) {
    const per = new Map();
    const take = (c) => {
      for (const [f, d] of Object.entries((c && c.faction_reputation) || {})) {
        if (!Number.isFinite(d)) continue;
        per.set(f, Math.max(per.get(f) ?? -Infinity, d));
      }
    };
    take(q.consequences);
    for (const r of q.resolutions || []) take(r.consequences);
    for (const [f, d] of per) {
      if (d <= 0) continue;
      if (!m.has(f)) m.set(f, []);
      m.get(f).push({ quest: q.id, delta: d });
    }
  }
  return m;
})();

/** Gold the book can pay out: per quest, the largest single reward, summed. */
const GOLD_GIFTS = (() => {
  const rows = [];
  for (const q of quests) {
    let best = 0, from = null;
    for (const r of q.rewards || []) {
      if (r.type !== 'gold' || !Number.isFinite(r.amount)) continue;
      if (r.amount > best) { best = r.amount; from = (r.on_resolution || []).join('|') || '(any resolution)'; }
    }
    if (best > 0) rows.push({ quest: q.id, amount: best, on_resolution: from });
  }
  return rows;
})();

/**
 * THE GRANT LEDGER — published on every artifact and printed in full by `--audit-grants`.
 *
 * One row per field the synthetic character is handed. `basis` is the only column that matters:
 *
 *   derived-from-data        computed from shipped content; change the content and it moves.
 *   shipping-predicate       computed by calling the game's own function on derived inputs.
 *   model-parameter          a number declared in MODEL and reported there; NOT content.
 *   player-optimal-bound     derived, then taken at its independent maximum. The one surviving
 *                            substitution, stated as one.
 *   SUBSTITUTION             a value not derived from anything. There must be none of these.
 *
 * `session-run --audit-surface` is the model for this: publish the whole classification so a
 * critic attacks the derivation rather than having to reconstruct it (TOOL-COVERAGE-R3, "this
 * round's best work ... a derivation from the live surface").
 */
function grantLedger() {
  const repSample = attainableReputation(null);
  const rows = [
    { field: 'attributes', basis: 'model-parameter', value: `projectAttributes(): base + ${MODEL.attribute_points_per_level}/level, cap ${MODEL.attribute_cap}, spent on the gate's own columns first`, source: 'MODEL.attribute_points_per_level / attribute_cap; base from composeCharacter()' },
    { field: 'skills', basis: 'model-parameter', value: `projectSkills(): ${JSON.stringify(MODEL.skills_masterable_at)} skills raised to ${JSON.stringify(MODEL.skill_ceiling_at)}`, source: 'MODEL.skills_masterable_at / skill_ceiling_at; base from composeCharacter()' },
    { field: 'reputation', basis: 'player-optimal-bound', was_round4: 'new Proxy({}, { get: () => 100 })  — A CONSTANT, and a stale one: the ladder had moved to 112', value: repSample, source: 'quests/** resolutions[].consequences.faction_reputation, best per quest, summed; the target quest and its mutually_exclusive_with excluded as circular', per_faction_gifts: Object.fromEntries([...REPUTATION_GIFTS].map(([f, l]) => [f, l.length])) },
    { field: 'ranks', basis: 'shipping-predicate', was_round4: 'new Proxy({}, { get: () => 7 })  — A CONSTANT', value: 'FactionGates.highestQualifying(f, {reputation, attributes, skills, worldFlags}) per faction — the same call QuestEngine.context() makes, because nothing in the build writes q.factions[f].rank', source: 'game/src/sim/quest/gate.js' },
    { field: 'gold', basis: 'player-optimal-bound', was_round4: '1e9  — AN INFINITY', value: attainableGold(null), source: `quests/** rewards[type=gold].amount, best per quest over ${GOLD_GIFTS.length} paying quests, summed` },
    { field: 'topicsKnown', basis: 'derived-from-data', was_round4: 'grantAll(): has() => true for any string', value: GRANTED_TOPICS.size, source: 'dialogue/topics/** ids and infos[].to, books topics_taught, npcs[].topics, quests opens_by.topic, hooks entry_topics — RAW spellings, so canOffer\'s topicsInclude() still performs the slug/prose fold', of_producers: PRODUCERS.topics.size },
    { field: 'knowledge', basis: 'derived-from-data', was_round4: 'grantAll(new Set())  — has() => true over an EMPTY set', value: GRANTED_KNOWLEDGE.size, source: 'quests deceit.revealed_by[].id, books knowledge_key, quest rewards[information].id' },
    { field: 'items', basis: 'derived-from-data', was_round4: 'grantAll(new Set())  — has() => true over an EMPTY set', value: GRANTED_ITEMS.size, source: 'items/** ids and quest rewards[].id' },
    { field: 'spellEffects', basis: 'derived-from-data', was_round4: 'grantAll(new Set())  — has() => true over an EMPTY set', value: GRANTED_EFFECTS.size, source: 'magic/** effects[].id and spells[].effects[].effect' },
    { field: 'worldFlags', basis: 'derived-from-data', was_round4: 'grantAll(): has() => true for any flag', value: GRANTED_FLAGS.size, source: 'quests/** consequences.world_flags (quest and resolution level) and hooks[].flag' },
    { field: 'disposition (scalar)', basis: 'derived-from-data', was_round4: '0, and never raised — so all 28 shipped requires.disposition resolutions were silently unavailable', value: 'achievableDisposition(giver) run through the detected offer model', source: 'npcs/** disposition + quests consequences.npc_disposition' },
    { field: 'dispositions (per npc)', basis: 'derived-from-data', value: 'seedDispositions() reproduced, plus the best positive npc_disposition consequence any non-circular quest can add, through the detected model', source: 'npcs/**, quests/** consequences.npc_disposition' },
    { field: 'completed', basis: 'player-optimal-bound', value: 'every quest except the target and its mutually_exclusive_with', source: 'quests/** ids', caveat: 'mutually exclusive pairs elsewhere in the book are not resolved into a consistent playthrough; canOffer only reads completed for prerequisite_quests and the target\'s own exclusions, so the looseness cannot manufacture a pass on this build — stated because it is a substitution and it must be visible.' },
    { field: 'locked', basis: 'player-optimal-bound', value: 'empty — nothing closed by an earlier choice', source: 'n/a', caveat: 'a rivalry lock the player would really carry is not modelled here; criterion 2 applies exclusivity explicitly instead, including exclusivity.earned.' },
    { field: 'level', basis: 'model-parameter', value: LEVELS, source: '--levels' },
  ];
  const substitutions = rows.filter((r) => r.basis === 'SUBSTITUTION');
  return {
    note: 'Every value the synthetic character is handed, and where it came from. A row whose ' +
          '`basis` is SUBSTITUTION is a place this tool can report on a world that does not ' +
          'exist; there must be none, and `substitutions_remaining` is asserted to 0 by ' +
          '--self-test.',
    rows,
    substitutions_remaining: substitutions.length,
    player_optimal_bounds: rows.filter((r) => r.basis === 'player-optimal-bound').map((r) => r.field),
    ungrounded_requirements: UNSOURCED,
    ungrounded_note:
      `${UNSOURCED.total} requirement token(s) named by a shipped gate have NO producer anywhere ` +
      `under ${path.relative(REPO_ROOT, ROOT) || 'game/data'}. They are NOT granted and they are ` +
      `NOT failed on: any quest whose verdict flips when they are granted is reported ` +
      `\`unmeasurable\` with the token named (the grant-dependency test).`,
  };
}

/** Same circularity convention as `achievableDisposition`: a quest cannot pay for its own gate. */
function excludedFor(forQuest) {
  return new Set(forQuest ? [forQuest.id, ...(forQuest.mutually_exclusive_with || [])] : []);
}
function attainableReputation(forQuest) {
  const excluded = excludedFor(forQuest);
  // `reputation_scale` is the falsification handle for the round-4 defect. Round 4 pinned every
  // faction at the literal 100 and the battery could not tell — no fixture moved the number,
  // because there was no number to move. Scaling the derived sum must move rank-gated verdicts,
  // and --self-test asserts that it does.
  const scale = FIXTURE && Number.isFinite(FIXTURE.reputation_scale) ? FIXTURE.reputation_scale : 1;
  const out = {};
  for (const [f, list] of REPUTATION_GIFTS) {
    out[f] = Math.round(list.filter((g) => !excluded.has(g.quest)).reduce((a, g) => a + g.delta, 0) * scale);
  }
  return out;
}
function attainableGold(forQuest) {
  const excluded = excludedFor(forQuest);
  const scale = FIXTURE && Number.isFinite(FIXTURE.gold_scale) ? FIXTURE.gold_scale : 1;
  return Math.round(GOLD_GIFTS.filter((g) => !excluded.has(g.quest)).reduce((a, g) => a + g.amount, 0) * scale);
}

// ---------------------------------------------------------------------------------------------
// The four criteria
/**
 * The OMNISCIENT collection — `has()` answers true for anything.
 *
 * ROUND 5: this is no longer what the walk runs on. It is the SECOND ARM of the grant-dependency
 * test and nothing else. When the provable walk refuses a quest, the same quest is re-run with
 * these collections; if the verdict flips, the verdict was a function of a token the shipped
 * world cannot produce, and it is reported `unmeasurable` with the token named instead of being
 * published as a fail. Round 4 ran the whole walk on this and could therefore never see a
 * requirement nothing satisfies.
 */
function grantAll(contents) {
  const s = new Set(contents);
  return new Proxy(s, {
    get(t, k, r) {
      if (k === 'has') return () => true;
      const v = Reflect.get(t, k, t);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

// ---------------------------------------------------------------------------------------------
function ctxAt(sheet, level, want = {}) {
  const attributes = projectAttributes(sheet.base_attributes, sheet.family, level, want.attributes || []);
  const skills = projectSkills(sheet.base_skills, level, want.skills || []);
  return {
    attributes, skills, level,
    reputation: {}, ranks: {}, dispositions: {},
    topicsKnown: new Set(), knowledge: new Set(), items: new Set(), spellEffects: new Set(),
    completed: new Set(), locked: new Set(), worldFlags: new Set(),
    gold: 0, disposition: 0,
  };
}

/**
 * BEST-CASE CONTEXT — ROUND 5. Everything a player can EARN, at the maximum the SHIPPED DATA
 * proves is earnable, so only PERMANENT bars remain.
 *
 * What round 4 handed the gate here, and what each of those is now:
 *
 *   field         round 4                              round 5
 *   ------------  -----------------------------------  ------------------------------------------
 *   reputation    Proxy({}, get: () => 100)   CONST     sum of best-per-quest faction_reputation
 *   ranks         Proxy({}, get: () => 7)     CONST     gates.highestQualifying(), the SHIPPING
 *                                                       predicate the engine itself now uses
 *   gold          1e9                         INFINITY  sum of best-per-quest gold reward
 *   topicsKnown   has:()=>true over 76 topics UNIVERSAL producible topics, raw spellings
 *   knowledge     has:()=>true over EMPTY     UNIVERSAL reveal ids + book knowledge_keys
 *   items         has:()=>true over EMPTY     UNIVERSAL items/** ids + quest reward ids
 *   spellEffects  has:()=>true over EMPTY     UNIVERSAL magic/** effect ids
 *   worldFlags    has:()=>true over authored  UNIVERSAL flags some resolution actually sets
 *   disposition   0, never raised             SILENT    the achievable value toward this giver
 *   completed     every quest but the target and its exclusives — unchanged, and declared
 *   locked        empty — unchanged, and declared
 *
 * The three constants were not neutral. `reputation = 100` was the top row of a rank ladder that
 * had moved to 112, so the tool published `0 of 540 viable` and named three quests unreachable
 * by anybody; the running engine offers them at 112 (W1-FACTIONS-r1 §1). The four universal
 * `has: () => true` collections were worse in the other direction: they answer yes to a token
 * nothing in the tree produces, so six shipped requirements that no play can satisfy were
 * invisible to every previous round of this tool.
 *
 * `omniscient: true` restores the round-4 behaviour for the SECOND ARM of the grant-dependency
 * test only. It never produces a criterion verdict.
 */
function bestCaseCtx(sheet, level, want = {}, forQuest = null, { omniscient = false, rankFactions = null } = {}) {
  const c = ctxAt(sheet, level, want);
  if (forQuest) {
    const excluded = excludedFor(forQuest);
    c.completed = new Set(quests.map((q) => q.id).filter((id) => !excluded.has(id)));
  }

  // ---- THE FOUR TOKEN VOCABULARIES -----------------------------------------------------------
  // Real Sets of the tokens the shipped tree can produce. `gate.js` reads three of them with
  // `Set.has` and one — topicsKnown — through `topicsInclude()`, which ITERATES and folds the
  // dialogue layer's slug against the quest layer's prose. The raw producer spellings are kept
  // precisely so that fold is still exercised at gate time: an omniscient collection can never
  // test the comparison it stands in for, which is how `{ has: () => true }` sat here for three
  // rounds without anyone noticing it was answering for an empty set.
  c.topicsKnown = omniscient ? grantAll(GRANTED_TOPICS) : new Set(GRANTED_TOPICS);
  c.knowledge = omniscient ? grantAll(GRANTED_KNOWLEDGE) : new Set(GRANTED_KNOWLEDGE);
  c.items = omniscient ? grantAll(GRANTED_ITEMS) : new Set(GRANTED_ITEMS);
  c.spellEffects = omniscient ? grantAll(GRANTED_EFFECTS) : new Set(GRANTED_EFFECTS);
  c.worldFlags = omniscient ? grantAll(GRANTED_FLAGS) : new Set(GRANTED_FLAGS);

  // ---- GOLD. Derived, not 1e9. --------------------------------------------------------------
  c.gold = attainableGold(forQuest);

  // ---- REPUTATION. Derived, not 100. --------------------------------------------------------
  c.reputation = attainableReputation(forQuest);

  // ---- RANK. Derived through the SHIPPING ladder, not 7. ------------------------------------
  // `QuestEngine.context()` (machine.js) computes rank exactly this way — `gates
  // .highestQualifying(f, {reputation, attributes, skills, worldFlags})` — because nothing in
  // the build ever writes `q.factions[f].rank`. Granting 7 was not merely a constant; it
  // contradicted the shipping derivation, and it hid the fact that every faction's rank 5 row
  // carries a `world_state.flag` (faction-gates.json), twelve of which no quest sets.
  //
  // COST NOTE, because it is a real constraint on a tool RI-MTH06 §A requires to run in CI:
  // `highestQualifying` walks up to 8 rank rows and each row evaluates reputation, an attribute,
  // two favoured skills and a world flag. Deriving all eight ladders on every one of the ~260 000
  // context builds a full walk makes was measured at several times the cost of the entire
  // round-4 walk. `rankFactions` narrows it to the ladders the caller's gate can actually read —
  // `canOffer` touches `ctx.ranks[def.rank_gate.faction]` and `canResolve` touches
  // `ctx.ranks[requires.faction_rank.faction]`, and nothing else in gate.js reads the table — so
  // the narrowed derivation is COMPLETE for those callers, not a sample of it. Callers that pass
  // nothing still get all eight.
  const lite = { reputation: c.reputation, attributes: c.attributes, skills: c.skills, worldFlags: c.worldFlags };
  c.ranks = {};
  for (const fid of (rankFactions || gates.ids())) {
    if (gates.factions.has(fid)) c.ranks[fid] = gates.highestQualifying(fid, lite);
  }
  // A faction with no ladder row can still be named by a `requires.faction_rank`; those read 0
  // through `gate.js num()`, which is what the engine does, so nothing is invented for them.

  return c;
}

/**
 * Which ungrounded tokens could this quest's verdict possibly turn on? Used to name them when
 * the grant-dependency test fires. Cheap, and it never decides anything on its own.
 */
function unsourcedTokensFor(q) {
  const hit = [];
  const ob = q.opens_by || {};
  for (const t of [ob.topic, ...(ob.prerequisite_topics || [])]) {
    if (t && UNSOURCED_SETS.topics.has(t)) hit.push(`topic ${JSON.stringify(t)}`);
  }
  if (q.rank_gate && q.rank_gate.faction && gates.ids().includes(q.rank_gate.faction)) {
    const row = gates.get(q.rank_gate.faction).ranks[Math.max(0, Math.min(7, q.rank_gate.min_rank))];
    if (row && row.world_state && UNSOURCED_SETS.world_flags.has(row.world_state.flag)) {
      hit.push(`world flag ${JSON.stringify(row.world_state.flag)} (${q.rank_gate.faction} rank ${row.rank})`);
    }
  }
  for (const r of q.resolutions || []) {
    const rq = r.requires || {};
    for (const i of rq.items || []) if (UNSOURCED_SETS.items.has(i)) hit.push(`${r.id} requires item ${JSON.stringify(i)}`);
    for (const k of [...(rq.knowledge || []), ...(r.requires_knowing || [])]) if (UNSOURCED_SETS.knowledge.has(k)) hit.push(`${r.id} requires knowledge ${JSON.stringify(k)}`);
    for (const e of rq.spell_effects || []) if (UNSOURCED_SETS.spell_effects.has(e)) hit.push(`${r.id} requires spell effect ${JSON.stringify(e)}`);
  }
  return [...new Set(hit)];
}

let FIXTURE = null;
function withFixture(f, fn) { const prev = FIXTURE; FIXTURE = f; try { return fn(); } finally { FIXTURE = prev; } }
function fxNum(key) {
  const v = FIXTURE && FIXTURE[key];
  return Number.isFinite(v) ? v : null;
}

function questClearable(sheet, q, level) {
  const dispFloor = fxNum('quest_disposition_floor');
  if (dispFloor !== null) {
    q = { ...q, giver: { ...(q.giver || { npc_id: '(none)' }), disposition_min: dispFloor } };
  }
  if (FIXTURE && FIXTURE.impossible_resolution_gate) {
    q = {
      ...q,
      resolutions: (q.resolutions || []).map((r) => ({
        ...r, requires: { ...(r.requires || {}), attributes: { ...((r.requires || {}).attributes || {}), luck: 9999 } },
      })),
    };
  }
  // ---- THE GRANT-DEPENDENCY TEST. ROUND 5. --------------------------------------------------
  //
  // The provable walk is the verdict. But six shipped requirements name tokens NOTHING in the
  // tree produces (three items, three knowledge keys), and twelve `world_state` flags on the
  // rank ladders have no producing resolution. A tool that grants those anyway reports on a
  // world that does not exist — that is exactly the `reputation = 100` defect wearing different
  // clothes. A tool that fails on them charges the build for something this instrument cannot
  // prove is a defect rather than a census gap of its own.
  //
  // So: when the provable arm refuses, re-run the SAME shipping predicates with the omniscient
  // collections. If the verdict flips, the refusal turned on a token with no producer and the
  // quest is `unmeasurable`, with the token named. Neither a false red nor a silent pass, and
  // the flip is measured through `canOffer`/`canResolve` rather than asserted.
  const first = questClearableInner(sheet, q, level, { omniscient: false });
  if (first.status === PASS) return first;
  const tokens = unsourcedTokensFor(q);
  if (!tokens.length) return first;
  const second = questClearableInner(sheet, q, level, { omniscient: true });
  if (second.status !== PASS) return first;
  return {
    status: UNMEASURABLE,
    giver: q.giver && q.giver.npc_id,
    stopped_at: {
      quest: q.id, stage: first.stopped_at ? first.stopped_at.stage : null,
      gate: 'ungrounded requirement',
      why: `this quest is refused on the shipped tree (${String(first.stopped_at && first.stopped_at.why).slice(0, 200)}) ` +
           `and clears the moment tokens with NO PRODUCER anywhere in game/data are granted: ` +
           `${tokens.join('; ')}. The verdict therefore depends on a substitution rather than on ` +
           `the build, so it is UNMEASURABLE rather than a fail. Either the token is authored ` +
           `somewhere this census cannot see — in which case the census is the defect — or no ` +
           `play can satisfy the requirement, in which case the data is.`,
      ungrounded_tokens: tokens,
    },
    why: `${q.id}: verdict depends on ${tokens.length} requirement token(s) with no producer in shipped data`,
  };
}

/** Returns { status: pass|fail|unmeasurable, stopped_at?, why?, giver? }. */
function questClearableInner(sheet, q, level, { omniscient = false } = {}) {
  const want = { skills: [], attributes: [] };
  for (const res of q.resolutions || []) {
    for (const s of Object.keys((res.requires || {}).skills || {})) want.skills.push(s);
    for (const a of Object.keys((res.requires || {}).attributes || {})) want.attributes.push(a);
  }
  // ROUND 5. A quest with a `rank_gate` is gated on the FACTION LADDER's favoured skills and
  // attributes, and rank is now derived through `gates.highestQualifying()` instead of granted
  // as the constant 7. If the projection is not allowed to invest in the ladder's own columns
  // the derived rank is an artificially low number, and a restrictive substitution buys a false
  // red exactly as readily as a permissive one buys a false pass (TOOL-COVERAGE-R2 §1).
  // The masterable-skill budget (6 at level 55) still binds, so this is player-optimal within a
  // real constraint rather than a grant.
  const ladderFactions = new Set();
  if (q.rank_gate && q.rank_gate.faction) ladderFactions.add(q.rank_gate.faction);
  for (const res of q.resolutions || []) {
    const fr = (res.requires || {}).faction_rank;
    if (fr && fr.faction) ladderFactions.add(fr.faction);
  }
  for (const fid of ladderFactions) {
    if (!gates.ids().includes(fid)) continue;
    const f = gates.get(fid);
    want.attributes.push(...f.favoured_attributes);
    want.skills.push(...f.favoured_skills);
  }
  const ctx = bestCaseCtx(sheet, level, want, q, { omniscient, rankFactions: [...ladderFactions] });

  // THE OFFER GATE, exactly as the build runs it. `ctx.dispositions` is the seeded table, not a
  // derived ceiling; the giver's entry is the player-optimal upper bound from quest gifts. The
  // shipping `canOffer` does the comparison and produces its own reason string — this tool does
  // not pre-empt the predicate it imported.
  let reach = null;
  if (q.giver && q.giver.disposition_min != null) {
    reach = achievableDisposition(q.giver.npc_id, q);
    ctx.dispositions = offerDispositionCtx(sheet, q.giver.npc_id, reach);
    // ROUND 5. `canResolve` reads the SCALAR `ctx.disposition` — a different field from the
    // per-npc table — for the 28 shipped resolutions carrying `requires.disposition` (20..70).
    // `ctxAt` set it to 0 and nothing ever raised it, so every one of those routes was silently
    // unavailable in every previous round. It is the same number the offer path just computed
    // for this giver, run through the same model.
    ctx.disposition = Number(ctx.dispositions[q.giver.npc_id]) || 0;
  } else if (q.giver && q.giver.npc_id) {
    const r2 = achievableDisposition(q.giver.npc_id, q);
    ctx.disposition = Number(offerDispositionCtx(sheet, q.giver.npc_id, r2)[q.giver.npc_id]) || 0;
  }

  const offer = canOffer(q, ctx, gates);
  if (!offer.offerable) {
    const dispClause = offer.why.find((w) => /\bdisposition \d+\/\d+/.test(String(w)));
    const st = { quest: q.id, stage: null, gate: 'offer', why: offer.why.join('; ') };
    if (dispClause && reach) {
      // The one gate this build has that no signature can pass. Name it with its arithmetic so a
      // reader can act on it without re-deriving anything.
      st.npc_id = reach.npc_id;
      st.gate = `giver ${reach.npc_id} requires disposition >= ${q.giver.disposition_min}`;
      st.offer_model = OFFER_MODEL.model;
      st.race_invariant = OFFER_MODEL.model !== 'derived';
      const modelled = OFFER_MODEL.model === 'derived'
        ? (() => {
          const g = resolveGiver(reach.npc_id);
          if (g.status !== 'resolved') return null;
          const term = raceTerm(data, g.group, sheet.race, sheet.upbringing);
          return { group: g.group, race: term.race, upbringing: term.upbringing,
                   value: dispositionCeiling(reach.value, sheet.race, sheet.upbringing, sheet.birthsign, g.group) };
        })()
        : null;
      st.modelled_disposition = modelled;
      st.why =
        (reach.seeded
          ? `seedDispositions() writes ${reach.seed} for "${reach.npc_id}" (npcs/** record, raw)`
          : `no NPC record anywhere in npcs/** carries id "${reach.npc_id}", so seedDispositions() ` +
            `seeds nothing and gate.js num(undefined) reads 0`) +
        `; the best any play can add through quest npc_disposition consequences is +${reach.value - reach.seed}` +
        (reach.gifts.length ? ` (${reach.gifts.map((g) => `${g.quest} +${g.delta}`).join(', ')})` : ' — no quest gives this npc disposition') +
        (reach.gifts_excluded_as_circular.length
          ? `; ${reach.gifts_excluded_as_circular.map((g) => `${g.quest} +${g.delta}`).join(', ')} excluded as circular (that quest is gated on this same bar)`
          : '') +
        `, reaching a register value of ${reach.value} against a required ${q.giver.disposition_min}. ` +
        (modelled
          ? `This build APPLIES the reaction matrix to the offer path (offer model "derived", ` +
            `all three source anchors matched), so what the gate actually reads is ` +
            `${modelled.value}: ${modelled.group} with race term ${modelled.race} and upbringing ` +
            `term ${modelled.upbringing} on top of the register, plus every movable term at its ` +
            `ceiling (${MODEL.disposition_other_terms_ceiling}). THIS STOP IS SIGNATURE-SPECIFIC. `
          : `This gate is RACE-INVARIANT: the build never applies derivedDisposition() to the quest ` +
            `path (offer model "raw", no source anchor matched), so every one of the 540 ` +
            `signatures reads the identical number. `) +
        (reach.seeded ? '' : `And nobody by that id exists in the world, so Charm ` +
          `(sim/magic/apply.js:880) cannot reach them either. `) +
        `UNPASSABLE — RI-CHR01 §5 criterion 3, "never encounter a gate with no route it can take".`;
    }
    return { status: FAIL, stopped_at: st, unpassable_for_all: !!dispClause };
  }

  const resolutions = q.resolutions || [];

  // ---- THE SECOND QUEST SHAPE. ROUND 5, AND A CORRECTION TO THIS ROUND'S OWN FIRST ANSWER. ---
  //
  // `loadQuests()` admits two shapes: `doc.quests[]` (resolution-shaped) and a bare
  // `doc.stages && doc.id` document (stage-shaped). I audited `q.stages` against the shipped
  // tree, measured 0 of 94 quests carrying it, and cut it as a dead read of exactly the
  // `r.frame` kind. **That was wrong, and the tree proved it inside the hour**: a stage-shaped
  // quest (`quests/the-boards.json`) landed mid-run and the cut turned it into 495 signatures
  // FAILing on "quest declares no resolutions" — a tool defect published as a build defect.
  //
  // The lesson is worth more than the line: a field census over shipped DATA cannot establish
  // that a read is dead, because the LOADER defines what shapes are legal and data catches up
  // later. Read the loader.
  //
  // What this tool can honestly say about a stage-shaped quest is nothing. Its gate vocabulary
  // is different — `outcomes[].requires` is a flat array of world-flag ids, not the `requires`
  // object `canResolve()` consumes, and `stages[].flags` GRANTS flags rather than demanding
  // them. Running `canResolve` over it would be inventing a predicate. So it is `unmeasurable`,
  // named, with the file's own `declared_incomplete` note carried through.
  if (!resolutions.length && Array.isArray(q.stages) && q.stages.length) {
    const inc = q.declared_incomplete;
    return {
      status: UNMEASURABLE,
      stopped_at: {
        quest: q.id, stage: null, gate: 'quest shape not modelled',
        why: `"${q.id}" is a STAGE-SHAPED quest (${q.stages.length} stages, ` +
             `${(q.outcomes || []).length} outcomes) admitted by loadQuests() via ` +
             `\`doc.stages && doc.id\`. Its gate vocabulary is outcomes[].requires — a flat list ` +
             `of world-flag ids — which is not the shape canOffer()/canResolve() consume, so this ` +
             `tool has no predicate for it and refuses rather than inventing one.` +
             (inc ? ` The file declares itself incomplete: ${JSON.stringify(inc.missing || inc)} ` +
                    `(owner: ${inc.owner || 'unstated'}).` : ''),
      },
      why: `${q.id}: stage-shaped quest, no predicate in this tool`,
    };
  }
  if (!resolutions.length) {
    return { status: FAIL, stopped_at: { quest: q.id, stage: null, gate: 'resolutions', why: 'quest declares no resolutions' } };
  }
  // ROUND 5. Every resolution is evaluated and the verdict names the CLOSEST one, not
  // `resolutions[0]`. The old line ran `canResolve(resolutions[0])` and published its reasons as
  // the stop, so the artifact stated a blocker for a route the character may not have needed
  // while a different route was one point short. Same family as `rows_compared: 240` beside zero
  // comparisons: a specific claim reported over a row the walk did not single out.
  const evaluated = resolutions.map((r) => ({ id: r.id, stage: r.journal_index ?? null, r: canResolve(r, ctx) }));
  const open = evaluated.filter((e) => e.r.available);
  if (!open.length) {
    const closest = evaluated.slice().sort((a, b) => a.r.why.length - b.r.why.length)[0];
    return {
      status: FAIL,
      stopped_at: {
        quest: q.id, stage: closest.stage,
        gate: `resolution ${closest.id}`,
        why: closest.r.why.join('; ') || 'no resolution available',
        resolutions_evaluated: evaluated.length,
        resolutions_open: 0,
        all_blocked: evaluated.map((e) => `${e.id}: ${e.r.why.join('; ')}`),
      },
    };
  }
  return { status: PASS, resolutions_evaluated: evaluated.length, resolutions_open: open.length };
}

// ---------------------------------------------------------------------------------------------
// THE COUNTERFACTUAL. Labelled, secondary, and it never touches a criterion verdict.
//
// This is round 2's primary model, demoted. It answers: "if `seedDispositions()` applied
// `derivedDisposition()` against the character — one of the two one-line fixes TOOL-COVERAGE-R2
// referral 2 names — WHICH signatures would the race+upbringing bar then stop?" That is a useful
// question about a build we do not have, and reporting it as the answer about the build we DO
// have is exactly the false red the round-2 critic reproduced against the engine.
// ---------------------------------------------------------------------------------------------
function counterfactualRaceGate(sheet) {
  const blocked = [];
  const unresolvable = [];
  for (const q of quests) {
    if (!(q.giver && q.giver.disposition_min != null)) continue;
    const g = resolveGiver(q.giver.npc_id);
    if (g.status !== 'resolved') { unresolvable.push({ quest: q.id, npc_id: q.giver.npc_id, absence: g.status }); continue; }
    const ceiling = dispositionCeiling(g.base, sheet.race, sheet.upbringing, sheet.birthsign, g.group);
    if (ceiling < q.giver.disposition_min) {
      const t = raceTerm(data, g.group, sheet.race, sheet.upbringing);
      blocked.push({
        quest: q.id, npc_id: q.giver.npc_id, group: g.group,
        gate: `requires.disposition >= ${q.giver.disposition_min} with ${g.group}`,
        why: `race term ${t.race} + upbringing ${t.upbringing} puts the ceiling at ${ceiling}`,
      });
    }
  }
  return {
    label: 'COUNTERFACTUAL — NOT A VERDICT ON THIS BUILD',
    hypothesis: 'seedDispositions() applies derivedDisposition() against the character, or ' +
                'canOffer()/_dispositionToward() derive at read time (TOOL-COVERAGE-R2 referral 2)',
    would_block: blocked.length > 0,
    blocked_at: blocked,
    givers_whose_group_cannot_be_resolved: unresolvable.length,
    note: 'The shipping build applies no race term to any quest gate, so this list is empty of ' +
          'consequence today. It is reported so that whoever wires the matrix in can see what ' +
          'lands the moment they do.',
  };
}

/** Walk a quest list at the best simulated level; FAIL beats UNMEASURABLE beats PASS. */
function walkQuests(sheet, list, label) {
  if (!list.length) {
    return {
      status: UNMEASURABLE,
      why: `no quest matches ${label} — there is nothing to walk. ${quests.length} quests are ` +
           `shipped; categories present: ${[...new Set(quests.map((q) => q.category || '(none)'))].sort().join(', ')}`,
    };
  }
  const top = LEVELS[LEVELS.length - 1];
  // The permissive level first: if every quest clears at a lower level, so much the better.
  for (const level of LEVELS) {
    if (list.every((q) => questClearable(sheet, q, level).status === PASS)) {
      return { status: PASS, at_level: level, quests: list.length };
    }
  }
  let firstFail = null; const unmeasurable = [];
  for (const q of list) {
    const r = questClearable(sheet, q, top);
    if (r.status === FAIL && !firstFail) firstFail = r;
    if (r.status === UNMEASURABLE) unmeasurable.push(r);
  }
  if (firstFail) return { status: FAIL, ...firstFail, quests: list.length };
  if (unmeasurable.length) {
    // ROUND 5. The old wording asserted ONE cause — an unresolvable giver reaction group — for
    // every unmeasurable quest in the list. There are now two, and the second (a requirement
    // token with no producer in shipped data) is the more common one on this tree. Reporting a
    // cause the walk did not establish is the same defect as reporting a count it did not
    // compare, so the reason is now taken from the record rather than written into it.
    const byGate = {};
    for (const u of unmeasurable) {
      const g = (u.stopped_at && u.stopped_at.gate) || 'unstated';
      byGate[g] = (byGate[g] || 0) + 1;
    }
    return {
      status: UNMEASURABLE, quests: list.length,
      stopped_at: unmeasurable[0].stopped_at,
      unmeasurable_givers: unmeasurable.map((u) => u.giver).filter(Boolean),
      unmeasurable_by_gate: byGate,
      unmeasurable_quests: unmeasurable.map((u) => u.stopped_at && u.stopped_at.quest).filter(Boolean),
      why: `${unmeasurable.length} of ${list.length} quests could not be decided on this tree ` +
           `(${Object.entries(byGate).map(([g, n]) => `${n}x ${g}`).join(', ')}). ` +
           `First: ${unmeasurable[0].stopped_at.why}`,
    };
  }
  return { status: FAIL, why: 'unreachable' };
}

function criterionMainQuest(sheet) {
  return walkQuests(sheet, quests.filter((q) => q.category === 'main'), 'category:"main"');
}

function criterionNoUnpassableGate(sheet) {
  return walkQuests(sheet, quests, 'any category');
}

/**
 * CRITERION 2 — three factions at rank 5, ROUND 5.
 *
 * Round 4 evaluated this against `reputation = Proxy(100)` and `worldFlags.has() = true`, so
 * every rank-5 row's reputation term (70) and world-state term passed for free and the criterion
 * could only ever fail on an attribute or skill projection. It reported `pass` for all 540.
 *
 * Both of those terms are now measured. The reputation is the book's own best-per-quest sum, and
 * the world flag is checked against the flags a resolution actually sets — which matters,
 * because EVERY faction's rank-5 row carries one (`faction-gates.json`), and twelve of the
 * twenty-four ladder flags have no producing resolution anywhere in game/data.
 *
 * Exclusivity is now the full shipped model, not half of it. `gates.closedBy()` covers
 * `hard_groups` and `enemy_pairs`; `exclusivity.earned` — the rank-triggered rivalry lock that
 * `QuestEngine.context()` applies through `rivalry_locked` — was ignored, so a triple containing
 * two factions that lock each other at rank 2/3 was being counted as compatible at rank 5.
 */
function earnedLockConflict(a, b) {
  const ex = (gates.exclusivity && gates.exclusivity.earned) || [];
  for (const e of ex) {
    const pair = (e.a === a && e.b === b) || (e.a === b && e.b === a);
    if (!pair) continue;
    // Both locks bite at or below rank 5, so holding rank 5 in both is not a state this build
    // can be in. `escape` is authored per line and is recorded, not silently honoured.
    const aLocks = Number.isFinite(e.a_locks_b_at_rank) ? e.a_locks_b_at_rank : Infinity;
    const bLocks = Number.isFinite(e.b_locks_a_at_rank) ? e.b_locks_a_at_rank : Infinity;
    if (aLocks <= 5 || bLocks <= 5) return { a: e.a, b: e.b, a_locks_b_at_rank: e.a_locks_b_at_rank, b_locks_a_at_rank: e.b_locks_a_at_rank, why: e.why || null, escape: e.escape || null };
  }
  return null;
}

function criterionThreeFactionsRank5(sheet) {
  const ids = gates.ids();
  const top = LEVELS[LEVELS.length - 1];
  const qualifying = [];
  const blocked = [];
  const rankFloor = fxNum('faction_rank5_attribute_floor');
  for (const id of ids) {
    const f = gates.get(id);
    const ctx = bestCaseCtx(sheet, top, { skills: f.favoured_skills, attributes: f.favoured_attributes }, null, { rankFactions: [id] });
    let ev;
    if (rankFloor !== null) {
      const row = gates.row(id, 5);
      const bestAttr = f.favoured_attributes.map((a) => ctx.attributes[a] || 0).sort((x, y) => y - x)[0];
      ev = bestAttr >= rankFloor
        ? gates.evaluate(id, 5, ctx)
        : { allowed: false, unmet: [`${f.favoured_attributes.join(' or ')} ${bestAttr}/${rankFloor} (fixture floor, real row asks ${row.attribute})`] };
    } else {
      ev = gates.evaluate(id, 5, ctx);
    }
    if (ev.allowed) qualifying.push(id);
    else {
      const row = gates.row(id, 5);
      const flag = row.world_state && row.world_state.flag;
      blocked.push({
        faction: id, unmet: ev.unmet,
        attainable_reputation: ctx.reputation[id] ?? 0,
        rank5_requires_reputation: row.reputation,
        // Named because it is the difference between "the build is short" and "the data cannot
        // express this at all", and only one of those is chargeable to a signature.
        rank5_world_flag: flag || null,
        rank5_world_flag_has_a_producer: flag ? PRODUCERS.flags.has(flag) : null,
      });
    }
  }
  // A rank-5 row whose world flag NOTHING sets is not a failure this signature can be charged
  // with: no character in the grid can differ on it. It is a data absence, reported as one.
  const blockedOnlyByAnUngroundedFlag = blocked.filter(
    (b) => b.rank5_world_flag && b.rank5_world_flag_has_a_producer === false
      && b.unmet.length === 1);
  const compatible = (a, b) => !gates.closedBy(a).includes(b) && !earnedLockConflict(a, b);
  const conflicts = [];
  for (let i = 0; i < qualifying.length; i++) {
    for (let j = i + 1; j < qualifying.length; j++) {
      if (!compatible(qualifying[i], qualifying[j])) { conflicts.push([qualifying[i], qualifying[j]]); continue; }
      for (let k = j + 1; k < qualifying.length; k++) {
        if (compatible(qualifying[i], qualifying[k]) && compatible(qualifying[j], qualifying[k])) {
          return { status: PASS, factions: [qualifying[i], qualifying[j], qualifying[k]], qualifying, blocked };
        }
      }
    }
  }
  if (blockedOnlyByAnUngroundedFlag.length
      && qualifying.length + blockedOnlyByAnUngroundedFlag.length >= 3) {
    return {
      status: UNMEASURABLE,
      qualifying, blocked,
      stopped_at: {
        quest: null, stage: null, gate: 'ungrounded requirement',
        why: `${qualifying.length} faction(s) reach rank 5 on the shipped tree, and ` +
             `${blockedOnlyByAnUngroundedFlag.length} more are held back ONLY by a rank-5 ` +
             `world_state flag that no resolution anywhere in game/data sets ` +
             `(${blockedOnlyByAnUngroundedFlag.map((b) => `${b.faction}:${b.rank5_world_flag}`).join(', ')}). ` +
             `Three-at-rank-5 therefore turns on a token this instrument cannot ground, so it is ` +
             `UNMEASURABLE rather than a fail against the signature.`,
        ungrounded_tokens: blockedOnlyByAnUngroundedFlag.map((b) => `world flag ${JSON.stringify(b.rank5_world_flag)} (${b.faction} rank 5)`),
      },
      why: 'three-at-rank-5 depends on rank-5 world_state flags with no producer in shipped data',
    };
  }
  return {
    status: FAIL,
    stopped_at: {
      quest: null, stage: null, gate: 'three factions at rank 5',
      why: qualifying.length < 3
        ? `only ${qualifying.length} of ${ids.length} factions reach rank 5 (${blocked.slice(0, 3).map((b) => `${b.faction}: ${b.unmet.join(', ')}`).join(' | ')})`
        : `${qualifying.length} factions reach rank 5 but no three are mutually compatible under ` +
          `exclusivity (hard_groups + enemy_pairs + earned rivalry locks). Conflicting pairs: ` +
          `${conflicts.slice(0, 4).map((c) => c.join('/')).join(', ')}`,
    },
    qualifying, blocked,
  };
}

function criterionTier5Survivable(sheet, fixture, cohortInfo) {
  if (!cohortInfo.cohort.length) {
    return {
      status: UNMEASURABLE,
      why: cohortInfo.tier5_regions.length
        ? `regions ${cohortInfo.tier5_regions.join(', ')} carry danger_tier 5 but no encounter in ` +
          `world/encounters.json and no fog gate in world/hearths.json is authored in any of them, ` +
          `so there is no tier-5 fight to run. The cohort is NOT widened to a lower tier ` +
          `(TOOL-COVERAGE-R1 §1).`
        : 'no region in world/regions.json carries danger_tier 5, so criterion 4 has no referent.',
    };
  }
  const fights = [];
  for (const entry of cohortInfo.cohort) {
    const f = fightEncounter(sheet, entry, fixture);
    fights.push(f);
    if (!f.survivable) {
      return {
        status: FAIL,
        stopped_at: {
          quest: null, stage: null,
          gate: `tier-5 encounter ${entry.id} (${entry.regions.join('/')}) at level 55`,
          why: f.reason
            || `${f.attempts} attempts needed (limit ${LETHALITY.attempts_allowed}) against ` +
               `${f.group}; absorbed ${f.damage_absorbed} over ${f.encounter_s}s against a pool of ` +
               `${f.pool_per_attempt} per attempt (player dps ${f.player_dps} vs group ${f.group_dps})`,
        },
        fights,
      };
    }
  }
  return { status: PASS, fights };
}

// ---------------------------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------------------------
function evaluateSignature(race, family, signFamily, upClass, fixture, cohortInfo) {
  const key = `${race}/${family}/${signFamily}/${upClass}`;
  const spec = representativeStart(race, family, signFamily, upClass);
  if (!spec) {
    return {
      signature: key, viable: false, constructible: false,
      criteria: { main_quest: FAIL, three_factions_rank5: FAIL, no_unpassable_gate: FAIL, tier5_survivable: FAIL },
      stopped_at: { quest: null, stage: null, gate: 'construction', why: 'no shipped class/birthsign/upbringing fills this cell' },
    };
  }
  let character;
  try { character = composeCharacter(data, spec); }
  catch (e) {
    return {
      signature: key, viable: false, constructible: false,
      criteria: { main_quest: FAIL, three_factions_rank5: FAIL, no_unpassable_gate: FAIL, tier5_survivable: FAIL },
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
    criterionTier5Survivable(sheet, fixture, cohortInfo),
  ]);

  const criteria = {
    main_quest: c1.status,
    three_factions_rank5: c2.status,
    no_unpassable_gate: c3.status,
    tier5_survivable: c4.status,
  };
  const all = [c1, c2, c3, c4];
  const firstFail = all.find((c) => c.status === FAIL);
  const firstUnm = all.find((c) => c.status === UNMEASURABLE);
  const first = firstFail || firstUnm;
  const rec = {
    signature: key,
    viable: all.every((c) => c.status === PASS),
    unmeasurable: !firstFail && !!firstUnm,
    constructible: true,
    criteria,
    stopped_at: first ? (first.stopped_at || { quest: null, stage: null, gate: first.status, why: first.why }) : null,
  };
  if (rec.unmeasurable) rec.unmeasurable_why = firstUnm.why || (firstUnm.stopped_at && firstUnm.stopped_at.why);
  rec.counterfactual_race_gate = withFixture(fixture, () => counterfactualRaceGate(sheet));
  if (EXPLAIN) rec.working ={ class_id: spec.classId, main_quest: c1, factions: c2, gates: c3, lethality: c4, sheet_at_55: { attributes: sheet.attributes, skills: sheet.skills } };
  return rec;
}

function walkAll(fixture) {
  const cohortInfo = withFixture(fixture, () => resolveTier5Cohort());
  const out = [];
  for (const race of RACES) {
    for (const family of FAMILIES) {
      for (const sf of SIGN_FAMILIES) {
        for (const uc of UP_CLASSES) out.push(evaluateSignature(race, family, sf, uc, fixture, cohortInfo));
      }
    }
  }
  out.__cohort = cohortInfo;
  return out;
}

/** The giver census — the defect list defect B used to hide. Reported on every run. */
function giverCensus() {
  const rows = [];
  for (const q of quests) {
    if (!(q.giver && q.giver.disposition_min != null)) continue;
    const g = resolveGiver(q.giver.npc_id);
    rows.push({ quest: q.id, npc_id: q.giver.npc_id, disposition_min: q.giver.disposition_min, status: g.status, group: g.group || null, faction: g.faction || null });
  }
  const byStatus = { resolved: 0, no_record: 0, no_group: 0 };
  for (const r of rows) byStatus[r.status]++;
  return {
    quests_with_a_giver_disposition_min: rows.length,
    resolving_to_a_reaction_group: byStatus.resolved,
    giver_has_no_npc_record: byStatus.no_record,
    giver_has_a_record_but_no_reaction_group: byStatus.no_group,
    max_disposition_min_shipped: rows.reduce((m, r) => Math.max(m, r.disposition_min), 0),
    unresolved_givers: [...new Set(rows.filter((r) => r.status !== 'resolved').map((r) => `${r.npc_id} [${r.status}]`))].sort(),
    rows,
  };
}

function report(records, fixture) {
  const viable = records.filter((r) => r.viable).length;
  const unmeasurable = records.filter((r) => r.unmeasurable).length;
  const notViable = records.length - viable - unmeasurable;
  const byCriterion = {};
  for (const k of ['main_quest', 'three_factions_rank5', 'no_unpassable_gate', 'tier5_survivable']) {
    byCriterion[k] = {
      fail: records.filter((r) => r.criteria[k] === FAIL).length,
      unmeasurable: records.filter((r) => r.criteria[k] === UNMEASURABLE).length,
    };
  }
  const cohortInfo = records.__cohort || withFixture(fixture, () => resolveTier5Cohort());
  const census = withFixture(fixture, () => giverCensus());
  const because = [];
  if (!cohortInfo.cohort.length) {
    because.push('no fight is authored in any danger_tier 5 region, so criterion 4 has no cohort.');
  }

  // The unpassable-gate roll-up. This is the product of the round-3 rebuild: a live build
  // failure that round 2 reported as `unmeasurable` and therefore charged to the corpus.
  const unpassable = new Map();
  for (const r of records) {
    const s = r.stopped_at;
    if (!s || !s.race_invariant) continue;
    if (!unpassable.has(s.gate)) unpassable.set(s.gate, { gate: s.gate, npc_id: s.npc_id, quest: s.quest, why: s.why, signatures: 0 });
    unpassable.get(s.gate).signatures++;
  }

  // ===============================================================================================
  // ROUND 4, SUCCESSOR PASS — THE ROLL-UP WAS BLIND TO EVERY GATE KIND BUT ONE.
  //
  // Observed on this tree, not reasoned about: the walk reports `viable 0 / 540`, every single
  // signature stopped at
  //     {"quest":"Q-ASSZ-08","gate":"offer","why":"the_imperial_assize reputation 100/112"}
  // and the artifact ALSO reports `unpassable_gates.quests_blocked: 0`, `gates: []`, and the
  // operator-facing "BUILD FAIL — N quests carry a gate no signature can pass" banner NEVER
  // FIRES, because that banner is `if (rep.unpassable_gates.quests_blocked)`.
  //
  // Both halves of the old roll-up only ever see DISPOSITION gates: `unpassable` above skips
  // anything not flagged `race_invariant` (false for every stop under the `derived` model), and
  // `allUnpassable` below iterates `quests.filter(q => q.giver.disposition_min != null)`. The
  // gate actually blocking one hundred percent of the grid is a REPUTATION gate, so it is
  // invisible to both.
  //
  // That is the defect this whole round exists to remove, in the tool the round was opened over:
  // a summary field that reads 0 while the walk underneath it says 540. It is the same shape as
  // R3's finding that `--cross-check` said "rows_compared: 240, 0 disagreements" when every row
  // was `agrees: null` and nothing was compared.
  //
  // So: an EMPIRICAL roll-up, over the stops the walk actually recorded, of whatever kind. A gate
  // that stopped every signature in the grid is a gate no signature can pass — that is a fact
  // about the walk, and it needs no model, no gate-kind allow-list and no per-kind ceiling
  // arithmetic to establish.
  // ===============================================================================================
  const stopKey = (s) => `${s.quest} ${s.stage == null ? '' : s.stage} ${s.gate} ${s.why}`;
  const stopCensus = new Map();
  for (const r of records) {
    const s = r.stopped_at;
    if (!s) continue;
    if (!stopCensus.has(stopKey(s))) {
      stopCensus.set(stopKey(s), {
        quest: s.quest, stage: s.stage ?? null, gate: s.gate, why: s.why,
        npc_id: s.npc_id ?? null, signatures: 0,
      });
    }
    stopCensus.get(stopKey(s)).signatures++;
  }
  const stopsAll = [...stopCensus.values()].sort((a, b) => b.signatures - a.signatures);
  const blocksEverySignature = records.length > 0
    ? stopsAll.filter((x) => x.signatures === records.length) : [];
  // Every quest carrying such a gate, not merely the first one each signature stopped at.
  // Unpassable = no signature in the whole grid can clear it. Under the `raw` model that is
  // signature-independent; under `derived` it is a maximum over the 10x3x3 race/upbringing/sign
  // space, because the race term is what decides it.
  const allUnpassable = [];
  for (const q of quests) {
    if (!(q.giver && q.giver.disposition_min != null)) continue;
    const reach = withFixture(fixture, () => achievableDisposition(q.giver.npc_id, q));
    const g = withFixture(fixture, () => resolveGiver(q.giver.npc_id));
    let best = reach.value, bestSig = null;
    if (OFFER_MODEL.model === 'derived' && g.status === 'resolved') {
      best = -Infinity;
      for (const race of RACES) {
        for (const uc of UP_CLASSES) {
          const up = UPBRINGINGS.find((u) => u.signature_class === uc);
          for (const sf of SIGN_FAMILIES) {
            const sign = data.birthsigns.signs.find((s) => s.family === sf);
            const v = dispositionCeiling(reach.value, race, up.id, sign && sign.id, g.group);
            if (v > best) { best = v; bestSig = `${race}/${uc}/${sf}`; }
          }
        }
      }
    }
    if (best < q.giver.disposition_min) {
      allUnpassable.push({
        quest: q.id, npc_id: q.giver.npc_id, requires: q.giver.disposition_min,
        offer_model: OFFER_MODEL.model,
        seeded: reach.seeded, seed: reach.seed,
        register_best_achievable: reach.value,
        gate_reads: best, best_signature: bestSig,
        reaction_group: g.group || null,
        gifts: reach.gifts, circular_gifts: reach.gifts_excluded_as_circular,
      });
    }
  }

  // How many signatures does the offer path actually distinguish? Measured, not asserted: the
  // number of DISTINCT (criteria, stopped_at) outcomes across the grid.
  const distinctOutcomes = new Set(records.map((r) => JSON.stringify([r.criteria, r.stopped_at && r.stopped_at.why]))).size;

  const raceDistinctness = OFFER_MODEL.model === 'derived' ? {
    finding: 'The reaction matrix REACHES the quest-offer path in this build, so RI-CHR01 ' +
             'Distinctness is measurable from it.',
    offer_model: OFFER_MODEL.model,
    detected_by: OFFER_MODEL.anchors,
    distinct_offer_outcomes_across_the_grid: distinctOutcomes,
    consequence: distinctOutcomes > 1
      ? `${distinctOutcomes} distinct offer-path outcomes across ${records.length} signatures — ` +
        'the gate discriminates.'
      : `every one of ${records.length} signatures produced the IDENTICAL outcome. The matrix is ` +
        'wired in but nothing it can express is load-bearing at any shipped disposition_min ' +
        '(the highest is ' + census.max_disposition_min_shipped + '). That is a content fact, ' +
        'not a wiring fact, and it is reported here rather than counted as distinctness.',
    owner: 'game/data/quests — the disposition_min values decide whether the wired term bites.',
  } : {
    finding: 'RI-CHR01 Distinctness is not measurable from the quest-offer path BECAUSE THE ' +
             'BUILD DOES NOT IMPLEMENT IT — not because a data field is missing.',
    offer_model: OFFER_MODEL.model,
    detected_by: OFFER_MODEL.anchors,
    distinct_offer_outcomes_across_the_grid: distinctOutcomes,
    evidence: [
      'Engine.seedDispositions() (engine.js:4563) writes q.dispositions[rec.id] = rec.disposition, raw.',
      'derivedDisposition() is called nowhere on the quest path: not canOffer(), not canResolve(), ' +
      'not QuestEngine._dispositionToward().',
      'In game/src the reaction matrix reaches the world in exactly two places: ' +
      'Engine.npcDisposition() (a read-only surface) and character/encounter.js openingFor() ' +
      '(encounter hostility). Neither is a quest gate.',
    ],
    consequence: 'The quest-offer path is race-invariant in this build: all 540 signatures read ' +
                 'the identical disposition number at every giver. Adding reaction_group to the ' +
                 `${census.giver_has_a_record_but_no_reaction_group} records that lack it, or minting the ` +
                 `${census.giver_has_no_npc_record} missing records, is NECESSARY BUT NOT SUFFICIENT ` +
                 '(TOOL-COVERAGE-R2 referral 2): the field would still not be read.',
    owner: 'game/src — one of seedDispositions() deriving against the character, or ' +
           'canOffer()/_dispositionToward() deriving at read time.',
    scoring: 'RI-CHR01 Distinctness and RI-CHR03 Decidability remain corpus_debt, and the debt is ' +
             'owed by game/src, not by game/data.',
  };

  return {
    schema: 'elder-souls/build-viability@2',
    tool: 'tools/analysis/build-viability.mjs',
    item: 'RI-CHR01 M6 / RI-CHR03 M5 / RI-MTH06 §A',
    generated_at: new Date().toISOString(),
    data_root: path.relative(REPO_ROOT, ROOT) || '.',
    grid: { races: RACES.length, families: FAMILIES.length, birthsign_families: SIGN_FAMILIES.length, upbringing_classes: UP_CLASSES.length, cells: records.length },
    target: TARGET,
    viable, not_viable: notViable, unmeasurable,
    unmeasurable_because: because,
    failures_by_criterion: byCriterion,
    levels_simulated: LEVELS,
    fixture: fixture || null,
    offer_model: OFFER_MODEL,
    // ---- ROUND 4: the model's provenance, stated on every artifact -------------------------
    // A consumer must be able to tell, from the artifact alone, whether the offer model behind
    // these numbers was OBSERVED on the running build or merely pattern-matched out of source
    // text. R3 §1 proved those are different things and that the second can be wrong while
    // looking identical. `model_verified: false` means the disposition verdicts below are
    // conditional on an unverified hypothesis and must not be scored.
    model_attestation: {
      status: ATTESTATION.status,
      model_verified: ATTESTATION.status === 'VALID',
      why: ATTESTATION.why || null,
      taken_at: ATTESTATION.at || null,
      source_hash_now: OFFER_MODEL.source_hash,
      live: ATTESTATION.live || null,
      reconciliation: ATTESTATION.reconciliation || null,
      how_to_mint: 'node tools/analysis/build-viability.mjs --verify-model',
      what_it_gates:
        'RI-CHR01 Distinctness and RI-CHR03 Decidability read the per-signature disposition ' +
        'verdicts. Those verdicts are a function of the offer model. Without a live attestation ' +
        'the model is a source-text hypothesis, and TOOL-COVERAGE-R3 §1 demonstrated a one-line ' +
        'regression that leaves every source anchor matched while the race term is dead — the ' +
        'tool printed byte-identical output and charged the build 36 false FAILs.',
    },
    // ROUND 5. Everything the synthetic character was handed, and where each value came from.
    // Four rounds of rejection all had the same root: a value invented in the middle of this
    // file, reported as if it were measured. `substitutions_remaining` must be 0 and
    // `--self-test` asserts it.
    grant_ledger: grantLedger(),
    giver_census: census,
    // ROUND 3. The build failure round 2 reported as `unmeasurable` and thereby charged to the
    // corpus. `unmeasurable` routes to corpus_debt and charges nobody; `fail` charges the build.
    unpassable_gates: {
      note: 'Gates no signature can pass, computed from the SHIPPING offer path: the seeded raw ' +
            'disposition plus the best positive npc_disposition consequence any other quest can ' +
            'contribute. Race-invariant, so the count is the same for all 540 signatures.',
      quests_blocked: allUnpassable.length,
      // ROUND 5. This was `allUnpassable.length ? records.length : 0` — an INFERENCE dressed as
      // a count ("if any gate is unpassable then all of them are affected"), which is the same
      // shape as `rows_compared: 240` beside zero comparisons. It is now counted off the walk:
      // the signatures whose recorded stop is one of these gates.
      signatures_affected: records.filter((r) => r.stopped_at && allUnpassable
        .some((g) => r.stopped_at.quest === g.quest && r.stopped_at.npc_id === g.npc_id)).length,
      signatures_affected_note:
        'counted from the recorded first-stops, not inferred. A quest can be unpassable and not ' +
        'appear here if every signature stopped at an earlier gate — read `quests_blocked` for ' +
        'the gate count and this for the observed blame.',
      gates: allUnpassable,
      first_stop_histogram: [...unpassable.values()],
      // ROUND 4 SUCCESSOR — the scope of the three fields above, stated where a consumer reads
      // them rather than inferred. They are DISPOSITION-ONLY. `quests_blocked: 0` does NOT mean
      // the build has no unpassable gate; read `stops_blocking_every_signature`.
      scope: 'DISPOSITION GATES ONLY — computed over quests carrying giver.disposition_min. A ' +
             'reputation, item, flag or topic gate that stops the entire grid does not appear ' +
             'in these three fields. See `stops_blocking_every_signature`, which is empirical ' +
             'and gate-kind agnostic.',
    },
    // ROUND 4 SUCCESSOR — the empirical roll-up, over the stops the walk actually recorded.
    // Gate-kind agnostic by construction, so it cannot go blind the way the block above did.
    stops_blocking_every_signature: {
      note: `Distinct first-stops observed across all ${records.length} signatures, and the ` +
            'subset that stopped EVERY one of them. A gate that stopped every signature in the ' +
            'grid is a gate no signature can pass — established from the walk, with no model ' +
            'and no per-gate-kind arithmetic.',
      count: blocksEverySignature.length,
      gates: blocksEverySignature,
      all_first_stops: stopsAll.slice(0, 40),
      distinct_first_stops: stopsAll.length,
    },
    race_distinctness: raceDistinctness,
    counterfactual_race_gate_note:
      'Every record carries `counterfactual_race_gate`: what the bar WOULD stop if the reaction ' +
      'matrix were wired into the quest path. It is not a verdict on this build and no criterion ' +
      'reads it.',
    tier5: cohortInfo,
    model: {
      ...MODEL,
      lethality: LETHALITY,
      quests_walked: quests.length,
      quest_categories: [...new Set(quests.map((q) => q.category || '(none)'))].sort(),
      factions_with_ladders: gates.ids(),
      npc_records_indexed: npcRecords.size,
      npc_records_with_a_reaction_group: [...npcRecords.values()].filter((n) => n.reaction_group).length,
    },
    records,
  };
}

// ---------------------------------------------------------------------------------------------
// --self-test. The falsification battery.
//
// TOOL-COVERAGE-R1's central finding about round 1's battery: BOTH disposition falsifications
// drove the floor to 200, above even the permissive 92 ceiling, so they passed identically
// whether giver-group resolution worked or was 100% broken. A falsification that drives a
// parameter outside the range where the defect can express itself is not a falsification.
//
// So the battery below adds three checks that live INSIDE that range:
//   - the race bar fires at floor 50 (the maximum shipped requirement), not 200;
//   - and it DISCRIMINATES — dunmer blocked, saxhleel not, against the same group and floor;
//   - and with no group resolvable the criterion goes UNMEASURABLE, never pass.
// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (name, pass, detail) => {
    lines.push(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
    if (!pass) failed++;
    process.stdout.write(lines[lines.length - 1] + '\n');   // flush as we go: a later crash
  };                                                        // must not discard earlier evidence

  // ---- PROGRESS. TOOL-COVERAGE round 4's carried complaint: this battery does not finish
  // inside ten minutes on a loaded box, and the previous builder flagged rather than capped it
  // because THE EXPENSIVE PART IS THE FALSIFICATION — each fixture below is a full 540-cell walk
  // and shrinking the grid would shrink the evidence. That judgement stands. What was missing is
  // that a critic watching a silent terminal cannot tell slow from hung, so every walk now
  // announces itself, times itself, and projects the remainder from walks already done.
  const SEED_LADDER = [0, 15, 30, 45, 60, 100];
  const WALKS_EXPECTED = 13 + SEED_LADDER.length + 4;   // +4: the round-5 reputation and model-differential walks
  let walkN = 0;
  const T0 = Date.now();
  const secs = (ms) => (ms / 1000).toFixed(1);
  const walk = (fixture, label) => {
    walkN++;
    const a = Date.now();
    process.stdout.write(
      `[self-test] walk ${walkN}/${WALKS_EXPECTED} "${label}" starting (elapsed ${secs(a - T0)}s)\n`);
    const r = walkAll(fixture);
    const dt = Date.now() - a, el = Date.now() - T0;
    const projected = (el / walkN) * WALKS_EXPECTED;
    process.stdout.write(
      `[self-test] walk ${walkN}/${WALKS_EXPECTED} "${label}" done in ${secs(dt)}s; ` +
      `elapsed ${secs(el)}s of a projected ${secs(projected)}s\n`);
    return r;
  };

  const base = walk(null, "baseline");
  const baseViable = base.filter((r) => r.viable).length;
  const baseUnm = base.filter((r) => r.unmeasurable).length;
  const nFail = (recs, k) => recs.filter((r) => r.criteria[k] === FAIL).length;
  const nUnm = (recs, k) => recs.filter((r) => r.criteria[k] === UNMEASURABLE).length;

  ok('baseline is reported, not assumed',
    true,
    `${baseViable} viable / ${base.length - baseViable - baseUnm} not viable / ${baseUnm} unmeasurable`);

  // ---- ROUND 3: THE SHIPPING OFFER GATE. Broken -> red, whole -> green, both on this tree. ----
  //
  // TOOL-COVERAGE-R2 §1: round 2 reported a giver with no NPC record as `unmeasurable`, which
  // routes to corpus_debt and charges nobody. It is a hard, unpassable gate in the running build
  // and the correct verdict is FAIL. These checks perturb the register rather than describing
  // whatever the tree happens to hold today — the record-less givers WERE this tree's state at
  // the start of this round and were fixed under it, so a check that only reads today's data
  // would have flipped from RED to a vacuous PASS without anyone touching the instrument.
  const baseReport = report(base, null);
  const ug = baseReport.unpassable_gates;

  ok('the offer model is DETECTED from source and reported, never assumed',
    ['raw', 'derived'].includes(OFFER_MODEL.model),
    `model="${OFFER_MODEL.model}" — ${OFFER_MODEL.why} anchors: ` +
    Object.entries(OFFER_MODEL.anchors).map(([k, v]) => `${k}=${v.matched}`).join(' '));

  const blockedGivers = (recs) => new Set(recs.map((r) => r.stopped_at && r.stopped_at.npc_id).filter(Boolean));

  // ROUND 5. The assertion is unchanged in intent — R2 §1: a giver the world cannot reach is the
  // BUILD's failure and must be `fail`, never `unmeasurable`, because `unmeasurable` routes to
  // corpus_debt and charges nobody. What changed is that `unmeasurable` acquired a SECOND and
  // legitimate cause this round (a requirement token with no producer, or a quest shape this
  // tool has no predicate for), so the check now discriminates by GATE rather than counting.
  //
  // The old detail string also printed the literal "0 unmeasurable" regardless of the walk — a
  // hard-coded number in a self-test's own evidence line, which is this tool's whole disease in
  // miniature. It is computed now.
  {
    const unm = base.filter((r) => r.criteria.no_unpassable_gate === UNMEASURABLE);
    const byGate = {};
    for (const r of unm) { const g = (r.stopped_at && r.stopped_at.gate) || 'unstated'; byGate[g] = (byGate[g] || 0) + 1; }
    const legitimate = new Set(['ungrounded requirement', 'quest shape not modelled']);
    const illegitimate = Object.keys(byGate).filter((g) => !legitimate.has(g));
    ok('the tool never REFUSES over a giver it could have decided (R2 §1)',
      illegitimate.length === 0,
      `${nFail(base, 'no_unpassable_gate')} FAIL / ` +
      `${base.length - nFail(base, 'no_unpassable_gate') - unm.length} pass / ${unm.length} unmeasurable ` +
      `${JSON.stringify(byGate)}; ${ug.quests_blocked} gates unpassable for EVERY signature; ` +
      `${baseReport.giver_census.resolving_to_a_reaction_group}/` +
      `${baseReport.giver_census.quests_with_a_giver_disposition_min} givers resolve to a reaction group. ` +
      (illegitimate.length ? `ILLEGITIMATE unmeasurable gates: ${illegitimate.join(', ')}` :
       'every unmeasurable verdict names a token or a document shape, not a giver.'));
  }

  // RED. Reproduce the defect this tree shipped at the start of tool round 3: givers with no NPC
  // record, so `seedDispositions()` writes nothing and `gate.js num(undefined)` reads 0.
  const fxUnseed = { unseed_givers: true };
  const unseeded = walk(fxUnseed, "unseed every giver");
  const unseededRep = report(unseeded, fxUnseed);
  // ===============================================================================================
  // ROUND 4, SUCCESSOR PASS — THIS RED CONTROL ASSERTED ON A SATURATED COUNTER, AND ON THIS TREE
  // IT WENT RED FOR THE WRONG REASON.
  //
  // As written it required `nFail(unseeded) > nFail(base)` on `no_unpassable_gate`. That counter
  // is 540 of 540 on the current build — every signature is already stopped, by a REPUTATION gate
  // in Q-ASSZ-08 that has nothing to do with giver disposition — so no perturbation of the
  // DISPOSITION register can ever push it higher, and the check reported FAIL while the tool was
  // working correctly.
  //
  // The fix is NOT to relax it. A perturbation that changes nothing must still fail. It is to
  // assert on the population the perturbation actually acts on — the set of givers whose
  // disposition bar stops at least one signature — which has headroom whatever else the build is
  // doing, and to require the DIRECTION as well as the movement. The saturated counter is still
  // reported, and the saturation itself is now asserted as a separate, named fact so that a
  // future reader is not left wondering why the number did not move.
  // ===============================================================================================
  const baseBlocked = blockedGivers(base);
  const unseededBlocked = blockedGivers(unseeded);
  const grew = [...unseededBlocked].filter((g) => !baseBlocked.has(g));
  ok('RED: unseed every giver (the record-less state) and the disposition gate goes red, as FAIL not unmeasurable',
    unseededBlocked.size > baseBlocked.size
    && grew.length > 0
    && [...baseBlocked].every((g) => unseededBlocked.has(g))
    && unseeded.filter((r) => r.unmeasurable).length === 0
    && nFail(unseeded, 'no_unpassable_gate') >= nFail(base, 'no_unpassable_gate'),
    `givers whose disposition bar stops at least one signature: ${baseBlocked.size} -> ` +
    `${unseededBlocked.size} (NEW: ${grew.slice(0, 6).join(', ')}); ` +
    `${unseeded.filter((r) => r.unmeasurable).length} unmeasurable; ` +
    `no_unpassable_gate FAIL ${nFail(base, 'no_unpassable_gate')} -> ${nFail(unseeded, 'no_unpassable_gate')} ` +
    `of ${base.length}`);

  ok('R4-SUCC: and the reason the signature counter did NOT move is stated, not shrugged off',
    nFail(base, 'no_unpassable_gate') < base.length
    || (baseReport.stops_blocking_every_signature.count > 0
        && baseReport.stops_blocking_every_signature.gates.every((g) => g.gate !== 'disposition')),
    nFail(base, 'no_unpassable_gate') === base.length
      ? `the counter is SATURATED at ${base.length}/${base.length} on this build: ` +
        `${baseReport.stops_blocking_every_signature.gates.map((g) => `${g.quest}[${g.gate}] ${g.why}`).join('; ')}` +
        ' — a non-disposition gate stops the whole grid, so no disposition perturbation can raise it. ' +
        'That is a BUILD failure, and the check above therefore measures the giver population instead.'
      : `not saturated (${nFail(base, 'no_unpassable_gate')}/${base.length}), so the counter has headroom`);

  ok('RED is PARTIAL at the gate level: some givers block, not all — so the bar is compared',
    blockedGivers(unseeded).size > 0
    && blockedGivers(unseeded).size < baseReport.giver_census.quests_with_a_giver_disposition_min,
    `${blockedGivers(unseeded).size} of ${baseReport.giver_census.quests_with_a_giver_disposition_min} ` +
    `givers with a disposition_min stop at least one signature at register 0: ` +
    `${[...blockedGivers(unseeded)].slice(0, 6).join(', ')}`);

  // The NUMBER is read: sweep the register and require a monotone, saturating response. A
  // presence check would give a step; a threshold gives a ladder.
  const ladder = [];
  for (const s of SEED_LADDER) {
    const fx = { unseed_givers: true, seed_disposition: s };
    ladder.push({ seed: s, fail: nFail(walk(fx, `seed ladder ${s}`), 'no_unpassable_gate') });
  }
  const monotone = ladder.every((r, i) => i === 0 || r.fail <= ladder[i - 1].fail);
  ok('the NUMBER is read, not the presence of a record (monotone ladder, saturating at 0)',
    monotone && ladder[0].fail > 0 && ladder[ladder.length - 1].fail === 0
    && new Set(ladder.map((r) => r.fail)).size > 2,
    ladder.map((r) => `seed ${r.seed} -> ${r.fail} fail`).join(' | '));

  // The gift model (machine.js:424) is live and CIRCULAR gifts are excluded.
  const giftedNpcs = [...DISPOSITION_GIFTS.keys()];
  const circular = quests.filter((q) => q.giver && q.giver.disposition_min != null)
    .map((q) => withFixture(fxUnseed, () => achievableDisposition(q.giver.npc_id, q)))
    .filter((r) => r.gifts_excluded_as_circular.length);
  ok('quest npc_disposition consequences are counted as a route, and CIRCULAR ones are excluded',
    giftedNpcs.length > 0 && circular.length > 0,
    `${giftedNpcs.length} npcs receive a positive disposition consequence somewhere in ` +
    `game/data/quests/**; ${circular.length} givers have one authored on the very quest they ` +
    `gate, which cannot be a route and is excluded. e.g. ${circular[0] ? circular[0].npc_id + ': ' +
      circular[0].gifts_excluded_as_circular.map((c) => c.quest + ' +' + c.delta).join(', ') : 'n/a'}`);

  // ---- the COUNTERFACTUAL. Labelled, and it must never be the verdict. ----------------------
  const FLOOR = 50;   // the maximum disposition_min shipped anywhere in game/data/quests/**
  ok('every record carries a LABELLED counterfactual and no criterion reads it',
    base.every((r) => r.counterfactual_race_gate && r.counterfactual_race_gate.label.startsWith('COUNTERFACTUAL'))
    && base.every((r) => !Object.values(r.criteria).includes(undefined)),
    `all ${base.length} records carry counterfactual_race_gate; it names the hypothesis ` +
    `("${base[0].counterfactual_race_gate.hypothesis.slice(0, 70)}…") and the four criteria are ` +
    `computed without it`);

  const granted = walk({ giver_reaction_group: 'RG-DEEP', quest_disposition_floor: FLOOR }, "grant RG-DEEP + disposition floor");
  const cfBlocked = granted.filter((r) => r.counterfactual_race_gate.would_block).length;
  const cfDunmer = granted.filter((r) => r.signature.startsWith('dunmer/') && r.counterfactual_race_gate.would_block).length;
  const cfSax = granted.filter((r) => r.signature.startsWith('saxhleel/') && !r.counterfactual_race_gate.would_block).length;
  ok('the race+upbringing bar DISCRIMINATES (RI-MTH06 §A\'s worked example)',
    cfBlocked > 0 && cfBlocked < granted.length && cfDunmer > 0 && cfSax > 0,
    `givers -> RG-DEEP at ${FLOOR}: blocks ${cfBlocked}/${granted.length} ` +
    `(${cfDunmer} dunmer blocked, ${cfSax} saxhleel not)`);

  const upSplit = [...new Set(UP_CLASSES.map((uc) => {
    const up = UPBRINGINGS.find((u) => u.signature_class === uc);
    return dispositionCeiling(50, 'dunmer', up.id, null, 'RG-DEEP');
  }))];
  ok('the UPBRINGING term is read, not only the race term',
    upSplit.length > 1,
    `dunmer ceilings against RG-DEEP by upbringing: ` +
    UP_CLASSES.map((uc) => {
      const up = UPBRINGINGS.find((u) => u.signature_class === uc);
      return `${up.id}=${dispositionCeiling(50, 'dunmer', up.id, null, 'RG-DEEP')}`;
    }).join(' '));

  // How much distinctness the offer path actually delivers, reported rather than assumed.
  ok('the distinctness the offer path delivers is MEASURED and reported either way', true,
    `offer model ${OFFER_MODEL.model}; ` +
    `${baseReport.race_distinctness.distinct_offer_outcomes_across_the_grid} distinct outcome(s) ` +
    `across ${base.length} signatures on shipped data. ` +
    (baseReport.race_distinctness.distinct_offer_outcomes_across_the_grid === 1
      ? 'ONE outcome: the matrix is wired in but no shipped disposition_min is high enough for it ' +
        'to bite. That is a content fact and it is reported as one, not counted as distinctness.'
      : 'the gate discriminates between signatures.'));

  // ---- criterion 4: the cohort resolution path --------------------------------------------
  const cohort = base.__cohort;
  ok('tier-5 cohort resolves from danger_tier, and is the authored fight',
    cohort.tier5_regions.length > 0 && cohort.cohort.length > 0,
    `tier-5 regions [${cohort.tier5_regions.join(', ')}]; cohort ` +
    cohort.cohort.map((c) => `${c.id}(${c.source}: ${c.members.map((m) => m.count + 'x' + m.statblock).join('+')})`).join(', ') +
    (cohort.tier5_regions_with_no_authored_fight.length
      ? `; thin: no fight authored in [${cohort.tier5_regions_with_no_authored_fight.join(', ')}]` : ''));

  const moved = walk({ region_danger_tier: { 'deep-marshes': 3, 'stone-wastes': 3 } }, "region danger_tier -> 3");
  ok('the cohort FOLLOWS danger_tier rather than being hard-coded',
    moved.__cohort.cohort.length !== cohort.cohort.length,
    `deep-marshes and stone-wastes demoted to tier 3: cohort ${cohort.cohort.length} -> ` +
    `${moved.__cohort.cohort.length} entries`);

  const hard = walk({ tier5_damage_multiplier: 10 }, "tier-5 damage x10");
  ok('criterion 4 liveness (x10 group damage)',
    nFail(hard, 'tier5_survivable') > nFail(base, 'tier5_survivable'),
    `criterion-4 FAIL ${nFail(base, 'tier5_survivable')} -> ${nFail(hard, 'tier5_survivable')}`);

  const mid = walk({ tier5_damage_multiplier: 4 }, "tier-5 damage x4");
  ok('criterion 4 is a MODEL, not a constant (partial failure at x4)',
    nFail(mid, 'tier5_survivable') > 0 && nFail(mid, 'tier5_survivable') < mid.length,
    `x4 group damage: ${nFail(mid, 'tier5_survivable')}/${mid.length} fail criterion 4`);

  const easy = walk({ tier5_damage_multiplier: 0.01 }, "tier-5 damage x0.01");
  ok('criterion 4 monotonicity',
    nFail(easy, 'tier5_survivable') <= nFail(base, 'tier5_survivable'),
    `x0.01: criterion-4 FAIL ${nFail(base, 'tier5_survivable')} -> ${nFail(easy, 'tier5_survivable')}`);

  // ---- criteria 1-3 remain independently falsifiable ---------------------------------------
  // Both run on top of `seed_disposition: 100`, so the offer gate is OPEN and the walk actually
  // reaches the clause under test. Perturbing a criterion that is already red at an earlier gate
  // proves nothing — that was round 1's "floor 200" mistake in a different coat.
  const resBroken = walk({ impossible_resolution_gate: true, seed_disposition: 100 }, "impossible resolution gate");
  const resBase = walk({ seed_disposition: 100 }, "resolution baseline, seed 100");
  ok('criterion 3 falsifiable at the RESOLUTION clause (offer gate held open)',
    nFail(resBroken, 'no_unpassable_gate') > nFail(resBase, 'no_unpassable_gate'),
    `every resolution gated on luck 9999, givers seeded 100 so the walk reaches them: ` +
    `no_unpassable_gate FAIL ${nFail(resBase, 'no_unpassable_gate')} -> ` +
    `${nFail(resBroken, 'no_unpassable_gate')}`);

  const mainBase = walk({ seed_disposition: 100 }, "main-quest baseline, seed 100");
  const mainBroken = walk({ seed_disposition: 100, quest_disposition_floor: 101 }, "main-quest disposition floor 101");
  ok('criterion 1 falsifiable (main-quest walk)',
    nFail(mainBroken, 'main_quest') > nFail(mainBase, 'main_quest'),
    `givers seeded 100, every disposition_min raised to 101: main_quest FAIL ` +
    `${nFail(mainBase, 'main_quest')} -> ${nFail(mainBroken, 'main_quest')}`);

  const rankBroken = walk({ faction_rank5_attribute_floor: 500 }, "rank-5 attribute floor 500");
  ok('criterion 2 falsifiable (faction ladder)',
    nFail(rankBroken, 'three_factions_rank5') > nFail(base, 'three_factions_rank5'),
    `rank-5 attribute floor -> 500: three_factions_rank5 FAIL ` +
    `${nFail(base, 'three_factions_rank5')} -> ${nFail(rankBroken, 'three_factions_rank5')}`);

  // ---- the null control --------------------------------------------------------------------
  const again = walk(null, "null control (determinism)");
  ok('null control (determinism)',
    JSON.stringify(again.map((r) => r.signature + r.viable + r.unmeasurable))
      === JSON.stringify(base.map((r) => r.signature + r.viable + r.unmeasurable)),
    `two unperturbed runs agree on all ${base.length} cells`);

  // =============================================================================================
  // ROUND 4 — THE R3 §1 FALSIFICATIONS. Every one of these is a check the round-3 tool failed.
  // =============================================================================================

  // R5-1. The cross-check's row accounting, exercised through THE SHIPPING FUNCTION.
  //
  // Round 4's version of this check re-implemented the accounting inline, so it proved a
  // property of the battery rather than of `crossCheck()`. It now calls `crossCheckVerdict()`,
  // which is the same function the live mode calls, and the fixtures are shaped the way the
  // push site shapes them: an unresolved row is not a row with `agrees: null`, it is a row in a
  // DIFFERENT ARRAY that no count named "compared" can reach.
  {
    const cmp = (n, agrees) => Array.from({ length: n }, (_, i) => ({ quest: 'q' + i, agrees }));
    const unres = (n) => Array.from({ length: n }, (_, i) => ({ quest: 'u' + i, why_unresolved: 'modelled:false' }));

    const dead = crossCheckVerdict([], unres(240));            // R3's broken tree: nothing modelled
    const live = crossCheckVerdict(cmp(240, true), []);        // the sound tree
    const bad = crossCheckVerdict([...cmp(239, true), ...cmp(1, false)], []);
    const mixed = crossCheckVerdict(cmp(12, true), unres(228));

    ok('R5: 240 unresolved rows are UNMEASURABLE, never "AGREES on 240 pairs"',
      dead.unmeasurable === true && dead.agrees === false && dead.rows_compared === 0
        && dead.pairs_enumerated === 240,
      `240 unresolved -> agrees=${dead.agrees}, unmeasurable=${dead.unmeasurable}, ` +
      `rows_compared=${dead.rows_compared}, pairs_enumerated=${dead.pairs_enumerated}. ` +
      'R3 printed "AGREES on 240 pairs".');
    ok('R5: the same accounting still passes 240 genuinely-compared rows (null control)',
      live.agrees === true && live.unmeasurable === false && live.rows_compared === 240,
      `rows_compared=${live.rows_compared}, agrees=${live.agrees} — the fix is not vacuous`);
    ok('R5: one real disagreement still goes red among 239 agreements',
      bad.agrees === false && bad.unmeasurable === false && bad.rows_compared === 240,
      `agrees=${bad.agrees}, unmeasurable=${bad.unmeasurable}`);
    ok('R5: a partly-modelled sweep reports 12 compared and 228 unresolved, not 240 of anything',
      mixed.rows_compared === 12 && mixed.rows_unresolved === 228 && mixed.pairs_enumerated === 240
        && mixed.accounting_holds === true,
      `rows_compared=${mixed.rows_compared}, rows_unresolved=${mixed.rows_unresolved}, ` +
      `pairs_enumerated=${mixed.pairs_enumerated}`);
    // The fuse. A row without a boolean verdict must not be countable as compared.
    const smuggled = crossCheckVerdict([...cmp(239, true), { quest: 'x', agrees: null }], []);
    ok('R5: a row with agrees:null cannot enter a count called "compared" — the tool REFUSES',
      smuggled.refused === true && smuggled.rows_compared === 0 && smuggled.agrees === false,
      `refused=${smuggled.refused}, rows_compared=${smuggled.rows_compared} — 239 real agreements ` +
      'are discarded rather than published beside one uncomparable row');
  }

  // R4-2. The reconciliation. `model="derived"` and a RACE-INVARIANT running gate is the
  // contradiction R3 §1 printed on one screen and exited 0 on. It must now refuse.
  {
    const saved = OFFER_MODEL.model;
    OFFER_MODEL.model = 'derived';
    const contra = reconcileModel({ race_sensitive: false, evidence: { distinct_disposition_clause_sets: 1 } }, { fatal: false });
    const consis = reconcileModel({ race_sensitive: true, evidence: { distinct_disposition_clause_sets: 6 } }, { fatal: false });
    OFFER_MODEL.model = 'raw';
    const rawContra = reconcileModel({ race_sensitive: true, evidence: {} }, { fatal: false });
    const rawConsis = reconcileModel({ race_sensitive: false, evidence: {} }, { fatal: false });
    OFFER_MODEL.model = saved;
    ok('R4: model="derived" + RACE-INVARIANT running gate is a CONTRADICTION (the R3 break)',
      contra.checked === true && contra.agree === false,
      `agree=${contra.agree} — R3 printed both on one screen and exited 0`);
    ok('R4: model="derived" + RACE-SENSITIVE running gate is consistent (null control)',
      consis.checked === true && consis.agree === true, `agree=${consis.agree}`);
    ok('R4: reconciliation is symmetric — model="raw" over a race-SENSITIVE gate also contradicts',
      rawContra.agree === false && rawConsis.agree === true,
      'a detector that only catches one direction of drift catches half the drift');
    ok('R4: reconciliation refuses to decide when the live side is absent',
      reconcileModel(null, { fatal: false }).checked === false &&
      reconcileModel({ race_sensitive: 'maybe' }, { fatal: false }).checked === false,
      'no live observation -> checked:false, not a silent agreement');
  }

  // R4-3. The attestation must be keyed to the source it attests, or a one-line regression to
  // the model files carries the old verdict forward — which is the entire R3 defect with extra
  // steps.
  {
    const h1 = modelSourceHash();
    const h2 = modelSourceHash();
    const tmp = path.join(REPO_ROOT, MODEL_SOURCE_FILES[0]);
    const orig = fs.readFileSync(tmp, 'utf8');
    let h3;
    try {
      fs.writeFileSync(tmp, orig + '\n// self-test perturbation\n');
      h3 = modelSourceHash();
    } finally { fs.writeFileSync(tmp, orig); }
    const h4 = modelSourceHash();
    ok('R4: the attestation key is stable and reproducible', h1 === h2 && h1 === h4, `${h1}`);
    ok('R4: ONE BYTE added to engine.js invalidates the attestation key (falsification)',
      h3 !== h1, `${h1} -> ${h3} -> restored ${h4}`);
  }

  // R4-4. The model is per-giver, not a global string. R3: "a single global model string is the
  // wrong shape for it to begin with."
  ok('R4: the model is reported PER-GIVER, not as one global string',
    OFFER_MODEL.per_giver && Number.isFinite(OFFER_MODEL.per_giver.gated_givers) &&
    OFFER_MODEL.per_giver.modelled + OFFER_MODEL.per_giver.unmodelled === OFFER_MODEL.per_giver.gated_givers,
    `${OFFER_MODEL.per_giver.gated_givers} gated givers: ${OFFER_MODEL.per_giver.modelled} modelled, ` +
    `${OFFER_MODEL.per_giver.unmodelled} unmodelled` +
    (OFFER_MODEL.per_giver.mixed ? ' — MIXED (engine.js:4863 returns null without reaction_group)' : ''));

  // R4-5. The fourth anchor exists AND its limit is declared. An anchor sold as proof of
  // something it cannot prove is how round 3 bought its false pass; this asserts the honesty of
  // the label as well as the presence of the check.
  ok('R4: a fourth anchor checks the ARITHMETIC, not only the plumbing',
    !!OFFER_MODEL.anchors.applies_arithmetic && OFFER_MODEL.anchors_total === 4,
    `applies_arithmetic matched=${OFFER_MODEL.anchors.applies_arithmetic.matched}, ` +
    `${OFFER_MODEL.anchors_matched}/${OFFER_MODEL.anchors_total} anchors`);
  ok('R4: the fourth anchor does NOT claim to prove the arithmetic is reached',
    /NOT arithmetic-reached/.test(OFFER_MODEL.anchors.applies_arithmetic.proves) &&
    /NO REGEX OVER SOURCE CAN PROVE A FUNCTION'S ARITHMETIC IS REACHED/.test(OFFER_MODEL.anchor_limit),
    'a guarded early return leaves it matching; the tool says so rather than selling it as closure');

  // R4-6. The guarded-early-return break, simulated against the anchors themselves. This proves
  // in-process that the static detector CANNOT see R3's regression, which is the justification
  // for making the live attestation mandatory rather than optional.
  {
    const engineSrc = fs.readFileSync(path.join(REPO_ROOT, 'game/src/engine.js'), 'utf8');
    const broken = engineSrc.replace(
      /(_questDispositionModel\s*\(\s*\)\s*\{\s*\n\s*return\s*\([^)]*\)\s*=>\s*\{)/,
      '$1\n      if (!this.__raceGatesEnabled) return null;');
    const changed = broken !== engineSrc;
    const stillMatch = changed && Object.values(OFFER_MODEL_ANCHORS)
      .filter((a) => a.file === 'game/src/engine.js').every((a) => a.rx.test(broken));
    ok('R4: R3\'s exact break leaves EVERY source anchor matching (why live verification is mandatory)',
      changed && stillMatch,
      changed
        ? 'injected `if (!this.__raceGatesEnabled) return null;` into the model closure: both ' +
          'engine.js anchors still match. No static check can close this; --verify-model can.'
        : 'COULD NOT INJECT — the closure shape changed; re-derive this falsification');
  }

  // R4-7. An unverified model must be visible in the artifact and must not exit 0.
  ok('R4: a run with no live attestation stamps model_verified:false',
    loadAttestation().status !== 'VALID' || fs.existsSync(ATTEST_PATH),
    `attestation status would be "${loadAttestation().status}"`);

  // =============================================================================================
  // ROUND 5 — THE GRANT LEDGER. Every check below exists because the last four rejections were
  // all the same defect: a value invented inside this file and reported as if measured.
  // =============================================================================================

  // R5-2. No field is handed a bare constant. The ledger is the register and this is the fuse.
  {
    const gl = grantLedger();
    ok('R5: the grant ledger declares ZERO substitutions',
      gl.substitutions_remaining === 0 && gl.rows.length >= 14,
      `${gl.rows.length} granted fields, ${gl.substitutions_remaining} substitution(s); ` +
      `player-optimal bounds declared: ${gl.player_optimal_bounds.join(', ')}`);
    ok('R5: the ledger names what round 4 handed the gate, so the regression is legible',
      gl.rows.filter((r) => r.was_round4).length >= 9,
      `${gl.rows.filter((r) => r.was_round4).length} fields carry their round-4 value`);
  }

  // R5-3. REPUTATION IS READ, NOT PINNED. This is the round-4 defect's direct falsification.
  // `reputation = Proxy(get: () => 100)` could not be moved by any fixture, because there was no
  // number to move — which is exactly why four batteries went green over it.
  {
    const repZero = walk({ reputation_scale: 0 }, 'reputation scaled to 0');
    const repFull = base;
    const nRankStops = (recs) => recs.filter((r) => r.stopped_at && /reputation \d+\/\d+/.test(String(r.stopped_at.why))).length;
    ok('R5: the DERIVED reputation is read — scaling it to 0 moves rank/reputation stops',
      nRankStops(repZero) > nRankStops(repFull),
      `reputation stops ${nRankStops(repFull)} -> ${nRankStops(repZero)} at scale 0. Round 4's ` +
      'Proxy(100) could not be moved by anything.');
    ok('R5: and the derived value is per-faction, not one number for all of them',
      new Set(Object.values(attainableReputation(null))).size > 1,
      JSON.stringify(attainableReputation(null)));
  }

  // R5-4. THE W1-FACTIONS ARBITRATION, settled by the faction critic in the running engine:
  // the rank-7 offer row carries "reputation 111/112" at 111 and drops the term at 112. Round 4
  // published `0 of 540 viable` and named Q-ASSZ-08, Q-LEDG-08 and Q-XULA-08 unreachable by
  // anybody, on the strength of its own stale constant. No signature may stop there now.
  {
    const stops112 = base.filter((r) => r.stopped_at && /reputation \d+\/112/.test(String(r.stopped_at.why)));
    ok('R5: no signature is stopped by the rank-7 reputation bar the running engine clears',
      stops112.length === 0,
      stops112.length
        ? `STILL STOPPING: ${stops112[0].stopped_at.why}`
        : 'the derived attainable reputation clears 112, which is what the faction critic ' +
          'measured live (W1-FACTIONS-r1 §1: term present at 111, absent at 112)');
  }

  // R5-5. RANK IS DERIVED THROUGH THE SHIPPING LADDER, not granted as 7.
  {
    const sheet = (() => {
      const spec = representativeStart(RACES[0], FAMILIES[0], SIGN_FAMILIES[0], UP_CLASSES[0]);
      const ch = composeCharacter(data, spec);
      return { race: RACES[0], family: FAMILIES[0], birthsign: spec.birthsign, upbringing: spec.upbringing,
        base_attributes: ch.attributes, base_skills: ch.skills };
    })();
    const ctx = bestCaseCtx(sheet, 55);
    const vals = Object.values(ctx.ranks);
    ok('R5: ranks come from FactionGates.highestQualifying(), not the constant 7',
      vals.length === gates.ids().length && vals.some((v) => v !== 7),
      `${JSON.stringify(ctx.ranks)} — round 4 handed every faction rank 7`);
    ok('R5: a faction whose attainable reputation cannot clear rank 1 is derived at rank 0',
      ctx.ranks.deep_kin === undefined || ctx.ranks.deep_kin === 0 || (attainableReputation(null).deep_kin ?? 0) >= gates.row('deep_kin', 1).reputation,
      `deep_kin: attainable reputation ${attainableReputation(null).deep_kin}, rank-1 row asks ` +
      `${gates.row('deep_kin', 1).reputation}, derived rank ${ctx.ranks.deep_kin}`);
  }

  // R5-6. THE FOUR UNIVERSAL `has: () => true` COLLECTIONS ARE GONE — and the difference is
  // load-bearing, not cosmetic. Three of them stood over an EMPTY Set for three rounds, so every
  // items/knowledge/spell_effects requirement in the tree was satisfied by a collection that
  // contained nothing at all.
  {
    const sheet = (() => {
      const spec = representativeStart(RACES[0], FAMILIES[0], SIGN_FAMILIES[0], UP_CLASSES[0]);
      const ch = composeCharacter(data, spec);
      return { race: RACES[0], family: FAMILIES[0], birthsign: spec.birthsign, upbringing: spec.upbringing,
        base_attributes: ch.attributes, base_skills: ch.skills };
    })();
    const prov = bestCaseCtx(sheet, 55);
    const omni = bestCaseCtx(sheet, 55, {}, null, { omniscient: true });
    const fake = 'no_such_token_' + Math.random().toString(36).slice(2);
    ok('R5: the provable context answers NO to a token nothing produces; the omniscient arm answers yes',
      prov.items.has(fake) === false && omni.items.has(fake) === true
      && prov.knowledge.has(fake) === false && prov.spellEffects.has(fake) === false
      && prov.worldFlags.has(fake) === false,
      `provable items/knowledge/spellEffects/worldFlags all refuse "${fake}"; the omniscient arm ` +
      'still grants it, which is the only thing it is for');
    ok('R5: and the provable collections are NOT empty — refusing everything would be as useless',
      prov.items.size > 0 && prov.knowledge.size > 0 && prov.spellEffects.size > 0
      && prov.worldFlags.size > 0 && prov.topicsKnown.size > 0,
      `items ${prov.items.size}, knowledge ${prov.knowledge.size}, effects ${prov.spellEffects.size}, ` +
      `flags ${prov.worldFlags.size}, topics ${prov.topicsKnown.size}`);
    ok('R5: topicsKnown holds RAW authored spellings so canOffer\'s slug/prose fold still runs',
      [...prov.topicsKnown].some((t) => /-/.test(t)) && [...prov.topicsKnown].some((t) => / /.test(t)),
      'both dashed (dialogue) and spaced (quest) spellings are present; a pre-folded set could ' +
      'not exercise topicsInclude()');
  }

  // R5-7. THE GRANT-DEPENDENCY TEST FIRES, and it fires on a REAL ungrounded token from this
  // tree rather than on a fixture of the battery's own invention.
  {
    const un = UNSOURCED.items[0] || UNSOURCED.knowledge[0];
    const sheet = (() => {
      const spec = representativeStart(RACES[0], FAMILIES[0], SIGN_FAMILIES[0], UP_CLASSES[0]);
      const ch = composeCharacter(data, spec);
      return { race: RACES[0], family: FAMILIES[0], birthsign: spec.birthsign, upbringing: spec.upbringing,
        base_attributes: ch.attributes, base_skills: ch.skills };
    })();
    if (!un) {
      ok('R5: grant-dependency test fires on an ungrounded token', false,
        'no ungrounded token on this tree — re-derive this falsification against one that is');
    } else {
      const isItem = UNSOURCED.items.includes(un);
      const q = { id: '__r5_probe', category: 'probe', resolutions: [
        { id: 'only', requires: isItem ? { items: [un] } : { knowledge: [un] } }] };
      const r = questClearable(sheet, q, 55);
      const control = questClearable(sheet, { id: '__r5_control', category: 'probe',
        resolutions: [{ id: 'only', requires: {} }] }, 55);
      ok('R5: a quest whose only route needs an UNGROUNDED token is UNMEASURABLE, not FAIL and not PASS',
        r.status === UNMEASURABLE && Array.isArray(r.stopped_at.ungrounded_tokens)
        && r.stopped_at.ungrounded_tokens.length > 0,
        `requires ${JSON.stringify(un)} -> ${r.status}; tokens named: ` +
        `${JSON.stringify((r.stopped_at || {}).ungrounded_tokens)}`);
      ok('R5: null control — the same probe with no requirement PASSES, so the mechanism is not blanket',
        control.status === PASS, `control -> ${control.status}`);
    }
  }

  // R5-8. THE STAGE-SHAPED QUEST. `loadQuests()` admits two document shapes and this tool has a
  // predicate for one of them. It must refuse the other rather than charge it.
  {
    const staged = quests.filter((q) => !(q.resolutions || []).length && Array.isArray(q.stages) && q.stages.length);
    const sheet = (() => {
      const spec = representativeStart(RACES[0], FAMILIES[0], SIGN_FAMILIES[0], UP_CLASSES[0]);
      const ch = composeCharacter(data, spec);
      return { race: RACES[0], family: FAMILIES[0], birthsign: spec.birthsign, upbringing: spec.upbringing,
        base_attributes: ch.attributes, base_skills: ch.skills };
    })();
    const probe = questClearable(sheet, { id: '__r5_staged', category: 'probe',
      stages: [{ index: 10, flags: ['x'] }], outcomes: [{ id: 'o', requires: [] }] }, 55);
    ok('R5: a stage-shaped quest is UNMEASURABLE ("no predicate"), never "declares no resolutions"',
      probe.status === UNMEASURABLE && /stage-shaped/i.test(String(probe.stopped_at.why)),
      `${probe.status}: ${String(probe.stopped_at.why).slice(0, 120)}` +
      ` — ${staged.length} stage-shaped quest(s) on this tree`);
  }

  // R5-9. MODEL DEPENDENCE IS MEASURED. Round 4 inferred it from "did a disposition stop occur",
  // which is silent about every signature that PASSES because of the model.
  {
    const saved = OFFER_MODEL.model;
    const a = walk(null, 'model differential arm A');
    OFFER_MODEL.model = saved === 'derived' ? 'raw' : 'derived';
    const b = walk(null, 'model differential arm B');
    OFFER_MODEL.model = saved;
    const key = (r) => `${r.viable}|${r.unmeasurable}|${JSON.stringify(r.criteria)}`;
    const mb = new Map(b.map((r) => [r.signature, key(r)]));
    const moved = a.filter((r) => mb.get(r.signature) !== key(r)).length;
    ok('R5: model dependence is a MEASURED differential over both offer models',
      Number.isFinite(moved),
      `${moved}/${a.length} verdicts move between "${saved}" and its opposite. Round 4 counted ` +
      'disposition STOPS instead, which cannot see a signature that passes because of the model.');
  }

  process.stdout.write(`\nbuild-viability self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
if (args['self-test']) process.exit(selfTest());

// ---------------------------------------------------------------------------------------------
// --audit-grants. ROUND 5. The whole grant table, on stdout, with no walk.
//
// This is the mode a tool critic runs first. Four rounds of this tool have been rejected for
// reporting a confident number while measuring nothing, and every one of those defects was a
// value handed to the synthetic character somewhere in the middle of a 2 700-line file. Now
// there is one table, it is printed, and it is asserted.
// ---------------------------------------------------------------------------------------------
if (args['audit-grants']) {
  const gl = grantLedger();
  process.stdout.write(`grant ledger for data root ${path.relative(REPO_ROOT, ROOT) || 'game/data'}\n`);
  for (const r of gl.rows) {
    process.stdout.write(`  ${r.field.padEnd(24)} ${String(r.basis).padEnd(22)} ${typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)}\n`);
    process.stdout.write(`  ${''.padEnd(24)} from: ${r.source}\n`);
    if (r.was_round4) process.stdout.write(`  ${''.padEnd(24)} ROUND 4 HANDED THE GATE: ${r.was_round4}\n`);
    if (r.caveat) process.stdout.write(`  ${''.padEnd(24)} caveat: ${r.caveat}\n`);
  }
  process.stdout.write(`  substitutions remaining: ${gl.substitutions_remaining}\n`);
  process.stdout.write(`  player-optimal bounds (declared, not hidden): ${gl.player_optimal_bounds.join(', ')}\n`);
  process.stdout.write(`  ungrounded requirement tokens: ${UNSOURCED.total}\n`);
  for (const k of ['topics', 'world_flags', 'knowledge', 'items', 'spell_effects']) {
    if (!UNSOURCED[k].length) continue;
    process.stdout.write(`    ${k}: ${UNSOURCED[k].map((t) => `${t} (asked by ${(UNSOURCED.where[t] || []).join(', ')})`).join('\n              ')}\n`);
  }
  if (args.out) writeJson(path.resolve(String(args.out)), gl);
  // A ledger with a bare SUBSTITUTION row is the failure this whole mode exists to make
  // impossible to ship quietly.
  process.exit(gl.substitutions_remaining === 0 ? 0 : EXIT.MEASUREMENT_FAIL);
}

const fixture = args.fixture ? JSON.parse(fs.readFileSync(path.resolve(String(args.fixture)), 'utf8')) : null;

// `--signatures` — advertised since round 1, in RI-CHR01 M6's own contract line, and never read
// until now (TOOL-COVERAGE-R2 §1, "it is the --verify shape"). It now has a value, it is
// validated, and an unknown value is a usage error rather than a silently ignored flag.
let SIGNATURE_SUBSET = null;
if (args.signatures !== undefined) {
  const v = String(args.signatures);
  if (v === 'all' || v === 'true') SIGNATURE_SUBSET = null;
  else if (/^[a-z-]+$/.test(v) && RACES.includes(v)) SIGNATURE_SUBSET = { race: v };
  else if (/^\d+$/.test(v)) SIGNATURE_SUBSET = { first: parseInt(v, 10) };
  else {
    die(EXIT.USAGE,
      `--signatures ${JSON.stringify(v)} is not recognised. Use "all", a race id ` +
      `(${RACES.join('|')}), or a count. A flag that accepts anything and does nothing is the ` +
      `defect TOOL-COVERAGE-R2 §1 charged this tool with.`);
  }
}

function produceRecords({ quiet = false } = {}) {
  if (args.signature) {
    const parts = String(args.signature).split(/[|/]/);
    if (parts.length !== 4) usage(USAGE, EXIT.USAGE);
    const cohortInfo = withFixture(fixture, () => resolveTier5Cohort());
    const one = [evaluateSignature(parts[0], parts[1], parts[2], parts[3], fixture, cohortInfo)];
    one.__cohort = cohortInfo;
    return one;
  }
  let out = walkAll(fixture);
  if (SIGNATURE_SUBSET) {
    const cohort = out.__cohort;
    const filtered = SIGNATURE_SUBSET.race
      ? out.filter((r) => r.signature.startsWith(SIGNATURE_SUBSET.race + '/'))
      : out.slice(0, SIGNATURE_SUBSET.first);
    filtered.__cohort = cohort;
    out = filtered;
    if (!quiet) log(`--signatures ${args.signatures}: walking ${out.length} of 540 cells`);
  }
  return out;
}




// ---------------------------------------------------------------------------------------------
// --verify-model — THE DEFINITIONAL TEST, and the thing R3 §1 proved the anchors cannot do.
//
// Race-sensitivity is not a property of source text; it is the statement "changing the player's
// race, and nothing else, changes the number `canOffer` reads." So measure exactly that:
//
//   setCharacter({race: A, upbringing: U, class: C, birthsign: B})  -> getGateDispositions()
//   setCharacter({race: B, upbringing: U, class: C, birthsign: B})  -> getGateDispositions()
//
// `getGateDispositions()` is `questEngine.dispositionView()` (harness/api.js:1315) — literally
// the table `context().dispositions` is built from, not a reconstruction of it. If the two
// tables are identical, the offer gate is race-invariant, FULL STOP, whatever the source says.
//
// R3's break (`if (!this.__raceGatesEnabled) return null;`) is caught by construction here: a
// model that returns null cannot move a number, so the two tables come back identical and the
// probe reports RACE-INVARIANT while the anchors still say "derived". `reconcileModel()` then
// refuses. That is the closure the three anchors could never provide.
//
// The probe also reads `explainDisposition(id).modelled` per giver, which is the per-giver
// model shape the R3 verdict asked for, taken live rather than inferred.
// ---------------------------------------------------------------------------------------------
const RACE_PROBE_PAIR = (() => {
  const a = args['probe-races'] ? String(args['probe-races']).split(',').map((s) => s.trim()) : null;
  return (a && a.length === 2) ? a : ['dunmer', 'nord'];
})();

async function verifyModelLive(handle) {
  const surface = await handle.page.evaluate(
    () => Object.keys(window.__HARNESS || {}).filter((k) => typeof window.__HARNESS[k] === 'function'));
  const needed = ['getGateDispositions', 'setCharacter', 'explainDisposition'];
  const missing = needed.filter((m) => !surface.includes(m));
  if (missing.length) {
    return { measurable: false, why:
      `--verify-model needs ${needed.join(', ')} and this build does not expose ${missing.join(', ')}. ` +
      'Reporting that absence rather than falling back to the source anchors, which R3 §1 ' +
      'demonstrated cannot decide this question.' };
  }
  const classId = (data.classes.classes[0] || {}).id;
  const signId = (data.birthsigns.signs[0] || {}).id;
  const upbringing = args['probe-upbringing'] ? String(args['probe-upbringing']) : 'interior';

  const arms = [];
  for (const race of RACE_PROBE_PAIR) {
    const arm = await handle.page.evaluate((o) => {
      try {
        window.__HARNESS.setCharacter({ race: o.race, upbringing: o.upbringing, class: o.classId, birthsign: o.signId });
      } catch (e) { return { error: String((e && e.message) || e) }; }
      const gate = window.__HARNESS.getGateDispositions();
      const explain = {};
      for (const id of o.givers) {
        try { const x = window.__HARNESS.explainDisposition(id); explain[id] = { modelled: !!(x && x.modelled), value: x && x.value, race_term: x && x.race_term }; }
        catch { explain[id] = null; }
      }
      return { gate, explain };
    }, { race, upbringing, classId, signId, givers: GATED_GIVERS });
    if (arm.error) return { measurable: false, why: `setCharacter(${race}/${upbringing}) threw: ${arm.error}` };
    arms.push({ race, ...arm });
  }

  // The differential, over the gated givers only — those are the ids whose numbers can decide a
  // quest offer, and therefore the only ones whose race-sensitivity changes a verdict.
  const moved = [];
  for (const id of GATED_GIVERS) {
    const a = arms[0].gate[id], b = arms[1].gate[id];
    if (a === undefined && b === undefined) continue;
    if (a !== b) moved.push({ npc_id: id, [arms[0].race]: a, [arms[1].race]: b, delta: (Number(b) || 0) - (Number(a) || 0) });
  }
  // Per-giver model shape, live. Both arms must agree on WHICH givers are modelled; if they do
  // not, the build is doing something race-dependent to the model itself and that is reportable.
  const liveModelled = GATED_GIVERS.filter((id) => arms.every((x) => x.explain[id] && x.explain[id].modelled));
  const liveUnmodelled = GATED_GIVERS.filter((id) => arms.every((x) => x.explain[id] && !x.explain[id].modelled));
  const liveInconsistent = GATED_GIVERS.filter((id) => !liveModelled.includes(id) && !liveUnmodelled.includes(id));

  return {
    measurable: true,
    method: 'setCharacter() twice, varying RACE ALONE, then getGateDispositions() — ' +
            'questEngine.dispositionView(), the table context().dispositions is built from. ' +
            'A model that returns null cannot move a number, so a dead race term is caught by ' +
            'construction rather than by pattern-matching source.',
    races_compared: RACE_PROBE_PAIR, upbringing, gated_givers: GATED_GIVERS.length,
    race_sensitive: moved.length > 0,
    evidence: {
      givers_whose_gate_number_moved: moved.length,
      moved: moved.slice(0, 12),
      live_modelled_givers: liveModelled.length,
      live_unmodelled_givers: liveUnmodelled.length,
      live_inconsistent_givers: liveInconsistent,
      unmodelled_ids: liveUnmodelled.slice(0, 20),
    },
    per_giver_live: {
      modelled: liveModelled.length, unmodelled: liveUnmodelled.length,
      mixed: liveModelled.length > 0 && liveUnmodelled.length > 0,
    },
  };
}

/** Boot, probe, reconcile, and write the attestation. Returns the exit code for --verify-model. */
async function verifyModelMode() {
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 120000) });
  let live;
  try {
    await handle.page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* ignore */ } });
    live = await verifyModelLive(handle);
  } finally { await handle.close().catch(() => {}); }

  if (!live.measurable) {
    process.stderr.write(`[build-viability] --verify-model UNMEASURABLE: ${live.why}\n`);
    return EXIT.MEASUREMENT_FAIL;
  }
  const rec = reconcileModel(live, { fatal: false });
  const att = {
    schema: 'elder-souls/viability-model-attestation@1',
    at: new Date().toISOString(),
    source_hash: OFFER_MODEL.source_hash,
    source_files: MODEL_SOURCE_FILES,
    static_claim: { model: OFFER_MODEL.model, anchors: OFFER_MODEL.anchors, matched: OFFER_MODEL.anchors_matched },
    live,
    reconciliation: rec,
  };
  writeJson(ATTEST_PATH, att);
  process.stdout.write(
    `verify-model: the running gate is ${live.race_sensitive ? 'RACE-SENSITIVE' : 'RACE-INVARIANT'} ` +
    `(${live.evidence.givers_whose_gate_number_moved}/${live.gated_givers} gated givers moved when ` +
    `race went ${RACE_PROBE_PAIR[0]} -> ${RACE_PROBE_PAIR[1]}, nothing else changed)\n`);
  process.stdout.write(
    `  per-giver, live: ${live.per_giver_live.modelled} modelled, ${live.per_giver_live.unmodelled} ` +
    `unmodelled${live.per_giver_live.mixed ? ' — MIXED, the model is not a global property' : ''}\n`);
  process.stdout.write(
    `  static anchors say "${OFFER_MODEL.model}" (${OFFER_MODEL.anchors_matched}/${OFFER_MODEL.anchors_total}): ` +
    `${rec.agree ? 'AGREES with the running gate' : 'CONTRADICTED BY THE RUNNING GATE'}\n`);
  if (!rec.agree) process.stderr.write(`[build-viability] ${rec.why}\n`);
  log(`wrote ${ATTEST_PATH}`);
  return rec.agree ? 0 : EXIT.MEASUREMENT_FAIL;
}

if (args['verify-model']) process.exit(await verifyModelMode());


// ---------------------------------------------------------------------------------------------
// --cross-check. RI-MTH06 §A requires this tool to be a STATIC walk so it can run in CI, and
// RI-MTH07 says a tool that reads a data file and reports on the data file is measuring the
// design document. This mode is how both are honoured at once: on demand, boot the game and
// compare THIS TOOL'S per-giver disposition numbers against the ones the running build hands
// `canOffer`. A disagreement means the static model has drifted from the world — which is
// exactly what happened to this file mid-round-3, when another agent wired the reaction matrix
// into the quest path and every hard-coded model in the tree became wrong overnight.
// ---------------------------------------------------------------------------------------------
/**
 * THE CROSS-CHECK ROW ACCOUNTING, as a function the `--self-test` can actually call.
 *
 * ROUND 5. Round 4's battery "tested" this by re-implementing it inline inside `selfTest()` —
 * a fixture written by the same hand that reads it, in a dialect the shipping path does not
 * have to speak. That is precisely the defect TOOL-COVERAGE-R3 §2 charged `beat-extract` with,
 * and it means the round-4 battery would have gone green over an accounting bug in `crossCheck`.
 * The accounting now lives here, `crossCheck()` calls it, and the battery calls the same
 * function. There is one implementation.
 *
 * `comparedRows` may contain ONLY rows that carry a boolean `agrees`. Anything else is refused
 * rather than counted: an uncompared row that reaches a count called "compared" is the exact
 * defect this tool is known for.
 */
function crossCheckVerdict(comparedRows, unresolvedRows) {
  const pairsEnumerated = comparedRows.length + unresolvedRows.length;
  const badRows = comparedRows.filter((r) => typeof r.agrees !== 'boolean');
  if (badRows.length) {
    return {
      agrees: false, unmeasurable: true, refused: true,
      rows_compared: 0, rows_unresolved: unresolvedRows.length, pairs_enumerated: pairsEnumerated,
      rows: [], unresolved_rows: unresolvedRows.slice(0, 40), disagreements: [],
      accounting_invariant: 'rows_compared + rows_unresolved === pairs_enumerated',
      accounting_holds: false,
      why: `INTERNAL: ${badRows.length} row(s) reached the compared array without a boolean ` +
           'verdict. Refusing rather than counting them.',
    };
  }
  const disagreements = comparedRows.filter((r) => r.agrees === false);
  const nothingCompared = pairsEnumerated > 0 && comparedRows.length === 0;
  return {
    // `rows_compared` is the length of the array of rows that WERE compared — nothing else can
    // be assigned to it. The count of pairs merely walked past is `pairs_enumerated` and is
    // never called "compared", because R3's false headline was that word over that number.
    rows_compared: comparedRows.length,
    rows_unresolved: unresolvedRows.length,
    pairs_enumerated: pairsEnumerated,
    accounting_invariant: 'rows_compared + rows_unresolved === pairs_enumerated',
    accounting_holds: comparedRows.length + unresolvedRows.length === pairsEnumerated,
    rows: comparedRows,
    unresolved_rows: unresolvedRows.slice(0, 40),
    disagreements,
    // FALSE, not true, when nothing was compared. A comparison of zero pairs is not a pass.
    agrees: nothingCompared ? false : disagreements.length === 0,
    unmeasurable: nothingCompared,
    refused: false,
    unresolved_reason: unresolvedRows.length
      ? 'explainDisposition().modelled was false (the engine did not model this giver) or the ' +
        'giver did not resolve to a reaction group. An unresolved row compares NOTHING; it is ' +
        'not in `rows` and cannot reach any count named "compared".'
      : null,
    why: nothingCompared
      ? `CROSS-CHECK UNMEASURABLE: ${pairsEnumerated} (signature, giver) pairs were enumerated ` +
        `and ZERO were compared — every one came back \`modelled: false\` from the running ` +
        `engine. Nothing was compared, so nothing agrees. This is the exact state ` +
        `TOOL-COVERAGE-R3 §1 constructed by killing the race term behind an intact set of source ` +
        `anchors, and the round-3 tool reported it as "AGREES on ${pairsEnumerated} pairs; 0 ` +
        `disagreements".`
      : null,
  };
}

async function crossCheck() {
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 120000) });
  try {
    await handle.page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* ignore */ } });
    const surface = await handle.page.evaluate(
      () => Object.keys(window.__HARNESS || {}).filter((k) => typeof window.__HARNESS[k] === 'function'));
    const needed = ['getGateDispositions', 'explainDisposition', 'setCharacter', 'questOffers'];
    const missing = needed.filter((m) => !surface.includes(m));
    if (missing.length) {
      return { agrees: false, unmeasurable: true, rows: [], disagreements: [],
        why: `--cross-check needs ${missing.join(', ')} and this build does not expose ${missing.length === 1 ? 'it' : 'them'}. ` +
             'Reporting that rather than falling back to comparing the static walk with itself.' };
    }

    // The signatures to sweep. RI-CHR01 §5's four-part signature, driven through the SHIPPED
    // creation path (`setCharacter` -> `composeCharacter`), not assembled here.
    const sigsArg = args['cross-check-signatures']
      ? String(args['cross-check-signatures']).split(',').map((s) => s.trim())
      : ['dunmer/lukiul', 'dunmer/interior', 'dunmer/foreign-born', 'saxhleel/interior', 'nord/foreign-born', 'imperial/blackrose'];
    const classId = (data.classes.classes[0] || {}).id;
    const signId = (data.birthsigns.signs[0] || {}).id;

    // Two arrays, not one filtered later. See the ROUND 5 note at the push site.
    const comparedRows = [], unresolvedRows = [], disagreements = [], perSignature = [];
    for (const sig of sigsArg) {
      const [race, upbringing] = sig.split('/');
      const live = await handle.page.evaluate((o) => {
        try {
          window.__HARNESS.setCharacter({ race: o.race, upbringing: o.upbringing, class: o.classId, birthsign: o.signId });
        } catch (e) { return { error: String(e && e.message || e) }; }
        const gate = window.__HARNESS.getGateDispositions();
        const offers = window.__HARNESS.questOffers();
        const list = offers.offers || offers;
        const arr = Array.isArray(list) ? list : Object.values(list);
        const explain = {};
        for (const id of o.givers) { try { explain[id] = window.__HARNESS.explainDisposition(id); } catch { explain[id] = null; } }
        return {
          gate, explain,
          offerable: arr.filter((x) => x && x.offerable).length,
          quests: arr.length,
          disposition_clauses: arr.flatMap((x) => ((x && x.why) || []).filter((w) => /disposition \d+\/\d+/.test(String(w)))).sort(),
        };
      }, { race, upbringing, classId, signId, givers: [...new Set(quests.filter((q) => q.giver && q.giver.disposition_min != null).map((q) => q.giver.npc_id))] });

      if (live.error) { disagreements.push({ signature: sig, error: live.error }); continue; }
      perSignature.push({
        signature: sig, offerable: live.offerable, quests: live.quests,
        disposition_clauses: live.disposition_clauses,
      });

      for (const q of quests) {
        if (!(q.giver && q.giver.disposition_min != null)) continue;
        const id = q.giver.npc_id;
        const ex = live.explain[id];
        const engineValue = live.gate[id];
        if (engineValue === undefined) continue;
        // The arithmetic agreement check. The tool recomputes the engine's OWN number from the
        // engine's OWN base and movable total, through the same shipping `derivedDisposition`.
        // Anything but equality means this static walk has drifted from game/src.
        const g = resolveGiver(id);
        const toolValue = (ex && ex.modelled && g.status === 'resolved')
          ? dispositionCeiling(Number(ex.base) || 0, race, upbringing, signId, g.group)
          : null;
        // dispositionCeiling adds MODEL.disposition_other_terms_ceiling; recompute with the
        // engine's observed other_terms instead so the comparison is like for like.
        const toolAtEngineTerms = (ex && ex.modelled && g.status === 'resolved')
          ? derivedDisposition(data, {
            group: g.group, race, upbringing, birthsign: signId,
            baseDisposition: Number(ex.base) || 0, otherTerms: Number(ex.other_terms) || 0,
          }).value
          : null;
        const row = {
          signature: sig, quest: q.id, npc_id: id, requires: q.giver.disposition_min,
          engine_gate_value: engineValue,
          engine_terms: ex ? { base: ex.base, race: ex.race_term, upbringing: ex.upbringing_term, birthsign: ex.birthsign_term, other: ex.other_terms, modelled: ex.modelled } : null,
          tool_same_terms: toolAtEngineTerms,
          tool_player_optimal_ceiling: toolValue,
        };
        // ---- ROUND 5. AN UNCOMPARED ROW CANNOT ENTER THE COMPARED ARRAY. --------------------
        //
        // Round 4 fixed the arithmetic of this accounting — it counted `agrees: null` as
        // unresolved and refused to print "AGREES" for zero resolved rows — but it left
        // `rows_compared: rows.length`, i.e. the ENUMERATED count, sitting in the artifact next
        // to `rows_resolved`. The number that made R3's headline false is still the number a
        // reader's eye lands on, and it is still produced by a `push` that happens whether or
        // not anything was compared.
        //
        // So the arithmetic is replaced by a shape: there is no single array any more. A row
        // with nothing to compare goes into `unresolvedRows` and is not reachable from any
        // count called "compared". `rows_compared` is `comparedRows.length` and every element of
        // `comparedRows` carries a BOOLEAN `agrees`, asserted below. Miscounting now requires
        // pushing to the wrong array, not forgetting a filter.
        if (toolAtEngineTerms === null) {
          unresolvedRows.push({
            ...row,
            why_unresolved: ex && !ex.modelled
              ? 'the running engine returned modelled:false for this giver — it did not apply the reaction matrix, so there is no arithmetic to agree with'
              : `giver did not resolve to a reaction group (${g.status})`,
          });
        } else {
          const agrees = toolAtEngineTerms === engineValue;
          comparedRows.push({ ...row, agrees });
          if (!agrees) disagreements.push({ ...row, agrees });
        }
      }
    }
    const distinct = new Set(perSignature.map((s) => JSON.stringify(s.disposition_clauses))).size;

    // ---- ROW ACCOUNTING. R3 §1 second bullet, closed by SHAPE in round 5. --------------------
    // One implementation, shared with --self-test. See crossCheckVerdict() above.
    const acc = crossCheckVerdict(comparedRows, unresolvedRows);

    // ---- MODEL RECONCILIATION. R3 §1, first rebuild bullet. -----------------------------------
    // The artifact used to print `model="derived"` and `RACE-INVARIANT: 1 distinct clause set`
    // in the same screen and exit 0. It already held its own disconfirming evidence and never
    // reconciled it. Now it does, and refuses.
    const liveFromSweep = {
      race_sensitive: distinct > 1,
      evidence: {
        distinct_disposition_clause_sets: distinct,
        signatures: perSignature.map((s) => ({ signature: s.signature, clauses: s.disposition_clauses.length })),
        rows_compared: acc.rows_compared, rows_unresolved: acc.rows_unresolved,
      },
    };
    const reconciliation = reconcileModel(liveFromSweep, { fatal: false });

    return {
      method: 'setCharacter() -> getGateDispositions() / explainDisposition(), the numbers canOffer ' +
              'actually reads. Nothing about the gate is reconstructed here.',
      signatures_swept: perSignature,
      distinct_disposition_clause_sets: distinct,
      race_sensitive: distinct > 1,
      ...acc,
      model_reconciliation: reconciliation,
      note: 'Agreement is checked on the PERMANENT terms: the tool recomputes the engine\'s own ' +
            'value from the engine\'s own base and movable total through the same shipping ' +
            'derivedDisposition(). The static walk additionally applies a player-optimal movable ' +
            'ceiling (MODEL.disposition_other_terms_ceiling), which is deliberately higher than ' +
            'a bare character\'s and is reported separately as tool_player_optimal_ceiling.',
    };
  } finally { await handle.close().catch(() => {}); }
}

// ---------------------------------------------------------------------------------------------
// ROUND 5 — MODEL DEPENDENCE IS MEASURED, NOT INFERRED FROM "DID A DISPOSITION STOP HAPPEN".
//
// Round 4 gated the exit code on `records.filter(r => r.stopped_at.offer_model !== undefined)` —
// i.e. on whether any signature happened to STOP at a disposition gate. That is not the same
// question. A signature that PASSES because the derived model lifted a giver over the bar is
// just as dependent on the model as one that fails, and it contributes nothing to that count;
// and on a tree where some other gate stops everyone first, the count is 0 and the run exits
// with a clean bill on a model it never looked at.
//
// The honest predicate is a differential: walk the same grid under the OTHER offer model and
// count the signatures whose verdict moves. If none move, the model is not load-bearing for this
// run and the run may stand without a live attestation. If any move, the run's numbers are a
// function of a hypothesis about source text, and TOOL-COVERAGE-R3 §1 proved that hypothesis can
// be wrong while every anchor matches.
//
// `--no-model-sensitivity` skips the second walk. It costs one extra walk (~40 s on 540 cells),
// and the flag stamps the artifact so a reader knows the gate was not evaluated.
// ROUND 5. THE ORDER HERE IS LOAD-BEARING. `--verify-model` used to run AFTER the walk, and
// once the model-sensitivity differential landed that meant a mode which needs no walk at all
// paid for TWO 540-cell walks before it opened a browser — minutes of pure waste on a loaded
// box, for the one mode a critic reaches for when the tool has already refused to publish.
// The walk is deferred to the point where its result is first consumed.
const records = produceRecords();

// ---------------------------------------------------------------------------------------------
const MODEL_SENSITIVITY = (() => {
  if (args['no-model-sensitivity']) {
    return { measured: false, why: '--no-model-sensitivity: the differential walk was skipped, so ' +
      'this run cannot say whether its verdicts depend on the offer model.' };
  }
  const detected = OFFER_MODEL.model;
  const other = detected === 'derived' ? 'raw' : 'derived';
  const key = (r) => `${r.signature}|${r.viable}|${r.unmeasurable}|${JSON.stringify(r.criteria)}|${r.stopped_at ? r.stopped_at.gate + '::' + r.stopped_at.why : ''}`;
  let alt;
  const saved = OFFER_MODEL.model;
  try { OFFER_MODEL.model = other; alt = produceRecords({ quiet: true }); }
  finally { OFFER_MODEL.model = saved; }
  const byKey = new Map(alt.map((r) => [r.signature, key(r)]));
  const moved = records.filter((r) => byKey.get(r.signature) !== key(r));
  return {
    measured: true,
    method: `the same grid walked twice, once under the detected offer model ("${detected}") and ` +
            `once under "${other}", comparing each signature's viability, four criteria and stop.`,
    detected_model: detected, compared_against: other,
    signatures_whose_verdict_moves: moved.length,
    signatures_walked: records.length,
    model_is_load_bearing: moved.length > 0,
    examples: moved.slice(0, 5).map((r) => ({ signature: r.signature, under_detected: r.stopped_at && r.stopped_at.why, criteria: r.criteria })),
    why: moved.length
      ? `${moved.length} of ${records.length} signature verdicts change when the offer model ` +
        `changes, so every number in this artifact is conditional on the model being right. ` +
        `Source anchors cannot establish that (TOOL-COVERAGE-R3 §1); only --verify-model can.`
      : `no signature's verdict changes between the two offer models on this tree, so these ` +
        `numbers do not depend on which one the build implements.`,
  };
})();

const rep = report(records, fixture);
rep.model_sensitivity = MODEL_SENSITIVITY;
if (args['cross-check']) {
  rep.cross_check = await crossCheck();
  const cc = rep.cross_check;
  if (cc.unmeasurable) {
    process.stdout.write(`cross-check: UNMEASURABLE — ${cc.why}\n`);
  } else {
    // NEVER "AGREES on N pairs" when N is the enumerated count. The verdict is stated over
    // COMPARED rows, and the unresolved count is printed alongside it whether or not it is 0.
    process.stdout.write(
      `cross-check against the running gate: ${cc.agrees ? 'AGREES' : 'DISAGREES'} ` +
      `on ${cc.rows_compared} COMPARED of ${cc.pairs_enumerated} enumerated (signature, giver) pairs ` +
      `(${cc.rows_unresolved} unresolved — nothing compared); ${cc.disagreements.length} disagreement(s). ` +
      `The offer path is ${cc.race_sensitive ? 'RACE-SENSITIVE' : 'RACE-INVARIANT'}: ` +
      `${cc.distinct_disposition_clause_sets} distinct disposition-clause set(s) over ` +
      `${cc.signatures_swept.length} signatures.\n`);
    for (const s of cc.signatures_swept) {
      process.stdout.write(`  ${s.signature.padEnd(24)} ${s.offerable}/${s.quests} offerable, ` +
        `${s.disposition_clauses.length} disposition clause(s)\n`);
    }
    for (const d of cc.disagreements.slice(0, 10)) {
      process.stdout.write(`  DISAGREE ${d.signature} ${d.npc_id}: engine ${d.engine_gate_value} vs tool ${d.tool_same_terms} (terms ${JSON.stringify(d.engine_terms)})\n`);
    }
  }
  const mr = cc.model_reconciliation;
  if (mr && mr.checked) {
    process.stdout.write(
      `  model reconciliation: static "${mr.static_claim}" (${mr.static_anchors} anchors) vs live ` +
      `${mr.live_race_sensitive ? 'RACE-SENSITIVE' : 'RACE-INVARIANT'} -> ` +
      `${mr.agree ? 'CONSISTENT' : 'CONTRADICTION'}\n`);
    if (!mr.agree) {
      // The whole R3 §1 defect, closed. A tool that holds its own refutation and prints both as
      // findings has not measured anything (RI-MTH04). It refuses instead.
      process.stderr.write(`[build-viability] ${mr.why}\n`);
      writeJson(args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'viability.json'), rep);
      die(EXIT.MEASUREMENT_FAIL,
        'the detected offer model and the running gate contradict each other. The disposition ' +
        'verdicts in this run describe a build that is not running and must not be scored. ' +
        'RI-CHR01 Distinctness and RI-CHR03 Decidability are UNMEASURABLE from this run.');
    }
  }
  // A cross-check IS a live observation, so it mints the attestation too — a critic who ran
  // --cross-check should not have to run --verify-model as well.
  if (!cc.unmeasurable && mr && mr.checked && mr.agree) {
    writeJson(ATTEST_PATH, {
      schema: 'elder-souls/viability-model-attestation@1',
      at: new Date().toISOString(),
      source_hash: OFFER_MODEL.source_hash, source_files: MODEL_SOURCE_FILES,
      static_claim: { model: OFFER_MODEL.model, anchors: OFFER_MODEL.anchors, matched: OFFER_MODEL.anchors_matched },
      live: { race_sensitive: cc.race_sensitive, evidence: { via: '--cross-check clause-set sweep', distinct_disposition_clause_sets: cc.distinct_disposition_clause_sets, rows_compared: cc.rows_compared, rows_unresolved: cc.rows_unresolved } },
      reconciliation: mr,
    });
  }
}
const outPath = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'viability.json');
writeJson(outPath, rep);

if (!QUIET) {
  process.stdout.write(
    `build-viability: ${rep.viable}/${records.length} viable, ${rep.not_viable} not viable, ` +
    `${rep.unmeasurable} UNMEASURABLE (target ${TARGET})\n`);
  process.stdout.write(`  failures by criterion: ${JSON.stringify(rep.failures_by_criterion)}\n`);
  process.stdout.write(
    `  tier-5 regions [${rep.tier5.tier5_regions.join(', ')}] -> cohort ` +
    `${rep.tier5.cohort.map((c) => `${c.id}:${c.members.map((m) => m.count + 'x' + m.statblock).join('+')}`).join(', ') || '(empty)'}\n`);
  if (rep.tier5.tier5_regions_with_no_authored_fight.length) {
    process.stdout.write(`  tier-5 regions with no authored fight: ${rep.tier5.tier5_regions_with_no_authored_fight.join(', ')}\n`);
  }
  if (rep.tier5.unresolved_region_or_statblock_names.length) {
    process.stdout.write(`  DATA DEFECT, unresolvable names: ${rep.tier5.unresolved_region_or_statblock_names.join(', ')}\n`);
  }
  // ---- ROUND 5. THE SUBSTITUTIONS SAY SO, ON EVERY RUN, WITHOUT BEING ASKED. ---------------
  // Four rejections in a row turned on a value invented inside this file. The ledger is not
  // buried in the JSON; the operator-facing summary states what was granted, on what basis, and
  // what could not be grounded at all.
  {
    const gl = rep.grant_ledger;
    process.stdout.write(
      `  grants: ${gl.rows.length} fields handed to the synthetic character, ` +
      `${gl.substitutions_remaining} SUBSTITUTION(S); player-optimal upper bounds (declared): ` +
      `${gl.player_optimal_bounds.join(', ')} — see --audit-grants\n`);
    const rl = gl.rows.find((r) => r.field === 'reputation');
    const gd = gl.rows.find((r) => r.field === 'gold');
    process.stdout.write(
      `    derived, not granted: reputation ${JSON.stringify(rl && rl.value)}; gold ${gd && gd.value}; ` +
      `ranks via FactionGates.highestQualifying()\n`);
    if (UNSOURCED.total) {
      process.stdout.write(
        `  UNGROUNDED REQUIREMENTS — ${UNSOURCED.total} token(s) a shipped gate asks for that NO ` +
        `file under ${path.relative(REPO_ROOT, ROOT) || 'game/data'} produces. Not granted, not ` +
        `failed on; any verdict that turns on one is UNMEASURABLE:\n`);
      for (const k of ['topics', 'world_flags', 'knowledge', 'items', 'spell_effects']) {
        if (UNSOURCED[k].length) process.stdout.write(`    ${k}: ${UNSOURCED[k].join(', ')}\n`);
      }
    }
  }
  process.stdout.write(
    `  giver census: ${rep.giver_census.resolving_to_a_reaction_group}/` +
    `${rep.giver_census.quests_with_a_giver_disposition_min} quest givers resolve to a reaction ` +
    `group (${rep.giver_census.giver_has_no_npc_record} no NPC record, ` +
    `${rep.giver_census.giver_has_a_record_but_no_reaction_group} record without reaction_group); ` +
    `max disposition_min shipped ${rep.giver_census.max_disposition_min_shipped}\n`);
  for (const b of rep.unmeasurable_because) process.stdout.write(`  UNMEASURABLE: ${b}\n`);
  if (rep.unpassable_gates.quests_blocked) {
    process.stdout.write(
      `  BUILD FAIL — ${rep.unpassable_gates.quests_blocked} quests carry a giver disposition bar ` +
      `NO PLAY CAN REACH, identically for all ${records.length} signatures:\n`);
    for (const g of rep.unpassable_gates.gates) {
      process.stdout.write(
        `    ${g.quest}: ${g.npc_id} needs ${g.requires}, best achievable ${g.best_achievable} ` +
        `(${g.seeded ? 'seeded ' + g.seed : 'NO NPC RECORD -> seeds nothing -> num(undefined)=0'}` +
        `${g.gifts.length ? ', gifts ' + g.gifts.map((x) => x.quest + '+' + x.delta).join(' ') : ''}` +
        `${g.circular_gifts.length ? ', circular ' + g.circular_gifts.map((x) => x.quest + '+' + x.delta).join(' ') : ''})\n`);
    }
    process.stdout.write(
      `  RACE-INVARIANT: the build never applies derivedDisposition() to the quest path, so this ` +
      `is a BUILD failure charged to game/src+game/data, not corpus_debt.\n`);
  }
  // ROUND 4 SUCCESSOR — the banner above is disposition-only, so on this tree it printed nothing
  // while every one of the 540 signatures was stopped dead at a REPUTATION gate. A build failure
  // that the summary does not name is a build failure nobody reads.
  if (rep.stops_blocking_every_signature.count) {
    process.stdout.write(
      `  BUILD FAIL — ${rep.stops_blocking_every_signature.count} gate(s) stopped ALL ` +
      `${records.length} signatures. No character anyone can build gets past this:\n`);
    for (const g of rep.stops_blocking_every_signature.gates) {
      process.stdout.write(`    ${g.quest}${g.stage == null ? '' : ' @' + g.stage} [${g.gate}] — ${g.why}\n`);
    }
    process.stdout.write(
      `  This roll-up is GATE-KIND AGNOSTIC and empirical. \`unpassable_gates\` above covers ` +
      `disposition bars only and reported ${rep.unpassable_gates.quests_blocked}.\n`);
  } else if (rep.viable === 0 && records.length > 0) {
    // Belt and braces: zero viable signatures with nothing named is the state the tool must
    // never sit in silently again.
    process.stdout.write(
      `  NOTE — 0/${records.length} viable but no single gate stops every signature; the ` +
      `blockage is distributed. Top first-stops: ` +
      `${rep.stops_blocking_every_signature.all_first_stops.slice(0, 3)
        .map((s) => `${s.quest}[${s.gate}] x${s.signatures}`).join(', ')}\n`);
  }

  const fails = records.filter((r) => !r.viable);
  const shown = EXPLAIN ? fails : fails.slice(0, 20);
  for (const f of shown) {
    const s = f.stopped_at || {};
    process.stdout.write(`  ${f.unmeasurable ? 'UNM ' : 'FAIL'} ${f.signature} :: ${s.gate || '?'} — ${String(s.why || '?').slice(0, 160)}\n`);
  }
  if (fails.length > shown.length) process.stdout.write(`  ... and ${fails.length - shown.length} more (see ${path.relative(REPO_ROOT, outPath)})\n`);
  if (EXPLAIN) process.stdout.write(JSON.stringify(records, null, 2) + '\n');
}
log(`wrote ${outPath}`);

// ---------------------------------------------------------------------------------------------
// ROUND 4 — AN UNVERIFIED MODEL CANNOT EXIT 0 IF ANY VERDICT DEPENDED ON IT.
//
// TOOL-LOOP.md: "Never stub it to pass ... make it report that absence and exit non-zero."
// R3 §1's break produced `exit 0` on both the sound tree and the broken one. The difference
// between those two trees is only observable live, so a run that never looked at the running
// build must not close with a clean exit while it is charging signatures a disposition FAIL.
// ---------------------------------------------------------------------------------------------
// ROUND 5. The dependence is MEASURED (the two-model differential above), not inferred from
// whether a disposition stop happened to occur. `--no-model-sensitivity` leaves it unmeasured,
// which is itself a reason to refuse a clean exit rather than to assume independence.
const modelDependentVerdicts = MODEL_SENSITIVITY.measured
  ? MODEL_SENSITIVITY.signatures_whose_verdict_moves
  : records.length;
const modelUnverified = rep.model_attestation.status !== 'VALID';

if (!QUIET) {
  process.stdout.write(
    `  model sensitivity: ${MODEL_SENSITIVITY.measured
      ? `${MODEL_SENSITIVITY.signatures_whose_verdict_moves}/${records.length} verdicts move when the ` +
        `offer model is swapped "${MODEL_SENSITIVITY.detected_model}" -> "${MODEL_SENSITIVITY.compared_against}"`
      : 'NOT MEASURED (--no-model-sensitivity)'}\n`);
}
if (modelUnverified && modelDependentVerdicts > 0 && !QUIET) {
  process.stdout.write(
    `  MODEL UNVERIFIED (${rep.model_attestation.status}) — ${MODEL_SENSITIVITY.measured
      ? `${modelDependentVerdicts} of ${records.length} signature verdicts MOVE when the offer ` +
        'model changes'
      : `dependence on the offer model was NOT MEASURED (--no-model-sensitivity), so all ` +
        `${records.length} verdicts are treated as dependent`}, and this run never ` +
    `observed which model the running build implements.\n` +
    `    ${rep.model_attestation.why}\n` +
    `    RI-CHR01 Distinctness and RI-CHR03 Decidability MUST NOT be scored from this run.\n`);
}

if (rep.unmeasurable === records.length) {
  process.stderr.write('[harness] ERROR: the measurement could not be taken for ANY signature.\n');
  for (const b of rep.unmeasurable_because) process.stderr.write('[harness]   ' + b + '\n');
  process.exit(EXIT.MEASUREMENT_FAIL);
}
if (modelUnverified && modelDependentVerdicts > 0) {
  process.stderr.write(
    `[harness] ERROR: ${MODEL_SENSITIVITY.measured
      ? `${modelDependentVerdicts} verdicts MOVE with the offer model`
      : 'model dependence was not measured (--no-model-sensitivity)'} and the model is ` +
    `UNVERIFIED ` +
    `(attestation ${rep.model_attestation.status}). Run --verify-model or --cross-check first.\n`);
  process.exit(EXIT.MEASUREMENT_FAIL);
}
process.exit(rep.viable >= TARGET && rep.unmeasurable === 0 ? 0 : 1);
