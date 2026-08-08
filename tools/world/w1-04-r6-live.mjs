#!/usr/bin/env node
/*
 * W1-04 ROUND 6 — THE LIVE INSTRUMENT. ONE BROWSER, launched here and kept.
 * Never `pkill -f headless_shell`; this run kills its own child by pid if it must.
 *
 * FOUR SECTIONS, and each answers a question the round-5 verdict says was answered at the wrong
 * instant or with the wrong predicate.
 *
 *   L1  DOES THE BODY STAY OUTSIDE? Round 5 read `buildingAt()` ONE fixed frame after the door and
 *       got 0 of 115. At 30, 120 and 600 the same doors gave 8, 10 and 10: the collision solver
 *       slides the body out of a wall slab and it comes to rest inside a neighbour. RULES rule 8,
 *       amended for this piece — "one instant is a still target in time". So the number is taken at
 *       1, 30, 120 AND 600 fixed steps and all four are published, every run, whatever they say.
 *
 *   L2  RE-ENTRY, THROUGH THE REAL LATCH. `whereAmI().door_in_reach` is truthy whenever ANY door of
 *       the town is within `DOOR_REACH_M`, because `doorAt()` returns the NEAREST one. The question
 *       a player asks is "can I go back in the door I came out of", and the only honest way to ask
 *       it is to press `interact` on the doorstep and read which room the body is standing in.
 *       `enterInterior()` calls `useDoor()` directly and CANNOT fail this test, which is why it is
 *       not used for the answer — only to get into the room in the first place.
 *
 *   L3  CONSUMPTION (RI-MTH07, ARBITRATION §3) FOR THE DOORSTEP MODEL, AT THE BODY. The consumer is
 *       `sim/settlement.js#leaveInterior()` -> `placeBody()` -> `combat.player.pos`, and then
 *       `sim/world-collision.js#stepWorldCollision()`. Perturbed LIVE, on the running records, by
 *       restoring `continuity.exterior_spawn_declared` — and then restored, and the numbers must
 *       come back. A model whose perturbation does not move the body is not consumed.
 *
 *   L4  CONSUMPTION FOR THE DOORWAY, AT AN ENTITY THAT IS NOT THE PLAYER. Five buildings had their
 *       entry side rotated, which moves the HOLE in the collision wall as well as the door. So an
 *       enemy is walked at the new doorway and at the wall where the old one was, in the same
 *       building, in the same frame budget: it should get through one and be stopped by the other.
 *       If the drawn door and the collision gap had come apart, this is where it shows.
 *
 * WRITE AFTER EVERY CHUNK (rule 2). Chunked in eights; a run that dies at door 90 publishes 88.
 * `setRenderRate(0)`: nothing here is read off a rendered frame — positions come from the fixed
 * step and buildings from the plan — so only the fixed step is paid for. Stated out loud because
 * if any number here WERE read off the picture, that line would silently break it.
 *
 *   node tools/world/w1-04-r6-live.mjs [--only L1,L2,L3,L4] [--doors N]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/w1-04-r6');
fs.mkdirSync(OUT, { recursive: true });

const ARG = process.argv.slice(2);
const argOf = (f, d) => { const i = ARG.indexOf(f); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = argOf('--only', null);
const CAP = Number(argOf('--doors', '0')) || 0;
const CHUNK = 8;
const want = (k) => !ONLY || ONLY.split(',').includes(k);

// Sections accumulate across runs, so `--only L3,L4` does not throw away an L1 sweep that already
// cost 115 doors of stepping. Every section carries its own `when`.
let prior = {};
try { prior = JSON.parse(fs.readFileSync(path.join(OUT, 'live.json'), 'utf8')); } catch { /* first run */ }
const out = { tool: 'tools/world/w1-04-r6-live.mjs', when: new Date().toISOString(), commit: null, sections: (prior && prior.sections) || {}, findings: [] };
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a git tree */ }
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

/* THE SWEEP, as a function of the page, so L1 and L3 run the IDENTICAL code on both arms. */
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
        const w = H.whereAmI();
        const p = w.pos;
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

