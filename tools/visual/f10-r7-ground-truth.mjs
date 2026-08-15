#!/usr/bin/env node
/**
 * f10-r7-ground-truth.mjs — MEASURE the three things round 7 was told to stop inferring.
 *
 * WHY THIS EXISTS. `W1-F10-r6-appearance` recorded, in its own `what_i_could_not_do`:
 * *"THE BOARDWALK EXPLANATION IS READ OUT OF THE CODE AND THE PICTURE, NOT MEASURED... I did NOT
 * call `groundAt` at that coordinate and read the gap."* It named its own falsifier:
 * `groundAt(2766, 5011)` returning within 0.25 m of the player's `pos[1]`. This tool calls it.
 *
 * It renders nothing and judges no appearance. It reads numbers out of a live engine — heights,
 * bone world matrices, the visible surface under the body, and the wall-clock cost of conforming
 * the whole NPC roster — so that a fix is designed against measurements instead of against a
 * plausible story. Every claim it makes is a number it printed.
 *
 * SIX MEASUREMENTS, in the order the brief asks for them:
 *
 *   M1  THE PLAYER'S GROUND, AT HIS OWN STAND. `engine.groundAt(x,z)` vs `sim.player.pos[1]` vs
 *       the combat body's `pos[1]`, and `body.airborne`. This is the r6 falsifier verbatim.
 *
 *   M2  THE VISIBLE SURFACE UNDER THE BODY, by raycasting the DRAWN scene straight down from
 *       10 m above. `heightAt` is the collision surface; a boardwalk plank is a mesh. If the two
 *       disagree the character is standing inside architecture, which is `G1`'s finding arriving
 *       from underneath instead of from the camera.
 *
 *   M3  WHERE THE FEET ACTUALLY ARE. The skinned world y of `foot_l`/`foot_r` bones, read from
 *       `renderer.playerMesh.userData.actor.built.bones[i].matrixWorld` AFTER a real frame, and
 *       the same for two NPC meshes. Against M2 this says buried / floating / seated, in metres.
 *
 *   M4  DOES THE CONFORM RUN. Perturbation, not inspection: swap `renderer.groundResolver` for a
 *       function that returns its real answer plus a large offset, render, and re-read the foot
 *       bones. An entity that moves is an entity that consumed the input. This is `RI-MTH07`'s
 *       consumption test applied to the thing the brief says has never run.
 *
 *   M5  WHAT IT COSTS. Time `field.heightAt` over the real NPC roster at the density the conform
 *       needs (2 feet x 4 samples), and count how many NPC meshes are actually visible in a frame.
 *       "Is 408 too many" is a measurement, not an opinion.
 *
 *   M6  SLOPE AND STAIRS. The r6 pass captured neither and said so. Sample `heightAt` on a grid
 *       around each stand and report the steepest per-foot height difference a character would
 *       actually straddle, so round 7 can point a camera at a place where the delta is non-zero.
 *
 * SOFTWARE RASTERISER IS FINE HERE AND THAT IS NOT A COMPROMISE. Nothing below reads a pixel's
 * colour. `--gpu hardware` is available and unnecessary: bone matrices, heights and timings are
 * computed on the CPU by identical code on both backends. Appearance claims still need hardware.
 *
 * USAGE
 *   node tools/visual/f10-r7-ground-truth.mjs [--out <dir>] [--gpu software|hardware]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchForCapture } from './lib/gpu-launch.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const argOf = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const OUT = path.resolve(REPO, argOf('--out', 'reports/f10-r7-ground-truth'));
const GPU = argOf('--gpu', 'software');
const SEED = Number(argOf('--seed', '1'));
fs.mkdirSync(OUT, { recursive: true });
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);

log('TOOL f10-r7-ground-truth — measures heights, bone positions, consumption and cost. Renders no verdict.');

// The same three stands every F10 round has used, copied from `f10-r5-appearance.mjs:116-120`
// rather than re-invented, so a number here is comparable with a number there.
// `street-gideon` is 2.4 km away and a teleport there costs several minutes of province streaming
// plus a scene traversal over a second settlement's meshes; the first run of this tool was killed
// on it by its own timeout after both Lilmoth stands had already answered. `--stands a,b` selects.
const ALL_STANDS = [
  { id: 'char-player', x: 2766, z: 5011 },
  { id: 'street-lilmoth', x: 2779.9, z: 5040.9 },
  { id: 'street-gideon', x: 459.3, z: 2934.2 },
];
const WANT = argOf('--stands', 'char-player,street-lilmoth').split(',').map((s) => s.trim());
const STANDS = ALL_STANDS.filter((s) => WANT.includes(s.id));

const { g, attestation } = await launchForCapture({ mode: GPU, entry: 'game/index.html', width: 960, height: 540 });
const out = { tool: 'f10-r7-ground-truth', at: new Date().toISOString(), seed: SEED, renderer: attestation, stands: [] };
let failed = null;

try {
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
  await g.h('ready');
  await g.h('setSeed', SEED);
  log(`renderer: ${attestation.renderer_string} (${attestation.class})`);

  for (const stand of STANDS) {
    log(`\n=== ${stand.id} (${stand.x}, ${stand.z}) ===`);
    const ok = await g.page.evaluate(async ({ x, z }) => {
      await window.__HARNESS.teleport(x, z);
      await window.__HARNESS.stepFrames(8);
      window.__HARNESS.renderFrame();
      return true;
    }, stand);
    if (!ok) { log('  teleport refused'); continue; }

    const m = await g.page.evaluate(async ({ x, z }) => {
      const E = window.__ENGINE, H = window.__HARNESS;
      const R = E.renderer, sim = E.sim;
      const THREE = R.THREE || (R.scene && R.scene.constructor && R.scene.constructor.prototype && null);
      const r = {};

      // ---- M1: the collision ground vs the two bodies -------------------------------------
      const cb = sim._combat && sim._combat.player;
      r.M1 = {
        engine_groundAt: E.groundAt(x, z),
        field_heightAt: E.field ? E.field.heightAt(x, z) : null,
        renderer_groundResolver: R.groundResolver ? R.groundResolver(x, z) : null,
        player_pos_y: sim.player.pos[1],
        combat_body_pos_y: cb ? cb.pos[1] : null,
        body_airborne: cb ? !!cb.airborne : null,
        cell: R.cell,
      };
      r.M1.gap_body_minus_ground = r.M1.player_pos_y - r.M1.engine_groundAt;

      // ---- M2: the DRAWN surface, by ray against the scene ---------------------------------
      // Hand-rolled ray/triangle over world-space triangles: THREE is not on `window`, and a
      // Raycaster would need the class. This walks every visible indexed/non-indexed Mesh in the
      // scene, transforms its triangles by `matrixWorld`, and keeps the highest hit below 10 m.
      // Slow and obviously correct beats fast and unverifiable for a one-shot measurement.
      const rayDown = (ox, oz, oy = 12) => {
        let best = null, bestName = null;
        R.scene.updateMatrixWorld(true);
        R.scene.traverse((o) => {
          if (!o.visible || !o.isMesh || !o.geometry) return;
          const pos = o.geometry.attributes && o.geometry.attributes.position;
          if (!pos) return;
          if (pos.count > 200000) return;                 // terrain tiles are fine; skip nothing huge twice
          const idx = o.geometry.index;
          const mw = o.matrixWorld.elements;
          const tx = (px, py, pz) => [
            mw[0] * px + mw[4] * py + mw[8] * pz + mw[12],
            mw[1] * px + mw[5] * py + mw[9] * pz + mw[13],
            mw[2] * px + mw[6] * py + mw[10] * pz + mw[14],
          ];
          const n = idx ? idx.count : pos.count;
          const gi = (k) => (idx ? idx.getX(k) : k);
          for (let k = 0; k + 2 < n; k += 3) {
            const a = gi(k), b = gi(k + 1), c = gi(k + 2);
            const A = tx(pos.getX(a), pos.getY(a), pos.getZ(a));
            const B = tx(pos.getX(b), pos.getY(b), pos.getZ(b));
            const C = tx(pos.getX(c), pos.getY(c), pos.getZ(c));
            // 2D point-in-triangle on the XZ plane, then plane-solve for y.
            const d1 = (ox - B[0]) * (A[2] - B[2]) - (A[0] - B[0]) * (oz - B[2]);
            const d2 = (ox - C[0]) * (B[2] - C[2]) - (B[0] - C[0]) * (oz - C[2]);
            const d3 = (ox - A[0]) * (C[2] - A[2]) - (C[0] - A[0]) * (oz - A[2]);
            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0, hasPos = d1 > 0 || d2 > 0 || d3 > 0;
            if (hasNeg && hasPos) continue;
            const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
            const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            if (Math.abs(ny) < 1e-9) continue;
            const y = A[1] + (nx * (A[0] - ox) + nz * (A[2] - oz)) / ny;
            if (y > oy) continue;
            if (best === null || y > best) { best = y; bestName = o.name || o.parent && o.parent.name || o.type; }
          }
        });
        return { y: best, what: bestName };
      };
      const hit = rayDown(x, z);
      r.M2 = {
        drawn_surface_y: hit.y,
        drawn_surface_mesh: hit.what,
        collision_ground_y: r.M1.engine_groundAt,
        drawn_minus_collision: hit.y === null ? null : hit.y - r.M1.engine_groundAt,
      };

      // ---- M3: where the feet actually are -------------------------------------------------
      const feetOf = (mesh) => {
        const A = mesh && mesh.userData && mesh.userData.actor;
        const S = A && A.built;
        if (!S || !S.index) return null;
        const o = {};
        for (const id of ['foot_l', 'foot_r', 'pelvis', 'head']) {
          const i = S.index.get(id);
          if (i === undefined || !S.bones[i]) continue;
          const e = S.bones[i].matrixWorld.elements;
          o[id] = { x: e[12], y: e[13], z: e[14] };
        }
        o.rigged = !!A.rigged;
        o.civilian = !!A.civilian;
        return o;
      };
      r.M3 = { player: feetOf(R.playerMesh), npcs: [] };
      let taken = 0;
      for (const [eid, mesh] of R.npcMeshes || []) {
        if (taken >= 3) break;
        const f = feetOf(mesh);
        if (!f || !f.foot_l) continue;
        const rec = sim.npcs.find((n) => n.eid === eid);
        const gy = rec ? E.groundAt(rec.pos[0], rec.pos[2]) : null;
        r.M3.npcs.push({
          eid, name: mesh.name, pos_y: rec ? rec.pos[1] : null, groundAt_here: gy,
          pos_minus_ground: rec && gy !== null ? rec.pos[1] - gy : null,
          drawn_surface_y: rec ? rayDown(rec.pos[0], rec.pos[2]).y : null,
          feet: f,
        });
        taken++;
      }

      // ---- M4: does the conform RUN? perturb the input and see if the output moves ----------
      const before = feetOf(R.playerMesh);
      const orig = R.groundResolver;
      R.groundResolver = (gx, gz) => (orig ? orig(gx, gz) : E.groundAt(gx, gz)) + 5.0;
      await H.stepFrames(1); H.renderFrame();
      const after = feetOf(R.playerMesh);
      R.groundResolver = orig;
      await H.stepFrames(1); H.renderFrame();
      const restored = feetOf(R.playerMesh);
      const d = (a, b) => (a && b && a.foot_l && b.foot_l ? {
        foot_l_dy: b.foot_l.y - a.foot_l.y, foot_r_dy: b.foot_r.y - a.foot_r.y,
        pelvis_dy: b.pelvis && a.pelvis ? b.pelvis.y - a.pelvis.y : null,
      } : null);
      r.M4 = {
        what: 'groundResolver returns real+5.0 m for one frame; a foot that consumes it must move.',
        player_delta: d(before, after),
        player_restored_delta: d(before, restored),
      };
      // The same perturbation, asked of an NPC. If NPC feet never read the resolver, this is 0.
      const npcMesh = (r.M3.npcs[0] && R.npcMeshes.get(r.M3.npcs[0].eid)) || null;
      if (npcMesh) {
        const nb = feetOf(npcMesh);
        R.groundResolver = (gx, gz) => (orig ? orig(gx, gz) : E.groundAt(gx, gz)) + 5.0;
        await H.stepFrames(1); H.renderFrame();
        const na = feetOf(npcMesh);
        R.groundResolver = orig;
        await H.stepFrames(1); H.renderFrame();
        r.M4.npc_delta = d(nb, na);
        r.M4.npc_eid = r.M3.npcs[0].eid;
      }

      // ---- M5: what conforming the roster costs --------------------------------------------
      const npcs = sim.npcs || [];
      let visible = 0;
      for (const [, mesh] of R.npcMeshes || []) if (mesh.visible) visible++;
      const t0 = performance.now();
      let acc = 0;
      for (const n of npcs) {
        for (const foot of [-0.12, 0.12]) {
          const fx = n.pos[0] + foot, fz = n.pos[2];
          acc += E.groundAt(fx, fz) + E.groundAt(fx + 0.2, fz) + E.groundAt(fx - 0.2, fz)
               + E.groundAt(fx, fz + 0.2) + E.groundAt(fx, fz - 0.2);
        }
      }
      const t1 = performance.now();
      r.M5 = {
        npc_records: npcs.length, npc_meshes: R.npcMeshes ? R.npcMeshes.size : 0, npc_meshes_visible: visible,
        groundAt_calls: npcs.length * 2 * 5,
        ms_for_whole_roster: +(t1 - t0).toFixed(3),
        ms_per_1000_calls: npcs.length ? +(((t1 - t0) / (npcs.length * 10)) * 1000).toFixed(3) : null,
        budget_note: 'a 60 Hz frame is 16.67 ms',
        checksum: acc,
      };

      // ---- M6: is there any slope here at all? ---------------------------------------------
      // The per-foot delta only exists where the ground under the left foot differs from the
      // ground under the right. Sample the real stance width over a 24 m disc and report the
      // worst case, plus the local gradient, so a camera can be pointed somewhere it is non-zero.
      let worst = 0, worstAt = null, samples = 0, sum = 0;
      for (let dx = -12; dx <= 12; dx += 1.5) {
        for (let dz = -12; dz <= 12; dz += 1.5) {
          const sx = x + dx, sz = z + dz;
          const l = E.groundAt(sx - 0.12, sz), rr = E.groundAt(sx + 0.12, sz);
          const spread = Math.abs(l - rr);
          sum += spread; samples++;
          if (spread > worst) { worst = spread; worstAt = [+sx.toFixed(2), +sz.toFixed(2)]; }
        }
      }
      r.M6 = {
        stance_width_m: 0.24,
        worst_per_foot_height_difference_m: +worst.toFixed(4),
        worst_at: worstAt,
        mean_per_foot_difference_m: +(sum / samples).toFixed(5),
        samples,
        note: 'this is the entire magnitude the conform delta can have at this stand',
      };
      return r;
    }, stand);

    m.stand = stand.id;
    out.stands.push(m);
    log(`  M1 groundAt=${m.M1.engine_groundAt.toFixed(3)}  player.y=${m.M1.player_pos_y.toFixed(3)}  gap=${m.M1.gap_body_minus_ground.toFixed(4)}  airborne=${m.M1.body_airborne}`);
    log(`  M2 drawn surface=${m.M2.drawn_surface_y === null ? 'none' : m.M2.drawn_surface_y.toFixed(3)} (${m.M2.drawn_surface_mesh})  drawn-collision=${m.M2.drawn_minus_collision === null ? 'n/a' : m.M2.drawn_minus_collision.toFixed(4)} m`);
    if (m.M3.player && m.M3.player.foot_l) log(`  M3 player foot_l.y=${m.M3.player.foot_l.y.toFixed(4)} foot_r.y=${m.M3.player.foot_r.y.toFixed(4)} rigged=${m.M3.player.rigged}`);
    for (const n of m.M3.npcs) log(`     NPC ${n.name} pos.y=${n.pos_y === null ? '?' : n.pos_y.toFixed(3)} ground=${n.groundAt_here === null ? '?' : n.groundAt_here.toFixed(3)} drawn=${n.drawn_surface_y === null ? '?' : n.drawn_surface_y.toFixed(3)} foot_l.y=${n.feet.foot_l.y.toFixed(4)} rigged=${n.feet.rigged}`);
    log(`  M4 player foot_l moved ${m.M4.player_delta ? m.M4.player_delta.foot_l_dy.toFixed(4) : 'n/a'} m under a +5 m ground perturbation; NPC moved ${m.M4.npc_delta ? m.M4.npc_delta.foot_l_dy.toFixed(4) : 'n/a'} m`);
    log(`  M5 ${m.M5.npc_records} npc records, ${m.M5.npc_meshes_visible}/${m.M5.npc_meshes} meshes visible; whole-roster conform sampling ${m.M5.ms_for_whole_roster} ms (frame budget 16.67 ms)`);
    log(`  M6 worst per-foot ground difference within 12 m: ${m.M6.worst_per_foot_height_difference_m} m at ${JSON.stringify(m.M6.worst_at)}; mean ${m.M6.mean_per_foot_difference_m} m`);
  }
} catch (e) {
  failed = `${e && e.message ? e.message : e}`;
  log(`FAILED: ${failed}`);
} finally {
  out.failed = failed;
  fs.writeFileSync(path.join(OUT, 'ground-truth.json'), `${JSON.stringify(out, null, 2)}\n`);
  log(`\nwrote ${path.join(OUT, 'ground-truth.json')}`);
  await g.close().catch(() => {});
}
process.exit(failed ? 1 : 0);
