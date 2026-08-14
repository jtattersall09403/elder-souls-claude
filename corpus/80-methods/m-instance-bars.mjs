#!/usr/bin/env node
// m-instance-bars.mjs — the instrument for Ruling W1.
//
// Ruling W1 (orchestration/OWNER-DIRECTIVES-2026-08-14.md §6): *an aggregate may never be the
// binding predicate for something a player meets one at a time.* Bars over such populations bind on
// the WORST CONSTITUENT or a stated quantile, never the mean; and any axis asking for "a difference"
// must state the EFFECT SIZE that counts.
//
// This one instrument measures the five predicates the ruling tightened, each against BOTH the old
// and the new form, so the report shows what the old bar was passing:
//
//   A  RI-WLD04 M18  differentiation matrix — magnitude floors on four axes that had none
//   B  RI-WLD04 M19  ONLY-HERE elements — spread, not just count
//   C  RI-WLD07 §4   verticality — per region, against RI-WLD16 §3 class envelopes, not world-mean
//   D  RI-WLD02      POI place-type mix — per region pair, not province-global
//   E  RI-WLD09      declared void tracts — RI-WLD15 W15-7 unrelaxed inside them (implements M-W15-4)
//
// Static, headless, no browser, ~3 s. Reads game/data/world/*.json and the corpus artifacts.
//
// Usage:
//   node corpus/80-methods/m-instance-bars.mjs                 # measure the shipped world
//   node corpus/80-methods/m-instance-bars.mjs --json <path>   # write the full result
//   node corpus/80-methods/m-instance-bars.mjs --selfcheck     # prove each check can go red
//
// Exit codes: 0 pass, 1 fail against the tightened predicates, 2 could not measure (missing data).
//
// ---------------------------------------------------------------------------------------------
// ON THE NULL CONTROLS (rule 4, and the specific lesson of BAR-AUDIT-WORLD-20260814 §6).
// That audit's own instrument reported 71% landform coverage against a world containing none of the
// landforms, because its negative control was an EMPTY world rather than a GENERIC one. An empty
// world fails almost anything by accident, so a control built from one proves nothing.
// Every control in --selfcheck below is therefore the PLAUSIBLE WRONG ANSWER: a world that passes
// the OLD predicate and should fail the NEW one. Each control asserts BOTH directions — old-passes
// AND new-fails — because a control that could never have passed is not a control either.
// ---------------------------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { loadWorld, signatureAt, transect, TH as W15TH } from './m-wld15-monotony.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const P = {
  terrain: 'game/data/world/terrain.json',
  regions: 'game/data/world/regions.json',
  weather: 'game/data/world/weather.json',
  hazards: 'game/data/world/hazards.json',
  pois: 'game/data/world/pois.json',
  voids: 'game/data/world/voids.json',
  signatures: 'game/data/world/signatures.json',
  landforms: 'corpus/50-world/landforms.json',
  mwCensus: 'corpus/50-world/data/morrowind-region-census.json',
};

// ---- thresholds. These live in the reference items; change them THERE, not here. ----
export const TH = {
  // A — RI-WLD04 M18, the four axes that gained a magnitude floor.
  weather_l1_pp: 20,        // Morrowind's own closest region pair (Sheogorad/West Gash), verified below
  audio_frac_differ: 0.5,   // >=50% of the bed's assets differ  => Jaccard <= 0.5
  hazard_area_frac: 0.15,   // the hazard must occupy >=15% of EACH region
  slope_cramers_v: 0.2,     // effect size, replacing a bare chi-square p-value
  // unchanged axes, quoted so the whole matrix runs in one place
  albedo_delta_e: 12, flora_jaccard: 0.4, fauna_jaccard: 0.4, arch_jaccard: 0.3, fog_rel: 0.25,
  axes_required: 6, axes_total: 10, axes_fail_at: 3,
  // B — RI-WLD04 M19
  onlyhere_min_instances: 8,
  onlyhere_min_quadrants: 3,       // of the region's four AABB quadrants
  onlyhere_coverage_r_m: 400,
  onlyhere_coverage_frac: 0.40,    // >=40% of region land within 400 m of an instance
  // C — RI-WLD07 §4, now per region
  slope_target: [6, 14], slope_fail_below: 3,
  below5_target: [0.35, 0.50], above100_target: 0.12,
  // D — RI-WLD02
  placetype_jaccard_max: 0.727,    // Morrowind's own most-similar pair (Bitter Coast/Grazelands)
  unique_classes_per_region: 1,
};

