#!/usr/bin/env node
/**
 * m-wld10-water-census.mjs — RI-WLD10 M47 (and M54's static half).
 *
 * THE S24 GATE. `ARBITRATION.md` S24: "Black Marsh is the name, not the terrain." Water is a
 * property of SOME regions and never of the world. This script fails a globally-swampy world
 * from a static data file, before a browser is ever opened.
 *
 * Inputs
 *   game/data/world/water.json          schema `elder-souls/water@1` (RI-WLD10 §11)
 *   corpus/50-world/regions.json        the 13 canonical regions and their areas (authoritative)
 *
 * Usage
 *   node corpus/80-methods/m-wld10-water-census.mjs
 *   node corpus/80-methods/m-wld10-water-census.mjs --data <path/to/water.json>
 *   node corpus/80-methods/m-wld10-water-census.mjs --reference    # score RI-WLD10 §8's own table
 *   node corpus/80-methods/m-wld10-water-census.mjs --json         # machine-readable result
 *
 * Exit codes (HARNESS.md §9)
 *   0   all bars met
 *   2   usage error
 *   10  game/data/world/water.json does not exist yet   <-- expected before the builder starts
 *   20  the file exists but is unusable (bad schema, unknown regions, missing fields)
 *   1   the file is well formed and FAILS one or more S24 bars
 *
 * On failure a single-line JSON object is printed on stderr so a supervising agent can parse it.
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

const AS_JSON = has('--json');
const REGIONS_FILE = join(ROOT, 'corpus', '50-world', 'regions.json');
const DATA_FILE = resolve(opt('--data', join(ROOT, 'game', 'data', 'world', 'water.json')));

// ---------------------------------------------------------------- the bars (RI-WLD10 §8)

const BARS = {
  wci_province: [0.22, 0.42],   // area-weighted, inclusive
  spread_min: 0.55,             // max(WCI) - min(WCI)
  dry_regions_min: 4,           // WCI <= 0.05
  bone_dry_regions_min: 2,      // WCI == 0.00
  drowned_regions_max: 3,       // WCI >= 0.60
  distinct_classes_min: 6,
  tidal_regions: [
    'Crimson Coast', 'Eastern Rootlands', 'Marauder’s Coast',
    'Stone Wastes', 'Western Rootlands',
  ],
  min_extinction_k: 0.30,       // §10.1 — no clear tropical water in this province
};

// RI-WLD10 §8's own table, so `--reference` can prove the bars are satisfiable and so a
// builder has a worked example to diff against. NOT a default: a missing data file is exit 10.
const REFERENCE = {
  schema: 'elder-souls/water@1',
  regions: [
    { region: 'The Clay Moor',       wci: 0.00, class: 'arid',            deepest_band: 'W0', tidal: false, sea: null,         k: null },
    { region: 'The Hive',            wci: 0.00, class: 'arid',            deepest_band: 'W0', tidal: false, sea: null,         k: null },
    { region: 'Valus Ridge',         wci: 0.01, class: 'dry-upland',      deepest_band: 'W3', tidal: false, sea: null,         k: 0.9 },
    { region: 'The Salt Hills',      wci: 0.02, class: 'dry-upland',      deepest_band: 'W2', tidal: false, sea: null,         k: 0.8 },
    { region: 'Stone Wastes',        wci: 0.03, class: 'arid-salt-fringe',deepest_band: 'W3', tidal: true,  sea: 'topal',      k: 1.4 },
    { region: 'The Stone Forest',    wci: 0.06, class: 'damp',            deepest_band: 'W2', tidal: false, sea: null,         k: 1.1 },
    { region: 'Thornmarsh',          wci: 0.09, class: 'seasonal',        deepest_band: 'W2', tidal: false, sea: null,         k: 2.0 },
    { region: 'Crimson Coast',       wci: 0.34, class: 'tidal-littoral',  deepest_band: 'W5', tidal: true,  sea: 'padomaic',   k: 0.35 },
    { region: 'Blackwood',           wci: 0.41, class: 'flooded-forest',  deepest_band: 'W5', tidal: false, sea: null,         k: 2.6 },
    { region: 'Western Rootlands',   wci: 0.47, class: 'paddy-channel',   deepest_band: 'W4', tidal: true,  sea: 'topal',      k: 1.9 },
    { region: 'Marauder’s Coast', wci: 0.58, class: 'tidal-flat',    deepest_band: 'W5', tidal: true,  sea: 'topal',      k: 1.4 },
    { region: 'Eastern Rootlands',   wci: 0.71, class: 'tidal-delta',     deepest_band: 'W5', tidal: true,  sea: 'padomaic',   k: 3.2 },
    { region: 'The Deep Marshes',    wci: 0.86, class: 'drowned',         deepest_band: 'W5', tidal: false, sea: null,         k: 4.5 },
  ],
};

// ---------------------------------------------------------------- load

function die(code, error, extra = {}) {
  process.stderr.write(JSON.stringify({ ok: false, error, exit: code, ...extra }) + '\n');
  process.exit(code);
}

if (!existsSync(REGIONS_FILE)) die(20, `missing ${REGIONS_FILE}`);
const regionsDoc = JSON.parse(readFileSync(REGIONS_FILE, 'utf8'));
const AREAS = new Map(Object.entries(regionsDoc.regions).map(([k, v]) => [norm(k), v.area_km2]));
const CANON = new Map(Object.entries(regionsDoc.regions).map(([k]) => [norm(k), k]));

// Region names carry a typographic apostrophe in one case ("Marauder's Coast"); normalise so a
// builder is never failed for a quote character.
function norm(s) {
  return String(s).normalize('NFKC').replace(/[‘’ʼ']/g, "'").trim().toLowerCase();
}

let doc;
let mode;
if (has('--reference')) {
  doc = REFERENCE;
  mode = 'reference';
} else {
  if (!existsSync(DATA_FILE)) {
    die(10, `game data not present yet: ${DATA_FILE} (RI-WLD10 §11 requires it)`, { file: DATA_FILE });
  }
  try { doc = JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { die(20, `unparseable ${DATA_FILE}: ${e.message}`); }
  mode = 'game-data';
}

if (doc.schema !== 'elder-souls/water@1') {
  die(20, `schema is "${doc.schema}", expected "elder-souls/water@1"`);
}
if (!Array.isArray(doc.regions) || doc.regions.length === 0) {
  die(20, 'water.json has no `regions` array');
}

// ---------------------------------------------------------------- validate coverage of the 13

const failures = [];
const seen = new Map();
for (const r of doc.regions) {
  if (typeof r.region !== 'string') die(20, 'a region entry has no `region` name');
  const n = norm(r.region);
  if (!AREAS.has(n)) die(20, `unknown region "${r.region}" (not in corpus/50-world/regions.json)`);
  if (seen.has(n)) die(20, `region "${r.region}" appears twice`);
  if (typeof r.wci !== 'number' || r.wci < 0 || r.wci > 1) {
    die(20, `region "${r.region}" has a missing or out-of-range \`wci\` (${r.wci})`);
  }
  if (typeof r.tidal !== 'boolean') die(20, `region "${r.region}" has no boolean \`tidal\``);
  seen.set(n, r);
}
for (const n of AREAS.keys()) {
  if (!seen.has(n)) die(20, `region "${CANON.get(n)}" is missing from water.json — all 13 must be declared`);
}

// ---------------------------------------------------------------- compute

const rows = [...seen.entries()].map(([n, r]) => ({
  region: CANON.get(n), km2: AREAS.get(n), wci: r.wci,
  cls: r.class ?? null, tidal: !!r.tidal, sea: r.sea ?? null, k: r.k ?? null,
  deepest: r.deepest_band ?? null,
})).sort((a, b) => a.wci - b.wci);

const totalArea = rows.reduce((s, r) => s + r.km2, 0);
const wciProvince = rows.reduce((s, r) => s + r.km2 * r.wci, 0) / totalArea;
const wciMax = Math.max(...rows.map((r) => r.wci));
const wciMin = Math.min(...rows.map((r) => r.wci));
const spread = wciMax - wciMin;
const dry = rows.filter((r) => r.wci <= 0.05);
const boneDry = rows.filter((r) => r.wci === 0);
const drowned = rows.filter((r) => r.wci >= 0.60);
const classes = new Set(rows.map((r) => r.cls).filter(Boolean));
const tidal = rows.filter((r) => r.tidal).map((r) => r.region).sort();
const expectedTidal = [...BARS.tidal_regions].sort();
const badK = rows.filter((r) => typeof r.k === 'number' && r.k < BARS.min_extinction_k);

const check = (id, ok, msg) => { if (!ok) failures.push({ id, msg }); return ok; };

check('WCI-PROVINCE',
  wciProvince >= BARS.wci_province[0] && wciProvince <= BARS.wci_province[1],
  `area-weighted WCI ${wciProvince.toFixed(3)} outside [${BARS.wci_province.join(', ')}] — ` +
  (wciProvince < BARS.wci_province[0] ? 'this is not a marsh' : 'the world is a puddle'));

check('SPREAD',
  spread >= BARS.spread_min,
  `max−min WCI is ${spread.toFixed(3)}, needs ≥ ${BARS.spread_min} — one water profile smeared over 13 regions (S24)`);

check('DRY-COUNT',
  dry.length >= BARS.dry_regions_min,
  `only ${dry.length} region(s) at WCI ≤ 0.05, needs ≥ ${BARS.dry_regions_min} — the arid half of the province is missing (S24)`);

check('BONE-DRY-COUNT',
  boneDry.length >= BARS.bone_dry_regions_min,
  `only ${boneDry.length} region(s) with NO standing water, needs ≥ ${BARS.bone_dry_regions_min} (the Clay Moor and the Hive)`);

check('DROWNED-COUNT',
  drowned.length <= BARS.drowned_regions_max,
  `${drowned.length} region(s) at WCI ≥ 0.60, max ${BARS.drowned_regions_max} — the world is mostly swim`);

check('CLASS-VARIETY',
  classes.size >= BARS.distinct_classes_min,
  `only ${classes.size} distinct water classes, needs ≥ ${BARS.distinct_classes_min} — one water with several names`);

check('TIDAL-SET',
  JSON.stringify(tidal.map(norm)) === JSON.stringify(expectedTidal.map(norm)),
  `tidal regions are [${tidal.join(', ')}], must be exactly [${expectedTidal.join(', ')}] — ` +
  'a tide anywhere else is the tide as a global shader (RI-WLD10 §7)');

check('EXTINCTION-FLOOR',
  badK.length === 0,
  `region(s) declare k < ${BARS.min_extinction_k}: ${badK.map((r) => `${r.region}=${r.k}`).join(', ')} — ` +
  'clear tropical water is not in this province (RI-WLD10 §10.1)');

// ---------------------------------------------------------------- report

const result = {
  check: 'RI-WLD10 M47 — the S24 regional water census',
  mode, file: mode === 'reference' ? '(RI-WLD10 §8 reference table)' : DATA_FILE,
  total_land_km2: Number(totalArea.toFixed(2)),
  wci_province: Number(wciProvince.toFixed(3)),
  wci_min: wciMin, wci_max: wciMax, spread: Number(spread.toFixed(3)),
  dry_regions: dry.map((r) => r.region),
  bone_dry_regions: boneDry.map((r) => r.region),
  drowned_regions: drowned.map((r) => r.region),
  distinct_classes: classes.size,
  tidal_regions: tidal,
  ok: failures.length === 0,
  failures,
};

if (AS_JSON) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const pad = Math.max(...rows.map((r) => r.region.length));
  console.log(`RI-WLD10 M47 — the S24 regional water census  [${mode}]`);
  console.log(`source: ${result.file}\n`);
  console.log(`${'region'.padEnd(pad)}   km²    WCI   class                tide  sea        k`);
  console.log('-'.repeat(pad + 52));
  for (const r of rows) {
    console.log(
      `${r.region.padEnd(pad)}  ${String(r.km2).padStart(4)}  ${r.wci.toFixed(2)}   ` +
      `${String(r.cls ?? '-').padEnd(19)} ${r.tidal ? ' yes' : '  - '}  ` +
      `${String(r.sea ?? '-').padEnd(9)} ${r.k == null ? '-' : r.k}`);
  }
  console.log('-'.repeat(pad + 52));
  console.log(`area-weighted WCI  ${result.wci_province}   bar [${BARS.wci_province.join(', ')}]`);
  console.log(`spread             ${result.spread}   bar ≥ ${BARS.spread_min}`);
  console.log(`dry (≤0.05)        ${dry.length}       bar ≥ ${BARS.dry_regions_min}   ${dry.map((r) => r.region).join(', ')}`);
  console.log(`bone dry (=0.00)   ${boneDry.length}       bar ≥ ${BARS.bone_dry_regions_min}   ${boneDry.map((r) => r.region).join(', ')}`);
  console.log(`drowned (≥0.60)    ${drowned.length}       bar ≤ ${BARS.drowned_regions_max}   ${drowned.map((r) => r.region).join(', ')}`);
  console.log(`water classes      ${classes.size}       bar ≥ ${BARS.distinct_classes_min}`);
  console.log(`tidal regions      ${tidal.length}       bar = 5 exactly`);
  console.log('');
  if (failures.length === 0) {
    console.log('S24 WATER CENSUS PASSED — the province has an arid half.');
  } else {
    console.log(`S24 WATER CENSUS FAILED — ${failures.length} bar(s):`);
    for (const f of failures) console.log(`  [${f.id}] ${f.msg}`);
  }
}

if (failures.length) {
  process.stderr.write(JSON.stringify({ ok: false, error: 'S24 water census failed', exit: 1, failures }) + '\n');
  process.exit(1);
}
process.exit(0);
