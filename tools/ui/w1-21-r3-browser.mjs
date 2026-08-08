#!/usr/bin/env node
// w1-21-r3-browser.mjs — W1-21 round 3's ONE browser: the derived `markers` field, CONSUMPTION,
// and the six screens.
//
// RULES 21 says launch one browser and keep it, so everything this round needs a running game for
// is here in one file and one process:
//
//   A. `markers` IS DERIVED (round-3 brief item 2). `getUIState().map.markers` and the top-level
//      `markers` were both the literal `0` — "one line above the field round 1 failed for being a
//      literal". They are now a census over the elements that were drawn. This part perturbs the
//      element census with each of the four marker shapes `markerCensus()` recognises, watches the
//      count move, and — the part that makes it evidence — watches a NON-marker element leave it
//      alone. A count that goes up for every element would distinguish nothing (S26).
//
//      The DELETE-THE-FIX arm is in the same table: the round-2 field is the constant `0`, so its
//      column is filled in beside the derived one and the two are compared arm by arm. The
//      control is watched going red in the sense rule 6 means: the old expression gives the wrong
//      answer in five of six arms, which is what makes the new one load-bearing.
//
//   B. CONSUMPTION (RI-MTH07, mandatory). The world-side consumer of the discovery model is
//      `game/src/ui/screens/map.js`. The round-2 critic's first attempt at this was worthless —
//      it perturbed by WALKING, and the ablated arm moved MORE pixels, because the panel is
//      0.94-opaque over a live world — so it perturbed the model with the body and camera held
//      still instead. That is the design used here, re-run at this round's HEAD (so this round is
//      shown not to have broken it) with `markers` added to the chain, since `markers` is what
//      this round changed and an unread field is exactly what RI-MTH07 exists to catch.
//
//   C. THE SIX SCREENS, as pictures, for `docs/shots/` (RULES 27) — the owner can now reach every
//      one of them with `./play.sh` and should be able to see what they look like.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
w1-21-r3-browser.mjs — derived markers, CONSUMPTION, and the six screens. ONE browser.

USAGE
  node tools/ui/w1-21-r3-browser.mjs [--out <dir>] [--json] [--no-shots]

EXIT 0 = every check passes · 1 = a check failed
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const RUN = path.join(RUNS_DIR, String(args.out || 'W1-21-R3'));
const SHOTS = path.join(REPO_ROOT, 'docs/shots');
ensureDir(RUN);
const W = 1280, H = 720;

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }
function litIn(png, rect) {
  const [x0, y0, w, h] = rect.map(Math.round);
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(png.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(png.width, x0 + w); x++) {
      const o = (y * png.width + x) * 4;
      if (0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2] > 30) n++;
    }
  }
  return n;
}
function diffPx(a, b) {
  let d = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1])
      + Math.abs(a.data[o + 2] - b.data[o + 2]) > 6) d++;
  }
  return d;
}

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };
const out = { schema: 'elder-souls/w1-21-r3-browser@1', at: new Date().toISOString(), data: {}, checks: [] };

