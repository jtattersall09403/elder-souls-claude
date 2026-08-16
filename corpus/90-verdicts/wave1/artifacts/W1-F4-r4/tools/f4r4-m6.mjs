/**
 * F4 ROUND 4 — M6, A FOURTH INDEPENDENT IMPLEMENTATION, WITH `RI-VIS04` §2-D3 BUILT IN AS A GATE
 * RATHER THAN AS A FOOTNOTE.
 *
 * WHY A FOURTH. Three implementations of `RI-VIS03` M6 now agree to four decimal places (the round-2
 * critic's `m6-independent.mjs`, the round-3 builder's `f4r3-analyse.mjs`, the round-3 critic's
 * `mask-anatomy.mjs`). The round-3 critic wrote, of its own: *"A fourth implementation is the cheap
 * way to falsify me."* This is that fourth, written from `RI-VIS03` §0 and §M6 and from `RI-VIS04`
 * §2-D3 / §3-D2 directly. Where it disagrees with the third, the disagreement is the finding and it
 * is printed rather than reconciled.
 *
 * WHAT IT REFUSES TO DO, AND THIS IS THE POINT OF THE ROUND. `RI-VIS04` §2-D3 makes `hue_offset`
 * conditional on the quartiles being an illumination split. So this tool does NOT emit a bare
 * `hue_offset` verdict. It emits `hue_offset` together with:
 *
 *   clause 1  key attribution — `f_key = mean(Yp_base - Yp_key_off) / mean(Yp_base)` inside each
 *             quartile. `f_key(SHADOW) > 0.5 * f_key(LIT)` -> the window's `hue_offset` is
 *             `inapplicable`. Never PASS, never HARD FAIL.
 *   clause 2  null control — `hue_offset` recomputed on the `key_off` arm. `key_off` is the
 *             one-light configuration M6 names as its own failure mode, so it must score LOWER.
 *             Where it scores higher the reading is `inapplicable` on the same terms.
 *   clause 3  sky honesty on crops — the crop's `sky_frac` AND a recomputation with sky-hue pixels
 *             excluded from `LIT_MASK`, because `SKY_MASK` needs a component touching row 0 and a
 *             sealed crop's row 0 is arbitrary.
 *
 * `retention`, `C_shadow` and `SHADOW_MASK frac` are NOT conditional on §2-D3 — they are luminance
 * and chroma statistics of the darkest quartile and they mean what they say whatever the quartile
 * turns out to be. `RI-VIS03` M6's `retention < 0.30` HARD FAIL is unconditional in the item's own
 * words and it is what capped this item at 2 for three rounds without a single verdict recording it.
 * So it is reported FIRST, on every window, in both domains, on every arm.
 *
 * CLAUSE 3'S SKY TEST, STATED SO IT CAN BE FALSIFIED. "Sky-hue" here is: `Cstar > 6` and
 * `hue_deg` in [200, 300) — the blue-cyan wedge — AND `Yp` above the crop's foreground P60. That is
 * a heuristic, it is mine, and it is deliberately narrow: it cannot catch a grey overcast sky, and
 * on an overcast frame clause 3 therefore reports `sky_excluded == baseline` and says so rather
 * than pretending to have removed anything.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// ---------------------------------------------------------------------------------------------
// §0 common preprocessing
// ---------------------------------------------------------------------------------------------
export function decodePng(file) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json',
    '-show_streams', '-select_streams', 'v:0', file]).toString());
  const w = probe.streams[0].width, h = probe.streams[0].height;
  const rgb = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 'rawvideo',
    '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 29 });
  return { w, h, rgb };
}
function subImage(img, crop) {
  if (!crop) return img;
  const [ox, oy, cw, ch] = crop;
  const out = Buffer.allocUnsafe(cw * ch * 3);
  for (let y = 0; y < ch; y++) {
    const src = ((oy + y) * img.w + ox) * 3;
    img.rgb.copy(out, y * cw * 3, src, src + cw * 3);
  }
  return { w: cw, h: ch, rgb: out };
}

const SRGB_TO_LIN = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  SRGB_TO_LIN[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const labF = (t) => (t > 0.008856451679035631 ? Math.cbrt(t) : 7.787037037037035 * t + 16 / 116);

/** Yp, Cstar, hue_deg per pixel — `RI-VIS03` §0 exactly. */
export function planes(img) {
  const n = img.w * img.h, b = img.rgb;
  const Yp = new Float64Array(n), Cs = new Float64Array(n), Hu = new Float64Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r8 = b[p], g8 = b[p + 1], b8 = b[p + 2];
    Yp[i] = (0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8) / 255;
    const R = SRGB_TO_LIN[r8], G = SRGB_TO_LIN[g8], B = SRGB_TO_LIN[b8];
    const fx = labF((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
    const fy = labF(0.2126729 * R + 0.7151522 * G + 0.0721750 * B);
    const fz = labF((0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883);
    const aStar = 500 * (fx - fy), bStar = 200 * (fy - fz);
    Cs[i] = Math.sqrt(aStar * aStar + bStar * bStar);
    const d = Math.atan2(bStar, aStar) * 57.29577951308232;
    Hu[i] = d < 0 ? d + 360 : d;
  }
  return { Yp, Cs, Hu, n, w: img.w, h: img.h };
}

/** M4's edge magnitude, used only by M7's SKY_MASK detect. Sobel on Yp, replicate-padded. */
function gradient(Yp, w, h) {
  const G = new Float64Array(w * h);
  const px = (x, y) => Yp[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = (px(x + 1, y - 1) + 2 * px(x + 1, y) + px(x + 1, y + 1))
               - (px(x - 1, y - 1) + 2 * px(x - 1, y) + px(x - 1, y + 1));
      const gy = (px(x - 1, y + 1) + 2 * px(x, y + 1) + px(x + 1, y + 1))
               - (px(x - 1, y - 1) + 2 * px(x, y - 1) + px(x + 1, y - 1));
      G[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return G;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const s = Float64Array.from(values); s.sort();
  const k = Math.round((p / 100) * (s.length - 1));
  return s[k < 0 ? 0 : k >= s.length ? s.length - 1 : k];
}

/** M7 §detect. Largest 4-connected component of smooth bright top-45% pixels TOUCHING ROW 0. */
function skyMask(Yp, w, h) {
  const G = gradient(Yp, w, h);
  const p60 = percentile(Yp, 60);
  const rows = Math.floor(h * 0.45);
  const cand = new Uint8Array(w * h);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (G[i] < 0.02 && Yp[i] > p60) cand[i] = 1;
    }
  }
  const seen = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestId = -1, bestSize = 0, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!cand[s] || seen[s] >= 0) continue;
    let sp = 0; stack[sp++] = s; seen[s] = id;
    let size = 0, touchesRow0 = false;
    while (sp) {
      const i = stack[--sp]; size++;
      const x = i % w, y = (i - x) / w;
      if (y === 0) touchesRow0 = true;
      if (x > 0 && cand[i - 1] && seen[i - 1] < 0) { seen[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && cand[i + 1] && seen[i + 1] < 0) { seen[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && cand[i - w] && seen[i - w] < 0) { seen[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && cand[i + w] && seen[i + w] < 0) { seen[i + w] = id; stack[sp++] = i + w; }
    }
    if (touchesRow0 && size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  const sky = new Uint8Array(w * h);
  if (bestId >= 0) for (let i = 0; i < w * h; i++) if (seen[i] === bestId) sky[i] = 1;
  return sky;
}

/** Median over 32x32 tiles with >= minFrac membership, of stddev(Yp) inside the WHOLE tile. */
function tileStdMedian(Yp, w, h, member, minFrac) {
  const out = [];
  for (let ty = 0; ty + 32 <= h; ty += 32) {
    for (let tx = 0; tx + 32 <= w; tx += 32) {
      let inMask = 0, sum = 0, sumSq = 0;
      for (let y = ty; y < ty + 32; y++) {
        for (let x = tx; x < tx + 32; x++) {
          const i = y * w + x;
          if (member[i]) inMask++;
          sum += Yp[i]; sumSq += Yp[i] * Yp[i];
        }
      }
      if (inMask / 1024 < minFrac) continue;
      const m = sum / 1024;
      out.push(Math.sqrt(Math.max(0, sumSq / 1024 - m * m)));
    }
  }
  if (!out.length) return null;
  out.sort((a, b) => a - b);
  return out[out.length >> 1];
}

/** Chroma-weighted circular mean of hue, in degrees. `RI-VIS03` M6. */
function hueMean(Hu, Cs, idx) {
  let sx = 0, sy = 0, wsum = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], c = Cs[i], t = Hu[i] * 0.017453292519943295;
    sx += c * Math.cos(t); sy += c * Math.sin(t); wsum += c;
  }
  if (wsum <= 0) return null;
  const d = Math.atan2(sy, sx) * 57.29577951308232;
  return d < 0 ? d + 360 : d;
}
function circDelta(a, b) {
  if (a == null || b == null) return null;
  let d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
}
const avg = (idx, arr) => (idx.length ? idx.reduce((s, i) => s + arr[i], 0) / idx.length : null);
const rd = (x, k = 4) => (x == null || Number.isNaN(x) ? null : +x.toFixed(k));

// ---------------------------------------------------------------------------------------------
// M6 on one frame
// ---------------------------------------------------------------------------------------------
function m6Core(P) {
  const { Yp, Cs, Hu, n, w, h } = P;
  const sky = skyMask(Yp, w, h);
  const fg = [];
  for (let i = 0; i < n; i++) if (!sky[i]) fg.push(i);
  const fgYp = Float64Array.from(fg, (i) => Yp[i]);
  const p25 = percentile(fgYp, 25), p75 = percentile(fgYp, 75), p60 = percentile(fgYp, 60);
  const shadow = [], lit = [];
  const shadowM = new Uint8Array(n), fgM = new Uint8Array(n), litM = new Uint8Array(n);
  for (const i of fg) {
    fgM[i] = 1;
    if (Yp[i] < p25) { shadow.push(i); shadowM[i] = 1; }
    else if (Yp[i] > p75) { lit.push(i); litM[i] = 1; }
  }
  const cLocal = tileStdMedian(Yp, w, h, fgM, 1.0);
  const cShadowMed = tileStdMedian(Yp, w, h, shadowM, 0.5);
  const hs = hueMean(Hu, Cs, shadow), hl = hueMean(Hu, Cs, lit);
  let skyN = 0; for (let i = 0; i < n; i++) skyN += sky[i];
  return {
    sky, fg, shadow, lit, shadowM, litM, fgM, p25, p75, p60,
    out: {
      sky_frac: rd(skyN / n),
      shadow_mask_frac: rd(shadow.length / n),
      C_local_med: rd(cLocal, 6),
      C_shadow_med: rd(cShadowMed, 6),
      retention: rd(cShadowMed == null || cLocal == null ? null : cShadowMed / Math.max(cLocal, 1e-6)),
      hue_shadow_deg: rd(hs, 2), hue_lit_deg: rd(hl, 2), hue_offset_deg: rd(circDelta(hs, hl), 2),
      C_shadow: rd(avg(shadow, Cs), 4),
      C_lit: rd(avg(lit, Cs), 4),
      mean_Yp_shadow: rd(avg(shadow, Yp)),
      mean_Yp_lit: rd(avg(lit, Yp)),
      mean_Yp_fg: rd(avg(fg, Yp)),
    },
  };
}

/** `exterior_daylight` profile row of `RI-VIS03` M6, plus the item's own unconditional fails. */
export const PROFILE = {
  exterior_daylight: { retention: 0.60, hue_offset: 15, shadow_frac: 0.03, C_shadow: 6 },
};
function judge(m, profile = 'exterior_daylight') {
  const P = PROFILE[profile];
  const hard = [], soft = [];
  if (m.retention != null && m.retention < 0.30) hard.push('retention<0.30 CRUSHED BLACKS / NO AMBIENT / NO IBL');
  if (m.shadow_mask_frac != null && m.shadow_mask_frac < 0.03) hard.push('SHADOW_MASK<3% NO SHADOW CASTING');
  if (m.hue_offset_deg != null && m.hue_offset_deg < 6) hard.push('hue_offset<6 ONE LIGHT SOURCE ONLY (caps shot at 4)');
  if (m.retention != null && m.retention < P.retention && m.retention >= 0.30) soft.push('retention<profile-min');
  if (m.hue_offset_deg != null && m.hue_offset_deg < P.hue_offset && m.hue_offset_deg >= 6) soft.push('hue_offset<profile-min');
  if (m.C_shadow != null && m.C_shadow < P.C_shadow) soft.push('C_shadow<profile-min');
  return { profile, hard_fails: hard, soft_fails: soft, all_clauses_pass: !hard.length && !soft.length };
}

// ---------------------------------------------------------------------------------------------
// The public entry: one window, one domain, all §2-D3 clauses
// ---------------------------------------------------------------------------------------------
/**
 * @param {{base:string, key_off?:string, env_off?:string, shadows_off?:string,
 *          base_recheck?:string, crop?:number[]|null, label:string, profile?:string}} spec
 */
export function measure(spec) {
  const crop = spec.crop || null;
  const load = (f) => planes(subImage(decodePng(f), crop));
  const B = load(spec.base);
  const core = m6Core(B);
  const row = {
    label: spec.label, domain: crop ? 'sealed_judged_crop' : 'full_frame', crop,
    frames: { base: spec.base },
    m6: core.out,
    verdict: judge(core.out, spec.profile),
  };

  // ---- §2-D3 clause 3: sky honesty on crops -------------------------------------------------
  {
    const { Yp, Cs, Hu } = B;
    const litNoSky = [], skyish = [];
    let skyChroma = 0, litChroma = 0;
    for (const i of core.lit) {
      litChroma += Cs[i];
      const isSky = Cs[i] > 6 && Hu[i] >= 200 && Hu[i] < 300 && Yp[i] > core.p60;
      if (isSky) { skyish.push(i); skyChroma += Cs[i]; } else litNoSky.push(i);
    }
    const hlNo = hueMean(Hu, Cs, litNoSky);
    const hs = core.out.hue_shadow_deg;
    row.d3_clause3_sky_honesty = {
      what: 'SKY_MASK needs a 4-connected component touching row 0; a sealed crop has an arbitrary row 0, so sky inside a crop lands in LIT_MASK. Sky-hue = Cstar>6 AND hue in [200,300) AND Yp>fg P60.',
      sky_frac_reported_by_SKY_MASK: core.out.sky_frac,
      sky_hue_frac_of_LIT_MASK_by_count: rd(skyish.length / Math.max(1, core.lit.length)),
      sky_hue_frac_of_LIT_MASK_by_chroma_weight: rd(skyChroma / Math.max(1e-9, litChroma)),
      hue_lit_deg_sky_excluded: rd(hlNo, 2),
      hue_offset_deg_sky_excluded: rd(circDelta(hs, hlNo), 2),
      moves_hue_offset_by_deg: rd(circDelta(hs, hlNo) == null || core.out.hue_offset_deg == null
        ? null : circDelta(hs, hlNo) - core.out.hue_offset_deg, 2),
    };
  }

  // ---- §2-D3 clause 1: key attribution ------------------------------------------------------
  if (spec.key_off && fs.existsSync(spec.key_off)) {
    const K = load(spec.key_off);
    row.frames.key_off = spec.key_off;
    const dK = new Float64Array(B.n);
    for (let i = 0; i < B.n; i++) dK[i] = B.Yp[i] - K.Yp[i];
    const kS = avg(core.shadow, dK), kL = avg(core.lit, dK);
    const yS = avg(core.shadow, B.Yp), yL = avg(core.lit, B.Yp);
    const fkS = kS / Math.max(1e-9, yS), fkL = kL / Math.max(1e-9, yL);
    const inapplicable = fkS > 0.5 * fkL;
    row.d3_clause1_key_attribution = {
      what: 'f_key = mean(Yp_base - Yp_key_off) / mean(Yp_base) inside each quartile, key_off captured in the SAME PROCESS as base.',
      f_key_SHADOW_MASK: rd(fkS), f_key_LIT_MASK: rd(fkL),
      test: 'f_key(SHADOW) > 0.5 * f_key(LIT)  ->  hue_offset is inapplicable',
      inapplicable,
      frac_SHADOW_MASK_receiving_no_key_below_1_of_255:
        rd(core.shadow.filter((i) => dK[i] * 255 < 1).length / Math.max(1, core.shadow.length)),
      frac_LIT_MASK_receiving_no_key_below_1_of_255:
        rd(core.lit.filter((i) => dK[i] * 255 < 1).length / Math.max(1, core.lit.length)),
      auc_key_separates_LIT_from_SHADOW: rd(auc(dK, core.lit, core.shadow)),
    };

    // ---- §2-D3 clause 2: the null control, published ----------------------------------------
    const nullCore = m6Core(K);
    row.d3_clause2_null_control = {
      what: 'M6 recomputed on the key_off arm — the "one light source only" configuration M6 names as its own failure mode. It MUST score lower than the shipped arm.',
      key_off_hue_offset_deg: nullCore.out.hue_offset_deg,
      key_off_retention: nullCore.out.retention,
      key_off_C_shadow: nullCore.out.C_shadow,
      key_off_mean_Yp_shadow: nullCore.out.mean_Yp_shadow,
      shipped_hue_offset_deg: core.out.hue_offset_deg,
      null_scores_higher: nullCore.out.hue_offset_deg != null && core.out.hue_offset_deg != null
        && nullCore.out.hue_offset_deg > core.out.hue_offset_deg,
    };
    const c2Bad = row.d3_clause2_null_control.null_scores_higher;
    row.hue_offset_status = (inapplicable || c2Bad) ? 'inapplicable' : 'applicable';
    row.hue_offset_inapplicable_because = [
      inapplicable ? 'clause 1: the quartiles are not an illumination split' : null,
      c2Bad ? 'clause 2: deleting the key scores HIGHER' : null,
    ].filter(Boolean);
  } else {
    row.hue_offset_status = 'unvalidated — no same-run key_off arm (§2-D3 records the budget UNVERIFIED, which counts as absent)';
    row.hue_offset_inapplicable_because = ['no key_off arm'];
  }

  // ---- §3-D2 cast-shadow ablation mask, as a curve over tau ---------------------------------
  if (spec.shadows_off && fs.existsSync(spec.shadows_off)) {
    const S = load(spec.shadows_off);
    row.frames.shadows_off = spec.shadows_off;
    const cast = {};
    for (const tau of [1, 2, 4, 8, 16]) {
      let n = 0, inShadowQ = 0, inLitQ = 0;
      for (let i = 0; i < B.n; i++) {
        if (!core.fgM[i]) continue;
        if ((S.Yp[i] - B.Yp[i]) * 255 > tau) {
          n++;
          if (core.shadowM[i]) inShadowQ++; else if (core.litM[i]) inLitQ++;
        }
      }
      cast[`tau${tau}`] = {
        area_frac_of_image: rd(n / B.n),
        area_frac_of_fg: rd(n / Math.max(1, core.fg.length)),
        p_cast_given_SHADOW_MASK: rd(inShadowQ / Math.max(1, core.shadow.length)),
        p_cast_given_LIT_MASK: rd(inLitQ / Math.max(1, core.lit.length)),
      };
    }
    row.d3_2_cast_shadow_area = cast;
  }

  // ---- S60 clause (a) on the lit subset ------------------------------------------------------
  if (spec.key_off && spec.env_off && spec.shadows_off
      && fs.existsSync(spec.key_off) && fs.existsSync(spec.env_off) && fs.existsSync(spec.shadows_off)) {
    const K = load(spec.key_off), E = load(spec.env_off), S = load(spec.shadows_off);
    row.frames.env_off = spec.env_off;
    // S60: the ablation is valid only on the support of the thing ablated — the pixels the shadow
    // map reports UNOCCLUDED. tau8 per HAZARDS §24.
    const litSubset = [];
    for (let i = 0; i < B.n; i++) if (core.fgM[i] && (S.Yp[i] - B.Yp[i]) * 255 <= 8) litSubset.push(i);
    // mean |delta| in display luma x 255 over the lit subset
    const dOf = (O) => {
      let s = 0;
      for (const i of litSubset) s += Math.abs(B.Yp[i] - O.Yp[i]) * 255;
      return litSubset.length ? s / litSubset.length : null;
    };
    const kd = dOf(K), ed = dOf(E);
    row.s60_clause_a = {
      what: 'key_off delta >= 2.0 x env_off delta, measured ONLY on the lit subset (shadow-map ablation, tau8) — S60 as repaired.',
      lit_subset_frac_of_fg: rd(litSubset.length / Math.max(1, core.fg.length)),
      key_off_delta: rd(kd, 4), env_off_delta: rd(ed, 4),
      ratio: rd(kd == null || !ed ? null : kd / ed, 4), bar: 2.0,
      pass: kd != null && ed ? (kd / ed) >= 2.0 : null,
    };
  }

  // ---- S61: this run's own floor, from base vs base_recheck ---------------------------------
  if (spec.base_recheck && fs.existsSync(spec.base_recheck)) {
    const R2 = load(spec.base_recheck);
    const rc = m6Core(R2);
    let s = 0; for (let i = 0; i < B.n; i++) s += Math.abs(B.Yp[i] - R2.Yp[i]) * 255;
    row.s61_run_floor = {
      what: 'base re-captured AFTER every other arm — this run\'s own noise floor. Every arm above is read as a multiple of it.',
      mean_abs_luma_delta_255: rd(s / B.n, 4),
      hue_offset_deg_recheck: rc.out.hue_offset_deg,
      hue_offset_floor_deg: rd(circDelta(rc.out.hue_offset_deg, core.out.hue_offset_deg), 2),
      retention_recheck: rc.out.retention,
      retention_floor: rd(rc.out.retention == null || core.out.retention == null
        ? null : Math.abs(rc.out.retention - core.out.retention)),
    };
  }
  return row;
}

function auc(v, pos, neg) {
  const thin = (a, cap) => (a.length <= cap ? a : a.filter((_, j) => j % Math.ceil(a.length / cap) === 0));
  const P = thin(pos, 3000).map((i) => v[i]).sort((a, b) => a - b);
  const N = thin(neg, 3000).map((i) => v[i]).sort((a, b) => a - b);
  if (!P.length || !N.length) return null;
  // merge-count: for each p, how many n are strictly below, plus half the ties
  let wins = 0, j = 0, ties = 0;
  for (const p of P) {
    while (j < N.length && N[j] < p) j++;
    wins += j;
    let t = j; while (t < N.length && N[t] === p) { t++; }
    ties += t - j;
  }
  return (wins + 0.5 * ties) / (P.length * N.length);
}

// ---------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const rows = [];
  for (const win of spec.windows) {
    for (const domain of (spec.domains || ['crop', 'frame'])) {
      const crop = domain === 'crop' ? win.crop : null;
      const files = {};
      for (const arm of ['base', 'shadows_off', 'key_off', 'env_off', 'base_recheck']) {
        const p = `${win.dir}/${win.prefix}__${arm}.png`;
        if (fs.existsSync(p)) files[arm] = p;
      }
      if (!files.base) { rows.push({ label: `${win.label}/${domain}`, error: `no base frame at ${win.dir}/${win.prefix}__base.png` }); continue; }
      rows.push(measure({ ...files, crop, label: `${win.label}/${domain}`, profile: win.profile || 'exterior_daylight' }));
    }
  }
  const out = { tool: 'f4r4-m6.mjs (fourth independent M6)', spec: spec.name, at: new Date().toISOString(), rows };
  if (spec.out) fs.writeFileSync(spec.out, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
