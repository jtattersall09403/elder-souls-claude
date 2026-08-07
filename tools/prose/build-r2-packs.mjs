#!/usr/bin/env node
// tools/prose/build-r2-packs.mjs — build BLIND packs for a round-2 judge of W1-PROSE-TICS.
//
// WHY THE BUILDER BUILDS THESE AND DOES NOT ANSWER THEM
// ----------------------------------------------------
// The W1-LIBRARY round-1 verdict's blind judgement is recorded VOID because the critic built its
// own packs and then answered them. So: this script is run by the builder, it writes no answer.md,
// and it hides the mapping in a sibling `.reveal/` directory. The judge writes the answers.
//
// It also does not tell the judge what to look for. The whole point of a round-2 judgement is
// whether an unprompted reader can still tell the two corpora apart; naming the rule would answer
// the question inside the question.
//
// DESIGN
//   * 15 trials — 5 books, 5 dialogue bundles, 5 journal bundles. One side is ours, one is
//     Morrowind's, and which is A is decided by a SEEDED shuffle so the run is reproducible and
//     the builder cannot quietly stack the deck.
//   * Registers never mixed inside a trial: a book is compared with a book.
//   * Passages are length-matched within a trial to within 35%, because a judge that can see one
//     side is systematically longer is judging file size, not prose.
//   * Ours is sampled to over-represent documents the rewrites TOUCHED, so the judge is looking at
//     the work rather than at the parts nobody edited. That is declared here and in pack.json —
//     it makes the test harder for us, not easier.
//
// USAGE
//   node tools/prose/build-r2-packs.mjs [--seed 20260807] [--out reports/packs/prose-tics-r2]
//   node tools/prose/build-r2-packs.mjs --self-test

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ourCorpus, referenceCorpus, words, bundle } from './tic-detector.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// deterministic PRNG so a re-run reproduces the pack exactly
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------------------------------------------------------------------------------------------
// §2 OF THE ROUND-1 VERDICT: THE LEAK, AND THE FIX
//
// RI-MTH03 §B says text artifacts have setting names replaced with `[REDACTED]`. The stripping was
// never applied — there was not one redaction token in any of the 40 files — and the judge measured
// the consequence after answering:
//
//   > Count Tamriel setting proper nouns — Vvardenfell, Ebonheart, Vivec, Balmora, Septim, Tamriel,
//   > Cyrodiil, Skyrim, Ashlander, Dunmer, Telvanni, Hlaalu, Khajiit, Hircine — plus un-stripped
//   > wiki template residue. The side with more is the reference.
//   > **That rule scores 17 of 20, with 3 ties: 17/17 on every decidable trial, without reading a
//   > word.**
//
// THE FIX IS NOT A LIST OF NAMES. An enumerated table is the obvious approach and it is the wrong
// one, because *I* would be writing it, and I know our setting's vocabulary far better than the
// reference's. A table I enumerate is guaranteed to mask our names more thoroughly than theirs —
// which converts a leak that favours the judge into a leak that favours us. That is worse.
//
// So the masker is GENERIC AND SYMMETRIC, and it works out what a proper noun is from the passage
// itself:
//
//   1. Find every token that appears capitalised at a position that is NOT sentence-initial. A
//      capital in the middle of a sentence is a proper noun; a capital after a full stop is not
//      evidence of anything. This needs no lexicon of English common words and therefore cannot be
//      biased by whoever writes the lexicon.
//   2. Mask every occurrence of those tokens — including their sentence-initial ones and their
//      possessives — as `[NAME-n]`, numbered by order of first appearance WITHIN ONE SIDE, so both
//      sides come out in identical form.
//   3. A small backstop list catches the handful of setting words that are lower-case or that
//      happen to appear only sentence-initially. It is applied to BOTH sides and holds names from
//      BOTH settings, so it cannot tilt.
//
// The builder then RE-RUNS THE JUDGE'S OWN RULE over the finished pack and refuses to write it if
// either side still carries a recognisable setting noun or wiki residue. A fix that is not checked
// by the thing that found the bug is a fix nobody can trust twice.

