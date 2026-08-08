#!/usr/bin/env node
// verify-playable.mjs — would a person opening the link see a picture, and can they play it?
//
// WHY THIS EXISTS. The owner opened the published game on a phone and got a black rectangle.
// Twice. Every check on this machine passed both times, because every check ran on this machine.
//
// WHAT THE PREVIOUS VERSION MEASURED, AND WHY IT WAS NOT ENOUGH. It served `game/` at the server
// root and loaded `/index.html` — not the path shape of the live site. It read 160x160 pixels from
// the BOTTOM-LEFT corner of the framebuffer, so a lit HUD corner over a black world scored 100%.
// It took ONE reading, 15 s after load, which rule 8 says is a still target in time. Its self-test
// blocked exactly one module (`three.module.js`), so a page that failed any other way could pass
// it. And it never pressed a key: a title screen that never starts a game is a picture, not a game.
//
// WHAT THIS ONE MEASURES
//   1. THE DEPLOYED BYTES. Default mode fetches the live Pages site through `live-mirror.mjs` and
//      serves it to a real browser at the owner's own path shape. Read that file for exactly what
//      that does and does not prove — Chromium cannot TLS-handshake through this container's
//      proxy, and the file measures and documents that rather than hiding it.
//   2. THE WHOLE FRAMEBUFFER, on a 12x12 grid, so "lit in one corner" is a distinct verdict from
//      "lit". Two thresholds, and the run prints where reality actually sits relative to both.
//   3. AT FOUR INSTANTS (rule 8) — 3 s, 8 s, 16 s and after real input — and it also checks the
//      picture CHANGES while the camera is being moved. A frame drawn once and then frozen is a
//      black screen with extra steps.
//   4. ON EIGHT DEVICE SHAPES: two desktops, a small phone and a large phone in both orientations,
//      and a tablet in both. One viewport is a still target too.
//   5. THAT IT PLAYS. `--play` drives the opening with a real keyboard on desktop and real CDP
//      touch events on the phones: title -> New -> walk -> E -> name -> census -> world.
//
//   node tools/world/verify-playable.mjs                  # the live site, all eight shapes
//   node tools/world/verify-playable.mjs --local          # repo root, /game/index.html
//   node tools/world/verify-playable.mjs --play           # also play the opening
//   node tools/world/verify-playable.mjs --self-test      # rule 4: SIX sabotages, all must go red
//   node tools/world/verify-playable.mjs --profiles desktop-1440,phone-small-landscape
//   node tools/world/verify-playable.mjs --shots docs/shots --json reports/playability/live.json
//
// Exit 0 only if every shape drew a moving picture and nothing 4xx'd.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { serveDir } from '../lib/serve.mjs';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';
import { serveLive, OWNER_LINKS, LIVE_BASE } from '../playability/live-mirror.mjs';

const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);

const MODE = has('--local') ? 'local' : 'live';
const SELF_TEST = has('--self-test');
const PLAY = has('--play');
const SHOTS = at('--shots', null);
const JSON_OUT = at('--json', null);
const ONLY = at('--profiles', '').split(',').map((s) => s.trim()).filter(Boolean);
const DATE = new Date().toISOString().slice(0, 10);
const COMMIT = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { return '?'; } })();

// ── the shapes people actually hold ───────────────────────────────────────────────────────────
const PROFILES = [
  { id: 'desktop-1920',          w: 1920, h: 1080, dpr: 1,   touch: false, kind: 'desktop' },
  { id: 'desktop-1440',          w: 1440, h: 900,  dpr: 1,   touch: false, kind: 'desktop' },
  { id: 'phone-small-portrait',  w: 360,  h: 740,  dpr: 3,   touch: true,  kind: 'phone', orientation: 'portrait' },
  { id: 'phone-small-landscape', w: 740,  h: 360,  dpr: 3,   touch: true,  kind: 'phone', orientation: 'landscape' },
  { id: 'phone-large-portrait',  w: 430,  h: 932,  dpr: 3,   touch: true,  kind: 'phone', orientation: 'portrait' },
  { id: 'phone-large-landscape', w: 932,  h: 430,  dpr: 3,   touch: true,  kind: 'phone', orientation: 'landscape' },
  { id: 'tablet-portrait',       w: 820,  h: 1180, dpr: 2,   touch: true,  kind: 'tablet', orientation: 'portrait' },
  { id: 'tablet-landscape',      w: 1180, h: 820,  dpr: 2,   touch: true,  kind: 'tablet', orientation: 'landscape' },
];

