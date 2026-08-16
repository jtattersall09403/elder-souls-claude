#!/usr/bin/env node
/**
 * f7-r5-offline.mjs — F7 ROUND 5. TWO MEASUREMENTS THAT NEED NO BROWSER.
 *
 * WHY OFFLINE. The box has been at or over its contention ceiling for a night and five of round 4's
 * runs were killed by their own timeout. Both of these read PNGs that are already banked, so they
 * cost nothing on the ceiling and they can be re-run by a critic in seconds.
 *
 *  1. `--mode presence` — RE-DERIVES the r4 critic's `presence` measure from round 4's own banked
 *     frames, in my code, without importing its tool. presence = (L[arm] - L[hidden]) / (L[pin] -
 *     L[hidden]) over the pinned mask: 1.0 means "as much visible water as the baseline arm", 0.0
 *     means "the same picture as the frame with all 93 water meshes hidden". Every artifact
 *     directory in this piece has carried a `--water-hidden` frame since round 2 and no round scored
 *     it. I am checking the claim that it is threshold-independent BEFORE I build a round on it.
 *
 *  2. `--mode stipple` — measures the dither stipple four critics have now named and none has
 *     written up, so that `RI-VIS12` can be written from a number instead of from an adjective. The
 *     estimator is deliberately dumb and reproducible: over the water mask, the mean absolute
 *     luma difference between horizontally ADJACENT pixels and between pixels TWO apart. A smooth
 *     surface has adj ~ 2-apart; a checker/ordered-dither pattern alternates every pixel, so its
 *     adjacent difference is large while its 2-apart difference collapses. The ratio is scale-free,
 *     so it does not care how bright the water is — which matters here, because every arm in this
 *     piece changes the brightness.
 *
 *   node tools/visual/f7-r5-offline.mjs --mode presence --dir <artifact dir> [--dir ...]
 *   node tools/visual/f7-r5-offline.mjs --mode stipple  --dir <artifact dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {}; const dirs = [];
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  const v = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
  if (k === 'dir') dirs.push(String(v)); else args[k] = v;
}
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const MODE = String(args.mode || 'presence');
const THRESHOLDS = String(args.thresholds || '4,6,10,16').split(',').map(Number);

const read = (f) => PNG.sync.read(fs.readFileSync(f));
function luma(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return y;
}
function maskFrom(a, b, thr) {
  const N = a.width * a.height, m = new Uint8Array(N); let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]);
    if (d > thr) { m[i] = 1; n++; }
  }
  return { m, n };
}
const meanOver = (y, m) => { let s = 0, n = 0; for (let i = 0; i < m.length; i++) if (m[i]) { s += y[i]; n++; } return n ? s / n : null; };

/* ---------------------------------------------------------------- presence ------------------- */
function presenceForDir(dir) {
  const fdir = path.join(dir, 'frames');
  if (!fs.existsSync(fdir)) return { dir, error: 'no frames/ directory' };
  const files = fs.readdirSync(fdir).filter((f) => f.endsWith('.png'));
  const poses = new Set(files.map((f) => f.split('--')[0]));
  const out = { dir: path.relative(REPO, dir), poses: {} };
  for (const pose of poses) {
    const hidden = files.find((f) => f === `${pose}--water-hidden.png`);
    const pin = files.find((f) => f.startsWith(`${pose}--PIN-`));
    if (!hidden || !pin) { out.poses[pose] = { skipped: 'no water-hidden or no PIN frame' }; continue; }
    const pH = read(path.join(fdir, hidden)), pP = read(path.join(fdir, pin));
    const yH = luma(pH), yP = luma(pP);
    const rec = { pin_frame: pin, hidden_frame: hidden, by_threshold: {} };
    for (const thr of THRESHOLDS) {
      const { m, n } = maskFrom(pP, pH, thr);
      const LH = meanOver(yH, m), LP = meanOver(yP, m);
      const denom = LP - LH;
      const rows = {};
      for (const f of files) {
        if (!f.startsWith(`${pose}--`) || f === hidden) continue;
        const arm = f.slice(pose.length + 2, -4).replace(/-o\d+$/, '');
        const y = luma(read(path.join(fdir, f)));
        const L = meanOver(y, m);
        rows[arm] = {
          mean_luma: +L.toFixed(3),
          presence_pct: Math.abs(denom) < 1e-6 ? null : +(100 * (L - LH) / denom).toFixed(2),
        };
      }
      rec.by_threshold[thr] = { mask_px: n, L_hidden: +LH.toFixed(3), L_pin: +LP.toFixed(3), denominator: +denom.toFixed(3), arms: rows };
    }
    // Is presence threshold-independent? Report the spread of each arm's presence across thresholds.
    const arms = new Set(); for (const t of THRESHOLDS) for (const a of Object.keys(rec.by_threshold[t].arms)) arms.add(a);
    rec.threshold_independence = Object.fromEntries([...arms].map((a) => {
      const vs = THRESHOLDS.map((t) => rec.by_threshold[t].arms[a] && rec.by_threshold[t].arms[a].presence_pct).filter((v) => typeof v === 'number');
      return [a, { values: vs, spread_pp: vs.length ? +(Math.max(...vs) - Math.min(...vs)).toFixed(3) : null }];
    }));
    out.poses[pose] = rec;
  }
  return out;
}

