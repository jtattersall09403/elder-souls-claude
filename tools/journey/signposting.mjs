#!/usr/bin/env node
// signposting.mjs — what P9 was supposed to be testing.
//
// Owner: W1-26 round 4 (builder). Rule 24: the method named an instrument, the instrument
// existed, and it tested a different thing from the one it was named after.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------------------------
// `tools/journey/opening-play.mjs` P9 asserted "no drawn string in the whole run tells the player
// what to do", citing `RI-JRN01` M9 (AR-2) and HF3, whose doctrine is:
//
//     the world does not explain itself, and nothing tells the player where to go.
//
// It tested that with ONE start-anchored regex:
//
//     /^(press|hold|tap|click|use|push|move|walk|go|take|…)\b/i
//
// The W1-26 r3 critic ran that regex against seven lines that all mean *go up the ladder* and
// **six of them passed** — every one that did not happen to begin with an imperative verb. Its
// table is reproduced verbatim in `FIXTURES` below and is this module's self-test. Worse, the one
// sentence the round-2 verdict had already named as the opening's only tutorial —
// `writ.stamp`'s *"So ask them what they do, and what is being said here."* — passed it too,
// unchanged at round 3 and drawn on screen in the critic's own played run.
//
// **A test for the imperative mood catches the least likely form of the defect.** Nobody writing
// dialogue for this game writes "Go up the ladder". They write "The desk is up the ladder", and
// the player is signposted just the same.
//
// ---------------------------------------------------------------------------------------------
// WHAT IT TESTS INSTEAD: TWO CLAUSES, BECAUSE THE DOCTRINE IS TWO CLAIMS
// ---------------------------------------------------------------------------------------------
// The doctrine's sentence has two halves and they fail differently.
//
//   (I) INSTRUCTION — "the world does not explain itself". A string that addresses the player as
//       a user and tells them to perform one of the game's own verbs. This is a REGISTER defect:
//       the writing stops being a person and becomes a manual. Budget: **zero, everywhere.**
//
//   (W) WAYFINDING — "nothing tells the player where to go". A string that hands the player a
//       route or a destination. This is NOT automatically a defect, and pretending it is would
//       cost this piece the best thing in it. The r3 critic played the opening as a person,
//       hesitated in exactly one place — `hold.out`, where the panel closes and nothing says the
//       scene wants you up the companionway — and called that *"the design working, and the
//       place to watch"*. The line that carries it is a sick woman on a bunk remarking on the
//       light above and saying where **she** will be. It is directional, it is in a person's
//       mouth, and cutting it would trade the piece's one good moment for a green tick.
//
//       So the budget for (W) is not zero. It is **declared**: every wayfinding sentence that
//       reaches the frame must be on `DECLARED_WAYFINDING` below, WITH A WRITTEN REASON, and
//       must have been drawn on a surface a person speaks through. A new one — or an old one on
//       the HUD, the menus or the title, where no one is speaking — goes red until somebody
//       writes down why it is a person and not the game.
//
// That is the difference the doctrine is actually about: **a person in the world may say where
// she will be; the world may not tell you where to go.** A regex cannot see the difference, and
// this module does not pretend to — it makes the exception a named, reviewable list of eleven
// words instead of a silent hole the width of the English language.
//
// ---------------------------------------------------------------------------------------------
// PROVING IT CAN FAIL (rule 4)
// ---------------------------------------------------------------------------------------------
//   node tools/journey/signposting.mjs --self-test
//
// runs the critic's seven lines, the teaching clause, and a set of NEGATIVES that must stay
// green — including sentences that are imperative but teach nothing and point nowhere ("Do not
// lose it."), which is how this module avoids becoming a blanket ban on the imperative mood.
// It exits non-zero if any fixture lands on the wrong side.
'use strict';

// ---------------------------------------------------------------------------------------------
// (I) instruction
// ---------------------------------------------------------------------------------------------

