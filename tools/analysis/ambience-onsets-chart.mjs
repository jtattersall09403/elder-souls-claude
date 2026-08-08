#!/usr/bin/env node
// Draw the W1-22 round-2 headline as a picture: how far the ambience event layers sit above or
// below the bed they land on, per region, before and after.
//
// No browser. The chart is a data plot rather than a view of the game, so `tools/capture/` is the
// wrong instrument — that service exists to photograph the world, and photographing a bar chart
// through a game camera would be a browser launch spent on nothing. Rule 20 asks for
// `tools/capture/` for PICTURES OF THE GAME; this is a picture of a measurement.
//
//   node tools/analysis/ambience-onsets-chart.mjs --out docs/shots/<name>.png

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/cli.mjs';
import { makeText } from '../lib/chart-font.mjs';

const args = parseArgs(process.argv.slice(2));
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const after = JSON.parse(readFileSync(args.after || join(ROOT, 'reports/w1-22/ambience-onsets.json'), 'utf8'));
// The "before" arm is the DELETE-THE-FIX run, not the round-1 report. `--sabotage untrimmed`
// zeroes every `event_gain_db` in the page and re-measures, which holds the 30 s loop buffers, the
// recalibrated bed trims and the corrected onset detector fixed and moves only the thing being
// claimed. Comparing against round 1's own numbers would credit this fix with three other changes.
const before = JSON.parse(readFileSync(args.before
  || join(ROOT, 'reports/w1-22/ambience-onsets-sab-untrimmed.json'), 'utf8'));

// ---- the smallest PNG writer that can draw this ----------------------------------------------
const W = 1100, H = 620;
const px = new Uint8Array(W * H * 3).fill(0x12);
function set(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
}
function rect(x, y, w, h, r, g, b) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b);
}
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const crcT = (() => { const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// A 5x7 bitmap font — enough for a chart label and nothing more.
// The 5x5 chart font now comes from tools/lib/chart-font.mjs. It used to be a copy-pasted table
// of 23-character strings indexed as bits[j * 5 + i] — two characters short of the 25 the stride
// demands, so every row below each missing character was sheared one pixel left and both digits
// and letters rendered wrong. Do not paste a font back in here; see W1-CHARTFONT.
const text = makeText(rect);

// ---- the plot ---------------------------------------------------------------------------------
const ids = Object.keys(after.regions).filter((id) => after.regions[id].tod
  && after.regions[id].tod.day && !after.regions[id].tod.day.error);
const L3 = (rep, id) => {
  const t = rep.regions[id] && rep.regions[id].tod && rep.regions[id].tod.day;
  return t && t.level_rel_bed && t.level_rel_bed.L3 ? t.level_rel_bed.L3.median_rel_db : null;
};

const X0 = 250, X1 = W - 60, Y0 = 120, Y1 = H - 70;
const LO = -34, HI = 8;                             // dB rel. bed
const xOf = (v) => X0 + (v - LO) / (HI - LO) * (X1 - X0);
const rowH = (Y1 - Y0) / ids.length;

// §A's band for L3: -6..+2 dB, "may exceed the bed".
rect(Math.round(xOf(-6)), Y0 - 8, Math.round(xOf(2) - xOf(-6)), Y1 - Y0 + 16, 0x1e, 0x38, 0x2a);
for (const v of [-30, -24, -18, -12, -6, 0, 6]) {
  const x = Math.round(xOf(v));
  for (let y = Y0 - 8; y < Y1 + 8; y += 3) set(x, y, 0x33, 0x33, 0x3a);
  text(`${v}`, x - (String(v).length * 6) / 2, Y1 + 18, 0x88, 0x88, 0x92, 1);
}

ids.forEach((id, i) => {
  const y = Math.round(Y0 + i * rowH + rowH / 2);
  const b = L3(before, id), a = L3(after, id);
  text(id.slice(0, 19), 20, y - 3, 0xcc, 0xcc, 0xd4, 1);
  if (b !== null && a !== null) {
    const xb = Math.round(xOf(Math.max(LO, b))), xa = Math.round(xOf(Math.max(LO, a)));
    for (let x = Math.min(xb, xa); x <= Math.max(xb, xa); x++) rect(x, y - 1, 1, 2, 0x44, 0x44, 0x50);
    rect(xb - 3, y - 3, 6, 6, 0xc0, 0x50, 0x50);       // round 1
    rect(xa - 4, y - 4, 8, 8, 0x50, 0xc8, 0x88);       // round 2
  }
});

text('AMBIENCE EVENT LEVEL RELATIVE TO ITS OWN BED', 20, 26, 0xff, 0xff, 0xff, 2);
text('L3 ONE-SHOTS, MEDIAN, MEASURED FROM RENDERED PCM BY SUBTRACTING THE BED', 20, 52, 0x99, 0x99, 0xa6, 1);
text(`GREEN BAND: RI-AUD03 SECTION A REQUIRES -6 TO +2 DB    RED: ROUND 1    GREEN: ROUND 2`, 20, 70, 0x99, 0x99, 0xa6, 1);
text(`COMMIT ${(after.git && after.git.commit) || '?'}${after.git && after.git.dirty ? ' DIRTY' : ''}   ${after.seconds}S PER REGION   DB RELATIVE TO BED`,
     20, 88, 0x77, 0x77, 0x84, 1);
text('DB RELATIVE TO BED', X0 + (X1 - X0) / 2 - 100, Y1 + 40, 0x88, 0x88, 0x92, 1);

const out = args.out || join(ROOT, 'docs/shots/ambience-event-levels.png');
mkdirSync(dirname(out), { recursive: true });
png(out);
console.log(`wrote ${out}`);
