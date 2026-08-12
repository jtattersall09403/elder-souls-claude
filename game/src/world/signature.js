// The thirteen ONLY-HERE elements, as geometry.
//
// WHY THIS FILE EXISTS. Verdict W1-01 round 2 §4: "not one ONLY-HERE element exists. Those 34
// welkynd pillars, 400 petrified boles, 14 rock flutes, 16 glassed craters and 12 beached hulls
// are integer literals in tools/world/build-regions.mjs lines 50-218. Nothing places an instance.
// RI-WLD04 M19 measures 0 of 13." And underneath that, the harder finding: strip colour and
// exposure from the region frames and leave-one-out separability falls 74.4% -> 30.8%, because
// thirteen regions were three primitives — canopy, under, rock — recoloured. Two thirds of the
// world's regional identity was tint.
//
// A colour cannot be walked up to. This module is the answer to that: every region owns one
// element that no other region has, it is placed at the count `regions.json` declares, and it is
// present in the ONE surface every consumer reads — `WorldField.heightAt()` — so it is in the
// collision, in the drawn mesh, in the silhouette, in the slope histogram and in the audits, all
// from a single definition. Seven of the thirteen are LANDFORM: they change the shape of the
// ground, which is what survives having the tint taken away. The other six are structures with a
// footprint you cannot walk through.
//
// It is deliberately THREE-free so `field.js` (node, tools, no renderer) and `province.js`
// (browser) share one definition of where the things are and how tall they stand. The meshes are
// `signature-geo.js`, and they are built from these same numbers.
'use strict';

/**
 * Per-kind shape. Every number here is read by three consumers — `groundDelta` (the collision and
 * mesh surface), `signature-geo.js` (what is drawn) and `tools/world/build-signatures.mjs` (where
 * they may stand) — so a kind cannot be tall in the renderer and flat underfoot.
 *
 *  landform  the instance deforms the ground: `groundDelta` is non-zero and the player walks on it
 *  solid_r   horizontal radius the player's capsule is pushed out of (0 = you can walk through it)
 *  glow      night emission; RI-WLD04 M17 step 6 requires the regions to be legible at night too
 *  wants     placement predicate the builder honours: dry | wet | shore | roadside | anywhere
 */
