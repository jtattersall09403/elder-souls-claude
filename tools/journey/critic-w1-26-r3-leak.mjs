#!/usr/bin/env node
// critic-w1-26-r3-leak.mjs — try to get an engine string onto a drawn row.
//
// Owner: the W1-26 round-3 CRITIC. Rule 24, and rule 6 both ways round.
//
// THE DEFECT THIS ATTACKS. At round 2 the census threw at `writ.race-observed`,
// `Engine._censusApplyPending()` caught it, put `err.message` on `censusSurface.refusal`, and
// `buildCensusModel()` drew `refusal` as the Warden-Scribe's aside. The player read
// `race must be observed before the scene reaches the desk` in her voice. Round 3 claims the two
// are now separated: `fault` holds the exception and is never read by the model; `refusal` holds
// one AUTHORED line out of `writ-house.json`.
//
// The builder proved this at ONE throw site — the one it had just fixed. A guard that only
// catches the exception it was written for is not a guard. So this throws from FOUR places the
// builder did not:
//
//   L1  a throw at a DIFFERENT census node (`writ.sex`) — not the race node
//   L2  a throw during the NAME COMMIT (`hold.hatch-name`), where the value is player text
//   L3  a throw AFTER THE WRIT IS STAMPED (`_censusFinish` -> `composeCharacter`), the last node
//   L4  a throw whose message is itself a plausible line of dialogue, so a human reading the
//       panel could not tell it from writing — the failure mode that makes this worse than a
//       crash. If any sanitiser works by "looks like code", this is what beats it.
//
// AND ITS OWN TEARDOWN (rule 6). `--inert-check` restores the round-2 behaviour on a copy of the
// live object — one line, `surface.refusal = fault` — and every L must then go RED. A leak
// detector that has never seen a leak is a second copy of the experiment.
//
// The sentinel is searched for in the DRAWN rows (`getRenderedText`), not in the model, because
// "never enters the model" is the builder's claim and "never reaches a frame" is the player's.
//
// EXIT: non-zero if any engine string reaches a drawn row, or if the teardown does not go red.
//
// USAGE
//   node tools/journey/critic-w1-26-r3-leak.mjs [--json <path>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-26-r3-leak.mjs — throw from four places in the census path and watch the frame.

USAGE
  node tools/journey/critic-w1-26-r3-leak.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'critic-w1-26-r3', 'leak.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };

const out = {
  schema: 'elder-souls/critic-leak@1', piece: 'W1-26-r3', role: 'critic',
  method: 'the scene is SET UP through the harness; every commit under test is a real DOM key press into input/real.js. The throw is injected into the live Census instance, not into the source.',
  conditions: { loadavg_at_start: loadavg() },
  arms: [], passes: [], failures: [], checks: {},
};
const pass = (id, what, d) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };

// Four throws. The message of each is the sentinel; L4's is deliberately indistinguishable from
// writing, because a guard that filters on "looks technical" would pass L1-L3 and fail a player.
const ARMS = [
  { id: 'L1', at: 'writ.sex', msg: 'census: ZZLEAK1 writ.sex node index -1 out of range' },
  { id: 'L2', at: 'hold.hatch-name', msg: 'census: ZZLEAK2 cannot serialise hatch_name: undefined is not an object' },
  { id: 'L3', at: 'writ.stamp', msg: 'census: ZZLEAK3 composeCharacter failed: birthsign_second is null' },
  { id: 'L4', at: 'writ.upbringing', msg: 'She sets the pen down. ZZLEAK4. The ledger will not take that.' },
  // L5 throws from `_censusFinish` — AFTER the graph is done and the writ has been composed.
  // `censusAnswer()` calls `_censusFinish()` from inside `_censusApplyPending`'s try, so the
  // catch owns this path too; whether anyone had ever checked is the question.
  { id: 'L5', at: 'writ.stamp', msg: 'census: ZZLEAK5 applyCharacter: renderWrit() returned undefined', where: 'finish' },
];

