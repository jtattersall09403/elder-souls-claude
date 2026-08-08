#!/usr/bin/env node
// w1-chartfont-shot.mjs — the rule-27 picture for W1-CHARTFONT: the same strings drawn with the
// pre-fix table and with the fixed one, side by side, at the size a chart actually uses them.
// Both halves are drawn by the SAME renderer through the SAME `makeText`; the only thing that
// differs between the two columns is which glyph table is passed in. That is the whole point:
// the bug was never in the drawing code.
//
//   node tools/analysis/w1-chartfont-shot.mjs [--out docs/shots/<name>.png]

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { FONT, SHEARED_FONT, makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = argOf('--out') || join(ROOT, 'docs/shots/2026-08-08-w1-chartfont-the-charts-were-spelling-numbers-wrong.png');

const W = 1240, H = 640;
const px = new Uint8Array(W * H * 3);
const BG = [0x12, 0x14, 0x13];
for (let i = 0; i < W * H; i++) { px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2]; }
const set = (x, y, r, g, b) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };

function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

const good = makeText(rect, FONT);
const bad = makeText(rect, SHEARED_FONT);

const INK = [0xEE, 0xEE, 0xE4], DIM = [0x86, 0x90, 0x86];
const RED = [0xC2, 0x5B, 0x4E], GREEN = [0x7F, 0xB8, 0x6C];
const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();

good('THE CHART FONT WAS TWO DOTS SHORT IN EVERY LETTER', 40, 32, ...INK, 3);
good('SAME RENDERER, SAME CODE PATH - ONLY THE GLYPH TABLE DIFFERS. LEFT IS WHAT NINE TOOLS PUBLISHED.', 40, 74, ...DIM, 2);
good(`W1-CHARTFONT / MEASURED AT COMMIT ${commit.toUpperCase()}`, 40, 96, ...DIM, 2);

rect(40, 126, W - 80, 1, 0x2A, 0x2E, 0x2A);

bad('AS PUBLISHED - 23 CHARACTERS, STRIDE 5', 60, 150, ...RED, 2);
good('AFTER - 25 CHARACTERS, ROWS VALIDATED', 660, 150, ...GREEN, 2);

const LINES = ['28 OF 32', 'BOOK', 'BY CHANNEL', '2149 SOULS', '0123456789'];
LINES.forEach((s, i) => {
  const y = 200 + i * 78;
  bad(s, 60, y, 0xEE, 0xC8, 0xC0, 5);
  good(s, 660, y, 0xEE, 0xEE, 0xE4, 5);
});

rect(40, 596, W - 80, 1, 0x2A, 0x2E, 0x2A);
good('EVERY ROW BELOW A MISSING DOT SHEARS ONE PIXEL LEFT. A SHEARED 2 IS NEARER AN 8 THAN A 2.', 40, 610, ...DIM, 2);

png(OUT);
console.log('wrote', OUT);
