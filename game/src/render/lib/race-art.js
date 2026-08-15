// race-art.js — which body plan a race string gets, in ONE place.
//
// WHY THIS FILE EXISTS. `renderer.js` used to decide it inline:
//
//     (n.race === 'saxhleel' || n.race === 'naga') ? 'saxhleel' : 'humanoid'
//
// Measured over `game/data/npcs/*.json` (18 files, 408 records) on 2026-08-15:
//
//     argonian 181 · saxhleel 77 · imperial 59 · dunmer 57 · nord 12 · breton 10
//     khajiit 6 · naga 2 · none 1 · mixed 1 · redguard 1 · orsimer 1
//
// So `argonian` — **181 records, 44.4% of the roster, and the people whose province this is** —
// fell through that test onto `base.humanoid`, a body plan with no snout, no crest, no tail and
// (before this round) no eye geometry at all. 329 of 408 NPCs landed there. That is the mechanical
// cause of `W1-F10-CHARACTERS`'s C2: 41 shipped figures collapsing to 12 silhouettes, with a Breton
// and an Argonian at IoU 1.0000.
//
// THE RULING ON THE DATA DEFECT, and it is deliberately not "rewrite 181 records".
// `races.json` declares ten races and knows only `saxhleel`. The NPC data uses `argonian` 181× and
// `saxhleel` 77×. Both strings are correct: **Saxhleel is the endonym, Argonian is the Cyrodilic
// exonym, and they name one people.** A Black Marsh corpus in which Imperial clerks say "Argonian"
// and Hist-kin say "Saxhleel" is lore doing its job, not a typo — so normalising the content away
// would delete something true to make a renderer predicate simpler.
//
// What is actually wrong is that the renderer treated a *name* as a *body plan*. So the fix is
// here: one total map from every race string the shipped data uses onto an art family, with the
// synonymy stated once. `races.json` is left alone on purpose — its own `invariant` is
// `sum(attribute_deltas) == 12` per race record and four checkers read `races.map(r => r.id)`, so
// adding an alias row there would break a progression invariant to solve a rendering problem.
//
// REVERSIBLE, and here is what would overturn it: if a later piece needs `argonian` and `saxhleel`
// to differ in *reaction* or *standing* rather than only in body plan, then they are two ids and
// the content should be normalised to one of them with the other kept as a display name. Nothing
// in `disposition.js` or `race-reactions.json` distinguishes them today.
//
// FAIL-CLOSED BELONGS IN A CHECK, NOT IN A CONSTRUCTOR (`RULES.md` 13/14). An unmapped race must
// not throw inside the renderer and take out every agent's boot; it renders as `humanoid` and is
// reported by `tools/check-race-art.mjs`, which walks the shipped NPC data and exits non-zero.
'use strict';

/**
 * Every race string present in `game/data/npcs/*.json` plus every id in `races.json`, mapped to
 * the art family that draws it. Keys are lower-case; callers are normalised below.
 */
export const RACE_ART = Object.freeze({
  // --- Saxhleel (Argonian). One people, three strings in the shipped content. ----------------
  saxhleel: 'saxhleel',
  argonian: 'saxhleel',   // Cyrodilic exonym for Saxhleel — 181 records
  naga: 'saxhleel',       // a Saxhleel form, not a separate body plan — 2 records
  // --- Human and mer. `base.humanoid`. -------------------------------------------------------
  imperial: 'humanoid',
  dunmer: 'humanoid',
  nord: 'humanoid',
  breton: 'humanoid',
  redguard: 'humanoid',
  orsimer: 'humanoid',
  altmer: 'humanoid',
  bosmer: 'humanoid',
  // KNOWN GAP, stated rather than hidden: Khajiit are a beast race and this build has no feline
  // body plan. Six records draw as `humanoid`. That is wrong and it is cheap to see; it is not
  // wrong in the way `argonian` was, because six figures do not carry a province.
  khajiit: 'humanoid',
  // --- Records that name no race. ------------------------------------------------------------
  none: 'humanoid',       // 1 record
  mixed: 'humanoid',      // 1 record — a crowd entry, not a person
});

/** Race strings this build knows how to draw. */
export function knownRaceStrings() { return Object.keys(RACE_ART).sort(); }

/**
 * The art family for a race string. Unknown strings return `humanoid` and are reported by
 * `tools/check-race-art.mjs` rather than throwing — see the header.
 */
export function artFamilyForRace(race) {
  if (!race) return 'humanoid';
  return RACE_ART[String(race).toLowerCase()] || 'humanoid';
}

/** True when the string is declared above; the check tool's predicate, exported so it cannot drift. */
export function isDeclaredRace(race) {
  return !!race && Object.prototype.hasOwnProperty.call(RACE_ART, String(race).toLowerCase());
}
