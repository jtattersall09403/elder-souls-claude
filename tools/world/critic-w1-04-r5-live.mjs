#!/usr/bin/env node
/*
 * W1-04 ROUND-5 CRITIC — the live instrument. ONE BROWSER, launched here and kept.
 * Never `pkill -f headless_shell`; the run kills its own child by pid if it must.
 *
 * The round's headline is "115 doors, 0 bodies inside a building, one frame after the door".
 * This reproduces it and then pushes past it in three directions the round's own tool does not:
 *
 *   L1  THE SWEEP, MINE. Enter, step, exit, step ONE frame, `whereAmI().pos` + `buildingAt()`.
 *       Written from the harness surface, not adapted from `w1-04-r5-live.mjs`.
 *
 *   L2  DOES IT STAY THERE? One frame is the round's bar. A body that is ejected clean on frame 1
 *       and slides under a roof by frame 600 is the same defect on a longer clock. Same doors,
 *       read at 1, 30, 120 and 600 fixed steps after the door.
 *
 *   L3  RE-ENTRY, THROUGH THE INPUT. The round measures `whereAmI().door_in_reach` and counts it
 *       truthy: 106 of 115. But `sim/settlement.js#doorAt()` returns the NEAREST door of the town
 *       within `DOOR_REACH_M`, and `stepSettlement()` hands THAT interior to `useDoor()`. So the
 *       question a player asks — "can I go back in the door I came out of" — is answered by
 *       pressing `interact` on the doorstep and reading which room you are standing in. That is
 *       what this does: `queueInputs([{press:['interact']}])`, the real latch, not a verb that
 *       teleports past the reach gate. `enterInterior()` calls `useDoor()` directly and CANNOT
 *       fail this test, which is why it is not used here.
 *
 *   L4  CONSUMPTION AT AN ENTITY (rule 5 / ARBITRATION §3), for the lamp fix. The round verifies
 *       it at `lightSourceCensus()`, which is a census of the same LightField the step samples —
 *       the right object. This goes one link further and perturbs a lamp while an ENEMY is in the
 *       room, then reads that enemy's alert meter. A number a census reports is not a behaviour.
 *
 * WRITE AFTER EVERY CHUNK (rule 2). Chunked in eights; a run that dies at door 90 published 88.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/critic-w1-04-r5');
fs.mkdirSync(OUT, { recursive: true });

const ARG = process.argv.slice(2);
const argOf = (f, d) => { const i = ARG.indexOf(f); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = argOf('--only', null);
const CAP = Number(argOf('--doors', '0')) || 0;
const CHUNK = 8;

const out = {
  tool: 'tools/world/critic-w1-04-r5-live.mjs',
  when: new Date().toISOString(),
  commit: process.env.CRITIC_COMMIT || null,
  sections: {}, findings: [],
};
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

const want = (k) => !ONLY || ONLY.split(',').includes(k);

const B = await launchGame({ width: 960, height: 600 });
const errs = [];
B.page.on('pageerror', (e) => errs.push(String(e)));
// Nothing below is read off a rendered frame — positions come from the fixed step, buildings from
// the plan. So the render rate goes to zero and only the fixed step is paid for. Stated out loud:
// if any number here were read off the picture, this line would silently break it.
await B.page.evaluate(() => window.__HARNESS.setRenderRate(0));

try {
  const ids = await B.page.evaluate((cap) => {
    const H = window.__HARNESS;
    const l = H.listInteriors().map((i) => i.id);
    return cap ? l.slice(0, cap) : l;
  }, CAP);
  out.doors = ids.length;
  save();
  console.log(`${ids.length} interiors from listInteriors()`);

  /* ---- L1 + L2: the sweep and the settle -----------------------------------------------------*/
  if (want('L1')) {
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
          // 1, then 30, then 120, then 600 fixed steps after the door.
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
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      rows.push(...await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK)));
      out.sections.L1_L2 = { partial: true, rows_so_far: rows.length };
      save();
      process.stdout.write(`  L1/L2 ${rows.length}/${ids.length}\r`);
    }
    const done = rows.filter((r) => r.entered);
    const insideAt = (f) => done.filter((r) => (r.at.find((a) => a.f === f) || {}).inside).length;
    const movedAfter1 = done.filter((r) => {
      const a = r.at[0], d = r.at[3];
      return Math.hypot(a.pos[0] - d.pos[0], a.pos[1] - d.pos[1]) > 0.25;
    });
    out.sections.L1_L2 = {
      what: 'where the body stands 1, 30, 120 and 600 fixed steps after the door',
      doors_tested: done.length, skipped: rows.length - done.length,
      inside_a_building_at_1_frame: insideAt(1),
      inside_a_building_at_30_frames: insideAt(30),
      inside_a_building_at_120_frames: insideAt(120),
      inside_a_building_at_600_frames: insideAt(600),
      bodies_that_moved_more_than_0_25m_between_frame_1_and_600: movedAfter1.length,
      movers: movedAfter1.slice(0, 12).map((r) => ({ id: r.id, at: r.at })),
      rows,
    };
    save();
    console.log(`\nL1  ${done.length} doors; inside a building at 1/30/120/600 frames: ${insideAt(1)}/${insideAt(30)}/${insideAt(120)}/${insideAt(600)}`);
    console.log(`L2  bodies that moved >0.25 m between frame 1 and frame 600: ${movedAfter1.length}`);
    if (insideAt(1)) out.findings.push(`L1: ${insideAt(1)} bodies inside a building one frame after the door`);
    if (insideAt(600) > insideAt(1)) out.findings.push(`L2: ${insideAt(600)} bodies inside a building after 600 frames, against ${insideAt(1)} after one — the body settles somewhere worse than where it is put`);
  }

  /* ---- L3: re-entry through the real input latch ---------------------------------------------*/
  if (want('L3')) {
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
      out.sections.L3_reentry = { partial: true, rows_so_far: rows.length };
      save();
      process.stdout.write(`  L3 ${rows.length}/${ids.length}\r`);
    }
    const done = rows.filter((r) => r.door_in_reach !== undefined && !r.skipped && !r.error);
    const back = done.filter((r) => r.back_in_the_room_you_left).length;
    const wrong = done.filter((r) => r.landed_somewhere_else);
    const stuck = done.filter((r) => !r.landed_in);
    out.sections.L3_reentry = {
      what: 'press `interact` on the doorstep and read which room the body is standing in eight frames later',
      doors_tested: done.length,
      back_in_the_room_you_left: back,
      LANDED_IN_A_DIFFERENT_ROOM: wrong.length,
      could_not_get_in_at_all: stuck.length,
      wrong_room_rows: wrong,
      stuck_rows: stuck.map((r) => r.id),
      rows,
    };
    save();
    console.log(`\nL3  ${done.length} doorsteps: ${back} press-interact back into the room they left, ${wrong.length} into a DIFFERENT room, ${stuck.length} into nothing`);
    if (wrong.length) out.findings.push(`L3: pressing interact on ${wrong.length} of ${done.length} doorsteps enters a DIFFERENT building from the one just left`);
    if (stuck.length) out.findings.push(`L3: ${stuck.length} of ${done.length} doorsteps cannot re-enter any door at all`);
  }

  /* ---- L4: CONSUMPTION at an entity ------------------------------------------------------------*/
  if (want('L4')) {
    const res = await B.page.evaluate(() => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const report = { candidates: [], chosen: null, arms: [] };
      // A room with lamps and space. Pick the first with >=3 lights.
      let pick = null;
      for (const i of H.listInteriors()) {
        const rec = E.data.interiors[i.id];
        if (rec && (rec.lights || []).length >= 3) { pick = i.id; break; }
      }
      if (!pick) return { error: 'no interior with 3+ lights' };
      report.chosen = pick;
      const rec = E.data.interiors[pick];

      const runArm = (label, mutate, undo) => {
        // Leave and re-enter, because syncInteriorLights() rebuilds only on a CELL CHANGE — a
        // perturbation applied while standing in the room would not be read until you left it.
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); }
        if (mutate) mutate();
        H.enterInterior(pick);
        H.stepFrames(2);
        const w = H.whereAmI();
        const p = w.pos;
        // An enemy in the room, two metres away, facing the player.
        const spawned = H.spawn('inf_trash', p[0] + 2.0, p[2]);
        // POINT IT AT THE PLAYER. `stepPerception()` gates the sight channel on
        // `Math.abs(per.bearing_deg) > e.sight_cone_deg / 2`, so an enemy spawned with the
        // default yaw is facing away and falls through to hearing — and a still player makes no
        // sound, so its meter stays 0 whatever the lamps do. My first run of this section read
        // alert 0 in every arm for exactly that reason and I nearly published it as a finding
        // about the build (rule 4). The yaw is set here, and the player is given a motion band,
        // so the arms differ in the LAMPS and in nothing else.
        const ent = E.sim.entities[E.sim.entities.length - 1];
        if (ent) ent.yaw = Math.atan2(p[0] - ent.pos[0], p[2] - ent.pos[2]);
        if (H.setPlayerMotion) { try { H.setPlayerMotion('walk'); } catch (_) { /* */ } }
        H.stepFrames(120);
        const st = H.getStealthState ? H.getStealthState() : null;
        const per = H.perceptionState();
        const light = H.getLightAt(p[0], p[1] + 1.35, p[2]);
        const census = E.sim.stealth.lightSourceCensus();
        const row = {
          arm: label,
          spawned: !!spawned,
          L_at_the_body: typeof light === 'number' ? +light.toFixed(4) : light,
          V: st ? st.V : null,
          world_light_sources: census.world_sources,
          entities: per.length,
          enemy_alert: per.length ? per[0].alert : null,
          enemy_alert_state: per.length ? per[0].alert_state : null,
          enemy_dist_m: per.length ? per[0].dist_m : null,
          enemy_los: per.length ? per[0].los : null,
          enemy_channel: per.length ? per[0].alert_channel : null,
        };
        report.arms.push(row);
        // Clear the room for the next arm.
        for (const e of per) { try { H.despawn(e.eid); } catch (_) { /* */ } }
        if (undo) undo();
        return row;
      };

      // ARM 1 — as shipped.
      runArm('lamps as the derivation leaves them', null, null);
      // ARM 2 — walk every lamp 60 m away. Same record objects syncInteriorLights() reads.
      const saved = (rec.lights || []).map((L) => L.pos.slice());
      runArm('every lamp in the room moved 60 m away',
        () => { for (const L of rec.lights || []) L.pos = [L.pos[0] + 60, L.pos[1], L.pos[2]]; },
        () => { (rec.lights || []).forEach((L, i) => { L.pos = saved[i].slice(); }); });
      // ARM 3 — back to shipped, to prove the change was the lamps and not the clock.
      runArm('lamps restored', null, null);
      return report;
    });
    out.sections.L4_consumption_at_an_entity = res;
    save();
    console.log(`\nL4  ${res.chosen || res.error}`);
    for (const a of res.arms || []) console.log(`    ${a.arm}: L=${a.L_at_the_body} V=${a.V} sources=${a.world_light_sources} enemy_alert=${a.enemy_alert} (${a.enemy_alert_state}) entities=${a.entities}`);
    const arms = res.arms || [];
    if (arms.length >= 2 && arms[0].enemy_alert !== null && arms[0].enemy_alert === arms[1].enemy_alert) {
      out.findings.push('L4: moving every lamp 60 m did not change the enemy alert meter — the lamp model reaches the light field but not, demonstrably, an entity');
    }
  }

  out.page_errors = errs.slice(0, 10);
  save();
  console.log('');
  for (const f of out.findings) console.log(`  ! ${f}`);
  console.log(`  -> reports/critic-w1-04-r5/live.json`);
} finally {
  await B.close();
}
process.exit(0);
