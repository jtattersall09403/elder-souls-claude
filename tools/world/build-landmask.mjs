#!/usr/bin/env node
/**
 * build-landmask.mjs — derive the province coastline from the binding map source.
 *
 * `ARBITRATION.md` S24 makes `corpus/50-world/black-marsh-map-source.jpg` authoritative for the
 * shape of Argonia, and `RI-WLD01` derives its 14.5 km² walkable-land figure by "colour-
 * segmenting the map source". This does that segmentation for real, at the binding transform
 *
 *     X = (px_x - 515) * 3.50 + 250 ; Z = (px_y - 60) * 3.50 + 250
 *
 * and writes a 1-bit land mask on a 25 m grid to `game/data/world/landmask.json`. The terrain
 * builder reads it, so the coastline the player walks IS the coastline on the map — rivers,
 * lakes, bays and all.
 *
 * Segmentation, in three parts, because colour alone cannot do the job:
 *   1. WATER is teal: the Padomaic and Topal read b - r > 15 with b >= g. Every land class on
 *      this map — olive marsh, tan Clay Moor, red Crimson Coast, pale Valus limestone — has
 *      b well below r.
 *   2. The off-province PARCHMENT (Cyrodiil, Elsweyr, Morrowind) is the same grey-beige as the
 *      Clay Moor and the Stone Forest and cannot be separated by colour at all. It is separated
 *      instead by CONNECTIVITY: the white national border line is a barrier, and the province is
 *      whatever is reachable from Helstrom without crossing water or a border. The reached set is
 *      then dilated 3 px so the white dotted road glyphs inside Argonia do not punch holes.
 *   3. The title cartouche and the compass rose are drawn over the Padomaic and segment as land.
 *      They are cartography, not coast, and are excluded by rectangle.
 *
 * Usage: node tools/world/build-landmask.mjs [--png <path>]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from '../node_modules/jpeg-js/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const SRC = join(ROOT, 'corpus', '50-world', 'black-marsh-map-source.jpg');
const OUT = join(ROOT, 'game', 'data', 'world', 'landmask.json');

const MPP = 3.5;
const BB = [515, 60, 1750, 1500];
const ORIGIN = [250, 250];
const CELL_M = 25;
const WORLD = [4825, 5540];
const SEED_PX = [1090, 781];               // Helstrom, the capital: unambiguously Argonia
const CART = [[1362, 1280, 1751, 1501], [1638, 1147, 1751, 1501]];

const img = jpeg.decode(readFileSync(SRC), { useTArray: true });
if (img.width !== 2048 || img.height !== 1536) throw new Error(`map source is ${img.width}x${img.height}, expected 2048x1536`);

const bw = BB[2] - BB[0], bh = BB[3] - BB[1];
const water = new Uint8Array(bw * bh);
const barrier = new Uint8Array(bw * bh);
const cart = new Uint8Array(bw * bh);
for (let y = BB[1]; y < BB[3]; y++) {
  for (let x = BB[0]; x < BB[2]; x++) {
    const i = (y * img.width + x) * 4, j = (y - BB[1]) * bw + (x - BB[0]);
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, sat = mx ? (mx - mn) / mx : 0;
    if (b - r > 15 && b >= g - 2) { water[j] = 1; barrier[j] = 1; }
    else if (lum > 190 && sat < 0.16) barrier[j] = 1;              // national border line
    for (const [ax, ay, bx, by] of CART) if (x >= ax && x < bx && y >= ay && y < by) { cart[j] = 1; barrier[j] = 1; }
  }
}

const reached = new Uint8Array(bw * bh);
const stack = [(SEED_PX[1] - BB[1]) * bw + (SEED_PX[0] - BB[0])];
reached[stack[0]] = 1;
while (stack.length) {
  const j = stack.pop(), x = j % bw, y = (j - x) / bw;
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
    const k = ny * bw + nx;
    if (reached[k] || barrier[k]) continue;
    reached[k] = 1; stack.push(k);
  }
}
const dil = new Uint8Array(bw * bh);
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
  if (!reached[y * bw + x]) continue;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
    dil[ny * bw + nx] = 1;
  }
}
const px = new Uint8Array(bw * bh);
let landPx = 0;
for (let j = 0; j < bw * bh; j++) if (!water[j] && !cart[j] && dil[j]) { px[j] = 1; landPx++; }

// ---- resample to the 25 m world grid -------------------------------------------------------
const cols = Math.ceil(WORLD[0] / CELL_M), rows = Math.ceil(WORLD[1] / CELL_M);
const bits = new Uint8Array(cols * rows);
let landCells = 0;
for (let cz = 0; cz < rows; cz++) {
  for (let cx = 0; cx < cols; cx++) {
    let hit = 0, n = 0;
    for (let sy = 0; sy < 6; sy++) {
      for (let sx = 0; sx < 6; sx++) {
        const wx = cx * CELL_M + (sx + 0.5) * CELL_M / 6;
        const wz = cz * CELL_M + (sy + 0.5) * CELL_M / 6;
        const ix = Math.round((wx - ORIGIN[0]) / MPP + BB[0]) - BB[0];
        const iy = Math.round((wz - ORIGIN[1]) / MPP + BB[1]) - BB[1];
        n++;
        if (ix < 0 || iy < 0 || ix >= bw || iy >= bh) continue;
        if (px[iy * bw + ix]) hit++;
      }
    }
    if (hit * 2 > n) { bits[cz * cols + cx] = 1; landCells++; }
  }
}
const bytes = new Uint8Array(Math.ceil(bits.length / 8));
for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= (1 << (i & 7));

const areaKm2 = landCells * CELL_M * CELL_M / 1e6;
const doc = {
  schema: 'elder-souls/landmask@1',
  note: 'Coastline of Argonia, colour-segmented and connectivity-filtered from the S24 binding map '
      + 'source at 3.50 m/px. 1 = land, 0 = sea, river, lake or off-province. Row-major from the '
      + 'world origin (NW corner): bit i = floor(z/cell_m)*cols + floor(x/cell_m), LSB first in each byte.',
  source: 'corpus/50-world/black-marsh-map-source.jpg',
  generator: 'tools/world/build-landmask.mjs',
  metres_per_source_pixel: MPP,
  px_to_world: 'X = (px_x - 515) * 3.50 + 250 ; Z = (px_y - 60) * 3.50 + 250',
  cell_m: CELL_M, cols, rows,
  world_bounds_m: { x: [0, WORLD[0]], z: [0, WORLD[1]] },
  source_land_px: landPx,
  source_land_km2: +(landPx * MPP * MPP / 1e6).toFixed(3),
  land_cells: landCells,
  land_km2: +areaKm2.toFixed(3),
  bits: Buffer.from(bytes).toString('base64'),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 0) + '\n');
process.stdout.write(
  `landmask ${cols}x${rows} @${CELL_M} m\n`
  + `  source segmentation : ${landPx} px = ${(landPx * MPP * MPP / 1e6).toFixed(2)} km² `
  + `(${(landPx / (bw * bh) * 100).toFixed(1)}% of the ${(bw * bh * MPP * MPP / 1e6).toFixed(1)} km² land bbox)\n`
  + `  25 m world grid     : ${landCells} cells = ${areaKm2.toFixed(2)} km²  [RI-WLD01 target 14.5, band 13.0-16.0]\n`);
