#!/usr/bin/env node
// w1-library-turns.mjs — RI-UIX05 K5, K6 and K7, driven in a real browser.
//
// The round-1 verdict, secondary observation 6: *"Six of RI-UIX05's ten checks (K2, K3, K5, K6,
// K7, K10) have been run by nobody."* K2 and K3 were measured by the round-2 builder with
// `text-metrics.mjs`. This is the other three, and they are the ones that need the simulation
// running rather than a screenshot:
//
//   K5  Open and turn latency (§B T1, T2, T3, T4)
//         T1  the book is readable on the FRAME `interact` resolves — no fade-in, no loading
//         T2  ONE input per turn, both directions
//         T3  the next page's full text is rendered within 6 frames (100 ms) of the input
//         T4  a turn animation, if any, is skippable by the next input and never blocks T3
//   K6  Persistence (§B T5) — close and reopen returns to the page you were on, PER BOOK, and
//         the item says *"persisted in the save"*, so the save/load leg is the one that counts
//   K7  Pause rule (§B T6, RI-UIX03 §A) — 0 frames advance out of combat, 120 of 120 in combat
//
// HOW THIS PROBE IS BUILT TO FAIL, which is the only reason to trust it (AGENT-PROTOCOL failure
// mode 2, "a probe that cannot fail is worse than no probe"). Every check below has a paired
// CONTROL that must come out the other way, taken in the same page, on the same build:
//
//   * T1's control is `pages_before_any_step`: if the book only became readable after a step,
//     the same read one frame earlier would be empty. We read it at the same frame index and
//     assert non-empty text, and we assert the frame counter did not move.
//   * T2/T3's control is a queued input that is NOT a turn (`move: [0,0]`): the page must not
//     advance. A turn detector that fires on any step is caught by it.
//   * T5's control is a SECOND book left on page 0: if `bookPages` were a single scalar rather
//     than a per-book map, book B would come back on book A's page and the control goes red.
//   * T6's control is the same 120 frames with NO menu open at all: the frame counter must move
//     by 120. If it does not, the pause measurement is measuring a stopped world and means
//     nothing — which is the defect `d4c43f1` landed a fix for, so the control is not theoretical.
//
// Written by the W1-LIBRARY round-2 builder. A builder does not grade itself: this reports
// numbers and their controls, and the pass/fail column is the item's own bands, not an opinion.
//
// Usage:  node tools/harness/w1-library-turns.mjs [--out reports/w1-library-turns.json]

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-library-turns.mjs'); process.exit(0); }

