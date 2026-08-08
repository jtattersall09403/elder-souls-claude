#!/usr/bin/env node
// prg-encumbrance.mjs — W1-16 round 2. DOES WHAT YOU CARRY REACH ANYTHING?
//
// This is a CONSUMPTION instrument (RI-MTH07 / ARBITRATION §3), not a second copy of the roll
// census. `tools/harness/cmb-probe.mjs --probe roll` already measures the RI-CMB01 §B ladder at
// all four tiers by SETTING the tier with `setEquipLoad()`, and that is the right instrument for
// "is the ladder implemented". It cannot answer the question this file exists for, because a
// probe that sets the model's input measures the model, not the world:
//
//     does anything a PLAYER does move the equip load, and does the burden the player is under
//     reach any entity at all?
//
// Round 1 of W1-16 found the answer was no for equip load — `combat.player.equipLoadPct` had
// three writers (a harness verb, a hardcoded 24.0, a feather spell) and no producer — and this
// round found the same for four of the six columns RI-PRG07 §3 publishes. Every arm below
// therefore drives the world (pick an object up, put it on, walk, board a barge) and reads an
// ENTITY-side observable back (an i-frame window, a stamina slope, metres travelled, frames of
// journey, a denied input), with the null control alongside it.
//
// UNITS. Every frame figure this file prints is `f@60` — frames of our fixed 60 Hz step. The
// RI-CMB01 §B reference it is diffed against was rebased from Souls' 1/30 s ticks under
// ARBITRATION seam S22 by doubling, and both numbers are printed side by side on every row so
// the conversion is visible rather than asserted. A bare frame count is a defect (S22).
//
//   node tools/harness/prg-encumbrance.mjs --probe equipload
//   node tools/harness/prg-encumbrance.mjs --probe regen
//   node tools/harness/prg-encumbrance.mjs --probe travel
//   node tools/harness/prg-encumbrance.mjs --probe road
//   node tools/harness/prg-encumbrance.mjs --probe separation
//   node tools/harness/prg-encumbrance.mjs --probe census
//   node tools/harness/prg-encumbrance.mjs --probe all
//
// It reports absence and exits non-zero (RULES.md #24): a probe whose perturbation moves the
// model and NOT the entity records `coupled: false` and fails the run.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
prg-encumbrance.mjs — W1-16 encumbrance and progression CONSUMPTION probes.

  --probe <name|all>   equipload regen travel road separation deletefix census
  --out <path>         write the JSON result here (default reports/w1-16/prg-encumbrance.json)
  --json               print the JSON instead of the summary
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const ALL = ['equipload', 'regen', 'travel', 'road', 'separation', 'deletefix', 'census'];
const run = which === 'all' ? ALL : which.split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'setEquipLoad', 'setBurden', 'getBurden', 'spawnProp', 'takeProp', 'getInventory', 'openMenu',
  'closeMenu', 'uiFocus', 'getPlayerStats', 'boardTravel', 'travelQuote', 'getTravelState',
  'equipItem', 'listEntities', 'aggro', '__breakW116']);

