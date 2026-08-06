#!/usr/bin/env node
/**
 * build-pois.mjs — game/data/world/pois.json.
 *
 * Every place the province names: the eight settlements from RI-WLD01 §3, the sixteen minor
 * settlements from §6, the ten map-derived landmarks from §7, and the waystations
 * tools/world/build-roads.mjs inserts to hold RI-WLD01 M5's habitation-gap rule. Each carries the
 * region it actually stands in (read off the built region raster, not asserted) and its ground
 * elevation, so a critic can check both without launching anything.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const scale = rd('corpus/50-world/world-scale.json');
const roads = rd('game/data/world/roads.json');
const terrain = rd('game/data/world/terrain.json');
const field = new WorldField(terrain, rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
field.setRoads(roads);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pois = [];
const add = (id, name, kind, x, z, extra = {}) => {
  const y = field.heightAt(x, z);
  pois.push({
    id, name, kind, region: field.regionAt(x, z).id,
    pos: [+x.toFixed(1), +y.toFixed(2), +z.toFixed(1)],
    slope_deg: +field.slopeAt(x, z).toFixed(2),
    water_band: field.bandOf(field.depthAt(x, z)),
    ...extra,
  });
};
for (const [n, s] of Object.entries(scale.settlements)) add(slug(n), n, 'settlement', s.x, s.z, { tier: s.tier, declared_region: s.region, provenance: 'corpus/50-world/settlements.json — coordinates authoritative' });
for (const [n, s] of Object.entries(scale.minor_settlements)) add(slug(n), n, 'minor-settlement', s.x, s.z, { on_leg: s.on_leg, provenance: 'RI-WLD01 §6' });
for (const [n, s] of Object.entries(scale.landmarks)) add(slug(n), n, 'landmark', s.x, s.z, { provenance: 'RI-WLD01 §7 — read from the map source' });
for (const w of roads.waystations) add(w.id, w.name, 'waystation', w.x, w.z, { leg: w.leg, provenance: 'W1-01 — inserted to hold RI-WLD01 M5 (no habitation gap over 8 walking minutes)' });

const doc = {
  schema: 'elder-souls/pois@1',
  generator: 'tools/world/build-pois.mjs',
  provenance: 'RI-WLD01 §3/§6/§7 verbatim for position; region, elevation, slope and water band read '
            + 'off the BUILT world (game/src/world/field.js), so a coordinate that drifted would show here.',
  declared_incomplete: {
    owner: 'W1-02 (strangeness), W1-04 (settlement anatomy and interiors), W1-05 (signposts and stations)',
    missing: ['dungeon entrances', 'shrines beyond the wayside set', 'named caves', 'signposts', 'transport stations'],
  },
  counts: { settlement: 8, 'minor-settlement': 16, landmark: 10, waystation: roads.waystations.length },
  pois,
};
writeFileSync(join(ROOT, 'game/data/world/pois.json'), JSON.stringify(doc, null, 2) + '\n');
process.stdout.write(`pois.json — ${pois.length} places (${doc.counts.settlement} settlements, ${doc.counts['minor-settlement']} minor, ${doc.counts.landmark} landmarks, ${doc.counts.waystation} waystations)\n`);
const bad = pois.filter((p) => p.water_band !== 'W0' && p.kind !== 'landmark');
if (bad.length) process.stdout.write(`  WARNING: ${bad.length} inhabited places stand in water: ${bad.map((p) => `${p.name} ${p.water_band}`).join(', ')}\n`);