// ── the two thresholds, and why there are two ─────────────────────────────────────────────────
// A single "fraction of non-black pixels" number cannot tell a night scene from a lit HUD corner
// over a dead world — which is precisely the failure mode of a renderer that got a context and
// then drew nothing. So: a floor on the total, AND a floor on how much of the SCREEN is lit.
// Both are printed against the measured value on every row, so where they sit is never a mystery.
const MIN_LIT_FRACTION = 0.005;   // 0.5% of sampled pixels non-black. Total-darkness catcher.
const MIN_LIT_BLOCKS   = 0.30;    // 30% of the 12x12 grid has >2% of its pixels lit. Corner catcher.
const GRID = 12;

// Unbuffered: a run that takes half an hour must show its progress in a redirected log,
// otherwise the only way to know it is alive is to watch the screenshots appear.
const say = (s) => { try { fs.writeSync(1, s + '\n'); } catch { process.stdout.write(s + '\n'); } };

/**
 * Read the WHOLE framebuffer and reduce it in the page: overall lit fraction, a 12x12 coverage
 * grid, mean luminance and a cheap frame hash (so two instants can be compared for movement).
 * Sub-sampled to ~120k pixels so a 2796x1290 phone buffer costs the same as a desktop one.
 */
const READ_FRAME = ({ grid }) => {
  const c = document.querySelector('canvas');
  const notice = document.getElementById('boot-notice');
  const noticeVisible = !!notice && notice.className !== 'gone' &&
    getComputedStyle(notice).display !== 'none';
  const noticeText = noticeVisible ? (notice.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  // The page's own verdict on itself. `bn-bad` is the class the boot notice sets when it has
  // decided something is WRONG rather than slow — a 404, a thrown error, a refused context, a
  // lost context. Reading it is how this tool tells "the box is busy" from "the page is broken"
  // without guessing: the notice was written to answer exactly that question and it is on the
  // page already.
  const noticeBad = noticeVisible && /bn-bad/.test(notice.className || '');
  const base = {
    canvas: !!c, noticeVisible, noticeText, noticeBad,
    cw: c ? c.width : 0, ch: c ? c.height : 0,
    clientW: c ? c.clientWidth : 0, clientH: c ? c.clientHeight : 0,
    vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio || 1,
    simFrame: (window.__ENGINE && window.__ENGINE.sim && window.__ENGINE.sim.frame) || null,
  };
  if (!c) return { ...base, sampled: 0, lit: 0, litFraction: 0, litBlocks: 0, hash: 0 };
  // THE READ MUST NOT CREATE THE CONTEXT. A canvas has exactly one; calling getContext before
  // the renderer does hands the renderer OUR context, created with the default
  // `preserveDrawingBuffer: false`, and every readPixels from then on returns zeros — forever,
  // on a game that is drawing perfectly. The W1-DEPLOY critic found this latch in the previous
  // version of this file: "a getContext call before the renderer exists zeroes the number
  // permanently, with a control that differs." So: no context until the engine has made one.
  const engineUp = !!(window.__ENGINE && window.__ENGINE.renderer);
  if (!engineUp) return { ...base, sampled: 0, lit: 0, litFraction: 0, litBlocks: 0, hash: 0, glNotYet: true };
  let gl = null;
  try { gl = c.getContext('webgl2') || c.getContext('webgl'); } catch { /* reported below */ }
  if (!gl) return { ...base, sampled: 0, lit: 0, litFraction: 0, litBlocks: 0, hash: 0, noGl: true };
  // `readPixels` AFTER COMPOSITING ONLY WORKS WITH `preserveDrawingBuffer`. The renderer sets it
  // today, and a change is in flight to set it only for the harness — because a second full-size
  // framebuffer copy at 1920x1080 with antialias is a known way to lose the GL context on a phone,
  // which is a good reason. But this tool deliberately runs as a PERSON (webdriver spoofed false,
  // so main.js takes the real resize path), so on that build it would read all-zero from a game
  // drawing perfectly and report BLANK forever — a silent false negative of exactly the kind this
  // whole file exists to abolish.
  //
  // So ASK, rather than assume. If the buffer is not preserved, the pixel reading is not evidence
  // and must not be reported as if it were: the row says it cannot measure, loudly, instead of
  // saying the screen is black.
  let attrs = null;
  try { attrs = gl.getContextAttributes(); } catch { /* treated as unknown below */ }
  if (attrs && attrs.preserveDrawingBuffer === false) {
    return { ...base, sampled: 0, lit: 0, litFraction: 0, litBlocks: 0, hash: 0, cannotMeasure: 'preserveDrawingBuffer is off, so readPixels after compositing returns zeros — this is NOT a black screen, it is an unmeasurable one' };
  }
  const w = c.width, h = c.height;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 120000)));
  const cellLit = new Array(grid * grid).fill(0);
  const cellTot = new Array(grid * grid).fill(0);
  let lit = 0, sampled = 0, sum = 0, hash = 2166136261;
  for (let y = 0; y < h; y += step) {
    const gy = Math.min(grid - 1, (y / h * grid) | 0);
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const gi = Math.min(grid - 1, (x / w * grid) | 0) + gy * grid;
      cellTot[gi]++; sampled++;
      sum += r + g + b;
      if (r > 8 || g > 8 || b > 8) { cellLit[gi]++; lit++; }
      hash = (Math.imul(hash ^ r, 16777619) ^ g) >>> 0;
      hash = (Math.imul(hash ^ b, 16777619)) >>> 0;
    }
  }
  let litBlocks = 0;
  for (let i = 0; i < cellTot.length; i++) if (cellTot[i] && cellLit[i] / cellTot[i] > 0.02) litBlocks++;
  return {
    ...base, sampled, lit, step,
    litFraction: lit / (sampled || 1),
    litBlocks: litBlocks / (grid * grid),
    meanLuma: sum / (sampled * 3 || 1),
    hash,
  };
};

