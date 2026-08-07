// The rebinding model — RI-JRN03 §E. Owned by this item; RI-JRN04 consumes it for the pad.
//
//   RB1  all sixteen actions rebindable, plus movement, plus every mouse button
//   RB2  two bindings per action, and they may be on different devices
//   RB3  bound by PRESSING the control, never by choosing from a list
//   RB4  conflicts are detected and shown BEFORE commit, naming the action that currently owns
//        the control; the player may take it, which unbinds the other and says so
//   RB5  an action left with zero bindings on the active device is refused (A1)
//   RB6  reserved chords (KB3) and pad index 16 are refused with an IN-FICTION line
//   RB7  per-device profiles: a keyboard change does not alter the gamepad profile
//   RB8  restore defaults, per device
//   RB9  persists via RI-JRN05's store and survives a cold reload
//   RB10 completable on EACH modality alone — keyboard-only, gamepad-only, touch-only. This is
//        where A1 is most often broken, because a rebinding UI is the most mouse-shaped screen
//        in any game, so this one is a LIST WALKED BY THE ACTION SET: `move` walks the rows,
//        `interact` starts a capture, `menu` backs out. No pointer is required anywhere.
//   RB11 the surface is cursor-driven and therefore releases pointer lock on open and
//        re-requests it on close (PL3)
//
// RB2's "two bindings" is the reason the model is `{[action]: [primary, secondary]}` on every
// device rather than a flat control->action map: a control map is derived, a binding list is
// authored, and a conflict is only visible in the authored form.
'use strict';

export const DEVICES = ['keyboard', 'gamepad', 'touch'];

/** The in-fiction refusals. RB6: a validation error is a UI-kit noise, not a line in a world. */
const REFUSALS = {
  reserved: 'The bindings hold. That hand belongs to the window, not to you.',
  guide: 'That one answers to the machine before it answers to you.',
  empty: 'Leave it unbound and you leave it undone.',
  unknown: 'Nothing answered.',
};

export class Rebinder {
  /**
   * @param {object} profiles game/data/input/profiles.json
   * @param {object} opts {store, onCommit}
   */
  constructor(profiles, opts = {}) {
    this.profiles = profiles;
    this.reserved = new Set((profiles.reserved_controls || []).map((s) => s.toLowerCase()));
    this.reservedPadIndex = profiles.reserved_pad_index === undefined ? 16 : profiles.reserved_pad_index;
    this.store = opts.store || null;
    this.onCommit = opts.onCommit || null;
    this.actions = profiles.action_set.slice();
    this.rows = this.actions.concat(['move_forward', 'move_back', 'move_left', 'move_right']);
    this.device = 'keyboard';
    this.bindings = this.defaults();
    this.open = false;
    this.cursor = 0;
    this.slot = 0;               // 0 primary, 1 secondary
    this.capturing = false;
    this.pending = null;         // {control, conflictWith}
    this.message = null;
    this.log = [];
  }

  /** RB8 — per device, from the data file, never from a hard-coded literal. */
  defaults() {
    const d = this.profiles.desktop;
    const kb = {};
    for (const [a, pair] of Object.entries(d.bindings)) kb[a] = [pair[0] || null, pair[1] || null];
    for (const [dir, pair] of Object.entries(d.move)) kb['move_' + dir] = [pair[0] || null, pair[1] || null];
    const padProfile = this.profiles.pad_profiles[this.profiles.default_pad_profile];
    const gp = {};
    for (const a of this.actions) gp[a] = [null, null];
    for (const [a, i] of Object.entries(padProfile.buttons)) gp[a] = ['Pad' + i, gp[a] ? gp[a][1] : null];
    for (const g of Object.values(padProfile.hold_gate || {})) { /* tap/hold share one index */ }
    for (const [idxs, g] of Object.entries(padProfile.hold_gate || {})) {
      gp[g.tap] = ['Pad' + idxs, gp[g.tap] ? gp[g.tap][1] : null];
      gp[g.hold] = ['Pad' + idxs + 'Hold' + (g.frames || 12), gp[g.hold] ? gp[g.hold][1] : null];
    }
    for (const [a, i] of Object.entries(padProfile.secondary || {})) gp[a] = [gp[a] ? gp[a][0] : null, 'Pad' + i];
    gp['move_forward'] = ['Axis1-', null]; gp['move_back'] = ['Axis1+', null];
    gp['move_left'] = ['Axis0-', null]; gp['move_right'] = ['Axis0+', null];
    const touch = {};
    for (const a of this.rows) touch[a] = ['Touch:' + a, null];
    return { keyboard: kb, gamepad: gp, touch };
  }

  // ---- RB3: capture ------------------------------------------------------------------------

  /** Open the surface. RB11 — the caller releases pointer lock; this records that it must. */
  openSurface(device = 'keyboard') { this.open = true; this.device = device; this.cursor = 0; this.slot = 0; this.capturing = false; this.pending = null; this.message = null; return true; }
  closeSurface() { this.open = false; this.capturing = false; this.pending = null; return true; }

