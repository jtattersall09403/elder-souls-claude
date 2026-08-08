#!/usr/bin/env node
// critic-deploy-probe.mjs — the browser half of the deploy-instrument critique. One browser,
// launched once, kept for every probe (rule 21).
//
// It asks five things of the shipped instruments that their own self-tests do not:
//
//   settle   Rule 8. verify-playable waits a flat 15 s and reads once. Read the same number at
//            2,4,…,40 s and say whether 15 is a measurement or a guess — and whether the number
//            is still moving when the shipped tool stops looking.
//   frame    verify-playable samples readPixels(0,0,160,160) — the BOTTOM-LEFT corner of the
//            framebuffer, since WebGL's origin is bottom-left. Compare that corner's non-black
//            fraction against the whole frame's, on the states this game actually has, including
//            the dark ones. If the corner and the frame disagree, the threshold is being applied
//            to something other than "is there a picture".
//   dark     Is there a legitimate state of this game below the 2% line? Night, an interior, a
//            cellar. If yes, the check calls a working game broken.
//   sabotage verify-playable's self-test blocks three.module.js. Block hold-gate.js instead —
//            the module that actually caused the black screen — and see whether it still goes red.
//   notice   When does the boot notice hide, relative to when the world is actually ready? And
//            once hidden, can it still report a 404? And does its window.fetch wrapper perturb
//            the game?
//
//   node tools/world/critic-deploy-probe.mjs --settle
//   node tools/world/critic-deploy-probe.mjs --frame
//   node tools/world/critic-deploy-probe.mjs --sabotage
//   node tools/world/critic-deploy-probe.mjs --notice
//   node tools/world/critic-deploy-probe.mjs --all
//   node tools/world/critic-deploy-probe.mjs --self-test
import { chromium } from 'playwright';
import { serveDir } from '../lib/serve.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const all = has('--all');
const SCRATCH = process.env.ES_SCRATCH
  || '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad';

// The shipped constants, restated here so a change to either is visible as a diff in this file.
const MIN_NONBLACK_FRACTION = 0.02;   // verify-playable
const SHIPPED_WAIT_MS = 15000;        // verify-playable
const SAMPLE = 160;                   // verify-playable's readPixels window

// The sampler, in two forms: the shipped bottom-left window, and a whole-frame stride sample of
// roughly the same pixel budget. Same threshold, same "non-black" test (>8 on any channel), so
// the only thing that differs between them is WHERE they look.
const SAMPLERS = `
window.__criticSample = function () {
  const c = document.querySelector('canvas');
  if (!c) return { canvas: false };
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { canvas: true, gl: false };
  const nb = (buf) => { let n = 0; for (let i = 0; i < buf.length; i += 4)
    if (buf[i] > 8 || buf[i+1] > 8 || buf[i+2] > 8) n++; return n; };

  // (1) exactly what verify-playable does
  const w = Math.min(c.width, ${SAMPLE}), h = Math.min(c.height, ${SAMPLE});
  const corner = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, corner);

  // (2) the whole frame, strided to a comparable budget
  const full = new Uint8Array(c.width * c.height * 4);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, full);
  const stride = Math.max(1, Math.floor((c.width * c.height) / (${SAMPLE} * ${SAMPLE})));
  let fs = 0, fn = 0;
  for (let px = 0; px < c.width * c.height; px += stride) {
    const i = px * 4; fs++;
    if (full[i] > 8 || full[i+1] > 8 || full[i+2] > 8) fn++;
  }
  // (3) the top half only — sky and HUD live here; a game that draws ONLY these is still black
  //     to the corner sampler, and a game that draws only ground is black to this one.
  let ts = 0, tn = 0;
  for (let y = Math.floor(c.height / 2); y < c.height; y += 4)
    for (let x = 0; x < c.width; x += 4) {
      const i = (y * c.width + x) * 4; ts++;
      if (full[i] > 8 || full[i+1] > 8 || full[i+2] > 8) tn++;
    }
  return {
    canvas: true, gl: true, cw: c.width, ch: c.height,
    clientW: c.clientWidth, clientH: c.clientHeight,
    cornerFrac: nb(corner) / (w * h),
    fullFrac: fs ? fn / fs : 0,
    upperFrac: ts ? tn / ts : 0,
  };
};
`;

