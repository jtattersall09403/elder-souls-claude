#!/usr/bin/env node
// critic-deploy-r2-notice.mjs — two questions about the deploy instruments that nothing else asks.
//
//   --notice   Does the boot notice ERASE ITS OWN DIAGNOSIS? `game/index.html` hides the notice
//              unconditionally 20 s after the boot promise resolves ("Hard ceiling … an overlay
//              that cannot be dismissed is worse than a wrong diagnosis"). That ceiling was added
//              to fix the W1-DEPLOY r1 finding that the notice sat forever over a drawn dungeon.
//              But it does not exempt the `bn-bad` state, so the one case the notice exists for —
//              "the world loaded and the screen is black" — shows its diagnosis for 14 seconds and
//              then wipes it, returning the player to the silent black rectangle. Measured against
//              the REAL SHIPPED BYTES of the notice script, extracted from game/index.html, with a
//              stub harness that resolves and a canvas that never draws. Delete-the-fix arm:
//              the same page with the 20 s block removed must behave differently, or the arm is
//              inert (rule 6).
//
//   --boot     Is `verify-playable`'s control red because the game is slow, or because the tool
//              screenshots the page every two seconds while timing it? Two arms on the same build:
//              boot timed with no observation at all, and boot timed while a full-page screenshot
//              is taken every 2 s, which is what `readFrame` does inside its wait loop.
//
//   node tools/world/critic-deploy-r2-notice.mjs --notice
//   node tools/world/critic-deploy-r2-notice.mjs --boot [--reps 2]
//
// One browser, launched once and kept (rule 21). Load is printed with every figure (rule 26).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const COMMIT = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
const load = () => Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
const say = (s) => { try { fs.writeSync(1, s + '\n'); } catch { process.stdout.write(s + '\n'); } };

const HTML = fs.readFileSync(path.join(REPO_ROOT, 'game', 'index.html'), 'utf8');

/** The shipped notice, exactly: everything from <div id="boot-notice"> to the end of its IIFE. */
function noticeBytes() {
  const start = HTML.indexOf('<div id="boot-notice"');
  const styleStart = HTML.indexOf('<style>', start);
  const scriptEnd = HTML.indexOf('</script>', HTML.indexOf('<script>', start));
  if (start < 0 || styleStart < 0 || scriptEnd < 0) throw new Error('could not extract the notice from game/index.html');
  return HTML.slice(start, scriptEnd + '</script>'.length);
}

/** A page that is the real notice, a canvas that never draws, and a harness that resolves. */
function harnessPage(notice, { keepCeiling = true } = {}) {
  let body = notice;
  if (!keepCeiling) {
    // DELETE THE FIX. Remove only the 20 s hard-ceiling branch; everything else is untouched.
    const before = body;
    body = body.replace(/if \(sinceBoot > 20\) \{[^}]*\}/, '/* ceiling removed by the critic */');
    if (body === before) throw new Error('delete-the-fix did not apply — the 20 s ceiling block was not found');
  }
  return `<!doctype html><meta charset="utf-8"><title>notice</title>
<style>html,body{margin:0;background:#000;height:100%}canvas{width:100vw;height:100vh;display:block}</style>
<canvas id="view" width="640" height="360"></canvas>
${body}
<script>
  // A world that BUILDS and DRAWS NOTHING — the exact state the notice exists to report.
  // The renderer object exists (so painted() will try to read pixels), the context exists, and
  // nothing is ever drawn into it. info.render.frame never advances, so drawing() is false too.
  var c = document.getElementById('view');
  var gl = c.getContext('webgl2') || c.getContext('webgl');
  window.__ENGINE = { renderer: { three: { info: { render: { frame: 0, calls: 0 } } } } };
  window.__HARNESS = { version: 1, ready: function () { return Promise.resolve(true); } };
  window.__NOTICE_TRACE = [];
  setInterval(function () {
    var el = document.getElementById('boot-notice');
    window.__NOTICE_TRACE.push({ t: Date.now(), cls: el ? el.className : 'missing',
      text: el && el.className !== 'gone' ? (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 70) : '' });
  }, 250);
</script>`;
}

