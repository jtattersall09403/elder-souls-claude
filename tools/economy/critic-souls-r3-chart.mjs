// THE PICTURE FOR W1-SOULS ROUND 3, DRAWN BY ITS CRITIC: two guards, and neither one alone.
//
// Round 3 shipped TWO fixes for one defect class — the ledger keyed on the entity OBJECT
// (`sim/souls.js`), and one declared list of per-session observers that clears it at BOTH
// scenario boundaries (`engine.js`). The builder deleted each one on its own and the number
// stayed green both times, and honestly wrote that down. This is the 2x2 that finishes the
// question: the SAME untagged six-body fight, killed, crossed over `loadState('arena_flat')`
// and killed again, under all four states of the two fixes.
//
// Three cells pay 252 twice. The fourth — both fixes gone — pays 252 and then nothing, which is
// the defect exactly as round 2 measured it. Neither guard is load-bearing alone; together they
// are. No wall-clock figure appears anywhere: every number is a soul count.
//
// No browser, no engine: this reads the four reports my probe wrote and plots them.
// The PNG writer and the 5x7 font are lifted from `tools/analysis/w1-13-r4-chart.mjs`, which is
// where this project's other hand-rolled charts live.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LABELS = ['INTACT', 'DELETED-identity', 'DELETED-boundary', 'DELETED-identity-boundary'];
const R = {};
for (const l of LABELS) R[l] = JSON.parse(readFileSync(join(ROOT, `reports/critic-souls-r3-${l}.json`), 'utf8'));
const OUT = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-souls-r3-critic-two-guards-and-neither-one-alone.png');

const W = 1240, H = 560;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), r, g, b);
};
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const FONT = {
  A: '01100100101111010011001', B: '11100100111100100111110', C: '01110100011000010000111',
  D: '11100100101001010011110', E: '11111100001111010000111', F: '11111100001111010000100',
  G: '01110100001011010011011', H: '10001100011111110001100', I: '11111001000010000101111',
  J: '00111000100001010010110', K: '10001100101110010011000', L: '10000100001000010000111',
  M: '10001110111011100011000', N: '10001110101101100111000', O: '01110100011000110001011',
  P: '11110100101111010000100', Q: '01110100011000110101001', R: '11110100101111010011000',
  S: '01111100000111000011111', T: '11111001000010000100001', U: '10001100011000110001011',
  V: '10001100011000101010001', W: '10001100011010111011000', X: '10001010100100010100011',
  Y: '10001010100010000100001', Z: '11111000100010001000111',
  0: '01110100111010111001011', 1: '00100011000010000100111', 2: '01110100010010010001111',
  3: '11110000101110000111110', 4: '00110010110010111110001', 5: '11111100001111000011110',
  6: '01110100001111010011011', 7: '11111000100010001000010', 8: '01110100011011010011011',
  9: '01110100011011100011011',
  '-': '00000000001111000000000', '.': '00000000000000000100000', ' ': '00000000000000000000000',
  '+': '00000001000111000100000', ':': '00000001000000000100000', '/': '00001000100010001000000',
  '(': '00010001000010000100001', ')': '01000001000010000100010', ',': '00000000000000000100010',
  '=': '00000111100000111100000', '?': '01110100010010001000010', '!': '00100001000010000000100',
  '%': '10001000100100010001000', 'x': '00000101010001010100000',
};
function text(s, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch] || FONT[ch.toLowerCase()];
    if (bits) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
      if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
    }
    cx += 6 * scale;
  }
  return cx;
}


// ---- header ------------------------------------------------------------------------------------
text('W1-SOULS R3  TWO GUARDS FOR ONE DEFECT, AND NEITHER ONE IS LOAD-BEARING ALONE', 30, 26, 0xf0, 0xe6, 0xc8, 2);
text('THE SAME UNTAGGED SIX-BODY FIGHT, KILLED, CROSSED OVER LOADSTATE(ARENA-FLAT), KILLED AGAIN.  SAME EIDS BOTH TIMES.  ZERO HEARTH RESTS.',
  30, 54, 0x8a, 0x92, 0x9c, 1);
