// The province's edges at runtime. W1-02, `RI-WLD12`.
//
// THE DEFECT THIS REPLACES. `WorldField.regionAt(x, z)` is one byte out of a 25 m raster:
//
//     regionAt(x, z) { return this.regions[this.regionU[this._cellIndex(x, z)]]; }
//
// Every one of `RI-WLD04`'s nine axes — palette, flora, fauna, architecture, ambient bed, weather,
// hazard, danger tier, the ONLY-HERE element — is a FIELD of the object that returns. So all nine
// changed at the same coordinate, in the same step, with nothing in the world marking it:
// `stddev(c) = 0`, which `RI-WLD12` M65 names as its automatic fail and its §"How we lose" #1
// calls "the default behaviour of every region system ever written".
//
// WHAT THIS DOES INSTEAD. `game/data/world/borders.json` carries a signed distance field across
// every border, so a point does not merely have a side — it has a POSITION IN THE TRANSITION, in
// metres. Each of the nine axes then has its own crossover offset along that transition, in
// `RI-WLD12` §2's canonical order: ground and flora first (they are the terrain), architecture and
// the ONLY-HERE element last (they are the statement), fauna and audio in between, and the danger
// tier at the narrowest point — the pass, the ford, the gate — so the moment the world becomes
// more dangerous is a place with a name.
//
// A consumer therefore asks `axisRegionAt(x, z, 'flora')`, not `regionAt(x, z)`, and gets a
// different answer from `axisRegionAt(x, z, 'architecture')` for the eighty metres between them.
'use strict';

import { thresholdInstances } from './threshold.js';

/** The nine `RI-WLD04` axes, in the order `borders.json` stores their offsets. */
export const BORDER_AXES = ['palette', 'flora', 'weather', 'fauna', 'audio', 'hazard', 'tier', 'architecture', 'only_here'];

