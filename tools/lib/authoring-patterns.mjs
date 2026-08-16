// authoring-patterns.mjs — the ONE list of shapes that mean "this text is addressed to the
// writer, not to a character".
//
// WHY IT IS A SHARED FILE. Round 3 added a second scanner (`check-composed-greetings.mjs`,
// which reads what an NPC says in the running engine rather than what a table contains). Two
// scanners with two copies of the pattern list is how a pattern gets fixed in one and not the
// other, and the gap then sits exactly where nobody is looking — which is the shape of every
// defect this piece has found so far. One list, imported by both.
//
// IT MUST NOT WRITE AND MUST NOT IMPORT ANYTHING THAT WRITES (`HAZARDS` §31 rule 1). It imports
// nothing at all.
//
// SCOPE, STATED HONESTLY AND IT IS THE POINT OF ROUND 3. These patterns match META-INSTRUCTION
// SHAPES — sentences whose grammar is a brief. **They did not and could not match
// `Local. Useful.`**, the two words the blind judge flagged and that shipped for two rounds
// after the "fix". Two bare adjectives are not a recognisable instruction in isolation; they
// read as one only in the composed line, spoken by that faction, to that race. A pattern list
// is therefore a floor, never the gate — the gate for that class of defect is
// `check-greeting-voice.mjs`'s per-half exclusivity predicate and a blind judge reading the
// composed line. Do not read a green scan here as "no authoring instruction shipped".
'use strict';

/** Each entry is `[regex, why]`. Kept deliberately narrow: the book corpus legitimately
 * contains ordinary imperatives, and a scanner that flags "Leave the grove" is a scanner
 * nobody will keep running. */
export const PATTERNS = [
  // Narrowly the leaked imperative, not the bare phrase "in one line" — that phrase also
  // occurs legitimately in-fiction (a clerk asked to summarise a document "in one line" is a
  // character being characterised, not a leak); see `the-short-measures.json` books[6].
  [/\bsay it in one line\b/i, 'authoring brief about line length'],
  [/\bkeep it (short|brief|tight|concise)\b/i, 'authoring brief about brevity'],
  [/\bwrite (a|the|your) line\b/i, 'instruction to a writer'],
  [/\bthis (line|dialogue) should\b/i, 'meta-commentary about the line itself'],
  [/\bplaceholder\b/i, 'placeholder text'],
  [/\btodo\b/i, 'todo marker'],
  [/\bfixme\b/i, 'fixme marker'],
  [/\blorem ipsum\b/i, 'filler text'],
  [/\[insert\b/i, 'template bracket'],
  [/<insert\b/i, 'template bracket'],
  [/\bTBD\b/, 'todo marker'],
  [/\bnote to (the )?writer\b/i, 'note to writer'],
  [/\bwriter'?s? note\b/i, 'note to writer'],
  [/\bstay in character\b/i, 'instruction to a writer'],
  [/\bas an ai\b/i, 'model self-reference'],
  [/\bas the writer\b/i, 'instruction to a writer'],
  [/\bcharacter limit\b/i, 'authoring brief about length'],
  [/\bword limit\b/i, 'authoring brief about length'],
  [/\bword count\b/i, 'authoring brief about length'],
];

/** The first `why` whose pattern matches, or null. */
export function matchAny(text) {
  for (const [re, why] of PATTERNS) if (re.test(text)) return why;
  return null;
}

/** The exact string the blind judge flagged, kept as the permanent predicate self-test. */
export const KNOWN_LEAK = 'Say it in one line. Local. Useful.';

/** The half of it that survived two rounds of "fixes". `matchAny` does NOT match this, by
 * design and by demonstration — round 3's control arm `I` shows the leak check staying green
 * on it while the voice check goes red. Exported so a scanner can say so out loud instead of
 * implying its green covers this. */
export const KNOWN_UNMATCHABLE_HALF = 'Local. Useful.';
