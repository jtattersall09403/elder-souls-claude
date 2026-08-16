#!/usr/bin/env node
// t4-r8-critic-overlap-ablation.mjs — IS `t4-r5-legibility.mjs`'s OVERLAP LEG MEASURING LEGIBILITY?
//
// Owner: crit-t4-r8. The T4 r8 builder reported, against itself, that SHEET is RED on the OVERLAP
// leg at 1920x1080 and CLEAN at 1280x720, that level-up loses one of its two findings at the
// smaller viewport, and that it had not established whether that is the screen or the instrument.
// This answers it, and it answers it by ABLATION rather than by a story about a threshold
// (`ARBITRATION` S63: a mechanism asserted from the shape of a number is not a mechanism).
//
// THE LEG. `rowProfile()` projects an `attribute_row`'s WHOLE rect down to a column profile — for
// each column x, how many rows in that column carry ink — and counts runs of >= `gap` all-zero
// columns as SEPARATORS. `separators < 2` is reported as an overlap. That is round 4's test, and
// round 4's rows were label, value and gauge printed ON TOP of one another.
//
// THE HYPOTHESIS THIS FALSIFIES OR CONFIRMS, stated before running: an attribute row's rect is
// tall enough to contain BOTH the label/value text line AND the horizontal gauge bar beneath it.
// A gauge bar is a continuous run of ink across nearly the whole row width, so it fills almost
// every column of the projection and destroys almost every separator — regardless of how cleanly
// the label and the value are set. If that is what is happening, the leg's verdict on these rows
// is a property of the GAUGE'S TICK SPACING and not of the text at all.
//
// THE ABLATION. Three profiles per row from the same capture and the same modal colour:
//   FULL        the row rect as the leg takes it
//   TEXT-ONLY   the upper `--textfrac` of the row rect — the label/value line, gauge excluded
//   GAUGE-ONLY  the remainder — the gauge alone, text excluded
// If TEXT-ONLY separates (>= 2) on rows the FULL profile calls overlapping, the leg is reporting a
// defect that is not there. If TEXT-ONLY also fails, the finding is real and this tool says so.
//
// Usage: node t4-r8-critic-overlap-ablation.mjs --report <legibility json> --shots <dir> --out <json>
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const A = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const i = s.trim().indexOf(' '); return i < 0 ? [s.trim(), true] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));