function unb64(s, T) {
  if (typeof Buffer !== 'undefined') {
    const b = Buffer.from(s, 'base64');
    return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new T(u8.buffer);
}

export class BorderField {
  /**
   * @param {object} doc      game/data/world/borders.json
   * @param {object} regions  regions.json's `regions` array, so an axis answer is a REGION
   */
  constructor(doc, regions) {
    if (!doc || !Array.isArray(doc.borders)) throw new Error('BorderField: borders.json missing or malformed');
    this.doc = doc;
    this.regions = regions;
    this.cols = doc.cols; this.rows = doc.rows; this.cell = doc.cell_m;
    this.pairU = unb64(doc.channels.pair_u8, Uint8Array);
    this.distI = unb64(doc.channels.dist_dm_i16, Int16Array);
    this.borders = doc.borders;
    this.byId = new Map(doc.borders.map((b) => [b.id, b]));
    // Flattened offsets, indexed [borderIndex * 9 + axisIndex], because this is read once per prop
    // per tile build and the object lookup showed up as the only allocation in the scatter loop.
    this.off = new Float32Array(doc.borders.length * BORDER_AXES.length);
    doc.borders.forEach((b, i) => {
      BORDER_AXES.forEach((a, j) => { this.off[i * BORDER_AXES.length + j] = b.axis_offsets_m[a]; });
    });
  }

  _cell(x, z) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(z / this.cell)));
    return cy * this.cols + cx;
  }

  // -- the markers ------------------------------------------------------------------------------
  //
  // `borders.json` places 210 threshold objects and 7 pieces of tier-jump remains and round 1 drew
  // none of them. These three methods are the whole of the runtime side: one flattened list, one
  // 60 m bucket grid for the tile builder and the collision, and a push-out so a cairn is a thing
  // and not a picture of a thing. The shapes are `threshold-geo.js`; the numbers `threshold.js`.

  /** Every drawable marker in the province, built once. */
  markers() {
    if (!this._markers) this._markers = thresholdInstances(this.doc);
    return this._markers;
  }

  _markerGrid() {
    if (this._mgrid) return this._mgrid;
    const g = new Map();
    this.MCELL = 60;
    for (const it of this.markers()) {
      // A marker is bucketed into every cell its footprint can touch, so a lookup is one bucket.
      const reach = Math.max(it.r, it.solid_r) + 1;
      const i0 = Math.floor((it.x - reach) / this.MCELL), i1 = Math.floor((it.x + reach) / this.MCELL);
      const j0 = Math.floor((it.z - reach) / this.MCELL), j1 = Math.floor((it.z + reach) / this.MCELL);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = i * 100003 + j;
          if (!g.has(k)) g.set(k, []);
          g.get(k).push(it);
        }
      }
    }
    this._mgrid = g;
    return g;
  }

  /** Markers whose CENTRE is inside the box, so one is drawn by exactly one tile. */
  markersIn(x0, z0, x1, z1) {
    const out = [];
    for (const it of this.markers()) {
      if (it.x < x0 || it.x >= x1 || it.z < z0 || it.z >= z1) continue;
      out.push(it);
    }
    return out;
  }

  /**
   * Push a capsule of radius `pr` out of any solid marker. Returns null or [x, z].
   *
   * A gibbet you walk through is a decal. This is also the difference between a threshold object
   * being a rendered decoration and being part of the world: `sim/traversal.js` calls it every
   * collision frame, so deleting the objects from `borders.json` changes where the player can
   * stand, which is the perturbation `RI-MTH07` asks for.
   */
  resolveMarker(x, z, pr) {
    const g = this._markerGrid();
    const b = g.get(Math.floor(x / this.MCELL) * 100003 + Math.floor(z / this.MCELL));
    if (!b) return null;
    let ox = x, oz = z, hit = false;
    for (let i = 0; i < b.length; i++) {
      const it = b[i];
      if (it.solid_r <= 0) continue;
      const d = Math.hypot(ox - it.x, oz - it.z), want = it.solid_r + pr;
      if (d < want && d > 1e-6) {
        ox = it.x + (ox - it.x) / d * want;
        oz = it.z + (oz - it.z) / d * want;
        hit = true;
      }
    }
    return hit ? [ox, oz] : null;
  }

  /**
   * The signed distance through the border, BILINEARLY INTERPOLATED, and this is load-bearing
   * rather than a smoothing nicety.
   *
   * The distance raster is stored at the terrain's own 25 m cell. Read nearest-neighbour, every
   * point inside one cell has the same distance — so nine axis crossovers spread 5.5 m apart all
   * land in the same cell and hand over at the same coordinate. Measured on the first build:
   * twenty-three of twenty-four borders had five or six axis pairs crossing within 3 m of each
   * other, against RI-WLD12 §2's limit of two, and the declared offsets were all correct. The
   * border was staggered in the data and a step function in the world, which is the same defect as
   * the texture swap wearing a wider coat. It also made the ground colour change in 25 m squares.
   *
   * Interpolating over the four surrounding cells that belong to THIS border (a neighbour in a
   * third region, or outside the band, contributes nothing and its weight is redistributed) makes
   * the distance continuous, so the axes hand over where they say they do.
   *
   * @returns {null|{pair:number, d:number}} pair is the 1-based border id as stored
   */
  _sample(x, z) {
    const fx = x / this.cell - 0.5, fz = z / this.cell - 0.5;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    // The pair is decided by the NEAREST cell — a point either is in a border band or is not, and
    // that is not a quantity to average.
    const ncx = Math.max(0, Math.min(this.cols - 1, Math.round(fx)));
    const ncz = Math.max(0, Math.min(this.rows - 1, Math.round(fz)));
    const pair = this.pairU[ncz * this.cols + ncx];
    if (!pair) return null;
    let acc = 0, w = 0;
    for (let j = 0; j <= 1; j++) {
      for (let i = 0; i <= 1; i++) {
        const cx = x0 + i, cz = z0 + j;
        if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) continue;
        const k = cz * this.cols + cx;
        if (this.pairU[k] !== pair) continue;
        const ww = (i ? tx : 1 - tx) * (j ? tz : 1 - tz);
        acc += this.distI[k] * ww; w += ww;
      }
    }
    if (w <= 1e-6) return { pair, d: this.distI[ncz * this.cols + ncx] / 10 };
    return { pair, d: acc / w / 10 };
  }

  /**
   * Where in a transition this point is.
   * @returns {null|{border, index, distance_m, a, b}} null when the point is not in any border band
   */
  at(x, z) {
    const s = this._sample(x, z);
    if (!s) return null;
    const b = this.borders[s.pair - 1];
    return { border: b, index: s.pair - 1, distance_m: +s.d.toFixed(2), a: b.a_index, b: b.b_index };
  }

  /**
   * Which region owns this axis at this point. The whole item in one function.
   *
   * `d` is the signed distance through the border, negative on the A side. The axis has handed
   * over when `d` passes that axis's own offset — so the palette can already be B's while the
   * architecture is still A's, which is what `RI-WLD12` §2 means by staggered.
   *
   * @param {number} x @param {number} z
   * @param {string} axis one of BORDER_AXES
   * @param {number} fallbackIndex the raster's own answer, used away from every border
   */
  axisRegionIndexAt(x, z, axis, fallbackIndex) {
    const s = this._sample(x, z);
    if (!s) return fallbackIndex;
    const j = BORDER_AXES.indexOf(axis);
    if (j < 0) return fallbackIndex;
    const b = this.borders[s.pair - 1];
    return s.d > this.off[(s.pair - 1) * BORDER_AXES.length + j] ? b.b_index : b.a_index;
  }

  /** The same answer as a region record. */
  axisRegionAt(x, z, axis, fallbackIndex) {
    return this.regions[this.axisRegionIndexAt(x, z, axis, fallbackIndex)];
  }

  /**
   * A 0..1 blend for the things that must NOT step — fog, colour grading, ambient light.
   * `RI-WLD12` C4: those interpolate over >= 80 m and are never centred on a crossover point,
   * "otherwise the grade IS the border and B2 is failed by a post-process". The ramp is therefore
   * deliberately offset from every axis: it is centred on `grade_centre_m`, which sits outside the
   * span of all nine axis offsets, and it is 96 m wide.
   *
   * @returns {{from:number,to:number,t:number}} region indices and the blend between them
   */
  gradeBlendAt(x, z, fallbackIndex) {
    const s = this._sample(x, z);
    if (!s) return { from: fallbackIndex, to: fallbackIndex, t: 0 };
    const b = this.borders[s.pair - 1];
    const d = s.d;
    const centre = this._gradeCentre(s.pair - 1);
    const half = 48;
    const t = Math.max(0, Math.min(1, (d - (centre - half)) / (half * 2)));
    return { from: b.a_index, to: b.b_index, t };
  }

  /**
   * The grade's centre, placed clear of every axis crossover. Taken as 14 m beyond the LAST axis
   * to hand over, so a player who has already seen the architecture change then watches the light
   * change — never both at once, which is the "fog border" failure RI-WLD12 §"How we lose" #2 and
   * seam S24 both name.
   */
  _gradeCentre(bi) {
    let max = -Infinity;
    for (let j = 0; j < BORDER_AXES.length; j++) max = Math.max(max, this.off[bi * BORDER_AXES.length + j]);
    return max + 14;
  }

  /**
   * The read-back `RI-WLD12` M65 measures: for one border, the nine crossover positions and their
   * statistics, computed from the LIVE field by walking the perpendicular — not read out of
   * `borders.json`. `RI-MTH07`: an axis table copied out of the file it was built from measures
   * the file.
   *
   * @param {string} id      border id, e.g. "blackwood--valus-ridge"
   * @param {function} regionIndexAt (x, z) => raster region index, i.e. `field.regionIndexAt`
   * @param {number} lengthM total traverse length, centred on the border
   * @param {number} stepM   sample spacing; RI-WLD12 M65 says every 2 m
   */
  traverse(id, regionIndexAt, lengthM = 400, stepM = 2) {
    const b = this.byId.get(id);
    if (!b) throw new Error(`traverse('${id}'): no such border. ${this.borders.length} are declared.`);
    // ---- choosing where to stand, and it took a rewrite to get right -------------------------
    //
    // The first version anchored the traverse at the border's NARROWEST point — §2's home for the
    // tier crossover and so, on the face of it, the most interesting place to stand. Run against
    // the live field it produced `stddev 0, span 0` on three of twenty-four borders: a perfect
    // texture swap, this item's automatic fail, from a build whose declared offsets were correct.
    //
    // The cause is worth recording because it will catch the next person. Outside the signed
    // distance band `axisRegionIndexAt` falls back to the raster — correctly, because outside a
    // border you are plainly in one region — so a traverse anchored where the band is THIN leaves
    // it before the early axes have handed over, and every axis then flips together at the raster
    // line. The narrowest point is, by definition, exactly where the band is thinnest. The
    // measurement was reporting the instrument's edge, not the world.
    //
    // So: anchor on the boundary cell with the most band either side of it, and take the direction
    // from the signed distance field's own gradient rather than a 16-way probe.
    let at = null, atScore = -Infinity, ux = 1, uz = 0;
    const cands = [];
    for (let i = 0; i < this.pairU.length; i++) {
      if (this.pairU[i] !== b.index + 1) continue;
      const d = this.distI[i] / 10;
      if (Math.abs(d) > this.cell) continue;               // on the boundary itself
      const cx = i % this.cols, cy = (i / this.cols) | 0;
      cands.push([cx, cy]);
    }
    for (const [cx, cy] of cands) {
      const x = (cx + 0.5) * this.cell, z = (cy + 0.5) * this.cell;
      const g = this._gradient(x, z, b.index);
      if (!g) continue;
      // How far the band reaches along the gradient, in each direction. That reach is the whole
      // measurable span, so it is exactly what to maximise.
      let fwd = 0, back = 0;
      for (let s = this.cell; s <= 240; s += this.cell) { if (this._signed(x + g[0] * s, z + g[1] * s, b.index) === null) break; fwd = s; }
      for (let s = this.cell; s <= 240; s += this.cell) { if (this._signed(x - g[0] * s, z - g[1] * s, b.index) === null) break; back = s; }
      // LINEARITY, and it is not a refinement — it is the difference between measuring the world
      // and measuring the walk. The traverse advances by ARC LENGTH while the axes hand over by
      // SIGNED DISTANCE, and on a curved or pinched frontier those come apart: a 400 m walk can
      // cover 40 m of distance, in which case all nine axes appear to cross at the same place and
      // the border reports itself as a texture swap it is not. One border did exactly that
      // (`crimson-coast--eastern-rootlands`, stddev 0.00 with correct declared offsets) and
      // another compressed three axis pairs inside 3 m. So the anchor is chosen where a metre
      // walked is close to a metre of distance.
      const reach = Math.min(fwd, back);
      if (reach < this.cell * 2) continue;
      const probe = Math.min(80, reach);
      const dp = this._signed(x + g[0] * probe, z + g[1] * probe, b.index);
      const dm = this._signed(x - g[0] * probe, z - g[1] * probe, b.index);
      if (dp === null || dm === null) continue;
      const linearity = Math.min(1, Math.abs(dp - dm) / (2 * probe));
      if (linearity < 0.55) continue;
      const score = reach * linearity;
      if (score > atScore) { atScore = score; at = { x, z }; ux = g[0]; uz = g[1]; }
    }
    if (!at) {
      at = b.narrowest || { x: b.centroid[0], z: b.centroid[1] };
      const g = this._gradient(at.x, at.z, b.index);
      if (g) { ux = g[0]; uz = g[1]; }
    }
    // Never sample beyond where the band reaches: past that the answer is the raster's, and
    // reporting it as a crossover is reporting the instrument.
    if (atScore > 0) lengthM = Math.min(lengthM, atScore * 2);
    // ---- walking the perpendicular, and why it FOLLOWS the gradient --------------------------
    //
    // RI-WLD12 M65 says "a line perpendicular to it". A straight line is perpendicular at the
    // point it was fitted and nowhere else, and on a frontier that curves the walk's ARC LENGTH
    // and the border's SIGNED DISTANCE come apart: a 400 m straight walk across a curving border
    // covered 254 m of transition on one border and compressed three axis pairs inside 3 m of each
    // other on the way. The axes were where they said they were; the ruler was bent.
    //
    // Re-evaluating the gradient at every step keeps the walk perpendicular for its whole length,
    // so `s_m` is the distance through the border and the crossovers are comparable across
    // borders of different shapes. It falls back to the last good direction where the gradient is
    // momentarily undefined, so a single bad cell cannot derail a traverse.
    const half = lengthM / 2;
    const walk = (sign) => {
      const rows = [];
      let x = at.x, z = at.z, dx = ux * sign, dz = uz * sign;
      for (let s = 0; s <= half; s += stepM) {
        const fb = regionIndexAt(x, z);
        const row = { s_m: +(s * sign).toFixed(1), x: +x.toFixed(1), z: +z.toFixed(1), raster: fb };
        for (const ax of BORDER_AXES) row[ax] = this.axisRegionIndexAt(x, z, ax, fb);
        rows.push(row);
        const g = this._gradient(x, z, b.index);
        if (g) {
          // Never reverse: a gradient that flips is noise at the band's edge, not the border
          // turning round.
          const cand = [g[0] * sign, g[1] * sign];
          if (cand[0] * dx + cand[1] * dz > 0.2) { dx = cand[0]; dz = cand[1]; }
        }
        x += dx * stepM; z += dz * stepM;
      }
      return rows;
    };
    const samples = walk(-1).reverse().concat(walk(1).slice(1));
    // c[a] = the position at which the axis is more B than A over a 20 m window (10 samples at 2 m).
    const W = Math.max(1, Math.round(20 / stepM));
    const cross = {};
    for (const ax of BORDER_AXES) {
      let c = null;
      for (let i = 0; i + W <= samples.length; i++) {
        let bCount = 0;
        for (let k = 0; k < W; k++) if (samples[i + k][ax] === b.b_index) bCount++;
        if (bCount > W / 2) { c = samples[i + Math.floor(W / 2)].s_m; break; }
      }
      cross[ax] = c;
    }
    const vals = BORDER_AXES.map((a) => cross[a]).filter((v) => v !== null);
    const mean = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length));
    const sorted = vals.slice().sort((p, q) => p - q);
    let within3 = 0;
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] < 3) within3++;
    return {
      border: id, kind: b.kind, a: b.a, b: b.b,
      delta_tier: b.delta_tier,
      direction: [+ux.toFixed(4), +uz.toFixed(4)],
      at: { x: at.x, z: at.z },
      samples: samples.length, step_m: stepM,
      crossovers_m: cross,
      axes_resolved: vals.length,
      stddev_m: +sd.toFixed(2),
      span_m: vals.length ? +(Math.max(...vals) - Math.min(...vals)).toFixed(2) : 0,
      pairs_within_3m: within3,
      declared: b.crossover_stats,
      order: BORDER_AXES.slice().filter((a) => cross[a] !== null).sort((p, q) => cross[p] - cross[q]),
    };
  }

  _signed(x, z, borderIndex) {
    const s = this._sample(x, z);
    if (!s || s.pair !== borderIndex + 1) return null;
    return s.d;
  }

  /**
   * The unit direction of steepest increase of the signed distance — i.e. the perpendicular to the
   * frontier, pointing from A into B. Central differences over one cell, falling back to one-sided
   * differences at the band's edge.
   */
  _gradient(x, z, borderIndex) {
    const h = this.cell;
    const c = this._signed(x, z, borderIndex);
    if (c === null) return null;
    const px = this._signed(x + h, z, borderIndex), mx = this._signed(x - h, z, borderIndex);
    const pz = this._signed(x, z + h, borderIndex), mz = this._signed(x, z - h, borderIndex);
    const gx = (px !== null && mx !== null) ? (px - mx) / (2 * h)
      : px !== null ? (px - c) / h : mx !== null ? (c - mx) / h : 0;
    const gz = (pz !== null && mz !== null) ? (pz - mz) / (2 * h)
      : pz !== null ? (pz - c) / h : mz !== null ? (c - mz) / h : 0;
    const n = Math.hypot(gx, gz);
    if (n < 1e-6) return null;
    return [gx / n, gz / n];
  }
}
