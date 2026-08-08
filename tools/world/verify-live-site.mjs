#!/usr/bin/env node
// verify-live-site.mjs — is the thing on the internet the thing we tested?
//
// WHY THIS EXISTS. Every check this project had ran against a local server. The owner opened the
// *published* URL on a phone and got a black rectangle, and not one instrument could have seen it,
// because none of them had ever fetched the deployed site. A local pass is not evidence about a
// static host: the host can be a commit behind, it can be mid-deploy, it can 404 a path that
// exists on disk, and it can serve a directory listing where a file is expected.
//
// Pages now publishes this repository from its ROOT, so `game/` is served directly and there is no
// mirror to keep in step. That deleted a whole class of defect — the copy going stale, somebody
// editing the copy, the copy and the source disagreeing — at the cost of nothing.
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
const LOCAL = join(ROOT, 'game');
const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = at('--url', 'https://jtattersall09403.github.io/elder-souls-claude/game/').replace(/\/?$/, '/');
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

// WHAT GIT ACTUALLY HAS. The first black screen was `game/src/input/hold-gate.js`, written and
// never committed: present on this disk, absent from the repo, so every local check passed and the
// deployed module graph 404'd in silence. So a tool that reports "missing on the live site" and
// stops has described the symptom; whether the file is in the repository is the diagnosis.
//
// AND IT MUST BE `HEAD`, NOT `ls-files`. The first version of this asked `git ls-files`, which
// includes the INDEX — and the index is not the repository. On this tree that made it print "all
// of them ARE tracked in git, so this is a deployment failure" about three files that were
// `git add`ed and never committed, which is the exact opposite of the truth and would have sent
// somebody to look at Pages. One of the three was `src/sim/quest/refusal.js`, imported by
// `engine.js:26` — hold-gate.js again, one `git commit` away from being the same black screen.
//
// Three states, because they need three different sentences:
//   committed   — in HEAD. If it 404s, the deployment is behind or broken.
//   staged      — added, not committed. It will 404 until somebody commits it.
//   untracked   — on this disk only. It has never been on the site and never will be.
const gitSet = (args) => {
  try {
    return new Set(execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter(Boolean).map((p) => p.replace(/^game\//, '')));
  } catch { return null; }
};
const committed = gitSet(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'game']);
const staged = gitSet(['diff', '--cached', '--name-only', '--diff-filter=A', '--', 'game']);
const gitState = (rel) => {
  if (!committed) return 'unknown';
  if (committed.has(rel)) return 'committed';
  if (staged && staged.has(rel)) return 'staged-not-committed';
  return 'untracked';
};

if (selfTest) {
  // Rule 4. Two arms: a path that certainly is not there must be reported, and a path that
  // certainly is must not be. A sweep that reports nothing because it silently swallowed its own
  // errors would pass the first arm only.
  const bogus = await sweep(['definitely-not-a-real-file-' + Date.now() + '.json']);
  const real = await sweep(['index.html']);
  console.log(`verify-live-site --self-test: missing path reported = ${bogus.length === 1}, real path clean = ${real.length === 0}`);

  // THE DRIFT ARM, which this self-test did not have. The sweep and the staleness check are two
  // independent claims and only one of them was ever shown able to fail. A hash comparison that
  // silently swallows its own errors returns "no drift" on a site that is a hundred commits
  // behind, and looks exactly like a clean pass. So: compare a live file against the WRONG local
  // file. It must report drift; and against the right one it must not.
  const fetchBody = (rel) => execFileSync('curl', ['-s', '--max-time', '30', BASE + rel], { maxBuffer: 64 * 1024 * 1024 });
  let driftSeen = false, driftQuiet = false;
  try {
    const live = sha(fetchBody('index.html'));
    driftSeen = live !== sha(readFileSync(join(LOCAL, 'src/main.js')));   // wrong file: MUST differ
    driftQuiet = live === sha(readFileSync(join(LOCAL, 'index.html')));   // right file: must match
  } catch (e) { console.log('verify-live-site --self-test: drift arm threw — ' + String(e.message).slice(0, 80)); }
  console.log(`verify-live-site --self-test: drift detected against the wrong file = ${driftSeen}, silent against the right one = ${driftQuiet}`);
  if (!driftQuiet) console.log('    (the deployed index.html does not match the local one — that is a REAL drift finding, not a broken arm)');

  // THE GIT-STATE ARM. This is the sentence the tool exists to be able to say, and the first
  // version of it said the opposite of the truth on this very tree — `git ls-files` counts the
  // index, so three files that were added and never committed were reported as "tracked, so this
  // is a deployment failure". An arm that never distinguishes the three states cannot catch that.
  const known = 'index.html';                                   // certainly in HEAD
  const invented = 'definitely-not-a-file-' + Date.now() + '.js'; // certainly in nothing
  const stateKnown = gitState(known), stateInvented = gitState(invented);
  const gitArm = stateKnown === 'committed' && stateInvented === 'untracked';
  console.log(`verify-live-site --self-test: git state of a committed file = ${stateKnown}, of an invented one = ${stateInvented}`);
  // And it must be able to SEE the staged-not-committed state at all, or that branch is dead code.
  const stagedNow = staged ? staged.size : -1;
  console.log(`verify-live-site --self-test: ${stagedNow} file(s) under game/ are staged-not-committed on this tree right now` +
    (stagedNow > 0 ? ` (e.g. ${[...staged].slice(0, 2).join(', ')}) — the branch is live, not dead code` : ' — that branch is untested on this tree'));

  const ok = bogus.length === 1 && real.length === 0 && driftSeen && gitArm;
  console.log(ok ? 'verify-live-site --self-test: PASS' : 'verify-live-site --self-test: FAIL — an arm cannot go red.');
  process.exit(ok ? 0 : 1);
}

const files = walk(LOCAL).map((f) => relative(LOCAL, f).split('\\').join('/'));
if (!files.length) { console.error('verify-live-site: game/ is empty.'); process.exit(2); }


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
  const rels = missing.map((m) => m.split(' ').slice(1).join(' '));
  const by = { committed: [], 'staged-not-committed': [], untracked: [], unknown: [] };
  for (const r of rels) by[gitState(r)].push(r);
  console.error(`\nverify-live-site: ${missing.length} published file(s) are NOT retrievable:`);
  for (const m of missing.slice(0, 15)) {
    const rel = m.split(' ').slice(1).join(' ');
    const st = gitState(rel);
    console.error(`  ${m}${st === 'committed' ? '' : `   <- ${st.toUpperCase()}`}`);
  }
  if (missing.length > 15) console.error(`  … and ${missing.length - 15} more`);
  console.error('\n  A missing file does not throw in the browser — the fetch resolves and the game');
  console.error('  quietly gets nothing. This is the most likely cause of a black screen.');

  if (by.untracked.length) {
    console.error(`\n  ${by.untracked.length} are UNTRACKED — on this disk and never in the repository, so every`);
    console.error('  check that runs here passes and the site has never had them. This is exactly how');
    console.error('  game/src/input/hold-gate.js reached the owner as a black screen.');
    console.error(`    git add ${by.untracked.slice(0, 3).map((p) => 'game/' + p).join(' ')}${by.untracked.length > 3 ? ' …' : ''}`);
  }
  if (by['staged-not-committed'].length) {
    console.error(`\n  ${by['staged-not-committed'].length} are STAGED BUT NOT COMMITTED. Somebody has \`git add\`ed them and not yet`);
    console.error('  committed, so they are in the index and not in the repository — and the index is');
    console.error('  not what Pages publishes. They will 404 for every visitor until that commit lands.');
    console.error('  This is one commit away from being the hold-gate.js black screen again, and if any');
    console.error('  of them is imported by the module graph it IS that black screen.');
    for (const p of by['staged-not-committed'].slice(0, 5)) console.error(`    game/${p}`);
  }
  if (by.committed.length) {
    console.error(`\n  ${by.committed.length} ARE in HEAD, so for those this is a deployment failure rather than a`);
    console.error('  missing commit: Pages is mid-build, behind, or its build failed.');
  }
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
