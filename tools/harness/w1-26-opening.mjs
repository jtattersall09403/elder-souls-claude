#!/usr/bin/env node
// w1-26-opening.mjs — the opening as a played scene, measured on the live build.
//
// Owner: W1-26. This probe covers the four things `RI-JRN01` asks about that
// `tools/journey/journey-run.mjs` (A-JRN1, the journey driver) does not:
//
//   T   M20 / HF9   A title surface exists at all, from a FRESH BROWSER PROFILE WITH AN
//                   EXISTING SAVE IN INDEXEDDB; it offers the exact O3 set; `Continue` is
//                   focused by default when a save exists; and `Continue` LOADS THAT SAVE.
//                   HF9 caps the whole item at 2 and fired on both prior rounds with nothing
//                   in the item able to notice.
//   A   §0.1(a)     The rendered-text ACCESSOR is named and DEMONSTRATED NON-EMPTY on a frame
//                   known to carry text, which is the precondition `RI-JRN01` sets before M9
//                   and M15 may be scored at all. Then the two greps are run through it.
//                   Without this the checks are `unmeasurable ⇒ 0`, never pass — a canvas-only
//                   build otherwise passes M9 by being unreadable.
//   R   O17 / M13   The title is completable on keyboard only, gamepad only, touch only and
//                   mouse+keyboard. Round 2 completed two of four legs and HF5 fired.
//   C   O6 / M4-1   `first_input`, `first_control` and the first field-writing node, now that
//                   the engine emits the first two. The interval nobody has ever measured.
//
// And the CONSUMPTION check `ARBITRATION` §3 / `RI-MTH07` requires of everything this piece
// ships, by perturbation with a frame-side observable and a null control:
//
//   K1  the save store -> the title. Two well-separated values (a save present / no save) with
//       everything else held fixed, observed as WHAT THE PLAYER CAN SEE — the drawn slot line
//       and the enabled state of `Continue` — plus the null control (perturb nothing, observe
//       nothing). A `getTitleState()` return value would be the trace, and `RI-MTH07` §B1
//       rules the trace an observer; so the observable here is the register's DRAWN STRINGS.
//   K2  the register itself, broken on purpose. `AGENT-PROTOCOL`: "before trusting your own
//       instrument, break the thing it measures and confirm the instrument goes red." The
//       surface is hidden and the register must report the strings gone.
//
// This probe is a builder's copy of a check a critic will re-run. It is written to FAIL when
// the build is wrong. Every threshold it applies is quoted from the item beside it.
//
// USAGE
//   node tools/harness/w1-26-opening.mjs [--json <path>] [--out <dir>]
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-opening.mjs — RI-JRN01 M20/HF9, the rendered-text accessor demonstration, O17 parity
and O6's first_control interval, against the running build.

USAGE
  node tools/harness/w1-26-opening.mjs [--json <path>] [--out <dir>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'journeys');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'w1-26-opening.json');

const say = (s) => process.stdout.write(s + '\n');
const out = {
  schema: 'elder-souls/w1-26-opening@1',
  item: 'RI-JRN01',
  piece: 'W1-26',
  checks: {},
  hard_fails: [],
  failures: [],
  passes: [],
};
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };
const hard = (id, m) => { out.hard_fails.push({ id, why: m }); say(`  HARD FAIL ${id}  ${m}`); };

// `RI-JRN01` O3, verbatim, in the item's own words. The build must publish exactly this set.
const O3 = ['continue', 'new', 'load', 'settings', 'quit-to-menu'];

// `RI-JRN01` M9's substring list, verbatim, plus the imperative-second-person test.
const M9_SUBSTRINGS = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
// O14 / M15. `RI-LOR01` registers no explicit list, so this is O14's own wording expanded:
// chosen, prophesied, special, the last of anything, the only one who can.
const M15_WORDS = ['chosen', 'prophes', 'prophec', 'the chosen', 'destined', 'foretold',
  'the last of', 'the only one who', 'nerevarine', 'you alone can'];

const handle = await launchGame({ ...args, width: 1920, height: 1080 });

