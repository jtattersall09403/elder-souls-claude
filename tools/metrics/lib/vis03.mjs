// vis03.mjs — RI-VIS03 "Fidelity as measurable quantities" implemented as written.
// Spec: corpus/70-visual/RI-VIS03-fidelity-image-metrics.md (M1..M12, §0 preprocessing,
// §0c profiles). Implementation notes: corpus/00-doctrine/METRICS-IMPLEMENTATION-01.md.
//
// SIDE: this module computes the FIDELITY side only (RI-VIS01 §B). It knows nothing about
// art direction and must never be cited on that side.
//
// Contract for every statistic this module emits:
//     { value, unit, profile, measurable: true|false, reason, band, pass }
// `value` is null whenever `measurable` is false. The module never emits a number it did not
// actually compute: "unmeasurable" is a first-class, required output, and a caller that treats
// it as a pass is violating RI-VIS03 §0c ("a skipped metric never counts as a pass").
//
// No native dependencies. Decoders are in ./decode.mjs.

// ---------------------------------------------------------------------------------------
// §0c PROFILES — thresholds transcribed from RI-VIS03. `null` band = statistic reported but
// not banded for this profile. A profile listed in `skip` is recorded skipped, never passed.
// ---------------------------------------------------------------------------------------
export const PROFILE_NAMES = [
  'exterior_daylight', 'exterior_lowlight', 'interior_darkemissive', 'character_closeup',
];

export const PROFILES = {
  exterior_daylight: {
    skip: [],
    M1: { DR: { min: 0.72 }, occupancy: { min: 0.80 }, blown: { max: 0.05 }, crushed: { max: 0.10 }, mean_Yp: { min: 0.28, max: 0.58 } },
    M2: { C_global: { min: 0.13, max: 0.28 }, C_local_med: { min: 0.045 }, C_local_p10: { min: 0.012 } },
    M3: { meanC: { min: 12, max: 32 }, p95C: { min: 45 }, H_hue: { min: 2.0, max: 4.2 }, chroma_frac: { min: 0.55 } },
    M4: { ED_1: { min: 0.10, max: 0.34 }, scale_ratio: { min: 0.35, max: 1.10 } },
    M5: { HFR: { min: 0.06, max: 0.24 }, NYQ_ratio: { max: 0.18 }, alpha: { min: 1.6, max: 2.6 } },
    M6: { retention: { min: 0.60 }, hue_offset: { min: 15 }, shadow_frac: { min: 0.03 }, C_shadow: { min: 6 } },
    M7: { dY_sky: { min: 0.06 }, dC_sky: { min: 4 }, dH_sky: { min: 6 }, BI: { max: 2 }, sky_noise: { min: 0.0008, max: 0.020 } },
    M8: { FS_score: { min: 0.035 }, LargestFlat: { max: 0.06 }, TotalFlat: { max: 0.18 } },
    M10: { R_aerial: { min: 0.25, max: 0.70 }, dC_depth: { max: -3 } },
  },
  exterior_lowlight: {
    skip: [],
    M1: { DR: { min: 0.65 }, occupancy: { min: 0.72 }, blown: { max: 0.03 }, crushed: { max: 0.20 }, mean_Yp: { min: 0.14, max: 0.40 } },
    M2: { C_global: { min: 0.11, max: 0.26 }, C_local_med: { min: 0.038 }, C_local_p10: { min: 0.010 } },
    M3: { meanC: { min: 8, max: 28 }, p95C: { min: 38 }, H_hue: { min: 1.8, max: 4.2 }, chroma_frac: { min: 0.45 } },
    M4: { ED_1: { min: 0.07, max: 0.30 }, scale_ratio: { min: 0.35, max: 1.10 } },
    M5: { HFR: { min: 0.045, max: 0.22 }, NYQ_ratio: { max: 0.18 }, alpha: { min: 1.6, max: 2.8 } },
    M6: { retention: { min: 0.55 }, hue_offset: { min: 12 }, shadow_frac: { min: 0.05 }, C_shadow: { min: 5 } },
    M7: { dY_sky: { min: 0.10 }, dC_sky: { min: 8 }, dH_sky: { min: 12 }, BI: { max: 2 }, sky_noise: { min: 0.0008, max: 0.025 } },
    M8: { FS_score: { min: 0.030 }, LargestFlat: { max: 0.08 }, TotalFlat: { max: 0.24 } },
    M10: { R_aerial: { min: 0.20, max: 0.65 }, dC_depth: { max: -2 } },
  },
  interior_darkemissive: {
    // §0c: "M1 mean relaxed hard, M7 skipped, M6 + M9 tightened".
    // M10 has no row in RI-VIS03's M10 table for interiors -> recorded skipped, not passed.
    skip: ['M7', 'M10'],
    M1: { DR: { min: 0.70 }, occupancy: { min: 0.65 }, blown: { max: 0.02 }, crushed: { max: 0.35 }, mean_Yp: { min: 0.06, max: 0.26 } },
    M2: { C_global: { min: 0.12, max: 0.32 }, C_local_med: { min: 0.035 }, C_local_p10: { min: 0.008 } },
    M3: { meanC: { min: 8, max: 34 }, p95C: { min: 50 }, H_hue: { min: 1.5, max: 3.8 }, chroma_frac: { min: 0.40 } },
    M4: { ED_1: { min: 0.06, max: 0.28 }, scale_ratio: { min: 0.30, max: 1.10 } },
    M5: { HFR: { min: 0.04, max: 0.22 }, NYQ_ratio: { max: 0.20 }, alpha: { min: 1.5, max: 2.9 } },
    M6: { retention: { min: 0.50 }, hue_offset: { min: 20 }, shadow_frac: { min: 0.08 }, C_shadow: { min: 6 } },
    M7: null,
    M8: { FS_score: { min: 0.028 }, LargestFlat: { max: 0.10 }, TotalFlat: { max: 0.30 } },
    M10: null,
  },
  character_closeup: {
    // §0c: "M7, M10, M11 skipped; M4/M5 computed on the model crop only".
    skip: ['M7', 'M10', 'M11'],
    M1: { DR: { min: 0.60 }, occupancy: { min: 0.72 }, blown: { max: 0.03 }, crushed: { max: 0.12 }, mean_Yp: { min: 0.22, max: 0.55 } },
    M2: { C_global: { min: 0.10, max: 0.26 }, C_local_med: { min: 0.040 }, C_local_p10: { min: 0.012 } },
    M3: { meanC: { min: 10, max: 34 }, p95C: { min: 42 }, H_hue: { min: 1.8, max: 4.0 }, chroma_frac: { min: 0.50 } },
    M4: { ED_1: { min: 0.09, max: 0.32 }, scale_ratio: { min: 0.35, max: 1.10 } },
    M5: { HFR: { min: 0.05, max: 0.24 }, NYQ_ratio: { max: 0.15 }, alpha: { min: 1.6, max: 2.8 } },
    M6: { retention: { min: 0.55 }, hue_offset: { min: 12 }, shadow_frac: { min: 0.04 }, C_shadow: { min: 5 } },
    M7: null,
    M8: { FS_score: { min: 0.032 }, LargestFlat: { max: 0.07 }, TotalFlat: { max: 0.20 } },
    M10: null,
  },
};

