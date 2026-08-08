// Bindings — RI-JRN03 §B (desktop, normative) and RI-JRN04 §C (pad profiles).
//
// THE BINDING TABLE IS DATA. It lives in `game/data/input/profiles.json` and is loaded at boot
// like every other model in the game; the objects exported here are populated from it by
// `setProfiles()` and are EMPTY until that has happened. That is deliberate and it is what
// `RI-MTH07`'s CONSUMPTION check is for: perturb `profiles.json` and a different button
// swings. A hard-coded literal here would be a model the world does not read, and the file
// would be paperwork.
//
// Matched on `KeyboardEvent.code` (physical key), NEVER `.key` and never `.keyCode`: on AZERTY
// `.key` for the W position is 'z' and a build matching `.key === 'w'` is unplayable in France
// (RI-JRN03 B1 / HF1).
//
// The three §B collision rulings are applied in the data file and must not be re-litigated:
//   block wins Mouse2 -> heavy = KeyR;  roll wins Space -> jump = KeyX;
//   parry wins Mouse1 -> lock_on = Tab (with Tab's focus behaviour suppressed).
//
// A FOURTH collision existed on disk and was not in §B's list because §B predates the two
// action-set amendments: `spell_cycle` (AM-W1-14-02) was bound to `KeyR`, which is `heavy`'s
// normative primary. `buildControlMap()` resolves a collision by insertion order, so
// `spell_cycle` took `KeyR` silently and the heavy attack was unreachable on the key the item
// names — an M-K1 hard fail that no test caught because nothing enumerated the map. Ruling, in
// §B's own form: **`heavy` keeps `KeyR`. `spell_cycle` = `KeyT` (+ `Digit2`).**
'use strict';

/** Mutable, populated by setProfiles(). Controls are `Key*`/`Digit*`, `Mouse<n>`, `Wheel±`. */
export const DEFAULT_BINDINGS = {};
export const MOVE_BINDINGS = {};
export const GAMEPAD_BINDINGS = {};
export const RESERVED_CONTROLS = [];
/** Keys whose default browser behaviour must be suppressed on the canvas (KB4–KB6). */
export const PREVENT_DEFAULT_CODES = new Set();

let PROFILES = null;
export function profiles() { return PROFILES; }
export function profilesLoaded() { return PROFILES !== null; }

/**
 * @param {object} doc game/data/input/profiles.json
 */
