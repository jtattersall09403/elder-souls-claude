#!/usr/bin/env node
// w1-library-r2-perturb.mjs — DELETE-THE-FIX for W1-LIBRARY round 2.
//
// ARBITRATION §3 / RI-MTH07: naming a consumer is not demonstrating one. This tool removes each
// consumer from the RUNNING engine and re-measures with the same probe logic that reported the
// fix working, so every green number in this piece has a matching red one taken minutes later on
// the same build.
//
// It perturbs AT RUNTIME, through `window.__ENGINE`, and never edits a source file. That is
// deliberate: this box runs a dozen agents who all `boot-check` before they measure, and a
// delete-the-fix that comments out an engine line — even for ninety seconds — is an outage for
// every one of them. A perturbation that cannot be interrupted into a broken tree is worth the
// small loss of fidelity, and what is lost is only that the module graph is untouched; the
// consumer really is gone in each case below.
//
// Four perturbations, each with the number it must move:
//
//   P1  ui.onBookOpened = null        topics gained by reading every book:  116 -> 0
//   P2  ui.onBookOpened = null        `you have not learned book_*` returns to all 3 resolutions
//   P3  ui.bookPages = {} (detached)  the reading position stops surviving reset/save/load
//   P4  bookKnowledge = new Map()     the knowledge union empties without touching booksRead
//
// Run: node tools/harness/w1-library-r2-perturb.mjs [--out FILE]

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-library-r2-perturb.mjs — delete-the-fix for the book consumers.'); process.exit(0); }

const BOOKS = [];
for (const f of readdirSync('game/data/books').filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  for (const b of (Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []))) {
    if ((b.topics_taught || []).length) BOOKS.push(b.id);
  }
}
const CASES = [
  { quest: 'Q-SOUL-02', res: 'res_seal', book: 'the-court-and-the-tide', key: 'book_the_court_and_the_tide' },
  { quest: 'Q-LILM-01', res: 'res_rootkeepers', book: 'the-rootless-egg', key: 'book_the_rootless_egg' },
  { quest: 'Q-DEEP-01', res: 'res_broker', book: 'the-sap-and-the-knife', key: 'book_the_sap_and_the_knife' },
];

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate(async ({ BOOKS, CASES }) => {
  const H = window.__HARNESS;
  const E = window.__ENGINE;
  if (!E || !E.ui) throw new Error('window.__ENGINE.ui unreachable — cannot perturb');

  const topics = () => (H.getQuestState().topicsKnown || []).slice();
  const readAll = () => { for (const id of BOOKS) { try { H.openMenu('book', { id }); H.closeMenu(); } catch {} } };
  const whyFor = (c) => {
    try { H.questOpen(c.quest); } catch {}
    const list = H.questResolutions(c.quest);
    const arr = Array.isArray(list) ? list : (list.resolutions || []);
    const hit = arr.find((x) => x && x.id === c.res);
    return hit ? (hit.why || []) : null;
  };
  const learnedClause = (c) => (whyFor(c) || []).some((w) => String(w).includes(c.key));

  const rep = {};

  // ---- P1 / P2 CONTROL: the fix in place ------------------------------------------------
  H.reset({});
  rep.control = { topics_before: topics().length };
  readAll();
  rep.control.topics_after = topics().length;
  rep.control.gained = rep.control.topics_after - rep.control.topics_before;
  rep.control.quests_still_saying_not_learned = CASES.filter((c) => learnedClause(c)).map((c) => c.key);

  // ---- P1 / P2 PERTURBED: unhook the one line the UI calls on an open --------------------
  H.reset({});
  E.ui.onBookOpened = null;                    // <- delete the fix
  rep.perturbed = { topics_before: topics().length };
  readAll();
  rep.perturbed.topics_after = topics().length;
  rep.perturbed.gained = rep.perturbed.topics_after - rep.perturbed.topics_before;
  rep.perturbed.books_read_recorded = (H.getQuestState().booksRead || []).length;
  rep.perturbed.quests_still_saying_not_learned = CASES.filter((c) => learnedClause(c)).map((c) => c.key);
  E.ui.onBookOpened = (b) => E._readBook(b);   // <- put it back

  // ---- P4: keep the reading, empty the index --------------------------------------------
  H.reset({});
  readAll();
  const saved = E.questEngine.bookKnowledge;
  rep.index = { books_read: (H.getQuestState().booksRead || []).length, with_index: CASES.filter((c) => learnedClause(c)).map((c) => c.key) };
  E.questEngine.bookKnowledge = new Map();     // <- delete the fix, keep booksRead intact
  rep.index.books_read_still = (H.getQuestState().booksRead || []).length;
  rep.index.without_index = CASES.filter((c) => learnedClause(c)).map((c) => c.key);
  E.questEngine.bookKnowledge = saved;

  // ---- P3: detach the reading position from the save -------------------------------------
  const turnTo = (id, n) => {
    H.openMenu('book', { id });
    for (let i = 0; i < n; i++) {
      H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
      H.queueInputs([{ f: 0, move: [1, 0] }]); H.stepFrames(1);
    }
    const p = H.getUIState().book.page; H.closeMenu(); return p;
  };
  const pageOf = (id) => { H.openMenu('book', { id }); const p = H.getUIState().book.page; H.closeMenu(); return p; };

  H.reset({});
  const pagesFixed = {};
  pagesFixed.reached = turnTo('a-progress-iii', 3);
  const blobA = H.saveState();
  pagesFixed.in_blob = !!(blobA.dialogue && blobA.dialogue.book_pages && Object.keys(blobA.dialogue.book_pages).length);
  H.reset({});
  pagesFixed.after_reset = pageOf('a-progress-iii');
  H.loadState(blobA);
  pagesFixed.after_load = pageOf('a-progress-iii');
  rep.pages_fixed = pagesFixed;

  H.reset({});
  const pagesBroken = {};
  E.ui.bookPages = {};                          // <- the pre-fix shape: a plain object on the UI
  pagesBroken.reached = turnTo('a-progress-iii', 3);
  const blobB = H.saveState();
  pagesBroken.in_blob = !!(blobB.dialogue && blobB.dialogue.book_pages && Object.keys(blobB.dialogue.book_pages).length);
  H.loadState(blobB);
  E.ui.bookPages = {};                          // detached again, as the old build was
  pagesBroken.after_load = pageOf('a-progress-iii');
  rep.pages_broken = pagesBroken;
  E._bindReadingPosition();                     // <- put it back

  return rep;
}, { BOOKS, CASES });