export const SIGNATURE_KINDS = {
  // Valus Ridge — "wind-holed limestone spires that hum a fixed chord audible from 400 m and
  // usable as a compass". A compass you can see from 400 m has to be on the skyline, so it is a
  // landform, not a prop: 14 to 26 m of rock with a hole through it.
  rock_flute_spire: {
    region: 'valus-ridge', landform: true, glow: 0,
    r_base: 7.0, h: [15, 26], solid_r: 3.2, wants: 'dry', min_sep: 90,
    silhouette: 'spire', note: 'holed limestone flute; the hole is a real hole in the mesh',
  },
  // The Stone Forest — "a forest half turned to stone". Four hundred of them: the region's
  // silhouette IS this. Broad snapped stumps with a flat walkable crown.
  petrified_bole: {
    region: 'stone-forest', landform: true, glow: 0,
    r_base: 3.4, h: [4.5, 9.5], solid_r: 0, wants: 'dry', min_sep: 26,
    silhouette: 'bole', note: 'petrified stump; the crown is flat and stood on',
  },
  // Stone Wastes — "crater-fields: perfectly circular pits of glassed salt". A pit is the one
  // landform no other region has, and it is unmistakable in a colour-stripped frame.
  glassed_crater: {
    region: 'stone-wastes', landform: true, glow: 0,
    r_base: 26.0, h: [5.0, 9.0], solid_r: 0, wants: 'dry', min_sep: 150,
    silhouette: 'crater', note: 'raised rim, glassed floor; the floor never goes below the water table',
  },
  // The Clay Moor — "buildings that were fired like pots, with the kiln still lit underneath".
  // The lit kiln is the region's night signal.
  naga_kiln_dome: {
    region: 'clay-moor', landform: true, glow: 1.0,
    r_base: 6.5, h: [5.0, 8.0], solid_r: 5.2, wants: 'dry', min_sep: 70,
    silhouette: 'dome', glow_hex: '#FF6A22', note: 'fired clay dome with a lit flue',
  },
  // The Hive — "no weather and no plants, whose floor is edible and load-bearing only sometimes".
  // Stepped wax terraces: the floor itself is the feature.
  comb_cliff: {
    region: 'hive', landform: true, glow: 0.55,
    r_base: 17.0, h: [7.0, 13.0], solid_r: 0, wants: 'dry', min_sep: 90,
    silhouette: 'comb', glow_hex: '#E8A63C', note: 'stepped comb terrace; four treads you climb',
  },
  // Marauder's Coast — "whole ships walked up the shore and inhabited hull-up, chimneys punched
  // through the keel". Long, oriented, solid: the only elongated silhouette in the province.
  beached_hull_house: {
    region: 'marauders-coast', landform: true, glow: 0.7,
    r_base: 11.0, h: [6.0, 8.5], solid_r: 4.2, wants: 'shore', min_sep: 110,
    silhouette: 'hull', glow_hex: '#FFB055', note: 'hull-up ship, keel to the sky, chimney through it',
  },
  // Western Rootlands — "the road IS a Hist root: you walk on living wood that flexes underfoot
  // and the arches are its branches". A raised causeway with an arch over it.
  root_arch: {
    region: 'western-rootlands', landform: true, glow: 0,
    r_base: 4.2, h: [1.4, 2.6], solid_r: 0, wants: 'anywhere', min_sep: 30,
    silhouette: 'arch', note: 'raised living-root causeway with a branch arching over it',
  },
  // Blackwood — "welkynd-lit Ayleid ruins swallowed by living wood: white stone with roots
  // through it, glowing blue in green dark". The night signal for the darkest region.
  welkynd_pillar: {
    region: 'blackwood', landform: false, glow: 1.0,
    r_base: 1.6, h: [6.0, 9.5], solid_r: 1.0, wants: 'anywhere', min_sep: 55,
    silhouette: 'pillar', glow_hex: '#5FC8FF', note: 'white Ayleid pillar, root-wrapped, welkynd-lit',
  },
  // Eastern Rootlands — "translucent bell-organisms drifting metres above the water, glowing at
  // night, throwing moving light down onto it". They float: no ground footprint at all.
  swamp_jelly_canopy: {
    region: 'eastern-rootlands', landform: false, glow: 1.0,
    r_base: 2.6, h: [3.5, 7.0], solid_r: 0, wants: 'wet', min_sep: 44,
    silhouette: 'bell', glow_hex: '#7CFFC8', note: 'drifting bell organism; hovers above the water',
  },
  // The Deep Marshes — "mud that moves toward you". The province's one KILL hazard, and the only
  // signature element that is also an actor.
  voriplasm: {
    region: 'deep-marshes', landform: false, glow: 0.5,
    r_base: 2.4, h: [1.0, 1.8], solid_r: 0, wants: 'wet', min_sep: 48,
    silhouette: 'plasm', glow_hex: '#9C6BE0', note: 'a mound of violet mud that moves toward you',
  },
  // Crimson Coast — "a coastline that is red because it is alive". The vats are where it is worked.
  open_dye_vat: {
    region: 'crimson-coast', landform: false, glow: 0.35,
    r_base: 3.2, h: [1.3, 1.9], solid_r: 2.4, wants: 'shore', min_sep: 55,
    silhouette: 'vat', glow_hex: '#C0223A', note: 'open stone dye vat, fuming',
  },
  // The Salt Hills — "Imperial road-milestones with distances carved in Cyrodilic, the only place
  // in Argonia where anyone measured anything". A milestone off a road is not a milestone.
  imperial_milestone: {
    region: 'salt-hills', landform: false, glow: 0,
    r_base: 0.8, h: [1.3, 1.7], solid_r: 0.55, wants: 'roadside', min_sep: 22,
    silhouette: 'milestone', note: 'cut stone post with a carved face, set beside the road',
  },
  // Thornmarsh — "an ash-dusted thorn labyrinth navigated by knife-marks cut into stems".
  knife_mark_stem: {
    region: 'thornmarsh', landform: false, glow: 0,
    r_base: 0.7, h: [3.0, 4.6], solid_r: 0.42, wants: 'anywhere', min_sep: 18,
    silhouette: 'stem', note: 'thorn stem blazed with pale knife-cuts at eye height',
  },
};

