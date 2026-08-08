#!/usr/bin/env node
// critic-deploy-gate-fixture.mjs — run tools/check-shipped-files.mjs against a real repository
// that really has an untracked module, and against seven shapes that must NOT trip it.
//
// WHY. The shipped `--self-test` asserts that a fabricated path is absent from `git ls-files` and
// that `game/src/main.js` is present. Both are statements about the Set built by `tracked()`. The
// scanner — walk, regex, resolve, the data-manifest arm, the exit code, the message — is not
// executed by either arm. So the tool has never been shown to detect the defect it was written
// for. Rule 4: a probe that cannot fail is worse than no probe, and one that has only been shown
// to answer a question adjacent to its own is in that family.
//
// This builds a throwaway git repository in the scratchpad containing a byte-identical copy of
// the shipped tool (sha256-verified against the original on every run — if it drifts, this exits
// 2 rather than reporting about a tool nobody ships) and a small game/ tree, then runs the real
// tool over it once per scenario.
//
// Two kinds of scenario, and both matter:
//   MUST-CATCH  — the defect is present; the tool must exit non-zero and name the file.
//   MUST-PASS   — the tree is sound; the tool must exit 0. This is rule 13: the gate is BLOCKING
//                 in .githooks/pre-commit, so a false positive does not inconvenience its author,
//                 it stops every agent on the box from committing.
//
//   node tools/world/critic-deploy-gate-fixture.mjs
//   node tools/world/critic-deploy-gate-fixture.mjs --self-test
//
// Exit 1 if any scenario's verdict differs from what a correct gate would do.
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SHIPPED = join(ROOT, 'tools', 'check-shipped-files.mjs');
const SCRATCH = process.env.ES_SCRATCH
  || '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad';
const selfTest = process.argv.includes('--self-test');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const shippedSrc = readFileSync(SHIPPED);
const shippedSha = sha(shippedSrc);

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.email=critic@es', '-c', 'user.name=critic',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function put(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

/**
 * Build a fixture repo. `files` are written and committed; `untracked` are written and left out
 * of git entirely — which is the defect under test, so they must be created AFTER the commit and
 * never staged.
 */
function fixture(name, { files = {}, untracked = {}, ignored = null }) {
  const root = join(SCRATCH, 'gate-fixture', name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  git(root, ['init', '-q']);
  // The tool under test, byte-identical, at the path it expects (ROOT is its own dir's parent).
  put(root, 'tools/check-shipped-files.mjs', shippedSrc);
  for (const [rel, body] of Object.entries(files)) put(root, rel, body);
  if (ignored) put(root, '.gitignore', ignored);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'fixture']);
  for (const [rel, body] of Object.entries(untracked)) put(root, rel, body);
  return root;
}

