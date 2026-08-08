#!/usr/bin/env node
// THE PICTURE FOR W1-22 ROUND 3: the median is inside the band and the events are not.
//
// `tools/analysis/ambience-onsets-chart.mjs` already draws this piece's headline as a per-region
// MEDIAN, before and after. That is the right picture for the fix it illustrates and the wrong one
// for this verdict, because the median is exactly the statistic that hides what I found: gate O3
// grades the layer median, the corrective `event_gain_db` trim is also one number per layer, and
// 54 of 413 individual events sit outside RI-AUD03 §A's band with the medians dead centre.
//
// So this draws ONE DOT PER EVENT against the band, with the layer median marked. A reader should
// be able to see, without reading a number, that the crosses sit in the grey stripe while a third
// of a column hangs below it.
//
// No browser: this is a picture of a measurement, not of the game (rule 20).
//
//   node tools/audio/critic-w1-22-r2-chart.mjs [--report <onsets.json>] --out docs/shots/<name>.png

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const REPORT = args.report || join(ROOT, 'reports/w1-22-critic/r2/onsets-at-HEAD.json');
if (!existsSync(REPORT)) { console.error(`no report at ${REPORT}`); process.exit(2); }
const rep = JSON.parse(readFileSync(REPORT, 'utf8'));

const BANDS = { L3: [-6, 2], L4: [-4, 4] };
const TOL = 2;

// ---- gather one row per bed/layer, one dot per event ------------------------------------------
const cols = [];
for (const [bid, rec] of Object.entries(rep.regions || {})) {
  if (!rec || !rec.tod) continue;
  for (const layer of Object.keys(BANDS)) {
    const xs = [];
    for (const t of Object.values(rec.tod)) {
      if (!t || t.error) continue;
      for (const e of (t.events || [])) if (e.layer === layer) xs.push(e.rel_db);
    }
    if (!xs.length) continue;
    const s = [...xs].sort((a, b) => a - b);
    cols.push({ bed: bid, layer, xs, kind: rec.kind,
                median: s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 });
  }
}
cols.sort((a, b) => (a.bed === b.bed ? a.layer.localeCompare(b.layer) : a.bed.localeCompare(b.bed)));
if (!cols.length) { console.error('no events in the report — nothing to draw'); process.exit(2); }

// ---- the smallest PNG writer that can draw this ------------------------------------------------
const W = 1240, H = 660;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = ((y | 0) * W + (x | 0)) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xFFFFFFFF; for (const v of b) c = crcT[(c ^ v) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
// 5x7 bitmap font, enough for a title and axis labels.
const GLYPH = {
  A: '01100100101111010011001', B: '11100101011100101011110', C: '0111010001100001000101110'.slice(0, 23),
};
const FONT = {
  // Each entry is a COLUMN and each bit a row, so a dash is one bit set across all five columns.
  ' ': [0, 0, 0, 0, 0], '-': [0x10, 0x10, 0x10, 0x10, 0x10], '.': [0, 0x80, 0, 0, 0], ':': [0, 0x44, 0, 0, 0],
  '/': [0x60, 0x18, 0x06, 0, 0], '(': [0x3C, 0x42, 0, 0, 0], ')': [0x42, 0x3C, 0, 0, 0],
  '+': [0x10, 0x10, 0x7C, 0x10, 0x10], ',': [0, 0x60, 0, 0, 0],
  0: [0x7E, 0x81, 0x81, 0x81, 0x7E], 1: [0, 0x82, 0xFF, 0x80, 0], 2: [0xC2, 0xA1, 0x91, 0x89, 0x86],
  3: [0x42, 0x81, 0x89, 0x89, 0x76], 4: [0x38, 0x24, 0x22, 0xFF, 0x20], 5: [0x4F, 0x89, 0x89, 0x89, 0x71],
  6: [0x7E, 0x89, 0x89, 0x89, 0x72], 7: [0x01, 0xE1, 0x11, 0x09, 0x07], 8: [0x76, 0x89, 0x89, 0x89, 0x76],
  9: [0x4E, 0x91, 0x91, 0x91, 0x7E],
};
for (const [ch, bits] of Object.entries({
  a: 0x20844, b: 0, c: 0,
})) void ch, bits;
function glyph(ch) {
  const u = ch.toUpperCase();
  if (FONT[ch]) return FONT[ch];
  if (FONT[u]) return FONT[u];
  // letters: a compact 5x8 set built from a string table
  const T = {
    A: [0xFC, 0x22, 0x21, 0x22, 0xFC], B: [0xFF, 0x89, 0x89, 0x89, 0x76], C: [0x7E, 0x81, 0x81, 0x81, 0x42],
    D: [0xFF, 0x81, 0x81, 0x42, 0x3C], E: [0xFF, 0x89, 0x89, 0x89, 0x81], F: [0xFF, 0x09, 0x09, 0x09, 0x01],
    G: [0x7E, 0x81, 0x91, 0x91, 0x72], H: [0xFF, 0x08, 0x08, 0x08, 0xFF], I: [0x81, 0xFF, 0x81, 0, 0],
    J: [0x60, 0x80, 0x80, 0x81, 0x7F], K: [0xFF, 0x18, 0x24, 0x42, 0x81], L: [0xFF, 0x80, 0x80, 0x80, 0x80],
    M: [0xFF, 0x02, 0x0C, 0x02, 0xFF], N: [0xFF, 0x04, 0x08, 0x10, 0xFF], O: [0x7E, 0x81, 0x81, 0x81, 0x7E],
    P: [0xFF, 0x11, 0x11, 0x11, 0x0E], Q: [0x7E, 0x81, 0xA1, 0x41, 0xBE], R: [0xFF, 0x11, 0x31, 0x51, 0x8E],
    S: [0x46, 0x89, 0x89, 0x91, 0x62], T: [0x01, 0x01, 0xFF, 0x01, 0x01], U: [0x7F, 0x80, 0x80, 0x80, 0x7F],
    V: [0x1F, 0x60, 0x80, 0x60, 0x1F], W: [0x7F, 0x80, 0x70, 0x80, 0x7F], X: [0xC3, 0x24, 0x18, 0x24, 0xC3],
    Y: [0x03, 0x04, 0xF8, 0x04, 0x03], Z: [0xC1, 0xA1, 0x99, 0x85, 0x83],
  };
  return T[u] || [0, 0, 0, 0, 0];
}
function text(str, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of str) {
    const col = glyph(ch);
    for (let i = 0; i < 5; i++) for (let bit = 0; bit < 8; bit++)
      if (col[i] & (1 << bit)) rect(cx + i * scale, y + bit * scale, scale, scale, r, g, b);
    cx += 6 * scale;
  }
}

