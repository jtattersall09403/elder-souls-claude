#!/usr/bin/env node
/*
 * CRITIC W1-04 ROUND 6 — THE LIVE ARMS. ONE browser, launched here, kept for the whole run,
 * closed in `finally`. Never `pkill`; this tool kills nothing by hand.
 * `setRenderRate(0)` throughout: nothing here is read off a rendered frame.
 *
 *   L1  THE HEADLINE, re-measured independently — 115 doors at 1 / 30 / 120 / 600 fixed steps.
 *
 *   L2  RULE 8, PUSHED. 600 frames is longer than 1, and it is still a number someone chose, and
 *       the round measured exactly ONE way of arriving on a doorstep: leaving through it. Seven
 *       arms per door, all reading the same `buildingAt()`:
 *         a  leave and stand           (the round's own arm, as a control)
 *         b  leave, walk 60 m away and come back   (the town collision cell is rebuilt)
 *         c  leave, saveState, loadState           (rule 7 — audit the running world after a load)
 *         d  enter and leave five times
 *         e  PUSHED IN: put the body 2 m inside the building it just left
 *         f  stand IN the doorway
 *         g  an NPC spawned on top of the body
 *       An arm that lands somewhere the control does not is a doorstep that depends on how you
 *       got to it.
 *
 *   L3  THE OTHER END OF THE DOOR. Round 6 rotates five buildings' `entry_side`, which moves the
 *       drawn INTERIOR doorway with it — but `continuity.interior_spawn` is only clamped, never
 *       re-derived, and `sim/settlement.js` offers the way OUT within `DOOR_REACH_M` of
 *       `interior_spawn`. So: stand where the game puts you, and stand at the doorway you can
 *       see, and press `interact` at both.
 *
 *   L4  RE-ENTRY through the real latch, all 115, to check 112 / 1 / 2.
 *
 *   node tools/world/critic-w1-04-r6-live.mjs [--only L1,L2,L3,L4] [--doors N]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/critic-w1-04-r6');
fs.mkdirSync(OUT, { recursive: true });

const ARG = process.argv.slice(2);
const argOf = (f, d) => { const i = ARG.indexOf(f); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = argOf('--only', null);
const CAP = Number(argOf('--doors', '0')) || 0;
const CHUNK = 8;
const want = (k) => !ONLY || ONLY.split(',').includes(k);

let prior = {};
try { prior = JSON.parse(fs.readFileSync(path.join(OUT, 'live.json'), 'utf8')); } catch { /* first run */ }
const out = { tool: 'tools/world/critic-w1-04-r6-live.mjs', when: new Date().toISOString(), commit: null, sections: (prior && prior.sections) || {}, findings: [] };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a git tree */ }
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

const SWEEP = (chunk) => {
  const H = window.__HARNESS;
  const rows = [];
  for (const id of chunk) {
    try {
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
      const r = H.enterInterior(id);
      if (!r || !r.entered) { rows.push({ id, skipped: r ? r.reason : 'no-result' }); continue; }
      H.stepFrames(2);
      H.exitInterior();
      const at = [];
      for (const [n, total] of [[1, 1], [29, 30], [90, 120], [480, 600]]) {
        H.stepFrames(n);
        const p = H.whereAmI().pos;
        const hit = H.buildingAt(p[0], p[2], 0);
        at.push({ f: total, pos: [+p[0].toFixed(2), +p[2].toFixed(2)], inside: hit ? hit.building : null });
      }
      rows.push({ id, at, entered: true });
    } catch (e) { rows.push({ id, error: String((e && e.message) || e) }); }
  }
  return rows;
};

const B = await launchGame({ width: 960, height: 600 });
const errs = [];
B.page.on('pageerror', (e) => errs.push(String(e)));
await B.page.evaluate(() => window.__HARNESS.setRenderRate(0));

