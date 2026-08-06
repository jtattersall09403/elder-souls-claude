#!/usr/bin/env node
/**
 * build-terrain.mjs — bake the province.
 *
 * Produces `game/data/world/terrain.json`: a 25 m raster of the landform, the region
 * assignment, the local relief, the substrate and — the load-bearing one — the per-region
 * water-table offset that reproduces RI-WLD10 §8's water coverage index *as measured on the
 * built terrain*, not as an assertion in a file.
 *
 * Why a baked raster rather than a runtime function: the field is a blend of thirteen regional
 * landforms, and the game samples ground height every fixed step for collision. Baking the
 * low-frequency half at 25 m and adding the high-frequency half analytically (game/src/world/
 * noise.js `detailAt`, shared with this tool) keeps a height query at a few dozen flops while
 * keeping the whole field inspectable as data — HARNESS.md §7.
 *
 * Usage: node tools/world/build-terrain.mjs [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fbm, ridged, terrace, detailAt, noise2, clamp, smoothstep, lerp } from '../../game/src/world/noise.js';
import { MicroField } from '../../game/src/world/microrelief.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const mask = rd('game/data/world/landmask.json');
const regionsDoc = rd('game/data/world/regions.json');
const scale = rd('corpus/50-world/world-scale.json');
const REG = regionsDoc.regions;
const N = REG.length;
const COLS = mask.cols, ROWS = mask.rows, CELL = mask.cell_m;
const WX = mask.world_bounds_m.x[1], WZ = mask.world_bounds_m.z[1];

// ---- land bits ------------------------------------------------------------------------------
const maskBytes = Buffer.from(mask.bits, 'base64');
const land = new Uint8Array(COLS * ROWS);
for (let i = 0; i < COLS * ROWS; i++) land[i] = (maskBytes[i >> 3] >> (i & 7)) & 1;

// A settlement stands on ground. The map's ring marker for Lilmoth sits over the estuary it is
// built on, so the 25 m segmentation puts the city in the water — and a landmask that says the
// start town is not land makes the province unwalkable from the first step. Every settlement and
// minor settlement footprint is therefore land before anything downstream (the coast distance, the
// region areas, the water solve, the census) reads the mask.
const PAD_R = { capital: 150, city: 135, town: 105, village: 80 };
const padSites = [
  ...Object.values(scale.settlements).map((s) => ({ x: s.x, z: s.z, r: PAD_R[s.tier] })),
  ...Object.values(scale.minor_settlements).map((s) => ({ x: s.x, z: s.z, r: 40 })),
];
let padded = 0;
for (const p of padSites) {
  const c0 = Math.max(0, Math.floor((p.x - p.r) / CELL)), c1 = Math.min(COLS - 1, Math.floor((p.x + p.r) / CELL));
  const z0 = Math.max(0, Math.floor((p.z - p.r) / CELL)), z1 = Math.min(ROWS - 1, Math.floor((p.z + p.r) / CELL));
  for (let cz = z0; cz <= z1; cz++) for (let cx = c0; cx <= c1; cx++) {
    if (Math.hypot(cx * CELL + CELL / 2 - p.x, cz * CELL + CELL / 2 - p.z) > p.r) continue;
    if (!land[cz * COLS + cx]) { land[cz * COLS + cx] = 1; padded++; }
  }
}

// ---- signed distance to the coast, metres (positive inland) ----------------------------------
function edt(pred) {
  const INF = 1e9;
  const d = new Float32Array(COLS * ROWS).fill(INF);
  for (let i = 0; i < d.length; i++) if (pred(i)) d[i] = 0;
  const dg = CELL * Math.SQRT2, ds = CELL;
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
    const i = z * COLS + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + ds);
    if (z > 0) v = Math.min(v, d[i - COLS] + ds);
    if (x > 0 && z > 0) v = Math.min(v, d[i - COLS - 1] + dg);
    if (x < COLS - 1 && z > 0) v = Math.min(v, d[i - COLS + 1] + dg);
    d[i] = v;
  }
  for (let z = ROWS - 1; z >= 0; z--) for (let x = COLS - 1; x >= 0; x--) {
    const i = z * COLS + x; let v = d[i];
    if (x < COLS - 1) v = Math.min(v, d[i + 1] + ds);
    if (z < ROWS - 1) v = Math.min(v, d[i + COLS] + ds);
    if (x < COLS - 1 && z < ROWS - 1) v = Math.min(v, d[i + COLS + 1] + dg);
    if (x > 0 && z < ROWS - 1) v = Math.min(v, d[i + COLS - 1] + dg);
    d[i] = v;
  }
  return d;
}
const dOut = edt((i) => !land[i]);   // distance from a land cell to the nearest water cell
const dIn = edt((i) => !!land[i]);   // distance from a water cell to the nearest land cell
const sd = new Float32Array(COLS * ROWS);
for (let i = 0; i < sd.length; i++) sd[i] = land[i] ? dOut[i] : -dIn[i];

// The sea and a river are not the same kind of water, and treating them alike was the single
// worst artefact of the first cut: every stream on the map became a 300 m gorge, because the
// shore ramp pulled the land down to sea level on both banks. A water cell more than 90 m from
// any shore is open water; anything narrower is a channel, and a channel is an INCISION in the
// local land surface, not a hole punched through to sea level.
const OCEAN_HALFWIDTH = 90;
const oceanCell = new Uint8Array(COLS * ROWS);
for (let i = 0; i < oceanCell.length; i++) oceanCell[i] = (!land[i] && dIn[i] >= OCEAN_HALFWIDTH) ? 1 : 0;
const dOceanRaw = edt((i) => !!oceanCell[i]);
const dOcean = new Float32Array(COLS * ROWS);
for (let i = 0; i < dOcean.length; i++) dOcean[i] = oceanCell[i] ? -dIn[i] : dOceanRaw[i];

// ---- region assignment: an area-fitted power diagram with a warped metric --------------------
// The plain Voronoi of thirteen label positions gets the topology right and the AREAS wrong,
// and `regions.json`'s areas are load-bearing (RI-WLD10's census is area-weighted). Additive
// weights are fitted until each region's built area matches its declared km2, and the metric is
// domain-warped so the borders stagger instead of reading as thirteen straight fences.
const CX = REG.map((r) => r.centroid_m[0]);
const CZ = REG.map((r) => r.centroid_m[1]);
const AABB = REG.map((r) => r.bounds_m);
const target = REG.map((r) => r.area_km2);
const wgt = new Float64Array(N);
const WARP = 170;

// Anchors: a region must contain its own label position, and a settlement must be in the region
// `settlements.json` says it is in. The warped power diagram gets neither for free — the corpus's
// own AABBs do not contain Lilmoth, and a 240 m warp can flip the cell a label sits in — so both
// are pinned. `RI-WLD01` §3 is authoritative on where a settlement is; `regions.json` is
// authoritative on which region it is in; neither may be quietly renegotiated by a Voronoi.
const ANCHORS = [];
REG.forEach((r, i) => ANCHORS.push({ r: i, x: r.centroid_m[0], z: r.centroid_m[1], radius: 240 }));
{
  const byName = new Map(REG.map((r, i) => [r.name.toLowerCase().replace(/[^a-z]/g, ''), i]));
  for (const [nm, st] of Object.entries(scale.settlements)) {
    const key = String(st.region).toLowerCase().replace(/[^a-z]/g, '');
    const ri = byName.get(key);
    if (ri === undefined) throw new Error(`settlement ${nm} names unknown region "${st.region}"`);
    ANCHORS.push({ r: ri, x: st.x, z: st.z, radius: 420 });
  }
}
function anchorBonus(r, px, pz) {
  let b = 0;
  for (const a of ANCHORS) {
    if (a.r !== r) continue;
    const d = Math.hypot(px - a.x, pz - a.z);
    if (d < a.radius) b += 3.2e6 * (1 - d / a.radius);
  }
  return b;
}

function warped(x, z) {
  return [
    x + (noise2(x / 430, z / 430, 9001) - 0.5) * 2 * WARP + (noise2(x / 155, z / 155, 9013) - 0.5) * 2 * WARP * 0.42,
    z + (noise2(x / 430, z / 430, 9007) - 0.5) * 2 * WARP + (noise2(x / 155, z / 155, 9019) - 0.5) * 2 * WARP * 0.42,
  ];
}
/** Squared distance outside an AABB grown by `pad`, so region identity stays near its map label. */
function outside2(p, q, bb, pad) {
  const dx = Math.max(bb.x[0] - pad - p, 0, p - (bb.x[1] + pad));
  const dz = Math.max(bb.z[0] - pad - q, 0, q - (bb.z[1] + pad));
  return dx * dx + dz * dz;
}
const wx = new Float32Array(COLS * ROWS), wz = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const [a, b] = warped(x * CELL + CELL / 2, z * CELL + CELL / 2);
  wx[i] = a; wz[i] = b;
}
const region = new Uint8Array(COLS * ROWS);
const pxG = new Float32Array(COLS * ROWS), pzG = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  pxG[z * COLS + x] = x * CELL + CELL / 2; pzG[z * COLS + x] = z * CELL + CELL / 2;
}
function assign() {
  const area = new Float64Array(N);
  for (let i = 0; i < COLS * ROWS; i++) {
    const p = wx[i], q = wz[i];
    let best = 0, bestC = Infinity;
    for (let r = 0; r < N; r++) {
      const dx = p - CX[r], dz = q - CZ[r];
      const c = dx * dx + dz * dz - wgt[r] + 5.0 * outside2(p, q, AABB[r], 380) - anchorBonus(r, pxG[i], pzG[i]);
      if (c < bestC) { bestC = c; best = r; }
    }
    region[i] = best;
    if (land[i]) area[best] += CELL * CELL / 1e6;
  }
  return area;
}
let area = assign();
for (let it = 0; it < 220; it++) {
  let worst = 0;
  for (let r = 0; r < N; r++) {
    const err = target[r] - area[r];
    worst = Math.max(worst, Math.abs(err));
    wgt[r] += err * 1.15e5;               // km2 error -> m2 of additive weight
  }
  area = assign();
  if (worst < 0.006) break;
}

