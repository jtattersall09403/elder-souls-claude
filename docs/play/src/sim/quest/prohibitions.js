// RI-DLG05 §D, as executable code. "Violation of 1-5 is binary and automatic: one hit fails
// the item." The item's own step-3 grep is reproduced here rule for rule, so that the check
// that fails a critic run is the same check that stops the game booting.
//
// Imported by:
//   game/src/sim/quest/defs.js   — at boot, over every journal entry and every `directions`
//   game/src/sim/quest/journal.js — at write time, over the composed entry text
//   tools/corpus/dump-journal.mjs, tools/analysis/quest-audit.mjs — offline, over the dump
//
// A note on what is NOT banned, because over-correcting is its own failure (RI-DLG05 "How we
// lose": "Unnavigable poetry ... exactly as bad as a coordinate"): a single compass word used
// the way a person uses one — "east of the ford", "the north gate" — is how Morrowind's own
// journal gives directions and is explicitly present in the §B exemplars. What is banned is a
// *bearing*: a compound compass direction, a degree sign, or a measured distance. Those are a
// marker in a costume.
'use strict';

export const BANNED = [
  {
    rule: 'D1-coordinate',
    // (1024, -3200) and friends, plus grid/cell refs.
    re: /\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|\bcell\s+-?\d+\s*,\s*-?\d+\b|\bgrid[- ]?ref\b/gi,
  },
  {
    rule: 'D2-ui-or-marker',
    re: /\b(marked on|on your map|your map|quest ?log|objective|waypoint|way ?point|marker|the compass|fast[- ]travel|quest tracker|tracked quest|mini[- ]?map|hud)\b|\bpress [A-Z]\b|\bselect the\b/gi,
  },
  {
    rule: 'D3-bearing-or-distance',
    re: /\b(?:north|south|east|west)[- ](?:north|south|east|west)\b|\b\d+(?:\.\d+)?\s?(?:m|km|metres|meters|yards|yds|feet|ft|paces|units)\b|\b\d+\s?°|\bdegrees (?:north|south|east|west)\b/gi,
  },
  {
    rule: 'D4-second-person-imperative',
    // The character writes about themselves. An entry that addresses the player is a tracker.
    re: /(^|[.!?]\s+)(Go|Head|Travel|Return|Kill|Find|Talk|Speak|Bring|Take|Deliver|Collect|Retrieve|Proceed|Report)\s+(to|and|the|back|for|with)\b/g,
  },
  {
    rule: 'D5-game-system-vocabulary',
    re: /\b(XP|experience points|levell?ed up|level up|loot|spawn(?:ed|s|ing)?|boss|hitpoints|hit points|HP\b|DPS|buff|debuff|stage \d|objective complete|quest (?:added|updated|complete)|side[- ]quest)\b/gi,
  },
  {
    rule: 'D5b-souls-leakage',
    // AR-2, and the item calls it "doubly banned".
    re: /\b(bonfire|estus|souls?[- ]currency|checkpoint|respawn(?:ed|s)?|new game plus|ng\+)\b/gi,
  },
];

/**
 * @param {string} text
 * @returns {{rule:string, match:string, index:number}[]} every hit, in order. Empty = clean.
 */
export function scanProse(text) {
  const s = String(text == null ? '' : text);
  const out = [];
  for (const b of BANNED) {
    b.re.lastIndex = 0;
    let m;
    while ((m = b.re.exec(s)) !== null) {
      out.push({ rule: b.rule, match: m[0], index: m.index });
      if (m[0].length === 0) b.re.lastIndex++;
    }
  }
  return out.sort((a, b2) => a.index - b2.index);
}

/** Convenience: true when the prose is clean. */
export function isClean(text) { return scanProse(text).length === 0; }
