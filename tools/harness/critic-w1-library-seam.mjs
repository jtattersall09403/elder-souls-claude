#!/usr/bin/env node
// critic-w1-library-seam.mjs — RI-UIX05 R3's permitted exception, which the item names as its
// ENTIRE AR-3 seam crossing: "reading a book may add a dialogue topic to `topicsKnown` ... That
// is the same affordance as RI-UIX04 J8 and it is the seam crossing for this item."
//
// 60 of 65 shipped books declare `topics_taught` (116 distinct topics). This asks the running
// engine whether reading one puts any of them into topicsKnown, and whether a topic so gained
// is usable as an S13 parley key — which is the payoff RI-UIX05 §Seam claims.
//
// Written by the W1-LIBRARY round-1 critic; declared under `method_deviations`.

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const BOOKS = [];
for (const f of readdirSync('game/data/books').filter(x => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  for (const b of (Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []))) {
    if ((b.topics_taught || []).length) BOOKS.push({ id: b.id, topics: b.topics_taught });
  }
}

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate((BOOKS) => {
  const H = window.__HARNESS;
  const topics = () => { try { const q = H.getQuestState(); return q && q.topicsKnown ? q.topicsKnown.slice() : null; } catch (e) { return 'ERR ' + String(e).slice(0, 120); } };
  const before = topics();
  const opened = [];
  for (const b of BOOKS) {
    try {
      H.openMenu('book', { id: b.id });
      const ui = H.getUIState();
      if (ui && ui.book && ui.book.id === b.id) opened.push(b.id);
      try { H.closeMenu(); } catch {}
    } catch {}
  }
  const after = topics();
  const gained = Array.isArray(after) && Array.isArray(before) ? after.filter(t => !before.includes(t)) : null;
  const declared = [...new Set(BOOKS.flatMap(b => b.topics))].sort();
  return {
    books_declaring_topics: BOOKS.length,
    distinct_topics_declared: declared.length,
    books_opened: opened.length,
    topics_before: before,
    topics_after: after,
    topics_gained_by_reading_every_book: gained,
    quest_state_shape: (() => { try { return Object.keys(H.getQuestState() || {}); } catch (e) { return String(e).slice(0, 120); } })(),
  };
}, BOOKS);

console.log(JSON.stringify(out, null, 2));
if (args.out) writeJson(args.out, out);
await handle.close();
