#!/usr/bin/env node
/**
 * frame-liveness.mjs — is this frame a picture of anything, and is there a CHARACTER in it?
 *
 * TWO FAILURES THIS REPO HAS ALREADY PAID FOR, neither of which `frame-stats.mjs` catches.
 *
 *  1. THE DEGENERATE CAPTURE. A sibling's paid run returned, from a pinned baseline tree
 *     containing none of the code under test:
 *         p10=7.493  p90=7.523  shadow_levels=1  local_contrast_med=0
 *     A near-uniform frame. Every gate stayed green and a +223% result would have been
 *     published from it. A frame with ~1 distinct level and ~0 local contrast is not a dark
 *     scene, it is a broken capture, and it must be rejected loudly rather than measured.
 *
 *  2. THE EMPTY FRAME. The round-1 `F10` sweep reported `0 red` while **17 of its 93 frames
 *     contained no subject at all** — subject `npc-lilmoth-apothecary-12` stands out at sea off
 *     the Lilmoth pier, so every one of her frames is open water and sky. `frame-stats.mjs`
 *     passes those: water and sky have a horizon, waves, a wide tonal span and plenty of edges.
 *     Nothing in this repo asked the question "is the SUBJECT in the picture".
 *
 * HOW SUBJECT PRESENCE IS DECIDED, and why this is a real test rather than a vibe. The capture
 * tool derives the camera from the subject's world height and records the subject's projected
 * head-top and foot-bottom rows, so the box the character *should* occupy is known independently
 * of the pixels. This tool estimates the background from the frame's outer margin ring (a
 * 6%-wide border, which the figure never reaches at the framings we capture) and asks what
 * fraction of the pixels inside the predicted subject box fall outside that background's colour
 * distribution. A figure standing in frame differs from its own backdrop; open water and sky does
 * not differ from open water and sky.
 *
 * WHICH INPUT DOES EVERY ARM FABRICATE? (HAZARDS §0.) The subject box. If the manifest's
 * projected rows are wrong, this tool tests the wrong rectangle — so when no box is supplied it
 * falls back to the centre 44% x 88% of the frame and SAYS SO in the output, rather than quietly
 * testing something else.
 *
 * MAKE IT FAIL ON PURPOSE (`RULES.md` 4):
 *   node tools/visual/frame-liveness.mjs --self-test
 * synthesises four frames — a uniform grey, a plausible sky-over-water with no subject, the same
 * background with a figure-shaped mass in it, and a normal noisy scene — and asserts the verdicts
 * are DEGENERATE, NO_SUBJECT, LIVE, LIVE. If any arm does not behave, it exits non-zero.
 *
 * Usage:
 *   node tools/visual/frame-liveness.mjs --in <dir-of-pngs> [--json out.json]
 *   node tools/visual/frame-liveness.mjs --in <dir> --manifest <manifest.json>
 *   node tools/visual/frame-liveness.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const T = {
  min_shadow_levels: 12,      // distinct luma levels below the frame median. 1 = the sibling's void frame.
  min_local_contrast: 0.8,    // median |centre - mean(8 neighbours)| in luma units, on a 2px stride
  min_subject_frac: 0.045,    // fraction of the predicted subject box that is not background-coloured
  // FRACTION OF THE BOX'S ROWS CARRYING SUBJECT PIXELS. This was 0.25 and the self-test caught it:
  // a midground building inside the box scored subject_frac 0.098, over the area threshold, and a
  // frame with nobody in it came back LIVE. Area alone cannot tell a character from a wall. What
  // can is that the capture DELIBERATELY frames the subject head to foot — the sweep derives its
  // camera distance from the subject's world height — so a real figure occupies nearly every row
  // of its own box, while an incidental background mass occupies some. Measured on the self-test
  // fixtures: figures 0.78 and 0.88, non-figures 0.00 and 0.43. 0.60 sits in that gap, and with a
  // manifest-supplied box (tight to the projected head-top and foot-bottom rows) a real subject
  // scores above 0.9, so this is not a tight fit against the passing arm.
  min_subject_rows: 0.60,
};

/** Luma, distinct shadow levels, local contrast, and the background/subject separation. */
export function liveness(png, box) {
  const { width: W, height: H, data } = png;
  const lum = new Float32Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    lum[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }
  const sorted = Float32Array.from(lum).sort();
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))];
  const p10 = q(0.10), p50 = q(0.50), p90 = q(0.90);

  // Distinct luma levels strictly BELOW the median — "shadow levels" in the sibling's report.
  const shadowSet = new Set();
  for (let i = 0; i < lum.length; i++) if (lum[i] < p50) shadowSet.add(Math.round(lum[i]));
  const shadow_levels = shadowSet.size;

  // Local contrast: |centre - mean(8-neighbourhood)|, median over a 2px stride.
  const lc = [];
  for (let y = 1; y < H - 1; y += 2) {
    for (let x = 1; x < W - 1; x += 2) {
      const c = lum[y * W + x];
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx || dy) s += lum[(y + dy) * W + (x + dx)]; }
      lc.push(Math.abs(c - s / 8));
    }
  }
  lc.sort((a, b) => a - b);
  const local_contrast_med = lc.length ? lc[Math.floor(lc.length / 2)] : 0;

  // --- subject presence -------------------------------------------------------------------
  // Background model: the outer 6% ring, as a 4-bit-per-channel colour histogram.
  const m = Math.max(2, Math.round(Math.min(W, H) * 0.06));
  const bg = new Set();
  const bucket = (p) => ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
  const addRing = (x, y) => bg.add(bucket((y * W + x) * 4));
  for (let y = 0; y < H; y++) for (let x = 0; x < m; x++) { addRing(x, y); addRing(W - 1 - x, y); }
  for (let x = 0; x < W; x++) for (let y = 0; y < m; y++) { addRing(x, y); addRing(x, H - 1 - y); }

  const b = box || { x0: Math.round(W * 0.28), x1: Math.round(W * 0.72), y0: Math.round(H * 0.06), y1: Math.round(H * 0.94) };
  const bx0 = Math.max(0, b.x0), bx1 = Math.min(W - 1, b.x1), by0 = Math.max(0, b.y0), by1 = Math.min(H - 1, b.y1);
  let inBox = 0, offBg = 0, rowsWithSubject = 0;
  for (let y = by0; y <= by1; y++) {
    let rowHits = 0;
    for (let x = bx0; x <= bx1; x++) {
      inBox++;
      if (!bg.has(bucket((y * W + x) * 4))) { offBg++; rowHits++; }
    }
    if (rowHits > (bx1 - bx0 + 1) * 0.02) rowsWithSubject++;
  }
  const subject_frac = inBox ? offBg / inBox : 0;
  const subject_row_frac = (by1 - by0 + 1) > 0 ? rowsWithSubject / (by1 - by0 + 1) : 0;

  // BACKGROUND-MODEL SATURATION — the limitation this tool's own self-test found, recorded rather
  // than papered over. Subject presence is decided by "how much of the box is a colour the border
  // ring never shows". If the border ring already shows most of colour space, nothing can be off
  // background and the test would report NO_SUBJECT on a perfectly good frame — a false RED, which
  // is how a check earns the right to be ignored. When the model is saturated this tool says it
  // CANNOT DECIDE, which is a different claim from "there is no subject" and is the honest one.
  const bg_coverage = bg.size / 4096;
  const saturated = bg_coverage > 0.55;

  const degenerate = shadow_levels < T.min_shadow_levels || local_contrast_med < T.min_local_contrast;
  const noSubject = !degenerate && !saturated
    && (subject_frac < T.min_subject_frac || subject_row_frac < T.min_subject_rows);
  return {
    width: W, height: H,
    luma_p10: +p10.toFixed(3), luma_p50: +p50.toFixed(3), luma_p90: +p90.toFixed(3),
    shadow_levels, local_contrast_med: +local_contrast_med.toFixed(4),
    subject_box: { x0: bx0, x1: bx1, y0: by0, y1: by1, from: box ? 'manifest' : 'FALLBACK centre 44%x88% — no projected rows supplied' },
    subject_frac: +subject_frac.toFixed(4), subject_row_frac: +subject_row_frac.toFixed(4),
    bg_bucket_coverage: +bg_coverage.toFixed(4),
    verdict: degenerate ? 'DEGENERATE' : noSubject ? 'NO_SUBJECT'
      : saturated ? 'SUBJECT_UNDECIDABLE' : 'LIVE',
  };
}

