#!/usr/bin/env node
// Draw the W1-19 round-3 headline as a picture: which reveal channels a player can actually walk,
// and what one line of a measuring tool was worth.
//
// No browser. This is a picture of a MEASUREMENT, not of the game, so `tools/capture/` is the
// wrong instrument (RULES.md rule 20 asks for the capture service for pictures OF THE GAME). The
// minimal PNG writer and the 5x7 font are the same ones
// `tools/analysis/ambience-onsets-chart.mjs` uses.
//
//   node tools/quests/reveal-route-chart.mjs --out docs/shots/<name>.png
//
// W1-18 ROUND 2 added `--round w1-18-r2`, which draws the same report with this round's headline
// instead of the last one's. It is a flag rather than a second file because the picture is of the
// same measurement and a second copy of a chart tool is how two charts start disagreeing; the
// default is untouched, so `docs/shots/2026-08-07-w1-19-r3-*.png` still regenerates byte-for-byte.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rep = JSON.parse(readFileSync(argOf('--in') || join(ROOT, 'reports/runs/W1-19-R3/reveal-route-audit.json'), 'utf8'));
const OUT = argOf('--out') || join(ROOT, 'docs/shots/2026-08-07-w1-19-r3-the-reveals-no-play-produces.png');

const W = 1280, H = 800;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
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
  '_': '00000000000000000001111', '>': '01000001000001000100010',
};
function text(s, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch];
    if (bits) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
    cx += 6 * scale;
  }
  return cx;
}

const ROUND = argOf('--round') || 'w1-19-r3';
const world = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'reports/runs/W1-18-R2/reveal-route-world.json'), 'utf8')); } catch { return null; } })();

