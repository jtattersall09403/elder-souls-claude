#!/usr/bin/env node
/**
 * region-axes.mjs — RI-WLD04 M18 differentiation, measured on the BUILT WORLD.
 *
 * The version this replaces reproduced arithmetically and failed as evidence. Verdict W1-01 §4d:
 *
 *   > Eight of the nine axes are string and hex comparisons against `game/data/world/regions.json`
 *   > — a hand-written table. `flora`, `fauna`, `architecture`, `audio`, `weather` and `hazard`
 *   > differ on 78/78 pairs because thirteen rows of a table were filled in with different words.
 *   > ... The audio axis is the sharpest illustration — `getWorldStats()` reports `audioMB: 0`.
 *   > There is no audio in this build at all, and the audio axis still scores 78/78.
 *
 * Every axis below is measured, and each one names its source. Five come off built geometry, two
 * off the prop placement the renderer actually performs, and two off rendered pixels. `fauna`,
 * `architecture`, `audio`, `weather` and `hazard` are **dropped, not scored**: there is no roster,
 * no per-region built architecture and no audio in this build, so those axes are unmeasurable, and
 * an unmeasurable axis that scores 78/78 is worse than no axis at all. They are listed in
 * `dropped_axes` with the reason.
 *
 * Prop placement is not read from the table either — it is REPLICATED from `world/province.js`'s
 * own lattice and noise seeds, so what is counted is the instances the renderer would place,
 * modulated by the built ground and the built water. A region whose table says "1.55 canopies per
 * 100 m2" but whose ground is under 0.9 m of water places none, and this says so.
 *
 * Usage: node tools/world/region-axes.mjs [--out reports/region-axes.json] [--shots <dir>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WorldField } from '../../game/src/world/field.js';
import { noise2 } from '../../game/src/world/noise.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/region-axes.json';
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : 'reports/region-shots';

const regionsDoc = rd('game/data/world/regions.json');
const field = new WorldField(rd('game/data/world/terrain.json'), regionsDoc, rd('game/data/world/water.json'));
field.setRoads(rd('game/data/world/roads.json'));
const TIDES = [0, 0.25, 0.5, 0.75];

// ---- colour -------------------------------------------------------------------------------------
const srgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
function offsetL(rgb, dl) {                       // THREE.Color.offsetHSL(0, 0, dl)
  const [r, g, b] = rgb;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let l = (mx + mn) / 2, s = 0, hh = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  l = Math.min(1, Math.max(0, l + dl));
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const hue = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [hue(hh + 1 / 3), hue(hh), hue(hh - 1 / 3)];
}
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function toLab([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** `province.js _groundColour`, replicated exactly: region albedo, mottle, wetness. */
function groundColourAt(x, z) {
  const r = field.regions[field.regionIndexAt(x, z)];
  let c = srgb(r.ground.albedo);
  const mottle = (noise2(x / 21, z / 21, 4111) - 0.5) * 0.16 + (noise2(x / 5.5, z / 5.5, 4127) - 0.5) * 0.08;
  c = offsetL(c, mottle);
  const d = field.depthAt(x, z);
  if (d > 0) c = mixRgb(c, srgb(r.palette_hex[0]).map((v) => v * 0.42), Math.min(0.88, Math.max(0, 0.30 + d * 0.55)));
  return c;
}

/** `province.js _buildTile`'s lattice, replicated: what the renderer would actually place here. */
function propsInTile(ox, oz, TILE_M = 300) {
  const N = 46, area = TILE_M * TILE_M / 100;      // province.js: in units of 100 m2
  const byRegion = new Map();
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const jx = noise2(ix * 1.7 + ox, iz * 2.3 + oz, 7717);
      const jz = noise2(ix * 2.9 + ox, iz * 1.3 + oz, 7723);
      const x = ox + (ix + jx) * (TILE_M / N), z = oz + (iz + jz) * (TILE_M / N);
      if (!field.isLandAt(x, z)) continue;
      const r = field.regions[field.regionIndexAt(x, z)];
      const p = r.props;
      const depth = field.depthAt(x, z);
      const cellArea = area / (N * N) * 100;      // province.js verbatim
      const roll = noise2(x * 0.37, z * 0.37, 7741);
      const roll2 = noise2(x * 0.61, z * 0.61, 7757);
      const roll3 = noise2(x * 0.83, z * 0.83, 7761);
      let e = byRegion.get(r.id);
      if (!e) { e = { canopy: 0, under: 0, rock: 0, h: 0, rr: 0, m2: 0 }; byRegion.set(r.id, e); }
      e.m2 += TILE_M * TILE_M / (N * N);
      if (p.canopy.shape !== 'none' && depth < 0.9 && roll < p.canopy.per100m2 * cellArea / 100) {
        const sc = 0.72 + noise2(x * 3.1, z * 3.1, 7793) * 0.66;
        e.canopy++; e.h += p.canopy.h * sc; e.rr += p.canopy.r * sc;
      }
      if (roll2 < p.under.per100m2 * cellArea / 100 && depth < 0.6) e.under++;
      if (roll3 < p.rock.per100m2 * cellArea / 100) e.rock++;
    }
  }
  return byRegion;
}

