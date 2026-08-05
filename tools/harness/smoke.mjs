#!/usr/bin/env node
// smoke.mjs — prove the measurement environment itself works: Playwright can drive
// headless Chromium, WebGL is available, and a screenshot round-trips through pngjs.
// This must pass BEFORE any verdict is trusted. It does not touch the game.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseArgs, wantsHelp, usage, die, log, EXIT, ensureDir, writeJson, REPORTS_DIR } from '../lib/cli.mjs';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const USAGE = `
smoke.mjs — environment self-test for the measurement harness.

USAGE
  node tools/harness/smoke.mjs [--out <file>] [--keep]

OPTIONS
  --out <path>  Where to write the smoke report (default: reports/harness-smoke.json)
  --keep        Keep the rendered PNG next to the report
  --help        This message

CHECKS
  1. playwright imports
  2. chromium launches headless from PLAYWRIGHT_BROWSERS_PATH (never installs anything)
  3. a page renders, WebGL2 context is obtainable, renderer string is reported
  4. page.screenshot() produces a PNG that pngjs can decode and that has >1 unique colour
  5. requestAnimationFrame can be driven deterministically from the test side

Exit 0 = the harness environment is usable. Any non-zero exit means every measurement
taken on this machine is suspect.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const report = {
  schema: 'elder-souls/harness-smoke@1',
  at: new Date().toISOString(),
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpus: os.cpus().length,
  playwright_browsers_path: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
  checks: [],
  ok: false,
};
const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); return ok; };

const pw = await loadPlaywright();
check('playwright imports', true, `v${(await import('playwright/package.json', { with: { type: 'json' } }).catch(() => ({ default: {} }))).default?.version || 'unknown'}`);

let browser;
try {
  browser = await pw.chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
} catch (e) {
  check('chromium launches', false, e.message);
  writeJson(args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'harness-smoke.json'), report);
  die(EXIT.INTERNAL, 'Chromium did not launch: ' + e.message);
}
check('chromium launches', true, browser.version());

const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.setContent(`
  <body style="margin:0;background:#101820">
    <canvas id="c" width="640" height="360" style="display:block"></canvas>
    <div style="position:fixed;top:20px;left:20px;font:600 28px sans-serif;color:#ffcc33">HARNESS SMOKE</div>
    <div style="position:fixed;top:70px;left:20px;width:300px;height:120px;background:linear-gradient(90deg,#204060,#a0d8c0)"></div>
    <script>
      const cv = document.getElementById('c');
      const opts = { preserveDrawingBuffer: true, antialias: false };
      const gl = cv.getContext('webgl2', opts) || cv.getContext('webgl', opts);
      window.__GL = null;
      if (gl) {
        const d = gl.getExtension('WEBGL_debug_renderer_info');
        window.__GL = { version: gl.getParameter(gl.VERSION),
                        renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown',
                        webgl2: !!document.createElement('canvas').getContext('webgl2') };
        gl.clearColor(0.13, 0.42, 0.36, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      }
      window.__RAF = 0;
      (function tick(){ window.__RAF++; requestAnimationFrame(tick); })();
    </script>
  </body>`);
const gl = await page.evaluate(() => window.__GL);
check('webgl context', !!gl, gl ? `${gl.version} | ${gl.renderer}` : 'no context — fidelity metrics cannot be taken');

const shotPath = path.join(REPORTS_DIR, 'harness-smoke.png');
ensureDir(REPORTS_DIR);
await page.screenshot({ path: shotPath, type: 'png' });
let colours = 0, decoded = false;
try {
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(fs.readFileSync(shotPath));
  decoded = true;
  const s = new Set();
  for (let i = 0; i < png.data.length; i += 4) s.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
  colours = s.size;
} catch (e) { check('pngjs decodes screenshot', false, e.message); }
if (decoded) check('pngjs decodes screenshot', true, `${colours} unique colours`);
check('screenshot is not blank', colours > 1, `${colours} unique colours`);

const raf1 = await page.evaluate(() => window.__RAF);
await page.waitForTimeout(120);
const raf2 = await page.evaluate(() => window.__RAF);
check('requestAnimationFrame runs', raf2 > raf1, `${raf1} -> ${raf2}`);

await browser.close();
if (!args.keep) { try { fs.unlinkSync(shotPath); } catch { /* ignore */ } }

report.webgl = gl;
report.ok = report.checks.every((c) => c.ok);
const outPath = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'harness-smoke.json');
writeJson(outPath, report);
process.stdout.write(outPath + '\n');
process.exit(report.ok ? EXIT.OK : EXIT.INTERNAL);