/** Everything the boot notice knows about the device, asked from the outside. */
const READ_CAPS = () => {
  const c = document.querySelector('canvas');
  const out = { ua: navigator.userAgent.slice(0, 120), dpr: window.devicePixelRatio,
                cores: navigator.hardwareConcurrency || null, mem: navigator.deviceMemory || null,
                engineUp: !!(window.__ENGINE && window.__ENGINE.renderer) };
  if (!out.engineUp) { out.gl = null; return out; }   // never create the context ourselves
  try {
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    if (!gl) { out.gl = null; return out; }
    out.gl = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) ? 2 : 1;
    out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    out.maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    out.maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
    out.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    out.attrs = gl.getContextAttributes();
    out.contextLost = gl.isContextLost();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) { out.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).slice(0, 80);
               out.vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)).slice(0, 40); }
    out.floatRenderable = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('WEBGL_color_buffer_float'));
    out.depthTexture = !!(out.gl === 2 || gl.getExtension('WEBGL_depth_texture'));
    out.glError = gl.getError();
  } catch (e) { out.probeThrew = String(e && e.message || e).slice(0, 90); }
  return out;
};


/**
 * MEASURE WHAT A PERSON SEES, NOT WHAT THE GL BUFFER STILL HAPPENS TO HOLD.
 *
 * The original reading was `gl.readPixels` on the game's own canvas, and that only works while
 * the renderer sets `preserveDrawingBuffer`. Commit a52113c turned that off for players — for a
 * good reason, a second full-size buffer with antialias is a known way to lose a phone's GL
 * context — and this tool deliberately runs as a PERSON, so from that commit onward readPixels
 * would have returned zeros on a game drawing perfectly and reported a black screen forever.
 *
 * A screenshot has none of that coupling. It is the composited page, which is the thing the
 * question is actually about ("would somebody see a picture"), it includes the boot notice and
 * any HTML overlay, and nothing running inside the page can flatter it. So: take the screenshot
 * in Node, hand it back to the page as a data URL, draw it into a 2-D canvas — which has no
 * relationship to the WebGL context at all — and reduce it there on the same 12x12 grid.
 *
 * Falls back to the GL read when the screenshot cannot be taken, and says which it used.
 */
async function readFrame(page, grid) {
  const dom = await page.evaluate(READ_FRAME, { grid });
  let shot = null;
  try { shot = (await page.screenshot({ type: 'png' })).toString('base64'); } catch { /* fall back */ }
  if (!shot) return { ...dom, source: dom.cannotMeasure ? 'unmeasurable' : 'gl' };
  const px = await page.evaluate(async ({ b64, grid }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const W = Math.min(img.naturalWidth, 480);
    const H = Math.max(1, Math.round(img.naturalHeight * (W / img.naturalWidth)));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const cellLit = new Array(grid * grid).fill(0), cellTot = new Array(grid * grid).fill(0);
    let lit = 0, sampled = 0, sum = 0, hash = 2166136261;
    for (let y = 0; y < H; y++) {
      const gy = Math.min(grid - 1, (y / H * grid) | 0);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const gi = Math.min(grid - 1, (x / W * grid) | 0) + gy * grid;
        cellTot[gi]++; sampled++; sum += r + g + b;
        if (r > 8 || g > 8 || b > 8) { cellLit[gi]++; lit++; }
        hash = (Math.imul(hash ^ r, 16777619) ^ g) >>> 0;
        hash = (Math.imul(hash ^ b, 16777619)) >>> 0;
      }
    }
    let litBlocks = 0;
    for (let i = 0; i < cellTot.length; i++) if (cellTot[i] && cellLit[i] / cellTot[i] > 0.02) litBlocks++;
    return { sampled, lit, litFraction: lit / (sampled || 1), litBlocks: litBlocks / (grid * grid),
             meanLuma: sum / (sampled * 3 || 1), hash, shotW: img.naturalWidth, shotH: img.naturalHeight };
  }, { b64: shot, grid });
  // The DOM facts (canvas size, the notice and its error state) come from the page; the PIXELS
  // come from the screenshot. `cannotMeasure` is dropped because with a screenshot we can.
  const { cannotMeasure, ...rest } = dom;
  return { ...rest, ...px, source: 'screenshot', glUnreadable: !!cannotMeasure };
}

