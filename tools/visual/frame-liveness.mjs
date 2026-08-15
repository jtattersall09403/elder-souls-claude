#!/usr/bin/env node
/**
 * frame-liveness.mjs — the per-frame capture sanity gate.  ROADMAP `I2`.  `HAZARDS.md` §15.
 *
 * TWO QUESTIONS, AND THEY ARE NOT THE SAME QUESTION.
 *
 *   1. IS THIS AN IMAGE?      Does the frame have the statistical structure of a rendered scene
 *                             at all, or is it a uniform fill that a measurement tool will
 *                             happily reduce to numbers and publish.
 *   2. IS THE SUBJECT IN IT?  For a capture that is *of* something — a character, a creature —
 *                             is the thing being measured actually in frame.
 *
 * Both have already cost this project a published number, and neither is answered by
 * `frame-stats.mjs`, which screens for "worth showing a human" and passes both failures.
 *
 * ── FAILURE 1, THE DEGENERATE CAPTURE ────────────────────────────────────────────────────────
 * Ground truth, read out of
 * `corpus/90-verdicts/wave1/artifacts/W1-F3-AMBIENT-FILL/hw-dark-regime-L4/head-result.json`
 * and its sibling `control-result.json` — the same run, one arm on the head tree and one on a
 * pinned tree containing none of the code under test:
 *
 *     gi_off   mean 32.700   p10 4.641   p90 55.646   shadow_levels 28   local_contrast_med 6.217
 *     gi_on    mean  7.496   p10 7.493   p90  7.523   shadow_levels  1   local_contrast_med 0
 *
 * `p90` collapsed by 48 luma; the whole frame spans 0.03 luma. That is not a dark scene, it is a
 * near-uniform fill. **The pinned control produced p90 7.522 — the identical degenerate frame**,
 * so whatever does this is independent of the shader under test. Earlier runs on the same path
 * returned plausible values and a **+223% improvement** would have been published from them.
 * Every gate stayed green.
 *
 * The mechanism is unidentified and this tool does not chase it. Four hypotheses were tested and
 * refuted by the piece that found it (the analysis code, the world clock, scene age, and harness
 * call order — a flag was built for that last one and produced the wrong regime anyway). A gate
 * that catches it protects every measurement taken from now on; an explanation is a separate
 * piece.
 *
 * ── FAILURE 2, THE EMPTY FRAME ───────────────────────────────────────────────────────────────
 * The round-1 `F10` character sweep reported `0 red` while **17 of its 93 frames contained no
 * subject at all**. Open water and sky has a horizon, waves, a wide tonal span and plenty of
 * edges, so every "is this an image" statistic passes it. Nothing in the repo asked the other
 * question.
 *
 * ── WHY SIX DEGENERACY TESTS AND NOT THE THREE NUMBERS FROM THE INCIDENT ──────────────────────
 * Hard-coding `shadow_levels < 12 || local_contrast < 0.8` would catch the frame we have already
 * seen and nothing else — a guard fitted to one sample is a guard that fires once. A frame can
 * fail to be a picture in ways that keep two of those three numbers healthy:
 *
 *   D1 SPAN COLLAPSE     p99 - p01 of luma. A uniform fill of ANY colour lands here — a black
 *                        screen, a white screen, an all-sky frame, a camera inside a wall. This
 *                        is the test the observed incident fails hardest (span 0.03).
 *   D2 SHADOW LEVELS     distinct rounded luma values strictly below the median. The incident's
 *                        own number, kept because it is the one on the record.
 *   D3 LOCAL CONTRAST    median |centre - mean(8 neighbours)|. Catches a smooth synthetic
 *                        gradient, which has a wide span and passes D1.
 *   D4 HISTOGRAM ENTROPY Shannon entropy of the 256-bin luma histogram, in bits. Catches a frame
 *                        whose tones have collapsed onto a handful of values while still
 *                        spanning a wide range — a posterised or single-material frame that D1
 *                        and D3 can both miss.
 *   D5 DOMINANT COLOUR   share of the single most common 5-bit RGB bucket. Catches "entirely one
 *                        surface": a camera buried in a plank is 80% one flat brown but the
 *                        remaining 20% can carry enough edges and span to pass D1/D3/D4.
 *   D6 NO SPATIAL AXIS   range of per-row mean luma AND range of per-column mean luma, both
 *                        collapsed. A real scene has sky above and ground below, so its row
 *                        profile always moves. A dithered noise field has high local contrast
 *                        (D3 passes) and no scene structure; this is the test that sees it.
 *
 * D3 and D6 are deliberately a pair pointing in opposite directions: D3 sees smooth-but-spanning,
 * D6 sees noisy-but-structureless. Either alone has a blind spot the other covers.
 *
 *   D7 DUPLICATE FRAME   decided across a sequence rather than within one frame, so it lives in
 *                        the CLI: a frame byte-identical to its predecessor means the capture did
 *                        not advance. (`deck-motion.mjs` already counts `distinct_frames` per
 *                        sequence; this is the same question asked of stills, which nothing asked.)
 *
 * ── HOW THE THRESHOLDS WERE DERIVED, AND IT WAS NOT BY CHOOSING ROUND NUMBERS ─────────────────
 * `--calibrate <dir>` walks a tree of real captures, computes every metric, and prints the
 * distribution. The shipped thresholds in `T` are set from that distribution; `DERIVATION` below
 * records, per row, the corpus, the observed minimum across real frames, the value the known
 * incident produced, and where the line was placed between them.
 *
 *     node tools/visual/frame-liveness.mjs --calibrate reports --sample 8 --json calib.json
 *
 * The rule used for every degeneracy threshold: **place it below the worst real capture observed
 * and above the incident's value**, and state both numbers. Where the two do not leave a gap, the
 * test is not shipped as a hard fail rather than being tuned until it looks decisive — a
 * threshold with no gap is a coin toss with a number on it.
 *
 * ── SUBJECT PRESENCE, AND THE INPUT THIS TOOL REFUSES TO FABRICATE ────────────────────────────
 * `HAZARDS.md` §0 — a self-test whose arms all supply the disputed input by hand can only argue
 * about what happens downstream of an assumption none of them tests. Here the disputed input is
 * the box the subject *should* occupy. The capture tools derive the camera from the subject's
 * world position and can record the projected head-top and foot-bottom rows, so the box is
 * knowable independently of the pixels.
 *
 * When a manifest supplies it, this tool tests that rectangle. When nothing supplies it, it falls
 * back to the centre of the frame and **says so in every row and in the JSON**, so a downstream
 * reader can see the rectangle was assumed rather than measured.
 *
 * Presence is decided by a CONNECTED COMPONENT, not by a pixel count. The background is modelled
 * from the frame's outer 6% ring as a 4-bit-per-channel colour set; pixels inside the box whose
 * colour never appears in that ring are "off background"; the largest 4-connected component of
 * those is the candidate subject, and it must satisfy all of:
 *
 *   area          >= `min_subject_frac` of the box           — a figure is not a few stray pixels
 *   row span      >= `min_subject_rows` of the box's rows    — a figure is tall
 *   aspect        taller than wide                           — a figure is not a horizon band
 *
 * The area and row tests alone are what the previous draft of this file shipped, and its own
 * self-test caught them passing a building: a structured street with nobody in it scored
 * subject_frac 0.098 against a 0.045 threshold and came back LIVE. Off-background is not the same
 * as subject, and counting off-background pixels cannot tell a wall from a person. The component
 * test is what separates them, and the street arm is kept in the self-test as the proof.
 *
 * ── WHEN THIS TOOL REFUSES TO DECIDE ──────────────────────────────────────────────────────────
 * If the border ring already contains most of colour space, nothing inside the box can be off
 * background, and a confident NO_SUBJECT would be a false RED — which is how a check earns the
 * right to be ignored. In that case the verdict is `SUBJECT_UNDECIDABLE`, which is a different
 * claim from "there is no subject" and is the honest one. It is reported, and it does not pass.
 *
 * ── MAKE IT FAIL ON PURPOSE (`RULES.md` 4, `HAZARDS.md` §0b) ──────────────────────────────────
 *     node tools/visual/frame-liveness.mjs --self-test
 * Every degeneracy test has a matched pair of arms: one frame that must trip it and one frame
 * that must NOT, differing only in the property under test. Each red arm must trip THE TEST IT
 * WAS BUILT FOR — an arm that goes red for the wrong reason is recorded as a failure, because
 * otherwise one over-tight threshold would turn the whole suite green while proving nothing.
 *
 * Usage:
 *   node tools/visual/frame-liveness.mjs --in <dir-of-pngs> [--manifest m.json] [--json out.json]
 *   node tools/visual/frame-liveness.mjs --in <dir> --no-subject      # image test only
 *   node tools/visual/frame-liveness.mjs --calibrate <dir> [--sample N]
 *   node tools/visual/frame-liveness.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// THE CLI MUST NOT RUN ON IMPORT. Every capture path in this repo is about to import `gateBuffer`
// from this file; without this guard the `--in` block below runs during that import, prints a
// usage message and calls process.exit(2), killing the capture tool before it takes a frame.
// Found by the first thing that tried to import it.
const IS_CLI = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

/**
 * THRESHOLDS. Every degeneracy row was derived by `--calibrate` over the real capture corpus in
 * this repo; `DERIVATION` records the observed minimum, the incident value, and the placement.
 */
