#!/usr/bin/env node
// check-book-fold.mjs — does the SAME fold the game runs (`foldBooks`, imported, not
// reimplemented) ever hand the reading UI a book with no text?
//
// Filed for W1-DIALOGUE-AUTHORING-LEAK / defect 2 (T4, content). Mechanism — re-derived here,
// not inherited from any brief — and the same as `game/src/data/fold-books.js`'s header:
// `books/manifest.json` is a 162-entry title-only catalog, shaped exactly like a real book file
// (`{schema, books: [...]}`), loaded 5th of 26 `books/*.json` files
// (`game/data/index.json`), so under an unconditional-overwrite fold it silently replaces the
// real, text-bearing record for any book whose real file loaded before it.
//
// WORLD-SIDE CONSUMER: `foldBooks()` (`game/src/data/fold-books.js`) is the exact function
// `Engine._buildUI()` calls to build the Map the reading UI (`game/src/ui/system.js`, `this.
// data.books.get(id)`) looks a book up in. This script imports that same function — it does not
// reimplement the fold — so a pass here is a pass for the real consumer, not a parallel
// simulation that could drift from it.
//
// TWO ARMS, so the check cannot be vacuous (`--self-test`):
//   FIXED arm: real `books/*.json` files, real `index.json` order, through the REAL `foldBooks`.
//   NAIVE arm (negative control, kept forever): the exact old inline logic this file replaced —
//     `for (const doc of ...) if (Array.isArray(doc.books)) for (const b of doc.books)
//     books.set(b.id, b);` — over the SAME real data. Must reproduce >0 undefined-text books,
//     proving the scenario this check guards is real, not hypothetical.
//
// Exit codes: 0 pass · 1 FIXED arm has an undefined-text book (regression) · 2 self-test failed
// (the NAIVE arm didn't reproduce the bug, so the FIXED-arm pass proves nothing) · 3 usage/IO.
//
// Usage:
//   node tools/books/check-book-fold.mjs               # check the real shipped data
//   node tools/books/check-book-fold.mjs --self-test    # also run the naive negative control
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { foldBooks } from '../../game/src/data/fold-books.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);

/** Reproduces exactly what `loadData()` does for `books/*.json`: key by the file's own
 * top-level `id`, falling back to the filename, in the order `index.json` lists them. */
function loadRealDataBooks() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/index.json'), 'utf8'));
  const bookEntries = index.files.filter((e) => e.path.startsWith('books/'));
  if (bookEntries.length === 0) throw new Error('index.json lists no books/*.json files — has the data layout moved?');
  const dataBooks = {};
  for (const entry of bookEntries) {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', entry.path), 'utf8'));
    dataBooks[doc.id || path.basename(entry.path, '.json')] = doc;
  }
  return { dataBooks, order: bookEntries.map((e) => e.path) };
}

/** The OLD, buggy fold — unconditional last-write-wins. Kept as the negative control. */
function naiveFold(dataBooks) {
  const books = new Map();
  for (const doc of Object.values(dataBooks || {})) {
    if (Array.isArray(doc.books)) for (const b of doc.books) books.set(b.id, b);
    else if (doc.id) books.set(doc.id, doc);
  }
  return books;
}

function undefinedTextIds(map) {
  const bad = [];
  for (const [id, b] of map) if (typeof b.text !== 'string' || b.text.length === 0) bad.push(id);
  return bad.sort();
}

function main() {
  const selfTest = argv.includes('--self-test');
  const { dataBooks, order } = loadRealDataBooks();
  console.log(`loaded ${order.length} books/*.json files in index.json order (manifest.json is #${order.indexOf('books/manifest.json') + 1})`);

  if (selfTest) {
    const naive = naiveFold(dataBooks);
    const naiveBad = undefinedTextIds(naive);
    console.log(`\nNAIVE arm (old inline fold, negative control): ${naiveBad.length} book(s) with no text`);
    if (naiveBad.length === 0) {
      console.log('SELF-TEST FAILED: the naive fold over the REAL current data did not reproduce any');
      console.log('undefined-text books. Either the data changed shape or this check has gone vacuous.');
      process.exit(2);
    }
    console.log('  ' + naiveBad.join(', '));
    console.log('Self-test passed: the scenario this check guards against is real, reproduced on real data.');
  }

  const fixed = foldBooks(dataBooks);
  const fixedBad = undefinedTextIds(fixed);
  console.log(`\nFIXED arm (real foldBooks(), the actual game consumer): ${fixedBad.length} book(s) with no text`);
  if (fixedBad.length) {
    console.log('  ' + fixedBad.join(', '));
    console.log(`\nFAIL: ${fixedBad.length} book(s) would render as "undefined" text in the reading UI.`);
    process.exit(1);
  }
  console.log(`Checked ${fixed.size} distinct book ids; all carry non-empty text through the real fold.`);
  console.log('\nPASS.');
  process.exit(0);
}

main();
