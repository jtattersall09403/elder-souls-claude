#!/usr/bin/env node
// CRITIC instrument, W1-23 round 3 — the LIBRARY half. Written by the critic, not the builder.
//
// Round 1 and round 2 both judged the *register* (canon-facts.json, disputes, seals, voices).
// Neither of them ever counted the books. `tools/lore/critic-w1-23-r1.mjs` prints "84 facts,
// 28 disputed / 347 people, 466 topics, 1217 dialogue infos" and not one number in it is about
// a text. This tool asks the questions the register instruments cannot:
//
//   A. TAXON. `tools/analysis/book-budget.mjs` row L8 checks the corpus TOTAL against
//      RI-LOR03 §2's 112. §2's table is ten per-taxon rows and its own caption says
//      "Counts below are *minimums*." No gate in the tree reads `book.taxon` for a floor, so a
//      corpus can pass L8 while missing most of the taxa by over-filling two of them.
//   B. TICS. The project's named failure list: quest-brief phrasing, stated stakes, tidy summary
//      sentences, modern helpfulness, signposting, "you must", and any line whose job is to tell
//      the player where to go. Per line, with the book id, so a claim of "zero" is auditable.
//   C. DISPUTE. RI-LOR03 §2 wants ">=8 pairs of books must contradict each other". `contradicts`
//      is a DIRECTED edge, so eight books each pointing at a different silent partner would
//      satisfy a naive count. This separates MUTUAL pairs (both books know they are in a fight)
//      from ONE-WAY ones, and checks the named partner exists.
//   D. CONSUMPTION (RI-MTH07, mandatory under ARBITRATION.md §3). Two independent questions,
//      because `_readBook()` existing is not the same as a book being readable:
//        D1 PLACEMENT — can the player reach the text at all? A book is reachable if some room
//           in `game/data/world/interiors/**` names it in a `readable[].book`. Anything else is
//           openable only through `openMenu('book', {id})`, which is the harness door.
//        D2 TOPIC REACH — `_readBook()` unions `topics_taught` into `sim.quest.topicsKnown`.
//           `topicsFor()` will only ever SURFACE a held topic if that topic is flagged
//           `root: true`; a non-root topic in `topicsKnown` reaches a player only through a
//           quest's `opens_by.topic` / `opens_by.prerequisite_topics`. So: for each taught
//           topic, does ANY consumer read it?
//        D3 PERTURB — the demonstration. Strike one topic from a book that IS consumed and watch
//           a named quest close; strike the whole `topics_taught` of a book that is not and watch
//           the province not move. Both arms, or the negative one proves nothing (RULES #6).
//
// --self-test breaks each section on purpose and confirms this tool goes red.
//
// Run:  node tools/lore/critic-w1-23-r3.mjs [--json] [--self-test]
// Exit: 0 always in report mode (a critic instrument reports; the verdict grades). Non-zero if
//       the corpus it measures is absent, or if --self-test fails.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { topicKey } from '../../game/src/core/topics.js';
import { buildTopicIndex, topicsFor } from '../../game/src/character/converse.js';
import { canOffer } from '../../game/src/sim/quest/gate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ls = (p) => fs.readdirSync(path.join(ROOT, p)).filter((f) => f.endsWith('.json'));

// ---------------------------------------------------------------- loading

/** Every text on disk. Three file shapes ship here and all three are real. */
export function loadBooks(dir = 'game/data/books') {
  const out = [];
  for (const f of ls(dir)) {
    const d = rd(`${dir}/${f}`);
    const arr = Array.isArray(d) ? d : (d.books || d.texts || d.entries || (d.schema && d.text ? [d] : []));
    for (const b of arr) out.push({ ...b, _file: f });
  }
  return out;
}

export function loadQuestTopics(dir = 'game/data/quests') {
  const opens = new Map(), preq = new Map();
  for (const f of ls(dir)) {
    for (const q of (rd(`${dir}/${f}`).quests || [])) {
      const ob = q.opens_by || {};
      if (ob.topic) opens.set(topicKey(ob.topic), q.id);
      for (const t of (ob.prerequisite_topics || [])) preq.set(topicKey(t), q.id);
    }
  }
  return { opens, preq };
}