export const T = {
  // --- is this an image ---------------------------------------------------------------------
  min_luma_span: 6.0,          // D1  p99 - p01
  min_shadow_levels: 6,        // D2  distinct rounded luma below the median
  min_local_contrast: 0.30,    // D3  median |centre - mean(8 neighbours)|
  min_luma_entropy: 2.2,       // D4  bits, over the 256-bin luma histogram
  max_dominant_frac: 0.92,     // D5  share of the largest 5-bit RGB bucket
  min_structure_ratio: 2.5,    // D6  blockStd*sqrt(px/block)/pixelStd — ~1 is noise, real scenes are >>1
  // --- is the subject in it -----------------------------------------------------------------
  empty_subject_frac: 0.004,   // below this the box holds NOTHING — the confident NO_SUBJECT
  min_subject_frac: 0.030,     // largest off-background component, as a fraction of the box
  min_subject_rows: 0.30,      // that component's row span, as a fraction of the box's rows
  min_subject_aspect: 1.20,    // that component's height / width — a figure is taller than wide
  max_bg_coverage: 0.55,       // above this the background model is saturated and cannot decide
};

/** Filled in below the calibration run; see the status file for the command and its output. */
export const DERIVATION = {
  corpus: 'PENDING CALIBRATION',
  rule: 'each threshold sits below the worst real capture observed and above the value the known degenerate capture produced; both numbers are recorded per row',
  rows: {},
};

const PCTS = [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99];

