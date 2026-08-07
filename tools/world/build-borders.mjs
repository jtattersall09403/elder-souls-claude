#!/usr/bin/env node
// Build game/data/world/borders.json — the province's edges. W1-02.
//
// `RI-WLD12` is the specification and it is the sole judge of `world.region.transition`. Its
// automatic fail is the one this build had by construction before this file existed:
//
//     field.regionAt(x, z)  ->  this.regions[this.regionU[this._cellIndex(x, z)]]
//
// A single byte out of a 25 m raster, and all NINE of `RI-WLD04`'s axes are fields of the object
// it returns. So palette, flora, fauna, architecture, ambient bed, weather, hazard, danger tier
// and the ONLY-HERE element all flipped at exactly the same coordinate, in the same step, with
// nothing in the world marking it. `stddev(c) = 0` over the nine axes — RI-WLD12 M65's automatic
// fail, and the item's own §"How we lose" #1: "every axis flips at one coordinate because that is
// what a region lookup returns. It is the default behaviour of every region system ever written."
//
// This file computes, offline:
//   1. every walkable adjacency between the thirteen regions, from the shipped region raster;
//   2. a signed distance field across each border, so a runtime lookup knows HOW FAR through the
//      transition a point is rather than merely which side of a line it is on;
//   3. per-border, per-axis CROSSOVER OFFSETS in metres, in RI-WLD12 §2's canonical order —
//      ground and flora first, fauna and audio in between, architecture and the ONLY-HERE element
//      last, the danger tier at the narrowest point — with a per-border deterministic jitter so
//      no two borders stagger identically;
//   4. the border's KIND (HARD / GRADED / MARKED) from the landform actually present at it;
//   5. threshold objects from RI-WLD12 §1's eight-type vocabulary, each belonging to somebody;
//   6. the tier announcements RI-WLD12 §3 requires wherever |Δtier| >= 2.
//
// Everything it asserts, it asserts against what it built and exits non-zero on. It never writes
// a file it has not checked.
'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const terrain = R('game/data/world/terrain.json');
const regionsDoc = R('game/data/world/regions.json');
const roads = R('game/data/world/roads.json');
const regions = regionsDoc.regions;

const COLS = terrain.cols, ROWS = terrain.rows, CELL = terrain.cell_m;
const unb64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const regionU = unb64(terrain.channels.region, Uint8Array);
const baseDm = unb64(terrain.channels.base_dm, Int16Array);
const landBits = unb64(terrain.channels.land, Uint8Array);
const woffCm = unb64(terrain.channels.woff_cm, Int16Array);

const idx = (cx, cy) => cy * COLS + cx;
const isLand = (cx, cy) => (landBits[idx(cx, cy) >> 3] >> (idx(cx, cy) & 7)) & 1;
const cxOf = (x) => Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
const cyOf = (z) => Math.max(0, Math.min(ROWS - 1, Math.floor(z / CELL)));

/** Deterministic 32-bit mix — the same one `sim/environment.js` uses. No RNG anywhere in here. */
function hash2(a, b) {
  let h = (a | 0) * 0x27d4eb2d ^ (b | 0) * 0x165667b1;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// 1. ADJACENCY. Every 4-neighbour raster transition between two different regions where BOTH
//    cells are land — RI-WLD12 M64 enumerates "every adjacent region pair with a WALKABLE
//    connection", not every pair whose bounding boxes touch.
// ---------------------------------------------------------------------------------------------
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const pairs = new Map();
for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) {
    if (!isLand(cx, cy)) continue;
    const ra = regionU[idx(cx, cy)];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= COLS || ny >= ROWS) continue;
      if (!isLand(nx, ny)) continue;
      const rb = regionU[idx(nx, ny)];
      if (ra === rb) continue;
      const k = pairKey(ra, rb);
      let p = pairs.get(k);
      if (!p) { p = { a: Math.min(ra, rb), b: Math.max(ra, rb), edges: [], cells: new Set() }; pairs.set(k, p); }
      // The edge MIDPOINT in world metres — the geometric boundary, not either cell's centre.
      p.edges.push([(cx + 0.5 + dx * 0.5) * CELL, (cy + 0.5 + dy * 0.5) * CELL]);
      p.cells.add(idx(cx, cy)); p.cells.add(idx(nx, ny));
    }
  }
}

