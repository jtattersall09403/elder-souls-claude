#!/usr/bin/env node
// reveal-route-world.mjs — THE WORLD-SIDE HALF. Does TALKING TO SOMEBODY, in the running game,
// produce the reveal the quest file says that person is the source of?
//
// W1-18 round 2. `tools/quests/reveal-route-audit.mjs` section D drives
// `QuestEngine.learnFrom()` directly in bare Node, so on its own it cannot tell a wired engine
// from an unwired one — and shipping a correct model with no world-side caller is the failure
// this whole round exists to close (RI-MTH07 / ARBITRATION §3; sixteen subsystems have done it).
// This tool closes that gap the only way it can be closed: a browser, the real `Engine`, and one
// player action.
//
// THE ONLY ACT IS `talkTo(npcId)`. Everything else is observation.
//
// PROHIBITED, and the tool asserts its own bytes do not name them (see PROHIBITED below):
//   * `questReveal` — the verb under test. Calling it would BE the result.
//   * `questNote`   — the journal write under test, for the same reason.
//   * `questSetFlag`— the other door into the same write, through the hook table.
//   * `__ENGINE`    — INDEX.md's documented back door around harness prohibitions.
//
// PERMITTED AND DECLARED, because they are not what is being measured:
//   * `questOpen` and `learnTopic` — whether THIS character could have been OFFERED this quest is
//     the offer gate's question and belongs to `mainline-findability.mjs`; at a cold start every
//     one of the 36 candidates refuses, mostly on a topic that has not come up yet and often on a
//     faction ladder as well. Both grants are recorded per case, and NEITHER touches knowledge:
//     `learnTopic` writes `topicsKnown`, which is what you can ASK ABOUT; `know:` flags are a
//     different register with one writer, and that writer is what is under test. Only the
//     `opens_by` topics the refusal names are granted — never a topic the gate did not ask for —
//     and a leg the gate still refuses is SKIPPED with the reason printed, never scored.
//   * `populateSettlement` / `populateSite` — WALKING INTO THE TOWN THE PERSON LIVES IN. This is
//     the world's own call, the same one `travelToGiver` makes and the same one crossing a town
//     boundary makes; the settlement each person belongs to is read out of their own record in
//     `game/data/npcs/**`, never chosen. NOBODY IS SPAWNED FROM NOTHING: a source with no
//     settlement and no post is left absent and the case is SKIPPED, because `talkTo` throws on
//     somebody who is not in the world and that absence is the honest answer. 15 of the
//     person-channel sources are not in `game/data/npcs/**` at all; the audit lists them.
//
// THE CONTROLS (RULES.md rule 4 — a probe that cannot fail is worse than no probe):
//   1. WRONG PERSON. Talk to somebody who is not the declared source. Nothing may be learned.
//   2. QUEST NOT OPEN. Talk to the right person before accepting the job. Nothing may be learned.
//      This is the gate `learnFrom()` applies, and without it every stranger in the province
//      spills the middle of every quest they are named in.
//   3. The run FAILS if the reveal was already known before the conversation — that would mean
//      something else granted it and the leg proves nothing.
//
// Exit 0 only when every case learned its reveal by talking, wrote the journal entry the file
// declares, and both controls stayed empty.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const PROHIBITED = ['questReveal', 'questNote', 'questSetFlag', '__ENGINE'];

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage([
    'reveal-route-world.mjs — does talking to a person, in the running game, produce the reveal',
    'the quest file names them as the source of?',
    '',
    '  --cases <n>   how many legs the offer gate lets through before stopping (default 6)',
    '  --out <path>  where to write the report',
  ].join('\n'));
}

