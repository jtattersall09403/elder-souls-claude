#!/usr/bin/env node
// critic-w1-readables-chart.mjs — the picture for the W1-READABLES round-2 verdict (rule 27).
//
// IT DRAWS WITH A DIFFERENT FONT ON PURPOSE, and that is finding G in one line. Nine chart tools
// in this repo share a 5x5 bitmap table whose glyphs are two characters short — deleted from the
// MIDDLE of the string, which shears every row below the cut a pixel left — so their digits are
// not the digits they were authored as. This tool takes its font from
// `tools/dialogue/w1-17-shot.mjs`, the one chart tool in the tree with a sound 5x7 table at the
// full 35 characters. A verdict whose whole content is numbers may not be drawn with a font that
// cannot draw numbers.
//
//   node tools/quests/critic-w1-readables-chart.mjs [--out <png>]

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = argOf('--out') || path.join(ROOT, 'docs/shots/2026-08-08-critic-w1-readables-r2-what-carried-the-chain.png');

// ---- the sound font, read out of the one tool that has one -------------------------------------
const FONT = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/dialogue/w1-17-shot.mjs'), 'utf8');
  const re = /(?:^|[,{\s])(?:(['"])([^'"]{1,2})\1|([A-Za-z0-9]))\s*:\s*(['"])([01]{35})\4/gm;
  const g = {}; let m;
  while ((m = re.exec(src))) g[m[2] !== undefined ? m[2] : m[3]] = m[5];
  if (Object.keys(g).length < 40) throw new Error('critic-w1-readables-chart: the sound font table did not parse; refusing to draw with a sheared one');
  return g;
})();

const W = 1180, H = 760;
const px = new Uint8Array(W * H * 3);
const BG = [0x14, 0x16, 0x14];
for (let i = 0; i < W * H; i++) { px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2]; }
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = ((y | 0) * W + (x | 0)) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
const text = (s, x, y, r, g, b, scale = 1) => {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch];
    if (bits) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
    cx += 6 * scale;
  }
  return cx;
};

const INK = [0xEE, 0xEE, 0xE4], DIM = [0x86, 0x90, 0x86];
const GREEN = [0x7F, 0xB8, 0x6C], AMBER = [0xD6, 0xA4, 0x4E], RED = [0xC2, 0x5B, 0x4E], BLUE = [0x6C, 0x9A, 0xB8];

text('WHAT CARRIED THE MAIN LINE, AND WHAT IS STILL SHUT', 40, 34, ...INK, 3);
text('CRITIC OF W1-READABLES ROUND 2 / MEASURED AGAIN ON AN INSTRUMENT THE BUILDER DID NOT WRITE', 40, 74, ...DIM, 2);

// ---- the chain bars -----------------------------------------------------------------------
text('HOW FAR THE MAIN LINE GOES, OF 32 QUESTS', 40, 128, ...INK, 2);
const arms = [
  ['NEITHER', 5, RED, 'STOPS AT Q-MAIN-06 ON REV_THE_CURVE_PREDATES'],
  ['LOOKING ONLY', 5, RED, 'STOPS AT Q-MAIN-06 — THE DOCUMENTS ARE THE FIRST WALL'],
  ['READING ONLY', 10, AMBER, 'STOPS AT Q-MAIN-11 ON REV_THE_RHYTHM'],
  ['READING AND LOOKING', 18, GREEN, 'CRITIC, HEADLESS, NO FACTION MODEL'],
  ['   ...IN A BROWSER', 28, GREEN, 'BUILDER TOOL, REPRODUCED'],
];
let y = 162;
for (const [name, n, col, note] of arms) {
  text(name, 40, y + 6, ...INK, 2);
  const x0 = 340, w = Math.round(n * 21);
  rect(x0, y, 32 * 21, 22, 0x22, 0x26, 0x22);
  rect(x0, y, w, 22, ...col);
  text(String(n), x0 + w + 10, y + 6, ...col, 2);
  text(note, x0 + w + 46, y + 7, ...DIM, 1);
  y += 34;
}
text('OF THE 28 STEPS THE BEST ARM COMPLETED: 12 NEEDED NO REVEAL, 5 A DOCUMENT, 5 A MARK, 5 A PERSON, 1 THE HOOK TABLE.', 40, y + 6, ...DIM, 1);
text('SO 10 OF 28 ARE THIS ROUND\'S, AND THEY ARE THE ONES THAT MOVE THE WALL.', 40, y + 20, ...DIM, 1);

// ---- the census --------------------------------------------------------------------------
y += 58;
text('THE 121 TRUTHS A RESOLUTION DEMANDS', 40, y, ...INK, 2);
y += 30;
const seg = [['ROUTED', 100, GREEN], ['EAVESDROP, NO READER', 9, RED], ['PERSON WITH NO RECORD', 11, AMBER], ['CORPSE, NO ACTION', 1, RED]];
let x = 40;
for (const [, n, col] of seg) { const w = Math.round(n * 8.6); rect(x, y, w, 26, ...col); x += w + 3; }
x = 40; let ly = y + 34;
for (const [label, n, col] of seg) { rect(x, ly + 2, 10, 10, ...col); text(`${n}  ${label}`, x + 16, ly + 3, ...DIM, 1); x += 250; }

// ---- the corrections ---------------------------------------------------------------------
y += 84;
text('WHAT THE CRITIC FOUND THAT THE ROUND DID NOT', 40, y, ...INK, 2);
const lines = [
  [RED, 'THE LIST OF 11 MISSING PEOPLE IS WRONG IN COMPOSITION. THREE NAMED ARE NOT BLOCKERS;'],
  [RED, 'THREE BLOCKERS ARE NOT NAMED — FOURTH-DAY-BOATMAN, HIGH-HOLLOW-SPEAKER, UNEEL-VAAKH-SISTER.'],
  [AMBER, 'THE FONT DEFECT IS A SHEAR, NOT A TRUNCATION, AND IT IS IN NINE CHART TOOLS, NOT ONE.'],
  [GREEN, 'BOTH BROWSER FIXES HOLD: 83 OF 83 ROOMS CLEAR AT 2.6 M, 36 MARKS AFTER EVERY ONE OF SIX RESETS.'],
  [AMBER, 'THE BUSIEST ROOM SITS AT EXACTLY 2.6 M. A SIXTEENTH DOCUMENT BREAKS IT AGAIN.'],
  [BLUE, 'DELETE-THE-FIX REPRODUCED: 4 OF 4 LEGS PASS, 0 OF 3 WITH THE MARK BRANCH DEAD.'],
];
let ly2 = y + 26;
for (const [col, s] of lines) { rect(40, ly2 + 2, 8, 8, ...col); text(s, 56, ly2, ...INK, 1); ly2 += 20; }

text('COMMIT UNDER TEST: SEE THE VERDICT JSON. DRAWN WITH THE SOUND 5X7 FONT FROM W1-17-SHOT, NOT THE SHEARED ONE NINE CHART TOOLS SHARE.', 40, H - 26, ...DIM, 1);

// ---- PNG -----------------------------------------------------------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let yy = 0; yy < H; yy++) { raw[yy * (W * 3 + 1)] = 0; Buffer.from(px.buffer, yy * W * 3, W * 3).copy(raw, yy * (W * 3 + 1) + 1); }
const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${path.relative(ROOT, OUT)}`);
