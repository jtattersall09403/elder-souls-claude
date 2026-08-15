#!/usr/bin/env node
/**
 * f7-critic-deck-region.mjs — F7 CRITIC. DOES THE DECK NAME THE REGION IT LANDS IN?
 *
 * The builder's headline artefact `before-after-topdown.png` is captioned `vista-deep-marshes`
 * and its in-frame region label reads `western-rootlands`. The builder recorded the same symptom
 * at `eye-blackwood` and called it a deck bug it did not own. If the deck's coordinates do not
 * land in the regions the deck names, then every per-region water number in this project — the
 * builder's, and the thirteen-region preservation control it rests on — is attributed to the
 * wrong region.
 *
 * This needs no browser and no GPU: `WorldField` is the same class the engine builds at
 * engine.js:337 from the same three data files, and `regionAt(x, z)` is the same call the HUD
 * label and `getWaterAt` both go through.
 *
 *   node tools/visual/f7-critic-deck-region.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const terrain = rd('game/data/world/terrain.json');
const regions = rd('game/data/world/regions.json');
const water = rd('game/data/world/water.json');
const DECK = rd('tools/visual/deck.json');

const field = new WorldField(terrain, regions, water);
const rows = [];
for (const s of DECK.setups) {
  if (!s.place || s.place.kind !== 'teleport') continue;
  const r = field.regionAt(s.place.x, s.place.z);
  const id = r && (r.id || r.name) || null;
  const w = field.waterSurfaceAt ? field.waterSurfaceAt(s.place.x, s.place.z) : null;
  const h = field.heightAt ? field.heightAt(s.place.x, s.place.z) : null;
  rows.push({
    setup: s.id, declared_region: s.region, actual_region: id,
    match: String(id) === String(s.region),
    x: s.place.x, z: s.place.z,
    ground_y: h === null || h === undefined ? null : +Number(h).toFixed(2),
    water_y: w === null || w === undefined ? null : +Number(w).toFixed(2),
    under_water: (w !== null && w !== undefined && h !== null && h !== undefined) ? w > h : null,
  });
}
const bad = rows.filter((r) => !r.match);
const out = {
  tool: 'f7-critic-deck-region', generated: new Date().toISOString(),
  source: 'game/data/world/{terrain,regions,water}.json via WorldField — the same construction as engine.js:337',
  setups_checked: rows.length, mismatches: bad.length,
  mismatch_list: bad.map((r) => `${r.setup}: deck says ${r.declared_region}, WorldField.regionAt(${r.x},${r.z}) says ${r.actual_region}`),
  rows,
};
const OUT = path.resolve(REPO, process.argv[2] || 'reports/visual-truth/f7-critic/deck-region.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`${rows.length} deck setups checked, ${bad.length} land in a region the deck does not name`);
for (const l of out.mismatch_list) console.log('  ' + l);
