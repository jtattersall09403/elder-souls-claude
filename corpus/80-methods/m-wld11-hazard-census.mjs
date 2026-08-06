#!/usr/bin/env node
/**
 * m-wld11-hazard-census.mjs — RI-WLD11 M57 (and M63's static half).
 *
 * Static check over `game/data/world/hazards.json` (schema `elder-souls/hazards@1`) against the
 * 13 canonical regions in `corpus/50-world/regions.json`. Enforces RI-WLD11 laws H5 (confinement),
 * H8 (exactly one KILL hazard) and the zero-damage floor, plus S24's requirement that the regions
 * do not share one hazard shape.
 *
 * Usage
 *   node corpus/80-methods/m-wld11-hazard-census.mjs [--data <path>] [--json]
 *
 * Exit codes (HARNESS.md §9): 0 pass · 1 bars failed · 2 usage · 10 data absent · 20 unusable
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };

if (has('--help') || has('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const DATA_FILE = resolve(opt('--data', join(ROOT, 'game', 'data', 'world', 'hazards.json')));
const REGIONS_FILE = join(ROOT, 'corpus', '50-world', 'regions.json');
const CLASSES = ['ATTRITION', 'GATE', 'TRAP', 'VECTOR', 'STRANDING', 'KILL'];
const ZERO_DAMAGE_CLASSES = ['GATE', 'VECTOR', 'STRANDING'];

const die = (code, error, extra = {}) => {
  process.stderr.write(JSON.stringify({ ok: false, error, exit: code, ...extra }) + '\n');
  process.exit(code);
};
const norm = (s) => String(s).normalize('NFKC').replace(/[‘’ʼ']/g, "'").trim().toLowerCase();

if (!existsSync(REGIONS_FILE)) die(20, `missing ${REGIONS_FILE}`);
const REGIONS = Object.keys(JSON.parse(readFileSync(REGIONS_FILE, 'utf8')).regions);
const REGION_SET = new Set(REGIONS.map(norm));

if (!existsSync(DATA_FILE)) {
  die(10, `game data not present yet: ${DATA_FILE} (RI-WLD11 §5 requires it)`, { file: DATA_FILE });
}
let doc;
try { doc = JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
catch (e) { die(20, `unparseable ${DATA_FILE}: ${e.message}`); }
if (doc.schema !== 'elder-souls/hazards@1') die(20, `schema is "${doc.schema}", expected "elder-souls/hazards@1"`);
if (!Array.isArray(doc.hazards)) die(20, 'hazards.json has no `hazards` array');

const failures = [];
const fail = (id, msg) => failures.push({ id, msg });

const ids = new Set();
for (const h of doc.hazards) {
  const where = h.id ?? '(unnamed)';
  if (!h.id) die(20, 'a hazard has no `id`');
  if (ids.has(h.id)) die(20, `hazard id "${h.id}" appears twice`);
  ids.add(h.id);
  if (!CLASSES.includes(h.class)) die(20, `hazard "${where}" has class "${h.class}", expected one of ${CLASSES.join('|')}`);
  if (!Array.isArray(h.regions) || h.regions.length === 0) die(20, `hazard "${where}" lists no regions`);
  for (const r of h.regions) if (!REGION_SET.has(norm(r))) die(20, `hazard "${where}" names unknown region "${r}"`);

  if (h.regions.length > 3) fail('H5-SPREAD', `"${where}" appears in ${h.regions.length} regions, max 3`);
  if (h.signature_of) {
    if (!REGION_SET.has(norm(h.signature_of))) die(20, `hazard "${where}" is signature_of unknown region "${h.signature_of}"`);
    if (h.regions.length !== 1 || norm(h.regions[0]) !== norm(h.signature_of)) {
      fail('H5-SIGNATURE', `"${where}" is the signature of ${h.signature_of} but appears in [${h.regions.join(', ')}] — a signature hazard must appear in exactly its own region`);
    }
  }
  const tell = h.tell ?? {};
  if (h.class !== 'GATE' && (!(tell.lead_s >= 2.0) || !(tell.range_m >= 15))) {
    fail('H1-TELL', `"${where}" declares tell lead ${tell.lead_s ?? '—'} s at ${tell.range_m ?? '—'} m; H1 requires ≥ 2.0 s and ≥ 15 m`);
  }
  if (!Array.isArray(tell.channels) || tell.channels.length === 0) fail('H1-CHANNEL', `"${where}" declares no tell channel`);
  const counters = h.counters ?? [];
  if (counters.length < 2) fail('H3-COUNTERS', `"${where}" declares ${counters.length} counter(s), needs ≥ 2`);
  if (!counters.some((c) => /^(route|knowledge):/.test(c))) {
    fail('H3-KNOWLEDGE', `"${where}" has no route: or knowledge: counter — a hazard beatable only by consumables is a tax`);
  }
  if (h.scales_with_level) fail('H6-SCALING', `"${where}" scales with player level (seam S9, AR-1)`);
  if (h.applies_to_npcs === false) fail('H9-PLAYER-ONLY', `"${where}" does not apply to NPCs — a difficulty setting in a costume`);
  const d = h.damage ?? {};
  if (h.class === 'ATTRITION') {
    if (d.kind !== 'pct_max_hp_per_s') fail('H4-KIND', `"${where}" is ATTRITION but its damage kind is "${d.kind}"`);
    else if (!(d.value <= 1.2)) fail('H4-CEILING', `"${where}" costs ${d.value}% max HP/s, ceiling 1.2`);
  }
  if (ZERO_DAMAGE_CLASSES.includes(h.class) && d.kind && d.kind !== 'none') {
    fail('CLASS-DAMAGE', `"${where}" is ${h.class} and must do zero damage, but declares "${d.kind}" — the tide is time, not health`);
  }
}

const kills = doc.hazards.filter((h) => h.class === 'KILL');
if (kills.length !== 1) fail('H8-ONE-KILL', `${kills.length} KILL hazard(s); exactly 1 is permitted`);
else if (kills[0].id !== 'voriplasm' || norm(kills[0].regions[0] ?? '') !== norm('The Deep Marshes')) {
  fail('H8-WHICH-KILL', `the one KILL hazard is "${kills[0].id}" in ${kills[0].regions.join(', ')}; it must be voriplasm in The Deep Marshes`);
}

const signatures = new Map(doc.hazards.filter((h) => h.signature_of).map((h) => [norm(h.signature_of), h]));
for (const r of REGIONS) {
  if (!signatures.has(norm(r))) fail('H5-COVERAGE', `region "${r}" has no signature hazard`);
}
if (doc.hazards.length < 13) fail('COUNT', `${doc.hazards.length} hazards declared, ≥ 13 required (one signature per region)`);

const zeroDamage = doc.hazards.filter((h) => ZERO_DAMAGE_CLASSES.includes(h.class));
if (zeroDamage.length < 6) fail('ZERO-DAMAGE-FLOOR', `only ${zeroDamage.length} hazards do no damage, ≥ 6 required — the world has become a damage volume`);

// M63 static half: two regions with an identical hazard-class shape is the hazard-shaped form of
// "everything is swamp with a recoloured fog".
const shape = new Map();
for (const r of REGIONS) {
  const classes = doc.hazards.filter((h) => h.regions.some((x) => norm(x) === norm(r)))
    .map((h) => h.class).sort().join('+');
  const sig = signatures.get(norm(r))?.class ?? '-';
  const key = `${classes}|${sig}`;
  if (!shape.has(key)) shape.set(key, []);
  shape.get(key).push(r);
}
for (const [key, rs] of shape) {
  if (rs.length > 1) fail('S24-SHAPE', `regions [${rs.join(', ')}] share an identical hazard shape (${key})`);
}

const result = {
  check: 'RI-WLD11 M57 — hazard census', file: DATA_FILE,
  hazards: doc.hazards.length, kill_hazards: kills.length,
  zero_damage_hazards: zeroDamage.length,
  regions_with_signature: signatures.size, regions_total: REGIONS.length,
  ok: failures.length === 0, failures,
};

if (has('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`RI-WLD11 M57 — hazard census\nsource: ${DATA_FILE}\n`);
  console.log(`hazards ${result.hazards} (≥13) · signatures ${result.regions_with_signature}/${result.regions_total} · ` +
              `KILL ${result.kill_hazards} (=1) · zero-damage ${result.zero_damage_hazards} (≥6)\n`);
  if (!failures.length) console.log('HAZARD CENSUS PASSED — the world has opinions, one per region.');
  else {
    console.log(`HAZARD CENSUS FAILED — ${failures.length} bar(s):`);
    for (const f of failures) console.log(`  [${f.id}] ${f.msg}`);
  }
}

if (failures.length) {
  process.stderr.write(JSON.stringify({ ok: false, error: 'hazard census failed', exit: 1, failures }) + '\n');
  process.exit(1);
}
process.exit(0);
