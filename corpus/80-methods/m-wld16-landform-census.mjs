#!/usr/bin/env node
// m-wld16-landform-census.mjs — RI-WLD16's instrument.
//
// Three questions, in the order they are cheapest to answer:
//   L1  Does every region declare a landform grammar at all, and are the classes distinct?
//   L2  Does the built terrain agree with what each region declared? (measured vs declared)
//   L3  Do the declared landform ELEMENTS exist in the running world, or is the table prose?
//
// L3 is the CONSUMPTION check (RI-MTH07 / rule 5). A landform table nothing in the world reads is
// the sixteenth subsystem to ship a correct, instrumented model with no consumer. It looks for the
// declared elements among world entities and reports absence loudly. It is EXPECTED to fail today,
// and that failure is the point: it names the work, it does not hide it.
//
// Usage:
//   node corpus/80-methods/m-wld16-landform-census.mjs
//   node corpus/80-methods/m-wld16-landform-census.mjs --selfcheck
//   node corpus/80-methods/m-wld16-landform-census.mjs --json <path>
//
// Exit: 0 all three pass, 1 a check failed, 2 could not measure.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const LANDFORMS = path.join(ROOT, 'corpus/50-world/landforms.json');
const TERRAIN = path.join(ROOT, 'game/data/world/terrain.json');
// Where a landform element could plausibly be realised. Additive: a new world file goes here.
const WORLD_SOURCES = [
  'game/data/world/pois.json',
  'game/data/world/terrain.json',
  'game/data/world/hazards.json',
  'game/data/world/signatures.json',
  'game/data/world/architecture.json',
];

// How far the built terrain may sit from what a macro-form class implies before it is a mismatch.
// Wide on purpose: this check is looking for a *playa* built as a *ridge*, not for fine tuning.
export const FORM_ENVELOPES = {
  'tidal-flat': { relief_range_m: [0, 20], mean_slope_deg: [0, 6] },
  'levee-and-backswamp': { relief_range_m: [5, 40], mean_slope_deg: [0, 8] },
  'raised-bog': { relief_range_m: [10, 90], mean_slope_deg: [2, 10] },
  'karst-tower': { relief_range_m: [60, 400], mean_slope_deg: [7, 25] },
  'escarpment': { relief_range_m: [80, 400], mean_slope_deg: [10, 28] },
  'ridge-and-ravine': { relief_range_m: [150, 600], mean_slope_deg: [18, 45] },
  'alluvial-fan': { relief_range_m: [10, 80], mean_slope_deg: [2, 12] },
  playa: { relief_range_m: [0, 25], mean_slope_deg: [0, 7] },
  badland: { relief_range_m: [15, 120], mean_slope_deg: [4, 20] },
  'dune-and-pan': { relief_range_m: [3, 40], mean_slope_deg: [1, 10] },
  'hummock-field': { relief_range_m: [3, 40], mean_slope_deg: [3, 14] },
  'terrace-staircase': { relief_range_m: [40, 300], mean_slope_deg: [6, 22] },
  'crater-field': { relief_range_m: [5, 60], mean_slope_deg: [2, 14] },
};

export function checkL1(LF) {
  const problems = [];
  const regions = Object.entries(LF.regions);
  if (!regions.length) problems.push('landforms.json declares no regions');
  const formCount = new Map();
  for (const [id, r] of regions) {
    for (const k of ['macro_form', 'drainage', 'bedrock', 'soil', 'landform_elements']) {
      if (!r[k] || (Array.isArray(r[k]) && !r[k].length)) problems.push(`${id}: missing ${k}`);
    }
    if (r.macro_form && !LF.macro_form_classes.includes(r.macro_form)) problems.push(`${id}: macro_form "${r.macro_form}" is not in macro_form_classes`);
    if (r.drainage && !LF.drainage_patterns.includes(r.drainage)) problems.push(`${id}: drainage "${r.drainage}" is not in drainage_patterns`);
    if (Array.isArray(r.landform_elements) && r.landform_elements.length < 4) problems.push(`${id}: only ${r.landform_elements.length} landform elements (need >= 4)`);
    formCount.set(r.macro_form, (formCount.get(r.macro_form) || 0) + 1);
  }
  // RI-WLD16 L1: at most one macro-form class may be shared, and only by two regions.
  const shared = [...formCount.entries()].filter(([, n]) => n > 1);
  if (shared.length > 1) problems.push(`${shared.length} macro-form classes are shared by >1 region (at most 1 permitted): ${shared.map(([f, n]) => `${f}x${n}`).join(', ')}`);
  for (const [f, n] of shared) if (n > 2) problems.push(`macro-form "${f}" is used by ${n} regions (max 2)`);
  // A drainage pattern shared by more than 4 regions means drainage is not differentiating anything.
  const dr = new Map();
  for (const [, r] of regions) dr.set(r.drainage, (dr.get(r.drainage) || 0) + 1);
  for (const [d, n] of dr) if (n > 4) problems.push(`drainage "${d}" is used by ${n} regions (max 4)`);
  return { pass: !problems.length, problems, regions: regions.length, distinct_macro_forms: formCount.size };
}

