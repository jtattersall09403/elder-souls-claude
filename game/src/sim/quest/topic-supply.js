// Where a topic comes from, when nobody has told the engine what it should have observed.
//
// Owner: W1-19 round 2. Binding: RI-MTH07 / ARBITRATION §3 (CONSUMPTION), RI-JRN07 §4
// (findability under seam S8, which has no markers), RI-DLG05 §A.3 (the AddTopic edge).
//
// WHY THIS FILE EXISTS.
// The round-1 verdict on the main quest: *"A player who boots this build, walks to Soulrest and
// stands in front of Undersexton Aveline Rell cannot start the main quest, and no sentence
// anywhere in the world tells them the words that would let them."* Measured cold, with nothing
// granted through the harness: **0 of 32 main quests offerable, 32 of 32 refused on
// `opens_by.topic`, 0 topics known**. `game/src/core/topics.js` had by then folded the two
// authored SPELLINGS of a topic keyword, which was necessary and not sufficient: the supply
// graph still pointed at itself. 23 of the 32 `hooks.json` AddTopic edges granted the topic of
// the very quest whose journal fired them, and 5 granted a topic nothing asked for.
//
// Four models in this tree were carrying the answer and had no reader:
//
//   1. **`info.to`** — Morrowind's AddTopic, authored on **456 of the 638 infos** in
//      `game/data/dialogue/topics/**`, 181 distinct targets, read by nothing. The whole
//      keyword graph of the province existed as a diagram.
//   2. **`opens_by.overheard_from`** — 3 main quests name the people you would hear it from.
//      Zero code consumers.
//   3. **`q.directions`** — 32 authored direction strings, 100% coverage, never drawn
//      anywhere. Under S8 there are no markers, so this is the navigation system.
//   4. **`dialogue/rumours.json`** — loaded into `data.rumours` at engine.js:5652 and read by
//      nothing after that.
//
// This module is the reader for all four, and it is deliberately one module rather than four
// patches, because they are one question: *how does a person come to know the words?*
//
// THE RULE, in one sentence: **a topic enters `sim.quest.topicsKnown` when somebody says it
// out loud to you.** Three ways that happens, and no fourth:
//
//   a. you ASK about it            — `conversationSay()` learns the topic and every `to` on
//                                    the info you heard;
//   b. you are GREETED by someone  — an NPC named in a quest's `opens_by.overheard_from`
//      who is already talking       talks about it whether or not you ask;
//      about it
//   c. you ask for the RUMOURS     — `latest rumours` speaks a line keyed to the settlement
//                                    you are standing in, and a rumour may carry `adds_topics`.
//
// Everything else — the quest chain's own forward edges — still runs through `hooks.json`
// `entry_topics`, but those are now authored to point FORWARD: `Q-MAIN-nn`'s journal grants
// `Q-MAIN-(nn+1)`'s topic, never its own. See `game/data/quests/hooks.json`.
'use strict';

import { topicKey } from '../../core/topics.js';

/**
 * The people who are already talking about a quest, indexed by NPC.
 *
 * `opens_by.overheard_from` is the field the quest author used to write down *"these are the
 * three people in the province who would mention this to a stranger"*. It had no consumer, so
 * the sentence it encodes was never spoken. Greeting one of them is now the world-side entry
 * to the chain: you do not have to know the words to walk up to a carter.
 *
 * @param {Iterable<object>} questDefs  every quest definition in the book
 * @returns {Map<string, Array<{quest:string, topic:string}>>}  npc id -> what they let slip
 */
export function buildOverheardIndex(questDefs) {
  const idx = new Map();
  for (const def of questDefs) {
    const ob = def.opens_by || {};
    const topic = ob.topic;
    if (!topic) continue;
    for (const npc of ob.overheard_from || []) {
      const row = idx.get(npc) || [];
      row.push({ quest: def.id, topic });
      idx.set(npc, row);
    }
  }
  return idx;
}

/**
 * The way there, indexed by the person who would tell you.
 *
 * `q.directions` is authored on all 32 main quests — *"from the Bone Ladder keep the water on
 * your left as far as Hollow-Reeds, then inland at the willows to Gideon's market cross"* —
 * validated for length and banned tokens, and shown to nobody. From the player's chair that is
 * identical to a string that was never written, and under seam S8 (no markers, no compass, no
 * quest arrow) it is the entire navigation system.
 *
 * It is surfaced as its OWN topic rather than appended to an existing line, because
 * `sim/quest/journal.js` rule 1 — the journal never composes text — is the same rule that
 * should govern a person's mouth. The topic appears on the giver (and on the people who were
 * already talking about the quest) once the quest is OPEN, and saying it returns
 * `q.directions` verbatim. Perturb the string and the sentence somebody says changes.
 *
 * @returns {Map<string, Array<{quest:string, id:string, text:string}>>} npc id -> direction topics
 */
