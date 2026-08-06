#!/usr/bin/env node
/**
 * road-water-audit.mjs — M2-ROAD-ABOVE-WATER, all ten legs, all four tide phases.
 *
 * The check whose absence let the Rootway run 502 m along the floor of a 65 m lake at LOW tide
 * (verdict W1-01 §8). `scale-audit.mjs` used to measure water on exactly one leg — the declared
 * tideway — so the other nine were never asked.
 *
 * Static: same `WorldField` the game collides against, with the road corridor attached, so the
 * depth reported here is the depth the player's capsule stands in.
 *
 * Usage: node tools/world/road-water-audit.mjs [--out reports/road-water.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/road-water.json';

export const TIDE_PHASE = { RISING: 0.0, HIGH: 0.25, FALLING: 0.5, LOW: 0.75 };

/**
 * Every leg, sub-sampled to 3 m so a 12 m point spacing cannot step over a channel, at one phase.
 * `band_metres` is metres of centreline, not points, so the numbers are comparable to the verdict.
 */
export function legWater(field, leg, phase) {
  const bands = { W0: 0, W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
  let total = 0, maxd = 0, at = null;
  const p = leg.points;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const n = Math.max(1, Math.ceil(seg / 3));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
      const z = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      const d = field.depthAt(x, z, phase);
      bands[field.bandOf(d)] += seg / n;
      total += seg / n;
      if (d > maxd) { maxd = d; at = [+x.toFixed(2), +z.toFixed(2)]; }
    }
  }
  const overKnee = bands.W3 + bands.W4 + bands.W5;
  return {
    id: leg.id, tide_gated: !!leg.tide_gated,
    total_m: +total.toFixed(1), max_depth_m: +maxd.toFixed(3), deepest_at: at,
    over_shin_m: +(bands.W2 + overKnee).toFixed(1),
    over_knee_m: +overKnee.toFixed(1), over_chest_m: +bands.W5.toFixed(1),
    band_metres: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, +v.toFixed(1)])),
  };
}

export function roadWaterAudit(field, roads) {
  const tides = {};
  for (const [state, phase] of Object.entries(TIDE_PHASE)) {
    tides[state] = roads.legs.map((l) => legWater(field, l, phase));
  }
  // The rule. Trunk road may not exceed W2 (0.60 m, shin) at ANY tide phase, on ANY leg, except
  // the leg RI-WLD01 §4 declares a tideway — whose whole identity is that it floods.
  const offenders = [];
  for (const [state, rows] of Object.entries(tides)) {
    for (const r of rows) {
      if (r.tide_gated) continue;
      if (r.over_knee_m > 0 || r.max_depth_m > 0.60) {
        offenders.push({ tide: state, leg: r.id, max_depth_m: r.max_depth_m, over_knee_m: r.over_knee_m, at: r.deepest_at });
      }
    }
  }
  return { tides, offenders, ok: offenders.length === 0 };
}

// ---- CLI ------------------------------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) runCli();

function runCli() {
const roads = rd('game/data/world/roads.json');
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
field.setRoads(roads);
const res = roadWaterAudit(field, roads);
const doc = { schema: 'elder-souls/road-water@1', method: 'RI-WLD01 M2b ROAD ABOVE WATER (verdict W1-01 §8)',
  measured_at: new Date().toISOString(), rule: 'no non-tideway trunk road point may exceed 0.60 m (W2) at any of the four tide phases',
  ...res };
mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');

for (const state of Object.keys(TIDE_PHASE)) {
  const rows = res.tides[state];
  const T = rows.reduce((a, l) => a + l.total_m, 0);
  const ok = rows.reduce((a, l) => a + l.over_knee_m, 0);
  const w5 = rows.reduce((a, l) => a + l.over_chest_m, 0);
  process.stdout.write(`TIDE ${state.padEnd(8)} road ${T.toFixed(0)} m; over-knee ${ok.toFixed(0)} m (${(ok / T * 100).toFixed(2)}%); over-chest ${w5.toFixed(0)} m (${(w5 / T * 100).toFixed(2)}%)\n`);
  for (const l of rows) {
    if (l.max_depth_m === 0 && !l.tide_gated) continue;
    process.stdout.write(`   ${l.id.padEnd(22)} max ${l.max_depth_m.toFixed(3).padStart(7)} m  W3+ ${l.over_knee_m.toFixed(0).padStart(5)} m  W5 ${l.over_chest_m.toFixed(0).padStart(5)} m${l.tide_gated ? '   <- declared tideway' : ''}\n`);
  }
}
process.stdout.write(`\n[${res.ok ? 'PASS' : 'FAIL'}] M2-ROAD-ABOVE-WATER: ${res.offenders.length} leg/phase offences\n`);
for (const o of res.offenders.slice(0, 12)) process.stdout.write(`   ${o.tide} ${o.leg}: max ${o.max_depth_m} m, over-knee ${o.over_knee_m} m at ${o.at}\n`);
process.stdout.write(`\n  ${outFile}\n`);
process.exit(res.ok ? 0 : 1);
}
