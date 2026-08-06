// The world field: ground height, region, water depth, substrate and tide at any point of the
// province, from `game/data/world/terrain.json`.
//
// One object answers every spatial question the simulation, the renderer, the road builder and
// the harness ask, so there is exactly one ground height at a point and no chance of the
// collision surface and the drawn surface disagreeing — which is the defect RI-MTH04 calls a
// fabricated measurement when it happens the other way round.
//
// The low-frequency half of the terrain is a baked 25 m raster; the high-frequency half is
// `noise.js detailAt`, evaluated analytically. `tools/world/build-terrain.mjs` uses the same
// function, which is why the water census it solved offline is reproduced at runtime.
'use strict';

import { detailAt, noise2, clamp, smoothstep, lerp } from './noise.js';

const BANDS = [
  { id: 'W0', name: 'DRY', min: 0.00 },
  { id: 'W1', name: 'FILM', min: 0.01 },
  { id: 'W2', name: 'SHIN', min: 0.21 },
  { id: 'W3', name: 'WADE', min: 0.51 },
  { id: 'W4', name: 'DEEP', min: 0.96 },
  { id: 'W5', name: 'SWIM', min: 1.41 },
];
export const TIDE_STATES = ['LOW', 'RISING', 'HIGH', 'FALLING'];

function unb64(str, Type) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / Type.BYTES_PER_ELEMENT);
}

export class WorldField {
  /**
   * @param {object} terrain game/data/world/terrain.json
   * @param {object} regions game/data/world/regions.json
   * @param {object} water   game/data/world/water.json
   */
  constructor(terrain, regions, water) {
    this.doc = terrain;
    this.regions = regions.regions;
    this.water = water;
    this.cols = terrain.cols; this.rows = terrain.rows; this.cell = terrain.cell_m;
    this.sizeX = terrain.world_bounds_m.x[1];
    this.sizeZ = terrain.world_bounds_m.z[1];
    this.seaReach = terrain.sea_reach_m;
    const c = terrain.channels;
    this.base = unb64(c.base_dm, Int16Array);
    this.reliefU = unb64(c.relief, Uint8Array);
    this.ridgeU = unb64(c.ridge, Uint8Array);
    this.terrU = unb64(c.terrace, Uint8Array);
    this.regionU = unb64(c.region, Uint8Array);
    this.substrateU = unb64(c.substrate, Uint8Array);
    this.woffI = unb64(c.woff_cm, Int16Array);
    this.coastI = unb64(c.coast16_m, Int8Array);
    this.wtopI = unb64(c.wtop_dm, Int16Array);
    this.oceanU = unb64(c.ocean, Uint8Array);
    this.chanU = unb64(c.chan_noise, Uint8Array);
    const lb = unb64(c.land, Uint8Array);
    this.landBits = lb;
    this.reliefUnit = terrain.detail.relief_unit_m;
    this.substrateNames = c.substrate_names;

    // Per-region scalars, indexed by the region raster's value.
    this.dry = new Uint8Array(this.regions.length);
    this.chanWet = new Float32Array(this.regions.length);
    this.tidal = new Uint8Array(this.regions.length);
    this.seaOfRegion = new Uint8Array(this.regions.length);
    this.kOfRegion = new Float32Array(this.regions.length);
    const byId = new Map(water.regions.map((w) => [w.region_id, w]));
    this.regions.forEach((r, i) => {
      const w = byId.get(r.id);
      this.dry[i] = w.dry ? 1 : 0;
      this.chanWet[i] = w.channel_wet;
      this.tidal[i] = w.tidal ? 1 : 0;
      this.seaOfRegion[i] = w.sea === 'padomaic' ? 2 : w.sea === 'topal' ? 1 : 0;
      this.kOfRegion[i] = w.k || 0;
    });
    this.tideRange = { 1: water.tide.mean_range_m * water.tide.seas.topal.range_mult,
      2: water.tide.mean_range_m * water.tide.seas.padomaic.range_mult };
    this.inlandDamping = water.tide.inland_damping_m;

    this.sites = terrain.sites;
    this.siteGrid = buildBuckets(this.sites.map((s) => ({ x: s.x, z: s.z, r: s.r_falloff, ref: s })), 400);
    this.roads = null;
    this.roadGrid = null;
    this.tidePhase = 0;                        // 0..1 through the 12-minute cycle
  }