export function loadPlacements(dir = 'game/data/world/interiors') {
  const placed = new Map();   // book id -> [room id]
  let roomsWithBook = 0, roomsWithEmptyShelf = 0, roomsWithNone = 0;
  for (const f of ls(dir)) {
    const d = rd(`${dir}/${f}`);
    const r = d.readable;
    if (!r) { roomsWithNone++; continue; }
    const list = Array.isArray(r) ? r : [r];
    const withBook = list.filter((x) => x && x.book);
    if (withBook.length) roomsWithBook++; else roomsWithEmptyShelf++;
    for (const x of withBook) {
      if (!placed.has(x.book)) placed.set(x.book, []);
      placed.get(x.book).push(d.id || f.replace(/\.json$/, ''));
    }
  }
  return { placed, roomsWithBook, roomsWithEmptyShelf, roomsWithNone, rooms: ls(dir).length };
}

// ---------------------------------------------------------------- A. taxon minimums
// RI-LOR03 §2, verbatim from the table's Target column. The caption reads "Counts below are
// *minimums*", so these are floors and not budgets.
export const TAXON_MIN = { T1: 16, T2: 10, T3: 14, T4: 16, T5: 10, T6: 12, T7: 12, T8: 10, T9: 6, T10: 16 };
export const CORPUS_MIN = 112;

export function taxonReport(books) {
  const count = {};
  for (const b of books) { const t = b.taxon || '(none)'; count[t] = (count[t] || 0) + 1; }
  const rows = Object.entries(TAXON_MIN).map(([t, min]) => ({ taxon: t, have: count[t] || 0, min, short: (count[t] || 0) < min }));
  return {
    total: books.length, corpus_min: CORPUS_MIN, total_ok: books.length >= CORPUS_MIN,
    rows, short: rows.filter((r) => r.short).length,
    shortfall: rows.reduce((a, r) => a + Math.max(0, r.min - r.have), 0),
    untaxoned: books.filter((b) => !b.taxon).map((b) => b.id),
  };
}

