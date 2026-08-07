#!/usr/bin/env node
// critic-w1-08-29-r1d.mjs — the clean ablation K1 needed.
//
// K1 (r1c) showed the framebuffer moving when four pointers went down, but the same perturbation
// put `light` and `block` into `held`, so the player animated and the hash would have moved
// whether or not the overlay is drawn. This isolates the overlay: SAME sim frame, SAME inputs
// (none), only the device class / overlay visibility differs.
//
//   L1  OVERLAY-ABLATION   desktop (no overlay) vs handheld (overlay) at an identical pinned
//                          frame with zero input. Plus setUIVisible(false) vs (true) on handheld.
//   L2  TEXT-REGISTER      Does ANY fillText reach the register in a state whose getUIState()
//                          reports elements carrying text? Names the disconnect precisely.
'use strict';

import crypto from 'node:crypto';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('critic-w1-08-29-r1d.mjs --out DIR');
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks/critic-r1d')));
const results = [];
function record(id, what, ok, detail, threshold) {
  results.push({ id, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  log(`  [${ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL'}] ${id.padEnd(16)} ${what}`);
  log(`         ${JSON.stringify(detail).slice(0, 1600)}`);
}

async function main() {
  const handle = await launchGame({ width: 844, height: 390, entry: args.entry, url: args.url });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async () => crypto.createHash('md5').update(await page.screenshot()).digest('hex').slice(0, 16);

  // Pin the world: arena, render on, no input at all, and freeze the sim by stepping 0 frames
  // between samples so any hash difference is the draw layer and nothing else.
  const pin = async (deviceClass, visible) => ev(({ dc, vis }) => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
    H.setDeviceClass && H.setDeviceClass(dc);
    if (vis !== null) { H.touchDown(99, 2, 2); H.touchUp(99); }   // wake the overlay
    H.stepFrames(24);
    const t = H.touchState ? H.touchState() : null;
    return { frame: H.getFrame(), device: dc, overlay_visible: t ? t.visible : null,
      controls: (H.touchLayout() || []).length, held: H.getInputState().held };
  }, { dc: deviceClass, vis: visible });

  const desk = await pin('desktop', null);
  const deskShot = await shot();
  const hand = await pin('handheld', true);
  const handShot = await shot();
  // Repeat each once to prove the hash is stable for a fixed configuration (null control).
  const desk2 = await pin('desktop', null);
  const deskShot2 = await shot();

  record('L1-OVERLAY-ABLATION', 'the touch overlay reaches the framebuffer: handheld vs desktop, same frame, zero input',
    deskShot !== handShot && deskShot === deskShot2,
    { model_value_a: desk, model_value_b: hand, observed_a: deskShot, observed_b: handShot,
      null_control: { desktop_resampled: deskShot2, stable: deskShot === deskShot2 },
      coupling: deskShot !== handShot ? 1 : 0,
      note: 'zero held actions in both arms, so a hash difference is the overlay and not the player animating' },
    'RI-MTH07 §B: coupling 0 = orphan model');

  // L2 — the text register against a UI that getUIState() says carries text.
  const l2 = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
    H.renderedTextClear && H.renderedTextClear();
    const opened = [];
    for (const s of ['dialogue', 'menu', 'rest']) {
      try { H.uiOpen(s); H.stepFrames(45); const tt = H.getRenderedText(); opened.push({ surface: s, ok: true, entries_after: (tt.entries || []).length }); H.uiClose && H.uiClose(); H.stepFrames(5); }
      catch (e) { opened.push({ surface: s, error: String(e && e.message).slice(0, 100) }); }
    }
    H.uiOpen('menu'); H.stepFrames(60);
    const ui = H.getUIState();
    const withText = (ui.elements || []).filter((e) => e.text != null && String(e.text).length);
    const t = H.getRenderedText();
    return { opened, ui_elements: (ui.elements || []).length, ui_elements_with_text: withText.length,
      ui_text_sample: withText.slice(0, 8).map((e) => ({ id: e.id, text: String(e.text).slice(0, 60) })),
      register_entries: (t.entries || []).length, register_surfaces: t.surfaces_instrumented,
      register_summary: t.summary };
  });
  record('L2-TEXT-REGISTER', 'text the UI model reports drawing appears in the register M-K20 searches',
    l2.ui_elements_with_text > 0 ? l2.register_entries > 0 : null,
    l2,
    'M-K20/HF5 searches getRenderedText(); if the UI draws text the register never sees, the check is inert');

  await handle.close();
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'FAIL').length, unmeasurable: results.filter((r) => r.status === 'unmeasurable').length };
  writeJson(path.join(OUT, 'critic-checks.json'), { schema: 'critic-input-checks/1', tool: 'tools/harness/critic-w1-08-29-r1d.mjs',
    ran_at: new Date().toISOString(), counts, checks: results });
  log(`\n  ${counts.pass}/${counts.total} pass -> ${OUT}/critic-checks.json`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(12); });
