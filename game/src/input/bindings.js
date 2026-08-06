// Default desktop bindings — RI-JRN03 §B, normative, transcribed verbatim.
//
// Matched on KeyboardEvent.code (physical key), NEVER .key and never .keyCode: on AZERTY
// `.key` for the W position is 'z' and a build matching `.key === 'w'` is unplayable in
// France (RI-JRN03 B1 / HF1).
//
// The three collision rulings of §B are already applied here and must not be re-litigated:
//   block wins Mouse2 → heavy = KeyR;  roll wins Space → jump = KeyX;
//   parry wins Mouse1 → lock_on = Tab (with Tab's focus behaviour suppressed).
'use strict';

/** Controls are named uniformly: `Key*`/`Digit*`/... for keys, `Mouse<n>` for buttons, `Wheel±`. */
export const DEFAULT_BINDINGS = {
  light: ['Mouse0', null],
  block: ['Mouse2', 'KeyF'],
  parry: ['Mouse1', 'KeyV'],
  heavy: ['KeyR', 'Mouse3'],
  roll: ['Space', 'Mouse4'],
  sprint: ['ShiftLeft', null],
  jump: ['KeyX', null],
  interact: ['KeyE', 'Enter'],
  use_item: ['Digit1', null],
  lock_on: ['Tab', 'Mouse1Hold12'],
  two_hand: ['KeyG', null],
  swap_right: ['Digit3', 'WheelUp'],
  swap_left: ['Digit4', 'WheelDown'],
  menu: ['Escape', 'KeyM'],
  // W1-15 / AM-W1-15-01. RI-STL01's blocking dependency. Both slots were unbound.
  crouch: ['KeyC', 'KeyZ'],
};

export const MOVE_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** RI-JRN03 KB3 — controls a rebind must refuse, because the user agent owns them. */
export const RESERVED_CONTROLS = [
  'Ctrl+KeyW', 'Ctrl+KeyR', 'Ctrl+KeyT', 'Ctrl+KeyN', 'Ctrl+Shift+KeyI',
  'F5', 'F11', 'F12', 'AltLeft+F4',
];

/** Keys whose default browser behaviour must be suppressed on the canvas (KB4–KB6). */
export const PREVENT_DEFAULT_CODES = new Set([
  'Space', 'Tab', 'Slash', 'Quote', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ...Object.values(DEFAULT_BINDINGS).flat().filter((c) => c && /^(Key|Digit)/.test(c)),
]);

/** control -> action, built once. Two bindings per action (RI-JRN03 RB2). */
export function buildControlMap(bindings = DEFAULT_BINDINGS) {
  const map = Object.create(null);
  for (const action of Object.keys(bindings)) {
    for (const control of bindings[action]) if (control) map[control] = action;
  }
  return map;
}

/** No default binding may require a chord, or three simultaneous keyboard keys (A3/KB1). */
export function auditBindings(bindings = DEFAULT_BINDINGS) {
  const problems = [];
  for (const [action, controls] of Object.entries(bindings)) {
    for (const c of controls) {
      if (!c) continue;
      if (c.includes('+') && !/Hold\d+$/.test(c)) problems.push(`${action}: chord binding '${c}' violates RI-JRN03 A3`);
      if (/^Ctrl|^Alt/.test(c)) problems.push(`${action}: '${c}' uses a browser-reserved modifier (KB3)`);
    }
  }
  return problems;
}
