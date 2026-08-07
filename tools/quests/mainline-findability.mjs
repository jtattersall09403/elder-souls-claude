#!/usr/bin/env node
// mainline-findability.mjs — can a PLAYER reach the main quest, or only the harness?
//
// Written by the W1-19 round-1 critic; declared under `orchestration/TOOL-LOOP.md`. The method
// it implements is `RI-MTH07`'s hand-feed audit (Comparison method step 3): "for every harness
// method that accepts world facts as arguments, assert the same result is reachable WITHOUT
// supplying them". Every quest tool in this tree seeds the topic gate with the quest's own
// `opens_by.topic` string, so no existing tool can see this.
//
// Three questions, answered separately:
//   A. STATIC   — for each `category:"main"` quest, is its `opens_by.topic` producible by any
//                 world-side supplier (hooks.json AddTopic edges, quest consequences), and does
//                 it exist as an id in the dialogue topic corpus? Reported raw AND under the
//                 folding rule `game/src/core/topics.js` publishes.
//   B. LIVE     — boot the shipping build, learn NOTHING through the harness, fire every
//                 world-flag hook and journal AddTopic edge the machine can fire from a cold
//                 start, and count how many main quests become offerable.
//   C. RUMOURS  — `RI-JRN07` L1/M-Q4: for each main quest, how many rumour / greeting /
//                 dialogue lines anywhere in `game/data/dialogue/**` mention its key noun.
//
//   node tools/quests/mainline-findability.mjs [--out <dir>] [--state <named state>]
//
// W1-19 ROUND-2 EXTENSION, declared under `orchestration/TOOL-LOOP.md`, additive:
//   * `--state` (default `arena_flat`, unchanged) — part B booted into an EMPTY ARENA, where
//     there is nobody to overhear and nobody to ask, so it could only ever report 0 offerable.
//     Round 2 authored `game/data/states/soulrest-quay.json`, the first place in the tree a
//     player can stand in front of the Undersexton, and part B is worth running there.
//   * part B now also performs the two WORLD ACTIONS a player has — greet the people who are
//     present, ask them what they will discuss — and re-counts, so the report distinguishes
//     "no topics at a cold boot", which is correct and must stay true, from "no topics
//     obtainable", which was the defect.
//   * `overheard_from_code_consumers` was a hardcoded 0. It is grepped out of `game/src/**` now,
//     with comments stripped first so a field NAMED in a comment does not count as a reader.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('mainline-findability.mjs [--out <dir>]');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R1-FIND');
const STATE = args.state ? String(args.state) : 'arena_flat';
ensureDir(outDir);

const ROOT = process.cwd();
const walk = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else if (f.endsWith('.json')) out.push(p);
  }
  return out;
};

// The folding rule, transcribed from game/src/core/topics.js so this tool states which
// spelling rule it is applying rather than importing a file that may or may not be wired.
const fold = (s) => String(s).toLowerCase().replace(/[-_]+/g, ' ').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

const QDIR = path.join(ROOT, 'game/data/quests');
const quests = [];
for (const f of fs.readdirSync(QDIR)) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const d = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of d.quests || []) quests.push(q);
}
const main = quests.filter((q) => q.category === 'main');

// ---- A. static: who can supply a topic? -------------------------------------------------------
const hooks = JSON.parse(fs.readFileSync(path.join(QDIR, 'hooks.json'), 'utf8'));
const supplied = new Set();
for (const e of hooks.entry_topics || []) for (const t of e.adds_topics || []) supplied.add(t);
for (const h of hooks.hooks || []) for (const t of h.adds_topics || []) supplied.add(t);
const suppliedFolded = new Set([...supplied].map(fold));

const dialogueTopicIds = new Set();
for (const f of walk(path.join(ROOT, 'game/data/dialogue/topics'))) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const t of d.topics || []) if (t.id) dialogueTopicIds.add(t.id);
}
const dialogueFolded = new Set([...dialogueTopicIds].map(fold));