// ---------------------------------------------------------------------------------------
if (args['self-test']) {
  const mk = (W, H, fn) => { const p = new PNG({ width: W, height: H }); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const [r, g, b] = fn(x, y); p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255; } return p; };
  const W = 320, H = 240;
  const rnd = (s) => { let t = s + 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // (a) uniform grey — the sibling's void frame
  const a1 = mk(W, H, () => [120, 120, 120]);
  // (b) sky over water, no subject. Wide tonal span, a horizon, wave texture — passes frame-stats.
  const seaBg = (x, y) => (y < H * 0.45
    ? [90 + Math.round(y * 0.5), 120 + Math.round(y * 0.4), 170 + Math.round(y * 0.2)]
    : [40 + Math.round(rnd(x * 7 + y * 131) * 26), 60 + Math.round(rnd(x * 13 + y * 17) * 30), 80 + Math.round(rnd(x * 3 + y * 91) * 34)]);
  const a2 = mk(W, H, seaBg);
  // (c) the same sea, with a figure-shaped mass standing in it
  const a3 = mk(W, H, (x, y) => {
    const cx = W / 2, top = H * 0.14, bot = H * 0.92;
    const halfW = (y > top && y < bot) ? (y < top + (bot - top) * 0.18 ? W * 0.035 : W * 0.055) : -1;
    if (halfW > 0 && Math.abs(x - cx) < halfW) return [150 + Math.round(rnd(x + y * 3) * 30), 130, 95];
    return seaBg(x, y);
  });
  // (d) a structured street scene — sky, ground, a building block — and NO subject. This is the
  //     realistic shape of the round-1 failure: plenty of edges, wide tonal span, nobody in it.
  const streetBg = (x, y) => (y < H * 0.40 ? [past(150, x, y), past(170, x, y), past(200, x, y)]
    : (x > W * 0.62 && x < W * 0.94 && y < H * 0.78) ? [past(96, x, y), past(84, x, y), past(70, x, y)]
      : [past(70, x, y), past(74, x, y), past(52, x, y)]);
  function past(base, x, y) { return Math.max(0, Math.min(255, base + Math.round((rnd(x * 31 + y * 7) - 0.5) * 22))); }
  const a4 = mk(W, H, streetBg);
  // (e) the same street WITH a figure — must come back LIVE, or the tool only ever says no.
  const a5 = mk(W, H, (x, y) => {
    const cx = W * 0.42, top = H * 0.20, bot = H * 0.90;
    const halfW = (y > top && y < bot) ? (y < top + (bot - top) * 0.2 ? W * 0.030 : W * 0.050) : -1;
    if (halfW > 0 && Math.abs(x - cx) < halfW) return [past(196, x, y), past(120, x, y), past(150, x, y)];
    return streetBg(x, y);
  });
  // (f) full-spectrum noise — the background model saturates and the tool must SAY it cannot
  //     decide, rather than reporting a confident NO_SUBJECT it has not earned.
  const a6 = mk(W, H, (x, y) => [Math.round(rnd(x * 5 + y) * 255), Math.round(rnd(x + y * 9) * 255), Math.round(rnd(x * 2 + y * 3) * 255)]);
  const cases = [['uniform grey', a1, 'DEGENERATE'], ['sea+sky, no subject', a2, 'NO_SUBJECT'],
    ['sea+sky WITH figure', a3, 'LIVE'], ['street, no subject', a4, 'NO_SUBJECT'],
    ['street WITH figure', a5, 'LIVE'], ['saturated noise', a6, 'SUBJECT_UNDECIDABLE']];
  let ok = true;
  for (const [name, png, want] of cases) {
    const r = liveness(png, null);
    const got = r.verdict;
    if (got !== want) ok = false;
    console.log(`${got === want ? 'ok  ' : 'FAIL'}  ${name.padEnd(22)} verdict=${got.padEnd(11)} want=${want.padEnd(11)} shadow_levels=${String(r.shadow_levels).padStart(4)} lc=${String(r.local_contrast_med).padStart(8)} subj_frac=${r.subject_frac} subj_rows=${r.subject_row_frac}`);
  }
  console.log(ok ? `\nself-test passed: all ${cases.length} arms behave, including the three that must not come back LIVE.`
    : '\nself-test FAILED — this instrument cannot tell an empty frame from a full one, which is the exact defect it exists to end.');
  process.exit(ok ? 0 : 1);
}