// A pair joined by a handful of raster cells is a corner artefact, not a border you can walk.
// 6 edges = 150 m of shared frontier at the raster's own resolution.
const MIN_EDGES = 6;
const dropped = [];
for (const [k, p] of [...pairs]) if (p.edges.length < MIN_EDGES) { dropped.push({ pair: k, edges: p.edges.length }); pairs.delete(k); }

const list = [...pairs.values()].sort((x, y) => (x.a - y.a) || (x.b - y.b));
list.forEach((p, i) => { p.index = i; p.id = `${regions[p.a].id}--${regions[p.b].id}`; });

// ---------------------------------------------------------------------------------------------
// 2. KIND. RI-WLD12 §1: HARD is a landform or built thing you cross in a step; GRADED is a real
//    blend zone; MARKED is a graded border carrying a threshold object because it would otherwise
//    be invisible. This is DERIVED from the terrain that is actually there, not declared — B2's
//    "no landform and no object" can only be checked against a measured landform.
// ---------------------------------------------------------------------------------------------
function landformAt(p) {
  // Sample the ground across each boundary edge, perpendicular to it, out to +/-3 cells.
  let maxDrop = 0, wetShare = 0, n = 0, maxSlope = 0;
  for (const [x, z] of p.edges) {
    const cx = cxOf(x), cy = cyOf(z);
    const hs = [], wet = [];
    for (let d = -3; d <= 3; d++) {
      const ax = Math.max(0, Math.min(COLS - 1, cx + d));
      const ay = Math.max(0, Math.min(ROWS - 1, cy + d));
      hs.push(baseDm[idx(ax, cy)] / 10, baseDm[idx(cx, ay)] / 10);
      wet.push(woffCm[idx(ax, cy)] > 0 ? 1 : 0, woffCm[idx(cx, ay)] > 0 ? 1 : 0);
    }
    const drop = Math.max(...hs) - Math.min(...hs);
    if (drop > maxDrop) maxDrop = drop;
    // Local gradient over the 150 m sampled span, as a rise over run.
    const slope = drop / (6 * CELL);
    if (slope > maxSlope) maxSlope = slope;
    wetShare += wet.reduce((a, b) => a + b, 0) / wet.length;
    n++;
  }
  return { max_drop_m: +maxDrop.toFixed(1), max_slope: +maxSlope.toFixed(3), wet_share: +(wetShare / Math.max(1, n)).toFixed(3) };
}

// A ridge, a scarp or a shore you cross in a step. 12 m of relief across 150 m, or water on more
// than half the frontier, is a thing you can see from 400 m — which is RI-WLD12 B1's own words.
const HARD_DROP_M = 12;
const HARD_WET = 0.5;

// ---------------------------------------------------------------------------------------------
// 3. THE THRESHOLD-OBJECT VOCABULARY. RI-WLD12 §1's table, verbatim, including who built each.
//    B4 requires >= 6 distinct types in use.
// ---------------------------------------------------------------------------------------------
const THRESHOLD = {
  imperial_border_cairn: { owner: 'the Empire, badly maintained', h: 1.9, marked: true },
  root_gate: { owner: 'Argonians; grown, not built', h: 4.2, marked: false },
  tide_pole: { owner: 'villagers', h: 3.1, marked: true },
  knife_marked_stem: { owner: 'the Thorn path-cutters', h: 2.6, marked: true },
  kiln_slag_heap: { owner: 'the naga', h: 1.4, marked: false },
  bone_line: { owner: "Marauder's Coast folk", h: 3.6, marked: false },
  salt_glass_marker: { owner: 'nobody; the crater-fields made them', h: 1.1, marked: false },
  corpse_in_a_cage: { owner: 'the Dres, and it is a warning', h: 2.8, marked: true },
};
/** Which people's marker stands on a border, in priority order. RI-WLD12 §1's "Where" column. */
function thresholdTypeFor(aId, bId) {
  const s = new Set([aId, bId]);
  if (s.has('deep-marshes')) return 'corpse_in_a_cage';
  if (s.has('thornmarsh')) return 'knife_marked_stem';
  if (s.has('clay-moor')) return 'kiln_slag_heap';
  if (s.has('stone-wastes')) return 'salt_glass_marker';
  if (s.has('marauders-coast')) return 'bone_line';
  if (s.has('salt-hills') || s.has('valus-ridge') || s.has('blackwood')) return 'imperial_border_cairn';
  if (s.has('western-rootlands') || s.has('eastern-rootlands')) return 'root_gate';
  return 'tide_pole';
}