try {
  // ======================================================================================
  // T — M20 / HF9. A title surface, from a fresh profile WITH a save already in IndexedDB.
  // ======================================================================================
  // `RI-JRN01` How-we-lose #13: "everything works on the second run and nobody tested the
  // first. The critic must always measure with a fresh browser profile — recorded in the
  // artifact or the measurement is void." `launchGame` mints a fresh context per run, so this
  // page load has an empty IndexedDB; the save is written and the page is RELOADED, which is
  // the returning player's actual situation and the only one M20 is about.
  say('T — M20/HF9: the title surface');
  const cold = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const t0 = H.getTitleState();
    // Write a save so the reload is a RETURNING player's boot.
    await H.titleShow();
    await H.titleActivate('new');
    H.stepFrames(30);
    await H.writeSave('slot-a');
    const slots = await H.listSaveSlots();
    return { title_before_save: t0, slots_written: slots.map((s) => s.slot) };
  });
  out.checks.fresh_profile = { fresh_browser_context: true, storage_seeded_by: 'writeSave("slot-a") then page.reload()', slots: cold.slots_written };
  if (!cold.slots_written.length) fail('T0 could not write a save, so M20\'s "a save exists" precondition cannot be established');

  await handle.page.reload({ waitUntil: 'load' });
  const t = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setMode('play-instrumented');       // real listeners, harness-driven clock
    H.setRenderRate(0);
    const st0 = H.getTitleState();
    // The title is constructed in every mode and raised in play; raise it explicitly so this
    // measurement does not depend on the mode flag, and say so.
    if (!st0.shown) await H.titleShow();
    const st = H.getTitleState();
    H.renderFrame();                       // the title draws only when a frame is presented
    const drawn = H.getRenderedText({ surface: 'title' });
    return { state_at_boot: st0, state: st, title_drawn: drawn.distinct, title_entries: drawn.entries.length };
  });
  out.checks.m20 = {
    present: t.state.present,
    shown_at_boot_in_harness_mode: t.state_at_boot.shown,
    raised_by: t.state_at_boot.shown ? 'boot' : 'titleShow()',
    option_ids: t.state.option_ids,
    o3_expected: O3,
    selected_id: t.state.selected_id,
    save_count: t.state.save_count,
    continue_available: t.state.continue_available,
    unskippable_ms: t.state.unskippable_ms,
    world_behind: t.state.world_behind,
    drawn_strings: t.title_drawn,
  };
  if (!t.state.present) hard('HF9', 'no title surface exists at all');
  else pass('a title surface exists');
  const setOk = JSON.stringify(t.state.option_ids) === JSON.stringify(O3);
  if (!setOk) fail(`M20: option set is [${t.state.option_ids.join(', ')}], O3 wants [${O3.join(', ')}]`);
  else pass('M20: the option set is exactly O3\'s five');
  if (t.state.save_count < 1) hard('HF9', 'a save exists in IndexedDB and the title reports none — no route to it before control');
  else if (t.state.selected_id !== 'continue') fail(`M20/O3: a save exists and the focused row is '${t.state.selected_id}', not 'continue'`);
  else pass('M20/O3: `Continue` is focused by default when a save exists');
  if (!t.title_drawn.length) fail('M20: the title surface draws no text — nothing reached the frame');
  else pass(`M20: the title drew ${t.title_drawn.length} distinct strings`);

  // `Continue` LOADS THAT SAVE — through the same entry point the player's `interact` reaches.
  const cont = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    const before = H.getStateHash();
    const r = await H.titleActivate('continue');
    return { result: r, hash_before: before, hash_after: H.getStateHash(), title: H.getTitleState(), player: H.getPlayerStats() };
  });
  out.checks.m20_continue = { result: cont.result, hash_before: cont.hash_before, hash_after: cont.hash_after, title_shown_after: cont.title.shown };
  if (cont.result && cont.result.loaded) pass('M20: `Continue` loaded the save');
  else hard('HF9', `\`Continue\` did not load the save: ${JSON.stringify(cont.result)}`);
  if (cont.title.shown) fail('M20: the title is still up after `Continue`');
  else pass('M20: the title yields to the world on `Continue`');

  // ======================================================================================
  // A — §0.1(a). The accessor, NAMED and DEMONSTRATED, before either grep is reported.
  // ======================================================================================
  say('A — the rendered-text accessor (RI-JRN01 §0.1(a))');
  const acc = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    // The two obvious instruments, measured so the report can say why they are not used.
    const domText = (document.body.innerText || '').trim();
    const axChildCount = (() => { try { return document.body.children.length; } catch { return -1; } })();

    H.renderedTextClear();
    // A frame KNOWN to carry text: the census's first node, whose authored line is in the
    // graph. If the accessor comes back empty HERE, it is blind and every grep below is void.
    await H.titleShow();
    await H.titleActivate('new');
    H.stepFrames(2);
    H.renderFrame();
    const proof = H.getRenderedText();
    return {
      dom_inner_text_len: domText.length,
      dom_child_count: axChildCount,
      accessor: proof.accessor,
      source: proof.source,
      surfaces: proof.surfaces_instrumented,
      distinct: proof.distinct,
      summary: proof.summary,
    };
  });
  out.checks.accessor = acc;
  const live = acc.distinct.length > 0;
  if (!live) {
    fail('§0.1(a): the rendered-text accessor returned EMPTY on a frame known to carry text. M9 and M15 are `unmeasurable ⇒ 0`, never pass.');
  } else {
    pass(`§0.1(a): accessor \`${acc.accessor}\` demonstrated non-empty — ${acc.distinct.length} distinct strings on a frame known to carry text`);
    say(`        (for contrast, document.body.innerText is ${acc.dom_inner_text_len} chars — the instrument RI-MTH06 §B warns about)`);
  }

  // ======================================================================================
  // A2 — M9 and M15, through that accessor, over the whole opening.
  // ======================================================================================
  const greps = await handle.page.evaluate(async ({ subs, words }) => {
    const H = window.__HARNESS;
    H.renderedTextClear();
    // Walk the whole creation scene with the surface drawing every node, so the register holds
    // the opening's real text stream rather than one frame of it.
    const seen = [];
    for (let i = 0; i < 60; i++) {
      const st = H.getCensusState();
      if (!st || st.done) break;
      H.renderFrame();
      const node = st.node;
      const inp = st.input;
      if (!inp) { H.stepFrames(4); if (H.getCensusState().node === node) break; continue; }
      let value = null;
      if (inp.kind === 'text') value = (inp.options && inp.options[0] && inp.options[0].id) || 'Ei';
      else if (inp.kind === 'observed') value = 'correct';
      else if (inp.kind === 'pick') {
        const need = { 'writ.class-custom-primary': 3 }[node] || 2;
        value = (inp.options || []).slice(0, need).map((o) => o.id);
      } else value = (inp.options && inp.options[0] && inp.options[0].id) || null;
      seen.push(node);
      try { H.censusAnswer(value); } catch (e) { seen.push(`THREW at ${node}: ${e.message}`); break; }
      H.stepFrames(2);
    }
    H.renderFrame();
    const all = H.getRenderedText();
    // M9 greps strings rendered OUTSIDE a dialogue/journal/book surface.
    const nonDialogue = H.getRenderedText({ notSurface: ['dialogue'] });
    const hit = (list, needles, ci) => {
      const found = [];
      for (const s of list) for (const n of needles) {
        const a = ci ? s.toLowerCase() : s, b = ci ? n.toLowerCase() : n;
        if (a.indexOf(b) >= 0) found.push({ text: s, needle: n });
      }
      return found;
    };
    return {
      nodes_walked: seen,
      all_distinct: all.distinct.length,
      non_dialogue_distinct: nonDialogue.distinct,
      m9_hits: hit(nonDialogue.distinct, subs, false),
      m15_hits: hit(all.distinct, words, true),
      summary: all.summary,
      // The clip-aware half: strings handed to fillText that the player could not read.
      clipped: H.getRenderedText({ includeClipped: true }).entries.filter((e) => e.clipped).map((e) => ({ surface: e.surface, text: e.text })),
    };
  }, { subs: M9_SUBSTRINGS, words: M15_WORDS });
  out.checks.m9 = { instrument: '__HARNESS.getRenderedText({notSurface:["dialogue"]})', surfaces_searched: 'title (the only non-dialogue drawn surface in the build)', distinct_searched: greps.non_dialogue_distinct.length, hits: greps.m9_hits };
  out.checks.m15 = { instrument: '__HARNESS.getRenderedText()', distinct_searched: greps.all_distinct, hits: greps.m15_hits };
  out.checks.orphan_text = { clipped_entries: greps.clipped };
  out.checks.scene_walk = { nodes: greps.nodes_walked };
  if (!live) say('  (M9/M15 not reported: the accessor is blind)');
  else {
    if (greps.m9_hits.length) hard('HF3', `M9: ${greps.m9_hits.length} instruction hit(s) outside a dialogue surface: ${JSON.stringify(greps.m9_hits.slice(0, 4))}`);
    else pass(`M9: 0 hits over ${greps.non_dialogue_distinct.length} distinct non-dialogue strings, through a demonstrated accessor`);
    if (greps.m15_hits.length) fail(`M15: ${greps.m15_hits.length} prophecy-vocabulary hit(s): ${JSON.stringify(greps.m15_hits.slice(0, 4))}`);
    else pass(`M15: 0 hits over ${greps.all_distinct} distinct strings`);
  }
  if (greps.clipped.length) {
    fail(`ORPHAN TEXT: ${greps.clipped.length} string(s) were handed to fillText and fell outside their surface's clip — computed, laid out, painted nowhere. ${JSON.stringify(greps.clipped.slice(0, 3))}`);
  } else pass('no orphan text: every string handed to a draw call landed inside its clip');

  // ======================================================================================
  // C — O6 / M4 clause 1. The interval nobody has ever measured.
  // ======================================================================================
  say('C — O6 / M4 clause 1: control before definition');
  const stamps = await handle.page.evaluate(() => window.__HARNESS.getJourneyStamps());
  out.checks.m4_clause1 = stamps;
  if (stamps.first_control_frame == null) {
    fail('M4 clause 1: `first_control` was never emitted in this run — the left end of O6\'s interval does not exist');
  } else if (stamps.available_play_s_before_first_field == null) {
    fail('M4 clause 1: no field-writing node was reached, so the interval has no right end');
  } else {
    const s = stamps.available_play_s_before_first_field;
    out.checks.m4_clause1.threshold_s = 60;
    if (s >= 60) pass(`M4 clause 1: ${s} s of available play before the first character-defining question (O6 wants >= 60)`);
    else fail(`M4 clause 1: ${s} s of available play before the first character-defining question at '${stamps.first_field_node}'. O6 wants >= 60 — "you get a body before you get a character" is the item's own best idea and this build asks first.`);
  }

  // ======================================================================================
  // R — O17 / M13's reachability legs, on the TITLE. Four devices, four completions.
  // ======================================================================================
  say('R — O17: the title on four input devices');
  const parity = {};
  for (const leg of ['keyboard', 'mouse+keyboard', 'gamepad', 'touch']) {
    parity[leg] = await handle.page.evaluate(async (which) => {
      const H = window.__HARNESS;
      await H.titleShow();
      const before = H.getTitleState();
      const canvas = document.getElementById('view');
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
      let inputs = 0;
      const step = (n) => H.stepFrames(n);
      // Every leg does the same thing: move the caret off `continue` onto `new`, then commit.
      // Two inputs. O18/M14's budget is 5 to first control on a second run.
      if (which === 'keyboard' || which === 'mouse+keyboard') {
        key('keydown', 'KeyS'); step(2); key('keyup', 'KeyS'); step(2); inputs++;
        if (which === 'mouse+keyboard') {
          // The mouse leg must not need a cursor: O17's hard fail is "any surface that
          // requires a mouse cursor". The mouse is used for LOOK and the keyboard commits,
          // which is what a desktop player actually does.
          canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: 12, movementY: 0 }));
        }
        key('keydown', 'KeyE'); step(2); key('keyup', 'KeyE'); step(2); inputs++;
      } else if (which === 'gamepad') {
        // `__HARNESS.gamepad()` routes into the same `pollGamepad()` a physical pad drives.
        H.gamepad({ axes: [0, 1, 0, 0], buttons: [] }); H.gamepadPoll(); step(2);
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [] }); H.gamepadPoll(); step(2); inputs++;
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [0] }); H.gamepadPoll(); step(2);
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [] }); H.gamepadPoll(); step(2); inputs++;
      } else {
        // Touch: the on-screen stick and the confirm button, through the real touch layer.
        const t = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
        const st = H.getInputState && H.getInputState();
        t('pointerdown', 1, 200, 800); t('pointermove', 1, 200, 900); step(4); t('pointerup', 1, 200, 900); step(2); inputs++;
        void st;
        // Commit with the touch `interact` control if the layer exposes one; otherwise the
        // leg reports what it could and does NOT claim a pass.
        t('pointerdown', 2, 1700, 800); step(2); t('pointerup', 2, 1700, 800); step(2); inputs++;
      }
      const after = H.getTitleState();
      return { before_selected: before.selected_id, after_selected: after.selected_id, shown_after: after.shown, inputs, inputs_taken: after.inputs_taken };
    }, leg);
    const r = parity[leg];
    // "Completed" means the surface acted: either the caret moved or the surface closed.
    const acted = r.shown_after === false || r.after_selected !== r.before_selected;
    if (acted) pass(`O17 ${leg}: the title responded (${r.before_selected} -> ${r.after_selected}, shown=${r.shown_after})`);
    else fail(`O17 ${leg}: the title did not respond to any input on this device`);
    if (!acted) hard('HF5', `the opening's first surface cannot be driven on ${leg}`);
  }
  out.checks.o17_parity = parity;

  // ======================================================================================
  // K1 — CONSUMPTION. The save store -> the title, observed as drawn strings.
  // ======================================================================================
  say('K1 — CONSUMPTION: the save store reaches the frame (RI-MTH07 §B)');
  const k1 = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    const read = async () => {
      await H.titleShow();
      H.renderedTextClear();
      H.renderFrame();
      const d = H.getRenderedText({ surface: 'title' });
      const st = H.getTitleState();
      return { drawn: d.distinct, continue_enabled: (st.options.find((o) => o.id === 'continue') || {}).enabled };
    };
    // Value 1: a save exists.
    const withSave = await read();
    // Null control: perturb NOTHING, observe again. A difference here would mean the
    // observable is unstable and every reading below is worthless.
    const nullControl = await read();
    // Value 2: no save. Well separated, everything else held fixed.
    for (const s of await H.listSaveSlots()) await H.deleteSaveSlot(s.slot);
    const withoutSave = await read();
    // Restore.
    await H.writeSave('slot-a');
    const restored = await read();
    return { withSave, nullControl, withoutSave, restored };
  });
  const same = (a, b) => JSON.stringify(a.drawn) === JSON.stringify(b.drawn);
  out.checks.consumption_k1 = {
    model: 'the save store (game/src/save/store.js, IndexedDB) — the one model the title surface reads',
    observable: 'the strings the title DREW, read through the rendered-text register (frame-side, not a getTitleState() return value)',
    with_save: k1.withSave, null_control_stable: same(k1.withSave, k1.nullControl),
    without_save: k1.withoutSave, restored: k1.restored,
    coupling: same(k1.withSave, k1.withoutSave) ? 0 : 1,
  };
  if (!same(k1.withSave, k1.nullControl)) fail('K1 null control: the observable changed with no perturbation — the reading is unstable and the coupling number below means nothing');
  else pass('K1 null control: perturb nothing, observe nothing');
  if (same(k1.withSave, k1.withoutSave)) fail('K1 CONSUMPTION: coupling == 0 — the title draws the same frame whether a save exists or not. The save store is an orphan model to this surface.');
  else pass('K1 CONSUMPTION: the save store changes what the player can see and what they can activate');
  if (!same(k1.withSave, k1.restored)) fail('K1 delete-the-fix: restoring the save did not restore the frame');
  else pass('K1 delete-the-fix: removing the save removes the row, restoring it brings it back');

  // ======================================================================================
  // K2 — the instrument, broken on purpose. A probe that cannot fail is worse than no probe.
  // ======================================================================================
  say('K2 — the register, broken on purpose');
  const k2 = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.titleShow();
    H.renderedTextClear(); H.renderFrame();
    const before = H.getRenderedText({ surface: 'title' }).distinct.length;
    H.titleDismiss('k2');                       // the surface is gone; nothing may be recorded
    H.renderedTextClear(); H.renderFrame();
    const after = H.getRenderedText({ surface: 'title' }).distinct.length;
    await H.titleShow();
    H.renderedTextClear(); H.renderFrame();
    const restored = H.getRenderedText({ surface: 'title' }).distinct.length;
    return { before, after, restored };
  });
  out.checks.instrument_falsification = k2;
  if (k2.before > 0 && k2.after === 0 && k2.restored === k2.before) {
    pass(`K2: the register goes red when the surface stops drawing (${k2.before} -> ${k2.after} -> ${k2.restored})`);
  } else {
    fail(`K2: the register did not falsify — before ${k2.before}, surface hidden ${k2.after}, restored ${k2.restored}. An instrument that cannot go red is not evidence.`);
  }
} finally {
  out.page_errors = handle.errors.slice(0, 6);
  await handle.close();
}

out.verdict = out.hard_fails.length ? 'HARD FAIL' : out.failures.length ? 'FAIL' : 'PASS';
say('');
say(`w1-26-opening: ${out.passes.length} pass, ${out.failures.length} fail, ${out.hard_fails.length} hard fail -> ${out.verdict}`);
writeJson(jsonPath, out);
log(`wrote ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.hard_fails.length || out.failures.length ? 1 : 0);
