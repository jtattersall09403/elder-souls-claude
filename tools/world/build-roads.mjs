#!/usr/bin/env node
/**
 * build-roads.mjs — the Rootway.
 *
 * Ten trunk legs, `RI-WLD01` §4 verbatim: the same endpoints, the same class, and — the number the
 * traversal budget is made of — the same PATH LENGTH. A leg is routed by A* over the built terrain
 * so it goes round the Valus Ridge and crosses a channel at its narrows instead of ignoring both,
 * then its length is driven onto the tabled `path_m` exactly: a route that came out short is given
 * lateral sinuosity, one that came out long is straightened toward its chord. Both are bisections
 * on one scalar, so the result is the table's number and not an approximation of it.
 *
 * Every leg also collects the minor settlements `RI-WLD01` §6 puts on it, in order, as waypoints —
 * which is why M5's "no gap over 9 walking minutes without habitation" is a property of the route
 * rather than a hope.
 *
 * Usage: node tools/world/build-roads.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { clamp, lerp } from '../../game/src/world/noise.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const scale = rd('corpus/50-world/world-scale.json');
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
const COLS = field.cols, ROWS = field.rows, CELL = field.cell;

// ---- traversal cost -----------------------------------------------------------------------------
const TIDE_PEAK = 0.25;        // h = A/2 sin(2 pi phase); phase 0.25 is the maximum of every surface
const cost = new Float32Array(COLS * ROWS);
const terrainCost = new Float32Array(COLS * ROWS);
const waterCost = new Float32Array(COLS * ROWS);
const groundG = new Float32Array(COLS * ROWS);
const depthG = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x, px = x * CELL + CELL / 2, pz = z * CELL + CELL / 2;
  const g = field.heightAt(px, pz);
  groundG[i] = g;
  depthG[i] = field.depthAt(px, pz, TIDE_PEAK);
}
// Depth is sampled at the tide phase where every water surface is at its maximum (HIGH, phase 0.25).
// A route costed at LOW is a route that floods twice a day.
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const hx = (groundG[i + (x < COLS - 1 ? 1 : 0)] - groundG[i - (x > 0 ? 1 : 0)]) / (2 * CELL);
  const hz = (groundG[i + (z < ROWS - 1 ? COLS : 0)] - groundG[i - (z > 0 ? COLS : 0)]) / (2 * CELL);
  const slope = Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI;
  // Roughness: the height range of the 3x3 neighbourhood. Slope from central differences cannot
  // see a 50 m notch between two cells, and a notch is exactly what a road cannot follow — it is
  // where the deck solve is forced to choose between a cutting and a viaduct.
  let lo = Infinity, hi = -Infinity;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
    const v = groundG[nz * COLS + nx];
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const rough = hi - lo;
  const d = depthG[i];
  // Water is costed by DEPTH and without the old min(d,3) ceiling: an 18 m tarn and a 0.3 m puddle
  // used to cost the same 13.5, which is why the trunk was happy to lie in a lake. A crossing is
  // still possible — it is priced, at roughly 12 cost-metres per metre of depth — so A* crosses at
  // the narrows and at the shallows instead of along the bed.
  waterCost[i] = d > 0 ? 8 + 12 * d : 0;
  terrainCost[i] = 0.40 * slope + 0.25 * rough + waterCost[i] + (field.isOceanAt(x * CELL, z * CELL) ? 400 : 0);
  cost[i] = 1 + terrainCost[i];
}

/** Binary min-heap on (priority, cell). The bisection below runs A* a few hundred times. */
function makeHeap() {
  const p = [], v = [];
  return {
    get size() { return v.length; },
    push(pri, val) {
      p.push(pri); v.push(val);
      let i = v.length - 1;
      while (i > 0) { const q = (i - 1) >> 1; if (p[q] <= p[i]) break; [p[q], p[i]] = [p[i], p[q]]; [v[q], v[i]] = [v[i], v[q]]; i = q; }
    },
    pop() {
      const top = v[0];
      const lp = p.pop(), lv = v.pop();
      if (v.length) {
        p[0] = lp; v[0] = lv;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < v.length && p[l] < p[m]) m = l;
          if (r < v.length && p[r] < p[m]) m = r;
          if (m === i) break;
          [p[m], p[i]] = [p[i], p[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
        }
      }
      return top;
    },
  };
}

