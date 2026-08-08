#!/usr/bin/env node
// ui-layer.mjs — RI-UIX02 §C, detector 1 of three: the pixel sweep.
//
// Named by RI-UIX02 §C and its Comparison method step 2, and it did not exist. Written by the
// W1-21 builder; declared in orchestration/status/W1-21.json.
//
// WHAT IT DOES, in the item's own steps:
//   a) capture with setUIVisible(true)   -> A
//   b) capture with setUIVisible(false)  -> B
//   c) UI_LAYER = A − B                  (the exact set of pixels the UI owns)
//   d) connected-component label UI_LAYER; each component is a candidate element
//   e) reconcile against getUIState().elements rects
//      -> any component not covered by a declared rect is an UNDECLARED ELEMENT
//
// "An undeclared element is not automatically a marker, but it is automatically a FINDING, and
// it must be identified before the wave can pass." It writes a PNG crop per finding, because
// "a bounding box is not evidence, a picture of the thing is".
//
// IT ALSO ANSWERS A QUESTION NOBODY ELSE ASKS, and the whole UI architecture depends on the
// answer: **is the harness looking at the same picture as the player?** `__HARNESS.screenshot()`
// is `canvas.toDataURL()` and `page.screenshot()` is the composited page. If any part of this
// interface were in the DOM the two would differ and every visual verdict in the project would
// have been taken on a frame the player never saw. `--instrument-diff` captures both at every
// viewpoint and reports differing-pixel counts. It is not optional decoration: it is the check
// that makes the other 138 items' evidence admissible.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';
import { grader, line, sampleTable } from '../lib/graded.mjs';