/**
 * The verbs by which the game's OWN actions are performed. Deliberately the round-3 list
 * unchanged, plus `ask` — the one verb the measured defect used, and the opening's central verb.
 *
 * The vocabulary was never the bug. The `^` was.
 */
export const GAME_VERBS = [
  'press', 'hold', 'tap', 'click', 'use', 'push', 'move', 'walk', 'go', 'take', 'open', 'close',
  'talk', 'speak', 'look', 'aim', 'pick', 'select', 'choose', 'enter', 'swipe', 'drag', 'attack',
  'block', 'dodge', 'roll', 'equip', 'find', 'head', 'return', 'follow', 'try', 'ask',
];

/** Second-person directives that carry no imperative verb at all. */
export const DIRECTIVES = [
  /\byou (?:must|should|need to|will want to|want to|had better|ought to)\b/i,
  /\bif I were you\b/i,
  /\bwhat you (?:do|want) is\b/i,
  /\b(?:press|tap|hold|click|push) +[a-z0-9]+ +to\b/i,
];

/** The vocabulary of a manual rather than of a person. */
export const SYSTEM_NOUNS = /\b(tutorial|controls?:|hint|objective|quest added|new quest|tip:|this is your)\b/i;

/**
 * Split a string into the clauses an imperative can begin. A clause begins at the start of the
 * string, after sentence punctuation, after an em dash, and after a comma followed by a
 * conjunction — which is exactly where `. So ask them what they do` hid from the `^` anchor.
 */
export function clausesOf(s) {
  const out = [];
  const str = String(s);
  let i = 0;
  const re = /(?:[.;:!?]+|—|,\s+(?:so|then|and|but|or)\b)\s*/gi;
  let m;
  while ((m = re.exec(str)) !== null) {
    const end = m.index;
    if (end > i) out.push({ at: i, text: str.slice(i, end).trim() });
    i = re.lastIndex;
  }
  if (i < str.length) out.push({ at: i, text: str.slice(i).trim() });
  return out.filter((c) => c.text.length > 0);
}

const VERB_AT_CLAUSE_START = new RegExp(
  `^(?:so|then|now|just|please|first|next)?\\s*(${GAME_VERBS.join('|')})\\b`, 'i');

/**
 * Does this string instruct the player? Returns the hits, each naming what fired.
 */
export function instructionHits(s) {
  const hits = [];
  for (const c of clausesOf(s)) {
    const m = VERB_AT_CLAUSE_START.exec(c.text);
    // "So ask them…" is a clause start; the leading conjunction is skipped, which is the whole
    // point — the round-3 anchor could only see a verb in character 0 of the whole string.
    if (m) hits.push({ kind: 'imperative', verb: m[1].toLowerCase(), clause: c.text });
  }
  for (const re of DIRECTIVES) {
    const m = re.exec(s);
    if (m) hits.push({ kind: 'directive', matched: m[0], pattern: String(re) });
  }
  const sn = SYSTEM_NOUNS.exec(s);
  if (sn) hits.push({ kind: 'system_noun', matched: sn[0] });
  return hits;
}

// ---------------------------------------------------------------------------------------------
// (W) wayfinding
// ---------------------------------------------------------------------------------------------

/** The nouns a route in this game is made of. */
const WAY_NOUN = '(?:ladder|ladders|stairs|stair|steps|companionway|gangway|hatch|door|doorway|'
  + 'ramp|passage|corridor|bridge|gate|deck|way|path|road|track|tunnel|archway)';
const DIRECTION = '(?:up|down|out|back|in|through|past|behind|ahead|over|across|left|right|'
  + 'north|south|east|west|inside|outside|forward|onward)';

/**
 * Every way this build's writing can hand a player a route. Each is a whole reason on its own,
 * and each is named in the output so a reader can see WHICH construction fired rather than being
 * told a regex matched.
 */
