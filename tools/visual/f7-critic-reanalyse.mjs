#!/usr/bin/env node
/**
 * f7-critic-reanalyse.mjs — F7 CRITIC. RE-READ THE BUILDER'S OWN FRAMES WITH A METRIC THAT
 * CANNOT CONFUSE "THE WATER GOT DARKER" WITH "THE WATER GOT LESS STREAKY".
 *
 * The builder's headline is `x_rms 7.711 -> 5.484, the streaks fall 28%`. `x_rms` is the standard
 * deviation of the column-mean luminance of a crop. It is taken over the WHOLE crop, water and
 * land together, and it is not normalised by brightness. Three facts from the builder's own
 * result files say that is not a banding measure:
 *
 *   - `term-truly-flat-water` replaces the entire water fragment output with ONE CONSTANT COLOUR
 *     and x_rms goes UP 42.8% (7.711 -> 11.393). A crop whose metric rises when the pattern under
 *     test is deleted cannot carry a positive result about that pattern.
 *   - `term-no-standard-lighting` makes the water brighter: x_rms +24.4%. `term-no-reflection`
 *     makes it darker: x_rms -50.6%. The metric tracks water brightness, monotonically.
 *   - The SAME tool's directional metrics move the OTHER WAY across the fix: `lane_power`
 *     4.090 -> 4.583 (+12.1%) and `lane_aniso` 4.03 -> 5.97 (+48.1%). The builder reported the
 *     one that fell.
 *
 * So this tool recomputes, on the builder's own committed PNGs, at the builder's own pose, on
 * both arms:
 *
 *   WATER_MASK      pixels that change between `baseline` and `surface-hidden` — the water table's
 *                   own pixels, taken from the renderer, not hand-drawn.
 *   band_rms        rms of the high-passed luminance RESTRICTED TO WATER_MASK. Land is excluded,
 *                   so water/land contrast cannot enter.
 *   band_contrast   band_rms / mean luminance on WATER_MASK. Brightness-normalised, so darkening
 *                   the water cannot by itself improve it. THIS IS THE NUMBER THAT MATTERS.
 *   orientation     structure tensor over WATER_MASK, whole crop and per 3x3 tile, to test whether
 *                   the streaks are one world bearing or a screen-space starburst.
 *
 * Everything it reads is committed under corpus/90-verdicts/wave1/artifacts/W1-F7-WATER/.
 *
 *   node tools/visual/f7-critic-reanalyse.mjs --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const A = path.join(REPO, 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER');
const CROP = String(args.crop || '200,760,60,480').split(',').map(Number);

const read = (p) => {
  const f = path.join(A, p);
  if (!fs.existsSync(f)) throw new Error(`missing artefact ${p}`);
  const png = PNG.sync.read(fs.readFileSync(f));
  const N = png.width * png.height, y = new Float32Array(N);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height, data: png.data, path: p };
};
const maskOf = (base, hidden, thr = 3) => {
  const m = new Uint8Array(base.y.length); let c = 0;
  for (let i = 0; i < m.length; i++) if (Math.abs(base.y[i] - hidden.y[i]) > thr) { m[i] = 1; c++; }
  return { m, count: c, pct: +(100 * c / m.length).toFixed(2) };
};
/** Same 9-tap VERTICAL high pass the builder's own `hpRect` uses. Kept for band-energy figures
 *  so they are comparable with the builder's, and NOT used for orientation: subtracting a
 *  vertical-only box attenuates horizontal structure and biases a structure tensor toward
 *  reporting horizontal ridges whatever the image contains. */
const highpassV = (o) => {
  const out = new Float32Array(o.y.length);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[y * o.w + x] = o.y[y * o.w + x] - s / c;
  }
  return out;
};
/** ISOTROPIC 9x9 box high pass — the one orientation is measured on, so no direction is
 *  privileged by the filter itself. */
const highpassI = (o) => {
  const out = new Float32Array(o.y.length);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    let s = 0, c = 0;
    for (let ky = -4; ky <= 4; ky++) {
      const yy = y + ky; if (yy < 0 || yy >= o.h) continue;
      for (let kx = -4; kx <= 4; kx++) { const xx = x + kx; if (xx < 0 || xx >= o.w) continue; s += o.y[yy * o.w + xx]; c++; }
    }
    out[y * o.w + x] = o.y[y * o.w + x] - s / c;
  }
  return out;
};
const inCrop = (i, w, [x0, x1, y0, y1]) => { const x = i % w, y = (i / w) | 0; return x >= x0 && x < x1 && y >= y0 && y < y1; };

