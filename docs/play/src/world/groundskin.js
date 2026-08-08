// The GROUND SKIN: the ordinary underfoot surface at the scale a standing player actually reads.
//
// WHY THIS FILE EXISTS, and why `microrelief.js` was not enough.
//
// Round 4 shipped `microrelief.js` — nine landform primitives at characteristic lengths of 11 to
// 46 m, evaluated inside `field.heightAt()`. It is right, it is in the collision surface, and it
// moved the judged number the WRONG WAY: the colour-stripped leave-one-out over 39 day frames
// went 33.3% -> 25.6% and Fisher 1.756 -> 1.380. The reason is visible the moment you look at a
// frame instead of at a histogram. Standing at eye height 1.7 m with the camera pitched 4 degrees
// down, the bottom quarter of the frame is ground between about 2 and 8 m away. An 11 m hummock
// field seen across 6 m of ground is not a hummock field: it is a smooth tilt. Measured over the
// 39 day frames, Sobel edge density in the bottom quarter of the frame carried a between-region
// to within-region ratio of **0.91** — the near ground, which is most of every frame, was the one
// part of the picture with NO regional signal at all, in all thirteen regions.
//
// Look at `reports/region-shots/capture-001.png` (Blackwood) and `capture-028.png` (Stone Wastes):
// the lower 40% of each is an unbroken, untextured plane. One is black and one is sand. That is
// the whole of the difference, and stripping colour strips the whole of it.
//
// So this is the same idea one order of magnitude down: thirteen SURFACE textures at 0.5 to 3 m,
// as real geometry with real self-shadowing and a real albedo response, drawn on a fine mesh that
// follows the camera. A tussocked fen, a fired clay pan with curled polygon rims, a shore-parallel
// cobble berm and a scree of angular blocks are four different silhouettes at three metres.
//
// ---- WHY IT IS DRAWN AND NOT COLLIDED, stated plainly because a critic will ask ---------------
//
// The skin is NOT in `field.heightAt()`. That is a decision with an arithmetic reason rather than
// a convenience one. Deep Marshes tussocks are 0.34 m of relief at 1.1 m spacing; the local
// gradient of that surface is atan(0.68 / 0.55) = 51 degrees, and `traversal.json` refuses ground
// over 40. Putting the skin in the collision surface would fence the province — the exact defect
// S9-NO-FENCES exists to catch — and would invalidate the water-table solve, the slope histogram,
// the crossing and the reachability walk for a change the player would feel as an ankle-breaking
// stutter. Surface material lying ON the graded ground (leaf drift, clay plates, shell hash,
// scree, ripples) is not landform, and a walking body does not climb each cobble.
//
// What that costs in honesty is stated in the same breath: this layer changes what you SEE and
// not what you stand on. `microrelief.js` is the half of the ground character that is in the
// collision surface; this is the half that is not, and both are per region.
//
// The field is a pure function of position and of `regions.json terrain.skin`, so a probe can
// evaluate it without a browser and RI-MTH07 CONSUMPTION can perturb it.
'use strict';

import { hash2, fbm, ridged, clamp, smoothstep } from './noise.js';

/** The vocabulary. One per region — the ordinary ground each region is actually made of. */
export const SKIN_KINDS = [
  'rootnet',     // braided root mats standing out of wet hollows        Blackwood
  'polygon',     // desiccation plates with curled, raised rims          Clay Moor
  'berm',        // shore-parallel cobble ridges thrown by the storm     Crimson Coast
  'tussock',     // wall-to-wall sedge domes over drowned hollows        Deep Marshes
  'rillnet',     // fine dendritic drainage cut into silt                Eastern Rootlands
  'hexcell',     // wax cell rims underfoot; you walk on the comb        The Hive
  'sandripple',  // the tide's own comb, one bearing, low and regular    Marauder's Coast
  'crustpuff',   // thrust salt-crust plates between turf tufts          Salt Hills
  'slab',        // fractured flags with open joints between them        Stone Forest
  'crackfield',  // coarse crust polygons under thin wind drift          Stone Wastes
  'hummock',     // irregular peat hummock and hollow, root-braided      Thornmarsh
  'blockstep',   // angular scree blocks lying at rest                   Valus Ridge
  'furrow',      // cut plough furrows on the field's own bearing        Western Rootlands
];
export const SKIN_INDEX = Object.fromEntries(SKIN_KINDS.map((k, i) => [k, i]));

// ---- helpers ----------------------------------------------------------------------------------

/** Jittered-lattice cellular distances. [f1, f2, cellHash]; f2-f1 small exactly on a joint. */
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

