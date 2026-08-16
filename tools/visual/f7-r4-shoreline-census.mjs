#!/usr/bin/env node
/**
 * f7-r4-shoreline-census.mjs — F7 ROUND 4. DOES THE DEEP MARSHES HAVE A WATERLINE AT ALL?
 *
 * WHY THIS EXISTS AND WHY IT NEEDS NO BROWSER. The r3 verdict's biggest_gap says the shoreline
 * fade "vanishes in the region the game is played in", and its acceptance clause asks for
 * `gradient_width_px >= 12` at a `water_edge` pose IN THE DEEP MARSHES. The r3 critic also
 * recorded, twice and against its own headline, that **it opened all three of the round's
 * "shoreline close-ups" and there is no bank in any of them**, and that `RI-WLD10` §8 puts the
 * Deep Marshes at WCI 0.86, class `drowned`. My brief says in as many words: *"if the Deep
 * Marshes genuinely has no shoreline to fade ... the honest move is to say the region was the
 * wrong choice rather than to build toward a number that cannot exist there."*
 *
 * That is a question about the WORLD FIELD, not about the shader, and it is decidable offline in
 * milliseconds. `WorldField` is the same class `engine.js` builds from the same three data files
 * (the pattern `tools/visual/f7-critic-deck-region.mjs` established), and `province.js:1531-1562`
 * builds the water mesh from `waterSurfaceAt`/`heightAt` on a **12.5 m** lattice with exactly the
 * arithmetic reproduced below. So this counts the shoreline cells a capture COULD contain before
 * any capture is taken, and it counts them per region so the pose set can be declared from
 * evidence instead of from hope.
 *
 * WHAT IT REPRODUCES, LINE FOR LINE, FROM province.js (read this turn, quoted in the output):
 *   step   = TILE_M / WATER_SEG = 300 / 24 = 12.5
 *   cell exists  <- any corner has water at tide phase 0.75 OR 0.25
 *   per corner:  actualSurface = waterSurfaceAt(cx,cz)             (mean tide)
 *                depth  = actualSurface===null ? 0 : max(0, actualSurface - heightAt(cx,cz))
 *                shore  = actualSurface===null ? 1 : 0
 *                q      = .43 + .57*clamp(depth/1.35, 0, 1)
 *
 * THE THREE THINGS IT ANSWERS:
 *   1. `waterline_cells` — cells with BOTH a wet and a dry corner. This is the only place
 *      `waterShore` is 1 and the only place the water plane meets land inside the water mesh.
 *   2. `graded_cells` — cells where every corner is wet but the corner depths straddle a band in
 *      METRES. This is the population a metre-based shore band can act on and the transmittance
 *      term cannot, and it is counted at several band widths so the shader's constant is chosen
 *      from the field rather than guessed.
 *   3. `q_saturation` — the fraction of wet corners at q = 1.0 (depth >= 1.35 m, the clamp).
 *      Where this is ~1.0 the vertex-colour depth signal is dead and NO shader that reads it can
 *      produce a fade, whatever its k.
 *
 *   node tools/visual/f7-r4-shoreline-census.mjs [outfile.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const terrain = rd('game/data/world/terrain.json');
const regions = rd('game/data/world/regions.json');
const waterDoc = rd('game/data/world/water.json');
const DECK = rd('tools/visual/deck.json');

const field = new WorldField(terrain, regions, waterDoc);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const TILE_M = 300, WATER_SEG = 24, STEP = TILE_M / WATER_SEG;   // province.js:23,31 — 12.5 m
const DEPTH_CLAMP = 1.35;                                        // province.js:1559

const kOf = new Map((waterDoc.regions || []).map((r) => [String(r.region_id), Number(r.k)]));

/** One 12.5 m water cell, exactly as province.js builds it. */
function cellAt(x0, z0) {
  const corners = [[x0, z0], [x0 + STEP, z0], [x0 + STEP, z0 + STEP], [x0, z0 + STEP]];
  const low = corners.map(([cx, cz]) => field.waterSurfaceAt(cx, cz, 0.75));
  const high = corners.map(([cx, cz]) => field.waterSurfaceAt(cx, cz, 0.25));
  if (![...low, ...high].some((s) => s !== null)) return null;
  const depths = [], shores = [], qs = [];
  for (const [cx, cz] of corners) {
    const s = field.waterSurfaceAt(cx, cz);
    const d = s === null ? 0 : Math.max(0, s - field.heightAt(cx, cz));
    depths.push(d); shores.push(s === null ? 1 : 0);
    qs.push(0.43 + 0.57 * clamp(d / DEPTH_CLAMP, 0, 1));
  }
  return { corners, depths, shores, qs };
}

