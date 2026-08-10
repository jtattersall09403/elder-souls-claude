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
export const TOPIC_MANIFEST_SCHEMA = 'elder-souls/dialogue-topic-manifest@1';

/**
 * ARBITRATION S37, second requirement — THE MERGE ORDER IS DECLARED, NOT INHERITED.
 *
 * Under the scoring reader this function's output order was nearly decorative: the score picked
 * the winner and order survived only as a tie-break, in one topic. Under first-match-wins it is
 * the whole algorithm. **92 of 468 topic ids are declared in more than one file and hold 488 of
 * the 1,280 INFOs**, so for 38% of the corpus "authored file order" was not authored — and it was
 * worse than the ruling knew. There were TWO orders, and they disagreed:
 *
 *   * every tool built its doc list with `readdirSync().sort()` — by FILENAME;
 *   * the engine built its with `Object.keys(out.topics).sort()` (`engine.js` `loadData`), where
 *     the key is `doc.id || basename`. Three files carry a top-level `id`, so `06-opening-roots`,
 *     `45-speaker-coverage` and `main-quest-argument` sat in a DIFFERENT position in the running
 *     game than in every instrument pointed at it. **36 of the 92 merged ids involve one of them.**
 *
 * So the shipped game and its own gate were merging the corpus in two different orders, and once
 * order decides answers that is two different games. Neither order was chosen by anyone.
 *
 * `game/data/dialogue/topics/_manifest.json` now names the order and this function obeys it, so
 * the engine, the gate, the census and the lint all resolve against one declared sequence — and
 * the two accidental sorts upstream stop mattering, because whatever order the docs arrive in,
 * they leave here in the declared one.
 *
 * FAIL-CLOSED, and deliberately narrow (RULES 13: the data is authored before the assertion is
 * armed, and this was proven silent on the shipped tree before it landed). A doc carrying a
 * `group` is corpus data, because `group` is the per-file tag the corpus files all declare and
 * `from` is stamped from it. So:
 *
 *   - if any doc carries a `group`, the manifest must be present and must list that group;
 *   - a topic file whose `group` is missing from the manifest is an ERROR, not a doc quietly
 *     appended at the end. Adding a topic file is now a decision about where its INFOs sit
 *     against every other file's, and this makes you make it;
 *   - a doc list with no `group` anywhere is a hand-built fixture (every bare unit test) and is
 *     passed through untouched, exactly as before.
 */
