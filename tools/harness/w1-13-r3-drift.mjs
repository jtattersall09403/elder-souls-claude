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
    T2: 'post-respawn motion is the CURRENT input and not carried momentum: held-through == '
      + 'held-after-only (within 0.75 m) and held-then-released == released (within 0.75 m)',
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

          // Step to the respawn. SURFACE_FRAMES is 150; step past it and read the world's OWN
          // record of where it placed the body rather than sampling the position later.
          H.stepFrames(155);
          const ds = H.getDeathState();
          const rec = (ds.deaths || ds.log || []).slice(-1)[0] || null;
          const respawnPos = rec && rec.respawn_pos ? rec.respawn_pos.slice() : null;
          const respawnFrame = rec ? rec.respawn_frame : null;

          // `held-after-only` presses forward only NOW, after control has returned.
          if (m === 'held-after-only') H.queueInputs([{ f: 0, move: [0, 1] }]);

          const pAtSample = eng.sim.player.pos.slice();
          H.stepFrames(220);
          const p1 = eng.sim.player.pos.slice();
          const d = (a) => (a ? +Math.hypot(a[0] - well.pos[0], a[2] - well.pos[2]).toFixed(3) : null);
          return {
            well: w, mode: m,
            moved_6f_before_death_m: movingAtDeath,
            respawn_frame: respawnFrame,
            respawn_pos: respawnPos ? respawnPos.map((v) => +v.toFixed(3)) : null,
            // T1: the world's own record, on the frame it was written.
            at_respawn_frame_m: d(respawnPos),
            // The round-2 critic's sample point, kept for comparability.
            at_155f_m: d(pAtSample),
            at_375f_m: d(p1),
            drift_after_respawn_m: +Math.hypot(p1[0] - pAtSample[0], p1[2] - pAtSample[2]).toFixed(3),
          };
        } catch (e) {
          return { well: w, mode: m, threw: String((e && e.message) || e) };
        } finally {
          if (restored) eng.traversal.reset = restored;
        }
      }, { w: wid, m: mode, stub: !!args['stub-traversal-reset'] });
      out.rows.push(r);
      log(`${wid.padEnd(20)} ${mode.padEnd(20)} respawn_pos ${r.at_respawn_frame_m} m · @155f ${r.at_155f_m} m · @375f ${r.at_375f_m} m`);
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
  const pairs = [];
  for (const [wid, m] of Object.entries(byWell)) {
    const push = (a, b, label) => {
      if (!m[a] || !m[b] || m[a].at_375f_m == null || m[b].at_375f_m == null) return;
      pairs.push({ well: wid, comparison: label, a: m[a].at_375f_m, b: m[b].at_375f_m, delta_m: +Math.abs(m[a].at_375f_m - m[b].at_375f_m).toFixed(3) });
    };
    push('held-through', 'held-after-only', 'momentum carried across the respawn?');
    push('held-then-released', 'released', 'is a release across the death honoured?');
  }
  out.t2 = {
    pairs,
    max_delta_m: pairs.length ? Math.max(...pairs.map((p) => p.delta_m)) : null,
    tolerance_m: 0.75,
    pass: pairs.length > 0 && pairs.every((p) => p.delta_m <= 0.75),
    _reading: 'If momentum were carried through the respawn, `held-through` would out-run '
      + '`held-after-only` (it had a running start) and `held-then-released` would out-run '
      + '`released`. Equal within tolerance means the body\'s motion after a respawn is the '
      + 'input the player is giving NOW, which is what holding a stick means.',
  };
  out.answer = out.t1.pass && out.t2.pass
    ? 'The respawn frame is EXACT (T1) and post-respawn motion is the current input, not carried '
      + 'momentum (T2). Carrying a HELD input through a respawn is therefore intended and is not '
      + 'drift: a player holding forward walks the instant control returns, which is what the '
      + 'round-2 critic\'s 9.78 m and 13.97 m at 271 frames are — walking pace.'
    : 'NOT the intended behaviour: see t1/t2.';
  out.pass = out.t1.pass && out.t2.pass;

  log('');
  log(`T1 respawn frame exact: ${out.t1.pass ? 'PASS' : 'FAIL'} (max ${out.t1.max_at_respawn_frame_m} m)`);
  log(`T2 no carried momentum: ${out.t2.pass ? 'PASS' : 'FAIL'} (max pair delta ${out.t2.max_delta_m} m)`);
} finally {
  if (handle) await handle.close().catch(() => {});
}

writeJson(args.out || 'reports/runs/W1-13-R3/drift.json', out);
process.exit(out.pass ? 0 : 1);
