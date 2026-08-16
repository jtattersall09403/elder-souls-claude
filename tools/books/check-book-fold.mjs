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
// reimplement the fold.
//
// =========================================================================================
// ROUND 2 — THE ROUND-1 HEADER SAID SOMETHING THIS CHECK COULD NOT BACK, AND IT IS WITHDRAWN
// =========================================================================================
// Round 1's header claimed *"a pass here is a pass for the real consumer, not a parallel
// simulation that could drift from it."* The critic ran the control that sentence invites —
// **revert `engine.js`'s call site and leave `foldBooks()` itself correct** — and this check
// **exited 0**, alongside both dialogue checks. The game would have shipped 24 books rendering
// the literal word "undefined" with nothing red. `RI-MTH07` §A calls that shape an **orphan
// model**: a correct rule with no caller. `RI-MTH07` §D3, verbatim: *a comment asserting a
// check is not a check.* The claim was true of the FUNCTION and false of the BUILD, and
// importing the function can never tell those apart.
//
// So the wiring is now asserted, not narrated: `tools/lib/call-site.mjs` reads `engine.js` as
// text (comments stripped, so a call site quoted in a comment cannot satisfy it) and requires
// the import, the `foldBooks(this.data.books)` call, and the ABSENCE of the old unconditional
// `books.set(b.id, b)` fold in `_buildUI`. Read that file for the honest limit: a call site in
// dead code would still match, so this is weaker than driving the engine and much stronger
// than round 1's nothing. `HAZARDS` §31 rule 2.
//
// TWO ARMS, so the check cannot be vacuous (`--self-test`):
//   FIXED arm: real `books/*.json` files, real `index.json` order, through the REAL `foldBooks`.
//   NAIVE arm (negative control, kept forever): the exact old inline logic this file replaced —
//     `for (const doc of ...) if (Array.isArray(doc.books)) for (const b of doc.books)
//     books.set(b.id, b);` — over the SAME real data. Must reproduce >0 undefined-text books,
//     proving the scenario this check guards is real, not hypothetical.
//
// Exit codes: 0 pass · 1 FIXED arm has an undefined-text book (regression) · 2 self-test failed
// (the NAIVE arm didn't reproduce the bug, so the FIXED-arm pass proves nothing) · 3 usage/IO
// · 4 the shipped call site is gone — `foldBooks()` is correct and nothing calls it.
//
// Usage:
//   node tools/books/check-book-fold.mjs               # check the real shipped data
//   node tools/books/check-book-fold.mjs --self-test    # also run the naive negative control
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { foldBooks } from '../../game/src/data/fold-books.js';
import { assertCallSites, reportCallSites } from '../lib/call-site.mjs';

// Round-1 control C, now a standing assertion. The needles are deliberately three different
// shapes so that removing any one of import / call / old-loop-absence goes red.
const CALL_SITES = [
  {
    file: 'game/src/engine.js',
    why: "_buildUI() must build the reading UI's book Map by CALLING foldBooks(), not inline",
    must_contain: [
      /import\s*\{[^}]*\bfoldBooks\b[^}]*\}\s*from\s*'\.\/data\/fold-books\.js'/,
      'foldBooks(this.data.books)',
    ],
    // The exact old unconditional last-write-wins fold. `books.add(...)` folds elsewhere in
    // engine.js (the opacity, canon and knowledge indexes at ~2887/~2946/~5522) build Sets of
    // ids and are order-independent by construction, so this needle cannot match them.
    must_not_contain: ['for (const b of doc.books) books.set(b.id, b)'],
  },
  {
    file: 'game/src/data/fold-books.js',
    why: 'the guard that makes the fold load-order-independent must still be in the function',
    must_contain: [/typeof existing\.text === 'string' && typeof b\.text !== 'string'/],
  },
];

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

  // The arm above proves the FUNCTION. This one proves the BUILD calls it — round-1 control C.
  const wired = reportCallSites('check-book-fold', assertCallSites(ROOT, CALL_SITES));
  if (!wired) {
    console.log('\nFAIL: foldBooks() folds correctly and the shipped build does not use it. The');
    console.log('reading UI would go back to 24 books drawing the literal word "undefined", and');
    console.log('the arm above would still be green — which is exactly why this arm exists.');
    process.exit(4);
  }

  console.log('\nPASS: the fold is correct AND the shipped build calls it.');
  process.exit(0);
}

main();
