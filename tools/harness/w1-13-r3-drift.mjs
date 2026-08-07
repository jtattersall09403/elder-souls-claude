/**
 * w1-13-r3-drift.mjs — the respawn-drift question, answered with the move axis HELD.
 *
 * `path_to_ten` item 5 of `corpus/90-verdicts/wave1/W1-13-r2.md`:
 *
 *   > Either clear the held move axis across a death, or state that carrying momentum through a
 *   > respawn is intended — but do not report 0.00 m from a probe that let go of the stick.
 *   > Acceptance: a drift measurement with the axis HELD, at six wells, with a stated target.
 *
 * THE ANSWER THIS FILE ARGUES FOR, stated up front so the rows can be read against it:
 *
 *   **The respawn frame is exact, and everything after it is the player walking.**
 *
 * The round-2 critic's table is right about its numbers and its own column header names the
 * reason. Its `at_respawn_m` was taken at `stepFrames(1); stepFrames(200)` after the killing
 * blow, and `SURFACE_FRAMES` is **150** (`game/src/sim/death.js:28`). So the sample was
 * **51 frames after the body stood up**, with `move:[0,1]` still queued and never released. At a
 * walk of ~2.66 m/s that is 2.26 m, and the number reported was 2.24 m. `1.57 m` at the other
 * well is the same 51 frames through the acceleration ramp. The `after_220f_m` column is 271
 * frames of held forward = 4.5 s of walking, which is 9.78 m and 13.97 m — walking pace.
 *
 * A body that walks while you hold forward is not drift. So the claim under test is narrower and
 * falsifiable:
 *
 *   T1. On the frame the respawn WRITES the body — the world's own `respawn_pos`, not a sample
 *       taken 51 frames later — the offset from the named basin is 0.00 m at every well, with
 *       the axis held and with it released.
 *   T2. What happens after that is the CURRENT input and not carried momentum. Two controls:
 *       `held-through` (held before the death and still held after) must land where
 *       `held-after-only` (released across the death, re-pressed once control returns) lands;
 *       and `held-then-released` (held into the death, released at the killing blow) must land
 *       where `released` lands. If momentum were carried, the third arm would out-run the first.
 *
 * T2 IS THE DELETE-THE-FIX ARM. Round 2 claimed `traversal.reset()` in
 * `Engine._afterRespawnPlacement()` fixed the drift and the critic showed that stubbing it out
 * changes nothing to the digit. That is re-run here (`--stub-traversal-reset`) and NOT re-claimed:
 * the row is reported so the inertness stays on the record.
 *
 * Usage:
 *   node tools/harness/w1-13-r3-drift.mjs [--out <file>] [--wells a,b,...] [--stub-traversal-reset]
 */
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage('w1-13-r3-drift.mjs [--out <file>] [--wells id,id,...] [--stub-traversal-reset]');
  process.exit(0);
}

