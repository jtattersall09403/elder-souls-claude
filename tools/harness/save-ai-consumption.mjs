#!/usr/bin/env node
// save-ai-consumption.mjs — RI-MTH07 for the restored enemy AI, plus RULES 6 in full.
//
// THE QUESTION RI-MTH07 ASKS. `save/fight.js` now carries a `SoulsAI`'s behavioural state
// through `SoulsAI.saveState()`. Sixteen subsystems in this project have shipped a correct,
// instrumented model that nothing in the running world reads, so a round trip that restores
// the right numbers proves nothing on its own. The claim under test is stronger: **the state
// this save carries steers a body**. The world-side consumer is named and driven, not
// asserted — `EnemyController._idleBehaviour()` calls `this.ai.step()`, which writes `b.pos`,
// `b.yaw`, `b.state` and `b.speedMps` and emits `enemy_state`; `SoulsAI.step()`'s very first
// decision (T25, the leash) is taken against `this.anchor`, a field that lives nowhere but in
// the AI and that a load could only get from this save.
//
// THE ARMS, and why there are four (RULES 6 names three distinct ways to be wrong).
//   A  baseline   load the save unchanged, step, record where the enemy goes.
//   B  PERTURB    move the saved `anchor` far away and load THAT. If the restored state is
//                 read, the leash fires and the body walks somewhere else. If A == B, the
//                 field is carried and dead, which is the sixteen-subsystem failure.
//   C  NULL       perturb a field of the same record that nothing reads, and require A == C.
//                 Without this, B differing could just be noise, and "the control looked like
//                 a clean negative result" is how W1-04 lost fifteen walks.
//   D  DELETE     run the identical script against a tree with the fix cut out, and require
//                 the old failure back. An inert fix passes its own measurement because
//                 something else was carrying the number; that has happened here twice.
//
// Usage:
//   node tools/harness/save-ai-consumption.mjs [--out <file>]
//   node tools/harness/save-ai-consumption.mjs --url <pre-fix build>   (arm D)
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
save-ai-consumption.mjs — does the restored enemy AI state actually steer a body?

  --out <path>   write the JSON report here
  --url <url>    point at another build (used for the delete-the-fix arm)
  --frames <n>   frames to step per arm (default 240)
