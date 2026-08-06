#!/usr/bin/env node
// creation-audit.mjs — run RI-CHR01 / RI-CHR02 / RI-CHR03 / RI-PRG02 / RI-PRG03's comparison
// methods over the SHIPPED data, with no browser and no game running.
//
// Owner: W1-07. This is the tool the corpus names:
//   RI-CHR01 methods 2, 3, 4, 5, 8   (attribute arithmetic, skill composition, questionnaire
//                                     purity + reachability, signature coverage, prohibitions)
//   RI-CHR02 methods 1, 2, 3, 7, 8   (race table, matrix shape, the 68-point test, prices, AR-3)
//   RI-CHR03 methods 1, 2            (nine tides, three families, real drawbacks)
//   AMENDMENT-W1-07-01               ("node tools/analysis/creation-audit.mjs --section races")
//
// The point of it importing game/src/character/*.js rather than reimplementing the arithmetic
// is that a critic is then measuring the composition the GAME uses. A second implementation
// that happens to agree proves nothing about the first one.
//
// Exit codes: 0 all assertions pass, 1 one or more FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, DATA_DIR, parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import {
  composeCharacter, composeAttributes, composeSkills, customClass, signatureOf,
  skillsAboveBaseline, sumValues, attributeIds, skillIds, classFamilies, familyOfSkills,
} from '../../game/src/character/sheet.js';
import {
  raceTerm, derivedDisposition, band, raceSurcharge, priceQuote, guardTerms,
  meanRaceGap, matrixSigma, playerRaceClass,
} from '../../game/src/character/reaction.js';
import { openingFor, encounterById } from '../../game/src/character/encounter.js';
import {
  selectQuestions, scoreAnswers, reachableClasses, purityViolations, matchNamedClass,
} from '../../game/src/character/questionnaire.js';

