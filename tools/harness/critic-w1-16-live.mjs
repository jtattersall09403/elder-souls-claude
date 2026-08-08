#!/usr/bin/env node
// critic-w1-16-live.mjs — W1-16 ROUND-2 CRITIC's stepping instrument. One browser, kept open.
// Written with fresh context; declared under `method_deviations` in the verdict.
//
// The builder's own probe (`tools/harness/prg-encumbrance.mjs`) is run separately and unmodified.
// This file asks the questions that probe does not:
//
//   L1  the anti-merge check, re-taken independently, with the WEAR arm on the same fixture so
//       "the pack does not move the roll" and "what you wear does" are one measurement.
//   L2  the ROLL LADDER by rolling at every cliff boundary in the running game — 29.99 / 30.00 /
//       30.01 / 69.99 / 70.00 / 70.01 / 99.99 / 100.00 / 100.01 — in f@60, against RI-CMB01 §B.
//   L3  TWO PARALLEL EQUIP MODELS. Equipping a weapon row lands it in the inventory `right` slot
//       and adds its carried.json weight to the equip ratio. It does NOT change the weapon the
//       fight swings (`combat.player.weaponId`), and the weapon the fight DOES swing carries a
//       shipped `equip_weight` in weapons/classes.json that reaches nothing. RULES.md #10.
//   L4  THE PIN, on every load path there is — named state, saveRoundTrip, writeSave/readSave,
//       exportSave/importSave, snapshot/restoreState — not only the one the round tested.
//   L5  delete-the-fix: both `__breakW116` arms run here too, and the teardown is checked for the
//       inert-control failure this project has shipped three times.
//   L6  setBurden's pin survives a stepping run, and a sprint denial survives past the frame the
//       button went down on.
//
// Units: every frame figure is f@60 (our fixed 60 Hz step). The RI-CMB01 §B reference is the
// S22 rebase of a Souls t@30 tick count; f@60 = 2 x t@30. A bare frame count is a defect (S22).
//
//   node tools/harness/critic-w1-16-live.mjs [--probe a,b,...] [--out path]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
critic-w1-16-live.mjs — W1-16 round-2 critic's stepping probes.
  --probe <names|all>   separation ladder parallel pin deletefix burden
  --out <path>          default reports/w1-16/critic-live.json
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ALL = ['separation', 'ladder', 'parallel', 'pin', 'deletefix', 'burden', 'spell', 'oversprint'];
const run = String(args.probe || 'all') === 'all' ? ALL : String(args.probe).split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'setEquipLoad', 'setBurden', 'getBurden', 'spawnProp', 'takeProp', 'getInventory', 'equipItem',
  'getPlayerStats', 'saveRoundTrip', 'writeSave', 'readSave', 'exportSave', 'importSave',
  'snapshot', 'restoreState', 'setLoadout', '__breakW116']);