// ---- the tool's own bytes. A prohibition a tool can violate is a comment. ------------------
const src = fs.readFileSync(SELF, 'utf8');
const selfProblems = [];
for (const p of PROHIBITED) {
  // once in the PROHIBITED list, once in this loop's own error string — three occurrences of the
  // literal is the ceiling, and a call site would push it over.
  const n = (src.match(new RegExp(p.replace(/[$]/g, '\\$'), 'g')) || []).length;
  if (n > 2) selfProblems.push(`${p} occurs ${n} times in this file; it is prohibited and must appear only in the declaration`);
}
if (selfProblems.length) { console.error('reveal-route-world: ' + selfProblems.join('\n  ')); process.exit(2); }

// ---- what the data says ---------------------------------------------------------------------
const { CHANNEL_READERS } = await import(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js'));
const QDIR = path.join(ROOT, 'game/data/quests');
const quests = [];
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of (j.quests || [])) quests.push(q);
}
const npcIds = new Set();
const npcPlace = new Map();   // id -> { settlement } | { site } | null, straight off the record
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/npcs', f), 'utf8'));
  for (const n of (Array.isArray(j) ? j : (j.npcs || j.entries || []))) {
    if (!n || !n.id) continue;
    npcIds.add(n.id);
    npcPlace.set(n.id, n.settlement ? { settlement: n.settlement } : ((n.post && n.post.site) ? { site: n.post.site } : null));
  }
}

// Candidates: a quest with a person-channel reveal that (a) some resolution demands, (b) names a
// person who exists in `game/data/npcs/**`, and (c) declares the journal entry it writes — so the
// leg can assert on the journal as well as on the flag.
const candidates = [];
for (const q of quests) {
  const demanded = new Set();
  for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
  const rows = ((q.deceit && q.deceit.revealed_by) || []).filter((r) =>
    CHANNEL_READERS[r.channel] === 'person' && npcIds.has(r.source)
    && demanded.has(r.id) && r.before_point_of_no_return !== false);
  if (!rows.length) continue;
  candidates.push({
    quest: q.id,
    rows: rows.map((r) => ({ reveal: r.id, source: r.source, journal: r.journal == null ? null : r.journal })),
    // How hard this quest is to ACCEPT, which is a different measurement and not this one's.
    // Cheapest first, so the run spends its browser on legs that get past the offer gate; a
    // quest whose offer gate refuses is SKIPPED with the refusal printed, never scored.
    cost: ((q.opens_by && q.opens_by.prerequisite_quests) || []).length + (q.rank_gate ? 10 : 0),
    has_journal: rows.some((r) => r.journal != null),
    topic: (q.opens_by && q.opens_by.topic) || null,
    prereqTopics: (q.opens_by && q.opens_by.prerequisite_topics) || [],
  });
}
candidates.sort((a, b) => (a.cost - b.cost) || (b.has_journal - a.has_journal) || (a.quest < b.quest ? -1 : 1));
if (!candidates.length) { console.error('reveal-route-world: no person-channel candidate in the shipped data. Nothing to measure.'); process.exit(2); }
const WANT = Number(args.cases || 6);

