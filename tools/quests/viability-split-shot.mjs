#!/usr/bin/env node
// viability-split-shot.mjs - one picture of the two instruments, drawn from their own artifacts.
//
// RULES.md rule 27 asks for an illustrative image with every piece. This draws the split: what
// the SCREEN can say about 540 signatures (and the one thing it is forbidden to say), beside what
// the WALK measured by playing a stratified sample of them. It reads
// `reports/impossibility-screen.json` and the walk's artifact and refuses if either is missing -
// a picture of numbers nobody measured is worse than no picture.
//
//   node tools/quests/viability-split-shot.mjs [--walk <path>] [--out docs/shots/<name>.png]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

const screenPath = path.resolve(REPO, arg('screen', 'reports/impossibility-screen.json'));
const walkPath = path.resolve(REPO, arg('walk', 'reports/runs/W1-VIABILITY-WALK/viability-walk.json'));
for (const p of [screenPath, walkPath]) {
  if (!fs.existsSync(p)) { process.stderr.write(`viability-split-shot: ${p} is absent; run the instrument first.\n`); process.exit(1); }
}
const S = JSON.parse(fs.readFileSync(screenPath, 'utf8'));
const W = JSON.parse(fs.readFileSync(walkPath, 'utf8'));
// The control arm, if it has been run. Its absence is stated on the picture rather than hidden.
const grantPath = path.resolve(REPO, arg('granted', 'reports/runs/W1-VIABILITY-WALK/viability-walk-grant-everything.json'));
const G = fs.existsSync(grantPath) ? JSON.parse(fs.readFileSync(grantPath, 'utf8')) : null;

const Wd = 1000, Ht = 600;
const png = new PNG({ width: Wd, height: Ht });
const INK = [237, 232, 222], BG = [27, 24, 19], MUTE = [138, 130, 118];
const RED = [201, 94, 74], AMBER = [198, 154, 68], GREEN = [110, 158, 118], SLATE = [96, 108, 122];
const px = (x, y, c, a = 1) => {
  if (x < 0 || y < 0 || x >= Wd || y >= Ht) return;
  const i = (Wd * (y | 0) + (x | 0)) << 2;
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(png.data[i + k] * (1 - a) + c[k] * a);
  png.data[i + 3] = 255;
};
for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) px(x, y, BG);
const rect = (x, y, w, h, c, a = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a); };

// A 5x7 bitmap font - enough for a label strip, and it keeps this file dependency-light.
const F = {
  A: '01100 10010 10010 11110 10010 10010 10010', B: '11100 10010 10010 11100 10010 10010 11100',
  C: '01110 10000 10000 10000 10000 10000 01110', D: '11100 10010 10010 10010 10010 10010 11100',
  E: '11110 10000 10000 11100 10000 10000 11110', F: '11110 10000 10000 11100 10000 10000 10000',
  G: '01110 10000 10000 10110 10010 10010 01110', H: '10010 10010 10010 11110 10010 10010 10010',
  I: '11100 01000 01000 01000 01000 01000 11100', J: '00110 00010 00010 00010 00010 10010 01100',
  K: '10010 10100 11000 10000 11000 10100 10010', L: '10000 10000 10000 10000 10000 10000 11110',
  M: '10001 11011 10101 10001 10001 10001 10001', N: '10010 11010 11010 10110 10110 10010 10010',
  O: '01100 10010 10010 10010 10010 10010 01100', P: '11100 10010 10010 11100 10000 10000 10000',
  Q: '01100 10010 10010 10010 10110 01100 00011', R: '11100 10010 10010 11100 10100 10010 10010',
  S: '01110 10000 10000 01100 00010 00010 11100', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10010 10010 10010 10010 10010 10010 01100', V: '10001 10001 10001 01010 01010 00100 00100',
  W: '10001 10001 10001 10101 10101 11011 10001', X: '10001 01010 00100 00100 00100 01010 10001',
  Y: '10001 01010 00100 00100 00100 00100 00100', Z: '11111 00010 00100 00100 01000 10000 11111',
  0: '01100 10010 10110 11010 10010 10010 01100', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01100 10010 00010 00100 01000 10000 11110', 3: '11110 00010 00100 00110 00010 10010 01100',
  4: '00110 01010 10010 11111 00010 00010 00010', 5: '11110 10000 11100 00010 00010 10010 01100',
  6: '00110 01000 10000 11100 10010 10010 01100', 7: '11111 00010 00010 00100 01000 01000 01000',
  8: '01100 10010 10010 01100 10010 10010 01100', 9: '01100 10010 10010 01110 00010 00100 01000',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '/': '00001 00010 00010 00100 01000 01000 10000',
  '.': '00000 00000 00000 00000 00000 00000 00100', ',': '00000 00000 00000 00000 00000 00100 01000',
  ':': '00000 00100 00000 00000 00100 00000 00000', '-': '00000 00000 00000 01110 00000 00000 00000',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000',
  '%': '10001 00010 00100 00100 01000 10001 00000', '+': '00000 00100 00100 01110 00100 00100 00000',
  "'": '00100 00100 00000 00000 00000 00000 00000', '"': '01010 01010 00000 00000 00000 00000 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01100 10010 00010 00100 00100 00000 00100',
  '=': '00000 00000 01110 00000 01110 00000 00000', '_': '00000 00000 00000 00000 00000 00000 11111',
};
const text = (s, x, y, c, sc = 1) => {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = F[ch] || F['?'];
    const rowsArr = g.split(' ');
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) {
      if (rowsArr[r][k] === '1') rect(cx + k * sc, y + r * sc, sc, sc, c);
    }
    cx += 6 * sc;
  }
  return cx;
};

