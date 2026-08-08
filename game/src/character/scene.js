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
    // The body faces the person who is talking (yaw 329, the bearing to Jeeh-Ei); the CAMERA
    // is turned 22 deg off that line, so she is beside your head rather than behind it. Seam
    // S18 keeps the body in frame; RI-JRN01 M5 needs the interlocutor in it too.
    player_pos: [0.3, 0, -1.2],
    player_yaw: 329,
    camera: { yaw: 351, pitch: -4 },
    name: 'The hold, two days out of Gideon',
  },
  'writ-house': {
    interior: 'writ-house',
    // You stand at the right-hand end of the desk and face the Warden-Scribe (bearing -25);
    // the camera sits 15 deg to her side of that, so the desk, the ledger, the wall of
    // eleven years of other people's reed-cases and the woman writing yours are all in
    // frame behind the text.
    player_pos: [1.9, 0, 0.3],
    player_yaw: 320,
    camera: { yaw: 350, pitch: -3 },
    name: 'The Writ House at Tidewrack',
  },
};

/**
 * Who is standing where, per place. Positions are metres in the cell built by
 * render/places.js: the Writ House desk is at z = +2.6 and its clerk's table at x = -3.7.
 */
export const CENSUS_CAST = {
  'barge-hold': [
    { id: 'jeeh-ei', pos: [-2.0, 0, 2.6], yaw: 149, behaviour: 'attend', notice_radius_m: 6.0, height_scale: 0.96 },
  ],
  'writ-house': [
    { id: 'warden-scribe-tuleeh-ma', pos: [-1.0, 0, 3.5], yaw: 165, behaviour: 'stand', notice_radius_m: 7.0, height_scale: 1.02 },
    { id: 'clerk-avelia-doren', pos: [-4.1, 0, 1.4], yaw: 120, behaviour: 'stand', notice_radius_m: 4.0, height_scale: 0.98 },
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

/**
 * The ONLY actions the census surface uses, and therefore the only ones it takes away from
 * the character while it is open. Three names out of a sixteen-name closed set: a direction,
 * a yes and a no. That is the whole control scheme of character creation, and it is why the
 * scene completes identically on a keyboard, on a pad and under a thumb.
 */
export const CENSUS_ACTIONS = ['interact', 'block', 'light', 'heavy', 'roll'];

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
    // Set by Engine._censusApplyPending when she will not write the answer down. `refusal` is
    // an AUTHORED line (writ-house.json `refusal_line`) and is the only one of the two that may
    // be drawn; `fault` is the engine's own exception text, kept for the trace and for probes
    // and never given to `buildCensusModel()`. See the comment in `_censusApplyPending`.
    this.refusal = null;
    this.fault = null;
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
    // DRAWN and TAKES-INPUT are different things, and conflating them was a bug worth naming:
    // at `hold.out` the census hands control back and Jeeh-Ei's last line stays on the vellum
    // while you get up off the bunk and walk out. If the surface ate the stick there, the
    // player could never leave the hold — which is exactly RI-JRN01 O6's walk.
    this.open = !!state && !state.done;
    this.takesInput = !!(state && !state.done && state.input && !state.paused);
    this.node = state && state.node ? state.node : null;
    if (!this.open) { this.options = []; return this; }
    if (!this.takesInput) { this.options = []; if (this.node !== wasNode) { this.sel = 0; this.picked = []; this.typed = ''; } return this; }

    const kind = state.input ? state.input.kind : null;
    if (this.node !== wasNode) { this.sel = 0; this.picked = []; this.typed = ''; this.refusal = null; this.fault = null; }

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
    if (!this.takesInput || !state || !state.input) { this.axisHeld = 0; this.axisFrames = 0; return null; }

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
    if (!this.takesInput) return this.typed;
    if (ch === '\b') { this.typed = this.typed.slice(0, -1); return this.typed; }
    if (this.typed.length >= 40) return this.typed;
    this.typed += ch;
    return this.typed;
  }
}

/**
 * The model render/ui.js draws. Everything in it is a string that came from a data file or
 * from `census.state()`; nothing here is composed out of stat names or numbers.
 *
 * THE ROUND-2 DEFECT, AND WHY IT WAS ONE FIELD.
 * This function used to end at `line: state.line || ''`. At the ten questionnaire nodes
 * `state.line` is the scribe's stock transition line — the same string at all ten — and the
 * dilemma itself lives in `state.question.text`, which nothing read. So the player was shown
 * four answers with no question above them, ten times, on the route RI-CHR01 calls mandatory.
 * Measured by the round-2 critic: 10 distinct question texts in the model, 1 distinct drawn
 * line, 0 of 10 reaching the frame. Morrowind asks you ten questions you can read.
 *
 * Two fields fix it and a third makes the scene a conversation:
 *   `line`      — at a questionnaire node this is the QUESTION. It is what she is asking.
 *   `preamble`  — her stock framing, drawn once, at the first question only.
 *   `spoken`    — what she said about your last answer, drawn above the current line. Every
 *                 `on_answer`, `on_refusal`, `scribe_line` and `on_match_named_class` in the
 *                 graph went into the transcript and never onto the vellum before this.
 */
/**
 * The writ's identity block — the lines that carry what the player actually supplied, plus the
 * document's own heading so it reads as a document rather than as more dialogue. Returns null
 * at every node but the stamp.
 *
 * The selection is by PREFIX rather than by index so that re-ordering `items/writ.json`'s
 * template does not silently change what is drawn.
 */