function runGate(root) {
  const r = spawnSync(process.execPath, [join(root, 'tools', 'check-shipped-files.mjs')],
    { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// ---------------------------------------------------------------------------------------------
// The scenarios. `expect: 'catch'` means a correct gate exits non-zero; `expect: 'pass'` means a
// correct gate exits 0. `needle`, when given, must appear in the output of a catch.
const HTML = '<!doctype html><canvas id="view"></canvas><script type="module" src="./src/main.js"></script>';
const SCENARIOS = [
  {
    name: 'A. untracked module, really imported  (the defect that shipped)',
    expect: 'catch', needle: 'hold-gate.js',
    build: () => fixture('a-untracked', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { gate } from './input/hold-gate.js';\nexport const boot = () => gate();\n",
      },
      untracked: { 'game/src/input/hold-gate.js': 'export const gate = () => true;\n' },
    }),
  },
  {
    name: 'B. everything tracked                 (must not cry wolf)',
    expect: 'pass',
    build: () => fixture('b-clean', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { gate } from './input/hold-gate.js';\n",
        'game/src/input/hold-gate.js': 'export const gate = () => true;\n',
      },
    }),
  },
  {
    name: 'C. untracked module behind a >200-char binding list',
    expect: 'catch', needle: 'renderer-core.js',
    build: () => {
      const names = Array.from({ length: 40 }, (_, i) => `sym${i}`).join(',\n  ');
      return fixture('c-longlist', {
        files: {
          'game/index.html': HTML,
          'game/src/main.js': `import {\n  ${names}\n} from './renderer-core.js';\n`,
        },
        untracked: { 'game/src/renderer-core.js': 'export const sym0 = 1;\n' },
      });
    },
  },
  {
    name: 'D. untracked file named only by new URL(..., import.meta.url)',
    expect: 'catch', needle: 'shader.glsl',
    build: () => fixture('d-newurl', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "const u = new URL('./shader.glsl', import.meta.url);\nexport default u;\n",
      },
      untracked: { 'game/src/shader.glsl': '// shader\n' },
    }),
  },
  {
    name: 'E. untracked file referenced only by index.html <script src>',
    expect: 'catch', needle: 'boot-shim.js',
    build: () => fixture('e-html', {
      files: {
        'game/index.html': '<!doctype html><script src="./boot-shim.js"></script><script type="module" src="./src/main.js"></script>',
        'game/src/main.js': 'export const x = 1;\n',
      },
      untracked: { 'game/boot-shim.js': 'window.x = 1;\n' },
    }),
  },
  {
    name: 'F. untracked data file listed in data/index.json',
    expect: 'catch', needle: 'regions.json',
    build: () => fixture('f-data', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': 'export const x = 1;\n',
        'game/data/index.json': JSON.stringify({ files: [{ path: 'regions.json' }] }, null, 1),
      },
      untracked: { 'game/data/regions.json': '{}\n' },
    }),
  },
  {
    name: 'G. a file the game needs, excluded by .gitignore',
    expect: 'catch', needle: 'generated-atlas.js',
    build: () => fixture('g-ignored', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { a } from './generated-atlas.js';\n",
      },
      ignored: 'generated-atlas.js\n',
      untracked: { 'game/src/generated-atlas.js': 'export const a = 1;\n' },
    }),
  },
  {
    // The bare side-effect form. It carries no `from`, and the shipped SPEC regex requires one.
    // The tree has none today, which is why this is a latent gap rather than a live hole — but a
    // gate whose coverage depends on nobody ever writing `import './x.js'` is not a gate.
    name: "G2. untracked module imported side-effect-only (import './x.js')",
    expect: 'catch', needle: 'audio-shim.js',
    build: () => fixture('g2-sideeffect', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import './audio-shim.js';\nexport const x = 1;\n",
      },
      untracked: { 'game/src/audio-shim.js': 'window.audio = 1;\n' },
    }),
  },
  // ---- rule 13: shapes that must NOT block the fleet ----------------------------------------
  {
    name: 'H. a commented-out import of a file that does not exist',
    expect: 'pass',
    build: () => fixture('h-comment', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "// import { old } from './removed/legacy.js';\nexport const x = 1;\n",
      },
    }),
  },
  {
    name: "I. an import written inside a template literal (doc example)",
    expect: 'pass',
    build: () => fixture('i-template', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "export const HELP = `\nimport { a } from './not-a-real-module.js';\n`;\n",
      },
    }),
  },
  {
    // Every trap below uses the `from` form on purpose. Written as a bare `import './x.js'` they
    // would be invisible to the SPEC regex (see G2) and would pass for a reason that has nothing
    // to do with what they claim to test — rule 6's inert control, and this table had exactly
    // that defect on its first run.
    name: "J. a neighbour's untracked scratch file under game/",
    expect: 'pass',
    build: () => fixture('j-scratch', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': 'export const x = 1;\n',
      },
      untracked: { 'game/scratch-probe.mjs': "import { q } from './nowhere/at/all.js';\n" },
    }),
  },
  {
    name: 'K. an extensionless import of a directory',
    expect: 'pass',
    build: () => fixture('k-dir', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { w } from './widgets/index.js';\nimport { v } from './widgets';\n",
        'game/src/widgets/index.js': 'export const w = 1;\n',
      },
    }),
  },
  {
    name: 'L. an import specifier carrying a query string',
    expect: 'pass',
    build: () => fixture('l-query', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { a } from './atlas.js?v=2';\n",
        'game/src/atlas.js': 'export const a = 1;\n',
      },
    }),
  },
  {
    // The deploy host is case-sensitive. This machine's filesystem may not be — and if it is not,
    // `existsSync` says yes to a specifier whose case does not match the file on disk, and
    // `git ls-files` returns the real case, so the tracked-set lookup would be the only thing
    // standing between a wrong-case import and a 404 on the site.
    name: 'M. an import whose case does not match the file on disk',
    expect: 'catch', needle: 'HoldGate',
    build: () => fixture('m-case', {
      files: {
        'game/index.html': HTML,
        'game/src/main.js': "import { g } from './input/HoldGate.js';\n",
        'game/src/input/holdgate.js': 'export const g = 1;\n',
      },
    }),
  },
];

