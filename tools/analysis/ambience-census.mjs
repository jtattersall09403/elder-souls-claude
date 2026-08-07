#!/usr/bin/env node
// RI-AUD03 B4 — the layer census. Static, no browser, no engine.
//
// W1-22, `audio.ambience.region`. RI-AUD03's comparison method step 6 names
// `tools/analysis/content-stats.mjs --audio game/data/audio/ambience/`; that flag does not exist
// and `content-stats.mjs` knows nothing about audio, so per orchestration/TOOL-LOOP.md the tool
// is written here rather than cited as though it ran. It implements what the item's §Scoring B4
// row actually specifies, plus three checks the item's prose demands and its B4 row does not
// enumerate (denies, the §C key, and R6's cross-reference).
//
// WHAT THIS TOOL DOES NOT DO, AND WHY THAT MATTERS. It reads JSON. It cannot tell you whether
// anything is audible, and it must never be quoted as though it could — the whole defect this
// piece was dispatched against is audio axes scored by reading strings out of a data file. The
// audibility evidence is `tools/analysis/ambience-render.mjs`, which renders real PCM in a
// browser and measures its spectrum. A green census with a red render means thirteen beautifully
// declared beds that make no sound, which is precisely the failure worth being able to name.
//
//   node tools/analysis/ambience-census.mjs [--json]
//
// Exit 0 = every check passed. Exit 1 = at least one failed. Exit 2 = the data is not there.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DIR = join(ROOT, 'game', 'data', 'audio', 'ambience');
const REGIONS = join(ROOT, 'game', 'data', 'world', 'regions.json');

/**
 * RI-AUD03 §C's grading key, transcribed from the item. A bed whose declared `key` disagrees
 * with this table has drifted from the thing the blind test will be graded against, and the
 * drift would show up as a mysterious B1 failure months later. Better to fail here.
 */
const KEY = {
  'western-rootlands': ['wet', 'open', 'living'],
  'blackwood': ['wet', 'enclosed', 'living'],
  'eastern-rootlands': ['wet', 'open', 'living'],
  'marauders-coast': ['wet', 'open', 'living'],
  'hive': ['dry', 'enclosed', 'living'],
  'salt-hills': ['dry', 'open', 'living'],
  'stone-forest': ['dry', 'enclosed', 'living'],
  'thornmarsh': ['dry', 'enclosed', 'dead'],
  'valus-ridge': ['dry', 'open', 'dead'],
  'clay-moor': ['dry', 'open', 'living'],
  'crimson-coast': ['wet', 'open', 'living'],
  'deep-marshes': ['wet', 'enclosed', 'dead'],
  'stone-wastes': ['dry', 'open', 'dead'],
};

const json = process.argv.includes('--json');
const fails = [];
const warns = [];
const fail = (id, msg) => fails.push({ check: id, message: msg });
const warn = (id, msg) => warns.push({ check: id, message: msg });

if (!existsSync(REGIONS)) { console.error('ambience-census: game/data/world/regions.json missing'); process.exit(2); }
const regions = JSON.parse(readFileSync(REGIONS, 'utf8')).regions;

if (!existsSync(DIR)) {
  console.error(`ambience-census: ${DIR} does not exist.`);
  console.error('RI-AUD03: "a region with no <region>.json audio file scores 0 for that region');
  console.error('and cannot be excluded from the 13." So this is 0/13, not "not assessed".');
  process.exit(2);
}

const beds = {};
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  beds[doc.id || f.replace(/\.json$/, '')] = doc;
}

// ---- C1: coverage --------------------------------------------------------------------------
const missing = regions.filter((r) => !beds[r.id]).map((r) => r.id);
if (missing.length) fail('C1', `${missing.length} of ${regions.length} regions have no bed: ${missing.join(', ')}`);
const orphan = Object.keys(beds).filter((id) => !regions.some((r) => r.id === id));
if (orphan.length) fail('C1', `bed(s) for regions that do not exist: ${orphan.join(', ')}`);

