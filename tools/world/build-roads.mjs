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
 * ================================================================================================
 * THE JOIN (W1-ROAD-JOIN). THE ROUTER IS SHOWN THE SETTLEMENT PLAN.
 * ================================================================================================
 *
 * Until this section existed, this file routed roads over the TERRAIN and `planSettlement()` planted
 * houses on the same ground afterwards, and **nothing compared them**. `tools/world/road-through-
 * building.mjs` reported 10 of 10 built legs passing through at least one building, 16 offences on
 * the two named routes, and a body put on THE CROSSING got 39 m of 6,816 m before it stood against
 * the wall of `stormhold-scribe` for 60,001 frames. §P.4 of the dispatch — "you can walk between
 * regions and the ground is there" — was retracted because of it.
 *
 * WHICH SIDE YIELDS, AND WHY. **The road yields. Routing consumes the settlement plan; not one
 * building moves.** Three reasons, in the order they bind:
 *
 *   1. `ARBITRATION` S28 has already ruled the axis: *"settlement positions are authoritative and
 *      immovable, but the route between any two of them may be re-cut freely"*, subject to the
 *      crossing staying in its 52-65 minute band and no leg moving more than 5% from its declared
 *      length. That ruling names roads as the yielding side and this file is where a re-cut lives.
 *   2. `planSettlement()` says the same thing in its own words — positions are `RI-WLD03` R4's
 *      spatial proof of the town's power reading. A house is *where* it is on purpose; a road is
 *      only ever a way of getting somewhere.
 *   3. `planSettlement()` is PURE and runs in the browser per boot. Making it avoid roads would put
 *      the whole road network into a function whose contract is "data in, placements out"; making
 *      the generator read the plan costs one import in a build tool.
 *
 * WHAT THE JOIN IS NOT. It is not a detour around the town. A road that swings wide of every
 * settlement is a worse world than the bug: this is Morrowind's province, and the trunk road is
 * supposed to *become the street*. So the join re-cuts only the part of a leg that is inside a
 * town's neighbourhood, on a **1 m grid where the building footprints are the walls**, and then
 * string-pulls the result so the road hugs the corners of the gaps it found. The road goes
 * BETWEEN the houses. Outside the neighbourhood not a metre moves.
 *
 * THE FOOTPRINTS ARE THE UNION OF BOTH PLANS, and that is not fussiness. The check tool calls
 * `planSettlement(doc, {})` with an EMPTY interiors map; the running game calls
 * `setSettlements(docs, this.data.interiors)` with all 115. 114 of the 202 buildings get a
 * different footprint between the two and the game's is usually the bigger — `stormhold-scribe` is
 * 10.0 x 11.5 m to the check and 12.4 x 14.4 m to the body. Clearing only the check's footprints
 * would have produced a green check and a body still in a wall. The join clears both.
 *
 * THE GATE. `Thorn`'s declared centre is 7.11 m INSIDE `thorn-hall`, so a road that ends at the
 * settlement position ends inside the mayor's hall no matter how it is routed. The leg's terminus
 * — not the settlement — is moved to the nearest clear standing on the square. That is a gate, and
 * it is emitted as `road_anchor` on the leg so it is a declared fact rather than a silent nudge.
 *
 * Usage: node tools/world/build-roads.mjs
 *        node tools/world/build-roads.mjs --no-join   # the delete-the-fix arm: route as before
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { clamp, lerp } from '../../game/src/world/noise.js';
import { planSettlement } from '../../game/src/render/exterior.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const ARGV = process.argv.slice(2);
const argOf = (flag, dflt) => (ARGV.includes(flag) ? ARGV[ARGV.indexOf(flag) + 1] : dflt);

const scale = rd('corpus/50-world/world-scale.json');
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
const COLS = field.cols, ROWS = field.rows, CELL = field.cell;

// ---- traversal cost -----------------------------------------------------------------------------
const TIDE_PEAK = 0.25;        // h = A/2 sin(2 pi phase); phase 0.25 is the maximum of every surface
const cost = new Float32Array(COLS * ROWS);
const terrainCost = new Float32Array(COLS * ROWS);
const waterCost = new Float32Array(COLS * ROWS);
const slopeG = new Float32Array(COLS * ROWS);
const roughG = new Float32Array(COLS * ROWS);
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
  roughG[i] = rough;
  const d = depthG[i];
  // Water is costed by DEPTH and without the old min(d,3) ceiling: an 18 m tarn and a 0.3 m puddle
  // used to cost the same 13.5, which is why the trunk was happy to lie in a lake. A crossing is
  // still possible — it is priced, at roughly 12 cost-metres per metre of depth — so A* crosses at
  // the narrows and at the shallows instead of along the bed.
  waterCost[i] = d > 0 ? 8 + 12 * d : 0;
  slopeG[i] = slope;
  cost[i] = 1;
}

