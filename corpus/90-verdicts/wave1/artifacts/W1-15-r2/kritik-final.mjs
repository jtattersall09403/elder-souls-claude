#!/usr/bin/env node
// kritik-final.mjs — S-1's plausible set, the guard ladder vs the parley, the round-1 passes,
// and the live quest verb census.
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('kritik-final.mjs\n');
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'final', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };

try {
  await h.h('setRenderRate', 0);

  // ==== BLOCK 17 — S-1's PLAUSIBLE SET. Is `plan` ever non-empty? =========================
  const s1 = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = { runs: [] };
    // (a) the ordinary case: the searcher saw the player in its PRIMARY cone, so it is looking
    //     straight at the LKP when the search begins.
    // (b) the peripheral case: the searcher's forward is 57 deg off the LKP.
    // (c) a case with the volumes deliberately placed BETWEEN searcher and LKP.
    for (const c of [
      { id: 'primary-cone', yaw: 180, vols: [[5, -3], [-6, -2], [0, -7]] },
      { id: 'primary-cone-far-side', yaw: 180, vols: [[7, 2], [-7, 2], [0, 6]] },
      { id: 'peripheral-cone', yaw: 123, vols: [[5, -3], [-6, -2], [0, -7]] },
      { id: 'volumes-beside-the-searcher', yaw: 180, vols: [[6, 6], [-6, 6], [3, 7]] },
    ]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.setTimeOfDay(12);
      H.setStealthState({ sneak: 5, load: 'heavy', surface: 'mud', zone: 'z' + c.id });
      H.setZoneAmbient('z' + c.id, 1.0);
      H.setPlayerMotion('still');
      for (let i = 0; i < c.vols.length; i++) H.addCoverVolume({ id: 'v' + i, pos: [c.vols[i][0], 0, c.vols[i][1]], zone: 'z' + c.id });
      H.spawn('inf_trash', 0, 8, { as: 'e' + c.id, yaw: c.yaw });
      H.stepFrames(600);
      const seen = H.perceptionState().find((x) => x.eid === 'e' + c.id);
      H.teleport(0, -80);
      let plan = null, visited = null, lkp = null;
      for (let i = 0; i < 1800; i++) {
        H.stepFrames(1);
        const ss = H.getSearchState();
        if (ss.length) { plan = ss[0].plan; visited = ss[0].visited; lkp = ss[0].lkp; break; }
      }
      const ev = H.drainStealthEvents().filter((e) => e.type === 'search_start');
      out.runs.push({
        case: c.id, yaw: c.yaw, volumes: c.vols, alert_when_seen: seen ? seen.alert : null,
        alert_state_when_seen: seen ? seen.alert_state : null,
        cover_volumes_declared: H.listCoverVolumes().length,
        lkp, plan, visited, search_start_events: ev,
      });
    }
    return out;
  });
  rec('B17-S1-plausible-set', {
    item: "RI-STL01 §7 S-1: 'walks to LKP, then visits up to 3 nav-mesh cover volumes within 8 m of LKP ... it checks WHERE YOU COULD HAVE GONE, not random points'",
    ...s1,
  });

  // ==== BLOCK 18 — THE GUARD LADDER vs THE PARLEY ==========================================
  const guard = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    out.bands = [0, 100, 500, 2000].map((b) => ({ bounty: b, band: H.getGuardBand({ bounty: b }) }));
    // A real band-3 guard: high bounty, guard entity present, and a combat body of the same eid.
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setTimeOfDay(12);
    H.setStealthState({ sneak: 5, load: 'medium', zone: 'zg', race: 'imperial' });
    H.setZoneAmbient('zg', 1.0);
    H.setPlayerMotion('still');
    H.setBounty('imperial', 3000);
    H.spawnGuard({ eid: 'g1', pos: [0, 0, 3], yaw: 180 });
    H.spawn('guard_legion', 0, 3, { as: 'g1x', yaw: 180 });
    H.stepFrames(120);
    out.guard_civ = H.listCivilians();
    out.guard_entity = H.perceptionState();
    out.arrest_topics = H.arrestTopics({});
    out.bounty_before = H.getCrimeState().bounty.imperial;
    out.standings_before = H.getCrimeState().standings;
    // now parley the combat body
    H.combatTraceStart({});
    const pf = H.getFrame() + 2;
    H.queueInputs([{ f: pf, press: ['interact'] }, { f: pf + 1, release: ['interact'] }]);
    H.stepFrames(200);
    out.parley_events = H.combatTraceDrain().filter((e) => String(e.ev || e.type).indexOf('PARLEY') >= 0);
    H.combatTraceStop();
    out.combat_after = H.getCombatState().enemies;
    out.bounty_after = H.getCrimeState().bounty.imperial;
    out.standings_after = H.getCrimeState().standings;
    out.guard_civ_after = H.listCivilians();
    out.jail_after = H.getCrimeState().jail;
    return out;
  });
  rec('B18-guard-ladder-vs-parley', guard);

  // ==== BLOCK 19 — parley punishability, properly timed ====================================
  const punish = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    // guard_legion chop: startup 68, active 10. Script it at f=0 and press interact at f=60,
    // so the active window (68..77) lands 8..17 frames into a parley that resolves at 31.
    for (const delay of [60, 20]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.spawn('guard_legion', 0, 2.0, { as: 'gp', yaw: 180 });
      H.aggro('gp');
      H.queueEnemyScript('gp', [{ f: 2, move: 'chop' }]);
      const base = H.getFrame();
      H.combatTraceStart({});
      H.queueInputs([{ f: base + delay, press: ['interact'] }, { f: base + delay + 1, release: ['interact'] }]);
      const hp0 = H.getPlayerStats().hp;
      H.stepFrames(400);
      out['press_at_f' + delay] = {
        hp_before: hp0, hp_after: H.getPlayerStats().hp,
        events: H.combatTraceDrain().filter((e) => ['HIT', 'STAGGER', 'PARLEY_ACCEPT', 'PARLEY_REFUSE', 'ACTION_START', 'INPUT_DROPPED', 'WHIFF'].indexOf(String(e.ev || e.type)) >= 0)
          .map((e) => ({ f: e.f, ev: e.ev || e.type, mv: e.mv, dmg: e.dmg, who: e.who, reason: e.reason, ground: e.ground })),
        enemy: H.getCombatState().enemies[0],
      };
      H.combatTraceStop();
    }
    return out;
  });
  rec('B19-parley-punishability', punish);

  // ==== BLOCK 20 — the round-1 PASSES. Regression check. ===================================
  const reg = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    // locks: the tier census across the whole property tree
    const zones = H.listPropertyZones();
    const tiers = {};
    let locks = 0;
    for (const z of zones) {
      const objs = H.listOwnedObjects(z.id);
      void objs;
    }
    out.zones = zones.length;
    out.locks_declared = zones.reduce((a, z) => a + (z.locks || 0), 0);
    // the gate and the tolerance table
    out.gates = [1, 2, 3, 4, 5].map((t) => {
      H.setStealthState({ security: 5, agility: 20 });
      const lo = H.lockGate(t);
      H.setStealthState({ security: 100, agility: 100 });
      const hi = H.lockGate(t);
      return { tier: t, at_security_5: lo, at_security_100: hi, tol_5: H.lockTolerance(t, 5), tol_100: H.lockTolerance(t, 100) };
    });
    // a live lock interaction: RNG draws must not move (S21 — the die was deleted here)
    const det0 = H.getDeterminismReport();
    H.setStealthState({ security: 60, agility: 50, picks: 12 });
    // find a lock we are allowed to open
    let lockId = null, lockTier = null;
    const prop = H.listPropertyZones();
    for (const z of prop) {
      const s = H.listOwnedObjects(z.id);
      void s;
    }
    out.determinism_before = { draws: det0.draws === undefined ? det0.rng_draws : det0.draws, raw: det0 };
    return { ...out, lockId, lockTier };
  });
  rec('B20-locks-static', reg);

  // ==== BLOCK 21 — the live quest verb census ==============================================
  const q = await h.h('questVerbCensus');
  rec('B21-quest-verb-census', q);

  // ==== BLOCK 22 — capability report / declared gaps ========================================
  rec('B22-capability', await h.h('getCapabilityReport'));

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