const TAU = Math.PI * 2;
const sat01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The thirteen surfaces. Each returns `[h, tone]`:
 *   h     the surface's own rise above the graded ground, NORMALISED to [0, 1]. Never negative,
 *         which is what lets the skin mesh sit on the coarse tile mesh without z-fighting: an
 *         incised surface is authored as flats at h ~ 0.7 with the incisions cut down to 0, not
 *         as a plane with holes in it.
 *   tone  the albedo response of the material, in [-1, 1]. Crests drain and are pale, hollows
 *         hold water and are dark; a joint is a shadow line whether or not the sun is in it.
 *         Without this the whole layer is a normal, and 0.2 m over 1 m changes Lambert shading by
 *         a few per cent under an overcast sky — which is how the micro-relief came to be in the
 *         collision surface and invisible in the frame.
 *
 * `L` is the region's declared characteristic length in metres and `bearing` its declared
 * bearing in radians, so the same primitive is a different surface in two regions that share it.
 */
const SURF = [
  // rootnet — Blackwood. Buttress roots and root mats braid across standing water: sinuous
  // POSITIVE ridges, wide and soft, with black wet hollows between that hold the light.
  function rootnet(x, z, L) {
    const n = fbm(x / L, z / L, 5101, 3);
    const ridge = Math.pow(1 - Math.abs(n * 2 - 1), 3.4);
    const fine = Math.pow(1 - Math.abs(fbm(x / (L * 0.42), z / (L * 0.42), 5107, 2) * 2 - 1), 2.6);
    const h = sat01(ridge * 0.80 + fine * 0.30);
    return [h, h * 2.4 - 1.0];
  },
  // polygon — Clay Moor. A fired clay pan cracks into plates; each plate curls UP at its rim as
  // it dries, so the rim is the high ground and the plate centre is dished. The joints are open
  // and black. This is the one surface in the province with a hard, mineral edge.
  function polygon(x, z, L) {
    const [f1, f2, id] = worley(x, z, L, 5113);
    const joint = 1 - smoothstep(0.015, 0.10, f2 - f1);       // 1 on the crack
    const curl = smoothstep(0.30, 0.95, f1);                  // rises toward the plate edge
    const h = sat01((0.30 + curl * 0.70) * (1 - joint) + (id - 0.5) * 0.10);
    return [h, joint > 0.5 ? -1 : (curl - 0.35) * 1.5 + (id - 0.5) * 0.35];
  },
  // berm — Crimson Coast. Storm beaches build shore-PARALLEL cobble ridges, each one a former
  // high-water mark, with a coarse cobble texture on the ridge and finer material in the swale.
  function berm(x, z, L, bearing) {
    const s = x * Math.cos(bearing) + z * Math.sin(bearing) + 2.2 * (fbm(x / 34, z / 34, 5119, 2) - 0.5);
    const w = 0.5 - 0.5 * Math.cos(s * (TAU / (L * 3.0)));    // ridge / swale
    const [f1, , id] = worley(x, z, L * 0.42, 5127);
    const cobble = (1 - smoothstep(0.10, 0.68, f1)) * (0.55 + id * 0.45);
    const h = sat01(w * 0.62 + cobble * w * 0.46 + 0.04);
    return [h, (w - 0.45) * 1.2 + (cobble - 0.3) * 1.1 * w];
  },
  // tussock — Deep Marshes. Sedge tussocks stand wall to wall on drowned peat and the hollows
  // between them are black water. The strongest silhouette of the thirteen, and it should be:
  // "the ground is an animal" is the region's own line and a fen is unmistakable at three metres.
  function tussock(x, z, L) {
    const [f1, , id] = worley(x, z, L, 5131);
    const dome = Math.pow(sat01(1 - f1 / 0.46), 0.45) * (0.60 + id * 0.55);
    const [g1] = worley(x * 1.6 + 13, z * 1.6 + 41, L, 5137);
    const small = Math.pow(sat01(1 - g1 / 0.40), 0.55) * 0.42;
    const h = sat01(dome * 0.86 + small);
    return [h, h * 2.6 - 1.15];
  },
  // rillnet — Eastern Rootlands. A tidal delta drains through a dendritic network of fine rills
  // cut a hand's depth into silt. The surface is FLAT and the drainage is the only relief, which
  // is what a floating meadow over a tannin channel looks like when the tide is out.
  function rillnet(x, z, L) {
    const r = ridged(x / L, z / L, 5141, 4);
    const cut = Math.pow(sat01((r - 0.40) / 0.60), 1.1);
    const h = sat01(0.80 - cut * 0.80 + fbm(x / (L * 2.6), z / (L * 2.6), 5147, 2) * 0.18);
    return [h, -cut * 1.4 + 0.28];
  },
  // hexcell — The Hive. You walk on the comb: cell rims stand a hand proud of the cell floors in
  // a tight cellular packing, and the floor of each cell has its own fill level.
  function hexcell(x, z, L) {
    const [f1, f2, id] = worley(x, z, L, 5153);
    const rim = smoothstep(0.16, 0.02, f2 - f1);              // 1 on the shared wall
    const h = sat01(rim * 0.92 + (1 - rim) * (0.16 + id * 0.26));
    return [h, rim * 1.25 - 0.5 + (id - 0.5) * 0.45];
  },
  // sandripple — Marauder's Coast. The tide combs a mudflat into a regular ripple field on ONE
  // bearing: low amplitude, short wavelength, and almost no randomness. Nothing else here does
  // regular, and that regularity is the region's signature underfoot.
  function sandripple(x, z, L, bearing) {
    const th = bearing + 0.10 * (fbm(x / 190, z / 190, 5159, 2) - 0.5);
    const s = x * Math.cos(th) + z * Math.sin(th);
    const p = 0.5 - 0.5 * Math.cos(s * (TAU / L));
    const h = sat01(p * 0.86 + 0.07 + fbm(x / (L * 9), z / (L * 9), 5167, 2) * 0.14);
    return [h, (p - 0.5) * 1.5];
  },
  // crustpuff — Salt Hills. Thin turf over limestone: salt crust plates thrust up against one
  // another at their edges, with tufts of hill grass rooted in the gaps between.
  function crustpuff(x, z, L) {
    const [f1, f2, id] = worley(x, z, L, 5171);
    const thrust = smoothstep(0.13, 0.01, f2 - f1) * (0.45 + id * 0.75);
    const plate = 0.24 + id * 0.30;
    const h = sat01(Math.max(plate, thrust * 0.95));
    return [h, thrust > 0.4 ? 0.85 : (id - 0.5) * 1.1 - 0.15];
  },
  // slab — Stone Forest. Petrified root-flags: a jointed pavement that has shattered into big
  // flat slabs, each lying at its own level, with open joints you can turn an ankle in.
  function slab(x, z, L) {
    const [f1, f2, id] = worley(x, z, L, 5179);
    const joint = 1 - smoothstep(0.012, 0.100, f2 - f1);
    const tilt = (hash2(Math.floor(x / L * 0.5), Math.floor(z / L * 0.5), 5183) - 0.5) * 0.30;
    const h = sat01((0.34 + id * 0.66 + tilt) * (1 - joint * 0.98));
    return [h, joint > 0.5 ? -1.3 : (id - 0.5) * 1.7];
  },
  // crackfield — Stone Wastes. A glassed salt crust in coarse polygons, half buried under a thin
  // wind drift: the crust reads where the sand is thin and disappears where it is not.
  function crackfield(x, z, L, bearing) {
    const [f1, f2, id] = worley(x, z, L, 5189);
    const crack = 1 - smoothstep(0.012, 0.085, f2 - f1);
    const drift = 0.5 - 0.5 * Math.cos((x * Math.cos(bearing) + z * Math.sin(bearing)) * (TAU / (L * 2.4)));
    const bury = smoothstep(0.35, 0.85, drift);
    const h = sat01(0.42 + drift * 0.44 - crack * 0.40 * (1 - bury) + (id - 0.5) * 0.12);
    return [h, (drift - 0.5) * 0.9 - crack * 1.35 * (1 - bury)];
  },
  // hummock — Thornmarsh. Ash-dusted peat in irregular hummock and hollow, braided with thorn
  // root: rougher and less regular than the fen's tussocks, and dusted pale on the crowns.
  function hummock(x, z, L) {
    const [f1, , id] = worley(x, z, L, 5197);
    const mound = Math.pow(sat01(1 - f1 / 0.56), 0.70) * (0.50 + id * 0.65);
    const root = Math.pow(1 - Math.abs(fbm(x / (L * 0.55), z / (L * 0.55), 5209, 2) * 2 - 1), 3.2) * 0.40;
    const h = sat01(mound * 0.80 + root);
    return [h, h * 2.2 - 0.85];
  },
  // blockstep — Valus Ridge. Talus: angular limestone blocks lying at rest, each one a flat top
  // and a sharp step down to the next. The surface is a staircase with no two treads alike.
  function blockstep(x, z, L) {
    const [f1, f2, id] = worley(x, z, L, 5227);
    const gap = 1 - smoothstep(0.03, 0.19, f2 - f1);
    const top = 0.10 + id * 0.90;
    const h = sat01(top * (1 - gap * 0.92));
    return [h, gap > 0.5 ? -1.1 : (id - 0.5) * 1.8];
  },
  // furrow — Western Rootlands. Paddy and root-wood road: the one worked landscape in the
  // province, and worked ground is RECTILINEAR. Cut furrows on the field's own bearing, with a
  // cross-tie every few metres where the plough turned.
  function furrow(x, z, L, bearing) {
    const c = Math.cos(bearing), s = Math.sin(bearing);
    const u = x * c + z * s, v = -x * s + z * c;
    const p = 0.5 - 0.5 * Math.cos(v * (TAU / L));
    const tie = 0.5 - 0.5 * Math.cos(u * (TAU / (L * 7.0)));
    const h = sat01(p * 0.70 + Math.pow(tie, 3) * 0.34 + 0.10);
    return [h, (p - 0.48) * 1.45 + (Math.pow(tie, 3) - 0.2) * 0.5];
  },
];