/** MASK-AWARE separable box blur: land pixels contribute nothing, so a dark tree island cannot
 *  bleed a false edge into the water's own low-frequency field. */
function maskedBlur(y, mk, w, h, r) {
  const num = new Float32Array(w * h), den = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) { if (mk.m[j]) { num[j] = y[j]; den[j] = 1; } }
  const pass = (src, W, H, horiz) => {
    const out = new Float32Array(W * H);
    for (let b = 0; b < (horiz ? H : W); b++) {
      let acc = 0;
      const at = (k) => horiz ? src[b * W + k] : src[k * W + b];
      const N = horiz ? W : H;
      for (let k = 0; k <= Math.min(r, N - 1); k++) acc += at(k);
      for (let k = 0; k < N; k++) {
        if (horiz) out[b * W + k] = acc; else out[k * W + b] = acc;
        const add = k + r + 1, sub = k - r;
        if (add < N) acc += at(add);
        if (sub >= 0) acc -= at(sub);
      }
    }
    return out;
  };
  const n2 = pass(pass(num, w, h, true), w, h, false), d2 = pass(pass(den, w, h, true), w, h, false);
  const out = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) out[j] = d2[j] > 0 ? n2[j] / d2[j] : 0;
  return out;
}
/** The lane-scale band-pass. The builder's own peak lag is 184 px (38.1 m), so a 9x9 high pass
 *  cannot see the lanes at all — it removes everything slower than ~9 px. This keeps the band
 *  between ~30 and ~240 px, which is where the streaks live. */
function lanePass(o, mk, crop) {
  const fine = maskedBlur(o.y, mk, o.w, o.h, 7), coarse = maskedBlur(o.y, mk, o.w, o.h, 60);
  const out = new Float32Array(o.y.length);
  for (let i = 0; i < out.length; i++) out[i] = mk.m[i] ? fine[i] - coarse[i] : 0;
  return out;
}
/** The builder's own angular projection-variance scan, but restricted to WATER pixels and run on
 *  the lane-scale band-pass. Reports the bearing, the absolute directional power, the anisotropy
 *  against the median direction, and the power normalised by the water's own mean brightness. */
function maskedLanes(o, bp, mk, [x0, x1, y0, y1], meanLuma) {
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (x1 - x0 - 1)) + Math.min(0, uy * (y1 - y0 - 1));
    const nb = Math.ceil(Math.abs(ux) * (x1 - x0) + Math.abs(uy) * (y1 - y0)) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * o.w + x; if (!mk.m[i]) continue;
      const t = Math.round(ux * (x - x0) + uy * (y - y0) - off);
      if (t < 0 || t >= nb) continue;
      acc[t] += bp[i]; cnt[t]++;
    }
    const need = Math.max(8, 0.25 * Math.min(x1 - x0, y1 - y0));
    const prof = []; for (let i = 0; i < nb; i++) if (cnt[i] >= need) prof.push(acc[i] / cnt[i]);
    if (prof.length < 8) continue;
    let m = 0; for (const v of prof) m += v; m /= prof.length;
    let va = 0; for (const v of prof) va += (v - m) ** 2; va /= prof.length;
    stats.push({ deg, va });
  }
  if (!stats.length) return null;
  const sorted = stats.slice().sort((a, b) => b.va - a.va);
  const med = stats.slice().sort((a, b) => a.va - b.va)[Math.floor(stats.length / 2)].va;
  return {
    lane_bearing_screen_deg: sorted[0].deg,
    lane_power: +sorted[0].va.toFixed(4),
    lane_aniso: +(sorted[0].va / Math.max(1e-9, med)).toFixed(2),
    lane_power_normalised: +(sorted[0].va / Math.max(1e-6, meanLuma * meanLuma)).toFixed(6),
    note: 'screen degrees; top-down so screen X is world X and screen Y is world Z (scale probe: fov 50, 0.2072 m/px both axes, +X to screen-left, +Z to screen-up)',
  };
}

