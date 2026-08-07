#!/usr/bin/env node
// One picture for the W1-23 round-1 verdict: what the register is measured to do, next to what
// it is measured NOT to do. No browser — this is drawn pixel by pixel with pngjs, because the
// figures it draws are counts taken off the shipped data and a browser would add nothing but
// contention (RULES.md #21; 18 headless_shell were live when this ran).
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from '../node_modules/pngjs/lib/png.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// 5x7 glyphs, the subset this caption needs.
const F = {
  A: '01100100101001011111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '11111001000010000100001000010011111',
  J: '00111000010000100001000110001001110', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110001100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110001101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100011000101010001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100111010110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100110010001000011111',
  3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100001000010000100', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000001100011',
  ',': '00000000000000000000000000110001000', '-': '00000000000000111110000000000000000',
  '/': '00001000100010001000100010001000000', ':': '00000011000110000000011000110000000',
  '%': '11001110010001000100010001001100111', '(': '00010001000100001000010000100000010',
  ')': '01000001000001000010000100010001000', '=': '00000000001111100000111110000000000',
  "'": '00100001000010000000000000000000000', '"': '01010010100000000000000000000000000',
};

const W = 1000, H = 500;
const png = new PNG({ width: W, height: H });
const BG = [17, 19, 22], INK = [232, 232, 228], DIM = [128, 132, 138];
const GREEN = [96, 176, 112], RED = [198, 92, 78], AMBER = [198, 154, 74];

function px(x, y, c, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * (y | 0) + (x | 0)) << 2;
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(png.data[i + k] * (1 - a) + c[k] * a);
  png.data[i + 3] = 255;
}
function rect(x, y, w, h, c, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a); }
function text(s, x, y, c, sc = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = F[ch] ?? F[' '];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) if (g[r * 5 + col] === '1') rect(cx + col * sc, y + r * sc, sc, sc, c);
    cx += 6 * sc;
  }
  return cx;
}

rect(0, 0, W, H, BG);
text('W1-23  THE CANON REGISTER, AND WHAT IT IS MEASURED TO DO', 28, 26, INK, 2);
text('CRITIC ROUND 1 . COMMIT 5C4C5B00 . ALL FIGURES COUNTED OFF THE SHIPPED TREE, NO BROWSER', 28, 48, DIM, 1);
rect(28, 66, W - 56, 1, DIM, 0.5);

const rows = [
  ['DISPUTES FULLY VOICED, RI-LOR06 METHOD 4', 27, 27, GREEN, '27 OF 27 . THE BAR IS 8 . THE PIECE CLEARS IT'],
  ['ENGINE READS THE REGISTER AND THROWS ON A DANGLE', 1, 1, GREEN, 'REAL . INSTALLCANON RESOLVES 141 REFERENCES AT BOOT'],
  ['DIALOGUE VOICES THAT THE REGISTER ACTUALLY GATES', 50, 70, AMBER, '20 OF 70 NAME AN INFO CARRYING NO CF TAG'],
  ['PEOPLE WHO HOLD A POSITION AND HAVE A LINE FOR IT', 156, 347, AMBER, 'THE REPORT SAYS 336 OF 336 HOLD ONE . 191 CANNOT SAY IT'],
  ['SEALED RULINGS THAT STAY SEALED', 17, 26, RED, '9 OF 26 FALL TO THREE GUESSES AGAINST THEIR OWN IDS'],
  ['ANSWERS THE REGISTER CHANGES, WHOLE PROVINCE', 31, 3234, RED, '31 OF 161702 NPC-TOPIC PAIRS . ALL SILENCINGS, NO SWAPS'],
];

let y = 92;
for (const [label, num, den, col, note] of rows) {
  text(label, 28, y, INK, 1);
  const bx = 28, by = y + 13, bw = W - 56, bh = 12;
  rect(bx, by, bw, bh, [38, 41, 46]);
  rect(bx, by, Math.max(2, Math.round(bw * (num / den))), bh, col);
  text(`${num} / ${den === 3234 ? '161702' : den}`, bx + bw - 6 * String(`${num} / ${den === 3234 ? '161702' : den}`).length - 6, y, col, 1);
  text(note, bx + 4, by + 17, DIM, 1);
  y += 58;
}

rect(28, H - 62, W - 56, 1, DIM, 0.5);
text('DELETE THE REGISTER AND THE PROVINCE STILL DISAGREES: 5 ANSWERS ON THE-THINNING AND 3 ON SLAVERY,', 28, H - 50, INK, 1);
text('BYTE-IDENTICAL WITH AND WITHOUT IT. BOTH REGISTERED VOICES ON SLAVERY ARE COLONISTS: AN IMPERIAL', 28, H - 36, INK, 1);
text('CLERK AND A HOUSE DRES FACTOR. THE ONLY ARGONIAN LINE ON THE SUBJECT IS A REFUSAL, AND IT IS UNTAGGED.', 28, H - 22, INK, 1);

const out = path.join(ROOT, 'docs/shots/2026-08-07-w1-23-critic-r1-what-the-canon-register-changes.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(png));
console.log(`wrote ${path.relative(ROOT, out)}`);