// ---- RELIEF APPETITE (ARBITRATION S28) ---------------------------------------------------------
// `RI-WLD07` M36-ROAD-RELIEF asks that at least 30% of 500 m road windows change 15 m in
// elevation. Rounds 1-3 measured 27.3% and could not move it, because the router was built to do
// the opposite of what the measure asks: length was bought by raising `w`, and raising `w` buys
// length by going ROUND the ridge, the notch and the tarn. A road that is paid to avoid relief
// gets longer and flatter at the same time, which is exactly what happened.
//
// S28 unblocks it: "settlement positions are authoritative and immovable, but the route between
// any two of them may be re-cut freely", provided the crossing stays in its 52-65 minute band, no
// leg's length moves more than 5% from its declared value, and every re-cut leg is re-verified
// against the water census, the slope histogram and reachability.
//
// So the cost gains a term that is a PENALTY ON FLAT GROUND rather than a reward for steep ground
// — A* needs non-negative edge costs, and a negative one would be unsound rather than merely
// slow. `reliefPot` is the height range of the ground over a 175 m neighbourhood: a corridor with
// less than RELIEF_REF metres of it is charged for the privilege. Slope and roughness aversion are
// scaled DOWN by the same appetite, so a route with appetite 1 is willing to climb over what a
// route with appetite 0 walked around, and the length bisection then buys its metres in the
// vertical instead of the horizontal.
const RELIEF = Math.max(0, Math.min(1, Number(argOf('--relief', '0.65'))));
const RELIEF_PULL = 26;        // cost-metres per unit of flatness at appetite 1
const RELIEF_REF = 30;         // metres of neighbourhood relief above which nothing is charged
const RELIEF_R = 7;            // cells; 7 x 25 m = 175 m, a third of the 500 m measurement window
const reliefPot = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  let lo = Infinity, hi = -Infinity;
  const z0 = Math.max(0, z - RELIEF_R), z1 = Math.min(ROWS - 1, z + RELIEF_R);
  const x0 = Math.max(0, x - RELIEF_R), x1 = Math.min(COLS - 1, x + RELIEF_R);
  for (let nz = z0; nz <= z1; nz += 2) for (let nx = x0; nx <= x1; nx += 2) {
    const v = groundG[nz * COLS + nx];
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  reliefPot[z * COLS + x] = hi - lo;
}
for (let i = 0; i < COLS * ROWS; i++) {
  const x = i % COLS, z = (i - x) / COLS;
  const flat = Math.max(0, 1 - reliefPot[i] / RELIEF_REF);
  terrainCost[i] = (1 - 0.55 * RELIEF) * (0.40 * slopeG[i] + 0.25 * roughG[i])
    + waterCost[i] + RELIEF * RELIEF_PULL * flat
    + (field.isOceanAt(x * CELL, z * CELL) ? 400 : 0);
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
let ALLOW_WATER = false;        // set for the one leg RI-WLD01 §4 declares a tideway
function admissible(x, z) {
  const g = field.heightAt(x, z);
  let s = null;
  for (const ph of [0, 0.25, 0.5, 0.75]) { const v = field.waterSurfaceAt(x, z, ph); if (v !== null && (s === null || v > s)) s = v; }
  if (!ALLOW_WATER && s !== null && s - g > 0.45) return false;   // never over knee-deep at any phase
  if (ALLOW_WATER && s !== null && s - g > 2.6) return false;     // the tideway floods; it is not a trench
  if (field.slopeAt(x, z, 8) > 28) return false;                  // and never on ground a deck cannot hold
  // W1-ROAD-JOIN. A wall is ground a road cannot be built on for exactly the same reason a lake is,
  // and it belongs in exactly the same predicate. Every lateral move in this file — the sinuosity
  // solve, the straightening, and the post-join length correction — is line-searched against
  // `safeMove`, so putting the buildings here joins the two generators at every one of them at
  // once instead of at the three call sites somebody remembers.
  if (CLEAR_BUILDINGS && clearanceTo(ALL_OBSTACLES, x, z) < BUILD_CLEAR_M) return false;
  return true;
}
// Set once the obstacle field exists. `admissible` is defined above it because the routing helpers
// that call it are, and a hoisted function reading a `let` initialised later would throw.
let CLEAR_BUILDINGS = false;
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

/* ================================================================================================
 * THE JOIN — the settlement plan, as an obstacle field the router must respect.
 *
 * Everything below reads `planSettlement()`, the same pure function `game/src/world/province.js`
 * calls to decide where the walls are. That is the join: there is one description of where the
 * buildings stand and both generators now read it. It is not "the seeds happen to agree" — if a
 * building moves, this file's output moves with it, and `--consume` in
 * `tools/world/road-join-consumption.mjs` is the demonstration.
 * ==============================================================================================*/

const JOIN_ON = !ARGV.includes('--no-join');

// How near a wall face the road CENTRELINE may come. The body is 0.32 m
// (`world-collision.js PLAYER_RADIUS_M`) and the wall slab stands WALL_T/2 = 0.18 m proud of the
// footprint, so 0.50 m is the geometric minimum. 1.10 m is that plus slack for the walker, which
// steers at a point 4.5 m ahead and therefore cuts every corner it turns.
const BUILD_CLEAR_M = 1.10;
// The clearance the road would LIKE. Inside this band it is charged, so where there is room the
// street runs down the middle of the gap instead of scraping one wall.
const BUILD_ROOM_M = 3.2;
// How far outside a town's own radius the fine re-cut reaches. The join must own the whole
// approach, or it hands the leg back to the coarse route inside somebody's garden.
const TOWN_PAD_M = 45;
const FINE_CELL_M = 1.0;       // the re-cut grid. A 2 m alley is two cells wide; 1 m finds it.

/** Every interior record, keyed the way `engine.js` keys `this.data.interiors`. */
function loadInteriors() {
  const out = {};
  const dir = join(ROOT, 'game/data/world/interiors');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (doc && doc.id) out[doc.id] = doc;
    else if (doc) for (const k of Object.keys(doc)) if (doc[k] && doc[k].id) out[doc[k].id] = doc[k];
  }
  return out;
}

/**
 * The towns, as obstacle fields.
 *
 * Each building becomes an oriented box. Its half-extents are the LARGER of the two footprints
 * `planSettlement()` produces — with the interiors loaded (what the game builds walls from) and
 * without (what the offline check measures). See the header: they disagree for 114 of 202.
 */
function loadTowns() {
  const interiors = loadInteriors();
  const dir = join(ROOT, 'game/data/world/settlements');
  const towns = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const rec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const withI = planSettlement(rec, interiors), without = planSettlement(rec, {});
    const obstacles = [];
    for (let i = 0; i < withI.buildings.length; i++) {
      const a = withI.buildings[i], b = without.buildings[i];
      const fp = (q) => (q.drawn_footprint_m || q.footprint_m);
      obstacles.push({
        town: withI.id, id: a.id, x: a.x, z: a.z, yaw: (a.yaw_deg || 0) * Math.PI / 180,
        hw: Math.max(fp(a)[0], fp(b)[0]) / 2, hd: Math.max(fp(a)[1], fp(b)[1]) / 2,
      });
    }
    let reach = 0;
    for (const o of obstacles) reach = Math.max(reach, Math.hypot(o.x - withI.pos[0], o.z - withI.pos[2]) + Math.hypot(o.hw, o.hd));
    towns.push({ id: withI.id, x: withI.pos[0], z: withI.pos[2], radius_m: withI.radius_m, reach_m: reach, obstacles });
  }
  return towns;
}

const TOWNS = JOIN_ON ? loadTowns() : [];
const ALL_OBSTACLES = TOWNS.flatMap((t) => t.obstacles);
CLEAR_BUILDINGS = JOIN_ON;

/**
 * Signed clearance from (x, z) to one oriented box: positive outside, negative inside.
 * The standard box SDF, in the box's own frame.
 */
function boxClearance(o, x, z) {
  const c = Math.cos(-o.yaw), s = Math.sin(-o.yaw);
  const dx = x - o.x, dz = z - o.z;
  const lx = Math.abs(dx * c + dz * s) - o.hw;
  const lz = Math.abs(-dx * s + dz * c) - o.hd;
  if (lx > 0 || lz > 0) return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  return Math.max(lx, lz);                      // inside: the (negative) distance to the nearest face
}

/** Clearance to the nearest building in `list`; Infinity where there are none. */
function clearanceTo(list, x, z) {
  let best = Infinity;
  for (const o of list) { const d = boxClearance(o, x, z); if (d < best) best = d; }
  return best;
}

/** Is the straight run a->b clear of `list` by `need` metres the whole way, and buildable? */
function segmentClear(list, ax, az, bx, bz, need) {
  const L = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(L / 0.5));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (clearanceTo(list, x, z) < need) return false;
    if (!admissible(x, z)) return false;
  }
  return true;
}

/**
 * THE GATE. The nearest standing to `(cx, cz)` that is clear of every building by `need`.
 *
 * Only used where a leg's own terminus — the settlement position out of `world-scale.json` — is
 * itself inside a footprint, which is true of exactly one town in the shipped tree: `Thorn`'s
 * centre is 7.11 m inside `thorn-hall`. The settlement does not move. The road's terminus moves
 * onto the square, which is what a gate is.
 */
