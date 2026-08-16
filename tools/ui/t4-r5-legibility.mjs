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
//   COLLISION   Geometric + pixel, ADDED BY T4 r8. THE CHECK THAT WAS MISSING, AND THE REASON
//               THIS TOOL REPORTED `overlap=0 -> clean` ON A SCREEN WHOSE SIDE HEADERS WERE
//               PRINTED ACROSS THE FIRST LIST ROW. The OVERLAP leg below is round 4's
//               column-run test evaluated INSIDE ONE ROW BAND: it asks "are this row's own
//               columns separable from each other", and by construction it cannot see two
//               DIFFERENT elements landing on one another. `RI-UIX06` FD4 is "0 clipping, 0
//               overlap, 0 overflow", hard-failing on any at 1920x1080, and that is a
//               LAYOUT-INTEGRITY claim about rects — so the pass/fail leg here is the rect test.
//
//               TWO LEGS, AND THEY ARE REQUIRED TO BE ABLE TO DISAGREE. This is the whole design
//               and it comes from the r7 critic's own finding: at round 6 the container header
//               and the first row overlapped by 182x12 WITH THE GLYPHS CLEAR OF EACH OTHER, and
//               at round 7 by 190x20 with the glyphs colliding. A single leg cannot tell those
//               two apart, and an instrument that cannot tell them apart cannot be trusted to say
//               which one it is looking at.
//                 (a) RECT  — a PARTIAL intersection of two text-bearing element rects. Full
//                     containment is a parent/child relationship (a row inside a panel) and is
//                     recorded, not flagged. This is the leg that decides the run.
//                 (b) INK   — the pixel profile of that intersection region and of each of the
//                     two rects, from the same live capture. Reported as evidence, never as the
//                     verdict, because ink inside a shared region cannot be attributed to one of
//                     the two owners without knowing each element's baseline, which the census
//                     does not declare. What it CAN say, and what the round-6/round-7 pair needs,
//                     is whether there is any ink in the shared region at all.
//               `--self-test` runs both legs over fixtures whose expected answers DIFFER and
//               exits non-zero if any two arms agree where they must not. See `selfTest()`.
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
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r5/legibility'));
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

// ---- COLLISION metric (T4 r8) — two DIFFERENT text-bearing elements printed on one another -----
//
// `textBearing` is deliberately narrow and deliberately declared: an element counts only if the
// census says it is visible, gives it a rect with positive area, and gives it a non-empty `text`.
// A picture (`item_icon`) landing on a row is a different defect and this leg does not claim to
// see it. Kept as a pure function of a census array so `selfTest()` can drive it with fixtures.
const rectBox = (r) => ({ x0: r[0], y0: r[1], x1: r[0] + r[2], y1: r[1] + r[3] });
function textBearing(els) {
  return els.filter((e) => e.visible !== false && Array.isArray(e.rect) && e.rect[2] > 0 && e.rect[3] > 0
    && e.text !== null && e.text !== undefined && String(e.text).trim() !== '');
}
/**
 * Every PARTIAL intersection of two text-bearing rects. `contained` (one rect ≥99% inside the
 * other) is the parent/child case and is returned flagged rather than dropped, so the report can
 * show how many pairs were set aside and a reader can check the exclusion did not swallow a real
 * finding. `EPS` is 1 device px: two rects that share an edge are stacked, not colliding.
 */
const COLLIDE_EPS = 1;
function collisions(els) {
  const t = textBearing(els);
  const out = [];
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      const a = rectBox(t[i].rect), b = rectBox(t[j].rect);
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w <= COLLIDE_EPS || h <= COLLIDE_EPS) continue;
      const areaA = (a.x1 - a.x0) * (a.y1 - a.y0), areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
      const inter = w * h;
      const contained = inter >= Math.min(areaA, areaB) * 0.99;
      out.push({
        a: { id: t[i].id, kind: t[i].kind, text: String(t[i].text).slice(0, 40), rect: t[i].rect },
        b: { id: t[j].id, kind: t[j].kind, text: String(t[j].text).slice(0, 40), rect: t[j].rect },
        intersection: [+w.toFixed(2), +h.toFixed(2)],
        region: [Math.max(a.x0, b.x0), Math.max(a.y0, b.y0), w, h],
        area: Math.round(inter), contained,
      });
    }
  }
  return out;
}
/** Ink pixels (dE_rgb > FG from `mode`) inside a rect, and how many rows carry any. Leg (b). */
function inkProfile(png, rect, mode) {
  const [x0, y0, w, h] = rect.map(Math.round);
  let px = 0, rows = 0;
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    let inRow = 0;
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      if (x < 0 || y < 0) continue;
      const i = ((y * png.width) + x) << 2;
      const dr = png.data[i] - mode[0], dg = png.data[i + 1] - mode[1], db = png.data[i + 2] - mode[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > FG) inRow++;
    }
    px += inRow;
    if (inRow > 0) rows++;
  }
  return { ink_px: px, ink_rows: rows, of_rows: Math.min(h, png.height - Math.max(0, y0)) };
}

