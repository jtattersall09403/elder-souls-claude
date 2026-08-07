#!/usr/bin/env node
/**
 * critic-prov-r1.mjs — an INDEPENDENT probe of `Engine._streamProvince()`.
 *
 * Written by the W1-01 province-stream critic (round 1). It deliberately does NOT reuse
 * `tools/world/prov-stream.mjs`, which is the builder's own instrument; where a number here can
 * be compared with one of the builder's, that is the point.
 *
 * What it refuses to do, for the same reason the builder's probe refuses:
 *   - it never calls `request()`, `pump()`, `drain()` or `__HARNESS.streamAround()`;
 *   - it reads `province.tiles` / `province.focus` / the four discs only.
 * The world either builds itself under a moving body, or this reports that it does not.
 *
 * WHAT IT ADDS OVER THE BUILDER'S PROBE — the ways of moving the builder did not test:
 *   --mode modality   each way a body can move, one at a time: raw player input through
 *                     `stepFrames`, `walkPath`, `travelRide` (a vehicle, at up to 40 m/s), a
 *                     teleport followed by a walk, a walk BACKWARDS over ground already released,
 *                     and standing still while only the camera moves.
 *   --mode raf        the rAF accumulator under REAL wall-clock time in mode 'play'. This is the
 *                     only mode a player ever runs in, and it is the only one where a 133 ms step
 *                     costs simulation time: `FixedLoop.MAX_CATCHUP` is 5, so nine frames of
 *                     arrears become five steps and four DROPPED. Reports catchupClamps /
 *                     catchupDroppedMs, which no other probe in the tree has ever read.
 *   --mode fight      a real fight in the province, with the streamer live, timing every step and
 *                     asking WHICH COMBAT PHASE the expensive steps landed in. ARBITRATION says
 *                     Souls wins inside the fight; a 60 ms hitch inside a 14-frame i-frame window
 *                     is Morrowind leaking into it.
 *   --mode loop       a long closed loop, watching resident tiles, meshes, instances and the JS
 *                     heap for a release-hysteresis leak.
 *   --mode posed      the `shoot.mjs --direct` path: pose a camera with `camera({pos, look})`,
 *                     step, and ask whether the ground the camera is ABOUT TO PHOTOGRAPH is built
 *                     — measured at the camera eye AND at the look target, because the focus
 *                     follows the eye and the picture is of the target.
 *
 * FALSIFICATION. `--break-fix` neuters `Engine._streamProvince` in the page before the run. Every
 * mode must go red under it or the mode is not evidence. Run it; do not assume it.
 *
 * Usage:
 *   node tools/world/critic-prov-r1.mjs --mode modality --out reports/.../modality.json
 *   node tools/world/critic-prov-r1.mjs --mode fight --break-fix --out .../fight-broken.json
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-prov-r1.mjs — independent probe of the province streaming pump
  --mode <m>       modality | raf | fight | loop | posed        (default modality)
  --state <id>     state to load                                 (default default)
  --break-fix      neuter Engine._streamProvince before the run (falsification control)
  --frames <n>     mode-specific frame budget
  --seconds <n>    raf: wall-clock seconds to run in mode 'play' (default 20)
  --laps <n>       loop: how many times round the closed loop    (default 6)
  --out <file>     report json`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const MODE = String(args.mode || 'modality');
const STATE = String(args.state || 'default');
const BREAK = args['break-fix'] === true || String(args['break-fix']) === 'true';
const SECONDS = Number(args.seconds || 20);
const LAPS = Number(args.laps || 6);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'world', 'critic-prov-r1', `${MODE}${BREAK ? '-broken' : ''}.json`)));
ensureDir(path.dirname(OUT));

// ------------------------------------------------------------------------------------------
// Page-side probe. Read-only over the province; drives the body through the engine's own verbs.
// ------------------------------------------------------------------------------------------
const INSTALL = () => {
  const E = () => window.__ENGINE;

  /**
   * The one measurement everything here reduces to: at a point, is the ground DRAWN?
   * Computed from `province.tiles` alone. `province.stats()` is read for the tile size and the
   * ring radius so this cannot drift from the streamer's own geometry, but nothing is built,
   * released, focused or rebuilt by looking.
   */
  function look(x, z) {
    const e = E();
    const pv = e.renderer && e.renderer.province;
    if (!pv) return { province: false };
    const s = pv.stats();
    const T = s.tileSizeM, R = s.residentRadiusTiles;
    const tx0 = Math.floor(x / T), tz0 = Math.floor(z / T);
    let want = 0, built = 0, near = 0, nearBuilt = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const tx = tx0 + dx, tz = tz0 + dz;
      if (tx < 0 || tz < 0 || tx * T >= e.field.sizeX || tz * T >= e.field.sizeZ) continue;
      want++;
      const has = pv.tiles.has(`${tx},${tz}`);
      if (has) built++;
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) { near++; if (has) nearBuilt++; }
    }
    const dist = (a) => (a ? +Math.hypot(x - a[0], z - a[1]).toFixed(2) : null);
    let coverInst = 0, nearInst = 0, skinVerts = 0, meshes = 0;
    if (pv.coverGroup) pv.coverGroup.traverse((o) => { if (o.isInstancedMesh) coverInst += o.count; });
    if (pv.nearGroup) pv.nearGroup.traverse((o) => { if (o.isInstancedMesh) nearInst += o.count; });
    if (pv.skinMesh) skinVerts = pv.skinMesh.geometry.attributes.position.count;
    pv.group.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    return {
      province: true, frame: e.sim.frame,
      at: [+x.toFixed(1), +z.toFixed(1)],
      underfoot_built: pv.tiles.has(`${tx0},${tz0}`),
      ring_want: want, ring_built: built, ring_unbuilt: want - built,
      near9_want: near, near9_unbuilt: near - nearBuilt,
      tiles_resident: s.tilesResident, tiles_queued: s.tilesQueued, tiles_built_total: s.tilesBuiltTotal,
      focus_lag_m: dist(pv.focus), skin_lag_m: dist(pv.skinAtPos),
      near_lag_m: dist(pv.nearAtPos), cover_lag_m: dist(pv.coverAt),
      skin_vertices: skinVerts, cover_instances: coverInst, near_instances: nearInst,
      province_meshes: meshes,
      region: e.field.regionAt(x, z).id,
    };
  }
  function lookAtPlayer() { const p = E().sim.player.pos; return look(p[0], p[2]); }

  /** Neuter the pump. The rest of the engine is untouched, so this isolates ONE call. */
  function breakFix() {
    const e = E();
    e._streamProvince = function () { /* the defect, restored */ };
    return typeof e._streamProvince === 'function';
  }

  /** Hold the stick toward a point for n steps, through the game's own locomotion + input. */
  function drive(tx, tz, n, mag = 0.55 - 1e-9, timed = false) {
    const e = E(), p = e.sim.player;
    const t = timed ? new Float64Array(n) : null;
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const b = Math.atan2(tx - p.pos[0], tz - p.pos[2]);
      const cy = e.sim.camera.yaw * Math.PI / 180;
      e.input.reset(e.sim.frame);
      const script = [{ f: 0, move: [Math.sin(b - cy) * mag, Math.cos(b - cy) * mag] }];
      if (e.traversal && e.traversal.mired) { script.push({ f: 0, press: ['roll'] }); script.push({ f: 1, release: ['roll'] }); }
      e.input.queueInputs(script, e.sim.frame);
      const x0 = p.pos[0], z0 = p.pos[2];
      const a = timed ? performance.now() : 0;
      e.loop.stepOnce(); e._afterStep();
      if (timed) t[i] = performance.now() - a;
      dist += Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
    }
    return { dist: +dist.toFixed(1), t };
  }

  function stats(arr) {
    const n = arr.length; if (!n) return null;
    const s = Float64Array.from(arr).sort();
    const q = (f) => +s[Math.min(n - 1, Math.floor(n * f))].toFixed(4);
    let tot = 0; for (let i = 0; i < n; i++) tot += arr[i];
    let o8 = 0, o16 = 0, o50 = 0;
    for (let i = 0; i < n; i++) { if (arr[i] > 8.3) o8++; if (arr[i] > 16.7) o16++; if (arr[i] > 50) o50++; }
    return { n, mean_ms: +(tot / n).toFixed(4), p50_ms: q(0.5), p99_ms: q(0.99), p999_ms: q(0.999),
      max_ms: +s[n - 1].toFixed(3), over_8_3: o8, over_16_7: o16, over_50: o50 };
  }

  window.__CP = {
    look, lookAtPlayer, breakFix, drive, stats,

    /** The route the crossing follows, assembled from the authored road legs. */
    routePoints(routeId) {
      const R = E().data.roads, named = R.named_routes[routeId];
      const pts = [];
      for (let i = 0; i + 1 < named.settlements.length; i++) {
        const a = named.settlements[i], b = named.settlements[i + 1];
        const leg = R.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
        const q = leg.from === a ? leg.points : leg.points.slice().reverse();
        for (let k = (pts.length ? 1 : 0); k < q.length; k++) pts.push([q[k][0], q[k][1]]);
      }
      return pts;
    },

    // ---- MODE: modality ------------------------------------------------------------------
    /**
     * A. RAW PLAYER INPUT. No walkRoute, no walkPath — the stick, held, through `stepFrames()`,
     * which is what a player's hand does. The builder never tested this path end to end.
     */
    modalityRawInput(metres) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      e.teleport(pts[0][0], pts[0][1]);
      const start = this.lookAtPlayer();
      let idx = 1, dist = 0, frames = 0;
      const samples = [];
      let worstNear = 0, noGround = 0, checks = 0;
      while (dist < metres && frames < 200000) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const x0 = p.pos[0], z0 = p.pos[2];
        // stepFrames() is the harness verb; it is what every capture and every probe drives.
        const b = Math.atan2(pts[idx][0] - p.pos[0], pts[idx][1] - p.pos[2]);
        const cy = e.sim.camera.yaw * Math.PI / 180;
        e.input.reset(e.sim.frame);
        const sc = [{ f: 0, move: [Math.sin(b - cy) * 0.549999999, Math.cos(b - cy) * 0.549999999] }];
        if (e.traversal && e.traversal.mired) { sc.push({ f: 0, press: ['roll'] }); sc.push({ f: 1, release: ['roll'] }); }
        e.input.queueInputs(sc, e.sim.frame);
        e.stepFrames(1);
        dist += Math.hypot(p.pos[0] - x0, p.pos[2] - z0); frames++;
        if (frames % 600 === 0) {
          const L = this.lookAtPlayer(); checks++;
          if (!L.underfoot_built) noGround++;
          worstNear = Math.max(worstNear, L.near9_unbuilt);
          if (frames % 3000 === 0) samples.push({ m: +dist.toFixed(1), ...L });
        }
      }
      return { how: 'raw stick + stepFrames(1)', frames, path_m: +dist.toFixed(1), start,
        end: this.lookAtPlayer(), checks, samples_with_no_ground: noGround,
        worst_near9_unbuilt: worstNear, samples };
    },

    /** B. walkPath — the engine's own point-to-point walker. */
    modalityWalkPath(metres) {
      const e = E();
      const pts = this.routePoints('crossing');
      // Take enough of the spline to cover `metres`, so this is a WALK, not a teleport.
      let cum = 0; const use = [pts[0]];
      for (let i = 1; i < pts.length && cum < metres; i++) {
        cum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        use.push(pts[i]);
      }
      const before = this.look(use[0][0], use[0][1]);
      const r = e.walkPath(use, { speed: 'walk' });
      return { how: 'engine.walkPath', before, result: r, end: this.lookAtPlayer() };
    },

    /**
     * C. travelRide — a VEHICLE. The body is written directly at the mode's speed, and the
     * fastest mode in the network is far quicker than a walk. Nothing in the streamer's budget
     * was sized for it.
     */
    modalityRide(serviceId) {
      const e = E();
      const net = e.getTravelNetwork();
      if (!net.present) return { how: 'travelRide', skipped: 'no travel network' };
      const svc = serviceId ? net.services.find((s) => s.id === serviceId)
        : net.services.slice().sort((a, b) => (b.route_m / b.game_min) - (a.route_m / a.game_min))[0];
      const st = net.stations.find((q) => q.id === svc.from);
      e.teleport(st.arrive_at ? st.arrive_at[0] : st.x, st.arrive_at ? st.arrive_at[1] : st.z);
      e.combat.world.gold = 100000;
      // FARE GATE, NOT THE THING UNDER TEST. Every service refuses at a cold start with "You have
      // not walked the <leg> road", so the fastest movement modality in the build is unreachable
      // without first walking it. Granting the walked-road credit is the same class of concession
      // as granting the gold: it opens the door, it does not touch the streamer. Declared under
      // method_deviations.
      for (const [id, len] of e.travel.legLen) e.travel.walked.set(id, len);
      let board = null, boardErr = null;
      // `boardTravel(id, {frames: 0})` calls travelRide(0) and can leave no ride at all; board
      // with one frame so the ride object exists, then drive it a frame at a time.
      try { board = e.boardTravel(svc.id, { frames: 1 }); }
      catch (err) { boardErr = String(err && err.message); }
      const p = e.sim.player;
      const r = e.travel && e.travel.ride;
      if (!r) return { how: 'travelRide', service: svc.id, mode: svc.mode, route_m: svc.route_m,
        skipped: boardErr || 'boardTravel left no ride', board };
      const speed_mps = r ? +(r.svc.built_route_m / (r.frames / 60)).toFixed(2) : null;
      const samples = []; const t = [];
      let noGround = 0, checks = 0, worstNear = 0, worstRing = 0, frames = 0;
      while (e.travel.ride && !e.travel.ride.done && frames < 200000) {
        const a = performance.now();
        const res = e.travelRide(1);
        t.push(performance.now() - a);
        frames++;
        if (frames % 60 === 0) {
          const L = this.look(p.pos[0], p.pos[2]); checks++;
          if (!L.underfoot_built) noGround++;
          worstNear = Math.max(worstNear, L.near9_unbuilt);
          worstRing = Math.max(worstRing, L.ring_unbuilt);
          if (frames % 300 === 0) samples.push({ f: frames, ...L });
        }
        if (res.done) break;
      }
      return { how: 'travelRide (vehicle)', service: svc.id, mode: svc.mode,
        route_m: svc.route_m, speed_mps, frames, checks,
        samples_with_no_ground: noGround, worst_near9_unbuilt: worstNear, worst_ring_unbuilt: worstRing,
        step_ms: this.stats(t), samples, end: this.lookAtPlayer() };
    },

    /**
     * D. TELEPORT THEN WALK. A teleport calls `request()` itself, so the ring exists on arrival.
     * The question is whether the pump then keeps up from a cold start — and whether the urgent
     * path (which is exempt from the one-unit-per-step budget) fires here.
     */
    modalityTeleportThenWalk(metres) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      // Land two thirds of the way along, where nothing has ever been built.
      const far = pts[Math.floor(pts.length * 0.66)];
      e.teleport(far[0], far[1]);
      const onArrival = this.lookAtPlayer();
      const r = this.drive(pts[Math.floor(pts.length * 0.66) + 40][0], pts[Math.floor(pts.length * 0.66) + 40][1],
        Math.round(metres / 2.0 * 60), 0.549999999, true);
      return { how: 'teleport then walk', on_arrival: onArrival, walked_m: r.dist,
        step_ms: this.stats(Array.from(r.t)), end: this.lookAtPlayer() };
    },

    /**
     * E. WALK OUT AND WALK BACK. Ground released behind the body must come back when the body
     * returns to it — and it must come back before the body is standing on the hole.
     */
    modalityThereAndBack(metres) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      e.teleport(pts[0][0], pts[0][1]);
      const home = [p.pos[0], p.pos[2]];
      // Out, far enough that home is released (KEEP = radius + 1 tiles = 900 m at 300 m tiles).
      let idx = 1, dist = 0, frames = 0;
      while (dist < metres && frames < 200000) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const x0 = p.pos[0], z0 = p.pos[2];
        this.drive(pts[idx][0], pts[idx][1], 1);
        dist += Math.hypot(p.pos[0] - x0, p.pos[2] - z0); frames++;
      }
      const atFarEnd = this.lookAtPlayer();
      const homeFromFar = this.look(home[0], home[1]);   // is home released?
      // Back, along the same spline, sampling the whole way.
      let back = 0, noGround = 0, checks = 0, worstNear = 0, f2 = 0;
      const t = [];
      while (back < metres * 1.05 && f2 < 200000) {
        while (idx > 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx--;
        const x0 = p.pos[0], z0 = p.pos[2];
        const a = performance.now();
        this.drive(pts[idx][0], pts[idx][1], 1);
        t.push(performance.now() - a);
        back += Math.hypot(p.pos[0] - x0, p.pos[2] - z0); f2++;
        if (f2 % 120 === 0) {
          const L = this.lookAtPlayer(); checks++;
          if (!L.underfoot_built) noGround++;
          worstNear = Math.max(worstNear, L.near9_unbuilt);
        }
        if (Math.hypot(p.pos[0] - home[0], p.pos[2] - home[1]) < 6) break;
      }
      return { how: 'walk out, walk back over released ground', out_m: +dist.toFixed(1),
        at_far_end: atFarEnd, home_seen_from_far_end: homeFromFar,
        back_m: +back.toFixed(1), back_checks: checks, back_samples_with_no_ground: noGround,
        back_worst_near9_unbuilt: worstNear, back_step_ms: this.stats(t),
        home_on_return: this.lookAtPlayer() };
    },

    /**
     * F. STAND STILL, MOVE THE CAMERA. In play `sim.camera.override` is null, so the focus is the
     * body and nothing should stream. Under a posed override it should follow the eye. Both are
     * assertions about the SAME line and both need checking.
     */
    modalityStillBody(frames) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      e.teleport(pts[0][0], pts[0][1]);
      const before = this.lookAtPlayer();
      const t0 = e.renderer.province.built;
      // (i) orbit the gameplay camera; body still.
      for (let i = 0; i < frames; i++) {
        e.sim.camera.yaw = (e.sim.camera.yaw + 3) % 360;
        e.input.reset(e.sim.frame);
        e.loop.stepOnce(); e._afterStep();
      }
      const afterOrbit = this.lookAtPlayer();
      const builtByOrbit = e.renderer.province.built - t0;
      // (ii) pose the eye 2 km away; body still. The focus should MOVE to the eye.
      const far = pts[Math.floor(pts.length * 0.5)];
      const t1 = e.renderer.province.built;
      e.camera({ pos: [far[0], 40, far[1]], look: [far[0] + 30, 0, far[1] + 30] });
      for (let i = 0; i < frames; i++) { e.loop.stepOnce(); e._afterStep(); }
      const atEye = this.look(far[0], far[1]);
      const builtByPose = e.renderer.province.built - t1;
      const bodyAfter = this.lookAtPlayer();
      e.camera(null);
      return { how: 'still body', before, after_camera_orbit: afterOrbit,
        tiles_built_by_orbit: builtByOrbit,
        posed_eye_at: [+far[0].toFixed(1), +far[1].toFixed(1)],
        at_posed_eye: atEye, tiles_built_by_pose: builtByPose,
        at_body_while_eye_posed: bodyAfter,
        body_moved_m: +Math.hypot(p.pos[0] - before.at[0], p.pos[2] - before.at[1]).toFixed(2) };
    },

    // ---- MODE: fight ---------------------------------------------------------------------
    /**
     * A FIGHT, IN THE PROVINCE, WITH THE STREAMER LIVE.
     *
     * ARBITRATION: inside the fight, Souls wins. So the question is not "what is p99 while
     * walking" but "did a streaming hitch land inside an attack window or a roll". The body is
     * driven forward the whole time so the streamer keeps working — a still fighter would hide
     * every hitch, which is exactly the trap AGENT-PROTOCOL names.
     */
    fight(frames) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      e.teleport(pts[0][0], pts[0][1]);
      // Walk 400 m off the teleport so the streamer is in its steady state, not its cold start.
      let idx = 1, d = 0;
      while (d < 400) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const x0 = p.pos[0], z0 = p.pos[2];
        this.drive(pts[idx][0], pts[idx][1], 1);
        d += Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
      }
      // Spawn something that fights back, right on top of the player, and aggro it.
      // Ids read off `e.data.enemies` on this build: champion_hist_marked is the great boss,
      // inf_trash the ordinary infantry. Two of them, so the fight lasts.
      let eid = null; const spawned = [];
      for (const id of ['champion_hist_marked', 'inf_trash', 'inf_trash', 'drowned_lesser']) {
        try {
          const r = e.spawn(id, p.pos[0] + 3 + spawned.length, p.pos[2] + 3, {});
          const q = r && (r.eid || r.id || r);
          if (q) { spawned.push(String(q)); try { e.aggro(q); } catch { /* not aggroable */ } }
        } catch (err) { spawned.push('ERR:' + id + ':' + String(err && err.message)); }
      }
      eid = spawned.filter((s) => !String(s).startsWith('ERR')).join(',') || null;
      const t = new Float64Array(frames);
      const rows = [];
      const cy0 = e.sim.camera.yaw * Math.PI / 180;
      let dist = 0;
      for (let i = 0; i < frames; i++) {
        // Keep walking the road AND fight: attack every 40 frames, roll every 97 (coprime, so the
        // two drift across each other and every phase eventually meets every streaming frame).
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const b = Math.atan2(pts[idx][0] - p.pos[0], pts[idx][1] - p.pos[2]);
        const cy = e.sim.camera.yaw * Math.PI / 180;
        e.input.reset(e.sim.frame);
        const sc = [{ f: 0, move: [Math.sin(b - cy) * 0.549999999, Math.cos(b - cy) * 0.549999999] }];
        if (i % 40 === 0) { sc.push({ f: 0, press: ['light'] }); sc.push({ f: 2, release: ['light'] }); }
        if (i % 173 === 0) { sc.push({ f: 0, press: ['heavy'] }); sc.push({ f: 3, release: ['heavy'] }); }
        if (i % 97 === 0) { sc.push({ f: 0, press: ['roll'] }); sc.push({ f: 1, release: ['roll'] }); }
        e.input.queueInputs(sc, e.sim.frame);
        const pv = e.renderer.province;
        const s0 = pv.skinAtPos, n0 = pv.nearAtPos, c0 = pv.coverAt, b0 = pv.built;
        const x0 = p.pos[0], z0 = p.pos[2];
        const a = performance.now();
        e.loop.stepOnce(); e._afterStep();
        t[i] = performance.now() - a;
        dist += Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
        const did = (pv.skinAtPos !== s0 ? 1 : 0) | (pv.nearAtPos !== n0 ? 2 : 0)
          | (pv.coverAt !== c0 ? 4 : 0) | (pv.built !== b0 ? 8 : 0);
        // The combat state, read AFTER the step, on every frame. This is the axis the builder
        // never had: what was the player DOING when the streamer charged them 60 ms?
        let cs = null;
        try { cs = e.getCombatState(); } catch { /* none */ }
        const pl = cs && cs.player ? cs.player : {};
        rows.push({ i, ms: t[i], did,
          phase: pl.state === undefined ? null : pl.state,
          anim: pl.anim === undefined ? null : pl.anim,
          anim_frame: pl.anim_frame === undefined ? null : pl.anim_frame,
          iframes: !!pl.invuln,
          stam: pl.stamina === undefined ? null : pl.stamina,
          hp: pl.hp === undefined ? null : pl.hp });
      }
      // Which phases did the expensive frames land in?
      const byPhase = {}, hitchByPhase = {};
      let iframeFrames = 0, iframeHitch = 0, worstInIframe = 0, worstInPhase = {};
      for (const r of rows) {
        const ph = r.phase === null ? 'unknown' : String(r.phase);
        byPhase[ph] = (byPhase[ph] || 0) + 1;
        if (r.ms > 16.7) hitchByPhase[ph] = (hitchByPhase[ph] || 0) + 1;
        worstInPhase[ph] = Math.max(worstInPhase[ph] || 0, r.ms);
        if (r.iframes) { iframeFrames++; if (r.ms > 16.7) iframeHitch++; worstInIframe = Math.max(worstInIframe, r.ms); }
      }
      const streamFrames = rows.filter((r) => r.did);
      const nonIdle = rows.filter((r) => !r.did);
      return {
        how: 'fight while walking, streamer live', frames, eid, walked_m: +dist.toFixed(1),
        step_ms: this.stats(Array.from(t)),
        streaming_frames: streamFrames.length,
        streaming_step_ms: this.stats(streamFrames.map((r) => r.ms)),
        non_streaming_step_ms: this.stats(nonIdle.map((r) => r.ms)),
        phases_seen: byPhase, hitches_over_16_7_by_phase: hitchByPhase,
        worst_ms_by_phase: Object.fromEntries(Object.entries(worstInPhase).map(([k, v]) => [k, +v.toFixed(2)])),
        iframe_frames: iframeFrames, iframe_frames_over_16_7: iframeHitch,
        worst_ms_in_iframes: +worstInIframe.toFixed(2),
        // Every hitch, with what the player was doing.
        hitches: rows.filter((r) => r.ms > 16.7).map((r) => ({ i: r.i, ms: +r.ms.toFixed(2), did: r.did, phase: r.phase, iframes: r.iframes })),
        end: this.lookAtPlayer(),
      };
    },

    /**
     * DISPLACEMENT — the body arriving somewhere it did not walk to.
     *
     * `_streamProvince()` is called immediately after `_deathTick()`, and the builder's comment
     * says that is "so a respawn is streamed on the frame it happens". Streamed is not the same
     * as BUILT. This kills the player in the province and then samples the ground under them on
     * EVERY frame of the respawn, and does the same for the un-posing of a capture camera, which
     * is the other way a body ends up standing on ground the streamer released.
     */
    displace(after) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      const out = {};

      // (1) DEATH AND RESPAWN. Walk in first so the streamer is in its steady state.
      e.teleport(pts[0][0], pts[0][1]);
      let idx = 1, d = 0;
      while (d < 300) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const x0 = p.pos[0], z0 = p.pos[2];
        this.drive(pts[idx][0], pts[idx][1], 1);
        d += Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
      }
      const beforeDeath = this.lookAtPlayer();
      // Kill outright, through the combat model rather than by writing sim state.
      const cb = e.combat && e.combat.player;
      if (cb) cb.hp = 0;
      if (e.sim.player) e.sim.player.hp = 0;
      const track = [];
      let died = -1, moved = -1;
      let px = p.pos[0], pz = p.pos[2];
      for (let i = 0; i < after; i++) {
        e.input.reset(e.sim.frame);
        // Press through the death surface, as a player does.
        if (i > 5) e.input.queueInputs([{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }], e.sim.frame);
        const a = performance.now();
        e.loop.stepOnce(); e._afterStep();
        const ms = performance.now() - a;
        const jump = Math.hypot(p.pos[0] - px, p.pos[2] - pz);
        if (jump > 20 && moved < 0) moved = i;
        px = p.pos[0]; pz = p.pos[2];
        const L = this.lookAtPlayer();
        if (died < 0 && e.death && e.death.active) died = i;
        track.push({ i, ms: +ms.toFixed(2), jump_m: +jump.toFixed(1),
          underfoot: L.underfoot_built, near9_unbuilt: L.near9_unbuilt,
          ring_unbuilt: L.ring_unbuilt, queued: L.tiles_queued, at: L.at });
      }
      const afterJump = moved >= 0 ? track.slice(moved) : track;
      const firstClean = afterJump.findIndex((r) => r.near9_unbuilt === 0);
      const firstRing = afterJump.findIndex((r) => r.ring_unbuilt === 0);
      const firstFoot = afterJump.findIndex((r) => r.underfoot);
      out.death_respawn = {
        before_death: beforeDeath,
        death_surface_at_frame: died, body_jumped_at_frame: moved,
        jump_m: moved >= 0 ? track[moved].jump_m : null,
        frames_until_ground_underfoot: firstFoot, frames_until_near9_complete: firstClean,
        frames_until_ring_complete: firstRing < 0 ? `>${afterJump.length}` : firstRing,
        frames_standing_on_no_ground: afterJump.filter((r) => !r.underfoot).length,
        frames_with_a_hole_in_the_3x3: afterJump.filter((r) => r.near9_unbuilt > 0).length,
        worst_step_ms_after_jump: +Math.max(...afterJump.map((r) => r.ms)).toFixed(2),
        first_40_after_jump: afterJump.slice(0, 40),
      };

      // (2) A CAPTURE CAMERA POSED AND THEN RELEASED. `request()` releases every tile outside
      // KEEP of the EYE, and the eye can be kilometres from the body. When the pose is cleared
      // the body is standing on ground that no longer exists.
      e.camera(null);
      e.teleport(pts[0][0], pts[0][1]);
      e.stepFrames(120);
      const home = this.lookAtPlayer();
      const far = pts[Math.floor(pts.length * 0.6)];
      e.camera({ pos: [far[0], 40, far[1]], look: [far[0] + 30, 0, far[1] + 30] });
      e.stepFrames(24);                    // exactly what shoot.mjs settles for
      const bodyWhilePosed = this.lookAtPlayer();
      e.camera(null);
      const track2 = [];
      for (let i = 0; i < 600; i++) {
        e.input.reset(e.sim.frame);
        e.loop.stepOnce(); e._afterStep();
        const L = this.lookAtPlayer();
        track2.push({ i, underfoot: L.underfoot_built, near9_unbuilt: L.near9_unbuilt, ring_unbuilt: L.ring_unbuilt });
      }
      out.posed_then_released = {
        body_before_pose: home, body_while_posed: bodyWhilePosed,
        frames_until_ground_underfoot: track2.findIndex((r) => r.underfoot),
        frames_until_near9_complete: track2.findIndex((r) => r.near9_unbuilt === 0),
        frames_until_ring_complete: track2.findIndex((r) => r.ring_unbuilt === 0),
        frames_standing_on_no_ground: track2.filter((r) => !r.underfoot).length,
        body_after_600: this.lookAtPlayer(),
      };
      return out;
    },

    // ---- MODE: loop ----------------------------------------------------------------------
    /** A closed loop, walked N times. Residency, meshes, instances and heap over laps. */
    async lap(laps) {
      const e = E(), p = e.sim.player;
      const pts = this.routePoints('crossing');
      // A closed circuit: 600 m out along the road and 600 m back, repeated. 600 m is two tiles,
      // which is more than KEEP, so tiles are genuinely released and rebuilt each lap.
      e.teleport(pts[0][0], pts[0][1]);
      const home = [p.pos[0], p.pos[2]];
      const out = [];
      let cum = 0;
      for (let i = 1; i < pts.length && cum < 700; i++) { cum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); out.push(pts[i]); }
      const rows = [];
      const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
      for (let L = 0; L < laps; L++) {
        for (const dir of [out, out.slice().reverse().concat([home])]) {
          let idx = 0;
          while (idx < dir.length) {
            const tgt = dir[idx];
            let guard = 0;
            while (Math.hypot(p.pos[0] - tgt[0], p.pos[2] - tgt[1]) > 4.5 && guard < 900) { this.drive(tgt[0], tgt[1], 4); guard += 4; }
            idx++;
          }
        }
        const L2 = this.lookAtPlayer();
        rows.push({ lap: L + 1, frame: e.sim.frame, tiles_resident: L2.tiles_resident,
          tiles_built_total: L2.tiles_built_total, province_meshes: L2.province_meshes,
          cover_instances: L2.cover_instances, near_instances: L2.near_instances,
          heap_bytes: heap(), at: L2.at, underfoot_built: L2.underfoot_built });
      }
      return { how: 'closed loop, walked', laps, rows };
    },

    /**
     * THE SETTLE CURVE. `tools/harness/viewpoints-province.json` declares `settleFrames: 24` for
     * all seventeen province viewpoints, and `shoot.mjs` steps exactly that many after posing.
     * So the honest question is not "does 600 frames build the ring" but "does 24".
     */
    settleCurve(marks) {
      const e = E();
      const pts = this.routePoints('crossing');
      const out = [];
      for (const k of [0.25, 0.55, 0.85]) {
        const eye = pts[Math.floor(pts.length * k)];
        // Reset the province to a genuinely cold state at this eye: teleport far away first so
        // nothing here is resident, then pose without teleporting — the `--direct` path exactly.
        e.camera(null);
        e.teleport(pts[0][0], pts[0][1]);
        e.stepFrames(60);
        const cold = this.look(eye[0], eye[1]);
        e.camera({ pos: [eye[0], (e.field.heightAt(eye[0], eye[1]) || 0) + 1.7, eye[1]],
          look: [eye[0] + 100, 0, eye[1] + 100] });
        const curve = [];
        let done = 0;
        for (const m of marks) {
          e.stepFrames(m - done); done = m;
          const L = this.look(eye[0], eye[1]);
          curve.push({ frames: m, underfoot: L.underfoot_built, near9_unbuilt: L.near9_unbuilt,
            ring_built: L.ring_built, ring_want: L.ring_want, queued: L.tiles_queued,
            skin_lag_m: L.skin_lag_m, cover_lag_m: L.cover_lag_m });
        }
        e.camera(null);
        out.push({ eye: [+eye[0].toFixed(1), +eye[1].toFixed(1)], cold, curve });
      }
      return { how: 'settle curve at a cold posed eye', shoot_default_settle_frames: 24, poses: out };
    },

    // ---- MODE: posed ---------------------------------------------------------------------
    /**
     * THE `shoot.mjs --direct` PATH. `camera({pos, look})` with NO teleport, then step, then ask
     * two different questions:
     *   (a) is the ground built at the EYE (which is what the streamer focuses on), and
     *   (b) is the ground built at the LOOK TARGET (which is what ends up in the picture).
     * They are not the same point and the fix only addresses one of them.
     */
    posed(frames, dist) {
      const e = E();
      const pts = this.routePoints('crossing');
      const before = [];
      const after = [];
      // Five eyes spread along the crossing, none of them where the player is.
      const idxs = [0.20, 0.35, 0.5, 0.7, 0.9].map((f) => Math.floor(pts.length * f));
      for (const k of idxs) {
        const eye = pts[k];
        // Look DOWN the road, `dist` metres ahead — exactly what a scenic viewpoint does.
        const ahead = pts[Math.min(pts.length - 1, k + 120)];
        const bearing = Math.atan2(ahead[0] - eye[0], ahead[1] - eye[1]);
        const tx = eye[0] + Math.sin(bearing) * dist, tz = eye[1] + Math.cos(bearing) * dist;
        e.camera(null);
        before.push({ eye: [+eye[0].toFixed(1), +eye[1].toFixed(1)],
          at_eye: this.look(eye[0], eye[1]), at_target: this.look(tx, tz) });
        e.camera({ pos: [eye[0], (e.field.heightAt(eye[0], eye[1]) || 0) + 1.7, eye[1]],
          look: [tx, (e.field.heightAt(tx, tz) || 0) + 1.7, tz] });
        e.stepFrames(frames);
        after.push({ eye: [+eye[0].toFixed(1), +eye[1].toFixed(1)],
          look_target: [+tx.toFixed(1), +tz.toFixed(1)], look_dist_m: dist,
          at_eye: this.look(eye[0], eye[1]), at_target: this.look(tx, tz),
          focus: e.renderer.province.focus ? e.renderer.province.focus.map((v) => +v.toFixed(1)) : null });
        e.camera(null);
      }
      return { how: 'posed camera (shoot.mjs --direct)', frames_per_pose: frames, before, after };
    },
  };
  return true;
};

