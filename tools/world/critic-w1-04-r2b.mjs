#!/usr/bin/env node
/**
 * critic-w1-04-r2b — the W1-04 round-2 critic's SECOND pass: three things the round's own
 * "not done" list does not mention, each of which is in code this round wrote.
 *
 * 1. THE READABLE THAT STOPS BEING READABLE. `Engine._furnishInterior()` spawns the room's
 *    documents into `sim.props` with `readable` and `readable_book` set, and `save/state.js`
 *    serialises props WITHOUT either field and rehydrates them with `readable: null`. Inside
 *    one session that is invisible, because `_furnishInterior()` deletes the props it spawned
 *    and re-spawns them on the next `_applyCell()`. On a FRESH engine — a real player loading
 *    a real save — `_interiorProps` is empty, nothing is deleted, and `spawnProp()` returns the
 *    existing stale object rather than replacing it. The document comes back unreadable.
 *    Modelled here by emptying `_interiorProps` before the load, which is exactly the state a
 *    fresh boot is in, and declared as such.
 *
 * 2. THE WALLS. The round's own list says interior walls have no collision. This measures how
 *    much wall: `solidAt()` sampled on a grid through the drawn shell of every sampled room.
 *
 * 3. THE THEFT CHAIN. 83 interiors declare a `unique_item`, 72 of them with an `owner`, and no
 *    unique item appears in any property zone's `contents`. So `takeProp()` on the thing on the
 *    pedestal reports what it reports — this asks the crime ledger whether anything happened.
 *
 * It fails when the defects are absent, which is the point: each row is asserted, and a build
 * that fixes them makes this tool exit non-zero and need rewriting. Say so in the verdict.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
critic-w1-04-r2b.mjs — the readable-after-load defect, interior walls, and the theft chain.

  --out <path>    JSON report (default reports/critic-w1-04-r2b.json)
  --timeout <ms>  harness wait (default 120000)
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const outFile = args.out || 'reports/critic-w1-04-r2b.json';
const timeout = Number(args.timeout ?? 120000);

let handle;
const R = { tool: 'tools/world/critic-w1-04-r2b.mjs' };
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
    const res = {};
    const ids = H.listInteriors().map((i) => i.id);

    // ---- 1. the readable that stops being readable ------------------------------------------
    {
      // Find a room whose record declares a readable.
      let room = null;
      for (const id of ids) {
        try { const d = H.__w1_04_interior(id); if (d && d.readable) { room = id; break; } } catch { /* no handle */ }
      }
      const rows = [];
      if (room) {
        H.enterInterior(room); step(3);
        const before = H.listEntities().filter((e) => String(e.eid).startsWith('interior-readable:'))
          .map((e) => ({ eid: e.eid, readable: e.readable, book: e.readable_book }));
        const blob = JSON.parse(JSON.stringify(H.saveState()));
        // A FRESH ENGINE has no memory of which props it furnished. This is that state.
        const savedList = E._interiorProps ? E._interiorProps.slice() : [];
        if (E._interiorProps) E._interiorProps.length = 0;
        H.restoreState(blob); step(3);
        const after = H.listEntities().filter((e) => String(e.eid).startsWith('interior-readable:'))
          .map((e) => ({ eid: e.eid, readable: e.readable, book: e.readable_book }));
        // Put the engine's bookkeeping back so nothing downstream inherits the modelled state.
        if (E._interiorProps) { E._interiorProps.length = 0; for (const x of savedList) E._interiorProps.push(x); }
        rows.push({ room, before, after });
        try { H.exitInterior(); step(2); } catch { /* outside */ }
      }
      const b = rows[0] ? rows[0].before : [];
      const a = rows[0] ? rows[0].after : [];
      res.readable_after_load = {
        room,
        readables_before: b.length,
        readables_after: a.length,
        readable_field_set_before: b.filter((x) => x.readable).length,
        readable_field_set_after: a.filter((x) => x.readable).length,
        book_set_before: b.filter((x) => x.book).length,
        book_set_after: a.filter((x) => x.book).length,
        detail: rows,
        note: 'A fresh engine is modelled by emptying Engine._interiorProps before the load — the state a real boot is in.',
      };
    }

    // ---- 2. the walls -------------------------------------------------------------------------
    {
      const sample = ids.slice(0, 10);
      const rows = [];
      for (const id of sample) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); step(1); }
          H.enterInterior(id); step(2);
          const s = H.getDrawnInterior().interior;
          if (!s || !s.bounds) { rows.push({ id, no_summary: true }); continue; }
          // Sample a ring OUTSIDE the drawn shell and a grid inside it.
          const w = s.bounds.w / 2, d = s.bounds.d / 2;
          let solidOutside = 0, tested = 0;
          for (const [x, z] of [[w + 2, 0], [-w - 2, 0], [0, d + 2], [0, -d - 2], [w + 5, d + 5], [-w - 5, -d - 5]]) {
            tested++;
            try { if (H.solidAt(x, 1.0, z)) solidOutside++; } catch { /* verb may refuse */ }
          }
          let solidOnWall = 0, wallTested = 0;
          for (const [x, z] of [[w, 0], [-w, 0], [0, d], [0, -d]]) {
            wallTested++;
            try { if (H.solidAt(x, 1.0, z)) solidOnWall++; } catch { /* verb may refuse */ }
          }
          rows.push({ id, bounds: s.bounds, cellId: E.sim.cellId || null, solid_on_the_wall: solidOnWall, wall_samples: wallTested, solid_outside: solidOutside, outside_samples: tested });
        } catch (e) { rows.push({ id, error: String(e.message).slice(0, 140) }); }
      }
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      res.walls = {
        sampled: rows.length,
        rooms_with_a_collision_cell: rows.filter((r) => r.cellId).length,
        rooms_with_any_solid_wall_sample: rows.filter((r) => r.solid_on_the_wall > 0).length,
        rows,
      };
    }

    // ---- 3. the theft chain -------------------------------------------------------------------
    {
      const rows = [];
      let n = 0;
      for (const id of ids) {
        if (n >= 6) break;
        let d = null;
        try { d = H.__w1_04_interior(id); } catch { /* no handle */ }
        if (!d || !d.unique_item || !d.unique_item.id || !d.unique_item.owner) continue;
        n++;
        try {
          if (H.whereAmI().interior) { H.exitInterior(); step(1); }
          H.enterInterior(id); step(2);
          const eid = `interior-unique:${d.unique_item.id}`;
          const crimeBefore = H.getCrimeState();
          let take = null;
          try { take = H.takeProp(eid); } catch (e) { take = { error: String(e.message).slice(0, 120) }; }
          step(3);
          const crimeAfter = H.getCrimeState();
          rows.push({
            interior: id, item: d.unique_item.id, owner: d.unique_item.owner,
            taken: !!(take && take.taken), theft: take ? (take.theft ?? null) : null,
            crime: take ? (take.crime ?? null) : null,
            stolen_from: take ? (take.stolen_from ?? null) : null,
            bounty_before: crimeBefore && crimeBefore.bounty, bounty_after: crimeAfter && crimeAfter.bounty,
            crimes_before: crimeBefore && (crimeBefore.crimes ? crimeBefore.crimes.length : crimeBefore.crime_count),
            crimes_after: crimeAfter && (crimeAfter.crimes ? crimeAfter.crimes.length : crimeAfter.crime_count),
          });
        } catch (e) { rows.push({ interior: id, error: String(e.message).slice(0, 140) }); }
      }
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      res.theft_chain = {
        sampled: rows.length,
        taken: rows.filter((r) => r.taken).length,
        theft_true: rows.filter((r) => r.theft === true).length,
        crime_filed: rows.filter((r) => r.crime).length,
        rows,
      };
    }

    // ---- 3b. THE SAME UNIQUE ITEM, TWICE. -----------------------------------------------------
    // `Engine._furnishInterior()` deletes the props it spawned when you leave and re-spawns them
    // when you come back, and `spawnProp()` always sets `taken: false`. `sim.world.itemsTaken`
    // records the take, is saved, is restored, is exposed to the harness — and is read by
    // NOTHING. So the question is whether walking out of a room and back in puts the room's one
    // unique item back on its pedestal.
    {
      let room = null, item = null;
      for (const id of ids) {
        try { const d = H.__w1_04_interior(id); if (d && d.unique_item && d.unique_item.id) { room = id; item = d.unique_item.id; break; } } catch { /* no handle */ }
      }
      const rows = [];
      if (room) {
        const eid = `interior-unique:${item}`;
        const countOf = (id) => H.getInventory().filter((i) => i.id === id).length;
        if (H.whereAmI().interior) { H.exitInterior(); step(1); }
        H.enterInterior(room); step(2);
        const before = countOf(item);
        let t1 = null, t2 = null, t3 = null;
        try { t1 = H.takeProp(eid); } catch (e) { t1 = { error: String(e.message).slice(0, 100) }; }
        step(2);
        const afterFirst = countOf(item);
        // Take it again WITHOUT leaving: must refuse.
        try { t2 = H.takeProp(eid); } catch (e) { t2 = { error: String(e.message).slice(0, 100) }; }
        const afterSecond = countOf(item);
        // Now walk out and back in, and try again.
        H.exitInterior(); step(2); H.enterInterior(room); step(2);
        const propBackOnThePedestal = !!E.sim.props.find((p) => p.eid === eid && !p.taken);
        try { t3 = H.takeProp(eid); } catch (e) { t3 = { error: String(e.message).slice(0, 100) }; }
        step(2);
        const afterReentry = countOf(item);
        let itemsTaken = null;
        try { itemsTaken = E.sim.world.itemsTaken.filter((x) => x === eid).length; } catch { /* */ }
        rows.push({ room, item, eid, before, afterFirst, afterSecond, afterReentry, propBackOnThePedestal, t1, t2, t3, items_taken_entries_for_this_eid: itemsTaken });
        try { H.exitInterior(); step(2); } catch { /* outside */ }
      }
      res.unique_item_respawn = {
        room, item,
        copies_after_one_take: rows[0] ? rows[0].afterFirst : null,
        copies_after_taking_twice_without_leaving: rows[0] ? rows[0].afterSecond : null,
        copies_after_leaving_and_returning: rows[0] ? rows[0].afterReentry : null,
        prop_back_on_the_pedestal: rows[0] ? rows[0].propBackOnThePedestal : null,
        detail: rows,
        note: 'sim.world.itemsTaken has a writer, a save, a load and a harness reader, and no consumer that suppresses a respawn.',
      };
    }

    // ---- 4. AR-2, re-measured rather than inherited ------------------------------------------
    // The round-1 verdict passed AR-2 on a build where the door drew nothing. This round draws
    // rooms, so the census has to be taken again: a room full of new surfaces is exactly where a
    // Souls affordance would appear.
    {
      const t = H.listSettlements()[0];
      H.teleport(t.pos[0] + 4, t.pos[2] + 4); H.setTimeOfDay(12); step(6);
      const outside = {};
      try { outside.markers = H.getDrawnMarkers().length; } catch (e) { outside.markers = 'THREW: ' + String(e.message).split('\n')[0]; }
      try { outside.ui = H.getUIState(); } catch { outside.ui = null; }
      const room = ids[0];
      H.enterInterior(room); step(6);
      const inside = {};
      try { inside.markers = H.getDrawnMarkers().length; } catch (e) { inside.markers = 'THREW: ' + String(e.message).split('\n')[0]; }
      try { inside.ui = H.getUIState(); } catch { inside.ui = null; }
      try { H.exitInterior(); step(2); } catch { /* outside */ }
      res.ar2 = {
        town: t.id, room,
        markers_outside: outside.markers, markers_inside: inside.markers,
        hud_elements_outside: outside.ui && (outside.ui.elements ? outside.ui.elements.length : outside.ui.element_count),
        hud_elements_inside: inside.ui && (inside.ui.elements ? inside.ui.elements.length : inside.ui.element_count),
        note: 'AR-2 asks whether a Souls convention leaked into the world. A room the renderer now furnishes is where one would show up.',
      };
    }

    // ---- 5. AR-3 / RI-MTH07: do the room's LAMPS reach the thing that decides if you are seen?
    // 827 lights are declared across the 115 records. This round made them visible. The stealth
    // detection model has a LightField whose `addSource` has exactly one caller in the tree — the
    // harness verb. So: stand in a room with lamps, and ask the world how dark it is.
    {
      const bright = ids.find((id) => { try { const d = H.__w1_04_interior(id); return d && (d.lights || []).length >= 6; } catch { return false; } }) || ids[0];
      const dark = ids.find((id) => { try { const d = H.__w1_04_interior(id); return d && (d.lights || []).length <= 1; } catch { return false; } }) || ids[1];
      const readRoom = (id) => {
        if (H.whereAmI().interior) { H.exitInterior(); step(1); }
        H.enterInterior(id); step(4);
        const s = H.getDrawnInterior().interior;
        let light = null, vis = null, cov = null;
        try { light = H.getLightAt(0, 1.6, 0); } catch (e) { light = 'THREW: ' + String(e.message).split('\n')[0]; }
        try { vis = H.visibilityAt({ x: 0, y: 1.6, z: 0 }); } catch (e) { vis = 'THREW: ' + String(e.message).split('\n')[0]; }
        try { cov = H.darkCoverage(); } catch (e) { cov = 'THREW: ' + String(e.message).split('\n')[0]; }
        return { id, lamps_drawn: s && s.lamps_built, lights_declared: s && s.lights_declared, lights_lit: s && s.lights_lit, light_at_eye: light, visibility: vis, dark_coverage: cov };
      };
      const a = readRoom(bright), b = readRoom(dark);
      let sources = null;
      try { sources = E.sim.stealth.light.sources.length; } catch { sources = null; }
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      res.lights_reach_stealth = {
        bright_room: a, dark_room: b,
        stealth_light_sources_registered: sources,
        the_two_rooms_read_the_same: JSON.stringify(a.light_at_eye) === JSON.stringify(b.light_at_eye),
        note: 'LightField.addSource() has exactly one caller in game/src — harness/api.js addLightSource(). If the two rooms read the same light, the lamps are drawn and unread.',
      };
    }

    return res;
  });

  R.result = out;
  R.page_errors = pageErrors;
  log(`unique item respawn    ${out.unique_item_respawn.room}: copies 1 take=${out.unique_item_respawn.copies_after_one_take}, twice inside=${out.unique_item_respawn.copies_after_taking_twice_without_leaving}, after leave+return=${out.unique_item_respawn.copies_after_leaving_and_returning} (back on pedestal: ${out.unique_item_respawn.prop_back_on_the_pedestal})`);
  log(`AR-2                   markers outside ${out.ar2.markers_outside}, inside ${out.ar2.markers_inside}`);
  log(`lamps -> stealth       ${out.lights_reach_stealth.bright_room.id} (${out.lights_reach_stealth.bright_room.lamps_drawn} lamps) vs ${out.lights_reach_stealth.dark_room.id} (${out.lights_reach_stealth.dark_room.lamps_drawn} lamps): same light? ${out.lights_reach_stealth.the_two_rooms_read_the_same}; stealth sources ${out.lights_reach_stealth.stealth_light_sources_registered}`);
  log(`readable after load    ${out.readable_after_load.readable_field_set_before} readable -> ${out.readable_after_load.readable_field_set_after} readable (room ${out.readable_after_load.room})`);
  log(`walls                  ${out.walls.rooms_with_a_collision_cell}/${out.walls.sampled} rooms have a collision cell; ${out.walls.rooms_with_any_solid_wall_sample}/${out.walls.sampled} report a solid wall`);
  log(`theft chain            ${out.theft_chain.taken}/${out.theft_chain.sampled} owned unique items taken, ${out.theft_chain.theft_true} filed as theft, ${out.theft_chain.crime_filed} reached the crime ledger`);

  const failures = [];
  // ASSERTED, so that a build which fixes any of these makes this tool go red.
  if (out.readable_after_load.room && out.readable_after_load.readable_field_set_after === out.readable_after_load.readable_field_set_before) {
    failures.push('the readable survived the modelled fresh-engine load — the defect this tool exists to demonstrate is not there, re-read it');
  }
  if (out.walls.rooms_with_a_collision_cell > 0) failures.push('an interior now has a collision cell — the wall finding is stale');
  if (out.theft_chain.crime_filed > 0) failures.push('an owned unique item now reaches the crime ledger — the theft-chain finding is stale');
  if (out.lights_reach_stealth.stealth_light_sources_registered > 0) failures.push('the stealth light field now has sources — the lamps-are-unread finding is stale');
  if (out.unique_item_respawn.room && out.unique_item_respawn.copies_after_leaving_and_returning === out.unique_item_respawn.copies_after_one_take) {
    failures.push('the unique item did NOT come back after leaving and returning — the duplication finding is stale, re-read it');
  }
  R.failures = failures;
  R.pass = failures.length === 0;
  if (failures.length) { log(''); for (const f of failures) log(`STALE: ${f}`); }
  writeJson(outFile, R);
  await handle.close();
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  log(`critic-w1-04-r2b: ${e && e.stack ? e.stack : e}`);
  R.crash = String(e && e.stack ? e.stack : e).slice(0, 2000);
  writeJson(outFile, R);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
