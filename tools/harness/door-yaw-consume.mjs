#!/usr/bin/env node
// door-yaw-consume.mjs — RI-MTH07 CONSUMPTION for the door-facing fix, and the pictures with it.
//
// THE RULE (RULES.md rule 5, ARBITRATION.md §3): for every model you ship, NAME the world-side
// consumer and DEMONSTRATE it by perturbing the model and watching an entity change behaviour.
// Sixteen subsystems here have shipped a correct, instrumented model that nothing in the running
// world reads, so a field's existence is worth nothing until something is seen to move.
//
// WHAT IS BEING CONSUMED, named precisely:
//
//   PRODUCER  Engine._refineFacing(x, y, z, yaw) — asks the town or room collision set whether a
//             proposed facing clears, and returns the nearest one that does.
//   SEAM      sim.faceRefine, installed in the Engine constructor beside sim.placeBody /
//             sim.applyCell / sim.doorVeto.
//   CONSUMER  sim/settlement.js#refineFacing(), called by useDoor() and leaveInterior() — the two
//             functions stepSettlement() runs off the `interact` latch when a player opens a door.
//   ENTITY    the player. Three fields: sim.player.yaw (a mirror), combat.player.yaw (the body the
//             mirror comes from) and sim.camera.yaw (what the view is built from).
//   VISIBLE   the drawn frame. The camera basis comes from sim.camera.yaw, so a perturbed hook
//             must produce a DIFFERENT PICTURE from the same standing point.
//
// THE FOUR ARMS, run against one live engine at one doorstep so nothing but the hook differs:
//
//   1. shipped     the hook as installed. Baseline yaw and picture.
//   2. removed     sim.faceRefine = null. The door falls back to the data rule — this is the
//                  delete-the-fix, done live rather than on a copy, and it must move the yaw back.
//   3. perturbed   the hook replaced with one that returns (proposal + 90). If the yaw and the
//                  picture do not follow it, nothing in the running world reads this seam.
//   4. restored    the real hook put back. Must return to arm 1's yaw EXACTLY, or the engine is
//                  carrying state between arms and none of the three above is clean.
//
// A PICTURE PER ARM, from the player's own camera, plus an ORBIT at the shipped arm — owner
// directive 2026-08-14 §2: one still from one angle is the shape of evidence that certified a
// broken thing as fixed. Frames land in docs/shots/ with the yaw and the clearance in the
// manifest, so a picture cannot be argued about without arguing about a number.
//
// USAGE
//   node tools/harness/door-yaw-consume.mjs [--interior archon-apothecary] [--shots <dir>]
//        [--json <path>] [--orbit 8] [--width 1280] [--height 720] [--entry <html>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
door-yaw-consume.mjs — perturb sim.faceRefine and watch the player and the picture move.