// ---------------------------------------------------------------------------------------------
// 4. THE STAGGERED CROSSOVER. RI-WLD12 §2 and the item's whole weight-30 check.
//
// The canonical order is a DESIGN, in the item's own words: "ground and flora cross first (they
// are the terrain), architecture and the only-here element cross last (they are the statement),
// fauna and audio cross in between, and the danger tier crosses at the narrowest point — the
// pass, the ford, the gate — so that the moment the world becomes more dangerous is a place with
// a name."
//
// Offsets are FRACTIONS of the border's axis spread, signed: negative crosses early (still in A
// when the ground has already become B), positive crosses late.
// ---------------------------------------------------------------------------------------------
const AXES = ['palette', 'flora', 'weather', 'fauna', 'audio', 'hazard', 'tier', 'architecture', 'only_here'];
const CANONICAL = {
  palette: -0.46,       // the ground itself; RI-WLD12 §2 "ground and flora cross first"
  flora: -0.33,
  weather: -0.14,
  fauna: 0.03,          // "fauna and audio cross in between"
  audio: 0.15,
  hazard: 0.27,
  tier: 0.00,           // re-sited to the narrowest point below, per §2
  architecture: 0.36,   // "architecture and the only-here element cross last"
  only_here: 0.48,
};

/**
 * The narrowest point of a border — the pass, the ford, the gate. Taken as the along-frontier
 * position where the two regions' land is most pinched: the boundary edge whose perpendicular
 * land width is smallest. The danger tier crosses HERE, which is what gives the moment the world
 * becomes more dangerous a place rather than a coordinate.
 */
function narrowestPoint(p) {
  let best = null, bw = Infinity;
  for (const [x, z] of p.edges) {
    const cx = cxOf(x), cy = cyOf(z);
    let w = 0;
    for (let d = -6; d <= 6; d++) {
      const ax = Math.max(0, Math.min(COLS - 1, cx + d));
      if (isLand(ax, cy)) w++;
    }
    if (w < bw) { bw = w; best = [x, z]; }
  }
  return { at: best, land_cells_across: bw, width_m: bw * CELL };
}

