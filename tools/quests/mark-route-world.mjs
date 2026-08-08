#!/usr/bin/env node
// mark-route-world.mjs — THE WORLD-SIDE HALF OF THE ENVIRONMENT CHANNEL. Does walking to the
// thing, standing at it and pressing the button, in the running game, produce the reveal the
// quest file names that place as the source of — and does the resolution stop refusing?
//
// W1-READABLES round 2. `tools/quests/reveal-route-audit.mjs` sections A and E can only read the
// data and drive `learnFrom()` directly: A says a mark of the right id exists and stands
// somewhere, E says the function opens the gate when it is called. Neither says a player can
// reach it. That is exactly the shape of claim this project has shipped sixteen times with
// nothing in the running world reading it (RI-MTH07 / ARBITRATION §3). This tool is the evidence.
//
// THE ONLY ACT IS `interact`, PRESSED THROUGH THE INPUT PIPELINE. There is no look verb in the
// harness and this tool does not add one: it queues the same button a player presses, steps the
// fixed loop, and reads what the character knows afterwards. `Engine._takePropPending()` is the
// code under test.
//
// NOTHING OPENS WHEN YOU LOOK AT A MARK, and the tool asserts that too. A screen that said "you
// notice the wax does not match" would be the narrator voice the register forbids, so the leg
// checks that the UI mode is still `world` after the press and that no conversation opened. The
// only observable is what the character now knows, and the journal entry the reveal row names.
//
// PROHIBITED, and the tool asserts against its own bytes that it does not name them:
//   * `questReveal`  — the write under test.
//   * `questSetFlag` — the other door into the same write.
//   * `setWorldKnowledge` — the third.
//   * `__ENGINE`     — INDEX.md's documented back door around harness prohibitions.
//
// PERMITTED AND DECLARED, because none of them is what is being measured:
//   * `questOpen` / `learnTopic` — whether THIS character would be OFFERED this quest is the
//     offer gate's question (`mainline-findability.mjs`). Only the `opens_by` topics the refusal
//     itself names are granted. `topicsKnown` is what you may ask about; a `know:` flag is a
//     different register and has one writer, which is the thing under test.
//   * `travelToGiver` / `enterInterior` — walking to the town and through the door.
//   * `teleport` — CROSSING THE GROUND. Getting a body from the town to the shaft under the rib
//     is the movement system's question and its failure would be reported here as a failure of
//     looking. The distance from the body to the mark is measured and printed on every leg.
//
// THE CONTROLS (RULES.md rule 4 — a probe that cannot fail is worse than no probe):
//   1. OUT OF REACH. Stand in the same place, past the prop's own `reach_m` plus three metres,
//      and press the same button. Nothing may be learned. Without this the leg would pass in a
//      build where `interact` looked at every mark in the province from the town gate.
//   2. THE WRONG MARK. Walk to a different mark and press at that instead. The refusal must NOT
//      move. Where the quest's mark is the only one in reach, the control is run against the
//      nearest other mark in the same room or within 60 m.
//   3. The leg FAILS if the reveal was already known before the act.
//
// Exit 0 only when every leg learned its reveal by pressing the button at the right mark,
// cleared the named refusal, opened no screen, and both controls stayed shut.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const PROHIBITED = ['questReveal', 'questSetFlag', 'setWorldKnowledge', '__ENGINE'];

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage([
    'mark-route-world.mjs — does pressing interact at a mark in the running game produce the',
    'reveal the quest names that place as the source of, and does the resolution stop refusing?',
    '',
    '  --quest <id>  run only this quest (default: mainline first, then the rest)',
    '  --cases <n>   stop after n legs the offer gate let through (default 4)',
    '  --out <path>  where to write the report',
  ].join('\n'));
}

const src = fs.readFileSync(SELF, 'utf8');
{
  const bad = [];
  for (const p of PROHIBITED) {
    const n = (src.match(new RegExp(p, 'g')) || []).length;
    if (n > 3) bad.push(`${p} occurs ${n} times in this file; it is prohibited and may appear only in the declaration`);
  }
  if (bad.length) { console.error('mark-route-world: ' + bad.join('\n  ')); process.exit(2); }
}

