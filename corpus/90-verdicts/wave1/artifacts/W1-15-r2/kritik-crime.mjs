#!/usr/bin/env node
// kritik-crime.mjs — search, witnesses derived from the world, ownership + the save, the S13
// parley, and the round-1 passes that must not have regressed.
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('kritik-crime.mjs\n');
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'crime', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };

try {
  await h.h('setRenderRate', 0);

  // ==== BLOCK 13 — THE SEARCH, properly isolated. =========================================
  // AGGRO first, then the player LEAVES. RI-AI01 T25: no LOS >= 6 s AND dist > 1.6R -> SEARCH.
  // The LKP is therefore NOT where the player is standing, which is what made the first
  // attempt reacquire in 2.2 s.
  const search = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setTimeOfDay(12);
    H.setStealthState({ sneak: 5, load: 'heavy', surface: 'mud', zone: 'zs' });
    H.setZoneAmbient('zs', 1.0);
    H.setPlayerMotion('still');
    // cover volumes placed BEHIND the searcher's own back, so S-1's cone test does not veto them
    H.addCoverVolume({ id: 'cvA', pos: [5, 0, -3], zone: 'zs' });
    H.addCoverVolume({ id: 'cvB', pos: [-6, 0, -2], zone: 'zs' });
    H.addCoverVolume({ id: 'cvC', pos: [0, 0, -7], zone: 'zs' });
    H.addCoverVolume({ id: 'cvD', pos: [7, 0, 1], zone: 'zs' });      // 4th: must be capped out
    H.spawn('inf_trash', 0, 8, { as: 'es', yaw: 180 });
    H.spawn('inf_trash', 6, 10, { as: 'es2', yaw: 180 });             // S-3 propagation target
    H.stepFrames(120);
    out.after_seen = H.perceptionState();
    // leave: 80 m away, far beyond 1.6R = 25.6 m
    H.teleport(0, -80);
    const f0 = H.getFrame();
    let enterF = null, endF = null, lkp = null, plan = null;
    const speeds = [];
    let prev = null;
    for (let i = 0; i < 2400; i++) {
      H.stepFrames(1);
      const ps = H.perceptionState();
      const e = ps.find((x) => x.eid === 'es');
      const ss = H.getSearchState();
      if (enterF === null && ss.length) { enterF = H.getFrame() - f0; lkp = ss[0].lkp; plan = ss[0].plan; }
      if (enterF !== null && endF === null && !ss.length) { endF = H.getFrame() - f0; }
      if (enterF !== null && endF === null && prev && e) {
        const d = Math.hypot(e.pos[0] - prev[0], e.pos[2] - prev[1]);
        if (d > 1e-9) speeds.push(+(d * 60).toFixed(4));
      }
      if (e) prev = [e.pos[0], e.pos[2]];
      if (endF !== null) break;
    }
    out.enter_f = enterF; out.enter_s = enterF === null ? null : +(enterF / 60).toFixed(3);
    out.end_f = endF;
    out.duration_s = (enterF !== null && endF !== null) ? +((endF - enterF) / 60).toFixed(3) : null;
    out.lkp = lkp; out.plan = plan;
    out.walk_max_mps = speeds.length ? +Math.max(...speeds).toFixed(4) : null;
    out.walk_samples = speeds.length;
    out.ally_after = H.perceptionState().find((x) => x.eid === 'es2');
    out.events = H.drainStealthEvents().filter((e) => e.type === 'search_start' || e.type === 'search_end');
    out.zone_baseline_now = H.getStealthState().zone_baseline_alert;
    H.stepFrames(60);
    out.searcher_after = H.perceptionState().find((x) => x.eid === 'es');
    out.zone_baseline_after = H.getStealthState().zone_baseline_alert;
    // S-4 must persist across a save round trip (RI-STL01 §7 S-4 "survives death and save")
    const sv = H.saveState();
    out.save_has_zones = !!(sv.crime && sv.crime.zones);
    out.save_zones = sv.crime ? sv.crime.zones : null;
    return out;
  });
  rec('B13-search', search);

  // ==== BLOCK 14 — the WITNESS, from the world verb, with ZERO addWitness() calls ==========
  const wit = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    const zones = H.listPropertyZones();
    out.zone_count = zones.length;
    const z = zones.find((x) => x.objects > 0 && x.class !== 'public') || zones.find((x) => x.objects > 0);
    out.zone = z;
    const objs = H.listOwnedObjects(z.id);
    out.n_objects = objs.length;

    function setup(civDist, guardDist, opts) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.setTimeOfDay(12);
      H.setStealthState({ sneak: 5, load: 'medium', surface: 'mud', zone: 'zw', race: 'imperial' });
      H.setZoneAmbient('zw', 1.0);
      H.setPlayerMotion('still');
      if (civDist !== null) H.spawnCivilian({ eid: 'cw', pos: [0, 0, civDist], yaw: 180 });
      if (guardDist !== null) H.spawnGuard({ eid: 'gw', pos: [0, 0, guardDist], yaw: 180 });
      H.setCrimeContext('handling_owned_object');
      H.stepFrames((opts && opts.warm) || 300);
    }

    // (a) civilian at 3 m + a guard at 120 m: the run-to-guard route
    setup(3, 120);
    out.a_civ_before = H.listCivilians();
    out.a_take = H.takeObject(objs[0].instance);
    out.a_crime = H.getCrimeState();
    out.a_pending = H.listPendingReports();
    let f0 = H.getFrame(), at = null;
    for (let i = 0; i < 4200; i++) {
      H.stepFrames(1);
      const cs = H.getCrimeState();
      if (cs.bounty.imperial > 0) { at = H.getFrame() - f0; out.a_bounty = cs.bounty.imperial; break; }
    }
    out.a_report_latency_f = at; out.a_report_latency_s = at === null ? null : +(at / 60).toFixed(3);

    // (b) guard at 20 m: the shout route
    setup(3, 20);
    out.b_take = H.takeObject(objs[1].instance);
    out.b_pending = H.listPendingReports();
    f0 = H.getFrame(); at = null;
    for (let i = 0; i < 1200; i++) {
      H.stepFrames(1);
      const cs = H.getCrimeState();
      if (cs.bounty.imperial > 0) { at = H.getFrame() - f0; out.b_bounty = cs.bounty.imperial; break; }
    }
    out.b_report_latency_f = at; out.b_report_latency_s = at === null ? null : +(at / 60).toFixed(3);

    // (c) NULL CONTROL 1 — nobody there at all
    setup(null, null);
    out.c_take = H.takeObject(objs[2].instance);
    out.c_crime = H.getCrimeState();
    H.stepFrames(3600);
    out.c_bounty_after_60s = H.getCrimeState().bounty.imperial;

    // (d) NULL CONTROL 2 — a civilian present but BLIND: turned away AND behind a wall
    setup(null, null);
    H.spawnCivilian({ eid: 'cb', pos: [0, 0, 3], yaw: 0 });
    H.addOccluder({ id: 'w_blind', min: [-4, 0, 1.4], max: [4, 4, 1.8] });
    H.stepFrames(300);
    out.d_civ = H.listCivilians();
    out.d_take = H.takeObject(objs[3].instance);
    out.d_crime = H.getCrimeState();
    H.stepFrames(3600);
    out.d_bounty_after_60s = H.getCrimeState().bounty.imperial;

    // (e) the three answers to a pending report
    setup(3, 120);
    out.e_take = H.takeObject(objs[4].instance);
    out.e_pending = H.listPendingReports();
    out.e_bribe = H.bribeWitness(0, null);
    H.stepFrames(3600);
    out.e_bounty_after_bribe = H.getCrimeState().bounty.imperial;
    return out;
  });
  rec('B14-witness-and-report', wit);

  // ==== BLOCK 15 — ownership: registry, save, byte-identity, the fence =====================
  const own = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setStealthState({ sneak: 5, load: 'medium', zone: 'zo', mercantile: 40, speechcraft: 30 });
    const zones = H.listPropertyZones();
    const z = zones.find((x) => x.objects >= 3);
    const objs = H.listOwnedObjects(z.id);
    out.taken = objs.slice(0, 3).map((o) => H.takeObject(o.instance));
    out.registry = H.getCrimeState().stolen_registry;
    out.inventory_rows = H.saveState().inventory ? H.saveState().inventory.filter((r) => r.stolen) : null;
    const sv = H.saveState();
    out.save_registry = sv.crime ? sv.crime.stolen_registry : null;
    out.round_trip = H.saveRoundTrip();
    const cs = H.getCrimeState();
    out.fences = cs.fences || null;
    return out;
  });
  rec('B15-ownership', own);

  // ==== BLOCK 16 — THE S13 PARLEY. Is it a commitment, or a free win button? ===============
  const parley = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    function fight(opts) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.setStealthState({ sneak: 5, load: 'medium', zone: 'zp' });
      if (opts && opts.gold !== undefined) H.setGold(opts.gold);
      H.spawn('guard_legion', 0, 3, { as: 'g1', yaw: 180 });
      H.aggro('g1');
      H.stepFrames(10);
    }
    // (a) the builder's claim: aggro'd guard at 3 m, one `interact`, full HP
    fight({ gold: 400 });
    out.a_before = { combat: H.getCombatState(), stats: H.getPlayerStats() };
    H.combatTraceStart({});
    H.queueInputs([{ f: H.getFrame() + 2, press: ['interact'] }, { f: H.getFrame() + 3, release: ['interact'] }]);
    H.stepFrames(120);
    out.a_events = H.combatTraceDrain().filter((e) => String(e.ev || e.type || '').indexOf('PARLEY') >= 0 || e.mv === 'PARLEY');
    out.a_after = { combat: H.getCombatState(), stats: H.getPlayerStats() };
    H.combatTraceStop();
    // (b) THE PRICE. Does it cost gold? Does it cost stamina? Does it cost frames?
    fight({ gold: 0 });
    const st0 = H.getPlayerStats();
    H.combatTraceStart({});
    const pressF = H.getFrame() + 2;
    H.queueInputs([{ f: pressF, press: ['interact'] }, { f: pressF + 1, release: ['interact'] }]);
    const curve = [];
    for (let i = 0; i < 120; i++) {
      H.stepFrames(1);
      const c = H.getCombatState();
      const s = H.getPlayerStats();
      curve.push({ df: H.getFrame() - pressF, pstate: c.player ? c.player.state : null, stam: s.stamina === undefined ? null : s.stamina, iframe: c.player ? c.player.iframe : null, e0: c.enemies && c.enemies[0] ? c.enemies[0].state : null });
    }
    out.b_gold0 = {
      gold_before: 0, gold_after: H.getGold(),
      stam_before: st0.stamina, stam_after: H.getPlayerStats().stamina,
      curve: curve.filter((x, i) => i < 6 || x.df === 30 || x.df === 31 || x.df === 78 || x.df === 79 || i > 114),
      events: H.combatTraceDrain().filter((e) => String(e.ev || e.type || '').indexOf('PARLEY') >= 0),
      combat_after: H.getCombatState(),
    };
    H.combatTraceStop();
    // (c) IS IT PUNISHABLE? Script the guard to swing while the parley is running.
    fight({ gold: 400 });
    H.queueEnemyScript('g1', [{ f: 4, move: 'chop' }]);
    const pf = H.getFrame() + 2;
    H.combatTraceStart({});
    H.queueInputs([{ f: pf, press: ['interact'] }, { f: pf + 1, release: ['interact'] }]);
    const hp0 = H.getPlayerStats().hp;
    H.stepFrames(300);
    out.c_punish = {
      hp_before: hp0, hp_after: H.getPlayerStats().hp,
      events: H.combatTraceDrain().filter((e) => ['HIT', 'STAGGER', 'PARLEY_ACCEPT', 'PARLEY_REFUSE', 'ACTION_START'].indexOf(String(e.ev || e.type)) >= 0),
      combat_after: H.getCombatState(),
    };
    H.combatTraceStop();
    // (d) the grounds: which one fired, and what the gate actually was
    out.d_guard_parley_data = (H.getCapabilityReport && null) || null;
    return out;
  });
  rec('B16-parley', parley);

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