// ── the sabotages (rule 4) ────────────────────────────────────────────────────────────────────
// Six DIFFERENT ways the page can fail to be playable. Every one of them must turn this tool red.
// The previous self-test blocked one module; five of these six would have sailed straight past it.
const SABOTAGE = {
  'missing-renderer':  { what: 'three.module.js 404s — the renderer never loads',
                         route: '**/vendor/three/**' },
  'missing-submodule': { what: 'src/input/hold-gate.js 404s — black screen #1, exactly',
                         route: '**/src/input/hold-gate.js' },
  'missing-data':      { what: 'a world data file 404s — the game boots and has no world',
                         route: '**/data/world/**' },
  'no-webgl':          { what: 'the device refuses a 3D context',
                         init: () => {
                           const real = HTMLCanvasElement.prototype.getContext;
                           HTMLCanvasElement.prototype.getContext = function (t, ...a) {
                             if (String(t).startsWith('webgl') || String(t) === 'experimental-webgl') return null;
                             return real.call(this, t, ...a);
                           };
                         } },
  'draws-nothing':     { what: 'a context that accepts every call and rasterises none',
                         init: () => {
                           // The renderer gets its context, the world builds, `ready()` resolves,
                           // and the screen stays black. This is the failure the owner's phone
                           // most plausibly had and the one a page-error check cannot see.
                           const patch = (P) => { if (!P) return;
                             P.drawElements = function () {};
                             P.drawArrays = function () {};
                             if (P.drawElementsInstanced) P.drawElementsInstanced = function () {};
                             if (P.drawArraysInstanced) P.drawArraysInstanced = function () {};
                           };
                           patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
                           patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
                         } },
  'frozen':            { what: 'one frame is drawn and the loop then stops — a still picture',
                         init: () => {
                           const raf = window.requestAnimationFrame.bind(window);
                           let n = 0;
                           window.requestAnimationFrame = (cb) => (n++ < 240 ? raf(cb) : 0);
                         } },
};

