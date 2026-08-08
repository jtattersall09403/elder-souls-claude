// One topic namespace, two authored spellings.
//
// WHY THIS FILE EXISTS.
// A topic keyword is written two ways in this tree and both are load-bearing:
//
//   * the dialogue layer writes SLUGS   — `game/data/dialogue/topics/*.json` ids
//                                         (313 of them, all dashed), and
//                                         `game/data/quests/hooks.json` entry_topics
//                                         (the AddTopic edges, all dashed);
//   * the quest layer writes PROSE      — every `opens_by.topic` in
//                                         `game/data/quests/**` (76 of them, all spaced),
//                                         and the `topics` array on every main-quest NPC
//                                         record in `game/data/npcs/**`.
//
// Nothing folded the two, so the two never met. Measured on the tree before this file
// existed: **74 of the 76 `opens_by.topic` values could not be satisfied by any AddTopic
// edge the machine can fire**, and 63 of those were pure slug-versus-prose spellings of
// the same keyword — `the-steward-of-the-count` pushed into `topicsKnown` by
// `hooks.json`, `"the steward of the count"` demanded by `gate.js`. Separately, **47
// distinct topic ids sat in NPC `topics` arrays with no info anywhere**, because
// `converse.js` looked the prose form up in an index keyed by slugs: the person
// advertised a subject and had nothing to say on it.
//
// Both failures were invisible from every tool, because every quest tool seeds the topic
// gate with the quest's own `opens_by.topic` string (`tools/quests/mainline-trace.mjs`,
// `tools/harness/mag-quest.mjs`, `harness/api.js seedTopic`). Seeding the exact string the
// gate is about to ask for passes whatever the AddTopic edges say, so the mainline traced
// green while no quest in the build could be opened by playing it.
//
// The fix is one rule in one place rather than a rename across two schemas: fold a topic
// key before comparing it, and keep the authored spelling everywhere it is shown or
// stored, so a save file and a journal still read in the words the author chose.
'use strict';

/**
 * The comparison key for a topic keyword.
 *
 * Case is folded, `-` and `_` become spaces, punctuation that only ever appears as
 * typography is dropped (curly and straight apostrophes are the same apostrophe), and runs
 * of whitespace collapse. Everything else is left alone: this is a spelling rule, not a
 * slugifier, and it must never merge two keywords an author meant to keep apart.
 *
 *   topicKey('the-steward-of-the-count')     === 'the steward of the count'
 *   topicKey("the cutters' terms")           === topicKey('the-cutters-terms')
 *   topicKey('the ninth clause of the Drowned Tally')
 *                                            === topicKey('the-ninth-clause-of-the-drowned-tally')
 */
export function topicKey(id) {
  return String(id == null ? '' : id)
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two authored spellings name the same topic. */
export function sameTopic(a, b) { return topicKey(a) === topicKey(b); }

/**
 * Membership test against a collection of authored topic strings — a Set, an array, or
 * anything iterable. Folds both sides, so it does not matter which spelling the collection
 * happens to hold.
 */
export function topicsInclude(known, id) {
  if (!known) return false;
  const want = topicKey(id);
  const it = typeof known.values === 'function' ? known.values() : known;
  for (const k of it) if (topicKey(k) === want) return true;
  return false;
}