function decodePNG(buf) {
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
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}
// FG and GAP are `t4-r5-legibility.mjs`'s own constants, copied rather than imported so a change
// there cannot silently change what this ablation means.
const FG = 24, GAP = 3;
function modal(png, rect) {
  const [x0, y0, w, h] = rect.map(Math.round);
  const hist = new Map();
  for (let y = y0; y < y0 + h && y < png.height; y++) for (let x = x0; x < x0 + w && x < png.width; x++) {
    const i = ((y * png.width) + x) << 2;
    const k = ((png.data[i] >> 5) << 6) | ((png.data[i + 1] >> 5) << 3) | (png.data[i + 2] >> 5);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let best = 0, bn = -1;
  for (const [k, n] of hist) if (n > bn) { bn = n; best = k; }
  return [((best >> 6) & 7) * 32 + 16, ((best >> 3) & 7) * 32 + 16, (best & 7) * 32 + 16];
}
function rowProfile(png, rect, mode, gap) {
  const [x0, y0, w, h] = rect.map(Math.round);
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
  let a = 0, b = cols.length - 1;
  while (a <= b && cols[a] === 0) a++;
  while (b >= a && cols[b] === 0) b--;
  let seps = 0, run = 0, runs = a <= b ? 1 : 0;
  for (let i = a; i <= b; i++) { if (cols[i] === 0) run++; else { if (run >= gap) { seps++; runs++; } run = 0; } }
  return { separators: seps, runs, span: b - a + 1, ink_cols: cols.filter((c) => c > 0).length, of_cols: cols.length };
}

const rep = JSON.parse(fs.readFileSync(String(A.report), 'utf8'));
const SHOTS = String(A.shots);
const TEXTFRAC = Number(A.textfrac || 0.5);
const out = {
  schema: 'elder-souls/t4-r8-critic-overlap-ablation@1', at: new Date().toISOString(),
  source_report: String(A.report), text_fraction_of_row: TEXTFRAC,
  constants: { FG, GAP, note: 'copied from t4-r5-legibility.mjs, not imported' },
  rows: [],
};
for (const [key, scr] of Object.entries(rep.screens)) {
  if (!scr || !scr.findings) continue;
  const [tag, name] = key.split('/');
  const shot = path.join(SHOTS, `${tag}-${name}.png`);
  if (!fs.existsSync(shot)) continue;
  const png = decodePNG(fs.readFileSync(shot));
  const sPix = png.height / 1080;
  const gapAtScale = Math.max(1, Math.round(GAP * sPix));
  // Every attribute row on the screen, not only the ones the leg reported — otherwise the ablation
  // only ever sees the rows that already failed and cannot show what a CLEAN row looks like.
  const reported = new Set(scr.findings.overlap.map((o) => o.id));
  // THE CONTROL, AND WHY IT IS DERIVED RATHER THAN READ. `t4-r5-legibility.mjs` only records rects
  // for the rows it REPORTS, so an ablation over its report alone would only ever see rows that
  // already failed and could not show what a row the leg calls CLEAN looks like — which is exactly
  // the "arms that cannot disagree" defect this whole round is about. So the neighbouring rows are
  // reconstructed at the screen's own row pitch, inferred as the smallest positive y-gap between
  // two reported rows on that screen, and labelled `derived: true` in the output. A derived row
  // whose profile is degenerate (no ink at all) is dropped rather than counted.
  const ys = scr.findings.overlap.map((o) => o.rect[1]).sort((a, b) => a - b);
  let pitch = 0;
  for (let i = 1; i < ys.length; i++) { const d = ys[i] - ys[i - 1]; if (d > 0 && (!pitch || d < pitch)) pitch = d; }
  const allRows = scr.findings.overlap.map((o) => ({ id: o.id, rect: o.rect, text: o.text, derived: false }));
  if (pitch > 0) {
    for (const o of scr.findings.overlap) {
      for (const k of [-1, 1]) {
        const y = o.rect[1] + k * pitch;
        if (allRows.some((r) => Math.abs(r.rect[1] - y) < 1)) continue;
        allRows.push({ id: `${o.id}~${k > 0 ? 'below' : 'above'}`, rect: [o.rect[0], y, o.rect[2], o.rect[3]], text: null, derived: true });
      }
    }
  }
  for (const row of allRows) {
    if (!row.rect) continue;
    const m = modal(png, row.rect);
    const [rx, ry, rw, rh] = row.rect;
    const th = Math.max(1, Math.round(rh * TEXTFRAC));
    const full = rowProfile(png, row.rect, m, gapAtScale);
    const text = rowProfile(png, [rx, ry, rw, th], m, gapAtScale);
    const gauge = rowProfile(png, [rx, ry + th, rw, rh - th], m, gapAtScale);
    if (row.derived && full.span <= 0) continue;   // a reconstructed row that is off the list
    out.rows.push({
      screen: key, id: row.id, derived: !!row.derived, text_declared: row.text, rect: row.rect,
      gap_threshold_px: gapAtScale,
      full, text_line_only: text, gauge_only: gauge,
      leg_says_overlap: reported.has(row.id),
      text_line_separates: text.separators >= 2,
      verdict: reported.has(row.id)
        ? (text.separators >= 2 ? 'FALSE POSITIVE — the label/value line separates cleanly; the FULL profile is collapsed by the gauge'
          : 'REAL — the text line itself does not separate')
        : (text.separators >= 2 ? 'clean, and the text line separates' : 'clean, but the text line does not separate — the leg passed it for the wrong reason'),
    });
  }
}
const reported = out.rows.filter((r) => r.leg_says_overlap);
out.summary = {
  rows_examined: out.rows.length,
  rows_the_leg_calls_overlapping: reported.length,
  of_those_whose_text_line_separates_cleanly: reported.filter((r) => r.text_line_separates).length,
  gauge_ink_column_coverage: reported.map((r) => `${r.id}: gauge fills ${r.gauge_only.ink_cols}/${r.gauge_only.of_cols} columns`),
  conclusion: reported.length === 0 ? 'no rows reported'
    : (reported.every((r) => r.text_line_separates)
      ? 'EVERY row the OVERLAP leg reports has a label/value line that separates cleanly. The leg is not measuring legibility on these screens.'
      : 'at least one reported row has a text line that does not separate — that finding is real'),
};
fs.writeFileSync(String(A.out), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary, null, 2));
for (const r of out.rows) {
  console.log(`${r.screen} ${r.id.padEnd(28)} FULL sep ${r.full.separators} | TEXT sep ${r.text_line_only.separators} | GAUGE sep ${r.gauge_only.separators} (ink ${r.gauge_only.ink_cols}/${r.gauge_only.of_cols})  ${r.verdict}`);
}
