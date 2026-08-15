#!/usr/bin/env node
// t4-r2-critic-drive.mjs — THE MORROWIND SCREENS, OPERATED. Not photographed.
//
// Owner: crit-t4-r2 (independent critic, round 2). Binding: `corpus/00-doctrine/CRITIC-DOCTRINE.md`
// §1.2b, added 2026-08-15: "A screen must WORK, not merely look right. Drive it with real inputs."
//
// WHAT MAKES THIS DIFFERENT FROM EVERY OTHER T4 INSTRUMENT ON DISK. `t4-r2-measure.mjs`,
// `critic-t4-lean.mjs` and `critic-t4-shots.mjs` all reach the screens through
// `__HARNESS.openMenu()` / `uiFocus()` — i.e. they call a function the UI also calls, and they SET
// FOCUS STATE. A dead input layer is invisible to all three. Every interaction in this file is a
// real DOM event dispatched at the page: `KeyboardEvent` for keys, `MouseEvent` for clicks,
// `PointerEvent` for taps, and a synthetic `navigator.getGamepads()` descriptor for the pad.
// Nothing here calls a UI function and nothing here writes `ui.focus`.
//
// TWO INSTRUMENT TRAPS, INHERITED FROM `dialogue-drive-probe.mjs` RATHER THAN REDISCOVERED:
//   I0 — `?harness=1` puts the engine in mode 'harness', which calls `real.detach()`, so a
//        KeyboardEvent reaches NOTHING and every check below would fail against a fine game.
//        `play-instrumented` is the mode with real listeners and a harness-driven clock.
//   I1 — `input/real.js applyDeviceClass()` attaches the touch listeners only on device class
//        `handheld`. On desktop a PointerEvent reaches nothing.
// Both are asserted before anything is believed.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = could not run.
'use strict';

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
t4-r2-critic-drive.mjs — operate every Morrowind screen through the shipped input path.

  --state <id>   world state to load (default: ui-journal)
  --out <dir>    report directory (default corpus/90-verdicts/wave1/artifacts/T4-r2c/reports)

EXIT 0 = every check passes · 1 = a check failed · 2 = could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2c/reports'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');

