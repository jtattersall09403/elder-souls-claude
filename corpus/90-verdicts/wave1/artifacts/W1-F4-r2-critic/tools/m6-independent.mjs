/**
 * M6 / M2 / M7 RE-IMPLEMENTED FROM `RI-VIS03` §0 AND §M6 BY THE F4 ROUND-2 CRITIC.
 *
 * WHY THIS EXISTS. The F4 round-1 critic wrote, against itself: *"MY M6 IMPLEMENTATION IS MINE.
 * RI-VIS03 ships pseudocode, not code ... A re-implementation by another critic is the cheap way
 * to falsify me."* The round-2 builder then REUSED that same implementation (`f4c-analyse.mjs`)
 * rather than reimplementing, which is the right call for comparability and leaves the instrument
 * itself unfalsified across two rounds. Both rounds' hard fail rests on it. This file is written
 * from the reference item's pseudocode WITHOUT reading `f4c-analyse.mjs` first, so that agreement
 * between them is evidence and not a shared bug.
 *
 * Usage: node m6-independent.mjs <png> [<png> ...]        (each image judged whole)
 *        node m6-independent.mjs --crop x,y,w,h <png> ...  (judged on the sealed crop)
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

// ---- RI-VIS03 §0 colour ----------------------------------------------------------------------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;   // D65, 2 deg

function fields({ W, H, buf }) {
  const N = W * H;
  const Yp = new Float64Array(N), Cs = new Float64Array(N), Hu = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const r = buf[i * 3] / 255, g = buf[i * 3 + 1] / 255, b = buf[i * 3 + 2] / 255;
    Yp[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;      // RI-VIS03 §0: "display luminance", 0..1
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
    const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
    const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;
    const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
    const a = 500 * (fx - fy), bb = 200 * (fy - fz);
    Cs[i] = Math.hypot(a, bb);
    Hu[i] = Math.atan2(bb, a) * 180 / Math.PI;
    if (Hu[i] < 0) Hu[i] += 360;
  }
  return { Yp, Cs, Hu, N };
}
function pct(arr, idx, p) {
  const v = Float64Array.from(idx, (i) => arr[i]); v.sort();
  if (!v.length) return 0;
  const k = Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))));
  return v[k];
}
function sobelG(Yp, W, H) {
  // RI-VIS03 M4: G = sqrt((Yp*Sx)^2 + (Yp*Sy)^2), replicate border.
  const G = new Float64Array(W * H);
  const at = (x, y) => Yp[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    G[y * W + x] = Math.hypot(gx, gy);
  }
  return G;
}
function skyMask(Yp, G, W, H) {
  // RI-VIS03 M7 detect: candidate = top 45% of ROWS, G < 0.02, Yp > P60(Yp);
  //                     SKY_MASK = largest 4-connected component touching row 0.
  const all = []; for (let i = 0; i < W * H; i++) all.push(i);
  const p60 = pct(Yp, all, 60);
  const rowLimit = Math.floor(H * 0.45);
  const cand = new Uint8Array(W * H);
  for (let y = 0; y < rowLimit; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (G[i] < 0.02 && Yp[i] > p60) cand[i] = 1;
  }
  const lab = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0;
  let comp = 0;
  for (let s = 0; s < W * H; s++) {
    if (!cand[s] || lab[s] >= 0) continue;
    const stack = [s]; lab[s] = comp; let n = 0, touches0 = false;
    while (stack.length) {
      const i = stack.pop(); n++;
      const x = i % W, y = (i / W) | 0;
      if (y === 0) touches0 = true;
      const nb = [];
      if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
      for (const j of nb) if (cand[j] && lab[j] < 0) { lab[j] = comp; stack.push(j); }
    }
    if (touches0 && n > bestN) { bestN = n; best = comp; }
    comp++;
  }
  const sky = new Uint8Array(W * H);
  if (best >= 0) for (let i = 0; i < W * H; i++) if (lab[i] === best) sky[i] = 1;
  return { sky, sky_frac: bestN / (W * H) };
}
function tileStd(Yp, W, H, member, minFrac) {
  const out = [];
  for (let ty = 0; ty + 32 <= H; ty += 32) for (let tx = 0; tx + 32 <= W; tx += 32) {
    let n = 0, s = 0, s2 = 0;
    for (let y = ty; y < ty + 32; y++) for (let x = tx; x < tx + 32; x++) {
      const i = y * W + x;
      if (member[i]) n++;
      s += Yp[i]; s2 += Yp[i] * Yp[i];
    }
    if (n / 1024 < minFrac) continue;
    const m = s / 1024;
    out.push(Math.sqrt(Math.max(0, s2 / 1024 - m * m)));
  }
  out.sort((a, b) => a - b);
  return out.length ? out[(out.length / 2) | 0] : null;
}
function circMean(Hu, Cs, idx) {
  let sx = 0, sy = 0, w = 0;
  for (const i of idx) { const c = Cs[i], t = Hu[i] * Math.PI / 180; sx += c * Math.cos(t); sy += c * Math.sin(t); w += c; }
  if (w <= 0) return null;
  let d = Math.atan2(sy, sx) * 180 / Math.PI; if (d < 0) d += 360;
  return d;
}
export function measure(png, crop) {
  const img = cropOf(decode(png), crop);
  const { W, H, buf } = img;
  const { Yp, Cs, Hu, N } = fields(img);
  const G = sobelG(Yp, W, H);
  const { sky, sky_frac } = skyMask(Yp, G, W, H);
  const fg = []; for (let i = 0; i < N; i++) if (!sky[i]) fg.push(i);
  const p25 = pct(Yp, fg, 25), p75 = pct(Yp, fg, 75);
  const shadow = [], lit = [];
  const shadowM = new Uint8Array(N), fgM = new Uint8Array(N);
  for (const i of fg) { fgM[i] = 1; if (Yp[i] < p25) { shadow.push(i); shadowM[i] = 1; } else if (Yp[i] > p75) lit.push(i); }
  const C_local_med = tileStd(Yp, W, H, fgM, 1.0);
  const C_shadow_med = tileStd(Yp, W, H, shadowM, 0.5);
  const hs = circMean(Hu, Cs, shadow), hl = circMean(Hu, Cs, lit);
  let off = null;
  if (hs != null && hl != null) { off = Math.abs(hs - hl); if (off > 180) off = 360 - off; }
  const mean = (idx, a) => idx.reduce((s, i) => s + a[i], 0) / Math.max(1, idx.length);
  return {
    file: png, W, H, sky_frac: +sky_frac.toFixed(4),
    shadow_mask_frac: +(shadow.length / N).toFixed(4),
    C_local_med: C_local_med == null ? null : +C_local_med.toFixed(4),
    retention: (C_shadow_med == null || C_local_med == null) ? null : +(C_shadow_med / Math.max(C_local_med, 1e-6)).toFixed(4),
    hue_shadow_deg: hs == null ? null : +hs.toFixed(2),
    hue_lit_deg: hl == null ? null : +hl.toFixed(2),
    hue_offset_deg: off == null ? null : +off.toFixed(2),
    C_shadow: +mean(shadow, Cs).toFixed(3),
    mean_Yp_shadow: +mean(shadow, Yp).toFixed(4),
    mean_Yp_lit: +mean(lit, Yp).toFixed(4),
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  let crop = null;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--crop') { crop = argv[++i].split(',').map(Number); continue; }
    files.push(argv[i]);
  }
  const rows = [];
  for (const p of files) { if (!fs.existsSync(p)) { console.error('missing', p); continue; } rows.push(measure(p, crop)); }
  console.log(JSON.stringify({ crop, rows }, null, 1));
}