// ---- landform: painted from the region raster, then blurred --------------------------------
// Identity is a hard assignment (above); LANDFORM is the same assignment blurred over ~350 m, and
// the two are deliberately different. A hard landform edge would put a 270 m cliff on the Valus
// Ridge / Blackwood border; a soft identity would be thirteen tints of one swamp, which is what
// S24 forbids. So the ground you STAND on changes over a kilometre and the ground you LOOK at
// changes at the border. Painting from the raster rather than from centroid distance is also what
// stops a region inheriting a neighbour's landform across half its own territory — the first cut
// of this file gave Blackwood a 410 m peak because its territory reached toward Valus Ridge.
const BLUR_SIGMA_CELLS = 7;

function gaussBlur(src, sigma) {
  const rad = Math.ceil(sigma * 2.6);
  const k = new Float64Array(rad * 2 + 1);
  let ks = 0;
  for (let i = -rad; i <= rad; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + rad] = v; ks += v; }
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
    let a = 0, w = 0;
    for (let i = -rad; i <= rad; i++) {
      const nx = x + i; if (nx < 0 || nx >= COLS) continue;
      a += src[z * COLS + nx] * k[i + rad]; w += k[i + rad];
    }
    tmp[z * COLS + x] = a / w;
  }
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
    let a = 0, w = 0;
    for (let i = -rad; i <= rad; i++) {
      const nz = z + i; if (nz < 0 || nz >= ROWS) continue;
      a += tmp[nz * COLS + x] * k[i + rad]; w += k[i + rad];
    }
    out[z * COLS + x] = a / w;
  }
  return out;
}

