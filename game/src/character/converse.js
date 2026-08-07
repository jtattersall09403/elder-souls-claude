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
      const cur = idx.get(t.id) || { id: t.id, infos: [] };
      for (const info of (t.infos || [])) cur.infos.push({ ...info, from: doc.group || null });
      idx.set(t.id, cur);
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
export function infoAllowed(info, { race, upbringing }) {
  if (!info) return false;
  const req = info.requires || null;
  const forb = info.forbids || null;
  if (req && Array.isArray(req.race) && req.race.indexOf(race) < 0) return false;
  if (req && Array.isArray(req.upbringing) && req.upbringing.indexOf(upbringing) < 0) return false;
  if (forb && Array.isArray(forb.race) && forb.race.indexOf(race) >= 0) return false;
  if (forb && Array.isArray(forb.upbringing) && forb.upbringing.indexOf(upbringing) >= 0) return false;
  return true;
}

/**
 * The info this person would give on this topic, or null if there is nothing they are willing
 * or able to say. Actor preference: an info written for this person's actor role wins over a
 * generic one; among equals, the first written wins (no PRNG).
 */
export function infoFor(topicIndex, topicId, npc, player) {
  const t = topicIndex.get(topicId);
  if (!t) return null;
  const actor = npc.actor || null;
  let generic = null;
  for (const info of t.infos) {
    if (!infoAllowed(info, player)) continue;
    if (actor && info.a === actor) return { topic: topicId, actor: info.a, text: info.x, gated: !!(info.requires || info.forbids) };
    if (!info.a && !generic) generic = info;
    if (!generic && !actor) generic = info;
  }
  return generic ? { topic: topicId, actor: generic.a || null, text: generic.x, gated: !!(generic.requires || generic.forbids) } : null;
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
    this.greeting = greetingFor(this.data, {
      npcId: npc.eid, reactionGroup: npc.reaction_group, disposition: dispo,
      playerRace: player.race, nth,
    });
    // A person with no reaction group is not in the matrix and falls back to whatever their
    // record wrote by hand. Nothing is silently blank.
    if (!this.greeting && npc.lines && npc.lines.greeting) {
      this.greeting = { cell: null, reaction_group: npc.reaction_group, disposition_band: null, player_race_class: playerRaceClass(player.race), line: npc.lines.greeting, pool_size: 1 };
    }
    this.list = topicsFor(this.topics, npc, player);
    return this;
  }

  say(topicId, player) {
    if (!this.open || !this.npc) return null;
    const info = infoFor(this.topics, topicId, this.npc, player);
    if (!info) return null;
    this.said = info;
    return info;
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