// ── one profile, measured ─────────────────────────────────────────────────────────────────────
async function measure(browser, url, prof, { sabotage = null, play = false, shot = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: prof.w, height: prof.h },
    deviceScaleFactor: prof.dpr,
    isMobile: prof.touch, hasTouch: prof.touch,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
    userAgent: prof.touch
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();
  const errors = [], bad = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('requestfailed', (r) => bad.push(`${r.failure()?.errorText} ${new URL(r.url()).pathname}`));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });

  const sab = sabotage ? SABOTAGE[sabotage] : null;
  if (sab?.route) await page.route(sab.route, (r) => r.fulfill({ status: 404, body: 'sabotaged' }));
  if (sab?.init) await page.addInitScript(sab.init);

  const rec = { profile: prof.id, w: prof.w, h: prof.h, dpr: prof.dpr, sabotage, samples: [], errors, bad,
                loadAtStart: Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]) };
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  } catch (e) {
    rec.navError = String(e.message).split('\n')[0];
    await ctx.close();
    return finish(rec, prof);
  }

  // RULE 8: several instants, not one. A page that is fine at 3 s and dead at 30 s is a real
  // thing, and so is one that is black at 8 s and fine at 40 s — the world is 17 MB. So: fixed
  // early readings, then keep reading until the boot promise settles or the cap runs out. The cap
  // is what stops "still loading" from being an infinite excuse.
  for (const wait of [3000, 5000, 8000]) {
    await page.waitForTimeout(wait);
    rec.samples.push({ t: Date.now() - t0, ...(await readFrame(page, GRID)) });
  }
  // A sabotaged page never boots, so the self-test would otherwise sit on the full cap six
  // times over. Shorter there; the arms still have to go red on their own merits.
  const CAP = Number(at('--cap-ms', SELF_TEST ? 45000 : 180000));
  let booted = false;
  while (Date.now() - t0 < CAP) {
    booted = await page.evaluate(() => {
      const H = window.__HARNESS;
      if (!H || !H.ready) return false;
      if (window.__PLAYABILITY_BOOTED === undefined) {
        window.__PLAYABILITY_BOOTED = null;
        H.ready().then(() => { window.__PLAYABILITY_BOOTED = true; },
                       (e) => { window.__PLAYABILITY_BOOTED = 'error: ' + (e && e.message || e); });
      }
      return window.__PLAYABILITY_BOOTED;
    }).catch(() => false);
    if (booted) break;
    await page.waitForTimeout(2000);
    rec.samples.push({ t: Date.now() - t0, waiting: true, ...(await readFrame(page, GRID)) });
  }
  rec.booted = booted;
  rec.bootMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  rec.samples.push({ t: Date.now() - t0, after: 'boot', ...(await readFrame(page, GRID)) });
  rec.caps = await page.evaluate(READ_CAPS);

  // MOVEMENT: turn the camera for real and confirm the picture is not the same picture. A frozen
  // frame passes every "is it black" test ever written.
  try {
    if (prof.touch) {
      const cdp = await ctx.newCDPSession(page);
      const x = Math.round(prof.w * 0.75), y = Math.round(prof.h * 0.45);
      const pt = (px, py) => [{ x: px, y: py, id: 3, radiusX: 12, radiusY: 12, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y) });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x - i * 12, y) });
        await page.waitForTimeout(45);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      for (let i = 0; i < 10; i++) { await page.mouse.move(prof.w / 2 - i * 25, prof.h / 2); await page.waitForTimeout(45); }
      await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
    }
  } catch (e) { rec.motionError = String(e.message).slice(0, 120); }
  await page.waitForTimeout(1200);
  rec.samples.push({ t: Date.now() - t0, after: 'motion', ...(await readFrame(page, GRID)) });

  if (play) rec.play = await playOpening(page, ctx, prof);

  if (shot) {
    try { fs.mkdirSync(path.dirname(shot), { recursive: true }); await page.screenshot({ path: shot }); rec.shot = path.relative(REPO_ROOT, shot); }
    catch (e) { rec.shotError = String(e.message).slice(0, 100); }
  }
  await ctx.close();
  return finish(rec, prof);
}