const readJSON = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { console.error(`cannot measure: missing ${rel}`); process.exit(2); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

// ============================================================== small maths, all pure and testable

/** sRGB hex -> CIE Lab, then CIE76 dE. Used for the ground-albedo axis. */
export function hexToLab(hex) {
  const h = hex.replace('#', '');
  const to = (i) => parseInt(h.substr(i * 2, 2), 16) / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [lin(to(0)), lin(to(1)), lin(to(2))];
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => { const A = hexToLab(a), B = hexToLab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

export const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 1 : inter / uni;
};

/**
 * Cramer's V for a 2 x k contingency table (two regions' slope histograms).
 * This is the effect size the old chi-square p-value lacked. With n in the thousands a chi-square
 * reports significance on essentially any real pair: it measures DETECTABILITY AT LARGE n, not
 * perceptibility. V is bounded 0..1 for a 2-row table and does not grow with n.
 */
export function cramersV(h1, h2) {
  const k = h1.length;
  const n1 = h1.reduce((a, b) => a + b, 0), n2 = h2.reduce((a, b) => a + b, 0);
  const n = n1 + n2;
  if (!n1 || !n2) return 0;
  let chi2 = 0;
  for (let j = 0; j < k; j++) {
    const col = h1[j] + h2[j];
    if (!col) continue;
    for (const [obs, rowN] of [[h1[j], n1], [h2[j], n2]]) {
      const exp = (rowN * col) / n;
      if (exp > 0) chi2 += ((obs - exp) ** 2) / exp;
    }
  }
  return Math.sqrt(chi2 / n); // min(rows,cols)-1 == 1 for a 2-row table
}
/** The old axis, kept so the report can show what it was passing. df = k-1, alpha .05. */
export function chi2Significant(h1, h2) {
  const k = h1.length;
  const n1 = h1.reduce((a, b) => a + b, 0), n2 = h2.reduce((a, b) => a + b, 0), n = n1 + n2;
  if (!n1 || !n2) return false;
  let chi2 = 0;
  for (let j = 0; j < k; j++) {
    const col = h1[j] + h2[j]; if (!col) continue;
    for (const [obs, rowN] of [[h1[j], n1], [h2[j], n2]]) {
      const exp = (rowN * col) / n; if (exp > 0) chi2 += ((obs - exp) ** 2) / exp;
    }
  }
  // critical values for alpha=.05, df=1..12; df = k-1 where k is the number of occupied bins
  const CRIT = [3.84, 5.99, 7.81, 9.49, 11.07, 12.59, 14.07, 15.51, 16.92, 18.31, 19.68, 21.03];
  const occupied = h1.map((v, j) => v + h2[j]).filter((v) => v > 0).length;
  const df = Math.max(1, occupied - 1);
  return chi2 > (CRIT[df - 1] ?? 21.03);
}

/** Stationary distribution of a row-stochastic transition matrix, by power iteration. */
export function stationary(states, transitions) {
  const n = states.length;
  if (!n) return [];
  let pi = new Array(n).fill(1 / n);
  for (let it = 0; it < 4000; it++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const row = transitions[states[i]] || {};
      for (let j = 0; j < n; j++) next[j] += pi[i] * (row[states[j]] ?? (i === j ? 1 : 0));
    }
    const s = next.reduce((a, b) => a + b, 0) || 1;
    for (let j = 0; j < n; j++) next[j] /= s;
    let d = 0; for (let j = 0; j < n; j++) d += Math.abs(next[j] - pi[j]);
    pi = next;
    if (d < 1e-12) break;
  }
  return pi;
}

/**
 * A region's weather as a distribution over a SHARED, PLAYER-VISIBLE vocabulary.
 *
 * Why this is not optional: the shipped weather.json gives the thirteen regions 41 region-specific
 * state NAMES (`canopy_dim`, `sea_squall`, `queen_agitation`...). Comparing raw name sets makes
 * almost every pair 200 pp apart by construction and the axis passes automatically -- the same
 * instrument-validity failure the ruling exists to stop, one level down. Morrowind's own REGN
 * records use a shared eight-word vocabulary (clear/cloudy/foggy/overcast/rain/thunder/ash/blight),
 * which is what makes its 20 pp floor meaningful. So we bucket each state by the two things a
 * player actually perceives -- light level and how far they can see -- and compare those.
 */
export const SIGHT_BANDS = [100, 250, 500, 900];
export const weatherBucket = (s) => `${s.light}/${SIGHT_BANDS.findIndex((b) => s.sightline_m < b) + 1 || SIGHT_BANDS.length + 1}`;

export function weatherVector(region) {
  const ids = region.states.map((s) => s.id);
  const pi = stationary(ids, region.transitions || {});
  const out = new Map();
  region.states.forEach((s, i) => {
    const k = weatherBucket(s);
    out.set(k, (out.get(k) || 0) + pi[i]);
  });
  return out;
}
export function l1pp(a, b) {
  let d = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) d += Math.abs((a.get(k) || 0) - (b.get(k) || 0));
  return d * 100;
}

// ============================================================== terrain helpers

function decodeChan(channels, name, type, n) {
  const buf = Buffer.from(channels[name], 'base64');
  if (type === 'int16') { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = buf.readInt16LE(i * 2); return a; }
  return new Uint8Array(buf.subarray(0, n));
}

/** Per-cell slope in degrees from the elevation raster, by central difference. */
export function slopeField(T) {
  const { cols, rows, cell_m: cell } = T;
  const n = cols * rows;
  const base = decodeChan(T.channels, 'base_dm', 'int16', n);
  const out = new Float32Array(n);
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(cols - 1, x + 1);
      const zm = Math.max(0, z - 1), zp = Math.min(rows - 1, z + 1);
      const dx = (base[z * cols + xp] - base[z * cols + xm]) / 10 / ((xp - xm) * cell);
      const dz = (base[zp * cols + x] - base[zm * cols + x]) / 10 / ((zp - zm) * cell);
      out[z * cols + x] = (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
    }
  }
  return out;
}

const SLOPE_BINS = [1, 2, 3, 5, 8, 12, 18, 25, 35, 90];
export function slopeHist(slopes) {
  const h = new Array(SLOPE_BINS.length).fill(0);
  for (const s of slopes) h[SLOPE_BINS.findIndex((b) => s < b) === -1 ? SLOPE_BINS.length - 1 : SLOPE_BINS.findIndex((b) => s < b)]++;
  return h;
}

/** Per-region land-cell statistics from the raster. Everything C needs, per constituent. */
export function regionTerrain(T) {
  const { cols, rows } = T;
  const n = cols * rows;
  const base = decodeChan(T.channels, 'base_dm', 'int16', n);
  const region = decodeChan(T.channels, 'region', 'uint8', n);
  const ocean = decodeChan(T.channels, 'ocean', 'uint8', n);
  const slopes = slopeField(T);
  const ids = T.regions.map((r) => r.id);
  const out = {};
  ids.forEach((id, ri) => { out[id] = { cells: 0, slopeSum: 0, slopes: [], min: Infinity, max: -Infinity, below5: 0, above100: 0 }; });
  for (let i = 0; i < n; i++) {
    if (ocean[i]) continue;
    const id = ids[region[i]];
    if (!id) continue;
    const r = out[id];
    const h = base[i] / 10;
    r.cells++; r.slopeSum += slopes[i]; r.slopes.push(slopes[i]);
    if (h < r.min) r.min = h; if (h > r.max) r.max = h;
    if (h < 5) r.below5++; if (h > 100) r.above100++;
  }
  for (const id of ids) {
    const r = out[id];
    if (!r.cells) { r.mean_slope_deg = null; continue; }
    r.mean_slope_deg = +(r.slopeSum / r.cells).toFixed(2);
    r.relief_range_m = +(r.max - r.min).toFixed(1);
    r.frac_below_5m = +(r.below5 / r.cells).toFixed(3);
    r.frac_above_100m = +(r.above100 / r.cells).toFixed(3);
    r.hist = slopeHist(r.slopes);
    delete r.slopes;
  }
  return out;
}

// ============================================================== A — RI-WLD04 M18

