#!/usr/bin/env node
/**
 * crossing-ridge-chart.mjs — THE PICTURE FOR W1-CROSSING: what is actually on the Valus Ridge.
 *
 * A long-section of `stormhold-helstrom`, the crossing's first leg, drawn from `roads.json` and
 * from `game/src/world/field.js` — the same module the game collides against. The natural ground
 * is the filled profile; the road's deck is the line over it; the declared `deck_spans` are shaded.
 *
 * It is here because the last round reported the crossing as stopped by "a 57.5 degree skirt", and
 * a picture is the shortest way to say why that was the wrong diagnosis. The road's own gradient
 * never exceeds 24.3 degrees anywhere in the province, against a 40 degree walkable limit. What is
 * on the ridge is a **471 m viaduct standing 50.6 m above the mountainside**, and the body had
 * walked off the side of it: the stall was 4.98 m from the centreline and 15.3 m BELOW the deck.
 *
 * The PNG writer and the shared 5x5 chart font come from `tools/world/road-join-chart.mjs`, which
 * is where this project's hand-rolled chart lives. No browser and no engine.
 *
 * Usage: node tools/world/crossing-ridge-chart.mjs [--out docs/shots/<name>.png]
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';
import { makeText } from '../lib/chart-font.mjs';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1]
  : 'docs/shots/2026-08-08-w1-crossing-the-road-over-the-valus-ridge-is-a-bridge.png';
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const W = 1240, H = 700;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
const line = (x0, y0, x1, y1, r, g, b, wd = 1) => {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) set(x + dx - (wd >> 1), y + dy - (wd >> 1), r, g, b);
  }
};
const ring = (cx, cy, rad, r, g, b, wd = 2) => {
  for (let a = 0; a < 1440; a++) for (let w = 0; w < wd; w++) set(cx + Math.cos(a * Math.PI / 720) * (rad + w), cy + Math.sin(a * Math.PI / 720) * (rad + w), r, g, b);
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
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const text = makeText(rect);

// ---- the data ----------------------------------------------------------------------------------
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
field.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
const roads = rd('game/data/world/roads.json');
const leg = roads.legs.find((l) => l.id === 'stormhold-helstrom');
const pts = leg.points;
const arc = [0];
for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
const TOTAL = arc[arc.length - 1];

// ---- the frame -----------------------------------------------------------------------------------
const PX = 70, PY = 130, PW = 1100, PH = 430;
const X0 = 300, X1 = 1700;                  // metres along the leg
const Y0 = 60, Y1 = 270;                    // metres of elevation
const sx = (m) => PX + (m - X0) / (X1 - X0) * PW;
const sy = (y) => PY + PH - (y - Y0) / (Y1 - Y0) * PH;

rect(0, 0, W, H, 0x10, 0x11, 0x14);
rect(PX - 2, PY - 2, PW + 4, PH + 4, 0x28, 0x28, 0x30);
rect(PX, PY, PW, PH, 0x16, 0x18, 0x1c);
for (let m = 400; m <= X1; m += 200) { line(sx(m), PY, sx(m), PY + PH, 0x24, 0x26, 0x2c); text(`${m}m`, sx(m) - 14, PY + PH + 8, 0x60, 0x64, 0x70); }
for (let y = 75; y <= Y1; y += 25) { line(PX, sy(y), PX + PW, sy(y), 0x24, 0x26, 0x2c); text(`${y}`, PX - 34, sy(y) - 3, 0x60, 0x64, 0x70); }

// the spans, shaded first so everything else draws over them
for (const sp of leg.deck_spans || []) {
  const a = sx(arc[sp.from_i]), b = sx(arc[Math.min(sp.to_i, pts.length - 1)]);
  for (let x = Math.max(PX, a); x <= Math.min(PX + PW, b); x++) for (let y = PY; y < PY + PH; y++) {
    if (((x + y) & 7) === 0) set(x, y, 0x3a, 0x2a, 0x22);
  }
}

// the natural mountainside, filled
let prev = null;
for (let m = X0; m <= X1; m += 1.5) {
  let i = 0; while (i + 1 < arc.length && arc[i + 1] < m) i++;
  const u = (m - arc[i]) / Math.max(1e-6, arc[i + 1] - arc[i]);
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
  const g = field.bareHeightAt(x, z);
  const X = sx(m), Y = sy(g);
  for (let y = Math.max(PY, Y); y < PY + PH; y++) set(X, y, 0x22, 0x2a, 0x26);
  if (prev) line(prev[0], prev[1], X, Y, 0x4a, 0x5c, 0x50, 2);
  prev = [X, Y];
}

// the road deck
prev = null;
for (let i = 0; i < pts.length; i++) {
  if (arc[i] < X0 - 20 || arc[i] > X1 + 20) continue;
  const X = sx(arc[i]), Y = sy(pts[i][2]);
  if (prev) line(prev[0], prev[1], X, Y, 0xe8, 0xc4, 0x60, 3);
  prev = [X, Y];
}

// the drop, marked at the worst span
const big = (leg.deck_spans || []).reduce((a, s) => (s.max_height_m > (a ? a.max_height_m : 0) ? s : a), null);
if (big) {
  let worst = big.from_i;
  for (let i = big.from_i; i <= big.to_i && i < pts.length; i++) {
    const f = pts[i][2] - field.bareHeightAt(pts[i][0], pts[i][1]);
    if (f > pts[worst][2] - field.bareHeightAt(pts[worst][0], pts[worst][1])) worst = i;
  }
  const X = sx(arc[worst]);
  line(X, sy(pts[worst][2]), X, sy(field.bareHeightAt(pts[worst][0], pts[worst][1])), 0xff, 0x70, 0x60, 2);
  text(`${big.max_height_m}M OF AIR`, X + 8, sy(pts[worst][2]) + 40, 0xff, 0x90, 0x80);
  text(`${big.length_m}M OF VIADUCT`, X + 8, sy(pts[worst][2]) + 56, 0xff, 0x90, 0x80);
}

// where the body used to stop, and how far off the road it was
const STALL_M = 550.1;
const sX = sx(STALL_M);
let si = 0; while (si + 1 < arc.length && arc[si + 1] < STALL_M) si++;
ring(sX, sy(pts[si][2] - 15.3), 6, 0xff, 0x50, 0x50, 2);
line(sX, sy(pts[si][2]), sX, sy(pts[si][2] - 15.3), 0xff, 0x50, 0x50, 1);
text('THE BODY STOPPED HERE  550.1M', sX - 250, sy(pts[si][2] - 15.3) + 14, 0xff, 0x70, 0x70);
text('4.98M OFF THE ROAD AND 15.3M BELOW IT', sX - 250, sy(pts[si][2] - 15.3) + 30, 0xa0, 0xa8, 0xb4);

// ---- the words -------------------------------------------------------------------------------
text('THE ROAD OVER THE VALUS RIDGE IS A BRIDGE', 70, 34, 0xf0, 0xf0, 0xf4);
text('STORMHOLD TO HELSTROM, THE CROSSINGS FIRST LEG   LONG SECTION   ELEVATION IN METRES', 70, 56, 0x90, 0x98, 0xa8);
text('WORST ROAD GRADIENT IN THE PROVINCE 24.3 DEG   A BODY CAN WALK 40   THE ROAD WAS NEVER TOO STEEP', 70, 78, 0x80, 0xc8, 0x90);
text(`918M OF THIS 2921M LEG IS DECK SPAN   ${(leg.deck_spans || []).length} STRUCTURES   TALLEST ${big ? big.max_height_m : 0}M`, 70, 96, 0xe0, 0xb0, 0x70);

const legY = PY + PH + 40;
rect(72, legY + 4, 26, 4, 0xe8, 0xc4, 0x60); text('THE ROAD DECK', 108, legY, 0xc0, 0xc8, 0xd0);
rect(302, legY + 4, 26, 4, 0x4a, 0x5c, 0x50); text('THE MOUNTAINSIDE UNDER IT', 338, legY, 0xc0, 0xc8, 0xd0);
rect(702, legY + 4, 26, 4, 0x3a, 0x2a, 0x22); text('DECLARED DECK SPAN  A STRUCTURE WITH AIR UNDER IT', 738, legY, 0xc0, 0xc8, 0xd0);
text('AFTER THE FIX THE BODY HOLDS THE MIDDLE OF THE SIX METRE DECK TO WITHIN 1.22M', 70, legY + 34, 0x80, 0xc8, 0x90);
text('IT STEERS AT THE ROAD NOW  NOT AT THE NEXT MILESTONE', 70, legY + 52, 0x90, 0x98, 0xa8);
text('MEASURED OFF GAME/SRC/WORLD/FIELD.JS AND GAME/DATA/WORLD/ROADS.JSON  NO BROWSER', 70, H - 26, 0x50, 0x56, 0x62);

png(OUT);
console.log(`wrote ${OUT}`);
console.log(`  leg ${leg.id}  ${TOTAL.toFixed(0)} m, ${(leg.deck_spans || []).length} spans, ${leg.deck_span_m} m of deck, tallest ${big ? big.max_height_m : 0} m`);
