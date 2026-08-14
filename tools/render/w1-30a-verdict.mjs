#!/usr/bin/env node
/**
 * w1-30a-verdict.mjs — read a `w1-30a-frame-probe` report and judge it against W1-30A's bar.
 *
 * THE RULE THIS FILE OBEYS, and it is doctrine now: **statistics can fail a build and can never
 * pass one.** Nothing below is allowed to say a frame looks good. Every row here can only do one
 * of two things — go red, or decline to go red. The green column is a licence to go and LOOK at
 * the contact sheets, not a substitute for it. The previous contract's load-bearing statistics
 * were a family that procedural noise raises, which is how a noise-textured world scored well.
 *
 * TWO PLACES WHERE THIS DEPARTS FROM THE PLAN'S WRITTEN NUMBERS, both stated rather than quietly
 * substituted:
 *
 *  1. The plan's crawl row measures "pixels whose luma changes between consecutive frames while
 *     the camera and subject are both static in world space". Taken literally that measures
 *     animation, not aliasing: with nothing moving there is no sub-pixel sampling change, so
 *     there is nothing for antialiasing to fix. What actually costs a player is a silhouette
 *     crawling under a slow pan, so the probe pans at ~0.5 px/frame and the static case is kept
 *     as the FLOOR the pan number is read against.
 *  2. The plan's grade row wants separation "≥ the corpus-defined swatch distance", and no such
 *     constant exists in the tree. Rather than invent one, the threshold is derived from the null
 *     control: the flat-grade run (every region pinned to ONE REAL grade) IS the distribution of
 *     "separation that is not the grade's doing", so its 90th percentile is the noise floor and
 *     the real grade has to clear it. A threshold that comes out of the control cannot be tuned
 *     to pass.
 *
 * AGGREGATION. Ruling W1: an aggregate may never be the binding predicate for something a player
 * meets one at a time. A player stands in one place and pans once, so the crawl and edge rows bind
 * on the WORST stop, not the mean. The means are printed beside them for context only.
 *
 * Usage: node tools/render/w1-30a-verdict.mjs --in reports/w1-30a/probe/probe.json
 */
import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const IN = path.resolve(args.in || 'reports/w1-30a/probe/probe.json');
const P = JSON.parse(fs.readFileSync(IN, 'utf8'));
const ok = P.rows.filter((r) => r.status === 'ok');
const by = (variant) => Object.fromEntries(ok.filter((r) => r.variant === variant).map((r) => [r.stop, r]));

const B = by('baseline'), A = by('after'), NOAA = by('after-noaa'),
  NOMSAA = by('after-nomsaa'), NOFXAA = by('after-nofxaa'), NODITHER = by('after-nodither');
const stops = Object.keys(A).filter((s) => B[s]);

const num = (v) => (Number.isFinite(v) ? v : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };

const rows = [];
const add = (id, what, detail, verdict) => rows.push({ id, what, ...detail, verdict });

// ---- 1. crawl, in motion, bound on the worst stop --------------------------------------------
const crawl = stops.map((s) => ({
  stop: s,
  base: num(B[s].crawl_pan), after: num(A[s].crawl_pan),
  base_static: num(B[s].crawl_static), after_static: num(A[s].crawl_static),
  drop: (num(B[s].crawl_pan) && num(A[s].crawl_pan) !== null) ? 1 - A[s].crawl_pan / B[s].crawl_pan : null,
}));
const worstDrop = crawl.length ? Math.min(...crawl.map((c) => (c.drop === null ? -Infinity : c.drop))) : null;
add('EDGE-MOTION', 'crawl under a sub-pixel pan drops >= 60% against the pre-A compositor, on the WORST stop', {
  worst_stop: crawl.length ? crawl.reduce((a, b) => ((a.drop ?? -1) <= (b.drop ?? -1) ? a : b)).stop : null,
  worst_drop: worstDrop, mean_drop: mean(crawl.map((c) => c.drop).filter(Number.isFinite)),
  per_stop: crawl,
}, worstDrop !== null && worstDrop >= 0.60 ? 'GREEN' : 'RED');

