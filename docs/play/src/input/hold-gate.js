// The tap/hold discriminator — ONE implementation, read by the pad and by the touchscreen.
//
// RI-JRN04 §C gives index 1 the roll/sprint gate; §G T5 requires the touchscreen to use "the
// SAME 12-frame tap/hold discriminator as §C, so the semantics a player learns on a pad
// transfer". Until this file existed that promise was kept by two copies of one line —
// `input/gamepad.js` `_applyButtons` and `input/touch.js` `tick` each computed
// `(frame - pressFrame + 1) >= (gate.frames || 12)` for themselves.
//
// Two copies of a rule is RULES 10 ("two parallel implementations of one system is how this
// build had a good detection model and a broken one at the same time"), and the off-by-one this
// arithmetic carries is exactly the kind that gets fixed on one path and not the other: the
// quantity is FRAMES HELD — the press frame counts — so a release at frame 12 is a SPRINT and a
// release at frame 11 is a ROLL. Measured against the raw delta, 12 came out as a roll on the
// pad, and the pad round fixed it there. Nothing would have made the touchscreen follow.
//
// It is deliberately three tiny functions rather than a class. The two callers keep their own
// state machines — a pad gate is keyed by button index inside a per-pad record, a touch gate is
// keyed by action inside a Map — and those are genuinely different because the devices are.
// What must not differ is the RULE, and the rule is here.
//
// HOW TO BREAK IT ON PURPOSE (RULES 4/6): change `DEFAULT_HOLD_GATE_FRAMES` or the comparison in
// `shouldPromote` and re-run `tools/touch/touch-run.mjs --leg gate`. Both the touch arm and the
// pad arm must move TOGETHER. If only one moves, this file is not the only implementation and
// T5 is a comment rather than a fact. `--serve-patched` does exactly that edit on a copy of the
// tree so the experiment needs no dirty working file.
'use strict';

/** §C/§G: twelve frames at 60 Hz. The only place this number is written down. */
export const DEFAULT_HOLD_GATE_FRAMES = 12;

/** The gate's own frame count, or §C's twelve. `gate` is a row of `profiles.json`. */
export function holdGateFrames(gate) {
  const n = gate && gate.frames;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOLD_GATE_FRAMES;
}

/**
 * Frames held INCLUSIVE of the press frame. This is the quantity RI-JRN04 M-P5 counts when it
 * says "released at 11 => roll, released at 12 => sprint", and computing it as the raw delta is
 * the off-by-one this module exists to stop happening twice.
 */
export function framesHeld(frame, pressFrame) { return frame - pressFrame + 1; }

/** True once the press has been held long enough to become the HOLD action. */
export function shouldPromote(frame, pressFrame, gate) {
  return framesHeld(frame, pressFrame) >= holdGateFrames(gate);
}
