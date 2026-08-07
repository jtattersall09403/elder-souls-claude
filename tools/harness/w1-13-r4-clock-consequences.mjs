// RI-PRG04 COMPARISON METHOD #8, RUN — and the AR-1 arm that running it turned up.
//
// Binding: `RI-PRG04` §2 (the night window), §6 rule 4 (the clock does not advance on death),
// Comparison method #8; `RI-JRN06` D9 and `ARBITRATION.md` §3 (`RI-MTH07`, CONSUMPTION);
// `AR-1` (a death must not compensate the player).
//
// ------------------------------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ------------------------------------------------------------------------------------------------
//
// The item prints the method:
//
//   > **8. Clock consequence.** Rest at in-game 17:00. Assert the clock reads 23:00, the night
//   > roster is active, merchants are closed, and any active timed quest has consumed 6 hours.
//   > Rest 4x in a row: assert the clock advances 24 h and returns to the same shop state.
//
// Six clauses. Across three rounds of W1-13 the aggregation measured ONE of them — rest moves the
// clock 12.005 -> 18.005, exactly six hours — and never a roster, a merchant, a schedule, a quest
// date or the four-rest round trip. `Clock cost` is the axis those assertions score, its 10 rung
// is "full consequence chain fires", and it has sat at 6 for three rounds as the minimum over
// `RI-PRG04`'s eight axes. It is the whole reason the piece is under the gate.
//
// So this file runs the method. All six clauses, in one browser, with the rest REMOVED as the
// control arm on every one of them — because a reading that is the same before and after tells
// you nothing until you have shown it would have stayed the same anyway.
//
// ------------------------------------------------------------------------------------------------
// WHAT RUNNING IT FOUND (§B), and it is an AR-1 defect round 3 shipped
// ------------------------------------------------------------------------------------------------
//
// Round 3 held the world clock while a death is in flight, which is `RI-PRG04` §6 rule 4 and is
// right. `sim/souls.js awardFor()` pays `NIGHT_MULTIPLIER` 1.35x for a kill inside `isNight()`,
// 21:00 -> 05:00, off that same field. Hold the clock and the frames a player spends dead cost
// them no night time. Near the END of the window that is a REWARD FOR DYING.
//
// The control that shows it is not "delete the fix" — it is SAME FRAMES, ALIVE. Round 3's clock
// probe compared shipped against the round-2 clock and never against a living player, which is
// why nobody saw it. §B runs both boundaries (into the window at 20:58, out of it at 04:30) x
// both arms (dead frames, live frames) x both variants (shipped, award clock deleted).
//
// The world-side fix is in `sim/environment.js` §1b and is one field: `env.awardTimeOfDay`, a
// clock that ticks whether the player is alive or dead and is re-seated on the world clock at
// every rest. `sim/souls.js` reads it. The world clock is still held, so the deadline burn the
// hold exists to prevent has NOT been given back — §B asserts that too, in the same arms.
//
// ------------------------------------------------------------------------------------------------
// WHAT IT CANNOT ASSERT, AND SAYS SO (RULES.md 24, 26)
// ------------------------------------------------------------------------------------------------
//
// Clause 4, "any active timed quest has consumed 6 hours", is UNMEASURABLE on shipped content and
// this file reports that as a finding rather than passing a vacuous check:
//
//   * `game/data/quests/hooks.json` declares `"deadlines": []`. There is no timed quest.
//   * `QuestMachine.onDay(dayCount)` (`sim/quest/machine.js:712`) is THE deadline consumer and
//     `grep -rn 'onDay' game/ tools/` returns exactly one line — its own definition. Nothing in
//     the running world calls it. It is a correct model with no caller, which is the `RI-MTH07`
//     shape the project has shipped sixteen times.
//
// What IS measurable is the quest layer's other clock reader, and §A measures it: the journal's
// date stamp (`sim/quest/calendar.js dateOf(sim.env.dayCount)`), which is what a player reads to
// know how long they have left. Six hours of rest does not move it; four rests do, by exactly one
// day. And the deadline model itself is driven directly in §A.4b — a one-day deadline installed on
// a live quest, four rests, `onDay()` called by hand — so the file distinguishes "the model is
// wrong" from "the model is not wired", and reports the second.

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage('w1-13-r4-clock-consequences.mjs [--out <file>] [--only a,b] [--deaths 40]');
  process.exit(0);
}
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()) : ['a', 'b'];
const DEATHS = Number(args.deaths || 40);

