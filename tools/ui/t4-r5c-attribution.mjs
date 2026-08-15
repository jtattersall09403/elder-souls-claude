#!/usr/bin/env node
// t4-r5c-attribution.mjs — WHERE DID THE DENSITY GO? A critic-owned attribution instrument.
//
// Owner: T4-r5 critic (`crit-t4-r5`). It exists because round 5's builder made a specific causal
// claim that no existing tool in this repo can test, and `ARBITRATION` S58's own stated mechanism
// rests on the same claim:
//
//   "fixing the collision removes the overlapping-ink pixels that were inflating round 4's number"
//
// `RI-UIX09` D2 is *the fraction of pixels inside the panel rect that differ from the panel's modal
// colour by dE00 > 6*. It is a count of DISTINCT PIXELS. Two glyphs drawn on the same pixel make
// that pixel differ once, not twice — so ink-over-ink cannot inflate D2; if anything, collapsing
// three columns into one REDUCES the union area and lowers it. The claim is therefore falsifiable
// by arithmetic, and this tool does it on pixels instead:
//
//   * panel D2, recomputed here from the capture (must agree with t4-r2-measure.mjs's own number,
//     which is the check that this tool measures the same thing the bar does);
//   * foreground pixels inside every `attribute_row` rect, per arm;
//   * the same, split into an x-band decomposition, so a fall can be attributed to the TEXT
//     columns (where a de-collision lives) or to the GAUGE band (where a shrunk trough lives).
//
// It reads captures and rects that already exist; it launches no browser and writes only where
// `--out` points. Every constant below (FG dE00 > 6, the modal quantiser) is t4-r2-measure.mjs's,
// restated rather than imported so this file carries no other tool's `--out` default on import.
//
// Usage:
//   node tools/ui/t4-r5c-attribution.mjs \
//     --a <headArm.json>  --a-png <head levelup png>  --a-label head \
//     --b <ctlArm.json>   --b-png <ctl levelup png>   --b-label control \
//     --screen levelup --out <dir>
//
// `--a` / `--b` accept EITHER a t4-r2-measure.mjs `measure-*.json` (reads
// `.screens[screen].elements`) OR a t4-r5-legibility.mjs report (reads `.screens["<vp>/<screen>"]`).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

