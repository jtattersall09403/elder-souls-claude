// Ground micro-relief: the shape of the ordinary ground at the scale a walking player reads it.
//
// WHY THIS FILE EXISTS. Verdict W1-01 round 2 named the gap as "thirteen regions are one place,
// painted thirteen colours", and proved it by stripping colour and exposure out of the region
// frames: separability fell from 74.4% to 30.8%. Round 3 placed all thirteen ONLY-HERE landmarks
// as real walkable geometry and the colour-stripped number did not move, and said why with the
// arithmetic — 840 instances over 14.31 km2 is 59 per km2, and a random frame does not contain
// one. *The typical frame is made of the ordinary ground.* Until round 4 the ordinary ground of
// all thirteen regions was one function, `noise.js detailAt`, parameterised by three scalars.
//
// So: nine micro-landform primitives, each a real thing a real landscape does, and each region
// declares a convex mixture of them and an amplitude. A tussocked fen and a salt pan now differ
// in silhouette at ten metres and not only in hue.
//
// TWO CONSTRAINTS DECIDED THE DESIGN, and both are measurements rather than taste:
//
//  1. NYQUIST. `province.js` draws the ground on a 300 m tile at TILE_SEG quads. Anything with a
//     wavelength shorter than about twice the quad size exists in the collision surface and is
//     invisible in the frame — which would be a change that moves an audit and not a picture.
//     Every characteristic length below is >= 11 m for that reason, and the sub-metre half of a
//     region's ground character is instanced ground COVER in `province._scatter`, not height.
//  2. THE SLOPE GATE. `sim/traversal.js` refuses ground over `traversal.json max_walkable_deg`.
//     Micro-relief that adds 30 degrees everywhere would fence the province. Amplitudes are
//     declared as a STANDARD DEVIATION in metres, each primitive is normalised to unit variance
//     by constants measured over the province (`tools/world/calibrate-micro.mjs`), and the
//     realised slope histogram is re-measured after every change.
//
// The field is a pure function of position and of `regions.json`, exactly like `noise.js`, so
// `tools/world/build-terrain.mjs` and the running game evaluate the identical surface — which is
// what lets the water-table solve remain valid after the ground grew a texture.
'use strict';

import { hash2, fbm, ridged, clamp, smoothstep } from './noise.js';

/** The vocabulary. Order is load-bearing: it indexes the per-region weight vectors. */
export const MICRO_KINDS = [
  'hummock',     // tussock mounds ~13 m across: fen, thicket, peat
  'crack',       // desiccation polygons ~26 m: fired clay pan, salt crust, stone pavement joints
  'ripple',      // directional runnel field ~17 m: tidal flat, drained delta
  'terracette',  // stepped benches ~20 m: hill turf, comb tread, wave-cut rock
  'rubble',      // angular broken blocks ~11 m: scree, talus, shattered pavement
  'rill',        // dendritic incision ~22 m: braided drainage, gullied delta
  'bund',        // rectilinear banks ~34 m: paddy bund, dyked field
  'rootmat',     // sinuous positive ridges ~17 m: buttress roots, root mat over water
  'dune',        // asymmetric wind waves ~46 m: salt pan, ash drift
];
export const MICRO_INDEX = Object.fromEntries(MICRO_KINDS.map((k, i) => [k, i]));

// ---- primitives -------------------------------------------------------------------------------

/**
 * Jittered-lattice cellular distance. Returns [f1, f2, cellHash]: distance to the nearest feature
 * point, distance to the second nearest, and a per-cell random in [0,1). f2 - f1 is small exactly
 * on the boundary between two cells, which is where a desiccation crack runs.
 */
function worley(x, z, L, seed) {
  const gx = Math.floor(x / L), gz = Math.floor(z / L);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx, cz = gz + dz;
      const px = (cx + hash2(cx, cz, seed)) * L;
      const pz = (cz + hash2(cx, cz, seed + 1)) * L;
      const ddx = (x - px) / L, ddz = (z - pz) / L;
      const d = Math.sqrt(ddx * ddx + ddz * ddz);
      if (d < f1) { f2 = f1; f1 = d; id = hash2(cx, cz, seed + 2); }
      else if (d < f2) { f2 = d; }
    }
  }
  return [f1, f2, id];
}

/** A narrow ridge centred on the edge of a unit cell: 1 on the bank, 0 in the field. */
function bank(t) {
  const d = Math.min(t, 1 - t);
  return Math.exp(-(d * d) / 0.0075);
}