const dialogueProse = walk(path.join(ROOT, 'game/data/dialogue')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const staticRows = main.map((q) => {
  const t = (q.opens_by && q.opens_by.topic) || null;
  const key = q.title.replace(/^The /, '');
  return {
    quest: q.id, act: q.act, topic: t,
    supplied_raw: t ? supplied.has(t) : null,
    supplied_folded: t ? suppliedFolded.has(fold(t)) : null,
    is_dialogue_topic_raw: t ? dialogueTopicIds.has(t) : null,
    is_dialogue_topic_folded: t ? dialogueFolded.has(fold(t)) : null,
    giver_npc: q.giver && q.giver.npc_id,
    overheard_from: (q.opens_by && q.opens_by.overheard_from) || [],
    // RI-JRN07 M-Q4: any line anywhere in the dialogue corpus naming this quest's key noun
    dialogue_mentions_key_noun: dialogueProse.includes(key),
  };
});

// ---- C. rumours -------------------------------------------------------------------------------
const rumourFiles = [path.join(ROOT, 'game/data/dialogue/rumours.json'), ...walk(path.join(ROOT, 'game/data/dialogue/rumours'))];
let rumourText = '';
for (const f of rumourFiles) if (fs.existsSync(f)) rumourText += fs.readFileSync(f, 'utf8');
const rumourHits = main.filter((q) => rumourText.includes(q.title.replace(/^The /, ''))).length;

// CONSUMPTION, measured rather than asserted (RI-MTH07 / ARBITRATION §3): which files under
// game/src/** actually READ a field. Comments are stripped first, because a field named only in
// a comment is exactly the orphan this counts.
function countConsumers(pattern) {
  const re = new RegExp(pattern);
  const hits = [];
  const scan = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) scan(p);
      else if (f.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        if (re.test(code)) hits.push(path.relative(ROOT, p));
      }
    }
  };
  scan(path.join(ROOT, 'game/src'));
  return hits;
}

// A main-quest NOUN in a rumour, which is what round 1 measured as 0 everywhere.
const rumourNounHits = (() => {
  const nouns = new Set(main.map((q) => (q.opens_by && q.opens_by.topic) || '').filter(Boolean));
  let n = 0;
  for (const noun of nouns) if (rumourText.toLowerCase().includes(String(noun).toLowerCase())) n++;
  return n;
})();

// ---- B. live ----------------------------------------------------------------------------------
const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 300000) });
let live;
try {
  live = await handle.page.evaluate(async ({ mainIds, state }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.setSeed(1337);
    H.loadState(state);
    H.setRenderRate(0);
    // NOTHING is learned through the harness. This is the whole point of the probe.
    const st0 = H.getQuestState();
    const count = () => {
      const offers = H.questOffers();
      const rows = offers.filter((o) => mainIds.includes(o.id)).map((o) => ({ id: o.id, offerable: !!o.offerable, why: (o.why || []).slice() }));
      return {
        offerable: rows.filter((r) => r.offerable).length,
        blocked_on_topic: rows.filter((r) => r.why.some((w) => /has not come up yet/.test(w))).length,
        rows,
      };
    };
    const cold = count();
    // The two things a player can do that are not `learnTopic()`. Both go through the ordinary
    // world path: `Engine.talkTo()` reads `opens_by.overheard_from`, `Engine.conversationSay()`
    // reads the info's `to` — Morrowind's AddTopic.
    const people = (H.listNPCs ? H.listNPCs() : []).map((n) => n.eid);
    const acted = { greeted: [], asked: [], directions: [], errors: [] };
    for (const eid of people) {
      try {
        const st = H.talkTo(eid);
        acted.greeted.push(eid);
        for (const t of (st.topics || [])) {
          try {
            const said = H.conversationSay(t.id);
            acted.asked.push({ npc: eid, topic: t.id, line: said && said.said ? String(said.said).slice(0, 80) : null });
          } catch (e) { /* nothing to hear */ }
        }
        H.conversationClose();
      } catch (e) { acted.errors.push(String((e && e.message) || e)); }
    }
    const after = count();
    const st1 = H.getQuestState();
    return {
      state,
      npcs_present: people,
      topics_known_at_cold_start: st0.topicsKnown || [],
      main_offerable: cold.offerable,
      main_total: cold.rows.length,
      blocked_on_topic: cold.blocked_on_topic,
      rows: cold.rows,
      after_listening: {
        greeted: acted.greeted.length,
        asked: acted.asked.length,
        heard: acted.asked.slice(0, 12),
        topics_known: st1.topicsKnown || [],
        main_offerable: after.offerable,
        blocked_on_topic: after.blocked_on_topic,
        offerable_ids: after.rows.filter((r) => r.offerable).map((r) => r.id),
        directions_heard: Object.keys(st1.flags || {}).filter((f) => f.startsWith('directions_heard:')),
      },
    };
  }, { mainIds: main.map((q) => q.id), state: STATE });
} finally { await handle.close(); }

