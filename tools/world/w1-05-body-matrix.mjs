#!/usr/bin/env node
/**
 * W1-05's complete physical-traversal population.
 *
 * Unlike the old plan-only navigator, every row drives the live capsule through walkPath.  The
 * population is fail-closed: all ten road legs in both directions and both named routes in both
 * directions must arrive.  A result also fails for a teleport/reanchor, fatal water, stuck/abort,
 * excessive final offset, or movement after the settling window.  One Chromium instance serves
 * the complete run so this gate does not multiply browser contention.
 *
 * Usage: node tools/world/w1-05-body-matrix.mjs [--out reports/w1-05-builder-delivery.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const OUT = arg('--out', 'reports/w1-05-builder-delivery.json');
const POPULATION_ONLY = argv.includes('--population-only');
const roads = JSON.parse(readFileSync(join(ROOT, 'game/data/world/roads.json'), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const xy = (points) => points.map((p) => [p[0], p[1]]);
const directed = [];
for (const leg of roads.legs) {
  const path = xy(leg.points);
  directed.push({ id: `${leg.id}:forward`, kind: 'leg', from: leg.from, to: leg.to, path });
  directed.push({ id: `${leg.id}:reverse`, kind: 'leg', from: leg.to, to: leg.from, path: [...path].reverse() });
}

function routePath(route, reverse = false) {
  const settlements = reverse ? [...route.settlements].reverse() : route.settlements;
  const parts = [];
  for (let i = 0; i < settlements.length - 1; i++) {
    const a = settlements[i], b = settlements[i + 1];
    const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
    if (!leg) throw new Error(`named route ${route.id}: no leg joins ${a} to ${b}`);
    const p = xy(leg.points);
    parts.push(...(leg.from === a ? p : p.reverse()).slice(i ? 1 : 0));
  }
  return { id: `${route.id}:${reverse ? 'reverse' : 'forward'}`, kind: 'named_route',
    from: settlements[0], to: settlements.at(-1), path: parts };
}
for (const [id, route] of Object.entries(roads.named_routes || {})) {
  directed.push(routePath({ id, ...route }, false), routePath({ id, ...route }, true));
}

if (roads.legs.length !== 10 || directed.filter((r) => r.kind === 'leg').length !== 20) {
  throw new Error(`W1-05 population changed: expected 10 legs/20 directed legs, got ${roads.legs.length}/${directed.filter((r) => r.kind === 'leg').length}`);
}

const rows = [];
const writeCheckpoint = (complete = false) => {
  const legRows = rows.filter((r) => r.kind === 'leg');
  const namedRows = rows.filter((r) => r.kind === 'named_route');
  const report = {
    schema: 'elder-souls/w1-05-body-matrix@1', commit, dirty, complete,
    method: 'live collision-bound __HARNESS.walkPath plus 120-frame temporal settling control',
    population: { road_legs: roads.legs.length, directed_legs: 20, directed_named_routes: directed.filter((r) => r.kind === 'named_route').length },
    acceptance: { required_directed_legs: 20, arrival_radius_m: 8, fatal_water_depth_m: 1.5, max_settling_drift_m: 1, teleports: 0 },
    summary: { rows_run: rows.length, directed_legs_arrived: legRows.filter((r) => r.pass).length,
      directed_named_routes_arrived: namedRows.filter((r) => r.pass).length,
      worst_final_offset_m: rows.length ? Math.max(...rows.map((r) => Number.isFinite(r.final_offset_m) ? r.final_offset_m : 1e9)) : null,
      max_water_depth_m: rows.length ? Math.max(...rows.map((r) => r.max_water_depth_m)) : null,
      ok: complete && rows.length === directed.length && rows.every((r) => r.pass) }, rows,
  };
  mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
  writeFileSync(join(ROOT, OUT), JSON.stringify(report, null, 2) + '\n');
  return report;
};
writeCheckpoint(false);
if (POPULATION_ONLY) {
  console.log(`W1-05 population: ${roads.legs.length} legs, ${directed.filter((r) => r.kind === 'leg').length} directed legs, ${directed.filter((r) => r.kind === 'named_route').length} directed named routes (live rows NOT_RUN)`);
  process.exit(0);
}
const { launchGame } = await import('../lib/browser.mjs');
const h = await launchGame({ width: 320, height: 180 });
try {
  for (const route of directed) {
    const result = await h.page.evaluate(({ path }) => {
      const H = window.__HARNESS;
      try { H.signClose(); } catch {}
      try { H.conversationClose(); } catch {}
      try { H.closeMenu(); } catch {}
      H.loadState('default');
      H.setRenderRate(0);
      H.teleport(path[0][0], path[0][1]);
      H.streamAround(path[0][0], path[0][1]);
      const start = H.getPlayerStats().pos.slice();
      const walked = H.walkPath(path, { speed: 'walk', maxFrames: 500000 });
      const arrival = H.getPlayerStats().pos.slice();
      H.stepFrames(120);
      const settled = H.getPlayerStats().pos.slice();
      return { walked, start, arrival, settled,
        settling_drift_m: Math.hypot(settled[0] - arrival[0], settled[2] - arrival[2]) };
    }, { path: route.path });
    const w = result.walked || {};
    const deepest = w.deepest_water_on_the_walk?.depth_m ?? w.max_water_depth_m ?? 0;
    const teleports = w.teleports ?? w.reanchors ?? w.teleport_count ?? 0;
    const offset = w.offset_m ?? Infinity;
    const pass = w.arrived === true && !w.aborted && teleports === 0 && deepest < 1.5
      && offset <= 8 && result.settling_drift_m <= 1;
    rows.push({ id: route.id, kind: route.kind, from: route.from, to: route.to,
      path_points: route.path.length, pass, final_offset_m: offset, max_water_depth_m: deepest,
      teleports, aborted: w.aborted || null, reason: w.reason || null,
      path_m: w.path_m ?? null, frames: w.frames ?? null,
      off_road_fraction: w.off_road_fraction ?? w.offroad_fraction ?? null,
      settling_drift_m: +result.settling_drift_m.toFixed(3), walked: w });
    writeCheckpoint(false);
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${route.id}: offset ${offset}m, water ${deepest}m, drift ${result.settling_drift_m.toFixed(3)}m\n`);
  }
} finally {
  await h.close();
}

const legRows = rows.filter((r) => r.kind === 'leg');
const namedRows = rows.filter((r) => r.kind === 'named_route');
const report = writeCheckpoint(true);
console.log(`${report.summary.ok ? 'PASS' : 'FAIL'} W1-05 body matrix: ${report.summary.directed_legs_arrived}/20 legs, ${report.summary.directed_named_routes_arrived}/${namedRows.length} named routes; ${OUT}`);
process.exit(report.summary.ok ? 0 : 1);