const PROBES = {

  // =========================================================================================
  // 1. THE PRODUCER. Pick armour up off the ground, put it on through the inventory screen,
  //    and watch the ROLL change. Two well-separated arms (nothing worn vs the heaviest legal
  //    set) plus the null control (the identical run with the equip step skipped).
  // =========================================================================================
  equipload() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { arms: [], note: 'i-frames and recovery are f@60. The RI-CMB01 §B reference beside them is the S22-rebased figure (Souls t@30 x 2).' };

    // Drive one roll and read the invulnerable run straight off the body, frame by frame.
    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(1);
      const before = cs();
      H.stepFrames(1);
      const s1 = cs();
      const iv = [];
      if (s1.player.invuln) iv.push(s1.player.anim_frame);
      let f = 1, total = null;
      while (f < 300) {
        H.stepFrames(1); f++;
        const c = cs();
        if (c.player.invuln) iv.push(c.player.anim_frame);
        if (!c.player.move) { total = f - 1; break; }
      }
      let runs = 0;
      for (let i = 0; i < iv.length; i++) if (i === 0 || iv[i] !== iv[i - 1] + 1) runs++;
      return {
        startup_f60: iv.length ? iv[0] - 1 : null,
        iframes_f60: iv.length,
        iframe_window_f60: iv.length ? [iv[0], iv[iv.length - 1]] : null,
        recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        total_f60: total,
        contiguous_runs: runs,
        stamina_cost: +(before.player.stamina - s1.player.stamina).toFixed(2),
      };
    };

    // Put an object on the ground where the player is standing, pick it up, wear it.
    // `equipItem()` writes `UISystem`'s own equip queue — the same one pressing interact on the
    // row writes — so the 30-frame commitment and `_finishEquipCommit()` are both exercised.
    // The `menu_path` arm below drives the actual cursor once, so the player path is proved too.
    const wear = (item, i) => {
      const p = cs().player.pos;
      H.spawnProp({ eid: `w116-${i}`, name: item, item, pos: [p[0], p[1], p[2]] });
      H.takeProp(`w116-${i}`);
      H.equipItem(item);
      H.stepFrames(40);
      return (H.getInventory().find((r) => r.id === item) || {}).slot != null;
    };

    // `default` does NOT declare `loadout.equip_load_pct`, so it is one of the states where the
    // world is allowed to answer. Every arena state pins it and is deliberately untouched.
    const arm = (label, items) => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(6);
      const worn = [];
      items.forEach((it, i) => { worn.push({ item: it, equipped: wear(it, i) }); });
      H.stepFrames(4);
      const b = H.getBurden();
      const row = Object.assign({
        label,
        worn,
        equipped_rows: H.getInventory().filter((r) => r.slot).map((r) => `${r.id}@${r.slot}`).sort(),
        equipped_weight: b.equip_load.equipped_weight,
        equip_load_max: b.equip_load.equip_load_max,
        equip_load_pct: b.equip_load.pct,
        tier: b.equip_load.tier,
        source: b.equip_load.source,
        // The other ratio, on the same frame, so a merge of the two is visible immediately.
        burden_ratio: b.ratio, burden_tier: b.tier, carried_weight: b.equip_load.carried_weight,
      }, rollOnce());
      return row;
    };

    R.arms.push(arm('A — nothing worn but the starting knife', []));
    R.arms.push(arm('B — the heaviest set the shipped item shelf can wear', [
      'shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots',
      'silt-strider-silk-sash', 'bog-iron-maul',
    ]));

    // THE PLAYER PATH, once, end to end: open the pack, walk the cursor onto the row, press
    // interact, close the pack, let the 30-frame commitment run. If this arm does not equip, the
    // arms above measured a door nobody can open.
    (() => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(6);
      const p = cs().player.pos;
      H.spawnProp({ eid: 'w116-menu', name: 'chitin-cuirass', item: 'chitin-cuirass', pos: [p[0], p[1], p[2]] });
      H.takeProp('w116-menu');
      const tried = [];
      let landed = false;
      for (let row = 0; row < 24 && !landed; row++) {
        let mode = null;
        try {
          mode = H.openMenu('inventory').mode;
          H.uiFocus({ col: 1, rowIdx: row });
          H.queueInputs([{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]);
          H.stepFrames(2);
          H.closeMenu();
          H.stepFrames(40);
          landed = (H.getInventory().find((r) => r.id === 'chitin-cuirass') || {}).slot != null;
          tried.push({ row, mode, landed });
        } catch (e) { tried.push({ row, mode, err: String(e && e.message || e) }); break; }
      }
      R.menu_path = {
        equipped_through_the_real_cursor: landed,
        slot: (H.getInventory().find((r) => r.id === 'chitin-cuirass') || {}).slot || null,
        equip_load_pct: H.getBurden().equip_load.pct,
        attempts: tried,
      };
    })();

    const a = R.arms[0], b = R.arms[1];
    R.perturbation = {
      model_moved: a.equip_load_pct !== b.equip_load_pct,
      model_delta_pct: +(b.equip_load_pct - a.equip_load_pct).toFixed(3),
      tier_moved: a.tier !== b.tier,
      entity_moved: a.iframes_f60 !== b.iframes_f60 || a.recovery_f60 !== b.recovery_f60,
      iframes_f60: [a.iframes_f60, b.iframes_f60],
      recovery_f60: [a.recovery_f60, b.recovery_f60],
      // RI-CMB01 §B, S22-rebased. LIGHT 26 i-frames / 22 recovery; MEDIUM 22 / 34.
      reference_f60: { LIGHT: { iframes: 26, recovery: 22 }, MEDIUM: { iframes: 22, recovery: 34 },
        HEAVY: { iframes: 10, recovery: 72 }, OVERLOADED: { iframes: 0, recovery: null } },
      reference_t30: { LIGHT: { iframes: 13, recovery: 11 }, MEDIUM: { iframes: 11, recovery: 17 },
        HEAVY: { iframes: 5, recovery: 36 }, OVERLOADED: { iframes: 0, recovery: null } },
      conversion: 'f@60 = 2 x t@30 (ARBITRATION S22: Souls community frame data is quoted in 1/30 s ticks; our step is 1/60 s).',
    };
    R.coupled = R.perturbation.model_moved && R.perturbation.entity_moved;
    return R;
  },

  // =========================================================================================
  // 2. STAMINA RECOVERY vs ENCUMBRANCE. `combat/rules.js regenStamina()` multiplies the regen
  //    rate by the tier. Measured as a SLOPE over real frames, not read off the constant.
  // =========================================================================================
  regen() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { unit: 'stamina per f@60', rows: [] };
    for (const [tier, load] of [['LIGHT', 15], ['MEDIUM', 50], ['HEAVY', 85], ['OVERLOADED', 120]]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(load); H.stepFrames(10);
      const s0 = cs().player.stamina;
      // One roll, to spend and to arm the regen delay.
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }, { f: 5, move: [0, 0] }]);
      H.stepFrames(2);
      const afterSpend = cs().player.stamina;
      const series = [];
      for (let i = 0; i < 200; i++) { H.stepFrames(1); series.push(+cs().player.stamina.toFixed(4)); }
      // The first frame on which the bar moves at all, and the slope over the ten frames after.
      let first = null;
      for (let i = 1; i < series.length; i++) if (series[i] > series[i - 1] + 1e-9) { first = i + 1; break; }
      let slope = null;
      if (first !== null && first + 12 < series.length) {
        const a = series[first + 1], b = series[first + 11];
        slope = +((b - a) / 10).toFixed(4);
      }
      R.rows.push({
        tier, load_pct: load,
        observed_tier: cs().player.tier,
        stamina_before: +s0.toFixed(2), stamina_after_spend: +afterSpend.toFixed(2),
        roll_cost: +(s0 - afterSpend).toFixed(2),
        first_regen_frame_after_spend_f60: first,
        regen_per_frame_observed: slope,
      });
    }
    const base = R.rows[0].regen_per_frame_observed;
    R.multipliers_observed = R.rows.map((r) => ({ tier: r.tier, x: base ? +(r.regen_per_frame_observed / base).toFixed(3) : null }));
    R.multipliers_declared = { LIGHT: 1.0, MEDIUM: 1.0, HEAVY: 0.8, OVERLOADED: 0.6 };
    R.delay_declared_f60 = 42;
    R.delay_note = 'RI-CMB03 is DELIBERATELY EXCLUDED from the S22 rebase: its 42 f@60 pause was derived from 0.70 s and was already right. Do not double it.';
    R.coupled = new Set(R.rows.map((r) => r.regen_per_frame_observed)).size > 1;
    return R;
  },

  // =========================================================================================
  // 3. TRAVEL ON THE ROAD. RI-PRG07 §3's `Travel-time modifier` column, which before this round
  //    was computed, reported by getBurden() and read by nothing at all.
  // =========================================================================================
  travel() {
    const H = window.__HARNESS;
    const R = { rows: [], note: 'Same service, same fare, three burdens. Frames are f@60; game_min is world minutes.' };
    const net = H.getTravelNetwork();
    if (!net.present) return { __absent: 'game/data/world/travel/ is not in this build', coupled: false };
    // The cheapest service whose road leg the probe can open without walking it: pick the first
    // and force the gate, because this probe is about the RIDE, not about the walked-it-once gate.
    const svc = net.services.slice().sort((a, b) => a.route_m - b.route_m)[0];
    for (const [label, ratio] of [['UNBURDENED', 0.10], ['LADEN', 0.75], ['OVERLADEN', 0.95]]) {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(4);
      H.setBurden(ratio);
      const b = H.getBurden();
      let ride = null, err = null;
      try {
        // Open the fare gate the same way for every arm, so the only thing that differs is weight.
        H.setGold(9999);
        const eng = window.__ENGINE;
        if (eng && eng.travel) { eng.travel.walked.set(svc.requires_walked, 1e9); eng.travel.legLen.set(svc.requires_walked, 1); }
        const tod0 = H.getEnvironment ? H.getEnvironment().timeOfDay : null;
        ride = H.boardTravel(svc.id, {});
        const tod1 = H.getEnvironment ? H.getEnvironment().timeOfDay : null;
        ride.tod_before = tod0; ride.tod_after = tod1;
      } catch (e) { err = String(e && e.message || e); }
      R.rows.push({
        label, burden_ratio: ratio, burden_tier: b.tier,
        travel_time_mult_declared: b.travel_time_mult,
        service: svc.id, route_m: svc.route_m,
        frames_f60: ride ? ride.frames : null,
        game_min: ride ? ride.game_min : null,
        game_min_scheduled: ride ? ride.game_min_scheduled : null,
        gold_spent: ride ? ride.gold_spent : null,
        err,
      });
    }
    const f = R.rows.map((r) => r.frames_f60);
    const g = R.rows.map((r) => r.game_min);
    R.perturbation = {
      frames_f60: f, game_min: g,
      fare_unchanged: new Set(R.rows.map((r) => r.gold_spent)).size === 1,
      entity_moved: new Set(f.filter((x) => x !== null)).size > 1,
    };
    R.coupled = R.perturbation.entity_moved;
    return R;
  },

  // =========================================================================================
  // 4. THE ROAD ITSELF. Burden -> walking speed, and burden -> a DENIED sprint, and the AR-1
  //    guard that both must be exactly inert inside a fight.
  // =========================================================================================
  road() {
    const H = window.__HARNESS;
    const R = { rows: [], unit: 'metres over 180 f@60' };
    const walk = (ratio, sprint) => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      H.setBurden(ratio);
      const p0 = H.getPlayerStats().pos.slice();
      const inputs = [{ f: 0, move: [0, 1] }];
      if (sprint) inputs.push({ f: 0, press: ['sprint'] });
      H.queueInputs(inputs);
      H.stepFrames(180);
      const p1 = H.getPlayerStats().pos.slice();
      const b = H.getBurden();
      return {
        burden_ratio: ratio, tier: b.tier, sprint_held: sprint,
        burden_source: b.equip_load.burden_source,
        burden_ratio_observed: b.ratio,
        deny_sprint: (H.getTraversalReport && (() => { try { return H.getTraversalReport().denies; } catch (e) { return null; } })()) || null,
        move_mult_declared: b.move_mult_declared, move_mult_applied: b.move_mult_applied,
        sprint_allowed_declared: b.sprint,
        metres: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        in_combat: b.in_combat,
      };
    };
    // Discard one run first. The very first walk after a browser start covers less ground than
    // every identical run after it (6.386 m against 8.640 m at the same tier, measured), which
    // is a warm-up artefact of the instrument and not a property of burden — and it is exactly
    // the kind of thing that turns into a headline number if the first arm happens to be the
    // control. RULES.md #8's cousin: the fixture must not be the finding.
    R.warmup_discarded = walk(0.10, false);
    for (const r of [0.10, 0.75, 0.95]) { R.rows.push(walk(r, false)); R.rows.push(walk(r, true)); }
    const un = R.rows.find((r) => r.tier === 'UNBURDENED' && r.sprint_held);
    const ov = R.rows.find((r) => r.tier === 'OVERLADEN' && r.sprint_held);
    R.perturbation = {
      walk_metres_by_tier: R.rows.filter((r) => !r.sprint_held).map((r) => [r.tier, r.metres]),
      // A denied sprint means the OVERLADEN sprint arm covers no more ground than the OVERLADEN
      // walk arm — the button did nothing. Comparing it to the UNBURDENED sprint instead would
      // pass on a mere slowdown, which is the silent degradation S25 forbids.
      sprint_denied_when_overladen: (() => {
        const ow = R.rows.find((r) => r.tier === 'OVERLADEN' && !r.sprint_held);
        return !!(ov && ow && Math.abs(ov.metres - ow.metres) < 0.05);
      })(),
      overladen_walk_vs_sprint_m: (() => {
        const ow = R.rows.find((r) => r.tier === 'OVERLADEN' && !r.sprint_held);
        return [ow ? ow.metres : null, ov ? ov.metres : null];
      })(),
      sprint_metres: [un ? un.metres : null, ov ? ov.metres : null],
    };
    // AR-1 GUARD (RI-PRG07 §3, and an automatic fail of the piece if it goes): with a fight
    // live, every burden column must read its Unburdened value.
    H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(4);
    H.setBurden(0.95);
    // A fight needs a hostile. Whatever the duel state put on the floor, wake it.
    let woke = null;
    try {
      const ents = (H.listEntities() || []).filter((e) => e.eid && e.eid !== 'P');
      if (ents.length) { H.aggro(ents[0].eid); woke = ents[0].eid; }
    } catch (e) { woke = `ERR ${String(e && e.message || e)}`; }
    H.stepFrames(30);
    const g = H.getBurden();
    R.ar1_guard = {
      woke: woke,
      in_combat: g.in_combat,
      move_mult_applied: g.move_mult_applied,
      sprint: g.sprint,
      fatigue_drain_mult: g.fatigue_drain_mult,
      sneak_detection_mult: g.sneak_detection_mult,
      travel_time_mult: g.travel_time_mult,
      // A guard that never entered a fight has not been tested. `inconclusive`, not `passes`.
      tested: !!g.in_combat,
      passes: g.in_combat && (g.move_mult_applied === 1 && g.sprint === true
        && g.fatigue_drain_mult === 1 && g.sneak_detection_mult === 1 && g.travel_time_mult === 1),
    };
    R.coupled = new Set(R.rows.filter((r) => !r.sprint_held).map((r) => r.metres)).size > 1;
    return R;
  },

  // =========================================================================================
  // 5. THE ANTI-MERGE CHECK. RI-PRG07 method 3, and the item's own "How we lose" #1: a bag full
  //    of loot must leave the roll BYTE-IDENTICAL. This is the check that fails if someone ever
  //    "simplifies" the two ratios into one, and it is the reason `_recomputeEquipLoad()` reads
  //    `slot` rather than the whole pack.
  // =========================================================================================
  separation() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 300) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      return { iframes_f60: iv.length, total_f60: total, tier: cs().player.tier };
    };
    const arm = (label, load) => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(6);
      if (load) {
        const p = cs().player.pos;
        // 200 kg of loot, in the pack, worn by nothing.
        for (let i = 0; i < 40; i++) {
          H.spawnProp({ eid: `sep-${i}`, name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [p[0], p[1], p[2]] });
          H.takeProp(`sep-${i}`);
        }
      }
      H.stepFrames(6);
      const b = H.getBurden();
      return Object.assign({
        label,
        carried_weight: b.equip_load.carried_weight, burden_ratio: b.ratio, burden_tier: b.tier,
        equipped_weight: b.equip_load.equipped_weight, equip_load_pct: b.equip_load.pct,
      }, rollOnce());
    };
    const a = arm('empty pack', false);
    const b = arm('460 kg of mauls in the pack, none of them worn', true);
    return {
      arms: [a, b],
      burden_moved: a.burden_ratio !== b.burden_ratio,
      equip_load_unchanged: a.equip_load_pct === b.equip_load_pct,
      roll_byte_identical: a.iframes_f60 === b.iframes_f60 && a.total_f60 === b.total_f60 && a.tier === b.tier,
      // Both must hold. Either alone is a different defect: burden that does not move is a dead
      // model, and a roll that moves with the pack is the AR-1 merge.
      coupled: a.burden_ratio !== b.burden_ratio && a.equip_load_pct === b.equip_load_pct
        && a.iframes_f60 === b.iframes_f60 && a.total_f60 === b.total_f60,
    };
  },

  // =========================================================================================
  // 6. DELETE-THE-FIX (RULES.md #6), on the two most load-bearing claims this round makes:
  //    (a) equipping armour changes the roll, and (b) what you carry changes the journey.
  //    `__breakW116()` restores the exact pre-round-2 behaviour in the same browser, so the old
  //    number has to come back and the two arms have to genuinely differ. An inert fix has
  //    passed this project twice; this is the arm that catches one.
  // =========================================================================================
  deletefix() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { claims: [] };

    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 300) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      return { iframes_f60: iv.length, recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total, total_f60: total, tier: cs().player.tier };
    };

    const wear = (item, i) => {
      const p = cs().player.pos;
      H.spawnProp({ eid: `df-${i}`, name: item, item, pos: [p[0], p[1], p[2]] });
      H.takeProp(`df-${i}`);
      H.equipItem(item);
      H.stepFrames(40);
      return (H.getInventory().find((r) => r.id === item) || {}).slot != null;
    };

    // ---- CLAIM A: equipping armour changes the roll ---------------------------------------
    const armourArm = (broken) => {
      H.setSeed(1337); H.loadState('default'); H.__breakW116(broken); H.stepFrames(6);
      const before = Object.assign({ equip_load_pct: H.getBurden().equip_load.pct }, rollOnce());
      H.setSeed(1337); H.loadState('default'); H.__breakW116(broken); H.stepFrames(6);
      const set = ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash', 'bog-iron-maul'];
      const worn = set.map((it, i) => ({ item: it, equipped: wear(it, i) }));
      H.stepFrames(4);
      const b = H.getBurden();
      const after = Object.assign({ equip_load_pct: b.equip_load.pct, equipped_weight: b.equip_load.equipped_weight,
        equipped_rows: H.getInventory().filter((r) => r.slot).map((r) => `${r.id}@${r.slot}`).sort() }, rollOnce());
      H.__breakW116(null);
      return { broken: broken || 'none', worn, before, after,
        moved: before.equip_load_pct !== after.equip_load_pct,
        roll_moved: before.iframes_f60 !== after.iframes_f60 || before.recovery_f60 !== after.recovery_f60 };
    };
    const aFix = armourArm(null);
    const aCut = armourArm('producer,slots');
    R.claims.push({
      claim: 'A — putting armour on changes the i-frame window and the recovery of the roll',
      with_fix: aFix, fix_deleted: aCut,
      // The old NUMBER is the roll — the i-frame window and the recovery. `equip_load_pct` in the
      // cut arm falls back to the hardcoded 24.0 the producer used to leave it at, which is the
      // pre-fix value and not a movement of the entity.
      old_number_returns: !aCut.roll_moved && aCut.before.tier === aCut.after.tier,
      arms_differ: aFix.roll_moved && !aCut.roll_moved,
      // The exact figures, so a reader does not have to trust the booleans.
      iframes_f60: { with_fix: [aFix.before.iframes_f60, aFix.after.iframes_f60], fix_deleted: [aCut.before.iframes_f60, aCut.after.iframes_f60] },
      recovery_f60: { with_fix: [aFix.before.recovery_f60, aFix.after.recovery_f60], fix_deleted: [aCut.before.recovery_f60, aCut.after.recovery_f60] },
      equip_load_pct: { with_fix: [aFix.before.equip_load_pct, aFix.after.equip_load_pct], fix_deleted: [aCut.before.equip_load_pct, aCut.after.equip_load_pct] },
    });

    // ---- CLAIM B: what you carry changes the journey --------------------------------------
    const net = H.getTravelNetwork();
    if (net.present) {
      const svc = net.services.slice().sort((x, y) => x.route_m - y.route_m)[0];
      const rideArm = (broken, ratio) => {
        H.setSeed(1337); H.loadState('default'); H.stepFrames(4);
        H.__breakW116(broken);
        H.setBurden(ratio); H.setGold(9999);
        const eng = window.__ENGINE;
        if (eng && eng.travel) { eng.travel.walked.set(svc.requires_walked, 1e9); eng.travel.legLen.set(svc.requires_walked, 1); }
        let r = null, err = null;
        try { r = H.boardTravel(svc.id, {}); } catch (e) { err = String(e && e.message || e); }
        H.__breakW116(null);
        return { broken: broken || 'none', burden: ratio, tier: H.getBurden().tier,
          frames_f60: r ? r.frames : null, game_min: r ? r.game_min : null, err };
      };
      const bFixLight = rideArm(null, 0.10), bFixHeavy = rideArm(null, 0.95);
      const bCutLight = rideArm('travel', 0.10), bCutHeavy = rideArm('travel', 0.95);
      R.claims.push({
        claim: 'B — the same barge takes longer, in frames and in world minutes, when you are Overladen',
        with_fix: [bFixLight, bFixHeavy], fix_deleted: [bCutLight, bCutHeavy],
        old_number_returns: bCutLight.frames_f60 === bCutHeavy.frames_f60,
        arms_differ: bFixLight.frames_f60 !== bFixHeavy.frames_f60 && bCutLight.frames_f60 === bCutHeavy.frames_f60,
        frames_f60: { with_fix: [bFixLight.frames_f60, bFixHeavy.frames_f60], fix_deleted: [bCutLight.frames_f60, bCutHeavy.frames_f60] },
        game_min: { with_fix: [bFixLight.game_min, bFixHeavy.game_min], fix_deleted: [bCutLight.game_min, bCutHeavy.game_min] },
      });
    } else {
      R.claims.push({ claim: 'B', __absent: 'no travel network in this build' });
    }

    R.coupled = R.claims.every((c) => c.arms_differ === true && c.old_number_returns === true);
    return R;
  },

  // =========================================================================================
  // 7. THE CENSUS. Every parameter both models publish, and the world-side reader that acts on
  //    it — or `null`, which is the finding.
  // =========================================================================================
  census() {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('default'); H.stepFrames(6);
    const b = H.getBurden();
    const stats = H.getPlayerStats();
    const derived = H.getDerivedStats ? H.getDerivedStats() : null;
    const prog = H.getCharacter ? H.getCharacter() : null;
    const rows = [];
    const put = (model, param, reader) => rows.push({ model, param, reader, has_reader: !!reader });

    // --- RI-CMB01 §B, the in-fight ladder (equip load) ---
    put('equip_load', 'tier_boundaries_pct', 'combat/moves.js equipTier()');
    put('equip_load', 'roll.iframes', 'combat/player.js roll -> the invulnerable frame window');
    put('equip_load', 'roll.recovery', 'combat/player.js roll -> actionable frame');
    put('equip_load', 'roll.total', 'combat/player.js roll');
    put('equip_load', 'roll.stamina', 'combat/rules.js spendStamina()');
    put('equip_load', 'roll.distance_m', 'combat root motion');
    put('equip_load', 'roll.anim_speed', 'combat/moves.js move table');
    put('equip_load', 'backstep.*', 'combat/player.js backstep');
    put('equip_load', 'equipLoadPct (the INPUT)', 'engine._recomputeEquipLoad() <- inventory rows with a slot (W1-16 r2)');
    put('equip_load', 'regen.multipliers.equip_load_over_70pct', 'combat/rules.js regenStamina()');
    put('equip_load', 'regen.multipliers.overloaded', 'combat/rules.js regenStamina()');

    // --- RI-PRG07 §3, the out-of-fight ladder (burden) ---
    put('burden', 'burdenRatio (the INPUT)', 'engine._recomputeBurden() <- every inventory row');
    put('burden', 'move', 'engine._burdenMult() -> sim/traversal.js step()');
    put('burden', 'sprint', 'engine -> sim.player.denySprint -> sim/player.js gate (W1-16 r2)');
    put('burden', 'travel_time', 'engine.boardTravel() -> ride frames + world clock (W1-16 r2)');
    put('burden', 'fatigue', null);
    put('burden', 'sneak', null);
    put('burden', 'jump', null);

    // --- RI-PRG07 §2 fall-damage column, which no combat item states ---
    put('equip_load', 'fall_damage_mult (RI-PRG07 §2)', null);

    // --- progression: souls, levels, attributes, gold ---
    put('progression', 'soulsHeld', 'engine._spendSouls() at the level-up screen');
    put('progression', 'soulsToNextLevel (the curve)', 'engine._spendSouls() cost gate + UI');
    put('progression', 'level', 'engine.soulsToNextLevel() (the curve reads it back)');
    put('progression', 'attributes.* -> derivePools', 'character/derive.js -> hp/stamina/focus/equip_load_max');
    put('progression', 'equip_load_max (STR curve)', 'engine._equipLoadMax() -> BOTH ratios (W1-16 r2 for equip load)');
    put('progression', 'gold', 'engine._setGold()/_gold() -> fares, bribes, fencing, the drawn purse');
    put('progression', 'skills.*', 'magic tier gate, merchant pricing, stealth gates');

    return {
      rows,
      unread: rows.filter((r) => !r.has_reader).map((r) => `${r.model}.${r.param}`),
      unread_count: rows.filter((r) => !r.has_reader).length,
      total: rows.length,
      // The live values, so the census is a census of a running world and not of a source tree.
      live: {
        burden: { ratio: b.ratio, tier: b.tier, carried_weight: b.equip_load.carried_weight },
        equip_load: b.equip_load,
        burden_consumers: b.burden_consumers,
        equip_load_consumers: b.equip_load_consumers,
        level: prog && prog.progression ? prog.progression.level : null,
        souls_held: prog && prog.progression ? prog.progression.soulsHeld : null,
        equip_load_max: derived ? derived.equip_load_max : null,
        stamina_max: stats ? stats.stamina_max : null,
      },
      coupled: rows.filter((r) => !r.has_reader).length === 0,
    };
  },
};

const out = { schema: 'elder-souls/prg-encumbrance@1', unit: 'f@60', generated: new Date().toISOString(), probes: {} };
const dest = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'reports', 'w1-16', 'prg-encumbrance.json');
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

// A probe that cannot fail is worse than no probe (RULES.md #4). `coupled: false` anywhere is a
// non-zero exit, because a model with no demonstrated consumer is `unmeasurable => 0` under
// RI-MTH07 and must not read as a pass.
const dead = Object.entries(out.probes).filter(([, v]) => v && v.coupled === false).map(([k]) => k);
out.uncoupled_probes = dead;
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
if (dead.length) {
  console.error(`UNCOUPLED: ${dead.join(', ')} — the model moved and no entity did.`);
  process.exitCode = EXIT.HARNESS_ERROR;
}

if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(`written: ${path.relative(REPO_ROOT, dest)}\n`);