// ---- C2: all four layers declared; null permitted and COUNTED as declared (R1) ---------------
for (const r of regions) {
  const b = beds[r.id];
  if (!b) continue;
  for (const L of ['L1', 'L2', 'L3', 'L4']) {
    if (!Object.prototype.hasOwnProperty.call(b.layers || {}, L)) {
      fail('C2', `${r.id}: layer ${L} is not declared at all. R1 permits null; it does not permit absent — "null is a design statement, not an omission", and a missing key is indistinguishable from unfinished work.`);
    } else if (b.layers[L] === null && !b.layers[`${L}_null_reason`]) {
      fail('C2', `${r.id}: ${L} is null with no ${L}_null_reason. A null layer that does not say why it is null is the omission R1 exists to distinguish from a design statement.`);
    }
  }
  if (b.layers && b.layers.L1 === null) fail('C2', `${r.id}: L1 is null. Every region has a floor; §A calls L1 "the floor... never stops while the region is loaded".`);
}

// ---- C3: R2 — no region shares an L1 with another region --------------------------------------
const byL1 = new Map();
for (const [id, b] of Object.entries(beds)) {
  const l1 = b.layers && b.layers.L1 && b.layers.L1.id;
  if (!l1) continue;
  if (!byL1.has(l1)) byL1.set(l1, []);
  byL1.get(l1).push(id);
}
for (const [l1, ids] of byL1) {
  if (ids.length > 1) {
    fail('C3', `HARD FAIL (R2): L1 "${l1}" is shared by ${ids.join(', ')}. Thirteen regions, thirteen base drones. This is the single rule that most directly produces the blind-test result, and sharing one L1 is the "one swamp loop" failure RI-AUD03 §How we lose ranks first.`);
  }
}

// ---- C4: interval bands (§A L3 8–40 s, L4 45–180 s) -------------------------------------------
const band = (v, lo, hi) => Array.isArray(v) && v.length === 2 && v[0] >= lo && v[1] <= hi && v[0] < v[1];
for (const [id, b] of Object.entries(beds)) {
  const L3 = b.layers.L3, L4 = b.layers.L4;
  if (L3 && !band(L3.interval_s, 8, 40)) fail('C4', `${id}: L3 interval ${JSON.stringify(L3.interval_s)} outside §A's 8–40 s. A signature raised to every 15 s stops being a landmark and becomes wallpaper.`);
  if (L3 && L3.night_interval_s && !band(L3.night_interval_s, 8, 40)) fail('C4', `${id}: L3 night interval ${JSON.stringify(L3.night_interval_s)} outside 8–40 s.`);
  if (L4 && !band(L4.interval_s, 45, 180)) fail('C4', `${id}: L4 interval ${JSON.stringify(L4.interval_s)} outside §A's 45–180 s.`);
}

// ---- C5: denies — absence is content, and it must BITE ----------------------------------------
// R1's real teeth. A region that says "NO birdsong" must not contain a sound tagged `birdsong`
// anywhere in any layer. Without this the additive reflex RI-AUD03 §How we lose item 2 predicts
// — "both quietly get the standard bird layer because it is already wired up" — is undetectable.
function* sounds(b) {
  const L = b.layers;
  if (L.L1) yield { where: 'L1', classes: L.L1.classes || [], id: L.L1.id };
  if (L.L2) for (const s of L.L2.sublayers || []) yield { where: 'L2', classes: s.classes || [], id: L.L2.id };
  for (const k of ['L3', 'L4']) {
    if (L[k]) for (const e of L[k].events || []) yield { where: k, classes: e.classes || [], id: e.id };
  }
  for (const e of b.emitters || []) yield { where: 'emitter', classes: e.classes || [], id: e.id };
}
let deniedTotal = 0;
for (const [id, b] of Object.entries(beds)) {
  const denied = new Set((b.denies || []).map((d) => d.class));
  deniedTotal += denied.size;
  for (const d of b.denies || []) {
    if (!d.why || d.why.length < 20) fail('C5', `${id}: denies "${d.class}" with no substantive reason. An unexplained denial is indistinguishable from a typo.`);
  }
  for (const s of sounds(b)) {
    for (const c of s.classes) {
      if (denied.has(c)) fail('C5', `${id}: ${s.where} "${s.id}" is tagged "${c}" but the region denies "${c}". This is the standard layer being quietly wired up into the region whose identity is that it has none.`);
    }
  }
}
// The four regions whose brief states an absence in words must actually declare it.
for (const [id, needs] of Object.entries({
  'thornmarsh': ['birdsong'], 'deep-marshes': ['birdsong'], 'salt-hills': ['insect_layer'], 'stone-wastes': ['insect_layer'],
})) {
  const b = beds[id];
  if (!b) continue;
  const have = new Set((b.denies || []).map((d) => d.class));
  for (const n of needs) {
    if (!have.has(n)) fail('C5', `${id}: regions.json says its ambience is partly defined by the absence of ${n}, and the bed does not deny it. The absence is the identity (RI-AUD03 §A R1).`);
  }
}

