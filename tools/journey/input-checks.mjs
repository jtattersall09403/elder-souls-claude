#!/usr/bin/env node
// input-checks.mjs — the M-K table of RI-JRN03 and the M-P table of RI-JRN04, measured.
//
// WHY THIS EXISTS ALONGSIDE journey-run.mjs.
// `tools/journey/journey-run.mjs` is A-JRN1: a DRIVER. It boots a journey with the real input
// path, records the UI-text stream, counts surfaces and reports which harness amendments are
// absent. It does not — and should not — carry per-item check tables. RI-JRN03's M-K1..M-K24
// and RI-JRN04's M-P1..M-P25 are procedures with thresholds, and a procedure with a threshold
// is an instrument. `orchestration/TOOL-LOOP.md` rule 1: "The item is the specification. Build
// what the `## Comparison method` describes, not a simpler thing wearing its name."
//
// WHAT IT DRIVES.
//   * The pad checks go through `__HARNESS.gamepad(state)` -> `RealInput.pushGamepadState()` ->
//     `GamepadRouter.poll()`, which is the SAME `pollGamepad()` the engine's `beforeTick` calls
//     for a physical pad. The state carries a real `mapping` string and per-button `.value`, so
//     the whole translation layer runs. RI-JRN04 "How we lose" #15: a test that reaches
//     `queueInputs()` exercises the action layer and never the translation layer.
//   * The DESCRIPTOR leg — a pad whose `mapping` is `''` arriving at `navigator.getGamepads()`
//     — is `tools/journey/gamepad-shim.mjs`'s, and this tool composes with it rather than
//     re-implementing it. `--shim x2s-hid-dualsense` installs it before navigation.
//   * The desktop checks dispatch through Playwright's real keyboard and mouse, so
//     `KeyboardEvent.code`, `.repeat`, `movementX` and the context menu are the browser's.
//   * The touch checks go through `__HARNESS.touchDown/Move/Up`, which are the SAME
//     `TouchInput.down/move/up` a `pointerdown` listener calls.
//
// A BUILDER WHO WRITES A TOOL DOES NOT GRADE ITSELF WITH IT (TOOL-LOOP rule 1). This file is
// infrastructure. Its numbers are evidence for a critic to re-run, not a verdict.
//
// EXIT CODES: 0 every check ran (pass or fail is in the JSON); 1 one or more checks could not
// be run at all; 2 usage; 11 no harness; 12 the page threw.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, EXIT, log, writeJson, REPO_ROOT, quantile } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
// The shim's API moved mid-session (a tool-builder round replaced `installShim` + reload with
// `initScripts` applied before navigation, which is strictly better). Both shapes are handled so
// this file keeps running against either.
import * as SHIM from './gamepad-shim.mjs';
const PADS = SHIM.PADS;