const WRIT_DRAWN_PREFIXES = [
  'PROVINCIAL OFFICE', 'Name recorded:', 'Also called:', 'Observed as:',
  'Raised at:', 'Trade declared:', 'Tide drawn on:', 'Second tide:', 'Recorded:',
];
export function writRecord(state) {
  if (!state || !state.writ || !Array.isArray(state.writ.lines)) return null;
  const keep = state.writ.lines.filter((l) => WRIT_DRAWN_PREFIXES.some((p) => l.startsWith(p)));
  return keep.length ? { name: state.writ.name, lines: keep } : null;
}

export function buildCensusModel(data, state, surface, npcRecord) {
  if (!state || state.done) return null;
  // NOBODY IS TALKING, SO THERE IS NO PANEL.
  //
  // A paused node is `RI-JRN01` O6's hand-back: the player has the body and the scene is waiting
  // for them to do something in the world. There is nothing being asked and nothing being said,
  // so drawing a vellum panel over the bottom half of the hold would be a dialogue surface open
  // on an empty conversation — and it would put `state.awaiting` on the frame.
  //
  // `awaiting` is a DEVELOPER'S SENTENCE. It reads "the player crosses the hold and speaks to
  // her. Nothing is asked until they do. RI-JRN01 O6." — a corpus reference, in italics, in the
  // player's dialogue box. It was drawn there for exactly one build, it was caught by looking at
  // a screenshot rather than by any measurement in this round, and it would have been an
  // instruction leak (`RI-JRN01` M9, AR-2) as well as simply embarrassing. `awaiting` belongs in
  // `getCensusState()`, where a probe reads it; it must never reach a draw call.
  //
  // WHAT THAT ARGUMENT ACTUALLY LICENSES IS "no panel when NOBODY IS TALKING", and this
  // function tested `paused` instead — which is a different thing, and W1-26 r2 §4 is the bill.
  // There are two paused nodes. `hold.come-to` genuinely has nothing to say: no `line`, no
  // `spoken`, and it must stay silent. `hold.out` has TWO authored strings on it at the moment
  // it pauses — Jeeh-Ei's own send-off, and her reply to the hatch-name you have just typed,
  // which is the build's only instance of *"Jiub repeats it and remarks on it"*, the one beat
  // `MW/EXCHANGE` row 1 is about. Both were computed and neither was drawn: the send-off is a
  // node `line` that is never carried forward, so it reached the frame **nowhere**, and the
  // reply survived in `spoken` only to be drawn one node later, in the Writ House, above the
  // Warden-Scribe's line, attributed to a woman who is no longer in the room. `DTR(hold.out)`
  // = 0.000 and `RI-JRN09` HF1 fires on it, capping a native 92 at 2.
  //
  // So the test is what is being SAID, not what the graph is waiting for. A paused node with
  // nothing on it draws nothing, exactly as before. A paused node with a line on it keeps the
  // vellum up while the player gets off the bunk and walks out — which is what the surface's
  // own `sync()` says it does ("at `hold.out` the census hands control back and Jeeh-Ei's last
  // line stays on the vellum while you get up off the bunk and walk out"), and could not,
  // because this line threw the model away first. `takesInput` is already false at a paused
  // node, so the panel takes no buttons and cannot block the walk.
  //
  // `awaiting` is still never in the model, and that is what the paragraph above was defending.
  const pausedSilent = state.paused
    && !String(state.line || '').trim()
    && !(Array.isArray(state.spoken) && state.spoken.some((s) => s && String(s.line || '').trim()));
  if (pausedSilent) return null;
  const place = CENSUS_PLACES[placeOfNode(state)] || CENSUS_PLACES['writ-house'];
  const kind = state.input ? state.input.kind : null;
  const asking = kind === 'questionnaire' && state.question && state.question.text;

  let aside = null;
  // `surface.refusal` is authored text and is drawn verbatim. It used to be the engine's
  // exception message with a sentence of code-composed English glued to the front of it, which
  // is how `race must be observed before the scene reaches the desk` became a line of dialogue.
  // `surface.fault` — the exception — is deliberately not read here and must not be.
  if (surface.refusal) aside = surface.refusal;
  else if (kind === 'pick') {
    const want = surface.pickCount(state);
    const have = surface.picked.length;
    aside = have ? `She is waiting for ${want - have} more.` : null;
  }

  return {
    node: state.node,
    speaker_name: npcRecord ? npcRecord.name : null,
    speaker_title: npcRecord ? (npcRecord.title || null) : null,
    place_name: place.name,
    // The reply to the last answer, oldest first. Drawn dim, above the rule.
    spoken: Array.isArray(state.spoken) ? state.spoken.map((s) => s.line).filter(Boolean) : [],
    // Her framing, once. `question_number` is never drawn — RI-JRN01 O8 forbids "Step 2 of 4".
    preamble: (asking && state.question_number === 1) ? (state.line || '') : null,
    // The document, at the node that stamps it. RI-JRN01 O10 and RI-JRN09 M2(c): "a visible
    // written record whose text is drawn". Round 2 measured `rendered_text: []` here because
    // the scene ended before this node could render at all; the writ was reachable only as a
    // `readWrit()` return value, which RI-MTH07 §B1 rules an observer and not consumption.
    //
    // Only the identity block is drawn, not all eighteen lines: the panel is capped at 42% of
    // frame height and CLIPS, so pasting the whole document in would push the answers off the
    // bottom and be sacrificed line by line — a written record that is computed, sent to the
    // surface and clipped, which is the same failure wearing a different hat. The lines kept
    // are the ones carrying what the player supplied; `readWrit()` still returns the whole
    // document, and the reed-case is still an object.
    record: writRecord(state),
    line: asking ? state.question.text : (state.line || ''),
    question_id: asking ? state.question.id : null,
    aside,
    input_kind: kind,
    options: surface.options,
    selected: surface.sel,
    picked: surface.picked,
    typed: kind === 'text' ? surface.typed : '',
  };
}