// ---------------------------------------------------------------------------------------------
// 5. Build every border.
// ---------------------------------------------------------------------------------------------
const BAND_M = 260;                 // how far either side the signed distance field is computed
const out = [];
for (const p of list) {
  const A = regions[p.a], B = regions[p.b];
  const lf = landformAt(p);
  const hard = lf.max_drop_m >= HARD_DROP_M || lf.wet_share >= HARD_WET;
  const kind = hard ? 'HARD' : 'MARKED';   // every non-HARD border here CARRIES an object, so it
  // is MARKED by construction rather than GRADED — B2 forbids a border with neither a landform nor
  // an object, and a bare GRADED border is exactly that. RI-WLD12 §1 puts MARKED "wherever a
  // GRADED border would otherwise be invisible", which is every one of ours.
  const jitter = hash2(p.index, 0x51ed) * 0.10 - 0.05;
  const width_m = hard
    ? Math.round(8 + hash2(p.index, 3) * 12)                    // 8-20 m: the step you cross
    : Math.round(120 + hash2(p.index, 5) * 60);                 // 120-180 m: RI-WLD12 B3
  // HARD borders need stddev(c) >= 8 m over the nine axes while the VISIBLE transition is a step,
  // so the axis spread is deliberately wider than the blend width and is reported separately.
  // They are different things: the blend is where the materials interleave, the spread is where
  // the nine axes hand over.
  // The HARD spread was 46 m and twelve of the twenty-four borders then failed §2's third bar.
  // The cause is the item's own method: M65 samples every 2 m, so nine crossovers spread over
  // 46 m have a mean gap of 5 m that QUANTISES to 2 m or 4 m — inside the 3 m collision window —
  // however carefully the offsets are chosen. A declared minimum gap has to survive the sampling
  // grid, so it is now 5.5 m and the HARD spread is 64 m. The visible transition is still the
  // 8-20 m step `width_m` describes; the spread is where the nine axes hand over, which is a
  // different thing and is why the two are reported separately.
  const spread_m = hard ? 64 : Math.round(width_m * 0.94);
  const np = narrowestPoint(p);

  const offsets = {};
  for (const ax of AXES) {
    const j = (hash2(p.index * 31 + AXES.indexOf(ax), 0x9e37) - 0.5) * 0.09;
    offsets[ax] = +((CANONICAL[ax] + j + (ax === 'palette' || ax === 'only_here' ? 0 : jitter)) * spread_m).toFixed(2);
  }
  // The tier crosses at the narrowest point. In the 1-D transition model that is expressed as the
  // offset at which the frontier is most pinched; we take the signed distance of the narrowest
  // edge from the border's own centroid along the crossing direction, clamped into the spread.
  const cx = p.edges.reduce((s, e) => s + e[0], 0) / p.edges.length;
  const cz = p.edges.reduce((s, e) => s + e[1], 0) / p.edges.length;
  const tierShift = np.at ? Math.max(-0.30, Math.min(0.30, (Math.hypot(np.at[0] - cx, np.at[1] - cz) / Math.max(1, spread_m * 4)) - 0.15)) : 0;
  offsets.tier = +((CANONICAL.tier + tierShift) * spread_m).toFixed(2);

  // RI-WLD12 §2's third bar: "no two axes cross within 3 m of each other more than twice per
  // border". The jitter that makes every border stagger differently can land two axes on top of
  // each other, and two of the thirteen borders did on the first build. Rather than shrink the
  // jitter — which would make every border stagger the same way, which is the defect one layer up
  // — the offsets are SEPARATED: sort them, walk outward from the median, and hold a 3.2 m
  // minimum gap. This preserves the canonical ORDER, which is the part §2 cares about, and only
  // moves the metres.
  {
    const order = AXES.slice().sort((x, y) => offsets[x] - offsets[y]);
    const MIN_GAP = 5.5;   // survives M65's 2 m sampling grid; see the spread_m note above
    const mid = order.length >> 1;
    for (let i = mid + 1; i < order.length; i++) {
      const gap = offsets[order[i]] - offsets[order[i - 1]];
      if (gap < MIN_GAP) offsets[order[i]] = +(offsets[order[i - 1]] + MIN_GAP).toFixed(2);
    }
    for (let i = mid - 1; i >= 0; i--) {
      const gap = offsets[order[i + 1]] - offsets[order[i]];
      if (gap < MIN_GAP) offsets[order[i]] = +(offsets[order[i + 1]] - MIN_GAP).toFixed(2);
    }
  }

  const vals = AXES.map((a) => offsets[a]);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  const span = Math.max(...vals) - Math.min(...vals);
  // "no two axes cross within 3 m of each other more than twice per border"
  const sorted = [...vals].sort((x, y) => x - y);
  let tooClose = 0;
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] < 3) tooClose++;

  // ---- threshold objects -------------------------------------------------------------------
  const type = thresholdTypeFor(A.id, B.id);
  const spacingM = 260;
  const objs = [];
  let acc = Infinity;
  let prev = null;
  for (const [x, z] of p.edges) {
    acc += prev ? Math.hypot(x - prev[0], z - prev[1]) : 0;
    prev = [x, z];
    if (acc < spacingM) continue;
    acc = 0;
    objs.push({ type, x: +x.toFixed(1), z: +z.toFixed(1), y_ground_dm: baseDm[idx(cxOf(x), cyOf(z))] });
  }
  if (!objs.length && p.edges.length) {
    const [x, z] = p.edges[Math.floor(p.edges.length / 2)];
    objs.push({ type, x: +x.toFixed(1), z: +z.toFixed(1), y_ground_dm: baseDm[idx(cxOf(x), cyOf(z))] });
  }
  // B5: a border the trunk road crosses must be marked ON the road. Find every road point within
  // one cell of a boundary edge and plant a marker at the nearest one.
  const roadCrossings = [];
  for (const leg of roads.legs) {
    for (const pt of leg.points) {
      for (const [ex, ez] of p.edges) {
        if (Math.abs(pt[0] - ex) <= CELL && Math.abs(pt[2] - ez) <= CELL) {
          roadCrossings.push({ leg: leg.id, x: +pt[0].toFixed(1), z: +pt[2].toFixed(1) });
          break;
        }
      }
    }
  }
  // Collapse to one marker per leg per border.
  const seenLeg = new Set();
  for (const rc of roadCrossings) {
    if (seenLeg.has(rc.leg)) continue;
    seenLeg.add(rc.leg);
    objs.push({ type, x: rc.x, z: rc.z, on_road: rc.leg, y_ground_dm: baseDm[idx(cxOf(rc.x), cyOf(rc.z))] });
  }

  // ---- the announced tier jump (RI-WLD12 §3) -------------------------------------------------
  const dTier = B.danger_tier - A.danger_tier;
  let announcement = null;
  if (Math.abs(dTier) >= 2) {
    const hi = dTier > 0 ? B : A;
    const at = np.at || [cx, cz];
    announcement = {
      delta_tier: dTier, higher: hi.id,
      // Two channels, per T1. The object is one; REMAINS are the other, and they are placed on
      // the safe side so a player meets the warning before the tier changes, not after.
      channels: ['threshold_object', 'remains'],
      remains: {
        kind: hi.id === 'deep-marshes' ? 'a poler\'s barge, holed and dragged above the waterline'
          : hi.id === 'stone-wastes' ? 'a salt-cured pack-guar, still loaded'
            : hi.id === 'clay-moor' ? 'a kiln-slave\'s collar on a stake'
              : hi.id === 'valus-ridge' ? 'a cairn of legion tesserae with no bodies under it'
                : hi.id === 'crimson-coast' ? 'dye-stained wrappings and a picked ribcage'
                  : 'a cart, burnt, with the traces cut',
        x: +at[0].toFixed(1), z: +at[1].toFixed(1),
      },
      // T2: the first hostile encounter beyond the border must be >= 40 m from it. Declared here
      // as the exclusion the encounter system must honour; measured by the traverse, not asserted.
      first_hostile_min_m: 40,
      narrowest_point: np.at ? { x: +np.at[0].toFixed(1), z: +np.at[1].toFixed(1), width_m: np.width_m } : null,
    };
  }

  out.push({
    id: p.id, index: p.index,
    a: A.id, b: B.id, a_index: p.a, b_index: p.b,
    a_tier: A.danger_tier, b_tier: B.danger_tier, delta_tier: dTier,
    kind, width_m, axis_spread_m: spread_m,
    frontier_m: +(p.edges.length * CELL).toFixed(0),
    landform: lf,
    has_landform: hard,
    narrowest: np.at ? { x: +np.at[0].toFixed(1), z: +np.at[1].toFixed(1), width_m: np.width_m } : null,
    centroid: [+cx.toFixed(1), +cz.toFixed(1)],
    axis_offsets_m: offsets,
    crossover_stats: { stddev_m: +sd.toFixed(2), span_m: +span.toFixed(2), pairs_within_3m: tooClose },
    threshold_objects: objs,
    threshold_type: type,
    threshold_owner: THRESHOLD[type].owner,
    road_crossings: [...seenLeg],
    announcement,
  });
}

