#!/usr/bin/env node
// t4-r3-density.mjs — RI-UIX09 DN4 (P4 panel fill), re-measured at round 3's own captures.
//
// Owner: crit-t4-r3. It imports `d2()` and `decodePNG()` from `t4-r2-critic-measure.mjs` — the
// round-2 critic's INDEPENDENT re-implementation of RI-UIX09 method 4 from the item's own sentence
// ("the modal colour of the panel rect, then the fraction of that rect's pixels at dE00 > 6 from
// it"), which agreed with the builder's instrument to four decimals on three screens. Reusing that
// function rather than writing a fourth is the point: the instrument question was settled in round
// 2 and re-opening it would make the before/after unreadable.
//
// What is NOT inherited is the NUMBER. Round 3 changed `screens/inventory.js` (a new detail line
// and a progress rule) and `screens/text.js` (a longer foot hint), both of which put ink inside a
// measured rect, so every figure here comes from a capture taken at THIS commit.
//
// CARE: importing `t4-r2-critic-measure.mjs` RUNS it (it is a script, not a library), and its own
// default `--out` is the round-2 critic's report directory. **Always pass `--out`** so its
// side-effect `critic-d2.json` — a byte-identical re-run of the round-2 D2 measurement over the
// round-2 captures, which is a useful control in its own right — lands here and does not overwrite
// round 2's artifact.
//
// Usage:
//   node tools/ui/t4-r2-measure.mjs --out corpus/90-verdicts/wave1/artifacts/T4-r3c/measure
//   node tools/ui/t4-r3-density.mjs --measure corpus/90-verdicts/wave1/artifacts/T4-r3c/measure \
//        --out corpus/90-verdicts/wave1/artifacts/T4-r3c/reports
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, log, ensureDir } from '../lib/cli.mjs';
import { decodePNG, d2 } from './t4-r2-critic-measure.mjs';

const args = parseArgs();
const MEASURE = path.join(REPO_ROOT, String(args.measure || 'corpus/90-verdicts/wave1/artifacts/T4-r3c/measure'));
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r3c/reports'));
ensureDir(OUT);

const livePath = path.join(MEASURE, 'measure-live-1920x1080.json');
if (!fs.existsSync(livePath)) { log(`no capture manifest at ${livePath}`); process.exit(2); }
const LIVE = JSON.parse(fs.readFileSync(livePath, 'utf8'));

// RI-UIX09 P4: the panel's fill must be >= 0.35; D2 < 0.15 is the item's HARD FAIL.
const FLOOR_HARD = 0.15, BAR = 0.35;
const out = {
  schema: 'elder-souls/t4-r3-density@1', at: new Date().toISOString(),
  measure_dir: path.relative(REPO_ROOT, MEASURE), bar: BAR, hard_fail_below: FLOOR_HARD,
  screens: {}, hard_fails: [],
};

for (const [name, rec] of Object.entries(LIVE.screens || {})) {
  const p = path.join(MEASURE, 'screens', `live-${name}__1920x1080.png`);
  if (!fs.existsSync(p)) { out.screens[name] = { error: 'no capture on disk', path: path.relative(REPO_ROOT, p) }; continue; }
  const rect = rec.panel_rect || (rec.ui && rec.ui.panel_rect) || null;
  const row = { capture: path.relative(REPO_ROOT, p), panel_rect: rect };
  if (rect) {
    const png = decodePNG(fs.readFileSync(p));
    // `d2()` returns {fill, mode_rgb, pixels, rect} — a bare object comparison against 0.15 is
    // always false, which is how a first pass of this file reported zero hard fails on four
    // screens that all hard-fail. Recorded in my status file.
    const m = d2(png, rect);
    row.d2_critic = m.fill;
    row.d2_detail = { mode_rgb: m.mode_rgb, pixels: m.pixels };
    row.d2_builder_same_run = rec.panel_fill ? rec.panel_fill.fill : null;
    row.agrees_with_builder_instrument = row.d2_builder_same_run !== null
      && Math.abs(row.d2_builder_same_run - row.d2_critic) < 0.0005;
    row.panel_fraction_of_frame = +((rect[2] * rect[3]) / (1920 * 1080)).toFixed(4);
    row.matter_px2 = Math.round(row.d2_critic * rect[2] * rect[3]);
    // S56's arithmetic, re-derived rather than quoted: at the matter this screen ALREADY draws,
    // how big may the panel be and still clear P4's 0.35?
    row.panel_px2_at_bar = Math.round(row.matter_px2 / BAR);
    row.frame_fraction_at_bar = +(row.panel_px2_at_bar / (1920 * 1080)).toFixed(4);
    row.hard_fail = row.d2_critic < FLOOR_HARD;
    row.meets_bar = row.d2_critic >= BAR;
    if (row.hard_fail) out.hard_fails.push(name);
  }
  out.screens[name] = row;
}
fs.writeFileSync(path.join(OUT, 't4-r3-density.json'), JSON.stringify(out, null, 2));
log(JSON.stringify(out, null, 2));
process.exit(out.hard_fails.length ? 1 : 0);