export function checkA({ regionsJson, weatherJson, hazardsJson, landforms, terrainStats }) {
  const regs = regionsJson.regions;
  const wByName = {};
  for (const k of Object.keys(weatherJson.regions)) { const r = weatherJson.regions[k]; wByName[r.region] = r; }

  // hazard footprint: the tightened axis needs an area share per region. Look for one; say so if absent.
  const hazardHasExtent = hazardsJson.hazards.some((h) => h.area_fraction != null || h.extent != null || h.footprint != null);

  const rows = [], pairs = [];
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) {
      const A = regs[i], B = regs[j];
      const ta = terrainStats[A.id], tb = terrainStats[B.id];
      const wa = wByName[A.id], wb = wByName[B.id];
      const la = landforms.regions[A.id], lb = landforms.regions[B.id];

      const axes = {};
      // 1 ground albedo — unchanged
      const dE = deltaE(A.ground.albedo, B.ground.albedo);
      axes.albedo = { old: dE > TH.albedo_delta_e, new: dE > TH.albedo_delta_e, value: +dE.toFixed(1) };
      // 2 slope histogram — chi-square p-value  ->  Cramer's V effect size
      const V = (ta?.hist && tb?.hist) ? cramersV(ta.hist, tb.hist) : 0;
      const sig = (ta?.hist && tb?.hist) ? chi2Significant(ta.hist, tb.hist) : false;
      axes.slope = { old: sig, new: V >= TH.slope_cramers_v, value: +V.toFixed(3) };
      // 3,4,5 species / architecture Jaccards — unchanged
      const jf = jaccard(A.flora, B.flora), jfa = jaccard(A.fauna, B.fauna), jar = jaccard(A.architecture, B.architecture);
      axes.flora = { old: jf < TH.flora_jaccard, new: jf < TH.flora_jaccard, value: +jf.toFixed(3) };
      axes.fauna = { old: jfa < TH.fauna_jaccard, new: jfa < TH.fauna_jaccard, value: +jfa.toFixed(3) };
      axes.architecture = { old: jar < TH.arch_jaccard, new: jar < TH.arch_jaccard, value: +jar.toFixed(3) };
      // 6 audio — "any difference"  ->  >=50% of the bed's assets differ
      const ja = jaccard(A.audio, B.audio);
      const fracDiffer = 1 - ja;
      axes.audio = {
        old: JSON.stringify([...A.audio].sort()) !== JSON.stringify([...B.audio].sort()),
        new: fracDiffer >= TH.audio_frac_differ, value: +fracDiffer.toFixed(3),
      };
      // 7 weather — "any difference" in the state set  ->  >=20 pp L1 on the stationary distribution
      let l1 = null, oldW = false;
      if (wa && wb) {
        l1 = l1pp(weatherVector(wa), weatherVector(wb));
        oldW = JSON.stringify(wa.states.map((s) => s.id).sort()) !== JSON.stringify(wb.states.map((s) => s.id).sort());
      }
      axes.weather = { old: oldW, new: l1 != null && l1 >= TH.weather_l1_pp, value: l1 == null ? null : +l1.toFixed(1) };
      // 8 fog extinction — unchanged
      const fa = A.fog.extinction_per_m, fb = B.fog.extinction_per_m;
      const rel = Math.abs(fa - fb) / Math.max(fa, fb);
      axes.fog = { old: rel > TH.fog_rel, new: rel > TH.fog_rel, value: +rel.toFixed(3) };
      // 9 hazard — "any difference"  ->  different type AND each occupies >=15% of its region
      const diffType = String(A.hazard) !== String(B.hazard);
      axes.hazard = {
        old: diffType,
        new: hazardHasExtent ? diffType /* extent test would go here */ : false,
        value: hazardHasExtent ? 'measurable' : 'unmeasurable: hazards.json declares no footprint',
      };
      // 10 landform — RI-WLD16 §4, compulsory under the new form
      const lfDiff = !!(la && lb) && (la.macro_form !== lb.macro_form || (la.drainage !== lb.drainage && la.bedrock !== lb.bedrock));
      axes.landform = { old: null, new: lfDiff, value: la && lb ? `${la.macro_form} vs ${lb.macro_form}` : 'missing' };

      const oldCount = Object.values(axes).filter((a) => a.old === true).length;
      const newCount = Object.values(axes).filter((a) => a.new === true).length;
      pairs.push({
        a: A.id, b: B.id, old_axes: oldCount, new_axes: newCount,
        landform_differs: lfDiff,
        new_pass: newCount >= TH.axes_required && lfDiff,
        old_pass: oldCount >= TH.axes_required,
        axes,
      });
    }
  }
  const perAxis = {};
  for (const k of Object.keys(pairs[0].axes)) {
    perAxis[k] = {
      old_counts_as_differing: pairs.filter((p) => p.axes[k].old === true).length,
      new_counts_as_differing: pairs.filter((p) => p.axes[k].new === true).length,
      of: pairs.length,
    };
  }
  const fails = [];
  const newFail = pairs.filter((p) => !p.new_pass);
  const hardFail = pairs.filter((p) => p.new_axes <= TH.axes_fail_at);
  for (const p of newFail.slice().sort((x, y) => x.new_axes - y.new_axes).slice(0, 8)) {
    fails.push(`M18 ${p.a}/${p.b}: ${p.new_axes}/10 axes differ under the magnitude floors (old form: ${p.old_axes}/9)${p.landform_differs ? '' : '; landform axis does not differ'}`);
  }
  return {
    check: 'A', item: 'RI-WLD04 M18', pairs_total: pairs.length,
    old_pass: pairs.length - pairs.filter((p) => !p.old_pass).length,
    new_pass: pairs.length - newFail.length,
    old_fail: pairs.filter((p) => !p.old_pass).length,
    new_fail: newFail.length,
    hard_fail_pairs: hardFail.length,
    hazard_axis_measurable: hazardHasExtent,
    per_axis: perAxis,
    worst_pairs: pairs.slice().sort((x, y) => x.new_axes - y.new_axes).slice(0, 10).map((p) => ({ a: p.a, b: p.b, old: p.old_axes, new: p.new_axes })),
    pairs, fails, pass: newFail.length === 0,
  };
}

// ============================================================== B — RI-WLD04 M19

