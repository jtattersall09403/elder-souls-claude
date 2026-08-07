// Talking to somebody who is not the Warden-Scribe.
//
// Owner: W1-07. Binding sources: RI-CHR02 §4c (greeting volume and its keying), RI-CHR02 §5
// (race gates what people will discuss), RI-MTH07 / ARBITRATION §3 (CONSUMPTION).
//
// WHY THIS FILE EXISTS.
// The round-2 verdict on this piece: "`greetings.json`'s 300 cells / 1,500 lines and the 96
// race-gated topic records have no world-side consumer — `chData.greetings` is written at
// engine.js:3706 and read nowhere, and a live NPC offers a Dunmer and a Saxhleel byte-identical
// topic lists — so the dialogue-volume axis is 0 by RI-MTH07 even though every data floor is
// met." That is correct and it is the whole reason this module was written: a model with no
// reader is not shipped. There was no NPC dialogue path in the build at all — `getDialogueState`
// (A-JRN13) is declared absent and owned by wave-1 pieces W1-11..W1-13 — so this is the first
// one, deliberately small, and it does exactly two things the verdict asked for:
//
//   1. it SPEAKS a line out of `dialogue/greetings.json`, chosen by (reaction group, band of the
//      LIVE derived disposition, player race class), so that changing the reaction matrix or the
//      player's race changes what a person says to you; and
//   2. it offers a TOPIC LIST filtered through `requires.race` / `forbids.race`, so that a
//      Dunmer and a Saxhleel standing in front of the same person are not offered the same
//      conversation.
//
// It draws on the SAME `render/ui.js` surface the census draws on and takes the SAME closed
// action set, so everything RI-JRN01 O8 and O17 already guarantee about the census — never
// full-screen, no cursor, completable on a stick and two buttons — is true here for free.
//
// Determinism: no PRNG and no clock. Which of a cell's five lines you get is a pure function of
// (npc eid, how many times this person has greeted you), so a replay says the same words.
'use strict';

import { playerRaceClass } from './reaction.js';
import { topicKey } from '../core/topics.js';

/**
 * The band a disposition falls in, READ OUT OF `greetings.json#keying.bands`.
 *
 * Note it is not `reaction.js band()`: that function returns RI-DLG04 §E's five bands
 * (hostile/cold/neutral/friendly/devoted) and this table is RI-CHR02 §4c's five
 * (hostile/cold/neutral/warm/friendly), with different cut points. Two band vocabularies
 * exist in the corpus, they are for different things, and silently using one where the data
 * declares the other would key every greeting into the wrong cell while still returning a
 * line — the quietest possible way to be wrong. Read the file.
 */
export function greetingBand(data, v) {
  const bands = (data.greetings && data.greetings.keying && data.greetings.keying.bands) || [];
  for (const b of bands) if (v >= b.range[0] && v <= b.range[1]) return b.id;
  return bands.length ? bands[bands.length - 1].id : null;
}

/** Which of a five-line cell you hear. Deterministic, and it advances, so people repeat slowly. */
function pick(lines, npcId, nth) {
  if (!lines || !lines.length) return null;
  let h = 2166136261;
  for (let i = 0; i < npcId.length; i++) { h ^= npcId.charCodeAt(i); h = Math.imul(h, 16777619); }
  h = (h >>> 0) + (nth | 0);
  return lines[h % lines.length];
}

/**
 * The greeting cell for a person and a player. Returns the pool record as well as the line so
 * a probe can see which of the 300 cells it landed in and assert that a perturbation moved it.
 */
export function greetingFor(data, { npcId, reactionGroup, disposition, playerRace, nth = 0 }) {
  const g = data.greetings;
  if (!g || !g.pools) return null;
  const b = greetingBand(data, disposition);
  const prc = playerRaceClass(playerRace);
  const keys = Object.keys(g.pools);
  for (const k of keys) {
    const p = g.pools[k];
    if (p.reaction_group === reactionGroup && p.disposition_band === b && p.player_race_class === prc) {
      return { cell: k, reaction_group: p.reaction_group, disposition_band: b, player_race_class: prc, line: pick(p.lines, npcId, nth), pool_size: p.lines.length };
    }
  }
  return null;
}

