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
//
// W1-19 ROUND-2 SUCCESSOR, 2026-08-07, two corrections and one addition:
//
//   1. **THE FOLD RULE IS NOW IMPORTED, NOT TRANSCRIBED.** This file used to carry its own copy
//      of `game/src/core/topics.js#topicKey`, on the reasoning that a tool should state the rule
//      it applies rather than import a file that may not be wired. That reasoning was right about
//      the danger and wrong about the remedy: the copy DIVERGED. `topicKey` *drops* apostrophes
//      (`the cutters' terms` -> `the cutters terms`, so it can meet the slug `the-cutters-terms`);
//      the transcription merely *normalised* curly to straight, so every possessive topic — eight
//      of the thirty-two, the whole of Act IV — was scored as unmatched. It reported
//      `world_suppliable_folded 25/32` and `exists_as_dialogue_topic_folded 27/32` against a true
//      27/32 and 32/32. A tool that re-implements the rule it is auditing is the same defect as a
//      tool that seeds the gate it then checks, one layer up. `gate.js` now imports `topicsInclude`
//      from `core/topics.js`, so importing it here compares like with like, and the tool asserts
//      the import is the file the gate uses.
//   2. **THE VERDICT'S TWO ACCEPTANCE METRICS ARE COMPUTED.** `supplied_only_by_itself` and
//      `no_supplier_at_all` were the numbers §2 asked for and no tool produced them; a builder
//      reading only the printed table could not tell whether it had met the bar. The supply graph
//      is now attributed per topic — which quest, hook, dialogue info (`to`), rumour or
//      `overheard_from` row can produce it — and a topic whose only producer is the very quest
//      that demands it is named in the report.
//   3. **PART D — the way there.** `q.directions` is one of §4's four orphan models and part C
//      could never see it: directions are offered only once the quest is OPEN, and part C opens
//      nothing. Part D takes the one quest the world made offerable, opens it, asks the giver the
//      way, and asserts the sentence that comes back is the quest's own `directions` string.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { topicKey } from '../../game/src/core/topics.js';

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