/**
 * A* over the built terrain with a single tunable: `w`, how much the route cares about terrain.
 *
 * `w = 0` is the straight line; raising it buys sinuosity by going ROUND things — the ridge, the
 * tarn, the notch. That is what the leg-length solve below bisects on, so the road's wander is a
 * route negotiating obstacles rather than a sine wave bolted onto a chord.
 */
function astar(ax, az, bx, bz, w = 1) {
  const s = Math.floor(clamp(az, 0, ROWS * CELL - 1) / CELL) * COLS + Math.floor(clamp(ax, 0, COLS * CELL - 1) / CELL);
  const t = Math.floor(clamp(bz, 0, ROWS * CELL - 1) / CELL) * COLS + Math.floor(clamp(bx, 0, COLS * CELL - 1) / CELL);
  const g = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const open = makeHeap();
  open.push(0, s);
  g[s] = 0;
  const tx = t % COLS, tz = (t - tx) / COLS;
  const h = (i) => { const x = i % COLS, z = (i - x) / COLS; return Math.hypot(x - tx, z - tz) * CELL; };
  const closed = new Uint8Array(COLS * ROWS);
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === t) break;
    const cx = cur % COLS, cz = (cur - cx) / COLS;
    const cc = 1 + w * terrainCost[cur];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
      const ni = nz * COLS + nx;
      if (closed[ni]) continue;
      const step = CELL * (dx && dz ? Math.SQRT2 : 1);
      const ng = g[cur] + step * (cc + 1 + w * terrainCost[ni]) / 2;
      if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; open.push(ng + h(ni), ni); }
    }
  }
  const out = [];
  for (let i = t; i !== -1; i = prev[i]) { const x = i % COLS; out.push([x * CELL + CELL / 2, ((i - x) / COLS) * CELL + CELL / 2]); if (i === s) break; }
  out.reverse();
  if (out.length) { out[0] = [ax, az]; out[out.length - 1] = [bx, bz]; }
  return out;
}

const len2d = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };

function resample(p, step) {
  const out = [p[0].slice()];
  let carry = 0;
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], az = p[i - 1][1], bx = p[i][0], bz = p[i][1];
    const seg = Math.hypot(bx - ax, bz - az);
    let t = (step - carry) / seg;
    while (t <= 1) { out.push([lerp(ax, bx, t), lerp(az, bz, t)]); t += step / seg; }
    carry = (carry + seg) % step;
  }
  out.push(p[p.length - 1].slice());
  return out;
}
function smooth(p, passes) {
  let q = p.map((v) => v.slice());
  for (let k = 0; k < passes; k++) {
    const r = q.map((v) => v.slice());
    for (let i = 1; i < q.length - 1; i++) {
      r[i][0] = (q[i - 1][0] + 2 * q[i][0] + q[i + 1][0]) / 4;
      r[i][1] = (q[i - 1][1] + 2 * q[i][1] + q[i + 1][1]) / 4;
    }
    q = r;
  }
  return q;
}
/**
 * Is a point somewhere a trunk road may stand?
 *
 * The old solve displaced the finished polyline up to 212 m sideways to hit the leg's tabled
 * length and asked nothing about where it landed. Every lateral move is now line-searched against
 * this predicate, so sinuosity can only be bought on ground the road could actually be built on.
 * `t = 0` — the routed point itself — is always admissible, so a leg can never fail to solve.
 */