// ---- title -----------------------------------------------------------------------------------
if (ROUND === 'w1-18-r2') {
  text('THE PEOPLE WHO KNEW, AND NOBODY COULD ASK THEM', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-18 ROUND 2 / TALKING TO THE PERSON THE QUEST FILE NAMES NOW TELLS YOU WHAT THEY KNOW', 40, 66, 0x8A, 0x94, 0x88, 2);
} else {
  text('THE TRUTHS THE GAME ASKS FOR AND NEVER TELLS YOU', 40, 30, 0xEE, 0xEE, 0xE4, 3);
  text('W1-19 ROUND 3 / QUEST RESOLUTIONS DEMAND A REVEAL / CAN PLAY PRODUCE IT', 40, 66, 0x8A, 0x94, 0x88, 2);
}

// ---- the channel bars ------------------------------------------------------------------------
const ch = Object.entries(rep.by_channel).sort((a, b) => b[1].total - a[1].total);
const X0 = 230, X1 = 640, Y0 = 130;
const maxV = Math.max(...ch.map(([, v]) => v.total));
const rowH = 34;
text('BY CHANNEL: HOW THE FICTION SAYS YOU LEARN IT', 40, 104, 0xCC, 0xC4, 0x9A, 2);
ch.forEach(([name, v], i) => {
  const y = Y0 + i * rowH;
  text(name, 40, y + 6, 0xCC, 0xCC, 0xC4, 2);
  const wTot = Math.round((v.total / maxV) * (X1 - X0));
  const wOk = Math.round((v.routed / maxV) * (X1 - X0));
  rect(X0, y, wTot, 18, 0x6E, 0x2B, 0x2B);                    // demanded but unroutable = red
  if (wOk > 0) rect(X0, y, wOk, 18, 0x2E, 0x7A, 0x44);        // routed = green
  text(`${v.routed}/${v.total}`, X0 + (X1 - X0) + 20, y + 6, 0x9A, 0x9A, 0x92, 2);
  if (v.routed === 0) text('NO READER IN GAME/SRC', X0 + (X1 - X0) + 110, y + 6, 0x7A, 0x50, 0x50, 2);
});

// ---- the two instruments ---------------------------------------------------------------------
const BY = Y0 + ch.length * rowH + 40;
const box = (x, y, w, h, r, g, b) => { rect(x, y, w, 2, r, g, b); rect(x, y + h, w, 2, r, g, b); rect(x, y, 2, h, r, g, b); rect(x + w, y, 2, h + 2, r, g, b); };

if (ROUND === 'w1-18-r2') {
  const p = rep.people_channel || { legs_run: 0, journal_writes: 0 };
  const w = (world && world.cases || []).find((c) => c.passed) || null;
  text('THE ROUTER, AND THE SAME RUN WITH THE ROUTER TAKEN OUT', 40, BY, 0xCC, 0xC4, 0x9A, 2);

  box(40, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('TALK TO THE PERSON THE FILE NAMES', 56, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text(`${p.legs_run} OF ${p.legs_run} GATES STOP REFUSING`, 56, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text(`AND NOTE() WRITES ${p.journal_writes} JOURNAL ENTRIES`, 56, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('THE SAME RUN, REVEALROUTES EMPTIED', 666, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text(`0 OF ${p.legs_run} GATES STOP REFUSING`, 666, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text('AND 0 JOURNAL ENTRIES ARE WRITTEN', 666, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  const FY = BY + 160;
  text(`${rep.routed} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS NOW HAVE A ROUTE IN PLAY - WAS 8`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  if (w) {
    text(`IN THE RUNNING GAME: ${w.quest} - TALK TO ${String(w.npc).toUpperCase()}`, 40, FY + 30, 0x7A, 0xAA, 0x88, 2);
    // The 5x7 font has no brackets, so the arrows carry the before/after on their own.
    text(`KNOWS NOTHING > KNOWS ${w.knows_after.join(' ')}`, 40, FY + 52, 0xCC, 0xEE, 0xCC, 2);
    text(`JOURNAL ${(w.journal_indices_before || []).join(' ')} > ${(w.journal_indices_after || []).join(' ')} - THE MIDDLE OF IT, WRITTEN BY PLAY`, 40, FY + 74, 0xCC, 0xEE, 0xCC, 2);
    text('CONTROLS: THE WRONG PERSON TELLS YOU NOTHING, AND NOR DOES THE RIGHT ONE', 40, FY + 96, 0x9A, 0x9A, 0x92, 2);
    text('BEFORE YOU HAVE TAKEN THE JOB.', 40, FY + 118, 0x9A, 0x9A, 0x92, 2);
  }
  text(`STILL UNROUTED: ${rep.unrouted}. LEDGER, LETTER AND ENVIRONMENT NAME OBJECTS THIS BUILD`, 40, FY + 148, 0xCC, 0xAA, 0x6A, 2);
  text('DOES NOT CONTAIN. THAT IS CONTENT, NOT A READER.', 40, FY + 170, 0xCC, 0xAA, 0x6A, 2);
} else {
  text('THE SAME COMMIT, TWO INSTRUMENTS, ONE LINE APART', 40, BY, 0xCC, 0xC4, 0x9A, 2);
  box(40, BY + 26, 570, 100, 0x6E, 0x2B, 0x2B);
  text('MAINLINE-CHAIN-FLOOR, AS SHIPPED IN ROUND 2', 56, BY + 40, 0xCC, 0xAA, 0xAA, 2);
  text('40/40 SIGNATURES COMPLETE BOTH CHAINS', 56, BY + 62, 0xEE, 0xCC, 0xCC, 2);
  text('IT CALLED H.QUESTREVEAL() ON EVERY STEP', 56, BY + 90, 0x9A, 0x7A, 0x7A, 2);

  box(650, BY + 26, 570, 100, 0x2E, 0x7A, 0x44);
  text('THE SAME TOOL, THAT ONE LINE REMOVED', 666, BY + 40, 0xAA, 0xCC, 0xAA, 2);
  text('0/40 - ALL STOP AT Q-MAIN-06', 666, BY + 62, 0xCC, 0xEE, 0xCC, 2);
  text('WHERE THE WALK ALWAYS SAID THEY STOP', 666, BY + 90, 0x7A, 0x9A, 0x7A, 2);

  const FY = BY + 160;
  text(`${rep.unrouted} OF ${rep.demanded_reveals} REVEALS A RESOLUTION DEMANDS HAVE NO ROUTE IN PLAY`, 40, FY, 0xEE, 0xEE, 0xE4, 2);
  text(`${rep.fully_blocked_quests.length} QUESTS HAVE EVERY RESOLUTION BLOCKED, ALL OF THEM MAINLINE:`, 40, FY + 24, 0x9A, 0x9A, 0x92, 2);
  text(rep.fully_blocked_quests.map((q) => q.id).join(', '), 40, FY + 46, 0xCC, 0xAA, 0x6A, 2);
  text('REPAIRED THIS ROUND: THE HOOK TABLE IS NOW REACHABLE FROM A PLAYED RESOLUTION,', 40, FY + 78, 0x7A, 0xAA, 0x88, 2);
  text(`AND ${rep.end_to_end.demonstrable} REVEALS NOW FIRE FROM PLAY WITH NO HARNESS VERB TOUCHED.`, 40, FY + 100, 0x7A, 0xAA, 0x88, 2);
}

png(OUT);
console.log('wrote', OUT);