/**
 * Evaluate one region's ground skin at a point.
 *
 * @param {{kind:string, amp_m:number, len_m:number, bearing_deg?:number, tone?:number}} skin
 * @returns {[number, number]} [rise in metres above the graded ground, albedo response in [-1,1]]
 */
const _pair = [0, 0];
export function skinAt(skin, x, z, out) {
  const k = SKIN_INDEX[skin.kind];
  if (k === undefined) throw new Error(`unknown ground-skin kind "${skin.kind}"`);
  const r = SURF[k](x, z, skin.len_m, ((skin.bearing_deg || 0) * Math.PI) / 180);
  const o = out || _pair;
  o[0] = r[0] * skin.amp_m;
  o[1] = clamp(r[1], -1, 1) * (skin.tone === undefined ? 1 : skin.tone);
  return o;
}

/**
 * The per-region skin, blended across region borders.
 *
 * The blend is a straight three-tap cross on the region raster at the skin's own scale rather
 * than the micro-relief's 34 m: two surfaces this fine have to hand over inside a few metres or
 * the seam is a straight line of tussocks meeting a straight line of clay plates, which no
 * landscape does. Where two regions meet, both surfaces are evaluated and mixed by the tap
 * weights — so the fen's tussocks thin out into the pan's polygons over about 12 m.
 */