/**
 * SELF-TEST. Rule 4 of the method: a control that has never been seen to fail for the right
 * reason is not a control. Each fixture below states an expected answer, and the fixtures are
 * chosen so that a degenerate predicate — "always red", "always green", "any intersection at all
 * is red", "only exact equality is red" — is killed by at least one of them DISAGREEING with
 * another. The run exits non-zero if any expectation is missed.
 *
 * WHAT THIS WOULD HAVE CAUGHT, stated before it was run: fixture `r7_container_head_over_row`
 * is the shipped round-7 geometry (header rect 28 tall from the inner top, first row rect
 * starting 8 below it) and fixture `r6_container_head_over_row` is round 6's (first row 16
 * below). BOTH are red on leg (a) — the rect test does not distinguish them — which is exactly
 * why leg (b) exists and why the report carries both. A tool that returned the same verdict for
 * `stacked_flush` as for those two would be one that cannot see a header at all.
 */
function selfTest() {
  const el = (id, kind, rect, text) => ({ id, kind, rect, text, visible: true });
  const cases = [
    { name: 'disjoint_columns', els: [el('a', 'hint', [0, 0, 100, 20], 'A'), el('b', 'hint', [120, 0, 100, 20], 'B')], expect: 0 },
    { name: 'stacked_flush', els: [el('a', 'panel_header', [0, 0, 100, 28], 'A'), el('b', 'list_row', [0, 28, 100, 34], 'B')], expect: 0 },
    { name: 'stacked_1px_touch', els: [el('a', 'panel_header', [0, 0, 100, 28], 'A'), el('b', 'list_row', [0, 27, 100, 34], 'B')], expect: 0, why: 'a 1px shared edge is rounding, not a collision (COLLIDE_EPS)' },
    { name: 'r6_container_head_over_row', els: [el('a', 'panel_header', [0, 0, 198, 28], 'Carried'), el('b', 'list_row', [0, 16, 182, 34], 'Bog-iron m…')], expect: 1, why: 'round 6: 182x12 rect overlap, glyphs clear — leg (a) still red' },
    { name: 'r7_container_head_over_row', els: [el('a', 'panel_header', [0, 0, 198, 28], 'Carried'), el('b', 'list_row', [0, 8, 182, 34], 'Bog-iron m…')], expect: 1, why: 'round 7: 190x20 rect overlap, glyphs colliding' },
    { name: 'child_inside_parent', els: [el('p', 'panel', [0, 0, 480, 452], 'Reed Creel'), el('c', 'list_row', [20, 100, 182, 34], 'Bog-iron m…')], expect: 0, why: 'containment is parent/child and must NOT be flagged' },
    { name: 'no_text_no_finding', els: [el('a', 'item_icon', [0, 0, 100, 28], ''), el('b', 'list_row', [0, 8, 100, 34], 'B')], expect: 0, why: 'the leg is text-vs-text by construction and says so' },
    { name: 'three_way_pileup', els: [el('a', 'hint', [0, 0, 100, 30], 'A'), el('b', 'hint', [0, 10, 100, 30], 'B'), el('c', 'hint', [0, 20, 100, 30], 'C')], expect: 3, why: 'pairs, not elements — 3 elements mutually overlapping is 3 findings' },
  ];
  let bad = 0;
  const results = cases.map((c) => {
    const got = collisions(c.els).filter((p) => !p.contained).length;
    const ok = got === c.expect;
    if (!ok) bad++;
    log(`  ${ok ? 'ok  ' : 'FAIL'} ${c.name}: expected ${c.expect}, got ${got}${c.why ? '  — ' + c.why : ''}`);
    return { ...c, got, ok, els: undefined };
  });
  // The arms must be capable of disagreeing: if every fixture returned the same answer the suite
  // would pass a constant function. Assert the answer set has more than one member.
  const distinct = new Set(results.map((r) => r.got));
  if (distinct.size < 2) { log('  FAIL suite is degenerate — every fixture returned the same answer'); bad++; }
  // And the two container arms must both be red while `stacked_flush` is green: that triple is
  // what a fix has to move, and it is asserted rather than assumed.
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  if (!(byName.r6_container_head_over_row.got > 0 && byName.r7_container_head_over_row.got > 0
        && byName.stacked_flush.got === 0)) { log('  FAIL the round-6/round-7/flush triple does not separate'); bad++; }
  log(bad ? `SELF-TEST RED: ${bad} failure(s)` : `SELF-TEST OK: ${results.length} fixtures, ${distinct.size} distinct answers`);
  return { cases: results, failures: bad, distinct_answers: [...distinct] };
}