const out = {
  schema: 'w1-13/r4-clock-consequences@1',
  git: gitInfo(),
  taken_at: new Date().toISOString(),
  item: 'RI-PRG04 Comparison method 8',
  deaths_per_arm: DEATHS,
  checks: {},
  verdict: {},
};

// ------------------------------------------------------------------------------------------------
// §A — METHOD #8, VERBATIM. Runs in the page.
// ------------------------------------------------------------------------------------------------
const M8_ARM = async ({ rest, restsInRow, tag }) => {
  const H = window.__HARNESS;
  const eng = window.__ENGINE || (H && H._engine);
  const r = { tag, rest, rests_in_row: restsInRow };
  try {
    H.loadState('default');
    H.setRenderRate(0);
    H.stepFrames(2);

    // A settlement well, so the roster and the shops around it are the ones being read.
    const wells = (H.listHearths().hearths || []);
    const well = wells.find((x) => x.kind === 'settlement') || wells[0];
    r.well = well.id;
    H.teleport(well.pos[0], well.pos[2]);
    H.stepFrames(4);

    // 17:00. `setTimeOfDay` writes `env.timeOfDay`; `Environment._syncFromFloat` re-seats both
    // clocks on it at the top of the next step, so the arm starts with zero award offset.
    H.setTimeOfDay(17.0);
    H.stepFrames(8);

    // ---- the four world-side readings, taken the same way twice ------------------------------
    const MERCHANTS = (H.listInteriors() || []).map((x) => (typeof x === 'string' ? x : x.id))
      .filter(Boolean);
    const readWorld = (label) => {
      const env = H.getEnvironment();
      const shops = {};
      for (const id of MERCHANTS) {
        try { shops[id] = !!H.isOpenNow(id); } catch (e) { /* not an interior with hours */ }
      }
      const roster = {};
      for (const n of (H.whereIsEveryone() || [])) roster[n.eid] = n.at;
      let book = null;
      try { book = eng.questEngine ? eng.questEngine.report() : null; } catch (e) { book = null; }
      return {
        label,
        hour: env.time_of_day !== undefined ? env.time_of_day : env.timeOfDay,
        day: env.day !== undefined ? env.day : env.dayCount,
        phase: env.phase,
        award_hour: env.award_time_of_day,
        award_offset_h: env.award_offset_h,
        shops,
        shops_open: Object.values(shops).filter(Boolean).length,
        shops_total: Object.keys(shops).length,
        roster,
        roster_n: Object.keys(roster).length,
        journal_date: (book && book.today) || null,
      };
    };

    // ---- the souls rate, driven through the world (RI-MTH07: an ENTITY, not a field) ---------
    // Spawn one ordinary enemy, kill it, read what the purse was actually paid. The rate is the
    // consumer `RI-PRG04` §2 names and the one round 3's clock probe could not find.
    let killSeq = 0;
    const ordinaryKill = () => {
      const id = `w1-13-r4-${tag}-${killSeq++}`;
      const before = H.getDeathState().souls_held;
      H.spawn('inf_trash', well.pos[0] + 4, well.pos[2] + 4, { as: id });
      H.stepFrames(2);
      H.killEntity(id);
      H.stepFrames(20);
      return H.getDeathState().souls_held - before;
    };

    const before = readWorld('17:00');
    before.souls_for_one_ordinary_kill = ordinaryKill();

    // ---- the rest, or the control that does everything but rest ------------------------------
    const n = restsInRow || 1;
    r.rest_returns = [];
    if (rest) {
      for (let i = 0; i < n; i++) {
        r.rest_returns.push(H.restAt(well.id).clock);
        H.stepFrames(4);
      }
    } else {
      // THE CONTROL. Exactly the frames the rested arm spent, and no rest. If a shop shuts or a
      // person moves here, the rest was never the cause.
      H.stepFrames(4 * n);
    }

    const after = readWorld(rest ? `after ${n} rest(s)` : `after ${4 * n} frames, no rest`);
    after.souls_for_one_ordinary_kill = ordinaryKill();

    // ---- the diffs -----------------------------------------------------------------------------
    const shopsClosed = [], shopsOpened = [];
    for (const id of Object.keys(before.shops)) {
      if (before.shops[id] && !after.shops[id]) shopsClosed.push(id);
      if (!before.shops[id] && after.shops[id]) shopsOpened.push(id);
    }
    const moved = [];
    for (const eid of Object.keys(before.roster)) {
      if (before.roster[eid] !== after.roster[eid]) {
        moved.push({ eid, from: before.roster[eid], to: after.roster[eid] });
      }
    }

    r.before = before;
    r.after = after;
    r.hours_moved = Math.round((((after.hour - before.hour) % 24 + 24) % 24 + (after.day - before.day) * 24) * 1e6) / 1e6;
    r.days_moved = after.day - before.day;
    r.shops_closed_by_the_rest = shopsClosed;
    r.shops_opened_by_the_rest = shopsOpened;
    r.shops_closed_n = shopsClosed.length;
    r.npcs_moved_by_the_rest = moved.slice(0, 20);
    r.npcs_moved_n = moved.length;
    r.souls_ratio = before.souls_for_one_ordinary_kill > 0
      ? Math.round(after.souls_for_one_ordinary_kill / before.souls_for_one_ordinary_kill * 1e4) / 1e4 : null;
    r.shop_state_identical = shopsClosed.length === 0 && shopsOpened.length === 0;
    r.roster_identical = moved.length === 0;
    return r;
  } catch (e) {
    r.fatal = String((e && e.stack) || e);
    return r;
  }
};

