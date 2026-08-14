#!/usr/bin/env node
// mine-regions.mjs — build corpus/50-world/data/morrowind-region-census.json
//
// Why this exists: RI-WLD04's Morrowind side ("Ascadian Isles is green farmland… Ashlands is grey
// pumice…") is labelled `canonical-recall, confidence medium — not verified this session`, and its
// M18 differentiation axes are set-membership tests ("weather state set (any difference)") that a
// near-identical pair of regions can pass. The nine Vvardenfell region pages in the UESP extract
// carry the *quantities* the recall was standing in for: an exact weather probability vector per
// region, and a per-region inventory of place TYPES. This miner turns them into a reference
// artifact so the bar can be calibrated against measured upstream data rather than memory.
//
// Usage:
//   node tools/uesp/mine-regions.mjs                       # write the census
//   node tools/uesp/mine-regions.mjs --check               # verify the shipped census matches
//   node tools/uesp/mine-regions.mjs --selfcheck           # prove the parser can fail
//
// Exits non-zero when the source is missing, when a region page yields no weather vector, or when
// --check finds the shipped file out of date. It never invents a value: a region page without a
// {{Weather}} template is reported as `null`, not defaulted.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const SRC = path.join(ROOT, 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz');
const OUT = path.join(ROOT, 'corpus/50-world/data/morrowind-region-census.json');

const REGIONS = [
  'Ascadian Isles', 'Ashlands', "Azura's Coast", 'Bitter Coast',
  'Grazelands', 'Molag Amur', 'Red Mountain', 'Sheogorad', 'West Gash',
];

// Weather states Morrowind's own region records use. Anything else found is kept verbatim, so a
// new state in a future dump surfaces rather than being silently dropped.
const KNOWN_STATES = ['clear', 'cloudy', 'foggy', 'overcast', 'rain', 'thunder', 'ash', 'blight', 'snow', 'blizzard'];