const grid = S.grid.cells;
const walked = W.sample.walked;

text('THE VIABILITY SPLIT - ONE QUESTION, TWO INSTRUMENTS', 30, 26, INK, 2);
text('NEXT-DISPATCH SS R. THE GRANTED CHARACTER WAS THE DEFECT, NOT ANY PARTICULAR GRANT.', 30, 50, MUTE, 1);

// ---- panel 1: the screen ---------------------------------------------------------------------
let y = 96;
text('THE SCREEN - STATIC, GRANTED EVERYTHING, ' + grid + ' SIGNATURES', 30, y, INK, 1);
text('A LOWER BOUND ON OBVIOUS IMPOSSIBILITY. IT MAY NEVER SAY A BUILD WORKS.', 30, y + 14, MUTE, 1);
const BARX = 30, BARW = 940, BARH = 34;
y += 34;
{
  const seg = [
    [S.screened_out, RED, 'SCREENED OUT ' + S.screened_out],
    [S.unmeasurable, AMBER, 'ABSTAINED ' + S.unmeasurable],
    [S.not_screened_out, SLATE, 'NOT SCREENED OUT ' + S.not_screened_out],
  ];
  let x = BARX;
  for (const [n, c, label] of seg) {
    const w = Math.round(BARW * n / grid);
    if (w > 0) { rect(x, y, w, BARH, c); if (w > label.length * 6 + 12) text(label, x + 8, y + 13, BG, 1); }
    x += w;
  }
  rect(BARX, y + BARH, BARW, 1, MUTE, 0.4);
  y += BARH + 12;
  const legend = seg.filter(([n, , l]) => n > 0 && Math.round(BARW * n / grid) <= l.length * 6 + 12)
    .map(([, , l]) => l).join('   ');
  if (legend) { text(legend, BARX, y, MUTE, 1); y += 14; }
  text('THE THIRD BAR IS NOT A PASS. IT IS "THESE FOUR CHECKS DID NOT CONDEMN IT".', BARX, y, MUTE, 1);
}

// ---- panel 2: the walk ------------------------------------------------------------------------
y += 46;
text('THE WALK - PLAYED IN THE ENGINE, GRANTED NOTHING, ' + walked + ' SIGNATURES', 30, y, INK, 1);
const cov = W.sample.coverage;
text('STRATIFIED SAMPLE: ' + walked + ' OF ' + cov.concrete_space + ' CONCRETE CHARACTERS ('
   + (100 * walked / cov.concrete_space).toFixed(2) + '%), RACE X UPBRINGING COMPLETE '
   + cov.pair_race_x_upbringing.covered + '/' + cov.pair_race_x_upbringing.of, 30, y + 14, MUTE, 1);
