/**
 * MASK ANATOMY — the F4 round-3 CRITIC's test of ruling S66's named overturn condition.
 *
 * S66: "M6's SHADOW_MASK is the darkest quartile BY CONSTRUCTION. Where a crop holds almost no
 * cast shadow, that quartile is DARK LIT PIXELS wearing the key's own hue." Its overturn
 * condition, as written: "a critic shows the quartile mask holds a real lit/shadow split at low
 * shadow area."
 *
 * "A real lit/shadow split" is not a matter of opinion once you have the ablation arms. The round
 * captured, IN THE SAME PROCESS as every base, a `key_off` arm and a `shadows_off` arm. So for
 * every pixel we can compute:
 *
 *   K = Yp(base) - Yp(key_off)   -- how much DIRECT KEY LIGHT that pixel actually receives
 *   E = Yp(base) - Yp(env_off)   -- how much the environment probe gives it
 *   S = Yp(shadows_off) - Yp(base) -- how much CAST SHADOW is taken off it (RI-VIS04 s3-D2)
 *
 * and then ask the question S66 turns on: IS THE DARKEST QUARTILE KEY-LIT OR NOT?
 *   f_key = mean(K) / mean(Yp) inside a mask -- the share of a mask's brightness owned by the key.
 * If the shadow quartile's f_key is comparable to the lit quartile's, S66 is right: those pixels
 * wear the key's hue and recolouring the key moves them, with nothing better lit.
 * If the shadow quartile's f_key is far lower, the quartile IS a lit/shadow split in the only
 * sense RI-VIS04 s2 cares about (a surface whose colour comes from the environment, not the key),
 * S66's mechanism is wrong, and the cool key deserves re-testing.
 *
 * NOTE ON "SHADOW": RI-VIS04 s2's own DETECT says "find a smooth convex object; its shaded side
 * should have a gradient around the terminator". A TERMINATOR IS NOT A CAST SHADOW. So this tool
 * separates the two: `cast` (shadow-map ablation, s3-D2) and `unkeyed` (K below a floor), because
 * S66 conflates them and the difference is the whole argument.
 *
 * Everything here is written from `RI-VIS03` s0/M6 and `RI-VIS04` s3-D2 directly. The M6 numbers
 * it reproduces are cross-checked against the r2 critic's `m6-independent.mjs` by the caller;
 * this is a THIRD implementation and disagreement is the point.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function decode(png) {
  const meta = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json',
    '-show_streams', '-select_streams', 'v:0', png]).toString());
  const W = meta.streams[0].width, H = meta.streams[0].height;
  const buf = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo',
    '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  return { W, H, buf };
}
function cropOf({ W, H, buf }, c) {
  if (!c) return { W, H, buf };
  const [x0, y0, cw, ch] = c;
  const out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) buf.copy(out, y * cw * 3, ((y0 + y) * W + x0) * 3, ((y0 + y) * W + x0 + cw) * 3);
  return { W: cw, H: ch, buf: out };
}
// RI-VIS03 s0
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fl = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
function fields(img) {
  const { W, H, buf } = img, N = W * H;
  const Yp = new Float64Array(N), C = new Float64Array(N), Hd = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const r = buf[3 * i] / 255, g = buf[3 * i + 1] / 255, b = buf[3 * i + 2] / 255;
    Yp[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const R = s2l(r), G = s2l(g), B = s2l(b);
    const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
    const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
    const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;
    const fx = fl(X / 0.95047), fy = fl(Y / 1.0), fz = fl(Z / 1.08883);
    const a = 500 * (fx - fy), bb = 200 * (fy - fz);
    C[i] = Math.hypot(a, bb);
    let h = Math.atan2(bb, a) * 180 / Math.PI; if (h < 0) h += 360;
    Hd[i] = h;
  }
  return { Yp, C, Hd, N, W, H };
}
function sobel(Yp, W, H) {
  const G = new Float64Array(W * H);
  const at = (x, y) => Yp[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    G[y * W + x] = Math.hypot(gx, gy);
  }
  return G;
}
function pctOf(arr, idx, p) {
  const v = Float64Array.from(idx, (i) => arr[i]); v.sort();
  if (!v.length) return 0;
  return v[Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))))];
}
function skyMask(Yp, G, W, H) {
  const all = []; for (let i = 0; i < W * H; i++) all.push(i);
  const p60 = pctOf(Yp, all, 60), rowLimit = Math.floor(H * 0.45);
  const cand = new Uint8Array(W * H);
  for (let y = 0; y < rowLimit; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (G[i] < 0.02 && Yp[i] > p60) cand[i] = 1;
  }
  const lab = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0, comp = 0;
  for (let s = 0; s < W * H; s++) {
    if (!cand[s] || lab[s] >= 0) continue;
    const st = [s]; lab[s] = comp; let n = 0, t0 = false;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % W, y = (i / W) | 0; if (y === 0) t0 = true;
      const nb = [];
      if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
      for (const j of nb) if (cand[j] && lab[j] < 0) { lab[j] = comp; st.push(j); }
    }
    if (t0 && n > bestN) { bestN = n; best = comp; }
    comp++;
  }
  const sky = new Uint8Array(W * H);
  if (best >= 0) for (let i = 0; i < W * H; i++) if (lab[i] === best) sky[i] = 1;
  return sky;
}
function tileStd(Yp, W, H, member, minFrac) {
  const out = [];
  for (let ty = 0; ty + 32 <= H; ty += 32) for (let tx = 0; tx + 32 <= W; tx += 32) {
    let n = 0, s = 0, s2 = 0;
    for (let y = ty; y < ty + 32; y++) for (let x = tx; x < tx + 32; x++) {
      const i = y * W + x; if (member[i]) n++;
      s += Yp[i]; s2 += Yp[i] * Yp[i];
    }
    if (n / 1024 < minFrac) continue;
    const m = s / 1024; out.push(Math.sqrt(Math.max(0, s2 / 1024 - m * m)));
  }
  out.sort((a, b) => a - b);
  return out.length ? out[(out.length / 2) | 0] : null;
}
function circMean(Hd, C, idx) {
  let sx = 0, sy = 0, w = 0;
  for (const i of idx) { const c = C[i], t = Hd[i] * Math.PI / 180; sx += c * Math.cos(t); sy += c * Math.sin(t); w += c; }
  if (w <= 0) return null;
  let d = Math.atan2(sy, sx) * 180 / Math.PI; if (d < 0) d += 360;
  return d;
}
const mean = (idx, a) => idx.length ? idx.reduce((s, i) => s + a[i], 0) / idx.length : null;
const r4 = (x) => (x == null ? null : +x.toFixed(4));
const r2 = (x) => (x == null ? null : +x.toFixed(2));

export function anatomy({ base, shadows_off, key_off, env_off, crop, label }) {
  const B = fields(cropOf(decode(base), crop));
  const SO = shadows_off ? fields(cropOf(decode(shadows_off), crop)) : null;
  const KO = key_off ? fields(cropOf(decode(key_off), crop)) : null;
  const EO = env_off ? fields(cropOf(decode(env_off), crop)) : null;
  const { W, H, N, Yp, C, Hd } = B;
  const sky = skyMask(Yp, sobel(Yp, W, H), W, H);
  const fg = []; for (let i = 0; i < N; i++) if (!sky[i]) fg.push(i);
  const p25 = pctOf(Yp, fg, 25), p75 = pctOf(Yp, fg, 75);
  const shadow = [], lit = [], mid = [];
  const shadowM = new Uint8Array(N), fgM = new Uint8Array(N);
  for (const i of fg) {
    fgM[i] = 1;
    if (Yp[i] < p25) { shadow.push(i); shadowM[i] = 1; }
    else if (Yp[i] > p75) lit.push(i);
    else mid.push(i);
  }
  // ---- my own M6, third implementation ----
  const C_local_med = tileStd(Yp, W, H, fgM, 1.0);
  const C_shadow_med = tileStd(Yp, W, H, shadowM, 0.5);
  const hs = circMean(Hd, C, shadow), hl = circMean(Hd, C, lit);
  let off = null; if (hs != null && hl != null) { off = Math.abs(hs - hl); if (off > 180) off = 360 - off; }
  const m6 = {
    sky_frac: r4(sky.reduce((s, v) => s + v, 0) / N),
    shadow_mask_frac: r4(shadow.length / N),
    C_local_med: r4(C_local_med), retention: r4(C_shadow_med / Math.max(C_local_med, 1e-6)),
    hue_shadow_deg: r2(hs), hue_lit_deg: r2(hl), hue_offset_deg: r2(off),
    C_shadow: r4(mean(shadow, C)), mean_Yp_shadow: r4(mean(shadow, Yp)), mean_Yp_lit: r4(mean(lit, Yp)),
  };
  const out = { label, W, H, crop, m6 };

  // ---- RI-VIS04 s3-D2 cast-shadow ablation mask, over tau, in 0..255 display luma ----
  if (SO) {
    const cast = {};
    for (const tau of [1, 2, 4, 8, 16]) {
      let n = 0, nS = 0, nL = 0;
      for (let i = 0; i < N; i++) {
        if (!fgM[i]) continue;
        if ((SO.Yp[i] - Yp[i]) * 255 > tau) { n++; if (shadowM[i]) nS++; else if (Yp[i] > p75) nL++; }
      }
      cast[`tau${tau}`] = {
        area_frac_of_image: r4(n / N),
        area_frac_of_fg: r4(n / fg.length),
        // S66's crux: how much of the "shadow" quartile is actually cast-shadowed
        p_cast_given_shadow_quartile: r4(nS / Math.max(1, shadow.length)),
        p_cast_given_lit_quartile: r4(nL / Math.max(1, lit.length)),
        // and the converse: of the cast-shadowed pixels, how many land in the shadow quartile
        p_shadow_quartile_given_cast: r4(nS / Math.max(1, n)),
      };
    }
    out.cast_shadow = cast;
  }

  // ---- THE DECISIVE NUMBER: who owns each quartile's brightness ----
  if (KO) {
    const K = new Float64Array(N);
    for (let i = 0; i < N; i++) K[i] = Yp[i] - KO.Yp[i];
    const kS = mean(shadow, K), kL = mean(lit, K), kM = mean(mid, K);
    const yS = mean(shadow, Yp), yL = mean(lit, Yp);
    out.key_attribution = {
      what_it_is: "K = Yp(base) - Yp(key_off), the direct key contribution per pixel, measured in the same process as the base (HAZARDS s12/s22).",
      mean_K_shadow_quartile: r4(kS), mean_K_lit_quartile: r4(kL), mean_K_mid: r4(kM),
      // f_key: the share of a quartile's brightness that the key owns
      f_key_shadow_quartile: r4(kS / Math.max(1e-9, yS)),
      f_key_lit_quartile: r4(kL / Math.max(1e-9, yL)),
      key_separation_ratio_lit_over_shadow: r4(kL / Math.max(1e-9, kS)),
      // how many shadow-quartile pixels receive essentially no key at all
      frac_shadow_quartile_with_K_below_1_255: r4(shadow.filter((i) => K[i] * 255 < 1).length / Math.max(1, shadow.length)),
      frac_lit_quartile_with_K_below_1_255: r4(lit.filter((i) => K[i] * 255 < 1).length / Math.max(1, lit.length)),
      // AUC: probability a random lit-quartile pixel receives more key than a random shadow-quartile pixel
      auc_K_separates_quartiles: r4(auc(K, lit, shadow)),
    };
    // hue of the key-unlit set vs the key-lit set, independent of the luminance quartile
    const kAll = fg.map((i) => K[i]).sort((a, b) => a - b);
    const kMed = kAll[(kAll.length / 2) | 0];
    const unkeyed = fg.filter((i) => K[i] < kMed * 0.25), keyed = fg.filter((i) => K[i] > kMed);
    const hu = circMean(Hd, C, unkeyed), hk = circMean(Hd, C, keyed);
    let offK = null; if (hu != null && hk != null) { offK = Math.abs(hu - hk); if (offK > 180) offK = 360 - offK; }
    out.physical_split = {
      what_it_is: "A lit/shadow split derived from the KEY ABLATION rather than from a luminance percentile: `unkeyed` = K < 25% of the foreground median K, `keyed` = K > median. This is the split RI-VIS04 s2 actually describes.",
      unkeyed_frac_of_fg: r4(unkeyed.length / fg.length), keyed_frac_of_fg: r4(keyed.length / fg.length),
      hue_unkeyed_deg: r2(hu), hue_keyed_deg: r2(hk), hue_offset_physical_deg: r2(offK),
      mean_Yp_unkeyed: r4(mean(unkeyed, Yp)), mean_Yp_keyed: r4(mean(keyed, Yp)),
      overlap_unkeyed_with_shadow_quartile: r4(unkeyed.filter((i) => shadowM[i]).length / Math.max(1, unkeyed.length)),
    };
  }
  if (EO) {
    const E = new Float64Array(N);
    for (let i = 0; i < N; i++) E[i] = Yp[i] - EO.Yp[i];
    out.env_attribution = {
      mean_E_shadow_quartile: r4(mean(shadow, E)), mean_E_lit_quartile: r4(mean(lit, E)),
      f_env_shadow_quartile: r4(mean(shadow, E) / Math.max(1e-9, mean(shadow, Yp))),
      f_env_lit_quartile: r4(mean(lit, E) / Math.max(1e-9, mean(lit, Yp))),
    };
  }
  return out;
}
function auc(K, pos, neg) {
  // rank-based AUC, sampled if the sets are large (deterministic stride, no RNG)
  const take = (arr, cap) => (arr.length <= cap ? arr : arr.filter((_, j) => j % Math.ceil(arr.length / cap) === 0));
  const P = take(pos, 4000).map((i) => K[i]), Nn = take(neg, 4000).map((i) => K[i]);
  let win = 0, tie = 0;
  for (const p of P) for (const n of Nn) { if (p > n) win++; else if (p === n) tie++; }
  return (win + 0.5 * tie) / (P.length * Nn.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const rows = [];
  for (const w of spec.windows) {
    for (const dom of spec.domains) {
      const crop = dom === 'crop' ? w.crop : null;
      const args = { crop, label: `${w.label}/${dom}` };
      for (const k of ['base', 'shadows_off', 'key_off', 'env_off']) {
        const p = `${w.dir}/${w.prefix}__${k}.png`;
        if (fs.existsSync(p)) args[k] = p;
      }
      if (!args.base) { rows.push({ label: args.label, error: 'no base frame' }); continue; }
      rows.push(anatomy(args));
    }
  }
  console.log(JSON.stringify({ spec: spec.name, at: new Date().toISOString(), rows }, null, 1));
}
