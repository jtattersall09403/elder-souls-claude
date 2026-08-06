// The closed action set — HARNESS.md §4, owned by RI-JRN03 §A.
// FIFTEEN names as of wave-1 piece W1-15. An unknown button is an error, never a silent
// no-op (HARNESS.md §4).
//
// AMENDMENT AM-W1-15-01 — `crouch` added to the closed set.
// RI-STL01 §5 and its Comparison method open with: "Button `crouch` added to HARNESS.md §4's
// closed button set. Without it, no stealth scenario is scriptable at all. This is a blocking
// dependency." RI-STL01 "How we lose" makes the consequence explicit: without the button the
// item "scores 0 fail-closed under HARNESS.md §5, and it will look like a stealth-design
// failure rather than a tooling one."
//
// The set is closed, not frozen: HARNESS.md §4 requires that an unknown name THROW, which is
// a statement about unknown names, not a prohibition on the owning piece extending it by
// amendment. Fourteen names shipped because W1-00 had no stealth verb to name. This is the
// fifteenth and the only one W1-15 adds.
//
// Binding: KeyC, second slot KeyZ. Both were unbound; neither is in RESERVED_CONTROLS; the
// three §B collision rulings (block/Mouse2, roll/Space, parry/Mouse1) are untouched.
//
// `crouch` is a TOGGLE, not a hold — it is not in HELD_ONLY. Rationale, stated so a critic can
// disagree with a decision rather than guess at an accident: RI-STL01 §5 puts sneak movement at
// 0.85 m/s and a 40 m warehouse at 47 s crouched. A 47-second hold is a hand cramp, not a
// design. Dark Souls' own crouch is a toggle for the same reason.
'use strict';

export const ACTIONS = [
  'light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump',
  'use_item', 'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu',
  'crouch',
  // AM-W1-14-02 (HARNESS §4 amendment, requested verbatim by RI-MAG01 §C): ONE new verb.
  // Casting itself reuses `light` and `heavy` with a catalyst equipped, exactly the Souls
  // mapping; `spell_cycle` only rotates among ALREADY-ATTUNED spells and is free — 0 stamina,
  // 0 focus, 6 f@60, cancellable. It exists so that nobody ever needs a spell WHEEL, which
  // would be a menu that pauses the fight and would kill seam S14. Attuning is a HEARTH action.
  'spell_cycle',
];

/** action -> bit index. Held/pressed/released are bitmasks so the pipeline allocates nothing. */
export const BIT = Object.create(null);
for (let i = 0; i < ACTIONS.length; i++) BIT[ACTIONS[i]] = 1 << i;

/** RI-JRN03 §A: `block` and `sprint` are held, never toggled. */
export const HELD_ONLY = new Set(['block', 'sprint']);

export function bitOf(name) {
  const b = BIT[name];
  if (b === undefined) {
    throw new Error(`unknown button '${name}'. The action set is closed (HARNESS.md §4): ${ACTIONS.join(' ')}`);
  }
  return b;
}

export function maskToNames(mask, out) {
  out.length = 0;
  for (let i = 0; i < ACTIONS.length; i++) if (mask & (1 << i)) out.push(ACTIONS[i]);
  return out;
}