// The null control that matters: both AA paths off must come BACK to the baseline figure. If it
// does not, the improvement was not the antialiasing and this whole row is measuring something
// else — which is exactly the failure the doctrine is about.
const nullBack = stops.filter((s) => NOAA[s]).map((s) => ({
  stop: s, base: num(B[s].crawl_pan), noaa: num(NOAA[s].crawl_pan),
  ratio: num(B[s].crawl_pan) ? NOAA[s].crawl_pan / B[s].crawl_pan : null,
}));
const worstNull = nullBack.length ? Math.max(...nullBack.map((n) => Math.abs((n.ratio ?? 0) - 1))) : null;
add('EDGE-MOTION-NULL', 'with MSAA and FXAA both off, crawl returns to within 10% of the baseline', {
  worst_deviation: worstNull, per_stop: nullBack,
}, worstNull !== null && worstNull <= 0.10 ? 'GREEN' : 'RED');

// Which of the two AA paths is carrying it. Not a gate — a finding, and the thing that decides
// whether the FXAA pass earns its cost or should be dropped from the ladder.
add('EDGE-MOTION-ATTRIBUTION', 'how much of the crawl reduction is MSAA and how much is the post pass', {
  msaa_only_removed: mean(stops.filter((s) => NOFXAA[s]).map((s) => (B[s].crawl_pan ? 1 - NOFXAA[s].crawl_pan / B[s].crawl_pan : null)).filter(Number.isFinite)),
  fxaa_only_removed: mean(stops.filter((s) => NOMSAA[s]).map((s) => (B[s].crawl_pan ? 1 - NOMSAA[s].crawl_pan / B[s].crawl_pan : null)).filter(Number.isFinite)),
}, 'INFO');

// ---- 2. edge width, still ---------------------------------------------------------------------
const widths = stops.map((s) => ({ stop: s, base: num(B[s].edge_width_px), after: num(A[s].edge_width_px), noaa: NOAA[s] ? num(NOAA[s].edge_width_px) : null }));
const worstWidth = widths.length ? Math.min(...widths.map((w) => w.after ?? Infinity)) : null;
add('EDGE-STILL', 'silhouette 10-90 transition width >= 1.8 px on the WORST stop', {
  worst: worstWidth, mean_after: mean(widths.map((w) => w.after).filter(Number.isFinite)),
  mean_baseline: mean(widths.map((w) => w.base).filter(Number.isFinite)), per_stop: widths,
}, worstWidth !== null && worstWidth >= 1.8 ? 'GREEN' : 'RED');
const nullWidth = widths.map((w) => w.noaa).filter(Number.isFinite);
add('EDGE-STILL-NULL', 'with both AA paths off the width falls back to <= 1.2 px', {
  worst_null: nullWidth.length ? Math.max(...nullWidth) : null, per_stop: widths,
}, nullWidth.length && Math.max(...nullWidth) <= 1.2 ? 'GREEN' : 'RED');

// ---- 3. banding --------------------------------------------------------------------------------
const band = stops.map((s) => ({ stop: s, base: B[s].band_longest_px, after: A[s].band_longest_px, nodither: NODITHER[s] ? NODITHER[s].band_longest_px : null }));
const worstBand = band.length ? Math.max(...band.map((b) => b.after ?? Infinity)) : null;
add('BANDING', 'longest identical-8-bit run down a sky column <= 6 px on the WORST stop', {
  worst: worstBand, baseline_worst: Math.max(...band.map((b) => b.base ?? 0)), per_stop: band,
}, worstBand !== null && worstBand <= 6 ? 'GREEN' : 'RED');
const nd = band.map((b) => b.nodither).filter(Number.isFinite);
add('BANDING-NULL', 'with dither off the banding comes back (> 20 px somewhere)', {
  worst_null: nd.length ? Math.max(...nd) : null, per_stop: band,
}, nd.length && Math.max(...nd) > 20 ? 'GREEN' : 'RED');

