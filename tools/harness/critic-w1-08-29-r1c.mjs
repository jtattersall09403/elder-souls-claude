#!/usr/bin/env node
// critic-w1-08-29-r1c.mjs — the RI-MTH07 CONSUMPTION coupling test for the two models
// W1-08/W1-29 ships that the predecessor critic's `draw/` artifact found undrawn.
//
//   K1  TOUCH-COUPLING   Model: engine.real.touch (layout + visibility). Predicted consumer:
//                        the renderer. Perturb visible/hidden and pressed/unpressed at a FIXED
//                        sim frame and hash the framebuffer.
//                        POSITIVE CONTROL: turn the camera by 30 deg at the same fixed frame and
//                        confirm the hash DOES move — otherwise this probe cannot fail.
//                        NULL CONTROL: the identical state twice.
//   K2  ROTATE-COUPLING  Model: viewport.rotateState(). Same shape, portrait vs landscape.
//   K3  TEXT-POSITIVE    Can getRenderedText() ever see anything? Sweep the named states that
//                        should carry dialogue/title text. If it can, the register works and the
//                        overlay simply is not routed through it; if it cannot, M-K20 is inert.
//
// EXIT 0 every probe ran.
'use strict';

import crypto from 'node:crypto';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-08-29-r1c.mjs — RI-MTH07 coupling test for the touch overlay and rotate models.
USAGE  node tools/harness/critic-w1-08-29-r1c.mjs --out DIR`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks/critic-r1c')));

const results = [];
function record(id, what, ok, detail, threshold) {
  results.push({ id, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  log(`  [${ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL'}] ${id.padEnd(16)} ${what}`);
  log(`         ${JSON.stringify(detail).slice(0, 1200)}`);
}

async function main() {
  const handle = await launchGame({ width: 844, height: 390, entry: args.entry, url: args.url });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async () => crypto.createHash('md5').update(await page.screenshot()).digest('hex').slice(0, 16);

  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(60); return true; });

  // ---- K1: the touch overlay -------------------------------------------------------------
  const setup = async (fn) => ev(fn);

  // Fixed baseline: arena, handheld, frame pinned.
  await setup(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
    H.setDeviceClass && H.setDeviceClass('handheld');
    H.stepFrames(30);
  });
  const frameAt = () => ev(() => window.__HARNESS.getFrame());

  // NULL CONTROL — same state, sampled twice, no model change.
  const nullA = await shot();
  await ev(() => window.__HARNESS.stepFrames(0));
  const nullB = await shot();

  // A: overlay visible, nothing pressed.
  const stateA = await ev(() => {
    const H = window.__HARNESS;
    H.setUIVisible && H.setUIVisible(true);
    H.touchDown(1, 1, 1); H.touchUp(1);           // wake the overlay
    H.stepFrames(2);
    const t = H.touchState ? H.touchState() : null;
    return { frame: H.getFrame(), visible: t && t.visible, controls: (H.touchLayout() || []).length, held: H.getInputState().touch ? H.getInputState().touch.visible : null };
  });
  const shotA = await shot();

  // B: overlay visible AND four pointers down on real control centres (buttons lit, stick deflected).
  const stateB = await ev(() => {
    const H = window.__HARNESS;
    const layout = (H.touchLayout() || []).filter((c) => c.action !== '__drawer');
    H.touchDown(11, layout[0].x, layout[0].y);
    H.touchDown(12, layout[1].x, layout[1].y);
    H.touchDown(13, layout[2].x, layout[2].y);
    H.touchDown(14, 120, 300);
    H.touchMove && H.touchMove(14, 200, 240);
    H.stepFrames(2);
    return { frame: H.getFrame(), held: H.getInputState().held, pressed_controls: 4,
      touch_visible: H.touchState ? H.touchState().visible : null };
  });
  const shotB = await shot();

  // POSITIVE CONTROL — the framebuffer hash must move for something the renderer definitely draws.
  await ev(() => { const H = window.__HARNESS; H.touchUp(11); H.touchUp(12); H.touchUp(13); H.touchUp(14); H.stepFrames(2); });
  const beforeTurn = await shot();
  await ev(() => {
    const H = window.__HARNESS;
    for (let i = 0; i < 30; i++) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 20, bubbles: true })); H.stepFrames(1); }
  });
  const afterTurn = await shot();

  record('K1-TOUCH-COUPLING', 'RI-MTH07: perturbing the touch model changes what an entity/the renderer does',
    shotA !== shotB,
    { model_value_a: { overlay: 'visible, 0 pointers', ...stateA }, model_value_b: { overlay: 'visible, 4 pointers on control centres', ...stateB },
      observed_a: shotA, observed_b: shotB, coupling: shotA === shotB ? 0 : 1,
      null_control: { a: nullA, b: nullB, identical: nullA === nullB },
      positive_control: { before_camera_turn: beforeTurn, after_camera_turn: afterTurn, hash_moved: beforeTurn !== afterTurn } },
    'coupling 0 = orphan model, score the dimension 0 fail-closed (RI-MTH07 §B)');

  // ---- K2: the rotate state --------------------------------------------------------------
  const k2 = await ev(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
    H.setDeviceClass && H.setDeviceClass('handheld');
    H.stepFrames(20);
    return { frame: H.getFrame() };
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await ev(() => window.__HARNESS.stepFrames(6));
  const landState = await ev(() => ({ rotate: window.__HARNESS.getViewport().rotateState, frame: window.__HARNESS.getFrame() }));
  const landShot = await shot();
  await page.setViewportSize({ width: 390, height: 844 });
  await ev(() => window.__HARNESS.stepFrames(6));
  const portState = await ev(() => ({ rotate: window.__HARNESS.getViewport().rotateState, frame: window.__HARNESS.getFrame() }));
  const portShot = await shot();
  // The canvas is a different size in portrait, so a hash difference is expected and useless.
  // The real question is whether the AUTHORED LINE reaches a draw call at all.
  const portText = await ev(() => { const t = window.__HARNESS.getRenderedText(); return { entries: (t.entries || []).length, distinct: t.distinct }; });
  record('K2-ROTATE-COUPLING', 'RI-MTH07: the rotate line the model authors reaches a draw call',
    portText.entries > 0 && JSON.stringify(portText.distinct).includes('map lies'),
    { model_value_a: { orientation: 'landscape', rotateState: landState.rotate }, model_value_b: { orientation: 'portrait', rotateState: portState.rotate },
      observed_a: landShot, observed_b: portShot,
      note: 'hashes differ only because the canvas is resized; the load-bearing observation is the drawn-text stream',
      rendered_text_in_portrait: portText, coupling: portText.entries > 0 ? null : 0,
      renderer_consumers_of_rotateState: 'none — grep over game/**/*.js finds rotateState only in game/src/input/viewport.js' },
    'RI-JRN04 H1/M-P16: an in-world rotate illustration, drawn');

  // ---- K3: can the text register ever see anything? --------------------------------------
  const states = ['helstrom-market', 'thorn-hall', 'ui-journal', 'npc_showcase', 'default', 'settlement_primary_street'];
  const k3 = await ev((ss) => {
    const H = window.__HARNESS;
    const out = [];
    for (const s of ss) {
      try {
        H.reset({ state: s }); H.setMode('play-instrumented'); H.setRenderRate(60);
        H.renderedTextClear && H.renderedTextClear();
        H.stepFrames(90);
        const t = H.getRenderedText();
        out.push({ state: s, entries: (t.entries || []).length, distinct_count: t.distinct_count, sample: (t.distinct || []).slice(0, 6) });
      } catch (e) { out.push({ state: s, error: String(e && e.message).slice(0, 120) }); }
    }
    // And with a dialogue surface forced open.
    try {
      H.reset({ state: 'helstrom-market' }); H.setRenderRate(60); H.renderedTextClear();
      H.uiOpen && H.uiOpen('dialogue'); H.stepFrames(60);
      const t = H.getRenderedText();
      out.push({ state: 'helstrom-market + uiOpen(dialogue)', entries: (t.entries || []).length, sample: (t.distinct || []).slice(0, 6), ui: H.getUIState && H.getUIState() });
    } catch (e) { out.push({ state: 'uiOpen(dialogue)', error: String(e && e.message).slice(0, 200) }); }
    return out;
  }, states);
  const everSaw = k3.some((x) => (x.entries || 0) > 0);
  record('K3-TEXT-POSITIVE', 'the rendered-text register M-K20 (HF5) searches can ever be non-empty',
    everSaw, { probes: k3, verdict: everSaw ? 'register works; the overlay is simply not routed through it' : 'M-K20 searches a stream nothing ever writes — the check cannot fail' },
    'AGENT-PROTOCOL §"a probe that cannot fail is worse than no probe"');

  await handle.close();
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'FAIL').length, unmeasurable: results.filter((r) => r.status === 'unmeasurable').length };
  writeJson(path.join(OUT, 'critic-checks.json'), { schema: 'critic-input-checks/1', tool: 'tools/harness/critic-w1-08-29-r1c.mjs',
    ran_at: new Date().toISOString(), counts, checks: results });
  log(`\n  ${counts.pass}/${counts.total} pass -> ${OUT}/critic-checks.json`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(12); });
