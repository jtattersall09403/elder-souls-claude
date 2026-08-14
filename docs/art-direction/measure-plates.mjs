#!/usr/bin/env node
/**
 * measure-plates.mjs — W1-30K. Read the reference plates the corpus already holds and emit one
 * row of statistics per plate. Nothing here is a target; this file is the *measurement* layer.
 * `build-board.mjs` turns these statistics into the board, and every number in the board traces
 * back to a row emitted here.
 *
 * WHAT THIS IS ALLOWED TO MEASURE, AND WHY EACH STATISTIC IS ON THE SIDE IT IS ON
 * -----------------------------------------------------------------------------
 * `RI-VIS09` §3.3 grants the Morrowind set exactly four uses — palette, silhouette, built form,
 * flora/creature design language — and forbids texture resolution, texel density, anti-aliasing
 * and sharpness. `RI-VIS01` §A routes each property to exactly one side. The two rules together
 * decide, for every statistic below, which half of the board may read it:
 *
 *   ART      (Morrowind + anti-generic only)   P01 palette, P02 silhouette, P05 composition,
 *                                              P07 flora design, P08 grading intent
 *   FIDELITY (modern only)                     F03 lighting model, F06 atmospherics, F09 post
 *
 * Two statistics the W1-30K plan asked for on the ART side are, on RI-VIS01's own table, FIDELITY
 * properties, and they are computed here from `refs/modern/` and nowhere else:
 *   - key-to-fill ratio            -> F03 (lighting model). A 2002 screenshot may not set it.
 *   - fog density / horizon range  -> F06 (atmospheric scattering). Same.
 * The ART half keeps only the part of those that is genuinely P08: the *tint direction* of the
 * far field, which is a grading decision, not a scattering model.
 *
 * No statistic computed here touches sharpness, texel density, resolution or AA on any Morrowind
 * plate. `--assert-grant` re-states that at run time and is checked by validate-board.mjs.
 *
 * Decode: ffmpeg to raw rgb24, the same route `tools/world/region-dispersion.mjs` already uses,
 * so AVIF and JPEG are read by one decoder and the numbers are comparable across both.
 *
 * Usage: node docs/art-direction/measure-plates.mjs [--out docs/art-direction/plate-metrics.json]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const REFS = join(ROOT, 'corpus/70-visual/refs');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(HERE, 'plate-metrics.json');

// ---------------------------------------------------------------------------------------------
// decode
// ---------------------------------------------------------------------------------------------
/** Decode to rgb24 at a fixed width, aspect preserved. Returns {w,h,px}. */
function decode(absPath, width = 256) {
  const px = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', absPath,
    '-vf', `scale=${width}:-2`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { maxBuffer: 1 << 28 });
  const w = width, h = px.length / 3 / w;
  if (!Number.isInteger(h)) throw new Error(`non-integer height decoding ${absPath}`);
  return { w, h, px };
}

// ---------------------------------------------------------------------------------------------
// colour
// ---------------------------------------------------------------------------------------------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);

/** sRGB byte triple -> CIELAB (D65). */
function lab(r8, g8, b8) {
  const r = srgbToLinear(r8 / 255), g = srgbToLinear(g8 / 255), b = srgbToLinear(b8 / 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz), Y];
}

const pct = (sorted, p) => {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
};
const r3 = (x) => (x === null || !Number.isFinite(x) ? null : +x.toFixed(3));

// ---------------------------------------------------------------------------------------------
// per-plate statistics
// ---------------------------------------------------------------------------------------------
/**
 * @param {object} img decoded image
 * @param {number} cropBottom fraction of frame height to drop before measuring (HUD exclusion)
 */
