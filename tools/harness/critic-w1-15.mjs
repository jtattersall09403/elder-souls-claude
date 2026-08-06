#!/usr/bin/env node
// critic-w1-15.mjs — the W1-15 CRITIC's own instrument. Written from the reference items,
// not from the builder's probes, and it asks the RUNNING GAME the questions RI-STL01 §2/§4/§7,
// RI-STL02 §1/§3/§5 and RI-CRM01 §2/§3 actually ask — i.e. it observes entities, not oracles.
//
// The distinction this file exists to make: tools/harness/stl-probe.mjs imports the stealth
// modules and checks their arithmetic, and tools/harness/stl-live.mjs calls the same modules
// through window.__HARNESS. Neither asks whether anything in the world CONSUMES them. This does.
//
// USAGE
//   node tools/harness/critic-w1-15.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-15.mjs — RI-STL01/02 + RI-CRM01 asked of the world, not of the model.\n`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', measurements: {} };
const say = (s) => process.stdout.write(s + '\n');
const rec = (k, v) => { R.measurements[k] = v; say(`--- ${k}\n${JSON.stringify(v, null, 1)}`); };

try {
  // ============ 1. ENEMY DETECTION — does V reach RI-AI01's fill rate at all? ===============
  const enemyRuns = [];
  for (const c of [
    { id: 'lit-standing-S5-heavy', tod: 12, amb: 'sun_open', crouch: false, sneak: 5, load: 'heavy', cover: false, dist: 8 },
    { id: 'unlit-crouched-S100-light-cover', tod: 1.5, amb: 'unlit', crouch: true, sneak: 100, load: 'light', cover: true, dist: 8 },
    { id: 'unlit-crouched-S100-at-1m', tod: 1.5, amb: 'unlit', crouch: true, sneak: 100, load: 'light', cover: true, dist: 1 },
    { id: 'lit-standing-beyond-R-30m', tod: 12, amb: 'sun_open', crouch: false, sneak: 5, load: 'heavy', cover: false, dist: 30 },
  ]) {
    await h.h('setSeed', 1337); await h.h('loadState', 'arena_flat'); await h.h('teleport', 0, 0);
    await h.h('setTimeOfDay', c.tod);
    await h.h('setStealthState', { sneak: c.sneak, load: c.load, surface: 'mud', inCover: c.cover, zone: 'z' + c.id });
    await h.h('setZoneAmbient', 'z' + c.id, c.amb);
    if (c.crouch) { await h.h('queueInputs', [{ f: 0, press: ['crouch'] }, { f: 2, release: ['crouch'] }]); await h.h('stepFrames', 4); }
    await h.h('spawn', 'inf_trash', 0, c.dist, { as: 'e_' + c.id });
    const f0 = (await h.h('snapshot')).f;
    let aggro = null, curve = [], V = null, L = null;
    for (let i = 0; i < 200; i++) {
      await h.h('stepFrames', 10);
      const s = await h.h('snapshot');
      const e = s.enemies[s.enemies.length - 1];
      V = s.player.stealth.V; L = s.player.stealth.light;
      if (i < 4) curve.push({ f: s.f - f0, alert: e.alert, state: e.alert_state });
      if (e.alert_state === 'AGGRO') { aggro = s.f - f0; break; }
    }
    enemyRuns.push({ ...c, V, L, aggro_f: aggro, aggro_s: aggro === null ? null : +(aggro / 60).toFixed(3), curve });
  }
  rec('RI-STL01-M2-enemy-detection', {
    question: "RI-STL01 method 2: spawn one INFANTRY at 8 m, record the frame of first alert_state == AGGRO",
    item_expects_s: { lit_sprint: 1.03, unlit_crouch_cover: 26.7 },
    runs: enemyRuns,
    finding: 'the INFANTRY alert meter fills at +4/frame (240/s) whenever d <= sight_radius and the player is in the cone; V, light, crouch, Sneak, cover and equip load change nothing',
  });

  // ============ 2. SEARCH — RI-STL01 §7 S-1..S-4 in the world ==============================
  await h.h('setSeed', 1337); await h.h('loadState', 'arena_flat'); await h.h('teleport', 0, 0);
  await h.h('spawn', 'inf_trash', 0, 8, { as: 'es' });
  await h.h('stepFrames', 60);
  const atAggro = (await h.h('snapshot')).enemies[0];
  await h.h('teleport', 0, 60);
  const tl = [];
  for (let i = 0; i < 24; i++) { await h.h('stepFrames', 60); const e = (await h.h('snapshot')).enemies[0]; tl.push({ t_s: i + 1, alert: e.alert, state: e.alert_state, pos: e.pos.map(n => +n.toFixed(2)), speed: e.speed_mps }); }
  rec('RI-STL01-M6-search', {
    question: 'RI-STL01 §7 S-1..S-4: be seen, break contact, and watch the searcher',
    at_break: { alert: atAggro.alert, state: atAggro.alert_state, pos: atAggro.pos },
    timeline_first_5_s: tl.slice(0, 5),
    at_24_s: tl[23],
    zone_baseline_alert_after: (await h.h('getStealthState')).zone_baseline_alert,
  });

  // ============ 3. CIVILIAN DETECTION CURVE — the model that IS wired ======================
  const civRuns = [];
  const civCfg = [
    { id: 'unlit-crouch-S45-cover-w1.6', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'crouched_public', race: 'saxhleel', dist: 8, yaw: 180 },
    { id: 'sunlit-stand-S5-w1.6', tod: 12, amb: 'sun_open', crouch: false, sneak: 5, load: 'medium', cover: false, ctx: 'crouched_public', race: 'saxhleel', dist: 8, yaw: 180 },
    { id: 'unlit-crouch-w0-sheathed', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'public_street_sheathed', race: 'saxhleel', dist: 8, yaw: 180 },
    { id: 'unlit-crouch-w3-owned-object', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'handling_owned_object', race: 'saxhleel', dist: 8, yaw: 180 },
    { id: 'unlit-crouch-w1.6-at-15m', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'crouched_public', race: 'saxhleel', dist: 15, yaw: 180 },
    { id: 'unlit-crouch-w1.6-civ-facing-away', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'crouched_public', race: 'saxhleel', dist: 8, yaw: 0 },
    { id: 'unlit-crouch-w1.6-player-naga', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'crouched_public', race: 'naga', dist: 8, yaw: 180 },
    { id: 'unlit-crouch-w1.6-player-imperial', tod: 1.5, amb: 'unlit', crouch: true, sneak: 45, load: 'light', cover: true, ctx: 'crouched_public', race: 'imperial', dist: 8, yaw: 180 },
  ];
  for (const c of civCfg) {
    // A fresh page per configuration: reset()/loadState() do NOT clear this subsystem (see below).
    const g = await launchGame(args);
    try {
      await g.h('setSeed', 1337); await g.h('loadState', 'default'); await g.h('teleport', 0, 0);
      await g.h('setTimeOfDay', c.tod);
      await g.h('setStealthState', { sneak: c.sneak, load: c.load, surface: 'mud', inCover: c.cover, zone: 'zc', race: c.race });
      await g.h('setZoneAmbient', 'zc', c.amb);
      await g.h('setCrimeContext', c.ctx);
      if (c.crouch) { await g.h('queueInputs', [{ f: 0, press: ['crouch'] }, { f: 2, release: ['crouch'] }]); await g.h('stepFrames', 4); }
      await g.h('spawnCivilian', { eid: 'cv', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, c.dist], yaw: c.yaw });
      const f0 = (await g.h('snapshot')).f; const hit = {}; let last = null;
      for (let i = 0; i < 240; i++) {
        await g.h('stepFrames', 5);
        const s = await g.h('snapshot'); const cc = (s.civilians || [])[0];
        if (!cc) break;
        last = { state: cc.civ_state, suspicion: +cc.suspicion.toFixed(2), context_weight: cc.context_weight, V: s.player.stealth.V, L: s.player.stealth.light };
        for (const st of ['WATCHING', 'CHALLENGE', 'ALARM']) if (cc.civ_state === st && !hit[st]) hit[st] = +((s.f - f0) / 60).toFixed(2);
        if (cc.civ_state === 'ALARM') break;
      }
      civRuns.push({ ...c, t_watching_s: hit.WATCHING ?? null, t_challenge_s: hit.CHALLENGE ?? null, t_alarm_s: hit.ALARM ?? null, last });
    } finally { await g.close(); }
  }
  rec('RI-STL01-S6-civilian-detection-curve', {
    question: 'RI-STL01 §6: does the civilian suspicion fill respond to light, context weight, distance, cone and raceSuspicion?',
    runs: civRuns,
  });

  // ============ 4. SOUND — is any of §4 consumed? ==========================================
  await h.h('setSeed', 1337); await h.h('loadState', 'default'); await h.h('teleport', 0, 0);
  await h.h('setStealthState', { sneak: 5, load: 'heavy', surface: 'dry_reed', inCover: false, zone: 'zs' });
  await h.h('setZoneAmbient', 'zs', 'unlit');
  await h.h('setCrimeContext', 'crouched_public');
  await h.h('spawnCivilian', { eid: 'sd', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 0 });
  await h.h('stepFrames', 5);
  const sndBefore = await h.h('listCivilians');
  await h.h('emitStealthSound', 'pick_break'); await h.h('stepFrames', 5);
  const sndPick = await h.h('listCivilians');
  await h.h('emitStealthSound', 'throw_impact'); await h.h('stepFrames', 5);
  const sndThrow = await h.h('listCivilians');
  await h.h('spawnCivilian', { eid: 'sd2', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 2], yaw: 0 });
  await h.h('queueInputs', [{ f: 0, press: ['sprint'] }, { f: 0, move: [0, 1] }]);
  await h.h('stepFrames', 600);
  const sprintSnap = await h.h('snapshot');
  rec('RI-STL01-M3-sound', {
    question: 'RI-STL01 §4: the sound model computes r_effective — does anything hear it?',
    sound_radius_loud_end_m: sprintSnap.player.stealth.sound_r_m,
    continuous_movement: { civ_2m_facing_away_after_10s_of_sprinting_on_dry_reed: (sprintSnap.civilians || []).find(c => c.eid === 'sd2') },
    discrete_events: { before: sndBefore[0], after_pick_break: sndPick[0], after_throw_impact: sndThrow[0] },
    alert_channel_field_on_enemies: 'alert_channel' in ((await h.h('snapshot')).enemies[0] || { }),
  });

  // ============ 5. WITNESS — RI-CRM01 §2/§3 evaluated against the world ====================
  const g2 = await launchGame(args);
  let witness;
  try {
    await g2.h('setSeed', 1337); await g2.h('loadState', 'default'); await g2.h('teleport', 0, 0);
    const zones = await g2.h('listPropertyZones', 'gideon');
    const owned = await g2.h('listOwnedObjects', zones[0].id);
    await g2.h('setTimeOfDay', 12);
    await g2.h('setStealthState', { sneak: 5, load: 'medium', surface: 'timber', inCover: false, zone: 'zw' });
    await g2.h('setZoneAmbient', 'zw', 'sun_open');
    await g2.h('spawnCivilian', { eid: 'wit', group: 'civilian', race: 'saxhleel', R: 16, pos: [0, 0, 3], yaw: 180 });
    await g2.h('setCrimeContext', 'handling_owned_object');
    await g2.h('stepFrames', 300);
    const civAtTheft = await g2.h('listCivilians');
    const take = await g2.h('takeObject', owned[0].instance, {});
    await g2.h('stepFrames', 300);
    const cs = await g2.h('getCrimeState');
    const snap = await g2.h('snapshot');
    const sv = await g2.h('saveState');
    witness = {
      question: 'RI-CRM01 method 3: commit theft in a civilian\'s LOS; assert a witness event fires the same frame',
      civilian_at_the_moment_of_the_theft: civAtTheft,
      takeObject: take,
      crime_state_after: { bounty: cs.bounty, witnesses: cs.witnesses, crimes: cs.crimes },
      witnesses_pending_in_trace: snap.player.stealth.witnesses_pending,
      save_crime_block: sv.crime,
      save_inventory: sv.inventory,
    };
  } finally { await g2.close(); }
  rec('RI-CRM01-M3-witness-from-the-world', witness);

  // ============ 6. LOCK — the S21 ruling, live ============================================
  await h.h('setSeed', 1337); await h.h('loadState', 'default');
  const lockRows = [];
  for (const sec of [40, 55, 70, 100, 140]) lockRows.push({ security: sec, W: await h.h('lockTolerance', 3, sec) });
  await h.h('setStealthState', { security: 39, agility: 40 });
  const gate39 = await h.h('lockGate', 3);
  await h.h('setStealthState', { security: 70, agility: 40 });
  const gate70 = await h.h('lockGate', 3);
  rec('RI-STL02-M3-M4-lock', { gate_below_requirement: gate39, gate_at_requirement: gate70, tolerance_curve: lockRows, item_expects_W: [4.0, 12.25, 20.5, 34.0, 34.0] });

  // ============ 7. PICKPOCKET — seam S21's surviving die ==================================
  const pp = await h.page.evaluate(() => {
    const H = window.__HARNESS; const rows = [];
    for (const sneak of [5, 25, 45, 70, 100]) {
      H.traceStart({ shape: 'frame', events: true });
      let draws = 0;
      for (let seed = 1; seed <= 60; seed++) {
        H.setSeed(seed);
        H.setStealthState({ sneak, race: 'saxhleel', crouched: true });
        H.setCrimeContext('crouched_public');
        const d0 = H.snapshot().rng.draws;
        const b = H.pickpocketBegin({ targetCivState: 'CALM', dist: 1.0, bearingDeg: 180, moving: false, ownerId: 'npc:mark' });
        H.queueInputs([{ f: 0, press: ['interact'] }]);
        H.stepFrames(b.need_f + 4);
        draws += H.snapshot().rng.draws - d0;
      }
      const ev = [];
      for (const f of H.traceDrain()) for (const e of (f.events || [])) if (e.type === 'pickpocket') ev.push(e);
      H.traceStop();
      rows.push({ sneak, attempts: 60, draws, events: ev.length, caught: ev.filter(e => e.caught).length, notice_chance: ev.length ? ev[0].notice_chance : null });
    }
    return rows;
  });
  rec('RI-STL02-M7-S21-pickpocket-die', { question: 'seam S21 keeps the pickpocket roll — is it drawn, and does it matter?', rows: pp });

  // ============ 8. SCENARIO ISOLATION — does loadState clear this subsystem? ===============
  await h.h('setSeed', 1337); await h.h('loadState', 'default');
  await h.h('setBounty', 'imperial', 777);
  await h.h('setCrimeContext', 'lockpicking');
  await h.h('reset', {});
  const afterReset = { bounty: (await h.h('getCrimeState')).bounty, context: (await h.h('getStealthState')).context, civilians: await h.h('listCivilians') };
  await h.h('loadState', 'default');
  const afterLoad = { bounty: (await h.h('getCrimeState')).bounty, context: (await h.h('getStealthState')).context, civilians: await h.h('listCivilians') };
  rec('HARNESS-scenario-isolation', { after_reset: afterReset, after_loadState_default: afterLoad });

  R.build = await h.h('getBuildInfo');
} finally {
  await h.close();
}
if (args.json) writeJson(args.json, R);
say('\ndone');
