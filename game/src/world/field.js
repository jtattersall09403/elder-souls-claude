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
import { MicroField } from './microrelief.js';
import { SkinField } from './groundskin.js';

/**
 * How far below a deck the CARRIAGEWAY may be and still count as the road rather than as air, for
 * the purpose of `clampToDeck` letting a body off the side. See the long note in that function.
 *
 * The number is `traversal.json fall.safe_m` — **the drop that costs nothing**. It is written here
 * as a literal because `field.js` is constructed from terrain/regions/water and has never been
 * given the traversal config; if that changes this should read it. 4 m was not the first value
 * tried. At 1.0 m — chosen against `step_up_m` 0.55 and the 0.35 m airborne threshold — the body
 * was released at the 13 m viaduct on `stormhold-helstrom` (a 0.76 m kerb) and then pinned 700 m
 * earlier at the 22 m viaduct, whose slab overhangs its own approach by **3.12 m**. Both are the
 * same defect and only the second one is a drop worth arguing about, and the game's own answer to
 * "is a 3 m step down a fall" is no: `fall.safe_m` is 4.
 *
 * This is only safe because of the OTHER half of the round-2 fix. A slab may not stand over a
 * carriageway that belongs to a different stretch of road — `tools/world/build-roads.mjs`
 * `selfClearance()` enforces it and `tools/world/w1-crossing-r2-overpass.mjs` reports 0 offences
 * in 25,071 samples. Without that, a 4 m exemption would open the railing over a road below.
 */