// ---- C6: §C key agreement ---------------------------------------------------------------------
for (const [id, k] of Object.entries(KEY)) {
  const b = beds[id];
  if (!b) continue;
  const got = [b.key.wet_dry, b.key.open_enclosed, b.key.living_dead];
  if (got.join('|') !== k.join('|')) fail('C6', `${id}: declared key ${got.join('/')} disagrees with RI-AUD03 §C's grading key ${k.join('/')}. B1 grades Q2 against §C, so a bed built to a different key fails a test it was never given a chance to pass.`);
}

// ---- C7: R6 — the two lore cross-references ---------------------------------------------------
{
  const sw = beds['stone-wastes'], sf = beds['stone-forest'];
  if (sw && sf) {
    const d = sw.layers.L4 && sw.layers.L4.derived_from;
    if (!d || d.region !== 'stone-forest') {
      fail('C7', 'stone-wastes L4 does not declare derived_from stone-forest. R6: the dying Hist IS the Stone Forest\'s choral hum degraded, and "the two must be recognisably the same instrument, one of them broken".');
    } else {
      const a = JSON.stringify(sf.layers.L1.synth.partials_hz);
      const ev = (sw.layers.L4.events || [])[0];
      const bpart = ev && ev.synth && JSON.stringify(ev.synth.partials_hz);
      if (a !== bpart) fail('C7', `stone-wastes' dying Hist has partials ${bpart} but stone-forest's hum has ${a}. Same instrument means the same partials; only the detune and the envelope may differ.`);
      else if (!(ev.synth.detune_cents > sf.layers.L1.synth.detune_cents * 3)) {
        fail('C7', 'stone-wastes\' dying Hist is not audibly broken: its detune is not meaningfully wider than the healthy chord\'s. "Recognisably the same instrument" is half the rule; "one of them broken" is the other half.');
      }
    }
  }
  const dm = beds['deep-marshes'];
  if (dm && !(dm.layers.L4 && dm.layers.L4.lore_carrier)) {
    warn('C7', 'deep-marshes L4 is not flagged lore_carrier. R6 names it as one of the two places ambience carries lore rather than identity.');
  }
}

// ---- C8: R7 — the three positional emitters ---------------------------------------------------
const R7 = { 'marauders-coast': 'bell_buoy', 'salt-hills': 'legion_horn', 'clay-moor': 'kiln' };
for (const [rid, eid] of Object.entries(R7)) {
  const b = beds[rid];
  if (!b) continue;
  const e = (b.emitters || []).find((x) => x.id === eid);
  if (!e) { fail('C8', `${rid}: R7 emitter "${eid}" is missing. Without it the world cannot tell the player where they are by sound, which is the ambience contribution to S8.`); continue; }
  if (!Array.isArray(e.pos_m) || e.pos_m.length !== 2) fail('C8', `${rid}/${eid}: no world position. A region-wide layer is not a landmark.`);
  if (!(e.audible_m > 0)) fail('C8', `${rid}/${eid}: no audible_m.`);
  const r = regions.find((x) => x.id === rid);
  if (r && e.pos_m) {
    const inX = e.pos_m[0] >= r.bounds_m.x[0] && e.pos_m[0] <= r.bounds_m.x[1];
    const inZ = e.pos_m[1] >= r.bounds_m.z[0] && e.pos_m[1] <= r.bounds_m.z[1];
    if (!(inX && inZ)) fail('C8', `${rid}/${eid} at ${JSON.stringify(e.pos_m)} is outside the region's own AABB ${JSON.stringify(r.bounds_m)}.`);
  }
}
if (beds['marauders-coast']) {
  const e = (beds['marauders-coast'].emitters || []).find((x) => x.id === 'bell_buoy');
  if (e && e.audible_m !== 600) fail('C8', `the bell buoy is audible from ${e.audible_m} m; regions.json says 600 m, verbatim.`);
}

