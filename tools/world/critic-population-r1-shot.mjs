#!/usr/bin/env node
/**
 * critic-population-r1-shot.mjs — the W1-POPULATION round-1 critic's illustrative image.
 *
 * The subject is NOT a stretch of road. The builder already photographed that, correctly and
 * admissibly, and it shows a populated highway. The subject of THIS critique is a thing a
 * photograph of one place cannot show: the province declares five danger tiers, and along the
 * 6.8 km crossing the tier changes almost nothing a player can feel. That is a shape, and a
 * shape wants a diagram.
 *
 * Drawn straight from the shipped data with no browser and no engine:
 *   game/data/world/population-posts.json, population.json, encounters.json,
 *   combat/enemies/*.json.
 *
 * Written with pngjs, which is already in tools/node_modules for the fidelity harness.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const posts = R('game/data/world/population-posts.json').posts;
const model = R('game/data/world/population.json');
const encDoc = R('game/data/world/encounters.json');
const ENC = {};
for (const x of (encDoc.encounters || encDoc)) ENC[x.id] = (x.members || []).flatMap((m) => Array(m.count || 1).fill(m.statblock));
const S = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/combat/enemies'))) {
  const d = R('game/data/combat/enemies/' + f); S[d.id] = d;
}

// ---- the numbers the picture is about ------------------------------------------------------
const road = posts.filter((p) => p.kind === 'road');
const per = {};
for (const q of posts) {
  const t = q.tier;
  per[t] ||= { posts: 0, bodies: 0, souls: 0, gaps: [] };
  per[t].posts++; per[t].bodies += q.bodies; per[t].souls += q.souls;
}
// median road spacing per tier, within a leg
const gapsByTier = {};
for (const q of road) (gapsByTier[q.tier] ||= {})[q.leg] ||= [];
for (const q of road) gapsByTier[q.tier][q.leg].push(q.at_m);
const medGap = {};
for (const t of [1, 2, 3, 4, 5]) {
  const g = [];
  for (const leg of Object.keys(gapsByTier[t] || {})) {
    const a = gapsByTier[t][leg].slice().sort((x, y) => x - y);
    for (let i = 1; i < a.length; i++) g.push(a[i] - a[i - 1]);
  }
  g.sort((a, b) => a - b);
  medGap[t] = g.length ? g[Math.floor(g.length / 2)] : NaN;
}
const CONTRACT = { 1: 1.0, 2: 3.2, 3: 7.9, 4: 15.5, 5: 24.4 };  // RI-PRG06 §2 tier multiplier
const soulsPerBody = {};
for (const t of [1, 2, 3, 4, 5]) soulsPerBody[t] = per[t].souls / per[t].bodies;
const realised = {};
for (const t of [1, 2, 3, 4, 5]) realised[t] = soulsPerBody[t] / soulsPerBody[1];
const tierMult = model.tier_multiplier;

// ---- canvas ---------------------------------------------------------------------------------
const W = 1200, H = 660;
const png = new PNG({ width: W, height: H });
const BG = [26, 24, 21], INK = [238, 234, 226], DIM = [150, 143, 132], GRID = [58, 54, 49];
const CONTRACT_C = [232, 168, 92];   // amber — what the corpus asks for
const SHIPPED_C = [96, 176, 198];    // teal  — what shipped
const ALERT = [214, 106, 96];        // red   — the hard fail

function px(x, y, c, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * y + x) << 2;
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(png.data[i + k] * (1 - a) + c[k] * a);
  png.data[i + 3] = 255;
}
function rect(x, y, w, h, c, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a); }
function line(x0, y0, x1, y1, c, a = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c, a);
}
// a compact 5x7 bitmap font — enough for the labels this picture needs
const FONT = {
  A: '01100:10010:10010:11110:10010:10010:10010', B: '11100:10010:10010:11100:10010:10010:11100',
  C: '01110:10000:10000:10000:10000:10000:01110', D: '11100:10010:10010:10010:10010:10010:11100',
  E: '11110:10000:10000:11100:10000:10000:11110', F: '11110:10000:10000:11100:10000:10000:10000',
  G: '01110:10000:10000:10110:10010:10010:01110', H: '10010:10010:10010:11110:10010:10010:10010',
  I: '11100:01000:01000:01000:01000:01000:11100', J: '00110:00010:00010:00010:10010:10010:01100',
  K: '10010:10100:11000:10000:11000:10100:10010', L: '10000:10000:10000:10000:10000:10000:11110',
  M: '10001:11011:10101:10001:10001:10001:10001', N: '10010:11010:11010:10110:10110:10010:10010',
  O: '01100:10010:10010:10010:10010:10010:01100', P: '11100:10010:10010:11100:10000:10000:10000',
  Q: '01100:10010:10010:10010:10110:01100:00011', R: '11100:10010:10010:11100:10100:10010:10010',
  S: '01110:10000:10000:01100:00010:00010:11100', T: '11111:00100:00100:00100:00100:00100:00100',
  U: '10010:10010:10010:10010:10010:10010:01100', V: '10001:10001:10001:01010:01010:00100:00100',
  W: '10001:10001:10001:10101:10101:11011:10001', X: '10001:01010:00100:00100:00100:01010:10001',
  Y: '10001:01010:00100:00100:00100:00100:00100', Z: '11111:00010:00100:00100:01000:10000:11111',
  0: '01100:10010:10110:10110:11010:11010:01100', 1: '00100:01100:00100:00100:00100:00100:01110',
  2: '01100:10010:00010:00100:01000:10000:11110', 3: '11110:00100:01000:00100:00010:10010:01100',
  4: '00110:01010:10010:11111:00010:00010:00010', 5: '11110:10000:11100:00010:00010:10010:01100',
  6: '00110:01000:10000:11100:10010:10010:01100', 7: '11110:00010:00100:00100:01000:01000:01000',
  8: '01100:10010:10010:01100:10010:10010:01100', 9: '01100:10010:10010:01110:00010:00100:01000',
  '.': '00000:00000:00000:00000:00000:01100:01100', ',': '00000:00000:00000:00000:01100:00100:01000',
  '-': '00000:00000:00000:11110:00000:00000:00000', ':': '00000:01100:01100:00000:01100:01100:00000',
  '/': '00001:00010:00010:00100:01000:01000:10000', '(': '00100:01000:01000:01000:01000:01000:00100',
  ')': '01000:00100:00100:00100:00100:00100:01000', '%': '11001:11010:00010:00100:01000:01011:10011',
  '=': '00000:00000:11110:00000:11110:00000:00000', '?': '01100:10010:00010:00100:00100:00000:00100',
  '+': '00000:00100:00100:11111:00100:00100:00000', '_': '00000:00000:00000:00000:00000:00000:11111',
  ' ': '00000:00000:00000:00000:00000:00000:00000', "'": '00100:00100:00000:00000:00000:00000:00000',
  '<': '00010:00100:01000:10000:01000:00100:00010', '>': '01000:00100:00010:00001:00010:00100:01000',
  '*': '00000:01010:00100:11111:00100:01010:00000', 'x': '00000:00000:10001:01010:00100:01010:10001',
};
function text(str, x, y, c, s = 1, a = 1) {
  let cx = x;
  for (const ch0 of String(str)) {
    const ch = FONT[ch0] !== undefined ? ch0 : (FONT[ch0.toUpperCase()] !== undefined ? ch0.toUpperCase() : ' ');
    const rows = FONT[ch].split(':');
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) {
      if (rows[r][q] === '1') rect(cx + q * s, y + r * s, s, s, c, a);
    }
    cx += 6 * s;
  }
  return cx;
}
const tw = (str, s = 1) => String(str).length * 6 * s;

rect(0, 0, W, H, BG);

// ---- title ----------------------------------------------------------------------------------
text('THE PROVINCE DECLARES FIVE DANGER TIERS.', 40, 34, INK, 3);
text('HERE IS EVERYTHING THE TIER CHANGES.', 40, 66, DIM, 3);
text('W1-POPULATION ROUND-1 CRITIC   267 BODIES PLACED   5 STATBLOCKS   0 NEW ARCHETYPES', 40, 100, DIM, 2);

// ---- panel 1: souls per body, contract vs shipped (log-ish, normalised to t1) ---------------
const P1 = { x: 60, y: 160, w: 470, h: 300 };
text('SOULS PER BODY, AS A MULTIPLE OF TIER 1', P1.x, P1.y - 26, INK, 2);
const maxMult = 26;
const yFor = (v) => P1.y + P1.h - (Math.log(v) / Math.log(maxMult)) * P1.h;
for (const g of [1, 2, 4, 8, 16, 24]) {
  const yy = yFor(g);
  line(P1.x, yy, P1.x + P1.w, yy, GRID);
  text(g + 'x', P1.x - 30, yy - 3, DIM, 1);
}
const bw = 34, slot = P1.w / 5;
for (const t of [1, 2, 3, 4, 5]) {
  const cx = P1.x + slot * (t - 0.5);
  const yc = yFor(CONTRACT[t]), ys = yFor(Math.max(1, realised[t]));
  rect(cx - bw - 3, yc, bw, P1.y + P1.h - yc, CONTRACT_C, 0.85);
  rect(cx + 3, ys, bw, P1.y + P1.h - ys, SHIPPED_C, 0.95);
  text('T' + t, cx - 6, P1.y + P1.h + 12, DIM, 2);
  text(CONTRACT[t].toFixed(1) + 'x', cx - bw - 3, yc - 12, CONTRACT_C, 1);
  text(realised[t].toFixed(2) + 'x', cx + 3, ys - 12, SHIPPED_C, 1);
}
text('RI-PRG06 SECTION 2 CONTRACT', P1.x, P1.y + P1.h + 36, CONTRACT_C, 1);
text('SHIPPED PLACEMENT', P1.x + 240, P1.y + P1.h + 36, SHIPPED_C, 1);
text('T5 IS BELOW T4. 94% OF BODIES SIT OUTSIDE', P1.x, P1.y + P1.h + 54, ALERT, 1);
text('THEIR TIERS SOUL BAND. ADJACENT BANDS', P1.x, P1.y + P1.h + 68, ALERT, 1);
text('OVERLAP 100 / 67 / 100 / 100 PERCENT.', P1.x, P1.y + P1.h + 82, ALERT, 1);

// ---- panel 2: density is flat ---------------------------------------------------------------
const P2 = { x: 640, y: 160, w: 240, h: 300 };
text('ROAD SPACING (MEDIAN)', P2.x, P2.y - 26, INK, 2);
const maxGap = 200;
for (const g of [50, 100, 150, 200]) {
  const yy = P2.y + P2.h - (g / maxGap) * P2.h;
  line(P2.x, yy, P2.x + P2.w, yy, GRID);
  text(g, P2.x - 24, yy - 3, DIM, 1);
}
for (const t of [1, 2, 3, 4, 5]) {
  const cx = P2.x + (P2.w / 5) * (t - 0.5);
  const yy = P2.y + P2.h - (medGap[t] / maxGap) * P2.h;
  rect(cx - 16, yy, 32, P2.y + P2.h - yy, SHIPPED_C, 0.9);
  text(medGap[t], cx - 12, yy - 12, INK, 1);
  text('T' + t, cx - 6, P2.y + P2.h + 12, DIM, 2);
}
// the flat line through t2,t3,t5
const y140 = P2.y + P2.h - (140 / maxGap) * P2.h;
for (let i = 0; i < P2.w; i += 6) line(P2.x + i, y140, P2.x + i + 3, y140, ALERT);
text('METRES', P2.x, P2.y + P2.h + 36, DIM, 1);
text('TIERS 2, 3 AND 5', P2.x, P2.y + P2.h + 54, ALERT, 1);
text('ARE IDENTICAL.', P2.x, P2.y + P2.h + 68, ALERT, 1);
text('DECLARED TIER RANGE', P2.x, P2.y + P2.h + 88, DIM, 1);
text('IS ' + tierMult['1'] + ' TO ' + tierMult['4'] + ' = 1.29x', P2.x, P2.y + P2.h + 102, DIM, 1);

// ---- panel 3: the hard fail ------------------------------------------------------------------
const P3 = { x: 950, y: 160, w: 210, h: 300 };
text('THE HARD FAIL', P3.x, P3.y - 26, ALERT, 2);
text('RI-AI05 SECTION D:', P3.x, P3.y + 4, INK, 1);
text('THE FIRST INSTANCE OF', P3.x, P3.y + 20, DIM, 1);
text('ANY ARCHETYPE MUST BE', P3.x, P3.y + 34, DIM, 1);
text('PRESENTED SOLO.', P3.x, P3.y + 48, DIM, 1);
text('WALKED ALONG THE', P3.x, P3.y + 76, INK, 1);
text('CROSSING, THE GAMES', P3.x, P3.y + 90, INK, 1);
text('OWN NAMED ROUTE:', P3.x, P3.y + 104, INK, 1);
const rows = [
  ['SLITHERFANG', '1', false], ['INF TRASH', '1', false], ['DROWNED GREATER', '1', false],
  ['GUARD LEGION', '2', true], ['DROWNED LESSER', '2', true],
];
let ry = P3.y + 130;
for (const [nm, n, bad] of rows) {
  text(nm, P3.x, ry, bad ? ALERT : DIM, 1);
  text('x' + n, P3.x + 168, ry, bad ? ALERT : DIM, 1);
  ry += 18;
}
text('TWO OF FIVE DEBUT', P3.x, ry + 12, ALERT, 1);
text('IN A GROUP. THE TAG', P3.x, ry + 26, ALERT, 1);
text('SAYS SOLO BECAUSE IT', P3.x, ry + 40, ALERT, 1);
text('IS SORTED BY TIER,', P3.x, ry + 54, ALERT, 1);
text('NOT BY THE ROAD.', P3.x, ry + 68, ALERT, 1);

// ---- footer ----------------------------------------------------------------------------------
let sha = 'unknown';
try { sha = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* detached */ }
line(40, H - 52, W - 40, H - 52, GRID);
text('DRAWN FROM THE SHIPPED DATA AT ' + sha + '. NO BROWSER, NO ENGINE, NO TIMING CLAIMED.', 40, H - 38, DIM, 1);
text('SOURCES: GAME/DATA/WORLD/POPULATION-POSTS.JSON, POPULATION.JSON, ENCOUNTERS.JSON, COMBAT/ENEMIES/*.JSON, PROGRESSION/LEVELS.JSON', 40, H - 24, DIM, 1);

const OUT = path.join(ROOT, 'docs/shots/2026-08-07-w1-population-r1-the-tier-is-a-label.png');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('wrote ' + OUT);
console.log(JSON.stringify({ medGap, realised, contract: CONTRACT, soulsPerBody }, null, 1));
