#!/usr/bin/env node
/**
 * build-board.mjs — W1-30K. Turn `plate-metrics.json` into `board.json`: the look target as
 * ranges a renderer can land in and a critic can check without reading a paragraph.
 *
 * THE ONE RULE THIS FILE OBEYS
 * ----------------------------
 * Every number emitted here is a quantile of a measured statistic over a named list of plate
 * paths. There is no constant in this file that represents a judgement about what a good number
 * would be. Where a judgement IS made — which Morrowind population anchors which of our
 * settlements, and which end of a measured range a region should sit at — the judgement decides
 * ROUTING and ORDERING only, the endpoints stay measured, and the row records the judgement, its
 * basis and what would overturn it. Where the plates cannot support a number at all, the row is
 * emitted `status: "unset"` with the reason and the plate that would fill it. An unset row is a
 * legitimate output; an invented row is the failure this child exists to prevent.
 *
 * ORDERINGS COME FROM CORPUS-OWNED DATA, NOT FROM TASTE
 * ----------------------------------------------------
 * A per-region target needs to know which region is darker than which. That ordering is NOT
 * invented here: it is read from `corpus/50-world/regions.json` (`palette_hex`, the corpus's own
 * owner of regional colour identity) and `corpus/50-world/landforms.json`
 * (`measured_relief_range_m`, the shipped tree's own measured relief). The measured Morrowind
 * distribution supplies the values; the corpus supplies the order; this file only joins them.
 *
 * Usage: node docs/art-direction/build-board.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const M = JSON.parse(readFileSync(join(HERE, 'plate-metrics.json'), 'utf8'));
const REGIONS = JSON.parse(readFileSync(join(ROOT, 'corpus/50-world/regions.json'), 'utf8')).regions;
const LANDFORMS = JSON.parse(readFileSync(join(ROOT, 'corpus/50-world/landforms.json'), 'utf8')).regions;

// ---------------------------------------------------------------------------------------------
// slot routing — which Morrowind slots are frames of the WORLD, and which are not
// ---------------------------------------------------------------------------------------------
// Declared, from each slot's own `depicts` field in MANIFEST.json. The exclusions matter more than
// the inclusions: REF-A20 is the Game-of-the-Year main-menu scroll, a painted 2D asset, and it
// measures C_mean 29.9-45.8 against 2.3-29.1 for every rendered exterior slot in the set. Letting
// it into the saturation ceiling would have roughly doubled it off one non-world plate.
const EXTERIOR_SLOTS = ['REF-A1', 'REF-A2', 'REF-A3', 'REF-A5', 'REF-A6', 'REF-A8', 'REF-A9',
  'REF-A10', 'REF-A11', 'REF-A13', 'REF-A16', 'REF-A18', 'REF-A19', 'REF-A21', 'REF-A22', 'REF-A23'];
const INTERIOR_SLOTS = ['REF-A4', 'REF-A7', 'REF-A17'];
const EXCLUDED_SLOTS = {
  'REF-A12': 'MyGUI layout XML, not an image',
  'REF-A12b': 'UI screenshots — the frame is interface, not world',
  'REF-A14': 'prop close-ups (weapons); the frame is one object, not a look',
  'REF-A15': 'written-word close-ups (books, shrine script); the frame is one surface',
  'REF-A20': 'main-menu and title art — a painted 2D asset, not a rendered world frame. '
    + 'Its chroma is 2-4x every rendered exterior slot and it would have doubled the saturation ceiling.',
};

const plates = M.plates.filter((p) => !p.error);
const isArt = (p) => p.side === 'ART' && !EXCLUDED_SLOTS[p.slot];
const artExterior = plates.filter((p) => isArt(p) && EXTERIOR_SLOTS.includes(p.slot));
const artInterior = plates.filter((p) => isArt(p) && INTERIOR_SLOTS.includes(p.slot));
/** Composition statistics need real framing AND a sky the manifest asserts is there. */
const compValid = (p) => p.composition_valid && p.sky_visible === true;
const artComp = artExterior.filter(compValid);
const antiGeneric = plates.filter((p) => p.side === 'ART_NEGATIVE');
const modern = plates.filter((p) => p.side === 'FIDELITY');

// ---------------------------------------------------------------------------------------------
// quantiles
// ---------------------------------------------------------------------------------------------
const vals = (pop, key) => pop.map((p) => p[key]).filter((v) => v !== null && v !== undefined && Number.isFinite(v)).sort((a, b) => a - b);
const q = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))] : null);
const rr = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(d));
const paths = (pop) => pop.map((p) => p.path);

/** A band = [p10, p90] of a measured statistic over a named population. Nothing else. */
function band(pop, key, dp = 3) {
  const v = vals(pop, key);
  if (v.length < 3) return null;
  return { lo: rr(q(v, 10), dp), mid: rr(q(v, 50), dp), hi: rr(q(v, 90), dp), n: v.length };
}

// ---------------------------------------------------------------------------------------------
// descriptor distances — the discrimination floor and the strangeness budget
// ---------------------------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const centroid = (ds) => ds[0].map((_, i) => ds.reduce((s, d) => s + d[i], 0) / ds.length);

