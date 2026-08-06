// The closed action set — HARNESS.md §4, owned by RI-JRN03 §A.
// Fourteen names. An unknown button is an error, never a silent no-op (HARNESS.md §4).
'use strict';

export const ACTIONS = [
  'light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump',
  'use_item', 'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu',
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
