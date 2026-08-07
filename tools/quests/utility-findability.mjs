#!/usr/bin/env node
// utility-findability.mjs — can a player be OFFERED the quests that are NOT the main quest?
//
// Declared under `orchestration/TOOL-LOOP.md`. Written by the W1-19 round-2 successor (gen 3).
//
// WHY THIS EXISTS. The round-1 verdict on the main quest found that 74 of the 76 `opens_by.topic`
// values in this tree were unsatisfiable, and that it was invisible because every quest tool
// seeded the gate with the quest's own string. Round 2 repaired the 32 Q-MAIN edges and proved it
// by playing (`mainline-chain-floor.mjs`, 40/40 signatures, nothing hand-fed). W1-FACTIONS
// repaired the three faction lines. `topic-supply-audit.mjs` then reported the remainder as a
// STATIC fact — 34 keywords with no body and 27 quests spoken by nobody — and a static fact is
// not a demonstration. This tool is the demonstration: it stands a player in a town and counts
// how many of those quests can be opened before and after the only two things a player can do
// there, which are GREET somebody and ASK WHAT THE TOWN IS SAYING.
//
// It hand-feeds nothing. `H.learnTopic()` is never called. That is the whole point: every quest
// tool in this tree used to call it with the exact string the gate was about to ask for, which is
// `RI-MTH07`'s hand-feed failure and is how a build in which no quest could be opened traced
// green for a whole wave.
//
// THE CONTROL. `--sabotage no-rumours` performs the greeting and skips the rumour ask. If the
// numbers do not fall, the rumour layer is not what is carrying the supply and this tool is
// measuring something else. `--sabotage none-at-all` does neither and must report the cold count.
//
// Run:
//   node tools/quests/utility-findability.mjs [--state <named state>] [--out <dir>]
//                                             [--sabotage no-rumours|none-at-all] [--json]
// Exit: 0 always — this is a measurement, not a gate. Read the numbers.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const USAGE = `
utility-findability.mjs — can a player be offered the NON-main quests by standing in a town?

  --state <id>        named state to boot (default helstrom-market). Repeatable.
  --sabotage <s>      no-rumours | none-at-all
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-UTIL');
ensureDir(outDir);
const sabotage = args.sabotage ? String(args.sabotage) : null;
if (sabotage && !['no-rumours', 'none-at-all'].includes(sabotage)) usage(USAGE);
const STATES = (args.state ? String(args.state).split(',') : 'helstrom-market,stormhold-street,soulrest-quay').split(',').map((s) => s.trim()).filter(Boolean);

// ---- which quests this tool is about ----------------------------------------------------------
// Everything that is not the main spine and not a faction rank ladder: the 28 magic-utility
// quests and the seven standalone ones. These are the quests `topic-supply-audit.mjs` reported.
const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs.push(q);
}
const SUBJECT = defs.filter((q) => /^Q-(MAG|ARCH|SOUL|BLAK|STRM|LILM|SAP|DOCK)-/.test(q.id));
const wantTopic = new Map(SUBJECT.map((q) => [q.id, (q.opens_by || {}).topic]));

const report = { tool: 'utility-findability', sabotage: sabotage || 'none', subject_quests: SUBJECT.length, states: [] };

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  for (const state of STATES) {
    const row = await page.evaluate(async ({ state, sabotage, subject }) => {
      const H = window.__HARNESS;
      H.loadState(state);
      const known = () => (H.getQuestState().topicsKnown || []).slice();
      const offerable = () => {
        const out = { ok: [], blocked_on_topic: [], blocked_other: [] };
        for (const id of subject) {
          let r;
          try { r = H.questOpen(id); } catch (e) { out.blocked_other.push([id, String(e && e.message || e)]); continue; }
          if (r.ok) out.ok.push(id);
          else if (/topic/i.test(String(r.reason || ''))) out.blocked_on_topic.push([id, r.reason]);
          else out.blocked_other.push([id, r.reason]);
          // `questOpen` OPENS the quest when it succeeds, which would change the next answer.
          // Nothing here resolves anything, so the only state it leaves is an open journal.
        }
        return out;
      };

      const cold = { topics: known(), offer: offerable() };

      // ---- the two world actions -------------------------------------------------------------
      const acted = [];
      if (sabotage !== 'none-at-all') {
        const people = H.listNPCs().map((n) => n.eid);
        for (const eid of people) {
          // Talk to the same person a few times: `nth` is the greet count and the rumour a person
          // tells you is keyed to it, exactly as Morrowind's is. Asking twice is a player action.
          for (let visit = 0; visit < 4; visit++) {
            let st;
            try { st = H.talkTo(eid); } catch (e) { break; }
            const heard = [];
            for (const t of (st.topics || [])) {
              const isRumour = /latest rumours/i.test(t.id);
              if (isRumour && sabotage === 'no-rumours') continue;
              try {
                const said = H.conversationSay(t.id);
                if (said && !said.refused) heard.push(t.id);
              } catch (e) { /* nothing to say */ }
            }
            acted.push({ npc: eid, visit, heard });
            H.conversationClose();
          }
        }
      }

      const after = { topics: known(), offer: offerable() };
      return { state, settlement: H.getWorldState ? null : null, cold, after, acted };
    }, { state, sabotage, subject: SUBJECT.map((q) => q.id) });

    const learned = row.after.topics.filter((t) => !row.cold.topics.includes(t));
    const wanted = new Set([...wantTopic.values()].filter(Boolean).map(topicKey));
    row.topics_cold = row.cold.topics.length;
    row.topics_after = row.after.topics.length;
    row.topics_learned = learned;
    row.quest_keywords_learned = learned.filter((t) => wanted.has(topicKey(t)));
    row.offerable_cold = row.cold.offer.ok.length;
    row.offerable_after = row.after.offer.ok.length;
    row.newly_offerable = row.after.offer.ok.filter((q) => !row.cold.offer.ok.includes(q));
    row.blocked_on_topic_cold = row.cold.offer.blocked_on_topic.length;
    row.blocked_on_topic_after = row.after.offer.blocked_on_topic.length;
    delete row.cold.topics; delete row.after.topics;
    report.states.push(row);

    console.log(`\n${state}   sabotage=${sabotage || 'none'}`);
    console.log(`  topics known           cold ${row.topics_cold}  ->  after ${row.topics_after}`);
    console.log(`  quest keywords learned ${row.quest_keywords_learned.length}   ${row.quest_keywords_learned.slice(0, 12).join(', ')}`);
    console.log(`  offerable (of ${SUBJECT.length})     cold ${row.offerable_cold}  ->  after ${row.offerable_after}`);
    console.log(`  blocked ON TOPIC       cold ${row.blocked_on_topic_cold}  ->  after ${row.blocked_on_topic_after}`);
    console.log(`  newly offerable        ${row.newly_offerable.join(', ') || '(none)'}`);
  }
} finally {
  await handle.close();
}

const total = report.states.reduce((a, s) => a + s.newly_offerable.length, 0);
report.newly_offerable_total = total;
console.log(`\n  quests opened by playing, across ${report.states.length} town(s): ${total}   (nothing hand-fed; H.learnTopic is never called)`);
const out = path.join(outDir, `utility-findability${sabotage ? '-' + sabotage : ''}.json`);
writeJson(out, report);
console.log(`\nwrote ${out}`);
