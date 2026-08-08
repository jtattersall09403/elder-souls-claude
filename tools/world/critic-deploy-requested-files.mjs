#!/usr/bin/env node
// critic-deploy-requested-files.mjs — every file the running game actually asks for must be in git.
//
// THE CLASS THIS ANSWERS. `tools/check-shipped-files.mjs` finds the files the game needs by
// running one regex over source text. Measured against this tree (see
// `tools/world/critic-deploy-scan-coverage.mjs`), that regex does not see:
//
//   * `game/vendor/three/three.module.js` importing `./three.core.js` — the renderer, the largest
//     file in the game — because the binding list in front of `from` is longer than its 200-char
//     window; likewise `./sim/camera.js` and `./sim/stealth/system.js` from `engine.js`;
//   * `new URL('../data/', import.meta.url)` in `engine.js`, which is how the data root is built;
//   * anything `game/index.html` names directly, including `<script src>`;
//   * a bare side-effect `import './x.js'`, which carries no `from` at all.
//
// Every one of those is a file that can be present here, absent in the repo, and 404 on the
// deployed site — which is the exact defect the gate was written for. Widening the regex trades
// one blind spot for the next; a parser would trade it for a different next.
//
// So this does not parse anything. It **runs the game and writes down what it asks the server
// for**, then requires every one of those paths to be tracked by git. Syntax is irrelevant to it:
// a module, a `new URL`, a worker, an image, a font, a fetch built at runtime and an `<img src>`
// all arrive at the server as a GET, and a GET is what it records.
//
// It cannot see a file that only some *other* run would request — a lazy import behind a menu, an
// asset for a region the player never walks into. That is a real limit and it is why this belongs
// ALONGSIDE the static gate rather than instead of it: the static one covers paths never taken,
// this one covers syntax never parsed. Neither is a superset.
//
//   node tools/world/critic-deploy-requested-files.mjs
//   node tools/world/critic-deploy-requested-files.mjs --dir <path>   # e.g. a pinned checkout
//   node tools/world/critic-deploy-requested-files.mjs --self-test
//
// Exit 1 naming any requested path that git does not have. Exit 2 if the game did not come up, in
// which case it has measured nothing and says so rather than passing.
import { chromium } from 'playwright';
import { serveDir } from '../lib/serve.mjs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const selfTest = argv.includes('--self-test');
const SCRATCH = process.env.ES_SCRATCH
  || '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad';

// Which directory is served, and which repo prefix its files live under. `game/` is the source;
// a pinned checkout is served from elsewhere but still maps onto `game/` in the repository.
const DIR = at('--dir', join(ROOT, 'game'));
const PREFIX = at('--prefix', 'game');

const tracked = new Set(
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean));

// Walk the game far enough to pull in more than the boot path: enter an interior, open the
// journal, step the sim. Every extra surface touched is a lazy asset this can see.
async function exercise(page) {
  const steps = [];
  const tryIt = async (label, fn) => { try { await fn(); steps.push(label); } catch { steps.push(label + ' (skipped)'); } };
  await tryIt('ready', () => page.evaluate(async () => {
    for (let i = 0; i < 900 && !window.__HARNESS; i++) await new Promise((r) => setTimeout(r, 100));
    await window.__HARNESS.ready();
  }));
  await tryIt('step 600', () => page.evaluate(() => window.__HARNESS.stepFrames(600)));
  await tryIt('night', () => page.evaluate(() => { window.__HARNESS.setTimeOfDay(0); window.__HARNESS.stepFrames(120); }));
  await tryIt('interior', () => page.evaluate(() => { window.__HARNESS.enterInterior('1'); window.__HARNESS.stepFrames(120); }));
  return steps;
}

const { origin, close } = await serveDir(DIR, { port: 0 });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });

/** Load the page (optionally with an extra request injected) and return every path it asked for. */
async function collect({ injectPath = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const asked = new Set();
  const statuses = new Map();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin) return;          // only what this server was asked for
    asked.add(decodeURIComponent(u.pathname).replace(/^\//, '').replace(/\?.*$/, ''));
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === origin) statuses.set(decodeURIComponent(u.pathname).replace(/^\//, ''), r.status());
  });
  if (injectPath) {
    await page.addInitScript(`window.addEventListener('DOMContentLoaded', function () {
      fetch(${JSON.stringify(injectPath)}).catch(function () {});
    });`);
  }
  await page.goto(`${origin}/index.html`, { waitUntil: 'load', timeout: 180000 });
  const steps = await exercise(page);
  await page.waitForTimeout(2000);
  const drew = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 0;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 0;
    const b = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, b);
    let n = 0, s = 0;
    for (let px = 0; px < c.width * c.height; px += 64) { const i = px * 4; s++; if (b[i] > 8 || b[i+1] > 8 || b[i+2] > 8) n++; }
    return s ? n / s : 0;
  }).catch(() => 0);
  await ctx.close();
  return { asked: [...asked].sort(), statuses, steps, drew };
}

