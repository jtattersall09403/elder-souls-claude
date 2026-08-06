// Critic-owned launcher for W1-10.
//
// The build at HEAD does not boot: game/data/index.json lists `dialogue/topics/thorn.json`
// (720/1252 bytes, sha b8e7f92b08d908a7) and the file is not in the tree, so Engine._boot()
// throws `data file missing: dialogue/topics/thorn.json (404)` before window.__HARNESS
// appears. That defect belongs to the dialogue piece, not to W1-10. Rather than mutate the
// repository, this launcher serves a single synthetic 404-repair for that one route so the
// weapons piece can be measured at all. The repair is recorded in the verdict's
// method_deviations and the 404 itself is recorded as a finding against the piece that owns it.
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

export const REPAIRED_404 = 'game/data/dialogue/topics/thorn.json';

export async function launch(opts = {}) {
  const { chromium } = await loadPlaywright();
  const server = await serveDir(REPO_ROOT);
  const url = server.origin + '/game/index.html';
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.route('**/game/data/dialogue/topics/thorn.json', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ schema: 'elder-souls/topics@1', group: 'thorn', topics: [], _critic_repair: true }),
  }));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 120000 });
  const handle = {
    page, browser, context, server, url, errors,
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
    async h(method, ...a) {
      const res = await page.evaluate(async ({ m, a }) => {
        const H = window.__HARNESS;
        if (typeof H[m] !== 'function') return { __err: `__HARNESS.${m} is not a function` };
        try { return { __ok: await H[m](...a) }; } catch (e) { return { __err: `${m}() threw: ${e && e.message || e}` }; }
      }, { m: method, a });
      if (res && res.__err) throw new Error(res.__err);
      return res ? res.__ok : undefined;
    },
    ev(fn, arg) { return page.evaluate(fn, arg); },
  };
  await handle.h('ready');
  return handle;
}
