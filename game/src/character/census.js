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

import { composeCharacter, birthsignById, classById } from './sheet.js';
import { selectQuestions, scoreAnswers } from './questionnaire.js';

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
    this.flags = [];
    this.character = null;
    this.done = false;
    this.paused = false;
    this.writ = null;
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
      awaiting: this.paused ? 'the player walks out of the hold, down the gangplank and into the Writ House. RI-JRN01 O6.' : null,
      node: n.id,
      speaker: n.speaker,
      place: n.place,
      beat: n.beat || null,
      line: this._interpolate(n.line || ''),
      sets: n.sets || null,
      input: n.input ? { kind: n.input.kind, options: this._options(n) } : null,
      full_screen: false,
      world_visible: true,
    };
    if (n.id === 'writ.race-observed' && this.spec.race) {
      const m = n.misreads[this.spec.race];
      out.line = m.line;
      out.misread_as = m.wrong;
      out.input = { kind: 'observed', options: [{ id: 'correct', text: n.correction_prompt }] };
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
    if (inp.source === 'progression/attributes.json#attributes') {
      return this.data.attributes.attributes.map((a) => ({ id: a.id, text: a.name }));
    }
    if (inp.source === 'progression/skills.json#skills') {
      return this.data.skills.skills.map((s) => ({ id: s.id, text: s.name }));
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

    if (this.paused) throw new Error('census: the scene is waiting for the player to reach the Writ House; call censusEnter() when they do');
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
        this._advance('writ.birthsign');
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
        this._advance('writ.birthsign');
        break;
      }
      case 'writ.class-questions': {
        const q = this.asked[this.askedIndex];
        if (!q.answers.some((a) => a.id === value)) throw new Error(`census: ${q.id} has no answer ${JSON.stringify(value)}`);
        this.answers.push({ questionId: q.id, answerId: value });
        rec.question = q.id;
        this.askedIndex++;
        if (this.askedIndex >= this.asked.length) {
          const s = scoreAnswers(this.data, this.answers);
          this.questionnaireResult = s;
          this.spec.custom = { name: s.matched_class ? classById(this.data, s.matched_class).name : 'what you told her', favoured: s.favoured, neglected: s.neglected, primary: s.primary, secondary: s.secondary };
          if (s.matched_class) {
            this.spec.classId = s.matched_class;
            this.spec.custom = null;
            rec.line = n.on_match_named_class.replace('%ClassName', classById(this.data, s.matched_class).name);
          } else {
            rec.line = n.on_no_match;
          }
          this._advance('writ.birthsign');
        }
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
      default: throw new Error(`census: node ${n.id} takes no answer`);
    }
    this.transcript.push(rec);
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
            if (this._matches(b.when)) { this.transcript.push({ node: b.id, line: b.line }); this.flags.push(b.sets_flag); }
          }
          this.nodeId = n.next;
          continue;
        }
        if (n.when && this._matches(n.when)) return;   // node applies: stop and take input
        this.nodeId = n.next;
        continue;
      }
      if (n.hands_control_back) { this.paused = true; this.transcript.push({ node: n.id, line: n.line }); return; }
      if (n.terminates_creation) { this._finish(); return; }
      if (n.input) return;                              // somebody is waiting for an answer
      this.transcript.push({ node: n.id, line: this._interpolate(n.line || '') });
      this.nodeId = n.next;
    }
    throw new Error('census: the graph did not settle in 16 hops — a node cycle');
  }

  /** The player has walked into the Writ House. RI-JRN01 O6's >= 60 s has elapsed in play. */
  enter() {
    if (!this.paused) return this.state();
    this.paused = false;
    this.nodeId = 'writ.enter';
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

  _finish() {
    this.character = composeCharacter(this.data, this.spec);
    this.character.flags = this.flags.slice();
    this.character.route = this.spec.route;
    if (!this.character.invariants.attribute_total_ok) {
      throw new Error(`census: composed sheet has ${this.character.invariants.attribute_total} attribute points, not 112 — a race or class table is broken`);
    }
    this.writ = renderWrit(this.data, this.character);
    this.character.writ_text = this.writ.text;
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
      .replace(/%Birthsign/g, c.birthsign ? birthsignById(this.data, c.birthsign).name : '');
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
