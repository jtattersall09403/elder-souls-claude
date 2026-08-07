#!/usr/bin/env node
/**
 * prov-stream.mjs — is the province streamed from the SIMULATION?
 *
 * NEXT-DISPATCH §0. `renderer.province.request()` had four call sites — `_applyCell`, `teleport`,
 * `walkRoute` under an opt-in flag, and the harness itself — and none of them is the fixed step.
 * So the drawn province was anchored to the last teleport: a player who walked past the built ring
 * walked off the world, and every capture taken by posing a camera without teleporting photographed
 * unbuilt ground.
 *
 * THE INSTRUMENT MUST NOT BE THE FIX. Everything this tool reads comes out of `window.__ENGINE`
 * read-only — `province.tiles`, `province.focus`, the four camera-following discs — and it NEVER
 * calls `request()`, `pump()`, `drain()` or `streamAround()`. That matters: the harness's own
 * `streamAround` is exactly why this defect survived ten waves of capture. The world either builds
 * itself under a walking player or this tool reports that it does not.
 *
 * Modes:
 *   --mode camera3km   the critic's baseline: pose a camera 3 km out, step 600 fixed frames,
 *                      count how many of the 25 tiles around it are built.
 *   --mode walk        walk `--metres` from the state's start through the game's own locomotion,
 *                      sampling the ring under the player as it goes.
 *   --mode crossing    walk the canonical crossing END TO END and sample the ring the whole way.
 *                      This is arrival evidence (ARBITRATION S34): walked, never placed.
 *
 * Perturbation (RI-MTH07 consumption): --tile-radius <n> sets `province.radiusTiles` before the
 * walk. If the built world does not change underneath a walking player when this changes, the
 * streamer is not what is building it.
 *
 * Usage:
 *   node tools/world/prov-stream.mjs --mode camera3km --out reports/world/province-stream/base.json
 *   node tools/world/prov-stream.mjs --mode crossing  --out reports/world/province-stream/cross.json
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `prov-stream.mjs — is the province streamed from the simulation?
  --mode <m>         camera3km | walk | crossing        (default camera3km)
  --state <id>       state to load                      (default default)
  --frames <n>       camera3km: fixed steps to take     (default 600)
  --metres <m>       walk: how far to walk              (default 3000)
  --speed <s>        walk|jog                           (default walk)
  --sample-frames <n> sample the ring every n frames    (default 1800)
  --tile-radius <n>  perturb province.radiusTiles before walking (consumption)
  --skin-radius <n>  perturb province.skinRadiusM before walking (consumption)
  --out <file>       where to write the report json`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const MODE = String(args.mode || 'camera3km');
const STATE = String(args.state || 'default');
const FRAMES = Number(args.frames || 600);
const METRES = Number(args.metres || 3000);
const SPEED = String(args.speed || 'walk');
const SAMPLE = Number(args['sample-frames'] || 1800);
const TILE_RADIUS = args['tile-radius'] === undefined ? null : Number(args['tile-radius']);
const SKIN_RADIUS = args['skin-radius'] === undefined ? null : Number(args['skin-radius']);
const args_frames = Number(args.frames || (String(args.mode) === 'budget' ? 30000 : 600));
const args_bearing = Number(args.bearing === undefined ? 189 : args.bearing);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'world', 'province-stream', `${MODE}.json`)));
ensureDir(path.dirname(OUT));

// ---------------------------------------------------------------------------------------------
// The read-only inspector. Installed once into the page; calls nothing that builds anything.
// ---------------------------------------------------------------------------------------------
const INSTALL_INSPECTOR = () => {
  window.__PROBE = {
    /** Everything about the streamed province at a point, WITHOUT asking for any of it. */
    look(at) {
      const e = window.__ENGINE;
      const pv = e.renderer && e.renderer.province;
      if (!pv) return { province_loaded: false };
      const s = pv.stats();
      const T = s.tileSizeM;
      const R = pv.radiusTiles !== undefined ? pv.radiusTiles : s.residentRadiusTiles;
      const p = e.sim.player.pos;
      const x = at ? at[0] : p[0], z = at ? at[1] : p[2];
      const tx0 = Math.floor(x / T), tz0 = Math.floor(z / T);
      let want = 0, built = 0, nearWant = 0, nearBuilt = 0;
      const unbuilt = [];
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          const tx = tx0 + dx, tz = tz0 + dz;
          if (tx < 0 || tz < 0 || tx * T >= e.field.sizeX || tz * T >= e.field.sizeZ) continue;
          const has = pv.tiles.has(`${tx},${tz}`);
          want++;
          if (has) built++; else unbuilt.push(`${tx},${tz}`);
          // THE RING THAT MATTERS. The 3x3 around the body is everything inside 450 m — the
          // ground you stand on and the ground you can see. Beyond it the tile layer is behind
          // the fog in all thirteen regions and its state is a level-of-detail question, not a
          // hole in the world. A tile queued and not yet built at 600-750 m is the trickle
          // working as designed; an unbuilt tile in HERE is the defect.
          if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) { nearWant++; if (has) nearBuilt++; }
        }
      }
      const d = (a) => (a ? +Math.hypot(x - a[0], z - a[1]).toFixed(2) : null);
      // Is the ground the player is standing on actually drawn?
      const underfoot = pv.tiles.has(`${tx0},${tz0}`);
      // The four things `request()` is the only refresh for.
      let coverInstances = 0, nearInstances = 0, skinVerts = 0, lampsLit = 0;
      if (pv.coverGroup) pv.coverGroup.traverse((o) => { if (o.isInstancedMesh) coverInstances += o.count; });
      if (pv.nearGroup) pv.nearGroup.traverse((o) => { if (o.isInstancedMesh) nearInstances += o.count; });
      if (pv.skinMesh) skinVerts = pv.skinMesh.geometry.attributes.position.count;
      let lampNearest = null;
      if (pv.sigLights) {
        const lit = pv.sigLights.filter((l) => l.visible);
        lampsLit = lit.length;
        for (const l of lit) {
          const dl = Math.hypot(l.position.x - x, l.position.z - z);
          if (lampNearest === null || dl < lampNearest) lampNearest = +dl.toFixed(1);
        }
      }
      return {
        province_loaded: true,
        frame: e.sim.frame,
        cell: e.cellFor(e.sim.env),
        at: [+x.toFixed(1), +z.toFixed(1)],
        player: [+p[0].toFixed(1), +p[2].toFixed(1)],
        region: e.field.regionAt(x, z).id,
        tile_radius: R,
        tilesResident: s.tilesResident, tilesQueued: s.tilesQueued, tilesBuiltTotal: s.tilesBuiltTotal,
        ring_want: want, ring_built: built, ring_unbuilt: want - built,
        near_ring_want: nearWant, near_ring_built: nearBuilt, near_ring_unbuilt: nearWant - nearBuilt,
        ground_underfoot_built: underfoot,
        unbuilt_keys: unbuilt.slice(0, 30),
        // What `request()` is the only refresh for:
        stream_focus: pv.focus.map((v) => +v.toFixed(1)),
        stream_focus_lag_m: d(pv.focus),
        skin_lag_m: d(pv.skinAtPos), skin_vertices: skinVerts,
        near_lag_m: d(pv.nearAtPos), near_instances: nearInstances,
        cover_lag_m: d(pv.coverAt), cover_instances: coverInstances,
        night_factor: +pv.nightFactor.toFixed(3), lamps_lit: lampsLit, nearest_lamp_m: lampNearest,
        sig_lights_created: pv.sigLights ? pv.sigLights.length : 0,
      };
    },
    /**
     * WALK IN A STRAIGHT LINE AND TIME EVERY SINGLE STEP.
     *
     * The frame-budget instrument. `walkRoute()` cannot be used for this: it rebuilds a speed
     * histogram over every sample it has ever taken on each call, so driving it one frame at a
     * time is O(n^2) in the tool and the tool's cost swamps the game's. This holds the stick at a
     * fixed bearing and drives `loop.stepOnce()` + `engine._afterStep()` directly — the same two
     * calls `walkRoute`, `walkPath`, `travelRide` and `stepFrames` all make — so what is timed is
     * the step and nothing else. Identical on a tree with the fix and a tree without it, which is
     * what makes the two comparable.
     */
    walkTimed(n, routeId, mag) {
      const e = window.__ENGINE;
      const p = e.sim.player;
      // Follow the same authored road spline `walkRoute` follows, assembled the same way, so this
      // walks real ground across real region borders instead of into the Topal Bay.
      const R = e.data.roads;
      const named = R.named_routes[routeId];
      const pts = [];
      for (let i = 0; i + 1 < named.settlements.length; i++) {
        const a = named.settlements[i], b = named.settlements[i + 1];
        const leg = R.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
        const q = leg.from === a ? leg.points : leg.points.slice().reverse();
        for (let k = (pts.length ? 1 : 0); k < q.length; k++) pts.push([q[k][0], q[k][1]]);
      }
      // ONE setup teleport to the start of the route, exactly as walkRoute does, and then nothing
      // teleports again for the rest of the walk. Identical on both trees.
      e.teleport(pts[0][0], pts[0][1]);
      let idx = 1;
      const t = new Float64Array(n);
      const what = new Uint8Array(n);
      const evCount = {}, evMs = {};
      const x0 = p.pos[0], z0 = p.pos[2];
      const builtBefore = e.renderer.province ? e.renderer.province.built : 0;
      let dist = 0;
      for (let i = 0; i < n; i++) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const tg = pts[idx];
        const b = Math.atan2(tg[0] - p.pos[0], tg[1] - p.pos[2]);
        const cy = e.sim.camera.yaw * Math.PI / 180;
        e.input.reset(e.sim.frame);
        const script = [{ f: 0, move: [Math.sin(b - cy) * mag, Math.cos(b - cy) * mag] }];
        if (e.traversal && e.traversal.mired) { script.push({ f: 0, press: ['roll'] }); script.push({ f: 1, release: ['roll'] }); }
        e.input.queueInputs(script, e.sim.frame);
        const px = p.pos[0], pz = p.pos[2];
        // ATTRIBUTION. `updateSkin/Near/Cover` assign a NEW array only on the frames they actually
        // rebuild, so an identity comparison across the step says exactly which of the four things
        // `request()` drives did work on this frame. No timers inside the engine, no instrumented
        // build.
        const pv = e.renderer.province;
        const s0 = pv.skinAtPos, n0 = pv.nearAtPos, c0 = pv.coverAt, b0 = pv.built;
        const a = performance.now();
        e.loop.stepOnce(); e._afterStep();
        t[i] = performance.now() - a;
        const did = (pv.skinAtPos !== s0 ? 1 : 0) | (pv.nearAtPos !== n0 ? 2 : 0)
          | (pv.coverAt !== c0 ? 4 : 0) | (pv.built !== b0 ? 8 : 0);
        what[i] = did;
        if (did) { evCount[did] = (evCount[did] || 0) + 1; evMs[did] = (evMs[did] || 0) + t[i]; }
        dist += Math.hypot(p.pos[0] - px, p.pos[2] - pz);
      }
      const sorted = Float64Array.from(t).sort();
      const q = (f) => +sorted[Math.min(n - 1, Math.floor(n * f))].toFixed(4);
      let total = 0; for (let i = 0; i < n; i++) total += t[i];
      const over = (ms) => { let c = 0; for (let i = 0; i < n; i++) if (t[i] > ms) c++; return c; };
      return {
        frames: n, route: routeId, stick: mag,
        path_m: +dist.toFixed(1),
        walked_m: +Math.hypot(p.pos[0] - x0, p.pos[2] - z0).toFixed(1),
        from: [+x0.toFixed(1), +z0.toFixed(1)], to: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
        tiles_built_during_walk: (e.renderer.province ? e.renderer.province.built : 0) - builtBefore,
        total_ms: +total.toFixed(1), mean_ms: +(total / n).toFixed(4),
        p50_ms: q(0.50), p95_ms: q(0.95), p99_ms: q(0.99), p999_ms: q(0.999),
        max_ms: +sorted[n - 1].toFixed(3),
        // 16.7 ms is one 60 Hz frame; 8.3 ms is half of one. A step that costs more than a frame
        // is the hitch RI-PLT03 forbids at a region border.
        steps_over_8_3ms: over(8.3), steps_over_16_7ms: over(16.7), steps_over_50ms: over(50),
        // What the expensive frames were doing. bit 1 = ground skin rebuilt, 2 = near-prop disc,
        // 4 = ground-cover disc, 8 = a tile was built.
        work: Object.fromEntries(Object.keys(evCount).map((k) => {
          const b = Number(k), tag = [];
          if (b & 1) tag.push('skin'); if (b & 2) tag.push('near');
          if (b & 4) tag.push('cover'); if (b & 8) tag.push('tile');
          return [tag.join('+'), { frames: evCount[k], total_ms: +evMs[k].toFixed(1), mean_ms: +(evMs[k] / evCount[k]).toFixed(2) }];
        })),
        idle_frames: n - Object.values(evCount).reduce((a, v) => a + v, 0),
      };
    },
    /** Walk toward a world point for n fixed steps, through the game's own locomotion. */
    walkToward(tx, tz, n) {
      const e = window.__ENGINE;
      const p = e.sim.player;
      const mag = 0.55 - 1e-9;
      for (let i = 0; i < n; i++) {
        const b = Math.atan2(tx - p.pos[0], tz - p.pos[2]);
        const cy = e.sim.camera.yaw * Math.PI / 180;
        e.input.reset(e.sim.frame);
        const script = [{ f: 0, move: [Math.sin(b - cy) * mag, Math.cos(b - cy) * mag] }];
        if (e.traversal && e.traversal.mired) { script.push({ f: 0, press: ['roll'] }); script.push({ f: 1, release: ['roll'] }); }
        e.input.queueInputs(script, e.sim.frame);
        e.loop.stepOnce(); e._afterStep();
        if (Math.hypot(p.pos[0] - tx, p.pos[2] - tz) < 20) break;
      }
      return [p.pos[0], p.pos[2]];
    },
    /** Wall-clock cost of the last k fixed steps, and the worst single step in the window. */
    stepCost(k) {
      const e = window.__ENGINE;
      const t0 = performance.now();
      let worst = 0, worstFrame = -1;
      for (let i = 0; i < k; i++) {
        const a = performance.now();
        e.loop.stepOnce(); e._afterStep();
        const dt = performance.now() - a;
        if (dt > worst) { worst = dt; worstFrame = e.sim.frame; }
      }
      const total = performance.now() - t0;
      return { frames: k, total_ms: +total.toFixed(2), mean_ms: +(total / k).toFixed(4),
        worst_step_ms: +worst.toFixed(2), worst_at_frame: worstFrame };
    },
  };
  return true;
};