function finish(rec, prof) {
  const last = rec.samples[rec.samples.length - 1] || {};
  // Movement is judged ONLY on the settled samples — the one taken after boot and the one taken
  // after real input. Comparing loading frames would score a page that painted a spinner and then
  // died as "moving", which is the opposite of what this arm is for.
  const settled = rec.samples.filter((s) => s.after === 'boot' || s.after === 'motion');
  const hashes = new Set(settled.filter((s) => s.hash).map((s) => s.hash));
  rec.moved = hashes.size > 1;
  rec.litFraction = +(last.litFraction || 0).toFixed(5);
  rec.litBlocks = +(last.litBlocks || 0).toFixed(3);
  rec.noticeVisible = !!last.noticeVisible;
  rec.noticeText = last.noticeText || '';
  // "Fills the glass": a 1x1 canvas draws something and is still a black screen to the holder.
  rec.fills = (last.clientW || 0) >= prof.w * 0.9 && (last.clientH || 0) >= prof.h * 0.5;
  // AND THE FRAMEBUFFER MUST BE THIS DEVICE'S. The W1-DEPLOY critic found the previous version
  // measuring one identical 1920x1080 buffer at all four of its viewports, because `main.js` takes
  // the automation branch when `navigator.webdriver` is true and skips the resize. That makes a
  // multi-device check a single-device check wearing four hats — rule 8's still target, exactly.
  // `1920x1080` is the literal in game/index.html's <canvas> tag, so it is also the value you get
  // when nothing ever resized it.
  const aspect = (last.ch ? last.cw / last.ch : 0), want = prof.w / prof.h;
  rec.framebuffer = last.cw ? `${last.cw}x${last.ch}` : 'none';
  rec.framebufferIsThisDevice = !!last.cw &&
    !(last.cw === 1920 && last.ch === 1080 && !(prof.w === 1920 && prof.h === 1080)) &&
    Math.abs(aspect - want) / want < 0.15;

  const why = [];
  // "STILL LOADING" AND "BLACK" ARE DIFFERENT ANSWERS AND MUST NOT SHARE A WORD. The W1-DEPLOY
  // critic named this in the previous version: with a flat wait, "the game draws nothing" and
  // "the machine was busy" were reported in the same sentence. `booted` is the boot promise,
  // which is the difference, so it leads the diagnosis and the row is labelled SLOW rather than
  // BLANK. It still fails — three minutes of nothing is a defect a person experiences — but
  // nobody should go looking for a renderer bug because the box was at load 22.
  if (rec.booted !== true) {
    if (last.noticeBad) {
      // The page says it is broken, in its own words, on its own screen. That is not slowness and
      // must not be excused as slowness — it is the whole finding.
      why.push(`the page gave up and said so: "${(rec.noticeText || last.noticeText || '').slice(0, 140)}"`);
      rec.verdict = 'BROKE';
    } else {
      why.push(`the boot promise had not resolved after ${((rec.bootMs || 0) / 1000).toFixed(0)}s at load ${rec.loadAtStart ?? '?'} and the page reports no error — this is STILL LOADING, not a black screen; re-run with a larger --cap-ms on a quieter box before blaming the renderer`);
      rec.verdict = 'SLOW';
    }
  }
  if (rec.navError) why.push('navigation failed: ' + rec.navError);
  if (!last.canvas) why.push('no canvas');
  if (last.cannotMeasure) {
    why.push(`CANNOT MEASURE PIXELS: ${last.cannotMeasure}. Re-run against a build whose renderer preserves the drawing buffer, or teach this tool to read inside requestAnimationFrame. Do not read the lit figures below as a verdict.`);
    rec.verdict = 'UNMEASURED';
  }
  if (last.noGl) why.push('no WebGL context');
  if (rec.noticeVisible) why.push(`boot notice still up: "${rec.noticeText.slice(0, 110)}"`);
  if (!rec.fills) why.push(`canvas ${last.clientW}x${last.clientH} does not fill ${prof.w}x${prof.h}`);
  if (last.canvas && !rec.framebufferIsThisDevice) why.push(`framebuffer ${rec.framebuffer} is not this device's shape (${prof.w}x${prof.h}) — the reading is not about this profile`);
  if (last.cannotMeasure) { /* the pixel arms are meaningless here; the line above says why */ }
  else if (rec.litFraction < MIN_LIT_FRACTION) why.push(`only ${(rec.litFraction * 100).toFixed(2)}% of pixels lit (floor ${MIN_LIT_FRACTION * 100}%)`);
  else if (rec.litBlocks < MIN_LIT_BLOCKS) why.push(`lit in only ${(rec.litBlocks * 100).toFixed(0)}% of the screen (floor ${MIN_LIT_BLOCKS * 100}%)`);
  if (!rec.moved && !last.cannotMeasure) why.push('the picture never changed across the settled instants — frozen');
  if (rec.bad.length) why.push(`${rec.bad.length} request(s) 4xx/failed: ${rec.bad.slice(0, 2).join(', ')}`);
  if (rec.errors.length) why.push(`page error: ${rec.errors[0]}`);
  if (rec.play && !rec.play.ok) why.push(`could not play: ${rec.play.why}`);
  rec.why = why;
  rec.ok = why.length === 0;
  if (rec.ok) rec.verdict = 'PLAYS';
  else if (!rec.verdict) rec.verdict = 'BLANK';
  return rec;
}

