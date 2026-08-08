#!/usr/bin/env node
// Does the boot notice appear OVER A WORKING GAME?
//
// This is the third time that question has had to be asked, and the answer has been "yes" twice.
//   1. `painted()` first read `readPixels(0, 0, 64, 64)` — 1.2% of the frame, in the corner. A
//      correctly drawn dungeon is 33% lit overall and 0.02% in that corner, so the notice never
//      hid: an undismissable overlay over a working game, shipped as the fix for a black screen.
//      Fixed by sampling a grid across the whole frame.
//   2. Then a52113c turned `preserveDrawingBuffer` OFF for players — correct, and the right call —
//      and `painted()` still reads the game's own drawing buffer with `readPixels`, from a
//      `setInterval` rather than from inside a frame. With the buffer not preserved, that read is
//      specified to be undefined after compositing and is zero in practice. The grid fix does not
//      matter: every cell reads black on a game drawing perfectly.
//
// The instrument that grades playability was moved to a screenshot for exactly this reason. The
// SHIPPED PAGE was not. That asymmetry is what this tool measures.
//
// It watches the notice for a long time AFTER boot resolves, because the failure does not exist at
// the instant every other check stops looking: the notice's own timer needs `sinceBoot > 6`, and
// verify-playable's last sample is ~3-4 s after boot. Rule 8, in the small.
//
//   node tools/playability/notice-over-game.mjs                 # local tree, desktop + phone
//   node tools/playability/notice-over-game.mjs --live          # the deployed bytes
//   node tools/playability/notice-over-game.mjs --self-test     # rule 4: must go red on demand
//
// Rule 4: `--self-test` has three arms that must disagree with each other.
//   * CONTROL      the page as shipped.
//   * FORCE-BLACK  the renderer is stopped after boot, so the screen really IS black and the
//                  notice is CORRECT to appear. This tool must NOT call that a defect.
//   * FORCE-PAINT  `painted()` is replaced with one that reads a screenshot-equivalent (a 2-D
//                  canvas copy), i.e. the fix. The notice must then stay hidden.
// If the control agrees with force-paint, this tool is measuring nothing.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { serveDir } from '../lib/serve.mjs';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';
import { serveLive, OWNER_LINKS, LIVE_BASE } from './live-mirror.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIVE = has('--live');
const SELF_TEST = has('--self-test');
const WATCH_MS = Number(at('--watch-ms', 32000));
const CAP_MS = Number(at('--cap-ms', 240000));
const SHOTS = at('--shots', null);
const JSON_OUT = at('--json', null);
const DATE = new Date().toISOString().slice(0, 10);
const COMMIT = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { return '?'; } })();
const say = (s) => { try { fs.writeSync(1, s + '\n'); } catch { process.stdout.write(s + '\n'); } };

const PROFILES = [
  { id: 'desktop-1440',         w: 1440, h: 900, dpr: 1, touch: false },
  { id: 'phone-small-portrait', w: 360,  h: 740, dpr: 3, touch: true },
];
const ONLY = at('--profiles', '').split(',').map((s) => s.trim()).filter(Boolean);
const profiles = ONLY.length ? PROFILES.filter((p) => ONLY.includes(p.id)) : PROFILES;

// What the page says about itself, read from the DOM. The overlay is HTML, so this needs no
// pixels at all — but we take a screenshot too, because "the notice is up" only matters as a
// defect when the thing underneath it is a working picture.
const READ = () => {
  const n = document.getElementById('boot-notice');
  const visible = !!n && n.className !== 'gone' && getComputedStyle(n).display !== 'none';
  const cs = n ? getComputedStyle(n) : null;
  return {
    visible,
    bad: visible && /bn-bad/.test(n.className || ''),
    text: visible ? (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '',
    // An overlay at inset:0 with z-index 9999 and no `pointer-events:none` eats every tap and
    // click underneath it. That is the difference between "an ugly message" and "cannot play".
    blocksInput: visible && cs ? cs.pointerEvents !== 'none' : false,
    // What painted() itself would return right now, computed the same way the page does it, so
    // the diagnosis names the mechanism rather than the symptom.
    paintedSays: (() => {
      try {
        const c = document.querySelector('canvas');
        if (!c) return 'no-canvas';
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return 'no-gl';
        const a = gl.getContextAttributes ? gl.getContextAttributes() : null;
        let lit = 0, seen = 0; const row = new Uint8Array(4);
        for (let y = 4; y < c.height; y += 24) for (let x = 4; x < c.width; x += 24) {
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
          seen++; if (row[0] > 8 || row[1] > 8 || row[2] > 8) lit++;
        }
        return `pdb=${a && a.preserveDrawingBuffer ? 1 : 0} readPixels-lit=${lit}/${seen}`;
      } catch (e) { return 'threw: ' + (e && e.message); }
    })(),
  };
};

// The picture underneath, measured from a screenshot — the composited page, which includes the
// notice. So we take TWO readings: with the notice as it is, and with it forced to display:none,
// which is what the player would have been looking at if the notice had behaved.
async function litUnderneath(page) {
  await page.evaluate(() => {
    const n = document.getElementById('boot-notice');
    if (n) { n.dataset.esHidden = n.style.display || ''; n.style.display = 'none'; }
  });
  const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
  await page.evaluate(() => {
    const n = document.getElementById('boot-notice');
    if (n) { n.style.display = n.dataset.esHidden || ''; delete n.dataset.esHidden; }
  });
  return page.evaluate(async (b) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode();
    const W = Math.min(img.naturalWidth, 400);
    const H = Math.max(1, Math.round(img.naturalHeight * (W / img.naturalWidth)));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let lit = 0; const tot = W * H;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) lit++;
    return +(lit / tot).toFixed(4);
  }, b64);
}