/** Each region's own macro landform, in metres, before blurring. */
function macro(r, x, z) {
  const t = REG[r].terrain;
  const u = x / t.wavelength_m, v = z / t.wavelength_m;
  const s = 700 + r * 131;
  let n;
  switch (t.style) {
    case 'mountain': n = ridged(u, v, s, 5) - 0.26; break;
    case 'upland': n = ridged(u, v, s, 4) * 0.75 + fbm(u, v, s + 11, 3) * 0.25 - 0.31; break;
    case 'plateau': case 'fired-flat': case 'comb': case 'crater-salt':
      n = terrace(fbm(u, v, s, 3), 4, 0.35) - 0.42; break;
    case 'littoral-rock': n = ridged(u, v, s, 3) * 0.55 + fbm(u, v, s + 5, 3) * 0.45 - 0.40; break;
    default: n = fbm(u, v, s, 4) - 0.42;
  }
  return t.base_m + t.amp_m * n;
}

/** Coastal dip: only the tidal-flat regions drop below the mean waterline at the shore. */
const DIP = { 'marauders-coast': 0.78, 'eastern-rootlands': 0.66, 'western-rootlands': 0.42, 'crimson-coast': 0.26, 'stone-wastes': 0.24 };
const dipOf = REG.map((r) => DIP[r.id] || 0);

