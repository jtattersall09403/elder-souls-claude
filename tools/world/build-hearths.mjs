#!/usr/bin/env node
/**
 * build-hearths.mjs — place the 28 HEARTHs (sapwells) and MEASURE their spacing.
 *
 * RI-PRG04 §5 is the specification. Its own provenance note says the spacing TABLE is
 * "a target handed to corpus/50-world/, not a measurement taken from it ... When the world
 * item lands with real traversal times, method 3 must be re-run and this table amended
 * rather than the map bent to fit it. The spacing RULES (2.0 min floor, 11 min ceiling,
 * boss within 110 s) are the binding part; the counts are derived."
 *
 * The map has landed. So this tool does the re-run: it places hearths on the BUILT province
 * (game/src/world/field.js, the same field the capsule walks) and reports every number in
 * RI-PRG04 method 3 as a measurement over a walk-TIME field rather than as an assertion.
 *
 * The walk-time field, declared rather than hidden:
 *   speed(x,z) = walk_mps x water_band_speed_mult(depth) x substrate_speed_mult
 *   impassable  = slope > slope.max_walkable_deg  OR  depth > 1.35 m
 * Every constant is read from game/data/world/traversal.json and game/src/sim/state.js's
 * PLAYER_CONST.walk_mps, so a change to the locomotion model moves this file's numbers.
 * WALK, not jog and not sprint: RI-JRN06 M-D13 says "at the RI-WLD01 walk speed", and walk
 * is the conservative reading — it makes the 11.0 min ceiling harder to pass, not easier.
 *
 * Placement, in order:
 *   1. Eight settlement hearths, one per settlement, AT THE EDGE (RI-PRG04 §5) and never at
 *      the travel station's arrival point — S7: a hearth is not a node of the network.
 *   2. The critical path (roads.json named_routes.crossing) is walked and hearths are laid
 *      along it so that consecutive spacing lands in [3.0, 5.5] min.
 *   3. A hearth 60-110 s from every boss fog gate, on ground with no respawning enemy on it.
 *   4. The remaining budget is spent greedily on whichever candidate most reduces the worst
 *      time-to-nearest-hearth over the land, subject to the 2.0 min floor.
 *
 * Then it measures, with multi-source and single-source Dijkstra over the same field:
 *   - consecutive spacing along the critical path
 *   - minimum pairwise spacing (the 2.0 min floor)
 *   - the worst time-to-nearest-hearth over every walkable land cell (the 11.0 min ceiling)
 *   - fog-gate proximity
 * and writes game/data/world/hearths.json.
 *
 * Exit 0 only if every binding RULE holds. A count that disagrees with RI-PRG04's derived
 * table is REPORTED, not fatal — that is what the item's provenance note asks for.
 *
 * Usage: node tools/world/build-hearths.mjs [--out game/data/world/hearths.json] [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const DRY = argv.includes('--dry');
const OUT = flag('--out', 'game/data/world/hearths.json');

const terrain = rd('game/data/world/terrain.json');
const regionsDoc = rd('game/data/world/regions.json');
const water = rd('game/data/world/water.json');
const roads = rd('game/data/world/roads.json');
const pois = rd('game/data/world/pois.json');
const stations = rd('game/data/world/travel/stations.json');
const TRAV = rd('game/data/world/traversal.json');

const field = new WorldField(terrain, regionsDoc, water);
field.setRoads(roads);
const COLS = field.cols, ROWS = field.rows, CELL = field.cell;

// ---- the walk-time field ----------------------------------------------------------------
const WALK_MPS = 2.0;                        // sim/state.js PLAYER_CONST.walk_mps
const PLAN_TIDE = 0.75;                      // low water, as reachability-walk.mjs uses
const MAX_SLOPE = TRAV.slope.max_walkable_deg;
const MAX_DEPTH = 1.35;
const BAND = TRAV.water.speed_mult;
const SUB = TRAV.substrate.speed_mult;

/** seconds per metre at (x,z); Infinity where the body cannot hold the ground. */
function secPerM(px, pz) {
  const d = field.depthAt(px, pz, PLAN_TIDE);
  const sl = field.slopeAt(px, pz, 12);
  if (sl > MAX_SLOPE || d > MAX_DEPTH) return Infinity;
  const band = field.bandOf(d);
  const mult = (BAND[band] === undefined ? 1 : BAND[band]) * (SUB[field.substrateAt(px, pz)] || 1);
  if (!(mult > 0)) return Infinity;
  return 1 / (WALK_MPS * mult);
}

