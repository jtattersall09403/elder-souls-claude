#!/usr/bin/env node
// critic-deploy-r2-imgref-fixture.mjs — run tools/playability/check-image-refs.mjs against real
// repositories that really have a broken published reference, and against ones that do not.
//
// WHY. `check-image-refs --self-test` calls `sweep()` on two hand-built rows. `PAGES()`,
// `refsInHtml()`, `refsInMarkdown()` and `resolve()` — the half of the tool that decides WHICH
// references get checked — are never executed by either arm. That is the same shape the W1-DEPLOY
// r1 verdict found in `check-shipped-files --self-test` ("the scanner is not executed by either
// arm"), one directory over. A tool whose extractor has no arm can be blind to an entire syntax
// and still print PASS.
//
// So: a throwaway git repository per scenario, with a BYTE-IDENTICAL copy of the tool (sha256
// checked against the original on every run), a local HTTP server standing in for the deployed
// host via the tool's own `--url` flag, and one real published page carrying one real reference.
// Every path through PAGES/refsIn*/resolve/sweep/exit runs for real.
//
//   node tools/world/critic-deploy-r2-imgref-fixture.mjs
//
// Exit 1 if any scenario behaved wrongly. A scenario is `catch` (the tool must exit 1 and name the
// path) or `quiet` (the tool must exit 0).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

/** Run a child WITHOUT blocking this process's event loop — the fixture's own HTTP server lives
 *  here, and `spawnSync` would freeze it so every curl inside the tool would time out and every
 *  scenario would read as a false positive. (It did, on the first run of this file.) */
function run(cmd, args, opts) {
  return new Promise((res) => {
    const c = spawn(cmd, args, { ...opts, encoding: 'utf8' });
    let out = '', err = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('close', (status) => res({ status, stdout: out, stderr: err }));
  });
}
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const TOOL = join(ROOT, 'tools', 'playability', 'check-image-refs.mjs');
const SRC = readFileSync(TOOL);
const SHA = createHash('sha256').update(SRC).digest('hex');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

/** A real git repo with the tool in it, plus whatever the scenario writes. */
function repo(build) {
  const dir = mkdtempSync(join(tmpdir(), 'imgref-critic-w1-deploy-r2-'));
  const w = (rel, body) => {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  };
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'c@example.com');
  git('config', 'user.name', 'critic');
  w('tools/playability/check-image-refs.mjs', SRC);
  // The four fixed pages the tool always looks at, minimal but real.
  w('index.html', '<html><body><p>landing</p></body></html>');
  w('docs/index.html', '<html><body><p>blog</p></body></html>');
  w('docs/progress.html', '<html><body><p>progress</p></body></html>');
  w('README.md', '# readme\n');
  w('docs/shots/real.png', PNG);
  build({ w, git, dir });
  return { dir, git };
}

/** Serve every TRACKED file at HEAD, so "live" means "committed and published". */
async function serveTracked(dir) {
  const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'],
    { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean));
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.replace(/^\/+/, '').split('?')[0]);
    if (tracked.has(rel) && existsSync(join(dir, rel))) {
      res.writeHead(200); res.end(readFileSync(join(dir, rel)));
    } else { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}