const macroRaw = new Float32Array(COLS * ROWS);
const reliefRaw = new Float32Array(COLS * ROWS);
const ridgeRaw = new Float32Array(COLS * ROWS);
const terrRaw = new Float32Array(COLS * ROWS);
const dipRaw = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x, px = x * CELL + CELL / 2, pz = z * CELL + CELL / 2, r = region[i];
  macroRaw[i] = macro(r, px, pz);
  reliefRaw[i] = REG[r].terrain.relief_m;
  ridgeRaw[i] = REG[r].terrain.ridge;
  terrRaw[i] = REG[r].terrain.terrace;
  dipRaw[i] = dipOf[r];
}
const macroG = gaussBlur(macroRaw, BLUR_SIGMA_CELLS);
const reliefB = gaussBlur(reliefRaw, BLUR_SIGMA_CELLS * 0.5);
const ridgeB = gaussBlur(ridgeRaw, BLUR_SIGMA_CELLS * 0.5);
const terrB = gaussBlur(terrRaw, BLUR_SIGMA_CELLS * 0.5);
const dipB = gaussBlur(dipRaw, BLUR_SIGMA_CELLS * 0.5);

const baseH = new Float32Array(COLS * ROWS);
const shoreH = new Float32Array(COLS * ROWS);
const reliefG = new Float32Array(COLS * ROWS);
const ridgeG = ridgeB, terrG = terrB;
for (let z = 0; z < ROWS; z++) {
  for (let x = 0; x < COLS; x++) {
    const i = z * COLS + x;
    const m = macroG[i], s = sd[i], o = dOcean[i];
    // The shore ramp is short and scales only weakly with height; it is measured against the
    // OPEN SEA, so a stream crossing the Valus Ridge cuts a channel into a mountain instead of
    // dragging the mountain down to the waterline.
    const ramp = clamp(70 + Math.abs(m) * 0.70, 70, 340);
    const shore = m * smoothstep(0, ramp, Math.max(o, 0));
    let h;
    if (oceanCell[i]) {
      h = -Math.min(40, 0.5 + 40 * (1 - Math.exp(-dIn[i] / 210)));
    } else if (!land[i]) {
      h = shore - (0.85 + 3.1 * (1 - Math.exp(-dIn[i] / 45)));      // a channel, incised
    } else {
      h = shore - dipB[i] * (1 - smoothstep(0, 320, Math.max(o, 0)));
    }
    baseH[i] = h;
    shoreH[i] = shore;
    reliefG[i] = land[i] ? reliefB[i] * smoothstep(0, 90, Math.max(o, 0)) : reliefB[i] * 0.25;
  }
}

// ---- sea assignment ---------------------------------------------------------------------------
// Topal Bay west and south, the Padomaic east: two different bodies of water (RI-WLD10 §9), never
// one ocean with two labels.
const seaOf = new Uint8Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const px = x * CELL, pz = z * CELL;
  seaOf[i] = (px > 3250 || (px > 2750 && pz < 2400)) ? 2 : 1;
}