/**
 * Every topic record in the corpus, indexed by id. Several files declare the same topic id
 * with different `a` (actor) rows; they are merged, so an actor lookup sees every info written
 * for that topic anywhere.
 */
export function buildTopicIndex(topicDocs) {
  const idx = new Map();
  for (const doc of topicDocs) {
    if (!doc || !Array.isArray(doc.topics)) continue;
    for (const t of doc.topics) {
      // `topics/thorn.json` is a different (quest-link) schema whose rows key on `topic`, not
      // `id`. Indexing those produced a single junk entry under the key `undefined`. Skip
      // anything that is not a topic record rather than pretending it is one.
      if (!t || typeof t.id !== 'string') continue;
      // Keyed on the FOLDED spelling (core/topics.js). The dialogue files write slugs and the
      // NPC records write the prose form of the same keyword, and until this fold existed 47
      // distinct topic ids sat in `npc.topics` with no reachable info — the person advertised
      // a subject and had nothing to say on it. `id` keeps the authored spelling, because that
      // is what a save file and a UI should show.
      const key = topicKey(t.id);
      const cur = idx.get(key) || { id: t.id, infos: [] };
      for (const info of (t.infos || [])) cur.infos.push({ ...info, from: doc.group || null });
      idx.set(key, cur);
    }
  }
  return idx;
}

/**
 * RI-CHR02 §5, and the round-2 finding "an NPC's topic list is byte-identical for a Dunmer and
 * a Saxhleel". `requires.race` is a whitelist and `forbids.race` a blacklist; both are read
 * here and nowhere else, and both are read against the LIVE player race rather than against a
 * snapshot, so `setState({race})` moves the list without anything being respawned.
 */
export function infoAllowed(info, { race, upbringing, disposition, knows }) {
  if (!info) return false;
  const req = info.requires || null;
  const forb = info.forbids || null;
  if (req && Array.isArray(req.race) && req.race.indexOf(race) < 0) return false;
  if (req && Array.isArray(req.upbringing) && req.upbringing.indexOf(upbringing) < 0) return false;
  if (forb && Array.isArray(forb.race) && forb.race.indexOf(race) >= 0) return false;
  if (forb && Array.isArray(forb.upbringing) && forb.upbringing.indexOf(upbringing) >= 0) return false;
  // Filter field 10 — Disposition >= N (RI-DLG01 §A). `d` is authored across this corpus and
  // was read by NOTHING until now: `tools/dialogue/build-graph.mjs` counts it as a filter for
  // the unreachable-INFO lint while the world-side reader ignored it, so every disposition
  // band in the dialogue data was decorative. It is checked only when the caller supplies a
  // disposition, so a probe that asks `infoFor(idx, id, npc, {race, upbringing})` keeps its
  // old answers and nothing that was passing starts failing for a reason it cannot see.
  if (info.d != null && disposition !== undefined && Number(disposition) < Number(info.d)) return false;
  // Filter fields 11-16 — the world-state conditions (`Journal`, `Global`). `knows` is the set
  // of world flags the character has actually earned. `requires.knows` is ANY-of, because two
  // different routes through an act can teach the same thing; `requires.knows_all` is ALL-of,
  // for a claim that is only worth putting to somebody once every piece of it is in hand.
  // Enforced only when the caller supplies the set, for the same reason as `d`.
  if (knows) {
    if (req && Array.isArray(req.knows) && !req.knows.some((k) => knows.has(k))) return false;
    if (req && Array.isArray(req.knows_all) && !req.knows_all.every((k) => knows.has(k))) return false;
    if (forb && Array.isArray(forb.knows) && forb.knows.some((k) => knows.has(k))) return false;
  } else if (req && (Array.isArray(req.knows) || Array.isArray(req.knows_all))) {
    // No knowledge context means the character has learned nothing we can see. A gate whose
    // evidence is missing must close, not open — an unverifiable requirement that passes is
    // the "the gate is decorative" failure RI-JRN07 M-Q14 makes a hard fail.
    return false;
  }
  return true;
}