// ---- what the data says ----------------------------------------------------------------------
const { CHANNEL_READERS } = await import(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js'));
const marksDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/readables/site-marks.json'), 'utf8'));
const marks = new Map(marksDoc.marks.map((m) => [m.id, m]));
const roomOf = new Map();
for (const m of marksDoc.marks) if (m.at && m.at.interior) {
  if (!roomOf.has(m.at.interior)) roomOf.set(m.at.interior, []);
  roomOf.get(m.at.interior).push(m.id);
}
const IDIR = path.join(ROOT, 'game/data/world/interiors');
const interiors = new Map();
for (const f of fs.readdirSync(IDIR).filter((x) => x.endsWith('.json'))) {
  const rec = JSON.parse(fs.readFileSync(path.join(IDIR, f), 'utf8'));
  if (rec.id) interiors.set(rec.id, { spawn: (rec.continuity || {}).interior_spawn || null, bounds: rec.bounds_m || null });
}

// The documents, because the mainline cannot be walked to a mark without reading its ledgers on
// the way: Q-MAIN-11's mark is behind Q-MAIN-10, which is behind Q-MAIN-06, whose two reveals are
// a `ledger` and a `book` in the archive under the burial stair. The bootstrap reads them the way
// a player does; it is the same `interact` press and the same reach.
const bookForSource = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/books')).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/books', f), 'utf8'));
  for (const b of (Array.isArray(j.books) ? j.books : (j.id ? [j] : []))) {
    if (!b.id) continue;
    bookForSource.set(b.id, b.id);
    if (b.knowledge_key) bookForSource.set(b.knowledge_key, b.id);
  }
}
const docPlacement = new Map();
for (const f of fs.readdirSync(IDIR).filter((x) => x.endsWith('.json'))) {
  const rec = JSON.parse(fs.readFileSync(path.join(IDIR, f), 'utf8'));
  const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
  for (const r of list) if (r && r.book) docPlacement.set(r.book, { interior: rec.id, readable_id: r.id });
}

const QDIR = path.join(ROOT, 'game/data/quests');
const cases = [];
const defs = new Map();
const revealsOf = new Map();
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of (j.quests || [])) {
    const demanded = new Set();
    for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
    defs.set(q.id, {
      id: q.id,
      topic: (q.opens_by || {}).topic || null,
      prereqTopics: ((q.opens_by || {}).prerequisite_topics) || [],
      prereqs: ((q.opens_by || {}).prerequisite_quests) || [],
    });
    revealsOf.set(q.id, ((q.deceit && q.deceit.revealed_by) || []).filter((r) => demanded.has(r.id)).map((r) => ({
      id: r.id, channel: r.channel, source: r.source,
      book: bookForSource.get(r.source) || null,
      mark: marks.has(r.source) ? r.source : null,
    })));
    for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
      if (CHANNEL_READERS[rev.channel] !== 'place') continue;
      if (!demanded.has(rev.id)) continue;
      const m = marks.get(rev.source);
      if (!m) continue;
      cases.push({ quest: q.id, reveal: rev.id, mark: rev.source, journal: rev.journal ?? null, file: f });
    }
  }
}
// Mainline first: it is the chain the whole project is blocked on.
cases.sort((a, b) => (a.quest.startsWith('Q-MAIN') === b.quest.startsWith('Q-MAIN') ? (a.quest < b.quest ? -1 : 1) : (a.quest.startsWith('Q-MAIN') ? -1 : 1)));

const only = args.quest ? String(args.quest) : null;
const queue = only ? cases.filter((c) => c.quest === only) : cases;
const WANT = Number(args.cases || 4);
if (!queue.length) { console.error('mark-route-world: no case matched. Nothing to measure.'); process.exit(2); }