// ---- C13: EMITTER RARITY — the check that did not exist, and the one that had gone wrong ------
//
// ROUND 2, from the round-1 verdict §4. C8 above checked only that the emitters EXIST. Nothing
// bounded how often they fire, and `bell_buoy.period_s` was **13 seconds** — 92 rings in a
// twenty-minute walk. RI-AUD03 §How we lose is explicit about why that is a defect and not a
// taste question:
//
//   "The hide-drum's 90-second beat, the legion horn on the hour, the bell buoy — each is
//    distinctive BECAUSE IT IS RARE. Someone finds them atmospheric and raises the rate to every
//    15 seconds. Identity becomes irritation, and the positional emitters stop being
//    navigational because a landmark you hear constantly carries no position."
//
// The item asserts "§A L3/L4 interval bands are checked in B4 for this reason". They are — but
// moving the hide-drum out of L3 (which round 1 was right to do: §A caps L3 at 8–40 s and §B
// gives the drum 90) moved the signature out of the only band check the item had. This restores
// one for the layer the signatures now live in.
//
// The bound is §A's L4 rarity floor, 45 s, because that is the item's own number for "a sound
// that punctuates rather than fills". The legion horn at 3600 s is far above it and that is the
// point. There is no upper bound: an hourly clock is a legitimate landmark.
//
// NOT CHECKED, deliberately: the mean of an L3 band. The round-1 critic found that setting an L3
// interval to a flat 15 s stays green, and it does — because 15 s is inside §A's own 8–40 s
// permission for L3. §A and §How-we-lose disagree there, and a builder's census is not the place
// to overrule the item's published band. What the prose actually names as the wallpaper risk is
// the SIGNATURE sounds, and those are exactly the R7 emitters this check now covers.
for (const [id, b] of Object.entries(beds)) {
  for (const e of b.emitters || []) {
    const continuous = e.synth && (e.synth.kind === 'noise' || e.synth.kind === 'drone');
    if (continuous) {
      if (e.period_s !== undefined) {
        fail('C13', `${id}/${e.id}: a continuous emitter (synth.kind "${e.synth.kind}") declares period_s ${e.period_s}. A continuous source has no period; the field would be read by nothing and believed by everyone.`);
      }
      if (e.mode && e.mode !== 'continuous') fail('C13', `${id}/${e.id}: declares mode "${e.mode}" but its synth kind is "${e.synth.kind}", which is continuous.`);
      continue;
    }
    if (e.period_s === undefined) {
      fail('C13', `${id}/${e.id}: a struck emitter with no period_s. It would fall through to a hardcoded default, which is a rate nobody chose and no check can see.`);
    } else if (!(e.period_s >= 45)) {
      fail('C13', `${id}/${e.id}: period_s ${e.period_s} is under §A's 45 s L4 rarity floor. A landmark you hear constantly carries no position (RI-AUD03 §How we lose).`);
    }
    if (e.phase !== undefined && !(e.phase >= 0 && e.phase < 1)) {
      fail('C13', `${id}/${e.id}: phase ${e.phase} is not a fraction of a period in [0, 1).`);
    }
  }
}

// ---- C9: voice budget (RI-AUD02 V5, ambience ≤ 8) ---------------------------------------------
//
// L2's sublayers are NOT all concurrent, and counting them as though they were is the wrong
// answer in the safe direction — which is still the wrong answer, because it would push a
// builder to delete a night selection to get under a cap that night selection never breaches.
// R5 is the reason: "night is a different L2/L4 SELECTION, not a filter", so a day sublayer and
// a night sublayer can never sound together. Weather sublayers can stack with either. So the
// worst case is the worse of the two time-of-day worlds, not the sum of all of them.
function maxConcurrentL2(L2) {
  if (!L2) return 0;
  const subs = L2.sublayers || [];
  let worst = 0;
  for (const tod of ['day', 'night']) {
    let n = 0;
    for (const s of subs) if (!s.when || !s.when.tod || s.when.tod === tod) n++;
    worst = Math.max(worst, n);
  }
  return worst;
}
for (const [id, b] of Object.entries(beds)) {
  const L = b.layers;
  const l1 = L.L1 ? (L.L1.voices || 1) : 0;
  const l2 = maxConcurrentL2(L.L2);
  const worst = l1 + l2 + 2 + 2 + (b.emitters || []).length;   // §A caps L3 and L4 at 2 concurrent each
  if (worst > 8) fail('C9', `${id}: worst-case ambience voices ${worst} exceeds RI-AUD02 V5's cap of 8 (L1 ${l1} + L2 ${l2} concurrent sublayers + 2 L3 + 2 L4 + ${(b.emitters || []).length} emitters).`);
}

