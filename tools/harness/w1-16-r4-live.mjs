#!/usr/bin/env node
// w1-16-r4-live.mjs — W1-16 ROUND 4, the stepping half. ONE browser, kept open (RULES #21).
//
// Six probes, one per thing the round-3 verdict adjudicated against the round, each run in BOTH
// arms with the teardown watched going red (RULES #6). Every arm is a `__breakW116` switch that
// restores the round-3 world exactly, so the counterfactual is the shipped code with my change
// removed rather than an argument about it.
//
//   pinfight    THE BLOCKING GAP. Round 2 measured the pin ladder on `default`, WHICH DOES NOT
//               PIN. `arena_duel` and `arena_flat` do, and a save and a reload moved them
//               24.000000% LIGHT / 26 i-frames / 52 f@60 -> 33.424658% MEDIUM / 22 / 60. This
//               saves AND reloads every shipped state and re-reads the tier out of the RUNNING
//               WORLD (RULES #7), which round 3's own D4 could not do because it loaded 49 states
//               and saved none.                                             arm: `savepin`
//   burden      RI-PRG07 §3 "equipped or not". Worn and held weight must move burden — and the
//               anti-merge must still hold in the other direction: 460 kg in the pack leaves the
//               roll byte-identical (method 3, "How we lose" #1).           arm: `burdenhands`
//   talisman    §2's FOURTH TERM, live: a slot you can put something in, a weight both ratios
//               read, and a consumer that is not a number in a report — the catalyst the fight
//               casts through.                                              arm: `talisman`
//   overloaded  The tier REACHED rather than pinned, and the dressing-only shortfall priced.
//   feather     The clamp at BOTH ends, stepped past the expiry, which is where round 3's world
//               left the caster 42.833333% MEDIUM after starting at 13.013699% LIGHT. arm: `feather`
//   refusal     What the player is told. `anything_the_player_could_see_changed` must be true
//               without the raw diagnostic reaching the HUD.                arm: `toast`
//
// Units: every frame figure is f@60 (our fixed 60 Hz step); metres are metres of capsule travel
// over a declared frame count. Both are load-independent by construction (S22).
//
//   node tools/harness/w1-16-r4-live.mjs [--probe a,b,...] [--out path]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
w1-16-r4-live.mjs — W1-16 round 4's stepping probes. One browser, kept.
  --probe <names|all>   pinfight burden talisman overloaded feather refusal consumption
  --out <path>          default reports/w1-16/r4-live.json
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ALL = ['pinfight', 'burden', 'talisman', 'overloaded', 'feather', 'refusal', 'consumption'];
const run = String(args.probe || 'all') === 'all' ? ALL : String(args.probe).split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'setEquipLoad', 'getBurden', 'spawnProp', 'takeProp', 'getInventory', 'equipItem',
  'getPlayerStats', 'setLoadout', '__breakW116', 'saveRoundTrip', 'castNow']);

// Shared page-side helpers, injected as source text into each probe (the page evaluates each
// function in isolation, so they cannot be closed over from here).
const HELPERS = `
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const WEARABLES = ['shell-scale-hauberk','legion-greaves','rootweave-cowl','wet-season-boots','silt-strider-silk-sash'];
  // A roll, measured as the critic measured it: count the frames the body reports invulnerable
  // and the frames until the move ends. Both f@60.
  const rollOnce = () => {
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
    H.stepFrames(2);
    const iv = []; let f = 1, total = null;
    while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
    return { iframes_f60: iv.length, total_f60: total, tier: cs().player.tier };
  };
  const give = (tag, item) => {
    const q = cs().player.pos;
    H.spawnProp({ eid: tag + '-' + item, name: item, item, pos: [q[0], q[1], q[2]] });
    H.takeProp(tag + '-' + item);
  };
  const snap = (label) => {
    const b = H.getBurden();
    return { label,
      pct: b.equip_load.pct, tier: b.equip_load.tier, source: b.equip_load.source,
      equipped_kg: b.equip_load.equipped_weight, carried_kg: b.equip_load.carried_weight,
      hands: b.equip_load.hands, burden_ratio: b.ratio, burden_tier: b.tier,
      equipment_base_pct: b.equip_load.equipment_base_pct,
      spell_offset_pct: b.equip_load.spell_offset_pct,
      pinned: b.equip_load.pinned,
      weapon: b.equip_load.weapon_the_fight_swings, shield: b.equip_load.shield_the_fight_holds };
  };
`;