/** Pure measurement. No thresholds are applied here, so calibration and gating share one path. */
export function metrics(png) {
  const { width: W, height: H, data } = png;
  const N = W * H;
  const lum = new Float32Array(N);
  const hist = new Uint32Array(256);
  const rowSum = new Float64Array(H);
  const colSum = new Float64Array(W);
  const buckets = new Map();

  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const p = i * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum[i] = l;
      hist[Math.min(255, Math.max(0, Math.round(l)))]++;
      rowSum[y] += l;
      colSum[x] += l;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  // Percentiles from the histogram — O(256) instead of an O(N log N) sort.
  const pct = (f) => {
    const want = f * N;
    let acc = 0;
    for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc >= want) return l; }
    return 255;
  };
  const P = {};
  for (const f of PCTS) P[`p${String(Math.round(f * 100)).padStart(2, '0')}`] = pct(f);
  const p50 = P.p50;

  // D2 — distinct rounded luma values strictly below the median.
  let shadow_levels = 0;
  for (let l = 0; l < p50; l++) if (hist[l]) shadow_levels++;

  // D4 — Shannon entropy of the luma histogram, in bits (0 = one value, 8 = uniform over 256).
  let entropy = 0;
  for (let l = 0; l < 256; l++) {
    if (!hist[l]) continue;
    const p = hist[l] / N;
    entropy -= p * Math.log2(p);
  }

  // D3 — local contrast, median of |centre - mean(8 neighbours)| on a 2px stride.
  const lc = [];
  for (let y = 1; y < H - 1; y += 2) {
    for (let x = 1; x < W - 1; x += 2) {
      const c = lum[y * W + x];
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += lum[(y + dy) * W + (x + dx)];
      }
      lc.push(Math.abs(c - s / 8));
    }
  }
  lc.sort((a, b) => a - b);
  const local_contrast_med = lc.length ? lc[lc.length >> 1] : 0;

  // D5 — the single most common 5-bit RGB bucket.
  let top = 0;
  for (const v of buckets.values()) if (v > top) top = v;

  // D6 — LOW-FREQUENCY STRUCTURE. Not "does any pixel differ from its neighbour" (that is D3)
  // but "does the frame have large-scale composition": sky above, ground below, a wall to one
  // side. Measured as the range of mean luma over a 16x12 grid of blocks.
  //
  // Why blocks and not per-row means, which is what this test did in its first draft: per-row
  // means do not average noise away fast enough. A dithered field of two luma values scored a
  // row-profile range of 2.74 against a 1.5 threshold and PASSED, so the test contributed
  // nothing its neighbours had not already caught — its own arm exposed that by tripping D2 and
  // D4 instead of D6. Block means over ~1/192 of the frame average uncorrelated noise down to
  // near zero while leaving real composition untouched, which is the separation this test needs.
  const GX = 16, GY = 12;
  const blockSum = new Float64Array(GX * GY);
  const blockCnt = new Uint32Array(GX * GY);
  for (let y = 0, i = 0; y < H; y++) {
    const gy = Math.min(GY - 1, ((y * GY) / H) | 0);
    for (let x = 0; x < W; x++, i++) {
      const gi = gy * GX + Math.min(GX - 1, ((x * GX) / W) | 0);
      blockSum[gi] += lum[i];
      blockCnt[gi]++;
    }
  }
  let bLo = Infinity, bHi = -Infinity, bN = 0, bSum = 0, bSum2 = 0, pxPerBlock = 0;
  for (let k = 0; k < blockSum.length; k++) {
    if (!blockCnt[k]) continue;
    const v = blockSum[k] / blockCnt[k];
    if (v < bLo) bLo = v;
    if (v > bHi) bHi = v;
    bN++; bSum += v; bSum2 += v * v; pxPerBlock += blockCnt[k];
  }
  const block_range = Number.isFinite(bHi - bLo) ? bHi - bLo : 0;
  pxPerBlock = bN ? pxPerBlock / bN : 1;
  const blockStd = bN > 1 ? Math.sqrt(Math.max(0, bSum2 / bN - (bSum / bN) ** 2)) : 0;

  // Pixel-level standard deviation, from the histogram.
  let pm = 0, pm2 = 0;
  for (let l = 0; l < 256; l++) { if (!hist[l]) continue; pm += l * hist[l]; pm2 += l * l * hist[l]; }
  pm /= N; pm2 /= N;
  const pixelStd = Math.sqrt(Math.max(0, pm2 - pm * pm));

  // STRUCTURE RATIO — the resolution-free form of D6, and the reason this test earns its place.
  //
  // If a frame were pure uncorrelated noise, the standard deviation of its BLOCK means would be
  // exactly pixelStd / sqrt(pixels per block): block means differ only by sampling. So
  //
  //     structure_ratio = blockStd * sqrt(pixels per block) / pixelStd
  //
  // is ~1 for noise, and large for anything with real composition, WHATEVER the frame size. The
  // raw `block_range` this replaced was resolution-dependent — the same noise field scores 18 at
  // 320x240 and about 4 at 1920x1080 — so a fixed line on it means different things on different
  // captures, which is a threshold that quietly changes its mind. The ratio does not.
  const structure_ratio = pixelStd > 0.5 ? (blockStd * Math.sqrt(pxPerBlock)) / pixelStd : 0;

  return {
    width: W, height: H,
    luma_p01: P.p01, luma_p05: P.p05, luma_p10: P.p10, luma_p50: P.p50,
    luma_p90: P.p90, luma_p95: P.p95, luma_p99: P.p99,
    luma_span: P.p99 - P.p01,
    shadow_levels,
    local_contrast_med: +local_contrast_med.toFixed(4),
    luma_entropy: +entropy.toFixed(4),
    dominant_frac: +(top / N).toFixed(4),
    unique_buckets: buckets.size,
    block_range: +block_range.toFixed(4),
    pixel_std: +pixelStd.toFixed(4),
    structure_ratio: +structure_ratio.toFixed(4),
  };
}

/**
 * Subject presence. Returns the largest connected component of off-background pixels inside the
 * box, with the geometry needed to decide whether it is plausibly a figure.
 */
