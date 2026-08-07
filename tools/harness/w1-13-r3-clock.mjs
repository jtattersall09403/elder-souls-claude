/**
 * w1-13-r3-clock.mjs — RI-PRG04 §6 rule 4, and the delete-the-fix arm for it.
 *
 *   > **The clock does NOT advance on death.** Only resting moves time. Dying repeatedly at a
 *   > boss must not burn a quest deadline.
 *
 * The W1-13 round-3 aggregation is what caught this, and no standalone probe in three rounds
 * did: `m_d4_across_death_diff` came back with exactly ONE non-volatile path changed across a
 * death — `clock.time_of_day`, 15.000741 -> 15.019352 — and `m_d10_d11_preserved` failed on the
 * same field for the same reason. 0.018611 h is 201 frames at `FRAMES_PER_DAY = 259200`, which
 * is the whole measured window, the 150 dead frames included.
 *
 * FOUR ARMS, one browser:
 *
 *   A1 shipped        die, step to the respawn frame, read the clock at both ends.
 *                     TARGET: the delta is EXACTLY 0.
 *   A2 live control   the same number of frames from the same save WITHOUT dying.
 *                     TARGET: the delta is > 0. If it is not, A1's zero is a stopped clock and
 *                     proves nothing — this is the arm that makes the instrument able to fail.
 *   A3 DELETE THE FIX `Environment.step` is monkeypatched back to the unconditional tick.
 *                     TARGET: A1's delta returns to A2's, to the digit. If A3 == A1 the change
 *                     is INERT and this file says so instead of claiming the pass.
 *   A4 consumption    RI-MTH07: name the world-side consumer and move it. The clock is what
 *                     `sim/settlement.js#isOpen` locks a door on and what `sim/npc.js#slotAt`
 *                     picks a schedule slot from. Die 40 times at 20:58 with the hold in place
 *                     and with it deleted, and read the world's own phase/hour back: the held
 *                     world is still in the same hour, the unheld one has walked into the next.
 *
 * Usage:
 *   node tools/harness/w1-13-r3-clock.mjs [--out <file>] [--deaths 40]
 */
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r3-clock.mjs [--out <file>] [--deaths <n>]'); process.exit(0); }

const DEATHS = Number(args.deaths || 40);

