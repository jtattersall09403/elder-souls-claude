// Boots the game in headless Chromium and hands back a live handle to window.__HARNESS.
// Spec: corpus/80-methods/HARNESS.md §2 (headless run contract), §3 (harness API).
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from './serve.mjs';
import { EXIT, die, log, GAME_DIR, REPO_ROOT, HARNESS_API_VERSION } from './cli.mjs';

/** Chromium flags that make rendering reproducible run-to-run and machine-to-machine. */
export const DETERMINISTIC_CHROMIUM_ARGS = [
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--disable-skia-runtime-opts',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-partial-raster',
  '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
];

/**
 * Hardware-backed counterpart used only when a caller explicitly requests `--hardware-gpu`.
 * Keep the deterministic presentation flags, but remove every software-backend request and pin
 * ANGLE to Windows D3D11. The page-side renderer string is still independently attested by the
 * W1-30 live tools; these flags request hardware but are not, by themselves, evidence of it.
 */
export const HARDWARE_CHROMIUM_ARGS = [
  ...DETERMINISTIC_CHROMIUM_ARGS.filter((arg) =>
    arg !== '--enable-unsafe-swiftshader' && arg !== '--use-angle=swiftshader'),
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--use-angle=d3d11',
  '--force_high_performance_gpu',
];

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (e) {
    die(EXIT.INTERNAL,
      "cannot import 'playwright'. Run `npm install` in tools/ " +
      '(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 — browsers are preinstalled at /opt/pw-browsers). ' +
      'Never run `playwright install`.', { cause: e.message });
  }
}

/**
 * Resolve the entry point to load.
 *  --url http://...        → use as-is, no static server
 *  --entry <path to html>  → serve its directory root
 *  default                 → game/index.html served from game/
 */
export function resolveEntry(args) {
  if (args.url) return { kind: 'url', url: String(args.url) };
  const entry = args.entry ? path.resolve(String(args.entry)) : path.join(GAME_DIR, 'index.html');
  if (!fs.existsSync(entry)) {
    die(EXIT.MISSING_GAME,
      `game entry point not found: ${entry}\n` +
      '  The game has not been built yet, or you are pointing at the wrong path.\n' +
      '  Expected: game/index.html (see corpus/80-methods/HARNESS.md §2).\n' +
      '  To self-test the harness against the stub fixture, pass:\n' +
      '    --entry tools/harness/stub/index.html');
  }
  // Serve from the repo root when the entry lives inside it, so /game/data/** is reachable.
  const root = entry.startsWith(REPO_ROOT + path.sep) ? REPO_ROOT : path.dirname(entry);
  return { kind: 'file', entry, root, route: '/' + path.relative(root, entry).split(path.sep).join('/') };
}

/**
 * Launch the game.
 * @returns {Promise<{page, browser, server, origin, url, console:Array, errors:Array, close:Function, h:Function}>}
 */
