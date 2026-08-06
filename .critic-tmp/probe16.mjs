// CRITIC-OWNED probe 16: settle RI-JRN03 M-K7 (visibility release). My first pass overrode only
// document.visibilityState. This pass overrides visibilityState AND hidden, and also uses
// Playwright's own CDP Emulation.setPageVisibility-equivalent (page.goto of a background tab is
// not available, so both DOM surfaces are driven), so an instrument miss cannot masquerade as HF2.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
const out = process.argv[2];
const h = await launchGame({});
const page = h.page;
const o = { schema: 'critic/w1-00-mk7@1', at: new Date().toISOString(), variants: {} };

const run = async (variant) => page.evaluate(async (v) => {
  const H = window.__HARNESS; await H.ready(); H.setMode('play-instrumented');
  H.loadState('arena_flat'); H.teleport(0, 0); H.clearInputs();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  H.stepFrames(30);
  const before = JSON.parse(JSON.stringify(H.getInputState()));
  const p0 = H.snapshot().player.pos.slice();
  if (v === 'visibilityState_only') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  } else if (v === 'both') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  } else if (v === 'event_only') {
    document.dispatchEvent(new Event('visibilitychange'));
  } else if (v === 'pointerlockchange') {
    document.dispatchEvent(new Event('pointerlockchange'));
  } else if (v === 'blur_window') {
    window.dispatchEvent(new Event('blur'));
  }
  H.stepFrames(1);
  const after1 = JSON.parse(JSON.stringify(H.getInputState()));
  H.stepFrames(300);
  const p1 = H.snapshot().player.pos;
  // restore
  try { delete document.visibilityState; } catch {}
  try { delete document.hidden; } catch {}
  return { held_before: before.held, move_before: before.move ?? null, held_after_1_frame: after1.held,
    drift_m: Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), doc_visibility: document.visibilityState, doc_hidden: document.hidden };
}, variant);

for (const v of ['blur_window', 'event_only', 'visibilityState_only', 'both', 'pointerlockchange']) {
  o.variants[v] = await run(v);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
}
o.page_errors = h.errors;
fs.writeFileSync(out, JSON.stringify(o, null, 2));
console.log(JSON.stringify(o.variants, null, 1));
await h.close();