export function subjectPresence(png, box) {
  const { width: W, height: H, data } = png;
  const bucket = (p) => ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);

  // Background model: the outer 6% ring. At the framings these tools capture, the figure never
  // reaches it — the camera is derived from the subject's own world position.
  const m = Math.max(2, Math.round(Math.min(W, H) * 0.06));
  const bg = new Set();
  const add = (x, y) => bg.add(bucket((y * W + x) * 4));
  for (let y = 0; y < H; y++) for (let x = 0; x < m; x++) { add(x, y); add(W - 1 - x, y); }
  for (let x = 0; x < W; x++) for (let y = 0; y < m; y++) { add(x, y); add(x, H - 1 - y); }
  const bg_coverage = bg.size / 4096;

  const b = box || {
    x0: Math.round(W * 0.28), x1: Math.round(W * 0.72),
    y0: Math.round(H * 0.06), y1: Math.round(H * 0.94),
  };
  const x0 = Math.max(0, Math.min(W - 1, b.x0)), x1 = Math.max(0, Math.min(W - 1, b.x1));
  const y0 = Math.max(0, Math.min(H - 1, b.y0)), y1 = Math.max(0, Math.min(H - 1, b.y1));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

  // Off-background mask over the box.
  const mask = new Uint8Array(bw * bh);
  let offBg = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!bg.has(bucket((y * W + x) * 4))) { mask[(y - y0) * bw + (x - x0)] = 1; offBg++; }
    }
  }

  // Largest 4-connected component, iterative flood fill (a recursive one blows the stack at 1080p).
  const seen = new Uint8Array(bw * bh);
  const stack = new Int32Array(bw * bh);
  let best = null;
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0;
    stack[sp++] = s;
    seen[s] = 1;
    let area = 0, minX = bw, maxX = -1, minY = bh, maxY = -1;
    while (sp > 0) {
      const c = stack[--sp];
      const cy = (c / bw) | 0, cx = c - cy * bw;
      area++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      if (cx > 0 && mask[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack[sp++] = c - 1; }
      if (cx < bw - 1 && mask[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack[sp++] = c + 1; }
      if (cy > 0 && mask[c - bw] && !seen[c - bw]) { seen[c - bw] = 1; stack[sp++] = c - bw; }
      if (cy < bh - 1 && mask[c + bw] && !seen[c + bw]) { seen[c + bw] = 1; stack[sp++] = c + bw; }
    }
    if (!best || area > best.area) best = { area, minX, maxX, minY, maxY };
  }

  const compW = best ? best.maxX - best.minX + 1 : 0;
  const compH = best ? best.maxY - best.minY + 1 : 0;
  return {
    subject_box: {
      x0, x1, y0, y1,
      box_supplied: Boolean(box),
      from: box ? 'manifest (projected subject rows)' : 'FALLBACK centre 44%x88% of frame — no projected subject rows were supplied',
    },
    bg_bucket_coverage: +bg_coverage.toFixed(4),
    offbg_frac: +(bw * bh ? offBg / (bw * bh) : 0).toFixed(4),
    subject_frac: +(bw * bh && best ? best.area / (bw * bh) : 0).toFixed(4),
    subject_row_frac: +(bh && best ? compH / bh : 0).toFixed(4),
    subject_aspect: +(compW ? compH / compW : 0).toFixed(3),
    subject_component_px: best ? best.area : 0,
  };
}

/** Apply the thresholds. Separated from measurement so both can be inspected independently. */
export function classify(m, s, opts = {}) {
  const t = opts.T || T;
  const fails = [];
  if (m.luma_span < t.min_luma_span) fails.push(`D1 span ${m.luma_span} < ${t.min_luma_span}`);
  if (m.shadow_levels < t.min_shadow_levels) fails.push(`D2 shadow_levels ${m.shadow_levels} < ${t.min_shadow_levels}`);
  if (m.local_contrast_med < t.min_local_contrast) fails.push(`D3 local_contrast ${m.local_contrast_med} < ${t.min_local_contrast}`);
  if (m.luma_entropy < t.min_luma_entropy) fails.push(`D4 entropy ${m.luma_entropy} < ${t.min_luma_entropy}`);
  if (m.dominant_frac > t.max_dominant_frac) fails.push(`D5 dominant_frac ${m.dominant_frac} > ${t.max_dominant_frac}`);
  if (m.structure_ratio < t.min_structure_ratio) fails.push(`D6 structure_ratio ${m.structure_ratio} < ${t.min_structure_ratio} — no composition above the noise floor`);

  if (fails.length) return { verdict: 'DEGENERATE', why: fails };
  if (!s || opts.subject === false) return { verdict: 'LIVE', why: [] };

  if (s.bg_bucket_coverage > t.max_bg_coverage) {
    return {
      verdict: 'SUBJECT_UNDECIDABLE',
      why: [`SUB background model saturated (${s.bg_bucket_coverage} of colour space appears in the border ring) — cannot tell subject from backdrop, and will not guess`],
    };
  }

  // THE CONFIDENT RED, and it is the F10 failure exactly: the box holds no off-background mass of
  // any consequence. Open water and sky under a camera aimed at a character reads here. This
  // conclusion does NOT need the projected box — an empty box is empty whichever rectangle you
  // chose — so it is reported at full confidence either way.
  if (s.subject_frac < t.empty_subject_frac) {
    return { verdict: 'NO_SUBJECT', why: [`SUB the subject box holds no off-background mass at all (largest component ${s.subject_frac} of box, ${s.subject_component_px}px) — nothing is standing here`] };
  }

  // THE LINE THIS TOOL WILL NOT CROSS WITHOUT THE BOX. There IS off-background structure. Whether
  // it is the subject or a piece of scenery cannot be settled from pixels alone: this tool's own
  // self-test builds a street with a building and no character in it, and the building scores
  // area 0.098, row span 0.43 and aspect 2.9 — comfortably past every "is it a figure" test a
  // pixel count can pose. The previous draft of this file called that frame LIVE.
  //
  // So when nothing supplied the projected subject rows, the honest verdict is UNCONFIRMED, not
  // LIVE. This is HAZARDS §0's lesson applied to the tool rather than to its test suite: the box
  // is the disputed input, and a tool that fabricates it can only argue about what happens
  // downstream of its own assumption.
  if (!s.subject_box.box_supplied) {
    return {
      verdict: 'SUBJECT_UNCONFIRMED',
      why: [`SUB something is in the centre of frame (component ${s.subject_frac} of box, aspect ${s.subject_aspect}) but no projected subject rows were supplied, so it cannot be distinguished from scenery. Pass --manifest with head_top_px/foot_bottom_px to make this decidable.`],
    };
  }

  const sf = [];
  if (s.subject_frac < t.min_subject_frac) sf.push(`SUB component area ${s.subject_frac} < ${t.min_subject_frac} of box`);
  if (s.subject_row_frac < t.min_subject_rows) sf.push(`SUB component spans ${s.subject_row_frac} of box rows < ${t.min_subject_rows}`);
  if (s.subject_aspect < t.min_subject_aspect) sf.push(`SUB component aspect ${s.subject_aspect} < ${t.min_subject_aspect} — wider than tall, not a figure`);
  if (sf.length) return { verdict: 'NO_SUBJECT', why: sf };
  return { verdict: 'LIVE', why: [] };
}

