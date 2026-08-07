// The canon register, world-side.
//
// Owner: W1-23. Binding sources: RI-LOR06 (contradiction discipline and the registry),
// RI-LOR01 §Registry, RI-MTH07 / ARBITRATION §3 (CONSUMPTION), RI-LOR06 §1.2 (nothing in the
// game corrects a contradiction).
//
// WHY THIS FILE EXISTS.
// `corpus/60-lore/data/canon-facts.json` is fifty-odd facts describing what this province holds
// true, what it argues about, and who takes which side. It has existed since before the game
// booted and until now it had exactly two readers, both of them critic scripts in
// `corpus/80-methods/`. Nothing in `game/` had ever opened it. That is the defect RI-MTH07 names
// in as many words: a register nothing reads is a document, and a document cannot be wrong about
// the world because it never touches it.
//
// So the registry is now projected into `game/data/lore/canon.json` by `tools/lore/build-canon.mjs`
// and read here, and there are three readers, each answering a different way the register could
// be fake:
//
//   1. `resolve()` — every source the registry says holds a position must be a book, a dialogue
//      info or a person that is really in this build. The engine calls this at boot and THROWS
//      on a dangle. A dispute whose two sides are named by nobody is what RI-LOR06 calls "a note
//      dressed as a dispute": it scores as texture and is paperwork.
//   2. `stanceOf()` / `allows()` — the behavioural half. A dialogue info may declare `cf` (a
//      registered dispute) and `pos` (which side of it the line takes). It is then offered ONLY
//      to a speaker the register says holds that side. Ask a Deep-Kin why the wells are giving
//      less and you get the Deep-Kin's answer; ask a sexton of the Drowned Court and you get a
//      different one, and neither is corrected. Move a holder in the register and the province
//      changes its mind — that is the perturbation.
//   3. `noteHeard()` / `state()` — which disputes this character has actually heard argued, and
//      from how many sides. RI-LOR06's comparison method counts *fully voiced* disputes over the
//      corpus; this counts the ones a particular playthrough ran into, which is the number that
//      says whether the texture reached anybody.
//
// WHAT IS DELIBERATELY NOT HERE, and it is the same discipline `world/opacity.js` keeps.
// **No answers.** `authorially_true` is the writers' room's ruling on which side is right, and it
// is not in the shipped file: the projector replaces it with a sha256. A critic can prove the
// dispute was authored WITH a ruling by re-hashing the corpus half; the running game cannot state
// it, because the string is not in the build. There is no `settle()`, no `correct()`, and no way
// for code to mark a side as the true one. RI-LOR06 §1.2 says nothing in the game corrects a
// contradiction; this module could not.
'use strict';

import { topicKey } from '../core/topics.js';

export class CanonRegistry {
  /**
   * @param {object} doc `game/data/lore/canon.json`. A build without one gets an EMPTY register
   *   rather than a throw, for the reason `OpacityRegister` gives: `present() === false` is a
   *   measurement and a boot failure is not. `resolve()` still fails a register that lies, so a
   *   build that dropped the file cannot pass as a build that never had one.
   */
  constructor(doc) {
    this.doc = doc || null;
    this.facts = (doc && Array.isArray(doc.facts)) ? doc.facts : [];
    this.byId = new Map();
    /** folded topic key -> [fact id] — the subjects a dispute is argued on. */
    this.byTopic = new Map();
    for (const f of this.facts) {
      this.byId.set(f.id, f);
      for (const t of (f.topics || [])) {
        const k = topicKey(t);
        const arr = this.byTopic.get(k) || [];
        arr.push(f.id);
        this.byTopic.set(k, arr);
      }
    }
    /** fact id -> Set of position ids this character has heard argued. */
    this.heard = new Map();
  }

  get size() { return this.facts.length; }
  present() { return this.facts.length > 0; }
  get(id) { return this.byId.get(id) || null; }
  disputes() { return this.facts.filter((f) => f.disputed); }

