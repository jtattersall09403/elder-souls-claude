#!/usr/bin/env node
// critic-w1-21-r2-consume.mjs — the W1-21 round-2 CRITIC's CONSUMPTION instrument (RI-MTH07).
// Written by the critic; declared in orchestration/status/critic-w1-21-r2.json.
//
// WHY THIS IS A SEPARATE, THIRD PROBE, AND THE REASON IS THE MEASUREMENT AND NOT TIDINESS.
//
// My first CONSUMPTION arm perturbed the model BY WALKING — teleport somewhere new, reopen the
// map, diff the frames — and it produced 1,586,540 changed pixels on the live arm and 1,608,316
// on the SUSPENDED (ablated) arm, which discriminates nothing. The cause is that the map screen
// is drawn at opacity 0.94 over a LIVE WORLD, so teleporting the body changes ~6% of every pixel
// on the panel before the map has drawn anything at all. A pixel diff across a teleport cannot
// tell the map from the sky behind it, and reporting the 1.58M as evidence would have been a
// number that looked like proof and was scenery.
//
// So this probe perturbs the model WITHOUT MOVING THE BODY OR THE CAMERA: it takes the honest
// footprint, truncates it, and pushes it back through `Discovery.restore()`. The world behind is
// then byte-identical between arms by construction, and every pixel that changes is the map.
//
//   arm 1  restore(full footprint)      -> drawn_cells, lit pixels in the map.terrain rect
//   arm 2  restore(half the footprint)  -> the same two numbers
//   arm 3  restore(empty)               -> the floor
//
// `drawn_cells` is not the model's number: `game/src/ui/screens/map.js` increments it INSIDE the
// fill loop and writes it back onto the element after painting, so it is the PAINTER's count of
// rectangles it actually filled. Model -> painter -> pixels, with a separate witness at each step.
//
// USAGE  node tools/ui/critic-w1-21-r2-consume.mjs [--out DIR]
// EXIT   0 = consumption demonstrated · 1 = not · 2 = could not measure
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('critic-w1-21-r2-consume.mjs — RI-MTH07 for the discovery map.');
const say = (s) => process.stdout.write(s + '\n');
const W = Number(args.width || 1280), H = Number(args.height || 720);
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R2'));
ensureDir(RUN);
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));

