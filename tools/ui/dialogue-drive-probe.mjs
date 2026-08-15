#!/usr/bin/env node
// dialogue-drive-probe.mjs — RI-UIX08's dialogue window, OPERATED. Not photographed.
//
// Owner: W1-UIX08-INPUT-FIX. Binding: `corpus/00-doctrine/CRITIC-DOCTRINE.md` §1.2b, added
// 2026-08-15 because the project shipped a window measuring ΔE 0.00 that the owner could not use.
//
// WHAT MAKES THIS DIFFERENT FROM `dialogue-window-probe.mjs`. That probe drives the window by
// assigning `eng._convPending = topic` and by writing `eng.ui.dialogueFocus` directly — it reaches
// PAST the input layer, so a dead input layer is invisible to it. It passed 22/25 while the window
// could not be operated. Every interaction here is a real DOM event dispatched at the page:
// `KeyboardEvent('keydown'/'keyup')` for keys, `MouseEvent` for clicks, `PointerEvent` for taps.
// Nothing in this file calls a function the UI also calls, and nothing sets UI state.
//
// §1.2b clause 5: the state AFTER each interaction is recorded, not merely that nothing threw.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = could not run.
'use strict';

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
dialogue-drive-probe.mjs — operate the dialogue window through the shipped input path.

  --state <id>     world state to load (default: helstrom-market)
  --census         drive the character-creation / new-game flow instead of a world NPC
  --out <dir>      report directory (default reports/uix08)
  --shot <path>    save a PNG of the first creation node that speaks (census arm only).
                   The delete-the-fix pair is this flag run twice, once per arm.
  --open-only      census arm: stop after the opening check. ~90 s instead of ~15 min, for
                   when the thing wanted is the picture and not the walk.

EXIT 0 = every check passes · 1 = a check failed · 2 = could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(REPO_ROOT, String(args.out || 'reports/uix08'));
ensureDir(OUT);
const STATE = String(args.state || 'helstrom-market');
const CENSUS = !!args.census;
const SHOT = args.shot ? path.resolve(REPO_ROOT, String(args.shot)) : null;
const OPEN_ONLY = !!args['open-only'];