text('MEASURED AT COMMIT E97347F BY TOOLS/ECONOMY/CRITIC-SOULS-R3.MJS.  EVERY NUMBER IS A SOUL COUNT.', 30, 70, 0x8a, 0x92, 0x9c, 1);

const CELLS = [
  { lab: 'BOTH FIXES INTACT',                      key: 'INTACT',                     ident: 'KEPT',    bound: 'KEPT' },
  { lab: 'BODY-IDENTITY KEY DELETED',              key: 'DELETED-identity',           ident: 'DELETED', bound: 'KEPT' },
  { lab: 'BOUNDARY RESET DELETED',                 key: 'DELETED-boundary',           ident: 'KEPT',    bound: 'DELETED' },
  { lab: 'BOTH DELETED   THE OLD NUMBER RETURNS',  key: 'DELETED-identity-boundary',  ident: 'DELETED', bound: 'DELETED' },
];

const X0 = 640, MAXV = 300, BARW = (W - 90 - X0);
const xOf = (v) => X0 + (v / MAXV) * BARW;
let y = 108;
for (const c of CELLS) {
  const arm = R[c.key].arms.X_boundary_same_eids_twice;
  const p1 = arm.pass1_paid, p2 = arm.pass2_paid;
  const good = p1 > 0 && p2 === p1;
  const col = good ? [0x4e, 0xa3, 0x72] : [0xd9, 0x5c, 0x3f];
  text(c.lab, 30, y + 12, good ? 0xc9 : 0xd9, good ? 0xb0 : 0x8c, good ? 0x72 : 0x6c, 1);
  text(`IDENTITY ${c.ident}   BOUNDARY ${c.bound}`, 30, y + 30, 0x6d, 0x74, 0x7e, 1);
  text(`ARMS ${R[c.key].passed}/${R[c.key].of}`, 30, y + 48, 0x6d, 0x74, 0x7e, 1);
  // first pass
  rect(X0, y, Math.max(2, xOf(p1) - X0), 20, p1 > 0 ? 0x4e : 0xd9, p1 > 0 ? 0xa3 : 0x5c, p1 > 0 ? 0x72 : 0x3f);
  if (p1 > 0) text(`FIRST FIGHT  +${p1}`, X0 + 8, y + 6, 0x0f, 0x14, 0x11, 1);
  else text('FIRST FIGHT  +0   THE LEDGER NEVER CLEARED, SO EVEN THIS ONE IS SETTLED', X0 + 14, y + 6, 0xd9, 0x8c, 0x6c, 1);
  // second pass
  rect(X0, y + 26, Math.max(2, xOf(p2) - X0), 20, col[0], col[1], col[2]);
  if (p2 > 0) text(`SAME FIGHT AGAIN  +${p2}`, X0 + 8, y + 32, 0x0f, 0x14, 0x11, 1);
  else text('SAME FIGHT AGAIN  +0   SIX LIVE ENEMIES WORTH NOTHING', X0 + 14, y + 32, 0xff, 0xf0, 0xf0, 1);
  rect(X0 - 12, y - 6, 2, 64, 0x2c, 0x31, 0x38);
  y += 96;
}

// ---- the reading ------------------------------------------------------------------------------
rect(30, y + 4, W - 60, 2, 0x2c, 0x31, 0x38);
text('DELETE EITHER GUARD AND THE NUMBER DOES NOT MOVE.  DELETE BOTH AND SIX LIVE ENEMIES ARE WORTH NOTHING.',
  30, y + 22, 0xf0, 0xe6, 0xc8, 1);
text('THAT IS A REDUNDANT PAIR, NOT AN INERT FIX - BUT EACH ONE ON ITS OWN MEASURES AS INERT, WHICH IS HOW THE NEXT AGENT DELETES ONE.',
  30, y + 40, 0x8a, 0x92, 0x9c, 1);

png(OUT);
console.log('wrote ' + OUT);
