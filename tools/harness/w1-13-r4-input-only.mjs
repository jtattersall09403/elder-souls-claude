// NEXT-DISPATCH §P.6 — IS THE LEVEL SPEND REACHABLE BY INPUT ALONE?
//
// Binding: `NEXT-DISPATCH.md` §P.5 / §P.6; `RI-PRG04` §1 (the hearth); `RI-JRN03` §A (the closed
// sixteen-action set); `RI-UIX03` L1 (the level-up screen exists at a hearth only).
//
// §P.5 asks that a level be SPENDABLE and the W1-13 round-3 verdict scored it met: the screen
// lists the ten attributes the character carries, a spend goes through the drawn screen and the
// real input path, and it buys +208 hp_max. §P.6 asks for something strictly harder — a session
// "driven only through input, nothing set by a harness verb" — and round 3 was refused it because
// the spend it demonstrated was reached through `H.openMenu('levelup')`.
//
// The question this file answers is narrower than a play session and is the one that decides
// whether such a session is even POSSIBLE: standing at a hearth, with the world running, is there
// ANY key in the shipped action set that puts the level-up screen on the screen?
//
// It is measured rather than read off the source, because reading the source is how the last three
// rounds of this piece got their mechanism claims wrong. Every one of the sixteen actions
// `RI-JRN03` §A closes the set at is pressed, one at a time, through `queueInputs` — the same path
// a keyboard drives — from the world and from every screen a key does open, and the resulting
// `getUIState().mode` is recorded. `openMenu` is never called.
//
// THE CONTROL. A probe that presses sixteen keys and finds no level-up screen has to prove it can
// find one at all, or it is measuring a broken press loop. So the same script also records which
// modes the same presses DO reach, and the run fails if it reaches none.

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r4-input-only.mjs [--out <file>]'); process.exit(0); }

const out = {
  schema: 'w1-13/r4-input-only@1',
  git: gitInfo(),
  taken_at: new Date().toISOString(),
  question: 'NEXT-DISPATCH §P.6 — can a player open the level-up screen without a harness verb?',
  checks: {},
};

