#!/usr/bin/env node
/**
 * build-landmask.mjs — derive the province coastline from the binding map source.
 *
 * `ARBITRATION.md` S24 makes `corpus/50-world/black-marsh-map-source.jpg` the authoritative
 * source for the shape of Argonia, and `RI-WLD01` derives its 14.5 km² walkable-land figure by
 * "colour-segmenting the map source". This script does that segmentation for real, at the
 * binding transform
 *
 *     X = (px_x - 515) * 3.50 + 250 ; Z = (px_y - 60) * 3.50 + 250
 *
 * and writes a 1-bit land mask on a 25 m grid to game/data/world/landmask.json. The terrain
 * builder reads it, so the coastline the player walks is the coastline on the map.
 *
 * Usage: node tools/world/build-landmask.mjs [--json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from '../node_modules/jpeg-js/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const SRC = join(ROOT, 'corpus', '50-world', 'black-marsh-map-source.jpg');
const OUT = join(ROOT, 'game', 'data', 'world', 'landmask.json');

const MPP = 3.5;                       // metres per source pixel (RI-WLD01 §1)
const BBOX = [515, 60, 1750, 1500];    // land bounding box, source pixels
const ORIGIN = [250, 250];             // world metres at BBOX top-left
const CELL_M = 25;                     // mask cell size in metres
const WORLD = [4825, 5540];

// The cartouche and the compass rose are drawn OVER the Padomaic in the south-east. They are
// gold-and-brown and segment as land; they are cartography, not coast. Excluded by rectangle,
// in source pixels, checked against the map by eye at 2048x1536.
const CARTOUCHE = [
  [1362, 1280, 1751, 1501],   // the BLACK MARSH title banner
  [1638, 1147, 1751, 1501],   // the compass rose
];

const raw = readFileSync(SRC);
const img = jpeg.decode(raw, { useTArray: true });
if (img.width !== 2048 || img.height !== 1536) {
  throw new Error(`map source is ${img.width}x${img.height}, expected 2048x1536`);
}

/**
 * Land vs not-land at one source pixel.
 *
 * Three things are NOT land: the Padomaic/Topal (blue-dominant), the off-province parchment
 * that carries CYRODIIL/ELSWEYR/MORROWIND (pale, desaturated, warm), and the white border
 * line. Everything else inside the bbox is Argonia — which includes the olive marsh, the
 * grey-green Valus Ridge, the tan Clay Moor and the red Crimson Coast, all four of which a
 * naive "green dominance" test would throw away.
 */
function isLand(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  if (b > g + 6 && b > r + 6) return false;          // open water: blue dominates
  if (lum > 168 && sat < 0.22) return false;         // parchment / border line / label halo
  if (b >= g && lum > 120 && sat < 0.30) return false; // pale coastal shelf wash
  return true;
}

const cols = Math.ceil(WORLD[0] / CELL_M);   // 193
const rows = Math.ceil(WORLD[1] / CELL_M);   // 222
const bits = new Uint8Array(cols * rows);
let landCells = 0;

// Each mask cell samples a 5x5 grid of source pixels inside its own footprint and takes the
// majority. Majority-of-25 both denoises the JPEG and keeps the rivers, which are 3-6 px wide.
for (let cz = 0; cz < rows; cz++) {
  for (let cx = 0; cx < cols; cx++) {
    const x0 = cx * CELL_M, z0 = cz * CELL_M;
    let hits = 0, n = 0;
    for (let sy = 0; sy < 5; sy++) {
      for (let sx = 0; sx < 5; sx++) {
        const wx = x0 + (sx + 0.5) * CELL_M / 5;
        const wz = z0 + (sy + 0.5) * CELL_M / 5;
        const px = Math.round((wx - ORIGIN[0]) / MPP + BBOX[0]);
        const py = Math.round((wz - ORIGIN[1]) / MPP + BBOX[1]);
        if (px < BBOX[0] || px >= BBOX[2] || py < BBOX[1] || py >= BBOX[3]) { n++; continue; }
        let masked = false;
        for (const [ax, ay, bx, by] of CARTOUCHE) {
          if (px >= ax && px < bx && py >= ay && py < by) { masked = true; break; }
        }
        n++;
        if (masked) continue;
        const i = (py * img.width + px) * 4;
        if (isLand(img.data[i], img.data[i + 1], img.data[i + 2])) hits++;
      }
    }
    if (hits * 2 > n) { bits[cz * cols + cx] = 1; landCells++; }
  }
}

// Pack to base64, row-major, LSB-first within each byte.
const bytes = new Uint8Array(Math.ceil(bits.length / 8));
for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= (1 << (i & 7));
const b64 = Buffer.from(bytes).toString('base64');

const areaKm2 = landCells * CELL_M * CELL_M / 1e6;
const doc = {
  schema: 'elder-souls/landmask@1',
  note: 'Coastline of Argonia, colour-segmented from corpus/50-world/black-marsh-map-source.jpg '
      + '(the S24 binding source) at 3.50 m per source pixel. 1 = land, 0 = sea or off-province. '
      + 'Row-major from the world origin (NW corner); bit i = (z/CELL)*cols + (x/CELL), LSB first.',
  source: 'corpus/50-world/black-marsh-map-source.jpg',
  generator: 'tools/world/build-landmask.mjs',
  metres_per_source_pixel: MPP,
  cell_m: CELL_M,
  cols, rows,
  world_bounds_m: { x: [0, WORLD[0]], z: [0, WORLD[1]] },
  land_cells: landCells,
  land_km2: +areaKm2.toFixed(3),
  bits: b64,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 0) + '\n');
process.stdout.write(`landmask ${cols}x${rows} @${CELL_M} m — ${landCells} land cells = ${areaKm2.toFixed(2)} km² (RI-WLD01 target 14.5, band 13.0-16.0)\n`);