function gateFor(town, cx, cz, need) {
  if (clearanceTo(town.obstacles, cx, cz) >= need && admissible(cx, cz)) return null;
  let best = null;
  for (let r = 1; r <= 120; r += 0.5) {
    for (let a = 0; a < 720; a++) {                       // half-degree fan, deterministic order
      const th = a * Math.PI / 360;
      const x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
      if (clearanceTo(town.obstacles, x, z) < need) continue;
      if (!admissible(x, z)) continue;
      best = { x: +x.toFixed(2), z: +z.toFixed(2), moved_m: +r.toFixed(2), town: town.id };
      break;
    }
    if (best) break;
  }
  return best;
}

/**
 * A* on a 1 m grid over a box, with the building footprints as walls.
 *
 * Complete: if any corridor of `BUILD_CLEAR_M` exists between the two ends, this finds one. That
 * completeness is the reason the join is a re-cut and not a nudge — the offences in the shipped
 * tree need lateral moves of 0.5 m to 42 m, and a 42 m move is a road going round a block, which
 * no amount of pushing a polyline sideways will ever discover.
 *
 * The cost has three terms and the third is what keeps the result a road:
 *   1. distance
 *   2. a squeeze charge inside `BUILD_ROOM_M` of a wall, so the street centres itself in the gap
 *   3. a leash to the ORIGINAL corridor, so the re-cut is recognisably the same road arriving from
 *      the same direction rather than a free-for-all across the parish
 */
function fineRoute(list, ax, az, bx, bz, corridor, box) {
  const x0 = box.x0, z0 = box.z0;
  const W = Math.ceil((box.x1 - box.x0) / FINE_CELL_M) + 1;
  const H = Math.ceil((box.z1 - box.z0) / FINE_CELL_M) + 1;
  const N = W * H;
  if (N > 4_000_000) return null;
  const wx = (i) => x0 + (i % W) * FINE_CELL_M;
  const wz = (i) => z0 + Math.floor(i / W) * FINE_CELL_M;
  const idx = (x, z) => {
    const cx = Math.round((x - x0) / FINE_CELL_M), cz = Math.round((z - z0) / FINE_CELL_M);
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) return -1;
    return cz * W + cx;
  };
  // Distance from a cell to the original corridor, for the leash.
  const leashAt = (x, z) => {
    let best = Infinity;
    for (let i = 0; i + 1 < corridor.length; i++) {
      const px = corridor[i][0], pz = corridor[i][1];
      const qx = corridor[i + 1][0], qz = corridor[i + 1][1];
      const dx = qx - px, dz = qz - pz, L2 = dx * dx + dz * dz;
      let t = L2 > 1e-9 ? ((x - px) * dx + (z - pz) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (px + dx * t), z - (pz + dz * t));
      if (d < best) best = d;
    }
    return best;
  };
  const cellCost = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = wx(i), z = wz(i);
    const c = clearanceTo(list, x, z);
    if (c < BUILD_CLEAR_M || !admissible(x, z)) { cellCost[i] = -1; continue; }
    const squeeze = c < BUILD_ROOM_M ? 6.0 * (BUILD_ROOM_M - c) / BUILD_ROOM_M : 0;
    cellCost[i] = 1 + squeeze + 0.06 * leashAt(x, z);
  }
  const s = idx(ax, az), t = idx(bx, bz);
  if (s < 0 || t < 0) return null;
  cellCost[s] = Math.max(1, cellCost[s]);       // the ends are given, whatever stands on them
  cellCost[t] = Math.max(1, cellCost[t]);
  const g = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open = makeHeap();
  g[s] = 0; open.push(0, s);
  const tx = t % W, tz = Math.floor(t / W);
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === t) break;
    const cx = cur % W, cz = Math.floor(cur / W);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const ni = nz * W + nx;
      if (closed[ni] || cellCost[ni] < 0) continue;
      // No corner-cutting through a diagonal gap between two walls.
      if (dx && dz && (cellCost[cz * W + nx] < 0 || cellCost[nz * W + cx] < 0)) continue;
      const step = FINE_CELL_M * (dx && dz ? Math.SQRT2 : 1);
      const ng = g[cur] + step * (cellCost[cur] + cellCost[ni]) / 2;
      if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; open.push(ng + Math.hypot(nx - tx, nz - tz) * FINE_CELL_M, ni); }
    }
  }
  if (prev[t] === -1 && t !== s) return null;
  const cells = [];
  for (let i = t; i !== -1; i = prev[i]) { cells.push(i); if (i === s) break; }
  cells.reverse();
  const raw = cells.map((i) => [wx(i), wz(i)]);
  raw[0] = [ax, az]; raw[raw.length - 1] = [bx, bz];
  // STRING-PULL. A grid path is a staircase; a road is not. Advance as far as the straight run
  // stays clear, which turns the staircase into the few long straights and tight corners that a
  // street between two rows of houses actually is.
  const pulled = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    for (; j > i + 1; j--) if (segmentClear(list, raw[i][0], raw[i][1], raw[j][0], raw[j][1], BUILD_CLEAR_M)) break;
    pulled.push(raw[j]);
    i = j;
  }
  return pulled;
}

/**
 * Re-cut every part of `p` that lies in a town, so the leg threads the gaps instead of the walls.
 * Returns `{ p, recuts }`. Outside `radius_m + TOWN_PAD_M` of a town centre, `p` is untouched.
 */
function threadSettlements(p, legId) {
  if (!JOIN_ON) return { p, recuts: [] };
  const recuts = [];
  let out = p.map((q) => q.slice());
  for (const town of TOWNS) {
    const R = Math.max(town.radius_m, town.reach_m) + TOWN_PAD_M;
    let i0 = -1, i1 = -1;
    for (let i = 0; i < out.length; i++) {
      if (Math.hypot(out[i][0] - town.x, out[i][1] - town.z) > R) continue;
      if (i0 < 0) i0 = i;
      i1 = i;
    }
    if (i0 < 0) continue;
    // One point either side of the zone, so the splice joins the untouched road rather than
    // starting from a point that is already in somebody's garden.
    i0 = Math.max(0, i0 - 1); i1 = Math.min(out.length - 1, i1 + 1);
    const before = out.slice(i0, i1 + 1);
    const beforeLen = len2d(before);
    const a = before[0], b = before[before.length - 1];
    const xs = before.map((q) => q[0]).concat([town.x]), zs = before.map((q) => q[1]).concat([town.z]);
    const box = {
      x0: Math.min(...xs) - 60, x1: Math.max(...xs) + 60,
      z0: Math.min(...zs) - 60, z1: Math.max(...zs) + 60,
    };
    const cut = fineRoute(town.obstacles, a[0], a[1], b[0], b[1], before, box);
    if (!cut) {
      process.stderr.write(`JOIN: no corridor of ${BUILD_CLEAR_M} m through ${town.id} for leg ${legId}\n`);
      recuts.push({ town: town.id, ok: false, from_m: null, before_m: +beforeLen.toFixed(1), after_m: null });
      continue;
    }
    const afterLen = len2d(cut);
    out = out.slice(0, i0).concat(cut, out.slice(i1 + 1));
    recuts.push({ town: town.id, ok: true, points: cut.length,
      before_m: +beforeLen.toFixed(1), after_m: +afterLen.toFixed(1), delta_m: +(afterLen - beforeLen).toFixed(1) });
  }
  return { p: out, recuts };
}

