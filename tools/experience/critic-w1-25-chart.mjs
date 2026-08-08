#!/usr/bin/env node
// critic-w1-25-chart.mjs — ONE PICTURE FOR THE W1-25 VERDICT.
//
// The same control, from the same two artifacts, three times — and the facility's verdict
// changing because the caller changed one integer. Raw PNG, deflate only, no dependencies,
// every number read from reports/experience/critic-w1-25.json rather than typed in here.
'use strict';

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SRC = join(ROOT, 'reports/experience/critic-w1-25.json');
if (!existsSync(SRC)) {
  console.error('ABSENT: reports/experience/critic-w1-25.json — run tools/experience/critic-w1-25.mjs --out reports/experience/critic-w1-25.json first.');
  process.exit(8);
}
const R = JSON.parse(readFileSync(SRC, 'utf8'));
const W = 1280, H = 720;
const buf = Buffer.alloc(W * H * 3);
const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };

const F = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '11111001000010000100001000010011111', J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110001100011000110001', N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100',
  W: '10001100011000110001101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100010001000100011111', 3: '11111000100010000010000011000101110',
  4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100001000010000100',
  8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000110001100',
  ',': '00000000000000000000000001100011000', '-': '00000000000000111000000000000000000',
  ':': '00000011000110000000011000110000000', '/': '00001000100010000100010001000010000',
  '>': '01000001000001000001000010000100000', '(': '00010001000100001000010000010000010',
  ')': '01000000100000100001000010001000100', '%': '11001110010001000100010001001110011',
  '+': '00000001000010011111001000010000000', '=': '00000000001111100000111110000000000',
  '?': '01110100010000100110001000000000100', '!': '00100001000010000100001000000000100', '_': '00000000000000000000000000000011111',
};
function text(s, x, y, c, scale = 2) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = F[ch] || F['?'];
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r * 5 + k] === '1') rect(cx + k * scale, y + r * scale, scale, scale, c);
    cx += 6 * scale;
  }
}

const BG = [12, 13, 16], INK = [232, 234, 238], DIM = [128, 134, 146];
const GREEN = [90, 190, 120], RED = [226, 92, 84], AMBER = [232, 170, 70];
rect(0, 0, W, H, BG);

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* stamped as unknown */ }

text('THE SAME CONTROL. THE SAME TWO FILES. THREE VERDICTS.', 40, 34, INK, 3);
text('W1-14-R3 SHIPPED --BREAK=NOCAST AND DECLARED IT WORKING. A CRITIC FOUND IT INERT.', 40, 72, DIM, 2);
text('PUT IT THROUGH W1-25S SABOTAGE FACILITY AND WHAT COMES BACK DEPENDS ON ONE INTEGER THE CALLER CHOOSES.', 40, 96, DIM, 1);

const A = (R.sections && R.sections.A) || {};
const panels = [
  { k: 'A1', label: 'SUPPORT = EFFECTS EXAMINED', sub: '55 IN BOTH ARMS', v: A.A1 && A.A1.verdict },
  { k: 'A2', label: 'SUPPORT = EFFECTS DELIVERED', sub: '55 INTACT / 0 CONTROL', v: A.A2 && A.A2.verdict },
  { k: 'A3', label: 'SUPPORT NOT DECLARED', sub: 'THE FIELD IS OPTIONAL', v: A.A3 && A.A3.verdict },
];
const colFor = (v) => (v === 'OK' ? RED : v === 'VACUOUS' ? GREEN : AMBER);
panels.forEach((p, i) => {
  const x = 40 + i * 402, y = 140, w = 378, h = 216;
  rect(x, y, w, h, [22, 24, 29]);
  rect(x, y, w, 4, colFor(p.v));
  text(p.k, x + 16, y + 22, DIM, 2);
  text(p.v || '?', x + 16, y + 56, colFor(p.v), 4);
  text(p.v === 'OK' ? 'THE INERT CONTROL PASSES' : 'THE INERT CONTROL IS CAUGHT', x + 16, y + 112, INK, 1);
  text(p.label, x + 16, y + 140, DIM, 1);
  text(p.sub, x + 16, y + 160, DIM, 1);
  text('33 COUPLED  ->  0 COUPLED', x + 16, y + 186, DIM, 1);
});

// The crossings recount.
const D = (R.sections && R.sections.D) || {};
rect(40, 396, 1200, 4, [40, 44, 52]);
text('AND THE PIECES HEADLINE CROSSINGS NUMBER, RECOUNTED', 40, 420, INK, 2);
text('MATRIX-SCAN REPORTED 4 OF 41 SEAM CROSSINGS AS HAVING ANY DATA AT ALL. IT READ 564 FILES AND NEVER LOOKED IN THIS ONE:', 40, 452, DIM, 1);
text('GAME/DATA/WORLD/ENCOUNTERS.JSON', 40, 472, AMBER, 2);
(D.rows || []).forEach((row, i) => {
  const y = 506 + i * 34;
  rect(40, y, 8, 24, RED);
  text(row.cell, 62, y + 8, INK, 2);
  text(row.key, 240, y + 8, AMBER, 1);
  text('REPORTED AS HAVING NO DATA. IT HAS ' + String(row.occurrences) + '.', 520, y + 8, DIM, 1);
});
text('AT LEAST 8 OF 41, NOT 4. EVERY MISSED CROSSING IS DECLARED ON THE TARGET SYSTEM, AND EVERY SCANNER PATTERN LOOKS AT THE SOURCE.', 40, 654, GREEN, 1);
text('CRITIC-W1-25  MEASURED AT ' + commit + '  ' + String(R.at || '').slice(0, 19), 40, 690, DIM, 1);

// ---- PNG ------------------------------------------------------------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = join(ROOT, 'docs/shots/2026-08-08-critic-w1-25-one-integer-decides-the-verdict.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log('wrote ' + out + ' (' + png.length + ' bytes)');