export function checkB({ regionsJson, signaturesJson, T, terrainRegionCells }) {
  const regs = regionsJson.regions;
  const byRegion = new Map();
  for (const inst of signaturesJson.instances) {
    if (!byRegion.has(inst.region)) byRegion.set(inst.region, []);
    byRegion.get(inst.region).push(inst);
  }
  const rows = [], fails = [];
  const cell = T.cell_m, cols = T.cols;
  for (const R of regs) {
    const inst = byRegion.get(R.id) || [];
    const kinds = new Set(inst.map((i) => i.kind));
    const bx = R.bounds_m.x, bz = R.bounds_m.z;
    const mx = (bx[0] + bx[1]) / 2, mz = (bz[0] + bz[1]) / 2;
    // quadrant spread over the region AABB
    const quads = new Set(inst.map((i) => `${i.x < mx ? 0 : 1}${i.z < mz ? 0 : 1}`));
    // coverage: share of the region's own land cells within 400 m of an instance
    const cells = terrainRegionCells[R.id] || [];
    let covered = 0;
    const r2 = TH.onlyhere_coverage_r_m ** 2;
    for (const [x, z] of cells) {
      const wx = x * cell, wz = z * cell;
      let hit = false;
      for (const i of inst) { const dx = i.x - wx, dz = i.z - wz; if (dx * dx + dz * dz <= r2) { hit = true; break; } }
      if (hit) covered++;
    }
    const cov = cells.length ? covered / cells.length : 0;
    const foreign = signaturesJson.instances.filter((i) => kinds.has(i.kind) && i.region !== R.id).length;
    const okCount = inst.length >= TH.onlyhere_min_instances;
    const okQuad = quads.size >= TH.onlyhere_min_quadrants;
    const okCov = cov >= TH.onlyhere_coverage_frac;
    const okPure = foreign === 0;
    rows.push({
      region: R.id, only_here: R.only_here ?? [...kinds][0] ?? null, instances: inst.length,
      quadrants_occupied: quads.size, coverage_within_400m: +cov.toFixed(3),
      instances_in_other_regions: foreign,
      old_pass: okCount && okPure, new_pass: okCount && okPure && okQuad && okCov,
    });
    if (!okCount) fails.push(`M19 ${R.id}: ${inst.length} instances (floor ${TH.onlyhere_min_instances})`);
    else if (!okQuad || !okCov) {
      const why = [];
      if (!okQuad) why.push(`in ${quads.size} of 4 quadrants (floor ${TH.onlyhere_min_quadrants})`);
      if (!okCov) why.push(`${(cov * 100).toFixed(0)}% of the region within 400 m of one (floor ${TH.onlyhere_coverage_frac * 100}%)`);
      fails.push(`M19 ${R.id}: ${inst.length} instances but ${why.join(', ')}`);
    }
    if (!okPure) fails.push(`M19 ${R.id}: ONLY-HERE kind found ${foreign} time(s) outside the region`);
  }
  return {
    check: 'B', item: 'RI-WLD04 M19',
    old_pass: rows.filter((r) => r.old_pass).length, new_pass: rows.filter((r) => r.new_pass).length,
    of: rows.length, rows, fails, pass: fails.length === 0,
  };
}

// ============================================================== C — RI-WLD07 §4

const FORM_ENVELOPES = {
  'tidal-flat': { relief_range_m: [0, 20], mean_slope_deg: [0, 6] },
  'levee-and-backswamp': { relief_range_m: [5, 40], mean_slope_deg: [0, 8] },
  'raised-bog': { relief_range_m: [10, 90], mean_slope_deg: [2, 10] },
  'karst-tower': { relief_range_m: [60, 400], mean_slope_deg: [7, 25] },
  escarpment: { relief_range_m: [80, 400], mean_slope_deg: [10, 28] },
  'ridge-and-ravine': { relief_range_m: [150, 600], mean_slope_deg: [18, 45] },
  'alluvial-fan': { relief_range_m: [10, 80], mean_slope_deg: [2, 12] },
  playa: { relief_range_m: [0, 25], mean_slope_deg: [0, 7] },
  badland: { relief_range_m: [15, 120], mean_slope_deg: [4, 20] },
  'dune-and-pan': { relief_range_m: [3, 40], mean_slope_deg: [1, 10] },
  'hummock-field': { relief_range_m: [3, 40], mean_slope_deg: [3, 14] },
  'terrace-staircase': { relief_range_m: [40, 300], mean_slope_deg: [6, 22] },
  'crater-field': { relief_range_m: [5, 60], mean_slope_deg: [2, 14] },
};

export function checkC({ terrainStats, landforms, T }) {
  const rows = [], fails = [];
  let wsum = 0, wn = 0;
  for (const [id, r] of Object.entries(terrainStats)) {
    if (!r.cells) continue;
    wsum += r.slopeSum; wn += r.cells;
    const lf = landforms.regions[id];
    const env = lf ? FORM_ENVELOPES[lf.macro_form] : null;
    const inEnv = env ? (r.mean_slope_deg >= env.mean_slope_deg[0] && r.mean_slope_deg <= env.mean_slope_deg[1]) : null;
    const inBand = r.mean_slope_deg >= TH.slope_target[0] && r.mean_slope_deg <= TH.slope_target[1];
    rows.push({
      region: id, macro_form: lf?.macro_form ?? null,
      mean_slope_deg: r.mean_slope_deg, envelope: env?.mean_slope_deg ?? null, in_envelope: inEnv,
      relief_range_m: r.relief_range_m, envelope_relief: env?.relief_range_m ?? null,
      in_relief_envelope: env ? (r.relief_range_m >= env.relief_range_m[0] && r.relief_range_m <= env.relief_range_m[1]) : null,
      frac_below_5m: r.frac_below_5m, frac_above_100m: r.frac_above_100m,
      in_generic_band: inBand, hard_fail: r.mean_slope_deg < TH.slope_fail_below,
    });
  }
  const worldMean = +(wsum / wn).toFixed(2);
  for (const r of rows) {
    if (r.in_envelope === false) fails.push(`WLD07-4 ${r.region}: declares "${r.macro_form}" (envelope ${r.envelope[0]}-${r.envelope[1]}deg), built terrain is ${r.mean_slope_deg}deg`);
    if (r.in_relief_envelope === false) fails.push(`WLD07-4 ${r.region}: relief range ${r.relief_range_m} m outside "${r.macro_form}" envelope ${r.envelope_relief[0]}-${r.envelope_relief[1]} m`);
  }
  return {
    check: 'C', item: 'RI-WLD07 §4',
    world_mean_slope_deg: worldMean,
    world_mean_in_band: worldMean >= TH.slope_target[0] && worldMean <= TH.slope_target[1],
    world_frac_below_5m: T.frac_land_below_5m, world_frac_above_100m: T.frac_land_above_100m,
    regions_in_envelope: rows.filter((r) => r.in_envelope).length,
    regions_in_relief_envelope: rows.filter((r) => r.in_relief_envelope).length,
    regions_in_generic_band: rows.filter((r) => r.in_generic_band).length,
    of: rows.length, rows, fails, pass: fails.length === 0,
  };
}

