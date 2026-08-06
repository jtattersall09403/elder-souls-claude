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
const cost = new Float32Array(COLS * ROWS);
const groundG = new Float32Array(COLS * ROWS);
const depthG = new Float32Array(COLS * ROWS);
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x, px = x * CELL + CELL / 2, pz = z * CELL + CELL / 2;
  const g = field.heightAt(px, pz);
  groundG[i] = g;
  depthG[i] = field.depthAt(px, pz, 0);
}
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  const i = z * COLS + x;
  const hx = (groundG[i + (x < COLS - 1 ? 1 : 0)] - groundG[i - (x > 0 ? 1 : 0)]) / (2 * CELL);
  const hz = (groundG[i + (z < ROWS - 1 ? COLS : 0)] - groundG[i - (z > 0 ? COLS : 0)]) / (2 * CELL);
  const slope = Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI;
  const d = depthG[i];
  cost[i] = 1 + 0.40 * slope + (d > 0 ? 4.5 + 3.0 * Math.min(d, 3) : 0) + (field.isOceanAt(x * CELL, z * CELL) ? 60 : 0);
}

function astar(ax, az, bx, bz) {
  const s = Math.floor(clamp(az, 0, ROWS * CELL - 1) / CELL) * COLS + Math.floor(clamp(ax, 0, COLS * CELL - 1) / CELL);
  const t = Math.floor(clamp(bz, 0, ROWS * CELL - 1) / CELL) * COLS + Math.floor(clamp(bx, 0, COLS * CELL - 1) / CELL);
  const g = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const open = [[0, s]];
  g[s] = 0;
  const tx = t % COLS, tz = (t - tx) / COLS;
  const h = (i) => { const x = i % COLS, z = (i - x) / COLS; return Math.hypot(x - tx, z - tz) * CELL; };
  const closed = new Uint8Array(COLS * ROWS);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === t) break;
    const cx = cur % COLS, cz = (cur - cx) / COLS;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
      const ni = nz * COLS + nx;
      if (closed[ni]) continue;
      const step = CELL * (dx && dz ? Math.SQRT2 : 1);
      const ng = g[cur] + step * (cost[cur] + cost[ni]) / 2;
      if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; open.push([ng + h(ni), ni]); }
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
/** Pull a route toward its own chord by `s`; s = 1 is the straight line. */
function straighten(p, s) {
  const a = p[0], b = p[p.length - 1];
  const n = p.length - 1;
  return p.map((q, i) => [lerp(q[0], lerp(a[0], b[0], i / n), s), lerp(q[1], lerp(a[1], b[1], i / n), s)]);
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
    return [q[0] + (-pz / L) * amp * env * w, q[1] + (px / L) * amp * env * w];
  });
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
    let sp = smooth(resample(astar(way[i][0], way[i][1], way[i + 1][0], way[i + 1][1]), 18), 12);
    const tgt = leg.path_m * chords[i] / chordSum;
    const L0 = len2d(sp);
    let mode, amount;
    if (L0 > tgt) {
      let lo = 0, hi = 1;
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (len2d(straighten(sp, m)) > tgt) lo = m; else hi = m; }
      amount = (lo + hi) / 2; sp = straighten(sp, amount); mode = 'straightened';
    } else {
      let lo = 0, hi = 400;
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (len2d(wiggle(sp, m, 0.11 + i * 0.19)) < tgt) lo = m; else hi = m; }
      amount = (lo + hi) / 2; sp = wiggle(sp, amount, 0.11 + i * 0.19); mode = 'sinuosity added';
    }
    modes.push(`${mode} ${amount.toFixed(1)}`);
    for (let k = (p.length ? 1 : 0); k < sp.length; k++) p.push(sp[k]);
  }
  const mode = modes.join(' | ');
  const amount = 0;
  p = resample(p, 12);

  // ---- elevation profile --------------------------------------------------------------------
  // A causeway: the road holds a smoothed grade and stands clear of the water it crosses, except
  // the Lilmoth-Archon tideway, whose whole identity is that it is BELOW the waterline and only
  // walkable at low tide (RI-TRV01 / RI-WLD10 M54).
  const tideway = /tideway/i.test(leg.class);
  let y = p.map(([x, z]) => {
    const surf = field.waterSurfaceAt(x, z, 0);
    const g = field.heightAt(x, z);
    if (tideway) return (surf === null ? g : surf) - 0.75;
    return surf === null ? g : Math.max(g, surf + 0.40);
  });
  // Smooth the profile, hold it clear of the water, and cap the grade. A road that a walker
  // cannot hold 2.0 m/s on is exactly the friction-cheat RI-WLD01 M3 exists to catch, so the cap
  // is part of the road and not a tuning value: MAX_GRADE at 12% is a hard limit, iterated
  // against the water clearance until both hold.
  const MAX_GRADE = 0.12;
  const surfAt = p.map(([x, z]) => field.waterSurfaceAt(x, z, 0));
  for (let k = 0; k < 18; k++) {
    const q = y.slice();
    for (let i = 1; i < y.length - 1; i++) q[i] = (y[i - 1] + 2 * y[i] + y[i + 1]) / 4;
    for (let i = 1; i < y.length - 1; i++) if (!tideway && surfAt[i] !== null) q[i] = Math.max(q[i], surfAt[i] + 0.40);
    for (let i = 1; i < q.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) || 1;
      q[i] = clamp(q[i], q[i - 1] - MAX_GRADE * d, q[i - 1] + MAX_GRADE * d);
    }
    for (let i = q.length - 2; i >= 0; i--) {
      const d = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) || 1;
      q[i] = clamp(q[i], q[i + 1] - MAX_GRADE * d, q[i + 1] + MAX_GRADE * d);
    }
    y = q;
  }
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