function admissible(x, z) {
  const g = field.heightAt(x, z);
  let s = null;
  for (const ph of [0, 0.25, 0.5, 0.75]) { const v = field.waterSurfaceAt(x, z, ph); if (v !== null && (s === null || v > s)) s = v; }
  if (s !== null && s - g > 0.45) return false;          // never over knee-deep at any tide phase
  if (field.slopeAt(x, z, 8) > 28) return false;          // and never on ground a deck cannot hold
  return true;
}
/** Move `q` toward `to` by the largest fraction of the way that stays admissible. */
function safeMove(q, tox, toz) {
  for (let t = 1.0; t > 0.001; t -= 0.125) {
    const x = lerp(q[0], tox, t), z = lerp(q[1], toz, t);
    if (admissible(x, z)) return [x, z];
  }
  return q.slice();
}
/** Pull a route toward its own chord by `s`; s = 1 is the straight line. */
function straighten(p, s) {
  const a = p[0], b = p[p.length - 1];
  const n = p.length - 1;
  return p.map((q, i) => {
    if (i === 0 || i === n) return q.slice();
    return safeMove(q, lerp(q[0], lerp(a[0], b[0], i / n), s), lerp(q[1], lerp(a[1], b[1], i / n), s));
  });
}
/** Add smooth lateral sinuosity of amplitude `amp`, zero at both ends. */
function wiggle(p, amp, seedPhase) {
  const n = p.length - 1;
  return p.map((q, i) => {
    if (i === 0 || i === n) return q.slice();
    const t = i / n;
    const env = Math.sin(Math.PI * t);
    const w = Math.sin(2 * Math.PI * (1.6 * t + seedPhase)) * 0.6 + Math.sin(2 * Math.PI * (3.1 * t + seedPhase * 1.7)) * 0.4;
    const px = p[Math.min(n, i + 1)][0] - p[Math.max(0, i - 1)][0];
    const pz = p[Math.min(n, i + 1)][1] - p[Math.max(0, i - 1)][1];
    const L = Math.hypot(px, pz) || 1;
    return safeMove(q, q[0] + (-pz / L) * amp * env * w, q[1] + (px / L) * amp * env * w);
  });
}

// ---- the deck ------------------------------------------------------------------------------------
// The defect verdict W1-01 §8 names — 502 m of THE CROSSING under 65.6 m of water at LOW tide —
// was not a routing defect. The natural ground at the deepest point is 154.01 m and dry; the road's
// own elevation profile was 69.17 m there, an 85 m CUTTING that `field._applyRoads` blends the hill
// down into, and the cutting then fills from a water plane at 135.30 m. The old solve had a 12%
// grade cap and NO LIMIT ON CUT OR FILL, so every hill the road could not climb at 12% was sliced
// off at road level and every gorge it could not descend was bridged with 88 m of earth.
//
// The constraint order below is the fix, and the order is the whole of it. Applied last wins:
//   1. clearance above the highest water of the tide cycle   (hardest: a drowned road is not a road)
//   2. cut and fill limits against the natural ground        (a trench is what fills)
//   3. grade                                                 (softest: a steep road is still a road)
const CLEAR_M = 0.40;          // deck stands this far above the highest water it crosses
const MAX_CUT_M = 3.0;         // a road cutting. Deeper than this is a trench, and trenches fill
const MAX_FILL_M = 26.0;       // an embankment; above DECK_M of it the road is a deck, not a bank
const DECK_M = 3.0;            // fill above this is emitted as a causeway/bridge span
const MAX_GRADE = 0.20;
const TIDE_PHASES = [0, 0.25, 0.5, 0.75];

/** The highest this point's water ever stands, over the whole tide cycle; null where never wet. */
function highWater(x, z) {
  let s = null;
  for (const ph of TIDE_PHASES) {
    const v = field.waterSurfaceAt(x, z, ph);
    if (v !== null && (s === null || v > s)) s = v;
  }
  return s;
}

