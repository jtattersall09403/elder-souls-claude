#!/usr/bin/env node
// critic-map-r2-composite.mjs — the unrendered test taken on THE PIXELS THE PLAYER SEES.
//
// WHY THIS EXISTS, and it is a correction to my own instrument as well as to the round-1 verdict.
//
// `critic-map-r2.mjs` U1/U2 and `critic-w1-map-r1.mjs` C1/C3 both read `UISurface.ctx.getImageData`
// — the interface's OWN 2D canvas — and both report that the undiscovered ground holds exactly one
// colour with a per-channel range of [0,0,0]. That is true of the UI layer and it is NOT true of
// the screen: the map panel is drawn at CALM_ALPHA over the running 3D world, and in
// `docs/shots/2026-08-08-critic-map-r2-fresh.png` the arches and buildings of the Rootlands are
// plainly visible through the black terrain box. A verdict that says "the terrain box holds one
// colour" is describing a surface, not a picture.
//
// So this takes the same measurement off a SCREENSHOT — the composited frame, decoded with pngjs —
// clipped to the terrain element's own rect, with the chevron and the naming label excluded. It
// reports both numbers side by side so the difference between them is on the record.
//
// The S35 question is narrower than either number, and this tool separates it:
//   * IS THE PROVINCE'S GEOMETRY IN THE SCENE? Read off the DRAW LOOP and off `drawn_cells`, not
//     off a colour count. `screens/map.js:103` is `if (!m.seen(cx, rz)) continue;` and the fresh
//     map reports `drawn_cells = 0`, so no undiscovered cell is ever painted at any alpha.
//   * WHAT SHOWS THROUGH IS THE 3D WORLD BEHIND THE MENU, not the map. Proved here by moving the
//     CAMERA with the map open and the discovery model untouched: if the variation inside the
//     terrain box changes when the camera turns, it is the scene behind the panel; if it changes
//     when the FOOTPRINT changes, it is the map. Both arms are run.
//
// A colour count that cannot tell those two apart is the thing to fix, and this is the fix.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-map-r2-composite.mjs — "undiscovered is unrendered" measured on the composited frame.

USAGE
  node tools/harness/critic-map-r2-composite.mjs [--out <dir>]

Exit 0 = the province's geometry is absent from the scene and what varies inside the terrain box
is attributable to the world behind the panel rather than to the map.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'CRITIC-W1-MAP-R2');
ensureDir(outDir);

/** Distinct colours and per-channel range inside `rect`, skipping `holes`. */
function inkOf(png, rect, holes) {
  const [x0, y0, w, h] = rect.map((v) => Math.round(v));
  const seen = new Map();
  let n = 0, rlo = 255, rhi = 0, glo = 255, ghi = 0, blo = 255, bhi = 0;
  for (let y = y0 + 2; y < y0 + h - 2; y++) {
    for (let x = x0 + 2; x < x0 + w - 2; x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      let skip = false;
      for (const b of holes) {
        if (x >= b[0] - 3 && x <= b[0] + b[2] + 3 && y >= b[1] - 3 && y <= b[1] + b[3] + 3) { skip = true; break; }
      }
      if (skip) continue;
      const i = (png.width * y + x) << 2;
      const r = png.data[i], g = png.data[i + 1], b2 = png.data[i + 2];
      if (r < rlo) rlo = r; if (r > rhi) rhi = r;
      if (g < glo) glo = g; if (g > ghi) ghi = g;
      if (b2 < blo) blo = b2; if (b2 > bhi) bhi = b2;
      const k = (r << 16) | (g << 8) | b2;
      seen.set(k, (seen.get(k) || 0) + 1);
      n++;
    }
  }
  const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  return {
    distinct: seen.size, pixels: n,
    dominant: '#' + (sorted[0] ? sorted[0][0] : 0).toString(16).padStart(6, '0'),
    dominant_frac: n ? +(sorted[0][1] / n).toFixed(4) : 0,
    channel_range: [rhi - rlo, ghi - glo, bhi - blo],
  };
}

