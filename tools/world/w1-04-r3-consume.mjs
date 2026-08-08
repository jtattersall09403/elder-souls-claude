#!/usr/bin/env node
// W1-04 round 3 — THE CONSUMPTION CHECK, and the picture.
//
// `ARBITRATION.md` §3 / `RI-MTH07`: for every model a piece ships, name the world-side consumer
// and demonstrate it by perturbing the model and watching an entity change behaviour.
//
//   MODEL:     `game/data/world/settlements/*.json § buildings[]` and `§ architecture_kit.meshes`,
//              plus `game/data/world/interiors/*.json § continuity.exterior_footprint_m`.
//   CONSUMER:  `game/src/world/province.js#_settlementBuildings()` (drawn, per streamed tile) and
//              `Engine._settleSettlementSolids()` (solid, per fixed step). Before this round the
//              buildings list had exactly two readers — the door table and a `.length`.
//   DEMONSTRATION: perturb the record at runtime, re-request the tiles, and read the answer OFF
//              THE RENDERER'S SCENE GRAPH and OFF THE COLLISION SET. Not off the data.
//
// Deliberately small and deliberately one town: split out of `w1-04-r3-exterior.mjs --live` after
// that run had to be killed on a box carrying 40-odd browsers. One browser, kept. No timing
// figure is published from it (RULES.md rule 26).
//
// It also takes the three pictures, in the same browser, because a second launch is a second
// browser on a box that has no room for one.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATE = '2026-08-07';
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));

// 1280x720, not 1600x900: on a box carrying 40 browsers SwiftShader could not rasterise a
// 1600x900 frame inside Playwright's 30 s screenshot timeout, and the throw took the whole
// report down with it. Smaller frame, longer timeout, and the shots are now in their own
// try/catch so a picture that cannot be taken costs the picture and not the measurement.
const B = await launchGame({ width: 1280, height: 720 });
const errors = [];
B.page.on('pageerror', (e) => errors.push(String(e)));
const out = { tool: 'tools/world/w1-04-r3-consume.mjs', shots: [] };

