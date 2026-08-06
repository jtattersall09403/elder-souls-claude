// The Writ House, as a place you are standing in.
//
// Owner: W1-07. This file is the answer to the round-1 verdict's single gap,
// `GAP-W1-creation-is-an-api-not-a-scene`: "All twenty PNGs are byte-identical. There is no
// barge hold. There is no Writ House interior. There is no Jeeh-Ei and no Warden-Scribe
// Tuleeh-Ma. There is no question, no answer list, no panel, no text."
//
// `character/census.js` walks the dialogue graph and refuses, deliberately, to know anything
// about rendering. This module is the other half: where each person stands, where the player
// stands and where the camera looks while each node is being answered, what the surface says,
// and how a stick and two buttons move through it.
//
// THREE RULES IT KEEPS, each one a check in RI-JRN01's comparison method:
//
//   * O8 / M5 — the surface is a strip over the live view. There is no code path in this file
//     that can produce a full-screen panel, because the panel's geometry is computed in
//     render/ui.js from its own contents and capped at 42% of frame height.
//   * O7 / M6 — every node's line is attributed to a person who is *in the room*, as an
//     `sim.npcs` record with a name, a settlement and topics. If the node's speaker is not
//     standing there, `censusSpeakerEntity()` returns null and the harness says so.
//   * O17 / M13 — the only inputs are `move` (a stick or WASD), `interact` and `block`. No
//     cursor, no hover, no drag, no text field that cannot be filled without a keyboard.
'use strict';

/** Where the scene happens, in the order it happens in. */
export const CENSUS_PLACES = {
  'barge-hold': {
    interior: 'barge-hold',
    player_pos: [0.2, 0, 1.4],
    player_yaw: 200,
    camera: { yaw: 200, pitch: -4 },
    name: 'The hold, two days out of Gideon',
  },
  'writ-house': {
    interior: 'writ-house',
    player_pos: [0, 0, 0.7],
    player_yaw: 0,
    camera: { yaw: 0, pitch: -3 },
    name: 'The Writ House at Tidewrack',
  },
};

/**
 * Who is standing where, per place. Positions are metres in the cell built by
 * render/places.js: the Writ House desk is at z = +2.6 and its clerk's table at x = -3.7.
 */
export const CENSUS_CAST = {
  'barge-hold': [
    { id: 'jeeh-ei', pos: [-2.2, 0, 2.4], yaw: 110, behaviour: 'attend', notice_radius_m: 5.0, height_scale: 0.96 },
  ],
  'writ-house': [
    { id: 'warden-scribe-tuleeh-ma', pos: [0, 0, 3.5], yaw: 180, behaviour: 'stand', notice_radius_m: 7.0, height_scale: 1.02 },
    { id: 'clerk-avelia-doren', pos: [-3.7, 0, 3.0], yaw: 160, behaviour: 'stand', notice_radius_m: 4.0, height_scale: 0.98 },
  ],
};

/** Which place a census node is asked in. Read from the node itself; this is the fallback. */
export function placeOfNode(node) {
  return (node && node.place) || 'writ-house';
}

// ---------------------------------------------------------------------------------------
// The surface: selection state and the closed-action-set driver.
// ---------------------------------------------------------------------------------------

const REPEAT_FIRST = 22;      // f@60 before a held stick starts repeating
const REPEAT_EVERY = 7;       // f@60 between repeats thereafter
const AXIS_DEADZONE = 0.45;

export class CensusSurface {
  constructor(data) {
    this.data = data;
    this.names = data.creationNames;
    this.reset();
  }

  reset() {
    this.open = false;
    this.node = null;
    this.sel = 0;
    this.picked = [];
    this.typed = '';
    this.options = [];
    this.axisHeld = 0;
    this.axisFrames = 0;
    this.lastConfirm = -1;
    this.confirmCount = 0;
    this.inputsTaken = 0;
  }

  /**
   * Rebuild the option list for the node the census is sitting on. Called every time the
   * census state changes; keeps the selection index if the node did not.
   */
  sync(state, censusObj) {
    const wasNode = this.node;
    this.open = !!state && !state.done;
    this.node = state && state.node ? state.node : null;
    if (!this.open) { this.options = []; return this; }

    const kind = state.input ? state.input.kind : null;
    if (this.node !== wasNode) { this.sel = 0; this.picked = []; this.typed = ''; }

    if (kind === 'text') {
      this.options = this._nameOptions(state, censusObj);
    } else if (kind === 'observed') {
      this.options = (state.input.options || []).map((o) => ({ id: o.id, text: o.text }));
    } else if (state.input) {
      this.options = (state.input.options || []).map((o) => ({ id: o.id, text: o.text, aside: o.aside }));
    } else {
      this.options = [];
    }
    if (this.sel >= this.options.length) this.sel = Math.max(0, this.options.length - 1);
    return this;
  }

