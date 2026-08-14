#!/usr/bin/env node
// W1-30C critic — read the diffuse-floor 2x2 out of the Deck arms and answer the plan's row.
//
//   node tools/critic/w1-30c/floor-analyse.mjs <deck-root>
//
// The plan's row: "removing the diffuse floor at visual-foundation.js does NOT collapse facades to
// charcoal in the 8 settlement street shots (mean luma stays >= 0.14)". Its null control: "keep the
// old textures and remove the floor; it must collapse".
//
// Arms, and why there are five rather than two: the settlement facades this row measures are
// floored TWICE — once in visual-foundation.js consumeStyleboard() and once again, per family, in
// world/province.js _settlementStyleboard(). Removing one while the other stands is RULES.md rule
// 6's fourth shape, two guards for one defect, and it would report a pass that means nothing.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from '../../node_modules/pngjs/lib/png.js';

const root = path.resolve(process.argv[2] || 'reports/w1-30/C-critic/gpu2/artifacts/deck');
const BAR = 0.14;

const ARMS = [
  ['A-shipping', 'both floors, authored textures — what ships today'],
  ['B-noCfloor', "C's floor removed; province.js's per-family floor still standing — the row as literally written"],
  ['C-noBothFloors', 'both floors removed, authored textures — the honest form of the row'],
  ['D-noFloorsOldTex', 'both floors removed, authored textures removed — the plan\'s null control; it must collapse'],
  ['E-oldTexFloorsIntact', 'authored textures removed, both floors standing — separates "the floor carried it" from "the textures did"'],
];

function lumaOf(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let s = 0, n = 0, dark = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const l = (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]) / 255;
    s += l; n++; if (l < 0.10) dark++;
  }
  return { luma: s / n, charcoalFrac: dark / n };
}

const out = { schema: 'elder-souls/w1-30c-floor@1', bar: BAR, arms: {}, streets: {}, verdict: {} };
for (const [arm, why] of ARMS) {
  const dir = path.join(root, arm, 'frames');
  if (!fs.existsSync(dir)) { out.arms[arm] = { why, error: 'arm not captured' }; continue; }
  const rows = {};
  for (const f of fs.readdirSync(dir).filter(f => /^street-/.test(f) && f.endsWith('.png'))) {
    const id = f.replace(/\.png$/, '').replace(/__.*$/, '');
    rows[id] = lumaOf(path.join(dir, f));
  }
  const vals = Object.values(rows).map(r => r.luma);
  out.arms[arm] = {
    why, shots: vals.length,
    min: vals.length ? +Math.min(...vals).toFixed(5) : null,
    mean: vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(5) : null,
    perShot: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, +v.luma.toFixed(5)])),
    charcoalFrac: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, +v.charcoalFrac.toFixed(4)])),
  };
}

const A = out.arms['A-shipping'], B = out.arms['B-noCfloor'], C = out.arms['C-noBothFloors'];
const D = out.arms['D-noFloorsOldTex'], E = out.arms['E-oldTexFloorsIntact'];
const g = a => (a && a.min != null) ? a.min : null;
out.verdict = {
  row_as_written_passes: g(B) != null ? g(B) >= BAR : null,
  row_honest_form_passes: g(C) != null ? g(C) >= BAR : null,
  null_control_collapses: (g(D) != null) ? g(D) < BAR : null,
  c_floor_alone_moves_the_number: (g(A) != null && g(B) != null) ? +(g(A) - g(B)).toFixed(5) : null,
  province_floor_moves_the_number: (g(B) != null && g(C) != null) ? +(g(B) - g(C)).toFixed(5) : null,
  authored_textures_move_the_number: (g(A) != null && g(E) != null) ? +(g(A) - g(E)).toFixed(5) : null,
};
const dest = path.join(path.dirname(root), 'floor-2x2.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
for (const [arm, why] of ARMS) {
  const a = out.arms[arm];
  if (!a || a.error) { console.log(`  ${arm.padEnd(22)} ${a?.error || 'missing'}`); continue; }
  console.log(`  ${arm.padEnd(22)} min ${String(a.min).padEnd(9)} mean ${String(a.mean).padEnd(9)} over ${a.shots} street shots  ${a.min >= BAR ? 'holds' : 'COLLAPSES'} against ${BAR}`);
}
console.log(`\n${JSON.stringify(out.verdict, null, 1)}\n-> ${dest}`);