try {
  const consume = await B.page.evaluate(() => {
    const H = window.__HARNESS;
    const rec = H.__w1_04_settlement('thorn');
    const ints = {};
    for (const b of rec.buildings) if (b.interior) ints[b.interior] = H.__w1_04_interior(b.interior);
    H.teleport(rec.pos[0] + 14, rec.pos[2] + 14);
    H.stepFrames(8); H.renderFrame();

    // THE READ. Everything below comes from the scene graph and the live collision set.
    const read = () => {
      const d = H.getDrawnSettlements();
      const t = d.settlements.find((s) => s.id === 'thorn') || null;
      const solids = H.getSettlementSolids();
      const hall = t ? t.drawn.find((b) => b.id === 'thorn-hall') : null;
      return {
        buildings_in_the_scene_graph: t ? t.building_groups : 0,
        meshes: t ? t.meshes : 0,
        triangles: t ? t.triangles : 0,
        kit_meshes: t ? t.kit_meshes : 0,
        kit_ids: t ? [...new Set(t.drawn.flatMap((b) => b.kit))].sort() : [],
        thorn_hall_drawn_footprint_m: hall ? hall.footprint_m : null,
        collision_shapes_in_sim_cell: solids.shapes,
        collision_cell_id: solids.cell_id,
      };
    };
    const base = read();

    // (a) THE BUILDING LIST. 15 -> 5.
    const a = JSON.parse(JSON.stringify(rec));
    a.buildings = a.buildings.slice(0, 5);
    H.__w1_04_perturbSettlement(a, ints);
    H.stepFrames(8); H.renderFrame();
    const fewer = read();

    // (b) ONE BUILDING'S FOOTPRINT. thorn-hall [16,18] -> [22,24].
    const ints2 = JSON.parse(JSON.stringify(ints));
    ints2['thorn-hall'].continuity.exterior_footprint_m = [22, 24];
    H.__w1_04_perturbSettlement(JSON.parse(JSON.stringify(rec)), ints2);
    H.stepFrames(8); H.renderFrame();
    const bigger = read();

    // (c) THE KIT. Thorn's own -> Gideon's, inside and out.
    const c = JSON.parse(JSON.stringify(rec));
    c.architecture_kit.meshes = H.__w1_04_settlement('gideon').architecture_kit.meshes.slice();
    const ints3 = JSON.parse(JSON.stringify(ints));
    const GID = ['gid_timber_frame', 'gid_tile_roof', 'gid_market_cross', 'gid_square_arcade'];
    for (const k of Object.keys(ints3)) ints3[k].props = (ints3[k].props || []).filter((p) => !p.startsWith('tho_')).concat(GID);
    H.__w1_04_perturbSettlement(c, ints3);
    H.stepFrames(8); H.renderFrame();
    const otherKit = read();

    // RESTORE, and confirm the original number comes back (RULES.md #6, the other direction).
    H.__w1_04_perturbSettlement(rec, ints);
    H.stepFrames(8); H.renderFrame();
    const restored = read();

    return { base, a_fewer_buildings: fewer, b_bigger_footprint: bigger, c_other_towns_kit: otherKit, restored };
  });
  out.consumption = consume;
  console.log('\n## CONSUMPTION (RI-MTH07) — perturb the record, read the renderer and the collision set');
  for (const [k, v] of Object.entries(consume)) console.log(`  ${k.padEnd(22)} ${JSON.stringify(v)}`);
  out.consumption_verdict = {
    building_list_is_read: consume.base.buildings_in_the_scene_graph !== consume.a_fewer_buildings.buildings_in_the_scene_graph,
    footprint_is_read: JSON.stringify(consume.base.thorn_hall_drawn_footprint_m) !== JSON.stringify(consume.b_bigger_footprint.thorn_hall_drawn_footprint_m),
    kit_is_read: JSON.stringify(consume.base.kit_ids) !== JSON.stringify(consume.c_other_towns_kit.kit_ids),
    collision_follows_the_model: consume.base.collision_shapes_in_sim_cell !== consume.a_fewer_buildings.collision_shapes_in_sim_cell,
    restores: JSON.stringify(consume.base) === JSON.stringify(consume.restored),
  };
  console.log('\n', JSON.stringify(out.consumption_verdict, null, 1));

  // ---- THE PICTURES ---------------------------------------------------------------------------
  const POSES = [
    { name: `${DATE}-w1-04-r3-vp04-settlement-street-thorn-buildings-drawn`, cam: { pos: [3825.5, 15.1, 879], look: [3820.5, 14, 864], fov: 60 }, draw: true, hour: 9 },
    { name: `${DATE}-w1-04-r3-vp04-settlement-street-thorn-draw-call-cut`, cam: { pos: [3825.5, 15.1, 879], look: [3820.5, 14, 864], fov: 60 }, draw: false, hour: 9 },
    { name: `${DATE}-w1-04-r3-helstrom-forty-buildings-round-the-hist`, cam: { pos: [2262.5 + 86, 27.22 + 26, 2773.5 + 86], look: [2262.5, 27.22 + 6, 2773.5], fov: 55 }, draw: true, hour: 10 },
  ];
  const outDir = path.join(ROOT, 'docs/shots');
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of POSES) {
   try {
    const info = await B.page.evaluate((q) => {
      const H = window.__HARNESS;
      H.setTimeOfDay(q.hour); H.setWeather('clear');
      H.teleport(q.cam.pos[0], q.cam.pos[2]);
      H.__w1_04_drawBuildings(q.draw);
      H.camera(q.cam);
      H.stepFrames(10); H.renderFrame();
      const d = H.getDrawnSettlements();
      return { buildings: d.buildings, meshes: d.meshes, kit: d.kit_meshes };
    }, p);
    const file = path.join(outDir, `${p.name}.png`);
    await B.page.screenshot({ path: file, timeout: 240000 });
    out.shots.push({ file: path.relative(ROOT, file), ...info });
    console.log(`shot ${p.name}: buildings=${info.buildings} meshes=${info.meshes} kit=${info.kit}`);
   } catch (e) {
    out.shots.push({ name: p.name, failed: String(e && e.message || e) });
    console.log(`shot ${p.name}: FAILED — ${e && e.message}`);
   }
  }
  await B.page.evaluate(() => window.__HARNESS.__w1_04_drawBuildings(true));
} finally {
  out.errors = errors;
  // WRITTEN IN THE FINALLY, and the reason is that the first run of this tool lost a complete,
  // passing consumption measurement because a screenshot timed out thirty lines later.
  const p = path.join(ROOT, 'reports/w1-04-r3-consume.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${path.relative(ROOT, p)}  page errors: ${errors.length}`);
  await B.close();
}
process.exit(errors.length ? 1 : 0);
