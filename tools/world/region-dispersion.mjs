#!/usr/bin/env node
/**
 * region-dispersion.mjs — RI-WLD04's machine analogue, reported on BOTH descriptors and all three
 * lighting passes, against Morrowind on the matched design.
 *
 * This is the round-2 critic's own instrument set, in one tool, so the numbers this piece reports
 * about itself are computed by the same code that computes Morrowind's:
 *
 *   raw        4x4 mean CIELAB — what `critic-visual-dispersion.mjs` uses, and what a colour grade
 *              satisfies. RI-WLD04's own "How we lose" list calls that out: "Palette without
 *              material. Getting the hex values right and applying them as a colour grade over the
 *              same ground texture."
 *   structure  6x4 Sobel edge density + 6x4 luminance layout, each z-scored PER IMAGE, so colour,
 *              absolute exposure and global contrast are gone and only silhouette, prop density
 *              and composition survive. Verbatim from `critic-w1-01-r2-structure.mjs`.
 *
 * Reported per pass (day / night / worst) and on the matched design the round-2 critic built to
 * settle the Fisher question: 9 regions x 3 images, N random draws, both populations, identical
 * chance. Pooling three lighting conditions on our side and none on Morrowind's is what produced
 * the spurious 1.005, and that mistake is not repeated here — pooled is reported and labelled as
 * the artifact it is.
 *
 * `orchestration/amendments/AM-W1-01-01` proposes that A7's pass condition be stated on
 * `structure`. This tool reports both either way.
 *
 * Usage: node tools/world/region-dispersion.mjs [--shots reports/region-shots] [--draws 200]
 */
import { readdirSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const argv = process.argv.slice(2);
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : 'reports/region-shots';
const DRAWS = argv.includes('--draws') ? Number(argv[argv.indexOf('--draws') + 1]) : 200;
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/region-dispersion.json';
const MWDIR = 'corpus/70-visual/refs/morrowind/REF-A21-regions';

// ---- descriptors --------------------------------------------------------------------------------
function raw(file) {
  const W = 64, H = 36, GW = 4, GH = 4;
  const px = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const fn = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const acc = Array.from({ length: GW * GH }, () => [0, 0, 0, 0]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = lin(px[i] / 255), g = lin(px[i + 1] / 255), b = lin(px[i + 2] / 255);
      const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
      const cell = Math.min(GH - 1, Math.floor(y / H * GH)) * GW + Math.min(GW - 1, Math.floor(x / W * GW));
      acc[cell][0] += 116 * fn(Y) - 16; acc[cell][1] += 500 * (fn(X) - fn(Y)); acc[cell][2] += 200 * (fn(Y) - fn(Z)); acc[cell][3]++;
    }
  }
  return acc.flatMap((c) => [c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
}

function structure(file) {
  const W = 160, H = 90, GW = 6, GH = 4;
  const g = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
  const at = (x, y) => g[y * W + x];
  const acc = Array.from({ length: GW * GH }, () => [0, 0, 0]);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const c = Math.min(GH - 1, Math.floor(y / H * GH)) * GW + Math.min(GW - 1, Math.floor(x / W * GW));
      acc[c][0] += Math.hypot(gx, gy); acc[c][1] += at(x, y); acc[c][2]++;
    }
  }
  const e = acc.map((c) => c[0] / c[2]), mu = acc.map((c) => c[1] / c[2]);
  const norm = (v) => { const m = v.reduce((a, b) => a + b) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return v.map((x) => (x - m) / sd * 20); };
  return [...norm(e), ...norm(mu)];
}

const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function analyse(items) {
  const by = new Map();
  for (const it of items) { if (!by.has(it.region)) by.set(it.region, []); by.get(it.region).push(it.d); }
  const regions = [...by.keys()].sort();
  if (regions.length < 2) return null;
  const cent = (ds) => ds[0].map((_, i) => ds.reduce((s, d) => s + d[i], 0) / ds.length);
  const C = new Map(regions.map((r) => [r, cent(by.get(r))]));
  let inter = 0, np = 0;
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) { inter += dist(C.get(regions[i]), C.get(regions[j])); np++; }
  inter /= np;
  let intra = 0, ni = 0;
  for (const r of regions) for (const d of by.get(r)) { intra += dist(d, C.get(r)); ni++; }
  intra /= ni;
  let ok = 0;
  for (const it of items) {
    const c2 = new Map(regions.map((r) => { const ds = by.get(r).filter((d) => d !== it.d); return [r, ds.length ? cent(ds) : null]; }));
    let best = null, bd = Infinity;
    for (const r of regions) { const c = c2.get(r); if (!c) continue; const dd = dist(it.d, c); if (dd < bd) { bd = dd; best = r; } }
    if (best === it.region) ok++;
  }
  return { regions: regions.length, images: items.length, loo: +(ok / items.length).toFixed(4),
    chance: +(1 / regions.length).toFixed(4), fisher: +(inter / intra).toFixed(3),
    inter: +inter.toFixed(2), intra: +intra.toFixed(2) };
}