// ---- per-region measurement ----------------------------------------------------------------------
const regions = regionsDoc.regions;
const SAMPLES = 900;
const measured = {};
for (const r of regions) {
  const bb = r.bounds_m;
  const pts = [];
  for (let i = 0; i < SAMPLES * 60 && pts.length < SAMPLES; i++) {
    const u = (i * 0.6180339887498949) % 1, v = (i * 0.3819660112501051 + 0.5) % 1;
    const x = bb.x[0] + u * (bb.x[1] - bb.x[0]), z = bb.z[0] + v * (bb.z[1] - bb.z[0]);
    if (field.regionAt(x, z).id !== r.id || !field.isLandAt(x, z)) continue;
    pts.push([x, z]);
  }
  const slopes = [], heights = [], depths = [], lab = [];
  const bands = { W0: 0, W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
  const subs = {};
  let wetAny = 0, tideSwing = 0;
  for (const [x, z] of pts) {
    slopes.push(field.slopeAt(x, z, 8));
    heights.push(field.heightAt(x, z));
    let lo = Infinity, hi = -Infinity;
    for (const ph of TIDES) { const d = field.depthAt(x, z, ph); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    tideSwing += hi - lo;
    const d = field.depthAt(x, z, 0.75);
    depths.push(d);
    bands[field.bandOf(d)]++;
    if (hi > 0) wetAny++;
    const s = field.substrateAt(x, z);
    subs[s] = (subs[s] || 0) + 1;
    lab.push(toLab(groundColourAt(x, z)));
  }
  const n = pts.length || 1;
  const hist = [0, 0, 0, 0, 0, 0];
  for (const s of slopes) hist[Math.min(5, Math.floor(s / 6))]++;
  const meanLab = [0, 1, 2].map((k) => lab.reduce((a, v) => a + v[k], 0) / n);
  const sorted = heights.slice().sort((a, b) => a - b);

  const acc = { canopy: 0, under: 0, rock: 0, h: 0, rr: 0, m2: 0 };
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      const ox = Math.floor((bb.x[0] + (bb.x[1] - bb.x[0]) * (a + 0.5) / 3) / 300) * 300;
      const oz = Math.floor((bb.z[0] + (bb.z[1] - bb.z[0]) * (b + 0.5) / 3) / 300) * 300;
      const e = propsInTile(ox, oz).get(r.id);
      if (!e) continue;
      acc.canopy += e.canopy; acc.under += e.under; acc.rock += e.rock;
      acc.h += e.h; acc.rr += e.rr; acc.m2 += e.m2;
    }
  }
  const per100 = (v) => (acc.m2 ? +(v / acc.m2 * 100).toFixed(3) : 0);

  measured[r.id] = {
    samples: n,
    slope_histogram: hist.map((v) => +(v / n).toFixed(4)),
    mean_slope_deg: +(slopes.reduce((a, v) => a + v, 0) / n).toFixed(3),
    elevation: { mean: +(heights.reduce((a, v) => a + v, 0) / n).toFixed(2),
      p10: +sorted[Math.floor(n * 0.1)].toFixed(2), p90: +sorted[Math.floor(n * 0.9)].toFixed(2) },
    water_regime: { frac_ever_wet: +(wetAny / n).toFixed(4),
      mean_depth_low_m: +(depths.reduce((a, v) => a + v, 0) / n).toFixed(4),
      mean_tide_swing_m: +(tideSwing / n).toFixed(4),
      band_mix: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, +(v / n).toFixed(4)])) },
    substrate_mix: Object.fromEntries(Object.entries(subs).map(([k, v]) => [k, +(v / n).toFixed(4)])),
    ground_lab: meanLab.map((v) => +v.toFixed(2)),
    flora_placed: { canopy_per_100m2: per100(acc.canopy), under_per_100m2: per100(acc.under),
      rock_per_100m2: per100(acc.rock),
      mean_canopy_height_m: acc.canopy ? +(acc.h / acc.canopy).toFixed(2) : 0,
      mean_canopy_radius_m: acc.canopy ? +(acc.rr / acc.canopy).toFixed(2) : 0,
      declared_canopy_per_100m2: r.props.canopy.per100m2,
      silhouette: `${r.props.canopy.shape}:${r.props.canopy.h}x${r.props.canopy.r}` },
  };
}

