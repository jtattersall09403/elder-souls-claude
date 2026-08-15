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

EXIT 0 = every check passes · 1 = a check failed · 2 = could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.join(REPO_ROOT, String(args.out || 'reports/uix08'));
ensureDir(OUT);
const STATE = String(args.state || 'helstrom-market');
const CENSUS = !!args.census;

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
    await h.h('setMode', 'play-instrumented');
    await h.h('setRenderRate', 0);
    const walk = await h.page.evaluate(() => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const seen = [];
      eng.censusBegin({});
      for (let i = 0; i < 40; i++) {
        const st = eng.getCensusState();
        if (!st || st.done) break;
        A.stepFrames(1);
        const ui = A.getUIState();
        seen.push({
          node: st.node,
          input_kind: st.input ? st.input.kind : null,
          options: eng.censusSurface ? eng.censusSurface.options.length : 0,
          old_panel_open: !!(ui.dialogue_surface && ui.dialogue_surface.open),
          old_panel_options: (ui.dialogue_surface && ui.dialogue_surface.option_count !== undefined) ? ui.dialogue_surface.option_count : null,
          new_window_open: !!(ui.dialogue_window && ui.dialogue_window.open),
        });
        // Advance by answering the first option, through the census's own commit path.
        const opts = eng.censusSurface ? eng.censusSurface.options : [];
        if (!opts.length) { if (eng.census.paused) eng.censusEnter(null); else break; }
        else { try { eng.censusAnswer(opts[0].id); } catch { break; } A.stepFrames(1); }
      }
      return seen;
    });
    report.data.census_walk = walk;
    const onNew = walk.filter((w) => w.new_window_open).length;
    const onOld = walk.filter((w) => w.old_panel_open).length;
    push('C1 the character-creation flow uses the RI-UIX08 dialogue window',
      walk.length > 0 && onNew === walk.length,
      `${walk.length} creation node(s) drawn: ${onNew} on the RI-UIX08 window, ${onOld} on the old ` +
      `render/ui.js reply panel. Input kinds seen: ` +
      [...new Set(walk.map((w) => w.input_kind))].join(', '));
    report.checks = checks;
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
  const perTopic = [];
  const nRows = after.actions.length + after.topics.length;
  for (let i = 0; i < 40 && after.focus && after.focus.rowIdx > 0; i++) await key('ArrowUp', 1);
  after = await read();
  for (let row = 0; row < nRows; row++) {
    const b = await read();
    if (!b.open) break;
    await key('KeyE');
    await h.h('stepFrames', 2);
    const a = await read();
    perTopic.push({
      row,
      label: (b.elements.find((e) => e.focused && e.kind === 'list_row') || {}).text || null,
      focus: focusStr(b.focus),
      lines_before: b.lines, lines_after: a.lines,
      answered: a.lines > b.lines,
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
