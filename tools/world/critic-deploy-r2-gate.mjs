#!/usr/bin/env node
// critic-deploy-r2-gate.mjs — re-take W1-DEPLOY r1's gate measurement against the version of
// `tools/check-shipped-files.mjs` that exists NOW, in BOTH of its modes.
//
// WHY A SECOND FIXTURE. `critic-deploy-gate-fixture.mjs` (r1) runs the gate with no flags. Since
// r1 the gate has grown a blast-radius policy: bare = block only on problems the CURRENT COMMIT
// introduced, `--strict` = block on anything (this is what `tools/bank.mjs` calls at push time).
// Run bare, r1's whole scenario set now exits 0 — every defect is "somebody else's" because the
// fixture commits the sound files first. That would read as a catastrophic regression and it is
// not one; it is the fixture asking the wrong mode. DETECTION and POLICY are separate questions
// and this file asks both:
//
//   DETECTION  — with `--strict`, does the scanner SEE the defect at all? (r1's question)
//   POLICY     — bare, does a defect the commit introduced block, and a neighbour's not block?
//
//   node tools/world/critic-deploy-r2-gate.mjs
//
// Byte-identical copy of the tool, sha256-checked, in a throwaway git repo per scenario.
// Exit 1 if any scenario behaved wrongly.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SRC = readFileSync(join(ROOT, 'tools', 'check-shipped-files.mjs'));
const SHA = createHash('sha256').update(SRC).digest('hex');
const HTML = '<!doctype html><canvas id="view"></canvas><script type="module" src="./src/main.js"></script>';

const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=c@es', '-c', 'user.name=critic',
  '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...a],
  { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function repo({ files = {}, untracked = {}, staged = {}, ignored = null }) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-critic-w1-deploy-r2-'));
  const put = (rel, body) => { const p = join(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };
  git(dir, 'init', '-q', '-b', 'main');
  put('tools/check-shipped-files.mjs', SRC);
  for (const [r, b] of Object.entries(files)) put(r, b);
  if (ignored) put('.gitignore', ignored);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'fixture');
  for (const [r, b] of Object.entries(untracked)) put(r, b);
  // `staged` = written AND `git add`ed but not committed: this is how the gate learns that the
  // problem belongs to the commit being made rather than to a neighbour.
  for (const [r, b] of Object.entries(staged)) { put(r, b); git(dir, 'add', r); }
  return dir;
}

const run = (dir, ...flags) => {
  const r = spawnSync(process.execPath, [join(dir, 'tools', 'check-shipped-files.mjs'), ...flags],
    { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

// ── DETECTION: can the scanner SEE it? Asked in --strict so policy cannot mask the answer. ─────
const DETECT = [
  { id: 'A.  untracked module, plainly imported   (the defect that shipped)', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': "import { gate } from './input/hold-gate.js';\n" },
                        untracked: { 'game/src/input/hold-gate.js': 'export const gate = () => 1;\n' } }) },
  { id: 'B.  everything tracked                   (must not cry wolf)', want: 'pass',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': "import { gate } from './input/hold-gate.js';\n",
                                 'game/src/input/hold-gate.js': 'export const gate = () => 1;\n' } }) },
  { id: 'C.  untracked module behind a >200-char binding list', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML,
      'game/src/main.js': 'import {\n' + Array.from({ length: 24 }, (_, i) => `  aVeryLongBindingName${i},`).join('\n') +
        "\n} from './atlas.js';\n" },
      untracked: { 'game/src/atlas.js': 'export const x = 1;\n' } }) },
  { id: 'D.  file named only by new URL(..., import.meta.url)', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML,
      'game/src/main.js': "const w = new URL('./worker.js', import.meta.url);\nexport default w;\n" },
      untracked: { 'game/src/worker.js': 'self.onmessage = () => {};\n' } }) },
  { id: 'E.  file referenced only by index.html <script src>', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML + '<script src="./boot-extra.js"></script>',
      'game/src/main.js': 'export const boot = () => 1;\n' },
      untracked: { 'game/boot-extra.js': 'window.x = 1;\n' } }) },
  { id: 'G2. side-effect import  (import "./x.js", no `from`)', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': "import './polyfill.js';\nexport const boot = () => 1;\n" },
      untracked: { 'game/src/polyfill.js': 'window.p = 1;\n' } }) },
  { id: 'I.  an import inside a template literal  (a doc example, sound tree)', want: 'pass',
    build: () => repo({ files: { 'game/index.html': HTML,
      'game/src/main.js': "export const doc = `import { x } from './not-a-real-module.js';`;\n" } }) },
  { id: 'K.  an extensionless import of a directory (sound tree)', want: 'pass',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': "import { w } from './widgets';\n",
      'game/src/widgets/index.js': 'export const w = 1;\n' } }) },
  { id: 'L.  an import specifier carrying a query string (sound tree)', want: 'pass',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': "import a from './atlas.js?v=2';\n",
      'game/src/atlas.js': 'export default 1;\n' } }) },
];