// M9 is profile-independent in RI-VIS03 (one table, no profile column).
export const M9_BANDS = {
  ClipFrac: { max: 0.02 },
  ShoulderRatio: { min: 0.25, max: 1.10 },
  HighlightDesat: { max: 0.85 },
  BloomHalo: { min: 0.010, max: 0.09 },
  VeilIndex: { max: 0.10 },
};
export const M11_BANDS = { pops: { max: 1 }, worst_pop: { max: 0.01 } };
export const M12_BANDS = {
  FresnelDelta: { min: 0.05 }, NormalEnergy: { min: 0.035 }, ShoreDelta: { min: 0.03 },
  ReflCorr: { min: 0.35 }, TemporalVar: { min: 0.002 },
};

/** Shot-name overrides RI-VIS03 names explicitly (the `xanmeer_vista (long)` M10 row). */
export const SHOT_OVERRIDES = {
  xanmeer_vista: { M10: { R_aerial: { min: 0.15, max: 0.55 }, dC_depth: { max: -5 } } },
};

// ---------------------------------------------------------------------------------------
// statistic constructors
// ---------------------------------------------------------------------------------------
const r6 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : +v.toFixed(6));

/** A measured statistic. */
export function S(value, unit, band = null) {
  const v = Number.isFinite(value) ? value : null;
  const out = { value: r6(v), unit, measurable: v !== null, reason: v === null ? 'non-finite result' : null, band, pass: null };
  if (out.measurable && band) out.pass = inBand(v, band);
  return out;
}
/** A statistic that could not be computed. `reason` is mandatory and must name the obstacle. */
export function U(unit, reason, band = null) {
  return { value: null, unit, measurable: false, reason, band, pass: null };
}
function inBand(v, b) {
  if (!b) return null;
  if (b.min !== undefined && v < b.min) return false;
  if (b.max !== undefined && v > b.max) return false;
  return true;
}

// ---------------------------------------------------------------------------------------
// §0 common preprocessing
// ---------------------------------------------------------------------------------------
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const D65 = [0.95047, 1.0, 1.08883];
const labF = (t) => (t > 0.008856451679035631 ? Math.cbrt(t) : t / 0.12841854934601665 + 0.13793103448275862);

/**
 * Build every shared plane RI-VIS03 §0 defines. One pass, no intermediate images.
 * @param {{width:number,height:number,data:Uint8Array}} img RGBA8
 */
export function prepare(img) {
  const W = img.width, H = img.height, N = W * H, d = img.data;
  const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
  const Yp = new Float32Array(N), Ylin = new Float32Array(N);
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  const Cstar = new Float32Array(N), hue = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const rr = d[p] / 255, gg = d[p + 1] / 255, bb = d[p + 2] / 255;
    r[i] = rr; g[i] = gg; b[i] = bb;
    Yp[i] = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    const lr = srgbToLin(rr), lg = srgbToLin(gg), lb = srgbToLin(bb);
    Ylin[i] = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    // sRGB -> XYZ (D65), then CIELAB
    const X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
    const Y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
    const Z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;
    const fx = labF(X / D65[0]), fy = labF(Y / D65[1]), fz = labF(Z / D65[2]);
    const la = 500 * (fx - fy), lbb = 200 * (fy - fz);
    L[i] = 116 * fy - 16; A[i] = la; B[i] = lbb;
    Cstar[i] = Math.hypot(la, lbb);
    let hd = (Math.atan2(lbb, la) * 180) / Math.PI;
    if (hd < 0) hd += 360;
    hue[i] = hd;
  }
  return { W, H, N, r, g, b, Yp, Ylin, L, A, B, Cstar, hue, rgba: d };
}

// ---------------------------------------------------------------------------------------
// small numeric helpers
// ---------------------------------------------------------------------------------------
const HB = 4096; // histogram bins for masked percentiles; exact to ~1/4096 of the range
function maskedPercentile(arr, mask, lo, hi, qs) {
  const h = new Uint32Array(HB); let n = 0;
  const span = hi - lo || 1;
  for (let i = 0; i < arr.length; i++) {
    if (mask && !mask[i]) continue;
    let t = (arr[i] - lo) / span; if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
    h[(t * (HB - 1)) | 0]++; n++;
  }
  const out = {};
  if (!n) { for (const q of qs) out[q] = null; out._n = 0; return out; }
  const sorted = [...qs].sort((a, b2) => a - b2);
  let acc = 0, k = 0;
  for (let i = 0; i < HB && k < sorted.length; i++) {
    acc += h[i];
    while (k < sorted.length && acc > Math.max(0, Math.min(n - 1, Math.round((n - 1) * sorted[k])))) {
      out[sorted[k]] = lo + (i / (HB - 1)) * span; k++;
    }
  }
  for (; k < sorted.length; k++) out[sorted[k]] = hi;
  out._n = n;
  return out;
}
function maskedMoments(arr, mask) {
  let s = 0, s2 = 0, s3 = 0, n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (mask && !mask[i]) continue;
    const v = arr[i]; s += v; s2 += v * v; n++;
  }
  if (!n) return { n: 0, mean: null, sd: null, skew: null };
  const m = s / n, varr = Math.max(0, s2 / n - m * m), sd = Math.sqrt(varr);
  for (let i = 0; i < arr.length; i++) { if (mask && !mask[i]) continue; s3 += (arr[i] - m) ** 3; }
  return { n, mean: m, sd, skew: sd > 1e-9 ? s3 / n / sd ** 3 : 0 };
}
function median(a) {
  if (!a.length) return null;
  const s = Float64Array.from(a).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(a, q) {
  if (!a.length) return null;
  const s = Float64Array.from(a).sort();
  return s[Math.max(0, Math.min(s.length - 1, Math.round((s.length - 1) * q)))];
}

/** Sobel magnitude, normalised by 4 so a 0->1 step edge gives G ~= 1.
 *  RI-VIS03's M4 writes the raw convolution; the /4 normalisation is what the existing
 *  harness used and what ACQUISITION-REPORT §10's measured ED_1 = 0.172-0.320 (modern) was
 *  measured against RI-VIS03's 0.08 threshold on. Changing it would silently invalidate the
 *  only calibration evidence the project has. Documented, deliberate, and load-bearing. */
export function sobel(Y, W, H) {
  const mag = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -Y[i - W - 1] - 2 * Y[i - 1] - Y[i + W - 1] + Y[i - W + 1] + 2 * Y[i + 1] + Y[i + W + 1];
      const gy = -Y[i - W - 1] - 2 * Y[i - W] - Y[i - W + 1] + Y[i + W - 1] + 2 * Y[i + W] + Y[i + W + 1];
      mag[i] = Math.hypot(gx, gy) / 4;
    }
  }
  return mag;
}

/** 4-connected components over a boolean mask. Returns {labels:Int32Array(-1=bg), comps:[{n,minX,..}]}. */
export function components4(mask, W, H, minArea = 1) {
  const labels = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const comps = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || labels[s] !== -1) continue;
    const id = comps.length;
    let sp = 0; stack[sp++] = s; labels[s] = id;
    let n = 0, minX = W, maxX = -1, minY = H, maxY = -1, touchesTop = false;
    while (sp) {
      const i = stack[--sp]; n++;
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (y === 0) touchesTop = true;
      if (x > 0 && mask[i - 1] && labels[i - 1] === -1) { labels[i - 1] = id; stack[sp++] = i - 1; }
      if (x < W - 1 && mask[i + 1] && labels[i + 1] === -1) { labels[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - W] && labels[i - W] === -1) { labels[i - W] = id; stack[sp++] = i - W; }
      if (y < H - 1 && mask[i + W] && labels[i + W] === -1) { labels[i + W] = id; stack[sp++] = i + W; }
    }
    comps.push({ id, n, minX, maxX, minY, maxY, touchesTop });
  }
  return { labels, comps: comps.filter((c) => c.n >= minArea), allComps: comps };
}