// Pick the fixture books off disk rather than naming ids in the tool: a book that is renamed
// must not silently turn this probe into a no-op.
const ALL = [];
for (const f of readdirSync('game/data/books').filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  for (const b of (Array.isArray(doc.books) ? doc.books : doc.id ? [doc] : [])) {
    ALL.push({ id: b.id, words: String(b.text || '').trim().split(/\s+/).filter(Boolean).length });
  }
}
ALL.sort((a, b) => a.words - b.words);
// RI-UIX05 step 1's `ui-book` spread: a short note, a median book and a long volume.
const FIXTURE = [ALL[0], ALL[Math.floor(ALL.length / 2)], ALL[ALL.length - 1]].filter(Boolean);

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate((FIXTURE) => {
  const H = window.__HARNESS;
  const res = { k5: [], k6: null, k7: null, why_out_of_combat: null, notes: [] };
  const bookOf = () => { const u = H.getUIState(); return u && u.book ? u.book : null; };
  const textOn = () => {
    const u = H.getUIState();
    if (!u) return '';
    // The page's words as the SCREEN has them, not as the JSON has them. §A B1 and step 1 both
    // say "from getUIState().elements[].text, not OCR", so that is what a rendered page means.
    const els = (u.elements || []).filter((e) => e && typeof e.text === 'string');
    return els.map((e) => e.text).join(' ').trim();
  };

  // ---------------------------------------------------------------- WHY §B IS DRIVEN IN COMBAT
  //
  // Read this before the numbers below, because it is the reason six of RI-UIX05's ten checks
  // had never been run by anybody and were scored `unmeasurable ⇒ 0` in round 1.
  //
  // `InputPipeline.latchForStep(frame)` fires a scripted event when
  // `event.f + scriptBase === frame`, and `scriptBase` is `engine.sim.frame` at the moment
  // `queueInputs()` was called. Out of combat a menu PAUSES the world (T6, and it is correct):
  // `Engine._step()` takes the paused branch, latches input, runs `uiDriver`, and **returns
  // before `stepOnce()`**, so `sim.frame` never advances. The comparison is therefore against a
  // frozen number: only `f: 0` can ever match, it matches on the first paused frame, and every
  // event at `f >= 1` waits for a frame that will not arrive. A page turn needs two events —
  // the stick pushed and the stick returned to neutral, because `UISystem.step` edge-detects the
  // axis — so it needs two frames, and out of combat there is only ever one.
  //
  // This is a HARNESS limit, not a defect a player can meet: `RealInput` writes `pendingPress`
  // and `moveX` straight into the pipeline from DOM events and is not frame-keyed at all, so a
  // person pushing a stick turns the page. It is nonetheless why nothing had measured §B.
  //
  // The experiment below is the proof rather than the argument: with the world paused, queue the
  // turn at `f: 0` (which CAN match the frozen frame) and again at `f: 1` (which cannot). If the
  // f:0 turn lands and the f:1 turn does not, the frame-keying is the cause and the UI is fine.
  try {
    const w = { book: FIXTURE[FIXTURE.length - 1].id };
    try { H.closeMenu(); } catch {}
    H.openMenu('book', { id: w.book });
    w.paused = H.getUIState().paused;
    const f0 = H.getFrame();
    const p0 = bookOf().page;
    H.queueInputs([{ f: 0, move: [1, 0] }]);
    H.stepFrames(1);
    w.page_after_f0_event = bookOf().page;
    w.turned_at_f0 = bookOf().page !== p0;
    const p1 = bookOf().page;
    H.queueInputs([{ f: 1, move: [0, 0] }, { f: 2, move: [1, 0] }, { f: 3, move: [0, 0] }]);
    H.stepFrames(30);
    w.page_after_f1_events = bookOf().page;
    w.turned_at_f1 = bookOf().page !== p1;
    w.frame_moved_while_paused = H.getFrame() - f0;
    w.conclusion = (w.turned_at_f0 && !w.turned_at_f1 && w.frame_moved_while_paused === 0)
      ? 'CONFIRMED: scripted input is keyed to sim.frame and a paused world has none. The UI turns pages; the queue cannot reach it past f:0.'
      : 'NOT the expected shape — read the fields, the explanation above may be wrong.';
    H.closeMenu();
    res.why_out_of_combat = w;
  } catch (e) { res.why_out_of_combat = { error: String(e).slice(0, 300) }; }

  // ---------------------------------------------------------------- K7 (T6)
  // RI-UIX03 §A unchanged: reading pauses the world OUT of combat and does NOT pause it in one.
  try {
    const k7 = {};
    const b = FIXTURE[FIXTURE.length - 1];
    try { H.closeMenu(); } catch {}
    // CONTROL FIRST, and it is the one that matters: 120 frames with nothing open must advance
    // the world by 120. A stopped world would make "0 out of combat" look like a pass.
    const c0 = H.getFrame(); H.stepFrames(120);
    k7.control_no_menu_delta = H.getFrame() - c0;

    H.openMenu('book', { id: b.id });
    k7.reported_paused_out_of_combat = H.getUIState().paused;
    const o0 = H.getFrame(); H.stepFrames(120);
    k7.out_of_combat_delta = H.getFrame() - o0;
    H.closeMenu();

    // in combat
    H.setSeed(1337);
    H.loadState('arena_probe');
    H.stepFrames(20);
    k7.in_combat_before_open = H.inCombat ? H.inCombat() : null;
    H.openMenu('book', { id: b.id });
    k7.reported_paused_in_combat = H.getUIState().paused;
    const i0 = H.getFrame(); H.stepFrames(120);
    k7.in_combat_delta = H.getFrame() - i0;
    H.closeMenu();
    k7.pass = k7.control_no_menu_delta === 120 && k7.out_of_combat_delta === 0 && k7.in_combat_delta === 120;
    res.k7 = k7;
  } catch (e) { res.k7 = { error: String(e).slice(0, 300) }; }

  // ---------------------------------------------------------------- K5
  // Driven IN COMBAT, where the simulation advances and the queue can therefore reach the UI.
  // This is not a contrived state: T6 says in as many words that reading a book during a fight
  // is permitted, so the reading screen in combat is a shipped, specified configuration, and it
  // is the one where the player's own input route and the probe's agree frame for frame.
  H.setSeed(1337);
  H.loadState('arena_probe');
  H.stepFrames(20);
  res.driven_in_combat = true;
  for (const b of FIXTURE) {
    const row = { id: b.id, words: b.words };
    try {
      H.closeMenu();
    } catch { /* nothing open */ }
    try {
      // --- T1: readable on the frame the open resolves.
      const f0 = H.getFrame();
      H.openMenu('book', { id: b.id });
      const bk0 = bookOf();
      row.opened = !!bk0 && bk0.id === b.id;
      row.pages = bk0 ? bk0.pages : 0;
      row.t1_text_len_same_frame = textOn().length;
      row.t1_frame_did_not_move = H.getFrame() === f0;
      row.t1_pass = row.opened && row.t1_text_len_same_frame > 0 && row.t1_frame_did_not_move;

      if (row.pages < 2) { row.skipped_turns = 'single-page book'; res.k5.push(row); continue; }

      // --- T2/T3: one input per turn, new page's full text inside 6 frames.
      // The stick is EDGE-detected in UISystem.step, so it must return to neutral between
      // turns or the second press is not an edge and is not a turn. That is the game's rule,
      // not the probe's, and a probe that held the stick would measure zero turns and call it
      // a pass.
      const lat = [], deltas = [];
      let prevPage = bookOf().page;
      let prevText = textOn();
      const N = Math.min(20, row.pages - 1);
      for (let i = 0; i < N; i++) {
        const at = H.getFrame();
        H.queueInputs([{ f: 1, move: [1, 0] }, { f: 2, move: [0, 0] }]);
        let seen = null;
        for (let k = 1; k <= 12 && seen === null; k++) {
          H.stepFrames(1);
          const bk = bookOf();
          if (!bk) break;
          if (bk.page !== prevPage) {
            const t = textOn();
            // T3 is "the next page's text is FULLY RENDERED". A page number that moved while
            // the text is still the old page's, or is empty, is not a turn — it is a turn
            // animation in progress, and T4 says that must never block T3.
            if (t.length > 0 && t !== prevText) { seen = H.getFrame() - at; deltas.push(bk.page - prevPage); prevPage = bk.page; prevText = t; }
          }
        }
        lat.push(seen === null ? -1 : seen);
        if (seen === null) break;
      }
      row.t2_turns = lat.filter((x) => x > 0).length;
      row.t2_page_deltas = [...new Set(deltas)];
      // ONE INPUT, ONE SPREAD. `getUIState().book.page` is a 1-based PAGE number derived from
      // the spread index (`focus.book.page * 2 + 1`), and §A B6 says a two-page spread is the
      // Morrowind form and is preferred — so one input advancing the reported page by 2 is T2
      // satisfied, not violated. The first cut of this probe asserted `=== 1` and called a
      // correct two-page spread a failure. The unit, not the game, was wrong.
      row.t2_spread_is_two_pages = deltas.length > 0 && deltas.every((d) => d === 2);
      row.t2_one_spread_per_input = deltas.length > 0 && deltas.every((d) => d === 1 || d === 2)
        && new Set(deltas).size === 1;
      row.t3_latency_frames = lat;
      row.t3_max = lat.length ? Math.max(...lat) : null;
      row.t3_pass = row.t3_max !== null && row.t3_max > 0 && row.t3_max <= 6;

      // --- CONTROL for T2/T3: a queued input that is not a turn must not move the page.
      const pgC = bookOf().page;
      H.queueInputs([{ f: 1, move: [0, 0] }]);
      H.stepFrames(8);
      row.control_neutral_stick_moved_page = bookOf().page !== pgC;

      // --- T2 backwards, which the item asks for explicitly ("both directions").
      const pgB = bookOf().page;
      H.queueInputs([{ f: 1, move: [-1, 0] }, { f: 2, move: [0, 0] }]);
      H.stepFrames(8);
      row.t2_back_delta = pgB - bookOf().page;

      // --- T4: two turns two frames apart; the second must be honoured, i.e. an animation
      // cannot swallow it.
      //
      // REWIND FIRST. The turns above left the book at its last spread, and the spread index is
      // now correctly clamped there — so a T4 run from that position measures the clamp and
      // reports "the second turn was swallowed". It was not; there was nowhere to turn to. This
      // is the trap AGENT-PROTOCOL "how we lose" #4 describes from the other side: the control
      // has to be able to exhibit the thing being measured, and a book at its end cannot.
      for (let i = 0; i < 40; i++) { H.queueInputs([{ f: 1, move: [-1, 0] }, { f: 2, move: [0, 0] }]); H.stepFrames(4); }
      row.t4_rewound_to = bookOf().page;
      const pgD = bookOf().page;
      H.queueInputs([{ f: 1, move: [1, 0] }, { f: 2, move: [0, 0] }, { f: 3, move: [1, 0] }, { f: 4, move: [0, 0] }]);
      H.stepFrames(10);
      row.t4_two_turns_two_frames_apart = bookOf().page - pgD;
      // Two turns => two spreads => 4 reported pages. Same unit trap as T2.
      row.t4_pass = row.t4_two_turns_two_frames_apart === (row.t2_spread_is_two_pages ? 4 : 2);

      // --- OVER-TURN, the regression guard for the defect this round found and fixed.
      // `focus.book.page` was floored and never capped while `drawBook()` clamped the spread it
      // drew, so holding right walked the model past the end of the book and `getUIState()`
      // reported a page that was not on screen (measured: page 25 of an 11-page book). Turn
      // right far past the end and assert the reported page stays inside the book; then assert
      // ONE press of left moves it, which is what a reader would expect and what the unbounded
      // index made impossible.
      for (let i = 0; i < 30; i++) { H.queueInputs([{ f: 1, move: [1, 0] }, { f: 2, move: [0, 0] }]); H.stepFrames(6); }
      row.overturn_reported_page = bookOf().page;
      row.overturn_book_pages = bookOf().pages;
      row.overturn_in_range = bookOf().page <= bookOf().pages;
      const pgE = bookOf().page;
      H.queueInputs([{ f: 1, move: [-1, 0] }, { f: 2, move: [0, 0] }]);
      H.stepFrames(8);
      row.overturn_one_left_moves = bookOf().page < pgE;
      row.overturn_pass = row.overturn_in_range && row.overturn_one_left_moves;
    } catch (e) { row.error = String(e).slice(0, 240); }
    res.k5.push(row);
  }

  // ---------------------------------------------------------------- K6 (T5)
  // "closing and reopening a book returns to the page you were on, per book, persisted in the
  // save". Three legs, and the third is the one the item's wording actually demands.
  try {
    const [a, , c] = FIXTURE;
    const long = FIXTURE.reduce((m, x) => (x.words > m.words ? x : m), FIXTURE[0]);
    const other = FIXTURE.find((x) => x.id !== long.id) || a || c;
    const k6 = { book: long.id, control_book: other.id };
    try { H.closeMenu(); } catch {}
    H.openMenu('book', { id: long.id });
    // Rewind to the front first: K5 left this book at its last spread, and a persistence test
    // that starts at the end can neither move forward nor tell a restored position from a
    // clamped one. Turning left is the player's own route back, so this is not a harness poke.
    for (let i = 0; i < 40; i++) { H.queueInputs([{ f: 1, move: [-1, 0] }, { f: 2, move: [0, 0] }]); H.stepFrames(4); }
    k6.rewound_to = bookOf().page;
    // walk forward three spreads with real inputs, not by setting a field
    for (let i = 0; i < 3; i++) { H.queueInputs([{ f: 1, move: [1, 0] }, { f: 2, move: [0, 0] }]); H.stepFrames(8); }
    k6.left_on_page = bookOf().page;
    // CONTROL: a second book that was never turned must come back on page 0. If `bookPages`
    // were a scalar this goes red.
    H.closeMenu();
    H.openMenu('book', { id: other.id });
    k6.control_other_book_page_on_open = bookOf().page;
    H.closeMenu();

    // leg 1: close and reopen in the same session
    H.openMenu('book', { id: long.id });
    k6.reopen_same_session = bookOf().page;
    H.closeMenu();

    // leg 2/3: SAVE, disturb the live world, LOAD, reopen. A round trip that only
    // re-serialises proves nothing (AGENT-PROTOCOL failure mode 3), so the page is moved to
    // somewhere else between the save and the load and the live world is asked afterwards.
    const blob = H.saveState();
    k6.blob_has_book_pages = !!(blob && blob.dialogue && blob.dialogue.book_pages && Object.keys(blob.dialogue.book_pages).length);
    k6.blob_book_pages = blob && blob.dialogue ? blob.dialogue.book_pages : null;
    H.openMenu('book', { id: long.id });
    for (let i = 0; i < 2; i++) { H.queueInputs([{ f: 1, move: [1, 0] }, { f: 2, move: [0, 0] }]); H.stepFrames(8); }
    k6.disturbed_to_page = bookOf().page;
    H.closeMenu();
    H.loadState(blob);
    H.openMenu('book', { id: long.id });
    k6.after_save_load = bookOf().page;
    // `book.page` is 1-based, so an untouched book reports page 1 (spread 0), not 0. The blob
    // stores the SPREAD index, so `left_on_page === blob_spread * 2 + 1` is the two units
    // agreeing — and if they ever stop agreeing, that is the bug, not a unit confusion.
    k6.blob_spread_for_book = k6.blob_book_pages ? k6.blob_book_pages[k6.book] : null;
    k6.blob_agrees_with_live = k6.blob_spread_for_book !== null
      && k6.blob_spread_for_book * 2 + 1 === k6.left_on_page;
    k6.pass = k6.rewound_to === 1 && k6.reopen_same_session === k6.left_on_page
      && k6.after_save_load === k6.left_on_page
      && k6.control_other_book_page_on_open === 1
      && k6.blob_has_book_pages && k6.blob_agrees_with_live
      && k6.disturbed_to_page !== k6.left_on_page;
    H.closeMenu();
    res.k6 = k6;
  } catch (e) { res.k6 = { error: String(e).slice(0, 300) }; }

  return res;
}, FIXTURE);

out.page_errors = errors;
const k5pass = out.k5.length > 0 && out.k5.every((r) => r.t1_pass && (r.skipped_turns
  || (r.t3_pass && r.t2_one_spread_per_input && r.t4_pass && r.overturn_pass && !r.control_neutral_stick_moved_page)));
out.verdict = {
  K5: k5pass ? 'PASS' : 'FAIL',
  K6: out.k6 && out.k6.pass ? 'PASS' : 'FAIL',
  K7: out.k7 && out.k7.pass ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(out, null, 2));
writeJson(args.out || 'reports/w1-library-turns.json', out);
await handle.close();
process.exit(Object.values(out.verdict).every((v) => v === 'PASS') ? 0 : 1);