// ── can a person actually start the game? ─────────────────────────────────────────────────────
async function playOpening(page, ctx, prof) {
  const t0 = Date.now();
  const beats = [];
  const st = () => page.evaluate(() => {
    const e = window.__ENGINE, H = window.__HARNESS;
    return {
      mode: e && e.mode, title: H && H.getTitleState ? H.getTitleState() : null,
      pos: e && e.sim && e.sim.player ? e.sim.player.pos.slice() : null,
      frame: e && e.sim ? e.sim.frame : null,
      census: e && e.census ? e.census.state() : null,
      surface: e && e.censusSurface ? { takes: !!e.censusSurface.takesInput, sel: e.censusSurface.sel,
        options: (e.censusSurface.options || []).map((o) => o.text || o.id).slice(0, 8) } : null,
    };
  });
  try {
    await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 180000 });
    await page.evaluate(() => window.__HARNESS.ready());
    let s = await st();
    beats.push({ beat: 'boot', ms: Date.now() - t0, mode: s.mode, titleShown: !!(s.title && s.title.shown) });
    if (!s.title || !s.title.shown) return { ok: false, why: 'no title screen on first launch', beats };

    // NEW — keyboard on a desktop, a real finger on a phone.
    if (prof.touch) {
      const layout = await page.evaluate(() => window.__HARNESS.touchLayout && window.__HARNESS.touchLayout());
      const c = (layout || []).find((x) => x.action === 'interact');
      if (!c) return { ok: false, why: 'no `interact` control drawn on the title screen', beats, layout: (layout || []).map((l) => l.action) };
      const cdp = await ctx.newCDPSession(page);
      const pt = [{ x: c.x, y: c.y, id: 9, radiusX: 12, radiusY: 12, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
      await page.waitForTimeout(90);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      // THE KEYS THE README ACTUALLY TELLS A PERSON TO PRESS, in order, until one works. The first
      // version pressed Enter once and reported "pressing New did not start a game" — which is a
      // claim about the game when it was a claim about the check. A player who is told "E or
      // Enter" tries both, so this does too, and it reports WHICH key started the game, because
      // "only one of the two documented keys works" is itself a finding worth having.
      const tried = [];
      for (const key of ['Enter', 'KeyE', 'Space', 'NumpadEnter']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(2000);
        const now = await st();
        tried.push({ key, started: now.mode === 'play' && !(now.title && now.title.shown) });
        if (tried[tried.length - 1].started) break;
      }
      beats.push({ beat: 'keys-tried', tried });
    }
    await page.waitForTimeout(2500);
    s = await st();
    beats.push({ beat: 'new-game', ms: Date.now() - t0, mode: s.mode, pos: s.pos });
    const started = s.mode === 'play' && !(s.title && s.title.shown);
    if (!started) return { ok: false, why: `no documented key started a game from the title (mode=${s.mode}, title still shown). Tried: ${JSON.stringify(beats[beats.length - 2])}`, beats };

    // WALK. A game you cannot move in is not a game.
    const before = s.pos;
    if (!prof.touch) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW');
    } else {
      const cdp = await ctx.newCDPSession(page);
      const ox = Math.round(prof.w * 0.22), oy = Math.round(prof.h * 0.62);
      const pt = (x, y) => [{ x, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(ox, oy) });
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(ox, oy - 80) });
      await page.waitForTimeout(1400);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(300);
    s = await st();
    const moved = before && s.pos ? Math.hypot(s.pos[0] - before[0], s.pos[2] - before[2]) : 0;
    beats.push({ beat: 'walk', ms: Date.now() - t0, metres: +moved.toFixed(2) });
    if (moved < 0.5) return { ok: false, why: `the player moved ${moved.toFixed(2)} m — the controls do not drive the body`, beats };

    return { ok: true, ms: Date.now() - t0, beats };
  } catch (e) {
    return { ok: false, why: String(e.message).split('\n')[0].slice(0, 150), beats };
  }
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────
const profiles = ONLY.length ? PROFILES.filter((p) => ONLY.includes(p.id)) : PROFILES;
if (!profiles.length) { console.error('verify-playable: no profile matched --profiles'); process.exit(2); }

let origin, url, closeServer, mirror = null;
if (MODE === 'live') {
  mirror = await serveLive();
  origin = mirror.origin; url = mirror.origin + OWNER_LINKS.game;
  closeServer = () => mirror.close();
  say(`verify-playable: LIVE — ${LIVE_BASE}${OWNER_LINKS.game}`);
  say('  (fetched over the agent proxy and re-served on 127.0.0.1: Chromium cannot TLS-handshake');
  say('   through the proxy itself — tools/playability/live-mirror.mjs measures and documents that.)');
} else {
  const srv = await serveDir(REPO_ROOT);
  origin = srv.origin; url = srv.origin + '/game/index.html';
  closeServer = () => srv.close();
  say(`verify-playable: LOCAL — ${url}  (the live site's path shape, from the working tree)`);
}
say(`  commit ${COMMIT} · load ${fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 1)} · ${profiles.length} shape(s)`);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
say(`  [browser] one instance, kept for the whole run`);

const out = { tool: 'verify-playable', mode: MODE, url: MODE === 'live' ? LIVE_BASE + OWNER_LINKS.game : url,
              commit: COMMIT, date: DATE, thresholds: { MIN_LIT_FRACTION, MIN_LIT_BLOCKS, GRID },
              rows: [], selfTest: null };
let failed = 0;