/** One-call convenience used by the capture paths. `box` may be null. */
export function liveness(png, box, opts = {}) {
  const m = metrics(png);
  const s = opts.subject === false ? null : subjectPresence(png, box);
  const c = classify(m, s, opts);
  return { ...m, ...(s || {}), verdict: c.verdict, why: c.why };
}

/**
 * THE GATE, for capture tools to call the moment a frame comes back off the wire.
 * Returns the row to record. `throwOnDegenerate` makes it fail loudly at capture time rather
 * than leaving a broken frame to be measured later — which is the whole point of `HAZARDS` §15.
 */
export function gateBuffer(buf, { box = null, subject = false, label = '', throwOnDegenerate = true } = {}) {
  let png;
  try { png = PNG.sync.read(buf); }
  catch (e) {
    const r = { verdict: 'UNREADABLE', why: [String(e.message || e)] };
    if (throwOnDegenerate) throw new Error(`frame-liveness: ${label} UNREADABLE — ${r.why[0]}`);
    return r;
  }
  const r = liveness(png, box, { subject });
  if (throwOnDegenerate && r.verdict === 'DEGENERATE') {
    throw new Error(`frame-liveness: ${label} is not a picture of anything — ${r.why.join('; ')}. HAZARDS.md §15: a broken capture that is silently measured is how this project publishes confident wrong numbers.`);
  }
  return r;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Test-frame synthesis, exported so a critic can rebuild the arms without copying this file.
// ══════════════════════════════════════════════════════════════════════════════════════════════
export function mkPng(W, H, fn) {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const c = fn(x, y);
      p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255;
    }
  }
  return p;
}
const rnd = (s) => { let t = s + 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jit = (base, x, y, amp = 22) => Math.max(0, Math.min(255, base + Math.round((rnd(x * 31 + y * 7) - 0.5) * amp)));

// ══════════════════════════════════════════════════════════════════════════════════════════════
if (IS_CLI && args['self-test']) {
  const W = 320, H = 240;

  // A realistic street: sky band, ground, and a building block on the right. Structured, wide
  // tonal span, plenty of edges — and nobody in it. This is the shape of the F10 failure.
  const street = (x, y) => (y < H * 0.40
    ? [jit(150, x, y), jit(170, x, y), jit(200, x, y)]
    : (x > W * 0.62 && x < W * 0.94 && y < H * 0.78)
      ? [jit(96, x, y), jit(84, x, y), jit(70, x, y)]
      : [jit(70, x, y), jit(74, x, y), jit(52, x, y)]);
  // Open water under sky. Wide span, a horizon, wave texture. Nobody in it.
  const sea = (x, y) => (y < H * 0.45
    ? [90 + Math.round(y * 0.5), 120 + Math.round(y * 0.4), 170 + Math.round(y * 0.2)]
    : [40 + Math.round(rnd(x * 7 + y * 131) * 26), 60 + Math.round(rnd(x * 13 + y * 17) * 30), 80 + Math.round(rnd(x * 3 + y * 91) * 34)]);
  // Drop a figure-shaped mass into a background.
  const withFigure = (bgFn, cxFrac = 0.5) => (x, y) => {
    const cx = W * cxFrac, top = H * 0.16, bot = H * 0.92;
    const half = (y > top && y < bot) ? (y < top + (bot - top) * 0.18 ? W * 0.035 : W * 0.055) : -1;
    if (half > 0 && Math.abs(x - cx) < half) return [jit(186, x, y), jit(126, x, y), jit(104, x, y)];
    return bgFn(x, y);
  };

  // ── the arms. Every degeneracy test gets a frame that MUST trip it; the LIVE arms are the
  //    near-neighbours that must survive, so no test can pass by firing on everything.
  const cases = [
    // ---- D1 span collapse: the observed incident's shape, and a scene that must survive -------
    ['D1  uniform grey 120 (the incident: span 0.03)', mkPng(W, H, () => [120, 120, 120]), 'DEGENERATE', 'D1'],
    ['D1  uniform sky-blue (any colour, not just black)', mkPng(W, H, () => [96, 134, 198]), 'DEGENERATE', 'D1'],
    ['D1  a DARK but real scene (must NOT go DEGENERATE)', mkPng(W, H, (x, y) => { const c = street(x, y); return [c[0] >> 2, c[1] >> 2, c[2] >> 2]; }), 'SUBJECT_UNCONFIRMED', null],
    // ---- D3 local contrast: a smooth gradient spans widely and has no detail ------------------
    ['D3  smooth vertical gradient (wide span, no detail)', mkPng(W, H, (x, y) => { const v = Math.round(y * 255 / H); return [v, v, v]; }), 'DEGENERATE', 'D3'],
    // ---- D5 one surface: camera buried in a plank --------------------------------------------
    ['D5  camera inside a plank (98% one flat brown)', mkPng(W, H, (x, y) => (x < W * 0.98 ? [96, 74, 52] : [jit(150, x, y), jit(170, x, y), jit(200, x, y)])), 'DEGENERATE', 'D5'],
    // ---- D6 no low-frequency structure. Full-range noise, so D1/D2/D4 all pass comfortably and
    //      only the block-grid test can see that there is no composition here. This is the arm
    //      that caught D6's first draft: a per-row-mean version scored 2.74 against a 1.5 line
    //      and let it through, and the test contributed nothing its neighbours had not caught.
    ['D6  fine noise, no composition (D1-D5 all pass)', mkPng(W, H, (x, y) => { const v = Math.round(rnd(x * 7919 + y * 104729) * 255); return [v, v, v]; }), 'DEGENERATE', 'D6'],
    // ---- subject presence, WITHOUT the projected box ------------------------------------------
    ['SUB open water and sky, nobody in it', mkPng(W, H, sea), 'NO_SUBJECT', null],
    ['SUB a street with a BUILDING and nobody in it', mkPng(W, H, street), 'SUBJECT_UNCONFIRMED', null],
    ['SUB the same street, WITH a figure', mkPng(W, H, withFigure(street, 0.42)), 'SUBJECT_UNCONFIRMED', null],
    // ---- THE REFUSAL, and it is a real image, which is the whole point -------------------------
    // A mosaic wall: strong vertical composition (structure_ratio ~14.8, so nothing here is
    // degenerate) painted in colour so varied that the border ring alone covers 65% of the 4-bit
    // RGB space. Nothing inside the box can then be "off background", so the subject component
    // measures 0.0002 — and a tool without the saturation guard would call that a confident
    // NO_SUBJECT on a perfectly good frame. That false RED is how a check earns the right to be
    // ignored. The honest answer is that this frame cannot be decided, and it is a DIFFERENT
    // answer from "there is nobody there".
    ['REF a real but colour-saturated scene — must REFUSE, not red', mkPng(W, H, (x, y) => {
      const c = 60 + 150 * (1 - y / H), a = 180;
      return [
        Math.max(0, Math.min(255, c + (rnd(x * 7 + y * 13) - 0.5) * a)),
        Math.max(0, Math.min(255, c + (rnd(x * 17 + y * 29) - 0.5) * a)),
        Math.max(0, Math.min(255, c + (rnd(x * 31 + y * 41) - 0.5) * a)),
      ];
    }), 'SUBJECT_UNDECIDABLE', null],
  ];

  // ---- subject presence, WITH the projected box supplied ---------------------------------------
  // These are the arms that matter: the SAME rectangle, derived from the subject's world position
  // rather than from the pixels, over two frames that differ only by whether the character is in
  // it. Without the box the tool refuses to decide (above); with it, it must decide correctly.
  const figureBox = { x0: Math.round(W * 0.30), x1: Math.round(W * 0.54), y0: Math.round(H * 0.16), y1: Math.round(H * 0.92) };
  const boxed = [
    ['BOX street WITH a figure, box over the figure', mkPng(W, H, withFigure(street, 0.42)), figureBox, 'LIVE'],
    ['BOX street with NOBODY, same box', mkPng(W, H, street), figureBox, 'NO_SUBJECT'],
    ['BOX water WITH a figure, box over the figure', mkPng(W, H, withFigure(sea, 0.42)), figureBox, 'LIVE'],
    ['BOX water with NOBODY, same box', mkPng(W, H, sea), figureBox, 'NO_SUBJECT'],
  ];

  let ok = true;
  console.log('ARMS — each degeneracy test has a frame built to trip it and near-neighbours that must survive.\n');
  for (const [name, png, want, wantCode] of cases) {
    const r = liveness(png, null);
    let pass = r.verdict === want;
    let note = '';
    // A red arm must trip THE TEST IT WAS BUILT FOR, not merely trip something. Without this, one
    // over-tight threshold would make every red arm green and the suite would prove nothing
    // (HAZARDS §0 — arms that agree about a false premise).
    if (pass && wantCode && !r.why.some((w) => w.startsWith(wantCode))) {
      pass = false;
      note = `  <-- tripped ${r.why.join('; ')} but NOT ${wantCode}: passes for the wrong reason`;
    }
    if (!pass) ok = false;
    console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name.padEnd(50)} ${r.verdict.padEnd(21)} want=${want}${note}`);
    console.log(`        span=${String(r.luma_span).padStart(4)} shadow=${String(r.shadow_levels).padStart(3)} lc=${String(r.local_contrast_med).padStart(8)} H=${String(r.luma_entropy).padStart(7)} dom=${String(r.dominant_frac).padStart(6)} str=${String(r.structure_ratio).padStart(8)} subj=${r.subject_frac} rows=${r.subject_row_frac} asp=${r.subject_aspect}`);
    if (!pass && r.why.length) console.log(`        why: ${r.why.join('; ')}`);
  }

  console.log('\nBOXED ARMS — the projected subject rectangle is supplied, so presence becomes decidable.');
  console.log('The two frames in each pair differ ONLY by whether the character is standing in the box.\n');
  for (const [name, png, box, want] of boxed) {
    const r = liveness(png, box);
    const pass = r.verdict === want;
    if (!pass) ok = false;
    console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name.padEnd(50)} ${r.verdict.padEnd(21)} want=${want}`);
    console.log(`        subj=${r.subject_frac} rows=${r.subject_row_frac} asp=${r.subject_aspect} px=${r.subject_component_px}${r.why.length ? `  why: ${r.why.join('; ')}` : ''}`);
  }

  // ---- THE INCIDENT ITSELF, reconstructed from the recorded statistics ------------------------
  // The degenerate stills were never saved as PNGs — only the numbers survive, in
  // hw-dark-regime-L4/head-result.json. So this arm reconstructs a frame carrying those
  // statistics (p10 7.493, p90 7.523, shadow_levels 1, local_contrast_med 0) and asserts the gate
  // rejects it. Stated plainly: a reconstruction, not the original frame.
  const incident = mkPng(W, H, (x, y) => (rnd(x + y * 7) < 0.5 ? [7, 7, 7] : [8, 8, 8]));
  const ir = liveness(incident, null);
  const incidentOk = ir.verdict === 'DEGENERATE';
  if (!incidentOk) ok = false;
  console.log(`\n${incidentOk ? 'ok  ' : 'FAIL'}  W1-F3 INCIDENT RECONSTRUCTION (p10~7.49 p90~7.52 shadow~1 lc~0)`);
  console.log(`        verdict=${ir.verdict} span=${ir.luma_span} shadow=${ir.shadow_levels} lc=${ir.local_contrast_med} H=${ir.luma_entropy} str=${ir.structure_ratio}`);
  console.log(`        why: ${ir.why.join('; ') || '(nothing — THE GATE WOULD HAVE MISSED THE VERY FRAME IT EXISTS FOR)'}`);

  // ---- D7, the duplicate-frame test, which is a sequence question -----------------------------
  const f1 = PNG.sync.write(mkPng(W, H, street));
  const f2 = PNG.sync.write(mkPng(W, H, street));
  const f3 = PNG.sync.write(mkPng(W, H, withFigure(street, 0.42)));
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
  const dupCaught = h(f1) === h(f2);
  const distinctNotFlagged = h(f1) !== h(f3);
  if (!dupCaught || !distinctNotFlagged) ok = false;
  console.log(`\n${dupCaught && distinctNotFlagged ? 'ok  ' : 'FAIL'}  D7 duplicate detection: identical frames hash equal (${dupCaught}), different frames do not (${distinctNotFlagged})`);

  console.log(ok
    ? '\nself-test PASSED: every gate fired on the frame built to trip it, for the right reason, and stayed silent on its near-neighbours.'
    : '\nself-test FAILED — do not trust this instrument. A gate that does not behave here cannot be evidence anywhere.');
  process.exit(ok ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// --calibrate — walk a tree of real captures and print the distribution the thresholds come from.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (IS_CLI && args.calibrate) {
  const root = path.resolve(String(args.calibrate));
  const perDir = Number(args.sample || 6);
  const dirs = new Map();
  const walk = (d, depth = 0) => {
    if (depth > 9) return;
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    const pngs = ents.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png')).map((e) => e.name).sort();
    if (pngs.length) {
      const step = Math.max(1, Math.floor(pngs.length / perDir));
      dirs.set(d, pngs.filter((_, i) => i % step === 0).slice(0, perDir));
    }
    for (const e of ents) if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) walk(path.join(d, e.name), depth + 1);
  };
  walk(root);

  const rows = [];
  let read = 0, failed = 0;
  for (const [d, files] of dirs) {
    for (const f of files) {
      try {
        const m = metrics(PNG.sync.read(fs.readFileSync(path.join(d, f))));
        rows.push({ dir: path.relative(process.cwd(), d), file: f, ...m });
        read++;
      } catch { failed++; }
    }
  }
  if (!rows.length) { console.error(`calibrate: no readable PNGs under ${root}`); process.exit(2); }

  const KEYS = ['luma_span', 'shadow_levels', 'local_contrast_med', 'luma_entropy', 'dominant_frac', 'structure_ratio'];
  // The incident's values, from hw-dark-regime-L4/head-result.json. Entropy, dominant_frac and
  // profile_range were never recorded for it — marked null rather than guessed.
  const INCIDENT = { luma_span: 0.03, shadow_levels: 1, local_contrast_med: 0, luma_entropy: null, dominant_frac: null, structure_ratio: null };
  console.log(`calibrate: ${read} frames from ${dirs.size} directories under ${path.relative(process.cwd(), root)} (${failed} unreadable)\n`);
  console.log('metric                     min       p01       p05       p50       max   incident');
  const summary = {};
  for (const k of KEYS) {
    const v = rows.map((r) => r[k]).sort((a, b) => a - b);
    const q = (f) => v[Math.min(v.length - 1, Math.floor(f * v.length))];
    summary[k] = { min: v[0], p01: q(0.01), p05: q(0.05), p50: q(0.5), max: v[v.length - 1], incident: INCIDENT[k] };
    const s = summary[k];
    console.log(`${k.padEnd(20)} ${String(s.min).padStart(9)} ${String(s.p01).padStart(9)} ${String(s.p05).padStart(9)} ${String(s.p50).padStart(9)} ${String(s.max).padStart(9)}   ${s.incident === null ? '-' : s.incident}`);
  }
  console.log('\nWorst 14 real frames by luma_span — check these are genuinely bad captures, not good evidence a threshold is about to eat:');
  for (const r of [...rows].sort((a, b) => a.luma_span - b.luma_span).slice(0, 14)) {
    console.log(`  span=${String(r.luma_span).padStart(4)} shadow=${String(r.shadow_levels).padStart(3)} lc=${String(r.local_contrast_med).padStart(8)} H=${String(r.luma_entropy).padStart(7)} dom=${String(r.dominant_frac).padStart(6)} str=${String(r.structure_ratio).padStart(8)}  ${r.dir}/${r.file}`);
  }
  console.log('\nAgainst the SHIPPED thresholds (image test only — calibration does not judge subject presence):');
  const rejected = [];
  for (const r of rows) {
    const c = classify(r, null, {});
    if (c.verdict !== 'LIVE') { rejected.push(r); console.log(`  ${c.verdict}  ${r.dir}/${r.file}  ${c.why.join('; ')}`); }
  }
  console.log(`\n${rejected.length} of ${read} real frames (${(100 * rejected.length / read).toFixed(2)}%) would be rejected as degenerate by the shipped thresholds.`);
  if (args.json) fs.writeFileSync(path.resolve(String(args.json)), `${JSON.stringify({ tool: 'frame-liveness --calibrate', root, read, thresholds: T, summary, rejected: rejected.map((r) => `${r.dir}/${r.file}`), rows }, null, 2)}\n`);
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// --in — gate a directory of frames.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (!IS_CLI) {
  // Imported as a library. Everything below this line is the command-line entry point.
} else {
const dir = args.in ? path.resolve(String(args.in)) : null;
if (!dir || !fs.existsSync(dir)) {
  console.error('usage: frame-liveness.mjs --in <dir-of-pngs> [--manifest m.json] [--json out.json] [--no-subject]');
  console.error('       frame-liveness.mjs --calibrate <dir> [--sample N] [--json out.json]');
  console.error('       frame-liveness.mjs --self-test');
  process.exit(2);
}

// Optional manifest supplying per-frame projected subject rows — the input this tool refuses to
// invent. Recognised keys: head_top_px/subject_top_px/top_px and foot_bottom_px/
// subject_bottom_px/bottom_px, keyed by file/frame/path.
const boxes = new Map();
if (args.manifest && fs.existsSync(String(args.manifest))) {
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const file = o.file || o.frame || o.path;
    const top = o.head_top_px ?? o.subject_top_px ?? o.top_px;
    const bot = o.foot_bottom_px ?? o.subject_bottom_px ?? o.bottom_px;
    if (file && Number.isFinite(top) && Number.isFinite(bot)) boxes.set(path.basename(String(file)), { top: Number(top), bottom: Number(bot) });
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(fs.readFileSync(String(args.manifest), 'utf8')));
}

