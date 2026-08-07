// The census: character creation as a scene.
//
// Owner: W1-07. Binding sources: RI-JRN01 §C O6-O10, RI-CHR01 §1.
//
// This module is the whole character creator. There is no other one, and there is deliberately
// no code path in it that can produce a full-screen panel: it walks a dialogue graph
// (game/data/dialogue/topics/writ-house.json), every node of which has a `speaker` that
// resolves to a record in game/data/npcs/writ-house.json, and it terminates by putting an
// object in the player's inventory.
//
// Three things it does NOT do, on purpose:
//   * it does not render. The renderer draws whatever getCensusState() reports, over the
//     world, in a surface that never covers the frame (RI-JRN01 O8).
//   * it does not decide when creation starts. The scene does — the player walks into the
//     Writ House. O6 requires >= 60 s of available play before the first question.
//   * it does not touch RNG or the clock. Same inputs, same character, byte for byte.
'use strict';

import { composeCharacter, birthsignById, classById, familyOfSkills } from './sheet.js';
import { selectQuestions, scoreAnswers } from './questionnaire.js';

/** What a paused node is waiting for, said in the scene's own terms. Keyed by `resume_by`. */
const AWAITING = {
  talk: 'the player crosses the hold and speaks to her. Nothing is asked until they do. RI-JRN01 O6.',
  walk: 'the player walks out of the hold, up the companionway and into the Writ House. RI-JRN01 O6.',
};

export class Census {
  constructor(data) {
    this.data = data;
    this.graph = data.writHouse;
    this.nodesById = new Map(this.graph.nodes.map((n) => [n.id, n]));
    this.reset();
  }

  reset() {
    this.nodeId = this.graph.start;
    this.spec = {
      hatchName: '', hatchNameRefused: false, givenName: '', sex: 'unrecorded',
      race: null, upbringing: null, classId: null, custom: null, route: null,
      birthsign: null, birthsignSecond: null,
    };
    this.answers = [];
    this.asked = null;
    this.askedIndex = 0;
    this.transcript = [];
    // Everything the speaker has said since the last thing the player was asked. The round-2
    // verdict found the ten questions were computed and thrown away; the same was true of every
    // REPLY in the graph — `on_answer`, `on_refusal`, the birthsign `scribe_line`, the
    // conditional branches at `writ.strange-check`, and `on_match_named_class`, which is the
    // line RI-CHR01 §4 calls "the moment the route is for". All of them were written into the
    // transcript and none was ever drawn. They are drawn now, as the speaker's reply above the
    // next thing she asks, which is also how a conversation works.
    this.spoken = [];
    this.flags = [];
    this.character = null;
    this.done = false;
    this.paused = false;
    this.writ = null;
    // The line in which she tells you what you are, composed at the moment the class is
    // decided and drawn at `writ.class-verdict`. See `_nameYou()`.
    this.classVerdict = null;
    this.resumedBy = null;
    this._autoAdvance();
    return this.state();
  }

  /**
   * Race is OBSERVED, not asked (RI-CHR01 §1 row 2). The scene knows what walked in; the
   * player's body already exists. In the harness this is set before the scene opens.
   */
  observe(race) {
    this.spec.race = race;
    return this.state();
  }

  node() { return this.nodesById.get(this.nodeId) || null; }