// ------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const handle = await launchGame({ ...args, width: 320, height: 240 });
  const report = { tool: 'critic-prov-r1.mjs', mode: MODE, state: STATE, break_fix: BREAK,
    started_at: new Date(t0).toISOString(), git: gitInfo(), loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim() };
  try {
    await handle.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 120000 });
    await handle.page.evaluate(() => window.__HARNESS.ready());
    await handle.page.evaluate((s) => window.__HARNESS.loadState(s), STATE);
    await handle.page.evaluate(() => window.__HARNESS.setRenderRate(0));
    await handle.page.evaluate(INSTALL);
    report.build = await handle.page.evaluate(() => window.__HARNESS.getBuildInfo());
    if (BREAK) report.broken = await handle.page.evaluate(() => window.__CP.breakFix());

    if (MODE === 'modality') {
      report.raw_input = await handle.page.evaluate(() => window.__CP.modalityRawInput(1500));
      report.walk_path = await handle.page.evaluate(() => window.__CP.modalityWalkPath(1200));
      report.ride = await handle.page.evaluate(() => window.__CP.modalityRide(null));
      report.teleport_then_walk = await handle.page.evaluate(() => window.__CP.modalityTeleportThenWalk(400));
      report.there_and_back = await handle.page.evaluate(() => window.__CP.modalityThereAndBack(1100));
      report.still_body = await handle.page.evaluate(() => window.__CP.modalityStillBody(600));
    } else if (MODE === 'fight') {
      report.fight = await handle.page.evaluate(() => window.__CP.fight(9000));
    } else if (MODE === 'loop') {
      report.loop = await handle.page.evaluate((n) => window.__CP.lap(n), LAPS);
    } else if (MODE === 'posed') {
      report.posed = await handle.page.evaluate(() => window.__CP.posed(600, 220));
    } else if (MODE === 'displace') {
      report.displace = await handle.page.evaluate(() => window.__CP.displace(900));
    } else if (MODE === 'ride') {
      report.ride = await handle.page.evaluate(() => window.__CP.modalityRide(null));
    } else if (MODE === 'settle') {
      report.settle = await handle.page.evaluate(() => window.__CP.settleCurve([1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024]));
    } else if (MODE === 'raf') {
      // REAL TIME, mode 'play'. The accumulator, not stepFrames. Rendering stays OFF so what is
      // measured is the sim + the streamer, not SwiftShader.
      report.raf = await handle.page.evaluate(async (secs) => {
        const e = window.__ENGINE;
        const pts = window.__CP.routePoints('crossing');
        e.teleport(pts[0][0], pts[0][1]);
        const before = window.__CP.lookAtPlayer();
        const s0 = { clamps: e.loop.stats.catchupClamps, dropped: e.loop.stats.catchupDroppedMs,
          steps: e.loop.stats.simStepsTotal, raf: e.loop.stats.rafTicks };
        // Hold the stick down and let requestAnimationFrame drive the world, as a player does.
        e.setMode('play');
        e.loop.start();
        const p = e.sim.player;
        let idx = 1;
        const iv = setInterval(() => {
          while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
          const b = Math.atan2(pts[idx][0] - p.pos[0], pts[idx][1] - p.pos[2]);
          const cy = e.sim.camera.yaw * Math.PI / 180;
          e.input.reset(e.sim.frame);
          e.input.queueInputs([{ f: 0, move: [Math.sin(b - cy) * 0.549999999, Math.cos(b - cy) * 0.549999999] }], e.sim.frame);
        }, 8);
        const w0 = performance.now();
        await new Promise((r) => setTimeout(r, secs * 1000));
        const wall = performance.now() - w0;
        clearInterval(iv);
        e.loop.stop(); e.setMode('harness');
        const s1 = { clamps: e.loop.stats.catchupClamps, dropped: e.loop.stats.catchupDroppedMs,
          steps: e.loop.stats.simStepsTotal, raf: e.loop.stats.rafTicks };
        const simFrames = s1.steps - s0.steps;
        return { wall_ms: +wall.toFixed(0), sim_frames: simFrames,
          expected_sim_frames: Math.round(wall / (1000 / 60)),
          sim_frames_lost: Math.round(wall / (1000 / 60)) - simFrames,
          real_time_ratio: +(simFrames / (wall / (1000 / 60))).toFixed(4),
          catchup_clamps: s1.clamps - s0.clamps,
          catchup_dropped_ms: +(s1.dropped - s0.dropped).toFixed(1),
          raf_ticks: s1.raf - s0.raf,
          before, after: window.__CP.lookAtPlayer() };
      }, SECONDS);
    } else {
      throw new Error(`unknown mode '${MODE}'`);
    }
    report.page_errors = handle.errors.length;
    report.errors = handle.errors.slice(0, 5);
  } finally {
    report.wall_ms = Date.now() - t0;
    report.loadavg_end = fs.readFileSync('/proc/loadavg', 'utf8').trim();
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    await handle.close();
  }
  log(`wrote ${path.relative(REPO_ROOT, OUT)} (${report.wall_ms} ms, mode ${MODE}${BREAK ? ', FIX BROKEN' : ''})`);
}

main().catch((e) => { console.error(e); process.exit(20); });