const out = {
  tool: 'tools/quests/mainline-findability.mjs',
  schema: 'elder-souls/mainline-findability@1',
  measured_at: new Date().toISOString(),
  fold_rule: 'game/src/core/topics.js (transcribed); NOTE — check whether sim/quest/gate.js imports it',
  static: {
    main_quests: main.length,
    distinct_opens_topics: new Set(staticRows.map((r) => r.topic)).size,
    world_suppliable_raw: staticRows.filter((r) => r.supplied_raw).length,
    world_suppliable_folded: staticRows.filter((r) => r.supplied_folded).length,
    exists_as_dialogue_topic_raw: staticRows.filter((r) => r.is_dialogue_topic_raw).length,
    exists_as_dialogue_topic_folded: staticRows.filter((r) => r.is_dialogue_topic_folded).length,
    dialogue_mentions_key_noun: staticRows.filter((r) => r.dialogue_mentions_key_noun).length,
    overheard_from_rows: staticRows.filter((r) => r.overheard_from.length).length,
    overheard_from_code_consumers: countConsumers('overheard_from|overheardIndex'),
    info_to_addtopic_code_consumers: countConsumers('\\binfo\\.to\\b|best\\.to\\b|\\bto: Array'),
    directions_code_consumers: countConsumers('\\bdirections\\b'),
    rumours_code_consumers: countConsumers('[Rr]umour'),
    rumour_text_naming_a_main_quest_opening_topic: rumourNounHits,
    rumour_lines_naming_a_main_quest_noun: rumourHits,
    rows: staticRows,
  },
  live,
};
writeJson(path.join(outDir, 'mainline-findability.json'), out);

const s = out.static;
console.log(`\nmainline findability — ${s.main_quests} main quests, ${s.distinct_opens_topics} distinct opening topics\n`);
console.log(`  A. static`);
console.log(`     opening topics any world-side supplier can produce, RAW spelling      ${s.world_suppliable_raw}/${s.main_quests}`);
console.log(`     opening topics any world-side supplier can produce, FOLDED spelling   ${s.world_suppliable_folded}/${s.main_quests}`);
console.log(`     opening topics that exist as a dialogue topic id, RAW                 ${s.exists_as_dialogue_topic_raw}/${s.main_quests}`);
console.log(`     opening topics that exist as a dialogue topic id, FOLDED              ${s.exists_as_dialogue_topic_folded}/${s.main_quests}`);
console.log(`     quests whose key noun appears anywhere in game/data/dialogue/**       ${s.dialogue_mentions_key_noun}/${s.main_quests}`);
console.log(`     quests declaring \`opens_by.overheard_from\` NPCs                       ${s.overheard_from_rows}/${s.main_quests}  (code consumers of that field: ${s.overheard_from_code_consumers})`);
console.log(`     rumour lines naming a main-quest noun                                 ${s.rumour_lines_naming_a_main_quest_noun}`);
console.log(`     rumour text naming a main-quest OPENING TOPIC                         ${s.rumour_text_naming_a_main_quest_opening_topic}/${new Set(main.map((q) => q.opens_by.topic)).size}`);
console.log(`     code consumers  overheard_from ${s.overheard_from_code_consumers.length}  info.to ${s.info_to_addtopic_code_consumers.length}  directions ${s.directions_code_consumers.length}  rumours ${s.rumours_code_consumers.length}`);
console.log(`\n  B. live in '${live.state}', cold start, nothing learned through the harness`);
console.log(`     topics known at a cold start        ${live.topics_known_at_cold_start.length}`);
console.log(`     main quests offerable               ${live.main_offerable}/${live.main_total}`);
console.log(`     main quests blocked on the topic    ${live.blocked_on_topic}/${live.main_total}`);
console.log(`\n  C. after LISTENING — greeted the ${live.after_listening.greeted} people present and asked what they would discuss`);
console.log(`     topics known                       ${live.after_listening.topics_known.length}`);
console.log(`     main quests offerable              ${live.after_listening.main_offerable}/${live.main_total}  ${JSON.stringify(live.after_listening.offerable_ids)}`);
console.log(`     main quests blocked on the topic   ${live.after_listening.blocked_on_topic}/${live.main_total}`);
console.log(`     directions heard from a person     ${live.after_listening.directions_heard.length}`);
console.log(`\nwrote ${path.join(outDir, 'mainline-findability.json')}`);