// ---- height sampling used by the water solve (identical to the runtime field) -------------------
function bilinearBase(arr, x, z) {
  const fx = clamp(x / CELL - 0.5, 0, COLS - 1.001), fz = clamp(z / CELL - 0.5, 0, ROWS - 1.001);
  const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
  const i00 = z0 * COLS + x0, i10 = i00 + 1, i01 = i00 + COLS, i11 = i01 + 1;
  return lerp(lerp(arr[i00], arr[i10], tx), lerp(arr[i01], arr[i11], tx), tz);
}
// The region's own ground micro-relief, evaluated through the SAME class the running game
// evaluates it through, over the SAME region raster that is baked below. If this were a second
// implementation the water-table offsets solved here would describe a surface the game does not
// have — which is the RI-MTH04 defect this whole file is arranged to avoid.
const microField = new MicroField(REG, (x, z) =>
  region[clamp(Math.floor(z / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1)]);

function groundAt(x, z) {
  return bilinearBase(baseH, x, z)
    + detailAt(x, z, bilinearBase(reliefG, x, z), bilinearBase(ridgeG, x, z), bilinearBase(terrG, x, z))
    + microField.at(x, z);
}

// ---- solve the per-region water-table offsets ---------------------------------------------------
// RI-WLD10 §8's WCI is "the fraction of a region's walkable surface at >= W1 at mean tide". Here it
// is exactly that, measured on this terrain: standing water is `table - ground` where the table is
// the blended base surface plus a per-region offset, so the coverage index is a monotone function
// of one scalar per region and bisection lands it. M48 then compares declared against observed and
// the two agree because they are the same computation.
const SAMPLES = [];   // [x, z, regionIndex, ground]
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  if (!land[i]) continue;
  for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
    const px = x * CELL + (sx + 0.5) * CELL / 3, pz = z * CELL + (sy + 0.5) * CELL / 3;
    SAMPLES.push(px, pz, region[i], groundAt(px, pz));
  }
}
const nSamples = SAMPLES.length / 4;
// The surface of every water body the MAP draws: sea level for open water, one notch below the
// local bank for a channel or a tarn. Sentinel -3276 on land, then dilated one cell so the
// bilinear read at a bank never interpolates the sentinel.
const wtop = new Float32Array(COLS * ROWS).fill(-3276);
const chanNoise = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  chanNoise[z * COLS + x] = noise2((x * CELL) / 70, (z * CELL) / 70, 8801);
}
for (let i = 0; i < wtop.length; i++) {
  if (oceanCell[i]) wtop[i] = 0;
  else if (!land[i]) wtop[i] = shoreH[i] - 0.15;
}
{
  const src = Float32Array.from(wtop);
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
    let mx = src[z * COLS + x];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
      mx = Math.max(mx, src[nz * COLS + nx]);
    }
    wtop[z * COLS + x] = mx;
  }
}

const DRY = REG.map((r) => r.water.wci === 0);   // the Clay Moor and the Hive: no standing water at all
const offsets = new Float64Array(N).fill(-8);
// How much of the channel network the map draws through a region actually HOLDS water. In the
// Stone Wastes and on the Valus Ridge the answer is "most of it does not": a dry wash and a
// salt-cut are still drawn as channels on a map. This is the second solve variable and it exists
// because the map's own water network already exceeds those two regions' declared coverage.
const chanWet = new Float64Array(N).fill(1);
const woffG = new Float32Array(COLS * ROWS);
const SEA_REACH = 400;          // RI-WLD10 §7: the tide damps to zero 400 m inland

/**
 * The water table is a per-cell field, painted from the REGION RASTER and blurred, not
 * interpolated from centroid distance. That difference is the whole solve: a region's territory
 * reaches well past its own label position, and blending by centroid distance handed the Deep
 * Marshes the Stone Forest's dry table over half of its own ground.
 */
