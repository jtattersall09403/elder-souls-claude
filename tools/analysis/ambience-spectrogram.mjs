#!/usr/bin/env node
// A picture of the thirteen regions' sound. W1-22.
//
// AGENT-PROTOCOL asks every agent to leave one illustrative image for the blog, and audio has
// no picture — which is part of why "there is no audio in this build" went three rounds without
// anyone seeing it. This draws the one image that makes the whole piece legible at a glance: a
// row per region, a column per frequency band, brightness = energy. Thirteen rows that look
// alike would mean thirteen regions that sound alike; thirteen rows that look different is the
// claim this piece is making, in a form a non-developer can check with their eyes.
//
// Reads `reports/w1-22/ambience-spectra.json` (written by `ambience-render.mjs`). No browser,
// no dependencies — the PNG is written by hand, because adding an image library to this repo
// for one picture is not a trade worth making.
//
//   node tools/analysis/ambience-spectrogram.mjs [--out docs/shots/<name>.png]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SRC = join(ROOT, 'reports/w1-22/ambience-spectra.json');
const argv = process.argv.slice(2);
const outRel = argv.includes('--out') ? argv[argv.indexOf('--out') + 1]
  : `docs/shots/${new Date().toISOString().slice(0, 10)}-w1-22-thirteen-regions-as-sound.png`;

if (!existsSync(SRC)) {
  console.error(`ambience-spectrogram: ${SRC} not found. Run:\n  node tools/analysis/ambience-render.mjs --seconds 20`);
  process.exit(2);
}
const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const ids = Object.keys(doc.regions).sort();
if (!ids.length) { console.error('ambience-spectrogram: no regions in the spectra file'); process.exit(2); }

// ---- layout ---------------------------------------------------------------------------------
const CELL_W = 26, CELL_H = 26, PAD_L = 200, PAD_T = 54, PAD_B = 46, PAD_R = 24;
const NB = doc.bands || 24;
const W = PAD_L + NB * CELL_W + PAD_R;
const H = PAD_T + ids.length * CELL_H + PAD_B;
const px = new Uint8Array(W * H * 3);

const BG = [16, 15, 20];
for (let i = 0; i < W * H; i++) { px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2]; }
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};

/** Dark-to-warm ramp. Perceptually monotonic enough for a blog picture. */
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [[18, 18, 34], [30, 62, 110], [42, 138, 130], [186, 176, 88], [244, 214, 168]];
  const s = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}

// Normalise each row by its own maximum, so the picture shows SHAPE rather than level — the
// beds are deliberately at thirteen different loudnesses and that is not what this is about.
for (let r = 0; r < ids.length; r++) {
  const bands = doc.regions[ids[r]].bands;
  const mx = Math.max(...bands) || 1;
  for (let b = 0; b < NB; b++) {
    const [cr, cg, cb] = ramp(Math.pow(bands[b] / mx, 0.55));
    for (let y = 0; y < CELL_H - 2; y++) {
      for (let x = 0; x < CELL_W - 2; x++) set(PAD_L + b * CELL_W + x, PAD_T + r * CELL_H + y, cr, cg, cb);
    }
  }
}

// ---- text: a 5x7 bitmap font, enough for labels ------------------------------------------------
const FONT = {
  A: '011101101111101101101', B: '110101110101101101110', C: '011100100100100100011', D: '110101101101101101110',
  E: '111100100110100100111', F: '111100100110100100100', G: '011100100101101101011', H: '101101101111101101101',
  I: '111010010010010010111', J: '001001001001001101010', K: '101101110100110101101', L: '100100100100100100111',
  M: '101111111101101101101', N: '101101111111101101101', O: '010101101101101101010', P: '110101101110100100100',
  Q: '010101101101111101011', R: '110101101110110101101', S: '011100100010001001110', T: '111010010010010010010',
  U: '101101101101101101011', V: '101101101101101010010', W: '101101101101111111101', X: '101101010010010101101',
  Y: '101101101010010010010', Z: '111001001010100100111',
  0: '010101101101101101010', 1: '010110010010010010111', 2: '110001001010100100111', 3: '110001001010001001110',
  4: '101101101111001001001', 5: '111100100110001001110', 6: '011100100110101101010', 7: '111001001010010010010',
  8: '010101101010101101010', 9: '010101101011001001110',
  ' ': '000000000000000000000', '-': '000000000111000000000', "'": '010010000000000000000', '.': '000000000000000010000',
  ':': '000010000000010000000', '/': '001001010010100100000',
};
function text(str, x0, y0, col, scale = 1) {
  let x = x0;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch];
    if (g === undefined) { x += 4 * scale; continue; }
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) set(x + c * scale + sx, y0 + r * scale + sy, col[0], col[1], col[2]);
      }
    }
    x += 4 * scale;
  }
  return x;
}

const INK = [226, 222, 214], DIM = [128, 124, 132];
text('THIRTEEN REGIONS AS SOUND', 16, 14, INK, 2);
text(`${doc.seconds}S RENDERED PER REGION - ${NB} BANDS ${doc.f_min_hz}-${doc.f_max_hz} HZ - EACH ROW NORMALISED`, 16, 34, DIM, 1);
for (let r = 0; r < ids.length; r++) {
  text(ids[r].replace(/-/g, ' '), 16, PAD_T + r * CELL_H + 8, INK, 1);
}
text('LOW', PAD_L, H - PAD_B + 12, DIM, 1);
text('HIGH', W - PAD_R - 20, H - PAD_B + 12, DIM, 1);
text('IF THESE ROWS LOOKED ALIKE THE PROVINCE WOULD HAVE ONE REGION', 16, H - PAD_B + 28, DIM, 1);

// ---- PNG --------------------------------------------------------------------------------------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync(dirname(join(ROOT, outRel)), { recursive: true });
writeFileSync(join(ROOT, outRel), png);
console.log(`ambience-spectrogram: ${outRel} (${W}x${H}, ${(png.length / 1024).toFixed(1)} KB, ${ids.length} regions)`);