// The two sabotages, plus no sabotage. Injected before any page script runs.
//
// Both act on `readPixels`, because `readPixels` IS the mechanism under test: `painted()` is a
// closure inside the page's IIFE and cannot be reached from outside, so the honest way to move it
// is to change what its one read returns. Neither arm touches the DOM, so neither can hide the
// notice by fiat — the page's own logic has to do that, which is the claim.
const ARMS = {
  'draws-nothing': () => {
    // The renderer gets its context, the world builds, `ready()` resolves, and the screen is
    // genuinely black. `painted()` is CORRECT to return false and the notice is RIGHT to appear.
    // If this tool reports a defect here, it is not measuring what it claims to measure — it is
    // just detecting the notice.
    const patch = (P) => { if (!P) return;
      P.drawElements = function () {}; P.drawArrays = function () {};
      if (P.drawElementsInstanced) P.drawElementsInstanced = function () {};
      if (P.drawArraysInstanced) P.drawArraysInstanced = function () {};
    };
    patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  },
  'readable-buffer': () => {
    // What the page would see if the drawing buffer were still preserved and the game were
    // drawing — i.e. the world before a52113c, which is the last state in which `painted()`
    // worked. The notice must then hide on its own, through its own code path. If it does not,
    // the defect is somewhere other than the buffer and this tool would be blaming the wrong
    // thing.
    const patch = (P) => { if (!P || !P.readPixels) return;
      const real = P.readPixels;
      P.readPixels = function (x, y, w, h, fmt, type, px) {
        try { real.apply(this, arguments); } catch (e) { /* the fill below is the point */ }
        if (px && px.fill) px.fill(160);
        return undefined;
      };
    };
    patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  },
};

async function run(browser, url, prof, arm) {
  const ctx = await browser.newContext({
    viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.dpr,
    isMobile: prof.touch, hasTouch: prof.touch, colorScheme: 'light', locale: 'en-GB', timezoneId: 'UTC',
    userAgent: prof.touch
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e).slice(0, 160)));
  // A PERSON, not a robot: this is the whole point. `navigator.webdriver` true puts main.js into
  // harness mode, which turns preserveDrawingBuffer back ON and hides the defect completely.
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  if (ARMS[arm]) await page.addInitScript(ARMS[arm]);

  const t0 = Date.now();
  const rec = { profile: prof.id, arm, samples: [], errors,
                loadAtStart: Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]) };
  try { await page.goto(url, { waitUntil: 'load', timeout: CAP_MS }); }
  catch (e) { rec.navError = String(e.message).split('\n')[0]; await ctx.close(); return rec; }

  // Wait for the boot promise. Everything this tool is about happens AFTER it.
  let booted = false;
  while (Date.now() - t0 < CAP_MS) {
    booted = await page.evaluate(() => {
      const H = window.__HARNESS;
      if (!H || !H.ready) return false;
      if (window.__NOG_BOOTED === undefined) {
        window.__NOG_BOOTED = null;
        H.ready().then(() => { window.__NOG_BOOTED = true; }, (e) => { window.__NOG_BOOTED = 'error: ' + (e && e.message || e); });
      }
      return window.__NOG_BOOTED;
    }).catch(() => false);
    if (booted) break;
    await page.waitForTimeout(1500);
  }
  rec.booted = booted;
  rec.bootMs = Date.now() - t0;

  // NOW WATCH. The other instruments stop 3-4 s after boot; the notice's own timer fires at 6 s
  // and its ceiling at 20 s, so the entire defect lives past where anything else looks.
  const tb = Date.now();
  while (Date.now() - tb < WATCH_MS) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s) {
      s.tAfterBootMs = Date.now() - tb;
      if (s.visible) s.litUnderneath = await litUnderneath(page).catch(() => null);
      rec.samples.push(s);
    }
    await page.waitForTimeout(1000);
  }

  // The verdict. A notice that is up over a LIT picture is the defect; a notice up over a black
  // one is the notice doing its job.
  const badOverLit = rec.samples.filter((s) => s.bad && (s.litUnderneath ?? 0) > 0.05);
  const anyVisibleOverLit = rec.samples.filter((s) => s.visible && (s.litUnderneath ?? 0) > 0.05);
  rec.secondsBadOverLitPicture = badOverLit.length;
  rec.secondsNoticeOverLitPicture = anyVisibleOverLit.length;
  rec.worstLitUnderneath = Math.max(0, ...rec.samples.map((s) => s.litUnderneath ?? 0));
  rec.blocksInput = rec.samples.some((s) => s.visible && s.blocksInput);
  rec.paintedSays = rec.samples.length ? rec.samples[rec.samples.length - 1].paintedSays : null;
  rec.noticeText = (badOverLit[0] || anyVisibleOverLit[0] || {}).text || '';
  rec.defect = rec.secondsBadOverLitPicture > 0;
  rec.ok = !rec.defect && rec.booted === true;
  await ctx.close();
  return rec;
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────
let origin, url, close;
if (LIVE) {
  const m = await serveLive();
  origin = m.origin; url = m.origin + OWNER_LINKS.game; close = () => m.close();
  say(`notice-over-game: LIVE — ${LIVE_BASE}${OWNER_LINKS.game}`);
  say('  (mirrored: Chromium cannot TLS-handshake through this container\'s proxy — see live-mirror.mjs)');
} else {
  const s = await serveDir(REPO_ROOT);
  origin = s.origin; url = s.origin + '/game/index.html'; close = () => s.close();
  say(`notice-over-game: LOCAL — ${url}`);
}
say(`  commit ${COMMIT} · load ${fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]} · watch ${WATCH_MS / 1000}s after boot`);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const out = { tool: 'notice-over-game', commit: COMMIT, date: DATE, url, mode: LIVE ? 'live' : 'local', rows: [] };
let failed = 0;

