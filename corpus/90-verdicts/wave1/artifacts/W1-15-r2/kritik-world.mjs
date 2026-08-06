#!/usr/bin/env node
// kritik-world.mjs — the critic's second instrument: facing, search, witnesses, ownership,
// the S13 parley, and the round-1 passes that must not have regressed.
//
// The facing block exists because the first run of kritik-perception.mjs exposed a probe bug in
// MY OWN instrument, not the build's: `setEntityPos()` silently ignores `opts.yaw`, while
// `spawn()` honours it. Every "rear arc" measurement taken through setEntityPos is therefore a
// measurement taken at yaw 180 — i.e. facing the player. Re-taken here through spawn().
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('kritik-world.mjs\n');
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'world', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };

try {
  await h.h('setRenderRate', 0);
  await h.page.evaluate(() => {
    const H = window.__HARNESS;
    window.__K = {
      arena(o) {
        H.setSeed(o.seed === undefined ? 1337 : o.seed);
        H.loadState('arena_flat');
        H.setRenderRate(0);
        H.teleport(0, 0);
        if (o.tod !== undefined) H.setTimeOfDay(o.tod);
        const z = o.zone || 'zk';
        const patch = { sneak: o.sneak, load: o.load, surface: o.surface || 'mud', zone: z };
        if (o.inCover !== undefined) patch.inCover = o.inCover;
        H.setStealthState(patch);
        if (o.amb !== undefined) H.setZoneAmbient(z, o.amb);
        H.setPlayerMotion(o.motion === undefined ? null : o.motion);
        H.setCrimeContext(o.context || 'public_street_sheathed');
        if (o.dist !== undefined) {
          H.spawn(o.arch || 'inf_trash', o.ex === undefined ? 0 : o.ex, o.dist, { as: o.eid || 'ek', yaw: o.yaw });
        }
        return o.eid || 'ek';
      },
      fill(eid, n) {
        const p0 = H.perceptionState().find((x) => x.eid === eid);
        const a0 = p0 ? p0.alert : 0;
        let peak = a0;
        const CH = 60;
        for (let i = 0; i < n; i += CH) {
          H.stepFrames(Math.min(CH, n - i));
          const p = H.perceptionState().find((x) => x.eid === eid);
          if (p && p.alert > peak) peak = p.alert;
        }
        const p1 = H.perceptionState().find((x) => x.eid === eid);
        return {
          a0, a1: p1 ? p1.alert : null, peak: +peak.toFixed(4),
          per_s: p1 ? +(((p1.alert - a0) / n) * 60).toFixed(4) : null,
          state: p1 ? p1.alert_state : null, channel: p1 ? p1.alert_channel : null,
          los: p1 ? p1.los : null, dist_m: p1 ? p1.dist_m : null,
        };
      },
    };
    return true;
  });

  // ==== BLOCK 7 — FACING. Primary / peripheral / rear arc, set through spawn(). =============
  // enemy at (0,8); bearing of the player from the enemy = 180 - yaw.
  const facing = [];
  for (const c of [
    { id: 'bearing-0-primary', yaw: 180, bearing: 0 },
    { id: 'bearing-40-primary', yaw: 140, bearing: 40 },
    { id: 'bearing-57-peripheral', yaw: 123, bearing: 57 },
    { id: 'bearing-70-outside-statblock-cone', yaw: 110, bearing: 70 },
    { id: 'bearing-170-rear-arc', yaw: 10, bearing: 170 },
  ]) {
    const r = await h.page.evaluate((o) => {
      const eid = window.__K.arena({ tod: 12, amb: 0.35, motion: 'still', sneak: 5, load: 'medium', dist: 8, yaw: o.yaw, zone: 'z' + o.id, eid: 'e' + o.id });
      window.__HARNESS.stepFrames(2);
      const st = window.__HARNESS.getStealthState();
      const f = window.__K.fill(eid, 600);
      return { f, V: st.V, sound_r_m: st.sound_r_m, motion: st.motion };
    }, c);
    // still + medium + mud + sneak 5 -> r_base 0 -> no hearing channel at all.
    const V = r.V;
    const geom = 150 * V * (1 - 8 / 16);
    const pred = c.bearing <= 55 ? geom : (c.bearing <= 60 ? geom * 0.35 : 0);   // statblock half-cone = 60
    facing.push({
      ...c, V, sound_r_m: r.sound_r_m, predicted_per_s: +pred.toFixed(4),
      measured_per_s: r.f.per_s, peak_alert: r.f.peak, state: r.f.state, channel: r.f.channel,
      ratio: pred > 0 ? +(r.f.per_s / pred).toFixed(4) : (r.f.per_s === 0 ? 1 : null),
    });
  }
  rec('B7-facing-cones', {
    note: 'inf_trash declares sight_cone_deg 120 (half 60); detection.json primary 55 / peripheral 100. The narrower governs, so 57 deg is the only peripheral band this archetype has.',
    cases: facing,
  });

  // ==== BLOCK 8 — RI-STL01 method 4: no proximity leak, 1.0 m BEHIND a stationary enemy ====
  const m4 = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    let eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'still', sneak: 100, load: 'light', surface: 'mud', dist: 1.0, yaw: 0, zone: 'zm4', eid: 'em4' });
    H.stepFrames(2);
    out.still_behind_1m_3600f = window.__K.fill(eid, 3600);
    out.stealth = H.getStealthState();
    // and the same position with the enemy TURNED ROUND — the discriminator that proves the
    // 0.000 above is the rear arc and not a broken entity.
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'still', sneak: 100, load: 'light', surface: 'mud', dist: 1.0, yaw: 180, zone: 'zm4b', eid: 'em4b' });
    H.stepFrames(2);
    out.still_facing_1m_600f = window.__K.fill(eid, 600);
    // crouch-MOVING behind at 1 m: r_base 2.5 x 0.9 x 0.5 x 0.7 = 0.7875 m < 1.0 m -> still silent
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 1.0, yaw: 0, zone: 'zm4c', eid: 'em4c' });
    H.stepFrames(2);
    out.crouchmove_behind_1m = { sound_r_m: H.getStealthState().sound_r_m, fill: window.__K.fill(eid, 1200) };
    // walking behind at 1 m: r_eff should exceed 1 m and it should hear you
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'walk', sneak: 100, load: 'light', surface: 'mud', dist: 1.0, yaw: 0, zone: 'zm4d', eid: 'em4d' });
    H.stepFrames(2);
    out.walk_behind_1m = { sound_r_m: H.getStealthState().sound_r_m, fill: window.__K.fill(eid, 600) };
    return out;
  });
  rec('B8-M4-no-proximity-leak', m4);

  // ==== BLOCK 9 — the peripheral cap of 70 ================================================
  const cap = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const eid = window.__K.arena({ tod: 12, amb: 1.0, motion: 'still', sneak: 5, load: 'heavy', dist: 4, yaw: 123, zone: 'zcap', eid: 'ecap' });
    H.stepFrames(2);
    const f = window.__K.fill(eid, 1800);
    return { fill: f, V: H.getStealthState().V };
  });
  rec('B9-peripheral-cap', { expects: 'RI-AI01 §B: the peripheral cone cannot pass alert 70 on its own', ...cap });

  // ==== BLOCK 10 — the SEARCH, RI-STL01 §7 ================================================
  const search = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    const eid = window.__K.arena({ tod: 12, amb: 1.0, motion: 'still', sneak: 5, load: 'heavy', dist: 8, yaw: 180, zone: 'zs', eid: 'es' });
    H.addCoverVolume({ id: 'cv1', pos: [3, 0, 6], zone: 'zs' });
    H.addCoverVolume({ id: 'cv2', pos: [-4, 0, 10], zone: 'zs' });
    H.addCoverVolume({ id: 'cv3', pos: [1, 0, 13], zone: 'zs' });
    H.stepFrames(2);
    // raise it to SUSPICIOUS with a shout, then break line of sight with a wall
    H.raiseEnemyAlert(eid, 60, 'shout');
    H.addOccluder({ id: 'wall_s', min: [-10, 0, 3.6], max: [10, 4, 4.4] });
    const f0 = H.getFrame();
    const log = [];
    let searchStartF = null, searchEndF = null;
    const speeds = [];
    let prev = null;
    for (let i = 0; i < 2400; i++) {
      H.stepFrames(1);
      const p = H.perceptionState().find((x) => x.eid === eid);
      const ss = H.getSearchState();
      if (ss.length && searchStartF === null) searchStartF = H.getFrame() - f0;
      if (!ss.length && searchStartF !== null && searchEndF === null) searchEndF = H.getFrame() - f0;
      if (prev && p) {
        const d = Math.hypot(p.pos[0] - prev[0], p.pos[2] - prev[2]);
        if (d > 1e-6) speeds.push(+(d * 60).toFixed(4));
      }
      if (p) prev = [p.pos[0], p.pos[2]];
      if (i % 120 === 0) log.push({ df: i, alert: p ? p.alert : null, st: p ? p.alert_state : null, pos: p ? p.pos : null, tgt: p ? p.search_target : null, r: p ? p.search_radius_m : null, searches: ss.length });
      if (searchEndF !== null) break;
    }
    out.search_start_f = searchStartF;
    out.search_start_s = searchStartF === null ? null : +(searchStartF / 60).toFixed(3);
    out.search_end_f = searchEndF;
    out.search_duration_s = (searchStartF !== null && searchEndF !== null) ? +((searchEndF - searchStartF) / 60).toFixed(3) : null;
    out.walk_speed_mps_max = speeds.length ? Math.max(...speeds) : null;
    out.walk_speed_mps_mode = speeds.length ? speeds.sort()[Math.floor(speeds.length / 2)] : null;
    out.log = log;
    out.events = H.drainStealthEvents().filter((e) => e.type === 'search_start' || e.type === 'search_end');
    return out;
  });
  rec('B10-search', search);

  // ==== BLOCK 11 — WITNESSES with ZERO addWitness() calls =================================
  const wit = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setTimeOfDay(12);
    H.setStealthState({ sneak: 5, load: 'medium', surface: 'mud', zone: 'zw' });
    H.setZoneAmbient('zw', 1.0);
    H.spawnCivilian({ eid: 'cw', pos: [0, 0, 3], yaw: 180 });
    H.spawnGuard({ eid: 'gw', pos: [0, 0, 120], yaw: 180 });
    H.setCrimeContext('theft_observed');
    H.stepFrames(300);
    out.before = { civ: H.listCivilians(), crime: H.getCrimeState() };
    const c = H.commitCrime('theft_under_100');
    out.commit = c;
    out.after_commit = H.getCrimeState();
    out.pending = H.listPendingReports();
    const f0 = H.getFrame();
    let bountyAtF = null;
    for (let i = 0; i < 3600; i++) {
      H.stepFrames(1);
      const cs = H.getCrimeState();
      if (cs.bounty && cs.bounty.imperial > 0) { bountyAtF = H.getFrame() - f0; out.bounty = cs.bounty; break; }
    }
    out.report_latency_f = bountyAtF;
    out.report_latency_s = bountyAtF === null ? null : +(bountyAtF / 60).toFixed(3);
    out.events = H.drainStealthEvents();
    return out;
  });
  rec('B11-witness-derived', wit);

  // ==== BLOCK 12 — OWNERSHIP, the stolen registry, the save, and the fence ================
  const own = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    const zones = H.listPropertyZones ? H.listPropertyZones() : null;
    out.zone_count = Array.isArray(zones) ? zones.length : null;
    const z = Array.isArray(zones) && zones.length ? (zones[0].id || zones[0]) : null;
    out.first_zone = z;
    const objs = z ? H.listOwnedObjects(z) : [];
    out.objects_in_zone = objs.length;
    out.sample = objs.slice(0, 3);
    const taken = [];
    for (const o of objs.slice(0, 3)) taken.push(H.takeObject(o.instance));
    out.taken = taken;
    out.registry = H.getCrimeState().stolen_registry;
    const sv = H.saveState();
    out.save_registry = sv.crime ? sv.crime.stolen_registry : null;
    const rt = H.saveRoundTrip();
    out.round_trip = rt && rt.identical !== undefined ? { identical: rt.identical } : rt;
    // launder one
    if (out.registry && out.registry.length) {
      const fences = H.getCrimeState().fences || null;
      out.fences = fences;
      try {
        out.fence_sell = H.fenceSell((fences && fences[0] && (fences[0].id || fences[0])) || 'fence_marsh', out.registry[0].instance);
      } catch (e) { out.fence_sell_error = String(e.message || e); }
      out.registry_after_launder = H.getCrimeState().stolen_registry;
    }
    return out;
  });
  rec('B12-ownership-registry', own);

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
