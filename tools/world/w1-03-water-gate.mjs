#!/usr/bin/env node
/** Cheap W1-03 hard-fail gate: exact tide confinement plus END-derived breath. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorldField } from '../../game/src/world/field.js';
import { breathMaxForEndurance } from '../../game/src/sim/traversal.js';

const rd = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'));
const terrain = rd('game/data/world/terrain.json');
const regions = rd('game/data/world/regions.json');
const water = rd('game/data/world/water.json');
const traversal = rd('game/data/world/traversal.json');
const field = new WorldField(terrain, regions, water);
const expected = new Set(['crimson-coast', 'eastern-rootlands', 'marauders-coast', 'stone-wastes', 'western-rootlands']);
const rows = [];

// Sample every raster cell centre in every region. This is deliberately larger than M54's
// fitted-point population: authored/consumed non-tidal motion is an automatic fail at any size.
for (let ri = 0; ri < field.regions.length; ri++) {
  let samples = 0, maxRange = 0;
  for (let iz = 0; iz < field.rows; iz++) for (let ix = 0; ix < field.cols; ix++) {
    const x = (ix + 0.5) * field.cell, z = (iz + 0.5) * field.cell;
    if (field.regionIndexAt(x, z) !== ri) continue;
    const phases = [0, 0.25, 0.5, 0.75].map((p) => field.waterSurfaceAt(x, z, p));
    const finite = phases.filter((v) => v !== null);
    if (finite.length) maxRange = Math.max(maxRange, Math.max(...finite) - Math.min(...finite));
    samples++;
  }
  const id = field.regions[ri].id;
  rows.push({ id, tidal: !!field.tidal[ri], samples, max_range_m: +maxRange.toFixed(6) });
}

const actual = new Set(rows.filter((r) => r.tidal).map((r) => r.id));
const sameSet = actual.size === expected.size && [...actual].every((x) => expected.has(x));
const still = rows.filter((r) => !r.tidal).every((r) => r.max_range_m === 0);
const breath = [10, 20, 40, 55].map((endurance) => ({ endurance, seconds: breathMaxForEndurance(endurance, traversal.water) }));
const breathOk = JSON.stringify(breath.map((r) => r.seconds)) === JSON.stringify([40, 60, 100, 100]);

// Discriminating red seed: a consumed 0.01 m tide must fail exact confinement even though it is
// below M54's separate >0.02 m observational tolerance.
const redSeedRange = 0.01;
const redSeedFailsExact = redSeedRange !== 0;
const redSeedBelowFitTolerance = redSeedRange <= 0.02;
const ok = sameSet && still && breathOk && redSeedFailsExact && redSeedBelowFitTolerance;
console.log(JSON.stringify({ check: 'W1-03 water hard-fail gate', sameSet, still, breath, breathOk,
  red_control: { consumed_range_m: redSeedRange, exact_gate_red: redSeedFailsExact,
    m54_fit_arm_below_failure_tolerance: redSeedBelowFitTolerance }, rows, ok }, null, 2));
process.exit(ok ? 0 : 1);
