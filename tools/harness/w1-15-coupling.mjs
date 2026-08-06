#!/usr/bin/env node
// w1-15-coupling.mjs — RI-MTH07 applied to W1-15, by the builder, against itself.
//
// THE RULE THIS FILE EXISTS TO OBEY (ARBITRATION §3 CONSUMPTION / RI-MTH07 §B):
//   every measurement below is taken by PERTURBING A MODEL AND OBSERVING AN ENTITY.
//   No assertion in this file reads the return value of the model it is testing.
//   The observables are entity-side only: `enemies[].alert`, `enemies[].alert_state`,
//   `enemies[].pos`, `civilians[].suspicion`, `crime.witnesses`, `crime.stolen_registry`,
//   `bounty`, `inventory`. If a block here can pass while the model is disconnected, it is a
//   bad block, and the round-1 verdict is a 12-artifact demonstration of what that looks like.
//
// Each block prints the RI-MTH07 §B triple — {model_value_a, model_value_b, observed_a,
// observed_b, coupling} — and a NULL CONTROL, a perturbation the item predicts changes nothing.
//
// WHY THE LOOPS ARE INSIDE `page.evaluate`. A round trip over the CDP bridge costs ~30 ms; a
// 3,600-frame run sampled per frame is two minutes of latency and nothing else. Every stepping
// loop below therefore runs in the page and returns a whole timeline in one call. The harness
// surface it calls is exactly the public `window.__HARNESS`.
//
// USAGE
//   node tools/harness/w1-15-coupling.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-15-coupling.mjs — RI-MTH07 coupling probes for W1-15. Entity-side observables only.\n`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const R = { schema: 'elder-souls/world-coupling@1', piece: 'W1-15', generated_by: 'tools/harness/w1-15-coupling.mjs', measurements: {} };
const say = (s) => process.stdout.write(s + '\n');
const rec = (k, v) => { R.measurements[k] = v; say(`--- ${k}\n${JSON.stringify(v, null, 1)}`); };
const coupling = (obsA, obsB, predA, predB) => {
  if (obsA === null || obsB === null || predA === predB) return null;
  return +(Math.abs(obsB - obsA) / Math.abs(predB - predA)).toFixed(4);
};

const h = await launchGame(args);
const ev = (fn, arg) => h.page.evaluate(fn, arg);

