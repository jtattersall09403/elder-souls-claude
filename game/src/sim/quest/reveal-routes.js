// reveal-routes.js — THE READER FOR `deceit.revealed_by[].channel` AND `.source`.
//
// W1-18 round 2. This file exists because 186 authored rows of `deceit.revealed_by` had no
// reader in `game/src/` at all. The quest files say, for every truth a resolution demands you
// know, exactly HOW a player comes to know it — which channel, and which person, book, document
// or place is the source — and nothing in the running game had ever read either field. The one
// exception was `channel: 'book'`, which `Engine._bookKnowledgeIndex()` picked up in W1-LIBRARY
// round 2 by matching on `source`, and it is the shape this file generalises.
//
// The consequence, measured by `tools/quests/reveal-route-audit.mjs` before this landed: of the
// 121 `(quest, reveal)` pairs some resolution names in `requires_knowing`, **113 had no route in
// play**. `QuestEngine.reveal()` was reachable only from `window.__HARNESS.questReveal`, so
// every non-violent exit those quests declare was open to a probe and shut to a player.
//
// ---------------------------------------------------------------------------------------------
// WHICH CHANNELS THIS FILE ROUTES, AND WHY NOT THE OTHERS
//
// A channel is routable when TWO things are true: the world has an action a player performs that
// plausibly IS that channel, and the `source` field names something that exists in this build.
// The nine channels split cleanly on the second test, and the split is not close:
//
//   channel          demanded  source resolves to a real thing?      routed here
//   talk_to_target   28        18/28 are rows in game/data/npcs/**   YES  (person)
//   rival_npc        23        22/23 are rows in game/data/npcs/**   YES  (person)
//   eavesdrop         9         7/9  are rows in game/data/npcs/**   no — see below
//   corpse            1         1/1  is a row in game/data/npcs/**   no — see below
//   ledger           28         1/28 name any object in game/data    no — the object is missing
//   letter            6         0/6  name any object in game/data    no — the object is missing
//   environment      18         0/18 name any object or place        no — the source is prose
//   book              5        routed since W1-LIBRARY r2            (elsewhere)
//   later_quest       3        routed since W1-19 r3                 (elsewhere)
//
// `eavesdrop` is NOT routed through this file even though its sources are real people, and the
// reason is that the only conversation action the build has is `Engine.talkTo()`, which is
// walking up to somebody and being greeted. That is the opposite of eavesdropping. Routing it
// here would mean a player who introduces themselves gets credit for having listened unobserved,
// which is a lie about what they did, and it would quietly make the stealth system decorative
// for the one thing it is most obviously for. It needs a proximity-and-not-noticed reader built
// against `sim/stealth`, and that is a real piece of work, not a line here.
//
// `corpse` is not routed for the same kind of reason: `discoverCorpse()` is the CRIME system's
// event for a witness finding a body, not the player examining one, and there is no search-a-
// body action in `game/src/` to hang it on. One row.
//
// `ledger`, `letter` and `environment` are 52 of the 113 and they are blocked on CONTENT, not on
// a reader. `item_the_drowned_tally` is not an object anywhere in this build; neither are the
// other 33 ledgers, the 6 letters, or `loc_the_flooding_road`. Nine `environment` sources are not
// ids at all, they are sentences — "the cough on the lichen beds". Wiring a reader to those would
// produce a table of routes to nothing, which is the exact failure this round exists to stop.
//
// ---------------------------------------------------------------------------------------------
// WHAT `person` COSTS THE PLAYER
//
// The route is: the quest is OPEN, and you found the named person in the world and spoke to
// them. Both halves are real gates and neither is free.
//
//   * OPEN means a giver offered it and `canOffer` let it through — topic known, disposition
//     cleared, reputation, attributes, skills, world state, and the giver standing somewhere a
//     player can reach. A person does not spill the middle of a quest you have not accepted.
//   * `Engine.talkTo()` throws unless `sim.findNPC()` returns somebody. The presence term
//     (`QuestEngine.presenceMode`) exists because most of this cast is not in the world yet, and
//     this route inherits that honestly: a reveal whose source is nowhere stays unlearnable, and
//     the audit reports it as such rather than counting it green.
//
// This is the same doctrine as `Engine.talkTo()`'s existing `opens_by.overheard_from` block —
// *"you do not have to know the words to walk up to a carter; walking up is how you learn them"* —
// and it is what `quest.schema.json` says the model is for: `requires_knowing` is
// *"the mechanism by which talking to the target before killing them opens a door"*.
//
// ---------------------------------------------------------------------------------------------
// THE JOURNAL HALF
//
// `QuestEngine.note()` — the verb that writes the MIDDLE of a journal — had exactly one caller in
// `game/src/`, the `hooks.json` journal branch, covering 11 of 120 quests. So for 109 quests the
// journal could be opened and closed and never written in between, by anything a player does.
//
// A reveal row may therefore carry an optional `journal` index: the entry that is the player
// writing that truth down. It is OPTIONAL and it is authored, never inferred — several truths
// are only ever recorded in a terminal entry (Q-MAIN-26's `rev_he_never_wrote_the_recension` is
// in entry 92, a `success`), and `note()` correctly refuses terminal entries. A row with no
// `journal` reveals and writes nothing, exactly as before.

/**
 * `deceit.revealed_by[].channel` -> the kind of world action that reads it. A channel absent
 * from this table has no reader and is reported as unrouted; see the header for why each.
 */
