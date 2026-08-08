// THE PICTURE FOR W1-16 ROUND 3: the sword in your hand used to weigh nothing.
//
// Left: five configurations of one character, and what the equip-load ratio said about each of
// them BEFORE this round — every number read off the round-2 verdict
// (corpus/90-verdicts/wave1/W1-16-r2.md §B/§C/§D), which measured them live.
// Right: the same five, measured this round by tools/harness/critic-w1-16-live.mjs and
// tools/harness/w1-16-r3-live.mjs, in the running game.
//
// The bottom strip is the other half: metres of ground covered over 120 f@60 holding SPRINT, at
// each roll tier, against the button-up control — RI-CMB01 §B's "OVERLOADED additionally forbids
// sprinting", which had no reader at all until this round.
//
// No browser and no engine here: this reads the two report JSONs the probes wrote. The PNG writer
// and the 5x7 font are lifted from tools/analysis/w1-15-r3-chart.mjs, which is where this
// project's chart code lives.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const LIVE = rd('reports/w1-16/critic-live.json').probes;
const R3 = rd('reports/w1-16/r3-live.json').probes;
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0; } catch { return true; } })();

// AFTER: measured. BEFORE: the round-2 verdict's own live figures for the same configurations.
const ROWS = [
  { label: 'GARRISON SWORD + MEDIUM SHIELD, NOTHING WORN',
    before: 0.0, after: LIVE.separation.arms[0].equip_load_pct, bt: 'LIGHT', at: LIVE.separation.arms[0].tier },
  { label: '460 KG IN THE PACK, WORN BY NOTHING',
    before: 0.0, after: LIVE.separation.arms[1].equip_load_pct, bt: 'LIGHT', at: LIVE.separation.arms[1].tier },
  { label: 'FIVE WEARABLE PIECES ON, HANDS AS DEALT',
    before: 23.01, after: LIVE.separation.arms[2].equip_load_pct, bt: 'LIGHT', at: LIVE.separation.arms[2].tier },
  { label: 'BOG-IRON MAUL PICKED UP AND EQUIPPED',
    before: 15.753425, after: LIVE.parallel.after.equip_load_pct, bt: 'LIGHT', at: 'LIGHT' },
  { label: 'ULTRA GREATSWORD + GREATSHIELD IN HAND',
    before: 15.753425, after: R3.hands.order_cut_then_fix.fix.after.pct, bt: 'LIGHT', at: R3.hands.order_cut_then_fix.fix.after.tier },
];
const SPR = R3.oversprint.order_cut_then_fix;

const W = 1400, H = 820;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = ((y | 0) * W + (x | 0)) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), r, g, b); };
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
const FONT = {
  A: '01100100101111010011001', B: '11100100111100100111110', C: '01110100011000010000111', D: '11100100101001010011110',
  E: '11111100001111010000111', F: '11111100001111010000100', G: '01110100001011010011011', H: '10001100011111110001100',
  I: '11111001000010000101111', J: '00111000100001010010110', K: '10001100101110010011000', L: '10000100001000010000111',
  M: '10001110111011100011000', N: '10001110101101100111000', O: '01110100011000110001011', P: '11110100101111010000100',
  Q: '01110100011000110101001', R: '11110100101111010011000', S: '01111100000111000011111', T: '11111001000010000100001',
  U: '10001100011000110001011', V: '10001100011000101010001', W: '10001100011010111011000', X: '10001010100100010100011',
  Y: '10001010100010000100001', Z: '11111000100010001000111',
  0: '01110100111010111001011', 1: '00100011000010000100111', 2: '01110100010010010001111', 3: '11110000101110000111110',
  4: '00110010110010111110001', 5: '11111100001111000011110', 6: '01110100001111010011011', 7: '11111000100010001000010',
  8: '01110100011011010011011', 9: '01110100011011100011011',
  '-': '00000000001111000000000', '.': '00000000000000000100000', ' ': '00000000000000000000000', '+': '00000001000111000100000',
  ':': '00000001000000000100000', '/': '00001000100010001000000', '(': '00010001000010000100001', ')': '01000001000010000100010',
  ',': '00000000000000000100010', '=': '00000111100000111100000', '?': '01110100010010001000010', '!': '00100001000010000000100',
  '%': '10001000100100010001000', 'x': '00000101010001010100000', '>': '01000001000010001000100', '<': '00010001000100000100010',
};
function text(s, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch] || FONT[ch.toLowerCase()];
    if (bits) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
    cx += 6 * scale;
  }
  return cx;
}

text('W1-16 R3   THE EQUIP-LOAD RATIO CAN SEE THE THING IN YOUR HANDS', 34, 26, 0xf0, 0xe6, 0xc8, 2);
text(`EQUIP LOAD AS A PERCENTAGE OF MAXLOAD. LEFT BAR: THE ROUND-2 VERDICT'S OWN LIVE FIGURE. RIGHT BAR: MEASURED THIS ROUND.   COMMIT ${commit}   DIRTY=${dirty}`,
  34, 52, 0x8a, 0x92, 0x9c, 1);