export async function launchGame(args = {}) {
  const { chromium } = await loadPlaywright();
  const width = Number(args.width || 1920);
  const height = Number(args.height || 1080);
  const timeout = Number(args.timeout || 60000);
  const entry = resolveEntry(args);

  let server = null, url = entry.url;
  if (entry.kind === 'file') {
    server = await serveDir(entry.root);
    url = server.origin + entry.route;
  }

  // The exact flag list handed to Chromium, kept on the handle. TOOL-COVERAGE-R2 §3: the T1 gate
  // asked the PAGE what renderer it had, and the page is the side under test — twenty lines
  // patching `getParameter` turned SwiftShader into an RTX 4070. `--use-angle=swiftshader` lives
  // here, Node-side, where nothing running in the page can reach it. A gate that consults this
  // cannot be spoofed from inside the browser.
  const hardwareGpuRequested = args.hardwareGpu === true || args['hardware-gpu'] === true
    || String(args.gpu || '').toLowerCase() === 'hardware';
  const launchArgs = Array.isArray(args.chromiumArgs) ? args.chromiumArgs.map(String)
    : (hardwareGpuRequested ? HARDWARE_CHROMIUM_ARGS : DETERMINISTIC_CHROMIUM_ARGS).slice();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: launchArgs,
      executablePath: args.chromium ? String(args.chromium) : undefined,
    });
  } catch (e) {
    if (server) await server.close();
    die(EXIT.INTERNAL,
      'failed to launch Chromium. PLAYWRIGHT_BROWSERS_PATH must be /opt/pw-browsers and the ' +
      'browser must already be installed there (do NOT run `playwright install`).',
      { cause: e.message });
  }

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-GB',
    timezoneId: 'UTC',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleLog = [];
  const errors = [];
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => errors.push({ kind: 'pageerror', message: String(e && e.message || e), stack: String(e && e.stack || '') }));
  page.on('requestfailed', (r) => errors.push({ kind: 'requestfailed', url: r.url(), failure: r.failure()?.errorText }));

  // Freeze wall-clock sources the simulation must never read anyway; if the game *does*
  // read them, this makes the resulting non-determinism loud instead of subtle.
  await page.addInitScript(() => {
    window.__HARNESS_EXPECTED = true;
    window.__HARNESS_ENV = { headless: true, fixedStepHz: 60 };
  });

  // `args.initScripts` — source strings installed BEFORE the goto, so they are in place before
  // the game's own scripts run. Added in tool round 2: gamepad-shim.mjs needs to replace
  // `navigator.getGamepads` above the seam `RealInput.pollGamepad()` reads, and the previous
  // way of getting there — launch, install, then `page.reload({ waitUntil: 'load' })` — hung on
  // the reload in 3 of 3 attempts and killed the tool (TOOL-COVERAGE-R1 §2). A pre-goto hook
  // has no reload in it at all. Optional and additive: callers that pass nothing are unchanged.
  for (const src of (Array.isArray(args.initScripts) ? args.initScripts : [])) {
    await page.addInitScript(String(src));
  }

  const handle = {
    page, browser, context, server, url,
    /** Node-side truth about how this browser was launched. See the comment at the launch call. */
    chromiumArgs: launchArgs,
    hardwareGpuRequested,
    console: consoleLog, errors,
    async close() {
      try { await context.close(); } catch { /* ignore */ }
      try { await browser.close(); } catch { /* ignore */ }
      if (server) await server.close();
    },
    /** Call a method on window.__HARNESS with args, surfacing in-page throws as tool errors. */
    async h(method, ...callArgs) {
      const res = await page.evaluate(async ({ m, a }) => {
        const H = window.__HARNESS;
        if (!H) return { __err: 'window.__HARNESS is not defined' };
        if (typeof H[m] !== 'function') return { __err: `window.__HARNESS.${m} is not a function` };
        try { return { __ok: await H[m](...a) }; }
        catch (e) { return { __err: `${m}() threw: ${e && e.message || e}`, __stack: String(e && e.stack || '') }; }
      }, { m: method, a: callArgs });
      if (res && res.__err) die(EXIT.HARNESS_ERROR, res.__err, res.__stack ? { stack: res.__stack } : undefined);
      return res ? res.__ok : undefined;
    },
    /** Optional method: returns undefined instead of dying when absent. */
    async hOpt(method, ...callArgs) {
      const present = await page.evaluate((m) => !!(window.__HARNESS && typeof window.__HARNESS[m] === 'function'), method);
      if (!present) return undefined;
      return handle.h(method, ...callArgs);
    },
  };

  try {
    await page.goto(url, { waitUntil: 'load', timeout });
  } catch (e) {
    const errs = errors.slice(0, 5);
    await handle.close();
    die(EXIT.MISSING_GAME, `failed to load ${url}: ${e.message}`, { pageErrors: errs });
  }

  // The single seam: window.__HARNESS must appear within `timeout`.
  try {
    await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout });
  } catch {
    const errs = errors.slice(0, 5);
    const cons = consoleLog.slice(-10);
    await handle.close();
    die(EXIT.HARNESS_ABSENT,
      `window.__HARNESS never appeared at ${url} within ${timeout}ms.\n` +
      '  The game MUST expose the automation API described in corpus/80-methods/HARNESS.md §3.\n' +
      '  Without it, no combat, world or fidelity measurement in this corpus can be taken.',
      { pageErrors: errs, console: cons });
  }

  const version = await page.evaluate(() => window.__HARNESS.version);
  if (Number(version) !== HARNESS_API_VERSION) {
    log(`WARNING: window.__HARNESS.version = ${version}, tools expect ${HARNESS_API_VERSION}`);
  }

  // Wait for the game's own readiness gate (assets streamed, first world loaded).
  if (await page.evaluate(() => typeof window.__HARNESS.ready === 'function')) {
    await page.evaluate((t) => Promise.race([
      window.__HARNESS.ready(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ready() timeout')), t)),
    ]), timeout).catch((e) => die(EXIT.HARNESS_ERROR, 'harness ready() failed: ' + e.message));
  }

  handle.harnessVersion = version;
  handle.buildInfo = (await handle.hOpt('getBuildInfo')) || null;
  return handle;
}

/** Assert the game implements every method the caller is about to use. Fail-closed. */
export async function requireMethods(handle, methods) {
  const missing = await handle.page.evaluate(
    (ms) => ms.filter((m) => typeof (window.__HARNESS || {})[m] !== 'function'), methods);
  if (missing.length) {
    die(EXIT.HARNESS_ABSENT,
      `window.__HARNESS is missing required method(s): ${missing.join(', ')}. ` +
      'See corpus/80-methods/HARNESS.md §3 — these are mandatory, not optional.',
      { missing });
  }
}