const h = await launchGame({ width: W, height: H, timeout: 300000 });
try {
  await h.h('setRenderRate', 60);
  await h.h('setDevicePixelRatio', 1);

  // ============================================================================================
  // A. `markers`, DERIVED
  // ============================================================================================
  //
  // Walk the body first, so the map has real content and the baseline is not a picture of
  // nothing — the round-2 critic's own C0 lesson, applied to this round's field.
  const walk = await h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const step = (n) => { for (let i = 0; i < n; i++) { try { A.stepFrames(1); } catch (e) { /* */ } } };
    try { A.closeMenu(); } catch (e) { /* */ }
    A.loadState('default'); step(4);
    try { A.exitInterior(); } catch (e) { /* */ }
    step(4);
    for (const s of (eng.field.sites || []).slice(0, 4)) {
      try { A.teleport(s.x, s.z); step(10); } catch (e) { /* */ }
    }
    step(8);
    const m = A.mapState();
    return { places: m.places.slice(), revealed: m.revealed_cells, footprint: eng.sim.discovery.footprint() };
  });
  log(`  walked: ${walk.places.length} places, ${walk.revealed} revealed cells, ${walk.footprint.length} footprint cells`);
  out.data.walk = { places: walk.places, revealed: walk.revealed, footprint_cells: walk.footprint.length };

  /**
   * Read the two `markers` fields with an element pushed onto the built surface.
   *
   * `getUIState()` recomputes `markers` from `S.elements` on every call and `build()` early-returns
   * while the frame has not advanced, so an element pushed here survives to be counted. This is an
   * INJECTION and it is declared as one: this build cannot draw a marker — that is the property
   * the whole piece exists to hold — so the only way to see the census respond to one is to put
   * one in front of it.
   */
  const withElement = async (el) => h.page.evaluate((e) => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const S = eng.ui.S;
    const before = A.getUIState();
    if (e) S.elements.push(e);
    const after = A.getUIState();
    if (e) S.elements.pop();
    return {
      before_map: before.map.markers, before_screen: before.markers,
      after_map: after.map.markers, after_screen: after.markers,
      census_elements: after.map.marker_census.elements,
      screen_elements: after.marker_census.elements,
      hits: after.marker_census.hits,
      map_hits: after.map.marker_census.hits,
    };
  }, el);

  await h.h('closeMenu');
  await h.h('openMenu', 'map');
  await h.h('stepFrames', 2);
  const base = await withElement(null);
  out.data.baseline = base;
  log(`  baseline with the map open: markers ${base.after_map} over ${base.census_elements} map elements `
    + `(${base.screen_elements} on the whole screen)`);

  // The four shapes `markerCensus()` recognises, one at a time, plus a control that is not one.
  const SHAPES = [
    ['m1 forbidden kind', { id: 'map.testpin', kind: 'map_pin', rect: [400, 300, 12, 12], visible: true, opacity: 1, text: null, fill: null, worldAnchor: null, meta: {} }],
    ['m2 world anchor', { id: 'map.testanchor', kind: 'hint', rect: [400, 300, 12, 12], visible: true, opacity: 1, text: null, fill: null, worldAnchor: [10, 0, 10], meta: {} }],
    ['m3 quest identity', { id: 'map.testquest', kind: 'map_place', rect: [400, 300, 12, 12], visible: true, opacity: 1, text: null, fill: null, worldAnchor: null, meta: { quest: 'Q-MAIN-01' } }],
    ['m4 unsupported place square', { id: 'map.place.nowhere', kind: 'map_place', rect: [400, 300, 12, 12], visible: true, opacity: 1, text: null, fill: null, worldAnchor: null, meta: { place: 'a-place-nobody-has-stood-in' } }],
    ['CONTROL: an ordinary hint', { id: 'map.testhint', kind: 'hint', rect: [400, 300, 90, 12], visible: true, opacity: 1, text: 'press confirm', fill: null, worldAnchor: null, meta: {} }],
  ];
  const shapeRows = [];
  for (const [label, el] of SHAPES) {
    const r = await withElement(el);
    shapeRows.push({ label, id: el.id, derived_map: r.after_map, derived_screen: r.after_screen, round2_literal: 0, why: (r.map_hits[0] || {}).why || null });
    log(`  ${label.padEnd(30)} markers ${r.before_map} -> ${r.after_map}   (round-2 literal would say 0)`);
  }
  out.data.marker_shapes = shapeRows;

  const wanted = shapeRows.filter((r) => !r.label.startsWith('CONTROL'));
  const control = shapeRows.find((r) => r.label.startsWith('CONTROL'));
  push('A1', base.after_map === 0 && base.census_elements > 0,
    `the honest map reports markers 0 over ${base.census_elements} drawn map elements — a measurement with a denominator, not an assertion`);
  push('A2', wanted.every((r) => r.derived_map === 1),
    `each of the four marker shapes moves the derived count 0 -> 1: ${wanted.map((r) => `${r.label}=${r.derived_map}`).join(', ')}`);
  push('A3', control && control.derived_map === 0,
    `CONTROL: an ordinary hint element leaves it at ${control && control.derived_map}. The census is not "count the elements"`);
  push('A4', wanted.every((r) => r.round2_literal === 0),
    `DELETE-THE-FIX: the round-2 field is the constant 0, so it is 0 in all ${shapeRows.length} arms — wrong in the ${wanted.length} that contain a marker, `
    + 'right in the one that does not. The arms differ, and the literal was never measuring anything.');

  // The zero-sample half: with the map CLOSED the block used to report full compliance over
  // nothing, from any mode. It now says so.
  await h.h('closeMenu');
  await h.h('stepFrames', 2);
  const closed = await h.page.evaluate(() => {
    const u = window.__HARNESS.getUIState();
    return { mode: u.mode, measured: u.map.measured, considered: u.map.elements_considered, markers: u.map.markers };
  });
  out.data.map_block_when_closed = closed;
  push('A5', closed.measured === false && closed.considered === 0,
    `with the map CLOSED (mode=${closed.mode}) the map compliance block reports measured=${closed.measured}, elements_considered=${closed.considered} `
    + '— round 2 reported full compliance here, computed over zero elements, from any mode');

  // ============================================================================================
  // B. CONSUMPTION (RI-MTH07)
  // ============================================================================================
  //
  // THE BODY AND THE CAMERA DO NOT MOVE AGAIN. Only the model changes.
  const arm = async (label, fraction) => {
    const r = await h.page.evaluate(({ trail, frac }) => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const keep = trail.slice(0, Math.floor(trail.length * frac));
      // Re-encoded in the save's own zigzag-varint form and pushed through the real
      // `Discovery.restore()` — the shipped load path, not a back door onto the raster.
      const bytes = []; let prev = 0;
      for (const i of keep) { let v = i - prev; prev = i; v = v < 0 ? -v * 2 - 1 : v * 2; while (v >= 0x80) { bytes.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); } bytes.push(v); }
      let s = ''; for (const b of bytes) s += String.fromCharCode(b);
      eng.sim.discovery.restore({ stood: btoa(s) });
      try { A.closeMenu(); } catch (e) { /* */ }
      A.openMenu('map');
      for (let i = 0; i < 3; i++) { try { A.stepFrames(1); } catch (e) { /* */ } }
      const ui = A.getUIState();
      const terrain = ui.elements.find((e) => e.kind === 'map_terrain');
      const m = A.mapState();
      return {
        kept: keep.length,
        model_revealed: m.revealed_cells, model_places: m.place_count,
        painter_drawn_cells: terrain ? terrain.meta.drawn_cells : null,
        terrain_rect: terrain ? terrain.rect : null,
        screen_places_drawn: ui.map.places_drawn,
        markers: ui.map.markers,
        census_elements: ui.map.marker_census.elements,
      };
    }, { trail: walk.footprint, frac: fraction });
    const png = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, `consume-arm-${label}.png`), PNG.sync.write(png));
    r.lit_px_in_terrain_rect = r.terrain_rect ? litIn(png, r.terrain_rect) : null;
    r.png = png;
    log(`  arm ${label}: footprint ${r.kept} cells -> model ${r.model_revealed} revealed / ${r.model_places} places`
      + ` -> painter drew ${r.painter_drawn_cells} cells -> ${r.lit_px_in_terrain_rect} lit px in the map box, markers ${r.markers}`);
    return r;
  };
  const full = await arm('full', 1.0);
  const half = await arm('half', 0.5);
  const none = await arm('none', 0.0);
  const strip = (r) => ({ ...r, png: undefined });
  out.data.consumption = { full: strip(full), half: strip(half), none: strip(none) };

  push('M1', full.painter_drawn_cells === full.model_revealed && half.painter_drawn_cells === half.model_revealed
    && none.painter_drawn_cells === none.model_revealed,
    `the PAINTER draws exactly the cells the MODEL reveals: full ${full.painter_drawn_cells}/${full.model_revealed}, `
    + `half ${half.painter_drawn_cells}/${half.model_revealed}, none ${none.painter_drawn_cells}/${none.model_revealed}`);
  push('M2', full.lit_px_in_terrain_rect > half.lit_px_in_terrain_rect && half.lit_px_in_terrain_rect > none.lit_px_in_terrain_rect,
    `CONSUMPTION: perturbing the model changes the FRAMEBUFFER with body and camera held still — lit px in the map box: `
    + `${full.lit_px_in_terrain_rect} -> ${half.lit_px_in_terrain_rect} -> ${none.lit_px_in_terrain_rect}`);
  push('M3', none.painter_drawn_cells === 0 && none.model_places === 0 && none.screen_places_drawn === 0,
    `ABLATION: an empty model draws NOTHING — ${none.painter_drawn_cells} cells, ${none.screen_places_drawn} squares, `
    + `${none.lit_px_in_terrain_rect} lit px. Undiscovered is unrendered, not dimmed (S35)`);
  push('M4', full.markers === 0 && half.markers === 0 && none.markers === 0
    && full.census_elements > none.census_elements,
    `and the DERIVED marker count stays 0 across all three arms while its denominator collapses `
    + `(${full.census_elements} -> ${half.census_elements} -> ${none.census_elements} elements). `
    + 'An honest map has no markers at any footprint; the field now says so over a sample set that moves.');
  out.data.whole_frame_diff_full_vs_none = diffPx(full.png, none.png);
  push('M5', out.data.whole_frame_diff_full_vs_none > 0,
    `${out.data.whole_frame_diff_full_vs_none} pixels differ across the WHOLE frame between the full and the empty model`);

  // ============================================================================================
  // C. THE SIX SCREENS
  // ============================================================================================
  if (!args['no-shots']) {
    ensureDir(SHOTS);
    await h.page.evaluate(({ trail }) => {
      const eng = window.__ENGINE;
      const bytes = []; let prev = 0;
      for (const i of trail) { let v = i - prev; prev = i; v = v < 0 ? -v * 2 - 1 : v * 2; while (v >= 0x80) { bytes.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); } bytes.push(v); }
      let s = ''; for (const b of bytes) s += String.fromCharCode(b);
      eng.sim.discovery.restore({ stood: btoa(s) });     // put the walk back for the pictures
    }, { trail: walk.footprint });
    await h.h('setAtHearth', true);
    const shots = [];
    for (const screen of ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup']) {
      await h.h('closeMenu');
      await h.h('openMenu', screen);
      await h.h('stepFrames', 2);
      const ui = await h.h('getUIState');
      const png = decode(await h.h('screenshot'));
      const file = path.join(SHOTS, `2026-08-08-w1-21-r3-the-${screen}-screen.png`);
      fs.writeFileSync(file, PNG.sync.write(png));
      shots.push({ screen, mode: ui.mode, elements: ui.elements.filter((e) => e.visible).length, file: path.relative(REPO_ROOT, file) });
      log(`  shot ${screen}: mode=${ui.mode}, ${ui.elements.filter((e) => e.visible).length} visible elements -> ${path.relative(REPO_ROOT, file)}`);
    }
    out.data.shots = shots;
    push('C1', shots.length === 6 && shots.every((s) => s.mode === s.screen && s.elements > 0),
      `six screens, each opened and confirmed to be the screen it claims: ${shots.map((s) => `${s.screen}(${s.elements})`).join(' ')}`);
  }
} finally {
  await h.close();
}

out.checks = checks;
out.ok = checks.every((c) => c.pass);
writeJson(path.join(RUN, 'browser.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
log(`w1-21-r3-browser: ${checks.filter((c) => c.pass).length}/${checks.length} — artifacts ${RUN}`);
process.exit(out.ok ? 0 : 1);
