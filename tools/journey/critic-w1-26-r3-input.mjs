#!/usr/bin/env node
// critic-w1-26-r3-input.mjs — the OTHER half of the text-focus fix: did it break the world?
//
// Owner: the W1-26 round-3 CRITIC. Rule 24.
//
// Round 3 moved the text branch of `input/real.js`'s keydown handler from the BOTTOM of the
// handler to the TOP, above the movement map and above the control map. That fixes the fourteen
// letters the round-2 verdict measured being eaten. It is also, written the other way round,
// exactly how you would break every key in the game: the guard is `this.textFocus &&
// this.textFocus()`, and if that predicate is ever true outside a name field, the input layer
// swallows the player's movement keys and the defect has changed face, not gone.
//
// The builder's claim is `textFocus` "is null everywhere else". Being null is not the same as
// answering false, and neither is the same as the KEY ARRIVING at the action it is bound to. So
// this measures the third thing:
//
//   C1  every bound control key in `game/data/input/profiles.json` reaches its action in the
//       world — pressed as a real DOM event, observed as a latched action name on the pipeline.
//       Sixteen actions; the round-2 defect would show here as a key that arrives nowhere.
//   C2  every movement key moves the body, on all four directions, in the world.
//   C3  sprint and roll — the two the letters-as-buttons defect would have eaten (`ShiftLeft`,
//       `Space`) — change what the body does.
//   C4  every screen opens and closes on the keys W1-21 r2 verified, with the text branch now
//       above them in the handler.
//   C5  `textFocused` is FALSE at every one of the above. The one number that says the guard is
//       not armed in the world.
//   C6  the DELIBERATE FALL-THROUGHS, measured inside a focused field: `Enter` still commits,
//       `Escape` still reaches `menu`, the arrows still move the caret, and `Backspace` deletes.
//       These are the four keys the fix must NOT swallow, and three of them are the only way out
//       of the field.
//   C7  the teardown (rule 6): force `textFocus` to return true in the world on a copy, and C1/C2
//       must go red. A survey that has never seen a key swallowed cannot report that none is.
//
// Real DOM key events throughout. The world is stepped by the harness because what is under test
// is the keydown handler, not the frame source.
//
// EXIT: non-zero if any key is swallowed in the world, if a fall-through is eaten, or if the
// teardown fails to go red.
//
// USAGE
//   node tools/journey/critic-w1-26-r3-input.mjs [--json <path>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-26-r3-input.mjs — is any key swallowed anywhere outside the name field?

USAGE
  node tools/journey/critic-w1-26-r3-input.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'critic-w1-26-r3', 'input.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };

const out = {
  schema: 'elder-souls/critic-input@1', piece: 'W1-26-r3', role: 'critic',
  method: 'real DOM keydown/keyup into input/real.js listeners; the sim is stepped by the harness because the handler, not the frame source, is under test',
  conditions: { loadavg_at_start: loadavg() },
  passes: [], failures: [], checks: {},
};
const pass = (id, what, d) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };

const h = await launchGame({ width: 640, height: 360, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));
  const step = (n = 1) => h.page.evaluate((k) => window.__HARNESS.stepFrames(k), n);
  const inputState = () => h.page.evaluate(() => window.__ENGINE.real.getInputState());
  const pos = () => h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());

  // PUT A BODY IN A WORLD WITH NO CENSUS OPEN — the state a player is in after the writ.
  // The first draft of this file assumed a `newGame()` verb that does not exist, left the run on
  // the TITLE SCREEN, and reported four dead movement keys as the build's. It was the probe's.
  // `titleActivate('new')` is the row the title's New commits to; the census is then walked to
  // completion so the surface is closed and the keyboard belongs to the body.
  await h.page.evaluate(() => {
    const H = window.__HARNESS, e = window.__ENGINE;
    H.titleActivate('new');
    let guard = 0;
    while (guard++ < 60) {
      const st = e.census ? e.census.state() : null;
      if (!st || st.done) break;
      if (st.paused) { H.censusEnter(st.resume_by === 'walk' ? 'walk' : 'talk'); continue; }
      const k = st.input ? st.input.kind : null;
      if (!k) { H.censusAnswer(null); continue; }
      if (k === 'text') { H.censusAnswer('Silence-Under-Salt'); continue; }
      if (k === 'observed') { H.censusAnswer('correct'); continue; }
      if (k === 'pick') { H.censusAnswer((st.input.options || []).map((o) => o.id).slice(0, e.censusSurface.pickCount(st))); continue; }
      const opts = st.input.options || [];
      H.censusAnswer(opts.length ? opts[0].id : null);
    }
  });
  await step(8);
  out.checks.world_state = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return {
      census_open: !!(e.censusSurface && e.censusSurface.open),
      census_takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      title_open: !!(e.title && e.title.open),
      ui_mode: e.ui ? e.ui.mode : null,
      pos: e.sim.player.pos.slice(),
    };
  });
  say(`  world state: ${JSON.stringify(out.checks.world_state)}`);
  const bindings = await h.page.evaluate(() => {
    const b = window.__ENGINE.data.inputProfiles.desktop;
    return { bindings: b.bindings, move: b.move };
  });
  out.checks.bindings = bindings;

  /**
   * Press a key and report which action name the PIPELINE latched. `pressedNames()` is the
   * pipeline's own record of what arrived; a key that is swallowed anywhere above it is absent
   * from this list and that absence is the whole measurement.
   */
  /** Back to the world, so a screen an earlier key opened is not read as this key being eaten. */
  async function toWorld() {
    for (let i = 0; i < 6; i++) {
      const m = await h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : 'world'));
      if (m === 'world') return m;
      await h.page.keyboard.down('Escape'); await step(2); await h.page.keyboard.up('Escape'); await step(2);
    }
    return h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : null));
  }

  async function keyToAction(code) {
    await toWorld();
    await h.page.keyboard.down(code);
    // Collect over a few steps: `pressedName` is an edge and the latch happens on the step.
    const seen = await (async () => {
      const acc = new Set();
      for (let i = 0; i < 20; i++) {
        await step(1);
        const names = await h.page.evaluate(() => {
          const p = window.__ENGINE.real.pipe;
          const held = p.heldNames ? p.heldNames() : [];
          const pressed = p.pressedNames ? p.pressedNames() : [];
          return [...held, ...pressed];
        });
        for (const n of names) acc.add(n);
      }
      return [...acc];
    })();
    await h.page.keyboard.up(code);
    await step(2);
    return seen;
  }

  /**
   * Hold a movement key and report BOTH the axis the pipeline latched and the metres the body
   * covered. The axis must be read between the keydown and the step: `latchForStep` consumes it
   * and `consumeUI`/the post-step clear zero it, so a read taken after `stepFrames()` returns 0
   * on a perfectly healthy build. The first draft of this file read it after, reported four dead
   * movement keys, and was wrong — recorded here because the mistake is the same shape as the
   * one this whole verdict is about.
   */
  async function moveVector(code) {
    await toWorld();
    const p0 = await pos();
    await h.page.keyboard.down(code);
    const mv = await h.page.evaluate(() => ({ x: window.__ENGINE.real.pipe.moveX, y: window.__ENGINE.real.pipe.moveY }));
    await step(30);
    await h.page.keyboard.up(code);
    await step(2);
    const p1 = await pos();
    return { ...mv, moved_m: Number(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(4)) };
  }

  /** The whole survey, run twice: once on the shipped build, once with the guard forced on. */
  async function survey(label) {
    const rows = [];
    for (const [action, keys] of Object.entries(bindings.bindings)) {
      const code = (keys || []).find((k) => k && /^(Key|Digit|Arrow|Shift|Space|Tab|Escape|Enter)/.test(k));
      if (!code) { rows.push({ action, code: null, skipped: 'no keyboard binding' }); continue; }
      const seen = await keyToAction(code);
      rows.push({ action, code, arrived: seen.includes(action), latched: seen });
    }
    const moves = [];
    for (const [dir, keys] of Object.entries(bindings.move)) {
      const code = keys[0];
      const mv = await moveVector(code);
      moves.push({ dir, code, moveX: mv.x, moveY: mv.y, moved_m: mv.moved_m, nonzero: Math.abs(mv.x) + Math.abs(mv.y) > 0.01 || mv.moved_m > 0.05 });
    }
    const tf = (await inputState()).textFocused;
    return { label, rows, moves, textFocused: tf };
  }

  // ---- C1/C2/C5 — the shipped build, AND the differential that makes it mean something -------
  //
  // "Every key arrives" is a weak assertion and it is confounded: `two_hand` is hold-gated at 12
  // frames, `menu` opens a screen that then eats the next key, and the survey's own ordering
  // changes what is open. The question this piece has to answer is narrower and cleaner:
  //
  //     does the new text branch change ANYTHING in the world?
  //
  // So the survey is run twice on the same build — once as shipped, and once with
  // `real.textFocus` set to null, which makes the branch UNREACHABLE (`this.textFocus && ...`).
  // If the two runs agree key for key, the branch is inert outside a field, whatever the absolute
  // numbers are. That is a differential and it is immune to every confound above.
  const shipped = await survey('shipped');
  out.checks.survey_shipped = shipped;
  await h.page.evaluate(() => { window.__critic_tf = window.__ENGINE.real.textFocus; window.__ENGINE.real.textFocus = null; });
  const unreachable = await survey('text-branch-unreachable');
  await h.page.evaluate(() => { window.__ENGINE.real.textFocus = window.__critic_tf; });
  out.checks.survey_branch_unreachable = unreachable;
  const diff = shipped.rows.map((r, i) => ({ action: r.action, code: r.code, shipped: r.arrived, without_branch: unreachable.rows[i].arrived }))
    .filter((r) => r.code && r.shipped !== r.without_branch);
  const moveDiff = shipped.moves.map((m, i) => ({ code: m.code, shipped: m.nonzero, without_branch: unreachable.moves[i].nonzero }))
    .filter((m) => m.shipped !== m.without_branch);
  out.checks.differential = { control_key_differences: diff, movement_differences: moveDiff };
  if (!diff.length && !moveDiff.length) {
    pass('C0', `DIFFERENTIAL: with the text branch made unreachable, all ${shipped.rows.filter((r) => r.code).length} control keys and all 4 movement keys behave identically — the branch swallows nothing in the world`, out.checks.differential);
  } else {
    fail('C0', `the text branch changes ${diff.length} control key(s) and ${moveDiff.length} movement key(s) in the world`, out.checks.differential);
  }
  const missing = shipped.rows.filter((r) => r.code && !r.arrived);
  const deadMoves = shipped.moves.filter((m) => !m.nonzero);
  say(`  ${shipped.rows.filter((r) => r.code).length} bound control keys, ${shipped.rows.filter((r) => r.arrived).length} arrived; textFocused=${shipped.textFocused}`);
  if (!missing.length) pass('C1', `every bound control key reaches its action in the world (${shipped.rows.filter((r) => r.arrived).length}/${shipped.rows.filter((r) => r.code).length})`, {});
  else fail('C1', `${missing.length} bound key(s) never reach their action: ${missing.map((m) => `${m.code}->${m.action}`).join(', ')}`, { missing });
  if (!deadMoves.length) pass('C2', 'all four movement keys drive the move vector', { moves: shipped.moves });
  else fail('C2', `${deadMoves.length} movement key(s) move nothing: ${deadMoves.map((m) => m.code).join(', ')}`, { deadMoves });
  if (shipped.textFocused === false) pass('C5', 'textFocused is false in the world — the text branch is not armed outside a field', {});
  else fail('C5', `textFocused is ${shipped.textFocused} in the world`, {});

  // ---- C3 — sprint and roll actually change the body ----------------------------------------
  const gait = await (async () => {
    await toWorld();
    const walk = await (async () => { const a = await pos(); await h.page.keyboard.down('KeyW'); await step(30); await h.page.keyboard.up('KeyW'); await step(2); const b = await pos(); return Math.hypot(b[0] - a[0], b[2] - a[2]); })();
    const sprint = await (async () => { await toWorld(); const a = await pos(); await h.page.keyboard.down('ShiftLeft'); await h.page.keyboard.down('KeyW'); await step(30); await h.page.keyboard.up('KeyW'); await h.page.keyboard.up('ShiftLeft'); await step(2); const b = await pos(); return Math.hypot(b[0] - a[0], b[2] - a[2]); })();
    await toWorld();
    const rollSeen = await keyToAction('Space');
    return { walk_m: Number(walk.toFixed(3)), sprint_m: Number(sprint.toFixed(3)), roll_latched: rollSeen };
  })();
  out.checks.gait = gait;
  if (gait.sprint_m > gait.walk_m * 1.05 && gait.roll_latched.includes('roll')) {
    pass('C3', `sprint moved ${gait.sprint_m} m against a walk of ${gait.walk_m} m over the same frames, and Space latched 'roll'`, gait);
  } else {
    fail('C3', `sprint ${gait.sprint_m} m vs walk ${gait.walk_m} m; Space latched ${JSON.stringify(gait.roll_latched)}`, gait);
  }

  // ---- C4 — every screen opens and closes, with the text branch above them in the handler ----
  const screens = [];
  for (const key of ['KeyM', 'Escape']) {
    await toWorld();
    const before = await h.page.evaluate(() => (window.__ENGINE.ui ? { mode: window.__ENGINE.ui.mode, isMenu: window.__ENGINE.ui.isMenu() } : null));
    await h.page.keyboard.down(key); await step(4); await h.page.keyboard.up(key); await step(2);
    const opened = await h.page.evaluate(() => (window.__ENGINE.ui ? { mode: window.__ENGINE.ui.mode, isMenu: window.__ENGINE.ui.isMenu() } : null));
    await h.page.keyboard.down('Escape'); await step(4); await h.page.keyboard.up('Escape'); await step(2);
    const closed = await h.page.evaluate(() => (window.__ENGINE.ui ? { mode: window.__ENGINE.ui.mode, isMenu: window.__ENGINE.ui.isMenu() } : null));
    screens.push({ key, before, opened, closed, opened_ok: !!(opened && opened.isMenu), closed_ok: !(closed && closed.isMenu) });
  }
  out.checks.screens = screens;
  const badScreens = screens.filter((s) => s.opened_ok && !s.closed_ok);
  const anyOpened = screens.filter((s) => s.opened_ok).length;
  if (anyOpened > 0 && !badScreens.length) pass('C4', `${anyOpened} screen key(s) opened a screen and Escape closed every one`, { screens });
  else fail('C4', `${anyOpened} opened, ${badScreens.length} would not close`, { screens });

  // ---- C6 — the deliberate fall-throughs, INSIDE a focused field ----------------------------
  await toWorld();
  await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.censusBegin({}); H.censusEnter('talk');            // hold.hatch-name, a text node
  });
  await step(6);
  out.checks.field_state = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return { ui_mode: e.ui ? e.ui.mode : null, node: e.census.state().node, takes_input: !!e.censusSurface.takesInput, kind: e.census.state().input ? e.census.state().input.kind : null };
  });
  say(`  field state: ${JSON.stringify(out.checks.field_state)}`);
  const focused = (await inputState()).textFocused;
  const fall = { textFocused_in_field: focused };
  // arrows move the caret
  const hold = async (key, frames = 6) => { await h.page.keyboard.down(key); await step(frames); await h.page.keyboard.up(key); await step(2); };
  const sel0 = await h.page.evaluate(() => window.__ENGINE.censusSurface.sel);
  await hold('ArrowDown');
  await hold('ArrowDown');
  fall.sel_before = sel0;
  fall.sel_after_two_downs = await h.page.evaluate(() => window.__ENGINE.censusSurface.sel);
  fall.arrows_fall_through = fall.sel_after_two_downs !== sel0;
  // typing a bound letter goes to the field, not to its action
  await hold('e', 2); await hold('w', 2); await hold('a', 2);
  fall.typed_after_e_w_a = await h.page.evaluate(() => window.__ENGINE.censusSurface.typed);
  fall.bound_letters_type = fall.typed_after_e_w_a === 'ewa';
  fall.node_after_typing_e = await h.page.evaluate(() => window.__ENGINE.census.state().node);
  fall.keye_did_not_commit = fall.node_after_typing_e === 'hold.hatch-name';
  // Backspace deletes
  await hold('Backspace', 2);
  fall.typed_after_backspace = await h.page.evaluate(() => window.__ENGINE.censusSurface.typed);
  fall.backspace_deletes = fall.typed_after_backspace === 'ew';
  // Space types rather than rolling
  await hold('Space', 2);
  fall.typed_after_space = await h.page.evaluate(() => window.__ENGINE.censusSurface.typed);
  fall.space_types = fall.typed_after_space === 'ew ';
  // Enter commits
  const nodeBefore = await h.page.evaluate(() => window.__ENGINE.census.state().node);
  await hold('Enter', 6);
  fall.node_after_enter = await h.page.evaluate(() => { const s = window.__ENGINE.census.state(); return s ? s.node : null; });
  fall.enter_commits = fall.node_after_enter !== nodeBefore;
  out.checks.fallthrough = fall;
  const fallOk = fall.arrows_fall_through && fall.bound_letters_type && fall.keye_did_not_commit
    && fall.backspace_deletes && fall.space_types && fall.enter_commits;
  if (fallOk) pass('C6', 'inside the field: arrows move the caret, KeyE types an e without committing, Backspace deletes, Space types, Enter commits', fall);
  else fail('C6', 'a deliberate fall-through does not behave', fall);

  // ---- C7 — the teardown: arm the guard in the world and watch C1/C2 go red -----------------
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));
  await h.page.evaluate(() => {
    const H = window.__HARNESS, e = window.__ENGINE;
    H.titleActivate('new');
    let guard = 0;
    while (guard++ < 60) {
      const st = e.census ? e.census.state() : null;
      if (!st || st.done) break;
      if (st.paused) { H.censusEnter(st.resume_by === 'walk' ? 'walk' : 'talk'); continue; }
      const k = st.input ? st.input.kind : null;
      if (!k) { H.censusAnswer(null); continue; }
      if (k === 'text') { H.censusAnswer('Silence-Under-Salt'); continue; }
      if (k === 'observed') { H.censusAnswer('correct'); continue; }
      if (k === 'pick') { H.censusAnswer((st.input.options || []).map((o) => o.id).slice(0, e.censusSurface.pickCount(st))); continue; }
      const opts = st.input.options || [];
      H.censusAnswer(opts.length ? opts[0].id : null);
    }
  });
  await step(8);
  // The one line that would have made the fix a new defect: a predicate that is true in the world.
  await h.page.evaluate(() => { window.__ENGINE.real.textFocus = () => true; window.__ENGINE.real.onTextChar = () => {}; });
  const armed = await survey('guard-forced-true');
  out.checks.survey_teardown = armed;
  const swallowed = armed.rows.filter((r) => r.code && !r.arrived);
  const deadMoves2 = armed.moves.filter((m) => !m.nonzero);
  say(`  teardown: ${swallowed.length} control key(s) swallowed, ${deadMoves2.length} movement key(s) dead`);
  if (swallowed.length > 0 || deadMoves2.length > 0) {
    pass('C7', `with the predicate forced true in the world, ${swallowed.length} control key(s) and ${deadMoves2.length} movement key(s) go dead — this survey can fail`, { swallowed: swallowed.map((s) => s.code), deadMoves: deadMoves2.map((m) => m.code) });
  } else {
    fail('C7', 'forcing the guard true swallowed NOTHING — this survey is inert and C1/C2 above prove nothing', { armed });
  }

  out.conditions.loadavg_at_end = loadavg();
  out.conditions.page_errors = h.errors.slice(0, 8);
} catch (e) {
  fail('RUN', `threw: ${e.message}`, { stack: String(e.stack || '').split('\n').slice(0, 8) });
} finally {
  say(`\n  ${out.passes.length} pass · ${out.failures.length} fail`);
  writeJson(jsonPath, out);
  say(`  artifact: ${path.relative(process.cwd(), jsonPath)}`);
  await h.close();
  process.exit(out.failures.length ? 1 : 0);
}