if (SELF_TEST) {
  say('\nnotice-over-game --self-test: three arms that must DISAGREE.');
  const prof = profiles[0];
  const expect = {
    control: 'the page as shipped',
    'draws-nothing': 'the screen really IS black — the notice is CORRECT and must not be scored a defect',
    'readable-buffer': 'painted() can read again — the notice must hide THROUGH ITS OWN CODE',
  };
  for (const arm of ['control', 'draws-nothing', 'readable-buffer']) {
    const r = await run(browser, url, prof, arm === 'control' ? null : arm);
    r.armName = arm;
    out.rows.push(r);
    say(`  ${arm.padEnd(16)} defect=${String(r.defect).padEnd(5)} notice-over-lit ${String(r.secondsNoticeOverLitPicture).padStart(2)}s · worst lit underneath ${(r.worstLitUnderneath * 100).toFixed(1)}% · painted() ${r.paintedSays}`);
    say(`  ${''.padEnd(16)} ${expect[arm]}`);
  }
  const [ctl, blk, pnt] = out.rows;
  const checks = [
    ['readable-buffer hides the notice on its own', pnt.secondsNoticeOverLitPicture === 0 && !pnt.defect],
    ['draws-nothing leaves nothing lit underneath, so the notice is right and is NOT scored a defect', blk.worstLitUnderneath <= 0.05 && !blk.defect],
    ['control and readable-buffer DISAGREE (or this tool measures nothing)', ctl.secondsNoticeOverLitPicture !== pnt.secondsNoticeOverLitPicture],
  ];
  for (const [what, ok] of checks) { say(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; }
  say(failed ? `notice-over-game --self-test: FAIL — ${failed} arm(s) wrong.` : 'notice-over-game --self-test: PASS.');
} else {
  for (const prof of profiles) {
    const r = await run(browser, url, prof, null);
    out.rows.push(r);
    if (!r.ok) failed++;
    say(`  ${(r.defect ? 'DEFECT' : r.ok ? 'OK    ' : 'FAIL  ')} ${prof.id.padEnd(22)} boot ${(r.bootMs / 1000).toFixed(0)}s · notice up over a lit picture for ${r.secondsNoticeOverLitPicture}s (${r.secondsBadOverLitPicture}s of it a RED error) · lit underneath ${(r.worstLitUnderneath * 100).toFixed(1)}% · blocks input ${r.blocksInput}`);
    if (r.paintedSays) say(`         painted() reads: ${r.paintedSays}`);
    if (r.noticeText) say(`         it says: "${r.noticeText.slice(0, 150)}"`);
    if (SHOTS) { /* the caller takes pictures with verify-playable; this tool is a number */ }
  }
}

await browser.close();
close();
if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); say(`  json ${JSON_OUT}`); }
process.exit(failed ? 1 : 0);
