#!/usr/bin/env node
// CRITIC-OWNED probe: RI-JRN03 keyboard path through the real DOM in play mode.
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const out = { produced_by: 'critic-owned p8-input.mjs — real DOM KeyboardEvents in play-instrumented mode' };

out.modes = await page.evaluate(() => { try { return { set: window.__HARNESS.setMode('play-instrumented') }; } catch (e) { try { return { set: window.__HARNESS.setMode('play'), note: String(e.message).slice(0, 120) }; } catch (e2) { return { err: String(e2.message).slice(0, 160) }; } } });

// M-K1: does each default binding route to an action, matched on .code?
const CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'Tab', 'Escape', 'Digit1'];
out.M_K1 = await page.evaluate(async (codes) => {
  const H = window.__HARNESS;
  const seen = {};
  const tap = (code) => {
    const before = JSON.stringify(H.getActionSet ? H.getActionSet().held || [] : []);
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
    const during = H.getInputState ? JSON.stringify(H.getInputState()) : JSON.stringify(H.snapshot().input);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    return { before, during };
  };
  for (const c of codes) seen[c] = tap(c);
  return { seen, actionSet: H.getActionSet ? H.getActionSet() : null };
}, CODES);

// M-K5: 60 repeated keydowns for an attack must produce exactly one attack_start
out.M_K5 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(24);
  H.traceStart();
  for (let i = 0; i < 60; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Mouse0', key: 'Mouse0', repeat: i > 0, bubbles: true }));
  H.stepFrames(60);
  const recs = H.traceStop();
  const ev = {}; for (const r of recs) for (const e of (r.events || [])) ev[e.type] = (ev[e.type] || 0) + 1;
  return { events: ev };
});

// M-K6/K7: held action must release on blur and on visibilitychange
out.M_K6_K7 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const res = {};
  for (const kind of ['blur', 'visibility', 'pointerlockchange']) {
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0); H.stepFrames(24);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    H.stepFrames(30);
    const p0 = H.snapshot().player.pos.slice();
    if (kind === 'blur') window.dispatchEvent(new Event('blur'));
    else if (kind === 'visibility') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    } else document.dispatchEvent(new Event('pointerlockchange'));
    H.stepFrames(1);
    const p1 = H.snapshot().player.pos.slice();
    H.stepFrames(120);
    const p2 = H.snapshot().player.pos.slice();
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    res[kind] = { drift_1_frame_m: +dist(p1, p0).toFixed(4), drift_120_frames_m: +dist(p2, p1).toFixed(4), held: H.getActionSet ? H.getActionSet().held : null };
    if (kind === 'visibility') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  }
  return res;
});

// M-K8/K9: is there a "click to play" surface? is the page scrollable / cursor visible?
out.M_K8_K9 = await page.evaluate(() => {
  const txt = document.body.innerText || '';
  return {
    body_text_sample: txt.slice(0, 300),
    mentions_click_to_play: /click to (play|start)|enable mouse|press any key/i.test(txt),
    cursor: getComputedStyle(document.body).cursor,
    scrollable: document.documentElement.scrollHeight > window.innerHeight + 1,
    contextmenu_prevented: (() => { const e = new MouseEvent('contextmenu', { cancelable: true, bubbles: true }); document.dispatchEvent(e); return e.defaultPrevented; })(),
  };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ modes: out.modes, K5: out.M_K5, K6: out.M_K6_K7, K8: out.M_K8_K9, actionSet: out.M_K1.actionSet }, null, 1).slice(0, 3500));
await h.close();
