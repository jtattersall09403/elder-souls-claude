#!/usr/bin/env node
/**
 * critic-w1-04-r3a — the W1-04 round-3 CRITIC's own instrument, judging rounds 2 AND 3.
 *
 * One browser, kept, sections written to disk as each one lands (RULES.md rule 2), so a kill
 * loses at most the section that was running. `--only <a,b,c>` resumes.
 *
 * WHAT IT ASKS
 *
 *  S1 (brief A) — THE HARNESS VERB. Does `getDrawnInterior()` read the RENDERER or a field the
 *      model wrote? Answered by perturbing ONLY the renderer, three ways, and asking the verb:
 *        (a) `renderer.setCell('province')` behind the world's back while `env.interior` is set;
 *        (b) `cells.interior.visible = false` directly;
 *        (c) empty the built room's group.
 *      A verb that keeps saying `agrees:true` through (a)/(b) is a model self-report. A verb
 *      whose `interior.meshes` survives (c) is a BUILD RECORD, not a scene read — which matters
 *      because round 2's distinctness headline is computed from exactly that block.
 *
 *  S2 (brief D) — THE PIXEL SWEEP'S NOISE FLOOR. `reports/w1-04-interior-sweep.json` reports 115
 *      distinct images in the live arm AND 115 in the room-builder-cut arm, and its own failure
 *      line says so: "the control is not worse: this sweep is not measuring the room". Before
 *      re-running 230 screenshots, find out what it is hashing. Three repeats of ONE room:
 *        (n0) screenshot twice with nothing at all in between;
 *        (n1) screenshot with stepFrames(2) in between, room unchanged;
 *        (n2) screenshot with exit+re-enter of the SAME room in between — the sweep's protocol.
 *      If n0/n1/n2 return all-distinct images, the sweep's 115 is a count of the noise floor and
 *      the round-1 acceptance number is unmeasurable as written.
 *      S2d then asks the honest question the sweep meant to ask, against that floor: are two
 *      records that are byte-identical distinguishable as pictures, and are two records that are
 *      genuinely different distinguishable by MORE than the floor?
 *
 *  S3 (brief B) — THE CONTROL-ARM CENSUS. Every control arm this piece ships, run live, with the
 *      question "do the two arms actually differ" asked of each one:
 *        `__w1_04_townSolids`  (the one round 3 found inert and fixed)
 *        `__w1_04_drawBuildings` (the exterior draw-call control)
 *        `__w1_04_perturbSettlement` (which still contains the nulling pattern that made the
 *                                    first one inert — does it bite?)
 *        the interior cell control (sim.applyCell + _syncCell cut)
 *
 *  S4 (brief C) — DELETE-THE-FIX, both rounds' load-bearing change, on a subset, arms compared.
 *
 *  S5 (brief F) — CONSUMPTION with MY perturbations: the unique item's declared `owner` against
 *      the theft chain; a building deleted against the live collision set; a footprint against
 *      the drawn box.
 *
 *  S6 (brief E) — PICTURES: VP04 at its declared pose; a top-down over Helstrom for the roofs;
 *      an interior strip.
 *
 * SEAM NOTE. This reaches `window.__ENGINE` in S1, S3 and S4 DELIBERATELY and says so in the
 * report: a critic asking whether the harness surface reads the renderer cannot ask it through
 * that same surface, and a control arm can only be cut from behind the seam. Every measurement
 * that CAN be taken through `window.__HARNESS` is taken through it, and each section records
 * which side it used.
 *
 * Usage:
 *   node tools/world/critic-w1-04-r3a.mjs
 *   node tools/world/critic-w1-04-r3a.mjs --only S2,S6
 *   node tools/world/critic-w1-04-r3a.mjs --entry <cut-tree>/game/index.html --out ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
critic-w1-04-r3a.mjs — the W1-04 round-3 critic's instrument (rounds 2 and 3).

  --out <path>    JSON report (default reports/critic-w1-04-r3a.json)
  --entry <html>  game entry; point at a cut tree for a source-level delete-the-fix arm
  --only <list>   comma list of sections to run (S1,S2,S3,S4,S5,S6). Default: all
  --shots <dir>   where pictures go (default docs/shots)
  --timeout <ms>  harness wait (default 120000)
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const outFile = args.out || 'reports/critic-w1-04-r3a.json';
const shotDir = args.shots || 'docs/shots';
const timeout = Number(args.timeout ?? 120000);
const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
const want = (s) => !only || only.includes(s);

const R = {
  tool: 'tools/world/critic-w1-04-r3a.mjs',
  entry: args.entry || 'game/index.html',
  started_at: new Date().toISOString(),
  sections: {},
  page_errors: [],
  notes: [],
};
const save = () => writeJson(outFile, R);

function savePng(dataUrl, name) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image')) return null;
  const b64 = String(dataUrl).split(',')[1];
  fs.mkdirSync(shotDir, { recursive: true });
  const p = path.join(shotDir, name);
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
  return p;
}

let handle;
try {
  handle = await launchGame({ ...args, width: 960, height: 600 });
  const page = handle.page;
  page.on('pageerror', (e) => R.page_errors.push(String(e).slice(0, 300)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout });
  log(`entry: ${R.entry}`);

  // Shared page-side helpers, installed once.
  await page.evaluate(() => {
    const E = window.__ENGINE;
    // An INDEPENDENT read of what is drawn: traverse the visible cell now, rather than trusting
    // any cached summary. This is the thing the verb is checked against.
    window.__C = {
      graph() {
        const cells = E.renderer.cells;
        const vis = Object.keys(cells).filter((k) => cells[k].visible);
        const cell = vis.length === 1 ? vis[0] : null;
        let meshes = 0, tris = 0, lights = 0, objects = 0;
        if (cell) {
          cells[cell].traverse((o) => {
            objects++;
            if (o.isMesh) {
              meshes++;
              const g = o.geometry;
              if (g && g.index) tris += g.index.count / 3;
              else if (g && g.attributes && g.attributes.position) tris += g.attributes.position.count / 3;
            }
            if (o.isLight) lights++;
          });
        }
        return { visible_cells: vis, cell, objects, meshes, triangles: Math.round(tris), lights };
      },
      hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; },
    };
  });

  // =====================================================================================
  // S1 — THE HARNESS VERB. Perturb the RENDERER only; the model is never touched.
  // =====================================================================================
  if (want('S1')) {
    R.sections.S1 = await page.evaluate(async () => {
      const H = window.__HARNESS, E = window.__ENGINE, C = window.__C;
      const room = 'archon-apothecary';
      const snap = () => {
        const v = H.getDrawnInterior();
        return {
          verb: { drawn_cell: v.drawn_cell, visible_cells: v.visible_cells, env_cell: v.env_cell, env_interior: v.env_interior, agrees: v.agrees, interior_id: v.interior_id, interior_meshes: v.interior && v.interior.meshes },
          graph: C.graph(),
          model_env_interior: E.sim.env.interior,
        };
      };
      H.enterInterior(room); H.stepFrames(2);
      const base = snap();

      // (a) setCell behind the world's back. The MODEL still says we are in the interior.
      E.renderer.setCell('province');
      const a = snap();
      E.renderer.setCell('interior');

      // (b) flip the cell group's own visible flag, without going through setCell at all.
      E.renderer.cells.interior.visible = false;
      const b = snap();
      E.renderer.cells.interior.visible = true;

      // (c) empty the built room. The record is untouched; the group is not.
      const root = E.renderer.cells.interior;
      const kept = root.children.slice();
      root.clear();
      const c = snap();
      for (const k of kept) root.add(k);
      const restored = snap();

      H.exitInterior(); H.stepFrames(2);
      return {
        side: 'window.__ENGINE used deliberately: only the renderer is perturbed, the model is not',
        room,
        base,
        a_setCell_province: a,
        b_visible_false: b,
        c_group_emptied: c,
        restored,
        verdicts: {
          // A verb that reads the renderer MUST stop agreeing when the renderer is moved.
          a_verb_noticed: a.verb.agrees === false && a.verb.drawn_cell === 'province',
          b_verb_noticed: b.verb.agrees === false,
          // A verb whose interior block READS THE SCENE would drop to 0 meshes here.
          c_verb_noticed_empty_room: c.verb.interior_meshes === 0,
          c_graph_noticed_empty_room: c.graph.meshes === 0,
          model_never_moved: base.model_env_interior === a.model_env_interior && a.model_env_interior === c.model_env_interior,
        },
      };
    });
    log(`S1 verb: a=${R.sections.S1.verdicts.a_verb_noticed} b=${R.sections.S1.verdicts.b_verb_noticed} c_verb=${R.sections.S1.verdicts.c_verb_noticed_empty_room} c_graph=${R.sections.S1.verdicts.c_graph_noticed_empty_room}`);
    save();
  }

  // =====================================================================================
  // S2 — THE PIXEL SWEEP'S NOISE FLOOR.
  // =====================================================================================
  if (want('S2')) {
    R.sections.S2 = await page.evaluate(async () => {
      const H = window.__HARNESS, E = window.__ENGINE, C = window.__C;
      // The sweep's own protocol, verbatim.
      const POSE = { pos: [0, 1.62, -5.2], look: [0, 1.3, 2.0] };
      H.setTimeOfDay(12);
      if (H.setWeather) H.setWeather('clear');
      const room = 'archon-apothecary';

      const shoot = async () => { E.sim.npcs.length = 0; H.camera(POSE); H.renderFrame(); const u = await H.screenshot(); return { h: C.hash(u), bytes: u.length }; };

      H.enterInterior(room); H.stepFrames(2);

      // n0 — nothing at all between two frames.
      const n0 = []; for (let i = 0; i < 8; i++) n0.push(await shoot());
      // n1 — the fixed step advances, the room does not change.
      const n1 = []; for (let i = 0; i < 8; i++) { H.stepFrames(2); n1.push(await shoot()); }
      // n2 — the sweep's protocol: exit and re-enter THE SAME room between shots.
      const n2 = [];
      for (let i = 0; i < 8; i++) {
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        H.enterInterior(room); H.stepFrames(2);
        n2.push(await shoot());
      }
      const distinct = (a) => new Set(a.map((x) => x.h)).size;

      // S2d — against that floor, are two DIFFERENT rooms distinguishable, and are two
      // byte-identical records distinguishable? Both under the same protocol as n2.
      const pairShot = async (id) => {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) return { id, error: 'not entered' };
          H.stepFrames(2);
          const s = await shoot();
          return { id, ...s, graph: C.graph(), room: H.getDrawnInterior().interior_id };
        } catch (e) { return { id, error: String(e && e.message ? e.message : e).slice(0, 160) }; }
      };
      const pairs = {};
      // Four records that are content-identical: same bounds, same props, same lights.
      pairs.identical_records = [await pairShot('helstrom-smithy'), await pairShot('helstrom-scriptorium'), await pairShot('helstrom-apothecary')];
      // Rooms that are obviously different things.
      pairs.different_records = [await pairShot('blackrose-prison'), await pairShot('thorn-hall'), await pairShot('helstrom-undertemple')];

      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      return {
        side: 'HARNESS for everything except emptying sim.npcs, which the sweep also does through the engine (there is no verb)',
        room,
        protocol: 'the sweep\'s own: one fixed pose, clock pinned to 12, sim.npcs emptied, stepFrames(2)',
        n0_nothing_between: { shots: n0.length, distinct: distinct(n0), hashes: n0.map((x) => x.h) },
        n1_stepped_between: { shots: n1.length, distinct: distinct(n1), hashes: n1.map((x) => x.h) },
        n2_reentered_same_room: { shots: n2.length, distinct: distinct(n2), hashes: n2.map((x) => x.h) },
        pairs,
        reading: {
          n0_all_distinct: distinct(n0) === n0.length,
          n1_all_distinct: distinct(n1) === n1.length,
          n2_all_distinct: distinct(n2) === n2.length,
          identical_records_same_graph: pairs.identical_records.every((p) => p.graph && p.graph.meshes === pairs.identical_records[0].graph.meshes),
          identical_records_same_picture: new Set(pairs.identical_records.filter((p) => p.h).map((p) => p.h)).size === 1,
          different_records_differ_in_graph: new Set(pairs.different_records.filter((p) => p.graph).map((p) => p.graph.meshes)).size > 1,
        },
      };
    });
    const s = R.sections.S2;
    log(`S2 noise floor: n0 ${s.n0_nothing_between.distinct}/8  n1 ${s.n1_stepped_between.distinct}/8  n2 ${s.n2_reentered_same_room.distinct}/8`);
    save();
  }

  // =====================================================================================
  // S3 — THE CONTROL-ARM CENSUS. Do the two arms of each control actually differ?
  // =====================================================================================
  if (want('S3')) {
    R.sections.S3 = await page.evaluate(async () => {
      const H = window.__HARNESS, E = window.__ENGINE, C = window.__C;
      const out = { side: 'HARNESS verbs for the arms; __ENGINE only to read _townCell identity', arms: {} };
      const stand = (sid, pos) => { H.teleport(pos[0], pos[2]); H.stepFrames(12); return H.whereAmI(); };
      const TOWNS = { thorn: [3820, 13.31, 859], helstrom: [2262.5, 27.22, 2773.5] };

      // ---- ARM 1: __w1_04_townSolids — the one round 3 found inert. -----------------------
      out.arms.townSolids = {};
      for (const [sid, pos] of Object.entries(TOWNS)) {
        stand(sid, pos);
        const on1 = H.getSettlementSolids();
        const off = H.__w1_04_townSolids(false);
        H.stepFrames(4);
        const offAfterSteps = H.getSettlementSolids();
        const on2 = H.__w1_04_townSolids(true);
        H.stepFrames(4);
        out.arms.townSolids[sid] = {
          on: on1.shapes, off: off.shapes, off_after_4_steps: offAfterSteps.shapes, restored: on2.shapes,
          cell_id_on: on1.cell_id, cell_id_off: off.cell_id,
          arms_differ: on1.shapes > 0 && off.shapes === 0 && on2.shapes === on1.shapes,
          // The failure round 3 found: the walls never came out AND the next fixed step put
          // them back. Both are checked.
          stayed_out_under_stepping: offAfterSteps.shapes === 0,
        };
      }

      // ---- ARM 2: __w1_04_drawBuildings — the exterior draw-call control. ------------------
      stand('thorn', TOWNS.thorn);
      const dOn1 = H.getDrawnSettlements();
      const dOff = H.__w1_04_drawBuildings(false);
      H.stepFrames(6);
      const dOffRead = H.getDrawnSettlements();
      H.__w1_04_drawBuildings(true);
      H.stepFrames(6);
      const dOn2 = H.getDrawnSettlements();
      out.arms.drawBuildings = {
        on: dOn1.buildings, off: dOffRead.buildings, restored: dOn2.buildings,
        on_stats: dOn1.stats && dOn1.stats.drawBuildings, off_stats: dOff && dOff.drawBuildings,
        arms_differ: dOn1.buildings > 0 && dOffRead.buildings === 0 && dOn2.buildings === dOn1.buildings,
        stayed_out_under_stepping: dOffRead.buildings === 0,
      };

      // ---- ARM 3: the interior cell control (sim.applyCell + _syncCell cut). ---------------
      // Cut it exactly as the builder's own §10 does, and run a 12-door subset both ways.
      const ids = H.listInteriors().map((i) => i.id).slice(0, 12);
      const sweep = () => {
        let agreed = 0, entered = 0, restored = 0;
        for (const id of ids) {
          try {
            if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
            const r = H.enterInterior(id); H.stepFrames(2);
            if (!r || !r.entered) continue;
            entered++;
            if (H.getDrawnInterior().agrees) agreed++;
            H.exitInterior(); H.stepFrames(2);
            if (H.getDrawnInterior().agrees) restored++;
          } catch (e) { /* counted by omission */ }
        }
        return { entered, drawn_agrees: agreed, exterior_restored_on_exit: restored };
      };
      const live = sweep();
      const savedHook = E.sim.applyCell, savedSync = E._syncCell;
      E.sim.applyCell = null; E._syncCell = function () { return false; };
      let cut = null;
      try { cut = sweep(); } finally {
        E.sim.applyCell = savedHook; E._syncCell = savedSync;
        try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
        E._syncCell(); H.stepFrames(2);
      }
      out.arms.interiorCell = {
        subset: ids.length, live, cut,
        arms_differ: cut.drawn_agrees < live.drawn_agrees,
        // The third of the headline the round-2 critic called vacuous: does it pass in BOTH arms?
        exterior_restored_is_vacuous: cut.exterior_restored_on_exit === live.exterior_restored_on_exit,
      };

      // ---- ARM 4: __w1_04_perturbSettlement — does the nulling pattern still bite? ---------
      // The verb sets engine._townCell = null directly, which is the exact shape that made
      // __w1_04_townSolids inert. Check whether the collision set survives a perturbation.
      stand('thorn', TOWNS.thorn);
      const beforeP = H.getSettlementSolids();
      const doc = JSON.parse(JSON.stringify(H.__w1_04_settlement('thorn')));
      const fullList = doc.buildings.slice();
      doc.buildings = doc.buildings.slice(0, 5);
      H.__w1_04_perturbSettlement(doc, null);
      H.stepFrames(12);
      const afterP = H.getSettlementSolids();
      const drawnP = H.getDrawnSettlements();
      doc.buildings = fullList;
      H.__w1_04_perturbSettlement(doc, null);
      H.stepFrames(12);
      const restoreP = H.getSettlementSolids();
      out.arms.perturbSettlement = {
        shapes_before: beforeP.shapes, shapes_after_cut_to_5: afterP.shapes, shapes_restored: restoreP.shapes,
        buildings_drawn_after: drawnP.buildings,
        collision_followed_the_model: afterP.shapes < beforeP.shapes && afterP.shapes > 0,
        restored_exactly: restoreP.shapes === beforeP.shapes,
      };
      return out;
    });
    save();
    log('S3 control-arm census written');
  }

  // =====================================================================================
  // S5 — CONSUMPTION, my perturbations. (Run before the pictures so a shot timeout cannot
  // take a measurement down with it.)
  // =====================================================================================
  if (want('S5')) {
    R.sections.S5 = await page.evaluate(async () => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const out = { side: 'HARNESS', legs: {} };

      // ---- LEG 1: the unique item's declared owner against the theft chain. ---------------
      // The record declares `unique_item.owner`. Round 2 says the item can be picked up. The
      // question RI-MTH07 asks is whether taking it runs the chain the owner implies.
      const rows = [];
      const ids = H.listInteriors().map((i) => i.id);
      let sampled = 0;
      for (const id of ids) {
        if (sampled >= 10) break;
        let rec = null;
        try { rec = H.__w1_04_interior(id); } catch (e) { continue; }
        if (!rec || !rec.unique_item || !rec.unique_item.owner) continue;
        sampled++;
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          H.enterInterior(id); H.stepFrames(3);
          const props = E.sim.props || [];
          const p = props.find((q) => q && (q.id === rec.unique_item.id || q.instance === rec.unique_item.id || (q.eid && String(q.eid).includes(rec.unique_item.id))));
          if (!p) { rows.push({ interior: id, item: rec.unique_item.id, owner_declared: rec.unique_item.owner, prop_exists: false }); continue; }
          const has_owner_field = Object.prototype.hasOwnProperty.call(p, 'owner');
          const r = H.takeProp(p.eid);
          rows.push({
            interior: id, item: rec.unique_item.id, owner_declared: rec.unique_item.owner,
            prop_exists: true, prop_owner_field: has_owner_field ? p.owner : '<<ABSENT>>',
            prop_owner_scope: p.owner_scope === undefined ? '<<ABSENT>>' : p.owner_scope,
            taken: !!(r && (r.taken || r.ok || r.item)),
            theft: r && r.theft === undefined ? null : (r && r.theft),
            why: r && r.why, crime: r && (r.crime || null), stolen_from: r && (r.stolen_from || null),
          });
        } catch (e) { rows.push({ interior: id, error: String(e && e.message ? e.message : e).slice(0, 160) }); }
      }
      out.legs.unique_item_owner = {
        sampled: rows.length,
        prop_exists: rows.filter((r) => r.prop_exists).length,
        taken: rows.filter((r) => r.taken).length,
        theft_true: rows.filter((r) => r.theft === true).length,
        carries_owner_field: rows.filter((r) => r.prop_owner_field !== '<<ABSENT>>' && r.prop_owner_field !== null).length,
        rows,
      };

      // ---- LEG 2: delete a building from the model; does the WORLD follow? ----------------
      try {
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
        H.teleport(3820, 859); H.stepFrames(12);
        const before = { solids: H.getSettlementSolids().shapes, drawn: H.getDrawnSettlements().buildings };
        const doc = JSON.parse(JSON.stringify(H.__w1_04_settlement('thorn')));
        const full = doc.buildings.slice();
        doc.buildings = doc.buildings.slice(0, 1);
        H.__w1_04_perturbSettlement(doc, null); H.stepFrames(12);
        const after = { solids: H.getSettlementSolids().shapes, drawn: H.getDrawnSettlements().buildings };
        doc.buildings = full;
        H.__w1_04_perturbSettlement(doc, null); H.stepFrames(12);
        const restored = { solids: H.getSettlementSolids().shapes, drawn: H.getDrawnSettlements().buildings };
        out.legs.building_list = { before, after, restored, drawn_followed: after.drawn < before.drawn, solids_followed: after.solids < before.solids, restores: restored.drawn === before.drawn && restored.solids === before.solids };
      } catch (e) { out.legs.building_list = { error: String(e && e.message ? e.message : e).slice(0, 200) }; }

      // ---- LEG 3: does a wall actually stop a body? My own walk, both arms. ---------------
      // Through `walkPath`, which is the harness's own scripted walk (`stepFrames(n)` takes no
      // input vector, so a hand-rolled loop would have held no key and BOTH arms would have
      // read "did not advance" — a control that is inert for the same reason round 3's was).
      try {
        out.legs.wall_stops_a_body = { walks: [] };
        H.teleport(3820, 859); H.stepFrames(20);
        const plan = H.__w1_04_plan('thorn');
        const cands = (plan && plan.buildings ? plan.buildings : [])
          .filter((b) => b.drawn_footprint_m && b.drawn_footprint_m[1] > 7 && b.entry_side !== '-z')
          .slice(0, 3);
        for (const bld of cands) {
          const d = bld.drawn_footprint_m[1];
          const startZ = bld.z - d / 2 - 7;
          const wallZ = bld.z - d / 2;
          const walk = (wallsOn) => {
            H.__w1_04_townSolids(wallsOn); H.stepFrames(4);
            const r = H.walkPath([[bld.x, startZ], [bld.x, wallZ + 5]], { stuckAbort: 240, maxFrames: 900 });
            const p = H.__w1_04_sim().player.pos;
            return {
              aborted: r && r.aborted, frames: r && r.frames,
              end_z: +p[2].toFixed(2), past_wall_m: +(p[2] - wallZ).toFixed(2),
              inside: H.buildingAt(p[0], p[2]),
            };
          };
          const on = walk(true);
          const off = walk(false);
          out.legs.wall_stops_a_body.walks.push({
            building: bld.id, entry_side: bld.entry_side, wall_z: +wallZ.toFixed(2),
            with_walls: on, walls_cut: off,
            stopped_outside: on.past_wall_m < 0.5,
            walked_through_when_cut: off.past_wall_m > 1.0,
            arms_differ: Math.abs(on.past_wall_m - off.past_wall_m) > 1.0,
          });
        }
        H.__w1_04_townSolids(true); H.stepFrames(6);
      } catch (e) { out.legs.wall_stops_a_body.error = String(e && e.message ? e.message : e).slice(0, 200); }

      return out;
    });
    save();
    log('S5 consumption written');
  }

  // =====================================================================================
  // S6 — PICTURES.
  // =====================================================================================
  if (want('S6')) {
    const shots = {};
    // (1) VP04 at its declared pose, with the buildings.
    shots.vp04 = await page.evaluate(async () => {
      const H = window.__HARNESS;
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      H.teleport(3820, 859); H.stepFrames(20);
      H.setTimeOfDay(9); if (H.setWeather) H.setWeather('clear');
      H.camera({ pos: [3825.5, 15.1, 879], look: [3820.5, 14, 864], fov: 60 });
      H.renderFrame();
      const url = await H.screenshot();
      return { url, drawn: H.getDrawnSettlements().buildings, inside: H.buildingAt(3825.5, 879) };
    });
    // (2) Helstrom from above — the roofs.
    shots.roofs = await page.evaluate(async () => {
      const H = window.__HARNESS;
      H.teleport(2262.5, 2773.5); H.stepFrames(30);
      H.setTimeOfDay(12); if (H.setWeather) H.setWeather('clear');
      H.camera({ pos: [2262.5, 27.22 + 85, 2773.5 + 12], look: [2262.5, 27.22, 2773.5], fov: 60 });
      H.renderFrame();
      const url = await H.screenshot();
      return { url, drawn: H.getDrawnSettlements().buildings };
    });
    // (3) Helstrom from a low oblique — a town from the street.
    shots.street = await page.evaluate(async () => {
      const H = window.__HARNESS;
      H.camera({ pos: [2262.5 + 95, 27.22 + 26, 2773.5 + 95], look: [2262.5, 27.22 + 6, 2773.5], fov: 60 });
      H.renderFrame();
      const url = await H.screenshot();
      return { url, drawn: H.getDrawnSettlements().buildings };
    });
    // (3b) Blackrose's inn from the street: a 3.4 x 3.9 m shed whose door opens on a
    // 13.6 x 15.6 m room. The shrink pass made the exterior smaller than its own interior on
    // 41 of 112 enterable buildings, and this is the worst of them.
    shots.shed = await page.evaluate(async () => {
      const H = window.__HARNESS;
      H.teleport(1905.5, 4450); H.stepFrames(30);
      H.setTimeOfDay(12); if (H.setWeather) H.setWeather('clear');
      const plan = H.__w1_04_plan('blackrose');
      const b = plan && plan.buildings ? plan.buildings.find((x) => x.id === 'blackrose-inn') : null;
      if (!b) return { url: null, missing: true };
      H.teleport(b.x, b.z - 18); H.stepFrames(20);
      const gy = b.y || 0;
      H.camera({ pos: [b.x + 9, gy + 4.5, b.z - 14], look: [b.x, gy + 2, b.z], fov: 60 });
      H.renderFrame();
      const url = await H.screenshot();
      return { url, drawn_footprint_m: b.drawn_footprint_m, declared_footprint_m: b.declared_footprint_m, shrink: b.shrink, interior: b.interior };
    });

    // (4) An interior strip: three rooms at the sweep's pose.
    shots.interiors = [];
    for (const id of ['blackrose-prison', 'thorn-hall', 'archon-apothecary']) {
      const r = await page.evaluate(async (rid) => {
        const H = window.__HARNESS, E = window.__ENGINE;
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        const ok = H.enterInterior(rid);
        if (!ok || !ok.entered) return { id: rid, url: null, error: 'not entered' };
        H.stepFrames(3);
        E.sim.npcs.length = 0;
        H.camera({ pos: [0, 1.62, -5.2], look: [0, 1.3, 2.0], fov: 60 });
        H.renderFrame();
        const url = await H.screenshot();
        const g = window.__C.graph();
        return { id: rid, url, meshes: g.meshes, triangles: g.triangles, lights: g.lights };
      }, id);
      shots.interiors.push(r);
    }

    const files = {};
    files.vp04 = savePng(shots.vp04.url, '2026-08-08-w1-04-r3-critic-vp04-inside-a-wall.png');
    files.roofs = savePng(shots.roofs.url, '2026-08-08-w1-04-r3-critic-helstrom-open-topped-roofs.png');
    files.street = savePng(shots.street.url, '2026-08-08-w1-04-r3-critic-helstrom-town-from-outside.png');
    files.shed = savePng(shots.shed.url, '2026-08-08-w1-04-r3-critic-blackrose-inn-a-shed-over-a-hall.png');
    files.interiors = shots.interiors.map((s) => savePng(s.url, `2026-08-08-w1-04-r3-critic-interior-${s.id}.png`));
    R.sections.S6 = {
      files,
      shed: { drawn_footprint_m: shots.shed.drawn_footprint_m, declared_footprint_m: shots.shed.declared_footprint_m, shrink: shots.shed.shrink, interior: shots.shed.interior },
      vp04: { buildings_drawn: shots.vp04.drawn, camera_inside_building: shots.vp04.inside },
      roofs: { buildings_drawn: shots.roofs.drawn },
      street: { buildings_drawn: shots.street.drawn },
      interiors: shots.interiors.map((s) => ({ id: s.id, meshes: s.meshes, triangles: s.triangles, lights: s.lights })),
    };
    save();
    log(`S6 pictures written: ${Object.values(files).flat().filter(Boolean).length}`);
  }

  // =====================================================================================
  // S7 — THE ROUND-2 VERDICT'S OWN ACCEPTANCE FOR ROUND 3, WHICH ROUND 3 DID NOT RUN:
  // "A pixel sweep of one fixed camera pose at all eight town centres returns 8 distinct
  //  images, and the control arm returns 1."  Measured against its own noise floor: each
  // town is shot TWICE in the live arm, so "distinct" can be read against repeat variation
  // rather than assumed to be zero.
  // =====================================================================================
  if (want('S7')) {
    R.sections.S7 = await page.evaluate(async () => {
      const H = window.__HARNESS, C = window.__C;
      const TOWNS = {
        archon: [3785, 3.42, 3823.5], blackrose: [1905.5, 2.68, 4450], gideon: [439, 2.72, 2913.5],
        helstrom: [2262.5, 27.22, 2773.5], lilmoth: [2766.5, 2.77, 5027.5], soulrest: [610.5, 7.91, 4877],
        stormhold: [2171.5, 141.12, 761], thorn: [3820, 13.31, 859],
      };
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      H.setTimeOfDay(12); if (H.setWeather) H.setWeather('clear');
      // ONE POSE, relative to each town centre — the same offset everywhere, so the only thing
      // that changes between two frames is the town.
      const OFF = [70, 22, 70];
      const shotAt = async (c) => {
        H.teleport(c[0], c[2]); H.stepFrames(24);
        H.camera({ pos: [c[0] + OFF[0], c[1] + OFF[1], c[2] + OFF[2]], look: [c[0], c[1] + 5, c[2]], fov: 60 });
        H.renderFrame();
        const u = await H.screenshot();
        return { h: C.hash(u), bytes: u.length, buildings: H.getDrawnSettlements().buildings };
      };
      const arm = async (label, on) => {
        H.__w1_04_drawBuildings(on);
        const rows = {};
        for (const [sid, c] of Object.entries(TOWNS)) rows[sid] = await shotAt(c);
        return { label, rows, distinct_images: new Set(Object.values(rows).map((r) => r.h)).size, towns: Object.keys(rows).length };
      };
      const live = await arm('buildings drawn', true);
      // The noise floor: the SAME eight poses again, nothing changed.
      const repeat = await arm('buildings drawn (repeat)', true);
      const control = await arm('draw call cut', false);
      H.__w1_04_drawBuildings(true); H.stepFrames(8);
      const stable = Object.keys(live.rows).filter((k) => live.rows[k].h === repeat.rows[k].h).length;
      return {
        side: 'HARNESS',
        live: { distinct: live.distinct_images, buildings: Object.fromEntries(Object.entries(live.rows).map(([k, v]) => [k, v.buildings])) },
        repeat_of_live: { distinct: repeat.distinct_images, towns_byte_identical_to_first_pass: stable },
        control: { distinct: control.distinct_images, buildings: Object.fromEntries(Object.entries(control.rows).map(([k, v]) => [k, v.buildings])) },
        rows: { live: live.rows, repeat: repeat.rows, control: control.rows },
        verdicts: {
          live_returns_8: live.distinct_images === 8,
          control_returns_1: control.distinct_images === 1,
          arms_differ: control.distinct_images < live.distinct_images,
          repeatable: stable === 8,
        },
      };
    });
    const s = R.sections.S7;
    log(`S7 town sweep: live ${s.live.distinct}/8 distinct, repeat-stable ${s.repeat_of_live.towns_byte_identical_to_first_pass}/8, control ${s.control.distinct}`);
    save();
  }

  // =====================================================================================
  // S8 — HOW LONG IS THE TOWN NOT THERE?
  //
  // S7 read the drawn building count one town LATE in all eight towns: arriving at Helstrom
  // and reading the scene graph returned Thorn's 15. Either the streamer needs more than the
  // 24 fixed steps S7 gave it, or the town genuinely never arrives. This measures it: stand in
  // each town and step until the drawn count reaches the town's own declared count, or give up.
  // The townspeople are spawned by `populateSettlement` on arrival, so any gap here is a window
  // in which the cast is standing on bare ground — which is what round 2 was criticised for.
  // =====================================================================================
  if (want('S8')) {
    R.sections.S8 = await page.evaluate(async () => {
      const H = window.__HARNESS;
      const TOWNS = {
        thorn: [3820, 13.31, 859, 15], helstrom: [2262.5, 27.22, 2773.5, 40],
        archon: [3785, 3.42, 3823.5, 22], soulrest: [610.5, 7.91, 4877, 15],
      };
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      const rows = {};
      for (const [sid, c] of Object.entries(TOWNS)) {
        const want_n = c[3];
        H.teleport(c[0], c[2]);
        let frames = 0, got = H.getDrawnSettlements().buildings, trace = [];
        for (let i = 0; i < 40; i++) {
          H.stepFrames(6); frames += 6;
          got = H.getDrawnSettlements().buildings;
          if (trace.length < 12) trace.push({ frames, drawn: got });
          if (got === want_n) break;
        }
        rows[sid] = {
          declared_buildings: want_n, drawn_at_end: got, frames_to_reach_it: got === want_n ? frames : null,
          reached: got === want_n, trace,
          people_present: (H.whereIsEveryone ? (H.whereIsEveryone().present || null) : null),
        };
      }
      return { side: 'HARNESS', note: 'teleport arrival, then step until the drawn count equals the town\'s own declared count', rows };
    });
    save();
    log('S8 streaming latency written');
  }

  // =====================================================================================
  // S9 — THE PICTURES, RETAKEN, WITH THE SCENE GRAPH CHECKED BEFORE THE SHUTTER.
  // The first pass photographed a bare hill at Helstrom because the tiles had not streamed
  // and the count read was the previous town's. A picture whose subject was never verified
  // to be in the scene graph is not evidence.
  // =====================================================================================
  if (want('S9')) {
    const shoot = async (spec) => page.evaluate(async (s) => {
      const H = window.__HARNESS;
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      H.teleport(s.at[0], s.at[2]);
      let drawn = 0;
      for (let i = 0; i < 40; i++) { H.stepFrames(6); drawn = H.getDrawnSettlements().buildings; if (drawn === s.expect) break; }
      H.setTimeOfDay(s.hour === undefined ? 12 : s.hour);
      if (H.setWeather) H.setWeather('clear');
      H.camera({ pos: s.pos, look: s.look, fov: s.fov || 60 });
      H.renderFrame();
      const url = await H.screenshot();
      return { url, drawn, expected: s.expect, verified: drawn === s.expect };
    }, spec);

    const H2 = { helstrom: [2262.5, 27.22, 2773.5] };
    const c = H2.helstrom;
    const roofs = await shoot({
      at: c, expect: 40, hour: 12,
      // Close in and high enough to see over the roofline, looking down at about 50 degrees.
      pos: [c[0] + 30, c[1] + 42, c[2] + 30], look: [c[0], c[1] + 4, c[2]],
    });
    const town = await shoot({
      at: c, expect: 40, hour: 9,
      pos: [c[0] + 62, c[1] + 16, c[2] + 62], look: [c[0], c[1] + 5, c[2]],
    });
    R.sections.S9 = {
      roofs: { file: savePng(roofs.url, '2026-08-08-w1-04-r3-critic-helstrom-roofs-from-above.png'), drawn: roofs.drawn, verified: roofs.verified },
      town: { file: savePng(town.url, '2026-08-08-w1-04-r3-critic-helstrom-forty-buildings.png'), drawn: town.drawn, verified: town.verified },
    };
    save();
    log(`S9 pictures: roofs verified=${roofs.verified} (${roofs.drawn}), town verified=${town.verified} (${town.drawn})`);
  }

  R.finished_at = new Date().toISOString();
  save();
  log(`wrote ${outFile}`);
  await handle.close();
  process.exit(0);
} catch (e) {
  R.fatal = String(e && e.stack ? e.stack : e).slice(0, 2000);
  R.finished_at = new Date().toISOString();
  try { save(); } catch { /* disk */ }
  log(`critic-w1-04-r3a: ${R.fatal}`);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