  /** What a renderer or a critic sees: a speaker, a line, and what is being asked. */
  state() {
    const n = this.node();
    if (!n) return { done: true, node: null, character: this.character, writ: this.writ, transcript: this.transcript };
    const out = {
      done: false,
      paused: this.paused,
      // What the scene is waiting for, in the node's own words, and the ACT it is waiting for
      // in one machine-readable token. There are two paused nodes now — the hold opens on one
      // (RI-JRN01 O6: a body before a character) and leaves the hold through the other — so
      // "awaiting" can no longer be one hardcoded sentence about a gangplank.
      awaiting: this.paused ? (AWAITING[n.resume_by || 'walk'] || AWAITING.walk) : null,
      resume_by: this.paused ? (n.resume_by || 'walk') : null,
      resumes_to: this.paused ? (n.resume || 'writ.enter') : null,
      node: n.id,
      speaker: n.speaker,
      place: n.place,
      beat: n.beat || null,
      line: this._interpolate(n.line || ''),
      // What she said about the last thing you told her, in the order she said it. Drawn above
      // the current line by render/ui.js. Empty at the first node of the scene.
      spoken: (this.spoken || []).map((s) => ({ from: s.from, line: s.line })),
      sets: n.sets || null,
      // `count` is exposed because a pick node cannot be answered without it: `_requirePick`
      // throws unless it gets exactly `count` distinct ids, and until now the number lived only
      // in the graph file. The drawn surface read it via `surface.pickCount(state)`, so the
      // scene worked, but anything else holding this state — a probe, a critic, a second
      // surface — could only guess. `max_len` is here for the same reason on text nodes.
      input: n.input
        ? {
          kind: n.input.kind,
          options: this._options(n),
          count: n.input.count === undefined ? null : n.input.count,
          max_len: n.input.max_len === undefined ? null : n.input.max_len,
        }
        : null,
      full_screen: false,
      world_visible: true,
    };
    if (n.id === 'writ.race-observed' && this.spec.race) {
      const m = n.misreads[this.spec.race];
      out.line = m.line;
      out.misread_as = m.wrong;
      out.input = { kind: 'observed', options: [{ id: 'correct', text: n.correction_prompt }] };
    }
    // At the stamp, the document itself is part of the surface. RI-JRN09 M2(c) counts "a
    // visible written record — the writ, the ledger — whose text is drawn", and RI-JRN01 O10
    // wants the thing carried out of the room. Round 2's verdict measured `rendered_text: []`
    // at this node; the writ was a return value from `readWrit()` and nothing else.
    if (n.terminates_creation && this.writ) {
      out.writ = { name: this.writ.name, lines: String(this.writ.text || '').split('\n') };
    }
    if (n.input && n.input.kind === 'questionnaire') {
      const q = this.asked ? this.asked[this.askedIndex] : null;
      out.question = q ? { id: q.id, index: q.index, text: q.text, answers: q.answers.map((a) => ({ id: a.id, text: a.text })) } : null;
      out.question_number = this.askedIndex + 1;
      out.question_count = this.asked ? this.asked.length : 0;
      out.input = { kind: 'questionnaire', options: q ? q.answers.map((a) => ({ id: a.id, text: a.text })) : [] };
    }
    return out;
  }

  /**
   * Resolve an `excludes` spec-field name to the set of ids it has already claimed. Unknown
   * names resolve to the empty set rather than throwing: a data file that names a field this
   * function does not know must not be able to take the fixed step down with it.
   */
  _excluded(field) {
    const c = this.spec.custom;
    if (!field || !c) return new Set();
    const map = {
      favoured_attributes: c.favoured,
      neglected_attributes: c.neglected,
      primary_skills: c.primary,
      secondary_skills: c.secondary,
    };
    return new Set(map[field] || []);
  }

  _options(n) {
    const inp = n.input;
    if (!inp) return null;
    if (inp.options) return inp.options.map((o) => ({ id: o.id, text: o.text }));
    if (inp.source === 'progression/classes.json#classes') {
      return this.data.classes.classes.map((c) => ({ id: c.id, text: c.name, aside: c.scribe_line }));
    }
    if (inp.source === 'progression/birthsigns.json#signs') {
      const ex = new Set(inp.excludes || []);
      return this.data.birthsigns.signs.filter((s) => !ex.has(s.id)).map((s) => ({ id: s.id, text: s.name, aside: s.scribe_line }));
    }
    // `excludes` on these two is a SPEC FIELD NAME, not a list of ids — "favoured_attributes"
    // means "the two she has already written down". Round 2 ignored it here, so the neglected
    // node offered attributes the player had just chosen as favoured, and picking one threw
    // `census: writ.class-custom-neglected cannot repeat strength` out of the fixed step from
    // eight button presses. An option that cannot legally be taken must not be on the list.
    if (inp.source === 'progression/attributes.json#attributes') {
      const ex = this._excluded(inp.excludes);
      return this.data.attributes.attributes.filter((a) => !ex.has(a.id)).map((a) => ({ id: a.id, text: a.name }));
    }
    if (inp.source === 'progression/skills.json#skills') {
      const ex = this._excluded(inp.excludes);
      return this.data.skills.skills.filter((s) => !ex.has(s.id)).map((s) => ({ id: s.id, text: s.name }));
    }
    return null;
  }