function solveDeck(p, tideway, extraFloor = null) {
  const g = p.map(([x, z]) => field.heightAt(x, z));
  const hw = p.map(([x, z]) => highWater(x, z));
  // The tideway is the one leg whose identity is that it is BELOW the waterline: 0.85 m under mean
  // water, walkable at LOW, closed at HIGH (RI-TRV01, RI-WLD10 M54). It is exempt by name, not by
  // accident, and the M2-ROAD-ABOVE-WATER check exempts exactly the same leg.
  if (tideway) {
    const y = p.map(([x, z], i) => (field.waterSurfaceAt(x, z, 0) === null ? g[i] : field.waterSurfaceAt(x, z, 0)) - 0.85);
    return { y, max_cut: 0, max_fill: 0, spans: [], span_m: 0 };
  }
  const floor = p.map((_, i) => {
    let f = hw[i] === null ? -Infinity : hw[i] + CLEAR_M;
    if (extraFloor && extraFloor[i] > f) f = extraFloor[i];
    return f;
  });
  let y = g.map((gi, i) => Math.max(gi, floor[i] === -Infinity ? -1e9 : floor[i]));
  for (let k = 0; k < 60; k++) {
    const q = y.slice();
    for (let i = 1; i < y.length - 1; i++) q[i] = (y[i - 1] + 2 * y[i] + y[i + 1]) / 4;
    for (let i = 1; i < q.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) || 1;
      q[i] = clamp(q[i], q[i - 1] - MAX_GRADE * d, q[i - 1] + MAX_GRADE * d);
    }
    for (let i = q.length - 2; i >= 0; i--) {
      const d = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) || 1;
      q[i] = clamp(q[i], q[i + 1] - MAX_GRADE * d, q[i + 1] + MAX_GRADE * d);
    }
    for (let i = 0; i < q.length; i++) {
      q[i] = clamp(q[i], g[i] - MAX_CUT_M, g[i] + MAX_FILL_M);
      if (floor[i] > q[i]) q[i] = floor[i];
    }
    y = q;
  }
  // Spans: every run where the deck stands more than DECK_M above the ground it crosses is a
  // structure, not an earth bank, and is emitted as one so `field.setRoads` can hold the ground
  // under it instead of damming the channel with it.
  const spans = [];
  let cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  let start = -1, maxCut = 0, maxFill = 0, spanM = 0;
  for (let i = 0; i < y.length; i++) {
    maxCut = Math.max(maxCut, g[i] - y[i]);
    maxFill = Math.max(maxFill, y[i] - g[i]);
    const isDeck = y[i] - g[i] > DECK_M;
    if (isDeck && start < 0) start = i;
    if ((!isDeck || i === y.length - 1) && start >= 0) {
      const end = isDeck ? i : i - 1;
      let h = 0, wet = 0;
      for (let k = start; k <= end; k++) { h = Math.max(h, y[k] - g[k]); if (hw[k] !== null) wet++; }
      const L = cum[end] - cum[start];
      if (L >= 12) {
        spans.push({ from_i: start, to_i: end, from_m: +cum[start].toFixed(0), to_m: +cum[end].toFixed(0),
          length_m: +L.toFixed(0), max_height_m: +h.toFixed(1),
          kind: wet > (end - start) / 2 ? 'causeway over water' : 'viaduct' });
        spanM += L;
      }
      start = -1;
    }
  }
  return { y, max_cut: +maxCut.toFixed(2), max_fill: +maxFill.toFixed(2), spans, span_m: +spanM.toFixed(0) };
}

// ---- the legs ------------------------------------------------------------------------------------
const S = scale.settlements;
const minorsFor = (a, b) => Object.entries(scale.minor_settlements)
  .filter(([, m]) => (m.on_leg[0] === a && m.on_leg[1] === b) || (m.on_leg[0] === b && m.on_leg[1] === a))
  .map(([name, m]) => ({ name, x: m.x, z: m.z }))
  .sort((p, q) => {
    const ax = S[a].x, az = S[a].z, dx = S[b].x - ax, dz = S[b].z - az, L2 = dx * dx + dz * dz;
    return ((p.x - ax) * dx + (p.z - az) * dz) / L2 - ((q.x - ax) * dx + (q.z - az) * dz) / L2;
  });