const handle = await launchGame(args);
const R = [];
const A = (id, name, got, pass, target) => { R.push({ id, name, got: String(got), target, pass: !!pass }); };
let out = {};
try {
  const { page } = handle;

  /**
   * Open the map with the body STANDING AT `at`, and with the footprint either cleared or walked.
   *
   * The order of the last three lines is the whole fixture and my first version had it wrong:
   * `restore(null)` must come AFTER the positioning steps, because `stepDiscovery` runs on every
   * fixed step and records the cell the body is in. Clearing first and then stepping produced
   * `drawn_cells = 69` on an arm labelled "fresh", which would have made the empty-map reading a
   * measurement of a map that was not empty. `openMenu` pauses the world, so nothing steps after.
   *
   * The scene behind the panel is varied by MOVING THE BODY, not by writing `player.yaw` — that
   * write did not survive the next step and both "camera" arms came back at yaw 180.
   */
  const setup = (which, at) => page.evaluate(async ([w, a]) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const eng = window.__ENGINE;
    const sim = eng.sim;
    const D = sim.discovery;
    const walkTo = (x, z) => { H.teleport(x, z, {}); H.stepFrames(2); };
    H.closeMenu();
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    if (w === 'walked') for (let i = 0; i < 12; i++) walkTo(2000 + i * 120, 800 + i * 60);
    walkTo(a[0], a[1]);                       // stand where this arm is photographed from
    if (w !== 'walked') D.restore(null);       // clear AFTER positioning, so the arm is truly fresh
    H.openMenu('map', {});
    if (H.renderFrame) H.renderFrame();
    const S = eng.ui.S;
    const terr = S.elements.find((e) => e.kind === 'map_terrain');
    const plr = S.elements.find((e) => e.kind === 'map_player');
    const nam = S.elements.find((e) => e.id === 'map.naming');
    // The UI layer's own reading — BOTH ways, because the difference between them is a warning the
    // round-1 verdict left on the record and this arm reproduces: sampled naively the blank map
    // reads ~15 colours, ALL of them the player chevron's antialiased edge. Excluding the chevron
    // and the naming label is what makes the number mean "how much province is painted".
    const box = terr.rect.map(Math.round);
    const bx = box[0] + 2, by = box[1] + 2, bw = box[2] - 4, bh = box[3] - 4;
    const img = S.ctx.getImageData(bx, by, bw, bh).data;
    const holeRects = [plr, nam].filter(Boolean).map((e) => e.rect);
    const naive = new Set(); const clean = new Set();
    let lo = 255, hi = 0;
    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const i = (py * bw + px) * 4;
        const k = (img[i] << 16) | (img[i + 1] << 8) | img[i + 2];
        naive.add(k);
        const gx = bx + px, gy = by + py;
        let skip = false;
        for (const b of holeRects) {
          if (gx >= b[0] - 3 && gx <= b[0] + b[2] + 3 && gy >= b[1] - 3 && gy <= b[1] + b[3] + 3) { skip = true; break; }
        }
        if (skip) continue;
        clean.add(k);
        if (img[i] < lo) lo = img[i]; if (img[i] > hi) hi = img[i];
      }
    }
    const dpr = window.devicePixelRatio || 1;
    return {
      rect: terr.rect, dpr,
      holes: [plr, nam].filter(Boolean).map((e) => e.rect),
      ui_layer: { distinct_naive: naive.size, distinct: clean.size, red_range: hi - lo },
      drawn_cells: terr.meta.drawn_cells, total_cells: terr.meta.total_cells,
      revealed: D.revealedCells, stood: D.stoodCells,
      at: [Math.round(sim.player.pos[0]), Math.round(sim.player.pos[2])],
    };
  }, [which, at]);

  const shot = async (geo) => {
    const buf = await page.screenshot();
    const png = PNG.sync.read(buf);
    const s = geo.dpr;
    const rect = geo.rect.map((v) => v * s);
    const holes = geo.holes.map((b) => b.map((v) => v * s));
    return inkOf(png, rect, holes);
  };

  const SPOT_A = [2000, 800], SPOT_B = [3400, 3900];
  // ---- 1. FRESH, standing at A ---------------------------------------------------------------
  const g1 = await setup('fresh', SPOT_A);
  const c1 = await shot(g1);
  // ---- 2. FRESH, standing at B. The map model is identical; only the scene behind it moved. ---
  const g2 = await setup('fresh', SPOT_B);
  const c2 = await shot(g2);
  // ---- 3. WALKED, standing at A. The scene matches arm 1; only the footprint moved. -----------
  const g3 = await setup('walked', SPOT_A);
  const c3 = await shot(g3);

  A('X1', 'THE PROVINCE IS NOT IN THE SCENE: a fresh map paints zero cells',
    `drawn_cells=${g1.drawn_cells}/${g1.total_cells}, revealed=${g1.revealed}, stood=${g1.stood}; screens/map.js:103 is "if (!m.seen(cx,rz)) continue;"`,
    g1.drawn_cells === 0 && g1.revealed === 0,
    '0 cells painted — no undiscovered geometry is drawn at any alpha');
  A('X2', 'THE UI LAYER holds one colour once the chevron is excluded — and ~15 if it is not',
    `UI canvas inside the terrain box: naive=${g1.ui_layer.distinct_naive} colours, chevron+label excluded=${g1.ui_layer.distinct}, red range=${g1.ui_layer.red_range}`,
    g1.ui_layer.distinct === 1 && g1.ui_layer.distinct_naive > 1,
    '1 with the chevron excluded, more without — an attack that did not exclude it would invent a finding');
  A('X3', 'THE COMPOSITED FRAME DOES NOT: the panel is translucent and the world shows through',
    `screenshot inside the same box: distinct=${c1.distinct} over ${c1.pixels}px, dominant=${c1.dominant} (${(c1.dominant_frac * 100).toFixed(2)}%), channel range=${JSON.stringify(c1.channel_range)}`,
    c1.distinct > 1,
    'MORE than one colour — recorded so that "the box holds exactly one colour" is not read as a claim about the picture');
  A('X4', 'WHAT VARIES IS THE SCENE, NOT THE MAP: moving the body changes the box on an EMPTY model',
    `stood at ${JSON.stringify(g1.at)} -> ${JSON.stringify(g2.at)}, map identical (drawn_cells ${g1.drawn_cells} -> ${g2.drawn_cells}); distinct ${c1.distinct} -> ${c2.distinct}, dominant ${c1.dominant} -> ${c2.dominant}`,
    g1.drawn_cells === 0 && g2.drawn_cells === 0 && (c2.distinct !== c1.distinct || c2.dominant !== c1.dominant),
    'both maps empty, the box still differs — so the variation is the world behind the panel');
  A('X5', 'AND THE MAP IS WHAT CHANGES WHEN THE FOOTPRINT CHANGES: same spot, a walked body',
    `both arms stood at ${JSON.stringify(g3.at)}; drawn_cells ${g1.drawn_cells} -> ${g3.drawn_cells}, distinct ${c1.distinct} -> ${c3.distinct}, dominant frac ${(c1.dominant_frac * 100).toFixed(2)}% -> ${(c3.dominant_frac * 100).toFixed(2)}%`,
    g3.drawn_cells > 0 && c3.distinct > c1.distinct,
    'the box gains colours when the body walked — the two causes are separable');

  out = { fresh_yawA: { geo: g1, composite: c1 }, fresh_yawB: { geo: g2, composite: c2 }, walked_yawA: { geo: g3, composite: c3 } };
} finally {
  await handle.close();
}

for (const c of R) log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.name}\n         got:  ${c.got}\n         want: ${c.target}`);
const red = R.filter((c) => !c.pass);
writeJson(path.join(outDir, 'critic-map-r2-composite.json'), { schema: 'elder-souls/critic-map-r2-composite@1', checks: R, ...out });
log(`\n${R.length - red.length}/${R.length} — wrote ${path.join(outDir, 'critic-map-r2-composite.json')}`);
process.exit(red.length ? EXIT.FAIL : EXIT.OK);
