#!/usr/bin/env node
// document-route-world.mjs — THE WORLD-SIDE HALF OF THE DOCUMENT CHANNEL. Does walking into the
// room, reaching for the ledger and reading it, in the running game, produce the reveal the quest
// file names that document as the source of — and does the resolution stop refusing?
//
// W1-READABLES. `tools/quests/reveal-route-audit.mjs` section A can only read the data: it says a
// document of the right id exists and that a room names it. That is exactly the shape of claim
// this project has shipped sixteen times with nothing in the running world reading it
// (RI-MTH07 / ARBITRATION §3), so it is not evidence on its own. This tool is the evidence.
//
// THE ONLY ACT IS `interact`, PRESSED THROUGH THE INPUT PIPELINE. There is no read verb in the
// harness and this tool does not add one: it queues the same button a player presses, steps the
// fixed loop, and reads what came up on the screen. `Engine._takePropPending()` is the code under
// test and `UISystem.open('book')` -> `Engine._readBook()` is the reader it hands off to.
//
// PROHIBITED, and the tool asserts against its own bytes that it does not name them:
//   * `openMenu`     — the HARNESS door into the book screen. Calling it would skip the object,
//                      the room and the reach, which are the three things being measured.
//   * `questReveal`  — the write under test.
//   * `questSetFlag` — the other door into the same write.
//   * `__ENGINE`     — INDEX.md's documented back door around harness prohibitions.
//
// PERMITTED AND DECLARED, because none of them is what is being measured:
//   * `questOpen` / `learnTopic` — whether THIS character would be OFFERED this quest is the
//     offer gate's question (`mainline-findability.mjs`). Only the `opens_by` topics the refusal
//     itself names are granted. Neither touches knowledge: `topicsKnown` is what you may ask
//     about, and a `know:` flag is a different register.
//   * `travelToGiver` / `enterInterior` — walking to the town and through the door. The world's
//     own calls; the settlement comes out of the giver's own record and the interior out of the
//     placement file.
//   * `teleport` — CROSSING THE ROOM. Getting a body from the doorway to the shelf is the
//     movement and collision systems' question and a failure of it would be reported here as a
//     failure of reading. The distance from the body to the document is measured and printed on
//     every leg, and the OUT-OF-REACH CONTROL is run at a distance this tool did not choose: the
//     prop's own `reach_m` plus three metres.
//
// THE CONTROLS (RULES.md rule 4 — a probe that cannot fail is worse than no probe):
//   1. OUT OF REACH. Stand in the same room, past the prop's own reach, and press the same
//      button. Nothing may open and nothing may be learned. Without this the leg would pass in a
//      build where `interact` read every document in the province from the doorway.
//   2. THE WRONG DOCUMENT. Read a different book off the same shelf. The refusal must NOT move.
//   3. The leg FAILS if the reveal was already known, or the book already read, before the act.
//
// Exit 0 only when every leg opened the right document by pressing the button, learned its
// reveal, cleared the named refusal, and both controls stayed shut.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const PROHIBITED = ['openMenu', 'questReveal', 'questSetFlag', '__ENGINE'];

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage([
    'document-route-world.mjs — does reaching for a ledger in the running game produce the',
    'reveal the quest names it as the source of, and does the resolution stop refusing?',
    '',
    '  --quest <id>  run only this quest (default: every placed document, mainline first)',
    '  --cases <n>   stop after n legs the offer gate let through (default 4)',
    '  --out <path>  where to write the report',
  ].join('\n'));
}

const src = fs.readFileSync(SELF, 'utf8');
{
  const bad = [];
  for (const p of PROHIBITED) {
    // twice in the prose above, once in the PROHIBITED list, once in this loop's message.
    const n = (src.match(new RegExp(p, 'g')) || []).length;
    if (n > 4) bad.push(`${p} occurs ${n} times in this file; it is prohibited and may appear only in the declaration`);
  }
  if (bad.length) { console.error('document-route-world: ' + bad.join('\n  ')); process.exit(2); }
}