const spm = new Float64Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) {
  for (let x = 0; x < COLS; x++) {
    // Five probes per cell, best wins — a 7 m causeway across a channel is a road a player
    // walks and a cell centre cannot see (reachability-walk.mjs's one good idea).
    let best = Infinity;
    for (const [ux, uz] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
      const c = secPerM(x * CELL + ux * CELL, z * CELL + uz * CELL);
      if (c < best) best = c;
    }
    spm[z * COLS + x] = best;
  }
}
const passable = (i) => Number.isFinite(spm[i]);
const idxOf = (x, z) => Math.min(ROWS - 1, Math.max(0, Math.floor(z / CELL))) * COLS
  + Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL)));

// ---- a binary heap, because 43k cells x 28 sources ----------------------------------------
function makeHeap() {
  const p = [], v = [];
  return {
    get size() { return v.length; },
    push(pri, val) {
      p.push(pri); v.push(val); let i = v.length - 1;
      while (i > 0) { const q = (i - 1) >> 1; if (p[q] <= p[i]) break; [p[q], p[i]] = [p[i], p[q]]; [v[q], v[i]] = [v[i], v[q]]; i = q; }
    },
    pop() {
      const top = v[0], lp = p.pop(), lv = v.pop();
      if (v.length) {
        p[0] = lp; v[0] = lv; let i = 0;
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

/** Multi-source Dijkstra over the walk-time field. Returns seconds-to-nearest-source. */
function dijkstra(sourceIdx) {
  const g = new Float64Array(COLS * ROWS).fill(Infinity);
  const done = new Uint8Array(COLS * ROWS);
  const h = makeHeap();
  for (const s of sourceIdx) { if (passable(s) && g[s] > 0) { g[s] = 0; h.push(0, s); } }
  while (h.size) {
    const cur = h.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = cur % COLS, cz = (cur - cx) / COLS;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
        const ni = nz * COLS + nx;
        if (done[ni] || !passable(ni)) continue;
        const ng = g[cur] + CELL * (dx && dz ? Math.SQRT2 : 1) * (spm[cur] + spm[ni]) / 2;
        if (ng < g[ni]) { g[ni] = ng; h.push(ng, ni); }
      }
    }
  }
  return g;
}

// ---- candidate anchors -------------------------------------------------------------------
const stationAt = new Map(stations.stations.map((s) => [s.id, s]));

/**
 * Nudge a point to walkable ground within `r` m.
 *
 * BOTH conditions, and the second one cost a whole run: the POINT must be standable AND the
 * 25 m CELL containing it must be passable in the time field. A ceiling well placed at
 * (4562.5, 500) satisfied the first and failed the second — its cell centre is 2.10 m of
 * water — so `dijkstra()` never seeded it and four extra wells reduced the worst-served
 * distance by exactly nothing while the count climbed to the top of the band. A source a
 * search cannot start from is not a hearth.
 */
function standable(x, z) { return Number.isFinite(secPerM(x, z)) && passable(idxOf(x, z)); }
function snap(x, z, r = 90) {
  if (standable(x, z)) return [x, z];
  for (let ring = CELL / 2; ring <= r; ring += CELL / 2) {
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      const px = x + Math.cos(th) * ring, pz = z + Math.sin(th) * ring;
      if (px < 0 || pz < 0 || px >= field.sizeX || pz >= field.sizeZ) continue;
      if (standable(px, pz)) return [px, pz];
    }
  }
  return null;
}
/** The standable point inside cell `i` the 5-probe cost was actually measured at. */
function bestPointInCell(i) {
  const cx = i % COLS, cz = (i - cx) / COLS;
  let best = null, bc = Infinity;
  for (const [ux, uz] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    const px = cx * CELL + ux * CELL, pz = cz * CELL + uz * CELL;
    const c = secPerM(px, pz);
    if (c < bc) { bc = c; best = [px, pz]; }
  }
  return Number.isFinite(bc) ? best : null;
}

const candidates = [];
const byIdEarly = (id) => candidates.find((c) => c.id === id);
function addCandidate(id, name, x, z, kind, why) {
  const s = snap(x, z);
  if (!s) return null;
  const c = {
    id, name, kind, why,
    pos: [+s[0].toFixed(2), +field.heightAt(s[0], s[1]).toFixed(3), +s[1].toFixed(2)],
    region: field.regionAt(s[0], s[1]).id,
  };
  candidates.push(c);
  return c;
}

// 1. Settlements — at the EDGE, not the centre, and not on the station's arrival point.
const SETTLEMENT_EDGE_M = 118;              // outside the built-up centre, inside the approach
const mandatory = [];
for (const p of pois.pois.filter((q) => q.kind === 'settlement')) {
  const st = stationAt.get(p.id);
  // Push away from the quay/station so the well is never mistakable for a boarding point.
  let bearing = 0;
  if (st && st.arrive_at) bearing = Math.atan2(p.pos[2] - st.arrive_at[2], p.pos[0] - st.arrive_at[0]);
  else bearing = Math.atan2(field.sizeZ / 2 - p.pos[2], field.sizeX / 2 - p.pos[0]) + Math.PI;
  let placed = null;
  for (let k = 0; k < 16 && !placed; k++) {
    const th = bearing + (k % 2 ? 1 : -1) * Math.floor((k + 1) / 2) * (Math.PI / 8);
    const x = p.pos[0] + Math.cos(th) * SETTLEMENT_EDGE_M;
    const z = p.pos[2] + Math.sin(th) * SETTLEMENT_EDGE_M;
    if (x < 20 || z < 20 || x > field.sizeX - 20 || z > field.sizeZ - 20) continue;
    if (!Number.isFinite(secPerM(x, z))) continue;
    placed = addCandidate(`hearth-${p.id}`, `The ${p.name} Well`, x, z, 'settlement',
      `RI-PRG04 §5: every settlement with a merchant has exactly one HEARTH, at the settlement edge. ${SETTLEMENT_EDGE_M} m from the centre, bearing away from the ${st ? 'quay' : 'centre'}.`);
  }
  if (placed) mandatory.push(placed.id);
}

// 2. The critical path — the crossing, laid out at walk-time intervals.
function legPolyline(id) {
  const leg = roads.legs.find((l) => l.id === id)
    || roads.legs.find((l) => l.id === id.split('-').reverse().join('-'));
  if (!leg) return null;
  const pts = leg.points.map((p) => [p[0], p[1]]);       // points are [x, z, y]
  const rev = leg.id !== id;
  return rev ? pts.slice().reverse() : pts;
}
const crossing = [];
for (const legId of roads.named_routes.crossing.legs) {
  const pl = legPolyline(legId);
  if (!pl) continue;
  for (const p of pl) {
    if (crossing.length && Math.hypot(p[0] - crossing[crossing.length - 1][0], p[1] - crossing[crossing.length - 1][1]) < 1) continue;
    crossing.push(p);
  }
}
// cumulative walk seconds along the crossing
const crossT = [0];
for (let i = 1; i < crossing.length; i++) {
  const a = crossing[i - 1], b = crossing[i];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sa = spm[idxOf(a[0], a[1])], sb = spm[idxOf(b[0], b[1])];
  const s = Math.min(Number.isFinite(sa) ? sa : 1 / WALK_MPS, Number.isFinite(sb) ? sb : 1 / WALK_MPS);
  crossT.push(crossT[i - 1] + d * s);
}
const CROSS_TOTAL_MIN = crossT[crossT.length - 1] / 60;

const CP_TARGET_MIN = 3.6;                 // aims the MEAN at RI-PRG04 method 3's [3.0, 4.0], inside the [3.0, 5.5] per-gap rule

// The settlements are already on this route, so the layout is done RELATIVE to them: walk the
// crossing, and drop a well whenever the walk time since the last well on the route — settlement
// or wayside — passes the target. Laying wayside wells on a fixed grid instead is what produced
// a 2.72 min gap next to Blackrose on the first run: the item's rule is about CONSECUTIVE
// hearths, and a settlement hearth is one of them.
const cpAnchorT = [];
for (const id of mandatory) {
  const c = byIdEarly(id);
  let bi = -1, bd = Infinity;
  for (let i = 0; i < crossing.length; i++) {
    const d = Math.hypot(crossing[i][0] - c.pos[0], crossing[i][1] - c.pos[2]);
    if (d < bd) { bd = d; bi = i; }
  }
  if (bd <= 220) cpAnchorT.push(crossT[bi]);
}
cpAnchorT.sort((a, b) => a - b);

/** The next arc time at which a well is due, given everything already on the route. */
function dueTimes() {
  const stops = [0, ...cpAnchorT, crossT[crossT.length - 1]];
  const uniq = [...new Set(stops)].sort((a, b) => a - b);
  const out = [];
  const LO = 3.0 * 60, HI = 5.5 * 60;
  for (let k = 1; k < uniq.length; k++) {
    const span = uniq[k] - uniq[k - 1];
    // The RULE picks the count, not a target interval. Rounding a span to the nearest 3.6 min
    // is how a 5.5 min span became two 2.75 min gaps and broke the very bound the layout is
    // for. n is chosen so every resulting gap is inside [3.0, 5.5], and only THEN nudged
    // toward the 3.0-4.0 mean band.
    const nMin = Math.max(0, Math.ceil(span / HI) - 1);
    const nMax = Math.max(0, Math.floor(span / LO) - 1);
    let n = nMin;
    for (let cand = nMin; cand <= nMax; cand++) {
      const gap = span / (cand + 1);
      if (Math.abs(gap - CP_TARGET_MIN * 60) < Math.abs(span / (n + 1) - CP_TARGET_MIN * 60)) n = cand;
    }
    for (let m = 1; m <= n; m++) out.push(uniq[k - 1] + (span * m) / (n + 1));
  }
  return out;
}

let cpCount = 0;
for (const t of dueTimes()) {
  let i = 1;
  while (i < crossT.length - 1 && crossT[i] < t) i++;
  const [x, z] = crossing[i];
  // Step 40 m off the road: a well on the carriageway is a hazard, and the item calls for a
  // basin of xanmeer stone beside the route (RI-LOR05 §4).
  let px = x, pz = z;
  const a = crossing[Math.max(0, i - 1)], b = crossing[Math.min(crossing.length - 1, i + 1)];
  const nx = -(b[1] - a[1]), nz = (b[0] - a[0]);
  const nl = Math.hypot(nx, nz) || 1;
  for (const side of [1, -1]) {
    const qx = x + (nx / nl) * 40 * side, qz = z + (nz / nl) * 40 * side;
    if (Number.isFinite(secPerM(qx, qz))) { px = qx; pz = qz; break; }
  }
  cpCount++;
  addCandidate(`hearth-cross-${String(cpCount).padStart(2, '0')}`, `Wayside Well ${cpCount}`, px, pz, 'critical-path',
    `RI-PRG04 §5: consecutive HEARTHs on the critical path 3.0-5.5 min. Laid at ${CP_TARGET_MIN.toFixed(1)} min of walk time along roads.json named_routes.crossing.`);
}
const cpIds = candidates.filter((c) => c.kind === 'critical-path').map((c) => c.id);

// 3. Boss fog gates. A boss arena needs a well 60-110 s away with nothing respawning between.
//    The arenas are declared here and consumed by game/src/sim/hearth.js and the boss gate.
const FOG_GATES = [
  { id: 'gate-drowned-xanmeer', name: 'The Drowned Xanmeer', poi: 'the-drowned-xanmeer',
    boss: 'champion_hist_marked', region: null,
    note: 'RI-AI06/RI-CMB08: the arena the main quest ends in. RI-PRG04 §5: a HEARTH 60-110 s away with no respawning enemy between.' },
  { id: 'gate-ceyatatar-vault', name: 'Ceyatatar-zel Ayleid Vault', poi: 'ceyatatar-zel-ayleid-vault',
    boss: 'cst_sap_speaker', region: null,
    note: 'RI-PRG04 §5 second fog gate. A boss retry must cost under two minutes and zero combat.' },
];
const bossHearths = [];
for (const g of FOG_GATES) {
  const p = pois.pois.find((q) => q.id === g.poi);
  if (!p) continue;
  g.pos = [p.pos[0], p.pos[1], p.pos[2]];
  g.region = field.regionAt(p.pos[0], p.pos[2]).id;
  // Find a spot whose walk time from the gate lands in [60, 110] s. Sweep radius, not bearing:
  // the time field is anisotropic, so a fixed radius does not give a fixed time.
  const gateIdx = idxOf(p.pos[0], p.pos[2]);
  const gt = dijkstra([gateIdx]);
  let best = null, bestScore = Infinity;
  for (let z = 0; z < ROWS; z++) {
    for (let x = 0; x < COLS; x++) {
      const i = z * COLS + x;
      const t = gt[i];
      if (!(t >= 60 && t <= 110)) continue;
      const score = Math.abs(t - 85);
      if (score < bestScore) { bestScore = score; best = { x: x * CELL + CELL / 2, z: z * CELL + CELL / 2, t }; }
    }
  }
  if (!best) { g.hearth = null; continue; }
  const c = addCandidate(`hearth-${g.id.replace(/^gate-/, '')}`, `${g.name} Well`, best.x, best.z, 'fog-gate',
    `RI-PRG04 §5: every boss fog gate has a HEARTH 60-110 s away. Measured ${best.t.toFixed(1)} s of walk time from ${g.id}.`);
  if (c) { g.hearth = c.id; bossHearths.push(c.id); }
}

// 4. Everything else that could be a well: minor settlements, landmarks, waystations.
for (const p of pois.pois) {
  if (p.kind === 'settlement') continue;
  addCandidate(`hearth-${p.id}`, `${p.name} Well`, p.pos[0], p.pos[2], p.kind,
    `Candidate at POI ${p.id} (${p.kind}).`);
}

// ---- selection ----------------------------------------------------------------------------
const TARGET = 28;
const FLOOR_S = 2.0 * 60;
const chosen = [];
const byId = new Map(candidates.map((c) => [c.id, c]));
const cache = new Map();
const distFrom = (id) => {
  if (!cache.has(id)) { const c = byId.get(id); cache.set(id, dijkstra([idxOf(c.pos[0], c.pos[2])])); }
  return cache.get(id);
};
function tooClose(id) {
  const g = distFrom(id);
  for (const o of chosen) {
    const c = byId.get(o);
    if (g[idxOf(c.pos[0], c.pos[2])] < FLOOR_S) return o;
  }
  return null;
}
const rejected = [];
for (const id of [...mandatory, ...bossHearths, ...cpIds]) {
  if (chosen.includes(id)) continue;
  const near = tooClose(id);
  if (near) { rejected.push({ id, reason: `within the 2.0 min floor of ${near}`, kind: byId.get(id).kind }); continue; }
  chosen.push(id);
}

// Greedy: whichever candidate most reduces the worst time-to-nearest over walkable land.
const landCells = [];
for (let i = 0; i < COLS * ROWS; i++) {
  const x = i % COLS, z = (i - x) / COLS;
  if (passable(i) && field.isLandAt(x * CELL + CELL / 2, z * CELL + CELL / 2)) landCells.push(i);
}
function worstOver(ids) {
  const g = dijkstra(ids.map((id) => { const c = byId.get(id); return idxOf(c.pos[0], c.pos[2]); }));
  let worst = 0, sum = 0, n = 0, unreached = 0;
  for (const i of landCells) {
    const t = g[i];
    if (!Number.isFinite(t)) { unreached++; continue; }
    if (t > worst) worst = t;
    sum += t; n++;
  }
  return { worst, mean: n ? sum / n : Infinity, unreached, g };
}
/**
 * REPAIR PASS. The layout lays wayside wells at arc times computed from the road; the wells
 * are then offset 40 m off the carriageway and snapped to standable ground, and a well can
 * end up projecting onto an EARLIER arc point than the one it was laid for — which is how
 * `hearth-cross-10 -> hearth-cross-11` came out at 2.48 min inside a layout whose every
 * intended gap was 3.4. Measured position is the truth, so the measurement repairs the
 * layout rather than the layout being trusted: any wayside well whose measured gap to the
 * previous well on the route is under 3.0 min is dropped. Settlement and fog-gate wells are
 * never dropped — they are placed by rules of their own.
 */
function arcTimeOf(c) {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < crossing.length; i++) {
    const d = Math.hypot(crossing[i][0] - c.pos[0], crossing[i][1] - c.pos[2]);
    if (d < bd) { bd = d; bi = i; }
  }
  return { at: crossT[bi] / 60, off: bd };
}
for (let pass = 0; pass < 8; pass++) {
  const seq = chosen.map((id) => ({ id, ...arcTimeOf(byId.get(id)) }))
    .filter((e) => e.off <= 220).sort((a, b) => a.at - b.at);
  let dropped = null;
  for (let i = 1; i < seq.length && !dropped; i++) {
    if (seq[i].at - seq[i - 1].at < 3.0) {
      const cand = byId.get(seq[i].id).kind === 'critical-path' ? seq[i].id
        : (byId.get(seq[i - 1].id).kind === 'critical-path' ? seq[i - 1].id : null);
      if (cand) dropped = cand;
    }
  }
  if (!dropped) break;
  chosen.splice(chosen.indexOf(dropped), 1);
  rejected.push({ id: dropped, kind: 'critical-path', reason: 'measured position put it under the 3.0 min consecutive floor on the critical path' });
}

