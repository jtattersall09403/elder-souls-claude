#!/usr/bin/env node
// critic-w1-16-r3-live.mjs — W1-16 ROUND-3 CRITIC's stepping instrument. ONE browser, kept open.
//
//   K1  controls   EVERY delete-the-fix arm, across a scenario boundary. Round 3 found its own
//                  `oversprint` control inert because the flag rode on `combat.d`, which
//                  `_combatData()` rebuilds. This sets each of the seven arms, CROSSES A SCENARIO
//                  BOUNDARY, and reads the flag back at the carrier the off-branch actually reads
//                  — plus a behavioural both-orders arm for `sprint` and `travel`, the two round-2
//                  arms round 3 never re-ran.
//   K2  antimerge  RI-PRG07 method 3 re-taken independently, AND its converse, AND the third
//                  question neither round asked: §3 says burden counts "ALL carried items,
//                  EQUIPPED OR NOT", and the hands are not inventory rows.
//   K3  overloaded OVERLOADED reached WITHOUT A PIN — dress into MEDIUM on shipped weights, then
//                  cast the shipped Burden. The sprint denial is then re-measured at a tier the
//                  world put the player in rather than at one `setEquipLoad()` asserted.
//   K4  clamp      sim/magic/apply.js clamps at zero on BOTH apply and undo. Round 3 found it and
//                  did not fix it; this measures the consequence in the running game.
//   K5  pin        L4's pin ladder RE-TAKEN WITH A HOSTILE ON THE FLOOR. The round-2 ladder
//                  despawned everything first, because `save/fight.js` SKIP omitted `ai` and the
//                  next step threw. W1-SAVE-AI fixed that; the emptied-world result is therefore
//                  a measurement of a workaround and is re-taken here.
//   K6  bow        `hist-sap-bow` declares moveset `bow`, which resolves to nothing. The equip is
//                  refused with a reason. What does a PLAYER see?
//
// Units: every frame figure is f@60 (our fixed 60 Hz step; ARBITRATION S22, f@60 = 2 x t@30).
// Metres are metres of capsule travel over a DECLARED f@60 count. Both are load-independent.
//
//   node tools/harness/critic-w1-16-r3-live.mjs [--probe a,b,...] [--out path]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
critic-w1-16-r3-live.mjs — W1-16 round-3 critic's stepping probes.
  --probe <names|all>   controls antimerge overloaded clamp pin pinfight bow
  --out <path>          default reports/w1-16/critic-r3-live.json
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ALL = ['controls', 'antimerge', 'overloaded', 'clamp', 'pin', 'pinfight', 'bow'];
const run = String(args.probe || 'all') === 'all' ? ALL : String(args.probe).split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'setEquipLoad', 'setBurden', 'getBurden', 'spawnProp', 'takeProp', 'getInventory', 'equipItem',
  'getPlayerStats', 'setLoadout', '__breakW116', 'saveRoundTrip', 'castNow']);

const WEARABLES = ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash'];