const VIEWPORTS = [
  { name: 'desktop',         width: 1440, height: 900,  isMobile: false },
  { name: 'phone-portrait',  width: 412,  height: 839,  isMobile: true, deviceScaleFactor: 2.6 },
  { name: 'phone-landscape', width: 839,  height: 412,  isMobile: true, deviceScaleFactor: 2.6 },
  { name: 'tablet',          width: 820,  height: 1180, isMobile: true, deviceScaleFactor: 2 },
];

async function openPage(browser, origin, vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor || 1,
    isMobile: vp.isMobile, hasTouch: vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();
  const errors = [], bad = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().split('/').slice(-2).join('/')}`); });
  page.on('requestfailed', (r) => bad.push(`${r.failure()?.errorText} ${r.url().split('/').slice(-2).join('/')}`));
  await page.addInitScript(SAMPLERS);
  if (opts.init) await page.addInitScript(opts.init);
  if (opts.block) await page.route(opts.block, (route) => route.abort());
  if (opts.routeHtml) await page.route('**/index.html', opts.routeHtml);
  return { ctx, page, errors, bad };
}

// ---------------------------------------------------------------------------------------------
const results = {};

const dir = join(ROOT, 'docs', 'play');
const { origin, close } = await serveDir(dir, { port: 0 });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const url = `${origin}/index.html`;

try {
  // ---- SELF-TEST ----------------------------------------------------------------------------
  // Rule 4 for this instrument. The samplers must report a bright frame as bright and a page that
  // cannot render as dark. Without both arms every number below could be a constant.
  if (has('--self-test')) {
    const { ctx: c1, page: p1 } = await openPage(browser, origin, VIEWPORTS[0]);
    await p1.goto(url, { waitUntil: 'load', timeout: 120000 });
    await p1.waitForTimeout(SHIPPED_WAIT_MS);
    const live = await p1.evaluate(() => window.__criticSample());
    await c1.close();

    const { ctx: c2, page: p2 } = await openPage(browser, origin, VIEWPORTS[0], { block: '**/three.module.js' });
    await p2.goto(url, { waitUntil: 'load', timeout: 120000 });
    await p2.waitForTimeout(8000);
    const dead = await p2.evaluate(() => window.__criticSample());
    await c2.close();

    const armA = live.gl && live.fullFrac > 0.2;
    const armB = !dead.gl || dead.fullFrac < 0.01;
    // The two samplers must also be capable of disagreeing, or the corner-vs-frame comparison
    // that the whole `frame` probe rests on would be a comparison of a value with itself.
    const armC = Math.abs(live.cornerFrac - live.fullFrac) > 1e-9;
    const ok = armA && armB && armC;
    console.log('critic-deploy-probe --self-test:');
    console.log(`  live page is bright         full=${live.fullFrac?.toFixed(3)}  -> ${armA}`);
    console.log(`  renderer-blocked page dark  full=${dead.fullFrac?.toFixed(3)}  -> ${armB}`);
    console.log(`  the two samplers can differ corner=${live.cornerFrac?.toFixed(3)} full=${live.fullFrac?.toFixed(3)} -> ${armC}`);
    console.log(ok ? '  PASS' : '  FAIL — the samplers cannot distinguish a drawn frame from an undrawn one.');
    await browser.close(); await close();
    process.exit(ok ? 0 : 1);
  }

  // ---- SETTLE (rule 8) ------------------------------------------------------------------------
  //
  // ONE FRESH PAGE PER SAMPLE, and this is not fastidiousness — it is the finding. Reading the
  // framebuffer once on a page latches the answer for that page forever: a read taken before the
  // engine's renderer exists returns 0 and every later read on the same page returns 0 too, no
  // matter how long you wait. Isolated: at 2 s `window.__ENGINE.renderer` does not exist yet, so
  // `canvas.getContext('webgl2')` from the probe CREATES the context with default attributes;
  // THREE then gets that context back and its own attributes never apply. Merely calling
  // getContext early — with no readPixels at all — is enough to zero the number (arm A below).
  //
  // The first version of this probe read eleven times on one page and reported 0.00% at every
  // timestamp for a game that draws 99.1%. That was an artifact of the probe, not a property of
  // the game, and it is recorded here rather than deleted because it is the same defect the
  // subject has: a single read whose value depends on what touched the canvas beforehand.
  if (all || has('--settle')) {
    const series = [];
    const times = [2000, 4000, 6000, 8000, 9000, 10000, 12000, 15000, 20000, 30000];
    for (const t of times) {
      const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1]);
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(t);
      const s = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const n = document.getElementById('boot-notice');
        const rendererUp = !!(window.__ENGINE && window.__ENGINE.renderer);
        const r = window.__criticSample();
        return { ...r, notice: n ? (n.className || 'visible') : 'absent',
                 harness: typeof window.__HARNESS, rendererUp };
      });
      await ctx.close();
      series.push({ t, ...s });
    }

    // How long does boot actually take, here and on a device shaped like the owner's phone?
    // Rule 26: every timing figure gets its load stated. `contention.mjs` is printed by the
    // caller; the CPU/network multipliers are stated per row.
    const bootTimes = [];
    for (const cond of [
      { label: 'unthrottled',                cpu: 1, net: null },
      { label: 'CPU x4 (a mid-range phone)',  cpu: 4, net: null },
      { label: 'CPU x4 + 8 Mbit/s, 80 ms RTT', cpu: 4, net: { downloadThroughput: 8e6 / 8, uploadThroughput: 1e6 / 8, latency: 80 } },
      { label: 'CPU x6 + 4 Mbit/s, 150 ms RTT', cpu: 6, net: { downloadThroughput: 4e6 / 8, uploadThroughput: 1e6 / 8, latency: 150 } },
    ]) {
      const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1]);
      const cdp = await ctx.newCDPSession(page);
      if (cond.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cond.cpu });
      if (cond.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...cond.net });
      const t0 = Date.now();
      let readyMs = null, err = null;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await page.evaluate(async () => { await window.__HARNESS.ready(); }, { timeout: 180000 });
        readyMs = Date.now() - t0;
      } catch (e) { err = String(e.message || e).slice(0, 70); }
      // And what the shipped tool would have measured: read once at its 15 s mark.
      const wait = SHIPPED_WAIT_MS - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      const s = await page.evaluate(() => window.__criticSample()).catch(() => ({ cornerFrac: 0 }));
      await ctx.close();
      bootTimes.push({ ...cond, readyMs, err, cornerAt15: s.cornerFrac,
                       verdictAt15: s.cornerFrac >= MIN_NONBLACK_FRACTION ? 'DREW' : 'BLANK' });
    }

    results.settle = { series, bootTimes };
    console.log('\n--- SETTLE: is 15 s a measurement or a guess? (phone-portrait, one fresh page per row) ---');
    console.log('     t(ms)   corner%   full%   renderer up   notice');
    for (const s of series) {
      console.log(`   ${String(s.t).padStart(6)}   ${(s.cornerFrac * 100).toFixed(2).padStart(6)}   ` +
        `${(s.fullFrac * 100).toFixed(2).padStart(6)}   ${String(s.rendererUp).padEnd(11)}   ${s.notice}`);
    }
    console.log('\n   boot time, and what verify-playable would have concluded at its 15 s mark:');
    console.log('     condition                        boot ready   corner% @15s   verify-playable would say');
    for (const b of bootTimes) {
      console.log(`   ${b.label.padEnd(32)} ${String(b.readyMs === null ? b.err : b.readyMs + ' ms').padEnd(12)} ` +
        `${(b.cornerAt15 * 100).toFixed(2).padStart(9)}      ${b.verdictAt15}`);
    }
  }

  // ---- FRAME: where the sampler looks ---------------------------------------------------------
  if (all || has('--frame')) {
    const rows = [];
    for (const vp of VIEWPORTS) {
      const { ctx, page } = await openPage(browser, origin, vp);
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(SHIPPED_WAIT_MS);
      const s = await page.evaluate(() => window.__criticSample());
      await ctx.close();
      rows.push({ vp: vp.name, ...s });
    }
    results.frame = rows;
    console.log('\n--- FRAME: what does readPixels(0,0,160,160) actually cover? ---');
    console.log('     viewport          canvas       css        corner%   full%   upper-half%');
    for (const r of rows) {
      console.log(`   ${r.vp.padEnd(17)} ${String(r.cw + 'x' + r.ch).padEnd(11)} ${String(r.clientW + 'x' + r.clientH).padEnd(10)} ` +
        `${(r.cornerFrac * 100).toFixed(2).padStart(7)}  ${(r.fullFrac * 100).toFixed(2).padStart(6)}  ${(r.upperFrac * 100).toFixed(2).padStart(9)}`);
    }
    const cw = new Set(rows.map((r) => r.cw + 'x' + r.ch));
    console.log(`   distinct framebuffer sizes across the four "viewports": ${cw.size} (${[...cw].join(', ')})`);
    console.log(`   the sampled window is ${SAMPLE}x${SAMPLE} = ${((SAMPLE * SAMPLE) / (rows[0].cw * rows[0].ch) * 100).toFixed(2)}% of the frame, in its bottom-left corner.`);
  }

  // ---- DARK: is there a legitimate state below the line? ---------------------------------------
  if (all || has('--dark')) {
    // Named states this tree ships, plus the clock. Each is a state a player can be in.
    const cases = [
      { label: 'default, midday',        state: 'default',          hour: 12 },
      { label: 'default, midnight',      state: 'default',          hour: 0 },
      { label: 'default, 03:00',         state: 'default',          hour: 3 },
      { label: 'interior_firelit',       state: 'interior_firelit', hour: 12 },
      { label: 'interior_firelit, night',state: 'interior_firelit', hour: 0 },
      { label: 'dungeon_primary',        state: 'dungeon_primary',  hour: 12 },
      { label: 'dungeon_primary, night', state: 'dungeon_primary',  hour: 0 },
      { label: 'barge-hold',             state: 'barge-hold',       hour: 0 },
      { label: 'cam_cistern, night',     state: 'cam_cistern',      hour: 0 },
    ];
    const rows = [];
    for (const c of cases) {
      const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1]);
      await page.goto(`${origin}/index.html?harness=1&state=${encodeURIComponent(c.state)}`, { waitUntil: 'load', timeout: 120000 });
      let note = '';
      try {
        await page.evaluate(async () => { await window.__HARNESS.ready(); });
        await page.evaluate(async (h) => {
          if (window.__HARNESS.setTimeOfDay) window.__HARNESS.setTimeOfDay(h);
          window.__HARNESS.stepFrames(30);
        }, c.hour);
      } catch (e) { note = String(e.message || e).slice(0, 60); }
      await page.waitForTimeout(2500);
      const s = await page.evaluate(() => window.__criticSample());
      await ctx.close();
      rows.push({ ...c, ...s, note });
    }
    results.dark = rows;
    console.log('\n--- DARK: legitimate states, measured against the 2% line ---');
    console.log('     state                      corner%   full%    corner verdict');
    for (const r of rows) {
      const verdict = r.cornerFrac >= MIN_NONBLACK_FRACTION ? 'passes' : 'CALLED BLANK';
      console.log(`   ${r.label.padEnd(26)} ${(r.cornerFrac * 100).toFixed(2).padStart(7)}  ${(r.fullFrac * 100).toFixed(2).padStart(6)}   ${verdict}${r.note ? '  (' + r.note + ')' : ''}`);
    }
  }

  // ---- SABOTAGE: does it go red on the failure that actually happened? --------------------------
  if (all || has('--sabotage')) {
    const arms = [
      { label: 'three.module.js  (their self-test arm)', glob: '**/three.module.js' },
      { label: 'hold-gate.js     (the real defect)',      glob: '**/hold-gate.js' },
      { label: 'engine.js        (a mid-graph module)',   glob: '**/engine.js' },
      { label: 'data/index.json  (a data 404)',           glob: '**/data/index.json' },
      // `data/regions/**` was the first choice here and matched NOTHING — that directory does not
      // exist — so the arm was inert and its PASS meant nothing (rule 6). `progression/` is a
      // directory the engine names in its own boot error, so it is certainly fetched.
      { label: 'one data dir     (a leaf 404)',           glob: '**/data/progression/**' },
      // The question this arm answers is whether 99.1% non-black means "the game loaded" or
      // merely "a WebGL context exists and was cleared to something that is not black". Block
      // every data file: the renderer comes up, the world does not. If the corner still reads
      // over 2%, the threshold is not measuring what the tool's header says it measures.
      { label: 'ALL of data/     (renderer up, no world)', glob: '**/data/**' },
    ];
    const rows = [];
    for (const a of arms) {
      const { ctx, page, errors, bad } = await openPage(browser, origin, VIEWPORTS[1], { block: a.glob });
      await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(SHIPPED_WAIT_MS);
      const s = await page.evaluate(() => {
        const r = window.__criticSample();
        const n = document.getElementById('boot-notice');
        r.noticeVisible = !!n && n.className !== 'gone';
        r.noticeText = r.noticeVisible ? (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) : '';
        return r;
      });
      await ctx.close();
      // verify-playable's own verdict, reconstructed from the same inputs it uses.
      const drew = s.canvas && s.cornerFrac >= MIN_NONBLACK_FRACTION;
      const ok = drew && !s.noticeVisible && errors.length === 0 && bad.length === 0;
      rows.push({ ...a, cornerFrac: s.cornerFrac, noticeVisible: s.noticeVisible, noticeText: s.noticeText,
                  errors: errors.length, bad: bad.length, verifyPlayableSays: ok ? 'PASS' : 'FAIL' });
    }
    results.sabotage = rows;
    console.log('\n--- SABOTAGE: block one file at a time; verify-playable must go red on every row ---');
    console.log('     blocked                                   corner%   notice up   errs  4xx   verify-playable');
    for (const r of rows) {
      console.log(`   ${r.label.padEnd(41)} ${(r.cornerFrac * 100).toFixed(2).padStart(6)}   ${String(r.noticeVisible).padEnd(9)}   ` +
        `${String(r.errors).padStart(4)}  ${String(r.bad).padStart(3)}   ${r.verifyPlayableSays}`);
      if (r.noticeText) console.log(`        notice said: "${r.noticeText}"`);
    }
  }

  // ---- NOTICE: when does it hide, and can it still speak afterwards? ---------------------------
  if (all || has('--notice')) {
    // Instrument the page before any of its script runs: record when the harness appears, when
    // the notice hides, and when boot actually resolves — all on one clock.
    const spy = `
      window.__criticLog = { t0: Date.now(), events: [], fetches: [] };
      (function () {
        const L = window.__criticLog;
        // Record every fetch the page makes, with its completion time, BEFORE the boot notice's
        // own wrapper is installed — so this observer is underneath it and sees the real calls.
        const real = window.fetch;
        L.nativeFetch = real;
        window.fetch = function () {
          const started = Date.now() - L.t0;
          return real.apply(this, arguments).then((res) => {
            L.fetches.push({ started, done: Date.now() - L.t0, ok: res.ok, url: String(res.url).split('/').slice(-2).join('/') });
            return res;
          });
        };
        const iv = setInterval(function () {
          const n = document.getElementById('boot-notice');
          if (n && n.className === 'gone' && !L.hiddenAt) L.hiddenAt = Date.now() - L.t0;
          if (window.__HARNESS && !L.harnessAt) L.harnessAt = Date.now() - L.t0;
          if (L.hiddenAt && L.harnessAt) { /* keep polling for fetch tail */ }
        }, 10);
        L.stop = () => clearInterval(iv);
      })();
    `;
    const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1], { init: spy });
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    const readyAt = await page.evaluate(async () => {
      await window.__HARNESS.ready();
      return Date.now() - window.__criticLog.t0;
    });
    await page.waitForTimeout(3000);
    const log = await page.evaluate(() => {
      const L = window.__criticLog;
      const n = document.getElementById('boot-notice');
      return {
        harnessAt: L.harnessAt, hiddenAt: L.hiddenAt,
        fetchCount: L.fetches.length,
        fetchesAfterHide: L.fetches.filter((f) => L.hiddenAt && f.done > L.hiddenAt).length,
        lastFetchAt: L.fetches.length ? Math.max(...L.fetches.map((f) => f.done)) : null,
        patched: window.fetch !== L.nativeFetch,
        noticeClass: n ? n.className : 'absent',
      };
    });

    // Can the notice still report a 404 after it has hidden? This is the question that decides
    // whether the diagnostic covers the load or only the first instant of it.
    const afterHide = await page.evaluate(async () => {
      const before = document.getElementById('boot-notice').className;
      try { await window.fetch('./definitely-missing-' + Date.now() + '.json'); } catch (e) { /* ignore */ }
      await new Promise((r) => setTimeout(r, 400));
      const n = document.getElementById('boot-notice');
      return { before, after: n.className, text: (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) };
    });
    await ctx.close();
    results.notice = { ...log, readyAt, afterHide };
    console.log('\n--- NOTICE: hide timing, and whether it can still speak ---');
    console.log(`   window.__HARNESS appeared at   ${log.harnessAt} ms`);
    console.log(`   boot notice hid at             ${log.hiddenAt} ms`);
    console.log(`   boot() actually resolved at    ${readyAt} ms`);
    console.log(`   => the notice was down for the last ${readyAt - log.hiddenAt} ms of loading`
      + ` (${(100 * (readyAt - log.hiddenAt) / readyAt).toFixed(0)}% of the whole load).`);
    console.log(`   fetches the page made          ${log.fetchCount}, of which ${log.fetchesAfterHide} completed after the notice hid`);
    console.log(`   window.fetch still patched     ${log.patched}`);
    console.log(`   a 404 provoked AFTER the hide: notice class '${afterHide.before}' -> '${afterHide.after}'`
      + (afterHide.after === 'gone' ? '  (SILENT — the wrapper is still installed but `done` gates it)' : ''));
  }

  // ---- FETCH WRAPPER: does the monkey-patch perturb the game? -----------------------------------
  if (all || has('--notice')) {
    // Serve index.html twice: once as shipped, once with the fetch-wrapper block removed, and
    // compare a determinism hash and the load time. Nothing on disk is edited; the substitution
    // is done in the route handler. If the two hashes differ, a diagnostic changed the game.
    const { readFileSync } = await import('node:fs');
    const shipped = readFileSync(join(dir, 'index.html'), 'utf8');
    const WRAPPER = shipped.slice(shipped.indexOf('  if (window.fetch) {'), shipped.indexOf('  // Progress, so a slow connection'));
    if (!WRAPPER || WRAPPER.length < 100) {
      console.log('\n--- FETCH WRAPPER: could not locate the wrapper block in index.html; skipped. ---');
    } else {
      const stripped = shipped.replace(WRAPPER, '  // [critic] fetch wrapper removed for the control arm\n\n');
      const runOnce = async (body, label) => {
        const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1], {
          routeHtml: (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }),
        });
        const t0 = Date.now();
        await page.goto(url, { waitUntil: 'load', timeout: 120000 });
        await page.evaluate(async () => { await window.__HARNESS.ready(); });
        const loadMs = Date.now() - t0;
        const out = await page.evaluate(() => {
          window.__HARNESS.setSeed(12345);
          window.__HARNESS.reset({ seed: 12345, state: 'default' });
          window.__HARNESS.stepFrames(300);
          const snap = window.__HARNESS.snapshot ? window.__HARNESS.snapshot() : null;
          return { frame: window.__HARNESS.getFrame(), seed: window.__HARNESS.getSeed(),
                   snap: JSON.stringify(snap).length, hash: JSON.stringify(snap).slice(0, 0) || null,
                   digest: (function (s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; })(JSON.stringify(snap)),
                   patched: window.fetch.toString().indexOf('native code') === -1 };
        });
        await ctx.close();
        return { label, loadMs, ...out };
      };
      const armPatched = await runOnce(shipped, 'as shipped (wrapper present)');
      const armClean = await runOnce(stripped, 'wrapper removed (control)');
      results.fetchWrapper = { armPatched, armClean };
      console.log('\n--- FETCH WRAPPER: delete-the-diagnostic, and compare (rule 6) ---');
      for (const a of [armPatched, armClean]) {
        console.log(`   ${a.label.padEnd(30)} load ${String(a.loadMs).padStart(6)} ms   frame ${a.frame}   seed ${a.seed}   snapshot digest ${a.digest}   window.fetch patched=${a.patched}`);
      }
      console.log(`   determinism: digests ${armPatched.digest === armClean.digest ? 'MATCH — the wrapper does not perturb the simulation'
        : 'DIFFER — the wrapper changes the simulation'}`);
      console.log(`   the control arm genuinely differs: window.fetch patched ${armPatched.patched} vs ${armClean.patched}`
        + (armPatched.patched === armClean.patched ? '  <-- INERT CONTROL, the teardown did nothing (rule 6)' : '  (the teardown bit)'));
    }
  }

  // ---- PAGES404: a static host does not abort, it answers 404 with an HTML body ----------------
  //
  // verify-playable's self-test sabotages with `route.abort()`. That is a *connection failure*,
  // and it is not what happened to this project. GitHub Pages answers a missing path with
  // `HTTP 404` and a `text/html` error page — a response that arrives, resolves, and has a body.
  // The two are different events in the browser: an abort fires `requestfailed`, a 404 fires
  // `response` with a status. A checker whose sabotage arm only ever produces the first has never
  // been shown to detect the second, which is the one that reaches real users.
  //
  // This runs both shapes against the same three targets and puts the verdicts side by side.
  if (all || has('--pages404')) {
    const PAGES_404 = '<!DOCTYPE html><html><head><title>Site not found &middot; GitHub Pages</title></head>'
      + '<body><h1>404</h1><p>There isn&rsquo;t a GitHub Pages site here.</p></body></html>';
    const targets = [
      { label: 'hold-gate.js (module)',      glob: '**/hold-gate.js' },
      { label: 'data/index.json (manifest)', glob: '**/data/index.json' },
      { label: 'data/progression/** (leaf)', glob: '**/data/progression/**' },
    ];
    const rows = [];
    for (const t of targets) {
      for (const shape of ['abort', '404']) {
        const { ctx, page, errors, bad } = await openPage(browser, origin, VIEWPORTS[1]);
        let hits = 0;
        await page.route(t.glob, (route) => {
          hits++;
          if (shape === 'abort') return route.abort();
          return route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: PAGES_404 });
        });
        await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
        await page.waitForTimeout(SHIPPED_WAIT_MS);
        const s = await page.evaluate(() => {
          const r = window.__criticSample();
          const n = document.getElementById('boot-notice');
          r.noticeVisible = !!n && n.className !== 'gone';
          r.noticeText = (n && n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          return r;
        }).catch(() => ({ cornerFrac: 0, noticeVisible: false, noticeText: '' }));
        await ctx.close();
        const drew = s.canvas && s.cornerFrac >= MIN_NONBLACK_FRACTION;
        const verdict = (drew && !s.noticeVisible && errors.length === 0 && bad.length === 0) ? 'PASS' : 'FAIL';
        rows.push({ target: t.label, shape, hits, cornerFrac: s.cornerFrac,
                    noticeVisible: s.noticeVisible, noticeText: s.noticeText,
                    errors: errors.length, bad: bad.length, verdict });
      }
    }
    results.pages404 = rows;
    console.log('\n--- PAGES404: abort (what the self-test simulates) vs 404 (what a static host does) ---');
    console.log('     target                      shape   intercepts  corner%   notice up   verify-playable');
    for (const r of rows) {
      // An arm that intercepted nothing is inert and its verdict is worthless — say so in the row.
      const inert = r.hits === 0 ? '  <-- INERT: matched no request' : '';
      console.log(`   ${r.target.padEnd(27)} ${r.shape.padEnd(7)} ${String(r.hits).padStart(10)}  ` +
        `${(r.cornerFrac * 100).toFixed(2).padStart(7)}   ${String(r.noticeVisible).padEnd(9)}   ${r.verdict}${inert}`);
      if (r.noticeVisible) console.log(`        notice said: "${r.noticeText}"`);
    }
  }

  // ---- NOTICE2: exactly when does it hide, on a MutationObserver ---------------------------------
  if (all || has('--notice2')) {
    const spy = `
      window.__nt = { t0: Date.now() };
      // addInitScript runs at document-start, where document.documentElement is still null —
      // observing it throws and silently kills the rest of this script. Observe \`document\`,
      // which always exists. (The first version of this spy did throw here, and reported
      // "harness at undefined ms" rather than failing loudly, which is its own small lesson.)
      new MutationObserver(function (recs) {
        for (const r of recs) {
          const el = r.target;
          if (el && el.id === 'boot-notice' && el.className === 'gone' && !window.__nt.hiddenAt)
            window.__nt.hiddenAt = Date.now() - window.__nt.t0;
        }
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
      (function poll() {
        if (window.__HARNESS && !window.__nt.harnessAt) window.__nt.harnessAt = Date.now() - window.__nt.t0;
        if (window.__ENGINE && window.__ENGINE.renderer && !window.__nt.rendererAt)
          window.__nt.rendererAt = Date.now() - window.__nt.t0;
        if (!window.__nt.harnessAt || !window.__nt.rendererAt) setTimeout(poll, 5);
      })();
    `;
    const rows = [];
    for (const cond of [{ label: 'unthrottled', cpu: 1 }, { label: 'CPU x4 (a phone)', cpu: 4 }]) {
      const { ctx, page } = await openPage(browser, origin, VIEWPORTS[1], { init: spy });
      const cdp = await ctx.newCDPSession(page);
      if (cond.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cond.cpu });
      await page.goto(url, { waitUntil: 'load', timeout: 180000 });
      const readyAt = await page.evaluate(async () => {
        await window.__HARNESS.ready(); return Date.now() - window.__nt.t0;
      });
      // How long after the notice hid did the first drawn frame appear? Read on a fresh timeline:
      // sample the framebuffer only now, so the read cannot latch (see SETTLE).
      const nt = await page.evaluate(() => ({ ...window.__nt }));
      await ctx.close();
      rows.push({ ...cond, ...nt, readyAt });
    }
    results.notice2 = rows;
    console.log('\n--- NOTICE2: when the notice hides, against when the world is actually there ---');
    console.log('     condition           harness at   notice hid at   renderer at   boot resolved at   blind gap');
    for (const r of rows) {
      const gap = r.readyAt - (r.hiddenAt ?? 0);
      console.log(`   ${r.label.padEnd(19)} ${String(r.harnessAt + ' ms').padEnd(12)} ${String((r.hiddenAt ?? '-') + ' ms').padEnd(15)} ` +
        `${String(r.rendererAt + ' ms').padEnd(13)} ${String(r.readyAt + ' ms').padEnd(18)} ${gap} ms ` +
        `(${(100 * gap / r.readyAt).toFixed(0)}% of the load, with nothing on screen and no message)`);
    }
  }

  mkdirSync(join(SCRATCH, 'critic-deploy'), { recursive: true });
  writeFileSync(join(SCRATCH, 'critic-deploy', 'probe.json'), JSON.stringify(results, null, 1));
  console.log(`\ncritic-deploy-probe: raw numbers at ${join(SCRATCH, 'critic-deploy', 'probe.json')}`);
} finally {
  await browser.close();
  await close();
}
