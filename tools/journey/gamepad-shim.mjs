#!/usr/bin/env node
// gamepad-shim.mjs — A-JRN2. Inject pad descriptors at the `navigator.getGamepads()` seam.
//
// Named by: RI-JRN01 M13 (descriptor leg), RI-JRN04, RI-MTH06 §B.
//
// ROUND 2. TOOL-COVERAGE-R1 §2 rejected round 1 for three defects, all of them fixed here:
//   1. It hung on `page.reload({ waitUntil: 'load' })` — 3 of 3 attempts — because browser.mjs
//      performs the goto internally and the only way round 1 could get an init script in ahead
//      of it was to launch, install and reload. `launchGame` now takes `initScripts`, so the
//      shim rides in BEFORE the first navigation and there is no reload anywhere in this file.
//   2. It threw an uncaught TimeoutError with a raw Node stack instead of routing through
//      `die(EXIT.…)`. Every failure path here is a `die()` with a reason and an exit code.
//   3. A partial self-test printed nothing: PASS/FAIL lines were buffered and only written
//      after every case completed, so the null control's result was lost when a later case
//      crashed. Lines are now flushed as they are produced and a crash mid-battery still
//      leaves the evidence gathered so far on stdout.
//
// AND THE ONE THAT MATTERS MOST — the critic's requirement that it "drive the same
// pollGamepad() a physical pad drives, not a parallel path". `RealInput.pollGamepad()`
// (game/src/input/real.js:128) reads `navigator.getGamepads()` whenever `syntheticPads` is
// null, and `Engine.beforeTick` (engine.js:305) calls it every frame. A shim installed above
// `navigator.getGamepads` is therefore ON that path by construction — but "by construction" is
// the kind of claim this project has been caught by, so `--verify` now ALSO asserts it from the
// engine side: `__HARNESS.gamepadPoll()` must return an observation carrying the shimmed pad's
// own id and mapping, and moving the shim's left stick must move `__HARNESS.getMoveVector()`.
// A shim the page can see but the engine cannot is a shim that measures nothing.
//
// WHY THIS EXISTS AT ALL, given `__HARNESS.gamepad()`.
// RI-JRN01 §0.1(a) settles this and the reasoning is binding: `__HARNESS.gamepad(state)` calls
// `RealInput.pushGamepadState()`, which feeds the SAME `pollGamepad()` the engine's `beforeTick`
// calls for a physical pad. For the REACHABILITY legs — can the journey be completed on a pad —
// that harness verb is strictly better than a shim, because a shim in `tools/` can only simulate
// a path that already exists, and the item struck the `gamepad-shim.mjs` reference for those legs.
//
// What it did NOT strike, and what this file is for, is the DESCRIPTOR leg:
//   "`A-JRN2` requires injection at the `navigator.getGamepads()` seam and a `mapping:''`
//    non-standard descriptor, and this path is one layer inside that seam."
// `pushGamepadState()` sets `syntheticPads`, which makes `pollGamepad()` skip
// `navigator.getGamepads()` entirely, so it can never exercise the build's own descriptor code:
// a pad whose `mapping` is `''` (every HID pad Chromium does not recognise, which on Android
// includes the DualSense over Bluetooth) delivers its buttons in a different order, and the code
// that has to cope with that is the code between `navigator.getGamepads()` and the router. Only
// an injection ABOVE the seam reaches it.
//
// The project owner tests on a **GameSir X2s Type-C**, so that pad's two real descriptors are
// the shipped presets: `x2s-standard` (USB-C to Android, Chromium recognises it, W3C standard
// mapping) and `x2s-hid-dualsense` (the same physical pad presenting as a generic HID device
// with `mapping: ''`, which is what happens over Bluetooth and on desktop Chrome).
//
// EXIT CODES: 0 the shim installed and BOTH the page and the engine saw the pad; 1 they did not;
//             2 usage; 11 no harness; 12 a harness call threw; 20 the run could not be taken.
'use strict';