  /**
   * The single input verb. `value` is a string for text/choice nodes and an array for pick
   * nodes. Throws on an illegal answer — a dropped input is never silent (HARNESS R7).
   */
  answer(value) {
    const n = this.node();
    if (!n) throw new Error('census: creation is finished');
    const rec = { node: n.id, value };

    if (this.paused) {
      throw new Error(`census: nothing has been asked — ${n.id} is waiting for ${AWAITING[n.resume_by || 'walk'] || AWAITING.walk} Call censusEnter('${n.resume_by || 'walk'}') when they do.`);
    }
    this.spoken = [];
    switch (n.id) {
      case 'hold.hatch-name': {
        if (value === 'refuse' || value === null || value === '') {
          this.spec.hatchNameRefused = true;
          rec.line = n.on_refusal;
        } else {
          this.spec.hatchName = String(value).slice(0, n.input.max_len);
          rec.line = this._interpolate(n.on_answer);
        }
        this._advance('hold.out');
        break;
      }
      case 'writ.race-observed': {
        if (!this.spec.race) throw new Error('census: race must be observed before the scene reaches the desk');
        this._advance('writ.sex');
        break;
      }
      case 'writ.sex': {
        this._requireOption(n, value);
        this.spec.sex = value;
        this._advance('writ.upbringing');
        break;
      }
      case 'writ.upbringing': {
        const o = this._requireOption(n, value);
        this.spec.upbringing = value;
        rec.line = o.scribe;
        this._advance('writ.strange-check');
        break;
      }
      case 'writ.given-name': {
        if (!value) throw new Error('census: the given name is required — she will not stamp a blank line');
        this.spec.givenName = String(value).slice(0, n.input.max_len);
        rec.line = this._interpolate(n.on_answer);
        this._advance('writ.class-routes');
        break;
      }
      case 'writ.class-routes': {
        const o = this._requireOption(n, value);
        this.spec.route = value;
        if (value === 'questionnaire') {
          const sel = selectQuestions(this.data, this.spec.race, this.spec.upbringing);
          this.asked = sel.asked;
          this.askedDropped = sel.dropped;
          this.askedIndex = 0;
        }
        if (value === 'custom') this.spec.custom = { name: '', favoured: [], neglected: [], primary: [], secondary: [] };
        this._advance(o.next);
        break;
      }
      case 'writ.class-named': {
        const c = classById(this.data, value);
        this.spec.classId = c.id;
        rec.line = c.scribe_line;
        this._nameYou(n, 'named');
        this._advance('writ.class-verdict');
        break;
      }
      case 'writ.class-custom-name': {
        if (!value) throw new Error('census: say the words and she will write the words');
        this.spec.custom.name = String(value).slice(0, n.input.max_len);
        this._advance('writ.class-custom-favoured');
        break;
      }
      case 'writ.class-custom-favoured': {
        this.spec.custom.favoured = this._requirePick(n, value, 2);
        this._advance('writ.class-custom-neglected');
        break;
      }
      case 'writ.class-custom-neglected': {
        this.spec.custom.neglected = this._requirePick(n, value, 2, this.spec.custom.favoured);
        this._advance('writ.class-custom-primary');
        break;
      }
      case 'writ.class-custom-primary': {
        this.spec.custom.primary = this._requirePick(n, value, 3);
        this._advance('writ.class-custom-secondary');
        break;
      }
      case 'writ.class-custom-secondary': {
        this.spec.custom.secondary = this._requirePick(n, value, 2, this.spec.custom.primary);
        this._nameYou(n, 'custom');
        this._advance('writ.class-verdict');
        break;
      }
      case 'writ.class-questions': {
        const q = this.asked[this.askedIndex];
        if (!q.answers.some((a) => a.id === value)) throw new Error(`census: ${q.id} has no answer ${JSON.stringify(value)}`);
        this.answers.push({ questionId: q.id, answerId: value });
        rec.question = q.id;
        this.askedIndex++;
        if (this.askedIndex >= this.asked.length) {
          const s = scoreAnswers(this.data, this.answers, { asked: this.asked });
          this.questionnaireResult = s;
          // No named match: the shape is still one of the six families (sheet.familyOfSkills),
          // and the Warden-Scribe writes what she saw rather than leaving the box empty.
          const fit = familyOfSkills(this.data, s.primary, s.secondary);
          const writeIn = this.data.classes.family_write_in[fit.family];
          this.spec.custom = {
            name: writeIn,
            family: fit.family,
            favoured: s.favoured, neglected: s.neglected, primary: s.primary, secondary: s.secondary,
          };
          if (s.named_class) {
            // She has a word for it. The character takes the profession — the questionnaire is
            // the third door to the SAME object route A reaches (RI-CHR01 §4's own title), not
            // a third kind of object. `named_via` records whether the shape was the profession
            // to the skill or was rounded to it, and both lines are authored separately.
            const c = classById(this.data, s.named_class);
            this.spec.classId = c.id;
            this.spec.custom = null;
            // THE NAMING LINE IS NO LONGER A `spoken` ROW. It is `writ.class-verdict`'s own
            // `line`, and `spoken` is the one thing render/ui.js is allowed to sacrifice when
            // the page overflows — which is exactly what it did, at every node, in every walk,
            // so `NAMED_line` measured 0% against fourteen correctly computed classes. See the
            // node's `note` in writ-house.json.
            this._nameYou(n, s.named_via === 'exact' ? 'match' : 'nearest');
            rec.line = null;
            rec.named_class = c.id;
            rec.named_via = s.named_via;
            rec.named_fit = s.nearest_profession ? s.nearest_profession.fit : null;
          } else {
            this._nameYou(n, 'none');
            rec.line = null;
            rec.named_class = null;
            rec.named_via = null;
            rec.named_fit = s.nearest_profession ? s.nearest_profession.fit : null;
          }
          this._advance('writ.class-verdict');
        }
        break;
      }
      // She has said the word. The player closes the beat; nothing else happens here.
      case 'writ.class-verdict': {
        this._requireOption(n, value);
        this._advance('writ.birthsign');
        break;
      }
      case 'writ.birthsign': {
        const s = birthsignById(this.data, value);
        this.spec.birthsign = s.id;
        rec.line = s.scribe_line;
        this._advance(s.id === 'kaal-kaal' ? 'writ.birthsign-second' : 'writ.stamp');
        break;
      }
      case 'writ.birthsign-second': {
        if (value === 'kaal-kaal') throw new Error('census: the second tide cannot be Two-Drink');
        const s = birthsignById(this.data, value);
        this.spec.birthsignSecond = s.id;
        rec.line = s.scribe_line;
        this._advance('writ.stamp');
        break;
      }
      case 'writ.stamp': {
        // The player takes the reed-case. Creation ends HERE, on an acknowledgement, rather
        // than silently at the end of the birthsign node — so the stamp line and the writ's
        // own body are on screen for a beat the player closes themselves.
        this._requireOption(n, value);
        this._finish();
        break;
      }
      default: throw new Error(`census: node ${n.id} takes no answer`);
    }
    this.transcript.push(rec);
    if (rec.line) this.spoken.unshift({ from: n.id, line: this._interpolate(rec.line) });
    return this.state();
  }

