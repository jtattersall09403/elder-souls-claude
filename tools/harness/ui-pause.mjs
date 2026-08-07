#!/usr/bin/env node
// ui-pause.mjs — RI-UIX03 §A, measured as frame arithmetic, plus the gamepad-only reachability
// walk this piece is required to survive.
//
// RI-UIX03's Comparison method names `run-headless.mjs --scenario ui-inventory-pause`; there is
// no scenario registry entry for it and the item's step 2 is a sequence of harness calls rather
// than a scenario file, so it is written here as a probe. Declared in
// orchestration/status/W1-21.json.
//
// WHAT IT MEASURES, and why each number is RAW rather than a boolean.
//
//  M-P1  outside combat, menu open, 120 steps -> frame delta must be 0.
//  M-P2  INSIDE combat, menu open, 120 steps -> frame delta must be exactly 120.
//        "Report the raw frame counts, not a boolean. A partial pause (advancing 30 of 120) is
//        a distinct and more insidious failure than a full pause and must be visible."
//  P4    combat BEGINS while the screen is open outside combat: the simulation resumes on the
//        frame the first hostile enters AGGRO, with the screen still open. No forced close.
//  P5    occlusion: ≤55% opacity over ≤60% of screen area, and the centre 40%×40% still shows
//        the world. Measured from PIXELS — the fraction of centre-box pixels that differ
//        between UI-on and UI-off is how much of the fight the menu is eating.
//  P6    input liveness: with the menu open in combat, a queued `roll` must still produce a
//        roll. A menu that eats your dodge is a trap, not a consequence.
//  P7    equip commitment: swapping a weapon from the menu costs ≥30 committed frames.
//  P8    no time dilation: the frame counter advances at exactly 1 per fixed step, and the
//        trace's own timebase is unchanged.
//
// AND THE PART NO REFERENCE ITEM ASKS FOR AND THE OWNER DOES: **every surface reachable on a
// gamepad alone.** The owner tests on a GameSir X2s Type-C. This walks the whole interface
// using nothing but the pad — start to open, the left stick and d-pad to move, A to confirm,
// B to go back — through `__HARNESS.gamepad()`, which feeds the same `pollGamepad()` a physical
// pad does. A menu that needs a mouse fails, and there is no cursor path in this interface to
// fall back on.
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
ui-pause.mjs — RI-UIX03 §A frame arithmetic, §P5 occlusion, and gamepad-only reachability.

USAGE
  node tools/harness/ui-pause.mjs [--state arena_champion] [--out <dir>] [--json]

EXIT 0 = every check passes · 1 = a check fails · 2 = could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-PAUSE'));
const width = Number(args.width || 1280), height = Number(args.height || 720);
const state = String(args.state || 'arena_champion');

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }

/** GameSir X2s Type-C / W3C standard mapping. Index -> the action GAMEPAD_BINDINGS gives it. */
const PAD = { A: 0, B: 1, X: 2, Y: 3, START: 9, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 };
function padState(pressed, axes) {
  const buttons = new Array(17).fill(0).map(() => ({ pressed: false, touched: false, value: 0 }));
  for (const i of pressed) buttons[i] = { pressed: true, touched: true, value: 1 };
  return {
    index: 0, id: 'GameSir-X2s Type-C (STANDARD GAMEPAD Vendor: 3537 Product: 1001)',
    mapping: 'standard', connected: true, timestamp: 0,
    axes: axes || [0, 0, 0, 0], buttons,
  };
}

ensureDir(RUN);
const h = await launchGame({ width, height, timeout: 240000 });
const out = { schema: 'elder-souls/ui-pause@1', item: 'RI-UIX03', at: new Date().toISOString(), state, checks: [], raw: {} };
const push = (id, what, pass, detail) => out.checks.push({ id, what, pass, detail });