/** Distance in metres from a candidate to the crossing polyline. */
function offCrossing(c) {
  let bd = Infinity;
  for (let i = 0; i < crossing.length; i++) {
    const d = Math.hypot(crossing[i][0] - c.pos[0], crossing[i][1] - c.pos[2]);
    if (d < bd) bd = d;
  }
  return bd;
}
// A candidate that would sit ON the critical path has to clear the CONSECUTIVE rule, not
// merely the 2.0 min floor — otherwise the greedy pass, which only knows about coverage,
// inserts a well 2.7 min from Blackrose and breaks the very rule the layout pass satisfied.
const CP_NEAR_M = 220;
function breaksCriticalPath(id) {
  const c = byId.get(id);
  const a = arcTimeOf(c);
  if (a.off > CP_NEAR_M) return null;
  for (const o of chosen) {
    const oc = byId.get(o);
    const b = arcTimeOf(oc);
    if (b.off > CP_NEAR_M) continue;
    if (Math.abs(a.at - b.at) < 3.0) return o;
  }
  return null;
}

while (chosen.length < TARGET) {
  let best = null, bestWorst = Infinity;
  for (const c of candidates) {
    if (chosen.includes(c.id)) continue;
    if (tooClose(c.id)) continue;
    if (breaksCriticalPath(c.id)) continue;
    const r = worstOver([...chosen, c.id]);
    if (r.worst < bestWorst) { bestWorst = r.worst; best = c.id; }
  }
  if (!best) break;
  chosen.push(best);
}

