#!/usr/bin/env node
// critic-w1-14-r4-carried.mjs — THE MIRROR, THE DRAG, AND THE SEVEN THINGS ROUND 4 DID NOT FIX.
//
// Six independent arms, each of which is a claim in the W1-14 round-4 status file or a gap the
// round-3 verdict carried forward and round 4 declared open. A critic must grade them, and a
// gap graded from prose is a gap graded from a status file (RULES.md §"Numbers you must not
// read off a status file").
//
//  A. THE DRAG. The round says the pre-fix magic gravity "pulled every body in the world toward
//     y = 0 on every frame". If so, `H.__breakGroundPlane` should be visible as MOTION, not just
//     as a refusal: a body standing perfectly still in Lilmoth should sink 2.68 m.
//  B. THE PURSE. `makeSpell` did `this.gold -= q.gold` against a MIRROR. The fix routes the
//     spend through `Engine._setGold`. Measured against `getGold()`, `saveState()` and a SAVE
//     ROUND TRIP — rule 7 says audit the running world after a load, and `save/state.js` writes
//     `sim.progression.gold` directly rather than through `_setGold`.
//  C. DURATION, round 3 §8's acceptance verbatim: `fire_damage` at D in {0, 5, 30} s against one
//     stationary body, hp sampled every 20 f@60 for 600 f@60. The acceptance is a staircase.
//  D. A MOVING BODY (rule 8). Round 3's blocking gap: a bolt does not connect with a body that
//     moves. Measured against a body that is walking, with a stationary control.
//  E. `engine.spawn` DROPS `opts.side` — does a summon carry a side, a team or a faction?
//  F. AN OVER-RESERVOIR CAST is a silent drop, and `frenzy` writes a target nothing reads.
//
// USAGE  node tools/harness/critic-w1-14-r4-carried.mjs [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-carried.mjs — the mirror, the drag, and the carried gaps.

  --out <dir>   report directory (default reports/critic-w1-14-r4)

This tool REPORTS. It exits non-zero only when an arm could not be measured at all, because
most of what it measures is known-open and the verdict grades it rather than gating on it.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);

const setupCaster = (H) => {
  for (let i = 0; i < 700; i++) {
    for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
    H.hearthRest();
  }
  H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
};