function maskedStats(o, hp, mk, crop) {
  let n = 0, sumY = 0, sumH = 0, sumH2 = 0;
  for (let i = 0; i < mk.m.length; i++) {
    if (!mk.m[i] || !inCrop(i, o.w, crop)) continue;
    n++; sumY += o.y[i]; sumH += hp[i]; sumH2 += hp[i] * hp[i];
  }
  if (!n) return null;
  const meanY = sumY / n, meanH = sumH / n;
  const bandRms = Math.sqrt(Math.max(0, sumH2 / n - meanH * meanH));
  return {
    water_px_in_crop: n, mean_luma: +meanY.toFixed(3),
    band_rms: +bandRms.toFixed(4),
    band_contrast: +(bandRms / Math.max(1e-6, meanY)).toFixed(5),
  };
}
/** Structure tensor over masked pixels only; ridge direction in screen degrees CCW from +x. */
function maskedOrientation(o, hp, mk, [x0, x1, y0, y1]) {
  let Jxx = 0, Jyy = 0, Jxy = 0, n = 0;
  for (let y = Math.max(1, y0); y < Math.min(o.h - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(o.w - 1, x1); x++) {
    const i = y * o.w + x;
    if (!mk.m[i] || !mk.m[i - 1] || !mk.m[i + 1] || !mk.m[i - o.w] || !mk.m[i + o.w]) continue;
    const gx = hp[i + 1] - hp[i - 1], gy = hp[i + o.w] - hp[i - o.w];
    Jxx += gx * gx; Jyy += gy * gy; Jxy += gx * gy; n++;
  }
  if (n < 200) return { insufficient: n };
  Jxx /= n; Jyy /= n; Jxy /= n;
  let ridge = 0.5 * Math.atan2(2 * Jxy, Jxx - Jyy) * 180 / Math.PI + 90;
  while (ridge > 90) ridge -= 180; while (ridge <= -90) ridge += 180;
  const tr = Jxx + Jyy, disc = Math.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy * Jxy);
  return { n, ridge_deg: +ridge.toFixed(1), coherence: +(tr > 0 ? disc / tr : 0).toFixed(3), energy: +tr.toFixed(4) };
}
function tiles(o, hp, mk, [x0, x1, y0, y1]) {
  const tw = Math.floor((x1 - x0) / 3), th = Math.floor((y1 - y0) / 3), out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const rect = [x0 + c * tw, x0 + (c + 1) * tw, y0 + r * th, y0 + (r + 1) * th];
    const or = maskedOrientation(o, hp, mk, rect);
    const cx = (rect[0] + rect[1]) / 2 - o.w / 2, cy = (rect[2] + rect[3]) / 2 - o.h / 2;
    let radial = Math.atan2(cy, cx) * 180 / Math.PI; while (radial > 90) radial -= 180; while (radial <= -90) radial += 180;
    let d = or.ridge_deg === undefined ? null : or.ridge_deg - radial;
    if (d !== null) { while (d > 90) d -= 180; while (d <= -90) d += 180; }
    out.push({ tile: `r${r}c${c}`, ...or, radial_pred_deg: +radial.toFixed(1), dev_from_radial_deg: d === null ? null : +d.toFixed(1) });
  }
  const ok = out.filter((t) => t.ridge_deg !== undefined);
  const centre = out[4].ridge_deg;
  const devCentre = ok.map((t) => { let d = t.ridge_deg - centre; while (d > 90) d -= 180; while (d <= -90) d += 180; return Math.abs(d); });
  return {
    tiles: out,
    mean_abs_dev_from_centre_tile_deg: ok.length ? +(devCentre.reduce((a, b) => a + b, 0) / ok.length).toFixed(1) : null,
    mean_abs_dev_from_radial_deg: ok.length ? +(ok.reduce((a, t) => a + Math.abs(t.dev_from_radial_deg), 0) / ok.length).toFixed(1) : null,
    reading: 'ONE world bearing => dev_from_centre_tile small, dev_from_radial large. A screen-space starburst => the reverse.',
  };
}

const ARMS = [
  { id: 'prefix', base: 'pitch-dm-t1/frames/baseline.png', hidden: 'pitch-dm-t2/frames/surface-hidden.png',
    what: 'the pinned pre-fix tree 3ca135ad — the builder\'s own baseline frame, x_rms 7.711' },
  { id: 'fixed', base: 'pitch-dm-after/frames/baseline.png', hidden: 'pitch-dm-after/frames/surface-hidden.png',
    what: 'HEAD b0f3224e — the builder\'s own baseline frame, x_rms 5.484' },
];