function paintOffsets(off) {
  const tmp = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) woffG[i] = off[region[i]];
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      let s = 0, n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
        s += woffG[nz * COLS + nx]; n++;
      }
      tmp[z * COLS + x] = s / n;
    }
    woffG.set(tmp);
  }
}
function tableAt(x, z) { return bilinearBase(baseH, x, z) + bilinearBase(woffG, x, z); }
/** Sea water floods land below the waterline only within reach of the sea; an inland hollow is dry. */
function seaDepthAt(x, z, g) {
  const s = bilinearBase(sd, x, z);
  if (s > SEA_REACH || g >= 0) return 0;
  return -g * smoothstep(SEA_REACH, 0, s);
}
function channelOpen(x, z, r) {
  if (chanWet[r] >= 1) return true;
  if (chanWet[r] <= 0) return false;
  return bilinearBase(chanNoise, x, z) < chanWet[r];
}
function depthAt(x, z, g, r) {
  if (DRY[r]) return 0;
  let d = tableAt(x, z) - g;
  if (channelOpen(x, z, r)) d = Math.max(d, bilinearBase(wtop, x, z) - g);
  return Math.max(d, seaDepthAt(x, z, g));
}
function wciOf(r) {
  let wet = 0, tot = 0;
  for (let i = 0; i < nSamples; i++) {
    if (SAMPLES[i * 4 + 2] !== r) continue;
    const x = SAMPLES[i * 4], z = SAMPLES[i * 4 + 1], g = SAMPLES[i * 4 + 3];
    tot++;
    if (depthAt(x, z, g, r) >= 0.01) wet++;
  }
  return tot ? wet / tot : 0;
}
paintOffsets(offsets);
for (let pass = 0; pass < 6; pass++) {
  for (let r = 0; r < N; r++) {
    const tgt = REG[r].water.wci;
    if (tgt === 0) { offsets[r] = -12; chanWet[r] = 0; continue; }
    const saveO = offsets[r], saveC = chanWet[r];
    offsets[r] = -12; chanWet[r] = 1; paintOffsets(offsets);
    const floor = wciOf(r);
    offsets[r] = saveO; chanWet[r] = saveC;
    if (floor > tgt) {
      // Even with no water table at all the drawn channels over-cover: solve how many of them run.
      offsets[r] = -12; chanWet[r] = 1;
      let lo = 0, hi = 1;
      for (let it = 0; it < 26; it++) {
        const mid = (lo + hi) / 2; chanWet[r] = mid; paintOffsets(offsets);
        if (wciOf(r) < tgt) lo = mid; else hi = mid;
      }
      chanWet[r] = (lo + hi) / 2;
    } else {
      chanWet[r] = 1;
      let lo = -12, hi = 10;
      for (let it = 0; it < 28; it++) {
        const mid = (lo + hi) / 2;
        const save = offsets[r]; offsets[r] = mid; paintOffsets(offsets);
        const v = wciOf(r);
        offsets[r] = save;
        if (v < tgt) lo = mid; else hi = mid;
      }
      offsets[r] = (lo + hi) / 2;
    }
    paintOffsets(offsets);
  }
}
paintOffsets(offsets);
const observed = REG.map((_, r) => wciOf(r));

// ---- substrate --------------------------------------------------------------------------------
const SUB = ['FIRM', 'SILT', 'SUCK'];
const substrate = new Uint8Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const list = REG[region[i]].water.substrates;
  const n = noise2(x * CELL / 180, z * CELL / 180, 5501);
  substrate[i] = SUB.indexOf(list[Math.min(list.length - 1, Math.floor(n * list.length))]);
}

const woff = woffG;