`;
const args = parseArgs();
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const FRAMES = Number(args.frames ?? 240);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (FRAMES) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const R = { arms: {}, notes: [] };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    // ---- the fixture. A STILL target hides every steering defect (RULES 8), so the enemy is
    // aggroed and the leash is the thing being steered, not a distance to a statue.
    H.setSeed(1337);
    const p0 = H.getCombatState().player.pos;
    const EID = 'consume-legion';
    H.spawn('guard_legion', p0[0] + 5, p0[2] + 2, { eid: EID });
    try { H.aggro(EID); } catch { /* not every build has it */ }
    H.stepFrames(30);

    const ai = () => {
      const c = window.__ENGINE.combat;
      for (const [eid, ctl] of c.enemies) {
        if (!ctl.ai) continue;
        const b = c.bodyOf ? c.bodyOf(eid) : null;
        return { eid, ctl, b, live: typeof ctl.ai.step === 'function' };
      }
      return null;
    };
    const a0 = ai();
    if (!a0) return { fatal: 'no controller with an AI came up — this whole tool would be vacuous' };
    R.fixture = { eid: a0.eid, ai_live_before_save: a0.live, state: a0.ctl.ai.state, anchor: a0.ctl.ai.anchor.slice() };

    const blob = H.saveState();
    const idx = (blob.fight.enemies || []).findIndex((e) => e.ctl && e.ctl.ai && e.ctl.ai.__live);

    // Run one arm: load the (possibly perturbed) blob, step, and report what the body DID.
    const run = (b) => {
      try {
        H.loadState(clone(b));
        const a = ai();
        if (!a || !a.live) return { err: `the AI came back ${a ? 'without step()' : 'not at all'}` };
        const start = [a.ctl.ai.b.pos[0], a.ctl.ai.b.pos[2]];
        const states = [];
        let last = null;
        for (let i = 0; i < FRAMES; i += 20) {
          H.stepFrames(20);
          const s = a.ctl.ai.state;
          if (s !== last) { states.push(s); last = s; }
        }
        const end = [a.ctl.ai.b.pos[0], a.ctl.ai.b.pos[2]];
        return {
          anchor_loaded: a.ctl.ai.anchor.slice(),
          state_sequence: states,
          end_state: a.ctl.ai.state,
          moved_m: Math.round(Math.hypot(end[0] - start[0], end[1] - start[1]) * 1000) / 1000,
          end_pos: [Math.round(end[0] * 1000) / 1000, Math.round(end[1] * 1000) / 1000],
        };
      } catch (e) { return { err: String(e && e.message || e).slice(0, 200) }; }
    };

    // A — baseline. Run FIRST and unconditionally, because on a tree with the fix cut out it is
    // arm A that carries the evidence: the delete-the-fix arm must show the OLD FAILURE COMING
    // BACK, not merely fail to find something to perturb. A teardown that exits before it has
    // exercised the thing under test is a teardown you have never seen bite (RULES 6).
    R.arms.A_baseline = run(blob);

    if (idx < 0) {
      R.delete_the_fix = {
        envelope_present: false,
        baseline: R.arms.A_baseline,
        note: 'This save carries no {__live} AI envelope, so the fix is not in this build. The '
          + 'baseline arm above is the delete-the-fix result: what a load followed by a step does '
          + 'without it.',
      };
      R.verdict = {
        consumed: null, null_control_is_silent: null, arms_differ: null,
        why: 'the fix is absent from this build — this is the delete-the-fix arm, not a measurement',
      };
      return R;
    }
    R.fixture.record_bytes = JSON.stringify(blob.fight.enemies[idx].ctl.ai).length;

    // B — PERTURB the model: move the leash origin 300 m away. `SoulsAI.step()` takes the leash
    // decision before any other, so a body whose anchor is out of range must abandon the player
    // and walk home. Nothing but this save can tell the restored AI where home is.
    const bp = clone(blob);
    const an = bp.fight.enemies[idx].ctl.ai.s.anchor;
    bp.fight.enemies[idx].ctl.ai.s.anchor = [an[0] - 300, an[1], an[2] - 300];
    R.arms.B_perturbed_anchor = run(bp);

    // C — NULL CONTROL: perturb a field of the same record that the simulation does not read
    // back. `yawRate` is a TRACE output — `SoulsAI.step()` assigns it every frame before
    // anything can consult it — so a save that carries a different one must change nothing.
    // If C differs from A, arm B's difference is noise and this tool is not evidence.
    const cp = clone(blob);
    cp.fight.enemies[idx].ctl.ai.s.yawRate = 999;
    R.arms.C_null_control = run(cp);

    const A = R.arms.A_baseline, B = R.arms.B_perturbed_anchor, C = R.arms.C_null_control;
    const same = (x, y) => !x.err && !y.err && JSON.stringify([x.state_sequence, x.end_pos]) === JSON.stringify([y.state_sequence, y.end_pos]);
    R.verdict = {
      consumed: !same(A, B),
      null_control_is_silent: same(A, C),
      arms_differ: !same(A, B),
      why: !same(A, B)
        ? 'moving the SAVED leash anchor changed where the restored body went — the state this save carries is read by the running world'
        : 'A and B are identical: the anchor is carried and NOTHING READS IT BACK. That is the failure RI-MTH07 exists to catch.',
      null_control_why: same(A, C)
        ? 'perturbing a trace-only field changed nothing, so B is not noise'
        : 'THE INSTRUMENT IS NOISY: a field nothing reads changed the outcome, so arm B proves nothing',
    };
    return R;
  }, FRAMES);
  // One picture, taken with THIS browser and not through the capture service, because the frame
  // only means anything after a save, a load and 240 fixed steps — which is the case rule 20
  // reserves for launching your own (`Launch your own browser only when you are stepping the
  // simulation, and say which you did`). It is evidence of BEHAVIOUR, not of appearance.
  if (args.shot && !report.fatal) {
    try {
      await handle.page.evaluate(() => {
        const H = window.__HARNESS;
        const c = window.__ENGINE.combat;
        let b = null;
        for (const [eid] of c.enemies) { b = c.bodyOf ? c.bodyOf(eid) : null; if (b) break; }
        if (b && typeof H.camera === 'function') {
          H.camera({ pos: [b.pos[0] + 5.5, b.pos[1] + 2.6, b.pos[2] + 6.5], look: [b.pos[0], b.pos[1] + 1.1, b.pos[2]], fov: 60 });
        }
        if (typeof H.setRenderRate === 'function') H.setRenderRate(60);
        H.stepFrames(2);
      });
      await handle.page.screenshot({ path: String(args.shot) });
      log(`save-ai-consumption: wrote ${args.shot}`);
    } catch (e) { log(`save-ai-consumption: could not take the picture — ${e.message}`); }
  }
} finally { await handle.close().catch(() => { }); }

if (args.out) writeJson(String(args.out), report);
console.log(JSON.stringify(report, null, 2));

if (report.fatal) { log(`save-ai-consumption: FATAL — ${report.fatal}`); process.exit(1); }
if (report.delete_the_fix) {
  const b = report.delete_the_fix.baseline || {};
  log('save-ai-consumption: DELETE-THE-FIX ARM — this build has no {__live} AI envelope.');
  log(`  a load followed by ${FRAMES} steps: ${b.err ? 'ERROR ' + b.err : 'no error (the teardown did NOT bite — check you are pointed at the right build)'}`);
  process.exit(b.err ? 2 : 1);   // 2 = the old failure came back, which is the expected result here
}
const v = report.verdict || {};
if (!v.consumed || !v.null_control_is_silent) {
  log('save-ai-consumption: FAIL — ' + (!v.consumed ? v.why : v.null_control_why));
  process.exit(1);
}
log('save-ai-consumption: PASS — the restored AI state steers a body, and the null control is silent.');