/**
 * PUT BACK THE METRES THE RE-CUT SPENT — outside the towns, where there is room.
 *
 * The hour it takes to cross this province is the thing the world is for, and `RI-WLD01` §4's
 * `path_m` is where that hour is written down. `ARBITRATION` S28 permits a re-cut but binds it: no
 * leg may move more than 5% from its declared length. Threading `Lilmoth -> Archon` through two
 * towns found a shorter way and took 131.7 m off it — 5.2%, over the bar — so the metres go back.
 *
 * They go back OUTSIDE the towns. Every index within a town's re-cut zone is frozen, the leg is cut
 * into the free spans between them, and each span is given a proportional share of the deficit by
 * exactly the machinery the original solve uses — `wiggle` to add, `straighten` to remove, both
 * bisected, both line-searched point by point through `safeMove`. `admissible` now counts a wall as
 * unbuildable ground, so the correction cannot undo the join it is correcting.
 */
function correctLength(p, target, legId) {
  if (!JOIN_ON || p.length < 4) return { p, corrected_m: 0, spans: 0 };
  const frozen = p.map(([x, z]) => TOWNS.some((t) =>
    Math.hypot(x - t.x, z - t.z) <= Math.max(t.radius_m, t.reach_m) + TOWN_PAD_M));
  const spans = [];
  for (let i = 0; i < p.length; i++) {
    if (frozen[i]) continue;
    const a = Math.max(0, i - 1);
    let j = i;
    while (j + 1 < p.length && !frozen[j + 1]) j++;
    const b = Math.min(p.length - 1, j + 1);
    if (b - a >= 3) spans.push([a, b]);
    i = j + 1;
  }
  if (!spans.length) return { p, corrected_m: 0, spans: 0 };
  const spanLen = spans.map(([a, b]) => len2d(p.slice(a, b + 1)));
  const freeTotal = spanLen.reduce((s, v) => s + v, 0);
  const deficit = target - len2d(p);
  if (Math.abs(deficit) < 1 || freeTotal < 1) return { p, corrected_m: 0, spans: spans.length };
  const out = p.map((q) => q.slice());
  let got = 0;
  for (let k = 0; k < spans.length; k++) {
    const [a, b] = spans[k];
    const want = spanLen[k] + deficit * spanLen[k] / freeTotal;
    let sub = out.slice(a, b + 1);
    if (want < spanLen[k]) {
      let lo = 0, hi = 1;
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (len2d(straighten(sub, m)) > want) lo = m; else hi = m; }
      sub = straighten(sub, (lo + hi) / 2);
    } else {
      for (let pass = 0; pass < 4 && len2d(sub) < want - 0.5; pass++) {
        const ph = 0.29 + k * 0.23 + pass * 0.41;
        let lo = 0, hi = 300;
        for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (len2d(wiggle(sub, m, ph)) < want) lo = m; else hi = m; }
        if ((lo + hi) / 2 < 0.5) break;
        sub = wiggle(sub, (lo + hi) / 2, ph);
      }
    }
    got += len2d(sub) - spanLen[k];
    for (let i = a; i <= b; i++) out[i] = sub[i - a];
  }
  return { p: out, corrected_m: +got.toFixed(1), spans: spans.length, wanted_m: +deficit.toFixed(1), leg: legId };
}

/** Every 0.5 m sample of `p` that is nearer than `need` to a wall. The join's own audit. */
function joinAudit(p, need = BUILD_CLEAR_M) {
  const bad = [];
  let worst = Infinity;
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, z = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      const c = clearanceTo(ALL_OBSTACLES, x, z);
      if (c < worst) worst = c;
      if (c < need) bad.push([+x.toFixed(1), +z.toFixed(1), +c.toFixed(2)]);
    }
  }
  return { worst_clearance_m: Number.isFinite(worst) ? +worst.toFixed(2) : null, violations: bad.length, sample: bad.slice(0, 4) };
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
const DECK_M = 3.0;            // fill above this is emitted as a causeway/bridge span — a STRUCTURE
const MAX_GRADE = 0.12;        // the trunk bar: 6.8 degrees. A silt-strider analogue climbs this
const STAIR_GRADE = 0.45;      // the declared exception, on ground that is itself this steep
// 0.45 is 24.2 degrees. It is a cut stair or a switchback, not a carriageway, and every segment
// that uses it is emitted in `grade_exceptions` with its class and the natural grade that
// justified it. The ceiling is deliberately below `traversal.json slope.max_walkable_deg` (40 deg)
// so that a road is never something the player's own body would refuse to climb.
const CUT_SAMPLE_M = 3.0;      // sub-sampling for the cut constraint. THE ROUND-2 DEFECT WAS HERE
const TIDE_PHASES = [0, 0.25, 0.5, 0.75];

/**
 * ROUND 3. Verdict W1-01 round 2 made three findings about this solve and all three are answered
 * in the block below.
 *
 *  1. "A grade of 1.637 on THE CROSSING's first leg — 58.6 degrees, a 19.63 m rise over an 11.99 m
 *     run." The old solve had `MAX_GRADE = 0.30` and then broke it: the smoothing loop clamped the
 *     grade and the NEXT two lines overrode the clamp with `q[i] = clamp(q[i], g - CUT, ceil)` and
 *     `if (floor[i] > q[i]) q[i] = floor[i]`. A constraint applied before a hard override is not a
 *     constraint. The solve is now a single DILATION of the lower bound, which satisfies the grade
 *     limit by construction and cannot be overridden afterwards because there is no afterwards.
 *
 *  2. "The instrument's sampling rate decides its own result... it reports 3.0 m only because it
 *     samples at 12 m road points and misses the peak. At 3 m the same terrain gives 3.62 m."
 *     The cut constraint is now built against `corridorMaxGround`, which sweeps the corridor at
 *     3 m along the road and across the full half-width, so the bound binds on the peak the road
 *     actually cuts through and not on the two points either side of it.
 *
 *  3. "The 21 declared deck_spans are read nowhere in game/src. They are JSON labels on an earth
 *     berm." `field.setRoads` now builds them, so height above the ground costs nothing here: a
 *     run that stands more than DECK_M proud is a viaduct with air under it, not 17.52 m of fill.
 *     That is why the fill limit and the ramp-dilation hack are both GONE from this file.
 *
 * The grade exception is declared rather than silent: a segment may exceed `MAX_GRADE` only where
 * the NATURAL GROUND is itself steeper than it, up to `STAIR_GRADE`, and every such segment is
 * emitted in the leg's `grade_exceptions` with its class. A road that climbs a mountainside at the
 * mountainside's own angle is a road; one that climbs a flat moor at 58 degrees is a defect.
 */

/** The highest this point's water ever stands, over the whole tide cycle; null where never wet. */
function highWater(x, z) {
  let s = null;
  for (const ph of TIDE_PHASES) {
    const v = field.waterSurfaceAt(x, z, ph);
    if (v !== null && (s === null || v > s)) s = v;
  }
  return s;
}