/** 9 regions x 3 images, `DRAWS` random draws, identical chance on both sides. */
function matched(items, seed) {
  let st = seed >>> 0;
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const by = new Map();
  for (const it of items) { if (!by.has(it.region)) by.set(it.region, []); by.get(it.region).push(it); }
  const regions = [...by.keys()].filter((r) => by.get(r).length >= 3);
  if (regions.length < 9) return null;
  const fs = [], ls = [];
  for (let d = 0; d < DRAWS; d++) {
    const pick = regions.slice();
    for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
    const sub = [];
    for (const r of pick.slice(0, 9)) {
      const pool = by.get(r).slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      sub.push(...pool.slice(0, 3));
    }
    const a = analyse(sub);
    fs.push(a.fisher); ls.push(a.loo);
  }
  const mean = (v) => v.reduce((a, b) => a + b) / v.length;
  const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  return { draws: DRAWS, fisher: +mean(fs).toFixed(3), fisher_sd: +sd(fs).toFixed(3),
    loo: +mean(ls).toFixed(4), loo_sd: +sd(ls).toFixed(4), chance: +(1 / 9).toFixed(4) };
}

// ---- the populations -----------------------------------------------------------------------------
const ANS = JSON.parse(readFileSync(join(ROOT, shotsDir, 'ANSWERS.json'), 'utf8'));
const OURS = ANS.shots.map((s) => ({ file: join(ROOT, shotsDir, s.frame), region: s.region, pass: s.pass }));
const MW = readdirSync(join(ROOT, MWDIR)).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
  .map((f) => ({ file: join(ROOT, MWDIR, f), region: f.split('__')[0], pass: 'ref' }));

process.stderr.write(`describing ${OURS.length} ours + ${MW.length} morrowind frames\n`);
for (const it of [...OURS, ...MW]) { it.raw = raw(it.file); it.str = structure(it.file); }

const doc = {
  schema: 'w1-01/region-dispersion@1',
  measured_at: new Date().toISOString(),
  shots_dir: shotsDir,
  descriptors: {
    raw: '4x4 mean CIELAB — the shipped A7 instrument. A colour grade satisfies it.',
    structure: '6x4 Sobel edge density + 6x4 luminance layout, z-scored per image. Colour, absolute exposure and global contrast removed; silhouette, prop density and composition retained.',
  },
  note: 'Both descriptors, all three passes, ours and Morrowind, one code path. See '
      + 'orchestration/amendments/AM-W1-01-01 for the proposal that A7 state its pass condition on `structure`.',
  full: {}, matched: {},
};
const passes = ['day', 'night', 'worst'];
for (const desc of ['raw', 'str']) {
  const key = desc === 'raw' ? 'raw' : 'structure';
  doc.full[key] = {};
  doc.matched[key] = {};
  for (const p of passes) {
    const items = OURS.filter((s) => s.pass === p).map((s) => ({ region: s.region, d: s[desc] }));
    if (!items.length) continue;
    doc.full[key][`ours_${p}`] = analyse(items);
    doc.matched[key][`ours_${p}`] = matched(items, 0xC0FFEE + p.length);
  }
  const pooled = OURS.map((s) => ({ region: s.region, d: s[desc] }));
  doc.full[key].ours_pooled = analyse(pooled);
  doc.full[key].ours_pooled_note = 'Pooling three lighting conditions doubles intra-region scatter and is the artifact that produced the spurious Fisher 1.005 in round 2. Reported, not used.';
  const mw = MW.map((s) => ({ region: s.region, d: s[desc] }));
  doc.full[key].morrowind = analyse(mw);
  doc.matched[key].morrowind = matched(mw, 0xBEEF);
}

mkdirSync(join(ROOT, dirname(outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');

const row = (label, a) => a ? `  ${label.padEnd(22)} LOO ${(a.loo * 100).toFixed(1)}%  Fisher ${String(a.fisher).padStart(6)}  (chance ${(a.chance * 100).toFixed(1)}%, n=${a.images}, ${a.regions} regions)\n` : `  ${label.padEnd(22)} —\n`;
const mrow = (label, a) => a ? `  ${label.padEnd(22)} LOO ${(a.loo * 100).toFixed(1)}% +/- ${(a.loo_sd * 100).toFixed(1)}  Fisher ${a.fisher} +/- ${a.fisher_sd}  (chance ${(a.chance * 100).toFixed(1)}%)\n` : `  ${label.padEnd(22)} — (fewer than 9 regions with 3 images)\n`;
for (const key of ['raw', 'structure']) {
  process.stdout.write(`\n=== ${key.toUpperCase()} — full populations ===\n`);
  for (const k of Object.keys(doc.full[key])) if (typeof doc.full[key][k] === 'object') process.stdout.write(row(k, doc.full[key][k]));
  process.stdout.write(`--- ${key} — matched design (9 regions x 3 images, ${DRAWS} draws) ---\n`);
  for (const k of Object.keys(doc.matched[key])) process.stdout.write(mrow(k, doc.matched[key][k]));
}
process.stdout.write(`\n  ${outFile}\n`);