// ---- rendered pixels, if a shot pack is present ----------------------------------------------------
let rendered = null;
if (existsSync(join(ROOT, shotsDir, 'ANSWERS.json'))) {
  const ans = rd(join(shotsDir, 'ANSWERS.json'));
  const GH = 4, W = 64, H = 36;
  const strip = (file) => {
    const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
    const acc = Array.from({ length: GH }, () => [0, 0, 0, 0]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const L = toLab([raw[i] / 255, raw[i + 1] / 255, raw[i + 2] / 255]);
      const c = Math.min(GH - 1, Math.floor(y / H * GH));
      acc[c][0] += L[0]; acc[c][1] += L[1]; acc[c][2] += L[2]; acc[c][3]++;
    }
    return acc.flatMap((c) => [c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
  };
  rendered = {};
  for (const s of ans.shots) {
    const f = join(ROOT, shotsDir, s.frame);
    if (!existsSync(f)) continue;
    (rendered[s.region] = rendered[s.region] || []).push(strip(f));
  }
  for (const k of Object.keys(rendered)) {
    const arr = rendered[k];
    rendered[k] = arr[0].map((_, i) => +(arr.reduce((a, v) => a + v[i], 0) / arr.length).toFixed(2));
  }
}

// ---- the axes ---------------------------------------------------------------------------------------
const AXES = [
  { id: 'slope_histogram', source: 'built terrain (field.slopeAt over 900 in-region samples)',
    d: (a, b) => a.slope_histogram.reduce((s, v, i) => s + Math.abs(v - b.slope_histogram[i]), 0) / 2, min: 0.15 },
  { id: 'elevation_profile', source: 'built terrain (heightAt mean and p10-p90 spread)',
    d: (a, b) => Math.abs(a.elevation.mean - b.elevation.mean) + 0.5 * Math.abs((a.elevation.p90 - a.elevation.p10) - (b.elevation.p90 - b.elevation.p10)), min: 8.0 },
  { id: 'water_regime', source: 'built water (depthAt at all four tide phases)',
    d: (a, b) => Math.abs(a.water_regime.frac_ever_wet - b.water_regime.frac_ever_wet)
      + Object.keys(a.water_regime.band_mix).reduce((s, k) => s + Math.abs(a.water_regime.band_mix[k] - b.water_regime.band_mix[k]), 0) / 2
      + Math.min(1, Math.abs(a.water_regime.mean_tide_swing_m - b.water_regime.mean_tide_swing_m)), min: 0.25 },
  { id: 'substrate_mix', source: 'built substrate raster (substrateAt, wetness-modulated)',
    d: (a, b) => { const ks = new Set([...Object.keys(a.substrate_mix), ...Object.keys(b.substrate_mix)]);
      return [...ks].reduce((s, k) => s + Math.abs((a.substrate_mix[k] || 0) - (b.substrate_mix[k] || 0)), 0) / 2; }, min: 0.20 },
  { id: 'ground_material_lab', source: 'renderer ground shader replicated over built ground and built depth (CIELAB dE)',
    d: (a, b) => dE(a.ground_lab, b.ground_lab), min: 8.0 },
  { id: 'flora_density_placed', source: 'province.js prop lattice replicated: instances the renderer places',
    d: (a, b) => Math.abs(a.flora_placed.canopy_per_100m2 - b.flora_placed.canopy_per_100m2)
      + 0.4 * Math.abs(a.flora_placed.under_per_100m2 - b.flora_placed.under_per_100m2), min: 0.30 },
  { id: 'flora_silhouette_placed', source: 'same lattice: placed crown height and radius, not the table row',
    d: (a, b) => Math.abs(a.flora_placed.mean_canopy_height_m - b.flora_placed.mean_canopy_height_m)
      + 2.0 * Math.abs(a.flora_placed.mean_canopy_radius_m - b.flora_placed.mean_canopy_radius_m), min: 2.0 },
];
const RENDERED_AXES = [
  { id: 'rendered_palette', source: 'rendered pixels: mean CIELAB of the region’s M17 frames, top and upper-middle bands',
    d: (a, b) => dE(a.slice(0, 3), b.slice(0, 3)) + dE(a.slice(3, 6), b.slice(3, 6)), min: 12.0 },
  { id: 'rendered_vertical_structure', source: 'rendered pixels: the sky/canopy/ground CIELAB profile down the frame',
    d: (a, b) => { let s = 0; for (let i = 0; i < 4; i++) s += dE(a.slice(i * 3, i * 3 + 3), b.slice(i * 3, i * 3 + 3)); return s / 4; }, min: 10.0 },
];
const DROPPED = [
  { axis: 'fauna', reason: 'no enemy or creature is placed in any region in this build; a fauna axis scored off a table row would read 78/78 on an empty province' },
  { axis: 'architecture', reason: 'two interiors exist against a declared 250, and no per-region architecture is placed in the exterior; there is nothing built to measure' },
  { axis: 'audio', reason: 'getWorldStats() reports audioMB 0. There is no audio in this build at all (verdict W1-01 §4d)' },
  { axis: 'weather', reason: 'weather is a per-frame capture parameter, not a property of the built world; it enters through rendered_palette when the M17 night and worst-weather passes are captured' },
  { axis: 'hazard', reason: 'hazards exist as a census and were shown not to fire (verdict W1-01, RI-WLD11 30/100); until they do, a hazard axis measures a table' },
];

const ids = regions.map((r) => r.id);
const pairs = [];
const axisCounts = {};
for (const a of [...AXES, ...RENDERED_AXES]) axisCounts[a.id] = 0;
let minAxes = Infinity, minPair = null;
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const A = measured[ids[i]], B = measured[ids[j]];
    const per = {};
    let k = 0, available = 0;
    for (const ax of AXES) {
      const v = ax.d(A, B);
      per[ax.id] = +v.toFixed(4);
      available++;
      if (v >= ax.min) { k++; axisCounts[ax.id]++; }
    }
    for (const ax of RENDERED_AXES) {
      if (!rendered || !rendered[ids[i]] || !rendered[ids[j]]) { per[ax.id] = null; continue; }
      const v = ax.d(rendered[ids[i]], rendered[ids[j]]);
      per[ax.id] = +v.toFixed(4);
      available++;
      if (v >= ax.min) { k++; axisCounts[ax.id]++; }
    }
    pairs.push({ a: ids[i], b: ids[j], axes_differing: k, axes_available: available, per_axis: per });
    if (k < minAxes) { minAxes = k; minPair = `${ids[i]} / ${ids[j]}`; }
  }
}
pairs.sort((p, q) => p.axes_differing - q.axes_differing);

