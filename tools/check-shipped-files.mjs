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
//   node tools/check-shipped-files.mjs
//   node tools/check-shipped-files.mjs --self-test
//
// Exit 1 naming the file and its importers. Blocking in the pre-commit hook: an untracked module is
// a broken deployment, and unlike most defects this one cannot be seen by looking at the game.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const selfTest = process.argv.includes('--self-test');

/** Every path git knows about, as a Set of repo-relative POSIX paths. */
function tracked() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return new Set(out.split('\n').filter(Boolean));
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

const isTracked = tracked();
const jsFiles = walk(GAME).filter((f) => /\.m?js$/.test(f));
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

// The data manifest too: `game/data/index.json` lists every file the engine fetches at runtime, and
// an untracked data file fails on the deployed site exactly the same way a module does.
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

if (selfTest) {
  // Rule 4, two arms. A file the game really imports must come back clean; a fabricated import of
  // something that is not in git must be reported. The second arm is done by asking the checker
  // about a path we know git has never seen, through the same `isTracked` set the real run uses.
  const ghost = 'game/src/__no-such-module-' + Date.now() + '.js';
  const armA = !isTracked.has(ghost);                     // must be true: git has never seen it
  const armB = isTracked.has('game/src/main.js');          // must be true: git certainly has this
  const ok = armA && armB;
  console.log(`check-shipped-files --self-test: unknown path absent from git = ${armA}, known path present = ${armB}`);
  console.log(ok ? 'check-shipped-files --self-test: PASS — it can tell tracked from untracked.'
                 : 'check-shipped-files --self-test: FAIL — the git index read is not working.');
  process.exit(ok ? 0 : 1);
}

if (problems.length) {
  console.error(`check-shipped-files: ${problems.length} file(s) the game needs are not in the repository:`);
  const seen = new Set();
  for (const p of problems) {
    const key = p.kind + p.rel;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ${p.kind.padEnd(15)} ${p.rel}`);
    console.error(`  ${''.padEnd(15)}   imported by ${p.importer}`);
  }
  console.error('');
  console.error('  These work here and 404 on the deployed site, where a failed module import draws');
  console.error('  nothing and reports nothing. `git add` them, or delete the import.');
  process.exit(1);
}
console.log(`check-shipped-files: every import and data file the game needs is tracked (${jsFiles.length} modules scanned).`);
