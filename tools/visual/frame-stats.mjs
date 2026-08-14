#!/usr/bin/env node
/**
 * frame-stats.mjs — decide, mechanically, whether a captured frame is USABLE.
 *
 * Written because of a specific failure in this tool's own first run. The Deck captured
 * `street-lilmoth`, wrote a valid PNG, hashed it, and recorded `status: ok`. The frame is
 * the camera buried inside a wooden plank: 80% of it is one flat brown. The manifest said
 * green; the picture was worthless. "A check that asserts a canvas exists rather than that
 * pixels are visible" is the named failure mode of this project, and the Deck had it.
 *
 * Three numbers per frame, all cheap, none of them a quality judgement:
 *
 *   dominant_frac  fraction of pixels in the single most common 5-bit RGB bucket.
 *                  High = the frame is mostly one flat colour. A camera inside geometry,
 *                  a frame that is all sky, or a black screen.
 *   edge_density   fraction of pixels whose right/down neighbour differs by > 12/255.
 *                  Low = nothing is resolvable. Fog that has erased the world, or a flat
 *                  untextured plane, both land here.
 *   luma_p05/p95   the tonal span actually used. A narrow span through a bright midpoint
 *                  is the signature of heavy fog; a narrow span at the bottom is a dark
 *                  frame nobody can judge.
 *
 * These do NOT say a frame is good. They say a frame is worth showing a human. That is a
 * different and much more defensible claim, and it is the one the Deck needs.
 *
 * Usage:
 *   node tools/visual/frame-stats.mjs --run reports/visual-truth/deck/<tag>
 *   node tools/visual/frame-stats.mjs --in <dir>            (bare directory of PNGs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

// Thresholds. Deliberately loose: this is a screen for "unusable", not a quality bar, and a
// false RED costs a re-look while a false GREEN costs a wrong verdict.
const T = {
  dominant_buried: 0.45,   // ~half the frame is literally one colour bucket
  edge_dead: 0.020,        // essentially nothing resolvable in the frame
  span_flat: 42,           // p95-p05 luma; below this the frame carries almost no contrast
};

export function frameStats(buf) {
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const buckets = new Map();
  const hist = new Uint32Array(256);
  let edges = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      buckets.set(key, (buckets.get(key) || 0) + 1);
      const l = (r * 299 + g * 587 + b * 114) / 1000 | 0;
      hist[l]++;
      n++;
      if (x + 1 < w) {
        const j = i + 4;
        if (Math.abs(data[j] - r) + Math.abs(data[j + 1] - g) + Math.abs(data[j + 2] - b) > 36) { edges++; continue; }
      }
      if (y + 1 < h) {
        const j = i + w * 4;
        if (Math.abs(data[j] - r) + Math.abs(data[j + 1] - g) + Math.abs(data[j + 2] - b) > 36) edges++;
      }
    }
  }
  let top = 0;
  for (const v of buckets.values()) if (v > top) top = v;
  const pct = (p) => { let acc = 0; const want = n * p; for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc >= want) return l; } return 255; };
  const p05 = pct(0.05), p95 = pct(0.95);
  const s = {
    width: w, height: h,
    dominant_frac: +(top / n).toFixed(4),
    unique_buckets: buckets.size,
    edge_density: +(edges / n).toFixed(4),
    luma_p05: p05, luma_p95: p95, luma_span: p95 - p05,
  };
  s.flags = [];
  if (s.dominant_frac >= T.dominant_buried) s.flags.push('occluded');
  if (s.edge_density < T.edge_dead) s.flags.push('no-detail');
  if (s.luma_span < T.span_flat) s.flags.push('flat-tone');
  s.usable = s.flags.length === 0;
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const RUN = args.run ? path.resolve(args.run) : null;
  const IN = RUN ? path.join(RUN, 'frames') : path.resolve(args.in || '.');
  const files = fs.readdirSync(IN).filter((f) => f.endsWith('.png')).sort();
  const out = [];
  for (const f of files) {
    const s = frameStats(fs.readFileSync(path.join(IN, f)));
    out.push({ file: f, ...s });
  }
  out.sort((a, b) => b.dominant_frac - a.dominant_frac);
  const bad = out.filter((r) => !r.usable);
  console.log(`${out.length} frames, ${bad.length} flagged unusable\n`);
  console.log('dom%   edge%  span  flags                 file');
  for (const r of out) {
    console.log(`${(r.dominant_frac * 100).toFixed(1).padStart(5)}  ${(r.edge_density * 100).toFixed(2).padStart(5)}  ${String(r.luma_span).padStart(4)}  ${(r.flags.join(',') || '-').padEnd(20)}  ${r.file}`);
  }
  if (RUN) {
    // Fold the verdict back into the run manifest so the Deck's own row status is corrected
    // rather than sitting in a second file nobody reads.
    const mp = path.join(RUN, 'manifest.json');
    if (fs.existsSync(mp)) {
      const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
      const by = new Map(out.map((r) => [r.file, r]));
      for (const row of m.rows) {
        if (row.status !== 'ok' || !row.file) continue;
        const s = by.get(row.file);
        if (!s) continue;
        row.stats = { dominant_frac: s.dominant_frac, edge_density: s.edge_density, luma_span: s.luma_span };
        if (!s.usable) { row.status = 'amber'; row.reason = `frame flagged ${s.flags.join(',')} — captured but not worth a human's time`; }
      }
      m.counts.amber = m.rows.filter((r) => r.status === 'amber').length;
      m.counts.ok = m.rows.filter((r) => r.status === 'ok').length;
      m.frame_stats_thresholds = T;
      fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
      console.log(`\nmanifest updated: ${m.counts.ok} ok, ${m.counts.amber} amber, ${m.rows.filter((r) => r.status === 'red').length} red`);
    }
  }
}
