#!/usr/bin/env node
// critic-w1-library-pages.mjs — RI-UIX05 step 2 (K1 across the whole corpus) driven in the
// engine, plus the R3-exception consumption check.
//
// Three questions:
//   1. Do all 65 books open via openMenu('book', {id}), and is the total 324 pages?
//   2. What is the words-per-page distribution over EVERY book (K1: median 120-180,
//      p90 <= 240, p10 >= 80) — reported both over all pages and excluding each book's
//      final (partial) page, because that is the builder's claim about K1 being unsatisfiable.
//   3. R3's permitted exception and RI-UIX05's declared AR-3 seam crossing: "reading a book may
//      add a dialogue topic to topicsKnown". 60 of 65 books declare `topics_taught`. Does
//      reading one in the running engine put anything into topicsKnown?
//
// Written by the W1-LIBRARY round-1 critic; declared under `method_deviations`.

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-library-pages.mjs'); process.exit(0); }

// book ids straight off disk, so the engine cannot quietly drop one and still look complete
const BOOKS = [];
for (const f of readdirSync('game/data/books').filter(x => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  const list = Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []);
  for (const b of list) BOOKS.push({ id: b.id, file: f, words: String(b.text || '').trim().split(/\s+/).filter(Boolean).length, topics: (b.topics_taught || []).slice(0, 4) });
}

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate((BOOKS) => {
  const H = window.__HARNESS;
  const rows = [], failed = [];
  for (const b of BOOKS) {
    try {
      H.openMenu('book', { id: b.id });
      const ui = H.getUIState();
      if (!ui || !ui.book || ui.book.id !== b.id) { failed.push({ id: b.id, reason: 'did not open' }); continue; }
      rows.push({ id: b.id, words: b.words, pages: ui.book.pages, wordsOnPage: (ui.book.words_per_page || []).slice() });
    } catch (e) { failed.push({ id: b.id, reason: String(e).slice(0, 160) }); }
  }

  // R3 exception / AR-3 seam: does reading a book teach a topic?
  const withTopics = BOOKS.find(b => b.topics && b.topics.length);
  const seam = { book: withTopics ? withTopics.id : null, declares: withTopics ? withTopics.topics : [] };
  try {
    const before = H.getQuestState ? H.getQuestState() : null;
    seam.topics_before = before && before.topics_known ? before.topics_known.slice() : null;
    H.openMenu('book', { id: withTopics.id });
    const ui = H.getUIState();
    seam.pages = ui && ui.book ? ui.book.pages : 0;
    try { H.closeMenu(); } catch {}
    const after = H.getQuestState ? H.getQuestState() : null;
    seam.topics_after = after && after.topics_known ? after.topics_known.slice() : null;
    seam.gained = (seam.topics_after || []).filter(t => !(seam.topics_before || []).includes(t));
  } catch (e) { seam.error = String(e).slice(0, 240); }

  return { n_asked: BOOKS.length, n_opened: rows.length, failed, rows, seam };
}, BOOKS);

const total = out.rows.reduce((a, r) => a + r.pages, 0);
const all = [], nonfinal = [];
for (const r of out.rows) {
  for (let i = 0; i < r.wordsOnPage.length; i++) {
    const v = r.wordsOnPage[i];
    if (v == null) continue;
    all.push(v);
    if (i < r.wordsOnPage.length - 1) nonfinal.push(v);
  }
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * p / 100; const lo = Math.floor(k); return +(s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo)).toFixed(1); };
const summ = a => a.length ? { n: a.length, p10: pct(a, 10), median: pct(a, 50), p90: pct(a, 90), min: Math.min(...a), max: Math.max(...a) } : null;

const report = {
  books_asked: out.n_asked, books_opened: out.n_opened, failed: out.failed,
  total_pages: total,
  words_per_page_all_pages: summ(all),
  words_per_page_excluding_final: summ(nonfinal),
  single_page_books: out.rows.filter(r => r.pages === 1).map(r => r.id),
  seam_r3: out.seam,
  page_errors: errors,
};
console.log(JSON.stringify(report, null, 2));
if (args.out) writeJson(args.out, { ...report, rows: out.rows });
await handle.close();