const available = AXES.length + (rendered ? RENDERED_AXES.length : 0);
const BAR = Math.max(5, Math.round(available * 6 / 9));   // RI-WLD04 M18's ">= 6 of 9", pro rata
const doc = {
  schema: 'elder-souls/region-axes@2',
  method: 'RI-WLD04 M18 — differentiation measured on the built world',
  note: 'Replaces region-axes@1, in which 8 of 9 axes were string or hex comparisons against '
      + 'game/data/world/regions.json (verdict W1-01 §4d). Every axis here names its source; '
      + `${AXES.length} are measured off built geometry or replicated renderer placement and `
      + `${RENDERED_AXES.length} off rendered pixels. Unmeasurable axes are dropped, not scored.`,
  measured_at: new Date().toISOString(),
  axes: [...AXES, ...RENDERED_AXES].map((a) => ({ id: a.id, source: a.source, threshold: a.min,
    measured: AXES.includes(a) ? true : !!rendered })),
  dropped_axes: DROPPED,
  bar: { axes_available: available, must_differ_on: BAR },
  per_region: measured,
  rendered_present: !!rendered,
  axis_pair_counts: axisCounts,
  min_axes_differing: minAxes, min_pair: minPair,
  pairs_below_bar: pairs.filter((p) => p.axes_differing < BAR).map((p) => `${p.a}/${p.b} (${p.axes_differing})`),
  worst_pairs: pairs.slice(0, 8),
  pairs,
  pass: minAxes >= BAR,
};
mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');

process.stdout.write(`RI-WLD04 M18 — ${pairs.length} pairs, ${available} MEASURED axes (bar: >= ${BAR})\n`);
for (const a of [...AXES, ...RENDERED_AXES]) {
  const has = AXES.includes(a) || rendered;
  process.stdout.write(`  ${a.id.padEnd(30)} ${has ? String(axisCounts[a.id]).padStart(3) : ' --'}/${pairs.length}   ${a.source}\n`);
}
for (const d of DROPPED) process.stdout.write(`  ${d.axis.padEnd(30)} DROPPED\n`);
process.stdout.write(`\n  minimum axes differing = ${minAxes} (${minPair})\n`);
if (doc.pairs_below_bar.length) process.stdout.write(`  below bar: ${doc.pairs_below_bar.join(', ')}\n`);
process.stdout.write(`  worst three: ${pairs.slice(0, 3).map((p) => `${p.a}/${p.b}=${p.axes_differing}`).join('  ')}\n`);
process.stdout.write(`\n  [${doc.pass ? 'PASS' : 'FAIL'}] M18-DIFFERENTIATION\n  ${outFile}\n`);
process.exit(doc.pass ? 0 : 1);