/** Inter-region centroid distances and leave-one-out identification, per descriptor. */
function dispersion(pop, descKey) {
  const by = new Map();
  for (const p of pop) { if (!p.region) continue; if (!by.has(p.region)) by.set(p.region, []); by.get(p.region).push(p); }
  const regions = [...by.keys()].sort();
  if (regions.length < 2) return null;
  const C = new Map(regions.map((r) => [r, centroid(by.get(r).map((p) => p[descKey]))]));
  const inter = [];
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) inter.push(dist(C.get(regions[i]), C.get(regions[j])));
  inter.sort((a, b) => a - b);
  const intra = [];
  for (const r of regions) for (const p of by.get(r)) intra.push(dist(p[descKey], C.get(r)));
  intra.sort((a, b) => a - b);
  // leave-one-out nearest-centroid identification
  let ok = 0, n = 0;
  for (const r of regions) for (const p of by.get(r)) {
    let best = null, bd = Infinity;
    for (const s of regions) {
      const others = by.get(s).filter((o) => o !== p);
      if (!others.length) continue;
      const d = dist(p[descKey], centroid(others.map((o) => o[descKey])));
      if (d < bd) { bd = d; best = s; }
    }
    n++; if (best === r) ok++;
  }
  return {
    regions: regions.length, images: n,
    inter_p10: rr(q(inter, 10), 2), inter_p50: rr(q(inter, 50), 2), inter_p90: rr(q(inter, 90), 2),
    intra_p50: rr(q(intra, 50), 2), intra_p90: rr(q(intra, 90), 2),
    fisher: rr(q(inter, 50) / q(intra, 50), 3),
    loo: rr(ok / n, 4), chance: rr(1 / regions.length, 4),
  };
}

/** Distance from the anti-generic centroid: RI-VIS07's "the thing to measure distance FROM". */
function antiGenericDistance(pop, descKey) {
  if (!antiGeneric.length) return null;
  const c = centroid(antiGeneric.map((p) => p[descKey]));
  const ds = pop.map((p) => dist(p[descKey], c)).sort((a, b) => a - b);
  return { p10: rr(q(ds, 10), 2), p50: rr(q(ds, 50), 2), p90: rr(q(ds, 90), 2), n: ds.length };
}