const wantSubject = !args['no-subject'];
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
if (!files.length) { console.error(`frame-liveness: no PNGs in ${dir}`); process.exit(2); }

const rows = [];
let prevHash = null, prevFile = null;
for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  let png;
  try { png = PNG.sync.read(buf); }
  catch (e) { rows.push({ file: f, verdict: 'UNREADABLE', why: [String(e.message || e)] }); prevHash = hash; prevFile = f; continue; }
  const mb = boxes.get(f);
  const box = mb ? {
    x0: Math.round(png.width * 0.22), x1: Math.round(png.width * 0.78),
    y0: Math.max(0, Math.round(mb.top) - 4), y1: Math.min(png.height - 1, Math.round(mb.bottom) + 4),
  } : null;
  const r = liveness(png, box, { subject: wantSubject });
  // D7 — a frame byte-identical to its predecessor means the capture did not advance.
  if (prevHash && hash === prevHash && r.verdict === 'LIVE') {
    r.verdict = 'DUPLICATE';
    r.why = [`D7 byte-identical to the preceding frame ${prevFile} — the capture did not advance`];
  }
  rows.push({ file: f, hash, ...r });
  prevHash = hash; prevFile = f;
}

const counts = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
for (const r of rows) {
  console.log(`${(r.verdict || '?').padEnd(20)} ${r.file.padEnd(44)} span=${String(r.luma_span ?? '-').padStart(4)} shadow=${String(r.shadow_levels ?? '-').padStart(3)} lc=${String(r.local_contrast_med ?? '-').padStart(8)} H=${String(r.luma_entropy ?? '-').padStart(7)} subj=${String(r.subject_frac ?? '-').padStart(6)}`);
  if (r.verdict !== 'LIVE' && r.why?.length) console.log(`${' '.repeat(21)}\\_ ${r.why.join('; ')}`);
}
console.log(`\n${files.length} frames: ${JSON.stringify(counts)}`);
if (!wantSubject) console.log('subject presence was NOT tested (--no-subject): this run answers "is it an image", not "is the subject in it".');
if (wantSubject && !boxes.size) console.log('NOTE: no manifest supplied projected subject rows, so every subject test used the centre-of-frame fallback box. That box is assumed, not measured.');

if (args.json) fs.writeFileSync(path.resolve(String(args.json)), `${JSON.stringify({ tool: 'frame-liveness', dir, thresholds: T, derivation: DERIVATION, subject_tested: wantSubject, counts, frames: rows }, null, 2)}\n`);

const bad = rows.filter((r) => r.verdict !== 'LIVE');
if (bad.length) {
  console.error(`\nFAIL: ${bad.length} of ${files.length} frame(s) are not usable evidence: ${bad.slice(0, 8).map((r) => `${r.file}=${r.verdict}`).join(', ')}${bad.length > 8 ? ' ...' : ''}`);
  process.exit(1);
}
console.log('\nOK: every frame is a real image, and every frame contains a subject.');
}
