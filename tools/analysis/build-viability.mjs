#!/usr/bin/env node
// build-viability.mjs — RI-CHR01 §5's four viability criteria, walked over all 540 signatures.
//
// Named by:  RI-CHR01 method 6, RI-CHR03 method 5, RI-CMP03, and specified in full by
//            corpus/80-methods/RI-MTH06 §A.
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
import {
  REPO_ROOT, DATA_DIR, parseArgs, wantsHelp, usage, writeJson, log, die, EXIT,
} from '../lib/cli.mjs';
import { loadCharacterData, loadQuests, loadEnemies, rd, rdOpt } from '../lib/gamedata.mjs';
import { composeCharacter, classFamilies } from '../../game/src/character/sheet.js';
import { hpMaxFor, focusMaxFor, scalingBonus, effectiveGrade, GRADE_COEFF } from '../../game/src/character/derive.js';
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
                            "faction_rank5_attribute_floor": 500 }
  --self-test           run the falsification battery and exit non-zero if any check fails to
                        move the number it is supposed to move.
  --levels 1,20,40,60   the simulated levels gates are evaluated at (RI-CHR01 M6's default)
  --target 486          viability floor for the exit code (RI-CHR01 §5's 90% of 540)
  --quiet               suppress the per-signature failure lines on stdout
  --offer-model M       raw | derived | detect (default). Which disposition model the build's
                        quest-offer path implements. DETECTED from named source anchors and
                        reported; forcing it is how a critic compares the two.
  --cross-check         boot the game and compare this static walk's per-giver numbers against
                        the running build's own questOffers()/explainDisposition(). The static
                        walk is required by RI-MTH06 §A; this is how it stays true to the world.

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
  const group = rec.reaction_group || rec.group || null;
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
// ---------------------------------------------------------------------------------------------
const OFFER_MODEL_ANCHORS = {
  installed: {
    file: 'game/src/engine.js',
    // Engine installs the derived model on the quest engine.
    rx: /this\.questEngine\.dispositionModel\s*=/,
    means: 'Engine installs a disposition model on QuestEngine',
  },
  consulted: {
    file: 'game/src/sim/quest/machine.js',
    // _dispositionToward consults it before canOffer sees the number.
    rx: /const\s+model\s*=\s*this\.dispositionModel\s*;[\s\S]{0,400}?canOffer|_dispositionToward\s*\([\s\S]{0,800}?this\.dispositionModel/,
    means: 'QuestEngine._dispositionToward() consults the model',
  },
  fed_to_gate: {
    file: 'game/src/sim/quest/machine.js',
    rx: /dispositions\s*:\s*this\.dispositionView\(\)|dispositions\s*:\s*this\._dispositionView/,
    means: 'QuestEngine.context().dispositions is built from _dispositionToward, not from the raw register',
  },
};

const OFFER_MODEL = (() => {
  const forced = args['offer-model'] ? String(args['offer-model']) : 'detect';
  const found = {};
  for (const [k, a] of Object.entries(OFFER_MODEL_ANCHORS)) {
    const p = path.join(REPO_ROOT, a.file);
    const src = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    found[k] = { matched: a.rx.test(src), file: a.file, means: a.means };
  }
  const hits = Object.values(found).filter((f) => f.matched).length;
  let model, why;
  if (forced === 'raw' || forced === 'derived') {
    model = forced;
    why = `FORCED by --offer-model ${forced}. Detection found ${hits}/3 anchors.`;
  } else if (hits === 3) {
    model = 'derived';
    why = 'all three anchors matched: the reaction matrix reaches the quest-offer path in this build.';
  } else if (hits === 0) {
    model = 'raw';
    why = 'no anchor matched: seedDispositions() writes the raw record and nothing downstream ' +
          'applies derivedDisposition(), so the offer gate is race-invariant in this build.';
  } else {
    model = 'ambiguous';
    why = `${hits} of 3 anchors matched, so the two halves of the race term DISAGREE: ` +
          Object.entries(found).map(([k, f]) => `${k}=${f.matched}`).join(', ') +
          `. A half-wired race term is the state this corpus has twice been misled by (the data ` +
          `layer alone was measured to block nobody), so this tool refuses rather than guessing.`;
  }
  return { model, why, anchors: found, forced: forced !== 'detect' ? forced : null };
})();

if (OFFER_MODEL.model === 'ambiguous' && !args['self-test']) {
  die(EXIT.MEASUREMENT_FAIL,
    'cannot determine which offer model this build implements. ' + OFFER_MODEL.why +
    ' Re-run with --offer-model raw or --offer-model derived to force one, and say which in the ' +
    'verdict.');
}

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

// ---------------------------------------------------------------------------------------------
// The four criteria
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
 * Best-case context: everything a player can EARN is granted, so only PERMANENT bars remain.
 * Note what is NOT granted: the giver's disposition. That is supplied per-quest, from the
 * character's own ceiling with the giver's own reaction group, and it is the whole point.
 */
function bestCaseCtx(sheet, level, want = {}, forQuest = null) {
  const c = ctxAt(sheet, level, want);
  if (forQuest) {
    const excluded = new Set([forQuest.id, ...(forQuest.mutually_exclusive_with || [])]);
    c.completed = new Set(quests.map((q) => q.id).filter((id) => !excluded.has(id)));
  }
  c.topicsKnown = { has: () => true };
  c.knowledge = { has: () => true };
  c.items = { has: () => true };
  c.spellEffects = { has: () => true };
  c.worldFlags = { has: () => true };
  c.gold = 1e9;
  c.reputation = new Proxy({}, { get: () => 100 });
  c.ranks = new Proxy({}, { get: () => 7 });
  return c;
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
  return questClearableInner(sheet, q, level);
}

/** Returns { status: pass|fail|unmeasurable, stopped_at?, why?, giver? }. */
function questClearableInner(sheet, q, level) {
  const want = { skills: [], attributes: [] };
  for (const res of q.resolutions || []) {
    for (const s of Object.keys((res.requires || {}).skills || {})) want.skills.push(s);
    for (const a of Object.keys((res.requires || {}).attributes || {})) want.attributes.push(a);
  }
  const ctx = bestCaseCtx(sheet, level, want, q);

  // THE OFFER GATE, exactly as the build runs it. `ctx.dispositions` is the seeded table, not a
  // derived ceiling; the giver's entry is the player-optimal upper bound from quest gifts. The
  // shipping `canOffer` does the comparison and produces its own reason string — this tool does
  // not pre-empt the predicate it imported.
  let reach = null;
  if (q.giver && q.giver.disposition_min != null) {
    reach = achievableDisposition(q.giver.npc_id, q);
    ctx.dispositions = offerDispositionCtx(sheet, q.giver.npc_id, reach);
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
  if (!resolutions.length && !q.stages) {
    return { status: FAIL, stopped_at: { quest: q.id, stage: null, gate: 'resolutions', why: 'quest declares no resolutions' } };
  }
  if (resolutions.length) {
    const open = resolutions.filter((r) => canResolve(r, ctx).available);
    if (!open.length) {
      const first = canResolve(resolutions[0], ctx);
      return {
        status: FAIL,
        stopped_at: {
          quest: q.id, stage: resolutions[0].journal_index ?? null,
          gate: `resolution ${resolutions[0].id}`,
          why: first.why.join('; ') || 'no resolution available',
        },
      };
    }
  }
  return { status: PASS };
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
    return {
      status: UNMEASURABLE, quests: list.length,
      stopped_at: unmeasurable[0].stopped_at,
      unmeasurable_givers: unmeasurable.map((u) => u.giver),
      why: `${unmeasurable.length} of ${list.length} quests carry a giver whose reaction group ` +
           `cannot be resolved from shipped data, so the permanent race+upbringing bar cannot be ` +
           `evaluated for them. First: ${unmeasurable[0].stopped_at.why}`,
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

function criterionThreeFactionsRank5(sheet) {
  const ids = gates.ids();
  const top = LEVELS[LEVELS.length - 1];
  const qualifying = [];
  const blocked = [];
  const rankFloor = fxNum('faction_rank5_attribute_floor');
  for (const id of ids) {
    const f = gates.get(id);
    const ctx = bestCaseCtx(sheet, top, { skills: f.favoured_skills, attributes: f.favoured_attributes });
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
    if (ev.allowed) qualifying.push(id); else blocked.push({ faction: id, unmet: ev.unmet });
  }
  const compatible = (a, b) => !gates.closedBy(a).includes(b);
  for (let i = 0; i < qualifying.length; i++) {
    for (let j = i + 1; j < qualifying.length; j++) {
      if (!compatible(qualifying[i], qualifying[j])) continue;
      for (let k = j + 1; k < qualifying.length; k++) {
        if (compatible(qualifying[i], qualifying[k]) && compatible(qualifying[j], qualifying[k])) {
          return { status: PASS, factions: [qualifying[i], qualifying[j], qualifying[k]] };
        }
      }
    }
  }
  return {
    status: FAIL,
    stopped_at: {
      quest: null, stage: null, gate: 'three factions at rank 5',
      why: qualifying.length < 3
        ? `only ${qualifying.length} of ${ids.length} factions reach rank 5 (${blocked.slice(0, 2).map((b) => `${b.faction}: ${b.unmet.join(', ')}`).join(' | ')})`
        : `${qualifying.length} factions reach rank 5 but no three are mutually compatible under exclusivity`,
    },
    qualifying,
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
    giver_census: census,
    // ROUND 3. The build failure round 2 reported as `unmeasurable` and thereby charged to the
    // corpus. `unmeasurable` routes to corpus_debt and charges nobody; `fail` charges the build.
    unpassable_gates: {
      note: 'Gates no signature can pass, computed from the SHIPPING offer path: the seeded raw ' +
            'disposition plus the best positive npc_disposition consequence any other quest can ' +
            'contribute. Race-invariant, so the count is the same for all 540 signatures.',
      quests_blocked: allUnpassable.length,
      signatures_affected: allUnpassable.length ? records.length : 0,
      gates: allUnpassable,
      first_stop_histogram: [...unpassable.values()],
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
      npc_records_with_a_reaction_group: [...npcRecords.values()].filter((n) => n.reaction_group || n.group).length,
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

  const base = walkAll(null);
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

  ok('GREEN: on this tree as it stands, no giver bar is unpassable',
    ug.quests_blocked === 0 && nFail(base, 'no_unpassable_gate') === 0,
    `${ug.quests_blocked} unpassable gates; no_unpassable_gate FAIL ${nFail(base, 'no_unpassable_gate')}/${base.length}; ` +
    `${baseReport.giver_census.resolving_to_a_reaction_group}/${baseReport.giver_census.quests_with_a_giver_disposition_min} ` +
    `givers resolve to a reaction group`);

  // RED. Reproduce the defect this tree shipped this morning: givers with no NPC record, so
  // `seedDispositions()` writes nothing and `gate.js num(undefined)` reads 0.
  const fxUnseed = { unseed_givers: true };
  const unseeded = walkAll(fxUnseed);
  const unseededRep = report(unseeded, fxUnseed);
  ok('RED: unseed every giver (no NPC record) and the gate FAILS, as a build failure not as unmeasurable',
    unseededRep.unpassable_gates.quests_blocked > 0
    && nFail(unseeded, 'no_unpassable_gate') > 0
    && unseeded.filter((r) => r.unmeasurable).length === 0,
    `${unseededRep.unpassable_gates.quests_blocked} gates unpassable ` +
    `(${unseededRep.unpassable_gates.gates.slice(0, 4).map((g) => `${g.npc_id} ${g.gate_reads}/${g.requires}`).join(', ')}…); ` +
    `no_unpassable_gate FAIL ${nFail(unseeded, 'no_unpassable_gate')}/${unseeded.length}, ` +
    `${unseeded.filter((r) => r.unmeasurable).length} unmeasurable`);

  ok('RED is PARTIAL, not a constant: the bar is compared, not the presence of a record',
    unseededRep.unpassable_gates.quests_blocked < baseReport.giver_census.quests_with_a_giver_disposition_min,
    `${unseededRep.unpassable_gates.quests_blocked} of ` +
    `${baseReport.giver_census.quests_with_a_giver_disposition_min} givers blocked at register 0 ` +
    `(the shipped requirements run ` +
    `${Math.min(...quests.filter((q) => q.giver && q.giver.disposition_min != null).map((q) => q.giver.disposition_min))}` +
    `-${baseReport.giver_census.max_disposition_min_shipped}) — an all-or-nothing count either way ` +
    `would mean the number is not being read`);

  // N-1 blocks, N opens, on the gates the RED produced.
  const blocked = unseededRep.unpassable_gates.gates;
  if (blocked.length) {
    const need = (g, d) => g.requires - (g.gate_reads - g.seed) + d;
    const fxU = { unseed_givers: true, seed_disposition: Object.fromEntries(blocked.map((g) => [g.npc_id, need(g, -1)])) };
    const fxO = { unseed_givers: true, seed_disposition: Object.fromEntries(blocked.map((g) => [g.npc_id, need(g, 0)])) };
    const nUnder = report(walkAll(fxU), fxU).unpassable_gates.quests_blocked;
    const nOver = report(walkAll(fxO), fxO).unpassable_gates.quests_blocked;
    ok('the NUMBER is read: seeded at N-1 the gate blocks, at N it opens',
      nUnder === blocked.length && nOver === 0,
      `${blocked.length} blocked gates seeded one below their own requirement: ${nUnder} still blocked; ` +
      `seeded AT their requirement: ${nOver} blocked`);
  } else {
    ok('the NUMBER is read: seeded at N-1 the gate blocks, at N it opens', false,
      'the RED produced no blocked gates, so this could not be exercised');
  }

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

  const granted = walkAll({ giver_reaction_group: 'RG-DEEP', quest_disposition_floor: FLOOR });
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

  const moved = walkAll({ region_danger_tier: { 'deep-marshes': 3, 'stone-wastes': 3 } });
  ok('the cohort FOLLOWS danger_tier rather than being hard-coded',
    moved.__cohort.cohort.length !== cohort.cohort.length,
    `deep-marshes and stone-wastes demoted to tier 3: cohort ${cohort.cohort.length} -> ` +
    `${moved.__cohort.cohort.length} entries`);

  const hard = walkAll({ tier5_damage_multiplier: 10 });
  ok('criterion 4 liveness (x10 group damage)',
    nFail(hard, 'tier5_survivable') > nFail(base, 'tier5_survivable'),
    `criterion-4 FAIL ${nFail(base, 'tier5_survivable')} -> ${nFail(hard, 'tier5_survivable')}`);

  const mid = walkAll({ tier5_damage_multiplier: 4 });
  ok('criterion 4 is a MODEL, not a constant (partial failure at x4)',
    nFail(mid, 'tier5_survivable') > 0 && nFail(mid, 'tier5_survivable') < mid.length,
    `x4 group damage: ${nFail(mid, 'tier5_survivable')}/${mid.length} fail criterion 4`);

  const easy = walkAll({ tier5_damage_multiplier: 0.01 });
  ok('criterion 4 monotonicity',
    nFail(easy, 'tier5_survivable') <= nFail(base, 'tier5_survivable'),
    `x0.01: criterion-4 FAIL ${nFail(base, 'tier5_survivable')} -> ${nFail(easy, 'tier5_survivable')}`);

  // ---- criteria 1-3 remain independently falsifiable ---------------------------------------
  // Both run on top of `seed_disposition: 100`, so the offer gate is OPEN and the walk actually
  // reaches the clause under test. Perturbing a criterion that is already red at an earlier gate
  // proves nothing — that was round 1's "floor 200" mistake in a different coat.
  const resBroken = walkAll({ impossible_resolution_gate: true, seed_disposition: 100 });
  const resBase = walkAll({ seed_disposition: 100 });
  ok('criterion 3 falsifiable at the RESOLUTION clause (offer gate held open)',
    nFail(resBroken, 'no_unpassable_gate') > nFail(resBase, 'no_unpassable_gate'),
    `every resolution gated on luck 9999, givers seeded 100 so the walk reaches them: ` +
    `no_unpassable_gate FAIL ${nFail(resBase, 'no_unpassable_gate')} -> ` +
    `${nFail(resBroken, 'no_unpassable_gate')}`);

  const mainBase = walkAll({ seed_disposition: 100 });
  const mainBroken = walkAll({ seed_disposition: 100, quest_disposition_floor: 101 });
  ok('criterion 1 falsifiable (main-quest walk)',
    nFail(mainBroken, 'main_quest') > nFail(mainBase, 'main_quest'),
    `givers seeded 100, every disposition_min raised to 101: main_quest FAIL ` +
    `${nFail(mainBase, 'main_quest')} -> ${nFail(mainBroken, 'main_quest')}`);

  const rankBroken = walkAll({ faction_rank5_attribute_floor: 500 });
  ok('criterion 2 falsifiable (faction ladder)',
    nFail(rankBroken, 'three_factions_rank5') > nFail(base, 'three_factions_rank5'),
    `rank-5 attribute floor -> 500: three_factions_rank5 FAIL ` +
    `${nFail(base, 'three_factions_rank5')} -> ${nFail(rankBroken, 'three_factions_rank5')}`);

  // ---- the null control --------------------------------------------------------------------
  const again = walkAll(null);
  ok('null control (determinism)',
    JSON.stringify(again.map((r) => r.signature + r.viable + r.unmeasurable))
      === JSON.stringify(base.map((r) => r.signature + r.viable + r.unmeasurable)),
    `two unperturbed runs agree on all ${base.length} cells`);

  process.stdout.write(`\nbuild-viability self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
if (args['self-test']) process.exit(selfTest());

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

let records;
if (args.signature) {
  const parts = String(args.signature).split(/[|/]/);
  if (parts.length !== 4) usage(USAGE, EXIT.USAGE);
  const cohortInfo = withFixture(fixture, () => resolveTier5Cohort());
  records = [evaluateSignature(parts[0], parts[1], parts[2], parts[3], fixture, cohortInfo)];
  records.__cohort = cohortInfo;
} else {
  records = walkAll(fixture);
  if (SIGNATURE_SUBSET) {
    const cohort = records.__cohort;
    const filtered = SIGNATURE_SUBSET.race
      ? records.filter((r) => r.signature.startsWith(SIGNATURE_SUBSET.race + '/'))
      : records.slice(0, SIGNATURE_SUBSET.first);
    filtered.__cohort = cohort;
    records = filtered;
    log(`--signatures ${args.signatures}: walking ${records.length} of 540 cells`);
  }
}

// ---------------------------------------------------------------------------------------------
// --cross-check. RI-MTH06 §A requires this tool to be a STATIC walk so it can run in CI, and
// RI-MTH07 says a tool that reads a data file and reports on the data file is measuring the
// design document. This mode is how both are honoured at once: on demand, boot the game and
// compare THIS TOOL'S per-giver disposition numbers against the ones the running build hands
// `canOffer`. A disagreement means the static model has drifted from the world — which is
// exactly what happened to this file mid-round-3, when another agent wired the reaction matrix
// into the quest path and every hard-coded model in the tree became wrong overnight.
// ---------------------------------------------------------------------------------------------
async function crossCheck() {
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 120000) });
  try {
    await handle.page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* ignore */ } });
    const ch = await handle.hOpt('getCharacter');
    const live = await handle.h('questOffers');
    const list = live.offers || live;
    const clauses = {};
    for (const o of (Array.isArray(list) ? list : Object.values(list))) {
      for (const w of (o && o.why) || []) {
        const m = /^(\S+) disposition (\d+)\/(\d+)$/.exec(String(w));
        if (m) clauses[m[1]] = { reads: Number(m[2]), requires: Number(m[3]) };
      }
    }
    const explain = {};
    for (const id of Object.keys(clauses)) explain[id] = await handle.hOpt('explainDisposition', id);

    // The tool's own number for the SAME character the running build is using.
    const sheetRace = (ch && ch.race) || null;
    const sheetUp = (ch && ch.upbringing) || null;
    const sheetSign = (ch && ch.birthsign) || null;
    const rows = [];
    for (const q of quests) {
      if (!(q.giver && q.giver.disposition_min != null)) continue;
      const reach = achievableDisposition(q.giver.npc_id, q);
      const g = resolveGiver(q.giver.npc_id);
      const toolReads = (OFFER_MODEL.model === 'derived' && g.status === 'resolved' && sheetRace)
        ? dispositionCeiling(SEED_DISPOSITIONS.get(q.giver.npc_id) ?? 0, sheetRace, sheetUp, sheetSign, g.group)
        : (SEED_DISPOSITIONS.get(q.giver.npc_id) ?? 0);
      const engineClause = clauses[q.giver.npc_id] || null;
      rows.push({
        quest: q.id, npc_id: q.giver.npc_id, requires: q.giver.disposition_min,
        tool_register: SEED_DISPOSITIONS.get(q.giver.npc_id) ?? 0,
        tool_best_achievable: reach.value,
        tool_gate_reads_for_this_character: toolReads,
        engine_clause: engineClause,
        engine_explain: explain[q.giver.npc_id] || null,
        // The clause only appears when the engine REFUSED, so agreement is checked in the
        // direction the engine actually reports: if the engine refused, the tool must too.
        agrees: engineClause ? (toolReads < q.giver.disposition_min) : true,
      });
    }
    const disagreements = rows.filter((r) => !r.agrees);
    return {
      character: { race: sheetRace, upbringing: sheetUp, birthsign: sheetSign },
      offer_model_detected: OFFER_MODEL.model,
      engine_disposition_clauses: clauses,
      rows,
      disagreements,
      agrees: disagreements.length === 0,
      note: 'The engine only emits a disposition clause when it REFUSES, so this checks the ' +
            'direction that matters: every giver the running build refused must also be refused ' +
            'by the static model for the same character. A disagreement means this file has ' +
            'drifted from game/src and its verdict may not be scored.',
    };
  } finally { await handle.close().catch(() => {}); }
}

const rep = report(records, fixture);
if (args['cross-check']) {
  rep.cross_check = await crossCheck();
  process.stdout.write(
    `cross-check against the running build: ${rep.cross_check.agrees ? 'AGREES' : 'DISAGREES'} ` +
    `(${rep.cross_check.disagreements.length} disagreement(s); offer model ${rep.cross_check.offer_model_detected}; ` +
    `engine refused ${Object.keys(rep.cross_check.engine_disposition_clauses).length} giver(s))\n`);
  for (const d of rep.cross_check.disagreements) {
    process.stdout.write(`  DISAGREE ${d.quest} ${d.npc_id}: engine ${JSON.stringify(d.engine_clause)} vs tool reads ${d.tool_gate_reads_for_this_character}\n`);
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

if (rep.unmeasurable === records.length) {
  process.stderr.write('[harness] ERROR: the measurement could not be taken for ANY signature.\n');
  for (const b of rep.unmeasurable_because) process.stderr.write('[harness]   ' + b + '\n');
  process.exit(EXIT.MEASUREMENT_FAIL);
}
process.exit(rep.viable >= TARGET && rep.unmeasurable === 0 ? 0 : 1);
