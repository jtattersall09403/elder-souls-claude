#!/usr/bin/env node
// ui-metrics.mjs — RI-UIX06 §D (F17), §E (F18) and §F (F19). The UI FIDELITY half.
//
// RI-UIX06's own Provenance note lists this file under "Owed and non-existent", and says that
// until it exists the item is `unmeasurable ⇒ 0` on the FIDELITY side. Written by the W1-21
// builder; declared in orchestration/status/W1-21.json.
//
// THE ONE CHECK THE WHOLE ITEM TURNS ON is FD2: the 10%→90% luminance transition across a
// glyph stem, measured in DEVICE pixels, at deviceScaleFactor 2. "A UI drawn into a fixed-size
// canvas texture and blitted to the screen passes M-F17.1 at DPR 1 and fails catastrophically
// at DPR 2 — which is what every retina/4K player sees. It is invisible on a 1080p dev monitor."
//
// CC-7 IS NOT THIS TOOL'S BUSINESS AND IS ALSO ITS WHOLE POINT. This file measures and reports
// numbers. It contains no vocabulary for excusing them. If a stem transition is 4.1 px, the
// only thing that appears in the output is `4.1`, and the sentence "it's meant to look like old
// parchment" has nowhere to be written.
//
// HOW THE STEM TRANSITION IS MEASURED, since it is the load-bearing number:
//   * take a horizontal scanline through a region known to contain body text;
//   * find every ink↔page crossing: a run where luminance moves monotonically between a local
//     low and a local high separated by at least 40/255;
//   * for each crossing, count the pixels between the 10% and 90% points of that local range;
//   * report the MEDIAN over every crossing on every scanline in the region.
// A vector glyph rasterised at 1:1 gives ~1 px. A bitmap magnified 2× gives ~2-4 px. The 1.5 px
// threshold sits in the empty gap between those two populations, which is why RI-UIX06 says the
// number does not have to be exactly right to give the right answer.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';
import { grader, line, sampleTable, isPass } from '../lib/graded.mjs';
import { de2000, edgeDeviationDE } from '../lib/colour.mjs';