/** id -> kind, for the region whose ONLY-HERE element it is. */
export const KIND_OF_REGION = Object.fromEntries(
  Object.entries(SIGNATURE_KINDS).map(([k, v]) => [v.region, k]));

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

/**
 * The vertical profile of one landform instance at horizontal distance `d` (metres) from its
 * centre, in the instance's own frame. Returns metres to ADD to the natural ground.
 *
 * This is the single definition of the shape. `field.heightAt()` calls it so the player stands on
 * it; `signature-geo.js` evaluates the same function on a radial grid so the drawn mesh is the
 * surface that is collided with, which is the defect RI-MTH04 names when the two disagree.
 */
export function profile(kind, inst, dx, dz) {
  const K = SIGNATURE_KINDS[kind];
  if (!K || !K.landform) return 0;
  const R = K.r_base * (inst.s || 1);
  const H = inst.h;
  // Oriented kinds work in the instance's local frame.
  let ax = dx, az = dz;
  if (kind === 'beached_hull_house' || kind === 'root_arch') {
    const c = Math.cos(-inst.rot), s = Math.sin(-inst.rot);
    ax = dx * c - dz * s; az = dx * s + dz * c;
  }
  const d = Math.hypot(ax, az);
  switch (kind) {
    case 'rock_flute_spire': {
      if (d >= R) return 0;
      // A steep flute: a cone with a shoulder, so the base flares and the shaft is unclimbable
      // once `MAX_WALK_SLOPE_DEG` exists. The bore is a hole through the shaft, not through the
      // ground, so it is a mesh feature and not a hole in the collision surface.
      const t = 1 - d / R;
      return H * Math.pow(t, 2.4);
    }
    case 'petrified_bole': {
      const rTop = R * 0.46;
      if (d >= R) return 0;
      if (d <= rTop) return H;
      return H * smooth((R - d) / (R - rTop));
    }
    case 'glassed_crater': {
      // Rim at R, glassed floor at R*0.62. The floor is `inst.floor` — solved at build time so a
      // crater never digs below the local water table and quietly floods a dry region.
      // Spread the inner wall across most of the bowl.  The old 0.60R floor packed a 7--11 m
      // rise into roughly 10 m and made the shipped weather shelter a one-way trap: a player
      // could descend, but ordinary movement could not climb back to the road.  The broader
      // grade preserves the flat glass floor and raised circular rim while giving every crater
      // a continuous player-facing route in and out.
      const rimW = R * 0.16, rFloor = R * 0.20;
      if (d >= R + rimW) return 0;
      const rim = inst.rim === undefined ? 2.2 : inst.rim;
      if (d >= R) return rim * smooth((R + rimW - d) / rimW);
      if (d <= rFloor) return -H;
      const t = (d - rFloor) / (R - rFloor);            // 0 at floor edge, 1 at rim crest
      return -H + (H + rim) * smooth(t);
    }
    case 'naga_kiln_dome': {
      if (d >= R) return 0;
      // A fired pot: near-hemispherical, with a flat apron so the door sits on level ground.
      const t = 1 - d / R;
      return H * Math.sqrt(Math.max(0, 1 - Math.pow(1 - t, 2)));
    }
    case 'comb_cliff': {
      if (d >= R) return 0;
      // Four treads. Discrete steps are the point: a stepped silhouette is what a colour-stripped
      // edge-density descriptor sees, and a ramp is not.
      const t = 1 - d / R;
      const tread = Math.min(3, Math.floor(t * 4));
      const frac = t * 4 - tread;
      const riser = H / 4;
      return riser * tread + riser * smooth(clamp01((frac - 0.72) / 0.28));
    }
    case 'beached_hull_house': {
      // Hull-up: a half-ellipsoid, keel to the sky. Length 2R along local x, beam 0.46R.
      const L = R, B = R * 0.42;
      const u = ax / L, v = az / B;
      const q = u * u + v * v;
      if (q >= 1) return 0;
      return H * Math.sqrt(1 - q);
    }
    case 'root_arch': {
      // A causeway of living wood: a rounded ridge running along local x for 2R, falling to
      // nothing at each end so you can step onto it.
      const L = R * 2.6, B = R * 0.62;
      if (Math.abs(ax) >= L || Math.abs(az) >= B) return 0;
      const along = smooth(clamp01((L - Math.abs(ax)) / (L * 0.34)));
      const across = Math.sqrt(Math.max(0, 1 - Math.pow(az / B, 2)));
      return H * along * across;
    }
    default: return 0;
  }
}

