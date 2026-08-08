// W1-12 ROUND-1 CRITIC — the picture.
//
// One ordinary fight, one ordinary enemy, on the BUILDER'S OWN fixture and seed, for sixty
// seconds. The line is `dist_m`, the number RI-AI01 is built around. The band at the bottom is
// 0.85*omega — RI-AI01 §C's STRIKE band, the distance M3 calls "standing inside the player".
//
// The point of the picture is the shaded frames. They are the enemy's attack RECOVERY. RI-AI01
// §D T15 says an attack leaving `active` transitions COMMIT -> RECOVER, and M3 counts every
// frame "while `state != COMMIT`". This build has no RECOVER state — `combat/ai.js` never
// enters one — so the whole swing, recovery included, is labelled COMMIT and drops out of M3's
// denominator. Those are the frames in which the enemy has just spent 0.6-1.2 m of forward root
// motion and is standing on top of you.
//
// No browser and no engine: the shipping combat modules stepped in bare Node through
// tools/lib/combat-node.mjs. The PNG writer and the 5x7 font are the project's, lifted from
// tools/analysis/w1-12-chart.mjs which lifted them from tools/analysis/w1-13-r4-chart.mjs.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const STAT = 'inf_trash';
const FRAMES = 3600;

const W = 1240, H = 780;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b);
};
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const crcT = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })();
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
// The 5x5 chart font now comes from tools/lib/chart-font.mjs. It used to be a copy-pasted table
// of 23-character strings indexed as bits[j * 5 + i] — two characters short of the 25 the stride
// demands, so every row below each missing character was sheared one pixel left and both digits
// and letters rendered wrong. Do not paste a font back in here; see W1-CHARTFONT.
const text = makeText(rect);

// ---- one run, on the builder's own fixture -------------------------------------------------
const data = loadCombatData();
const stat = data._enemies[STAT];
const OMEGA = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
const STRIKE = data.ai.bands.strike * OMEGA;

const arena = new NodeArena({ data, seed: 1337 });
const b = arena.spawn('e1', STAT, 0, 5 * OMEGA, 180);
const ctl = arena.cs.enemies.get('e1');
const p = arena.player;
const rows = [];
for (let i = 0; i < FRAMES; i++) {
  // the builder's own fixture, copied exactly out of tools/harness/ai-probe.mjs
  p.pos[0] = 2.6 * Math.sin(i / 140); p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
  ctl.alert = 100; ctl.alertState = 'AGGRO';
  arena.step();
  const ph = !b.move ? 'none'
    : (b.animFrame <= b.move.startup ? 'windup'
      : (b.animFrame <= b.move.startup + b.move.active ? 'active' : 'recovery'));
  rows.push({ d: Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]), s: ctl.ai.state, ph });
}

const asBuilt = rows.filter((r) => r.s !== 'COMMIT');
const perItem = rows.filter((r) => !(r.s === 'COMMIT' && (r.ph === 'windup' || r.ph === 'active')));
const dwell = (a) => a.filter((r) => r.d < STRIKE).length / a.length;
const D_BUILT = dwell(asBuilt), D_ITEM = dwell(perItem);
const rec = rows.filter((r) => r.ph === 'recovery');

// ---- draw -----------------------------------------------------------------------------------
const X0 = 92, Y0 = 118, PW = W - X0 - 40, PH = 470;
const DMAX = 9.0;
const xOf = (i) => X0 + (i / (FRAMES - 1)) * PW;
const yOf = (d) => Y0 + PH - Math.min(1, d / DMAX) * PH;

rect(X0, Y0, PW, PH, 0x18, 0x1b, 0x20);
// the STRIKE band, filled
rect(X0, yOf(STRIKE), PW, Y0 + PH - yOf(STRIKE), 0x2c, 0x1c, 0x1c);
// recovery frames, shaded top to bottom
for (let i = 0; i < rows.length; i++) if (rows[i].ph === 'recovery') rect(xOf(i), Y0, 2, PH, 0x3a, 0x30, 0x18);
// gridlines
for (let d = 1; d <= 8; d++) { rect(X0, yOf(d), PW, 1, 0x24, 0x28, 0x2e); text(String(d), X0 - 22, yOf(d) - 3, 0x6a, 0x72, 0x7c, 1); }
rect(X0, yOf(STRIKE), PW, 1, 0xc8, 0x50, 0x48);
text(`0.85 OMEGA = ${STRIKE.toFixed(2)} M`, X0 + 6, yOf(STRIKE) + 6, 0xc8, 0x50, 0x48, 1);

let px0 = null;
for (let i = 0; i < rows.length; i++) {
  const x = xOf(i), y = yOf(rows[i].d);
  if (px0) { const [ax, ay] = px0; const n = Math.max(1, Math.hypot(x - ax, y - ay) | 0);
    for (let k = 0; k <= n; k++) rect(ax + (x - ax) * k / n, ay + (y - ay) * k / n, 2, 2, 0x62, 0xc8, 0x8c); }
  px0 = [x, y];
}

text('W1-12 CRITIC: THE FRAMES RI-AI01 M3 NEVER COUNTED', 30, 30, 0xf0, 0xe6, 0xc8, 3);
text(`ONE ${STAT.replace('_', ' ')}, 3600 FRAMES AT 60 HZ, THE BUILDERS OWN FIXTURE AND SEED. SHADED = ATTACK RECOVERY.`, 30, 62, 0x8a, 0x92, 0x9c, 1);
text(`RI-AI01 T15 SAYS AN ATTACK LEAVING ACTIVE BECOMES RECOVER. COMBAT/AI.JS HAS NO RECOVER STATE, SO THOSE ${rec.length} FRAMES ARE LABELLED COMMIT.`, 30, 78, 0x8a, 0x92, 0x9c, 1);

const LY = Y0 + PH + 34;
text(`MIN DIST DWELL AS THE PIECE SCORES IT: ${D_BUILT.toFixed(3)}   RI-AI01 M3 PASSES AT 0.10 OR LESS`, 30, LY, 0x62, 0xc8, 0x8c, 2);
text(`MIN DIST DWELL WITH RECOVER COUNTED:  ${D_ITEM.toFixed(3)}   SAME RUN, SAME SEED, M3 DROPS FROM 2 OF 2 TO 1 OF 2`, 30, LY + 24, 0xe0, 0xa0, 0x40, 2);
text(`${rec.filter((r) => r.d < STRIKE).length} OF THE ${rec.length} RECOVERY FRAMES SIT INSIDE 0.85 OMEGA.`, 30, LY + 56, 0xf0, 0xe6, 0xc8, 2);
text('THAT IS WHERE THE ENEMY ACTUALLY STANDS AFTER IT SWINGS.', 30, LY + 78, 0xf0, 0xe6, 0xc8, 2);

const out = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-12-critic-the-frames-m3-never-counted.png');
png(out);
console.log(`wrote ${out}`);
console.log(`as scored ${D_BUILT.toFixed(4)}  per RI-AI01 T15 ${D_ITEM.toFixed(4)}  recovery frames ${rec.length}, inside strike ${rec.filter((r) => r.d < STRIKE).length}`);