export function buildDirectionsIndex(questDefs) {
  const idx = new Map();
  for (const def of questDefs) {
    const text = def.directions;
    if (!text || typeof text !== 'string') continue;
    const id = directionsTopicId(def);
    const speakers = new Set();
    if (def.giver && def.giver.npc_id) speakers.add(def.giver.npc_id);
    for (const npc of (def.opens_by || {}).overheard_from || []) speakers.add(npc);
    for (const npc of speakers) {
      const row = idx.get(npc) || [];
      row.push({ quest: def.id, id, text });
      idx.set(npc, row);
    }
  }
  return idx;
}

/** The words the player says to ask the way. Authored from the quest's own title, once. */
export function directionsTopicId(def) {
  return `the way to ${String(def.title || def.id).replace(/^The /, '').toLowerCase()}`;
}

/**
 * The rumour book, keyed by settlement.
 *
 * `dialogue/rumours.json` has two shapes: `rumours[settlement] = [string]` (ungated) and
 * `race_gated[] = {settlement, requires|forbids, x, adds_topics}`. Both are read here. A rumour
 * may carry `adds_topics`; that is what makes gossip the way into a quest chain rather than
 * decoration, and it is the only route into `Q-MAIN-01` that owes nothing to a prior quest.
 */
export class RumourBook {
  constructor(doc) {
    this.rows = [];
    const d = doc || {};
    for (const [settlement, lines] of Object.entries(d.rumours || {})) {
      for (const line of lines || []) {
        if (typeof line === 'string') this.rows.push({ settlement, x: line, adds_topics: [] });
        else if (line && line.x) this.rows.push({ settlement, ...line, adds_topics: line.adds_topics || [] });
      }
    }
    for (const r of d.race_gated || []) {
      if (!r || !r.x) continue;
      this.rows.push({ ...r, adds_topics: r.adds_topics || [] });
    }
  }

  /** Every rumour this character could hear in this settlement, in authored order. */
  for(settlement, player = {}) {
    const race = player.race, up = player.upbringing;
    return this.rows.filter((r) => {
      if (settlement && r.settlement && r.settlement !== settlement) return false;
      if (!settlement && r.settlement) return false;
      const req = r.requires, forb = r.forbids;
      if (req && Array.isArray(req.race) && req.race.indexOf(race) < 0) return false;
      if (req && Array.isArray(req.upbringing) && req.upbringing.indexOf(up) < 0) return false;
      if (forb && Array.isArray(forb.race) && forb.race.indexOf(race) >= 0) return false;
      if (forb && Array.isArray(forb.upbringing) && forb.upbringing.indexOf(up) >= 0) return false;
      return true;
    });
  }

  /**
   * The one this person tells you. Deterministic in (npc, how many times you have asked), for
   * the same reason `converse.js pick()` is: a replay must say the same words.
   */
  pick(settlement, player, npcId, nth = 0) {
    const pool = this.for(settlement, player);
    if (!pool.length) return null;
    let h = 2166136261;
    const s = String(npcId || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = (h >>> 0) + (nth | 0);
    return pool[h % pool.length];
  }

  get size() { return this.rows.length; }
}

/**
 * The topic a player says to ask for gossip.
 *
 * W1-SPEAKERS — THE SPELLING SPLIT, and why it is spelt this way. This constant read
 * `latest rumours` and the ROOT topic in `dialogue/topics/00-roots.json` is `latest-rumors`.
 * `core/topics.js topicKey()` folds case, dashes and apostrophes and deliberately does NOT fold
 * dialect spellings — its own rule is "never merge two keywords an author meant to keep apart" —
 * so the province carried TWO gossip keywords that could never meet. A speaker with a settlement
 * rumour listed both, the root one's authored info was unreachable text, and any quest gate
 * seeded from one spelling could not be satisfied by the other.
 *
 * The root spelling wins because it is the one with provenance: Morrowind's own `defaultTopics`
 * table, which RI-DLG01 §A cites as the source of the nine, is US-spelled. This constant was the
 * deviation. Changing it here is the whole of the fix in the model; `Conversation.start()` also
 * had to stop pushing the rumour as a SECOND list entry, because once the two spellings fold
 * together the duplicate becomes visible instead of merely being wasteful.
 */
export const RUMOUR_TOPIC = 'latest rumors';

/**
 * Fold-safe append into the live `sim.quest.topicsKnown` array.
 *
 * Deduplicated on the FOLDED key — `topicsKnown` is compared through `core/topics.js` at the
 * gate, so storing both `the-drowned-tally` and `the drowned tally` would be two rows meaning
 * one thing, and `save/state.js` sorts and round-trips this array. The authored spelling of
 * whichever came first is what is kept, because that is what a save and a UI should show.
 *
 * @returns {string[]} the topics actually added (empty if they were all already known)
 */
export function learnTopics(topicsKnown, topics) {
  const seen = new Set(topicsKnown.map(topicKey));
  const added = [];
  for (const t of topics || []) {
    if (t == null) continue;
    const k = topicKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    topicsKnown.push(String(t));
    added.push(String(t));
  }
  return added;
}

/**
 * THE ROAD BOOK — the reader for `game/data/dialogue/road-directions.json`.
 *
 * Owner: W1-05. Binding: RI-WLD06 L3 (the spoken direction), RI-MTH07 / ARBITRATION §3
 * (CONSUMPTION), seam S35.
 *
 * WHY IT IS SEPARATE FROM `buildDirectionsIndex` ABOVE. That index reads `q.directions` — one
 * string per main quest, offered by the giver once the quest is open, and it answers exactly one
 * question: *where is the thing I have been sent to?* It says nothing at all to a player who has
 * been sent nowhere. Under seam S35 the map is a record of ground already walked, so it is blank
 * ahead of you on a first journey and cannot get you anywhere new; the road book is what is left,
 * and it has to work for somebody with an empty journal who simply wants to reach Gideon.
 *
 * WHAT IT KEYS ON. Two things, both of which the person standing in front of you actually has:
 * the settlement they belong to, and their `actor` archetype. The routes in the file are directed
 * — `helstrom-to-gideon` is not the same sentence as `gideon-to-helstrom` — so only the routes
 * LEADING OUT of where you are standing are offered. That is not a technicality. A man in Lilmoth
 * asked the way to Stormhold is being asked about a road he has never set foot on, and the honest
 * answer is the one in `dialogue/topics/60-roads.json`, not a route description he could not
 * possibly give.
 *
 * WHY THE ANSWERS ARE NOT ALL TRUE. Twenty of the forty-six are, twenty-two are `vague` — real
 * directions from real people mostly are — and four are `wrong`. RI-JRN07 U4: *"a world where
 * everyone is honest is not this world."* Every wrong answer carries `tell` and `tell_ids`, which
 * name the signpost, waystation or leg in the built world that contradicts it, so a careful
 * player can catch the lie by checking rather than by reloading. `tools/world/signpost-audit.mjs`
 * resolves every one of those ids against the shipped data and fails if one dangles: a lie
 * nobody can catch is not a feature, it is a defect.
 *
 * PERTURBATION (this is what makes it a consumer rather than a diagram). Change the `x` of any
 * answer in `road-directions.json` and the sentence a specific person in a specific town speaks
 * changes with it; delete the file's `routes` array and eight topics disappear from every
 * settlement's conversations at once. Neither is true of a model nothing reads.
 */
export class RoadBook {
  constructor(doc) {
    /** settlement id -> [{ topic, route, to, leg, answers }] */
    this.bySettlement = new Map();
    this.routes = ((doc && doc.routes) || []).slice();
    for (const r of this.routes) {
      if (!r || !r.from || !r.topic) continue;
      const row = this.bySettlement.get(r.from) || [];
      row.push(r);
      this.bySettlement.set(r.from, row);
    }
  }

