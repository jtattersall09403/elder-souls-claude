// fold-books.js — the ONE place that turns the loaded `books/*.json` documents into the Map
// the reading UI looks a book up in. Pure, no DOM, so a Node check can call the exact function
// the game calls (RI-MTH07: a corrected data file that nothing reads scores zero — this is
// what makes the world-side consumer testable outside a browser).
//
// Filed for W1-DIALOGUE-AUTHORING-LEAK / defect 2 (T4, content). Mechanism, confirmed by
// reading, not assumed:
//
//   `game/data/books/manifest.json` is a CATALOG — 162 {id, title} stubs, 0 of them carrying a
//   `text` field (`python3 -c "import json;d=json.load(open('game/data/books/manifest.json'));
//   print(len(d['books']), len([b for b in d['books'] if 'text' in b]))"` -> `162 0`, run
//   2026-08-16). It is loaded like every other `books/*.json` file and shaped the same way
//   (`{schema, books: [...]}`), so the old fold below could not tell a catalog stub from a real
//   book record — it treated every `doc.books` array as equally authoritative and let whichever
//   loaded LAST win, unconditionally:
//
//     for (const doc of Object.values(this.data.books || {})) {
//       if (Array.isArray(doc.books)) for (const b of doc.books) books.set(b.id, b);
//       else if (doc.id) books.set(doc.id, doc);
//     }
//
//   `game/data/index.json` lists 26 `books/*.json` files and `manifest.json` is 5th (`grep -n
//   '"path": "books/' game/data/index.json | nl`, run 2026-08-16). Any book whose real content
//   file loads BEFORE index 5 — `a-progress-through-the-southern-marsh.json`, `deep-time.json`,
//   `foundational.json`, `interface-readables.json` (indices 1-4) — gets its real `{id, title,
//   text, ...}` record overwritten by manifest's `{id, title}` stub, and nothing loads after
//   manifest to put it back (files 6-26 don't share those particular ids). 24 books end up with
//   no `text` field this way, confirmed by simulating the exact fold above against the real
//   files in the real load order (see `tools/books/check-book-fold.mjs`, which keeps that
//   simulation alive as the negative-control self-test). `the-sap-and-the-ledger`
//   (foundational.json) was the one caught live.
//
// THE FIX. Load order should not decide correctness. A document without a `text` field must
// never be allowed to blot out one that has it, regardless of which file loaded when, because
// the alternative is "safe until someone reorders index.json or adds another catalog file."
'use strict';

/**
 * Fold every `books/*.json` document (as loaded into `Engine.data.books`, one entry per file,
 * keyed by that file's own top-level id) into the single Map the reading UI looks a book id up
 * in.
 *
 * @param {Object<string, any>} dataBooks — `this.data.books`: file-id -> parsed document.
 * @returns {Map<string, any>} book id -> book record.
 */
export function foldBooks(dataBooks) {
  const books = new Map();
  for (const doc of Object.values(dataBooks || {})) {
    if (Array.isArray(doc.books)) {
      for (const b of doc.books) {
        const existing = books.get(b.id);
        // A catalog/manifest entry (title only, no text) must never overwrite a real book
        // record that already has text — no matter which loaded first. This is the whole fix:
        // it makes the Map's correctness independent of `index.json`'s file order.
        if (existing && typeof existing.text === 'string' && typeof b.text !== 'string') continue;
        books.set(b.id, b);
      }
    } else if (doc.id) {
      books.set(doc.id, doc);
    }
  }
  return books;
}