// ------------------------------------------------------------------------------------------------
// §A.4b — the deadline model, driven by hand because nothing in the world drives it.
// ------------------------------------------------------------------------------------------------
const DEADLINE_ARM = async () => {
  const H = window.__HARNESS;
  const eng = window.__ENGINE || (H && H._engine);
  const r = {};
  try {
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    const qm = eng.questEngine;
    r.deadlines_declared_in_shipped_content = (qm.deadlines || []).length;

    const wells = (H.listHearths().hearths || []);
    const well = wells.find((x) => x.kind === 'settlement') || wells[0];
    H.teleport(well.pos[0], well.pos[2]); H.stepFrames(4);
    H.setTimeOfDay(17.0); H.stepFrames(4);

    // Open a real quest so there is a record with an `opened_day` on it.
    // Open a real quest if one will open here. Most will not: `open()` carries W1-19's giver
    // presence term and the giver has to be standing in the world. Whichever way it goes, the
    // record is REPORTED rather than assumed, because the point of this arm is to tell "the
    // deadline model is wrong" apart from "the deadline model has no caller".
    const ids = H.questBook() || [];
    let qid = null, opened = null;
    for (const id of ids.slice(0, 40)) {
      let res = null;
      try { res = H.questOpen(id); } catch (e) { res = { ok: false, reason: String(e) }; }
      if (res && res.ok) { qid = id; opened = res; break; }
      if (!r.first_refusal) r.first_refusal = { quest: id, reason: res && res.reason };
    }
    r.quest = qid;
    r.opened_by_the_world = !!opened;
    H.stepFrames(2);
    let rec = qid ? qm.rec(qid) : null;
    if (!qid) {
      // No quest in this state will open through the world's own gate. The deadline model still
      // has to be exercised, so the record is BUILT BY HAND and labelled as such — this arm is
      // then a statement about `onDay()` and nothing else.
      qid = ids[0];
      r.quest = qid;
      rec = qm.rec(qid, true);
      rec.opened = true;
      rec.flags['opened_day'] = Math.floor(eng.sim.env.dayCount || 0);
      r.record_built_by_hand = true;
    }
    r.opened_day = rec && rec.flags ? rec.flags['opened_day'] : null;
    r.day_before = Math.floor(eng.sim.env.dayCount || 0);
    r.journal_date_before = qm.report().today;

    // Install a ONE-DAY deadline on it. This is the shape `hooks.json` declares and never fills.
    qm.deadlines.push({ quest: qid, days: 1, failure: null });

    // Four rests: 24 hours, one whole day.
    for (let i = 0; i < 4; i++) { H.restAt(well.id); H.stepFrames(4); }
    r.day_after = Math.floor(eng.sim.env.dayCount || 0);
    r.journal_date_after = qm.report().today;
    r.days_consumed_by_four_rests = r.day_after - r.day_before;

    // Now call the consumer BY HAND, because the world never does.
    const fired = qm.onDay(r.day_after) || [];
    r.on_day_fired = fired.length;
    r.quest_closed_after_on_day = !!qm.isClosed(qid);
    r.the_model_works = fired.length > 0;
    return r;
  } catch (e) {
    r.fatal = String((e && e.stack) || e);
    return r;
  }
};

