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
  spell_cycle: ['KeyR'],
};

export const MOVE_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/**
 * Default gamepad bindings — the W3C **standard mapping**, which is what a GameSir X2s
 * Type-C, an Xbox pad and a DualSense all report.
 *
 * Owner note: `RI-JRN04` owns the full mobile/gamepad item. What is here is the minimum
 * `RI-JRN01` O17 requires and which W1-07 cannot be measured without: the whole opening,
 * including every creation question, completable on a pad alone. The layout follows Souls'
 * own: A confirms, B goes back, RB/RT attack, LB/LT block and parry, B rolls.
 *
 * Face buttons 0=A(south) 1=B(east) 2=X(west) 3=Y(north); 4=LB 5=RB 6=LT 7=RT;
 * 8=back 9=start; 10/11=stick clicks; 12-15=D-pad; 16=guide.
 */
export const GAMEPAD_BINDINGS = {
  mapping: 'standard',
  buttons: {
    interact: 0,        // A — confirm, talk, pick up. The whole census needs only this.
    roll: 1,            // B
    use_item: 2,        // X
    jump: 3,            // Y
    parry: 4,           // LB
    light: 5,           // RB
    block: 6,           // LT — held, per RI-JRN03 A-HELD
    heavy: 7,           // RT
    menu: 9,            // start
    lock_on: 10,        // L3
    crouch: 11,         // R3
    two_hand: 8,        // back
  },
  axes: { move_x: 0, move_y: 1, look_x: 2, look_y: 3 },
  dpad_buttons: { up: 12, down: 13, left: 14, right: 15 },
  note: 'Left stick and the D-pad both drive `move`, so every list in the game is walkable with a thumb; the right stick goes through RI-CAM02 §A shaping.',
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
