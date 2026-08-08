// The tap/hold discriminator — ONE implementation, read by the pad, the keyboard/mouse and the
// touchscreen — and, since S39, ONE clock.
//
// RI-JRN04 §C gives index 1 the roll/sprint gate; §G T5 requires the touchscreen to use "the
// SAME 12 f@60 tap/hold discriminator as §C, so the semantics a player learns on a pad
// transfer". Until this file existed that promise was kept by two copies of one line —
// `input/gamepad.js` `_applyButtons` and `input/touch.js` `tick` each computed
// `(frame - pressFrame + 1) >= (gate.frames || 12)` for themselves.
//
// Two copies of a rule is RULES 10 ("two parallel implementations of one system is how this
// build had a good detection model and a broken one at the same time"), and the off-by-one this
// arithmetic carries is exactly the kind that gets fixed on one path and not the other: the
// quantity is FRAMES HELD — the press frame counts — so a release at 12 f@60 is a SPRINT and a
// release at 11 f@60 is a ROLL. Measured against the raw delta, 12 came out as a roll on the
// pad, and the pad round fixed it there. Nothing would have made the touchscreen follow.
//
// ---------------------------------------------------------------------------------------------
// S39 — WHY THIS FILE NOW COUNTS IN MILLISECONDS AND STILL SPEAKS IN FRAMES
// ---------------------------------------------------------------------------------------------
// `ARBITRATION.md` S39 classifies a duration by WHERE ITS TWO ENDPOINTS ARE GENERATED:
//
//   (a) both endpoints in the simulation  -> f@60 forever, and it may never read a wall clock.
//   (b) both endpoints in the player's HAND -> stamped in ms from `event.timeStamp`, converted
//       to f@60 ONCE, at the input boundary, and an integer from there inward.
//   (c) one endpoint each -> the simulation owns it and it stays f@60 (S33's family).
//
// "How long was this button held" is (b), and this file is the boundary. Before S39 it was
// implemented as (a) — `frame - pressFrame + 1`, with `pressFrame` read in a DOM handler and
// `frame` only advancing inside rAF. The two are the same number ONLY while the world runs at
// wall-clock speed. `game/src/core/loop.js` drops surplus time above `MAX_CATCHUP = 5` steps per
// rAF, so below 12.00 rAF Hz the whole world enters uniform slow motion — and the thumb does not.
//
// The measured consequence, from `reports/critic-w1-touch/critic-gate-wallclock.json` at
// `fa96455`: five presses asked at 20 / 60 / 120 / 250 / 500 ms, wall spans of 1,581-2,104 ms,
// all five reported `frames_held: 1` and all five ROLLED. At 60 Hz those presses are
// 1 / 4 / 7 / 15 / 30 f@60 and the 12 f@60 gate splits them roll/roll/roll/sprint/sprint, so the
// discriminator was INVERTED on 2 of 5. It was not coarse; it was uncorrelated with the press,
// because `sim.frame` did not advance at all while the presses were happening.
//
// THE INCLUSIVE +1, AND WHY IT SURVIVES THE REWRITE. S39 writes the conversion as
// `Math.round((tUp - tDown) / STEP_MS)`. That is the number of STEP BOUNDARIES crossed; the
// quantity this gate has always used, and the one `RI-JRN04` M-P5 is written in, is the number of
// FRAMES OCCUPIED, which is one more. A harness press driven by `stepFrames(n)` occupies n frames
// and spans (n-1) * STEP_MS of stamped time, so `framesHeld` keeps the `+ 1` and M-P5's boundary
// ("roll at 11, sprint from 12") is unmoved on every path. S39's own falsifier allows this: it
// requires `frames_held` within +/-1 f@60 of `round(asked_ms / 16.667)`, and it predicts the
// promotion pattern roll/roll/roll/sprint/sprint for 20/60/120/250/500 ms — which `+1` gives
// exactly (2/5/8/16/31 f@60 against a 12 f@60 gate). Dropping the `+1` would satisfy the
// arithmetic and break M-P5, which is the more load-bearing of the two.
//
// HOW TO BREAK IT ON PURPOSE (RULES 4/6):
//   * change `DEFAULT_HOLD_GATE_FRAMES` or the comparison in `shouldPromote` and re-run
//     `tools/touch/touch-run.mjs --leg gate`. Both the touch arm and the pad arm must move
//     TOGETHER. If only one moves, this file is not the only implementation and T5 is a comment
//     rather than a fact. `--serve-patched` does exactly that edit on a copy of the tree.
//   * change `inputNow()` to return `frame * STEP_MS` in mode `play` and re-run
//     `tools/touch/r2-gate-clock.mjs`. That restores the pre-S39 behaviour exactly and the
//     play-mode arm must go red — five presses, one verdict, `frames_held` constant.
'use strict';