try {
  // =========================================================================================
  // 1. RI-STL01 method 2 — the five worked rows, measured on an ENTITY, frame-exact.
  //    THE HEADLINE. Round 1: 0.500 s in every configuration, coupling 0.00.
  // =========================================================================================
  const M2_ROWS = [
    { id: 'r1-sprint-torchlit-heavy-S5', L: 0.85, motion: 'sprint', sneak: 5, load: 'heavy', cover: false, item_V: 1.30, item_s: 1.03 },
    { id: 'r2-walk-dim-medium-S5', L: 0.35, motion: 'walk', sneak: 5, load: 'medium', cover: false, item_V: 0.339, item_s: 3.94 },
    { id: 'r3-crouch-dim-light-S45', L: 0.35, motion: 'crouch_move', sneak: 45, load: 'light', cover: false, item_V: 0.157, item_s: 8.5 },
    { id: 'r4-crouch-unlit-light-S45-cover', L: 0.06, motion: 'crouch_move', sneak: 45, load: 'light', cover: true, item_V: 0.050, item_s: 26.7 },
    { id: 'r5-still-unlit-light-S100-cover', L: 0.06, motion: 'still', sneak: 100, load: 'light', cover: true, item_V: 0.050, item_s: 26.7 },
    // The null control RI-MTH07 §B3 makes mandatory: beyond the archetype's sight radius,
    // nothing may alert in ANY configuration. It proves the perturbation is not a reset.
    { id: 'control-lit-sprint-at-30m', L: 1.00, motion: 'sprint', sneak: 5, load: 'heavy', cover: false, dist: 30, item_V: 1.30, item_s: null, control: true },
  ];
  const m2 = await ev((rows) => {
    const H = window.__HARNESS;
    const out = [];
    for (const c of rows) {
      H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
      H.setStealthState({ sneak: c.sneak, load: c.load, surface: 'mud', inCover: c.cover, zone: 'z' });
      H.setZoneAmbient('z', c.L);
      H.setPlayerMotion(c.motion);
      H.spawn('inf_trash', 0, c.dist === undefined ? 8 : c.dist, { as: 'e1' });
      let aggro = null, suspicious = null, V = null, L = null, chan = null, alert = 0;
      const curve = [];
      const budget = 3600;
      for (let f = 0; f < budget; f++) {
        H.stepFrames(1);
        const s = H.snapshot();
        const e = s.enemies[0];
        V = s.player.stealth.V; L = s.player.stealth.light; alert = e.alert; if (e.alert_channel) chan = e.alert_channel;
        if (f < 5 || f === 30 || f === 60) curve.push({ f: f + 1, alert: +e.alert.toFixed(2), state: e.alert_state, ch: e.alert_channel, los: e.los });
        if (suspicious === null && e.alert_state === 'SUSPICIOUS') suspicious = f + 1;
        if (e.alert_state === 'AGGRO') { aggro = f + 1; break; }
      }
      out.push({
        id: c.id, item_V: c.item_V, item_s: c.item_s, control: !!c.control,
        V, L: +L.toFixed(4), alert_channel: chan, alert_end: +alert.toFixed(2),
        aggro_f: aggro, aggro_s: aggro === null ? null : +(aggro / 60).toFixed(3),
        t_suspicious_s: suspicious === null ? null : +(suspicious / 60).toFixed(3),
        err_pct: aggro === null || c.item_s === null ? null : +(100 * Math.abs(aggro / 60 - c.item_s) / c.item_s).toFixed(2),
        curve,
      });
    }
    return out;
  }, M2_ROWS);
  const a = m2[0], b = m2[3];
  rec('RI-STL01-M2-enemy-detection', {
    question: 'RI-STL01 method 2 — one INFANTRY (R = 16 m) facing the player at 8 m; frame of first alert_state == AGGRO',
    consumer: 'game/src/sim/stealth/system.js stepPerception() -> perception.js perceiveInto()/stepAlert(); written through to combat/enemy.js EnemyController.alert, which no longer fills it',
    round_1: 'AGGRO at f = 30 (0.500 s) in every configuration; a flat +4/frame; coupling 0.00',
    rows: m2,
    within_5pct: m2.filter((r) => !r.control).every((r) => r.err_pct !== null && r.err_pct <= 5),
    null_control: m2.find((r) => r.control),
    world_coupling: {
      pair: 'row 1 (V = 1.30) vs row 4 (V = 0.05)',
      model_value_a: a.V, model_value_b: b.V,
      observed_a_s: a.aggro_s, observed_b_s: b.aggro_s,
      predicted_a_s: a.item_s, predicted_b_s: b.item_s,
      coupling: coupling(a.aggro_s, b.aggro_s, a.item_s, b.item_s),
    },
  });

  // =========================================================================================
  // 2. RI-STL01 method 4 — no proximity leak. Crouched, still, unlit, 1.0 m BEHIND the enemy.
  // =========================================================================================
  const leak = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.setStealthState({ sneak: 100, load: 'light', surface: 'mud', inCover: true, zone: 'zl' });
    H.setZoneAmbient('zl', 0.06);
    H.setPlayerMotion('still');
    // yaw 180 = looking down +z; the player at the origin is directly BEHIND it.
    H.spawn('inf_trash', 0, 1.0, { as: 'e1', yaw: 180 });
    let peak = 0, aggro = false;
    for (let i = 0; i < 360; i++) { H.stepFrames(10); const e = H.snapshot().enemies[0]; peak = Math.max(peak, e.alert); if (e.alert_state === 'AGGRO') { aggro = true; break; } }
    const e = H.snapshot().enemies[0];
    return { frames: 3600, peak_alert: +peak.toFixed(3), final_alert: +e.alert.toFixed(3), state: e.alert_state, channel: e.alert_channel, aggro };
  });
  rec('RI-STL01-M4-no-proximity-leak', {
    question: 'RI-STL01 method 4 — crouched, unlit, still, 1.0 m behind a stationary enemy for 3,600 f@60',
    item_expects: 'alert never exceeds 0 and no AGGRO occurs',
    round_1: 'aggros in 30 frames',
    measured: leak,
    pass: leak.peak_alert === 0 && !leak.aggro,
  });

  // =========================================================================================
  // 3. SOUND — RI-STL01 §4 reaching an ENTITY THAT CANNOT SEE THE PLAYER.
  //    The enemy faces away and the room is unlit, so sight cannot be the channel.
  // =========================================================================================
  const SND = [
    { id: 'sprint-heavy-dryreed-S5-at-20m', motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 20 },
    { id: 'crouch-light-mud-S100-at-20m', motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 20 },
    { id: 'sprint-heavy-dryreed-S5-at-3m', motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 3 },
    { id: 'crouch-light-mud-S100-at-3m', motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 3 },
    { id: 'NULL-CONTROL-still-heavy-dryreed-S5-at-3m', motion: 'still', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 3, control: true },
  ];
  const snd = await ev((rows) => {
    const H = window.__HARNESS;
    const out = [];
    for (const c of rows) {
      H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
      H.setStealthState({ sneak: c.sneak, load: c.load, surface: c.surface, inCover: false, zone: 'zs' });
      H.setZoneAmbient('zs', 0.04);
      H.setPlayerMotion(c.motion);
      H.spawn('inf_trash', 0, c.dist, { as: 'e1', yaw: 180 });   // facing AWAY
      let rise = null, chan = null, aggro = null;
      for (let f = 0; f < 1200; f++) {
        H.stepFrames(1);
        const e = H.snapshot().enemies[0];
        if (rise === null && e.alert > 0) { rise = f + 1; chan = e.alert_channel; }
        if (e.alert_state === 'AGGRO') { aggro = f + 1; break; }
      }
      const s = H.snapshot();
      out.push({
        id: c.id, control: !!c.control, dist_m: c.dist,
        sound_r_m: s.player.stealth.sound_r_m,
        audible: c.dist <= s.player.stealth.sound_r_m,
        first_rise_f: rise, channel: chan,
        aggro_s: aggro === null ? null : +(aggro / 60).toFixed(3),
        final_alert: +s.enemies[0].alert.toFixed(2), state: s.enemies[0].alert_state,
      });
    }
    return out;
  }, SND);
  const loud = snd[0], quiet = snd[1];
  rec('RI-STL01-M3-sound-reaches-an-entity', {
    question: 'RI-STL01 §4 — r_effective spans 55x; does an entity that CANNOT SEE the player do anything different?',
    consumer: 'perception.js perceiveInto() hearing channel, gated on p.soundR; alert_channel == "hearing"',
    round_1: 'r_effective computed correctly across a 55x range and nothing in the world heard it',
    rows: snd,
    null_control: snd.find((r) => r.control),
    world_coupling: {
      pair: 'sprint/heavy/dry-reed (r_eff ~36 m) vs crouch/light/mud (r_eff ~0.7 m), enemy at 20 m, blind',
      model_value_a: loud.sound_r_m, model_value_b: quiet.sound_r_m,
      observed_a_alert: loud.final_alert, observed_b_alert: quiet.final_alert,
      predicted: 'audible at 20 m in the first, inaudible in the second',
      coupling: loud.final_alert > 0 && quiet.final_alert === 0 ? 1 : 0,
    },
  });

  // Sound reaching a CIVILIAN — the round-1 verdict's named failure.
  const civSound = await ev(() => {
    const H = window.__HARNESS;
    const out = {};
    for (const q of [{ k: 'loud', sneak: 5, load: 'heavy', surface: 'dry_reed' }, { k: 'quiet', sneak: 100, load: 'light', surface: 'mud' }]) {
      H.setSeed(1337); H.loadState('default'); H.teleport(0, 0);
      H.setStealthState({ sneak: q.sneak, load: q.load, surface: q.surface, inCover: false, zone: 'zcs' });
      H.setZoneAmbient('zcs', 0.04);
      H.setCrimeContext('crouched_public');
      H.spawnCivilian({ eid: 'sd2', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 2], yaw: 0 });   // facing AWAY
      H.setPlayerMotion('sprint');
      H.stepFrames(600);
      const c = H.listCivilians().find((x) => x.eid === 'sd2');
      out[q.k] = { sound_r_m: H.snapshot().player.stealth.sound_r_m, civ_state: c.civ_state, suspicion: c.suspicion, channel: c.alert_channel, los: c.los };
    }
    return out;
  });
  rec('RI-STL01-sound-reaches-a-civilian', {
    question: 'round-1 verdict: "a civilian 2 m away, facing away, after 10 s of that sprint, registers suspicion 0.00 and stays CALM"',
    measured: civSound,
    world_coupling: { coupling: civSound.loud.suspicion > 0 ? 1 : 0, note: 'the quiet row is the null control: r_eff 0.66 m does not reach 2 m' },
  });

  // =========================================================================================
  // 4. LINE OF SIGHT — a wall must block sight. Perturb GEOMETRY, observe the entity.
  // =========================================================================================
  const los = await ev(() => {
    const H = window.__HARNESS;
    const out = [];
    for (const wall of [false, true]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
      H.setStealthState({ sneak: 5, load: 'heavy', surface: 'mud', inCover: false, zone: 'zw' });
      H.setZoneAmbient('zw', 1.0);
      H.setPlayerMotion('still');
      if (wall) H.addOccluder({ id: 'w1', min: [-4, 0, 3.8], max: [4, 3.5, 4.2] });
      H.spawn('inf_trash', 0, 8, { as: 'e1' });
      let aggro = null;
      for (let f = 0; f < 1800; f++) { H.stepFrames(1); const e = H.snapshot().enemies[0]; if (e.alert_state === 'AGGRO') { aggro = f + 1; break; } }
      const e = H.snapshot().enemies[0];
      out.push({ wall, occluders: H.listOccluders().length, alert: +e.alert.toFixed(2), state: e.alert_state, channel: e.alert_channel, los: e.los, aggro_s: aggro === null ? null : +(aggro / 60).toFixed(3), los_probe: H.losBetween([0, 1.55, 8], [0, 1.35, 0]) });
    }
    return out;
  });
  rec('RI-STL01-LOS-occlusion', {
    question: 'is there a line-of-sight term at all? Identical configuration, one axis-aligned wall between the two.',
    consumer: 'perception.js losClear() -> sim.cell.sphereCast() (the SAME static collision set the camera arm and the player body use) + the stealth occluder cell',
    round_1: 'no occlusion term anywhere; in_cover was an authored boolean worth x0.80',
    open: los[0], walled: los[1],
    world_coupling: { model_value_a: 'no wall', model_value_b: 'one wall', observed_a_alert: los[0].alert, observed_b_alert: los[1].alert, coupling: los[0].alert >= 100 && los[1].alert === 0 ? 1 : 0 },
  });

  // Cover as a DERIVED term (RI-MTH07 §C3's hand-feed audit for `inCover`).
  const cover = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    const open = H.coverAt(0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2;
      if (i === 3) continue;                                   // leave one gap: 11/12 = 0.92 >= 0.60
      H.addOccluder({ id: 'c' + i, min: [Math.sin(th) * 2 - 0.6, 0, Math.cos(th) * 2 - 0.6], max: [Math.sin(th) * 2 + 0.6, 3, Math.cos(th) * 2 + 0.6] });
    }
    const alcove = H.coverAt(0, 0, 0);
    H.setPlayerMotion('still'); H.setStealthState({ sneak: 45, load: 'light', zone: 'zc' }); H.setZoneAmbient('zc', 0.35);
    H.stepFrames(2);
    return { open, alcove, stealth: H.getStealthState() };
  });
  rec('RI-STL01-cover-derived-not-authored', {
    question: "RI-STL01 §2's A term: is x0.80 reachable by STANDING somewhere, or only by a critic setting a boolean?",
    consumer: 'stealth/system.js step() -> perception.js deriveInCover(), 12 probes at eye height against the same collision set',
    measured: cover,
    in_cover_source: cover.stealth.in_cover_source,
  });

  // =========================================================================================
  // 5. SEARCH — RI-STL01 §7 S-1..S-4 in the world.
  // =========================================================================================
  const search = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.setStealthState({ sneak: 5, load: 'heavy', surface: 'mud', inCover: false, zone: 'warehouse' });
    H.setZoneAmbient('warehouse', 1.0);
    H.setPlayerMotion('walk');
    H.addCoverVolume({ id: 'c1', pos: [4, 0, 10], zone: 'warehouse' });
    H.addCoverVolume({ id: 'c2', pos: [-5, 0, 9], zone: 'warehouse' });
    H.addCoverVolume({ id: 'c3', pos: [1, 0, 13], zone: 'warehouse' });
    H.addCoverVolume({ id: 'c4', pos: [40, 0, 40], zone: 'warehouse' });   // beyond S-1's 8 m
    H.addLightSource({ id: 'lamp1', pos: [2, 2, 6], intensity: 0.8, snuffable: true, zone: 'warehouse' });
    H.spawn('inf_trash', 0, 8, { as: 'es' });
    H.spawn('inf_trash', 6, 10, { as: 'ally' });                            // S-3: within 12 m
    H.spawn('inf_trash', 0, 60, { as: 'far' });                             // S-3: beyond 12 m
    // 1. be seen
    let seen = null;
    for (let f = 0; f < 1200; f++) { H.stepFrames(1); if (H.snapshot().enemies[0].alert_state === 'AGGRO') { seen = f + 1; break; } }
    const lkp = H.snapshot().player.pos.map((n) => +n.toFixed(2));
    H.snuffLight('lamp1', 200);
    // 2. break contact, hard and far
    H.teleport(0, -120);
    H.setPlayerMotion('still');
    const tl = [];
    let maxSpeed = 0, maxDist = 0, searchStart = null, searchEnd = null, s3 = null;
    for (let i = 0; i < 1800; i++) {
      H.stepFrames(1);
      const s = H.snapshot();
      const e = s.enemies[0];
      const d = Math.hypot(e.pos[0] - lkp[0], e.pos[2] - lkp[2]);
      maxSpeed = Math.max(maxSpeed, e.speed_mps); maxDist = Math.max(maxDist, d);
      if (e.alert_state === 'SEARCH' && searchStart === null) {
        searchStart = i + 1;
        s3 = s.enemies.map((x) => ({ eid: x.eid, alert: +x.alert.toFixed(1), state: x.alert_state, hop: x.alert_hop }));
      }
      if (searchStart !== null && searchEnd === null && e.alert_state === 'IDLE') searchEnd = i + 1;
      if (i % 60 === 0 || (searchStart !== null && i < searchStart + 5)) {
        tl.push({ t_s: +((i + 1) / 60).toFixed(2), alert: +e.alert.toFixed(1), state: e.alert_state, pos: e.pos.map((n) => +n.toFixed(2)), speed: +e.speed_mps.toFixed(2), d_from_lkp: +d.toFixed(2), target: e.search_target, band_m: e.search_radius_m });
      }
      if (searchEnd !== null && i > searchEnd + 120) break;
    }
    const st = H.getStealthState();
    return {
      seen_at_f: seen, lkp,
      search_started_at_s: searchStart === null ? null : +(searchStart / 60).toFixed(2),
      search_ended_at_s: searchEnd === null ? null : +(searchEnd / 60).toFixed(2),
      search_duration_s: searchStart !== null && searchEnd !== null ? +((searchEnd - searchStart) / 60).toFixed(2) : null,
      max_search_speed_mps: +maxSpeed.toFixed(2),
      max_dist_from_lkp_m: +maxDist.toFixed(2),
      timeline: tl,
      s3_on_entering_search: s3,
      zone_baseline_alert_after: st.zone_baseline_alert,
      zone_context_multiplier: st.zone_context_multiplier,
      lights_relit: H.getStealthState().lights_out,
      events: H.drainStealthEvents ? null : undefined,
    };
  });
  rec('RI-STL01-M6-search', {
    question: 'RI-STL01 §7 — S-1 LKP then plausible set, S-2 escalating radius, S-3 one-hop, S-4 zone memory',
    consumer: 'stealth/system.js beginSearch()/stepSearches()/endSearch() driving search.js Search + ZoneMemory, moving the combat body',
    round_1: 'alert 100 -> 40 -> 0 in 2 s, speed 0.00 m/s, position unchanged for 24 s, zone_baseline_alert 0; the step never called search.js',
    item_expects: { duration_s: 12, s2_radii_m: [8, 14, 20], s3_raise_to: 45, s4_baseline: 25, s4_hold_s: 180 },
    measured: search,
  });

  // S-4's own assertion: re-enter after 60 s (still 25) and after 200 s (decayed to 0).
  const s4 = await ev(() => {
    const H = window.__HARNESS;
    const st0 = H.getStealthState();
    H.stepFrames(60 * 60);
    const at60 = H.getStealthState().zone_baseline_alert;
    H.stepFrames(140 * 60);
    const at200 = H.getStealthState().zone_baseline_alert;
    return { immediately: st0.zone_baseline_alert, at_60_s: at60, at_200_s: at200 };
  });
  rec('RI-STL01-S4-zone-memory', { question: 'S-4: baseline 25 for 180 s, then 0', item_expects: { at_60_s: 25, at_200_s: 0 }, measured: s4 });

  // =========================================================================================
  // 6. WITNESS FROM THE WORLD — RI-CRM01 method 3, with ZERO addWitness() calls.
  // =========================================================================================
  const wit = await ev(() => {
    const H = window.__HARNESS;
    const run = (guardDist) => {
      H.setSeed(1337); H.loadState('default'); H.teleport(0, 0);
      const zones = H.listPropertyZones('gideon');
      const owned = H.listOwnedObjects(zones[0].id);
      H.setTimeOfDay(12);
      H.setStealthState({ sneak: 5, load: 'medium', surface: 'timber', inCover: false, zone: 'zw2' });
      H.setZoneAmbient('zw2', 1.0);
      H.setPlayerMotion('still');
      H.spawnCivilian({ eid: 'wit', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
      if (guardDist !== null) H.spawnGuard({ eid: 'grd', pos: [0, 0, guardDist], yaw: 180 });
      H.setCrimeContext('handling_owned_object');
      H.stepFrames(300);
      const civAtTheft = H.listCivilians();
      const take = H.takeObject(owned[0].instance, {});          // NOTE: no observedBy supplied
      const csAt = H.getCrimeState();
      let reportF = null;
      const bountyTl = [];
      for (let f = 0; f < 60 * 90; f++) {
        H.stepFrames(1);
        const cs = H.getCrimeState();
        if (f % 600 === 0) bountyTl.push({ t_s: +((f + 1) / 60).toFixed(1), bounty: cs.bounty.imperial });
        if (cs.bounty.imperial > 0) { reportF = f + 1; break; }
      }
      const cs = H.getCrimeState();
      const sv = H.saveState();
      return {
        guard_dist_m: guardDist,
        civilian_at_the_theft: civAtTheft,
        takeObject: { stolen_from: take.stolen_from, crime: take.crime, crime_ref: take.crime_ref, quote_g: take.quote_g, observed_by: take.observed_by, observed_by_source: take.observed_by_source, witnesses: take.witnesses },
        witnesses_on_the_crime_frame: csAt.witnesses,
        witness_checks: csAt.witness_checks,
        route: csAt.pending_reports,
        report_latency_s: reportF === null ? null : +(reportF / 60).toFixed(2),
        bounty_timeline: bountyTl,
        final_bounty: cs.bounty, final_witnesses: cs.witnesses,
        civilians_after: H.listCivilians(),
        save_crime: sv.crime,
        save_inventory_stolen: sv.inventory.filter((i) => i.stolen),
      };
    };
    return { at_120m: run(120), at_20m: run(20), no_guard: run(null) };
  });
  rec('RI-CRM01-M3-witness-from-the-world', {
    question: 'RI-CRM01 method 3, end to end, with ZERO addWitness() calls in this script',
    consumer: 'stealth/system.js commitCrime() -> deriveWitnesses() over live civilians and guards -> beginReport() -> the step\'s pending-report pass',
    round_1: 'an ALARM civilian 3 m from a theft produced witnesses: [], bounty 0, and a crime record that could never land',
    addWitness_calls: 0,
    item_expects: { run_to_guard_120m_s: +(120 / 3.4).toFixed(2), shout_20m_s: 1.2, no_guard: 'bounty stays 0 for >= 60 s' },
    measured: wit,
  });

  // The null control the item demands: the same theft with no NPC anywhere.
  const noWit = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('default'); H.teleport(0, 0);
    const zones = H.listPropertyZones('gideon');
    const owned = H.listOwnedObjects(zones[0].id);
    H.setCrimeContext('handling_owned_object');
    H.stepFrames(60);
    const takes = [];
    for (let i = 0; i < 20; i++) takes.push(H.takeObject(owned[i].instance, {}));
    H.stepFrames(600);
    const cs = H.getCrimeState();
    const sv = H.saveState();
    // Persistence: a full save -> load round trip.
    H.loadSave ? null : null;
    return {
      bounty: cs.bounty, witnesses: cs.witnesses.length,
      all_20_carry_stolen_from: takes.every((t) => !!t.stolen_from),
      stolen_registry_n: cs.stolen_registry.length,
      stolen_registry_sample: cs.stolen_registry.slice(0, 3),
      save_stolen_registry_n: sv.crime.stolen_registry.length,
      save_stolen_registry_sample: sv.crime.stolen_registry.slice(0, 3),
      save_inventory_stolen_n: sv.inventory.filter((i) => i.stolen).length,
      save_inventory_sample: sv.inventory.filter((i) => i.stolen).slice(0, 3),
    };
  });
  rec('RI-CRM01-M2-RI-STL02-M2-no-witness-no-bounty-but-stolen', {
    question: 'RI-CRM01 method 2 / RI-STL02 method 2 — steal 20 owned items with no NPC present',
    item_expects: 'bounty 0, witnesses [], all 20 carry stolen_from, and stolen_from reaches saveState()',
    round_1: 'saveState().crime.stolen_registry was [] after three thefts and the inventory held only the starting knife',
    measured: noWit,
  });

  // Save/load round trip, and the fence — the only thing that clears `stolen_from`.
  const persist = await ev(() => {
    const H = window.__HARNESS;
    const before = H.saveState();
    const blob = JSON.parse(JSON.stringify(before));
    H.loadState(blob);
    const after = H.saveState();
    const cs = H.getCrimeState();
    const inst = cs.stolen_registry.length ? cs.stolen_registry[0].instance : null;
    let sold = null;
    if (inst) {
      const fences = H.getCrimeState();
      try { sold = H.fenceSell('fence.gideon.docks', inst); } catch (e) { sold = { error: e.message }; }
    }
    return {
      round_trip_registry_identical: JSON.stringify(before.crime.stolen_registry) === JSON.stringify(after.crime.stolen_registry),
      round_trip_inventory_identical: JSON.stringify(before.inventory) === JSON.stringify(after.inventory),
      registry_n_after_load: after.crime.stolen_registry.length,
      fence_sale: sold,
      registry_after_sale: H.getCrimeState().stolen_registry.filter((s) => s.instance === inst),
      inventory_after_sale: H.saveState().inventory.filter((i) => i.id === inst),
    };
  });
  rec('RI-STL02-M2-persistence-and-fencing', { question: 'does stolen_from survive a round trip, and does the fence clear it?', measured: persist });

  // =========================================================================================
  // 7. RI-CRM01 §3b — the four responses to a fleeing witness, driven at the world.
  // =========================================================================================
  const responses = await ev(() => {
    const H = window.__HARNESS;
    const setup = () => {
      H.setSeed(1337); H.loadState('default'); H.teleport(0, 0);
      const zones = H.listPropertyZones('gideon');
      const owned = H.listOwnedObjects(zones[0].id);
      H.setTimeOfDay(12);
      H.setStealthState({ sneak: 5, load: 'medium', surface: 'timber', inCover: false, zone: 'zr', gold: 4000 });
      H.setZoneAmbient('zr', 1.0);
      H.setPlayerMotion('still');
      H.spawnCivilian({ eid: 'wit', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
      H.spawnGuard({ eid: 'grd', pos: [0, 0, 120], yaw: 180 });
      H.setCrimeContext('handling_owned_object');
      H.stepFrames(300);
      H.takeObject(owned[0].instance, {});
      return H.listPendingReports();
    };
    const out = {};
    let pend = setup();
    out.pending_on_the_crime_frame = pend;
    out.bribe = H.bribeWitness(0, null);
    H.stepFrames(60 * 60);
    out.bribe_bounty_after_60s = H.getCrimeState().bounty;
    pend = setup();
    out.talk_down = H.talkDownWitness(0, true);
    H.stepFrames(60 * 60);
    out.talk_down_bounty_after_60s = H.getCrimeState().bounty;
    pend = setup();
    H.stepFrames(60 * 60);
    out.let_go_bounty_after_60s = H.getCrimeState().bounty;
    return out;
  });
  rec('RI-CRM01-M3b-four-responses', { question: 'RI-CRM01 §3b — let go / bribe / talk down, against a witness the world created', measured: responses });

  // =========================================================================================
  // 8. S13 — the parley must exist and be reachable against a guard in band 3.
  // =========================================================================================
  const parley = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.setBounty('imperial', 2500);
    const band = H.getGuardBand({});
    let out = { band, spawn: null, parley: null };
    try {
      out.spawn = H.spawn('guard_legion', 0, 3.0, { as: 'g1', yaw: 180 });
      H.aggro('g1');
      H.setWorldKnowledge({ gold: 5000 });
      H.stepFrames(30);
      const before = H.snapshot();
      H.combatTraceStart({});
      H.queueInputs([{ f: 0, press: ['interact'] }]);
      H.stepFrames(120);
      const evs = [];
      for (const fr of H.combatTraceDrain()) for (const e of (fr.events || [])) if (/PARLEY|YIELD/.test(e.t || e.type || '')) evs.push(e);
      H.combatTraceStop();
      const after = H.snapshot();
      out.parley = {
        events: evs,
        before_state: before.enemies.map((e) => ({ eid: e.eid, state: e.state, alert: e.alert_state })),
        after_state: after.enemies.map((e) => ({ eid: e.eid, state: e.state, alert: e.alert_state, hp: e.hp })),
        combat: H.getCombatState(),
      };
    } catch (e) { out.parley = { error: e.message }; }
    return out;
  });
  rec('S13-parley-reachable', {
    question: 'ARBITRATION S13 — a fight with a person must have a non-lethal exit, and band 3 carries parley: "surrender"',
    measured: parley,
  });

  // =========================================================================================
  // 9. RI-QST05 — the verb census, recomputed from the running game.
  // =========================================================================================
  rec('RI-QST05-verb-census', { question: 'RI-QST05 — PACIFIST-ALL, VERB-SPREAD, per-verb counts, with the denominator attached', measured: await ev(() => window.__HARNESS.questVerbCensus()) });

  // =========================================================================================
  // 10. SCENARIO ISOLATION — reset() must clear this subsystem (round-1 secondary finding).
  // =========================================================================================
  const iso = await ev(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('default');
    H.setBounty('imperial', 777);
    H.setCrimeContext('lockpicking');
    H.spawnCivilian({ eid: 'ghost', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
    H.addOccluder({ id: 'ghostwall', min: [-1, 0, 1], max: [1, 2, 1.2] });
    H.reset({});
    const afterReset = { bounty: H.getCrimeState().bounty, context: H.getStealthState().context, civilians: H.listCivilians().length, occluders: H.listOccluders().length };
    H.setBounty('imperial', 555);
    H.loadState('default');
    const afterLoad = { bounty: H.getCrimeState().bounty, context: H.getStealthState().context, civilians: H.listCivilians().length, occluders: H.listOccluders().length };
    return { after_reset: afterReset, after_loadState: afterLoad };
  });
  rec('HARNESS-scenario-isolation', {
    question: 'does reset()/loadState() clear the stealth+crime subsystem?',
    round_1: 'bounty 777, context lockpicking and two spawned civilians all survived a full reset and a state load',
    measured: iso,
  });

  R.build = await h.h('getBuildInfo');
  R.page_errors = h.errors.slice(0, 10);
} catch (e) {
  R.error = { message: e.message, stack: String(e.stack).split('\n').slice(0, 6) };
  say('ERROR ' + e.message);
} finally {
  await h.close();
}
if (args.json) writeJson(args.json, R);
say('\ndone');