// ── POLICY: the blast-radius rule the gate grew after r1. Asked with no flags. ─────────────────
const POLICY = [
  { id: 'P1. the defect is in THIS commit\'s own staged files  -> must BLOCK', want: 'catch',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': 'export const boot = () => 1;\n' },
      staged: { 'game/src/mine.js': "import { g } from './ghost.js';\nexport const m = g;\n" } }) },
  { id: 'P2. the defect is a NEIGHBOUR\'S, nothing of mine staged -> must PASS', want: 'pass',
    build: () => repo({ files: { 'game/index.html': HTML, 'game/src/main.js': 'export const boot = () => 1;\n',
      'game/src/theirs.js': "import { g } from './ghost.js';\nexport const t = g;\n" } }) },
];

let wrong = 0;
console.log(`critic-deploy-r2-gate: tools/check-shipped-files.mjs @ sha256 ${SHA.slice(0, 12)}  (${SRC.length} bytes)\n`);
console.log('  DETECTION — run with --strict, so the blast-radius policy cannot mask the answer:');
const detRows = [];
for (const s of DETECT) {
  const dir = s.build();
  const r = run(dir, '--strict');
  const fired = r.code !== 0;
  const ok = s.want === 'catch' ? fired : !fired;
  if (!ok) wrong++;
  detRows.push({ ...s, ok, fired });
  console.log(`    ${(s.want === 'catch' ? (fired ? ' ok  CAUGHT' : 'GAP  MISSED') : (fired ? 'GAP  FALSE POSITIVE' : ' ok  quiet')).padEnd(20)} ${s.id}`);
  if (!ok && fired) for (const l of r.out.split('\n').filter((l) => /NOT IN GIT|MISSING ON DISK/.test(l)).slice(0, 1)) console.log(`           | ${l.trim()}`);
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n  POLICY — run bare, the mode the pre-commit hook uses:');
for (const s of POLICY) {
  const dir = s.build();
  const r = run(dir);
  const fired = r.code !== 0;
  const ok = s.want === 'catch' ? fired : !fired;
  if (!ok) wrong++;
  console.log(`    ${(ok ? ' ok ' : 'GAP ').padEnd(20)} ${s.id}   (exit ${r.code})`);
  if (!ok) console.log(`           | ${r.out.split('\n').filter(Boolean).slice(-2).join(' / ').slice(0, 160)}`);
  rmSync(dir, { recursive: true, force: true });
}

// And the one that decides whether DETECTION even matters: is --strict what ships?
const catches = detRows.filter((r) => r.want === 'catch');
const quiets = detRows.filter((r) => r.want === 'pass');
console.log(`\n  detected ${catches.filter((r) => r.ok).length}/${catches.length} defect shapes (--strict); ` +
            `${quiets.filter((r) => !r.ok).length} false positive(s) on ${quiets.length} sound tree(s).`);
const missed = catches.filter((r) => !r.ok);
if (missed.length) {
  console.log('\n  Shapes that reach the deployed site with the gate green, in EITHER mode:');
  for (const m of missed) console.log(`    ${m.id}`);
}
console.log(wrong ? `\ncritic-deploy-r2-gate: ${wrong} scenario(s) behaved wrongly.`
                  : '\ncritic-deploy-r2-gate: every scenario behaved correctly.');
process.exit(wrong ? 1 : 0);