// ---- the run --------------------------------------------------------------------------------
const handle = await launchGame(args);
const walkedTo = new Set();
const cases = [];
try {
  await requireMethods(handle, ['talkTo', 'getQuestState', 'questOpen', 'listNPCs', 'reset', 'populateSettlement', 'populateSite', 'travelToGiver', 'learnTopic']);

  const isPresent = (id) => handle.page.evaluate((x) => (window.__HARNESS.listNPCs() || []).some((n) => (n.eid || n.id) === x), id);
  /** Walk into the town or site this person's own record says they are in. Never invents one. */
  const walkTo = async (id) => {
    if (await isPresent(id)) return true;
    const place = npcPlace.get(id);
    if (!place) return false;
    if (place.settlement) { await handle.h('populateSettlement', place.settlement); walkedTo.add(place.settlement); }
    else { await handle.h('populateSite', place.site); walkedTo.add(place.site); }
    return isPresent(id);
  };

  for (const c of candidates) {
    if (cases.filter((x) => !x.skipped && !x.error).length >= WANT) break;
    const row = c.rows.find((r) => r.journal != null) || c.rows[0];
    const rec = { quest: c.quest, npc: row.source, reveal: row.reveal, journal_declared: row.journal, npc_place: npcPlace.get(row.source) || null };
    await handle.h('reset');
    // Walk to the giver's town first — that is where the quest is accepted — then to the
    // source's, which is often the same place and sometimes is not.
    rec.travel = await handle.h('travelToGiver', c.quest);
    const present = await walkTo(row.source);
    rec.npc_present = present;
    if (!present) { rec.skipped = 'that person is not in the world; talkTo would throw'; cases.push(rec); continue; }

    // `Engine.getQuestState()` reports the raw per-quest flag bag and one flat journal, so the
    // `know:` set and the entry count are derived here rather than read off a convenience field.
    // Reading a field that does not exist is how the first version of this leg reported
    // `knows: []` while the engine was in fact writing the reveal.
    const knows = async () => {
      const st = await handle.h('getQuestState');
      const r = (st.active || []).find((x) => x.id === c.quest);
      const flags = (r && r.flags) || {};
      return {
        knows: Object.keys(flags).filter((k) => k.startsWith('know:')).map((k) => k.slice(5)).sort(),
        entries: (st.journal || []).filter((e) => e.quest === c.quest).length,
        indices: (st.journal || []).filter((e) => e.quest === c.quest).map((e) => e.n),
      };
    };

    // ---- CONTROL 2: the quest is NOT open. Talk to the right person; nothing may be learned.
    const beforeAnything = await knows();
    if (beforeAnything.knows.includes(row.reveal)) { rec.error = 'the reveal was already known before anything happened'; cases.push(rec); continue; }
    await handle.h('talkTo', row.source);
    const afterUnopened = await knows();
    rec.control_quest_not_open_learned = afterUnopened.knows.includes(row.reveal);

    // ---- the quest is opened. DECLARED GRANT: the offer gate is not what is under test.
    let opened = await handle.h('questOpen', c.quest);
    // The topic gate. Declared grant: only the `opens_by` topics this quest itself names, and
    // only when the refusal names them. Nothing else about the gate is touched.
    if (!(opened && opened.ok) && /topic "/.test(String(opened && opened.reason || ''))) {
      const topics = [...new Set([c.topic, ...(c.prereqTopics || [])].filter(Boolean))];
      for (const t of topics) await handle.h('learnTopic', t);
      rec.topics_granted = topics;
      opened = await handle.h('questOpen', c.quest);
    }
    rec.opened = !!(opened && opened.ok);
    if (!rec.opened) {
      // The OFFER gate refused. That is a real property of this character and this world state
      // and it belongs to `mainline-findability.mjs`; it is not evidence about the reveal route
      // either way, so the leg is SKIPPED with the refusal printed rather than scored red.
      rec.open_refusal = opened && opened.reason;
      rec.skipped = `the offer gate refused: ${rec.open_refusal}`;
      cases.push(rec); continue;
    }
    const before = await knows();
    rec.knows_before = before.knows;
    rec.journal_entries_before = before.entries;

    // ---- THE ACT, and the only one.
    const st = await handle.h('talkTo', row.source);
    rec.talk_reported = st && st.learned ? { learned: (st.learned.learned || []).map((x) => x.reveal), journal: st.learned.journal || [] } : null;
    const after = await knows();
    rec.knows_after = after.knows;
    rec.journal_entries_after = after.entries;
    rec.journal_indices_before = before.indices;
    rec.journal_indices_after = after.indices;
    rec.learned_by_talking = !before.knows.includes(row.reveal) && after.knows.includes(row.reveal);
    rec.journal_written = row.journal == null ? null : (after.entries > before.entries);

    // ---- CONTROL 1: the wrong person. A fresh run, the quest open, talk to somebody else.
    await handle.h('reset');
    await walkTo(row.source);
    await handle.h('questOpen', c.quest);
    const other = await handle.page.evaluate((id) => {
      const list = (window.__HARNESS.listNPCs() || []).map((n) => n.eid || n.id).filter((x) => x && x !== id);
      return list[0] || null;
    }, row.source);
    if (other) {
      await handle.h('talkTo', other);
      const afterWrong = await knows();
      rec.control_wrong_person = other;
      rec.control_wrong_person_learned = afterWrong.knows.includes(row.reveal);
    } else {
      rec.control_wrong_person = null;
    }

    rec.passed = !!rec.opened && rec.learned_by_talking
      && rec.control_quest_not_open_learned === false
      && rec.control_wrong_person_learned !== true
      && (row.journal == null || rec.journal_written === true);
    cases.push(rec);
  }
} finally {
  await handle.close();
}