// ---- the cliffs, drawn once so the tier is a place on the picture and not a word ------------
const X0 = 560, XW = 700, Y0 = 100, RH = 92;
const px2 = (p) => X0 + (Math.min(p, 100) / 100) * XW;
for (const [c, lab] of [[30, 'MEDIUM 30'], [70, 'HEAVY 70'], [100, 'OVERLOADED 100']]) {
  for (let y = Y0 - 8; y < Y0 + ROWS.length * RH + 6; y += 3) rect(px2(c), y, 1, 2, 0x4a, 0x52, 0x5e);
  text(lab, px2(c) - (c === 100 ? 6 * lab.length : 4), Y0 - 24, 0x6a, 0x74, 0x82, 1);
}

const TIER_COL = { LIGHT: [0x6f, 0xc2, 0x8a], MEDIUM: [0xe0, 0xc0, 0x58], HEAVY: [0xe0, 0x84, 0x48], OVERLOADED: [0xd0, 0x50, 0x50] };
ROWS.forEach((r, i) => {
  const y = Y0 + i * RH;
  text(r.label, 34, y + 6, 0xd8, 0xd2, 0xc4, 1);
  // before
  const bc = [0x50, 0x54, 0x60];
  rect(X0, y + 22, Math.max(2, px2(r.before) - X0), 18, bc[0], bc[1], bc[2]);
  text(`${r.before.toFixed(6)}%  ${r.bt}`, X0 + 6, y + 26, 0x9a, 0xa2, 0xac, 1);
  text('BEFORE', 34, y + 26, 0x6a, 0x74, 0x82, 1);
  // after
  const ac = TIER_COL[r.at] || [0x88, 0x88, 0x88];
  rect(X0, y + 48, Math.max(2, px2(r.after) - X0), 18, ac[0], ac[1], ac[2]);
  text(`${r.after.toFixed(6)}%  ${r.at}`, X0 + 6, y + 52, 0x14, 0x16, 0x1a, 1);
  text('AFTER', 34, y + 52, 0xc8, 0xc2, 0xb4, 1);
});

// ---- the sprint strip ------------------------------------------------------------------------
const SY = Y0 + ROWS.length * RH + 40;
text('RI-CMB01 SECTION B: OVERLOADED ADDITIONALLY FORBIDS SPRINTING. METRES OVER 120 F(AT)60, SPRINT HELD, AGAINST THE BUTTON-UP CONTROL.',
  34, SY, 0xf0, 0xe6, 0xc8, 1);
const cut = SPR.cut.rows, fix = SPR.fix.rows;
const tiers = [15, 50, 85, 120];
const SX = 300, SW = 62, SGAP = 250;
text('BUTTON UP (CONTROL)', 34, SY + 34, 0x6a, 0x74, 0x82, 1);
text('HELD, FIX DELETED', 34, SY + 56, 0x6a, 0x74, 0x82, 1);
text('HELD, FIX IN', 34, SY + 78, 0xc8, 0xc2, 0xb4, 1);
tiers.forEach((p, i) => {
  const x = SX + i * SGAP;
  const up = fix.find((r) => r.pct === p && !r.sprint_held);
  const hc = cut.find((r) => r.pct === p && r.sprint_held);
  const hf = fix.find((r) => r.pct === p && r.sprint_held);
  text(`${p}%  ${hf.tier}`, x, SY + 12, 0x9a, 0xa2, 0xac, 1);
  const bar = (m, y, r, g, b) => { rect(x, y, Math.max(2, (m / 12) * 180), 14, r, g, b); text(`${m.toFixed(3)} M`, x + 6, y + 3, 0x14, 0x16, 0x1a, 1); };
  bar(up.metres_over_120_f60, SY + 30, 0x50, 0x54, 0x60);
  bar(hc.metres_over_120_f60, SY + 52, 0x88, 0x6a, 0x6a);
  const c = TIER_COL[hf.tier] || [0x88, 0x88, 0x88];
  bar(hf.metres_over_120_f60, SY + 74, c[0], c[1], c[2]);
});
text('AT OVERLOADED THE HELD RUN AND THE BUTTON-UP CONTROL ARE THE SAME 6.400 M FOR THE SAME 0 STAMINA. HEAVY STILL SPRINTS, SO THE DENIAL DOES NOT FIRE A TIER EARLY.',
  34, H - 34, 0x8a, 0x92, 0x9c, 1);

const out = join(ROOT, 'docs/shots/2026-08-08-w1-16-r3-the-sword-in-your-hand-used-to-weigh-nothing.png');
png(out);
process.stdout.write(`written: ${out.slice(ROOT.length + 1)}\n`);
