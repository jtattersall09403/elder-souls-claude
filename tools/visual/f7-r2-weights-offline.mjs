#!/usr/bin/env node
/**
 * f7-r2-weights-offline.mjs — F7 ROUND 2, CLAUSE (a), WITHOUT ANOTHER BROWSER.
 *
 * `f7-r2-sweep.mjs` captures three GREY probe frames per pose in one process: the view distance,
 * the esView the shader itself computes AFTER its ripple normal perturbation, and the round-2
 * composited mix weight — each inverted through a grey ramp measured in the same run. Because the
 * two weight expressions are closed forms in exactly those two variables, the round-1 weight field
 * can be EVALUATED per pixel from the same measured geometry instead of costing another browser
 * run (the one that was attempted, `reports/visual-truth/f7-r2/probes3`, came back with the water
 * drawn as a white sheet and a 9,887-pixel mask against 261,676 in the good run; it is discarded
 * here and reported as discarded rather than quietly dropped).
 *
 * THE EVALUATION IS NOT TAKEN ON TRUST. The same closed form is evaluated for the ROUND-2 weight
 * and compared against the round-2 weight the GPU actually measured, pixel by pixel. If those two
 * disagree, the round-1 row is void and this tool says so instead of printing it.
 *
 *   node tools/visual/f7-r2-weights-offline.mjs --dir reports/visual-truth/f7-r2/probes2
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const DIR = path.resolve(REPO, String(args.dir || 'reports/visual-truth/f7-r2/probes2'));
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const sweep = JSON.parse(fs.readFileSync(path.join(DIR, 'sweep.json'), 'utf8'));
const F = (n) => path.join(DIR, 'frames', `${n}.png`);
const rd = (n) => PNG.sync.read(fs.readFileSync(F(n)));

/* The two expressions, transcribed from game/src/render/water.js and from the r1 verdict's record
 * of what b0f3224e shipped. Both are asserted against the live file below where possible. */
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const W_R2 = (v, d) => Math.max(0.02 + 0.98 * Math.pow(1 - v, 5), smoothstep(10, 52, d) * 0.72 * (1 - v));
const W_R1 = (v, d) => 0.25 + Math.max(Math.pow(1 - v, 2.2), smoothstep(10, 52, d) * 0.72 * (1 - v)) * 0.50;

const src = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');
const asserts = {
  r2_schlick_in_file: src.includes('float esRefl=esF0+(1.0-esF0)*pow(1.0-esView,5.0);'),
  r2_f0_in_file: src.includes('float esF0=.02;'),
  r2_distance_broadening_in_file: src.includes('esRefl=max(esRefl,smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView));'),
  r2_mix_in_file: src.includes('vec3 esSurface=mix(esDepth,esReflection,esRefl*uWaterReflectionStrength);'),
};

function decoderFor(pose) {
  const c = sweep.arms['probe-ramp']?.poses?.[pose]?.probe?.curve;
  if (!c || c.in.length < 32) return null;
  const { in: xs, out: ys } = c;
  return (byte) => {
    if (byte <= ys[0]) return xs[0];
    if (byte >= ys[ys.length - 1]) return xs[xs.length - 1];
    let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ys[mid] <= byte) lo = mid; else hi = mid; }
    const t = (byte - ys[lo]) / Math.max(1e-9, ys[hi] - ys[lo]);
    return xs[lo] + t * (xs[hi] - xs[lo]);
  };
}
function quant(vals) {
  if (!vals.length) return { n: 0, note: 'no pixel in this bin' };
  vals.sort((a, b) => a - b);
  const q = (f) => +vals[Math.min(vals.length - 1, Math.floor(f * vals.length))].toFixed(4);
  return { n: vals.length, mean: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4), p05: q(0.05), median: q(0.5), p95: q(0.95) };
}

