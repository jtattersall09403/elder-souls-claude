#!/usr/bin/env node
// t4-r3-critic.mjs — T4 round 3, the independent critic's own instrument.
//
// Owner: crit-t4-r3. Built none of the game code. Every interaction below is a real DOM event
// through the shipped handler (CRITIC-DOCTRINE §1.2b, RI-UIX10 §B "real events only").
//
// WHY THIS EXISTS RATHER THAN A FOURTH GENERAL PROBE. `t4-r2-critic-drive.mjs` and
// `t4-r2-critic-focus.mjs` are the round-2 critic's instruments and are re-run BYTE-IDENTICAL
// elsewhere in this pass — that is the control. What neither of them asks is the thing round 3
// actually claims to have fixed:
//
//   JX  the journal exit by EVERY ROUTE THE SCREEN ADVERTISES, not just the first one that works.
//       `focus.mjs`'s JS1 breaks at the first escaping action, and `drive.mjs`'s D6 presses back
//       ONCE on an EMPTY query. The screen's own foot hint promises two different behaviours —
//       "back to remove one" AND "back on an empty line returns to the journal" — so a query with
//       letters in it is the case the round-2 trap actually shipped in and neither probe enters.
//   EQ  RI-UIX10 O3's window is FIFTEEN FRAMES. Round 2 measured at 60 and round 3's own evidence
//       measures at 60. A control that moves at frame 40 passes both of those and fails O3.
//   IC  the in-combat commitment's narration, which the round-3 builder declares in the element
//       census and states plainly it never photographed. A meta field a probe reads and a player
//       cannot is RI-MTH07's orphan model wearing a UI hat, so this leg renders it and captures.
//   TS  touch beyond one flick: can a list actually be WALKED to a row that is not adjacent, and
//       is the missing repeat device-neutral (the builder's claim) or a touch defect (OP3's).
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('t4-r3-critic.mjs [--state ui-journal] [--out <dir>]');
const OUT = path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r3c/reports'));
const SHOTS = path.join(REPO_ROOT, String(args.shots || 'corpus/90-verdicts/wave1/artifacts/T4-r3c/screens'));
ensureDir(OUT); ensureDir(SHOTS);
const STATE = String(args.state || 'ui-journal');
// `--legs jx,eq,eqr,ic,ts,map` runs a subset. Default is everything. It exists so a later critic
// can re-measure ONE property without paying for a twenty-minute browser session, which is what
// made my own instrument corrections expensive.
const LEGS = String(args.legs || 'all').split(',').map((x) => x.trim()).filter(Boolean);
const leg = (n) => LEGS.includes('all') || LEGS.includes(n);

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };
const report = { schema: 'elder-souls/t4-r3-critic@1', at: new Date().toISOString(), state: STATE, checks: [], data: {} };
const J = (o) => JSON.stringify(o);

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
  await h.h('stepFrames', 2);
}
async function keyDown(code) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
}
async function keyUp(code) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
}
async function read() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible);
    return {
      mode: s.mode, phase: s.combat_phase, focus: s.focus ? JSON.parse(JSON.stringify(s.focus)) : null,
      frame: window.__HARNESS.getFrame(),
      rows: els.filter((e) => e.kind === 'list_row').map((e) => ({ id: e.id, text: e.text, focused: !!e.focused, meta: e.meta || null })),
      detail: els.filter((e) => e.kind === 'detail_panel').map((e) => ({ text: e.text, meta: e.meta || null })),
      doll_children: els.filter((e) => String(e.id).startsWith('inventory.worn.')).map((e) => e.id),
      hints: els.filter((e) => String(e.id).endsWith('.hint')).map((e) => String(e.text)),
      texts: els.filter((e) => e.text != null).map((e) => String(e.text)),
    };
  });
}
async function inv() {
  return h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const a = Array.isArray(eng.sim.inventory) ? eng.sim.inventory : [];
    return { n: a.length, equipped: a.filter((r) => r.slot).map((r) => `${r.id}@${r.slot}`), frame: window.__HARNESS.getFrame() };
  });
}
/** A screen-state fingerprint: everything the PLAYER could see change on the screen. */
const face = (r) => J({ rows: r.rows.map((x) => [x.text, x.focused, x.meta && x.meta.equipping]), detail: r.detail, doll: r.doll_children, hints: r.hints });
async function goto(target) {
  for (let i = 0; i < 3; i++) { const r = await read(); if (r.mode !== 'world') break; await key('KeyM'); }
  for (let i = 0; i < 14; i++) {
    const r = await read();
    if (r.mode === target) return target;
    if (r.mode === 'world') await key('KeyM'); else await key('Digit3');
  }
  return (await read()).mode;
}
/**
 * Put the item list back at its first row THROUGH REAL PRESSES.
 *
 * My second full run measured TS1/TS2/TS4/TS5 at `rowIdx 43` — the LAST row of a 44-item carried
 * list, left there by the equip legs — where a downward drag correctly cannot move and the probe
 * reports a dead stick on a build whose stick works. That is the same class of instrument defect
 * `RI-UIX10` §B exists to stop, arriving from the probe's own history rather than from a trap, and
 * it is why the touch legs are re-run in isolation with `--legs ts,map`.
 */