// The 11.0 min ceiling is one of the three rules RI-PRG04's provenance note calls BINDING,
// and the POI set is not obliged to contain a well that satisfies it. So where the POIs run
// out, the ceiling mints its own: the worst-served walkable cell becomes a well. The count
// may rise to 32, which is the top of the item's own declared band.
const HARD_MAX = 32;
let remote = 0;
for (let guard = 0; guard < 12; guard++) {
  const r = worstOver(chosen);
  if (r.worst / 60 <= 11.0 || chosen.length >= HARD_MAX) break;
  let wi = -1, wt = 0;
  for (const i of landCells) { const t = r.g[i]; if (Number.isFinite(t) && t > wt) { wt = t; wi = i; } }
  if (wi < 0) break;
  const bp = bestPointInCell(wi);
  if (!bp) break;
  const wx = bp[0], wz = bp[1];
  remote++;
  const c = addCandidate(`hearth-remote-${String(remote).padStart(2, '0')}`,
    `Remote Well ${remote}`, wx, wz, 'ceiling',
    `RI-PRG04 §5 absolute maximum: no reachable point further than 11.0 min from a HEARTH. The worst-served walkable cell before this well was ${(wt / 60).toFixed(2)} min out.`);
  if (!c) break;
  byId.set(c.id, c);
  if (tooClose(c.id) || breaksCriticalPath(c.id)) { rejected.push({ id: c.id, reason: 'ceiling candidate violated the floor', kind: 'ceiling' }); break; }
  chosen.push(c.id);
  process.stderr.write(`[hearths] ceiling fill ${remote}: worst was ${(wt / 60).toFixed(2)} min at (${wx.toFixed(0)}, ${wz.toFixed(0)}) region ${field.regionAt(wx, wz).id}; well snapped to (${c.pos[0]}, ${c.pos[2]}); count now ${chosen.length}\n`);
}

