#!/usr/bin/env node
/**
 * critic-visual-dispersion.mjs — W1-01 CRITIC instrument (not a builder tool).
 *
 * RI-WLD04 M17's blind test is a human instrument and our pack is unshuffled, so its 39/39 is
 * not usable. This is the machine analogue, and it is run identically over BOTH populations:
 *
 *   ours       reports/region-shots/frame-*.png            (13 regions x 3 frames)
 *   reference  corpus/70-visual/refs/morrowind/REF-A21-regions/<region>__*.jpg   (9 regions)
 *
 * For each image: a 4x4 spatial grid of mean CIELAB, i.e. a 48-D descriptor that carries palette
 * AND its vertical arrangement (sky vs ground vs canopy), which is what a judge actually reads.
 * Then per population:
 *   - leave-one-out nearest-region-centroid accuracy (the objective analogue of M17)
 *   - Fisher separation = mean inter-centroid distance / mean intra-region scatter
 * A7 asks whether our regions are AT LEAST AS visually dispersed as Morrowind's own. Both
 * numbers are reported for both populations so that question has an answer instead of an opinion.
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/critic-visual-dispersion.json';
const GW = 4, GH = 4, W = 64, H = 36;

function descriptor(file) {
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const acc = Array.from({ length: GW * GH }, () => [0, 0, 0, 0]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = lin(raw[i] / 255), g = lin(raw[i + 1] / 255), b = lin(raw[i + 2] / 255);
      const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
      const L = 116 * f(Y) - 16, A = 500 * (f(X) - f(Y)), B = 200 * (f(Y) - f(Z));
      const cell = Math.min(GH - 1, Math.floor(y / H * GH)) * GW + Math.min(GW - 1, Math.floor(x / W * GW));
      acc[cell][0] += L; acc[cell][1] += A; acc[cell][2] += B; acc[cell][3]++;
    }
  }
  return acc.flatMap((c) => [c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
}
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function analyse(label, items) {
  const byRegion = new Map();
  for (const it of items) {
    if (!byRegion.has(it.region)) byRegion.set(it.region, []);
    byRegion.get(it.region).push(it.d);
  }
  const regions = [...byRegion.keys()].sort();
  const centroid = (ds) => ds[0].map((_, i) => ds.reduce((s, d) => s + d[i], 0) / ds.length);
  const cents = new Map(regions.map((r) => [r, centroid(byRegion.get(r))]));
  // Fisher-style separation
  let inter = 0, np = 0;
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) { inter += dist(cents.get(regions[i]), cents.get(regions[j])); np++; }
  inter /= np;
  let intra = 0, ni = 0;
  for (const r of regions) for (const d of byRegion.get(r)) { intra += dist(d, cents.get(r)); ni++; }
  intra /= ni;
  // leave-one-out nearest centroid
  let correct = 0; const confusions = [];
  for (const it of items) {
    const c2 = new Map(regions.map((r) => {
      const ds = byRegion.get(r).filter((d) => d !== it.d);
      return [r, ds.length ? centroid(ds) : null];
    }));
    let best = null, bd = Infinity;
    for (const r of regions) { const c = c2.get(r); if (!c) continue; const dd = dist(it.d, c); if (dd < bd) { bd = dd; best = r; } }
    if (best === it.region) correct++; else confusions.push({ file: it.file, truth: it.region, predicted: best });
  }
  // closest region pairs
  const pairs = [];
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) pairs.push({ a: regions[i], b: regions[j], d: +dist(cents.get(regions[i]), cents.get(regions[j])).toFixed(1) });
  pairs.sort((p, q) => p.d - q.d);
  return {
    label, regions: regions.length, images: items.length,
    loo_accuracy: +(correct / items.length).toFixed(4), loo_correct: correct,
    chance: +(1 / regions.length).toFixed(4),
    mean_inter_centroid: +inter.toFixed(2), mean_intra_scatter: +intra.toFixed(2),
    fisher_separation: +(inter / intra).toFixed(3),
    closest_pairs: pairs.slice(0, 6), confusions,
  };
}

const doc = { schema: 'critic/visual-dispersion@1', measured_at: new Date().toISOString(), grid: `${GW}x${GH}`, populations: {} };

// ours
{
  const dir = 'reports/region-shots';
  const answers = JSON.parse(execFileSync('cat', [join(dir, 'ANSWERS.json')]).toString());
  const items = answers.shots.map((s) => ({ file: join(dir, s.frame), region: s.region, pass: s.pass || 'day', d: descriptor(join(dir, s.frame)) }));
  doc.populations.ours = analyse(`ours (${new Set(items.map((i) => i.region)).size} regions x ${items.length / new Set(items.map((i) => i.region)).size})`, items);
  // RI-WLD04 M17 step 6 requires the sample repeated at night and in each region's worst weather,
  // with night accuracy >= 70% required — "a region that is only identifiable in clear daylight is
  // half-built". A pooled number hides which pass is carrying it, so each pass is analysed alone.
  for (const p of [...new Set(items.map((i) => i.pass))]) {
    const sub = items.filter((i) => i.pass === p);
    if (sub.length >= 13) doc.populations[`ours_${p}`] = analyse(`ours ${p}`, sub);
  }
}
// morrowind
{
  const dir = 'corpus/70-visual/refs/morrowind/REF-A21-regions';
  if (existsSync(dir)) {
    const items = readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|avif|webp)$/i.test(f))
      .map((f) => ({ file: join(dir, f), region: basename(f).split('__')[0], d: descriptor(join(dir, f)) }));
    doc.populations.morrowind = analyse('morrowind REF-A21-regions', items);
  }
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n');
for (const k of Object.keys(doc.populations)) {
  const p = doc.populations[k];
  process.stdout.write(`${k.padEnd(11)} regions ${p.regions}  images ${p.images}  LOO-acc ${(p.loo_accuracy * 100).toFixed(1)}% (chance ${(p.chance * 100).toFixed(1)}%)  inter ${p.mean_inter_centroid}  intra ${p.mean_intra_scatter}  Fisher ${p.fisher_separation}\n`);
  process.stdout.write(`            closest: ${p.closest_pairs.slice(0, 3).map((q) => `${q.a}/${q.b}=${q.d}`).join('  ')}\n`);
}
process.stdout.write(`\n${outFile}\n`);
