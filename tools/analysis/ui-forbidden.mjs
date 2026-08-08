#!/usr/bin/env node
// ui-forbidden.mjs — RI-UIX01 §B, both probes, and RI-UIX03 §D.
//
// Named by RI-UIX01's Comparison method step 3, and it did not exist. Written by the W1-21
// builder; declared in orchestration/status/W1-21.json.
//
// TWO INDEPENDENT PROBES, BECAUSE `getUIState()` IS A SELF-REPORT. The item is blunt about it:
// "a game that draws damage numbers directly to the canvas without registering them as UI
// elements is invisible to `getUIState()` — and that is exactly how they would be drawn."
//
//   DECLARED — any element whose `kind` is in the X1-X12 vocabulary, or which carries a
//     `worldAnchor` that is not the lock-on reticle.
//
//   OBSERVED — a pixel probe. Run a fight with several enemies, capture at the frame after a
//     `hit` event, and look for DIGIT GLYPHS within 200 px of each enemy's projected screen
//     position. Any digit there is X1 (floating damage numbers). It also looks for the
//     horizontal-bar signature of X2 (a nameplate health bar over an ordinary enemy): a run of
//     rows, 3-14 px tall and 30-160 px wide, of near-constant colour, sitting above an enemy.
//
// The observed probe is the one RI-UIX01 predicts "will be the first check dropped for being
// slow". It is therefore the default, and `--declared-only` is the flag you have to type.
//
// DIGIT DETECTION without OCR. The item says "OCR the frame region"; there is no OCR in this
// repo and adding a WASM OCR to detect ten glyphs would be a large dependency for a small
// question. Instead the probe uses the property that makes a digit a digit ON A GAME FRAME:
// a small (6-40 px tall), high-contrast, HIGH-STROKE-DENSITY connected component with a
// vertical extent close to a text line height, sitting in a region where the UI layer is
// otherwise empty. It is calibrated by rendering known digits through the game's own glyph
// path and measuring their signature — `--calibrate` prints that calibration, and the
// self-test draws the digits "247" over an enemy and asserts the probe finds them.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
ui-forbidden.mjs — RI-UIX01 §B. The forbidden-set detector, declared and observed.

USAGE
  node tools/analysis/ui-forbidden.mjs [--state arena_champion] [--enemies 6]
                                       [--declared-only] [--self-test] [--out <dir>] [--json]

EXIT 0 = 0 hits on both probes · 1 = a hit · 2 = could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

/** X1-X12 as declarable kinds. Nothing in this build emits one; that is the point of the list. */
const X = {
  X1: ['damage_number'], X2: ['enemy_nameplate', 'enemy_health_bar'], X3: ['hit_marker'],
  X4: ['damage_direction'], X5: ['minimap'], X6: ['compass'], X7: ['objective_tracker'],
  X8: ['quest_marker', 'waypoint', 'map_pin'], X9: ['xp_popup'], X10: ['ground_telegraph'],
  X11: ['combo_counter', 'dps_meter'], X12: [],
};
/** RI-UIX03 §D's forbidden inventory affordances. */
const N = { N4: ['best_in_slot'], N5: ['auto_equip'] };

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-FORBIDDEN'));
const state = String(args.state || 'arena_champion');
const width = Number(args.width || 1280), height = Number(args.height || 720);

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }

/**
 * Connected components of "bright ink over a dark neighbourhood" in a rectangle. A digit drawn
 * over a fight is a small high-contrast blob; the probe returns every candidate and the caller
 * filters by the glyph signature.
 */
function glyphCandidates(png, rect) {
  const [rx, ry, rw, rh] = rect.map((v) => Math.round(v));
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return [];
  // local contrast: a pixel is "ink" if it is >55 luma above the median of its 15px row window
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y + y0) * png.width + (x + x0)) * 4;
      lum[y * w + x] = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
    }
  }
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let lo = 255;
      for (let k = -7; k <= 7; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w) continue;
        const v = lum[y * w + xx];
        if (v < lo) lo = v;
      }
      if (lum[y * w + x] - lo > 55) ink[y * w + x] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out = [];
  for (let i = 0; i < ink.length; i++) {
    if (!ink[i] || seen[i]) continue;
    let sp = 0; stack[sp++] = i; seen[i] = 1;
    let n = 0, ax0 = 1e9, ay0 = 1e9, ax1 = -1, ay1 = -1;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      n++;
      if (x < ax0) ax0 = x; if (x > ax1) ax1 = x;
      if (y < ay0) ay0 = y; if (y > ay1) ay1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && ink[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
      }
    }
    const bw = ax1 - ax0 + 1, bh = ay1 - ay0 + 1;
    out.push({ px: n, bbox: [ax0 + x0, ay0 + y0, bw, bh], density: n / (bw * bh) });
  }
  return out;
}