/**
 * `the-hatch-name-list` -> `the_hatch_name_list`, the key an NPC record writes a line under.
 * Folded first (core/topics.js) so that the prose spelling of the same keyword — which is what
 * the main-quest NPC records use — finds the same field.
 */
function lineKey(topicId) { return topicKey(topicId).split(' ').join('_'); }

/**
 * The info this person would give on this topic, or null if there is nothing they are willing
 * or able to say.
 *
 * PRECEDENCE, most specific first — Morrowind's own order, and the reason it is this order is
 * that each step down is a wider audience:
 *
 *   1. a line written on THIS PERSON'S record (`lines[the_topic_id]`). The opening NPCs each
 *      carry several, and until this round every one of them was authored and unreachable:
 *      `jeeh-ei.lines.the_hold`, `tuleeh-ma.lines.the_writ / lukiul / my_work / the_list`. The
 *      topic ids were in their `topics` arrays, the prose was on their records, and no code
 *      joined the two — the same "model with no reader" defect as the headline gap, one layer
 *      down.
 *   2. an info written for this person's ACTOR row (`a`).
 *   3. an info written for nobody in particular (no `a`) — anyone may say it.
 *
 * What is deliberately NOT here: the previous rule handed an NPC with `actor: null` the FIRST
 * allowed info of any actor whatsoever, so a net-mender could speak a Dres factor's line. That
 * is not a fallback, it is a category error, and it also meant "give this person an actor" made
 * them say strictly less. Every NPC record now carries an actor and the accident is gone.
 *
 * Player gates (`requires` / `forbids`) are checked at every level, so a person's own line is
 * still refusable by race — specificity buys precedence, not an exemption.
 */
export function infoFor(topicIndex, topicId, npc, player) {
  const own = npc.lines ? npc.lines[lineKey(topicId)] : null;
  if (own) return { topic: topicId, actor: npc.actor || null, text: own, gated: false, source: 'npc', to: [] };
  const t = topicIndex.get(topicKey(topicId));
  if (!t) return null;
  const actor = npc.actor || null;
  let best = null, bestScore = -1;
  for (const info of t.infos) {
    if (!infoAllowed(info, player)) continue;
    const matchesActor = actor && info.a === actor;
    if (!matchesActor && info.a) continue;         // written for somebody else's mouth
    // Specificity, high to low: an actor-matched info beats an actorless one, and among those
    // a GATED info beats the ungated fallback.
    //
    // That last clause is not a nicety. `the-tides` carries three fisher infos — an ungated
    // one, a saxhleel/naga one and a warmblood one — and because the ungated one is written
    // first, first-match returned it to everybody and BOTH race variants were dead text. Eight
    // topics were shadowed this way, `the-hist` and `slavery` among them: the two subjects on
    // which the province's answer most depends on who is asking. The gates were being read and
    // were still decorative. Specificity ordering is what makes an ungated info mean "when
    // nothing more particular applies" rather than "always".
    //
    // `d` joins the same ladder, above `forbids` and below `requires`. Morrowind expresses a
    // disposition band by stacking INFOs with descending `Disposition >=` minima and taking the
    // first that passes; because this reader scores rather than takes-the-first, a band has to
    // be worth something or a d60 answer and a d30 answer would tie and the authored order
    // alone would decide. It scores by the HEIGHT of the bar, so the highest band the speaker
    // clears is the one the player hears — which is the same answer Morrowind's authored
    // descending order gives, obtained without depending on file order.
    const dScore = info.d != null ? 1 + Math.min(1, Number(info.d) / 100) : 0;
    const score = (matchesActor ? 8 : 0) + (info.requires ? 4 : 0) + dScore + (info.forbids ? 0.5 : 0);
    if (score > bestScore) { best = info; bestScore = score; }
  }
  if (!best) return null;
  return {
    topic: topicId, actor: best.a || null, text: best.x,
    gated: !!(best.requires || best.forbids),
    source: best.a ? 'actor' : 'generic',
    // Morrowind's AddTopic, which this corpus has been authoring all along under the name `to`.
    // 456 of the 638 infos in `game/data/dialogue/topics/**` carry one and NOTHING read it, so
    // the province's entire keyword graph — 181 distinct targets — was a diagram. It is
    // returned here and fired by `Engine.conversationSay()`; see the header of
    // `game/src/sim/quest/topic-supply.js` for why that is the whole of the main quest's
    // bootstrap.
    to: Array.isArray(best.to) ? best.to.slice() : [],
  };
}