const legs = [];
for (const leg of scale.roads) {
  // The sinuosity solve is applied PER SUB-SEGMENT (settlement to minor to minor to settlement),
  // not across the whole leg. Solving it across the leg pushed the road up to 200 m sideways and
  // left the minor settlements that justify the leg's shape stranded off it — which is M5's
  // habitation-gap failure wearing a different hat.
  const way = [[S[leg.from].x, S[leg.from].z], ...minorsFor(leg.from, leg.to).map((m) => [m.x, m.z]), [S[leg.to].x, S[leg.to].z]];
  const chords = [];
  for (let i = 0; i + 1 < way.length; i++) chords.push(Math.hypot(way[i + 1][0] - way[i][0], way[i + 1][1] - way[i][1]));
  const chordSum = chords.reduce((a, b) => a + b, 0);
  const modes = [];
  let p = [];
  for (let i = 0; i + 1 < way.length; i++) {
    const tgt = leg.path_m * chords[i] / chordSum;
    // The leg length is RI-WLD01 §4's number and it is met by bisection — but the scalar bisected
    // is now the ROUTE's terrain-aversion `w`, not a lateral displacement applied afterwards. The
    // old solve pushed the finished polyline up to 212 m sideways into terrain nobody had costed,
    // which is how a trunk leg ended up over a tarn. Sinuosity is now bought by detouring.
    // Two bisections on two scalars, in the order that keeps the road on buildable ground.
    //
    //   (a) `w` — how much the route pays to avoid slope, roughness and depth. w = 0 is the chord;
    //       raising it buys length by going ROUND the ridge, the notch and the tarn. Take the
    //       largest w whose route is still no longer than the leg's tabled length, so the wander is
    //       bought by obstacle-negotiation first and by displacement only for the remainder.
    //   (b) the residual lateral sinuosity, every metre of it line-searched against `admissible`.
    //
    // RI-WLD01 §4's path_m is still met exactly. What changed is where the metres come from.
    const route = (w) => smooth(resample(astar(way[i][0], way[i][1], way[i + 1][0], way[i + 1][1], w), 18), 12);
    let lo = 0, hi = 24, sp = route(0), mode, amount;
    if (len2d(sp) > tgt) {
      let a = 0, b = 1;
      for (let it = 0; it < 30; it++) { const m = (a + b) / 2; if (len2d(straighten(sp, m)) > tgt) a = m; else b = m; }
      amount = (a + b) / 2; sp = straighten(sp, amount); mode = `chord route, straightened ${amount.toFixed(2)}`;
    } else {
      for (let it = 0; it < 12; it++) {
        const m = (lo + hi) / 2, cand = route(m);
        if (len2d(cand) <= tgt) { lo = m; sp = cand; } else hi = m;
      }
      let a = 0, b = 400;
      for (let it = 0; it < 30; it++) { const m = (a + b) / 2; if (len2d(wiggle(sp, m, 0.11 + i * 0.19)) < tgt) a = m; else b = m; }
      amount = (a + b) / 2;
      sp = wiggle(sp, amount, 0.11 + i * 0.19);
      mode = `detour w=${lo.toFixed(2)} + sinuosity ${amount.toFixed(0)} m`;
    }
    modes.push(mode);
    for (let k = (p.length ? 1 : 0); k < sp.length; k++) p.push(sp[k]);
  }
  const mode = modes.join(' | ');
  const amount = 0;
  p = resample(p, 12);

  // ---- elevation profile --------------------------------------------------------------------
  const tideway = /tideway/i.test(leg.class);
  const deck = solveDeck(p, tideway);
  const y = deck.y;
  let maxGrade = 0;
  for (let i = 1; i < y.length; i++) {
    const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) || 1;
    maxGrade = Math.max(maxGrade, Math.abs(y[i] - y[i - 1]) / d);
  }
  const pts = p.map((q, i) => [+q[0].toFixed(2), +q[1].toFixed(2), +y[i].toFixed(2)]);
  const built = len2d(p);
  legs.push({
    id: `${leg.from}-${leg.to}`.toLowerCase(), from: leg.from, to: leg.to, class: leg.class,
    tide_gated: tideway,
    straight_m: leg.straight_m, declared_path_m: leg.path_m, built_path_m: +built.toFixed(1),
    declared_walk_min: leg.walk_min, built_walk_min: +(built / 2.0 / 60).toFixed(2),
    sinuosity_built: +(built / Math.hypot(S[leg.to].x - S[leg.from].x, S[leg.to].z - S[leg.from].z)).toFixed(3),
    routing: mode,
    max_grade: +maxGrade.toFixed(3),
    max_cut_m: deck.max_cut, max_fill_m: deck.max_fill,
    deck_spans: deck.spans, deck_span_m: deck.span_m,
    half_width_m: tideway ? 3.0 : leg.class === 'Imperial road' || leg.class === 'stone road' ? 3.6 : 3.0,
    waypoints: minorsFor(leg.from, leg.to).map((m) => m.name),
    points: pts,
  });
}

