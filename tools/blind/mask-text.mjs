#!/usr/bin/env node
// tools/blind/mask-text.mjs — hide provenance in a text artifact WITHOUT leaving a countable scar.
//
// THE DEFECT THIS REPLACES, AND WHY THE OBVIOUS FIXES WERE REJECTED
// -----------------------------------------------------------------
// Round 1 of W1-PROSE-TICS was decidable by counting "Vvardenfell": 17/17, no reading. The fix
// replaced every proper noun with `[NAME-n]`. Round 4's judge then decided the new pack 15/15 by
// counting `[NAME-n]` tokens — margins 1.6x to 7x, median ~3.5x. Running the gate
// (tools/blind/leakcheck.mjs) over that same pack finds the token showing up under NINE more
// statistics nobody had thought to test:
//
//     redaction_tokens 15/15   redaction_density 15/15   paren_density 15/15  (the brackets)
//     uppercase_ratio  14/15   allcaps_words     14/15                       (NAME is capitals)
//     digit_ratio      14/15                                                 (the -12 is digits)
//     mean_word_len    14/15   mean_line_len     15/15   chars     15/15     (the token is long)
//
// One marker, ten channels. **A redaction token is itself a signal** — that is the general lesson
// and it now sits in RI-MTH03 §B. The counter-measure has to remove the marker, not audit it.
//
// Four approaches were on the table. Three were rejected and the reasons are recorded because a
// later round will be tempted by them again:
//
//   REJECTED — balance the token counts by padding the thinner side with decoy `[NAME-n]`s.
//     It equalises the statistic by writing names into passages that do not contain names. The
//     judge is then reading a sentence the author did not write, and every craft judgement taken
//     through it is a judgement of the padding. Fixing a measurement by falsifying the artifact.
//
//   REJECTED — mask to a fixed budget of N slots per passage, both sides.
//     Destroys information above the budget. A letter naming 57 people collapsed into 10 slots is
//     no longer a letter naming 57 people; the reader loses who is speaking to whom, which is the
//     thing the books register is actually being judged on.
//
//   REJECTED — a single undifferentiated token (`[NAME]` everywhere).
//     Loses referent identity. "X betrayed Y and Y forgave X" and "X betrayed X and X forgave X"
//     are different stories. It also does not even close the channel: the count still leaks.
//
//   CHOSEN — RE-NAME instead of redact. Every proper noun is replaced with an invented name drawn
//     from ONE generator shared by both sides, consistently within a passage and independently
//     between passages.
//
// THE COST OF THE CHOICE, STATED PLAINLY. The artifact is now ALTERED, not merely redacted. The
// judge reads "Kethan" where the author wrote "Vivec", and cannot tell an invented name from a
// real one — so a judge must never be asked to reason about names, and the prompt says so. Two
// smaller costs come with it: an invented name carries no etymology, so genuine craft in naming
// (a real property of game writing) becomes invisible and unjudgeable in this pack; and a passage
// whose joke depends on a name is quietly defused. Both are real losses. They are worth paying
// because a pack decidable by `grep -c` measures nothing at all, and because the alternative
// approaches lose more.
//
// WHAT IS DELIBERATELY NOT ATTEMPTED. Re-naming cannot hide HOW MANY names a passage carries, and
// the two corpora genuinely differ there (shipped Morrowind text is name-saturated because quest
// logs route a player to NPCs; ours is about procedures). That residual channel is closed at
// SELECTION time by the pack builder, which pairs on proper-noun density, and it is measured by
// the gate under `mid_sentence_capitals` / `capital_density`. Those rules are flagged `matched` in
// the battery precisely so nobody reads their pass as evidence: they pass by construction.
//
// USAGE
//   import { properNounsAcross, renameText, makeNamePool } from './mask-text.mjs'
//   node tools/blind/mask-text.mjs --self-test

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REDACTION_RE, sentences as splitSentences, midSentenceCapitals } from './leakcheck.mjs';

// ------------------------------------------------------------------------------------------------
// detection