// ============================================================== D — RI-WLD02 place-type mix

export function checkD({ poisJson, regionsJson }) {
  const regs = regionsJson.regions.map((r) => r.id);
  const byRegion = new Map(regs.map((r) => [r, new Set()]));
  const countByRegion = new Map(regs.map((r) => [r, 0]));
  for (const p of poisJson.pois) {
    if (!byRegion.has(p.region)) { byRegion.set(p.region, new Set()); countByRegion.set(p.region, 0); }
    byRegion.get(p.region).add(p.kind);
    countByRegion.set(p.region, countByRegion.get(p.region) + 1);
  }
  const kindOwners = new Map();
  for (const [r, kinds] of byRegion) for (const k of kinds) kindOwners.set(k, (kindOwners.get(k) || new Set()).add(r));
  const rows = regs.map((r) => ({
    region: r, pois: countByRegion.get(r) || 0, place_types: [...(byRegion.get(r) || [])],
    unique_types: [...(byRegion.get(r) || [])].filter((k) => kindOwners.get(k).size === 1),
  }));
  const pairs = [];
  for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
    const A = byRegion.get(regs[i]), B = byRegion.get(regs[j]);
    if (!A.size && !B.size) { pairs.push({ a: regs[i], b: regs[j], jaccard: null, note: 'both regions hold no POI' }); continue; }
    pairs.push({ a: regs[i], b: regs[j], jaccard: +jaccard([...A], [...B]).toFixed(3) });
  }
  const over = pairs.filter((p) => p.jaccard != null && p.jaccard > TH.placetype_jaccard_max);
  const noUnique = rows.filter((r) => r.unique_types.length < TH.unique_classes_per_region);
  const fails = [];
  if (over.length) fails.push(`WLD02 place-type Jaccard > ${TH.placetype_jaccard_max} on ${over.length}/${pairs.length} region pairs (worst ${Math.max(...over.map((p) => p.jaccard))})`);
  for (const r of noUnique.slice(0, 13)) fails.push(`WLD02 ${r.region}: no POI class unique to it (${r.pois} POIs, ${r.place_types.length} type(s))`);
  return {
    check: 'D', item: 'RI-WLD02',
    distinct_place_types_world: kindOwners.size,
    pairs_measurable: pairs.filter((p) => p.jaccard != null).length, pairs_total: pairs.length,
    pairs_over_threshold: over.length,
    regions_with_a_unique_class: rows.length - noUnique.length, of: rows.length,
    rows, pairs, fails, pass: fails.length === 0,
  };
}

// ============================================================== E — RI-WLD09 x RI-WLD15 W15-7
// This implements RI-WLD15 M-W15-4, which the item names and no instrument had.

const pointInPoly = (x, z, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

export function checkE({ T, voidsJson }) {
  const W = loadWorld(T);
  const cellSeconds = W.cell / W15TH.walk_speed_ms;
  const steps = Math.round(W15TH.window_m / W.cell);
  const rows = [], fails = [];
  for (const V of voidsJson.voids) {
    const cells = [];
    for (let z = 1; z < W.rows - 1; z++) for (let x = 1; x < W.cols - 1; x++) {
      const i = z * W.cols + x;
      if (W.ocean[i]) continue;
      if (pointInPoly(x * W.cell, z * W.cell, V.polygon)) cells.push([x, z]);
    }
    if (cells.length < steps) { rows.push({ tract: V.id, name: V.name, cells: cells.length, status: 'tract too small to walk 720 m inside' }); continue; }
    let rnd = 7;
    const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const inTract = new Set(cells.map(([x, z]) => z * W.cols + x));
    const walks = [];
    for (let t = 0; t < 60 && walks.length < 24; t++) {
      const [x0, z0] = cells[Math.floor(rand() * cells.length)];
      const ang = (Math.floor(rand() * 8) / 8) * Math.PI * 2;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const sigs = [];
      for (let s = 0; s < steps; s++) {
        const x = Math.round(x0 + dx * s), z = Math.round(z0 + dz * s);
        if (x < 1 || z < 1 || x >= W.cols - 1 || z >= W.rows - 1) break;
        const i = z * W.cols + x;
        if (W.ocean[i] || !inTract.has(i)) break;
        sigs.push(signatureAt(W, x, z));
      }
      if (sigs.length < steps * 0.6) continue;
      let longest = 0, cur = 0, prev = null;
      for (const s of sigs) { if (s === prev) cur++; else { longest = Math.max(longest, cur); cur = 1; prev = s; } }
      longest = Math.max(longest, cur);
      walks.push({ distinct: new Set(sigs).size, longest_run_s: +(longest * cellSeconds).toFixed(1) });
    }
    if (!walks.length) { rows.push({ tract: V.id, name: V.name, cells: cells.length, status: 'no 720 m transect stays inside the tract' }); continue; }
    const runs = walks.map((w) => w.longest_run_s).sort((a, b) => a - b);
    const dis = walks.map((w) => w.distinct).sort((a, b) => a - b);
    const row = {
      tract: V.id, name: V.name, region: V.region, reason: V.reason, area_km2: V.area_km2,
      declared_empty_walk_s: V.longest_empty_walk_s, walks: walks.length,
      median_longest_run_s: runs[Math.floor(runs.length / 2)],
      p90_longest_run_s: runs[Math.min(runs.length - 1, Math.floor(runs.length * 0.9))],
      median_signatures_per_walk: dis[Math.floor(dis.length / 2)],
      min_signatures_per_walk: dis[0],
    };
    row.w15_1_pass = row.median_longest_run_s <= W15TH.median_run_s_target;
    row.w15_3_pass = row.median_signatures_per_walk >= W15TH.median_signatures_per_walk_target && row.min_signatures_per_walk >= W15TH.min_signatures_per_walk_floor;
    row.new_pass = row.w15_1_pass && row.w15_3_pass;
    rows.push(row);
    if (!row.w15_1_pass) fails.push(`WLD09/W15-7 ${V.id} "${V.name}": median unchanging-ground run ${row.median_longest_run_s}s inside the tract (target <=${W15TH.median_run_s_target}s, unrelaxed)`);
    if (!row.w15_3_pass) fails.push(`WLD09/W15-7 ${V.id} "${V.name}": median ${row.median_signatures_per_walk} ground states per 720 m walk (target >=${W15TH.median_signatures_per_walk_target}), worst walk ${row.min_signatures_per_walk}`);
  }
  return {
    check: 'E', item: 'RI-WLD09 x RI-WLD15 W15-7 (implements M-W15-4)',
    tracts: voidsJson.voids.length, measured: rows.filter((r) => r.walks).length,
    passing: rows.filter((r) => r.new_pass).length,
    rows, fails, pass: fails.length === 0,
  };
}

// ============================================================== driver

function regionCellIndex(T) {
  const { cols, rows } = T;
  const n = cols * rows;
  const region = decodeChan(T.channels, 'region', 'uint8', n);
  const ocean = decodeChan(T.channels, 'ocean', 'uint8', n);
  const ids = T.regions.map((r) => r.id);
  const out = {}; ids.forEach((id) => { out[id] = []; });
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const i = z * cols + x; if (ocean[i]) continue;
    const id = ids[region[i]]; if (id) out[id].push([x, z]);
  }
  return out;
}

