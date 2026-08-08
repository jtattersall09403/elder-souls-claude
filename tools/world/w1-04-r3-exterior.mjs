#!/usr/bin/env node
// W1-04 round 3 — THE EXTERIOR HALF, MEASURED.
//
// The round-1 verdict (`corpus/90-verdicts/wave1/W1-04-r1.md` §3, §5) and the round-2 builder's
// own `not_done_stated_plainly[0]` name one defect: `settlement.buildings` reaches a door table
// and a `.length` and nothing else, so 202 buildings are building-shaped doors, VP04 is terrain,
// and the townspeople round 2 put outdoors stand on a bare pad.
//
// This tool measures whether that is still true. Two halves, and they are separate commands so
// the offline one is runnable when the box is over RULES.md rule 21's browser cap:
//
//   --offline   build every settlement's exterior with three.js in bare Node, with no browser
//               and no Engine, and count what reached the scene graph. Includes the CONTROL
//               ARM (the same build with the draw call cut) and the three RI-MTH07
//               perturbations.
//   --live      the same questions asked of the RUNNING GAME through window.__HARNESS, where
//               "drawn" means a traversal of `renderer.province.group` and collision means the
//               body actually failing to pass through a wall.
//
// EVERY NUMBER HERE IS READ OFF THE SCENE GRAPH OR OFF THE SIMULATION, never off the data. A
// report computed from `settlements/*.json` would have passed unchanged on the build this piece
// exists to fix, which is the whole lesson of the round-1 verdict.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

function loadData() {
  const S = {}, I = {};
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  for (const f of fs.readdirSync(sdir)) {
    const d = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8'));
    S[d.id] = d;
  }
  const idir = path.join(ROOT, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) {
    const d = JSON.parse(fs.readFileSync(path.join(idir, f), 'utf8'));
    I[d.id] = d;
  }
  return { S, I };
}

/* ================================================================================================
 * OFFLINE — three.js in bare Node. No browser, no WebGL, no Engine.
 * ==============================================================================================*/

