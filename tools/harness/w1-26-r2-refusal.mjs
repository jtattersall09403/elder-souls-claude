#!/usr/bin/env node
// w1-26-r2-refusal.mjs — the ordinary thing a person does in a form, and what the scene did about it.
//
// Owner: W1-26 round 2 (successor). `census.js` refuses a blank given name in the scribe's own
// words — "census: the given name is required — she will not stamp a blank line" — and
// `engine.js _censusApplyPending()` catches that throw and turns it into a refusal the surface
// draws, emitting `census_refused`. `census_refused` was never in `sim/events.js`'s closed
// vocabulary, so the emit threw a SECOND error out of the handler written to absorb the first,
// from inside the fixed step. Pressing Enter on an empty name is not an edge case; it is what a
// person does while they are still deciding.
//
// This probe presses Enter on a blank name through the real input path and asserts three things:
// the frame loop survives, the scene says something back, and the event reaches the trace. It
// also DELETES THE FIX — the vocabulary entry — and confirms the crash returns.
//
// USAGE  node tools/harness/w1-26-r2-refusal.mjs [--json <path>]
'use strict';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-26-r2-refusal.mjs — a blank answer in the opening must be refused in words, not thrown.';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');
ensureDir(path.join(REPORTS_DIR, 'journeys'));
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'journeys', 'w1-26-r2-refusal.json');

const out = { schema: 'elder-souls/w1-26-r2-refusal@1', piece: 'W1-26', checks: {}, passes: [], failures: [] };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };

const h = await launchGame({ ...args, width: 320, height: 240 });
try {
  out.checks.blank_name = await h.page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.setRenderRate(0); await H.setSeed(1337);
    const run = async (breakIt) => {
      await H.loadState('barge-hold');
      await H.censusBegin({ race: 'saxhleel' });
      const removed = breakIt ? (() => {
        const real = E.bus.emit.bind(E.bus);
        E.bus.emit = (f, t) => { if (t === 'census_refused') throw new Error(`event type '${t}' is not in the closed vocabulary (HARNESS.md §5, A-JRN7)`); return real(f, t); };
        return () => { E.bus.emit = real; };
      })() : null;
      // walk the scene to the given-name node
      let guard = 0;
      while (guard++ < 60) {
        const st = H.getCensusState();
        if (st.done || st.node === 'writ.given-name') break;
        if (st.paused) { H.censusEnter(st.resume_by); continue; }
        const inp = st.input;
        if (!inp) { H.censusAnswer(null); continue; }
        let v;
        if (inp.kind === 'text') v = 'Silence-Under-Salt';
        else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
        else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
        H.censusAnswer(v);
      }
      const at = H.getCensusState().node;
      // Press Enter on an empty line, through the deferred path the surface really uses, and
      // then STEP — the emit happens inside the fixed step, which is where it used to explode.
      let threw = null;
      try {
        E._censusPending = { value: '' };
        E._censusApplyPending();
        H.stepFrames(4);
      } catch (e) { threw = String(e && e.message ? e.message : e); }
      const st2 = H.getCensusState();
      const events = (H.traceDrain ? [] : []);
      if (removed) removed();
      return {
        node: at, threw,
        still_on_the_node: st2.node,
        refusal_shown: (E.censusSurface && E.censusSurface.refusal) || null,
        frame_advanced: E.sim.frame,
      };
    };
    const ok = await run(false);
    const broken = await run(true);
    return { with_fix: ok, fix_deleted: broken };
  });
  const B = out.checks.blank_name;
  say(`  with the fix:  ${JSON.stringify(B.with_fix)}`);
  say(`  fix deleted:   ${JSON.stringify(B.fix_deleted)}`);
  if (B.with_fix.threw) fail(`pressing Enter on a blank name threw out of the fixed step: ${B.with_fix.threw}`);
  else pass('pressing Enter on a blank name did not throw');
  if (B.with_fix.still_on_the_node === 'writ.given-name') pass('the scene stays on the question instead of advancing past it');
  else fail(`the scene moved to ${B.with_fix.still_on_the_node} on a blank answer`);
  if (B.with_fix.refusal_shown) pass(`she says why, in words: "${String(B.with_fix.refusal_shown).slice(0, 70)}"`);
  else fail('the refusal was silent — nothing was shown to the player');
  if (B.fix_deleted.threw) pass('delete-the-fix: without the vocabulary entry the blank answer throws again');
  else fail('delete-the-fix: removing the vocabulary entry did NOT bring the crash back');
} finally {
  writeJson(jsonPath, out);
  say(`\n${out.passes.length} pass, ${out.failures.length} fail`);
  say('wrote ' + jsonPath);
  await h.close();
  if (out.failures.length) process.exitCode = 1;
}