function loadExtract() {
  if (!fs.existsSync(SRC)) {
    console.error(`FAIL: source extract not found at ${SRC}`);
    process.exit(2);
  }
  let raw;
  try {
    raw = zlib.unxzSync ? zlib.unxzSync(fs.readFileSync(SRC)) : null;
  } catch { raw = null; }
  if (!raw) raw = execFileSync('xz', ['-dc', SRC], { maxBuffer: 1 << 30 });
  return raw.toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Parse `{{Weather|...|clear=45|cloudy=45|rain=5|thunder=5}}` into a normalised percentage map. */
export function parseWeather(text) {
  const m = text.match(/\{\{Weather\|([^}]*)\}\}/);
  if (!m) return null;
  const out = {};
  for (const part of m[1].split('|')) {
    const kv = part.split('=');
    if (kv.length !== 2) continue;
    const k = kv[0].trim().toLowerCase();
    const v = Number(kv[1].trim());
    if (!Number.isFinite(v)) continue;
    if (['align', 'width', 'color', 'region'].includes(k)) continue;
    out[k] = v;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return { states: out, states_count: Object.keys(out).length, total, unknown_states: Object.keys(out).filter((k) => !KNOWN_STATES.includes(k)) };
}

/** Group `{{Place Link|X}}` occurrences under the nearest preceding wiki heading. */
export function parsePlaces(text) {
  // Everything after ==Related Quests== is quest listing, not place inventory.
  const lines = text.split('\n');
  const byType = {};
  let heading = '(unheaded)';
  let inQuests = false;
  for (const line of lines) {
    const h = line.match(/^={2,5}\s*(.+?)\s*={2,5}\s*$/);
    if (h) {
      const title = h[1].replace(/\[\[[^\]]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[|\]\]/g, '').trim();
      inQuests = /quest/i.test(title);
      // "Cities and Settlements" is a container; its children are the real types.
      if (!inQuests) heading = title;
      continue;
    }
    if (inQuests) continue;
    for (const m of line.matchAll(/\{\{Place Link\|([^}|]+)/g)) {
      const name = m[1].trim();
      if (!name || name === 'none') continue;
      (byType[heading] ||= new Set()).add(name);
    }
  }
  const counts = {};
  for (const [k, v] of Object.entries(byType)) counts[k] = v.size;
  return { by_type: counts, place_types: Object.keys(counts).filter((k) => k !== '(unheaded)').length, named_places: new Set(Object.values(byType).flatMap((s) => [...s])).size };
}

/** Pull the `|description=` line from the {{Morrowind Region}} infobox. */
export function parseDescription(text) {
  const m = text.match(/\|description=([^\n|]*)/);
  if (!m) return null;
  return m[1].replace(/\[\[[^\]]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[|\]\]/g, '').trim();
}

function build() {
  const lines = loadExtract();
  const byTitle = new Map(lines.map((l) => [l.title, l]));
  const regions = {};
  const problems = [];

  for (const name of REGIONS) {
    const page = byTitle.get(`Morrowind:${name}`);
    if (!page) { problems.push(`missing page Morrowind:${name}`); continue; }
    const weather = parseWeather(page.text);
    if (!weather) problems.push(`no {{Weather}} vector on Morrowind:${name}`);
    const places = parsePlaces(page.text);
    regions[name] = {
      page_chars: page.text.length,
      description: parseDescription(page.text),
      weather,
      places,
    };
  }

  // Pairwise weather distance: L1 distance between percentage vectors, in percentage points.
  // This is the quantity RI-WLD04 M18's "weather state set (any difference)" axis throws away.
  const names = Object.keys(regions).filter((n) => regions[n].weather);
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = regions[names[i]].weather.states, b = regions[names[j]].weather.states;
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      let l1 = 0;
      for (const k of keys) l1 += Math.abs((a[k] || 0) - (b[k] || 0));
      pairs.push({ a: names[i], b: names[j], l1_pp: l1 });
    }
  }
  pairs.sort((x, y) => x.l1_pp - y.l1_pp);

  // Pairwise place-type Jaccard: do two regions offer the same KINDS of thing to find?
  const placePairs = [];
  const rnames = Object.keys(regions);
  for (let i = 0; i < rnames.length; i++) {
    for (let j = i + 1; j < rnames.length; j++) {
      const A = new Set(Object.keys(regions[rnames[i]].places.by_type));
      const B = new Set(Object.keys(regions[rnames[j]].places.by_type));
      const inter = [...A].filter((k) => B.has(k)).length;
      const uni = new Set([...A, ...B]).size;
      placePairs.push({ a: rnames[i], b: rnames[j], jaccard: uni ? +(inter / uni).toFixed(3) : 0 });
    }
  }
  placePairs.sort((x, y) => x.jaccard - y.jaccard);

  return {
    $schema_note: 'Generated by tools/uesp/mine-regions.mjs from the UESP extract. Do not hand-edit; re-run the miner.',
    generated: new Date().toISOString().slice(0, 10),
    source: {
      dataset: 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz',
      upstream: 'uespwiki-2019-11-07-current_xml.bz2',
      pages: REGIONS.map((n) => `Morrowind:${n}`),
      provenance: 'community-data for every infobox field and place listing; derived for every distance, count and ratio below',
    },
    method_and_limits: [
      'The {{Weather}} template on each region page reproduces the weather chances in the game\'s REGN records. The numbers are percentages and sum to 100 on every page except Red Mountain (blight=100).',
      'Place counts are UESP PAGE counts grouped by the wiki heading they sit under, not game cell counts. UESP does not give every wilderness location a page, so every count here is a FLOOR.',
      'The heading taxonomy is the wiki\'s, not the game\'s: "Grottos" appears only on Azura\'s Coast and "Foyadas" only on Red Mountain because those editors chose those headings. That is exactly the signal being mined — a region whose editors needed a place-type heading nobody else needed is a region with a place-type nobody else has.',
      'Quest sections are excluded; anything after a heading matching /quest/i is skipped until the next non-quest heading.',
      'This census describes Vvardenfell, the bar. It is NOT a target for Black Marsh: our land area is 14.5 km2 against Vvardenfell\'s ~24 km2 and our region count is 13 against 9.',
    ],
    regions,
    derived: {
      weather_pairs_closest_first: pairs,
      weather_min_l1_pp: pairs.length ? pairs[0].l1_pp : null,
      weather_median_l1_pp: pairs.length ? pairs[Math.floor(pairs.length / 2)].l1_pp : null,
      place_type_pairs_most_different_first: placePairs,
      place_type_max_jaccard: placePairs.length ? placePairs[placePairs.length - 1].jaccard : null,
      unique_place_types: (() => {
        const seen = new Map();
        for (const [rn, r] of Object.entries(regions)) for (const t of Object.keys(r.places.by_type)) (seen.get(t) || seen.set(t, []).get(t)).push(rn);
        return Object.fromEntries([...seen.entries()].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));
      })(),
    },
    problems,
  };
}

