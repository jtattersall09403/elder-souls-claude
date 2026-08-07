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

  /**
   * Where in a transition this point is.
   * @returns {null|{border, index, distance_m, a, b}} null when the point is not in any border band
   */
  at(x, z) {
    const i = this._cell(x, z);
    const p = this.pairU[i];
    if (!p) return null;
    const b = this.borders[p - 1];
    return { border: b, index: p - 1, distance_m: this.distI[i] / 10, a: b.a_index, b: b.b_index };
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
    const i = this._cell(x, z);
    const p = this.pairU[i];
    if (!p) return fallbackIndex;
    const j = BORDER_AXES.indexOf(axis);
    if (j < 0) return fallbackIndex;
    const b = this.borders[p - 1];
    const d = this.distI[i] / 10;
    return d > this.off[(p - 1) * BORDER_AXES.length + j] ? b.b_index : b.a_index;
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
    const i = this._cell(x, z);
    const p = this.pairU[i];
    if (!p) return { from: fallbackIndex, to: fallbackIndex, t: 0 };
    const b = this.borders[p - 1];
    const d = this.distI[i] / 10;
    const centre = this._gradeCentre(p - 1);
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
    // Walk perpendicular to the frontier at the border's narrowest point, which is where §2 puts
    // the tier crossover and therefore the most interesting place to stand.
    const at = b.narrowest || { x: b.centroid[0], z: b.centroid[1] };
    // The perpendicular direction is the one along which the signed distance changes fastest.
    let bestDir = [1, 0], bestGrad = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      const d0 = this._signed(at.x - dx * 60, at.z - dz * 60, b.index);
      const d1 = this._signed(at.x + dx * 60, at.z + dz * 60, b.index);
      if (d0 === null || d1 === null) continue;
      const g = d1 - d0;
      if (g > bestGrad) { bestGrad = g; bestDir = [dx, dz]; }
    }
    const [ux, uz] = bestDir;
    const n = Math.floor(lengthM / stepM);
    const samples = [];
    for (let i = 0; i <= n; i++) {
      const s = -lengthM / 2 + i * stepM;
      const x = at.x + ux * s, z = at.z + uz * s;
      const fb = regionIndexAt(x, z);
      const row = { s_m: +s.toFixed(1), x: +x.toFixed(1), z: +z.toFixed(1), raster: fb };
      for (const ax of BORDER_AXES) row[ax] = this.axisRegionIndexAt(x, z, ax, fb);
      samples.push(row);
    }
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
    const i = this._cell(x, z);
    if (this.pairU[i] !== borderIndex + 1) return null;
    return this.distI[i] / 10;
  }
}