  /**
   * The list a text node offers. RI-JRN01 O17 in one function: a stick and a button must be
   * able to fill in a name, and an on-screen keyboard would be the full-screen panel O8
   * forbids. Typing on a keyboard still works and overrides whatever is highlighted.
   */
  _nameOptions(state, censusObj) {
    const n = this.node;
    const N = this.names;
    if (n === 'hold.hatch-name') {
      return [
        ...N.hatch_names.names.map((s) => ({ id: s, text: s })),
        { id: 'refuse', text: 'Say nothing.', aside: 'she will remember that you did not' },
      ];
    }
    if (n === 'writ.given-name') {
      const race = (censusObj && censusObj.spec && censusObj.spec.race) || 'saxhleel';
      const list = N.given_names[race] || N.given_names.saxhleel;
      return list.map((s) => ({ id: s, text: s }));
    }
    if (n === 'writ.class-custom-name') {
      return N.custom_class_names.names.map((s) => ({ id: s, text: s }));
    }
    return [];
  }

  /** How many distinct things must be picked at this node, or 0 for a single choice. */
  pickCount(state) {
    if (!state || !state.input || state.input.kind !== 'pick') return 0;
    switch (this.node) {
      case 'writ.class-custom-favoured':
      case 'writ.class-custom-neglected':
      case 'writ.class-custom-secondary': return 2;
      case 'writ.class-custom-primary': return 3;
      default: return 0;
    }
  }

  /**
   * One fixed step of the surface, driven by the SAME latched input a swing is driven by.
   *
   * @param {object} input   the InputPipeline, already latched for this frame
   * @param {object} state   census.state()
   * @param {function} answer  called with the value when the player commits
   * @returns {null|object} what was committed this frame, for the trace
   */
  step(input, state, answer) {
    if (!this.open || !state || !state.input) { this.axisHeld = 0; this.axisFrames = 0; return null; }

    // --- move the caret. Analogue stick, D-pad or WASD; all three arrive as moveY.
    const y = input.moveY || 0;
    const dir = y > AXIS_DEADZONE ? -1 : y < -AXIS_DEADZONE ? 1 : 0;   // stick up = earlier option
    if (dir !== this.axisHeld) { this.axisHeld = dir; this.axisFrames = 0; if (dir) this._move(dir); }
    else if (dir) {
      this.axisFrames++;
      if (this.axisFrames >= REPEAT_FIRST && (this.axisFrames - REPEAT_FIRST) % REPEAT_EVERY === 0) this._move(dir);
    }

    // --- take it back. `block` is the universal "no" here: un-pick on a pick node, delete a
    // typed character on a text node. It is never a menu.
    if (input.pressedName('block')) {
      if (this.typed) this.typed = this.typed.slice(0, -1);
      else if (this.picked.length) this.picked.pop();
    }

    // --- commit. `interact` is the only affirmative button in the whole scene.
    if (!input.pressedName('interact')) return null;
    this.inputsTaken++;
    const kind = state.input.kind;
    const opt = this.options[this.sel] || null;

    if (kind === 'text') {
      const value = this.typed ? this.typed : (opt ? opt.id : '');
      const v = (value === 'refuse') ? 'refuse' : value;
      this.typed = '';
      return { value: v, committed: true, via: this.typed ? 'typed' : 'ledger' };
    }
    if (kind === 'observed') return { value: 'correct', committed: true, via: 'option' };
    if (kind === 'pick') {
      const want = this.pickCount(state);
      if (!opt) return null;
      if (this.picked.indexOf(opt.id) >= 0) { this.picked = this.picked.filter((x) => x !== opt.id); return null; }
      this.picked.push(opt.id);
      if (this.picked.length < want) return null;
      const value = this.picked.slice();
      this.picked = [];
      return { value, committed: true, via: 'pick' };
    }
    if (!opt) return null;
    return { value: opt.id, committed: true, via: 'option' };
  }

  _move(dir) {
    const n = this.options.length;
    if (n <= 0) return;
    this.sel = ((this.sel + dir) % n + n) % n;
  }

  /** Text typed on a real keyboard. Not a button; not part of the closed action set. */
  typeChar(ch) {
    if (!this.open) return this.typed;
    if (ch === '\b') { this.typed = this.typed.slice(0, -1); return this.typed; }
    if (this.typed.length >= 40) return this.typed;
    this.typed += ch;
    return this.typed;
  }
}

/**
 * The model render/ui.js draws. Everything in it is a string that came from a data file or
 * from `census.state()`; nothing here is composed out of stat names or numbers.
 */
export function buildCensusModel(data, state, surface, npcRecord) {
  if (!state || state.done) return null;
  const place = CENSUS_PLACES[placeOfNode(state)] || CENSUS_PLACES['writ-house'];
  const kind = state.input ? state.input.kind : null;
  let aside = null;
  if (state.awaiting) aside = state.awaiting;
  else if (kind === 'pick') {
    const want = surface.pickCount(state);
    const have = surface.picked.length;
    aside = have ? `She is waiting for ${want - have} more.` : null;
  } else if (kind === 'questionnaire' && state.question_count) {
    aside = null;
  }
  return {
    node: state.node,
    speaker_name: npcRecord ? npcRecord.name : null,
    speaker_title: npcRecord ? (npcRecord.title || null) : null,
    place_name: place.name,
    line: state.line || '',
    aside,
    input_kind: kind,
    options: surface.options,
    selected: surface.sel,
    picked: surface.picked,
    typed: kind === 'text' ? surface.typed : '',
  };
}
