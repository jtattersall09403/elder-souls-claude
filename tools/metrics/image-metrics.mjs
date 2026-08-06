#!/usr/bin/env node
// image-metrics.mjs — the RI-VIS03 fidelity battery, M1..M12.
//
// Spec:      corpus/70-visual/RI-VIS03-fidelity-image-metrics.md   (normative)
// Notes:     corpus/00-doctrine/METRICS-IMPLEMENTATION-01.md       (what is / isn't implemented)
// Side:      FIDELITY only (RI-VIS01 §B). Never cite this tool on the art-direction side.
// Deps:      pngjs, jpeg-js, @jsquash/avif, @jsquash/webp, pixelmatch — all pure JS or wasm.
//
// Schema v2 keeps every v1 top-level per-image block (so reference-metrics.json and
// tools/run-all.mjs keep working) and ADDS `metrics` (M1..M12) and `verdict` per image.
//
// Every statistic is emitted as {value, unit, profile, measurable, reason, band, pass}.
// `measurable: false` with a stated reason is a legitimate and required output — the tool
// never reports a number it did not actually compute, and RI-VIS03 §0c forbids a consumer
// from reading a skipped or unmeasurable metric as a pass.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, log, EXIT, writeJson, sha256, quantile, mean, stdev } from '../lib/cli.mjs';
import { decodeImage, isDecodable, SUPPORTED_EXT, writeMaskPng } from './lib/decode.mjs';
import * as V from './lib/vis03.mjs';
import { runBattery } from './lib/battery.mjs';