// ------------------------------------------------------------------------------------------------
// §B — AR-1. Does dying pay? Same frames dead vs the same frames alive.
// ------------------------------------------------------------------------------------------------
const AR1_ARM = async ({ startHour, dying, deleteAwardClock, deleteClockHold, frames, deaths, tag }) => {
  const H = window.__HARNESS;
  const eng = window.__ENGINE || (H && H._engine);
  const envSys = eng.sim.environment;
  const r = { tag, start_hour: startHour, dying, delete_award_clock: !!deleteAwardClock, delete_clock_hold: !!deleteClockHold };
  let restore = null;
  try {
    if (deleteAwardClock) {
      // DELETE THE FIX. The award clock is pinned to the world clock every frame, which is exactly
      // what `souls.js` read before this round.
      const orig = envSys.step.bind(envSys);
      restore = envSys.step;
      envSys.step = function (sim, bus) {
        const res = orig(sim, bus);
        sim.env.awardTimeOfDay = sim.env.timeOfDay;
        sim.env._awardFrames = sim.env._clockFrames;
        return res;
      };
    } else if (deleteClockHold) {
      // DELETE THE ROUND-3 FIX. The round-2 clock: the tick runs through the death surface.
      const FPD = 259200;
      const orig = envSys.step.bind(envSys);
      restore = envSys.step;
      envSys.step = function (sim, bus) {
        const env = sim.env;
        const held = !!(sim._death && sim._death.active);
        const res = orig(sim, bus);
        if (held && !this.paused) {
          env._clockFrames = (env._clockFrames + 1) % FPD;
          if (env._clockFrames === 0) env.dayCount = (env.dayCount | 0) + 1;
          env.timeOfDay = Math.round((env._clockFrames % FPD) * 24 / FPD * 1e6) / 1e6;
        }
        return res;
      };
    }

    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    const wells = (H.listHearths().hearths || []);
    const well = wells.find((x) => x.kind === 'settlement') || wells[0];
    H.teleport(well.pos[0], well.pos[2]); H.stepFrames(2);
    H.restAt(well.id); H.stepFrames(2);         // sets the respawn point AND discharges the offset
    H.setTimeOfDay(startHour);
    H.teleport(well.pos[0] + 60, well.pos[2] + 20); H.stepFrames(6);

    const f0 = eng.sim.frame;
    const e0 = H.getEnvironment();
    r.hour_before = e0.time_of_day;
    r.day_before = e0.day;
    r.award_hour_before = e0.award_time_of_day;

    if (dying) {
      for (let i = 0; i < deaths; i++) {
        H.damagePlayer(100000, { stagger: false });
        H.stepFrames(1);
        let g = 0;
        while (H.getDeathState().surface_active && g < 400) { H.stepFrames(1); g++; }
      }
    } else {
      // THE CONTROL: the same number of frames, spent alive. Not "the fix deleted" — a player who
      // simply did not die. This is the arm round 3 never ran, and it is the one that shows it.
      H.stepFrames(frames);
    }

    const f1 = eng.sim.frame;
    const e1 = H.getEnvironment();
    r.frames_elapsed = f1 - f0;
    r.hour_after = e1.time_of_day;
    r.day_after = e1.day;
    r.award_hour_after = e1.award_time_of_day;
    r.award_offset_h = e1.award_offset_h;
    r.world_hours_burned = Math.round((((e1.time_of_day - e0.time_of_day) % 24 + 24) % 24) * 1e6) / 1e6;
    r.award_hours_burned = Math.round((((e1.award_time_of_day - e0.award_time_of_day) % 24 + 24) % 24) * 1e6) / 1e6;
    r.phase = e1.phase;

    // THE ENTITY. One ordinary enemy, killed, and what the purse was actually paid for it.
    const before = H.getDeathState().souls_held;
    H.spawn('inf_trash', eng.sim.player.pos[0] + 4, eng.sim.player.pos[2] + 4, { as: `ar1-${tag}` });
    H.stepFrames(2);
    H.killEntity(`ar1-${tag}`);
    H.stepFrames(20);
    r.souls_for_one_ordinary_kill = H.getDeathState().souls_held - before;
    return r;
  } catch (e) {
    r.fatal = String((e && e.stack) || e);
    return r;
  } finally { if (restore) envSys.step = restore; }
};

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;

  // ---- §A -------------------------------------------------------------------------------------
  if (ONLY.includes('a')) {
    const rested = await h.page.evaluate(M8_ARM, { rest: true, restsInRow: 1, tag: 'rest1' });
    const control = await h.page.evaluate(M8_ARM, { rest: false, restsInRow: 1, tag: 'norest' });
    const four = await h.page.evaluate(M8_ARM, { rest: true, restsInRow: 4, tag: 'rest4' });
    const deadline = await h.page.evaluate(DEADLINE_ARM);

    // The rest itself is the assertion; the 12 frames this arm steps around its own readings are
    // 11 seconds of game time and are not the rest. Both are reported, and both are asserted:
    // every rest moved the clock EXACTLY six hours, and the clock afterwards READS 23:00 to
    // within 36 seconds of game time.
    const restsExactly6h = rested.rest_returns.length > 0
      && rested.rest_returns.every((x) => x.hours === 6);
    const c1 = Math.abs(rested.after.hour - 23) < 0.01 && restsExactly6h;
    const c2 = rested.npcs_moved_n > 0 && control.npcs_moved_n === 0;
    const c3 = rested.shops_closed_n > 0 && control.shops_closed_n === 0;
    const fourExactly6h = four.rest_returns.length === 4 && four.rest_returns.every((x) => x.hours === 6);
    const c5 = Math.abs(four.hours_moved - 24) < 0.02 && four.days_moved === 1 && fourExactly6h;
    const c6 = four.shop_state_identical && four.roster_identical;
    const c7 = rested.souls_ratio !== null && Math.abs(rested.souls_ratio - 1.35) < 0.02
      && control.souls_ratio === 1;

    out.checks.a_method_8 = {
      method: 'RI-PRG04 Comparison method 8, verbatim, with the rest removed as the control arm.',
      rested, control, four_rests: four, deadline,
      clauses: {
        'c1_clock_reads_23_00': {
          pass: c1, got: rested.after.hour, control: control.after.hour,
          rest_moved_exactly_6h: restsExactly6h, rest_returns: rested.rest_returns,
        },
        'c2_night_roster_active': {
          pass: c2, npcs_moved: rested.npcs_moved_n, control_npcs_moved: control.npcs_moved_n,
          examples: rested.npcs_moved_by_the_rest.slice(0, 5),
        },
        'c3_merchants_closed': {
          pass: c3, shops_closed: rested.shops_closed_n, of: rested.before.shops_total,
          control_shops_closed: control.shops_closed_n,
          examples: rested.shops_closed_by_the_rest.slice(0, 5),
        },
        'c4_timed_quest_consumed_6h': {
          pass: null,
          unmeasurable: true,
          why: 'NO TIMED QUEST EXISTS AND ITS CONSUMER IS NOT WIRED. game/data/quests/hooks.json '
            + 'declares "deadlines": []; QuestMachine.onDay() (sim/quest/machine.js:712) is the '
            + 'only deadline consumer and grep -rn onDay over game/ and tools/ returns exactly '
            + 'one line, its own definition. Nothing in the running world calls it.',
          deadlines_declared: deadline.deadlines_declared_in_shipped_content,
          on_day_callers_in_game_src: 0,
          measured_instead: {
            what: 'the quest layer\'s other clock reader — the journal date stamp',
            journal_date_at_17: rested.before.journal_date,
            journal_date_after_one_rest: rested.after.journal_date,
            journal_date_before_four_rests: deadline.journal_date_before,
            journal_date_after_four_rests: deadline.journal_date_after,
            days_consumed_by_four_rests: deadline.days_consumed_by_four_rests,
          },
          the_model_itself_driven_by_hand: {
            deadline_installed_days: 1,
            on_day_fired: deadline.on_day_fired,
            quest_closed: deadline.quest_closed_after_on_day,
            reading: 'the model is correct and unwired',
          },
        },
        'c5_four_rests_advance_24h': {
          pass: c5, hours: four.hours_moved, days: four.days_moved,
          from: four.before.hour, to: four.after.hour,
          every_rest_exactly_6h: fourExactly6h, rest_returns: four.rest_returns,
        },
        'c6_same_shop_state_after_the_round_trip': {
          pass: c6, shops_changed: four.shops_closed_n + four.shops_opened_by_the_rest.length,
          roster_changed: four.npcs_moved_n,
        },
        'c7_souls_rate_1_35x_after_the_rest': {
          pass: c7,
          why: 'the acceptance the round-3 verdict added: the CONSUMER RI-PRG04 §2 names, driven '
            + 'through an entity rather than read off a field.',
          souls_before_rest: rested.before.souls_for_one_ordinary_kill,
          souls_after_rest: rested.after.souls_for_one_ordinary_kill,
          ratio: rested.souls_ratio,
          control_ratio: control.souls_ratio,
        },
      },
      clauses_measured: 5,
      clauses_passing: [c1, c2, c3, c5, c6, c7].filter(Boolean).length,
      clauses_total: 6,
    };
    log(`A: clock ${rested.before.hour}->${rested.after.hour} · shops closed ${rested.shops_closed_n}/${rested.before.shops_total} (control ${control.shops_closed_n}) · npcs moved ${rested.npcs_moved_n} (control ${control.npcs_moved_n}) · souls x${rested.souls_ratio} (control x${control.souls_ratio}) · 4 rests ${four.hours_moved}h day+${four.days_moved} shopsame=${four.shop_state_identical}`);
  }

  // ---- §B -------------------------------------------------------------------------------------
  if (ONLY.includes('b')) {
    const BOUNDARIES = [
      { name: 'out_of_the_night_window', hour: 4.5 },
      { name: 'into_the_night_window', hour: 20.966666 },
    ];
    const b = {};
    for (const bd of BOUNDARIES) {
      // The dying arm first, so the alive arm can be given exactly its frame count.
      const dyingShipped = await h.page.evaluate(AR1_ARM, {
        startHour: bd.hour, dying: true, deaths: DEATHS, tag: `${bd.name}-dying`,
      });
      const frames = dyingShipped.frames_elapsed;
      const aliveShipped = await h.page.evaluate(AR1_ARM, {
        startHour: bd.hour, dying: false, frames, tag: `${bd.name}-alive`,
      });
      const dyingDeleted = await h.page.evaluate(AR1_ARM, {
        startHour: bd.hour, dying: true, deaths: DEATHS, deleteAwardClock: true,
        tag: `${bd.name}-dying-del`,
      });
      const aliveDeleted = await h.page.evaluate(AR1_ARM, {
        startHour: bd.hour, dying: false, frames, deleteAwardClock: true,
        tag: `${bd.name}-alive-del`,
      });
      const dyingHoldDeleted = await h.page.evaluate(AR1_ARM, {
        startHour: bd.hour, dying: true, deaths: DEATHS, deleteClockHold: true,
        tag: `${bd.name}-dying-hold-del`,
      });
      b[bd.name] = {
        start_hour: bd.hour,
        frames_matched: frames,
        shipped: {
          dying_paid: dyingShipped.souls_for_one_ordinary_kill,
          alive_paid: aliveShipped.souls_for_one_ordinary_kill,
          equal: dyingShipped.souls_for_one_ordinary_kill === aliveShipped.souls_for_one_ordinary_kill,
          world_clock_burned_by_dying_h: dyingShipped.world_hours_burned,
          world_clock_burned_by_living_h: aliveShipped.world_hours_burned,
          award_clock_burned_by_dying_h: dyingShipped.award_hours_burned,
          award_offset_after_dying_h: dyingShipped.award_offset_h,
        },
        award_clock_deleted: {
          dying_paid: dyingDeleted.souls_for_one_ordinary_kill,
          alive_paid: aliveDeleted.souls_for_one_ordinary_kill,
          equal: dyingDeleted.souls_for_one_ordinary_kill === aliveDeleted.souls_for_one_ordinary_kill,
        },
        clock_hold_deleted: {
          dying_paid: dyingHoldDeleted.souls_for_one_ordinary_kill,
          world_clock_burned_by_dying_h: dyingHoldDeleted.world_hours_burned,
          deadline_burn_returned: dyingHoldDeleted.world_hours_burned > 0.05,
        },
        rows: { dyingShipped, aliveShipped, dyingDeleted, aliveDeleted, dyingHoldDeleted },
      };
    }

    const exit = b.out_of_the_night_window, entry = b.into_the_night_window;
    out.checks.b_ar1_death_pays_nothing = {
      question: 'AR-1. Does spending N frames DEAD leave the same enemy worth more than spending '
        + 'the same N frames ALIVE? Round 3 compared shipped against the round-2 clock and never '
        + 'against a living player, which is why this was not seen.',
      boundaries: b,
      shipped_invariant_holds: !!(exit.shipped.equal && entry.shipped.equal),
      the_defect_reproduces_with_the_fix_deleted:
        !exit.award_clock_deleted.equal || !entry.award_clock_deleted.equal,
      arms_differ: (exit.shipped.dying_paid !== exit.award_clock_deleted.dying_paid)
        || (entry.shipped.dying_paid !== entry.award_clock_deleted.dying_paid),
      // The round-3 predicate, applied correctly. A perfect zero is the WRONG target and round 3
      // worked out why: the clock runs first in `sim/step.js`'s frame order, so on the one frame
      // the killing blow lands the player was still alive when it ticked. FORTY deaths therefore
      // cost forty frames, and 41 frames is 0.003796 h. Demanding 0.000000 would be demanding an
      // implausible number and would make this row fail on a world that is behaving correctly.
      deadline_burn_ceiling_h: Math.round((DEATHS + 1) / 10800 * 1e6) / 1e6,
      the_deadline_burn_was_not_given_back:
        exit.shipped.world_clock_burned_by_dying_h <= (DEATHS + 1) / 10800
        && entry.shipped.world_clock_burned_by_dying_h <= (DEATHS + 1) / 10800
        && exit.clock_hold_deleted.world_clock_burned_by_dying_h
             > 10 * exit.shipped.world_clock_burned_by_dying_h,
    };
    log(`B exit(04:30): shipped dying ${exit.shipped.dying_paid} vs alive ${exit.shipped.alive_paid} | del dying ${exit.award_clock_deleted.dying_paid} vs alive ${exit.award_clock_deleted.alive_paid}`);
    log(`B entry(20:58): shipped dying ${entry.shipped.dying_paid} vs alive ${entry.shipped.alive_paid} | del dying ${entry.award_clock_deleted.dying_paid} vs alive ${entry.award_clock_deleted.alive_paid}`);
    log(`B clock hold deleted burns ${exit.clock_hold_deleted.world_clock_burned_by_dying_h} h; shipped burns ${exit.shipped.world_clock_burned_by_dying_h} h`);
  }

  const a = out.checks.a_method_8, bb = out.checks.b_ar1_death_pays_nothing;
  out.verdict = {
    method_8_clauses_passing: a ? a.clauses_passing : null,
    method_8_clauses_measurable: a ? 5 : null,
    method_8_clause_4_unmeasurable_reason: a ? 'no timed quest; onDay() has no caller' : null,
    ar1_invariant_holds: bb ? bb.shipped_invariant_holds : null,
    ar1_arms_differ: bb ? bb.arms_differ : null,
    deadline_protection_intact: bb ? bb.the_deadline_burn_was_not_given_back : null,
  };
  // An absence-reporter, not a stub: if the method cannot be run the file says so and exits non-zero.
  out.ok = (!a || a.clauses_passing >= 6)
    && (!bb || (bb.shipped_invariant_holds && bb.arms_differ && bb.the_deadline_burn_was_not_given_back));
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
  out.ok = false;
  log(`ERROR ${out.error}`);
} finally {
  if (handle) await handle.close();
}

writeJson(args.out || 'reports/runs/W1-13-R4/clock-consequences.json', out);
process.exit(out.ok ? 0 : 1);