export function setProfiles(doc) {
  if (!doc || !doc.desktop || !doc.pad_profiles) {
    throw new Error('setProfiles: game/data/input/profiles.json is required. There is no hard-coded binding table to fall back on, by design (RI-MTH07).');
  }
  PROFILES = doc;
  for (const k of Object.keys(DEFAULT_BINDINGS)) delete DEFAULT_BINDINGS[k];
  for (const [a, pair] of Object.entries(doc.desktop.bindings)) DEFAULT_BINDINGS[a] = [pair[0] || null, pair[1] === undefined ? null : pair[1]];
  for (const k of Object.keys(MOVE_BINDINGS)) delete MOVE_BINDINGS[k];
  for (const [d, pair] of Object.entries(doc.desktop.move)) MOVE_BINDINGS[d] = pair.slice();
  for (const k of Object.keys(GAMEPAD_BINDINGS)) delete GAMEPAD_BINDINGS[k];
  const prof = doc.pad_profiles[doc.default_pad_profile];
  Object.assign(GAMEPAD_BINDINGS, { mapping: 'standard', profile: doc.default_pad_profile, buttons: { ...prof.buttons }, hold_gate: { ...prof.hold_gate }, axes: { ...prof.axes }, reserved: { ...prof.reserved } });
  RESERVED_CONTROLS.length = 0;
  RESERVED_CONTROLS.push(...(doc.reserved_controls || []));
  PREVENT_DEFAULT_CODES.clear();
  for (const c of ['Space', 'Tab', 'Slash', 'Quote', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) PREVENT_DEFAULT_CODES.add(c);
  for (const pair of Object.values(doc.desktop.bindings)) for (const c of pair) if (c && /^(Key|Digit)/.test(c)) PREVENT_DEFAULT_CODES.add(c);
  for (const pair of Object.values(doc.desktop.move)) for (const c of pair) if (c && /^(Key|Digit)/.test(c)) PREVENT_DEFAULT_CODES.add(c);
  const problems = auditBindings(DEFAULT_BINDINGS);
  if (problems.length) throw new Error('game/data/input/profiles.json fails its own audit: ' + problems.join('; '));
  return doc;
}

/** control -> action, built once. Two bindings per action (RI-JRN03 RB2). */
export function buildControlMap(bindings = DEFAULT_BINDINGS) {
  const map = Object.create(null);
  for (const action of Object.keys(bindings)) {
    for (const control of bindings[action]) if (control) map[control] = action;
  }
  return map;
}

/**
 * No default binding may require a chord, use a browser-reserved modifier, or COLLIDE with
 * another action. The collision check is new and it is the one that mattered: the audit ran
 * green for the whole of wave 1 with `heavy` and `spell_cycle` both on `KeyR`.
 */
export function auditBindings(bindings = DEFAULT_BINDINGS) {
  const problems = [];
  const seen = Object.create(null);
  for (const [action, controls] of Object.entries(bindings)) {
    for (const c of controls) {
      if (!c) continue;
      if (c.includes('+') && !/Hold\d+$/.test(c)) problems.push(`${action}: chord binding '${c}' violates RI-JRN03 A3`);
      if (/^Ctrl|^Alt/.test(c)) problems.push(`${action}: '${c}' uses a browser-reserved modifier (KB3)`);
      if (seen[c] && seen[c] !== action) problems.push(`COLLISION: '${c}' is bound to both '${seen[c]}' and '${action}'; buildControlMap() would silently give it to whichever is later and the other action would be unreachable (M-K1)`);
      seen[c] = action;
    }
  }
  for (const [action, controls] of Object.entries(bindings)) {
    if (!controls.some(Boolean)) problems.push(`${action}: no binding at all (RB5 / A1)`);
  }
  return problems;
}

/**
 * RI-JRN03 KB1 — key ghosting. A cheap membrane keyboard drops the 3rd or 4th simultaneous key
 * on the SAME matrix. KB1's ruling turns on the physical fact it states: "mouse buttons and
 * modifiers are on separate matrix paths", so `W`+`Shift`+`Space` is two matrix keys and one
 * modifier, not three matrix keys. `heavy` on `R` rather than `Shift+Mouse0` is the direct
 * consequence (A3) and this function is what would have caught the alternative.
 *
 * @returns {Array<{combo, matrix_keys, modifiers, offboard, ok}>}
 */
export function classifyControl(c) {
  if (!c) return 'none';
  if (/^(Shift|Control|Ctrl|Alt|Meta)/.test(c)) return 'modifier';
  if (/^(Mouse|Wheel)/.test(c)) return 'offboard';
  if (/^Pad|^Touch:|^Axis/.test(c)) return 'offboard';
  return 'matrix';
}

export function rolloverAudit(bindings = DEFAULT_BINDINGS, move = MOVE_BINDINGS) {
  const combos = [
    ['move', 'sprint', 'roll'],
    ['move', 'sprint', 'light'],
    ['move', 'block', 'roll'],
    ['move', 'heavy', 'roll'],
    ['move', 'sprint', 'roll', 'light'],
  ];
  const out = [];
  for (const combo of combos) {
    let matrix = 0, modifiers = 0, offboard = 0;
    const parts = [];
    for (const part of combo) {
      const c = part === 'move' ? (move.forward || [])[0] : (bindings[part] || [])[0];
      const k = classifyControl(c);
      parts.push({ part, control: c, path: k });
      if (k === 'matrix') matrix++; else if (k === 'modifier') modifiers++; else if (k === 'offboard') offboard++;
    }
    out.push({ combo, parts, matrix_keys: matrix, modifiers, offboard, ok: matrix <= 2 });
  }
  return out;
}