/** Census a square of side `sideM` centred on (cx, cz), on the global 12.5 m lattice. */
function census(cx, cz, sideM) {
  const half = sideM / 2;
  const i0 = Math.floor((cx - half) / STEP), i1 = Math.ceil((cx + half) / STEP);
  const j0 = Math.floor((cz - half) / STEP), j1 = Math.ceil((cz + half) / STEP);
  let cells = 0, waterline = 0, allWet = 0, wetCorners = 0, qSat = 0;
  const bands = { '0.30': 0, '0.60': 0, '0.90': 0, '1.20': 0, '1.35': 0 };
  const depthHist = new Array(14).fill(0);
  let nearestWaterlineM = null;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x0 = i * STEP, z0 = j * STEP;
    const c = cellAt(x0, z0);
    if (!c) continue;
    cells++;
    const dry = c.shores.reduce((a, b) => a + b, 0);
    if (dry > 0 && dry < 4) {
      waterline++;
      const d = Math.hypot(x0 + STEP / 2 - cx, z0 + STEP / 2 - cz);
      if (nearestWaterlineM === null || d < nearestWaterlineM) nearestWaterlineM = d;
    }
    if (dry === 0) {
      allWet++;
      const mn = Math.min(...c.depths), mx = Math.max(...c.depths);
      for (const b of Object.keys(bands)) if (mn < Number(b) && mx > 0) bands[b]++;
    }
    for (let k = 0; k < 4; k++) {
      if (c.shores[k]) continue;
      wetCorners++;
      if (c.qs[k] >= 0.9999) qSat++;
      depthHist[Math.min(13, Math.floor(c.depths[k] / 0.25))]++;
    }
  }
  return {
    lattice_step_m: STEP, side_m: sideM,
    water_cells: cells,
    waterline_cells: waterline,
    waterline_cell_pct: cells ? +(100 * waterline / cells).toFixed(2) : null,
    nearest_waterline_cell_m: nearestWaterlineM === null ? null : +nearestWaterlineM.toFixed(1),
    fully_submerged_cells: allWet,
    cells_with_a_corner_shallower_than: bands,
    wet_corners: wetCorners,
    wet_corners_at_q_saturation: qSat,
    q_saturation_frac: wetCorners ? +(qSat / wetCorners).toFixed(4) : null,
    wet_corner_depth_hist_0p25m_bins: depthHist,
  };
}

const SITES = String(process.env.F7R4_SITES || 'vista-deep-marshes,eye-deep-marshes,vista-western-rootlands,eye-western-rootlands,vista-blackwood,vista-eastern-rootlands,vista-marauders-coast,vista-crimson-coast').split(',');
const rows = [];
for (const id of SITES) {
  const s = DECK.setups.find((x) => x.id === id);
  if (!s || !s.place) { rows.push({ setup: id, error: 'not in deck.json' }); continue; }
  const r = field.regionAt(s.place.x, s.place.z);
  const regionId = r && (r.id || r.name) || null;
  rows.push({
    setup: id, x: s.place.x, z: s.place.z,
    region_actual: regionId, region_k: kOf.has(String(regionId)) ? kOf.get(String(regionId)) : null,
    stands_in_water: field.waterSurfaceAt(s.place.x, s.place.z) !== null,
    within_60m: census(s.place.x, s.place.z, 60),
    within_120m: census(s.place.x, s.place.z, 120),
    within_300m: census(s.place.x, s.place.z, 300),
  });
}

const out = {
  tool: 'f7-r4-shoreline-census',
  generated: new Date().toISOString(),
  roadmap_item: 'F7',
  source: 'game/data/world/{terrain,regions,water}.json via WorldField — the same construction engine.js performs; the cell arithmetic is province.js:1531-1562 reproduced verbatim',
  province_js_constants_read_this_turn: { TILE_M, WATER_SEG, step_m: STEP, depth_clamp_m: DEPTH_CLAMP },
  what_a_waterline_cell_is: 'a 12.5 m water cell with at least one DRY corner and at least one WET corner. province.js sets waterShore=1 on exactly those dry corners, and it is the only place inside the water mesh where the plane meets land.',
  what_q_saturation_means: 'the fraction of wet corners whose vertex-colour q has hit its 1.0 clamp (depth >= 1.35 m). Where this is 1.00 the ONLY depth signal reaching the water shader is a constant, and no shader reading it can fade — not at any k.',
  rows,
};
const OUT = path.resolve(REPO, process.argv[2] || 'reports/visual-truth/f7-r4/shoreline-census.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

for (const r of rows) {
  if (r.error) { console.log(`${r.setup}: ${r.error}`); continue; }
  const a = r.within_120m;
  console.log(`${r.setup.padEnd(28)} region=${String(r.region_actual).padEnd(20)} k=${String(r.region_k).padEnd(5)} `
    + `cells=${String(a.water_cells).padStart(4)} waterline=${String(a.waterline_cells).padStart(4)} (${String(a.waterline_cell_pct).padStart(6)}%) `
    + `nearest=${a.nearest_waterline_cell_m === null ? '   none' : String(a.nearest_waterline_cell_m).padStart(6)}m  qsat=${a.q_saturation_frac}`);
}
console.log(`\nwrote ${OUT}`);
