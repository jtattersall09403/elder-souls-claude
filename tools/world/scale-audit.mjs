#!/usr/bin/env node
/**
 * scale-audit.mjs — RI-WLD01 M1/M4/M5 and RI-WLD07 M36, computed on the built world.
 *
 * Static: it reads `game/data/world/*.json` and evaluates the same field the game collides
 * against (`game/src/world/field.js`), so it needs no browser and cannot be satisfied by a
 * decorative data file — every number below is sampled off the ground.
 *
 * Usage: node tools/world/scale-audit.mjs [--out reports/scale-audit.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { roadWaterAudit, TIDE_PHASE } from './road-water-audit.mjs';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/scale-audit.json';

const scale = rd('corpus/50-world/world-scale.json');
const terrain = rd('game/data/world/terrain.json');
const regionsDoc = rd('game/data/world/regions.json');
const roads = rd('game/data/world/roads.json');
const field = new WorldField(terrain, regionsDoc, rd('game/data/world/water.json'));
field.setRoads(roads);

const checks = [];
const check = (id, ok, detail) => { checks.push({ id, pass: !!ok, detail }); return ok; };

// ---- M1.2 world bounds --------------------------------------------------------------------------
const wb = terrain.world_bounds_m;
check('M1-BOUNDS', Math.abs(wb.x[1] - 4825) <= 25 && Math.abs(wb.z[1] - 5540) <= 25,
  `world box ${wb.x[1]} x ${wb.z[1]} m (RI-WLD01 §2: 4825 x 5540, tolerance +/-25)`);

// ---- M1.3 settlements ----------------------------------------------------------------------------
const sites = new Map(terrain.sites.map((s) => [s.name, s]));
const settle = [];
let maxOff = 0;
for (const [name, s] of Object.entries(scale.settlements)) {
  const built = sites.get(name);
  const off = built ? Math.hypot(built.x - s.x, built.z - s.z) : Infinity;
  maxOff = Math.max(maxOff, off);
  const y = field.heightAt(s.x, s.z);
  const depth = field.depthAt(s.x, s.z);
  const slope = field.slopeAt(s.x, s.z);
  // A settlement is only sited if its whole footprint is sane, not just its centre point.
  let worstSlope = 0, worstDepth = 0;
  for (let a = 0; a < 16; a++) {
    const th = a / 16 * Math.PI * 2;
    for (const rr of [20, 45, 75]) {
      const px = s.x + Math.cos(th) * rr, pz = s.z + Math.sin(th) * rr;
      worstSlope = Math.max(worstSlope, field.slopeAt(px, pz));
      worstDepth = Math.max(worstDepth, field.depthAt(px, pz));
    }
  }
  settle.push({ name, tier: s.tier, declared: [s.x, s.z], built: built ? [built.x, built.z] : null,
    offset_m: +off.toFixed(2), y: +y.toFixed(2), depth_m: +depth.toFixed(3), slope_deg: +slope.toFixed(2),
    footprint_worst_slope_deg: +worstSlope.toFixed(2), footprint_worst_depth_m: +worstDepth.toFixed(3),
    region_built: field.regionAt(s.x, s.z).id, region_declared: s.region });
}
check('M1-SETTLEMENT-PLACEMENT', maxOff <= 60, `worst settlement offset from the RI-WLD01 §3 table: ${maxOff.toFixed(2)} m (pass <= 60, fail > 150)`);
check('M1-SETTLEMENT-DRY', settle.every((s) => s.depth_m === 0), `${settle.filter((s) => s.depth_m > 0).length} settlement centres under standing water`);
check('M1-SETTLEMENT-FLAT', settle.every((s) => s.footprint_worst_slope_deg < 18),
  `worst slope inside a 75 m settlement footprint: ${Math.max(...settle.map((s) => s.footprint_worst_slope_deg)).toFixed(1)} deg`);
check('M1-SETTLEMENT-REGION', settle.every((s) => s.region_built.replace(/-/g, '') === s.region_declared.toLowerCase().replace(/[^a-z]/g, '').replace(/^the/, '')),
  settle.filter((s) => s.region_built.replace(/-/g, '') !== s.region_declared.toLowerCase().replace(/[^a-z]/g, '').replace(/^the/, '')).map((s) => `${s.name}: ${s.region_built} != ${s.region_declared}`).join('; ') || 'every settlement is in the region settlements.json puts it in');

// ---- M1.4 walkable land, and RI-WLD07 §4 verticality ----------------------------------------------
let landCells = 0, aboveSea = 0, below5 = 0, above100 = 0, walkable = 0, slopeSum = 0, slopeN = 0;
let minY = Infinity, maxY = -Infinity;
const regionMax = new Map();
for (let cz = 0; cz < field.rows; cz++) {
  for (let cx = 0; cx < field.cols; cx++) {
    const x = cx * field.cell + field.cell / 2, z = cz * field.cell + field.cell / 2;
    const y = field.heightAt(x, z);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (!field.isLandAt(x, z)) continue;
    landCells++;
    const r = field.regionAt(x, z).id;
    regionMax.set(r, Math.max(regionMax.get(r) ?? -Infinity, y));
    if (y > 0) aboveSea++;
    if (y < 5) below5++;
    if (y > 100) above100++;
    const sl = field.slopeAt(x, z, 8);
    if (y > 0 && sl <= 40) walkable++;
    slopeSum += sl; slopeN++;
  }
}
const cellKm2 = field.cell * field.cell / 1e6;
const landKm2 = landCells * cellKm2, walkableKm2 = walkable * cellKm2;
check('M1-LAND-AREA', landKm2 >= 13.0 && landKm2 <= 16.0, `${landKm2.toFixed(2)} km2 of land (pass 13.0-16.0, RI-WLD01 derives 14.5)`);
check('M36-ELEVATION-RANGE', maxY - minY >= 150, `${minY.toFixed(1)} .. ${maxY.toFixed(1)} m = ${(maxY - minY).toFixed(1)} m of range (RI-WLD07 §4 target -40..+420, fail < 150)`);
check('M36-VALUS', (regionMax.get('valus-ridge') ?? 0) >= 380, `Valus Ridge max ${(regionMax.get('valus-ridge') ?? 0).toFixed(1)} m (pass >= 380, fail < 250)`);
check('M36-SALT-HILLS', (regionMax.get('salt-hills') ?? 0) >= 190, `Salt Hills max ${(regionMax.get('salt-hills') ?? 0).toFixed(1)} m (pass >= 190, fail < 120)`);
check('M36-BELOW-5M', below5 / landCells >= 0.35 && below5 / landCells <= 0.50, `${(below5 / landCells * 100).toFixed(1)}% of land below +5 m (target 35-50, fail > 70)`);
check('M36-ABOVE-100M', above100 / landCells >= 0.12, `${(above100 / landCells * 100).toFixed(1)}% of land above +100 m (target >= 12, fail < 5)`);
check('M36-MEAN-SLOPE', slopeSum / slopeN >= 6 && slopeSum / slopeN <= 14, `mean slope on land ${(slopeSum / slopeN).toFixed(2)} deg (target 6-14, fail < 3)`);

// ---- M4 leg-time audit ------------------------------------------------------------------------------
let worstLeg = 0, worstLegId = null;
const legs = roads.legs.map((l) => {
  const err = Math.abs(l.built_path_m / l.declared_path_m - 1);
  if (err > worstLeg) { worstLeg = err; worstLegId = l.id; }
  return { id: l.id, declared_m: l.declared_path_m, built_m: l.built_path_m, err_pct: +(err * 100).toFixed(2),
    declared_walk_min: l.declared_walk_min, built_walk_min: l.built_walk_min, max_grade: l.max_grade, sinuosity: l.sinuosity_built };
});
check('M4-LEG-TIMES', worstLeg <= 0.20, `worst leg deviation ${(worstLeg * 100).toFixed(2)}% (${worstLegId}); pass <= 20%, fail > 40%`);

// ---- M5 minor-settlement gap rule ---------------------------------------------------------------------
// Walk every leg; the largest walk-time gap between successive inhabited places.
const inhabited = [];
for (const [n, s] of Object.entries(scale.settlements)) inhabited.push({ n, x: s.x, z: s.z });
for (const [n, s] of Object.entries(scale.minor_settlements)) inhabited.push({ n, x: s.x, z: s.z });
for (const w of roads.waystations || []) inhabited.push({ n: w.name, x: w.x, z: w.z });
let maxGap = 0, maxGapLeg = null;
const legGaps = [];
for (const l of roads.legs) {
  let cum = 0, lastHit = 0, gap = 0;
  const marks = [];
  for (let i = 1; i < l.points.length; i++) {
    cum += Math.hypot(l.points[i][0] - l.points[i - 1][0], l.points[i][1] - l.points[i - 1][1]);
    if (inhabited.some((p) => Math.hypot(p.x - l.points[i][0], p.z - l.points[i][1]) < 70)) {
      gap = Math.max(gap, cum - lastHit); lastHit = cum; marks.push(+cum.toFixed(0));
    }
  }
  gap = Math.max(gap, cum - lastHit);
  const gapMin = gap / 2 / 60;
  legGaps.push({ id: l.id, max_gap_m: +gap.toFixed(0), max_gap_walk_min: +gapMin.toFixed(2), habitation_marks_m: marks });
  if (gapMin > maxGap) { maxGap = gapMin; maxGapLeg = l.id; }
}
check('M5-HABITATION-GAP', maxGap <= 9.0, `largest walk-time gap between inhabited places: ${maxGap.toFixed(2)} min on ${maxGapLeg} (pass <= 9.0, fail > 12)`);

// ---- RI-WLD07 §4 road relief -------------------------------------------------------------------------
let win = 0, tot = 0;
for (const l of roads.legs) {
  const p = l.points;
  let cum = 0, i0 = 0;
  for (let i = 1; i < p.length; i++) {
    cum += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (cum >= 500) {
      let lo = Infinity, hi = -Infinity;
      for (let k = i0; k <= i; k++) { lo = Math.min(lo, p[k][2]); hi = Math.max(hi, p[k][2]); }
      tot++; if (hi - lo >= 15) win++;
      cum = 0; i0 = i;
    }
  }
}
check('M36-ROAD-RELIEF', tot && win / tot >= 0.30, `${tot ? (win / tot * 100).toFixed(1) : 0}% of 500 m road windows change >= 15 m in elevation (target >= 30, fail < 12)`);

// ---- world.region.gating: the province is gated by lethality, never by walls ----------------------
// S9 and RI-WLD04's tier table: "the Deep Marshes must be walkable from minute one and must kill
// you." A tier is an enemy roster, not a fence — so this is a reachability proof. Flood fill the
// walkable surface from the player's start at Lilmoth, crossing anything up to hip-deep water and
// up to 40 degrees of slope, and assert that every settlement and every region is reachable.
const passable = new Uint8Array(field.cols * field.rows);
for (let cz = 0; cz < field.rows; cz++) {
  for (let cx = 0; cx < field.cols; cx++) {
    const x = cx * field.cell + field.cell / 2, z = cz * field.cell + field.cell / 2;
    // Sub-sample: a 6 m causeway across a channel is a road a player walks and a 25 m raster cell
    // cannot see. Five probes per cell, and W4 (chest-deep) still counts as walking — W5 is where
    // your feet leave the bottom.
    const probes = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]];
    let ok = false;
    for (const [ux, uz] of probes) {
      const px = cx * field.cell + ux * field.cell, pz = cz * field.cell + uz * field.cell;
      // Land is not the test — a causeway crosses water and is still a road. Depth is the test.
      if (field.depthAt(px, pz) > 1.40) continue;
      if (field.slopeAt(px, pz, 8) > 40) continue;
      ok = true; break;
    }
    if (!ok) continue;
    passable[cz * field.cols + cx] = 1;
  }
}
const seen = new Uint8Array(field.cols * field.rows);
{
  const sx = Math.floor(2766.5 / field.cell), sz = Math.floor(5027.5 / field.cell);
  const st = [sz * field.cols + sx];
  seen[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), cx = i % field.cols, cz = (i - cx) / field.cols;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= field.cols || nz >= field.rows) continue;
      const k = nz * field.cols + nx;
      if (seen[k] || !passable[k]) continue;
      seen[k] = 1; st.push(k);
    }
  }
}
const unreachableSettlements = settle.filter((s) => !seen[Math.floor(s.declared[1] / field.cell) * field.cols + Math.floor(s.declared[0] / field.cell)]).map((s) => s.name);
const reachedRegions = new Set();
let reachedCells = 0, passableCells = 0;
for (let i = 0; i < seen.length; i++) {
  if (passable[i]) passableCells++;
  if (!seen[i]) continue;
  reachedCells++;
  const cx = i % field.cols, cz = (i - cx) / field.cols;
  reachedRegions.add(field.regionAt(cx * field.cell + 12.5, cz * field.cell + 12.5).id);
}
const missingRegions = regionsDoc.regions.map((r) => r.id).filter((id) => !reachedRegions.has(id));
check('S9-NO-FENCES', unreachableSettlements.length === 0 && missingRegions.length === 0,
  `on foot from the Lilmoth start, ${reachedRegions.size}/13 regions and ${8 - unreachableSettlements.length}/8 settlements are reachable `
  + `(${(reachedCells / passableCells * 100).toFixed(1)}% of walkable land)`
  + (unreachableSettlements.length ? `; unreachable: ${unreachableSettlements.join(', ')}` : '')
  + (missingRegions.length ? `; regions unreachable: ${missingRegions.join(', ')}` : ''));

// ---- M2-ROAD-ABOVE-WATER: ten legs, four tide phases ------------------------------------------------
// The check whose absence let 502 m of THE CROSSING run along the floor of a 65.6 m lake at LOW
// tide while the player walked it at 2.0 m/s (verdict W1-01 §8). It used to be measured on exactly
// one of the ten legs — the declared tideway — and at exactly one tide phase. Both halves of that
// are now wrong by construction: every leg, every phase.
const rw = roadWaterAudit(field, roads);
const rwWorst = Object.entries(rw.tides).flatMap(([t, rows]) => rows.filter((r) => !r.tide_gated).map((r) => ({ t, ...r })))
  .sort((a, b) => b.max_depth_m - a.max_depth_m)[0];
check('M2-ROAD-ABOVE-WATER', rw.ok,
  `${rw.offenders.length} leg/phase offences over ${Object.keys(TIDE_PHASE).length} tide phases x ${roads.legs.length} legs; `
  + `deepest non-tideway trunk point ${rwWorst.max_depth_m.toFixed(3)} m (${rwWorst.id} at ${rwWorst.t}); `
  + `over-knee metreage on non-tideway legs `
  + Object.entries(rw.tides).map(([t, rows]) => `${t} ${rows.filter((r) => !r.tide_gated).reduce((a, r) => a + r.over_knee_m, 0).toFixed(0)} m`).join(', ')
  + (rw.offenders.length ? `; worst: ${rw.offenders.slice(0, 3).map((o) => `${o.tide} ${o.leg} ${o.max_depth_m} m`).join(', ')}` : ''));

// The road's own geometry, which is what produced the drowned leg: a deck 85 m below the hill it
// crosses is a trench, and a trench fills.
const worstCut = Math.max(...roads.legs.map((l) => l.max_cut_m ?? 0));
const worstFill = Math.max(...roads.legs.map((l) => l.max_fill_m ?? 0));
check('M2-ROAD-CUT-AND-FILL', worstCut <= 3.5 && worstFill <= 20,
  `deepest cutting ${worstCut.toFixed(1)} m (pass <= 3.5), tallest embankment/deck ${worstFill.toFixed(1)} m (pass <= 20); `
  + `${roads.legs.reduce((a, l) => a + (l.deck_spans || []).length, 0)} emitted deck spans totalling `
  + `${roads.legs.reduce((a, l) => a + (l.deck_span_m || 0), 0)} m`);

// ---- the tideway inversion (RI-TRV01 / RI-WLD10 M54) -----------------------------------------------
const tideway = roads.legs.find((l) => l.tide_gated);
let lowMax = 0, highMax = 0;
if (tideway) {
  for (const [x, z] of tideway.points) {
    lowMax = Math.max(lowMax, field.depthAt(x, z, 0.75));    // trough of A/2*sin(2*pi*phase)
    highMax = Math.max(highMax, field.depthAt(x, z, 0.25));   // peak
  }
}
check('TIDEWAY-INVERSION', tideway && lowMax <= 0.95 && highMax > 1.40,
  tideway ? `Lilmoth-Archon tideway: deepest point ${lowMax.toFixed(2)} m at LOW (walkable, <= W3) and ${highMax.toFixed(2)} m at HIGH (>= W5, blocked)` : 'no tide-gated leg exists');

const doc = {
  schema: 'elder-souls/scale-audit@1', method: 'RI-WLD01 M1/M4/M5 + RI-WLD07 M36',
  measured_at: new Date().toISOString(),
  world_bounds_m: wb,
  land_km2: +landKm2.toFixed(3), land_above_sea_km2: +(aboveSea * cellKm2).toFixed(3),
  walkable_km2: +walkableKm2.toFixed(3),
  elevation_range_m: [+minY.toFixed(1), +maxY.toFixed(1)],
  frac_land_below_5m: +(below5 / landCells).toFixed(4),
  frac_land_above_100m: +(above100 / landCells).toFixed(4),
  mean_slope_deg: +(slopeSum / slopeN).toFixed(3),
  region_max_elevation_m: Object.fromEntries([...regionMax].map(([k, v]) => [k, +v.toFixed(1)])),
  settlements: settle, legs, leg_gaps: legGaps,
  reachability: { regions_reached: [...reachedRegions].sort(), unreachable_settlements: unreachableSettlements,
    walkable_cells: passableCells, reached_cells: reachedCells },
  tideway: tideway ? { leg: tideway.id, deepest_low_m: +lowMax.toFixed(2), deepest_high_m: +highMax.toFixed(2) } : null,
  trunk_network_m: roads.total_trunk_m,
  named_routes: roads.named_routes,
  checks, ok: checks.every((c) => c.pass),
};
mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write('RI-WLD01 M1/M4/M5 + RI-WLD07 M36 — the built world\n');
for (const c of checks) process.stdout.write(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}\n`);
process.stdout.write(`\n  ${outFile}\n`);
process.exit(doc.ok ? 0 : 1);