async function serveOne(html) {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
say(`critic-deploy-r2-notice: commit ${COMMIT} · load ${load()} · one browser, kept`);

if (has('--notice')) {
  const notice = noticeBytes();
  say(`\n--notice: the real notice (${notice.length} bytes from game/index.html), a harness that`);
  say('          resolves, and a canvas that never draws. 45 s per arm.\n');
  const rows = [];
  for (const keepCeiling of [true, false]) {
    const srv = await serveOne(harnessPage(notice, { keepCeiling }));
    const page = await browser.newPage();
    await page.goto(srv.origin, { waitUntil: 'load' });
    await page.waitForTimeout(45000);
    const trace = await page.evaluate(() => window.__NOTICE_TRACE);
    const t0 = trace[0].t;
    const badAt = trace.find((s) => /bn-bad/.test(s.cls));
    const goneAt = trace.find((s) => s.cls === 'gone');
    const finalRow = trace[trace.length - 1];
    rows.push({ keepCeiling, badMs: badAt ? badAt.t - t0 : null, goneMs: goneAt ? goneAt.t - t0 : null,
                finalCls: finalRow.cls, finalText: finalRow.text,
                diagnosisText: badAt ? badAt.text : '' });
    await page.close();
    srv.close();
    const r = rows[rows.length - 1];
    say(`  ${keepCeiling ? 'AS SHIPPED       ' : 'CEILING DELETED  '} accused at ${r.badMs === null ? 'never' : (r.badMs / 1000).toFixed(1) + 's'}` +
        ` · hidden at ${r.goneMs === null ? 'never' : (r.goneMs / 1000).toFixed(1) + 's'}` +
        ` · at 45 s the notice is "${r.finalCls || '(visible)'}"`);
    if (r.diagnosisText) say(`                    it said: "${r.diagnosisText}"`);
  }
  const [shipped, deleted] = rows;
  say('');
  if (shipped.goneMs !== null && deleted.goneMs === null) {
    say('  FINDING. The notice diagnoses a black screen and then ERASES IT.');
    say(`  As shipped it accuses at ${(shipped.badMs / 1000).toFixed(1)}s and wipes itself at ${(shipped.goneMs / 1000).toFixed(1)}s, leaving the`);
    say('  player looking at the silent black rectangle the notice exists to prevent. With the 20 s');
    say('  ceiling removed the diagnosis is still on the glass at 45 s — so the ceiling is what does');
    say('  it, and this control is not inert.');
  } else if (shipped.goneMs === null) {
    say('  The notice stayed up as shipped; the 20 s ceiling did not erase the diagnosis in this arm.');
  } else {
    say('  BOTH ARMS HID. The teardown is inert — do not read the shipped row as a finding (rule 6).');
  }
}

if (has('--boot')) {
  const reps = Number(at('--reps', '1'));
  const srv = await serveDir(REPO_ROOT);
  const url = srv.origin + '/game/index.html';
  say(`\n--boot: ${url}`);
  say('        two arms per rep: boot timed unobserved, and boot timed while a full-page');
  say('        screenshot is taken every 2 s (what verify-playable\'s wait loop does).\n');
  const out = [];
  for (let rep = 0; rep < reps; rep++) {
    for (const observed of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
      const l0 = load();
      const t0 = Date.now();
      await page.goto(url, { waitUntil: 'load', timeout: 180000 });
      let booted = false, shots = 0, shotFails = 0;
      while (Date.now() - t0 < 180000) {
        booted = await page.evaluate(() => {
          const H = window.__HARNESS;
          if (!H || !H.ready) return false;
          if (window.__CB === undefined) { window.__CB = null; H.ready().then(() => { window.__CB = true; }, (e) => { window.__CB = 'error'; }); }
          return window.__CB;
        }).catch(() => false);
        if (booted) break;
        if (observed) {
          try { await page.screenshot({ type: 'png' }); shots++; } catch { shotFails++; }
        }
        await page.waitForTimeout(2000);
      }
      const ms = Date.now() - t0;
      out.push({ observed, ms, booted, shots, shotFails, load0: l0, load1: load() });
      say(`  ${observed ? 'OBSERVED  ' : 'UNOBSERVED'}  boot ${booted === true ? (ms / 1000).toFixed(1) + 's' : 'NEVER (' + (ms / 1000).toFixed(0) + 's cap)'}` +
          `  screenshots ${shots} (${shotFails} failed)  load ${l0} → ${load()}`);
      await ctx.close();
    }
  }
  srv.close();
  const un = out.filter((r) => !r.observed && r.booted === true).map((r) => r.ms);
  const ob = out.filter((r) => r.observed && r.booted === true).map((r) => r.ms);
  say('');
  if (un.length && ob.length) {
    const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    say(`  unobserved boot ${(m(un) / 1000).toFixed(1)}s · observed boot ${(m(ob) / 1000).toFixed(1)}s · ` +
        `the instrument's own sampling costs ${((m(ob) - m(un)) / 1000).toFixed(1)}s (${((m(ob) / m(un) - 1) * 100).toFixed(0)}%).`);
  } else if (un.length && !ob.length) {
    say('  THE GAME BOOTS UNOBSERVED AND DOES NOT BOOT WHILE BEING SCREENSHOTTED EVERY 2 s.');
    say('  verify-playable\'s red control is its own sampling, not the build.');
  } else if (!un.length) {
    say('  The game did not boot in either arm within the cap — the build or the box, not the sampling.');
  }
}

await browser.close();