import { parseArgs, wantsHelp, usage, log, die, EXIT, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
gamepad-shim.mjs — A-JRN2: inject a pad descriptor at the navigator.getGamepads() seam.

USAGE
  node tools/journey/gamepad-shim.mjs --pad x2s-standard --verify
  node tools/journey/gamepad-shim.mjs --list
  node tools/journey/gamepad-shim.mjs --self-test

OPTIONS
  --pad ID        one of the presets below
  --list          print the presets and exit 0
  --verify        boot the game with the shim installed before the first navigation, and assert
                  (a) the PAGE observes the pad through navigator.getGamepads() with the
                      descriptor's own mapping string, and
                  (b) the ENGINE observes it through __HARNESS.gamepadPoll(), which is
                      RealInput.pollGamepad() — the same call the engine makes every frame for a
                      physical pad — and that moving the shim's stick moves getMoveVector().
  --break-direction
                  TEARDOWN for the DIRECTION half. Swaps the two movement axes at the seam, so
                  the distance walked is unchanged and only the BEARING is wrong. The scalar
                  entity-side check and its null control must stay GREEN and only the direction
                  check may go red — TOOL-COVERAGE-R3's uncharged note, "the check is dist(p0,p1)
                  — a scalar ... assert the DIRECTION, not just the distance."
  --break-router  install a SECOND init script that zeroes the axes where the engine's router
                  reads them, while gamepadPoll() keeps reporting a perfect observation. The
                  entity-side check must go RED and every descriptor/poll check must stay green
                  — TOOL-COVERAGE-R2 §7's "a pad that moves nothing passes 8/8".
  --hotplug       after --verify, disconnect and reconnect the pad and assert the page sees both
                  the gamepaddisconnected and gamepadconnected events and the engine drops it
  --self-test     the falsification battery. Includes a null control (an UNINSTALLED page must
                  report no pad), a mapping-preservation check, and the engine-side reachability
                  check above. Lines are flushed as they are produced.
  --out PATH      write the observation JSON
  --timeout MS    boot timeout (default 90000)

PRESETS
  x2s-standard        GameSir X2s Type-C over USB-C, Chromium standard mapping
  x2s-hid-dualsense   the same pad as a generic HID device, mapping: '' (Bluetooth / desktop)
  xbox-standard       a plain standard-mapping controller, as a control

NOTE
  This file is NOT the instrument for RI-JRN01 M13's REACHABILITY legs. Those use
  __HARNESS.gamepad(), which is the same pollGamepad() a physical pad drives; RI-JRN01 §0.1(a)
  struck the shim reference for them deliberately. This shim exists for the DESCRIPTOR leg,
  which lives above the navigator.getGamepads() seam and which __HARNESS.gamepad() cannot reach.
`;

// --- the descriptors -------------------------------------------------------------------------
export const PADS = {
  'x2s-standard': {
    id: 'GameSir-X2s Type-C (STANDARD GAMEPAD Vendor: 3537 Product: 1004)',
    mapping: 'standard',
    buttons: 17, axes: 4,
    note: 'USB-C into an Android phone. Chromium recognises the VID/PID and remaps to standard.',
  },
  'x2s-hid-dualsense': {
    id: 'GameSir-X2s Type-C (Vendor: 3537 Product: 1004)',
    mapping: '',
    buttons: 18, axes: 6,
    note: "The SAME physical pad presenting as generic HID. mapping is '' — button order is the " +
          'raw HID report order, not the W3C one. This is the descriptor the build has never seen.',
  },
  'xbox-standard': {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)',
    mapping: 'standard', buttons: 17, axes: 4,
    note: 'Control descriptor: if the build behaves differently under this and under ' +
          'x2s-standard, the difference is the id string and not the mapping.',
  },
};

/**
 * The page-side script. Installed with `page.addInitScript` BEFORE the first navigation, so it
 * is in place before the game's own scripts run and therefore before any listener the game
 * attaches and before `RealInput` first polls.
 *
 * It replaces `navigator.getGamepads` and dispatches the real `gamepadconnected` /
 * `gamepaddisconnected` events, so a build that listens for connection sees a connection.
 */
export function shimSource(desc, index = 0) {
  return `(() => {
    const D = ${JSON.stringify(desc)};
    const IDX = ${index};
    const mk = (connected) => connected ? {
      id: D.id, index: IDX, connected: true, mapping: D.mapping,
      timestamp: 0,
      axes: new Array(D.axes).fill(0),
      buttons: new Array(D.buttons).fill(0).map(() => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null,
    } : null;
    const state = { pad: mk(true) };
    window.__PAD_SHIM = {
      descriptor: D, index: IDX,
      /** Mutate the pad the way a physical pad mutates: a NEW snapshot object every poll, since
       *  gamepad.js §D warns that a cached Gamepad silently freezes input in Chrome. */
      set(partial) {
        if (!state.pad) return null;
        if (partial && Array.isArray(partial.axes)) {
          for (let i = 0; i < partial.axes.length && i < state.pad.axes.length; i++) state.pad.axes[i] = Number(partial.axes[i]) || 0;
        }
        if (partial && Array.isArray(partial.buttons)) {
          for (let i = 0; i < partial.buttons.length && i < state.pad.buttons.length; i++) {
            const v = partial.buttons[i];
            const pressed = typeof v === 'boolean' ? v : !!(v && v.pressed);
            state.pad.buttons[i] = { pressed, touched: pressed, value: pressed ? 1 : (typeof v === 'number' ? v : 0) };
          }
        }
        state.pad.timestamp += 1;
        return { axes: state.pad.axes.slice(), timestamp: state.pad.timestamp };
      },
      disconnect() {
        const gone = state.pad; state.pad = null;
        if (gone) window.dispatchEvent(new CustomEvent('gamepaddisconnected', { detail: { gamepad: gone } }));
        return true;
      },
      connect() {
        state.pad = mk(true);
        window.dispatchEvent(new CustomEvent('gamepadconnected', { detail: { gamepad: state.pad } }));
        return true;
      },
      observed: [],
    };
    const orig = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: function getGamepads() {
        window.__PAD_SHIM.observed.push(1);
        const real = (() => { try { return Array.from(orig() || []); } catch (e) { return []; } })()
          .filter((p) => p && p.index !== IDX);
        const out = [];
        // A fresh object per call, as the real API does.
        out[IDX] = state.pad ? {
          id: state.pad.id, index: state.pad.index, connected: true, mapping: state.pad.mapping,
          timestamp: state.pad.timestamp,
          axes: state.pad.axes.slice(),
          buttons: state.pad.buttons.map((b) => ({ pressed: b.pressed, touched: b.touched, value: b.value })),
          vibrationActuator: null,
        } : null;
        for (const p of real) out[p.index] = p;
        return out;
      },
    });
    // A build that attaches its listener before we run would otherwise miss the connection.
    setTimeout(() => {
      if (state.pad) window.dispatchEvent(new CustomEvent('gamepadconnected', { detail: { gamepad: state.pad } }));
    }, 0);
  })();`;
}

/** What the PAGE sees — not what we injected. This is the observation that counts. */
export async function observe(page) {
  return page.evaluate(() => {
    const pads = Array.from(navigator.getGamepads() || []).filter(Boolean);
    return {
      count: pads.length,
      pads: pads.map((p) => ({ id: p.id, index: p.index, mapping: p.mapping, buttons: p.buttons.length, axes: p.axes.length, connected: p.connected })),
      shim_installed: !!window.__PAD_SHIM,
      getgamepads_calls: (window.__PAD_SHIM && window.__PAD_SHIM.observed.length) || 0,
    };
  });
}

/**
 * Launch the game with the shim already installed. No reload: `initScripts` is applied before
 * `page.goto`, which is what round 1's reload was trying and failing to achieve.
 */
// THE FALSIFICATION HANDLE for the entity-side check, and it is the exact build TOOL-COVERAGE-R2
// §7 described: "a build whose pollGamepad() returns a perfect observation and whose router then
// discards the axes". Installed AFTER the shim, it zeroes the axes at the
// `navigator.getGamepads()` seam — where the engine's router reads them — while making
// `__HARNESS.gamepadPoll()` keep reporting the shim's real axes. Every descriptor and poll check
// stays green; only the world-side one may go red.
export const BREAK_ROUTER_SOURCE = `
(() => {
  const realGet = navigator.getGamepads.bind(navigator);
  // defineProperty, not assignment: the shim installs getGamepads with { value, configurable }
  // and no writable flag, so a plain assignment silently does nothing. Found by running this
  // falsification and watching it fail to falsify anything.
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: function getGamepads() {
      return Array.from(realGet() || []).map((p) => {
        if (!p) return p;
        return {
          id: p.id, index: p.index, connected: p.connected, mapping: p.mapping,
          timestamp: p.timestamp, buttons: p.buttons,
          axes: (p.axes || []).map(() => 0),   // the router receives a dead stick
        };
      });
    },
  });
  const patch = () => {
    const H = window.__HARNESS;
    if (!H || H.__routerBroken) return;
    H.__routerBroken = true;
    H.gamepadPoll = function () {
      // A perfect observation, reported by the input layer about itself.
      // realGet is the SHIM's getGamepads, captured before this file replaced it, so this
      // reports the true stick while the engine's router reads the zeroed one above.
      const p = Array.from(realGet() || []).filter(Boolean)[0];
      return p ? { id: p.id, mapping: p.mapping, axes: (p.axes || []).slice(), buttons: (p.buttons || []).map((b) => !!(b && b.pressed)), profile: 'souls-default' } : null;
    };
  };
  if (window.__HARNESS) patch();
  else { const t = setInterval(() => { if (window.__HARNESS) { patch(); clearInterval(t); } }, 5); setTimeout(() => clearInterval(t), 60000); }
})();
`;

// ROUND 3 (W1-GAMEPAD) — the teardown for the DIRECTION half of the entity-side check.
//
// TOOL-COVERAGE-R3 accepted this tool 12/12 and left one note uncharged, which is the note this
// source block exists to answer:
//
//   "Note, not charged: the check is dist(p0,p1) — a scalar. A router with inverted axes, or one
//    that walks a fixed heading regardless of stick direction, passes green and control both.
//    Assert the DIRECTION, not just the distance."
//
// `--break-router` cannot catch that class: it zeroes the axes, so the distance goes to 0 and the
// SCALAR check already goes red. To falsify a direction check you need a break that keeps the
// distance and destroys the bearing. This one SWAPS the two movement axes at the seam, so the
// stick's magnitude is untouched and every metre still gets walked — just at 90° to where the
// player pushed. Distance-only checks stay green; only `direction_matches` may go red.
export const BREAK_DIRECTION_SOURCE = `
(() => {
  const realGet = navigator.getGamepads.bind(navigator);
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: function getGamepads() {
      return Array.from(realGet() || []).map((p) => {
        if (!p) return p;
        const a = (p.axes || []).slice();
        // swap axis 0 and axis 1 — the same |magnitude|, a bearing rotated off the command.
        if (a.length >= 2) { const t = a[0]; a[0] = a[1]; a[1] = t; }
        return { id: p.id, index: p.index, connected: p.connected, mapping: p.mapping, timestamp: p.timestamp, buttons: p.buttons, axes: a };
      });
    },
  });
})();
`;

export async function launchGameWithShim(padId, opts = {}) {
  const desc = typeof padId === 'string' ? PADS[padId] : padId;
  if (!desc) die(EXIT.USAGE, `unknown pad preset ${JSON.stringify(padId)}. Known: ${Object.keys(PADS).join(', ')}`);
  const extra = [];
  if (opts.breakRouter) extra.push(BREAK_ROUTER_SOURCE);
  if (opts.breakDirection) extra.push(BREAK_DIRECTION_SOURCE);
  const handle = await launchGame({
    width: 320, height: 240,
    timeout: Number(opts.timeout || 90000),
    initScripts: [shimSource(desc, opts.index || 0), ...extra],
  });
  const installed = await handle.page.evaluate(() => !!window.__PAD_SHIM).catch(() => false);
  if (!installed) {
    await handle.close();
    die(EXIT.MEASUREMENT_FAIL,
      'the init script did not survive the navigation — window.__PAD_SHIM is absent after boot. ' +
      'The descriptor leg cannot be measured; nothing below this line would mean anything.');
  }
  handle.descriptor = desc;
  return handle;
}

/**
 * The engine-side half. `__HARNESS.gamepadPoll()` is `RealInput.pollGamepad()`, the exact call
 * `Engine.beforeTick` makes every frame for a physical pad. If the shim is on that path this
 * returns an observation naming the shimmed pad; if it is on a parallel path of our own
 * invention it returns null and the tool says so instead of reporting a green descriptor leg.
 */
async function engineSideCheck(handle) {
  const present = await handle.page.evaluate(
    () => !!(window.__HARNESS && typeof window.__HARNESS.gamepadPoll === 'function'));
  if (!present) {
    return { available: false, why: '__HARNESS.gamepadPoll is not on this build; the engine-side half of the descriptor leg cannot be taken.' };
  }
  const rest = await handle.h('gamepadPoll');
  // Move the left stick through the SHIM (not through __HARNESS.gamepad, which would set
  // syntheticPads and bypass navigator.getGamepads entirely — the parallel path this check
  // exists to rule out).
  await handle.page.evaluate(() => window.__PAD_SHIM.set({ axes: [0, -1, 0, 0] }));
  const pushed = await handle.h('gamepadPoll');
  const move = await handle.hOpt('getMoveVector');
  await handle.page.evaluate(() => window.__PAD_SHIM.set({ axes: [0, 0, 0, 0] }));
  const released = await handle.h('gamepadPoll');
  const moveRest = await handle.hOpt('getMoveVector');
  const idOf = (o) => (o && (o.id || (o.pad && o.pad.id) || (o.pads && o.pads[0] && o.pads[0].id))) || null;
  const axesOf = (o) => (o && (o.axes || (o.pad && o.pad.axes) || (o.snap && o.snap.axes))) || null;
  return {
    available: true,
    poll_at_rest: rest,
    poll_with_stick: pushed,
    poll_after_release: released,
    move_vector_with_stick: move,
    move_vector_at_rest: moveRest,
    engine_sees_pad: !!pushed,
    engine_sees_this_pad: idOf(pushed) === handle.descriptor.id || idOf(rest) === handle.descriptor.id,
    // The world-side quantity. `getMoveVector` is what the sim consumed, so a change here is the
    // shim reaching the simulation and not merely the input layer.
    stick_reaches_the_world: !!(move && moveRest
      && (Math.abs(move[0] - moveRest[0]) > 1e-6 || Math.abs(move[1] - moveRest[1]) > 1e-6)),
    axes_at_rest: axesOf(rest), axes_with_stick: axesOf(pushed),
    axes_changed_under_poll: JSON.stringify(axesOf(rest)) !== JSON.stringify(axesOf(pushed)),
  };
}

/**
 * THE ENTITY-SIDE CHECK. TOOL-COVERAGE-R2 §7, and it is the one thing all eight round-2 checks
 * had in common:
 *
 *   "None of them looks at the world. They observe navigator.getGamepads(), mapping, button and
 *    axis counts, descriptor strings, and gamepadPoll()'s RETURN VALUE. A build whose
 *    pollGamepad() returns a perfect observation and whose router then discards the axes passes
 *    8/8, and RI-JRN04 M13 is reported green for a pad that moves nothing."
 *
 * The standard is `journey-run.mjs`, in the next file in this directory: "it observes an
 * entity-side quantity (the player moved 2.24 m) rather than the model's own return value."
 *
 * So: hold the shim's stick, step frames, and read the PLAYER'S POSITION out of `snapshot()`.
 * With the null control the same file already carries elsewhere — stick at rest, same number of
 * frames, no drift — because a check that cannot exhibit the failure is not a control.
 *
 * `setMode('play-instrumented')` is required and is not a cheat: `core/loop.js` polls devices in
 * `beforeTick`, which runs on the rAF tick, and in mode `harness` the rAF tick returns before
 * advancing anything. The pad path this measures is the one a player uses. Note the null control
 * runs with the rAF loop LIVE, so "no drift" is a statement about an engine that was running.
 */
export async function entitySideCheck(handle, frames = 120) {
  const present = await handle.page.evaluate(
    () => !!(window.__HARNESS && typeof window.__HARNESS.snapshot === 'function'
             && typeof window.__HARNESS.setMode === 'function'));
  if (!present) {
    return { available: false, why: '__HARNESS.snapshot / setMode are not on this build, so the world-side half cannot be observed.' };
  }
  return handle.page.evaluate(async (n) => {
    const H = window.__HARNESS;
    const posOf = () => {
      const s = H.snapshot() || {};
      const p = s.player || {};
      return Array.isArray(p.pos) ? p.pos.slice() : [Number(p.x) || 0, 0, Number(p.z) || 0];
    };
    const dist = (a, b) => Math.hypot(b[0] - a[0], (b[2] || 0) - (a[2] || 0));
    const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      H.setRenderRate(0);                 // AGENT-PROTOCOL: never step with the renderer live
      H.setMode('play-instrumented');     // beforeTick polls devices only when the rAF tick runs

      const p0 = posOf();
      window.__PAD_SHIM.set({ axes: [0, -1, 0, 0] });   // left stick fully forward
      await twoFrames();
      H.stepFrames(n);
      const p1 = posOf();

      window.__PAD_SHIM.set({ axes: [0, 0, 0, 0] });    // NULL CONTROL: stick at rest
      await twoFrames();
      H.stepFrames(n);
      const p2 = posOf();

      // ---- DIRECTION (W1-GAMEPAD, closing TOOL-COVERAGE-R3's uncharged note) ----------------
      //
      // "the check is dist(p0,p1) — a scalar. A router with inverted axes, or one that walks a
      //  fixed heading regardless of stick direction, passes green and control both."
      //
      // Four bearings, each driven from the SAME starting point so the four displacements are
      // comparable, with the camera pinned to yaw 0 so "forward" is +z and "right" is +x. The
      // claim is not "it moved" but "it moved THERE": the stick is pushed in four different
      // directions and the four resulting bearings must be 90° apart in the right order.
      // A fixed-heading router gives four identical bearings; an axis-swapped one gives four
      // bearings rotated as a set. Both pass a distance check and both fail this.
      const bearings = [];
      let directionOk = null, worstErr = null;
      if (typeof H.teleport === 'function' && window.__ENGINE) {
        const home = window.__ENGINE.sim.player.pos.slice();
        const cases = [
          { name: 'forward', axes: [0, -1, 0, 0], want: 0 },
          { name: 'right', axes: [1, 0, 0, 0], want: 90 },
          { name: 'back', axes: [0, 1, 0, 0], want: 180 },
          { name: 'left', axes: [-1, 0, 0, 0], want: -90 },
        ];
        for (const c of cases) {
          H.teleport(home[0], home[2]);
          window.__ENGINE.sim.camera.yaw = 0;
          window.__PAD_SHIM.set({ axes: [0, 0, 0, 0] });
          await twoFrames();
          H.stepFrames(4);
          const a0 = posOf();
          window.__PAD_SHIM.set({ axes: c.axes });
          await twoFrames();
          H.stepFrames(45);
          const a1 = posOf();
          const dx = a1[0] - a0[0], dz = (a1[2] || 0) - (a0[2] || 0);
          const d = Math.hypot(dx, dz);
          const got = d > 0.05 ? Math.atan2(dx, dz) * 180 / Math.PI : null;
          const err = got === null ? null : +(((got - c.want + 540) % 360) - 180).toFixed(2);
          bearings.push({ pushed: c.name, commanded_deg: c.want, dist_m: +d.toFixed(4), heading_deg: got === null ? null : +got.toFixed(2), error_deg: err });
        }
        window.__PAD_SHIM.set({ axes: [0, 0, 0, 0] });
        H.teleport(home[0], home[2]);
        const usable = bearings.filter((b) => b.error_deg !== null);
        worstErr = usable.length ? Math.max(...usable.map((b) => Math.abs(b.error_deg))) : null;
        directionOk = usable.length === 4 && worstErr !== null && worstErr <= 10;
      }

      return {
        available: true, frames: n,
        pos_before: p0, pos_with_stick: p1, pos_after_release: p2,
        moved_m: +dist(p0, p1).toFixed(4),
        drift_m: +dist(p1, p2).toFixed(4),
        // The pad moved the player, and nothing else did.
        pad_moves_the_player: dist(p0, p1) > 0.25,
        null_control_holds: dist(p1, p2) <= 0.05,
        // ...and it moved the player WHERE THE STICK POINTED.
        bearings, direction_matches: directionOk, worst_bearing_error_deg: worstErr,
      };
    } catch (e) {
      return { available: false, why: 'the entity-side check threw: ' + String(e && e.message || e) };
    }
  }, frames);
}

async function verifyOne(padId, hotplug, opts = {}) {
  const handle = await launchGameWithShim(padId, opts);
  try {
    const seen = await observe(handle.page);
    const desc = PADS[padId];
    const match = seen.pads.find((p) => p.id === desc.id);
    const engine = await engineSideCheck(handle);
    const world = await entitySideCheck(handle, Number(opts.entityFrames || 120));
    const result = {
      pad: padId, descriptor: desc, observed: seen, engine, world,
      page_sees_pad: !!match,
      mapping_preserved: !!match && match.mapping === desc.mapping,
      buttons_preserved: !!match && match.buttons === desc.buttons,
      axes_preserved: !!match && match.axes === desc.axes,
      ok: !!match && match.mapping === desc.mapping && match.buttons === desc.buttons,
      hotplug: null,
      page_errors: handle.errors.slice(0, 5),
    };
    if (hotplug) {
      const events = await handle.page.evaluate(async () => {
        const seenEvents = [];
        const on = (e) => seenEvents.push(e.type);
        window.addEventListener('gamepadconnected', on);
        window.addEventListener('gamepaddisconnected', on);
        window.__PAD_SHIM.disconnect();
        await new Promise((r) => setTimeout(r, 30));
        const gone = Array.from(navigator.getGamepads() || []).filter(Boolean).length;
        window.__PAD_SHIM.connect();
        await new Promise((r) => setTimeout(r, 30));
        const back = Array.from(navigator.getGamepads() || []).filter(Boolean).length;
        return { log: seenEvents, gone, back };
      });
      result.hotplug = events;
      result.ok = result.ok && events.gone === 0 && events.back === 1
        && events.log.includes('gamepaddisconnected') && events.log.includes('gamepadconnected');
    }
    return result;
  } finally { await handle.close(); }
}

/**
 * The falsification battery. Every line is flushed as it is produced: an instrument that
 * discards the evidence it has already gathered when a later step fails is the wrong shape for
 * an instrument (TOOL-COVERAGE-R1 §2.3).
 */
async function selfTest(opts) {
  let n = 0, failed = 0;
  const ok = (name, pass, detail) => {
    n++; if (!pass) failed++;
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
  };
  const summarise = () => {
    process.stdout.write(`\ngamepad-shim self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${n - failed}/${n})\n`);
  };

  try {
    // Null control: no shim installed. The page must report no pad. If this "passes" with a pad
    // present, every later observation is meaningless.
    const bare = await launchGame({ width: 320, height: 240, timeout: Number(opts.timeout || 90000) });
    let bareSeen, bareEngine;
    try {
      bareSeen = await observe(bare.page);
      bareEngine = await bare.h('gamepadPoll');
    } finally { await bare.close(); }
    ok('null control: an UNINSTALLED page reports no pad',
      bareSeen.count === 0 && !bareSeen.shim_installed && !bareEngine,
      `uninstrumented page reports ${bareSeen.count} pad(s), shim_installed=${bareSeen.shim_installed}, ` +
      `engine gamepadPoll()=${JSON.stringify(bareEngine)}`);

    // Standard descriptor.
    const std = await verifyOne('x2s-standard', false, opts);
    ok('x2s-standard visible through navigator.getGamepads()', std.page_sees_pad,
      `page sees ${std.observed.count} pad(s): ${std.observed.pads.map((p) => p.id).join(', ') || '(none)'}`);
    ok('x2s-standard mapping preserved', std.mapping_preserved,
      `mapping=${JSON.stringify(std.observed.pads[0] && std.observed.pads[0].mapping)}`);

    // THE ENGINE-SIDE CHECK. A page-visible pad the engine cannot see is a parallel path.
    ok('the ENGINE sees the shimmed pad through RealInput.pollGamepad()',
      std.engine.available && std.engine.engine_sees_pad,
      std.engine.available
        ? `__HARNESS.gamepadPoll() returned ${std.engine.poll_with_stick ? 'an observation' : 'null'}; ` +
          `id match=${std.engine.engine_sees_this_pad}; axes at rest ${JSON.stringify(std.engine.axes_at_rest)} ` +
          `-> with stick ${JSON.stringify(std.engine.axes_with_stick)}`
        : std.engine.why);
    ok('moving the SHIM\'s stick moves what the engine polls',
      std.engine.available && std.engine.axes_changed_under_poll,
      `axes ${JSON.stringify(std.engine.axes_at_rest)} -> ${JSON.stringify(std.engine.axes_with_stick)} ` +
      `(driven through window.__PAD_SHIM.set, NOT through __HARNESS.gamepad, which would set ` +
      `syntheticPads and bypass navigator.getGamepads entirely)`);

    // THE ENTITY-SIDE CHECK (TOOL-COVERAGE-R2 §7). Everything above observes the input layer's
    // own report of itself. This one observes the WORLD: hold the stick, step frames, and read
    // where the player ended up. A build whose pollGamepad() returns a perfect observation and
    // whose router then discards the axes passes every check above and fails this one.
    ok('ENTITY-SIDE: holding the shim\'s stick MOVES THE PLAYER',
      std.world.available && std.world.pad_moves_the_player,
      std.world.available
        ? `player moved ${std.world.moved_m} m over ${std.world.frames} frames with the left stick ` +
          `fully forward, ${JSON.stringify(std.world.pos_before)} -> ${JSON.stringify(std.world.pos_with_stick)}. ` +
          `Driven through window.__PAD_SHIM.set, so the whole path from navigator.getGamepads() ` +
          `to the simulation is exercised.`
        : std.world.why);
    ok('NULL CONTROL: stick at rest, same frames, the player does not drift',
      std.world.available && std.world.null_control_holds,
      std.world.available
        ? `drift ${std.world.drift_m} m over ${std.world.frames} uncommanded frames with the rAF ` +
          `loop LIVE (mode play-instrumented), so "it moved" above is the pad and not the engine ` +
          `walking on its own`
        : std.world.why);

    // DIRECTION (W1-GAMEPAD round 3). TOOL-COVERAGE-R3 accepted this tool and left exactly one
    // note uncharged: "the check is dist(p0,p1) — a scalar. A router with inverted axes, or one
    // that walks a fixed heading regardless of stick direction, passes green and control both."
    // Four bearings from one starting point, and they must come back 90° apart in the right order.
    ok('ENTITY-SIDE: and the player goes WHERE THE STICK POINTS, not merely somewhere',
      std.world.available && std.world.direction_matches === true,
      std.world.available && std.world.bearings
        ? `${std.world.bearings.map((b) => `${b.pushed}: commanded ${b.commanded_deg}° got ${b.heading_deg}° (${b.dist_m} m)`).join('; ')} — ` +
          `worst error ${std.world.worst_bearing_error_deg}°`
        : std.world.why || 'no bearings collected');

    // RED. The exact build TOOL-COVERAGE-R2 §7 described: pollGamepad() returns a perfect
    // observation and the router discards the axes. Every check above must stay GREEN and only
    // the world-side one may go red — otherwise the entity-side check is just a second copy of
    // the input-layer check and adds nothing.
    const broken = await verifyOne('x2s-standard', false, { ...opts, breakRouter: true });
    ok('RED: with the router discarding the axes, the input-layer checks STILL PASS',
      broken.page_sees_pad && broken.mapping_preserved
      && broken.engine.available && broken.engine.axes_changed_under_poll,
      `page sees the pad, mapping preserved, gamepadPoll() axes ` +
      `${JSON.stringify(broken.engine.axes_at_rest)} -> ${JSON.stringify(broken.engine.axes_with_stick)} — ` +
      `all eight round-2 checks are satisfied by a pad that moves nothing`);
    ok('RED: and the ENTITY-SIDE check catches it — the player does not move',
      broken.world.available && broken.world.pad_moves_the_player === false
      && broken.world.null_control_holds,
      `player moved ${broken.world.moved_m} m with the stick fully forward (unbroken run: ` +
      `${std.world.moved_m} m). RI-JRN04 M13 would have been reported green for a pad that ` +
      `moves nothing.`);

    // RED, THE SECOND KIND — and it is a different kind, which is the whole point. `--break-router`
    // zeroes the axes, so the DISTANCE check already catches it and the direction check adds
    // nothing there. This break swaps the two movement axes: every metre is still walked, so the
    // scalar check and its null control both stay green, and only the bearing is wrong. That is
    // the failure TOOL-COVERAGE-R3 said would pass "green and control both" — so if the direction
    // check does not go red HERE, it is decoration.
    const bent = await verifyOne('x2s-standard', false, { ...opts, breakDirection: true });
    ok('RED: with the two stick axes SWAPPED, the distance check and its null control STILL PASS',
      bent.world.available && bent.world.pad_moves_the_player && bent.world.null_control_holds,
      `player moved ${bent.world.moved_m} m (unbroken run: ${std.world.moved_m} m) and drifted ` +
      `${bent.world.drift_m} m at rest — a scalar dist(p0,p1) check cannot tell this build from a ` +
      `correct one`);
    ok('RED: and the DIRECTION check catches it',
      bent.world.available && bent.world.direction_matches === false,
      bent.world.bearings
        ? `${bent.world.bearings.map((b) => `${b.pushed}: commanded ${b.commanded_deg}° got ${b.heading_deg}°`).join('; ')} — ` +
          `worst error ${bent.world.worst_bearing_error_deg}° (unbroken: ${std.world.worst_bearing_error_deg}°)`
        : 'no bearings collected');

    // The one that matters for the descriptor leg: a non-standard descriptor must NOT arrive
    // as 'standard'. If it does, the leg passes without the build's mapping code ever running.
    const hid = await verifyOne('x2s-hid-dualsense', true, opts);
    ok('x2s-hid-dualsense arrives with mapping "" and its own button count',
      !!(hid.observed.pads[0] && hid.observed.pads[0].mapping === '' && hid.observed.pads[0].buttons === 18),
      `mapping=${JSON.stringify(hid.observed.pads[0] && hid.observed.pads[0].mapping)}, ` +
      `buttons=${hid.observed.pads[0] && hid.observed.pads[0].buttons} (descriptor says 18), ` +
      `axes=${hid.observed.pads[0] && hid.observed.pads[0].axes} (descriptor says 6)`);
    ok('hot-plug fires both events and empties the pad list in between',
      !!(hid.hotplug && hid.hotplug.gone === 0 && hid.hotplug.back === 1
        && hid.hotplug.log.includes('gamepaddisconnected') && hid.hotplug.log.includes('gamepadconnected')),
      `disconnect->${hid.hotplug && hid.hotplug.gone} pads, reconnect->${hid.hotplug && hid.hotplug.back} pads, ` +
      `events ${JSON.stringify(hid.hotplug && hid.hotplug.log)}`);

    // A control on the control: two different standard pads must not be confused for each other.
    const xb = await verifyOne('xbox-standard', false, opts);
    ok('the descriptor is carried through verbatim, not normalised to a house default',
      !!(xb.observed.pads[0] && xb.observed.pads[0].id === PADS['xbox-standard'].id
         && xb.observed.pads[0].id !== PADS['x2s-standard'].id),
      `xbox-standard arrives as ${JSON.stringify(xb.observed.pads[0] && xb.observed.pads[0].id)}`);
  } catch (e) {
    // A crash mid-battery must not discard what has already been printed.
    summarise();
    die(EXIT.MEASUREMENT_FAIL,
      `the self-test could not complete: ${e && e.message || e}. The ${n} result(s) printed above ` +
      'were gathered before the failure and stand.',
      { stack: String(e && e.stack || '').split('\n').slice(0, 4).join(' | ') });
  }

  summarise();
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith('gamepad-shim.mjs');
if (isMain) {
  const args = parseArgs();
  if (wantsHelp(args)) usage(USAGE);
  // `--break-router` is the falsification handle for the entity-side check. It installs a second
  // init script that zeroes the axes where the engine's router reads them while `gamepadPoll()`
  // goes on reporting a perfect observation — the build TOOL-COVERAGE-R2 §7 said would pass 8/8.
  const opts = { timeout: args.timeout, breakRouter: !!args['break-router'], breakDirection: !!args['break-direction'] };

  if (args.list) {
    for (const [k, v] of Object.entries(PADS)) {
      process.stdout.write(`${k.padEnd(20)} mapping=${JSON.stringify(v.mapping).padEnd(12)} buttons=${v.buttons} axes=${v.axes}\n    ${v.note}\n`);
    }
    process.exit(0);
  }

  if (args['self-test']) {
    let code = 70;
    try { code = await selfTest(opts); }
    catch (e) { die(EXIT.INTERNAL, `gamepad-shim --self-test threw: ${e && e.message || e}`); }
    process.exit(code);
  }

  const padId = String(args.pad || 'x2s-standard');
  if (!PADS[padId]) die(EXIT.USAGE, `unknown --pad ${padId}. Known: ${Object.keys(PADS).join(', ')}`);
  if (!args.verify) {
    process.stdout.write(JSON.stringify(PADS[padId], null, 2) + '\n');
    process.stdout.write('(descriptor only — pass --verify to boot the game and assert the page AND the engine see it)\n');
    process.exit(0);
  }

  let out;
  try { out = await verifyOne(padId, !!args.hotplug, opts); }
  catch (e) {
    die(EXIT.MEASUREMENT_FAIL, `--verify could not complete for ${padId}: ${e && e.message || e}`,
      { stack: String(e && e.stack || '').split('\n').slice(0, 4).join(' | ') });
  }
  if (args.out) writeJson(String(args.out), out);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  if (!out.ok) log(`descriptor leg FAILED for ${padId}: page_sees_pad=${out.page_sees_pad} mapping_preserved=${out.mapping_preserved}`);
  process.exit(out.ok ? 0 : 1);
}