// ---------------------------------------------------------------------------------------
// MASKS — RI-VIS03 §0 + M7 §detect
// ---------------------------------------------------------------------------------------
/**
 * FG_MASK / SKY_MASK / SHADOW_MASK / LIT_MASK.
 *
 * SKY_MASK method (deterministic, RI-VIS03 M7 §detect verbatim):
 *   candidate = { p : row(p) < 0.45*H  AND  G(p) < 0.02  AND  Yp(p) > P60(Yp) }
 *   SKY_MASK  = the largest 4-connected component of `candidate` that touches row 0
 *   FG_MASK   = NOT SKY_MASK
 * Rationale for each clause: sky is high in frame, has no edges (a Sobel floor removes
 * foliage silhouettes and cloud rims), is brighter than the median of the frame, and is
 * contiguous with the top of the image. Requiring contact with row 0 is what stops a bright
 * flat wall or a lake from being classified as sky.
 *
 * If nothing qualifies, SKY_MASK is empty, sky_frac = 0, FG_MASK is the whole frame, and M7
 * is recorded SKIPPED (never passed) per RI-VIS03 M7 §detect.
 *
 * ---- STAGE B, and why it exists -------------------------------------------------------
 * The literal rule has a defect found by the self-test and reproduced on real frames: the
 * `Yp > P60` gate is evaluated over the WHOLE frame, so a sky whose zenith is darker than the
 * frame's 60th percentile — every dawn/dusk gradient, and any daylight sky over bright ground
 * — has no candidate pixel in row 0, no component touches row 0, and SKY_MASK comes back
 * empty. M7 then records itself SKIPPED. That is precisely the failure mode RI-VIS03's own
 * "How we lose" section names ("M7 is skipped because no sky is visible ... Guard: skipped
 * metrics renormalise the denominator"), except here the sky IS visible and the detector
 * missed it — the worst case, because the frame is not penalised for anything.
 *
 * So: when stage A finds nothing, stage B retries WITHOUT the luminance gate, and additionally
 * requires the component to span >= 50% of the frame width (which is what stops a flat dark
 * wall or a lake from being taken for sky now that brightness no longer disqualifies it).
 * Whichever stage produced the mask is recorded in `sky_detect` on every output, so a stage-B
 * mask is never silent. The proposed amendment to RI-VIS03 is in METRICS-IMPLEMENTATION-01.
 */
export function computeMasks(pl, G) {
  const { W, H, N, Yp } = pl;
  const p60 = maskedPercentile(Yp, null, 0, 1, [0.6])[0.6];
  const topRows = Math.floor(0.45 * H);
  const cand = new Uint8Array(N);
  for (let y = 0; y < topRows; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (G[i] < 0.02 && Yp[i] > p60) cand[i] = 1;
    }
  }
  let { labels, allComps } = components4(cand, W, H);
  let best = null;
  for (const c of allComps) if (c.touchesTop && (!best || c.n > best.n)) best = c;
  let detect = 'RI-VIS03 M7 §detect, literal (G < 0.02, Yp > P60, 4-connected to row 0)';
  if (!best || best.n / N < 0.02) {
    cand.fill(0);
    for (let y = 0; y < topRows; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (G[i] < 0.02) cand[i] = 1; }
    const r = components4(cand, W, H);
    let b2 = null;
    for (const c of r.allComps) {
      if (!c.touchesTop) continue;
      if (c.maxX - c.minX + 1 < 0.5 * W) continue;   // must span half the frame to be a sky
      if (!b2 || c.n > b2.n) b2 = c;
    }
    if (b2 && b2.n / N >= 0.02) {
      labels = r.labels; best = b2;
      detect = 'STAGE B fallback: the literal RI-VIS03 rule found no sky because the Yp > P60 gate excluded the darker end of the sky gradient. Retried with the luminance gate dropped and a >=50%-of-width span requirement. See METRICS-IMPLEMENTATION-01 §amendment M7-detect.';
    } else if (!best) {
      detect = 'no sky found by either the literal rule or the stage-B fallback';
    }
  }
  const sky = new Uint8Array(N);
  if (best) for (let i = 0; i < N; i++) if (labels[i] === best.id) sky[i] = 1;
  const fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg[i] = sky[i] ? 0 : 1;
  const skyN = best ? best.n : 0;
  const fgN = N - skyN;

  const q = maskedPercentile(Yp, fg, 0, 1, [0.25, 0.75]);
  const shadow = new Uint8Array(N), lit = new Uint8Array(N);
  let shadowN = 0, litN = 0;
  if (q[0.25] !== null) {
    for (let i = 0; i < N; i++) {
      if (!fg[i]) continue;
      if (Yp[i] < q[0.25]) { shadow[i] = 1; shadowN++; }
      else if (Yp[i] > q[0.75]) { lit[i] = 1; litN++; }
    }
  }
  return {
    sky, fg, shadow, lit,
    skyN, fgN, shadowN, litN,
    skyFrac: skyN / N, fgFrac: fgN / N, shadowFrac: shadowN / N, litFrac: litN / N,
    skyComp: best, p60, sky_detect: detect,
    shadowThresh: q[0.25], litThresh: q[0.75],
  };
}

// ---------------------------------------------------------------------------------------
// M1 — luminance histogram spread and dynamic range
// ---------------------------------------------------------------------------------------
export function M1(pl) {
  const { N, Yp, Ylin } = pl;
  const h = new Uint32Array(256);
  for (let i = 0; i < N; i++) h[Math.min(255, Math.round(Yp[i] * 255))]++;
  const q = maskedPercentile(Yp, null, 0, 1, [0.01, 0.5, 0.99]);
  const mom = maskedMoments(Yp, null);
  const DR = q[0.99] - q[0.01];
  let occ = 0; for (let i = 0; i < 256; i++) if (h[i] >= 0.0001 * N) occ++;
  let blown = 0, crushed = 0;
  for (let i = 0; i < N; i++) { if (Yp[i] >= 0.996) blown++; if (Yp[i] <= 0.004) crushed++; }

  // Dynamic range in STOPS, on linear luminance. Added on the evidence of
  // ACQUISITION-REPORT §10: modern 9.20-11.75, Morrowind 5.61-8.31, no overlap. Percentiles
  // are p0.5/p99.5 (NOT p1/p99) because that is what those numbers were measured with; the
  // 1e-5 floor stops a single crushed pixel from sending the ratio to infinity.
  const ql = maskedPercentile(Ylin, null, 0, 1, [0.005, 0.995]);
  const linLo = Math.max(ql[0.005], 1e-5), linHi = Math.max(ql[0.995], 1e-5);
  const stops = Math.log2(linHi / linLo);

  return {
    DR, occupancy: occ / 256, blown: blown / N, crushed: crushed / N,
    mean_Yp: mom.mean, skew: mom.skew, P1: q[0.01], P50: q[0.5], P99: q[0.99],
    stops, hist256: Array.from(h),
  };
}