import { wallNow } from '../core/guards.js';
import { inFixedStep } from '../core/loop.js';

/** The fixed step, in ms. The one conversion factor between the hand's clock and the sim's. */
export const STEP_MS = 1000 / 60;

/** §C/§G: twelve frames at 60 Hz (12 f@60 = 200 ms). The only place this number is written. */
export const DEFAULT_HOLD_GATE_FRAMES = 12;

/** The gate's own frame count in f@60, or §C's twelve. `gate` is a row of `profiles.json`. */
export function holdGateFrames(gate) {
  const n = gate && gate.frames;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOLD_GATE_FRAMES;
}

/**
 * THE ONE CLOCK SOURCE AT THE INPUT BOUNDARY (S39). Returns ms.
 *
 * `play`                        -> the event's own `timeStamp`, which the browser writes when the
 *                                  input OCCURRED. Never `performance.now()` inside the handler:
 *                                  that is written when the handler RAN, and a 431 ms rAF starve
 *                                  is exactly when those differ — it would reproduce the bug in a
 *                                  new place. `wallNow()` is the fallback for the two synthetic
 *                                  call sites that have no event (the pad poll, `releaseAll`).
 * `harness` / `play-instrumented` -> `frame * STEP_MS`, the same quantity `sim/state.js` publishes
 *                                  as `t_ms`. A `stepFrames`-driven press of N frames therefore
 *                                  stamps as exactly N f@60 and M-P5 stays executable by hand.
 *                                  Without this the fix would be the mirror image of the bug:
 *                                  correct on a phone and invisible to every harness check.
 *
 * @param {string} mode   `loop.mode`
 * @param {number} frame  the current FIXED sim frame
 * @param {Event=} event  the DOM event that generated this endpoint, if there is one
 */
export function inputNow(mode, frame, event) {
  if (mode === 'play') {
    // FAIL-CLOSED (S39: "the millisecond may never cross into the fixed step"). `wallNow()`
    // deliberately bypasses `guards.js`'s armed trap so the loop can time itself, which means a
    // wall read from inside the step would be SILENT here. This is the one place that can catch
    // it, so it throws rather than trusting the comment. Proven silent on the shipped tree by
    // `tools/touch/r2-gate-clock.mjs --leg boundary`, and proven to bite by that leg's control.
    if (inFixedStep()) {
      throw new Error(
        'S39 VIOLATION: inputNow() was called in mode `play` from inside a fixed simulation step. ' +
        'A hand-clock millisecond may not cross the step boundary. Promote holds from the rAF ' +
        'poll (RealInput.pollGamepad) in play mode, or pass `frame * STEP_MS` in harness modes.');
    }
    const t = event && event.timeStamp;
    return Number.isFinite(t) && t > 0 ? t : wallNow();
  }
  return frame * STEP_MS;
}

/**
 * Frames held, INCLUSIVE of the press frame, converted from a stamped wall-clock span.
 *
 * This is the quantity RI-JRN04 M-P5 counts when it says "released at 11 => roll, released at 12
 * => sprint". Both arguments are ms; the return is f@60. See the header for why the `+ 1` stays.
 *
 * @param {number} tDownMs  ms, stamped at the press
 * @param {number} tNowMs   ms, stamped now (at the release, or at the poll)
 * @returns {number} f@60
 */
export function framesHeld(tDownMs, tNowMs) {
  const dtMs = tNowMs - tDownMs;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 1;
  return Math.round(dtMs / STEP_MS) + 1;
}

/**
 * True once the press has been held long enough to become the HOLD action.
 * @param {number} tDownMs ms  @param {number} tNowMs ms  @param {object} gate a `profiles.json` row
 */
export function shouldPromote(tDownMs, tNowMs, gate) {
  return framesHeld(tDownMs, tNowMs) >= holdGateFrames(gate);
}
