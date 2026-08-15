#!/usr/bin/env node
// t4-r7-inkbudget.mjs — where the ink actually IS inside a panel, and how unstable D2 is there.
//
// Owner: T4-r7. Two questions round 7 could not answer from arithmetic, both answered off the SAME
// pixels `RI-UIX09` DN4 is scored on, so nothing here is a second instrument competing with the
// first:
//
//   1. **THE INK BUDGET.** D2 is one number over a whole panel, so it cannot say whether a layout
//      change that adds 400 px of glyph and removes a 140x140 depiction is a gain or a loss. This
//      decomposes the SAME differ-from-mode mask `d2()` builds into per-element and per-band
//      contributions, so a layout decision can be costed BEFORE it is built. `ink_density` is the
//      number that matters: any region denser than the panel's own D2 raises it, anything sparser
//      lowers it, and empty ground is the cheapest way to fail this item.
//
//   2. **THE S61 BAND.** `ARBITRATION` S61: "when a screen's D2 sits within the measure's
//      demonstrated instability of the floor, the result is `unresolved`, and `unresolved` fails
//      closed... the band must be measured per screen and published with the score." The T4 r6
//      critic demonstrated 0.0108 of movement on a 0.06% image change, caused by the MODE moving
//      [42,55,43] -> [45,57,45]. `d2()` buckets colour at 5 bits/channel and takes the winning
//      bucket's mean as its reference, so the mechanism is a NEAR-TIE BETWEEN BUCKETS: any image
//      change larger than the gap between the leading bucket and its rivals can promote a rival and
//      move the reference colour. That is measurable directly and deterministically:
//
//        band_perturb — S61's method taken literally: dither +-1 LSB on a random `--perturb`
//                       fraction (default 0.0006 = the critic's own 0.06%) of the panel's pixels,
//                       across `--seeds` draws, and recompute D2 END TO END, mode re-derivation
//                       included. A change of one code value is below any display's threshold.
//        band_mode    — recompute D2 against every rival bucket that perturbation could PROMOTE
//                       (a rival within 2N counts of the leader). Zero here means the mode cannot
//                       flip, which is a finding and not an absence of one.
//        band_ref     — the mechanism the critic actually caught: D2 re-derives its reference per
//                       capture, and the sheet's moved [42,55,43] -> [45,57,45] = **dE00 0.843**
//                       (level-up's moved 1.905). So shift the reference by `--ref-de` (default
//                       1.905, the larger demonstrated shift) in six directions and take the
//                       spread. This is the only arm that models a shift ACROSS captures rather
//                       than within one, and it is normally the widest.
//        band_thresh  — sweep dE00 5.0 -> 7.0 around the item's own 6, the r6 critic's own probe.
//                       Kept for continuity with that verdict; it is a sensitivity, not a noise.
//        band         — the widest of the four, which is what S61's comparison must use.
//
// Neither band is an excuse: S61 makes the band FAIL-CLOSED, so a wide band makes a pass harder to
// earn, never easier.
//
// Usage:
//   node tools/ui/t4-r7-inkbudget.mjs --measure <dir with measure-*.json> --label before \
//        --screens container,levelup --out <dir>
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, log, ensureDir } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';
import { decodePNG } from './t4-r2-critic-measure.mjs';

const args = parseArgs();
const abs = (p, dflt) => (path.isAbsolute(String(p || '')) ? String(p) : path.resolve(REPO_ROOT, String(p || dflt)));
const MEASURE = abs(args.measure, 'corpus/90-verdicts/wave1/artifacts/T4-r7/before');
const OUT = abs(args.out, 'corpus/90-verdicts/wave1/artifacts/T4-r7/reports');
const LABEL = String(args.label || 'before');
const SCREENS = String(args.screens || 'container,levelup,container_no_name').split(',').filter(Boolean);
const PERTURB = Number(args.perturb || 0.0006);
const SEEDS = Number(args.seeds || 6);
const REF_DE = Number(args['ref-de'] || 1.905);
ensureDir(OUT);

/** Deterministic PRNG, so a published band is reproducible from the file that published it. */
function rng(seed) {
  let x = (seed | 0) || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) / 4294967296); };
}