// ---------------------------------------------------------------------------------------
// M2 — global and local RMS contrast (over FG_MASK)
// ---------------------------------------------------------------------------------------
export function tileStdevs(Y, mask, W, H, T, requireFull = true, minFrac = 1.0) {
  const out = [];
  for (let ty = 0; ty + T <= H; ty += T) {
    for (let tx = 0; tx + T <= W; tx += T) {
      let s = 0, s2 = 0, n = 0, inm = 0;
      for (let y = 0; y < T; y++) {
        const base = (ty + y) * W + tx;
        for (let x = 0; x < T; x++) {
          const i = base + x;
          if (mask && mask[i]) inm++;
          const v = Y[i]; s += v; s2 += v * v; n++;
        }
      }
      if (mask) {
        if (requireFull && inm < n) continue;
        if (!requireFull && inm < minFrac * n) continue;
      }
      const m = s / n;
      out.push({ sd: Math.sqrt(Math.max(0, s2 / n - m * m)), mean: m, cx: tx + T / 2, cy: ty + T / 2, tx, ty });
    }
  }
  return out;
}

export function M2(pl, masks) {
  const { W, H, Yp } = pl;
  const mom = maskedMoments(Yp, masks.fg);
  const tiles = tileStdevs(Yp, masks.fg, W, H, 32, true);
  const sds = tiles.map((t) => t.sd);
  const flattest = tiles.length ? tiles.reduce((a, b) => (b.sd < a.sd ? b : a)) : null;
  return {
    C_global: mom.sd,
    C_local_med: median(sds),
    C_local_p90: pct(sds, 0.90),
    C_local_p10: pct(sds, 0.10),
    tiles: tiles.length,
    flattest_tile: flattest ? { centroid: [flattest.cx, flattest.cy], sd: r6(flattest.sd), mean_Yp: r6(flattest.mean) } : null,
  };
}

// ---------------------------------------------------------------------------------------
// M3 — colour distribution and saturation statistics, in CIELAB (not HSV)
// ---------------------------------------------------------------------------------------
export function M3(pl, masks) {
  const { N, Cstar, hue } = pl;
  const fg = masks.fg;
  let nFg = 0, nChr = 0, sumC = 0;
  const hh = new Float64Array(36);
  for (let i = 0; i < N; i++) {
    if (!fg[i]) continue;
    nFg++; sumC += Cstar[i];
    if (Cstar[i] > 8) {
      nChr++;
      hh[Math.min(35, Math.floor(hue[i] / 10))] += Cstar[i];
    }
  }
  if (!nFg) return null;
  const cq = maskedPercentile(Cstar, fg, 0, 200, [0.95]);
  const tot = hh.reduce((a, b) => a + b, 0);
  let Hh = 0;
  if (tot > 0) for (const v of hh) if (v > 0) { const p = v / tot; Hh -= p * Math.log2(p); }
  return {
    chroma_frac: nChr / nFg,
    meanC: sumC / nFg,
    p95C: cq[0.95],
    H_hue: Hh,
    hue_hist36: Array.from(hh, (v) => (tot ? +(v / tot).toFixed(5) : 0)),
  };
}

// ---------------------------------------------------------------------------------------
// M4 — edge density, with the scale_ratio guard RI-VIS03 specifies and the old tool omitted
// ---------------------------------------------------------------------------------------
function boxDown(Y, W, H, f) {
  const w2 = Math.floor(W / f), h2 = Math.floor(H / f);
  const out = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let s = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += Y[(y * f + dy) * W + (x * f + dx)];
    out[y * w2 + x] = s / (f * f);
  }
  return { Y: out, W: w2, H: h2 };
}
function maskDown(mask, W, H, f) {
  const w2 = Math.floor(W / f), h2 = Math.floor(H / f);
  const out = new Uint8Array(w2 * h2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let s = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += mask[(y * f + dy) * W + (x * f + dx)];
    out[y * w2 + x] = s * 2 >= f * f ? 1 : 0; // majority
  }
  return out;
}
function edgeDensity(Y, mask, W, H, thr) {
  const G = sobel(Y, W, H);
  let n = 0, m = 0;
  for (let i = 0; i < W * H; i++) { if (mask && !mask[i]) continue; m++; if (G[i] > thr) n++; }
  return m ? n / m : null;
}

export function M4(pl, masks, G, thr = 0.08) {
  const { W, H } = pl;
  let n = 0, m = 0, gsum = 0;
  for (let i = 0; i < W * H; i++) { if (!masks.fg[i]) continue; m++; gsum += G[i]; if (G[i] > thr) n++; }
  const ED_1 = m ? n / m : null;
  const d2 = boxDown(pl.Yp, W, H, 2), m2 = maskDown(masks.fg, W, H, 2);
  const d4 = boxDown(pl.Yp, W, H, 4), m4 = maskDown(masks.fg, W, H, 4);
  const ED_2 = edgeDensity(d2.Y, m2, d2.W, d2.H, thr);
  const ED_4 = edgeDensity(d4.Y, m4, d4.W, d4.H, thr);
  return {
    ED_1, ED_2, ED_4,
    scale_ratio: ED_4 === null || ED_1 === null ? null : ED_4 / Math.max(ED_1, 1e-6),
    mean_gradient: m ? gsum / m : null,
    threshold: thr,
  };
}

// ---------------------------------------------------------------------------------------
// M5 — FFT band ratios and spectral slope, on a NATIVE-RESOLUTION 1024x1024 crop
// ---------------------------------------------------------------------------------------
function fft1d(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + half] * cr - im[i + k + half] * ci;
        const vi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/**
 * Spectral statistics on a K x K window of `Y` taken at NATIVE resolution.
 *
 * RI-VIS03's M5 exists to measure texture resolution and aliasing. Box-downscaling the frame
 * first (what the previous implementation did) destroys exactly the band being interrogated
 * and makes the metric measure the resampler — which is why a 320px 2002 screenshot could
 * measure as "better anti-aliased" than a 1440p modern frame. There is no resample here, and
 * an image smaller than K x K returns `unmeasurable` rather than a fabricated number.
 */