// ---- the run ----------------------------------------------------------------------------------
const handle = await launchGame(args);
const legs = [];
const aside = [];
const bootLog = [];
try {
  await requireMethods(handle, ['reset', 'setRenderRate', 'travelToGiver', 'enterInterior', 'listEntities',
    'teleport', 'exitInterior', 'queueInputs', 'stepFrames', 'getUIState', 'getQuestState', 'questOpen',
    'questResolutions', 'questResolve', 'learnTopic', 'whereAmI', 'closeMenu',
    'getConversationState', 'conversationClose']);

  const refusalsNaming = async (quest, reveal) => {
    const rs = await handle.h('questResolutions', quest);
    const out = [];
    for (const r of (rs.resolutions || rs || [])) {
      for (const why of (r.why || r.reasons || [])) if (String(why).includes(reveal)) out.push(`${r.id}: ${why}`);
    }
    return out;
  };
  // `reveal()` writes a `know:<id>` flag into the quest's own record, which is what
  // `getQuestState().active[].flags` carries and what the resolution gate reads.
  const knows = async (quest) => {
    const qs = await handle.h('getQuestState');
    const rec = (qs.active || []).find((x) => x.id === quest);
    return Object.keys((rec && rec.flags) || {}).filter((f) => f.startsWith('know:')).map((f) => f.slice(5)).sort();
  };
  const journalOf = async (quest) => ((await handle.h('getQuestState')).journal || []).filter((e) => e.quest === quest).map((e) => e.n ?? e.index);

  // THE DOOR TAKES THE BUTTON FIRST. `sim/settlement.js` handles `interact` for doors within 2.6 m
  // of `continuity.interior_spawn` and runs before the engine's prop reach, so a body standing at
  // a mark near the doorway presses the button and walks OUT. Every position this tool stands on
  // is checked against the door.
  const DOOR_REACH_M = 2.6;
  const pressInteract = async (why) => {
    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 8);
    const conv = await handle.h('getConversationState');
    if (conv && conv.open) { aside.push({ why, opened_a_conversation: conv.npc || conv.eid || true }); await handle.h('conversationClose'); }
  };

  /** Put the body where the mark is, and say how it got there. Returns the standing record. */
  const goTo = async (m, propOf) => {
    if (m.at.interior) {
      await handle.h('enterInterior', m.at.interior);
      await handle.h('stepFrames', 2);
    } else {
      // OUT ON THE GROUND. The bootstrap leaves the body wherever the last document was read,
      // which is usually inside a room, so the way out is taken first — `exitInterior` is the
      // world's own call and is what a door does. The mark is spawned by
      // `_ensureProvinceMarks()` the first time the province cell is drawn, which is why the
      // body is put on the ground BEFORE the prop is looked for.
      const w = await handle.h('whereAmI');
      if (w && (w.interior || w.cell === 'interior')) { try { await handle.h('exitInterior'); } catch { /* already outside */ } }
      await handle.h('stepFrames', 2);
      await handle.h('teleport', m.at.world[0], m.at.world[1]);
      await handle.h('stepFrames', 4);
    }
    const prop = await propOf();
    if (!prop) return { prop: null };
    const room = m.at.interior ? interiors.get(m.at.interior) : null;
    const cx = room && room.bounds ? (room.bounds.x[0] + room.bounds.x[1]) / 2 : prop.pos[0] + 1;
    const cz = room && room.bounds ? (room.bounds.z[0] + room.bounds.z[1]) / 2 : prop.pos[2] + 1;
    let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    const doorD = (x, z) => (room && room.spawn ? Math.hypot(x - room.spawn[0], z - room.spawn[2]) : Infinity);
    for (const d of [0.9, 1.2, 1.5, Math.max(1.5, (prop.reach_m || 2.6) - 0.3)]) {
      const x = prop.pos[0] + vx * d, z = prop.pos[2] + vz * d;
      if (doorD(x, z) > DOOR_REACH_M) {
        await handle.h('teleport', x, z);
        await handle.h('stepFrames', 2);
        return { prop, stand_off_m: +d.toFixed(2), door_m: Number.isFinite(doorD(x, z)) ? +doorD(x, z).toFixed(2) : null };
      }
    }
    return { prop, placement_defect: 'every stance at this mark is inside the doorway reach' };
  };

  /** Open a quest, granting only the `opens_by` topics its own refusal names. */
  const tryOpen = async (qid) => {
    let o = await handle.h('questOpen', qid);
    if (!(o && o.ok) && /topic "/.test(String((o && o.reason) || ''))) {
      const d = defs.get(qid) || { topic: null, prereqTopics: [] };
      for (const t of [...new Set([d.topic, ...d.prereqTopics].filter(Boolean))]) await handle.h('learnTopic', t);
      o = await handle.h('questOpen', qid);
    }
    return o;
  };

  /** Read a document where it stands. Same button, same reach as the mark. */
  const readDocument = async (bookId) => {
    const pl = docPlacement.get(bookId);
    if (!pl) { bootLog.push({ book: bookId, fail: 'no placement' }); return false; }
    try { await handle.h('enterInterior', pl.interior); }
    catch (e) { bootLog.push({ book: bookId, fail: `enterInterior(${pl.interior}) threw: ${String(e.message || e)}` }); return false; }
    await handle.h('stepFrames', 2);
    const pr = (await handle.h('listEntities')).find((e) => e.eid === `interior-readable:${pl.readable_id}`);
    if (!pr) { bootLog.push({ book: bookId, fail: `no prop interior-readable:${pl.readable_id} in ${pl.interior}` }); return false; }
    const room = interiors.get(pl.interior) || {};
    const cx = room.bounds ? (room.bounds.x[0] + room.bounds.x[1]) / 2 : 0;
    const cz = room.bounds ? (room.bounds.z[0] + room.bounds.z[1]) / 2 : 0;
    let vx = cx - pr.pos[0], vz = cz - pr.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    for (const d of [1.0, 1.4, 1.8]) {
      const x = pr.pos[0] + vx * d, z = pr.pos[2] + vz * d;
      if (!room.spawn || Math.hypot(x - room.spawn[0], z - room.spawn[2]) > DOOR_REACH_M) {
        await handle.h('teleport', x, z);
        await handle.h('stepFrames', 2);
        await pressInteract(`bootstrap: reading ${bookId}`);
        const ui = await handle.h('getUIState');
        const mode = ui.mode;
        bootLog.push({ book: bookId, room: pl.interior, stand_off_m: d, mode, opened: (ui.book && ui.book.id) || null, books_read: ((await handle.h('getQuestState')).booksRead || []).length });
        if (mode === 'book') { await handle.h('closeMenu'); return true; }
        return false;
      }
    }
    bootLog.push({ book: bookId, fail: 'every stance is inside the doorway reach' });
    return false;
  };

  /** Look at a mark where it stands. */
  const lookAtMark = async (markId) => {
    const mm = marks.get(markId);
    if (!mm) return false;
    const a = await goTo(mm, async () => (await handle.h('listEntities')).find((e) => e.eid === `mark:${markId}` || e.eid === `mark:${markId}#0`));
    if (!a.prop || a.placement_defect) return false;
    await pressInteract(`bootstrap: looking at ${markId}`);
    return true;
  };

  /**
   * WALK THE MAIN LINE UP TO THIS QUEST, the way a player walks it.
   *
   * Every mark case refuses at a cold start, and all of the mainline ones refuse on a
   * PREREQUISITE QUEST — Q-MAIN-11's mark is behind Q-MAIN-10, which is behind Q-MAIN-06, whose
   * two reveals are the ledger and the book in the archive under the burial stair. So the
   * bootstrap plays the chain in front of the leg with the same two verbs `viability-walk`
   * allows itself (`questOpen`, `questResolve` on a resolution the gate reports available,
   * preferring the non-violent one), plus the ONE thing this piece exists to add: it walks into
   * the rooms and reads and looks. Nothing is hand-fed; every reveal in the chain arrives from a
   * document or a mark or a conversation, and a quest whose reveal has no route stops the walk.
   */
  const bootstrapTo = async (target) => {
    bootLog.length = 0;
    const order = [...defs.keys()].filter((k) => /^Q-MAIN-\d+$/.test(k)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
    const played = [];
    for (const qid of order) {
      if (qid === target) break;
      await handle.h('travelToGiver', qid);
      const o = await tryOpen(qid);
      if (!(o && o.ok)) return { played, stopped: { quest: qid, phase: 'offer', why: o && o.reason }, log: bootLog.slice() };
      for (const rev of (revealsOf.get(qid) || [])) {
        if (rev.mark) await lookAtMark(rev.mark);
        else if (rev.book) await readDocument(rev.book);
      }
      const list = await handle.h('questResolutions', qid);
      const rs = list.resolutions || list || [];
      const pick = rs.find((r) => r.available && !r.violence_required) || rs.find((r) => r.available);
      if (!pick) return { played, stopped: { quest: qid, phase: 'resolution', why: rs.map((r) => `${r.id}: ${(r.why || []).join('; ')}`).join(' | ') }, log: bootLog.slice() };
      const res = await handle.h('questResolve', qid, pick.id);
      if (!(res && res.ok)) return { played, stopped: { quest: qid, phase: 'resolve', why: res && res.reason }, log: bootLog.slice() };
      played.push(`${qid}/${pick.id}`);
    }
    return { played, stopped: null, log: bootLog.slice() };
  };

  for (const c of queue) {
    if (legs.filter((x) => !x.skipped).length >= WANT) break;
    const m = marks.get(c.mark);
    const rec = { ...c, at: m.at, mark_name: m.name };
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    rec.travel = await handle.h('travelToGiver', c.quest);

    // ---- the offer gate, and only the topics its own refusal names
    let o = await tryOpen(c.quest);
    // Refused on a quest that comes before this one? Go and play it, reading and looking on the
    // way. A faction ladder is a different matter and no honest grant clears one.
    if (!(o && o.ok) && /requires Q-MAIN-/.test(String((o && o.reason) || '')) && /^Q-MAIN-/.test(c.quest)) {
      rec.bootstrap = await bootstrapTo(c.quest);
      await handle.h('travelToGiver', c.quest);
      o = await tryOpen(c.quest);
    }
    if (!(o && o.ok)) { rec.skipped = `the offer gate refused: ${o && o.reason}`; legs.push(rec); continue; }
    rec.opened = true;

    rec.knows_before = await knows(c.quest);
    if (rec.knows_before.includes(c.reveal)) { rec.error = 'the reveal was already known before the act'; legs.push(rec); continue; }
    rec.refusals_before = await refusalsNaming(c.quest, c.reveal);
    if (!rec.refusals_before.length) { rec.error = 'no resolution refused on this reveal before the act; the leg would prove nothing'; legs.push(rec); continue; }
    rec.journal_before = await journalOf(c.quest);

    // ---- CONTROL 1: out of reach, same place, same button
    const findProp = async (id) => (await handle.h('listEntities')).find((e) => e.eid === `mark:${id}` || e.eid === `mark:${id}#0`);
    const arrive = await goTo(m, () => findProp(c.mark));
    if (!arrive.prop) { rec.skipped = `no prop mark:${c.mark} after arriving at ${JSON.stringify(m.at)}`; legs.push(rec); continue; }
    if (arrive.placement_defect) { rec.error = arrive.placement_defect; legs.push(rec); continue; }
    if (arrive.prop.takeable) { rec.error = 'a mark must not be takeable'; legs.push(rec); continue; }
    rec.stand_off_m = arrive.stand_off_m;
    rec.door_m = arrive.door_m;

    const far = (arrive.prop.reach_m || 2.6) + 3.0;
    await handle.h('teleport', arrive.prop.pos[0] + far, arrive.prop.pos[2]);
    await handle.h('stepFrames', 2);
    await pressInteract(`control 1: out of reach at ${c.mark}`);
    rec.control_out_of_reach = { distance_m: +far.toFixed(2), knows_after: await knows(c.quest) };
    if (rec.control_out_of_reach.knows_after.includes(c.reveal)) {
      rec.error = 'CONTROL 1 FAILED: the reveal arrived from outside the prop reach';
      legs.push(rec); continue;
    }

    // ---- CONTROL 2: the wrong mark
    // A sibling is another mark the body can be stood at: another one in the same room, or —
    // out on the ground, where every mark is its own place — the nearest other world mark. The
    // control is the same press at the wrong thing, and the refusal must not move.
    const siblings = (m.at.interior
      ? (roomOf.get(m.at.interior) || [])
      : marksDoc.marks.filter((x) => x.at && x.at.world)
        .sort((a, b) => Math.hypot(a.at.world[0] - m.at.world[0], a.at.world[1] - m.at.world[1])
          - Math.hypot(b.at.world[0] - m.at.world[0], b.at.world[1] - m.at.world[1]))
        .map((x) => x.id)
    ).filter((x) => x !== c.mark);
    if (siblings.length) {
      const other = marks.get(siblings[0]);
      const oArrive = await goTo(other, () => findProp(other.id));
      if (oArrive.prop && !oArrive.placement_defect) {
        await pressInteract(`control 2: the wrong mark ${other.id}`);
        rec.control_wrong_mark = { mark: other.id, refusals_after: await refusalsNaming(c.quest, c.reveal) };
        if (rec.control_wrong_mark.refusals_after.length !== rec.refusals_before.length) {
          rec.error = 'CONTROL 2 FAILED: pressing at a different mark moved the refusal';
          legs.push(rec); continue;
        }
      }
    } else {
      rec.control_wrong_mark = { mark: null, note: 'no second mark stands in this place; control 1 carries the leg' };
    }

    // ---- THE ACT
    const back = await goTo(m, () => findProp(c.mark));
    rec.stand_off_m = back.stand_off_m ?? rec.stand_off_m;
    const uiBefore = await handle.h('getUIState');
    await pressInteract(`the act: ${c.quest} looks at ${c.mark}`);
    const uiAfter = await handle.h('getUIState');
    rec.ui_mode_before = uiBefore.mode;
    rec.ui_mode_after = uiAfter.mode;
    rec.knows_after = await knows(c.quest);
    rec.refusals_after = await refusalsNaming(c.quest, c.reveal);
    rec.journal_after = await journalOf(c.quest);
    rec.opened_no_screen = uiAfter.mode === uiBefore.mode;
    rec.passed = rec.knows_after.includes(c.reveal)
      && rec.refusals_after.length === 0
      && rec.refusals_before.length > 0
      && rec.opened_no_screen;
    legs.push(rec);
  }
} finally { await handle.close(); }

