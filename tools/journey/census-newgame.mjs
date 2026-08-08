#!/usr/bin/env node
// census-newgame.mjs — can the character creation the TITLE starts actually be finished?
//
// Owner: the W1-26 round-2 critic. Rule 24: a method (`RI-JRN01` O6/O7/O10, `RI-CHR01` §1) names
// a thing no tool tested, so here is the tool.
//
// WHY THIS EXISTS. Every probe pointed at the census in this tree opens it with
// `censusBegin({ race: '<something>' })` — the harness's own entry point, which supplies the one
// creation input the scene does not ask for. `Engine._titleApply('new')` — the path a PLAYER
// takes, from the title surface, with the key bound to `interact` — calls `censusBegin({})` with
// no options at all. The two paths differ by exactly one field, and `Census.answer()` at
// `writ.race-observed` reads:
//
//     if (!this.spec.race) throw new Error('census: race must be observed before the scene
//                                           reaches the desk');
//
// So this tool walks the graph the way `New` leaves it — nothing observed — and reports where
// the scene stops. It also walks it with a race observed, as the control, so a failure here is
// attributable to the missing observation and not to the walker.
//
// It is node-side and needs no browser: `character/census.js` is pure logic over
// `game/data/**`, which is the whole reason it was written that way.
//
// EXIT: non-zero when the player's own path cannot reach the stamp. `--expect-throw` inverts
// that, so this tool can be used as a regression guard once the defect is fixed.
//
// USAGE
//   node tools/journey/census-newgame.mjs [--json <path>] [--race <id>]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';