const out = {
  tool: 'f7-critic-reanalyse', generated: new Date().toISOString(),
  what: 'the builder\'s own committed frames, re-read with a water-masked, brightness-normalised banding metric',
  source_dir: 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER', crop: CROP, arms: {},
};
for (const arm of ARMS) {
  const b = read(arm.base), h = read(arm.hidden);
  const mk = maskOf(b, h);
  const hpV = highpassV(b), hpI = highpassI(b);
  out.arms[arm.id] = {
    what: arm.what, base_frame: arm.base, mask_from: arm.hidden,
    water_mask_pct_of_frame: mk.pct,
    stats: maskedStats(b, hpV, mk, CROP),
    stats_isotropic_hp: maskedStats(b, hpI, mk, CROP),
    orientation_whole_crop: maskedOrientation(b, hpI, mk, CROP),
    orientation_by_tile: tiles(b, hpI, mk, CROP),
  };
  const st = out.arms[arm.id].stats;
  const bp = lanePass(b, mk, CROP);
  out.arms[arm.id].lanes_on_water = maskedLanes(b, bp, mk, CROP, st.mean_luma);
  const tw = Math.floor((CROP[1] - CROP[0]) / 3), th = Math.floor((CROP[3] - CROP[2]) / 3);
  out.arms[arm.id].lanes_by_tile = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const rect = [CROP[0] + c * tw, CROP[0] + (c + 1) * tw, CROP[2] + r * th, CROP[2] + (r + 1) * th];
    const L = maskedLanes(b, bp, mk, rect, st.mean_luma);
    let radial = Math.atan2((rect[2] + rect[3]) / 2 - b.h / 2, (rect[0] + rect[1]) / 2 - b.w / 2) * 180 / Math.PI;
    while (radial > 90) radial -= 180; while (radial <= -90) radial += 180;
    out.arms[arm.id].lanes_by_tile.push({ tile: `r${r}c${c}`, bearing: L && L.lane_bearing_screen_deg, aniso: L && L.lane_aniso, radial_pred_deg: +radial.toFixed(1) });
  }
}
const P = out.arms.prefix.stats, F = out.arms.fixed.stats;
const PI = out.arms.prefix.stats_isotropic_hp, FI = out.arms.fixed.stats_isotropic_hp;
out.fix_effect = {
  mean_luma: `${P.mean_luma} -> ${F.mean_luma} (${(100 * (F.mean_luma - P.mean_luma) / P.mean_luma).toFixed(1)}%)`,
  band_rms_on_water: `${P.band_rms} -> ${F.band_rms} (${(100 * (F.band_rms - P.band_rms) / P.band_rms).toFixed(1)}%)`,
  band_contrast_on_water: `${P.band_contrast} -> ${F.band_contrast} (${(100 * (F.band_contrast - P.band_contrast) / P.band_contrast).toFixed(1)}%)`,
  builder_headline_x_rms: '7.711 -> 5.484 (-28.9%), taken over the WHOLE crop and not normalised',
  band_contrast_isotropic_hp: `${PI.band_contrast} -> ${FI.band_contrast} (${(100 * (FI.band_contrast - PI.band_contrast) / PI.band_contrast).toFixed(1)}%)`,
  lanes_on_water: `bearing ${out.arms.prefix.lanes_on_water.lane_bearing_screen_deg} -> ${out.arms.fixed.lanes_on_water.lane_bearing_screen_deg} deg; power ${out.arms.prefix.lanes_on_water.lane_power} -> ${out.arms.fixed.lanes_on_water.lane_power}; aniso ${out.arms.prefix.lanes_on_water.lane_aniso} -> ${out.arms.fixed.lanes_on_water.lane_aniso}; power/luma^2 ${out.arms.prefix.lanes_on_water.lane_power_normalised} -> ${out.arms.fixed.lanes_on_water.lane_power_normalised}`,
  reading: 'band_contrast is the streaks as a fraction of the water\'s own brightness. If it did not fall, the water got darker and not less streaked.',
};
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-critic/reanalyse.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ fix_effect: out.fix_effect, prefix: out.arms.prefix, fixed: out.arms.fixed }, null, 2));
