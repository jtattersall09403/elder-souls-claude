#!/usr/bin/env node
// RI-WLD12 M65 — the staggered-crossover traverse. W1-02.
//
// The item's core check and its heaviest (weight 30): for each border, walk the perpendicular for
// 400 m sampling every 2 m, find `c[a]` — the position at which each of the nine RI-WLD04 axes is
// more far-region than near over a 20 m window — and report the spread.
//
//     BAR:  stddev(c) >= 25 m   (GRADED and MARKED)
//           stddev(c) >=  8 m   (HARD)
//           max(c) - min(c) >= 60 m   (GRADED and MARKED)
//           no two axes within 3 m of each other more than twice per border
//     AUTOMATIC FAIL: stddev(c) < 5 m on any border — "that is a texture swap".
//
// It walks the SHIPPED `world/borders.js` module against the SHIPPED rasters — the same code the
// engine runs — rather than reading `borders.json`'s declared offsets, because RI-MTH07's whole
// point is that a table copied out of the file it was built from measures the file. Both numbers
// are reported so a divergence is visible.
//
// It runs in bare node. No browser, no engine: `BorderField.traverse` needs a signed distance
// field and a raster region lookup, and both are in the data.
'use strict';

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { BorderField, BORDER_AXES } from '../../game/src/world/borders.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const bordersDoc = R('game/data/world/borders.json');
const regionsDoc = R('game/data/world/regions.json');
const terrain = R('game/data/world/terrain.json');

const COLS = terrain.cols, ROWS = terrain.rows, CELL = terrain.cell_m;
const rb = Buffer.from(terrain.channels.region, 'base64');
const regionU = new Uint8Array(rb.buffer, rb.byteOffset, rb.byteLength);
const regionIndexAt = (x, z) => {
  const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
  const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(z / CELL)));
  return regionU[cy * COLS + cx];
};

const bf = new BorderField(bordersDoc, regionsDoc.regions);
const only = (process.argv.find((a) => a.startsWith('--border=')) || '').split('=')[1] || null;
const outPath = (process.argv.find((a) => a.startsWith('--out=')) || '').split('=')[1] || 'reports/border-crossover.json';

const rows = [];
for (const b of bf.borders) {
  if (only && b.id !== only) continue;
  const t = bf.traverse(b.id, regionIndexAt, 400, 2);
  const bar = b.kind === 'HARD' ? 8 : 25;
  const spanBar = b.kind === 'HARD' ? 0 : 60;
  rows.push({
    ...t,
    stddev_bar_m: bar,
    span_bar_m: spanBar,
    pass_stddev: t.axes_resolved >= 2 && t.stddev_m >= bar,
    pass_span: t.axes_resolved >= 2 && t.span_m >= spanBar,
    pass_no_triple_collision: t.pairs_within_3m <= 2,
    automatic_fail_texture_swap: t.axes_resolved >= 2 && t.stddev_m < 5,
    all_nine_resolved: t.axes_resolved === BORDER_AXES.length,
  });
}

// The canonical order is a design, not an accident (RI-WLD12 §2): ground and flora first,
// architecture and only_here last, fauna and audio between. Check the ORDER as well as the spread,
// because a border can stagger correctly and still stagger backwards.
const EARLY = ['palette', 'flora'];
const LATE = ['architecture', 'only_here'];
for (const r of rows) {
  const pos = r.crossovers_m;
  const early = EARLY.filter((a) => pos[a] !== null).map((a) => pos[a]);
  const late = LATE.filter((a) => pos[a] !== null).map((a) => pos[a]);
  r.canonical_order_held = early.length && late.length ? Math.max(...early) < Math.min(...late) : null;
}

const resolved = rows.filter((r) => r.axes_resolved >= 2);
const summary = {
  tool: 'tools/world/border-traverse.mjs',
  item: 'RI-WLD12 M65 — the staggered-crossover traverse',
  measured_on: 'game/src/world/borders.js against game/data/world/{borders,terrain,regions}.json',
  borders: rows.length,
  borders_with_a_measurable_traverse: resolved.length,
  automatic_fails_texture_swap: rows.filter((r) => r.automatic_fail_texture_swap).map((r) => r.border),
  failing_stddev: resolved.filter((r) => !r.pass_stddev).map((r) => `${r.border} ${r.stddev_m}<${r.stddev_bar_m}`),
  failing_span: resolved.filter((r) => !r.pass_span).map((r) => `${r.border} ${r.span_m}<${r.span_bar_m}`),
  failing_collision: rows.filter((r) => !r.pass_no_triple_collision).map((r) => r.border),
  canonical_order_violations: rows.filter((r) => r.canonical_order_held === false).map((r) => r.border),
  stddev_m: {
    min: resolved.length ? Math.min(...resolved.map((r) => r.stddev_m)) : null,
    median: resolved.length ? resolved.map((r) => r.stddev_m).sort((a, b) => a - b)[resolved.length >> 1] : null,
    max: resolved.length ? Math.max(...resolved.map((r) => r.stddev_m)) : null,
  },
  span_m: {
    min: resolved.length ? Math.min(...resolved.map((r) => r.span_m)) : null,
    max: resolved.length ? Math.max(...resolved.map((r) => r.span_m)) : null,
  },
  rows,
};

mkdirSync(resolve(ROOT, dirname(outPath)), { recursive: true });
writeFileSync(resolve(ROOT, outPath), JSON.stringify(summary, null, 1) + '\n');

console.log(`M65 traverse: ${rows.length} borders, ${resolved.length} with a measurable perpendicular`);
console.log(`  stddev(c): min ${summary.stddev_m.min} m  median ${summary.stddev_m.median} m  max ${summary.stddev_m.max} m`);
console.log(`  span(c):   min ${summary.span_m.min} m  max ${summary.span_m.max} m`);
console.log(`  automatic fails (stddev < 5 m, the texture swap): ${summary.automatic_fails_texture_swap.length}`);
for (const r of rows) {
  const flag = r.automatic_fail_texture_swap ? 'SWAP' : (r.pass_stddev && r.pass_span && r.pass_no_triple_collision) ? 'ok  ' : 'FAIL';
  console.log(`  ${flag} ${r.border.padEnd(38)} ${r.kind.padEnd(7)} axes ${r.axes_resolved}/9 sd ${String(r.stddev_m).padStart(6)} span ${String(r.span_m).padStart(6)}  order: ${r.order.join(' > ')}`);
}
console.log(`\nwrote ${outPath}`);
const hardFail = summary.automatic_fails_texture_swap.length || summary.failing_stddev.length || summary.failing_span.length || summary.failing_collision.length;
if (hardFail) { console.error('M65: FAILING BARS ABOVE'); process.exit(1); }