  /**
   * The settlement this person belongs to. An NPC entity carries it flattened or on `record`
   * depending on how it was spawned, exactly as `rumourFor` in `engine.js` has to handle.
   */
  static settlementOf(npc) {
    if (!npc) return null;
    return npc.settlement || (npc.record && npc.record.settlement) || null;
  }

  /**
   * Which answer THIS person gives. The archetype match wins; an answer with no `a` is what
   * anybody says when nothing more particular applies, which is the same precedence
   * `character/converse.js#infoFor` uses for the topic index, and it is deliberate that the two
   * agree — a second precedence rule is a second thing to keep honest.
   *
   * Deterministic in the NPC id when several answers tie, for the reason `RumourBook.pick` is:
   * a replay must say the same words, and a direction that changes when you ask twice is worse
   * than a wrong one.
   */
  static answerFor(route, npc) {
    const answers = (route && route.answers) || [];
    if (!answers.length) return null;
    const actor = (npc && (npc.actor || (npc.record && npc.record.actor))) || null;
    const keyed = answers.filter((a) => a.a && a.a === actor);
    const pool = keyed.length ? keyed : answers.filter((a) => !a.a);
    const use = pool.length ? pool : answers;
    if (use.length === 1) return use[0];
    let h = 2166136261;
    const s = String((npc && npc.eid) || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return use[(h >>> 0) % use.length];
  }

  /**
   * Every road out of where this person is standing, as topic rows ready for the conversation's
   * `extra` list. Returns `[]` for somebody who belongs to no settlement, which is correct: a
   * hermit on the Clay Moor is not a signpost.
   */
  forNpc(npc, fallbackSettlement = null) {
    // `fallbackSettlement` is where the PLAYER is standing (`sim.env.settlement`). An NPC
    // instantiated by a state file often carries no `settlement` of its own, and without this
    // fallback the road topics silently never appear — which is how the first run of
    // `tools/world/wayfind-journey.mjs` found four people standing in Soulrest and not one of
    // them able to tell you the way out of it. `rumourFor` in engine.js already falls back the
    // same way, and the two must agree or a town gossips about a place it cannot direct you to.
    const settlement = RoadBook.settlementOf(npc) || fallbackSettlement;
    if (!settlement) return [];
    const out = [];
    for (const route of this.bySettlement.get(settlement) || []) {
      const a = RoadBook.answerFor(route, npc);
      if (!a || !a.x) continue;
      out.push({
        id: route.topic,
        text: a.x,
        route: route.id,
        to_place: route.to,
        leg: route.leg || null,
        truth: a.truth || 'true',
      });
    }
    return out;
  }

  get size() { return this.routes.length; }
}