export const CHANNEL_READERS = {
  talk_to_target: 'person',
  rival_npc: 'person',
  // W1-18 builder: crouched interact uses Engine.eavesdrop(); it refuses once the listener is noticed.
  eavesdrop: 'eavesdrop',
  // A dead named body is examined through Engine.examineCorpse(), never the crime witness verb.
  corpse: 'corpse',
  // W1-READABLES round 2. `environment` says the source of the truth is a thing in the world,
  // and until this round every one of its 27 rows named a place, a station or a mark that was
  // not an object anywhere in the build. `game/data/world/readables/site-marks.json` is the
  // object: a mark with a position, standing in a room or on the ground of the province, spawned
  // through `Engine.spawnProp()` exactly as an inscription is. `Engine._takePropPending()` calls
  // `learnFrom('place', mark.id)` when a player reaches for one.
  //
  // The kind is `place` rather than `mark` because what the quest files name is a PLACE — the
  // shaft under the rib, the sixth intake, the post nobody stands on — and the mark is the thing
  // there that carries the fact. A second mark at the same place would be a second route to the
  // same reveal, which is a property worth keeping.
  environment: 'place',
};

/**
 * THE CHANNELS A DOCUMENT ANSWERS FOR. W1-READABLES.
 *
 * `book` was routed in W1-LIBRARY round 2 by `Engine._bookKnowledgeIndex()`, which matches a
 * `revealed_by` row's `source` against a book's `knowledge_key` and unions the reveal id into
 * `ctx.knowledge` for every book in `sim.quest.booksRead`. `ledger` and `letter` are the same
 * question with a different noun on it: the quest file says *"you learn this by reading a thing
 * somebody wrote"*, and names the thing. So they go through the same reader rather than a second
 * one, and this constant is the whole of the difference.
 *
 * WHAT THE NOUN CHANGES IS THE VERB, and the verb is where a ledger stops being a book. This
 * build has two ways to read: an item with `readable: true` and a `book_id`, read out of your own
 * inventory (`sealed-letter-stormhold` has always been one), and — new here — a prop carrying
 * `readable_book`, `takeable: false`, which opens where it stands and cannot be pocketed. Every
 * document this piece places takes the second, and Q-MAIN-06 is the reason: it ships a failure
 * state, `fail_took_the_books`, whose cause is *"the player removes a volume of the Tally from
 * the archive"*. An archive whose only interaction was `take` would have made that failure the
 * one thing a player could do in it. The same holds for the one `letter` placed here — it is in
 * a rootkeeper's gallery under her eye, and carrying it out of Helstrom is a RESOLUTION of
 * Q-MAIN-10 with a consequence attached, not a thing you do to a prop.
 *
 * `environment` is deliberately NOT here. Its sources are places and marks — `loc_the_flooding_
 * road`, "the cut itself, on the shaded side" — and a place is not a document. Routing it here
 * would mean writing a page for a thing that has no page, which is the failure this piece exists
 * to avoid one layer along. See `W1-READABLES` for the per-source decision on all 27 rows.
 */
export const DOCUMENT_CHANNELS = new Set(['book', 'ledger', 'letter']);

/**
 * Build the index `QuestEngine.learnFrom()` consults: `"<kind>:<source>"` -> the reveal rows that
 * source can produce. Pure over the quest definitions, so a tool can build it with no engine.
 *
 * Rows are returned in JOURNAL ORDER, then quest, then reveal id. Journal order first is not
 * cosmetic: the journal is append-only and monotonic within a quest (`journal.js` THROWS on a
 * backwards write, RI-DLG05 §A.1), and one person can be the source of two reveals of the same
 * quest — Ee-Vashum tells you both `rev_vashum_wrote_it` (entry 46) and `rev_the_daughter`
 * (entry 54) in Q-XULA-03. Sorted by reveal id those land 54 before 46 and the second write
 * throws inside a world action. Sorted by the entry they write, one conversation writes the
 * journal in the order the quest file tells it.
 */
export function buildRevealRoutes(defs) {
  const idx = new Map();
  for (const def of defs || []) {
    for (const rev of ((def.deceit && def.deceit.revealed_by) || [])) {
      const kind = CHANNEL_READERS[rev.channel];
      if (!kind || !rev.source) continue;
      const key = `${kind}:${rev.source}`;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push({
        quest: def.id,
        reveal: rev.id,
        channel: rev.channel,
        source: rev.source,
        // Authored, optional. See the header.
        journal: (rev.journal == null ? null : Number(rev.journal)),
        // The schema's own words: "true if this reveal is reachable while the player can still
        // act on it". Four rows in the tree say false, and what they mean is that this truth
        // arrives too late to change anything — so it is held behind the world flag that marks
        // the crossing rather than handed over early. Absent counts as true, which is how the
        // twelve rows that predate the field behave.
        before_point_of_no_return: rev.before_point_of_no_return !== false,
      });
    }
  }
  const cmp = (a, b) => {
    const aj = a.journal == null ? Infinity : a.journal;
    const bj = b.journal == null ? Infinity : b.journal;
    if (aj !== bj) return aj - bj;
    if (a.quest !== b.quest) return a.quest < b.quest ? -1 : 1;
    return a.reveal < b.reveal ? -1 : a.reveal > b.reveal ? 1 : 0;
  };
  for (const rows of idx.values()) rows.sort(cmp);
  return idx;
}

/** The world flag that marks the crossing. Raised by playing `Q-MAIN-27/res_cross`. */
export const PONR_FLAG = 'point_of_no_return_crossed';
