#!/usr/bin/env node
// w1-16-r3-live.mjs — W1-16 ROUND 3, the stepping half. ONE browser, kept open (RULES #21).
//
// The round-3 acceptance is judged on the round-2 critic's own instruments
// (`critic-w1-16-live.mjs --probe parallel,oversprint`), which are run separately and unmodified.
// This file carries what those cannot: the delete-the-fix arms for the three claims round 3 makes,
// each run in BOTH orders with the teardown watched going red (RULES #6), plus the two questions
// the repair itself raises.
//
//   D1  DELETE-THE-FIX, `hands` — the equip ratio goes blind to the weapon and the shield again.
//   D2  DELETE-THE-FIX, `onehand` — the RULES #10 arm. `_finishEquipCommit()` stops routing a
//       `right` equip through `setLoadout()`, so the hand that is weighed and the hand that fights
//       come apart, which is round 2's world exactly.
//   D3  DELETE-THE-FIX, `oversprint` — OVERLOADED stops forbidding sprint. Measured in METRES over
//       a fixed frame count against a BUTTON-UP control, because three identical numbers prove
//       nothing if the sprint button was doing nothing in all of them.
//   D4  THE CALIBRATION QUESTION THE FIX RAISES. The producer now engages in every scenario that
//       puts a weapon in your hands, which is all of them — so the 25 shipped states that used to
//       answer a hardcoded 24.0 now answer a real number. Every one of them must still land in the
//       SAME ROLL TIER, or this round has silently moved W1-09/10/11's calibration.
//   D5  THE SPELL, LIVE. The round-2 verdict could only demonstrate the first-engagement delta
//       collapse offline, because `castNow` refused `not_attuned`. This tries it in a running fight
//       and reports the refusal in full if it still will not land.
//
// Units: every frame figure is f@60 (our fixed 60 Hz step); metres are metres of capsule travel
// over a declared frame count. Both are load-independent by construction (S22).
//
//   node tools/harness/w1-16-r3-live.mjs [--probe a,b,...] [--out path]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
w1-16-r3-live.mjs — W1-16 round 3's own stepping probes.
  --probe <names|all>   hands onehand oversprint states spell
  --out <path>          default reports/w1-16/r3-live.json
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ALL = ['hands', 'onehand', 'oversprint', 'states', 'spell'];
const run = String(args.probe || 'all') === 'all' ? ALL : String(args.probe).split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'setEquipLoad', 'getBurden', 'spawnProp', 'takeProp', 'getInventory', 'equipItem',
  'getPlayerStats', 'setLoadout', '__breakW116']);