  /**
   * Move to `next`, then keep walking while the node in front of us needs nothing from the
   * player: narration nodes speak, conditional nodes fire or are skipped, and the stamp node
   * terminates. The scene only ever stops where somebody is waiting for an answer.
   */
  _advance(next) {
    this.nodeId = next;
    this._autoAdvance();
  }

  _autoAdvance() {
    for (let guard = 0; guard < 16; guard++) {
      const n = this.node();
      if (!n) return;
      if (n.kind === 'conditional') {
        if (n.branches) {
          for (const b of n.branches) {
            if (this._matches(b.when)) {
              this.transcript.push({ node: b.id, line: b.line });
              this.spoken.push({ from: b.id, line: this._interpolate(b.line) });
              this.flags.push(b.sets_flag);
            }
          }
          this.nodeId = n.next;
          continue;
        }
        if (n.when && this._matches(n.when)) return;   // node applies: stop and take input
        this.nodeId = n.next;
        continue;
      }
      if (n.hands_control_back) { this.paused = true; this.transcript.push({ node: n.id, line: n.line }); return; }
      if (n.terminates_creation) {
        // THE STAMP IS A BEAT, NOT A RETURN VALUE.
        //
        // This used to be `{ this._finish(); return; }`. `_finish()` interpolates
        // `writ.stamp`'s line — "%PCName. %Race. %Upbringing. %ClassName. %Birthsign. — Reed-
        // case, stamped, and it is the only thing in this province that says you are a person
        // rather than a shape somebody saw." — pushes it to the TRANSCRIPT, sets done = true
        // and nulls the node. `state()` then returns `{done:true}` and `buildCensusModel()`
        // returns null, so the single most consumption-dense string in the whole scene, the one
        // that says all five of the player's answers back to them and hands them the writ, was
        // computed and never drawn. That is RI-JRN09's fourth consumption shape — ORPHAN TEXT —
        // and it is the same defect as the ten undrawn questions, one node further on.
        //
        // A node with an input now STOPS here so it renders and is acknowledged; `answer()`
        // finishes the scene. `_prepareWrit()` composes the sheet early so the writ's own body
        // can be drawn beside the line. A node with no input keeps the old behaviour, so a data
        // file that has not opted in is unaffected.
        if (n.input) { this._prepareWrit(); return; }
        this._finish(); return;
      }
      if (n.input) return;                              // somebody is waiting for an answer
      const narr = this._interpolate(n.line || '');
      this.transcript.push({ node: n.id, line: narr });
      if (narr) this.spoken.push({ from: n.id, line: narr });
      this.nodeId = n.next;
    }
    throw new Error('census: the graph did not settle in 16 hops — a node cycle');
  }