/** The topics this person will discuss with THIS player, in the order the record lists them. */
export function topicsFor(topicIndex, npc, player) {
  const out = [];
  for (const id of (npc.topics || [])) {
    const info = infoFor(topicIndex, id, npc, player);
    if (info) out.push({ id, text: topicLabel(id), gated: info.gated });
  }
  return out;
}

/** A topic id is a slug; the player sees it as the words they would say. */
export function topicLabel(id) {
  return String(id).split('-').join(' ');
}

/**
 * One conversation. Opened by walking up to somebody and pressing the same button that answers
 * the Warden-Scribe; closed by `block`, which is the same "no" the census uses.
 */
export class Conversation {
  constructor(data, topicIndex) {
    this.data = data;
    this.topics = topicIndex;
    this.close();
  }

  close() {
    this.open = false;
    this.npc = null;
    this.greeting = null;
    this.said = null;
    this.list = [];
    this.extra = [];
    this.sel = 0;
    return this;
  }

  /**
   * @param npc     the live sim.npcs record
   * @param player  { race, upbringing, birthsign }
   * @param dispo   the DERIVED disposition (Engine.npcDisposition), not the base
   */
  start(npc, player, dispo, nth) {
    this.open = true;
    this.npc = npc;
    this.sel = 0;
    this.said = null;
    // The filter context this conversation is conducted under. The derived disposition and the
    // world flags the character has actually earned are part of who is standing there, so they
    // travel with the player view rather than being re-supplied at every `say()`; `say()` is
    // called from the UI and had no way to know either of them.
    this.player = { ...player, disposition: dispo, knows: player.knows || this.knows || null };
    this.greeting = greetingFor(this.data, {
      npcId: npc.eid, reactionGroup: npc.reaction_group, disposition: dispo,
      playerRace: player.race, nth,
    });
    // A person with no reaction group is not in the matrix and falls back to whatever their
    // record wrote by hand. Nothing is silently blank.
    if (!this.greeting && npc.lines && npc.lines.greeting) {
      this.greeting = { cell: null, reaction_group: npc.reaction_group, disposition_band: null, player_race_class: playerRaceClass(player.race), line: npc.lines.greeting, pool_size: 1 };
    }
    this.list = topicsFor(this.topics, npc, this.player);
    // W1-19 round 2 — the two topics that are not in anybody's `topics` array because they are
    // not about a subject, they are about getting somewhere and about what the town is saying.
    // `supply` is installed by `Engine` (`_installTopicSupply`) and is the reader for
    // `q.directions` and `dialogue/rumours.json`; see `sim/quest/topic-supply.js`.
    this.extra = [];
    if (this.supply) {
      for (const d of this.supply.directionsFor(npc.eid) || []) {
        this.extra.push({ id: d.id, text: d.id, gated: false, kind: 'directions', quest: d.quest, x: d.text });
      }
      const r = this.supply.rumourFor(npc, this.player, nth || 0);
      if (r) this.extra.push({ id: r.id, text: r.id, gated: !!(r.requires || r.forbids), kind: 'rumour', x: r.x, to: r.adds_topics || [] });
    }
    for (const e of this.extra) this.list.push({ id: e.id, text: e.text, gated: e.gated });
    return this;
  }

  /**
   * The world flags this character has earned, as a Set. Installed by the engine at boot so the
   * knowledge gates in `dialogue/topics/**` are evaluated against what the player actually did
   * rather than against what the quest data knows (RI-JRN07 M-Q14 — a gate that cannot fail is
   * a gate that is not there).
   */
  setKnows(knows) { this.knows = knows || null; return this; }

  /**
   * The reader for `q.directions`, `opens_by.overheard_from` and `dialogue/rumours.json`.
   * Installed by `Engine`; absent in a bare unit test, in which case a conversation behaves
   * exactly as it did before this round.
   */
  setSupply(supply) { this.supply = supply || null; return this; }

