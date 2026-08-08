// THE PICTURE FOR W1-17: how many things there are to ask about, and how many of them anybody
// can reach — before this round and after it. Drawn with no browser, because it is a chart about
// data and the box was at its contention ceiling.
//
//   node tools/dialogue/w1-17-shot.mjs
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const { PNG } = await import(url.pathToFileURL(path.join(ROOT, 'tools/node_modules/pngjs/lib/png.js')).href);

const W = 1000, H = 900;
const png = new PNG({ width: W, height: H });
const BG = [18, 20, 24], FG = [232, 230, 224], DIM = [128, 132, 140];
const BEFORE = [92, 84, 78], AFTER = [96, 168, 132], BAD = [190, 92, 84];

function px(x, y, c, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * (y | 0) + (x | 0)) << 2;
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(png.data[i + k] * (1 - a) + c[k] * a);
  png.data[i + 3] = 255;
}
function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); }

// A 5x7 pixel font — enough for a chart, and it keeps this file free of any dependency that
// could go missing the way `pngjs` nearly did.
const F = {
  'A': '01110100011000111111100011000110001',
  'B': '11110100011000111110100011000111110',
  'C': '01110100011000010000100001000101110',
  'D': '11110100011000110001100011000111110',
  'E': '11111100001000011110100001000011111',
  'F': '11111100001000011110100001000010000',
  'G': '01110100011000010111100011000101111',
  'H': '10001100011000111111100011000110001',
  'I': '11111001000010000100001000010011111',
  'J': '00111000100001000010000101001001100',
  'K': '10001100101010011000101001001010001',
  'L': '10000100001000010000100001000011111',
  'M': '10001110111010110101100011000110001',
  'N': '10001110011010110011100011000110001',
  'O': '01110100011000110001100011000101110',
  'P': '11110100011000111110100001000010000',
  'Q': '01110100011000110001101011001001101',
  'R': '11110100011000111110101001001010001',
  'S': '01111100001000001110000010000111110',
  'T': '11111001000010000100001000010000100',
  'U': '10001100011000110001100011000101110',
  'V': '10001100011000110001100010101000100',
  'W': '10001100011000110101101011101110001',
  'X': '10001100010101000100010101000110001',
  'Y': '10001100010101000100001000010000100',
  'Z': '11111000010001000100010001000011111',
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000',
  '-': '00000000000000001110000000000000000',
  '.': '00000000000000000000000000110001100',
  ':': '00000011000110000000011000110000000',
  '(': '00010001000100001000010000010000010',
  ')': '01000001000001000010000100010001000',
  '/': '00001000100001000100010000100010000',
  ',': '00000000000000000000011000010001000',
  '+': '00000001000010011111001000010000000',
  '\'': '00100001000000000000000000000000000',
};
function glyph(ch, x, y, c, s = 2) {
  const g = F[ch.toUpperCase()] ?? F[' '];
  for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j * 5 + i] === '1') rect(x + i * s, y + j * s, s, s, c);
}
function text(t, x, y, c, s = 2) { let cx = x; for (const ch of t) { glyph(ch, cx, y, c, s); cx += 6 * s; } return cx; }

rect(0, 0, W, H, BG);
text('W1-17 R2: A TENTH OF THE WRITING HAD NO MOUTH', 30, 28, FG, 3);
text('136 LINES NO PLAYER COULD HEAR FROM ANYBODY. NOW 6.', 30, 62, DIM, 2);

const rows = [
  ['LINES NOBODY CAN SAY', 136, 6],
  ['  WRITTEN FOR AN ACTOR NOBODY IS', 40, 0],
  ['  GATED TO A TOWN WITH NO SUCH', 90, 0],
  ['  ACTOR STANDING IN IT', 0, 0],
  ['  LOSES TO A BETTER LINE', 6, 6],
  ['ORPHAN TOPICS (RI-DLG01 D)', 0, 23],
];
const X0 = 500, MAXW = 420, MAXV = 140;
let y = 108;
for (const [label, before, after] of rows) {
  if (before === 0 && after === 0) { text(label, 30, y - 26, DIM, 2); continue; }
  text(label, 30, y + 4, FG, 2);
  const wB = Math.max(2, Math.round(before / MAXV * MAXW));
  const wA = Math.max(2, Math.round(after / MAXV * MAXW));
  rect(X0, y, wB, 13, BAD);
  text(String(before), X0 + wB + 10, y, DIM, 2);
  rect(X0, y + 20, wA, 13, after === 0 ? AFTER : BAD);
  text(String(after), X0 + wA + 10, y + 20, FG, 2);
  y += 58;
}
text('RED BAR: BEFORE THIS ROUND.  GREEN BAR: AFTER.', 30, y + 4, DIM, 2);
text('BOTH ENDS COUNTED BY TOOLS/DIALOGUE/CRITIC-REACH.MJS.', 30, y + 24, DIM, 2);
text('THE 23 ORPHANS WERE ALWAYS THERE - LAST ROUND FILED THEM', 30, y + 48, DIM, 2);
text('IN A BUCKET THAT READ AS ZERO. THEY ARE NOW REPORTED', 30, y + 68, DIM, 2);
text('WHERE THE REFERENCE ITEM SAYS THEY GO.', 30, y + 88, DIM, 2);

y += 120;
rect(30, y, W - 60, 1, DIM);
text('HOW THE 130 WERE CLOSED', 30, y + 22, FG, 3);
const split = [['GIVEN A BODY', 105], ['RE-HOMED', 20], ['CUT', 0]];
let bx = 60;
for (const [lab, n] of split) {
  const h = Math.max(4, Math.round(n * 0.75));
  rect(bx, y + 160 - h, 140, h, n ? AFTER : DIM);
  text(String(n), bx + 50, y + 156 - h - 20, FG, 2);
  text(lab, bx, y + 172, DIM, 2);
  bx += 300;
}
text('22 NPC RECORDS GAVE THE ARCHIVIST, MUDBORN AND SAPCUTTER REGISTERS A SPEAKER', 30, y + 206, DIM, 2);
text('IN THE TOWNS THEIR LINES WERE ALREADY WRITTEN FOR, AND GAVE THE ONE MAGISTER', 30, y + 226, DIM, 2);
text('THE CORPUS NAMES - VARO DREN - A BODY TO SAY 23 LINES WITH. NO PROSE WAS', 30, y + 246, DIM, 2);
text('REWRITTEN AND NO LINE WAS ADDED.', 30, y + 266, DIM, 2);

const out = path.join(ROOT, 'docs/shots/2026-08-08-w1-17-r2-a-tenth-of-the-writing-had-no-mouth.png');
fs.writeFileSync(out, PNG.sync.write(png));
console.log('wrote ' + path.relative(ROOT, out));