export function spectrum(Y, W, H, K, ox, oy) {
  const win = new Float64Array(K);
  for (let i = 0; i < K; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (K - 1)));
  const re = new Float64Array(K * K), im = new Float64Array(K * K);
  let mean = 0;
  for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) mean += Y[(oy + y) * W + (ox + x)];
  mean /= K * K;
  for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) re[y * K + x] = (Y[(oy + y) * W + (ox + x)] - mean) * win[x] * win[y];
  const row = new Float64Array(K), rowi = new Float64Array(K);
  for (let y = 0; y < K; y++) {
    for (let x = 0; x < K; x++) { row[x] = re[y * K + x]; rowi[x] = im[y * K + x]; }
    fft1d(row, rowi);
    for (let x = 0; x < K; x++) { re[y * K + x] = row[x]; im[y * K + x] = rowi[x]; }
  }
  const col = new Float64Array(K), coli = new Float64Array(K);
  for (let x = 0; x < K; x++) {
    for (let y = 0; y < K; y++) { col[y] = re[y * K + x]; coli[y] = im[y * K + x]; }
    fft1d(col, coli);
    for (let y = 0; y < K; y++) { re[y * K + x] = col[y]; im[y * K + x] = coli[y]; }
  }
  // radial binning: f = sqrt(u^2+v^2)/K in cycles/px, so Nyquist is f = 0.5.
  const NB = Math.ceil(0.7072 * K) + 1; // bins indexed by rounded radius in freq samples
  const bsum = new Float64Array(NB), bcnt = new Float64Array(NB);
  const half = K >> 1;
  for (let y = 0; y < K; y++) {
    const fy = y <= half ? y : y - K;
    for (let x = 0; x < K; x++) {
      const fx = x <= half ? x : x - K;
      if (fx === 0 && fy === 0) continue; // exclude DC
      const rr = Math.round(Math.hypot(fx, fy));
      const p = re[y * K + x] ** 2 + im[y * K + x] ** 2;
      bsum[rr] += p; bcnt[rr]++;
    }
  }
  const E = (a, b2) => {
    let s = 0;
    for (let rr = 0; rr < NB; rr++) { const f = rr / K; if (f >= a && f < b2) s += bsum[rr]; }
    return s;
  };
  const E_LOW = E(0.004, 0.05), E_MID = E(0.05, 0.20), E_HIGH = E(0.20, 0.45), E_NYQ = E(0.45, 0.50);
  const HFR = E_HIGH / Math.max(E_LOW + E_MID + E_HIGH, 1e-30);
  const NYQ_ratio = E_NYQ / Math.max(E_HIGH, 1e-9);
  // alpha: -slope of log10(radially averaged power) vs log10(f) over f in [0.02, 0.40]
  const xs = [], ys = [];
  for (let rr = 1; rr < NB; rr++) {
    const f = rr / K;
    if (f < 0.02 || f > 0.40 || !bcnt[rr]) continue;
    const p = bsum[rr] / bcnt[rr];
    if (p > 0) { xs.push(Math.log10(f)); ys.push(Math.log10(p)); }
  }
  let alpha = null;
  if (xs.length > 4) {
    const mx = xs.reduce((a, b2) => a + b2, 0) / xs.length, my = ys.reduce((a, b2) => a + b2, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    alpha = den ? -(num / den) : null;
  }
  return { E_LOW, E_MID, E_HIGH, E_NYQ, HFR, NYQ_ratio, alpha, K, crop_origin: [ox, oy] };
}

/** Choose a native 1024^2 window that is not entirely sky, per RI-VIS03 M5's parenthetical. */
export function M5(pl, masks, K = 1024) {
  const { W, H } = pl;
  if (W < K || H < K) {
    return { unmeasurable: `image is ${W}x${H}; M5 needs a native ${K}x${K} crop and this implementation refuses to resample (a resampled M5 measures the resampler, not the render)` };
  }
  const cx = (W - K) >> 1, cy = (H - K) >> 1;
  const skyFracOf = (ox, oy) => {
    let s = 0;
    for (let y = 0; y < K; y += 4) for (let x = 0; x < K; x += 4) s += masks.sky[(oy + y) * W + (ox + x)];
    return s / ((K / 4) * (K / 4));
  };
  let ox = cx, oy = cy, shifted = false;
  if (skyFracOf(cx, cy) > 0.90) {
    // slide the window down in 64px steps, keeping x centred, until it clears the sky.
    let found = false;
    for (let y = cy; y <= H - K; y += 64) { if (skyFracOf(cx, y) <= 0.90) { oy = y; found = true; break; } }
    if (!found) {
      return { unmeasurable: `every native ${K}x${K} window is >90% SKY_MASK; M5 has no foreground to measure and this implementation will not box-resize the frame to manufacture one` };
    }
    shifted = true;
  }
  const sp = spectrum(pl.Yp, W, H, K, ox, oy);
  sp.crop_shifted = shifted;
  sp.crop_sky_frac = r6(skyFracOf(ox, oy));
  return sp;
}

// ---------------------------------------------------------------------------------------
// M6 — shadow-region detail retention
// ---------------------------------------------------------------------------------------
function circMeanHue(hue, Cstar, mask, N) {
  let sx = 0, sy = 0, w = 0;
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const c = Cstar[i], a = (hue[i] * Math.PI) / 180;
    sx += c * Math.cos(a); sy += c * Math.sin(a); w += c;
  }
  if (w <= 0) return null;
  let d = (Math.atan2(sy, sx) * 180) / Math.PI;
  if (d < 0) d += 360;
  return d;
}
export function circDiff(a, b) {
  if (a === null || b === null) return null;
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
export function M6(pl, masks, C_local_med) {
  const { W, H, N, Yp, Cstar, hue } = pl;
  if (masks.shadowFrac < 0.03) {
    return { shadow_frac: masks.shadowFrac, hard: 'no shadowed region in frame', retention: null, hue_offset: null, C_shadow: null };
  }
  const tilesS = tileStdevs(Yp, masks.shadow, W, H, 32, false, 0.5);
  const C_shadow_med = median(tilesS.map((t) => t.sd));
  const hs = circMeanHue(hue, Cstar, masks.shadow, N);
  const hl = circMeanHue(hue, Cstar, masks.lit, N);
  const cs = maskedMoments(Cstar, masks.shadow);
  return {
    shadow_frac: masks.shadowFrac,
    lit_frac: masks.litFrac,
    C_shadow_med,
    retention: C_shadow_med === null || !C_local_med ? null : C_shadow_med / Math.max(C_local_med, 1e-6),
    hue_shadow: hs, hue_lit: hl, hue_offset: circDiff(hs, hl),
    C_shadow: cs.mean,
    shadow_tiles: tilesS.length,
  };
}

// ---------------------------------------------------------------------------------------
// M7 — sky and horizon gradient smoothness
// ---------------------------------------------------------------------------------------
export function M7(pl, masks) {
  const { W, H, N, Yp, Cstar, hue } = pl;
  if (masks.skyFrac < 0.02) {
    return { skipped: `sky_frac ${r6(masks.skyFrac)} < 0.02 — RI-VIS03 M7 §detect records this as SKIPPED (it does NOT pass)`, sky_frac: masks.skyFrac };
  }
  const rows = [];
  for (let y = 0; y < H; y++) {
    let n = 0, sy = 0, sc = 0, hx = 0, hy2 = 0, hw = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!masks.sky[i]) continue;
      n++; sy += Yp[i]; sc += Cstar[i];
      const a = (hue[i] * Math.PI) / 180; hx += Cstar[i] * Math.cos(a); hy2 += Cstar[i] * Math.sin(a); hw += Cstar[i];
    }
    let hb = null;
    if (hw > 0) { hb = (Math.atan2(hy2, hx) * 180) / Math.PI; if (hb < 0) hb += 360; }
    rows.push({ y, n, frac: n / W, ybar: n ? sy / n : null, cbar: n ? sc / n : null, hbar: hb });
  }
  const present = rows.filter((r) => r.n > 0);
  if (present.length < 12) {
    return { skipped: `only ${present.length} rows contain sky; a row profile needs >= 12`, sky_frac: masks.skyFrac };
  }
  const yTop = present[0].y;
  const dense = rows.filter((r) => r.frac >= 0.20);
  const yHorizon = dense.length ? dense[dense.length - 1].y : present[present.length - 1].y;
  // VERTICAL-EXTENT GATE (not in RI-VIS03; added on measured evidence, amendment M7-span).
  // dY_sky is a difference between two rows. If those rows are 20 px apart — a few patches of
  // sky between trees, which is 6 of 24 real Witcher 3 frames — the difference is necessarily
  // tiny and "dY_sky < 0.02 AND dC_sky < 2" fires as FLAT SINGLE-COLOUR SKY on a real sky.
  // Area alone (sky_frac >= 0.02) does not catch this: a wide thin band passes it.
  const spanFrac = (yHorizon - yTop) / H;
  if (spanFrac < 0.15) {
    return {
      skipped: `SKY_MASK spans only ${(spanFrac * 100).toFixed(1)}% of the frame height (rows ${yTop}..${yHorizon}); dY_sky/dC_sky/dH_sky are differences ACROSS the sky and are meaningless over a band this short. RI-VIS03 gates M7 on area (sky_frac >= 0.02) only, which a wide thin sliver of sky passes — see METRICS-IMPLEMENTATION-01 §amendment M7-span. Recorded SKIPPED; it does NOT pass.`,
      sky_frac: masks.skyFrac, sky_span_frac: spanFrac,
    };
  }
  // 9-row moving average over the rows that contain sky
  const smooth = (key) => {
    const vals = present.map((r) => r[key]);
    const out = new Array(vals.length);
    for (let i = 0; i < vals.length; i++) {
      let s = 0, n = 0;
      for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < vals.length && vals[j] !== null) { s += vals[j]; n++; } }
      out[i] = n ? s / n : null;
    }
    return out;
  };
  const ys = smooth('ybar'), cs = smooth('cbar');
  const idxOf = (y) => { let best = 0; for (let i = 0; i < present.length; i++) if (Math.abs(present[i].y - y) < Math.abs(present[best].y - y)) best = i; return best; };
  const iTop = idxOf(yTop), iHor = idxOf(yHorizon);
  const dY_sky = Math.abs(ys[iTop] - ys[iHor]);
  const dC_sky = Math.abs(cs[iTop] - cs[iHor]);
  const hTop = present[iTop].hbar, hHor = present[iHor].hbar;
  const dH_sky = circDiff(hTop, hHor);
  // BI: second derivative outliers per 100 rows
  const d2 = [];
  for (let i = 1; i < ys.length - 1; i++) d2.push(ys[i + 1] - 2 * ys[i] + ys[i - 1]);
  const m2 = d2.reduce((a, b) => a + b, 0) / (d2.length || 1);
  const s2 = Math.sqrt(d2.reduce((a, b) => a + (b - m2) ** 2, 0) / (d2.length || 1));
  let outliers = 0;
  for (const v of d2) if (Math.abs(v) > 3 * s2 && s2 > 0) outliers++;
  const BI = (outliers / Math.max(1, present.length)) * 100;
  // sky_noise: median stdev over 16x16 tiles that are fully sky
  const tiles = tileStdevs(Yp, masks.sky, W, H, 16, true);
  const sky_noise = median(tiles.map((t) => t.sd));
  return {
    sky_frac: masks.skyFrac, sky_span_frac: spanFrac, y_top: yTop, y_horizon: yHorizon,
    dY_sky, dC_sky, dH_sky, BI, sky_noise, sky_tiles: tiles.length,
    // normalised: how much the sky changes per unit of the frame height it occupies. Comparable
    // between a full-height sky and a half-height one; dY_sky is not.
    dY_per_span: dY_sky / Math.max(spanFrac, 1e-6),
  };
}