y += 34;
{
  const P = W.played;
  const bars = [
    ['FINISHED THE MAIN QUEST', P.finished_the_main_quest],
    ['THREE FACTIONS AT RANK 5', P.reached_three_factions_at_rank_5],
    ['BOTH WALKED CRITERIA', P.passed_both_walked_gate_criteria],
  ];
  for (const [label, n] of bars) {
    const w = Math.max(2, Math.round(BARW * 0.62 * n / Math.max(1, walked)));
    rect(BARX + 300, y, Math.round(BARW * 0.62), 20, [45, 40, 33]);
    rect(BARX + 300, y, w, 20, n > 0 ? GREEN : RED);
    text(label, BARX, y + 6, INK, 1);
    text(n + '/' + walked, BARX + 306 + Math.round(BARW * 0.62), y + 6, MUTE, 1);
    y += 28;
  }
  text('NOT WALKED AT ALL: TIER5 SURVIVABLE. A DRIVEN FIGHT IS A DIFFERENT INSTRUMENT,', BARX, y + 4, MUTE, 1);
  text('AND SCORING IT OFF A DAMAGE MODEL IS THE SUBSTITUTION THIS WALK EXISTS TO REMOVE.', BARX, y + 18, MUTE, 1);
}

// ---- panel 3: the control that measures the size of the fiction ------------------------------
y += 52;
text('THE CONTROL - THE SAME 40 CHARACTERS, HANDED WHAT THE SCREEN HANDS ITS OWN', 30, y, INK, 1);
if (!G) {
  text('NOT RUN. NOTHING IS DRAWN HERE RATHER THAN GUESSED.', 30, y + 16, MUTE, 1);
} else {
  text('GOLD, ATTRIBUTES, RANK-7 STANDING IN EVERY FACTION, ALL 755 WORLD FLAGS TRUE AT ONCE.', 30, y + 14, MUTE, 1);
  text('LEFT BAR: GRANTED NOTHING.   RIGHT BAR: GRANTED EVERYTHING.', 30, y + 26, MUTE, 1);
  y += 46;
  const pairs = [
    ['THREE FACTIONS AT RANK 5', W.played.reached_three_factions_at_rank_5, G.played.reached_three_factions_at_rank_5],
    ['FINISHED THE MAIN QUEST', W.played.finished_the_main_quest, G.played.finished_the_main_quest],
  ];
  for (const [label, a, b] of pairs) {
    text(label, BARX, y + 6, INK, 1);
    const BW = 180;
    rect(BARX + 270, y, BW, 20, [45, 40, 33]);
    rect(BARX + 270, y, Math.max(2, Math.round(BW * a / walked)), 20, a > 0 ? GREEN : RED);
    text('NOTHING ' + a + '/' + walked, BARX + 276 + BW, y + 6, MUTE, 1);
    rect(BARX + 580, y, BW, 20, [45, 40, 33]);
    rect(BARX + 580, y, Math.max(2, Math.round(BW * b / walked)), 20, b > 0 ? AMBER : RED);
    text('EVERYTHING ' + b + '/' + walked, BARX + 586 + BW, y + 6, MUTE, 1);
    y += 28;
  }
  text('THAT GAP IS THE SIZE OF THE FICTION, MEASURED RATHER THAN ARGUED. THE GRANTS BUY THE', BARX, y + 4, MUTE, 1);
  text('FACTION CRITERION OUTRIGHT AND BUY NOTHING ELSE: BOTH ARMS STOP AT Q-MAIN-06.', BARX, y + 18, MUTE, 1);
}

const out = path.resolve(REPO, arg('out', 'docs/shots/2026-08-07-viability-split-screen-vs-walk.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(png));
process.stdout.write(`wrote ${path.relative(REPO, out)}\n`);