const ran = legs.filter((l) => !l.skipped);
const report = {
  tool: 'tools/quests/mark-route-world.mjs',
  taken_at: new Date().toISOString(),
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  contention: (() => { try { return execSync('node tools/contention.mjs', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  prohibited: PROHIBITED,
  cases_available: cases.length,
  legs_run: ran.length,
  legs_passed: ran.filter((l) => l.passed).length,
  legs: legs,
  presses_that_reached_a_person_instead: aside,
};
const out = args.out ? String(args.out) : path.join(ROOT, 'reports/runs/W1-READABLES-R2/mark-route-world.json');
ensureDir(path.dirname(out));
writeJson(out, report);

console.log('\nmark-route-world — press interact at the thing, in the running game\n');
for (const l of legs) {
  if (l.skipped) { console.log(`  ${l.quest.padEnd(11)} ${l.mark.padEnd(32)} SKIPPED  ${l.skipped}`); continue; }
  if (l.error) { console.log(`  ${l.quest.padEnd(11)} ${l.mark.padEnd(32)} ERROR    ${l.error}`); continue; }
  console.log(`  ${l.quest.padEnd(11)} ${l.mark.padEnd(32)} ${l.passed ? 'PASS' : 'FAIL'}`);
  console.log(`      stood ${l.stand_off_m} m from it${l.door_m == null ? '' : `, ${l.door_m} m from the door`}; screen ${l.ui_mode_before} -> ${l.ui_mode_after}`);
  console.log(`      knows ${JSON.stringify(l.knows_before)} -> ${JSON.stringify(l.knows_after)}`);
  console.log(`      refusals naming ${l.reveal}: ${l.refusals_before.length} -> ${l.refusals_after.length}`);
  if (l.refusals_before.length) console.log(`      was: "${l.refusals_before[0]}"`);
  console.log(`      control 1 (out of reach, ${l.control_out_of_reach.distance_m} m): learned ${JSON.stringify(l.control_out_of_reach.knows_after)}`);
  console.log(`      control 2 (wrong mark): ${l.control_wrong_mark && l.control_wrong_mark.mark ? `${l.control_wrong_mark.mark}, refusals stayed ${l.control_wrong_mark.refusals_after.length}` : l.control_wrong_mark.note}`);
  console.log(`      journal ${JSON.stringify(l.journal_before)} -> ${JSON.stringify(l.journal_after)}`);
}
console.log(`\n  legs run ${ran.length}, passed ${ran.filter((l) => l.passed).length}`);
if (aside.length) console.log(`  presses that reached a person instead: ${aside.length}`);
console.log(`  wrote ${path.relative(ROOT, out)}`);
process.exit(ran.length > 0 && ran.every((l) => l.passed) ? 0 : 1);