export const WAYFINDING_PATTERNS = [
  { id: 'motion_verb_plus_direction', why: 'a verb of travel with a direction on it', re: new RegExp(`\\b(?:go|goes|going|went|head|heading|climb|climbing|walk|walking|get|getting|come|coming|take yourself)\\s+${DIRECTION}\\b`, 'i') },
  { id: 'direction_plus_way_noun', why: 'a direction attached to a thing you travel along', re: new RegExp(`\\b${DIRECTION}\\s+(?:the|that|this)\\s+${WAY_NOUN}\\b`, 'i') },
  { id: 'the_way_out', why: 'the route named as a route', re: new RegExp(`\\bthe\\s+${WAY_NOUN}\\s+(?:out|up|down|in|back|to|is|lies)\\b`, 'i') },
  { id: 'destination_is_direction', why: 'a place located for the player by direction', re: new RegExp(`\\b(?:is|are|lies|lie|sits|stands|will be)\\s+${DIRECTION}\\b`, 'i') },
  { id: 'deictic_place', why: 'a place pointed at — "up there", "down below"', re: new RegExp(`\\b${DIRECTION}\\s+(?:there|here|below|above|yonder)\\b`, 'i') },
  { id: 'that_is_where', why: 'a destination named as the destination', re: /\b(?:that|this|there)\s+is\s+where\b/i },
  { id: 'the_one_you_want', why: 'a thing singled out as the one to go to', re: /\b(?:is|are)\s+the\s+(?:one|ones)\s+you\s+want\b/i },
  { id: 'waiting_for_you', why: 'somebody placed somewhere, expecting you', re: /\b(?:waiting|expecting)\s+for\s+you\b/i },
];