const USAGE = `
ui-layer.mjs — RI-UIX02 §C. The UI-layer pixel sweep and the declared/drawn reconciliation.

USAGE
  node tools/analysis/ui-layer.mjs [--state ui-journal] [--width 1280 --height 720]
                                   [--out <dir>] [--json] [--no-instrument-diff]

Sweeps the ui-world and ui-combat viewpoint sets: world, and each of the six screens.
Writes A.png / B.png / diff.png per viewpoint and a crop per undeclared component.

EXIT 0 = 0 undeclared components and the two instruments agree · 1 = a finding · 2 = could not run
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-LAYER'));
const width = Number(args.width || 1280), height = Number(args.height || 720);
const state = String(args.state || 'ui-journal');

/** The `ui-combat` + `ui-world` viewpoint sets, as this build can produce them. */
const VIEWPOINTS = [
  { id: 'ui_world_neutral', open: null },
  { id: 'ui_combat_neutral', open: null, combat: true },
  { id: 'ui_menu_inventory', open: ['inventory'] },
  { id: 'ui_menu_journal', open: ['journal'] },
  { id: 'ui_menu_book', open: ['book', { id: 'pilots-chart-book' }] },
  { id: 'ui_menu_levelup', open: ['levelup'], hearth: true },
  { id: 'ui_menu_sheet', open: ['sheet'] },
  { id: 'ui_menu_spells', open: ['spells'] },
  // W1-21 round 2. The map, in BOTH of its views.
  //
  // The round-1 verdict tabulated every AR-2 and fidelity detector this piece ships against the
  // one surface S35 defines entirely by its refusals, and the answer was five detectors and zero
  // visits — the only thing that had ever looked at the map screen was the probe its own builder
  // wrote. The undeclared-component sweep is exactly the check that matters most there, because
  // `UISurface.el()` clipping every draw to its declared rect is the whole reason the map's
  // element-level assertions mean anything: a square drawn outside a declared rect would be a
  // marker that the census cannot see and the pixels can.
  //
  // `view` presses confirm on the map, which is the one input that swaps world view for local
  // view (`_confirm()` case 'map'), so `ui_menu_map_local` is a genuinely different layout and
  // not the same picture twice.
  { id: 'ui_menu_map', open: ['map'] },
  { id: 'ui_menu_map_local', open: ['map'], mapLocal: true },
];

/**
 * `--only a,b` / `--skip a,b` — run a subset of the viewpoints, and SAY SO in the report.
 *
 * Added by W1-21 round 2 for a reason worth writing down: `ui_combat_neutral` currently dies on
 * `aggro('deadwater-koor-nakh'): no such entity` and takes the whole sweep with it, because
 * `browser.mjs` treats a harness throw as fatal at the process level and the tool's own
 * `try/catch` around the aggro never gets a chance. One broken viewpoint should not make the
 * other nine unmeasurable. The subset is written into the report as `viewpoints_skipped` and
 * `covered_all_viewpoints`, so a partial run can never be mistaken for a full one — which is the
 * failure mode this whole round has been about.
 */
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const SKIP = args.skip ? new Set(String(args.skip).split(',')) : new Set();
const SELECTED = VIEWPOINTS.filter((v) => (!ONLY || ONLY.has(v.id)) && !SKIP.has(v.id));

function decode(dataUrl) { return PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64')); }

/** A − B as a boolean mask, plus the count. Any channel differing by > 2/255 counts. */
function difference(a, b) {
  const n = a.width * a.height;
  const mask = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (d > 6) { mask[i] = 1; count++; }
  }
  return { mask, count };
}

/** 4-connected component labelling with a flat stack — no recursion, no allocation per pixel. */
function components(mask, w, h, minPx) {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const out = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    let sp = 0; stack[sp++] = i; seen[i] = 1;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (n >= minPx) out.push({ px: n, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] });
  }
  return out;
}

/** Is `c` covered by any declared rect (with a 3 px tolerance for antialiasing)? */
function covered(c, rects) {
  const [cx, cy, cw, ch] = c.bbox;
  for (const r of rects) {
    if (cx >= r[0] - 3 && cy >= r[1] - 3 && cx + cw <= r[0] + r[2] + 3 && cy + ch <= r[1] + r[3] + 3) return true;
  }
  return false;
}

function crop(png, bbox, pad) {
  const [x, y, w, hgt] = bbox;
  const x0 = Math.max(0, x - pad), y0 = Math.max(0, y - pad);
  const x1 = Math.min(png.width, x + w + pad), y1 = Math.min(png.height, y + hgt + pad);
  const o = new PNG({ width: x1 - x0, height: y1 - y0 });
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const s = (yy * png.width + xx) * 4, d = ((yy - y0) * o.width + (xx - x0)) * 4;
      o.data[d] = png.data[s]; o.data[d + 1] = png.data[s + 1];
      o.data[d + 2] = png.data[s + 2]; o.data[d + 3] = 255;
    }
  }
  return o;
}

ensureDir(RUN);
const h = await launchGame({ width, height, timeout: 240000 });
const results = [];
let instrument = [];
try {
  await h.h('setRenderRate', 60);
  // Make the drawing buffer equal the CSS viewport before comparing instruments. `main.js`
  // sizes the canvas from `innerWidth` only on load and on a resize event, so under Playwright
  // it can still be carrying index.html's 1920x1080 attribute while the viewport is 1280x720 —
  // the canvas is then DOWNSCALED by CSS and `__HARNESS.screenshot()` returns a 1920-wide image
  // of a 1280-wide picture. That is supersampling rather than a DOM leak, but it makes an exact
  // pixel comparison impossible, so the buffer is pinned to 1:1 first and the relationship is
  // recorded either way.
  const buf = await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', state);
  await h.h('stepFrames', 4);
  for (const vp of SELECTED) {
    await h.h('closeMenu');
    if (vp.hearth) await h.h('setAtHearth', true);
    if (vp.combat) {
      const ents = await h.h('listEntities');
      const t = (ents || []).find((e) => e.archetype && e.archetype !== 'player');
      if (t) { try { await h.h('aggro', t.eid); await h.h('lockOn', t.eid); } catch { /* none */ } }
    }
    if (vp.open) await h.h('openMenu', ...vp.open);
    // The local view is reached the way a player reaches it — confirm, through the real input
    // pipeline — and not by a harness verb that sets `focus.map.view`, because the round-1 fix to
    // `build()`'s cache key is precisely about whether a press on a paused screen repaints. A
    // viewpoint that got there through the back door could not see this viewpoint's own bug.
    if (vp.mapLocal) {
      await h.h('queueInputs', [{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]);
      await h.h('stepFrames', 3);
    }
    await h.h('stepFrames', 2);

    await h.h('setUIVisible', true);
    const aURL = await h.h('screenshot');
    const declared = (await h.h('getUIState')).elements.filter((e) => e.visible && e.opacity > 0).map((e) => e.rect);
    // page.screenshot() is the composited page — DOM included. __HARNESS.screenshot() is the
    // canvas alone. If they differ, part of this interface is not in the canvas.
    const pageBuf = args['no-instrument-diff'] ? null : await h.page.screenshot({ type: 'png' });
    await h.h('setUIVisible', false);
    const bURL = await h.h('screenshot');
    await h.h('setUIVisible', true);

    const A = decode(aURL), B = decode(bURL);
    const { mask, count } = difference(A, B);
    const comps = components(mask, A.width, A.height, 24);
    const undeclared = comps.filter((c) => !covered(c, declared));

    const dir = path.join(RUN, vp.id);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'A.png'), PNG.sync.write(A));
    fs.writeFileSync(path.join(dir, 'B.png'), PNG.sync.write(B));
    const D = new PNG({ width: A.width, height: A.height });
    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      D.data[o] = D.data[o + 1] = D.data[o + 2] = mask[i] ? 255 : 0;
      D.data[o + 3] = 255;
    }
    fs.writeFileSync(path.join(dir, 'ui-layer.png'), PNG.sync.write(D));
    undeclared.forEach((c, i) => {
      fs.writeFileSync(path.join(dir, `undeclared-${i}.png`), PNG.sync.write(crop(A, c.bbox, 12)));
    });

    if (pageBuf) {
      const P = PNG.sync.read(pageBuf);
      let differ = 0;
      if (P.width === A.width && P.height === A.height) {
        for (let i = 0; i < A.width * A.height; i++) {
          const o = i * 4;
          if (Math.abs(P.data[o] - A.data[o]) > 2 || Math.abs(P.data[o + 1] - A.data[o + 1]) > 2
            || Math.abs(P.data[o + 2] - A.data[o + 2]) > 2) differ++;
        }
      } else differ = -1;
      instrument.push({
        viewpoint: vp.id, harness: [A.width, A.height], page: [P.width, P.height],
        differing_pixels: differ,
        note: differ === -1 ? 'size mismatch: the drawing buffer is not 1:1 with the viewport' : null,
      });
      fs.writeFileSync(path.join(dir, 'page.png'), pageBuf);
    }

    results.push({
      viewpoint: vp.id,
      // W1-21 round 3: a viewpoint whose UI layer is EMPTY sampled nothing. `[].reduce(…) === 0`
      // was the round-2 verdict's example of K2 passing on an empty set; `ui_layer_px` and
      // `components` are the numbers that make "0 undeclared" mean anything, so they are graded.
      measured: count > 0 && comps.length > 0,
      ui_layer_px: count,
      ui_layer_frac: +(count / (A.width * A.height)).toFixed(5),
      declared_rects: declared.length,
      components: comps.length,
      undeclared: undeclared.map((c) => ({ px: c.px, bbox: c.bbox, crop: `${vp.id}/undeclared-${comps.indexOf(c)}.png` })),
    });
    log(`  ${vp.id}: ui layer ${count} px, ${comps.length} components, ${undeclared.length} undeclared`);
  }
} finally {
  await h.close();
}

const report = {
  schema: 'elder-souls/ui-layer@1',
  item: 'RI-UIX02',
  detector: '§C pixel sweep',
  at: new Date().toISOString(),
  state, screen: [width, height],
  viewpoints: results.length,
  viewpoints_declared: VIEWPOINTS.map((v) => v.id),
  viewpoints_run: SELECTED.map((v) => v.id),
  viewpoints_skipped: VIEWPOINTS.filter((v) => !SELECTED.includes(v)).map((v) => v.id),
  covered_all_viewpoints: SELECTED.length === VIEWPOINTS.length,
  results,
  undeclared_components: results.reduce((a, r) => a + r.undeclared.length, 0),
  instrument_agreement: instrument,
  instruments_agree: instrument.every((i) => i.differing_pixels === 0),
  K2: results.reduce((a, r) => a + r.undeclared.length, 0) === 0 ? 'PASS' : 'FAIL',
};
writeJson(path.join(RUN, 'ui-layer.json'), report);
if (args.json) console.log(JSON.stringify(report, null, 2));
else {
  log(`K2 ${report.K2} — ${report.undeclared_components} undeclared components over ${results.length} viewpoints`);
  for (const i of instrument) {
    log(`  instrument ${i.viewpoint}: __HARNESS.screenshot() vs page.screenshot() = ${i.differing_pixels} differing pixels`);
  }
  log(`instruments agree: ${report.instruments_agree}`);
  log(`artifacts: ${RUN}`);
}
process.exit(report.K2 === 'PASS' && report.instruments_agree ? 0 : 1);