const SCENARIOS = [
  { id: 'A. <img src> at an untracked file (the wld12 defect)', want: 'catch', build: ({ w, git }) => {
      w('index.html', '<html><body><img src="docs/shots/ghost.png"></body></html>');
      w('docs/shots/ghost.png', PNG);            // on disk, never committed
      git('add', 'tools', 'index.html', 'docs/index.html', 'docs/progress.html', 'README.md', 'docs/shots/real.png');
      git('commit', '-qm', 'x');
    } },
  { id: 'B. every reference tracked and served (must not cry wolf)', want: 'quiet', build: ({ w, git }) => {
      w('index.html', '<html><body><img src="docs/shots/real.png"></body></html>');
      git('add', '-A'); git('commit', '-qm', 'x');
    } },
  { id: 'C. reference into a gitignored directory', want: 'catch', build: ({ w, git }) => {
      w('index.html', '<html><body><img src="reports/blind/f12.png"></body></html>');
      w('reports/.gitignore', '*\n!.gitignore\n');
      w('reports/blind/f12.png', PNG);
      git('add', 'tools', 'index.html', 'docs', 'README.md', 'reports/.gitignore');
      git('commit', '-qm', 'x');
    } },
  { id: 'D. CSS url() in a <style> block, untracked target', want: 'catch', build: ({ w, git }) => {
      w('index.html', '<html><head><style>body{background-image:url(docs/shots/ghost.png)}</style></head><body>x</body></html>');
      w('docs/shots/ghost.png', PNG);
      git('add', 'tools', 'index.html', 'docs/index.html', 'docs/progress.html', 'README.md', 'docs/shots/real.png');
      git('commit', '-qm', 'x');
    } },
  { id: 'E. <img srcset> naming an untracked file', want: 'catch', build: ({ w, git }) => {
      w('index.html', '<html><body><img srcset="docs/shots/ghost.png 2x" src="docs/shots/real.png"></body></html>');
      w('docs/shots/ghost.png', PNG);
      git('add', 'tools', 'index.html', 'docs/index.html', 'docs/progress.html', 'README.md', 'docs/shots/real.png');
      git('commit', '-qm', 'x');
    } },
  { id: 'F. root-relative src at an untracked file', want: 'catch', build: ({ w, git }) => {
      w('index.html', '<html><body><img src="/docs/shots/ghost.png"></body></html>');
      w('docs/shots/ghost.png', PNG);
      git('add', 'tools', 'index.html', 'docs/index.html', 'docs/progress.html', 'README.md', 'docs/shots/real.png');
      git('commit', '-qm', 'x');
    } },
  { id: 'G. raw <img> HTML inside a markdown post', want: 'catch', build: ({ w, git }) => {
      w('docs/blog/p.md', '# post\n\n<img src="../shots/ghost.png">\n');
      w('docs/shots/ghost.png', PNG);
      git('add', 'tools', 'index.html', 'docs/index.html', 'docs/progress.html', 'README.md', 'docs/shots/real.png', 'docs/blog/p.md');
      git('commit', '-qm', 'x');
    } },
  { id: 'H. a link to a directory (a sound landing page)', want: 'quiet', build: ({ w, git }) => {
      w('index.html', '<html><body><a href="game/">Play</a><img src="docs/shots/real.png"></body></html>');
      w('game/index.html', '<html><body>game</body></html>');
      git('add', '-A'); git('commit', '-qm', 'x');
    } },
  { id: 'I. an image committed one minute ago, host not yet rebuilt', want: 'quiet', build: ({ w, git }) => {
      // Sound tree: tracked, on disk, correct reference. The ONLY thing wrong is that the static
      // host has not published it yet — the normal state for ~1 minute after every push.
      w('index.html', '<html><body><img src="docs/shots/fresh.png"></body></html>');
      w('docs/shots/fresh.png', PNG);
      git('add', '-A'); git('commit', '-qm', 'x');
    }, hideFromHost: ['docs/shots/fresh.png'] },
];

let wrong = 0;
console.log(`critic-deploy-r2-imgref-fixture: tools/playability/check-image-refs.mjs @ sha256 ${SHA.slice(0, 12)}\n`);
const rows = [];
for (const s of SCENARIOS) {
  const { dir } = repo(s.build);
  const host = await serveTracked(dir);
  const origHandler = host;
  let base = host.origin;
  if (s.hideFromHost) {
    // Re-serve with those paths withheld, standing in for "Pages has not finished building".
    host.close();
    const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'],
      { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean).filter((p) => !s.hideFromHost.includes(p)));
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.replace(/^\/+/, '').split('?')[0]);
      if (tracked.has(rel) && existsSync(join(dir, rel))) { res.writeHead(200); res.end(readFileSync(join(dir, rel))); }
      else { res.writeHead(404); res.end('no'); }
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.address().port}/`;
    origHandler.close = () => srv.close();
  }
  const r = await run('node', [join(dir, 'tools/playability/check-image-refs.mjs'), '--url', base],
    { cwd: dir });
  origHandler.close();
  const out = (r.stdout || '') + (r.stderr || '');
  const fired = r.status === 1;
  const ok = s.want === 'catch' ? fired : !fired;
  if (!ok) wrong++;
  const label = s.want === 'catch' ? (fired ? ' ok  CAUGHT' : 'GAP  MISSED') : (fired ? 'GAP  FALSE POSITIVE' : ' ok  quiet');
  rows.push({ id: s.id, want: s.want, fired, ok, label });
  console.log(`  ${label.padEnd(20)} ${s.id}`);
  if (!ok) for (const l of out.split('\n').filter((l) => /→|broken reference|PASS —/.test(l)).slice(0, 3)) console.log(`         | ${l.trim()}`);
  rmSync(dir, { recursive: true, force: true });
}

const catches = rows.filter((r) => r.want === 'catch');
const quiets = rows.filter((r) => r.want === 'quiet');
console.log(`\n  detected ${catches.filter((r) => r.ok).length}/${catches.length} broken-reference shapes; ` +
            `${quiets.filter((r) => !r.ok).length} false positive(s) on ${quiets.length} sound tree(s).`);
const missed = catches.filter((r) => !r.ok);
if (missed.length) {
  console.log('\n  Broken references that reach a reader with the check green:');
  for (const m of missed) console.log(`    ${m.id}`);
}
const fp = quiets.filter((r) => !r.ok);
if (fp.length) {
  console.log('\n  Fires on a sound tree:');
  for (const m of fp) console.log(`    ${m.id}`);
}
console.log(wrong ? `\ncritic-deploy-r2-imgref-fixture: ${wrong} scenario(s) behaved wrongly.`
                  : '\ncritic-deploy-r2-imgref-fixture: every scenario behaved correctly.');
process.exit(wrong ? 1 : 0);