// ---- what the data says ----------------------------------------------------------------------
const { DOCUMENT_CHANNELS } = await import(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js'));

const bookForSource = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/books')).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/books', f), 'utf8'));
  for (const b of (Array.isArray(j.books) ? j.books : (j.id ? [j] : []))) {
    if (!b.id) continue;
    bookForSource.set(b.id, b.id);
    if (b.knowledge_key) bookForSource.set(b.knowledge_key, b.id);
  }
}
// book id -> { interior, readableId, title }, and the other documents on the same shelf, which is
// where control 2 gets its wrong document from.
const placement = new Map();
const shelf = new Map();
const IDIR = path.join(ROOT, 'game/data/world/interiors');
for (const f of fs.readdirSync(IDIR).filter((x) => x.endsWith('.json'))) {
  const rec = JSON.parse(fs.readFileSync(path.join(IDIR, f), 'utf8'));
  const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
  const withBooks = list.filter((r) => r && r.book);
  for (const r of withBooks) placement.set(r.book, {
    interior: rec.id, readable_id: r.id, title: r.title,
    spawn: (rec.continuity && rec.continuity.interior_spawn) || null,
    bounds: rec.bounds_m || null,
  });
  if (withBooks.length) shelf.set(rec.id, withBooks.map((r) => ({ book: r.book, readable_id: r.id })));
}

// W1-READABLES round 2 — the MARKS, so the chain arm can also look at the things the
// `environment` channel names. Same shape as `placement` above: a source id and a place.
const marksDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/readables/site-marks.json'), 'utf8'));
const marks = new Map(marksDoc.marks.map((m) => [m.id, m]));

const QDIR = path.join(ROOT, 'game/data/quests');
const cases = [];
const defs = new Map();
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of (j.quests || [])) {
    const demanded = new Set();
    for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
    defs.set(q.id, {
      id: q.id,
      prereqs: (q.opens_by && q.opens_by.prerequisite_quests) || [],
      topic: (q.opens_by && q.opens_by.topic) || null,
      prereqTopics: (q.opens_by && q.opens_by.prerequisite_topics) || [],
      // the documents THIS quest's own resolutions demand, so a prerequisite can be finished the
      // way a player finishes it: by reading them.
      docs: ((q.deceit && q.deceit.revealed_by) || [])
        .filter((rev) => DOCUMENT_CHANNELS.has(rev.channel) && demanded.has(rev.id) && bookForSource.get(rev.source))
        .map((rev) => ({ reveal: rev.id, book: bookForSource.get(rev.source) })),
      // W1-READABLES round 2 — and the MARKS its resolutions demand, for the same reason.
      marks: ((q.deceit && q.deceit.revealed_by) || [])
        .filter((rev) => rev.channel === 'environment' && demanded.has(rev.id) && marks.has(rev.source))
        .map((rev) => ({ reveal: rev.id, mark: rev.source })),
    });
  }
}
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of (j.quests || [])) {
    const demanded = new Set();
    for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
    for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
      if (!DOCUMENT_CHANNELS.has(rev.channel) || !rev.source || !demanded.has(rev.id)) continue;
      const book = bookForSource.get(rev.source);
      const place = book && placement.get(book);
      if (!place) continue;
      cases.push({
        quest: q.id, reveal: rev.id, channel: rev.channel, source: rev.source, book,
        interior: place.interior, readable_id: place.readable_id, title: place.title,
        spawn: place.spawn, bounds: place.bounds,
        topic: (q.opens_by && q.opens_by.topic) || null,
        prereqTopics: (q.opens_by && q.opens_by.prerequisite_topics) || [],
        // Cheapest to accept first, so the browser is spent on legs the offer gate lets through.
        cost: ((q.opens_by && q.opens_by.prerequisite_quests) || []).length + (q.rank_gate ? 10 : 0),
      });
    }
  }
}
// Q-MAIN-06 first, always: it is the quest all 40 walked signatures stop at.
cases.sort((a, b) => (a.quest === 'Q-MAIN-06' ? -1 : b.quest === 'Q-MAIN-06' ? 1 : 0)
  || (a.cost - b.cost) || (a.quest < b.quest ? -1 : 1));
const only = args.quest ? String(args.quest) : null;
const queue = only ? cases.filter((c) => c.quest === only) : cases;
if (!queue.length) { console.error('document-route-world: no placed document is the source of a demanded reveal. Nothing to measure.'); process.exit(2); }
const WANT = Number(args.cases || 4);

