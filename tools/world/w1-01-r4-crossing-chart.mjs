// THE PICTURE FOR W1-01 ROUND 4: the road out of the capital goes through somebody's house.
//
// A plan view of THE CROSSING — the province's headline "about an hour on foot", Stormhold south
// gate to Lilmoth harbour steps — with the sixteen places where a named route passes through a
// building footprint marked on it, and the two points at which a real body walking the route
// actually stopped.
//
// No browser and no engine: this reads `reports/road-through-building.json` and the two crossing
// arm artifacts and plots them. The PNG writer and the 5x7 font are lifted from
// `tools/analysis/w1-13-r4-chart.mjs`, which is where this project's other hand-rolled chart lives.
//
// Usage: node tools/world/w1-01-r4-crossing-chart.mjs [--out docs/shots/<name>.png]

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1]
  : 'docs/shots/2026-08-08-w1-01-r4-the-road-out-of-the-capital-goes-through-a-house.png';
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const rtb = rd('reports/road-through-building.json');
const roads = rd('game/data/world/roads.json');
const armA = rd('reports/w1-01-r4/crossing-A-solids-on.json').runs[0];
let armB = null;
try { armB = rd('reports/w1-01-r4/crossing-B-solids-off.json').runs[0]; } catch { /* not landed */ }

const W = 1180, H = 780;
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
    for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) set(x + dx, y + dy, r, g, b);
  }
};
const disc = (cx, cy, rad, r, g, b) => {
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) set(cx + i, cy + j, r, g, b);
};
const ring = (cx, cy, rad, r, g, b) => {
  for (let a = 0; a < 360; a++) set(cx + Math.cos(a * Math.PI / 180) * rad, cy + Math.sin(a * Math.PI / 180) * rad, r, g, b);
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

// ---- the route, in world metres ----------------------------------------------------------------
const named = roads.named_routes.crossing;
const pts = [];
for (let i = 0; i + 1 < named.settlements.length; i++) {
  const a = named.settlements[i], b = named.settlements[i + 1];
  const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  const p = leg.from === a ? leg.points : leg.points.slice().reverse();
  for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push(p[k]);
}
// cumulative distance per point, so a "43 m" offence can be put on the map
const cum = [0];
for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
const atM = (m) => {
  let i = 1; while (i < cum.length && cum[i] < m) i++;
  if (i >= cum.length) return pts[pts.length - 1];
  const t = (m - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])];
};

const PAD = { l: 70, r: 470, t: 96, b: 60 };
const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
const x0 = Math.min(...xs) - 120, x1 = Math.max(...xs) + 120;
const z0 = Math.min(...zs) - 120, z1 = Math.max(...zs) + 120;
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
const sc = Math.min(plotW / (x1 - x0), plotH / (z1 - z0));
const SX = (x) => PAD.l + (x - x0) * sc + (plotW - (x1 - x0) * sc) / 2;
const SZ = (z) => PAD.t + (z - z0) * sc;

// ---- header ------------------------------------------------------------------------------------
text('W1-01 R4   THE ROAD OUT OF THE CAPITAL GOES THROUGH SOMEBODYS HOUSE', 30, 24, 0xf0, 0xe6, 0xc8, 2);
text(`THE CROSSING, ${named.metres} M ON FOOT   COMMIT ${String(rtb.git && rtb.git.commit).slice(0, 7)}   DIRTY=${rtb.git && rtb.git.dirty}`,
  30, 50, 0x8a, 0x92, 0x9c, 1);
text('16 PLACES WHERE A NAMED ROUTE PASSES THROUGH A BUILDING FOOTPRINT. 10 OF 10 BUILT LEGS.',
  30, 66, 0x8a, 0x92, 0x9c, 1);

// ---- the route -----------------------------------------------------------------------------------
for (let i = 1; i < pts.length; i++) line(SX(pts[i - 1][0]), SZ(pts[i - 1][1]), SX(pts[i][0]), SZ(pts[i][1]), 0x55, 0x5e, 0x52, 3);

// ---- the settlements -------------------------------------------------------------------------
for (const s of rd('game/data/world/pois.json').pois.filter((p) => p.kind === 'settlement')) {
  if (!named.settlements.includes(s.name)) continue;
  const cx = SX(s.pos[0]), cy = SZ(s.pos[2]);
  ring(cx, cy, 9, 0x9a, 0xa4, 0x8c);
  text(s.name, cx + 14, cy - 4, 0xc8, 0xd0, 0xba, 1);
}

