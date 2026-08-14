#!/usr/bin/env node
/**
 * w1-thorn-shoreline.mjs — where is the water at Thorn's Tidewrack quay, and how far is it?
 *
 * WHY THIS EXISTS. `reports/thorn-plates/2026-08-14-thorn-plates.md` §6.2 names "the first exterior
 * in the game is a quay with no quay on it" as the largest gap, and prescribes giving Thorn a
 * `tideline` the way Lilmoth has one. That prescription assumes the quay stands IN water. Before
 * dressing anything wet, this asks the world what is actually there — and the answer overturned the
 * prescription (RULING T1 in `orchestration/status/W1-THORN-PLATES-C2.json`).
 *
 * It reads the same `WorldField` the engine builds — `heightAt`, `waterAt`, `regionAt` — so the
 * numbers are the ones the ground, the fog and the wade bands are computed from, not a re-derivation.
 * No browser and no WebGL: this is a data question and it is answered offline in about a second.
 *
 * IT IS ABLE TO FAIL, per RULES rule 24. If the terrain field ever returns a constant — the failure
 * that would make every distance below meaningless — the control block says so and the tool exits
 * non-zero. That is not hypothetical: the first version of this probe reported 13.28 m at all six
 * sample points and looked like a flat-world bug, when in fact the whole 52 m settlement pad IS
 * flat and the instrument was fine. The control distinguishes those two cases.
 *
 * USAGE
 *   node tools/render/w1-thorn-shoreline.mjs [--json <path>]
 *
 * EXIT
 *   0  ran, and the terrain field demonstrably varies
 *   1  the terrain field returned the same height everywhere it was asked — numbers are void
 *   2  could not load the world data
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argv = process.argv.slice(2);
const JSON_OUT = (() => { const i = argv.indexOf('--json'); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; })();

let field;
try {
  const { WorldField } = await import(path.join(REPO, 'game/src/world/field.js'));
  const J = (p) => JSON.parse(fs.readFileSync(path.join(REPO, 'game/data', p), 'utf8'));
  field = new WorldField(J('world/terrain.json'), J('world/regions.json'), J('world/water.json'));
} catch (e) { console.error('could not load the world:', e && e.message); process.exit(2); }

const out = { generated: new Date().toISOString() };

// ---- the control, first. Does the height field vary at all? ------------------------------------
const CONTROL = [[3820, 859], [4200, 1200], [3000, 3000], [3820, 1200]];
const controlHeights = CONTROL.map(([x, z]) => +field.heightAt(x, z).toFixed(2));
out.control_heights = controlHeights;
out.control_varies = new Set(controlHeights).size > 1;
console.log('control — heightAt at four widely separated points:', controlHeights.join(', '),
  out.control_varies ? '(varies: instrument live)' : '(CONSTANT: instrument dead)');

// ---- the stands a player actually occupies -----------------------------------------------------
const STANDS = {
  'barge-hold door': [3800, 904.5],
  'writ-house door': [3806.25, 908.5],
  'quay spawn': [3808.6, 909.36],
  'the approach': [3812, 885],
  'Rotted Hall door': [3819.25, 866.865],
};
console.log('\nthe stands, and what is under them');
out.stands = {};
for (const [k, [x, z]] of Object.entries(STANDS)) {
  const w = field.waterAt(x, z, 0);
  out.stands[k] = { x, z, ground_y: +w.ground_y.toFixed(2), depth_m: +w.depth_m.toFixed(2), band: w.band, region: w.region, surface_y: w.surface_y };
  console.log('  ' + k.padEnd(18), 'ground=' + w.ground_y.toFixed(2), 'depth=' + w.depth_m.toFixed(2), 'band=' + w.band, 'region=' + w.region);
}

// ---- how far is the water, walking north from each quay stand? ----------------------------------
const wet = (x, z) => { const w = field.waterAt(x, z, 0); return w && w.depth_m > 0; };
console.log('\nhow far to water, walking north (1 m steps, 80 m max)');
out.distance_to_water_m = {};
for (const [k, [x, z0]] of Object.entries(STANDS)) {
  let found = null;
  for (let z = z0; z <= z0 + 80; z += 1) if (wet(x, z)) { found = z; break; }
  out.distance_to_water_m[k] = found === null ? null : +(found - z0).toFixed(1);
  console.log('  ' + k.padEnd(18), found === null ? 'no water within 80 m' : `${(found - z0).toFixed(0)} m out, at z=${found.toFixed(1)}, surface ${field.waterAt(x, found, 0).surface_y} m`);
}

// ---- the shoreline as a line, and the freeboard -------------------------------------------------
console.log('\nthe shoreline across the quay frontage');
out.shoreline = [];
for (let x = 3785; x <= 3840; x += 5) {
  let z = null;
  for (let zz = 900; zz <= 990; zz += 1) if (wet(x, zz)) { z = zz; break; }
  out.shoreline.push({ x, first_wet_z: z });
  console.log(`  x=${x}`.padEnd(10), z === null ? 'dry to z=990' : `water from z=${z}`);
}
const quayGround = field.heightAt(3806.25, 908.5);
const surf = field.waterAt(3806.25, 940, 0).surface_y;
out.quay_ground_y = +quayGround.toFixed(2);
out.water_surface_y = surf;
out.freeboard_m = surf === null ? null : +(surf - quayGround).toFixed(2);
console.log(`\nquay ground ${quayGround.toFixed(2)} m | water surface ${surf} m | the water stands ${out.freeboard_m} m ABOVE the quay`);

// ---- is it tidal here? --------------------------------------------------------------------------
const phases = [0, 0.25, 0.5, 0.75].map((p) => field.waterAt(3806.25, 940, p).surface_y);
out.surface_by_tide_phase = phases;
out.tidal_here = new Set(phases).size > 1;
console.log(`water surface at tide phases 0/0.25/0.5/0.75: ${phases.join(', ')} — tidal here: ${out.tidal_here}`);

if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log('\nwrote', JSON_OUT); }
if (!out.control_varies) { console.error('\nDEAD INSTRUMENT: the height field is constant everywhere it was asked. Every distance above is void.'); process.exit(1); }
