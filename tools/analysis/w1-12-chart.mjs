// THE PICTURE FOR W1-12: where an enemy stands, for sixty seconds, while you fight it.
//
// One line per arm, both against the same moving player, both 3,600 fixed frames. The vertical
// axis is `dist_m` — the single number RI-AI01 is built around — and the horizontal bands are
// that item's §C distance bands, drawn at this archetype's own reach.
//
// The control arm is what this build shipped before W1-12: `character/encounter.js::engageMember`,
// a straight-line walk to 2.30 m and then a swing every 78 frames. Against a STILL player that
// draws as a ramp and a flat, which is why the first version of this chart was captioned that
// way — and the caption was wrong, because the fixture here moves the player (RULE 8) and a
// beeline chasing a moving player oscillates too. What actually separates them is WHERE the
// oscillation happens: the control lives inside its own STRIKE band and is dragged out of it
// only by the player walking away, while the souls arm leaves and returns under its own power.
// The caption is computed from the two series rather than asserted.
//
// No browser, no engine, no renderer: this steps the shipping combat modules in bare Node
// through tools/lib/combat-node.mjs and plots the result. The PNG writer and the 5x7 font are
// lifted from tools/analysis/w1-13-r4-chart.mjs, which is where this project's chart code lives.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';

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
  '%': '10001000100100010001000', x: '00000101010001010100000',
};
function text(s, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch] || FONT[ch.toLowerCase()];
    if (bits) {
      for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
        if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
      }
    }
    cx += 6 * scale;
  }
  return cx;
}

// ---- the two runs -------------------------------------------------------------------------
const data = loadCombatData();
const stat = data._enemies[STAT];
const OMEGA = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
const ENGAGE = { advance_mps: 2.20, engage_range_m: 2.30 };
{
  const src = readFileSync(join(ROOT, 'game/src/character/encounter.js'), 'utf8');
  for (const k of Object.keys(ENGAGE)) ENGAGE[k] = Number(new RegExp(`${k}:\\s*([0-9.]+)`).exec(src)[1]);
}
// RULE 8. The player moves — the same path in both arms — because a still target hides every
// steering defect and a still PLAYER hides every enemy steering defect just as thoroughly.
const drive = (p, i) => { p.pos[0] = 2.6 * Math.sin(i / 140); p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1); };

function runSouls() {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', STAT, 0, 12, 180);
  const ctl = arena.cs.enemies.get('e1');
  const out = [];
  for (let i = 0; i < FRAMES; i++) {
    drive(arena.player, i);
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    out.push({ d: Math.hypot(arena.player.pos[0] - b.pos[0], arena.player.pos[2] - b.pos[2]), s: ctl.ai.state });
  }
  return out;
}
function runBeeline() {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', STAT, 0, 12, 180);
  const ctl = arena.cs.enemies.get('e1');
  ctl.ai = null;                       // the control is driven by the control
  const rot = ['chop', 'thrust', 'combo_a', 'combo_b'].filter((k) => b.moves[k]);
  let next = 0, swing = 0;
  const out = [];
  for (let i = 0; i < FRAMES; i++) {
    drive(arena.player, i);
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    const p = arena.player;
    const dx = p.pos[0] - b.pos[0], dz = p.pos[2] - b.pos[2];
    const dd = Math.hypot(dx, dz);
    if (!b.move) {
      if (dd > ENGAGE.engage_range_m) {
        const st = ENGAGE.advance_mps / 60;
        b.pos[0] += (dx / dd) * st; b.pos[2] += (dz / dd) * st;
      } else if (arena.frame >= next && rot.length) {
        const mv = b.moves[rot[(swing += 1) % rot.length]];
        if (!mv.stamina || b.stamina >= mv.stamina) {
          b.begin(mv, arena.frame, {});
          if (mv.stamina) b.spend(mv.stamina, arena.frame, arena.d);
          next = arena.frame + 78;
        }
      }
    }
    arena.step();
    out.push({ d: Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]), s: b.move ? 'COMMIT' : 'REPOSITION' });
  }
  return out;
}
const souls = runSouls();
const beeline = runBeeline();
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };

// ---- plot ----------------------------------------------------------------------------------
const X0 = 96, Y0 = 150, PW = W - X0 - 40, PH = 420;
const DMAX = 13;
const yOf = (d) => Y0 + PH - (Math.min(d, DMAX) / DMAX) * PH;
const xOf = (i) => X0 + (i / FRAMES) * PW;

let commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0;

text('W1-12   WHERE AN ENEMY STANDS WHILE YOU FIGHT IT', 30, 26, 0xf0, 0xe6, 0xc8, 3);
text(`ONE INFANTRY, 3,600 FIXED FRAMES, THE SAME MOVING PLAYER IN BOTH ARMS   REACH ${OMEGA} M   BARE NODE   COMMIT ${commit}   DIRTY=${dirty}`,
  30, 62, 0x8a, 0x92, 0x9c, 1);
text('RI-AI01 SECTION C DISTANCE BANDS, DRAWN AT THIS ARCHETYPE\'S OWN REACH', 30, 80, 0x8a, 0x92, 0x9c, 1);