  /**
   * The player has done the thing the paused node was waiting for — walked into the Writ House,
   * or turned round in the hold and spoken to the woman at the crates.
   *
   * The target used to be a hardcoded `'writ.enter'`, because there was exactly one place the
   * scene ever handed control back. There are two now: `hold.come-to` opens the game with a body
   * and no question in it (`RI-JRN01` O6) and resumes on `talk`; `hold.out` resumes on `walk`.
   * Both carry their own `resume` in the graph, so the engine waits for whatever the node says
   * it is waiting for rather than for the one case somebody wrote down in code.
   *
   * @param {string} [by] the act that resumed it — 'talk' | 'walk'. Recorded, not trusted: a
   *   caller cannot resume a node by naming an act the node did not ask for.
   */
  enter(by) {
    if (!this.paused) return this.state();
    const n = this.node();
    const want = (n && n.resume_by) || 'walk';
    if (by && by !== want) {
      throw new Error(`census: ${n ? n.id : '(no node)'} is waiting to be resumed by '${want}', not by '${by}'`);
    }
    this.resumedBy = by || want;
    this.paused = false;
    this.nodeId = (n && n.resume) || 'writ.enter';
    this._autoAdvance();
    return this.state();
  }

  _matches(when) {
    for (const k of Object.keys(when)) {
      const v = when[k];
      if (k === 'race' && this.spec.race !== v) return false;
      if (k === 'upbringing' && this.spec.upbringing !== v) return false;
      if (k === 'birthsign' && this.spec.birthsign !== v) return false;
    }
    return true;
  }

  _requireOption(n, value) {
    const o = (n.input.options || []).find((x) => x.id === value);
    if (!o) throw new Error(`census: ${n.id} has no answer ${JSON.stringify(value)}`);
    return o;
  }

  _requirePick(n, value, count, excludes) {
    if (!Array.isArray(value) || value.length !== count) throw new Error(`census: ${n.id} needs exactly ${count} choices`);
    if (new Set(value).size !== count) throw new Error(`census: ${n.id} choices must be distinct`);
    if (excludes) for (const v of value) if (excludes.indexOf(v) >= 0) throw new Error(`census: ${n.id} cannot repeat ${v}`);
    return value.slice();
  }

  /**
   * Compose the sheet and render the writ WITHOUT ending the scene, so the stamp node can draw
   * the document it is handing over. Idempotent: re-entering the node does not recompose.
   */
  _prepareWrit() {
    if (this.writ) return this.writ;
    this.character = composeCharacter(this.data, this.spec);
    this.character.flags = this.flags.slice();
    this.character.route = this.spec.route;
    if (!this.character.invariants.attribute_total_ok) {
      throw new Error(`census: composed sheet has ${this.character.invariants.attribute_total} attribute points, not 112 — a race or class table is broken`);
    }
    this.writ = renderWrit(this.data, this.character);
    this.character.writ_text = this.writ.text;
    return this.writ;
  }