const args = parseArgs();
const abs = (p) => (path.isAbsolute(String(p)) ? String(p) : path.join(REPO_ROOT, String(p)));
const OUT = abs(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r5c/reports');
fs.mkdirSync(OUT, { recursive: true });
const SCREEN = String(args.screen || 'levelup');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) throw new Error(`unsupported PNG ${bitDepth}/${colourType}/${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp, out = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++]; const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      else if (f !== 0) throw new Error('unknown PNG filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}

// t4-r2-measure.mjs's own modal colour: 5-bit-per-channel histogram over the panel rect.
function modalLab(png, rect) {
  const [x0, y0, w, h] = rect.map(Math.round);
  const hist = new Map();
  for (let y = Math.max(0, y0); y < y0 + h && y < png.height; y++) {
    for (let x = Math.max(0, x0); x < x0 + w && x < png.width; x++) {
      const i = ((y * png.width) + x) << 2;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  let best = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; best = k; }
  const rgb = [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4];
  return { rgb, lab: labFromSrgb255(rgb[0], rgb[1], rgb[2]) };
}

function fgCount(png, rect, mLab) {
  const [x0, y0, w, h] = rect.map(Math.round);
  let n = 0, tot = 0;
  for (let y = Math.max(0, y0); y < y0 + h && y < png.height; y++) {
    for (let x = Math.max(0, x0); x < x0 + w && x < png.width; x++) {
      const i = ((y * png.width) + x) << 2;
      tot++;
      if (de2000(mLab, labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2])) > 6) n++;
    }
  }
  return { fg: n, total: tot, fraction: tot ? n / tot : null };
}

// Per-column foreground profile inside a rect — the x-band decomposition.
function colProfile(png, rect, mLab) {
  const [x0, y0, w, h] = rect.map(Math.round);
  const cols = [];
  for (let x = Math.max(0, x0); x < x0 + w && x < png.width; x++) {
    let n = 0;
    for (let y = Math.max(0, y0); y < y0 + h && y < png.height; y++) {
      const i = ((y * png.width) + x) << 2;
      if (de2000(mLab, labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2])) > 6) n++;
    }
    cols.push(n);
  }
  return cols;
}

// The attribute-row rects come from ONE source (`--rects`, a t4-r4-critic.json) and are applied to
// both arms. That is legitimate here and ONLY here: this tool asserts, and the caller must have
// checked, that the two arms' PANEL RECTS are byte-identical — for `levelup` they are
// ([720,300,480,480] in both `measure-live-1920x1080.json` manifests), because neither the box nor
// the row pitch changed between them. `delta.panel_rect_identical` re-checks it and the report
// carries the answer, so a reader can see the assumption rather than take it.
function loadArm(measureJsonPath, pngPath, label, rowsFrom) {
  const j = JSON.parse(fs.readFileSync(abs(measureJsonPath), 'utf8'));
  const rec = (j.screens || {})[SCREEN];
  if (!rec || !rec.panel_rect) throw new Error(`no panel_rect for screen '${SCREEN}' in ${measureJsonPath}`);
  const png = decodePNG(fs.readFileSync(abs(pngPath)));
  return { label, panel: rec.panel_rect, rows: rowsFrom, png, pngPath: String(pngPath) };
}

const rectsSrc = JSON.parse(fs.readFileSync(abs(args.rects), 'utf8'));
const ROWS = (rectsSrc.data && rectsSrc.data[`${SCREEN}_attribute_rows`]) || [];
if (!ROWS.length) throw new Error(`--rects carries no ${SCREEN}_attribute_rows`);

const arms = [];
if (args.a) arms.push(loadArm(args.a, args['a-png'], String(args['a-label'] || 'A'), ROWS));
if (args.b) arms.push(loadArm(args.b, args['b-png'], String(args['b-label'] || 'B'), ROWS));

const report = { schema: 'elder-souls/t4-r5c-attribution@1', at: new Date().toISOString(), screen: SCREEN, arms: [] };
for (const arm of arms) {
  if (!arm.panel) throw new Error(`${arm.label}: no panel rect`);
  const m = modalLab(arm.png, arm.panel);
  const d2 = fgCount(arm.png, arm.panel, m.lab);
  const rows = arm.rows.map((r) => {
    const c = fgCount(arm.png, r.rect, m.lab);
    return { id: r.id, rect: r.rect, fg: c.fg, area: c.total, profile: colProfile(arm.png, r.rect, m.lab) };
  });
  const rowFgTotal = rows.reduce((a, r) => a + r.fg, 0);
  report.arms.push({
    label: arm.label, capture: arm.pngPath, panel_rect: arm.panel,
    modal_rgb: m.rgb,
    d2_recomputed: Number(d2.fraction.toFixed(4)), panel_fg_px: d2.fg, panel_area_px: d2.total,
    attribute_rows: rows.length, attribute_row_fg_px_total: rowFgTotal,
    rows,
  });
  console.log(`[${arm.label}] panel ${JSON.stringify(arm.panel)}  D2=${d2.fraction.toFixed(4)}  fg=${d2.fg}/${d2.total}`
    + `  rows=${rows.length}  row-fg=${rowFgTotal}`);
}

if (report.arms.length === 2) {
  const [A, B] = report.arms;
  const dPanel = A.panel_fg_px - B.panel_fg_px;
  const dRows = A.attribute_row_fg_px_total - B.attribute_row_fg_px_total;
  report.delta = {
    d2: Number((A.d2_recomputed - B.d2_recomputed).toFixed(4)),
    panel_fg_px: dPanel,
    attribute_row_fg_px: dRows,
    share_of_panel_delta_inside_attribute_rows: dPanel ? Number((dRows / dPanel).toFixed(3)) : null,
    panel_rect_identical: JSON.stringify(A.panel_rect) === JSON.stringify(B.panel_rect),
  };
  console.log(`\ndelta ${A.label} - ${B.label}:  D2 ${report.delta.d2}   panel fg ${dPanel} px   attribute-row fg ${dRows} px`
    + `   (${report.delta.share_of_panel_delta_inside_attribute_rows} of the panel delta)`
    + `   panel rect identical: ${report.delta.panel_rect_identical}`);
}

const outPath = path.join(OUT, `t4-r5c-attribution-${SCREEN}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('written: ' + outPath);