// ---- waystations: RI-WLD01 §6's rule, enforced rather than assumed --------------------------------
// "No road leg may have a >8 min gap without habitation." The sixteen minor settlements the corpus
// derives from the map do not achieve it on their own — Archon-Thorn is 4.3 km with two of them, so
// its sub-segments are 11-13 walking minutes each. Every remaining gap gets a named wayside place on
// the road itself: a shrine, a well, a ferry-post or a camp, chosen by the region it stands in.
const WAY_KINDS = {
  'salt-hills': ['Legion Milepost', 'Watchtower Well'],
  thornmarsh: ['Knife-Mark Camp', 'Ash Shelter'],
  'valus-ridge': ['Rock-Flute Cairn', 'Border Cairn'],
  'stone-forest': ['Wayshrine of the Root', 'Tender\u2019s Rest'],
  'clay-moor': ['Fired-Cold Well', 'Kiln Post'],
  'crimson-coast': ['Vat-Keeper\u2019s Hut', 'Lichen Post'],
  blackwood: ['Logging Camp', 'Welkynd Shrine'],
  hive: ['Comb Gate', 'Drone Post'],
  'deep-marshes': ['Corpse-Lily Shrine', 'Pole Camp'],
  'marauders-coast': ['Bell-Buoy Post', 'Hull Shelter'],
  'western-rootlands': ['Root-Arch Rest', 'Paddy Post'],
  'eastern-rootlands': ['Stilt-Rest', 'Tide-Pole Post'],
  'stone-wastes': ['Salt Cistern', 'Crater Shelter'],
};
const GAP_M = 8.0 * 60 * 2.0;                 // 8 walking minutes at 2.0 m/s
const inhabited = [
  ...Object.values(scale.settlements).map((s) => ({ x: s.x, z: s.z })),
  ...Object.values(scale.minor_settlements).map((s) => ({ x: s.x, z: s.z })),
];
const waystations = [];
for (const l of legs) {
  const marks = [0];
  let cum = 0;
  const cums = [0];
  for (let i = 1; i < l.points.length; i++) {
    cum += Math.hypot(l.points[i][0] - l.points[i - 1][0], l.points[i][1] - l.points[i - 1][1]);
    cums.push(cum);
    if (inhabited.some((p) => Math.hypot(p.x - l.points[i][0], p.z - l.points[i][1]) < 70)) marks.push(cum);
  }
  marks.push(cum);
  const total = cum;
  const extra = [];
  for (let k = 1; k < marks.length; k++) {
    const gap = marks[k] - marks[k - 1];
    if (gap <= GAP_M) continue;
    const n = Math.ceil(gap / GAP_M);
    for (let q = 1; q < n; q++) extra.push(marks[k - 1] + gap * q / n);
  }
  for (const at of extra) {
    let i = 1;
    while (i < cums.length - 1 && cums[i] < at) i++;
    const pt = l.points[i];
    const reg = field.regionAt(pt[0], pt[1]);
    const names = WAY_KINDS[reg.id] || ['Wayside Camp'];
    const nm = names[waystations.length % names.length];
    waystations.push({
      id: `way-${l.id}-${waystations.length}`,
      name: `${nm} (${l.from}\u2013${l.to})`,
      leg: l.id, region: reg.id,
      x: pt[0], z: pt[1], y: pt[2],
      at_m: +at.toFixed(0), of_m: +total.toFixed(0),
    });
  }
}