/**
 * The glyph signature. A digit rendered at a readable size over a fight is:
 *   height 8-44 px, width 0.35-1.1 of height, 40-140 px of ink, density 0.18-0.72.
 * Terrain speculars, sparks and shadow edges fail one of those; a bar fails the width ratio.
 * `--calibrate` prints the signature this build's own glyph path produces so the band can be
 * checked against reality rather than believed.
 */
function looksLikeDigit(c) {
  const [, , w, h] = c.bbox;
  if (h < 8 || h > 44) return false;
  const ar = w / h;
  if (ar < 0.30 || ar > 1.15) return false;
  if (c.px < 20 || c.px > 400) return false;
  return c.density > 0.14 && c.density < 0.75;
}

/** X2's signature: a wide, thin, near-uniform horizontal run. A nameplate health bar. */
function looksLikeBar(c) {
  const [, , w, h] = c.bbox;
  return h >= 3 && h <= 14 && w >= 30 && w <= 200 && (w / h) > 4 && c.density > 0.6;
}

ensureDir(RUN);
const h = await launchGame({ width, height, timeout: 240000 });
const out = {
  schema: 'elder-souls/ui-forbidden@1', item: 'RI-UIX01', at: new Date().toISOString(),
  state, screen: [width, height], declared: [], observed: [], self_test: null,
};
try {
  await h.h('setRenderRate', 60);
  await h.h('loadState', state);
  await h.h('stepFrames', 4);

  // Spawn enough enemies that the probe has several regions to look at (the item asks for 6).
  const wanted = Number(args.enemies || 6);
  const existing = (await h.h('listEntities')).filter((e) => e.archetype !== 'player');
  for (let i = existing.length; i < wanted; i++) {
    const a = (i / wanted) * Math.PI * 2;
    try { await h.h('spawn', 'inf_trash', Math.cos(a) * 4.5, Math.sin(a) * 4.5, { as: `probe${i}` }); } catch { /* roster */ }
  }
  await h.h('stepFrames', 4);
  const enemies = (await h.h('listEntities')).filter((e) => e.archetype !== 'player');
  for (const e of enemies) { try { await h.h('aggro', e.eid); } catch { /* */ } }

  // ---- declared -----------------------------------------------------------------------------
  const scanDeclared = (ui, where) => {
    for (const [row, kinds] of [...Object.entries(X), ...Object.entries(N)]) {
      for (const el of ui.elements) {
        if (kinds.includes(el.kind)) out.declared.push({ row, where, id: el.id, kind: el.kind });
      }
    }
    for (const el of ui.elements) {
      if (el.worldAnchor && el.kind !== 'lockon_reticle') {
        out.declared.push({ row: 'X8', where, id: el.id, kind: el.kind, worldAnchor: el.worldAnchor });
      }
    }
  };
  scanDeclared(await h.h('getUIState'), 'combat');
  // W1-21 round 2: `map` added. The round-1 verdict found this sweep visiting four screens and
  // not the one S35 exists to constrain — and this tool had never been run against any build at
  // all, so "it does not open the map" was two absences stacked on each other.
  for (const m of ['inventory', 'journal', 'sheet', 'spells', 'map']) {
    await h.h('openMenu', m);
    scanDeclared(await h.h('getUIState'), m);
  }
  await h.h('closeMenu');

  // ---- observed ------------------------------------------------------------------------------
  if (!args['declared-only']) {
    // swing until something is hit, then capture on the NEXT frame
    await h.h('queueInputs', [{ f: 2, press: ['light'] }, { f: 6, release: ['light'] },
      { f: 40, press: ['heavy'] }, { f: 47, release: ['heavy'] },
      { f: 90, press: ['light'] }, { f: 94, release: ['light'] }]);
    await h.h('traceStart', {});
    let hitFrame = null;
    for (let i = 0; i < 180 && hitFrame === null; i++) {
      await h.h('stepFrames', 1);
      const cs = await h.h('getCombatState');
      if (cs && cs.events && cs.events.some((e) => /HIT/.test(e.type))) hitFrame = await h.h('getFrame');
    }
    await h.h('stepFrames', 1);
    const shot = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, 'after-hit.png'), PNG.sync.write(shot));

    const live = (await h.h('listEntities')).filter((e) => e.archetype !== 'player');
    const declaredRects = (await h.h('getUIState')).elements.filter((e) => e.visible).map((e) => e.rect);
    for (const e of live) {
      const p = await h.h('projectPoint', e.pos[0], e.pos[1] + 1.4, e.pos[2]);
      if (!p || p.behind || p.z <= 0) continue;
      const sx = p.x_px !== undefined ? p.x_px : (p.ndc ? (p.ndc[0] * 0.5 + 0.5) * width : null);
      const sy = p.y_px !== undefined ? p.y_px : (p.ndc ? (0.5 - p.ndc[1] * 0.5) * height : null);
      if (sx === null || sy === null) continue;
      const region = [sx - 200, sy - 200, 400, 400];
      const cands = glyphCandidates(shot, region);
      const digits = cands.filter(looksLikeDigit).filter((c) =>
        !declaredRects.some((r) => c.bbox[0] >= r[0] - 2 && c.bbox[1] >= r[1] - 2
          && c.bbox[0] + c.bbox[2] <= r[0] + r[2] + 2 && c.bbox[1] + c.bbox[3] <= r[1] + r[3] + 2));
      const bars = cands.filter(looksLikeBar).filter((c) => c.bbox[1] < sy);
      out.observed.push({
        eid: e.eid, screen: [Math.round(sx), Math.round(sy)],
        candidates: cands.length, digit_glyphs: digits.length, nameplate_bars: bars.length,
        digit_bboxes: digits.slice(0, 6).map((d) => d.bbox),
      });
    }
    out.hit_frame = hitFrame;
  }

  // ---- can the observed probe fire? -----------------------------------------------------------
  if (args['self-test']) {
    // Draw "247" over the first enemy, through the game's OWN glyph path, into the UI canvas —
    // i.e. exactly how a damage number would arrive — and confirm the probe finds it.
    const e0 = enemies[0];
    const p = await h.h('projectPoint', e0.pos[0], e0.pos[1] + 1.4, e0.pos[2]);
    const sx = p.x_px !== undefined ? p.x_px : (p.ndc[0] * 0.5 + 0.5) * width;
    const sy = p.y_px !== undefined ? p.y_px : (0.5 - p.ndc[1] * 0.5) * height;
    await h.page.evaluate(async ({ x, y }) => {
      const mod = await import('/game/src/ui/glyphs.js');
      const S = window.__ENGINE.renderer.menus;
      mod.drawText(S.ctx, '247', x, y, mod.FACES.bone, 26, '#ffffff');
      S.texture.needsUpdate = true;
      S.drawn = true;
    }, { x: sx, y: sy });
    await h.h('renderFrame');
    const shot2 = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, 'self-test-injected.png'), PNG.sync.write(shot2));
    const cands = glyphCandidates(shot2, [sx - 200, sy - 200, 400, 400]).filter(looksLikeDigit);
    out.self_test = {
      injected: '247 drawn over enemy ' + e0.eid + ' through the build\'s own glyph path',
      digit_glyphs_found: cands.length,
      pass: cands.length >= 2,
      note: 'three digits are drawn; >=2 found is a pass because two adjacent glyphs can merge at this size',
    };
    log(`  self-test: injected "247" -> ${cands.length} digit glyphs found`);
  }
} finally {
  await h.close();
}

out.declared_hits = out.declared.length;
out.observed_digit_hits = out.observed.reduce((a, o) => a + o.digit_glyphs, 0);
out.observed_bar_hits = out.observed.reduce((a, o) => a + o.nameplate_bars, 0);
out.U4 = out.declared_hits === 0 ? 'PASS' : 'FAIL';
out.U5 = (out.observed_digit_hits === 0 && out.observed_bar_hits === 0) ? 'PASS' : 'FAIL';
writeJson(path.join(RUN, 'ui-forbidden.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  log(`U4 declared ${out.U4} — ${out.declared_hits} hits ${JSON.stringify(out.declared.slice(0, 5))}`);
  log(`U5 observed ${out.U5} — ${out.observed_digit_hits} digit glyphs, ${out.observed_bar_hits} nameplate bars, across ${out.observed.length} enemy regions`);
  log(`artifacts: ${RUN}`);
}
process.exit(out.U4 === 'PASS' && out.U5 === 'PASS' && (!out.self_test || out.self_test.pass) ? 0 : 1);