/**
 * The highest water anywhere in the road CORRIDOR near point i — not just under the point.
 *
 * Water bodies here are narrow channels defined by a noise threshold, so a 3 m sliver of a 15 m
 * tarn fits between two road points 12 m apart. Sampling only at the points is how the first cut
 * of this fix still left 67 m of leg 1 over knee-deep water at every tide phase: the deck cleared
 * the water it was asked about and dived into the water it was not. The corridor is swept at 2 m
 * along the road and at +/- the half-width across it.
 */
function corridorHighWater(p, i, halfWidth) {
  let s = null;
  const n = p.length - 1;
  for (const j of [i - 1, i]) {
    if (j < 0 || j >= n) continue;
    const a = p[j], b = p[j + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const steps = Math.max(1, Math.ceil(L / 2));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const cx = a[0] + dx * t, cz = a[1] + dz * t;
      for (const off of [-1, -0.5, 0, 0.5, 1]) {
        const x = cx + (-dz / L) * off * halfWidth, z = cz + (dx / L) * off * halfWidth;
        const v = highWater(x, z);
        if (v !== null && (s === null || v > s)) s = v;
      }
    }
  }
  if (s === null) s = highWater(p[i][0], p[i][1]);
  return s;
}

/**
 * The highest natural ground anywhere in the corridor near point i, sub-sampled at CUT_SAMPLE_M
 * along the road and across the full half-width. The cut is measured against THIS, not against the
 * height at the road point, which is the round-2 sampling defect.
 */
function corridorMaxGround(p, i, halfWidth) {
  let g = -Infinity;
  const n = p.length - 1;
  for (const j of [i - 1, i]) {
    if (j < 0 || j >= n) continue;
    const a = p[j], b = p[j + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const steps = Math.max(1, Math.ceil(L / CUT_SAMPLE_M));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const cx = a[0] + dx * t, cz = a[1] + dz * t;
      for (const off of [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]) {
        const x = cx + (-dz / L) * off * halfWidth, z = cz + (dx / L) * off * halfWidth;
        const v = field.heightAt(x, z);
        if (v > g) g = v;
      }
    }
  }
  if (g === -Infinity) g = field.heightAt(p[i][0], p[i][1]);
  return g;
}

function solveDeck(p, tideway, halfWidth, extraFloor = null) {
  const g = p.map(([x, z]) => field.heightAt(x, z));
  const hw = p.map((_, i) => corridorHighWater(p, i, halfWidth));
  // The tideway is the one leg whose identity is that it is BELOW the waterline: 0.85 m under mean
  // water, walkable at LOW, closed at HIGH (RI-TRV01, RI-WLD10 M54). It is exempt by name, not by
  // accident, and the M2-ROAD-ABOVE-WATER check exempts exactly the same leg.
  if (tideway) {
    const y = p.map(([x, z], i) => (field.waterSurfaceAt(x, z, 0) === null ? g[i] : field.waterSurfaceAt(x, z, 0)) - 0.85);
    return { y, max_cut: 0, max_fill: 0, spans: [], span_m: 0, grade_exceptions: [], max_grade: 0 };
  }

  const gmax = p.map((_, i) => corridorMaxGround(p, i, halfWidth));
  const seg = p.map((_, i) => (i === 0 ? 1 : Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) || 1));

  // ---- the lower bound ------------------------------------------------------------------------
  // Two things push the deck up and nothing pushes it down: the highest water it must clear, and
  // the deepest cut it is allowed to take through the ground it passes.
  const L = p.map((_, i) => {
    const water = hw[i] === null ? -Infinity : hw[i] + CLEAR_M;
    const cut = gmax[i] - MAX_CUT_M;
    let v = Math.max(water, cut);
    if (extraFloor && extraFloor[i] > v) v = extraFloor[i];
    return v;
  });

  // ---- the per-segment grade limit --------------------------------------------------------------
  // MAX_GRADE everywhere, except where the hill itself is steeper: there the road may follow the
  // hill up to STAIR_GRADE, and the segment is declared as a stair rather than passed off as a road.
  // The window matters. A road descending a valley wall must be allowed the WALL's grade, not the
  // grade of the twelve metres under its wheels: taken point-to-point, one flat step in the middle
  // of a 30% descent pins the whole profile and the road ends up standing 69 m above the valley on
  // a mile of viaduct. Over +/- 6 points (~72 m) the limit is the terrain's own worst grade.
  const nat = p.map((_, i) => (i === 0 ? 0 : Math.abs(gmax[i] - gmax[i - 1]) / seg[i]));
  const gl = p.map((q, i) => {
    let m = 0;
    for (let j = Math.max(1, i - 6); j <= Math.min(nat.length - 1, i + 6); j++) if (nat[j] > m) m = nat[j];
    // No stairs inside a settlement. RI-WLD01 M1-SETTLEMENT-FLAT measures the worst slope inside a
    // 75 m footprint, and a road allowed its mountain grade all the way to the town gate puts a
    // 23-degree ramp through the market square. Inside a settlement's flat pad the road is a road.
    for (const st of field.sites) {
      if (st.kind !== 'settlement') continue;
      if (Math.hypot(q[0] - st.x, q[1] - st.z) < st.r_flat + 90) return MAX_GRADE;
    }
    return Math.min(STAIR_GRADE, Math.max(MAX_GRADE, m));
  });

  // ---- dilation -----------------------------------------------------------------------------
  // y = the smallest profile with y >= L whose slope never exceeds the local limit. A forward and
  // a backward running maximum computes it exactly, and the result satisfies BOTH constraints by
  // construction — there is no later pass that can break it.
  // D(L): the SMALLEST grade-feasible profile that still clears the water and honours the cut
  // limit. Computed as a forward and a backward running maximum, which is exactly the morphological
  // dilation of L by the grade cone — so |slope| <= gl everywhere by construction.
  const D = L.slice();
  for (let i = 1; i < D.length; i++) D[i] = Math.max(D[i], D[i - 1] - gl[i] * seg[i]);
  for (let i = D.length - 2; i >= 0; i--) D[i] = Math.max(D[i], D[i + 1] - gl[i + 1] * seg[i + 1]);
  for (let i = 0; i < D.length; i++) if (!Number.isFinite(D[i])) D[i] = g[i];
  // E(g): the LARGEST grade-feasible profile that never rises above the ground — the erosion of the
  // ground by the same cone. This is the road that sits ON the terrain and cuts only where the
  // grade forces it to.
  const E = g.slice();
  for (let i = 1; i < E.length; i++) E[i] = Math.min(E[i], E[i - 1] + gl[i] * seg[i]);
  for (let i = E.length - 2; i >= 0; i--) E[i] = Math.min(E[i], E[i + 1] + gl[i + 1] * seg[i + 1]);
  // Both are grade-feasible, and the max of two grade-feasible profiles is grade-feasible, so the
  // answer is grade-feasible AND >= L AND as close to the ground as those two things permit.
  //
  // Taking D(L) alone — which is what the first cut of this rewrite did — puts the road exactly
  // MAX_CUT_M below the ground wherever the ground is flat, because the cut bound IS the binding
  // constraint there. That drove a 3 m trench through the middle of all eight settlements and
  // failed M1-SETTLEMENT-FLAT at 23 degrees. A road on level ground sits on the level ground.
  const y = D.map((v, i) => Math.max(v, E[i]));
  // Two light smoothing passes that may only LOWER fill and may never break a bound, so the deck
  // reads as an engineered profile rather than as the max of two step functions.
  for (let k = 0; k < 3; k++) {
    for (let i = 1; i < y.length - 1; i++) {
      const sm = (y[i - 1] + 2 * y[i] + y[i + 1]) / 4;
      if (sm >= L[i] && sm <= y[i]) y[i] = sm;
    }
    // Smoothing lowers points, and lowering a point can STEEPEN the two segments either side of
    // it. Re-dilate after every pass so the grade limit is the last word, not the first: the
    // round-2 defect was exactly a constraint applied and then overridden.
    for (let i = 1; i < y.length; i++) y[i] = Math.max(y[i], y[i - 1] - gl[i] * seg[i]);
    for (let i = y.length - 2; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - gl[i + 1] * seg[i + 1]);
  }

  // ---- what it cost -------------------------------------------------------------------------
  const spans = [];
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + seg[i]);
  let start = -1, maxCut = 0, maxFill = 0, spanM = 0, maxGrade = 0;
  const exceptions = [];
  for (let i = 0; i < y.length; i++) {
    if (i > 0) {
      const gr = Math.abs(y[i] - y[i - 1]) / seg[i];
      if (gr > maxGrade) maxGrade = gr;
      if (gr > MAX_GRADE + 1e-3) {
        exceptions.push({ i, from_m: +cum[i - 1].toFixed(0), to_m: +cum[i].toFixed(0),
          grade: +gr.toFixed(3), deg: +(Math.atan(gr) * 180 / Math.PI).toFixed(1),
          natural_grade: +(Math.abs(gmax[i] - gmax[i - 1]) / seg[i]).toFixed(3),
          class: gr > 0.22 ? 'stair' : 'switchback' });
      }
    }
    maxCut = Math.max(maxCut, gmax[i] - y[i]);
    maxFill = Math.max(maxFill, y[i] - g[i]);
    const isDeck = y[i] - g[i] > DECK_M;
    if (isDeck && start < 0) start = i;
    if ((!isDeck || i === y.length - 1) && start >= 0) {
      const end = isDeck ? i : i - 1;
      let h = 0, wet = 0;
      for (let k = start; k <= end; k++) { h = Math.max(h, y[k] - g[k]); if (hw[k] !== null) wet++; }
      const Lm = cum[end] - cum[start];
      if (Lm >= 12) {
        spans.push({ from_i: start, to_i: end, from_m: +cum[start].toFixed(0), to_m: +cum[end].toFixed(0),
          length_m: +Lm.toFixed(0), max_height_m: +h.toFixed(1),
          kind: wet > (end - start) / 2 ? 'causeway over water' : 'viaduct' });
        spanM += Lm;
      }
      start = -1;
    }
  }
  // How many metres of this leg are ordinary carriageway, switchback and stair. A single number
  // for "max grade" hides whether the exception is 12 m of stair or half the leg.
  const cls = { carriageway: 0, switchback: 0, stair: 0 };
  for (let i = 1; i < y.length; i++) {
    const gr = Math.abs(y[i] - y[i - 1]) / seg[i];
    cls[gr <= MAX_GRADE + 1e-3 ? 'carriageway' : gr > 0.22 ? 'stair' : 'switchback'] += seg[i];
  }
  for (const k of Object.keys(cls)) cls[k] = +cls[k].toFixed(0);
  return { y, max_cut: +maxCut.toFixed(2), max_fill: +maxFill.toFixed(2), spans, span_m: +spanM.toFixed(0),
    grade_exceptions: exceptions, max_grade: +maxGrade.toFixed(3), grade_class_m: cls };
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

