/**
 * NULL CONTROL FOR M6 — the test S63 says every metric owes and that M6 has never been given.
 *
 * `RI-VIS03` M6 states its own failure mode in words: "`hue_offset < 6` -> ONE LIGHT SOURCE ONLY.
 * A single white DirectionalLight plus a white AmbientLight produces hue_offset ~ 0, and this
 * metric catches it in one number."
 *
 * The round captured, in the same process as every base, a `key_off` arm: sun intensity 0. That
 * frame IS a one-light-source frame — the environment probe and the fills, no key at all. If M6
 * is measuring what it says it measures, `key_off` must score LOWER than the shipped build.
 * If it scores HIGHER, the number is not reporting the illuminant.
 *
 * Also reported: how much of `LIT_MASK` is SKY that `RI-VIS03`'s SKY_MASK failed to remove.
 * SKY_MASK is "the largest 4-connected component of smooth bright pixels TOUCHING ROW 0". In a
 * sealed 512x512 crop whose top row is roof, no sky component touches row 0, so the sky in the
 * crop is classified as foreground and lands in LIT_MASK.
 */
import { anatomy } from './mask-anatomy.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function decode(png) {
  const meta = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json',
    '-show_streams', '-select_streams', 'v:0', png]).toString());
  return { W: meta.streams[0].width, H: meta.streams[0].height,
    buf: execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }) };
}
function cropOf({ W, H, buf }, c) {
  if (!c) return { W, H, buf };
  const [x0, y0, cw, ch] = c; const out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) buf.copy(out, y * cw * 3, ((y0 + y) * W + x0) * 3, ((y0 + y) * W + x0 + cw) * 3);
  return { W: cw, H: ch, buf: out };
}
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fl = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
function lab(buf, i) {
  const r = buf[3 * i] / 255, g = buf[3 * i + 1] / 255, b = buf[3 * i + 2] / 255;
  const R = s2l(r), G = s2l(g), B = s2l(b);
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B, Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B, Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;
  const fx = fl(X / 0.95047), fy = fl(Y / 1), fz = fl(Z / 1.08883);
  const a = 500 * (fx - fy), bb = 200 * (fy - fz);
  let h = Math.atan2(bb, a) * 180 / Math.PI; if (h < 0) h += 360;
  return { Yp: 0.2126 * r + 0.7152 * g + 0.0722 * b, C: Math.hypot(a, bb), h };
}
// hue_lit recomputed with sky-coloured pixels excluded from LIT_MASK
function skyContamination(png, crop, blueLo = 200, blueHi = 330) {
  const img = cropOf(decode(png), crop); const { W, H, buf } = img; const N = W * H;
  const P = new Array(N); for (let i = 0; i < N; i++) P[i] = lab(buf, i);
  const ys = P.map((p) => p.Yp).slice().sort((a, b) => a - b);
  const p75 = ys[Math.round(0.75 * (N - 1))], p25 = ys[Math.round(0.25 * (N - 1))];
  const lit = [], shadow = [];
  for (let i = 0; i < N; i++) { if (P[i].Yp > p75) lit.push(i); else if (P[i].Yp < p25) shadow.push(i); }
  const isBlue = (i) => P[i].h >= blueLo && P[i].h <= blueHi;
  const litNoSky = lit.filter((i) => !isBlue(i));
  const cm = (idx) => { let sx = 0, sy = 0, w = 0; for (const i of idx) { const c = P[i].C, t = P[i].h * Math.PI / 180; sx += c * Math.cos(t); sy += c * Math.sin(t); w += c; } if (w <= 0) return null; let d = Math.atan2(sy, sx) * 180 / Math.PI; if (d < 0) d += 360; return d; };
  const off = (a, b) => { if (a == null || b == null) return null; let d = Math.abs(a - b); if (d > 180) d = 360 - d; return +d.toFixed(2); };
  const hl = cm(lit), hln = cm(litNoSky), hs = cm(shadow);
  // chroma-weighted share of LIT_MASK owned by blue pixels (this is how M6 weights them)
  let wBlue = 0, wAll = 0; for (const i of lit) { wAll += P[i].C; if (isBlue(i)) wBlue += P[i].C; }
  return {
    file: png, lit_px: lit.length, blue_px_in_lit: lit.length - litNoSky.length,
    blue_frac_of_lit_by_count: +((lit.length - litNoSky.length) / lit.length).toFixed(4),
    blue_frac_of_lit_by_chroma_weight: +(wBlue / Math.max(1e-9, wAll)).toFixed(4),
    hue_lit_deg: +hl.toFixed(2), hue_lit_sky_excluded_deg: hln == null ? null : +hln.toFixed(2),
    hue_shadow_deg: +hs.toFixed(2),
    hue_offset_deg: off(hs, hl), hue_offset_sky_excluded_deg: off(hs, hln),
  };
}

const W = {
  pair01: { dir: 'reports/f4r3/before-pair01', p: 'pair01', crop: [300, 150, 512, 512] },
  pair02: { dir: 'reports/f4r3/before-pair02', p: 'pair02', crop: [200, 480, 512, 512] },
  pair03: { dir: 'reports/f4r3/before-pair03', p: 'pair03', crop: [1100, 150, 512, 512] },
  pair04: { dir: 'reports/f4r3/before-pair04', p: 'pair04', crop: [200, 480, 512, 512] },
};
const out = { at: new Date().toISOString(), null_control: [], sky_contamination: [] };
for (const [k, w] of Object.entries(W)) {
  for (const dom of ['crop', 'frame']) {
    const crop = dom === 'crop' ? w.crop : null;
    for (const arm of ['base', 'key_off', 'env_off', 'shadows_off']) {
      const f = `${w.dir}/${w.p}__${arm}.png`;
      if (!fs.existsSync(f)) continue;
      const a = anatomy({ base: f, crop, label: `${k}/${dom}/${arm}` });
      out.null_control.push({ window: k, domain: dom, arm, hue_offset_deg: a.m6.hue_offset_deg,
        hue_lit_deg: a.m6.hue_lit_deg, hue_shadow_deg: a.m6.hue_shadow_deg,
        retention: a.m6.retention, C_shadow: a.m6.C_shadow, sky_frac: a.m6.sky_frac });
    }
  }
  out.sky_contamination.push({ window: k, ...skyContamination(`${w.dir}/${w.p}__base.png`, w.crop) });
}
console.log(JSON.stringify(out, null, 1));