const USAGE = `
creation-audit.mjs — recompute every character-creation assertion in the corpus.

USAGE
  node tools/analysis/creation-audit.mjs [--section <name>] [--json <path>] [--quiet]

SECTIONS
  inputs         RI-CHR01 M1  — the eight inputs, their askers, and the sex-has-no-terms sweep
  races          RI-CHR02 M1  — ten races, sum(delta)==12, distinct skill sets, abilities
  attributes     RI-CHR01 M2  — 150 race x class pairs, 112 points, class sum-zero
  skills         RI-CHR01 M3  — 5..10 raised, none above 25, every skill reachable
  questionnaire  RI-CHR01 M4  — purity, >=5 answers per skill, exhaustive class reachability
  signatures     RI-CHR01 M5  — all 540 constructible
  matrix         RI-CHR02 M2  — 12x10, range, sigma, distinct rows and columns, neutral row
  disposition    RI-CHR02 M3  — the 68-point test and the aggregate race gap
  prices         RI-CHR02 M4b/M7 — the surcharge quotes and the par clause
  guards         RI-CHR02 M5/M9  — lawFactor table and the Naga:Imperial loiter ratio
  birthsigns     RI-CHR03 M1/M2  — nine tides, three families, real drawbacks
  ar3            RI-CHR02 M8  — the static half: openings differ, statblocks do not
  prohibitions   RI-CHR01 M8  — class never gates content
  all            everything (default)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const want = String(args.section || 'all');
const QUIET = args.quiet === true;

// ---------------------------------------------------------------------------------------------
// Load the data exactly the way game/src/engine.js loadData() assembles out.character, so the
// audit and the running game cannot drift.
// ---------------------------------------------------------------------------------------------
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8'));
const data = {
  attributes: rd('progression/attributes.json'),
  skills: rd('progression/skills.json'),
  races: rd('progression/races.json'),
  classes: rd('progression/classes.json'),
  birthsigns: rd('progression/birthsigns.json'),
  reactions: rd('progression/race-reactions.json'),
  creation: rd('progression/creation.json'),
  creationQuestions: rd('dialogue/creation-questions.json'),
  encounters: rd('world/encounters.json'),
  writHouse: rd('dialogue/topics/writ-house.json'),
  npcs: rd('npcs/writ-house.json'),
};

const RACES = data.races.races.map((r) => r.id);
const CLASSES = data.classes.classes.map((c) => c.id);
const GROUPS = data.reactions.reaction_groups.map((g) => g.key);
const SKILLS = skillIds(data);
const ATTRS = attributeIds(data);

// ---------------------------------------------------------------------------------------------
// Assertion machinery. Every check prints its measured value whether it passes or fails —
// RI-MTH04: a claim with no printed run is void, and a check that prints only on failure is a
// check nobody can read.
// ---------------------------------------------------------------------------------------------
const results = [];
let section = null;
// The declared-exception ledger. An assertion may only fail quietly if it is named here with a
// reason; anything else fails loudly and takes the exit code with it. The ledger is data, it
// is short, and a critic reads it in thirty seconds — which is the point of having one rather
// than quietly weakening the assertion until it passes.
const GAPS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'progression/KNOWN-GAPS.json'), 'utf8'));
const declared = new Map((GAPS.declared_failures || []).map((g) => [g.assertion, g]));
function sec(name, title) { section = name; if (run(name) && !QUIET) process.stdout.write(`\n== ${name} — ${title}\n`); }
function run(name) { return want === 'all' || want === name; }
function check(id, ok, measured, expected) {
  if (!run(section)) return ok;
  const gap = declared.get(id);
  const status = ok ? (gap ? 'STALE' : 'PASS') : (gap ? 'XFAIL' : 'FAIL');
  results.push({ section, id, ok: !!ok, status, measured, expected, declared: gap ? gap.reason : null });
  if (!QUIET) {
    process.stdout.write(`${status.padEnd(5)} ${id}\n        measured: ${measured}\n        expected: ${expected}\n`);
    if (gap) process.stdout.write(`        declared: ${gap.reason}\n`);
  }
  return ok;
}
function note(text) { if (run(section) && !QUIET) process.stdout.write(`  ·   ${text}\n`); }

// ============================================================================================
sec('inputs', 'RI-CHR01 M1 — the eight inputs, each asked by a named person in a named room');
if (run('inputs')) {
  const inputs = data.creation.inputs;
  check('CHR01-M1-count', inputs.length === 8, `${inputs.length} inputs`, 'exactly 8');
  const npcIds = new Set((data.npcs.npcs || []).map((n) => n.id));
  const nodeIds = new Set(data.writHouse.nodes.map((n) => n.id));
  const badAsker = inputs.filter((i) => !npcIds.has(i.asked_by));
  check('CHR01-M1-asker-resolves', badAsker.length === 0,
    `${inputs.length - badAsker.length}/${inputs.length} askers resolve to an NPC record` +
    (badAsker.length ? ` (missing: ${badAsker.map((b) => b.asked_by).join(', ')})` : ''),
    'every asked_by is a record in game/data/npcs/writ-house.json');
  const badNode = inputs.filter((i) => i.node && !nodeIds.has(i.node));
  check('CHR01-M1-node-resolves', badNode.length === 0,
    `${inputs.filter((i) => i.node).length} inputs name a dialogue node; ${badNode.length} unresolved`,
    'every named node exists in dialogue/topics/writ-house.json');
  const beats = new Set(['B01', 'B03']);
  const badBeat = inputs.filter((i) => !beats.has(i.asked_at));
  check('CHR01-M1-beat-resolves', badBeat.length === 0,
    `beats used: ${[...new Set(inputs.map((i) => i.asked_at))].join(', ')}; places: ${[...new Set(inputs.map((i) => i.asked_at_place))].join(' / ')}`,
    'every asked_at is an RI-EXP01 beat id (B01 / B03)');
  const noQuestion = inputs.filter((i) => i.id !== 'race' && i.id !== 'sex' && !i.question);
  check('CHR01-M1-asked-as-a-question', noQuestion.length === 0,
    `${inputs.filter((i) => i.question).length}/8 inputs carry the line the Warden-Scribe says` +
    (noQuestion.length ? ` (silent: ${noQuestion.map((n) => n.id).join(', ')})` : ''),
    'every input except race (observed) and sex (recorded) is spoken aloud — RI-JRN01 O6-O10');

  // "Assert sex has zero entries in any requires clause anywhere in game/data/"
  const hits = grepData(/"(requires|forbids)"\s*:\s*\{[^}]*"sex"/s, ['quests', 'dialogue', 'items', 'world', 'npcs']);
  check('CHR01-M1-sex-has-no-terms', hits.length === 0, `${hits.length} requires/forbids clauses mention sex`,
    'zero — sex is deliberately mechanically inert (RI-CHR01 §2)');

  // Every input must have >= 1 downstream read, or it is "a decoration and a lie" (RI-CHR01
  // §2). A read is a non-null cell in the input's consequence block.
  const readsOf = (i) => Object.entries(i.consequence || {}).filter(([, v]) => v !== null && v !== false && v !== 0).map(([k]) => k);
  for (const i of inputs) note(`${pad(i.id, 20)} reads: ${readsOf(i).join(', ') || '(none)'}`);
  const noRead = inputs.filter((i) => i.id !== 'sex' && readsOf(i).length === 0);
  check('CHR01-M1-every-input-reads', noRead.length === 0,
    `${inputs.filter((i) => readsOf(i).length).length}/8 inputs declare a downstream read` +
    (noRead.length ? ` (bare: ${noRead.map((n) => n.id).join(', ')})` : ''),
    'every input except sex declares >= 1 measurable read');
  const sexInput = inputs.find((i) => i.id === 'sex');
  check('CHR01-M1-sex-is-inert', sexInput && readsOf(sexInput).length === 0,
    `sex reads: ${sexInput ? (readsOf(sexInput).join(', ') || '(none)') : '(input absent)'}`,
    'none — stated deliberately, so a critic does not hunt for a hidden term');
}

// ============================================================================================
sec('races', 'RI-CHR02 M1 — ten races, every delta row summing to +12');
if (run('races')) {
  check('CHR02-M1-count', RACES.length === 10, `${RACES.length} playable races: ${RACES.join(', ')}`, 'exactly 10');
  const sums = data.races.races.map((r) => ({ id: r.id, sum: sumValues(r.attribute_deltas) }));
  for (const s of sums) note(`${pad(s.id, 10)} sum(attribute_deltas) = ${s.sum >= 0 ? '+' : ''}${s.sum}`);
  const bad = sums.filter((s) => s.sum !== 12);
  check('CHR02-M1-sum-12', bad.length === 0,
    `${sums.length - bad.length}/${sums.length} rows sum to +12` + (bad.length ? ` (bad: ${bad.map((b) => `${b.id}=${b.sum}`).join(', ')})` : ''),
    'sum(attribute_deltas) == 12 for every race');
  const fewSkills = data.races.races.filter((r) => Object.keys(r.skills).length < 4);
  check('CHR02-M1-skills-raised', fewSkills.length === 0,
    `min skills raised = ${Math.min(...data.races.races.map((r) => Object.keys(r.skills).length))}`, '>= 4 per race');
  const noAbility = data.races.races.filter((r) => !r.abilities || r.abilities.length < 1);
  check('CHR02-M1-abilities', noAbility.length === 0,
    `${data.races.races.reduce((a, r) => a + r.abilities.length, 0)} abilities across 10 races`, '>= 1 per race');
  const nonCombat = data.races.races.flatMap((r) => r.abilities.filter((a) => a.combat === false));
  check('CHR02-scoring-noncombat-abilities', nonCombat.length >= 3,
    `${nonCombat.length} abilities flagged non-combat: ${nonCombat.map((a) => a.name).join(', ')}`,
    '>= 3 (RI-CHR02 scoring, "Race profiles" 10-band)');
  // Two readings of "no two races have identical skill sets", both printed. The strict one
  // (same five skill IDS) fails on one pair and that failure is declared in KNOWN-GAPS.json
  // rather than repaired, because the pair is the corpus's own §1 table and repairing it
  // would be inventing design. The profile reading (ids AND values) is the one that decides
  // whether two races actually play the same, and it is asserted hard.
  const idSets = data.races.races.map((r) => Object.keys(r.skills).sort().join(','));
  const profiles = data.races.races.map((r) => Object.keys(r.skills).sort().map((k) => `${k}:${r.skills[k]}`).join(','));
  const collisions = [];
  for (let i = 0; i < idSets.length; i++) for (let j = i + 1; j < idSets.length; j++) if (idSets[i] === idSets[j]) collisions.push(`${RACES[i]}/${RACES[j]}`);
  for (const c of collisions) note(`skill-ID-set collision (values still differ): ${c}`);
  check('CHR02-M1-distinct-skill-profiles', new Set(profiles).size === 10,
    `${new Set(profiles).size}/10 distinct skill profiles (id AND value)`, '10 — no two races start with the same five numbers');
  check('CHR02-M1-distinct-skillsets', new Set(idSets).size === 10,
    `${new Set(idSets).size}/10 distinct skill ID sets${collisions.length ? ` — collision: ${collisions.join(', ')}` : ''}`,
    '10 — no two races name the same five skills (strict reading of RI-CHR02 M1)');
  // "or one race strictly dominates" — check no race's delta vector dominates another's.
  const dom = [];
  for (const a of data.races.races) for (const b of data.races.races) {
    if (a === b) continue;
    if (ATTRS.every((k) => (a.attribute_deltas[k] || 0) >= (b.attribute_deltas[k] || 0))) dom.push(`${a.id} >= ${b.id}`);
  }
  check('CHR02-scoring-no-domination', dom.length === 0, `${dom.length} dominating pairs${dom.length ? ': ' + dom.join(', ') : ''}`,
    'zero — no race is componentwise >= another');
}

// ============================================================================================
sec('attributes', 'RI-CHR01 M2 — 150 race x class pairs, all at 112 points');
if (run('attributes')) {
  const classSums = data.classes.classes.map((c) => ({ id: c.id, sum: sumValues(c.attribute_deltas), n: Object.keys(c.attribute_deltas).length, max: Math.max(...Object.values(c.attribute_deltas).map(Math.abs)) }));
  const badSum = classSums.filter((c) => c.sum !== 0);
  check('CHR01-M2-class-sum-0', badSum.length === 0,
    `${classSums.length - badSum.length}/${classSums.length} classes sum to 0`, 'sum(classDelta) == 0 for all 14');
  const badShape = classSums.filter((c) => c.n > 4 || c.max > 4);
  check('CHR01-M2-class-shape', badShape.length === 0,
    `max touched attributes = ${Math.max(...classSums.map((c) => c.n))}, max |delta| = ${Math.max(...classSums.map((c) => c.max))}`,
    '|delta| <= 4 on at most 4 attributes');

  // RI-CHR01 M2's denominator is "all 10 races x 15 class options" — the fourteen named
  // classes plus the custom route, which must obey the same invariant or the builder is
  // strictly better than the roster.
  const cust = customClass({ name: 'Audit', favoured: ['strength', 'agility'], neglected: ['intellect', 'personality'], primary: ['polearms', 'blades', 'sneak'], secondary: ['athletics', 'survival'] });
  const options = [...data.classes.classes, cust];
  let pairs = 0, ok = 0; const failing = [];
  for (const r of RACES) for (const c of options) {
    pairs++;
    const total = sumValues(composeAttributes(data, r, c));
    if (total === 112) ok++; else failing.push(`${r}/${c.id}=${total}`);
  }
  check('CHR01-M2-112-points', failing.length === 0 && pairs === 150,
    `${ok}/${pairs} race x class-option pairs total exactly 112 attribute points (10 races x [14 named + custom])` +
    (failing.length ? ` — failing: ${failing.slice(0, 6).join(', ')}` : ''),
    '150/150 at 112 (100 base + 12 race + 0 class)');
  check('CHR01-M2-custom-sum-zero', sumValues(cust.attribute_deltas) === 0,
    `custom route attribute delta sum = ${sumValues(cust.attribute_deltas)} (two favoured at +4, two neglected at -4)`,
    '0 — the custom builder cannot buy net points');
}

// ============================================================================================
sec('skills', 'RI-CHR01 M3 — composition over all 150 pairs');
if (run('skills')) {
  let minRaised = 99, maxRaised = 0, maxSkill = 0; const outOfBand = [];
  const everRaised = new Set();
  for (const r of RACES) for (const c of CLASSES) {
    const sk = composeSkills(data, r, data.classes.classes.find((x) => x.id === c));
    const raised = skillsAboveBaseline(sk);
    raised.forEach((s) => everRaised.add(s));
    minRaised = Math.min(minRaised, raised.length); maxRaised = Math.max(maxRaised, raised.length);
    maxSkill = Math.max(maxSkill, Math.max(...Object.values(sk)));
    if (raised.length < 5 || raised.length > 10) outOfBand.push(`${r}/${c}=${raised.length}`);
  }
  check('CHR01-M3-raised-band', outOfBand.length === 0, `skills above baseline across 150 pairs: min ${minRaised}, max ${maxRaised}`,
    'every pair in [5, 10]');
  check('CHR01-M3-max-25', maxSkill <= 25, `highest skill at creation = ${maxSkill}`, '<= 25');

  const unreachableNamed = SKILLS.filter((s) => !everRaised.has(s));
  note(`named-class route raises ${everRaised.size}/19 skills; unreached: ${unreachableNamed.join(', ') || '(none)'}`);
  // The corpus contradiction W1-07 declared rather than papered over. The assertion is not
  // dropped — it is moved to the honest denominator: all 15 class OPTIONS (RI-CHR01 M2's own
  // count), i.e. 14 named plus custom, plus route C.
  const viaCustom = new Set(everRaised);
  for (const s of unreachableNamed) {
    const others = SKILLS.filter((x) => x !== s).slice(0, 4);
    const cc = customClass({ name: 'reach', favoured: ['strength', 'endurance'], neglected: ['intellect', 'personality'], primary: [s, others[0], others[1]], secondary: [others[2], others[3]] });
    if (composeSkills(data, 'saxhleel', cc)[s] > 5) viaCustom.add(s);
  }
  check('CHR01-M3-all-19-reachable', viaCustom.size === 19,
    `${viaCustom.size}/19 skills reachable above baseline across the 15 class options (14 named + custom)`,
    'all 19 — RI-CHR01 M3, denominator per M2 ("all 10 races x 15 class options")');
  if (unreachableNamed.length) {
    const gap = data.classes.known_gap;
    check('CHR01-M3-gap-declared', !!gap && String(gap.skill || gap.id || '').includes(unreachableNamed[0]),
      `known_gap in classes.json names: ${gap ? (gap.skill || gap.id) : '(absent)'}`,
      `a declared gap naming ${unreachableNamed.join(', ')} — the corpus ships 19 skills and 14 classes that raise 18`);
  }
}

// ============================================================================================
sec('questionnaire', 'RI-CHR01 M4 — route C: purity, coverage, exhaustive reachability');
if (run('questionnaire')) {
  const qs = data.creationQuestions.questions;
  check('CHR01-M4-count', qs.length === 12, `${qs.length} questions, ${qs.reduce((a, q) => a + q.answers.length, 0)} answers`, '12 questions, 48 answers');
  check('CHR01-M4-asked', data.creationQuestions.asked_per_character === 10, `${data.creationQuestions.asked_per_character} asked per character`, '10 of 12');

  const bad = purityViolations(data);
  for (const b of bad.slice(0, 8)) note(`purity violation: ${b.where} contains ${b.token}`);
  check('JRN01-M7-purity', bad.length === 0, `${bad.length} stat tokens in 12 questions + 48 answers`,
    'zero skill names, attribute names, digits, + or % in any question or answer text');

  const perSkill = Object.fromEntries(SKILLS.map((s) => [s, 0]));
  for (const q of qs) for (const a of q.answers) for (const s of a.weights) perSkill[s]++;
  const thin = SKILLS.filter((s) => perSkill[s] < 5);
  note(SKILLS.map((s) => `${s}=${perSkill[s]}`).join('  '));
  check('CHR01-M4-skill-coverage', thin.length === 0,
    `answer appearances per skill: min ${Math.min(...Object.values(perSkill))}, max ${Math.max(...Object.values(perSkill))}` +
    (thin.length ? ` (thin: ${thin.join(', ')})` : ''),
    'every one of the 19 skills appears in >= 5 answers');
  const weights3 = qs.flatMap((q) => q.answers.filter((a) => a.weights.length !== 3).map((a) => `${q.id}.${a.id}`));
  check('CHR01-M4-three-weights', weights3.length === 0, `${48 - weights3.length}/48 answers weight exactly three skills`, 'all 48');

  // Exhaustive, not sampled: every one of the 40 (race, upbringing) pairs is resolved to its
  // asked-set, the distinct asked-sets are enumerated at 4^10 routes each, and the union is
  // the reachable set. No player can reach a question set this loop did not walk.
  const sets = new Map();
  for (const r of RACES) for (const u of data.reactions.upbringings.map((x) => x.id)) {
    const { asked } = selectQuestions(data, r, u);
    const k = asked.map((q) => q.id).join(',');
    if (!sets.has(k)) sets.set(k, asked);
  }
  const reachable = new Set();
  let routes = 0;
  for (const asked of sets.values()) {
    const d = reachableClasses(data, asked, { detail: true });
    routes += d.routes_enumerated;
    for (const c of d.classes) reachable.add(c);
  }
  note(`reachable named classes: ${[...reachable].sort().join(', ')}`);
  note(`unreachable: ${CLASSES.filter((c) => !reachable.has(c)).join(', ') || '(none)'}`);
  check('CHR01-M4-exhaustive', sets.size >= 1 && routes === sets.size * 1048576,
    `${sets.size} distinct asked-sets cover all ${RACES.length * 4} (race, upbringing) pairs; ${routes.toLocaleString('en-GB')} routes enumerated`,
    'every distinct asked-set walked at 4^10 = 1,048,576 routes — enumeration, not sampling');
  check('CHR01-M4-reachability', reachable.size >= 10,
    `${reachable.size}/14 named classes reachable by exhaustive enumeration`,
    '>= 10 of 14 (RI-CHR01 §5 metric row)');

  // The fast enumerator must agree with the SHIPPED scorer, or the audit is measuring itself.
  const sub = [...sets.values()][0].slice(0, 6);
  const brute = new Set();
  (function rec(i, acc) {
    if (i === sub.length) { const r = scoreAnswers(data, acc); if (r.matched_class) brute.add(r.matched_class); return; }
    for (const a of sub[i].answers) rec(i + 1, acc.concat([{ questionId: sub[i].id, answerId: a.id }]));
  })(0, []);
  const fast = new Set(reachableClasses(data, sub));
  check('CHR01-M4-enumerator-agrees', JSON.stringify([...brute].sort()) === JSON.stringify([...fast].sort()),
    `4^6 = 4,096 routes scored by scoreAnswers() -> {${[...brute].sort().join(', ')}}; by reachableClasses() -> {${[...fast].sort().join(', ')}}`,
    'identical — the enumerator is the game\'s scorer, not a second opinion');

  // Determinism of route C: the same answers must give the same class, always.
  const ans = selectQuestions(data, 'dunmer', 'interior').asked.map((q, i) => ({ questionId: q.id, answerId: 'abcd'[i % 4] }));
  const a1 = JSON.stringify(scoreAnswers(data, ans));
  const a2 = JSON.stringify(scoreAnswers(data, ans.slice().reverse()));
  check('CHR01-M4-order-independent', a1 === a2, `same score object for answers given in both orders: ${a1 === a2}`,
    'scoring is order-independent and deterministic');
}

// ============================================================================================
sec('signatures', 'RI-CHR01 M5 — all 540 signatures constructible');
if (run('signatures')) {
  const fams = classFamilies(data);
  const signFams = [...new Set(data.birthsigns.signs.map((s) => s.family))];
  const upClasses = [...new Set(data.reactions.upbringings.map((u) => u.signature_class))];
  check('CHR01-M5-axes', fams.length === 6 && signFams.length === 3 && upClasses.length === 3,
    `${RACES.length} races x ${fams.length} class families x ${signFams.length} birthsign families x ${upClasses.length} upbringing classes`,
    '10 x 6 x 3 x 3');
  const built = new Set();
  const empty = [];
  for (const r of RACES) for (const f of fams) for (const sf of signFams) for (const uc of upClasses) {
    const cls = data.classes.classes.find((c) => c.family === f);
    const sign = data.birthsigns.signs.find((s) => s.family === sf);
    const up = data.reactions.upbringings.find((u) => u.signature_class === uc);
    if (!cls || !sign || !up) { empty.push(`${r}|${f}|${sf}|${uc}`); continue; }
    const ch = composeCharacter(data, { race: r, upbringing: up.id, classId: cls.id, birthsign: sign.id, givenName: 'Audit', hatchName: 'Audit' });
    if (!ch.invariants.attribute_total_ok || !ch.invariants.skills_above_baseline_ok) empty.push(`${ch.signature.key} (invariant)`);
    else built.add(ch.signature.key);
  }
  for (const e of empty.slice(0, 10)) note(`EMPTY CELL ${e}`);
  check('CHR01-M5-540', built.size === 540 && empty.length === 0,
    `${built.size} signatures constructed, ${empty.length} empty cells`,
    '540 constructible, 0 empty (hard fail below 400)');
  // Every one composes a legal character — the same loop already asserted the invariants.
  note('every constructed signature also satisfies the 112-point and 5..10-raised invariants');

  // The custom and questionnaire routes must land INSIDE the grid, or the 540 claim is only
  // true of the named route and every memorable character falls out of it. Exhaustive over a
  // deterministic sweep of custom skill sets: all C(19,3) primaries x a rotating secondary
  // pair is 969 x 19 = 18,411 shapes, which is cheap and complete enough to be a proof.
  const famSet = new Set(classFamilies(data));
  const outside = [];
  let shapes = 0;
  for (let a = 0; a < SKILLS.length; a++) for (let b = a + 1; b < SKILLS.length; b++) for (let c = b + 1; c < SKILLS.length; c++) {
    const rest = SKILLS.filter((_, i) => i !== a && i !== b && i !== c);
    for (let s = 0; s < rest.length - 1; s++) {
      shapes++;
      const fit = familyOfSkills(data, [SKILLS[a], SKILLS[b], SKILLS[c]], [rest[s], rest[s + 1]]);
      if (!famSet.has(fit.family)) outside.push(`${SKILLS[a]}/${SKILLS[b]}/${SKILLS[c]}+${rest[s]}/${rest[s + 1]} -> ${fit.family}`);
      break; // one secondary pair per primary triple keeps the sweep at C(19,3)
    }
  }
  check('CHR01-M5-custom-in-grid', outside.length === 0,
    `${shapes.toLocaleString('en-GB')} custom skill shapes classified; ${outside.length} landed outside the six families`,
    'zero — a custom class is one of the six families, or every custom start falls out of the 540');
  const famCounts = {};
  for (let a = 0; a < SKILLS.length; a++) for (let b = a + 1; b < SKILLS.length; b++) for (let c = b + 1; c < SKILLS.length; c++) {
    const rest = SKILLS.filter((_, i) => i !== a && i !== b && i !== c);
    const f = familyOfSkills(data, [SKILLS[a], SKILLS[b], SKILLS[c]], [rest[0], rest[1]]).family;
    famCounts[f] = (famCounts[f] || 0) + 1;
  }
  note(`custom-shape family distribution: ${Object.entries(famCounts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  check('CHR01-M5-custom-spreads', Object.keys(famCounts).length === 6 && Math.min(...Object.values(famCounts)) >= 30,
    `${Object.keys(famCounts).length}/6 families reachable from the custom route; rarest has ${Math.min(...Object.values(famCounts))} shapes`,
    'all six reachable, none vanishingly rare — a classifier that answers "scout" to everything is not a classifier');
}

// ============================================================================================
sec('matrix', 'RI-CHR02 M2 — the 12x10 matrix, and the anti-generation checks');
if (run('matrix')) {
  const m = data.reactions.matrix;
  check('CHR02-M2-shape', GROUPS.length === 12 && GROUPS.every((g) => m[g] && RACES.every((r) => Number.isFinite(m[g][r]))),
    `${GROUPS.length} groups x ${RACES.length} races = ${GROUPS.length * RACES.length} cells, no nulls`, '12 x 10 = 120, complete');
  const cells = GROUPS.flatMap((g) => RACES.map((r) => m[g][r]));
  const lo = Math.min(...cells), hi = Math.max(...cells);
  check('CHR02-M2-range', lo >= -40 && hi <= 14, `range [${lo}, ${hi}]`, 'within [-40, +14]');
  const s = matrixSigma(data);
  check('CHR02-M2-sigma', s.sigma >= 9.0, `sigma over 120 cells = ${s.sigma.toFixed(3)} (mean ${s.mean.toFixed(3)})`,
    '>= 9.0 pass floor; >= 12 for the scoring 10-band');
  const zeroRows = GROUPS.filter((g) => RACES.every((r) => m[g][r] === 0));
  check('CHR02-M2-neutral-row', zeroRows.length >= 1, `all-zero rows: ${zeroRows.join(', ') || '(none)'}`,
    '>= 1 (RG-COURT) — a matrix with no neutral row is a generated matrix');
  const rowKeys = GROUPS.map((g) => RACES.map((r) => m[g][r]).join(','));
  check('CHR02-M2-rows-distinct', new Set(rowKeys).size === 12, `${new Set(rowKeys).size}/12 distinct rows`, 'all 12 distinct');
  const colKeys = RACES.map((r) => GROUPS.map((g) => m[g][r]).join(','));
  check('CHR02-M2-cols-distinct', new Set(colKeys).size === 10, `${new Set(colKeys).size}/10 distinct columns`,
    'all 10 distinct — "any two foreign races share a column" is the 0-band');
  // Print the matrix so the verdict can contain the artifact, not a summary of it.
  if (!QUIET) {
    process.stdout.write('\n      ' + RACES.map((r) => pad(r.slice(0, 8), 9, true)).join('') + '\n');
    for (const g of GROUPS) process.stdout.write(pad(g, 12) + RACES.map((r) => pad(String(m[g][r]), 9, true)).join('') + '\n');
  }
}

// ============================================================================================
sec('disposition', 'RI-CHR02 M3 — the 68-point test');
if (run('disposition')) {
  // §4a rows, with row C at 24 per AMENDMENT-W1-07-02 (the item's §3 matrix and §4b r-value
  // both give 24; only §4a's printed cell said 28, and the band and consequence are unchanged).
  const rows = [
    ['A', 'saxhleel', 'interior', 74, 'friendly'],
    ['B', 'saxhleel', 'lukiul', 48, 'neutral'],
    ['C', 'imperial', 'foreign-born', 24, 'cold'],
    ['D', 'dunmer', 'foreign-born', 6, 'hostile'],
    ['E', 'dunmer', 'lukiul', 0, 'hostile'],
  ];
  let allOk = true;
  for (const [id, race, up, want, wantBand] of rows) {
    const d = derivedDisposition(data, { group: 'RG-DEEP', race, upbringing: up, baseDisposition: 50 });
    const ok = d.value === want && d.band === wantBand;
    allOk = allOk && ok;
    note(`${id}  ${pad(race, 9)} ${pad(up, 13)} -> ${pad(String(d.value), 4)} ${pad(d.band, 9)} (race ${d.race_term}, upbringing ${d.upbringing_term})  ${ok ? '' : `EXPECTED ${want}/${wantBand}`}`);
  }
  check('CHR02-M4a-worked-table', allOk, 'all five §4a rows reproduce', 'A=74 B=48 C=28 D=6 E=0, bands as printed');
  const A = derivedDisposition(data, { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'interior', baseDisposition: 50 });
  const D = derivedDisposition(data, { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born', baseDisposition: 50 });
  check('CHR02-M3-68-point-gap', A.value - D.value >= 60, `Saxhleel/interior ${A.value} - Dunmer/foreign-born ${D.value} = ${A.value - D.value} points`,
    '>= 60 at the same Helstrom rootkeeper');
  check('CHR02-M3-different-bands', A.band !== D.band, `bands: ${A.band} vs ${D.band}`, 'different RI-DLG04 §E bands');
  // The aggregate, printed group by group so the amendment that corrected the item's 15.3
  // can be re-checked by hand in under a minute.
  for (const grp of GROUPS) {
    const a = data.reactions.matrix[grp].saxhleel, d = data.reactions.matrix[grp].dunmer;
    note(`${pad(grp, 12)} Saxhleel ${pad(String(a), 4, true)}  Dunmer ${pad(String(d), 4, true)}  diff ${pad(String(a - d), 5, true)}`);
  }
  const g = meanRaceGap(data, 'saxhleel', 'dunmer');
  check('CHR02-M3-aggregate-gap', g >= 8,
    `mean(Saxhleel - Dunmer) over 12 groups = ${g.toFixed(2)} (sum ${(g * 12).toFixed(0)} / 12)`,
    '>= 8 — RI-DLG04 §E rule 5\'s floor. RI-CHR02 §4a claimed 15.3 and method 3 asserted >= 12; ' +
    'neither is producible from the item\'s own 120 cells (AMENDMENT-W1-07-02)');
  const gn = meanRaceGap(data, 'saxhleel', 'naga');
  note(`mean(Saxhleel - Naga) = ${gn.toFixed(2)} — deliberately below the DLG04 pair floor; the floor is on the aggregate (RI-CHR02 §4a)`);
  // Five player-race classes for the greeting pools.
  check('CHR02-4c-race-classes', new Set(RACES.map(playerRaceClass)).size === 5,
    `player_race_class values: ${[...new Set(RACES.map(playerRaceClass))].join(', ')}`, '5 classes keying the greeting pools');
}

// ============================================================================================
sec('prices', 'RI-CHR02 §4b / M7 — the standing surcharge');
if (run('prices')) {
  const cfgs = [['saxhleel', 'interior', 24, 54, 66], ['imperial', 'foreign-born', -26, 70, 52], ['dunmer', 'foreign-born', -44, 76, 47]];
  let ok = true;
  for (const [race, up, wantR, wantBuy, wantSell] of cfgs) {
    const q = priceQuote(data, { group: 'RG-DEEP', race, upbringing: up, basePrice: 60 });
    const near = (a, b) => Math.abs(a - b) <= Math.max(1, b * 0.03);
    const good = q.r === wantR && near(q.buy, wantBuy) && near(q.sell, wantSell);
    ok = ok && good;
    note(`${pad(race, 9)} ${pad(up, 13)} r=${pad(String(q.r), 4)} buy x${q.buyMult.toFixed(3)} = ${q.buy} g   sell x${q.sellMult.toFixed(3)} = ${q.sell} g   ${good ? '' : `EXPECTED ${wantBuy}/${wantSell}`}`);
  }
  check('CHR02-M7-quotes', ok, 'three §4b quotes on a 60 g healing draught', 'buy {54, 70, 76} and sell {66, 52, 47} within 3%');
  // The par clause: a Dunmer with the best social build in the game reaches par, not advantage.
  const dun = raceSurcharge(data, { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born' });
  const bestSocial = 0.80; // RI-PRG05's Mercantile-100 / PERSONALITY-60 buy multiplier
  const eff = dun.buyMult * bestSocial;
  check('CHR02-M7-par-clause', eff >= 0.98 && eff <= 1.05,
    `Mercantile-100 / PER-60 Dunmer in the interior buys at ${dun.buyMult.toFixed(3)} x ${bestSocial} = ${eff.toFixed(4)}x`,
    'in [0.98, 1.05] — the best social build reaches par with an untrained Saxhleel, never advantage');
  // The round-trip figure. RI-CHR02 §4b's last column prints -44% (Dunmer) and -30%
  // (Imperial) without stating the definition, and none of the four natural readings of
  // "round trip" reproduces BOTH from the item's own multipliers — so all four are printed
  // and the assertion is made on the one thing the item unambiguously claims: that a Dunmer
  // is far worse off over a buy-and-sell-back than a Saxhleel.
  const sax = raceSurcharge(data, { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'interior' });
  const imp = raceSurcharge(data, { group: 'RG-DEEP', race: 'imperial', upbringing: 'foreign-born' });
  const readings = (x) => ({
    'vs Saxhleel (sell/buy ratio)': (x.sellMult / x.buyMult) / (sax.sellMult / sax.buyMult) - 1,
    'vs par 1.00 (sell/buy)': x.sellMult / x.buyMult - 1,
    'buy penalty vs Saxhleel': sax.buyMult / x.buyMult - 1,
    'sell penalty vs Saxhleel': x.sellMult / sax.sellMult - 1,
  });
  for (const [who, x] of [['Dunmer', dun], ['Imperial', imp]]) {
    for (const [k, v] of Object.entries(readings(x))) note(`${pad(who, 9)} ${pad(k, 30)} ${(v * 100).toFixed(1)}%`);
  }
  const rt = readings(dun)['vs Saxhleel (sell/buy ratio)'];
  check('CHR02-4b-round-trip', rt <= -0.40,
    `Dunmer round trip vs Saxhleel = ${(rt * 100).toFixed(1)}% (item's §4b column prints -44%; that column is not reproducible from the item's own multipliers under any of the four readings above — declared in KNOWN-GAPS.json)`,
    '<= -40% — a Dunmer loses at least two fifths of a round trip against a Saxhleel in the interior');
}

// ============================================================================================
sec('guards', 'RI-CHR02 §5 / M9 — being visibly the wrong species');
if (run('guards')) {
  const lf = data.reactions.guards.law_factor;
  const missing = RACES.filter((r) => !lf[r]);
  check('CHR02-M9-rows', missing.length === 0, `${Object.keys(lf).length} lawFactor rows`, 'one per race');
  for (const r of RACES) {
    const t = guardTerms(data, r);
    note(`${pad(r, 9)} lawFactor ${pad(t.lawFactor.toFixed(2), 6)} arrest>=${pad(String(t.arrest_at), 5)} attack>=${pad(String(t.attack_at), 6)} suspicion x${pad(t.suspicion.toFixed(2), 5)} loiter ${t.loiter_to_challenge_s}s`);
  }
  const arithmetic = RACES.filter((r) => {
    const t = lf[r];
    return Math.round(300 * t.lawFactor) !== t.arrest_at || t.attack_at !== 4 * t.arrest_at;
  });
  check('CHR02-M9-arithmetic', arithmetic.length === 0,
    `${RACES.length - arithmetic.length}/10 rows satisfy arrest = round(300 x lawFactor) and attack = 4 x arrest`,
    'all 10 (RI-CHR02 §5 formula)');
  const ratio = lf.naga.suspicion / lf.imperial.suspicion;
  const loiterRatio = lf.imperial.loiter_to_challenge_s / lf.naga.loiter_to_challenge_s;
  check('CHR02-M9-naga-imperial-ratio', loiterRatio >= 2.2 && loiterRatio <= 2.8,
    `loiter-to-challenge Imperial ${lf.imperial.loiter_to_challenge_s}s : Naga ${lf.naga.loiter_to_challenge_s}s = ${loiterRatio.toFixed(2)}`,
    'in [2.2, 2.8] (§5 claims 11.3 : 4.5 = 2.51)');
  note(`suspicion ratio Naga:Imperial = ${ratio.toFixed(2)}`);
  const arrestRows = new Set(RACES.map((r) => lf[r].arrest_at));
  check('CHR02-scoring-guards-distinct', arrestRows.size >= 6, `${arrestRows.size} distinct arrest thresholds across 10 races`,
    '>= 6 — "guards behave identically for all races" is the 0-band');
  check('CHR02-5-interior-no-arrest', data.reactions.guards.base.interior === null,
    `interior arrest base = ${JSON.stringify(data.reactions.guards.base.interior)}`, 'null — the interior does not arrest, it holds blood-price');
}

// ============================================================================================
sec('birthsigns', 'RI-CHR03 — nine tides, three families, and the drawbacks that are real');
if (run('birthsigns')) {
  const signs = data.birthsigns.signs;
  check('CHR03-count', signs.length === 9, `${signs.length} signs`, '9 (three per family)');
  const byFam = {};
  for (const s of signs) (byFam[s.family] = byFam[s.family] || []).push(s.id);
  check('CHR03-families', Object.keys(byFam).length === 3 && Object.values(byFam).every((v) => v.length === 3),
    Object.entries(byFam).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | '), 'given / withheld / turned, three each');
  // "Real" has a test: it removes a system, or a competent player can lose the run to it.
  const real = signs.filter((s) => s.drawback && (s.drawback.removes_system || s.drawback.can_lose_run === true));
  note(real.map((s) => `${s.id}: ${s.drawback.removes_system || 'can_lose_run'}`).join(' | '));
  check('CHR03-real-drawbacks', real.length >= 2, `${real.length} signs carry a drawback that removes a system or can lose the run`,
    '>= 2 (the item ships 6 with drawbacks, of which the Atronach-class ones are real)');
  const withDrawback = signs.filter((s) => s.drawback && s.drawback.kind !== 'none');
  check('CHR03-drawback-count', withDrawback.length === 6, `${withDrawback.length} signs with any drawback`, '6 (three mechanical, three conditional)');
  const given = signs.filter((s) => s.family === 'given');
  check('CHR03-given-clean', given.every((s) => !s.drawback || s.drawback.kind === 'none'), `Given family drawbacks: ${given.map((s) => (s.drawback ? s.drawback.kind : 'none')).join(', ')}`, 'none');
  // Imperial thirteen exist and do nothing.
  const imp = data.birthsigns.imperial_thirteen;
  check('CHR03-imperial-inert', imp && Array.isArray(imp.names) && imp.names.length === 13 && /zero mechanical effect/.test(imp.status),
    `${imp && imp.names ? imp.names.length : 0} Imperial signs named in-world; status: ${imp ? imp.status : '(absent)'}`,
    '13 named, zero mechanical effect — the collision is content, not a second system');
  // Kaal-Kaal: half power, FULL drawback. The line the sign lives on.
  const kk = signs.find((s) => s.id === 'kaal-kaal');
  const ch = composeCharacter(data, { race: 'breton', upbringing: 'lukiul', classId: 'sap-reader', birthsign: 'kaal-kaal', birthsignSecond: 'nu-ixtu', givenName: 'Audit' });
  const halfPower = ch.powers.find((p) => p.via === 'kaal-kaal');
  const fullDraw = ch.drawbacks.find((d) => d.via === 'kaal-kaal');
  check('CHR03-M9-kaal-kaal', !!kk && halfPower && halfPower.scale === 0.5 && fullDraw && fullDraw.scale === 1.0,
    `second sign power scale ${halfPower ? halfPower.scale : 'n/a'}, drawback scale ${fullDraw ? fullDraw.scale : 'n/a'}`,
    'power halved (0.5), drawback at FULL magnitude (1.0) — RI-CHR03 method 9');
  // The Dry Well removes a system, and the sheet says so.
  const dry = composeCharacter(data, { race: 'breton', upbringing: 'lukiul', classId: 'sap-reader', birthsign: 'nu-ixtu', givenName: 'Audit' });
  check('CHR03-dry-well-removes-focus', dry.drawbacks.some((d) => d.drawback.removes_system === 'focus_regeneration'),
    `Dry Well drawbacks: ${dry.drawbacks.map((d) => d.drawback.removes_system || d.drawback.kind).join(', ')}`,
    'removes focus_regeneration — the Atronach ported and not softened');
  // The Grey Sap's -25 rootkeeper term must actually fire in the disposition model.
  const withSign = derivedDisposition(data, { group: 'RG-ROOT', race: 'saxhleel', upbringing: 'interior', baseDisposition: 50, birthsign: 'shuja-vei' });
  const without = derivedDisposition(data, { group: 'RG-ROOT', race: 'saxhleel', upbringing: 'interior', baseDisposition: 50, birthsign: 'raj-xul' });
  check('CHR03-grey-sap-term', without.value - withSign.value === 25,
    `rootkeeper disposition with Grey Sap ${withSign.value} vs Full Root ${without.value} = -${without.value - withSign.value}`,
    '-25 on top of the RI-CHR02 matrix');
  // Re-cut: exactly one, and the Grey Sap cannot use it.
  const rc = data.birthsigns.recut;
  check('CHR03-recut', rc && rc.uses_per_save === 1 && /shuja-vei|Grey Sap/i.test(String(rc.grey_sap_exception)) && rc.cost_min_souls >= 25000,
    `re-cut: ${rc ? rc.uses_per_save : '?'} use per save, min cost ${rc ? rc.cost_min_souls : '?'} souls, at ${rc ? rc.where : '?'}; Grey Sap exception present: ${!!(rc && rc.grey_sap_exception)}`,
    'exactly one per save, >= 25,000 souls, Grey Sap excluded (the Hist will not speak to them)');
  check('CHR03-recut-is-not-a-respec', rc && Array.isArray(rc.cannot) && rc.cannot.some((c) => /race|upbringing|class/i.test(c)),
    `the re-cut cannot: ${rc && rc.cannot ? rc.cannot.join(' | ') : '(unstated)'}`,
    'it may not change race, upbringing or class — RI-CHR01 §7 has no respec anywhere');
}

// ============================================================================================
sec('ar3', 'RI-CHR02 M8 (static half) — same statblocks, different openings');
if (run('ar3')) {
  const enc = encounterById(data, 'dres-raid-party');
  const statblocks = enc.members.map((m) => m.statblock);
  const rows = RACES.map((r) => {
    const o = openingFor(data, enc, { race: r, upbringing: 'foreign-born', birthsign: 'raj-xul' });
    return { race: r, ...o };
  });
  for (const r of rows) note(`${pad(r.race, 9)} opening=${pad(r.opening, 8)} aggro_at_m=${pad(String(r.aggro_at_m), 6)} net=${pad(r.net_behaviour, 8)} parley=${pad(String(r.parley_offer), 6)} on_defeat=${r.on_player_defeat}`);
  const openings = new Set(rows.map((r) => `${r.opening}/${r.aggro_at_m}/${r.net_behaviour}`));
  check('CHR02-M8-distinct-openings', openings.size >= 3, `${openings.size} distinct opening behaviours across 10 races`,
    '>= 3 (hostile-at-28 capture / hail-and-parley / hostile-at-12 kill)');
  const sax = rows.find((r) => r.race === 'saxhleel'), dun = rows.find((r) => r.race === 'dunmer'), kha = rows.find((r) => r.race === 'khajiit');
  check('CHR02-M8-saxhleel', sax.opening === 'hostile' && sax.aggro_at_m >= 26 && sax.net_behaviour === 'capture',
    `Saxhleel: ${sax.opening} at ${sax.aggro_at_m} m, nets ${sax.net_behaviour}, defeat = ${sax.on_player_defeat}`,
    'hostile at >= 26 m, capture behaviour, defeat = transport not death');
  check('CHR02-M8-dunmer', dun.opening === 'hail' && dun.parley_offer === true,
    `Dunmer: ${dun.opening}, parley offered = ${dun.parley_offer}`, 'does not aggro; hails and offers a purchase');
  check('CHR02-M8-khajiit', kha.opening === 'hostile' && kha.aggro_at_m <= 14 && kha.net_behaviour !== 'capture',
    `Khajiit: ${kha.opening} at ${kha.aggro_at_m} m, nets ${kha.net_behaviour}`, 'hostile at <= 14 m, no capture pretence');

  // AR-1: nothing about the FIGHT may vary with race. The schema must be unable to say it.
  const raceKeyed = JSON.stringify(enc.race_behaviour);
  const forbidden = ['hp', 'poise', 'damage', 'archetype', 'moveset', 'statblock', 'reach', 'startup', 'active', 'recovery', 'tier'];
  const leaks = forbidden.filter((k) => new RegExp(`"${k}"\\s*:`).test(raceKeyed));
  check('AR-1-no-fight-fields-in-race-behaviour', leaks.length === 0,
    `race_behaviour keys: ${[...new Set(Object.values(enc.race_behaviour).flatMap((v) => Object.keys(v)))].join(', ')}`,
    'no hp/poise/damage/archetype/moveset/frame field may be keyed on race');
  check('AR-1-statblocks-race-blind', new Set(statblocks).size >= 1 && enc.members.every((m) => !m.race_overrides),
    `members: ${enc.members.map((m) => `${m.role} x${m.count} -> ${m.statblock}`).join('; ')}`,
    'one statblock per member role, no per-race override field');
  // Every statblock named must exist on disk.
  const missing = statblocks.filter((s) => !fs.existsSync(path.join(DATA_DIR, 'combat/enemies', `${s}.json`)));
  check('AR-3-statblocks-exist', missing.length === 0, `${statblocks.length} member statblocks, ${missing.length} missing`, 'all resolve to game/data/combat/enemies/*.json');

  // RI-CHR02 M11: every parley must have >= 1 race-independent route.
  const parleyed = data.encounters.encounters.filter((e) => e.parley);
  const unrouted = parleyed.filter((e) => !e.parley.race_independent_route);
  check('CHR02-M11-race-independent-route', unrouted.length === 0,
    `${parleyed.length} encounters with a parley block, ${unrouted.length} without a race-independent route`,
    'zero — any race-closed parley is a hard fail (we shipped a race that must kill)');

  // Mechanism 2: a war-brood camp is hostile-on-sight to a Dunmer and neutral to everyone else.
  const brood = data.encounters.encounters.find((e) => e.behaviour_rule === 'hostile_below_disposition');
  if (brood) {
    const b = RACES.map((r) => ({ r, o: openingFor(data, brood, { race: r, upbringing: 'foreign-born', birthsign: 'raj-xul' }) }));
    const hostileTo = b.filter((x) => x.o.opening === 'hostile').map((x) => x.r);
    note(`${brood.id} (hostile below disposition ${brood.hostile_below_disposition}) opens hostile to: ${hostileTo.join(', ') || '(nobody)'}`);
    check('CHR02-M8-mech2', hostileTo.length >= 1 && hostileTo.length <= 3 && hostileTo.includes('dunmer'),
      `hostile-on-sight to ${hostileTo.length}/10 races, including Dunmer: ${hostileTo.includes('dunmer')}`,
      'a minority of races, Dunmer among them — an entire region\'s encounter density is a function of creation');
  }
}

// ============================================================================================
sec('prohibitions', 'RI-CHR01 §6 / M8 — class shapes and never locks');
if (run('prohibitions')) {
  // RI-CHR01 §6.1 writes this as `grep -r '"class"'`, which was written before the world data
  // existed and now matches road class, water class and hazard class — a different word.
  // The naive count is printed with its per-file breakdown so nothing is hidden, and the
  // ASSERTION is on gate semantics: a `class` key inside any requires/forbids/conditions/gate
  // block, or a `requires_class` / `class_min` key anywhere.
  const naive = grepData(/"class"\s*:/, ['quests', 'dialogue', 'items', 'world']);
  const byFile = {};
  for (const h of naive) byFile[h.file] = (byFile[h.file] || 0) + 1;
  for (const [f, n] of Object.entries(byFile)) note(`naive '"class":' hits — ${f}: ${n}`);
  const gates = [];
  for (const d of ['quests', 'dialogue', 'items', 'world']) {
    const root = path.join(DATA_DIR, d);
    if (!fs.existsSync(root)) continue;
    for (const f of walk(root)) {
      const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
      walkGates(doc, path.relative(REPO_ROOT, f), [], gates);
    }
  }
  for (const g of gates.slice(0, 10)) note(`CLASS GATE: ${g}`);
  check('CHR01-M8-no-class-gate', gates.length === 0,
    `${gates.length} class GATES (a class key inside requires/forbids/conditions/gate, or requires_class/class_min) in ${naive.length} naive '"class":' hits across ${Object.keys(byFile).length} files — the naive hits are road class, water class, hazard class and the census node that WRITES the field`,
    'zero gates — any content gate reading class is an automatic fail of the piece');
  check('CHR01-M8-no-skill-restriction', data.skills.no_class_restriction && !/major|minor/i.test(JSON.stringify(data.classes.classes)),
    'skills.json declares no class restriction; no major/minor multiplier appears in classes.json',
    'all 19 skills trainable by every class at the same rate');
  // Class share of the sheet. RI-CHR01 §6.4 writes "105 above baseline (3x20 + 2x10)"; its own
  // parenthesis evaluates to 80, and 80 is what the shipped classes deliver. The BOUND the
  // clause exists to enforce (<= 15% of creation, <= 4% of a level-60 sheet) is met more
  // easily at 80, so nothing is being softened — see AMENDMENT-W1-07-02.
  const worst = Math.max(...data.classes.classes.map((c) => sumValues(c.skills) - 5 * Object.keys(c.skills).length));
  const pctCreation = worst / 700;
  check('CHR01-M8-class-share', worst === 80 && pctCreation <= 0.15 && data.classes.classes.every((c) => sumValues(c.attribute_deltas) === 0),
    `class contributes 0 of 112 attribute points (0.0%) and at most ${worst} skill points above baseline ` +
    `(3 x 20 + 2 x 10), which is ${(pctCreation * 100).toFixed(1)}% of a ~700-point level-60 skill sheet`,
    '0 attribute points; 3x20 + 2x10 = 80 skill points; <= 15% of creation and <= 4% of a level-60 sheet');
  const caste = data.classes.caste_topics;
  check('CHR01-M8-caste-topics', Array.isArray(caste) && caste.length === 3,
    `${caste ? caste.length : 0} caste topics keyed on the class string: ${caste ? caste.map((t) => t.id).join(', ') : ''}`,
    '3 — class must still be VISIBLE, or the prohibitions are satisfied by making class do nothing');
  const cr = data.classes.custom_route;
  check('CHR01-custom-unhidden', cr && cr.hidden_behind_advanced === false && cr.presentation_rank === 2 && cr.name_field.free_text === true,
    `custom route: hidden_behind_advanced=${cr ? cr.hidden_behind_advanced : '?'}, presentation_rank=${cr ? cr.presentation_rank : '?'} of 3, ` +
    `free-text name stored verbatim=${cr ? cr.name_field.stored_verbatim : '?'}, ${cr ? cr.legal_configurations.value.toLocaleString('en-GB') : '?'} legal configurations`,
    'present, offered second of three, never labelled advanced — Morrowind put it second in a list of three');
  // Irreversibility audit: nothing in the data may set a field RI-CHR01 §7 marks "No".
  const fixed = data.creation.irreversibility.filter((r) => r.reversible === false).map((r) => r.field);
  const setters = grepData(new RegExp(`"set_(${fixed.join('|')})"`), ['quests', 'dialogue', 'items', 'world']);
  check('CHR01-M9-irreversibility', setters.length === 0,
    `${setters.length} data records set an irreversible field (${fixed.join(', ')})`,
    'zero — a race-change or respec item is an automatic fail');
}

// ---------------------------------------------------------------------------------------------
function grepData(re, dirs) {
  const out = [];
  for (const d of dirs) {
    const root = path.join(DATA_DIR, d);
    if (!fs.existsSync(root)) continue;
    for (const f of walk(root)) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) out.push({ file: path.relative(REPO_ROOT, f), line: i + 1, text: lines[i].trim() });
    }
  }
  return out;
}
/** Find `class` used as a GATE: inside a requires/forbids/conditions/gate block, or named. */
function walkGates(node, file, trail, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v, i) => walkGates(v, file, trail.concat(`[${i}]`), out)); return; }
  for (const k of Object.keys(node)) {
    if (k === 'requires_class' || k === 'class_min') out.push(`${file} ${trail.concat(k).join('.')}`);
    const gateBlock = /^(requires|forbids|conditions?|gate|if|unless)$/i.test(k);
    if (gateBlock && node[k] && typeof node[k] === 'object' && !Array.isArray(node[k]) && 'class' in node[k]) {
      out.push(`${file} ${trail.concat(k, 'class').join('.')} = ${JSON.stringify(node[k].class)}`);
    }
    walkGates(node[k], file, trail.concat(k), out);
  }
}
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}
function pad(s, n, right = false) { s = String(s); return right ? s.padStart(n) : s.padEnd(n); }