// ---- the gates -----------------------------------------------------------------------------
// Where a settlement's own declared position stands inside one of its own buildings, the road
// cannot end there. Solved ONCE per settlement, so every leg arriving at that town arrives at the
// same gate and `walkRoute`'s concatenation of two legs stays continuous. On the shipped tree this
// moves exactly one terminus — Thorn's — and leaves the other seven alone.
const GATES = {};
if (JOIN_ON) {
  for (const [name, s] of Object.entries(S)) {
    const town = TOWNS.find((t) => t.id === name.toLowerCase());
    if (!town) continue;
    const gate = gateFor(town, s.x, s.z, BUILD_CLEAR_M + 0.4);
    if (gate) { GATES[name] = gate; process.stdout.write(`JOIN: ${name}'s centre is inside a building; the road's terminus is a gate ${gate.moved_m} m away at (${gate.x}, ${gate.z})\n`); }
  }
}
const endAt = (name) => (GATES[name] ? [GATES[name].x, GATES[name].z] : [S[name].x, S[name].z]);

const routes = [];
for (const leg of scale.roads) {
  // The sinuosity solve is applied PER SUB-SEGMENT (settlement to minor to minor to settlement),
  // not across the whole leg. Solving it across the leg pushed the road up to 200 m sideways and
  // left the minor settlements that justify the leg's shape stranded off it — which is M5's
  // habitation-gap failure wearing a different hat.
  const way = [endAt(leg.from), ...minorsFor(leg.from, leg.to).map((m) => [m.x, m.z]), endAt(leg.to)];
  const chords = [];
  for (let i = 0; i + 1 < way.length; i++) chords.push(Math.hypot(way[i + 1][0] - way[i][0], way[i + 1][1] - way[i][1]));
  const chordSum = chords.reduce((a, b) => a + b, 0);
  const modes = [];
  let p = [];
  ALLOW_WATER = /tideway/i.test(leg.class);
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
      // The lateral solve saturates where `admissible` refuses the displacement, so it is run in
      // up to four passes at different phases: each pass adds what the ground it is offered will
      // take. That is what holds the built length on RI-WLD01 §4's number without ever putting a
      // metre of road somewhere a road cannot go.
      const amps = [];
      for (let pass = 0; pass < 4 && len2d(sp) < tgt - 0.5; pass++) {
        const ph = 0.11 + i * 0.19 + pass * 0.37;
        let a = 0, b = 400;
        for (let it = 0; it < 30; it++) { const m = (a + b) / 2; if (len2d(wiggle(sp, m, ph)) < tgt) a = m; else b = m; }
        if ((a + b) / 2 < 0.5) break;
        sp = wiggle(sp, (a + b) / 2, ph);
        amps.push(Math.round((a + b) / 2));
      }
      amount = amps[0] || 0;
      mode = `detour w=${lo.toFixed(2)} + sinuosity ${amps.join('+') || 0} m`;
    }
    modes.push(mode);
    for (let k = (p.length ? 1 : 0); k < sp.length; k++) p.push(sp[k]);
  }
  const mode = modes.join(' | ');
  const amount = 0;
  p = resample(p, 12);

  // ---- THE JOIN, applied ---------------------------------------------------------------------
  // Last, and on the finished polyline, on purpose. The length solve above is a bisection over the
  // whole leg and re-running it after every re-cut would fight the re-cut for the same metres. The
  // town portion of a leg is a few hundred metres of several thousand, so what the re-cut costs in
  // declared-length error is small, measured, and reported per leg as `join_delta_m` rather than
  // hidden — see the table this tool prints and `reports/w1-road-join/leg-lengths.json`.
  const legId = `${leg.from}-${leg.to}`.toLowerCase();
  const preJoinLen = len2d(p);
  const threaded = threadSettlements(p, legId);
  p = threaded.p;
  // The metres the re-cut spent or saved, put back outside the towns, so `RI-WLD01` §4's traversal
  // budget survives the join. Then AUDITED AGAIN — the correction moves points, and a 12 m chord
  // between two points that each clear a wall can still clip its corner. If the correction has
  // put the road back into a building the leg is re-threaded and the length error is reported
  // instead of being paid for with a wall.
  //
  // The retreat is deliberate. An earlier cut of this re-threaded the corrected polyline instead,
  // and re-threading a leg whose corridor has just been bent 60 m sideways made `Helstrom-Gideon`
  // 19% long — the join's leash faithfully followed a corridor that was no longer the road. When
  // the correction cannot be had cleanly, the correct outcome is a leg that is slightly short and
  // has no wall in it, so the deficit is halved and retried, and abandoned if it never comes clean.
  const threadedP = p.map((q) => q.slice());
  let corr = { p: threadedP, corrected_m: 0, spans: 0, abandoned: true };
  let audit = joinAudit(p);
  for (let attempt = 0, share = 1; attempt < 5; attempt++, share /= 2) {
    const want = len2d(threadedP) + (leg.path_m - len2d(threadedP)) * share;
    const c = correctLength(threadedP, want, legId);
    const a = joinAudit(c.p);
    if (a.violations) continue;
    corr = { ...c, share: +share.toFixed(4), attempts: attempt + 1 };
    p = c.p; audit = a;
    break;
  }
  if (corr.abandoned) process.stderr.write(`JOIN: no clean length correction for ${legId}; keeping the threaded route and its length error\n`);
  delete corr.p;

  const tideway = /tideway/i.test(leg.class);
  routes.push({ leg, p, mode, tideway, recuts: threaded.recuts, audit, corr,
    preJoin_m: +preJoinLen.toFixed(1), join_delta_m: +(len2d(p) - preJoinLen).toFixed(1),
    halfWidth: tideway ? 3.0 : leg.class === 'Imperial road' || leg.class === 'stone road' ? 3.6 : 3.0 });
}