// ---------------------------------------------------------------------------------------
// M8 — the flat-shading detector (the headline metric). Both statistics are HARD FAILs.
// ---------------------------------------------------------------------------------------
function median3x3(ch, W, H) {
  const out = new Uint8Array(W * H);
  const v = new Uint8Array(9);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          v[k++] = ch[yy * W + xx];
        }
      }
      // partial selection sort to the 5th element — cheaper than a full sort
      for (let i = 0; i < 5; i++) {
        let mi = i;
        for (let j = i + 1; j < 9; j++) if (v[j] < v[mi]) mi = j;
        const t = v[i]; v[i] = v[mi]; v[mi] = t;
      }
      out[y * W + x] = v[4];
    }
  }
  return out;
}

/** 9x9 local standard deviation of Yp via summed-area tables — O(N), exact. */
function localStd9(Y, W, H, R = 4) {
  const s = new Float64Array((W + 1) * (H + 1));
  const s2 = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rs = 0, rs2 = 0;
    for (let x = 0; x < W; x++) {
      const v = Y[y * W + x]; rs += v; rs2 += v * v;
      s[(y + 1) * (W + 1) + (x + 1)] = s[y * (W + 1) + (x + 1)] + rs;
      s2[(y + 1) * (W + 1) + (x + 1)] = s2[y * (W + 1) + (x + 1)] + rs2;
    }
  }
  const out = new Float32Array(W * H);
  const rect = (T, x0, y0, x1, y1) => T[(y1 + 1) * (W + 1) + (x1 + 1)] - T[y0 * (W + 1) + (x1 + 1)] - T[(y1 + 1) * (W + 1) + x0] + T[y0 * (W + 1) + x0];
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(H - 1, y + R);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(W - 1, x + R);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1);
      const m = rect(s, x0, y0, x1, y1) / n;
      out[y * W + x] = Math.sqrt(Math.max(0, rect(s2, x0, y0, x1, y1) / n - m * m));
    }
  }
  return out;
}

export function M8(pl, masks) {
  const { W, H, N, Yp, rgba } = pl;
  const fg = masks.fg, fgN = masks.fgN;
  if (!fgN) return { unmeasurable: 'FG_MASK is empty (the whole frame classified as sky)' };

  // --- FS_score: within-colour-bin luminance variance, area-weighted -------------------
  const chR = new Uint8Array(N), chG = new Uint8Array(N), chB = new Uint8Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) { chR[i] = rgba[p]; chG[i] = rgba[p + 1]; chB[i] = rgba[p + 2]; }
  const mR = median3x3(chR, W, H), mG = median3x3(chG, W, H), mB = median3x3(chB, W, H);
  const cnt = new Float64Array(216), sum = new Float64Array(216), sumsq = new Float64Array(216);
  for (let i = 0; i < N; i++) {
    if (!fg[i]) continue;
    const bi = Math.min(5, (mR[i] * 6) >> 8) * 36 + Math.min(5, (mG[i] * 6) >> 8) * 6 + Math.min(5, (mB[i] * 6) >> 8);
    cnt[bi]++; sum[bi] += Yp[i]; sumsq[bi] += Yp[i] * Yp[i];
  }
  const minBin = 0.005 * fgN;
  let wsum = 0, wtot = 0, usedBins = 0;
  for (let b = 0; b < 216; b++) {
    if (cnt[b] < minBin) continue;
    const m = sum[b] / cnt[b];
    const v = Math.sqrt(Math.max(0, sumsq[b] / cnt[b] - m * m));
    wsum += cnt[b] * v; wtot += cnt[b]; usedBins++;
  }
  const FS_score = wtot > 0 ? wsum / wtot : null;

  // --- LargestFlat / TotalFlat: 9x9 local stdev < 0.008, 4-connected --------------------
  const ls = localStd9(Yp, W, H, 4);
  const flat = new Uint8Array(N);
  let flatN = 0;
  for (let i = 0; i < N; i++) if (fg[i] && ls[i] < 0.008) { flat[i] = 1; flatN++; }
  const { comps } = components4(flat, W, H, 1);
  let big = null;
  for (const c of comps) if (!big || c.n > big.n) big = c;
  let bigColour = null;
  if (big) {
    const { labels } = { labels: null }; // placeholder; recompute mean colour by bbox scan
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = big.minY; y <= big.maxY; y++) for (let x = big.minX; x <= big.maxX; x++) {
      const i = y * W + x;
      if (!flat[i]) continue;
      sr += chR[i]; sg += chG[i]; sb += chB[i]; n++;
    }
    if (n) bigColour = [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
  }
  return {
    FS_score, bins_used: usedBins,
    LargestFlat: big ? big.n / fgN : 0,
    TotalFlat: flatN / fgN,
    largest_component: big ? { area_px: big.n, bbox: [big.minX, big.minY, big.maxX, big.maxY], mean_rgb: bigColour } : null,
    _flatMask: flat,
  };
}