// THE FOLD RULE, imported from the module the offer gate itself imports. See the header note:
// the transcribed copy this line replaced had drifted from `topicKey` on apostrophes and was
// silently scoring the whole of Act IV as unmatched.
//
// The assertion below is the point. If `sim/quest/gate.js` ever stops importing `core/topics.js`,
// this tool is comparing under a rule the gate does not apply, and every number it prints becomes
// a claim about a world that is not running. It fails loudly rather than reporting a green.
const fold = (s) => topicKey(s);
{
  const gateSrc = fs.readFileSync(path.join(process.cwd(), 'game/src/sim/quest/gate.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (!/from\s+['"][^'"]*core\/topics\.js['"]/.test(gateSrc)) {
    console.error('mainline-findability: game/src/sim/quest/gate.js does not import core/topics.js.\n'
      + '  The gate is comparing topics under a different rule than this tool. Refusing to report a\n'
      + '  folded number the running build would not agree with (RI-MTH07).');
    process.exit(2);
  }
}
if (fold("the cutters' terms") !== fold('the-cutters-terms')) {
  console.error('mainline-findability: topicKey no longer folds a possessive slug onto its prose spelling.');
  process.exit(2);
}

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

// THE SUPPLY GRAPH, ATTRIBUTED. Round 1's headline was not "no supplier" but "supplied only by
// the quest that fires the edge" — a graph that is fully connected and points at itself, which
// counts as supplied under any test that only asks whether SOMETHING adds the string. So every
// producer is recorded with its source, and a source that is the demanding quest is discounted.
//
// Five kinds of producer, which is every route a topic can enter `topicsKnown` in the running
// build (`engine.js#conversationSay`, `#talkTo`, `QuestEngine` journal hooks):
//   quest:<id>   a `hooks.json` entry_topics row fired by that quest's journal write
//   hook:<flag>  a world-flag hook's adds_topics
//   info:<topic> an `info.to` AddTopic edge on a dialogue info — you heard somebody say it
//   rumour       a rumours.json line carrying adds_topics
//   overheard    a quest naming people who mention it unprompted (opens_by.overheard_from)
const producers = new Map();                 // folded topic -> Set(source label)
const produce = (topic, source) => {
  const k = fold(topic);
  if (!k) return;
  if (!producers.has(k)) producers.set(k, new Set());
  producers.get(k).add(source);
};
for (const e of hooks.entry_topics || []) for (const t of e.adds_topics || []) produce(t, `quest:${e.quest}`);
for (const h of hooks.hooks || []) for (const t of h.adds_topics || []) produce(t, `hook:${h.flag}`);
for (const f of walk(path.join(ROOT, 'game/data/dialogue/topics'))) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const t of d.topics || []) for (const i of t.infos || []) for (const a of i.to || []) produce(a, `info:${t.id}`);
}
{
  const rp = path.join(ROOT, 'game/data/dialogue/rumours.json');
  if (fs.existsSync(rp)) {
    const r = JSON.parse(fs.readFileSync(rp, 'utf8'));
    for (const rows of Object.values(r.rumours || {})) for (const l of rows || []) if (l && l.adds_topics) for (const a of l.adds_topics) produce(a, 'rumour');
    for (const row of r.race_gated || []) for (const a of row.adds_topics || []) produce(a, 'rumour');
  }
}
for (const q of quests) {
  const ob = q.opens_by || {};
  if (ob.topic && (ob.overheard_from || []).length) produce(ob.topic, 'overheard');
}
/** Everything that can produce this quest's opening topic, minus the quest itself. */
const suppliersFor = (q) => {
  const t = (q.opens_by || {}).topic;
  if (!t) return { all: [], others: [] };
  const all = [...(producers.get(fold(t)) || [])].sort();
  return { all, others: all.filter((s) => s !== `quest:${q.id}`) };
};

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
  const sup = suppliersFor(q);
  return {
    quest: q.id, act: q.act, topic: t,
    suppliers: sup.all,
    suppliers_other_than_itself: sup.others,
    supplied_only_by_itself: sup.all.length > 0 && sup.others.length === 0,
    no_supplier_at_all: sup.all.length === 0,
    supplied_raw: t ? supplied.has(t) : null,
    supplied_folded: t ? suppliedFolded.has(fold(t)) : null,
    is_dialogue_topic_raw: t ? dialogueTopicIds.has(t) : null,
    is_dialogue_topic_folded: t ? dialogueFolded.has(fold(t)) : null,
    giver_npc: q.giver && q.giver.npc_id,
    overheard_from: (q.opens_by && q.opens_by.overheard_from) || [],
    // RI-JRN07 M-Q4: any line anywhere in the dialogue corpus naming this quest's key noun.
    //
    // CAVEAT, and it is why this is printed with a "see note": `key` is the quest's TITLE minus a
    // leading "The" — "Reading of the Count", "The Sexton's Voice" — and a title is a stage index,
    // not a thing anybody in the province says out loud. A world in which a carter says "have you
    // heard about The Sexton's Voice" would be a worse world. The diegetic measure is the row
    // below it (`exists_as_dialogue_topic_folded`, 32/32) and `rumour_grants_opening_topic`.
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
//
// SUCCESSOR NOTE: this used to do a raw substring test of the PROSE opening topic ("the drowned
// tally") against the rumour file's own text, which stores SLUGS ("the-drowned-tally"). It was
// the same unfolded comparison that made the whole of Act IV look unsupplied, and it undercounted
// here too. Both sides are folded now, and the prose of every rumour line is searched as well as
// its `adds_topics`, so a rumour that names the thing without granting the keyword still counts
// as having named it.
const rumourFolded = fold(rumourText);
const rumourNounHits = (() => {
  const nouns = new Set(main.map((q) => (q.opens_by && q.opens_by.topic) || '').filter(Boolean).map(fold));
  let n = 0;
  for (const noun of nouns) if (rumourFolded.includes(noun)) n++;
  return n;
})();

// The number the round-1 remedy actually asked for: "≥1 rumour line in a settlement other than
// Soulrest naming the Drowned Tally". Generalised — for each main quest, can gossip GRANT its
// opening topic, and in how many settlements?
const rumourGrants = (() => {
  const bySettlement = new Map();               // folded topic -> Set(settlement)
  const note = (topic, settlement) => {
    const k = fold(topic);
    if (!k) return;
    if (!bySettlement.has(k)) bySettlement.set(k, new Set());
    bySettlement.get(k).add(settlement || '(anywhere)');
  };
  for (const f of rumourFiles) {
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [settlement, rows] of Object.entries(d.rumours || {})) {
      for (const l of rows || []) if (l && l.adds_topics) for (const a of l.adds_topics) note(a, settlement);
    }
    for (const row of d.race_gated || []) for (const a of row.adds_topics || []) note(a, row.settlement);
  }
  return main.map((q) => {
    const t = (q.opens_by || {}).topic;
    const towns = t ? [...(bySettlement.get(fold(t)) || [])].sort() : [];
    return { quest: q.id, topic: t, settlements: towns };
  });
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

    // ---- D. THE WAY THERE ----------------------------------------------------------------
    // `q.directions` is the third of the round-1 verdict's four orphan models, and part C above
    // could never have seen it: directions are offered only once the quest is OPEN, because
    // directions to a place you have not been sent to are a spoiler, not a direction. So take
    // the quest the world just made offerable, open it the way a player would, walk up to the
    // giver, and ask the way.
    //
    // The assertion is on the SENTENCE, not on a return code: the line spoken has to be the
    // quest's own authored `directions` string, character for character. Perturb that string in
    // `game/data/quests/**` and this number moves — which is the whole of RI-MTH07's demand.
    const directions = { opened: null, topic: null, said: null, matches_authored: null, flag: null, error: null };
    try {
      const openId = after.rows.filter((r) => r.offerable).map((r) => r.id)[0] || null;
      if (openId) {
        const o = H.questOpen(openId);
        directions.opened = o && o.ok ? openId : null;
        if (o && o.ok) {
          const def = H.questDef(openId);
          const giver = (def.giver || {}).npc_id;
          try { H.spawnNPC({ from_record: giver, pos: [0, 0, 2] }); } catch (e) { /* already stood there */ }
          const conv = H.talkTo(giver);
          // The player does not know the words in advance; they read what this person will
          // discuss and pick the one that is about getting there.
          const row = (conv.topics || []).find((t) => /^the way to /.test(String(t.id)));
          directions.topic = row ? row.id : null;
          if (row) {
            const said = H.conversationSay(row.id);
            const line = said && said.said ? String(said.said) : (said && said.info && said.info.x) || null;
            directions.said = line;
            directions.matches_authored = line != null && def.directions != null && line.trim() === String(def.directions).trim();
          }
          H.conversationClose();
          const qs = H.getQuestState();
          directions.flag = Object.keys(qs.flags || {}).filter((f) => f.startsWith('directions_heard:'));
        }
      }
    } catch (e) { directions.error = String((e && e.message) || e); }

    return {
      directions,
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
    // The round-1 verdict's two acceptance numbers, §2: "Equivalently `supplied_only_by_itself
    // = 0` and `no_supplier_at_all <= 1`."
    supplied_only_by_itself: staticRows.filter((r) => r.supplied_only_by_itself).length,
    supplied_only_by_itself_ids: staticRows.filter((r) => r.supplied_only_by_itself).map((r) => r.quest),
    no_supplier_at_all: staticRows.filter((r) => r.no_supplier_at_all).length,
    no_supplier_at_all_ids: staticRows.filter((r) => r.no_supplier_at_all).map((r) => r.quest),
    dialogue_mentions_key_noun: staticRows.filter((r) => r.dialogue_mentions_key_noun).length,
    overheard_from_rows: staticRows.filter((r) => r.overheard_from.length).length,
    overheard_from_code_consumers: countConsumers('overheard_from|overheardIndex'),
    info_to_addtopic_code_consumers: countConsumers('\\binfo\\.to\\b|best\\.to\\b|\\bto: Array'),
    directions_code_consumers: countConsumers('\\bdirections\\b'),
    rumours_code_consumers: countConsumers('[Rr]umour'),
    rumour_text_naming_a_main_quest_opening_topic: rumourNounHits,
    rumour_lines_naming_a_main_quest_noun: rumourHits,
    // `rumour_lines_naming_a_main_quest_noun` above compares against the quest's TITLE, which is
    // a stage index ("Reading of the Count") and not a thing anybody in the province says out
    // loud. It stays because the round-1 verdict quoted it, but it is not the findability
    // measure. This is: how many main quests can gossip put into a player's mouth, and where.
    rumour_grants_opening_topic: rumourGrants.filter((r) => r.settlements.length).length,
    rumour_grants_opening_topic_rows: rumourGrants,
    q_main_01_rumour_settlements: (rumourGrants.find((r) => r.quest === 'Q-MAIN-01') || {}).settlements || [],
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
console.log(`     ACCEPTANCE  supplied only by the quest that demands it                 ${s.supplied_only_by_itself}/${s.main_quests}  (bar: 0)  ${s.supplied_only_by_itself_ids.join(' ')}`);
console.log(`     ACCEPTANCE  no supplier at all                                        ${s.no_supplier_at_all}/${s.main_quests}  (bar: <=1) ${s.no_supplier_at_all_ids.join(' ')}`);
console.log(`     quests whose TITLE noun appears in game/data/dialogue/** (see note)   ${s.dialogue_mentions_key_noun}/${s.main_quests}`);
console.log(`     quests declaring \`opens_by.overheard_from\` NPCs                       ${s.overheard_from_rows}/${s.main_quests}  (code consumers of that field: ${s.overheard_from_code_consumers})`);
console.log(`     rumour lines naming a main-quest noun (title-based, see note)         ${s.rumour_lines_naming_a_main_quest_noun}`);
console.log(`     rumour text naming a main-quest OPENING TOPIC                         ${s.rumour_text_naming_a_main_quest_opening_topic}/${new Set(main.map((q) => q.opens_by.topic)).size}`);
console.log(`     main quests a RUMOUR can put in the player's mouth                    ${s.rumour_grants_opening_topic}/${s.main_quests}`);
console.log(`       Q-MAIN-01 is gossiped in: ${s.q_main_01_rumour_settlements.join(', ') || '(nowhere)'}`);
console.log(`     code consumers  overheard_from ${s.overheard_from_code_consumers.length}  info.to ${s.info_to_addtopic_code_consumers.length}  directions ${s.directions_code_consumers.length}  rumours ${s.rumours_code_consumers.length}`);
console.log(`\n  B. live in '${live.state}', cold start, nothing learned through the harness`);
console.log(`     topics known at a cold start        ${live.topics_known_at_cold_start.length}`);
console.log(`     main quests offerable               ${live.main_offerable}/${live.main_total}`);
console.log(`     main quests blocked on the topic    ${live.blocked_on_topic}/${live.main_total}`);
console.log(`\n  C. after LISTENING — greeted the ${live.after_listening.greeted} people present and asked what they would discuss`);
console.log(`     topics known                       ${live.after_listening.topics_known.length}`);
console.log(`     main quests offerable              ${live.after_listening.main_offerable}/${live.main_total}  ${JSON.stringify(live.after_listening.offerable_ids)}`);
console.log(`     main quests blocked on the topic   ${live.after_listening.blocked_on_topic}/${live.main_total}`);
console.log(`     directions heard from a person     ${live.after_listening.directions_heard.length}  (0 is CORRECT here — no quest is open yet, and directions to a place you have not been sent to are a spoiler. See D.)`);
const D = live.directions || {};
console.log(`\n  D. the way there — opened what the world offered, then asked the giver`);
console.log(`     quest opened by playing            ${D.opened || '(none)'}`);
console.log(`     topic the giver would discuss      ${D.topic || '(none)'}`);
console.log(`     line spoken is the authored q.directions, verbatim   ${D.matches_authored === true ? 'YES' : D.matches_authored === false ? 'NO' : '(not reached)'}`);
if (D.said) console.log(`     "${D.said.slice(0, 140)}"`);
console.log(`     directions_heard flags set         ${(D.flag || []).join(', ') || '(none)'}`);
if (D.error) console.log(`     error: ${D.error}`);
console.log(`\nwrote ${path.join(outDir, 'mainline-findability.json')}`);