  /**
   * The opacity register (`game/src/world/opacity.js`), installed by `Engine._installOpacity()`.
   *
   * Absent in a bare unit test, in which case `say()` behaves exactly as it did before this
   * round — a topic nobody has an info for returns null and the engine reports `no_info`.
   */
  setOpacity(reg) { this.opacity = reg || null; return this; }

  say(topicId, player) {
    if (!this.open || !this.npc) return null;
    // The way there, and what the town is saying. Both return their text VERBATIM out of the
    // model that owns it — `q.directions` and a rumour row — because a line composed from
    // quest metadata is `RI-DLG05`'s "How we lose" and the rule does not stop at the journal.
    const ex = (this.extra || []).find((e) => topicKey(e.id) === topicKey(topicId));
    if (ex) {
      this.said = { topic: ex.id, actor: this.npc.actor || null, text: ex.x, gated: ex.gated, source: ex.kind, to: ex.to || [], quest: ex.quest || null };
      return this.said;
    }
    // The conversation's own filter context wins: it carries the derived disposition and the
    // knowledge set, which the caller does not have. A caller-supplied view is merged over it
    // so a probe can still perturb race or upbringing mid-conversation and watch the list move.
    const view = player ? { ...this.player, ...player } : this.player;
    const info = infoFor(this.topics, topicId, this.npc, view);
    if (info) { this.said = info; return info; }
    // RI-WLD09 §B1, the consumer. Nothing to say is the world's answer to two completely
    // different situations — nobody wrote anything, and nobody is going to tell you — and from
    // inside the game they are the same silence. That equivalence is the failure the opacity
    // budget exists to prevent, so when a REGISTERED topic reaches somebody with no info, they
    // decline out loud instead. The refusal comes verbatim out of `world/opacity.json`; it is
    // never composed, for the same reason the journal never composes (RI-DLG05 "How we lose").
    //
    // This fires for the twenty-four registered mysteries and for nothing else. Take a mystery
    // out of the register and its topic goes straight back to silence, which is the perturbation
    // that shows the register is being read.
    if (this.opacity) {
      const ref = this.opacity.refusalFor(topicId, this.npc);
      if (ref) {
        this.opacity.noteRefusal(ref.mystery);
        this.said = {
          topic: topicId, actor: ref.actor, text: ref.text, gated: false,
          source: 'refusal', mystery: ref.mystery, to: [],
        };
        return this.said;
      }
    }
    return null;
  }

  move(dir) {
    const n = this.list.length;
    if (n <= 0) return this.sel;
    this.sel = ((this.sel + dir) % n + n) % n;
    return this.sel;
  }

  state() {
    if (!this.open || !this.npc) return { open: false };
    return {
      open: true,
      npc: this.npc.eid,
      name: this.npc.name,
      title: this.npc.title || null,
      greeting: this.greeting ? this.greeting.line : null,
      greeting_cell: this.greeting ? this.greeting.cell : null,
      greeting_key: this.greeting ? [this.greeting.reaction_group, this.greeting.disposition_band, this.greeting.player_race_class] : null,
      said: this.said ? this.said.text : null,
      said_topic: this.said ? this.said.topic : null,
      topics: this.list.map((t) => ({ id: t.id, text: t.text, gated: t.gated })),
      selected: this.sel,
    };
  }
}

/**
 * The model `render/ui.js` draws — deliberately the same shape the census produces, because
 * the surface is the same surface and a second UI vocabulary is a second thing to keep honest.
 */
export function buildConversationModel(conv, placeName) {
  const st = conv.state();
  if (!st.open) return null;
  return {
    node: `talk:${st.npc}`,
    speaker_name: st.name,
    speaker_title: st.title,
    place_name: placeName || null,
    spoken: st.greeting ? [st.greeting] : [],
    preamble: null,
    line: st.said || '',
    aside: st.topics.length ? null : 'She has nothing to say to you.',
    input_kind: 'choice',
    options: st.topics.map((t) => ({ id: t.id, text: t.text })),
    selected: st.selected,
    picked: [],
    typed: '',
  };
}
