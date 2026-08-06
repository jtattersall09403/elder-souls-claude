#!/usr/bin/env node
// gen-quest-hooks.mjs — emit game/data/quests/hooks.json, the systems layer RI-QST04 requires.
//
// RI-QST04 "How we lose" is explicit that quest CONTENT lives in the schema and quest
// BEHAVIOUR lives in "a separate systems layer keyed by world_flags". `QuestEngine` has
// consumed that layer since it was written and the file has never existed, which is why
// `game/src/sim/quest/machine.js` — 428 lines of complete, tested state machine — was never
// instantiated, and why the W1-14 verdict recorded AR-2 B7 as `not_run`: "no quest in this
// build can be started, advanced or completed by playing".
//
// Two tables are generated rather than authored, because both are derivable and an authored
// copy of a derivable thing drifts:
//
//   `entry_topics` — RI-DLG05 §A.3 requires every quest chain to seed at least one dialogue
//      topic from a journal write. The topic is the quest's own `opens_by.topic` where it has
//      one, and a slug of its title where it does not.
//
//   `hooks` — world flag -> journal write. The magic-utility quests are the ones this file
//      exists for: casting `open_lock` on the ledger door sets `lock:warded_ledger_door:open`
//      in `sim.world`, and this table is what turns that into a journal line. That is the
//      whole of RI-MAG04's "magic as a quest solution" made mechanical, and it is data.
//
// Run: node tools/analysis/gen-quest-hooks.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QDIR = path.join(ROOT, 'game/data/quests');
const check = process.argv.includes('--check');

const quests = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  const list = Array.isArray(doc.quests) ? doc.quests : (doc.id && doc.journal ? [doc] : []);
  for (const q of list) quests.push({ q, file: f });
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const entry_topics = [];
for (const { q } of quests) {
  const first = (q.journal || []).filter((e) => e.state === 'active' && e.index >= 10).map((e) => e.index).sort((a, b) => a - b)[0];
  if (first == null) throw new Error(`${q.id}: no active journal entry >= 10 (RI-QST04 §B)`);
  const topic = (q.opens_by && q.opens_by.topic) ? slug(q.opens_by.topic) : slug(q.title);
  entry_topics.push({ quest: q.id, index: first, adds_topics: [topic] });
}

// --- the world-flag table. Only the flags the simulation actually raises are listed, and each
// --- names the journal entry it writes, so a hook that points at nothing fails at boot.
const hooks = [];
const midIndexOf = (q) => (q.journal || []).filter((e) => e.state === 'active' && e.index > 10 && e.index < 70).map((e) => e.index).sort((a, b) => a - b)[0];

// The five wards in game/data/magic/wards.json, mapped to the magic quests they belong to.
// `lock:<id>:open` is raised by MagicSystem when `open_lock` actually opens that lock.
const WARD_TO_QUEST = {
  'lock:warded_ledger_door:open': 'Q-MAG-01',
  'lock:ledger_strongbox:open': 'Q-MAG-01',
  'shatter:cistern_wall_bricks': 'Q-MAG-02',
  'lock:cistern_grate:open': 'Q-MAG-02',
  'trap:ledger_threshold_ward:disarmed': 'Q-MAG-03',
  'lock:hall_side_door:open': 'Q-MAG-04',
  'lock:drowned_road_sluice:open': 'Q-MAG-05',
  'shatter:root_barrier': 'Q-MAG-06',
  'teleport:recall': 'Q-MAG-07',
  'fight_ended:calm_beast': 'Q-MAG-08',
  'fight_ended:demoralise': 'Q-MAG-09',
  'fight_ended:charm': 'Q-MAG-10',
};
for (const [flag, qid] of Object.entries(WARD_TO_QUEST)) {
  const rec = quests.find((x) => x.q.id === qid);
  if (!rec) continue;
  const ix = midIndexOf(rec.q);
  if (ix == null) continue;
  hooks.push({ flag, quest: qid, journal: ix, note: 'raised by the simulation when the spell moves the system; RI-MAG04 M6' });
}

const doc = {
  schema: 'elder-souls/quest-hooks@1',
  id: 'quest-hooks',
  corpus_item: 'RI-QST04 (behaviour hooks keyed by world_flags), RI-DLG05 §A.3 (every chain seeds a topic)',
  generated_by: 'tools/analysis/gen-quest-hooks.mjs',
  note: 'Generated. Do not hand-edit; edit the generator or the quest files it reads.',
  entry_topics,
  hooks,
  deadlines: [],
};

const out = path.join(QDIR, 'hooks.json');
const text = JSON.stringify(doc, null, 2) + '\n';
if (check) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== text) { console.error('hooks.json is stale — run node tools/analysis/gen-quest-hooks.mjs'); process.exit(20); }
  console.log(`[harness] hooks.json current — ${entry_topics.length} entry topics, ${hooks.length} flag hooks`);
} else {
  fs.writeFileSync(out, text);
  console.log(`[harness] wrote ${out} — ${entry_topics.length} entry topics, ${hooks.length} flag hooks over ${quests.length} quests`);
}