// bands
const bands = [
  ['STRIKE', 0, 0.85 * OMEGA, 0x3a, 0x1e, 0x1e],
  ['POKE', 0.85 * OMEGA, 1.25 * OMEGA, 0x33, 0x2a, 0x18],
  ['DANCE', 1.25 * OMEGA, 2.2 * OMEGA, 0x1c, 0x2e, 0x24],
  ['CLOSE', 2.2 * OMEGA, 5.0 * OMEGA, 0x18, 0x22, 0x30],
  ['RUSH', 5.0 * OMEGA, DMAX, 0x20, 0x1c, 0x2c],
];
for (const [label, lo, hi, r, g, b] of bands) {
  const yTop = yOf(hi), yBot = yOf(lo);
  rect(X0, yTop, PW, Math.max(1, yBot - yTop), r, g, b);
  text(label, X0 + 6, yTop + 5, 0x70, 0x78, 0x82, 1);
  for (let x = X0; x < X0 + PW; x += 6) set(x, yBot, 0x40, 0x46, 0x50);
}
// axes
rect(X0, Y0, 2, PH, 0x50, 0x56, 0x60);
rect(X0, Y0 + PH, PW, 2, 0x50, 0x56, 0x60);
for (let d = 0; d <= DMAX; d += 2) {
  text(`${d}`, X0 - 26, yOf(d) - 3, 0x8a, 0x92, 0x9c, 1);
  rect(X0 - 6, yOf(d), 6, 1, 0x50, 0x56, 0x60);
}
text('DIST M', 26, Y0 - 22, 0x8a, 0x92, 0x9c, 1);
for (let s = 0; s <= 60; s += 10) {
  const x = X0 + (s / 60) * PW;
  rect(x, Y0 + PH, 1, 6, 0x50, 0x56, 0x60);
  text(`${s}S`, x - 8, Y0 + PH + 12, 0x8a, 0x92, 0x9c, 1);
}

const line = (series, r, g, b, thick) => {
  let px0 = null, py0 = null;
  for (let i = 0; i < series.length; i++) {
    const x = xOf(i), y = yOf(series[i].d);
    if (px0 !== null) {
      const steps = Math.max(1, Math.ceil(Math.abs(y - py0)));
      for (let t = 0; t <= steps; t++) {
        const xx = px0 + (x - px0) * (t / steps), yy = py0 + (y - py0) * (t / steps);
        for (let k = 0; k < thick; k++) set(xx, yy + k, r, g, b);
      }
    }
    px0 = x; py0 = y;
  }
};
line(beeline, 0xc8, 0x50, 0x48, 2);
line(souls, 0x62, 0xc8, 0x8c, 2);

// commit markers for the souls arm — where it actually swung
for (let i = 1; i < souls.length; i++) {
  if (souls[i].s === 'COMMIT' && souls[i - 1].s !== 'COMMIT') rect(xOf(i) - 1, Y0 + PH + 22, 3, 8, 0x62, 0xc8, 0x8c);
}
for (let i = 1; i < beeline.length; i++) {
  if (beeline[i].s === 'COMMIT' && beeline[i - 1].s !== 'COMMIT') rect(xOf(i) - 1, Y0 + PH + 34, 3, 8, 0xc8, 0x50, 0x48);
}
text('SWINGS', X0 - 62, Y0 + PH + 24, 0x8a, 0x92, 0x9c, 1);

// ---- legend and the two numbers ------------------------------------------------------------
const LY = Y0 + PH + 66;
rect(X0, LY + 4, 26, 3, 0xc8, 0x50, 0x48);
text(`BEFORE W1-12: WALK IN AT ${ENGAGE.advance_mps} M/S, STOP AT ${ENGAGE.engage_range_m} M, SWING EVERY 78 FRAMES FOREVER`, X0 + 36, LY, 0xc8, 0x50, 0x48, 2);
text(`SPACING VARIANCE ${sd(beeline.map((r) => r.d)).toFixed(2)} M   NO CIRCLE, NO FEINT, NO LEASH, NO ATTACK TOKEN`, X0 + 36, LY + 20, 0x9a, 0x62, 0x5c, 1);

rect(X0, LY + 48, 26, 3, 0x62, 0xc8, 0x8c);
text('AFTER W1-12: APPROACH, CIRCLE, STEP IN, COMMIT, BACK OFF, RE-SPACE', X0 + 36, LY + 44, 0x62, 0xc8, 0x8c, 2);
text(`SPACING VARIANCE ${sd(souls.map((r) => r.d)).toFixed(2)} M   RI-AI01 M3 WANTS 0.80 OR MORE, AND FAILS A BUILD BELOW 0.25`, X0 + 36, LY + 64, 0x52, 0x9a, 0x74, 1);

const inStrike = (a) => a.filter((r) => r.d <= 0.85 * OMEGA).length / a.length;
const reachedDance = (a) => {
  let n = 0, out = true;
  for (const r of a) {
    if (out && r.d <= 1.25 * OMEGA) out = false;
    else if (!out && r.d >= 1.25 * OMEGA) { n++; out = true; }
  }
  return n;
};
text(`RED SPENDS ${(inStrike(beeline) * 100).toFixed(0)}% OF THE FIGHT INSIDE ITS OWN STRIKE BAND AND LEAVES IT ${reachedDance(beeline)} TIMES.`,
  30, H - 44, 0xf0, 0xe6, 0xc8, 2);
text(`GREEN SPENDS ${(inStrike(souls) * 100).toFixed(0)}% THERE AND LEAVES IT ${reachedDance(souls)} TIMES. THAT GAP IS THE WHOLE PIECE.`,
  30, H - 24, 0xf0, 0xe6, 0xc8, 2);

const out = process.argv[2] || join(ROOT, 'docs/shots/2026-08-07-w1-12-where-an-enemy-stands-while-you-fight-it.png');
png(out);
console.log(`wrote ${out}`);
console.log(`beeline spacing_variance ${sd(beeline.map((r) => r.d)).toFixed(3)} m`);
console.log(`souls   spacing_variance ${sd(souls.map((r) => r.d)).toFixed(3)} m`);
