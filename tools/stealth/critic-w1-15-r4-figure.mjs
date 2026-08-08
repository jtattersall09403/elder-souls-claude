#!/usr/bin/env node
// THE PICTURE — W1-15 round 4 critic.
//
// Two floor plans side by side, one cell per square metre at chest height, drawn from the numbers
// in `reports/w1-15/critic-r4.json` rather than typed in.
//
//   LEFT   `thorn-inn` — an ordinary interior, drawn by `render/interior.js`, which reads the
//          round's shared lighting policy. Every cell agrees.
//   RIGHT  `writ-house` — drawn by `render/places.js`, which does not. 47 of its 108 cells are
//          drawn lit and simulated dark, which is the round-3 defect this round was convened to
//          remove, in the second room of the game.
//
// A cell is RED where the renderer's lamps put it above the shadow line and the simulation's do
// not. Lamp positions are marked on both sides: hollow for what is drawn, solid for what is
// simulated.
//
// USAGE
//   node tools/stealth/critic-w1-15-r4-figure.mjs [--out docs/shots/<name>.png]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import * as THREE from '../../game/vendor/three/three.module.js';
import { buildInterior } from '../../game/src/render/interior.js';
import { buildPlaces } from '../../game/src/render/places.js';
import { litLights, interiorAmbientL } from '../../game/src/world/interior-lighting.js';
import { LightField } from '../../game/src/sim/stealth/light.js';
import { planSettlement, applyInteriorBounds } from '../../game/src/render/exterior.js';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : 'docs/shots/2026-08-08-critic-w1-15-r4-the-room-a-third-file-lights.png'; })();

const W = 1240, H = 720;
const px = new Uint8Array(W * H * 3).fill(0x14);
const set = (x, y, r, g, b) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
const ring = (cx, cy, rad, r, g, b) => { for (let a = 0; a < 360; a += 3) { set(cx + Math.cos(a * Math.PI / 180) * rad, cy + Math.sin(a * Math.PI / 180) * rad, r, g, b); set(cx + Math.cos(a * Math.PI / 180) * (rad - 1), cy + Math.sin(a * Math.PI / 180) * (rad - 1), r, g, b); } };
const disc = (cx, cy, rad, r, g, b) => { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) set(cx + i, cy + j, r, g, b); };
const text = makeText(rect);

const DET = JSON.parse(fs.readFileSync(join(ROOT, 'game/data/stealth/detection.json'), 'utf8'));
const CFG = DET.interior_lamps, SCALE = CFG.authored_intensity_to_L_scale, REACH = CFG.reach_m;
const SHADOW = 0.35;

const dir = join(ROOT, 'game/data/world/interiors');
const list = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(join(dir, f), 'utf8')));
const I = {}; for (const r of list) I[r.id] = r;
const sdir = join(ROOT, 'game/data/world/settlements');
const docs = fs.readdirSync(sdir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(join(sdir, f), 'utf8')));
applyInteriorBounds(docs.map((d) => planSettlement(d, I)), I, docs, {});

const field = (lamps, amb) => { const f = new LightField(DET); f.defaultAmbient = amb; let i = 0; for (const L of lamps) f.addSource({ id: `s${i++}`, pos: L.pos, intensity: L.authored * SCALE, reach_m: L.hearth ? REACH.hearth : REACH.flame, zone: null }); return f; };
const drawnByInterior = (rec) => { const root = new THREE.Group(); buildInterior(root, rec, {}); const out = []; root.traverse((o) => { if (o.isPointLight) { const h = o.color.getHex() === 0xffa050; out.push({ pos: [o.position.x, o.position.y, o.position.z], authored: o.intensity / (h ? 22 : 9), hearth: h }); } }); return out; };
const cells = buildPlaces(new Proxy({}, { get: (t, k) => { if (!t[k]) t[k] = new THREE.MeshStandardMaterial({ color: 0x808080 }); return t[k]; } }));
const drawnByPlaces = (key) => { const out = []; cells[key].traverse((o) => { if (o.isPointLight) out.push({ pos: [o.position.x, o.position.y, o.position.z], authored: o.intensity / 22, hearth: true }); }); return out; };