// ---------------------------------------------------------------------------------------
// M9 — tonemapping and colour response
// ---------------------------------------------------------------------------------------
/** Chamfer 3-4 distance transform from a boolean seed mask (approximate Euclidean, O(N)). */
function distanceFrom(mask, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i];
    if (y > 0) { v = Math.min(v, d[i - W] + 3); if (x > 0) v = Math.min(v, d[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i];
    if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (x > 0) v = Math.min(v, d[i + W - 1] + 4); }
    if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
    d[i] = v;
  }
  for (let i = 0; i < W * H; i++) d[i] /= 3; // chamfer 3-4 -> pixels
  return d;
}

export function M9(pl, masks, m1) {
  const { W, H, N, r, g, b, Yp, Cstar } = pl;
  let clip = 0, hi = 0, mid = 0;
  for (let i = 0; i < N; i++) {
    if (r[i] >= 0.99 && g[i] >= 0.99 && b[i] >= 0.99) clip++;
    if (Yp[i] >= 0.90 && Yp[i] < 0.996) hi++;
    else if (Yp[i] >= 0.75 && Yp[i] < 0.90) mid++;
  }
  const ClipFrac = clip / N;
  // HIGHLIGHT-CONTENT GATE (not in RI-VIS03; added on measured evidence, amendment M9-shoulder).
  // ShoulderRatio = |Yp in [0.90,0.996)| / |Yp in [0.75,0.90)| is a shape statistic of the
  // highlight roll-off. On a frame with almost nothing above 0.75 it is a ratio of two tiny
  // counts and reports noise: 18 of 24 real Witcher 3 frames "hard fail" ShoulderRatio < 0.12
  // and none of them is a linear clamp. Require the frame to HAVE highlights first.
  const highlightFrac = (hi + mid) / N;
  const ShoulderRatio = highlightFrac >= 0.02 ? hi / Math.max(mid, 1) : null;
  const shoulderReason = ShoulderRatio === null
    ? `only ${(highlightFrac * 100).toFixed(2)}% of the frame has Yp >= 0.75; ShoulderRatio is a ratio of two near-empty bins and would report noise. RI-VIS03 does not gate it — see METRICS-IMPLEMENTATION-01 §amendment M9-shoulder.` : null;
  // HighlightDesat: mean chroma of the top 5% by Yp, over mean chroma of FG
  const q = maskedPercentile(Yp, null, 0, 1, [0.95]);
  let ctop = 0, ntop = 0;
  for (let i = 0; i < N; i++) if (Yp[i] >= q[0.95]) { ctop += Cstar[i]; ntop++; }
  const C_top = ntop ? ctop / ntop : null;
  const C_all = maskedMoments(Cstar, masks.fg).mean;
  const HighlightDesat = C_top !== null && C_all ? C_top / Math.max(C_all, 1e-6) : null;
  // BloomHalo: mean Yp in a 12-40 px annulus around bright regions, minus frame mean
  const bright = new Uint8Array(N);
  let brightN = 0;
  for (let i = 0; i < N; i++) if (Yp[i] > 0.95) { bright[i] = 1; brightN++; }
  let BloomHalo = null, bloomReason = null;
  if (!brightN) bloomReason = 'no pixel exceeds Yp 0.95, so there is no highlight to have a halo around (BloomHalo is undefined, not zero)';
  else {
    const dist = distanceFrom(bright, W, H);
    let s = 0, n = 0;
    for (let i = 0; i < N; i++) if (dist[i] >= 12 && dist[i] <= 40) { s += Yp[i]; n++; }
    if (!n) bloomReason = 'the 12-40 px annulus around the highlight regions is empty';
    else BloomHalo = s / n - m1.mean_Yp;
  }
  const VeilIndex = maskedPercentile(Yp, masks.fg, 0, 1, [0.01])[0.01];
  return { ClipFrac, ShoulderRatio, shoulderReason, highlight_frac: highlightFrac, HighlightDesat, C_top, C_all, BloomHalo, bloomReason, VeilIndex, bright_frac: brightN / N };
}

// ---------------------------------------------------------------------------------------
// M10 — aerial perspective / atmospheric depth (single-image proxy)
// ---------------------------------------------------------------------------------------
export function M10(pl, masks) {
  const { W, H, N, Yp, Cstar } = pl;
  const horizon_y = masks.skyFrac >= 0.02 && masks.skyComp ? masks.skyComp.maxY : Math.round(0.45 * H);
  const farTop = Math.max(0, Math.round(horizon_y - 0.05 * H));
  const farBot = Math.min(H - 1, horizon_y);
  const nearTop = Math.round(0.80 * H);
  if (farBot - farTop < 32) return { unmeasurable: `the far band is only ${farBot - farTop} rows tall (horizon at y=${horizon_y}); M10 needs >= 32 rows`, horizon_y };
  const bandMask = (y0, y1) => {
    const m = new Uint8Array(N);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (masks.fg[i]) m[i] = 1; }
    return m;
  };
  const mf = bandMask(farTop, farBot), mn = bandMask(nearTop, H - 1);
  const tf = tileStdevs(Yp, mf, W, H, 32, true), tn = tileStdevs(Yp, mn, W, H, 32, true);
  if (!tf.length || !tn.length) {
    return { unmeasurable: `no full 32x32 foreground tile in the ${!tf.length ? 'far' : 'near'} band`, horizon_y, far_tiles: tf.length, near_tiles: tn.length };
  }
  const C_far = median(tf.map((t) => t.sd)), C_near = median(tn.map((t) => t.sd));
  const yf = maskedMoments(Yp, mf), yn = maskedMoments(Yp, mn);
  const cf = maskedMoments(Cstar, mf), cn = maskedMoments(Cstar, mn);
  return {
    horizon_y, far_rows: [farTop, farBot], near_rows: [nearTop, H - 1],
    C_far, C_near, R_aerial: C_far / Math.max(C_near, 1e-6),
    dY_depth: yf.mean - yn.mean, dC_depth: cf.mean - cn.mean,
    far_tiles: tf.length, near_tiles: tn.length,
  };
}

// ---------------------------------------------------------------------------------------
// M11 — LOD pop and draw-distance stability. TEMPORAL: needs an ordered frame sequence.
// ---------------------------------------------------------------------------------------
/**
 * @param {Float32Array[]} seq  Yp planes, in capture order
 * @param {object} opt {W,H, animatedMask?:Uint8Array, displacements?:number[] (metres per pair)}
 */