// ---- the run ----------------------------------------------------------------------------------
const CHAIN_MODE = !!args.chain;
const handle = await launchGame(args);
const legs = [];
const aside = [];
try {
  await requireMethods(handle, ['reset', 'setRenderRate', 'travelToGiver', 'enterInterior', 'listEntities',
    'teleport', 'exitInterior', 'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'getQuestState',
    'questOpen', 'questResolutions', 'learnTopic', 'whereAmI', 'getConversationState', 'conversationClose', 'listNPCs']);

  /** The refusals of every resolution of this quest that name this reveal, by name. */
  const refusalsNaming = async (quest, reveal) => {
    const rs = await handle.h('questResolutions', quest);
    const out = [];
    for (const r of (rs.resolutions || rs || [])) {
      for (const why of (r.why || r.reasons || [])) if (String(why).includes(reveal)) out.push(`${r.id}: ${why}`);
    }
    return out;
  };
  const booksRead = async () => ((await handle.h('getQuestState')).booksRead || []);
  const uiMode = async () => {
    const u = await handle.h('getUIState');
    return { mode: u.mode, book: (u.book && u.book.id) || null };
  };
  // THE DOOR TAKES THE BUTTON FIRST. `sim/settlement.js` handles `interact` for doors within
  // `DOOR_REACH_M` = 2.6 m of `continuity.interior_spawn`, and it runs before the engine's prop
  // reach. So a body standing at a document that happens to sit near the doorway presses the
  // button and walks OUT of the room, and a leg that did not know that would read the empty
  // screen afterwards as "reading does not work". Every position this tool stands on is checked
  // against the door first, and a document that cannot be stood at without the door in reach is
  // reported as a PLACEMENT DEFECT rather than a reading failure.
  const DOOR_REACH_M = 2.6;
  const doorDist = (c, x, z) => (c.spawn ? Math.hypot(x - c.spawn[0], z - c.spawn[2]) : Infinity);
  /** 1 m from the document, on the side facing into the room, and clear of the door. */
  const standAt = (c, prop) => {
    const cx = c.bounds ? (c.bounds.x[0] + c.bounds.x[1]) / 2 : 0;
    const cz = c.bounds ? (c.bounds.z[0] + c.bounds.z[1]) / 2 : 0;
    let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    for (const d of [1.0, 1.4, 1.8, Math.max(1.8, prop.reach_m - 0.2)]) {
      const x = prop.pos[0] + vx * d, z = prop.pos[2] + vz * d;
      if (doorDist(c, x, z) > DOOR_REACH_M) return { x, z, off_m: d, door_m: +doorDist(c, x, z).toFixed(2) };
    }
    return null;
  };

  /**
   * Press the button a player presses, and let the deferred half of the step run.
   *
   * `interact` is ONE BUTTON with several things it can reach, and the two that are not a
   * document have to be cleaned up or the next press never gets to the world at all: a
   * conversation swallows every later press (`if (this.conversation.open) return`), and so does
   * an open screen. Both are reported on the leg rather than swallowed, because a press that
   * greeted an archivist instead of reading a ledger is a fact about the room.
   */
  const pressInteract = async (why) => {
    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 8);
    const conv = await handle.h('getConversationState');
    if (conv && conv.open) { aside.push({ why, opened_a_conversation: conv.npc || conv.eid || true }); await handle.h('conversationClose'); }
  };

  // ---- --chain: HOW FAR DOES THE MAIN LINE GO IF READING IS ALLOWED? ------------------------
  //
  // `tools/quests/viability-walk.mjs` reports 0 of 40 signatures finishing the main quest and
  // all 40 stopping at Q-MAIN-06, and it still does after this piece — because its allow-list has
  // no reading action in it at all. It may travel, accept, talk and resolve; it may not walk into
  // a room and open a book, so the document channel is invisible to it exactly as the `book`
  // channel has been since W1-LIBRARY. That is a property of the instrument, not of the world,
  // and this arm measures the difference instead of asserting it: the same chain, the same two
  // verbs the walk allows itself (`questOpen`, `questResolve`, and only resolutions the gate
  // reports available), run twice — once permitted to read the documents, once not.
  if (CHAIN_MODE) {
    const order = [...defs.keys()].filter((k) => /^Q-MAIN-\d+$/.test(k))
      .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
    // W1-READABLES round 2 — THREE ARMS, not two. Round 1 asked whether the main line moves when
    // a player is allowed to read a ledger; this round adds the other half of the same question,
    // which is whether it moves when a player is allowed to LOOK AT A THING. The three arms are
    // the same chain, the same two verbs `viability-walk` allows itself, differing only in what
    // the body is permitted to do when it gets to the room or the ground.
    const arms = {};
    for (const mode of ['reading_and_looking', 'reading_only', 'neither']) {
      const mayRead = mode !== 'neither';
      const mayLook = mode === 'reading_and_looking';
      await handle.h('reset');
      await handle.h('setRenderRate', 0);
      const done = [], readHere = [], lookedHere = [];
      let stop = null;
      for (const qid of order) {
        const d = defs.get(qid);
        await handle.h('travelToGiver', qid);
        let o = await handle.h('questOpen', qid);
        if (!(o && o.ok) && /topic "/.test(String(o && o.reason || ''))) {
          for (const t of [...new Set([d.topic, ...d.prereqTopics].filter(Boolean))]) await handle.h('learnTopic', t);
          o = await handle.h('questOpen', qid);
        }
        if (!(o && o.ok)) { stop = { quest: qid, phase: 'offer', why: o && o.reason }; break; }
        if (mayRead) {
          for (const doc of d.docs) {
            const pl = placement.get(doc.book);
            if (!pl) continue;
            await handle.h('enterInterior', pl.interior);
            await handle.h('stepFrames', 2);
            const pr = (await handle.h('listEntities')).find((e) => e.eid === `interior-readable:${pl.readable_id}`);
            if (!pr) continue;
            const st = standAt({ spawn: pl.spawn, bounds: pl.bounds }, pr);
            if (!st) continue;
            await handle.h('teleport', st.x, st.z);
            await pressInteract(`chain mode: ${qid} needs ${doc.book}`);
            if ((await uiMode()).mode === 'book') { await handle.h('closeMenu'); readHere.push({ quest: qid, book: doc.book }); }
          }
        }
        if (mayLook) {
          for (const mk of d.marks) {
            const m = marks.get(mk.mark);
            if (!m) continue;
            if (m.at.interior) {
              await handle.h('enterInterior', m.at.interior);
              await handle.h('stepFrames', 2);
            } else {
              const w = await handle.h('whereAmI');
              if (w && w.interior) { try { await handle.h('exitInterior'); } catch { /* already outside */ } }
              await handle.h('stepFrames', 2);
              await handle.h('teleport', m.at.world[0], m.at.world[1]);
              await handle.h('stepFrames', 4);
            }
            const pr = (await handle.h('listEntities')).find((e) => e.eid === `mark:${mk.mark}` || e.eid === `mark:${mk.mark}#0`);
            if (!pr) continue;
            const room = m.at.interior ? { spawn: (placement.get('__none') || {}).spawn || null } : null;
            const cx = pr.pos[0] + 1, cz = pr.pos[2] + 1;
            let vx = cx - pr.pos[0], vz = cz - pr.pos[2];
            const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
            await handle.h('teleport', pr.pos[0] + vx * 0.9, pr.pos[2] + vz * 0.9);
            await handle.h('stepFrames', 2);
            await pressInteract(`chain mode: ${qid} needs ${mk.mark}`);
            lookedHere.push({ quest: qid, mark: mk.mark, room: m.at.interior || null });
            void room;
          }
        }
        const list = (await handle.h('questResolutions', qid));
        const rs = list.resolutions || list || [];
        const pick = rs.find((r) => r.available && !r.violence_required) || rs.find((r) => r.available);
        if (!pick) { stop = { quest: qid, phase: 'resolution', why: rs.map((r) => `${r.id}: ${(r.why || []).join('; ')}`).join(' | ') }; break; }
        const res = await handle.h('questResolve', qid, pick.id);
        if (!(res && res.ok)) { stop = { quest: qid, phase: 'resolve', why: res && res.reason }; break; }
        done.push(`${qid}/${pick.id}`);
      }
      arms[mode] = { completed: done.length, of: order.length, chain: done, documents_read: readHere, marks_looked_at: lookedHere, stopped_at: stop };
    }
    const out2 = args.out ? String(args.out) : path.join(ROOT, 'reports/runs/W1-READABLES/document-route-chain.json');
    ensureDir(path.dirname(out2));
    writeJson(out2, { tool: 'document-route-world --chain', taken_at: new Date().toISOString(), arms });
    console.log('\ndocument-route-world --chain — how far does the main line go?\n');
    for (const [k, v] of Object.entries(arms)) {
      console.log(`  ${k.padEnd(18)} ${v.completed} of ${v.of} mainline quests`);
      console.log(`      stops at ${v.stopped_at ? v.stopped_at.quest + ' [' + v.stopped_at.phase + ']' : '(finished)'}`);
      if (v.stopped_at) console.log(`      because  ${String(v.stopped_at.why).slice(0, 200)}`);
      console.log(`      read     ${v.documents_read.length} document(s), looked at ${(v.marks_looked_at || []).length} mark(s)`);
    }
    await handle.close();
    process.exit(0);
  }

  for (const c of queue) {
    if (legs.filter((x) => !x.skipped).length >= WANT) break;
    const rec = { ...c };
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    rec.travel = await handle.h('travelToGiver', c.quest);
    try { rec.entered = await handle.h('enterInterior', c.interior); }
    catch (e) { rec.skipped = `enterInterior('${c.interior}') threw: ${String(e.message || e)}`; legs.push(rec); continue; }
    // The door sets `sim.env.interior`; the ROOM is built at the next `_applyCell`, which runs
    // out of the step. So step, exactly as the world does, before asking what is in the room.
    await handle.h('stepFrames', 2);

    // The object, as the world reports it. `readable_book` is the field `_takePropPending` reads.
    const ents = await handle.h('listEntities');
    const prop = (ents || []).find((e) => e.eid === `interior-readable:${c.readable_id}`);
    if (!prop) { rec.skipped = `no prop interior-readable:${c.readable_id} in ${c.interior}`; legs.push(rec); continue; }
    rec.prop = { eid: prop.eid, name: prop.name, readable_book: prop.readable_book, takeable: prop.takeable, reach_m: prop.reach_m, pos: prop.pos };
    if (prop.readable_book !== c.book) { rec.error = `prop carries readable_book=${prop.readable_book}, expected ${c.book}`; legs.push(rec); continue; }
    if (prop.takeable) { rec.error = 'a document with a book behind it must not be takeable'; legs.push(rec); continue; }

    // ---- THE CHAIN IN FRONT OF IT, PLAYED. Q-MAIN-06 is the sixth quest of the main line and
    // will not open until the fifth is finished; a probe that granted its way past that would be
    // measuring a world no player is ever standing in. So the prerequisites are OPENED and
    // RESOLVED, depth first, using only a resolution the gate itself reports as available and
    // preferring the non-violent one — the same two verbs `viability-walk.mjs` allows itself and
    // for the same reason. A prerequisite that will not open is reported and the leg is skipped.
    rec.chain = [];
    const played = new Set();
    const playChain = async (qid) => {
      if (played.has(qid)) return true;
      played.add(qid);
      const d = defs.get(qid);
      if (!d) return false;
      for (const pre of d.prereqs) if (!(await playChain(pre))) return false;
      await handle.h('travelToGiver', qid);
      let o = await handle.h('questOpen', qid);
      if (!(o && o.ok) && /topic "/.test(String(o && o.reason || ''))) {
        for (const t of [...new Set([d.topic, ...d.prereqTopics].filter(Boolean))]) await handle.h('learnTopic', t);
        o = await handle.h('questOpen', qid);
      }
      if (!(o && o.ok)) { rec.chain.push({ quest: qid, opened: false, why: o && o.reason }); return false; }
      // A prerequisite whose exits are gated on a document is finished the way a player finishes
      // it: by going to the room and reading the thing. Never the document under test — that one
      // is left for this leg's own act, and the leg fails if it turns up already read.
      for (const d of (defs.get(qid) || { docs: [] }).docs) {
        if (d.book === c.book) continue;
        const pl = placement.get(d.book);
        if (!pl) continue;
        await handle.h('enterInterior', pl.interior);
        await handle.h('stepFrames', 2);
        const pr = (await handle.h('listEntities')).find((e) => e.eid === `interior-readable:${pl.readable_id}`);
        if (!pr) continue;
        const st = standAt({ spawn: pl.spawn, bounds: pl.bounds }, pr);
        if (!st) continue;
        await handle.h('teleport', st.x, st.z);
        await pressInteract(`chain: ${qid} needs ${d.book}`);
        if ((await uiMode()).mode === 'book') await handle.h('closeMenu');
        rec.chain.push({ quest: qid, read: d.book });
      }
      const rs = await handle.h('questResolutions', qid);
      const list = (rs.resolutions || rs || []);
      const pick = list.find((r) => r.available && !r.violence_required) || list.find((r) => r.available);
      if (!pick) { rec.chain.push({ quest: qid, opened: true, resolved: false, why: (list[0] && (list[0].why || [])[0]) || 'no available resolution' }); return false; }
      const res = await handle.h('questResolve', qid, pick.id);
      rec.chain.push({ quest: qid, opened: true, resolved: !!(res && res.ok), took: pick.id });
      // the chain travels and enters rooms; put the body back where this leg needs it

      return !!(res && res.ok);
    };
    let chainOk = true;
    for (const pre of (defs.get(c.quest) || { prereqs: [] }).prereqs) {
      if (!(await playChain(pre))) { chainOk = false; break; }
    }
    if (!chainOk) {
      const last = rec.chain[rec.chain.length - 1];
      rec.skipped = `the chain in front of it stops at ${last && last.quest}: ${last && last.why}`;
      legs.push(rec); continue;
    }
    // Re-enter: playing the chain travels, and the body is wherever the last giver was.
    await handle.h('enterInterior', c.interior);
    await handle.h('stepFrames', 2);

    // ---- the quest is opened. DECLARED GRANT; the offer gate is not under test.
    let opened = await handle.h('questOpen', c.quest);
    if (!(opened && opened.ok) && /topic "/.test(String(opened && opened.reason || ''))) {
      const topics = [...new Set([c.topic, ...(c.prereqTopics || [])].filter(Boolean))];
      for (const t of topics) await handle.h('learnTopic', t);
      rec.topics_granted = topics;
      opened = await handle.h('questOpen', c.quest);
    }
    rec.opened = !!(opened && opened.ok);
    if (!rec.opened) { rec.open_refusal = opened && opened.reason; rec.skipped = `the offer gate refused: ${rec.open_refusal}`; legs.push(rec); continue; }

    rec.books_read_before = await booksRead();
    rec.refusals_before = await refusalsNaming(c.quest, c.reveal);
    if (rec.books_read_before.includes(c.book)) { rec.error = 'the document was already read before the act'; legs.push(rec); continue; }
    if (!rec.refusals_before.length) { rec.error = 'no resolution refused on this reveal before the act; the leg would prove nothing'; legs.push(rec); continue; }

    rec.diag = {
      census: await handle.h('getCensusState'),
      conv: await handle.h('getConversationState'),
      ui: (await handle.h('getUIState')).mode,
      where: await handle.h('whereAmI'),
    };
    // ---- CONTROL 1: same room, out of reach of EVERY document, same button.
    // The spot is not chosen by hand: it is the point on a grid over the room's own floor whose
    // nearest prop is furthest away. The Court's archive has twelve documents on its walls and a
    // control placed by eye landed inside the reach of a different one — which is the control
    // working, one step before it was written down.
    const allProps = (await handle.h('listEntities')).filter((e) => e.kind === 'object' && !e.taken);
    // ...and clear of PEOPLE. `interact` reaches for the nearest person when no prop is in reach,
    // and a conversation swallows every later press. The room the Court keeps its archive in has
    // the archivist standing in it, which is the whole point of the room.
    const people = (await handle.h('listNPCs') || []).filter((n) => n && n.pos);
    // The grid is the ROOM's own floor at half a metre, not a fixed +/-6 box: the smallest
    // interiors are 11 m across and a coarse grid outside their walls left the search with no
    // candidate at all in helstrom-undertemple.
    const bx = (c.bounds && c.bounds.x) || [-6, 6], bz = (c.bounds && c.bounds.z) || [-6, 6];
    const xs = [], zs = [];
    for (let x = bx[0] + 0.8; x <= bx[1] - 0.8; x += 0.5) xs.push(+x.toFixed(2));
    for (let z = bz[0] + 0.8; z <= bz[1] - 0.8; z += 0.5) zs.push(+z.toFixed(2));
    // Two passes. The first also keeps clear of people, because `interact` reaches for the
    // nearest person when no prop is in reach and a conversation is a distraction in the report.
    // The second drops that, because a crowded room is not a reason to skip the control — the
    // control's assertion is that NO DOCUMENT OPENED, and greeting the archivist does not open
    // one. Which pass was used is recorded.
    let spot = null, spotD = -1, avoidedPeople = true;
    for (const strict of [true, false]) {
      for (const x of xs) for (const z of zs) {
        if (doorDist(c, x, z) <= DOOR_REACH_M) continue;   // the door would take the press
        if (strict && people.some((n) => Math.hypot(n.pos[0] - x, n.pos[2] - z) <= 2.6)) continue;
        let near = Infinity;
        for (const o of allProps) near = Math.min(near, Math.hypot(o.pos[0] - x, o.pos[2] - z));
        if (near > spotD) { spotD = near; spot = [x, z]; }
      }
      if (spot && spotD > prop.reach_m) { avoidedPeople = strict; break; }
    }
    rec.control_out_of_reach = { spot, nearest_prop_m: +spotD.toFixed(2), clear_of_people: avoidedPeople };
    if (!spot || spotD <= prop.reach_m) { rec.error = `no spot in ${c.interior} is both clear of the door and out of reach of every document (best ${spotD.toFixed(2)} m); the control cannot be run`; legs.push(rec); continue; }
    await handle.h('teleport', spot[0], spot[1]);
    await pressInteract('control 1');
    const ctl1 = await uiMode();
    rec.control_out_of_reach.mode = ctl1.mode;
    rec.control_out_of_reach.book = ctl1.book;
    rec.control_out_of_reach.books_read = (await booksRead()).length;
    if (ctl1.mode === 'book') await handle.h('closeMenu');

    // ---- CONTROL 2: the wrong document off the same shelf. The refusal must not move.
    const other = (shelf.get(c.interior) || []).find((r) => r.book !== c.book);
    const op = other ? allProps.find((e) => e.eid === `interior-readable:${other.readable_id}`) : null;
    if (op) {
      const os = standAt(c, op);
      if (!os) { rec.control_wrong_document = null; rec.control_wrong_document_note = `${other.book} cannot be stood at without the door in reach`; }
      else await handle.h('teleport', os.x, os.z);
      if (os) await pressInteract('control 2');
      const m2 = os ? await uiMode() : { mode: 'world', book: null };
      if (m2.mode === 'book') await handle.h('closeMenu');
      if (os) rec.control_wrong_document = {
        book: other.book, opened: m2.book, stood: os,
        refusals_after: await refusalsNaming(c.quest, c.reveal),
      };
    } else {
      rec.control_wrong_document = null;
      rec.control_wrong_document_note = other
        ? `no prop interior-readable:${other.readable_id} in the room`
        : 'no second document on this shelf';
    }
    // THE SAME CONTROL, FOUND FOR FREE, when the room holds only one document. Getting here at
    // all may have meant reading OTHER documents to finish the chain in front of this quest —
    // and `refusals_before` was measured after all of them. So "somebody read other documents
    // and this refusal did not move" is already established, by the run, without a second press.
    if (!rec.control_wrong_document && rec.books_read_before.length) {
      rec.control_wrong_document = {
        book: rec.books_read_before[rec.books_read_before.length - 1],
        opened: rec.books_read_before[rec.books_read_before.length - 1],
        refusals_after: rec.refusals_before,
        via: 'read while playing the chain in front of this quest, before this leg measured the refusal',
      };
    }
    if ((await booksRead()).includes(c.book)) { rec.error = 'a control read the document under test; the leg would prove nothing'; legs.push(rec); continue; }

    // ---- THE ACT. Stand at the shelf and press the button.
    const at = standAt(c, prop);
    if (!at) {
      rec.error = `PLACEMENT DEFECT: ${c.book} sits within ${DOOR_REACH_M} m of ${c.interior}'s doorway, so interact goes through the door before it reaches the document`;
      legs.push(rec); continue;
    }
    rec.stood = at;
    await handle.h('teleport', at.x, at.z);
    const here = await handle.h('whereAmI');
    rec.stood_at = here && here.pos ? here.pos : null;
    rec.stood_off_m = +Math.hypot(prop.pos[0] - here.pos[0], prop.pos[2] - here.pos[2]).toFixed(2);
    rec.still_inside_before = here.interior;
    await pressInteract('the act');
    const m = await uiMode();
    rec.opened_screen = m;
    if (m.mode === 'book') await handle.h('closeMenu');

    rec.still_inside_after = (await handle.h('whereAmI')).interior;
    rec.books_read_after = await booksRead();
    const st = await handle.h('getQuestState');
    const row = (st.active || []).find((x) => x.id === c.quest);
    rec.knows_after = Object.keys((row && row.flags) || {}).filter((k) => k.startsWith('know:')).map((k) => k.slice(5)).sort();
    rec.refusals_after = await refusalsNaming(c.quest, c.reveal);
    // `bookKnowledge` is a UNION into `ctx.knowledge`, not a `know:` flag write — that is
    // W1-LIBRARY's design and `reveal()` remains the only writer of a flag. So the observable is
    // the REFUSAL, not the flag bag, and the leg says so rather than looking in the wrong place.
    rec.passed = m.mode === 'book' && m.book === c.book
      && rec.books_read_after.includes(c.book)
      && rec.refusals_before.length > 0 && rec.refusals_after.length === 0
      && rec.control_out_of_reach.mode !== 'book'
      && !!rec.control_wrong_document
      && rec.control_wrong_document.opened === rec.control_wrong_document.book
      && rec.control_wrong_document.refusals_after.length === rec.refusals_before.length;
    legs.push(rec);
  }
} finally {
  await handle.close();
}