// ---- 4. the grade separates places ---------------------------------------------------------------
// Separation between two frames = distance in (circular hue weighted by chroma, saturation,
// value). Region pairs are compared only at the SAME time and weather, which is what the plan asks
// and also the only comparison that means anything: two regions at different hours differ because
// of the hour.
function sep(a, b) {
  const dh = Math.abs(((a.hue_deg - b.hue_deg + 540) % 360) - 180) / 180;   // 0..1
  const w = Math.min(a.chroma, b.chroma) * 4;                                // hue is meaningless in a grey frame
  return Math.hypot(dh * Math.min(1, w), (a.saturation - b.saturation) * 3, (a.value - b.value) * 3);
}
function pairs(variant) {
  const g = (P.grade_rows || []).filter((r) => r.variant === variant);
  const keyed = new Map();
  for (const r of g) {
    const k = `${r.time}|${r.weather}`;
    if (!keyed.has(k)) keyed.set(k, []);
    keyed.get(k).push(r);
  }
  const out = [];
  for (const [k, list] of keyed) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (list[i].region === list[j].region) continue;
      out.push({ cell: k, a: list[i].region, b: list[j].region, d: sep(list[i], list[j]) });
    }
  }
  return out;
}
const realPairs = pairs('after'), nullPairs = pairs('after-flatgrade');
const floor = nullPairs.length ? pct(nullPairs.map((p) => p.d), 0.90) : null;
const cleared = floor !== null ? realPairs.filter((p) => p.d > floor).length / (realPairs.length || 1) : null;
add('GRADE-SEPARATES', 'at the same hour and weather, >= 90% of region pairs separate above the flat-grade noise floor', {
  pairs_real: realPairs.length, pairs_null: nullPairs.length,
  null_p90_floor: floor,
  median_real: realPairs.length ? pct(realPairs.map((p) => p.d), 0.5) : null,
  median_null: nullPairs.length ? pct(nullPairs.map((p) => p.d), 0.5) : null,
  fraction_cleared: cleared,
  worst_pairs: [...realPairs].sort((x, y) => x.d - y.d).slice(0, 6),
}, cleared !== null && cleared >= 0.90 ? 'GREEN' : 'RED');
add('GRADE-NULL', 'the null control is a REAL grade applied everywhere, and it collapses separation', {
  median_real: realPairs.length ? pct(realPairs.map((p) => p.d), 0.5) : null,
  median_null: nullPairs.length ? pct(nullPairs.map((p) => p.d), 0.5) : null,
  ratio: (realPairs.length && nullPairs.length && pct(nullPairs.map((p) => p.d), 0.5))
    ? pct(realPairs.map((p) => p.d), 0.5) / pct(nullPairs.map((p) => p.d), 0.5) : null,
}, (realPairs.length && nullPairs.length && pct(realPairs.map((p) => p.d), 0.5) >= 2 * pct(nullPairs.map((p) => p.d), 0.5)) ? 'GREEN' : 'RED');

// ---- 5. every switch moves pixels ------------------------------------------------------------
// A pass whose off-switch does not change pixels is a hard fail in the plan. Frame hashes, not
// opinions: if `after` and `after-nodither` hash the same, the dither is not running.
const sabotage = [];
for (const v of ['after-nomsaa', 'after-nofxaa', 'after-noaa', 'after-nodither', 'after-flatgrade', 'baseline']) {
  const m = by(v);
  const changed = stops.filter((s) => m[s] && m[s].still_hash !== A[s].still_hash).length;
  sabotage.push({ variant: v, stops_changed: changed, of: stops.length });
}
add('SABOTAGE-MATRIX', 'every off-switch changes the frame on every stop', { per_variant: sabotage },
  sabotage.every((s) => s.stops_changed === s.of) ? 'GREEN' : 'RED');

// ---- 6. MSAA is actually in force ---------------------------------------------------------------
const q = P.quality_reports || {};
add('MSAA-IN-FORCE', 'the shipping tier really allocated a multisampled target on this device', {
  after: q.after || null, nomsaa: q['after-nomsaa'] || null,
}, (q.after && q.after.msaaInForce > 0 && q['after-nomsaa'] && q['after-nomsaa'].msaaInForce === 0) ? 'GREEN' : 'RED');

const verdict = {
  schema: 'elder-souls/w1-30a-verdict@1',
  source: path.relative(process.cwd(), IN),
  renderer_string: P.renderer_string, software_renderer: P.software_renderer,
  evidence_class: P.evidence_class,
  stops: stops.length,
  result: rows.some((r) => r.verdict === 'RED') ? 'RED' : 'GREEN-SO-FAR',
  reminder: 'GREEN here is permission to look at the contact sheets, never a substitute for it. Statistics can fail a build and can never pass one.',
  rows,
};
console.log(JSON.stringify(verdict, null, 2));
if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(verdict, null, 2) + '\n');
process.exit(rows.some((r) => r.verdict === 'RED') ? 1 : 0);
