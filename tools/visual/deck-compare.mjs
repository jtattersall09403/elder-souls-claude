#!/usr/bin/env node
/**
 * deck-compare.mjs — put two Deck runs side by side.
 *
 * This is the tool the rest of the visual programme actually needs. Every child is going to
 * change something and claim it helped; this answers "helped compared to what, on which shot"
 * with a hash and a number rather than a memory of a screenshot.
 *
 * Three jobs from one comparison:
 *
 *   DETERMINISM   two runs, same commit, same seed       -> every hash must match.
 *   RED CONTROL   two runs, same commit, DIFFERENT seed  -> >= 95% of hashes must differ.
 *                 A capture harness whose determinism cannot be falsified is not an
 *                 instrument, so the second run is not optional (W1-30V bar, row 1).
 *   BEFORE/AFTER  two runs across a code change -> which shots moved, and by how much.
 *
 * Usage:
 *   node tools/visual/deck-compare.mjs --a <runA> --b <runB> [--expect same|differ|report]
 * Exits non-zero when --expect is not met.
 */
import fs from 'node:fs';
import path from 'node:path';
import { frameStats } from './frame-stats.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
// ---- in-run axis check: the red control that can actually fire -------------------------
// W1-30V's bar asks for "change the seed; >= 95% of hashes must change". Measured, the seed
// changes NOTHING: two smoke runs at seeds 20260814 and 987654 produced 6 of 6 byte-identical
// frames. That is not a broken harness — the province is generated from game/data/**, and a
// posed still of a settled scene has no RNG in it. So the seed is the wrong knob and the bar's
// red control cannot fire on a healthy build, which makes it useless as a control.
//
// The knob that MUST move pixels is the one the Deck itself varies: time of day. If the same
// camera at 13:00 and at 19:30 hashes identically, the capture is not seeing the light and
// every determinism PASS is meaningless. That is a falsification the harness can fail, so it
// is the one worth running.
if (args.run) {
  const dir = path.resolve(String(args.run));
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const axis = String(args.axis || 'time');
  const groups = new Map();
  for (const r of m.rows) {
    if (!r.file || (r.status !== 'ok' && r.status !== 'amber')) continue;
    const key = axis === 'time' ? `${r.setup}|${r.weather}` : `${r.setup}|${r.time}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  let pairs = 0, moved = 0; const stuck = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    for (let i = 1; i < rows.length; i++) {
      pairs++;
      if (rows[i].hash !== rows[0].hash) moved++;
      else stuck.push(`${key}  ${rows[0][axis]} == ${rows[i][axis]}  (${rows[0].hash})`);
    }
  }
  if (!pairs) { console.error(`no ${axis} pairs in this run — the profile only captured one ${axis}, so this control cannot run`); process.exit(2); }
  const frac = moved / pairs;
  console.log(`RED CONTROL (${axis} axis, in-run): ${moved} of ${pairs} pairs changed = ${(frac * 100).toFixed(1)}%`);
  for (const s of stuck.slice(0, 20)) console.log(`  STUCK  ${s}`);
  const ok = frac >= 0.95;
  console.log(`${ok ? 'PASS' : 'FAIL'} — need >= 95%. A stuck pair means the capture is not seeing the ${axis} change at that setup.`);
  process.exit(ok ? 0 : 1);
}

if (!args.a || !args.b) { console.error('usage: --a <run dir> --b <run dir> [--expect same|differ|report]   or   --run <run dir> [--axis time]'); process.exit(2); }
const A = path.resolve(String(args.a)), B = path.resolve(String(args.b));
const EXPECT = String(args.expect || 'report');

const load = (d) => {
  const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
  return { dir: d, m, by: new Map(m.rows.filter((r) => r.file).map((r) => [`${r.setup}|${r.time}|${r.weather}`, r])) };
};
const a = load(A), b = load(B);

console.log(`A  ${path.basename(A)}  profile=${a.m.profile} seed=${a.m.seed} commit=${(a.m.commit || '?').slice(0, 8)} renderer=${a.m.software_renderer ? 'SOFTWARE' : 'hardware'}`);
console.log(`B  ${path.basename(B)}  profile=${b.m.profile} seed=${b.m.seed} commit=${(b.m.commit || '?').slice(0, 8)} renderer=${b.m.software_renderer ? 'SOFTWARE' : 'hardware'}`);
if (a.m.deck_manifest_hash !== b.m.deck_manifest_hash) {
  console.log(`\n!! the two runs used DIFFERENT shot lists (${a.m.deck_manifest_hash} vs ${b.m.deck_manifest_hash}).`);
  console.log('   A before/after across a deck edit compares nothing. Re-run both at one deck version.');
}

const keys = [...new Set([...a.by.keys(), ...b.by.keys()])].sort();
let same = 0, diff = 0, onlyA = 0, onlyB = 0;
const moved = [];
for (const k of keys) {
  const ra = a.by.get(k), rb = b.by.get(k);
  if (!rb) { onlyA++; continue; }
  if (!ra) { onlyB++; continue; }
  if (ra.hash === rb.hash) { same++; continue; }
  diff++;
  let d = {};
  try {
    const sa = frameStats(fs.readFileSync(path.join(A, 'frames', ra.file)));
    const sb = frameStats(fs.readFileSync(path.join(B, 'frames', rb.file)));
    d = {
      d_edge: +(sb.edge_density - sa.edge_density).toFixed(4),
      d_span: sb.luma_span - sa.luma_span,
      d_dom: +(sb.dominant_frac - sa.dominant_frac).toFixed(4),
      flags: [...new Set([...sa.flags, ...sb.flags])],
    };
  } catch { /* frames not kept: the hash difference is still the finding */ }
  moved.push({ key: k, ...d });
}

console.log(`\n${same} identical, ${diff} changed, ${onlyA} only in A, ${onlyB} only in B  (of ${keys.length} shots)`);
if (moved.length) {
  console.log('\nchanged shots — d(edge density), d(luma span), d(dominant colour):');
  moved.sort((x, y) => Math.abs(y.d_edge || 0) - Math.abs(x.d_edge || 0));
  for (const m of moved.slice(0, 40)) {
    console.log(`  ${m.key.padEnd(42)} edge ${String(m.d_edge ?? '?').padStart(8)}  span ${String(m.d_span ?? '?').padStart(5)}  dom ${String(m.d_dom ?? '?').padStart(8)}  ${m.flags && m.flags.length ? `[${m.flags.join(',')}]` : ''}`);
  }
  if (moved.length > 40) console.log(`  ... and ${moved.length - 40} more`);
}

const total = same + diff;
const changedFrac = total ? diff / total : 0;
if (EXPECT === 'same') {
  const ok = diff === 0 && onlyA === 0 && onlyB === 0;
  console.log(`\nDETERMINISM: ${ok ? 'PASS' : 'FAIL'} — ${diff} of ${total} frame hashes differ at the same seed.`);
  if (!ok) console.log('  A non-deterministic capture blocks the whole visual programme (W1-30V stop condition).');
  process.exit(ok ? 0 : 1);
}
if (EXPECT === 'differ') {
  const ok = changedFrac >= 0.95;
  console.log(`\nRED CONTROL: ${ok ? 'PASS' : 'FAIL'} — ${(changedFrac * 100).toFixed(1)}% of hashes changed with the seed (need >= 95%).`);
  if (!ok) console.log('  If changing the seed does not change the pixels, the hash is not measuring the render, and the determinism PASS above means nothing.');
  process.exit(ok ? 0 : 1);
}
