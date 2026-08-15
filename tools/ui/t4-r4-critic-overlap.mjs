#!/usr/bin/env node
// t4-r4-critic-overlap.mjs — the pixel half of the T4 round-4 critique, run OFFLINE.
//
// Owner: crit-t4-r4. Split out of `t4-r4-critic.mjs` for one reason, and it is an instrument
// honesty note rather than a tidy-up: **that script's own `page.screenshot()` frames came back
// byte-identical to one another**, which `tools/visual/frame-liveness.mjs` reported as
// `DUPLICATE` on 3 of 4. The probe runs with `setRenderRate(0)`, so the page's presented buffer
// does not advance and Playwright's screenshot is not a picture of the screen the probe drove.
// Every pixel number that script printed for its OVERLAP leg is VOID; the ELEMENT RECTS it
// recorded are not (they are `getUIState()` self-reports and the game state was correct), so the
// rects are reused here and the pixels are re-read from `tools/ui/t4-r2-measure.mjs` captures,
// which go through `canvas.toDataURL()` and which `frame-liveness` passes as LIVE.
//
// WHAT IT MEASURES, and why neither the element census nor a colour heuristic can.
//
//   The census cannot: `chrome.js`'s `row()` declares the RAW joined column text and calls
//   `ellipsise()` only inside its draw callback, so `getUIState()` reports "STRENGTH 12" whether
//   the two words sit side by side or on top of each other. `RI-UIX09`'s own "how we lose" #2:
//   *"a self-report cannot see a canvas draw."*
//
//   A colour heuristic cannot: my first attempt classified "glyph ink" as dark-and-low-chroma and
//   "gauge" as green. On the level-up screen the gauge plate is (42,55,43) and fails `G > B+12` by
//   one unit; on the CHARACTER SHEET the panel's own ground is (44,57,45) — the same colour — so
//   "dark and low chroma" matched the background and reported 73% of the row as ink. Recorded
//   because a critic's discarded instrument is part of the evidence.
//
//   So the metric here is screen-agnostic and is the item's own: **foreground = a pixel more than
//   `ΔE_rgb > 24` from the PANEL'S MODAL COLOUR** (`RI-UIX09` §A D2 defines fill exactly this way,
//   on the panel rect). Inside each attribute row, collapse to a per-column foreground count and
//   count the **separators** — runs of ≥ 3 consecutive columns with no foreground at all. A row
//   that draws a name, then a value, then a gauge draws three foreground runs with two clear
//   separators between them. A row whose three parts have collided draws one run and no separator.
//   The number is comparable between two different box sizes, which is what the delete-the-fix arm
//   needs it to be.
//
// Usage:
//   node tools/ui/t4-r4-critic-overlap.mjs \
//     --rects corpus/90-verdicts/wave1/artifacts/T4-r4c/reports/t4-r4-critic.json \
//     --shots corpus/90-verdicts/wave1/artifacts/T4-r4c/measure/screens \
//     --control corpus/90-verdicts/wave1/artifacts/T4-r4c/control-c792e8d7 \
//     --out   corpus/90-verdicts/wave1/artifacts/T4-r4c/reports
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, log, ensureDir } from '../lib/cli.mjs';
import { decodePNG } from './t4-r2-critic-measure.mjs';

const args = parseArgs();
const RECTS = path.join(REPO_ROOT, String(args.rects || 'corpus/90-verdicts/wave1/artifacts/T4-r4c/reports/t4-r4-critic.json'));
const SHOTS = path.join(REPO_ROOT, String(args.shots || 'corpus/90-verdicts/wave1/artifacts/T4-r4c/measure/screens'));
const CONTROL = args.control ? path.join(REPO_ROOT, String(args.control)) : null;
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r4c/reports'));
ensureDir(OUT);

const FG = 24;        // rgb distance from the panel's modal colour that counts as "something drawn"
const GAP = 3;        // consecutive empty columns that count as a separator between two runs

function modal(png, rect) {
  const [x0, y0, w, h] = rect.map((v) => Math.round(v));
  const hist = new Map();
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      const i = ((y * png.width) + x) << 2;
      // quantise to 8 levels per channel so anti-aliasing does not shatter the mode
      const k = ((png.data[i] >> 5) << 6) | ((png.data[i + 1] >> 5) << 3) | (png.data[i + 2] >> 5);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  let best = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; best = k; }
  return [((best >> 6) & 7) * 32 + 16, ((best >> 3) & 7) * 32 + 16, (best & 7) * 32 + 16];
}

function rowProfile(png, rect, mode) {
  const [x0, y0, w, h] = rect.map((v) => Math.round(v));
  const cols = [];
  for (let x = x0; x < x0 + w && x < png.width; x++) {
    let n = 0;
    for (let y = y0; y < y0 + h && y < png.height; y++) {
      const i = ((y * png.width) + x) << 2;
      const dr = png.data[i] - mode[0], dg = png.data[i + 1] - mode[1], db = png.data[i + 2] - mode[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > FG) n++;
    }
    cols.push(n);
  }
  // trim leading/trailing empty columns, then count internal separators
  let a = 0, b = cols.length - 1;
  while (a <= b && cols[a] === 0) a++;
  while (b >= a && cols[b] === 0) b--;
  let seps = 0, run = 0, runs = a <= b ? 1 : 0;
  for (let i = a; i <= b; i++) {
    if (cols[i] === 0) { run++; } else { if (run >= GAP) { seps++; runs++; } run = 0; }
  }
  return { separators: seps, runs, ink_columns: cols.slice(a, b + 1).filter((c) => c > 0).length, span: b - a + 1 };
}