const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/**
 * The differ-from-mode MASK, plus everything needed to re-reference it.
 *
 * Identical maths to `d2()` in `t4-r2-critic-measure.mjs` (bucket at 5 bits, mean of the winning
 * bucket, dE00 > 6) — verified equal to four decimals against that function's own output in
 * `agrees_with_d2` below, which is the check that stops this from being a second instrument
 * quietly disagreeing with the one the item is scored on.
 */
function inkMask(png, rect, thresh, opts) {
  const o = opts || {};
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  const W = x1 - x0, H = y1 - y0, N = W * H;
  // The rect is lifted into its own buffer first, so a dithered arm perturbs a COPY and every arm
  // walks the same compact array — otherwise the perturbation would have to be re-applied
  // identically in two passes and the two could drift.
  const px = new Uint8Array(N * 3);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4, j = ((y - y0) * W + (x - x0)) * 3;
    px[j] = png.data[i]; px[j + 1] = png.data[i + 1]; px[j + 2] = png.data[i + 2];
  }
  if (o.dither) {
    const rand = rng(o.dither.seed);
    const n = Math.round(o.dither.fraction * N);
    for (let k = 0; k < n; k++) {
      const j = Math.floor(rand() * N) * 3, ch = Math.floor(rand() * 3), d = rand() < 0.5 ? -1 : 1;
      px[j + ch] = Math.max(0, Math.min(255, px[j + ch] + d));
    }
  }
  const hist = new Map();
  for (let j = 0; j < N; j++) {
    const k = key(px[j * 3], px[j * 3 + 1], px[j * 3 + 2]);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const ranked = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  const bk = o.refBucket === undefined ? ranked[0][0] : o.refBucket;
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let j = 0; j < N; j++) {
    if (key(px[j * 3], px[j * 3 + 1], px[j * 3 + 2]) !== bk) continue;
    sr += px[j * 3]; sg += px[j * 3 + 1]; sb += px[j * 3 + 2]; sn++;
  }
  const mode = o.refMode || [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
  const modeLab = labFromSrgb255(...mode);
  const memo = new Map();
  const mask = new Uint8Array(N);
  let differ = 0;
  for (let j = 0; j < N; j++) {
    const k = key(px[j * 3], px[j * 3 + 1], px[j * 3 + 2]);
    let d = memo.get(k);
    if (d === undefined) { d = de2000(labFromSrgb255(px[j * 3], px[j * 3 + 1], px[j * 3 + 2]), modeLab); memo.set(k, d); }
    if (d > thresh) { mask[j] = 1; differ++; }
  }
  return { mask, x0, y0, W, H, mode, derived_mode: [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)], fill: differ / N, differ, total: N, ranked };
}

/**
 * Reference colours exactly `de` away from `mode` in each of six directions.
 *
 * The shift is found by bisection on a straight line in sRGB rather than by inverting CIEDE2000,
 * because dE00 is not a metric and the inverse is not unique — bisection just answers "how far
 * along this direction is dE00 == de", which is the question.
 */
function refShifts(mode, de) {
  const base = labFromSrgb255(...mode);
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const out = [];
  for (const dir of dirs) {
    let lo = 0, hi = 64;
    const at = (t) => mode.map((v, i) => Math.max(0, Math.min(255, Math.round(v + dir[i] * t))));
    if (de2000(labFromSrgb255(...at(hi)), base) < de) continue;   // channel clamped, direction dead
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (de2000(labFromSrgb255(...at(mid)), base) < de) lo = mid; else hi = mid;
    }
    const c = at(hi);
    out.push({ mode: c, dE: +de2000(labFromSrgb255(...c), base).toFixed(3) });
  }
  return out;
}

/** Ink inside an arbitrary rect, expressed against the panel mask. */
function inkIn(m, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const x0 = Math.max(m.x0, rx), y0 = Math.max(m.y0, ry);
  const x1 = Math.min(m.x0 + m.W, rx + rw), y1 = Math.min(m.y0 + m.H, ry + rh);
  if (x1 <= x0 || y1 <= y0) return { ink: 0, area: 0, density: null, clipped: true };
  let ink = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (m.mask[(y - m.y0) * m.W + (x - m.x0)]) ink++;
  const area = (x1 - x0) * (y1 - y0);
  return { ink, area, density: +(ink / area).toFixed(4) };
}