export function orderTopicDocs(topicDocs) {
  const docs = Array.isArray(topicDocs) ? topicDocs.filter(Boolean) : [];
  const manifest = docs.find((d) => d && d.schema === TOPIC_MANIFEST_SCHEMA) || null;
  const grouped = docs.filter((d) => d !== manifest && typeof d.group === 'string' && d.group);
  if (!grouped.length) return docs.filter((d) => d !== manifest);   // hand-built fixture
  if (!manifest) {
    throw new Error(
      'dialogue topic merge order is undeclared: game/data/dialogue/topics/_manifest.json was not ' +
      'in the doc list, but ' + grouped.length + ' grouped topic doc(s) were. ARBITRATION S37 ' +
      'requires the merge order be declared in the corpus, because under RI-DLG01 §A first-match-' +
      'wins the file order decides answers. Load the manifest with the topic files.');
  }
  const rank = new Map();
  (manifest.order || []).forEach((row, i) => { if (row && row.group) rank.set(row.group, i); });
  const unlisted = grouped.filter((d) => !rank.has(d.group));
  if (unlisted.length) {
    throw new Error(
      'topic file(s) outside the declared merge order: ' + unlisted.map((d) => d.group).join(', ') +
      '. Add them to game/data/dialogue/topics/_manifest.json at the position you intend — under ' +
      'ARBITRATION S37 / RI-DLG01 §A the position is content, so there is no safe default.');
  }
  // Stable: docs sharing a rank (they cannot, ranks are unique per group) and ungrouped docs keep
  // their arrival order. Ungrouped, non-manifest docs sort last — a fixture spliced into a real
  // corpus list, which no shipped caller does.
  return docs
    .filter((d) => d !== manifest)
    .map((d, i) => ({ d, i, r: rank.has(d.group) ? rank.get(d.group) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((e) => e.d);
}

export function buildTopicIndex(topicDocs) {
  const idx = new Map();
  for (const doc of orderTopicDocs(topicDocs)) {
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
      // `root: true` is RI-DLG01 §A's nine — the words the player is given at creation and may
      // put to anyone, as against a subject a particular person advertises. It is authored in
      // `topics/00-roots.json` and was read by NOTHING: `topicsFor()` iterated `npc.topics`
      // alone, and measured over all 336 NPC records SEVEN OF THE NINE were listed by zero
      // speakers in the province. The flag is carried onto the merged record here so the roster
      // has one source, and a file that adds an actor's half of a root (`06-opening-roots.json`)
      // does not have to re-declare the flag to stay in it.
      if (t.root) cur.root = true;
      idx.set(key, cur);
    }
  }
  // The roster, in authored order, keyed the same way the index is. Attached to the Map rather
  // than returned alongside it because every existing caller passes this value around as one
  // thing, and a second return value would have to be threaded through all of them.
  idx.roots = [];
  for (const [key, t] of idx) if (t.root) idx.roots.push({ key, id: t.id });
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
 * Morrowind filter field 6 — Cell — against the SPEAKER's place.
 *
 * A settlement id in `cell` matches every cell inside it, per `00-roots.json#key_legend`, so
 * `cell: "gideon"` matches a person whose settlement is `gideon` and one standing in
 * `gideon-tollhouse`. The person's own `settlement` is tried first because it is the field the
 * population data actually carries; the interior names are tried after it so a record that
 * names only a room still resolves.
 *
 * A person with NO place at all fails every cell gate. That is deliberate and it is the
 * fail-closed direction: 15 of the 336 records carry no settlement, and the alternative —
 * letting a placeless speaker match every town — would hand them all eight settlements' answers
 * and let the first authored one win, which is the defect this function exists to remove.
 */
function inCell(npc, cell) {
  if (!cell) return true;
  const want = String(cell).toLowerCase();
  for (const v of [npc.settlement, npc.cell, npc.interior, npc.home_interior, npc.work_interior]) {
    if (!v) continue;
    const s = String(v).toLowerCase();
    if (s === want || s.startsWith(want + '-') || s.startsWith(want + '.')) return true;
  }
  return false;
}

/**
 * The info this person would give on this topic, or null if there is nothing they are willing
 * or able to say.
 *
 * PRECEDENCE. There is exactly ONE precedence step left in this function, and it is the first one
 * below. ARBITRATION S37 deleted the rest: steps 2 and 3 no longer rank against each other, they
 * are both simply admissible, and whichever the AUTHOR wrote first is the one that is said.
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
 * 2 and 3 are a FILTER, not a ladder: an info with somebody else's `a` is refused outright, and
 * among what survives the first one authored wins even if a more specific one sits below it. That
 * is Morrowind's rule and it is why an unreachable INFO is an authoring hazard there and a §D lint
 * row here. If a general answer is shadowing a particular one, move it down the file.
 *
 * What is deliberately NOT here: the previous rule handed an NPC with `actor: null` the FIRST
 * allowed info of any actor whatsoever, so a net-mender could speak a Dres factor's line. That
 * is not a fallback, it is a category error, and it also meant "give this person an actor" made
 * them say strictly less. Every NPC record now carries an actor and the accident is gone.
 *
 * Player gates (`requires` / `forbids`) are checked on every candidate, so being written for this
 * person's actor row buys admission, not an exemption.
 *
 * PROVENANCE (`from`). W1-17 round 2. `buildTopicIndex()` merges same-id topic records across
 * files BY DESIGN (its own header says so) and tags every info with the `group` of the file it
 * was authored in. Until this round that tag was computed and thrown away: the return value told
 * a caller THAT an info was found and never WHICH file's info it was. That is exactly how the
 * round-1 hard fail shipped invisible — `main-quest-argument.json` declares `the-steward-of-
 * the-count` and so does the eleven-year-old stub in `50-mainline.json`; they merge, the stub wins
 * (it outscored the greeting under the old rule and it PRECEDES it under S37 — the merge is the
 * defect in both worlds, which is why S37 made the order declared), and every caller that only asked
 * "did text come back?" saw a pass. `from` is additive (every existing return shape is unchanged)
 * so a probe can now ask the question that actually matters: is this THIS FILE's own text, or a
 * stranger's that happens to share the id.
 */
export function infoFor(topicIndex, topicId, npc, player, canon = null) {
  const own = npc.lines ? npc.lines[lineKey(topicId)] : null;
  if (own) return { topic: topicId, actor: npc.actor || null, text: own, gated: false, source: 'npc', from: 'npc-own-line', to: [] };
  const t = topicIndex.get(topicKey(topicId));
  if (!t) return null;
  const actor = npc.actor || null;
  let best = null;
  for (const info of t.infos) {
    if (!infoAllowed(info, player)) continue;
    // W1-23. RI-LOR06 §1: a contradiction lives at the SOURCE level, and a source is a person.
    // An info tagged `cf`/`pos` claims a side of a registered dispute, and only somebody the
    // canon register says holds that side may say it — so putting `the-thinning` to a Deep-Kin
    // elder and to a Ledger clerk gets two incompatible answers and nothing corrects either.
    // Untagged infos are not touched, so installing the register cannot silence a line that
    // never made a claim. `canon` is absent in a bare unit test and every existing caller
    // behaves exactly as it did before this round.
    if (canon && !canon.allows(info, npc)) continue;
    // W1-SPEAKERS. Filter field 6 — Cell. `cell` is authored on **267 of the 1,065 infos** in
    // `game/data/dialogue/topics/**` and was read by NOTHING: `infoAllowed()` checks
    // requires/forbids/`d`/`knows` and never the place, and the specificity score that used to
    // sit below never mentioned it. A quarter of the province's dialogue carried a place gate that did not
    // close, which does not read as "no gate" — it reads as the WRONG PLACE, because among
    // several equally-scoring infos the first authored one wins. Measured before this line
    // existed: a legionary standing in Thorn answered `specific place` with
    // *"Stormhold is four streets and a wall"*, and every settlement-specific root answer in
    // the build was delivered in the seven towns it was not written for.
    //
    // Prefix match, per `00-roots.json#key_legend`: a settlement id matches every cell inside
    // it, so `cell: "gideon"` covers `gideon-inn` and `gideon-tollhouse`. Tested against the
    // SPEAKER's place, not the player's, because it is field 6 of the speaker's filter.
    if (info.cell && !inCell(npc, info.cell)) continue;
    // Filter field 4 — speaker faction. Dialogue data uses the Construction Set spelling
    // (hyphens) while several NPC ledgers use save-safe underscores, so compare canonical
    // slugs rather than bytes. A faction-qualified line must never fall through to an actor
    // who merely shares the same voice register.
    if (info.f) {
      const factionKey = (v) => String(v || '').toLowerCase().replace(/[_\s]+/g, '-');
      if (factionKey(npc.faction) !== factionKey(info.f)) continue;
    }
    const matchesActor = actor && info.a === actor;
    if (!matchesActor && info.a) continue;         // written for somebody else's mouth
    // ARBITRATION S37 — THE WHOLE OF THE SELECTION RULE. Take the first survivor.
    //
    // What used to be here was a specificity score —
    //     8*actorMatch + 2*cell + 4*requires + (d ? 1 + min(1, d/100) : 0) + 0.5*forbids
    // — kept at its strict maximum, with authored order surviving only as the tie-break. It is
    // deleted rather than re-weighted, and the rationale that argued for it is deleted with it.
    // A scoring function tuned until it agrees with first-match is the thing the ruling rejects:
    // the point is not the answers, it is who decides them.
    //
    // RI-DLG01 §A: *"first-match-wins in authored file order. The engine walks the topic's INFO
    // list top to bottom and returns the first entry whose entire conjunction passes. It does
    // not score specificity. Ordering is authored, not computed."* ARBITRATION §1 gives Dialogue
    // to Morrowind outright and §5 precedence 1 settles it; the corpus is law and the engine was
    // running a different algorithm.
    //
    // Everything above this line is untouched, and that is the shape of the change: under
    // Morrowind's rule the actor row, the cell prefix, `requires`/`forbids`, `d` and the
    // knowledge conditions are all FILTERS, and only the CHOICE was ever in dispute.
    //
    // WHAT THIS COSTS, so the next reader does not rediscover it as a bug. The old comment was
    // right that scoring returned the highest disposition band a speaker clears *"without
    // depending on file order"*. That property is not lost, it is MOVED: the author must now
    // stack the bands in descending order, which RI-DLG01 §A already mandates. Two consequences
    // are real and are the price the ruling accepted:
    //   * authored order is content — 18.242% of resolutions across 64 topics move if it moves,
    //     so appending an INFO to the top of a file changes answers. `buildTopicIndex()` above
    //     is why that order is now declared instead of inherited from a directory listing;
    //   * six more INFOs become unhearable (8 -> 14 over the canonical player space). Those are
    //     a corpus bug under RI-DLG01 §D's unreachable-INFO row and the repair is to REORDER the
    //     files. Never to put a score back. The score is what made §D unenforceable: an author
    //     could not be wrong, so there was nothing to lint.
    //
    // Checked by `node tools/dialogue/arbiter-order-divergence.mjs --gate`, which calls this
    // function rather than modelling it, and goes red the day anyone scores here again.
    best = info;
    break;
  }
  if (!best) return null;
  return {
    topic: topicId, actor: best.a || null, text: best.x,
    gated: !!(best.requires || best.forbids),
    source: best.a ? 'actor' : 'generic',
    // Which topic FILE's `group` this info was authored in (see PROVENANCE above), or null for
    // an info whose doc declared no `group` at all.
    from: best.from || null,
    // W1-23. Which registered dispute this line argues, and which side of it. Carried out so a
    // probe can see that the answer moved rather than merely that an answer arrived.
    cf: best.cf || null, pos: best.pos || null,
    // W1-SPEAKERS. Which town this answer was written for, or null for the province-wide one.
    // Carried out for the same reason `cf` is: a probe that can see only the text cannot tell a
    // Gideon answer correctly delivered in Gideon from a Gideon answer delivered in Soulrest,
    // and "an answer arrived" is exactly the check that let 267 dead cell gates ship.
    cell: best.cell || null,
    // Morrowind's AddTopic, which this corpus has been authoring all along under the name `to`.
    // 456 of the 638 infos in `game/data/dialogue/topics/**` carry one and NOTHING read it, so
    // the province's entire keyword graph — 181 distinct targets — was a diagram. It is
    // returned here and fired by `Engine.conversationSay()`; see the header of
    // `game/src/sim/quest/topic-supply.js` for why that is the whole of the main quest's
    // bootstrap.
    to: Array.isArray(best.to) ? best.to.slice() : [],
    // Morrowind RESULT script, kept declarative in JSON. Engine.conversationSay() is the
    // world-side consumer: it writes the journal/flag and learns addTopic entries.
    res: best.res && typeof best.res === 'object' ? structuredClone(best.res) : null,
  };
}

/**
 * The topics this person will discuss with THIS player: the subjects their own record
 * advertises, in the order the record lists them, and then the ROOT topics the player has been
 * given and this person can answer.
 *
 * WHY THE SECOND HALF EXISTS. RI-DLG01 §A — *"the player begins with exactly nine topics,
 * granted at character creation"* — and until now the player began with none and no speaker
 * advertised them. Measured over all 336 NPC records carrying a `topics` array: `duties`,
 * `specific-place`, `someone-in-particular`, `services`, `my-trade`, `latest-rumors` and
 * `little-secret` were listed by ZERO people, while 79 speakers could have answered each of
 * them. The nine words that ARE the verb "ask" were unreachable, which is why the opening could
 * not teach it: `jeeh-ei` and `warden-scribe-tuleeh-ma` returned nine nulls apiece.
 *
 * Two gates, and both matter:
 *
 *   1. `player.topics_known` — a root is offered only once the player HOLDS the word. It is
 *      granted by `Engine._censusFinish()` when the writ is stamped, which is what "granted at
 *      character creation" means. A caller that supplies no `topics_known` (every bare unit
 *      test, and the world before the census) gets exactly the behaviour it had before this
 *      existed: the person's own subjects and nothing else. Fail-closed, and closed is the
 *      pre-existing answer rather than a new refusal.
 *   2. `infoFor` — the person must actually have something to say. A root the speaker cannot
 *      answer is not listed, because a topic list that offers a word and then produces silence
 *      is the "advertised a subject and had nothing to say on it" defect this file has already
 *      been through once.
 *
 * The person's own subjects come first. Specific before general is the order the scene reads in
 * and the order Morrowind's own list resolves to.
 */
export function topicsFor(topicIndex, npc, player, canon = null) {
  const out = [];
  const seen = new Set();
  for (const id of (npc.topics || [])) {
    const info = infoFor(topicIndex, id, npc, player, canon);
    if (info) { out.push({ id, text: topicLabel(id), gated: info.gated }); seen.add(topicKey(id)); }
  }
  const known = player && player.topics_known;
  if (known && known.length && Array.isArray(topicIndex.roots)) {
    const heldKeys = new Set(known.map(topicKey));
    for (const r of topicIndex.roots) {
      if (seen.has(r.key) || !heldKeys.has(r.key)) continue;
      const info = infoFor(topicIndex, r.id, npc, player, canon);
      if (!info) continue;
      out.push({ id: r.id, text: topicLabel(r.id), gated: info.gated, root: true });
      seen.add(r.key);
    }
  }
  return out;
}

/**
 * The nine words a character is given when the Warden-Scribe stamps their writ. Read off the
 * index rather than hardcoded, so `topics/00-roots.json` stays the one place the roster is
 * declared and a tenth root becomes a data change.
 */
export function rootTopicIds(topicIndex) {
  return Array.isArray(topicIndex && topicIndex.roots) ? topicIndex.roots.map((r) => r.id) : [];
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
      // W1-05 — the roads out of this town. Not about a subject either, and not gated on the
      // journal: a player who has been sent nowhere still has to be able to reach Gideon, and
      // under seam S35 the map shows only ground already walked, so it cannot tell them. Pushed
      // as its own topic and spoken VERBATIM out of `dialogue/road-directions.json`, for the same
      // reason `q.directions` is — a direction composed from route metadata is a route
      // description, and nobody talks like one.
      if (typeof this.supply.roadsFor === 'function') {
        for (const d of this.supply.roadsFor(npc) || []) {
          this.extra.push({ id: d.id, text: d.id, gated: false, kind: 'road-directions', x: d.text, route: d.route, truth: d.truth });
        }
      }
      const r = this.supply.rumourFor(npc, this.player, nth || 0);
      if (r) this.extra.push({ id: r.id, text: r.id, gated: !!(r.requires || r.forbids), kind: 'rumour', x: r.x, to: r.adds_topics || [] });
    }
    // W1-SPEAKERS. The extras are pushed as list entries, and one of them — the settlement
    // rumour — now names the SAME keyword as a root topic. Until this round it did not: the
    // supply spelt it `latest rumours` and the root is `latest-rumors`, two keys that
    // `topicKey()` deliberately never folds, so a speaker with a rumour listed the same subject
    // TWICE under two spellings and the root's own info was unreachable. Folding the spelling
    // makes the duplicate visible instead of merely wasteful, so it is removed here.
    //
    // The extra REPLACES the root entry rather than being dropped, because `say()` resolves
    // extras first: what the town is actually saying beats the province-wide "ask at the inn",
    // and a list that offered the word but resolved to the generic would be the worse half of
    // both. A speaker with no rumour keeps the root entry and answers it out of the topic file.
    const listKeys = new Map();
    this.list.forEach((t, i) => listKeys.set(topicKey(t.id), i));
    for (const e of this.extra) {
      const k = topicKey(e.id);
      const at = listKeys.get(k);
      const row = { id: e.id, text: e.text, gated: e.gated };
      if (at === undefined) { listKeys.set(k, this.list.length); this.list.push(row); }
      else this.list[at] = { ...this.list[at], ...row };
    }
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

  /**
   * The canon register (`game/src/world/canon.js`), installed by `Engine._installCanon()`.
   *
   * Absent in a bare unit test, in which case every info is offered to everyone exactly as it
   * was before this round — the register can only ever REMOVE a line from a speaker who does
   * not hold its position, never invent one.
   */
  setCanon(reg) { this.canon = reg || null; return this; }

  say(topicId, player) {
    if (!this.open || !this.npc) return null;
    // The way there, and what the town is saying. Both return their text VERBATIM out of the
    // model that owns it — `q.directions` and a rumour row — because a line composed from
    // quest metadata is `RI-DLG05`'s "How we lose" and the rule does not stop at the journal.
    const ex = (this.extra || []).find((e) => topicKey(e.id) === topicKey(topicId));
    if (ex) {
      // `route` identifies WHICH row of `road-directions.json` was spoken, so a probe can look the
      // answer up and check it. Its `truth` field is deliberately NOT carried here: whether a
      // direction is a lie is something the world tells you by contradicting it, never something
      // the conversation state hands over.
      this.said = { topic: ex.id, actor: this.npc.actor || null, text: ex.x, gated: ex.gated, source: ex.kind, to: ex.to || [], quest: ex.quest || null, route: ex.route || null };
      return this.said;
    }
    // The conversation's own filter context wins: it carries the derived disposition and the
    // knowledge set, which the caller does not have. A caller-supplied view is merged over it
    // so a probe can still perturb race or upbringing mid-conversation and watch the list move.
    const view = player ? { ...this.player, ...player } : this.player;
    const info = infoFor(this.topics, topicId, this.npc, view, this.canon || null);
    if (info) {
      // RI-LOR06's texture is only worth anything if it reaches a player, so record that a side
      // was actually argued out loud. `getCanonState()` reports how many disputes this
      // playthrough has heard from more than one side, which is the number that says whether the
      // province argued with itself in front of anybody.
      if (this.canon && info.cf && info.pos) this.canon.noteHeard(info.cf, info.pos);
      this.said = info;
      return info;
    }
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
      // WHICH SETTLEMENT'S ANSWER THIS WAS, or null for one that is true anywhere. `infoFor()`
      // has returned `cell` since the gate was turned on, and nothing could see it: a probe
      // asking "did this person give me GIDEON's line?" had to match on the prose, which passes
      // whenever any line happens to contain the town's name and cannot tell a cell-gated answer
      // from an actor row that merely mentions the place. That is not a hypothetical — this
      // round's own harness scored `services` as a town answer on exactly that test, and the
      // check that moved the speaker to another town then failed, because the line it was
      // watching was a merchant's actor row with no `cell` on it at all and was RIGHT to follow
      // them. Mirrors `greeting_cell`, which has always been reported for the same reason.
      said_cell: this.said ? (this.said.cell || null) : null,
      // W1-05. `say()` has carried `source` and `route` on `this.said` since road-directions
      // landed, with a comment saying they exist "so a probe can look the answer up and check
      // it" — and `state()` never emitted either, so no probe ever could. `conversationSay()`
      // returns THIS object, not `said`, so anything not listed here is invisible to every
      // caller outside the class. That is how a probe came to report zero road directions spoken
      // by people who were in fact offering two each: it was reading a field that does not exist
      // on the surface it was handed. `said_route` names the row of `dialogue/road-directions.json`
      // the words came out of. `truth` is still deliberately NOT carried — whether a direction is
      // a lie is something the world tells you by contradicting it.
      said_source: this.said ? (this.said.source || null) : null,
      said_route: this.said ? (this.said.route || null) : null,
      // W1-17 round 2. WHICH FILE's own record this answer came from (`converse.js infoFor()`'s
      // `from`, see its header). The same lesson as `said_cell` one round earlier: a probe that
      // can see only the text cannot tell "this file's authored answer" from "a same-id record
      // merged in from a different file", and that blind spot is exactly how the round-1 hard
      // fail (`the-steward-of-the-count` shadowed by a stub in `50-mainline.json`) shipped past
      // its own probe, which asked only whether `said` was non-empty.
      said_from: this.said ? (this.said.from || null) : null,
      // `root` is carried through because a reader has to be able to tell the nine words the
      // character was GIVEN from the subjects this particular person advertises — they are
      // offered by different rules and a probe that cannot separate them cannot measure either.
      topics: this.list.map((t) => ({ id: t.id, text: t.text, gated: t.gated, root: !!t.root })),
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