const settleSummary = (rows) => {
  const done = rows.filter((r) => r.entered);
  const insideAt = (f) => done.filter((r) => (r.at.find((a) => a.f === f) || {}).inside).length;
  return {
    doors_tested: done.length, skipped: rows.length - done.length,
    inside_a_building_at_1_frame: insideAt(1),
    inside_a_building_at_30_frames: insideAt(30),
    inside_a_building_at_120_frames: insideAt(120),
    inside_a_building_at_600_frames: insideAt(600),
    moved_more_than_0_25m_between_1_and_600: done.filter((r) => Math.hypot(r.at[0].pos[0] - r.at[3].pos[0], r.at[0].pos[1] - r.at[3].pos[1]) > 0.25).length,
    indoors_at_600: done.filter((r) => r.at[3].inside).map((r) => ({ left: r.id, ends_up_in: r.at[3].inside })),
  };
};

try {
  const ids = await B.page.evaluate((cap) => {
    const l = window.__HARNESS.listInteriors().map((i) => i.id);
    return cap ? l.slice(0, cap) : l;
  }, CAP);
  out.doors = ids.length;
  save();
  console.log(`${ids.length} interiors from listInteriors()`);

  /* ---- L1: does the body stay outside, at four step counts ------------------------------------*/
  if (want('L1')) {
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      rows.push(...await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK)));
      out.sections.L1_settle = { partial: true, rows_so_far: rows.length };
      save();
      process.stdout.write(`  L1 ${rows.length}/${ids.length}\r`);
    }
    const s = settleSummary(rows);
    out.sections.L1_settle = {
      what: 'where the body stands 1, 30, 120 and 600 fixed steps after exitInterior(), read off buildingAt()',
      why_four: 'RULES rule 8: one instant is a still target in time. Round 5 published the frame at which its number was zero.',
      ...s, rows,
    };
    save();
    console.log(`\nL1  ${s.doors_tested} doors; inside a building at 1/30/120/600 frames: ${s.inside_a_building_at_1_frame}/${s.inside_a_building_at_30_frames}/${s.inside_a_building_at_120_frames}/${s.inside_a_building_at_600_frames}`);
    for (const k of [1, 30, 120, 600]) {
      const n = s[`inside_a_building_at_${k}_frame${k === 1 ? '' : 's'}`];
      if (n) out.findings.push(`L1: ${n} bodies inside a drawn building ${k} fixed steps after the door`);
    }
  }

  /* ---- L2: re-entry through the real latch ----------------------------------------------------*/
  if (want('L2')) {
    const REENTER = (chunk) => {
      const H = window.__HARNESS;
      const rows = [];
      for (const id of chunk) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) { rows.push({ id, skipped: r ? r.reason : 'no-result' }); continue; }
          H.stepFrames(2);
          H.exitInterior();
          H.stepFrames(2);
          const w = H.whereAmI();
          const reach = w.door_in_reach || null;
          // THE REAL LATCH. `stepSettlement()` reads `input.pressedName('interact')` and hands
          // `sim.door.interior` to `useDoor()`. No harness verb short-circuits it.
          H.clearInputs();
          H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
          H.stepFrames(8);
          const after = H.whereAmI();
          rows.push({
            id,
            door_in_reach: reach ? reach.interior : null,
            dist_m: reach ? reach.dist_m : null,
            landed_in: after.interior || null,
            back_in_the_room_you_left: after.interior === id,
            landed_somewhere_else: !!(after.interior && after.interior !== id),
          });
          if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        } catch (e) { rows.push({ id, error: String((e && e.message) || e) }); }
      }
      return rows;
    };
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      rows.push(...await B.page.evaluate(REENTER, ids.slice(i, i + CHUNK)));
      out.sections.L2_reentry = { partial: true, rows_so_far: rows.length };
      save();
      process.stdout.write(`  L2 ${rows.length}/${ids.length}\r`);
    }
    const done = rows.filter((r) => !r.skipped && !r.error);
    const back = done.filter((r) => r.back_in_the_room_you_left).length;
    const wrong = done.filter((r) => r.landed_somewhere_else);
    const stuck = done.filter((r) => !r.landed_in);
    out.sections.L2_reentry = {
      what: 'press `interact` on the doorstep and read which room the body is standing in eight frames later',
      doors_tested: done.length,
      back_in_the_room_you_left: back,
      LANDED_IN_A_DIFFERENT_ROOM: wrong.length,
      could_not_get_in_at_all: stuck.length,
      wrong_room_rows: wrong, stuck_rows: stuck.map((r) => r.id), rows,
    };
    save();
    console.log(`\nL2  ${done.length} doorsteps: ${back} back into the room they left, ${wrong.length} into a DIFFERENT room, ${stuck.length} into nothing`);
  }

  /* ---- L3: CONSUMPTION for the doorstep model, at the body ------------------------------------*/
  if (want('L3')) {
    const CUT = () => {
      const E = window.__ENGINE;
      let n = 0;
      for (const id of Object.keys(E.data.interiors)) {
        const c = E.data.interiors[id].continuity;
        if (c && c.exterior_spawn_declared) { c.exterior_spawn = c.exterior_spawn_declared.slice(); n++; }
      }
      return n;
    };
    // The perturbation is on the records the sim reads by reference, so nothing has to be rebuilt;
    // `leaveInterior()` reads `continuity.exterior_spawn` on the frame it fires.
    const cutCount = await B.page.evaluate(CUT);
    const cutRows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      cutRows.push(...await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK)));
      process.stdout.write(`  L3 cut arm ${cutRows.length}/${ids.length}\r`);
    }
    const cut = settleSummary(cutRows);
    out.sections.L3_consumption = { partial: true, perturbed_records: cutCount, cut_arm: cut };
    save();
    // ---- and put it back. A perturbation that cannot be undone is not a control.
    const REDERIVE = () => {
      const E = window.__ENGINE;
      const P = E.renderer && E.renderer.province;
      if (!P) return { error: 'no province' };
      const EXmod = P.__exteriorModule || null;
      return { rebuilt: !!EXmod };
    };
    // `setSettlements()` is the one production caller of `applyInteriorBounds()`; re-running the
    // boot path is not available from the harness, so the restore replays the derived values that
    // this run recorded before it perturbed them.
    void REDERIVE;
    const restoreCount = await B.page.evaluate((saved) => {
      const E = window.__ENGINE;
      let n = 0;
      for (const id of Object.keys(saved)) {
        const c = E.data.interiors[id] && E.data.interiors[id].continuity;
        if (c) { c.exterior_spawn = saved[id].slice(); n++; }
      }
      return n;
    }, await (async () => {
      // Read the derived values back from the FIRST arm's own artifact rather than from a variable
      // in the page, so the restore is a fact about what was measured and not about what was kept.
      const l1 = out.sections.L1_settle;
      const map = {};
      if (l1 && l1.rows) for (const r of l1.rows) if (r.entered) map[r.id] = [r.at[0].pos[0], 0, r.at[0].pos[1]];
      return map;
    })());
    const backRows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      backRows.push(...await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK)));
      process.stdout.write(`  L3 restored arm ${backRows.length}/${ids.length}\r`);
    }
    const restored = settleSummary(backRows);
    out.sections.L3_consumption = {
      what: 'CONSUMPTION (RI-MTH07): perturb continuity.exterior_spawn on the LIVE records and watch the body move',
      consumer: 'sim/settlement.js#leaveInterior() -> placeBody() -> combat.player.pos, then sim/world-collision.js#stepWorldCollision()',
      perturbed_records: cutCount, restored_records: restoreCount,
      cut_arm: cut, restored_arm: restored,
      note: 'the restored arm replays the DERIVED doorsteps this run measured in L1 (y is taken from the ground under the body, so only x/z are restored); it is a re-perturbation back to the derived value, not a re-run of the boot derivation.',
    };
    save();
    console.log(`\nL3  cut arm: inside at 1/30/120/600 = ${cut.inside_a_building_at_1_frame}/${cut.inside_a_building_at_30_frames}/${cut.inside_a_building_at_120_frames}/${cut.inside_a_building_at_600_frames}`);
    console.log(`    restored:  inside at 1/30/120/600 = ${restored.inside_a_building_at_1_frame}/${restored.inside_a_building_at_30_frames}/${restored.inside_a_building_at_120_frames}/${restored.inside_a_building_at_600_frames}`);
    if (cut.inside_a_building_at_120_frames === 0) out.findings.push('L3: perturbing the doorstep model changed nothing at the body — the model is NOT CONSUMED, or the control is inert');
  }

  /* ---- L4: CONSUMPTION for the doorway, at an entity that is not the player -------------------*/
  if (want('L4')) {
    const res = await B.page.evaluate(() => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const P = E.renderer && E.renderer.province;
      if (!P) return { error: 'no province renderer' };
      // The five buildings whose entry side this round rotated are the ones whose doorway HOLE
      // moved. Find them by asking the plan, not by naming them.
      const rot = [];
      for (const plan of P.settlementPlans || []) {
        for (const b of plan.buildings) {
          const rec = b.interior && E.data.interiors[b.interior];
          const dcl = rec && rec.continuity && rec.continuity.entry_side_declared;
          if (dcl !== undefined && b.entry_side !== dcl) rot.push({ settlement: plan.id, building: b.id, interior: b.interior, from: dcl, to: b.entry_side });
        }
      }
      if (!rot.length) return { error: 'no building had its entry side rotated' };
      const pick = rot[0];
      const rec = E.data.interiors[pick.interior];
      const spawn = rec.continuity.exterior_spawn;
      const out = { rotated: rot, chosen: pick, arms: [] };
      // Put an ENEMY on the doorstep and let the fixed step's world collision act on it. Then put
      // the same enemy where the doorway used to be — the middle of the OLD entry wall — and do
      // the same. The doorway hole moved with the door, so one of those is open floor and the
      // other is masonry.
      const plan = (P.settlementPlans || []).find((p) => p.id === pick.settlement);
      const b = plan.buildings.find((x) => x.id === pick.building);
      const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
      const w = b.drawn_footprint_m[0], d = b.drawn_footprint_m[1];
      const compass = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
      const oldN = compass[pick.from] || [0, 1];
      // The middle of the OLD entry wall, 1.5 m out — where round 5 put the doorstep.
      const lx = oldN[0] * (w / 2), lz = oldN[1] * (d / 2);
      const oldWall = [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
      const oldStep = [oldWall[0] + oldN[0] * 1.5, oldWall[1] + oldN[1] * 1.5];

      H.teleport(spawn[0], spawn[1], spawn[2]);
      H.stepFrames(4);
      for (const [label, at] of [['the doorway this round derived', [spawn[0], spawn[2]]], ['the middle of the wall the door used to be in', oldStep]]) {
        // THE EID COMES FROM `spawn()`, NOT FROM THE END OF `listEntities()`.
        // My first run of this section took the last row of `listEntities()` and got
        // `mark:loc_the_works_camp` — a MAP MARKER, which is an entity too — then threw on
        // `despawn()`. It would have been a measurement of a marker's position if the id had
        // happened to be despawnable. Reported here rather than quietly fixed (RULES rule 4).
        const spawned = H.spawn('inf_trash', at[0], at[1]);
        const eid = spawned && (spawned.eid || spawned.id || (typeof spawned === 'string' ? spawned : null));
        H.stepFrames(6);
        const ent = H.listEntities().find((e) => e.eid === eid) || null;
        const moved = ent ? Math.hypot(ent.pos[0] - at[0], ent.pos[2] - at[1]) : null;
        out.arms.push({
          where: label, placed_at: [+at[0].toFixed(2), +at[1].toFixed(2)],
          entity: eid,
          rests_at: ent ? [+ent.pos[0].toFixed(2), +ent.pos[2].toFixed(2)] : null,
          pushed_out_by_m: moved === null ? null : +moved.toFixed(3),
          inside_a_building: ent ? (H.buildingAt(ent.pos[0], ent.pos[2], 0) || {}).building || null : null,
        });
        if (eid) { try { H.despawn(eid); } catch (e) { out.despawn_error = String(e && e.message); } }
        H.stepFrames(1);
      }
      return out;
    });
    out.sections.L4_doorway_at_an_entity = {
      what: 'an ENEMY body, solved by the same stepWorldCollision() the player is, standing on the derived doorstep and on the wall the door used to be in',
      why: 'the entry-side rotation moves the HOLE in the collision wall as well as the door. If the drawn door and the collision gap had come apart, an entity would be pushed out of one of these and not the other.',
      ...res,
    };
    save();
    if (res.arms) for (const a of res.arms) console.log(`L4  ${a.where}: pushed ${a.pushed_out_by_m} m, inside ${a.inside_a_building || 'nothing'}`);
    else console.log(`L4  ${res.error}`);
  }

  out.page_errors = errs;
  save();
} finally {
  await B.close();
}

console.log(`\n-> reports/w1-04-r6/live.json`);
if (out.findings.length) { for (const f of out.findings) console.error(`FINDING: ${f}`); process.exit(1); }
