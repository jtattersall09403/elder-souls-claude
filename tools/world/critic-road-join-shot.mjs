#!/usr/bin/env node
/**
 * critic-road-join-shot.mjs — the picture for the W1-ROAD-JOIN round-1 verdict.
 *
 * A plan view of Blackrose, drawn twice from the SAME `roads.json`, with only `planSettlement()`
 * swapped:
 *
 *   LEFT   the footprints as they stood at `322f708`, where the join was cut. The road threads
 *          between the houses. 0 of 10 legs blocked.
 *   RIGHT  the footprints at HEAD, after W1-04 round 4's per-axis shrink grew 54 of 202 exteriors.
 *          The SAME road now runs through five of them. 3 of 10 legs blocked, and THE CROSSING is
 *          offended at 5,610 m.
 *
 * Nothing about the road changed between the two panels. The walls moved out from under it. That
 * is what a build-time join with no gate looks like twenty-four minutes later.
 *
 * Offline: no engine, no browser — the picture is a function of two `planSettlement` revisions and
 * one road file. The PNG writer and the 5x7 font follow `tools/world/road-join-chart.mjs`, which
 * is where this project's hand-rolled chart lives.
 *
 * Usage:
 *   node tools/world/critic-road-join-shot.mjs --old <exterior.js@322f708> --new <exterior.js@HEAD>
 *        [--out docs/shots/<name>.png]
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argOf = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const OUT = argOf('--out', 'docs/shots/2026-08-08-critic-road-join-the-walls-moved-out-from-under-the-road.png');
const OLD = argOf('--old', null), NEW = argOf('--new', null);
if (!OLD || !NEW) { process.stderr.write('need --old <exterior.js> --new <exterior.js>\n'); process.exit(2); }
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const W = 1400, H = 780;
const px = new Uint8Array(W * H * 3).fill(0x11);
let CLIP = null;
const put = (x, y, c) => {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (CLIP && (x < CLIP[0] || y < CLIP[1] || x > CLIP[2] || y > CLIP[3])) return;
  const i = (y * W + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
};
const line = (x0, y0, x1, y1, c, w = 1) => {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let dy = -(w >> 1); dy <= w >> 1; dy++) for (let dx = -(w >> 1); dx <= w >> 1; dx++) put(x + dx, y + dy, c);
  }
};
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
// `chart-font.mjs makeText(rect)` wants the tool's own filled-rect primitive and hands back a
// `text(s, x, y, r, g, b, scale)`. Adopting it rather than hand-rolling a font is the point of
// that library — and W1-CHARTFONT's own history is why: a sheared glyph reads as a different digit.
const _rectRGB = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, [r, g, b]); };
const _text = makeText(_rectRGB);
const text = (s, x, y, c, scale = 2) => _text(s, x, y, c[0], c[1], c[2], scale);

const INK = [0xE6, 0xE2, 0xD8], DIM = [0x7A, 0x76, 0x70];
const ROAD = [0x6F, 0xD3, 0x7A], HOUSE = [0x55, 0x6B, 0x8A], BAD = [0xE5, 0x53, 0x4A], BADFILL = [0x5A, 0x22, 0x1E];

const roads = rd('game/data/world/roads.json');
const interiors = (() => {
  const out = {};
  const dir = join(ROOT, 'game/data/world/interiors');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (d && d.id) out[d.id] = d;
  }
  return out;
})();

async function planOf(implPath) {
  const m = await import(resolve(implPath));
  return { plan: m.planSettlement(rd('game/data/world/settlements/blackrose.json'), interiors), inside: m.insideBuilding };
}

const LEGS = ['helstrom-blackrose', 'soulrest-blackrose', 'blackrose-lilmoth'];
const CENTRE = (() => { const p = rd('game/data/world/settlements/blackrose.json').pos; return { x: p[0], z: p[2] }; })();
const SPAN = 120;   // metres across each panel

function panel(px0, py0, pw, ph, plan, inside, title, subFn, subCol) {
  const badIds = [];
  CLIP = [px0, py0, px0 + pw, py0 + ph];
  rect(px0, py0, px0 + pw, py0 + ph, [0x18, 0x18, 0x1A]);
  const sc = pw / SPAN;
  const wx = (x) => px0 + pw / 2 + (x - CENTRE.x) * sc;
  const wy = (z) => py0 + ph / 2 + (z - CENTRE.z) * sc;
  // buildings
  for (const b of plan.buildings) {
    const fp = b.drawn_footprint_m || b.footprint_m;
    const yaw = (b.yaw_deg || 0) * Math.PI / 180;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hw = fp[0] / 2, hd = fp[1] / 2;
    const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [b.x + lx * c - lz * s, b.z + lx * s + lz * c]);
    // is any road sample inside this building?
    let bad = false;
    for (const legId of LEGS) {
      const leg = roads.legs.find((l) => l.id === legId);
      for (let k = 0; k + 1 < leg.points.length && !bad; k++) {
        const [ax, az] = leg.points[k], [bx2, bz2] = leg.points[k + 1];
        const L = Math.hypot(bx2 - ax, bz2 - az);
        for (let d = 0; d < L; d += 0.5) {
          const u = d / L;
          if (inside({ buildings: [b] }, ax + u * (bx2 - ax), az + u * (bz2 - az), 0)) { bad = true; break; }
        }
      }
      if (bad) break;
    }
    if (bad) {
      badIds.push(b.id);
      // fill it, so the offence reads at a glance
      const xs = corners.map((q) => wx(q[0])), ys = corners.map((q) => wy(q[1]));
      for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        // point-in-oriented-box in world space
        const wxm = CENTRE.x + (x - px0 - pw / 2) / sc, wzm = CENTRE.z + (y - py0 - ph / 2) / sc;
        if (inside({ buildings: [b] }, wxm, wzm, 0)) put(x, y, BADFILL);
      }
    }
    const col = bad ? BAD : HOUSE;
    for (let i = 0; i < 4; i++) line(wx(corners[i][0]), wy(corners[i][1]), wx(corners[(i + 1) % 4][0]), wy(corners[(i + 1) % 4][1]), col, bad ? 3 : 1);
  }
  // roads
  for (const legId of LEGS) {
    const leg = roads.legs.find((l) => l.id === legId);
    for (let k = 0; k + 1 < leg.points.length; k++) {
      line(wx(leg.points[k][0]), wy(leg.points[k][1]), wx(leg.points[k + 1][0]), wy(leg.points[k + 1][1]), ROAD, 3);
    }
  }
  CLIP = null;
  text(title, px0, py0 - 44, INK, 2);
  text(subFn(badIds), px0, py0 - 22, subCol, 2);
  return badIds;
}

const old = await planOf(OLD);
const now = await planOf(NEW);

text('THE WALLS MOVED OUT FROM UNDER THE ROAD', 40, 26, INK, 3);
text('Blackrose, plan view, 120 m across. The SAME game/data/world/roads.json in both panels.', 40, 62, DIM, 2);
text('Only planSettlement() differs. Nothing under game/data/world/settlements/ or /interiors/ changed.', 40, 82, DIM, 2);

const badOld = panel(60, 200, 620, 500, old.plan, old.inside, 'exterior.js at 322f708 - where the join was cut', (ids) => `0 of 10 legs blocked province-wide; ${ids.length} here`, ROAD);
const badNew = panel(730, 200, 620, 500, now.plan, now.inside, 'exterior.js at HEAD a2031bb - 24 minutes later', (ids) => `3 of 10 legs blocked; ${ids.length} of these houses are on it`, BAD);
process.stdout.write(`  old panel offenders: ${badOld.join(', ') || 'none'}\n  new panel offenders: ${badNew.join(', ')}\n`);

text('54 of 202 exteriors grew and none shrank (+1,846 m2) when the per-axis shrink landed in 0dc0703.', 60, 726, DIM, 2);
text('THE CROSSING is offended at 5,610 m. node tools/world/build-roads.mjs returns it to 0 of 10 - nothing runs it.', 60, 748, DIM, 2);

function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
png(OUT);
process.stdout.write(`  ${OUT}\n`);