  beginCapture(action, slot = 0) {
    if (!this.rows.includes(action)) throw new Error(`rebind: unknown row '${action}'`);
    this.capturing = { action, slot };
    this.pending = null;
    this.message = null;
    return true;
  }

  /**
   * RB3/RB4/RB6 — the player PRESSED something. Returns the offer, not the commit: a conflict
   * must be shown, naming the previous owner, before anything changes.
   * @param {string} control 'KeyR' | 'Mouse2' | 'WheelUp' | 'Pad5' | 'Touch:light'
   */
  offer(control) {
    if (!this.capturing) return null;
    const dev = this.device;
    const c = String(control);
    if (this.reserved.has(c.toLowerCase())) { this.message = REFUSALS.reserved; this.pending = null; this.log.push({ control: c, refused: 'reserved' }); return { refused: 'reserved', line: this.message }; }
    if (/^F(5|11|12)$/.test(c)) { this.message = REFUSALS.reserved; this.pending = null; return { refused: 'reserved', line: this.message }; }
    if (dev === 'gamepad' && c === 'Pad' + this.reservedPadIndex) { this.message = REFUSALS.guide; this.pending = null; this.log.push({ control: c, refused: 'guide' }); return { refused: 'guide', line: this.message }; }
    let conflictWith = null, conflictSlot = -1;
    for (const [a, pair] of Object.entries(this.bindings[dev])) {
      for (let s = 0; s < 2; s++) {
        if (pair[s] === c && !(a === this.capturing.action && s === this.capturing.slot)) { conflictWith = a; conflictSlot = s; }
      }
    }
    this.pending = { control: c, action: this.capturing.action, slot: this.capturing.slot, conflictWith, conflictSlot };
    this.message = conflictWith ? `${labelOf(c)} already answers for ${prose(conflictWith)}.` : null;
    return { control: c, conflictWith, line: this.message };
  }

  /** RB4/RB5 — commit. Taking a control from another action unbinds it AND says so. */
  commit(take = true) {
    const p = this.pending;
    if (!p) return { ok: false };
    const dev = this.device;
    if (p.conflictWith && !take) { this.pending = null; this.capturing = false; return { ok: false, kept: p.conflictWith }; }
    if (p.conflictWith) {
      const other = this.bindings[dev][p.conflictWith];
      other[p.conflictSlot] = null;
      // RB5: an action must not be left with zero bindings on this device.
      if (!other[0] && !other[1]) {
        other[p.conflictSlot] = p.control;
        this.message = REFUSALS.empty + ` ${prose(p.conflictWith)} would have nothing.`;
        this.pending = null; this.capturing = false;
        return { ok: false, refused: 'would_orphan', orphan: p.conflictWith, line: this.message };
      }
      this.message = `${prose(p.conflictWith)} lets go of ${labelOf(p.control)}.`;
    }
    this.bindings[dev][p.action][p.slot] = p.control;
    this.pending = null;
    this.capturing = false;
    this.log.push({ device: dev, action: p.action, slot: p.slot, control: p.control, took: p.conflictWith || null });
    this.onCommit && this.onCommit(dev, this.bindings[dev]);
    return { ok: true, device: dev, action: p.action, slot: p.slot, control: p.control, took: p.conflictWith || null };
  }

  /** RB5 — unbinding the last control an action has, on the active device, is refused. */
  unbind(action, slot) {
    const pair = this.bindings[this.device][action];
    if (!pair) return { ok: false };
    const other = pair[1 - slot];
    if (!other) { this.message = REFUSALS.empty; return { ok: false, refused: 'zero_binding', line: this.message }; }
    pair[slot] = null;
    this.onCommit && this.onCommit(this.device, this.bindings[this.device]);
    return { ok: true };
  }

  /** RB8, per device. RB7: touching one device never touches another. */
  restoreDefaults(device = this.device) {
    const d = this.defaults();
    this.bindings[device] = d[device];
    this.onCommit && this.onCommit(device, this.bindings[device]);
    return true;
  }

  // ---- RB10: the surface is walked by the ACTION SET, on any device -------------------------