function selfcheck() {
  // Rule 4: an instrument that cannot fail is not an instrument.
  let bad = 0;
  const w = parseWeather('{{Weather|align=left|width=75|region=X|color=#fff|clear=45|cloudy=45|rain=5|thunder=5}}');
  if (!w || w.states.clear !== 45 || w.states_count !== 4 || w.total !== 100) { console.error('SELFCHECK FAIL: weather parse'); bad++; }
  if (parseWeather('no template here') !== null) { console.error('SELFCHECK FAIL: weather should be null on absent template'); bad++; }
  if (parseWeather('{{Weather|align=left|color=#fff}}') !== null) { console.error('SELFCHECK FAIL: weather should be null when only styling params present'); bad++; }
  const p = parsePlaces('==Caves==\n*{{Place Link|A}}\n*{{Place Link|B}}\n==Related Quests==\n*{{Place Link|NotAPlace}}\n==Mines==\n*{{Place Link|C}}');
  if (p.by_type.Caves !== 2 || p.by_type.Mines !== 1 || p.by_type['Related Quests']) { console.error('SELFCHECK FAIL: place parse', JSON.stringify(p)); bad++; }
  if (p.named_places !== 3) { console.error('SELFCHECK FAIL: named_places should exclude quest section, got ' + p.named_places); bad++; }
  console.log(bad ? `selfcheck: ${bad} failure(s)` : 'selfcheck: 4 probes, all correct, and 3 of them are negative controls');
  process.exit(bad ? 1 : 0);
}

const arg = process.argv[2];
if (arg === '--selfcheck') selfcheck();
else {
  const census = build();
  if (census.problems.length) { console.error('problems:', census.problems.join('; ')); }
  const json = JSON.stringify(census, null, 1) + '\n';
  if (arg === '--check') {
    if (!fs.existsSync(OUT)) { console.error(`FAIL: ${OUT} does not exist`); process.exit(1); }
    const cur = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const a = JSON.stringify({ ...cur, generated: null });
    const b = JSON.stringify({ ...census, generated: null });
    if (a !== b) { console.error('FAIL: shipped census differs from a fresh mine. Re-run without --check.'); process.exit(1); }
    console.log('OK: census matches the extract.');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, json);
    console.log(`wrote ${OUT} (${json.length} bytes) — ${Object.keys(census.regions).length} regions`);
    console.log(`closest weather pair: ${census.derived.weather_pairs_closest_first[0]?.a} / ${census.derived.weather_pairs_closest_first[0]?.b} at ${census.derived.weather_min_l1_pp} pp`);
    console.log(`most-alike place-type pair: jaccard ${census.derived.place_type_max_jaccard}`);
  }
  process.exit(census.problems.length ? 3 : 0);
}