const checks = [];
const push = (id, pass, detail) => {
  checks.push({ id, pass, detail });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`);
};

const report = {
  schema: 'elder-souls/t4-screens-drive@1',
  at: new Date().toISOString(),
  state: STATE,
  interactions: [],
  checks: [],
  data: {},
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

// ---- real input primitives -------------------------------------------------------------------

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

/** Press a PAD button through `navigator.getGamepads()`, which is where `real.pollGamepad` looks. */
async function padPress(buttonIdx, holdFrames = 3) {
  const mk = (pressed) => ({
    id: 'critic synthetic pad (STANDARD GAMEPAD)', index: 0, mapping: 'standard', connected: true,
    timestamp: 1, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed && i === buttonIdx, touched: false, value: pressed && i === buttonIdx ? 1 : 0 })),
  });
  await h.h('setSyntheticPads', [mk(true)]);
  await h.h('stepFrames', holdFrames);
  await h.h('setSyntheticPads', [mk(false)]);
  await h.h('stepFrames', 2);
}

// ---- reading the screen ------------------------------------------------------------------------

async function read() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS;
    const s = A.getUIState();
    const els = (s.elements || []).filter((e) => e.visible);
    return {
      mode: s.mode,
      phase: s.combat_phase,
      focus: s.focus ? { ...s.focus } : null,
      nav: s.nav ? { advertised: s.nav.advertised.slice(), walkable: s.nav.walkable.slice(), refused: s.nav.refused } : null,
      hud_mode: s.hud ? s.hud.mode : null,
      panel_rect: s.panel_rect || null,
      pictorial: s.pictorial || null,
      journal: s.journal || null,
      book: s.book || null,
      n_elements: els.length,
      kinds: els.reduce((a, e) => { a[e.kind] = (a[e.kind] || 0) + 1; return a; }, {}),
      texts: els.filter((e) => e.text !== null && e.text !== undefined).map((e) => String(e.text)),
      headers: els.filter((e) => e.kind === 'panel_header').map((e) => String(e.text)),
      rows: els.filter((e) => e.kind === 'list_row').map((e) => ({ id: e.id, text: e.text, focused: !!e.focused })),
      detail: els.filter((e) => e.kind === 'detail_panel' || String(e.id).includes('detail')).map((e) => ({ id: e.id, text: e.text })),
      hint: els.filter((e) => e.kind === 'hint').map((e) => String(e.text)),
      sortLabel: els.filter((e) => /sort/i.test(String(e.id)) || /^sort/i.test(String(e.text || ''))).map((e) => String(e.text)),
      elements: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect.map((v) => Math.round(v)), text: e.text, focused: !!e.focused })),
    };
  });
}

/** The simulation's own view — carried items, equipped, frame. Read only. */
async function world() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const st = A.getPlayerStats ? A.getPlayerStats() : {};
    const inv = Array.isArray(eng.sim.inventory) ? eng.sim.inventory : [];
    return {
      frame: A.getFrame(),
      carried: inv.map((i) => String(i.id || i)),
      equipped: inv.filter((i) => i && i.slot).map((i) => `${i.id}@${i.slot}`),
      level: st.level === undefined ? null : st.level,
      souls: eng.sim.progression ? eng.sim.progression.souls : null,
      gold: eng.sim.progression ? eng.sim.progression.gold : null,
      attrs: eng.sim.progression && eng.sim.progression.attributes ? JSON.parse(JSON.stringify(eng.sim.progression.attributes)) : null,
    };
  });
}

/**
 * Walk to `target` using only real presses: open the menu if it is shut, then `swap_right` until
 * the mode matches or the ring wraps. Returns the mode actually landed on.
 */
async function goto(target) {
  for (let i = 0; i < 3; i++) { const r = await read(); if (r.mode !== 'world') break; await key('KeyM'); }
  for (let i = 0; i < 12; i++) {
    const r = await read();
    if (r.mode === target) return target;
    if (r.mode === 'world') await key('KeyM'); else await key('Digit3');
  }
  return (await read()).mode;
}

function note(action, before, after, extra) {
  const rec = {
    action,
    before: { mode: before.mode, focus: before.focus, n: before.n_elements },
    after: { mode: after.mode, focus: after.focus, n: after.n_elements },
    ...extra,
  };
  report.interactions.push(rec);
  return rec;
}

const J = (o) => JSON.stringify(o);

try {
  // ---- I0: the instrument, and its own falsification -------------------------------------------
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  const wired = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const attached = !!(eng.real && eng.real.attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true }));
    const moveX = eng.input.moveX;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true, cancelable: true }));
    const pending = eng.input.pendingPress;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm', bubbles: true }));
    return { attached, moveX, pending };
  });
  await h.h('stepFrames', 2);
  report.data.instrument = wired;
  push('I0 INSTRUMENT a real DOM key reaches the input pipeline',
    wired.attached && Math.abs(wired.moveX) > 0.5 && wired.pending !== 0,
    `real.attached=${wired.attached}, ArrowRight -> moveX=${wired.moveX}, KeyM -> pendingPress=${wired.pending}`);
  if (!wired.attached) throw new Error('the real input listeners are not attached — nothing below could be measured');

  // ---- A. OPEN. `menu` from the world ------------------------------------------------------------
  //
  // THE FIXTURE OPENS ON A SCREEN. `states/ui-journal.json` restores `mode: 'inventory'`, so the
  // first `menu` press CLOSES rather than opens. Pass 1 of this probe recorded a false A1 failure
  // for exactly that reason and every ring check downstream cascaded off it — recorded here
  // rather than quietly fixed, because it is the same class of defect this verdict is judging.
  for (let i = 0; i < 6; i++) { const r0 = await read(); if (r0.mode === 'world') break; await key('Escape'); }
  let b = await read();
  await key('KeyM');
  let a = await read();
  note('keydown KeyM (menu) from the world', b, a);
  push('A1 `menu` opens a screen from the world', b.mode === 'world' && a.mode === 'inventory',
    `mode ${b.mode} -> ${a.mode}`);
  report.data.opened = { advertised: a.nav && a.nav.advertised, walkable: a.nav && a.nav.walkable };

  // ---- B. THE RING. Every advertised screen, reached by real presses ---------------------------
  //
  // §1.2b clause 2: enumerate every affordance and operate each one. The ring IS an affordance —
  // it is the only route between screens, and the round-1 verdict never pressed it.
  const advertised = (a.nav && a.nav.advertised ? a.nav.advertised : []).slice();
  const visitedFwd = [a.mode];
  for (let i = 0; i < 10; i++) {
    const pre = await read();
    await key('Digit3');           // swap_right
    const post = await read();
    note('keydown Digit3 (swap_right)', pre, post);
    visitedFwd.push(post.mode);
    if (post.mode === 'world') break;
  }
  report.data.walk_forward = visitedFwd;
  const reached = new Set(visitedFwd);
  const unreached = advertised.filter((m) => m !== 'world' && !reached.has(m));
  push('B1 every advertised screen is reachable by pressing swap_right',
    unreached.length === 0,
    `advertised ${J(advertised)}; forward walk visited ${J(visitedFwd)}; never reached ${J(unreached)}`);

  // walk backwards too
  await key('KeyM');
  let cur = await read();
  if (cur.mode === 'world') { await key('KeyM'); cur = await read(); }
  const visitedBack = [cur.mode];
  for (let i = 0; i < 10; i++) {
    const pre = await read();
    await key('Digit4');           // swap_left
    const post = await read();
    note('keydown Digit4 (swap_left)', pre, post);
    visitedBack.push(post.mode);
    if (post.mode === 'world') break;
  }
  report.data.walk_back = visitedBack;
  push('B2 swap_left walks the ring too (and does not dead-end)',
    visitedBack.length > 1,
    `backward walk from inventory: ${J(visitedBack)}`);

  // ---- C. THE INVENTORY -------------------------------------------------------------------------
  await goto('inventory');
  let s = await read();
  push('C0 the inventory is the screen `menu` opens', s.mode === 'inventory', `mode=${s.mode}`);

  // C1 — the column axis. Real left/right.
  {
    const pre = await read();
    await key('KeyA');            // left
    const mid = await read();
    note('keydown KeyA (left) in inventory', pre, mid);
    await key('KeyD');            // right
    const post = await read();
    note('keydown KeyD (right) in inventory', mid, post);
    push('C1 left/right moves between the inventory columns',
      pre.focus && mid.focus && pre.focus.col !== mid.focus.col,
      `col ${pre.focus && pre.focus.col} -(left)-> ${mid.focus && mid.focus.col} -(right)-> ${post.focus && post.focus.col}`);
  }

  // C2 — the CATEGORY column: walk it and watch the row list change.
  {
    // stand on column 0
    for (let i = 0; i < 3; i++) { const r = await read(); if (r.focus && r.focus.col === 0) break; await key('KeyA'); }
    const pre = await read();
    const preRows = pre.rows.map((r) => r.text);
    await key('KeyS');            // down a category
    const post = await read();
    note('keydown KeyS (down) on the category column', pre, post, { rows_before: preRows.length, rows_after: post.rows.length });
    push('C2 walking the category column filters the item list',
      pre.focus.tagIdx !== post.focus.tagIdx && J(preRows) !== J(post.rows.map((r) => r.text)),
      `tagIdx ${pre.focus.tagIdx} -> ${post.focus.tagIdx}; rows ${preRows.length} -> ${post.rows.length} ` +
      `(first: '${preRows[0] || '-'}' -> '${post.rows.map((r) => r.text)[0] || '-'}')`);
  }

  // C3 — the SORT control: the last tag, confirmed, cycles the sort. RI-UIX03 C6.
  {
    let r = await read();
    // walk to the bottom of the category column
    for (let i = 0; i < 20; i++) {
      const pre2 = await read();
      await key('KeyS', 1);
      const post2 = await read();
      if (post2.focus.tagIdx === pre2.focus.tagIdx) break;
    }
    r = await read();
    const beforeRows = r.rows.map((x) => x.text);
    const beforeSort = r.focus.sortIdx;
    await key('KeyE');            // interact = confirm
    const post = await read();
    note('keydown KeyE (confirm) on the sort control', r, post, { rows_before: beforeRows, rows_after: post.rows.map((x) => x.text) });
    push('C3 confirming the sort control changes the sort AND reorders the list',
      post.focus.sortIdx !== beforeSort && J(beforeRows) !== J(post.rows.map((x) => x.text)),
      `sortIdx ${beforeSort} -> ${post.focus.sortIdx}; first row '${beforeRows[0] || '-'}' -> '${post.rows.map((x) => x.text)[0] || '-'}'`);
  }

  // C4 — the ITEM column: walking it moves the selection AND the detail panel.
  {
    // back to a populated category (index 0 = all) and column 1
    for (let i = 0; i < 25; i++) { const r = await read(); if (r.focus.tagIdx === 0) break; await key('KeyW', 1); }
    for (let i = 0; i < 3; i++) { const r = await read(); if (r.focus.col === 1) break; await key('KeyD'); }
    const pre = await read();
    const preDetail = J(pre.detail);
    await key('KeyS');
    const post = await read();
    note('keydown KeyS (down) on the item column', pre, post, { detail_before: pre.detail, detail_after: post.detail });
    push('C4 walking the item list moves the selection and the detail panel follows',
      pre.focus.rowIdx !== post.focus.rowIdx && preDetail !== J(post.detail),
      `rowIdx ${pre.focus.rowIdx} -> ${post.focus.rowIdx}; detail changed=${preDetail !== J(post.detail)}; ` +
      `focused row '${(post.rows.find((x) => x.focused) || {}).text || '-'}'`);
  }

  // C5 — EQUIP through the real path. RI-UIX03 P7 / M-P5.
  {
    // find a weapon row by walking until the detail names one, then confirm
    let found = null;
    for (let i = 0; i < 40; i++) {
      const r = await read();
      const foc = r.rows.find((x) => x.focused);
      if (foc && /maul|knife|blade|axe|spear|club|staff|bow/i.test(String(foc.text))) { found = foc; break; }
      await key('KeyS', 1);
    }
    const pre = await read();
    const wPre = await world();
    if (!found) {
      push('C5 confirming a weapon row equips it', false, 'no weapon row could be focused by walking the list');
    } else {
      await key('KeyE');
      await h.h('stepFrames', 40);
      const post = await read();
      const wPost = await world();
      note(`keydown KeyE (confirm) on weapon row '${found.text}'`, pre, post,
        { equipped_before: wPre.equipped, equipped_after: wPost.equipped });
      push('C5 confirming a weapon row equips it',
        J(wPre.equipped) !== J(wPost.equipped),
        `row '${found.text}': equipment ${J(wPre.equipped)} -> ${J(wPost.equipped)}`);
    }
  }

  // C6 — the PAPER DOLL is drawn and it follows what is equipped. RI-UIX09 P2.
  {
    const r = await read();
    const dolls = r.elements.filter((e) => e.kind === 'doll');
    const wNow = await world();
    push('C6 the equipped figure is drawn (RI-UIX09 P2)',
      dolls.length > 0,
      `${dolls.length} element(s) of kind 'doll' on the inventory screen; rects ${J(dolls.map((d) => d.rect))}; equipment ${J(wNow.equipped)}`);
    report.data.doll = { count: dolls.length, rects: dolls.map((d) => d.rect), equipment: wNow.equipped };
  }

  // C7 — the HUD mode switch, driven. `two_hand` (KeyG) out of combat.
  {
    await goto('inventory');
    const pre = await read();
    await key('KeyG', 4);
    const post = await read();
    // and again with a longer hold, so a one-frame edge miss cannot be read as a dead control
    await key('KeyG', 8);
    const post2 = await read();
    note('keydown KeyG (two_hand = HUD mode switch)', pre, post, { hud_before: pre.hud_mode, hud_after: post.hud_mode, hud_after_second: post2.hud_mode });
    push('C7 the HUD full/minimal switch responds to a real press',
      pre.hud_mode !== post.hud_mode || pre.hud_mode !== post2.hud_mode,
      `hud.mode ${pre.hud_mode} -(4f hold)-> ${post.hud_mode} -(8f hold)-> ${post2.hud_mode}; ` +
      `the inventory's own foot hint reads ${J((await read()).hint)}`);
  }

  // ---- D. THE JOURNAL ---------------------------------------------------------------------------
  //
  // Reached by pressing, not by openMenu().
  {
    await goto('journal');
    let r = await read();
    push('D0 the journal is reachable by pressing swap_right', r.mode === 'journal', `mode=${r.mode}`);

    if (r.mode === 'journal') {
      // D1 — page turns.
      const pre = await read();
      await key('KeyD');
      const post = await read();
      note('keydown KeyD (right) in the journal', pre, post, { page_before: pre.focus.page, page_after: post.focus.page });
      push('D1 the journal turns its pages on a real press',
        post.focus.page !== pre.focus.page,
        `page ${pre.focus.page} -> ${post.focus.page}, view '${post.focus.view}'`);

      // D2 — the INDEX: left from page 0 opens it; a row confirms to that quest's page.
      for (let i = 0; i < 8; i++) { const x = await read(); if (x.focus.page === 0) break; await key('KeyA', 1); }
      const bi = await read();
      await key('KeyA');
      const ai = await read();
      note('keydown KeyA (left) at page 0 — the quest index', bi, ai);
      push('D2 the quest index opens from the chronicle',
        ai.focus.view === 'index', `view '${bi.focus.view}' -> '${ai.focus.view}'`);

      if (ai.focus.view === 'index') {
        const b3 = await read();
        await key('KeyS');
        const m3 = await read();
        note('keydown KeyS (down) in the quest index', b3, m3);
        await key('KeyE');
        const a3 = await read();
        note('keydown KeyE (confirm) on an index row', m3, a3, { page_after: a3.focus.page });
        push('D3 confirming an index row jumps the chronicle to that quest',
          a3.focus.view === 'chronicle' && m3.focus.indexIdx !== b3.focus.indexIdx,
          `indexIdx ${b3.focus.indexIdx} -> ${m3.focus.indexIdx}; view -> '${a3.focus.view}', page ${a3.focus.page}`);
      }

      // D4 — SEARCH. Confirm from the chronicle enters it; the ring types; and then — the check
      // nobody has run — CAN YOU GET OUT?
      for (let i = 0; i < 6; i++) { const x = await read(); if (x.focus.view === 'chronicle') break; await key('KeyE', 1); }
      const bs = await read();
      await key('KeyE');
      const asr = await read();
      note('keydown KeyE (confirm) in the chronicle — search', bs, asr);
      push('D4 the search view opens from the chronicle',
        asr.focus.view === 'search', `view '${bs.focus.view}' -> '${asr.focus.view}'`);

      if (asr.focus.view === 'search') {
        const b5 = await read();
        await key('KeyD');
        const m5 = await read();
        note('keydown KeyD (right) on the search ring', b5, m5);
        await key('KeyE');
        const a5 = await read();
        note('keydown KeyE (confirm) on a ring letter', m5, a5, { query_after: a5.focus.query });
        push('D5 the search ring walks and types a character into the query',
          m5.focus.ringIdx !== b5.focus.ringIdx && String(a5.focus.query || '').length > String(b5.focus.query || '').length,
          `ringIdx ${b5.focus.ringIdx} -> ${m5.focus.ringIdx}; query '${b5.focus.query}' -> '${a5.focus.query}'`);

        // D6 — THE WAY OUT. `roll` (Space) is the back verb everywhere else in this interface.
        const b6 = await read();
        await key('Space');
        const a6 = await read();
        note('keydown Space (roll = back) inside the search view', b6, a6,
          { view_before: b6.focus && b6.focus.view, mode_after: a6.mode, focus_after: a6.focus });
        push('D6 back inside the search view returns to the journal, not out of it',
          a6.mode === 'journal' && a6.focus && a6.focus.view !== 'search',
          `mode ${b6.mode} -> ${a6.mode}; view '${b6.focus.view}' -> '${a6.focus ? a6.focus.view : '(no journal focus)'}'`);

        // D7 — and if it closed the screen: does re-opening the journal put you BACK in search
        // with the same query? A sticky sub-view is a trap, not a screen.
        await goto('journal');
        const a7 = await read();
        report.data.journal_reopen = { mode: a7.mode, focus: a7.focus };
        push('D7 re-opening the journal returns to the chronicle, not to a stuck search box',
          a7.mode === 'journal' && a7.focus && a7.focus.view !== 'search',
          `after walking back to the journal: view '${a7.focus ? a7.focus.view : '?'}', query '${a7.focus ? a7.focus.query : '?'}'`);
      }
    }
  }

  // ---- E. THE CHARACTER SHEET and THE SPELLS ----------------------------------------------------
  for (const target of ['sheet', 'spells']) {
    await goto(target);
    const pre = await read();
    if (pre.mode !== target) { push(`E-${target} the ${target} screen is reachable and its list walks`, false, `never reached; mode=${pre.mode}`); continue; }
    await key('KeyS');
    const post = await read();
    note(`keydown KeyS (down) on the ${target} screen`, pre, post);
    push(`E-${target} the ${target} screen is reachable and its list walks`,
      post.focus && pre.focus && post.focus.rowIdx !== pre.focus.rowIdx,
      `rowIdx ${pre.focus && pre.focus.rowIdx} -> ${post.focus && post.focus.rowIdx}, ${post.rows.length} rows`);
  }

  // ---- F. THE MAP -------------------------------------------------------------------------------
  {
    await goto('map');
    const pre = await read();
    if (pre.mode !== 'map') { push('F1 the map screen walks its places and swaps its view', false, `never reached; mode=${pre.mode}`); }
    else {
      await key('KeyS');
      const mid = await read();
      note('keydown KeyS (down) on the map', pre, mid);
      await key('KeyE');
      const post = await read();
      note('keydown KeyE (confirm) on the map', mid, post, { view_before: mid.focus.view, view_after: post.focus.view });
      push('F1 the map screen walks its places and swaps its view',
        mid.focus.placeIdx !== pre.focus.placeIdx && post.focus.view !== mid.focus.view,
        `placeIdx ${pre.focus.placeIdx} -> ${mid.focus.placeIdx}; view '${mid.focus.view}' -> '${post.focus.view}'`);
    }
  }

  // ---- G. WAIT ----------------------------------------------------------------------------------
  {
    await goto('wait');
    const pre = await read();
    if (pre.mode !== 'wait') { push('G1 the wait screen sets hours and confirms', false, `never reached; mode=${pre.mode}`); }
    else {
      const wPre = await world();
      await key('KeyS');
      const mid = await read();
      note('keydown KeyS (down) on the wait screen', pre, mid);
      await key('KeyE');
      await h.h('stepFrames', 20);
      const post = await read();
      const wPost = await world();
      note('keydown KeyE (confirm) on the wait screen', mid, post, { frame_before: wPre.frame, frame_after: wPost.frame, mode_after: post.mode });
      push('G1 the wait screen sets hours and confirms',
        mid.focus.hours !== pre.focus.hours,
        `hours ${pre.focus.hours} -> ${mid.focus.hours}; confirm left mode='${post.mode}'`);
    }
  }

  // ---- H. THE CONTAINER — the screen that printed `undefined` ----------------------------------
  {
    await h.h('setMode', 'play-instrumented');
    // Opening a container is an ENGINE event (walking up to a crate), not a screen affordance, so
    // the open itself is a harness call — exactly as the dialogue probe opens a conversation with
    // `talkTo`. Every control ON the screen below is operated with real events.
    await h.page.evaluate(() => { window.__HARNESS.openContainer('Reed Creel', ['bog-iron-maul']); });
    await h.h('stepFrames', 4);
    const pre = await read();
    push('H0 the container screen opens and names itself',
      pre.mode === 'container' && !pre.headers.some((t) => /^(undefined|null)$/.test(String(t))),
      `mode=${pre.mode}; panel headers ${J(pre.headers)}`);

    if (pre.mode === 'container') {
      // H1 — the side switch.
      await key('KeyD');
      const mid = await read();
      note('keydown KeyD (right) in the container — side switch', pre, mid);
      push('H1 left/right switches which side of the container has focus',
        mid.focus.side !== pre.focus.side, `side ${pre.focus.side} -> ${mid.focus.side}`);

      // H2 — TRANSFER, both directions, watched in the simulation.
      const wPre = await world();
      await key('KeyE');
      await h.h('stepFrames', 10);
      const mid2 = await read();
      const wMid = await world();
      note('keydown KeyE (confirm) — take from the container', mid, mid2,
        { carried_before: wPre.carried.length, carried_after: wMid.carried.length });
      const took = wMid.carried.length !== wPre.carried.length;
      await key('KeyA');
      const mid3 = await read();
      await key('KeyE');
      await h.h('stepFrames', 10);
      const post = await read();
      const wPost = await world();
      note('keydown KeyE (confirm) — put into the container', mid3, post,
        { carried_before: wMid.carried.length, carried_after: wPost.carried.length });
      push('H2 items transfer in BOTH directions through real presses',
        took && wPost.carried.length !== wMid.carried.length,
        `carried ${wPre.carried.length} -(take)-> ${wMid.carried.length} -(put)-> ${wPost.carried.length}`);

      // H3 — the container header on a container with NO name (the round-1 defect's own case).
      await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
      await h.h('stepFrames', 2);
      const badHeaders = {};
      for (const [label, val] of [['absent', undefined], ['null', null], ['empty', ''], ['literal', 'undefined']]) {
        await h.page.evaluate((v) => { window.__HARNESS.openContainer(v, ['bog-iron-maul']); }, val);
        await h.h('stepFrames', 3);
        const rr = await read();
        badHeaders[label] = rr.headers;
        await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
        await h.h('stepFrames', 2);
      }
      report.data.container_headers = badHeaders;
      const anyBad = Object.values(badHeaders).some((hs) => hs.some((t) => /^(undefined|null)$/.test(String(t))));
      push('H3 no container name prints the literal string `undefined` or `null`',
        !anyBad, J(badHeaders));
    }
  }

  // ---- I. CLOSE ---------------------------------------------------------------------------------
  {
    await goto('inventory');
    const pre = await read();
    await key('Escape');
    const post = await read();
    note('keydown Escape (menu) from a screen', pre, post);
    push('I1 `menu` closes the screen from inside it', pre.mode !== 'world' && post.mode === 'world',
      `mode ${pre.mode} -> ${post.mode}`);
  }

  // ---- M. MOUSE. §1.2b clause 4 -------------------------------------------------------------------
  //
  // THE SCREENS DECLARE NO POINTER PATH (`ui/system.js` rule 2: "no cursor, no hover, no drag, no
  // click target"). This arm establishes what a click actually does, so the verdict states a
  // measured fact rather than repeating a comment. What matters for §1.2b is NOT whether a mouse
  // works — it is whether anything DRAWN invites one and then does nothing.
  {
    await goto('inventory');
    const pre = await read();
    const row = pre.rows.find((x) => !x.focused) || pre.rows[0];
    const rowEl = row ? pre.elements.find((e) => e.id === row.id) : null;
    if (!rowEl) {
      push('M1 clicking an inventory row does something', false, `no list_row element to click on mode '${pre.mode}'`);
    } else {
      await click(rowEl.rect[0] + rowEl.rect[2] / 2, rowEl.rect[1] + rowEl.rect[3] / 2);
      const post = await read();
      note(`click inventory row '${rowEl.text}'`, pre, post, { rect: rowEl.rect });
      push('M1 clicking an inventory row does something',
        J(pre.focus) !== J(post.focus) || pre.mode !== post.mode,
        `clicked '${rowEl.text}' at ${J(rowEl.rect)}; focus ${J(pre.focus)} -> ${J(post.focus)}, mode ${pre.mode} -> ${post.mode}`);
    }
  }

  // ---- T. TOUCH. §1.2b clause 4, with I1's trap disarmed first --------------------------------
  {
    await h.h('setViewport', { pointer: 'coarse' });
    await h.h('stepFrames', 2);
    const touchWired = await h.page.evaluate(() => {
      const t = window.__ENGINE.real.touch;
      return { enabled: !!t.enabled, attached: !!t.attached, hook: typeof t.onSurfacePointer === 'function' };
    });
    report.data.touch_instrument = touchWired;
    push('I1 INSTRUMENT the touch listeners are attached',
      touchWired.enabled && touchWired.attached,
      `touch.enabled=${touchWired.enabled}, attached=${touchWired.attached}, surface hook=${touchWired.hook}`);

    await goto('inventory');
    const pre = await read();
    const btns = pre.elements.filter((e) => /touch_button|touch_stick/.test(String(e.kind)));
    report.data.touch_buttons_arc = btns.map((x) => ({ id: x.id, kind: x.kind, rect: x.rect }));

    // `input/touch.js` T1: ten actions direct, THE REST BEHIND ONE DRAWER — and `menu`,
    // `swap_left` and `swap_right` are all in the drawer. Pass 1 of this probe looked only at the
    // arc, found no `menu`, and would have reported a false failure. Open the drawer first.
    const drawer = btns.find((x) => /__drawer/.test(String(x.id)));
    let petals = [];
    if (drawer) {
      await tap(drawer.rect[0] + drawer.rect[2] / 2, drawer.rect[1] + drawer.rect[3] / 2);
      const opened = await read();
      petals = opened.elements.filter((e) => e.kind === 'touch_button').map((x) => ({ id: x.id, rect: x.rect }));
      note('tap touch.__drawer', pre, opened, { petals: petals.map((p) => p.id) });
    }
    report.data.touch_drawer_petals = petals.map((p) => p.id);
    push('T0 the touch drawer opens and exposes the screen verbs',
      petals.some((p) => /touch\.menu$/.test(p.id)) && petals.some((p) => /swap_right/.test(p.id)),
      `arc ${J(btns.map((x) => x.id))}; after tapping the drawer: ${J(petals.map((p) => p.id))}`);

    const menuBtn = petals.find((x) => /touch\.swap_right$/.test(String(x.id)))
      || petals.find((x) => /touch\.menu$/.test(String(x.id)));
    if (!menuBtn) {
      push('T1 a touch control operates a screen', false,
        `no menu/swap_right control reachable by touch; arc ${J(btns.map((x) => x.id))}, petals ${J(petals.map((p) => p.id))}`);
    } else {
      const b1 = await read();
      await tap(menuBtn.rect[0] + menuBtn.rect[2] / 2, menuBtn.rect[1] + menuBtn.rect[3] / 2);
      const post = await read();
      note(`tap touch control '${menuBtn.id}'`, b1, post, { rect: menuBtn.rect });
      push('T1 a touch control operates a screen', b1.mode !== post.mode,
        `tapped '${menuBtn.id}' at ${J(menuBtn.rect)}; mode ${b1.mode} -> ${post.mode}`);
    }

    // T2 — the DIRECTIONAL half. The floating stick is a real drag in the left half of the frame;
    // without it a touch player can open a screen and not walk its rows.
    {
      const b2 = await read();
      await h.page.evaluate(() => {
        const cv = document.querySelector('canvas');
        const r = cv.getBoundingClientRect();
        const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
        const x0 = r.left + r.width * 0.2, y0 = r.top + r.height * 0.5;
        cv.dispatchEvent(mk('pointerdown', x0, y0));
        window.dispatchEvent(mk('pointermove', x0, y0 + 90));
      });
      await h.h('stepFrames', 8);
      const mid2 = await read();
      await h.page.evaluate(() => {
        const cv = document.querySelector('canvas');
        const r = cv.getBoundingClientRect();
        const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
        window.dispatchEvent(mk('pointerup', r.left + r.width * 0.2, r.top + r.height * 0.5 + 90));
      });
      await h.h('stepFrames', 3);
      const post2 = await read();
      note('touch drag on the left half (the floating stick)', b2, post2, { mid_focus: mid2.focus });
      push('T2 the floating stick walks the open screen\'s rows',
        J(b2.focus) !== J(post2.focus) || J(b2.focus) !== J(mid2.focus),
        `focus ${J(b2.focus)} -> (mid) ${J(mid2.focus)} -> ${J(post2.focus)} on mode '${post2.mode}'`);
    }
    await h.h('setViewport', { pointer: 'fine' });
    await h.h('stepFrames', 2);
  }

  // ---- P. GAMEPAD. §1.2b clause 4 ------------------------------------------------------------------
  {
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 3);
    const pre = await read();
    await padPress(9);            // `menu` on the default pad profile
    const post = await read();
    note('pad button 9 (menu)', pre, post);
    push('P1 the pad `menu` button opens a screen',
      pre.mode === 'world' && post.mode !== 'world',
      `mode ${pre.mode} -> ${post.mode} on pad button 9`);
    const preC = await read();
    await padPress(15);           // swap_right
    const postC = await read();
    note('pad button 15 (swap_right)', preC, postC);
    push('P2 the pad walks the screen ring',
      preC.mode !== postC.mode, `mode ${preC.mode} -> ${postC.mode} on pad button 15`);
    await h.h('setSyntheticPads', null);
  }

  report.checks = checks;
  report.data.errors = h.errors ? h.errors.slice(0, 10) : [];
  writeJson(path.join(OUT, 'screens-drive.json'), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  report.checks = checks;
  writeJson(path.join(OUT, 'screens-drive.json'), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);