// ---- sites: the ground the settlements stand on --------------------------------------------------
// RI-WLD01 M1 places eight settlements from the table verbatim and a settlement underwater or on a
// cliff is a defect, so each site declares a flattened pad. The pad's elevation is the local terrain,
// lifted clear of the local water table — the town is not floated above the province, the province
// is levelled under the town.
const sites = [];
function addSite(id, name, kind, x, z, rFlat, rFall) {
  let sum = 0, n = 0;
  for (let a = 0; a < 12; a++) {
    const th = a / 12 * Math.PI * 2;
    for (const rr of [0, rFlat * 0.5, rFlat]) { sum += groundAt(x + Math.cos(th) * rr, z + Math.sin(th) * rr); n++; }
  }
  const local = sum / n;
  const tbl = Math.max(tableAt(x, z), bilinearBase(wtop, x, z));
  const y = Math.max(local, tbl + 0.85, 0.85);
  sites.push({ id, name, kind, x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(2), r_flat: rFlat, r_falloff: rFall });
}
const TIER_R = { capital: [150, 330], city: [135, 300], town: [105, 240], village: [80, 190] };
for (const [name, s] of Object.entries(scale.settlements)) {
  const [rf, ro] = TIER_R[s.tier];
  addSite(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, 'settlement', s.x, s.z, rf, ro);
}
for (const [name, s] of Object.entries(scale.minor_settlements)) {
  addSite(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, 'minor', s.x, s.z, 40, 105);
}
for (const [name, s] of Object.entries(scale.landmarks)) {
  addSite(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, 'landmark', s.x, s.z, 26, 70);
}

// ---- pack ------------------------------------------------------------------------------------------
const packBits = (bits) => {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= (1 << (i & 7));
  return Buffer.from(out).toString('base64');
};
const b64 = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64');
const baseDm = new Int16Array(COLS * ROWS);
const reliefU = new Uint8Array(COLS * ROWS);
const ridgeU = new Uint8Array(COLS * ROWS);
const terrU = new Uint8Array(COLS * ROWS);
const woffCm = new Int16Array(COLS * ROWS);
const coast16 = new Int8Array(COLS * ROWS);
const wtopDm = new Int16Array(COLS * ROWS);
const chanNoiseU8 = new Uint8Array(COLS * ROWS);
for (let i = 0; i < COLS * ROWS; i++) {
  baseDm[i] = Math.round(clamp(baseH[i], -3200, 3200) * 10);
  reliefU[i] = Math.round(clamp(reliefG[i] / 0.06, 0, 255));
  ridgeU[i] = Math.round(clamp(ridgeG[i], 0, 1) * 255);
  terrU[i] = Math.round(clamp(terrG[i], 0, 1) * 255);
  woffCm[i] = Math.round(clamp(woff[i], -320, 320) * 100);
  coast16[i] = Math.round(clamp(sd[i] / 16, -127, 127));
  wtopDm[i] = Math.round(clamp(wtop[i], -3276, 3276) * 10);
  chanNoiseU8[i] = Math.round(clamp(chanNoise[i], 0, 1) * 255);
}

// ---- census (reported, and re-measured independently by tools/world/scale-audit.mjs) -------------
let minH = Infinity, maxH = -Infinity, aboveSea = 0, below5 = 0, above100 = 0, landCells = 0;
const regMax = new Float64Array(N).fill(-Infinity);
const regBelow5 = new Float64Array(N), regCells = new Float64Array(N), regSlopeSum = new Float64Array(N);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const h = groundAt(x * CELL + CELL / 2, z * CELL + CELL / 2);
  minH = Math.min(minH, h); maxH = Math.max(maxH, h);
  if (!land[i]) continue;
  landCells++;
  regMax[region[i]] = Math.max(regMax[region[i]], h);
  regCells[region[i]]++;
  if (h < 5) regBelow5[region[i]]++;
  {
    const px = x * CELL + CELL / 2, pz = z * CELL + CELL / 2, e = 5;
    const gx = (groundAt(px + e, pz) - groundAt(px - e, pz)) / (2 * e);
    const gz = (groundAt(px, pz + e) - groundAt(px, pz - e)) / (2 * e);
    regSlopeSum[region[i]] += Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
  }
  if (h > 0) aboveSea++;
  if (h < 5) below5++;
  if (h > 100) above100++;
}

