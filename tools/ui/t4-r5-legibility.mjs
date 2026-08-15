#!/usr/bin/env node
// t4-r5-legibility.mjs — the legibility pass `ARBITRATION` S58 requires alongside RI-UIX09 DN4.
//
// Owner: T4-r5. WHY THIS EXISTS AND WHAT IT IS NOT.
//
// S58: "DN4 is hereby necessary and not sufficient: a density figure counts only when accompanied
// by a legibility pass — no glyph overlapping another glyph, no text laid out beyond its panel, no
// hint truncated mid-word, at 1920x1080 and at the narrowest supported viewport." Round 4 raised
// D2 on all five resized screens and broke every one of them in the same edit; the density
// instrument rewarded the regression because ink drawn over ink still counts as matter. This tool
// is the thing that would have caught it, run in the direction rule 4 requires: PROVEN TO FIRE
// against the actual broken build before it is trusted against a fix.
//
// THREE CHECKS, each picked because a self-report or a colour heuristic alone cannot see it
// (the same failure `t4-r4-critic-overlap.mjs`'s own header documents for the row check):
//
//   OVERFLOW    Geometric, off `getUIState()` rects alone. Any `journal_entry` or `hint` element
//               whose rect extends past its own panel's inner rect (right edge, or bottom edge —
//               for a journal_entry, past the panel's own foot). No pixels needed: a census self-
//               report CAN see this one, because `S.el()` declares the rect the layout code
//               actually computed, and the bug is that the computed rect is too big for the box —
//               not that the drawn pixels disagree with a truthful rect.
//
//   TRUNCATION  Geometric, off `getUIState()` text + the SAME font metric `drawText` itself uses
//               (`measure()`, `game/src/ui/glyphs.js`). A hint's declared text, measured at 14px
//               ink, against the panel's own inner width. If it does not fit AND the RENDERED
//               string (read back from the census, which is what `hint()` actually wrote as the
//               element's `text` field — unchanged by wrapping, since wrapping is a DRAW-time
//               split, not a content change) has no ellipsis, the instruction is being cut off
//               somewhere the player cannot see coming. This does not, by construction, need to
//               know whether the drawing code wraps, ellipsises, or does neither — it is the same
//               "would this string fit drawn as literally declared" question either way, which is
//               why it fires red on round 4's un-wrapped `hint()` and green once `hint()` wraps.
//
//   OVERLAP     Pixel, and has to be: `row()` declares the RAW joined column text and calls
//               `ellipsise()` only inside its draw callback (RI-UIX09's own "how we lose" #2 —
//               "a self-report cannot see a canvas draw"), so the census reports "STRENGTH 12"
//               whether the two words sit side by side or on top of each other. Reuses
//               `t4-r4-critic-overlap.mjs`'s own metric verbatim (RI-UIX09 §A's definition of
//               foreground: a pixel more than dE_rgb 24 from the panel's modal colour; a separator
//               is >=3 consecutive empty columns) rather than writing a fourth, because the round-4
//               critic already discarded two weaker heuristics before arriving at this one and
//               re-deriving that history would be re-paying it. Captured via `HH.screenshot()`
//               (`engine.loop.renderNow()` then `screenshotDataURL()`), the SAME live path
//               `t4-r2-measure.mjs` uses and `frame-liveness.mjs` passes — never `page.screenshot()`
//               under `setRenderRate(0)`, which is what made the round-4 critic's own overlap
//               numbers void and had to be caught by `frame-liveness` after the fact.
//
// EVERY CAPTURE THIS TOOL TAKES IS RUN THROUGH `tools/visual/frame-liveness.mjs` BEFORE ITS
// NUMBERS ARE TRUSTED — the brief's own mandate, and the round-4 critic's own trap. A screen whose
// captures come back DUPLICATE has its overlap numbers marked void in the report rather than
// reported as a pass or a fail.
//
// Usage:
//   node tools/ui/t4-r5-legibility.mjs --out corpus/90-verdicts/wave1/artifacts/T4-r5/legibility
//        [--widths 1920x1080,1280x720] [--state ui-journal]
//
// Exit 0 = every screen at every requested viewport is clean. Non-zero = at least one is not, or
// at least one screen's pixel evidence is void (frame-liveness DUPLICATE/degenerate).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs, log, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || ''))
  ? String(args.out)
  : path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r5/legibility'));