const PROBES = {

  // =========================================================================================
  // D1 — the equip ratio goes blind to the hands.
  // =========================================================================================
  hands() {
    const H = window.__HARNESS;
    const arm = (broken) => {
      H.setSeed(1337); H.loadState('default');
      const set = H.__breakW116(broken);
      H.stepFrames(8);
      const b0 = H.getBurden().equip_load;
      const before = { pct: b0.pct, equipped_weight: b0.equipped_weight, hands: b0.hands,
        weapon: b0.weapon_the_fight_swings, shield: b0.shield_the_fight_holds, tier: b0.tier };
      // Put the heaviest weapon and the heaviest shield the game declares into the hands.
      let err = null;
      try { H.setLoadout({ weapon: 'ultra-greatsword', shield: 'naga_tower' }); H.stepFrames(6); }
      catch (e) { err = String(e && e.message || e); }
      const b1 = H.getBurden().equip_load;
      const after = { pct: b1.pct, equipped_weight: b1.equipped_weight, hands: b1.hands,
        weapon: b1.weapon_the_fight_swings, shield: b1.shield_the_fight_holds, tier: b1.tier };
      const cleared = H.__breakW116(null);
      return { broken: broken || 'none', switch_reported: set, switch_cleared: cleared,
        before, after, err, ratio_moved: before.pct !== after.pct, tier_moved: before.tier !== after.tier };
    };
    const cutFirst = arm('hands'); const fixAfter = arm(null);
    const fixFirst = arm(null); const cutAfter = arm('hands');
    return {
      order_cut_then_fix: { cut: cutFirst, fix: fixAfter },
      order_fix_then_cut: { fix: fixFirst, cut: cutAfter },
      arms_differ_in_both_orders: cutFirst.ratio_moved === false && fixAfter.ratio_moved === true
        && fixFirst.ratio_moved === true && cutAfter.ratio_moved === false,
      switch_is_observable: !!(cutFirst.switch_reported && cutFirst.switch_reported.broken.length === 1
        && fixAfter.switch_reported.broken.length === 0),
      coupled: cutFirst.ratio_moved === false && fixAfter.ratio_moved === true
        && fixFirst.ratio_moved === true && cutAfter.ratio_moved === false,
    };
  },

  // =========================================================================================
  // D2 — the two right hands (RULES #10), as a control arm.
  // =========================================================================================
  onehand() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const arm = (broken) => {
      H.setSeed(1337); H.loadState('default');
      const set = H.__breakW116(broken);
      H.stepFrames(8);
      const b0 = H.getBurden().equip_load;
      const before = { pct: b0.pct, weapon: b0.weapon_the_fight_swings, equipped_weight: b0.equipped_weight, tier: b0.tier };
      const p = cs().player.pos;
      H.spawnProp({ eid: 'r3-maul', name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [p[0], p[1], p[2]] });
      H.takeProp('r3-maul');
      H.equipItem('bog-iron-maul');
      H.stepFrames(40);
      const b1 = H.getBurden().equip_load;
      const after = { pct: b1.pct, weapon: b1.weapon_the_fight_swings, equipped_weight: b1.equipped_weight, tier: b1.tier,
        inventory_right: (H.getInventory().find((r) => r.slot === 'right') || {}).id || null };
      const cleared = H.__breakW116(null);
      return { broken: broken || 'none', switch_reported: set, switch_cleared: cleared, before, after,
        the_fight_swings_what_you_equipped: before.weapon !== after.weapon,
        the_ratio_moved: before.pct !== after.pct };
    };
    const cutFirst = arm('onehand'); const fixAfter = arm(null);
    const fixFirst = arm(null); const cutAfter = arm('onehand');
    return {
      order_cut_then_fix: { cut: cutFirst, fix: fixAfter },
      order_fix_then_cut: { fix: fixFirst, cut: cutAfter },
      // The cut arm reproduces round 2 exactly: the row lands in `right`, its carried.json weight
      // reaches the ratio, and the fight goes on swinging the garrison sword.
      cut_arm_is_round_2: cutFirst.the_fight_swings_what_you_equipped === false && cutFirst.the_ratio_moved === true,
      arms_differ_in_both_orders:
        cutFirst.the_fight_swings_what_you_equipped === false && fixAfter.the_fight_swings_what_you_equipped === true
        && fixFirst.the_fight_swings_what_you_equipped === true && cutAfter.the_fight_swings_what_you_equipped === false,
      coupled:
        cutFirst.the_fight_swings_what_you_equipped === false && fixAfter.the_fight_swings_what_you_equipped === true
        && fixFirst.the_fight_swings_what_you_equipped === true && cutAfter.the_fight_swings_what_you_equipped === false,
    };
  },

  // =========================================================================================
  // D3 — RI-CMB01 §B: "OVERLOADED additionally forbids sprinting."
  // Metres over 120 f@60, every tier, button HELD and button UP. The button-up control is what
  // makes three identical held numbers mean something.
  // =========================================================================================
  oversprint() {
    const H = window.__HARNESS;
    const runAt = (pct, sprint) => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(pct); H.stepFrames(8);
      const p0 = H.getPlayerStats().pos.slice();
      const inputs = [{ f: 0, move: [0, 1] }];
      if (sprint) inputs.push({ f: 0, press: ['sprint'] });
      H.queueInputs(inputs);
      const s0 = H.getCombatState().player.stamina;
      H.stepFrames(120);
      const p1 = H.getPlayerStats().pos.slice();
      return { pct, sprint_held: sprint, tier: H.getCombatState().player.tier,
        state: H.getCombatState().player.state,
        metres_over_120_f60: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        stamina_spent: +(s0 - H.getCombatState().player.stamina).toFixed(2) };
    };
    const sweep = () => {
      const rows = [];
      for (const pct of [15, 50, 85, 120]) { rows.push(runAt(pct, false)); rows.push(runAt(pct, true)); }
      return rows;
    };
    const arm = (broken) => {
      const set = H.__breakW116(broken);
      const rows = sweep();
      const cleared = H.__breakW116(null);
      const held = (p) => rows.find((r) => r.pct === p && r.sprint_held);
      const free = (p) => rows.find((r) => r.pct === p && !r.sprint_held);
      return { broken: broken || 'none', switch_reported: set, switch_cleared: cleared, rows,
        sprint_does_something_at_LIGHT: held(15).metres_over_120_f60 > free(15).metres_over_120_f60 * 1.05,
        an_OVERLOADED_player_still_sprints: held(120).metres_over_120_f60 > free(120).metres_over_120_f60 * 1.05,
        overloaded_held_equals_button_up: held(120).metres_over_120_f60 === free(120).metres_over_120_f60 };
    };
    const cutFirst = arm('oversprint'); const fixAfter = arm(null);
    const fixFirst = arm(null); const cutAfter = arm('oversprint');
    return {
      ri_cmb01_b: 'OVERLOADED additionally forbids sprinting and jump-attacks.',
      order_cut_then_fix: { cut: cutFirst, fix: fixAfter },
      order_fix_then_cut: { fix: fixFirst, cut: cutAfter },
      arms_differ_in_both_orders:
        cutFirst.an_OVERLOADED_player_still_sprints === true && fixAfter.an_OVERLOADED_player_still_sprints === false
        && fixFirst.an_OVERLOADED_player_still_sprints === false && cutAfter.an_OVERLOADED_player_still_sprints === true,
      // HEAVY must still sprint — a denial that fired one tier early would pass a naive check.
      HEAVY_still_sprints_with_the_fix_in: fixAfter.rows.find((r) => r.pct === 85 && r.sprint_held).metres_over_120_f60
        > fixAfter.rows.find((r) => r.pct === 85 && !r.sprint_held).metres_over_120_f60 * 1.05,
      coupled: fixAfter.sprint_does_something_at_LIGHT && !fixAfter.an_OVERLOADED_player_still_sprints
        && cutFirst.an_OVERLOADED_player_still_sprints,
    };
  },

  // =========================================================================================
  // D4 — DID THE FIX MOVE ANY SHIPPED STATE'S ROLL TIER?
  //
  // The producer now engages wherever there is a weapon in the hands, so the 25 unpinned states
  // that used to answer a hardcoded 24.0 answer a real number. 24.0 is LIGHT. If any of them has
  // become MEDIUM or worse, this round has silently re-tiered somebody else's calibration
  // fixture, and the round-2 verdict is explicit that the ladder must be left alone.
  // =========================================================================================
  states() {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const names = Object.keys((E && E.data && E.data.states) || {});
    const rows = [];
    for (const s of names) {
      try {
        H.setSeed(1337); H.loadState(s); H.stepFrames(8);
        const b = H.getBurden().equip_load;
        rows.push({ state: s, pct: b.pct, tier: b.tier, source: b.source,
          weapon: b.weapon_the_fight_swings, shield: b.shield_the_fight_holds,
          hands_kg: b.hands ? b.hands.total : null, equipped_weight: b.equipped_weight,
          equip_load_max: b.equip_load_max });
      } catch (e) { rows.push({ state: s, err: String(e && e.message || e) }); }
    }
    const ok = rows.filter((r) => !r.err);
    const pinned = ok.filter((r) => /pinned/.test(r.source || ''));
    const derived = ok.filter((r) => !/pinned/.test(r.source || ''));
    return {
      states_examined: rows.length,
      pinned_by_the_scenario: pinned.length,
      derived_from_the_world: derived.length,
      still_answering_a_hardcoded_default: ok.filter((r) => /nothing is equipped yet/.test(r.source || '')).map((r) => r.state),
      not_LIGHT: ok.filter((r) => r.tier !== 'LIGHT').map((r) => ({ state: r.state, pct: r.pct, tier: r.tier })),
      rows,
      // Every shipped state was LIGHT before this round (24.0 pinned, or 24.0 default).
      no_state_changed_roll_tier: ok.every((r) => r.tier === 'LIGHT'),
      coupled: ok.every((r) => r.tier === 'LIGHT'),
    };
  },

  // =========================================================================================
  // D5 — THE SPELL, LIVE.
  // =========================================================================================
  spell() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const out = { attempts: [] };
    const tryOn = (state) => {
      const a = { state };
      try {
        H.setSeed(1337); H.loadState(state); H.stepFrames(8);
        const b0 = H.getBurden().equip_load;
        a.pct_at_start = b0.pct; a.source_at_start = b0.source;
        try { a.willpower = H.setWillpower(80); } catch (e) { a.willpower_err = String(e && e.message || e); }
        try { a.skills = H.setMagicSkills ? H.setMagicSkills({ alteration: 100, mysticism: 100, restoration: 100, destruction: 100, illusion: 100, conjuration: 100 }) : null; } catch (e) { a.skills_err = String(e && e.message || e); }
        try { a.learn = H.learnSpell('burden'); } catch (e) { a.learn_err = String(e && e.message || e); }
        try { a.attune = H.setAttuned(['burden']); } catch (e) { a.attune_err = String(e && e.message || e); }
        try { a.magic_state = H.getMagicState ? H.getMagicState() : null; } catch (e) { /* optional */ }
        a.cast = H.castNow('burden');
        H.stepFrames(2);
        a.pct_after_cast = H.getBurden().equip_load.pct;
        a.offset_observed = +(a.pct_after_cast - a.pct_at_start).toFixed(6);
        // The producer's FIRST engagement in this scenario: put one piece of armour on.
        const q = cs().player.pos;
        H.spawnProp({ eid: 'r3-spell', name: 'shell-scale-hauberk', item: 'shell-scale-hauberk', pos: [q[0], q[1], q[2]] });
        H.takeProp('r3-spell'); H.equipItem('shell-scale-hauberk'); H.stepFrames(40);
        const b = H.getBurden().equip_load;
        a.equipped_weight = b.equipped_weight; a.equip_load_max = b.equip_load_max;
        a.pct_after_equip = b.pct;
        a.pct_expected_after_equip = +((b.equipped_weight / b.equip_load_max) * 100 + a.offset_observed).toFixed(6);
        a.the_spell_survived_the_equip = Math.abs(a.pct_after_equip - a.pct_expected_after_equip) < 1e-3;
      } catch (e) { a.err = String(e && e.message || e); }
      return a;
    };
    out.attempts.push(tryOn('default'));
    out.attempts.push(tryOn('arena_flat'));
    const landed = out.attempts.filter((a) => !a.err && a.offset_observed !== undefined && Math.abs(a.offset_observed) > 1e-6);
    out.cast_landed_on = landed.map((a) => a.state);
    out.coupled = landed.length > 0 && landed.every((a) => a.the_spell_survived_the_equip);
    out.note = landed.length ? null
      : 'The cast did not move the equip load in any state tried; the offset survival claim is '
        + 'demonstrated offline instead (tools/harness/w1-16-r3-reach.mjs R5, two arms).';
    return out;
  },
};

const out = { schema: 'elder-souls/w1-16-r3-live@1', unit: 'f@60 and metres', generated: new Date().toISOString(), probes: {} };
const dest = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-16', 'r3-live.json');
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
if (dead.length) process.exitCode = EXIT.HARNESS_ERROR || 1;