const out = { tool: 'f7-r2-weights-offline', generated: new Date().toISOString(), dir: path.relative(REPO, DIR), file_asserts: asserts, poses: {} };
for (const pose of Object.keys(sweep.arms['probe-ramp']?.poses || {})) {
  const dec = decoderFor(pose);
  if (!dec) { out.poses[pose] = { VOID: 'no ramp for this pose' }; continue; }
  let distP, viewP, wP, hid, sur;
  try {
    distP = rd(`probe-dist-${pose}`); viewP = rd(`probe-esview-${pose}`); wP = rd(`probe-w-fixed-${pose}`);
    hid = rd(`water-hidden-${pose}`); sur = rd(`surface-hidden-${pose}`);
  } catch (e) { out.poses[pose] = { VOID: `a probe frame is missing: ${e.message}` }; continue; }
  const N = distP.width * distP.height;
  const rows = [];
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    // a pixel is usable only if it is water table in ALL THREE probe frames and carries no
    // shoreline band, so distance, esView and weight are the same surface at the same pixel.
    const isW = (img) => Math.abs(img.data[p] - hid.data[p]) + Math.abs(img.data[p + 1] - hid.data[p + 1]) + Math.abs(img.data[p + 2] - hid.data[p + 2]) > 6;
    if (!isW(distP) || !isW(viewP) || !isW(wP)) continue;
    const shore = Math.abs(sur.data[p] - hid.data[p]) + Math.abs(sur.data[p + 1] - hid.data[p + 1]) + Math.abs(sur.data[p + 2] - hid.data[p + 2]);
    if (shore > 2) continue;
    rows.push([dec(distP.data[p]) * 200, dec(viewP.data[p]), dec(wP.data[p])]);
  }
  if (rows.length < 1000) { out.poses[pose] = { VOID: `only ${rows.length} usable pixels` }; continue; }
  // VALIDATION: the closed form for ROUND 2 against what the GPU measured for ROUND 2.
  let sum = 0, worst = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [d, v, w] of rows) {
    const pred = W_R2(v, d), e = Math.abs(pred - w);
    sum += e; if (e > worst) worst = e;
    sx += pred; sy += w; sxx += pred * pred; syy += w * w; sxy += pred * w;
  }
  const n = rows.length, mae = sum / n;
  const corr = (n * sxy - sx * sy) / Math.sqrt(Math.max(1e-12, (n * sxx - sx * sx) * (n * syy - sy * sy)));
  const ok = mae <= 0.03 && corr >= 0.95;
  const bins = {
    all_water: (f) => rows.map(f),
    near_normal_esView_gt_0_99: (f) => rows.filter(([, v]) => v > 0.99).map(f),
    near_normal_esView_gt_0_90: (f) => rows.filter(([, v]) => v > 0.90).map(f),
    dist_110_130_m: (f) => rows.filter(([d]) => d >= 110 && d <= 130).map(f),
    dist_55_65_m: (f) => rows.filter(([d]) => d >= 55 && d <= 65).map(f),
    dist_55_65_grazing_esView_lt_0_20: (f) => rows.filter(([d, v]) => d >= 55 && d <= 65 && v < 0.20).map(f),
    grazing_esView_lt_0_20: (f) => rows.filter(([, v]) => v < 0.20).map(f),
  };
  const table = {};
  for (const [k, sel] of Object.entries(bins)) {
    table[k] = {
      round2_measured: quant(sel((r) => r[2])),
      round2_from_closed_form: quant(sel((r) => W_R2(r[1], r[0]))),
      round1_from_closed_form: ok ? quant(sel((r) => W_R1(r[1], r[0]))) : 'VOID — the closed form does not reproduce the measured round-2 weight',
    };
  }
  out.poses[pose] = {
    usable_water_px: n,
    closed_form_validation: {
      mean_abs_error_vs_gpu: +mae.toFixed(4), worst_abs_error: +worst.toFixed(4), pearson_r: +corr.toFixed(4),
      verdict: ok
        ? 'PASS — the JS closed form reproduces the weight the GPU measured, so evaluating ROUND 1 the same way is a measurement of the same geometry and not a guess'
        : 'FAIL — the closed form and the GPU disagree; the round-1 row is withheld',
    },
    bins: table,
  };
}
const OUT = path.join(DIR, 'weights-offline.json');
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 6000));
console.log(`\nwrote ${OUT}`);