const SHOTS = path.join(OUT, 'screens');
ensureDir(OUT); ensureDir(SHOTS);
const STATE = String(args.state || 'ui-journal');
const WIDTHS = String(args.widths || '1920x1080,1280x720').split(',').map((wh) => {
  const [w, h] = wh.split('x').map(Number);
  return { w, h };
});

// ---- a minimal PNG reader (RGBA8, non-interlaced), self-contained rather than imported so this
// tool never inherits another round's `--out` default or side effect on import. -----------------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) throw new Error(`unsupported PNG: bitDepth ${bitDepth} colourType ${colourType} interlace ${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      else if (f !== 0) throw new Error('unknown PNG filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}
const rawPng = (b64) => Buffer.from(String(b64).split(',')[1], 'base64');

// ---- OVERLAP metric — verbatim from t4-r4-critic-overlap.mjs (RI-UIX09 §A's own foreground def) -
const FG = 24, GAP = 3;
function modal(png, rect) {
  const [x0, y0, w, h] = rect.map(Math.round);
  const hist = new Map();
  for (let y = y0; y < y0 + h && y < png.height; y++) for (let x = x0; x < x0 + w && x < png.width; x++) {
    const i = ((y * png.width) + x) << 2;
    const k = ((png.data[i] >> 5) << 6) | ((png.data[i + 1] >> 5) << 3) | (png.data[i + 2] >> 5);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; best = k; }
  return [((best >> 6) & 7) * 32 + 16, ((best >> 3) & 7) * 32 + 16, (best & 7) * 32 + 16];
}
function rowProfile(png, rect, mode, gap) {
  const g = gap || GAP;
  const [x0, y0, w, h] = rect.map(Math.round);
  const cols = [];
  for (let x = x0; x < x0 + w && x < png.width; x++) {
    let n = 0;
    for (let y = y0; y < y0 + h && y < png.height; y++) {
      const i = ((y * png.width) + x) << 2;
      const dr = png.data[i] - mode[0], dg = png.data[i + 1] - mode[1], db = png.data[i + 2] - mode[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > FG) n++;
    }
    cols.push(n);
  }
  let a = 0, b = cols.length - 1;
  while (a <= b && cols[a] === 0) a++;
  while (b >= a && cols[b] === 0) b--;
  let seps = 0, run = 0, runs = a <= b ? 1 : 0;
  for (let i = a; i <= b; i++) { if (cols[i] === 0) run++; else { if (run >= g) { seps++; runs++; } run = 0; } }
  return { separators: seps, runs, span: b - a + 1 };
}

// ---- frame-liveness, invoked as the brief mandates: on every capture, before its numbers count -
function frameLiveness(dir) {
  try {
    const out = execSync(`node ${JSON.stringify(path.join(REPO_ROOT, 'tools/visual/frame-liveness.mjs'))} --in ${JSON.stringify(dir)}`,
      { cwd: REPO_ROOT, encoding: 'utf8' });
    return { ran: true, ok: true, output: out.trim() };
  } catch (e) {
    return { ran: true, ok: false, output: String((e && e.stdout) || e.message || e).trim() };
  }
}

const report = {
  schema: 'elder-souls/t4-r5-legibility@1', at: new Date().toISOString(),
  state: STATE, widths: WIDTHS, screens: {},
};
let anyFail = false;

