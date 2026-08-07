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

export function properNouns(text) {
  const found = new Set();
  for (const sent of text.split(SENT_SPLIT)) {
    // token stream with offsets; index 0 of a sentence is the sentence-initial slot
    const toks = sent.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) || [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (i === 0) continue;                        // sentence-initial capital proves nothing
      if (!/^\p{Lu}/u.test(t)) continue;
      if (t.length < 3) continue;
      if (/^(I|I'm|I'd|I'll|I've)$/.test(t)) continue;
      found.add(t.replace(/['’]s$/, ''));
    }
  }
  for (const w of text.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) || []) {
    if (BACKSTOP.includes(w.toLowerCase().replace(/['’]s$/, ''))) found.add(w.replace(/['’]s$/, ''));
  }
  return found;
}

// Mask one side. Numbering restarts per side so the two files are indistinguishable in form.
export function maskNames(text) {
  const names = [...properNouns(text)].sort((a, b) => b.length - a.length); // longest first
  if (!names.length) return { text, map: {} };
  const map = new Map();
  let next = 1;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = text;
  for (const n of names) {
    const re = new RegExp(`(?<![\\p{L}])${esc(n)}(?![\\p{L}])`, 'gu');
    if (!re.test(out)) continue;
    if (!map.has(n.toLowerCase())) map.set(n.toLowerCase(), `[NAME-${next++}]`);
    out = out.replace(re, map.get(n.toLowerCase()));
  }
  // possessives survive as `[NAME-1]'s`, which is fine and reads naturally
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

  console.log(bad ? 'SELF-TEST FAILED' : 'self-test passed');
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
      const mineMasked = maskNames(m.text);
      const theirsMasked = maskNames(partner.text);
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
      mapping.push({ trial: n, dir: path.basename(dir), register: kind, ours: oursIsA ? 'A' : 'B', ours_id: m.id, ref_id: partner.id });
    }
  }

  fs.writeFileSync(path.join(reveal, 'mapping.json'), JSON.stringify({
    schema: 'elder-souls/blind-pack-reveal@1',
    piece: 'W1-PROSE-TICS',
    seed,
    do_not_open_until: 'all 15 answers are written',
    trials: mapping,
  }, null, 2) + '\n');

  fs.writeFileSync(path.join(out, 'README.md'), `# W1-PROSE-TICS — round-2 blind packs

15 trials. 5 in each register: **books**, **dialogue**, **journal**. Every trial pairs one of our
shipped passages with one from the reference corpus, length-matched, side randomised on a seeded
shuffle (seed \`${seed}\`).

**These packs were built by the piece's builder and are NOT answered by the builder.** The
round-1 library verdict's blind judgement is recorded void because that critic built its own packs
and then graded them. Answers go in each trial's \`answer.md\`; the mapping is in
\`../prose-tics-r2.reveal/mapping.json\` and opening it early contaminates the rest.

For the books register the sample is drawn **only from books this run edited**, so the judge is
looking at the work rather than at untouched text. That makes the test harder for us, not easier.

A judge who wants the measurement rather than the impression should also run:

\`\`\`
node tools/prose/tic-detector.mjs --self-test
node tools/prose/tic-detector.mjs --out /tmp/r2-check.json
\`\`\`

and read \`reports/prose-tics/W1-PROSE-TICS-report.md\` §3 (the falsified priors), §4 (the em-dash
glyph confound) and §9 (what is explicitly not fixed) **after** answering, not before.
`);

  console.log(`built ${n} blind trials in ${outRel}`);
  console.log(`mapping hidden in ${outRel}.reveal/mapping.json`);
  return 0;
}

process.exit(main());