USAGE
  node tools/harness/door-yaw-consume.mjs [--interior <id>] [--shots <dir>] [--json <path>]
       [--orbit 8] [--width 1280] [--height 720] [--entry <html>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const INTERIOR = String(args.interior || 'archon-apothecary');
const ORBIT = Number(args.orbit === undefined ? 8 : args.orbit);
const W = Number(args.width || 1280), H = Number(args.height || 720);
const shotsDir = path.resolve(String(args.shots || path.join(REPO_ROOT, 'docs/shots/2026-08-14-door-yaw')));
ensureDir(shotsDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'door-yaw', `consume-${INTERIOR}.json`);
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const IN_PAGE = `
window.__DYC = {
  d2r: Math.PI / 180,
  norm(a) { return ((a % 360) + 360) % 360; },
  clearance(x, z, yaw, eye, reach) {
    const E = window.__ENGINE, r = yaw * this.d2r, fx = Math.sin(r), fz = Math.cos(r);
    for (let d = 0.25; d <= reach + 1e-9; d += 0.25) {
      const q = E.solidAt(x + fx * d, eye, z + fz * d);
      if (q && q.solid) return +(d - 0.25).toFixed(2);
    }
    return reach;
  },
  occluded(x, z, yaw, eye, near, reach) {
    let b = 0, n = 0;
    for (let a = -30; a <= 30 + 1e-9; a += 3) { n++; if (this.clearance(x, z, yaw + a, eye, reach) < near) b++; }
    return +(b / n).toFixed(4);
  },
  /** Where the three fields are, and what the view along the camera looks like. */
  read() {
    const E = window.__ENGINE, p = E.sim.player.pos, eye = p[1] + 1.6;
    const cam = E.sim.camera ? this.norm(E.sim.camera.yaw) : null;
    const yaw = cam === null ? this.norm(E.sim.player.yaw) : cam;
    return {
      pos: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)],
      sim_player_yaw: +this.norm(E.sim.player.yaw).toFixed(1),
      combat_player_yaw: (E.combat && E.combat.player) ? +this.norm(E.combat.player.yaw).toFixed(1) : null,
      sim_camera_yaw: cam === null ? null : +cam.toFixed(1),
      clearance_m: this.clearance(p[0], p[2], yaw, eye, 12),
      occluded_frac: this.occluded(p[0], p[2], yaw, eye, 3, 12),
    };
  },
  /** Stand outside the door, all three fields deliberately wrong, then go in and come back out. */
  cycle(id, seed) {
    const H = window.__HARNESS, E = window.__ENGINE;
    const rec = E.data.interiors[id], cont = rec.continuity || {};
    const out = cont.exterior_spawn || rec.exterior_door;
    E.sim.env.timeOfDay = 12;
    H.teleport(out[0], out[2], { yaw: seed });
    H.stepFrames(6);
    E.sim.player.yaw = seed;
    if (E.combat && E.combat.player) E.combat.player.yaw = seed;
    if (E.sim.camera) { E.sim.camera.yaw = seed; E.sim.camera.yawRate = 0; }
    H.stepFrames(1);
    // TIMED. The refinement scans up to 36 bearings x 21 rays x 12 steps against a cell of up to
    // ~130 slabs when the proposal fails, and that runs inside the fixed step. A fix that turns a
    // door into a visible hitch is not a fix, so the cost is measured rather than asserted to be
    // small — and it is measured around the WHOLE door verb, which is the number a player feels.
    const t0 = performance.now();
    const inRes = H.enterInterior(id);
    const tEnter = performance.now() - t0;
    H.stepFrames(4);
    const t1 = performance.now();
    const outRes = H.exitInterior();
    const tExit = performance.now() - t1;
    H.stepFrames(4);
    return { enter: inRes, exit: outRes, after: this.read(),
      enter_ms: +tEnter.toFixed(2), exit_ms: +tExit.toFixed(2) };
  },
};
`;

const main = async () => {
  const g = await launchGame({ width: W, height: H, entry: args.entry ? String(args.entry) : undefined });
  const { page } = g;
  await g.h('ready');
  await page.evaluate(IN_PAGE);
  // The default 30 s screenshot timeout is not survivable on this box: contention has run at 10-11
  // browser instances and load 45 over 4 cores for hours, and the first attempt at this run died on
  // it after completing all four arms' MEASUREMENTS. Two minutes, and one retry, so a slow box
  // costs time rather than the evidence.
  const shot = async (name) => {
    const p = path.join(shotsDir, name);
    try { await page.screenshot({ path: p, timeout: 120000 }); }
    catch (e) { await page.screenshot({ path: p, timeout: 120000 }); }
    return { file: path.relative(REPO_ROOT, p), bytes: fs.statSync(p).size };
  };

  const out = {
    schema: 'elder-souls/door-yaw-consume@1',
    generated_at: new Date().toISOString(),
    interior: INTERIOR,
    consumer: 'game/src/sim/settlement.js#refineFacing() <- sim.faceRefine <- Engine._refineFacing()',
    entity: 'the player: sim.player.yaw, combat.player.yaw, sim.camera.yaw, and the drawn camera basis',
    viewport: [W, H],
    arms: [],
    orbit: [],
  };

  // ---- arm 1: the hook as shipped -------------------------------------------------------------
  const a1 = await page.evaluate((o) => window.__DYC.cycle(o.id, 200), { id: INTERIOR });
  a1.arm = 'shipped'; a1.shot = await shot(`${INTERIOR}-1-shipped.png`);
  out.arms.push(a1);

  // ---- arm 2: the hook removed — delete-the-fix, live -----------------------------------------
  const a2 = await page.evaluate((o) => {
    const E = window.__ENGINE;
    E.__realFaceRefine = E.sim.faceRefine;
    E.sim.faceRefine = null;
    return window.__DYC.cycle(o.id, 200);
  }, { id: INTERIOR });
  a2.arm = 'removed'; a2.shot = await shot(`${INTERIOR}-2-removed.png`);
  out.arms.push(a2);

  // ---- arm 3: the hook perturbed --------------------------------------------------------------
  const a3 = await page.evaluate((o) => {
    const E = window.__ENGINE;
    E.sim.faceRefine = (x, y, z, yaw) => ({
      yaw_deg: ((Number(yaw) + 90) % 360 + 360) % 360, refined: true, reason: 'PERTURBED',
    });
    return window.__DYC.cycle(o.id, 200);
  }, { id: INTERIOR });
  a3.arm = 'perturbed (+90 deg)'; a3.shot = await shot(`${INTERIOR}-3-perturbed.png`);
  out.arms.push(a3);

  // ---- arm 4: restored ------------------------------------------------------------------------
  const a4 = await page.evaluate((o) => {
    const E = window.__ENGINE;
    E.sim.faceRefine = E.__realFaceRefine;
    return window.__DYC.cycle(o.id, 200);
  }, { id: INTERIOR });
  a4.arm = 'restored'; a4.shot = await shot(`${INTERIOR}-4-restored.png`);
  out.arms.push(a4);

  // ---- the orbit: many angles, one standing point ----------------------------------------------
  // Owner directive 2026-08-14 §2. One still from one angle is how a broken thing gets certified.
  if (ORBIT > 0) {
    const step = 360 / ORBIT;
    for (let i = 0; i < ORBIT; i++) {
      const yaw = Math.round(i * step);
      const info = await page.evaluate((o) => {
        const E = window.__ENGINE, H = window.__HARNESS;
        if (E.sim.camera) { E.sim.camera.yaw = o.yaw; E.sim.camera.yawRate = 0; }
        H.stepFrames(2);
        return window.__DYC.read();
      }, { yaw });
      info.camera_yaw_requested = yaw;
      info.shot = await shot(`${INTERIOR}-orbit-${String(yaw).padStart(3, '0')}.png`);
      out.orbit.push(info);
    }
  }

  await g.close();

  // ---- the verdict, computed rather than asserted ----------------------------------------------
  const dis = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const [s, rm, pt, rs] = out.arms;
  const threeFieldsAgree = (a) => a.after.combat_player_yaw !== null
    && dis(a.after.sim_player_yaw, a.after.combat_player_yaw) < 0.5
    && a.after.sim_camera_yaw !== null && dis(a.after.sim_player_yaw, a.after.sim_camera_yaw) < 0.5;
  out.verdict = {
    shipped_yaw: s.after.sim_camera_yaw,
    removed_yaw: rm.after.sim_camera_yaw,
    perturbed_yaw: pt.after.sim_camera_yaw,
    restored_yaw: rs.after.sim_camera_yaw,
    // The seam is read: removing it changes the facing.
    removing_the_hook_moves_the_facing: dis(s.after.sim_camera_yaw, rm.after.sim_camera_yaw) > 0.5,
    // The seam is read with its VALUE, not merely called: a different answer gives a different facing.
    perturbing_the_hook_moves_the_facing: dis(s.after.sim_camera_yaw, pt.after.sim_camera_yaw) > 0.5,
    perturbed_is_removed_plus_90: dis(pt.after.sim_camera_yaw, rm.after.sim_camera_yaw + 90) < 0.5,
    // No state carried between arms.
    restored_matches_shipped: dis(s.after.sim_camera_yaw, rs.after.sim_camera_yaw) < 0.5,
    // All three fields moved together, in every arm.
    three_fields_agree_in_all_arms: out.arms.every(threeFieldsAgree),
    // And the PICTURE changed. Byte-identical PNGs from the same standing point would mean the
    // camera basis does not read sim.camera.yaw, which is the whole load-bearing half.
    picture_changed_when_perturbed: s.shot.bytes !== pt.shot.bytes,
    door_cost_ms: { shipped_exit: s.exit_ms, removed_exit: rm.exit_ms, shipped_enter: s.enter_ms, removed_enter: rm.enter_ms },
    clearance_shipped_m: s.after.clearance_m, clearance_removed_m: rm.after.clearance_m,
    occluded_shipped: s.after.occluded_frac, occluded_removed: rm.after.occluded_frac,
  };
  writeJson(jsonPath, out);

  say(`door-yaw-consume [${INTERIOR}] — ${out.arms.length} arms, ${out.orbit.length} orbit frames`);
  for (const a of out.arms) {
    say(`  ${String(a.arm).padEnd(20)} cam ${String(a.after.sim_camera_yaw).padStart(6)}  body ${String(a.after.sim_player_yaw).padStart(6)}  combat ${String(a.after.combat_player_yaw).padStart(6)}  clear ${String(a.after.clearance_m).padStart(5)} m  occl ${a.after.occluded_frac}  door ${String(a.exit_ms).padStart(6)} ms  source ${a.exit && a.exit.yaw_source}`);
  }
  const V = out.verdict;
  say('  CONSUMPTION:');
  for (const [k, v] of Object.entries(V)) if (typeof v === 'boolean') say(`    ${v ? 'YES' : 'NO '}  ${k}`);
  say(`  shots: ${path.relative(REPO_ROOT, shotsDir)}`);
  say(`  json:  ${path.relative(REPO_ROOT, jsonPath)}`);

  const hard = ['removing_the_hook_moves_the_facing', 'perturbing_the_hook_moves_the_facing',
    'restored_matches_shipped', 'three_fields_agree_in_all_arms', 'picture_changed_when_perturbed'];
  const failed = hard.filter((k) => !V[k]);
  if (failed.length) { console.error(`CONSUMPTION FAILED: ${failed.join(', ')}`); process.exit(1); }
};

main().catch((e) => { console.error(e); process.exit(1); });