async function toTopOfList(maxPresses = 60) {
  for (let i = 0; i < maxPresses; i++) {
    const r = await read();
    if (!r.focus || r.focus.rowIdx === undefined || r.focus.rowIdx === 0) return r.focus ? r.focus.rowIdx : null;
    await key('KeyW', 1);
  }
  return (await read()).focus.rowIdx;
}
async function toWorld() {
  for (let i = 0; i < 8; i++) { const r = await read(); if (r.mode === 'world') return; await key('Escape'); }
}
/** Enter the journal's search view, optionally typing `n` characters through the ring. */
async function enterSearch(nChars = 0) {
  await goto('journal');
  for (let i = 0; i < 8; i++) { const r = await read(); if (jv(r) && jv(r).view === 'chronicle') break; await key('KeyA', 1); }
  let r = await read();
  if (!(jv(r) && jv(r).view === 'search')) await key('KeyE');
  for (let i = 0; i < nChars; i++) { await key('KeyD', 1); await key('KeyE', 1); }
  return read();
}
// `getUIState().focus` is `this.focus[this.mode]` (ui/system.js:2057) — the ACTIVE screen's
// focus record, flat. So the journal's view/query live at `focus.view` / `focus.query`, and only
// when `mode === 'journal'`. Reading `focus.journal` returns undefined and silently voids a check.
const jv = (r) => (r.mode === 'journal' && r.focus ? r.focus : null);