/**
 * The placed instances, and every query the world asks of them.
 *
 * Built from `game/data/world/signatures.json`, which `tools/world/build-signatures.mjs` writes.
 * The positions are DATA, not a runtime scatter, for the reason RI-MTH07 gives: a model with no
 * demonstrated consumer scores zero, and a critic must be able to perturb the model and watch the
 * world change. Move a pillar in that file and the pillar moves, the collision moves, the M19
 * audit's count moves and the frame changes.
 */
export class SignatureField {
  constructor(doc) {
    this.doc = doc;
    this.items = doc.instances;
    this.byRegion = new Map();
    this.byKind = new Map();
    for (const it of this.items) {
      if (!this.byRegion.has(it.region)) this.byRegion.set(it.region, []);
      this.byRegion.get(it.region).push(it);
      if (!this.byKind.has(it.kind)) this.byKind.set(it.kind, []);
      this.byKind.get(it.kind).push(it);
    }
    // Uniform grid. The reach of an instance is its footprint radius, generously padded for the
    // oriented kinds whose long axis exceeds `r_base`.
    this.cell = 96;
    this.grid = new Map();
    this.landformGrid = new Map();
    for (const it of this.items) {
      const K = SIGNATURE_KINDS[it.kind];
      const reach = this.reachOf(it);
      const x0 = Math.floor((it.x - reach) / this.cell), x1 = Math.floor((it.x + reach) / this.cell);
      const z0 = Math.floor((it.z - reach) / this.cell), z1 = Math.floor((it.z + reach) / this.cell);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const k = cx * 100000 + cz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(it);
          if (K.landform) {
            if (!this.landformGrid.has(k)) this.landformGrid.set(k, []);
            this.landformGrid.get(k).push(it);
          }
        }
      }
    }
    this.EMPTY = [];
  }

  reachOf(it) {
    const K = SIGNATURE_KINDS[it.kind];
    const R = K.r_base * (it.s || 1);
    if (it.kind === 'root_arch') return R * 2.8;
    if (it.kind === 'beached_hull_house') return R * 1.1;
    if (it.kind === 'glassed_crater') return R * 1.2;
    return Math.max(R, K.solid_r) + 1;
  }

  _bucket(map, x, z) {
    return map.get(Math.floor(x / this.cell) * 100000 + Math.floor(z / this.cell)) || this.EMPTY;
  }

  /** Metres to add to the natural ground height at (x, z). Hot: called once per collision frame
   *  and once per terrain vertex, so it is a bucket lookup and a handful of profile evaluations. */
  groundDelta(x, z) {
    const b = this._bucket(this.landformGrid, x, z);
    if (b.length === 0) return 0;
    let up = 0, down = 0;
    for (let i = 0; i < b.length; i++) {
      const it = b[i];
      const v = profile(it.kind, it, x - it.x, z - it.z);
      if (v > up) up = v;
      if (v < down) down = v;             // a crater digs; the deepest dig wins
    }
    return up > 0 ? up : down;
  }

  /** Every instance whose footprint could touch (x, z). */
  at(x, z) { return this._bucket(this.grid, x, z); }

  /**
   * Push a capsule of radius `pr` out of any solid footprint. Returns null or [x, z].
   * A welkynd pillar you can walk through is a decal, not a pillar.
   */
  resolve(x, z, pr) {
    const b = this._bucket(this.grid, x, z);
    let ox = x, oz = z, hit = false;
    for (let i = 0; i < b.length; i++) {
      const it = b[i];
      const K = SIGNATURE_KINDS[it.kind];
      const sr = K.solid_r * (it.s || 1);
      if (sr <= 0) continue;
      if (it.kind === 'beached_hull_house') {
        // The hull is a long body: resolve against its keel segment rather than a disc.
        const c = Math.cos(it.rot), s = Math.sin(it.rot);
        const halfL = K.r_base * (it.s || 1) * 0.72;
        const ax = it.x - c * halfL, az = it.z - s * halfL;
        const bx = it.x + c * halfL, bz = it.z + s * halfL;
        const ddx = bx - ax, ddz = bz - az;
        const t = clamp01(((ox - ax) * ddx + (oz - az) * ddz) / (ddx * ddx + ddz * ddz || 1));
        const px = ax + ddx * t, pz = az + ddz * t;
        const d = Math.hypot(ox - px, oz - pz), want = sr + pr;
        if (d < want && d > 1e-6) { ox = px + (ox - px) / d * want; oz = pz + (oz - pz) / d * want; hit = true; }
        continue;
      }
      const d = Math.hypot(ox - it.x, oz - it.z), want = sr + pr;
      if (d < want && d > 1e-6) { ox = it.x + (ox - it.x) / d * want; oz = it.z + (oz - it.z) / d * want; hit = true; }
    }
    return hit ? [ox, oz] : null;
  }

  /**
   * Distance to the nearest instance of `kind`, or Infinity beyond `maxR`.
   *
   * Bucketed, because the hazard system asks this every frame for every hazard live in the region
   * and The Stone Forest declares four hundred petrified boles: a linear scan is 800 distance tests
   * per frame, which is 165 million over the 207,000 frames of THE CROSSING.
   */
  nearestOfKind(kind, x, z, maxR) {
    if (!this.kindGrid) {
      this.kindCell = 48;
      this.kindGrid = new Map();
      for (const it of this.items) {
        const k = `${it.kind}:${Math.floor(it.x / this.kindCell)}:${Math.floor(it.z / this.kindCell)}`;
        if (!this.kindGrid.has(k)) this.kindGrid.set(k, []);
        this.kindGrid.get(k).push(it);
      }
    }
    const c = this.kindCell;
    const rad = Math.ceil(maxR / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = Infinity;
    for (let ix = cx - rad; ix <= cx + rad; ix++) {
      for (let iz = cz - rad; iz <= cz + rad; iz++) {
        const b = this.kindGrid.get(`${kind}:${ix}:${iz}`);
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          const d = Math.hypot(b[i].x - x, b[i].z - z);
          if (d < best) best = d;
        }
      }
    }
    return best;
  }

  inRegion(id) { return this.byRegion.get(id) || this.EMPTY; }
  ofKind(k) { return this.byKind.get(k) || this.EMPTY; }

  /** RI-WLD04 M19's instrument, answered from the running world rather than from a table. */
  audit(field) {
    const out = [];
    for (const [kind, K] of Object.entries(SIGNATURE_KINDS)) {
      const inst = this.ofKind(kind);
      const inOwn = [], elsewhere = [];
      for (const it of inst) {
        const rid = field ? field.regions[field.regionIndexAt(it.x, it.z)].id : it.region;
        (rid === K.region ? inOwn : elsewhere).push(it);
      }
      out.push({
        kind, region: K.region, declared: inst.length,
        in_own_region: inOwn.length, in_other_regions: elsewhere.length,
        landform: !!K.landform, solid: K.solid_r > 0, glow: K.glow > 0,
        pass: inOwn.length >= 8 && elsewhere.length === 0,
      });
    }
    return out;
  }
}