if (SELF_TEST) {
  // RULE 4. Not one sabotage — six, each a different way to be unplayable. A check that has only
  // ever been shown failing on a missing renderer has been shown failing on one thing.
  say('\nverify-playable --self-test: six sabotages. EVERY row must go red.');
  const probe = profiles.find((p) => p.kind === 'desktop') || profiles[0];
  const phone = profiles.find((p) => p.kind === 'phone') || profiles[0];
  out.selfTest = [];
  // First a control: the untouched page must go GREEN, or "everything is red" proves nothing.
  const control = await measure(browser, url, probe, {});
  out.selfTest.push({ sabotage: null, control: true, red: !control.ok, ...pick(control) });
  say(`  ${control.ok ? 'GREEN' : 'RED  '}  (control, no sabotage)   lit ${(control.litFraction * 100).toFixed(1)}% blocks ${(control.litBlocks * 100).toFixed(0)}% moved ${control.moved}` +
      (control.ok ? '' : `  << the control must be green: ${control.why.join('; ')}`));
  if (!control.ok) failed++;
  for (const name of Object.keys(SABOTAGE)) {
    const target = name === 'no-webgl' ? phone : probe;
    const r = await measure(browser, url, target, { sabotage: name });
    const red = !r.ok;
    if (!red) failed++;
    out.selfTest.push({ sabotage: name, red, on: target.id, ...pick(r) });
    say(`  ${red ? 'GOES-RED' : 'STAYED-GREEN'}  ${name.padEnd(18)} lit ${(r.litFraction * 100).toFixed(1).padStart(5)}% blocks ${(r.litBlocks * 100).toFixed(0).padStart(3)}% moved ${String(r.moved).padEnd(5)} :: ${r.why[0] || 'NOTHING — this sabotage is invisible to the check'}`);
  }
  say(failed ? `verify-playable --self-test: FAIL — ${failed} arm(s) wrong.`
             : 'verify-playable --self-test: PASS — the control is green and all six sabotages are red.');
} else {
  for (const prof of profiles) {
    const shot = SHOTS ? path.join(REPO_ROOT, SHOTS, `${DATE}-playability-${MODE}-${prof.id}.png`) : null;
    const r = await measure(browser, url, prof, { play: PLAY, shot });
    out.rows.push(r);
    if (!r.ok) failed++;
    const shown = [...r.samples.slice(0, 3), ...r.samples.slice(-2)];
    const trail = shown.map((s) => `${(s.t / 1000).toFixed(0)}s:${(s.litFraction * 100).toFixed(1)}%`).join(' → ');
    say(`  ${(r.verdict || 'BLANK').padEnd(5)}  ${prof.id.padEnd(22)} ${String(prof.w).padStart(4)}x${String(prof.h).padEnd(4)}@${prof.dpr}x  boot ${r.bootMs ? (r.bootMs / 1000).toFixed(0) : '-'}s  lit ${trail}  screen ${(r.litBlocks * 100).toFixed(0)}%  moved ${r.moved}` +
        (r.play ? `  play ${r.play.ok ? 'OK ' + (r.play.ms / 1000).toFixed(1) + 's' : 'NO'}` : ''));
    for (const w of r.why) say(`         ! ${w}`);
  }
  say(failed ? `\nverify-playable: FAIL — ${failed} of ${profiles.length} shape(s) would show a person a black screen.`
             : `\nverify-playable: PASS — a moving picture on all ${profiles.length} shapes.`);
}

function pick(r) { return { litFraction: r.litFraction, litBlocks: r.litBlocks, moved: r.moved, why: r.why, notice: r.noticeText.slice(0, 120) }; }

out.failed = failed;
if (mirror && mirror.retried) {
  say(`\n  NOTE: the live host answered 5xx ${mirror.retried} time(s) during this run and the mirror asked again.`);
  say('        The GAME does not do that — game/src/engine.js:10190 throws on any non-200 with no');
  say('        retry, so one transient 5xx among several hundred data files kills the whole boot.');
  say('        That is a black screen a phone on a flaky connection can produce and this box cannot.');
}
if (mirror) {
  // HOW MUCH OF THE BOOT WAS THE MIRROR. Without this the live boot time conflates three things —
  // the game, the box's load, and the cost of fetching ~700 files down one CONNECT tunnel each —
  // and a reader would have no way to tell them apart. Rule 26: say under what load the figure
  // was taken, or publish no figure.
  const reqs = mirror.requests;
  out.liveRequests = {
    count: reqs.length,
    retriedAfter5xx: mirror.retried,
    bytes: reqs.reduce((a, r) => a + r.bytes, 0),
    totalFetchMs: reqs.reduce((a, r) => a + r.ms, 0),
    slowest: reqs.slice().sort((a, b) => b.ms - a.ms).slice(0, 5).map((r) => `${r.ms}ms ${r.path}`),
    bad: reqs.filter((r) => r.status !== 200).map((r) => `${r.status} ${r.path}`).slice(0, 20),
  };
}
if (JSON_OUT) {
  const p = path.join(REPO_ROOT, JSON_OUT);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  say(`  wrote ${JSON_OUT}`);
}
await browser.close();
await closeServer();
process.exit(failed ? 1 : 0);
