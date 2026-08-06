#!/usr/bin/env node
// w1-15-coupling.mjs — RI-MTH07 applied to W1-15, by the builder, against itself.
//
// THE RULE THIS FILE EXISTS TO OBEY (ARBITRATION §3 CONSUMPTION / RI-MTH07 §B):
//   every measurement below is taken by PERTURBING A MODEL AND OBSERVING AN ENTITY.
//   No assertion in this file reads the return value of the model it is testing.
//   The observables are entity-side only: `enemies[].alert`, `enemies[].alert_state`,
//   `enemies[].pos`, `civilians[].suspicion`, `crime.witnesses`, `crime.stolen_registry`,
//   `bounty`. If a block here can pass while the model is disconnected, it is a bad block.
//
// Each block prints {model_value_a, model_value_b, observed_a, observed_b, coupling} and a
// NULL CONTROL — a perturbation the item predicts changes nothing.
//
// USAGE
//   node tools/harness/w1-15-coupling.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-15-coupling.mjs — RI-MTH07 coupling probes for W1-15. Entity-side observables only.\n`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const R = { schema: 'elder-souls/world-coupling@1', piece: 'W1-15', generated_by: 'tools/harness/w1-15-coupling.mjs', models: [], measurements: {} };
const say = (s) => process.stdout.write(s + '\n');
const rec = (k, v) => { R.measurements[k] = v; say(`--- ${k}\n${JSON.stringify(v, null, 1)}`); };
const cpl = (obsA, obsB, predA, predB) => {
  if (predA === predB) return null;
  return +(Math.abs(obsB - obsA) / Math.abs(predB - predA)).toFixed(4);
};

// ---------------------------------------------------------------------------------------------
// Scenario helper: a fresh page per row. reset() is now required to clear the subsystem, and
// block 9 asserts that it does — but the detection rows are still taken on fresh pages so that a
// regression in reset() cannot silently contaminate the headline table.
// ---------------------------------------------------------------------------------------------
async function fresh(fn) {
  const g = await launchGame(args);
  try { return await fn(g); } finally { await g.close(); }
}

/** RI-STL01 method 2's exact instrument: one INFANTRY facing the player at 8 m. */
async function enemyRow(g, c) {
  await g.h('setSeed', 1337);
  await g.h('loadState', 'arena_flat');
  await g.h('teleport', 0, 0);
  await g.h('setTimeOfDay', c.tod);
  await g.h('setStealthState', { sneak: c.sneak, load: c.load, surface: c.surface || 'mud', inCover: !!c.cover, zone: 'zc' });
  await g.h('setZoneAmbient', 'zc', c.amb);
  if (c.crouch) { await g.h('queueInputs', [{ f: 0, press: ['crouch'] }, { f: 2, release: ['crouch'] }]); await g.h('stepFrames', 4); }
  // The enemy is spawned facing the player: spawn() places it at +z looking down -z at the origin.
  await g.h('spawn', 'inf_trash', 0, c.dist, { as: 'e1', yaw: c.enemyYaw === undefined ? 0 : c.enemyYaw });
  const f0 = (await g.h('snapshot')).f;
  let aggro = null, susp = null, V = null, L = null, chan = null, curve = [], alertEnd = 0;
  const budget = c.frames || 3600;
  for (let i = 0; i * 10 < budget; i++) {
    await g.h('stepFrames', 10);
    const s = await g.h('snapshot');
    const e = s.enemies[s.enemies.length - 1];
    V = s.player.stealth.V; L = s.player.stealth.light;
    alertEnd = e.alert; if (e.alert_channel) chan = e.alert_channel;
    if (i < 5) curve.push({ f: s.f - f0, alert: e.alert, state: e.alert_state, ch: e.alert_channel });
    if (e.alert_state === 'SUSPICIOUS' && susp === null) susp = s.f - f0;
    if (e.alert_state === 'AGGRO') { aggro = s.f - f0; break; }
  }
  return { ...c, V, L, alert_channel: chan, alert_end: alertEnd, aggro_f: aggro, aggro_s: aggro === null ? null : +(aggro / 60).toFixed(3), t_suspicious_s: susp === null ? null : +(susp / 60).toFixed(3), curve };
}