const USAGE = `
ui-metrics.mjs — RI-UIX06 §D/§E/§F. UI fidelity: glyph raster, scaling, compositing.

USAGE
  node tools/metrics/ui-metrics.mjs [--screens inventory,journal,book,levelup,sheet,spells,map]
                                    [--scales 1280x720,1920x1080] [--dpr 1,2]
                                    [--in <dir>] [--out <dir>] [--json] [--self-test]

  --in         re-read a capture this tool wrote instead of launching a browser
  --self-test  prove FD6's ΔE instrument can go red, with no browser: the CIEDE2000
               implementation against Sharma et al.'s published pairs, then a synthetic UI edge
               composited correctly (must read ~0 ΔE) and the same edge with a non-premultiplied
               dark halo (must read well over the item's hard-fail bar of 8)

EXIT 0 = FD1-FD8 all ran and passed · 1 = one or more failed · 2 = one or more could not be
         measured (EMPTY / PARTIAL — see tools/lib/graded.mjs)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-METRICS'));
// W1-21 round 2. `map` is here because the round-1 verdict counted the coverage of every AR-2 and
// fidelity detector this piece ships against the surface S35 defines entirely by its refusals, and
// the answer was five detectors, zero visits. The map is a screen; it gets measured like one.
const SCREENS = String(args.screens || 'inventory,journal,book,levelup,sheet,spells,map').split(',');

/**
 * Screens that legitimately carry no body prose, with the reason, checked by FD8.
 *
 * This is a DECLARATION and not an escape hatch, and the difference is that it is graded: FD8
 * fails on any opened screen that produced no stem sample and is not named here, and it also
 * fails on a name here that DID produce samples, so a declaration cannot outlive the layout that
 * justified it. The round-1 verdict caught the grader doing
 * `captures.filter(c => c.stem_transition_device_px !== null)` — silently dropping the screens it
 * could not see and then reporting `PASS … over N screens`. Two of six screens contributed
 * nothing to "the check the item says the whole thing turns on" and nothing said so.
 *
 * IT IS EMPTY, AND `map` IS THE ENTRY THAT WAS WITHDRAWN — W1-21 round 3.
 *
 * Round 2 wrote FD8 to catch a stale prose-free declaration, declared `map` prose-free on the
 * grounds that "its only text is a single place name under the stick", and did not run it. FD8
 * fired on that declaration the moment a critic ran it, and it was right to: the map screen draws
 * two `kind: 'hint'` elements carrying text — `map.hint`, 76 characters of control legend, and
 * `map.found`, a sentence — and it produced a stem sample in ALL FOUR capture configurations:
 *
 *     map 1280x720@1   306 samples      map 1280x720@2  1056 samples
 *     map 1920x1080@1  656 samples      map 1920x1080@2 2113 samples
 *
 * The declaration was a factual claim about the author's own screen and the claim was false, so
 * it is withdrawn rather than reworded. The map is measured like every other screen and its four
 * captures are in FD1/FD2's median. Nothing replaces it: a screen that genuinely carries no prose
 * would need a NEW declaration, written by somebody who has run this tool and seen the zero.
 */
const NO_PROSE = {};
const SCALES = String(args.scales || '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
const DPRS = String(args.dpr || '1,2').split(',').map(Number);

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }
function lum(png, x, y) {
  const o = (y * png.width + x) * 4;
  return 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
}

/** §D: the 10%→90% stem transition, in device pixels, over a text region. */
function stemTransitions(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const x0 = Math.max(1, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width - 1, rx + rw), y1 = Math.min(png.height, ry + rh);
  const widths = [];
  for (let y = y0; y < y1; y++) {
    let i = x0;
    while (i < x1 - 2) {
      const a = lum(png, i, y);
      // walk while monotone in one direction
      let j = i + 1, dir = 0;
      while (j < x1) {
        const d = lum(png, j, y) - lum(png, j - 1, y);
        if (Math.abs(d) < 0.5) break;
        const s = d > 0 ? 1 : -1;
        if (dir === 0) dir = s; else if (s !== dir) break;
        j++;
      }
      const b = lum(png, j - 1, y);
      const range = Math.abs(b - a);
      if (range >= 40 && j - i <= 12) {
        // The 10%->90% width in SUB-PIXELS, by linear interpolation between samples. Counting
        // whole samples returns 1 for a hard-aliased edge and 2 for a correctly antialiased
        // one, which inverts the metric: a build with NO antialiasing scores better than a
        // build with good antialiasing, and M-F17.5 explicitly wants AA present. Interpolating
        // gives ~0.8 px for a crisp vector edge, ~1.0 for a clean 1 px AA ramp, and 3-5 for an
        // upscaled bitmap, which is the separation the 1.5 px threshold was drawn across.
        const lo = Math.min(a, b) + range * 0.10, hi = Math.min(a, b) + range * 0.90;
        const cross = (t) => {
          for (let k = i; k < j; k++) {
            const v0 = lum(png, k, y), v1 = lum(png, k + 1, y);
            if ((v0 - t) * (v1 - t) <= 0 && v1 !== v0) return k + (t - v0) / (v1 - v0);
          }
          return null;
        };
        const c10 = cross(lo), c90 = cross(hi);
        if (c10 !== null && c90 !== null) widths.push(Math.abs(c90 - c10));
      }
      i = Math.max(i + 1, j);
    }
  }
  widths.sort((p, q) => p - q);
  const r2 = (v) => (v === null ? null : +v.toFixed(3));
  return {
    samples: widths.length,
    median: widths.length ? r2(widths[widths.length >> 1]) : null,
    p90: widths.length ? r2(widths[Math.min(widths.length - 1, Math.floor(widths.length * 0.9))]) : null,
  };
}

/** §F M-F19.3: effective bits per channel across the largest UI gradient. */
function effectiveBits(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const seen = [new Set(), new Set(), new Set()];
  for (let y = Math.max(0, ry); y < Math.min(png.height, ry + rh); y += 1) {
    for (let x = Math.max(0, rx); x < Math.min(png.width, rx + rw); x += 1) {
      const o = (y * png.width + x) * 4;
      seen[0].add(png.data[o]); seen[1].add(png.data[o + 1]); seen[2].add(png.data[o + 2]);
    }
  }
  return +Math.log2(Math.max(2, Math.max(seen[0].size, seen[1].size, seen[2].size))).toFixed(2);
}

/**
 * §F M-F19.1: alpha fringing — a dark or light halo at a UI edge over a known background.
 *
 * W1-21 ROUND 3 — MEASURED IN THE UNIT THE ITEM SPECIFIES.
 *
 * Round 2's version returned a **luminance overshoot in 0–255** and the grader compared it to
 * **40**. `RI-UIX06` §F M-F19.1 asks for "edge pixel **chroma** deviation ≤ 3 **ΔE**" and §Scoring
 * grades FD6 at "ΔE ≤3", hard fail "ΔE >8". The round-2 verdict is exact about the consequence:
 * "those are different quantities in different units, so neither the pass condition nor the
 * hard-fail condition in the item is currently being tested … nobody can say from this artifact
 * whether it is a ΔE of 3 or of 30 — which decides whether FD6 is a fail or a hard fail capping
 * the fidelity side at 2."
 *
 * So the deviation is now `tools/lib/colour.mjs`'s `edgeDeviationDE`: the ΔE2000 distance from the
 * observed edge pixel to the nearest point on the inside–outside segment in CIELAB. Zero for any
 * legal `a*ui + (1-a)*world` at any alpha; positive exactly when the composite left the line.
 * ΔE2000 rather than CIE76 because `BAR-CRITIQUE-IMAGES-01` fixes the project's convention as
 * "ΔE2000 in CIELAB D65".
 *
 * The old luma number is still computed and still reported as `worst_luma`, unchanged, so that
 * this round's figures can be compared with round 1's 114 and round 2's 99.9 rather than replacing
 * them with a number nobody can line up against the record.
 *
 * The DISTRIBUTION is returned, not just the worst pixel. The item's clause is per-pixel and the
 * grader honours that, but "one pixel in 300,000" and "every pixel" are different findings and the
 * artifact should be able to tell a verdict which one it has.
 */
function edgeFringe(uiOn, uiOff, rect) {
  // M-F19.1 is about the UI's SILHOUETTE against the world — "no dark or light halo at UI edges
  // over a mid-grey background", which is what non-premultiplied alpha produces. It is NOT about
  // the interior of the panel, where a glyph stem is legitimately much darker than both of its
  // neighbours: scanning the interior measures the typography and reports it as fringing, which
  // is what the first version of this function did (worst 156, all of it ink).
  //
  // So: sample only pixels that the UI changed AND that have an UNCHANGED neighbour — the
  // boundary between the UI layer and the world — and ask whether the composite there
  // overshoots past both sides. A correct blend is monotone across the boundary.
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const W = uiOn.width;
  const changedAt = (x, y) => {
    const o = (y * W + x) * 4;
    return Math.abs(uiOn.data[o] - uiOff.data[o]) + Math.abs(uiOn.data[o + 1] - uiOff.data[o + 1])
      + Math.abs(uiOn.data[o + 2] - uiOff.data[o + 2]) > 6;
  };
  const rgb = (png, x, y) => { const o = (y * png.width + x) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2]]; };
  let worst = 0, samples = 0, graded = 0;
  let worstDE = 0, worstDE76 = 0;
  const des = [];                       // every graded edge pixel's ΔE2000, for the distribution
  const x0 = Math.max(2, rx - 6), y0 = Math.max(2, ry - 6);
  const x1 = Math.min(W - 2, rx + rw + 6), y1 = Math.min(uiOn.height - 2, ry + rh + 6);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!changedAt(x, y)) continue;
      const onEdge = !changedAt(x - 1, y) || !changedAt(x + 1, y) || !changedAt(x, y - 1) || !changedAt(x, y + 1);
      if (!onEdge) continue;
      samples++;
      // Compare against a pixel well INSIDE the UI and one well OUTSIDE it, along the edge
      // normal, rather than against the immediate neighbours: at a torn, lashed, one-pixel-
      // ragged edge both immediate neighbours are frequently on the SAME side, and the test
      // then reports the edge's own material detail as a halo. A premultiplication error is a
      // pixel outside the range spanned by the two sides, by more than the antialiasing can
      // account for.
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let insideAt = null, outsideAt = null;
      for (const [dx, dy] of dirs) {
        const ix = x + dx * 4, iy = y + dy * 4;
        if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= uiOn.height - 1) continue;
        if (changedAt(ix, iy)) { if (insideAt === null) insideAt = [ix, iy]; }
        else if (outsideAt === null) outsideAt = [ix, iy];
      }
      if (insideAt === null || outsideAt === null) continue;
      graded++;

      // The item's unit: ΔE2000 off the inside–outside line in CIELAB.
      const dev = edgeDeviationDE(rgb(uiOn, x, y), rgb(uiOn, ...insideAt), rgb(uiOn, ...outsideAt));
      des.push(dev.de2000);
      if (dev.de2000 > worstDE) worstDE = dev.de2000;
      if (dev.de76 > worstDE76) worstDE76 = dev.de76;

      // Round 2's number, kept unchanged so the record stays comparable.
      const inside = lum(uiOn, insideAt[0], insideAt[1]), outside = lum(uiOn, outsideAt[0], outsideAt[1]);
      const l = lum(uiOn, x, y);
      const lo = Math.min(inside, outside), hi = Math.max(inside, outside);
      if (l < lo) worst = Math.max(worst, lo - l);
      else if (l > hi) worst = Math.max(worst, l - hi);
    }
  }
  des.sort((a, b) => a - b);
  const q = (p) => (des.length ? +des[Math.min(des.length - 1, Math.floor(des.length * p))].toFixed(3) : null);
  return {
    // `samples` is now the number of edge pixels that were actually GRADED — i.e. that had both an
    // inside and an outside reference. Round 2 counted every edge pixel it *found*, including the
    // ones it then `continue`d past, so `edge_fringe_samples` overstated the measurement.
    samples: graded,
    edge_pixels_found: samples,
    worst_de2000: +worstDE.toFixed(3),
    worst_de76: +worstDE76.toFixed(3),
    worst_luma: +worst.toFixed(1),
    de_p50: q(0.50), de_p99: q(0.99), de_p999: q(0.999),
    over_3: des.filter((d) => d > 3).length,
    over_8: des.filter((d) => d > 8).length,
  };
}

// ---- --self-test: CAN FD6 GO RED? ------------------------------------------------------------
//
// RULES 4. FD6 has been red for two rounds in a unit the item does not use; before anyone grades
// the new number, the instrument that produces it has to be shown failing on a defect it was
// built for and passing on a frame that has none. No browser: a synthetic UI edge over mid-grey,
// which is the background M-F19.1 names.
if (args['self-test']) {
  const fails = [];
  // 1. the ΔE2000 implementation itself, against Sharma, Wu & Dalal's published pairs.
  const SHARMA = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0000],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
    [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
    [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  ];
  let worstErr = 0;
  for (const [a, b, want] of SHARMA) worstErr = Math.max(worstErr, Math.abs(de2000(a, b) - want));
  if (worstErr > 2e-4) fails.push(`CIEDE2000 disagrees with Sharma et al. by ${worstErr}`);
  log(`  self-test: CIEDE2000 vs ${SHARMA.length} published pairs — worst error ${worstErr.toExponential(2)}`);

  // 2. a synthetic UI edge. Panel colour over mid-grey; one boundary column at alpha 0.75.
  const BG = [128, 128, 128], UI = [230, 225, 210], A = 0.75;
  const mk = (edgeColour) => {
    const p = new PNG({ width: 60, height: 60 });
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const o = (y * 60 + x) * 4;
        const c = x >= 30 ? UI : x === 29 ? edgeColour : BG;
        p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255;
      }
    }
    return p;
  };
  const off = mk(BG);
  for (let i = 0; i < 60 * 60; i++) { const o = i * 4; off.data[o] = BG[0]; off.data[o + 1] = BG[1]; off.data[o + 2] = BG[2]; off.data[o + 3] = 255; }
  const good = mk(UI.map((v, i) => Math.round(A * v + (1 - A) * BG[i])));          // a legal blend
  // The classic non-premultiplied artifact: the UI texture's transparent border texels carry
  // BLACK rgb, so the boundary composites to (1-a)*background and a dark halo appears between a
  // bright panel and its surroundings. It is darker than BOTH sides, which is what "overshoot"
  // means and what M-F19.1's "dark or light halo" names.
  const dark = mk(BG.map((v) => Math.round((1 - A) * v)));
  const light = mk(BG.map((v) => Math.min(255, Math.round(v + (255 - v) * 0.9))));
  const gRes = edgeFringe(good, off, [30, 0, 30, 60]);
  const bRes = edgeFringe(dark, off, [30, 0, 30, 60]);
  const lRes = edgeFringe(light, off, [30, 0, 30, 60]);
  log(`  self-test: correct composite   — ${gRes.samples} edge px, worst ΔE2000 ${gRes.worst_de2000} (round-2 luma unit ${gRes.worst_luma})`);
  log(`  self-test: dark halo           — ${bRes.samples} edge px, worst ΔE2000 ${bRes.worst_de2000} (round-2 luma unit ${bRes.worst_luma})`);
  log(`  self-test: light halo          — ${lRes.samples} edge px, worst ΔE2000 ${lRes.worst_de2000} (round-2 luma unit ${lRes.worst_luma})`);
  if (gRes.samples === 0 || bRes.samples === 0) fails.push('the fixture produced no graded edge pixels');
  if (!(gRes.worst_de2000 <= 3)) fails.push(`a CORRECT composite reads ΔE ${gRes.worst_de2000} — the instrument fires on nothing`);
  if (!(bRes.worst_de2000 > 8)) fails.push(`a DARK halo reads ΔE ${bRes.worst_de2000} — the instrument cannot see it`);
  // The light halo is asserted against the PASS bar rather than the hard-fail bar, and the
  // difference is real rather than a softened test: this fixture's panel is already a near-white
  // parchment, so a white halo sits only ~10 L* above it and is genuinely a smaller error than a
  // black one. What has to be true is that the instrument sees it at all, in the direction the
  // item cares about — "no dark **or light** halo".
  if (!(lRes.worst_de2000 > 3)) fails.push(`a LIGHT halo reads ΔE ${lRes.worst_de2000} — the instrument cannot see it`);
  // 3. and the grader must refuse to grade an empty sample set rather than passing it.
  const empty = edgeFringe(off, off, [30, 0, 30, 60]);
  const g = grader();
  g.push('FD6', 'M-F19.1 no alpha fringing at UI edges', {
    samples: empty.samples, sample_of: 'graded edge pixels', pass: () => empty.worst_de2000 <= 3,
  });
  log(`  self-test: zero-sample FD6 -> ${g.checks[0].status}`);
  if (g.checks[0].status !== 'EMPTY') fails.push(`FD6 on zero samples reports ${g.checks[0].status}, not EMPTY`);

  for (const f of fails) log(`  FAIL ${f}`);
  log(fails.length ? `self-test: ${fails.length} failure(s)` : 'self-test: FD6 fires on a halo, is silent on a legal blend, and reports EMPTY on nothing');
  process.exit(fails.length ? 1 : 0);
}

if (args.in) {
  const cap = JSON.parse(fs.readFileSync(path.join(String(args.in), 'ui-metrics.json'), 'utf8'));
  emit(cap);
  // Re-reading an artifact must reproduce the same verdict, EMPTY included — an older artifact
  // whose checks carry no `status` is itself unmeasured, and says so rather than exiting 0.
  const { exitCode } = await import('../lib/graded.mjs');
  process.exit(exitCode((cap.checks || []).map((c) => ({ ...c, status: c.status || (c.pass ? 'PASS' : 'FAIL') }))));
}

ensureDir(RUN);
const out = {
  schema: 'elder-souls/ui-metrics@1', item: 'RI-UIX06', side: 'FIDELITY',
  properties: ['F17', 'F18', 'F19'],
  at: new Date().toISOString(),
  captures: [], checks: [],
};

for (const [w, hpx] of SCALES) {
  for (const dpr of DPRS) {
    const h = await launchGame({ width: w, height: hpx, timeout: 240000 });
    try {
      await h.h('setRenderRate', 60);
      await h.h('loadState', 'ui-journal');
      await h.h('setAtHearth', true);
      await h.h('stepFrames', 2);
      const buf = await h.h('setDevicePixelRatio', dpr);
      for (const screen of SCREENS) {
        if (screen === 'book') await h.h('openMenu', 'book', { id: 'pilots-chart-book' });
        else await h.h('openMenu', screen);
        await h.h('stepFrames', 1);
        const ui = await h.h('getUIState');
        const on = decode(await h.h('screenshot'));
        await h.h('setUIVisible', false);
        const off = decode(await h.h('screenshot'));
        await h.h('setUIVisible', true);

        // The biggest text-bearing element on the screen, WHATEVER KIND IT IS.
        //
        // This used to be `.includes(e.kind)` over a hard-coded whitelist of four element kinds —
        // `book_page`, `journal_entry`, `detail_panel`, `attribute_preview`. The skills sheet
        // draws as `sheet_row` and `attribute_row`, neither of which is on that list, so `sheet`
        // and `spells` returned `stem null px (0 samples)` in every configuration and the grader
        // filtered them out before reporting a pass. It is the same shape as the map's
        // `mutator_arities` literal and it is worth naming rather than just fixing: a check
        // assembled from a list can only ever look at the things whoever wrote the list already
        // thought of, so this one is written to look at everything and then say what it found.
        //
        // The ≥40-character preference survives as a PREFERENCE and not a filter: body prose is
        // the better sample, but a screen made of short rows is still made of glyphs, and a glyph
        // is what the stem transition measures. Whichever region is used is reported.
        const withText = ui.elements.filter((e) => e.visible && e.text
          && String(e.text).trim().length >= 3 && e.rect[2] > 8 && e.rect[3] > 6);
        const byArea = (a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3];
        const prose = withText.filter((e) => String(e.text).length > 40).sort(byArea);
        const region = prose[0] || withText.slice().sort(byArea)[0];
        const panel = ui.elements.find((e) => e.kind === 'panel');
        const stem = region ? stemTransitions(on, region.rect) : { samples: 0, median: null, p90: null };
        const bits = panel ? effectiveBits(on, panel.rect) : null;
        const fringe = panel ? edgeFringe(on, off, panel.rect) : null;

        // §E: clipping, overlap, overflow, and screen-fraction stability.
        const clipped = ui.elements.filter((e) => e.visible && e.rect[0] < -1 || (e.visible && e.rect[0] + e.rect[2] > ui.screen.w + 1)
          || (e.visible && e.rect[1] < -1) || (e.visible && e.rect[1] + e.rect[3] > ui.screen.h + 1)).map((e) => e.id);
        const dir = path.join(RUN, `${w}x${hpx}@${dpr}`, screen);
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, 'ui.png'), PNG.sync.write(on));

        out.captures.push({
          screen, css: [w, hpx], dpr, buffer: buf.buffer,
          image: [on.width, on.height],
          text_render_path: ui.textRenderPath,
          text_raster_scale: ui.text_raster_scale,
          glyph_source: ui.text_glyph_source,
          fonts: ui.fonts,
          body_px: ui.fonts && ui.fonts[0] ? ui.fonts[0].size_px : null,
          stem_transition_device_px: stem.median,
          stem_p90: stem.p90, stem_samples: stem.samples,
          // What was measured, so a null is diagnosable from the artifact instead of by rerunning.
          region_kind: region ? region.kind : null,
          region_id: region ? region.id : null,
          region_text_len: region ? String(region.text).length : 0,
          region_is_prose: !!(region && String(region.text).length > 40),
          text_bearing_elements: withText.length,
          text_kinds_present: [...new Set(withText.map((e) => e.kind))].sort(),
          panel_area_frac: panel ? +((panel.rect[2] * panel.rect[3]) / (on.width * on.height)).toFixed(4) : null,
          gradient_bits: bits,
          // W1-21 round 3. FD6 in the item's own unit, with the round-2 luma figure kept beside it
          // so the two rounds line up. `edge_fringe` stays the luma number under its old name.
          edge_fringe: fringe ? fringe.worst_luma : null,
          edge_fringe_de2000: fringe ? fringe.worst_de2000 : null,
          edge_fringe_de76: fringe ? fringe.worst_de76 : null,
          edge_fringe_de_p50: fringe ? fringe.de_p50 : null,
          edge_fringe_de_p99: fringe ? fringe.de_p99 : null,
          edge_fringe_de_p999: fringe ? fringe.de_p999 : null,
          edge_fringe_over_3: fringe ? fringe.over_3 : 0,
          edge_fringe_over_8: fringe ? fringe.over_8 : 0,
          edge_fringe_samples: fringe ? fringe.samples : 0,
          // W1-21 round 3. FD4's sample count. The round-2 verdict: "FD4 — 28 captures — no
          // per-capture element count — PASS on zero samples, `every(c => clipped.length === 0)`".
          // A capture that declared no elements cannot have a clipped one, and said PASS.
          elements_declared: ui.elements.length,
          elements_visible: ui.elements.filter((e) => e.visible).length,
          overdraw: ui.overdraw,
          clipped_elements: clipped,
          artifact: dir,
        });
        log(`  ${screen} ${w}x${hpx}@${dpr}: buffer ${buf.buffer.join('x')} image ${on.width}x${on.height} stem ${stem.median} px (${stem.samples} samples, region ${region ? region.kind : 'NONE'}), ${ui.elements.filter((e) => e.visible).length} visible elements, edge ΔE2000 ${fringe ? fringe.worst_de2000 : 'n/a'} over ${fringe ? fringe.samples : 0} edge px`);
      }
    } finally {
      await h.close();
    }
  }
}

// ---- grading ---------------------------------------------------------------------------------
const at = (dpr) => out.captures.filter((c) => c.dpr === dpr && c.stem_transition_device_px !== null);
const med = (xs) => { const a = xs.slice().sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; };
const d1 = med(at(1).map((c) => c.stem_transition_device_px));
const d2 = med(at(2).map((c) => c.stem_transition_device_px));

// W1-21 ROUND 3 — EVERY CHECK CARRIES ITS SAMPLE COUNT AND NONE OF THEM CAN PASS ON ZERO.
//
// `tools/lib/graded.mjs` refuses to evaluate a predicate over an empty sample set: the check comes
// back `EMPTY` and the run exits 2. Three of this file's checks passed on absence BY CONSTRUCTION
// and each is named at its own call site below.
const G = grader();
const push = (id, what, spec) => G.push(id, what, spec);

// FD1/FD2 still take the median over the screens that produced samples — a median of nothing is
// not a number — but WHICH screens those are is now itself graded, by FD8, and both details name
// the screens instead of just counting them. The round-1 verdict's objection was never the
// median; it was that "PASS … over N screens" did not say which N, or that there had been six.
const seen = (dpr) => [...new Set(at(dpr).map((c) => c.screen))].sort();
const opened = [...new Set(out.captures.map((c) => c.screen))].sort();
// `expected` is the number of captures at that DPR that are NOT declared prose-free, so a
// median taken over fewer captures than there were screens comes back PARTIAL rather than PASS.
const expectedAt = (dpr) => out.captures.filter((c) => c.dpr === dpr && !NO_PROSE[c.screen]).length;
push('FD1', 'M-F17.1 glyph stem transition at DPR 1 ≤ 1.5 device px', {
  samples: at(1).length, expected: expectedAt(1), sample_of: 'captures with a stem sample',
  counts: { stem_widths: at(1).reduce((a, c) => a + c.stem_samples, 0) },
  pass: () => d1 !== null && d1 <= 1.5,
  detail: `median ${d1} px over [${seen(1).join(',')}] of [${opened.join(',')}], ${at(1).reduce((a, c) => a + c.stem_samples, 0)} stem crossings`,
});
push('FD2', 'M-F17.2 glyph stem transition at DPR 2 ≤ 1.5 device px (the upscaled-canvas signature)', {
  samples: at(2).length, expected: expectedAt(2), sample_of: 'captures with a stem sample',
  counts: { stem_widths: at(2).reduce((a, c) => a + c.stem_samples, 0) },
  pass: () => d2 !== null && d2 <= 1.5,
  detail: `median ${d2} px over [${seen(2).join(',')}] of [${opened.join(',')}], ${at(2).reduce((a, c) => a + c.stem_samples, 0)} stem crossings`,
});
// B4/M-F17.4 is a DUAL requirement: >=18 CSS px at 1080p AND >=1.6% of screen height at every
// resolution. Testing >=18 px at 720p would fail a layout that is correctly proportional, which
// is the opposite of what the row asks for, so the absolute leg is applied at >=1080 and the
// fractional leg everywhere.
push('FD3', 'M-F17.3-5 text path 1:1 (no upscale), size >=18 px @1080p and >=1.6% of screen height everywhere', {
  samples: out.captures.filter((c) => c.body_px !== null).length, expected: out.captures.length,
  sample_of: 'captures reporting a body size',
  pass: () => out.captures.every((c) => c.text_raster_scale === 1)
    && out.captures.every((c) => (c.body_px / c.css[1]) >= 0.016)
    && out.captures.filter((c) => c.css[1] >= 1080).every((c) => c.body_px >= 18),
  detail: `path ${out.captures[0] && out.captures[0].text_render_path}, raster scale ${[...new Set(out.captures.map((c) => c.text_raster_scale))].join('/')}, body ${[...new Set(out.captures.map((c) => c.body_px))].join('/')} px, screen fraction ${[...new Set(out.captures.map((c) => +(c.body_px / c.css[1]).toFixed(4)))].join('/')}, source ${out.captures[0] && out.captures[0].glyph_source}`,
});
// FD4's sample is an ELEMENT, not a capture. `every(c => c.clipped_elements.length === 0)` is
// true over 28 captures that each declared nothing, and round 2 recorded no per-capture element
// count, so an all-empty run was indistinguishable from a clean one.
const elementsSeen = out.captures.reduce((a, c) => a + (c.elements_visible || 0), 0);
push('FD4', 'M-F18.1-3 no clipping, no overflow at any capture configuration', {
  samples: elementsSeen, sample_of: 'visible elements across all captures',
  counts: { captures: out.captures.length, per_capture: out.captures.map((c) => [c.screen, c.css.join('x') + '@' + c.dpr, c.elements_visible]) },
  pass: () => out.captures.every((c) => c.clipped_elements.length === 0)
    && out.captures.every((c) => c.elements_visible > 0),
  detail: `${elementsSeen} visible elements over ${out.captures.length} captures; clipped ${JSON.stringify(out.captures.filter((c) => c.clipped_elements.length).map((c) => [c.screen, c.css, c.dpr, c.clipped_elements]))}`,
});
const fracs = out.captures.filter((c) => c.panel_area_frac !== null).map((c) => c.panel_area_frac);
const drift = fracs.length ? (Math.max(...fracs) - Math.min(...fracs)) / (fracs.reduce((a, b) => a + b, 0) / fracs.length) : 1;
push('FD5', 'M-F18.4 screen-fraction stability across resolutions and DPRs ≤ ±10%', {
  samples: fracs.length, expected: out.captures.length, sample_of: 'panel area fractions',
  pass: () => drift <= 0.10,
  detail: `panel area fraction range ${Math.min(...fracs)}..${Math.max(...fracs)}, drift ${(drift * 100).toFixed(2)}%`,
});

// FD6 — W1-21 ROUND 3, IN THE ITEM'S OWN UNIT, AND WITH THE ZERO-SAMPLE HOLE CLOSED.
//
// Two defects, both named by the round-2 verdict, both fixed here:
//
//  1. THE UNIT. The threshold was 40 on a 0–255 luminance overshoot. `RI-UIX06` §Scoring gives
//     FD6 as "no fringing; **ΔE ≤3**" with a hard fail at "**ΔE >8**", and §F M-F19.1 as "edge
//     pixel chroma deviation ≤ 3 ΔE". Now measured as ΔE2000 (the corpus's own convention) off
//     the inside–outside line in CIELAB. The hard-fail bar is evaluated and REPORTED, because it
//     is the difference between a fail and a cap on the fidelity side at 2, and no verdict has
//     been able to say which.
//  2. THE EMPTY PASS. `edgeFringe()` returned `{worst: 0}` on zero edge pixels and `0 <= 40`
//     passed. The sample count is now the check's, and zero edge pixels is EMPTY.
const fringeSamples = out.captures.reduce((a, c) => a + (c.edge_fringe_samples || 0), 0);
const worstDE = Math.max(...out.captures.map((c) => (c.edge_fringe_de2000 === null ? 0 : c.edge_fringe_de2000)));
const capturesOver3 = out.captures.filter((c) => c.edge_fringe_de2000 !== null && c.edge_fringe_de2000 > 3).length;
const capturesOver8 = out.captures.filter((c) => c.edge_fringe_de2000 !== null && c.edge_fringe_de2000 > 8).length;
const pxOver3 = out.captures.reduce((a, c) => a + (c.edge_fringe_over_3 || 0), 0);
const pxOver8 = out.captures.reduce((a, c) => a + (c.edge_fringe_over_8 || 0), 0);
out.fd6 = {
  unit: 'ΔE2000, CIELAB D65 (BAR-CRITIQUE-IMAGES-01 §; RI-UIX06 §F M-F19.1)',
  pass_bar: 3, hard_fail_bar: 8,
  worst_de2000: +worstDE.toFixed(3),
  worst_luma_round2_unit: Math.max(...out.captures.map((c) => c.edge_fringe || 0)),
  edge_pixels_graded: fringeSamples,
  captures_over_3: capturesOver3, captures_over_8: capturesOver8, captures: out.captures.length,
  edge_pixels_over_3: pxOver3, edge_pixels_over_8: pxOver8,
  frac_edge_pixels_over_3: fringeSamples ? +(pxOver3 / fringeSamples).toFixed(5) : null,
  hard_fail: worstDE > 8,
};
push('FD6', 'M-F19.1 no alpha fringing at UI edges — edge pixel chroma deviation ≤ 3 ΔE2000 (hard fail > 8)', {
  samples: fringeSamples, sample_of: 'graded edge pixels',
  counts: { captures: out.captures.length, over_3: pxOver3, over_8: pxOver8 },
  pass: () => out.captures.every((c) => c.edge_fringe_de2000 !== null && c.edge_fringe_de2000 <= 3),
  detail: `worst ΔE2000 ${+worstDE.toFixed(3)} (round-2 luma unit: ${out.fd6.worst_luma_round2_unit}); `
    + `${capturesOver3}/${out.captures.length} captures over 3, ${capturesOver8} over 8; `
    + `${pxOver3} of ${fringeSamples} edge pixels over 3, ${pxOver8} over 8; `
    + `HARD FAIL ${worstDE > 8 ? 'YES — RI-UIX06 §Scoring caps FIDELITY at 2' : 'no'}`,
});
// FD7 — the `gradient_bits === null ||` is gone. A capture with no panel measured no gradient;
// that is a missing sample, not a pass. `expected` makes an incomplete run PARTIAL.
const bitsCaps = out.captures.filter((c) => c.gradient_bits !== null);
push('FD7', 'M-F19.3-4 ≥7 effective bits on the largest gradient, overdraw ≤ 3×', {
  samples: bitsCaps.length, expected: out.captures.length, sample_of: 'captures with a measured panel gradient',
  counts: { overdraw_samples: out.captures.filter((c) => typeof c.overdraw === 'number').length },
  pass: () => bitsCaps.every((c) => c.gradient_bits >= 7) && out.captures.every((c) => c.overdraw <= 3),
  detail: `bits ${bitsCaps.length ? Math.min(...bitsCaps.map((c) => c.gradient_bits)) : 'n/a'}, max overdraw ${Math.max(...out.captures.map((c) => c.overdraw))}, ${out.captures.length - bitsCaps.length} captures with no panel`,
});

// FD8 — W1-21 round 2. THE CHECK THAT THE OTHER CHECKS WERE MEASURED ON ANYTHING.
//
// Every screen this tool opens must produce a stem sample in every configuration, or be named in
// `NO_PROSE` with a reason. It fails in both directions: an unmeasured screen with no declaration
// is a hole, and a declaration for a screen that DID measure is a stale excuse. This is the check
// that would have gone red for `sheet` and `spells` at 07f8b75, where the tool reported a pass.
const unmeasured = [...new Set(out.captures.filter((c) => c.stem_transition_device_px === null)
  .map((c) => c.screen))].sort();
const undeclared = unmeasured.filter((s) => !NO_PROSE[s]);
const staleDeclarations = Object.keys(NO_PROSE)
  .filter((s) => opened.includes(s) && !unmeasured.includes(s)).sort();
out.unmeasured = unmeasured;
out.no_prose_declared = NO_PROSE;
push('FD8', 'every screen opened produced a stem sample, or is declared prose-free with a reason', {
  samples: opened.length, expected: SCREENS.length, sample_of: 'screens opened',
  counts: { captures: out.captures.length, declarations: Object.keys(NO_PROSE).length },
  pass: () => undeclared.length === 0 && staleDeclarations.length === 0,
  detail: `opened [${opened.join(',')}]; unmeasured [${unmeasured.join(',') || '-'}]; `
    + `undeclared [${undeclared.join(',') || '-'}]; stale declarations [${staleDeclarations.join(',') || '-'}]`,
});

out.checks = G.checks;
out.ok = G.ok;
out.native = G.native;
out.graded = `${G.checks.filter(isPass).length} passed, ${G.checks.filter((c) => c.status === 'FAIL').length} failed, ${G.checks.filter((c) => c.status === 'EMPTY' || c.status === 'PARTIAL').length} not graded`;
out.sample_table = sampleTable(G.checks, { tool: 'ui-metrics.mjs' });
writeJson(path.join(RUN, 'ui-metrics.json'), out);
fs.writeFileSync(path.join(RUN, 'sample-table.md'), out.sample_table + '\n');
emit(out);
process.exit(G.exit);

function emit(o) {
  if (args.json) { console.log(JSON.stringify(o, null, 2)); return; }
  log('=== VIS DECLARATION ===');
  log('JUDGEMENT SIDE: FIDELITY');
  log('PROPERTIES UNDER JUDGEMENT: F17, F18, F19');
  log('PERMITTED REFERENCE SET: RI-VIS02 (modern)');
  log('FORBIDDEN REFERENCE SET: RI-VIS05 (Morrowind)');
  log('=== END DECLARATION ===');
  for (const c of o.checks) {
    log(line({ status: c.pass ? 'PASS' : 'FAIL', samples: '?', sample_of: 'unrecorded', ...c }));
  }
  log(`UI FIDELITY native: ${o.native}  (${o.graded})`);
  log(`artifacts: ${RUN}`);
}