// ---------------------------------------------------------------------------------------------
// current build — what is derivable WITHOUT a rendered frame
// ---------------------------------------------------------------------------------------------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
function hexLab(hex) {
  const h = hex.replace('#', '');
  const r8 = parseInt(h.slice(0, 2), 16), g8 = parseInt(h.slice(2, 4), 16), b8 = parseInt(h.slice(4, 6), 16);
  const r = srgbToLinear(r8 / 255), g = srgbToLinear(g8 / 255), b = srgbToLinear(b8 / 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
  const L = 116 * fy - 16, a = 500 * (fx - fy), bb = 200 * (fy - fz);
  let hue = (Math.atan2(bb, a) * 180) / Math.PI; if (hue < 0) hue += 360;
  return { L, a, b: bb, C: Math.hypot(a, bb), hue };
}
/** Our regions, keyed by the world-art.js id, joined to regions.json's authored palette. */
const REGION_NAME_TO_ID = {
  'The Salt Hills': 'salt-hills', Thornmarsh: 'thornmarsh', 'Valus Ridge': 'valus-ridge',
  'The Stone Forest': 'stone-forest', 'The Clay Moor': 'clay-moor', 'Crimson Coast': 'crimson-coast',
  Blackwood: 'blackwood', 'The Hive': 'hive', 'The Deep Marshes': 'deep-marshes',
  "Marauder's Coast": 'marauders-coast', 'Western Rootlands': 'western-rootlands',
  'Eastern Rootlands': 'eastern-rootlands', 'Stone Wastes': 'stone-wastes',
};
const ourRegions = {};
for (const [name, rec] of Object.entries(REGIONS)) {
  const id = REGION_NAME_TO_ID[name];
  if (!id) throw new Error(`W1-30K: regions.json region '${name}' has no world-art.js id`);
  const labs = rec.palette_hex.map(hexLab);
  ourRegions[id] = {
    id, name, palette_hex: rec.palette_hex,
    authored_L_mean: rr(labs.reduce((s, l) => s + l.L, 0) / labs.length, 2),
    authored_C_mean: rr(labs.reduce((s, l) => s + l.C, 0) / labs.length, 2),
    authored_C_max: rr(Math.max(...labs.map((l) => l.C)), 2),
    authored_hue_mean: rr(labs.reduce((s, l) => s + l.hue, 0) / labs.length, 1),
    relief_range_m: LANDFORMS[id] ? LANDFORMS[id].measured_relief_range_m : null,
    macro_form: LANDFORMS[id] ? LANDFORMS[id].macro_form : null,
    landform_elements: LANDFORMS[id] ? LANDFORMS[id].landform_elements : [],
  };
}

// ---------------------------------------------------------------------------------------------
// row helpers
// ---------------------------------------------------------------------------------------------
const rows = [];
let seq = 0;
function row(o) {
  if (!o.id) o.id = `R${String(++seq).padStart(3, '0')}`;
  rows.push(o);
  return o;
}
/** A set row. `source.plates` is the full list of plate paths the number was read from. */
const byIdLocal = (id) => rows.find((r) => r.id === id);
function setRow({ id, side, scope, subject, axis, statistic, unit, b, pop, consumers, current, note, judgement, clamped }) {
  return row({
    id, side, scope, subject, axis, statistic, unit,
    clamped: clamped || null,
    status: b ? 'set' : 'unset',
    unset_reason: b ? null : `fewer than 3 measurable plates in the source population (n=${pop.length})`,
    target: b ? { lo: b.lo, hi: b.hi, anchor_p50: b.mid } : null,
    source: { population_n: pop.length, statistic_n: b ? b.n : 0, plates: paths(pop) },
    current_build: current || { value: null, method: null, unmeasured_reason: null },
    consumers: consumers || [],
    judgement: judgement || null,
    note: note || null,
  });
}
function unsetRow({ id, side, scope, subject, axis, statistic, reason, would_fill, consumers, evidence }) {
  return row({
    id, side, scope, subject, axis, statistic, unit: null, status: 'unset',
    unset_reason: reason, target: null,
    source: { population_n: 0, statistic_n: 0, plates: evidence ? evidence.plates : [] },
    measured_evidence_for_the_gap: evidence ? evidence.stat : null,
    would_fill, consumers: consumers || [], judgement: null, note: null,
  });
}

// =============================================================================================
// ART — cross-cutting decisions (item 3 of the plan)
// =============================================================================================
const ART_CONSUMERS_ALL = ['W1-30A', 'W1-30B', 'W1-30C', 'W1-30D', 'W1-30E', 'W1-30F', 'W1-30G'];

// X1 — the province-wide value structure.
setRow({
  id: 'ART-X1-VALUE-SPLIT', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'value structure', statistic: 'mean CIELAB L* of the top third minus the bottom third of the frame',
  unit: 'L* units', b: band(artComp, 'value_split_top_bottom', 2), pop: artComp,
  consumers: ['W1-30A', 'W1-30B', 'W1-30D', 'W1-30F'],
  current: currentUnrenderable('value_split_top_bottom'),
  note: 'The sky is the light. A frame whose ground is brighter than its sky by more than the low '
    + 'end of this band has inverted the province\'s value structure and will read as lit from below.',
});
// X2 — the saturation ceiling. Two statistics: where the 95th-percentile chroma sits, and how much
// of the frame is allowed above C*=30 at all.
setRow({
  id: 'ART-X2-CHROMA-P95', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'saturation ceiling', statistic: '95th-percentile CIELAB chroma C* of the frame',
  unit: 'C*', b: band(artExterior, 'C_p95', 2), pop: artExterior,
  consumers: ['W1-30A', 'W1-30C', 'W1-30D', 'W1-30E', 'W1-30F', 'W1-30G'],
  current: currentAuthoredChroma(),
  note: 'The single most common way a marsh subject goes wrong is over-saturation. This is the '
    + 'measured ceiling of the reference set, not a preference.',
});
setRow({
  id: 'ART-X2-CHROMA-FRAC', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'saturation ceiling', statistic: 'fraction of frame pixels with C* > 30',
  unit: 'fraction', b: band(artExterior, 'chroma_frac_gt30', 4), pop: artExterior,
  consumers: ['W1-30A', 'W1-30C', 'W1-30D', 'W1-30G'],
  current: currentUnrenderable('chroma_frac_gt30'),
  note: 'High chroma is a light source, not a surface. The measured reference set puts almost no '
    + 'frame area above C*=30.',
});
// X3 — palette breadth.
setRow({
  id: 'ART-X3-PALETTE-BREADTH', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'palette breadth', statistic: 'count of coarse CIELAB cube bins (dL 10, da 20, db 20) holding >= 1% of frame pixels',
  unit: 'bins', b: band(artExterior, 'palette_bins', 0), pop: artExterior,
  consumers: ['W1-30A', 'W1-30C', 'W1-30F'],
  current: currentUnrenderable('palette_bins'),
  note: 'How many colours a frame actually uses. Below the band the frame is a monochrome wash; '
    + 'above it, the palette has stopped being a palette.',
});
// X4 — sky fraction.
setRow({
  id: 'ART-X4-SKY-FRACTION', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'composition', statistic: 'fraction of frame height above the detected skyline, averaged over columns',
  unit: 'fraction', b: band(artComp, 'sky_frac', 3), pop: artComp,
  consumers: ['W1-30B', 'W1-30E', 'W1-30F'],
  current: currentUnrenderable('sky_frac'),
  note: null,
});
// X5 — skyline relief. THE row for W1-30F.
setRow({
  id: 'ART-X5-SKYLINE-RELIEF', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'silhouette', statistic: 'standard deviation of the smoothed per-column skyline height, as a fraction of frame height',
  unit: 'fraction of frame height', b: band(artComp, 'skyline_sd_smoothed', 3), pop: artComp,
  consumers: ['W1-30E', 'W1-30F'],
  current: currentUnrenderable('skyline_sd_smoothed'),
  note: 'A dead-flat horizon measures 0.000 on this statistic. Nothing in the reference set is '
    + 'anywhere near 0.000. This is the cheapest single check that a region has a landform at all.',
});

// X6 — the strangeness budget, expressed as measured distance from the anti-generic anchor.
const agRaw = antiGenericDistance(artExterior, 'raw_descriptor');
const agLay = antiGenericDistance(artExterior, 'layout_descriptor');
row({
  id: 'ART-X6-STRANGENESS-RAW', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'strangeness budget',
  statistic: 'Euclidean distance from the centroid of refs/anti-generic/ in the 4x4 mean-CIELAB descriptor',
  unit: 'CIELAB descriptor units', status: agRaw ? 'set' : 'unset',
  unset_reason: agRaw ? null : 'anti-generic population empty',
  target: agRaw ? { lo: agRaw.p10, hi: null, anchor_p50: agRaw.p50 } : null,
  source: { population_n: artExterior.length, statistic_n: agRaw ? agRaw.n : 0,
    plates: paths(artExterior).concat(paths(antiGeneric)) },
  current_build: currentUnrenderable('raw_descriptor'),
  consumers: ART_CONSUMERS_ALL,
  judgement: null,
  note: 'RI-VIS07 permits refs/anti-generic/ only as the thing to measure distance FROM, never as '
    + 'a target, and this row uses it that way: a floor, with no upper bound. The floor is the 10th '
    + 'percentile of the reference set\'s own distance from that centroid — our frames must be at '
    + 'least as far from generic fantasy as Vvardenfell\'s are.',
});
row({
  id: 'ART-X6-STRANGENESS-LAYOUT', side: 'ART', scope: 'province', subject: 'all regions',
  axis: 'strangeness budget',
  statistic: 'Euclidean distance from the centroid of refs/anti-generic/ in the per-image z-scored 6x4 edge+lightness layout descriptor',
  unit: 'layout descriptor units', status: agLay ? 'set' : 'unset',
  unset_reason: agLay ? null : 'anti-generic population empty',
  target: agLay ? { lo: agLay.p10, hi: null, anchor_p50: agLay.p50 } : null,
  source: { population_n: artExterior.length, statistic_n: agLay ? agLay.n : 0,
    plates: paths(artExterior).concat(paths(antiGeneric)) },
  current_build: currentUnrenderable('layout_descriptor'),
  consumers: ART_CONSUMERS_ALL,
  judgement: null,
  note: 'The colour-stripped half of the strangeness budget. AM-W1-01-01 established that about '
    + 'two-thirds of measured region separability was carried by tint alone; this row cannot be '
    + 'satisfied by a colour grade because the descriptor is z-scored per image.',
});

// X7 — the discrimination floor. Measured on Morrowind's OWN nine regions.
const dispRaw = dispersion(artComp.filter((p) => p.region), 'raw_descriptor');
const dispLay = dispersion(artComp.filter((p) => p.region), 'layout_descriptor');
const regionPop = artComp.filter((p) => p.region);
// A separation floor is only a bar if the population it is read from can pass its own test. The
// admission rule is stated before the numbers are looked at: the reference set's leave-one-out
// region identification must beat chance on the descriptor, otherwise its inter-centroid distances
// are not distinguishable from its within-region spread and a floor read off them is noise.
for (const [key, d, desc] of [['RAW', dispRaw, '4x4 mean-CIELAB'], ['LAYOUT', dispLay, 'per-image z-scored 6x4 edge+lightness']]) {
  const usable = d && d.loo > d.chance;
  row({
    id: `ART-X7-SEPARATION-${key}`, side: 'ART', scope: 'province', subject: 'every pair of regions',
    axis: 'region discrimination',
    statistic: `centroid-to-centroid distance between any two regions in the ${desc} descriptor`,
    unit: 'descriptor units', status: usable ? 'set' : 'unset',
    unset_reason: usable ? null
      : (d ? `the reference population cannot identify its own regions on this descriptor: `
          + `leave-one-out ${rr(d.loo * 100, 1)}% against ${rr(d.chance * 100, 1)}% chance, Fisher `
          + `${d.fisher} (inter-centroid p50 ${d.inter_p50} against intra p50 ${d.intra_p50}). A `
          + `separation floor read off a population that fails its own test is noise wearing a number. `
          + `This is a measurement, not a decision: it is the same finding AM-W1-01-01 filed against `
          + `RI-WLD04's A7 instrument, arrived at independently on a different population.`
        : 'fewer than two region-tagged populations'),
    target: usable ? { lo: d.inter_p10, hi: null, anchor_p50: d.inter_p50 } : null,
    source: { population_n: regionPop.length, statistic_n: d ? d.images : 0, plates: paths(regionPop) },
    measured_reference_behaviour: d,
    would_fill: usable ? null : 'a descriptor on which the reference set identifies its own regions '
      + 'above chance, or a reference population large enough per region for the centroids to settle. '
      + 'Nine regions at 4-13 frames each is what refs/ holds.',
    current_build: currentUnrenderable(`${key.toLowerCase()}_descriptor`),
    consumers: ['W1-30F', 'W1-30E', 'W1-30C'],
    judgement: null,
    note: usable
      ? 'The floor is what Vvardenfell\'s own regions manage on the same instrument, and it is a floor '
        + 'and not a band: there is no such thing as too distinct. Read the leave-one-out rate beside '
        + 'it — it is the honest ceiling on what this instrument can resolve, and it is low.'
      : 'Kept in the board as an unset row rather than deleted, because the measurement is the point: '
        + 'it is evidence about the instrument, and the next child to reach for per-region colour '
        + 'separation should see it before spending a week on it.',
  });
}

// =============================================================================================
// ART — per-region rows
// =============================================================================================
/**
 * The per-region target is a quantile-matched interval:
 *   1. rank our thirteen regions on an ordering read from corpus-owned data,
 *   2. read the measured Morrowind distribution of the statistic at that rank's quantile,
 *   3. widen by the measured within-region spread of the reference set.
 * Every endpoint is measured. Only the ordering is a join, and the join key is named on the row.
 */
function perRegionRows(axisId, statKey, orderKey, orderDesc, unit, dp, consumers, note, opts = {}) {
  const pop = opts.statPop || artComp;
  // Two clamps, both of them consistency rather than taste:
  //   physical  — L* cannot be negative and chroma cannot be negative,
  //   envelope  — a per-region band may not leave the province-wide row it sits inside, or the
  //               board would contradict itself and a builder could satisfy one row by breaking
  //               another. The clamp is recorded on the row when it bites.
  const env = opts.envelopeRowId ? byIdLocal(opts.envelopeRowId) : null;
  const clamp = (x) => {
    let v = x, hit = null;
    if (opts.floor !== undefined && v < opts.floor) { v = opts.floor; hit = 'physical'; }
    if (opts.ceil !== undefined && v > opts.ceil) { v = opts.ceil; hit = 'physical'; }
    if (env && env.target) {
      if (env.target.lo !== null && v < env.target.lo) { v = env.target.lo; hit = 'province envelope'; }
      if (env.target.hi !== null && v > env.target.hi) { v = env.target.hi; hit = 'province envelope'; }
    }
    return [v, hit];
  };
  const v = vals(pop, statKey);
  if (v.length < 6) return;
  // measured within-region spread of the reference set: median over regions of (p75-p25)
  const byRegion = new Map();
  for (const p of pop) { if (!p.region) continue; if (!byRegion.has(p.region)) byRegion.set(p.region, []); byRegion.get(p.region).push(p); }
  const spreads = [];
  for (const [, ps] of byRegion) {
    const rv = vals(ps, statKey);
    if (rv.length >= 3) spreads.push(q(rv, 75) - q(rv, 25));
  }
  spreads.sort((a, b) => a - b);
  const halfWidth = (spreads.length ? q(spreads, 50) : (q(v, 90) - q(v, 10)) / 4) / 2;

  const ordered = Object.values(ourRegions)
    .filter((r) => r[orderKey] !== null && r[orderKey] !== undefined)
    .sort((a, b) => a[orderKey] - b[orderKey]);
  const N = ordered.length;
  ordered.forEach((r, i) => {
    // Region centres span the province row's own p10..p90, not the full distribution. Spanning the
    // full distribution put the extreme regions outside the envelope they are required to sit in,
    // and the clamp then collapsed their bands to zero width — a target nobody can hit.
    const quant = 10 + ((i + 0.5) / N) * 80;
    const centre = q(v, quant);
    const [lo, hitLo] = clamp(centre - halfWidth);
    const [hi, hitHi] = clamp(centre + halfWidth);
    const [mid] = clamp(centre);
    const clamped = hitLo || hitHi;
    setRow({
      id: `ART-REG-${axisId}-${r.id}`, side: 'ART', scope: 'region', subject: r.id,
      axis: axisId.toLowerCase(), statistic: statKeyDescription[statKey], unit,
      b: { lo: rr(lo, dp), mid: rr(mid, dp), hi: rr(hi, dp), n: v.length },
      clamped: clamped || null,
      pop, consumers,
      current: currentUnrenderable(statKey),
      judgement: {
        kind: 'ordering',
        text: `Rank ${i + 1} of ${N} on ${orderDesc}. The rank decides WHICH part of the measured `
          + `Morrowind distribution this region targets; it does not decide the numbers, which are `
          + `the ${rr(quant, 1)}th percentile of that distribution plus/minus half the reference `
          + `set's own median within-region inter-quartile spread (${rr(halfWidth * 2, dp)}).`,
        ordering_source: orderDesc,
        ordering_value: r[orderKey],
        reversible: true,
        would_overturn: 'a different corpus-owned ordering for this axis, or a measurement showing '
          + 'the reference distribution is not monotone in this ordering',
      },
      note,
    });
  });
}
const statKeyDescription = {
  L_p50: 'median CIELAB L* of the frame',
  C_p95: '95th-percentile CIELAB chroma C* of the frame',
  skyline_sd_smoothed: 'standard deviation of the smoothed per-column skyline height, as a fraction of frame height',
  sky_frac: 'fraction of frame height above the detected skyline',
  value_split_top_bottom: 'mean CIELAB L* of the top third minus the bottom third of the frame',
  palette_bins: 'count of coarse CIELAB cube bins holding >= 1% of frame pixels',
};

const COLOUR_CAUTION = ' NECESSARY, NOT SUFFICIENT. The reference set does not identify its own '
  + 'regions from colour alone on this corpus (see ART-X7-SEPARATION-RAW), so hitting this band buys '
  + 'a region no identity. Identity has to come from ART-REG-SKYLINE-* and from landform and built '
  + 'form. A region that meets its colour band and misses its skyline band has been graded, not built.';
perRegionRows('LIGHTNESS', 'L_p50', 'authored_L_mean',
  'the mean CIELAB L* of the three palette_hex swatches regions.json already declares for this region',
  'L*', 2, ['W1-30A', 'W1-30C', 'W1-30F'],
  'regions.json owns regional colour identity; this row does not replace its hexes, it publishes the '
  + 'measured envelope they have to live inside and the rank order they already imply.' + COLOUR_CAUTION,
  { floor: 0, ceil: 100 });
perRegionRows('CHROMA', 'C_p95', 'authored_C_mean',
  'the mean CIELAB chroma of the three palette_hex swatches regions.json already declares for this region',
  'C*', 2, ['W1-30A', 'W1-30C', 'W1-30G'],
  'Ceilinged province-wide by ART-X2-CHROMA-P95; this row says where inside that ceiling each region '
  + 'sits.' + COLOUR_CAUTION,
  { floor: 0, envelopeRowId: 'ART-X2-CHROMA-P95' });
perRegionRows('SKYLINE', 'skyline_sd_smoothed', 'relief_range_m',
  "landforms.json's measured_relief_range_m for this region in the shipped tree",
  'fraction of frame height', 3, ['W1-30E', 'W1-30F'],
  'The bridge between the terrain data and the frame. A region declaring 229.8 m of relief and '
  + 'rendering a skyline standard deviation of 0.000 has the relief in the heightfield and not in the picture.',
  { floor: 0 });

// =============================================================================================
// ART — per-settlement rows
// =============================================================================================
/**
 * Settlement anchors are a BUILT-FORM routing, which is the use RI-VIS09 §3.3 grants by name.
 * Each row records the anchor, the basis, and that it is reversible. The numbers are the anchor
 * population's measured band; the anchor choice is the judgement.
 */
const SETTLEMENT_ANCHORS = {
  lilmoth: { slot: 'REF-A19', basis: "world-art.js grammar 'reed-dome-tidal-court' against the slot's waterside boardwalk-and-shack settlements" },
  soulrest: { slot: 'REF-A11', basis: "world-art.js grammar 'harbour-rib' against the slot's coastal harbour settlement" },
  helstrom: { slot: 'REF-A8', basis: "world-art.js grammar 'shell-pier-market' against the slot's street level among shell-built structures" },
  archon: { slot: 'REF-A2', basis: "world-art.js grammar 'terraced-kiln' against the slot's terraced shell-and-earth architecture" },
  // W1-THORN-PLATES: RE-ANCHORED FROM REF-A3, AND THIS IS WHY THORN'S ROWS WERE UNSETTABLE.
  //
  // Thorn is the town the player actually starts in (`reports/spawn-truth/2026-08-14-spawn-truth.md`)
  // and it was the one settlement on this board with n=0 composition-valid plates. That was never an
  // acquisition failure: ALL FIVE REF-A3 plates are square crops, so REF-A3 scores 0 of 5 under the
  // composition-valid rule (`framing == 'full frame, native aspect, uncropped'` AND `sky_visible`)
  // and any settlement anchored there gets `unset` rows FOREVER, whatever the town looks like.
  //
  // The old basis also read the wrong one of the three incompatible descriptions of Thorn's
  // architecture: `spiral-palisade` is `world-art.js`'s word and it is not one of the nine grammars
  // in `game/data/world/architecture.json` at all. Thorn's own settlement record describes lean-tos
  // under black needle-thatch on a tidewater quay — the opposite of a grown spiralling tower.
  //
  // REF-A19 has 6 composition-valid plates and is Morrowind's own waterside settlement (Hla Oad: a
  // moored longboat beside stilted shacks), which is what Thorn's `tidewrack-quay` is. Both
  // `ART-SET-ROOFLINE-RELIEF-thorn` and `ART-SET-SKY-FRACTION-thorn` become settable at the bands in
  // `reports/thorn-plates/2026-08-14-thorn-plates.md` §2c. Lilmoth shares the slot, which is correct
  // — they are the same kind of place — and sharing an anchor is already the case elsewhere here.
  //
  // REVERSIBLE. What would overturn it: a slot whose built form matches Thorn better AND has >= 3
  // composition-valid plates. `stormhold` is in the same n=0 position for the same reason and is
  // NOT fixed here — it needs its own judgement, not a copy of this one.
  thorn: { slot: 'REF-A19', basis: "thorn.json's tidewrack-quay is a tidewater quay of stilted lean-tos; REF-A19 is Morrowind's own waterside settlement, and it has 6 composition-valid plates where REF-A3 has 0" },
  blackrose: { slot: 'REF-A9', basis: "world-art.js grammar 'root-stockade' against the slot's built barrier of pylons carrying a fence line" },
  stormhold: { slot: 'REF-A17', basis: "world-art.js 'imperial: true' and grammar 'root-bridge-tiers' against the slot's Imperial fort masonry" },
  gideon: { slot: 'REF-A22', basis: "world-art.js 'imperial: true' and grammar 'imperial-grid-broken-by-roots' against the slot's Imperial town on a laid grid" },
};
for (const [sid, anchor] of Object.entries(SETTLEMENT_ANCHORS)) {
  const pop = plates.filter((p) => isArt(p) && p.slot === anchor.slot);
  const popComp = pop.filter(compValid);
  const j = {
    kind: 'anchor', text: `Anchored on ${anchor.slot}. ${anchor.basis}.`,
    reversible: true,
    would_overturn: 'a different slot whose built form better matches this settlement\'s grammar in world-art.js',
  };
  for (const [axisId, key, unit, dp, usePop, cons] of [
    ['PALETTE-L', 'L_p50', 'L*', 2, pop, ['W1-30C', 'W1-30E']],
    ['PALETTE-C', 'C_p95', 'C*', 2, pop, ['W1-30C', 'W1-30E']],
    ['ROOFLINE-RELIEF', 'skyline_sd_smoothed', 'fraction of frame height', 3, popComp, ['W1-30E']],
    ['SKY-FRACTION', 'sky_frac', 'fraction', 3, popComp, ['W1-30E']],
  ]) {
    setRow({
      id: `ART-SET-${axisId}-${sid}`, side: 'ART', scope: 'settlement', subject: sid,
      axis: axisId.toLowerCase().replace(/-/g, ' '), statistic: statKeyDescription[key] || key, unit,
      b: band(usePop, key, dp), pop: usePop, consumers: cons,
      current: currentUnrenderable(key), judgement: j,
      note: usePop.length < 4 ? `Low n (${usePop.length}). Read as an indication, not a band.` : null,
    });
  }
}

// The one thing the plates cannot give a settlement.
unsetRow({
  id: 'ART-SET-SILHOUETTE-RHYTHM', side: 'ART', scope: 'settlement', subject: 'all settlements',
  axis: 'silhouette rhythm',
  statistic: 'dominant horizontal repeat period of the skyline, as a fraction of frame width',
  reason: 'The instrument finds a repeat period in only '
    + `${rr((artComp.filter((p) => p.skyline_period_found).length / artComp.length) * 100, 0)}% `
    + 'of the reference frames it is run on. A target derived from half a population is not a target. '
    + 'The plan asked for "silhouette rhythm at 200 m"; the plates also cannot supply the 200 m — a '
    + 'screenshot has no depth channel, so no statistic here can be stated at a distance.',
  would_fill: 'either a reference population framed at a declared camera distance, or a depth buffer '
    + 'alongside the frame. Neither exists in refs/. The rhythm can be measured on OUR frames at a '
    + 'known camera distance without any reference at all, and W1-30E can set its own baseline that way.',
  consumers: ['W1-30E'],
  evidence: {
    plates: paths(artComp),
    stat: { period_found_rate: rr(artComp.filter((p) => p.skyline_period_found).length / artComp.length, 3),
      n: artComp.length },
  },
});

// =============================================================================================
// FIDELITY — modern plates only
// =============================================================================================
const PROFILES = ['exterior_daylight', 'exterior_lowlight', 'interior_darkemissive', 'character_closeup', 'material_closeup', 'combat'];
for (const prof of PROFILES) {
  const pop = modern.filter((p) => p.profile === prof);
  if (!pop.length) continue;
  const ext = prof.startsWith('exterior');
  setRow({
    id: `FID-DYNRANGE-${prof}`, side: 'FIDELITY', scope: 'profile', subject: prof,
    axis: 'value range', statistic: 'log2 of the ratio of the 99th to the 1st percentile of linear luminance',
    unit: 'stops', b: band(pop, 'dyn_range_stops', 2), pop,
    consumers: prof === 'character_closeup' ? ['W1-30A', 'W1-30B', 'W1-30D'] : ['W1-30A', 'W1-30B'],
    current: currentUnrenderable('dyn_range_stops'),
    note: 'RI-VIS09 §4 found this statistic separates the two eras with no overlap. It is a '
      + 'FIDELITY row for exactly that reason and no Morrowind plate may set it.',
  });
  setRow({
    id: `FID-SHADOWLIT-${prof}`, side: 'FIDELITY', scope: 'profile', subject: prof,
    axis: 'lighting', statistic: 'ratio of the 75th to the 25th percentile CIELAB L* within the lower two thirds of the frame',
    unit: 'ratio', b: band(pop, 'shadow_lit_ratio', 3), pop,
    consumers: prof === 'character_closeup' ? ['W1-30B', 'W1-30D'] : ['W1-30B', 'W1-30G'],
    current: currentUnrenderable('shadow_lit_ratio'),
    note: 'This is NOT a key-to-fill ratio; see FID-KEYFILL.',
  });
  if (ext) {
    setRow({
      id: `FID-AERIAL-${prof}`, side: 'FIDELITY', scope: 'profile', subject: prof,
      axis: 'atmospherics', statistic: 'mean 3x3 local sigma of L* in the bottom sixth of the frame divided by the same in the band just below the skyline',
      unit: 'ratio', b: band(pop, 'aerial_perspective_ratio', 3), pop, consumers: ['W1-30B', 'W1-30F'],
      current: currentFogDensity(),
      note: 'A renderer with no aerial perspective returns ~1.0: foreground and far field carry the '
        + 'same local contrast. This is the checkable consequence of a fog profile, which is why the '
        + 'fog rows are on this side and not on the art side.',
    });
  }
  setRow({
    id: `FID-CHROMA-${prof}`, side: 'FIDELITY', scope: 'profile', subject: prof,
    axis: 'post-processing', statistic: '95th-percentile CIELAB chroma C* of the frame',
    unit: 'C*', b: band(pop, 'C_p95', 2), pop,
    consumers: prof === 'character_closeup' ? ['W1-30A', 'W1-30D'] : ['W1-30A'],
    current: currentUnrenderable('C_p95'),
    note: 'The tonemap-and-grade envelope a shipped renderer lands in. Read together with '
      + 'ART-X2-CHROMA-P95, which is a different question measured on a different set — they are '
      + 'never averaged, compared or reconciled (RI-VIS01 CC-5).',
  });
}
unsetRow({
  id: 'FID-KEYFILL', side: 'FIDELITY', scope: 'province', subject: 'all lighting recipes',
  axis: 'lighting', statistic: 'key-to-fill ratio',
  reason: 'A key-to-fill ratio is the ratio of two named light sources. A screenshot contains their '
    + 'SUM. Recovering the ratio needs either a known probe object of known albedo in frame or the '
    + 'light rig itself, and refs/modern/ has neither. Every "key-to-fill" number derivable from these '
    + 'plates would be a lit-to-shadow luminance ratio wearing the wrong name, so the honest statistic '
    + 'ships under its own name as FID-SHADOWLIT-* and this row stays empty.',
  would_fill: 'a reference frame containing a grey sphere or chart of known albedo, or the light rig '
    + 'of a reference scene. Neither is acquirable from a screenshot population.',
  consumers: ['W1-30B'],
});
unsetRow({
  id: 'FID-HORIZON-DISTANCE', side: 'FIDELITY', scope: 'province', subject: 'all fog profiles',
  axis: 'atmospherics', statistic: 'horizon visibility distance in metres, and the fog density that produces it',
  reason: 'Metres are not in a screenshot. No plate in refs/ carries a depth channel, a camera '
    + 'intrinsic or a scale object, so no distance in metres can be read from any of them. The '
    + 'measurable consequence of a fog profile is the contrast falloff between foreground and far '
    + 'field, and that ships as FID-AERIAL-*.',
  would_fill: 'a reference capture with a recorded depth buffer or a known-size object at a known '
    + 'distance. Our own build can supply both, so this row is fillable from OUR frames without any '
    + 'reference at all — W1-30B can set it from the engine and W1-30K should not.',
  consumers: ['W1-30B', 'W1-30F'],
});

// =============================================================================================
// current-build helpers (defined late, hoisted by function declaration)
// =============================================================================================
function currentUnrenderable(statKey) {
  return {
    value: null, method: null,
    unmeasured_reason: 'requires a rendered frame of the current build. Not captured by W1-30K: '
      + 'tools/contention.mjs reported the box at or over its browser ceiling (4 instances, load '
      + '5.69 per core) and the shared capture daemon could not be reached from this worktree '
      + '(tools/node_modules absent, so launchGame() exits 70). W1-30K blocks nothing and did not '
      + 'queue behind a browser to fill this column.',
    fill_command: `node tools/world/province-shots.mjs --out reports/region-shots --per 3 --passes day `
      + `&& node docs/art-direction/measure-plates.mjs --shots reports/region-shots`,
    statistic_key: statKey,
  };
}
function currentAuthoredChroma() {
  const cs = Object.values(ourRegions).map((r) => r.authored_C_max).sort((a, b) => a - b);
  return {
    value: { authored_C_max_p50: rr(q(cs, 50), 2), authored_C_max_max: rr(cs[cs.length - 1], 2),
      per_region: Object.fromEntries(Object.values(ourRegions).map((r) => [r.id, r.authored_C_max])) },
    method: 'CIELAB chroma of the palette_hex swatches corpus/50-world/regions.json declares per '
      + 'region. This is the AUTHORED ALBEDO, not a rendered frame: a renderer can land outside this '
      + 'even when the albedo is inside it. Recorded here because it is the part of the current build '
      + 'that is measurable without a browser.',
    unmeasured_reason: null,
  };
}
function currentFogDensity() {
  try {
    const sky = readFileSync(join(ROOT, 'game/src/render/sky.js'), 'utf8');
    const ds = [...sky.matchAll(/fogDensity:\s*([0-9.]+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    return {
      value: { weather_states: ds.length, fog_density_min: ds[0], fog_density_p50: rr(q(ds, 50), 4), fog_density_max: ds[ds.length - 1] },
      method: 'the FogExp2 densities declared in game/src/render/sky.js WEATHER, read statically. '
        + 'This is the input, not the measured consequence: the row\'s own statistic is a contrast '
        + 'ratio in a rendered frame and is not filled by this number.',
      unmeasured_reason: 'the rendered consequence is unmeasured — see fill_command on any ART row.',
    };
  } catch { return currentUnrenderable('fogDensity'); }
}

// =============================================================================================
// emit
// =============================================================================================
const sideOf = (r) => r.side;
const artRows = rows.filter((r) => sideOf(r) === 'ART');
const fidRows = rows.filter((r) => sideOf(r) === 'FIDELITY');

const board = {
  schema: 'elder-souls/w1-30k-board@1',
  produced_by: 'docs/art-direction/build-board.mjs',
  produced_from: 'docs/art-direction/plate-metrics.json',
  generated_at_commit: (() => {
    try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); }
    catch { return 'unknown'; }
  })(),
  what_this_is: 'The look target as ranges. A critic checks a frame against a range in this file '
    + 'rather than against a paragraph in a style board. Nothing here is a score and nothing here '
    + 'is a judging pack: W1-30V owns judgement and must not read a target W1-30K authored into a '
    + 'pack it scores against.',
  declarations: {
    ART: {
      side: 'ART_DIRECTION',
      properties: ['P01', 'P02', 'P05', 'P06', 'P07', 'P08'],
      permitted_reference_set: 'RI-VIS05 (Morrowind 2002) — refs/morrowind/; refs/anti-generic/ as the thing to measure distance FROM only (RI-VIS07)',
      forbidden_reference_set: 'RI-VIS02/RI-VIS03 (modern) — refs/modern/',
      grant: 'RI-VIS09 §3.3 — palette, silhouette, built form, flora and creature design language. '
        + 'No row on this side measures texture resolution, texel density, anti-aliasing or sharpness.',
    },
    FIDELITY: {
      side: 'FIDELITY',
      properties: ['F03', 'F06', 'F09'],
      permitted_reference_set: 'RI-VIS02 (modern) — refs/modern/, HUD-free plates only (RI-VIS09 §2)',
      forbidden_reference_set: 'RI-VIS05 (Morrowind 2002) — refs/morrowind/, refs/anti-generic/, refs/context/',
    },
    never_combined: 'RI-VIS01 CC-5. The two halves are never summed, averaged, weighted or reconciled. '
      + 'ART-X2-CHROMA-P95 and FID-CHROMA-* are the same statistic on two populations and are two '
      + 'different facts, not one fact measured twice.',
  },
  slot_routing: { exterior: EXTERIOR_SLOTS, interior: INTERIOR_SLOTS, excluded: EXCLUDED_SLOTS },
  populations: {
    art_exterior: { n: artExterior.length, plates: paths(artExterior) },
    art_exterior_composition_valid: { n: artComp.length, plates: paths(artComp),
      inclusion_rule: 'framing == "full frame, native aspect, uncropped" AND manifest sky_visible == true' },
    art_interior: { n: artInterior.length, plates: paths(artInterior) },
    anti_generic: { n: antiGeneric.length, plates: paths(antiGeneric) },
    modern_hud_free: { n: modern.length, plates: paths(modern) },
  },
  reference_set_behaviour: {
    inter_region_raw: dispRaw, inter_region_layout: dispLay,
    anti_generic_distance_raw: agRaw, anti_generic_distance_layout: agLay,
  },
  our_regions: ourRegions,
  counts: {
    rows: rows.length, set: rows.filter((r) => r.status === 'set').length,
    unset: rows.filter((r) => r.status === 'unset').length,
    art: artRows.length, fidelity: fidRows.length,
  },
  rows,
};
writeFileSync(join(HERE, 'board.json'), JSON.stringify(board, null, 1));
console.log(`board.json: ${board.counts.rows} rows (${board.counts.set} set, ${board.counts.unset} unset) — `
  + `${board.counts.art} ART / ${board.counts.fidelity} FIDELITY`);
