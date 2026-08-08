#!/usr/bin/env node
// check-shipped-files.mjs — everything the game imports must actually be in the repository.
//
// WHY THIS EXISTS, precisely. The owner opened the published game on a phone and got a black
// screen. `game/src/input/hold-gate.js` had been written at 08:51, imported by `gamepad.js` and
// `touch.js`, and **never committed**. On this machine it was on disk, so every local check passed
// and the game ran perfectly. On the deployed site the file did not exist, the ES module graph
// failed on a 404, and nothing was drawn — silently, because a failed module import does not throw
// anywhere a page-error listener can see it as a cause.
//
// The class is: *present locally, absent in the repo.* No amount of running the game here can catch
// it, because here is exactly where the file exists. The only check that works is against git.
//
// GATE-BLAST-RADIUS (rule 13, second offence). Narrowing the scan to tracked-or-staged importers
// (below) fixed *which files are scanned* and did nothing about *which problems block* — because
// the offending shape is a file that is TRACKED IN HEAD (committed in some earlier, unrelated
// commit) importing a path that is untracked TODAY because a different, concurrently running agent
// has written it but not yet committed it. That importer was scanned correctly under the old
// narrowing; the problem was that ANY such problem, anywhere in the tracked tree, blocked EVERY
// commit — a builder hit fourteen consecutive refusals over a neighbour's in-flight pair of files
// it had never touched. So now: a problem blocks the CURRENT commit only if the current commit is
// the one that can fix it — i.e. the importer or the target is among the paths this very `git
// commit` is about to write (see `classify()`). Everything else prints loudly and lets the commit
// through; `tools/bank.mjs`, the orchestrator's single push/deploy chokepoint, is where an
// unresolved problem is actually kept out of what gets pushed (see that file's own comment).
//
//   node tools/check-shipped-files.mjs                 advisory unless the current commit owns it
//   node tools/check-shipped-files.mjs --strict         ANY problem blocks — the push/deploy gate
//   node tools/check-shipped-files.mjs --self-test       four arms, two of which must disagree
//
// Exit 1 naming the file and its importers, and (when known) which live piece owns the missing
// path, from `tools/ownership.mjs --for`.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const THIS_FILE = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------------------------
// Pure pieces — no disk, no git — so --self-test can drive them directly with fabricated input
// and prove the two arms that matter genuinely disagree (RULES.md rule 4).
// ---------------------------------------------------------------------------------------------

/**
 * Split `problems` into `mine` (this commit can fix it: the importer or the missing/untracked
 * target is one of the paths this commit is about to write) and `foreign` (somebody else's
 * in-flight work; not this commit's to fix). `committedPaths` is exactly what `git diff --cached
 * --name-only` reports at pre-commit time — verified empirically that `git commit --only <paths>`
 * runs the hook against a temporary index containing only those paths, so this is precise per
 * commit, not a guess from the shared index.
 */
function classify(problems, committedPaths) {
  const mine = [], foreign = [];
  const committed = new Set(committedPaths);
  for (const p of problems) {
    (committed.has(p.importer) || committed.has(p.rel) ? mine : foreign).push(p);
  }
  return { mine, foreign };
}