  /** Attach the road network; roads carve a corridor into the ground (`RI-WLD01` §4). */
  setRoads(roads) {
    this.roads = roads;
    const segs = [];
    for (const leg of roads.legs) {
      const p = leg.points;
      for (let i = 0; i + 1 < p.length; i++) {
        segs.push({ ax: p[i][0], az: p[i][1], ay: p[i][2], bx: p[i + 1][0], bz: p[i + 1][1], by: p[i + 1][2], hw: leg.half_width_m, leg: leg.id });
      }
    }
    this.roadSegs = segs;
    this.roadGrid = buildSegBuckets(segs, 120);
    return roads;
  }

  // ---- raster reads ---------------------------------------------------------------------
  _bilinear(arr, x, z, scale) {
    const fx = clamp(x / this.cell - 0.5, 0, this.cols - 1.001);
    const fz = clamp(z / this.cell - 0.5, 0, this.rows - 1.001);
    const x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0;
    const i00 = z0 * this.cols + x0;
    const a = lerp(arr[i00], arr[i00 + 1], tx);
    const b = lerp(arr[i00 + this.cols], arr[i00 + this.cols + 1], tx);
    return lerp(a, b, tz) * scale;
  }
  _cellIndex(x, z) {
    const cx = clamp(Math.floor(x / this.cell), 0, this.cols - 1);
    const cz = clamp(Math.floor(z / this.cell), 0, this.rows - 1);
    return cz * this.cols + cx;
  }

  regionIndexAt(x, z) { return this.regionU[this._cellIndex(x, z)]; }
  regionAt(x, z) { return this.regions[this.regionIndexAt(x, z)]; }
  isLandAt(x, z) { const i = this._cellIndex(x, z); return ((this.landBits[i >> 3] >> (i & 7)) & 1) === 1; }
  isOceanAt(x, z) { return this.oceanU[this._cellIndex(x, z)] === 1; }
  coastDistAt(x, z) { return this._bilinear(this.coastI, x, z, 16); }
  substrateAt(x, z) {
    const d = this.depthAt(x, z);
    const s = this.substrateNames[this.substrateU[this._cellIndex(x, z)]];
    return d > 0 && s === 'FIRM' ? 'SILT' : s;
  }

  /** The low-frequency landform, metres. */
  baseAt(x, z) { return this._bilinear(this.base, x, z, 0.1); }

  /** Ground height, metres above sea level. The one surface: collision, mesh and audit read it. */
  heightAt(x, z) {
    let h = this.baseAt(x, z)
      + detailAt(x, z,
        this._bilinear(this.reliefU, x, z, this.reliefUnit),
        this._bilinear(this.ridgeU, x, z, 1 / 255),
        this._bilinear(this.terrU, x, z, 1 / 255));
    h = this._applySites(x, z, h);
    h = this._applyRoads(x, z, h);
    return h;
  }

  /**
   * Settlement, camp and landmark pads. RI-WLD01 M1 places eight settlements from the table
   * verbatim, and a settlement on a 30 degree slope or under half a metre of water is a defect —
   * so the province is levelled under the town rather than the town floated over the province.
   */
  _applySites(x, z, h) {
    const bucket = this.siteGrid.at(x, z);
    for (let i = 0; i < bucket.length; i++) {
      const s = bucket[i].ref;
      const d = Math.hypot(x - s.x, z - s.z);
      if (d >= s.r_falloff) continue;
      h = lerp(h, s.y, smoothstep(s.r_falloff, s.r_flat, d));
    }
    return h;
  }