const checks = [];
const push = (id, pass, detail) => {
  checks.push({ id, pass, detail });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`);
};

const report = {
  schema: 'elder-souls/uix08-drive-probe@1',
  at: new Date().toISOString(),
  commit: (process.env.GIT_COMMIT || '').slice(0, 12) || null,
  state: STATE, mode: CENSUS ? 'census' : 'world',
  interactions: [], checks: [], data: {},
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

/**
 * A real key press, through the DOM, and then let the simulation run.
 *
 * `keydown` then N frames then `keyup`, because `latchForStep` turns a pending press into an edge
 * on the next step and a release on the step after. Holding for 2 frames is what a human hand
 * does at 60 Hz and it is what the repeat logic in `UISystem._edge` is written against.
 */
async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true }));
  }, code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }));
  }, code);
  await h.h('stepFrames', 2);
}

/** A real click at a point on the canvas, through the shipped pointer path. */
async function click(x, y) {
  await h.page.evaluate(([px, py]) => {
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    const cx = r.left + px * (r.width / (cv.width || r.width));
    const cy = r.top + py * (r.height / (cv.height || r.height));
    const opt = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
    cv.dispatchEvent(new MouseEvent('mousemove', opt));
    cv.dispatchEvent(new MouseEvent('mousedown', opt));
    window.dispatchEvent(new MouseEvent('mouseup', opt));
  }, [x, y]);
  await h.h('stepFrames', 3);
}

/** A real tap at a point on the canvas, through the touch path. */
async function tap(x, y) {
  await h.page.evaluate(([px, py]) => {
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    const cx = r.left + px * (r.width / (cv.width || r.width));
    const cy = r.top + py * (r.height / (cv.height || r.height));
    const mk = (t) => new PointerEvent(t, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
      clientX: cx, clientY: cy, isPrimary: true,
    });
    cv.dispatchEvent(mk('pointerdown'));
    window.dispatchEvent(mk('pointerup'));
  }, [x, y]);
  await h.h('stepFrames', 3);
}

/**
 * Type a real printable character. NOT `key()`: `input/real.js` takes a printable key as TEXT
 * before the control map sees it (and only while `textFocus()` is true), so this route and the
 * button route are different code paths and a probe that used `key('KeyF')` would be testing the
 * button map. `KeyE` types an `e` on a text node — it does not commit — which is exactly the
 * distinction W1-26 r2 §3 measured as `"Silt-Under-Salt"` arriving as `"il-Un"`.
 */
async function type(str) {
  for (const ch of str) {
    await h.page.evaluate((c) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: `Key${c.toUpperCase()}`, key: c, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: `Key${c.toUpperCase()}`, key: c, bubbles: true }));
    }, ch);
  }
  await h.h('stepFrames', 2);
}

/** A real Backspace. Same route as `type`, opposite direction. */
async function backspace() {
  await h.page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace', key: 'Backspace', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Backspace', key: 'Backspace', bubbles: true }));
  });
  await h.h('stepFrames', 2);
}

/**
 * The census scene as both surfaces see it, plus the census graph's own state. Everything here is
 * READ; nothing in this function moves anything.
 */
async function readCensus() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const s = A.getUIState();
    const w = s.dialogue_window || null;
    const old = s.dialogue_surface || null;
    const st = eng.getCensusState ? eng.getCensusState() : null;
    const els = (s.elements || []).filter((e) => e.visible && String(e.id).startsWith('dialogue.'));
    return {
      node: st ? st.node : null,
      done: !!(st && st.done),
      paused: !!(st && st.paused),
      resume_by: st ? st.resume_by || null : null,
      input_kind: st && st.input ? st.input.kind : null,
      question: st && st.question ? st.question.id : null,
      // WHICH SURFACE IS DRAWING. The whole of fault 2 in one pair of booleans.
      new_window_open: !!(w && w.open),
      // NOT the same question, and run 1 conflated them. `dialogue_surface.open` is a LAYOUT
      // fact that `setSuppressed()` deliberately keeps true so a dozen existing probes keep
      // their answers; `renderer.ui.suppressed` is the branch that decides whether anything is
      // handed to `fillText`. Both are recorded so the difference stays legible.
      old_panel_open: !!(old && old.open),
      old_panel_suppressed: eng.renderer && eng.renderer.ui ? !!eng.renderer.ui.suppressed : null,
      census_mode: !!(w && w.census),
      census_node: w ? w.census_node : null,
      elements_present: w ? w.elements_present : null,
      picked_rows: w ? w.picked_rows : null,
      typed: w ? w.census_typed : null,
      speaker: w ? w.speaker : null,
      lines: w ? w.lines_total : null,
      blocks: w ? w.blocks.length : null,
      tail: w && w.blocks.length ? w.blocks[w.blocks.length - 1] : null,
      topics: w ? w.topics.length : 0,
      actions: w ? w.actions.length : 0,
      focus: w ? w.focus : null,
      has_exit: els.some((e) => e.kind === 'dialogue_exit'),
      has_dispo: els.some((e) => e.kind === 'disposition_meter'),
      typed_row: els.filter((e) => e.id === 'dialogue.census.typed').map((e) => e.text),
      rows: els.filter((e) => e.kind === 'list_row').map((e) => ({ id: e.id, text: e.text, focused: !!e.focused })),
      surface_sel: eng.censusSurface ? eng.censusSurface.sel : null,
      surface_picked: eng.censusSurface ? eng.censusSurface.picked.slice() : null,
      surface_typed: eng.censusSurface ? eng.censusSurface.typed : null,
      spec: eng.census ? JSON.parse(JSON.stringify(eng.census.spec || {})) : null,
      character: eng.census ? JSON.parse(JSON.stringify(eng.census.character || {})) : null,
    };
  });
}

/** Everything the window publishes about itself, plus the declared elements. */
async function read() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const s = A.getUIState();
    const w = s.dialogue_window || null;
    const els = (s.elements || []).filter((e) => e.visible && String(e.id).startsWith('dialogue.'));
    return {
      open: !!(w && w.open),
      speaker: w ? w.speaker : null,
      lines: w ? w.lines_total : null,
      links_total: w ? w.links_total : null,
      links_drawn: w ? w.links_drawn : null,
      link_topics: w ? w.link_topics.slice() : [],
      topics: w ? w.topics.slice() : [],
      actions: w ? w.actions.slice() : [],
      disposition: w ? w.disposition : null,
      focus: w ? w.focus : null,
      blocks: w ? w.blocks.map((b) => ({ topic: b.topic, heading: b.heading, chars: b.chars })) : [],
      tail: w && w.blocks.length ? w.blocks[w.blocks.length - 1] : null,
      conv_open: !!(eng.conversation && eng.conversation.open),
      topics_known: A.questTopicsKnown ? A.questTopicsKnown().length : null,
      legacy_open: !!(s.dialogue_surface && s.dialogue_surface.open),
      has_exit: els.some((e) => e.kind === 'dialogue_exit'),
      has_dispo: els.some((e) => e.kind === 'disposition_meter'),
      census_mode: !!(w && w.census),
      elements_present: w ? w.elements_present : null,
      census_open: !!(eng.censusSurface && eng.censusSurface.open),
      census_takes_input: !!(eng.censusSurface && eng.censusSurface.takesInput),
      elements: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect.map((v) => Math.round(v)), text: e.text, focused: !!e.focused })),
    };
  });
}

/** Record what an interaction did. §1.2b clause 5. */
function note(action, before, after, extra) {
  const rec = {
    action,
    before: { focus: before.focus, lines: before.lines, tail: before.tail && before.tail.heading, topics: before.topics.length, open: before.open },
    after: { focus: after.focus, lines: after.lines, tail: after.tail && after.tail.heading, topics: after.topics.length, open: after.open },
    ...extra,
  };
  report.interactions.push(rec);
  return rec;
}

function focusStr(f) { return f ? `${f.pane}:${f.pane === 'prose' ? f.linkIdx : f.rowIdx}` : 'none'; }

try {
  // ---- THE INSTRUMENT, AND ITS OWN FALSIFICATION ----------------------------------------------
  //
  // `?harness=1` DETACHES the real DOM listeners (`Engine.setMode`: mode 'harness' calls
  // `real.detach()`), so a `KeyboardEvent` dispatched at the page reaches nothing and every check
  // in this file would report FAIL against a game that might be fine. The first run of this probe
  // did exactly that. `play-instrumented` is the mode A-JRN1 defines for this: real listeners,
  // harness-driven clock. `setRenderRate(0)` stops the rAF loop stepping underneath us.
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  // RULE 4: a probe that cannot fail is worse than no probe — and a probe that cannot SUCCEED is
  // just as bad. Prove the key path is live before believing anything below it: press a movement
  // key and watch the pipeline's own axis move. If this is 0 the instrument is dead and every
  // FAIL after it is meaningless.
  const wired = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const attached = !!(eng.real && eng.real.attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true }));
    const moveX = eng.input.moveX;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true, cancelable: true }));
    const pending = eng.input.pendingPress;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
    return { attached, moveX, pending };
  });
  await h.h('stepFrames', 2);
  report.data.instrument = wired;
  push('I0 INSTRUMENT: a real DOM key reaches the input pipeline',
    wired.attached && Math.abs(wired.moveX) > 0.5 && wired.pending !== 0,
    `real.attached=${wired.attached}, ArrowRight -> pipeline.moveX=${wired.moveX}, KeyE -> pendingPress=${wired.pending}`);
  if (!wired.attached) throw new Error('the real input listeners are not attached — nothing below this could be measured');

  // ---- CENSUS ARM: which window does a NEW GAME actually put in front of the player? ----------
  //
  // §1.2b clause 3: "check it is actually the screen in use, everywhere it should be. Ask: which
  // code paths open this kind of screen, and do they all open THIS one?" This arm walks the real
  // opening — `censusBegin({})`, which is what `_titleApply('new')` calls — and reads which of
  // the two surfaces is drawing, per node, with the node's own input kind beside it. It asserts
  // nothing about which is right; it establishes what is, which is the first thing the fix for
  // fault 2 needs and the thing that has never been written down.
  if (CENSUS) {
    // ---- W1-UIX08-CENSUS-ROUTE. The owner: "It also wasn't being used for the dialogue in the
    // character creation/new game flow, which it should be." This arm walks the WHOLE creation
    // scene, driving every node through real DOM events, and records for every node which of the
    // two surfaces PAINTED it. §1.2b clause 3 in a number.
    //
    // WHAT IS *NOT* REAL INPUT HERE, said plainly. Two things, and both are openings rather than
    // affordances: `censusBegin({})` starts the scene (the world arm opens a conversation through
    // `A.talkTo` for the same reason), and a PAUSED node — RI-JRN01 O6's hand-back, where the
    // player has the body and must walk or reach — is resumed through `censusEnter`. Walking a
    // body across a room is not one of this window's affordances and driving it would be measuring
    // the movement code. Every control on the window itself is operated by a real event.
    //
    // THE INSTRUMENT TRAP THIS ARM'S FIRST RUN WALKED INTO, recorded so the next reader does not.
    // `getUIState().dialogue_surface.open` IS NOT "the old vellum panel is on screen". `render/
    // ui.js setSuppressed()` skips the PAINT BLOCK ONLY — the layout still runs and `metrics()`
    // still reports what the panel WOULD have been, deliberately, so that the dozen probes reading
    // `option_count` and `panel_height_frac` keep their answers. Run 1 therefore reported "11 nodes
    // on the new window AND 11 on the old panel" against a build where the old panel painted
    // nothing. Two instruments are used instead, and they are independent:
    //
    //   (a) `renderer.ui.suppressed` — the shipped boolean that gates the paint block. Not a
    //       proxy: it is the branch itself.
    //   (b) the RENDERED-TEXT REGISTER (`A.getRenderedText({surface:'dialogue'})`), which is fed
    //       by the draw call and cannot drift from the frame because it IS the frame's text. If
    //       the old panel painted, its strings are in it. `complete` is checked, because that
    //       accessor is fail-closed and an incomplete result is ignorance, not absence.
    await h.h('setMode', 'play-instrumented');
    await h.h('setRenderRate', 0);

    /**
     * One complete pass through character creation, taking a named branch at `writ.class-routes`.
     * Run three times, because the three routes reach different node kinds: `named` reaches
     * neither a `pick` nor the questionnaire, `custom` reaches all four `pick` nodes and a third
     * `text` node, and `questionnaire` reaches the ten dilemmas. A single walk that answered row 0
     * everywhere — which is what run 1 did — measures a third of the scene and looks complete.
     */
    async function walkCensus(routeRow, opts = {}) {
      const walkRows = !!opts.walkRows;
      await h.page.evaluate(() => { window.__ENGINE.censusBegin({}); window.__HARNESS.renderedTextClear(); });
      await h.h('stepFrames', 4);
      const walk = [];
      const evidence = { picks: [], typed: [], choices: [], questionnaire: [] };
      let guard = 0;
      while (guard++ < 120) {
        const c = await readCensus();
        if (c.done || c.node === null) break;
        const rec = {
          node: c.node, input_kind: c.input_kind, question: c.question, paused: c.paused,
          window_open: c.new_window_open, census_mode: c.census_mode,
          old_panel_suppressed: c.old_panel_suppressed,
          old_panel_layout_open: c.old_panel_open,
          elements_present: c.elements_present,
          has_exit: c.has_exit, has_dispo: c.has_dispo,
          rows: c.rows.length, blocks: c.blocks, lines: c.lines,
        };

        if (c.paused) {
          rec.resumed = `harness:${c.resume_by}`;
          walk.push(rec);
          const ok = await h.page.evaluate(() => { try { window.__ENGINE.censusEnter(null); return true; } catch { return false; } });
          if (!ok) { rec.stuck = 'censusEnter refused'; break; }
          await h.h('stepFrames', 3);
          continue;
        }
        if (!c.input_kind) { rec.stuck = 'no input kind and not paused'; walk.push(rec); break; }

        // Walk the caret across the rows this node offers (§1.2b clause 2) and record that the
        // DRAWN focus followed it. A linear graph means only one row can be CONFIRMED per node,
        // so "operate every affordance" here is: every row is reachable and visibly marked, and
        // one is committed. Capped at 8 — `writ.birthsign` offers thirteen signs and this box has
        // killed two runs at 40 minutes of wall clock. `rows` and `rows_walked` are both recorded
        // so a reader sees which nodes were sampled rather than exhausted.
        if (walkRows) {
          const ROW_CAP = 8;
          const rowsSeen = [];
          for (let i = 0; i < Math.min(ROW_CAP, Math.max(0, c.rows.length - 1)); i++) {
            await key('ArrowDown', 1);
            const s2 = await readCensus();
            rowsSeen.push({ idx: s2.focus ? s2.focus.rowIdx : null, focused: (s2.rows.find((r) => r.focused) || {}).text || null });
          }
          rec.rows_walked = rowsSeen.length;
          rec.rows_marked = rowsSeen.filter((r) => r.focused !== null).length;
          rec.rows_idx_moved = rowsSeen.filter((r, i) => r.idx === i + 1).length;
          for (let i = 0; i < rowsSeen.length; i++) await key('ArrowUp', 1);
        }

        // The branch point. Walk the caret to the requested route and confirm there.
        if (c.node === 'writ.class-routes') {
          for (let i = 0; i < routeRow; i++) await key('ArrowDown', 1);
          const at = await readCensus();
          rec.route_row = at.focus ? at.focus.rowIdx : null;
          rec.route_label = (at.rows.find((r) => r.focused) || {}).text || null;
          await key('KeyE');
          const after = await readCensus();
          rec.advanced = after.node !== c.node;
          walk.push(rec);
          continue;
        }

        if (c.input_kind === 'pick') {
          // §H2a. Confirm a row, watch the mark appear; confirm the SAME row, watch it go; then
          // complete the count and watch the node advance.
          await key('KeyE');
          const s2 = await readCensus();
          const marked = (s2.picked_rows || []).length;
          await key('KeyE');
          const s3 = await readCensus();
          const unmarked = (s3.picked_rows || []).length;
          const trail = [
            { act: 'confirm row 0', picked_rows: s2.picked_rows, surface_picked: s2.surface_picked, row_text: (s2.rows[0] || {}).text },
            { act: 'confirm row 0 again (un-pick)', picked_rows: s3.picked_rows, surface_picked: s3.surface_picked, row_text: (s3.rows[0] || {}).text },
          ];
          let steps = 0, asides = s3.blocks;
          while (steps++ < 14) {
            const cur = await readCensus();
            if (cur.node !== c.node || cur.done) break;
            await key('KeyE');
            const nx = await readCensus();
            trail.push({ act: `confirm row ${cur.focus ? cur.focus.rowIdx : '?'}`, picked_rows: nx.picked_rows, node: nx.node, blocks: nx.blocks, tail: nx.tail && nx.tail.chars });
            if (nx.node !== c.node || nx.done) { asides = nx.blocks - asides; break; }
            await key('ArrowDown', 1);
          }
          const after = await readCensus();
          evidence.picks.push({
            node: c.node, marked_after_first: marked, marked_after_unpick: unmarked,
            trail, advanced_to: after.node, spec_custom: after.spec ? after.spec.custom : null,
          });
          rec.pick_mark_appeared = marked === 1;
          rec.pick_mark_removed = unmarked === 0;
          rec.advanced = after.node !== c.node;
          walk.push(rec);
          continue;
        }

        if (c.input_kind === 'text') {
          const ev = { node: c.node, route: null };
          // The routes O17 requires, alternately, so both are measured rather than one being
          // assumed from the other: type it, or walk the caret onto an offered ledger name.
          const useLedger = evidence.typed.length === 1;
          if (useLedger) {
            await key('ArrowDown', 1);
            const onRow = await readCensus();
            ev.route = 'ledger';
            ev.chose = (onRow.rows.find((r) => r.focused) || {}).text || null;
            ev.typed_row_before = onRow.typed_row;
            await key('Enter');
            const done = await readCensus();
            ev.after_node = done.node;
            ev.spec = done.spec;
          } else {
            ev.route = 'typed';
            ev.typed_row_before = c.typed_row;
            // `KeyE` is `interact`. On a text node it must type an `e` and NOT commit — that is
            // W1-26 r2 §3's exact defect ("Silt-Under-Salt" arriving as "il-Un") and it is
            // measured here rather than assumed, by typing a word that contains one.
            await type('Sathel');
            const t1 = await readCensus();
            ev.after_typing = { typed: t1.typed, surface_typed: t1.surface_typed, row: t1.typed_row, node: t1.node };
            await backspace();
            const t2 = await readCensus();
            ev.after_backspace = { typed: t2.typed, surface_typed: t2.surface_typed, row: t2.typed_row };
            await key('Enter');
            const done = await readCensus();
            ev.after_node = done.node;
            ev.spec = done.spec;
          }
          evidence.typed.push(ev);
          rec.text_route = ev.route;
          rec.advanced = ev.after_node !== c.node;
          walk.push(rec);
          continue;
        }

        // choice / observed / questionnaire — one confirm, and record what it produced.
        await key('KeyE');
        const after = await readCensus();
        const row = {
          node: c.node, kind: c.input_kind, question: c.question, rows: c.rows.length,
          confirmed: (c.rows.find((r) => r.focused) || {}).text || null,
          blocks: `${c.blocks} -> ${after.blocks}`, advanced_to: after.node, question_after: after.question,
        };
        (c.input_kind === 'questionnaire' ? evidence.questionnaire : evidence.choices).push(row);
        rec.advanced = after.node !== c.node || after.question !== c.question || after.done;
        walk.push(rec);
        if (!rec.advanced) { rec.stuck = 'confirm produced no change'; break; }
      }
      const end = await readCensus();
      // What the OLD panel painted during the whole pass. Fed by the draw call, so a zero here is
      // a zero of pixels rather than a zero of intentions.
      const reg = await h.page.evaluate(() => {
        const r = window.__HARNESS.getRenderedText({ surface: 'dialogue' });
        return { complete: r.complete, distinct_count: r.distinct_count, distinct: r.distinct.slice(0, 8), instrumented: r.surfaces_instrumented };
      });
      return { walk, evidence, done: end.done, spec: end.spec, character: end.character, old_panel_text: reg };
    }

    // THE PRESENCE CONTROL RUNS FIRST, and that ordering is not cosmetic. Run 2 measured the
    // census, left it open on a node it could not answer, and then threw `talkTo: the census has
    // the conversation` — losing the control entirely. A control that only runs when the
    // experiment succeeded is a control that is absent exactly when it is needed.
    // ---- THE PRESENCE CONTROL. An absence measured without one is not a measurement. -----------
    await h.h('loadState', STATE);
    await h.h('setMode', 'play-instrumented');
    await h.h('stepFrames', 4);
    await h.page.evaluate(() => {
      const A = window.__HARNESS;
      let best = null;
      for (const n of A.listNPCs()) {
        const st = A.talkTo(n.eid);
        if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
      }
      if (best) A.talkTo(best.eid);
    });
    await h.h('stepFrames', 3);
    const conv = await read();
    report.data.presence_control = {
      open: conv.open, census_mode: conv.census_mode, elements_present: conv.elements_present,
      has_exit: conv.has_exit, has_dispo: conv.has_dispo,
    };
    push('C7 PRESENCE CONTROL: an ordinary conversation in the SAME run still has all six elements',
      conv.open && !conv.census_mode && conv.has_exit && conv.has_dispo
        && JSON.stringify(conv.elements_present) === '[1,2,3,4,5,6]',
      `conversation window open=${conv.open}, census mode=${conv.census_mode}, ` +
      `dialogue_exit=${conv.has_exit}, disposition_meter=${conv.has_dispo}, ` +
      `elements_present=${JSON.stringify(conv.elements_present)} ` +
      '(if these were also absent, C3 would be measuring a window that draws nothing)');
    const rowsC = conv.elements.filter((e) => e.kind === 'list_row');
    push('C8 LEAK CONTROL: no census affordance appears in an ordinary conversation',
      conv.open && !conv.elements.some((e) => e.id === 'dialogue.census.typed')
        && !rowsC.some((e) => String(e.text || '').startsWith('· ')),
      `${rowsC.length} column row(s): ` +
      `${conv.elements.filter((e) => e.id === 'dialogue.census.typed').length} typed row(s), ` +
      `${rowsC.filter((e) => String(e.text || '').startsWith('· ')).length} carrying a picked mark (both must be 0)`);


    // ---- C0. the opening, and the first thing the window is asked to draw ---------------------
    await h.page.evaluate(() => { window.__ENGINE.censusBegin({}); window.__HARNESS.renderedTextClear(); });
    await h.h('stepFrames', 4);
    let c = await readCensus();
    const first = { node: c.node, window: c.new_window_open, suppressed: c.old_panel_suppressed };
    // `hold.come-to` is DELIBERATELY silent — RI-JRN01 O6, a body before anybody asks you
    // anything — and `buildCensusModel` returns null there, so NO surface draws. Resume it and
    // measure the first node that actually says something, which is what a new player sees first.
    if (c.paused) {
      await h.page.evaluate(() => { window.__ENGINE.censusEnter(null); });
      await h.h('stepFrames', 4);
      c = await readCensus();
    }
    report.data.census_open = {
      first_node_silent: first, first_speaking_node: c.node,
      window: c.new_window_open, census_mode: c.census_mode, suppressed: c.old_panel_suppressed,
      speaker: c.speaker,
    };
    push('C0 the first thing a new player is told is drawn by the RI-UIX08 window, with the old panel suppressed',
      c.new_window_open && c.census_mode && c.old_panel_suppressed === true,
      `'${first.node}' is silent by design (O6: no surface, and none drew). First speaking node ` +
      `'${c.node}': window open=${c.new_window_open} (census mode=${c.census_mode}), ` +
      `render/ui.js suppressed=${c.old_panel_suppressed}, speaker '${c.speaker}'`);

    // The picture, at the moment a new player first has something to read. Taken in BOTH arms of
    // the delete-the-fix pair, from the same node, so the two frames differ by the one boolean and
    // by nothing else. A still is not evidence that the window WORKS — that is what everything
    // else in this file is for — but the owner asked to be able to see what has changed.
    if (SHOT) {
      // Render a real frame first: `setRenderRate(0)` stops the rAF loop, so without this the
      // screenshot is of whatever was last composited rather than of the node just measured.
      await h.h('setRenderRate', 1);
      await h.h('stepFrames', 6);
      ensureDir(path.dirname(SHOT));
      await h.page.screenshot({ path: SHOT });
      await h.h('setRenderRate', 0);
      report.data.shot = { path: SHOT, node: c.node, speaker: c.speaker, census_mode: c.census_mode };
      log(`  shot ${SHOT}  (node '${c.node}', census mode=${c.census_mode})`);
    }
    if (OPEN_ONLY) {
      // C0b — THE SAME PIXEL QUESTION AS C1b, ASKED AT ONE NODE. This is what makes `--open-only`
      // a usable delete-the-fix arm rather than just a screenshot: it reports what the OLD panel
      // painted at the opening node, so the two arms of the pair produce opposite numbers on one
      // frozen tree. `complete` is checked because the accessor is fail-closed and an incomplete
      // answer is ignorance, not absence.
      const reg0 = await h.page.evaluate(() => {
        const r = window.__HARNESS.getRenderedText({ surface: 'dialogue' });
        return { complete: r.complete, distinct_count: r.distinct_count, distinct: r.distinct.slice(0, 6) };
      });
      report.data.open_only_old_panel_text = reg0;
      push('C0b PIXELS at the opening node: the old vellum panel painted no text',
        reg0.complete && reg0.distinct_count === 0,
        `complete=${reg0.complete}, ${reg0.distinct_count} distinct string(s) on the 'dialogue' surface` +
        (reg0.distinct_count ? ` — e.g. ${JSON.stringify(reg0.distinct.slice(0, 4))}` : ''));
      report.checks = checks;
      report.data.errors = h.errors ? h.errors.slice(0, 10) : [];
      writeJson(path.join(OUT, 'drive-probe-census-open.json'), report);
      log(`\n${checks.filter((x) => x.pass).length}/${checks.length} checks passed (--open-only)`);
      await h.close();
      process.exit(checks.every((x) => x.pass) ? 0 : 1);
    }

    // ---- the three routes --------------------------------------------------------------------
    const runs = {};
    runs.custom = await walkCensus(1, { walkRows: true });
    runs.questionnaire = await walkCensus(2);
    runs.named = await walkCensus(0);
    report.data.runs = runs;

    const allWalks = [].concat(runs.custom.walk, runs.questionnaire.walk, runs.named.walk);
    const drew = allWalks.filter((w) => w.window_open).length;
    const notSuppressed = allWalks.filter((w) => w.old_panel_suppressed !== true).length;
    const silent = allWalks.filter((w) => !w.window_open);
    push('C1 EVERY node of character creation is drawn by the RI-UIX08 window; the old panel is suppressed at all of them',
      allWalks.length > 0 && notSuppressed === 0 && silent.every((w) => w.paused),
      `${allWalks.length} node visit(s) over three class routes: ${drew} drew the RI-UIX08 window, ` +
      `${notSuppressed} left render/ui.js unsuppressed (must be 0). ` +
      `${silent.length} drew no surface at all — all paused hand-back nodes: ` +
      `${silent.every((w) => w.paused)} (${[...new Set(silent.map((w) => w.node))].join(', ') || 'none'}). ` +
      `Input kinds: ${[...new Set(allWalks.map((w) => w.input_kind || 'none'))].join(', ')}`);

    const regs = [runs.custom.old_panel_text, runs.questionnaire.old_panel_text, runs.named.old_panel_text];
    push('C1b PIXELS: the old vellum panel painted no text at all during any of the three passes',
      regs.every((r) => r.complete && r.distinct_count === 0),
      regs.map((r, i) => `pass ${i}: complete=${r.complete}, ${r.distinct_count} distinct string(s) on the ` +
        `'dialogue' surface${r.distinct_count ? ` — e.g. ${JSON.stringify(r.distinct.slice(0, 3))}` : ''}`).join(' | '));

    push('C2 all three routes complete — every node was answered through the window',
      runs.custom.done && runs.questionnaire.done && runs.named.done,
      `custom done=${runs.custom.done} (${runs.custom.walk.length} visits), ` +
      `questionnaire done=${runs.questionnaire.done} (${runs.questionnaire.walk.length} visits), ` +
      `named done=${runs.named.done} (${runs.named.walk.length} visits)`);

    // §H1 — THE ABSENCES, POSITIVELY. The presence control is C7.
    const censusFrames = allWalks.filter((w) => w.window_open);
    const withExit = censusFrames.filter((w) => w.has_exit).length;
    const withDispo = censusFrames.filter((w) => w.has_dispo).length;
    const four = censusFrames.filter((w) => JSON.stringify(w.elements_present) === '[1,2,3,4]').length;
    push('C3 §H1 no Goodbye and no disposition bar anywhere in creation, and the element census is 4 of 6',
      censusFrames.length > 0 && withExit === 0 && withDispo === 0 && four === censusFrames.length,
      `over ${censusFrames.length} census frame(s): ${withExit} declared a dialogue_exit, ` +
      `${withDispo} a disposition_meter (both must be 0); ${four} declared exactly elements [1,2,3,4]`);

    // §H2a — the multi-select mark.
    const pk = runs.custom.evidence.picks;
    push('C4 §H2a a pick is marked in the column, confirming it again removes the mark, and the count commits',
      pk.length === 4 && pk.every((p) => p.marked_after_first === 1 && p.marked_after_unpick === 0 && p.advanced_to !== p.node),
      pk.length ? pk.map((p) => `${p.node}: 1st pick -> ${p.marked_after_first} mark, un-pick -> ` +
        `${p.marked_after_unpick}, advanced to '${p.advanced_to}'`).join(' | ') : 'no pick node reached');
    const cust = pk.length ? pk[pk.length - 1].spec_custom : null;
    push('C4b §H2a what the marks committed reached the character spec',
      !!(cust && (cust.favoured || []).length === 2 && (cust.neglected || []).length === 2
        && (cust.primary || []).length === 3 && (cust.secondary || []).length === 2),
      `spec.custom after the four pick nodes: ${JSON.stringify(cust)}`);

    // §H2b — the typed name, both routes.
    const ty = runs.custom.evidence.typed;
    const typedRun = ty.find((t) => t.route === 'typed');
    push('C5 §H2b typing on a real keyboard reaches the typed row, and KeyE types an e rather than committing',
      !!(typedRun && typedRun.after_typing && typedRun.after_typing.typed === 'Sathel'
        && typedRun.after_typing.node === typedRun.node
        && typedRun.after_backspace && typedRun.after_backspace.typed === 'Sathe'),
      typedRun ? `typed row '${(typedRun.typed_row_before || []).join('')}' -> '${typedRun.after_typing.typed}' ` +
        `(node still '${typedRun.after_typing.node}', so the 'e' did not commit) -> after Backspace ` +
        `'${typedRun.after_backspace.typed}'` : 'no text node reached');
    push('C5b §H2b the typed name is what gets committed',
      !!(typedRun && typedRun.spec && typedRun.spec.hatchName === 'Sathe'),
      typedRun ? `spec.hatchName after Enter = ${JSON.stringify(typedRun.spec && typedRun.spec.hatchName)} ` +
        `(expected 'Sathe'), node '${typedRun.node}' -> '${typedRun.after_node}'` : 'no text node reached');
    const ledgerRun = ty.find((t) => t.route === 'ledger');
    push('C5c §H2b RI-JRN01 O17\'s other half — a ledger name is chosen with the caret instead',
      !!(ledgerRun && ledgerRun.chose && ledgerRun.after_node !== ledgerRun.node
        && ledgerRun.spec && ledgerRun.spec.givenName === ledgerRun.chose),
      ledgerRun ? `chose '${ledgerRun.chose}' -> spec.givenName=${JSON.stringify(ledgerRun.spec && ledgerRun.spec.givenName)}, ` +
        `node '${ledgerRun.node}' -> '${ledgerRun.after_node}'` : 'only one text node reached');

    // the questionnaire — ten dilemmas on one node.
    const qs = runs.questionnaire.evidence.questionnaire;
    push('C6 the questionnaire asks a run of distinct dilemmas and every answer moves it on',
      qs.length >= 8 && new Set(qs.map((q) => q.question)).size === qs.length,
      `${qs.length} dilemma(s) answered, ${new Set(qs.map((q) => q.question)).size} distinct question id(s): ` +
      qs.map((q) => q.question).join(', '));

    // every caret step landed where it was aimed
    const walked = runs.custom.walk.filter((w) => w.rows_walked);
    const moved = walked.reduce((a, w) => a + (w.rows_idx_moved || 0), 0);
    const asked = walked.reduce((a, w) => a + (w.rows_walked || 0), 0);
    const marked = walked.reduce((a, w) => a + (w.rows_marked || 0), 0);
    push('C6b every row the caret was walked onto moved the focus and was drawn focused',
      asked > 0 && moved === asked && marked === asked,
      `${asked} ArrowDown press(es) over ${walked.length} node(s): ${moved} moved rowIdx by exactly 1, ` +
      `${marked} left a drawn row marked focused (capped at 8 rows per node — see the comment)`);

    const stuck = allWalks.filter((w) => w.stuck);
    push('C6c nothing in the scene got stuck',
      stuck.length === 0,
      stuck.map((s) => `${s.node}(${s.stuck})`).join(', ') || 'no node failed to advance across three full routes');

    report.checks = checks;
    report.data.errors = h.errors ? h.errors.slice(0, 10) : [];
    writeJson(path.join(OUT, 'drive-probe-census.json'), report);
    log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
    await h.close();
    process.exit(checks.every((c) => c.pass) ? 0 : 1);
  }

  // ---- open a conversation -------------------------------------------------------------------
  //
  // OPENING is not what is under test and the world route needs a body walked into range, so the
  // conversation is opened through the harness door. Everything after this line is a real event.
  const opened = await h.page.evaluate(() => {
    const A = window.__HARNESS;
    try { A.closeMenu(); } catch { /* */ }
    let best = null;
    for (const n of A.listNPCs()) {
      const st = A.talkTo(n.eid);
      if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
    }
    if (best) A.talkTo(best.eid);
    return best;
  });
  await h.h('stepFrames', 3);
  let W = await read();
  report.data.opened = { ...opened, speaker: W.speaker, topics: W.topics.length, actions: W.actions.length };
  push('S0 the window is open with somebody to talk to', W.open && W.topics.length > 0,
    `speaker '${W.speaker}', ${W.actions.length} action row(s), ${W.topics.length} topic(s)`);
  if (!W.open) throw new Error('no dialogue window to drive');

  // ---- K1. cross to the topic column with a real ArrowRight -----------------------------------
  let before = W;
  await key('ArrowRight');
  let after = await read();
  note('keydown ArrowRight (cross to column)', before, after);
  push('K1 ArrowRight moves the caret from the prose to the topic column',
    after.focus && after.focus.pane === 'column',
    `focus ${focusStr(before.focus)} -> ${focusStr(after.focus)}`);

  // ---- K2. walk the column with real ArrowDown ------------------------------------------------
  before = after;
  await key('ArrowDown');
  after = await read();
  note('keydown ArrowDown (walk the column)', before, after);
  push('K2 ArrowDown walks the column one row',
    after.focus && after.focus.pane === 'column' && after.focus.rowIdx === (before.focus.rowIdx + 1),
    `rowIdx ${before.focus ? before.focus.rowIdx : '?'} -> ${after.focus ? after.focus.rowIdx : '?'}`);

  // ---- K3. THE DEFECT: confirm the focused topic with a real KeyE ------------------------------
  before = after;
  await key('KeyE');
  await h.h('stepFrames', 3);
  after = await read();
  note('keydown KeyE (confirm the focused column row)', before, after, {
    lines_delta: after.lines - before.lines,
    new_block: after.tail,
  });
  push('K3 KeyE on a focused column topic ANSWERS — the transcript grows',
    after.lines > before.lines,
    `${before.lines} -> ${after.lines} lines; last block heading '${after.tail ? after.tail.heading : '-'}' ` +
    `(${after.tail ? after.tail.chars : 0} chars)`);
  push('K3b the answer is APPENDED, not replaced (§D1)',
    after.blocks.length > before.blocks.length,
    `${before.blocks.length} -> ${after.blocks.length} block(s)`);

  // ---- K4. every topic in the column, operated --------------------------------------------- --
  //
  // §1.2b clause 2: enumerate every affordance and operate each one. Walk back to the top of the
  // column and press E on each row in turn, recording what each one produced.
  //
  // RE-OPEN FIRST, ON A FRESH TRANSCRIPT. K3 just answered row 1 ("dying far from the tree" in a
  // typical run); walking back to row 0 and pressing every row again would ask that SAME topic a
  // second time as this loop's very first act, before it has tested anything. That is not "every
  // row, once" (§1.2b clause 2's own words) — it is one row contaminated by K3, and it silently
  // exercises P1's re-ask/no-duplicate behaviour (`DialogueHistory.append()`) as a side effect
  // instead of on purpose.
  //
  // `DialogueHistory` only resets on a SPEAKER CHANGE (§D3: never cleared mid-conversation, and
  // that includes across a close/reopen with the SAME person — walking away and back is not a
  // different conversation with them). So closing and re-`talkTo`-ing the same eid keeps the
  // contaminated transcript; talking to somebody else first, then back, actually starts fresh.
  const anyoneElse = await h.page.evaluate((eid) => {
    const A = window.__HARNESS;
    const other = (A.listNPCs() || []).find((n) => n.eid !== eid);
    return other ? other.eid : null;
  }, opened.eid);
  if (anyoneElse) {
    await h.page.evaluate((eid) => { try { window.__HARNESS.closeMenu(); } catch { /* */ } window.__HARNESS.talkTo(eid); }, anyoneElse);
    await h.h('stepFrames', 2);
  }
  await h.page.evaluate(() => { try { window.__HARNESS.closeMenu(); } catch { /* */ } });
  await h.h('stepFrames', 2);
  await h.page.evaluate((eid) => { window.__HARNESS.talkTo(eid); }, opened.eid);
  await h.h('stepFrames', 3);
  const perTopic = [];
  after = await read();
  const nRows = after.actions.length + after.topics.length;
  // A fresh open starts focus back in the prose pane (§H1 / `_dialogueModel`'s "new person"
  // branch); cross to the column before walking it, same as K1 did the first time.
  if (after.focus && after.focus.pane !== 'column') { await key('ArrowRight'); after = await read(); }
  for (let i = 0; i < 40 && after.focus && after.focus.rowIdx > 0; i++) await key('ArrowUp', 1);
  after = await read();
  for (let row = 0; row < nRows; row++) {
    const b = await read();
    if (!b.open) break;
    await key('KeyE');
    await h.h('stepFrames', 2);
    const a = await read();
    // P1 / GATE-G-RESULT-AND-WHAT-IT-OWES.json `owed_3`, defect 2. `DialogueHistory.append()` no
    // longer pushes a byte-identical second copy of a topic's answer when that topic is re-asked
    // (two Gate G judges independently called the duplicate paragraph the worst thing in the
    // build) — it moves the EXISTING block to the end instead. `lines_after > lines_before` is
    // therefore no longer the right test for "this confirm did something": a re-ask that
    // correctly avoided duplicating still changes the TAIL (the block that was already there is
    // now the newest thing said), which `lines` alone cannot see. Comparing the tail catches both
    // a fresh answer (new block, new tail) and a de-duplicated re-ask (moved block, new tail)
    // while still failing honestly on a truly inert control (tail unchanged, nothing moved).
    const tailChanged = JSON.stringify(a.tail) !== JSON.stringify(b.tail);
    perTopic.push({
      row,
      label: (b.elements.find((e) => e.focused && e.kind === 'list_row') || {}).text || null,
      focus: focusStr(b.focus),
      lines_before: b.lines, lines_after: a.lines,
      answered: a.lines > b.lines || tailChanged,
      heading: a.tail ? a.tail.heading : null,
      disposition: `${b.disposition} -> ${a.disposition}`,
    });
    note(`keydown KeyE on column row ${row}`, b, a, { label: perTopic[perTopic.length - 1].label });
    if (row < nRows - 1) await key('ArrowDown', 1);
    after = await read();
    if (!after.open) break;
  }
  report.data.per_topic = perTopic;
  const answered = perTopic.filter((t) => t.answered).length;
  push('K4 every topic row in the column answers when confirmed',
    perTopic.length > 0 && answered === perTopic.length,
    `${answered}/${perTopic.length} rows produced a new block; dead rows: ` +
    (perTopic.filter((t) => !t.answered).map((t) => t.label || `#${t.row}`).join(', ') || 'none'));

  // ---- K5. the inline links in the prose -------------------------------------------------------
  W = await read();
  if (!W.open) {
    push('K5 an inline link can be followed', false, 'the conversation closed before the links could be driven');
  } else {
    await key('ArrowLeft');
    let b = await read();
    push('K5a ArrowLeft crosses back to the prose',
      b.focus && b.focus.pane === 'prose', `focus ${focusStr(W.focus)} -> ${focusStr(b.focus)}`);
    const perLink = [];
    // Walk the caret down the links, following each one. Bounded: following a link adds prose,
    // which adds links, so this walks a prefix rather than a fixpoint.
    for (let i = 0; i < Math.min(6, b.links_total || 0); i++) {
      const pre = await read();
      if (!pre.open) break;
      await key('KeyE');
      await h.h('stepFrames', 2);
      const post = await read();
      perLink.push({
        i, topic: pre.link_topics[pre.focus ? pre.focus.linkIdx : 0] || null,
        focus: focusStr(pre.focus),
        lines_before: pre.lines, lines_after: post.lines,
        followed: post.lines > pre.lines || post.topics.length > pre.topics.length,
        topics_known: `${pre.topics_known} -> ${post.topics_known}`,
      });
      note(`keydown KeyE on inline link ${i}`, pre, post, { topic: perLink[perLink.length - 1].topic });
      await key('ArrowDown', 1);
      b = await read();
      if (!b.open) break;
    }
    report.data.per_link = perLink;
    const followed = perLink.filter((l) => l.followed).length;
    push('K5 following an inline link with KeyE does something',
      perLink.length > 0 && followed === perLink.length,
      `${followed}/${perLink.length} link(s) followed produced a new block or a new column entry`);
  }

  // ---- K6. Goodbye, by walking to it and confirming ---------------------------------------------
  W = await read();
  if (W.open) {
    await key('ArrowRight');
    let b = await read();
    for (let i = 0; i < 60; i++) {
      await key('ArrowDown', 1);
      const n = await read();
      if (!n.open) break;
      if (n.focus && n.focus.rowIdx === b.focus.rowIdx) { b = n; break; }
      b = n;
    }
    const goodbyeIdx = b.actions.length + b.topics.length;
    push('K6a the caret reaches the Goodbye row',
      b.focus && b.focus.rowIdx === goodbyeIdx,
      `rowIdx ${b.focus ? b.focus.rowIdx : '?'} of ${goodbyeIdx} (actions ${b.actions.length} + topics ${b.topics.length})`);
    await key('KeyE');
    const a = await read();
    note('keydown KeyE on Goodbye', b, a);
    push('K6 Goodbye closes the conversation',
      !a.open && !a.conv_open,
      `window open ${b.open} -> ${a.open}, conversation ${b.conv_open} -> ${a.conv_open}`);
  } else {
    push('K6 Goodbye closes the conversation', false, 'the window was already closed');
  }

  // ---- K7. the Space (roll) close path ----------------------------------------------------------
  await h.page.evaluate(() => {
    const A = window.__HARNESS;
    const n = A.listNPCs()[0];
    if (n) A.talkTo(n.eid);
  });
  await h.h('stepFrames', 3);
  let b7 = await read();
  await key('Space');
  const a7 = await read();
  note('keydown Space (roll = back out)', b7, a7);
  push('K7 Space backs out of the conversation',
    b7.open && !a7.open, `window open ${b7.open} -> ${a7.open}`);

  // ---- M1. the mouse. §1.2b clause 4 -------------------------------------------------------------
  await h.page.evaluate(() => {
    const A = window.__HARNESS;
    let best = null;
    for (const n of A.listNPCs()) {
      const st = A.talkTo(n.eid);
      if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
    }
    if (best) A.talkTo(best.eid);
  });
  await h.h('stepFrames', 3);
  let bm = await read();
  const rowEl = bm.elements.find((e) => e.kind === 'list_row' && String(e.id).startsWith('dialogue.topic/'));
  if (!rowEl) {
    push('M1 a topic in the column can be clicked', false, 'no list_row element to click');
  } else {
    await click(rowEl.rect[0] + rowEl.rect[2] / 2, rowEl.rect[1] + rowEl.rect[3] / 2);
    const am = await read();
    note(`click column row '${rowEl.text}'`, bm, am, { rect: rowEl.rect });
    push('M1 clicking a topic in the column answers it',
      am.lines > bm.lines,
      `clicked '${rowEl.text}' at ${rowEl.rect.join(',')}; ${bm.lines} -> ${am.lines} lines, ` +
      `last heading '${am.tail ? am.tail.heading : '-'}'`);
  }
  bm = await read();
  const linkEl = bm.elements.find((e) => e.kind === 'topic_link');
  if (!linkEl) {
    push('M2 an inline link can be clicked', false, 'no topic_link element on screen to click');
  } else {
    await click(linkEl.rect[0] + linkEl.rect[2] / 2, linkEl.rect[1] + linkEl.rect[3] / 2);
    const am = await read();
    note(`click inline link '${linkEl.text}'`, bm, am, { rect: linkEl.rect });
    push('M2 clicking an inline link follows it',
      am.lines > bm.lines || am.topics.length > bm.topics.length,
      `clicked '${linkEl.text}' at ${linkEl.rect.join(',')}; ${bm.lines} -> ${am.lines} lines, ` +
      `${bm.topics.length} -> ${am.topics.length} topics`);
  }
  // ---- X1. DELETE-THE-FIX, in the same browser, on the same click ------------------------------
  //
  // RULES rule 6, and rule 6's second clause specifically: confirm the control is not itself
  // inert. The teardown removes the ONE seam this fix adds — `real.onSurfacePointer`, the hook
  // `input/real.js` consults before turning `Mouse0` into `light` — and nothing else. If the same
  // click on the same row still answers with the hook gone, then something other than this change
  // was carrying the result and the pass above means nothing.
  bm = await read();
  const rowX = bm.elements.find((e) => e.kind === 'list_row' && String(e.id).startsWith('dialogue.topic/'));
  if (rowX) {
    const saved = await h.page.evaluate(() => {
      const r = window.__ENGINE.real;
      window.__SAVED_HOOK = r.onSurfacePointer;
      r.onSurfacePointer = null;
      return typeof window.__SAVED_HOOK === 'function';
    });
    const bx = await read();
    await click(rowX.rect[0] + rowX.rect[2] / 2, rowX.rect[1] + rowX.rect[3] / 2);
    const ax = await read();
    await h.page.evaluate(() => { window.__ENGINE.real.onSurfacePointer = window.__SAVED_HOOK; });
    note('DELETE-THE-FIX: click column row with the pointer hook removed', bx, ax, { rect: rowX.rect });
    report.data.delete_the_fix = { had_hook: saved, lines: [bx.lines, ax.lines], blocks: [bx.blocks.length, ax.blocks.length] };
    push('X1 DELETE-THE-FIX: with the pointer hook removed the same click does nothing',
      saved && ax.lines === bx.lines && ax.blocks.length === bx.blocks.length,
      `hook was present=${saved}; ${bx.lines} -> ${ax.lines} lines, ${bx.blocks.length} -> ${ax.blocks.length} blocks ` +
      '(this is the pre-fix behaviour the owner reported)');
  } else {
    push('X1 DELETE-THE-FIX: with the pointer hook removed the same click does nothing', false,
      'no list_row to click for the control arm');
  }

  bm = await read();
  const byeEl = bm.elements.find((e) => e.kind === 'dialogue_exit');
  if (!byeEl) {
    push('M3 the Goodbye button can be clicked', false, 'no dialogue_exit element to click');
  } else {
    await click(byeEl.rect[0] + byeEl.rect[2] / 2, byeEl.rect[1] + byeEl.rect[3] / 2);
    const am = await read();
    note('click Goodbye', bm, am, { rect: byeEl.rect });
    push('M3 clicking Goodbye closes the conversation', bm.open && !am.open,
      `window open ${bm.open} -> ${am.open}`);
  }

  // ---- T1. touch. §1.2b clause 4 -----------------------------------------------------------------
  //
  // AND THE SECOND INSTRUMENT TRAP IN THIS FILE. `input/real.js applyDeviceClass()` attaches the
  // touch listeners ONLY on device class `handheld`; on a desktop class they are detached, so a
  // `PointerEvent` reaches nothing and T1 fails against a game that might be fine. That is the
  // same shape as the harness-mode trap at the top and it cost this probe a second run. Force the
  // class through A-JRN4's own door and then ASSERT the listeners are live before believing T1.
  await h.h('setViewport', { pointer: 'coarse' });
  const touchWired = await h.page.evaluate(() => {
    const t = window.__ENGINE.real.touch;
    return { enabled: !!t.enabled, attached: !!t.attached, hook: typeof t.onSurfacePointer === 'function' };
  });
  report.data.touch_instrument = touchWired;
  push('I1 INSTRUMENT: the touch listeners are attached',
    touchWired.enabled && touchWired.attached && touchWired.hook,
    `touch.enabled=${touchWired.enabled}, attached=${touchWired.attached}, surface hook=${touchWired.hook}`);
  await h.page.evaluate(() => {
    const A = window.__HARNESS;
    let best = null;
    for (const n of A.listNPCs()) {
      const st = A.talkTo(n.eid);
      if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
    }
    if (best) A.talkTo(best.eid);
  });
  await h.h('stepFrames', 3);
  let bt = await read();
  const rowT = bt.elements.find((e) => e.kind === 'list_row' && String(e.id).startsWith('dialogue.topic/'));
  if (!rowT) {
    push('T1 a topic in the column can be tapped', false, 'no list_row element to tap');
  } else {
    await tap(rowT.rect[0] + rowT.rect[2] / 2, rowT.rect[1] + rowT.rect[3] / 2);
    const at = await read();
    note(`tap column row '${rowT.text}'`, bt, at, { rect: rowT.rect });
    push('T1 tapping a topic in the column answers it', at.lines > bt.lines,
      `tapped '${rowT.text}'; ${bt.lines} -> ${at.lines} lines`);
  }

  report.checks = checks;
  report.data.errors = h.errors ? h.errors.slice(0, 10) : [];
  writeJson(path.join(OUT, CENSUS ? 'drive-probe-census.json' : 'drive-probe.json'), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  report.checks = checks;
  writeJson(path.join(OUT, CENSUS ? 'drive-probe-census.json' : 'drive-probe.json'), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);