// ---- the crossing and the long way ------------------------------------------------------------------
const legLen = new Map(legs.map((l) => [`${l.from}>${l.to}`, l.built_path_m]));
const legAt = (a, b) => legLen.get(`${a}>${b}`) ?? legLen.get(`${b}>${a}`);
const CROSSING = ['Stormhold', 'Helstrom', 'Blackrose', 'Lilmoth'];
const LONG = ['Thorn', 'Stormhold', 'Helstrom', 'Blackrose', 'Soulrest'];
const routeOf = (names) => {
  let m = 0;
  for (let i = 0; i + 1 < names.length; i++) m += legAt(names[i], names[i + 1]);
  return { settlements: names, legs: names.slice(0, -1).map((n, i) => `${n}-${names[i + 1]}`.toLowerCase()), metres: +m.toFixed(1), walk_min: +(m / 2 / 60).toFixed(2), jog_min: +(m / 3.2 / 60).toFixed(2) };
};

const doc = {
  schema: 'elder-souls/roads@1',
  generator: 'tools/world/build-roads.mjs',
  note: 'The Rootway. Endpoints, class and path length are RI-WLD01 §4; the ROUTE between them is '
      + 'A* over the built terrain, so the road goes round the ridge and crosses at the narrows. '
      + 'Each leg carries its own elevation profile and the game blends the ground to it, which is '
      + 'what makes a causeway a causeway instead of a decal on a marsh.',
  speeds_mps: scale.scale.speeds_mps,
  legs,
  waystations,
  named_routes: {
    crossing: { ...routeOf(CROSSING), note: 'RI-WLD01 §5 THE CROSSING — Stormhold south gate to Lilmoth harbour steps.' },
    long_way: { ...routeOf(LONG), note: 'RI-WLD01 §5 THE LONG WAY — Thorn to Soulrest.' },
  },
  total_trunk_m: +legs.reduce((s, l) => s + l.built_path_m, 0).toFixed(1),
};
writeFileSync(join(ROOT, 'game/data/world/roads.json'), JSON.stringify(doc, null, 1) + '\n');

process.stdout.write(`leg                       decl m   built m    err%   walk min  grade  routing\n`);
for (const l of legs) {
  process.stdout.write(`${(l.from + ' -> ' + l.to).padEnd(24)} ${String(l.declared_path_m).padStart(6)} ${String(l.built_path_m).padStart(9)} `
    + `${((l.built_path_m / l.declared_path_m - 1) * 100).toFixed(2).padStart(7)}  ${String(l.built_walk_min).padStart(8)}  ${l.max_grade.toFixed(2).padStart(5)}  ${l.routing}\n`);
}
process.stdout.write(`\nwaystations ${waystations.length} inserted to hold every habitation gap under 8 walking minutes\n`);
process.stdout.write(`trunk network ${doc.total_trunk_m} m (RI-WLD01: 25,331 m)\n`);
process.stdout.write(`THE CROSSING  ${doc.named_routes.crossing.metres} m = ${doc.named_routes.crossing.walk_min} min walk (RI-WLD01: 6,909 m / 57.6 min)\n`);
process.stdout.write(`THE LONG WAY  ${doc.named_routes.long_way.metres} m = ${doc.named_routes.long_way.walk_min} min walk (RI-WLD01: 9,477 m / 79.0 min)\n`);
