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

say("  the player's path — `New` from the title, i.e. censusBegin({}), nothing observed:");
out.player_path = walk(null);
say(`    ${out.player_path.ok ? 'COMPLETED' : 'STOPPED at ' + out.player_path.stopped_at}: ${out.player_path.reason}`);
say(`    nodes reached: ${out.player_path.visited.join(' -> ')}`);

const controlRace = String(args.race || 'saxhleel');
say('');
say(`  the harness's path — censusBegin({ race: '${controlRace}' }), which is what every probe does:`);
out.harness_path = walk(controlRace);
say(`    ${out.harness_path.ok ? 'COMPLETED' : 'STOPPED at ' + out.harness_path.stopped_at}: ${out.harness_path.reason}`);
say(`    nodes reached: ${out.harness_path.visited.length}`);

out.verdict = {
  player_can_finish_creation: !!out.player_path.ok,
  harness_can_finish_creation: !!out.harness_path.ok,
  differ: out.player_path.ok !== out.harness_path.ok,
  note: out.player_path.ok
    ? 'both paths complete'
    : "the two paths differ by one field. Every probe in the tree supplies `race` through the harness; the title's `New` does not, and the scene throws at the node that reads it.",
};
writeJson(jsonPath, out);
say('');
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);

const bad = !out.player_path.ok;
if (args['expect-throw']) {
  say(bad ? '  --expect-throw: the defect is present, as expected' : '  --expect-throw: the defect is GONE — update the guard');
  process.exit(bad ? 0 : 1);
}
process.exit(bad ? 1 : 0);
