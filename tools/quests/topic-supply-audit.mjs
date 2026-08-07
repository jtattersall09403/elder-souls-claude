#!/usr/bin/env node
// topic-supply-audit.mjs — can a player be OFFERED each quest by playing?
//
// This tool exists because of the single most expensive defect in this project's history:
// **74 of the 76 `opens_by.topic` values in this tree were unsatisfiable**, and it was invisible
// because every quest tool seeded the gate with the quest's own string. `core/topics.js` fixed
// the SPELLING half (slug versus prose) and `sim/quest/topic-supply.js` fixed the SUPPLY half for
// the main quest. Nothing checks the whole tree, so the defect has been quietly recurring in
// every quest written since.
//
// Three separate questions, each of which has produced a shipped defect on its own:
//
//   A. DOES THE KEYWORD EXIST AT ALL?  Every `opens_by.topic` and `opens_by.prerequisite_topics`
//      value must be a topic id somewhere in game/data/dialogue/topics/**, folded through
//      `topicKey()`. A topic nobody in the province can say is a quest nobody can be offered.
//   B. DOES ANYBODY ACTUALLY SAY IT?  A topic record with an empty `infos` array is a keyword
//      with no words under it. That is the 47-topic defect one layer down.
//   C. DOES THE SUPPLY GRAPH POINT FORWARD?  A `hooks.json` `entry_topics` row whose
//      `adds_topics` contains the topic of the quest that fired it is a SELF-LOOP: the quest
//      teaches you the words you needed in order to be offered it. 23 of 32 main quests shipped
//      that way and 0 of 32 were offerable from a cold start.
//
// A quest with no `entry_topics` row at all is fine when nothing follows it — a rank-7 terminal
// quest teaches nobody anything — so that is reported separately and is not a failure.
//
// Run: node tools/quests/topic-supply-audit.mjs [--strict] [--out report.json]
//   default : reports everything, exits 0 unless a topic named by a quest does not exist
//   --strict : also fails on empty topic bodies and self-loops (the wave-2 posture)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topicKey } from '../../game/src/core/topics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'game/data');
const strict = process.argv.includes('--strict');
const outIx = process.argv.indexOf('--out');
const outPath = outIx >= 0 ? process.argv[outIx + 1] : null;

// ---- what the province can say ---------------------------------------------------------------
const bodies = new Map(); // folded key -> { id, infos }
for (const f of fs.readdirSync(path.join(DATA, 'dialogue/topics')).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(DATA, 'dialogue/topics', f), 'utf8'));
  for (const t of doc.topics || []) {
    if (!t || typeof t.id !== 'string') continue;   // topics/thorn.json is a different schema
    const k = topicKey(t.id);
    const cur = bodies.get(k) || { id: t.id, infos: 0, files: [] };
    cur.infos += (t.infos || []).length;
    cur.files.push(f);
    bodies.set(k, cur);
  }
}

// ---- what the quests demand -------------------------------------------------------------------
const quests = [];
for (const f of fs.readdirSync(path.join(DATA, 'quests')).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json' || f === 'faction-gates.json' || f === 'closure-registry.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(DATA, 'quests', f), 'utf8'));
  for (const q of (Array.isArray(doc.quests) ? doc.quests : (doc.id && doc.journal ? [doc] : []))) quests.push({ q, file: f });
}

const demanded = new Map(); // folded key -> [quest ids]
const ownTopic = new Map(); // quest id -> folded key of its own opens_by.topic
for (const { q } of quests) {
  const ob = q.opens_by || {};
  if (ob.topic) ownTopic.set(q.id, topicKey(ob.topic));
  for (const t of [ob.topic, ...(ob.prerequisite_topics || [])]) {
    if (!t) continue;
    const k = topicKey(t);
    demanded.set(k, [...(demanded.get(k) || []), q.id]);
  }
}

// ---- A / B ------------------------------------------------------------------------------------
const missing = [];
const silent = [];
for (const [k, qs] of [...demanded.entries()].sort()) {
  const b = bodies.get(k);
  if (!b) { missing.push({ topic: k, wanted_by: [...new Set(qs)] }); continue; }
  if (b.infos === 0) silent.push({ topic: b.id, wanted_by: [...new Set(qs)] });
}

// ---- C ----------------------------------------------------------------------------------------
const hooks = JSON.parse(fs.readFileSync(path.join(DATA, 'quests/hooks.json'), 'utf8'));
const rows = hooks.entry_topics || [];
const selfLoops = [];
const forwardTo = new Map(); // folded topic key -> quests that grant it
for (const r of rows) {
  for (const t of r.adds_topics || []) {
    const k = topicKey(t);
    forwardTo.set(k, [...(forwardTo.get(k) || []), r.quest]);
    if (ownTopic.get(r.quest) === k) selfLoops.push({ quest: r.quest, topic: t });
  }
}

// A quest is COLD-REACHABLE when its topic is granted by some OTHER quest, or is spoken by the
// world without any quest — i.e. it has a body and somebody `overheard_from` names it.
const unsupplied = [];
for (const { q } of quests) {
  const k = ownTopic.get(q.id);
  if (!k) continue;
  const granters = (forwardTo.get(k) || []).filter((x) => x !== q.id);
  const overheard = ((q.opens_by || {}).overheard_from || []).length;
  const hasBody = bodies.has(k) && bodies.get(k).infos > 0;
  if (!granters.length && !overheard && !hasBody) unsupplied.push({ quest: q.id, topic: k });
}

const terminal = quests.filter(({ q }) => ownTopic.has(q.id) && !rows.some((r) => r.quest === q.id)).map(({ q }) => q.id);

const report = {
  tool: 'topic-supply-audit',
  quests: quests.length,
  distinct_topics_demanded: demanded.size,
  topics_with_a_body: demanded.size - missing.length,
  A_missing_bodies: missing,
  B_silent_topics: silent,
  C_self_loops: selfLoops,
  D_unsupplied_quests: unsupplied,
  terminal_quests_no_forward_row: terminal,
};

const say = (s) => process.stdout.write(s + '\n');
say(`quests: ${report.quests}   distinct topics demanded: ${report.distinct_topics_demanded}   with a body: ${report.topics_with_a_body}`);
say(`\nA. topics a quest demands that EXIST NOWHERE in dialogue/topics/**: ${missing.length}`);
for (const m of missing) say(`     ${m.topic}  <- ${m.wanted_by.join(', ')}`);
say(`\nB. topics that exist with ZERO infos (a keyword with no words): ${silent.length}`);
for (const s of silent) say(`     ${s.topic}  <- ${s.wanted_by.join(', ')}`);
say(`\nC. hooks.json entry_topics SELF-LOOPS (quest teaches the topic that opens itself): ${selfLoops.length}`);
if (selfLoops.length) say(`     ${selfLoops.map((s) => s.quest).join(' ')}`);
say(`\nD. quests whose topic is granted by nothing and spoken by nobody: ${unsupplied.length}`);
for (const u of unsupplied) say(`     ${u.quest}  needs "${u.topic}"`);
say(`\n(terminal quests with no forward row, which is correct: ${terminal.length})`);

if (outPath) fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

const hard = missing.length + unsupplied.length;
const soft = silent.length + selfLoops.length;
if (hard) { say(`\nFAIL — ${hard} quest topic(s) cannot be reached by anything in the world.`); process.exit(1); }
if (strict && soft) { say(`\nFAIL (--strict) — ${soft} soft defect(s).`); process.exit(1); }
say(`\nPASS — every quest topic exists and is reachable. ${soft} soft defect(s) reported above.`);