export function checkL2(LF, T) {
  const problems = [], rows = [];
  const byId = new Map((T.regions || []).map((r) => [r.id, r]));
  for (const [id, r] of Object.entries(LF.regions)) {
    const built = byId.get(id);
    if (!built) { problems.push(`${id}: declared in landforms.json but absent from terrain.json`); continue; }
    const env = FORM_ENVELOPES[r.macro_form];
    if (!env) { problems.push(`${id}: no envelope defined for macro_form "${r.macro_form}"`); continue; }
    const slope = built.mean_slope_deg;
    const relief = r.measured_relief_range_m; // authored from the same raster; L2 re-checks slope live
    const slopeOk = slope >= env.mean_slope_deg[0] && slope <= env.mean_slope_deg[1];
    const reliefOk = relief == null || (relief >= env.relief_range_m[0] && relief <= env.relief_range_m[1]);
    rows.push({ region: id, macro_form: r.macro_form, mean_slope_deg: slope, envelope_slope: env.mean_slope_deg, relief_range_m: relief, envelope_relief: env.relief_range_m, slopeOk, reliefOk });
    if (!slopeOk) problems.push(`${id}: declared "${r.macro_form}" wants mean slope ${env.mean_slope_deg[0]}-${env.mean_slope_deg[1]} deg, built terrain is ${slope} deg`);
    if (!reliefOk) problems.push(`${id}: declared "${r.macro_form}" wants relief range ${env.relief_range_m[0]}-${env.relief_range_m[1]} m, measured ${relief} m`);
  }
  return { pass: !problems.length, problems, rows };
}

/**
 * The element's key phrase — the naming half, before any parenthetical gloss.
 * Matching on loose words instead of the phrase is how this check goes inert in the dangerous
 * direction: "root-levee (the road itself...)" contains "road", and every world has roads, so a
 * word-level matcher reports 71% coverage against a world containing none of these landforms.
 * That happened on the first version of this file and the selfcheck did not catch it, because its
 * negative control was an EMPTY world rather than a generic one. Both controls now run.
 */
export function keyPhrase(el) {
  return el.toLowerCase().split('(')[0].trim().replace(/[\s_]+/g, '-').replace(/-+$/, '');
}
function matches(hay, el) {
  const k = keyPhrase(el);
  if (k.length < 4) return false;
  return hay.includes(k) || hay.includes(k.replace(/-/g, ' ')) || hay.includes(k.replace(/-/g, '_'));
}

export function checkL3(LF, corpusText) {
  const problems = [], rows = [];
  const hay = corpusText.toLowerCase();
  let found = 0, total = 0;
  for (const [id, r] of Object.entries(LF.regions)) {
    const hits = [];
    for (const el of r.landform_elements) {
      total++;
      if (matches(hay, el)) { found++; hits.push(el); }
    }
    rows.push({ region: id, elements: r.landform_elements.length, realised: hits.length, missing: r.landform_elements.filter((e) => !hits.includes(e)) });
    const need = r.elements_required_per_walk ?? 3;
    if (hits.length < need) problems.push(`${id}: ${hits.length} of ${r.landform_elements.length} landform elements appear anywhere in world data (need >= ${need})`);
  }
  return { pass: !problems.length, problems, rows, found, total, coverage: total ? +(found / total).toFixed(3) : 0 };
}

function readWorldText() {
  let s = '';
  for (const rel of WORLD_SOURCES) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) s += fs.readFileSync(p, 'utf8');
  }
  return s;
}

