#!/usr/bin/env node
// critic-w1-library-consume.mjs — the ARBITRATION §3 CONSUMPTION check for W1-LIBRARY.
//
// The claim under test: "a player can act on 17 books", of which three gate NON-VIOLENT quest
// resolutions through `requires.knowledge`:
//
//   book_the_court_and_the_tide  -> Q-SOUL-02 res_seal
//   book_the_rootless_egg        -> Q-LILM-01 res_rootkeepers
//   book_the_sap_and_the_knife   -> Q-DEEP-01 res_broker
//
// CONSUMPTION says: name the world-side consumer and demonstrate it by perturbing the model and
// watching an entity change behaviour. For a book that means: OPEN THE BOOK IN THE RUNNING
// ENGINE, then reach the resolution; and as a control, do NOT open it and confirm the resolution
// is refused. A book nothing reads back is a text file, not a game object.
//
// Written by the W1-LIBRARY round-1 critic; declared under `method_deviations`.
//
// Run: node tools/harness/critic-w1-library-consume.mjs [--out <file>]

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `critic-w1-library-consume.mjs — drive the three knowledge-gated resolutions.`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const CASES = [
  { quest: 'Q-SOUL-02', res: 'res_seal', book: 'the-court-and-the-tide', key: 'book_the_court_and_the_tide' },
  { quest: 'Q-LILM-01', res: 'res_rootkeepers', book: 'the-rootless-egg', key: 'book_the_rootless_egg' },
  { quest: 'Q-DEEP-01', res: 'res_broker', book: 'the-sap-and-the-knife', key: 'book_the_sap_and_the_knife' },
];

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));

await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate(async (CASES) => {
  const H = window.__HARNESS;
  const rep = { cases: [], api: {}, all_books_open: null, pagination: null };
  for (const fn of ['openMenu', 'getUIState', 'questOpen', 'questResolutions', 'questResolve', 'questSetFlag', 'questReveal'])
    rep.api[fn] = typeof H[fn] === 'function';

  // ---- 1. every book opens, and its page count, straight out of the engine ------------------
  rep.book_ids_found = null;

  // ---- 2. the three cases -------------------------------------------------------------------
  for (const c of CASES) {
    const row = { ...c };

    // (a) CONTROL: without reading the book, is the resolution offered?
    try { H.questOpen(c.quest); } catch (e) { row.open_error = String(e).slice(0, 160); }
    const before = (() => { try { return H.questResolutions(c.quest); } catch (e) { return { error: String(e).slice(0, 160) }; } })();
    row.control = summarise(before, c.res);

    // (b) READ THE BOOK in the running engine — the thing a player does.
    try {
      H.openMenu('book', { id: c.book });
      const ui = H.getUIState();
      row.book_opened = !!(ui && ui.book && ui.book.id === c.book);
      row.book_pages = ui && ui.book ? ui.book.pages : null;
      // turn every page, as a reader would
      if (row.book_opened && ui.book.pages > 1) {
        for (let i = 1; i < ui.book.pages; i++) { try { H.uiInput ? H.uiInput('next') : null; } catch {} }
      }
      try { H.closeMenu ? H.closeMenu() : H.openMenu('none', {}); } catch {}
    } catch (e) { row.book_open_error = String(e).slice(0, 200); }

    // (c) TREATMENT: having read it, is the resolution offered now?
    const after = (() => { try { return H.questResolutions(c.quest); } catch (e) { return { error: String(e).slice(0, 160) }; } })();
    row.after_reading = summarise(after, c.res);

    // (d) can the knowledge key be injected AT ALL by any shipped route?
    try {
      const r = H.questReveal(c.quest, c.key);
      row.reveal_by_key = { ok: !!(r && r.ok), raw: JSON.stringify(r).slice(0, 200) };
    } catch (e) { row.reveal_by_key = { ok: false, threw: String(e).slice(0, 200) }; }

    // (e) forced attempt: try to resolve regardless, and record the refusal reason verbatim.
    try {
      const r = H.questResolve(c.quest, c.res);
      row.forced_resolve = JSON.stringify(r).slice(0, 400);
    } catch (e) { row.forced_resolve = 'THREW ' + String(e).slice(0, 300); }

    rep.cases.push(row);
  }

  function summarise(list, resId) {
    if (!list) return { none: true };
    if (list.error) return { error: list.error };
    const arr = Array.isArray(list) ? list : (list.resolutions || []);
    const hit = arr.find(x => x && (x.id === resId));
    return {
      n: arr.length,
      found: !!hit,
      available: hit ? (hit.available !== undefined ? hit.available : null) : null,
      why: hit ? (hit.why || null) : null,
      raw: hit ? JSON.stringify(hit).slice(0, 320) : null,
    };
  }
  return rep;
}, CASES);

out.page_errors = errors;
console.log(JSON.stringify(out, null, 2));
if (args.out) writeJson(args.out, out);
await handle.close();
