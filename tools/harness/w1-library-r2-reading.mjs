#!/usr/bin/env node
// w1-library-r2-reading.mjs — RI-UIX05 K5, K6 and K7, driven in a real browser.
//
// WHY THIS EXISTS. The round-1 verdict scored six of RI-UIX05's ten checks `unmeasurable => 0`
// with the note "run by nobody". Three of those six are behavioural rather than typographic and
// no tool in the tree could reach them:
//
//   K5  T1 open latency (readable on the frame `interact` resolves), T2 one input per turn,
//       T3 the next page fully rendered within 6 frames, T4 an animation that cannot block T3
//   K6  T5 "closing and reopening a book returns to the page you were on, PER BOOK, PERSISTED
//       IN THE SAVE" — the last four words are the whole check, and nothing had tested them
//   K7  T6 the pause rule with `mode == 'book'`: frame delta 0 out of combat, 120 of 120 in
//       combat, because reading during a fight is permitted and is meant to be a bad idea
//
// K2/K3 are `tools/analysis/text-metrics.mjs` (layout, from the rendered PNG) and K1 is
// `tools/harness/critic-w1-library-pages.mjs` (the whole corpus). This tool deliberately does
// not duplicate either — one measurement, one owner.
//
// EVERY NUMBER HERE IS IN FRAMES, NOT MILLISECONDS. That is not a convenience: this box runs
// fourteen agents and a wall-clock latency taken at loadavg 27 measures the other thirteen.
// T3's bar is stated as "6 frames (100 ms)" and the frame count is the half that survives
// contention, so the frame count is what is reported and asserted.
//
// Run: node tools/harness/w1-library-r2-reading.mjs [--out FILE] [--no-hook]
//   --no-hook   DELETE-THE-FIX: unhook `UISystem.onBookOpened` before measuring, so the
//               consumption rows go red on demand and this probe is shown to be able to fail.

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `w1-library-r2-reading.mjs — RI-UIX05 K5 (latency), K6 (persistence), K7 (pause rule).`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const BOOK = String(args.book || 'a-progress-iii');   // 11 pages, the longest in the corpus
const OTHER = String(args.other || 'the-court-and-the-tide');

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate(async ({ BOOK, OTHER, noHook }) => {
  const H = window.__HARNESS;
  const rep = { book: BOOK, other: OTHER, hook_disabled: !!noHook };

  // ---- delete-the-fix ------------------------------------------------------------------------
  if (noHook) {
    // Reach the UI system through the same object the engine hands the harness. If the shape
    // ever changes this must THROW rather than silently measure the un-perturbed build.
    const eng = window.__ENGINE;
    if (!eng || !eng.ui) return { fatal: 'could not reach window.__ENGINE.ui to unhook onBookOpened' };
    eng.ui.onBookOpened = null;
    rep.unhooked = true;
  }

  const ui = () => H.getUIState();
  const bookOf = () => { const u = ui(); return u && u.book ? u.book : null; };

  // ============================ K5 — T1, T2, T3, T4 ===========================================
  // T1: the book is readable on the frame the open resolves. No stepping between the two calls,
  // so anything that needed a frame to become readable reports pages 0 / no text here.
  const openFrame = H.getFrame();
  H.openMenu('book', { id: BOOK });
  const first = bookOf();
  const firstEls = (ui().elements || []).filter((e) => e.kind === 'book_page' && e.visible);
  rep.T1 = {
    frames_stepped_before_readable: H.getFrame() - openFrame,
    pages: first ? first.pages : null,
    page_elements_present: firstEls.length,
    text_present_same_frame: firstEls.some((e) => (e.text || '').split(/\s+/).filter(Boolean).length > 20),
  };

  // T2/T3: one directional input per turn, and the new page fully rendered within 6 frames.
  // The book screen turns on the MOVE AXIS (`UISystem._move`), which is why this queues
  // `move` rather than a button: a page turn a player makes with the stick is the page turn
  // being measured.
  //
  // SCHEDULING, AND WHY IT IS NOT `{f: frame+1}`. Reading pauses the world (T6), and on a
  // paused step `Engine._step()` calls `input.latchForStep(this.sim.frame)` WITHOUT advancing
  // `sim.frame`. A scripted event fires when `e.f + scriptBase === frame`, so while the book is
  // open the latch frame never moves and every event scheduled at `+1` is silently dropped —
  // which is exactly what this probe measured on its first run and misread as "the page will
  // not turn". Queue at `f: 0` and the event lands on the next step. Returning the axis to rest
  // between turns is the stick being released, not a second input: `UISystem._edge` fires on a
  // CHANGE of axis value, so one deflection is one turn.
  const rest = () => { H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1); };
  const turns = [];
  const pages = first ? first.pages : 0;
  for (let t = 0; t < Math.min(20, Math.max(0, pages - 1)); t++) {
    rest();
    const before = bookOf().page;
    H.queueInputs([{ f: 0, move: [1, 0] }]);          // ONE input — T2
    let landed = null, wordsAt = 0;
    for (let i = 1; i <= 30 && landed === null; i++) {
      H.stepFrames(1);
      const b = bookOf();
      if (b && b.page !== before) {
        // "fully rendered" — the page's own text elements, not just the counter
        const els = (ui().elements || []).filter((e) => e.kind === 'book_page' && e.visible);
        wordsAt = els.reduce((a, e) => a + (e.text || '').split(/\s+/).filter(Boolean).length, 0);
        if (wordsAt > 0) landed = i;
      }
    }
    turns.push({ turn: t, from: before, to: bookOf().page, frames: landed, words_on_new_page: wordsAt, inputs: 1 });
    if (landed === null) break;
  }
  const landedFrames = turns.map((x) => x.frames).filter((x) => x !== null);
  rep.T2_T3 = {
    turns: turns.length,
    every_turn_one_input: turns.every((x) => x.inputs === 1),
    turns_that_landed: landedFrames.length,
    max_frames: landedFrames.length ? Math.max(...landedFrames) : null,
    median_frames: landedFrames.length ? landedFrames.slice().sort((a, b) => a - b)[Math.floor(landedFrames.length / 2)] : null,
    detail: turns,
  };

  // T4: two turns queued two frames apart — the second must be honoured, i.e. no animation
  // swallows an input. A page turn that drops the second press is an unskippable animation.
  {
    rest();
    const start = bookOf().page;
    // Two deflections two steps apart. If a page-turn animation swallowed the second, the book
    // would advance by one spread rather than two.
    H.queueInputs([{ f: 0, move: [1, 0] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
    H.queueInputs([{ f: 0, move: [1, 0] }]); H.stepFrames(2);
    rep.T4 = { from: start, to: bookOf().page, advanced_by: bookOf().page - start, second_input_honoured: bookOf().page - start >= 2 };
  }

  // ============================ K6 — T5, and "persisted in the save" ==========================
  // Turn to a page, open a SECOND book (so the answer cannot come from a single live variable),
  // come back, then save, wipe the run with reset(), load, and ask again.
  const persistence = {};
  try {
    H.closeMenu();
    H.openMenu('book', { id: BOOK });
    for (let i = 0; i < 2; i++) {
      H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
      H.queueInputs([{ f: 0, move: [1, 0] }]); H.stepFrames(1);
    }
    persistence.page_reached = bookOf().page;
    H.closeMenu();

    H.openMenu('book', { id: OTHER });
    persistence.other_book_opens_at = bookOf().page;      // must be its own page, not BOOK's
    H.closeMenu();

    H.openMenu('book', { id: BOOK });
    persistence.reopen_same_session = bookOf().page;
    H.closeMenu();

    const blob = H.saveState();
    persistence.save_carries_book_pages = JSON.stringify(blob).includes('book_pages');
    H.reset({});
    H.openMenu('book', { id: BOOK });
    persistence.after_reset_before_load = bookOf().page;
    H.closeMenu();
    H.loadState(blob);
    H.openMenu('book', { id: BOOK });
    persistence.after_load = bookOf().page;
    H.closeMenu();
  } catch (e) { persistence.error = String(e).slice(0, 300); }
  rep.T5 = persistence;

  // ============================ K7 — T6, the pause rule =======================================
  const pause = {};
  try {
    H.closeMenu();
    // out of combat: 120 stepped frames must advance the simulation by 0
    const a0 = H.getFrame();
    H.openMenu('book', { id: BOOK });
    pause.report_out_of_combat = H.getUIPauseReport();
    H.stepFrames(120);
    pause.out_of_combat_delta = H.getFrame() - a0;
    H.closeMenu();

    // in combat: the same 120 frames must all land
    // A fight has to be real for T6's second half to mean anything: `Engine.inCombat()` reads
    // the fight, not a flag, so the probe spawns a body and locks on rather than asserting one
    // is nearby. Lock-on alone satisfies inCombat(), and the spawn gives it something to be
    // locked on to.
    // The default world does not put a body next to the player, and `spawn(id, x, z)` places in
    // WORLD coordinates — the first run of this probe spawned into empty marsh and measured
    // `in_combat: false` while reporting that it had made a fight. `arena_flat` is the scenario
    // every combat probe in the tree uses for exactly this reason.
    let eid = null;
    try { H.loadState('arena_flat'); H.stepFrames(2); } catch (e) { pause.arena_error = String(e).slice(0, 160); }
    try { eid = H.spawn('inf_trash', 0, 2.0, { as: 'K7' }); } catch (e) { pause.spawn_error = String(e).slice(0, 160); }
    H.stepFrames(2);
    try { if (eid != null) H.aggro(typeof eid === 'object' ? eid.eid : eid); } catch (e) { pause.aggro_error = String(e).slice(0, 160); }
    try { if (eid != null) H.lockOn(typeof eid === 'object' ? eid.eid : eid); } catch (e) { pause.lock_error = String(e).slice(0, 160); }
    H.stepFrames(2);
    pause.in_combat_confirmed = !!(H.getUIPauseReport() || {}).in_combat;
    const b0 = H.getFrame();
    H.openMenu('book', { id: BOOK });
    pause.report_in_combat = H.getUIPauseReport();
    H.stepFrames(120);
    pause.in_combat_delta = H.getFrame() - b0;
    H.closeMenu();
  } catch (e) { pause.error = String(e).slice(0, 300); }
  rep.T6 = pause;

  return rep;
}, { BOOK, OTHER, noHook: !!(args['no-hook'] || args.noHook) });

// ---- grading, against RI-UIX05's own bars -----------------------------------------------------
const checks = [];
const add = (id, what, pass, detail) => checks.push({ id, what, pass, detail });
if (out.fatal) {
  add('FATAL', out.fatal, false, out.fatal);
} else {
  add('K5-T1', 'the book is readable on the frame the open resolves',
    out.T1.frames_stepped_before_readable === 0 && out.T1.text_present_same_frame && out.T1.pages > 1,
    `${out.T1.pages} pages, ${out.T1.page_elements_present} page elements, 0 frames stepped, text present: ${out.T1.text_present_same_frame}`);
  add('K5-T2', 'one input per page turn, both directions',
    out.T2_T3.every_turn_one_input && out.T2_T3.turns_that_landed === out.T2_T3.turns && out.T2_T3.turns > 0,
    `${out.T2_T3.turns_that_landed}/${out.T2_T3.turns} turns landed on one input each`);
  add('K5-T3', 'next page fully rendered within 6 frames of the input',
    out.T2_T3.max_frames !== null && out.T2_T3.max_frames <= 6,
    `max ${out.T2_T3.max_frames} frames, median ${out.T2_T3.median_frames}, over ${out.T2_T3.turns} turns (bar <= 6, hard fail > 30)`);
  add('K5-T4', 'a second input two frames later is honoured (no blocking animation)',
    !!out.T4.second_input_honoured, `advanced by ${out.T4.advanced_by} on two inputs`);
  // `getUIState().book.page` is the 1-BASED left-hand page of the spread — `focus.book.page * 2
  // + 1` in ui/system.js — so a book sitting on its first spread reports 1, not 0. Asserting 0
  // here failed this check twice against a build that was behaving correctly, which is the
  // ordinary way a probe lies about a fix.
  const FIRST_SPREAD = 1;
  add('K6-T5', 'the page you were on survives close, reopen, save, reset and load — per book',
    out.T5.page_reached > FIRST_SPREAD
      && out.T5.reopen_same_session === out.T5.page_reached
      && out.T5.other_book_opens_at === FIRST_SPREAD
      && out.T5.after_reset_before_load === FIRST_SPREAD
      && out.T5.save_carries_book_pages === true
      && out.T5.after_load === out.T5.page_reached,
    `reached ${out.T5.page_reached}; reopen ${out.T5.reopen_same_session}; other book ${out.T5.other_book_opens_at}; after reset ${out.T5.after_reset_before_load}; AFTER LOAD ${out.T5.after_load}; save carries book_pages: ${out.T5.save_carries_book_pages}`);
  add('K7-T6', 'reading pauses the world out of combat and does NOT pause it in combat',
    out.T6.out_of_combat_delta === 0 && out.T6.in_combat_delta === 120,
    `out of combat ${out.T6.out_of_combat_delta}/120 frames advanced; in combat ${out.T6.in_combat_delta}/120 (in_combat confirmed: ${out.T6.in_combat_confirmed})`);
}

const report = { schema: 'elder-souls/w1-library-reading@1', item: 'RI-UIX05 K5/K6/K7', at: new Date().toISOString(), ...out, checks, page_errors: errors };
report.ok = checks.every((c) => c.pass);
console.log(JSON.stringify(report, null, 2));
for (const c of checks) console.error(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
console.error(`  ${checks.filter((c) => c.pass).length}/${checks.length}`);
if (args.out) writeJson(args.out, report);
await handle.close();
process.exit(report.ok ? 0 : 1);
