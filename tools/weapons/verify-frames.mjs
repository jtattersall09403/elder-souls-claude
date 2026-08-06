#!/usr/bin/env node
// Re-derive RI-WPN04 §A's whole published contextual table from the SHIPPED roster and diff it
// cell by cell, plus RI-WPN02 §B's own R1/R2 rows and RI-CMB02 §B's R2 active/recovery split.
//
// RI-WPN04 §A: "Tolerance on every cell: ±0 frames. These are integer products of published
// multipliers and published base rows; a discrepancy is an arithmetic error or a lie, never a
// rounding difference." RI-WPN04 M6 hard-fails on any mismatch, so it is worth being able to run
// the check in two seconds rather than reading eighty-seven files.
//
// `build-movesets.mjs`'s header has claimed this tool exists since round 1. It does now.
//
// Usage: node tools/weapons/verify-frames.mjs [--json out.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

/** RI-WPN04 §A, transcribed verbatim from the item's REBASED table. startup / active / recovery. */
const WPN04A = {
  DGR: { 'r1.1': [12, 6, 24], 'roll.r1': [7, 6, 26], 'run.r1': [8, 6, 24], 'backstep.r1': [8, 6, 23], 'jump.r1': [16, 8, 29] },
  FST: { 'r1.1': [14, 4, 26], 'roll.r1': [8, 4, 29], 'run.r1': [10, 4, 26], 'backstep.r1': [9, 4, 25], 'jump.r1': [18, 5, 31] },
  CSW: { 'r1.1': [20, 10, 34], 'roll.r1': [12, 10, 37], 'run.r1': [14, 10, 34], 'backstep.r1': [13, 10, 32], 'jump.r1': [26, 13, 41] },
  TSW: { 'r1.1': [22, 8, 36], 'roll.r1': [13, 8, 40], 'run.r1': [15, 8, 36], 'backstep.r1': [14, 8, 34], 'jump.r1': [29, 10, 43] },
  SSW: { 'r1.1': [24, 10, 40], 'roll.r1': [14, 10, 44], 'run.r1': [17, 10, 40], 'backstep.r1': [16, 10, 38], 'jump.r1': [31, 13, 48] },
  SPR: { 'r1.1': [28, 8, 44], 'roll.r1': [17, 8, 48], 'run.r1': [20, 8, 44], 'backstep.r1': [18, 8, 42], 'jump.r1': [36, 10, 53] },
  AXE: { 'r1.1': [32, 12, 48], 'roll.r1': [19, 12, 53], 'run.r1': [22, 12, 48], 'backstep.r1': [21, 12, 46], 'jump.r1': [42, 15, 58] },
  MCE: { 'r1.1': [34, 12, 50], 'roll.r1': [20, 12, 55], 'run.r1': [24, 12, 50], 'backstep.r1': [22, 12, 48], 'jump.r1': [44, 15, 60] },
  HLB: { 'r1.1': [38, 14, 56], 'roll.r1': [23, 14, 62], 'run.r1': [27, 14, 56], 'backstep.r1': [25, 14, 53], 'jump.r1': [49, 18, 67] },
  WHP: { 'r1.1': [40, 10, 58], 'roll.r1': [24, 10, 64], 'run.r1': [28, 10, 58], 'backstep.r1': [26, 10, 55], 'jump.r1': [52, 13, 70] },
  GSW: { 'r1.1': [44, 16, 66], 'roll.r1': [26, 16, 73], 'run.r1': [31, 16, 66], 'backstep.r1': [29, 16, 63], 'jump.r1': [57, 20, 79] },
  CGS: { 'r1.1': [48, 18, 70], 'roll.r1': [29, 18, 77], 'run.r1': [34, 18, 70], 'backstep.r1': [31, 18, 67], 'jump.r1': [62, 23, 84] },
  GHM: { 'r1.1': [52, 16, 80], 'roll.r1': [31, 16, 88], 'run.r1': [36, 16, 80], 'backstep.r1': [34, 16, 76], 'jump.r1': [68, 20, 96] },
  UGS: { 'r1.1': [58, 20, 88], 'roll.r1': [35, 20, 97], 'run.r1': [41, 20, 88], 'backstep.r1': [38, 20, 84], 'jump.r1': [75, 25, 106] },
};

/** RI-WPN02 §B, the columns this tool can check: R1 startup / R1 total / R2 startup / R2 total / max chain. */
const WPN02B = {
  DGR: [12, 42, 28, 78, 4], FST: [14, 44, 32, 82, 5], CSW: [20, 64, 44, 114, 4],
  TSW: [22, 66, 46, 110, 3], SSW: [24, 74, 50, 122, 3], SPR: [28, 80, 54, 128, 3],
  AXE: [32, 92, 60, 146, 3], MCE: [34, 96, 64, 156, 3], HLB: [38, 108, 68, 168, 3],
  WHP: [40, 108, 60, 148, 3], GSW: [44, 126, 80, 196, 3], CGS: [48, 136, 88, 214, 2],
  GHM: [52, 148, 96, 232, 2], UGS: [58, 166, 104, 252, 3], BOW: [48, 92, 48, 236, 1],
};