  /** The road corridor: a causeway that holds its own elevation profile across whatever it crosses. */
  _applyRoads(x, z, h) {
    if (!this.roadGrid) return h;
    const segs = this.roadGrid.at(x, z);
    let bestW = 0, bestY = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / len2, 0, 1);
      const px = s.ax + dx * t, pz = s.az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      const outer = s.hw * 3.2;
      if (d >= outer) continue;
      const w = smoothstep(outer, s.hw, d);
      if (w > bestW) { bestW = w; bestY = lerp(s.ay, s.by, t); }
    }
    return bestW > 0 ? lerp(h, bestY, bestW) : h;
  }

  /** Slope in degrees at a point, from central differences at 5 m. */
  slopeAt(x, z, e = 5) {
    const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
  }

  // ---- water ------------------------------------------------------------------------------
  /** Which sea a point belongs to: 0 none, 1 Topal Bay, 2 the Padomaic. */
  seaAt(x, z) {
    return (x > 3250 || (x > 2750 && z < 2400)) ? 2 : 1;
  }

  /** Tide height in metres about the mean plane, for a sea, at the current phase. */
  tideHeight(sea, phase = this.tidePhase) {
    if (!sea) return 0;
    return (this.tideRange[sea] / 2) * Math.sin(2 * Math.PI * phase);
  }

  tideState(phase = this.tidePhase) {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.125 || p >= 0.875) return 'LOW';
    if (p < 0.375) return 'RISING';
    if (p < 0.625) return 'HIGH';
    return 'FALLING';
  }

  /**
   * The height of the water surface at a point, or `null` where there is no water.
   *
   * Three sources, maxed: the region's standing-water table (marsh, paddy, flooded forest), the
   * surface of a water body the map itself draws (sea, river, tarn), and the sea reaching inland
   * over ground that lies below the waterline. The tide moves the second and third and is damped
   * linearly to zero over the first 400 m inland (RI-WLD10 §7); in a non-tidal region its
   * amplitude is exactly zero, which is what M54 checks.
   */
  waterSurfaceAt(x, z, phase = this.tidePhase) {
    const i = this._cellIndex(x, z);
    const r = this.regionU[i];
    if (this.dry[r]) return null;
    const g = this.heightAt(x, z);
    const table = this.baseAt(x, z) + this._bilinear(this.woffI, x, z, 0.01);
    let surf = table;

    const sea = this.seaAt(x, z);
    const tidalHere = this.tidal[r] === 1 || !this.isLandAt(x, z);
    const coast = this.coastDistAt(x, z);
    const damp = tidalHere ? (coast <= 0 ? 1 : 1 - smoothstep(0, this.inlandDamping, coast)) : 0;
    const tide = this.tideHeight(sea, phase) * damp;

    const wt = this._bilinear(this.wtopI, x, z, 0.1);
    if (wt > -300) {
      const open = this.chanWet[r] >= 1 || this.isOceanAt(x, z)
        || this._bilinear(this.chanU, x, z, 1 / 255) < this.chanWet[r];
      if (open) surf = Math.max(surf, wt + (this.isOceanAt(x, z) ? tide : 0));
    }
    if (coast <= this.seaReach && g < 0) surf = Math.max(surf, tide + 0);
    if (surf <= g - 1e-6) return null;
    return surf;
  }

  depthAt(x, z, phase = this.tidePhase) {
    const s = this.waterSurfaceAt(x, z, phase);
    if (s === null) return 0;
    return Math.max(0, s - this.heightAt(x, z));
  }

  bandOf(depth) {
    let b = BANDS[0];
    for (const k of BANDS) if (depth >= k.min) b = k;
    return b.id;
  }

  /** Everything the harness's `getWaterAt(x, z)` reports. */
  waterAt(x, z, phase = this.tidePhase) {
    const r = this.regionIndexAt(x, z);
    const reg = this.regions[r];
    const depth = this.depthAt(x, z, phase);
    const sea = this.seaAt(x, z);
    return {
      depth_m: +depth.toFixed(3),
      band: this.bandOf(depth),
      substrate: this.substrateAt(x, z),
      region: reg.id,
      region_name: reg.name,
      sea: this.tidal[r] || !this.isLandAt(x, z) ? (sea === 2 ? 'padomaic' : 'topal') : null,
      tidal: this.tidal[r] === 1,
      k: this.kOfRegion[r] || null,
      ground_y: +this.heightAt(x, z).toFixed(3),
      surface_y: this.waterSurfaceAt(x, z, phase) === null ? null : +this.waterSurfaceAt(x, z, phase).toFixed(3),
    };
  }
}

// ---- uniform-grid buckets --------------------------------------------------------------------
function buildBuckets(items, cell) {
  const map = new Map();
  const key = (cx, cz) => cx * 100000 + cz;
  for (const it of items) {
    const r = it.r;
    const x0 = Math.floor((it.x - r) / cell), x1 = Math.floor((it.x + r) / cell);
    const z0 = Math.floor((it.z - r) / cell), z1 = Math.floor((it.z + r) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
  }
  const EMPTY = [];
  return { at(x, z) { return map.get(key(Math.floor(x / cell), Math.floor(z / cell))) || EMPTY; } };
}
function buildSegBuckets(segs, cell) {
  const map = new Map();
  const key = (cx, cz) => cx * 100000 + cz;
  for (const s of segs) {
    const pad = s.hw * 3.2;
    const x0 = Math.floor((Math.min(s.ax, s.bx) - pad) / cell), x1 = Math.floor((Math.max(s.ax, s.bx) + pad) / cell);
    const z0 = Math.floor((Math.min(s.az, s.bz) - pad) / cell), z1 = Math.floor((Math.max(s.az, s.bz) + pad) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
  }
  const EMPTY = [];
  return { at(x, z) { return map.get(key(Math.floor(x / cell), Math.floor(z / cell))) || EMPTY; } };
}