try {
  // =========================================================================================
  // 1. RI-STL01 method 2 — the five worked rows, on an ENTITY. The headline coupling number.
  // =========================================================================================
  const rows = [
    { id: 'r1-sprint-torchlit-heavy-S5', tod: 12, amb: 'sun_open', crouch: false, sneak: 5, load: 'heavy', cover: false, dist: 8, motion: 'sprint', item_V: 1.30, item_s: 1.03 },
    { id: 'r2-walk-dim-medium-S5', tod: 12, amb: 0.35, crouch: false, sneak: 5, load: 'medium', cover: false, dist: 8, motion: 'walk', item_V: 0.339, item_s: 3.94 },
    { id: 'r3-crouch-dim-light-S45', tod: 12, amb: 0.35, crouch: true, sneak: 45, load: 'light', cover: false, dist: 8, motion: 'crouch_move', item_V: 0.157, item_s: 8.5 },
    { id: 'r4-crouch-unlit-light-S45-cover', tod: 12, amb: 0.06, crouch: true, sneak: 45, load: 'light', cover: true, dist: 8, motion: 'crouch_move', item_V: 0.050, item_s: 26.7 },
    { id: 'r5-still-unlit-light-S100-cover', tod: 12, amb: 0.06, crouch: true, sneak: 100, load: 'light', cover: true, dist: 8, motion: 'still', item_V: 0.050, item_s: 26.7 },
  ];
  const m2 = [];
  for (const r of rows) m2.push(await fresh((g) => enemyRow(g, r)));
  // The control: beyond R, nothing may alert at all, in either configuration.
  const ctlFar = await fresh((g) => enemyRow(g, { id: 'control-30m-lit', tod: 12, amb: 'sun_open', crouch: false, sneak: 5, load: 'heavy', cover: false, dist: 30, frames: 1200 }));
  const a = m2[0], b = m2[3];
  rec('RI-STL01-M2-enemy-detection', {
    question: 'RI-STL01 method 2 — one INFANTRY facing the player at 8 m; frame of first alert_state == AGGRO',
    consumer: 'game/src/sim/entities.js stepEntities() -> perceive() -> sim.stealth.fillFor(e, ...) reading stealth.p.V',
    rows: m2,
    null_control_beyond_R: { dist_m: 30, aggro_f: ctlFar.aggro_f, alert_end: ctlFar.alert_end },
    coupling: {
      pair: 'row 1 (V=1.30) vs row 4 (V=0.05)',
      model_value_a: a.V, model_value_b: b.V,
      observed_a_s: a.aggro_s, observed_b_s: b.aggro_s,
      predicted_a_s: a.item_s, predicted_b_s: b.item_s,
      coupling: cpl(a.aggro_s, b.aggro_s, a.item_s, b.item_s),
    },
  });

  // =========================================================================================
  // 2. RI-STL01 method 4 — no proximity leak. Crouched, still, unlit, 1.0 m BEHIND the enemy.
  // =========================================================================================
  const leak = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'arena_flat'); await g.h('teleport', 0, 0);
    await g.h('setTimeOfDay', 12);
    await g.h('setStealthState', { sneak: 100, load: 'light', surface: 'mud', inCover: true, zone: 'zl' });
    await g.h('setZoneAmbient', 'zl', 0.06);
    await g.h('queueInputs', [{ f: 0, press: ['crouch'] }, { f: 2, release: ['crouch'] }]);
    await g.h('stepFrames', 4);
    // Enemy at 1.0 m FACING AWAY (yaw 180 = looking down +z, player is at -z of it).
    await g.h('spawn', 'inf_trash', 0, 1.0, { as: 'e1', yaw: 180 });
    await g.h('stepFrames', 3600);
    const s = await g.h('snapshot');
    return { alert: s.enemies[0].alert, state: s.enemies[0].alert_state, channel: s.enemies[0].alert_channel, frames: 3600 };
  });
  rec('RI-STL01-M4-no-proximity-leak', {
    question: 'RI-STL01 method 4 — crouched, unlit, still, 1.0 m behind a stationary enemy for 3,600 f@60',
    item_expects: 'alert never exceeds 0, no AGGRO',
    measured: leak,
  });

  // =========================================================================================
  // 3. SOUND — RI-STL01 §4 reaching an entity. Perturb the sound radius, observe an enemy.
  // =========================================================================================
  async function soundRow(g, c) {
    await g.h('setSeed', 1337); await g.h('loadState', 'arena_flat'); await g.h('teleport', 0, 0);
    await g.h('setTimeOfDay', 12);
    await g.h('setStealthState', { sneak: c.sneak, load: c.load, surface: c.surface, inCover: false, zone: 'zs' });
    await g.h('setZoneAmbient', 'zs', 0.04);       // unlit: the SIGHT channel is at its floor
    // Enemy facing AWAY at `dist`, so sight cannot be the channel that fills the meter.
    await g.h('spawn', 'inf_trash', 0, c.dist, { as: 'e1', yaw: 180 });
    await g.h('setPlayerMotion', c.motion);
    let chan = null, rise = null;
    for (let i = 0; i < 120; i++) {
      await g.h('stepFrames', 10);
      const s = await g.h('snapshot');
      const e = s.enemies[0];
      if (e.alert > 0 && rise === null) { rise = s.f; chan = e.alert_channel; }
      if (e.alert_state === 'AGGRO') break;
    }
    const s = await g.h('snapshot');
    return { ...c, sound_r_m: s.player.stealth.sound_r_m, alert: s.enemies[0].alert, state: s.enemies[0].alert_state, channel: chan, first_rise_f: rise };
  }
  const snd = [];
  for (const c of [
    { id: 'loud-sprint-heavy-dryreed-S5-at-20m', motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 20 },
    { id: 'quiet-crouch-light-mud-S100-at-20m', motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 20 },
    { id: 'loud-sprint-heavy-dryreed-S5-at-3m', motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 3 },
    { id: 'quiet-crouch-light-mud-S100-at-3m', motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 3 },
    { id: 'null-control-still-at-3m', motion: 'still', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 3 },
  ]) snd.push(await fresh((g) => soundRow(g, c)));
  rec('RI-STL01-M3-sound-reaches-an-entity', {
    question: 'RI-STL01 §4 — does r_effective change what an entity that CANNOT SEE the player does?',
    consumer: 'entities.js perceive() hearing channel; alert_channel == "hearing"',
    rows: snd,
    null_control: 'motion=still has r_base 0 m: the 3 m row must never alert',
  });

  // Sound reaching a CIVILIAN — the R1 verdict's explicit failure (2 m, facing away, 10 s sprint).
  const civSound = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'default'); await g.h('teleport', 0, 0);
    await g.h('setStealthState', { sneak: 5, load: 'heavy', surface: 'dry_reed', inCover: false, zone: 'zcs' });
    await g.h('setZoneAmbient', 'zcs', 0.04);
    await g.h('setCrimeContext', 'crouched_public');
    await g.h('spawnCivilian', { eid: 'sd2', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 2], yaw: 0 });
    await g.h('setPlayerMotion', 'sprint');
    await g.h('stepFrames', 600);
    const c = (await g.h('listCivilians')).find((x) => x.eid === 'sd2');
    const s = await g.h('snapshot');
    return { sound_r_m: s.player.stealth.sound_r_m, civ: c };
  });
  rec('RI-STL01-sound-reaches-a-civilian', {
    question: 'R1 verdict: "a civilian 2 m away, facing away, after 10 s of that sprint, registers suspicion 0.00"',
    measured: civSound,
  });

  // =========================================================================================
  // 4. LINE OF SIGHT — a wall must block sight. Perturb geometry, observe the entity.
  // =========================================================================================
  const los = [];
  for (const wall of [false, true]) {
    los.push(await fresh(async (g) => {
      await g.h('setSeed', 1337); await g.h('loadState', 'arena_flat'); await g.h('teleport', 0, 0);
      await g.h('setTimeOfDay', 12);
      await g.h('setStealthState', { sneak: 5, load: 'heavy', surface: 'mud', inCover: false, zone: 'zw' });
      await g.h('setZoneAmbient', 'zw', 'sun_open');
      if (wall) await g.h('addOccluder', { id: 'w1', min: [-3, 0, 3.8], max: [3, 3, 4.2] });
      await g.h('spawn', 'inf_trash', 0, 8, { as: 'e1', yaw: 0 });
      await g.h('stepFrames', 600);
      const s = await g.h('snapshot');
      return { wall, alert: s.enemies[0].alert, state: s.enemies[0].alert_state, channel: s.enemies[0].alert_channel, occluders: (await g.h('listOccluders')).length };
    }));
  }
  rec('RI-STL01-LOS-occlusion', {
    question: 'is there a line-of-sight term at all? Same configuration, one axis-aligned wall between the two.',
    consumer: 'sim/stealth/occlusion.js segmentBlocked(), called from entities.js perceive() and the civilian pass',
    open: los[0], walled: los[1],
    coupling: cpl(los[0].alert, los[1].alert, 100, 0),
  });

  // =========================================================================================
  // 5. SEARCH — RI-STL01 §7 S-1..S-4 in the world. Be seen, break contact, watch the searcher.
  // =========================================================================================
  const search = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'arena_flat'); await g.h('teleport', 0, 0);
    await g.h('setTimeOfDay', 12);
    await g.h('setStealthState', { sneak: 5, load: 'heavy', surface: 'mud', inCover: false, zone: 'warehouse' });
    await g.h('setZoneAmbient', 'warehouse', 'sun_open');
    await g.h('addCoverVolume', { id: 'c1', pos: [4, 0, 10], zone: 'warehouse' });
    await g.h('addCoverVolume', { id: 'c2', pos: [-5, 0, 9], zone: 'warehouse' });
    await g.h('addCoverVolume', { id: 'c3', pos: [1, 0, 13], zone: 'warehouse' });
    await g.h('addCoverVolume', { id: 'c4', pos: [40, 0, 40], zone: 'warehouse' });   // out of range
    await g.h('spawn', 'inf_trash', 0, 8, { as: 'es', yaw: 0 });
    await g.h('spawn', 'inf_trash', 6, 10, { as: 'ally', yaw: 0 });                   // S-3 within 12 m
    await g.h('spawn', 'inf_trash', 0, 60, { as: 'far', yaw: 0 });                    // S-3 beyond 12 m
    let f = 0;
    while (f < 900) { await g.h('stepFrames', 30); f += 30; const s = await g.h('snapshot'); if (s.enemies[0].alert_state === 'AGGRO') break; }
    const atBreak = (await g.h('snapshot'));
    const lkp = atBreak.player.pos.map((n) => +n.toFixed(2));
    await g.h('teleport', 0, -80);                        // break contact, hard
    const tl = [];
    let maxSpeed = 0, maxDist = 0, searchEnd = null;
    for (let i = 0; i < 30; i++) {
      await g.h('stepFrames', 60);
      const s = await g.h('snapshot');
      const e = s.enemies[0];
      const d = Math.hypot(e.pos[0] - lkp[0], e.pos[2] - lkp[2]);
      maxSpeed = Math.max(maxSpeed, e.speed_mps); maxDist = Math.max(maxDist, d);
      tl.push({ t_s: i + 1, alert: e.alert, state: e.alert_state, pos: e.pos.map((n) => +n.toFixed(2)), speed: +e.speed_mps.toFixed(2), d_from_lkp: +d.toFixed(2) });
      if (e.alert_state === 'IDLE' && searchEnd === null && i > 1) searchEnd = i + 1;
    }
    const st = await g.h('getStealthState');
    const sr = await g.h('getSearchState');
    return {
      at_break: { alert: atBreak.enemies[0].alert, state: atBreak.enemies[0].alert_state, lkp },
      timeline: tl,
      max_search_speed_mps: +maxSpeed.toFixed(2),
      max_dist_from_lkp_m: +maxDist.toFixed(2),
      search_ended_at_s: searchEnd,
      zone_baseline_alert_after: st.zone_baseline_alert,
      s3_ally_alert: (await g.h('snapshot')).enemies.map((e) => ({ eid: e.eid, alert: e.alert, hop: e.alert_hop })),
      search_records: sr,
    };
  });
  rec('RI-STL01-M6-search', {
    question: 'RI-STL01 §7 — S-1 LKP + plausible set, S-2 escalating radius, S-3 one-hop, S-4 zone memory',
    item_expects: { duration_s: 12, s2_radii_m: [8, 14, 20], s3_raise_to: 45, s4_baseline: 25 },
    measured: search,
  });

  // =========================================================================================
  // 6. WITNESS FROM THE WORLD — RI-CRM01 method 3 with ZERO addWitness() calls.
  // =========================================================================================
  const wit = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'default'); await g.h('teleport', 0, 0);
    const zones = await g.h('listPropertyZones', 'gideon');
    const owned = await g.h('listOwnedObjects', zones[0].id);
    await g.h('setTimeOfDay', 12);
    await g.h('setStealthState', { sneak: 5, load: 'medium', surface: 'timber', inCover: false, zone: 'zw2' });
    await g.h('setZoneAmbient', 'zw2', 'sun_open');
    await g.h('spawnCivilian', { eid: 'wit', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
    await g.h('spawnCivilian', { eid: 'grd', group: 'guard', race: 'imperial', R: 20, pos: [0, 0, 120], yaw: 180 });
    await g.h('setCrimeContext', 'handling_owned_object');
    await g.h('stepFrames', 300);
    const civAtTheft = await g.h('listCivilians');
    const take = await g.h('takeObject', owned[0].instance, {});
    const f0 = (await g.h('snapshot')).f;
    const csAt = await g.h('getCrimeState');
    let reportF = null, bountyAt = [];
    for (let i = 0; i < 90; i++) {
      await g.h('stepFrames', 30);
      const cs = await g.h('getCrimeState');
      if (i % 10 === 0) bountyAt.push({ t_s: +(((await g.h('snapshot')).f - f0) / 60).toFixed(1), bounty: cs.bounty.imperial });
      if (cs.bounty.imperial > 0 && reportF === null) { reportF = (await g.h('snapshot')).f - f0; break; }
    }
    const cs = await g.h('getCrimeState');
    const sv = await g.h('saveState');
    return {
      addWitness_calls: 0,
      civilian_at_the_theft: civAtTheft,
      takeObject: take,
      witnesses_on_the_crime_frame: csAt.witnesses,
      report_latency_s: reportF === null ? null : +(reportF / 60).toFixed(2),
      predicted_latency_s: +(120 / 3.4).toFixed(2),
      bounty_timeline: bountyAt,
      final: { bounty: cs.bounty, witnesses: cs.witnesses, crimes: cs.crimes, stolen_registry: cs.stolen_registry },
      save_crime: sv.crime, save_inventory: sv.inventory,
    };
  });
  rec('RI-CRM01-M3-witness-from-the-world', {
    question: 'RI-CRM01 method 3, end to end, with ZERO addWitness() calls in this script',
    consumer: 'stealth/system.js step() -> deriveWitnesses(): live civilians + guards evaluated against WIT.isWitness()',
    measured: wit,
  });

  // The null control the item demands: same theft, no NPC anywhere.
  const noWit = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'default'); await g.h('teleport', 0, 0);
    const zones = await g.h('listPropertyZones', 'gideon');
    const owned = await g.h('listOwnedObjects', zones[0].id);
    await g.h('setCrimeContext', 'handling_owned_object');
    await g.h('stepFrames', 60);
    const takes = [];
    for (let i = 0; i < 20; i++) takes.push(await g.h('takeObject', owned[i].instance, {}));
    await g.h('stepFrames', 600);
    const cs = await g.h('getCrimeState');
    const sv = await g.h('saveState');
    return {
      bounty: cs.bounty, witnesses: cs.witnesses.length,
      all_20_carry_stolen_from: takes.every((t) => !!t.stolen_from),
      stolen_registry_n: (cs.stolen_registry || []).length,
      save_stolen_registry_n: ((sv.crime || {}).stolen_registry || []).length,
      save_inventory_stolen: (sv.inventory || []).filter((i) => i.stolen).length,
    };
  });
  rec('RI-CRM01-M2-no-witness-no-bounty', {
    question: 'RI-CRM01 method 2 — steal 20 owned items with no NPC present',
    item_expects: 'bounty 0, witnesses [], all 20 carry stolen_from',
    measured: noWit,
  });

  // =========================================================================================
  // 7. S13 — the parley must exist and be reachable in a live fight.
  // =========================================================================================
  const parley = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'arena_flat'); await g.h('teleport', 0, 0);
    await g.h('setBounty', 'imperial', 2500);
    await g.h('spawnGuard', { eid: 'g1', pos: [0, 0, 6], yaw: 0, jurisdiction: 'imperial' });
    await g.h('stepFrames', 300);
    const band = await g.h('getGuardBand', {});
    const opts = await g.h('parleyOptions');
    const before = await g.h('snapshot');
    const res = await g.h('parleyBegin', 'surrender');
    const frames = [];
    for (let i = 0; i < 8; i++) { await g.h('stepFrames', 20); frames.push(await g.h('parleyState')); }
    const after = await g.h('snapshot');
    return { band: band.band, options: opts, begin: res, commitment_frames: (res || {}).commit_f, tail: frames[frames.length - 1], guard_state_before: before.enemies.map((e) => e.alert_state), guard_state_after: after.enemies.map((e) => e.alert_state) };
  });
  rec('S13-parley-reachable', {
    question: 'ARBITRATION S13 — a fight with a person must have a non-lethal exit; 102 f@60 commitment, guard down, no i-frames',
    measured: parley,
  });

  // =========================================================================================
  // 8. RI-QST05 — the verb census, recomputed.
  // =========================================================================================
  const qst = await fresh(async (g) => g.h('questVerbCensus'));
  rec('RI-QST05-verb-census', { question: 'RI-QST05 — PACIFIST-ALL, VERB-SPREAD, per-verb counts', measured: qst });

  // =========================================================================================
  // 9. SCENARIO ISOLATION — reset() must clear this subsystem (R1 secondary finding).
  // =========================================================================================
  const iso = await fresh(async (g) => {
    await g.h('setSeed', 1337); await g.h('loadState', 'default');
    await g.h('setBounty', 'imperial', 777);
    await g.h('setCrimeContext', 'lockpicking');
    await g.h('spawnCivilian', { eid: 'ghost', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
    await g.h('reset', {});
    const afterReset = { bounty: (await g.h('getCrimeState')).bounty, context: (await g.h('getStealthState')).context, civilians: (await g.h('listCivilians')).length };
    await g.h('setBounty', 'imperial', 555);
    await g.h('loadState', 'default');
    const afterLoad = { bounty: (await g.h('getCrimeState')).bounty, context: (await g.h('getStealthState')).context, civilians: (await g.h('listCivilians')).length };
    return { after_reset: afterReset, after_loadState: afterLoad };
  });
  rec('HARNESS-scenario-isolation', { question: 'does reset()/loadState() clear the stealth+crime subsystem?', measured: iso });

  R.build = await fresh((g) => g.h('getBuildInfo'));
} catch (e) {
  R.error = { message: e.message, stack: e.stack };
  say('ERROR ' + e.message + '\n' + e.stack);
}
if (args.json) writeJson(args.json, R);
say('\ndone');
