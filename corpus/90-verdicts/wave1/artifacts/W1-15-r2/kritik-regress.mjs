#!/usr/bin/env node
// kritik-regress.mjs — the round-1 passes re-measured, and the parley grounds under gating.
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('kritik-regress.mjs\n');
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'regress', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };

try {
  await h.h('setRenderRate', 0);

  // ==== BLOCK 23 — the ward-collar, live, with the RNG counter watched ====================
  const lock = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    const draws = () => { const s = H.snapshot(); return s.rng ? s.rng.draws : (s.determinism ? s.determinism.rng_draws : null); };
    out.draws_field_probe = H.snapshot().rng || null;
    H.setStealthState({ security: 60, agility: 60, picks: 12 });
    const d0 = draws();
    const st = H.lockBegin('archon.priest0.r0.lock');       // tier 3
    out.begin = st;
    const presses = [];
    for (let i = 0; i < 400; i++) {
      const b = H.lockState();
      if (!b || b.open || b.failed) break;
      // press when the collar is inside tolerance — the deterministic execution challenge
      const inside = Math.abs(b.error_deg === undefined ? 999 : b.error_deg) <= (b.tolerance_deg || 0);
      if (inside) { presses.push({ f: H.getFrame(), block: b, res: H.lockPress() }); }
      H.stepFrames(1);
    }
    out.presses = presses.slice(0, 6);
    out.press_count = presses.length;
    out.final = H.lockState();
    out.draws_before = d0; out.draws_after = draws();
    out.draws_delta = (d0 !== null && draws() !== null) ? draws() - d0 : null;
    // the starting character: can they open ANY lock in the world?
    H.setStealthState({ security: 5, agility: 20 });
    out.gate_at_start = [1, 2, 3, 4, 5].map((t) => ({ tier: t, ...H.lockGate(t) }));
    return out;
  });
  rec('B23-lock-live', lock);

  // ==== BLOCK 24 — the pickpocket die (seam S21) ===========================================
  const pp = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = { rows: [] };
    const draws = () => { const s = H.snapshot(); return s.rng ? s.rng.draws : null; };
    for (const sneak of [5, 50, 100]) {
      let caught = 0, drawsUsed = 0;
      for (let seed = 1; seed <= 60; seed++) {
        H.setSeed(seed); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
        H.setStealthState({ sneak, agility: 40, load: 'light' });
        const d0 = draws();
        let r;
        try { r = H.pickpocketBegin({ dist: 1.0, bearingDeg: 180, targetCivState: 'CALM', item_weight: 0.5 }); }
        catch (e) { out.error = String(e.message || e); break; }
        H.queueInputs([{ f: H.getFrame(), press: ['interact'] }]);
        H.stepFrames(200);
        const s = H.pickpocketState();
        drawsUsed += (draws() - d0);
        const ev = H.drainStealthEvents();
        if (ev.some((e) => e.type === 'pickpocket' && e.caught) || (r && r.caught)) caught++;
        void s;
      }
      out.rows.push({ sneak, caught_of_60: caught, rng_draws_total: drawsUsed });
    }
    return out;
  });
  rec('B24-pickpocket-die', pp);

  // ==== BLOCK 25 — the parley GROUNDS under real gating, and whether a guard can hit you ===
  const grounds = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    function setup(arch, opts) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.spawn(arch, 0, 2.5, { as: 'tg', yaw: 180 });
      H.aggro('tg');
      if (opts && opts.topic) H.learnTopic(opts.topic);
      if (opts && opts.knowledge) H.setWorldKnowledge(opts.knowledge);
      H.stepFrames(10);
    }
    function press() {
      const pf = H.getFrame() + 2;
      H.queueInputs([{ f: pf, press: ['interact'] }, { f: pf + 1, release: ['interact'] }]);
      H.stepFrames(160);
      return H.getCombatState().enemies[0];
    }
    // (a) inf_trash, no preparation at all -> every ground must fail
    setup('inf_trash');
    out.a_cold = { yielded: press().yielded };
    // (b) inf_trash after learning the true name -> NAME must pass
    setup('inf_trash', { topic: 'the-drowned-ford' });
    out.b_named = { yielded: press().yielded, world: H.getCombatState().world_knowledge };
    // (c) guard_legion, nothing done at all
    setup('guard_legion');
    out.c_guard_cold = { yielded: press().yielded, world: H.getCombatState().world_knowledge };
    // (d) can an AGGRO guard_legion ever hit you? 900 frames of standing still at 2.0 m
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.spawn('guard_legion', 0, 2.0, { as: 'gg', yaw: 180 });
    H.aggro('gg');
    H.combatTraceStart({});
    const hp0 = H.getPlayerStats().hp;
    H.stepFrames(900);
    const ev = H.combatTraceDrain();
    out.d_guard_can_attack = {
      hp_before: hp0, hp_after: H.getPlayerStats().hp,
      enemy_states: [...new Set(ev.filter((e) => e.who === 'gg' || e.src === 'gg').map((e) => String(e.ev || e.type)))],
      state_now: H.getCombatState().enemies[0].state,
      any_hit: ev.some((e) => String(e.ev || e.type) === 'HIT'),
      ev_kinds: [...new Set(ev.map((e) => String(e.ev || e.type)))],
    };
    H.combatTraceStop();
    // (e) punishability with an archetype that CAN swing: inf_trash is ai='scripted'
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 1.6, { as: 'ip', yaw: 180 });
    H.aggro('ip');
    H.learnTopic('the-drowned-ford');
    const base = H.getFrame();
    H.queueEnemyScript('ip', [{ f: 2, move: 'chop' }]);
    H.combatTraceStart({});
    H.queueInputs([{ f: base + 40, press: ['interact'] }, { f: base + 41, release: ['interact'] }]);
    const hpA = H.getPlayerStats().hp;
    H.stepFrames(400);
    const ev2 = H.combatTraceDrain();
    out.e_punish_scripted = {
      hp_before: hpA, hp_after: H.getPlayerStats().hp,
      events: ev2.filter((e) => ['HIT', 'STAGGER', 'ACTION_START', 'PARLEY_ACCEPT', 'PARLEY_REFUSE', 'INPUT_DROPPED'].indexOf(String(e.ev || e.type)) >= 0)
        .map((e) => ({ f: e.f, ev: String(e.ev || e.type), mv: e.mv, dmg: e.dmg, ground: e.ground, reason: e.reason })),
      enemy: H.getCombatState().enemies[0].state,
      yielded: H.getCombatState().enemies[0].yielded,
    };
    H.combatTraceStop();
    return out;
  });
  rec('B25-parley-grounds', grounds);

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