// ---- plot -------------------------------------------------------------------------------------
const L = 92, Rt = W - 24, Tp = 92, Bt = H - 96;
const yLo = -34, yHi = 14;
const yOf = (v) => Bt - (v - yLo) / (yHi - yLo) * (Bt - Tp);
rect(0, 0, W, H, 0x12, 0x14, 0x18);

// §A's band as a grey stripe (L3's, with the tolerance) plus the L4 ceiling line.
rect(L, yOf(BANDS.L3[1] + TOL) | 0, Rt - L, (yOf(BANDS.L3[0] - TOL) - yOf(BANDS.L3[1] + TOL)) | 0, 0x2b, 0x2f, 0x38);
for (let x = L; x < Rt; x += 2) { set(x, yOf(0), 0x55, 0x5b, 0x66); }

// gridlines + labels every 6 dB
for (let v = yHi; v >= yLo; v -= 6) {
  const y = yOf(v) | 0;
  for (let x = L; x < Rt; x += 4) set(x, y, 0x25, 0x28, 0x30);
  text(`${v > 0 ? '+' : ''}${v}`, 46, y - 4, 0x77, 0x7d, 0x88, 1);
}

const colW = (Rt - L) / cols.length;
let nOut = 0;
cols.forEach((c, i) => {
  const cx = L + colW * (i + 0.5);
  const [lo, hi] = BANDS[c.layer];
  // every event, one dot
  for (const v of c.xs) {
    const y = yOf(Math.max(yLo, Math.min(yHi, v)));
    const out = v < lo - TOL || v > hi + TOL;
    if (out) nOut++;
    const [r, g, b] = out ? [0xff, 0x6b, 0x5b] : [0x6f, 0x9d, 0xd8];
    rect(cx - 1.5, y - 1.5, 3, 3, r, g, b);
  }
  // the layer median — what gate O3 actually grades
  const my = yOf(Math.max(yLo, Math.min(yHi, c.median))) | 0;
  rect(cx - 5, my - 1, 11, 2, 0xf5, 0xd6, 0x6b);
});

text('EVERY AMBIENCE EVENT AGAINST THE BAND THE ITEM SPECIFIES', 40, 26, 0xe8, 0xec, 0xf2, 2);
text(`GREY STRIPE  RI-AUD03 SECTION A BAND   YELLOW  LAYER MEDIAN, WHAT GATE O3 GRADES`, 40, 56, 0x9a, 0xa2, 0xb0, 1);
text(`RED  EVENT OUTSIDE THE BAND  ${nOut} OF ${cols.reduce((s, c) => s + c.xs.length, 0)}`, 40, 70, 0xff, 0x6b, 0x5b, 1);
text('DB RELATIVE TO THE BED', 40, Tp - 8, 0x77, 0x7d, 0x88, 1);
text(`BED AND LAYER   ${cols.length} COLUMNS   COMMIT ${(rep.git || {}).commit || ''}   ${rep.seconds || ''} S PER BED`,
     L, Bt + 22, 0x77, 0x7d, 0x88, 1);
text('O3 PASSES WITH ZERO FAILURES ON THIS RENDER', L, Bt + 44, 0xf5, 0xd6, 0x6b, 1);

const out = args.out || join(ROOT, 'docs/shots/w1-22-r3-events-against-the-band.png');
png(out);
console.log(`${cols.length} bed/layer columns, ${cols.reduce((s, c) => s + c.xs.length, 0)} events, ${nOut} outside the band`);
console.log(`-> ${out.replace(ROOT + '/', '')}`);