const out = {
  schema: 'w1-13/r3-clock@1',
  rule: 'RI-PRG04 §6 rule 4 — "The clock does NOT advance on death. Only resting moves time. '
    + 'Dying repeatedly at a boss must not burn a quest deadline."',
  frames_per_day: 259200,
  arms: {},
};

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;

  const run = async (deleteTheFix) => h.page.evaluate(async ({ del, deaths }) => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE || (H && H._engine);
    const envSys = eng.sim.environment;
    let restore = null;
    if (del) {
      // THE FIX, REMOVED: the clock ticks every frame again, death or no death. Patched on the
      // instance rather than in the file, so the two arms are the same build and the same
      // browser and differ in exactly one branch.
      const FPD = 259200;
      const orig = envSys.step.bind(envSys);
      restore = envSys.step;
      envSys.step = function (sim, bus) {
        const env = sim.env;
        const held = !!(sim._death && sim._death.active);
        const r = orig(sim, bus);
        if (held && !this.paused) {
          env._clockFrames = (env._clockFrames + 1) % FPD;
          if (env._clockFrames === 0) env.dayCount = (env.dayCount | 0) + 1;
          env.timeOfDay = Math.round((env._clockFrames % FPD) * 24 / FPD * 1e6) / 1e6;
        }
        return r;
      };
    }
    try {
      H.loadState('default'); H.setRenderRate(0);
      const wells = H.listHearths().hearths || [];
      const well = wells.find((x) => x.kind === 'settlement') || wells[0];
      H.teleport(well.pos[0], well.pos[2]); H.stepFrames(2);
      H.restAt(well.id); H.stepFrames(2);
      H.setTimeOfDay(20.966666);              // 20:58, two minutes off the hour
      H.teleport(well.pos[0] + 60, well.pos[2] + 20); H.stepFrames(6);

      const base = H.saveState();

      // ---- A1: across the dead interval ----
      H.damagePlayer(100000, { stagger: false });
      H.stepFrames(1);
      const atDeath = eng.sim.env.timeOfDay;
      let deadFrames = 0;
      while (H.getDeathState().surface_active && deadFrames < 400) { H.stepFrames(1); deadFrames++; }
      const atRespawn = eng.sim.env.timeOfDay;

      // ---- A2: the same frames, alive ----
      H.restoreState(base); H.stepFrames(2);
      const liveA = eng.sim.env.timeOfDay;
      H.stepFrames(deadFrames);
      const liveB = eng.sim.env.timeOfDay;

      // ---- A4: the consumer. N deaths in a row from 20:58. ----
      H.restoreState(base); H.stepFrames(2);
      const hourBefore = eng.sim.env.timeOfDay;
      const phaseBefore = H.getEnvironment().phase;
      let totalDead = 0;
      for (let i = 0; i < deaths; i++) {
        H.damagePlayer(100000, { stagger: false });
        H.stepFrames(1);
        let g = 0;
        while (H.getDeathState().surface_active && g < 400) { H.stepFrames(1); g++; }
        totalDead += g + 1;
      }
      const envAfter = H.getEnvironment();
      const anyOpen = (() => {
        // A door the clock decides. Read from the world, not recomputed here.
        try { const s = H.getWorldStats(); return s && s.settlement ? s.settlement : null; } catch (e) { return null; }
      })();

      return {
        dead_frames: deadFrames,
        clock_at_death: atDeath, clock_at_respawn: atRespawn,
        across_dead_interval_h: +(atRespawn - atDeath).toFixed(6),
        control_live_frames_h: +(liveB - liveA).toFixed(6),
        env_frames_held_by_death: envAfter.clock_frames_held_by_death ?? null,
        deaths_run: deaths,
        total_dead_frames: totalDead,
        hour_before_the_deaths: hourBefore,
        hour_after_the_deaths: envAfter.time_of_day,
        phase_before: phaseBefore,
        phase_after: envAfter.phase,
        hours_burned_by_the_deaths: +(envAfter.time_of_day - hourBefore).toFixed(6),
        settlement: anyOpen,
      };
    } finally {
      if (restore) envSys.step = restore;
    }
  }, { del: deleteTheFix, deaths: DEATHS });

  out.arms.shipped = await run(false);
  log(`shipped:   dead ${out.arms.shipped.dead_frames}f, clock across the dead interval ${out.arms.shipped.across_dead_interval_h} h, live control ${out.arms.shipped.control_live_frames_h} h`);
  out.arms.fix_deleted = await run(true);
  log(`fix gone:  dead ${out.arms.fix_deleted.dead_frames}f, clock across the dead interval ${out.arms.fix_deleted.across_dead_interval_h} h`);

  const S = out.arms.shipped, D = out.arms.fix_deleted;
  out.verdict = {
    T1_clock_frozen_across_the_death: S.across_dead_interval_h === 0,
    T2_control_clock_runs_when_alive: S.control_live_frames_h > 0,
    T3_delete_the_fix_returns_the_old_number: D.across_dead_interval_h > 0,
    T4_the_two_arms_differ: S.across_dead_interval_h !== D.across_dead_interval_h,
    T5_consumer_moved: S.hours_burned_by_the_deaths === 0 && D.hours_burned_by_the_deaths > 0,
    fix_is_inert: S.across_dead_interval_h === D.across_dead_interval_h,
    deaths_at_2058_kept_the_hour: S.phase_after === S.phase_before && D.phase_after !== undefined,
  };
  out.ok = out.verdict.T1_clock_frozen_across_the_death
    && out.verdict.T2_control_clock_runs_when_alive
    && out.verdict.T3_delete_the_fix_returns_the_old_number
    && out.verdict.T4_the_two_arms_differ;
  log(`verdict ${JSON.stringify(out.verdict)}`);
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
  out.ok = false;
  log(`ERROR ${out.error}`);
} finally {
  if (handle) await handle.close();
}

writeJson(args.out || 'reports/runs/W1-13-R3/clock.json', out);
process.exit(out.ok ? 0 : 1);