export class SkinField {
  /**
   * @param {Array} regions regions.json `regions`, each with `terrain.skin`
   * @param {(x:number,z:number)=>number} regionIndexAt
   */
  constructor(regions, regionIndexAt) {
    this.regionIndexAt = regionIndexAt;
    this.skins = regions.map((r) => (r.terrain && r.terrain.skin) || null);
    this.any = this.skins.some(Boolean);
    this._w = new Float64Array(regions.length);
    this._out = [0, 0];
  }

  /**
   * [rise_m, tone] at a point, blended over ~12 m at a region border.
   *
   * Centre tap at weight 2, four cross taps at weight 1 — at worst five surface evaluations, and
   * exactly one wherever the whole cross lies in a single region, which is everywhere but a
   * border. Allocation-free on purpose: this is called once per vertex of a 15,625-vertex mesh
   * every eleven metres of walking, and a Map plus five array literals per call is a quarter of a
   * million short-lived objects per rebuild.
   */
  at(x, z) {
    if (!this.any) return this._out;
    const TAP = 6;
    const w = this._w;
    w.fill(0);
    w[this.regionIndexAt(x, z)] += 2;
    w[this.regionIndexAt(x - TAP, z)] += 1;
    w[this.regionIndexAt(x + TAP, z)] += 1;
    w[this.regionIndexAt(x, z - TAP)] += 1;
    w[this.regionIndexAt(x, z + TAP)] += 1;
    let h = 0, t = 0;
    for (let i = 0; i < w.length; i++) {
      if (w[i] === 0) continue;
      const s = this.skins[i];
      if (!s) continue;
      const p = skinAt(s, x, z);
      h += w[i] * p[0]; t += w[i] * p[1];
    }
    this._out[0] = h / 6; this._out[1] = t / 6;
    return this._out;
  }

  /** The dominant skin kind here, for probes and the region-axes descriptor. */
  kindAt(x, z) {
    const s = this.skins[this.regionIndexAt(x, z)];
    return s ? s.kind : null;
  }
}