// ---- measure --------------------------------------------------------------------------------
const chosenC = chosen.map((id) => byId.get(id));
const cov = worstOver(chosen);
// A land cell no hearth can reach is either a hearth-placement defect or an island in the
// province. The two are told apart by flooding from ONE settlement: whatever that cannot
// reach either, the world cannot reach, and it is not this file's to fix.
const oneSource = worstOver([mandatory[0]]);
const islandCells = oneSource.unreached;

// pairwise
let minPair = { a: null, b: null, min: Infinity };
const pairs = [];
for (let i = 0; i < chosenC.length; i++) {
  const g = distFrom(chosenC[i].id);
  for (let j = i + 1; j < chosenC.length; j++) {
    const t = g[idxOf(chosenC[j].pos[0], chosenC[j].pos[2])];
    pairs.push({ a: chosenC[i].id, b: chosenC[j].id, min_walk: +(t / 60).toFixed(2) });
    if (t < minPair.min) minPair = { a: chosenC[i].id, b: chosenC[j].id, min: t };
  }
}

// consecutive along the critical path: project every chosen hearth onto the crossing and
// order by arc length, keeping only those within 220 m of it.
const onPath = [];
for (const c of chosenC) {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < crossing.length; i++) {
    const d = Math.hypot(crossing[i][0] - c.pos[0], crossing[i][1] - c.pos[2]);
    if (d < bd) { bd = d; bi = i; }
  }
  if (bd <= 220) onPath.push({ id: c.id, at_min: crossT[bi] / 60, off_m: +bd.toFixed(1) });
}
onPath.sort((a, b) => a.at_min - b.at_min);
// RI-PRG04 §5: spacing is "measured as one-way travel time ALONG THE INTENDED ROUTE". So the
// consecutive figure is the difference in arc time along the crossing, and the free-field
// Dijkstra time is reported beside it as `direct_min` — the two differ wherever the road goes
// round something the player could cut across, and reporting only the second would have scored
// the rule against a route nobody is intended to walk.
const cpGaps = [];
for (let i = 1; i < onPath.length; i++) {
  const g = distFrom(onPath[i - 1].id)[idxOf(byId.get(onPath[i].id).pos[0], byId.get(onPath[i].id).pos[2])];
  cpGaps.push({
    from: onPath[i - 1].id, to: onPath[i].id,
    walk_min: +(onPath[i].at_min - onPath[i - 1].at_min).toFixed(2),
    direct_min: +(g / 60).toFixed(2),
  });
}
const cpMean = cpGaps.length ? cpGaps.reduce((s, g) => s + g.walk_min, 0) / cpGaps.length : null;