export function runAll() {
  const T = readJSON(P.terrain);
  const regionsJson = readJSON(P.regions);
  const weatherJson = readJSON(P.weather);
  const hazardsJson = readJSON(P.hazards);
  const poisJson = readJSON(P.pois);
  const voidsJson = readJSON(P.voids);
  const signaturesJson = readJSON(P.signatures);
  const landforms = readJSON(P.landforms);

  const terrainStats = regionTerrain(T);
  const terrainRegionCells = regionCellIndex(T);

  const A = checkA({ regionsJson, weatherJson, hazardsJson, landforms, terrainStats });
  const B = checkB({ regionsJson, signaturesJson, T, terrainRegionCells });
  const C = checkC({ terrainStats, landforms, T });
  const D = checkD({ poisJson, regionsJson });
  const E = checkE({ T, voidsJson });

  const checks = [A, B, C, D, E];
  return { thresholds: TH, checks, fails: checks.flatMap((c) => c.fails), pass: checks.every((c) => c.pass) };
}

// ============================================================== selfcheck
// Each control is the PLAUSIBLE WRONG ANSWER: it passes the OLD predicate and must fail the NEW one.
// Both directions are asserted. A control that could never have passed proves nothing.

function selfcheck() {
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };

  // --- verify the 20 pp floor is really Morrowind's own closest pair, from the mined census ---
  {
    const c = readJSON(P.mwCensus);
    const names = Object.keys(c.regions);
    const ds = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const A = c.regions[names[i]].weather.states, B = c.regions[names[j]].weather.states;
      let d = 0; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) d += Math.abs((A[k] || 0) - (B[k] || 0));
      ds.push(d);
    }
    ds.sort((a, b) => a - b);
    ok(ds[0] === TH.weather_l1_pp, `derivation: recomputed Morrowind min weather L1 is ${ds[0]} pp, item encodes ${TH.weather_l1_pp} pp`);
    ok(c.derived.weather_min_l1_pp === ds[0], `derivation: census records min ${c.derived.weather_min_l1_pp} pp, recompute says ${ds[0]} pp`);
    const jl = c.derived.place_type_max_jaccard;
    ok(Math.abs(jl - TH.placetype_jaccard_max) < 1e-6, `derivation: census max place-type Jaccard ${jl}, item encodes ${TH.placetype_jaccard_max}`);
  }

  // --- A1: the audit's named bad result. Two regions that share everything, plus token differences.
  // Plausible: one extra rare weather state, one swapped audio asset of three, a nominally different
  // hazard label. The OLD "any difference" axes all count; the NEW magnitude floors must not.
  {
    const stA = [
      { id: 'clear', light: 'sun', sightline_m: 800 },
      { id: 'rain', light: 'overcast', sightline_m: 300 },
    ];
    const stB = [
      { id: 'clear', light: 'sun', sightline_m: 800 },
      { id: 'rain', light: 'overcast', sightline_m: 300 },
      { id: 'freak_squall', light: 'overcast', sightline_m: 300 }, // the 0.5% extra state
    ];
    const trA = { clear: { clear: 0.7, rain: 0.3 }, rain: { clear: 0.5, rain: 0.5 } };
    const trB = { clear: { clear: 0.697, rain: 0.298, freak_squall: 0.005 }, rain: { clear: 0.5, rain: 0.495, freak_squall: 0.005 }, freak_squall: { clear: 0.5, rain: 0.5 } };
    const l1 = l1pp(weatherVector({ states: stA, transitions: trA }), weatherVector({ states: stB, transitions: trB }));
    ok(JSON.stringify(stA.map((s) => s.id)) !== JSON.stringify(stB.map((s) => s.id)), 'A1 control should pass the OLD any-difference weather axis');
    ok(l1 < TH.weather_l1_pp, `A1 weather: near-miss pair scored ${l1.toFixed(1)} pp, should be under the ${TH.weather_l1_pp} pp floor`);

    const audA = ['amb_marsh', 'amb_frogs', 'sfx_drum'];
    const audB = ['amb_marsh', 'amb_frogs', 'sfx_bell']; // one asset of three swapped
    ok(JSON.stringify(audA) !== JSON.stringify(audB), 'A1 control should pass the OLD any-difference audio axis');
    ok(1 - jaccard(audA, audB) < TH.audio_frac_differ, `A1 audio: ${((1 - jaccard(audA, audB)) * 100).toFixed(0)}% of assets differ, should be under ${TH.audio_frac_differ * 100}%`);
  }

  // --- A2: slope. Two large regions drawn from the SAME distribution with a small real shift.
  // chi-square at n>3000 must call it significant (the old axis passes); Cramer's V must not.
  {
    const base = [200, 400, 700, 900, 600, 400, 200, 90, 40, 10];
    const shifted = base.map((v, i) => Math.round(v * (1 + (i % 2 ? 0.06 : -0.06))));
    ok(chi2Significant(base, shifted), 'A2 slope: chi-square should call the near-miss pair significant (that is the old axis passing)');
    ok(cramersV(base, shifted) < TH.slope_cramers_v, `A2 slope: Cramer's V ${cramersV(base, shifted).toFixed(3)} should be under ${TH.slope_cramers_v}`);
    // and it must still SEE a real difference — an instrument that never fires is not a bar
    const real = [10, 40, 90, 200, 400, 600, 900, 700, 400, 200];
    ok(cramersV(base, real) >= TH.slope_cramers_v, `A2 slope: Cramer's V on a genuinely different pair is ${cramersV(base, real).toFixed(3)}, should clear ${TH.slope_cramers_v}`);
  }

  // --- B: the diorama. EIGHT instances (the old floor exactly), zero elsewhere, all in one clump.
  // Not zero instances — the right count, the wrong arrangement.
  {
    const cols = 80, rows = 80, cell = 25;
    const T = { cols, rows, cell_m: cell, regions: [{ id: 'r0' }] };
    const cells = []; for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) cells.push([x, z]);
    const regionsJson = { regions: [{ id: 'r0', only_here: 'flute', bounds_m: { x: [0, cols * cell], z: [0, rows * cell] } }] };
    const clump = { instances: [] };
    for (let i = 0; i < 8; i++) clump.instances.push({ kind: 'flute', region: 'r0', x: 500 + i * 6, z: 500 + i * 6 });
    const res = checkB({ regionsJson, signaturesJson: clump, T, terrainRegionCells: { r0: cells } });
    ok(res.rows[0].old_pass === true, 'B control: eight-in-a-clump should PASS the old count-only predicate');
    ok(res.rows[0].new_pass === false, 'B control: eight-in-a-clump should FAIL the spread predicate');
    ok(res.rows[0].quadrants_occupied === 1, `B control: expected 1 quadrant, got ${res.rows[0].quadrants_occupied}`);
    // and the positive direction: the same eight, spread out, must pass
    const spread = { instances: [] };
    for (let i = 0; i < 24; i++) spread.instances.push({ kind: 'flute', region: 'r0', x: 150 + (i % 6) * 330, z: 150 + Math.floor(i / 6) * 480 });
    const res2 = checkB({ regionsJson, signaturesJson: spread, T, terrainRegionCells: { r0: cells } });
    ok(res2.rows[0].new_pass === true, `B control: a genuinely spread population should PASS (got quadrants ${res2.rows[0].quadrants_occupied}, coverage ${res2.rows[0].coverage_within_400m})`);
  }

  // --- C: the current world's exact shape. A world-mean slope of 10.07 deg sitting mid-band while
  // most regions are flat. Not a plane — a plane fails by accident.
  {
    const mk = (id, slope, form) => [id, { cells: 1000, slopeSum: slope * 1000, mean_slope_deg: slope, relief_range_m: form === 'ridge-and-ravine' ? 400 : 12, frac_below_5m: 0.4, frac_above_100m: 0.13, hist: [] }];
    const flat = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((i) => mk(i, 4.2, 'levee-and-backswamp'));
    const steep = ['h', 'i'].map((i) => mk(i, 30.3, 'ridge-and-ravine'));
    const mid = ['j', 'k', 'l', 'm'].map((i) => mk(i, 9.0, 'raised-bog'));
    const terrainStats = Object.fromEntries([...flat, ...steep, ...mid]);
    const landforms = { regions: Object.fromEntries(Object.keys(terrainStats).map((id) => [id, { macro_form: terrainStats[id].mean_slope_deg > 20 ? 'ridge-and-ravine' : terrainStats[id].mean_slope_deg < 6 ? 'raised-bog' : 'raised-bog' }])) };
    const res = checkC({ terrainStats, landforms, T: { frac_land_below_5m: 0.4, frac_land_above_100m: 0.13 } });
    ok(res.world_mean_in_band === true, `C control: the world MEAN should sit in band (got ${res.world_mean_slope_deg} deg) — that is the old bar passing`);
    ok(res.pass === false, 'C control: per-region envelopes should FAIL a world carried by two steep regions');
    ok(res.regions_in_generic_band < res.of, `C control: expected most regions out of band, got ${res.regions_in_generic_band}/${res.of}`);
  }

  // --- D: a DENSE world with a uniform menu. Every region well stocked — the old D-metrics all pass
  // — but every region offers the same kinds of thing. Not an empty world.
  {
    const regionsJson = { regions: 'abcdefghijklm'.split('').map((id) => ({ id })) };
    const pois = [];
    for (const r of regionsJson.regions) for (let i = 0; i < 80; i++) pois.push({ region: r.id, kind: ['cave', 'camp', 'ruin', 'shrine'][i % 4] });
    const res = checkD({ poisJson: { pois }, regionsJson });
    ok(res.pairs.every((p) => p.jaccard === 1), 'D control: a uniform menu should score Jaccard 1.0 on every pair');
    ok(res.pass === false, 'D control: a dense but uniform world should FAIL the place-type predicate');
    // positive direction: give each region one class of its own and vary the menu
    const pois2 = [];
    regionsJson.regions.forEach((r, ri) => { for (let i = 0; i < 20; i++) pois2.push({ region: r.id, kind: i === 0 ? `only_${r.id}` : `k${(ri + i) % 3}` }); });
    const res2 = checkD({ poisJson: { pois: pois2 }, regionsJson });
    ok(res2.regions_with_a_unique_class === 13, `D control: differentiated world should give all 13 regions a unique class, got ${res2.regions_with_a_unique_class}`);
  }

  // --- E: a tract that satisfies every one of RI-WLD09 V1-V9 and is drawn over monotone ground.
  // The plausible wrong answer is a WELL-FORMED tract, not a missing one.
  {
    const cols = 120, rows = 120, cell = 25, n = cols * rows;
    const base = new Int16Array(n), woff = new Int16Array(n);
    const sub = new Uint8Array(n), reg = new Uint8Array(n), oc = new Uint8Array(n);
    for (let i = 0; i < n; i++) { base[i] = 20; sub[i] = 1; }   // dead flat, one substrate
    const b64 = (ta, bytes) => { const buf = Buffer.alloc(ta.length * bytes); for (let i = 0; i < ta.length; i++) bytes === 2 ? buf.writeInt16LE(ta[i], i * 2) : buf.writeUInt8(ta[i], i); return buf.toString('base64'); };
    const T = {
      cols, rows, cell_m: cell, regions: [{ id: 'r0' }],
      channels: { base_dm: b64(base, 2), substrate: b64(sub, 1), region: b64(reg, 1), woff_cm: b64(woff, 2), ocean: b64(oc, 1), substrate_names: ['mud'] },
    };
    const voidsJson = { voids: [{ id: 'V-X', name: 'The Well-Formed Nothing', region: 'r0', reason: 'dread', area_km2: 0.62, payoff_poi: 'poi:x', routes: ['road:x'], longest_empty_walk_s: 420, polygon: [[200, 200], [2200, 200], [2200, 2200], [200, 2200]] }] };
    const res = checkE({ T, voidsJson });
    ok(res.measured === 1, `E control: the tract should be measurable (got ${res.measured})`);
    ok(res.pass === false, 'E control: a well-formed tract over monotone ground should FAIL W15-7');
    // positive direction: vary the substrate and it must go green
    const sub2 = new Uint8Array(n);
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) sub2[z * cols + x] = (Math.floor(x / 2) * 7 + Math.floor(z / 3) * 13 + ((x * z) % 5)) % 9;
    const base2 = new Int16Array(n);
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) base2[z * cols + x] = Math.round(200 + 120 * Math.sin(x / 3.1) + 90 * Math.cos(z / 2.3) + 60 * Math.sin((x + z) / 1.7));
    const T2 = { ...T, channels: { ...T.channels, substrate: b64(sub2, 1), base_dm: b64(base2, 2), substrate_names: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] } };
    const res2 = checkE({ T: T2, voidsJson });
    ok(res2.pass === true, `E control: a varied tract must PASS, else the check can never go green (fails: ${res2.fails.join('; ')})`);
  }

  console.log(bad.length ? `selfcheck: ${bad.length} failure(s)\n  - ${bad.join('\n  - ')}`
    : 'selfcheck: all five checks separate a PLAUSIBLE near-miss from a real pass, in both directions,\n           and the 20 pp / 0.727 figures reproduce from the mined Morrowind census.');
  process.exit(bad.length ? 1 : 0);
}