const checks = [];
const add = (id, what, pass, detail) => checks.push({ id, what, pass, detail });
add('P1', 'unhooking onBookOpened takes the 116 taught topics back to 0',
  out.control.gained > 100 && out.perturbed.gained === 0,
  `control gained ${out.control.gained}; perturbed gained ${out.perturbed.gained}; booksRead recorded while unhooked: ${out.perturbed.books_read_recorded}`);
add('P2', 'unhooking onBookOpened brings the "you have not learned book_*" refusal back on all 3 quests',
  out.control.quests_still_saying_not_learned.length === 0 && out.perturbed.quests_still_saying_not_learned.length === 3,
  `with the fix: ${out.control.quests_still_saying_not_learned.length}/3 still refuse; without it: ${out.perturbed.quests_still_saying_not_learned.length}/3`);
add('P3', 'detaching the reading position stops it surviving a save and load',
  out.pages_fixed.after_load === out.pages_fixed.reached && out.pages_fixed.after_reset !== out.pages_fixed.reached
    && out.pages_broken.after_load !== out.pages_broken.reached,
  `fixed: reached ${out.pages_fixed.reached}, after reset ${out.pages_fixed.after_reset}, after load ${out.pages_fixed.after_load}, in blob ${out.pages_fixed.in_blob}; detached: reached ${out.pages_broken.reached}, after load ${out.pages_broken.after_load}`);
add('P4', 'emptying bookKnowledge closes the gates again WITHOUT touching booksRead',
  out.index.with_index.length === 0 && out.index.without_index.length === 3
    && out.index.books_read === out.index.books_read_still && out.index.books_read > 0,
  `${out.index.books_read} books read either way; refusals with the index ${out.index.with_index.length}/3, without it ${out.index.without_index.length}/3`);

const report = { schema: 'elder-souls/w1-library-perturb@1', at: new Date().toISOString(), ...out, checks, page_errors: errors };
report.ok = checks.every((c) => c.pass);
console.log(JSON.stringify(report, null, 2));
for (const c of checks) console.error(`  ${c.pass ? 'RED-ON-DEMAND' : 'DID NOT MOVE  '} ${c.id} ${c.what} — ${c.detail}`);
console.error(`  ${checks.filter((c) => c.pass).length}/${checks.length} consumers demonstrated by perturbation`);
if (args.out) writeJson(args.out, report);
await handle.close();
process.exit(report.ok ? 0 : 1);