/* ---------------------------------------------------------------- stipple -------------------- */
/** adjacent vs two-apart mean |dY| over the mask, restricted to pairs both inside the mask. */
function stippleFor(png, m) {
  const y = luma(png), W = png.width, H = png.height;
  let a = 0, na = 0, b = 0, nb = 0, va = 0, vb = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W - 2; c++) {
    const i = r * W + c;
    if (m[i] && m[i + 1]) { const d = Math.abs(y[i] - y[i + 1]); a += d; va += d * d; na++; }
    if (m[i] && m[i + 2]) { const d = Math.abs(y[i] - y[i + 2]); b += d; vb += d * d; nb++; }
  }
  if (!na || !nb) return null;
  const adj = a / na, two = b / nb;
  // THE DECISIVE TEST, AND IT IS THE ONE THAT SEPARATES A DITHER FROM EVERYTHING ELSE.
  // An ORDERED dither (Bayer, and the 4x4 matrix three.js's `dithering` chunk uses) is a FIXED
  // function of screen position: every pixel at the same (x%4, y%4) phase gets the same offset. So
  // bucket the masked pixels by that phase and take each bucket's mean. Under an ordered dither the
  // sixteen means separate by a systematic amount. Under noise, aliasing, geometric detail or a
  // ripple normal — none of which know where the pixel grid is — the sixteen means agree to within
  // sampling error, however rough the surface looks. `phase_spread_lsb` is that separation in 8-bit
  // levels; `parity_contrast_lsb` is the same thing for the 2x2 checker specifically.
  const ph = new Float64Array(16), pn = new Float64Array(16);
  let e = 0, ne = 0, o = 0, no = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c; if (!m[i]) continue;
    const k = (r % 4) * 4 + (c % 4); ph[k] += y[i]; pn[k]++;
    if (((r + c) & 1) === 0) { e += y[i]; ne++; } else { o += y[i]; no++; }
  }
  const means = [], counts = [];
  for (let k = 0; k < 16; k++) { counts.push(pn[k]); means.push(pn[k] ? ph[k] / pn[k] : null); }
  const ok = means.filter((v) => v !== null);
  return {
    pairs_adjacent: na, pairs_two_apart: nb,
    mean_abs_dY_adjacent: +adj.toFixed(4),
    mean_abs_dY_two_apart: +two.toFixed(4),
    // A smooth gradient's difference GROWS with separation (ratio < 1). An every-other-pixel
    // pattern's collapses (ratio > 1). Scale-free, but it does NOT distinguish a dither from
    // aliasing — the phase test below is what does that.
    stipple_ratio: +(adj / two).toFixed(4),
    rms_dY_adjacent: +Math.sqrt(va / na).toFixed(4),
    phase4x4_means: means.map((v) => (v === null ? null : +v.toFixed(4))),
    phase4x4_min_bucket_px: Math.min(...counts),
    phase_spread_lsb: ok.length ? +(Math.max(...ok) - Math.min(...ok)).toFixed(4) : null,
    parity_contrast_lsb: (ne && no) ? +Math.abs(e / ne - o / no).toFixed(4) : null,
  };
}
function stippleForDir(dir) {
  const fdir = path.join(dir, 'frames');
  const files = fs.readdirSync(fdir).filter((f) => f.endsWith('.png'));
  const poses = new Set(files.map((f) => f.split('--')[0]));
  const out = { dir: path.relative(REPO, dir), poses: {} };
  for (const pose of poses) {
    const hidden = files.find((f) => f === `${pose}--water-hidden.png`);
    const pin = files.find((f) => f.startsWith(`${pose}--PIN-`));
    if (!hidden || !pin) continue;
    const pH = read(path.join(fdir, hidden)), pP = read(path.join(fdir, pin));
    const { m } = maskFrom(pP, pH, 10);
    // the LAND control: pixels the water-hidden frame agrees with, i.e. no water anywhere near.
    const land = new Uint8Array(m.length); let nl = 0;
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      const d = Math.abs(pP.data[p] - pH.data[p]) + Math.abs(pP.data[p + 1] - pH.data[p + 1]) + Math.abs(pP.data[p + 2] - pH.data[p + 2]);
      if (d <= 2) { land[i] = 1; nl++; }
    }
    const rec = { arms: {}, land_control_px: nl };
    for (const f of files) {
      if (!f.startsWith(`${pose}--`)) continue;
      const arm = f.slice(pose.length + 2, -4).replace(/-o\d+$/, '');
      if (/probe-shoreT/.test(arm)) continue;      // painted field, not a picture of water
      const png = read(path.join(fdir, f));
      rec.arms[arm] = { water: stippleFor(png, m), land: stippleFor(png, land) };
    }
    out.poses[pose] = rec;
  }
  return out;
}