// ---------------------------------------------------------------- B. the tic list
// One family per named failure mode in the project's grading list. Deliberately GENEROUS —
// a family that fires on a legitimate in-register line is a line the verdict must adjudicate by
// reading, and an instrument that only fires on what it is sure of cannot be trusted to have
// looked. `wry_byline` is not on the project's list; it is this round's own addition and is
// reported separately so it cannot inflate the headline count.
export const TIC_FAMILIES = {
  'quest-brief': /\b(your task is|you are to (?:go|travel|seek|find)|seek out|make your way to|report to the|when you have (?:found|done) (?:it|this|so),? return|return to me)\b/i,
  'stated-stakes': /\b(if you fail|the fate of (?:the|this|all)|is at stake|before it is too late|all(?: will be| is) lost|hangs in the balance|time is (?:short|running out))\b/i,
  'tidy-summary': /(^|\n)\s*(and so|in the end|thus,|in conclusion|the lesson (?:here )?is|what (?:this|it) all means|that is what it (?:all )?means|to sum up|in short,)/i,
  'modern-helpfulness': /\b(remember to|be sure to|don't forget|do not forget to|make sure (?:to|you)|simply |tip:|helpfully|feel free to|you may wish to consult)\b/i,
  'signposting': /\b(you will find (?:it|him|her|them) (?:in|at|on|near)|it lies (?:to the )?(?:north|south|east|west)|head (?:north|south|east|west)|the entrance is|take the (?:north|south|east|west) road|follow the (?:road|path) (?:north|south|east|west))\b/i,
  'you-must': /\byou must\b/i,
};
const FINAL_SUMMARY = /^(and so|thus|in the end|so it is that|this is why|that is the lesson|the moral)/i;
const WRY_BYLINE = /,\s*(and|who|which|whose|whichever|most of them)\b[^,]*$/i;

export function ticReport(books) {
  const hits = [];
  for (const b of books) {
    for (const line of String(b.text || '').split(/\n+/)) {
      for (const [fam, re] of Object.entries(TIC_FAMILIES)) {
        const m = line.match(re);
        if (m) hits.push({ family: fam, book: b.id, taxon: b.taxon || null, hit: m[0].trim(), line: line.trim().slice(0, 240) });
      }
    }
    const t = String(b.text || '').trim();
    const last = (t.split(/(?<=[.!?])\s+/).pop() || '').trim();
    if (FINAL_SUMMARY.test(last)) hits.push({ family: 'final-summary', book: b.id, taxon: b.taxon || null, hit: 'closing sentence', line: last.slice(0, 240) });
  }
  const byFamily = {};
  for (const f of [...Object.keys(TIC_FAMILIES), 'final-summary']) byFamily[f] = hits.filter((h) => h.family === f).length;
  const wry = books.filter((b) => WRY_BYLINE.test(String(b.author || '')));
  return { hits, byFamily, total: hits.length, books_touched: new Set(hits.map((h) => h.book)).size,
    wry_byline: { n: wry.length, pct: +(100 * wry.length / (books.length || 1)).toFixed(1), sample: wry.slice(0, 6).map((b) => b.author) } };
}

// ---------------------------------------------------------------- C. the disputes
export function disputeReport(books) {
  const ids = new Set(books.map((b) => b.id));
  const edges = [];
  for (const b of books) for (const c of (b.contradicts || [])) edges.push({ from: b.id, to: c.book, on: c.on || '', cf: c.cf || null });
  const seen = new Map();
  for (const e of edges) {
    const k = [e.from, e.to].sort().join('||') + '##' + e.on;
    if (!seen.has(k)) seen.set(k, { key: k, dirs: new Set(), on: e.on, cf: e.cf, books: [e.from, e.to].sort() });
    seen.get(k).dirs.add(e.from);
  }
  const pairs = [...seen.values()];
  return {
    edges: edges.length,
    dangling: edges.filter((e) => !ids.has(e.to)),
    mutual: pairs.filter((p) => p.dirs.size >= 2),
    one_way: pairs.filter((p) => p.dirs.size === 1),
    with_cf: edges.filter((e) => e.cf).length,
  };
}

// ---------------------------------------------------------------- D. consumption
export function consumptionReport(books, quests, placements, topicIndex) {
  const taught = new Map();
  for (const b of books) for (const t of (b.topics_taught || [])) {
    const k = topicKey(t);
    if (!taught.has(k)) taught.set(k, { topic: t, books: [] });
    taught.get(k).books.push(b.id);
  }
  const rootKeys = new Set((topicIndex.roots || []).map((r) => r.key));
  const rows = [...taught.entries()].map(([k, v]) => ({
    key: k, topic: v.topic, books: v.books,
    is_root: rootKeys.has(k),
    in_dialogue: topicIndex.has(k),
    opens_quest: quests.opens.get(k) || null,
    prereq_of: quests.preq.get(k) || null,
  }));
  const consumed = (r) => r.is_root || !!r.opens_quest || !!r.prereq_of;

  const withTopics = books.filter((b) => (b.topics_taught || []).length);
  const deadBooks = withTopics.filter((b) => !(b.topics_taught || []).some((t) => consumed(rows.find((r) => r.key === topicKey(t)))));

  const placedIds = new Set([...placements.placed.keys()]);
  const unplaced = books.filter((b) => !placedIds.has(b.id));

  return {
    taught_topics: rows.length,
    roots_in_index: (topicIndex.roots || []).length,
    taught_that_are_root: rows.filter((r) => r.is_root).length,
    taught_in_dialogue_index: rows.filter((r) => r.in_dialogue).length,
    taught_opening_a_quest: rows.filter((r) => r.opens_quest).length,
    taught_as_quest_prereq: rows.filter((r) => r.prereq_of).length,
    taught_reaching_nothing: rows.filter((r) => !consumed(r) && !r.in_dialogue).length,
    books_with_topics: withTopics.length,
    books_whose_topics_reach_nothing: deadBooks.map((b) => b.id),
    placed: placedIds.size,
    unplaced: unplaced.map((b) => b.id),
    rooms: placements.rooms,
    rooms_with_a_real_book: placements.roomsWithBook,
    rooms_with_an_empty_shelf: placements.roomsWithEmptyShelf,
    rooms_with_no_readable: placements.roomsWithNone,
    rows,
  };
}

// ---------------------------------------------------------------- D3. the perturbation
/**
 * The demonstration RI-MTH07 asks for: change the model, watch an entity change behaviour.
 *
 * POSITIVE ARM. `topicsKnown` is what a quest's `opens_by.topic` reads. Take a real quest whose
 * opening topic is taught by a real book; run `canOffer()` with the topic held and with it
 * struck. The gate must flip. Without this arm the negative arm is worthless, because a probe
 * that reports "nothing changed" and cannot report anything else has not measured anything.
 *
 * NEGATIVE ARM. Take a book whose taught topics reach no consumer, hold ALL of them, and diff
 * every (npc, offered-topic) pair in the province and every quest gate. If nothing moves, the
 * text is decoration.
 */
export function perturb({ books, quests, topicIndex, pop, questDefs }) {
  const ctxBase = () => ({
    completed: new Set(), locked: new Set(), lockedReason: new Map(),
    topicsKnown: [], flags: {}, dispositions: {}, ranks: {}, knowledge: new Set(),
    worldFlags: new Set(), skills: {},
  });
  const offerable = (topics) => {
    const ctx = ctxBase(); ctx.topicsKnown = topics.slice();
    const open = [];
    for (const d of questDefs) { const r = canOffer(d, ctx, null); if (r.ok !== false && (!r.why || !r.why.length)) open.push(d.id); }
    return new Set(open);
  };
  const offeredTopics = (topics) => {
    const P = { race: 'dunmer', upbringing: null, birthsign: null, knows: new Set(), topics_known: topics };
    const out = new Map();
    for (const n of pop) out.set(n.id || n.eid, topicsFor(topicIndex, n, { ...P, disposition: n.base_disposition || 40 }, null).map((t) => t.id).sort().join('|'));
    return out;
  };

  // ---- positive: a book-taught topic that a quest's opens_by names
  let positive = null;
  for (const b of books) {
    for (const t of (b.topics_taught || [])) {
      const q = quests.opens.get(topicKey(t));
      if (!q) continue;
      const withIt = offerable([t]); const without = offerable([]);
      if (withIt.has(q) !== without.has(q)) {
        positive = { book: b.id, topic: t, quest: q, open_with_topic: withIt.has(q), open_without: without.has(q) };
        break;
      }
    }
    if (positive) break;
  }

  // ---- negative: a book none of whose topics reach anything
  const rootKeys = new Set((topicIndex.roots || []).map((r) => r.key));
  const reaches = (t) => { const k = topicKey(t); return rootKeys.has(k) || quests.opens.has(k) || quests.preq.has(k); };
  const dead = books.filter((b) => (b.topics_taught || []).length && !(b.topics_taught || []).some(reaches));
  let negative = null;
  if (dead.length) {
    const b = dead[0];
    const base = offeredTopics([]); const after = offeredTopics(b.topics_taught.slice());
    let moved = 0;
    for (const [k, v] of base) if (after.get(k) !== v) moved++;
    const qBase = offerable([]); const qAfter = offerable(b.topics_taught.slice());
    const qMoved = [...qAfter].filter((x) => !qBase.has(x)).length + [...qBase].filter((x) => !qAfter.has(x)).length;
    negative = { book: b.id, topics: b.topics_taught, npcs: pop.length, npcs_whose_offer_changed: moved, quests_whose_gate_changed: qMoved, dead_books: dead.length };
  }
  // ---- the sweep. The two arms above are a demonstration; this is the census, and it makes no
  // argument about what `topicsFor()` does. For EVERY book: hold exactly the topics that book
  // teaches, and diff the whole province against holding none. A book that moves nothing is a
  // book the running world cannot tell you read.
  const baseOffer = offeredTopics([]);
  const baseGate = offerable([]);
  const sweep = [];
  for (const b of books) {
    const ts = b.topics_taught || [];
    if (!ts.length) { sweep.push({ book: b.id, topics: 0, npcs_moved: 0, quests_moved: 0 }); continue; }
    const after = offeredTopics(ts.slice());
    let npcs = 0; for (const [k, v] of baseOffer) if (after.get(k) !== v) npcs++;
    const qa = offerable(ts.slice());
    const quests = [...qa].filter((x) => !baseGate.has(x)).length + [...baseGate].filter((x) => !qa.has(x)).length;
    sweep.push({ book: b.id, topics: ts.length, npcs_moved: npcs, quests_moved: quests });
  }
  const inert = sweep.filter((s) => s.npcs_moved === 0 && s.quests_moved === 0);

  return { positive, negative, sweep, inert: inert.map((s) => s.book), inert_n: inert.length, sweep_n: sweep.length };
}

// ---------------------------------------------------------------- runner
function commit() { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } }

function main(argv) {
  const json = argv.includes('--json');
  const books = loadBooks();
  if (!books.length) { console.error('no texts on disk under game/data/books — that is the finding'); process.exit(2); }
  const quests = loadQuestTopics();
  const placements = loadPlacements();
  const topicDocs = ls('game/data/dialogue/topics').map((f) => rd(`game/data/dialogue/topics/${f}`));
  const topicIndex = buildTopicIndex(topicDocs);
  const pop = []; for (const f of ls('game/data/npcs')) for (const n of (rd(`game/data/npcs/${f}`).npcs || [])) pop.push(n);
  const questDefs = []; for (const f of ls('game/data/quests')) for (const q of (rd(`game/data/quests/${f}`).quests || [])) questDefs.push(q);

  const A = taxonReport(books), B = ticReport(books), C = disputeReport(books);
  const D = consumptionReport(books, quests, placements, topicIndex);
  const P = perturb({ books, quests, topicIndex, pop, questDefs });

  const out = { commit: commit(), texts: books.length, A, B, C, D, P };
  if (json) { console.log(JSON.stringify(out, null, 2)); return 0; }

  console.log(`commit   ${out.commit}`);
  console.log(`library  ${books.length} texts, ${books.reduce((a, b) => a + String(b.text || '').split(/\s+/).filter(Boolean).length, 0)} words`);
  console.log('');
  console.log('A. TAXON    RI-LOR03 §2 per-taxon MINIMUMS (the total is row L8 and passes)');
  console.log(`  total ${A.total} / ${A.corpus_min} ${A.total_ok ? 'ok' : 'SHORT'}   —  ${A.short} of 10 taxa below their floor, shortfall ${A.shortfall} texts`);
  for (const r of A.rows) console.log(`    ${r.taxon.padEnd(4)} ${String(r.have).padStart(3)} / ${String(r.min).padStart(2)}  ${r.short ? 'SHORT' : ''}`);
  console.log(`    untaxoned: ${A.untaxoned.length}${A.untaxoned.length ? ' — ' + A.untaxoned.join(', ') : ''}`);
  console.log('');
  console.log('B. TICS     the project\'s named failure list, per line');
  for (const [f, n] of Object.entries(B.byFamily)) console.log(`    ${f.padEnd(20)} ${n}`);
  console.log(`    ${B.total} hit(s) across ${B.books_touched} of ${books.length} texts`);
  for (const h of B.hits.slice(0, 40)) console.log(`      [${h.family}] ${h.book}: «${h.hit}» ${h.line.slice(0, 130)}`);
  console.log(`    wry trailing byline clause: ${B.wry_byline.n}/${books.length} (${B.wry_byline.pct}%)  [not on the project list; this round's own]`);
  console.log('');
  console.log('C. DISPUTE  RI-LOR03 §2 wants >= 8 pairs of books contradicting each other');
  console.log(`  ${C.edges} directed edges -> ${C.mutual.length} MUTUAL pairs, ${C.one_way.length} one-way, ${C.dangling.length} naming a book not on disk`);
  for (const p of C.mutual) console.log(`    ${p.books.join('  <->  ')}   on: ${p.on}${p.cf ? '  [' + p.cf + ']' : ''}`);
  console.log('');
  console.log('D. CONSUMPTION (RI-MTH07 / ARBITRATION §3)');
  console.log(`  D1 placement  ${D.placed} of ${books.length} texts are a readable object in a room; ${D.unplaced.length} are not`);
  console.log(`                ${D.rooms} interiors: ${D.rooms_with_a_real_book} hold a text, ${D.rooms_with_an_empty_shelf} hold a shelf book with nothing written in it, ${D.rooms_with_no_readable} hold none`);
  console.log(`  D2 topics     ${D.taught_topics} distinct topics taught by ${D.books_with_topics} books`);
  console.log(`                ${D.taught_that_are_root} are root topics (the only kind topicsFor() can surface from topicsKnown)`);
  console.log(`                ${D.taught_opening_a_quest} open a quest, ${D.taught_as_quest_prereq} are a quest prerequisite, ${D.taught_in_dialogue_index} exist in the dialogue index`);
  console.log(`                ${D.books_whose_topics_reach_nothing.length} of ${D.books_with_topics} books teach only topics that reach NO consumer`);
  console.log('  D3 perturb');
  if (P.positive) console.log(`     POSITIVE  strike "${P.positive.topic}" (taught by ${P.positive.book}) -> quest ${P.positive.quest} offerable ${P.positive.open_with_topic} -> ${P.positive.open_without}. The instrument can see a consumer.`);
  else console.log('     POSITIVE  NONE FOUND — no book-taught topic changes any quest gate. The instrument cannot prove it would notice.');
  if (P.negative) console.log(`     NEGATIVE  hold every topic ${P.negative.book} teaches (${P.negative.topics.join(', ')}): ${P.negative.npcs_whose_offer_changed} of ${P.negative.npcs} people change what they will discuss; ${P.negative.quests_whose_gate_changed} quest gates move. ${P.negative.dead_books} books are in this class.`);
  console.log(`     SWEEP     every text, one at a time, against the whole province: ${P.inert_n} of ${P.sweep_n} move NOTHING — no person changes what they will discuss, no quest gate opens or closes.`);
  const movers = P.sweep.filter((s) => s.npcs_moved || s.quests_moved);
  for (const m of movers) console.log(`        moves: ${m.book} -> ${m.npcs_moved} people, ${m.quests_moved} quest gates`);
  console.log('');
  const findings = A.short + (C.dangling.length ? 1 : 0) + (D.unplaced.length ? 1 : 0) + (D.books_whose_topics_reach_nothing.length ? 1 : 0) + B.total;
  console.log(`CRITIC W1-23 r3: ${findings} finding(s)`);
  return 0;
}