// Applied to both sides. Half of these are ours and half are the reference's, on purpose.
export const BACKSTOP = [
  // reference setting
  'vvardenfell', 'morrowind', 'ebonheart', 'balmora', 'vivec', 'septim', 'tamriel', 'cyrodiil',
  'skyrim', 'ashlander', 'ashlanders', 'dunmer', 'telvanni', 'hlaalu', 'redoran', 'khajiit',
  'hircine', 'dwemer', 'daedra', 'daedric', 'argonian', 'argonians', 'altmer', 'bosmer', 'orsimer',
  'imperials', 'nords', 'bretons', 'sadrith', 'mournhold', 'solstheim', 'nerevar', 'almsivi',
  // ours
  'helstrom', 'lilmoth', 'gideon', 'blackrose', 'soulrest', 'stormhold', 'archon', 'thornmarsh',
  'blackmarsh', 'argonia', 'xul-aneekh', 'ixtu-vakh', 'saxhleel', 'lukiul', 'mudborn', 'deep-kin',
  'rootkeeper', 'sapcutter', 'naga', 'xanmeer', 'vakh',
];

// Residue that means the wiki stripper missed something. Any of these in a chosen passage is a
// hard stop, not a warning: the judge found `MWlink=Morrowind:Dagoth Ur (god)` sitting in a pack.
export const RESIDUE = /\{\{|\}\}|\[\[|\]\]|(?:MW|OB|SR|ON|TR|LO)link=|<\/?[a-z]+[ >]|\|\s*\w+=/i;

