#!/usr/bin/env node
/**
 * RI-WLD08 positional-emitter integrity gate.
 *
 * The denominator is deliberately read from regions.json rather than inferred from
 * emitter bounds: shrinking the measured world cannot make the gate pass.  A PASS
 * requires the province-wide floor and the same floor in every native region, so a
 * dense patch cannot conceal an empty region.  This is a content/integrity check;
 * live PCM/audibility and delete-the-consumer remain separate dynamic controls.
 *
 *   node tools/audio/w1-22-emitter-density.mjs
 *   node tools/audio/w1-22-emitter-density.mjs --json /tmp/emitter-density.json
 *   node tools/audio/w1-22-emitter-density.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORLD_FILE = path.join(ROOT, 'game/data/world/regions.json');
const TERRAIN_FILE = path.join(ROOT, 'game/data/world/terrain.json');
const BED_DIR = path.join(ROOT, 'game/data/audio/ambience');
const FLOOR = 25;
const MIN_RANGE_M = 12;
const MAX_RANGE_M = 1200;
const DUPLICATE_M = 4;
const CLUSTER_CELL_M = 100;
const MAX_PER_CLUSTER_CELL = 4;
const VALID_KINDS = new Set(['grain', 'noise', 'drone']);
const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const outputFile = jsonAt >= 0 ? args[jsonAt + 1] : null;

function load() {
  const world = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
  const terrain = JSON.parse(fs.readFileSync(TERRAIN_FILE, 'utf8'));
  const beds = new Map();
  for (const file of fs.readdirSync(BED_DIR).filter(f => f.endsWith('.json')).sort()) {
    const bed = JSON.parse(fs.readFileSync(path.join(BED_DIR, file), 'utf8'));
    beds.set(bed.region, bed);
  }
  return { world, terrain, beds };
}

function audit({ world, terrain, beds }) {
  const failures = [];
  const warn = [];
  const emitters = [];
  const ids = new Map();
  const positions = new Map();
  const clusters = new Map();
  const perRegion = [];
  const fail = (gate, detail) => failures.push({ gate, detail });
  const regionRaster = Buffer.from(terrain.channels.region, 'base64');
  const landBits = Buffer.from(terrain.channels.land, 'base64');
  const rasterIndex = p => {
    const x = Math.max(0, Math.min(terrain.cols - 1, Math.floor(p[0] / terrain.cell_m)));
    const z = Math.max(0, Math.min(terrain.rows - 1, Math.floor(p[1] / terrain.cell_m)));
    return z * terrain.cols + x;
  };

  for (const region of world.regions || []) {
    const bed = beds.get(region.id);
    const list = bed?.emitters;
    if (!bed) fail('population', `${region.id}: no exterior ambience bed`);
    if (!Array.isArray(list)) fail('population', `${region.id}: emitters is not an array`);
    const actual = Array.isArray(list) ? list.length : 0;
    const required = Math.ceil(region.area_km2 * FLOOR);
    const density = actual / region.area_km2;
    perRegion.push({ id: region.id, area_km2: region.area_km2, emitters: actual,
      required, density_per_km2: +density.toFixed(3), pass: actual >= required });
    if (actual < required) fail('density-region', `${region.id}: ${actual}/${region.area_km2} km² = ${density.toFixed(3)}/km²; requires ${required} (>=${FLOOR}/km²)`);

    for (let i = 0; i < actual; i++) {
      const e = list[i];
      const label = `${region.id}/${e?.id ?? `[${i}]`}`;
      emitters.push({ ...e, _region: region.id, _label: label });
      if (typeof e?.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(e.id)) fail('identity', `${label}: missing or invalid stable id`);
      else if (ids.has(e.id)) fail('identity', `${label}: id duplicates ${ids.get(e.id)}`);
      else ids.set(e.id, label);
      if (typeof e?.text !== 'string' || e.text.trim().length < 12) fail('identity', `${label}: missing region-appropriate description`);
      if (!Array.isArray(e?.classes) || e.classes.length === 0) fail('identity', `${label}: classes/source identity is empty`);

      const p = e?.pos_m;
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) {
        fail('placement', `${label}: pos_m must be two finite world coordinates`);
      } else {
        const inWorld = p[0] >= world.world_bounds_m.x[0] && p[0] <= world.world_bounds_m.x[1]
          && p[1] >= world.world_bounds_m.z[0] && p[1] <= world.world_bounds_m.z[1];
        if (!inWorld) fail('placement', `${label}: ${JSON.stringify(p)} is outside the native world`);
        else {
          const ri = rasterIndex(p);
          if (regionRaster[ri] !== region.index) fail('placement', `${label}: terrain raster assigns ${JSON.stringify(p)} to region index ${regionRaster[ri]}, not ${region.index}`);
          // Water landmarks are legitimate (the canonical bell buoy is one), but retain
          // land/water classification in the emitter record so an evidence report cannot
          // silently describe an ocean source as land coverage.
          emitters[emitters.length - 1]._on_land = ((landBits[ri >> 3] >> (ri & 7)) & 1) === 1;
        }
        const pk = `${p[0]},${p[1]}`;
        if (positions.has(pk)) fail('duplicates', `${label}: exact position duplicates ${positions.get(pk)}`);
        else positions.set(pk, label);
        const ck = `${region.id}:${Math.floor(p[0] / CLUSTER_CELL_M)},${Math.floor(p[1] / CLUSTER_CELL_M)}`;
        const cell = clusters.get(ck) || [];
        cell.push(label); clusters.set(ck, cell);
      }

      if (!Number.isFinite(e?.audible_m) || e.audible_m < MIN_RANGE_M || e.audible_m > MAX_RANGE_M)
        fail('range', `${label}: audible_m must be ${MIN_RANGE_M}..${MAX_RANGE_M}, got ${e?.audible_m}`);
      if (!Number.isFinite(e?.ref_m) || e.ref_m <= 0 || e.ref_m > e.audible_m)
        fail('range', `${label}: ref_m must be >0 and <= audible_m`);
      if (!Number.isFinite(e?.level_db) || e.level_db < -30 || e.level_db > 12)
        fail('range', `${label}: level_db must be finite and within -30..12 dB`);

      const kind = e?.synth?.kind;
      if (!e?.synth || !VALID_KINDS.has(kind)) fail('source', `${label}: no consumable synth source (grain/noise/drone)`);
      if (kind === 'grain' && typeof e.synth.source !== 'string') fail('source', `${label}: grain has no declared source`);
      const continuous = kind === 'noise' || kind === 'drone';
      if (continuous) {
        if (e.mode !== 'continuous') fail('schedule', `${label}: ${kind} source must declare continuous mode`);
        if (e.period_s !== undefined) fail('schedule', `${label}: continuous source declares an unused period_s`);
      } else {
        if (e.mode !== 'strike') fail('schedule', `${label}: grain source must declare strike mode`);
        if (!Number.isFinite(e.period_s) || e.period_s < 45) fail('schedule', `${label}: strike period_s must be >=45 s`);
        if (e.phase !== undefined && (!Number.isFinite(e.phase) || e.phase < 0 || e.phase >= 1)) fail('schedule', `${label}: phase must be in [0,1)`);
      }
    }
  }

  for (let i = 0; i < emitters.length; i++) for (let j = i + 1; j < emitters.length; j++) {
    const a = emitters[i], b = emitters[j];
    if (a._region !== b._region || !a.pos_m || !b.pos_m) continue;
    const d = Math.hypot(a.pos_m[0] - b.pos_m[0], a.pos_m[1] - b.pos_m[1]);
    if (d < DUPLICATE_M) fail('duplicates', `${a._label} and ${b._label} are ${d.toFixed(2)} m apart (<${DUPLICATE_M} m)`);
  }
  for (const [cell, members] of clusters) if (members.length > MAX_PER_CLUSTER_CELL)
    fail('distribution', `${cell}: ${members.length} emitters share one ${CLUSTER_CELL_M} m cell (max ${MAX_PER_CLUSTER_CELL}): ${members.join(', ')}`);

  // Conservative spatial concurrency (every source whose cutoff contains the probe point).
  // Strike phases/durations can reduce actual voice use, so this is reported rather than
  // pretending all periodic grains fire forever; the PCM concurrency probe owns that gate.
  let maxPotentialOverlap = 0;
  let overlapAt = null;
  for (const a of emitters) {
    if (!Array.isArray(a.pos_m)) continue;
    const n = emitters.filter(b => Array.isArray(b.pos_m) && Number.isFinite(b.audible_m)
      && Math.hypot(a.pos_m[0] - b.pos_m[0], a.pos_m[1] - b.pos_m[1]) <= b.audible_m).length;
    if (n > maxPotentialOverlap) { maxPotentialOverlap = n; overlapAt = a.pos_m; }
  }

  const area = world.total_land_km2;
  const required = Math.ceil(area * FLOOR);
  const density = emitters.length / area;
  if (emitters.length < required) fail('density-total', `${emitters.length}/${area} km² = ${density.toFixed(3)}/km²; requires ${required}`);
  if (+perRegion.reduce((n, r) => n + r.area_km2, 0).toFixed(3) !== +area.toFixed(3))
    fail('denominator', `regional area sum does not equal authoritative total_land_km2 ${area}`);

  const digest = crypto.createHash('sha256').update(JSON.stringify([...beds.values()].map(b => ({ region: b.region, emitters: b.emitters })))).digest('hex');
  return { schema: 'elder-souls/w1-22-emitter-density@1', pass: failures.length === 0,
    floor_per_km2: FLOOR, area_km2: area, emitters: emitters.length, required,
    density_per_km2: +density.toFixed(3), population: perRegion, integrity: {
      unique_ids: ids.size, cluster_cell_m: CLUSTER_CELL_M, max_per_cluster_cell: MAX_PER_CLUSTER_CELL,
      duplicate_radius_m: DUPLICATE_M, on_land: emitters.filter(e => e._on_land).length,
      off_land: emitters.filter(e => e._on_land === false).length,
      max_potential_spatial_overlap: maxPotentialOverlap, max_overlap_probe_m: overlapAt,
      content_sha256: digest }, failures, warnings: warn };
}

const fixture = load();
const result = audit(fixture);
if (args.includes('--self-test')) {
  const clone = structuredClone(fixture);
  for (const bed of clone.beds.values()) bed.emitters = [];
  const negative = audit(clone);
  const gates = new Set(negative.failures.map(x => x.gate));
  if (negative.pass || !gates.has('density-total') || !gates.has('density-region')) {
    console.error('SELF-TEST FAIL: deleting the complete emitter population did not trip both density gates');
    process.exit(2);
  }
  const corrupt = structuredClone(fixture);
  const firstBed = [...corrupt.beds.values()][0];
  const first = firstBed.emitters[0], second = firstBed.emitters[1];
  second.id = first.id;
  second.pos_m = [...first.pos_m];
  delete second.synth;
  const corruptGates = new Set(audit(corrupt).failures.map(x => x.gate));
  if (!['identity', 'duplicates', 'source'].every(g => corruptGates.has(g))) {
    console.error('SELF-TEST FAIL: corrupt identity/position/source did not trip every integrity gate');
    process.exit(2);
  }
  console.log('SELF-TEST PASS: delete-population and corrupt identity/position/source controls trip their gates');
}
if (outputFile) {
  if (!outputFile || outputFile.startsWith('--')) throw new Error('--json requires a path');
  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.pass ? 0 : 1;