const WORD_RE = /[\p{L}][\p{L}\p{M}'’-]*/gu;

// The ONLY lexicon, and it is English function words rather than setting vocabulary. A list of
// place names written by whoever builds the pack cannot help but mask our setting more thoroughly
// than the reference's, which converts a leak that favours the judge into a leak that favours us.
export const FUNCTION_WORDS = new Set((
  'the a an and or but so of to in on at by for with from as is are was were be been am being ' +
  'i he she it they we you him her them us his hers its their our your my me mine yours ours ' +
  'this that these those there here who whom whose which what how why when where while ' +
  'if then than not no nor do does did done have has had having will would can could shall should ' +
  'may might must ought one two three four five six seven eight nine ten first second third fourth fifth ' +
  'every each all any some both few many much more most other another same such own too very just also ' +
  'now still yet again once never always often sometimes perhaps nevertheless however therefore thus ' +
  'finally before after until since though although because unless whether either neither ' +
  'yes well oh ah please thank thanks farewell goodbye hello sir madam lord lady ' +
  'ask take go come sit stop look listen speak keep bring find get put let watch tell say said ' +
  'chapter book volume part page reader author stone ladder gate road river house'
).split(/\s+/));

// Setting words that are lower-case, or that only ever appear sentence-initially. Half from each
// setting, on purpose, so the list cannot tilt the comparison.
export const BACKSTOP = [
  'vvardenfell', 'morrowind', 'ebonheart', 'balmora', 'vivec', 'septim', 'tamriel', 'cyrodiil',
  'skyrim', 'ashlander', 'ashlanders', 'dunmer', 'telvanni', 'hlaalu', 'redoran', 'khajiit',
  'hircine', 'dwemer', 'daedra', 'daedric', 'argonian', 'argonians', 'altmer', 'bosmer', 'orsimer',
  'imperials', 'nords', 'bretons', 'sadrith', 'mournhold', 'solstheim', 'nerevar', 'almsivi',
  'nerevarine', 'dagoth', 'hortator', 'archcanon', 'mabrigash', 'corprus', 'scrib', 'shalk',
  'kagouti', 'dreugh', 'trama', 'netch', 'guar', 'silt', 'strider',
  'helstrom', 'lilmoth', 'gideon', 'blackrose', 'soulrest', 'stormhold', 'archon', 'thornmarsh',
  'blackmarsh', 'argonia', 'xul-aneekh', 'ixtu-vakh', 'saxhleel', 'lukiul', 'mudborn', 'deep-kin',
  'rootkeeper', 'sapcutter', 'naga', 'xanmeer', 'vakh', 'hist', 'wamasu', 'nagahide',
];
const BACKSTOP_SET = new Set(BACKSTOP);

export const RESIDUE = /\{\{|\}\}|\[\[|\]\]|(?:MW|OB|SR|ON|TR|LO)link=|<\/?[a-z]+[ >]|\|\s*\w+=/i;

const bare = (t) => t.replace(/['’]s$/u, '');
const isFunction = (t) => FUNCTION_WORDS.has(bare(t).toLowerCase());
/** A token carrying an uppercase letter ANYWHERE — so `gro-Kharbush` and `Xul-Aneekh` are caught,
 *  which a first-character test misses and the r4 pack leaked through. */
const hasCap = (t) => /\p{Lu}/u.test(t);

/**
 * OPENERS. The single bug that made the old masker's over-firing ASYMMETRIC, and therefore made
 * the token count a provenance channel rather than just noise.
 *
 * The old rule was "capitalised and not the first token of a sentence ⇒ proper noun", with
 * sentences split only at `.!?`. So every capital that opened a QUOTATION mid-sentence, or a LINE
 * with no terminal stop, or a clause after `:` `;` `--`, was read as a name. Reference text is far
 * more quote-dense and far more line-oriented than ours (topic tables, journal entries), so the
 * masker added tokens to the reference side roughly in proportion to how much dialogue it
 * contained. The r4 reveal's own name map is the evidence: `nevertheless`, `finally`, `after`,
 * `though`, `perhaps`, `certainly`, `because`, `however`, `before`, `please`, `thus`, `farewell`,
 * `yours`, `oh` were all recorded as reference "proper nouns".
 *
 * Here a capital is not evidence when it follows an opener, and openers include line starts.
 */
const LEADING_OPENERS = /^[\s"'“”‘’(\[\{\-–—*#>•]+/u;
const CLAUSE_OPENER = /[:;—–]\s*$|--\s*$|["'“‘(\[]\s*$/u;

/** Proper nouns detectable from one passage. */
export function properNouns(text) {
  const found = new Set();
  const add = (t) => { if (!isFunction(t) && bare(t).length > 1) found.add(bare(t)); };

  for (const raw of splitSentences(text)) {
    const s = raw.replace(LEADING_OPENERS, '');
    const toks = [];
    let m;
    const re = new RegExp(WORD_RE.source, 'gu');
    while ((m = re.exec(s))) toks.push({ t: m[0], at: m.index });
    for (let i = 0; i < toks.length; i++) {
      const { t, at } = toks[i];
      if (!hasCap(t)) continue;
      const before = s.slice(0, at);
      const afterOpener = CLAUSE_OPENER.test(before);
      if (i === 0 || afterOpener) {
        // sentence-, clause- or quote-initial: not evidence ON ITS OWN. It IS evidence when it
        // opens a capitalised run ("Dagoth Ur is served…", "Red Mountain rose…"), which is how the
        // first version of this masker let two-token names walk straight through.
        const nxt = toks[i + 1];
        if (nxt && hasCap(nxt.t) && !isFunction(nxt.t)) { add(t); add(nxt.t); }
        continue;
      }
      add(t);
    }
  }
  for (const w of text.match(WORD_RE) || []) {
    if (BACKSTOP_SET.has(bare(w).toLowerCase())) found.add(bare(w));
  }
  found.delete('I');
  return found;
}

/**
 * A name used mid-sentence ANYWHERE in a side's own corpus is renamed EVERYWHERE in that side,
 * including the one passage where it only ever opens a sentence. Each side is gathered from its
 * own text alone, so the two sets never inform each other.
 *
 * THE CASE-FREQUENCY FILTER, and why it is not optional. Over a 242-book corpus almost every
 * ordinary English word turns up capitalised mid-sentence somewhere — in a title, after a dash, in
 * a heading — so an unfiltered corpus-wide set renames common words. The first run of this code
 * produced `"Chesh elitist, actually."` where the author wrote `"Somewhat elitist, actually."`.
 * That is not a blinding leak (a capitalised word replaced by a capitalised word moves no
 * statistic) but it is damage to the artifact under test, and a judge scoring the prose would be
 * scoring the masker.
 *
 * A real proper noun is almost never seen lower-case. So: a candidate survives only if its
 * lower-case form is rarer than its capitalised form in the same corpus. Generic, symmetric, and
 * it needs no list of setting words.
 */
export function properNounsAcross(docs) {
  const cand = new Set();
  const cap = new Map(), low = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  // `d.text || d` looked equivalent and is not: an empty-string `.text` falls through to the
  // object and hands a non-string to the splitter. The corpus has such entries.
  for (const d of docs) {
    const text = typeof d === 'string' ? d : (typeof d?.text === 'string' ? d.text : '');
    if (!text) continue;
    for (const n of properNouns(text)) cand.add(n);
    for (const w of text.match(WORD_RE) || []) {
      const k = bare(w).toLowerCase();
      bump(hasCap(w) ? cap : low, k);
    }
  }
  const out = new Set();
  for (const n of cand) {
    const k = n.toLowerCase();
    if (BACKSTOP_SET.has(k)) { out.add(n); continue; }
    if ((low.get(k) || 0) >= (cap.get(k) || 0)) continue;   // behaves like a common word: not a name
    out.add(n);
  }
  return out;
}

/** The judge's round-1 rule, re-run on the finished artifact. Returns surviving setting nouns. */
export function settingNounAudit(text) {
  const hits = [];
  for (const w of text.match(WORD_RE) || []) {
    if (BACKSTOP_SET.has(bare(w).toLowerCase())) hits.push(w);
  }
  if (RESIDUE.test(text)) hits.push('<wiki-residue>');
  return hits;
}

// ------------------------------------------------------------------------------------------------
// the shared pseudonym generator
//
// ONE pool, ONE inventory, for BOTH sides. If each side drew from its own generator the generator
// itself would be the new leak — which is the round-1 mistake (a name list written by someone who
// knows one setting better than the other) wearing a third hat.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ONSET = ['b', 'd', 'g', 'h', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'z', 'th', 'sh', 'kh', 'br', 'dr', 'tr', 'vr', 'sl', 'gr', 'ch', 'j', 'p', 'f'];
const NUCLEUS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ou', 'ia', 'au'];
const CODA = ['', '', '', 'n', 'r', 'l', 's', 'th', 'm', 'k', 'sh', 'rn', 'ld'];

function syllable(rng) {
  return ONSET[Math.floor(rng() * ONSET.length)]
    + NUCLEUS[Math.floor(rng() * NUCLEUS.length)]
    + CODA[Math.floor(rng() * CODA.length)];
}

/**
 * A pool of invented names bucketed by length, so a pseudonym can be SHAPE-MATCHED to the name it
 * replaces. Shape matching is not cosmetic: `mean_word_len` scored 14/15 on the r4 pack purely
 * because `[NAME-12]` is a long token, and a generator that emits uniformly short names would
 * simply invert that channel instead of closing it.
 */
export function makeNamePool(seed, size = 4000) {
  const rng = mulberry32(seed);
  const byLen = new Map();
  const seen = new Set();
  let guard = 0;
  while (seen.size < size && guard++ < size * 40) {
    const n = 1 + Math.floor(rng() * 3);
    let s = '';
    for (let i = 0; i < n; i++) s += syllable(rng);
    if (s.length < 3 || s.length > 12) continue;
    if (FUNCTION_WORDS.has(s) || BACKSTOP_SET.has(s)) continue;
    const name = s[0].toUpperCase() + s.slice(1);
    if (seen.has(name)) continue;
    seen.add(name);
    if (!byLen.has(s.length)) byLen.set(s.length, []);
    byLen.get(s.length).push(name);
  }
  return byLen;
}

/** Nearest-length unused pseudonym. Falls back outward one length band at a time. */
function drawName(pool, targetLen, used, rng) {
  const lens = [...pool.keys()].sort((a, b) => Math.abs(a - targetLen) - Math.abs(b - targetLen));
  for (const L of lens) {
    const bucket = pool.get(L);
    const start = Math.floor(rng() * bucket.length);
    for (let i = 0; i < bucket.length; i++) {
      const cand = bucket[(start + i) % bucket.length];
      if (!used.has(cand)) { used.add(cand); return cand; }
    }
  }
  return `Zh${used.size}`;   // unreachable with a 4000-name pool; never silently reuse
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const boundedRe = (n) => new RegExp(`(?<![\\p{L}])${escRe(n)}(?![\\p{L}])`, 'gu');

/**
 * Replace every proper noun with an invented name.
 *
 * Consistency is PER PASSAGE and independent BETWEEN passages: if one real name mapped to one
 * pseudonym pack-wide, a judge could match `Kethan` in t01-A against `Kethan` in t03-B and recover
 * which trials share a corpus — a cross-trial channel strictly worse than the one being closed.
 * So `rng` must be seeded per passage by the caller.
 */
export function renameText(text, vocabulary = [], rng = mulberry32(1), pool = makeNamePool(20260808)) {
  const names = [...new Set([...properNouns(text), ...vocabulary])]
    .filter((n) => boundedRe(n).test(text));
  if (!names.length) return { text, map: {} };

  // order of first appearance, so the assignment is deterministic given the rng
  const firstAt = new Map(names.map((n) => [n, text.search(boundedRe(n))]));
  const byAppearance = names.slice().sort((a, b) => firstAt.get(a) - firstAt.get(b));

  const used = new Set();
  const map = new Map();
  for (const n of byAppearance) {
    const k = n.toLowerCase();
    if (map.has(k)) continue;
    // shape-match: hyphenated originals get hyphenated pseudonyms of comparable length
    const parts = n.split('-');
    const sub = parts.map((p) => drawName(pool, Math.max(3, p.length), used, rng));
    map.set(k, sub.join('-'));
  }

  let out = text;
  for (const n of names.slice().sort((a, b) => b.length - a.length)) {
    out = out.replace(boundedRe(n), map.get(n.toLowerCase()));
  }
  return { text: out, map: Object.fromEntries(map) };
}

// ------------------------------------------------------------------------------------------------

function selfTest() {
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };
  console.log('mask-text --self-test');

  const pool = makeNamePool(20260808);
  const rng = () => mulberry32(99);

  console.log('\nA — the over-firing bug that made the token count a provenance channel');
  // Every one of these words is in the r4 reveal's `name_map_ref` as a "proper noun".
  const quoted = 'He turned and said, "Nevertheless, the toll stands." She answered, "Perhaps." '
    + 'The clerk wrote: Finally, the seal. He added; However, the gap remains.\n'
    + 'Farewell\nPlease do not ask again\nThus it was recorded';
  const pn = properNouns(quoted);
  for (const w of ['Nevertheless', 'Perhaps', 'Finally', 'However', 'Farewell', 'Please', 'Thus', 'She', 'He', 'The']) {
    t(!pn.has(w), `"${w}" opening a quote/clause/line is NOT taken for a proper noun`);
  }
  t(properNouns('a\nb\nc').size === 0, 'a line-oriented passage with no names yields no names');

  console.log('\nB — and real names are still caught, including the ones r4 leaked');
  const ref = 'The Nerevarine came to Balmora. Dagoth Ur is served by his seven kin, called ash '
    + 'vampires by the Ashlanders of Vvardenfell. He spoke to gro-Kharbush and to Eraamion.';
  const our = 'The clerk came up from Lilmoth. Tesh keeps the toll book at Gideon, and the '
    + 'Xul-Aneekh will not say so. Vaskh signed it.';
  const rp = properNouns(ref), op = properNouns(our);
  for (const w of ['Nerevarine', 'Balmora', 'Dagoth', 'Ur', 'Ashlanders', 'Vvardenfell', 'gro-Kharbush', 'Eraamion']) {
    t(rp.has(w), `reference name "${w}" is detected`);
  }
  for (const w of ['Lilmoth', 'Gideon', 'Xul-Aneekh']) {
    t(op.has(w), `our name "${w}" is detected — the symmetry is the point`);
  }
  // THE RESIDUAL HOLE, stated rather than hidden: a name that only ever opens a sentence in the
  // passage at hand cannot be detected from that passage. `Tesh keeps the toll book` and `Vaskh
  // signed it` are the case. It is closed corpus-wide, below, and by the builder's setting-noun
  // audit — not by this function, and pretending otherwise is how r4 shipped `Vaskh`.
  for (const w of ['Tesh', 'Vaskh']) {
    t(!op.has(w), `"${w}" opens every sentence it appears in, so ONE passage cannot see it (hole, declared)`);
  }
  // the corpus-wide set closes the sentence-initial hole
  const docs = [{ text: 'The book at Gideon is kept by Tesh, who signs it.' }, { text: 'Tesh keeps the toll book. She signs it.' }];
  const across = properNounsAcross(docs);
  t(across.has('Tesh'), 'properNounsAcross learns a name from the passage that uses it mid-sentence');
  // the case-frequency filter: a word seen lower-case as often as capitalised is not a name
  const mixed = [{ text: 'The guild met. He joined the guild and left the guild for the Guild of Ash.' }];
  t(!properNounsAcross(mixed).has('Guild'), 'a candidate that also appears lower-case in the corpus is NOT taken for a name');
  t(properNounsAcross([{ text: 'He rode to Vekhu. Vekhu was empty. The road from Vekhu was long.' }]).has('Vekhu'),
    '  (control: a word that never appears lower-case still IS taken for a name — the filter is not inert)');
  t(!/Tesh/.test(renameText(docs[1].text, across, rng(), pool).text),
    'and it is replaced in the passage where it only ever opens a sentence');

  console.log('\nC — the artifact carries NO redaction marker at all (the round-4 channel)');
  const mr = renameText(ref, [], rng(), pool);
  const mo = renameText(our, [], rng(), pool);
  for (const [side, m] of [['reference', mr], ['ours', mo]]) {
    t((m.text.match(REDACTION_RE) || []).length === 0, `${side}: zero bracketed redaction markers`);
    t(!/\[|\]|NAME-/.test(m.text), `${side}: no brackets and no NAME- token anywhere`);
    t(settingNounAudit(m.text).length === 0, `${side}: the round-1 setting-noun rule is clean`);
    t(!/\d/.test(m.text.replace(/\d+(?=\s*(?:years|of))/g, '')), `${side}: masking introduced no digits`);
    t((m.text.match(/\b\p{Lu}{3,}\b/gu) || []).length === 0, `${side}: masking introduced no ALL-CAPS token`);
  }

  console.log('\nD — meaning that must survive: referent identity, possessives, word shape');
  const rep = renameText('Vivec spoke. The people of Vivec listened to Vivec’s word.', [], rng(), pool);
  const sub = Object.values(rep.map)[0];
  t((rep.text.match(new RegExp(escRe(sub), 'g')) || []).length === 3, 'every mention of one name maps to the SAME invented name');
  t(/’s\b/.test(rep.text), 'the possessive survives as <Name>’s');
  const two = renameText('Ravik met Solmar and Ravik left Solmar there.', [], rng(), pool);
  t(new Set(Object.values(two.map)).size === 2, 'two referents get two distinct names — not collapsed into one');
  const wl = (s) => { const w = s.match(WORD_RE) || []; return w.reduce((a, b) => a + b.length, 0) / w.length; };
  t(Math.abs(wl(mr.text) - wl(ref)) < 0.6, `word length is preserved (${wl(ref).toFixed(2)} -> ${wl(mr.text).toFixed(2)}); [NAME-12] moved it enough to score 14/15`);
  t(properNouns('The road runs east. Take the second bridge. Ask at the customs post.').size === 0
    && renameText('The road runs east. Take the second bridge.', [], rng(), pool).text === 'The road runs east. Take the second bridge.',
    'a passage with no proper nouns is returned byte-identical');

  console.log('\nE — cross-trial matching is not possible: the same name renames differently per passage');
  const p1 = renameText(our, [], mulberry32(1), pool).map;
  const p2 = renameText(our, [], mulberry32(2), pool).map;
  t(p1.lilmoth !== p2.lilmoth, 'the same real name draws a different invented name in a different passage');
  const p1b = renameText(our, [], mulberry32(1), pool).map;
  t(p1.lilmoth === p1b.lilmoth, 'and the SAME rng reproduces the SAME pack — the build stays deterministic');

  console.log('\nF — break it on purpose and watch the audit go red (RULES.md 4 and 6)');
  t(settingNounAudit('They sailed from Ebonheart to Vvardenfell.').length >= 2, 'setting audit RED on unmasked reference nouns');
  t(settingNounAudit('The clerk at Blackrose kept the roll.').length >= 1, 'setting audit RED on unmasked nouns of OURS');
  t(settingNounAudit('MWlink=Morrowind:Dagoth Ur (god) is served by his kin.').length >= 1, 'setting audit RED on the wiki residue the r1 pack shipped');
  t(settingNounAudit('The road runs east.').length === 0, 'setting audit QUIET on clean prose');
  // an inert masker — the identity function — must fail the checks this file exists to pass
  const inert = (s) => ({ text: s, map: {} });
  t(settingNounAudit(inert(ref).text).length > 0, 'an INERT masker (identity) is caught by the setting audit');
  const oldStyleMask = ref.replace(/\b(Nerevarine|Balmora|Dagoth|Ur|Ashlanders|Vvardenfell|Eraamion)\b/g, '[NAME-1]');
  t((oldStyleMask.match(REDACTION_RE) || []).length > 0, 'the OLD [NAME-n] masker is caught by the redaction-marker check');
  t((renameText(ref, [], rng(), pool).text.match(REDACTION_RE) || []).length === 0,
    'and the new one is not — the two arms genuinely differ');

  console.log('\nG — name LOAD is not hidden, and is not claimed to be');
  const dense = 'He met Ravik and Solmar and Kethan and Orun and Vekhu at the gate.';
  const sparse = 'He met the reeve and the clerk and the porter and the smith at the gate.';
  t(midSentenceCapitals(renameText(dense, [], rng(), pool).text) > midSentenceCapitals(sparse),
    'a name-dense passage still reads as name-dense after renaming — this channel is closed at SELECTION, not here');

  console.log(bad ? `\nSELF-TEST FAILED (${bad})` : '\nself-test passed');
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(selfTest());
}