const USAGE = `
image-metrics.mjs — compute the RI-VIS03 fidelity battery (M1..M12) for one or many images.

USAGE
  node tools/metrics/image-metrics.mjs --in <file|dir> [--profile <p>] [--out <metrics.json>]

OPTIONS
  --in <path>        Image file, or a directory of images (recurses one level)     (required)
                     Formats: ${SUPPORTED_EXT.join(' ')}
  --out <path>       Output JSON (default: <dir>/image-metrics.json)
  --profile <name>   RI-VIS03 §0c profile. One of:
                       exterior_daylight | exterior_lowlight | interior_darkemissive
                       | character_closeup
                     RI-VIS03 says the harness refuses to run without one. If omitted, the
                     profile is INFERRED from the containing directory name and the verdict is
                     marked  "admissible": false  — the numbers are still real, the grade is not.
  --shot <name>      Shot name, for shot-level band overrides (e.g. xanmeer_vista for M10).
  --anti <path>      Anti-reference image (refs/anti/threejs-default.png). Enables M8's
                     AT DEFAULT check. Without it RI-VIS03 caps the verdict at 6/10.
  --sequence <dir>   Ordered frames for M11 (LOD pop) and M12 TemporalVar. Without it both are
                     reported unmeasurable — no single-frame proxy is faked.
  --stationary a,b   Two frames captured with the camera stationary, to build M11's
                     animated-region mask (wind/water). Without it M11 records
                     ANIMATED_MASK_ABSENT and over-counts.
  --displacements f  JSON file: array of per-pair camera displacement in metres, so M11 can
                     apply RI-VIS03's "< 0.07 m" gate.
  --water-mask <p>   WATER_MASK image (white = water) enabling M12.
  --masks-out <dir>  Write SKY_MASK / FG_MASK / FLAT (M8) PNGs — RI-VIS03 requires masks to be
                     emitted as artefacts alongside the metrics JSON.
  --compare <p>      Second image (or directory) to pixel-diff against --in, via pixelmatch.
  --no-legacy        Omit the v1 statistics blocks (smaller output).
  --edge-thresh <f>  Sobel magnitude threshold on the normalised 0..1 scale (default 0.08)
  --json             Print the full result on stdout
  --help             This message

WHAT CHANGED FROM v1 (all of it was a correctness bug, see METRICS-IMPLEMENTATION-01.md)
  * FG_MASK / SKY_MASK now exist. Every band RI-VIS03 says excludes sky, excludes sky.
  * M5's FFT runs on a NATIVE 1024x1024 crop, never a downscale. Images smaller than 1024^2
    report M5 unmeasurable instead of measuring the resampler.
  * M8's two HARD FAIL statistics (FS_score, LargestFlat) exist.
  * M3 is CIELAB, not HSV. M4 computes scale_ratio. M6, M9, M10, M11, M12 exist.
  * M1 reports dynamic range in stops.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.in) usage(USAGE, EXIT.USAGE);

const inPath = path.resolve(String(args.in));
if (!fs.existsSync(inPath)) die(EXIT.MISSING_GAME, `no such file or directory: ${inPath}`);

function listImages(p) {
  if (!fs.statSync(p).isDirectory()) return [p];
  const out = [];
  for (const e of fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) { for (const f of fs.readdirSync(full).sort()) if (isDecodable(f)) out.push(path.join(full, f)); }
    else if (isDecodable(full)) out.push(full);
  }
  return out;
}
const files = listImages(inPath);
if (!files.length) die(EXIT.MISSING_GAME, `no decodable images found in ${inPath} (looked for ${SUPPORTED_EXT.join(', ')})`);

const EDGE_T = Number(args['edge-thresh'] || 0.08);
const SKY_ROWS = Number(args['sky-rows'] || 0.4);
const WANT_LEGACY = !args['no-legacy'];

// ---------------------------------------------------------------- profile resolution
function resolveProfile(file) {
  if (args.profile && args.profile !== true) {
    if (!V.PROFILE_NAMES.includes(String(args.profile))) {
      die(EXIT.USAGE, `unknown --profile "${args.profile}" (RI-VIS03 §0c: ${V.PROFILE_NAMES.join(', ')})`);
    }
    return { profile: String(args.profile), source: 'declared' };
  }
  const dir = path.basename(path.dirname(file));
  if (V.PROFILE_NAMES.includes(dir)) return { profile: dir, source: 'inferred-from-directory' };
  if (/dusk|night|lowlight|evening/i.test(file)) return { profile: 'exterior_lowlight', source: 'inferred-from-filename' };
  if (/interior|indoor|rootway/i.test(file)) return { profile: 'interior_darkemissive', source: 'inferred-from-filename' };
  if (/closeup|character|combat/i.test(file)) return { profile: 'character_closeup', source: 'inferred-from-filename' };
  return { profile: 'exterior_daylight', source: 'default' };
}

// ---------------------------------------------------------------- optional inputs
let ANTI = null;
if (args.anti) {
  const p = path.resolve(String(args.anti));
  if (!fs.existsSync(p)) die(EXIT.MISSING_GAME, `--anti not found: ${p}`);
  const img = await decodeImage(p);
  const pl = V.prepare(img);
  const G = V.sobel(pl.Yp, pl.W, pl.H);
  const masks = V.computeMasks(pl, G);
  const m8 = V.M8(pl, masks);
  ANTI = { path: p, FS_score: m8.FS_score, LargestFlat: m8.LargestFlat, TotalFlat: m8.TotalFlat };
  log(`anti-reference ${path.basename(p)}: FS_score=${m8.FS_score === null ? 'n/a' : m8.FS_score.toFixed(5)} LargestFlat=${m8.LargestFlat.toFixed(5)}`);
}

let SEQUENCE = null, SEQ_META = null;
if (args.sequence) {
  const d = path.resolve(String(args.sequence));
  if (!fs.existsSync(d)) die(EXIT.MISSING_GAME, `--sequence not found: ${d}`);
  const sf = listImages(d);
  SEQUENCE = [];
  let W0 = null, H0 = null;
  for (const f of sf) {
    const img = await decodeImage(f);
    if (W0 === null) { W0 = img.width; H0 = img.height; }
    else if (img.width !== W0 || img.height !== H0) die(EXIT.MEASUREMENT_FAIL, `sequence frame ${path.basename(f)} is ${img.width}x${img.height}, expected ${W0}x${H0}`);
    SEQUENCE.push(V.prepare(img).Yp);
  }
  SEQ_META = { dir: d, frames: SEQUENCE.length, w: W0, h: H0 };
  log(`sequence: ${SEQUENCE.length} frames at ${W0}x${H0}`);
}

let ANIMATED = null;
if (args.stationary) {
  const [a, b] = String(args.stationary).split(',').map((s) => path.resolve(s.trim()));
  if (!a || !b || !fs.existsSync(a) || !fs.existsSync(b)) die(EXIT.MISSING_GAME, '--stationary needs two existing image paths: --stationary a.png,b.png');
  const ia = await decodeImage(a), ib = await decodeImage(b);
  const am = V.animatedMask(V.prepare(ia).Yp, V.prepare(ib).Yp, ia.width, ia.height);
  ANIMATED = am.empty ? null : am.mask;
  if (am.empty) log('ANIMATED_MASK_EMPTY — the stationary pair is identical everywhere. RI-VIS03 M11 §note: this fails RI-VIS04 §11 (no wind).');
  else log(`animated-region mask: ${(am.frac * 100).toFixed(2)}% of the frame`);
}

let DISPLACEMENTS = null;
if (args.displacements) DISPLACEMENTS = JSON.parse(fs.readFileSync(path.resolve(String(args.displacements)), 'utf8'));

let WATER = null;
if (args['water-mask']) {
  const p = path.resolve(String(args['water-mask']));
  if (!fs.existsSync(p)) die(EXIT.MISSING_GAME, `--water-mask not found: ${p}`);
  const img = await decodeImage(p);
  WATER = new Uint8Array(img.width * img.height);
  for (let i = 0, q = 0; i < WATER.length; i++, q += 4) WATER[i] = img.data[q] > 127 ? 1 : 0;
  log(`water mask: ${(WATER.reduce((a, b) => a + b, 0) / WATER.length * 100).toFixed(1)}% of the frame`);
}

// ---------------------------------------------------------------- legacy (schema v1) block
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const HBL = 65536;
function planeHist(arr) {
  const h = new Uint32Array(HBL);
  for (let i = 0; i < arr.length; i++) { let v = arr[i]; if (!(v >= 0)) v = 0; else if (v > 1) v = 1; h[(v * (HBL - 1)) | 0]++; }
  return h;
}
const histPct = (h, n, q) => { const t = Math.max(0, Math.min(n - 1, Math.round((n - 1) * q))); let acc = 0; for (let i = 0; i < HBL; i++) { acc += h[i]; if (acc > t) return i / (HBL - 1); } return 1; };
const histBelow = (h, t) => { let c = 0; const lim = Math.min(HBL - 1, Math.round(t * (HBL - 1))); for (let i = 0; i <= lim; i++) c += h[i]; return c; };
const histAbove = (h, t) => { let c = 0; const lim = Math.max(0, Math.round(t * (HBL - 1))); for (let i = lim; i < HBL; i++) c += h[i]; return c; };

/** v1 statistics, kept byte-for-byte compatible so reference-metrics.json stays comparable.
 *  DEPRECATED for judgement: `fft` here is the 256x256 box-downscale that made M5 measure the
 *  resampler. Use metrics.M5. Retained only for continuity with the pre-existing population. */
function legacyBlock(img, pl, G) {
  const { W: w, H: h, N, Yp: Y, Ylin, rgba } = pl;
  const S = new Float32Array(N), C = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const r = rgba[p] / 255, g = rgba[p + 1] / 255, b = rgba[p + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[i] = mx - mn; S[i] = mx > 0 ? (mx - mn) / mx : 0;
  }
  const hist = new Array(64).fill(0);
  for (let i = 0; i < N; i++) hist[Math.min(63, Math.floor(Y[i] * 64))]++;
  let ent = 0; for (const c of hist) if (c > 0) { const p = c / N; ent -= p * Math.log2(p); }
  const hY = planeHist(Y), hLin = planeHist(Ylin), hS = planeHist(S), hC = planeHist(C), hMag = planeHist(G);
  let s = 0, s2 = 0; for (let i = 0; i < N; i++) { s += Y[i]; s2 += Y[i] * Y[i]; }
  const yMean = s / N, ySd = Math.sqrt(Math.max(0, s2 / N - yMean * yMean));
  const p005 = histPct(hY, N, 0.005), p995 = histPct(hY, N, 0.995);
  const linLo = Math.max(histPct(hLin, N, 0.005), 1e-5), linHi = Math.max(histPct(hLin, N, 0.995), 1e-5);
  const tiles = V.tileStdevs(Y, null, w, h, 16, false);
  const tileSd = tiles.map((t) => t.sd), tileMean = tiles.map((t) => t.mean);
  const colours = new Set();
  for (let i = 0, p = 0; i < N; i++, p += 4) colours.add(((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3));
  let stepPixels = 0;
  for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) {
    const a = Y[y * w + x], b = Y[(y - 1) * w + x], c2 = Y[y * w + x - 1];
    const d1 = Math.abs(a - b), d2 = Math.abs(a - c2);
    if (d1 > 0.002 && d1 < 0.012 && d2 < 0.0008) stepPixels++;
  }
  const skyH = Math.max(4, Math.floor(h * SKY_ROWS));
  const rowMeans = [], rowSds = [];
  for (let y = 0; y < skyH; y++) {
    const row = [];
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 512))) row.push(Y[y * w + x]);
    rowMeans.push(mean(row)); rowSds.push(stdev(row));
  }
  let mono = 0; for (let i = 1; i < rowMeans.length; i++) if (rowMeans[i] >= rowMeans[i - 1]) mono++;
  let d2sum = 0; for (let i = 1; i < rowMeans.length - 1; i++) d2sum += (rowMeans[i + 1] - 2 * rowMeans[i] + rowMeans[i - 1]) ** 2;
  const flatTiles = tileSd.filter((v) => v < 0.004).length / (tileSd.length || 1);
  const nearFlat = tileSd.filter((v) => v < 0.012).length / (tileSd.length || 1);
  let gsum = 0; for (let i = 0; i < N; i++) gsum += G[i];
  return {
    luminance: {
      mean: +yMean.toFixed(5), stdev: +ySd.toFixed(5),
      p005: +p005.toFixed(5), p50: +histPct(hY, N, 0.5).toFixed(5), p995: +p995.toFixed(5),
      histogram_entropy_bits: +ent.toFixed(4), histogram_64: hist,
      clipped_black_frac: +(histBelow(hY, 0.004) / N).toFixed(5),
      clipped_white_frac: +(histAbove(hY, 0.996) / N).toFixed(5),
      occupied_bins_frac: +(hist.filter((c) => c / N > 0.0005).length / 64).toFixed(4),
    },
    dynamic_range: { p995_minus_p005: +(p995 - p005).toFixed(5), stops: +Math.log2(linHi / linLo).toFixed(4) },
    rms_contrast: {
      global: +(yMean > 0 ? ySd / yMean : 0).toFixed(5), global_stdev: +ySd.toFixed(5),
      local_mean_16px: +mean(tileSd).toFixed(5), local_p95_16px: +quantile(tileSd, 0.95).toFixed(5),
      tile_mean_spread: +stdev(tileMean).toFixed(5), tiles: tileSd.length,
    },
    saturation: {
      mean: +(Array.from(S).reduce((a, b) => a + b, 0) / N).toFixed(5),
      p50: +histPct(hS, N, 0.5).toFixed(5), p95: +histPct(hS, N, 0.95).toFixed(5),
      grey_frac: +(histBelow(hS, 0.05) / N).toFixed(5), oversat_frac: +(histAbove(hS, 0.85) / N).toFixed(5),
      mean_chroma: +(Array.from(C).reduce((a, b) => a + b, 0) / N).toFixed(5),
      note: 'HSV/RGB, NOT CIELAB. RI-VIS03 M3 is CIELAB C* — see metrics.M3.',
    },
    edge_density: {
      threshold: EDGE_T,
      frac_above_threshold: +(histAbove(hMag, EDGE_T) / N).toFixed(5),
      frac_above_0_04: +(histAbove(hMag, 0.04) / N).toFixed(5),
      frac_above_0_16: +(histAbove(hMag, 0.16) / N).toFixed(5),
      mean_gradient: +(gsum / N).toFixed(5), p95_gradient: +histPct(hMag, N, 0.95).toFixed(5),
      note: 'whole-frame, no FG_MASK. RI-VIS03 M4 excludes sky — see metrics.M4.',
    },
    flat_shading: {
      flat_tile_frac: +flatTiles.toFixed(5), near_flat_tile_frac: +nearFlat.toFixed(5),
      unique_colours_15bit: colours.size, unique_colours_per_kpx: +(colours.size / (N / 1000)).toFixed(4),
      banding_step_frac: +(stepPixels / N).toFixed(6),
      verdict_hint: flatTiles > 0.35 || colours.size < 4096 ? 'suspect-flat' : 'ok',
      note: 'NOT RI-VIS03 M8. M8 is FS_score + LargestFlat — see metrics.M8.',
    },
    sky_gradient: {
      band_rows: skyH,
      row_mean_range: +(Math.max(...rowMeans) - Math.min(...rowMeans)).toFixed(5),
      monotonicity: +(Math.max(mono, rowMeans.length - 1 - mono) / Math.max(1, rowMeans.length - 1)).toFixed(4),
      smoothness_residual: +Math.sqrt(d2sum / Math.max(1, rowMeans.length - 2)).toFixed(7),
      distinct_row_levels: new Set(rowMeans.map((v) => Math.round(v * 255))).size,
      distinct_levels_per_100_rows: +((new Set(rowMeans.map((v) => Math.round(v * 255))).size / skyH) * 100).toFixed(3),
      horizontal_uniformity: +(1 - Math.min(1, mean(rowSds) * 10)).toFixed(4),
      note: 'top 40% of rows, no SKY_MASK. RI-VIS03 M7 detects the sky — see metrics.M7.',
    },
    deprecated_fft_note: 'the v1 `fft` block box-downscaled the frame to 256x256 before transforming, which destroyed the band M5 exists to measure and made the statistic resolution-dependent. It is not computed any more. Use metrics.M5.',
  };
}

// ---------------------------------------------------------------- per-image run
async function analyse(file) {
  const img = await decodeImage(file);
  const { profile, source } = resolveProfile(file);
  const pl = V.prepare(img);
  const G = V.sobel(pl.Yp, pl.W, pl.H);
  const shot = args.shot ? String(args.shot) : path.basename(file).replace(/\.[^.]+$/, '');
  const seqOk = SEQUENCE && SEQ_META && SEQ_META.w === pl.W && SEQ_META.h === pl.H;
  const waterOk = WATER && WATER.length === pl.N;
  const out = runBattery(pl, {
    profile, shot, anti: ANTI,
    sequence: seqOk ? SEQUENCE : null,
    animatedMask: seqOk ? ANIMATED : null,
    displacements: seqOk ? DISPLACEMENTS : null,
    water: waterOk ? WATER : null,
  });
  if (SEQUENCE && !seqOk) log(`WARN ${path.basename(file)}: sequence is ${SEQ_META.w}x${SEQ_META.h}, image is ${pl.W}x${pl.H} — M11/M12 temporal not applied`);
  if (WATER && !waterOk) log(`WARN ${path.basename(file)}: water mask size mismatch — M12 not applied`);

  const rec = {
    file: path.basename(file), path: file, sha256: sha256(img.buffer),
    width: pl.W, height: pl.H, bytes: img.bytes, format: img.format,
    profile, profile_source: source,
    masks: {
      sky_frac: +out.masks.skyFrac.toFixed(6), fg_frac: +out.masks.fgFrac.toFixed(6),
      shadow_frac: +out.masks.shadowFrac.toFixed(6), lit_frac: +out.masks.litFrac.toFixed(6),
      method: 'SKY_MASK = largest 4-connected component, touching row 0, of {row < 0.45H AND Sobel G < 0.02 AND Yp > P60(Yp)}; FG_MASK = NOT SKY_MASK; SHADOW/LIT = FG below P25 / above P75 of Yp[FG]. Deterministic; RI-VIS03 M7 §detect.',
      sky_detect: out.masks.sky_detect,
    },
    metrics: out.metrics,
    verdict: {
      ...out.verdict,
      admissible: source === 'declared',
      admissibility_reason: source === 'declared' ? null
        : `profile was ${source}, not declared. RI-VIS03 §0c: the harness refuses to run without a declared profile and "profile laundering" is a named failure mode. The measured values are real; the GRADE is not admissible in a verdict.`,
    },
  };
  if (WANT_LEGACY) Object.assign(rec, legacyBlock(img, pl, G), { legacy_schema: 'elder-souls/image-metrics@1 (deprecated; superseded by `metrics`)' });

  if (args['masks-out']) {
    const md = path.resolve(String(args['masks-out']));
    fs.mkdirSync(md, { recursive: true });
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    await writeMaskPng(path.join(md, `${base}.sky.png`), pl.W, pl.H, out.masks.sky);
    await writeMaskPng(path.join(md, `${base}.fg.png`), pl.W, pl.H, out.masks.fg);
    await writeMaskPng(path.join(md, `${base}.shadow.png`), pl.W, pl.H, out.masks.shadow);
    rec.mask_artifacts = [`${base}.sky.png`, `${base}.fg.png`, `${base}.shadow.png`];
  }
  return rec;
}

const results = [];
for (const f of files) {
  const t0 = Date.now();
  try { results.push(await analyse(f)); log(`analysed ${path.basename(f)} (${Date.now() - t0} ms)`); }
  catch (e) { log(`FAILED ${f}: ${e.message}`); results.push({ file: path.basename(f), path: f, error: e.message }); }
}

// ---------------------------------------------------------------- optional pixel diff
let diffs = null;
if (args.compare) {
  const cmpPath = path.resolve(String(args.compare));
  if (!fs.existsSync(cmpPath)) die(EXIT.MISSING_GAME, `--compare target not found: ${cmpPath}`);
  let pixelmatch;
  try { pixelmatch = (await import('pixelmatch')).default; }
  catch (e) { die(EXIT.INTERNAL, "cannot import 'pixelmatch'. Run `npm install` in tools/.", { cause: e.message }); }
  const { PNG } = await import('pngjs');
  const cmpIsDir = fs.statSync(cmpPath).isDirectory();
  diffs = [];
  for (const f of files) {
    const other = cmpIsDir ? path.join(cmpPath, path.basename(f)) : cmpPath;
    if (!fs.existsSync(other)) { diffs.push({ file: path.basename(f), error: 'no counterpart at ' + other }); continue; }
    try {
      const a = await decodeImage(f), b = await decodeImage(other);
      if (a.width !== b.width || a.height !== b.height) { diffs.push({ file: path.basename(f), error: `size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}` }); continue; }
      const outPng = new PNG({ width: a.width, height: a.height });
      const n = pixelmatch(a.data, b.data, outPng.data, a.width, a.height, { threshold: 0.1 });
      const diffFile = f.replace(/\.[^.]+$/i, '-diff.png');
      if (n > 0) fs.writeFileSync(diffFile, PNG.sync.write(outPng));
      diffs.push({
        file: path.basename(f), against: other, differing_pixels: n,
        differing_frac: +(n / (a.width * a.height)).toFixed(7), identical: n === 0,
        sha_equal: sha256(a.buffer) === sha256(b.buffer), diff_image: n > 0 ? diffFile : null,
      });
      log(`diff ${path.basename(f)}: ${n} px differing`);
    } catch (e) { diffs.push({ file: path.basename(f), error: e.message }); }
  }
}

// ---------------------------------------------------------------- aggregate + write
function summarize(a) {
  return a.length
    ? { n: a.length, mean: +mean(a).toFixed(5), p10: +quantile(a, 0.10).toFixed(5), p50: +quantile(a, 0.50).toFixed(5), p90: +quantile(a, 0.90).toFixed(5), min: +Math.min(...a).toFixed(5), max: +Math.max(...a).toFixed(5) }
    : { n: 0 };
}
function aggregate(rs) {
  const ok = rs.filter((r) => !r.error);
  if (!ok.length) return null;
  const stat = (mId, key) => summarize(ok.map((r) => r.metrics?.[mId]?.stats?.[key]).filter((s) => s && s.measurable).map((s) => s.value));
  const legacyPick = (fn) => summarize(ok.map(fn).filter((v) => typeof v === 'number'));
  return {
    images: ok.length,
    // RI-VIS03 statistics. These are the ones a band amendment must be argued from.
    ri_vis03: {
      'M1.DR': stat('M1', 'DR'), 'M1.mean_Yp': stat('M1', 'mean_Yp'), 'M1.stops': stat('M1', 'stops'),
      'M1.blown': stat('M1', 'blown'), 'M1.crushed': stat('M1', 'crushed'), 'M1.occupancy': stat('M1', 'occupancy'),
      'M2.C_global': stat('M2', 'C_global'), 'M2.C_local_med': stat('M2', 'C_local_med'), 'M2.C_local_p10': stat('M2', 'C_local_p10'),
      'M3.meanC': stat('M3', 'meanC'), 'M3.p95C': stat('M3', 'p95C'), 'M3.H_hue': stat('M3', 'H_hue'), 'M3.chroma_frac': stat('M3', 'chroma_frac'),
      'M4.ED_1': stat('M4', 'ED_1'), 'M4.scale_ratio': stat('M4', 'scale_ratio'),
      'M5.HFR': stat('M5', 'HFR'), 'M5.NYQ_ratio': stat('M5', 'NYQ_ratio'), 'M5.alpha': stat('M5', 'alpha'),
      'M6.retention': stat('M6', 'retention'), 'M6.hue_offset': stat('M6', 'hue_offset'), 'M6.C_shadow': stat('M6', 'C_shadow'),
      'M7.dY_sky': stat('M7', 'dY_sky'), 'M7.dC_sky': stat('M7', 'dC_sky'), 'M7.dH_sky': stat('M7', 'dH_sky'), 'M7.BI': stat('M7', 'BI'), 'M7.sky_noise': stat('M7', 'sky_noise'),
      'M8.FS_score': stat('M8', 'FS_score'), 'M8.LargestFlat': stat('M8', 'LargestFlat'), 'M8.TotalFlat': stat('M8', 'TotalFlat'),
      'M9.ClipFrac': stat('M9', 'ClipFrac'), 'M9.ShoulderRatio': stat('M9', 'ShoulderRatio'), 'M9.HighlightDesat': stat('M9', 'HighlightDesat'), 'M9.BloomHalo': stat('M9', 'BloomHalo'), 'M9.VeilIndex': stat('M9', 'VeilIndex'),
      'M10.R_aerial': stat('M10', 'R_aerial'), 'M10.dC_depth': stat('M10', 'dC_depth'),
      sky_frac: summarize(ok.map((r) => r.masks?.sky_frac).filter((v) => typeof v === 'number')),
    },
    unmeasurable_counts: ok.reduce((acc, r) => { for (const k of r.verdict?.unmeasurable || []) acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
    skipped_counts: ok.reduce((acc, r) => { for (const k of r.verdict?.skipped || []) acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
    score: summarize(ok.map((r) => r.verdict?.score).filter((v) => typeof v === 'number')),
    // v1 keys, retained
    dynamic_range_stops: legacyPick((r) => r.dynamic_range?.stops),
    local_contrast: legacyPick((r) => r.rms_contrast?.local_mean_16px),
    edge_density: legacyPick((r) => r.edge_density?.frac_above_threshold),
    saturation_mean: legacyPick((r) => r.saturation?.mean),
    flat_tile_frac: legacyPick((r) => r.flat_shading?.flat_tile_frac),
    unique_colours: legacyPick((r) => r.flat_shading?.unique_colours_15bit),
  };
}

const out = {
  schema: 'elder-souls/image-metrics@2',
  spec: 'corpus/70-visual/RI-VIS03-fidelity-image-metrics.md',
  side: 'FIDELITY (RI-VIS01 §B). Not admissible on the art-direction side.',
  computed_at: new Date().toISOString(),
  input: inPath,
  params: {
    edge_threshold: EDGE_T, sky_rows_legacy: SKY_ROWS,
    profile: args.profile && args.profile !== true ? String(args.profile) : null,
    anti: ANTI ? { path: ANTI.path, FS_score: ANTI.FS_score, LargestFlat: ANTI.LargestFlat } : null,
    sequence: SEQ_META, water_mask: args['water-mask'] || null,
  },
  images: results,
  aggregate: aggregate(results),
  ...(diffs ? { diff: diffs } : {}),
};

const outPath = args.out ? path.resolve(String(args.out))
  : path.join(fs.statSync(inPath).isDirectory() ? inPath : path.dirname(inPath), 'image-metrics.json');
writeJson(outPath, out);
if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(outPath + '\n');