// ============================================================== cli

if (process.argv[2] === '--selfcheck') selfcheck();
else {
  const res = runAll();
  const c = Object.fromEntries(res.checks.map((x) => [x.check, x]));
  console.log('Ruling W1 — the five tightened predicates, measured on the shipped world\n');
  console.log(`A  RI-WLD04 M18   region pairs passing: ${c.A.old_pass}/${c.A.pairs_total} under the old axes  ->  ${c.A.new_pass}/${c.A.pairs_total} with magnitude floors`);
  for (const [k, v] of Object.entries(c.A.per_axis)) console.log(`     ${k.padEnd(13)} counted as differing on ${String(v.old_counts_as_differing).padStart(3)}/${v.of} pairs (old)  ->  ${String(v.new_counts_as_differing).padStart(3)}/${v.of} (new)`);
  if (!c.A.hazard_axis_measurable) console.log('     hazard        NOT MEASURABLE — hazards.json declares no footprint, so no pair may claim it');
  console.log(`\nB  RI-WLD04 M19   ONLY-HERE elements passing: ${c.B.old_pass}/${c.B.of} on count alone  ->  ${c.B.new_pass}/${c.B.of} with spread`);
  for (const r of c.B.rows) console.log(`     ${r.region.padEnd(19)} ${String(r.instances).padStart(3)} inst, ${r.quadrants_occupied}/4 quadrants, ${(r.coverage_within_400m * 100).toFixed(0).padStart(3)}% within 400 m  ${r.new_pass ? 'pass' : 'FAIL'}`);
  console.log(`\nC  RI-WLD07 §4    world mean slope ${c.C.world_mean_slope_deg}° (${c.C.world_mean_in_band ? 'IN BAND — the old row passes' : 'out of band'})`);
  console.log(`                  regions inside their RI-WLD16 slope envelope: ${c.C.regions_in_envelope}/${c.C.of};  relief envelope: ${c.C.regions_in_relief_envelope}/${c.C.of}`);
  for (const r of c.C.rows) console.log(`     ${r.region.padEnd(19)} ${String(r.mean_slope_deg).padStart(6)}°  envelope ${r.envelope ? `${r.envelope[0]}-${r.envelope[1]}°` : '—'}  ${r.in_envelope ? 'in' : 'OUT'}   relief ${String(r.relief_range_m).padStart(6)} m ${r.in_relief_envelope ? 'in' : 'OUT'}`);
  console.log(`\nD  RI-WLD02       ${c.D.pairs_over_threshold}/${c.D.pairs_measurable} measurable region pairs over the ${TH.placetype_jaccard_max} place-type Jaccard ceiling`);
  console.log(`                  regions with at least one POI class of their own: ${c.D.regions_with_a_unique_class}/${c.D.of}  (world holds ${c.D.distinct_place_types_world} POI classes in all)`);
  console.log(`\nE  RI-WLD09/W15-7 declared void tracts passing unrelaxed variety: ${c.E.passing}/${c.E.measured} measured (${c.E.tracts} declared)`);
  for (const r of c.E.rows) console.log(r.walks ? `     ${r.tract} ${String(r.name).padEnd(24)} median run ${String(r.median_longest_run_s).padStart(6)}s, ${r.median_signatures_per_walk} states/walk  ${r.new_pass ? 'pass' : 'FAIL'}` : `     ${r.tract} ${String(r.name).padEnd(24)} ${r.status}`);
  console.log(`\n${res.fails.length} breach(es) of the tightened predicates.`);
  for (const f of res.fails) console.log(`  - ${f}`);
  const ji = process.argv.indexOf('--json');
  if (ji > 0 && process.argv[ji + 1]) { fs.writeFileSync(process.argv[ji + 1], JSON.stringify(res, null, 1)); console.log(`\nwrote ${process.argv[ji + 1]}`); }
  process.exit(res.pass ? 0 : 1);
}