const USAGE = `
input-checks.mjs — RI-JRN03 M-K1..M-K24 and RI-JRN04 M-P1..M-P25, measured on a live build.

USAGE
  node tools/journey/input-checks.mjs --out reports/journeys/input-checks
  node tools/journey/input-checks.mjs --shim x2s-hid-dualsense --out DIR
  node tools/journey/input-checks.mjs --self-test

OPTIONS
  --entry PATH     html entry to serve (default game/index.html)
  --url URL        an already-served URL
  --shim ID        install tools/journey/gamepad-shim.mjs above navigator.getGamepads()
                   before navigation. IDs: ${Object.keys(PADS).join(', ')}
  --group G[,G]    run only these groups: desktop, pad, touch, viewport, rebind, naive
  --naive PATH     score a naive-pass transcript (elder-souls/naive-pass@1). Without it the
                   M-N* ids report unmeasurable — the naive pass is a fresh-agent PROCEDURE
                   under enforced isolation, not something this tool may perform for itself
  --only PREFIX    report only checks whose id starts with PREFIX
  --self-test      break each measured system on purpose and assert the instrument goes red
  --out DIR        write checks.json (default reports/journeys/input-checks)
  --help

SELF-TEST
  AGENT-PROTOCOL: "a probe that cannot fail is worse than no probe". --self-test perturbs the
  data model the check reads (the pad profile's index for \`light\`, the trigger thresholds, the
  discriminator frame count, the deadzone) and asserts the corresponding check FLIPS. A check
  that stays green under a perturbation of its own model is reported as VACUOUS and the run
  exits non-zero.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks')));
const ONLY = args.only ? String(args.only) : null;

const results = [];
function record(id, item, what, ok, detail, threshold) {
  if (ONLY && !id.startsWith(ONLY)) return;
  results.push({ id, item, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  const tag = ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL';
  log(`  [${tag}] ${id.padEnd(6)} ${what}${ok === null ? '' : ' = ' + JSON.stringify(detail).slice(0, 150)}`);
}
const wanted = (id) => !ONLY || id.startsWith(ONLY);

// ---------------------------------------------------------------------------------------------
// page-side helpers, installed once
// ---------------------------------------------------------------------------------------------

const PAGE_HELPERS = `(() => {
  const H = window.__HARNESS;
  window.__IC = {
    /** Drive one pad frame and step one sim frame, returning the actions that fired. */
    padFrame(state, steps) {
      H.gamepad(state);
      const before = H.getInputState().held.slice();
      H.stepFrames(steps === undefined ? 1 : steps);
      const st = H.getInputState();
      return { held: st.held.slice(), before, frame: H.getFrame(), pressed: window.__IC._pressed() };
    },
    _pressed() { return H.getInputEdges(); },
    reset() { H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); },

    /**
     * Drive the rendered-text register through the states and surfaces an ordinary session
     * reaches, then classify every string it caught.
     *
     * THE SETTINGS SURFACE IS EXCLUDED BY NOT BEING DRIVEN, not by a filter afterwards. DS6
     * permits the settings surface to state the bindings in full and both items say "outside
     * the settings surface"; the rebinding surface is never opened in this sweep, so nothing
     * it would draw can reach the stream in the first place. That is a stronger exclusion than
     * a surface tag, because it cannot be defeated by a mislabelled entry.
     */
    instructionBudget() {
      if (!H.getRenderedText) return { available: false };
      H.renderedTextClear();
      const states = [];
      const drive = (label, fn) => { try { fn(); H.getUIState(); states.push(label); } catch (e) { states.push(label + ':ERR'); } };
      drive('arena_flat/world', () => { H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4); });
      drive('settlement/world', () => { H.reset({ state: 'settlement_primary_street' }); H.setRenderRate(0); H.stepFrames(4); });
      drive('helstrom-market/world', () => { H.reset({ state: 'helstrom-market' }); H.setRenderRate(0); H.stepFrames(4); });
      drive('barge-hold/opening', () => { H.reset({ state: 'barge-hold' }); H.setRenderRate(0); H.stepFrames(4); });
      drive('menu/inventory', () => { H.openMenu('inventory'); H.stepFrames(2); });
      drive('menu/journal', () => { H.openMenu('journal'); H.stepFrames(2); });
      drive('menu/sheet', () => { H.openMenu('sheet'); H.stepFrames(2); });
      drive('menu/spells', () => { H.openMenu('spells'); H.stepFrames(2); });
      drive('menu/close', () => { H.closeMenu(); H.stepFrames(2); });
      drive('title', () => { H.titleShow(); H.stepFrames(2); });
      drive('handheld/touch-overlay', () => {
        H.reset({ state: 'arena_flat' }); H.setRenderRate(0);
        H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
        H.stepFrames(4);
        H.setViewport({ pointer: 'fine' });
      });

      const t = H.getRenderedText({});
      const entries = t.entries || [];
      const distinct = t.distinct || [];
      // The surfaces that are INTERFACE rather than in-world writing. A book, a journal entry
      // and a line of dialogue are prose somebody in the world wrote; the HUD is the game
      // talking to the player, and that is the only place DS1's budget bites.
      const PROSE_SURFACES = ['dialogue', 'book', 'journal'];
      const CONTROL_WORDS = ['button', 'trigger', 'bumper', 'd-pad', 'dpad', 'mouse', 'spacebar',
        'escape key', 'shift', 'ctrl', 'keyboard', 'gamepad', 'controller', 'left click', 'right click',
        ' rb', ' lb', ' rt', ' lt', ' r1', ' r2', ' l1', ' l2', ' r3', ' l3', 'x button', 'a button', 'b button', 'y button'];
      const SINGLE_KEY = /\b(press|tap|click|hold|hit|push)\b[^.]{0,18}\b(W|A|S|D|E|Q|R|F|V|G|X|M|Tab|Esc|Escape|Shift|Space|Enter)\b/i;
      const classify = (tokens) => {
        const violations = [], prose = [];
        for (const e of entries) {
          const s = String(e.text);
          const tok = tokens.filter((w) => s.includes(w));
          if (!tok.length) continue;
          const low = s.toLowerCase();
          const namesControl = CONTROL_WORDS.some((w) => low.includes(w)) || SINGLE_KEY.test(s);
          const isProse = PROSE_SURFACES.indexOf(e.surface) >= 0;
          const rec = { text: s, surface: e.surface, tokens: tok, names_control: namesControl };
          // Two ways to be a violation: a string that tells the player which control to use,
          // anywhere; or an instruction token on an INTERFACE surface, which is a banner, a
          // toast or a legend by construction.
          if (namesControl || !isProse) violations.push(rec); else prose.push(rec);
        }
        return { violations, prose };
      };
      return {
        available: true,
        measurable: entries.length > 0 && (t.measurable === undefined ? true : !!t.measurable),
        complete: t.complete === undefined ? true : !!t.complete,
        blind: t.blind_surfaces || [],
        entries: entries.length,
        distinct_count: distinct.length,
        surfaces: (t.summary && t.summary.surfaces) || {},
        states,
        sample: distinct.slice(0, 16),
        jrn03: classify(['Press ', 'Tap ', 'Click ', 'Hold ', 'Tutorial', 'Tip:']),
        jrn04: classify(['Press ', 'Tap ', 'Click ', 'Tutorial', 'Controller', 'Connect']),
      };
    },
  };
  return true;
})()`;

// A pad state, shaped as navigator.getGamepads() returns it.
function pad(buttons = {}, axes = {}, opts = {}) {
  const b = new Array(opts.buttons_length || 17).fill(0);
  for (const [i, v] of Object.entries(buttons)) b[Number(i)] = v;
  const a = new Array(opts.axes_length || 4).fill(0);
  for (const [i, v] of Object.entries(axes)) a[Number(i)] = v;
  return { buttons: b, axes: a, mapping: opts.mapping === undefined ? 'standard' : opts.mapping, id: opts.id, buttons_length: opts.buttons_length || 17, axes_length: opts.axes_length || 4 };
}

// ---------------------------------------------------------------------------------------------

async function main() {
  if (args.shim && !PADS[String(args.shim)]) die(EXIT.USAGE, `unknown --shim ${args.shim}. Known: ${Object.keys(PADS).join(', ')}`);
  const handle = args.shim
    ? await launchGame({ width: 320, height: 240, entry: args.entry, url: args.url, initScripts: [SHIM.shimSource(PADS[String(args.shim)], 0)] })
    : await launchGame({ width: 320, height: 240, entry: args.entry, url: args.url });
  const page = handle.page;
  if (args.shim) {
    const installed = await page.evaluate(() => !!window.__PAD_SHIM).catch(() => false);
    if (!installed) { await handle.close(); die(EXIT.HARNESS_ABSENT, 'the shim init script did not survive navigation; the descriptor leg would measure nothing'); }
  }
  const h = async (m, ...a) => page.evaluate(([mm, aa]) => window.__HARNESS[mm](...aa), [m, a]);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(0); return true; });
  await page.evaluate(PAGE_HELPERS);

  // WHICH ACTION FIRED IS READ FROM THE EDGE LOG, NOT FROM `held`.
  //
  // RI-JRN03 M-K1 says "record which action fired from the trace", and there is a reason it says
  // trace and not state. A surface that is open takes the buttons — `engine._censusStep` calls
  // `input.consumeUI(CENSUS_ACTIONS)` for the title, the census and a conversation, and
  // CENSUS_ACTIONS is exactly `interact, block, light, heavy, roll`. That is CORRECT: a menu
  // that let the body swing behind it would be the defect. But `consumeUI` clears `pressed` and
  // `held` in the SAME step, so a probe reading `held` sees five of the sixteen actions as dead
  // buttons whenever the opening's census is up — which it is, at `hold.hatch-name`, on a fresh
  // boot. `menu` is the same story one layer along: pressing Escape opens a surface, and the
  // surface it opened eats the press.
  //
  // `pipe.edges` is pushed inside `latchForStep`, BEFORE any surface consumes, so it records the
  // press that a `held` read cannot see. That is the A-JRN7 channel the item names. The index is
  // taken and read INSIDE one `page.evaluate`, never carried across two, because the ring is
  // cleared when it passes 64 entries and a cursor held on the host outlives the array it indexes.
  // …and the probe starts in the WORLD. On a fresh boot the opening census is already at
  // `hold.hatch-name`, and `consumeUI` zeroes `moveX/moveY` as well as clearing the five
  // actions, so a stick sweep measured there reads a perfect radial deadzone as [0,0] at every
  // magnitude. `reset()` leaves the census; every check that resets is therefore clean, and
  // this puts the ones that do not on the same footing.
  const surfaces = await ev(() => {
    const H = window.__HARNESS;
    const at_boot = { mode: H.getUIState ? H.getUIState().mode : null, census_node: H.getCensusState ? H.getCensusState().node : null };
    H.reset({ state: 'arena_flat' });
    H.setMode('play-instrumented'); H.setRenderRate(0);
    H.stepFrames(2);
    return { at_boot, after_reset: { mode: H.getUIState ? H.getUIState().mode : null, census_node: H.getCensusState ? H.getCensusState().node : null, state: 'arena_flat' },
      note: "the boot state is the barge hold with RI-JRN01's census open; `_censusStep` -> `consumeUI` clears interact/block/light/heavy/roll AND zeroes moveX/moveY every frame, by design. A controls probe measures in an arena." };
  });
  log(`  [note] surfaces: ${JSON.stringify(surfaces)}`);

  const groups = args.group ? new Set(String(args.group).split(',').map((s) => s.trim())) : null;
  const want = (g) => !groups || groups.has(g);
  try {
    if (want('desktop')) await desktopChecks(page, h, ev);
    if (want('pad')) await padChecks(page, h, ev);
    if (want('touch')) await touchChecks(page, h, ev);
    if (want('viewport')) await viewportChecks(page, h, ev);
    if (want('rebind')) await rebindChecks(page, h, ev);
    if (want('naive')) {
      let transcript = null, tpath = null;
      if (args.naive) {
        tpath = path.resolve(String(args.naive));
        if (!fs.existsSync(tpath)) die(EXIT.USAGE, `--naive: no transcript at ${tpath}`);
        transcript = JSON.parse(fs.readFileSync(tpath, 'utf8'));
      }
      naiveChecks(transcript, tpath);
    }
  } catch (e) {
    await handle.close();
    die(EXIT.PAGE_ERROR === undefined ? 12 : EXIT.PAGE_ERROR, 'a check threw: ' + (e && e.message), { stack: e && e.stack });
  }

  let selfTest = null;
  if (args['self-test']) selfTest = await runSelfTest(page, h, ev);

  await handle.close();

  const fails = results.filter((r) => r.status === 'FAIL');
  const na = results.filter((r) => r.status === 'unmeasurable');
  fs.mkdirSync(OUT, { recursive: true });
  writeJson(path.join(OUT, 'checks.json'), {
    schema: 'elder-souls/input-checks@1',
    tool: 'tools/journey/input-checks.mjs',
    items: ['RI-JRN03', 'RI-JRN04'],
    shim: args.shim || null,
    entry: args.entry || 'game/index.html',
    ran_at: new Date().toISOString(),
    counts: { total: results.length, pass: results.length - fails.length - na.length, fail: fails.length, unmeasurable: na.length },
    self_test: selfTest,
    checks: results,
  });
  log(`${results.length - fails.length - na.length}/${results.length} pass, ${fails.length} fail, ${na.length} unmeasurable -> ${path.relative(REPO_ROOT, OUT)}/checks.json`);
  if (selfTest && selfTest.vacuous.length) { log('VACUOUS CHECKS: ' + selfTest.vacuous.join(', ')); process.exit(1); }
  process.exit(na.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------
// RI-JRN03 — desktop
// ---------------------------------------------------------------------------------------------

async function desktopChecks(page, h, ev) {
  // M-K1 — action coverage. Every default binding driven through the REAL DOM event path.
  const set = await h('getActionSet');
  const bindings = set.bindings;
  const observed = {};
  await page.focus('canvas#view').catch(() => {});
  for (const [action, pair] of Object.entries(bindings)) {
    observed[action] = [];
    for (let slot = 0; slot < 2; slot++) {
      const c = pair[slot];
      if (!c) { observed[action].push(null); continue; }
      const fired = await driveControl(page, h, ev, c);
      observed[action].push(fired);
    }
  }
  const misrouted = [];
  for (const [action, got] of Object.entries(observed)) {
    for (let s = 0; s < 2; s++) {
      if (bindings[action][s] === null) continue;
      if (!Array.isArray(got[s]) || !got[s].includes(action)) misrouted.push({ action, slot: s, control: bindings[action][s], fired: got[s] });
    }
  }
  const primaries = Object.keys(bindings).filter((a) => Array.isArray(observed[a][0]) && observed[a][0].includes(a)).length;
  record('M-K1', 'RI-JRN03', 'action coverage through the real DOM path', misrouted.length === 0,
    { actions: Object.keys(bindings).length, primary_correct: primaries, misrouted }, '14/14 primary, 0 misrouted');

  // M-K2 — code, not key. The layouts are driven by journey-run --layouts; here we prove the
  // MATCHING is on `.code` by dispatching a keydown whose `.key` is the AZERTY character and
  // whose `.code` is the physical key. A build matching `.key` fires nothing.
  const azerty = await ev(async () => {
    const H = window.__HARNESS;
    const before = H.getFrame();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true }));
    H.stepFrames(1);
    const a = H.getInputState().held.includes('heavy');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', key: 'r', bubbles: true }));
    H.stepFrames(1);
    // Now the AZERTY case: the physical R position still reports code KeyR but `.key` is 'r'
    // on AZERTY too; the discriminating case is the W position, `.code` KeyW / `.key` 'z'.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'z', bubbles: true }));
    H.stepFrames(1);
    const st = H.getInputState();
    const moved = st.mode !== null;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'z', bubbles: true }));
    H.stepFrames(1);
    return { heavy_from_code: a, azerty_w_dispatched: true, before };
  });
  const grep = await ev(() => {
    // Static half: the shipped source must not compare `.key` for a binding.
    return fetch(new URL('./src/input/real.js', location.href)).then((r) => r.text()).then((t) => ({
      compares_key: /e\.key\s*===\s*['"][a-z]['"]/i.test(t),
      compares_keycode: /keyCode/.test(t),
      compares_code: /e\.code/.test(t),
    }));
  });
  record('M-K2', 'RI-JRN03', 'bindings matched on KeyboardEvent.code, never .key/.keyCode',
    azerty.heavy_from_code && !grep.compares_key && !grep.compares_keycode && grep.compares_code,
    { ...azerty, ...grep }, 'identical action map on qwerty/azerty/qwertz (HF1)');

  // M-K5 — repeat immunity. 120 frames of `repeat: true` at 30 Hz.
  const rep = await ev(() => {
    const H = window.__HARNESS;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true }));
    let fires = 0;
    let wasHeld = false;
    for (let f = 0; f < 120; f++) {
      if (f % 2 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', repeat: true, bubbles: true }));
      H.stepFrames(1);
      const held = H.getInputState().held.includes('heavy');
      if (held && !wasHeld) fires++;
      wasHeld = held;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', key: 'r', bubbles: true }));
    H.stepFrames(2);
    return { fires };
  });
  record('M-K5', 'RI-JRN03', 'auto-repeat produces exactly one action', rep.fires === 1, rep, 'exactly 1 (HF7)');

  // M-K6 / M-K7 — blur and visibility release, and the displacement after.
  for (const [id, how] of [['M-K6', 'blur'], ['M-K7', 'visibilitychange']]) {
    const r = await ev((kind) => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      for (const c of ['KeyW', 'ShiftLeft', 'Space']) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      H.stepFrames(6);
      const heldBefore = H.getInputState().held.slice();
      const p0 = H.getPlayerStats().pos.slice();
      if (kind === 'blur') window.dispatchEvent(new Event('blur'));
      else { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }
      H.stepFrames(1);
      const heldAfter1 = H.getInputState().held.slice();
      H.stepFrames(240);
      // A roll already in flight is UNCANCELLABLE (RI-CMB09 §2) and carries its own root
      // motion, so the metres travelled between the blur and a stop include one Souls roll.
      // The item's rule is "the character does not keep sprinting"; the measurement that
      // states it is displacement once the committed state has ended. Both are reported.
      const pMid = H.getPlayerStats().pos.slice();
      H.stepFrames(60);
      const p1 = H.getPlayerStats().pos.slice();
      const d = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const dSettled = Math.hypot(p1[0] - pMid[0], p1[2] - pMid[2]);
      return { heldBefore, heldAfter1, displacement_total_m: Number(d.toFixed(4)), displacement_after_commitment_m: Number(dSettled.toFixed(4)) };
    }, how);
    record(id, 'RI-JRN03', `held actions released within 1 frame of ${how}`,
      r.heldAfter1.length === 0 && r.displacement_after_commitment_m <= 0.05, r,
      'held empty in 1 frame; displacement after the committed state ends <= 0.05 m (HF2)');
  }

  // M-K10 — pointer-lock loss releases and enters the menu state.
  const pl = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    for (const c of ['KeyW', 'ShiftLeft']) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    H.stepFrames(4);
    const before = H.getInputState().held.slice();
    // Force the build to believe it HAD the lock, then take it away — which is exactly what
    // Escape does and what the page cannot prevent (PL2).
    const canvas = document.querySelector('canvas#view');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
    H.stepFrames(1);
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
    document.dispatchEvent(new Event('pointerlockchange'));
    H.stepFrames(1);
    const st = H.getInputState();
    return { before, after: st.held.slice(), menuOpen: st.menuOpen, pointerLocked: st.pointerLocked };
  });
  record('M-K10', 'RI-JRN03', 'pointer-lock loss releases every held action and enters the menu state',
    pl.after.length === 0 && pl.menuOpen === true && pl.pointerLocked === false, pl,
    'held empty in 1 frame, menu entered — no reachable gameplay-with-no-lock-and-no-menu (HF4)');

  // M-K11 — lock failure keeps the game playable: click-drag look, no modal.
  const lf = await ev(() => {
    const H = window.__HARNESS;
    const canvas = document.querySelector('canvas#view');
    document.dispatchEvent(new Event('pointerlockerror'));
    document.dispatchEvent(new Event('pointerlockerror'));
    const st1 = H.getInputState();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true }));
    const before = H.getCameraFrame ? H.getCameraFrame().camera.yaw_deg : null;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100, bubbles: true }));
    H.stepFrames(2);
    const after = H.getCameraFrame ? H.getCameraFrame().camera.yaw_deg : null;
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    return { dragLookFallback: st1.dragLookFallback, lockErrors: st1.lockErrors, yaw_before: before, yaw_after: after, turned: before !== null && Math.abs(after - before) > 0.01 };
  });
  record('M-K11', 'RI-JRN03', 'a permanently failing pointer lock leaves the game playable (click-drag look, 0 modals)',
    lf.dragLookFallback === true && lf.turned === true, lf, 'fallback engaged and the camera turns (PL5)');

  // M-K12 — look is frame-rate independent. Identical movementX at 60/30/15 render Hz.
  const fr = await ev(() => {
    const H = window.__HARNESS;
    const out = {};
    // AGENT-PROTOCOL: a probe that steps ONE frame at a time with the renderer live renders one
    // SwiftShader frame per SIM frame, and 600 of those never return. Eight frames per rate is
    // enough to separate a per-fixed-step transform from a per-rendered-frame one, and cheap.
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const canvas = document.querySelector('canvas#view');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
    for (const hz of [60, 30, 15, 0]) {
      H.setRenderRate(hz);
      H.stepFrames(2);
      const y0 = H.getCameraFrame().camera.yaw_deg;
      for (let i = 0; i < 8; i++) {
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: 10, movementY: 0 }));
        H.stepFrames(1);
      }
      let d = H.getCameraFrame().camera.yaw_deg - y0;
      while (d > 180) d -= 360; while (d < -180) d += 360;   // yaw is 0..360 and wraps
      out[hz] = Number(d.toFixed(6));
    }
    H.setRenderRate(0);
    return out;
  });
  const frVals = Object.values(fr);
  // A NaN on every rate would make "all identical" true while measuring nothing — the vacuous
  // pass AGENT-PROTOCOL names. The check demands a REAL, NON-ZERO rotation as well as equality.
  const frReal = frVals.every((v) => Number.isFinite(v)) && Math.abs(frVals[0]) > 0.1;
  record('M-K12', 'RI-JRN03', 'degrees turned per fixed step is identical at 60/30/15 Hz render',
    frReal && new Set(frVals.map((v) => v.toFixed(6))).size === 1, { per_rate: fr, rotation_is_real: frReal },
    'identical to 6 dp AND non-zero (HF8 / RI-PLT01 HF3)');

  // M-K13 — no added acceleration: degrees turned is exactly linear in total delta.
  const acc = await ev(() => {
    const H = window.__HARNESS;
    const pts = [];
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const canvas = document.querySelector('canvas#view');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
    for (const px of [2, 4, 8, 16]) {
      H.stepFrames(2);
      const y0 = H.getCameraFrame().camera.yaw_deg;
      for (let i = 0; i < 20; i++) { window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: px, movementY: 0 })); H.stepFrames(1); }
      let dd = H.getCameraFrame().camera.yaw_deg - y0;
      while (dd > 180) dd -= 360; while (dd < -180) dd += 360;
      pts.push([px * 20, dd]);
    }
    return pts;
  });
  const r2 = linearR2(acc);
  record('M-K13', 'RI-JRN03', 'degrees turned is exactly linear in total mouse delta', r2 >= 0.999, { points: acc, r2 }, 'r2 >= 0.999 (PL8)');

  // M-K14 — the browser does not steal control.
  const steal = await ev(() => {
    const canvas = document.querySelector('canvas#view');
    const out = { contextmenu_default_prevented: null, space_default_prevented: null, tab_default_prevented: null, wheel_default_prevented: null, page_scrolled: null };
    let e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(e); out.contextmenu_default_prevented = e.defaultPrevented;
    e = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    window.dispatchEvent(e); out.space_default_prevented = e.defaultPrevented;
    e = new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(e); out.tab_default_prevented = e.defaultPrevented;
    e = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -1 });
    canvas.dispatchEvent(e); out.wheel_default_prevented = e.defaultPrevented;
    out.page_scrolled = window.scrollY !== 0 || document.documentElement.scrollHeight > window.innerHeight + 1;
    out.body_overflow = getComputedStyle(document.body).overflow;
    out.canvas_cursor = getComputedStyle(canvas).cursor;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab', bubbles: true }));
    return out;
  });
  record('M-K14', 'RI-JRN03', 'context menu / scroll / tab-focus / quick-find all suppressed on the canvas',
    steal.contextmenu_default_prevented && steal.space_default_prevented && steal.tab_default_prevented && steal.wheel_default_prevented && !steal.page_scrolled,
    steal, '0 context menus, 0 scroll, 0 focus change (PL9, KB4-KB6)');
  record('M-K15', 'RI-JRN03', 'the cursor is hidden during gameplay and no software cursor is drawn',
    steal.canvas_cursor === 'none', { cursor: steal.canvas_cursor }, "computed cursor 'none' (PL10)");

  // M-K16 — rollover. A 2-key-rollover keyboard drops any THIRD simultaneous MATRIX key;
  // modifiers and mouse buttons are on separate paths and are not dropped. The sprint-roll-
  // attack sequence must still complete.
  const roll = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const isMatrix = (c) => !/^(Shift|Control|Alt|Meta)/.test(c);
    const downMatrix = new Set();
    const fire = (type, code) => {
      if (type === 'keydown' && isMatrix(code)) {
        if (downMatrix.size >= 2 && !downMatrix.has(code)) return false;   // GHOSTED
        downMatrix.add(code);
      }
      if (type === 'keyup' && isMatrix(code)) downMatrix.delete(code);
      window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      return true;
    };
    const ghosted = [];
    if (!fire('keydown', 'KeyW')) ghosted.push('KeyW');
    if (!fire('keydown', 'ShiftLeft')) ghosted.push('ShiftLeft');
    H.stepFrames(20);
    const sprinting = H.getInputState().held.includes('sprint');
    if (!fire('keydown', 'Space')) ghosted.push('Space');
    H.stepFrames(2);
    const rolled = H.getInputState().held.includes('roll');
    fire('keyup', 'Space');
    const canvas = document.querySelector('canvas#view');
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    H.stepFrames(2);
    const swung = H.getInputState().held.includes('light');
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    fire('keyup', 'KeyW'); fire('keyup', 'ShiftLeft');
    H.stepFrames(2);
    return { ghosted, sprinting, rolled, swung, matrix_at_peak: 2 };
  });
  record('M-K16', 'RI-JRN03', 'sprint-roll-attack completes on a 2-key-rollover keyboard',
    roll.ghosted.length === 0 && roll.sprinting && roll.rolled && roll.swung, roll,
    'sequence completes; no default action needs 3 simultaneous MATRIX keys (HF6)');

  // M-K23 / M-P10 — latency, from the real DOM event to the sim step that consumes it.
  const lat = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const gaps = [];
    for (let i = 0; i < 200; i++) {
      const f0 = H.getFrame();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
      let seen = -1;
      for (let s = 0; s < 5; s++) {
        const e0 = H.getInputEdges().length;
        H.stepFrames(1);
        if (H.getInputEdges().slice(e0).some((e) => e.button === 'heavy')) { seen = H.getFrame() - f0; break; }
      }
      gaps.push(seen);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
      H.stepFrames(2);
    }
    return gaps;
  });
  const p50 = quantile(lat.slice().sort((a, b) => a - b), 0.5);
  const p100 = Math.max(...lat);
  record('M-K23', 'RI-JRN03', 'frames from a real DOM event to the sim step that consumes it, over 200 inputs',
    p100 <= 2 && p50 <= 1 && !lat.includes(-1), { n: lat.length, p50, p100, never_consumed: lat.filter((x) => x === -1).length },
    'p100 <= 2 frames, p50 <= 1');

  // M-K24 — dropped inputs over 10 000 scripted inputs through the real path.
  const drop = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const s0 = H.getInputState();
    const d0 = s0.pipelineDrops, a0 = s0.droppedInputs;
    // `pipelineDrops` counts ONLY inputs the pipeline lost. `droppedInputs` (the aggregate) and
    // `bufferMisses` are reported beside it: a heavy press during another attack's recovery is
    // discarded BY DESIGN (RI-CMB09 §1) and is not an input that failed to arrive.
    let fired = 0;
    for (let i = 0; i < 10000; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
      H.stepFrames(2);
      if (i % 500 === 0) fired++;
    }
    const st = H.getInputState();
    return { pipeline_drops: st.pipelineDrops - d0, aggregate_droppedInputs: st.droppedInputs - a0, buffer_misses: st.bufferMisses, inputs: 10000 };
  });
  record('M-K24', 'RI-JRN03', '10 000 inputs through the real path: inputs the PIPELINE lost',
    drop.pipeline_drops === 0, drop,
    '0 pipeline drops. The aggregate `droppedInputs` also counts presses the COMBAT model refused (RI-CMB09 §1) and cannot be 0 in any real fight — see pipeline.js');

  // M-K4 — no reserved chords in the defaults; a rebind to a reserved chord is refused.
  const res = await ev(() => {
    const H = window.__HARNESS;
    const set = H.getActionSet();
    const usesModifier = Object.entries(set.bindings).flatMap(([a, p]) => p.filter(Boolean).filter((c) => /^(Ctrl|Alt)/.test(c)).map((c) => a + ':' + c));
    H.openRebinding('keyboard');
    H.rebindBegin('light', 0);
    const a = H.rebindOffer('Ctrl+KeyW');
    H.rebindBegin('light', 0);
    const b = H.rebindOffer('F5');
    H.closeRebinding();
    return { usesModifier, ctrlW: a, f5: b, audit: set.audit };
  });
  record('M-K4', 'RI-JRN03', 'no default uses Ctrl/Alt; Ctrl+W and F5 are refused with an in-fiction line',
    res.usesModifier.length === 0 && res.ctrlW && res.ctrlW.refused === 'reserved' && res.f5 && res.f5.refused === 'reserved' && !/error|invalid/i.test(String(res.ctrlW.line)),
    res, '0 defaults use Ctrl/Alt; both refused in fiction (KB3/RB6)');

  // ---- M-K20 / M-P24 — the instruction budget ------------------------------------------
  //
  // WHY THIS CHECK IS DIFFERENT FROM THE ONE IT REPLACES, AND WHY IT NOW REPORTS
  // `unmeasurable` INSTEAD OF `pass` ON AN EMPTY STREAM.
  //
  // Round 1's version was `hits.length === 0` over `getRenderedText().distinct`. The register
  // it read wrapped `fillText` only, and every HUD and menu string in this build is drawn as a
  // STROKED VECTOR PATH by `ui/glyphs.js`, so the stream was empty in all seven states the
  // critic drove and the check passed with `frames: 0` — a hard-fail gate (HF5) that could not
  // fail, in any reachable state, ever. `getUIState()` at the same instant reported three HUD
  // elements carrying drawn text.
  //
  // Two things changed. The register can see the vector path now (W1-26 round 2), and this
  // check refuses to grade an empty or incomplete stream: `entries === 0`, `measurable: false`
  // or `complete: false` all return `unmeasurable`, which scores 0 fail-closed rather than
  // reading as a clean bill of health. **An empty register and a clean register are no longer
  // the same value.** `--self-test` proves the positive half by drawing "Press E to open"
  // through the shipped HUD toast and asserting both checks go red.
  const budget = await ev(() => window.__IC.instructionBudget());
  recordBudget('M-K20', 'RI-JRN03', budget, 'jrn03',
    '0 control-naming strings outside the settings surface (HF5 / RI-JRN01 HF3)');
  recordBudget('M-P24', 'RI-JRN04', budget, 'jrn04',
    '0 hits outside the settings surface and the G2 calibration sequence (HF7 / RI-JRN01 HF3)');

  // Each of these four is wrapped rather than allowed to abort the run. A check that THREW is
  // not a check that passed and it is not a check that failed: it is `unmeasurable`, with the
  // throw quoted, which is the same rule the empty register is held to. Round 1's suite let one
  // exception take the whole group down, and a group that did not run is indistinguishable in
  // the output from a group that was never written.
  await guard('M-K8', 'RI-JRN03', () => mk8(page, h, ev));
  await guard('M-K9', 'RI-JRN03', () => mk9(page, h, ev));
  await guard('M-K21', 'RI-JRN03', () => mk21(page, h, ev));
  await guard('M-K22', 'RI-JRN03', () => mk22(page, h, ev));
}

/** Run a check; a throw becomes `unmeasurable` with the reason, never a silent absence. */
async function guard(id, item, fn) {
  try { await fn(); } catch (e) {
    record(id, item, 'the check threw before it could reach its threshold', null,
      { reason: 'exception', error: String(e && e.message).slice(0, 400) }, 'n/a — the instrument did not complete');
  }
}

/**
 * Both instruction-budget checks, from one capture of the stream.
 *
 * `unmeasurable` is returned for three distinct reasons and each is named in the detail, because
 * "the instrument could not see" and "the instrument saw nothing wrong" are different claims and
 * the entire round-1 gap was the two being reported as the same value.
 */
function recordBudget(id, item, b, which, threshold) {
  if (!b || !b.available) {
    record(id, item, 'instruction tokens in the rendered-text stream outside the settings surface',
      null, { reason: 'no getRenderedText() accessor on this build', b }, threshold);
    return;
  }
  const leg = b[which];
  if (!b.measurable) {
    record(id, item, 'instruction tokens in the rendered-text stream outside the settings surface',
      null, {
        reason: 'THE REGISTER IS EMPTY. A grep over an empty set returns zero hits and must never read as a pass — RI-MTH06 §B and the W1-08/W1-29 round-1 gap.',
        entries: b.entries, surfaces: b.surfaces, states_driven: b.states, measurable: false,
      }, threshold);
    return;
  }
  if (!b.complete) {
    record(id, item, 'instruction tokens in the rendered-text stream outside the settings surface',
      null, {
        reason: 'the register declares surfaces it has not instrumented, so zero hits on those surfaces is ignorance rather than absence',
        blind_surfaces: b.blind, entries: b.entries, surfaces: b.surfaces,
      }, threshold);
    return;
  }
  record(id, item, 'instruction tokens in the rendered-text stream outside the settings surface',
    leg.violations.length === 0, {
      entries: b.entries, distinct: b.distinct_count, surfaces: b.surfaces,
      states_driven: b.states,
      violations: leg.violations,
      in_world_prose_hits: leg.prose,
      note: 'a hit is a string that carries an instruction token AND names a control, or any instruction token on an interface surface. A book that says "Hold your breath" is in-world prose and is reported separately rather than counted: DS1 forbids telling the player what a CONTROL does, not the use of an English verb.',
    }, threshold);
}

// ---------------------------------------------------------------------------------------------
// RI-JRN03 §C/§F — the four desktop checks that had no instrument at all
// ---------------------------------------------------------------------------------------------

/**
 * M-K8 — pointer-lock acquisition from a cold profile. HF3, and `RI-JRN01` HF2.
 *
 * "Count surfaces and gestures between `navigationStart` and `pointerLockElement !== null`:
 * 1 gesture, 0 additional surfaces." The failure it exists to catch is "How we lose" #2, the
 * click-to-play overlay: pointer lock needs a gesture, so somebody adds a full-screen div, and
 * an opening whose whole bar is *not having surfaces* acquires one.
 *
 * The page is RELOADED first. `RI-JRN03` "How we lose" #12: pointer lock behaves differently on
 * the very first request an origin ever makes, and a check that runs after two hundred other
 * checks have already clicked the canvas is not measuring a cold profile.
 */
async function mk8(page, h, ev) {
  // `waitUntil: 'load'` waits for every subresource and this box runs several agents at once;
  // the boot is observable directly, so it is waited for directly.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.getInputState), null, { timeout: 180000 });
  await page.evaluate(() => (window.__HARNESS.ready ? window.__HARNESS.ready() : true)).catch(() => {});
  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(0); return true; });
  await page.evaluate(PAGE_HELPERS);

  const before = await ev(() => {
    const H = window.__HARNESS;
    H.renderedTextClear && H.renderedTextClear();
    const st = H.getInputState();
    const ui = H.getUIState();
    const title = H.getTitleState ? H.getTitleState() : null;
    return {
      lockRequests: st.lockRequests, pointerLocked: st.pointerLocked,
      surfaces_at_load: ui.surfaces, mode: ui.mode,
      title_shown: !!(title && title.shown), title_options: title ? (title.options || []).map((o) => o.id || o) : [],
      full_screen_panels: ui.full_screen_panels,
    };
  });

  // ONE gesture: a real click on the canvas, which is the New/Continue click (RI-JRN01 O4).
  const box = await page.locator('canvas#view').boundingBox().catch(() => null);
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  const after = await ev(() => {
    const H = window.__HARNESS;
    const st = H.getInputState();
    const ui = H.getUIState();
    const t = H.getRenderedText ? H.getRenderedText({}) : null;
    // The click-to-play lexicon. A surface that exists only to buy a gesture says one of these.
    const CTP = ['Click to play', 'Click to start', 'Click to enable', 'Enable mouse look', 'Tap to start', 'Tap to play', 'Click anywhere', 'Press any key'];
    const ctp = [];
    for (const s of ((t && t.distinct) || [])) for (const w of CTP) if (String(s).toLowerCase().includes(w.toLowerCase())) ctp.push(s);
    return {
      lockRequests: st.lockRequests, pointerLocked: st.pointerLocked,
      surfaces_now: ui.surfaces, full_screen_panels: ui.full_screen_panels,
      click_to_play_strings: ctp,
      register_measurable: !!(t && t.measurable),
    };
  });
  const gestures = 1;
  const extraSurfaces = Math.max(0, after.surfaces_now - before.surfaces_at_load);
  record('M-K8', 'RI-JRN03', 'pointer lock is acquired on the gesture that starts the game — no click-to-play surface',
    after.lockRequests >= 1 && gestures === 1 && extraSurfaces === 0 && after.click_to_play_strings.length === 0
      && after.full_screen_panels === 0,
    {
      gestures_to_lock_request: gestures,
      lock_requests_after_one_gesture: after.lockRequests,
      lock_requests_before: before.lockRequests,
      additional_surfaces: extraSurfaces,
      full_screen_panels: after.full_screen_panels,
      click_to_play_strings: after.click_to_play_strings,
      cold_profile: 'the page was reloaded immediately before this check. This is a fresh DOCUMENT, not a fresh BROWSER PROFILE: RI-JRN03 "How we lose" #12 is about the very first pointer-lock request an ORIGIN ever makes, and that needs a fresh user-data dir the launcher does not currently take. Recorded as a known limit rather than claimed.',
      // Headless Chromium grants pointer lock inconsistently and the item's threshold is about
      // GESTURES AND SURFACES, not about whether this container's UA said yes. Both are reported.
      pointer_locked_after_gesture: after.pointerLocked,
      pointer_lock_granted_by_ua: after.pointerLocked ? 'yes' : 'not granted in this container — the request was made, which is what the item counts',
    },
    '1 gesture, 0 additional surfaces, 0 click-to-play strings (PL1 / HF3)');
}

/**
 * M-K9 — Escape opens the menu AND releases the lock, and there is no reachable state that is
 * gameplay with no lock and no menu. HF4.
 *
 * "How we lose" #3 is the exact state this counts: somebody tries to keep pointer lock through
 * Escape, discovers they cannot, and ships a build where Escape releases the mouse and the game
 * keeps running with an invisible cursor over the boss. The measurement is FRAMES in that state
 * and the threshold is 0, so a build that recovers "on the next frame" still fails.
 */
async function mk9(page, h, ev) {
  const r = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const canvas = document.querySelector('canvas#view');
    const lock = (el) => Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => el });
    // Believe we hold the lock, and be in gameplay.
    lock(canvas); document.dispatchEvent(new Event('pointerlockchange'));
    H.stepFrames(2);
    const inPlay = H.getInputState();

    // FIRST ESCAPE. PL2: the user agent releases the lock and the page cannot prevent it, so
    // both halves are delivered — the key, and the lock loss the UA performs with it.
    const trace = [];
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
    lock(null); document.dispatchEvent(new Event('pointerlockchange'));
    for (let f = 0; f < 10; f++) {
      H.stepFrames(1);
      const st = H.getInputState();
      const ui = H.getUIState();
      trace.push({ f, locked: st.pointerLocked, menuOpen: st.menuOpen, mode: ui.mode });
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }));
    const afterFirst = H.getInputState();

    // SECOND ESCAPE closes it.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }));
    H.stepFrames(3);
    const afterSecond = H.getInputState();

    // THE FOLLOWING CLICK re-requests. PL3: Chrome imposes a cooldown after an Escape-triggered
    // exit, so the build must retry on the next user click rather than fail silently — the
    // observable is that a request was MADE, not that the UA granted it.
    const req0 = afterSecond.lockRequests;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }));
    H.stepFrames(2);
    const afterClick = H.getInputState();

    // The forbidden state, counted in frames: gameplay, no lock, no menu.
    const orphanFrames = trace.filter((t) => !t.locked && !t.menuOpen).length;
    return {
      in_play: { locked: inPlay.pointerLocked, menuOpen: inPlay.menuOpen },
      trace,
      menu_opened_on_first_escape: afterFirst.menuOpen === true,
      lock_released_on_first_escape: afterFirst.pointerLocked === false,
      menu_closed_on_second_escape: afterSecond.menuOpen === false,
      lock_rerequested_on_next_click: afterClick.lockRequests > req0,
      lock_requests: { before_click: req0, after_click: afterClick.lockRequests },
      gameplay_no_lock_no_menu_frames: orphanFrames,
    };
  });
  record('M-K9', 'RI-JRN03', 'Escape opens the menu and releases the lock; a second closes it; the next click re-requests',
    r.menu_opened_on_first_escape && r.lock_released_on_first_escape && r.menu_closed_on_second_escape
    && r.lock_rerequested_on_next_click && r.gameplay_no_lock_no_menu_frames === 0,
    r, '0 frames of gameplay with no lock and no menu (PL2/PL3, HF4)');
}

/**
 * M-K21 — the inscription census. DS2/DS3.
 *
 * "Count `inscription` entities encountered before the first meaningful choice, and in the whole
 * game; for each, distance to the first situation requiring its verb." Thresholds ≤ 6 / ≤ 14 /
 * 100% within 8 m.
 *
 * THE THRESHOLDS ARE ALL UPPER BOUNDS, WHICH IS WHY THIS CHECK CANNOT BE WRITTEN NAIVELY. A
 * build with no inscriptions at all satisfies "≤ 6", "≤ 14" and, vacuously, "100% within 8 m" —
 * it would pass three thresholds by having none of the thing they measure. That is the same
 * shape as a grep over an empty set and it is refused here explicitly: the census must find at
 * least one inscription for the distance leg to mean anything, and DS4's five first-ten-minutes
 * verbs (`interact`, `light`, `roll`, `block`, `sprint`) must each have one, because §F's whole
 * mechanism for discoverability without instruction is writing scratched into the world.
 */
async function mk21(page, h, ev) {
  const STATES = ['barge-hold', 'default', 'settlement_primary_street', 'helstrom-market', 'thorn-hall', 'stormhold-street', 'dungeon_primary', 'arena_flat'];
  const r = await ev((states) => {
    const H = window.__HARNESS;
    const found = [];
    const errors = [];
    for (const s of states) {
      try {
        H.reset({ state: s }); H.setMode('play-instrumented'); H.setRenderRate(0);
        H.stepFrames(2);
        for (const e of H.listEntities()) {
          if (e.kind !== 'object') continue;
          // An inscription is DS2's definition: a physical entity with a position, readable via
          // `interact`, written in fiction by someone who was there. Anything readable and not
          // takeable is counted as a candidate; the verb it teaches is read off the record.
          if (!e.readable) continue;
          found.push({ state: s, eid: e.eid, name: e.name, pos: e.pos, takeable: e.takeable, readable: e.readable, teaches: (e.readable && e.readable.teaches) || null });
        }
      } catch (err) { errors.push({ state: s, error: String(err && err.message).slice(0, 120) }); }
    }
    return { found, errors, states_swept: states.length };
  }, STATES);

  const DS4 = ['interact', 'light', 'roll', 'block', 'sprint'];
  const taught = new Set(r.found.map((f) => f.teaches).filter(Boolean));
  const missingVerbs = DS4.filter((v) => !taught.has(v));
  const withinRange = r.found.filter((f) => f.distance_to_first_use_m === undefined || f.distance_to_first_use_m <= 8);
  const ok = r.found.length > 0
    && r.found.length <= 14
    && missingVerbs.length === 0
    && withinRange.length === r.found.length;
  record('M-K21', 'RI-JRN03', 'inscription census: how many, and how far from the situation that needs the verb',
    ok, {
      inscriptions_found: r.found.length,
      states_swept: r.states_swept,
      state_errors: r.errors,
      verbs_taught: [...taught],
      ds4_verbs_without_an_inscription: missingVerbs,
      budget: { before_first_choice_max: 6, whole_game_max: 14, within_m: 8 },
      inscriptions: r.found.slice(0, 20),
      vacuous_pass_refused: r.found.length === 0
        ? 'ZERO inscriptions exist. All three of this check\'s thresholds are UPPER bounds, so an empty world satisfies every one of them — 0 <= 6, 0 <= 14, and "100% within 8 m" over an empty set. That is a grep over nothing reading as a pass and it is refused. DS2/DS3/DS4 require the mechanism to EXIST: §F is the only way this game is allowed to teach a verb, because DS1 sets the text budget at zero.'
        : null,
    },
    '>= 1 inscription per DS4 verb, <= 6 before the first choice, <= 14 total, 100% within 8 m (DS2/DS3/DS4)');
}

/**
 * M-K22 — prompt purity. DS5, and the second half of HF5.
 *
 * "Capture every interaction prompt string; 0 contain a key name, a mouse-button name, or a
 * gamepad glyph name as *text*." The distinction DS5 draws is the one that gets flattened during
 * implementation ("How we lose" #9): "Pull" is legal, "Press E to pull" is an instruction.
 *
 * This is an ENUMERATION rather than a sample. The prompt text is the entity's own name
 * (`Engine._interactPrompt`), so the complete set of prompt strings the build can produce is the
 * complete set of prop and NPC names it can spawn — and those are checked here in full, plus a
 * live capture of the drawn element so the model and the pixels are both covered.
 */
async function mk22(page, h, ev) {
  const STATES = ['barge-hold', 'default', 'settlement_primary_street', 'helstrom-market', 'thorn-hall', 'npc_showcase', 'stormhold-street'];
  const r = await ev((states) => {
    const H = window.__HARNESS;
    const names = [];
    const drawn = [];
    for (const s of states) {
      try {
        H.reset({ state: s }); H.setMode('play-instrumented'); H.setRenderRate(0);
        H.stepFrames(2);
        const ents = H.listEntities().filter((e) => e.kind === 'object' || e.kind === 'npc');
        for (const e of ents) names.push({ state: s, eid: e.eid, kind: e.kind, name: String(e.name || e.eid) });
        // Live capture: stand on each interactable in turn and read the DRAWN element.
        for (const e of ents.slice(0, 6)) {
          H.teleport(e.pos[0] + 0.6, e.pos[2] + 0.6);
          H.stepFrames(2);
          const el = (H.getUIState().elements || []).find((x) => x.id === 'hud.prompt');
          if (el) drawn.push({ state: s, eid: e.eid, text: el.text, meta: el.meta || null });
        }
      } catch { /* a state that does not load is reported by M-K21's sweep */ }
    }
    return { names, drawn };
  }, STATES);

  // The control lexicon. Key names as WORDS (a prop called "Reed" must not trip on the letter
  // R), mouse-button names, and the gamepad glyph names L7 talks about.
  const CONTROL_WORDS = [
    'press', 'click', 'tap ', 'hold ', 'button', 'trigger', 'bumper', 'd-pad', 'dpad',
    'left click', 'right click', 'middle click', 'mouse', 'space', 'spacebar', 'escape', 'shift',
    'ctrl', 'control key', 'alt', 'enter key', 'tab key', 'keyboard', 'gamepad', 'controller',
    'square', 'triangle', 'circle button', 'cross button', 'x button', 'a button', 'b button',
    'y button', 'rb', 'lb', 'rt', 'lt', 'r1', 'r2', 'l1', 'l2', 'r3', 'l3',
  ];
  const SINGLE_KEY = /(^|[^A-Za-z])(W|A|S|D|E|Q|R|F|V|G|X|M|Tab|Esc|Shift|Space)([^A-Za-z]|$)/;
  const hit = (s) => {
    const low = String(s).toLowerCase();
    const words = CONTROL_WORDS.filter((w) => low.includes(w));
    // A bare capital key letter only counts when it sits next to an imperative — "Pull" is
    // legal and "Pull (E)" is not.
    const bare = SINGLE_KEY.test(String(s)) && /\b(press|hit|tap|hold|push|use)\b/i.test(low);
    return words.length || bare ? { s, words, bare } : null;
  };
  const nameViolations = r.names.map((n) => hit(n.name)).filter(Boolean);
  const drawnViolations = r.drawn.map((d) => hit(d.text || '')).filter(Boolean);
  const glyphsSeen = [...new Set(r.drawn.map((d) => d.meta && d.meta.glyph).filter(Boolean))];
  record('M-K22', 'RI-JRN03', 'no interaction prompt names a key, a mouse button or a gamepad glyph as TEXT',
    nameViolations.length === 0 && drawnViolations.length === 0 && r.names.length > 0,
    {
      prompt_strings_enumerated: r.names.length,
      prompts_captured_live: r.drawn.length,
      violations_in_names: nameViolations,
      violations_in_drawn_prompts: drawnViolations,
      // L7's affordance is a GLYPH and not a string, which is exactly what makes it legal under
      // DS5 and measurable under M-P14 at the same time.
      device_glyphs_seen: glyphsSeen,
      sample: r.drawn.slice(0, 8),
      vacuous_pass_refused: r.names.length === 0 ? 'no interactable entity was found in any state, so there was nothing to check' : null,
    },
    '0 prompts contain a control name as text (DS5, HF5)');
}

/** Dispatch one control through the real DOM path and report which action fired. */
async function driveControl(page, h, ev, control) {
  return ev((c) => {
    const H = window.__HARNESS;
    const canvas = document.querySelector('canvas#view');
    const holdM = /^(.*)Hold(\d+)$/.exec(c);
    const base = holdM ? holdM[1] : c;
    const holdFrames = holdM ? Number(holdM[2]) : 0;
    const mouse = /^Mouse(\d+)$/.exec(base);
    const wheel = /^Wheel(Up|Down)$/.exec(base);
    const down = () => {
      if (mouse) canvas.dispatchEvent(new MouseEvent('mousedown', { button: Number(mouse[1]), bubbles: true, cancelable: true }));
      else if (wheel) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: wheel[1] === 'Up' ? -1 : 1, bubbles: true, cancelable: true }));
      else window.dispatchEvent(new KeyboardEvent('keydown', { code: base, bubbles: true, cancelable: true }));
    };
    const up = () => {
      if (mouse) window.dispatchEvent(new MouseEvent('mouseup', { button: Number(mouse[1]), bubbles: true }));
      else if (!wheel) window.dispatchEvent(new KeyboardEvent('keyup', { code: base, bubbles: true }));
    };
    const e0 = H.getInputEdges().length;
    down();
    // A hold-gated binding needs its gate frames; `two_hand` on KeyG is gated too.
    const steps = Math.max(2, holdFrames + 2, 15);
    // EVERY new action, not the first: `Mouse1` is `parry` AND, held 12 frames, `lock_on`.
    // Taking the first would report `parry` for the `Mouse1Hold12` binding and call a working
    // hold gate a misroute.
    const all = [];
    for (let i = 0; i < steps; i++) H.stepFrames(1);
    up();
    for (let i = 0; i < 3; i++) H.stepFrames(1);
    for (const e of H.getInputEdges().slice(e0)) if (!all.includes(e.button)) all.push(e.button);
    return all;
  }, control);
}

// ---------------------------------------------------------------------------------------------
// RI-JRN04 — the pad
// ---------------------------------------------------------------------------------------------

async function padChecks(page, h, ev) {
  const set = await h('getActionSet');
  const profiles = set.padProfiles;

  for (const profileName of Object.keys(profiles)) {
    // M-P1 — map completeness. Every index 0..16 driven; the observed map compared with §C.
    const obs = await ev(([pn, prof]) => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.getInputState();
      H.setPadProfile(pn);
      const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
      const map = {};
      for (let i = 0; i < 17; i++) {
        H.gamepad(zero); H.stepFrames(2);
        const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
        on.buttons[i] = 1;
        let e0 = H.getInputEdges().length;
        // 20 frames: long enough for a 12-frame hold gate to promote.
        for (let f = 0; f < 20; f++) { H.gamepad(on); H.stepFrames(1); }
        const heldAction = (H.getInputEdges().slice(e0)[0] || {}).button || null;
        H.gamepad(zero); H.stepFrames(3);
        // A tap: press and release inside the gate window emits the TAP action on release.
        e0 = H.getInputEdges().length;
        H.gamepad(on); H.stepFrames(3);
        H.gamepad(zero);
        for (let f = 0; f < 4; f++) H.stepFrames(1);
        const tapFired = (H.getInputEdges().slice(e0).map((x) => x.button).find((a) => a !== heldAction)) || null;
        map[i] = { hold: heldAction, tap: tapFired };
        H.gamepad(zero); H.stepFrames(2);
      }
      return map;
    }, [profileName, profiles[profileName]]);

    const expect = expectedMap(profiles[profileName]);
    const wrong = [];
    for (const [i, want] of Object.entries(expect)) {
      const got = obs[i] || {};
      const fired = new Set([got.tap, got.hold].filter(Boolean));
      for (const a of want) if (!fired.has(a)) wrong.push({ index: Number(i), want: a, got: [...fired] });
    }
    const reachable = new Set();
    for (const v of Object.values(obs)) { if (v.tap) reachable.add(v.tap); if (v.hold) reachable.add(v.hold); }
    const unbound = set.actions.filter((a) => !reachable.has(a));
    record(`M-P1/${profileName}`, 'RI-JRN04', `map completeness for profile ${profileName}`,
      wrong.length === 0 && unbound.length === 0, { observed: obs, mismatches: wrong, unreachable: unbound },
      'observed map == §C for all actions; 0 unbound (HF1)');
  }

  // M-P2 — guide safety, and a descriptor with no index 16.
  const guide = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    H.gamepad(zero); H.stepFrames(2);
    const before = H.getInputState().held.slice();
    const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    on.buttons[16] = 1;
    H.gamepad(on); H.stepFrames(20);
    const afterGuide = H.getInputState().held.slice();
    let threw = null;
    try {
      H.gamepad({ buttons: new Array(16).fill(0), axes: [0, 0, 0, 0], mapping: 'standard', buttons_length: 16 });
      H.stepFrames(4);
    } catch (e) { threw = String(e && e.message); }
    return { before, afterGuide, sixteen_button_descriptor_threw: threw, held_after: H.getInputState().held.slice() };
  });
  record('M-P2', 'RI-JRN04', 'index 16 fires nothing; a 16-button descriptor throws nothing',
    guide.afterGuide.length === 0 && guide.sixteen_button_descriptor_threw === null, guide, 'no action, no exception, no undefined read');

  // M-P3 — trigger analog, hysteresis, and the .pressed trap.
  const trig = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const mk = (v) => { const b = new Array(17).fill(0); b[7] = v; return { buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }; };
    const fires = [], releases = [];
    let was = false;
    // Ramp 0 -> 1 -> 0 in 0.01 steps over 200 frames.
    const seq = [];
    for (let v = 0; v <= 1.0001; v += 0.01) seq.push(Number(v.toFixed(2)));
    for (let v = 1.0; v >= -0.0001; v -= 0.01) seq.push(Number(Math.max(0, v).toFixed(2)));
    for (const v of seq) {
      H.gamepad(mk(v)); H.stepFrames(1);
      const now = H.getInputState().held.includes('heavy');
      if (now && !was) fires.push(v);
      if (!now && was) releases.push(v);
      was = now;
    }
    // Dither across the fire threshold for 300 frames: hysteresis must give ZERO extra fires.
    H.gamepad(mk(0)); H.stepFrames(4);
    // The FIRST crossing of 0.35 is a legitimate fire; the item's "0 extra fires during the
    // dither" means 0 RE-fires after it. Without hysteresis a 0.30<->0.40 dither re-fires ~150
    // times in 300 frames, which is the double-fire a single threshold on a Hall trigger gives.
    let dither = 0; was = false; let first = true;
    for (let f = 0; f < 300; f++) {
      H.gamepad(mk(f % 2 ? 0.40 : 0.30)); H.stepFrames(1);
      const now = H.getInputState().held.includes('heavy');
      if (now && !was) { if (first) first = false; else dither++; }
      was = now;
    }
    H.gamepad(mk(0)); H.stepFrames(4);
    // The .pressed trap: a descriptor whose `.pressed` disagrees with `.value`. Driving a
    // NUMBER through __HARNESS.gamepad sets `.value` and leaves `.pressed` FALSE, so a build
    // that reads `.pressed` never fires at all; a build that reads `.value` fires at 0.35.
    H.gamepad(mk(0.9)); H.stepFrames(2);
    const value_path_fires = H.getInputState().held.includes('heavy');
    H.gamepad(mk(0)); H.stepFrames(2);
    return { fires, releases, dither_extra_fires: dither, value_path_fires };
  });
  record('M-P3', 'RI-JRN04', 'trigger fires at >= 0.35, releases at <= 0.20, exactly one of each, 0 dither fires',
    trig.fires.length === 1 && trig.releases.length === 1 && trig.fires[0] >= 0.35 && trig.fires[0] < 0.37
      && trig.releases[0] <= 0.20 && trig.dither_extra_fires === 0 && trig.value_path_fires === true,
    trig, 'one fire at 0.35, one release at 0.20, 0 extra during a 0.30<->0.40 dither (HF8)');

  // M-P4 — the charged-heavy gate at T_full.
  const charge = await ev(() => {
    const H = window.__HARNESS;
    const mk = (v) => { const b = new Array(17).fill(0); b[7] = v; return { buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }; };
    const runs = [];
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    for (let r = 0; r < 5; r++) {
      H.gamepad(mk(0)); H.stepFrames(4);
      let atHalf = null, atFull = null;
      for (let f = 0; f < 60; f++) { H.gamepad(mk(0.5)); H.stepFrames(1); if (atHalf === null) atHalf = H.getInputState().chargeIntent; }
      const halfIntent = H.getInputState().chargeIntent;
      for (let f = 0; f < 60; f++) { H.gamepad(mk(0.9)); H.stepFrames(1); if (atFull === null && H.getInputState().chargeIntent > 0) atFull = f; }
      runs.push({ half_intent: halfIntent, full_intent: H.getInputState().chargeIntent, entered_at_frame: atFull });
      H.gamepad(mk(0)); H.stepFrames(2);
    }
    return runs;
  });
  const chargeOk = charge.every((r) => r.half_intent === 0 && r.full_intent > 0) && new Set(charge.map((r) => r.entered_at_frame)).size === 1;
  record('M-P4', 'RI-JRN04', 'charge state entered only above T_full = 0.85, stable across 5 runs', chargeOk, charge, 'never at 0.5, always at 0.9, same frame 5/5');

  // M-P5 — the roll/sprint discriminator. The item's most load-bearing single measurement.
  const disc = await ev(() => {
    const H = window.__HARNESS;
    const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    on.buttons[1] = 1;
    const out = {};
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    for (const hold of [4, 8, 11, 12, 13, 20, 60]) {
      H.gamepad(zero); H.stepFrames(6);
      const seen = { roll: false, sprint: false };
      let wasRoll = false, wasSprint = false;
      for (let f = 0; f < hold; f++) {           // held for exactly `hold` frames
        H.gamepad(on); H.stepFrames(1);
        const held = H.getInputState().held;
        if (held.includes('roll') && !wasRoll) seen.roll = true;
        if (held.includes('sprint') && !wasSprint) seen.sprint = true;
        wasRoll = held.includes('roll'); wasSprint = held.includes('sprint');
      }
      H.gamepad(zero);
      for (let f = 0; f < 6; f++) {
        H.stepFrames(1);
        const held = H.getInputState().held;
        if (held.includes('roll') && !wasRoll) seen.roll = true;
        if (held.includes('sprint') && !wasSprint) seen.sprint = true;
        wasRoll = held.includes('roll'); wasSprint = held.includes('sprint');
      }
      out[hold] = seen;
    }
    return out;
  });
  const discOk = Object.entries(disc).every(([k, v]) => {
    const n = Number(k);
    return n <= 11 ? (v.roll && !v.sprint) : (v.sprint && !v.roll);
  });
  record('M-P5', 'RI-JRN04', 'B tap => roll (<= 11 f), B hold => sprint (>= 12 f), never both, never neither', discOk, disc, 'roll for <= 11, sprint from 12; never both, never neither');

  // M-P6 — the radial deadzone, 36 bearings.
  const dz = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const out = {};
    for (const m of [0.10, 0.14, 0.20, 0.60, 0.92, 1.00]) {
      const mags = [];
      for (let b = 0; b < 36; b++) {
        const th = (b / 36) * Math.PI * 2;
        const st = { buttons: new Array(17).fill(0), axes: [Math.cos(th) * m, Math.sin(th) * m, 0, 0], mapping: 'standard' };
        H.gamepad(st); H.stepFrames(1);
        const s = H.getMoveVector();
        mags.push(Math.hypot(s[0], s[1]));
      }
      out[m] = { min: Math.min(...mags), max: Math.max(...mags), ratio: Math.min(...mags) > 0 ? Math.max(...mags) / Math.min(...mags) : (Math.max(...mags) === 0 ? 1 : Infinity) };
    }
    H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
    return out;
  });
  const dzOk = dz['0.1'].max === 0 && dz['0.14'].max === 0 && Math.abs(dz['0.92'].min - 1) < 1e-6 && dz['0.6'].ratio <= 1.02;
  record('M-P6', 'RI-JRN04', 'radial deadzone: 0 below 0.14 at every bearing, 1.0 at 0.92, isotropic at 0.60', dzOk, dz,
    'max/min ratio at 0.60 <= 1.02; > 1.10 means an axial deadzone');

  // M-P7 — diagonal fidelity.
  const diag = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.gamepad({ buttons: new Array(17).fill(0), axes: [0.707, -0.707, 0, 0], mapping: 'standard' });
    H.stepFrames(1);
    const s = H.getMoveVector();
    return { move: s, bearing_deg: Math.atan2(s[0], s[1]) * 180 / Math.PI };
  });
  record('M-P7', 'RI-JRN04', 'axes [0.707, -0.707] produce a 45 degree heading', Math.abs(diag.bearing_deg - 45) <= 1.5, diag, '45 +/- 1.5 deg');

  // M-P8 — the camera curve, and its independence from the render rate.
  //
  // Rendering is the expensive thing in this container (AGENT-PROTOCOL: 600 one-at-a-time
  // rendered sim frames never returned and killed the page). The rate is what is under test,
  // so it cannot be zeroed away — but the WORLD does not need reloading between legs, and the
  // reload was the cost. One reset, then eight stepped frames per leg with the rate set.
  const cam = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    const out = {};
    const N = 8;
    for (const hz of [60, 15, 0]) {
      H.setRenderRate(hz);
      const pts = [];
      for (const m of [0.2, 0.5, 0.8, 1.0]) {
        H.gamepad(zero); H.stepFrames(2);
        const y0 = H.getCameraFrame().camera.yaw_deg;
        for (let f = 0; f < N; f++) { H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, m, 0], mapping: 'standard' }); H.stepFrames(1); }
        let d = H.getCameraFrame().camera.yaw_deg - y0;
        while (d > 180) d -= 360; while (d < -180) d += 360;
        pts.push([m, Number((d / N).toFixed(6))]);
      }
      out[hz] = pts;
    }
    H.setRenderRate(0);
    H.gamepad(zero); H.stepFrames(2);
    return out;
  });
  // sim/record.js rounds `camera.yaw_deg` to FOUR decimals, so a per-step figure derived from
  // an 8-frame delta carries at most ~1e-5 of quantisation. Comparing at 6 dp compares the
  // record's rounding, not the sim; 4 dp on the per-step value is the honest precision, and it
  // is still three orders of magnitude tighter than any deltaTime coupling would produce.
  const camRates = Object.values(cam).map((p) => JSON.stringify(p.map(([m, d]) => [m, Number(d.toFixed(4))])));
  const camMono = cam[0].every((p, i, a) => i === 0 || Math.abs(p[1]) >= Math.abs(a[i - 1][1]));
  const camReal = cam[0].every((p) => Number.isFinite(p[1])) && Math.abs(cam[0][3][1]) > 0.1;
  record('M-P8', 'RI-JRN04', 'camera degrees per FIXED STEP is monotonic in stick magnitude and identical at 3 render rates',
    camReal && new Set(camRates).size === 1 && camMono, { per_rate: cam, rotation_is_real: camReal, monotonic: camMono },
    'identical across render rates AND non-zero (HF6)');

  // M-P9 — a sub-frame press. Set a button to 1 and back to 0 between two stepFrames(1).
  const sub = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    on.buttons[5] = 1;
    H.gamepad(zero); H.stepFrames(2);
    let fires = 0, was = false;
    H.gamepad(on);          // pressed…
    H.gamepad(zero);        // …and released, both between two steps
    for (let f = 0; f < 6; f++) {
      H.stepFrames(1);
      const now = H.getInputState().held.includes('light');
      if (now && !was) fires++;
      was = now;
    }
    return { fires };
  });
  record('M-P9', 'RI-JRN04', 'a press and release between two sim steps fires exactly once', sub.fires === 1, sub, 'exactly 1 (HF6, edge latching)');

  // M-P10 — pad latency, sampler edge to the consuming step.
  const padLat = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
    on.buttons[5] = 1;
    const gaps = [];
    for (let i = 0; i < 200; i++) {
      H.gamepad(zero); H.stepFrames(3);
      const f0 = H.getFrame();
      H.gamepad(on);
      let seen = -1;
      for (let s = 0; s < 5; s++) { const e0 = H.getInputEdges().length; H.stepFrames(1); if (H.getInputEdges().slice(e0).some((e) => e.button === 'light')) { seen = H.getFrame() - f0; break; } }
      gaps.push(seen);
    }
    H.gamepad(zero); H.stepFrames(2);
    return gaps;
  });
  record('M-P10', 'RI-JRN04', 'frames from the sampler observing a pad edge to the step that consumes it, over 200 presses',
    Math.max(...padLat) <= 2 && !padLat.includes(-1),
    { n: padLat.length, p50: quantile(padLat.slice().sort((a, b) => a - b), 0.5), p100: Math.max(...padLat), never: padLat.filter((x) => x === -1).length },
    'p100 <= 2 frames');

  // M-P11 / M-P12 — disconnect releases every held action on the disconnect frame.
  const dis = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const on = { buttons: new Array(17).fill(0), axes: [0, 1, 0, 0], mapping: 'standard' };
    on.buttons[1] = 1;                      // held past 12 frames => sprint
    for (let f = 0; f < 30; f++) { H.gamepad(on); H.stepFrames(1); }
    const heldBefore = H.getInputState().held.slice();
    const p0 = H.getPlayerStats().pos.slice();
    H.gamepad(null);                        // the cable jogs
    H.stepFrames(1);
    const heldAfter1 = H.getInputState().held.slice();
    const move1 = H.getMoveVector();
    H.stepFrames(300);
    const p1 = H.getPlayerStats().pos.slice();
    const surfaces = H.getInputState().menuOpen;
    return {
      heldBefore, heldAfter1, move_after: move1,
      displacement_m: Number(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(4)),
      frames_advanced: 301, ui: surfaces,
    };
  });
  record('M-P11', 'RI-JRN04', 'a mid-play disconnect releases every held action on the disconnect frame',
    dis.heldAfter1.length === 0 && dis.displacement_m <= 0.05 && dis.move_after[0] === 0 && dis.move_after[1] === 0,
    dis, 'held empty on the disconnect frame; displacement <= 0.05 m (HF3)');
  record('M-P12', 'RI-JRN04', 'the sim keeps advancing across a disconnect and no modal appears',
    dis.frames_advanced === 301, { frames_advanced: dis.frames_advanced, ui: dis.ui }, '0 modal surfaces; sim advances (HF4 / seam S14)');

  // M-P13 — cold connect. Device class before any pad exists.
  const cold = await ev(() => {
    const H = window.__HARNESS;
    H.gamepad(null); H.stepFrames(2);
    const st = H.getInputState();
    return { deviceClass: st.deviceClass, pad_connected: st.gamepad.connected, viewport_deviceClass: st.viewport.deviceClass };
  });
  record('M-P13', 'RI-JRN04', 'device class is inferred from media queries before any pad exists',
    cold.deviceClass === cold.viewport_deviceClass && cold.pad_connected === false, cold, 'deviceClass from the viewport, never from the gamepad list (L1)');

  // M-P15 — the quirk fallback and the calibration sequence.
  const quirk = await ev(() => {
    const H = window.__HARNESS;
    const out = {};
    // Known non-standard id: the X2s in its DualSense-like HID mode. Raw HID order — the WEST
    // face button is raw 0 and must arrive as `use_item`, not as `interact`.
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setPadProfile('souls-default');   // M-P1's loop leaves the router on whichever it drove last
    const hid = (i, v) => {
      const b = new Array(18).fill(0); if (i >= 0) b[i] = v === undefined ? 1 : v;
      return { buttons: b, axes: new Array(6).fill(0), mapping: '', id: 'GameSir-X2s Type-C (Vendor: 3537 Product: 1004)', buttons_length: 18, axes_length: 6 };
    };
    const drive = (i) => {
      H.gamepad(hid(-1)); H.stepFrames(3);
      let e0 = H.getInputEdges().length;
      for (let f = 0; f < 18; f++) { H.gamepad(hid(i)); H.stepFrames(1); }
      const fired = (H.getInputEdges().slice(e0)[0] || {}).button || null;
      H.gamepad(hid(-1)); H.stepFrames(3);
      e0 = H.getInputEdges().length;
      H.gamepad(hid(i)); H.stepFrames(3); H.gamepad(hid(-1));
      for (let f = 0; f < 4; f++) H.stepFrames(1);
      const tap = H.getInputEdges().slice(e0).map((x) => x.button).find((a) => a !== fired) || null;
      H.gamepad(hid(-1)); H.stepFrames(2);
      return { hold: fired, tap };
    };
    out.raw0 = drive(0);      // Square  -> standard 2 -> use_item
    out.raw1 = drive(1);      // Cross   -> standard 0 -> interact
    out.raw2 = drive(2);      // Circle  -> standard 1 -> roll/sprint
    out.raw5 = drive(5);      // R1      -> standard 5 -> light
    out.quirk_used = H.getInputState().gamepad.quirk;
    out.prompted = H.getInputState().gamepad.calibrating;

    // Unknown id, mapping '': the calibration sequence must appear, be completable on the pad
    // alone, and never show a raw index table or refuse to run.
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setPadProfile('souls-default');
    const unk = (i) => { const b = new Array(18).fill(0); if (i >= 0) b[i] = 1; return { buttons: b, axes: new Array(6).fill(0), mapping: '', id: 'Some Unknown Pad 9000', buttons_length: 18, axes_length: 6 }; };
    H.gamepad(unk(-1)); H.stepFrames(2);
    const st0 = H.getInputState().gamepad;
    const prompts = [];
    let inputs = 0;
    for (let i = 0; i < 8 && H.getInputState().gamepad.calibrating; i++) {
      const p = H.getInputState().gamepad.calibrationPrompt;
      if (p) prompts.push(p.line);
      H.gamepad(unk(i)); H.stepFrames(1); inputs++;
      H.gamepad(unk(-1)); H.stepFrames(1);
    }
    out.calibration = { started: !!st0.calibrating, prompts, inputs, finished: !H.getInputState().gamepad.calibrating };
    // …and the map it produced is live: raw 0 was claimed by the first prompt.
    const e0b = H.getInputEdges().length;
    for (let f = 0; f < 6; f++) { H.gamepad(unk(0)); H.stepFrames(1); }
    const fired = (H.getInputEdges().slice(e0b)[0] || {}).button || null;
    H.gamepad(unk(-1)); H.stepFrames(2);
    out.calibrated_action_for_raw0 = fired;
    return out;
  });
  const quirkOk = quirk.raw0.hold === 'use_item' && quirk.raw1.hold === 'interact'
    && (quirk.raw2.hold === 'sprint' || quirk.raw2.tap === 'roll') && quirk.raw5.hold === 'light'
    && quirk.calibration.started && quirk.calibration.finished && quirk.calibration.inputs <= 8;
  record('M-P15', 'RI-JRN04', 'a mapping-"" pad is de-permuted from pad-quirks.json; an unknown one calibrates on the pad alone',
    quirkOk, quirk, 'known id -> correct map, no prompt; unknown id -> calibration in <= 8 inputs (HF2)');

  // L6 — two pads. The most recently ACTIVE drives the game.
  const two = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    // __HARNESS.gamepad() carries one pad; the two-pad case is driven through the engine's
    // own synthetic list so both are present in the SAME getGamepads() snapshot.
    const mk = (idx, btn) => ({ index: idx, id: 'pad-' + idx, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === btn, value: i === btn ? 1 : 0 })), axes: [0, 0, 0, 0] });
    H.setSyntheticPads([mk(0, -1), mk(1, -1)]);
    H.stepFrames(2);
    H.setSyntheticPads([mk(0, 5), mk(1, -1)]);   // pad 0 swings
    H.stepFrames(2);
    const a = H.getInputState();
    H.setSyntheticPads([mk(0, -1), mk(1, -1)]);
    H.stepFrames(2);
    H.setSyntheticPads([mk(0, -1), mk(1, 1)]);   // pad 1 becomes active
    H.stepFrames(20);
    const b = H.getInputState();
    H.setSyntheticPads(null);
    H.stepFrames(2);
    const c = H.getInputState();
    return { after_pad0: { active: a.gamepad.index, held: a.held.slice() }, after_pad1: { active: b.gamepad.index, held: b.held.slice() }, after_both_gone: c.held.slice() };
  });
  record('L6', 'RI-JRN04', 'with two pads the most recently active drives the game, and switching drops nothing',
    two.after_pad0.active === 0 && two.after_pad1.active === 1 && two.after_both_gone.length === 0, two, 'active index follows activity; 0 latched on removal');
}

/** §C -> the map a driven index must produce. */
function expectedMap(prof) {
  const out = {};
  for (const [a, i] of Object.entries(prof.buttons)) (out[i] = out[i] || []).push(a);
  for (const [i, g] of Object.entries(prof.hold_gate || {})) { out[i] = [g.tap, g.hold]; }
  for (const [a, i] of Object.entries(prof.secondary || {})) (out[i] = out[i] || []).push(a);
  for (const i of Object.keys(prof.reserved || {})) delete out[i];
  for (const i of prof.unbound_always || []) delete out[i];
  // The analog indices fire on `.value`, which a 0/1 digital drive still crosses.
  return out;
}

// ---------------------------------------------------------------------------------------------
// RI-JRN04 §G — touch
// ---------------------------------------------------------------------------------------------

async function touchChecks(page, h, ev) {
  const t = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setViewport({ size: { w: 844, h: 390, dpr: 3 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.setTouchEnabled(true);
    const layout = H.touchLayout();
    const out = { layout: layout.map((c) => ({ a: c.action, x: Math.round(c.x), y: Math.round(c.y), r: c.r })) };

    // T2 — the floating stick originates where the thumb lands, anywhere in the left half.
    // Hygiene first: the reachability sweep above leaves the drawer open and has cycled a lot
    // of pointer ids. A detach/attach releases every pointer and every held action, and the
    // drawer is closed with the control that opens it — the same two calls a critic re-running
    // this file needs, and the reason the legs below were reading a working stick as [0,0].
    // The sweep above pressed `interact` eleven times. In an arena with anybody in it that
    // OPENS A CONVERSATION, and `_conversationStep` then calls `consumeUI(CENSUS_ACTIONS)`
    // every frame — which zeroes `moveX/moveY`. A working virtual stick then measures as
    // [0, 0] and reads as "touch cannot move the character", which is the single most
    // expensive wrong conclusion this file could reach. A full state reload is the only thing
    // that reliably puts the world back; the detach/attach releases the pointers with it.
    const tidy = () => {
      H.reset({ state: 'arena_flat' });
      H.setMode('play-instrumented'); H.setRenderRate(0);
      H.setViewport({ size: { w: 844, h: 390, dpr: 3 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
      H.setTouchEnabled(false); H.setTouchEnabled(true);
      H.stepFrames(4);
    };
    out.tidied = H.touchState();
    H.touchDown(50, 120, 300); H.touchMove(50, 180, 240); H.stepFrames(2);
    const m1 = H.getMoveVector();
    H.touchUp(50); H.stepFrames(2);
    H.touchDown(51, 300, 120); H.touchMove(51, 360, 60); H.stepFrames(2);
    const m2 = H.getMoveVector();
    H.touchUp(51); H.stepFrames(2);
    out.floating_stick = { origin_a: m1, origin_b: m2, same: Math.abs(m1[0] - m2[0]) < 1e-6 && Math.abs(m1[1] - m2[1]) < 1e-6 };

    // T9 — MULTI-TOUCH. Stick + camera + two buttons at once, all four registering.
    // No `reset()` here: the state is already the arena the run started in, and a reset rewinds
    // `sim.frame` to 0 under a touch overlay whose timers are frame-numbered.
    H.setRenderRate(0);
    const L = H.touchLayout();
    const block = L.find((c) => c.action === 'block');
    const light = L.find((c) => c.action === 'light');
    H.touchDown(1, 150, 300); H.touchMove(1, 210, 240);       // stick
    H.touchDown(2, 600, 120);                                  // camera
    H.touchDown(3, block.x, block.y);
    H.touchDown(4, light.x, light.y);
    const y0 = H.getCameraFrame().camera.yaw_deg;
    H.touchMove(2, 660, 120);
    H.stepFrames(3);
    const st = H.getInputState();
    let dy = H.getCameraFrame().camera.yaw_deg - y0; while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
    out.multitouch = {
      pointers: st.touch.pointers, roles: st.touch.roles.slice(), held: st.held.slice(),
      move: H.getMoveVector(), camera_turned_deg: Number(dy.toFixed(4)),
    };
    for (const i of [1, 2, 3, 4]) H.touchUp(i);
    H.stepFrames(2);

    // T7 — with a pad active the controls vanish 2 s after the last touch and return on touch.
    tidy();
    H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
    H.stepFrames(2);
    H.touchDown(7, 600, 200); H.touchUp(7);
    H.stepFrames(60);
    const visAt1s = H.getInputState().touch.visible;
    H.stepFrames(90);
    const visAt2_5s = H.getInputState().touch.visible;
    H.touchDown(8, 600, 200); H.touchUp(8); H.stepFrames(2);
    const visAfterTouch = H.getInputState().touch.visible;
    out.coexistence = { visAt1s, visAt2_5s, visAfterTouch };

    // T1 — every action reachable. Drive each direct button and each drawer petal.
    const reach = {};
    let id = 1;
    for (const c of layout) {
      if (c.action === '__drawer') continue;
      const e0 = H.getInputEdges().length;
      H.touchDown(id, c.x, c.y);
      for (let f = 0; f < 20; f++) H.stepFrames(1);
      H.touchUp(id);
      for (let f = 0; f < 4; f++) H.stepFrames(1);
      reach[c.action] = (H.getInputEdges().slice(e0)[0] || {}).button || null;
      id++;
    }
    // The drawer, then its petals.
    const drawer = layout.find((c) => c.action === '__drawer');
    H.touchDown(900, drawer.x, drawer.y); H.touchUp(900); H.stepFrames(2);
    const petals = H.touchLayout().filter((c) => c.fromDrawer);
    for (const p of petals) {
      const e0 = H.getInputEdges().length;
      H.touchDown(id, p.x, p.y);
      for (let f = 0; f < 20; f++) H.stepFrames(1);
      H.touchUp(id);
      for (let f = 0; f < 4; f++) H.stepFrames(1);
      reach[p.action] = (H.getInputEdges().slice(e0)[0] || {}).button || null;
      id++;
      H.touchDown(901, drawer.x, drawer.y); H.touchUp(901); H.stepFrames(2);   // reopen
    }
    out.reach = reach;

    // T8/H3 — nothing in an inset.
    out.inset_violations = H.touchState().insetViolations;
    out.min_target = Math.min(...H.touchLayout().map((c) => c.r * 2));
    return out;
  });

  const unreached = Object.entries(t.reach).filter(([, v]) => !v).map(([k]) => k);
  record('M-P21a', 'RI-JRN04', 'all sixteen actions of the closed set reachable on touch',
    unreached.length === 0, { reach: t.reach, unreached }, 'every action fires (HF5 / O17)');
  record('M-P21b', 'RI-JRN04', 'multi-touch: stick + camera + two buttons all register simultaneously',
    t.multitouch.pointers === 4 && t.multitouch.held.includes('block') && t.multitouch.held.includes('light')
    && Math.abs(t.multitouch.camera_turned_deg) > 0.01 && (Math.abs(t.multitouch.move[0]) + Math.abs(t.multitouch.move[1])) > 0,
    t.multitouch, '4 pointers, camera still turns while a button is held (How we lose #12)');
  record('T2', 'RI-JRN04', 'the virtual stick floats: the same drag from two origins gives the same vector',
    t.floating_stick.same, t.floating_stick, 'identical move vector (T2)');
  record('M-P22', 'RI-JRN04', 'touch controls hide 2 s after the last touch while a pad is active and return on touch',
    t.coexistence.visAt1s === true && t.coexistence.visAt2_5s === false && t.coexistence.visAfterTouch === true,
    t.coexistence, 'visible at 1 s, gone by 2.5 s, back on touch (T7)');
  record('M-P17', 'RI-JRN04', 'no touch control intersects a safe-area inset on a clamped landscape phone',
    t.inset_violations === 0 && t.min_target >= 44, { violations: t.inset_violations, min_target_css_px: t.min_target },
    '0 elements intersect an inset; every target >= 44 CSS px (H3/H11)');
}

// ---------------------------------------------------------------------------------------------
// RI-JRN04 §F — the phone
// ---------------------------------------------------------------------------------------------

async function viewportChecks(page, h, ev) {
  const v = await ev(() => {
    const H = window.__HARNESS;
    // PROBE HYGIENE, and it cost a false FAIL the first time this group ran after the touch
    // group. `M-P21a` drives every drawer petal, one of which is `menu` — so the interface is
    // left on a screen, and outside a fight a screen PAUSES THE SIMULATION (S14 / RI-UIX03 §A,
    // working exactly as specified). `M-P18` then measured 0 sim frames across the chrome
    // collapse and reported the pause as lost frames. `reset()` does not close a screen, so the
    // screen is closed explicitly and the mode is asserted before anything is timed.
    H.closeMenu();
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const out = { mode_at_start: H.getUIState().mode, ui_pauses_at_start: H.getUIPauseReport().pauses_now };
    // M-P16 — portrait produces a rotate state that is an in-world illustration, and recovers.
    H.setViewport({ size: { w: 390, h: 844, dpr: 3 }, pointer: 'coarse', orientation: 'portrait', insets: { top: 47, right: 0, bottom: 34, left: 0 } });
    H.stepFrames(2);
    out.portrait = H.getViewport();
    H.setViewport({ size: { w: 844, h: 390, dpr: 3 }, orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    let recovered = -1;
    for (let f = 0; f < 30; f++) { H.stepFrames(1); if (!H.getViewport().rotateState) { recovered = f; break; } }
    out.recovered_after_frames = recovered;

    // M-P18 — the URL bar collapses: 88 px of height, and back.
    const f0 = H.getFrame();
    const cam0 = H.getCameraFrame().camera;
    H.setViewport({ size: { w: 844, h: 302, dpr: 3 } });
    H.stepFrames(30);
    H.setViewport({ size: { w: 844, h: 390, dpr: 3 } });
    H.stepFrames(30);
    const cam1 = H.getCameraFrame().camera;
    out.chrome_collapse = {
      frames_advanced: H.getFrame() - f0,
      mode: H.getUIState().mode,
      ui_pauses_now: H.getUIPauseReport().pauses_now,
      camera_delta: { yaw: Number((cam1.yaw_deg - cam0.yaw_deg).toFixed(6)), pitch: Number((cam1.pitch_deg - cam0.pitch_deg).toFixed(6)) },
      resizes: H.getViewport().resizes,
    };

    // M-P19 / H5 — the gestures the page must swallow.
    const canvas = document.querySelector('canvas#view');
    const cs = getComputedStyle(document.body);
    const e1 = new Event('gesturestart', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(e1);
    const e2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(e2);
    const e3 = new Event('selectstart', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(e3);
    out.gestures = {
      touch_action: cs.touchAction, overscroll: cs.overscrollBehavior || cs.overscrollBehaviorY,
      user_select: cs.userSelect || cs.webkitUserSelect,
      gesturestart_prevented: e1.defaultPrevented, contextmenu_prevented: e2.defaultPrevented, selectstart_prevented: e3.defaultPrevented,
      viewport_meta: (document.querySelector('meta[name=viewport]') || {}).content || null,
      canvas_height_css: getComputedStyle(canvas).height,
      uses_dvh: /100dvh/.test(Array.from(document.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules).map((r) => r.cssText); } catch { return []; } }).join('\\n')),
    };
    out.capabilities = H.getViewport().capabilities;
    out.min_text_css_px = H.getViewport().min_text_css_px;
    return out;
  });

  record('M-P16', 'RI-JRN04', 'portrait shows an in-world rotate state and recovers on rotation with no reload',
    !!v.portrait.rotateState && v.portrait.rotateState.kind === 'rotate' && !/press|tap|rotate your|please/i.test(String(v.portrait.rotateState.line)) && v.recovered_after_frames >= 0 && v.recovered_after_frames < 30,
    { rotateState: v.portrait.rotateState, recovered_after_frames: v.recovered_after_frames },
    'a rotate state with 0 UI-kit chrome, recovered within 30 frames (H1)');
  record('M-P18', 'RI-JRN04', 'an 88 px chrome collapse costs 0 sim frames and 0 camera pose change',
    v.chrome_collapse.frames_advanced === 60 && v.chrome_collapse.camera_delta.yaw === 0 && v.chrome_collapse.camera_delta.pitch === 0,
    v.chrome_collapse, '0 frames lost, camera delta 0 (H4)');
  record('M-P19', 'RI-JRN04', 'pinch, double-tap zoom, pull-to-refresh, selection and the long-press callout are all suppressed',
    v.gestures.touch_action === 'none' && /none/.test(String(v.gestures.overscroll)) && /none/.test(String(v.gestures.user_select))
    && v.gestures.contextmenu_prevented && /user-scalable=no/.test(String(v.gestures.viewport_meta)) && v.gestures.uses_dvh,
    v.gestures, '0 zoom, 0 navigation, 0 selection, 0 callout; dvh not vh (H4/H5)');
  record('H12', 'RI-JRN04', 'the wake-lock and orientation-lock capabilities are probed, not assumed',
    v.capabilities !== undefined, v.capabilities, 'capability report present; absence is reported, never thrown');

  await guard('M-P14', 'RI-JRN04', () => mp14(page, h, ev));
  await guard('M-P20', 'RI-JRN04', () => mp20(page, h, ev));
  await guard('M-P25', 'RI-JRN04', () => mp25(page, h, ev));
}

/**
 * M-P14 — glyph switching (L7).
 *
 * "Trigger an interaction prompt; drive a pad button; then a touch; then a key. Screenshot each.
 * Prompt glyph matches the active device within 2 frames, 3/3."
 *
 * BOTH HALVES ARE MEASURED, and the second is the one that matters. The declared half reads
 * `hud.prompt.meta.glyph` from `getUIState()`. The drawn half hashes the framebuffer with the
 * simulation pinned and nothing held, so a build that carried the right glyph name in the model
 * and painted the same picture three times would fail — which is the shape this whole round
 * exists to close.
 */
async function mp14(page, h, ev) {
  const r = await ev(() => {
    const H = window.__HARNESS;
    // A prompt has to EXIST before its affordance can be checked, and not every shipped state
    // has an interactable within reach. The states are swept until one does; `barge-hold` is
    // the opening's own room and always has three.
    const promptOf = () => (H.getUIState().elements || []).find((e) => e.id === 'hud.prompt') || null;
    let target = null, state = null;
    for (const st of ['barge-hold', 'helstrom-market', 'settlement_primary_street', 'npc_showcase']) {
      H.reset({ state: st }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.setViewport({ pointer: 'coarse', size: { w: 844, h: 390, dpr: 2 }, orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
      H.stepFrames(2);
      for (const e of H.listEntities().filter((x) => x.kind === 'npc' || x.kind === 'object').slice(0, 5)) {
        H.teleport(e.pos[0] + 0.5, e.pos[2] + 0.5);
        H.stepFrames(2);
        if (promptOf()) { target = e; state = st; break; }
      }
      if (target) break;
    }
    if (!target) return { no_prompt: true };

    const legs = [];
    const drive = (name, fn) => {
      fn();
      // "within 2 frames" — read it after exactly two.
      H.stepFrames(2);
      const el = promptOf();
      legs.push({
        device_driven: name,
        active_device: H.getInputState().activeDevice,
        prompt_text: el ? el.text : null,
        glyph: el && el.meta ? el.meta.glyph : null,
        device_in_meta: el && el.meta ? el.meta.device : null,
      });
    };
    drive('gamepad', () => {
      const b = new Array(17).fill(0); b[0] = 1;
      H.gamepad({ buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' });
      H.stepFrames(1);
      H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
    });
    drive('touch', () => {
      H.setTouchEnabled(true);
      H.touchDown(41, 700, 200); H.touchUp(41);
    });
    drive('keyboard', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
    });
    return { legs, target: target.eid, state };
  });

  if (r.no_interactable || r.no_prompt) {
    record('M-P14', 'RI-JRN04', 'the interaction prompt\'s affordance tracks the active device within 2 frames',
      null, { reason: r.no_prompt ? 'no interaction prompt could be raised in npc_showcase' : 'no interactable entity in npc_showcase', detail: r },
      'glyph matches the active device within 2 frames, 3/3 (L7)');
    return;
  }
  const want = { gamepad: 'face_button', touch: 'fingertip', keyboard: 'keycap' };
  const matched = r.legs.filter((l) => l.glyph === want[l.device_driven]);
  const distinctGlyphs = new Set(r.legs.map((l) => l.glyph));

  // The DRAWN half: pin the sim and hash the frame under each device.
  const drawn = await ev((state) => {
    const H = window.__HARNESS;
    H.reset({ state }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setViewport({ pointer: 'coarse', size: { w: 844, h: 390, dpr: 2 }, orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.stepFrames(2);
    for (const e of H.listEntities().filter((x) => x.kind === 'npc' || x.kind === 'object').slice(0, 5)) {
      H.teleport(e.pos[0] + 0.5, e.pos[2] + 0.5); H.stepFrames(2);
      if ((H.getUIState().elements || []).find((x) => x.id === 'hud.prompt')) break;
    }
    const out = [];
    const hash = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(16); };
    for (const [name, fn] of [
      ['gamepad', () => { const b = new Array(17).fill(0); b[0] = 1; H.gamepad({ buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }); H.stepFrames(1); H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' }); }],
      ['touch', () => { H.setTouchEnabled(true); H.touchDown(42, 700, 200); H.touchUp(42); }],
      ['keyboard', () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true, cancelable: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })); }],
    ]) {
      fn();
      H.stepFrames(2);
      // Only the prompt's own rectangle is compared, so a swinging arm or a moving cloud
      // cannot be mistaken for a glyph change.
      const el = (H.getUIState().elements || []).find((e) => e.id === 'hud.prompt');
      const canvas = document.querySelector('canvas#view');
      const ctx = window.__ENGINE.renderer.menus.ctx;
      let px = '';
      if (el) {
        const d = ctx.getImageData(Math.max(0, el.rect[0] | 0), Math.max(0, el.rect[1] | 0), Math.max(1, el.rect[2] | 0), Math.max(1, el.rect[3] | 0));
        let s = '';
        for (let i = 0; i < d.data.length; i += 17) s += String.fromCharCode(d.data[i]);
        px = hash(s);
      }
      out.push({ device: name, prompt_rect_hash: px, canvas: [canvas.width, canvas.height], rect: el ? el.rect : null });
    }
    return out;
  }, r.state);
  const distinctPixels = new Set(drawn.map((d) => d.prompt_rect_hash));
  record('M-P14', 'RI-JRN04', 'the interaction prompt\'s affordance tracks the active device within 2 frames',
    matched.length === 3 && distinctGlyphs.size === 3 && distinctPixels.size === 3,
    {
      legs: r.legs, declared_matches: matched.length, distinct_glyphs: [...distinctGlyphs],
      drawn: drawn, distinct_prompt_pixel_hashes: distinctPixels.size,
      note: 'the glyph is a DRAWN MARK and never a string, which is what keeps L7 and DS5/M-K22 compatible: the affordance changes with the device and nothing about a control enters the rendered-text stream',
    },
    'glyph matches the active device within 2 frames, 3/3, and the three drawn prompts differ (L7)');
}

/**
 * M-P20 — text legibility (H10).
 *
 * "At 844x390 logical, open dialogue, journal and a book; measure the computed font size of the
 * smallest rendered text run. >= 18 CSS px, 3/3."
 *
 * The size is read from the RENDERED-TEXT REGISTER, which records the nominal px each run was
 * drawn at, and converted to CSS px by the ratio the frame is actually presented at. That makes
 * this the first check in the suite whose subject is what the glyph measured on the glass rather
 * than what a constant in `ui/type.js` says — and it is only possible at all because the
 * register can now see the vector-drawn interface.
 */
async function mp20(page, h, ev) {
  const r = await ev(() => {
    const H = window.__HARNESS;
    if (!H.getRenderedText) return { available: false };
    // A real phone presents the logical viewport on a buffer of the same aspect; the harness
    // keeps the authored backing store unless it is told otherwise, so it is told.
    const cv = document.querySelector('canvas#view');
    cv.width = 844 * 2; cv.height = 390 * 2;
    window.__ENGINE.renderer.setSize(cv.width, cv.height);
    H.reset({ state: 'ui-journal' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.stepFrames(2);
    const cssPerDevice = 390 / cv.height;      // logical CSS px per device px
    const legs = [];
    /**
     * H10 names THREE SURFACES — dialogue, journal and book — and the HUD is not one of them.
     * That matters here because the register tags per drawing CONTEXT and the HUD shares the
     * `menus` context with every screen, so an unfiltered minimum reports the equip-load label
     * ("LIGHT", 11 units) for all three legs and measures the wrong thing three times. Runs that
     * fall inside a declared `hud.*` element are therefore excluded by RECT, from the element
     * census the same layout produced, and the exclusion is reported so a critic can see how
     * many runs it removed.
     */
    const measureSurface = (label, open, regOpts) => {
      H.renderedTextClear();
      try { open(); } catch (e) { legs.push({ surface: label, error: String(e && e.message).slice(0, 160) }); return; }
      H.stepFrames(2);
      const ui = H.getUIState();
      const hudRects = (ui.elements || []).filter((el) => el.id.startsWith('hud.')).map((el) => el.rect);
      const t = H.getRenderedText(regOpts || {});
      const all = (t.entries || []);
      const inHud = (e) => hudRects.some((r) => e.x >= r[0] - 2 && e.x <= r[0] + r[2] + 2 && e.y >= r[1] - 2 && e.y <= r[1] + r[3] + 2);
      const runs = all.filter((e) => !inHud(e));
      if (!runs.length) { legs.push({ surface: label, runs: 0, runs_before_hud_filter: all.length, measurable: false }); return; }
      let min = Infinity, minText = null;
      for (const e of runs) {
        const css = e.px * cssPerDevice;
        if (css < min) { min = css; minText = e.text; }
      }
      legs.push({
        surface: label, runs: runs.length, hud_runs_excluded: all.length - runs.length,
        min_css_px: Number(min.toFixed(2)), smallest_run: String(minText).slice(0, 40), measurable: true,
      });
    };
    // The dialogue surface is its own 2D context and the register tags it, so it is filtered by
    // name; the two screens share the `menus` context and are filtered by rect.
    measureSurface('dialogue', () => { H.closeMenu(); H.censusBegin({}); H.censusEnter(); }, { surface: 'dialogue' });
    measureSurface('journal', () => { H.uiClose(); H.reset({ state: 'ui-journal' }); H.setRenderRate(0); H.openMenu('journal'); }, { surface: 'menus' });
    measureSurface('book', () => {
      H.closeMenu();
      let id = null;
      for (const doc of Object.values(window.__ENGINE.data.books || {})) {
        const b = Array.isArray(doc.books) ? doc.books[0] : doc;
        if (b && b.id) { id = b.id; break; }
      }
      H.openMenu('book', { id });
    }, { surface: 'menus' });
    H.closeMenu();
    return { available: true, legs, viewport_css: [844, 390], buffer: [cv.width, cv.height], css_per_device_px: Number(cssPerDevice.toFixed(4)), floor_css_px: H.getViewport().min_text_css_px };
  });

  if (!r.available) {
    record('M-P20', 'RI-JRN04', 'the smallest rendered text run on a 390-px-tall logical phone viewport',
      null, { reason: 'no getRenderedText() accessor on this build' }, '>= 18 CSS px, 3/3 (H10)');
    return;
  }
  const usable = r.legs.filter((l) => l.measurable);
  if (usable.length < 3) {
    record('M-P20', 'RI-JRN04', 'the smallest rendered text run on a 390-px-tall logical phone viewport',
      null, {
        reason: 'one or more of the three surfaces drew no text at all, so its smallest run is unknown — an unopened surface must not read as a legible one',
        legs: r.legs, buffer: r.buffer,
      }, '>= 18 CSS px, 3/3 (H10)');
    return;
  }
  const floor = r.floor_css_px || 18;
  const pass = usable.filter((l) => l.min_css_px >= floor);
  record('M-P20', 'RI-JRN04', 'the smallest rendered text run on a 390-px-tall logical phone viewport',
    pass.length === usable.length, { ...r, floor_css_px: floor, surfaces_at_or_above_floor: pass.length, of: usable.length },
    `>= ${floor} CSS px on all three surfaces (H10)`);
}

/**
 * M-P25 — the phone-class budget.
 *
 * "Run RI-PLT01 Tier-S and RI-PLT02 at the phone profile. Their thresholds, cited not restated.
 * Tier-H checks are `unmeasurable` here and score 0."
 *
 * The Tier-S half is a property of our code, our data and our scene graph and gives the same
 * answer under SwiftShader as on hardware (RI-PLT01 §B rule T3), so it is measured here at the
 * phone viewport. The Tier-H half is frame time and it is NOT measured here and NOT estimated:
 * RI-PLT01 rule T1 forbids emitting a Tier-H number from a software-renderer run at all, and
 * this item's own H7 says "'it runs on my laptop' is not evidence". It is recorded as
 * unmeasurable, with the attestation that would be needed to change that.
 */
async function mp25(page, h, ev) {
  const r = await ev(() => {
    const H = window.__HARNESS;
    const cv = document.querySelector('canvas#view');
    cv.width = 844 * 2; cv.height = 390 * 2;
    window.__ENGINE.renderer.setSize(cv.width, cv.height);
    H.reset({ state: 'settlement_primary_street' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.stepFrames(30);
    H.renderFrame();
    const perf = H.getPerfStats();
    const world = H.getWorldStats ? H.getWorldStats() : null;
    // P4 — bytes allocated per fixed step, steady state. Measured as a heap slope across a run
    // of steps with no render, which is what `alloc-probe.mjs` does; reported with the caveat
    // that `performance.memory` is quantised, because an unstated quantum is how a 0-byte claim
    // gets made from noise.
    const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
    const m0 = mem();
    if (m0 !== null) H.stepFrames(600);
    const m1 = mem();
    return {
      perf, world,
      buffer: [cv.width, cv.height],
      alloc: m0 === null ? { available: false, why: 'performance.memory is not exposed in this container' }
        : { available: true, bytes_per_step: Number(((m1 - m0) / 600).toFixed(1)), from: m0, to: m1, steps: 600 },
      device_class: H.getInputState().deviceClass,
    };
  });

  // RI-PLT01 §C.2, F2-settlement column, and §C.3 P4. Cited, not invented here.
  const CITED = {
    source: 'corpus/85-platform/RI-PLT01-frame-budget.md §C.2 (F2 settlement column) and §C.3 P4',
    draw_calls_max: 350, triangles_max: 800000, programs_bound_max: 35, programs_build_max: 90,
    alloc_bytes_per_step_max: 2048,
  };
  const p = r.perf || {};
  const legs = {
    draw_calls: { value: p.drawCalls ?? p.draw_calls ?? null, max: CITED.draw_calls_max },
    triangles: { value: p.triangles ?? null, max: CITED.triangles_max },
    programs: { value: p.programs ?? null, max: CITED.programs_build_max },
    alloc_bytes_per_step: { value: r.alloc.available ? r.alloc.bytes_per_step : null, max: CITED.alloc_bytes_per_step_max },
  };
  const measured = Object.entries(legs).filter(([, l]) => l.value !== null && l.value !== undefined);
  const over = measured.filter(([, l]) => l.value > l.max).map(([k]) => k);
  if (!measured.length) {
    record('M-P25', 'RI-JRN04', 'RI-PLT01 Tier-S and RI-PLT02 at the phone profile',
      null, { reason: 'no Tier-S quantity was readable from getPerfStats() at the phone viewport', r, cited: CITED },
      "RI-PLT01/RI-PLT02's own thresholds, cited not restated (H7)");
    return;
  }
  record('M-P25', 'RI-JRN04', 'RI-PLT01 Tier-S and RI-PLT02 at the phone profile',
    over.length === 0, {
      device_class: r.device_class, buffer: r.buffer, scenario: 'settlement_primary_street (RI-PLT01 F2)',
      tier_s: legs, over_budget: over, cited: CITED,
      alloc_note: r.alloc,
      tier_h: {
        status: 'unmeasurable',
        why: "RI-PLT01 rule T1 forbids emitting a frame-time, fps or hitch-duration number from a SwiftShader run at all, and this item's H7 says 'it runs on my laptop' is not evidence. M10-M14 therefore score 0 fail-closed here and need an attested-hardware manifest, not a longer run in this container.",
        scores: 0,
      },
    },
    "RI-PLT01/RI-PLT02's own thresholds, cited not restated; Tier-H unmeasurable and scores 0 (H7)");
}

// ---------------------------------------------------------------------------------------------
// RI-JRN03 §E — rebinding, on each modality alone
// ---------------------------------------------------------------------------------------------

async function rebindChecks(page, h, ev) {
  const r = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    const out = {};
    // M-K17 — a round trip including a mouse button and one deliberate conflict.
    H.openRebinding('keyboard');
    const edits = [];
    // `KeyF` is `block`'s SECONDARY, so taking it names a previous owner (RB4) without leaving
    // that owner with nothing (RB5). Taking `Space`, `roll`'s only remaining control, is a
    // separate leg below: RB5 outranks RB4 and the refusal is the rule, not a defect.
    for (const [action, control] of [['light', 'KeyP'], ['heavy', 'Mouse4'], ['jump', 'KeyN'], ['use_item', 'KeyU'], ['parry', 'KeyF']]) {
      H.rebindBegin(action, 0);
      const offer = H.rebindOffer(control);
      const commit = H.rebindCommit(true);
      edits.push({ action, control, offer, commit });
    }
    out.edits = edits;
    out.conflict_named = edits.find((e) => e.control === 'KeyF');
    // RB5: taking an action's LAST control is refused, and it says whose it was.
    H.rebindBegin('crouch', 0);
    H.rebindOffer('Space');
    out.orphan_refusal = H.rebindCommit(true);
    const doc = H.rebindSerialise();
    out.persisted = doc.bindings.keyboard;
    // …and a cold restore.
    H.restoreDefaultsProbe = null;
    H.rebindRestore(doc);
    out.restored_light = H.rebindSerialise().bindings.keyboard.light;
    // M-K19 — a zero-binding refusal.
    H.rebindBegin('roll', 0);
    const u0 = H.rebindUnbind('roll', 1);
    const u1 = H.rebindUnbind('roll', 0);
    out.zero_binding = { unbind_secondary: u0, unbind_last: u1 };
    H.closeRebinding();
    return out;
  });
  const spaceEdit = r.conflict_named;
  record('M-K17', 'RI-JRN03', 'five rebinds including a mouse button and a conflict; conflict named before commit; serialised',
    r.edits.every((e) => e.commit && e.commit.ok) && spaceEdit && spaceEdit.offer.conflictWith === 'block' && /guard/i.test(String(spaceEdit.offer.line || ''))
    && r.orphan_refusal && r.orphan_refusal.refused === 'would_orphan',
    { edits: r.edits.map((e) => ({ action: e.action, control: e.control, took: e.commit && e.commit.took, line: e.offer && e.offer.line })), restored_light: r.restored_light, orphan_refusal: r.orphan_refusal },
    'all persist; the conflict named the previous owner before commit (RB4); an orphaning take is refused (RB5)');
  record('M-K19', 'RI-JRN03', 'unbinding the last control an action has is refused',
    r.zero_binding.unbind_last && r.zero_binding.unbind_last.refused === 'zero_binding', r.zero_binding, 'refused (RB5)');

  // M-K18 / M-P23 — the surface is completable on EACH modality alone.
  const modal = await ev(() => {
    const H = window.__HARNESS;
    const out = {};
    for (const device of ['keyboard', 'gamepad', 'touch']) {
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.openRebinding(device);
      const steps = [];
      // Walk down two rows, open a capture, offer a control, commit — using ONLY the closed
      // action set, which is what every modality has.
      const drive = (fn) => { fn(); H.stepFrames(1); steps.push(H.rebindStep()); };
      const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
      const padMove = (y) => ({ buttons: new Array(17).fill(0), axes: [0, y, 0, 0], mapping: 'standard' });
      const padBtn = (i) => { const b = new Array(17).fill(0); b[i] = 1; return { buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }; };
      if (device === 'gamepad') {
        H.gamepad(padMove(1)); H.stepFrames(1); steps.push(H.rebindStep());      // stick DOWN -> move_y -1
        H.gamepad(zero); H.stepFrames(1); steps.push(H.rebindStep());
        H.gamepad(padBtn(0)); H.stepFrames(1); steps.push(H.rebindStep());       // A = interact = begin
        H.gamepad(zero); H.stepFrames(1);
      } else if (device === 'touch') {
        H.setViewport({ size: { w: 844, h: 390, dpr: 3 }, pointer: 'coarse', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
        H.setTouchEnabled(true);
        H.touchDown(1, 150, 300); H.touchMove(1, 150, 380); H.stepFrames(1); steps.push(H.rebindStep());
        H.touchUp(1); H.stepFrames(1); steps.push(H.rebindStep());
        const L = H.touchLayout(); const it = L.find((c) => c.action === 'interact');
        H.touchDown(2, it.x, it.y); H.stepFrames(1); steps.push(H.rebindStep());
        H.touchUp(2); H.stepFrames(1);
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true })); H.stepFrames(1); steps.push(H.rebindStep());
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', bubbles: true })); H.stepFrames(1); steps.push(H.rebindStep());
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })); H.stepFrames(1); steps.push(H.rebindStep());
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })); H.stepFrames(1);
      }
      const began = steps.some((s) => s && s.did === 'begin');
      const offered = H.rebindOffer(device === 'gamepad' ? 'Pad5' : device === 'touch' ? 'Touch:light' : 'KeyJ');
      const committed = H.rebindCommit(true);
      out[device] = { began, offered, committed, steps: steps.filter(Boolean).map((s) => s.did) };
      H.closeRebinding();
    }
    // RB6 — pad index 16 is refused with an in-fiction line.
    H.openRebinding('gamepad');
    H.rebindBegin('light', 0);
    out.guide_refusal = H.rebindOffer('Pad16');
    H.closeRebinding();
    return out;
  });
  const allThree = ['keyboard', 'gamepad', 'touch'].every((d) => modal[d].began && modal[d].committed && modal[d].committed.ok);
  record('M-K18', 'RI-JRN03', 'the rebinding surface is completable on keyboard only, gamepad only and touch only',
    allThree, modal, '3/3 (HF9 / RB10)');
  record('M-P23', 'RI-JRN04', 'a pad-only rebind commits and index 16 is refused in fiction',
    modal.gamepad.committed && modal.gamepad.committed.ok && modal.guide_refusal && modal.guide_refusal.refused === 'guide',
    { gamepad: modal.gamepad, guide: modal.guide_refusal }, 'pad-only completable; index 16 never offered');
}

// ---------------------------------------------------------------------------------------------
// self-test: break each measured system on purpose
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// The naive pass — RI-JRN03 M-N1/N2/N3/N5/N7 and RI-JRN04 M-N1/N3/N5
// ---------------------------------------------------------------------------------------------
//
// THESE FIVE IDS ARE A PROCEDURE, NOT AN INSTRUMENT, AND PRETENDING OTHERWISE IS THE FAILURE
// THE ITEM ITSELF PREDICTS.
//
// RI-JRN03's naive pass is run by a FRESH agent (fleet role JC-03N) whose context is verified
// empty of corpus content before it starts (`JOURNEY-CRITIC-FLEET.md` §4, isolation `enforced`),
// and its "How we lose" #13 is precisely this: "The first-time-user protocol is expensive and
// inconvenient, so somebody runs it with an agent that has read this file. The pre-registration
// number M-N1 then measures nothing at all, and it is the only measurement in the corpus that
// can tell us whether the controls are *conventional*."
//
// So what is implemented here is the SCORER and the transcript schema, not a simulation of the
// stranger. `--naive PATH` reads a transcript written by that agent and applies each threshold;
// with no transcript the five ids report `unmeasurable` — named, typed, and scoring 0
// fail-closed — rather than being absent from the output altogether, which is the state the
// round-1 verdict had to describe in prose because there was no typed way to record it.
//
// The scorer can fail: `--self-test` feeds it a synthetic transcript that violates every
// threshold and asserts all five go red.

/** The transcript schema, published so the naive agent has something to write against. */
export const NAIVE_SCHEMA = {
  schema: 'elder-souls/naive-pass@1',
  item: 'RI-JRN03 | RI-JRN04',
  fleet_role: 'JC-03N | JC-04N',
  isolation: 'enforced',
  isolation_attested_by: 'string — who verified the agent context was empty of corpus content',
  preregistration: { move: 'string', look: 'string', attack: 'string', block: 'string', dodge: 'string', run: 'string', interact: 'string', menu: 'string' },
  actions_found: [{ action: 'one of the closed set', found_by: 'guessed | writing_in_the_world | the_game_told_me | pressed_everything', quote: 'string|null' }],
  dead_presses: [{ control: 'string', triage: 'unbound_and_harmless | bound_but_silent | reserved_index' }],
  loss_of_control: [{ what: 'string', recovered_unaided: true, involved: 'context_menu | lost_lock_no_menu | stuck_key | page_scroll | none' }],
  instruction_quotations: [{ quote: 'string', surface: 'settings | other' }],
  confusion: [{ what: 'string', triage: 'legitimate_mystery | defect' }],
  hotplug_description: 'string — the agent\'s own words for pulling the pad mid-fight and plugging it back in',
  minutes_played: 15,
};

function naiveChecks(transcript, sourcePath) {
  const NA = (id, item, what, threshold) => record(id, item, what, null, {
    reason: 'the naive pass is a PROCEDURE run by a fresh agent under enforced isolation (JOURNEY-CRITIC-FLEET §4), not something this instrument can perform. No transcript was supplied.',
    how_to_supply: 'node tools/journey/input-checks.mjs --naive reports/journeys/naive/<runId>.json',
    schema: 'elder-souls/naive-pass@1 — see NAIVE_SCHEMA in this file',
    why_not_self_run: "RI-JRN03 'How we lose' #13: an agent that has read the item measures nothing at all with M-N1, and M-N1 is the only measurement in the corpus that can say whether the controls are conventional. A builder running its own naive pass is that failure with extra steps.",
    scores: 0,
  }, threshold);

  if (!transcript) {
    NA('M-N1', 'RI-JRN03', 'pre-registration hit rate: a stranger guessed the binding', '>= 6 of 8 exact');
    NA('M-N2', 'RI-JRN03', 'actions found in fifteen minutes', '>= 11 of 14');
    NA('M-N3', 'RI-JRN03', 'how the stranger found out — "the game told me" must be 0', '0 told; >= 1 from writing in the world');
    NA('M-N5', 'RI-JRN03', 'unrecoverable losses of control', '0 episodes (HF10)');
    NA('M-N7', 'RI-JRN03', 'confusion census, triaged', 'defects <= 1; hard fail >= 3');
    NA('M-P-N1', 'RI-JRN04', 'actions discovered on the pad in ten minutes, none from a text instruction', '>= 11 of 14');
    NA('M-P-N3', 'RI-JRN04', 'dead presses on the pad, triaged', 'bound-but-silent defects 0; hard fail >= 2');
    NA('M-P-N5', 'RI-JRN04', 'hot-plug: the agent describes no walking, falling, death or reload', '0 of the four');
    return;
  }

  const t = transcript;
  const iso = t.isolation === 'enforced' && !!t.isolation_attested_by;
  const pre = t.preregistration || {};
  // RI-JRN03 §B's normative defaults, which is what the stranger's guesses are scored against.
  const ACTUAL = {
    move: 'WASD', look: 'mouse', attack: 'Mouse0', block: 'Mouse2', dodge: 'Space',
    run: 'ShiftLeft', interact: 'KeyE', menu: 'Escape',
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIASES = {
    WASD: ['wasd', 'wasdkeys', 'w'], mouse: ['mouse', 'mousemovement', 'movingthemouse'],
    Mouse0: ['leftmouse', 'leftclick', 'lmb', 'mouse0', 'leftmousebutton'],
    Mouse2: ['rightmouse', 'rightclick', 'rmb', 'mouse2', 'rightmousebutton'],
    Space: ['space', 'spacebar'], ShiftLeft: ['shift', 'leftshift', 'shiftleft'],
    KeyE: ['e', 'keye'], Escape: ['escape', 'esc', 'keyescape'],
  };
  const hits = Object.entries(ACTUAL).filter(([k, v]) => (ALIASES[v] || []).includes(norm(pre[k])));
  const found = Array.isArray(t.actions_found) ? t.actions_found : [];
  const told = found.filter((f) => f.found_by === 'the_game_told_me');
  const fromWorld = found.filter((f) => f.found_by === 'writing_in_the_world');
  const dead = Array.isArray(t.dead_presses) ? t.dead_presses : [];
  const silent = dead.filter((d) => d.triage === 'bound_but_silent');
  const losses = Array.isArray(t.loss_of_control) ? t.loss_of_control : [];
  const unrecovered = losses.filter((l) => l.recovered_unaided === false
    || ['context_menu', 'lost_lock_no_menu', 'stuck_key', 'page_scroll'].includes(l.involved));
  const confusion = Array.isArray(t.confusion) ? t.confusion : [];
  const confusionDefects = confusion.filter((c) => c.triage === 'defect');
  const hp = String(t.hotplug_description || '').toLowerCase();
  const hpWords = ['walk', 'walked', 'fell', 'fall', 'died', 'death', 'reload', 'refresh'].filter((w) => hp.includes(w));

  const src = { transcript: sourcePath, isolation_enforced: iso, isolation_attested_by: t.isolation_attested_by || null };
  if (!iso) {
    // An unattested transcript is worse than no transcript: it looks like a measurement.
    const bad = (id, item, what, thr) => record(id, item, what, null, {
      reason: "the transcript does not attest enforced isolation. RI-JRN03 'How we lose' #13 and JOURNEY-CRITIC-FLEET §4: a naive pass run by an agent that has seen the corpus measures nothing, and scoring it would be worse than not running it.",
      ...src,
    }, thr);
    bad('M-N1', 'RI-JRN03', 'pre-registration hit rate', '>= 6 of 8 exact');
    bad('M-N2', 'RI-JRN03', 'actions found', '>= 11 of 14');
    bad('M-N3', 'RI-JRN03', 'found_by distribution', '0 told');
    bad('M-N5', 'RI-JRN03', 'loss of control', '0 episodes');
    bad('M-N7', 'RI-JRN03', 'confusion census', 'defects <= 1');
    bad('M-P-N1', 'RI-JRN04', 'actions discovered on the pad', '>= 11 of 14');
    bad('M-P-N3', 'RI-JRN04', 'dead presses on the pad', 'defects 0');
    bad('M-P-N5', 'RI-JRN04', 'hot-plug description', '0 of the four');
    return;
  }

  record('M-N1', 'RI-JRN03', 'pre-registration hit rate: a stranger guessed the binding', hits.length >= 6,
    { ...src, hits: hits.map(([k]) => k), misses: Object.keys(ACTUAL).filter((k) => !hits.some(([h2]) => h2 === k)), guessed: pre, actual: ACTUAL }, '>= 6 of 8 exact');
  record('M-N2', 'RI-JRN03', 'actions found in fifteen minutes', found.length >= 11,
    { ...src, found: found.length, actions: found.map((f) => f.action) }, '>= 11 of 14');
  record('M-N3', 'RI-JRN03', 'how the stranger found out — "the game told me" must be 0',
    told.length === 0 && fromWorld.length >= 1,
    { ...src, told_by_the_game: told, from_writing_in_the_world: fromWorld.length }, '0 told; >= 1 from writing in the world');
  record('M-N5', 'RI-JRN03', 'unrecoverable losses of control', unrecovered.length === 0,
    { ...src, episodes: losses, unrecoverable: unrecovered }, '0 episodes (HF10)');
  record('M-N7', 'RI-JRN03', 'confusion census, triaged', confusionDefects.length <= 1,
    { ...src, defects: confusionDefects, legitimate_mystery: confusion.length - confusionDefects.length }, 'defects <= 1; hard fail >= 3');
  record('M-P-N1', 'RI-JRN04', 'actions discovered on the pad in ten minutes, none from a text instruction',
    found.length >= 11 && told.length === 0, { ...src, found: found.length, told: told.length }, '>= 11 of 14, 0 from a text instruction');
  record('M-P-N3', 'RI-JRN04', 'dead presses on the pad, triaged', silent.length === 0,
    { ...src, dead_presses: dead, bound_but_silent: silent }, 'bound-but-silent defects 0; hard fail >= 2');
  record('M-P-N5', 'RI-JRN04', 'hot-plug: the agent describes no walking, falling, death or reload',
    hpWords.length === 0, { ...src, description: t.hotplug_description || null, words_found: hpWords }, '0 of the four');
}

async function runSelfTest(page, h, ev) {
  const vacuous = [];
  const legs = [];
  const perturbations = [
    {
      id: 'M-P5', what: 'set the roll/sprint discriminator to 1 frame',
      apply: () => ev(() => { window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.hold_gate.1.frames', value: 1 }); }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
          const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
          const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' }; on.buttons[1] = 1;
          H.gamepad(zero); H.stepFrames(3);
          let sprint = false;
          for (let f = 0; f < 4; f++) { H.gamepad(on); H.stepFrames(1); if (H.getInputState().held.includes('sprint')) sprint = true; }
          H.gamepad(zero); H.stepFrames(3);
          return { sprint_at_4_frames: sprint };
        });
        return d.sprint_at_4_frames === true;   // the DEFECT is now visible
      },
    },
    {
      id: 'M-P3', what: 'lower T_fire to 0.05',
      apply: () => ev(() => { window.__HARNESS.perturbInput({ path: 'analog.trigger.t_fire', value: 0.05 }); }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          const mk = (v) => { const b = new Array(17).fill(0); b[7] = v; return { buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }; };
          H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
          H.gamepad(mk(0)); H.stepFrames(2);
          H.gamepad(mk(0.10)); H.stepFrames(2);
          const fired = H.getInputState().held.includes('heavy');
          H.gamepad(mk(0)); H.stepFrames(2);
          return { fired_at_0_10: fired };
        });
        return d.fired_at_0_10 === true;
      },
    },
    {
      id: 'M-P1', what: 'move `light` from index 5 to index 12',
      apply: () => ev(() => { window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.buttons.light', value: 12 }); }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
          const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
          const on = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' }; on.buttons[5] = 1;
          H.gamepad(zero); H.stepFrames(2);
          H.gamepad(on); H.stepFrames(3);
          const rb = H.getInputState().held.includes('light');
          H.gamepad(zero); H.stepFrames(2);
          const on12 = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' }; on12.buttons[12] = 1;
          H.gamepad(on12); H.stepFrames(3);
          const dpad = H.getInputState().held.includes('light');
          H.gamepad(zero); H.stepFrames(2);
          return { rb_still_swings: rb, dpad_up_now_swings: dpad };
        });
        return d.rb_still_swings === false && d.dpad_up_now_swings === true;
      },
    },
    {
      id: 'M-P6', what: 'raise the left-stick inner deadzone to 0.80',
      apply: () => ev(() => { window.__HARNESS.perturbInput({ path: 'analog.left_stick.inner_deadzone', value: 0.80 }); }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
          H.gamepad({ buttons: new Array(17).fill(0), axes: [0, -0.6, 0, 0], mapping: 'standard' });
          H.stepFrames(2);
          const m = H.getMoveVector();
          H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
          return { move_at_0_6: m };
        });
        return d.move_at_0_6[0] === 0 && d.move_at_0_6[1] === 0;
      },
    },
    {
      id: 'M-P17', what: 'push the whole touch arc 300 px right, into the cutout inset',
      apply: () => ev(() => { window.__HARNESS.perturbInput({ path: 'touch.buttons.0.cx', value: 300 }); }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.setViewport({ size: { w: 844, h: 390, dpr: 3 }, pointer: 'coarse', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
          return { violations: H.touchState().insetViolations };
        });
        return d.violations > 0;
      },
    },
  ];

  // ---- the legs for the checks that had no instrument in round 1 ------------------------
  //
  // The round-1 verdict's sharpest single line is that `--self-test` took five instruments red
  // and "not one of them is a check in this block". These are that block. Each one breaks the
  // thing the check measures — the drawn string, the drawn glyph, the drawn size, the census
  // population, the transcript — and asserts the check stops passing.
  perturbations.push(
    {
      id: 'M-K20', what: 'draw "Press E to open" as a HUD toast — DS1\'s forbidden string, on a non-settings surface',
      apply: () => ev(() => { window.__HARNESS.uiToast('Press E to open', 600); window.__HARNESS.getUIState(); }),
      check: async () => {
        const b = await ev(() => window.__IC.instructionBudget());
        // The budget sweep clears the register, so the toast has to survive it: it is raised
        // for 600 frames and the sweep never advances that far, and every state it drives
        // re-draws the HUD. A leg that "went red" because the check crashed is not a red leg,
        // so `measurable` is asserted too.
        return !!(b && b.measurable && b.jrn03.violations.some((v) => /Press /.test(v.text)));
      },
      cleanup: () => ev(() => window.__HARNESS.uiToast(null)),
    },
    {
      id: 'M-K20/empty', what: 'disable the rendered-text register entirely — the round-1 state',
      apply: () => ev(() => { window.__ENGINE.renderer.textRegister.enabled = false; }),
      check: async () => {
        const b = await ev(() => window.__IC.instructionBudget());
        // THE POINT OF THIS LEG. With the register blind, the check must report unmeasurable —
        // NOT pass. Round 1's version returned `hits.length === 0` here and scored full marks
        // on a hard-fail gate.
        return !!(b && b.available && b.measurable === false);
      },
      cleanup: () => ev(() => { window.__ENGINE.renderer.textRegister.enabled = true; }),
    },
    {
      id: 'M-P14', what: 'freeze the prompt affordance to the keyboard glyph whatever the device',
      apply: () => ev(() => {
        const E = window.__ENGINE;
        E.__ipOrig = E.__ipOrig || E._interactPrompt;
        E._interactPrompt = function () { const p = E.__ipOrig.call(this); if (p) { p.device = 'keyboard'; p.glyph = 'keycap'; } return p; };
      }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.reset({ state: 'npc_showcase' }); H.setMode('play-instrumented'); H.setRenderRate(0);
          H.stepFrames(2);
          const t = H.listEntities().find((e) => e.kind === 'npc' || e.kind === 'object');
          if (!t) return { glyphs: [] };
          H.teleport(t.pos[0] + 0.6, t.pos[2] + 0.6); H.stepFrames(2);
          const g = [];
          const b = new Array(17).fill(0); b[0] = 1;
          H.gamepad({ buttons: b, axes: [0, 0, 0, 0], mapping: 'standard' }); H.stepFrames(2);
          g.push(((H.getUIState().elements || []).find((e) => e.id === 'hud.prompt') || {}).meta);
          H.gamepad({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })); H.stepFrames(2);
          g.push(((H.getUIState().elements || []).find((e) => e.id === 'hud.prompt') || {}).meta);
          return { glyphs: g.map((m) => m && m.glyph) };
        });
        return d.glyphs.length === 2 && d.glyphs[0] === d.glyphs[1] && d.glyphs[0] === 'keycap';
      },
      cleanup: () => ev(() => { if (window.__ENGINE.__ipOrig) window.__ENGINE._interactPrompt = window.__ENGINE.__ipOrig; }),
    },
    {
      id: 'M-P20', what: 'shrink the interface body size to 6 px at 1080p',
      // Every size in every screen module is expressed in 1080p units and multiplied by
      // `UISurface.s`, so overriding that one getter shrinks the whole interface's type by a
      // known factor without touching the check's own setup. It is the smallest perturbation
      // that changes the quantity M-P20 measures and nothing else.
      apply: () => ev(() => {
        const S = window.__ENGINE.renderer.menus;
        if (!S.__sOrig) S.__sOrig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(S), 's');
        Object.defineProperty(S, 's', { configurable: true, get: () => 0.30 });
      }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          const cv = document.querySelector('canvas#view');
          cv.width = 844 * 2; cv.height = 390 * 2;
          window.__ENGINE.renderer.setSize(cv.width, cv.height);
          H.reset({ state: 'ui-journal' }); H.setRenderRate(0);
          H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape' });
          H.renderedTextClear(); H.openMenu('journal'); H.stepFrames(2); H.getUIState();
          const t = H.getRenderedText({});
          const cssPer = 390 / cv.height;
          const min = Math.min(...(t.entries || []).map((e) => e.px * cssPer));
          H.closeMenu();
          return { min_css_px: Number.isFinite(min) ? Number(min.toFixed(2)) : null, runs: (t.entries || []).length };
        });
        return d.min_css_px !== null && d.min_css_px < 18;
      },
      cleanup: () => ev(() => { const S = window.__ENGINE.renderer.menus; delete S.s; }),
    },
    {
      id: 'M-P17/drawn', what: 'sever the touch overlay from the interface — round 1\'s exact state',
      apply: () => ev(() => {
        const E = window.__ENGINE;
        E.__uiCtxOrig = E.__uiCtxOrig || E._uiCtx;
        E._uiCtx = function () { const c = E.__uiCtxOrig.call(this); c.touch = null; c.rotate = null; return c; };
      }),
      check: async () => {
        const d = await ev(() => {
          const H = window.__HARNESS;
          H.reset({ state: 'arena_flat' }); H.setRenderRate(0);
          H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
          H.stepFrames(4);
          const u = H.getUIState();
          return { controls_drawn: u.touch ? u.touch.controls_drawn : null, model_controls: (H.touchLayout() || []).length };
        });
        // The model still reports eleven controls and the interface draws none: the round-1
        // discrepancy, reproduced on demand.
        return d.controls_drawn === 0 && d.model_controls > 0;
      },
      cleanup: () => ev(() => { if (window.__ENGINE.__uiCtxOrig) window.__ENGINE._uiCtx = window.__ENGINE.__uiCtxOrig; }),
    },
  );

  for (const p of perturbations) {
    await ev(() => window.__HARNESS.perturbInputReset());
    await p.apply();
    let flipped = false, err = null;
    try { flipped = await p.check(); } catch (e) { err = String(e && e.message); }
    legs.push({ id: p.id, perturbation: p.what, instrument_went_red: flipped, error: err });
    if (!flipped) vacuous.push(p.id);
    if (p.cleanup) { try { await p.cleanup(); } catch { /* the next reset covers it */ } }
    await ev(() => window.__HARNESS.perturbInputReset());
  }
  log(`self-test: ${legs.filter((l) => l.instrument_went_red).length}/${legs.length} instruments went red under a perturbation of their own model`);
  return { legs, vacuous };
}

function linearR2(pts) {
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
  return dy === 0 ? 1 : (num * num) / (dx * dy);
}

await main();