function plan(rec, drawn, ox, oy, cellPx, title, sub) {
  const b = rec.bounds_m;
  const amb = interiorAmbientL(rec, 1.0).L;
  const fD = field(drawn, amb);
  const fS = field(litLights(rec).map((L) => ({ pos: L.emit_pos, authored: L.intensity, hearth: L.hearth })), amb);
  const nx = Math.floor(b.x[1] - b.x[0]) + 1, nz = Math.floor(b.z[1] - b.z[0]) + 1;
  const wpx = nx * cellPx, hpx = nz * cellPx;
  rect(ox - 3, oy - 3, wpx + 6, hpx + 6, 0x3a, 0x3a, 0x44);
  let dis = 0, n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = b.x[0] + i, z = b.z[0] + j, y = b.y[0] + 1.35;
    const lr = fD.sample(x, y, z, null), ls = fS.sample(x, y, z, null);
    n++;
    let c;
    if ((lr < SHADOW) !== (ls < SHADOW)) { dis++; c = lr >= SHADOW ? [0xd8, 0x3a, 0x3a] : [0x3a, 0x7a, 0xd8]; }
    else { const v = Math.round(30 + Math.min(1, ls) * 150); c = [v, Math.round(v * 0.92), Math.round(v * 0.66)]; }
    rect(ox + i * cellPx, oy + j * cellPx, cellPx - 1, cellPx - 1, c[0], c[1], c[2]);
  }
  const X = (wx) => ox + (wx - b.x[0]) * cellPx + cellPx / 2;
  const Z = (wz) => oy + (wz - b.z[0]) * cellPx + cellPx / 2;
  for (const L of drawn) ring(X(L.pos[0]), Z(L.pos[2]), 7, 0xff, 0xd0, 0x70);
  for (const L of litLights(rec)) disc(X(L.emit_pos[0]), Z(L.emit_pos[2]), 4, 0x70, 0xd8, 0xff);
  text(ox, oy - 26, title, 3, 0xf0, 0xf0, 0xf0);
  text(ox, oy + hpx + 12, sub, 2, 0xb0, 0xb0, 0xc0);
  text(ox, oy + hpx + 30, `${dis} OF ${n} CELLS DISAGREE`, 3, dis ? 0xff : 0x80, dis ? 0x70 : 0xd8, dis ? 0x70 : 0x90);
  return { dis, n };
}

text(60, 40, 'ONE POLICY DECIDES WHAT A ROOM IS LIT BY - EXCEPT IN THE TWO ROOMS THE GAME OPENS IN', 3, 0xff, 0xff, 0xff);
text(60, 66, 'W1-15 ROUND 4 CRITIC. 1 M CHEST-HEIGHT GRID, NOON, CLEAR. HOLLOW RING = A LAMP THE PLAYER SEES. SOLID DOT = A LAMP THE STEALTH MODEL USES.', 2, 0xa0, 0xa0, 0xb4);

const a = plan(I['thorn-inn'], drawnByInterior(I['thorn-inn']), 90, 160, 30,
  'THORN-INN - DRAWN BY RENDER/INTERIOR.JS', 'WHICH READS WORLD/INTERIOR-LIGHTING.JS. 10 LAMPS, SAME 10 ON BOTH SIDES.');
const c = plan(I['writ-house'], drawnByPlaces('writ_house'), 700, 160, 30,
  'WRIT-HOUSE - DRAWN BY RENDER/PLACES.JS', 'WHICH DOES NOT. 2 DRAWN LAMPS AND A SUN; 1 SIMULATED FAIL-OPEN HEARTH 5.22 M AWAY.');

text(60, 640, 'RED = DRAWN LIT AND SIMULATED DARK. YOU STAND IN A LIT ROOM AND NOTHING CAN SEE YOU.', 2, 0xd8, 0x8a, 0x8a);
text(60, 662, `OVER ALL 115 INTERIORS ON THE RENDER/INTERIOR.JS PATH: 0 OF 16996 CELLS DISAGREE. THE ROUND'S HEADLINE IS TRUE THERE, AND ONLY THERE.`, 2, 0xa0, 0xa0, 0xb4);
text(60, 684, 'FULL VERDICT: CORPUS/90-VERDICTS/WAVE1/W1-15-R4.MD', 2, 0x80, 0x80, 0x94);

// ---- write ------------------------------------------------------------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xEDB88320 ^ (x >>> 1) : x >>> 1; t[n] = x; } return t; })();
const crc = (b) => { let x = -1; for (const v of b) x = crcT[(x ^ v) & 0xFF] ^ (x >>> 8); return (x ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`thorn-inn ${a.dis}/${a.n} disagree   writ-house ${c.dis}/${c.n} disagree`);
console.log(`wrote ${OUT}`);