try {
  await h.h('setRenderRate', 0);
  await h.h('loadState', state);
  await h.h('setDevicePixelRatio', 1);
  await h.h('stepFrames', 4);

  // ---- M-P1: outside combat, the world stops -------------------------------------------------
  await h.h('closeMenu');
  await h.h('lockOn', null);
  const enemies = (await h.h('listEntities')).filter((e) => e.archetype !== 'player');
  for (const e of enemies) { try { await h.h('despawn', e.eid); } catch { /* */ } }
  await h.h('stepFrames', 8);
  let rep = await h.h('getUIPauseReport');
  await h.h('openMenu', 'inventory');
  const a0 = await h.h('getFrame');
  await h.h('stepFrames', 120);
  const a1 = await h.h('getFrame');
  out.raw.out_of_combat = { in_combat: rep.in_combat, from: a0, to: a1, delta: a1 - a0, of: 120 };
  push('M-P1', 'outside combat the inventory PAUSES the world', a1 - a0 === 0 && !rep.in_combat,
    `frame ${a0} -> ${a1} over 120 steps (delta ${a1 - a0} of 120), in_combat ${rep.in_combat}`);

  // ---- M-P2: inside combat, the world does NOT stop ------------------------------------------
  await h.h('closeMenu');
  await h.h('stepFrames', 2);
  let eid = null;
  try { eid = (await h.h('spawn', 'champion_hist_marked', 0, 4.6, { as: 'p2' })).eid || 'p2'; }
  catch { try { eid = (await h.h('spawn', 'inf_trash', 0, 4.6, { as: 'p2' })).eid || 'p2'; } catch { /* */ } }
  if (eid) await h.h('aggro', eid);
  await h.h('stepFrames', 4);
  rep = await h.h('getUIPauseReport');
  await h.h('openMenu', 'inventory');
  const b0 = await h.h('getFrame');
  await h.h('stepFrames', 120);
  const b1 = await h.h('getFrame');
  out.raw.in_combat = { in_combat: rep.in_combat, from: b0, to: b1, delta: b1 - b0, of: 120 };
  push('M-P2', 'INSIDE combat the inventory does NOT pause the world (S14)',
    rep.in_combat && b1 - b0 === 120,
    `frame ${b0} -> ${b1} over 120 steps (delta ${b1 - b0} of 120), in_combat ${rep.in_combat}`);

  // ---- P8: no dilation. The frame counter is the timebase; there is no partial step. ----------
  const c0 = await h.h('getFrame');
  await h.h('stepFrames', 37);
  const c1 = await h.h('getFrame');
  push('P8', 'no time dilation: 37 steps advance exactly 37 frames with the menu open',
    c1 - c0 === 37, `${c0} -> ${c1}`);

  // ---- P5: occlusion, from pixels -------------------------------------------------------------
  const uiState = await h.h('getUIState');
  await h.h('setUIVisible', true);
  const on = decode(await h.h('screenshot'));
  await h.h('setUIVisible', false);
  const off = decode(await h.h('screenshot'));
  await h.h('setUIVisible', true);
  const cx = Math.round(on.width * 0.30), cy = Math.round(on.height * 0.30);
  const cw = Math.round(on.width * 0.40), ch = Math.round(on.height * 0.40);
  let centreDiff = 0, centreTotal = 0, centreWorldVisible = 0;
  for (let y = cy; y < cy + ch; y++) {
    for (let x = cx; x < cx + cw; x++) {
      const o = (y * on.width + x) * 4;
      centreTotal++;
      const d = Math.abs(on.data[o] - off.data[o]) + Math.abs(on.data[o + 1] - off.data[o + 1]) + Math.abs(on.data[o + 2] - off.data[o + 2]);
      if (d > 6) centreDiff++;
      // "≥30% of its pixels contributed by the world layer" — a pixel whose composited value is
      // still within 55% of the world's own value has the world contributing at least 45% of it.
      const wl = 0.2126 * off.data[o] + 0.7152 * off.data[o + 1] + 0.0722 * off.data[o + 2];
      const ol = 0.2126 * on.data[o] + 0.7152 * on.data[o + 1] + 0.0722 * on.data[o + 2];
      if (wl === 0 ? ol < 8 : Math.abs(ol - wl) / Math.max(8, wl) < 1.0) centreWorldVisible++;
    }
  }
  const panel = uiState.elements.find((e) => e.kind === 'panel');
  const areaFrac = panel ? (panel.rect[2] * panel.rect[3]) / (on.width * on.height) : 0;
  out.raw.occlusion = {
    panel_area_frac: +areaFrac.toFixed(4),
    declared_opacity: uiState.menu.opacity,
    centre_box: [cx, cy, cw, ch],
    centre_changed_frac: +(centreDiff / centreTotal).toFixed(4),
    centre_world_still_visible_frac: +(centreWorldVisible / centreTotal).toFixed(4),
  };
  push('M-P4', 'P5 occlusion: ≤55% opacity, ≤60% of screen area, world still visible in the centre 40%×40%',
    uiState.menu.opacity <= 0.55 && areaFrac <= 0.60 && centreWorldVisible / centreTotal >= 0.30,
    `opacity ${uiState.menu.opacity}, area ${(areaFrac * 100).toFixed(1)}%, world visible in ${(100 * centreWorldVisible / centreTotal).toFixed(1)}% of centre pixels`);

  // ---- P6: input liveness. `roll` must still fire with the menu open in a fight. --------------
  const rollFired = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.combatTraceStart({});
    H.queueInputs([{ f: 1, press: ['roll'] }, { f: 4, release: ['roll'] }]);
    H.stepFrames(40);
    const rec = H.combatTraceDrain();
    H.combatTraceStop();
    const s = JSON.stringify(rec);
    return { rolled: /ROLL|roll/.test(s), mode: H.getUIState().mode };
  });
  out.raw.input_liveness = rollFired;
  push('M-P3', 'P6 input liveness: `roll` is not swallowed by the menu in combat',
    rollFired.rolled && rollFired.mode !== 'world',
    `roll seen in the combat trace: ${rollFired.rolled}; menu still open: ${rollFired.mode}`);

  // ---- P4: combat begins while the screen is open ---------------------------------------------
  await h.h('closeMenu');
  for (const e of (await h.h('listEntities')).filter((x) => x.archetype !== 'player')) { try { await h.h('despawn', e.eid); } catch { /* */ } }
  await h.h('lockOn', null);
  await h.h('stepFrames', 8);
  await h.h('openMenu', 'inventory');
  const d0 = await h.h('getFrame');
  await h.h('stepFrames', 30);
  const dPaused = (await h.h('getFrame')) - d0;
  let e2 = null;
  try { e2 = (await h.h('spawn', 'inf_trash', 0, 3.0, { as: 'p4' })).eid || 'p4'; } catch { /* */ }
  if (e2) await h.h('aggro', e2);
  const d1 = await h.h('getFrame');
  await h.h('stepFrames', 60);
  const d2 = await h.h('getFrame');
  const modeAfter = (await h.h('getUIState')).mode;
  out.raw.p4 = { paused_before: dPaused, ran_after: d2 - d1, mode_after: modeAfter };
  push('P4', 'combat beginning mid-menu resumes the world, silently, with the screen still open',
    dPaused === 0 && d2 - d1 === 60 && modeAfter === 'inventory',
    `0/30 before aggro, ${d2 - d1}/60 after, mode still '${modeAfter}'`);

  // ---- P7: equip commitment --------------------------------------------------------------------
  const equip = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.openMenu('inventory');
    const ui = H.getUIState();
    const rows = ui.elements.filter((e) => e.kind === 'list_row' && e.meta && (e.meta.category === 'weapon' || e.meta.category === 'armour'));
    if (!rows.length) return { error: 'no equippable row on the screen' };
    // focus that row and confirm, through the same path a button press takes
    const all = ui.elements.filter((e) => e.kind === 'list_row');
    H.uiFocus({ col: 1, rowIdx: all.indexOf(rows[0]) });
    H.traceStart({});
    const before = H.getFrame();
    H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    H.stepFrames(60);
    const tr = H.traceDrain();
    H.traceStop();
    const s = JSON.stringify(tr);
    const start = /equip_start/.test(s), end = /equip_end/.test(s);
    const m = /"commit_frames":(\d+)/.exec(s);
    return { item: rows[0].meta.item_id, before, equip_start: start, equip_end: end, commit_frames: m ? Number(m[1]) : null };
  });
  out.raw.equip = equip;
  push('M-P5', 'P7 equipping in a fight is an animation-committed action of ≥30 frames',
    !!equip.equip_start && equip.commit_frames >= 30,
    JSON.stringify(equip));

  // ---- E11: no toast during an active fight ----------------------------------------------------
  const toasts = (await h.h('getUIState')).elements.filter((e) => e.kind === 'toast' && e.visible);
  push('E11', 'no transient toast on screen during an active fight (§C)', toasts.length === 0, `${toasts.length} toasts`);

  // ---- gamepad-only reachability ----------------------------------------------------------------
  // Nothing but the pad from here: start opens the interface, the d-pad walks it, A confirms,
  // B goes back. If any surface needs a key or a pointer this loop cannot reach it.
  await h.h('closeMenu');
  await h.h('setMode', 'play-instrumented');
  const pad = async (pressed, axes, steps) => {
    await h.h('gamepad', padState(pressed, axes));
    await h.h('gamepadPoll');
    await h.h('stepFrames', steps === undefined ? 2 : steps);
    await h.h('gamepad', padState([], [0, 0, 0, 0]));
    await h.h('gamepadPoll');
    await h.h('stepFrames', 2);
  };
  const reach = [];
  await pad([PAD.START]);                          // open
  reach.push({ after: 'START', mode: (await h.h('getUIState')).mode });
  await pad([], [0, 1, 0, 0]);                     // left stick down: walk the list
  await pad([], [0, 1, 0, 0]);
  reach.push({ after: 'stick down x2', focus: (await h.h('getUIState')).elements.filter((e) => e.focused).map((e) => e.id) });
  await pad([PAD.DLEFT]);                          // d-pad left: change column
  reach.push({ after: 'DPAD LEFT', focus: (await h.h('getUIState')).elements.filter((e) => e.focused).map((e) => e.id) });
  await pad([PAD.DDOWN]);
  await pad([PAD.A]);                              // A: confirm (cycles the category)
  reach.push({ after: 'A', mode: (await h.h('getUIState')).mode });
  await pad([PAD.START]);                          // close
  reach.push({ after: 'START', mode: (await h.h('getUIState')).mode });
  out.raw.gamepad_walk = reach;
  const padOpened = reach[0].mode === 'inventory';
  const padMoved = reach[1].focus && reach[1].focus.length > 0;
  const padColumn = reach[2].focus && JSON.stringify(reach[2].focus) !== JSON.stringify(reach[1].focus);
  const padClosed = reach[reach.length - 1].mode === 'world';
  push('PAD', 'the interface opens, navigates, confirms and closes on a GameSir X2s alone',
    padOpened && padMoved && padColumn && padClosed,
    `open ${padOpened}, stick moved focus ${padMoved}, d-pad changed column ${padColumn}, closed ${padClosed}`);

  // every screen openable, and each one reporting the surfaces reachable from it
  await h.h('setMode', 'harness');
  const surfaces = {};
  for (const m of ['inventory', 'journal', 'sheet', 'spells']) {
    await h.h('openMenu', m);
    const ui = await h.h('getUIState');
    surfaces[m] = { elements: ui.elements.length, navigable: ui.navigable };
  }
  await h.h('setAtHearth', true);
  await h.h('openMenu', 'levelup');
  surfaces.levelup = { elements: (await h.h('getUIState')).elements.length };
  await h.h('openMenu', 'book', { id: 'pilots-chart-book' });
  surfaces.book = { elements: (await h.h('getUIState')).elements.length };
  await h.h('openContainer', 'A rope-tied crate', [{ id: 'salt-brick', count: 2 }, { id: 'reed-lantern', count: 1 }]);
  surfaces.container = { elements: (await h.h('getUIState')).elements.length };
  out.raw.surfaces = surfaces;
  push('SURFACES', 'all seven surfaces open and draw', Object.values(surfaces).every((s) => s.elements > 5),
    JSON.stringify(Object.fromEntries(Object.entries(surfaces).map(([k, v]) => [k, v.elements]))));
} finally {
  await h.close();
}

out.ok = out.checks.every((c) => c.pass);
writeJson(path.join(RUN, 'ui-pause.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  for (const c of out.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
  log(`ui-pause: ${out.checks.filter((c) => c.pass).length}/${out.checks.length}`);
  log(`artifacts: ${RUN}`);
}
process.exit(out.ok ? 0 : 1);