function plateStats(img, cropBottom) {
  const { w, h, px } = img;
  const hUse = Math.max(8, Math.floor(h * (1 - cropBottom)));
  const L = new Float64Array(w * hUse), A = new Float64Array(w * hUse), B = new Float64Array(w * hUse);
  const Ylin = new Float64Array(w * hUse);
  for (let y = 0; y < hUse; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3, k = y * w + x;
      const [l, a, b, Y] = lab(px[i], px[i + 1], px[i + 2]);
      L[k] = l; A[k] = a; B[k] = b; Ylin[k] = Y;
    }
  }
  const n = w * hUse;

  // -- palette: lightness, chroma, hue ---------------------------------------------------------
  const Ls = Array.from(L).sort((a, b) => a - b);
  const C = new Float64Array(n);
  for (let k = 0; k < n; k++) C[k] = Math.hypot(A[k], B[k]);
  const Cs = Array.from(C).sort((a, b) => a - b);
  let hiC = 0;
  for (let k = 0; k < n; k++) if (C[k] > 30) hiC++;

  // chroma-weighted circular hue mean and concentration
  let sx = 0, sy = 0, sw = 0, warm = 0, warmW = 0;
  for (let k = 0; k < n; k++) {
    const c = C[k];
    if (c < 2) continue;                     // achromatic pixels carry no hue
    const th = Math.atan2(B[k], A[k]);
    sx += c * Math.cos(th); sy += c * Math.sin(th); sw += c;
    let deg = (th * 180) / Math.PI; if (deg < 0) deg += 360;
    warmW += c;
    if (deg <= 110 || deg >= 330) warm += c;  // warm lobe: red -> yellow-green
  }
  const hueMean = sw ? ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360 : null;
  const hueR = sw ? Math.hypot(sx, sy) / sw : null;   // 0 = every hue, 1 = one hue

  // -- palette breadth: occupied bins of a coarse CIELAB cube ----------------------------------
  // L in 10 bands of 10, a and b in bands of 20 over [-100,100]. A bin counts if it holds >= 1%
  // of measured pixels. This is "how many distinct colours does this frame actually use", which
  // is the statistic behind the saturation-ceiling and palette-breadth rows in ART.md.
  const bins = new Map();
  for (let k = 0; k < n; k++) {
    const bl = Math.min(9, Math.max(0, Math.floor(L[k] / 10)));
    const ba = Math.min(9, Math.max(0, Math.floor((A[k] + 100) / 20)));
    const bb = Math.min(9, Math.max(0, Math.floor((B[k] + 100) / 20)));
    const key = bl * 100 + ba * 10 + bb;
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  let paletteBins = 0, top = [];
  for (const [key, cnt] of bins) if (cnt / n >= 0.01) { paletteBins++; top.push([key, cnt]); }
  top.sort((a, b) => b[1] - a[1]);
  // the four heaviest bins, as their bin-centre sRGB — the frame's working swatch set
  const swatches = top.slice(0, 4).map(([key, cnt]) => {
    const bl = Math.floor(key / 100), ba = Math.floor((key % 100) / 10), bb = key % 10;
    return { L: bl * 10 + 5, a: ba * 20 - 90, b: bb * 20 - 90, frac: +(cnt / n).toFixed(4) };
  });

  // -- value structure: where the light sits in the frame --------------------------------------
  const bandL = [];
  for (let t = 0; t < 3; t++) {
    let s = 0, c = 0;
    for (let y = Math.floor((t * hUse) / 3); y < Math.floor(((t + 1) * hUse) / 3); y++)
      for (let x = 0; x < w; x++) { s += L[y * w + x]; c++; }
    bandL.push(s / c);
  }

  // -- silhouette: the skyline, per column -----------------------------------------------------
  // Operational definition: walk down each column from the top; the skyline is the first row whose
  // lightness departs from that column's top-of-frame reference by more than SKY_DL for THREE
  // consecutive rows. Columns that never depart are "all sky". Reported as a fraction of the
  // measured frame height, so it is scale-free and comparable across a 320x320 crop and a 1920x1080
  // frame. This measures P02/P05 (what shape does the world cut against the sky), never sharpness.
  const SKY_DL = 12, RUN = 3;
  const sky = new Float64Array(w);
  let allSky = 0;
  for (let x = 0; x < w; x++) {
    let ref = 0; for (let y = 0; y < 3; y++) ref += L[y * w + x]; ref /= 3;
    let hit = -1, run = 0;
    for (let y = 3; y < hUse; y++) {
      if (Math.abs(L[y * w + x] - ref) > SKY_DL) { run++; if (run >= RUN) { hit = y - RUN + 1; break; } }
      else run = 0;
    }
    if (hit < 0) { hit = hUse; allSky++; }
    sky[x] = hit / hUse;
  }
  const skyArr = Array.from(sky);
  const skyMean = skyArr.reduce((a, b) => a + b, 0) / w;
  const skySd = Math.sqrt(skyArr.reduce((a, b) => a + (b - skyMean) ** 2, 0) / w);
  const skySorted = skyArr.slice().sort((a, b) => a - b);

  // "Silhouette rhythm": does the skyline repeat at a readable interval across the frame?
  // Foliage noise dominates the raw profile, so smooth with a 5-tap box first, then look for the
  // FIRST LOCAL MAXIMUM of the autocorrelation above r=0.05 at lag >= 8. `period_found=false` is a
  // real answer — it means this frame's skyline has no rhythm this instrument can see — and the
  // board reports the found-rate rather than a period the population cannot support.
  const sm = skyArr.map((_, i) => {
    let s = 0, c = 0;
    for (let d = -2; d <= 2; d++) { const j = i + d; if (j >= 0 && j < w) { s += skyArr[j]; c++; } }
    return s / c;
  });
  const smMean = sm.reduce((a, b) => a + b, 0) / w;
  const smSd = Math.sqrt(sm.reduce((a, b) => a + (b - smMean) ** 2, 0) / w);
  const dev = sm.map((v) => v - smMean);
  const denom = dev.reduce((a, b) => a + b * b, 0) || 1;
  const ac = [];
  for (let lag = 8; lag <= Math.floor(w / 3); lag++) {
    let s = 0;
    for (let x = 0; x + lag < w; x++) s += dev[x] * dev[x + lag];
    ac.push([lag, s / denom]);
  }
  let bestLag = null, bestR = null;
  for (let i = 1; i < ac.length - 1; i++) {
    if (ac[i][1] > ac[i - 1][1] && ac[i][1] >= ac[i + 1][1] && ac[i][1] > 0.05) { bestLag = ac[i][0]; bestR = ac[i][1]; break; }
  }

  // -- layout descriptor (per-image z-scored, so absolute contrast and exposure are gone) -------
  // 6x4 Sobel magnitude + 6x4 lightness, each z-scored WITHIN the image. Z-scoring is what makes
  // this a composition statistic rather than a fidelity one: it cannot see how much detail there
  // is, only where the detail and the light are. Verbatim in spirit from the descriptor
  // AM-W1-01-01 already put into `tools/world/region-dispersion.mjs`.
  const GW = 6, GH = 4;
  const acc = Array.from({ length: GW * GH }, () => [0, 0, 0]);
  for (let y = 1; y < hUse - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const at = (xx, yy) => L[yy * w + xx];
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const c = Math.min(GH - 1, Math.floor((y / hUse) * GH)) * GW + Math.min(GW - 1, Math.floor((x / w) * GW));
      acc[c][0] += Math.hypot(gx, gy); acc[c][1] += at(x, y); acc[c][2]++;
    }
  }
  const zn = (v) => {
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
    return v.map((x) => +(((x - m) / sd) * 20).toFixed(3));
  };
  const layout = [...zn(acc.map((c) => c[0] / c[2])), ...zn(acc.map((c) => c[1] / c[2]))];

  // -- 4x4 mean-CIELAB descriptor (the `raw` axis AM-W1-01-01 keeps for continuity) ------------
  const RG = 4, racc = Array.from({ length: RG * RG }, () => [0, 0, 0, 0]);
  for (let y = 0; y < hUse; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    const c = Math.min(RG - 1, Math.floor((y / hUse) * RG)) * RG + Math.min(RG - 1, Math.floor((x / w) * RG));
    racc[c][0] += L[k]; racc[c][1] += A[k]; racc[c][2] += B[k]; racc[c][3]++;
  }
  const rawDesc = racc.flatMap((c) => [+(c[0] / c[3]).toFixed(3), +(c[1] / c[3]).toFixed(3), +(c[2] / c[3]).toFixed(3)]);

  // -- FIDELITY-only statistics ----------------------------------------------------------------
  // These are computed for every plate but the board reads them ONLY from refs/modern/.
  // dynamic range in stops, over the linear luminance, p01..p99 to survive one hot pixel.
  const Ys = Array.from(Ylin).sort((a, b) => a - b);
  const y01 = Math.max(pct(Ys, 1), 1e-5), y99 = Math.max(pct(Ys, 99), 1e-5);
  const stops = Math.log2(y99 / y01);
  // shadow-to-lit lightness ratio in the lower two thirds: a light-direction statistic, NOT a
  // key-to-fill ratio (see GAPS row FID-KEYFILL).
  const lower = [];
  for (let y = Math.floor(hUse / 3); y < hUse; y++) for (let x = 0; x < w; x++) lower.push(L[y * w + x]);
  lower.sort((a, b) => a - b);
  const shadowLit = pct(lower, 25) > 1 ? pct(lower, 75) / pct(lower, 25) : null;
  // aerial-perspective strength: local contrast just under the skyline against local contrast in
  // the bottom sixth. A renderer with no aerial perspective returns ~1.0; a heavy one returns high.
  const localSigma = (y0, y1) => {
    let s = 0, c = 0;
    for (let y = Math.max(1, y0); y < Math.min(hUse - 1, y1); y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        let m = 0, m2 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const v = L[(y + dy) * w + (x + dx)]; m += v; m2 += v * v;
        }
        m /= 9; m2 /= 9; s += Math.sqrt(Math.max(0, m2 - m * m)); c++;
      }
    }
    return c ? s / c : null;
  };
  const horizonRow = Math.floor(skyMean * hUse);
  const sigNearHorizon = localSigma(horizonRow, horizonRow + Math.max(4, Math.floor(hUse * 0.10)));
  const sigForeground = localSigma(Math.floor(hUse * (5 / 6)), hUse);
  const aerial = sigNearHorizon && sigNearHorizon > 0.01 ? sigForeground / sigNearHorizon : null;

  return {
    n_px: n, w, h_measured: hUse, crop_bottom: cropBottom,
    L_p05: r3(pct(Ls, 5)), L_p50: r3(pct(Ls, 50)), L_p95: r3(pct(Ls, 95)),
    L_mean: r3(Ls.reduce((a, b) => a + b, 0) / n),
    C_mean: r3(Cs.reduce((a, b) => a + b, 0) / n), C_p50: r3(pct(Cs, 50)), C_p95: r3(pct(Cs, 95)),
    chroma_frac_gt30: r3(hiC / n),
    hue_mean_deg: r3(hueMean), hue_concentration: r3(hueR), warm_frac: r3(warmW ? warm / warmW : null),
    palette_bins: paletteBins, swatches,
    band_L_top: r3(bandL[0]), band_L_mid: r3(bandL[1]), band_L_bottom: r3(bandL[2]),
    value_split_top_bottom: r3(bandL[0] - bandL[2]),
    sky_frac: r3(skyMean), skyline_sd: r3(skySd),
    skyline_p05: r3(pct(skySorted, 5)), skyline_p95: r3(pct(skySorted, 95)),
    skyline_range: r3(pct(skySorted, 95) - pct(skySorted, 5)),
    skyline_sd_smoothed: r3(smSd),
    skyline_period_found: bestLag !== null,
    skyline_period_frac_w: bestLag === null ? null : r3(bestLag / w),
    skyline_period_r: bestR === null ? null : r3(bestR),
    all_sky_columns_frac: r3(allSky / w),
    dyn_range_stops: r3(stops), shadow_lit_ratio: r3(shadowLit), aerial_perspective_ratio: r3(aerial),
    layout_descriptor: layout, raw_descriptor: rawDesc,
  };
}