  /**
   * One step of the surface, driven by the latched input the sim already has. No pointer, no
   * hover, no click target: `move` walks, `interact` captures, `menu` backs out, `swap_*`
   * changes slot. Identical on a keyboard, a pad and a touch screen — which is the whole of
   * RB10, and the reason HF9 exists.
   * @param {{pressedName:(n:string)=>boolean, moveX:number, moveY:number}} input
   */
  step(input) {
    if (!this.open) return null;
    if (this.capturing) {
      // While capturing, `menu` cancels. Everything else is a CONTROL, captured by the caller
      // from the raw device and handed to offer(). Nothing is consumed as a game action.
      if (input.pressedName('menu')) { this.capturing = false; this.message = null; return { did: 'cancel' }; }
      return { did: 'capturing' };
    }
    if (this.pending) {
      if (input.pressedName('interact')) return { did: 'commit', ...this.commit(true) };
      if (input.pressedName('menu')) return { did: 'keep', ...this.commit(false) };
      return { did: 'confirming' };
    }
    let moved = 0;
    if (this._edge(input, 'up')) { this.cursor = (this.cursor - 1 + this.rows.length) % this.rows.length; moved = -1; }
    else if (this._edge(input, 'down')) { this.cursor = (this.cursor + 1) % this.rows.length; moved = 1; }
    if (input.pressedName('swap_right')) this.slot = 1;
    if (input.pressedName('swap_left')) this.slot = 0;
    if (input.pressedName('interact')) { this.beginCapture(this.rows[this.cursor], this.slot); return { did: 'begin', action: this.rows[this.cursor], slot: this.slot }; }
    if (input.pressedName('two_hand')) { this.restoreDefaults(); return { did: 'defaults' }; }
    if (input.pressedName('menu')) { this.closeSurface(); return { did: 'close' }; }
    return { did: moved ? 'move' : 'idle', cursor: this.cursor };
  }

  _edge(input, dir) {
    const y = input.moveY || 0;
    const was = this._lastY || 0;
    this._lastY = y;
    if (dir === 'up') return y > 0.5 && was <= 0.5;
    return y < -0.5 && was >= -0.5;
  }

  /**
   * RB9 — the shape RI-JRN05's store persists, and the shape a cold reload restores.
   * Deliberately NOT the derived control map: a control map cannot round-trip a conflict.
   */
  serialise() { return { schema: 'elder-souls/bindings@1', bindings: this.bindings }; }
  restore(doc) {
    if (!doc || !doc.bindings) return false;
    for (const d of DEVICES) if (doc.bindings[d]) this.bindings[d] = doc.bindings[d];
    this.onCommit && this.onCommit(null, null);
    return true;
  }

  /** What the surface draws: rows, labels, and the localised key label (B2). */
  view(layoutMap = null) {
    return {
      device: this.device,
      cursor: this.cursor,
      slot: this.slot,
      capturing: this.capturing ? { ...this.capturing } : null,
      pending: this.pending ? { ...this.pending } : null,
      message: this.message,
      rows: this.rows.map((a, i) => ({
        action: a, label: prose(a), selected: i === this.cursor,
        controls: this.bindings[this.device][a].map((c) => (c ? labelOf(c, layoutMap) : null)),
      })),
    };
  }
}

/**
 * RI-JRN03 B2 — the BINDING is physical (`KeyW`) and the LABEL is localised. On an AZERTY
 * keyboard the W position produces `Z`, so a French player must see `Z` on a row bound to
 * `KeyW`. `navigator.keyboard.getLayoutMap()` is the source where it exists; the `code` with
 * its prefix stripped is the fallback, which is right on QWERTY and honest everywhere else.
 */
export function labelOf(control, layoutMap = null) {
  const c = String(control);
  if (layoutMap && typeof layoutMap.get === 'function') {
    const l = layoutMap.get(c);
    if (l) return String(l).toUpperCase();
  }
  if (/^Key([A-Z])$/.test(c)) return c.slice(3);
  if (/^Digit(\d)$/.test(c)) return c.slice(5);
  if (c === 'Space') return 'Space';
  if (c === 'ShiftLeft') return 'Shift';
  if (/^Mouse(\d)$/.test(c)) return ['Left', 'Middle', 'Right', 'Back', 'Forward'][Number(c.slice(5))] || c;
  if (/^Pad(\d+)Hold(\d+)$/.test(c)) { const m = /^Pad(\d+)Hold(\d+)$/.exec(c); return padLabel(Number(m[1])) + ' held'; }
  if (/^Pad(\d+)$/.test(c)) return padLabel(Number(c.slice(3)));
  if (/^Touch:/.test(c)) return 'the ' + prose(c.slice(6)) + ' pad';
  if (/^Axis(\d)([+-])$/.test(c)) return 'stick';
  return c;
}

function padLabel(i) {
  return ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Guide'][i] || ('button ' + i);
}

/** DS5: the row names the thing done in the world. §D6 permits control names HERE and only here. */
function prose(a) {
  return ({
    light: 'the quick swing', heavy: 'the heavy swing', roll: 'getting out of the way',
    block: 'the guard', parry: 'turning a blade', sprint: 'running', jump: 'the leap',
    use_item: 'reaching for the flask', interact: 'putting a hand to a thing',
    lock_on: 'fixing an eye', two_hand: 'both hands on the grip',
    swap_right: 'the next thing in the right hand', swap_left: 'the next thing in the left',
    menu: 'stopping to think', crouch: 'going low', spell_cycle: 'the next word',
    move_forward: 'forward', move_back: 'back', move_left: 'left', move_right: 'right',
  })[a] || a;
}
