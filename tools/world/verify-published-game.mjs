#!/usr/bin/env node
// verify-published-game.mjs — does the copy under docs/play actually PLAY?
//
// `publish-game.mjs --check` proves the bytes match. That is not the same claim: the game is
// served from a different path on GitHub Pages than it is locally, and this project has shipped a
// check that compared two copies of the same wrong thing more than once. So this one loads
// docs/play/index.html over http from a *subdirectory*, waits, and asks the page whether it came
// up — a canvas with real dimensions, the harness present, and no page errors.
import { serveDir } from '../lib/serve.mjs';
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const { origin, close } = await serveDir(ROOT, { port: 0 });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 240)); });

// Deliberately a subdirectory URL, because that is what Pages will serve.
await page.goto(`${origin}/docs/play/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(12000);

const got = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { harness: typeof window.__HARNESS, canvas: !!c, w: c?.width || 0, h: c?.height || 0, title: document.title };
});
await browser.close();
await close();

const ok = got.canvas && got.w > 0 && got.h > 0 && errors.length === 0;
console.log(JSON.stringify({ ...got, errors: errors.slice(0, 6), ok }, null, 1));
console.log(ok ? 'verify-published-game: PASS — docs/play serves a live page from a subdirectory.'
              : 'verify-published-game: FAIL — see errors above.');
process.exit(ok ? 0 : 1);