/** Best-effort "who owns this, right now" — advisory only, never affects the exit code. */
function ownerOf(rel) {
  try {
    const out = execFileSync('node', [join(ROOT, 'tools', 'ownership.mjs'), '--for', rel],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const ids = [...out.matchAll(/^\s{2}(\S+)\s+\[/gm)].map((m) => m[1]);
    return ids.length ? ids.join(', ') : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// Scan — real disk, real git.
// ---------------------------------------------------------------------------------------------

/** Every path git knows about, as a Set of repo-relative POSIX paths. */
function tracked() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return new Set(out.split('\n').filter(Boolean));
}

function stagedPaths() {
  try {
    return execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch { return []; }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) {
    if (n === 'node_modules') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Static imports, re-exports and dynamic import() with a literal. A computed specifier cannot be
// checked and is not the shape that has bitten us.
const SPEC = /(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const specs = [];
  let m;
  SPEC.lastIndex = 0;
  while ((m = SPEC.exec(src))) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) specs.push(spec);
  }
  return specs;
}

/** Everything the shipped-files gate can currently see wrong. Real disk, real git, no side effects. */
function scan() {
  const isTracked = tracked();
  // Only scan files that are TRACKED or STAGED. The first version scanned every `.js` under
  // `game/`, so a neighbour's untracked scratch file could fail this gate too. Its critic
  // measured it firing on 4 of 6 otherwise-sound trees.
  const stagedNow = new Set(stagedPaths());
  const jsFiles = walk(GAME)
    .filter((f) => /\.m?js$/.test(f))
    .filter((f) => {
      const rel = relative(ROOT, f).split('\\').join('/');
      return isTracked.has(rel) || stagedNow.has(rel);
    });
  const problems = [];

  for (const file of jsFiles) {
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      const rel = relative(ROOT, target).split('\\').join('/');
      const importer = relative(ROOT, file).split('\\').join('/');
      if (!existsSync(target)) problems.push({ kind: 'MISSING ON DISK', rel, importer });
      else if (!isTracked.has(rel)) problems.push({ kind: 'NOT IN GIT', rel, importer });
    }
  }

  // The data manifest too: `game/data/index.json` lists every file the engine fetches at runtime,
  // and an untracked data file fails on the deployed site exactly the same way a module does.
  const manifest = join(GAME, 'data', 'index.json');
  if (existsSync(manifest)) {
    let idx; try { idx = JSON.parse(readFileSync(manifest, 'utf8')); } catch { idx = null; }
    for (const entry of (idx?.files || [])) {
      const p = entry?.path;
      if (typeof p !== 'string') continue;
      const rel = `game/data/${p}`;
      if (!existsSync(join(ROOT, rel))) problems.push({ kind: 'MISSING ON DISK', rel, importer: 'game/data/index.json' });
      else if (!isTracked.has(rel)) problems.push({ kind: 'NOT IN GIT', rel, importer: 'game/data/index.json' });
    }
  }

  return { problems, jsFiles, stagedNow: [...stagedNow] };
}

/** De-duplicate (kind, rel) pairs — many importers can point at the same broken target. */
function dedupe(list) {
  const seen = new Set(), out = [];
  for (const p of list) {
    const key = p.kind + p.rel;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function printProblems(list, { blocking }) {
  const label = blocking ? 'BLOCKING' : 'advisory (not this commit\'s to fix)';
  console.error(`  [${label}]`);
  for (const p of dedupe(list)) {
    const owner = ownerOf(p.rel);
    console.error(`  ${p.kind.padEnd(15)} ${p.rel}`);
    console.error(`  ${''.padEnd(15)}   imported by ${p.importer}`);
    if (owner) console.error(`  ${''.padEnd(15)}   claimed by (live): ${owner}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Self-test. Rule 4: a probe that cannot fail is worse than no probe. Two of these four arms must
// genuinely disagree — a missing module the committer introduces is still caught (mine, blocks);
// a neighbour's missing module warns and passes at commit time, and only that arm's `--strict`
// twin blocks (the push/deploy gate). If both arms come back the same, the split is not real.
// ---------------------------------------------------------------------------------------------
function selfTest() {
  let failures = 0;
  const fail = (msg) => { console.error(`check-shipped-files --self-test: FAILED — ${msg}`); failures++; };

  // Arm A/B: the underlying tracked/untracked distinction still works (unchanged from before).
  const isTracked = tracked();
  const ghost = 'game/src/__no-such-module-' + Date.now() + '.js';
  const armA = !isTracked.has(ghost);
  const armB = isTracked.has('game/src/main.js');
  if (!armA) fail('a fabricated path git has never seen was reported as tracked');
  if (!armB) fail('a path git certainly has (game/src/main.js) was reported as untracked');

  // Arm C: a problem whose importer IS in the current commit's own path set — must block, in
  // BOTH default and --strict mode, because the committer can actually fix it.
  const selfIntroduced = [{ kind: 'NOT IN GIT', rel: 'game/src/ghost-target.js', importer: 'game/src/my-new-file.js' }];
  const cMine = classify(selfIntroduced, ['game/src/my-new-file.js']).mine;
  if (cMine.length !== 1) fail('a problem introduced by the committer\'s own staged paths was NOT classified as blocking');

  // Arm D: the same shape, but the importer belongs to a commit that never touches it — must
  // warn-and-pass by default, and this is the arm that must DISAGREE with C for the split to be
  // real (a missing module introduced by the committer vs. a neighbour's).
  const neighbours = [{ kind: 'NOT IN GIT', rel: 'game/src/ghost-target.js', importer: 'game/src/neighbours-old-file.js' }];
  const dSplit = classify(neighbours, ['game/src/my-new-file.js']);
  if (dSplit.mine.length !== 0) fail('a neighbour\'s pre-existing problem was classified as the committer\'s to fix');
  if (dSplit.foreign.length !== 1) fail('a neighbour\'s pre-existing problem was dropped instead of reported advisory');

  // The two arms that matter (C vs D) must disagree, or the split does nothing.
  if (cMine.length > 0 && dSplit.mine.length > 0) fail('arm C (self-introduced) and arm D (neighbour) did not disagree — the split is not real');

  const ok = failures === 0;
  console.log(`check-shipped-files --self-test: tracked/untracked = ${armA && armB}, self-introduced blocks = ${cMine.length === 1}, neighbour warns-and-passes = ${dSplit.mine.length === 0 && dSplit.foreign.length === 1}, arms disagree = ${cMine.length > 0 && dSplit.mine.length === 0}`);
  console.log(ok ? 'check-shipped-files --self-test: PASS (4/4)' : `check-shipped-files --self-test: ${failures} FAILURE(S)`);
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// CLI — only runs when this file is executed directly, so `tools/bank.mjs` can `import { scan,
// classify }` and make its own push/deploy-time decision without shelling out and parsing text.
// ---------------------------------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === (process.argv[1] && resolve(process.argv[1]))) {
  const strict = process.argv.includes('--strict');
  if (process.argv.includes('--self-test')) selfTest();

  const { problems, jsFiles } = scan();
  if (!problems.length) {
    console.log(`check-shipped-files: every import and data file the game needs is tracked (${jsFiles.length} modules scanned).`);
    process.exit(0);
  }

  const { mine, foreign } = classify(problems, stagedPaths());
  const blockingList = strict ? [...mine, ...foreign] : mine;
  const advisoryList = strict ? [] : foreign;

  console.error(`check-shipped-files: ${dedupe(problems).length} file(s) the game needs are not in the repository:`);
  if (advisoryList.length) printProblems(advisoryList, { blocking: false });
  if (blockingList.length) printProblems(blockingList, { blocking: true });
  console.error('');
  console.error('  These work here and 404 on the deployed site, where a failed module import draws');
  console.error('  nothing and reports nothing. `git add` them, or delete the import.');
  if (advisoryList.length && !blockingList.length) {
    console.error('');
    console.error('  None of this is introduced by the current commit, so it is not blocked here (rule 13)');
    console.error('  — it will block `tools/bank.mjs`, the push/deploy chokepoint, until it is fixed by');
    console.error('  whoever owns it.');
  }
  process.exit(blockingList.length ? 1 : 0);
}

export { scan, classify, ownerOf, dedupe };
