#!/usr/bin/env node
// W1-12 ROUND 2 — the picture, and the delete-the-fix control, in one run.
//
// One legionary. One player, walking away in a straight line at the game's own 2.0 m/s, from
// 12 m. Two arms in the same process, same seed, same fixture, same everything except one leaf
// of `game/data/combat/ai.json`:
//
//   CONTROL   `movement.walk_in_min_closure_mps` set to -1000, which makes `_targetIsLeaving()`
//             always false and restores round 1's behaviour exactly: the sprint is gated on the
//             distance BAND alone.
//   ROUND 2   the shipped value.
//
// The line is the gap. The band at the bottom is 0.85·Ω — RI-AI01 §C's STRIKE band, the distance
// at which the enemy can hit you. The control never enters it. That is the README's sentence,
// drawn: "an enemy cannot catch you if you walk away."
//
// No browser and no engine: the shipping combat modules stepped in bare Node through
// tools/lib/combat-node.mjs. The PNG writer and the 5x7 font are the project's, from
// tools/lib/chart-font.mjs (do not paste a font back in here; see W1-CHARTFONT).
'use strict';

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const STAT = process.argv[3] || 'inf_trash';
const FRAMES = 1200;
const START_M = 12;
const PLAYER_WALK = 2.0;                    // game/src/sim/state.js PLAYER_CONST.walk_mps

const W = 1240, H = 780;
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

/** One arm. `ablate` restores round 1's band-only gate on a private copy of the data. */
function run(ablate) {
  const data = loadCombatData();
  if (ablate) data.ai.movement.walk_in_min_closure_mps = -1000;
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', STAT, 0, START_M, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const rows = [];
  for (let i = 0; i < FRAMES; i++) {
    p.pos[0] = 0; p.pos[2] = -(i / 60) * PLAYER_WALK;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    rows.push({ d: Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]), s: ctl.ai ? ctl.ai.state : b.state });
  }
  const data0 = loadCombatData();
  const stat = data0._enemies[STAT];
  const arch = (data0.ai.behaviour_archetype && data0.ai.behaviour_archetype[STAT]) || stat.archetype;
  const omega = stat.reach_m || data0.ai.archetype[arch].omega_m;
  return { rows, omega, strike: data0.ai.bands.strike * omega, arch };
}

const A = run(true);       // control — round 1's rule
const B = run(false);      // round 2
const STRIKE = B.strike;
const minA = Math.min(...A.rows.slice(30).map((r) => r.d));
const minB = Math.min(...B.rows.slice(30).map((r) => r.d));
const rushA = A.rows.filter((r) => r.s === 'RUSH').length;
const rushB = B.rows.filter((r) => r.s === 'RUSH').length;

// ---- draw -----------------------------------------------------------------------------------
const X0 = 92, Y0 = 132, PW = W - X0 - 40, PH = 440;
const DMAX = 26;
const xOf = (i) => X0 + (i / (FRAMES - 1)) * PW;
const yOf = (d) => Y0 + PH - Math.min(1, d / DMAX) * PH;

rect(X0, Y0, PW, PH, 0x18, 0x1b, 0x20);
rect(X0, yOf(STRIKE), PW, Y0 + PH - yOf(STRIKE), 0x2c, 0x1c, 0x1c);
for (let d = 4; d <= 24; d += 4) { rect(X0, yOf(d), PW, 1, 0x24, 0x28, 0x2e); text(`${d}`, X0 - 26, yOf(d) - 3, 0x6a, 0x72, 0x7c, 1); }
for (let f = 300; f < FRAMES; f += 300) { rect(xOf(f), Y0, 1, PH, 0x24, 0x28, 0x2e); text(`F${f}`, xOf(f) + 4, Y0 + PH + 8, 0x6a, 0x72, 0x7c, 1); }
rect(X0, yOf(STRIKE), PW, 1, 0xc8, 0x50, 0x48);
text(`STRIKE BAND 0.85 OMEGA = ${STRIKE.toFixed(2)} M  - INSIDE THIS LINE THE ENEMY CAN HIT YOU`, X0 + 6, yOf(STRIKE) + 7, 0xc8, 0x50, 0x48, 1);

function plot(rows, r, g, b) {
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const x = xOf(i), y = yOf(rows[i].d);
    if (prev) {
      const [ax, ay] = prev; const n = Math.max(1, Math.hypot(x - ax, y - ay) | 0);
      for (let k = 0; k <= n; k++) rect(ax + (x - ax) * k / n, ay + (y - ay) * k / n, 2, 2, r, g, b);
    }
    prev = [x, y];
  }
}
plot(A.rows, 0xd0, 0x60, 0x58);
plot(B.rows, 0x62, 0xc8, 0x8c);

text('AN ENEMY CATCHING A PLAYER WHO WALKS AWAY', 30, 26, 0xf0, 0xe6, 0xc8, 3);
text(`ONE ${STAT.replace(/_/g, ' ')} (BEHAVIOUR ARCHETYPE ${B.arch}). PLAYER WALKS AWAY IN A STRAIGHT LINE AT 2.0 M/S FROM ${START_M} M. ${FRAMES} FRAMES AT 60 HZ, SEED 1337.`, 30, 60, 0x8a, 0x92, 0x9c, 1);
text('BOTH ARMS ARE THE SAME TREE IN THE SAME PROCESS. THEY DIFFER BY ONE LEAF OF GAME/DATA/COMBAT/AI.JSON.', 30, 76, 0x8a, 0x92, 0x9c, 1);
text(`RED   ROUND 1 - SPRINT GATED ON DISTANCE. CLOSEST ${minA.toFixed(2)} M, RUSH ${rushA} F`, 30, 96, 0xd0, 0x60, 0x58, 2);
text(`GREEN ROUND 2 - SPRINT GATED ON WHETHER YOU LEAVE. CLOSEST ${minB.toFixed(2)} M, RUSH ${rushB} F`, 30, 114, 0x62, 0xc8, 0x8c, 2);

const LY = Y0 + PH + 40;
text('RED CRAWLS: THE ENEMY WALKS AT 2.20 AND YOU WALK AT 2.00, SO IT GAINS 0.20 M/S,', 30, LY, 0xf0, 0xe6, 0xc8, 2);
text('AND ITS SPRINT NEVER FIRES BECAUSE THE GAP NEVER GROWS PAST THE BAND EDGE.', 30, LY + 22, 0xf0, 0xe6, 0xc8, 2);
text('GREEN REACHES YOU IN FOUR SECONDS AND THEN FIGHTS FOR SIX.', 30, LY + 44, 0xf0, 0xe6, 0xc8, 2);
text('THE GREEN TAIL IS THE 32 M LEASH: IT CATCHES YOU, FIGHTS, AND STILL GOES HOME TO ITS POST.', 30, LY + 70, 0x8a, 0x92, 0x9c, 1);

const out = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-12-r2-an-enemy-catching-a-walking-player.png');
png(out);
console.log(`wrote ${out}`);
console.log(`control (round 1 rule): min gap ${minA.toFixed(3)} m, RUSH frames ${rushA}`);
console.log(`round 2               : min gap ${minB.toFixed(3)} m, RUSH frames ${rushB}   strike band ${STRIKE.toFixed(3)} m`);
if (!(minA > STRIKE && minB <= STRIKE)) {
  console.error('CONTROL PROBLEM: the two arms did not separate as expected. Either the ablation is inert or the fix is.');
  process.exit(1);
}
