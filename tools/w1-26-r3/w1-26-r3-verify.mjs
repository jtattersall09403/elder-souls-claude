#!/usr/bin/env node
// w1-26-r3-verify.mjs — CONSUMPTION (RI-MTH07) and delete-the-fix (rule 6) for the three
// W1-26 round-3 repairs, in one running browser.
//
// Owner: W1-26 r3. Every arm here is taken on the SAME page, so the only thing that differs
// between an arm and its teardown is the one line of behaviour named in the arm.
//
// THE THREE FIXES, AND HOW EACH IS TORN DOWN
//
//   A  the scribe observes the body      `Engine.censusBegin()` observes `bodyRace()`
//      teardown: `e.bodyRace = () => null` — the exact shape of the old build, where nothing on
//      the play path ever called `Census.observe()`. The desk must throw again.
//
//   B  a caught throw is never drawn     `surface.refusal` is authored, `surface.fault` is the
//      exception and is not in the model
//      teardown: put the exception text back on `refusal`, which is literally what
//      `_censusApplyPending` used to do, and confirm it reaches a drawn row. This is the arm
//      that proves the "no engine string on the vellum" check can go red.
//
//   C  a focused text field takes the keyboard first
//      teardown: `e.real.textFocus = null` — the field the device layer did not have before r3.
//      The typed name must come back mangled again.
//
//   D  the hand-back node draws what is being said
//      teardown: re-impose the old `if (state.paused) return null` by nulling the model on a
//      paused node inside `_censusSync`. `hold.out` must go back to 0 drawn rows.
//
// CONSUMPTION is on fix A's model, because it is the round's load-bearing one: the model is the
// race of the body the player is in, and the world-side consumer is the sentence the Warden-
// Scribe SAYS OUT LOUD and the composed sheet she writes. Perturb the body, hold everything
// else, and watch a drawn string move.
//
// EXIT: non-zero if any fix fails, or if any TEARDOWN fails to go red — an arm whose control
// cannot fail is a second copy of the experiment, not evidence.
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-r3-verify.mjs — consumption + delete-the-fix for the three W1-26 r3 repairs.

USAGE
  node tools/w1-26-r3/w1-26-r3-verify.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-26-r3', 'verify.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const out = {
  schema: 'elder-souls/w1-26-r3-verify@1',
  piece: 'W1-26-r3',
  items: ['RI-JRN01', 'RI-JRN09', 'RI-CHR01', 'RI-MTH07'],
  commit: null,
  passes: [], failures: [],
};
try { out.commit = fs.readFileSync(path.join(REPO_ROOT, '.git/HEAD'), 'utf8').trim(); } catch { /* not fatal */ }
const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out[id] = { ok: true, ...(d || {}) }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out[id] = { ok: false, ...(d || {}) }; };