/**
 * The nine primitives, unnormalised. Each is a pure function of world metres. They are turned
 * into zero-mean unit-variance fields by CAL below, so a region's declared amplitude means
 * "the standard deviation of this region's micro-relief, in metres" and nothing else.
 */
const RAW = [
  // hummock — a tussock field. Wall-to-wall mounds with wet hollows between them. Deep Marshes,
  // Thornmarsh peat, Blackwood root-water.
  function hummock(x, z) {
    const [f1] = worley(x, z, 13, 3301);
    const m = Math.max(0, 1 - f1 / 0.62);
    return m * m;
  },
  // crack — polygonal plates with grooves between them, each plate at its own level. This is a
  // fired clay pan, a salt crust and a petrified pavement: the same geometry at three scales of
  // hardness. `f2 - f1` is the cell boundary; the per-cell hash is the plate's own tilt.
  function crack(x, z) {
    const [f1, f2, id] = worley(x, z, 26, 3307);
    const groove = 1 - smoothstep(0.02, 0.20, f2 - f1);
    return (id - 0.5) * 0.55 - groove;
  },
  // ripple — a directional runnel field, the bearing drifting slowly across the province. What a
  // tidal flat looks like when the water has gone: parallel banks and drains, not random bumps.
  function ripple(x, z) {
    const th = fbm(x / 430, z / 430, 3313, 2) * Math.PI * 2;
    const s = x * Math.cos(th) + z * Math.sin(th);
    return Math.sin(s * (2 * Math.PI / 17)) + 0.45 * Math.sin(s * (2 * Math.PI / 41) + 1.1);
  },
  // terracette — stepped benches. A sawtooth in a smooth field: flat treads with sharp risers,
  // spaced by the field's own gradient, so the steps run ACROSS the slope the way sheep tracks,
  // wave-cut platforms and comb treads do, without any need to know which way is downhill.
  function terracette(x, z) {
    const u = 9 * fbm(x / 95, z / 95, 3319, 3);
    return (Math.round(u) - u) * 2;
  },
  // rubble — two overlapping fields of angular blocks, each block raised or dropped by its own
  // hash. Scree, talus, and pavement that has shattered.
  function rubble(x, z) {
    const [f1, , id] = worley(x, z, 11, 3323);
    const [g1, , id2] = worley(x * 0.61 + 91, z * 0.61 + 37, 11, 3329);
    return (id - 0.5) * 1.6 * (1 - smoothstep(0.15, 0.55, f1))
         + (id2 - 0.5) * 1.1 * (1 - smoothstep(0.20, 0.60, g1));
  },
  // rill — dendritic incision. The ridged multifractal's crests are narrow and branching, so
  // taking them NEGATIVE gives a drainage network cut into the surface rather than a mountain.
  function rill(x, z) {
    const r = ridged(x / 22, z / 22, 3331, 4);
    return -Math.pow(clamp((r - 0.42) / 0.58, 0, 1), 1.3);
  },
  // bund — a rectilinear grid of low banks on a slowly warped frame, each enclosed field held at
  // its own level. A paddy landscape is the one landform in the province that is rectangular,
  // and that is the whole point of it being here.
  function bund(x, z) {
    const wx = x + 26 * (fbm(x / 620, z / 620, 3337, 2) - 0.5);
    const wz = z + 26 * (fbm(x / 620, z / 620, 3341, 2) - 0.5);
    const cu = Math.floor(wx / 34), cv = Math.floor(wz / 34);
    return Math.max(bank(wx / 34 - cu), bank(wz / 34 - cv)) * 1.5 + (hash2(cu, cv, 3343) - 0.5) * 0.7;
  },
  // rootmat — sinuous positive ridges, the ground braided by buttress roots and root mats
  // standing above the water they grow out of.
  function rootmat(x, z) {
    const n = fbm(x / 17, z / 17, 3347, 3);
    return Math.pow(1 - Math.abs(n * 2 - 1), 2.2);
  },
  // dune — asymmetric wind waves: a long windward ramp and a short slip face, the bearing set by
  // the province's prevailing wind and wandering slowly. Salt pan and ash drift.
  function dune(x, z) {
    const th = 0.62 + 0.5 * (fbm(x / 900, z / 900, 3359, 2) - 0.5);
    const s = x * Math.cos(th) + z * Math.sin(th) + 22 * (fbm(x / 210, z / 210, 3361, 2) - 0.5);
    const p = s / 46 - Math.floor(s / 46);
    return p < 0.74 ? p / 0.74 : (1 - p) / 0.26;
  },
];