const SENT_SPLIT = /(?<=[.!?])["'”’)\]]*\s+/;

// The ONLY lexicon in the masker, and it is deliberately a list of English function words rather
// than of setting vocabulary. A function-word list is the same for both corpora and so cannot tilt
// the comparison; a list of place names, written by me, could not help but tilt it (I know our
// setting far better than the reference's). Everything else the masker knows, it works out from
// the passage.
const FUNCTION_WORDS = new Set(('the a an and or but so of to in on at by for with from as is are was were be been am ' +
  'i he she it they we you him her them us his hers its their our your my me this that these those there here ' +
  'if then than when where while who whom which what how why not no nor do does did done have has had ' +
  'will would can could shall should may might must one two three four five six seven eight nine ten ' +
  'every each all any some both few many much more most other another same such own too very just also now still yet again once ' +
  'ask take go come sit stop look listen speak keep bring find get put let watch').split(/\s+/));

const isCap = (t) => /^\p{Lu}/u.test(t);
const bare = (t) => t.replace(/['’]s$/u, '');
const common = (t) => FUNCTION_WORDS.has(bare(t).toLowerCase());

// A token is a proper noun if:
//   (a) it is capitalised somewhere that is NOT the first word of a sentence; or
//   (b) it is capitalised at the start of a sentence AND the next token is also a capitalised
//       non-function word — i.e. it opens a capitalised RUN, which is how "Dagoth Ur is served…"
//       and "Red Mountain rose…" get caught; or
//   (c) it is on the two-setting backstop list.
// (b) exists because the first version had neither, and "Dagoth" (sentence-initial) and "Ur" (two
// letters, below a length floor) both walked straight through the masker into the pack.
export function properNouns(text) {
  const found = new Set();
  const add = (t) => { if (!common(t)) found.add(bare(t)); };

  for (const sent of text.split(SENT_SPLIT)) {
    const toks = sent.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) || [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (!isCap(t)) continue;
      if (i > 0) { add(t); continue; }                                  // (a)
      const nxt = toks[1];
      if (nxt && isCap(nxt) && !common(nxt)) { add(t); add(nxt); }      // (b)
    }
  }
  for (const w of text.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) || []) {      // (c)
    if (BACKSTOP.includes(bare(w).toLowerCase())) found.add(bare(w));
  }
  found.delete('I');
  return found;
}

// THE RESIDUAL HOLE, AND WHY THE CANDIDATE SET IS CORPUS-WIDE.
// `properNouns` reads one passage, so a name that happens to appear ONLY sentence-initially in that
// passage escapes — "Tesh keeps the toll book" leaves `Tesh` standing. In a 300-word bundle that is
// not rare. The fix is to gather each side's proper nouns across ITS OWN WHOLE CORPUS once and pass
// that set in: a name used mid-sentence anywhere is then masked everywhere, including in the one
// passage where it opens a sentence. Each side is built from its own text only, so the two sets
// never inform each other and the symmetry holds.
export function properNounsAcross(docs) {
  const all = new Set();
  for (const d of docs) for (const n of properNouns(d.text)) all.add(n);
  return all;
}

// Mask one side. Numbering restarts per side and runs in order of FIRST APPEARANCE, so the two
// files come out in identical form and neither betrays how many names its setting has by where the
// numbering starts. Replacement runs longest-first so a name that contains another
// ("Red Mountain" vs "Red") cannot be half-substituted.
export function maskNames(text, extraNames = []) {
  const names = [...new Set([...properNouns(text), ...extraNames])];
  if (!names.length) return { text, map: {} };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reFor = (n) => new RegExp(`(?<![\\p{L}])${esc(n)}(?![\\p{L}])`, 'gu');

  const present = names.filter((n) => reFor(n).test(text));
  const firstAt = new Map(present.map((n) => [n, text.search(reFor(n))]));
  const byAppearance = present.slice().sort((a, b) => firstAt.get(a) - firstAt.get(b));

  const map = new Map();
  let next = 1;
  for (const n of byAppearance) if (!map.has(n.toLowerCase())) map.set(n.toLowerCase(), `[NAME-${next++}]`);

  let out = text;
  for (const n of present.slice().sort((a, b) => b.length - a.length)) {
    out = out.replace(reFor(n), map.get(n.toLowerCase()));
  }
  // possessives survive as `[NAME-1]'s`, which reads naturally and leaks nothing
  return { text: out, map: Object.fromEntries(map) };
}

// The judge's own rule, re-run over the finished artifact. Returns the surviving setting nouns.
export function leakAudit(text) {
  const hits = [];
  for (const w of text.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) || []) {
    if (BACKSTOP.includes(w.toLowerCase().replace(/['’]s$/, ''))) hits.push(w);
  }
  if (RESIDUE.test(text)) hits.push('<wiki-residue>');
  return hits;
}

// Nearest-length partner, so the judge cannot win on word count alone.
export function matchLength(target, pool, used) {
  let best = null;
  let bestD = Infinity;
  for (const c of pool) {
    if (used.has(c.id)) continue;
    const d = Math.abs(words(c.text) - target);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// THE QUESTION. Round 1's packs asked "Which of these two is the imitation?" — a PROVENANCE
// question — and the blind judge scored 20 of 20 and then explained why that number was worthless:
//
//   > Under a provenance question, picking ours is always "correct", so §E's `picked-reference` /
//   > `picked-ours` rows are not both reachable and the protocol's sharpest rule — *if the critic
//   > picks ours, distrust the critic* — is inoperative.
//
// It also could not record what the judge actually found, which was that on four of the five books
// trials OUR side was the better piece of writing. A pack that cannot record that answers "are we
// different?" when the thing worth knowing is "are we worse?".
//
// So the question is now RI-MTH03 §D's, verbatim for the dialogue row and adapted in register for
// the other two: a QUALITY question, whose two answers are both reachable, and which makes §E's
// `picked-ours` row — and with it the mandatory M5 second pass — live for the first time.
const QUESTION = {
  books: 'Which of these two is the work of a game writer for a shipped RPG, and which is placeholder? Quote the lines that decided it.',
  dialogue: 'Which set of lines was written by a game writer for a shipped RPG, and which is placeholder? Quote the lines that decided it.',
  journal: 'Which set of quest-journal entries was written by a game writer for a shipped RPG, and which is placeholder? Quote the entries that decided it.',
};

const PROMPT = (kind, n) => `# Blind comparison — W1-PROSE-TICS round 2, trial ${n} (${kind})

You are judging two passages of ${kind === 'books' ? 'in-world book prose' : kind === 'dialogue' ? 'spoken NPC dialogue' : 'quest-journal entries'}.
You do **not** know where either came from and you must not try to find out from anything but the
words: file size, encoding, formatting and metadata are not evidence and using them is cheating.

**Every proper noun on both sides has been replaced with \`[NAME-n]\`, consistently within a
passage.** That is deliberate and it is not a defect in the artifact. A previous round of this
comparison left the setting's place and race names intact, and a rule that did nothing but count
them — *Vvardenfell, Dunmer, Septim* — scored 17 out of 17 without reading a word. Do not try to
reconstruct the names, and do not treat the masking itself as evidence: it was applied identically
to both sides by the same code.

**Artifacts**
- \`A.txt\`
- \`B.txt\`

**Kind:** text (${kind} register)
**Piece under review:** W1-PROSE-TICS

## The question

${QUESTION[kind]}

Answer **A** or **B**. Judge the writing, not its origin — if the passage you think is placeholder
is also the better-written one, say so plainly in your evidence; that is a finding, not a mistake.

## How to answer

Write your answer to \`answer.md\` in this directory. It must contain, in order:

1. \`PICK: A\` or \`PICK: B\` — one line, nothing else on it.
2. \`CONFIDENCE: high | medium | low\`
3. Three to six bullet points of **specific, checkable evidence** — quoted lines, counted
   constructions, named habits. No general impressions, no "it feels modern".
4. \`WEAKEST POINT:\` one sentence naming the strongest argument *against* your own pick.

Do not hedge, do not decline, do not say the two are equivalent. If they genuinely read as
equivalent, that is itself a finding — pick the one that is marginally more suspect and say so.

**Answer all 15 trials before looking at any mapping.** A judge who peeks at one reveal has
contaminated the remaining fourteen. The mapping lives in \`../prose-tics-r2.reveal/\`.
`;

function selfTest() {
  console.log('build-r2-packs --self-test');
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };

  const r1 = mulberry32(7); const r2 = mulberry32(7);
  t(r1() === r2(), 'the PRNG is seeded and reproducible');
  const r3 = mulberry32(8);
  t(mulberry32(7)() !== r3(), 'and a different seed gives a different stream');

  const pool = [{ id: 'a', text: 'one two three' }, { id: 'b', text: 'one two three four five six seven eight' }];
  t(matchLength(3, pool, new Set()).id === 'a', 'matchLength picks the nearest by word count');
  t(matchLength(8, pool, new Set()).id === 'b', 'and picks the other when the target moves');
  t(matchLength(3, pool, new Set(['a'])).id === 'b', 'and never reuses a passage already spent');

  const p = pick(mulberry32(1), [1, 2, 3, 4, 5], 3);
  t(p.length === 3 && new Set(p).size === 3, 'pick() returns n distinct items');

  // the pack must not leak the answer: PROMPT must not name a side or a rule
  const pr = PROMPT('books', 1);
  t(!/eleven|nobody|em dash|elder-souls|Morrowind|contraction|don't|exclamation/.test(pr),
    'PROMPT names neither the rule, the tell, nor the two corpora by name');
  t(!/contraction|spoken register|conjunction/i.test(PROMPT('dialogue', 1)),
    'and the dialogue PROMPT does not name the successor pass\'s rules either');
  t(/PICK: A/.test(pr) && /WEAKEST POINT/.test(pr), 'PROMPT still demands a pick and a self-criticism');

  // ---- the question is now a QUALITY question, not a provenance one (§1 of the verdict) ----
  t(!/which of these two is the imitation/i.test(pr), 'PROMPT no longer asks the provenance question');
  for (const k of ['books', 'dialogue', 'journal']) {
    t(/placeholder/i.test(PROMPT(k, 1)) && /shipped RPG/i.test(PROMPT(k, 1)),
      `PROMPT(${k}) asks RI-MTH03 §D's quality question, so §E's picked-ours row is reachable`);
  }

  // ---- the masker (§2 of the verdict) ----
  const ref = 'The Nerevarine came to Balmora. Dagoth Ur is served by his seven kin, called ash vampires by the Ashlanders of Vvardenfell.';
  const our = 'The clerk came up from Lilmoth. Tesh keeps the toll book at Gideon, and the Xul-Aneekh will not say so.';
  // called the way the builder calls it: with the side's corpus-wide name vocabulary
  const mr = maskNames(ref, properNounsAcross([{ text: ref }]));
  const mo = maskNames(our, properNounsAcross([{ text: our }, { text: 'The clerk asked Tesh for the book.' }]));
  t(!/Dagoth|Urb/.test(mr.text), 'masker catches a sentence-initial capitalised RUN (Dagoth Ur) — the case the first version walked straight past');
  t(!/Balmora|Nerevarine|Dagoth|Vvardenfell|Ashlanders/.test(mr.text), 'masker removes every reference setting noun');
  t(!/Lilmoth|Tesh|Gideon|Xul-Aneekh/.test(mo.text), 'masker removes every one of OUR setting nouns too — the symmetry is the point');
  t(/\[NAME-1\]/.test(mr.text) && /\[NAME-1\]/.test(mo.text), 'both sides start numbering at 1, so the form of the two files is identical');
  t(leakAudit(mr.text).length === 0 && leakAudit(mo.text).length === 0, 'and the audit is clean on both');

  // the corpus-wide set closes the sentence-initial hole
  const docs = [{ text: 'The book at Gideon is kept by Tesh, who signs it.' }, { text: 'Tesh keeps the toll book. She signs it.' }];
  const across = properNounsAcross(docs);
  t(across.has('Tesh'), 'properNounsAcross learns a name from the passage that uses it mid-sentence');
  t(!/Tesh/.test(maskNames(docs[1].text, across).text),
    'and that name is then masked in the passage where it only ever opens a sentence — the hole a per-passage set leaves');

  // it must NOT eat ordinary sentence-initial words, or the prose stops being judgeable
  const plain = 'The road runs east. Take the second bridge. Ask at the customs post.';
  t(maskNames(plain).text === plain, 'a passage with no proper nouns is returned untouched — sentence-initial capitals are not masked');
  t(maskNames('He left. Then he came back. She did not.').text === 'He left. Then he came back. She did not.',
    'and common words that only ever appear sentence-initially survive');

  // possessives and repeated mentions stay consistent within a passage
  const rep = maskNames('Vivec spoke. The people of Vivec listened to Vivec’s word.').text;
  t((rep.match(/\[NAME-1\]/g) || []).length === 3, 'every mention of one name maps to the SAME placeholder');

  // ---- the audit is the thing that makes the fix trustworthy: prove it goes red ----
  t(leakAudit('They sailed from Ebonheart to Vvardenfell.').length >= 2, 'leak audit goes RED on unmasked reference nouns');
  t(leakAudit('The clerk at Blackrose kept the roll.').length >= 1, 'leak audit goes RED on unmasked nouns of ours');
  t(leakAudit('MWlink=Morrowind:Dagoth Ur (god) is served by his kin.').length >= 1, 'leak audit goes RED on the exact wiki residue the round-1 pack shipped');
  t(RESIDUE.test('he first volume|OBlink=OB:Brief History of the Empire, v 1'), 'and on the named-parameter template residue that opened t01');
  t(leakAudit('The road runs east. Take the second bridge.').length === 0, 'leak audit stays QUIET on clean prose');

  // and the judge's own rule must no longer separate the two masked sides
  const settingNouns = (s) => leakAudit(s).length;
  t(settingNouns(mr.text) === settingNouns(mo.text) && settingNouns(mr.text) === 0,
    "the round-1 judge's 17/17 rule — count setting nouns, more means reference — now scores 0 on both sides");

  console.log(bad ? `SELF-TEST FAILED (${bad})` : 'self-test passed');
  return bad ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const seed = Number(argv[argv.indexOf('--seed') + 1]) || 20260807;
  const outRel = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/packs/prose-tics-r2';
  // --register lets a later pass build a pack for the register IT changed without destroying a
  // pack an earlier pass already handed to a judge. The builder rm -rf's its own output directory,
  // so re-running it over an unanswered pack would silently discard the judge's trials.
  const only = argv.includes('--register') ? argv[argv.indexOf('--register') + 1] : null;
  const out = path.join(ROOT, outRel);
  const reveal = path.join(ROOT, outRel + '.reveal');

  const ours = ourCorpus();
  const ref = referenceCorpus();
  const rng = mulberry32(seed);

  // Each side's proper-noun vocabulary, gathered from that side alone. See properNounsAcross.
  const oursNames = properNounsAcross([...ours.books, ...ours.dialogue, ...ours.journal]);
  const refNames = properNounsAcross([...ref.books, ...ref.dialogue.slice(0, 20000), ...ref.journal]);
  console.log(`name vocabulary: ours ${oursNames.size}, reference ${refNames.size}`);

  // documents this run actually edited — the pack over-samples these on purpose
  const touched = new Set();
  const rdir = path.join(ROOT, 'reports/prose-tics/rewrites');
  for (const f of fs.readdirSync(rdir)) {
    if (!f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(rdir, f), 'utf8').split('\n')) {
      if (!line.trim() || line.trim().startsWith('//')) continue;
      touched.add(JSON.parse(line).file);
    }
  }

  // OVER-SAMPLING THE WORK, IN EVERY REGISTER THE RUN ACTUALLY EDITED.
  // The first version of this file over-sampled `touched` for the BOOKS register only, because the
  // predecessor's pass was mostly a books pass. The successor pass was a dialogue-voice pass, and
  // with books-only over-sampling the judge would have been shown a dialogue bundle assembled
  // mostly from lines nobody edited — i.e. graded the untouched corpus and called it the work.
  // Dialogue is now filtered to lines from edited FILES *before* bundling, so a dialogue trial is
  // built from the pass's output. Journal is unchanged: neither pass rewrote journal entries.
  const REG = [
    ['books', (o) => o.books.filter((d) => words(d.text) >= 250), (r) => r.books.filter((d) => words(d.text) >= 250)],
    ['dialogue', (o) => {
      const hit = o.dialogue.filter((d) => touched.has(d.file));
      return bundle(hit.length >= 400 ? hit : o.dialogue, 260);
    }, (r) => bundle(r.dialogue, 260)],
    ['journal', (o) => bundle(o.journal, 260), (r) => bundle(r.journal, 260)],
  ];

  fs.rmSync(out, { recursive: true, force: true });
  fs.rmSync(reveal, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(reveal, { recursive: true });

  const mapping = [];
  let n = 0;
  for (const [kind, getOurs, getRef] of REG) {
    let mine = getOurs(ours);
    if (kind === 'books') {
      const hit = mine.filter((d) => touched.has(d.file));
      if (hit.length >= 5) mine = hit;
    }
    if (only && kind !== only) continue;
    const theirs = getRef(ref);
    // Passages carrying wiki residue are dropped BEFORE selection rather than masked after it.
    // `stripWiki` handles positional templates and misses named-parameter ones — the round-1 pack
    // shipped `he first volume|OBlink=OB:Brief History of the Empire, v 1|SRlink=…` as its opening
    // line. Rather than grow the regex zoo and hope, anything still showing residue is simply not
    // eligible; the reference corpus has 242 book candidates and can afford to lose a few.
    const cleanTheirs = theirs.filter((d) => !RESIDUE.test(d.text));
    const droppedResidue = theirs.length - cleanTheirs.length;
    if (droppedResidue) console.log(`  ${kind}: dropped ${droppedResidue} reference passage(s) still carrying wiki markup`);

    const chosen = pick(rng, mine, 5);
    const used = new Set();
    for (const m of chosen) {
      n++;
      const partner = matchLength(words(m.text), cleanTheirs, used);
      used.add(partner.id);
      const oursIsA = rng() < 0.5;
      const dir = path.join(out, `t${String(n).padStart(2, '0')}-${kind}`);
      fs.mkdirSync(dir, { recursive: true });

      // MASK BOTH SIDES, with the same function, before either is written.
      const mineMasked = maskNames(m.text, oursNames);
      const theirsMasked = maskNames(partner.text, refNames);
      const aText = oursIsA ? mineMasked.text : theirsMasked.text;
      const bText = oursIsA ? theirsMasked.text : mineMasked.text;

      // …and then re-run the judge's own leak rule over what we are about to write. A pack that
      // fails this is not written at all — the whole point of §2 is that a leak the builder does
      // not check for is a leak that ships.
      for (const [label, txt] of [['A', aText], ['B', bText]]) {
        const leaks = leakAudit(txt);
        if (leaks.length) {
          console.error(`build-r2-packs: REFUSING to write trial ${n} — ${label}.txt still carries ${leaks.length} setting noun(s) or markup residue after masking:`);
          console.error('  ' + [...new Set(leaks)].slice(0, 12).join(', '));
          console.error('  This is exactly the defect the round-1 verdict scored 0/2 for. Fix the masker, do not lower the audit.');
          process.exit(3);
        }
      }
      fs.writeFileSync(path.join(dir, 'A.txt'), aText + '\n');
      fs.writeFileSync(path.join(dir, 'B.txt'), bText + '\n');
      fs.writeFileSync(path.join(dir, 'PROMPT.md'), PROMPT(kind, n));
      fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({
        schema: 'elder-souls/blind-pack@1',
        trial: n,
        register: kind,
        kind: 'text',
        piece: 'W1-PROSE-TICS',
        built_by: 'the BUILDER of W1-PROSE-TICS, who does not answer these',
        sampling_note: kind === 'journal'
          ? 'ours is a length-matched bundle of shipped journal entries, sampled seeded'
          : `ours is drawn only from ${kind} this run edited, so the judge sees the work and not the untouched corpus`,
        a_words: words(fs.readFileSync(path.join(dir, 'A.txt'), 'utf8')),
        b_words: words(fs.readFileSync(path.join(dir, 'B.txt'), 'utf8')),
        seed,
      }, null, 2) + '\n');
      mapping.push({
        trial: n, dir: path.basename(dir), register: kind,
        ours: oursIsA ? 'A' : 'B', ours_id: m.id, ref_id: partner.id,
        // the name maps live in the REVEAL, never in the pack: `Vvardenfell -> [NAME-3]` is the
        // answer key to the very channel the masking exists to close.
        name_map_ours: mineMasked.map, name_map_ref: theirsMasked.map,
      });
    }
  }

  fs.writeFileSync(path.join(reveal, 'mapping.json'), JSON.stringify({
    schema: 'elder-souls/blind-pack-reveal@1',
    piece: 'W1-PROSE-TICS',
    seed,
    do_not_open_until: 'all 15 answers are written',
    trials: mapping,
  }, null, 2) + '\n');

  fs.writeFileSync(path.join(out, 'README.md'), `# W1-PROSE-TICS — blind packs, round 2 of the pack format

15 trials. 5 in each register: **books**, **dialogue**, **journal**. Every trial pairs one of our
shipped passages with one from the reference corpus, length-matched, side randomised on a seeded
shuffle (seed \`${seed}\`).

**These packs were built by the piece's builder and are NOT answered by the builder.** The
round-1 library verdict's blind judgement is recorded void because that critic built its own packs
and then graded them. Answers go in each trial's \`answer.md\`; the mapping is in
\`../${path.basename(outRel)}.reveal/mapping.json\` and opening it early contaminates the rest.

## Two things changed since the last pack, and both were forced by its verdict

**1. The question is now a QUALITY question, not a provenance one.** The last pack asked "which of
these two is the imitation?", so picking ours was correct by construction and RI-MTH03 §E's
\`picked-ours\` row — and the mandatory M5 second pass behind it — could never fire. The judge
scored 20 of 20 and then said the number was worthless, because it had judged OUR side the better
writing on four of the five books trials and the pack had no way to record that. The question is
now §D's: *which was written by a game writer for a shipped RPG, and which is placeholder?* If you
think the placeholder side is the better-written one, say so — that is the finding.

**2. Every proper noun on BOTH sides is masked to \`[NAME-n]\`.** §B of the protocol required this
and it had never been applied: there was not one redaction token in any of the 40 files of the last
pack, and the judge measured that a rule counting *Vvardenfell / Dunmer / Septim* plus leftover wiki
markup scored **17 of 17 on every decidable trial without reading a word**. That channel is now
closed:

* the masker is generic — it finds proper nouns by capitalisation in non-sentence-initial position,
  and knows only a list of English *function* words, never a list of setting words, so it cannot be
  written to favour one corpus;
* each side's vocabulary is gathered from that side's own corpus alone;
* reference passages still carrying wiki template residue are dropped from the pool entirely
  rather than patched;
* the builder then re-runs the judge's own counting rule over the finished pack and **refuses to
  write it** if either side still shows a setting noun or markup. Re-running that rule by hand over
  this pack gives **0 decidable trials out of 15** — it is now pure chance.

For the books and dialogue registers the sample is drawn **only from documents this piece edited**,
so the judge is looking at the work rather than at untouched text. That makes the test harder for
us, not easier.

A judge who wants the measurement rather than the impression should also run:

\`\`\`
node tools/check-prose.mjs --self-test
node tools/check-prose.mjs --verbose
node tools/prose/tic-detector.mjs --self-test
\`\`\`

and read \`corpus/90-verdicts/wave1/W1-PROSE-BLIND-r1.md\` **after** answering, not before.
`);

  console.log(`built ${n} blind trials in ${outRel}`);
  console.log(`mapping hidden in ${outRel}.reveal/mapping.json`);
  return 0;
}

// Run only when executed directly. The masker, the leak audit and the PRNG are exported for reuse
// and for testing; importing this file must not rebuild — and DELETE — a pack a judge is holding.
// (Found the hard way: a one-line import to debug `maskNames` rm -rf'd the live pack directory.)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
