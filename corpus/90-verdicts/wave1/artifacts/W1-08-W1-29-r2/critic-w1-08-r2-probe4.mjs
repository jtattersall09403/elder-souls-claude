#!/usr/bin/env node
// probe 4 — re-derive M-P20 independently (I do not import the builder's mp20), and break it.
import { launchGame } from '../lib/browser.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const R = { at: new Date().toISOString(), load_at_start: readFileSync('/proc/loadavg', 'utf8').trim(), legs: {} };
const bank = (n, o) => { R.legs[n] = o; writeFileSync(path.join(OUT, 'probe4.json'), JSON.stringify(R, null, 2)); console.log(`[${n}] ${JSON.stringify(o).slice(0, 2000)}`); };
const handle = await launchGame({ width: 844, height: 390 });
const { page } = handle;
try {
  await page.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE && window.__ENGINE.real), null, { timeout: 180000 });

  const run = (scale) => page.evaluate((SCALE) => {
    const H = window.__HARNESS;
    const cv = document.querySelector('canvas#view');
    cv.width = 844 * 2; cv.height = 390 * 2;
    window.__ENGINE.renderer.setSize(cv.width, cv.height);
    H.reset({ state: 'ui-journal' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H.stepFrames(2);
    const cssPerDevice = 390 / cv.height;
    const out = [];
    const measure = (label, open, opts) => {
      H.renderedTextClear();
      try { open(); } catch (e) { out.push({ label, error: String(e && e.message).slice(0, 140) }); return; }
      H.stepFrames(2);
      const ui = H.getUIState();
      const hud = (ui.elements || []).filter((e) => e.id.startsWith('hud.')).map((e) => e.rect);
      const t = H.getRenderedText(opts || {});
      const all = t.entries || [];
      const inHud = (e) => hud.some((r) => e.x >= r[0] - 2 && e.x <= r[0] + r[2] + 2 && e.y >= r[1] - 2 && e.y <= r[1] + r[3] + 2);
      const runs = all.filter((e) => !inHud(e));
      if (!runs.length) { out.push({ label, runs: 0, before_hud_filter: all.length, measurable: false }); return; }
      let min = Infinity, txt = null, minRaw = null;
      for (const e of runs) { const css = e.px * cssPerDevice; if (css < min) { min = css; txt = e.text; minRaw = e.px; } }
      // ALSO report the HUD runs I am excluding, because nothing else in the suite measures them
      let hmin = Infinity, htxt = null;
      for (const e of all.filter(inHud)) { const css = e.px * cssPerDevice; if (css < hmin) { hmin = css; htxt = e.text; } }
      out.push({ label, runs: runs.length, hud_excluded: all.length - runs.length,
                 min_css_px: +min.toFixed(2), raw_px: minRaw, smallest: String(txt).slice(0, 60),
                 hud_min_css_px: Number.isFinite(hmin) ? +hmin.toFixed(2) : null, hud_smallest: htxt });
    };
    measure('dialogue', () => { H.closeMenu(); H.censusBegin({}); H.censusEnter(); }, { surface: 'dialogue' });
    measure('journal', () => { H.uiClose(); H.reset({ state: 'ui-journal' }); H.setRenderRate(0); H.openMenu('journal'); }, { surface: 'menus' });
    measure('book', () => {
      H.closeMenu(); let id = null;
      for (const doc of Object.values(window.__ENGINE.data.books || {})) {
        const b = Array.isArray(doc.books) ? doc.books[0] : doc; if (b && b.id) { id = b.id; break; }
      }
      H.openMenu('book', { id });
    }, { surface: 'menus' });
    H.closeMenu(); H.censusBegin({});
    return { legs: out, floor: H.getViewport().min_text_css_px, cssPerDevice: +cssPerDevice.toFixed(4), buffer: [cv.width, cv.height] };
  }, scale);

  const base = await run(1);
  bank('MP20_rederived', base);

  // BREAK IT: shrink the type scale and confirm my own minimum moves DOWN with it.
  const broken = await page.evaluate(async () => {
    const H = window.__HARNESS;
    const mod = window.__ENGINE.ui;
    // Find the type scale the interface reads and halve it, whatever it is called.
    const before = window.__ENGINE.renderer.uiScale ?? null;
    return { note: 'scale hook probe', before, keys: Object.keys(window.__ENGINE.ui || {}).slice(0, 20) };
  });
  bank('MP20_break_probe', broken);
  console.log('DONE');
} catch (e) {
  console.log('ERR', String(e && e.stack || e));
  R.error = String(e && e.stack || e).slice(0, 2000);
  writeFileSync(path.join(OUT, 'probe4.json'), JSON.stringify(R, null, 2));
} finally { await handle.close(); }