const PROBES = {

  // =========================================================================================
  // L1 — THE ANTI-MERGE CHECK, both halves on one fixture.
  // RI-PRG07 method 3 and its "How we lose" #1. A bag of loot must leave the roll byte-identical;
  // the same weight WORN must move it. Either half alone proves nothing: a roll that never moves
  // is a dead model and passes the pack half trivially.
  // =========================================================================================
  separation() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const rollOnce = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      let runs = 0;
      for (let i = 0; i < iv.length; i++) if (i === 0 || iv[i] !== iv[i - 1] + 1) runs++;
      return {
        iframes_f60: iv.length,
        window_f60: iv.length ? [iv[0], iv[iv.length - 1]] : null,
        recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        total_f60: total, contiguous_runs: runs, tier: cs().player.tier,
      };
    };
    const snapshot = (label) => {
      const b = H.getBurden();
      return Object.assign({
        label,
        carried_weight_kg: b.equip_load.carried_weight,
        equipped_weight_kg: b.equip_load.equipped_weight,
        burden_ratio: b.ratio, burden_tier: b.tier,
        equip_load_pct: b.equip_load.pct, equip_load_source: b.equip_load.source,
        equip_load_max_kg: b.equip_load.equip_load_max, burden_divisor_kg: b.equip_load.burden_divisor,
      }, rollOnce());
    };
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    const p = cs().player.pos;
    const a = snapshot('A - empty pack, nothing worn');

    // 40 mauls IN THE PACK. Not worn.
    for (let i = 0; i < 40; i++) {
      H.spawnProp({ eid: `cw-sep-${i}`, name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [p[0], p[1], p[2]] });
      H.takeProp(`cw-sep-${i}`);
    }
    H.stepFrames(8);
    const b = snapshot('B - 460 kg in the pack, worn by nothing');

    // Now WEAR five pieces, from the same pack, on the same fixture.
    const worn = [];
    for (const it of ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash']) {
      const q = cs().player.pos;
      H.spawnProp({ eid: `cw-wear-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
      H.takeProp(`cw-wear-${it}`);
      H.equipItem(it);
      H.stepFrames(40);
      worn.push({ item: it, slot: (H.getInventory().find((r) => r.id === it) || {}).slot || null });
    }
    H.stepFrames(6);
    const c = snapshot('C - the same pack, five pieces now WORN');

    return {
      arms: [a, b, c],
      worn,
      pack_moved_burden: a.burden_ratio !== b.burden_ratio,
      pack_left_equip_load_alone: a.equip_load_pct === b.equip_load_pct,
      pack_left_the_roll_byte_identical: a.iframes_f60 === b.iframes_f60 && a.total_f60 === b.total_f60
        && a.recovery_f60 === b.recovery_f60 && a.tier === b.tier,
      wearing_moved_equip_load: b.equip_load_pct !== c.equip_load_pct,
      wearing_moved_the_roll: b.iframes_f60 !== c.iframes_f60 || b.recovery_f60 !== c.recovery_f60,
      // Both directions must hold, on the same fixture, or the check has not been made.
      coupled: a.burden_ratio !== b.burden_ratio && a.equip_load_pct === b.equip_load_pct
        && a.iframes_f60 === b.iframes_f60 && a.total_f60 === b.total_f60
        && b.equip_load_pct !== c.equip_load_pct
        && (b.iframes_f60 !== c.iframes_f60 || b.recovery_f60 !== c.recovery_f60),
    };
  },

  // =========================================================================================
  // L2 — THE LADDER, BY ROLLING, at every cliff. RI-CMB01 M5 and §B.
  // =========================================================================================
  ladder() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const rollAt = (pct) => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(pct); H.stepFrames(8);
      const before = cs().player.stamina;
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const spent = +(before - cs().player.stamina).toFixed(2);
      const iv = []; let f = 1, total = null;
      while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      let runs = 0;
      for (let i = 0; i < iv.length; i++) if (i === 0 || iv[i] !== iv[i - 1] + 1) runs++;
      return {
        pct, tier: cs().player.tier,
        startup_f60: iv.length ? iv[0] - 1 : null,
        iframes_f60: iv.length, window_f60: iv.length ? [iv[0], iv[iv.length - 1]] : null,
        recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        total_f60: total, contiguous_runs: runs, stamina_spent: spent,
      };
    };
    const rows = [15, 29.99, 30.00, 30.01, 50, 69.99, 70.00, 70.01, 85, 99.99, 100.00, 100.01, 120].map(rollAt);
    // RI-CMB01 §B, S22-rebased, and the t@30 figure the rebase doubled FROM.
    const REF_F60 = { LIGHT: { iframes: 26, recovery: 22, total: 52, stamina: 22, window: [5, 30], startup: 4 },
      MEDIUM: { iframes: 22, recovery: 34, total: 60, stamina: 26, window: [5, 26], startup: 4 },
      HEAVY: { iframes: 10, recovery: 72, total: 88, stamina: 34, window: [7, 16], startup: 6 },
      OVERLOADED: { iframes: 0, recovery: null, total: 120, stamina: 40, window: null, startup: null } };
    const REF_T30 = { LIGHT: { iframes: 13, total: 26 }, MEDIUM: { iframes: 11, total: 30 },
      HEAVY: { iframes: 5, total: 44 }, OVERLOADED: { iframes: 0, total: 60 } };
    const diffs = rows.map((r) => {
      const ref = REF_F60[r.tier];
      return {
        pct: r.pct, tier: r.tier,
        iframes_f60: [r.iframes_f60, ref.iframes], iframes_match: r.iframes_f60 === ref.iframes,
        total_f60: [r.total_f60, ref.total], total_match: r.total_f60 === ref.total,
        recovery_f60: [r.recovery_f60, ref.recovery],
        recovery_match: ref.recovery === null ? null : r.recovery_f60 === ref.recovery,
        stamina: [r.stamina_spent, ref.stamina], stamina_match: r.stamina_spent === ref.stamina,
        contiguous: r.contiguous_runs <= 1,
        // S22, stated on the row: our f@60 must be exactly twice the t@30 the corpus rebased from.
        t30_reference: REF_T30[r.tier],
        f60_is_2x_t30: r.iframes_f60 === 2 * REF_T30[r.tier].iframes && r.total_f60 === 2 * REF_T30[r.tier].total,
      };
    });
    const cliffs = [];
    for (let i = 1; i < rows.length; i++) if (rows[i].iframes_f60 !== rows[i - 1].iframes_f60 || rows[i].total_f60 !== rows[i - 1].total_f60)
      cliffs.push({ from_pct: rows[i - 1].pct, to_pct: rows[i].pct, iframes: [rows[i - 1].iframes_f60, rows[i].iframes_f60], total: [rows[i - 1].total_f60, rows[i].total_f60] });
    return {
      unit: 'f@60', conversion: 'f@60 = 2 x t@30 (ARBITRATION S22)',
      rows, diffs, cliffs,
      every_row_matches_RI_CMB01_B: diffs.every((d) => d.iframes_match && d.total_match && (d.recovery_match !== false) && d.stamina_match),
      every_row_is_2x_its_t30_reference: diffs.every((d) => d.f60_is_2x_t30),
      iframes_are_one_contiguous_run: diffs.every((d) => d.contiguous),
      cliffs_exactly_at_the_three_boundaries: cliffs.length === 3
        && cliffs[0].from_pct === 30 && cliffs[0].to_pct === 30.01
        && cliffs[1].from_pct === 70 && cliffs[1].to_pct === 70.01
        && cliffs[2].from_pct === 100 && cliffs[2].to_pct === 100.01,
      coupled: true,
    };
  },

  // =========================================================================================
  // L3 — TWO PARALLEL EQUIP MODELS (RULES.md #10).
  // =========================================================================================
  parallel() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    const before = { weapon: cs().player.weapon || null, weapon_id: cs().player.weapon_id || null,
      equip_load_pct: H.getBurden().equip_load.pct, equipped_weight: H.getBurden().equip_load.equipped_weight };
    const p = cs().player.pos;
    H.spawnProp({ eid: 'cw-par', name: 'bog-iron-maul', item: 'bog-iron-maul', pos: [p[0], p[1], p[2]] });
    H.takeProp('cw-par');
    H.equipItem('bog-iron-maul');
    H.stepFrames(40);
    const after = { weapon: cs().player.weapon || null, weapon_id: cs().player.weapon_id || null,
      inventory_right_slot: (H.getInventory().find((r) => r.slot === 'right') || {}).id || null,
      equip_load_pct: H.getBurden().equip_load.pct, equipped_weight: H.getBurden().equip_load.equipped_weight };

    // The other direction: swap the FIGHT's weapon for the heaviest class the game declares
    // (ultra greatsword, equip_weight 20 in weapons/classes.json) and read the ratio again.
    let swap = null, err = null;
    try {
      const r = H.setLoadout({ weapon: 'ultra-greatsword' });
      H.stepFrames(6);
      swap = { setLoadout: r, weapon_after: cs().player.weapon || null,
        equip_load_pct: H.getBurden().equip_load.pct, equipped_weight: H.getBurden().equip_load.equipped_weight };
    } catch (e) { err = String(e && e.message || e); }

    return {
      before, after, swap, swap_err: err,
      inventory_equip_changed_the_ratio: before.equip_load_pct !== after.equip_load_pct,
      inventory_equip_changed_the_weapon_the_fight_swings: before.weapon !== after.weapon,
      swapping_the_fight_weapon_changed_the_ratio: swap ? swap.equip_load_pct !== after.equip_load_pct : null,
      // Both must be TRUE for one equip model. Either false is two models.
      coupled: (before.equip_load_pct !== after.equip_load_pct)
        && (before.weapon !== after.weapon)
        && !!(swap && swap.equip_load_pct !== after.equip_load_pct),
    };
  },

  // =========================================================================================
  // L4 — THE PIN, on every load path. RULES.md #7.
  // `save/fight.js` always writes a number into `fight.loadout.equip_load_pct`, so any path that
  // rebuilds the fight from a save and does NOT clear `_equipLoadPinned` freezes the producer
  // forever, and the field re-serialises to exactly what was saved and passes forever.
  // =========================================================================================
  // NOTE ON `await`. `engine.readSave()` and `engine.writeSave()` are ASYNC (IndexedDB is), and
  // the harness verbs return the promise unchanged. A synchronous probe that calls them reads the
  // world back BEFORE the load has happened and records a pass for a load that never ran — which
  // is exactly the vacuous control this project has shipped three times. The first version of
  // this arm did that; it is async now, and the arm reports what each verb returned so a reader
  // can see the load actually completed.
  async pin() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const dress = () => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      // Take every hostile off the floor BEFORE the save. Not for tidiness: `save/fight.js`
      // `SKIP` does not list `ai`, so `saveActor(ctl)` serialises the live `SoulsAI` as a plain
      // object and `loadActor` assigns it back over the instance — after which the first fixed
      // step throws `this.ai.step is not a function` and no load path can be measured at all.
      // Recorded separately in `ai_after_load`; despawned here so the PIN question is answerable.
      try { for (const e of (H.listEntities() || [])) if (e.eid && e.eid !== 'P') H.despawn(e.eid); } catch (e) { /* reported below */ }
      H.stepFrames(2);
      for (const it of ['shell-scale-hauberk', 'legion-greaves']) {
        const q = cs().player.pos;
        H.spawnProp({ eid: `cw-pin-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
        H.takeProp(`cw-pin-${it}`); H.equipItem(it); H.stepFrames(40);
      }
      H.stepFrames(6);
      return H.getBurden().equip_load;
    };
    // Does the producer still RUN after the load? Not "is the number the same" — a pinned field
    // re-serialises to exactly what was saved. Take something off and see whether the load moves.
    const stillLive = () => {
      const inv = H.getInventory().find((r) => r.id === 'shell-scale-hauberk');
      const was = H.getBurden().equip_load.pct;
      H.equipItem('shell-scale-hauberk');   // toggle it OFF
      H.stepFrames(40);
      const now = H.getBurden().equip_load.pct;
      return { pct_before_undress: was, pct_after_undress: now, producer_still_running: was !== now,
        slot_after: (H.getInventory().find((r) => r.id === 'shell-scale-hauberk') || {}).slot || null,
        had_row: !!inv };
    };
    const rows = [];
    const safe = async (fn, tag) => { try { return { v: await fn() }; } catch (e) { return { err: `${tag}: ${String(e && e.message || e)}` }; } };

    // Every path is wrapped, because a load path that THROWS inside the fixed step is itself a
    // finding and must not take the other four arms down with it.
    const path = async (label, doTheLoad) => {
      const dressed = await safe(dress, 'dress');
      if (dressed.err) { rows.push({ path: label, err: dressed.err }); return; }
      const loaded = await safe(doTheLoad, 'load');
      const stepped = await safe(() => H.stepFrames(4), 'step-after-load');
      const b = await safe(() => H.getBurden().equip_load, 'getBurden');
      const live = (stepped.err || b.err) ? null : await safe(stillLive, 'undress');
      rows.push({
        path: label,
        err: loaded.err || stepped.err || b.err || (live && live.err) || null,
        load_returned: loaded.v === undefined ? null : loaded.v,
        pct_before: dressed.v.pct, pct_after: b.v ? b.v.pct : null,
        source_after: b.v ? b.v.source : null,
        live: live && live.v ? live.v : null,
      });
    };

    await path('loadState(<named state>)', () => null);
    await path('saveRoundTrip()', () => { const r = H.saveRoundTrip(); return { hash_equal: r.equal }; });
    await path('writeSave() -> readSave()', async () => { await H.writeSave('critic-w116'); return await H.readSave('critic-w116'); });
    await path('exportSave() -> importSave()', () => { const bytes = H.exportSave(); return H.importSave(bytes); });

    // And, separately: what the load path does to an enemy controller when one IS on the floor.
    let aiAfterLoad = null;
    try {
      H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(10);
      const ents = (H.listEntities() || []).filter((e) => e.eid && e.eid !== 'P').map((e) => e.eid);
      const rt = H.saveRoundTrip();
      let stepErr = null;
      try { H.stepFrames(4); } catch (e) { stepErr = String(e && e.message || e); }
      aiAfterLoad = { state: 'arena_duel', entities: ents, hash_equal: rt.equal, step_after_load_threw: stepErr };
    } catch (e) { aiAfterLoad = { err: String(e && e.message || e) }; }

    const reachable = rows.filter((r) => !r.err && r.live);
    return {
      rows,
      ai_after_load: aiAfterLoad,
      paths_tested: rows.length,
      paths_that_completed: reachable.length,
      every_completed_path_left_the_producer_running: reachable.every((r) => r.live.producer_still_running === true),
      pinned_after_a_load: rows.filter((r) => r.source_after && /pinned/.test(r.source_after)).map((r) => r.path),
      coupled: reachable.length > 0 && reachable.every((r) => r.live.producer_still_running === true),
    };
  },

  // =========================================================================================
  // L5 — DELETE-THE-FIX, re-run, and the TEARDOWN checked.
  // Three inert controls have shipped in this project and one of them ran the positive arm on
  // both sides. So: (i) confirm the flag is actually set and actually cleared; (ii) confirm the
  // cut arm reproduces the OLD number; (iii) confirm the two arms differ; (iv) confirm the arm
  // order does not decide the result, by running cut-first as well as fix-first.
  // =========================================================================================
  deletefix() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const roll = () => {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const iv = []; let f = 1, total = null;
      while (f < 400) { const c = cs(); if (c.player.invuln) iv.push(c.player.anim_frame); H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      return { iframes_f60: iv.length, recovery_f60: total !== null && iv.length ? total - iv[iv.length - 1] : total, total_f60: total, tier: cs().player.tier };
    };
    const arm = (broken) => {
      H.setSeed(1337); H.loadState('default');
      const set = H.__breakW116(broken);
      H.stepFrames(8);
      const before = Object.assign({ equip_load_pct: H.getBurden().equip_load.pct }, roll());
      for (const it of ['shell-scale-hauberk', 'legion-greaves', 'rootweave-cowl', 'wet-season-boots', 'silt-strider-silk-sash', 'bog-iron-maul']) {
        const q = cs().player.pos;
        H.spawnProp({ eid: `cw-df-${it}`, name: it, item: it, pos: [q[0], q[1], q[2]] });
        H.takeProp(`cw-df-${it}`); H.equipItem(it); H.stepFrames(40);
      }
      H.stepFrames(6);
      const b = H.getBurden();
      const after = Object.assign({ equip_load_pct: b.equip_load.pct, equipped_weight: b.equip_load.equipped_weight,
        equipped_rows: H.getInventory().filter((r) => r.slot).map((r) => `${r.id}@${r.slot}`).sort() }, roll());
      const cleared = H.__breakW116(null);
      return { broken: broken || 'none', switch_reported: set, switch_cleared: cleared, before, after,
        roll_moved: before.iframes_f60 !== after.iframes_f60 || before.recovery_f60 !== after.recovery_f60 };
    };
    // Cut FIRST, then the fix. If the arms only differ in this order and not the other, the
    // control is carrying state between arms rather than measuring the code.
    const cutFirst = arm('producer,slots');
    const fixAfter = arm(null);
    const fixFirst = arm(null);
    const cutAfter = arm('producer,slots');
    return {
      order_cut_then_fix: { cut: cutFirst, fix: fixAfter },
      order_fix_then_cut: { fix: fixFirst, cut: cutAfter },
      arms_differ_in_both_orders: cutFirst.roll_moved === false && fixAfter.roll_moved === true
        && fixFirst.roll_moved === true && cutAfter.roll_moved === false,
      old_number_returns: cutFirst.after.iframes_f60 === cutFirst.before.iframes_f60
        && cutAfter.after.iframes_f60 === cutAfter.before.iframes_f60,
      // The teardown: nothing may be nulled that the off-branch reads. `__breakW116` writes and
      // clears exactly one flag object, so both arms must report the flag they were given.
      switch_is_observable: !!(cutFirst.switch_reported && cutFirst.switch_reported.broken
        && cutFirst.switch_reported.broken.length === 2 && fixAfter.switch_reported.broken.length === 0),
      // Did the cut arm land armour in the sword hand, which is the pre-round-2 defect?
      cut_arm_slots: cutFirst.after.equipped_rows,
      fix_arm_slots: fixAfter.after.equipped_rows,
      coupled: cutFirst.roll_moved === false && fixAfter.roll_moved === true
        && fixFirst.roll_moved === true && cutAfter.roll_moved === false,
    };
  },

  // =========================================================================================
  // L7 — THE SPELL THE PRODUCER EATS.
  //
  // `_recomputeEquipLoad()`'s own header claims it "applies its result as a DELTA rather than an
  // assignment, so the feather effect's own additive offset survives untouched. An assignment
  // here would have silently deleted a spell." On the FIRST engagement after a scenario boundary
  // `_equipLoadBase` is null, so `prev` is read off the BODY — which already carries the spell's
  // offset — and the delta collapses to an assignment. `game/data/magic/spells.json` ships
  // Feather (magnitude 30) and Burden (magnitude 40); both are larger than the 30-point LIGHT
  // band, so either one decides a roll tier on its own.
  // =========================================================================================
  spell() {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const cs = () => H.getCombatState();

    // Which shipped states begin with NOTHING equipped? Those are the ones where the producer
    // has not engaged and the first equip is an assignment.
    const states = Object.keys((E && E.data && E.data.states) || {});
    const byState = [];
    for (const s of states) {
      try {
        H.setSeed(1337); H.loadState(s); H.stepFrames(8);
        const b = H.getBurden().equip_load;
        byState.push({ state: s, source: b.source, pct: b.pct });
      } catch (e) { byState.push({ state: s, err: String(e && e.message || e) }); }
    }
    const notEngaged = byState.filter((r) => r.source && /nothing is equipped yet/.test(r.source));

    // The demonstration, on a state the producer has not engaged in.
    const demo = (stateName) => {
      const out = { state: stateName };
      try {
        H.setSeed(1337); H.loadState(stateName); H.stepFrames(8);
        out.source_at_start = H.getBurden().equip_load.source;
        out.pct_at_start = H.getBurden().equip_load.pct;
        // Cast the shipped Burden spell (+40 points of equip load, 20 s). Attunement needs slots
        // (WILLPOWER) and the school skill, so both are raised first and the refusals reported.
        try { out.willpower = H.setWillpower(70); } catch (e) { out.willpower_err = String(e && e.message || e); }
        try { out.skills = H.setMagicSkills ? H.setMagicSkills({ alteration: 100, mysticism: 100, restoration: 100, destruction: 100, illusion: 100, conjuration: 100 }) : null; } catch (e) { out.skills_err = String(e && e.message || e); }
        try { out.learn = H.learnSpell('burden'); } catch (e) { out.learn_err = String(e && e.message || e); }
        try { out.attune = H.setAttuned(['burden']); } catch (e) { out.attune_err = String(e && e.message || e); }
        out.cast = H.castNow('burden');
        H.stepFrames(2);
        out.pct_after_cast = H.getBurden().equip_load.pct;
        out.tier_after_cast = H.getBurden().equip_load.tier;
        // Now put ONE piece of armour on — the producer's first engagement in this scenario.
        const q = cs().player.pos;
        H.spawnProp({ eid: 'cw-spell', name: 'shell-scale-hauberk', item: 'shell-scale-hauberk', pos: [q[0], q[1], q[2]] });
        H.takeProp('cw-spell'); H.equipItem('shell-scale-hauberk'); H.stepFrames(40);
        const b = H.getBurden().equip_load;
        out.equipped_weight = b.equipped_weight;
        out.equip_load_max = b.equip_load_max;
        out.pct_after_equip = b.pct;
        out.pct_expected_after_equip = +((b.equipped_weight / b.equip_load_max) * 100 + 40).toFixed(6);
        out.the_spell_survived_the_equip = Math.abs(out.pct_after_equip - out.pct_expected_after_equip) < 1e-3;
        // Let the spell run out (20 s = 1200 f@60) and read the load the armour alone should give.
        H.stepFrames(1400);
        const c = H.getBurden().equip_load;
        out.pct_after_expiry = c.pct;
        out.tier_after_expiry = c.tier;
        out.pct_expected_after_expiry = +((b.equipped_weight / b.equip_load_max) * 100).toFixed(6);
        out.tier_expected_after_expiry = c.boundaries_pct
          ? (out.pct_expected_after_expiry <= 30 ? 'LIGHT' : out.pct_expected_after_expiry <= 70 ? 'MEDIUM' : 'HEAVY') : null;
        out.load_correct_after_expiry = Math.abs(out.pct_after_expiry - out.pct_expected_after_expiry) < 1e-3;
      } catch (e) { out.err = String(e && e.message || e); }
      return out;
    };

    const rows = [];
    if (notEngaged.length) rows.push(demo(notEngaged[0].state));
    // And the control: a state where the producer HAS engaged before the cast. The delta
    // arithmetic is correct there, which is why this defect is invisible on `default`.
    rows.push(demo('default'));

    return {
      states_examined: byState.length,
      states_that_begin_with_nothing_equipped: notEngaged.map((r) => r.state),
      demonstrations: rows,
      claim_in_the_source: '_recomputeEquipLoad(): "applies its result as a DELTA ... so the feather effect\'s own additive offset survives untouched"',
      coupled: rows.every((r) => r.err || (r.the_spell_survived_the_equip && r.load_correct_after_expiry)),
    };
  },

  // =========================================================================================
  // L8 — RI-CMB01 §B: "`OVERLOADED` additionally forbids sprinting and jump-attacks."
  // The jump-attack half has a reader (combat/moveset.js: roll_tier === 'OVERLOADED' -> null).
  // The sprint half is not in the builder's census at all. This asks the entity.
  // =========================================================================================
  oversprint() {
    const H = window.__HARNESS;
    // The null control matters here: three identical numbers prove nothing if the sprint button
    // was doing nothing in ALL of them. Each tier is run with the button held and without it.
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
        metres_over_120_f60: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        stamina_spent: +(s0 - H.getCombatState().player.stamina).toFixed(2) };
    };
    const rows = [];
    for (const pct of [15, 85, 120]) { rows.push(runAt(pct, false)); rows.push(runAt(pct, true)); }
    const held = (p) => rows.find((r) => r.pct === p && r.sprint_held);
    const free = (p) => rows.find((r) => r.pct === p && !r.sprint_held);
    const sprintDoesSomething = held(15).metres_over_120_f60 > free(15).metres_over_120_f60 * 1.05;
    const overloadedStillSprints = held(120).metres_over_120_f60 > free(120).metres_over_120_f60 * 1.05;
    return {
      rows,
      ri_cmb01_b: 'OVERLOADED additionally forbids sprinting and jump-attacks.',
      jump_attack_half_has_a_reader: 'combat/moveset.js — ctx.roll_tier === "OVERLOADED" -> { slot: null, reason: "overloaded" }',
      the_sprint_button_does_something_at_LIGHT: sprintDoesSomething,
      an_OVERLOADED_player_still_sprints: overloadedStillSprints,
      every_tier_covers_the_same_ground_holding_sprint:
        held(15).metres_over_120_f60 === held(85).metres_over_120_f60
        && held(85).metres_over_120_f60 === held(120).metres_over_120_f60,
      coupled: sprintDoesSomething && !overloadedStillSprints,
    };
  },

  // =========================================================================================
  // L6 — setBurden's pin, and whether a sprint denial outlives the frame the button went down on.
  // Both are cross-piece claims this round makes in NEXT-DISPATCH.md §Q.
  // =========================================================================================
  burden() {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
    H.setBurden(0.95);
    const at0 = H.getBurden();
    H.stepFrames(180);
    const at180 = H.getBurden();

    // The sprint clause, tested the way it actually fails: hold the button from BEFORE the
    // denial and keep holding it through and past the transition. A denial read only at the
    // press gate expires on the next frame and the run continues.
    const walkRun = (ratio, holdThrough) => {
      H.setSeed(1337); H.loadState('default'); H.stepFrames(8);
      if (!holdThrough) H.setBurden(ratio);
      const p0 = H.getPlayerStats().pos.slice();
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 0, press: ['sprint'] }]);
      if (holdThrough) {
        // Press first, sprint for 40 frames, THEN become overladen while the button is still down.
        H.stepFrames(40);
        H.setBurden(ratio);
      }
      const pMid = H.getPlayerStats().pos.slice();
      H.stepFrames(140);
      const p1 = H.getPlayerStats().pos.slice();
      return {
        ratio, hold_through: holdThrough, tier: H.getBurden().tier,
        metres_after_the_transition: +Math.hypot(p1[0] - pMid[0], p1[2] - pMid[2]).toFixed(3),
        metres_total: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
        burden_source: H.getBurden().equip_load.burden_source,
        burden_observed: H.getBurden().ratio,
      };
    };
    const unbHold = walkRun(0.10, true);
    const ovHold = walkRun(0.95, true);
    const ovFresh = walkRun(0.95, false);

    return {
      pin: { set_to: 0.95, immediately: at0.ratio, after_180_f60: at180.ratio,
        source: at180.equip_load.burden_source, tier_after: at180.tier,
        pin_survived_the_stepping_run: Math.abs(at180.ratio - 0.95) < 1e-9 },
      sprint_denied_while_the_button_is_already_held: {
        unburdened_hold: unbHold, overladen_hold: ovHold, overladen_from_a_fresh_press: ovFresh,
        // The denial is real only if the OVERLADEN run covers materially less ground AFTER the
        // transition than the identical UNBURDENED run does.
        denial_outlives_the_press_frame: ovHold.metres_after_the_transition < unbHold.metres_after_the_transition * 0.7,
      },
      coupled: Math.abs(at180.ratio - 0.95) < 1e-9,
    };
  },
};

const out = { schema: 'elder-souls/critic-w1-16-live@1', unit: 'f@60', generated: new Date().toISOString(), probes: {} };
const dest = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-16', 'critic-live.json');
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
if (dead.length) { console.error(`UNCOUPLED: ${dead.join(', ')}`); process.exitCode = EXIT.HARNESS_ERROR; }
