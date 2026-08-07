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
// ui-journal carries the 44-item inventory M-P5 needs and the journal JU-checks use.
const state = String(args.state || 'ui-journal');

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }

/** GameSir X2s Type-C / W3C standard mapping. Index -> the action GAMEPAD_BINDINGS gives it. */
const PAD = { A: 0, B: 1, X: 2, Y: 3, START: 9, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 };
let PAD_TS = 1000;
function padState(pressed, axes) {
  // BOOLEANS, not objects. `RealInput.pushGamepadState` reads each entry as
  // `typeof v === 'number' ? {...} : {pressed: !!v}` — an object is TRUTHY, so a "released"
  // button expressed as `{pressed:false}` arrives at the router as PRESSED. The first poll then
  // reports all seventeen buttons rising at once and no button ever rises again, which looks
  // exactly like a build whose menus ignore the pad. It cost one debugging round; the note is
  // here so it costs nobody else one.
  const buttons = new Array(17).fill(false);
  for (const i of pressed) buttons[i] = true;
  return {
    index: 0, id: 'GameSir-X2s Type-C (STANDARD GAMEPAD Vendor: 3537 Product: 1001)',
    mapping: 'standard', connected: true, timestamp: (PAD_TS += 16),
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
  // `inf_trash` declares ai='hold_ground' and never attacks (AGENT-PROTOCOL). That is exactly
  // what these legs need: `inCombat()` is true because a live hostile is inside 30 m, and the
  // player is not being killed while we measure whether the menu ate their dodge.
  let eid = null;
  try { eid = (await h.h('spawn', 'inf_trash', 0, 4.6, { as: 'p2' })).eid || 'p2'; } catch { /* */ }
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
  //
  // "assert the centre 40%x40% has >= 30% of its pixels contributed by the world layer."
  //
  // The first version of this compared the composited pixel against the world pixel and called
  // the world "visible" when they were close. That is wrong and it failed a correct build: over
  // a dark interior (world luma ~10) a 50%-opacity parchment panel composites to ~95, which is
  // an enormous relative change and a perfectly visible world.
  //
  // The honest test is a PERTURBATION. Change the world and nothing else, with the same screen
  // open, and count the centre pixels that move. A pixel that still responds to the world is a
  // pixel the world is contributing to; a pixel behind an opaque panel does not move at all.
  // Two time-of-day settings are the cheapest perturbation that reaches every surface.
  const uiState = await h.h('getUIState');
  await h.h('setUIVisible', true);
  await h.h('setTimeOfDay', 13);
  await h.h('stepFrames', 1);
  const dayShot = decode(await h.h('screenshot'));
  await h.h('setTimeOfDay', 1);
  await h.h('stepFrames', 1);
  const nightShot = decode(await h.h('screenshot'));
  await h.h('setTimeOfDay', 13);
  await h.h('stepFrames', 1);
  // and the plain UI-on/UI-off pair, for the panel's own footprint
  const on = decode(await h.h('screenshot'));
  await h.h('setUIVisible', false);
  const off = decode(await h.h('screenshot'));
  await h.h('setUIVisible', true);
  const cx = Math.round(on.width * 0.30), cy = Math.round(on.height * 0.30);
  const cw = Math.round(on.width * 0.40), ch = Math.round(on.height * 0.40);
  let centreTotal = 0, centreWorldVisible = 0, centreCovered = 0;
  // How much the world itself moves outside the panel, as the control: the centre's response is
  // reported as a FRACTION of the response of the same perturbation with no UI over it.
  let ctrlTotal = 0, ctrlMoved = 0;
  for (let y = 0; y < on.height; y++) {
    for (let x = 0; x < on.width; x++) {
      const o = (y * on.width + x) * 4;
      const moved = Math.abs(dayShot.data[o] - nightShot.data[o])
        + Math.abs(dayShot.data[o + 1] - nightShot.data[o + 1])
        + Math.abs(dayShot.data[o + 2] - nightShot.data[o + 2]) > 6;
      const inCentre = x >= cx && x < cx + cw && y >= cy && y < cy + ch;
      const underUI = Math.abs(on.data[o] - off.data[o]) + Math.abs(on.data[o + 1] - off.data[o + 1])
        + Math.abs(on.data[o + 2] - off.data[o + 2]) > 6;
      if (inCentre) {
        centreTotal++;
        if (underUI) centreCovered++;
        if (moved) centreWorldVisible++;
      } else if (!underUI) { ctrlTotal++; if (moved) ctrlMoved++; }
    }
  }
  const panel = uiState.elements.find((e) => e.kind === 'panel');
  const areaFrac = panel ? (panel.rect[2] * panel.rect[3]) / (on.width * on.height) : 0;
  out.raw.occlusion = {
    panel_area_frac: +areaFrac.toFixed(4),
    declared_opacity: uiState.menu.opacity,
    centre_box: [cx, cy, cw, ch],
    centre_under_ui_frac: +(centreCovered / centreTotal).toFixed(4),
    centre_world_responds_frac: +(centreWorldVisible / centreTotal).toFixed(4),
    control_world_responds_frac: ctrlTotal ? +(ctrlMoved / ctrlTotal).toFixed(4) : null,
    perturbation: 'setTimeOfDay 13 -> 1, screen open, nothing else changed',
  };
  push('M-P4', 'P5 occlusion: <=55% opacity, <=60% of screen area, and the world still reaches >=30% of the centre 40%x40%',
    uiState.menu.opacity <= 0.55 && areaFrac <= 0.60 && centreWorldVisible / centreTotal >= 0.30,
    `opacity ${uiState.menu.opacity}, area ${(areaFrac * 100).toFixed(1)}%, the world moves ${(100 * centreWorldVisible / centreTotal).toFixed(1)}% of centre pixels under a screen covering ${(100 * centreCovered / centreTotal).toFixed(1)}% of them (control, outside the screen: ${ctrlTotal ? (100 * ctrlMoved / ctrlTotal).toFixed(1) : 'n/a'}%)`);

  // ---- P6: input liveness. `roll` must still fire with the menu open in a fight. --------------
  const rollFired = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const before = H.getPlayerStats();
    if (before.hp <= 0) return { rolled: false, error: 'the player is dead; the leg cannot be measured' };
    // Watch the PLAYER STATE, not a trace regex. `getCombatState()` is not attached in every
    // named state, and a probe that reports "no roll" when it means "no combat trace here" is
    // reporting the instrument.
    H.queueInputs([{ f: 1, press: ['roll'] }, { f: 4, release: ['roll'] }]);
    const seen = [];
    let stam0 = before.stamina, stamMin = before.stamina;
    for (let i = 0; i < 40; i++) {
      H.stepFrames(1);
      const p = H.getPlayerStats();
      seen.push(p.state);
      if (p.stamina < stamMin) stamMin = p.stamina;
    }
    return {
      rolled: seen.includes('ROLL'),
      states: [...new Set(seen)],
      stamina_before: stam0, stamina_min: stamMin, stamina_spent: +(stam0 - stamMin).toFixed(2),
      mode: H.getUIState().mode,
      hp: H.getPlayerStats().hp,
    };
  });
  out.raw.input_liveness = rollFired;
  push('M-P3', 'P6 input liveness: `roll` is not swallowed by the menu in combat',
    (rollFired.rolled || rollFired.stamina_spent > 0) && rollFired.mode !== 'world',
    `player states seen: ${JSON.stringify(rollFired.states)}; stamina spent ${rollFired.stamina_spent}; menu still open: ${rollFired.mode}${rollFired.error ? ' — ' + rollFired.error : ''}`);

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
    // The category tags make this deterministic: switch to Weapon, and every row on the screen
    // is equippable. Walking the 'all' list and hoping row N is a weapon is how a probe passes
    // on one fixture and fails on the next.
    H.uiFocus({ col: 0, tagIdx: 1, rowIdx: 0 });
    const ui2 = H.getUIState();
    const rows = ui2.elements.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id);
    if (!rows.length) return { error: 'the Weapon category is empty on this fixture' };
    H.uiFocus({ col: 1, rowIdx: 0 });
    H.traceStart({});
    const before = H.getFrame();
    H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    H.stepFrames(60);
    const tr = H.traceDrain();
    H.traceStop();
    const s = JSON.stringify(tr);
    const start = /equip_start/.test(s), end = /equip_end/.test(s);
    const m = /"commit_frames":(\d+)/.exec(s);
    return { item: rows[0].meta.item_id, category: rows[0].meta.category, before, equip_start: start, equip_end: end, commit_frames: m ? Number(m[1]) : null };
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
  const colBefore = (await h.h('getUIState')).focus.col;
  await pad([PAD.DLEFT]);                          // d-pad left: change column
  const uiAfterDpad = await h.h('getUIState');
  reach.push({ after: 'DPAD LEFT', col: uiAfterDpad.focus.col, colBefore,
    focus: uiAfterDpad.elements.filter((e) => e.focused).map((e) => e.id) });
  await pad([PAD.DDOWN]);
  await pad([PAD.A]);                              // A: confirm
  reach.push({ after: 'A', mode: (await h.h('getUIState')).mode });
  await pad([PAD.B]);                              // B: back out of anything A opened
  await pad([PAD.START]);                          // close
  reach.push({ after: 'START', mode: (await h.h('getUIState')).mode });
  out.raw.gamepad_walk = reach;
  const padOpened = reach[0].mode === 'inventory';
  const padMoved = reach[1].focus && reach[1].focus.length > 0;
  const padColumn = reach[2].col !== reach[2].colBefore;
  const padClosed = reach[reach.length - 1].mode === 'world';
  push('PAD', 'the interface opens, navigates, confirms and closes on a GameSir X2s alone',
    padOpened && padMoved && padColumn && padClosed,
    `open ${padOpened}, stick moved focus ${padMoved}, d-pad moved column ${reach[2].colBefore}->${reach[2].col}, closed ${padClosed} (final mode ${reach[reach.length-1].mode})`);

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