  /**
   * Compose the line in which a functionary tells you what you are, and hang it on the node
   * that draws it.
   *
   * RI-CHR01 §4 calls this "the moment the route is for" and the round-1 verdict is that we
   * lose it to Morrowind outright: fourteen classes computed, all fourteen reachable, the right
   * one in 96.25% of runs, and the line saying so drawn **0%** of the time with a coupling of 0
   * against a passing null control. The text existed. It was authored, interpolated and carried
   * — into `spoken`, which is the one region of the panel the height cap is allowed to
   * sacrifice, and which it sacrificed every time. `RI-JRN09`'s fourth consumption shape,
   * ORPHAN TEXT, on the single densest string in the scene.
   *
   * So the line becomes `writ.class-verdict`'s own `line`. A node's `line` is never sacrificed
   * — render/ui.js's policy drops the type scale, then the option window, then the writ block,
   * and it never touches the thing being said now. The coupling is direct: `%ClassName` is
   * interpolated from `spec.classId` (or the player's own words on the custom route), so the
   * drawn string cannot agree with a class the census did not compute.
   *
   * @param {object} node  the node whose authored text names you
   * @param {'named'|'custom'|'match'|'nearest'|'none'} via  which route produced the name
   */
  _nameYou(node, via) {
    const routeLines = (this.nodesById.get('writ.class-verdict') || {}).route_lines || {};
    const tmpl = via === 'match' ? node.on_match_named_class
      : via === 'nearest' ? (node.on_nearest_named_class || node.on_match_named_class)
        : via === 'none' ? node.on_no_match
          : routeLines[via];
    if (!tmpl) throw new Error(`census: no naming line for route '${via}' — the scene must never reach the verdict node with nothing to say`);
    this.classVerdict = { via, line: this._interpolate(tmpl) };
    return this.classVerdict;
  }

  _finish() {
    this._prepareWrit();
    this.transcript.push({ node: 'writ.stamp', line: this._interpolate(this.nodesById.get('writ.stamp').line), grants_item: 'stamped-writ' });
    this.done = true;
    this.nodeId = null;
  }

  _interpolate(s) {
    const c = this.spec;
    return String(s)
      .replace(/%HatchName/g, c.hatchName || '')
      .replace(/%PCName/g, c.givenName || '')
      .replace(/%Race/g, c.race ? raceName(this.data, c.race) : '')
      .replace(/%Upbringing/g, c.upbringing || '')
      .replace(/%ClassName/g, c.classId ? classById(this.data, c.classId).name : (c.custom && c.custom.name) || '')
      .replace(/%Birthsign/g, c.birthsign ? birthsignById(this.data, c.birthsign).name : '')
      // The naming line, already interpolated by `_nameYou()` at the moment the class was
      // decided. It is substituted rather than stored in the graph because the three routes
      // reach the same node with three different sentences.
      .replace(/%ClassVerdict/g, this.classVerdict ? this.classVerdict.line : '');
  }
}

function raceName(data, id) { const r = data.races.races.find((x) => x.id === id); return r ? r.name : id; }

/** RI-JRN01 O10 / items/writ.json: the object you carry out of the room. */
export function renderWrit(data, ch) {
  const item = data.writItems.items.find((i) => i.id === 'stamped-writ');
  const sign = birthsignById(data, ch.birthsign);
  const second = ch.birthsign_second ? birthsignById(data, ch.birthsign_second) : null;
  const caste = (data.classes.caste_topics.find((t) => t.families.indexOf(ch.class_family) >= 0) || { line: '' }).line;
  const claim = (sign.id === 'nu-shanei' || (second && second.id === 'nu-shanei'))
    ? 'A claim is recorded against this bearer. The Office does not hold the claim and cannot discharge it.'
    : '';
  const up = data.reactions.upbringings.find((u) => u.id === ch.upbringing);
  const map = {
    '%PCName': ch.given_name,
    '%HatchNameOrNone': ch.hatch_name_refused ? 'The bearer declined to give a second name.' : ch.hatch_name,
    '%Race': raceName(data, ch.race),
    '%UpbringingGivenAs': up ? up.given_as : ch.upbringing,
    '%ClassName': ch.class_name,
    '%BirthsignName': sign.name,
    '%BirthsignJel': sign.jel,
    '%BirthsignSecondOrNone': second ? `${second.name} (${second.jel})` : 'None recorded.',
    '%Sex': ch.sex === 'unrecorded' ? 'Left empty.' : (ch.sex === 'male' ? 'Male.' : 'Female.'),
    '%CasteLine': caste,
    '%BountyRef': `TW-${ch.race.slice(0, 3).toUpperCase()}-${ch.class_family.slice(0, 3).toUpperCase()}`,
    '%ClaimLine': claim,
  };
  const lines = item.template.map((l) => {
    let out = l;
    for (const k of Object.keys(map)) out = out.split(k).join(map[k]);
    return out;
  }).filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
  return { id: 'stamped-writ', name: item.name, readable: true, text: lines.join('\n') };
}