const doc = {
  schema: 'elder-souls/terrain@1',
  generator: 'tools/world/build-terrain.mjs',
  note: 'The province as a raster. `base_dm` is the low-frequency landform in decimetres on a 25 m '
      + 'grid; the game adds game/src/world/noise.js detailAt(x,z,relief,ridge,terrace) analytically, '
      + 'so ground height is continuous and identical in the builder and at runtime. `woff_cm` is the '
      + 'standing-water table above the base surface: depth = (base + woff) - ground, which is why '
      + 'RI-WLD10 §8\'s coverage index could be SOLVED for rather than asserted.',
  world_bounds_m: { x: [0, WX], z: [0, WZ] },
  cell_m: CELL, cols: COLS, rows: ROWS,
  sea_level_m: 0,
  sea_reach_m: SEA_REACH,
  elevation_range_m: [+minH.toFixed(1), +maxH.toFixed(1)],
  land_cells: landCells,
  land_cells_added_by_settlement_pads: padded,
  land_km2: +(landCells * CELL * CELL / 1e6).toFixed(3),
  land_above_sea_km2: +(aboveSea * CELL * CELL / 1e6).toFixed(3),
  frac_land_below_5m: +(below5 / landCells).toFixed(3),
  frac_land_above_100m: +(above100 / landCells).toFixed(3),
  detail: { fn: 'game/src/world/noise.js detailAt', relief_unit_m: 0.06 },
  regions: REG.map((r, i) => ({
    id: r.id, index: i,
    built_area_km2: +area[i].toFixed(3), declared_area_km2: r.area_km2,
    max_elevation_m: +regMax[i].toFixed(1),
    mean_slope_deg: +(regSlopeSum[i] / Math.max(1, regCells[i])).toFixed(2),
    frac_below_5m: +(regBelow5[i] / Math.max(1, regCells[i])).toFixed(3),
    dry: DRY[i],
    water_offset_m: +offsets[i].toFixed(4),
    channel_wet: +chanWet[i].toFixed(4),
    wci_declared: r.water.wci, wci_built: +observed[i].toFixed(4),
  })),
  sites,
  channels: {
    order: ['base_dm:int16', 'relief:uint8', 'ridge:uint8', 'terrace:uint8', 'region:uint8', 'substrate:uint8', 'woff_cm:int16', 'coast16_m:int8', 'wtop_dm:int16', 'ocean:uint8', 'chan_noise:uint8'],
    substrate_names: SUB,
    sea_names: ['none', 'topal', 'padomaic'],
    base_dm: b64(baseDm), relief: b64(reliefU), ridge: b64(ridgeU), terrace: b64(terrU),
    region: b64(region), substrate: b64(substrate), woff_cm: b64(woffCm), coast16_m: b64(coast16),
    wtop_dm: b64(wtopDm), ocean: b64(oceanCell), chan_noise: b64(chanNoiseU8),
    sea: b64(seaOf), land: packBits(land),
  },
};
writeFileSync(join(ROOT, 'game/data/world/terrain.json'), JSON.stringify(doc) + '\n');

const pad = Math.max(...REG.map((r) => r.id.length));
process.stdout.write(`terrain ${COLS}x${ROWS} @${CELL} m\n`);
process.stdout.write(`elevation ${minH.toFixed(1)} .. ${maxH.toFixed(1)} m   (RI-WLD07 target -40 .. +420)\n`);
process.stdout.write(`land ${(landCells * CELL * CELL / 1e6).toFixed(2)} km2, above sea ${(aboveSea * CELL * CELL / 1e6).toFixed(2)} km2, `);
process.stdout.write(`below +5 m ${(below5 / landCells * 100).toFixed(1)}% (35-50), above +100 m ${(above100 / landCells * 100).toFixed(1)}% (>=12)\n\n`);
process.stdout.write(`${'region'.padEnd(pad)}  area km2  (decl)   maxY     woff    WCI built  (decl)\n`);
for (let r = 0; r < N; r++) {
  process.stdout.write(`${REG[r].id.padEnd(pad)}  ${area[r].toFixed(3).padStart(8)}  ${String(target[r]).padStart(6)}  `
    + `${regMax[r].toFixed(1).padStart(6)}  ${offsets[r].toFixed(3).padStart(7)}  ${observed[r].toFixed(3).padStart(9)}  ${String(REG[r].water.wci).padStart(6)}`
    + `   <5m ${(regBelow5[r] / regCells[r] * 100).toFixed(0).padStart(3)}%  slope ${(regSlopeSum[r] / regCells[r]).toFixed(1).padStart(4)}\u00b0\n`);
}
