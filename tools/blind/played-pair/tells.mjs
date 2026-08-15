// tells.mjs — the ONE list of strings that would tell a judge which arm it is playing.
//
// Shared deliberately by the builder (which redacts them) and by the leak-check (which hunts
// them). `HAZARDS` §0's fifth failure shape is a suite whose arms all fabricate the disputed
// input identically; the mirror of it is a redactor and a detector that disagree about what a
// leak IS, so that the detector is scoring the redactor's own definition. One list, two
// consumers, and the self-test in `leakcheck-arms.mjs` runs the detector against a pack the
// builder was told NOT to redact — so the detector is exercised on real un-redacted bytes rather
// than on a synthetic string.
'use strict';

/**
 * Case-insensitive. Each entry is a plain substring, not a regex, so the list reads as evidence.
 *
 * Two families, and both are leaks for different reasons:
 *
 *   * ARM tells — words that say which of the two arms this is. `ablated`, `null control`,
 *     `links_enabled`, `dialogueArm`. A judge who reads one of these in a served file knows.
 *   * ITEM tells — words that name the reference item or the gate. `RI-UIX08`, `§G`, `human
 *     gate`. These do not name the arm directly, and they are still fatal: ARBITRATION S51 voids
 *     a pack whose counterpart is derivable from the item's own tables, and RI-UIX08 §G prints
 *     the ablation recipe in full. A judge who learns the item id can read the recipe and derive
 *     the arm in one step, which is exactly the disconnected-script test failing.
 */
export const TELLS = [
  // --- arm tells -------------------------------------------------------------------------
  'ablat',            // ablate / ablated / ablation
  'null control',
  'plausible control',
  'links_enabled',
  'dialoguearm',
  'links removed',
  'the mechanism',
  'topic_link',
  'delete-the-fix',
  'deletethefix',
  'control arm',
  'blind pair',
  'blind_pair',
  // --- item tells ------------------------------------------------------------------------
  'uix08',
  'ri-uix',
  'human gate',
  'the gate',
  'gate g',
  '§g',
  'reference item',
  'ref-a12',
  'openmw',
  'morrowind',
  'reply menu',
  'judge',
  'critic',
  'verdict',
  'corpus/',
  'arbitration',
];

/** True when `s` carries any tell. */
export function hasTell(s) {
  const t = String(s).toLowerCase();
  return TELLS.some((w) => t.includes(w));
}

/** Every tell present in `s`, for reporting — a detector that only says "yes" teaches nothing. */
export function tellsIn(s) {
  const t = String(s).toLowerCase();
  return TELLS.filter((w) => t.includes(w));
}