/* ---------------------------------------------------------------- temporal ------------------- */
/** `RI-VIS03` M12 `TemporalVar`, computed from BANKED FRAMES rather than inside a browser run.
 *
 * WHY OFFLINE. The in-browser motion run attaches its results to the output only after every arm
 * finishes, so a run killed by contention leaves its numbers in a console log and not in the
 * artifact — HAZARDS §18's shape. The frames themselves are banked frame by frame, so deriving the
 * statistic from them makes it reproducible by anyone with the directory and independent of whether
 * the run survived. (The in-browser bug is fixed too; this is the belt as well as the braces.)
 *
 * AND IT ADDS THE CONTROL THE SPEC'S OWN DEFINITION CANNOT SEE. M12 defines `TemporalVar` as the
 * stddev over the sequence of the MEAN of Yp inside the water mask. A mean is insensitive to
 * motion that moves brightness around without changing the total — ripples travelling across a
 * surface can leave it almost constant. So this also reports `per_pixel_temporal_energy`: the mean
 * over the sequence of the mean |Yp(t) - Yp(t-1)| PER PIXEL inside the mask, and the same over a
 * land control. A water surface that is genuinely frozen reads ~0 on both; a water surface that
 * ripples while its mean holds still reads low on `TemporalVar` and high here, and the two together
 * say which failure it is. */
