// WHAT DOES EVERY PERSON IN THE PROVINCE SAY, TO EVERY KIND OF PLAYER, ON EVERY SUBJECT?
//
//   node tools/dialogue/answer-census.mjs --out reports/w1-17/answers-before.json
//   node tools/dialogue/answer-census.mjs --diff reports/w1-17/answers-before.json
//
// This is not a new implementation of dialogue. It imports and calls the SHIPPING reader —
// `game/src/character/converse.js buildTopicIndex()` and `infoFor()`, the exact two functions
// `Engine.conversationSay()` calls — over the SHIPPING data in `game/data/dialogue/topics/**`
// and `game/data/npcs/**`. Rule 10: the code being changed has to be the code that runs.
//
// It exists for two jobs.
//
//   1. THE INERT-FIX GUARD (RULES §6). `tools/dialogue/order-infos.mjs` reorders authored INFOs.
//      Reordering data that a scoring reader resolves is supposed to change nothing anyone can
//      hear. "Supposed to" is not a measurement, so the census is taken before and after and
//      every changed answer is printed with both texts. A silent reorder that quietly swapped
//      two ties would show up here as a diff and nowhere else.
//
//   2. THE CONSUMPTION EVIDENCE (RI-MTH07 / ARBITRATION §3). `--perturb <field>` edits ONE
//      authored field in memory and re-runs, so the report says which field, whose mouth, and
//      what the difference in the words was. A field that no reader reads produces zero changed
//      answers and the tool says so and exits non-zero, which is the whole point: this project
//      has shipped eighteen models nothing read, and each of them would have failed here.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';
import { raceTerm } from '../../game/src/character/reaction.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };

export function loadTopicDocs() {
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

export function loadNpcs() {
  const dir = path.join(ROOT, 'game/data/npcs');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const arr = Array.isArray(d) ? d : (d.npcs || d.records || []);
    for (const n of arr) if (n && n.id) out.push({ ...n, _file: f });
  }
  return out;
}

// THE PLAYER FIXTURE — REBUILT IN W1-17 ROUND 2, BECAUSE THE OLD ONE COULD NOT BE CONSTRUCTED.
//
// The four players this file used to declare had upbringings `marsh` / `town` / `legion` /
// `coast`. The canonical roster is `game/data/progression/race-reactions.json#upbringings` =
// `interior` / `lukiul` / `foreign-born` / `blackrose`, and the shipped
// `game/src/character/reaction.js raceTerm()` THROWS on all four census values:
//
//     THROW marsh  -> unknown upbringing: "marsh"        OK interior     {race:6, upbringing:-4}
//     THROW town   -> unknown upbringing: "town"         OK lukiul       {race:6, upbringing:6}
//     THROW legion -> unknown upbringing: "legion"       OK foreign-born {race:6, upbringing:0}
//     THROW coast  -> unknown upbringing: "coast"        OK blackrose    {race:6, upbringing:-2}
//
// `infoAllowed()` never calls `raceTerm()`, so the census did not crash — it just compared the
// string `"marsh"` against gates written in the roster's vocabulary and never matched. Three
// consequences, all of which silently weakened every instrument that imports this array
// (`shadow-audit.mjs`, `consume.mjs`, `critic-reach.mjs`):
//
//   1. the 3 `requires.upbringing` infos (gated on `interior` and `foreign-born`, both LEGAL)
//      could never fire in any tool;
//   2. six of the ten authored races were never tested at all;
//   3. no census player had disposition above 70, so the seven `d: 80` infos — the most gated
//      writing in the corpus — were invisible to the instruments certifying it.
//
// The fixture is now TEN players: one per authored race, upbringings cycled across all four
// legal values, dispositions spanning 0..100 and hitting every authored `d` band boundary
// including 80 and 100, and knowledge sets spanning empty / single-flag / full. Every value in
// it is one the game can actually construct — asserted below, against the shipped `raceTerm()`.
export const PLAYERS = [
  { id: 'saxhleel-interior-d0', race: 'saxhleel', upbringing: 'interior', disposition: 0, knows: new Set() },
  { id: 'naga-blackrose-d20', race: 'naga', upbringing: 'blackrose', disposition: 20, knows: new Set() },
  { id: 'dunmer-foreign-born-d40', race: 'dunmer', upbringing: 'foreign-born', disposition: 40, knows: new Set() },
  { id: 'imperial-lukiul-d55', race: 'imperial', upbringing: 'lukiul', disposition: 55, knows: new Set() },
  { id: 'nord-foreign-born-d70', race: 'nord', upbringing: 'foreign-born', disposition: 70, knows: new Set() },
  { id: 'breton-interior-d80', race: 'breton', upbringing: 'interior', disposition: 80, knows: new Set(['player_heard_the_eleven_keepers']) },
  { id: 'redguard-blackrose-d100', race: 'redguard', upbringing: 'blackrose', disposition: 100, knows: ALL_KNOWS() },
  { id: 'khajiit-lukiul-d30', race: 'khajiit', upbringing: 'lukiul', disposition: 30, knows: new Set() },
  { id: 'orsimer-interior-d10', race: 'orsimer', upbringing: 'interior', disposition: 10, knows: new Set() },
  { id: 'bosmer-blackrose-d60', race: 'bosmer', upbringing: 'blackrose', disposition: 60, knows: new Set(['approach_through_the_third_bay']) },
];