const handle = await launchGame({ ...args, width: 320, height: 240 });
const report = {
  tool: 'tools/world/prov-stream.mjs', mode: MODE, state: STATE, git: gitInfo(),
  taken_at: new Date().toISOString(), loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  perturbation: { tile_radius: TILE_RADIUS, skin_radius: SKIN_RADIUS },
  samples: [],
};
try {
  await handle.h('setRenderRate', 0);          // AGENT-PROTOCOL: before ANY stepping loop
  await handle.h('setSeed', 1337);
  await handle.h('loadState', STATE);
  await handle.h('setTide', 'LOW');
  await handle.page.evaluate(INSTALL_INSPECTOR);

  if (args.night) {
    // The region's night lamps are the fourth thing `request()` is the only refresh for, and they
    // only exist once `nightFactor > 0` — which `renderer.render()` sets off the sun elevation.
    // So: put the clock at 01:00 and let the renderer run for exactly one frame to light them,
    // then turn rendering off again and walk. Nothing here touches the streamer.
    await handle.h('setTimeOfDay', 1.0);
    await handle.h('setRenderRate', 60);
    await handle.h('stepFrames', 1);
    await handle.h('setRenderRate', 0);
    report.night = await handle.page.evaluate(() => ({
      night_factor: window.__ENGINE.renderer.province.nightFactor,
      lamps: (window.__ENGINE.renderer.province.sigLights || []).length,
    }));
  }

  if (TILE_RADIUS !== null || SKIN_RADIUS !== null) {
    report.perturbation.applied = await handle.page.evaluate(([tr, sr]) => {
      const pv = window.__ENGINE.renderer.province;
      const before = { tile_radius: pv.radiusTiles, skin_radius: pv.skinRadiusM };
      if (tr !== null) pv.radiusTiles = tr;
      if (sr !== null) pv.skinRadiusM = sr;
      // Drop everything already built so the walk rebuilds under the new setting.
      for (const k of [...pv.tiles.keys()]) pv._release(k, pv.tiles.get(k));
      pv.queue.length = 0;
      pv.skinAtPos = null; pv.nearAtPos = null; pv.coverAt = null;
      return { before, after: { tile_radius: pv.radiusTiles, skin_radius: pv.skinRadiusM } };
    }, [TILE_RADIUS, SKIN_RADIUS]);
  }

  report.after_load = await handle.page.evaluate(() => window.__PROBE.look(null));

  if (MODE === 'camera3km') {
    // The critic's setup: nothing teleports, the camera goes 3 km out, the sim runs.
    const start = report.after_load.player;
    const to = await handle.page.evaluate(([sx, sz]) => {
      const e = window.__ENGINE;
      // 3 km along the vector toward the middle of the province, clamped inside the bounds.
      const cx = e.field.sizeX / 2, cz = e.field.sizeZ / 2;
      let dx = cx - sx, dz = cz - sz;
      const L = Math.hypot(dx, dz) || 1;
      const x = sx + (dx / L) * 3000, z = sz + (dz / L) * 3000;
      return [Math.max(60, Math.min(e.field.sizeX - 60, x)), Math.max(60, Math.min(e.field.sizeZ - 60, z))];
    }, start);
    report.camera_at = to;
    report.camera_distance_m = +Math.hypot(to[0] - start[0], to[1] - start[1]).toFixed(1);
    const y = await handle.page.evaluate(([x, z]) => window.__ENGINE.field.heightAt(x, z) + 1.7, to);
    await handle.h('camera', { pos: [to[0], y, to[1]], look: [to[0] + 10, y - 1, to[1] + 10] });
    report.before_steps = await handle.page.evaluate(([x, z]) => window.__PROBE.look([x, z]), to);
    report.cost = await handle.page.evaluate((n) => window.__PROBE.stepCost(n), FRAMES);
    report.after_steps = await handle.page.evaluate(([x, z]) => window.__PROBE.look([x, z]), to);
    log(`camera3km: after ${FRAMES} frames — ring_built ${report.after_steps.ring_built}/${report.after_steps.ring_want}, ` +
        `unbuilt ${report.after_steps.ring_unbuilt}, tilesResident ${report.after_steps.tilesResident}`);
  } else if (MODE === 'nightlamp') {
    // Do the region's NIGHT LAMPS move with the player? They are the fourth thing `request()` is
    // the only refresh for, and the crossing road never passes within the 160 m lamp range of a
    // glowing signature (nearest on the walked route: 281 m), so this walks at one on purpose.
    // ONE setup teleport to put the body 300 m from a welkynd pillar, then WALKED the rest.
    report.lamp = await handle.page.evaluate(() => {
      const e = window.__ENGINE;
      const sig = e.field.sig;
      const p = e.sim.player.pos;
      let best = null;
      for (const it of sig.items) {
        if (it.kind !== 'welkynd_pillar') continue;
        const d = Math.hypot(it.x - p[0], it.z - p[2]);
        if (!best || d < best.d) best = { x: it.x, z: it.z, d, kind: it.kind };
      }
      return best;
    });
    // Stand 300 m off, on the bearing back toward where the body already is.
    const startAt = await handle.page.evaluate((L) => {
      const e = window.__ENGINE;
      const p = e.sim.player.pos;
      let ux = p[0] - L.x, uz = p[2] - L.z;
      const n = Math.hypot(ux, uz) || 1;
      return [L.x + (ux / n) * 300, L.z + (uz / n) * 300];
    }, report.lamp);
    await handle.h('teleport', startAt[0], startAt[1]);
    report.lamp_walk = [];
    for (let i = 0; i < 14; i++) {
      const s = await handle.page.evaluate(() => window.__PROBE.look(null));
      s.lamp_target_m = +Math.hypot(s.player[0] - report.lamp.x, s.player[1] - report.lamp.z).toFixed(1);
      report.lamp_walk.push(s);
      if (s.lamp_target_m < 25) break;
      await handle.page.evaluate(([lx, lz]) => window.__PROBE.walkToward(lx, lz, 1500), [report.lamp.x, report.lamp.z]);
    }
    report.after_steps = await handle.page.evaluate(() => window.__PROBE.look(null));
    for (const s of report.lamp_walk) {
      log(`  ${s.lamp_target_m} m from the pillar — lamps created ${s.sig_lights_created}, lit ${s.lamps_lit}, nearest ${s.nearest_lamp_m} m, underfoot ${s.ground_underfoot_built}`);
    }
  } else if (MODE === 'budget') {
    // THE FRAME-BUDGET MEASUREMENT. Walk in a straight line, time every step. Run this on a tree
    // with the fix and on a tree with the call site deleted and the two are directly comparable:
    // the difference is what streaming from the step costs.
    report.before = await handle.page.evaluate(() => window.__PROBE.look(null));
    report.budget = await handle.page.evaluate(([n, b, m]) => window.__PROBE.walkTimed(n, b, m),
      [Number(args_frames), String(args.route || 'crossing'), 0.55 - 1e-9]);
    report.after_steps = await handle.page.evaluate(() => window.__PROBE.look(null));
    report.cost = report.budget;
    log(`budget: ${report.budget.path_m} m of path in ${report.budget.frames} frames, ` +
        `${report.budget.tiles_built_during_walk} tiles built; mean ${report.budget.mean_ms} ms, ` +
        `p99 ${report.budget.p99_ms} ms, max ${report.budget.max_ms} ms, ` +
        `>16.7ms ${report.budget.steps_over_16_7ms}; ring ${report.after_steps.ring_built}/${report.after_steps.ring_want}`);
  } else if (MODE === 'walked3km') {
    // The dispatch's headline, with the CAMERA REPLACED BY A BODY. Walk the player 3 km from the
    // start through the game's own locomotion — no teleport after the state loads — then take the
    // critic's 600 fixed steps and count the ring around where the player actually is.
    let r = await handle.h('walkRoute', { route: 'crossing', speed: SPEED, restart: true, chunkFrames: 1, stream: false });
    const start = await handle.page.evaluate(() => window.__PROBE.look(null));
    report.walk_start = start;
    let guard = 0;
    while (!r.done && guard++ < 400) {
      const far = await handle.page.evaluate(([sx, sz]) => {
        const p = window.__ENGINE.sim.player.pos;
        return +Math.hypot(p[0] - sx, p[2] - sz).toFixed(1);
      }, start.player);
      if (far >= 3000) break;
      r = await handle.h('walkRoute', { route: 'crossing', speed: SPEED, chunkFrames: 3000, stream: false });
    }
    report.straight_line_from_start_m = await handle.page.evaluate(([sx, sz]) => {
      const p = window.__ENGINE.sim.player.pos;
      return +Math.hypot(p[0] - sx, p[2] - sz).toFixed(1);
    }, start.player);
    report.walk = r;
    report.before_steps = await handle.page.evaluate(() => window.__PROBE.look(null));
    report.cost = await handle.page.evaluate((n) => window.__PROBE.stepCost(n), FRAMES);
    report.after_steps = await handle.page.evaluate(() => window.__PROBE.look(null));
    log(`walked3km: ${report.straight_line_from_start_m} m from start, ${r.path_m.toFixed(0)} m of path; ` +
        `after ${FRAMES} more frames — ring_built ${report.after_steps.ring_built}/${report.after_steps.ring_want}, ` +
        `unbuilt ${report.after_steps.ring_unbuilt}, tilesResident ${report.after_steps.tilesResident}, ` +
        `underfoot ${report.after_steps.ground_underfoot_built}`);
  } else {
    // WALKED. `walkRoute` drives the same locomotion a player's stick does, through
    // `loop.stepOnce()` + `_afterStep()`, and it does NOT set `opts.stream`.
    const route = MODE === 'crossing' ? 'crossing' : 'crossing';
    let r = await handle.h('walkRoute', { route, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
    report.samples.push(await handle.page.evaluate(() => window.__PROBE.look(null)));
    const limitFrames = MODE === 'crossing' ? Infinity : Math.ceil(METRES / (SPEED === 'jog' ? 3.2 : 2.0) * 60);
    let guard = 0, cost = { frames: 0, total_ms: 0, worst_step_ms: 0, worst_at_frame: -1 };
    while (!r.done && guard++ < 4000) {
      const t0 = Date.now();
      const chunk = Math.min(SAMPLE, limitFrames === Infinity ? SAMPLE : Math.max(1, limitFrames - r.frames));
      const before = await handle.page.evaluate(() => performance.now());
      r = await handle.h('walkRoute', { route, speed: SPEED, chunkFrames: chunk, stream: false });
      const wall = await handle.page.evaluate((b) => performance.now() - b, before);
      cost.frames += chunk; cost.total_ms += wall;
      const s = await handle.page.evaluate(() => window.__PROBE.look(null));
      s.walk_frames = r.frames; s.walk_m = r.path_m; s.chunk_wall_ms = +wall.toFixed(1);
      s.chunk_frames = chunk; s.chunk_ms_per_frame = +(wall / chunk).toFixed(4);
      report.samples.push(s);
      if (report.samples.length % 8 === 0 || r.done) {
        log(`  ${(r.frames / 3600).toFixed(1)} min, ${r.path_m.toFixed(0)} m, region ${s.region}, ` +
            `ring ${s.ring_built}/${s.ring_want}, underfoot ${s.ground_underfoot_built}, ${(wall / chunk).toFixed(3)} ms/frame`);
      }
      if (limitFrames !== Infinity && r.frames >= limitFrames) break;
    }
    cost.mean_ms = cost.frames ? +(cost.total_ms / cost.frames).toFixed(4) : 0;
    cost.total_ms = +cost.total_ms.toFixed(1);
    report.cost = cost;
    report.walk = r;
    report.final = await handle.page.evaluate(() => window.__PROBE.look(null));
  }
  report.province_stats = await handle.h('getProvinceStats');
  report.errors = handle.errors.slice(0, 10);
} finally { await handle.close(); }

// ---- the verdict this tool is allowed to reach ------------------------------------------------
const rows = (MODE === 'camera3km' || MODE === 'walked3km' || MODE === 'budget') ? [report.after_steps] : report.samples.slice(1);
const worstRing = rows.length ? Math.max(...rows.map((s) => s.ring_unbuilt)) : null;
const everUnderfootMissing = rows.filter((s) => !s.ground_underfoot_built).length;
const worstFocusLag = rows.length ? Math.max(...rows.map((s) => s.stream_focus_lag_m || 0)) : null;
const worstSkinLag = rows.length ? Math.max(...rows.map((s) => s.skin_lag_m === null ? 0 : s.skin_lag_m)) : null;
const worstNearLag = rows.length ? Math.max(...rows.map((s) => s.near_lag_m === null ? 0 : s.near_lag_m)) : null;
const worstCoverLag = rows.length ? Math.max(...rows.map((s) => s.cover_lag_m === null ? 0 : s.cover_lag_m)) : null;
const worstNear = rows.length ? Math.max(...rows.map((s) => s.near_ring_unbuilt)) : null;
report.summary = {
  samples: rows.length,
  worst_ring_unbuilt: worstRing,
  worst_near_ring_unbuilt: worstNear,
  samples_with_no_ground_underfoot: everUnderfootMissing,
  worst_stream_focus_lag_m: worstFocusLag,
  worst_skin_lag_m: worstSkinLag,
  worst_near_lag_m: worstNearLag,
  worst_cover_lag_m: worstCoverLag,
  // THE BAR. Ground under the body on every sample, and nothing unbuilt inside 450 m. The outer
  // ring is allowed to be mid-trickle: it is 600-750 m out and behind the fog.
  streamed_from_the_simulation: worstNear === 0 && everUnderfootMissing === 0,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
log(`wrote ${path.relative(REPO_ROOT, OUT)}`);
log(JSON.stringify(report.summary, null, 2));
process.exit(report.summary.streamed_from_the_simulation ? 0 : 1);