// ---------------------------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(join(REFS, 'MANIFEST.json'), 'utf8')).records;

const IMAGE_EXT = /\.(jpg|jpeg|png|avif|webp)$/i;
const rows = [];
let skipped = 0;

for (const rec of manifest) {
  const p = rec.path;
  if (!IMAGE_EXT.test(p)) continue;
  // Sides. `context/` is excluded outright: RI-VIS09 §2 makes it a target on neither axis, and a
  // number nobody may aim at has no business in a look target.
  let side = null;
  if (p.startsWith('morrowind/')) side = 'ART';
  else if (p.startsWith('anti-generic/')) side = 'ART_NEGATIVE';
  else if (p.startsWith('modern/')) side = 'FIDELITY';
  else continue;
  // RI-VIS09 §2: no render is ever scored against a HUD-bearing modern frame. The FIDELITY half
  // therefore reads only HUD-free modern plates. `ui/` is a layout population, not a look target.
  if (side === 'FIDELITY' && (rec.has_hud === true || rec.profile === 'ui')) { skipped++; continue; }
  const abs = join(REFS, p);
  if (!existsSync(abs)) { skipped++; continue; }

  // Composition statistics need real framing. RI-VIS09 §3.3: the square crop destroyed original
  // framing on ~92% of the mwscr previews, so sky fraction, skyline and value bands are marked
  // unusable on those and only the palette statistics survive.
  const nativeFraming = rec.framing === 'full frame, native aspect, uncropped'
    || (side !== 'ART' && rec.framing !== 'square crop, not the native aspect');
  // Morrowind full-frame plates carry Morrowind's own HUD in the bottom band; drop it before
  // measuring anything. anti-generic frames are HUD-bearing too.
  const cropBottom = rec.has_hud === true ? 0.20 : 0.0;

  let stats;
  try { stats = plateStats(decode(abs), cropBottom); }
  catch (e) { skipped++; rows.push({ path: p, side, error: String(e.message).slice(0, 200) }); continue; }

  rows.push({
    path: p, side,
    slot: rec.slot || null, profile: rec.profile || null, region: rec.region || null,
    framing: rec.framing || null, has_hud: rec.has_hud === true,
    composition_valid: !!nativeFraming,
    composition_invalid_reason: nativeFraming ? null
      : 'square crop, not the native aspect (RI-VIS09 §3.3: framing destroyed)',
    // The skyline detector reports "all sky" on a frame that has no sky at all (a dark interior
    // has a uniform top band). Sky statistics are therefore only trusted where the manifest
    // asserts sky_visible; `null` means the manifest does not say and the row is not used.
    sky_visible: rec.sky_visible === undefined ? null : rec.sky_visible,
    promotional: rec.promotional === true,
    pixel_metrics_valid: rec.pixel_metrics_valid === true,
    vanilla_confidence: rec.vanilla_confidence || null,
    ...stats,
  });
}

const out = {
  schema: 'elder-souls/w1-30k-plate-metrics@1',
  produced_by: 'docs/art-direction/measure-plates.mjs',
  generated_at_commit: (() => {
    try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); }
    catch { return 'unknown'; }
  })(),
  grant: 'RI-VIS09 §3.3 — palette, silhouette, built form, flora/creature design language. '
    + 'No statistic in this file measures texture resolution, texel density, anti-aliasing or sharpness '
    + 'on any plate under refs/morrowind/.',
  routing: {
    ART: 'refs/morrowind/ only',
    ART_NEGATIVE: 'refs/anti-generic/ only, as the thing to measure distance FROM (RI-VIS07)',
    FIDELITY: 'refs/modern/ only, HUD-free plates only (RI-VIS09 §2)',
    excluded: 'refs/context/ — a target on neither axis, so it grounds no number here',
  },
  counts: { measured: rows.filter((r) => !r.error).length, skipped, errors: rows.filter((r) => r.error).length },
  plates: rows,
};
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`measured ${out.counts.measured} plates, skipped ${skipped}, errors ${out.counts.errors} -> ${OUT}`);