  /**
   * Every `voiced_by` id names something in this build.
   *
   * @param {object} world { books:Set, topics:Map<foldedKey, Set<actor|null>>, npcs:Set }
   * @returns {{ok:boolean, checked:number, unresolved:string[]}}
   */
  resolve(world) {
    const unresolved = [];
    let checked = 0;
    const seeTopic = (topic, actor, where) => {
      const k = topicKey(topic);
      const actors = world.topics.get(k);
      if (!actors) { unresolved.push(`${where}: dialogue topic \`${topic}\` is not in this build`); return; }
      if (actor && !actors.has(actor)) unresolved.push(`${where}: topic \`${topic}\` has no info written for actor \`${actor}\``);
    };
    for (const f of this.facts) {
      for (const t of (f.topics || [])) {
        checked++;
        if (!world.topics.has(topicKey(t))) unresolved.push(`${f.id}.topics: \`${t}\` is not a dialogue topic in this build`);
      }
      for (const p of (f.positions || [])) {
        for (const id of (p.voiced_by || [])) {
          checked++;
          const ix = String(id).indexOf(':');
          const kind = ix < 0 ? '' : String(id).slice(0, ix);
          const rest = ix < 0 ? '' : String(id).slice(ix + 1);
          const where = `${f.id}/${p.id}`;
          if (kind === 'book') { if (!world.books.has(rest)) unresolved.push(`${where}: \`${id}\` — no such book`); }
          else if (kind === 'npc') { if (!world.npcs.has(rest)) unresolved.push(`${where}: \`${id}\` — no such npc`); }
          else if (kind === 'dialogue') { const [tp, ac] = rest.split('#'); seeTopic(tp, ac || null, where); }
          else unresolved.push(`${where}: \`${id}\` — unknown id prefix (expected book: / dialogue: / npc:)`);
        }
        // A position nobody holds is the failure `held_by` exists to prevent (RI-LOR06 §2).
        if (!(p.holders && (p.holders.actors || p.holders.races || p.holders.factions))) {
          unresolved.push(`${f.id}/${p.id}: no \`holders\` — no speaker in this build can hold this position`);
        }
      }
    }
    return { ok: unresolved.length === 0, checked, unresolved };
  }

  /**
   * Which side of a registered dispute this speaker takes, or null if they take none.
   *
   * Matched off `positions[].holders`, which is the machine half of RI-LOR06's `held_by` prose.
   * A speaker who matches two positions holds NEITHER: a person who is both a rootkeeper and a
   * sexton of the Drowned Court has not been given a stance, they have been given a bug, and
   * silently taking the first match would hide it behind a plausible line.
   */
  stanceOf(npc, factId) {
    const f = this.byId.get(factId);
    if (!f || !f.disputed || !npc) return null;
    const actor = npc.actor || (npc.record && npc.record.actor) || null;
    const race = npc.race || (npc.record && npc.record.race) || null;
    const faction = npc.faction || (npc.record && npc.record.faction) || null;
    const hits = [];
    for (const p of (f.positions || [])) {
      const h = p.holders || {};
      const byActor = actor && Array.isArray(h.actors) && h.actors.includes(actor);
      const byFaction = faction && Array.isArray(h.factions) && h.factions.includes(faction);
      const byRace = race && Array.isArray(h.races) && h.races.includes(race);
      // A `races` list NARROWS an actor or faction match; on its own it is too coarse to be a
      // stance, because "every Argonian believes X" is a fact about a people and not about a
      // speaker, and using it alone would give a stance to every person in the province.
      if (byActor || byFaction) {
        if (Array.isArray(h.races) && h.races.length && !byRace) continue;
        hits.push(p.id);
      }
    }
    return hits.length === 1 ? hits[0] : null;
  }

  /**
   * May this speaker say this line?
   *
   * An info with no `cf` is untouched — the register gates the lines that claim a side and
   * nothing else, so adding the register to a build cannot silence dialogue that never made a
   * claim. An info that DOES claim a side is offered only to somebody who holds it.
   *
   * The fail-CLOSED direction is deliberate and it is the perturbation this module is proved by:
   * strike a holder out of `canon.json` and the line stops being offered by that speaker, which
   * is visible from `getConversationState()` without any instrument of mine.
   */
  allows(info, npc) {
    if (!info || !info.cf) return true;
    const f = this.byId.get(info.cf);
    if (!f) return true;            // a dangling cf is caught at boot by resolve(), not here
    if (!info.pos) return true;     // tagged with a subject but claiming no side
    return this.stanceOf(npc, info.cf) === info.pos;
  }

  /** The disputes argued on a topic the player has just put to somebody. */
  factsOnTopic(topicId) {
    return (this.byTopic.get(topicKey(topicId)) || []).map((id) => this.byId.get(id)).filter(Boolean);
  }

  /** Record that this character heard a side of a dispute argued out loud. */
  noteHeard(factId, posId) {
    if (!this.byId.has(factId) || !posId) return false;
    const s = this.heard.get(factId) || new Set();
    s.add(posId);
    this.heard.set(factId, s);
    return true;
  }

  /**
   * What this playthrough has actually run into. Reports no answers and cannot: the shipped
   * register carries a hash where the ruling used to be.
   */
  state() {
    const disputes = this.disputes();
    const rows = disputes.map((f) => {
      const heard = [...(this.heard.get(f.id) || [])].sort();
      return {
        id: f.id, claim: f.claim, positions: (f.positions || []).map((p) => p.id),
        heard, sides_heard: heard.length,
        both_sides: heard.length >= 2,
        topics: f.topics || [],
      };
    });
    return {
      present: this.present(),
      facts: this.facts.length,
      disputed: disputes.length,
      heard_any: rows.filter((r) => r.sides_heard > 0).length,
      heard_both_sides: rows.filter((r) => r.both_sides).length,
      carries_answers: false,
      disputes: rows,
    };
  }
}
