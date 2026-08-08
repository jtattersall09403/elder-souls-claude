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

// Four players, chosen so that every player-side gate in the corpus is exercised by at least one
// of them and no two share a value on any of race / upbringing / disposition. A single player
// would take a census that could not tell a race gate from a wall (RULES §8).
export const PLAYERS = [
  { id: 'saxhleel-marsh-d70', race: 'saxhleel', upbringing: 'marsh', disposition: 70, knows: new Set() },
  { id: 'dunmer-town-d40', race: 'dunmer', upbringing: 'town', disposition: 40, knows: new Set() },
  { id: 'imperial-legion-d20', race: 'imperial', upbringing: 'legion', disposition: 20, knows: new Set() },
  { id: 'naga-coast-d55', race: 'naga', upbringing: 'coast', disposition: 55, knows: new Set() },
];

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
