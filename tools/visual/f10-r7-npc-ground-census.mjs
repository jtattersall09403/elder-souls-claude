#!/usr/bin/env node
/**
 * f10-r7-npc-ground-census.mjs — two questions the r7 brief cannot be answered without, and
 * neither of them is an appearance judgement.
 *
 * Q1. IS ANY CHARACTER DRAWN BELOW THE GROUND IT STANDS ON? `game/src/sim/npc.js:62` takes an
 *     NPC's y verbatim from the authored `post.pos[1]` and nothing ever compares it to the
 *     terrain. `f10-r7-ground-truth` found two of the three NPCs nearest the Lilmoth player stand
 *     sitting 2.12 m and 2.31 m BELOW `groundAt` at their own coordinates. This censuses the whole
 *     loaded roster instead of three of it, and reports the distribution, because "how many and by
 *     how much" decides whether the fix is a clamp or a re-authoring job.
 *
 * Q2. WHAT IS THE TOP SURFACE UNDER THE PLAYER, AND IS IT THE COLLISION GROUND? `W1-F10-r6-
 *     appearance` explained the player's identical static foot frames with a raised boardwalk on
 *     which the +-0.25 m clamp saturates, and recorded honestly that it had NOT measured it. Its
 *     own named falsifier — `groundAt(2766, 5011)` within 0.25 m of the player's `pos[1]` — has
 *     since fired: the gap is 0.0000 m and the clamp cannot saturate. That leaves the picture
 *     unexplained, so this asks the scene directly: cast a ray down at the stand with EVERY actor
 *     subtree excluded, and list the surfaces it passes through with their mesh names and heights.
 *     If a drawn plank sits above the collision ground, the character is standing inside
 *     architecture — which is `G1-THE-REAL-OCCLUDER-IS-ARCHITECTURE` arriving from underneath.
 *
 * WHY THE ACTOR EXCLUSION MATTERS AND IS NOT A DETAIL. The first cut of this ray reported the top
 * surface at the player stand as y=4.188 on a mesh named `actor-equipment:reed:chest@spine_02` —
 * the player's own chest. A ray cast from above a character hits the character. Any "ground under
 * the body" measured without excluding the body is measuring the body.
 *
 * Software rasteriser is correct here: nothing below reads a pixel.
 *
 * USAGE  node tools/visual/f10-r7-npc-ground-census.mjs [--out <dir>] [--seed 1]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchForCapture } from './lib/gpu-launch.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(REPO, argOf('--out', 'reports/f10-r7-ground-truth'));
const SEED = Number(argOf('--seed', '1'));
fs.mkdirSync(OUT, { recursive: true });
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
log('TOOL f10-r7-npc-ground-census — NPC burial census + the surface stack under the player stand.');

const STANDS = [
  { id: 'char-player', x: 2766, z: 5011 },
  { id: 'street-lilmoth', x: 2779.9, z: 5040.9 },
];

const { g, attestation } = await launchForCapture({ mode: 'software', entry: 'game/index.html', width: 640, height: 360 });
const out = { tool: 'f10-r7-npc-ground-census', at: new Date().toISOString(), seed: SEED, renderer: attestation.renderer_string, stands: [] };
let failed = null;
try {
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
  await g.h('ready');
  await g.h('setSeed', SEED);
  for (const stand of STANDS) {
    log(`\n=== ${stand.id} ===`);
    const r = await g.page.evaluate(async ({ x, z }) => {
      const H = window.__HARNESS, E = window.__ENGINE, R = E.renderer;
      await H.teleport(x, z);
      await H.stepFrames(8);
      H.renderFrame();
      R.scene.updateMatrixWorld(true);

      // Every mesh that belongs to a CHARACTER, by object identity rather than by name, so a
      // renamed part cannot slip back into the ground measurement.
      const actorRoots = new Set([R.playerMesh, ...(R.npcMeshes ? R.npcMeshes.values() : []), ...(R.enemyMeshes ? R.enemyMeshes.values() : [])]);
      const isActor = (o) => { for (let p = o; p; p = p.parent) if (actorRoots.has(p)) return true; return false; };

      /** Every surface a downward ray crosses at (ox,oz), highest first, actors excluded. */
      const stack = (ox, oz, top = 40) => {
        const hits = [];
        R.scene.traverse((o) => {
          if (!o.visible || !o.isMesh || !o.geometry || isActor(o)) return;
          const pos = o.geometry.attributes && o.geometry.attributes.position;
          if (!pos) return;
          const idx = o.geometry.index, mw = o.matrixWorld.elements;
          const tx = (px, py, pz) => [mw[0]*px+mw[4]*py+mw[8]*pz+mw[12], mw[1]*px+mw[5]*py+mw[9]*pz+mw[13], mw[2]*px+mw[6]*py+mw[10]*pz+mw[14]];
          const n = idx ? idx.count : pos.count, gi = (k) => (idx ? idx.getX(k) : k);
          let bestForThisMesh = null;
          for (let k = 0; k + 2 < n; k += 3) {
            const a = gi(k), b = gi(k+1), c = gi(k+2);
            const A = tx(pos.getX(a), pos.getY(a), pos.getZ(a));
            const B = tx(pos.getX(b), pos.getY(b), pos.getZ(b));
            const C = tx(pos.getX(c), pos.getY(c), pos.getZ(c));
            const d1 = (ox-B[0])*(A[2]-B[2]) - (A[0]-B[0])*(oz-B[2]);
            const d2 = (ox-C[0])*(B[2]-C[2]) - (B[0]-C[0])*(oz-C[2]);
            const d3 = (ox-A[0])*(C[2]-A[2]) - (C[0]-A[0])*(oz-A[2]);
            if ((d1<0||d2<0||d3<0) && (d1>0||d2>0||d3>0)) continue;
            const ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2], vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
            const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
            if (Math.abs(ny) < 1e-9) continue;
            const y = A[1] + (nx*(A[0]-ox) + nz*(A[2]-oz)) / ny;
            if (y > top) continue;
            if (bestForThisMesh === null || y > bestForThisMesh) bestForThisMesh = y;
          }
          if (bestForThisMesh !== null) hits.push({ y: +bestForThisMesh.toFixed(4), mesh: o.name || o.parent?.name || o.type });
        });
        hits.sort((a, b) => b.y - a.y);
        return hits;
      };

      const ground = E.groundAt(x, z);
      const hits = stack(x, z);
      // Anything within 1.2 m of the collision ground is "the floor here"; report the whole
      // neighbourhood so a plank 7 cm proud is visible rather than averaged away.
      const near = hits.filter((h) => Math.abs(h.y - ground) < 1.2).slice(0, 12);

      // ---- the census -----------------------------------------------------------------------
      // TWO HEIGHTS PER NPC, AND THE SECOND ONE IS THE ONE THE PLAYER SEES. `record_delta` is the
      // authored `sim.npcs[].pos[1]` against the ground — the sim's own number, which round 7 does
      // NOT change, so it also serves as the proof that the sim was left alone. `drawn_delta` is
      // where the mesh is actually placed in the scene graph. A census that reads only the record
      // cannot tell whether a render-side fix landed, which is how this tool was wrong on its
      // first pass.
      const rows = [];
      for (const n of E.sim.npcs || []) {
        const gy = E.groundAt(n.pos[0], n.pos[2]);
        const mesh = R.npcMeshes ? R.npcMeshes.get(n.eid) : null;
        const A = mesh && mesh.userData && mesh.userData.actor;
        const S = A && A.built;
        const fi = S && S.index ? S.index.get('foot_l') : undefined;
        const footY = fi !== undefined && S.bones[fi] ? S.bones[fi].matrixWorld.elements[13] : null;
        rows.push({
          eid: n.eid, race: n.race, at: n.at || null,
          pos_y: +n.pos[1].toFixed(3), ground_y: +gy.toFixed(3), record_delta: +(n.pos[1] - gy).toFixed(3),
          drawn_y: mesh ? +mesh.position.y.toFixed(3) : null,
          drawn_delta: mesh ? +(mesh.position.y - gy).toFixed(3) : null,
          foot_l_y: footY === null ? null : +footY.toFixed(4),
          foot_above_ground: footY === null ? null : +(footY - gy).toFixed(4),
          drawn: !!(mesh && mesh.visible),
        });
      }
      return { ground, hits_total: hits.length, near, top5: hits.slice(0, 5), rows, cell: R.cell };
    }, stand);

    r.stand = stand.id;
    out.stands.push(r);
    log(`  collision groundAt = ${r.ground.toFixed(3)}   cell=${r.cell}   ${r.hits_total} non-actor meshes cross this column`);
    log('  surfaces within 1.2 m of the collision ground, highest first:');
    for (const h of r.near) log(`     y=${h.y.toFixed(4)}  (${h.y - r.ground >= 0 ? '+' : ''}${(h.y - r.ground).toFixed(4)} m)  ${h.mesh}`);
    const drawn = r.rows.filter((x) => x.drawn);
    const band = (key) => {
      const bad = drawn.filter((x) => x[key] !== null && Math.abs(x[key]) > 0.15);
      const below = bad.filter((x) => x[key] < 0), above = bad.filter((x) => x[key] > 0);
      return { bad, below, above };
    };
    const rec = band('record_delta'), drw = band('drawn_delta');
    log(`  census: ${r.rows.length} loaded NPC records, ${drawn.length} DRAWN.`);
    log(`     BY THE RECORD (sim.npcs[].pos[1], untouched by round 7):`);
    log(`       buried >0.15 m: ${rec.below.length}/${drawn.length}${rec.below.length ? ` worst ${Math.min(...rec.below.map((b) => b.record_delta)).toFixed(2)} m` : ''}   floating >0.15 m: ${rec.above.length}/${drawn.length}${rec.above.length ? ` worst +${Math.max(...rec.above.map((b) => b.record_delta)).toFixed(2)} m` : ''}`);
    log(`     AS DRAWN (mesh.position.y — what the player sees):`);
    log(`       buried >0.15 m: ${drw.below.length}/${drawn.length}${drw.below.length ? ` worst ${Math.min(...drw.below.map((b) => b.drawn_delta)).toFixed(2)} m` : ''}   floating >0.15 m: ${drw.above.length}/${drawn.length}${drw.above.length ? ` worst +${Math.max(...drw.above.map((b) => b.drawn_delta)).toFixed(2)} m` : ''}`);
    const soles = drawn.filter((x) => x.foot_above_ground !== null).map((x) => x.foot_above_ground);
    if (soles.length) log(`     foot_l bone above its own ground: min ${Math.min(...soles).toFixed(4)} m, max ${Math.max(...soles).toFixed(4)} m over ${soles.length} drawn NPCs (rest ankle is 0.090 m)`);
    for (const b of rec.bad.slice(0, 6)) log(`       ${b.eid} (${b.race}) record_y=${b.pos_y} ground=${b.ground_y} record_delta=${b.record_delta}  DRAWN_y=${b.drawn_y} drawn_delta=${b.drawn_delta} foot_l=${b.foot_l_y}`);
  }
} catch (e) {
  failed = `${e && e.message ? e.message : e}`;
  log(`FAILED: ${failed}`);
} finally {
  out.failed = failed;
  fs.writeFileSync(path.join(OUT, 'npc-ground-census.json'), `${JSON.stringify(out, null, 2)}\n`);
  log(`\nwrote ${path.join(OUT, 'npc-ground-census.json')}`);
  await g.close().catch(() => {});
}
process.exit(failed ? 1 : 0);