// ---------------------------------------------------------------------------------------------
if (selfTest) {
  // Rule 4 for this instrument itself. The fixture builder must be able to produce a repo whose
  // untracked file is genuinely untracked, and a repo whose files are genuinely tracked —
  // otherwise every MUST-CATCH row would be red for the wrong reason and every MUST-PASS green
  // for the wrong reason. Ask git directly, through neither the gate nor the scenario table.
  const dirty = fixture('selftest-dirty', {
    files: { 'game/src/main.js': "import './x.js';\n" },
    untracked: { 'game/src/x.js': 'export const x = 1;\n' },
  });
  const clean = fixture('selftest-clean', {
    files: { 'game/src/main.js': "import './x.js';\n", 'game/src/x.js': 'export const x = 1;\n' },
  });
  const dirtyLs = git(dirty, ['ls-files']).split('\n').filter(Boolean);
  const cleanLs = git(clean, ['ls-files']).split('\n').filter(Boolean);
  const armA = !dirtyLs.includes('game/src/x.js') && existsSync(join(dirty, 'game/src/x.js'));
  const armB = cleanLs.includes('game/src/x.js');
  // And the copy must be the shipped tool, not a stale duplicate.
  const armC = sha(readFileSync(join(dirty, 'tools/check-shipped-files.mjs'))) === shippedSha;
  const ok = armA && armB && armC;
  console.log('critic-deploy-gate-fixture --self-test:');
  console.log(`  untracked fixture is on disk and absent from git = ${armA}`);
  console.log(`  tracked fixture is present in git                = ${armB}`);
  console.log(`  the tool under test is byte-identical to shipped  = ${armC}`);
  console.log(ok ? '  PASS — the fixture can express both arms, so a red row means the gate, not the fixture.'
                 : '  FAIL — the fixture itself is broken; every row below would be meaningless.');
  process.exit(ok ? 0 : 1);
}

console.log(`critic-deploy-gate-fixture: tools/check-shipped-files.mjs @ sha256 ${shippedSha.slice(0, 12)}`);
console.log('');
let wrong = 0;
const rows = [];
for (const s of SCENARIOS) {
  const root = s.build();
  const { code, out } = runGate(root);
  const caught = code !== 0;
  const named = s.needle ? out.includes(s.needle) : true;
  const correct = s.expect === 'catch' ? (caught && named) : !caught;
  if (!correct) wrong++;
  rows.push({ name: s.name, expect: s.expect, caught, named, correct, code });
  const verdict = s.expect === 'catch'
    ? (correct ? 'CAUGHT   ' : (caught ? 'caught but did not name it' : 'MISSED   '))
    : (correct ? 'quiet    ' : 'FALSE POSITIVE');
  console.log(`  ${correct ? ' ok ' : 'GAP '} ${verdict.padEnd(28)} ${s.name}`);
  if (!correct && s.expect === 'pass') {
    for (const l of out.split('\n').filter((l) => l.trim()).slice(0, 4)) console.log(`         | ${l}`);
  }
}

const missed = rows.filter((r) => r.expect === 'catch' && !r.correct);
const falsePos = rows.filter((r) => r.expect === 'pass' && !r.correct);
console.log('');
console.log(`  detected ${rows.filter((r) => r.expect === 'catch' && r.correct).length}/${rows.filter((r) => r.expect === 'catch').length} defect shapes;`
  + ` ${falsePos.length} false positive(s) on ${rows.filter((r) => r.expect === 'pass').length} sound trees.`);
if (missed.length) {
  console.log('');
  console.log('  Shapes that reach the deployed site with the gate green:');
  for (const m of missed) console.log(`    ${m.name}`);
}
if (falsePos.length) {
  console.log('');
  console.log('  BLOCKING gate fires on a sound tree (rule 13 — this stops every agent, not the author):');
  for (const m of falsePos) console.log(`    ${m.name}`);
}
console.log('');
console.log(wrong ? `critic-deploy-gate-fixture: ${wrong} scenario(s) behaved wrongly.`
                  : 'critic-deploy-gate-fixture: the gate behaved correctly on every scenario.');
process.exit(wrong ? 1 : 0);