const h = await launchGame({ width: 480, height: 270, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // Install the shared helpers on the page once.
  await h.page.evaluate(() => {
    const e = window.__ENGINE;
    window.__W = {
      origBodyRace: e.bodyRace.bind(e),
      origSync: e._censusSync.bind(e),
      /** Open the scene the way the title's `New` does, walk to a node, return the drawn rows. */
      toNode(target) {
        const H = window.__HARNESS;
        H.censusBegin({});                      // exactly what _titleApply('new') calls
        H.censusEnter('talk');                  // the player reaches for her
        if (target === 'hold.hatch-name') return this.rows();
        H.censusAnswer('Silence-Under-Salt');   // hold.out
        if (target === 'hold.out') return this.rows();
        H.censusEnter('walk');                  // up the companionway
        return this.rows();
      },
      rows() {
        const e = window.__ENGINE;
        const st = e.getCensusState();
        return {
          node: st.node,
          place: st.place,
          speaker: st.speaker,
          speaker_name: st.npc_record ? st.npc_record.name : null,
          race_observed: st.race_observed,
          body_race: st.body_race,
          drawn: (st.surface && st.surface.rendered_text) ? st.surface.rendered_text.slice() : [],
          refusal: st.surface ? st.surface.refusal : null,
          fault: st.surface ? st.surface.fault : null,
        };
      },
    };
  });

  const toNode = (target) => h.page.evaluate((t) => window.__W.toNode(t), target);
  const rows = () => h.page.evaluate(() => window.__W.rows());

  // =========================================================================================
  // A — the scene the title's `New` opens can be finished, and the race came from the body
  // =========================================================================================
  say('== A — the scribe observes the body ==');
  const atDesk = await toNode('writ.race-observed');
  const finished = await h.page.evaluate(() => {
    const H = window.__HARNESS, e = window.__ENGINE;
    let guard = 0;
    let st = e.census.state();
    const seen = [];
    while (!st.done && guard++ < 40) {
      if (st.paused) { st = H.censusEnter(st.resume_by); continue; }
      if (!st.input) break;
      const inp = st.input, o = inp.options || [];
      let v;
      if (inp.kind === 'text') v = 'Silence-Under-Salt';
      else if (inp.kind === 'observed') v = 'correct';
      else if (inp.kind === 'pick') v = o.slice(0, inp.count || 2).map((x) => x.id);
      else v = o.length ? o[0].id : null;
      seen.push(st.node);
      try { st = H.censusAnswer(v); } catch (err) { return { done: false, threw: String(err.message || err), at: st.node, seen }; }
    }
    return { done: !!st.done, seen, character: e.sim.character ? { race: e.sim.character.race, given_name: e.sim.character.given_name, class_id: e.sim.character.class_id } : null };
  });
  out.A = { at_desk: atDesk, finished };
  if (finished.done && finished.character && finished.character.race) {
    pass('A1', `the scene the title's New opens completes: ${finished.seen.length} nodes to the stamp, character race ${JSON.stringify(finished.character.race)}`, { finished });
  } else {
    fail('A1', `the scene did not complete: ${finished.threw || 'stopped'} at ${finished.at || '(unknown)'}`, { finished });
  }
  if (atDesk.race_observed && atDesk.race_observed === atDesk.body_race) {
    pass('A2', `the race the scribe wrote down (${atDesk.race_observed}) is the race of the body (${atDesk.body_race}), not an argument`, { atDesk });
  } else {
    fail('A2', `race_observed ${JSON.stringify(atDesk.race_observed)} does not come from the body ${JSON.stringify(atDesk.body_race)}`, { atDesk });
  }

  // ---- CONSUMPTION (RI-MTH07) — perturb the body, watch what she SAYS -----------------------
  say('');
  say('== CONSUMPTION — the model is the body\'s race; the consumer is the sentence she says ==');
  const arms = [];
  for (const race of ['saxhleel', 'dunmer', 'khajiit', 'nord']) {
    const r = await h.page.evaluate((rc) => {
      const e = window.__ENGINE;
      e.sim.identity.race = rc;                 // the ONE field perturbed
      const drawnAtDesk = window.__W.toNode('writ.race-observed');
      // Finish, so the composed sheet downstream of it can be read too.
      const H = window.__HARNESS;
      let st = e.census.state(), guard = 0;
      while (!st.done && guard++ < 40) {
        if (st.paused) { st = H.censusEnter(st.resume_by); continue; }
        if (!st.input) break;
        const inp = st.input, o = inp.options || [];
        const v = inp.kind === 'text' ? 'Silence-Under-Salt'
          : inp.kind === 'observed' ? 'correct'
            : inp.kind === 'pick' ? o.slice(0, inp.count || 2).map((x) => x.id)
              : (o.length ? o[0].id : null);
        try { st = H.censusAnswer(v); } catch { break; }
      }
      return {
        drawn_at_desk: drawnAtDesk.drawn.slice(),
        race_observed: drawnAtDesk.race_observed,
        sheet_race: e.sim.character ? e.sim.character.race : null,
        writ_line: e.sim.character && e.sim.character.writ_text
          ? (String(e.sim.character.writ_text).split('\n').find((l) => l.startsWith('Observed as:')) || null) : null,
      };
    }, race);
    // COMPARE THE WHOLE DRAWN BLOB, NOT A PREFIX OF IT. The first draft of this arm compared
    // `slice(0, 110)`, and the first 110 characters of the desk are the speaker's name, the
    // place name and `writ.enter`'s carried line — identical for every race. Four different
    // sentences came back as "1 distinct" because the instrument stopped reading before the
    // word that changes. That is the same shape of mistake as measuring a prefix of a name.
    const line = r.drawn_at_desk.join(' ');
    // The sentence under test: the misread she says out loud at this node.
    const misread = (r.drawn_at_desk.find((s) => /—/.test(s) && !/Stand where the light/.test(s)) || line);
    arms.push({ body_race: race, race_observed: r.race_observed, sheet_race: r.sheet_race, writ_line: r.writ_line, drawn_full: line, misread_row: misread });
    say(`  body ${race.padEnd(9)} -> "${String(misread).slice(0, 92)}…"`);
    say(`  ${' '.repeat(14)}   writ: ${r.writ_line}`);
  }
  const distinctSpoken = new Set(arms.map((a) => a.drawn_full)).size;
  const distinctWrit = new Set(arms.map((a) => a.writ_line)).size;
  const tracks = arms.every((a) => a.race_observed === a.body_race && a.sheet_race === a.body_race);
  out.consumption = {
    model: "the race of the body the player is in — sim.identity.race, read at the desk by Engine.bodyRace()",
    world_side_consumer: "Census.state() at writ.race-observed composes the Warden-Scribe's misread line from it and the surface DRAWS it; downstream composeCharacter() -> the sheet -> renderWrit() -> the 'Observed as:' line on the document the player carries out",
    arms,
    distinct_spoken_lines: distinctSpoken,
    distinct_writ_lines: distinctWrit,
    coupling: (tracks && distinctSpoken === arms.length && distinctWrit === arms.length) ? 1 : 0,
  };
  if (out.consumption.coupling === 1) {
    pass('A3', `coupling 1 — four bodies, four different sentences drawn (${distinctSpoken} distinct) and four different writs (${distinctWrit} distinct)`, { arms });
  } else {
    fail('A3', `coupling ${out.consumption.coupling} — ${distinctSpoken} distinct drawn lines and ${distinctWrit} distinct writs over 4 bodies`, { arms });
  }
  await h.page.evaluate(() => { window.__ENGINE.sim.identity.race = 'saxhleel'; });

  // ---- DELETE-THE-FIX A ---------------------------------------------------------------------
  const teardownA = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    e.bodyRace = () => null;                    // the pre-r3 world: nothing observes the body
    const H = window.__HARNESS;
    H.censusBegin({}); H.censusEnter('talk'); H.censusAnswer('Silence-Under-Salt'); H.censusEnter('walk');
    let threw = null;
    try { H.censusAnswer('correct'); } catch (err) { threw = String(err.message || err); }
    const st = e.getCensusState();
    e.bodyRace = window.__W.origBodyRace;       // put it back
    return { threw, node: st.node, race_observed: st.race_observed };
  });
  out.teardown_A = teardownA;
  if (teardownA.threw && /race must be observed/.test(teardownA.threw)) {
    pass('A4', `delete-the-fix: with bodyRace() nulled the desk throws again — "${teardownA.threw}"`, teardownA);
  } else {
    fail('A4', `delete-the-fix DID NOT GO RED: with bodyRace() nulled the scene still passed the desk (node ${teardownA.node}). This control is inert and A1/A2 prove nothing.`, teardownA);
  }

  // =========================================================================================
  // B — a caught throw is never drawn as dialogue
  // =========================================================================================
  say('');
  say('== B — a caught throw is never drawn as dialogue ==');
  const refusal = await h.page.evaluate(() => {
    const e = window.__ENGINE, H = window.__HARNESS;
    H.censusBegin({}); H.censusEnter('talk'); H.censusAnswer('Silence-Under-Salt'); H.censusEnter('walk');
    // `writ.race-observed` is NOT the node to do this at: its `answer()` case ignores the value
    // entirely once a race is observed, so an illegal string there advances the scene instead of
    // refusing it, and the first draft of this arm measured nothing while reporting a pass shape.
    // `writ.sex` goes through `_requireOption`, which throws on an id the node does not offer —
    // the real refusal path a player can reach with a pad in a hurry.
    H.censusAnswer('correct');                 // past the desk, onto writ.sex
    const at = e.census.state().node;
    // Force the engine's OWN catch path: queue an illegal commit through the surface, which is
    // the route `_censusApplyPending` guards, then let the deferred apply run.
    e._censusPending = { value: 'not-a-legal-answer', committed: true, via: 'test' };
    e._censusApplyPending();
    const st = e.getCensusState();
    st.__at = at;
    return {
      node: st.__at,
      refusal: st.surface.refusal, fault: st.surface.fault,
      drawn: (st.surface.rendered_text || []).slice(),
      model_aside: e.renderer && e.renderer.ui && e.renderer.ui.model ? e.renderer.ui.model.aside : null,
    };
  });
  out.B = refusal;
  const drawnJoined = (refusal.drawn || []).join(' ');
  const faultDrawn = !!(refusal.fault && drawnJoined.includes(refusal.fault));
  say(`  fault  : ${JSON.stringify(refusal.fault)}`);
  say(`  refusal: ${JSON.stringify(refusal.refusal)}`);
  if (refusal.fault && !faultDrawn) {
    pass('B1', 'the engine exception was recorded and is drawn nowhere', { fault: refusal.fault, drawn_rows: refusal.drawn.length });
  } else if (!refusal.fault) {
    fail('B1', 'no fault was recorded, so this arm measured nothing — the illegal answer did not reach the catch', refusal);
  } else {
    fail('B1', `the engine exception "${refusal.fault}" IS on a drawn row`, refusal);
  }
  if (refusal.refusal && refusal.refusal !== refusal.fault) {
    pass('B2', `what she says instead is authored: "${refusal.refusal}"`, { refusal: refusal.refusal });
  } else {
    fail('B2', 'the drawn refusal is the engine string, or there is none', refusal);
  }
  // ---- DELETE-THE-FIX B: put the exception back on `refusal`, as the old code did.
  const teardownB = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    e.censusSurface.refusal = e.censusSurface.fault;   // the pre-r3 line, exactly
    e._censusSync();
    const st = e.getCensusState();
    return { drawn: (st.surface.rendered_text || []).slice(), fault: st.surface.fault };
  });
  const teardownDrawn = (teardownB.drawn || []).join(' ');
  const teardownShowsFault = !!(teardownB.fault && teardownDrawn.includes(teardownB.fault.slice(0, 30)));
  out.teardown_B = { ...teardownB, engine_string_drawn: teardownShowsFault };
  if (teardownShowsFault) {
    pass('B3', 'delete-the-fix: with the exception back on `refusal` it is drawn again — the check in B1 can go red', { excerpt: teardownDrawn.slice(0, 130) });
  } else {
    fail('B3', 'delete-the-fix DID NOT GO RED: the engine string was put back on `refusal` and still did not reach a drawn row, so B1 is an inert control', out.teardown_B);
  }

  // =========================================================================================
  // C — a focused text field takes the keyboard before the buttons
  // =========================================================================================
  say('');
  say('== C — the keyboard, at a text field ==');
  const NAME = 'Jekq-Vozbnu Twylfax Grimchopeds';
  const typeName = async () => {
    await h.page.evaluate(() => { const H = window.__HARNESS; H.censusBegin({}); H.censusEnter('talk'); });
    await h.page.evaluate(() => window.__HARNESS.stepFrames(3));
    for (const ch of NAME) {
      await h.page.keyboard.press(ch === ' ' ? 'Space' : ch);
      await h.page.evaluate(() => window.__HARNESS.stepFrames(1));
    }
    return h.page.evaluate(() => {
      const e = window.__ENGINE;
      return { typed: e.censusSurface.typed, node: e.census.state().node, text_focused: !!e.real.textFocus && !!e.real.textFocus() };
    });
  };
  const withFix = await typeName();
  out.C = { typed: NAME, with_fix: withFix };
  say(`  typed ${JSON.stringify(NAME)} -> ${JSON.stringify(withFix.typed)}`);
  if (withFix.typed === NAME) pass('C1', 'every letter of the alphabet reaches the field, and the E does not commit the node', withFix);
  else fail('C1', `the field holds ${JSON.stringify(withFix.typed)}`, withFix);

  // ---- DELETE-THE-FIX C: take the predicate away — the pre-r3 device layer.
  await h.page.evaluate(() => { window.__W.origTextFocus = window.__ENGINE.real.textFocus; window.__ENGINE.real.textFocus = null; });
  const withoutFix = await typeName();
  await h.page.evaluate(() => { window.__ENGINE.real.textFocus = window.__W.origTextFocus; });
  out.teardown_C = withoutFix;
  say(`  teardown (textFocus removed) -> ${JSON.stringify(withoutFix.typed)} at node ${withoutFix.node}`);
  if (withoutFix.typed !== NAME) {
    pass('C2', `delete-the-fix: with the predicate removed the name comes back as ${JSON.stringify(withoutFix.typed)} — the two arms differ`, withoutFix);
  } else {
    fail('C2', 'delete-the-fix DID NOT GO RED: the name round-tripped with textFocus removed, so C1 is an inert control and something else is carrying it', withoutFix);
  }

  // =========================================================================================
  // D — the hand-back node draws what is being said, in the room, from the right mouth
  // =========================================================================================
  say('');
  say('== D — hold.out ==');
  const holdOut = await toNode('hold.out');
  const nextRoom = await h.page.evaluate(() => { window.__HARNESS.censusEnter('walk'); return window.__W.rows(); });
  out.D = { hold_out: holdOut, next_room: nextRoom };
  const reply = 'Silence-Under-Salt. I will not say it again';
  const holdJoined = holdOut.drawn.join(' ');
  const nextJoined = nextRoom.drawn.join(' ');
  say(`  hold.out  place ${holdOut.place}  speaker ${holdOut.speaker_name}  ${holdOut.drawn.length} drawn row(s)`);
  say(`  next node ${nextRoom.node} in ${nextRoom.place} (${nextRoom.speaker_name}) ${nextRoom.drawn.length} drawn row(s)`);
  if (holdJoined.includes(reply) && holdOut.place === 'barge-hold' && /Jeeh/i.test(String(holdOut.speaker_name))) {
    pass('D1', `her reply to the name is drawn at hold.out, in the barge hold, attributed to ${holdOut.speaker_name}`, { drawn: holdOut.drawn });
  } else {
    fail('D1', `the reply is not drawn at hold.out from Jeeh-Ei (place ${holdOut.place}, speaker ${holdOut.speaker_name})`, { drawn: holdOut.drawn });
  }
  if (!nextJoined.includes(reply)) {
    pass('D2', `and it is NOT redrawn a room later above ${nextRoom.speaker_name}`, { drawn: nextRoom.drawn });
  } else {
    fail('D2', `the reply is still being drawn in ${nextRoom.place} above ${nextRoom.speaker_name}`, { drawn: nextRoom.drawn });
  }

  // ---- DELETE-THE-FIX D: re-impose `if (state.paused) return null`.
  const teardownD = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const orig = e._censusSync.bind(e);
    e._censusSync = function () {
      const m = orig();
      if (this.census.state().paused && this.renderer) this.renderer.ui.setModel(null);   // the pre-r3 line
      return m;
    };
    const r = window.__W.toNode('hold.out');
    e._censusSync = orig;
    return r;
  });
  out.teardown_D = teardownD;
  say(`  teardown (paused nodes draw nothing) -> ${teardownD.drawn.length} drawn row(s) at hold.out`);
  if (teardownD.drawn.length < holdOut.drawn.length) {
    pass('D3', `delete-the-fix: with the old line restored hold.out draws ${teardownD.drawn.length} rows against ${holdOut.drawn.length} — the arms differ`, { with_fix: holdOut.drawn.length, without: teardownD.drawn.length });
  } else {
    fail('D3', `delete-the-fix DID NOT GO RED: hold.out still drew ${teardownD.drawn.length} rows with the old behaviour restored — D1 is an inert control`, { with_fix: holdOut.drawn.length, without: teardownD.drawn.length });
  }
} catch (e) {
  fail('RUN', `the probe threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 6).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