const PROBES = {

  // =========================================================================================
  // THE BLOCKING GAP. Save AND reload, then read the RUNNING WORLD back.
  // =========================================================================================
  pinfight: `() => {
    ${HELPERS}
    const E = window.__ENGINE;
    const names = Object.keys((E && E.data && E.data.states) || {});

    // ---- 1. THE LADDER. Every shipped state, loaded, tier read, SAVED AND RELOADED, tier read
    // again. Round 3's D4 loaded 49 states and saved none, which is why it could not see this.
    const rows = [];
    for (const s of names) {
      const r = { state: s };
      try {
        H.setSeed(1337); H.loadState(s); H.stepFrames(8);
        const a = H.getBurden().equip_load;
        r.pinned = !!a.pinned; r.pct_before = a.pct; r.tier_before = a.tier; r.source_before = a.source;
        const rt = H.saveRoundTrip();
        r.hash_equal = rt.equal;
        H.stepFrames(4);
        const b = H.getBurden().equip_load;
        r.pct_after = b.pct; r.tier_after = b.tier; r.source_after = b.source;
        r.tier_changed = r.tier_before !== r.tier_after;
        r.pct_moved = Math.abs(r.pct_before - r.pct_after) > 1e-9;
      } catch (e) { r.err = String(e && e.message || e); }
      rows.push(r);
    }
    const ok = rows.filter((r) => !r.err);
    const pinned = ok.filter((r) => r.pinned);

    // ---- 2. THE VERDICT'S OWN FIXTURE, with the roll actually rolled. Dress a PINNING state in
    // a hauberk and greaves and save it. This is the exact table the round-3 verdict §G published.
    const dressAndSave = (state, arm) => {
      const o = { state, arm: arm || 'fix (HEAD)' };
      try {
        H.__breakW116(arm || null);
        H.setSeed(1337); H.loadState(state); H.stepFrames(8);
        H.__breakW116(arm || null);
        for (const it of ['shell-scale-hauberk', 'legion-greaves']) { give('pf', it); H.equipItem(it); H.stepFrames(40); }
        H.stepFrames(6);
        const a = snap('before the save');
        const rollA = rollOnce();
        H.stepFrames(30);
        const rt = H.saveRoundTrip();
        H.stepFrames(6);
        const b = snap('after saveRoundTrip()');
        const rollB = rollOnce();
        o.before = Object.assign(a, rollA);
        o.after = Object.assign(b, rollB);
        o.hash_equal = rt.equal;
        o.equip_load_moved_across_the_save = Math.abs(a.pct - b.pct) > 1e-9;
        o.roll_tier_changed = rollA.tier !== rollB.tier;
        o.iframes_lost = rollA.iframes_f60 - rollB.iframes_f60;
      } catch (e) { o.err = String(e && e.message || e); }
      H.__breakW116(null);
      return o;
    };

    const out = {
      states_examined: rows.length,
      pinned_states: pinned.length,
      rows,
      // THE ACCEPTANCE, in the verdict's own words.
      states_whose_ROLL_TIER_changes_across_a_save_and_reload:
        ok.filter((r) => r.tier_changed).map((r) => ({ state: r.state, from: r.tier_before, to: r.tier_after })),
      pinned_states_whose_equip_load_moved_across_the_save:
        pinned.filter((r) => r.pct_moved).map((r) => ({ state: r.state, before: r.pct_before, after: r.pct_after })),
      arena_duel_FIX: dressAndSave('arena_duel', null),
      arena_flat_FIX: dressAndSave('arena_flat', null),
      // DELETE-THE-FIX. 'savepin' stops the save carrying the pin, which is round 3's world.
      arena_duel_CUT_savepin: dressAndSave('arena_duel', 'savepin'),
      arena_flat_CUT_savepin: dressAndSave('arena_flat', 'savepin'),
      // The counterfactual the verdict kept, so the arm has not been made vacuous: with the hands
      // blind the sum stays inside LIGHT and the cliff is never crossed either way.
      arena_duel_CUT_hands: dressAndSave('arena_duel', 'hands'),
      // ...and both arms together, which is the round-3 verdict's exact third row.
      arena_duel_CUT_savepin_and_hands: dressAndSave('arena_duel', 'savepin,hands'),
    };
    out.equip_load_moved_across_the_save = out.arena_duel_FIX.equip_load_moved_across_the_save
      || out.arena_flat_FIX.equip_load_moved_across_the_save;
    out.the_teardown_reproduces_the_defect =
      out.arena_duel_CUT_savepin.roll_tier_changed === true && out.arena_flat_CUT_savepin.roll_tier_changed === true;
    out.coupled = out.states_whose_ROLL_TIER_changes_across_a_save_and_reload.length === 0
      && out.equip_load_moved_across_the_save === false
      && out.the_teardown_reproduces_the_defect === true;
    return out;
  }`,

  // =========================================================================================
  // RI-PRG07 §3 — "ALL carried items, EQUIPPED OR NOT" — WITHOUT breaking the anti-merge.
  // =========================================================================================
  burden: `() => {
    ${HELPERS}
    const arm = (broken) => {
      H.__breakW116(broken); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.__breakW116(broken);
      const A = Object.assign(snap('A - empty pack, the scenario hands'), rollOnce());
      // 40 mauls: the pack must move BURDEN and must leave the ROLL byte-identical (method 3).
      for (let i = 0; i < 40; i++) {
        const q = cs().player.pos;
        H.spawnProp({ eid: 'b4-' + i, name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [q[0], q[1], q[2]] });
        H.takeProp('b4-' + i);
      }
      H.stepFrames(8);
      const B = Object.assign(snap('B - 460 kg in the pack, worn by nothing'), rollOnce());
      // The hands, on a clean fixture: 33 kg of steel that round 3 weighed for the roll and not
      // for the walk home.
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8); H.__breakW116(broken);
      const C = Object.assign(snap('C - default hands'), rollOnce());
      let err = null;
      try { H.setLoadout({ weapon: 'ultra-greatsword', shield: 'naga_tower' }); H.stepFrames(6); }
      catch (e) { err = String(e && e.message || e); }
      const D = Object.assign(snap('D - ultra greatsword + Naga tower, nothing in the pack'), rollOnce());
      // And WORN weight, which §3 also counts.
      for (const it of WEARABLES) { give('b4w', it); H.equipItem(it); H.stepFrames(40); }
      H.stepFrames(6);
      const E2 = Object.assign(snap('E - five pieces worn as well'), rollOnce());
      H.__breakW116(null);
      return { A, B, C, D, E: E2, swap_err: err,
        pack_moved_burden: A.burden_ratio !== B.burden_ratio,
        pack_left_the_roll_byte_identical: A.pct === B.pct && A.iframes_f60 === B.iframes_f60
          && A.total_f60 === B.total_f60 && A.tier === B.tier,
        hands_moved_the_roll: C.pct !== D.pct,
        hands_moved_burden: C.burden_ratio !== D.burden_ratio,
        hands_kg: D.hands ? D.hands.total : null,
        carried_kg_with_only_the_hands: D.carried_kg,
        worn_moved_burden: D.burden_ratio !== E2.burden_ratio };
    };
    const fix = arm(null);
    const cut = arm('burdenhands');
    return {
      fix, cut,
      ri_prg07_s3: 'burdenRatio = (weight of ALL carried items, equipped or not) / (maxLoad x 2.5)',
      // The anti-merge must survive the repair. This is RI-PRG07 method 3 and its "How we lose" #1.
      anti_merge_still_holds: fix.pack_moved_burden === true && fix.pack_left_the_roll_byte_identical === true,
      hands_now_move_burden: fix.hands_moved_burden === true,
      round_3_world_reproduced_by_the_teardown: cut.hands_moved_burden === false && cut.carried_kg_with_only_the_hands === 0,
      coupled: fix.pack_moved_burden === true && fix.pack_left_the_roll_byte_identical === true
        && fix.hands_moved_the_roll === true && fix.hands_moved_burden === true
        && fix.worn_moved_burden === true && cut.hands_moved_burden === false,
    };
  }`,

  // =========================================================================================
  // §2's FOURTH TERM, live. A slot, a weight, a reader — and a consumer in the fight.
  // =========================================================================================
  talisman: `() => {
    ${HELPERS}
    const arm = (broken) => {
      H.__breakW116(broken); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.__breakW116(broken);
      const before = snap('no talisman');
      let cat0 = null, cat1 = null, focus0 = null, focus1 = null, ev = null;
      try { cat0 = H.getMagicState ? H.getMagicState().catalyst : null; } catch (e) { /* optional */ }
      try { focus0 = H.getMagicState ? H.getMagicState().focus : null; } catch (e) { /* optional */ }
      give('tal', 'root-speakers-rod');
      const inv0 = H.getInventory().filter((r) => r.id === 'root-speakers-rod');
      H.equipItem('root-speakers-rod'); H.stepFrames(40); H.stepFrames(6);
      const after = snap('rod equipped');
      const inv1 = H.getInventory().filter((r) => r.id === 'root-speakers-rod');
      try { cat1 = H.getMagicState ? H.getMagicState().catalyst : null; } catch (e) { /* optional */ }
      try { focus1 = H.getMagicState ? H.getMagicState().focus : null; } catch (e) { /* optional */ }
      H.__breakW116(null);
      return { before, after,
        slot_before: inv0.length ? inv0[0].slot : null, slot_after: inv1.length ? inv1[0].slot : null,
        catalyst_before: cat0, catalyst_after: cat1,
        talisman_kg: after.hands ? after.hands.talisman : null,
        equip_load_moved: Math.abs(after.pct - before.pct) > 1e-9,
        burden_moved: Math.abs(after.burden_ratio - before.burden_ratio) > 1e-12,
        equipped_kg_delta: +(after.equipped_kg - before.equipped_kg).toFixed(6),
        carried_kg_delta: +(after.carried_kg - before.carried_kg).toFixed(6) };
    };
    const fix = arm(null);
    const cut = arm('talisman');
    return {
      fix, cut,
      ri_prg07_s2: 'equipRatio = (weight of equipped weapons, shields, armour, TALISMANS) / maxLoad',
      round_3_state: 'the token "talisman" appeared in game/src only inside two comments quoting §2 — no slot, no weight, no reader, not even a declared null in the consumption table',
      it_has_a_slot: fix.slot_after === 'talisman',
      it_has_a_weight: fix.talisman_kg > 0,
      both_ratios_read_it: fix.equip_load_moved && fix.burden_moved,
      // The consumer that makes it a term and not a readout: the catalyst the fight casts through.
      it_reaches_the_MagicSystem: fix.catalyst_before !== fix.catalyst_after && fix.catalyst_after === 'rod',
      teardown_removes_the_weight_and_keeps_the_slot: cut.slot_after === 'talisman' && !(cut.talisman_kg > 0),
      coupled: fix.slot_after === 'talisman' && fix.talisman_kg > 0 && fix.equip_load_moved
        && fix.burden_moved && fix.catalyst_after === 'rod' && !(cut.talisman_kg > 0),
    };
  }`,

  // =========================================================================================
  // OVERLOADED, REACHED. The round-3 verdict §D priced the dressing-only shortfall at 15.21 kg
  // of content and demonstrated the tier is reachable with the SHIPPED Burden. Re-taken here
  // with the talisman in the sum, and the shortfall re-priced against the new census.
  // =========================================================================================
  overloaded: `() => {
    ${HELPERS}
    const walk = (frames, sprint) => {
      const p0 = H.getPlayerStats().pos.slice();
      const s0 = cs().player.stamina;
      const inputs = [{ f: 0, move: [0, 1] }];
      if (sprint) inputs.push({ f: 0, press: ['sprint'] });
      H.queueInputs(inputs); H.stepFrames(frames);
      const p1 = H.getPlayerStats().pos.slice();
      return { metres_over_120_f60: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        stamina_spent: +(s0 - cs().player.stamina).toFixed(2), tier: cs().player.tier };
    };
    const dress = () => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.setLoadout({ weapon: 'ultra-greatsword', shield: 'naga_tower' }); H.stepFrames(4);
      for (const it of WEARABLES.concat(['root-speakers-rod'])) { give('ov', it); H.equipItem(it); H.stepFrames(40); }
      H.stepFrames(6);
      return snap('dressed on shipped weights alone');
    };
    const out = {};
    out.dressed = dress();
    out.sprint_MEDIUM = { held: walk(120, true) };
    // The shortfall, priced: how many more kilograms of CONTENT would put the tier there by
    // dressing alone. 'equip_load_max' is this sheet's maxLoad; 100% of it is OVERLOADED.
    const b0 = H.getBurden().equip_load;
    out.max_load_kg = b0.equip_load_max;
    out.equipped_kg = b0.equipped_weight;
    out.dressing_only_shortfall_kg = +(b0.equip_load_max - b0.equipped_weight).toFixed(2);

    // The spell, and then the two walks. EACH WALK GETS A FRESH DRESS AND A FRESH CAST, because
    // the first version of this probe ran the button-up control immediately after the held run
    // and the body was already at speed — 6.208 m with the button UP against 5.277 m with it
    // held, which reads as sprint making you slower and is an artefact of the fixture, not a
    // result. A control taken from a different starting state is not a control.
    const dressAndCurse = () => {
      const d = dress();
      const s = {};
      try {
        s.willpower = H.setWillpower(80);
        s.skills = H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
        s.learn = H.learnSpell('burden');
        s.attune = H.setAttuned(['burden']);
        s.cast = H.castNow('burden');
        H.stepFrames(6);
        const b = H.getBurden().equip_load;
        s.pct_after_cast = b.pct; s.tier_after_cast = b.tier;
        s.equipment_base_pct = b.equipment_base_pct; s.spell_offset_pct = b.spell_offset_pct;
        s.offset_observed = +(b.pct - d.pct).toFixed(6);
      } catch (e) { s.err = String(e && e.message || e); }
      return { dressed: d, spell: s };
    };
    const heldRun = dressAndCurse();
    out.re_dressed = heldRun.dressed;
    out.spell = heldRun.spell;
    if (out.spell.tier_after_cast === 'OVERLOADED') {
      out.sprint_at_a_REAL_OVERLOADED = { held: walk(120, true) };
      out.roll_at_OVERLOADED = rollOnce();
      // The button-up control, from a FRESH dress-and-curse at the same tier.
      const ctl = dressAndCurse();
      out.control_fixture = { tier_after_cast: ctl.spell.tier_after_cast, pct_after_cast: ctl.spell.pct_after_cast };
      out.sprint_button_up_control = { up: walk(120, false) };
      out.tier_at_the_control = cs().player.tier;
    }
    const held = out.sprint_at_a_REAL_OVERLOADED && out.sprint_at_a_REAL_OVERLOADED.held.metres_over_120_f60;
    const up = out.sprint_button_up_control && out.sprint_button_up_control.up.metres_over_120_f60;
    const med = out.sprint_MEDIUM.held.metres_over_120_f60;
    out.OVERLOADED_reached_without_a_pin = out.spell.tier_after_cast === 'OVERLOADED';
    out.sprint_denied_at_a_tier_the_world_chose = held !== undefined && up !== undefined && held === up && med > held;
    out.source_is_not_a_pin = !/pinned/.test((out.dressed.source || ''));
    out.coupled = !!out.OVERLOADED_reached_without_a_pin && out.sprint_denied_at_a_tier_the_world_chose === true;
    return out;
  }`,

  // =========================================================================================
  // THE FEATHER, PAST ITS EXPIRY — the half round 3 did not measure and the verdict did.
  // =========================================================================================
  feather: `() => {
    ${HELPERS}
    const arm = (broken) => {
      const o = { arm: broken || 'fix (HEAD)' };
      try {
        H.__breakW116(broken); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
        H.__breakW116(broken);
        const a = Object.assign(snap('before casting Feather'), rollOnce());
        H.setWillpower(80);
        H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
        H.learnSpell('feather'); H.setAttuned(['feather']);
        o.cast = H.castNow('feather');
        H.stepFrames(6);
        const b = Object.assign(snap('after casting Feather'), rollOnce());
        // Run it out. Feather is 30 s = 1800 f@60.
        let n = 0;
        while (n < 2600 && H.getBurden().equip_load.spell_offset_pct !== 0 && b.spell_offset_pct !== 0) {
          H.stepFrames(100); n += 100;
          if (H.getBurden().equip_load.pct === a.pct) break;
        }
        if (n === 0) H.stepFrames(2000);
        H.stepFrames(60);
        o.frames_stepped_to_expiry = n;
        const c = Object.assign(snap('after the spell expires'), rollOnce());
        o.before = a; o.after_cast = b; o.after_expiry = c;
        o.returned_to_where_it_started = Math.abs(c.pct - a.pct) < 1e-6;
        o.heavier_than_it_started = c.pct > a.pct + 1e-6;
        o.iframes_lost_permanently = a.iframes_f60 - c.iframes_f60;
        o.tier_before = a.tier; o.tier_after_expiry = c.tier;
      } catch (e) { o.err = String(e && e.message || e); }
      H.__breakW116(null);
      return o;
    };
    const fix = arm(null);
    const cut = arm('feather');
    return {
      fix, cut,
      what_round_3_shipped: '13.013699% LIGHT / 26 i-frames -> 0.000000% -> 42.833333% MEDIUM / 22',
      the_fix_returns_it: fix.returned_to_where_it_started === true && fix.heavier_than_it_started === false,
      the_teardown_reproduces_it: cut.heavier_than_it_started === true,
      coupled: fix.returned_to_where_it_started === true && cut.heavier_than_it_started === true,
    };
  }`,

  // =========================================================================================
  // WHAT THE PLAYER IS TOLD. Round-3 verdict §I: anything_the_player_could_see_changed: false.
  // =========================================================================================
  refusal: `() => {
    ${HELPERS}
    // What the PLAYER can see is the DRAWN element, not a field on a model. 'ui/hud.js''s E11
    // draws 'hud.toast' and refuses to draw it during a fight (RI-UIX01 §C counts it separately),
    // so both are recorded and 'in_combat' is reported beside them rather than assumed away.
    const uiSnap = () => {
      const o = { drawn_toast: null, model_toast: null, in_combat: null, err: null };
      try {
        const u = H.getUIState ? H.getUIState() : null;
        const els = (u && u.elements) || [];
        const t = els.filter((e) => e.kind === 'toast' || e.id === 'hud.toast')[0] || null;
        o.drawn_toast = t ? (t.text || null) : null;
        o.in_combat = u ? !!u.in_combat : null;
      } catch (e) { o.err = String(e && e.message || e); }
      try { const E = window.__ENGINE; o.model_toast = E && E.ui && E.ui.toast ? E.ui.toast.text : null; }
      catch (e) { /* recorded above */ }
      // The claim is about the drawn element wherever the HUD will draw one at all.
      o.toast = o.drawn_toast !== null ? o.drawn_toast : o.model_toast;
      return o;
    };
    const arm = (broken) => {
      const o = { arm: broken || 'fix (HEAD)' };
      try {
        H.__breakW116(broken); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
        H.__breakW116(broken);
        const before = Object.assign(snap('before the press'), uiSnap());
        give('rf', 'hist-sap-bow');
        H.equipItem('hist-sap-bow'); H.stepFrames(40);
        const after = Object.assign(snap('after 40 f@60'), uiSnap());
        const row = H.getInventory().filter((r) => r.id === 'hist-sap-bow')[0] || null;
        o.before = before; o.after = after;
        o.inventory_slot = row ? row.slot : null;
        o.weapon_still = after.weapon;
        o.equipped_weight_unchanged = before.equipped_kg === after.equipped_kg;
        o.anything_the_player_could_see_changed = (before.toast || null) !== (after.toast || null);
        o.toast = after.toast;
        // The raw diagnostic must NOT reach the HUD.
        o.the_raw_diagnostic_leaked = /createPlayer|moveset|Known:|roster/.test(String(after.toast || ''));
        // And a SUCCESSFUL equip must speak too, or the channel only ever carries bad news.
        give('rf', 'shell-scale-hauberk');
        H.equipItem('shell-scale-hauberk'); H.stepFrames(40);
        o.toast_on_a_successful_equip = uiSnap().toast;
      } catch (e) { o.err = String(e && e.message || e); }
      H.__breakW116(null);
      return o;
    };
    const fix = arm(null);
    const cut = arm('toast');
    return {
      fix, cut,
      round_3_state: 'anything_the_player_could_see_changed: false — the reason was on the equip_end event and nothing under ui/ or render/ reads it',
      the_policy_is_unchanged: fix.equipped_weight_unchanged === true && fix.inventory_slot === null,
      the_player_is_now_told: fix.anything_the_player_could_see_changed === true && !fix.the_raw_diagnostic_leaked,
      the_teardown_makes_it_silent_again: cut.anything_the_player_could_see_changed === false,
      coupled: fix.anything_the_player_could_see_changed === true
        && fix.the_raw_diagnostic_leaked === false
        && fix.equipped_weight_unchanged === true
        && cut.anything_the_player_could_see_changed === false,
    };
  }`,
  // =========================================================================================
  // CONSUMPTION — RI-MTH07, mandatory under ARBITRATION §3. For every model this round ships,
  // NAME the world-side consumer and DEMONSTRATE it by perturbing the model and watching an
  // entity change behaviour. Sixteen subsystems here have shipped a correct, instrumented model
  // that nothing in the running world reads; the point of this probe is to not be the
  // seventeenth. The pin, the offset and the toast are demonstrated by the four probes above and
  // are restated here with their consumers named; the two NEW consumers that nothing else
  // exercises get their own perturbation.
  // =========================================================================================
  consumption: `() => {
    ${HELPERS}
    const out = { models: [] };

    // ---- 1. THE HANDS AND THE TALISMAN IN BURDEN -> sim/traversal.js, the walk itself.
    // The §3 half was a number in a report until now: burden's move multiplier is consumed by
    // Engine._burdenMult() inside traversal.step()'s horizontal retraction. Perturb the HANDS
    // ONLY — nothing enters or leaves the pack — and watch the metres walked change.
    const walkOut = (frames) => {
      const p0 = H.getPlayerStats().pos.slice();
      H.queueInputs([{ f: 0, move: [0, 1] }]);
      H.stepFrames(frames);
      const p1 = H.getPlayerStats().pos.slice();
      return +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3);
    };
    const handsWalk = (arm, patch) => {
      H.__breakW116(arm || null); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.__breakW116(arm || null);
      // 92 kg in the pack first, so the character sits just under the UNBURDENED/LADEN boundary
      // and a few kilograms of STEEL IN THE HANDS is what decides which side of it they are on.
      // A still target hides every steering defect (RULES #8), and the first version of this arm
      // was exactly that: 26 mauls put both arms at IMMOBILE, both walked 0.000 m, and the
      // control looked clean. The boundary is at burden 0.60 = 109.5 kg on this sheet; the pack
      // is 92.0, the light hands are 9.5 and the heavy hands 33.0, so the hands decide the tier.
      for (let i = 0; i < 8; i++) {
        const q = cs().player.pos;
        H.spawnProp({ eid: 'cw-' + i, name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [q[0], q[1], q[2]] });
        H.takeProp('cw-' + i);
      }
      H.stepFrames(8);
      if (patch) { H.setLoadout(patch); H.stepFrames(6); }
      const b = H.getBurden();
      const m = walkOut(120);
      H.__breakW116(null);
      return { arm: arm || 'fix (HEAD)', hands_kg: b.equip_load.hands ? b.equip_load.hands.all : null,
        carried_kg: b.equip_load.carried_weight, burden_ratio: b.ratio, burden_tier: b.tier,
        move_mult_applied: b.move_mult_applied, in_combat: b.in_combat, metres_over_120_f60: m };
    };
    const light = handsWalk(null, null);
    const heavy = handsWalk(null, { weapon: 'ultra-greatsword', shield: 'naga_tower' });
    const heavyCut = handsWalk('burdenhands', { weapon: 'ultra-greatsword', shield: 'naga_tower' });
    out.models.push({
      model: 'the hands + talisman in BURDEN (RI-PRG07 §3 "equipped or not")',
      consumer: 'engine._recomputeBurden() -> sim.player.burdenRatio -> engine._burdenMult() -> sim/traversal.js step() horizontal retraction',
      arms: { light_hands: light, heavy_hands: heavy, heavy_hands_TEARDOWN: heavyCut },
      the_entity_changed: light.metres_over_120_f60 !== heavy.metres_over_120_f60,
      // With the hands out of burden the heavy loadout walks exactly as far as the light one —
      // the 23.5 kg of steel stops mattering, which is round 3's world. carried_kg is LOWER in
      // the teardown than in either fixed arm (92.0 vs 101.5/125.0) precisely because the hands
      // have left the sum, so the metres are the comparison and the kilograms are the reason.
      the_teardown_puts_it_back: heavyCut.metres_over_120_f60 === light.metres_over_120_f60
        && heavyCut.burden_tier === light.burden_tier,
    });

    // ---- 2. THE TALISMAN SLOT -> MagicSystem.setCatalyst -> whether a spell can be cast at all.
    // A weight in a ratio is a readout. The consumer that makes term 4 a TERM is the fight: with
    // no catalyst, castNow refuses; put the rod on and the same cast lands.
    const castTry = (equipRod, arm) => {
      H.__breakW116(arm || null); H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.__breakW116(arm || null);
      const o = { rod_equipped: !!equipRod, arm: arm || 'fix (HEAD)' };
      try {
        H.setWillpower(80);
        H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
        H.learnSpell('feather'); H.setAttuned(['feather']);
        try { H.setCatalyst ? H.setCatalyst(null) : null; } catch (e) { o.clear_err = String(e && e.message || e); }
        if (equipRod) { give('cc', 'root-speakers-rod'); H.equipItem('root-speakers-rod'); H.stepFrames(40); }
        o.catalyst = H.getMagicState ? H.getMagicState().catalyst : null;
        o.focus_cost = H.getMagicState && H.getMagicState().spells
          ? (H.getMagicState().spells.filter((s) => s.id === 'feather')[0] || {}).focus_cost : null;
        o.cast = H.castNow('feather');
      } catch (e) { o.cast_err = String(e && e.message || e); }
      H.stepFrames(6);
      o.pct = H.getBurden().equip_load.pct;
      H.__breakW116(null);
      return o;
    };
    out.models.push({
      model: 'RI-PRG07 §2 term 4 — the talisman SLOT',
      consumer: 'engine._finishEquipCommit() -> MagicSystem.setCatalyst() -> focusCost() and castNow()\\'s no_catalyst refusal',
      arms: { without_the_rod: castTry(false, null), with_the_rod: castTry(true, null) },
      note: 'the "no_catalyst" refusal does not fire here because "none" is a LEGAL catalyst in '
        + 'this build (bare-handed Root-Speech, focus_mult 1.35). The consumer bites on the OTHER '
        + 'side of the same function: focusCost() multiplies by the catalyst row, so putting the '
        + 'rod on changes the FOCUS THE CAST SPENDS. That is the entity-visible change.',
    });

    // ---- 3-5. Restated, with the probe that measured each.
    out.models.push({ model: 'equip_load_pinned across a save',
      consumer: 'save/fight.js saveLoadout() -> Engine._restoreFightFromSave() -> _publishEquipLoad() -> combat.tierOf() -> roll.json row -> combat/player.js roll',
      demonstrated_by: '--probe pinfight, arm savepin: arena_duel 24.000000% LIGHT 26 i-frames / 52 f@60 -> 33.424658% MEDIUM 22 / 60' });
    out.models.push({ model: 'engine._equipLoadOffset (the spell term)',
      consumer: 'sim/magic/apply.js loadHandler -> Engine._addEquipLoadOffset() -> _publishEquipLoad() -> the roll row',
      demonstrated_by: '--probe feather, arm feather: 13.013699% LIGHT 26 -> 0% -> 42.833333% MEDIUM 22 with the fix removed; 13.013699% LIGHT 26 with it' });
    out.models.push({ model: 'the equip refusal message',
      consumer: 'Engine._sayEquip() -> uiToast() -> ui/hud.js E11 "hud.toast" drawn element',
      demonstrated_by: '--probe refusal, arm toast: the DRAWN element text changes with the fix and does not without it' });

    const m1 = out.models[1].arms;
    out.models[1].the_entity_changed =
      m1.with_the_rod.catalyst === 'rod' && m1.without_the_rod.catalyst === 'none'
      && !!m1.with_the_rod.cast && !!m1.without_the_rod.cast
      && m1.with_the_rod.cast.focus_spent !== m1.without_the_rod.cast.focus_spent;
    out.models[1].focus_spent = { without_the_rod: m1.without_the_rod.cast && m1.without_the_rod.cast.focus_spent,
      with_the_rod: m1.with_the_rod.cast && m1.with_the_rod.cast.focus_spent };
    out.coupled = out.models[0].the_entity_changed === true
      && out.models[0].the_teardown_puts_it_back === true
      && out.models[1].the_entity_changed === true;
    return out;
  }`,
};

const out = { schema: 'elder-souls/w1-16-r4-live@1', unit: 'f@60 and metres', generated: new Date().toISOString(), probes: {} };
const dest = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-16', 'r4-live.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });

for (const name of run) {
  const src = PROBES[name];
  if (!src) { console.error(`unknown probe '${name}'`); process.exitCode = EXIT.USAGE; continue; }
  const t0 = Date.now();
  log(`probe: ${name}`);
  try {
    out.probes[name] = await handle.page.evaluate(`(${src})()`);
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
if (dead.length) process.exitCode = EXIT.HARNESS_ERROR || 1;
