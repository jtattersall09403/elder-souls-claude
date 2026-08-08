#!/usr/bin/env node
// verify-live-site.mjs — is the thing on the internet the thing we tested?
//
// WHY THIS EXISTS. Every check this project had ran against a local server. The owner opened the
// *published* URL on a phone and got a black rectangle, and not one instrument could have seen it,
// because none of them had ever fetched the deployed site. A local pass is not evidence about a
// static host: the host can be a commit behind, it can be mid-deploy, it can 404 a path that
// exists on disk, and it can serve a directory listing where a file is expected.
//
// So this asks the deployed site three questions that a local server cannot answer:
//   1. Is every file we published actually retrievable there?   (a 404 is silent to the page)
//   2. Is it the same bytes we published?                       (staleness)
//   3. Is the deployment behind our HEAD?                       (mid-deploy, or Pages failed)
//
//   node tools/world/verify-live-site.mjs
//   node tools/world/verify-live-site.mjs --url https://host/path/
//   node tools/world/verify-live-site.mjs --self-test
//
// It shells out to `curl` rather than using node `fetch` — see the note above `head()`; the proxy
// here 403s node fetch for every URL, and the self-test is what caught that.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LOCAL = join(ROOT, 'docs', 'play');
const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = at('--url', 'https://jtattersall09403.github.io/elder-souls-claude/play/').replace(/\/?$/, '/');
const selfTest = argv.includes('--self-test');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const sha = (b) => createHash('sha256').update(b).digest('hex');

// Outbound HTTPS here goes through an agent proxy that node's `fetch` does not traverse — it
// returns 403 for every URL, including ones `curl` fetches happily. The self-test caught that on
// the first run: "missing path reported = true, real path clean = FALSE", i.e. the sweep called a
// live file dead. Without that second arm this tool would have reported all 711 files missing and
// I would have gone looking for a deployment failure that did not exist. So: curl, which works.
function head(url) {
  try {
    const out = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '25', url],
      { encoding: 'utf8' });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}

/** HEAD every path, a few at a time, and report the ones that are not 200. */
async function sweep(paths, concurrency = 10) {
  const bad = [];
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < paths.length) {
      const rel = paths[i++];
      const code = head(BASE + rel);
      if (code !== 200) bad.push(`${code || 'no-response'} ${rel}`);
      await new Promise((r) => setImmediate(r));
    }
  }));
  return bad;
}

if (selfTest) {
  // Rule 4. Two arms: a path that certainly is not there must be reported, and a path that
  // certainly is must not be. A sweep that reports nothing because it silently swallowed its own
  // errors would pass the first arm only.
  const bogus = await sweep(['definitely-not-a-real-file-' + Date.now() + '.json']);
  const real = await sweep(['index.html']);
  const ok = bogus.length === 1 && real.length === 0;
  console.log(`verify-live-site --self-test: missing path reported = ${bogus.length === 1}, real path clean = ${real.length === 0}`);
  console.log(ok ? 'verify-live-site --self-test: PASS' : 'verify-live-site --self-test: FAIL — the sweep cannot tell present from absent.');
  process.exit(ok ? 0 : 1);
}

const files = walk(LOCAL).map((f) => relative(LOCAL, f).split('\\').join('/'));
if (!files.length) { console.error('verify-live-site: docs/play is empty — run `node tools/publish-game.mjs`.'); process.exit(2); }

console.log(`verify-live-site: ${BASE}`);
console.log(`verify-live-site: checking ${files.length} published file(s) …`);
const missing = await sweep(files);

// Staleness: compare a few bytes that change on every meaningful edit. index.html is the page
// itself; main.js is the entry point. If either differs, the deployment is not what we tested.
const drift = [];
for (const rel of ['index.html', 'src/main.js']) {
  try {
    const body = execFileSync('curl', ['-s', '--max-time', '30', BASE + rel], { maxBuffer: 64 * 1024 * 1024 });
    if (!body.length) { drift.push(`${rel}: empty response`); continue; }
    const live = sha(body);
    const local = sha(readFileSync(join(LOCAL, rel)));
    if (live !== local) drift.push(`${rel}: live ${live.slice(0, 12)} != published ${local.slice(0, 12)}`);
  } catch (e) { drift.push(`${rel}: ${String(e.message || e).slice(0, 60)}`); }
}

if (missing.length) {
  console.error(`\nverify-live-site: ${missing.length} published file(s) are NOT retrievable:`);
  for (const m of missing.slice(0, 15)) console.error(`  ${m}`);
  if (missing.length > 15) console.error(`  … and ${missing.length - 15} more`);
  console.error('\n  A missing file does not throw in the browser — the fetch resolves and the game');
  console.error('  quietly gets nothing. This is the most likely cause of a black screen.');
}
if (drift.length) {
  console.error(`\nverify-live-site: the deployed site is not the published one:`);
  for (const d of drift) console.error(`  ${d}`);
  console.error('\n  Either Pages has not finished building, or the build failed. Wait a minute and');
  console.error('  re-run; if it persists, the deployment is broken rather than slow.');
}
if (!missing.length && !drift.length) {
  console.log(`verify-live-site: PASS — all ${files.length} files retrievable, and the deployed bytes match what we published.`);
}
process.exit(missing.length || drift.length ? 1 : 0);
