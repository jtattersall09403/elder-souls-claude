#!/usr/bin/env node
/**
 * critic-w1-04-r2a — the W1-04 round-2 CRITIC's own instrument.
 *
 * Written because a critic that re-runs the builder's probe has confirmed that the builder's
 * probe runs. Every number here is taken independently of `tools/world/w1-04-consumption.mjs`,
 * and where the two can disagree they are both reported.
 *
 * WHAT IT ASKS, in the order the round-2 brief asks it:
 *
 *  A. Does `getDrawnInterior()` read the RENDERER, or a field the model wrote? Answered by
 *     perturbing the RENDERER and leaving the model alone: the room builder is wrapped so that
 *     it builds the room and then empties the group. If the verb still reports 127 meshes, its
 *     `interior` block is a build-time self-report and not a scene-graph read. The verb's
 *     `agrees`/`visible_cells` half is checked separately, by traversing `renderer.cells`
 *     directly at read time rather than trusting `renderer.cell`.
 *  A2. My own distinctness number, computed by TRAVERSING the visible group in each of the 115
 *     rooms at read time — not by hashing the cached summary the builder's §10c hashes.
 *  B. The 115-interior cell sweep, so the arm below (`--entry` at a cut scratch copy) has
 *     something to be compared against.
 *  D. How often the room is actually REBUILT while you stand still in it, and across a door.
 *     A content-keyed cache that rebuilds every frame is a performance defect traded for probe
 *     falsifiability, and this counts it rather than guessing.
 *  E/F. `post` and `goal` after a save/load, audited on the RUNNING world (RULES.md rule 7):
 *     is a posted quest-giver still outdoors, or is she standing in the cellar with you again?
 *  G. Schedules: how many people change cell, change position, and how many actually WALK
 *     (`walked_m > 0`) as opposed to being snapped across a cell boundary. And who is outdoors.
 *
 * HOW IT CAN FAIL. `--expect-live` asserts the numbers a passing build must produce and exits
 * non-zero when they are not there; run with `--entry <a tree with the fix cut>` it must fail,
 * and that is the delete-the-fix control. It is not a tool that can only report success.
 *
 * SEAM NOTE. This reaches `window.__ENGINE` deliberately and says so. The whole finding of
 * round 1 was that no harness surface read the renderer; a critic checking whether the NEW
 * surface reads the renderer cannot do it through that same surface. Measurements that CAN be
 * taken through `window.__HARNESS` are taken through it.
 *
 * Usage:
 *   node tools/world/critic-w1-04-r2a.mjs --out reports/critic-w1-04-r2a.json
 *   node tools/world/critic-w1-04-r2a.mjs --entry <scratch>/game/index.html --out ...  # cut arm
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
critic-w1-04-r2a.mjs — the W1-04 round-2 critic's independent instrument.

  --out <path>     JSON report (default reports/critic-w1-04-r2a.json)
  --entry <html>   game entry point; point it at a scratch copy for the delete-the-fix arm
  --expect-live    exit non-zero unless the live-build numbers are present (the assertion arm)
  --timeout <ms>   harness wait (default 120000)
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const outFile = args.out || 'reports/critic-w1-04-r2a.json';
const timeout = Number(args.timeout ?? 120000);

let handle;
const R = { tool: 'tools/world/critic-w1-04-r2a.mjs', entry: args.entry || 'game/index.html' };
try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout });

  const out = await page.evaluate(() => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const step = (n) => H.stepFrames(n);

    // ---- THE INDEPENDENT READ. Traverse the scene graph at read time. --------------------
    // `getDrawnInterior().interior` is whatever `buildInterior()` returned when the room was
    // built, cached on the renderer. This walks the actual Object3D tree now.
    const liveGraph = () => {
      const vis = Object.keys(E.renderer.cells).filter((k) => E.renderer.cells[k].visible);
      const cell = vis.length === 1 ? vis[0] : null;
      let meshes = 0, tris = 0, lights = 0, objects = 0;
      if (cell) {
        E.renderer.cells[cell].traverse((o) => {
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
    };

    const res = {};
    const ids = H.listInteriors().map((i) => i.id);
    res.interiors_listed = ids.length;

    // =====================================================================================
    // B. THE SWEEP — every door, and what the renderer has visible after it.
    // =====================================================================================
    {
      const rows = [];
      const sigs = new Map();
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); step(1); }
          const r = H.enterInterior(id);
          step(2);
          if (!r || !r.entered) { rows.push({ id, entered: false }); continue; }
          const v = H.getDrawnInterior();
          const g = liveGraph();
          // The verb's own claim, and my own traversal, side by side.
          const agrees_verb = !!v.agrees;
          const agrees_graph = g.cell === v.env_cell;
          // A2: my distinctness key is a LIVE traversal, not the cached summary.
          const key = `${g.cell}|${g.objects}|${g.meshes}|${g.triangles}|${g.lights}`;
          sigs.set(key, (sigs.get(key) || 0) + 1);
          let restored = null;
          H.exitInterior(); step(2);
          restored = liveGraph().cell === H.getDrawnInterior().env_cell;
          rows.push({ id, entered: true, agrees_verb, agrees_graph, restored, drawn: v.drawn_cell, want: v.env_cell, room: v.interior_id, graph: g });
        } catch (e) { rows.push({ id, error: String(e && e.message ? e.message : e).slice(0, 160) }); }
      }
      const entered = rows.filter((r) => r.entered);
      const counts = [...sigs.values()].sort((a, b) => b - a);
      res.sweep = {
        total: ids.length,
        entered: entered.length,
        refused: rows.filter((r) => r.entered === false).length,
        errors: rows.filter((r) => r.error).length,
        agrees_verb: entered.filter((r) => r.agrees_verb).length,
        agrees_graph: entered.filter((r) => r.agrees_graph).length,
        exterior_restored_on_exit: entered.filter((r) => r.restored).length,
        distinct_live_graph_signatures: sigs.size,
        largest_identical_group: counts[0] || 0,
        misses: rows.filter((r) => r.entered && !r.agrees_graph).slice(0, 8),
        // A handful of whole rows, so the numbers above can be re-derived by eye.
        sample: entered.slice(0, 3),
        triangle_range: entered.length
          ? [Math.min(...entered.map((r) => r.graph.triangles)), Math.max(...entered.map((r) => r.graph.triangles))]
          : null,
      };
    }
    try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
    step(2);

    // =====================================================================================
    // A. IS THE VERB READING THE RENDERER? Perturb the RENDERER, not the model.
    // =====================================================================================
    {
      const roomId = ids.includes('archon-apothecary') ? 'archon-apothecary' : ids[0];
      const enter = () => { try { if (H.whereAmI().interior) { H.exitInterior(); step(1); } } catch { /* outside */ } H.enterInterior(roomId); step(2); };

      enter();
      const before = { verb: H.getDrawnInterior(), graph: liveGraph() };

      // THE PERTURBATION: the room builder still runs, still reads the record, still returns a
      // summary — and then the group it filled is emptied. Nothing in the MODEL is touched.
      const saved = E.renderer.setInteriorRecord.bind(E.renderer);
      E.renderer.setInteriorRecord = function (rec) {
        const s = saved(rec);
        const root = E.renderer.cells.interior;
        const dead = [];
        root.traverse((o) => { if (o !== root) dead.push(o); });
        for (const o of dead) if (o.parent) o.parent.remove(o);
        return s;
      };
      // Force a genuine rebuild: leave and come back through the door.
      enter();
      const emptied = { verb: H.getDrawnInterior(), graph: liveGraph() };
      E.renderer.setInteriorRecord = saved;
      // And restore, so nothing downstream inherits an empty room.
      E.renderer.interiorKey = null; E.renderer.interiorId = null;
      enter();
      const after = { verb: H.getDrawnInterior(), graph: liveGraph() };
      try { H.exitInterior(); step(2); } catch { /* outside */ }

      res.renderer_perturbation = {
        room: roomId,
        note: 'The room builder builds the room from the record and the group is then emptied. The MODEL is untouched.',
        before: { verb_meshes: before.verb.interior && before.verb.interior.meshes, verb_agrees: before.verb.agrees, graph_meshes: before.graph.meshes, graph_objects: before.graph.objects },
        emptied: { verb_meshes: emptied.verb.interior && emptied.verb.interior.meshes, verb_agrees: emptied.verb.agrees, graph_meshes: emptied.graph.meshes, graph_objects: emptied.graph.objects },
        restored: { verb_meshes: after.verb.interior && after.verb.interior.meshes, verb_agrees: after.verb.agrees, graph_meshes: after.graph.meshes, graph_objects: after.graph.objects },
        verb_noticed_the_empty_room: (before.verb.interior && emptied.verb.interior)
          ? before.verb.interior.meshes !== emptied.verb.interior.meshes : null,
        graph_noticed_the_empty_room: before.graph.meshes !== emptied.graph.meshes,
      };
    }

    // =====================================================================================
    // D. THE CACHE. How many times is the room rebuilt while you stand still in it?
    // =====================================================================================
    {
      const roomId = ids.includes('archon-apothecary') ? 'archon-apothecary' : ids[0];
      let applyCalls = 0, setRecordCalls = 0, rebuilds = 0;
      const savedApply = E._applyCell.bind(E);
      const savedSet = E.renderer.setInteriorRecord.bind(E.renderer);
      E._applyCell = function () { applyCalls++; return savedApply(); };
      E.renderer.setInteriorRecord = function (rec) {
        setRecordCalls++;
        const k0 = E.renderer.interiorKey;
        const s = savedSet(rec);
        if (E.renderer.interiorKey !== k0) rebuilds++;
        return s;
      };
      try { if (H.whereAmI().interior) { H.exitInterior(); step(1); } } catch { /* outside */ }
      H.enterInterior(roomId); step(2);
      const afterEntry = { applyCalls, setRecordCalls, rebuilds };
      // Stand still for 600 fixed steps (ten seconds of play) and count again.
      step(600);
      const standing = { applyCalls: applyCalls - afterEntry.applyCalls, setRecordCalls: setRecordCalls - afterEntry.setRecordCalls, rebuilds: rebuilds - afterEntry.rebuilds };
      // Out and back in: the cache MUST rebuild when the record's content has changed, and must
      // NOT rebuild when it has not.
      H.exitInterior(); step(2); H.enterInterior(roomId); step(2);
      const reentrySame = { applyCalls: applyCalls - afterEntry.applyCalls - standing.applyCalls, setRecordCalls: setRecordCalls - afterEntry.setRecordCalls - standing.setRecordCalls, rebuilds: rebuilds - afterEntry.rebuilds - standing.rebuilds };
      // Now perturb the record and come back: it MUST rebuild.
      const r0 = rebuilds;
      let restore = null;
      try {
        const d = H.__w1_04_interior(roomId);
        const old = JSON.parse(JSON.stringify(d.bounds_m));
        d.bounds_m = { x: [old.x[0] / 2, old.x[1] / 2], y: old.y, z: [old.z[0] / 2, old.z[1] / 2] };
        restore = () => { d.bounds_m = old; };
      } catch (e) { res.cache_perturb_error = String(e.message).slice(0, 160); }
      H.exitInterior(); step(2); H.enterInterior(roomId); step(2);
      const reentryChanged = { rebuilds: rebuilds - r0, graph: liveGraph() };
      if (restore) restore();
      H.exitInterior(); step(2); H.enterInterior(roomId); step(2);
      const restoredGraph = liveGraph();
      E._applyCell = savedApply;
      E.renderer.setInteriorRecord = savedSet;
      try { H.exitInterior(); step(2); } catch { /* outside */ }
      res.cache = {
        after_entry: afterEntry,
        standing_still_600_frames: standing,
        reentry_same_record: reentrySame,
        reentry_after_bounds_halved: reentryChanged,
        graph_after_restore: restoredGraph,
        note: 'rebuilds counts the times renderer.interiorKey actually changed, i.e. the times geometry was thrown away and rebuilt.',
      };
    }

    // =====================================================================================
    // G. SCHEDULES — cell, position, and who actually WALKED.
    // =====================================================================================
    {
      const towns = H.listSettlements().map((s) => s.id);
      for (const t of towns) { try { H.populateSettlement(t); } catch { /* some towns may refuse */ } }
      const snap = () => H.whereIsEveryone().map((p) => ({ eid: p.eid, at: p.at, pos: p.pos.slice() }));
      const walked = () => { const m = {}; for (const n of E.sim.npcs) m[n.eid] = { walked_m: n.walked_m || 0, post: !!n.post }; return m; };
      H.setTimeOfDay(9); step(120);
      const a = snap(); const wa = walked();
      const outdoorsAt = (h) => {
        H.setTimeOfDay(h); step(120);
        const rows = H.whereIsEveryone();
        let out = 0, outPosted = 0;
        for (const p of rows) if (p.at === null) { out++; const n = E.sim.npcs.find((x) => x.eid === p.eid); if (n && n.post) outPosted++; }
        return { hour: h, people: rows.length, at_null: out, at_null_with_post: outPosted };
      };
      const o3 = outdoorsAt(3);
      const b = snap(); const wb = walked();
      const o9 = outdoorsAt(9);
      const o20 = outdoorsAt(20);
      const byEid = new Map(a.map((p) => [p.eid, p]));
      let cellChanged = 0, posChanged = 0, both = 0;
      for (const p of b) {
        const q = byEid.get(p.eid); if (!q) continue;
        const cc = p.at !== q.at;
        const pc = Math.hypot(p.pos[0] - q.pos[0], p.pos[2] - q.pos[2]) > 0.01;
        if (cc) cellChanged++;
        if (pc) posChanged++;
        if (cc && pc) both++;
      }
      let reallyWalked = 0;
      for (const eid of Object.keys(wb)) if ((wb[eid].walked_m - (wa[eid] ? wa[eid].walked_m : 0)) > 0.05) reallyWalked++;
      res.schedules = {
        population: b.length,
        changed_cell_09_to_03: cellChanged,
        changed_position_09_to_03: posChanged,
        changed_both: both,
        position_changed_without_cell_change: posChanged - both,
        walked_m_accumulated_09_to_03: reallyWalked,
        outdoors: [o3, o9, o20],
        note: 'A cell change SNAPS the position (npc.js: "a different cell is a different frame"), so changed_position is mostly a consequence of changed_cell. walked_m counts only the walking branch.',
      };
    }

    // =====================================================================================
    // F. post / goal ACROSS A SAVE AND LOAD, audited on the RUNNING world.
    // =====================================================================================
    {
      const posted = E.sim.npcs.filter((n) => n.post).map((n) => n.eid);
      const readPosts = () => {
        const m = {};
        for (const n of E.sim.npcs) if (n.post) m[n.eid] = { post: JSON.parse(JSON.stringify(n.post)), at: n.at, present: n.present, goal: n.goal ? n.goal.slice() : null, pos: n.pos.slice() };
        return m;
      };
      H.setTimeOfDay(12); step(60);
      const before = readPosts();
      const blob = JSON.parse(JSON.stringify(H.saveState()));
      let loadErr = null;
      try { H.restoreState(blob); } catch (e) { loadErr = String(e.message).slice(0, 200); }
      step(60);
      const after = readPosts();
      let lost = 0, kept = 0;
      for (const eid of Object.keys(before)) { if (after[eid] && after[eid].post) kept++; else lost++; }
      // The BEHAVIOURAL consequence: is a posted person standing in the cellar with you?
      const room = ids.includes('archon-apothecary') ? 'archon-apothecary' : ids[0];
      H.enterInterior(room); step(30);
      const postedPresentInside = E.sim.npcs.filter((n) => n.post && n.present).map((n) => n.eid);
      try { H.exitInterior(); step(2); } catch { /* outside */ }
      // And the throw the builder says used to happen in the fixed step.
      res.save_round_trip = {
        posted_people_before: posted.length,
        post_kept_after_load: kept,
        post_lost_after_load: lost,
        load_error: loadErr,
        goal_null_after_load: Object.values(after).filter((v) => !v.goal).length,
        posted_people_present_inside_an_interior_after_load: postedPresentInside.length,
        posted_present_inside_sample: postedPresentInside.slice(0, 5),
      };
    }

    // =====================================================================================
    // Unique items — a real prop entity you can pick up, or a mesh on a pedestal?
    // =====================================================================================
    {
      const withItem = [];
      for (const id of ids) {
        try { const d = H.__w1_04_interior(id); if (d && d.unique_item && d.unique_item.id) withItem.push({ id, item: d.unique_item.id, owner: d.unique_item.owner || null }); } catch { /* no handle */ }
      }
      const rows = [];
      for (const w of withItem.slice(0, 12)) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); step(1); }
          H.enterInterior(w.id); step(2);
          const eid = `interior-unique:${w.item}`;
          const prop = E.sim.props.find((p) => p.eid === eid) || null;
          const inv0 = H.getInventory();
          let take = null;
          try { take = H.takeProp(eid); } catch (e) { take = { error: String(e.message).slice(0, 120) }; }
          const inv1 = H.getInventory();
          rows.push({
            interior: w.id, item: w.item, owner_declared: w.owner,
            prop_exists: !!prop,
            taken: !!(take && take.taken),
            theft: take ? (take.theft === undefined ? null : take.theft) : null,
            crime: take ? (take.crime === undefined ? null : take.crime) : null,
            inv_grew: JSON.stringify(inv0) !== JSON.stringify(inv1),
          });
        } catch (e) { rows.push({ interior: w.id, error: String(e.message).slice(0, 140) }); }
      }
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      res.unique_items = {
        interiors_declaring_one: withItem.length,
        with_an_owner_declared: withItem.filter((w) => w.owner).length,
        sampled: rows.length,
        prop_exists: rows.filter((r) => r.prop_exists).length,
        taken: rows.filter((r) => r.taken).length,
        theft_true: rows.filter((r) => r.theft === true).length,
        crime_filed: rows.filter((r) => r.crime).length,
        rows,
      };
    }

    return res;
  });

  R.result = out;
  R.page_errors = pageErrors;

  const s = out.sweep;
  log(`interiors listed        ${out.interiors_listed}`);
  log(`entered                 ${s.entered}/${s.total}   refused ${s.refused}   errors ${s.errors}`);
  log(`cell agrees (verb)      ${s.agrees_verb}/${s.entered}`);
  log(`cell agrees (my graph)  ${s.agrees_graph}/${s.entered}`);
  log(`exterior restored       ${s.exterior_restored_on_exit}/${s.entered}`);
  log(`distinct LIVE graphs    ${s.distinct_live_graph_signatures}  (largest identical group ${s.largest_identical_group})`);
  log(`triangle range          ${JSON.stringify(s.triangle_range)}`);
  const rp = out.renderer_perturbation;
  log(`renderer perturbation   verb noticed empty room: ${rp.verb_noticed_the_empty_room}   graph noticed: ${rp.graph_noticed_the_empty_room}`);
  log(`  verb meshes           ${rp.before.verb_meshes} -> ${rp.emptied.verb_meshes} -> ${rp.restored.verb_meshes}`);
  log(`  graph meshes          ${rp.before.graph_meshes} -> ${rp.emptied.graph_meshes} -> ${rp.restored.graph_meshes}`);
  log(`cache: standing still   applyCell ${out.cache.standing_still_600_frames.applyCalls}  setRecord ${out.cache.standing_still_600_frames.setRecordCalls}  rebuilds ${out.cache.standing_still_600_frames.rebuilds}  (600 frames)`);
  log(`cache: re-entry same    rebuilds ${out.cache.reentry_same_record.rebuilds}`);
  log(`cache: re-entry changed rebuilds ${out.cache.reentry_after_bounds_halved.rebuilds}`);
  log(`schedules               pop ${out.schedules.population}  cell ${out.schedules.changed_cell_09_to_03}  pos ${out.schedules.changed_position_09_to_03}  actually walked ${out.schedules.walked_m_accumulated_09_to_03}`);
  log(`outdoors                ${JSON.stringify(out.schedules.outdoors)}`);
  log(`save round trip         post kept ${out.save_round_trip.post_kept_after_load}/${out.save_round_trip.posted_people_before}  lost ${out.save_round_trip.post_lost_after_load}  posted-present-inside ${out.save_round_trip.posted_people_present_inside_an_interior_after_load}`);
  log(`unique items            declared ${out.unique_items.interiors_declaring_one}  sampled ${out.unique_items.sampled}  prop exists ${out.unique_items.prop_exists}  taken ${out.unique_items.taken}  theft ${out.unique_items.theft_true}`);

  const failures = [];
  if (args['expect-live']) {
    if (s.entered !== s.total) failures.push(`only ${s.entered} of ${s.total} interiors could be entered`);
    if (s.agrees_graph !== s.entered) failures.push(`${s.entered - s.agrees_graph} of ${s.entered} drew a cell the world had left (my own traversal)`);
    if (s.exterior_restored_on_exit !== s.entered) failures.push(`${s.entered - s.exterior_restored_on_exit} of ${s.entered} left the room on screen after exitInterior()`);
    if (s.distinct_live_graph_signatures < 3) failures.push(`${s.distinct_live_graph_signatures} distinct live scene graphs — the rooms are still one room`);
    if (out.cache.standing_still_600_frames.rebuilds > 0) failures.push(`the room rebuilt ${out.cache.standing_still_600_frames.rebuilds} times while standing still`);
    if (out.save_round_trip.post_lost_after_load > 0) failures.push(`${out.save_round_trip.post_lost_after_load} posts destroyed by a save/load`);
  }
  R.failures = failures;
  R.pass = failures.length === 0;
  log('');
  if (failures.length) for (const f of failures) log(`FAIL: ${f}`);
  else if (args['expect-live']) log('PASS: every assertion the live build must satisfy held.');

  writeJson(outFile, R);
  await handle.close();
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  log(`critic-w1-04-r2a: ${e && e.stack ? e.stack : e}`);
  R.crash = String(e && e.stack ? e.stack : e).slice(0, 2000);
  writeJson(outFile, R);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