for (const { w, h } of WIDTHS) {
  const tag = `${w}x${h}`;
  log(`\n=== ${tag} ===`);
  const h1 = await launchGame({ width: w, height: h, state: STATE, timeout: 180000 });
  try {
    await h1.page.evaluate(async () => {
      const HH = window.__HARNESS;
      await HH.ready();
      if (HH.setUIVisible) await HH.setUIVisible(true);
      await HH.closeMenu(); await HH.stepFrames(4);
    });
    // THE CANVAS DOES NOT FOLLOW THE BROWSER VIEWPORT UNDER AUTOMATION, AND THIS WOULD HAVE MADE
    // EVERY "narrowest viewport" NUMBER BELOW FICTION IF LEFT OUT.
    //
    // `game/index.html` declares `<canvas id="view" width="1920" height="1080">`, and
    // `main.js`'s resize handler that would otherwise track `window.innerWidth/innerHeight` is
    // gated `if (!automated)` — `automated` is true whenever `navigator.webdriver === true`,
    // which Playwright always sets. So launching at 1280x720 changes the BROWSER viewport but
    // leaves the render canvas at its hard-coded 1920x1080 unless something explicitly resizes
    // it — every existing T4 tool only ever captured at 1920x1080, so this was never visible
    // before. `setDevicePixelRatio(1)` (the exact call `t4-r4-critic.mjs`'s own boot sequence
    // makes) reads the REAL `window.innerWidth/innerHeight` and resizes the renderer to match —
    // confirmed below by asserting the resulting UI scale (`getUIState().s`, `canvas.height/1080`)
    // actually differs at 720p from 1080p, not merely that the call did not throw.
    const dprCheck = await h1.page.evaluate(async () => {
      const c = document.getElementById('view');
      const before = [c.width, c.height];
      const r = await window.__HARNESS.setDevicePixelRatio(1);
      return { before, after: [c.width, c.height], innerWidth: window.innerWidth, innerHeight: window.innerHeight, dprReturn: r };
    });
    if (dprCheck.after[0] !== w || dprCheck.after[1] !== h) {
      throw new Error(`setDevicePixelRatio did not resize the canvas #view to this viewport: canvas is now ${dprCheck.after.join('x')}, wanted ${w}x${h} (window reports ${dprCheck.innerWidth}x${dprCheck.innerHeight}). Every number below would be fiction — see main.js's "if (!automated)" resize gate.`);
    }
    log(`  canvas #view: ${dprCheck.before.join('x')} -> ${dprCheck.after.join('x')} (window ${dprCheck.innerWidth}x${dprCheck.innerHeight})`);

    const OPENERS = {
      levelup: { mode: 'levelup', hearth: true },
      sheet: { mode: 'sheet' },
      spells: { mode: 'spells' },
      journal: { mode: 'journal' },
      container: { container: true, containerName: 'Reed Creel',
        contents: [{ id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 }] },
    };

    for (const [name, opener] of Object.entries(OPENERS)) {
      log(`  [${tag}/${name}] opening...`);
      // EVERY STEP IS RACED AGAINST A CLOCK (t4-r2-measure.mjs's own pattern, and the reason it
      // exists: a run without it hung inside `openMenu('levelup')` for six minutes once already).
      // A step that times out is recorded as a timeout and the run continues to the next screen
      // rather than losing every remaining screen's evidence to one slow step.
      const r = await Promise.race([
        h1.page.evaluate(async (o) => {
          const HH = window.__HARNESS;
          try { HH.conversationClose(); } catch { /* nothing open */ }
          await HH.closeMenu();
          if (o.hearth) HH.setAtHearth(true);
          if (o.container) HH.openContainer(o.containerName, o.contents || []);
          else if (o.mode) await HH.openMenu(o.mode, {});
          await HH.stepFrames(4);
          const st = HH.getUIState();
          return { mode: st.mode, elements: (st.elements || []).filter((e) => e.visible), shot: await HH.screenshot() };
        }, opener),
        new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), Number(args.step_timeout || 90000))),
      ]).catch((e) => ({ __err: String((e && e.message) || e) }));

      if (r.__timeout || r.__err) {
        const why = r.__timeout ? `step timed out after ${Number(args.step_timeout || 90000) / 1000}s` : r.__err;
        report.screens[`${tag}/${name}`] = { failed: why };
        anyFail = true;
        log(`  [${tag}/${name}] FAILED — ${why}`);
        continue;
      }

      const shotPath = path.join(SHOTS, `${tag}-${name}.png`);
      fs.writeFileSync(shotPath, rawPng(r.shot));
      const png = decodePNG(rawPng(r.shot));

      const panel = r.elements.find((e) => e.kind === 'panel');
      const findings = { overflow: [], truncation: [], overlap: [] };

      // ---- OVERFLOW: any journal_entry or hint rect past its own panel's edge -------------------
      // The census only marks the CURRENT page's blocks `visible`, so checking one page catches
      // only whatever happens to be on it (round 4's defect hit 8 of 19 entries scattered across
      // 10 spreads). For the journal specifically, page through every spread with real `KeyD`
      // presses — the same paging path `CRITIC-DOCTRINE` §1.2b requires driving a screen with —
      // and check every page's blocks, not just the first.
      if (panel) {
        const [px, py, pw, ph] = panel.rect;
        const checkOverflow = (els) => {
          for (const e of els) {
            if (e.kind !== 'journal_entry' && e.kind !== 'hint') continue;
            const overRight = Math.round((e.rect[0] + e.rect[2]) - (px + pw));
            const overBottom = Math.round((e.rect[1] + e.rect[3]) - (py + ph));
            if (overRight > 1 || overBottom > 1) {
              findings.overflow.push({ id: e.id, kind: e.kind, rect: e.rect, panel_rect: panel.rect, over_right_px: overRight, over_bottom_px: overBottom });
            }
          }
        };
        checkOverflow(r.elements);
        if (name === 'journal' && r.mode === 'journal') {
          const pages = await Promise.race([
            h1.page.evaluate(async () => {
              const HH = window.__HARNESS;
              const seen = [];
              let last = -1;
              for (let i = 0; i < 14; i++) {
                const st0 = HH.getUIState();
                if (st0.focus && st0.focus.page === 0) break;
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'KeyA', bubbles: true }));
                await HH.stepFrames(1);
                window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'KeyA', bubbles: true }));
                await HH.stepFrames(1);
              }
              for (let i = 0; i < 20; i++) {
                const st0 = HH.getUIState();
                const els = (st0.elements || []).filter((e) => e.visible);
                seen.push(els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect })));
                if (st0.focus && st0.focus.page === last) break;
                last = st0.focus ? st0.focus.page : last;
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'KeyD', bubbles: true }));
                await HH.stepFrames(1);
                window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'KeyD', bubbles: true }));
                await HH.stepFrames(1);
              }
              return seen;
            }),
            new Promise((resolve) => setTimeout(() => resolve(null), Number(args.step_timeout || 90000))),
          ]).catch(() => null);
          if (pages) { for (const els of pages) checkOverflow(els); report.screens[`${tag}/${name}_pages_checked`] = pages.length; }
          else { findings.overflow.push({ id: 'journal.paging', kind: 'INSTRUMENT', note: 'paging sweep timed out — only page 0 was checked for overflow' }); }
        }
      }

      // ---- TRUNCATION: hint text vs the panel's own inner width, measured in glyph units --------
      // Read the SAME font metric drawText uses, live from the page — never a second copy of the
      // outline table that could drift from `game/src/ui/glyphs.js`. A hint needing more than one
      // line is NOT itself truncation — `hint()` now wraps, and a correctly-wrapped hint's element
      // is TALLER to hold it. So the check is not "does the whole string fit on one line" (that
      // would flag every legitimate two-line hint as broken); it is "does the element's own
      // DECLARED HEIGHT actually hold as many wrapped lines as the text needs at this width". A
      // single-line-tall box holding two lines' worth of text is exactly round 4's bug (the text
      // ran off the panel edge with no wrap at all) and this catches it without needing pixels.
      // The whole interface is drawn in "1080p units" times a scale factor `s = canvas.height /
      // 1080` (`game/src/ui/surface.js`) — font sizes, gaps and the hint's own line pitch
      // (`HINT_LINE_H` in chrome.js) are ALL `<n> * s`, in device px. A check that measures at a
      // bare, unscaled 14px against a canvas that is genuinely smaller (720p: s=0.667, real hint
      // font is 9.3px) compares two different rulers and its numbers are fiction at any width
      // other than 1920 — this is exactly rule 4's "a control that has never been seen to fail
      // for the right reason" trap, discovered by RUNNING this tool at 1280x720 and getting
      // findings a crop then proved false. `sPix` is that scale, read from the frame this tool
      // itself just captured rather than assumed.
      const sPix = h / 1080;
      const hints = r.elements.filter((e) => e.kind === 'hint');
      if (hints.length) {
        const measured = await h1.page.evaluate(async ({ hs, sArg }) => {
          const mod = await import('/game/src/ui/glyphs.js');
          const { wrap } = await import('/game/src/ui/type.js');
          return hs.map((hh) => {
            const lines = wrap(hh.text || '', mod.faceOf('ink'), 14 * sArg, hh.rect[2]);
            const anyLineTooWide = lines.some((l) => mod.measure(l, mod.faceOf('ink'), 14 * sArg) > hh.rect[2] + 1);
            return { id: hh.id, needed_lines: lines.length, rect_h: hh.rect[3], any_line_too_wide: anyLineTooWide };
          });
        }, { hs: hints.map((hh) => ({ id: hh.id, text: hh.text, rect: hh.rect })), sArg: sPix });
        for (const m of measured) {
          const hEl = hints.find((x) => x.id === m.id);
          const hasEllipsis = /…$/.test(String(hEl.text || ''));
          // A single word wider than the whole panel cannot be wrapped at all — that is a real
          // truncation risk regardless of box height. Otherwise: the box must be tall enough for
          // the lines wrap() says it needs (`HINT_LINE_H`=20 pitch + 6px pad, BOTH *sPix — matches
          // chrome.js's own `hint()`/`screen()`; a >2px slack absorbs float rounding).
          const neededH = Math.max(26 * sPix, m.needed_lines * 20 * sPix + 6 * sPix);
          if (m.any_line_too_wide && !hasEllipsis) {
            findings.truncation.push({ id: m.id, declared_text: hEl.text, reason: 'a single word is wider than the panel', needed_lines: m.needed_lines });
          } else if (m.rect_h < neededH - 2 && !hasEllipsis) {
            findings.truncation.push({ id: m.id, declared_text: hEl.text, reason: 'declared box is shorter than the wrapped text needs — not actually wrapped', rect_h: m.rect_h, needed_h: neededH, needed_lines: m.needed_lines });
          }
        }
      }

      // ---- OVERLAP: attribute rows, pixel-based, panel's own modal colour -----------------------
      // GAP (>= 3 consecutive empty columns = a separator) is `t4-r4-critic-overlap.mjs`'s own
      // constant, tuned at 1920x1080. The glyphs it separates shrink by `sPix` at a smaller
      // viewport, so the empty-column run between them shrinks too — scaling the threshold by the
      // same `sPix` (floored at 1, never zero) keeps the check measuring the same PROPORTION of
      // the row at every resolution instead of silently tightening as the canvas shrinks.
      const rows = r.elements.filter((e) => e.kind === 'attribute_row');
      if (rows.length && panel) {
        const m = modal(png, panel.rect);
        const gapAtScale = Math.max(1, Math.round(GAP * sPix));
        for (const row of rows) {
          const prof = rowProfile(png, row.rect, m, gapAtScale);
          if (prof.separators < 2) findings.overlap.push({ id: row.id, rect: row.rect, text: row.text, gap_threshold_px: gapAtScale, ...prof });
        }
      }

      const screenReport = {
        mode: r.mode, capture: path.relative(REPO_ROOT, shotPath),
        panel_rect: panel ? panel.rect : null,
        counts: { journal_entry: r.elements.filter((e) => e.kind === 'journal_entry').length, hint: hints.length, attribute_row: rows.length },
        findings,
        clean: findings.overflow.length === 0 && findings.truncation.length === 0 && findings.overlap.length === 0,
      };
      report.screens[`${tag}/${name}`] = screenReport;
      const bad = !screenReport.clean;
      if (bad) anyFail = true;
      log(`  [${tag}/${name}] overflow=${findings.overflow.length} truncation=${findings.truncation.length} overlap=${findings.overlap.length} -> ${bad ? 'RED' : 'clean'}`);
    }
  } finally {
    await h1.close();
  }
}

// ---- frame-liveness, mandated on every frame this tool measured pixels from --------------------
const liveness = frameLiveness(SHOTS);
report.frame_liveness = liveness;
if (!liveness.ok) {
  log(`\nFRAME-LIVENESS DID NOT PASS — every OVERLAP number above is VOID until this is clean:\n${liveness.output}`);
}
// A screen's overlap finding is only trustworthy if the captures it came from are live. This tool
// does not silently keep believing a void pixel number — it marks every screen's overlap leg void
// and that alone fails the run, rather than reporting a pass built on a duplicate frame.
if (!liveness.ok) {
  for (const s of Object.values(report.screens)) if (s.findings.overlap) s.overlap_void = true;
  anyFail = true;
}

writeJson(path.join(OUT, 't4-r5-legibility.json'), report);
log(`\n-> ${path.join(OUT, 't4-r5-legibility.json')}`);
log(anyFail ? 'RED: at least one screen is not legible (or its pixel evidence is void).' : 'CLEAN: every screen at every requested viewport passes overflow, truncation and overlap.');
process.exit(anyFail ? 1 : 0);