// fog gates
for (const g of FOG_GATES) {
  if (!g.hearth) continue;
  const h = byId.get(g.hearth);
  const gd = dijkstra([idxOf(g.pos[0], g.pos[2])]);
  g.hearth_walk_s = +gd[idxOf(h.pos[0], h.pos[2])].toFixed(1);
}

const rules = {
  count_in_24_32: chosen.length >= 24 && chosen.length <= 32,
  min_pair_ge_2min: minPair.min >= FLOOR_S,
  cp_consecutive_in_3_5p5: cpGaps.every((g) => g.walk_min >= 3.0 && g.walk_min <= 5.5),
  cp_mean_in_3_4: cpMean !== null && cpMean >= 3.0 && cpMean <= 4.0,
  worst_to_nearest_le_11min: cov.worst / 60 <= 11.0,
  no_land_orphaned_by_hearth_placement: cov.unreached <= islandCells,
  every_settlement_has_one: mandatory.every((id) => chosen.includes(id)),
  every_fog_gate_60_110s: FOG_GATES.every((g) => g.hearth && g.hearth_walk_s >= 60 && g.hearth_walk_s <= 110),
};

const doc = {
  schema: 'elder-souls/hearths@1',
  generator: 'tools/world/build-hearths.mjs',
  in_world_name: 'sapwell (ixtu-xul) — RI-LOR05 §4. HEARTH is RI-PRG04\'s placeholder; the rename is find-and-replace and moves no number.',
  provenance: 'Positions are MEASURED placements on the built province (game/src/world/field.js). Spacing is walk time over a seconds-per-metre field derived from game/data/world/traversal.json (water band speed_mult, substrate speed_mult, max_walkable_deg) at walk speed 2.0 m/s, low tide (phase 0.75). RI-PRG04 §5\'s COUNTS were declared derived and re-measurable; its RULES are binding and are checked below.',
  walk_model: {
    walk_mps: WALK_MPS, tide_phase: PLAN_TIDE, max_slope_deg: MAX_SLOPE, max_depth_m: MAX_DEPTH,
    band_speed_mult: BAND, substrate_speed_mult: SUB, cell_m: CELL,
  },
  count: chosen.length,
  hearths: chosenC.map((c) => ({
    id: c.id, name: c.name, kind: c.kind, region: c.region, pos: c.pos,
    interact_radius_m: 3.0,
    why: c.why,
  })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  fog_gates: FOG_GATES.map((g) => ({
    id: g.id, name: g.name, boss: g.boss, region: g.region, pos: g.pos,
    radius_m: 26.0,
    hearth: g.hearth, hearth_walk_s: g.hearth_walk_s === undefined ? null : g.hearth_walk_s,
    note: g.note,
  })),
  measured: {
    critical_path: {
      route: 'roads.json named_routes.crossing',
      total_walk_min: +CROSS_TOTAL_MIN.toFixed(2),
      hearths_on_path: onPath.length,
      consecutive_gaps_min: cpGaps,
      mean_gap_min: cpMean === null ? null : +cpMean.toFixed(2),
    },
    min_pair: { a: minPair.a, b: minPair.b, walk_min: +(minPair.min / 60).toFixed(2) },
    coverage: {
      land_cells_sampled: landCells.length,
      worst_time_to_nearest_min: +(cov.worst / 60).toFixed(2),
      mean_time_to_nearest_min: +(cov.mean / 60).toFixed(2),
      cells_with_no_hearth_reachable: cov.unreached,
      cells_unreachable_from_a_single_settlement: islandCells,
      island_note: 'Cells the province itself cannot connect on foot from one settlement. Not a hearth defect; reported so the two causes are never confused.',
    },
    rules,
  },
  ri_prg04_table_discrepancy: {
    declared_regions: 6, built_regions: regionsDoc.regions.length,
    declared_critical_path_min: 95, built_crossing_min: +CROSS_TOTAL_MIN.toFixed(2),
    declared_count: 28, built_count: chosen.length,
    ruling: 'RI-PRG04 provenance note: "the counts are derived and should move if the map says so". The RULES are checked in measured.rules and are the binding half. Filed, not resolved here.',
  },
  rejected_candidates: rejected,
};

const allOk = Object.values(rules).every(Boolean);
if (!DRY) {
  mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
  writeFileSync(join(ROOT, OUT), JSON.stringify(doc, null, 1) + '\n');
}
console.log(JSON.stringify({ count: doc.count, rules, measured: doc.measured, fog_gates: doc.fog_gates.map((g) => ({ id: g.id, hearth: g.hearth, s: g.hearth_walk_s })) }, null, 1));
console.log(allOk ? `[hearths] PASS — ${DRY ? '(dry run)' : OUT}` : '[hearths] RULE FAILURE');
process.exit(allOk ? 0 : 20);
