#!/usr/bin/env node
// critic-deploy-r2-drift.mjs — how much of the deployed site does verify-live-site's staleness
// check actually look at, and is anything drifted right now that it cannot see?
//
// `verify-live-site.mjs` sweeps every file under `game/` for a 200, which catches ABSENCE. For
// STALENESS it compares exactly two files — `index.html` and `src/main.js`. The W1-DEPLOY r1
// verdict said that is too thin and named the set it should compare instead (the manifest, every
// module, a sample of data leaves). This measures the claim rather than asserting it: fetch a
// sample of the deployed bytes, hash them against HEAD, and report how many differ INSIDE the
// checked pair versus OUTSIDE it.
//
//   node tools/world/critic-deploy-r2-drift.mjs [--n 60]
//
// Exit 0 always — this is a measurement, not a gate. Rule 12: it stamps the commit.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = at('--url', 'https://jtattersall09403.github.io/elder-souls-claude/game/').replace(/\/?$/, '/');
const N = Number(at('--n', '60'));
const CHECKED = ['index.html', 'src/main.js'];   // exactly what verify-live-site compares

const sha = (b) => createHash('sha256').update(b).digest('hex');
const COMMIT = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'game'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').filter(Boolean).map((p) => p.replace(/^game\//, ''));

const modules = tracked.filter((p) => /\.m?js$/.test(p));
const data = tracked.filter((p) => p.startsWith('data/'));
const other = tracked.filter((p) => !/\.m?js$/.test(p) && !p.startsWith('data/'));

// A deterministic spread: the two checked files, every module up to a budget, the manifest, and an
// evenly-strided sample of data leaves. Striding rather than random so the run is reproducible.
const stride = (arr, k) => { const out = []; const s = Math.max(1, Math.floor(arr.length / k)); for (let i = 0; i < arr.length && out.length < k; i += s) out.push(arr[i]); return out; };
const sample = [...new Set([...CHECKED, 'data/index.json', ...stride(modules, Math.round(N * 0.45)),
                            ...stride(data, Math.round(N * 0.45)), ...stride(other, Math.round(N * 0.1))])];

const body = (rel) => {
  try { return execFileSync('curl', ['-s', '--max-time', '30', '-w', '\n%{http_code}', BASE + rel],
    { maxBuffer: 64 * 1024 * 1024 }); } catch { return null; }
};

console.log(`critic-deploy-r2-drift: ${BASE}`);
console.log(`  HEAD ${COMMIT} · game/ has ${tracked.length} tracked file(s) · verify-live-site hashes ${CHECKED.length} of them`);
console.log(`  sampling ${sample.length} …\n`);

const rows = [];
for (const rel of sample) {
  const raw = body(rel);
  if (!raw) { rows.push({ rel, status: 0, same: null }); continue; }
  const nl = raw.lastIndexOf(0x0a);
  const status = Number(raw.slice(nl + 1).toString().trim()) || 0;
  const payload = raw.slice(0, nl);
  // TWO comparisons, because they answer different questions and verify-live-site conflates them.
  //   worktree — what verify-live-site actually hashes (`readFileSync(join(LOCAL, rel))`).
  //   HEAD     — what was PUBLISHED, which is the only thing a static host can be stale against.
  // On a tree where a dozen agents edit `game/` at once these two differ constantly, and a
  // difference against the worktree is a neighbour's in-flight edit, not a deployment failure.
  const local = existsSync(join(ROOT, 'game', rel)) ? readFileSync(join(ROOT, 'game', rel)) : null;
  let head = null;
  try { head = execFileSync('git', ['show', `HEAD:game/${rel}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }); } catch { /* not in HEAD */ }
  rows.push({ rel, status,
              same: status === 200 && local ? sha(payload) === sha(local) : null,
              sameAsHead: status === 200 && head ? sha(payload) === sha(head) : null,
              liveBytes: payload.length, localBytes: local ? local.length : null });
}

const got = rows.filter((r) => r.status === 200);
const drifted = got.filter((r) => r.same === false);
const inChecked = drifted.filter((r) => CHECKED.includes(r.rel));
const outside = drifted.filter((r) => !CHECKED.includes(r.rel));

const staleVsHead = got.filter((r) => r.sameAsHead === false);
for (const r of rows) {
  if (r.status !== 200) { console.log(`  ${('HTTP ' + (r.status || 'no-response')).padEnd(22)} ${r.rel}`); continue; }
  if (r.same === false || r.sameAsHead === false) {
    const what = r.sameAsHead === false ? 'STALE vs HEAD' : 'differs vs WORKTREE only';
    console.log(`  ${what.padEnd(22)} ${r.rel}   live ${r.liveBytes}B vs disk ${r.localBytes}B`);
  }
}

console.log(`\n  ${got.length}/${rows.length} retrievable`);
console.log(`  vs the WORKING TREE (what verify-live-site hashes): ${drifted.length} differ — ${inChecked.length} inside its 2-file pair, ${outside.length} outside it.`);
console.log(`  vs HEAD            (what was actually published):   ${staleVsHead.length} differ.`);
if (drifted.length > staleVsHead.length) {
  console.log('\n  THE DIFFERENCE BETWEEN THOSE TWO NUMBERS IS THE DEFECT. verify-live-site compares the');
  console.log('  deployed bytes against `readFileSync(game/<rel>)` — the WORKING TREE — so a neighbour');
  console.log(`  mid-edit reads as a deployment failure. ${drifted.length - staleVsHead.length} sampled file(s) are in exactly that state`);
  console.log('  right now. The only thing a static host can be stale against is HEAD.');
}
if (outside.length && !inChecked.length) {
  console.log('\n  AND IT WOULD PRINT "the deployed bytes match what we published" RIGHT NOW, with');
  console.log(`  ${outside.length} sampled file(s) differing, because neither is one of the two it hashes.`);
  console.log(`  Extrapolated over ${tracked.length} tracked files: ~${Math.round(outside.length / got.length * tracked.length)} file(s) it never looks at.`);
}
if (!drifted.length && !staleVsHead.length) {
  console.log('\n  Nothing in this sample differs, so the thinness is a coverage argument today rather');
  console.log(`  than a live defect: the pair is 2 of ${tracked.length} files, ${(200 / tracked.length).toFixed(2)}% of what a stale deploy could hold.`);
}