function selfcheck() {
  const bad = [];
  const good = JSON.parse(fs.readFileSync(LANDFORMS, 'utf8'));

  // L1 negative control: collapse every region onto one macro-form.
  const collapsed = JSON.parse(JSON.stringify(good));
  for (const r of Object.values(collapsed.regions)) r.macro_form = 'playa';
  if (checkL1(collapsed).pass) bad.push('L1 NEGATIVE CONTROL PASSED: thirteen regions with one macro-form scored a pass.');
  if (!checkL1(good).pass) bad.push('L1 POSITIVE CONTROL FAILED on the shipped table: ' + checkL1(good).problems.join('; '));

  // L2 negative control: declare the flattest region a ridge-and-ravine.
  const T = fs.existsSync(TERRAIN) ? JSON.parse(fs.readFileSync(TERRAIN, 'utf8')) : null;
  if (T) {
    const lied = JSON.parse(JSON.stringify(good));
    lied.regions['eastern-rootlands'].macro_form = 'ridge-and-ravine';
    if (checkL2(lied, T).pass) bad.push('L2 NEGATIVE CONTROL PASSED: a 3.6-degree tidal flat declared as ridge-and-ravine was accepted.');
  } else bad.push('L2 control skipped: terrain.json missing');

  // L3 negative control 1: an empty world must not satisfy any element.
  const empty = checkL3(good, '');
  if (empty.pass) bad.push('L3 NEGATIVE CONTROL PASSED: an empty world satisfied the landform elements.');
  if (empty.found !== 0) bad.push(`L3 found ${empty.found} elements in an empty world`);
  // L3 negative control 2 (the one that matters): a world full of GENERIC world nouns must score 0.
  // This is the control that catches a matcher keying on words like "road", "water" or "stone".
  const decoy = ('road track path water river hill stone rock cave ruin camp village bridge tower ' +
    'shrine grave wreck marsh swamp tree grass mud sand salt clay hut wall gate dock ford ').repeat(40);
  const dec = checkL3(good, decoy);
  if (dec.found !== 0) bad.push(`L3 GENERIC-WORLD CONTROL FAILED: ${dec.found} landform elements "found" in a world made only of generic nouns — the matcher is inert.`);
  // L3 positive control: a world text containing every element word must satisfy it.
  const all = Object.values(good.regions).flatMap((r) => r.landform_elements).join(' ');
  if (!checkL3(good, all).pass) bad.push('L3 POSITIVE CONTROL FAILED: a world naming every element was still failed.');

  for (const m of bad) console.error('SELFCHECK FAIL: ' + m);
  console.log(bad.length ? `selfcheck: ${bad.length} failure(s)` : 'selfcheck: 3 negative controls go red, 3 positive controls go green.');
  process.exit(bad.length ? 1 : 0);
}

if (process.argv[2] === '--selfcheck') selfcheck();
else {
  if (!fs.existsSync(LANDFORMS)) { console.error(`FAIL: ${LANDFORMS} missing — cannot measure.`); process.exit(2); }
  if (!fs.existsSync(TERRAIN)) { console.error(`FAIL: ${TERRAIN} missing — cannot measure. Absence, not a pass.`); process.exit(2); }
  const LF = JSON.parse(fs.readFileSync(LANDFORMS, 'utf8'));
  const T = JSON.parse(fs.readFileSync(TERRAIN, 'utf8'));
  const l1 = checkL1(LF), l2 = checkL2(LF, T), l3 = checkL3(LF, readWorldText());

  console.log(`L1 landform grammar declared    : ${l1.pass ? 'PASS' : 'FAIL'} — ${l1.regions} regions, ${l1.distinct_macro_forms} distinct macro-forms`);
  for (const p of l1.problems) console.log('   - ' + p);
  console.log(`L2 built terrain matches declared: ${l2.pass ? 'PASS' : 'FAIL'}`);
  for (const p of l2.problems) console.log('   - ' + p);
  console.log(`L3 elements exist in world data  : ${l3.pass ? 'PASS' : 'FAIL'} — ${l3.found}/${l3.total} elements found (${(l3.coverage * 100).toFixed(0)}%)`);
  for (const p of l3.problems) console.log('   - ' + p);

  const ji = process.argv.indexOf('--json');
  if (ji > 0 && process.argv[ji + 1]) fs.writeFileSync(process.argv[ji + 1], JSON.stringify({ l1, l2, l3 }, null, 1));
  const pass = l1.pass && l2.pass && l3.pass;
  console.log(`\nRI-WLD16 verdict: ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}