const ARM = async () => {
  const H = window.__HARNESS;
  const eng = window.__ENGINE || (H && H._engine);
  const r = {};
  try {
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    const wells = (H.listHearths().hearths || []);
    const well = wells.find((x) => x.kind === 'settlement') || wells[0];
    H.teleport(well.pos[0], well.pos[2]);
    H.stepFrames(30);

    const set = H.getActionSet();
    r.actions = set.actions.slice();
    r.desktop_bindings = set.bindings;

    const ui = () => { const s = H.getUIState(); return s ? s.mode : null; };
    r.at_hearth = !!(H.getUIState() && H.getUIState().at_hearth);
    // The world's own answer, not the harness override.
    try { r.hearth_here = (H.listHearths().hearths || []).length ? well.id : null; } catch (e) { /**/ }

    const press = (action) => {
      const f = eng.sim.frame;
      H.queueInputs([{ f: f + 1, press: [action] }, { f: f + 3, release: [action] }]);
      H.stepFrames(12);
      return ui();
    };
    const reset = () => { H.clearInputs(); if (ui() !== 'world') H.closeMenu(); H.stepFrames(4); };

    // ---- pass 1: every action, from the world -------------------------------------------------
    r.from_world = {};
    for (const a of r.actions) { reset(); r.from_world[a] = press(a); }
    reset();

    // ---- pass 2: every action, from every screen pass 1 could open ----------------------------
    const opened = [...new Set(Object.values(r.from_world).filter((m) => m && m !== 'world'))];
    r.screens_reachable_from_world = opened;
    r.from_each_screen = {};
    for (const screen of opened) {
      // Get back to that screen the way the player did, then try all sixteen from inside it.
      const opener = r.actions.find((a) => r.from_world[a] === screen);
      r.from_each_screen[screen] = { opener, results: {} };
      for (const a of r.actions) {
        reset();
        press(opener);
        if (ui() !== screen) { r.from_each_screen[screen].results[a] = `could not re-open (${ui()})`; continue; }
        r.from_each_screen[screen].results[a] = press(a);
      }
      // The axes too — a screen may be a tab strip.
      for (const [name, mv] of [['left', [-1, 0]], ['right', [1, 0]], ['up', [0, 1]], ['down', [0, -1]]]) {
        reset();
        press(opener);
        if (ui() !== screen) continue;
        const f = eng.sim.frame;
        H.queueInputs([{ f: f + 1, move: mv }, { f: f + 20, move: [0, 0] }]);
        H.stepFrames(30);
        r.from_each_screen[screen].results[`axis_${name}`] = ui();
      }
    }
    reset();

    // ---- what the UI model ADVERTISES, beside what input reaches -------------------------------
    // `ui/system.js navigable(ctx)` pushes 'levelup' onto the destination list whenever the player
    // is at a hearth. If input cannot reach it, that list is advertising a room with no door.
    r.navigable_from_world = (() => {
      try { return eng.ui.navigable(eng._uiContext ? eng._uiContext() : eng.uiContext()); } catch (e) { return null; }
    })();

    const allModes = new Set();
    for (const m of Object.values(r.from_world)) if (m) allModes.add(m);
    for (const s of Object.keys(r.from_each_screen)) {
      for (const m of Object.values(r.from_each_screen[s].results)) if (typeof m === 'string') allModes.add(m);
    }
    r.modes_input_can_reach = [...allModes].sort();
    r.levelup_reached_by_input = allModes.has('levelup');
    r.levelup_advertised_by_navigable = Array.isArray(r.navigable_from_world)
      && r.navigable_from_world.includes('levelup');

    // THE CONTROL: the harness verb, on the same body, on the same frame, so that "no key opens it"
    // is a statement about the input path and not about the hearth, the state or the screen.
    let verbWorked = null, verbErr = null;
    try { H.openMenu('levelup'); H.stepFrames(4); verbWorked = ui() === 'levelup'; }
    catch (e) { verbErr = String(e && e.message || e); }
    r.harness_verb_opens_it = verbWorked;
    r.harness_verb_error = verbErr;
    return r;
  } catch (e) {
    r.fatal = String((e && e.stack) || e);
    return r;
  }
};

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const res = await handle.page.evaluate(ARM);
  out.checks.input_only = res;
  out.verdict = {
    level_spend_reachable_by_input_alone: !!res.levelup_reached_by_input,
    modes_input_can_reach: res.modes_input_can_reach,
    levelup_advertised_but_unreachable:
      !!res.levelup_advertised_by_navigable && !res.levelup_reached_by_input,
    the_probe_can_open_screens_at_all: (res.modes_input_can_reach || []).some((m) => m !== 'world'),
    harness_verb_opens_it: res.harness_verb_opens_it,
    reading: !res.levelup_reached_by_input
      ? 'NEXT-DISPATCH §P.6 CANNOT BE MET AS THE TREE STANDS. `menu` opens the inventory and '
        + 'ui/system.js step() has no branch that walks from one screen to a peer, so the '
        + 'level-up screen has no door in the sixteen-action set. `navigable(ctx)` publishes it '
        + 'as a destination at a hearth and nothing consumes that list.'
      : 'a key opens it; §P.6 needs only the session now.',
  };
  // An absence-reporter: non-zero when the thing asked for is not there, non-zero also when the
  // probe itself proves inert by opening nothing at all.
  out.ok = !!out.verdict.the_probe_can_open_screens_at_all && !!out.verdict.level_spend_reachable_by_input_alone;
  log(`input-only: reached ${JSON.stringify(res.modes_input_can_reach)} · levelup by input = ${res.levelup_reached_by_input} · advertised by navigable = ${res.levelup_advertised_by_navigable} · harness verb opens it = ${res.harness_verb_opens_it}`);
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
  out.ok = false;
  log(`ERROR ${out.error}`);
} finally {
  if (handle) await handle.close();
}

writeJson(args.out || 'reports/runs/W1-13-R4/input-only.json', out);
process.exit(out.ok ? 0 : 1);
