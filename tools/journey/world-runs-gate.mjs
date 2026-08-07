// world-runs-gate.mjs — one implementation of "is the simulation actually advancing?", used by
// every journey rather than by one.
//
// WHY THIS FILE EXISTS, in the words of the measurement that forced it.
//
// `Engine._step()` returns early while a UI screen is open outside combat. That is seam S14 and
// it is correct: outside a fight, in a menu, the world does not advance. What is NOT correct is
// what it does to an instrument. Every journey in this repo drives the world with
// `stepFrames(n)` and then reads the result. On a frozen world that sequence produces nothing —
// no motion, no death, no bloodstain, no event — and every check downstream reports a clean,
// quiet, entirely fictional pass. The W1-13 round-2 run returned twenty rows with
// `stain_souls: null` and printed `[OK]` nineteen times.
//
// `loadState()` DOES NOT CLOSE AN OPEN SCREEN. The W1-13 round-2 critic swept it: **12 of 12**
// combinations of `{arena_flat, settlement_primary_street, barge-hold} × {inventory, journal,
// sheet, map}` freeze the world, and `loadState` rescues **none** of them — the mode after the
// load is still the screen and `stepFrames` still advances 0. So a screen opened by one leg of
// `journey-run.mjs` survives every state change the rest of the run makes and silently voids it.
//
// Round 2 put a gate in `jrn06-death.mjs` alone. The critic's answer was that `jrn01`, `jrn02`,
// `jrn03`, `jrn05`, `jrn07`, `jrn08` and `jrn09` are all exposed, and proved it is not
// hypothetical: in the very run that measured the sweep, `journey-run.mjs`'s **own** null control
// went `unmeasurable` — "the player did not move between [2766.5,2.68,5011] and
// [2766.5,2.68,5011] after 60 frames of forward input" — one leg earlier, unguarded.
//
// So the gate is lifted out of the one journey that had it and made central. It is a MODULE and
// not a copied block on purpose: a check that exists in eight copies is a check that is true in
// seven of them.
//
// WHAT IT DOES NOT DO. It does not assert that the world SHOULD run — S14 says a screen stops it
// and that is the design. It closes what is up, the way a player would, and then PROVES the world
// moves by stepping it and reading `sim.frame`. If it still does not move it refuses to measure.
// Refusing is the point: a probe that cannot fail is worse than no probe (AGENT-PROTOCOL).

'use strict';

/**
 * `getFrame()` returns a NUMBER (`engine.sim.frame`); `stepFrames()` returns `{frame, t_ms}`.
 * Reading `.frame` off the former yields `undefined`, and `undefined - undefined` is `NaN`,
 * which is not equal to 5 — so the first version of this gate refused to measure a world that
 * was running perfectly well. Both shapes are accepted.
 */
export function frameNumberOf(r) {
  if (typeof r === 'number') return r;
  if (r && typeof r.frame === 'number') return r.frame;
  return NaN;
}

/**
 * Close whatever screen is up and prove the world advances.
 *
 * @param {object} h        the journey handle (`h.h(verb, ...)` / `h.hOpt(verb, ...)`)
 * @param {object} [opt]
 * @param {number} [opt.frames=5]  how many frames to step as the proof
 * @param {string} [opt.site]      a label for where in the run the gate fired
 * @returns {Promise<{ok:boolean, site:string, ui_mode_on_entry:*, ui_mode_after_close:*,
 *                     frame_before:number, frame_after:number, advanced:number,
 *                     screen_was_open:boolean, why:(string|null)}>}
 */
export async function worldRunsGate(h, opt = {}) {
  const frames = opt.frames === undefined ? 5 : opt.frames;
  const site = opt.site || 'unnamed';

  const before = (await h.hOpt('getUIState')) || {};
  const wasOpen = !!(before.mode && before.mode !== 'world');
  if (wasOpen) await h.h('closeMenu').catch(() => {});
  const after = (await h.hOpt('getUIState')) || {};

  const f0 = frameNumberOf(await h.h('getFrame'));
  await h.h('stepFrames', frames);
  const f1 = frameNumberOf(await h.h('getFrame'));
  const advanced = f1 - f0;

  const ok = advanced === frames;
  return {
    ok,
    site,
    ui_mode_on_entry: before.mode === undefined ? null : before.mode,
    ui_mode_after_close: after.mode === undefined ? null : after.mode,
    screen_was_open: wasOpen,
    frame_before: f0, frame_after: f1, advanced, frames_requested: frames,
    why: ok ? null
      : `the simulation is not advancing: stepFrames(${frames}) moved sim.frame by ${advanced}, with the UI in `
        + `mode ${JSON.stringify(after.mode)} after a closeMenu(). Journeys drive the world with stepFrames, so on a `
        + 'stopped world every check downstream would report a quiet, false pass. Refusing to measure. S14 stops the '
        + 'world while a screen is open outside combat, and loadState() does not close one (12 of 12 state x screen '
        + 'combinations measured), so a screen opened by an earlier leg freezes everything after it.',
  };
}

/**
 * The gate plus its ledger row, which is what a caller normally wants.
 *
 * Writes ONE row named `world_runs_<site>`: `ok` when the world moves and `unmeasurable` when it
 * does not, so a frozen run is visible in the ledger at the site it froze rather than as eight
 * downstream nulls. When a screen really was open the row carries what it was, because that is
 * the diagnostic — the round-2 critic's run found `inventory`, which is how the leg that leaves
 * it open was identified at all.
 */
export async function gateOrRefuse(h, led, site, opt = {}) {
  const g = await worldRunsGate(h, { ...opt, site });
  const id = `world_runs_${site}`;
  if (g.ok) {
    led.ok(id, `the world advances at '${site}'`, g);
  } else {
    led.unmeasurable(id, `the world advances at '${site}'`, g.why, opt.owner || 'W1-13 (S14) / the leg that left a screen open');
  }
  return g;
}