if (args.self_test || args['self-test']) {
  const st = selfTest();
  writeJson(path.join(OUT, 't4-r5-legibility-selftest.json'), { schema: 'elder-souls/t4-r5-legibility-selftest@1', at: new Date().toISOString(), ...st });
  process.exit(st.failures ? 1 : 0);
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

    // T4 r8: `--screens container,levelup` runs a subset. Added because a five-screen sweep at two
    // viewports is ~12 minutes and a round that needs the container re-measured four times cannot
    // pay that each time. The DEFAULT is unchanged (all five), so nothing that reads this tool's
    // report gets a quieter run by accident — a subset run records which screens it asked for.
    const only = String(args.screens || '').split(',').map((x) => x.trim()).filter(Boolean);
    report.screens_requested = only.length ? only : Object.keys(OPENERS);
    for (const [name, opener] of Object.entries(OPENERS)) {
      if (only.length && !only.includes(name)) continue;
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
      const findings = { overflow: [], truncation: [], overlap: [], collision: [] };

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

      // ---- COLLISION: two DIFFERENT text-bearing elements printed on one another ---------------
      // Leg (a) decides; leg (b) is measured for every finding leg (a) reports and for nothing
      // else, so the pixel work is bounded by the number of findings rather than by the census.
      const allPairs = collisions(r.elements);
      const partials = allPairs.filter((p) => !p.contained);
      const collideMode = panel ? modal(png, panel.rect) : null;
      for (const p of partials) {
        const evidence = collideMode ? {
          intersection_ink: inkProfile(png, p.region, collideMode),
          a_rect_ink: inkProfile(png, p.a.rect, collideMode),
          b_rect_ink: inkProfile(png, p.b.rect, collideMode),
        } : { note: 'no panel element — leg (b) not measured' };
        findings.collision.push({ ...p, region: p.region.map((v) => +v.toFixed(2)), ink: evidence });
      }
      report.screens[`${tag}/${name}_pairs_considered`] = { text_bearing: textBearing(r.elements).length, intersecting_pairs: allPairs.length, contained_excluded: allPairs.length - partials.length };

      const screenReport = {
        mode: r.mode, capture: path.relative(REPO_ROOT, shotPath),
        panel_rect: panel ? panel.rect : null,
        counts: { journal_entry: r.elements.filter((e) => e.kind === 'journal_entry').length, hint: hints.length, attribute_row: rows.length, text_bearing: textBearing(r.elements).length },
        findings,
        clean: findings.overflow.length === 0 && findings.truncation.length === 0
          && findings.overlap.length === 0 && findings.collision.length === 0,
      };
      report.screens[`${tag}/${name}`] = screenReport;
      const bad = !screenReport.clean;
      if (bad) anyFail = true;
      log(`  [${tag}/${name}] overflow=${findings.overflow.length} truncation=${findings.truncation.length} overlap=${findings.overlap.length} collision=${findings.collision.length} -> ${bad ? 'RED' : 'clean'}`);
      for (const c of findings.collision.slice(0, 6)) {
        log(`      '${c.a.text}' [${c.a.id}] x '${c.b.text}' [${c.b.id}] rect ${c.intersection.join('x')}`
          + `  ink-in-region ${c.ink.intersection_ink ? c.ink.intersection_ink.ink_px + 'px/' + c.ink.intersection_ink.ink_rows + ' rows' : 'n/a'}`);
      }
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
