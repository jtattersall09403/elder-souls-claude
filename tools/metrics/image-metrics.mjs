#!/usr/bin/env node
// image-metrics.mjs — objective image statistics for the visual-fidelity reference items.
// Pure JS (pngjs only, no native deps). Spec: corpus/80-methods/HARNESS.md §7.
// Consumers: corpus/70-visual/RI-* (fidelity side only; art direction is not scored here).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, log, EXIT, writeJson, sha256, quantile, mean, stdev } from '../lib/cli.mjs';

const USAGE = `
image-metrics.mjs — compute fidelity image metrics for one or many PNGs.

USAGE
  node tools/metrics/image-metrics.mjs --in <file.png|dir> [--out <metrics.json>] [--json]

OPTIONS
  --in <path>     PNG file, or a directory of PNGs (e.g. a run's shots/ dir)   (required)
  --out <path>    Output JSON (default: <dir>/image-metrics.json)
  --sky-rows <f>  Fraction of image height treated as sky for the gradient metric (default 0.4)
  --edge-thresh   Sobel magnitude threshold on 0..1 luminance (default 0.08)
  --json          Print the full result on stdout
  --help          This message

METRICS (per image)
  luminance      mean/stdev/entropy/percentiles, 64-bin histogram, clipped black+white %
  dynamic_range  p99.5 - p00.5 luminance, and the same in stops
  rms_contrast   global RMS contrast (Michelson-free) + mean 16x16 local RMS contrast
  saturation     HSV saturation mean/p50/p95, grey-pixel fraction, mean chroma
  edge_density   fraction of pixels above the Sobel threshold, mean |grad|, 3 thresholds
  fft_high_band  radial power spectrum on a 256x256 luminance crop: high-band energy
                 ratio (r>0.25 Nyquist), mid-band ratio, spectral slope
  flat_shading   flat-tile fraction, unique 15-bit colours, largest flat run, banding index
  sky_gradient   row-mean luminance profile of the sky band: monotonicity, smoothness
                 residual, banding steps, horizontal uniformity

All values are deterministic functions of the PNG bytes: same PNG in, same JSON out.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.in) usage(USAGE, EXIT.USAGE);

let PNG;
try { ({ PNG } = await import('pngjs')); }
catch (e) { die(EXIT.INTERNAL, "cannot import 'pngjs'. Run `npm install` in tools/.", { cause: e.message }); }

const inPath = path.resolve(String(args.in));
if (!fs.existsSync(inPath)) {
  die(EXIT.MISSING_GAME, `no such file or directory: ${inPath}\n` +
    '  Capture screenshots first:  node tools/harness/shoot.mjs');
}
const files = fs.statSync(inPath).isDirectory()
  ? fs.readdirSync(inPath).filter((f) => f.toLowerCase().endsWith('.png')).sort().map((f) => path.join(inPath, f))
  : [inPath];
if (!files.length) die(EXIT.MISSING_GAME, `no PNGs found in ${inPath}`);

const SKY_ROWS = Number(args['sky-rows'] || 0.4);
const EDGE_T = Number(args['edge-thresh'] || 0.08);

// ---------------------------------------------------------------- primitives
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function toLuma(png) {
  const { width: w, height: h, data } = png;
  const Y = new Float32Array(w * h);       // perceptual (gamma) luminance, 0..1
  const Ylin = new Float32Array(w * h);    // linear luminance, for dynamic range in stops
  const S = new Float32Array(w * h);       // HSV saturation
  const C = new Float32Array(w * h);       // chroma (max-min)
  for (let i = 0, p = 0; i < Y.length; i++, p += 4) {
    const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
    Y[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    Ylin[i] = 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[i] = mx - mn;
    S[i] = mx > 0 ? (mx - mn) / mx : 0;
  }
  return { Y, Ylin, S, C, w, h };
}

function histogram(Y, bins = 64) {
  const h = new Array(bins).fill(0);
  for (let i = 0; i < Y.length; i++) h[Math.min(bins - 1, Math.floor(Y[i] * bins))]++;
  return h;
}
function entropyBits(hist) {
  const n = hist.reduce((s, x) => s + x, 0);
  let e = 0;
  for (const c of hist) if (c > 0) { const p = c / n; e -= p * Math.log2(p); }
  return e;
}
/** percentile over a Float32Array without a full sort of the original */
function pct(arr, q) {
  const s = Float32Array.from(arr).sort();
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return s[i];
}

// ---------------------------------------------------------------- FFT
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
/** Box-resample a luminance plane to NxN (centre crop to square first). */
function resampleSquare(Y, w, h, N) {
  const side = Math.min(w, h);
  const ox = ((w - side) >> 1), oy = ((h - side) >> 1);
  const out = new Float32Array(N * N);
  const step = side / N;
  for (let y = 0; y < N; y++) {
    const y0 = oy + Math.floor(y * step), y1 = Math.max(y0 + 1, oy + Math.floor((y + 1) * step));
    for (let x = 0; x < N; x++) {
      const x0 = ox + Math.floor(x * step), x1 = Math.max(x0 + 1, ox + Math.floor((x + 1) * step));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += Y[yy * w + xx]; n++; }
      out[y * N + x] = n ? s / n : 0;
    }
  }
  return out;
}
function radialSpectrum(Y, w, h, N = 256) {
  const g = resampleSquare(Y, w, h, N);
  // Hann window to suppress edge-wrap energy that would fake high-frequency detail.
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  const re = new Float64Array(N * N), im = new Float64Array(N * N);
  const m = mean(Array.from(g));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) re[y * N + x] = (g[y * N + x] - m) * win[x] * win[y];
  const rowR = new Float64Array(N), rowI = new Float64Array(N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) { rowR[x] = re[y * N + x]; rowI[x] = im[y * N + x]; }
    fft(rowR, rowI);
    for (let x = 0; x < N; x++) { re[y * N + x] = rowR[x]; im[y * N + x] = rowI[x]; }
  }
  const colR = new Float64Array(N), colI = new Float64Array(N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { colR[y] = re[y * N + x]; colI[y] = im[y * N + x]; }
    fft(colR, colI);
    for (let y = 0; y < N; y++) { re[y * N + x] = colR[y]; im[y * N + x] = colI[y]; }
  }
  const nyq = N / 2;
  const bins = new Float64Array(nyq).fill(0), counts = new Float64Array(nyq).fill(0);
  let total = 0;
  for (let y = 0; y < N; y++) {
    const fy = y <= nyq ? y : y - N;
    for (let x = 0; x < N; x++) {
      const fx = x <= nyq ? x : x - N;
      const r = Math.round(Math.hypot(fx, fy));
      if (r === 0 || r >= nyq) continue;
      const p = re[y * N + x] ** 2 + im[y * N + x] ** 2;
      bins[r] += p; counts[r]++; total += p;
    }
  }
  const radial = Array.from(bins, (v, i) => (counts[i] ? v / counts[i] : 0));
  const band = (a, b) => {
    let s = 0;
    for (let r = Math.floor(a * nyq); r < Math.floor(b * nyq); r++) s += bins[r];
    return total ? s / total : 0;
  };
  // spectral slope: log-log linear fit of radial power over r in [4, nyq/2]
  const xs = [], ys = [];
  for (let r = 4; r < nyq / 2; r++) if (radial[r] > 0) { xs.push(Math.log(r)); ys.push(Math.log(radial[r])); }
  let slope = null;
  if (xs.length > 4) {
    const mx = mean(xs), my = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    slope = den ? num / den : null;
  }
  return {
    low_band_ratio: +band(0, 0.08).toFixed(6),
    mid_band_ratio: +band(0.08, 0.25).toFixed(6),
    high_band_ratio: +band(0.25, 1.0).toFixed(6),
    very_high_band_ratio: +band(0.5, 1.0).toFixed(6),
    spectral_slope: slope === null ? null : +slope.toFixed(4),
    n: N,
  };
}

// ---------------------------------------------------------------- metrics
function tiles(Y, w, h, T, fn) {
  const out = [];
  for (let ty = 0; ty + T <= h; ty += T) {
    for (let tx = 0; tx + T <= w; tx += T) {
      const v = [];
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) v.push(Y[(ty + y) * w + tx + x]);
      out.push(fn(v, tx, ty));
    }
  }
  return out;
}

function sobel(Y, w, h) {
  const mag = new Float32Array(w * h);
  let sum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -Y[i - w - 1] - 2 * Y[i - 1] - Y[i + w - 1] + Y[i - w + 1] + 2 * Y[i + 1] + Y[i + w + 1];
      const gy = -Y[i - w - 1] - 2 * Y[i - w] - Y[i - w + 1] + Y[i + w - 1] + 2 * Y[i + w] + Y[i + w + 1];
      const m = Math.hypot(gx, gy) / 4;
      mag[i] = m; sum += m;
    }
  }
  return { mag, meanMag: sum / (w * h) };
}

function analyse(file) {
  const buf = fs.readFileSync(file);
  const png = PNG.sync.read(buf);
  const { Y, Ylin, S, C, w, h } = toLuma(png);
  const N = w * h;

  // --- luminance / dynamic range
  const hist = histogram(Y, 64);
  const yMean = mean(Array.from(Y)), ySd = stdev(Array.from(Y));
  const p005 = pct(Y, 0.005), p995 = pct(Y, 0.995);
  const linLo = Math.max(pct(Ylin, 0.005), 1e-5), linHi = Math.max(pct(Ylin, 0.995), 1e-5);
  const clippedBlack = Array.from(Y).filter((v) => v <= 0.004).length / N;
  const clippedWhite = Array.from(Y).filter((v) => v >= 0.996).length / N;

  // --- local contrast
  const T = 16;
  const tileSd = tiles(Y, w, h, T, (v) => stdev(v));
  const tileMean = tiles(Y, w, h, T, (v) => mean(v));

  // --- edges
  const { mag, meanMag } = sobel(Y, w, h);
  const above = (t) => { let c = 0; for (let i = 0; i < mag.length; i++) if (mag[i] > t) c++; return c / N; };

  // --- flat shading / banding
  const flatTiles = tileSd.filter((s) => s < 0.004).length / (tileSd.length || 1);
  const nearFlatTiles = tileSd.filter((s) => s < 0.012).length / (tileSd.length || 1);
  const colours = new Set();
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    colours.add(((png.data[p] >> 3) << 10) | ((png.data[p + 1] >> 3) << 5) | (png.data[p + 2] >> 3));
  }
  // banding index: fraction of 1-pixel-wide luminance "steps" between otherwise flat rows
  let stepPixels = 0;
  for (let y = 1; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const a = Y[y * w + x], b = Y[(y - 1) * w + x], c2 = Y[y * w + x - 1];
      const d1 = Math.abs(a - b), d2 = Math.abs(a - c2);
      if (d1 > 0.002 && d1 < 0.012 && d2 < 0.0008) stepPixels++;
    }
  }

  // --- sky gradient (top band)
  const skyH = Math.max(4, Math.floor(h * SKY_ROWS));
  const rowMeans = [];
  const rowSds = [];
  for (let y = 0; y < skyH; y++) {
    const row = [];
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 512))) row.push(Y[y * w + x]);
    rowMeans.push(mean(row)); rowSds.push(stdev(row));
  }
  let mono = 0;
  for (let i = 1; i < rowMeans.length; i++) if (rowMeans[i] >= rowMeans[i - 1]) mono++;
  const monotonic = Math.max(mono, rowMeans.length - 1 - mono) / Math.max(1, rowMeans.length - 1);
  // smoothness: RMS of the discrete second derivative of the row-mean profile
  let d2sum = 0;
  for (let i = 1; i < rowMeans.length - 1; i++) d2sum += (rowMeans[i + 1] - 2 * rowMeans[i] + rowMeans[i - 1]) ** 2;
  const smoothResidual = Math.sqrt(d2sum / Math.max(1, rowMeans.length - 2));
  const distinctLevels = new Set(rowMeans.map((v) => Math.round(v * 255))).size;

  const satArr = Array.from(S);
  return {
    file: path.basename(file),
    path: file,
    sha256: sha256(buf),
    width: w, height: h, bytes: buf.length,
    luminance: {
      mean: +yMean.toFixed(5), stdev: +ySd.toFixed(5),
      p005: +p005.toFixed(5), p50: +pct(Y, 0.5).toFixed(5), p995: +p995.toFixed(5),
      histogram_entropy_bits: +entropyBits(hist).toFixed(4),
      histogram_64: hist,
      clipped_black_frac: +clippedBlack.toFixed(5),
      clipped_white_frac: +clippedWhite.toFixed(5),
      occupied_bins_frac: +(hist.filter((c) => c / N > 0.0005).length / hist.length).toFixed(4),
    },
    dynamic_range: {
      p995_minus_p005: +(p995 - p005).toFixed(5),
      stops: +(Math.log2(linHi / linLo)).toFixed(4),
    },
    rms_contrast: {
      global: +(yMean > 0 ? ySd / yMean : 0).toFixed(5),
      global_stdev: +ySd.toFixed(5),
      local_mean_16px: +mean(tileSd).toFixed(5),
      local_p95_16px: +quantile(tileSd, 0.95).toFixed(5),
      tile_mean_spread: +stdev(tileMean).toFixed(5),
      tiles: tileSd.length,
    },
    saturation: {
      mean: +mean(satArr).toFixed(5),
      p50: +quantile(satArr, 0.5).toFixed(5),
      p95: +quantile(satArr, 0.95).toFixed(5),
      grey_frac: +(satArr.filter((v) => v < 0.05).length / N).toFixed(5),
      oversat_frac: +(satArr.filter((v) => v > 0.85).length / N).toFixed(5),
      mean_chroma: +mean(Array.from(C)).toFixed(5),
    },
    edge_density: {
      threshold: EDGE_T,
      frac_above_threshold: +above(EDGE_T).toFixed(5),
      frac_above_0_04: +above(0.04).toFixed(5),
      frac_above_0_16: +above(0.16).toFixed(5),
      mean_gradient: +meanMag.toFixed(5),
      p95_gradient: +quantile(Array.from(mag), 0.95).toFixed(5),
    },
    fft: radialSpectrum(Y, w, h, 256),
    flat_shading: {
      flat_tile_frac: +flatTiles.toFixed(5),
      near_flat_tile_frac: +nearFlatTiles.toFixed(5),
      unique_colours_15bit: colours.size,
      unique_colours_per_kpx: +(colours.size / (N / 1000)).toFixed(4),
      banding_step_frac: +(stepPixels / N).toFixed(6),
      verdict_hint: flatTiles > 0.35 || colours.size < 4096 ? 'suspect-flat' : 'ok',
    },
    sky_gradient: {
      band_rows: skyH,
      row_mean_range: +(Math.max(...rowMeans) - Math.min(...rowMeans)).toFixed(5),
      monotonicity: +monotonic.toFixed(4),
      smoothness_residual: +smoothResidual.toFixed(7),
      distinct_row_levels: distinctLevels,
      distinct_levels_per_100_rows: +((distinctLevels / skyH) * 100).toFixed(3),
      horizontal_uniformity: +(1 - Math.min(1, mean(rowSds) * 10)).toFixed(4),
    },
  };
}

const results = [];
for (const f of files) {
  try { results.push(analyse(f)); log(`analysed ${path.basename(f)}`); }
  catch (e) { log(`FAILED ${f}: ${e.message}`); results.push({ file: path.basename(f), path: f, error: e.message }); }
}

const out = {
  schema: 'elder-souls/image-metrics@1',
  computed_at: new Date().toISOString(),
  input: inPath,
  params: { sky_rows: SKY_ROWS, edge_threshold: EDGE_T },
  images: results,
  aggregate: aggregate(results),
};

function aggregate(rs) {
  const ok = rs.filter((r) => !r.error);
  if (!ok.length) return null;
  const pick = (fn) => summarize(ok.map(fn).filter((v) => typeof v === 'number'));
  const summarize = (a) => a.length ? { n: a.length, mean: +mean(a).toFixed(5), min: +Math.min(...a).toFixed(5), max: +Math.max(...a).toFixed(5) } : { n: 0 };
  return {
    images: ok.length,
    dynamic_range_stops: pick((r) => r.dynamic_range.stops),
    local_contrast: pick((r) => r.rms_contrast.local_mean_16px),
    edge_density: pick((r) => r.edge_density.frac_above_threshold),
    fft_high_band: pick((r) => r.fft.high_band_ratio),
    saturation_mean: pick((r) => r.saturation.mean),
    flat_tile_frac: pick((r) => r.flat_shading.flat_tile_frac),
    unique_colours: pick((r) => r.flat_shading.unique_colours_15bit),
  };
}

const outPath = args.out ? path.resolve(String(args.out))
  : path.join(fs.statSync(inPath).isDirectory() ? inPath : path.dirname(inPath), 'image-metrics.json');
writeJson(outPath, out);
if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(outPath + '\n');