// ---------------------------------------------------------------------------------------------
// 6. THE SIGNED DISTANCE FIELD. Two rasters at the terrain's own 25 m resolution:
//      pair_u8   the border a cell belongs to, +1 (0 = no border within the band)
//      dist_i16  signed distance in DECIMETRES, negative in A, positive in B
//    This is what makes the runtime lookup a transition rather than a line: `borders.js` asks how
//    far through the border a point is and compares that against the axis's own offset.
// ---------------------------------------------------------------------------------------------
const pairU8 = new Uint8Array(COLS * ROWS);
const distI16 = new Int16Array(COLS * ROWS).fill(0);
const bandCells = Math.ceil(BAND_M / CELL);
for (const p of list) {
  // Grid-bucket this border's edges so the nearest-edge query is local rather than O(edges).
  const buckets = new Map();
  const BK = 4;   // bucket = 100 m
  for (const e of p.edges) {
    const k = `${Math.floor(e[0] / (CELL * BK))},${Math.floor(e[1] / (CELL * BK))}`;
    let arr = buckets.get(k); if (!arr) buckets.set(k, arr = []); arr.push(e);
  }
  const near = (x, z) => {
    const bx = Math.floor(x / (CELL * BK)), bz = Math.floor(z / (CELL * BK));
    let best = Infinity;
    const reach = Math.ceil(BAND_M / (CELL * BK)) + 1;
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const arr = buckets.get(`${bx + dx},${bz + dz}`);
      if (!arr) continue;
      for (const e of arr) { const d = Math.hypot(e[0] - x, e[1] - z); if (d < best) best = d; }
    }
    return best;
  };
  // Only walk cells within the band of this border's bounding box.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const e of p.edges) { minX = Math.min(minX, e[0]); maxX = Math.max(maxX, e[0]); minZ = Math.min(minZ, e[1]); maxZ = Math.max(maxZ, e[1]); }
  const x0 = Math.max(0, cxOf(minX) - bandCells), x1 = Math.min(COLS - 1, cxOf(maxX) + bandCells);
  const z0 = Math.max(0, cyOf(minZ) - bandCells), z1 = Math.min(ROWS - 1, cyOf(maxZ) + bandCells);
  for (let cy = z0; cy <= z1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const i = idx(cx, cy);
      const r = regionU[i];
      if (r !== p.a && r !== p.b) continue;          // a third region's cell is not this border's
      const d = near((cx + 0.5) * CELL, (cy + 0.5) * CELL);
      if (d > BAND_M) continue;
      const signed = (r === p.a ? -d : d);
      // Nearest border wins, so a cell in a three-region corner belongs to the one it is closest to.
      if (pairU8[i] !== 0 && Math.abs(distI16[i] / 10) <= d) continue;
      pairU8[i] = p.index + 1;
      distI16[i] = Math.round(signed * 10);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 7. ASSERT. RI-WLD12 B1-B5 and §2. The tool exits non-zero rather than shipping a file that
//    fails its own item — AGENT-PROTOCOL: "never stub it to pass".
// ---------------------------------------------------------------------------------------------
const errors = [], warnings = [];
const hardShare = out.filter((b) => b.kind === 'HARD').length / out.length;
if (hardShare < 0.40) warnings.push(`B1: HARD share ${(hardShare * 100).toFixed(1)}% < 40% — the province is gradients where it should have geography`);
const noneless = out.filter((b) => !b.has_landform && !b.threshold_objects.length);
if (noneless.length) errors.push(`B2: ${noneless.length} border(s) with neither a landform nor an object: ${noneless.map((b) => b.id)}`);
for (const b of out) {
  if (b.kind !== 'HARD' && (b.width_m < 120 || b.width_m > 180)) errors.push(`B3: ${b.id} graded width ${b.width_m} m outside 120-180`);
  const bar = b.kind === 'HARD' ? 8 : 25;
  if (b.crossover_stats.stddev_m < bar) errors.push(`§2: ${b.id} stddev ${b.crossover_stats.stddev_m} m < ${bar} m (${b.kind})`);
  if (b.crossover_stats.stddev_m < 5) errors.push(`§2 AUTOMATIC FAIL: ${b.id} stddev ${b.crossover_stats.stddev_m} m < 5 m — that is a texture swap`);
  if (b.kind !== 'HARD' && b.crossover_stats.span_m < 60) errors.push(`§2: ${b.id} span ${b.crossover_stats.span_m} m < 60 m`);
  if (b.crossover_stats.pairs_within_3m > 2) errors.push(`§2: ${b.id} has ${b.crossover_stats.pairs_within_3m} axis pairs within 3 m (max 2)`);
  if (Math.abs(b.delta_tier) >= 2 && !b.announcement) errors.push(`§3 T1: ${b.id} has |dtier| ${Math.abs(b.delta_tier)} and no announcement`);
}
const types = new Set(out.map((b) => b.threshold_type));
if (types.size < 6) errors.push(`B4: ${types.size} distinct threshold-object types in use, item requires >= 6`);
const roadBorne = out.filter((b) => b.road_crossings.length);
const roadUnmarked = roadBorne.filter((b) => !b.threshold_objects.some((o) => o.on_road));
if (roadUnmarked.length) errors.push(`B5: ${roadUnmarked.length} road-borne border(s) unmarked on the road`);
const descents = out.filter((b) => b.delta_tier !== 0).length;
if (descents < 3) errors.push(`§3 T5: only ${descents} border(s) change tier; a monotonic ramp is a corridor`);

const doc = {
  schema: 'elder-souls/borders@1',
  generator: 'tools/world/build-borders.mjs',
  owner: 'W1-02',
  source: 'corpus/50-world/RI-WLD12-region-borders.md',
  what_this_is:
    'The province\'s edges. Before this file, field.regionAt() was a bare read of one byte out of '
    + 'the 25 m region raster and all NINE of RI-WLD04\'s axes were fields of the object it '
    + 'returned, so every axis crossed at exactly the same coordinate: stddev(c) = 0, which is '
    + 'RI-WLD12 M65\'s automatic fail (the texture swap). This file carries, per border, the kind, '
    + 'the transition width, the threshold objects, the tier announcement, and the nine per-axis '
    + 'crossover offsets in metres; plus a signed distance field so a runtime lookup knows how far '
    + 'THROUGH a border a point is.',
  consumed_by: [
    'game/src/world/borders.js — BorderField.axisRegionAt(x, z, axis) and blendAt()',
    'game/src/world/province.js — the flora and palette axes choose the props and the ground colour',
    'game/src/sim/environment.js — the weather axis chooses which machine is running',
    'game/src/engine.js#getBorderCrossover — the read-back RI-WLD12 M65 measures',
  ],
  cell_m: CELL, cols: COLS, rows: ROWS, band_m: BAND_M,
  axes: AXES,
  canonical_order_note:
    'RI-WLD12 §2. Ground and flora cross first (they are the terrain); architecture and the '
    + 'ONLY-HERE element cross last (they are the statement); fauna and audio cross in between; '
    + 'the danger tier crosses at the narrowest point, so the moment the world becomes more '
    + 'dangerous is a place with a name.',
  threshold_vocabulary: THRESHOLD,
  counts: {
    borders: out.length,
    hard: out.filter((b) => b.kind === 'HARD').length,
    marked: out.filter((b) => b.kind === 'MARKED').length,
    hard_share: +hardShare.toFixed(3),
    threshold_objects: out.reduce((s, b) => s + b.threshold_objects.length, 0),
    threshold_types_in_use: types.size,
    announced_tier_jumps: out.filter((b) => b.announcement).length,
    tier_changing_borders: descents,
    road_borne: roadBorne.length,
    dropped_as_corner_artefacts: dropped.length,
  },
  dropped,
  borders: out,
  channels: {
    pair_u8: Buffer.from(pairU8.buffer, pairU8.byteOffset, pairU8.byteLength).toString('base64'),
    dist_dm_i16: Buffer.from(distI16.buffer, distI16.byteOffset, distI16.byteLength).toString('base64'),
  },
};

for (const w of warnings) console.error(`WARN  ${w}`);
if (errors.length) {
  console.error(`build-borders: ${errors.length} error(s) — nothing written`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
writeFileSync(resolve(ROOT, 'game/data/world/borders.json'), JSON.stringify(doc, null, 1) + '\n');
console.log(`borders.json: ${out.length} borders (${doc.counts.hard} HARD / ${doc.counts.marked} MARKED, `
  + `${(hardShare * 100).toFixed(0)}% hard), ${doc.counts.threshold_objects} threshold objects of `
  + `${types.size} types, ${doc.counts.announced_tier_jumps} announced tier jumps`);
const sds = out.map((b) => b.crossover_stats.stddev_m);
console.log(`  crossover stddev: min ${Math.min(...sds).toFixed(1)} m  median ${sds.slice().sort((a, b) => a - b)[sds.length >> 1].toFixed(1)} m  max ${Math.max(...sds).toFixed(1)} m`);
for (const b of out) {
  console.log(`  ${b.id.padEnd(38)} ${b.kind.padEnd(7)} w${String(b.width_m).padStart(3)}m sd${b.crossover_stats.stddev_m.toFixed(1).padStart(5)} span${b.crossover_stats.span_m.toFixed(0).padStart(4)} dT${String(b.delta_tier).padStart(2)} ${b.threshold_type}${b.announcement ? ' *announced*' : ''}`);
}