try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);
  const i0 = await h.page.evaluate(async () => {
    const eng = window.__ENGINE;
    const attached = !!(eng.real && eng.real.attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const mx = eng.sim && eng.sim.input ? eng.sim.input.moveX : null;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    return { attached, moveX: mx };
  });
  await h.h('stepFrames', 2);
  push('I0 INSTRUMENT real listeners attached and a movement key reaches the pipeline',
    i0.attached && i0.moveX !== 0 && i0.moveX !== null, `real.attached=${i0.attached}, input.moveX=${i0.moveX}`);
  if (!i0.attached) throw new Error('I0 failed — every result below would be void');
  report.data.i0 = i0;

  // ============================================================================================
  // JX — THE JOURNAL EXIT, BY EVERY ROUTE THE SCREEN ADVERTISES
  // ============================================================================================
  if (leg('jx')) {
    // -- JX0. the trap's own door still opens (the fix must not have removed the feature) ------
    let r = await enterSearch(0);
    push('JX0 confirm on the chronicle still enters the search view',
      jv(r) && jv(r).view === 'search', `view='${jv(r) && jv(r).view}', query='${jv(r) && jv(r).query}'`);

    // -- JX1. the FULL closed-set enumeration on an EMPTY query, nothing skipped ---------------
    const ACTIONS = [
      ['Space', 'roll (back)'], ['KeyF', 'block'], ['KeyV', 'parry'], ['KeyR', 'heavy'],
      ['ShiftLeft', 'sprint'], ['KeyX', 'jump'], ['Digit1', 'use_item'], ['Tab', 'lock_on'],
      ['KeyG', 'two_hand'], ['KeyC', 'crouch'], ['KeyT', 'spell_cycle'],
      ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'],
    ];
    const tried = [];
    for (const [code, name] of ACTIONS) {
      let cur = await read();
      if (cur.mode !== 'journal' || !jv(cur) || jv(cur).view !== 'search') { await toWorld(); cur = await enterSearch(0); }
      await key(code, 14);
      const after = await read();
      tried.push({
        action: name, code, mode_after: after.mode,
        view_after: jv(after) ? jv(after).view : null, query_after: jv(after) ? jv(after).query : null,
        leaves_search_stays_in_journal: after.mode === 'journal' && jv(after) && jv(after).view !== 'search',
      });
    }
    const escapers = tried.filter((t) => t.leaves_search_stays_in_journal);
    report.data.journal_exit_enumeration = tried;
    push('JX1 at least one action in the closed set returns the journal from search to the chronicle',
      escapers.length > 0,
      `${escapers.length} of ${tried.length} escape: ${J(escapers.map((e) => `${e.action}->${e.view_after}`))}`);

    // -- JX2. THE ADVERTISED ROUTE, on a query with letters in it ------------------------------
    // The foot hint promises TWO behaviours. Both are tested, in the order a player meets them.
    await toWorld();
    r = await enterSearch(3);
    const q0 = jv(r) ? jv(r).query : null;
    const walk = [{ press: 0, view: jv(r) && jv(r).view, query: q0, mode: r.mode }];
    for (let i = 1; i <= 5; i++) {
      await key('Space', 4);
      const a = await read();
      walk.push({ press: i, view: a.mode === 'journal' && jv(a) ? jv(a).view : null, query: a.mode === 'journal' && jv(a) ? jv(a).query : null, mode: a.mode });
      if (a.mode !== 'journal') break;
    }
    report.data.journal_back_walk = { typed: q0, walk };
    const shrank = q0 && q0.length >= 2
      && walk[1] && walk[1].query !== null && walk[1].query.length === q0.length - 1
      && walk[2] && walk[2].query !== null && walk[2].query.length === q0.length - 2;
    push('JX2a back removes exactly one letter per press, as the foot hint promises',
      shrank, `typed '${q0}' then back x5: ${J(walk.map((w) => `${w.mode}/${w.view}/'${w.query}'`))}`);
    const emptyThenChronicle = walk.find((w) => w.query === '' && w.view === 'search');
    const chronicleStep = walk.find((w) => w.view === 'chronicle' && w.mode === 'journal');
    push('JX2b back on an EMPTY line returns to the chronicle and stays in the journal',
      !!chronicleStep && !!emptyThenChronicle && chronicleStep.press > emptyThenChronicle.press,
      `empty-line press ${emptyThenChronicle ? emptyThenChronicle.press : 'none'}; chronicle at press ${chronicleStep ? chronicleStep.press : 'none'}`);
    const leftScreen = walk.find((w) => w.mode !== 'journal');
    push('JX2c a further back then leaves the journal — the top-level exit is not lost',
      !!leftScreen, leftScreen ? `press ${leftScreen.press} -> mode '${leftScreen.mode}'` : 'never left the journal in 5 presses');

    // -- JX3. OP6, persistence across a close and a re-open, WITH A QUERY ----------------------
    await toWorld();
    r = await enterSearch(2);
    const beforeClose = jv(r);
    await key('KeyM');                      // `menu` closes the screen from inside it
    const closed = await read();
    await goto('journal');
    const reopened = await read();
    report.data.journal_reopen = { before: beforeClose, closed_mode: closed.mode, after: jv(reopened) };
    push('JX3 the search view does not survive a close and a re-open (OP6)',
      jv(reopened) && jv(reopened).view === 'chronicle' && jv(reopened).query === '',
      `entered search with query '${beforeClose && beforeClose.query}', closed to '${closed.mode}', re-opened: view='${jv(reopened) && jv(reopened).view}' query='${jv(reopened) && jv(reopened).query}'`);

    // -- JX4. the peer walk, which is how the round-2 critic found the trap was permanent ------
    await toWorld();
    r = await enterSearch(2);
    const beforeWalk = jv(r);
    // swap_right to the next peer, then swap_left STRAIGHT BACK. Walking the ring forward passes
    // through `world`, which is a close-and-re-open (JX3 above) rather than the peer walk the
    // round-2 critic used to show the trap was permanent, so the return leg has to be swap_left.
    await key('Digit3');                    // swap_right: journal -> next peer
    const peer = await read();
    let back = peer;
    for (let i = 0; i < 4; i++) { if (back.mode === 'journal') break; await key('Digit4'); back = await read(); }
    report.data.journal_peer_walk = { before: beforeWalk, peer_mode: peer.mode, after: jv(back) };
    push('JX4 walking to a peer screen and back returns the chronicle, not the search box',
      back.mode === 'journal' && jv(back) && jv(back).view === 'chronicle' && jv(back).query === '',
      `search(query='${beforeWalk && beforeWalk.query}') -> '${peer.mode}' -> back to '${back.mode}': view='${jv(back) && jv(back).view}' query='${jv(back) && jv(back).query}'`);

    // -- JX5. THE OTHER SUB-VIEW. OP5 is "every state", not "the state that was reported." -----
    await toWorld();
    await goto('journal');
    let idx = await read();
    // `t4-r2-critic-drive.mjs` D2's route, followed exactly rather than guessed: LEFT at page 0
    // opens the quest index. So walk back to page 0 first, then press left once more.
    for (let i = 0; i < 8; i++) { if (jv(idx) && jv(idx).page === 0) break; await key('KeyA'); idx = await read(); }
    if (jv(idx) && jv(idx).view !== 'index') { await key('KeyA'); idx = await read(); }
    if (jv(idx) && jv(idx).view === 'index') {
      await key('Space', 4);
      const out = await read();
      report.data.journal_index_exit = { entered: 'index', after_back: { mode: out.mode, view: jv(out) && jv(out).view } };
      push('JX5 the quest-index sub-view also has an exit that stays in the journal',
        out.mode === 'journal' && jv(out) && jv(out).view === 'chronicle',
        `index -(back)-> mode='${out.mode}' view='${jv(out) && jv(out).view}'`);
    } else {
      report.data.journal_index_exit = { entered: null, note: 'index view not reachable by walking the view ring in 16 presses' };
      push('JX5 the quest-index sub-view also has an exit that stays in the journal', false,
        `could not enter the index view to test it; view stayed '${jv(idx) && jv(idx).view}'`);
    }

    // -- JX6. the regression the fix could plausibly have caused ------------------------------
    await toWorld();
    await goto('journal');
    let ch = await read();
    for (let i = 0; i < 6; i++) { if (jv(ch) && jv(ch).view === 'chronicle') break; await key('KeyA', 1); ch = await read(); }
    await key('Space', 4);
    const outFromChronicle = await read();
    report.data.journal_top_level_back = { before: jv(ch), after_mode: outFromChronicle.mode };
    push('JX6 back on the chronicle still LEAVES the journal (backOrSub did not swallow the exit)',
      outFromChronicle.mode !== 'journal',
      `chronicle -(back)-> mode='${outFromChronicle.mode}'`);
    await toWorld();
  }

  // ============================================================================================
  // EQ — RI-UIX10 O3's ACTUAL WINDOW: FIFTEEN FRAMES, NOT SIXTY
  // ============================================================================================
  if (leg('eq')) {
    await toWorld();
    await goto('inventory');
    let target = null;
    for (let i = 0; i < 45; i++) {
      const r = await read();
      const f = r.rows.find((x) => x.focused);
      if (f && /bog-iron|maul|bow|blade|knife|axe/i.test(String(f.text)) && !/reed.cutter/i.test(String(f.text))) { target = f; break; }
      await key('KeyS', 1);
    }
    if (!target) push('EQ1 O3 — a weapon row can be focused', false, 'no weapon row reachable by walking the list');
    else {
      const b = await read(); const wb = await inv();
      // press, then look at f+1 and f+15 — O3's window is 15 frames (250 ms at 60 Hz)
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'KeyE', bubbles: true, cancelable: true })));
      await h.h('stepFrames', 1);
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'KeyE', bubbles: true })));
      const f1 = await read(); const w1 = await inv();
      await h.h('stepFrames', 14);
      const f15 = await read(); const w15 = await inv();
      const moved1 = face(b) !== face(f1) || J(wb.equipped) !== J(w1.equipped);
      const moved15 = face(b) !== face(f15) || J(wb.equipped) !== J(w15.equipped);
      report.data.equip_out_of_combat = {
        row: target.text, before: { equipped: wb.equipped, frame: wb.frame },
        at_f1: { equipped: w1.equipped, frame: w1.frame, screen_moved: moved1 },
        at_f15: { equipped: w15.equipped, frame: w15.frame, screen_moved: moved15 },
        doll_before: b.doll_children, doll_after: f15.doll_children,
      };
      push('EQ1 (RI-UIX10 O3) confirm on a weapon row out of combat changes something WITHIN 15 FRAMES',
        moved15,
        `row '${target.text}': equipment ${J(wb.equipped)} -> f+1 ${J(w1.equipped)} -> f+15 ${J(w15.equipped)}; ` +
        `frame ${wb.frame} -> ${w15.frame} (paused, as RI-UIX03 P1 requires); doll ${J(b.doll_children)} -> ${J(f15.doll_children)}; ` +
        `screen moved by f+1=${moved1}, by f+15=${moved15}`);
      push('EQ1b the change is on the FIRST frame, not merely inside the window',
        moved1, `screen/equipment moved at f+1: ${moved1}`);
    }
  }

  // ---- EQ-R. THE REFUSED ROW. `t4-r2-critic-drive.mjs` C5 lands on `hist-sap-bow` and reports
  // the equipment unchanged at BOTH rounds. Engine._finishEquipCommit() refuses it by policy
  // (`_loadoutForItem` has no patch for its moveset) and W1-16 r4 built `uiToast` so the refusal
  // is said. O3 asks whether the PLAYER can see the press land, so the toast is the whole
  // question, and it must be visible WITH THE SCREEN OPEN.
  if (leg('eqr')) {
    await toWorld();
    await goto('inventory');
    // BY ITEM ID, NOT BY NAME. My first pass matched /bow/i and landed on a "Mud-slip bowl", and
    // the check then passed on a toast left over from the PREVIOUS leg's successful equip. Both
    // halves of that are recorded in my status file: the row is now identified by
    // `meta.item_id === 'hist-sap-bow'` (the row `drive.mjs` C5 lands on at both rounds) and the
    // toast channel is cleared immediately before the press so that a stale line cannot pass it.
    let bow = null;
    for (let i = 0; i < 45; i++) {
      const r = await read();
      const f = r.rows.find((x) => x.focused);
      if (f && f.meta && f.meta.item_id === 'hist-sap-bow') { bow = f; break; }
      await key('KeyS', 1);
    }
    if (!bow) push('EQ2 the refused weapon row says something to the player', false, 'the `hist-sap-bow` row was not reachable by walking the list in 45 presses');
    else {
      await h.page.evaluate(() => { window.__ENGINE.uiToast(null); });
      await h.h('stepFrames', 2);
      const b = await read(); const wb = await inv();
      const hudBefore = await h.page.evaluate(() => (window.__HARNESS.getUIState().elements || [])
        .filter((e) => e.visible && /toast/i.test(String(e.id))).map((e) => ({ id: e.id, text: e.text })));
      await key('KeyE', 2);
      await h.h('stepFrames', 13);
      const a = await read(); const wa = await inv();
      const hudAfter = await h.page.evaluate(() => (window.__HARNESS.getUIState().elements || [])
        .filter((e) => e.visible && /toast/i.test(String(e.id))).map((e) => ({ id: e.id, text: e.text })));
      report.data.equip_refused = {
        row: bow.text, equipped_before: wb.equipped, equipped_after: wa.equipped,
        toast_before: hudBefore, toast_after: hudAfter, screen_moved: face(b) !== face(a),
      };
      push('EQ2 (O3) confirm on a row the game REFUSES still shows the player something within 15 frames',
        hudAfter.length > 0 || face(b) !== face(a),
        `row '${bow.text}': equipment ${J(wb.equipped)} -> ${J(wa.equipped)} (refused by policy); ` +
        `toast elements before ${J(hudBefore)} after ${J(hudAfter)}; screen moved=${face(b) !== face(a)}`);
    }
  }

  // ============================================================================================
  // IC — THE IN-COMBAT COMMITMENT, ITS NARRATION, AND THE REGRESSION IT COULD HAVE CAUSED
  // ============================================================================================
  if (leg('ic')) {
    await toWorld();
    const spawned = await h.page.evaluate(() => {
      const A = window.__HARNESS;
      const p = A.getPlayerStats ? A.getPlayerStats() : null;
      let eid = null;
      try { eid = A.spawn('inf_trash', (p && p.x || 0) + 4.6, (p && p.z || 0)); } catch (e) { return { error: String(e.message || e) }; }
      const id = eid && eid.eid !== undefined ? eid.eid : eid;
      let ag = null; try { ag = A.aggro(id); } catch (e) { ag = String(e.message || e); }
      return { eid: id, aggro: ag };
    });
    await h.h('stepFrames', 4);
    const fighting = await h.page.evaluate(() => !!(window.__ENGINE.inCombat && window.__ENGINE.inCombat()));
    report.data.ic_spawn = { ...spawned, in_combat: fighting };
    push('IC0 GATE a fight is actually running', fighting, `spawn ${J(spawned)}, inCombat=${fighting}`);
    if (fighting) {
      await goto('inventory');
      // BY ITEM ID. A name regex walked off the end of the list and pressed confirm on a
      // `misc` bowl, which `_confirm()` queues NOTHING for — so the leg measured a press the UI
      // never accepted and reported it as a dead commitment. Recorded in my status file.
      // `reed-cutter` is the blade EQ1 displaced out of the right hand, so it is carried,
      // unequipped and known-equippable on this fixture.
      const WANT = ['reed-cutter', 'chitin-cuirass', 'bog-iron-maul'];
      let target = null;
      for (let i = 0; i < 60 && !target; i++) {
        const r = await read();
        const f = r.rows.find((x) => x.focused);
        if (f && f.meta && WANT.includes(f.meta.item_id)) { target = f; break; }
        await key('KeyS', 1);
      }
      if (!target) { push('IC1 (O3) the in-combat commitment is NARRATED on the screen while it runs', false, `no row in ${J(WANT)} could be focused by walking the list`); }
      else {
      const b = await read(); const wb = await inv();
      await key('KeyE', 2);
      await h.h('stepFrames', 8);            // inside O3's 15-frame window, inside the 30-frame commit
      const mid = await read(); const wm = await inv();
      const epRow = mid.rows.find((x) => x.meta && x.meta.equipping);
      const epDetail = mid.detail.find((d) => d.meta && d.meta.equipping);
      const hintSays = mid.hints.some((t) => /putting on/i.test(t));
      const detailSays = mid.texts.some((t) => /putting it on/i.test(String(t)));
      await h.page.screenshot({ path: path.join(SHOTS, 'ic-equip-mid-commitment__1920x1080.png'), timeout: 180000 });
      await h.h('stepFrames', 40);
      const done = await read(); const wd = await inv();
      report.data.ic_equip = {
        row: target ? target.text : null,
        before: wb.equipped, mid: wm.equipped, after: wd.equipped,
        frames: [wb.frame, wm.frame, wd.frame],
        mid_row_equipping: epRow ? { id: epRow.id, remaining: epRow.meta.equip_remaining_f } : null,
        mid_detail_equipping: epDetail ? epDetail.meta : null,
        hint_texts: mid.hints, hint_says_putting_on: hintSays, detail_says_putting_it_on: detailSays,
      };
      push('IC1 (O3) the in-combat commitment is NARRATED on the screen while it runs',
        !!(epRow || epDetail) && (hintSays || detailSays),
        `row.meta.equipping=${!!epRow}, detail.meta.equipping=${!!epDetail}, hint says "putting on"=${hintSays}, ` +
        `detail text says "putting it on"=${detailSays}; hints=${J(mid.hints)}`);
      push('IC2 (RI-UIX03 P7 regression) the in-combat swap still takes real frames and then lands',
        wm.frame > wb.frame && J(wd.equipped) !== J(wb.equipped) && J(wm.equipped) === J(wb.equipped),
        `equipment ${J(wb.equipped)} -(press, +8f)-> ${J(wm.equipped)} -(+40f)-> ${J(wd.equipped)}; ` +
        `frames ${wb.frame} -> ${wm.frame} -> ${wd.frame} (the world runs in a fight: RI-UIX03 M-P2)`);
      }
      await toWorld();
    }
  }

  // ============================================================================================
  // TS — TOUCH, BEYOND ONE FLICK
  // ============================================================================================
  if (leg('ts')) {
    await h.h('setViewport', { pointer: 'coarse' });
    await h.h('stepFrames', 2);
    const i1 = await h.page.evaluate(() => {
      const eng = window.__ENGINE;
      return { touch_attached: !!(eng.real && eng.real.touch && eng.real.touch.attached), enabled: !!(eng.real && eng.real.touch && eng.real.touch.enabled) };
    });
    push('I1 INSTRUMENT the touch listeners are attached on device class handheld',
      i1.touch_attached, `real.touch.attached=${i1.touch_attached}, enabled=${i1.enabled}`);
    report.data.i1 = i1;

    await toWorld();
    await goto('inventory');
    const top = await toTopOfList();
    push('TS0 INSTRUMENT the list is at its first row before the stick is measured', top === 0,
      `focus.rowIdx=${top} (a drag DOWN cannot move a focus already on the last row, and reporting that as a dead stick is a probe defect, not a build defect)`);
    const drag = async (dx, dy, holdSteps) => h.page.evaluate(async ([ddx, ddy, hs]) => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      const x0 = r.left + r.width * 0.18, y0 = r.top + r.height * 0.55;
      cv.dispatchEvent(mk('pointerdown', x0, y0));
      window.dispatchEvent(mk('pointermove', x0 + ddx, y0 + ddy));
      return { x0, y0, hs };
    }, [dx, dy, holdSteps]);
    const release = async (dx, dy) => h.page.evaluate(async ([ddx, ddy]) => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      window.dispatchEvent(mk('pointerup', r.left + r.width * 0.18 + ddx, r.top + r.height * 0.55 + ddy));
    }, [dx, dy]);

    // TS1 — one flick
    const b = await read();
    await drag(0, 120, 12); await h.h('stepFrames', 12);
    const m1 = await read();
    await release(0, 120); await h.h('stepFrames', 3);
    report.data.touch_one_flick = { before: b.focus, after: m1.focus };
    push('TS1 (OP3) the floating touch stick walks an open screen\'s list',
      J(b.focus) !== J(m1.focus), `focus ${J(b.focus)} -(drag down 120 px)-> ${J(m1.focus)} on mode '${m1.mode}'`);

    // TS2 — can a NON-ADJACENT row be reached? three separate flicks.
    const s0 = (await read()).focus.rowIdx;
    for (let i = 0; i < 3; i++) { await drag(0, 120, 8); await h.h('stepFrames', 8); await release(0, 120); await h.h('stepFrames', 3); }
    const s3 = (await read()).focus.rowIdx;
    report.data.touch_three_flicks = { from: s0, to: s3 };
    push('TS2 (OP3, §C "the directional half") three flicks reach a row three away',
      s3 - s0 === 3, `rowIdx ${s0} -(3 separate flicks)-> ${s3}`);

    // TS3 — the horizontal half: does a sideways drag move the column?
    const c0 = (await read()).focus;
    await drag(-140, 0, 10); await h.h('stepFrames', 10);
    const c1 = (await read()).focus;
    await release(-140, 0); await h.h('stepFrames', 3);
    report.data.touch_horizontal = { before: c0, after: c1 };
    push('TS3 (OP3) a sideways touch drag moves between the screen\'s columns',
      c0.col !== c1.col, `focus.col ${c0.col} -(drag left 140 px)-> ${c1.col}`);

    // TS4 / TS5 — the missing repeat. Is it a TOUCH defect (OP3) or device-neutral?
    // TS3 left the focus on COLUMN 0 (the categories), where a vertical move walks `tagIdx` and
    // not `rowIdx`. My first pass did not put it back and read `rowIdx` unchanged on both arms,
    // which is a probe artefact and not a repeat measurement. Back to the item column first.
    await key('KeyD'); await h.h('stepFrames', 2);
    const colNow = (await read()).focus.col;
    push('TS3b the item column is back in focus before the repeat measurement', colNow === 1, `focus.col=${colNow}`);
    const h0 = (await read()).focus.rowIdx;
    await drag(0, 120, 40); await h.h('stepFrames', 40);
    const h1 = (await read()).focus.rowIdx;
    await release(0, 120); await h.h('stepFrames', 3);
    const k0 = (await read()).focus.rowIdx;
    await keyDown('KeyS'); await h.h('stepFrames', 40); await keyUp('KeyS'); await h.h('stepFrames', 2);
    const k1 = (await read()).focus.rowIdx;
    report.data.repeat = { touch_hold_40f: [h0, h1], keyboard_hold_40f: [k0, k1] };
    push('TS4 DIAGNOSTIC a 40-frame HELD touch drag moves more than one row (axis repeat)',
      h1 - h0 > 1, `rowIdx ${h0} -(one 40-frame held drag)-> ${h1}`);
    push('TS5 DIAGNOSTIC a 40-frame HELD keyboard direction moves more than one row',
      k1 - k0 > 1, `rowIdx ${k0} -(one 40-frame held KeyS)-> ${k1}  << compare with TS4: if both are 1, the missing repeat is device-neutral, not a touch defect`);

    await h.h('setViewport', { pointer: 'fine' });
    await h.h('stepFrames', 2);
  }

  // ============================================================================================
  // MAP — settling `t4-r2-critic-drive.mjs` F1, which fails at BOTH rounds identically.
  // F1 is a compound check: "the map screen walks its places AND swaps its view". The view swaps;
  // `placeIdx` does not move. RI-UIX10 OP1's hard fail is "a drawn affordance with no input that
  // works it", and a one-row list is not a dead control — so the question is a COUNT, and the
  // screen prints the answer itself ("One place I have stood in." vs "Places I have stood in.").
  // Read from the rendered census rather than from the discovery data, so it is output.
  // ============================================================================================
  if (leg('map')) {
    await toWorld();
    const m = await goto('map');
    const st = await read();
    const places = st.texts.filter((t) => /place[s]? I have stood in|I have not stood/i.test(String(t)));
    const rows = st.rows.length;
    const b = await read();
    await key('KeyS'); const d1 = await read();
    await key('KeyW'); const d2 = await read();
    report.data.map = { mode: m, foot: places, list_rows: rows, focus_before: b.focus, after_down: d1.focus, after_up: d2.focus, texts: st.texts };
    const single = places.some((t) => /^One place/i.test(String(t)));
    push('MAP1 the map\'s place list has more than one row to walk',
      rows > 1 && !single,
      `mode='${m}'; the screen's own foot line ${J(places)}; list_row elements ${rows}; ` +
      `placeIdx ${J(b.focus)} -(down)-> ${J(d1.focus)} -(up)-> ${J(d2.focus)}`);
  }

  report.checks = checks;
  report.data.errors = h.errors ? h.errors.slice(0, 8) : [];
  writeJson(path.join(OUT, 't4-r3-critic.json'), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
  log(`page errors: ${J(report.data.errors)}`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  report.checks = checks;
  writeJson(path.join(OUT, 't4-r3-critic.json'), report);
  exit = 2;
} finally {
  await h.close();
}
void fs;
process.exit(exit);