// ---- the offences ------------------------------------------------------------------------------
const blocks = (rtb.routes.find((r) => r.route === 'crossing') || { blocked_blocks: [] }).blocked_blocks;
for (const b of blocks) {
  const p = atM((b.from_m + b.to_m) / 2);
  disc(SX(p[0]), SZ(p[1]), 5, 0xd0, 0x3a, 0x2e);
}

// ---- where the body actually stopped -----------------------------------------------------------
const stopA = armA.stalled ? armA.stalled.pos : null;
if (stopA) { const cx = SX(stopA[0]), cy = SZ(stopA[1]); ring(cx, cy, 13, 0xff, 0xc4, 0x3a); ring(cx, cy, 14, 0xff, 0xc4, 0x3a); }
if (armB && armB.stalled) { const cx = SX(armB.stalled.pos[0]), cy = SZ(armB.stalled.pos[1]); ring(cx, cy, 13, 0x4d, 0xa6, 0xff); ring(cx, cy, 14, 0x4d, 0xa6, 0xff); }

// ---- the legend / the numbers ------------------------------------------------------------------
let ly = PAD.t + 6;
const LX = W - PAD.r + 34;
text('WHAT A BODY DID WITH IT', LX, ly, 0xf0, 0xe6, 0xc8, 2); ly += 30;
rect(LX, ly + 2, 10, 10, 0xd0, 0x3a, 0x2e);
text('BUILDING ON THE ROUTE', LX + 20, ly + 3, 0xc8, 0xd0, 0xba, 1); ly += 22;
ring(LX + 5, ly + 7, 6, 0xff, 0xc4, 0x3a);
text('WHERE THE BODY STOPPED, WALLS ON', LX + 20, ly + 3, 0xc8, 0xd0, 0xba, 1); ly += 22;
ring(LX + 5, ly + 7, 6, 0x4d, 0xa6, 0xff);
text('WHERE IT STOPPED, WALLS OFF', LX + 20, ly + 3, 0xc8, 0xd0, 0xba, 1); ly += 34;

const rows = [
  ['DECLARED', `${named.metres} M   ${named.walk_min} MIN ON FOOT`],
  ['', ''],
  ['ARM A  WALLS ON', `${armA.path_m} M  IN ${armA.minutes} MIN`],
  ['', `PINNED AT A WALL 4 M SHORT OF`],
  ['', `STORMHOLD-SCRIBE (43-53 M)`],
  ['', ''],
];
if (armB) {
  rows.push(['ARM B  WALLS OFF', `${armB.path_m} M  IN ${armB.minutes} MIN`]);
  rows.push(['', `CLEARS THE TOWN, NEVER ARRIVES:`]);
  rows.push(['', `${armB.remaining_points} OF ${armB.remaining_points + 60} ROUTE POINTS LEFT`]);
  rows.push(['', '']);
  rows.push(['M3 SEES 1 FRAME IN 6', `SAMPLED MEAN ${armB.mean_speed_mps} M/S`]);
  rows.push(['', `SAMPLED MAX  ${armB.max_speed_mps} M/S`]);
  rows.push(['', `INTEGRATED   ${(armB.path_m / (armB.frames / 60)).toFixed(3)} M/S`]);
  rows.push(['', `ARM A, STILL BODY: ${(armA.path_m / (armA.frames / 60)).toFixed(4)} VS ${armA.mean_speed_mps}`]);
}
for (const [k, v] of rows) {
  if (k) text(k, LX, ly, 0x8a, 0x92, 0x9c, 1);
  if (v) text(v, LX + (k ? 0 : 0), ly + (k ? 12 : 0), k ? 0xf0 : 0xc8, k ? 0xe6 : 0xd0, k ? 0xc8 : 0xba, 1);
  ly += k ? 28 : 14;
}

text('EVERY FIGURE IS A FRAME COUNT AT A FIXED 60 HZ STEP, NOT WALL CLOCK.', 30, H - 34, 0x6a, 0x72, 0x7c, 1);
png(join(ROOT, OUT));
process.stdout.write(`${OUT}\n`);