/** Sentences, for declaring an exception against something stable. */
export function sentencesOf(s) {
  return String(s).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * Does this string hand the player a route? Returns one hit per SENTENCE that fired, because a
 * sentence is the unit a writer defends and the unit that survives `%PCName` substitution at the
 * front of a long line.
 */
export function wayfindingHits(s) {
  const hits = [];
  for (const sent of sentencesOf(s)) {
    const fired = WAYFINDING_PATTERNS.filter((p) => p.re.test(sent));
    if (fired.length) {
      hits.push({ sentence: sent, patterns: fired.map((p) => p.id), why: fired.map((p) => p.why) });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------------------------
// THE DECLARED LIST — the only wayfinding this build is allowed to draw
// ---------------------------------------------------------------------------------------------
/**
 * Each entry is an EXACT SENTENCE, the node it is authored on, and why it is a person speaking
 * rather than the world explaining itself. Anything not on this list fails P9.
 *
 * This list is short on purpose and it is meant to be argued with. It is not an ignore-list for
 * the check; it is the check's content, and adding a line to it is a writing decision that a
 * critic can read in one screen.
 */
export const DECLARED_WAYFINDING = [
  {
    sentence: 'The light up there is bad, but it is light.',
    node: 'hold.out',
    speaker: 'jeeh-ei',
    why: 'A sick woman on a bunk remarking on the place above her. It is an observation about a '
      + 'light, not a route: it names no ladder, no door and no destination, and it does not '
      + 'address the player at all. The W1-26 r3 verdict §5 reads it in full and would not cut '
      + 'it; the r3 critic hesitated at this node while playing and called the hesitation "the '
      + 'design working". It fires `deictic_place` because "up there" is literally deictic, '
      + 'which is the honest reading — the payload is there, and it is carried the way a person '
      + 'carries it.',
  },
  {
    sentence: 'When they have finished writing you down, this is where I will be, if I am anywhere.',
    node: 'hold.out',
    speaker: 'jeeh-ei',
    why: 'Her assumption about your afternoon and a statement about where SHE will be. "This is '
      + 'where I will be" points at the bunk she is lying on, not at anywhere the player is '
      + 'being sent. Jiub\'s "I heard them say we\'ve reached Morrowind" does the same work.',
  },
  {
    sentence: 'The door behind me is the one you want.',
    node: 'writ.stamp',
    speaker: 'warden-scribe-tuleeh-ma',
    why: 'A clerk finishing a transaction by pointing at the door of the room you are both '
      + 'standing in, as she hands over your papers. It is signposting and it is declared as '
      + 'such rather than excused: it names one door, in one room, at the end of the scene, at '
      + 'the moment the paperwork ends. It is the weakest entry on this list and it is the first '
      + 'one a future round should argue about — but the r3 critic\'s single recorded hesitation '
      + 'was at `hold.out`, eleven nodes earlier, and not here.',
  },
];

const DECLARED = new Set(DECLARED_WAYFINDING.map((d) => d.sentence));

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Is this fired sentence one of the declared ones?
 *
 * MEASURED, AND THIS IS WHY IT IS NOT `Set.has()`. The first run of the rewritten P9 against the
 * real opening came back with one undeclared sentence:
 *
 *   "When they have finished writing you down, this is where I will be, if I am"
 *
 * against a declared entry ending "…if I am anywhere." **The drawn row is not the authored
 * line.** `render/text-register.js` records what went through the draw call, and the dialogue
 * surface wraps its vellum panel, so a long sentence reaches the frame as a row that stops
 * mid-clause. An exact-string list would therefore be red on the shipped build for a reason that
 * has nothing to do with signposting, and — worse — would go green again the moment somebody
 * changed the panel width.
 *
 * So a hit is declared when the drawn fragment is a PREFIX of a declared sentence, or a declared
 * sentence is a prefix of it. Wrapping only ever truncates; it never invents. A different
 * sentence that merely starts the same way is still a different sentence and still goes red,
 * because the prefix has to run to the end of one side or the other.
 */
function isDeclared(sentence, declared) {
  const s = norm(sentence);
  if (declared.has(sentence) || declared.has(s)) return { declared: true, how: 'exact' };
  for (const d of declared) {
    const n = norm(d);
    if (n.startsWith(s)) return { declared: true, how: 'drawn row wrapped: the frame carries a prefix of the declared sentence', of: d };
    if (s.startsWith(n)) return { declared: true, how: 'the drawn row carries the declared sentence and continues', of: d };
  }
  return { declared: false, how: null };
}

/** Surfaces a person can speak through. Wayfinding anywhere else is the WORLD talking. */
export const SPEAKING_SURFACES = ['dialogue'];

/**
 * Judge a set of drawn strings.
 *
 * @param {Array<{text:string, surface?:string, clipped?:boolean}>} entries
 * @param {{declared?:Set<string>}} [opts]  pass an empty set to run the detector undeclared,
 *        which is how the self-test proves the detector red on lines this build ships.
 */
export function judge(entries, opts = {}) {
  const declared = opts.declared === undefined ? DECLARED : opts.declared;
  const instruction = [];
  const wayfinding_undeclared = [];
  const wayfinding_offstage = [];
  const wayfinding_declared = [];
  const seen = new Set();
  for (const e of entries || []) {
    const text = typeof e === 'string' ? e : (e && e.text) || '';
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const surface = (typeof e === 'object' && e && e.surface) || 'unknown';
    const ih = instructionHits(text);
    if (ih.length) instruction.push({ text, surface, hits: ih });
    for (const w of wayfindingHits(text)) {
      const d = isDeclared(w.sentence, declared);
      const row = { text, surface, ...w, matched_declared: d.declared ? d : null };
      if (!d.declared) wayfinding_undeclared.push(row);
      else if (SPEAKING_SURFACES.indexOf(surface) < 0 && surface !== 'unknown') wayfinding_offstage.push(row);
      else wayfinding_declared.push(row);
    }
  }
  const ok = instruction.length === 0 && wayfinding_undeclared.length === 0 && wayfinding_offstage.length === 0;
  return {
    ok,
    distinct_strings: seen.size,
    instruction, wayfinding_undeclared, wayfinding_offstage, wayfinding_declared,
    declared_count: declared.size,
    why: ok
      ? `${seen.size} distinct strings drawn; none instructs the player, and every wayfinding `
        + `sentence (${wayfinding_declared.length}) is on the declared list and was spoken on a `
        + 'dialogue surface'
      : [
        instruction.length ? `${instruction.length} string(s) instruct the player` : null,
        wayfinding_undeclared.length ? `${wayfinding_undeclared.length} undeclared wayfinding sentence(s)` : null,
        wayfinding_offstage.length ? `${wayfinding_offstage.length} wayfinding sentence(s) drawn where nobody is speaking` : null,
      ].filter(Boolean).join('; '),
  };
}

// ---------------------------------------------------------------------------------------------
// FIXTURES — the r3 verdict §5 table, verbatim, plus the teaching clause and the negatives
// ---------------------------------------------------------------------------------------------
export const FIXTURES = {
  // The seven lines the r3 critic ran, all meaning "go up the ladder". Round 3's P9 caught ONE.
  polite: [
    'Go up. The light is bad but it is light.',
    'The light up there is bad, but it is light. When they have finished writing you down, this is where I will be, if I am anywhere.',
    'The way out is up the companionway, past the crates.',
    'You will want to go up the stairs behind me.',
    'The desk is up the ladder. They are waiting for you.',
    'Up the ladder, then. That is where they write you down.',
    'I would go up, if I were you.',
  ],
  // The sentence the round-2 verdict named as the opening's one tutorial. Cut at r4.
  teaching: 'Past it, no one tells you a thing you have not asked for. So ask them what they do, and what is being said here.',
  // MUST STAY GREEN. Without these this module is a ban on the imperative mood and on the word
  // "up", and a check that fails on everything is as useless as one that fails on nothing.
  negatives: [
    'Do not lose it.',
    'Reed-case, stamped, and it is the only thing in this province that says you are a person rather than a shape that was seen.',
    'It is the only part of this province that is free.',
    'No. Not in that box, and not in those words.',
    'Naga, then. — No. No, you are not, are you. Marsh-form, and a long way from the marsh.',
    'They took my sister at Ebonheart and I have not seen her since.',
    'Silt-Under-Salt',
    'What were you raised to?',
    'I was raised in a house that kept accounts.',
    'The rain has not stopped since Firstseed.',
  ],
};

// ---------------------------------------------------------------------------------------------
// self-test
// ---------------------------------------------------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith('signposting.mjs');
if (isMain && process.argv.includes('--self-test')) {
  const say = (s) => process.stdout.write(s + '\n');
  let failed = 0;
  const check = (name, pass, detail) => {
    say(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
    if (!pass) failed++;
  };

  say('');
  say('  A. the r3 verdict §5 table — seven lines that all mean "go up the ladder".');
  say('     Round 3\'s start-anchored regex caught 1 of 7. The new check must catch 7 of 7,');
  say('     and it is run here with the declared list EMPTY so the detector itself is on trial.');
  say('');
  const OLD = /^(press|hold|tap|click|use|push|move|walk|go|take|open|close|talk|speak|look|aim|pick|select|choose|enter|swipe|drag|attack|block|dodge|roll|equip|find|head|return|follow|try|now|you must|you should|you can|to \w+,)\b/i;
  let caughtNew = 0, caughtOld = 0;
  for (const line of FIXTURES.polite) {
    const v = judge([{ text: line, surface: 'dialogue' }], { declared: new Set() });
    const old = OLD.test(line.trim());
    if (!v.ok) caughtNew++;
    if (old) caughtOld++;
    const how = [
      v.instruction.length ? `instruction(${v.instruction[0].hits.map((h) => h.kind + ':' + (h.verb || h.matched)).join(',')})` : null,
      v.wayfinding_undeclared.length ? `wayfinding(${[...new Set(v.wayfinding_undeclared.flatMap((w) => w.patterns))].join(',')})` : null,
    ].filter(Boolean).join(' + ');
    check(`polite/${FIXTURES.polite.indexOf(line) + 1}`, !v.ok,
      `old-P9 ${old ? 'CAUGHT' : 'passes'} · new ${v.ok ? 'PASSES — THE DETECTOR IS BLIND' : 'RED via ' + how} — ${JSON.stringify(line.slice(0, 62))}`);
  }
  check('polite/all', caughtNew === 7, `new check red on ${caughtNew}/7 (round 3's regex: ${caughtOld}/7)`);

  say('');
  say('  B. the writ.stamp teaching clause — named by the r2 verdict, unchanged at r3, drawn.');
  const t = judge([{ text: FIXTURES.teaching, surface: 'dialogue' }], { declared: new Set() });
  check('teaching', !t.ok && t.instruction.length > 0,
    t.instruction.length ? `RED via instruction ${JSON.stringify(t.instruction[0].hits)}` : 'NOT CAUGHT');
  check('teaching/old-P9', !OLD.test(FIXTURES.teaching.trim()), 'round 3\'s regex passed it, which is the finding');

  say('');
  say('  C. negatives — these must stay green, or this module is a ban on the imperative mood.');
  for (const line of FIXTURES.negatives) {
    const v = judge([{ text: line, surface: 'dialogue' }], { declared: new Set() });
    check(`negative/${JSON.stringify(line.slice(0, 40))}`, v.ok,
      v.ok ? 'green' : `RED (false positive): ${v.why} ${JSON.stringify(v.instruction.concat(v.wayfinding_undeclared).slice(0, 1))}`);
  }

  say('');
  say('  D. the declared list is load-bearing in BOTH directions.');
  const shipped = DECLARED_WAYFINDING.map((d) => ({ text: d.sentence, surface: 'dialogue' }));
  const withList = judge(shipped);
  const withoutList = judge(shipped, { declared: new Set() });
  check('declared/green-with', withList.ok, `the ${DECLARED_WAYFINDING.length} declared sentences pass with the list`);
  check('declared/red-without', !withoutList.ok,
    `and go RED without it (${withoutList.wayfinding_undeclared.length} undeclared) — the list is not inert`);
  const offstage = judge(shipped.map((s) => ({ ...s, surface: 'menus' })));
  check('declared/red-offstage', !offstage.ok,
    `and RED again when the SAME sentences are drawn on 'menus', where nobody is speaking (${offstage.wayfinding_offstage.length})`);

  say('');
  say('  E. the drawn row is not the authored line — the dialogue panel WRAPS.');
  // The exact fragment the first real run of the rewritten P9 came back with.
  const wrapped = 'The light up there is bad, but it is light. When they have finished writing you down, this is where I will be, if I am';
  const wv = judge([{ text: wrapped, surface: 'dialogue' }]);
  check('wrapped/accepted', wv.ok,
    wv.ok ? 'a row cut mid-clause by the panel still matches its declared sentence by prefix'
      : `still red: ${JSON.stringify(wv.wayfinding_undeclared.map((w) => w.sentence))}`);
  // And the prefix tolerance must not become a wildcard. A DIFFERENT sentence that merely starts
  // the same way is still undeclared.
  const impostor = 'When they have finished writing you down, this is where I will be, if I am not up the ladder waiting for you.';
  check('wrapped/not-a-wildcard', !judge([{ text: impostor, surface: 'dialogue' }]).ok,
    'a longer sentence that merely SHARES a prefix is still red — prefix matching runs to the end of one side');

  say('');
  say(`  ${failed ? failed + ' FAILURE(S)' : 'all fixtures on the expected side'}`);
  process.exit(failed ? 1 : 0);
}