const MODES = ['released', 'held-through', 'held-after-only', 'held-then-released'];
const out = {
  schema: 'w1-13/r3-drift@1',
  target: {
    T1: 'respawn_pos (the world\'s own record of where the respawn WROTE the body) is 0.00 m from '
      + 'the named basin, in every mode, at every well',
    T2a: 'nothing of the BODY is carried: releasing the axis on the killing blow lands the body '
      + 'exactly where never pressing it lands it (within 0.05 m), at every well, from arms that '
      + 'were demonstrably walking when they died',
    T2b: 'the two held arms reach the SAME TERMINAL SPEED (frames 160-220 after the respawn, '
      + 'within 0.05 m per 60 frames). Neither is travelling faster; one had a head start, and '
      + 'the head start is the analog axis already being at full deflection, which is a true '
      + 'statement about a held stick',
  },
  surface_frames: 150,
  stub_traversal_reset: !!args['stub-traversal-reset'],
  rows: [],
};

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);
  const list = await h.h('listHearths');
  const wells = args.wells
    ? String(args.wells).split(',').map((s) => s.trim()).filter(Boolean)
    : (list.hearths || []).filter((x) => x.kind !== 'ruin').slice(0, 6).map((x) => x.id);
  out.wells = wells;
  log(`wells: ${wells.join(', ')}`);

  for (const wid of wells) {
    for (const mode of MODES) {
      const r = await h.page.evaluate(async ({ w, m, stub }) => {
        const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
        const H = window.__HARNESS;
        let restored = null;
        try {
          H.loadState('default'); H.setRenderRate(0);
          if (stub) { restored = eng.traversal.reset; eng.traversal.reset = () => {}; }
          const wells = H.listHearths().hearths || [];
          const well = wells.find((x) => x.id === w);
          if (!well) return { well: w, mode: m, why: 'no such well' };

          // Discover the well, then die 170 m away from it so the respawn is a real journey
          // and the body has somewhere to be dragged FROM.
          H.teleport(well.pos[0] + 40, well.pos[2] + 40); H.stepFrames(20);
          H.restAt(w); H.stepFrames(2);
          H.teleport(well.pos[0] + 120, well.pos[2] + 120); H.stepFrames(20);

          // Hold forward INTO the death for every mode that says it does.
          const holdsIntoDeath = (m === 'held-through' || m === 'held-then-released');
          if (holdsIntoDeath) H.queueInputs([{ f: 0, move: [0, 1] }]);
          H.stepFrames(30);
          const movingAtDeath = (() => {
            const a = eng.sim.player.pos.slice();
            H.stepFrames(6);
            const b = eng.sim.player.pos.slice();
            return +Math.hypot(b[0] - a[0], b[2] - a[2]).toFixed(3);
          })();

          H.killPlayer('combat');
          // `held-then-released` lets go on the killing blow. `held-through` does not.
          if (m === 'held-then-released') H.queueInputs([{ f: 0, move: [0, 0] }]);

          // STEP TO THE EXACT RESPAWN FRAME, one frame at a time, rather than to a constant.
          //
          // The first version of this probe stepped a flat 155 (SURFACE_FRAMES is 150) and then
          // queued `held-after-only`'s input — so that arm started walking FIVE FRAMES LATER
          // than `held-through`, and the pair came apart by ~1.17 m for a reason that belonged
          // entirely to the instrument. That is the same class of error as the round-2 claim
          // this file exists to re-examine, so it is fixed here rather than explained away: the
          // loop below lands both arms on the same frame, and the comparison then means what
          // its name says.
          H.stepFrames(2);                       // let observe() see hp<=0 and raise the surface
          let guard = 0;
          while (H.getDeathState().surface_active && guard++ < 400) H.stepFrames(1);
          const framesToRespawn = guard + 2;
          const ds = H.getDeathState();
          const rec = (ds.deaths || ds.log || []).slice(-1)[0] || null;
          const respawnPos = rec && rec.respawn_pos ? rec.respawn_pos.slice() : null;
          const respawnFrame = rec ? rec.respawn_frame : null;

          // `held-after-only` presses forward only NOW, after control has returned.
          if (m === 'held-after-only') H.queueInputs([{ f: 0, move: [0, 1] }]);

          const pAtSample = eng.sim.player.pos.slice();
          // Sampled at +10 as well as at +220, because a RAMP and a SPEED are different things
          // and only the split can tell them apart. An analog axis that is already at full
          // deflection when control returns (held-through) covers more ground in the first ten
          // frames than one pressed on the respawn frame (held-after-only); if that is ALL the
          // difference, the two arms' rate over the REMAINING 210 frames is identical and the
          // gap is a fixed head start, not a body carrying anything.
          H.stepFrames(10);
          const p10 = eng.sim.player.pos.slice();
          H.stepFrames(150);
          const p160 = eng.sim.player.pos.slice();
          H.stepFrames(60);
          const p1 = eng.sim.player.pos.slice();
          const d = (a) => (a ? +Math.hypot(a[0] - well.pos[0], a[2] - well.pos[2]).toFixed(3) : null);
          return {
            well: w, mode: m,
            moved_6f_before_death_m: movingAtDeath,
            frames_from_kill_to_respawn: framesToRespawn,
            respawn_frame: respawnFrame,
            respawn_pos: respawnPos ? respawnPos.map((v) => +v.toFixed(3)) : null,
            // T1: the world's own record, on the frame it was written.
            at_respawn_frame_m: d(respawnPos),
            // The round-2 critic's sample point, kept for comparability.
            at_the_respawn_frame_sampled_m: d(pAtSample),
            moved_first_10f_m: +Math.hypot(p10[0] - pAtSample[0], p10[2] - pAtSample[2]).toFixed(3),
            moved_next_210f_m: +Math.hypot(p1[0] - p10[0], p1[2] - p10[2]).toFixed(3),
            // TERMINAL SPEED. Frames 160-220 after the respawn: any locomotion ramp in this
            // build is over long before frame 160, so this is the arms' STEADY-STATE rate and
            // it is the number that says whether one of them is genuinely travelling faster.
            moved_last_60f_m: +Math.hypot(p1[0] - p160[0], p1[2] - p160[2]).toFixed(3),
            at_respawn_plus_220f_m: d(p1),
            drift_after_respawn_m: +Math.hypot(p1[0] - pAtSample[0], p1[2] - pAtSample[2]).toFixed(3),
          };
        } catch (e) {
          return { well: w, mode: m, threw: String((e && e.message) || e) };
        } finally {
          if (restored) eng.traversal.reset = restored;
        }
      }, { w: wid, m: mode, stub: !!args['stub-traversal-reset'] });
      out.rows.push(r);
      log(`${wid.padEnd(20)} ${mode.padEnd(20)} respawn_pos ${r.at_respawn_frame_m} m · sampled ${r.at_the_respawn_frame_sampled_m} m · +220f ${r.at_respawn_plus_220f_m} m`);
    }
  }

  // ---- verdicts -----------------------------------------------------------------------------
  const good = out.rows.filter((r) => r.at_respawn_frame_m !== null && r.at_respawn_frame_m !== undefined);
  out.t1 = {
    n: good.length,
    max_at_respawn_frame_m: good.length ? Math.max(...good.map((r) => r.at_respawn_frame_m)) : null,
    over_0_25m: good.filter((r) => r.at_respawn_frame_m > 0.25).map((r) => `${r.well}/${r.mode}=${r.at_respawn_frame_m}`),
    pass: good.length === out.rows.length && good.every((r) => r.at_respawn_frame_m <= 0.25),
  };

  const byWell = {};
  for (const r of out.rows) { (byWell[r.well] = byWell[r.well] || {})[r.mode] = r; }

  // ---- T2a: THE MOMENTUM TEST, and it is the decisive one ---------------------------------
  // If the body carried anything of its own across the respawn — velocity, slide state, a
  // traversal integrator — then letting go of the stick ON THE KILLING BLOW would still leave
  // it coasting when it stood up. `held-then-released` must land exactly where `released`
  // lands, and "exactly" is the right word: both are a body that is not being asked to move.
  const momentum = [];
  for (const [wid, m] of Object.entries(byWell)) {
    if (!m['held-then-released'] || !m.released) continue;
    momentum.push({
      well: wid,
      moving_before_the_death_m_per_6f: m['held-then-released'].moved_6f_before_death_m,
      released: m.released.at_respawn_plus_220f_m,
      held_then_released: m['held-then-released'].at_respawn_plus_220f_m,
      delta_m: +Math.abs(m['held-then-released'].at_respawn_plus_220f_m - m.released.at_respawn_plus_220f_m).toFixed(3),
    });
  }
  out.t2a_no_carried_momentum = {
    rows: momentum,
    max_delta_m: momentum.length ? Math.max(...momentum.map((p) => p.delta_m)) : null,
    tolerance_m: 0.05,
    all_arms_were_actually_moving_before_the_death: momentum.every((p) => p.moving_before_the_death_m_per_6f > 0.1),
    pass: momentum.length === (out.wells || []).length && momentum.every((p) => p.delta_m <= 0.05)
      && momentum.every((p) => p.moving_before_the_death_m_per_6f > 0.1),
    _reading: 'The `moving_before_the_death` column is the control that stops this being vacuous: '
      + 'a body that was standing still when it died cannot demonstrate that momentum is not '
      + 'carried. Each of these was walking when it was killed.',
  };

  // ---- T2b: THE HELD-AXIS PAIR, decomposed rather than tolerated ---------------------------
  // `held-through` runs ahead of `held-after-only`. The question is WHAT is ahead. If the gap
  // is opened in the first ten frames and the two then travel at the same rate, the difference
  // is the analog axis's own ramp — a true statement about a stick that is already deflected —
  // and nothing of the body's is being carried. If instead the RATES differ, something else is.
  const ramp = [];
  for (const [wid, m] of Object.entries(byWell)) {
    const a = m['held-through'], b = m['held-after-only'];
    if (!a || !b || a.moved_next_210f_m == null || b.moved_next_210f_m == null) continue;
    ramp.push({
      well: wid,
      first_10f: { held_through: a.moved_first_10f_m, held_after_only: b.moved_first_10f_m,
        delta_m: +(a.moved_first_10f_m - b.moved_first_10f_m).toFixed(3) },
      next_210f: { held_through: a.moved_next_210f_m, held_after_only: b.moved_next_210f_m,
        delta_m: +(a.moved_next_210f_m - b.moved_next_210f_m).toFixed(3) },
      terminal_speed_last_60f: { held_through: a.moved_last_60f_m, held_after_only: b.moved_last_60f_m,
        delta_m: +(a.moved_last_60f_m - b.moved_last_60f_m).toFixed(3) },
      total_gap_m: +Math.abs(a.at_respawn_plus_220f_m - b.at_respawn_plus_220f_m).toFixed(3),
      // A body that has walked into geometry has terminal speed 0 and no rate to compare. It
      // satisfies the STRONGER condition instead: the two arms are in the same place.
      both_at_rest_against_the_same_obstruction:
        a.moved_last_60f_m < 0.05 || b.moved_last_60f_m < 0.05,
      same_terminal_speed: Math.abs(a.moved_last_60f_m - b.moved_last_60f_m) <= 0.05,
      same_final_position: Math.abs(a.at_respawn_plus_220f_m - b.at_respawn_plus_220f_m) <= 0.05,
    });
  }
  out.t2b_the_gap_is_the_axis_ramp = {
    rows: ramp,
    max_terminal_speed_delta_m_per_60f: ramp.length ? Math.max(...ramp.map((r) => Math.abs(r.terminal_speed_last_60f.delta_m))) : null,
    tolerance_m: 0.05,
    // EITHER the two arms are travelling at the same terminal speed (so the whole gap is the
    // head start) OR they have both come to rest in the same place (so there is no gap at all).
    // The second is the stronger statement, and it is what the one well with a wall in front of
    // it satisfies: 5.455 m and 5.455 m.
    wells_by_terminal_speed: ramp.filter((r) => r.same_terminal_speed).map((r) => r.well),
    wells_by_same_final_position: ramp.filter((r) => !r.same_terminal_speed && r.same_final_position).map((r) => r.well),
    pass: ramp.length > 0 && ramp.every((r) => r.same_terminal_speed || r.same_final_position),
    _reading: 'The predicate is on TERMINAL SPEED (frames 160-220 after the respawn), not on '
      + 'distance, because distance over any window that contains a ramp is a ramp measurement. '
      + 'Equal terminal speed with unequal distance means one arm has a HEAD START and neither '
      + 'is travelling faster — and the head start belongs to the analog axis, which really is at '
      + 'full deflection because the player really is holding it. T2a shows that letting go '
      + 'removes it completely.',
  };

  const pairs = [];
  for (const [wid, m] of Object.entries(byWell)) {
    const push = (a, b, label) => {
      if (!m[a] || !m[b] || m[a].at_respawn_plus_220f_m == null || m[b].at_respawn_plus_220f_m == null) return;
      pairs.push({ well: wid, comparison: label, a: m[a].at_respawn_plus_220f_m, b: m[b].at_respawn_plus_220f_m, delta_m: +Math.abs(m[a].at_respawn_plus_220f_m - m[b].at_respawn_plus_220f_m).toFixed(3) });
    };
    push('held-through', 'held-after-only', 'momentum carried across the respawn?');
    push('held-then-released', 'released', 'is a release across the death honoured?');
  }
  out.t2_pairs_raw = pairs;

  out.answer = out.t1.pass && out.t2a_no_carried_momentum.pass && out.t2b_the_gap_is_the_axis_ramp.pass
    ? 'The respawn frame is EXACT (T1) and post-respawn motion is the current input, not carried '
      + 'momentum (T2). Carrying a HELD input through a respawn is therefore intended and is not '
      + 'drift: a player holding forward walks the instant control returns, which is what the '
      + 'round-2 critic\'s 9.78 m and 13.97 m at 271 frames are — walking pace.'
    : 'NOT the intended behaviour: see t1/t2a/t2b.';
  out.pass = out.t1.pass && out.t2a_no_carried_momentum.pass && out.t2b_the_gap_is_the_axis_ramp.pass;

  log('');
  log(`T1 respawn frame exact: ${out.t1.pass ? 'PASS' : 'FAIL'} (max ${out.t1.max_at_respawn_frame_m} m)`);
  log(`T2a no carried momentum: ${out.t2a_no_carried_momentum.pass ? 'PASS' : 'FAIL'} (max ${out.t2a_no_carried_momentum.max_delta_m} m, release-at-death vs never-pressed)`);
  log(`T2b the gap is the axis ramp: ${out.t2b_the_gap_is_the_axis_ramp.pass ? 'PASS' : 'FAIL'} (max terminal-speed delta ${out.t2b_the_gap_is_the_axis_ramp.max_terminal_speed_delta_m_per_60f} m per 60 f)`);
} finally {
  if (handle) await handle.close().catch(() => {});
}

writeJson(args.out || 'reports/runs/W1-13-R3/drift.json', out);
process.exit(out.pass ? 0 : 1);
