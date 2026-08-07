#!/usr/bin/env node
// critic-w1-08-29-r1-draw.mjs — the ORPHAN TEXT probe for the W1-08 / W1-29 critique.
//
// Written for this critique under orchestration/TOOL-LOOP.md rule 1 and declared in the verdict
// under `method_deviations`. RI-JRN03 / RI-JRN04 CONSUMPTION §4 names a fourth failure shape:
// "orphan text — a string authored, computed correctly, carried through the model, exposed
// through the harness, and never drawn. From the player's chair it is identical to a string
// that was never written."
//
// This probe answers the only question that matters for it: does the RENDERER put anything on
// the screen? It does not ask the model, it asks the pixels.
//
//   D1  TOUCH-DRAW   Phone-class viewport, coarse pointer, touch path live. Render a frame with
//                    no touch, then with a four-finger touch (stick + camera + two buttons) that
//                    the model itself reports as registered, and diff the two PNGs. A drawn
//                    virtual stick and drawn buttons must change pixels.
//   D2  ROTATE-DRAW  Portrait. The model reports a rotate state with an authored line. Render
//                    and diff against the same frame in landscape.
//   D3  STRINGS      The four authored strings, asked for from the model, then searched for in
//                    everything the renderer says it drew (getDrawnText / text register).
//
// S34: every capture here is APPEARANCE evidence — what is drawn on a frame — and never
// arrival evidence. Nothing here asserts a journey, a route or a duration.
//
// EXIT 0 every probe ran; 11 no harness; 12 the page threw.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, EXIT, log, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-08-29-r1-draw.mjs — does the renderer draw the touch overlay and the authored strings?

USAGE
  node tools/harness/critic-w1-08-29-r1-draw.mjs --out DIR
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks/critic-r1-draw')));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(id, what, ok, detail, threshold) {
  results.push({ id, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  log(`  [${ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL'}] ${id.padEnd(12)} ${what} = ${JSON.stringify(detail).slice(0, 300)}`);
}

function writePng(name, dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/png;base64,')) return null;
  const p = path.join(OUT, name);
  fs.writeFileSync(p, Buffer.from(String(dataUrl).slice('data:image/png;base64,'.length), 'base64'));
  return p;
}

async function main() {
  // A clamped landscape phone: 844x390 logical, the profile RI-JRN04's method names.
  const handle = await launchGame({ width: 844, height: 390, entry: args.entry, url: args.url });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);

  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(0); return true; });

  // ---- D1: the touch overlay -----------------------------------------------------------
  const d1 = await ev(async () => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    if (H.setViewport) H.setViewport({ width: 844, height: 390, pointer: 'coarse', hover: 'none', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.stepFrames(4);
    const before = await H.screenshot();
    // four simultaneous pointers: floating stick, camera drag, and two buttons
    H.touchDown(1, 120, 300); H.touchMove(1, 170, 250);
    H.touchDown(2, 620, 140); H.touchMove(2, 660, 150);
    H.touchDown(3, 780, 300);
    H.touchDown(4, 720, 240);
    H.stepFrames(4);
    const st = H.getInputState();
    const after = await H.screenshot();
    const touchState = H.getTouchState ? H.getTouchState() : null;
    H.touchUp(1); H.touchUp(2); H.touchUp(3); H.touchUp(4);
    return { before, after, identical: before === after, held: st.held.slice(), move: H.getMoveVector(), touchState, drawn: H.getDrawnGeometry ? Object.keys(H.getDrawnGeometry() || {}) : null };
  });
  const p1 = writePng('touch-none.png', d1.before);
  const p2 = writePng('touch-four-pointers.png', d1.after);
  record('D1-TOUCH-DRAW',
    'a four-pointer touch the model reports as registered changes the rendered frame',
    !d1.identical,
    { frames_identical: d1.identical, model_registered_held: d1.held, model_move_vector: d1.move, png_before: p1, png_after: p2 },
    'RI-JRN04 §G / CONSUMPTION §4: a control the player must find has to be drawn');

  // ---- D2: the rotate state ------------------------------------------------------------
  const d2 = await ev(async () => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    if (H.setViewport) H.setViewport({ width: 844, height: 390, pointer: 'coarse', hover: 'none' });
    H.stepFrames(2);
    const landscape = await H.screenshot();
    if (H.setViewport) H.setViewport({ width: 390, height: 844, pointer: 'coarse', hover: 'none' });
    H.stepFrames(4);
    const vp = H.getViewport ? H.getViewport() : null;
    const portrait = await H.screenshot();
    return { landscape, portrait, identical: landscape === portrait, viewport: vp };
  });
  const p3 = writePng('rotate-landscape.png', d2.landscape);
  const p4 = writePng('rotate-portrait.png', d2.portrait);
  record('D2-ROTATE-DRAW',
    'the portrait rotate state the model reports is drawn on the frame',
    !d2.identical,
    { frames_identical: d2.identical, viewport_model: d2.viewport, png_landscape: p3, png_portrait: p4 },
    'RI-JRN04 H1 / M-P16: an in-world rotate illustration, not a UI modal');

  // ---- D3: the four authored strings ---------------------------------------------------
  const d3 = await ev(() => {
    const H = window.__HARNESS;
    const strings = {};
    try { const r = H.openRebinding ? H.openRebinding('keyboard') : null; strings.rebinder_open = !!r; } catch (e) { strings.rebinder_open = 'threw: ' + e.message; }
    try { strings.viewport_rotate = H.getViewport ? (H.getViewport().rotateState || null) : null; } catch (e) { strings.viewport_rotate = 'threw'; }
    // Everything the renderer admits to having drawn.
    let drawnText = null;
    try { drawnText = H.getDrawnText ? H.getDrawnText() : (H.getTextRegister ? H.getTextRegister() : null); } catch (e) { drawnText = 'threw'; }
    let uiCensus = null;
    try { uiCensus = H.getUICensus ? H.getUICensus() : null; } catch (e) { uiCensus = 'threw'; }
    return { strings, drawnText, uiCensus, harness_methods: Object.keys(H).filter((k) => /draw|text|ui|Ui|UI/i.test(k)) };
  });
  record('D3-STRINGS',
    'the authored refusal / rotate / calibration lines appear in what the renderer drew',
    null, d3,
    'reported as evidence; the draw path is judged from D1/D2 and from the renderer source');

  await handle.close();
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'pass').length, fail: results.filter((r) => r.status === 'FAIL').length };
  writeJson(path.join(OUT, 'draw-checks.json'), { schema: 'critic-input-draw/1', tool: 'tools/harness/critic-w1-08-29-r1-draw.mjs', s34_evidence_kind: 'appearance', ran_at: new Date().toISOString(), counts, checks: results });
  log(`\n  ${counts.pass}/${counts.total} pass  ->  ${path.join(OUT, 'draw-checks.json')}`);
}

main().catch((e) => die(12, 'draw probe threw: ' + (e && e.message), { stack: e && e.stack }));
