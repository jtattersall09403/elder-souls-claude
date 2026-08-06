// CRITIC-OWNED probe 15: RI-JRN03 checks that are runnable in this container, taken myself.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
const out = process.argv[2];
const h = await launchGame({});
const page = h.page;
const o = { schema: 'critic/w1-00-jrn03@1', at: new Date().toISOString() };

// switch to the real-input path (A-JRN1)
o.mode = await page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); return H.setMode('play-instrumented'); });

// M-K1 action coverage through the real DOM path
o.MK1 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.loadState('arena_flat');
  const set = JSON.parse(JSON.stringify(H.getActionSet()));
  return { actions: set.actions, bindings: set.bindings, reserved: set.reserved, bufferFrames: set.bufferFrames, catchupCap: set.catchupCap };
});
const bindings = o.MK1.bindings;
const fired = {};
for (const [action, keys] of Object.entries(bindings)) {
  const primary = keys[0];
  if (!primary || /^Mouse|^Wheel/.test(primary)) { fired[action] = { via: primary, skipped: 'pointer/wheel binding not driven by keyboard' }; continue; }
  await page.evaluate(() => { const H = window.__HARNESS; H.loadState('arena_flat'); H.traceStart({}); });
  await page.keyboard.down(primary);
  await page.evaluate(() => window.__HARNESS.stepFrames(4));
  await page.keyboard.up(primary);
  const r = await page.evaluate(() => { window.__HARNESS.stepFrames(2); const recs = window.__HARNESS.traceStop(); const acts = []; for (const x of recs) for (const e of (x.events || [])) if (e.type === 'input_action') acts.push(e.button); const held = recs.map(x => x.input.held).flat(); return { acts, held: [...new Set(held)] }; });
  fired[action] = { via: primary, input_actions: r.acts, held: r.held, routed: r.acts.includes(action) || r.held.includes(action) };
}
o.MK1_routed = fired;
o.MK1_summary = { keyboard_bindings_probed: Object.values(fired).filter(f => !f.skipped).length, routed: Object.values(fired).filter(f => f.routed).length };

// M-K5 repeat immunity — 60 synthetic repeat keydowns
o.MK5 = await page.evaluate(async () => {
  const H = window.__HARNESS; H.loadState('arena_flat'); H.traceStart({});
  const el = document.activeElement || window;
  for (let i = 0; i < 60; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Mouse0' in {} ? 'KeyR' : 'KeyR', repeat: i > 0, bubbles: true }));
  H.stepFrames(120);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
  H.stepFrames(10);
  const recs = H.traceStop();
  let atk = 0; for (const x of recs) for (const e of (x.events || [])) if (e.type === 'attack_start') atk++;
  return { repeat_keydowns: 60, attack_starts: atk };
});

// M-K6 blur release / M-K7 visibility release
o.MK6_MK7 = await page.evaluate(async () => {
  const H = window.__HARNESS; const res = {};
  for (const evt of ['blur', 'visibilitychange']) {
    H.loadState('arena_flat'); H.teleport(0, 0);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    H.stepFrames(30);
    const heldBefore = JSON.parse(JSON.stringify(H.getInputState().held));
    const p0 = H.snapshot().player.pos.slice();
    if (evt === 'blur') window.dispatchEvent(new Event('blur'));
    else { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }
    H.stepFrames(1);
    const heldAfter1 = JSON.parse(JSON.stringify(H.getInputState().held));
    H.stepFrames(300);
    const p1 = H.snapshot().player.pos;
    res[evt] = { held_before: heldBefore, held_after_1_frame: heldAfter1, drift_m: Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) };
  }
  return res;
});

// M-K14 browser control
o.MK14 = await page.evaluate(() => {
  const canvas = document.querySelector('canvas') || document.body;
  const r = {};
  const fire = (type, init) => { const e = type.startsWith('key') ? new KeyboardEvent(type, { ...init, bubbles: true, cancelable: true }) : (type === 'wheel' ? new WheelEvent(type, { ...init, bubbles: true, cancelable: true }) : new MouseEvent(type, { ...init, bubbles: true, cancelable: true })); canvas.dispatchEvent(e); return e.defaultPrevented; };
  r.contextmenu_prevented = fire('contextmenu', { button: 2 });
  r.space_prevented = fire('keydown', { code: 'Space' });
  r.tab_prevented = fire('keydown', { code: 'Tab' });
  r.slash_prevented = fire('keydown', { code: 'Slash' });
  r.backspace_prevented = fire('keydown', { code: 'Backspace' });
  r.wheel_prevented = fire('wheel', { deltaY: 100 });
  r.arrow_prevented = fire('keydown', { code: 'ArrowDown' });
  r.page_scrollable = document.documentElement.scrollHeight > window.innerHeight + 1;
  r.cursor_style = getComputedStyle(canvas).cursor;
  return r;
});

// M-K24 dropped inputs over 3000 scripted real-path events
o.MK24 = await page.evaluate(async () => {
  const H = window.__HARNESS; H.loadState('arena_flat');
  const before = JSON.parse(JSON.stringify(H.getInputState()));
  for (let i = 0; i < 1500; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
    if (i % 5 === 0) H.stepFrames(1);
  }
  H.stepFrames(60);
  const after = JSON.parse(JSON.stringify(H.getInputState()));
  return { events: 3000, droppedInputs_before: before.droppedInputs, droppedInputs_after: after.droppedInputs, activeDevice: after.activeDevice, pointerLocked: after.pointerLocked, hasFocus: after.hasFocus };
});

// M-K19 zero-binding refusal / M-K4 reserved chords, via getActionSet's audit list
o.MK4_reserved = o.MK1.reserved;

o.page_errors = h.errors;
fs.writeFileSync(out, JSON.stringify(o, null, 2));
console.log('wrote', out);
await h.close();