const h = await launchGame({ width: 640, height: 360, timeout: 180000 });
let code = 0;
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(1));   // the glyph path must RUN
  const step = (n = 1) => h.page.evaluate((k) => window.__HARNESS.stepFrames(k), n);

  /** Walk the census to `target` using the harness (setup, not the thing under test). */
  async function setupAt(target) {
    return h.page.evaluate((tgt) => {
      const H = window.__HARNESS, e = window.__ENGINE;
      H.censusBegin({});
      H.censusEnter('talk');                       // hold.hatch-name
      const answers = {
        'hold.hatch-name': null,
        'writ.sex': ['Silence-Under-Salt', 'walk'],
        'writ.upbringing': ['Silence-Under-Salt', 'walk', 'unrecorded'],
        'writ.stamp': ['Silence-Under-Salt', 'walk', 'unrecorded', null, 'Vashk', 'named', null, null, null, null],
      };
      if (tgt === 'hold.hatch-name') return { node: e.census.state().node };
      // generic walk: answer with the first legal option until the node id matches
      let guard = 0;
      while (guard++ < 60) {
        const st = e.census.state();
        if (!st || st.done) break;
        if (st.node === tgt) break;
        if (st.paused) { H.censusEnter(st.resume_by === 'walk' ? 'walk' : 'talk'); continue; }
        const k = st.input ? st.input.kind : null;
        if (!k) { H.censusAnswer(null); continue; }
        if (k === 'text') { H.censusAnswer('Silence-Under-Salt'); continue; }
        if (k === 'observed') { H.censusAnswer('correct'); continue; }
        if (k === 'pick') {
          const opts = (st.input.options || []).map((o) => o.id);
          const want = e.censusSurface.pickCount(st);
          H.censusAnswer(opts.slice(0, want));
          continue;
        }
        const opts = (st.input.options || []);
        H.censusAnswer(opts.length ? opts[0].id : null);
      }
      const st = e.census.state();
      return { node: st ? st.node : null, done: st ? !!st.done : true, guard };
    }, target);
  }

  /**
   * One arm. Arms the throw, commits with a REAL key, then reads the DRAWN rows.
   * @param {object} arm
   * @param {boolean} inert  restore the round-2 behaviour (refusal = the exception) as a teardown
   */
  async function runArm(arm, inert) {
    await h.page.evaluate(() => { window.__HARNESS.setRenderRate(1); });
    const at = await setupAt(arm.at);
    if (at.node !== arm.at) return { ...arm, inert, reached: at.node, skipped: true };
    // Arm the throw on the LIVE instance, and (for the teardown) put the exception back on the
    // drawn field exactly the way round 2 had it.
    await h.page.evaluate(({ msg, inertArm, where }) => {
      const e = window.__ENGINE;
      if (where === 'finish') {
        const realF = e._censusFinish.bind(e);
        e._censusFinish = function () { throw new Error(msg); };
        window.__critic_restore = () => { e._censusFinish = realF; };
      } else {
        const real = e.census.answer.bind(e.census);
        e.census.answer = function () { throw new Error(msg); };
        window.__critic_restore = () => { e.census.answer = real; };
      }
      if (inertArm) {
        // THE ROUND-2 BEHAVIOUR, restored on a copy of the live object. One line.
        const applied = e._censusApplyPending.bind(e);
        e._censusApplyPending = function () {
          applied();
          if (e.censusSurface && e.censusSurface.fault) {
            e.censusSurface.refusal = e.censusSurface.fault;   // <- the r2 defect, put back
            e._censusSync();
          }
        };
      }
    }, { msg: arm.msg, inertArm: !!inert, where: arm.where || 'answer' });

    const mark = await h.page.evaluate(() => window.__HARNESS.getRenderedText({}).next_index);
    // The commit is a REAL key. `interact` is KeyE/Enter; Enter never types, so it commits at a
    // text node too.
    await h.page.keyboard.press('Enter');
    await step(6);
    const after = await h.page.evaluate((m) => {
      const e = window.__ENGINE;
      const rt = window.__HARNESS.getRenderedText({ since: m });
      const rows = (rt.distinct || []).slice();
      const model = e.renderer && e.renderer.ui && e.renderer.ui.model ? JSON.stringify(e.renderer.ui.model) : '';
      return {
        drawn_rows: rows,
        // FAIL-CLOSED: false means this arm is ignorance, not absence.
        register_complete: rt.complete === true,
        blind_surfaces: rt.blind_surfaces || [],
        model_json: model,
        surface_fault: e.censusSurface ? e.censusSurface.fault : null,
        surface_refusal: e.censusSurface ? e.censusSurface.refusal : null,
        census_state_fault: (e.getCensusState ? (e.getCensusState().fault || null) : null),
      };
    }, mark);
    // IS THE REFUSAL RECOVERABLE, OR IS IT FOREVER? Round 2's complaint was not only that the
    // player read an engine string — it was that they read it "in the dialogue panel, forever".
    // Round 3 fixed the string. Un-arm the throw and press the same key again: if the node moves,
    // the soft-lock is gone too; if it does not, r3 fixed the words and kept the door shut.
    const nodeAtRefusal = await h.page.evaluate(() => { const s = window.__ENGINE.census.state(); return s ? s.node : null; });
    await h.page.evaluate(() => { if (window.__critic_restore) window.__critic_restore(); });
    await h.page.keyboard.press('Enter');
    await step(6);
    const recovered = await h.page.evaluate((n0) => {
      const s = window.__ENGINE.census.state();
      return { node: s ? s.node : null, done: s ? !!s.done : true, moved: !s || s.done || s.node !== n0 };
    }, nodeAtRefusal);
    await h.page.reload({ waitUntil: 'load' });
    await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
    await h.page.evaluate(() => window.__HARNESS.ready());
    await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));

    const sentinel = arm.msg.match(/ZZLEAK\d/)[0];
    const leakedRows = after.drawn_rows.filter((s) => s.includes(sentinel));
    const leakedModel = after.model_json.includes(sentinel);
    return {
      ...arm, inert, sentinel,
      register_complete: after.register_complete,
      blind_surfaces: after.blind_surfaces,
      drawn_row_count: after.drawn_rows.length,
      leaked_rows: leakedRows,
      leaked_in_model: leakedModel,
      leaked: leakedRows.length > 0 || leakedModel,
      fault_holds_it: !!(after.surface_fault && after.surface_fault.includes(sentinel)),
      refusal: after.surface_refusal,
      census_state_fault: after.census_state_fault,
      node_at_refusal: nodeAtRefusal,
      recovered_after_unarming: recovered,
    };
  }

  // ---- POSITIVE ARM: the shipped build ------------------------------------------------------
  say('  the shipped build:');
  for (const arm of ARMS) {
    const r = await runArm(arm, false);
    out.arms.push(r);
    say(`    ${r.id} at ${r.at}: ${r.skipped ? `SKIPPED (reached ${r.reached})` : `${r.drawn_row_count} rows drawn, leaked=${r.leaked}, fault_holds=${r.fault_holds_it}, refusal=${JSON.stringify(r.refusal)}`}`);
  }
  const live = out.arms.filter((a) => !a.skipped);
  const leaks = live.filter((a) => a.leaked);
  if (live.length !== ARMS.length) fail('SETUP', `only ${live.length} of ${ARMS.length} throw sites were reachable`, { arms: out.arms });
  if (leaks.length === 0 && live.length) {
    pass('LEAK', `${live.length} throws from ${live.length} different places in the census path; none reached a drawn row`, { arms: live.map((a) => a.id) });
  } else if (leaks.length) {
    fail('LEAK', `${leaks.length} engine string(s) reached a drawn row: ${leaks.map((a) => a.id).join(', ')}`, { leaks });
  }
  const held = live.filter((a) => a.fault_holds_it);
  if (held.length === live.length && live.length) pass('FAULT', `every caught exception is on \`fault\` and readable from the trace`, { n: held.length });
  else fail('FAULT', `${live.length - held.length} exception(s) are not on \`fault\` at all — a swallowed throw is not an improvement on a drawn one`, { arms: live });

  // ---- TEARDOWN (rule 6): put the r2 behaviour back and watch this probe go red -------------
  say('  the teardown — refusal = fault, the round-2 defect restored on a copy:');
  const teardown = [];
  for (const arm of ARMS.slice(0, 2)) {
    const r = await runArm(arm, true);
    teardown.push(r);
    say(`    ${r.id}: leaked=${r.leaked} (this MUST be true)`);
  }
  out.teardown = teardown;
  const tLive = teardown.filter((a) => !a.skipped);
  if (tLive.length && tLive.every((a) => a.leaked)) {
    pass('TEARDOWN', `with one line put back the engine string reaches a drawn row in ${tLive.length}/${tLive.length} arms — this probe can fail`, { arms: tLive.map((a) => a.id) });
  } else {
    fail('TEARDOWN', `the teardown did NOT go red (${tLive.filter((a) => a.leaked).length}/${tLive.length}) — this control is inert and the positive arm above proves nothing`, { teardown });
  }

  out.conditions.loadavg_at_end = loadavg();
  out.conditions.page_errors = h.errors.slice(0, 8);
} catch (e) {
  fail('RUN', `threw: ${e.message}`, { stack: String(e.stack || '').split('\n').slice(0, 6) });
} finally {
  code = out.failures.length ? 1 : 0;
  say(`\n  ${out.passes.length} pass · ${out.failures.length} fail`);
  writeJson(jsonPath, out);
  say(`  artifact: ${path.relative(process.cwd(), jsonPath)}`);
  await h.close();
  process.exit(code);
}
