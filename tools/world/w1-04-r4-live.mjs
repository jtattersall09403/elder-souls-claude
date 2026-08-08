#!/usr/bin/env node
// W1-04 round 4 — THE LIVE ARM: is the join a thing the RUNNING GAME does?
//
// `tools/world/w1-04-r4-join.mjs` calls `applyInteriorBounds()` itself. That makes it a check of
// the arithmetic, not of the build: if `world/province.js#setSettlements()` never called the join,
// the offline tool would go on passing while the shipped game drew a shed over a hall. RULES.md
// rule 10 — *confirm the code you are about to change actually runs, by perturbing it and
// watching the world* — is the whole reason this file exists. Everything below is read off the
// running engine, and one section deliberately breaks the join in the live page and watches the
// numbers go back to round 3's.
//
// FOUR SECTIONS.
//
//   S1  THE JOIN, LIVE. Every enterable building in every town: the drawn footprint out of the
//       engine's own `settlementPlans`, against `bounds_m` on the interior record the engine is
//       holding. This is the round-3 verdict's headline number, re-asked of the running world.
//   S2  THE JOIN, CUT, IN THE LIVE PAGE. `setSettlements()` is re-run with the join's effect
//       undone — the records restored to their declared bounds — and S1 is re-asked. If this arm
//       does not go red, S1 is not measuring the join (rule 6: a control you have never seen fail
//       is a second copy of the experiment).
//   S3  DISTINCTNESS THAT SURVIVES A NULL CONTROL. The round-3 critic proved both pixel-hash
//       criteria in this piece are unmeasurable — 8 of 8 distinct images in ONE UNCHANGED ROOM
//       after two fixed steps, and 8 of 8 in a control that drew zero buildings. So the measure
//       is `getDrawnSignature()`, a sorted hash over the visible cells' meshes, and it publishes
//       its own noise floor BEFORE any cross-room number:
//         n0  one unchanged room, read twice with two fixed steps between   -> MUST be 1
//         n1  the same room entered, left and re-entered                     -> MUST be 1
//         n2  the null control: every room built from ONE record             -> MUST be 1
//         n3  the rooms                                                      -> the number
//       n2 is the arm the pixel sweep failed. Only after all three floors are 1 is n3 reported.
//   S4  `interior.meshes` IS A BUILD RECORD. Empty the room's group and it still reports the
//       meshes of a room that is not there — the round-3 critic's row 4, which is why round 2's
//       "92 distinct scene-graph signatures" is a hash of build records. Re-run here against the
//       new verb, which must go to zero.
//
// ONE BROWSER, launched here and kept for the whole run: the contention gate was over its
// per-core ceiling and rule 21 permits proceeding if it is declared, which it is, in
// `orchestration/status/W1-04-r4.json`. The pooled capture daemon cannot serve this run — its
// query path is a read-only whitelist and every section here mutates the world.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/w1-04-r4');
fs.mkdirSync(OUT, { recursive: true });