const MOVEDIR = 'game/data/combat/movesets';
const baselines = {};
for (const f of fs.readdirSync(R(MOVEDIR))) {
  if (!f.endsWith('.json')) continue;
  const d = readJson(path.join(MOVEDIR, f));
  if (d.weapon_id && d.baseline_ref === null) baselines[d.class] = d;
}

const out = { wpn04a: { cells: 0, exact: 0, diffs: [] }, wpn02b: { cells: 0, exact: 0, diffs: [] }, cmb02b: { cells: 0, exact: 0, diffs: [] } };

for (const [cls, rows] of Object.entries(WPN04A)) {
  const ms = baselines[cls];
  for (const [slot, want] of Object.entries(rows)) {
    out.wpn04a.cells++;
    const s = ms && ms.slots[slot];
    const got = s ? [s.startup_f, s.active_f, s.recovery_f] : null;
    if (got && got.every((v, i) => v === want[i])) out.wpn04a.exact++;
    else out.wpn04a.diffs.push({ class: cls, slot, declared: got, published: want });
  }
}

const chainLen = (ms) => {
  let n = 0; let cur = 'r1.1'; const seen = new Set();
  while (ms.slots[cur] && !seen.has(cur)) { seen.add(cur); n++; cur = ms.slots[cur].chains_to; if (!cur) break; }
  return ms.slots['r1.1'] ? n : 1;
};
for (const [cls, [r1s, r1t, r2s, r2t, mc]] of Object.entries(WPN02B)) {
  const ms = baselines[cls];
  if (!ms) { out.wpn02b.diffs.push({ class: cls, error: 'no baseline weapon' }); continue; }
  const a = ms.slots['r1.1'] || ms.slots['bow.draw'];
  const b = ms.slots['r2'] || ms.slots['bow.aimed'];
  const rows = [
    ['R1 startup', a.startup_f, r1s],
    ['R1 total', a.startup_f + a.active_f + a.recovery_f, r1t],
    ['R2 startup', b.startup_f, r2s],
    ['R2 total', b.startup_f + b.active_f + b.recovery_f + (b.charge_max_f || 0), r2t],
    ['max chain', chainLen(ms), mc],
  ];
  for (const [name, got, want] of rows) {
    out.wpn02b.cells++;
    if (got === want) out.wpn02b.exact++;
    else out.wpn02b.diffs.push({ class: cls, cell: name, declared: got, published: want });
  }
}

// RI-CMB02 §B owns the R2 active/recovery split on the seven anchor classes (RI-WPN02 §B's own
// authority note). This is the check that would have caught round 1's 46-of-47 defect.
const FR = readJson('game/data/combat/frames.json');
const ANCHOR = { DGR: 'dagger', SSW: 'straight_sword', SPR: 'spear', AXE: 'axe', HLB: 'halberd', GSW: 'greatsword', UGS: 'ultra_greatsword' };
for (const [cls, key] of Object.entries(ANCHOR)) {
  const ms = baselines[cls];
  for (const [slot, row] of [['r1.1', FR.light[key]], ['r2', FR.heavy[key]]]) {
    const s = ms.slots[slot];
    for (const [f, want] of [['startup_f', row.startup], ['active_f', row.active], ['recovery_f', row.recovery]]) {
      out.cmb02b.cells++;
      if (s[f] === want) out.cmb02b.exact++;
      else out.cmb02b.diffs.push({ class: cls, slot, field: f, declared: s[f], authority: want });
    }
  }
}

const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx >= 0) fs.writeFileSync(R(process.argv[jsonIdx + 1]), JSON.stringify(out, null, 1) + '\n');

const line = (name, o) => console.log(`  ${name.padEnd(42)} ${String(o.exact).padStart(3)} / ${String(o.cells).padEnd(3)} exact${o.diffs.length ? '   <-- ' + o.diffs.length + ' MISMATCH' : ''}`);
console.log('=== W1-10 published-frame verification (tolerance +/-0 f@60) ===');
line('RI-WPN04 §A contextual table', out.wpn04a);
line('RI-WPN02 §B R1/R2/max-chain columns', out.wpn02b);
line('RI-CMB02 §B anchor split (authority)', out.cmb02b);
for (const o of [out.wpn04a, out.wpn02b, out.cmb02b]) for (const d of o.diffs) console.log('   !', JSON.stringify(d));
const bad = out.wpn04a.diffs.length + out.wpn02b.diffs.length + out.cmb02b.diffs.length;
if (bad && process.argv.includes('--gate')) process.exit(1);