const RUN = (page) => page.evaluate(async () => {
  const H = window.__HARNESS;
  await H.ready();
  const out = {};
  const setupCaster = () => {
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  };

  // ---- A. THE DRAG -------------------------------------------------------------------------
  {
    const trace = (broken) => {
      H.setSeed(5); H.loadState('town-lilmoth'); H.stepFrames(4); H.loadState('town-lilmoth');
      H.setRenderRate(0);
      if (H.__breakGroundPlane) H.__breakGroundPlane(!!broken);
      H.stepFrames(2);
      const ys = [];
      for (let i = 0; i < 12; i++) { ys.push(H.getMagicState().pos_y_m); H.stepFrames(10); }
      ys.push(H.getMagicState().pos_y_m);
      if (H.__breakGroundPlane) H.__breakGroundPlane(false);
      return ys;
    };
    out.drag = { fixed_y: trace(false), broken_y: trace(true), sampled_every_f: 10 };
  }

  // ---- B. THE PURSE, and the mirror across a save round trip --------------------------------
  {
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0);
    setupCaster();
    H.setGold(500000);
    const before = { getGold: H.getGold(), magic_gold: H.getMagicState().gold === undefined ? null : H.getMagicState().gold };
    // A commission through the model (this arm is about the PURSE, not about the door — the
    // door has its own probe that never touches the model).
    const spec = { class: 'LIGHT', range: 'target', effects: [{ effect: 'damage_health', magnitude: 40, duration_s: 0, area_r_m: 0 }] };
    const q = H.quoteSpell(spec);
    const mk = H.makeSpell(spec, 'critic purse');
    const after = { getGold: H.getGold(), quote: q.gold };
    const save = H.saveState();
    // THE ROUND TRIP. `save/state.js` writes `sim.progression.gold` directly, not through
    // `_setGold`, so every mirror it feeds is stale until something else writes the purse.
    H.setGold(1);
    const midMagic = H.getPriceQuote ? null : null;
    H.restoreState(save);
    const restored = { getGold: H.getGold() };
    // What do the OTHER purses read after the load? Asked through the surfaces that exist.
    const q2 = H.quoteSpell(spec);
    const mk2 = H.makeSpell(spec, 'critic purse 2');
    restored.second_commission_refused = !!mk2.refused;
    restored.second_commission_gate = mk2.refused ? mk2.gate : null;
    restored.second_commission_reason = mk2.refused ? mk2.reason : null;
    restored.gold_after_second = H.getGold();
    out.purse = {
      before, quote_gold: q.gold, refused: !!mk.refused, after,
      spent: before.getGold - after.getGold,
      spend_equals_quote: before.getGold - after.getGold === q.gold,
      save_gold: save.progression ? save.progression.gold : null,
      after_restore: restored,
    };
  }

  // ---- C. DURATION — round 3 §8's acceptance, verbatim --------------------------------------
  {
    const rows = [];
    for (const D of [0, 5, 30]) {
      H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      setupCaster();
      const spec = { class: 'LIGHT', range: 'target', effects: [{ effect: 'fire_damage', magnitude: 20, duration_s: D, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, `critic dur ${D}`);
      if (mk.refused) { rows.push({ D, refused: mk.reason || mk.gate }); continue; }
      H.setAttuned([mk.spell.id]);
      const sp = H.spawn('drowned_lesser', 0, 6.0);
      const eid = sp && sp.eid ? sp.eid : sp;
      H.stepFrames(2);
      const hp = [];
      const read = () => (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
      hp.push(read());
      H.magicEventsDrain();
      H.pressCast(20);
      for (let i = 0; i < 29; i++) { H.stepFrames(20); hp.push(read()); }
      const evs = H.magicEventsDrain();
      rows.push({
        D, hp_curve: hp,
        total: hp[0] !== undefined && hp[hp.length - 1] !== undefined ? Math.round((hp[0] - hp[hp.length - 1]) * 100) / 100 : null,
        steps: hp.filter((v, i) => i > 0 && v < hp[i - 1]).length,
        applications: evs.filter((e) => e.kind === 'spell_hit').length,
      });
      try { H.despawn(eid); } catch (e) { /* gone */ }
    }
    out.duration = rows;
  }

  // ---- D. A MOVING BODY (rule 8) -------------------------------------------------------------
  {
    const arm = (moving) => {
      H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      setupCaster();
      const results = {};
      for (const eff of ['damage_health', 'fire_damage', 'frost_damage', 'shock_damage', 'poison_damage']) {
        const spec = { class: 'LIGHT', range: 'projectile', effects: [{ effect: eff, magnitude: 20, duration_s: 0, area_r_m: 0 }] };
        const mk = H.makeSpell(spec, `critic mv ${eff}`);
        if (mk.refused) { results[eff] = { refused: mk.reason || mk.gate }; continue; }
        H.setAttuned([mk.spell.id]);
        const sp = H.spawn('drowned_lesser', 0, 10.0);
        const eid = sp && sp.eid ? sp.eid : sp;
        H.stepFrames(2);
        if (moving) H.aggro(eid);           // an aggroed body walks at the caster: it MOVES
        const before = (H.getCombatState().enemies.find((e) => e.id === eid) || {});
        const p0 = before.pos ? before.pos.slice() : null;
        const hp0 = before.hp;
        H.magicEventsDrain();
        H.pressCast(200);
        const evs = H.magicEventsDrain();
        const after = (H.getCombatState().enemies.find((e) => e.id === eid) || {});
        results[eff] = {
          hp_before: hp0, hp_after: after.hp,
          damage: hp0 !== undefined && after.hp !== undefined ? Math.round((hp0 - after.hp) * 100) / 100 : null,
          moved_m: p0 && after.pos ? Math.round(Math.hypot(after.pos[0] - p0[0], after.pos[2] - p0[2]) * 100) / 100 : null,
          hits: evs.filter((e) => e.kind === 'spell_hit').length,
        };
        try { H.despawn(eid); } catch (e) { /* gone */ }
      }
      return results;
    };
    out.moving_target = { stationary: arm(false), moving: arm(true) };
  }

  // ---- E. `engine.spawn` and `opts.side` -----------------------------------------------------
  {
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    setupCaster();
    const spec = { class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_lesser', magnitude: 40, duration_s: 60, area_r_m: 0 }] };
    const mk = H.makeSpell(spec, 'critic side');
    H.setAttuned([mk.spell.id]);
    const before = new Set(H.getCombatState().enemies.map((e) => e.id));
    H.pressCast(90);
    const born = H.getCombatState().enemies.filter((e) => !before.has(e.id));
    const s = born[0] || null;
    const ent = s ? (H.listEntities() || []).find((e) => e.eid === s.id || e.id === s.id) : null;
    out.summon_side = {
      spawned: !!s, body_row: s || null, entity_row: ent || null,
      body_keys: s ? Object.keys(s) : [],
      entity_keys: ent ? Object.keys(ent) : [],
      declares_side: !!(ent && (ent.side || ent.team || ent.faction || ent.summoned)),
      kind: ent ? ent.kind : null,
      summon_register: H.getMagicWorld().summons || null,
    };
  }

  // ---- F. AN OVER-RESERVOIR CAST, and `frenzy` ------------------------------------------------
  {
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    setupCaster();
    const spec = { class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 60, area_r_m: 0 }] };
    const q = H.quoteSpell(spec);
    const mk = H.makeSpell(spec, 'critic over');
    let over = { quote: q, refused: !!mk.refused };
    if (!mk.refused) {
      H.setAttuned([mk.spell.id]); H.hearthRest(); H.setAttuned([mk.spell.id]);
      const m0 = H.getMagicState();
      H.magicEventsDrain();
      const pc = H.pressCast(120);
      const evs = H.magicEventsDrain();
      over = {
        ...over,
        focus_max: m0.focus_max, focus: m0.focus, focus_cost: q.focus_cost,
        over_reservoir: q.over_reservoir, quote_says_refused: !!q.refused,
        events: evs.map((e) => e.kind), drops: pc.drops,
        focus_after: H.getMagicState().focus,
      };
    }
    out.over_reservoir = over;

    // frenzy: two bodies 0.7 m apart, 1200 f@60, does either lose a hit point?
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    setupCaster();
    const fspec = { class: 'LIGHT', range: 'target', effects: [{ effect: 'frenzy', magnitude: 60, duration_s: 30, area_r_m: 0 }] };
    const fmk = H.makeSpell(fspec, 'critic frenzy');
    if (!fmk.refused) {
      H.setAttuned([fmk.spell.id]);
      const a = H.spawn('drowned_lesser', -0.35, 6.0); const aid = a && a.eid ? a.eid : a;
      const b = H.spawn('drowned_lesser', 0.35, 6.0); const bid = b && b.eid ? b.eid : b;
      H.stepFrames(2);
      const hp0 = [aid, bid].map((i) => (H.getCombatState().enemies.find((e) => e.id === i) || {}).hp);
      H.pressCast(60);
      H.stepFrames(1200);
      const hp1 = [aid, bid].map((i) => (H.getCombatState().enemies.find((e) => e.id === i) || {}).hp);
      out.frenzy = { hp_before: hp0, hp_after: hp1, status: H.getStatus ? H.getStatus().slice(0, 4) : null };
    } else out.frenzy = { refused: fmk.reason || fmk.gate };
  }

  // ---- G. Stormhold, on a clean page, with enough settle -------------------------------------
  {
    H.setSeed(5); H.loadState('town-stormhold'); H.stepFrames(4); H.loadState('town-stormhold');
    H.setRenderRate(0); H.setCatalyst('great_staff'); H.setWillpower(99); H.hearthRest();
    H.learnSpell('spark_dart'); H.setAttuned(['spark_dart']);
    H.stepFrames(120);
    const m = H.getMagicState();
    H.magicEventsDrain();
    const pc = H.pressCast(90);
    const evs = H.magicEventsDrain();
    out.stormhold = { y: m.pos_y_m, airborne: m.airborne, events: evs.map((e) => e.kind), drops: pc.drops };
  }
  return out;
});

const handle = await launchGame(args);
let res;
try { res = await RUN(handle.page); } finally { await handle.close(); }

const report = { schema: 'elder-souls/critic-w1-14-r4-carried@1', commit: gitInfo().commit, ...res };
writeJson(path.join(outDir, 'carried-gaps.json'), report);
log(`A DRAG    fixed y ${JSON.stringify(res.drag.fixed_y)}`);
log(`A DRAG    broken y ${JSON.stringify(res.drag.broken_y)}`);
log(`B PURSE   getGold ${res.purse.before.getGold} -> ${res.purse.after.getGold} against a quote of ${res.purse.quote_gold} (equal: ${res.purse.spend_equals_quote}); save carries ${res.purse.save_gold}; after restore ${JSON.stringify(res.purse.after_restore)}`);
for (const r of res.duration) log(`C DURATION D=${String(r.D).padStart(2)} s -> total ${r.total}, ${r.steps} downward steps, ${r.applications} applications`);
for (const k of Object.keys(res.moving_target.stationary)) {
  const s = res.moving_target.stationary[k], m = res.moving_target.moving[k];
  log(`D MOVING  ${k.padEnd(15)} stationary dmg ${s.damage} (moved ${s.moved_m} m) | moving dmg ${m.damage} (moved ${m.moved_m} m)`);
}
log(`E SIDE    summon entity kind=${res.summon_side.kind}, declares side/team/faction/summoned: ${res.summon_side.declares_side}; entity keys ${JSON.stringify(res.summon_side.entity_keys)}`);
log(`F OVER    focus_max ${res.over_reservoir.focus_max}, cost ${res.over_reservoir.focus_cost}, quote refused=${res.over_reservoir.quote_says_refused}, events ${JSON.stringify(res.over_reservoir.events)}, drops ${JSON.stringify(res.over_reservoir.drops)}`);
log(`F FRENZY  hp ${JSON.stringify(res.frenzy.hp_before)} -> ${JSON.stringify(res.frenzy.hp_after)}`);
log(`G STORM   y=${res.stormhold.y} airborne=${res.stormhold.airborne} events=${JSON.stringify(res.stormhold.events)} drops=${JSON.stringify(res.stormhold.drops)}`);
log(`report: ${path.join(outDir, 'carried-gaps.json')}`);
process.exit(0);