// ---------------------------------------------------------------- self-test (RULES #4)
function selfTest() {
  let ok = true;
  const say = (pass, msg) => { console.log(`${pass ? '  ok  ' : '  FAIL'} ${msg}`); if (!pass) ok = false; };

  // A: a corpus that meets every floor must report zero short; removing one text from the
  //    smallest taxon must report one.
  const full = Object.entries(TAXON_MIN).flatMap(([t, n]) => Array.from({ length: n }, (_, i) => ({ id: `${t}-${i}`, taxon: t, text: 'x' })));
  say(taxonReport(full).short === 0, 'A: a corpus at every floor reports 0 short');
  say(taxonReport(full.filter((b) => b.id !== 'T9-0')).short === 1, 'A: removing one T9 reports 1 short');
  say(taxonReport([{ id: 'x', text: 'y' }]).untaxoned.length === 1, 'A: an untaxoned text is counted');

  // B: each family must fire on a line written to trip it, and the clean control must be silent.
  const bad = [
    { id: 'b1', text: 'Your task is to bring the seal to Gideon.' },
    { id: 'b2', text: 'If you fail, the fate of the province is at stake.' },
    { id: 'b3', text: 'And so we see that the marsh keeps its own.' },
    { id: 'b4', text: 'Remember to bring a lamp.' },
    { id: 'b5', text: 'You will find him at the quay.' },
    { id: 'b6', text: 'You must go there.' },
  ];
  const br = ticReport(bad);
  say(br.byFamily['quest-brief'] >= 1, 'B: quest-brief fires');
  say(br.byFamily['stated-stakes'] >= 1, 'B: stated-stakes fires');
  say(br.byFamily['tidy-summary'] >= 1 && br.byFamily['final-summary'] >= 1, 'B: tidy-summary and final-summary fire');
  say(br.byFamily['modern-helpfulness'] >= 1, 'B: modern-helpfulness fires');
  say(br.byFamily['signposting'] >= 1, 'B: signposting fires');
  say(br.byFamily['you-must'] >= 1, 'B: you-must fires');
  const clean = ticReport([{ id: 'c', author: 'Ivo Sarn', text: 'The eighth clause says the gap is the record. It has never been struck.' }]);
  say(clean.total === 0, 'B: the clean control is silent (a rule that always fires is not a rule)');
  say(ticReport([{ id: 'w', author: 'Ivo Sarn, sexton, who was not meant to read this', text: 'x' }]).wry_byline.n === 1, 'B: the wry byline fires');
  say(ticReport([{ id: 'w', author: 'Ivo Sarn', text: 'x' }]).wry_byline.n === 0, 'B: a flat byline does not');

  // C: a mutual pair, a one-way edge and a dangle must each be told apart.
  const cr = disputeReport([
    { id: 'p', contradicts: [{ book: 'q', on: 'x' }] },
    { id: 'q', contradicts: [{ book: 'p', on: 'x' }] },
    { id: 'r', contradicts: [{ book: 's', on: 'y' }] },
    { id: 's', contradicts: [] },
    { id: 't', contradicts: [{ book: 'nowhere', on: 'z' }] },
  ]);
  say(cr.mutual.length === 1, 'C: one mutual pair found');
  say(cr.one_way.length === 2, 'C: two one-way edges found');
  say(cr.dangling.length === 1, 'C: a dangling partner is caught');

  // D: consumption must distinguish a placed, consumed book from an orphan.
  const idx = buildTopicIndex([{ group: 'g', topics: [{ id: 'the-ledger', root: true, infos: [{ t: 'x' }] }] }]);
  const dr = consumptionReport(
    [{ id: 'alive', topics_taught: ['the ledger'] }, { id: 'orphan', topics_taught: ['nobody asks this'] }],
    // keyed through `topicKey` exactly as `loadQuestTopics()` keys it — core/topics.js folds a
    // slug to its SPACE form, and a fixture that keys the raw slug tests nothing.
    { opens: new Map([[topicKey('the-ledger'), 'Q-1']]), preq: new Map() },
    { placed: new Map([['alive', ['room-1']]]), rooms: 2, roomsWithBook: 1, roomsWithEmptyShelf: 1, roomsWithNone: 0 },
    idx,
  );
  say(dr.placed === 1 && dr.unplaced.length === 1 && dr.unplaced[0] === 'orphan', 'D: an unplaced text is named');
  say(dr.books_whose_topics_reach_nothing.length === 1 && dr.books_whose_topics_reach_nothing[0] === 'orphan', 'D: a text whose topics reach nothing is named');
  say(dr.taught_opening_a_quest === 1, 'D: a topic that opens a quest is counted as consumed');
  // and the inverse: if the quest map is emptied, the live text must go dead too.
  const dr2 = consumptionReport(
    [{ id: 'alive', topics_taught: ['the ledger'] }],
    { opens: new Map(), preq: new Map() },
    { placed: new Map(), rooms: 0, roomsWithBook: 0, roomsWithEmptyShelf: 0, roomsWithNone: 0 },
    buildTopicIndex([{ group: 'g', topics: [{ id: 'the-ledger', infos: [{ t: 'x' }] }] }]),
  );
  say(dr2.books_whose_topics_reach_nothing.length === 1, 'D: with the consumer removed, the same text reports dead (the probe is not hardcoded)');

  console.log(ok ? '\nself-test PASS' : '\nself-test FAIL');
  return ok ? 0 : 1;
}

const argv = process.argv.slice(2);
process.exit(argv.includes('--self-test') ? selfTest() : main(argv));
