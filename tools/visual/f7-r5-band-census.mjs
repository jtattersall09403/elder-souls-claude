#!/usr/bin/env node
/**
 * f7-r5-band-census.mjs — F7 ROUND 5. WHAT FRACTION OF THE WATER DOES THE SHORE BAND TOUCH?
 *
 * WHY. The r4 critic's mechanism for the whole round-4 failure is that `uWaterShoreBandM = 1.20 m`
 * sits ABOVE the median water depth in both measured regions, so the term is not a shoreline band
 * at all — it is a transparency multiplier over most of the water body, which produces the missing
 * gradient and the missing water from ONE cause. That is a claim about `WorldField`, not about a
 * frame, so it is decidable offline in milliseconds and I am not inheriting it.
 *
 * WHAT IT COMPUTES. `esDepthM = clamp((q - .43)/.57, 0, 1) * 1.35` is the exact inverse of
 * province.js's `q = .43 + .57*clamp(depth/1.35,0,1)`, so a wet corner's `esDepthM` IS its depth in
 * metres (clamped at 1.35). The shader's band term is
 *
 *     esBandM = 1 - smoothstep(0, max(band, 1e-4), esDepthM)
 *
 * which is: 1 at the waterline, 0 at `band` metres of column, smooth between. So over the wet
 * corners inside a capture radius this reports, for each candidate constant, the share of water
 * that is UNTOUCHED (depth >= band), IN TRANSITION (0 < depth < band) and at FULL fade (depth ~ 0),
 * plus the mean band strength. **A shoreline band wants MINIMAL coverage; the round-4 constant was
 * chosen for MAXIMAL coverage, which is the criterion for a depth tint.**
 *
 * It reuses `f7-r4-shoreline-census.mjs`'s reproduction of province.js's cell arithmetic — the same
 * `WorldField` the engine builds, the same 12.5 m lattice — but it does NOT import that tool; the
 * arithmetic is re-derived here from `game/src/world/province.js` read this turn, so a critic
 * comparing the two files is comparing two derivations rather than one.
 *
 *   node tools/visual/f7-r5-band-census.mjs [--radius 120] [--bands 0.05,0.10,...] [--out f.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
const DECK = rd('tools/visual/deck.json');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const TILE_M = 300, WATER_SEG = 24, STEP = TILE_M / WATER_SEG;   // province.js — 12.5 m lattice
const DEPTH_CLAMP = 1.35;                                        // province.js depth clamp
const RADIUS = Number(args.radius || 120);
const BANDS = String(args.bands || '0.05,0.10,0.20,0.30,0.45,0.60,0.90,1.20,1.35').split(',').map(Number);
const SITES = String(args.sites || 'vista-deep-marshes,vista-western-rootlands,eye-deep-marshes,vista-blackwood,vista-eastern-rootlands,vista-marauders-coast,vista-crimson-coast').split(',');

const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

function wetCorners(cx, cz, sideM) {
  const half = sideM / 2;
  const x0 = Math.floor((cx - half) / STEP) * STEP, z0 = Math.floor((cz - half) / STEP) * STEP;
  const depths = [];
  let cells = 0, waterline = 0, qSat = 0, wet = 0;
  for (let x = x0; x <= cx + half; x += STEP) for (let z = z0; z <= cz + half; z += STEP) {
    const corners = [[x, z], [x + STEP, z], [x + STEP, z + STEP], [x, z + STEP]];
    const low = corners.map(([a, b]) => field.waterSurfaceAt(a, b, 0.75));
    const high = corners.map(([a, b]) => field.waterSurfaceAt(a, b, 0.25));
    if (![...low, ...high].some((s) => s !== null)) continue;
    if (Math.hypot(x + STEP / 2 - cx, z + STEP / 2 - cz) > half) continue;
    cells++;
    let anyWet = 0, anyDry = 0;
    for (const [a, b] of corners) {
      const s = field.waterSurfaceAt(a, b);
      if (s === null) { anyDry++; continue; }
      const d = Math.max(0, s - field.heightAt(a, b));
      if (d <= 0) { anyDry++; continue; }
      anyWet++; wet++;
      // The shader sees the CLAMPED depth — a corner deeper than 1.35 m is indistinguishable from
      // one at exactly 1.35 m, so the census must clamp too or it flatters every wide band.
      const dClamped = Math.min(d, DEPTH_CLAMP);
      depths.push(dClamped);
      if (d >= DEPTH_CLAMP) qSat++;
    }
    if (anyWet && anyDry) waterline++;
  }
  return { cells, waterline_cells: waterline, wet_corners: wet, q_saturated: qSat, depths };
}

const pct = (n, d) => (d ? +(100 * n / d).toFixed(2) : null);
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return +(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(4); };

const rows = [];
for (const id of SITES) {
  const s = DECK.setups.find((x) => x.id === id);
  if (!s) { rows.push({ setup: id, error: 'not in deck.json' }); continue; }
  const r = field.regionAt(s.place.x, s.place.z);
  const c = wetCorners(s.place.x, s.place.z, RADIUS * 2);
  const row = {
    setup: id, region_actual: r ? (r.id || r.name) : null, radius_m: RADIUS,
    water_cells: c.cells, waterline_cells: c.waterline_cells,
    waterline_pct: pct(c.waterline_cells, c.cells),
    wet_corners: c.wet_corners,
    q_saturation: pct(c.q_saturated, c.wet_corners),
    median_depth_m: median(c.depths),
    mean_depth_m: c.depths.length ? +(c.depths.reduce((a, b) => a + b, 0) / c.depths.length).toFixed(4) : null,
    bands: {},
  };
  for (const band of BANDS) {
    const b = Math.max(band, 1e-4);
    let untouched = 0, transition = 0, full = 0, strength = 0;
    for (const d of c.depths) {
      const v = 1 - smoothstep(0, b, d);
      strength += v;
      if (v <= 0.001) untouched++; else if (v >= 0.999) full++; else transition++;
    }
    const n = c.depths.length;
    row.bands[band.toFixed(2)] = {
      untouched_pct: pct(untouched, n), in_transition_pct: pct(transition, n), full_fade_pct: pct(full, n),
      touched_pct: pct(transition + full, n),
      mean_band_strength: n ? +(strength / n).toFixed(4) : null,
      // The alpha line is `a = mix(a, a*0.42, esShoreT)`, and where the band saturates esShoreT -> 1
      // regardless of transmittance, so the alpha multiplier there is 0.42 whatever k is.
      mean_alpha_multiplier_from_band_alone: n ? +(1 - 0.58 * (strength / n)).toFixed(4) : null,
    };
  }
  rows.push(row);
}

const payload = {
  tool: 'f7-r5-band-census', roadmap_item: 'F7', generated: new Date().toISOString(),
  method: 'Offline against the same WorldField the engine builds. Cell arithmetic re-derived from game/src/world/province.js read this turn; depths CLAMPED at 1.35 m because that is what the shader can see through province.js\'s q. `esBandM = 1 - smoothstep(0, band, depth)`, evaluated per wet corner inside the radius.',
  what_untouched_means: 'esBandM <= 0.001 — the shore band does nothing to this corner and round 3\'s behaviour is preserved there exactly. A SHORELINE band should leave most of a water body untouched; the round-4 constant was chosen to maximise coverage, which is the criterion for a depth TINT and the inverse of what a shore band needs.',
  radius_m: RADIUS, bands_tested: BANDS, rows,
};
if (args.out) { fs.mkdirSync(path.dirname(path.resolve(REPO, String(args.out))), { recursive: true }); fs.writeFileSync(path.resolve(REPO, String(args.out)), JSON.stringify(payload, null, 2)); }
console.log(JSON.stringify(payload, null, 2));