function temporalForDir(dir) {
  const fdir = path.join(dir, 'frames');
  const files = fs.readdirSync(fdir).filter((f) => /^motion-temporal--/.test(f) && f.endsWith('.png'));
  const arms = [...new Set(files.map((f) => f.replace(/^motion-temporal--/, '').replace(/--f\d+\.png$/, '')))];
  const out = { dir: path.relative(REPO, dir), arms: {} };
  for (const arm of arms) {
    const seq = files.filter((f) => f.startsWith(`motion-temporal--${arm}--f`)).sort();
    const hiddenPath = path.join(fdir, `motion-hidden--${arm}.png`);
    if (!fs.existsSync(hiddenPath) || seq.length < 2) { out.arms[arm] = { skipped: 'need a motion-hidden frame and >= 2 temporal frames' }; continue; }
    const hid = read(hiddenPath), first = read(path.join(fdir, seq[0]));
    const { m, n } = maskFrom(first, hid, 10);
    // land control: pixels the water-hidden frame agrees with, i.e. no water involved.
    const land = new Uint8Array(m.length); let nl = 0;
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      const d = Math.abs(first.data[p] - hid.data[p]) + Math.abs(first.data[p + 1] - hid.data[p + 1]) + Math.abs(first.data[p + 2] - hid.data[p + 2]);
      if (d <= 2) { land[i] = 1; nl++; }
    }
    const series = [], landSeries = [];
    let prev = null, prevL = null, ppW = 0, ppL = 0, steps = 0;
    for (const f of seq) {
      const png = read(path.join(fdir, f));
      // Yp is the sRGB-encoded display luma in 0..1, per RI-VIS03 §0.
      const y = luma(png);
      const yn = new Float32Array(y.length); for (let i = 0; i < y.length; i++) yn[i] = y[i] / 255;
      series.push(meanOver(yn, m)); landSeries.push(meanOver(yn, land));
      if (prev) {
        let sw = 0, cw = 0, sl = 0, cl = 0;
        for (let i = 0; i < m.length; i++) {
          if (m[i]) { sw += Math.abs(yn[i] - prev[i]); cw++; }
          if (land[i]) { sl += Math.abs(yn[i] - prevL[i]); cl++; }
        }
        ppW += cw ? sw / cw : 0; ppL += cl ? sl / cl : 0; steps++;
      }
      prev = yn; prevL = yn;
    }
    const sd = (a) => { const mu = a.reduce((x, y2) => x + y2, 0) / a.length; return Math.sqrt(a.reduce((x, y2) => x + (y2 - mu) ** 2, 0) / a.length); };
    const tv = sd(series);
    out.arms[arm] = {
      frames: seq.length, water_mask_px: n, land_control_px: nl,
      TemporalVar: +tv.toFixed(6), band: 0.002, hard_fail_below: 0.0005,
      verdict: tv >= 0.002 ? 'PASS' : (tv < 0.0005 ? 'HARD FAIL — water is static' : 'FAIL (between the band and the hard-fail floor)'),
      TemporalVar_land_control: +sd(landSeries).toFixed(6),
      per_pixel_temporal_energy_water: +(ppW / steps).toFixed(6),
      per_pixel_temporal_energy_land: +(ppL / steps).toFixed(6),
      mean_Yp_first: +series[0].toFixed(6), mean_Yp_last: +series[series.length - 1].toFixed(6),
      mean_Yp_range: +(Math.max(...series) - Math.min(...series)).toFixed(6),
      how_to_read: 'TemporalVar is RI-VIS03 M12 as written — the stddev of the MEAN. The per-pixel rows are the supplement it cannot see: if per_pixel_temporal_energy_water is also ~0 the surface is genuinely frozen; if it is large while TemporalVar is small, the water moves but its mean does not, and the metric is blind rather than the water static. The land control says how much of either is the scene rather than the water.',
    };
  }
  return out;
}

const results = dirs.map((d) => (MODE === 'stipple' ? stippleForDir(path.resolve(REPO, d))
  : MODE === 'temporal' ? temporalForDir(path.resolve(REPO, d))
    : presenceForDir(path.resolve(REPO, d))));
const payload = { tool: 'f7-r5-offline', mode: MODE, generated: new Date().toISOString(), thresholds: THRESHOLDS, results };
if (args.out) { fs.mkdirSync(path.dirname(path.resolve(REPO, String(args.out))), { recursive: true }); fs.writeFileSync(path.resolve(REPO, String(args.out)), JSON.stringify(payload, null, 2)); }
console.log(JSON.stringify(payload, null, 2));