const manifestPath = fs.readdirSync(MEASURE).find((f) => /^measure-.*\.json$/.test(f));
if (!manifestPath) { log(`no measure-*.json in ${MEASURE}`); process.exit(2); }
const M = JSON.parse(fs.readFileSync(path.join(MEASURE, manifestPath), 'utf8'));

const out = {
  schema: 'elder-souls/t4-r7-inkbudget@1', at: new Date().toISOString(),
  measure_dir: path.relative(REPO_ROOT, MEASURE),
  // HAZARDS §22: an arm that cannot name the commit it ran is not evidence. Republished here so a
  // reader of THIS file does not have to go and open the manifest to know which tree it describes.
  commit: M.commit, label: M.label, perturb_fraction: PERTURB,
  screens: {},
};

for (const name of SCREENS) {
  const rec = (M.screens || {})[name];
  if (!rec || !rec.panel_rect) { out.screens[name] = { error: 'no panel rect in manifest' }; continue; }
  const p = path.join(MEASURE, 'screens', `${M.label}-${name}__1920x1080.png`);
  if (!fs.existsSync(p)) { out.screens[name] = { error: 'no capture at ' + p }; continue; }
  const png = decodePNG(fs.readFileSync(p));
  const rect = rec.panel_rect;
  const base = inkMask(png, rect, 6);

  // ---- 1. the ink budget ---------------------------------------------------------------------
  const els = (rec.elements || []).filter((e) => e.visible && e.rect);
  const perEl = els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect.map((v) => Math.round(v)), ...inkIn(base, e.rect) }))
    .filter((e) => e.area > 0)
    .sort((a, b) => b.ink - a.ink);
  const byKind = {};
  for (const e of perEl) {
    const k = byKind[e.kind] || (byKind[e.kind] = { n: 0, ink: 0, area: 0 });
    k.n++; k.ink += e.ink; k.area += e.area;
  }
  for (const k of Object.values(byKind)) k.density = +(k.ink / k.area).toFixed(4);

  // Horizontal bands, 20 px tall, so "which part of the panel is empty" is answerable without
  // knowing the element list — the question a layout change actually asks.
  const bands = [];
  for (let y = rect[1]; y < rect[1] + rect[3]; y += 20) {
    bands.push({ y: Math.round(y - rect[1]), ...inkIn(base, [rect[0], y, rect[2], Math.min(20, rect[1] + rect[3] - y)]) });
  }

  // ---- 2. the S61 band -----------------------------------------------------------------------
  // Which rival buckets could a perturbation of `PERTURB` of the panel's pixels promote? A change
  // of N pixels can move a rival ahead of the leader when (leader - rival) < 2N (N pixels leaving
  // the leader and arriving at the rival is the worst case).
  const N = Math.round(PERTURB * base.total);

  // (a) S61's method, literally: an imperceptible dither, recomputed end to end.
  const perturbArm = [{ seed: 'none', fill: +base.fill.toFixed(4), mode: base.mode }];
  for (let sd = 1; sd <= SEEDS; sd++) {
    const m = inkMask(png, rect, 6, { dither: { seed: sd * 7919, fraction: PERTURB } });
    perturbArm.push({ seed: sd * 7919, pixels_changed: N, fill: +m.fill.toFixed(4), mode: m.mode });
  }
  const pf = perturbArm.map((a) => a.fill);
  const bandPerturb = +(Math.max(...pf) - Math.min(...pf)).toFixed(4);

  // (b) can the perturbation promote a rival bucket at all?
  const leader = base.ranked[0][1];
  const rivals = base.ranked.filter(([, n], i) => i > 0 && (leader - n) < 2 * N).slice(0, 12);
  const modeArm = [{ bucket: base.ranked[0][0], count: leader, mode: base.mode, fill: +base.fill.toFixed(4), leader: true }];
  for (const [bk, n] of rivals) {
    const m = inkMask(png, rect, 6, { refBucket: bk });
    modeArm.push({ bucket: bk, count: n, mode: m.mode, fill: +m.fill.toFixed(4), dE_from_leader: +de2000(labFromSrgb255(...m.mode), labFromSrgb255(...base.mode)).toFixed(2) });
  }
  const modeFills = modeArm.map((a) => a.fill);
  const bandMode = +(Math.max(...modeFills) - Math.min(...modeFills)).toFixed(4);

  // (c) the cross-capture reference shift the r6 critic actually demonstrated.
  const refArm = [{ shift: 'none', mode: base.mode, dE: 0, fill: +base.fill.toFixed(4) }];
  for (const sh of refShifts(base.mode, REF_DE)) {
    const m = inkMask(png, rect, 6, { refMode: sh.mode });
    refArm.push({ shift: sh.mode.join(','), mode: sh.mode, dE: sh.dE, fill: +m.fill.toFixed(4) });
  }
  const rf = refArm.map((a) => a.fill);
  const bandRef = +(Math.max(...rf) - Math.min(...rf)).toFixed(4);

  // (d) the r6 critic's threshold sweep, kept for continuity with that verdict.
  const threshArm = [];
  for (const t of [5.0, 5.5, 6.0, 6.5, 7.0]) threshArm.push({ dE: t, fill: +inkMask(png, rect, t).fill.toFixed(4) });
  const threshFills = threshArm.map((a) => a.fill);
  const bandThresh = +(Math.max(...threshFills) - Math.min(...threshFills)).toFixed(4);

  const band = Math.max(bandPerturb, bandMode, bandRef, bandThresh);
  const d2 = +base.fill.toFixed(4);
  const FLOOR = 0.15;
  out.screens[name] = {
    panel_rect: rect, panel_area: base.total, d2, mode_rgb: base.mode,
    d2_manifest: rec.panel_fill ? rec.panel_fill.fill : null,
    agrees_with_d2: rec.panel_fill ? Math.abs(d2 - rec.panel_fill.fill) < 0.0002 : null,
    ink_pixels: base.differ,
    // S61's verdict for this screen, computed rather than asserted.
    s61: {
      floor: FLOOR, band,
      band_perturb: bandPerturb, band_mode: bandMode, band_ref: bandRef, band_thresh: bandThresh,
      band_from: bandPerturb === band ? 'perturb' : bandMode === band ? 'mode' : bandRef === band ? 'ref' : 'thresh',
      ref_shift_dE: REF_DE, rival_buckets_considered: rivals.length, perturb_pixels: N, perturb_seeds: SEEDS,
      margin: +(d2 - FLOOR).toFixed(4),
      // "fails on one capture, may never pass on one": below the floor is a FAIL outright; above
      // it by less than the band is UNRESOLVED, which S61 fails closed; above it by more is a pass.
      verdict: d2 < FLOOR ? 'fail' : (d2 - FLOOR) <= band ? 'unresolved (fails closed)' : 'pass',
      d2_needed_to_pass: +(FLOOR + band).toFixed(4),
      ink_needed_to_pass: Math.max(0, Math.ceil((FLOOR + band) * base.total) - base.differ),
    },
    perturb_arm: perturbArm, mode_arm: modeArm, ref_arm: refArm, thresh_arm: threshArm,
    ink_by_kind: byKind,
    ink_by_element: perEl.slice(0, 30),
    ink_by_band_20px: bands,
  };
  const s = out.screens[name];
  log(`[${name}] d2 ${d2}  band ${band} (perturb ${bandPerturb} / mode ${bandMode} / ref ${bandRef}`
    + ` / thresh ${bandThresh})  -> ${s.s61.verdict}`
    + `  needs ${s.s61.d2_needed_to_pass} = +${s.s61.ink_needed_to_pass} ink px`);
}

const dest = path.join(OUT, `t4-r7-inkbudget-${LABEL}.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
log(`wrote ${path.relative(REPO_ROOT, dest)}`);