const out = {
  probe: 'critic-w1-21-r2-consume', at: new Date().toISOString(),
  loadavg_start: fs.readFileSync('/proc/loadavg', 'utf8').trim(), checks: [], data: {},
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, result: ok ? 'pass' : 'fail', detail });
  say(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}  — ${detail}`);
};
/** Pixels inside `rect` brighter than a floor — "how much terrain is painted". */
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

const h = await launchGame({ width: W, height: H, timeout: 300000 });
try {
  await h.h('setRenderRate', 60);
  const walk = await h.page.evaluate(() => {
    const H2 = window.__HARNESS, eng = window.__ENGINE;
    const step = (n) => { for (let i = 0; i < n; i++) { try { H2.stepFrames(1); } catch (e) { /* neighbour */ } } };
    const clear = () => { try { for (const e of (H2.listEntities() || [])) { if (e && e.eid !== undefined && e.archetype !== 'player') { try { H2.despawn(e.eid); } catch (x) { /* */ } } } } catch (x) { /* */ } };
    try { H2.closeMenu(); } catch (e) { /* */ }
    H2.loadState('default'); step(4);
    try { H2.exitInterior(); } catch (e) { /* */ }
    step(4);
    for (const s of (eng.field.sites || []).slice(0, 3)) {
      try { H2.teleport(s.x, s.z); clear(); step(10); } catch (e) { /* */ }
    }
    clear(); step(8);
    const m = H2.mapState();
    return { places: m.places.slice(), revealed: m.revealed_cells, footprint: eng.sim.discovery.footprint(), blob: H2.saveState() };
  });
  out.data.walk = { places: walk.places, revealed: walk.revealed, footprint_cells: walk.footprint.length };
  say(`  walked: ${walk.places.length} places, ${walk.revealed} revealed, ${walk.footprint.length} footprint cells`);

  // THE BODY AND THE CAMERA NEVER MOVE AGAIN FROM HERE. Only the model changes.
  const arm = async (label, fraction) => {
    const r = await h.page.evaluate(({ trail, frac }) => {
      const H2 = window.__HARNESS, eng = window.__ENGINE;
      const keep = trail.slice(0, Math.floor(trail.length * frac));
      // Re-encode the kept prefix in the save's own zigzag-varint form and push it through the
      // real `restore()`. Nothing else about the world is touched.
      const bytes = []; let prev = 0;
      for (const i of keep) { let v = i - prev; prev = i; v = v < 0 ? -v * 2 - 1 : v * 2; while (v >= 0x80) { bytes.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); } bytes.push(v); }
      let s = ''; for (const b of bytes) s += String.fromCharCode(b);
      eng.sim.discovery.restore({ stood: btoa(s) });
      try { H2.closeMenu(); } catch (e) { /* */ }
      H2.openMenu('map');
      for (let i = 0; i < 3; i++) { try { H2.stepFrames(1); } catch (e) { /* */ } }
      const ui = H2.getUIState();
      const terrain = ui.elements.find((e) => e.kind === 'map_terrain');
      const m = H2.mapState();
      return {
        kept: keep.length,
        model_revealed: m.revealed_cells, model_places: m.place_count,
        painter_drawn_cells: terrain ? terrain.meta.drawn_cells : null,
        terrain_rect: terrain ? terrain.rect : null,
        screen_places_drawn: ui.map.places_drawn,
      };
    }, { trail: walk.footprint, frac: fraction });
    const png = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, `consume-arm-${label}.png`), PNG.sync.write(png));
    r.lit_px_in_terrain_rect = r.terrain_rect ? litIn(png, r.terrain_rect) : null;
    r.png = png;
    say(`  arm ${label}: footprint ${r.kept} cells -> model ${r.model_revealed} revealed / ${r.model_places} places`
      + ` -> painter drew ${r.painter_drawn_cells} cells -> ${r.lit_px_in_terrain_rect} lit px in the map box`);
    return r;
  };

  const full = await arm('full', 1.0);
  const half = await arm('half', 0.5);
  const none = await arm('none', 0.0);
  const strip = (r) => ({ ...r, png: undefined });
  out.data.arms = { full: strip(full), half: strip(half), none: strip(none) };

  push('M1', 'the PAINTER draws exactly the cells the MODEL reveals (drawn_cells == revealed_cells)',
    full.painter_drawn_cells === full.model_revealed && half.painter_drawn_cells === half.model_revealed
      && none.painter_drawn_cells === none.model_revealed,
    `full ${full.painter_drawn_cells}/${full.model_revealed}, half ${half.painter_drawn_cells}/${half.model_revealed}, none ${none.painter_drawn_cells}/${none.model_revealed}`);
  push('M2', 'CONSUMPTION: perturbing the model changes what reaches the FRAMEBUFFER, world and camera held still',
    full.lit_px_in_terrain_rect > half.lit_px_in_terrain_rect && half.lit_px_in_terrain_rect > none.lit_px_in_terrain_rect,
    `lit pixels inside the map drawing box: full ${full.lit_px_in_terrain_rect}, half ${half.lit_px_in_terrain_rect}, none ${none.lit_px_in_terrain_rect}`);
  push('M3', 'ABLATION: an empty model draws NOTHING — undiscovered is unrendered, not dimmed (S35)',
    none.painter_drawn_cells === 0 && none.model_places === 0 && none.screen_places_drawn === 0,
    `empty footprint -> ${none.painter_drawn_cells} cells drawn, ${none.screen_places_drawn} squares, ${none.lit_px_in_terrain_rect} lit px in the box`);
  let d = 0;
  for (let i = 0; i < full.png.width * full.png.height; i++) {
    const o = i * 4;
    if (Math.abs(full.png.data[o] - none.png.data[o]) + Math.abs(full.png.data[o + 1] - none.png.data[o + 1])
      + Math.abs(full.png.data[o + 2] - none.png.data[o + 2]) > 6) d++;
  }
  out.data.full_vs_none_whole_frame_px = d;
  push('M4', 'CONTROL: with the body and camera still, the ONLY thing that moved is the map',
    d > 0 && d < full.png.width * full.png.height * 0.25,
    `${d} pixels differ across the whole frame between the full and the empty model — compare the `
    + `1,586,540 my walking arm produced, of which almost all was the live world behind a 0.94-opaque panel.`);
} finally {
  out.loadavg_end = fs.readFileSync('/proc/loadavg', 'utf8').trim();
  await h.close();
}
out.pass = out.checks.filter((c) => c.result === 'pass').length;
out.fail = out.checks.filter((c) => c.result === 'fail').length;
writeJson(path.join(RUN, 'critic-w1-21-r2-consume.json'), out);
say(`\n${out.pass} pass, ${out.fail} fail`);
process.exit(out.fail ? 1 : 0);