const dir = args.in ? path.resolve(String(args.in)) : null;
if (!dir || !fs.existsSync(dir)) { console.error('usage: frame-liveness.mjs --in <dir-of-pngs> [--manifest m.json] [--json out.json]'); process.exit(2); }

// Optional manifest supplying per-frame projected subject rows.
let boxes = new Map();
if (args.manifest && fs.existsSync(String(args.manifest))) {
  const man = JSON.parse(fs.readFileSync(String(args.manifest), 'utf8'));
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const file = o.file || o.frame || o.path;
    const top = o.head_top_px ?? o.subject_top_px ?? o.top_px;
    const bot = o.foot_bottom_px ?? o.subject_bottom_px ?? o.bottom_px;
    if (file && Number.isFinite(top) && Number.isFinite(bot)) {
      boxes.set(path.basename(String(file)), { top: Number(top), bottom: Number(bot) });
    }
    Object.values(o).forEach(walk);
  };
  walk(man);
}

const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
if (!files.length) { console.error(`frame-liveness: no PNGs in ${dir}`); process.exit(2); }
const rows = [];
for (const f of files) {
  let png;
  try { png = PNG.sync.read(fs.readFileSync(path.join(dir, f))); }
  catch (e) { rows.push({ file: f, verdict: 'UNREADABLE', error: String(e.message || e) }); continue; }
  const mb = boxes.get(f);
  const box = mb ? { x0: Math.round(png.width * 0.22), x1: Math.round(png.width * 0.78), y0: Math.max(0, Math.round(mb.top) - 4), y1: Math.min(png.height - 1, Math.round(mb.bottom) + 4) } : null;
  rows.push({ file: f, ...liveness(png, box) });
}
const counts = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
for (const r of rows) {
  console.log(`${(r.verdict || '?').padEnd(11)} ${r.file.padEnd(46)} shadow=${String(r.shadow_levels ?? '-').padStart(4)} lc=${String(r.local_contrast_med ?? '-').padStart(8)} subj=${String(r.subject_frac ?? '-').padStart(7)} rows=${String(r.subject_row_frac ?? '-').padStart(7)}`);
}
console.log(`\n${files.length} frames: ${JSON.stringify(counts)}`);
const bad = rows.filter((r) => r.verdict !== 'LIVE');
if (args.json) fs.writeFileSync(path.resolve(String(args.json)), `${JSON.stringify({ tool: 'frame-liveness', dir, thresholds: T, counts, frames: rows }, null, 2)}\n`);
if (bad.length) { console.error(`\nFAIL: ${bad.length} frame(s) are not usable evidence: ${bad.slice(0, 8).map((r) => `${r.file}=${r.verdict}`).join(', ')}${bad.length > 8 ? ' …' : ''}`); process.exit(1); }
console.log('\nOK: every frame is a real image and contains a subject.');