const ran = legs.filter((l) => !l.skipped && !l.error);
const report = {
  tool: 'document-route-world',
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  taken_at: new Date().toISOString(),
  load: (() => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch { return null; } })(),
  browsers: (() => { try { return Number(execSync('pgrep -c headless_shell || true').toString().trim()) || 0; } catch { return null; } })(),
  prohibited: PROHIBITED,
  declared_grants: ['questOpen', 'questResolve (prerequisite chain only, available resolutions only)', 'learnTopic', 'travelToGiver', 'enterInterior', 'teleport'],
  candidates: queue.length,
  legs_run: ran.length,
  legs_passed: ran.filter((l) => l.passed).length,
  legs,
  presses_that_reached_a_person_instead: aside,
};
const out = args.out ? String(args.out) : path.join(ROOT, 'reports/runs/W1-READABLES/document-route-world.json');
ensureDir(path.dirname(out));
writeJson(out, report);

console.log(`\ndocument-route-world — reach for the ledger, read it, does the refusal go?\n`);
for (const l of legs) {
  if (l.skipped) { console.log(`  ${l.quest.padEnd(11)} ${l.reveal.padEnd(24)} SKIPPED — ${l.skipped}`); continue; }
  if (l.error) { console.log(`  ${l.quest.padEnd(11)} ${l.reveal.padEnd(24)} ERROR — ${l.error}`); continue; }
  console.log(`  ${l.quest.padEnd(11)} ${l.reveal.padEnd(24)} ${l.passed ? 'PASS' : 'FAIL'}`);
  console.log(`      chain  ${(l.chain || []).map((x) => x.read ? `${x.quest} reads ${x.read}` : `${x.quest}/${x.took || 'X'}`).join(' -> ') || '(none)'}`);
  console.log(`      source ${l.source} -> book ${l.book}, on a shelf in ${l.interior}`);
  console.log(`      prop   ${l.prop.eid}  takeable=${l.prop.takeable}  reach ${l.prop.reach_m} m`);
  console.log(`      act    pressed interact ${l.stood_off_m} m from it, ${l.stood.door_m} m from the door -> screen ${l.opened_screen.mode}, book ${l.opened_screen.book}`);
  console.log(`      read   booksRead ${l.books_read_before.length} -> ${l.books_read_after.length}`);
  console.log(`      gate   refusals naming ${l.reveal}: ${l.refusals_before.length} -> ${l.refusals_after.length}`);
  if (l.refusals_before.length) console.log(`             was: "${l.refusals_before[0]}"`);
  console.log(`      CTRL 1 stood at ${l.control_out_of_reach.spot.join(',')}, nearest document ${l.control_out_of_reach.nearest_prop_m} m: screen ${l.control_out_of_reach.mode}, books read ${l.control_out_of_reach.books_read}`);
  if (l.control_wrong_document) {
    console.log(`      CTRL 2 read ${l.control_wrong_document.opened} instead: refusals naming ${l.reveal} still ${l.control_wrong_document.refusals_after.length}${l.control_wrong_document.via ? ' (' + l.control_wrong_document.via + ')' : ''}`);
  } else if (l.control_wrong_document_note) {
    console.log(`      CTRL 2 NOT RUN — ${l.control_wrong_document_note}`);
  }
}
console.log(`\n  legs run ${ran.length} of ${queue.length} candidate(s), passed ${report.legs_passed}`);
console.log(`  wrote ${path.relative(ROOT, out)}`);
if (!ran.length) { console.error('\ndocument-route-world: NO leg ran. A run that measured nothing is a failure, not a pass.'); process.exit(1); }
process.exit(report.legs_passed === ran.length ? 0 : 1);