// ---- C10: the bed level target band (§Scoring B5's declared side) -------------------------------
for (const [id, b] of Object.entries(beds)) {
  const t = b.bed_lufs_target;
  const exempt = id === 'stone-wastes';
  if (exempt) { if (!(t >= -36 && t <= -32)) fail('C10', `${id}: bed target ${t} LUFS outside its −34 ± 2 exemption.`); }
  else if (!(t >= -28 && t <= -24)) fail('C10', `${id}: bed target ${t} LUFS outside §A's −28..−24 band. Ambience that sits above this has eaten RI-AUD01's combat headroom and the parry chime has nowhere to go.`);
}

// ---- C12: has this bed ever been rendered and levelled? ----------------------------------------
// A WARNING, deliberately, not a failure. A bed added today legitimately has no `bed_gain_db`
// until somebody renders it, and failing here would make writing a new region impossible without
// a browser — a fail-closed assertion landed ahead of its data, which is the thing that has taken
// this engine down repeatedly. But an uncalibrated bed is a bed at an unknown loudness, and the
// first render measured the province spanning 22 LU, so an unwarned one would sit in the mix at
// whatever level the sum of its layer gains happened to produce.
for (const [id, b] of Object.entries(beds)) {
  if (b.bed_gain_db === undefined) {
    warn('C12', `${id}: no bed_gain_db — this bed has never been rendered and levelled. Run \`node tools/analysis/ambience-render.mjs --seconds 20 --calibrate\`. Until then its loudness is whatever its layer gains happen to sum to, which spanned 22 LU across the province before calibration.`);
  }
}

// ---- C11: the bed must not silently drift from regions.json ------------------------------------
for (const r of regions) {
  const b = beds[r.id];
  if (!b) continue;
  if (b.brief !== r.ambient_text) fail('C11', `${r.id}: the bed's brief has drifted from regions.json's ambient_text. RI-AUD03's own provenance note: "If regions.json changes, this table follows it, not the reverse."`);
}

// ---- report -------------------------------------------------------------------------------------
const uniqueL1 = byL1.size;
const declaredNull = Object.entries(beds).flatMap(([id, b]) =>
  ['L1', 'L2', 'L3', 'L4'].filter((L) => b.layers[L] === null).map((L) => `${id}/${L}`));
const out = {
  tool: 'tools/analysis/ambience-census.mjs',
  item: 'RI-AUD03 B4 (+ prose checks the B4 row does not enumerate)',
  regions_expected: regions.length,
  beds_found: Object.keys(beds).length,
  unique_L1_assets: uniqueL1,
  layers_declared_null: declaredNull,
  denied_classes_total: deniedTotal,
  emitters: Object.values(beds).reduce((n, b) => n + (b.emitters || []).length, 0),
  data_bytes: Object.values(beds).reduce((n, b) => n + JSON.stringify(b).length, 0),
  B4: (Object.keys(beds).length === regions.length && uniqueL1 === regions.length && !fails.length) ? 'PASS' : 'FAIL',
  failures: fails,
  warnings: warns,
};

if (json) { console.log(JSON.stringify(out, null, 2)); }
else {
  console.log(`ambience-census: ${out.beds_found}/${out.regions_expected} regions have a bed; ${uniqueL1} unique L1 assets.`);
  console.log(`  layers declared null (R1, counted as declared): ${declaredNull.length ? declaredNull.join(', ') : 'none'}`);
  console.log(`  denied content classes across the province: ${deniedTotal}`);
  console.log(`  R7 positional emitters: ${out.emitters}`);
  console.log(`  total bed data: ${(out.data_bytes / 1024).toFixed(1)} KB (there are no audio assets; the bed is synthesised)`);
  for (const w of warns) console.log(`  WARN ${w.check}: ${w.message}`);
  for (const f of fails) console.log(`  FAIL ${f.check}: ${f.message}`);
  console.log(`  B4: ${out.B4}`);
}
process.exit(fails.length ? 1 : 0);