/**
 * Mean and standard deviation of each primitive, MEASURED over 240,000 points spread across the
 * province box by `tools/world/calibrate-micro.mjs`, so `(raw - mean) / sd` is a zero-mean
 * unit-variance field and a region's `amp_m` is a standard deviation in metres.
 *
 * These are constants and not a runtime normalisation on purpose: `heightAt` is on the collision
 * path and is called millions of times per audit, and a field whose normalisation depended on
 * where it was sampled would not be the same surface in the builder and in the game.
 */
const CAL = [
  { mean: 0.179940, sd: 0.209990 },   // hummock
  { mean: -0.258100, sd: 0.406721 },  // crack
  { mean: 0.000473, sd: 0.775239 },   // ripple
  { mean: -0.001084, sd: 0.578285 },  // terracette
  { mean: -0.000805, sd: 0.309574 },  // rubble
  { mean: -0.127538, sd: 0.171963 },  // rill
  { mean: 0.413984, sd: 0.567751 },   // bund
  { mean: 0.595455, sd: 0.241678 },   // rootmat
  { mean: 0.499944, sd: 0.288860 },   // dune
];

/** One primitive, normalised. Exported for the calibration tool and for probes. */
export function microPrimitive(k, x, z, normalised = true) {
  const v = RAW[k](x, z);
  return normalised ? (v - CAL[k].mean) / CAL[k].sd : v;
}

/**
 * The per-region mixture, blended across region borders.
 *
 * The blend is nine taps of the region raster on a 34 m cross, weighted 1-2-1 in each axis, which
 * gives a ~70 m transition between two regions' ground character. That matters: a hard border
 * would put a fen's tussocks against a salt pan's polygons along a visible straight line, and the
 * province's region borders are deliberately staggered rather than fenced.
 *
 * The taps read only the region raster — an integer index — so the cost is nine array lookups and
 * a handful of multiply-accumulates over the two or three primitives a region actually declares.
 * No extra baked channel: the weights come straight from `regions.json`, which is what makes
 * perturbing `regions.json` change the ground (RI-MTH07 CONSUMPTION).
 */
const TAPS = [-34, 0, 34];
const TAPW = [0.25, 0.5, 0.25];

export class MicroField {
  /**
   * @param {Array} regions regions.json `regions`, each with `terrain.micro = {amp_m, weights}`
   * @param {(x:number,z:number)=>number} regionIndexAt the region raster sampler
   */
  constructor(regions, regionIndexAt) {
    this.regionIndexAt = regionIndexAt;
    // Per region: a compact list of [primitiveIndex, amp_m * weight] pairs, skipping zeros.
    this.mix = regions.map((r) => {
      const m = (r.terrain && r.terrain.micro) || null;
      if (!m || !m.amp_m) return [];
      const out = [];
      for (const [name, w] of Object.entries(m.weights || {})) {
        const k = MICRO_INDEX[name];
        if (k === undefined) throw new Error(`unknown micro-relief kind "${name}" in region ${r.id}`);
        if (w > 0) out.push([k, m.amp_m * w]);
      }
      return out;
    });
    this.any = this.mix.some((m) => m.length > 0);
    this._acc = new Float64Array(MICRO_KINDS.length);
  }

  /** The blended amplitude of each primitive at a point, metres of standard deviation. */
  weightsAt(x, z) {
    const a = this._acc;
    a.fill(0);
    for (let iz = 0; iz < 3; iz++) {
      for (let ix = 0; ix < 3; ix++) {
        const w = TAPW[ix] * TAPW[iz];
        const mix = this.mix[this.regionIndexAt(x + TAPS[ix], z + TAPS[iz])];
        for (let i = 0; i < mix.length; i++) a[mix[i][0]] += w * mix[i][1];
      }
    }
    return a;
  }

  /** Ground micro-relief at a point, in metres. Zero where no region declares any. */
  at(x, z) {
    if (!this.any) return 0;
    const a = this.weightsAt(x, z);
    let h = 0;
    for (let k = 0; k < a.length; k++) {
      if (a[k] < 0.004) continue;                       // skip a primitive nobody nearby declares
      h += a[k] * (RAW[k](x, z) - CAL[k].mean) / CAL[k].sd;
    }
    return h;
  }

  /** Which primitive dominates here, for probes and for the region-axes descriptor. */
  dominantAt(x, z) {
    const a = this.weightsAt(x, z);
    let best = -1, bv = 0;
    for (let k = 0; k < a.length; k++) if (a[k] > bv) { bv = a[k]; best = k; }
    return best < 0 ? null : { kind: MICRO_KINDS[best], amp_m: +bv.toFixed(4) };
  }
}
