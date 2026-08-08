#!/usr/bin/env node
// w1-25-chart.mjs — THE PICTURE FOR W1-25: three controls that were run, exited 0, and measured
// nothing — and what each of them looks like when the arms are drawn side by side.
//
// Raw PNG, deflate only, no dependencies — the same way every other chart in this tree is drawn.
// Every number is read from the artifact on disk, never typed in here.
'use strict';

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const W = 1280, H = 720;

// ---- a tiny raster ---------------------------------------------------------------------------
const buf = Buffer.alloc(W * H * 3);
const px = (x, y, r, g, b) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
};
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c[0], c[1], c[2]); };
const line = (x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c[0], c[1], c[2]);
};

// 5x7 bitmap font, upper case + digits + a little punctuation.
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
  '?': '01110100010000100110001000000000100', '!': '00100001000010000100001000000000100',
};
function text(s, x, y, c, scale = 2) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = F[ch] || F['?'];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r * 5 + col] === '1') rect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
  return cx;
}

// ---- the palette -----------------------------------------------------------------------------
const BG = [16, 18, 22], GRID = [40, 44, 52], INK = [226, 228, 233], DIM = [130, 136, 148];
const RED = [206, 84, 74], GREEN = [96, 168, 112], AMBER = [206, 154, 68], BLUE = [96, 140, 200];

rect(0, 0, W, H, BG);

// ---- the data, read from disk ----------------------------------------------------------------
const read = (p) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : null);
const sab = read('reports/experience/w1/sabotage.json');
const byId = new Map(((sab && sab.historical && sab.historical.results) || []).map((r) => [r.id, r]));
const pick = (frag) => [...byId.entries()].find(([k]) => k.includes(frag));

const panels = [
  { frag: 'w1-04-collision.BROKEN', title: 'W1-04  THE CONTROL ARM WAS INERT', sub: 'THE PRE-FIX VERB, RE-CREATED IN THE PAGE' },
  { frag: 'w1-04-collision.FIXED', title: 'W1-04  THE SAME CHECK, ONE LINE DELETED', sub: 'THE SHIPPED VERB' },
  { frag: 'FACTORIAL', title: 'W1-SOULS  TWO GUARDS, NEITHER ALONE', sub: 'FOUR BROWSER RUNS, ENUMERATED AS A 2X2' },
  { frag: 'NIGHT-ROSTER at the hearth', title: 'W1-13  THE CONTROL HAD NOBODY IN IT', sub: 'THE CLAUSE THAT SET THE ITEM SCORE' },
];

text('A CONTROL FAILS WHEN ITS ARMS AGREE', 40, 34, INK, 3);
text('FOUR CONTROLS THIS TREE SHIPPED GREEN, REPLAYED FROM THE ARTIFACTS THEY LEFT', 40, 68, DIM, 2);

const PX = 40, PY = 110, PW = 590, PH = 268, GAP = 20;
panels.forEach((p, i) => {
  const e = pick(p.frag);
  const r = e ? e[1] : null;
  const x = PX + (i % 2) * (PW + GAP), y = PY + Math.floor(i / 2) * (PH + GAP);
  rect(x, y, PW, PH, [22, 25, 30]);
  for (let k = 0; k < PW; k++) px(x + k, y, GRID[0], GRID[1], GRID[2]);
  text(p.title, x + 16, y + 16, INK, 2);
  text(p.sub, x + 16, y + 40, DIM, 1);

  if (!r) { text('ARTIFACT ABSENT', x + 16, y + 90, RED, 2); return; }
  const good = r.verdict === 'OK';
  const col = good ? GREEN : (r.verdict === 'VACUOUS' ? AMBER : RED);
  text(r.verdict, x + 16, y + 62, col, 3);

  // the arms, as bars
  const arms = r.arms.slice(0, 4);
  const num = (v) => {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v.reduce((s, q) => s + (Number(q) || 0), 0);
    if (v && typeof v === 'object') return Object.values(v).reduce((s, q) => s + (Number(q) || 0), 0);
    return 0;
  };
  const vals = arms.map((a) => num(a.value));
  const max = Math.max(1, ...vals);
  const BX = x + 20, BY = y + 106, BW = PW - 210, BH = 26;
  arms.forEach((a, j) => {
    const v = num(a.value);
    const yy = BY + j * (BH + 8);
    const w = Math.max(2, Math.round((v / max) * BW));
    rect(BX, yy, BW, BH, [30, 34, 40]);
    rect(BX, yy, w, BH, a.broken.length === 0 ? BLUE : col);
    text(a.arm.slice(0, 20).replace(/[()]/g, ''), BX + BW + 12, yy + 6, DIM, 1);
    text(String(v), BX + BW + 12 + 130, yy + 6, INK, 1);
    // support: the number of units the arm ranged over
    text('N=' + String(a.support), BX + 6, yy + 8, [16, 18, 22], 1);
  });
  // The caption starts BELOW the last bar, whatever the arm count. The first draft pinned it at
  // a constant y and the 2x2 panel drew its fourth arm straight through the sentence.
  const capY = BY + arms.length * (BH + 8) + 10;
  const maxRows = Math.max(1, Math.floor((y + PH - 10 - capY) / 14));
  const why = String(r.why || '').toUpperCase().replace(/[^A-Z0-9 .,:%()\-\/>=+!?]/g, ' ');
  const words = why.split(' ');
  let ln = '', row = 0;
  for (const wd of words) {
    if ((ln + ' ' + wd).length > 68) { text(ln, x + 16, capY + row * 14, DIM, 1); ln = wd; row++; if (row >= maxRows) { ln = ''; break; } }
    else ln = ln ? ln + ' ' + wd : wd;
  }
  if (ln && row < maxRows) text(ln, x + 16, capY + row * 14, DIM, 1);
});

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* */ }
text('BLUE = INTACT ARM.  BAR LENGTH = THE VALUE.  N = HOW MANY UNITS THE ARM RANGED OVER.', 40, 668, DIM, 1);
text('W1-25  TOOLS/EXPERIENCE/SABOTAGE.MJS --CASES  AT ' + commit, 40, 690, DIM, 1);

// ---- encode ----------------------------------------------------------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const out = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-25-a-control-fails-when-its-arms-agree.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`);
