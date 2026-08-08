#!/usr/bin/env node
/**
 * road-join-chart.mjs — THE PICTURE FOR W1-ROAD-JOIN: the road where it used to end in a wall.
 *
 * A plan view of Stormhold at the point where THE CROSSING leaves the capital. The 27 building
 * footprints are drawn from `planSettlement()` — the same function the game builds its collision
 * walls from — with the OLD trunk road in red running straight through `stormhold-scribe`, and the
 * NEW one in green threading between the houses. The two points where a real body walking the
 * route actually stopped are marked, because those are the numbers that decide whether the
 * province can be crossed on foot.
 *
 * NO BROWSER AND NO ENGINE, on purpose and also of necessity: at the time this was drawn the whole
 * tree's browser probes were down (`Engine._boot()` throws on an undeclared dialogue topic merge
 * order, `game/data/dialogue/topics/_manifest.json` being absent from `game/data/index.json`), so
 * a screenshot could not be taken by anybody. Everything here is read off artifacts on disk.
 *
 * The PNG writer and the 5x7 font are lifted from `tools/world/w1-01-r4-crossing-chart.mjs`, which
 * lifted them from `tools/analysis/w1-13-r4-chart.mjs`, which is where this project's hand-rolled
 * chart lives.
 *
 * Usage: node tools/world/road-join-chart.mjs [--out docs/shots/<name>.png]
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planSettlement } from '../../game/src/render/exterior.js';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1]
  : 'docs/shots/2026-08-08-w1-road-join-the-road-now-goes-between-the-houses.png';
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const W = 1240, H = 720;
const px = new Uint8Array(W * H * 3).fill(0x12);
// A clip window, so the plan panel stays a panel: a town is wider than the frame it is drawn in
// and without this the buildings spill across the whole page.
let CLIP = null;
const set = (x, y, r, g, b) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (CLIP && (x < CLIP[0] || y < CLIP[1] || x >= CLIP[0] + CLIP[2] || y >= CLIP[1] + CLIP[3])) return;
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
const disc = (cx, cy, rad, r, g, b) => {
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) set(cx + i, cy + j, r, g, b);
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
// The shared 5x5 chart font. This tool used to carry its own copy of the 23-character
// sheared table; tools/lib/chart-font.mjs is the one authored source and it throws on a
// row of the wrong width.
const text = makeText(rect);

// ---- the data ----------------------------------------------------------------------------------
const before = rd('reports/w1-road-join/roads-BEFORE-join.json');
const after = rd('game/data/world/roads.json');
const armBefore = rd('reports/w1-road-join/crossing-before-join-control.json').runs[0];
const armAfter = rd('reports/w1-road-join/crossing-after-join.json').runs[0];
const lens = rd('reports/w1-road-join/leg-lengths.json');

const interiors = {};
for (const f of readdirSync(join(ROOT, 'game/data/world/interiors'))) {
  if (!f.endsWith('.json')) continue;
  const d = rd(`game/data/world/interiors/${f}`);
  if (d && d.id) interiors[d.id] = d;
}
const plan = planSettlement(rd('game/data/world/settlements/stormhold.json'), interiors);

// ---- the frame: a 300 m box around the capital and the first stretch of THE CROSSING ------------
const CX = 2183, CZ = 812, SPAN = 132;              // world metres
const PX = 40, PY = 100, PW = 620, PH = 566;         // the plan panel, in pixels
const sc = Math.min(PW / SPAN, PH / SPAN);
const wx = (x) => PX + PW / 2 + (x - CX) * sc;
const wy = (z) => PY + PH / 2 + (z - CZ) * sc;

rect(PX - 2, PY - 2, PW + 4, PH + 4, 0x28, 0x28, 0x30);
rect(PX, PY, PW, PH, 0x16, 0x18, 0x1c);
CLIP = [PX, PY, PW, PH];
// 25 m grid
for (let g = -120; g <= 120; g += 25) {
  line(wx(CX + g), PY, wx(CX + g), PY + PH, 0x22, 0x24, 0x2a);
  line(PX, wy(CZ + g), PX + PW, wy(CZ + g), 0x22, 0x24, 0x2a);
}

// buildings, drawn as their oriented footprints — the same rectangles the walls are built on
const SCRIBE = 'stormhold-scribe';
for (const b of plan.buildings) {
  const fp = b.drawn_footprint_m || b.footprint_m;
  const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const hot = b.id === SCRIBE;
  const corners = [[-fp[0] / 2, -fp[1] / 2], [fp[0] / 2, -fp[1] / 2], [fp[0] / 2, fp[1] / 2], [-fp[0] / 2, fp[1] / 2]]
    .map(([lx, lz]) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
  // fill by scanning the bounding box and testing local containment
  const xs = corners.map((q) => q[0]), zs = corners.map((q) => q[1]);
  for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= fp[0] / 2 && Math.abs(lz) <= fp[1] / 2) {
        set(wx(x), wy(z), hot ? 0x7a : 0x3e, hot ? 0x3a : 0x42, hot ? 0x36 : 0x4c);
      }
    }
  }
  for (let i = 0; i < 4; i++) line(wx(corners[i][0]), wy(corners[i][1]), wx(corners[(i + 1) % 4][0]), wy(corners[(i + 1) % 4][1]),
    hot ? 0xd8 : 0x7a, hot ? 0x86 : 0x86, hot ? 0x70 : 0x9c);
}

// the two roads
function drawLeg(doc, id, r, g, b, wd) {
  const leg = doc.legs.find((l) => l.id === id);
  for (let i = 1; i < leg.points.length; i++) {
    const a = leg.points[i - 1], q = leg.points[i];
    if (Math.max(Math.abs(a[0] - CX), Math.abs(a[1] - CZ)) > SPAN) continue;
    line(wx(a[0]), wy(a[1]), wx(q[0]), wy(q[1]), r, g, b, wd);
  }
}
drawLeg(before, 'stormhold-helstrom', 0xe0, 0x54, 0x44, 3);
drawLeg(after, 'stormhold-helstrom', 0x54, 0xd0, 0x82, 3);

// where the bodies stopped
const sB = armBefore.stalled.pos, sA = armAfter.stalled.pos;
ring(wx(sB[0]), wy(sB[1]), 9, 0xff, 0x86, 0x70, 2);
disc(wx(sB[0]), wy(sB[1]), 3, 0xff, 0x86, 0x70);
text('39 M - THE BODY STOPPED HERE', wx(sB[0]) + 14, wy(sB[1]) - 12, 0xff, 0xa0, 0x8c, 1);
text('STORMHOLD-SCRIBE', wx(sB[0]) + 14, wy(sB[1]) + 2, 0xff, 0xa0, 0x8c, 1);
if (Math.max(Math.abs(sA[0] - CX), Math.abs(sA[1] - CZ)) <= SPAN) {
  ring(wx(sA[0]), wy(sA[1]), 9, 0x9c, 0xe0, 0xff, 2);
}

CLIP = null;
text('STORMHOLD, IN PLAN - THE CROSSING LEAVES THE CAPITAL', PX, PY - 26, 0xcc, 0xd4, 0xe0, 2);
text('27 BUILDING FOOTPRINTS FROM PLANSETTLEMENT(), 25 M GRID.  RED: THE OLD ROAD.  GREEN: THE NEW ONE.', PX, PY + PH + 12, 0x78, 0x80, 0x90, 1);

// ---- the right-hand column ---------------------------------------------------------------------
let X = 700, y = 40;
text('THE ROAD WENT THROUGH THE HOUSE', X, y, 0xe8, 0xec, 0xf4, 2); y += 24;
text('W1-ROAD-JOIN - THE ROADS AND THE SETTLEMENTS NOW SHARE ONE GROUND', X, y, 0x88, 0x92, 0xa4, 1); y += 26;

rect(X, y, 500, 2, 0x30, 0x34, 0x3c); y += 14;
text('TWO GENERATORS, ONE PIECE OF GROUND, NO JOIN', X, y, 0xff, 0xc0, 0x70, 1); y += 16;
text('BUILD-ROADS.MJS ROUTED OVER TERRAIN. PLANSETTLEMENT() PUT', X, y, 0xa8, 0xb0, 0xc0, 1); y += 13;
text('HOUSES ON THE SAME GROUND AFTER. NEITHER HAD SEEN THE OTHER.', X, y, 0xa8, 0xb0, 0xc0, 1); y += 24;

const rows = [
  ['LEGS THAT PASS THROUGH A BUILDING', '10 OF 10', '0 OF 10'],
  ['OFFENCES ON THE TWO NAMED ROUTES', '16', '0'],
  ['A BODY ON THE CROSSING, WALLS ON', `${armBefore.path_m} M`, `${armAfter.path_m} M`],
  ['WHAT STOPPED IT', '59 SOLIDS', '0 SOLIDS'],
  ['THE CROSSING, BUILT', `${before.named_routes.crossing.metres} M`, `${after.named_routes.crossing.metres} M`],
  ['THE CROSSING, ON FOOT', `${before.named_routes.crossing.walk_min} MIN`, `${after.named_routes.crossing.walk_min} MIN`],
  ['WORST LEG ERROR VS RI-WLD01', '1.78%', `${lens.worst_err_vs_declared_after_pct}%`],
];
text('', X, y, 0, 0, 0);
text('BEFORE', X + 300, y, 0xe0, 0x8c, 0x7c, 1);
text('AFTER', X + 410, y, 0x7c, 0xd8, 0x9c, 1); y += 15;
for (const [k, a, b] of rows) {
  text(k, X, y, 0x9c, 0xa4, 0xb4, 1);
  text(a, X + 300, y, 0xe0, 0x8c, 0x7c, 1);
  text(b, X + 410, y, 0x7c, 0xd8, 0x9c, 1);
  y += 15;
}
y += 12;
rect(X, y, 500, 2, 0x30, 0x34, 0x3c); y += 14;
text('WHICH SIDE YIELDED, AND WHY', X, y, 0xff, 0xc0, 0x70, 1); y += 16;
for (const s of [
  'THE ROAD. ARBITRATION S28 ALREADY RULED IT: SETTLEMENT',
  'POSITIONS ARE IMMOVABLE, THE ROUTE BETWEEN THEM MAY BE',
  'RE-CUT. NOT ONE BUILDING MOVED.',
  '',
  'AND NOT A DETOUR EITHER. ONLY THE PART OF A LEG THAT RUNS',
  'WITHIN 55 M OF A BUILDING IS RE-CUT, ON A 1 M GRID WHERE THE',
  'FOOTPRINTS ARE THE WALLS. THE ROAD GOES BETWEEN THE HOUSES',
  'AND BECOMES THE STREET. THE WHOLE JOIN COST 95 M ON A',
  '6,911 M CROSSING - 0.8 OF A WALKING MINUTE.',
]) { text(s, X, y, 0xa8, 0xb0, 0xc0, 1); y += 13; }
y += 10;
rect(X, y, 500, 2, 0x30, 0x34, 0x3c); y += 14;
text('WHAT IS STILL IN THE WAY', X, y, 0xff, 0xc0, 0x70, 1); y += 16;
for (const s of [
  'THE BODY NOW GETS 550 M, NOT 39, AND STOPS WITH ZERO SOLID',
  'SHAPES ANYWHERE NEAR IT - ON A 57.5 DEGREE SKIRT ON THE',
  'VALUS RIDGE, 5 M OFF A 3.6 M DECK. THAT DEFECT IS OLDER THAN',
  'THIS FIX: THE SAME 84 SLOPE RUNS OVER 40 DEGREES WERE ON THE',
  'OLD ROAD TOO. NOBODY HAD EVER GOT PAST THE WALL TO MEET IT.',
]) { text(s, X, y, 0xa8, 0xb0, 0xc0, 1); y += 13; }

text('MEASURED OFFLINE, NO ENGINE. THE TWO BODY WALKS BY TOOLS/WORLD/CROSSING.MJS - ONE BROWSER, SAME COMMIT, ONE VARIABLE: ROADS.JSON.',
  PX, H - 14, 0x60, 0x68, 0x78, 1);

png(OUT);
process.stdout.write(`${OUT}\n`);