export function M11(seq, opt) {
  const { W, H } = opt;
  if (!seq || seq.length < 2) return { unmeasurable: 'M11 is temporal: it needs an ordered sequence of >= 2 frames (--sequence <dir>). A single still cannot show pop-in and this implementation will not invent a single-frame proxy.' };
  const N = W * H;
  const anim = opt.animatedMask || null;
  let pops = 0, worst = 0, gated = 0;
  const events = [];
  const D = new Uint8Array(N);
  for (let k = 0; k + 1 < seq.length; k++) {
    const a = seq[k], b = seq[k + 1];
    D.fill(0);
    for (let i = 0; i < N; i++) if (Math.abs(b[i] - a[i]) > 0.25 && !(anim && anim[i])) D[i] = 1;
    const { comps } = components4(D, W, H, 400);
    if (!comps.length) continue;
    const disp = opt.displacements ? opt.displacements[k] : null;
    for (const c of comps) {
      if (disp !== null && disp !== undefined && disp >= 0.07) { gated++; continue; }
      pops++;
      const frac = c.n / N;
      if (frac > worst) worst = frac;
      if (events.length < 25) events.push({ pair: [k, k + 1], area_px: c.n, frac: r6(frac), bbox: [c.minX, c.minY, c.maxX, c.maxY] });
    }
  }
  return {
    frames: seq.length, pairs: seq.length - 1,
    pops, worst_pop: worst, events,
    gated_by_displacement: gated,
    displacement_gating: opt.displacements ? 'applied' : 'NOT APPLIED — no per-pair camera displacement supplied, so RI-VIS03\'s "< 0.07 m" condition could not be enforced. Every large inter-frame change is counted, which OVER-counts pops in a fast dolly.',
    animated_mask: anim ? 'applied' : 'ANIMATED_MASK_ABSENT — no stationary pair supplied, so wind/water motion is counted as pop (RI-VIS03 M11 §note).',
  };
}

/** Animated-region mask from a stationary pair, per RI-VIS03 M11 §note. */
export function animatedMask(YpA, YpB, W, H) {
  const N = W * H, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0; i < N; i++) if (Math.abs(YpB[i] - YpA[i]) > 0.02) { m[i] = 1; n++; }
  return { mask: m, frac: n / N, empty: n === 0 };
}

// ---------------------------------------------------------------------------------------
// M12 — water plausibility. Needs a WATER_MASK; TemporalVar needs a stationary sequence.
// ---------------------------------------------------------------------------------------
export function M12(pl, water, opt = {}) {
  const { W, H, N, Yp } = pl;
  if (!water) return { unmeasurable: 'M12 needs a WATER_MASK (RI-VIS03 M12: object-id debug pass, or a hand-marked polygon). Supply --water-mask <png> (white = water). Without it there is nothing to measure and no proxy is honest.' };
  let n = 0, minY = H, maxY = -1;
  for (let i = 0; i < N; i++) if (water[i]) { n++; const y = (i / W) | 0; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (n < 4000) return { unmeasurable: `WATER_MASK covers only ${n} px; M12 needs >= 4000 to have grazing and downward bands`, water_px: n };
  const span = maxY - minY + 1;
  const grazTop = minY, grazBot = minY + Math.max(1, Math.round(span * 0.25)) - 1;
  const downTop = maxY - Math.max(1, Math.round(span * 0.25)) + 1, downBot = maxY;
  const bandMean = (y0, y1) => { let s = 0, c = 0; for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (water[i]) { s += Yp[i]; c++; } } return c ? s / c : null; };
  const gz = bandMean(grazTop, grazBot), dw = bandMean(downTop, downBot);
  const FresnelDelta = gz !== null && dw !== null ? gz - dw : null;

  // NormalEnergy: HFR (M5's definition) over the largest power-of-two square fully inside water
  let NormalEnergy = null, normalReason = null;
  const box = largestSquareInMask(water, W, H, [512, 256, 128]);
  if (!box) normalReason = 'no 128x128 (or larger) square window lies entirely inside WATER_MASK; HFR cannot be computed on a ragged region without windowing artefacts dominating it';
  else NormalEnergy = spectrum(Yp, W, H, box.k, box.x, box.y).HFR;

  // ShoreDelta: 6 px band inside the water/land boundary vs 30 px inside
  const dist = distanceFrom(invert(water, N), W, H); // distance from land, measured inside water
  let s6 = 0, n6 = 0, s30 = 0, n30 = 0;
  for (let i = 0; i < N; i++) {
    if (!water[i]) continue;
    if (dist[i] <= 6) { s6 += Yp[i]; n6++; }
    else if (dist[i] >= 28 && dist[i] <= 32) { s30 += Yp[i]; n30++; }
  }
  const ShoreDelta = n6 && n30 ? Math.abs(s6 / n6 - s30 / n30) : null;

  // ReflCorr: Pearson r between the water strip and the vertically mirrored above-water strip
  let ReflCorr = null, reflReason = null;
  {
    const farBot = minY + Math.max(1, Math.round(span * 0.5));
    const xs = [], ys = [];
    for (let y = minY; y < farBot; y++) {
      const mirror = 2 * minY - y - 1;
      if (mirror < 0) continue;
      for (let x = 0; x < W; x += 2) {
        const i = y * W + x, j = mirror * W + x;
        if (!water[i] || water[j]) continue;
        xs.push(Yp[i]); ys.push(Yp[j]);
      }
    }
    if (xs.length < 500) reflReason = `only ${xs.length} paired samples above the far half of the water; need >= 500`;
    else ReflCorr = pearson(xs, ys);
  }

  // TemporalVar: stdev over stationary frames of mean(Yp[WATER_MASK])
  let TemporalVar = null, tvReason = null;
  if (!opt.sequence || opt.sequence.length < 5) {
    tvReason = 'TemporalVar needs >= 5 stationary frames (--sequence <dir>); a still cannot show whether water moves and no single-frame proxy is honest';
  } else {
    const means = opt.sequence.map((Y) => { let s = 0, c = 0; for (let i = 0; i < N; i++) if (water[i]) { s += Y[i]; c++; } return c ? s / c : 0; });
    const m = means.reduce((a, b) => a + b, 0) / means.length;
    TemporalVar = Math.sqrt(means.reduce((a, b) => a + (b - m) ** 2, 0) / means.length);
  }
  return {
    water_px: n, water_frac: n / N,
    FresnelDelta, NormalEnergy, normalReason, ShoreDelta, ReflCorr, reflReason, TemporalVar, tvReason,
    grazing_rows: [grazTop, grazBot], downward_rows: [downTop, downBot],
    normal_window: box,
  };
}
function invert(m, N) { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = m[i] ? 0 : 1; return o; }
function pearson(a, b) {
  const n = a.length;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}
function largestSquareInMask(mask, W, H, sizes) {
  // integral image of the mask; scan on a coarse grid for speed
  const S = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let rs = 0; for (let x = 0; x < W; x++) { rs += mask[y * W + x] ? 1 : 0; S[(y + 1) * (W + 1) + (x + 1)] = S[y * (W + 1) + (x + 1)] + rs; } }
  const rect = (x0, y0, k) => S[(y0 + k) * (W + 1) + (x0 + k)] - S[y0 * (W + 1) + (x0 + k)] - S[(y0 + k) * (W + 1) + x0] + S[y0 * (W + 1) + x0];
  for (const k of sizes) {
    if (k > W || k > H) continue;
    for (let y = 0; y + k <= H; y += 16) for (let x = 0; x + k <= W; x += 16) if (rect(x, y, k) === k * k) return { x, y, k };
  }
  return null;
}