// ---- the deck repair loop --------------------------------------------------------------------
// The deck solve reasons about the field WITHOUT the roads in it, and `field._applyRoads` then
// blends the ground toward the deck — so the ground the player actually stands on is only known
// once the roads are attached. Solve, attach, MEASURE, raise where it is still wet, repeat. The
// loop is the proof: it exits only when the built ground along every centreline, at every one of
// the four tide phases, is dry (or, on the tideway, exactly as deep as RI-WLD10 M54 declares).
const legs = [];
{
  const decks = routes.map((r) => solveDeck(r.p, r.tideway, r.halfWidth));
  const floors = routes.map((r) => new Float64Array(r.p.length).fill(-Infinity));
  let wet = 0;
  for (let pass = 0; pass < 6; pass++) {
    const probe = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
    probe.setRoads({ legs: routes.map((r, k) => ({ points: r.p.map((q, i) => [q[0], q[1], decks[k].y[i]]), half_width_m: r.halfWidth, id: r.leg.from })) });
    wet = 0;
    for (let k = 0; k < routes.length; k++) {
      if (routes[k].tideway) continue;
      const p = routes[k].p;
      for (let i = 1; i < p.length; i++) {
        const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        const n = Math.max(1, Math.ceil(seg / 2));
        for (let q = 0; q <= n; q++) {
          const t = q / n;
          const x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, z = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
          let d = 0;
          for (const ph of TIDE_PHASES) d = Math.max(d, probe.depthAt(x, z, ph));
          if (d <= 0.001) continue;
          wet++;
          const want = probe.heightAt(x, z) + d + CLEAR_M;
          for (const j of [i - 1, i]) if (want > floors[k][j]) floors[k][j] = want;
        }
      }
    }
    if (!wet) break;
    for (let k = 0; k < routes.length; k++) decks[k] = solveDeck(routes[k].p, routes[k].tideway, routes[k].halfWidth, floors[k]);
  }
  if (wet) process.stderr.write(`WARNING: deck repair did not converge; ${wet} wet corridor samples remain\n`);
  routes.forEach((r, k) => {
    const { leg, p, mode, tideway, halfWidth, recuts, audit } = r;
    const deck = decks[k], y = deck.y;
    let maxGrade = 0;
    for (let i = 1; i < y.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) || 1;
      maxGrade = Math.max(maxGrade, Math.abs(y[i] - y[i - 1]) / d);
    }
    const built = len2d(p);
    legs.push({
      id: `${leg.from}-${leg.to}`.toLowerCase(), from: leg.from, to: leg.to, class: leg.class,
      tide_gated: tideway,
      straight_m: leg.straight_m, declared_path_m: leg.path_m, built_path_m: +built.toFixed(1),
      declared_walk_min: leg.walk_min, built_walk_min: +(built / 2.0 / 60).toFixed(2),
      sinuosity_built: +(built / Math.hypot(S[leg.to].x - S[leg.from].x, S[leg.to].z - S[leg.from].z)).toFixed(3),
      routing: mode,
      max_grade: +maxGrade.toFixed(3),
      grade_bar: MAX_GRADE, stair_grade_bar: STAIR_GRADE,
      grade_exceptions: deck.grade_exceptions,
      grade_class_m: deck.grade_class_m,
      max_cut_m: deck.max_cut, max_fill_m: deck.max_fill,
      cut_sampled_at_m: CUT_SAMPLE_M,
      deck_spans: deck.spans, deck_span_m: deck.span_m,
      half_width_m: halfWidth,
      // ---- the join, declared on the leg -------------------------------------------------------
      // A reader of roads.json can see that this leg was cut against the settlement plan, which
      // town it was cut through, what that cost in metres, and how near a wall the finished
      // centreline ever comes. A join nobody can audit off the artifact is a join on trust.
      settlement_join: JOIN_ON ? {
        clearance_bar_m: BUILD_CLEAR_M,
        worst_clearance_m: audit.worst_clearance_m,
        violations: audit.violations,
        pre_join_m: r.preJoin_m, join_delta_m: r.join_delta_m,
        length_correction: r.corr,
        recuts,
        road_anchor: [leg.from, leg.to].filter((n) => GATES[n]).map((n) => ({ settlement: n, ...GATES[n] })),
      } : { disabled: true, reason: '--no-join: routed over terrain with the settlement plan unread' },
      waypoints: minorsFor(leg.from, leg.to).map((m) => m.name),
      points: p.map((q, i) => [+q[0].toFixed(2), +q[1].toFixed(2), +y[i].toFixed(2)]),
    });
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
  // W1-05. The leg ids are RESOLVED against the built legs, not composed from the settlement
  // names. Composing them assumed the leg was authored in the same direction the route walks it,
  // and for THE LONG WAY it was not: the route starts Thorn -> Stormhold and the leg is
  // `stormhold-thorn`, so `long_way.legs[0]` was `thorn-stormhold` and resolved to nothing.
  // Nothing broke, because `Engine.walkRoute` resolves legs by SETTLEMENT PAIR and never reads
  // this array — which is exactly why it sat there wrong. `build-hearths.mjs` DOES walk
  // `named_routes.crossing.legs` by id, and only escaped because the crossing happens to be
  // authored in its walking direction. A field that is right by luck is a trap set for whoever
  // reads it next.
  const legIds = [];
  for (let i = 0; i + 1 < names.length; i++) {
    const a = names[i], b = names[i + 1];
    const leg = legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
    if (!leg) throw new Error(`routeOf: no built leg between ${a} and ${b}`);
    legIds.push(leg.id);
  }
  return { settlements: names, legs: legIds, metres: +m.toFixed(1), walk_min: +(m / 2 / 60).toFixed(2), jog_min: +(m / 3.2 / 60).toFixed(2) };
};

const doc = {
  schema: 'elder-souls/roads@1',
  generator: 'tools/world/build-roads.mjs',
  note: 'The Rootway. Endpoints, class and path length are RI-WLD01 §4; the ROUTE between them is '
      + 'A* over the built terrain, so the road goes round the ridge and crosses at the narrows. '
      + 'Each leg carries its own elevation profile and the game blends the ground to it, which is '
      + 'what makes a causeway a causeway instead of a decal on a marsh.',
  // W1-ROAD-JOIN. The one line a reader needs to know that this file was produced by a generator
  // that had SEEN the settlement plan. Without it, ten of ten legs went through somebody's house.
  settlement_join: JOIN_ON ? {
    performed: true,
    rule: 'roads yield; buildings never move (ARBITRATION S28)',
    reads: 'game/src/render/exterior.js planSettlement(), over game/data/world/settlements/*.json '
         + 'and game/data/world/interiors/*.json — the same function game/src/world/province.js '
         + 'builds the collision walls from',
    footprints: 'the union of planSettlement(doc, interiors) and planSettlement(doc, {}) — they '
              + 'differ for 114 of 202 buildings and the game uses the former',
    clearance_bar_m: BUILD_CLEAR_M, preferred_clearance_m: BUILD_ROOM_M, grid_m: FINE_CELL_M,
    buildings_considered: ALL_OBSTACLES.length,
    worst_clearance_m: Math.min(...legs.map((l) => l.settlement_join.worst_clearance_m)),
    violations: legs.reduce((n, l) => n + l.settlement_join.violations, 0),
    gates: Object.entries(GATES).map(([k, v]) => ({ settlement: k, ...v })),
  } : { performed: false, reason: '--no-join' },
  speeds_mps: scale.scale.speeds_mps,
  legs,
  waystations,
  named_routes: {
    crossing: { ...routeOf(CROSSING), note: 'RI-WLD01 §5 THE CROSSING — Stormhold south gate to Lilmoth harbour steps.' },
    long_way: { ...routeOf(LONG), note: 'RI-WLD01 §5 THE LONG WAY — Thorn to Soulrest.' },
  },
  total_trunk_m: +legs.reduce((s, l) => s + l.built_path_m, 0).toFixed(1),
};
// `--out` exists so the delete-the-fix arm and the consumption perturbation can build a road
// network WITHOUT overwriting the one the rest of the tree is standing on.
const OUT = argOf('--out', 'game/data/world/roads.json');
writeFileSync(join(ROOT, OUT), JSON.stringify(doc, null, 1) + '\n');

process.stdout.write(`leg                       decl m   built m    err%    sinu(decl)  grade    cut   fill  spans\n`);
for (const l of legs) {
  const decl = scale.roads.find((r) => `${r.from}-${r.to}`.toLowerCase() === l.id).sinuosity;
  process.stdout.write(`${(l.from + ' -> ' + l.to).padEnd(24)} ${String(l.declared_path_m).padStart(6)} ${String(l.built_path_m).padStart(9)} `
    + `${((l.built_path_m / l.declared_path_m - 1) * 100).toFixed(2).padStart(7)}  ${l.sinuosity_built.toFixed(3)} (${decl.toFixed(2)})  `
    + `${l.max_grade.toFixed(2).padStart(5)}  ${l.max_cut_m.toFixed(1).padStart(5)}  ${l.max_fill_m.toFixed(1).padStart(5)}  `
    + `${l.deck_spans.length} spans / ${l.deck_span_m} m\n`);
}
// ---- THE JOIN, as a table ----------------------------------------------------------------------
// The design constraint the whole join is subject to: the province takes about an hour to cross on
// foot, so a re-cut that turns a 6,816 m leg into a 12 km one is a failure even if every wall is
// cleared. This is the number that says whether that happened.
if (JOIN_ON) {
  process.stdout.write(`\nTHE JOIN — the road re-cut against ${ALL_OBSTACLES.length} building footprints in ${TOWNS.length} towns\n`);
  process.stdout.write(`leg                       before m    after m    delta   delta%   worst clear m   towns re-cut\n`);
  for (const l of legs) {
    const j = l.settlement_join;
    process.stdout.write(`${(l.from + ' -> ' + l.to).padEnd(24)} ${String(j.pre_join_m).padStart(9)} ${String(l.built_path_m).padStart(10)} `
      + `${(j.join_delta_m >= 0 ? '+' : '') + j.join_delta_m.toFixed(1)}`.padStart(9)
      + `${(j.join_delta_m / j.pre_join_m * 100).toFixed(2) + '%'}`.padStart(9)
      + `${String(j.worst_clearance_m).padStart(14)}   ${j.recuts.filter((r) => r.ok).map((r) => r.town).join(', ') || '-'}\n`);
  }
  const viol = legs.reduce((n, l) => n + l.settlement_join.violations, 0);
  process.stdout.write(`worst clearance anywhere on the network: ${Math.min(...legs.map((l) => l.settlement_join.worst_clearance_m)).toFixed(2)} m `
    + `(bar ${BUILD_CLEAR_M} m) — ${viol} sample(s) below the bar\n`);
  if (viol) process.stderr.write(`JOIN FAILED: ${viol} road samples are still inside the clearance bar\n`);
} else {
  process.stdout.write(`\nTHE JOIN IS OFF (--no-join). The settlement plan was not read. This is the delete-the-fix arm.\n`);
}

process.stdout.write(`\nwaystations ${waystations.length} inserted to hold every habitation gap under 8 walking minutes\n`);
process.stdout.write(`trunk network ${doc.total_trunk_m} m (RI-WLD01: 25,331 m)\n`);
process.stdout.write(`THE CROSSING  ${doc.named_routes.crossing.metres} m = ${doc.named_routes.crossing.walk_min} min walk (RI-WLD01: 6,909 m / 57.6 min)\n`);
process.stdout.write(`THE LONG WAY  ${doc.named_routes.long_way.metres} m = ${doc.named_routes.long_way.walk_min} min walk (RI-WLD01: 9,477 m / 79.0 min)\n`);