const PROBES = {

  // =========================================================================================
  // K1 — EVERY CONTROL, ACROSS A SCENARIO BOUNDARY.
  //
  // The trap round 3 hit: `__breakW116` sets a flag, the probe then loads a scenario inside the
  // arm, `_buildCombat` constructs a fresh `combat.d`, and the flag is gone before it is read.
  // Byte-identical arms in both orders is what that looks like from the outside, and it looks
  // exactly like a clean negative. The decisive test is not behavioural: it is to set the arm,
  // cross the boundary, and READ THE CARRIER THE OFF-BRANCH READS.
  // =========================================================================================
  controls() {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const ARMS = ['producer', 'slots', 'travel', 'sprint', 'hands', 'onehand', 'oversprint'];
    const survival = ARMS.map((arm) => {
      H.__breakW116(null);
      H.setSeed(1337); H.loadState('default'); H.stepFrames(4);
      H.__breakW116(arm);
      const before = {
        engine_flag: !!(E._w116Break && E._w116Break[arm]),
        combat_d_flag: !!(E.combat && E.combat.d && E.combat.d.__w116_oversprint),
      };
      // THE BOUNDARY. This is the line that made round 3's control inert.
      H.loadState('default'); H.stepFrames(4);
      const after = {
        engine_flag: !!(E._w116Break && E._w116Break[arm]),
        combat_d_flag: !!(E.combat && E.combat.d && E.combat.d.__w116_oversprint),
      };
      // Which carrier does this arm's OFF-BRANCH actually read? `oversprint` alone reads
      // `combat.d`; every other arm reads `engine._w116Break` directly.
      const carrier = arm === 'oversprint' ? 'combat.d.__w116_oversprint' : 'engine._w116Break';
      const live = carrier === 'combat.d.__w116_oversprint' ? after.combat_d_flag : after.engine_flag;
      return { arm, carrier, before, after, still_in_force_after_a_scenario_load: live };
    });
    H.__breakW116(null);

    // ---- the behavioural half, for the two round-2 arms round 3 never re-ran ---------------
    // `sprint` — RI-PRG07 §3's Overladen denial, OUTSIDE a fight (the AR-1 guard makes it inert
    // inside one). Metres over 120 f@60 with the button HELD, against a button-up control.
    const walk = (frames, sprint) => {
      const p0 = H.getPlayerStats().pos.slice();
      const inputs = [{ f: 0, move: [0, 1] }];
      if (sprint) inputs.push({ f: 0, press: ['sprint'] });
      H.queueInputs(inputs);
      H.stepFrames(frames);
      const p1 = H.getPlayerStats().pos.slice();
      return +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3);
    };
    const sprintArm = (broken) => {
      H.__breakW116(broken);
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);   // boundary INSIDE the arm
      H.setBurden(0.95);                                          // OVERLADEN, out of fight
      H.stepFrames(4);
      const b = H.getBurden();
      const held = walk(120, true);
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8); H.setBurden(0.95); H.stepFrames(4);
      const up = walk(120, false);
      const out = { broken: broken || 'none', burden_tier: b.tier, sprint_allowed_reported: b.sprint,
        metres_held: held, metres_button_up: up, sprint_still_works: held > up * 1.05 };
      H.__breakW116(null);
      return out;
    };
    const sprintCut = sprintArm('sprint'); const sprintFix = sprintArm(null);
    const sprintFix2 = sprintArm(null); const sprintCut2 = sprintArm('sprint');

    // `travel` — RI-PRG07 §3's travel_time multiplier. Cut, the multiplier is computed and read
    // by nothing, so a laden ride takes the same frames as an empty one.
    const travelArm = (broken) => {
      const r = { broken: broken || 'none' };
      try {
        H.__breakW116(broken);
        H.setSeed(1337); H.loadState('default'); H.stepFrames(4);   // boundary INSIDE the arm
        H.setBurden(0.95); H.stepFrames(2);
        const net = H.getTravelNetwork ? H.getTravelNetwork() : null;
        const svcs = net ? (net.services || []) : [];
        r.services = svcs.length;
        r.service = svcs.length ? (svcs[0].id || null) : null;
        r.burden_travel_mult_reported = H.getBurden().travel_time_mult;
        // The arm's read site is `engine.boardTravel()`'s `bt.travel_time`. Quote a ride and
        // read the frames the world would charge for it.
        if (r.service) { try { r.quote = H.travelQuote(r.service); } catch (e) { r.quote_err = String(e && e.message || e); } }
      } catch (e) { r.err = String(e && e.message || e); }
      H.__breakW116(null);
      return r;
    };

    const oversprintRidesARebuiltObject = survival.find((s) => s.arm === 'oversprint');
    const anyEngineArmLost = survival.filter((s) => s.carrier === 'engine._w116Break' && !s.still_in_force_after_a_scenario_load);
    return {
      survival,
      arms_that_lost_their_flag_across_a_boundary: survival.filter((s) => !s.still_in_force_after_a_scenario_load).map((s) => s.arm),
      the_one_arm_on_a_rebuilt_carrier: oversprintRidesARebuiltObject,
      engine_carried_arms_all_survived: anyEngineArmLost.length === 0,
      sprint_arm: { order_cut_then_fix: { cut: sprintCut, fix: sprintFix }, order_fix_then_cut: { fix: sprintFix2, cut: sprintCut2 },
        arms_differ_in_both_orders: sprintCut.sprint_still_works === true && sprintFix.sprint_still_works === false
          && sprintFix2.sprint_still_works === false && sprintCut2.sprint_still_works === true },
      travel_arm: { cut: travelArm('travel'), fix: travelArm(null) },
      coupled: anyEngineArmLost.length === 0
        && oversprintRidesARebuiltObject.still_in_force_after_a_scenario_load === true,
    };
  },

  // =========================================================================================
  // K2 — THE ANTI-MERGE CHECK, its converse, and the term nobody weighed.
  // =========================================================================================
  antimerge() {
    const H = window.__HARNESS;
    const WEARABLES = ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash'];
    const cs = () => H.getCombatState();
    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      let runs = 0;
      for (let i = 0; i < iv.length; i++) if (i === 0 || iv[i] !== iv[i - 1] + 1) runs++;
      return { iframes_f60: iv.length, window_f60: iv.length ? [iv[0], iv[iv.length - 1]] : null,
        recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        total_f60: total, contiguous_runs: runs, tier: cs().player.tier };
    };
    const snap = (label) => {
      const b = H.getBurden();
      return Object.assign({ label,
        carried_kg: b.equip_load.carried_weight, equipped_kg: b.equip_load.equipped_weight,
        burden_ratio: b.ratio, burden_tier: b.tier,
        pct: b.equip_load.pct, source: b.equip_load.source,
        hands: b.equip_load.hands, weapon: b.equip_load.weapon_the_fight_swings,
        shield: b.equip_load.shield_the_fight_holds }, rollOnce());
    };
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    const p = cs().player.pos;
    const A = snap('A - empty pack, the scenario\'s own hands');

    for (let i = 0; i < 40; i++) {
      H.spawnProp({ eid: `k2-${i}`, name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [p[0], p[1], p[2]] });
      H.takeProp(`k2-${i}`);
    }
    H.stepFrames(8);
    const B = snap('B - 460 kg in the pack, worn by nothing');

    for (const it of WEARABLES) {
      const q = cs().player.pos;
      H.spawnProp({ eid: `k2w-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
      H.takeProp(`k2w-${it}`); H.equipItem(it); H.stepFrames(40);
    }
    H.stepFrames(6);
    const C = snap('C - the same pack, five pieces WORN');

    // ---- D. The hands, on a clean fixture. RI-PRG07 §3 counts "ALL carried items, EQUIPPED OR
    // NOT". The hands are not inventory rows, so they are in the equip ratio and in neither
    // burden term. This is the §3 half of the two-right-hands defect round 3 closed on §2.
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    const D0 = snap('D0 - default hands (garrison sword + marsh-oak medium)');
    let swapErr = null;
    try { H.setLoadout({ weapon: 'ultra-greatsword', shield: 'naga_tower' }); H.stepFrames(6); }
    catch (e) { swapErr = String(e && e.message || e); }
    const D1 = snap('D1 - ultra greatsword + Naga tower, nothing in the pack');

    return {
      arms: [A, B, C, D0, D1],
      swap_err: swapErr,
      // The check RI-PRG07 method 3 actually specifies.
      pack_moved_burden: A.burden_ratio !== B.burden_ratio,
      pack_left_the_roll_byte_identical: A.iframes_f60 === B.iframes_f60 && A.total_f60 === B.total_f60
        && A.recovery_f60 === B.recovery_f60 && A.tier === B.tier && A.pct === B.pct,
      // The converse the brief asks for, answered against the item rather than the brief.
      worn_weight_moved_the_roll: B.pct !== C.pct && B.iframes_f60 !== C.iframes_f60,
      worn_weight_also_moved_burden: B.burden_ratio !== C.burden_ratio,
      worn_weight_moving_burden_is_CORRECT_per_RI_PRG07_s3:
        'RI-PRG07 §3 reads "weight of ALL carried items, EQUIPPED OR NOT". Worn armour is a carried '
        + 'item, so it MUST move burden. The anti-merge requirement is the other direction only: '
        + 'the PACK must not move the roll. Two ratios, two divisors, one shared numerator term.',
      // The defect this arm exists to find.
      hands_moved_the_roll: D0.pct !== D1.pct,
      hands_moved_burden: D0.burden_ratio !== D1.burden_ratio,
      hands_kg_D1: D1.hands ? D1.hands.total : null,
      burden_carried_kg_D1: D1.carried_kg,
      the_hands_are_in_the_equip_ratio_and_in_NEITHER_burden_term:
        D0.pct !== D1.pct && D0.burden_ratio === D1.burden_ratio && D1.carried_kg === 0,
      coupled: (A.burden_ratio !== B.burden_ratio) && (A.pct === B.pct)
        && (A.iframes_f60 === B.iframes_f60) && (B.pct !== C.pct) && (B.iframes_f60 !== C.iframes_f60),
    };
  },

  // =========================================================================================
  // K3 — OVERLOADED WITHOUT A PIN.
  //
  // Round 3 measured the sprint denial at `setEquipLoad(120)`, which is a pin: the tier is
  // asserted, not entered. "A tier no player can enter is measured only through a pin." So:
  // dress into the heaviest legal state on SHIPPED weights, then cast the SHIPPED Burden, and
  // measure the denial at a tier the world put the player in.
  // =========================================================================================
  overloaded() {
    const H = window.__HARNESS;
    const WEARABLES = ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash'];
    const cs = () => H.getCombatState();
    const walk = (frames, sprint) => {
      const p0 = H.getPlayerStats().pos.slice();
      const s0 = cs().player.stamina;
      const inputs = [{ f: 0, move: [0, 1] }];
      if (sprint) inputs.push({ f: 0, press: ['sprint'] });
      H.queueInputs(inputs);
      H.stepFrames(frames);
      const p1 = H.getPlayerStats().pos.slice();
      return { metres_over_120_f60: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        stamina_spent: +(s0 - cs().player.stamina).toFixed(2), tier: cs().player.tier };
    };
    const dress = () => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.setLoadout({ weapon: 'ultra-greatsword', shield: 'naga_tower' });
      H.stepFrames(4);
      for (const it of WEARABLES) {
        const q = cs().player.pos;
        H.spawnProp({ eid: `k3-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
        H.takeProp(`k3-${it}`); H.equipItem(it); H.stepFrames(40);
      }
      H.stepFrames(6);
      const b = H.getBurden().equip_load;
      return { equipped_kg: b.equipped_weight, pct: b.pct, tier: b.tier, max_load_kg: b.equip_load_max,
        source: b.source, hands: b.hands };
    };
    const out = {};
    out.dressed_on_shipped_weights_alone = dress();
    out.sprint_dressed_only = { held: walk(120, true) };

    // Now the spell. Burden is `warding`, magnitude 40, 20 s. The schools in this build are
    // sorcery / root_speech / warding / veiling — the round-2 critic lost its budget to a NAME.
    out.spell = {};
    const dressed = dress();
    out.re_dressed = dressed;
    try {
      out.spell.willpower = H.setWillpower(80);
      out.spell.skills = H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      out.spell.learn = H.learnSpell('burden');
      out.spell.attune = H.setAttuned(['burden']);
      out.spell.cast = H.castNow('burden');
      H.stepFrames(6);
      const b = H.getBurden().equip_load;
      out.spell.pct_after_cast = b.pct; out.spell.tier_after_cast = b.tier;
      out.spell.offset = +(b.pct - dressed.pct).toFixed(6);
    } catch (e) { out.spell.err = String(e && e.message || e); }

    if (out.spell.tier_after_cast === 'OVERLOADED') {
      out.sprint_at_a_REAL_OVERLOADED = { held: walk(120, true) };
      // the button-up control, on the same dressed-and-cursed fixture
      const d2 = dress();
      try { H.castNow('burden'); H.stepFrames(6); } catch (e) { out.second_cast_err = String(e && e.message || e); }
      out.control_tier = H.getBurden().equip_load.tier;
      out.sprint_button_up_control = { up: walk(120, false) };
      out.re_dressed_2 = d2;
    }
    // The jump-attack half of RI-CMB01 §B, at the same real tier.
    try { out.roll_tier_now = cs().player.tier; } catch (e) { /* reported above */ }

    const held = out.sprint_at_a_REAL_OVERLOADED && out.sprint_at_a_REAL_OVERLOADED.held.metres_over_120_f60;
    const up = out.sprint_button_up_control && out.sprint_button_up_control.up.metres_over_120_f60;
    out.OVERLOADED_reached_without_a_pin = out.spell.tier_after_cast === 'OVERLOADED';
    out.the_denial_holds_at_a_tier_the_world_chose = held !== undefined && up !== undefined && held === up;
    out.coupled = !!out.OVERLOADED_reached_without_a_pin && out.the_denial_holds_at_a_tier_the_world_chose === true;
    return out;
  },

  // =========================================================================================
  // K4 — THE CLAMP. `sim/magic/apply.js loadHandler()`:
  //   apply: b.equipLoadPct = Math.max(0, b.equipLoadPct + delta)
  //   undo:  b.equipLoadPct = Math.max(0, b.equipLoadPct - delta)
  // Feather is magnitude 30 and the whole LIGHT band is 30 wide, so at any load under 30 the
  // apply clamps and loses the difference — and the undo adds the FULL 30 back. The character
  // ends heavier than they started, in a worse roll tier, from a spell whose entire purpose is
  // to make them lighter. Round 3 found it and did not fix it; this measures the consequence.
  // =========================================================================================
  clamp() {
    const H = window.__HARNESS;
    const out = { handler: 'sim/magic/apply.js loadHandler — Math.max(0, pct + delta) / Math.max(0, pct - delta)' };
    try {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      const b0 = H.getBurden().equip_load;
      out.pct_before_cast = b0.pct; out.tier_before_cast = b0.tier;
      H.setWillpower(80);
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.learnSpell('feather'); H.setAttuned(['feather']);
      out.cast = H.castNow('feather');
      H.stepFrames(6);
      const b1 = H.getBurden().equip_load;
      out.pct_after_cast = b1.pct; out.tier_after_cast = b1.tier;
      out.points_lost_to_the_clamp = +(Math.max(0, b1.pct) === 0 ? out.pct_before_cast : 0).toFixed(6);
      // Run the spell out. Feather is 30 s = 1800 f@60; step past it and read the world back.
      H.stepFrames(1900);
      const b2 = H.getBurden().equip_load;
      out.pct_after_expiry = b2.pct; out.tier_after_expiry = b2.tier;
      out.heavier_than_before_the_spell = b2.pct > out.pct_before_cast;
      out.delta_across_the_whole_spell = +(b2.pct - out.pct_before_cast).toFixed(6);
      out.roll_tier_got_worse = b2.tier !== out.tier_before_cast;
    } catch (e) { out.err = String(e && e.message || e); }
    out.coupled = out.heavier_than_before_the_spell === true;
    return out;
  },

  // =========================================================================================
  // K5 — THE PIN LADDER, WITH A HOSTILE ON THE FLOOR.
  //
  // The round-2 ladder despawned every entity before saving, because `save/fight.js` SKIP omitted
  // `ai` and the next fixed step threw `this.ai.step is not a function`. W1-SAVE-AI reports that
  // fixed. An emptied world is not the world the pin has to survive, so this re-takes it with the
  // hostile present and reports the AI's constructor after the round trip as the fixture check.
  // =========================================================================================
  async pin() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const dress = (state) => {
      H.setSeed(1337); H.loadState(state); H.stepFrames(8);
      for (const it of ['shell-scale-hauberk', 'legion-greaves']) {
        const q = cs().player.pos;
        H.spawnProp({ eid: `k5-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
        H.takeProp(`k5-${it}`); H.equipItem(it); H.stepFrames(40);
      }
      H.stepFrames(6);
      return H.getBurden().equip_load;
    };
    // RULES #7: not "is the number the same" — a pinned field re-serialises to what was saved and
    // passes forever. Take a piece OFF and see whether the producer still moves.
    const stillLive = () => {
      const was = H.getBurden().equip_load.pct;
      H.equipItem('shell-scale-hauberk');
      H.stepFrames(40);
      const now = H.getBurden().equip_load.pct;
      return { pct_before_undress: was, pct_after_undress: now, producer_still_running: was !== now };
    };
    const hostiles = () => {
      try { return (H.listEntities() || []).filter((e) => e.eid && e.eid !== 'P').map((e) => e.eid); }
      catch (e) { return null; }
    };
    const rows = [];
    const safe = async (fn, tag) => { try { return { v: await fn() }; } catch (e) { return { err: `${tag}: ${String(e && e.message || e)}` }; } };
    const path_ = async (state, label, doTheLoad) => {
      const dressed = await safe(() => dress(state), 'dress');
      if (dressed.err) { rows.push({ state, path: label, err: dressed.err }); return; }
      const before = hostiles();
      const loaded = await safe(doTheLoad, 'load');
      const stepped = await safe(() => H.stepFrames(4), 'step-after-load');
      const b = await safe(() => H.getBurden().equip_load, 'getBurden');
      const live = (stepped.err || b.err) ? null : await safe(stillLive, 'undress');
      rows.push({
        state, path: label,
        hostiles_before: before, hostiles_after: hostiles(),
        err: loaded.err || stepped.err || b.err || (live && live.err) || null,
        load_returned: loaded.v === undefined ? null : loaded.v,
        pct_before: dressed.v.pct, pct_after: b.v ? b.v.pct : null,
        source_after: b.v ? b.v.source : null,
        live: live && live.v ? live.v : null,
      });
    };
    // `arena_duel` is the state the round-2 ladder could not use: it has a hostile with a live AI.
    for (const state of ['arena_duel', 'default']) {
      await path_(state, 'loadState(<named state>)', () => null);
      await path_(state, 'saveRoundTrip()', () => { const r = H.saveRoundTrip(); return { hash_equal: r.equal }; });
      await path_(state, 'writeSave() -> readSave()', async () => { await H.writeSave('critic-w116-r3'); return await H.readSave('critic-w116-r3'); });
      await path_(state, 'exportSave() -> importSave()', async () => { const blob = await H.exportSave(); return await H.importSave(blob); });
    }
    const withHostile = rows.filter((r) => r.state === 'arena_duel');
    return {
      rows,
      paths_measured_with_a_hostile_on_the_floor: withHostile.length,
      any_threw_with_a_hostile_present: withHostile.filter((r) => r.err).map((r) => ({ path: r.path, err: r.err })),
      nothing_reads_as_pinned_after_any_load: rows.every((r) => r.err || !/pinned/.test(r.source_after || '')),
      producer_still_running_on_every_path: rows.every((r) => r.err || (r.live && r.live.producer_still_running)),
      coupled: rows.filter((r) => !r.err).length > 0
        && rows.every((r) => r.err || ((r.live && r.live.producer_still_running) && !/pinned/.test(r.source_after || ''))),
    };
  },

  // =========================================================================================
  // K7 — WHAT A SAVE AND A RELOAD DO TO A PINNED FIGHT.
  //
  // Round 3's whole safety argument is: "24 of the 49 named states DECLARE `loadout.equip_load_pct`
  // ... so every TTK, hitstop and exemplar number W1-09/10/11 measured is untouched, byte for
  // byte." That is true at load. `_restoreFightFromSave` CLEARS the pin — the round-2 critic
  // verified the clear and scored it 8/10 as a good thing — so after a save and a reload the
  // producer engages and answers a DIFFERENT number in a PINNED calibration state.
  //
  // Before round 3 the derived answer was the clothing sum alone and stayed inside LIGHT, so the
  // clear was invisible. The `hands` arm is run as the counterfactual: it is round 3's own
  // delete-the-fix switch, and with it cut the same save and the same reload do not cross a cliff.
  // =========================================================================================
  pinfight() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      return { iframes_f60: iv.length, recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        total_f60: total, tier: cs().player.tier };
    };
    const read = () => {
      const b = H.getBurden().equip_load;
      return { pct: b.pct, tier: b.tier, source: b.source, equipped_kg: b.equipped_weight,
        hands_kg: b.hands ? b.hands.total : null, cap_kg: b.equip_load_max };
    };
    const arm = (state, dress, broken) => {
      H.__breakW116(broken);
      H.setSeed(1337); H.loadState(state); H.stepFrames(8);
      for (const it of dress) {
        const q = cs().player.pos;
        H.spawnProp({ eid: `k7-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
        H.takeProp(`k7-${it}`); H.equipItem(it); H.stepFrames(40);
      }
      H.stepFrames(6);
      const before = Object.assign(read(), rollOnce());
      const rt = H.saveRoundTrip();
      H.stepFrames(6);
      const after = Object.assign(read(), rollOnce());
      H.__breakW116(null);
      return { state, dressed_with: dress, broken: broken || 'none', hash_equal: rt.equal,
        before, after,
        equip_load_moved_across_the_save: before.pct !== after.pct,
        ROLL_TIER_CHANGED_ACROSS_THE_SAVE: before.tier !== after.tier,
        iframes_lost: before.iframes_f60 - after.iframes_f60 };
    };
    const rows = [
      arm('arena_duel', [], null),
      arm('arena_duel', ['shell-scale-hauberk', 'legion-greaves'], null),
      // THE COUNTERFACTUAL. Round 3's own `hands` switch, cut: the pin still clears, but the
      // derived answer is the pre-round-3 clothing sum and stays inside LIGHT.
      arm('arena_duel', ['shell-scale-hauberk', 'legion-greaves'], 'hands'),
      arm('arena_flat', ['shell-scale-hauberk', 'legion-greaves'], null),
    ];
    const changed = rows.filter((r) => r.ROLL_TIER_CHANGED_ACROSS_THE_SAVE);
    return {
      rows,
      states_whose_ROLL_TIER_changes_across_a_save_and_reload: changed.map((r) => `${r.state} (+${r.dressed_with.length} worn)`),
      the_hands_term_is_what_crosses_the_cliff:
        rows[1].ROLL_TIER_CHANGED_ACROSS_THE_SAVE === true && rows[2].ROLL_TIER_CHANGED_ACROSS_THE_SAVE === false,
      // This probe PASSES when it finds the change. `coupled` is the finding, not the health.
      coupled: changed.length > 0,
    };
  },

  // =========================================================================================
  // K6 — THE REFUSED BOW, FROM THE PLAYER'S CHAIR.
  // =========================================================================================
  bow() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const out = {};
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    const q = cs().player.pos;
    H.spawnProp({ eid: 'k6-bow', name: 'hist-sap-bow', item: 'hist-sap-bow', pos: [q[0], q[1], q[2]] });
    H.takeProp('k6-bow');
    H.stepFrames(4);
    const b0 = H.getBurden().equip_load;
    out.before = { pct: b0.pct, weapon: b0.weapon_the_fight_swings, equipped_kg: b0.equipped_weight,
      carried_kg: b0.carried_weight,
      hud: (() => { try { const u = H.getUIState ? H.getUIState() : null; return u ? { toast: u.toast || null } : null; } catch (e) { return null; } })() };
    // Watch the event bus across the equip, which is the ONLY place the reason is written.
    // The bus is cleared every step, so it has to be drained frame by frame.
    const E = window.__ENGINE;
    const events = [];
    H.equipItem('hist-sap-bow');
    for (let i = 0; i < 40; i++) {
      H.stepFrames(1);
      for (let j = 0; j < E.bus.count; j++) {
        const e = E.bus.pool[j];
        if (e.type === 'equip_end' || e.type === 'equip_start') {
          events.push({ f: e.f, type: e.type, item: e.item, slot: e.slot, equipped: e.equipped, refused: e.refused || null });
        }
      }
    }
    const b1 = H.getBurden().equip_load;
    out.after = { pct: b1.pct, weapon: b1.weapon_the_fight_swings, equipped_kg: b1.equipped_weight,
      carried_kg: b1.carried_weight,
      inventory_slot: (H.getInventory().find((r) => r.id === 'hist-sap-bow') || {}).slot || null,
      hud: (() => { try { const u = H.getUIState ? H.getUIState() : null; return u ? { toast: u.toast || null } : null; } catch (e) { return null; } })() };
    out.equip_events = events;
    out.the_refusal_is_on_the_event = Array.isArray(events) && events.some((e) => e.refused);
    out.reason = Array.isArray(events) ? (events.find((e) => e.refused) || {}).refused || null : null;
    // What a player can observe: the load, the slot, the weapon, the HUD toast.
    out.anything_the_player_could_see_changed =
      out.before.pct !== out.after.pct || out.before.weapon !== out.after.weapon
      || out.after.inventory_slot !== null
      || JSON.stringify(out.before.hud) !== JSON.stringify(out.after.hud);
    // And the thing round 3 got RIGHT: the bow is not weighed as though held.
    out.the_bow_is_not_weighed_as_though_held = out.before.equipped_kg === out.after.equipped_kg;
    out.coupled = out.the_bow_is_not_weighed_as_though_held === true;
    return out;
  },
};

const out = { schema: 'elder-souls/critic-w1-16-r3-live@1', unit: 'f@60 and metres over a declared f@60 count',
  generated: new Date().toISOString(), probes: {} };
const dest = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-16', 'critic-r3-live.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });

for (const name of run) {
  const fn = PROBES[name];
  if (!fn) { console.error(`unknown probe '${name}'`); process.exitCode = EXIT.USAGE; continue; }
  const t0 = Date.now();
  log(`probe: ${name}`);
  try {
    out.probes[name] = await handle.page.evaluate(fn);
    log(`  ok (${Date.now() - t0} ms)  coupled=${out.probes[name].coupled}`);
  } catch (e) {
    out.probes[name] = { __err: String(e && e.message || e) };
    console.error(`  FAILED: ${e && e.message}`);
    process.exitCode = EXIT.HARNESS_ERROR;
  }
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
}
await handle.close();

const dead = Object.entries(out.probes).filter(([, v]) => v && v.coupled === false).map(([k]) => k);
out.uncoupled_probes = dead;
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
process.stdout.write(`written: ${path.relative(REPO_ROOT, dest)}\n`);
if (dead.length) process.exitCode = 1;