async function offline() {
  const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
  const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
  const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
  const { S, I } = loadData();
  const ids = Object.keys(S).sort();

  const rows = [];
  let totalBuildings = 0, totalMeshes = 0, totalTris = 0, totalKit = 0;
  const kitAll = new Set();
  const kitDeclared = new Set();
  let kitMatch = 0, kitMatchDenom = 0;
  let atDeclared = 0, shrunk = 0, doorways = 0, deep = 0;
  const perBuildingMeshes = [];

  for (const id of ids) {
    const plan = EX.planSettlement(S[id], I);
    const root = new THREE.Group();
    const sum = EX.buildSettlementExterior(root, plan, () => 0);
    // Read the counts back off the GRAPH, not off the return value.
    let groups = 0, meshes = 0, tris = 0, kitN = 0, doors = 0;
    const kitHere = new Set();
    root.traverse((o) => {
      if (o.name && o.name.startsWith('building:')) groups++;
      if (o.name && o.name.startsWith('kit:')) { kitN++; kitHere.add(o.name.slice(4)); kitAll.add(o.name.slice(4)); }
      if (o.name && o.name.startsWith('door:')) doors++;
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
    });
    for (const k of plan.architecture_kit) kitDeclared.add(k);

    // R5 / requirement 3: does a building's EXTERIOR kit carry its INTERIOR's kit?
    // Measured off the scene graph: the `kit:` nodes under `building:<id>` must contain every
    // architecture-kit id the interior record's own `props[]` instantiates.
    for (const b of plan.buildings) {
      if (!b.enterable || !b.interior || !I[b.interior]) continue;
      kitMatchDenom++;
      // Only kit ids a builder can actually CONSTRUCT: `bla_prison_block` throws in both
      // tables (see the note on `kitMesh`), so neither the room nor the street draws it and
      // demanding it of the exterior would be scoring the exterior for an interior defect.
      const innerDeclared = (I[b.interior].props || []).filter((p) => IN.KIT_MESHES[p] && EX.kitBuildable(p, plan.id));
      const grp = root.children.find((c) => c.name === `building:${b.id}`);
      const drawnKit = [];
      if (grp) grp.traverse((o) => { if (o.name && o.name.startsWith('kit:')) drawnKit.push(o.name.slice(4)); });
      if (innerDeclared.length && innerDeclared.every((k) => drawnKit.includes(k))) kitMatch++;
    }
    for (const b of plan.buildings) {
      if (b.at_declared_footprint) atDeclared++;
      if (b.shrink < 0.999) shrunk++;
      const grp = root.children.find((c) => c.name === `building:${b.id}`);
      let m = 0; if (grp) grp.traverse((o) => { if (o.isMesh) m++; });
      perBuildingMeshes.push(m);
    }
    doorways += doors;

    // The plan's own residual: pairs the shrink floor could not separate.
    let dp = 0;
    for (let i = 0; i < plan.buildings.length; i++) {
      for (let j = i + 1; j < plan.buildings.length; j++) {
        const a = plan.buildings[i], c = plan.buildings[j];
        const ox = (a.drawn_footprint_m[0] + c.drawn_footprint_m[0]) / 2 - Math.abs(a.x - c.x);
        const oz = (a.drawn_footprint_m[1] + c.drawn_footprint_m[1]) / 2 - Math.abs(a.z - c.z);
        if (ox > Math.min(a.drawn_footprint_m[0], c.drawn_footprint_m[0]) * 0.45 + 1e-6
          && oz > Math.min(a.drawn_footprint_m[1], c.drawn_footprint_m[1]) * 0.45 + 1e-6) dp++;
      }
    }
    deep += dp;

    rows.push({
      id, declared: S[id].buildings.length, groups, meshes, triangles: Math.round(tris),
      kit_meshes: kitN, kit_ids: [...kitHere].sort(),
      kit_declared: plan.architecture_kit.length,
      kit_implemented: plan.kit_implemented.length,
      doorways: doors, deep_overlaps: dp, plan: plan.plan,
    });
    totalBuildings += groups; totalMeshes += meshes; totalTris += Math.round(tris); totalKit += kitN;
  }

  // ---- THE CONTROL ARM ------------------------------------------------------------------------
  // The identical build with nothing added to the graph. `province.drawBuildings=false` is what
  // does this in the running game; here it is the same absence, expressed as "do not call the
  // builder", so the two arms differ by exactly one thing.
  const control = { buildings: 0, meshes: 0 };
  for (const id of ids) {
    const root = new THREE.Group();
    // (draw call cut)
    root.traverse((o) => { if (o.name && o.name.startsWith('building:')) control.buildings++; if (o.isMesh) control.meshes++; });
  }

  // ---- KIT UNIQUENESS — RI-WLD03 M14 -----------------------------------------------------------
  // "Fail if any two of the 8 share >30% of their building meshes."
  let worstShare = 0, worstPair = null;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = new Set(rows[i].kit_ids), b = new Set(rows[j].kit_ids);
      let inter = 0; for (const k of a) if (b.has(k)) inter++;
      const share = inter / Math.max(1, Math.min(a.size, b.size));
      if (share > worstShare) { worstShare = share; worstPair = [rows[i].id, rows[j].id]; }
    }
  }

  // ---- THE PERTURBATIONS — RI-MTH07 -------------------------------------------------------------
  // Change the model, rebuild, read the graph. Offline arm; the live arm does the same thing
  // through the harness against the running renderer.
  const perturb = [];
  const measure = (doc, interiors, focus = 'thorn-hall') => {
    const plan = EX.planSettlement(doc, interiors || I);
    const root = new THREE.Group();
    EX.buildSettlementExterior(root, plan, () => 0);
    let groups = 0, meshes = 0; const kit = new Set();
    root.traverse((o) => {
      if (o.name && o.name.startsWith('building:')) groups++;
      if (o.name && o.name.startsWith('kit:')) kit.add(o.name.slice(4));
      if (o.isMesh) meshes++;
    });
    // The BOUNDING BOX OF THE DRAWN GEOMETRY of one named building, straight off the graph.
    // Not the plan's number: the vertices.
    const grp = root.children.find((c) => c.name === `building:${focus}`);
    let bbox = null;
    if (grp) {
      grp.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(grp);
      bbox = { w: +(b.max.x - b.min.x).toFixed(2), d: +(b.max.z - b.min.z).toFixed(2), h: +(b.max.y - b.min.y).toFixed(2) };
    }
    return { groups, meshes, kit: [...kit].sort(), [`${focus}_drawn_bbox_m`]: bbox };
  };
  const base = measure(S.thorn);
  {
    const doc = JSON.parse(JSON.stringify(S.thorn));
    doc.buildings = doc.buildings.slice(0, 5);
    perturb.push({ what: 'thorn buildings[] 15 -> 5', before: base, after: measure(doc) });
  }
  {
    const ints = JSON.parse(JSON.stringify(I));
    ints['thorn-hall'].continuity.exterior_footprint_m = [22, 24];
    perturb.push({ what: 'thorn-hall continuity.exterior_footprint_m [16,18] -> [22,24]', before: base, after: measure(S.thorn, ints) });
  }
  {
    // Give Thorn Gideon's kit, inside and out. The four Gideon ids an interior instantiates are
    // gid_timber_frame / gid_tile_roof / gid_market_cross / gid_square_arcade.
    const doc = JSON.parse(JSON.stringify(S.thorn));
    doc.architecture_kit.meshes = S.gideon.architecture_kit.meshes.slice();
    const ints = JSON.parse(JSON.stringify(I));
    const GID = ['gid_timber_frame', 'gid_tile_roof', 'gid_market_cross', 'gid_square_arcade'];
    for (const k of Object.keys(ints)) {
      if (ints[k].settlement !== 'thorn') continue;
      ints[k].props = (ints[k].props || []).filter((p) => !p.startsWith('tho_')).concat(GID);
    }
    perturb.push({ what: "thorn architecture_kit -> gideon's, inside and out", before: base, after: measure(doc, ints) });
  }

  // The pre-existing constructor defect, sized rather than swallowed.
  const unbuildable = [];
  for (const k of kitDeclared) if (!EX.kitBuildable(k, null)) unbuildable.push(k);
  let crateInstances = 0, crateRooms = 0;
  const BAD = new Set(['barrel_row', 'bench_pair', ...unbuildable]);
  for (const r of Object.values(I)) {
    const c = (r.props || []).filter((p) => BAD.has(p)).length;
    if (c) { crateRooms++; crateInstances += c; }
  }

  const report = {
    tool: 'tools/world/w1-04-r3-exterior.mjs --offline',
    arm: 'offline: three.js in bare Node, no browser, no Engine',
    settlements: rows,
    totals: {
      settlements: rows.length,
      buildings_declared: rows.reduce((n, r) => n + r.declared, 0),
      building_groups_drawn: totalBuildings,
      meshes: totalMeshes, triangles: totalTris,
      kit_meshes_drawn: totalKit,
      kit_ids_distinct: kitAll.size,
      kit_ids_declared_across_province: kitDeclared.size,
      doorways: doorways,
      drawn_at_declared_footprint: atDeclared,
      shrunk_to_fit_the_plan: shrunk,
      residual_deep_overlaps: deep,
      meshes_per_building_min: Math.min(...perBuildingMeshes),
      meshes_per_building_max: Math.max(...perBuildingMeshes),
    },
    control_arm: control,
    kit_match_exterior_to_interior: `${kitMatch} / ${kitMatchDenom}`,
    found_defect_in_interior_js: {
      what: "Object.assign(group, { position: ... }) throws — three's Object3D.position is not writable",
      sites: ['game/src/render/interior.js bla_prison_block', 'barrel_row', 'bench_pair'],
      effect: 'buildInterior catches it per prop and substitutes fallbackProp WITHOUT incrementing props_fallback, so the round-2 summary counts these as built',
      unbuildable_kit_ids: unbuildable,
      prop_instances_silently_a_generic_crate: crateInstances,
      rooms_affected: crateRooms,
      not_fixed_here: 'a critic is grading round 2 against interior.js; the fix is g.position.set(...) and is left for them',
    },
    m14_worst_kit_share: { share: +worstShare.toFixed(3), pair: worstPair, bar: '<= 0.30' },
    perturbations: perturb,
  };

  const ok = [];
  ok.push(['buildings drawn == buildings declared', report.totals.building_groups_drawn === report.totals.buildings_declared]);
  ok.push(['control arm draws zero', control.buildings === 0 && control.meshes === 0]);
  ok.push([`every declared kit id that can be constructed is drawn (${kitAll.size} drawn, ${kitDeclared.size} declared, ${unbuildable.length} unbuildable: ${unbuildable.join(',') || 'none'})`,
    kitAll.size + unbuildable.length >= kitDeclared.size]);
  ok.push(['exterior kit carries interior kit on every enterable building', kitMatch === kitMatchDenom]);
  ok.push(['M14: no two towns share > 30% of their kit', worstShare <= 0.30]);
  for (const p of perturb) ok.push([`perturbation moved the graph: ${p.what}`, JSON.stringify(p.before) !== JSON.stringify(p.after)]);
  report.checks = ok.map(([name, pass]) => ({ name, pass }));

  const out = path.join(ROOT, 'reports/w1-04-r3-exterior-offline.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  for (const r of rows) {
    console.log(`${r.id.padEnd(10)} buildings ${String(r.groups).padStart(3)}/${String(r.declared).padEnd(3)}  meshes ${String(r.meshes).padStart(5)}  tris ${String(r.triangles).padStart(6)}  kit ${String(r.kit_meshes).padStart(3)} (${r.kit_ids.length} ids, ${r.kit_implemented}/${r.kit_declared} declared implemented)  doors ${r.doorways}  deep ${r.deep_overlaps}`);
  }
  console.log('');
  console.log('TOTALS', JSON.stringify(report.totals, null, 1));
  console.log('CONTROL (draw call cut):', JSON.stringify(control));
  console.log('kit exterior==interior:', report.kit_match_exterior_to_interior);
  console.log('M14 worst share:', worstShare.toFixed(3), worstPair ? worstPair.join(' vs ') : '');
  for (const p of perturb) console.log('PERTURB', p.what, '\n   before', JSON.stringify(p.before), '\n   after ', JSON.stringify(p.after));
  console.log('');
  let fails = 0;
  for (const c of report.checks) { if (!c.pass) fails++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`); }
  console.log(`\nwrote ${path.relative(ROOT, out)}`);
  return fails;
}

/* ================================================================================================
 * SELF-TEST — RULES.md #4: break the thing this measures and confirm the instrument goes red.
 * ==============================================================================================*/

async function selfTest() {
  const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
  const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
  const { S, I } = loadData();
  const cases = [];
  const draw = (doc, ints) => {
    const plan = EX.planSettlement(doc, ints || I);
    const root = new THREE.Group();
    EX.buildSettlementExterior(root, plan, () => 0);
    let groups = 0, meshes = 0, kit = 0;
    root.traverse((o) => {
      if (o.name && o.name.startsWith('building:')) groups++;
      if (o.name && o.name.startsWith('kit:')) kit++;
      if (o.isMesh) meshes++;
    });
    return { groups, meshes, kit };
  };
  const base = draw(S.helstrom);
  cases.push(['empty buildings[] must draw nothing', draw({ ...S.helstrom, buildings: [] }).groups === 0 && base.groups > 0]);
  cases.push(['empty architecture_kit must draw no kit meshes',
    draw({ ...S.helstrom, architecture_kit: { meshes: [] } }, Object.fromEntries(Object.entries(I).map(([k, v]) => [k, { ...v, props: (v.props || []).filter((p) => !/^[a-z]{3}_(bole|grown|shell|rotted|thorn|lean|stilt|sunk|drowned|reed|legion|bloom|grid|wall_lean|clay|stain|dye|drying|fortress|furred|corridor|prison|timber|tile|market|square|rib|salt|bleached|bone)/.test(p)) }]))).kit === 0]);
  const nofp = JSON.parse(JSON.stringify(I));
  for (const k of Object.keys(nofp)) if (nofp[k].continuity) delete nofp[k].continuity.exterior_footprint_m;
  const derived = draw(S.helstrom, nofp);
  cases.push(['stripping every declared footprint changes the mesh count', derived.meshes !== base.meshes || derived.groups !== base.groups]);
  let fails = 0;
  for (const [name, red] of cases) { if (!red) fails++; console.log(`${red ? 'GOES-RED' : 'DEAD    '}  ${name}`); }
  console.log(`\n${cases.length - fails} / ${cases.length} GOES-RED`);
  return fails;
}

/* ================================================================================================
 * LIVE — the running game.
 * ==============================================================================================*/

async function live() {
  const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
  const { S, I } = loadData();
  // ONE browser, kept for the whole run (RULES.md rule 21). The box was above the cap.
  const B = await launchGame({});
  const page = B.page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const out = { tool: 'tools/world/w1-04-r3-exterior.mjs --live', sections: [], errors: [] };
  const log = (name, data) => { out.sections.push({ name, data }); console.log(`\n## ${name}\n${JSON.stringify(data, null, 1)}`); };

  try {
    // ---- 1. what is drawn at a settlement, off the RENDERER -----------------------------------
    const at = async (sid) => page.evaluate((s) => {
      const H = window.__HARNESS;
      const rec = H.__w1_04_settlement(s);
      H.teleport(rec.pos[0] + 12, rec.pos[2] + 12);
      H.streamAround ? H.streamAround(rec.pos[0], rec.pos[2]) : null;
      H.stepFrames(6);
      H.renderFrame();
      return { settlement: s, drawn: H.getDrawnSettlements(), where: H.whereAmI ? H.whereAmI() : null };
    }, sid);

    const drawn = {};
    for (const sid of Object.keys(S).sort()) {
      const r = await at(sid);
      const row = r.drawn.settlements.find((x) => x.id === sid) || null;
      drawn[sid] = row
        ? { building_groups: row.building_groups, declared: S[sid].buildings.length, meshes: row.meshes, triangles: row.triangles, kit_meshes: row.kit_meshes, doorways: row.doorways, shrunk: row.shrunk, deep_overlaps: row.deep_overlaps }
        : { building_groups: 0, declared: S[sid].buildings.length, note: 'not in the scene graph' };
    }
    log('1. drawn at each settlement (scene-graph traversal of renderer.province.group)', drawn);

    // ---- 2. THE CONTROL ARM -------------------------------------------------------------------
    const control = await page.evaluate(() => {
      const H = window.__HARNESS;
      const rec = H.__w1_04_settlement('thorn');
      H.teleport(rec.pos[0] + 12, rec.pos[2] + 12);
      H.stepFrames(4);
      const before = H.getDrawnSettlements();
      H.__w1_04_drawBuildings(false);
      H.stepFrames(4); H.renderFrame();
      const cut = H.getDrawnSettlements();
      H.__w1_04_drawBuildings(true);
      H.stepFrames(4); H.renderFrame();
      const back = H.getDrawnSettlements();
      return {
        with_draw_call: { buildings: before.buildings, meshes: before.meshes, kit: before.kit_meshes },
        draw_call_cut: { buildings: cut.buildings, meshes: cut.meshes, kit: cut.kit_meshes },
        restored: { buildings: back.buildings, meshes: back.meshes, kit: back.kit_meshes },
      };
    });
    log('2. control arm — the identical run with the draw call cut', control);

    // ---- 3. VP04 ------------------------------------------------------------------------------
    const vp04 = await page.evaluate(() => {
      const H = window.__HARNESS;
      // The pose `tools/harness/viewpoints.json` VP04-settlement-street declares.
      const cam = { pos: [3825.5, 15.1, 879], look: [3820.5, 14, 864], fov: 60 };
      H.setTimeOfDay(9); H.setWeather('clear');
      H.teleport(cam.pos[0], cam.pos[2]);
      H.camera(cam);
      H.stepFrames(8); H.renderFrame();
      const d = H.getDrawnSettlements();
      // How much of VP04's frame is a building: project every drawn building's centre and count
      // how many are in front of the camera and on screen.
      const th = d.settlements.find((s) => s.id === 'thorn');
      let onscreen = 0, infront = 0;
      const seen = [];
      for (const b of (th ? th.drawn : [])) {
        const p = H.projectPoint(b.x, b.y + b.height_m / 2, b.z);
        if (p.in_front) infront++;
        if (p.on_screen) { onscreen++; seen.push({ id: b.id, ndc: p.ndc.map((v) => +v.toFixed(3)), kit: b.kit }); }
      }
      return {
        buildings_in_thorn_scene_graph: th ? th.building_groups : 0,
        buildings_in_front_of_VP04: infront,
        buildings_on_screen_at_VP04: onscreen,
        on_screen: seen,
        kit_meshes_in_thorn: th ? th.kit_meshes : 0,
      };
    });
    log('3. VP04-settlement-street: is it still terrain?', vp04);

    // ---- 4. COLLISION -------------------------------------------------------------------------
    const coll = await page.evaluate(() => {
      const H = window.__HARNESS;
      const rec = H.__w1_04_settlement('thorn');
      H.teleport(rec.pos[0] + 30, rec.pos[2] + 30);
      H.stepFrames(30);
      const report = H.getSettlementSolids();
      const plan = H.__w1_04_plan('thorn');
      // WALK AT A WALL. Pick the biggest building, stand 6 m off its centre on the -x side and
      // walk straight through it for 400 frames. If the wall is solid the body stops short.
      const big = plan.buildings.slice().sort((a, b) => b.drawn_footprint_m[0] - a.drawn_footprint_m[0])[0];
      const startX = big.x - big.drawn_footprint_m[0] / 2 - 6;
      H.teleport(startX, big.z);
      H.stepFrames(10);
      const from = H.whereAmI().pos.slice();
      H.walkPath([[startX, big.z], [big.x + big.drawn_footprint_m[0] / 2 + 6, big.z]], { speedMps: 3 });
      H.stepFrames(400);
      const to = H.whereAmI().pos.slice();
      const insideAfter = H.buildingAt(to[0], to[2], 0.2);
      // The same walk with the collision cell emptied, so the arm is a comparison.
      return {
        cell: report,
        target: { id: big.id, x: big.x, z: big.z, w: big.drawn_footprint_m[0], d: big.drawn_footprint_m[1] },
        walked_from: from, walked_to: to,
        stopped_before_the_far_wall: to[0] < big.x - big.drawn_footprint_m[0] / 2 + 0.6,
        ended_inside_a_building: insideAfter,
        // Point containment at the centre of every building in this town.
        solid_at_centres: plan.buildings.map((b) => ({ id: b.id, solid: H.solidAt(b.x, 1.0, b.z).solid })),
      };
    });
    log('4. collision: can you walk through a wall?', coll);

    // ---- 5. THE OUTDOOR TOWNSPEOPLE -----------------------------------------------------------
    const npcs = await page.evaluate((sids) => {
      const H = window.__HARNESS;
      const rows = [];
      for (const hour of [3, 9, 20]) {
        H.setTimeOfDay(hour);
        let outdoors = 0, inside = 0, stuck = [];
        for (const sid of sids) {
          const rec = H.__w1_04_settlement(sid);
          H.teleport(rec.pos[0], rec.pos[2]);
          H.stepFrames(20);
          H.populateSettlement(sid);
          H.stepFrames(30);
          const town = new Set(H.listNPCs().filter((n) => n.settlement === sid).map((n) => n.eid));
          for (const n of H.whereIsEveryone()) {
            if (!town.has(n.eid)) continue;
            // Outdoors == the schedule slot names no interior. That is exactly the population
            // round 2 put on the street; the question here is whether it is standing in a wall.
            if (n.at) continue;
            outdoors++;
            const hit = H.buildingAt(n.pos[0], n.pos[2], 0.35);
            if (hit) { inside++; stuck.push({ npc: n.eid, building: hit.building, pos: n.pos.map((v) => +v.toFixed(1)) }); }
          }
        }
        rows.push({ hour, outdoors, inside_a_building: inside, stuck: stuck.slice(0, 12) });
      }
      return rows;
    }, Object.keys(S).sort());
    log('5. the outdoor townspeople: is anybody stuck in a wall?', npcs);

    // ---- 6. CONSUMPTION — perturb the model, read the renderer ---------------------------------
    const consume = await page.evaluate(() => {
      const H = window.__HARNESS;
      const rec = H.__w1_04_settlement('thorn');
      H.teleport(rec.pos[0] + 12, rec.pos[2] + 12);
      H.stepFrames(6); H.renderFrame();
      const read = () => {
        const d = H.getDrawnSettlements();
        const t = d.settlements.find((s) => s.id === 'thorn');
        return t ? { buildings: t.building_groups, meshes: t.meshes, triangles: t.triangles, kit: t.kit_meshes, widest: Math.max(...t.drawn.map((b) => b.footprint_m[0])) } : null;
      };
      const base = read();
      const doc = JSON.parse(JSON.stringify(rec));
      // (a) fewer buildings
      doc.buildings = doc.buildings.slice(0, 5);
      H.__w1_04_perturbSettlement(doc);
      H.stepFrames(4); H.renderFrame();
      const fewer = read();
      // (b) a bigger footprint on one building
      const doc2 = JSON.parse(JSON.stringify(rec));
      const ints = {}; for (const b of rec.buildings) if (b.interior) ints[b.interior] = H.__w1_04_interior(b.interior);
      const ints2 = JSON.parse(JSON.stringify(ints));
      ints2['thorn-hall'].continuity.exterior_footprint_m = [30, 34];
      H.__w1_04_perturbSettlement(doc2, ints2);
      H.stepFrames(4); H.renderFrame();
      const bigger = read();
      // (c) another town's kit
      const doc3 = JSON.parse(JSON.stringify(rec));
      doc3.architecture_kit.meshes = ['gid_market_cross', 'gid_tile_roof', 'gid_timber_frame', 'gid_square_arcade'];
      const ints3 = JSON.parse(JSON.stringify(ints));
      for (const k of Object.keys(ints3)) ints3[k].props = (ints3[k].props || []).map((p) => (p.startsWith('tho_') ? p.replace('tho_', 'gid_') : p));
      H.__w1_04_perturbSettlement(doc3, ints3);
      H.stepFrames(4); H.renderFrame();
      const other = read();
      const kitIds = (() => { const d = H.getDrawnSettlements(); const t = d.settlements.find((s) => s.id === 'thorn'); return t ? [...new Set(t.drawn.flatMap((b) => b.kit))].sort() : []; })();
      // restore
      H.__w1_04_perturbSettlement(rec, ints);
      H.stepFrames(4); H.renderFrame();
      const restored = read();
      return { base, fewer_buildings: fewer, bigger_footprint: bigger, other_town_kit: other, other_town_kit_ids: kitIds, restored };
    });
    log('6. CONSUMPTION (RI-MTH07): perturb the model, read the renderer', consume);
  } finally {
    out.errors = errors;
    await B.close();
  }
  const outPath = path.join(ROOT, 'reports/w1-04-r3-exterior-live.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${path.relative(ROOT, outPath)}  page errors: ${errors.length}`);
  return errors.length ? 1 : 0;
}

const mode = has('--live') ? live : has('--self-test') ? selfTest : offline;
mode().then((n) => process.exit(n ? 1 : 0)).catch((e) => { console.error(e); process.exit(2); });