// The knowledge flags the corpus actually gates on, read out of the corpus rather than listed by
// hand, so a new `requires.knows` cannot silently escape the fixture.
function ALL_KNOWS() {
  const out = new Set();
  for (const doc of loadTopicDocs()) for (const t of (doc.topics || [])) for (const i of (t.infos || [])) {
    for (const g of [i.requires, i.forbids]) {
      if (!g) continue;
      for (const k of [...(g.knows || []), ...(g.knows_all || [])]) out.add(k);
    }
  }
  return out;
}

/**
 * RULES §4 in the fixture itself: every player above must be a character the game can build.
 * Throws loudly if anyone reintroduces an upbringing or race the shipped roster does not carry —
 * which is the exact defect this fixture shipped with for three rounds.
 */
export function assertPlayersAreConstructible() {
  const data = { reactions: JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8')) };
  const bad = [];
  for (const p of PLAYERS) {
    try { raceTerm(data, 'RG-TOWN', p.race, p.upbringing); }
    catch (e) { bad.push(`${p.id}: ${e.message}`); }
    if (!(p.disposition >= 0 && p.disposition <= 100)) bad.push(`${p.id}: disposition out of range`);
  }
  if (bad.length) throw new Error(`answer-census PLAYERS are not constructible characters:\n  ${bad.join('\n  ')}`);
  return PLAYERS.length;
}

export function census(topicDocs, npcs) {
  const idx = buildTopicIndex(topicDocs);
  const ids = [];
  for (const doc of topicDocs) for (const t of doc.topics || []) if (t && typeof t.id === 'string') ids.push(t.id);
  const topicIds = [...new Set(ids)].sort();
  const rows = {};
  let answered = 0;
  for (const npc of npcs) {
    for (const p of PLAYERS) {
      for (const tid of topicIds) {
        const r = infoFor(idx, tid, npc, p);
        if (!r || !r.text) continue;
        answered++;
        rows[`${npc.id}|${p.id}|${tid}`] = r.text;
      }
    }
  }
  return { pairs: npcs.length * PLAYERS.length * topicIds.length, answered, topics: topicIds.length, npcs: npcs.length, rows };
}

function main() {
  const docs = loadTopicDocs();
  const npcs = loadNpcs();
  const c = census(docs, npcs);
  const prior = arg('diff', null);
  if (prior) {
    const before = JSON.parse(fs.readFileSync(path.resolve(ROOT, String(prior)), 'utf8'));
    const keys = new Set([...Object.keys(before.rows), ...Object.keys(c.rows)]);
    const changed = [];
    for (const k of keys) if (before.rows[k] !== c.rows[k]) changed.push({ k, before: before.rows[k] ?? null, after: c.rows[k] ?? null });
    console.log(`census: ${c.answered} answers over ${c.npcs} speakers x ${PLAYERS.length} players x ${c.topics} topics`);
    console.log(`answers that changed: ${changed.length}`);
    for (const ch of changed.slice(0, 40)) {
      console.log(`\n  ${ch.k}`);
      console.log(`    before: ${String(ch.before).slice(0, 140)}`);
      console.log(`    after:  ${String(ch.after).slice(0, 140)}`);
    }
    if (changed.length > 40) console.log(`\n  ... and ${changed.length - 40} more`);
    process.exit(changed.length ? 1 : 0);
  }
  const out = arg('out', null);
  if (out) {
    const p = path.resolve(ROOT, String(out));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(c, null, 0) + '\n');
  }
  console.log(`census: ${c.answered} answers over ${c.npcs} speakers x ${PLAYERS.length} players x ${c.topics} topics${out ? ` -> ${out}` : ''}`);
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) main();