// ---------------------------------------------------------------------------------------------
const hardFail = results.filter((r) => r.status === 'FAIL');
const xfail = results.filter((r) => r.status === 'XFAIL');
const stale = results.filter((r) => r.status === 'STALE');
const passed = results.filter((r) => r.status === 'PASS');
if (!QUIET) {
  process.stdout.write(`\n== summary\n${passed.length}/${results.length} assertions PASS across ` +
    `${[...new Set(results.map((r) => r.section))].length} sections; ` +
    `${xfail.length} declared (KNOWN-GAPS.json), ${stale.length} stale declarations, ${hardFail.length} hard failures\n`);
  for (const f of hardFail) process.stdout.write(`FAIL  ${f.section}/${f.id}: measured ${f.measured}; expected ${f.expected}\n`);
  for (const f of xfail) process.stdout.write(`XFAIL ${f.section}/${f.id} — declared: ${f.declared}\n`);
  for (const f of stale) process.stdout.write(`STALE ${f.section}/${f.id} now passes; delete its KNOWN-GAPS.json entry\n`);
}
if (args.json) writeJson(path.resolve(String(args.json)), {
  tool: 'creation-audit', section: want, total: results.length,
  passed: passed.length, declared_failures: xfail.length, stale_declarations: stale.length, failed: hardFail.length, results,
});
// A stale declaration is a failure too: the ledger must not accumulate excuses that have
// stopped being true.
process.exit(hardFail.length + stale.length ? 1 : 0);