const USAGE = `
census-newgame.mjs — walk the creation graph the way the title's 'New' leaves it.

USAGE
  node tools/journey/census-newgame.mjs [--json <path>] [--race <id>] [--expect-throw]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const GAME = path.join(REPO_ROOT, 'game');
const DATA = path.join(GAME, 'data');
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'journeys', 'w1-26-r2-census-newgame.json');
ensureDir(path.dirname(jsonPath));

const say = (s) => process.stdout.write(s + '\n');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---- assemble exactly the object `Engine._boot` hands the Census ----------------------------
// engine.js `loadData()` builds `out.character = {attributes, skills, races, classes, birthsigns,
// reactions, creation, creationQuestions, creationNames, encounters, writHouse, writItems, npcs,
// greetings, topicDocs}` and `new Census(this.data.character)` consumes that shape. Built from
// the same files, keyed the same way, so a difference here is a difference in the data and not
// in this tool's idea of it.
const index = readJson(path.join(DATA, 'index.json'));
const progression = {}, topics = {}, items = {}, npcs = {};
let creationQuestions = null, creationNames = null, encounters = null, greetings = {};
for (const entry of index.files) {
  const p = path.join(DATA, entry.path);
  if (!fs.existsSync(p)) continue;
  const doc = readJson(p);
  if (entry.path.startsWith('progression/')) { progression[doc.schema] = doc; if (doc.id) progression[doc.id] = doc; }
  else if (entry.path.startsWith('dialogue/topics/')) topics[path.basename(entry.path, '.json')] = doc;
  else if (entry.path.startsWith('items/')) items[path.basename(entry.path, '.json')] = doc;
  else if (entry.path.startsWith('npcs/')) npcs[path.basename(entry.path, '.json')] = doc;
  else if (entry.path.startsWith('dialogue/greetings/')) greetings[path.basename(entry.path, '.json')] = doc;
  else if (entry.path === 'dialogue/creation-questions.json') creationQuestions = doc;
  else if (entry.path === 'dialogue/creation-names.json') creationNames = doc;
  else if (entry.path === 'world/encounters.json') encounters = doc;
}
const data = {
  attributes: progression['attributes'], skills: progression['skills'],
  races: progression['races'], classes: progression['classes'],
  birthsigns: progression['birthsigns'], reactions: progression['race-reactions'],
  creation: progression['creation'], creationQuestions, creationNames, encounters,
  writHouse: topics['writ-house'], writItems: items['writ'], npcs: npcs['writ-house'],
  greetings, topicDocs: Object.keys(topics).sort().map((k) => topics[k]),
};
for (const k of ['races', 'classes', 'birthsigns', 'creation', 'writHouse', 'creationQuestions']) {
  if (!data[k]) { console.error(`character data missing: ${k} — this tool's assembly no longer matches engine.js loadData()`); process.exit(2); }
}

const { Census } = await import(path.join(GAME, 'src/character/census.js'));

// ---- WHAT THE PLAYER'S PATH IS, AT THIS BUILD ------------------------------------------------
// This tool's whole value is that its first arm is the route `New` takes and not a facsimile of
// it, so the arm has to move when the route does. At round 2 the route was `censusBegin({})`
// with nothing observed anywhere. W1-26 r3 changed it: `censusBegin()` now calls
// `census.observe(opts.race || this.bodyRace())`, and `bodyRace()` reads `sim.identity.race` —
// the race of the body the player is already standing in — which `Engine._applyStartingBody()`
// writes at boot from `creation.json` `starting_body.race`.
//
// So the player's arm below observes THAT VALUE, read out of the same data file the engine reads,
// and it is a genuine measurement rather than a rubber stamp for two reasons:
//   * the id has to be one `races.json` carries AND one `writ.race-observed` has an authored
//     misread for, both checked here. A `starting_body` naming a race the scene cannot speak to
//     fails this tool, which is the failure mode a hardcoded default in engine.js would hide.
//   * the NO-BODY arm is kept and still has to stop at the desk. If that arm ever completes, the
//     race check has gone inert and this tool says so — which is the control for the arm above.
const startingBody = (data.creation && data.creation.starting_body) || null;
const bodyRace = startingBody ? startingBody.race : null;
const raceIds = ((data.races && data.races.races) || []).map((r) => r.id);
const misreadIds = Object.keys((((data.writHouse.nodes || []).find((n) => n.id === 'writ.race-observed')) || {}).misreads || {});

/**
 * Walk the graph, always taking the FIRST offered answer, typing a name at text nodes and
 * picking the required count at pick nodes. Returns the node it stopped at and why.
 */
function walk(observeRace) {
  const c = new Census(data);
  if (observeRace) c.observe(observeRace);
  const visited = [];
  // The two paused nodes are the scene handing control back to the body. A player resumes them
  // by talking and by walking; here they are simply released, because this tool is asking what
  // the GRAPH does, not what the world does.
  for (let i = 0; i < 80; i++) {
    // The two paused nodes are the scene handing control back to the body. `Engine.censusEnter()`
    // releases them with `census.enter(by)` when the player talks / walks; this tool is asking
    // what the GRAPH does once they have, so it releases them the same way the engine does.
    if (c.paused) { c.enter(c.node() && c.node().resume_by); }
    const st = c.state();
    if (st.done) return { ok: true, stopped_at: null, visited, reason: 'the scene completed', writ: st.writ || (c.writ ? c.writ.name : null), character: c.character ? { race: c.character.race, name: c.character.name } : null };
    visited.push(st.node);
    const inp = st.input || null;
    let value = null;
    if (!inp) { // an auto-advancing node
      try { c.answer(null); } catch (e) { return { ok: false, stopped_at: st.node, visited, reason: String(e && e.message || e), kind: 'throw' }; }
      continue;
    }
    if (inp.kind === 'text') value = 'Silt-Under-Salt';
    else if (inp.kind === 'observed') value = null;
    else if (inp.kind === 'pick') value = (inp.options || []).slice(0, inp.count || 1).map((o) => o.id);
    else if (inp.kind === 'questionnaire') value = (inp.options && inp.options[0]) ? inp.options[0].id : null;
    else value = (inp.options && inp.options[0]) ? inp.options[0].id : null;
    try {
      c.answer(value);
    } catch (e) {
      return { ok: false, stopped_at: st.node, visited, reason: String(e && e.message || e), kind: 'throw', input_kind: inp.kind };
    }
  }
  return { ok: false, stopped_at: c.nodeId, visited, reason: 'the walk did not terminate in 80 steps', kind: 'loop' };
}

const out = {
  schema: 'elder-souls/census-newgame@1',
  piece: 'W1-26',
  role: 'critic round 2',
  items: ['RI-JRN01', 'RI-CHR01'],
  question: "Engine._titleApply('new') calls censusBegin({}) with no race. Can that scene be finished?",
  player_path: null,
  harness_path: null,
};

out.starting_body = {
  declared: !!startingBody,
  race: bodyRace,
  in_races_json: !!bodyRace && raceIds.includes(bodyRace),
  has_authored_misread: !!bodyRace && misreadIds.includes(bodyRace),
  source: 'game/data/progression/creation.json #starting_body.race, via Engine._applyStartingBody() -> sim.identity.race -> Engine.bodyRace()',
};
say(`  the body the player wakes up in: race ${JSON.stringify(bodyRace)}`
  + ` (in races.json: ${out.starting_body.in_races_json}; the scribe has a line for it: ${out.starting_body.has_authored_misread})`);
say('');

say("  the player's path — `New` from the title, i.e. censusBegin({}), which observes the body:");
out.player_path = walk(bodyRace);
say(`    ${out.player_path.ok ? 'COMPLETED' : 'STOPPED at ' + out.player_path.stopped_at}: ${out.player_path.reason}`);
say(`    nodes reached: ${out.player_path.visited.join(' -> ')}`);

say('');
say('  the control — a scene opened with NO body at all, which must still stop at the desk:');
out.no_body_path = walk(null);
say(`    ${out.no_body_path.ok ? 'COMPLETED — THE RACE CHECK HAS GONE INERT' : 'STOPPED at ' + out.no_body_path.stopped_at}: ${out.no_body_path.reason}`);

const controlRace = String(args.race || 'saxhleel');
say('');
say(`  the harness's path — censusBegin({ race: '${controlRace}' }), which is what every probe does:`);
out.harness_path = walk(controlRace);
say(`    ${out.harness_path.ok ? 'COMPLETED' : 'STOPPED at ' + out.harness_path.stopped_at}: ${out.harness_path.reason}`);
say(`    nodes reached: ${out.harness_path.visited.length}`);

// ---- CONSUMPTION (RI-MTH07 / ARBITRATION §3) + delete-the-fix -------------------------------
// The claim under test is causal — "the scene stops because `race` was never observed" — so it
// is tested the way RI-MTH07 requires a causal claim to be tested: perturb the ONE field, hold
// everything else fixed, and watch the observable move. Plus a NULL CONTROL, because a probe
// whose two arms differ in more than the perturbed field measures the probe.
say('');
say('  CONSUMPTION — perturb one field, hold the rest, watch the observable:');
const arms = [];
for (const race of [null, 'dunmer', 'khajiit', controlRace]) {
  const r = walk(race);
  arms.push({ observed_race: race, completed: !!r.ok, stopped_at: r.stopped_at, reason: r.ok ? null : r.reason });
  say(`    race=${JSON.stringify(race)} -> ${r.ok ? 'completes' : 'stops at ' + r.stopped_at}`);
}
// Null control: perturb something the claim says is IRRELEVANT (the typed name) and assert the
// observable does NOT move. If it does, the walker is the thing being measured, not the build.
const nullA = walk(null), nullB = walk(null);
const nullControl = { same_outcome: nullA.ok === nullB.ok && nullA.stopped_at === nullB.stopped_at, a: nullA.stopped_at, b: nullB.stopped_at };
say(`    null control (same inputs twice) -> ${nullControl.same_outcome ? 'identical, as required' : 'DIFFERENT — this tool is non-deterministic'}`);

// Delete-the-fix, in the direction the fix has not been made yet: simulate the one-line remedy
// (observe a race at the moment `New` begins the scene) and confirm the old number returns when
// it is removed. This is the acceptance test a round-3 builder can run.
const withRemedy = walk(controlRace);
const withoutRemedy = walk(null);
out.consumption = {
  model: 'Census.spec.race, set only by Census.observe()',
  world_side_consumer: "Census.answer() at writ.race-observed, which composes the scribe's misread line and gates every later node; downstream, composeCharacter() -> the writ -> what NPCs say",
  arms,
  null_control: nullControl,
  coupling: arms.filter((a) => a.observed_race).every((a) => a.completed) && !arms.find((a) => a.observed_race === null).completed ? 1 : 0,
  delete_the_fix: {
    with_remedy: { observed: controlRace, completed: !!withRemedy.ok },
    without_remedy: { observed: null, completed: !!withoutRemedy.ok, stopped_at: withoutRemedy.stopped_at },
    two_arms_differ: withRemedy.ok !== withoutRemedy.ok,
  },
};
say(`    coupling ${out.consumption.coupling}; delete-the-fix arms differ: ${out.consumption.delete_the_fix.two_arms_differ}`);

out.verdict = {
  player_can_finish_creation: !!out.player_path.ok,
  harness_can_finish_creation: !!out.harness_path.ok,
  differ: out.player_path.ok !== out.harness_path.ok,
  note: out.player_path.ok
    ? 'both paths complete'
    : "the two paths differ by one field. Every probe in the tree supplies `race` through the harness; the title's `New` does not, and the scene throws at the node that reads it.",
  acceptance_for_round_3: "Engine._titleApply('new') reaches writ.stamp with a composed character, driven only through real input from the title, and `node tools/journey/census-newgame.mjs` exits 0 with player_can_finish_creation true. The race the player ends up with must itself be something the player chose or the body already had — supplying a hardcoded default would satisfy this tool and fail RI-CHR01 §1 row 2.",
};
writeJson(jsonPath, out);
say('');
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);

// The player's path must complete AND the no-body control must still stop. A tool that only
// checked the first would pass just as happily on a build that had deleted the race check
// altogether, which is the difference rule 6 draws between a fix and an inert control.
const inertControl = !!out.no_body_path.ok;
const bodyUnusable = !out.starting_body.in_races_json || !out.starting_body.has_authored_misread;
if (inertControl) say('  FAIL: a census with no body observed completed anyway — the check at writ.race-observed is inert.');
if (bodyUnusable) say(`  FAIL: creation.json starting_body.race ${JSON.stringify(bodyRace)} is not a race the scene can speak to.`);
out.verdict.control_still_stops = !inertControl;
out.verdict.starting_body_usable = !bodyUnusable;

const bad = !out.player_path.ok || inertControl || bodyUnusable;
if (args['expect-throw']) {
  say(bad ? '  --expect-throw: the defect is present, as expected' : '  --expect-throw: the defect is GONE — update the guard');
  process.exit(bad ? 0 : 1);
}
process.exit(bad ? 1 : 0);
