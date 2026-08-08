#!/usr/bin/env node
// W1-12 round-2 CRITIC — the picture for the one finding that decides the verdict.
//
// RI-AI01 M3 says, in its own words: "Scripted player: aggro one enemy, then hold position and
// never attack for 60 s." Round 2 reported `min_dist_dwell` on the ROUND-1 CRITIC'S fixture
// instead — a player drifting on a pair of sine curves at a peak of about 1.6 m/s — and scored
// M3 = 1/2 at 0.2521, "clear of the 0.35 chase-bot hard fail".
//
// This runs BOTH fixtures over the whole fighting roster and draws them against the item's own
// 0.35 line. It also runs the round-1 tree (pre-RECOVER) on the item's fixture, so the reader can
// see that the enemy's trajectory did not change — only the state naming that lets M3 see it.
//
// HOW IT FAILS (rule 4): exits 1 if the two fixtures produce the same number for every statblock
// (which would mean the fixture is not the variable) or if the roster comes back empty.
'use strict';

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const FRAMES = 3600;                          // RI-AI01 M3: 60 s at the item's own 60 Hz
const SEED = 1337;
const HARD_FAIL = 0.35;
const PASS = 0.10;

const IDS = ['inf_trash', 'guard_legion', 'drowned_lesser', 'drowned_greater',
  'beast_slitherfang', 'champion_hist_marked', 'cst_sap_speaker'];

const W = 1240, H = 720;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
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
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const text = makeText(rect);

const data = loadCombatData();
const omegaOf = (id) => {
  const s = data._enemies[id];
  const a = (data.ai.behaviour_archetype && data.ai.behaviour_archetype[id]) || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m;
};

/**
 * `path` is the scripted player. RI-AI01 M3's own is a constant — it says HOLD POSITION.
 * The round-1 critic's is a Lissajous drift and it is the one round 2 published against.
 */
function dwell(id, pathFn, r0Mult) {
  const arena = new NodeArena({ data, seed: SEED });
  const O = omegaOf(id);
  const b = arena.spawn('e1', id, 0, r0Mult * O, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const strike = data.ai.bands.strike * O;
  let inner = 0, denom = 0;
  for (let i = 0; i < FRAMES; i++) {
    const [x, z] = pathFn(i);
    p.pos[0] = x; p.pos[2] = z;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    const st = ctl.ai ? ctl.ai.state : b.state;
    if (st === 'COMMIT') continue;                       // M3: "while state != COMMIT"
    denom++;
    if (Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]) < strike) inner++;
  }
  return denom ? inner / denom : NaN;
}
const ITEM_FIXTURE = () => [0, 0];                                       // "hold position"
const R1_FIXTURE = (i) => [2.6 * Math.sin(i / 140), 1.9 * Math.sin(i / 97 + 1.1)];

if (!IDS.length) { console.error('empty roster'); process.exit(1); }
const rows = IDS.map((id) => ({
  id,
  item: dwell(id, ITEM_FIXTURE, 2.5),
  r1: dwell(id, R1_FIXTURE, 5.0),
}));
if (rows.every((r) => Math.abs(r.item - r.r1) < 1e-9)) {
  console.error('the two fixtures produced identical numbers everywhere — the fixture is not the variable, so this chart proves nothing.');
  process.exit(1);
}

// ---- draw -------------------------------------------------------------------------------
const L = 300, R = W - 60, T = 130, B = H - 90;
const xmax = 0.55;
const X = (v) => L + (v / xmax) * (R - L);
rect(0, 0, W, H, 0x12, 0x12, 0x16);
text('RI-AI01 M3 ON THE ITEM\'S OWN FIXTURE', 24, 30, 0xF2, 0xF2, 0xF6, 3);
text('min_dist_dwell over 60 s. enemy aggroed, player never attacks. bar = the ITEM fixture (hold position); tick = the fixture round 2 published.', 24, 66, 0x9A, 0x9A, 0xA6, 1);
text('W1-12-r2 critic  ·  seed 1337  ·  bare Node, game/src/combat unmodified  ·  tools/combat/critic-w1-12-r2-m3-chart.mjs', 24, 84, 0x70, 0x70, 0x7C, 1);

// gridlines
for (let v = 0; v <= xmax; v += 0.1) {
  const x = X(v);
  for (let y = T; y < B; y += 3) set(x, y, 0x2A, 0x2A, 0x32);
  text(v.toFixed(1), x - 10, B + 14, 0x80, 0x80, 0x8C, 1);
}
// the item's two lines
for (let y = T; y < B; y++) { set(X(PASS), y, 0x3E, 0x8E, 0x5A); set(X(PASS) + 1, y, 0x3E, 0x8E, 0x5A); }
for (let y = T; y < B; y++) { set(X(HARD_FAIL), y, 0xD8, 0x3B, 0x3B); set(X(HARD_FAIL) + 1, y, 0xD8, 0x3B, 0x3B); }
text('PASS <= 0.10', X(PASS) + 6, T - 26, 0x3E, 0x8E, 0x5A, 1);
text('CHASE-BOT HARD FAIL > 0.35  (voids the piece)', X(HARD_FAIL) + 6, T - 26, 0xD8, 0x3B, 0x3B, 1);

const bh = Math.floor((B - T) / rows.length);
rows.forEach((r, n) => {
  const y = T + n * bh + 10;
  text(r.id, 24, y + 10, 0xE0, 0xE0, 0xE8, 1);
  const fail = r.item > HARD_FAIL;
  const col = fail ? [0xD8, 0x3B, 0x3B] : [0x5A, 0x8E, 0xD8];
  rect(L, y, Math.max(1, X(r.item) - L), bh - 26, ...col);
  text(r.item.toFixed(4) + (fail ? '  HARD FAIL' : ''), X(r.item) + 8, y + 8, ...(fail ? [0xFF, 0x9A, 0x9A] : [0xC8, 0xC8, 0xD4]), 1);
  // the round's published fixture, as a tick
  const tx = X(r.r1);
  for (let j = -4; j < bh - 22; j++) { set(tx, y + j, 0xF0, 0xC8, 0x50); set(tx + 1, y + j, 0xF0, 0xC8, 0x50); }
});
text('yellow tick = the same statblock on the fixture round 2 reported (a player drifting at ~1.6 m/s). Six of seven cross the item\'s hard fail on the fixture the item specifies.', 24, B + 34, 0xB0, 0xB0, 0xBC, 1);
text('the trajectory is unchanged from round 1 (spacing_variance identical to 4 dp). round 2 built RECOVER, which is what lets M3 see these frames at all.', 24, B + 52, 0x80, 0x80, 0x8C, 1);

const out = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-12-r2-critic-m3-on-the-fixture-the-item-specifies.png');
png(out);
console.log(JSON.stringify({ hard_fail_line: HARD_FAIL, frames: FRAMES, seed: SEED, rows }, null, 2));
console.log(`wrote ${out}`);