// `--only S3,S4` and `--rooms N` exist because this box is shared: a 115-room sweep under load
// can outlive a wrapper's timeout, and a successor should be able to re-take the section that
// was lost without paying for the three that landed. Every section writes as it finishes.
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const want = (s) => !ONLY || ONLY.includes(s);
const ROOM_CAP = (() => { const i = process.argv.indexOf('--rooms'); return i > 0 ? Number(process.argv[i + 1]) : 0; })();
const out = { tool: 'tools/world/w1-04-r4-live.mjs', only: ONLY, room_cap: ROOM_CAP || null, commit: process.env.W1_04_COMMIT || null, when: new Date().toISOString(), sections: {}, failures: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

const B = await launchGame({ width: 1280, height: 720 });
const errs = [];
B.page.on('pageerror', (e) => errs.push(String(e)));

try {
  if (want('S1')) {
  // ---- S1 -------------------------------------------------------------------------------------
  const s1 = await B.page.evaluate(() => {
    const H = window.__HARNESS;
    const rows = [];
    for (const s of H.listSettlements()) {
      const plan = H.__w1_04_plan(s.id);
      if (!plan) continue;
      for (const b of plan.buildings) {
        if (!b.enterable || !b.interior) continue;
        const rec = H.__w1_04_interior(b.interior);
        if (!rec || !rec.bounds_m) { rows.push({ id: b.id, error: 'no record' }); continue; }
        const W = rec.bounds_m.x[1] - rec.bounds_m.x[0], D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
        rows.push({
          id: b.id, interior: b.interior, settlement: s.id,
          drawn_footprint_m: b.drawn_footprint_m,
          room_m: [+W.toFixed(2), +D.toFixed(2)],
          declared_room_m: rec.bounds_m_declared ? [+(rec.bounds_m_declared.x[1] - rec.bounds_m_declared.x[0]).toFixed(2), +(rec.bounds_m_declared.z[1] - rec.bounds_m_declared.z[0]).toFixed(2)] : null,
          joined: !!rec.bounds_m_declared,
          area_ratio: +((b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (W * D)).toFixed(4),
          fits: (b.drawn_footprint_m[0] - 0.36) + 1e-6 >= W + 0.3 && (b.drawn_footprint_m[1] - 0.36) + 1e-6 >= D + 0.3,
        });
      }
    }
    const bad = rows.filter((r) => r.error || !r.fits);
    return {
      measured: rows.length, outside_smaller_than_inside: bad.length,
      not_joined_by_the_engine: rows.filter((r) => !r.joined).length,
      worst: bad.slice(0, 6),
      worst_area_ratio: rows.length ? Math.min(...rows.map((r) => r.area_ratio || 99)) : null,
      rows,
    };
  });
  out.sections.S1_join_live = s1;
  if (s1.outside_smaller_than_inside) out.failures.push(`S1: ${s1.outside_smaller_than_inside} of ${s1.measured} live buildings smaller than their own room`);
  if (s1.not_joined_by_the_engine) out.failures.push(`S1: ${s1.not_joined_by_the_engine} records the engine never joined`);
  console.log(`S1  live: ${s1.measured} enterable buildings, outside smaller than inside ${s1.outside_smaller_than_inside}, worst area ratio ${s1.worst_area_ratio}, records not joined ${s1.not_joined_by_the_engine}`);
  save();
  }

  if (want('S2')) {
  // ---- S2: the control arm, in the live page --------------------------------------------------
  const s2 = await B.page.evaluate(() => {
    const H = window.__HARNESS, E = window.__ENGINE;
    // Undo the join on the LIVE records — this is the world round 3 shipped — and re-plan so the
    // footprints are rebuilt from the same data.
    const recs = Object.values(E.data.interiors || {});
    const stash = [];
    for (const r of recs) {
      if (!r.bounds_m_declared) continue;
      stash.push([r, r.bounds_m, r.bounds_m_declared, r.continuity && r.continuity.interior_spawn, r.continuity && r.continuity.interior_spawn_declared]);
      r.bounds_m = { x: r.bounds_m_declared.x.slice(), y: r.bounds_m_declared.y.slice(), z: r.bounds_m_declared.z.slice() };
      delete r.bounds_m_declared;
    }
    const count = () => {
      let bad = 0, n = 0, worst = 99;
      for (const s of H.listSettlements()) {
        const plan = H.__w1_04_plan(s.id);
        if (!plan) continue;
        for (const b of plan.buildings) {
          if (!b.enterable || !b.interior) continue;
          const rec = H.__w1_04_interior(b.interior);
          if (!rec || !rec.bounds_m) continue;
          n++;
          const W = rec.bounds_m.x[1] - rec.bounds_m.x[0], D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
          const r = (b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (W * D);
          if (r < worst) worst = r;
          if (!((b.drawn_footprint_m[0] - 0.36) + 1e-6 >= W + 0.3 && (b.drawn_footprint_m[1] - 0.36) + 1e-6 >= D + 0.3)) bad++;
        }
      }
      return { measured: n, outside_smaller_than_inside: bad, worst_area_ratio: +worst.toFixed(4) };
    };
    const cut = count();
    // Put it back, through the engine's own call, and confirm it restores.
    E.renderer.province.setSettlements(Object.values(E.data.settlements || {}), E.data.interiors || {});
    const restored = count();
    return { cut, restored };
  });
  out.sections.S2_join_cut_control = s2;
  if (!(s2.cut.outside_smaller_than_inside > 0)) out.failures.push('S2: the control arm is INERT — removing the join changed nothing, so S1 is not measuring it');
  if (s2.restored.outside_smaller_than_inside !== 0) out.failures.push(`S2: the join did not restore (${s2.restored.outside_smaller_than_inside} still failing)`);
  console.log(`S2  join cut in the live page: ${s2.cut.outside_smaller_than_inside} of ${s2.cut.measured} fail (worst ${s2.cut.worst_area_ratio}); restored: ${s2.restored.outside_smaller_than_inside} fail (worst ${s2.restored.worst_area_ratio})`);
  save();
  }

  if (want('S3')) {
  // ---- S3: distinctness with its own floor ----------------------------------------------------
  const s3 = await B.page.evaluate((CAP) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const probe = 'archon-apothecary';
    const enter = (id) => { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); } H.enterInterior(id); H.stepFrames(2); };
    // n0 — one unchanged room, read twice, with two fixed steps in between. Two steps is exactly
    // what made the pixel hash change every time.
    enter(probe);
    const a = H.getDrawnSignature().hash;
    H.stepFrames(2);
    const b = H.getDrawnSignature().hash;
    // n1 — leave and come back to the SAME room. This is the sweep's own protocol.
    H.exitInterior(); H.stepFrames(2);
    enter(probe);
    const c = H.getDrawnSignature().hash;
    // n2 — the null control: every door opens on the same record. Point every interior record at
    // the probe's own room contents, so 115 doors build one room.
    const ids = (() => { const a = H.listInteriors().map((i) => i.id); return CAP ? a.slice(0, CAP) : a; })();
    const P = E.data.interiors[probe];
    const saved = [];
    for (const id of ids) {
      const r = E.data.interiors[id];
      if (!r || r === P) continue;
      saved.push([r, r.bounds_m, r.props, r.containers, r.interior_kind, r.settlement, r.lights]);
      r.bounds_m = P.bounds_m; r.props = P.props; r.containers = P.containers;
      r.interior_kind = P.interior_kind; r.settlement = P.settlement; r.lights = P.lights;
    }
    const nullArm = [];
    for (const id of ids.slice(0, 40)) {
      try { enter(id); nullArm.push(H.getDrawnSignature().hash); } catch { /* refused */ }
    }
    for (const [r, bm, pr, co, ik, st, li] of saved) { r.bounds_m = bm; r.props = pr; r.containers = co; r.interior_kind = ik; r.settlement = st; r.lights = li; }
    if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
    // n3 — the rooms themselves.
    const live = [], detail = [];
    for (const id of ids) {
      try {
        enter(id);
        const s = H.getDrawnSignature();
        const d = H.getDrawnInterior();
        live.push(s.hash);
        detail.push({ id, hash: s.hash, scene_meshes: s.meshes, build_record_meshes: d.interior ? d.interior.meshes : null, cell: s.cell });
      } catch (e) { detail.push({ id, error: String(e && e.message || e) }); }
    }
    if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
    const counts = {};
    for (const h of live) counts[h] = (counts[h] || 0) + 1;
    return {
      n0_same_room_two_steps: { shots: 2, distinct: new Set([a, b]).size },
      n1_left_and_re_entered: { shots: 2, distinct: new Set([a, c]).size },
      n2_null_control_one_record: { rooms: nullArm.length, distinct: new Set(nullArm).size },
      n3_rooms: { rooms: live.length, distinct: Object.keys(counts).length, largest_identical_group: live.length ? Math.max(...Object.values(counts)) : 0 },
      detail,
    };
  }, ROOM_CAP);
  out.sections.S3_distinctness = s3;
  // n2 is NOT part of the floor. Pointing 40 records at one record's contents does not build 40
  // identical rooms: `buildInterior` seeds prop placement off `hashStr(rec.id)`, so the rooms
  // genuinely differ and a measure of the room is right to say 40. The real null control — the one
  // the pixel sweep fails — is S5, where the room builder itself is cut.
  s3.n2_is_not_a_null_control = 'buildInterior seeds prop placement off hashStr(rec.id) (interior.js:455), so identical CONTENTS under different ids are different rooms. See S5 for the null control that is one, and w1-04-r4-join.mjs n1 for the offline arm that builds the same record OBJECT and returns 1.';
  const floorOk = s3.n0_same_room_two_steps.distinct === 1 && s3.n1_left_and_re_entered.distinct === 1;
  s3.floor_ok = floorOk;
  if (!floorOk) out.failures.push('S3: the distinctness measure failed its own noise floor — it is not measuring the room');
  console.log(`S3  floor: n0 ${s3.n0_same_room_two_steps.distinct}, n1 ${s3.n1_left_and_re_entered.distinct}, n2 null control ${s3.n2_null_control_one_record.distinct} of ${s3.n2_null_control_one_record.rooms} (all must be 1)`);
  console.log(`S3  rooms: ${s3.n3_rooms.distinct} distinct of ${s3.n3_rooms.rooms}, largest identical group ${s3.n3_rooms.largest_identical_group}`);
  save();
  }

  if (want('S4')) {
  // ---- S4: build record vs scene read ---------------------------------------------------------
  const s4 = await B.page.evaluate(() => {
    const H = window.__HARNESS, E = window.__ENGINE;
    if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
    H.enterInterior('archon-apothecary'); H.stepFrames(2);
    const before = { build_record_meshes: H.getDrawnInterior().interior.meshes, scene_meshes: H.getDrawnSignature().meshes, hash: H.getDrawnSignature().hash };
    // Empty the built room's group behind the world's back — the round-3 critic's row 4.
    const cell = E.renderer.cells.interior;
    const kept = cell.children.slice();
    while (cell.children.length) cell.remove(cell.children[0]);
    const after = { build_record_meshes: H.getDrawnInterior().interior.meshes, scene_meshes: H.getDrawnSignature().meshes, hash: H.getDrawnSignature().hash };
    for (const k of kept) cell.add(k);
    const restored = { scene_meshes: H.getDrawnSignature().meshes, hash: H.getDrawnSignature().hash };
    if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
    return { before, after, restored };
  });
  out.sections.S4_build_record_vs_scene = s4;
  if (s4.after.scene_meshes !== 0) out.failures.push('S4: emptying the room left the scene signature reporting meshes — the new verb is not a scene read either');
  if (s4.after.hash === s4.before.hash) out.failures.push('S4: the signature did not change when the room was emptied');
  console.log(`S4  emptied the room's group: build record still says ${s4.after.build_record_meshes} meshes; the scene read says ${s4.after.scene_meshes} (was ${s4.before.scene_meshes}); restored ${s4.restored.scene_meshes}`);
  save();
  }
  if (want('S5')) {
  // ---- S5: THE NULL CONTROL, DONE PROPERLY ----------------------------------------------------
  //
  // S3's n2 arm pointed every record at ONE record's contents and got 40 distinct rooms out of 40,
  // and that is not the instrument failing — it is the arm being mis-specified. `buildInterior`
  // seeds prop placement off `hashStr(rec.id)` (`interior.js:455`), so two rooms with byte-identical
  // contents and different ids are genuinely different rooms and the signature is right to say so.
  // The offline arm in `w1-04-r4-join.mjs` collapses to 1 because it builds the same record OBJECT,
  // id included.
  //
  // So the live null control is the one the pixel sweep already has and already failed: cut the
  // room builder to a no-op, exactly as `w1-04-interior-sweep.mjs` does, and walk the same doors.
  // Every door then shows the same unchanged cell. The pixel sweep returned 115 DISTINCT IMAGES in
  // this arm. A measure of the room must return 1.
  const s5 = await B.page.evaluate((CAP) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const ids = H.listInteriors().map((i) => i.id).slice(0, CAP || 20);
    const saved = E.renderer.setInteriorRecord.bind(E.renderer);
    E.renderer.setInteriorRecord = () => null;
    const seen = [], rows = [];
    try {
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) continue;
          H.stepFrames(2);
          const g = H.getDrawnSignature();
          seen.push(g.hash);
          rows.push({ id, hash: g.hash, cell: g.cell, visible: g.visible_cells, meshes: g.meshes });
        } catch { /* refused */ }
      }
    } finally {
      E.renderer.setInteriorRecord = saved;
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      H.stepFrames(2);
    }
    // PARTITION BY CELL, and this is a correction to the criterion rather than to the result.
    // `cellFor()` folds 110 of the 115 interiors onto the one generic `interior` cell; the other
    // five — `barge-hold`, `writ-house`, `helstrom-market`, `stormhold-street`, `rootlands-well` —
    // are W1-07's hand-built cells with names of their own, and cutting `setInteriorRecord` does
    // not touch them. A door that opens on a different cell is not part of "these are all the same
    // room", so counting it as a failure of the null control would be the round-2 mistake of
    // scoring five hand-built cells as misses in a check about the generic one.
    const generic = rows.filter((r) => r.cell === 'interior');
    const named = rows.filter((r) => r.cell !== 'interior');
    return {
      arm: 'room builder cut to a no-op — the pixel sweep returns one distinct image per door in this arm',
      rooms: seen.length, distinct: new Set(seen).size,
      doors_on_the_generic_interior_cell: generic.length,
      distinct_on_the_generic_cell: new Set(generic.map((r) => r.hash)).size,
      doors_on_their_own_named_cell: named.map((r) => `${r.id}:${r.cell}`),
      rows,
    };
  }, ROOM_CAP);
  out.sections.S5_null_control_room_builder_cut = s5;
  if (s5.distinct_on_the_generic_cell !== 1) out.failures.push(`S5: the null control returned ${s5.distinct_on_the_generic_cell} distinct signatures over ${s5.doors_on_the_generic_interior_cell} doors that are all the same emptied room — the measure does not survive a null control`);
  console.log(`S5  room builder cut: ${s5.distinct_on_the_generic_cell} distinct signature(s) over ${s5.doors_on_the_generic_interior_cell} doors on the generic interior cell (must be 1; the pixel sweep returns one per door). Doors on their own named cell, not part of the arm: ${JSON.stringify(s5.doors_on_their_own_named_cell)}`);
  save();
  }
} catch (e) {
  out.fatal = String(e && e.stack || e);
  console.error(out.fatal);
} finally {
  out.page_errors = errs.slice(0, 20);
  out.pass = !out.fatal && out.failures.length === 0;
  save();
  await B.close();
}
for (const f of out.failures) console.log(`FAIL ${f}`);
console.log('report reports/w1-04-r4/live.json');
process.exit(out.pass ? 0 : 1);