const run = cases.filter((c) => !c.skipped && !c.error);
const report = {
  schema: 'elder-souls/reveal-route-world@1',
  generated_by: 'tools/quests/reveal-route-world.mjs',
  // RULES.md rule 12.
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  build: handle.buildInfo || null,
  act: 'talkTo(npcId) — nothing else',
  declared_grants: ['questOpen + learnTopic (the offer gate is not what is measured here; only the opens_by topics a refusal named)', `walked into: ${[...walkedTo].sort().join(', ') || '(nowhere)'} — populateSettlement/populateSite, each read off the person's own record, nobody spawned from nothing`],
  prohibited_and_unused: PROHIBITED,
  candidates_total: candidates.length,
  cases,
  cases_run: run.length,
  cases_skipped: cases.filter((c) => c.skipped).map((c) => ({ quest: c.quest, npc: c.npc, why: c.skipped })),
  all_pass: run.length > 0 && run.every((c) => c.passed),
};

const out = args.out ? path.resolve(String(args.out)) : path.join(ROOT, 'reports/runs/W1-18-R2/reveal-route-world.json');
ensureDir(path.dirname(out));
writeJson(out, report);

console.log(`\nreveal-route-world — does TALKING produce the reveal, in the running game?\n`);
console.log(`  the only act .............. talkTo(npcId)`);
console.log(`  declared grants ........... ${report.declared_grants.join('; ')}`);
console.log(`  candidates in the data .... ${candidates.length}`);
for (const c of cases) {
  if (c.skipped) { console.log(`  ${c.quest.padEnd(11)} ${c.npc.padEnd(26)} SKIPPED — ${c.skipped}`); continue; }
  if (c.error) { console.log(`  ${c.quest.padEnd(11)} ${c.npc.padEnd(26)} ERROR — ${c.error}`); continue; }
  console.log(`  ${c.quest.padEnd(11)} talk to ${c.npc}`);
  console.log(`      quest opened ......................... ${c.opened}${c.opened ? '' : '   (' + c.open_refusal + ')'}`);
  console.log(`      knows BEFORE ......................... [${c.knows_before.join(', ')}]`);
  console.log(`      knows AFTER .......................... [${c.knows_after.join(', ')}]`);
  console.log(`      learned "${c.reveal}" by talking ... ${c.learned_by_talking}`);
  console.log(`      journal [${(c.journal_indices_before || []).join(', ')}] -> [${(c.journal_indices_after || []).join(', ')}]   (the file declares entry ${c.journal_declared} for this reveal)`);
  console.log(`      CONTROL quest not open, same person .. learned=${c.control_quest_not_open_learned}  (must be false)`);
  console.log(`      CONTROL wrong person (${String(c.control_wrong_person).slice(0, 24)}) . learned=${c.control_wrong_person_learned}  (must be false)`);
  console.log(`      ${c.passed ? 'PASS' : 'FAIL'}`);
}
console.log(`\n  cases run ................. ${report.cases_run}`);
console.log(`  every case passes ......... ${report.all_pass}`);
console.log(`\nwrote ${path.relative(ROOT, out)}`);
process.exit(report.all_pass ? 0 : 1);
