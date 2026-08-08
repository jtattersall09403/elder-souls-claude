#!/usr/bin/env node
// w1-24-shot.mjs — the picture. Two frames of this game, side by side.
//
// Both of them pass "a canvas exists, it has non-zero dimensions, and there are no page errors."
// One of them is the game. The other is a black screen. That check was used as evidence that the
// build was rendering, and RULES.md rule 27 asks for one image a non-developer can read: this is
// the whole argument for `render.process.measurement` in a single frame.
//
// Both halves are REAL captures off the running build in one browser session. The right-hand one
// is produced by clearing every canvas in the document AFTER the renderer has drawn — the same
// pixels a broken renderer leaves — not by drawing a black rectangle into the output image.
//
// USAGE
//   node tools/render/w1-24-shot.mjs [--out <file.png>]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-24-shot.mjs — the two frames that both pass "a canvas exists with non-zero dimensions".

USAGE
  node tools/render/w1-24-shot.mjs [--out <file.png>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'docs/shots/2026-08-08-w1-24-both-of-these-pass-the-canvas-check.png');
ensureDir(path.dirname(out));

const W = 960, H = 540;

async function main() {
  log('launching one browser and keeping it (rule 21)');
  const handle = await launchGame({ width: W, height: H, timeout: 90000 });
  const page = handle.page;
  page.setDefaultTimeout(180000);
  try {
    // ---- the live frame -----------------------------------------------------------------------
    const live = await page.evaluate(() => {
      const H = window.__HARNESS;
      H.setUIVisible(false);
      H.setTimeOfDay(11);
      H.setWeather('clear');
      H.stepFrames(60);
      H.renderFrame();
      const cs = [...document.querySelectorAll('canvas')];
      return { passes: cs.length > 0 && cs.every((c) => c.width > 0 && c.height > 0), canvases: cs.length };
    });
    const bufLive = await page.screenshot({ type: 'png' });
    log(`live frame: canvas check says ${live.passes ? 'PASS' : 'FAIL'} over ${live.canvases} canvas(es)`);

    // ---- the black frame ----------------------------------------------------------------------
    const black = await page.evaluate(() => {
      const H = window.__HARNESS;
      H.renderFrame();
      for (const c of document.querySelectorAll('canvas')) {
        const g = c.getContext('2d');
        if (g) { g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); }
        else { const gl = c.getContext('webgl2') || c.getContext('webgl'); if (gl) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } }
      }
      const cs = [...document.querySelectorAll('canvas')];
      return { passes: cs.length > 0 && cs.every((c) => c.width > 0 && c.height > 0), canvases: cs.length };
    });
    const bufBlack = await page.screenshot({ type: 'png' });
    log(`black frame: canvas check says ${black.passes ? 'PASS' : 'FAIL'} over ${black.canvases} canvas(es)`);

    // ---- composite, in the page, with the browser's own text rasteriser -----------------------
    // Deliberately NOT tools/lib/chart-font.mjs: one of the six failures this piece exists for is
    // a chart font that sheared every glyph so published numbers could be read as different
    // numbers. A picture arguing about measurement integrity does not get to draw its own labels
    // through a hand-rolled glyph path.
    const dataUrl = await page.evaluate(async ([a, b, w, h, liveOk, blackOk]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const pad = 24, header = 96, cap = 92, gap = 20;
      const cw = w, ch = h;
      const c = document.createElement('canvas');
      c.width = pad * 2 + cw * 2 + gap;
      c.height = header + ch + cap + pad;
      const g = c.getContext('2d');
      g.fillStyle = '#12100e'; g.fillRect(0, 0, c.width, c.height);

      g.fillStyle = '#f2ece0';
      g.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      g.fillText('Both of these pass the check that was used to prove the game was rendering.', pad, 46);
      g.fillStyle = '#b8ad99';
      g.font = '20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      g.fillText('"a canvas exists  ·  it has non-zero dimensions  ·  there are no page errors"   — all three true of both frames.', pad, 78);

      g.drawImage(ia, pad, header, cw, ch);
      g.drawImage(ib, pad + cw + gap, header, cw, ch);
      g.strokeStyle = '#3a3630'; g.lineWidth = 2;
      g.strokeRect(pad, header, cw, ch);
      g.strokeRect(pad + cw + gap, header, cw, ch);

      const label = (x, title, verdict, colour) => {
        g.fillStyle = '#f2ece0';
        g.font = '600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        g.fillText(title, x, header + ch + 34);
        g.fillStyle = colour;
        g.font = '600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        g.fillText(verdict, x, header + ch + 66);
      };
      label(pad, 'The game.', liveOk ? 'canvas check: PASS' : 'canvas check: FAIL', '#7fbf7f');
      label(pad + cw + gap, 'Every canvas cleared to black after the renderer drew.',
        blackOk ? 'canvas check: PASS  —  and there is nothing there.' : 'canvas check: FAIL', '#e08a6a');

      return c.toDataURL('image/png');
    }, [`data:image/png;base64,${bufLive.toString('base64')}`, `data:image/png;base64,${bufBlack.toString('base64')}`, W, H, live.passes, black.passes]);

    fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    log(`wrote ${path.relative(REPO_ROOT, out)}`);
    if (!live.passes || !black.passes) {
      log('NOTE: the check did NOT pass on both frames in this run. The picture reports what happened, not what was expected.');
    }
  } finally {
    await handle.close();
  }
  process.exit(0);
}

main().catch((e) => { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(EXIT.INTERNAL); });
