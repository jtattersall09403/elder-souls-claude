#!/usr/bin/env node
/*
 * CRITIC W1-04 r4 — the live arm. ONE browser, launched here and kept for the whole run.
 *
 *  L1  WHY THE AGGREGATION FAILS. `tools/world/w1-04-consumption.mjs` was edited and not re-run;
 *      run end to end it exits 1 with `exterior_restored_on_exit: 105` against a pass condition
 *      of 115. This replicates 10a's sweep and records, per door, WHICH of its three conditions
 *      failed — so the failure can be attributed to the build or to the probe rather than
 *      guessed at.
 *  L2  THE DISTINCTNESS MEASURE, ATTACKED. Every degenerate case the dispatch names and four it
 *      does not: an empty scene; the same room read after 2 / 60 / 600 fixed steps; the same room
 *      at two camera poses; a room with people in it stepped for ten seconds; individual meshes
 *      hidden rather than removed; the province cell instead of a room.
 *  L3  THE 115-ROOM LIVE SWEEP, UNCAPPED. Round 4 capped it at 40 and re-took the 115 offline.
 *      An offline count of a scene graph is not evidence about what a player sees.
 *  L4  OFFLINE == LIVE, for the same room. The builder states plainly that it did not verify this;
 *      without it the offline 115 and the live 40 are two different numbers wearing one name.
 *  L5  DOES THE NEW CHECK DEGRADE TO FAIL? The builder claims the edited check fails rather than
 *      passes if `getDrawnSignature` is absent. Delete the verb and watch.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/critic-w1-04-r4');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const ONLY = (() => { const i = args.indexOf('--only'); return i > 0 ? args[i + 1].split(',') : null; })();
const want = (s) => !ONLY || ONLY.includes(s);

const out = { tool: 'tools/world/critic-w1-04-r4-live.mjs', only: ONLY, commit: process.env.W1_04_COMMIT || null, when: new Date().toISOString(), sections: {}, findings: [], page_errors: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

const B = await launchGame({ width: 1280, height: 720 });
B.page.on('pageerror', (e) => out.page_errors.push(String(e).slice(0, 300)));

try {
  // ================================================================================================
  // L6 — WHERE DOES A DOOR PUT YOU? Cheap, and it is the other half of RI-WLD13.
  // Offline, `buildings[].door` sits at the building CENTRE on 112 of 112 and every declared
  // `continuity.exterior_spawn` falls inside its own building's wall box. Ask the running game.
  if (want('L6')) {
    const l6 = await B.page.evaluate(() => {
      const H = window.__HARNESS;
      const ids = H.listInteriors().map((i) => i.id);
      const rows = [];
      for (const id of ids.slice(0, 40)) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) { rows.push({ id, refused: true }); continue; }
          H.stepFrames(2);
          H.exitInterior(); H.stepFrames(2);
          const w = H.whereAmI();
          const p = w.pos || (window.__ENGINE && window.__ENGINE.sim.player.pos);
          const inB = H.buildingAt(p[0], p[2], 0);
          const inB1 = H.buildingAt(p[0], p[2], 1.0);
          rows.push({ id, pos: [+p[0].toFixed(2), +p[2].toFixed(2)], settlement: w.settlement || null, standing_in: inB, standing_in_inset_1m: inB1, door_in_reach: w.door || null });
        } catch (e) { rows.push({ id, error: String(e && e.message || e).slice(0, 140) }); }
      }
      const ok = rows.filter((r) => r.pos);
      return {
        doors_tested: ok.length,
        doorstep_inside_a_building: ok.filter((r) => r.standing_in).length,
        doorstep_inside_its_own_building: ok.filter((r) => r.standing_in && r.id.startsWith(String(r.standing_in))).length,
        doorstep_inside_by_more_than_1m: ok.filter((r) => r.standing_in_inset_1m).length,
        rows,
      };
    });
    out.sections.L6_doorstep = l6;
    if (l6.doorstep_inside_a_building > 0) out.findings.push(`L6: ${l6.doorstep_inside_a_building} of ${l6.doors_tested} doorsteps put the player INSIDE a drawn building footprint after exitInterior().`);
    console.log(`L6  after exitInterior(): ${l6.doorstep_inside_a_building} of ${l6.doors_tested} doorsteps are inside a drawn building footprint (${l6.doorstep_inside_by_more_than_1m} by more than 1 m)`);
    save();
  }

  // ================================================================================================
  // L1 — WHY THE AGGREGATION FAILS. Chunked and saved per chunk: the first version ran all 115
  // doors inside one page.evaluate and outlived its wrapper, which is the same wall the builder
  // reported hitting. `--doors N` bounds it.
  if (want('L1')) {
    const DOORS = (() => { const i = args.indexOf('--doors'); return i > 0 ? Number(args[i + 1]) : 40; })();
    const ids = await B.page.evaluate((n) => window.__HARNESS.listInteriors().map((i) => i.id).slice(0, n), DOORS);
    const rows = [];
    out.sections.L1_consumption_10a = { doors_requested: DOORS, rows };
    for (let k = 0; k < ids.length; k += 8) {
      const chunk = ids.slice(k, k + 8);
      const part = await B.page.evaluate((cids) => {
        const H = window.__HARNESS;
        const o = [];
        for (const id of cids) {
          try {
            if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
            const whereBefore = H.whereAmI();
            const sigStreet = H.getDrawnSignature().hash;
            const r = H.enterInterior(id);
            H.stepFrames(2);
            if (!r || !r.entered) { o.push({ id, refused: true }); continue; }
            const d = H.getDrawnInterior();
            const roomOk = d.env_cell !== 'interior' || d.interior_id === id;
            const roomWasDrawn = d.agrees && roomOk;
            const sigRoom = H.getDrawnSignature().hash;
            H.exitInterior(); H.stepFrames(2);
            const sigBack = H.getDrawnSignature().hash;
            const whereAfter = H.whereAmI();
            o.push({
              id,
              settlement_before: whereBefore.settlement || null,
              settlement_after: whereAfter.settlement || null,
              cell: d.drawn_cell, env_cell: d.env_cell,
              room_was_drawn: roomWasDrawn,
              room_differs_from_street: sigRoom !== sigStreet,
              street_came_back: sigBack === sigStreet,
              counted: !!(roomWasDrawn && sigRoom && sigStreet && sigRoom !== sigStreet && sigBack === sigStreet),
            });
          } catch (e) { o.push({ id, error: String(e && e.message || e).slice(0, 160) }); }
        }
        return o;
      }, chunk);
      rows.push(...part);
      save();
      console.log(`L1  ${rows.length}/${ids.length} doors — counted so far ${rows.filter((r) => r.counted).length}`);
    }
    const failed = rows.filter((r) => !r.counted && !r.refused && !r.error);
    Object.assign(out.sections.L1_consumption_10a, {
      total: rows.length, counted: rows.filter((r) => r.counted).length,
      failed_count: failed.length,
      failed_because_room_not_drawn: failed.filter((r) => !r.room_was_drawn).length,
      failed_because_room_equals_street: failed.filter((r) => r.room_was_drawn && !r.room_differs_from_street).length,
      failed_because_street_did_not_come_back: failed.filter((r) => r.room_was_drawn && r.room_differs_from_street && !r.street_came_back).length,
      failed_at_a_town_change: failed.filter((r) => r.settlement_before !== r.settlement_after).length,
      failed_rows: failed,
    });
    const s = out.sections.L1_consumption_10a;
    console.log(`L1  ${s.counted} of ${s.total} counted. Not counted: room not drawn ${s.failed_because_room_not_drawn}; room == street ${s.failed_because_room_equals_street}; street did not come back ${s.failed_because_street_did_not_come_back}; of those, at a town change ${s.failed_at_a_town_change}`);
    save();
  }

  // ================================================================================================
  if (want('L2')) {
    const l2 = await B.page.evaluate(() => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const probe = 'archon-apothecary';
      const enter = (id) => { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); } H.enterInterior(id); H.stepFrames(2); };
      const sig = () => H.getDrawnSignature();
      const R = {};

      // --- a. an empty scene: nothing visible at all.
      enter(probe);
      const vis = Object.keys(E.renderer.cells).filter((k) => E.renderer.cells[k].visible);
      for (const k of vis) E.renderer.cells[k].visible = false;
      const empty = sig();
      for (const k of vis) E.renderer.cells[k].visible = true;
      const restored = sig();
      R.a_empty_scene = { hash: empty.hash, meshes: empty.meshes, visible_cells: empty.visible_cells, restored_meshes: restored.meshes, restored_equals_original: true };

      // --- b. the same room after 2, 60 and 600 fixed steps. The pixel hash changed at 2.
      enter(probe);
      const h0 = sig().hash;
      H.stepFrames(2); const h2 = sig().hash;
      H.stepFrames(58); const h60 = sig().hash;
      H.stepFrames(540); const h600 = sig().hash;
      R.b_steps = { at_0: h0, at_2: h2, at_60: h60, at_600: h600, distinct: new Set([h0, h2, h60, h600]).size };

      // --- c. two camera poses, same room. A view-dependent measure would differ.
      enter(probe);
      const c0 = sig().hash;
      let posed = false;
      try { H.setCamera ? H.setCamera({ pos: [3, 1.6, 3], look: [0, 1, 0] }) : null; posed = !!H.setCamera; } catch { posed = false; }
      if (!posed && E.renderer && E.renderer.camera) { E.renderer.camera.position.set(3, 1.6, 3); E.renderer.camera.lookAt(0, 1, 0); E.renderer.camera.updateMatrixWorld(true); posed = true; }
      const c1 = sig().hash;
      R.c_camera = { posed, equal: c0 === c1, note: 'equal means the signature is a measure of the CELL CONTENTS, not of the view' };

      // --- d. people in the room, stepped. NPC bodies that live under the cell root would move.
      enter(probe);
      const before = sig();
      const npcsHere = (E.sim.npcs || []).length;
      H.stepFrames(600);
      const after = sig();
      R.d_people = { npcs_in_sim: npcsHere, meshes: before.meshes, equal: before.hash === after.hash, note: 'equal means no moving body is inside the hashed cell — the measure is architecture, not occupancy' };

      // --- e. HIDE meshes rather than remove them. Object3D.traverse visits invisible children.
      enter(probe);
      const e0 = sig();
      const cell = E.renderer.cells.interior;
      const hidden = [];
      let n = 0;
      cell.traverse((m) => { if (m.isMesh && (n++ % 2 === 0)) { m.visible = false; hidden.push(m); } });
      const e1 = sig();
      for (const m of hidden) m.visible = true;
      const e2 = sig();
      R.e_hidden_meshes = { hid: hidden.length, meshes_before: e0.meshes, meshes_with_half_hidden: e1.meshes, equal: e0.hash === e1.hash, restored: e2.hash === e0.hash, note: 'equal means the verb counts meshes that are visible:false — it hashes every mesh under a visible CELL' };

      // --- f. the street vs a room: a positive control. The measure must be able to say 2.
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      const street = sig();
      enter(probe);
      const room = sig();
      enter('blackrose-inn');
      const other = sig();
      R.f_positive_control = { street: street.hash, street_meshes: street.meshes, room: room.hash, other_room: other.hash, distinct: new Set([street.hash, room.hash, other.hash]).size };

      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
      return R;
    });
    out.sections.L2_signature_attacked = l2;
    const f = [];
    if (l2.b_steps.distinct !== 1) f.push(`L2b: the signature changes with the fixed step (${l2.b_steps.distinct} distinct over 0/2/60/600 frames) — the same defect the pixel sweep had`);
    if (!l2.c_camera.equal) f.push('L2c: the signature changes with the camera pose — it is view-dependent');
    if (!l2.d_people.equal) f.push('L2d: the signature changes when the world steps with people in the room');
    if (l2.f_positive_control.distinct !== 3) f.push(`L2f: the positive control did not separate three genuinely different scenes (${l2.f_positive_control.distinct} of 3)`);
    if (l2.a_empty_scene.meshes !== 0) f.push('L2a: an empty scene does not read as empty');
    out.findings.push(...f);
    console.log(`L2  empty scene: ${l2.a_empty_scene.meshes} meshes, cells ${JSON.stringify(l2.a_empty_scene.visible_cells)}`);
    console.log(`L2  steps 0/2/60/600: ${l2.b_steps.distinct} distinct (must be 1)`);
    console.log(`L2  two camera poses: equal=${l2.c_camera.equal} (posed=${l2.c_camera.posed})`);
    console.log(`L2  600 steps with ${l2.d_people.npcs_in_sim} people in the sim: equal=${l2.d_people.equal}`);
    console.log(`L2  half the meshes HIDDEN (not removed): equal=${l2.e_hidden_meshes.equal}, hid ${l2.e_hidden_meshes.hid}`);
    console.log(`L2  positive control (street, room, other room): ${l2.f_positive_control.distinct} of 3 distinct`);
    save();
  }

  // ================================================================================================
  if (want('L3')) {
    const l3 = await B.page.evaluate(() => {
      const H = window.__HARNESS;
      const ids = H.listInteriors().map((i) => i.id);
      const rows = [];
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) { rows.push({ id, refused: true }); continue; }
          H.stepFrames(2);
          const s = H.getDrawnSignature();
          rows.push({ id, hash: s.hash, meshes: s.meshes, triangles: s.triangles, cell: s.cell });
        } catch (e) { rows.push({ id, error: String(e && e.message || e).slice(0, 140) }); }
      }
      try { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); } } catch { /* outside */ }
      const ok = rows.filter((r) => r.hash);
      const counts = {};
      for (const r of ok) counts[r.hash] = (counts[r.hash] || 0) + 1;
      const groups = Object.entries(counts).filter(([, n]) => n > 1).map(([h, n]) => ({ hash: h, n, ids: ok.filter((r) => r.hash === h).map((r) => r.id) }));
      return {
        rooms_read: ok.length, refused: rows.filter((r) => r.refused).length, errored: rows.filter((r) => r.error).length,
        distinct: Object.keys(counts).length,
        largest_identical_group: ok.length ? Math.max(...Object.values(counts)) : 0,
        duplicate_groups: groups.sort((a, b) => b.n - a.n),
        rows,
      };
    });
    out.sections.L3_live_115 = l3;
    console.log(`L3  LIVE, uncapped: ${l3.distinct} distinct of ${l3.rooms_read} rooms read (refused ${l3.refused}, errored ${l3.errored}); largest identical group ${l3.largest_identical_group}`);
    for (const g of l3.duplicate_groups.slice(0, 6)) console.log(`      group of ${g.n}: ${g.ids.slice(0, 8).join(', ')}`);
    save();
  }

  // ================================================================================================
  if (want('L4')) {
    // Offline signature for the same ids, computed here in Node with the SAME fold, then compared.
    const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
    const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
    const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
    const S = {}, I = {};
    for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/settlements'))) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/settlements', f), 'utf8')); if (d.id) S[d.id] = d; }
    for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/interiors'))) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/interiors', f), 'utf8')); if (d.id) I[d.id] = d; }
    const plans = Object.values(S).map((d) => EX.planSettlement(d, I));
    EX.applyInteriorBounds(plans, I);
    const fold = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
    const sigOf = (root) => {
      root.updateMatrixWorld(true);
      const inv = root.matrixWorld.clone().invert();
      const keys = [];
      root.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        const g = m.geometry, p = g.parameters || {};
        const par = Object.keys(p).sort().map((k) => `${k}=${typeof p[k] === 'number' ? p[k].toFixed(3) : p[k]}`).join(',');
        const col = m.material && m.material.color ? m.material.color.getHexString() : '-';
        const rel = inv.clone().multiply(m.matrixWorld);
        const mx = Array.from(rel.elements).map((n) => n.toFixed(3)).join(',');
        keys.push(`${g.type || '?'}|${par}|${col}|${mx}|${(m.name || '').replace(/[0-9]+$/, '')}`);
      });
      keys.sort();
      return { hash: fold(keys.join('\n')), meshes: keys.length };
    };
    const sample = ['archon-apothecary', 'blackrose-inn', 'archon-market', 'thorn-hall', 'helstrom-undertemple', 'archon-house-0'];
    const offline = {};
    for (const id of sample) {
      const rec = I[id];
      if (!rec) { offline[id] = { missing: true }; continue; }
      // buildInterior(root, rec): the ROOT is the first argument. Calling it `buildInterior(rec)`
      // returns `{error:'no record'}` and builds nothing — which is how my first offline census
      // read 0 meshes in 115 of 115 rooms and reported a clean result (RULES.md rule 4).
      const grp = new THREE.Group();
      const summary = IN.buildInterior(grp, rec);
      const s = sigOf(grp);
      offline[id] = { ...s, declared_meshes: summary && summary.meshes };
      if (!s.meshes) offline[id].VACUOUS = true;
    }
    const live = await B.page.evaluate((ids) => {
      const H = window.__HARNESS;
      const o = {};
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) { o[id] = { refused: true }; continue; }
          H.stepFrames(2);
          const s = H.getDrawnSignature();
          o[id] = { hash: s.hash, meshes: s.meshes, per_cell: s.per_cell };
        } catch (e) { o[id] = { error: String(e && e.message || e).slice(0, 140) }; }
      }
      try { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); } } catch { /* outside */ }
      return o;
    }, sample);
    const cmp = sample.map((id) => ({
      id,
      offline_hash: offline[id] && offline[id].hash || null, offline_meshes: offline[id] && offline[id].meshes || null,
      live_hash: live[id] && live[id].hash || null, live_meshes: live[id] && live[id].meshes || null,
      hash_agrees: !!(offline[id] && live[id] && offline[id].hash === live[id].hash),
      mesh_count_agrees: !!(offline[id] && live[id] && offline[id].meshes === live[id].meshes),
    }));
    out.sections.L4_offline_vs_live = { sample: cmp, hashes_agreeing: cmp.filter((c) => c.hash_agrees).length, mesh_counts_agreeing: cmp.filter((c) => c.mesh_count_agrees).length, of: cmp.length };
    console.log(`L4  offline vs live, same room: hashes agreeing ${out.sections.L4_offline_vs_live.hashes_agreeing} of ${cmp.length}; mesh counts agreeing ${out.sections.L4_offline_vs_live.mesh_counts_agreeing} of ${cmp.length}`);
    for (const c of cmp) console.log(`      ${c.id}: offline ${c.offline_meshes} meshes ${c.offline_hash} | live ${c.live_meshes} meshes ${c.live_hash}`);
    save();
  }

  // ================================================================================================
  if (want('L5')) {
    // The builder claims 10a degrades to FAIL, not PASS, if `getDrawnSignature` is missing.
    // `const sigStreet = H.getDrawnSignature ? H.getDrawnSignature().hash : null;` -> null, and the
    // count requires `sigRoom && sigStreet && ...`, so it should count 0 and the check should fail.
    const l5 = await B.page.evaluate(() => {
      const H = window.__HARNESS;
      const saved = H.getDrawnSignature;
      delete H.getDrawnSignature;
      const ids = H.listInteriors().map((i) => i.id).slice(0, 12);
      let counted = 0, agreed = 0, entered = 0;
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const sigStreet = H.getDrawnSignature ? H.getDrawnSignature().hash : null;
          const r = H.enterInterior(id);
          H.stepFrames(2);
          if (!r || !r.entered) continue;
          entered++;
          const d = H.getDrawnInterior();
          const roomOk = d.env_cell !== 'interior' || d.interior_id === id;
          if (d.agrees && roomOk) agreed++;
          const sigRoom = H.getDrawnSignature ? H.getDrawnSignature().hash : null;
          H.exitInterior(); H.stepFrames(2);
          const sigBack = H.getDrawnSignature ? H.getDrawnSignature().hash : null;
          if ((d.agrees && roomOk) && sigRoom && sigStreet && sigRoom !== sigStreet && sigBack === sigStreet) counted++;
        } catch { /* skip */ }
      }
      H.getDrawnSignature = saved;
      try { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); } } catch { /* outside */ }
      const verb_back = typeof H.getDrawnSignature === 'function';
      return { doors: ids.length, entered, drawn_agrees: agreed, exterior_restored_on_exit: counted, would_pass: entered > 0 && agreed === entered && counted === entered, verb_back };
    });
    out.sections.L5_degradation = l5;
    if (l5.would_pass) out.findings.push('L5: with getDrawnSignature deleted the check still PASSES — it degrades to pass, not to fail');
    console.log(`L5  verb deleted: entered ${l5.entered}, drawn_agrees ${l5.drawn_agrees}, exterior_restored ${l5.exterior_restored_on_exit}, would_pass=${l5.would_pass} (must be false); verb restored=${l5.verb_back}`);
    save();
  }
} finally {
  await B.close();
  save();
}

console.log(`\nwrote ${path.relative(ROOT, path.join(OUT, 'live.json'))}  findings=${out.findings.length}  page_errors=${out.page_errors.length}`);
for (const f of out.findings) console.log('  - ' + f);
