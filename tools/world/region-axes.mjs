#!/usr/bin/env node
/**
 * region-axes.mjs — RI-WLD04 M18, the differentiation matrix.
 *
 * "For all 78 region pairs, compute the 9 axes from world data: mean ground albedo (dE > 12 to
 * count as different), slope histogram (chi2 test), flora species Jaccard (< 0.4), fauna Jaccard
 * (< 0.4), architecture mesh Jaccard (< 0.3), audio bed asset set (any difference), weather state
 * set (any difference), fog extinction coefficient (> 25% relative), hazard type (any difference).
 * Pass: every pair differs on >= 6 axes. Fail: any pair differs on <= 3."
 *
 * Eight axes come from `game/data/world/regions.json`. The ninth — the slope histogram — is
 * measured on the BUILT terrain, not declared, by sampling every land cell of every region: that
 * is the axis a builder cannot fake by editing a table.
 *
 * Usage: node tools/world/region-axes.mjs [--json] [--out reports/region-axes.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/region-axes.json';

const regionsDoc = rd('game/data/world/regions.json');
const hazards = rd('game/data/world/hazards.json');
const field = new WorldField(rd('game/data/world/terrain.json'), regionsDoc, rd('game/data/world/water.json'));
const R = regionsDoc.regions;
const N = R.length;

// ---- axis 2: the slope histogram, measured on the built ground -------------------------------
const EDGES = [0, 2, 4, 7, 11, 16, 22, 30, 40, 90];
const hist = R.map(() => new Float64Array(EDGES.length - 1));
const counts = new Float64Array(N);
const albedoMeasured = R.map(() => [0, 0, 0]);
for (let cz = 0; cz < field.rows; cz++) {
  for (let cx = 0; cx < field.cols; cx++) {
    const x = cx * field.cell + field.cell / 2, z = cz * field.cell + field.cell / 2;
    if (!field.isLandAt(x, z)) continue;
    const ri = field.regionIndexAt(x, z);
    const s = field.slopeAt(x, z, 8);
    for (let i = 0; i < EDGES.length - 1; i++) if (s >= EDGES[i] && s < EDGES[i + 1]) { hist[ri][i]++; break; }
    counts[ri]++;
  }
}
for (let r = 0; r < N; r++) for (let i = 0; i < hist[r].length; i++) hist[r][i] /= Math.max(1, counts[r]);

// ---- helpers ----------------------------------------------------------------------------------
const jac = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const v of A) if (B.has(v)) inter++;
  return inter / (A.size + B.size - inter);
};
const setsDiffer = (a, b) => JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort());
function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  r = lin(r); g = lin(g); b = lin(b);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const chi2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i], m = a[i] + b[i]; if (m > 0) s += d * d / m; } return s / 2; };

const lab = R.map((r) => hexToLab(r.ground.albedo));
const hazardSets = R.map((r) => hazards.hazards.filter((h) => h.regions.some((n) => n.toLowerCase().replace(/[^a-z]/g, '') === r.name.toLowerCase().replace(/[^a-z]/g, ''))).map((h) => h.id));

// ---- the 78 pairs ------------------------------------------------------------------------------
const AXES = ['ground_albedo', 'slope_histogram', 'flora', 'fauna', 'architecture', 'audio', 'weather', 'fog_extinction', 'hazard'];
const pairs = [];
let worst = 9, worstPair = null;
const axisWins = Object.fromEntries(AXES.map((a) => [a, 0]));
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const a = R[i], b = R[j];
    const d = {
      ground_albedo: dE(lab[i], lab[j]) > 12,
      slope_histogram: chi2(hist[i], hist[j]) > 0.10,
      flora: jac(a.flora, b.flora) < 0.4,
      fauna: jac(a.fauna, b.fauna) < 0.4,
      architecture: jac(a.architecture, b.architecture) < 0.3,
      audio: setsDiffer(a.audio, b.audio),
      weather: setsDiffer(a.weather, b.weather),
      fog_extinction: Math.abs(a.fog.extinction_per_m - b.fog.extinction_per_m) / Math.min(a.fog.extinction_per_m, b.fog.extinction_per_m) > 0.25,
      hazard: setsDiffer(hazardSets[i], hazardSets[j]),
    };
    const n = AXES.filter((k) => d[k]).length;
    for (const k of AXES) if (d[k]) axisWins[k]++;
    if (n < worst) { worst = n; worstPair = `${a.id} / ${b.id}`; }
    pairs.push({ a: a.id, b: b.id, axes_differing: n, detail: d, dE: +dE(lab[i], lab[j]).toFixed(1), chi2: +chi2(hist[i], hist[j]).toFixed(3) });
  }
}
pairs.sort((p, q) => p.axes_differing - q.axes_differing);

const doc = {
  schema: 'elder-souls/region-axes@1', method: 'RI-WLD04 M18',
  axes: AXES,
  thresholds: { ground_albedo_dE: 12, slope_chi2: 0.10, flora_jaccard: 0.4, fauna_jaccard: 0.4, architecture_jaccard: 0.3, fog_relative: 0.25 },
  pairs_total: pairs.length,
  min_axes_differing: worst, min_pair: worstPair,
  pairs_below_6: pairs.filter((p) => p.axes_differing < 6).length,
  pairs_at_or_below_3: pairs.filter((p) => p.axes_differing <= 3).length,
  axis_wins: axisWins,
  region_slope_mean_deg: R.map((r, i) => ({ id: r.id, cells: counts[i], mean_deg: +(EDGES.slice(0, -1).reduce((s, e, k) => s + hist[i][k] * (e + EDGES[k + 1]) / 2, 0)).toFixed(2) })),
  pass: worst >= 6,
  pairs,
};
mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');

process.stdout.write(`RI-WLD04 M18 — region differentiation matrix\n`);
process.stdout.write(`  ${pairs.length} pairs; minimum axes differing = ${worst} (${worstPair}); bar >= 6, hard fail <= 3\n`);
process.stdout.write(`  pairs below 6 axes: ${doc.pairs_below_6}    pairs at or below 3: ${doc.pairs_at_or_below_3}\n`);
process.stdout.write(`  axis contribution (of ${pairs.length} pairs): ${AXES.map((a) => `${a} ${axisWins[a]}`).join(', ')}\n`);
process.stdout.write(`  ${doc.pass ? 'PASS' : 'FAIL'} -> ${outFile}\n`);
if (!doc.pass) { for (const p of pairs.slice(0, 6)) process.stdout.write(`    ${p.a} / ${p.b}: ${p.axes_differing} — ${AXES.filter((k) => !p.detail[k]).join(', ')} do not differ\n`); }
process.exit(doc.pass ? 0 : 1);