try {
  if (selfTest) {
    // Rule 4, and the arm that has to exist is the one the shipped gate's self-test lacks: a real
    // request for a real path that git really does not have, which this must report. The injected
    // path is written to disk first — so the server serves it and the browser really fetches it —
    // and it is never added to git, so it is genuinely untracked. Then the same run without the
    // injection must come back clean, or every finding would be an artifact of the observer.
    const ghost = `__critic-ghost-${Date.now()}.json`;
    writeFileSync(join(DIR, ghost), '{"ghost":true}\n');
    let dirty, clean;
    try {
      dirty = await collect({ injectPath: './' + ghost });
      clean = await collect();
    } finally {
      try { (await import('node:fs')).rmSync(join(DIR, ghost)); } catch { /* leave nothing behind */ }
    }
    const relOf = (p) => `${PREFIX}/${p}`;
    const dirtyUntracked = dirty.asked.filter((p) => !tracked.has(relOf(p)));
    const cleanUntracked = clean.asked.filter((p) => !tracked.has(relOf(p)));
    const armA = dirtyUntracked.includes(ghost);           // the planted file is caught
    const armB = cleanUntracked.length === 0;              // and a sound tree is quiet
    const armC = dirty.drew > 0.02 && clean.drew > 0.02;   // both runs actually ran the game
    const ok = armA && armB && armC;
    console.log('critic-deploy-requested-files --self-test:');
    console.log(`  a real, really-fetched, really-untracked file is reported = ${armA}`);
    console.log(`  the same run without it is clean                          = ${armB}`
      + (armB ? '' : ` (${cleanUntracked.slice(0, 5).join(', ')})`));
    console.log(`  the game drew in both arms (${(dirty.drew * 100).toFixed(0)}% / ${(clean.drew * 100).toFixed(0)}%) = ${armC}`);
    console.log(ok ? '  PASS — it detects an untracked file the game really asked for.'
                   : '  FAIL — see the arm above; a red arm here voids every run.');
    await browser.close(); await close();
    process.exit(ok ? 0 : 1);
  }

  const { asked, statuses, steps, drew } = await collect();
  const untracked = [], missing = [];
  for (const p of asked) {
    const rel = `${PREFIX}/${p}`;
    const code = statuses.get(p);
    if (code && code >= 400) { missing.push(`${code} ${rel}`); continue; }
    if (!tracked.has(rel)) untracked.push(rel);
  }

  mkdirSync(join(SCRATCH, 'critic-deploy'), { recursive: true });
  writeFileSync(join(SCRATCH, 'critic-deploy', 'requested.json'),
    JSON.stringify({ dir: DIR, drew, steps, count: asked.length, asked, untracked, missing }, null, 1));

  console.log(`critic-deploy-requested-files: served ${DIR.replace(ROOT + '/', '')}`);
  console.log(`  surfaces exercised: ${steps.join(', ')}`);
  console.log(`  the running game asked this server for ${asked.length} distinct path(s); the frame is ${(drew * 100).toFixed(1)}% lit.`);

  if (drew < 0.02) {
    console.log('');
    console.log('critic-deploy-requested-files: NOT RUN — the build under test drew nothing, so the');
    console.log('  request list is the boot prefix rather than the game. Fix the build and re-run.');
    process.exit(2);
  }

  // What the static gate would and would not have covered, for the same file list.
  const notImport = asked.filter((p) => !/\.m?js$/.test(p));
  console.log(`  of those, ${notImport.length} are not JavaScript at all, so no import scanner reaches them.`);

  if (missing.length) {
    console.error('');
    console.error(`critic-deploy-requested-files: ${missing.length} request(s) did not return 200:`);
    for (const m of missing.slice(0, 20)) console.error(`  ${m}`);
  }
  if (untracked.length) {
    console.error('');
    console.error(`critic-deploy-requested-files: ${untracked.length} file(s) the RUNNING game asked for are not in git:`);
    for (const u of untracked.slice(0, 30)) console.error(`  ${u}`);
    console.error('');
    console.error('  Each of these works here and 404s on the deployed site. This is the same defect');
    console.error('  class as game/src/input/hold-gate.js, found by watching rather than by parsing.');
  }
  if (!missing.length && !untracked.length) {
    console.log('');
    console.log(`critic-deploy-requested-files: PASS — all ${asked.length} requested path(s) returned 200 and are tracked.`);
  }
  process.exit(missing.length || untracked.length ? 1 : 0);
} finally {
  await browser.close();
  await close();
}
