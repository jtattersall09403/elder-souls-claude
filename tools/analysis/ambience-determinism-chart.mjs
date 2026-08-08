#!/usr/bin/env node
// Draw the W1-22 round-3 headline as a picture: which ambience beds render the same sound twice.
//
// No browser. This is a picture of a MEASUREMENT, not of the game, so `tools/capture/` is the wrong
// instrument (RULES.md rule 20 asks for it for pictures of the world). Both arms come off disk:
//
//   reports/w1-22/ambience-determinism.json              the fix in
//   reports/w1-22/ambience-determinism-sab-flatmix.json  DELETE-THE-FIX, flat summation restored
//
//   node tools/analysis/ambience-determinism-chart.mjs --out docs/shots/<name>.png

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/cli.mjs';
import { makeText } from '../lib/chart-font.mjs';

const args = parseArgs(process.argv.slice(2));
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const fixed = JSON.parse(readFileSync(args.fixed || join(ROOT, 'reports/w1-22/ambience-determinism.json'), 'utf8'));
const flat = JSON.parse(readFileSync(args.flat || join(ROOT, 'reports/w1-22/ambience-determinism-sab-flatmix.json'), 'utf8'));

const W = 1100, H = 700;
const px = new Uint8Array(W * H * 3).fill(0x12);
function set(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
}
function rect(x, y, w, h, r, g, b) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b);
}
// ---- PNG writer and 5x7 font, same as tools/analysis/ambience-onsets-chart.mjs ---------------
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
// One row per bed. Left column: the delete-the-fix arm (flat summation, the round-2 topology).
// Right column: the same beds with the deterministic mixer in. A filled red block is a bed that
// did NOT render the same bytes twice with nothing perturbed between the captures.
const beds = [...new Set([...Object.keys(flat.beds), ...Object.keys(fixed.beds)]
  .filter((k) => k.endsWith('|day')).map((k) => k.slice(0, -4)))];

const X0 = 300, COLW = 300, Y0 = 165, ROW = 22;
const cell = (arm, bed) => (arm.beds[`${bed}|day`] || null);

text('DOES THE SAME BED RENDER THE SAME SOUND TWICE', 20, 26, 0xff, 0xff, 0xff, 2);
text('RI-AUD03 R3. THREE CAPTURES PER BED, IDENTICAL ARGUMENTS, NOTHING TOUCHED BETWEEN THEM.', 20, 54, 0x99, 0x99, 0xa6, 1);
text('THE DIVERGENCE IS ONE FLOAT ULP: THE PLATFORM SUMS A NODES INPUTS IN A RUN-DEPENDENT ORDER,', 20, 72, 0x99, 0x99, 0xa6, 1);
text('AND FLOATING-POINT ADDITION IS NOT ASSOCIATIVE ONCE THERE ARE THREE OF THEM.', 20, 90, 0x99, 0x99, 0xa6, 1);
text(`COMMIT ${(fixed.git && fixed.git.commit) || '?'}${fixed.git && fixed.git.dirty ? ' DIRTY' : ''}   ${fixed.seconds}S PER CAPTURE AT ${fixed.sample_rate} HZ`,
     20, 112, 0x77, 0x77, 0x84, 1);

text('FLAT SUMMATION', X0, 138, 0xe0, 0x80, 0x80, 1);
text('(DELETE-THE-FIX)', X0, 150, 0x90, 0x60, 0x60, 1);
text('CHAINED, TWO AT A TIME', X0 + COLW, 138, 0x80, 0xe0, 0xa0, 1);
text('(SHIPPED)', X0 + COLW, 150, 0x60, 0x90, 0x70, 1);

let nFlatBad = 0, nFixBad = 0;
beds.forEach((bed, i) => {
  const y = Y0 + i * ROW;
  text(bed.slice(0, 19), 20, y, 0xcc, 0xcc, 0xd4, 1);
  for (const [k, arm] of [[0, flat], [1, fixed]]) {
    const c = cell(arm, bed);
    const x = X0 + k * COLW;
    if (!c) { text('-', x, y, 0x55, 0x55, 0x5c, 1); continue; }
    if (c.identical) {
      rect(x, y, 10, 8, 0x2e, 0x6e, 0x4a);
      text('SAME', x + 16, y, 0x70, 0xa0, 0x88, 1);
    } else {
      if (k === 0) nFlatBad++; else nFixBad++;
      rect(x, y, 10, 8, 0xc0, 0x40, 0x40);
      const d = c.diffs && c.diffs[0];
      text(`DIFFERS  ${d ? d.differing_samples : '?'} SAMPLES`, x + 16, y, 0xe0, 0x90, 0x90, 1);
    }
  }
});

const yF = Y0 + beds.length * ROW + 18;
rect(20, yF - 6, W - 40, 1, 0x33, 0x33, 0x3a);
text(`${nFlatBad} OF ${beds.length} BEDS DO NOT REPRODUCE WITH THE FIX DELETED`, 20, yF + 8, 0xe0, 0x90, 0x90, 1);
text(`${nFixBad} OF ${beds.length} DO NOT REPRODUCE AS SHIPPED`, 20, yF + 26, 0x80, 0xe0, 0xa0, 1);
text('ROUND 2 FOUND TWO OF THEM. THE FAULT IS INTERMITTENT, SO A SINGLE GREEN FROM A FLAT', 20, yF + 48, 0x88, 0x88, 0x92, 1);
text('TOPOLOGY PROVES NOTHING - WHICH IS WHY NO GATE IN ROUNDS 1 OR 2 EVER CAUGHT IT.', 20, yF + 62, 0x88, 0x88, 0x92, 1);

const out = args.out || join(ROOT, 'docs/shots/ambience-determinism.png');
mkdirSync(dirname(out), { recursive: true });
png(out);
console.log(`wrote ${out}`);
