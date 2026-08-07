#!/usr/bin/env node
// gamepad-shim.mjs — A-JRN2. Inject pad descriptors at the `navigator.getGamepads()` seam.
//
// Named by: RI-JRN01 M13 (descriptor leg), RI-JRN04, RI-MTH06 §B.
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
// `pushGamepadState()` is downstream of `navigator.getGamepads()`, so it can never exercise the
// build's own mapping code: a pad whose `mapping` is `''` (every HID pad Chromium does not
// recognise, which on Android includes the DualSense over Bluetooth) delivers its buttons in a
// different order, and the code that has to cope with that is the code between
// `navigator.getGamepads()` and `pollGamepad()`. Only an injection ABOVE the seam reaches it.
//
// The project owner tests on a **GameSir X2s Type-C**, so that pad's two real descriptors are
// the shipped presets: `x2s-standard` (USB-C to Android, Chromium recognises it, standard
// mapping) and `x2s-hid-dualsense` (the same physical pad presenting as a generic HID device
// with `mapping: ''`, which is what happens over Bluetooth and on desktop Chrome).
//
// EXIT CODES: 0 the shim installed and the page saw the pad; 1 the page did not see it;
//             2 usage; 11 no harness.
'use strict';

import { parseArgs, wantsHelp, usage, log, die, EXIT, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
gamepad-shim.mjs — A-JRN2: inject a pad descriptor at the navigator.getGamepads() seam.

USAGE
  node tools/journey/gamepad-shim.mjs --pad x2s-standard [--verify]
  node tools/journey/gamepad-shim.mjs --list
  node tools/journey/gamepad-shim.mjs --self-test

OPTIONS
  --pad ID        one of the presets below, or a JSON descriptor
  --list          print the presets and exit 0
  --verify        boot the game, install the shim, and assert the PAGE observes the pad
                  through navigator.getGamepads() with the descriptor's own mapping string
  --hotplug       after --verify, disconnect and reconnect the pad and assert the page sees
                  both the gamepadconnected and gamepaddisconnected events
  --self-test     prove the shim can fail: assert an UNINSTALLED page reports no pad, an
                  installed page reports one, and a non-standard descriptor is NOT reported
                  as 'standard'
  --out PATH      write the observation JSON

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
 * The page-side script. Installed with `page.addInitScript` so it is in place BEFORE the game's
 * own scripts run and therefore before any listener the game attaches.
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
      set(partial) {
        if (!state.pad) return null;
        if (partial && Array.isArray(partial.axes)) {
          for (let i = 0; i < partial.axes.length && i < state.pad.axes.length; i++) state.pad.axes[i] = partial.axes[i];
        }
        if (partial && Array.isArray(partial.buttons)) {
          for (let i = 0; i < partial.buttons.length && i < state.pad.buttons.length; i++) {
            const v = partial.buttons[i];
            const pressed = typeof v === 'boolean' ? v : !!(v && v.pressed);
            state.pad.buttons[i] = { pressed, touched: pressed, value: pressed ? 1 : (typeof v === 'number' ? v : 0) };
          }
        }
        state.pad.timestamp += 1;
        return state.pad;
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
        const real = (() => { try { return Array.from(orig() || []); } catch { return []; } })()
          .filter((p) => p && p.index !== IDX);
        const out = [];
        out[IDX] = state.pad;
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

/** Install the shim on a Playwright page. Must be called BEFORE page.goto(). */
export async function installShim(page, padId, index = 0) {
  const desc = typeof padId === 'string' ? PADS[padId] : padId;
  if (!desc) throw new Error(`unknown pad preset ${JSON.stringify(padId)}. Known: ${Object.keys(PADS).join(', ')}`);
  await page.addInitScript(shimSource(desc, index));
  return desc;
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

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith('gamepad-shim.mjs');
if (isMain) {
  const args = parseArgs();
  if (wantsHelp(args)) usage(USAGE);

  if (args.list) {
    for (const [k, v] of Object.entries(PADS)) {
      process.stdout.write(`${k.padEnd(20)} mapping=${JSON.stringify(v.mapping).padEnd(12)} buttons=${v.buttons} axes=${v.axes}\n    ${v.note}\n`);
    }
    process.exit(0);
  }

  if (args['self-test']) process.exit(await selfTest());

  const padId = String(args.pad || 'x2s-standard');
  if (!PADS[padId]) die(EXIT.USAGE, `unknown --pad ${padId}. Known: ${Object.keys(PADS).join(', ')}`);
  if (!args.verify) {
    process.stdout.write(JSON.stringify(PADS[padId], null, 2) + '\n');
    process.stdout.write('(descriptor only — pass --verify to boot the game and assert the page sees it)\n');
    process.exit(0);
  }

  const out = await verifyOne(padId, !!args.hotplug);
  if (args.out) writeJson(String(args.out), out);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(out.ok ? 0 : 1);
}

async function verifyOne(padId, hotplug) {
  const { chromium } = await import('playwright');
  void chromium;
  const handle = await launchGameWithShim(padId);
  try {
    const seen = await observe(handle.page);
    const desc = PADS[padId];
    const match = seen.pads.find((p) => p.id === desc.id);
    const result = {
      pad: padId, descriptor: desc, observed: seen,
      page_sees_pad: !!match,
      mapping_preserved: !!match && match.mapping === desc.mapping,
      ok: !!match && match.mapping === desc.mapping,
      hotplug: null,
    };
    if (hotplug) {
      const events = await handle.page.evaluate(async () => {
        const log = [];
        const on = (e) => log.push(e.type);
        window.addEventListener('gamepadconnected', on);
        window.addEventListener('gamepaddisconnected', on);
        window.__PAD_SHIM.disconnect();
        await new Promise((r) => setTimeout(r, 30));
        const gone = Array.from(navigator.getGamepads() || []).filter(Boolean).length;
        window.__PAD_SHIM.connect();
        await new Promise((r) => setTimeout(r, 30));
        const back = Array.from(navigator.getGamepads() || []).filter(Boolean).length;
        return { log, gone, back };
      });
      result.hotplug = events;
      result.ok = result.ok && events.gone === 0 && events.back === 1
        && events.log.includes('gamepaddisconnected') && events.log.includes('gamepadconnected');
    }
    return result;
  } finally { await handle.close(); }
}

/** launchGame installs nothing before goto, so the shim is installed via a pre-goto hook. */
async function launchGameWithShim(padId) {
  // browser.mjs performs the goto internally, so the shim must ride in on addInitScript before
  // it. The supported way is to patch the context after creation but before navigation — which
  // launchGame does not expose. So: launch, install, and RELOAD, which replays init scripts.
  const handle = await launchGame({ width: 320, height: 240 });
  await installShim(handle.page, padId);
  await handle.page.reload({ waitUntil: 'load' });
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 })
    .catch(() => die(EXIT.HARNESS_ABSENT, 'window.__HARNESS did not reappear after the shim reload'));
  return handle;
}

/**
 * The falsification. A shim that reports a pad on a page where it was never installed, or that
 * silently normalises a non-standard mapping to 'standard', is worse than no shim — it would
 * make the descriptor leg pass without ever exercising the build's mapping code.
 */
async function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  // Control: no shim installed. The page must report no pad. If this "passes" with a pad
  // present, every later observation is meaningless.
  const bare = await launchGame({ width: 320, height: 240 });
  let bareSeen;
  try { bareSeen = await observe(bare.page); } finally { await bare.close(); }
  ok('null control (no shim installed)', bareSeen.count === 0 && !bareSeen.shim_installed,
    `uninstrumented page reports ${bareSeen.count} pad(s), shim_installed=${bareSeen.shim_installed}`);

  // Standard descriptor.
  const std = await verifyOne('x2s-standard', false);
  ok('x2s-standard visible through navigator.getGamepads()', std.page_sees_pad,
    `page sees ${std.observed.count} pad(s): ${std.observed.pads.map((p) => p.id).join(', ') || '(none)'}`);
  ok('x2s-standard mapping preserved', std.observed.pads[0] && std.observed.pads[0].mapping === 'standard',
    `mapping=${JSON.stringify(std.observed.pads[0] && std.observed.pads[0].mapping)}`);

  // The one that matters: a non-standard descriptor must NOT arrive as 'standard'.
  const hid = await verifyOne('x2s-hid-dualsense', true);
  ok('x2s-hid-dualsense arrives with mapping ""', hid.observed.pads[0] && hid.observed.pads[0].mapping === '',
    `mapping=${JSON.stringify(hid.observed.pads[0] && hid.observed.pads[0].mapping)}, buttons=${hid.observed.pads[0] && hid.observed.pads[0].buttons}`);
  ok('hot-plug fires both events', !!(hid.hotplug && hid.hotplug.gone === 0 && hid.hotplug.back === 1),
    `disconnect->${hid.hotplug && hid.hotplug.gone} pads, reconnect->${hid.hotplug && hid.hotplug.back} pads, events ${JSON.stringify(hid.hotplug && hid.hotplug.log)}`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\ngamepad-shim self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