const PARAPET_KERB_M = 4.0;

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
    this.dryGrid = buildBuckets(this.sites.filter((s) => s.kind !== 'landmark')
      .map((s) => ({ x: s.x, z: s.z, r: s.r_flat, ref: s })), 400);
    // The ordinary ground of each region, at the scale a walking player reads it. Evaluated
    // inside `heightAt`, so it is in the collision surface, the terrain mesh, the slope
    // histogram, the water census and every audit — the same one surface, with a per-region
    // shape in it. See game/src/world/microrelief.js for why this is here and not in a texture.
    this.micro = new MicroField(this.regions, (x, z) => this.regionU[this._cellIndex(x, z)]);
    // The OTHER half of the ground: the surface material lying on it, at 0.6-3.2 m. Deliberately
    // NOT in `heightAt` — `game/src/world/groundskin.js` gives the arithmetic (0.42 m of tussock
    // at 1.15 m spacing is a 51-degree local gradient against a 40-degree walkable gate, so in
    // the collision surface it would fence the province). It is exposed on the field so the
    // renderer, the region-axes descriptor and the CONSUMPTION probe all read one function.
    this.skin = new SkinField(this.regions, (x, z) => this.regionU[this._cellIndex(x, z)]);
    this.roads = null;
    this.roadGrid = null;
    this.sig = null;
    this.tidePhase = 0;                        // 0..1 through the 12-minute cycle
  }

  /**
   * Attach the thirteen ONLY-HERE elements (`RI-WLD04` M19). Seven of the thirteen are LANDFORM:
   * once attached, `heightAt` returns the crater floor, the comb tread, the petrified crown and
   * the root causeway, so the one surface the collision, the mesh, the slope histogram and every
   * audit read is the surface with the province's signature features in it. Detaching this is
   * exactly the RI-MTH07 perturbation: the ground goes flat and the frames change.
   */
  setSignatures(sig) {
    this.sig = sig || null;
    return sig;
  }

  /**
   * Attach the signposts (W1-05, `RI-WLD06` L2).
   *
   * Seam S35 permits a map but confines it to ground the player has already walked, so the map
   * is blank in the one direction the player needs it. The road signage is therefore what tells
   * a walker at a junction which way Gideon is, so a post is a WORLD OBJECT: it
   * is drawn by `world/province.js#_signposts` per streamed tile and read by
   * `Engine.signRead()` through the ordinary `interact` reach.
   *
   * Bucketed on the same 120 m grid the road segments use, because the only two questions ever
   * asked of this set are "draw the ones in this 300 m tile" and "is there one within 3 m of the
   * player", and a linear scan of 32 posts inside the fixed step is a linear scan of 32 posts
   * inside the fixed step.
   */
  setSignposts(doc) {
    this.signposts = doc || null;
    this.signs = (doc && doc.signposts) || [];
    this.signGrid = new Map();
    for (const s of this.signs) {
      const k = `${Math.floor(s.x / 120)},${Math.floor(s.z / 120)}`;
      if (!this.signGrid.has(k)) this.signGrid.set(k, []);
      this.signGrid.get(k).push(s);
    }
    return doc;
  }

  /** The nearest signpost to (x, z) within `r` metres, or null. Used by the `interact` reach. */
  nearestSign(x, z, r = 3.0) {
    if (!this.signs || !this.signs.length) return null;
    let best = null, bd = r;
    const cx = Math.floor(x / 120), cz = Math.floor(z / 120);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const bucket = this.signGrid.get(`${cx + i},${cz + j}`);
        if (!bucket) continue;
        for (const s of bucket) {
          const d = Math.hypot(s.x - x, s.z - z);
          if (d < bd) { bd = d; best = s; }
        }
      }
    }
    return best ? { sign: best, distance_m: +bd.toFixed(2) } : null;
  }

  /**
   * Attach the road network; roads carve a corridor into the ground (`RI-WLD01` §4).
   *
   * A DECK SPAN IS A STRUCTURE, NOT A BERM. Verdict W1-01 round 2: "the 21 declared `deck_spans` —
   * including 11 'viaducts' up to 16 m — are read nowhere in `game/src`. They are JSON labels on
   * an earth berm. Either build them as structures the player walks across, or delete the
   * declaration." They are built here. A segment inside a declared span produces a hard deck
   * surface within the carriageway half-width and **leaves the ground under it alone** — which is
   * where the 17.52 m of fill, the 2,537 shoulder points above 40 degrees and the dammed channel
   * all came from. Off the edge of the deck there is now air, and `sim/traversal.js` has a fall.
   */
  setRoads(roads) {
    this.roads = roads;
    const segs = [];
    for (const leg of roads.legs) {
      const p = leg.points;
      // A point is "on a span" if it lies inside one of the leg's declared span index ranges.
      const spanOf = new Array(p.length).fill(null);
      for (const sp of leg.deck_spans || []) {
        for (let i = sp.from_i; i <= sp.to_i && i < p.length; i++) spanOf[i] = sp;
      }
      for (let i = 0; i + 1 < p.length; i++) {
        const span = spanOf[i] && spanOf[i + 1] ? spanOf[i] : null;
        segs.push({
          ax: p[i][0], az: p[i][1], ay: p[i][2], bx: p[i + 1][0], bz: p[i + 1][1], by: p[i + 1][2],
          hw: leg.half_width_m, leg: leg.id,
          // Both endpoints on the span: the segment is deck. One endpoint: it is the abutment,
          // and the abutment is earth, so the deck is reachable from the road either side of it.
          span,
          // WHICH END OF THE STRUCTURE THIS IS. `clampToDeck` needs it to tell "walking off the
          // abutment", which is how you leave a bridge, from "walking off the side", which is how
          // you fall off one. Without it the parapet had to guess from a projection parameter and
          // it guessed wrong 286 times in 3,632 (W1-CROSSING, reports/w1-crossing/road-grade-*).
          spanFirst: !!span && !(spanOf[i - 1] && spanOf[i]),
          spanLast: !!span && !(spanOf[i + 1] && spanOf[i + 2]),
        });
      }
    }
    this.roadSegs = segs;
    this.roadGrid = buildSegBuckets(segs, 120);
    this.spans = [];
    for (const leg of roads.legs) for (const sp of leg.deck_spans || []) this.spans.push({ ...sp, leg: leg.id, half_width_m: leg.half_width_m });
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

  /**
   * W1-02 / `RI-WLD12`. Attach the border field. Everything above stays as it is — `regionAt` is
   * still the raster's answer and is still the right one for anything that needs A single region
   * for a point (which region am I in, which machine is running, what does the map say).
   */
  setBorders(borders) { this.borders = borders || null; return this; }

  /**
   * Which region owns ONE AXIS at this point.
   *
   * `regionAt` returns an object whose nine `RI-WLD04` axes all change at the same coordinate,
   * which is `RI-WLD12` M65's automatic fail — the texture swap. Inside a border band this
   * returns a DIFFERENT region per axis, staggered over the transition in §2's canonical order,
   * so the ground has already become the Stone Wastes while the buildings are still the Rootlands'.
   * Away from every border it is exactly `regionIndexAt`, at the cost of one byte read.
   *
   * @param {string} axis one of `world/borders.js` BORDER_AXES
   */
  axisRegionIndexAt(x, z, axis) {
    const fb = this.regionU[this._cellIndex(x, z)];
    return this.borders ? this.borders.axisRegionIndexAt(x, z, axis, fb) : fb;
  }
  axisRegionAt(x, z, axis) { return this.regions[this.axisRegionIndexAt(x, z, axis)]; }
  isLandAt(x, z) { const i = this._cellIndex(x, z); return ((this.landBits[i >> 3] >> (i & 7)) & 1) === 1; }
  isOceanAt(x, z) { return this.oceanU[this._cellIndex(x, z)] === 1; }
  coastDistAt(x, z) { return this._bilinear(this.coastI, x, z, 16); }
  substrateAt(x, z) {
    // RI-WLD10 §4's FIRM row is, verbatim: "rock, ROOT-WOOD ROADS, BOARDWALK, packed clay,
    // xanmeer limestone". A built carriageway is FIRM by that table's own words, whatever the mud
    // it was laid over. This matters for S17: with the substrate multiplier reading the raster
    // under the road, THE CROSSING realised a mean of 1.9032 m/s and 9.7% of samples below the
    // 1.6 m/s honesty floor — the hour would have been part friction. On the road it is 2.0000.
    if (this.onRoadAt(x, z)) return 'FIRM';
    const d = this.depthAt(x, z);
    const s = this.substrateNames[this.substrateU[this._cellIndex(x, z)]];
    return d > 0 && s === 'FIRM' ? 'SILT' : s;
  }

  /** The low-frequency landform, metres. */
  baseAt(x, z) { return this._bilinear(this.base, x, z, 0.1); }

  /**
   * The natural ground before sites, roads and signature landform: the baked landform, the shared
   * `detailAt` relief, and the region's own MICRO-RELIEF. All three of `heightAt`, `bareHeightAt`
   * and `naturalHeightAt` go through here so there is exactly one definition of the terrain and
   * no chance of the three drifting apart — which is how a bridge deck once ended up with a
   * petrified bole growing through it.
   */
  _terrain(x, z) {
    return this.baseAt(x, z)
      + detailAt(x, z,
        this._bilinear(this.reliefU, x, z, this.reliefUnit),
        this._bilinear(this.ridgeU, x, z, 1 / 255),
        this._bilinear(this.terrU, x, z, 1 / 255))
      + this.micro.at(x, z);
  }

  /** Ground height, metres above sea level. The one surface: collision, mesh and audit read it. */
  heightAt(x, z) {
    let h = this._terrain(x, z);
    h = this._applySites(x, z, h);
    // A BRIDGE DECK IS THE TOP OF THE WORLD AT THAT POINT. It is not blended with the hill and it
    // is not added to by the signature landform: a slab with a petrified bole growing through it
    // is a defect, and it stalled THE CROSSING at 545 m when a landform delta put the walkable
    // surface 3 m above the deck the parapet was clamping it to.
    const deck = this._deckY(x, z);
    if (deck !== null) return deck;
    h = this._applyRoads(x, z, h);
    // The ONLY-HERE landform goes on last. The builder keeps every instance clear of the road
    // corridor; this is that rule expressed as arithmetic rather than as a comment.
    if (this.sig) h += this.sig.groundDelta(x, z);
    return h;
  }

  /**
   * The highest declared deck surface covering (x, z), or null. Hot: called from `heightAt`.
   *
   * A BRIDGE DOES NOT HAVE A ROUND END. Clamping `t` to [0, 1] and then testing the distance makes
   * every segment a STADIUM, and at the first and last segment of a span chain the rounded cap
   * sticks `hw + 0.5` metres out past the abutment — a disc of slab hanging in the air in front of
   * the bridge, on which a body stands at deck height with nothing under it and no railing round
   * it. W1-CROSSING's parapet census found the leaks clustered exactly there. The cap is cut off
   * square at the terminal vertex; the abutment segment either side is EARTH and carries the road
   * on at the same elevation, so nothing is left standing on air and there is no step.
   *
   * The clamp is kept at every INTERIOR joint, and that is deliberate: a hard `t` bound at a bend
   * is skipped by both adjoining segments at once, which is the 0.03 m hole `clampToDeck`'s own
   * history records. Only the two ends of a chain are cut square, and only they can be.
   */
  _deckY(x, z) {
    if (!this.roadGrid) return null;
    const segs = this.roadGrid.at(x, z);
    let best = null;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const tr = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
      if ((s.spanFirst && tr < 0) || (s.spanLast && tr > 1)) continue;
      const t = clamp(tr, 0, 1);
      if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) > s.hw + 0.5) continue;
      const y = lerp(s.ay, s.by, t);
      if (best === null || y > best) best = y;
    }
    return best;
  }

  /** The ground WITHOUT the road: what is under a viaduct. Used for span clearance and for the
   *  cut/fill audit, which must measure the deck against the hill and not against itself. */
  bareHeightAt(x, z) {
    let h = this._terrain(x, z);
    h = this._applySites(x, z, h);
    if (this.sig) h += this.sig.groundDelta(x, z);
    return h;
  }

  /** The ground WITHOUT the signature landform — the natural province, for the audits that need
   *  to say how much of the shape is a feature and how much is the terrain under it. */
  naturalHeightAt(x, z) {
    let h = this._terrain(x, z);
    h = this._applySites(x, z, h);
    return this._applyRoads(x, z, h);
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
      // A span segment contributes NO earth. The slab is `_deckY` and the ground beneath keeps its
      // own height, so the channel still runs and the gorge is still a gorge.
      if (s.span) continue;
      const outer = s.hw * 3.2;
      if (d >= outer) continue;
      const w = smoothstep(outer, s.hw, d);
      // Where two segments cover a point with equal weight — the road doubling back on itself, or
      // two legs meeting — the higher deck wins. Taking whichever segment the bucket happened to
      // list first made the collision height depend on iteration order, and left the ground up to
      // 0.6 m BELOW the deck the road builder solved: enough to expose a latent water plane.
      const y = lerp(s.ay, s.by, t);
      if (w > bestW || (w === bestW && y > bestY)) { bestW = w; bestY = y; }
    }
    return bestW > 0 ? lerp(h, bestY, bestW) : h;
  }

  /**
   * A parapet. If the body was on a deck and the step would take it over the SIDE, put it back
   * against the parapet; if the step takes it off an END, let it go — that is the abutment, and
   * the road continues there. Returns [x, z] or null.
   *
   * The visible parapet is drawn by `province._spans`; this is the same 0.85 m wall in the
   * collision, so a viaduct behaves like a viaduct. Without it the walker drifts 3.5 m off the
   * centreline on a bend and steps into 30 m of air — which it did, at 1,318 m into THE CROSSING.
   */
  clampToDeck(px, pz, x, z) {
    if (!this.roadGrid) return null;
    // Both buckets. A body pressed against the parapet sits within 0.35 m of the deck edge, and
    // that point can fall in the NEIGHBOURING 120 m grid cell from the one the span segment was
    // registered in — at which point the lookup came back empty, the parapet vanished and the
    // walker leaked off the side of a 40 m viaduct after 1.75 s of pushing.
    const a = this.roadGrid.at(px, pz), b = this.roadGrid.at(x, z);
    const segs = a === b ? a : a.concat(b);
    // ---- WHY THIS IS A DISTANCE TEST AND NOT A PROJECTION-PARAMETER TEST ----------------------
    //
    // Round 3 found a parapet that leaked after a sustained push and could not say why; round 4
    // found a 0.15 m annulus between the parapet's `hw + 0.35` and `_deckY`'s `hw + 0.5` and closed
    // it. W1-CROSSING measured what was left with `tools/world/road-grade.mjs`: **286 of 3,632
    // sideways pushes still walked off a bridge deck**, and they were not spread over the decks —
    // they clustered at the ENDS of every span chain and on the earth approach within 3.5 m of one.
    //
    // The cause was that "off the end" was inferred from `t`, the projection parameter, on a
    // SINGLE segment. Near a chain's terminal vertex the body's `t` on the terminal segment falls
    // outside [0, 1] for a push that is purely sideways, so a body walking around the corner of
    // the end cap was read as a body walking off the abutment and let go — into 4.7 m of air with
    // no way back up. And a body standing on the earth in front of an abutment IS on the deck as
    // far as `heightAt`/`onDeckAt` are concerned (`_deckY` samples to `hw + 0.5` past the end
    // vertex), so it was standing on a slab with no railing at all.
    //
    // So the question is asked of the STRUCTURE, not of a segment, and it is asked as a distance:
    //   1. was the body on some span's walkable surface?          (nearest CLAMPED distance)
    //   2. is the destination still on one?                       (same measure, same limit)
    //   3. if not, is it beyond a chain END and still within the parapet's width ACROSS the chain?
    //      That is the abutment, and the road continues there.
    //   4. otherwise it is going over the side. Put it back against the railing.
    // Steps 2 and 4 use the same `lim`, so there is no width for an annulus to hide in.
    const near = (s, qx, qz) => {
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = ((qx - s.ax) * dx + (qz - s.az) * dz) / len2;
      const tc = clamp(t, 0, 1);
      const cx = s.ax + dx * tc, cz = s.az + dz * tc;
      return { t, cx, cz, d: Math.hypot(qx - cx, qz - cz) };
    };
    let onSeg = null, onD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const n = near(s, px, pz);
      if (n.d < onD) { onD = n.d; onSeg = s; }
    }
    if (!onSeg || onD > onSeg.hw + 0.5) return null;      // was not on a deck at all
    const lim = onSeg.hw + 0.35;
    let toSeg = null, toN = null, toD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const n = near(s, x, z);
      if (n.d < toD) { toD = n.d; toSeg = s; toN = n; }
    }
    if (toD <= lim || toD < 1e-6) return null;            // still on the structure
    // Off an END. The perpendicular distance from the terminal segment's INFINITE line is the
    // "across the chain" measure; inside the railing's width, walking past the last vertex is
    // walking onto the abutment, which is the way off a bridge.
    if ((toSeg.spanFirst && toN.t <= 0) || (toSeg.spanLast && toN.t >= 1)) {
      const dx = toSeg.bx - toSeg.ax, dz = toSeg.bz - toSeg.az;
      const L = Math.hypot(dx, dz) || 1;
      const across = Math.abs((x - toSeg.ax) * (-dz / L) + (z - toSeg.az) * (dx / L));
      if (across <= lim) return null;
    }
    // ---- THE PARAPET MAY NOT STAND BETWEEN A BODY AND ITS OWN ROAD ---------------------------
    //
    // W1-CROSSING round 2. `stormhold-helstrom` walks FORWARDS in 2,784.8 m and BACKWARDS walks
    // 3,393.7 m of the same 2,827.9 m leg and never arrives — pinned at (2298.8, 1842.7) with
    // `onRoad` true, `onDeck` true, the slope gate never firing, no water, no fall, no teleport.
    // The steering is innocent: `_pursue` transcribed and driven with no world under it walks this
    // leg in BOTH directions (`tools/world/w1-crossing-r2-pursue-sim.mjs`). What holds the body is
    // this function.
    //
    // The leg hairpins at point 120, and the 13 m viaduct on segment 120-121 begins AT the apex.
    // Near any corner the two limbs are within a slab's width of each other, so the deck's slab
    // lies over the earth approach — and a body walking the approach is "on the deck" as far as
    // the test above is concerned, at t = 0.37, which is neither end of the chain. Every step it
    // takes toward its own road reads as a step over the SIDE and is put back. There is no fix for
    // this in the road geometry: near a corner the limbs are ALWAYS close, whatever the turn.
    //
    // So the question the last test asks is wrong. "Off the side" is supposed to mean *into air*.
    // Measured one metre off the slab edge here, the carriageway continues at 80.07 against a
    // deck at 80.83 — a **0.76 m kerb**, with `onRoadAt` true. That is not a fall off a viaduct,
    // it is stepping down off a kerb onto the road, and the railing has no business there.
    //
    // The exemption is deliberately narrow and both halves are load-bearing:
    //   * `onRoadAt(x, z)` — the destination is CARRIAGEWAY. Off the side of the 471 m viaduct on
    //     the Valus Ridge there is no road at all, so this is false and the parapet holds.
    //   * the drop to the ROAD SURFACE WITHOUT THE DECK (`naturalHeightAt`: terrain, sites and the
    //     road corridor, no slab, no signature landform) is at most `PARAPET_KERB_M` — the game's
    //     own `fall.safe_m`, the drop that costs nothing. See that constant for why it is 4 and
    //     not 1, and for the second trap that found out.
    // Where a slab really is laid over a lower carriageway — the overpass this round removed from
    // `roads.json` — the drop is 6.99 m and this exemption does NOT fire, so the two fixes do not
    // cover for one another.
    if (this.onRoadAt(x, z)) {
      const dxo = onSeg.bx - onSeg.ax, dzo = onSeg.bz - onSeg.az;
      const to = clamp(((px - onSeg.ax) * dxo + (pz - onSeg.az) * dzo) / ((dxo * dxo + dzo * dzo) || 1), 0, 1);
      const deckY = lerp(onSeg.ay, onSeg.by, to);
      if (deckY - this.naturalHeightAt(x, z) <= PARAPET_KERB_M) return null;
    }
    return [toN.cx + (x - toN.cx) / toD * lim, toN.cz + (z - toN.cz) / toD * lim];
  }

  /**
   * Is (x, z) on the carriageway? A road is a BUILT surface with a declared gradient — every leg's
   * `max_grade` and its `grade_exceptions` are in `roads.json`, capped at 0.58 (30.1 deg), which is
   * deliberately below `traversal.json slope.max_walkable_deg` (40 deg). The max-walkable-slope
   * rule governs terrain; it must not adjudicate a road, because sampling the ground 5 m either
   * side of a 6 m carriageway on a 2.4 m embankment reads 40 deg+ ACROSS a surface that is flat
   * ALONG it, and the road becomes unwalkable.
   */
  onRoadAt(x, z) {
    if (!this.roadGrid) return false;
    const segs = this.roadGrid.at(x, z);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / len2, 0, 1);
      if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) <= s.hw * 1.15) return true;
    }
    return false;
  }

  /** Is (x, z) standing on a bridge deck rather than on the ground? */
  onDeckAt(x, z) {
    if (!this.roadGrid) return null;
    const segs = this.roadGrid.at(x, z);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const tr = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
      if ((s.spanFirst && tr < 0) || (s.spanLast && tr > 1)) continue;   // the square end cap, see _deckY
      const t = clamp(tr, 0, 1);
      const d = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
      if (d <= s.hw + 0.5) {
        const y = lerp(s.ay, s.by, t);
        return { leg: s.leg, kind: s.span.kind, deck_y: y, clearance_m: y - this.bareHeightAt(x, z), half_width_m: s.hw };
      }
    }
    return null;
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
    // A tidal region declares which sea it belongs to (RI-WLD10 §9) and that declaration wins:
    // the Eastern Rootlands are Padomaic even though they sit in the south-west quadrant of the
    // box. Open water outside any tidal region falls back to the geographic split.
    const r = this.regionU[this._cellIndex(x, z)];
    if (this.tidal[r] && this.seaOfRegion[r]) return this.seaOfRegion[r];
    return (x > 3250 || (x > 2750 && z < 2400)) ? 2 : 1;
  }

  /** Tide height in metres about the mean plane, for a sea, at the current phase. */
  tideHeight(sea, phase = this.tidePhase) {
    if (!sea) return 0;
    return (this.tideRange[sea] / 2) * Math.sin(2 * Math.PI * phase);
  }

  /**
   * RI-WLD10 §7 gives the surface as `h(t) = A/2 · sin(2π t / 720 s)`, so t = 0 is MID-RISING,
   * the peak is a quarter of the way through the cycle and the trough three quarters. Naming the
   * phases off the sine rather than off intuition matters: the first cut called phase 0 "LOW" and
   * phase 0.5 "HIGH", which are the two points where the tide height is exactly zero — the tideway
   * measured identical at both and looked like a tide that did not move.
   */
  tideState(phase = this.tidePhase) {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.125 || p >= 0.875) return 'RISING';
    if (p < 0.375) return 'HIGH';
    if (p < 0.625) return 'FALLING';
    return 'LOW';
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
    // A settlement pad is drained. RI-WLD01 M1 treats a settlement under standing water as a
    // defect, and Helstrom is built at the edge of a lake: the ground is levelled AND the water
    // is kept off it, which is what a town on a lakeshore actually is.
    const pads = this.dryGrid.at(x, z);
    for (let k = 0; k < pads.length; k++) {
      const s = pads[k].ref;
      if (Math.hypot(x - s.x, z - s.z) < s.r_flat) return null;
    }
    const g = this.heightAt(x, z);
    const table = this.baseAt(x, z) + this._bilinear(this.woffI, x, z, 0.01);
    const sea = this.seaAt(x, z);
    // Tide is a REGION property, not an "open water" shader.  In particular, water bodies in
    // the eight non-tidal regions must remain exactly still even when their cell is offshore of
    // the land mask (RI-WLD10 M54's automatic-fail population).
    const tidalHere = this.tidal[r] === 1;
    const coast = this.coastDistAt(x, z);
    const damp = tidalHere ? (coast <= 0 ? 1 : 1 - smoothstep(0, this.inlandDamping, coast)) : 0;
    const tide = this.tideHeight(sea, phase) * damp;
    // The tide moves the standing-water plane too, not only the open sea — otherwise a tidal delta
    // has a tide on its channels and none on its flats, and the Lilmoth-Archon tideway never
    // inverts. Amplitude outside a tidal region is exactly 0.00 m (RI-WLD10 §7, checked by M54).
    let surf = table + tide;

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