try {
  const ids = await B.page.evaluate((cap) => {
    const l = window.__HARNESS.listInteriors().map((i) => i.id);
    return cap ? l.slice(0, cap) : l;
  }, CAP);
  out.doors = ids.length;
  save();
  console.log(`${ids.length} interiors`);

  /* ---- L1 ---------------------------------------------------------------------------------- */
  if (want('L1')) {
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      rows.push(...await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK)));
      out.sections.L1 = { partial: true, rows_so_far: rows.length }; save();
      process.stdout.write(`  L1 ${rows.length}/${ids.length}\r`);
    }
    const done = rows.filter((r) => r.entered);
    const insideAt = (f) => done.filter((r) => (r.at.find((a) => a.f === f) || {}).inside);
    out.sections.L1 = {
      what: 'where the body stands 1/30/120/600 fixed steps after exitInterior(), independently measured',
      doors_tested: done.length,
      inside: { 1: insideAt(1).length, 30: insideAt(30).length, 120: insideAt(120).length, 600: insideAt(600).length },
      indoors_at_600: insideAt(600).map((r) => ({ left: r.id, ends_in: r.at[3].inside })),
      moved_more_than_0_25m: done.filter((r) => Math.hypot(r.at[0].pos[0] - r.at[3].pos[0], r.at[0].pos[1] - r.at[3].pos[1]) > 0.25).length,
      rows,
    };
    save();
    console.log(`\nL1  ${done.length} doors; inside at 1/30/120/600 = ${insideAt(1).length}/${insideAt(30).length}/${insideAt(120).length}/${insideAt(600).length}`);
    for (const f of [1, 30, 120, 600]) if (insideAt(f).length) out.findings.push(`L1: ${insideAt(f).length} bodies inside a drawn building ${f} fixed steps after the door`);
  }

  /* ---- L2: rule 8, pushed ------------------------------------------------------------------- */
  if (want('L2')) {
    // The sample is CHOSEN, and says so: the ten the round-5 verdict found indoors, the five whose
    // entry side round 6 rotated, the five slid furthest along their wall, and ten more taken at a
    // fixed stride so the sample is not only the interesting ones.
    const chosen = [
      'archon-market', 'gideon-house-0', 'gideon-tollhouse', 'helstrom-house-10', 'helstrom-house-11',
      'helstrom-house-2', 'helstrom-house-6', 'lilmoth-house-2', 'lilmoth-market', 'thorn-inn',
      'soulrest-grey-hist', 'soulrest-boneyard', 'thorn-hall',
      'gideon-shrine', 'lilmoth-market', 'lilmoth-customs', 'gideon-house-0', 'lilmoth-house-3',
    ];
    const sample = [...new Set(chosen.filter((id) => ids.includes(id)).concat(ids.filter((_, i) => i % 12 === 0)))];
    const STRESS = (chunk) => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const rows = [];
      const where = () => { const p = H.whereAmI().pos; const b = H.buildingAt(p[0], p[2], 0); return { pos: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)], inside: b ? b.building : null }; };
      const leave = (id) => {
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        const r = H.enterInterior(id);
        if (!r || !r.entered) return null;
        H.stepFrames(2); H.exitInterior(); H.stepFrames(1);
        return true;
      };
      for (const id of chunk) {
        const row = { id, arms: {} };
        try {
          // a — the control: leave and stand.
          if (!leave(id)) { row.skipped = true; rows.push(row); continue; }
          H.stepFrames(599); row.arms.a_leave_and_stand = where();
          const doorstep = row.arms.a_leave_and_stand.pos.slice();

          // b — walk away 60 m and come back. The town collision cell is rebuilt when the body
          // moves 8 m, so this is the streaming path and not a re-run of the same state.
          if (!leave(id)) { rows.push(row); continue; }
          H.stepFrames(1);
          const away = H.whereAmI().pos;
          H.teleport(away[0] + 60, away[2] + 60); H.stepFrames(60);
          H.teleport(doorstep[0], doorstep[2], { y: doorstep[1] }); H.stepFrames(600);
          row.arms.b_walk_away_and_back = where();

          // c — save and load, then let it run. Rule 7: audit the running world after a load.
          if (!leave(id)) { rows.push(row); continue; }
          H.stepFrames(1);
          const blob = H.saveState();
          H.restoreState(blob);
          H.stepFrames(600);
          row.arms.c_save_and_load = where();

          // d — five round trips.
          for (let k = 0; k < 5; k++) if (!leave(id)) break;
          H.stepFrames(600);
          row.arms.d_five_round_trips = where();

          // e — PUSHED IN. Put the body 2 m towards the centre of the building it just left and
          // let the solver have it. The round measured LEAVING; this is being shoved.
          if (!leave(id)) { rows.push(row); continue; }
          H.stepFrames(1);
          const p0 = H.whereAmI().pos;
          const hit0 = H.buildingAt(p0[0], p0[2], 0);
          let bx = null, bz = null;
          for (const plan of (E.renderer.province.settlementPlans || [])) {
            const b = plan.buildings.find((x) => x.interior === id);
            if (b) { bx = b.x; bz = b.z; break; }
          }
          if (bx !== null) {
            const L = Math.hypot(bx - p0[0], bz - p0[2]) || 1;
            H.teleport(p0[0] + (bx - p0[0]) / L * 2, p0[2] + (bz - p0[2]) / L * 2, { y: p0[1] });
            H.stepFrames(600);
            row.arms.e_pushed_2m_into_the_building = { ...where(), building_centre: [+bx.toFixed(2), +bz.toFixed(2)], was_outside: !hit0 };
          }

          // f — stand IN the doorway, on the door point itself.
          let door = null;
          for (const plan of (E.renderer.province.settlementPlans || [])) {
            const b = plan.buildings.find((x) => x.interior === id);
            if (b && b.door) { door = b.door.slice(); break; }
          }
          if (door) {
            if (!leave(id)) { rows.push(row); continue; }
            H.stepFrames(1);
            const y = H.whereAmI().pos[1];
            H.teleport(door[0], door[2], { y });
            H.stepFrames(600);
            row.arms.f_stand_in_the_doorway = where();
          }

          // g — an NPC on top of the body.
          if (!leave(id)) { rows.push(row); continue; }
          H.stepFrames(1);
          const pg = H.whereAmI().pos;
          const sp = H.spawn('inf_trash', pg[0], pg[2]);
          const eid = sp && (sp.eid || sp.id || (typeof sp === 'string' ? sp : null));
          H.stepFrames(600);
          row.arms.g_npc_on_top = where();
          if (eid) { try { H.despawn(eid); } catch (e) { row.despawn_error = String(e && e.message); } }
          H.stepFrames(1);
        } catch (e) { row.error = String((e && e.message) || e); }
        rows.push(row);
      }
      return rows;
    };
    const rows = [];
    for (let i = 0; i < sample.length; i += 4) {
      rows.push(...await B.page.evaluate(STRESS, sample.slice(i, i + 4)));
      out.sections.L2 = { partial: true, rows_so_far: rows.length }; save();
      process.stdout.write(`  L2 ${rows.length}/${sample.length}\r`);
    }
    const armNames = ['a_leave_and_stand', 'b_walk_away_and_back', 'c_save_and_load', 'd_five_round_trips', 'e_pushed_2m_into_the_building', 'f_stand_in_the_doorway', 'g_npc_on_top'];
    const tally = {};
    for (const a of armNames) tally[a] = { tested: 0, inside_a_building: 0, rooms: [] };
    for (const r of rows) for (const a of armNames) {
      const v = r.arms && r.arms[a];
      if (!v) continue;
      tally[a].tested++;
      if (v.inside) { tally[a].inside_a_building++; tally[a].rooms.push({ door: r.id, ends_in: v.inside }); }
    }
    // Does an arm land somewhere the control does not?
    const disagree = [];
    for (const r of rows) {
      const c = r.arms && r.arms.a_leave_and_stand;
      if (!c) continue;
      for (const a of armNames.slice(1)) {
        const v = r.arms[a];
        if (!v) continue;
        const d = Math.hypot(v.pos[0] - c.pos[0], v.pos[2] - c.pos[2]);
        if (d > 0.25) disagree.push({ door: r.id, arm: a, moved_from_the_control_m: +d.toFixed(2), inside: v.inside });
      }
    }
    out.sections.L2 = { what: 'seven ways to be standing on a doorstep, all read through buildingAt() at 600 fixed steps', sample: sample.length, tally, arms_that_land_more_than_0_25m_from_the_control: disagree, rows };
    save();
    for (const a of armNames) console.log(`L2  ${a}: ${tally[a].inside_a_building}/${tally[a].tested} inside a building`);
    for (const a of armNames) if (tally[a].inside_a_building) out.findings.push(`L2: arm ${a} leaves ${tally[a].inside_a_building} of ${tally[a].tested} bodies inside a building at 600 frames`);
  }

  /* ---- L3: the other end of the door -------------------------------------------------------- */
  if (want('L3')) {
    const res = await B.page.evaluate(() => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const rows = [];
      const recs = E.data.interiors;
      const list = H.listInteriors().map((i) => i.id);
      for (const id of list) {
        const rec = recs[id];
        const cont = rec && rec.continuity;
        if (!cont || !cont.bounds && !rec.bounds_m) { /* keep going */ }
        const side = (cont && cont.entry_side) || 'south';
        const dcl = cont && cont.entry_side_declared;
        const bounds = rec && rec.bounds_m;
        const spawn = cont && cont.interior_spawn;
        if (!bounds || !spawn) { rows.push({ id, skipped: 'no bounds or spawn' }); continue; }
        const mx = (bounds.x[0] + bounds.x[1]) / 2, mz = (bounds.z[0] + bounds.z[1]) / 2;
        // Where `render/interior.js` draws the doorway: the MIDDLE of the wall `entry_side` names.
        const at = side === 'north' ? [mx, bounds.z[0]] : side === 'south' ? [mx, bounds.z[1]] : side === 'west' ? [bounds.x[0], mz] : [bounds.x[1], mz];
        const dist = Math.hypot(spawn[0] - at[0], spawn[2] - at[1]);
        const row = { id, entry_side: side, entry_side_declared: dcl === undefined ? null : dcl, rotated: dcl !== undefined && dcl !== null && dcl !== side, spawn_to_drawn_doorway_m: +dist.toFixed(2) };
        // Only exercise the interesting ones live: every rotated door, and a control.
        if (row.rotated || dist > 2.6 || list.indexOf(id) % 25 === 0) {
          try {
            const r = H.enterInterior(id);
            if (r && r.entered) {
              H.stepFrames(2);
              row.way_out_at_the_spawn = !!(H.whereAmI().door && H.whereAmI().door.way === 'out');
              // Now stand AT THE DOORWAY YOU CAN SEE, a metre inside it.
              const inward = side === 'north' ? [0, 1] : side === 'south' ? [0, -1] : side === 'west' ? [1, 0] : [-1, 0];
              H.teleport(at[0] + inward[0], at[1] + inward[1], { y: spawn[1] });
              H.stepFrames(2);
              const w = H.whereAmI();
              row.way_out_at_the_drawn_doorway = !!(w.door && w.door.way === 'out');
              // And press it, which is the only honest test.
              H.clearInputs();
              H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
              H.stepFrames(8);
              row.left_by_pressing_at_the_drawn_doorway = !H.whereAmI().interior;
            } else row.enter_failed = r ? r.reason : 'no result';
          } catch (e) { row.error = String((e && e.message) || e); }
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        }
        rows.push(row);
      }
      return rows;
    });
    const tested = res.filter((r) => r.left_by_pressing_at_the_drawn_doorway !== undefined);
    const cannot = tested.filter((r) => !r.left_by_pressing_at_the_drawn_doorway);
    out.sections.L3 = {
      what: 'stand at the doorway render/interior.js DRAWS and press interact — can you leave through the door you can see?',
      why: 'round 6 rotates five entry sides, which moves the drawn interior doorway. continuity.interior_spawn is only clamped, never re-derived, and sim/settlement.js offers the way OUT within DOOR_REACH_M of interior_spawn.',
      interiors: res.length,
      spawn_more_than_DOOR_REACH_from_the_drawn_doorway: res.filter((r) => r.spawn_to_drawn_doorway_m > 2.6).map((r) => ({ id: r.id, m: r.spawn_to_drawn_doorway_m, rotated: r.rotated })),
      tested_by_pressing: tested.length,
      could_not_leave_through_the_drawn_doorway: cannot.map((r) => ({ id: r.id, rotated: r.rotated, spawn_to_drawn_doorway_m: r.spawn_to_drawn_doorway_m })),
      rows: res,
    };
    save();
    console.log(`L3  ${tested.length} pressed at the drawn doorway; ${cannot.length} could not leave through it`);
    if (cannot.length) out.findings.push(`L3: ${cannot.length} interiors cannot be left through the doorway that is drawn in their wall`);
  }

  /* ---- L4: re-entry ------------------------------------------------------------------------- */
  if (want('L4')) {
    const REENTER = (chunk) => {
      const H = window.__HARNESS;
      const rows = [];
      for (const id of chunk) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) { rows.push({ id, skipped: r ? r.reason : 'no-result' }); continue; }
          H.stepFrames(2); H.exitInterior(); H.stepFrames(2);
          H.clearInputs();
          H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
          H.stepFrames(8);
          const after = H.whereAmI();
          rows.push({ id, landed_in: after.interior || null, own: after.interior === id });
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        } catch (e) { rows.push({ id, error: String((e && e.message) || e) }); }
      }
      return rows;
    };
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      rows.push(...await B.page.evaluate(REENTER, ids.slice(i, i + CHUNK)));
      out.sections.L4 = { partial: true, rows_so_far: rows.length }; save();
      process.stdout.write(`  L4 ${rows.length}/${ids.length}\r`);
    }
    const done = rows.filter((r) => !r.skipped && !r.error);
    out.sections.L4 = {
      what: 'press interact on the doorstep and read which room the body is in',
      tested: done.length,
      back_in_the_room_you_left: done.filter((r) => r.own).length,
      a_different_room: done.filter((r) => r.landed_in && !r.own).map((r) => ({ id: r.id, landed_in: r.landed_in })),
      nothing: done.filter((r) => !r.landed_in).map((r) => r.id),
      rows,
    };
    save();
    console.log(`\nL4  ${done.filter((r) => r.own).length}/${done.length} back into the room they left`);
  }

  out.page_errors = errs;
  save();
} finally {
  await B.close();
}
console.log(`-> reports/critic-w1-04-r6/live.json`);
for (const f of out.findings) console.error(`FINDING: ${f}`);