const src = JSON.parse(fs.readFileSync(RECTS, 'utf8'));
const HEAD_LIVE = JSON.parse(fs.readFileSync(path.join(SHOTS, '..', 'measure-live-1920x1080.json'), 'utf8'));
const out = {
  schema: 'elder-souls/t4-r4-overlap@2', at: new Date().toISOString(),
  rects_from: path.relative(REPO_ROOT, RECTS), shots_from: path.relative(REPO_ROOT, SHOTS),
  metric: `foreground = rgb distance > ${FG} from the panel's modal colour; a SEPARATOR is >= ${GAP} consecutive columns with none. name|value|gauge laid out apart => >= 2 separators.`,
  screens: {},
};

for (const mode of ['levelup', 'sheet']) {
  const rows = src.data[`${mode}_attribute_rows`];
  if (!rows) continue;
  const p = path.join(SHOTS, `live-${mode}__1920x1080.png`);
  const png = decodePNG(fs.readFileSync(p));
  const panel = (HEAD_LIVE.screens[mode] && HEAD_LIVE.screens[mode].panel_rect) || null;
  const m = modal(png, panel || [0, 0, png.width, png.height]);
  const res = rows.map((r) => ({ id: r.id, rect: r.rect.map(Math.round), declared_text: r.text, ...rowProfile(png, r.rect, m) }));
  const collided = res.filter((r) => r.separators < 2);
  out.screens[mode] = {
    capture: path.relative(REPO_ROOT, p), panel_rect: panel, panel_modal_rgb: m, rows: res,
    rows_total: res.length, rows_with_fewer_than_two_separators: collided.length,
    m_f18_2_pass: collided.length === 0,
  };
  log(`${mode} (round 4): ${collided.length} of ${res.length} attribute rows draw name/value/gauge with FEWER THAN TWO separators (i.e. run together)`);
}

if (CONTROL) {
  out.control = { dir: path.relative(REPO_ROOT, CONTROL), screens: {} };
  const live = JSON.parse(fs.readFileSync(path.join(CONTROL, 'measure-live-1920x1080.json'), 'utf8'));
  for (const mode of ['levelup', 'sheet']) {
    const rows = src.data[`${mode}_attribute_rows`];
    const p = path.join(CONTROL, 'screens', `live-${mode}__1920x1080.png`);
    if (!rows || !fs.existsSync(p)) continue;
    const png = decodePNG(fs.readFileSync(p));
    const panel = (live.screens[mode] && live.screens[mode].panel_rect) || null;
    const m = modal(png, panel || [0, 0, png.width, png.height]);
    // The control's rows sit at different coordinates. Take the control's OWN attribute-row band:
    // the panel's inner column, sliced at the row pitch the control draws. Rather than guess, use
    // the control's declared rects if the manifest carries them; it does not, so fall back to
    // scanning the panel for rows of the same COUNT and reporting the profile of each band.
    const [px, py, pw, ph] = panel.map(Math.round);
    const bands = [];
    // find horizontal bands containing foreground, inside the panel's left half (the attribute column)
    const half = Math.round(pw * 0.45);
    let cur = null;
    for (let y = py; y < py + ph; y++) {
      let n = 0;
      for (let x = px + 20; x < px + half; x++) {
        const i = ((y * png.width) + x) << 2;
        const dr = png.data[i] - m[0], dg = png.data[i + 1] - m[1], db = png.data[i + 2] - m[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) > FG) n++;
      }
      if (n > 3) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
      else if (cur) { if (cur.y1 - cur.y0 >= 8) bands.push(cur); cur = null; }
    }
    if (cur && cur.y1 - cur.y0 >= 8) bands.push(cur);
    const prof = bands.map((b) => ({ band: [px + 20, b.y0, half - 20, b.y1 - b.y0 + 1], ...rowProfile(png, [px + 20, b.y0, half - 20, b.y1 - b.y0 + 1], m) }));
    out.control.screens[mode] = { capture: path.relative(REPO_ROOT, p), panel_rect: panel, panel_modal_rgb: m, bands: prof,
      bands_total: prof.length, bands_with_fewer_than_two_separators: prof.filter((b) => b.separators < 2).length };
    log(`${mode} (CONTROL c792e8d7): ${prof.filter((b) => b.separators < 2).length} of ${prof.length} text bands in the attribute column run together`);
  }
}

fs.writeFileSync(path.join(OUT, 't4-r4-overlap.json'), JSON.stringify(out, null, 2));
log(`-> ${path.join(OUT, 't4-r4-overlap.json')}`);
const anyFail = Object.values(out.screens).some((s) => !s.m_f18_2_pass);
process.exit(anyFail ? 1 : 0);
