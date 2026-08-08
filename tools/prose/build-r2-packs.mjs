#!/usr/bin/env node
// tools/prose/build-r2-packs.mjs — build BLIND prose packs for a judge of W1-PROSE-TICS.
//
// (The filename says "r2" and is kept for the verdicts and status files that cite it. It is the
// project's one prose pack builder; the round it builds is `--out`.)
//
// WHY THE BUILDER BUILDS THESE AND DOES NOT ANSWER THEM
// ----------------------------------------------------
// The W1-LIBRARY round-1 blind judgement is recorded VOID because the critic built its own packs
// and then answered them (RULES.md 25). So: this script is run by the builder, it writes no
// answers, and it hides the mapping in a sibling `.reveal/` directory.
//
// THREE ROUNDS OF THE SAME DEFECT, AND WHAT FINALLY CLOSED IT
// ----------------------------------------------------------
//   r1  no masking at all. A rule counting *Vvardenfell / Dunmer / Septim* scored 17/17 without
//       reading a word.
//   r4  every proper noun masked to `[NAME-n]`. A rule counting `[NAME-n]` TOKENS scored 15/15,
//       margins 1.6x-7x. The mask verified what it CONTAINED and leaked through how many tokens it
//       ADDED. Running tools/blind/leakcheck.mjs over that pack finds the same marker decides it
//       under TEN statistics: the brackets (paren_density 15/15), the capitals (uppercase_ratio and
//       allcaps_words 14/15), the digits in `-12` (digit_ratio 14/15) and the token's length
//       (mean_word_len 14/15, mean_line_len and chars 15/15).
//   here Three changes, and none of them is "a better list of names":
//       1. RE-NAME rather than redact — tools/blind/mask-text.mjs. No marker exists to count.
//       2. PAIR on proper-noun density and character count, not word count alone. Name LOAD is a
//          genuine difference between the corpora and no masker can hide it; it is closed at
//          selection or not at all.
//       3. GATE the finished pack with tools/blind/leakcheck.mjs and REFUSE TO SHIP if any
//          mechanical rule decides it. A leak the builder does not check for is a leak that ships,
//          and this project has now shipped two.
//
// GOODHART, DECLARED. Change 2 optimises statistics that change 3 also measures, so a pass on
// those is BY CONSTRUCTION and is not evidence. leakcheck marks them `matched` and prints them in
// a separate block for exactly that reason. The held-out block is where the evidence is.
//
// USAGE
//   node tools/prose/build-r2-packs.mjs [--seed 20260810] [--out reports/packs/prose-tics-r5]
//   node tools/prose/build-r2-packs.mjs --self-test

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ourCorpus, referenceCorpus, words, bundle } from './tic-detector.mjs';
import { properNounsAcross, renameText, makeNamePool, settingNounAudit, RESIDUE } from '../blind/mask-text.mjs';
import { midSentenceCapitals, REDACTION_RE } from '../blind/leakcheck.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// RULES.md 12 — stamp the commit. The pack's A.txt/B.txt and its reveal key are NOT tracked
// (reports/.gitignore keeps only *.md), so the artifact a judge reads exists on one container's
// disk and is recoverable ONLY by re-running this builder with the same --seed. That reproduction
// is exact against the same corpus and wrong against any other, so the corpus commit is written
// into both pack.json and mapping.json and a later reproduction can be checked rather than assumed.
function headCommit() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

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

// ------------------------------------------------------------------------------------------------
// PAIRING
//
// r4 matched on WORD COUNT alone and called the length channel closed. The gate says otherwise:
// `words` scored 6/11 (chance — the matching worked) while `chars` scored 15/15, because masking
// changes character counts even when it leaves word counts alone. And `capital_density` scored
// 14/15, because shipped Morrowind text is name-saturated and ours is not.
//
// So a partner is chosen by a joint normalised distance over the three statistics that actually
// differ, with a HARD tolerance on each. A passage with no partner inside tolerance is dropped
// rather than shipped — fewer trials is a cost worth paying, a decidable trial is not.
//
// THE COST, STATED. Pairing inside the density-overlap band means neither sample is a uniform draw
// from its corpus any more: the reference passages are the less name-dense end of Morrowind (more
// flavour text, fewer quest logs) and ours are the more name-dense end of Black Marsh. The pack
// therefore measures prose quality ON THE SUBSET WHERE THE TWO CORPORA ARE MECHANICALLY
// COMPARABLE, and no verdict taken through it may be generalised past that. Measured feasibility
// at the tolerances below: books 117 of 134 of our passages have at least one legal partner,
// dialogue 280 of 281, journal 84 of 147.
export const TOL = { words: 0.22, chars: 0.22, density: 0.20 };

export function profile(text) {
  const w = words(text);   // tic-detector's words() returns a COUNT, not an array
  return { words: w, chars: text.length, density: w ? (1000 * midSentenceCapitals(text)) / w : 0 };
}

const relDiff = (a, b) => Math.abs(a - b) / Math.max(1, Math.max(a, b));

/**
 * Nearest legal partner by joint distance, or null when none is inside tolerance.
 *
 * `want` optionally fixes the SIGN of a statistic: `{ density: +1 }` means "the reference partner
 * must be LESS name-dense than ours on this trial". Bounding the magnitude is not enough on its
 * own and the gate proved it — with a 20% tolerance the reference side was still the denser side
 * in 13 of 15 trials, so `capital_density` sat at 0.87 while every individual pair was legal. A
 * tolerance bounds how big the difference is; only alternating the sign stops "bigger ⇒ reference"
 * from being a rule. This is matched-by-construction and leakcheck flags it as such.
 */
export function matchProfile(target, pool, used, want = {}) {
  let best = null, bestD = Infinity;
  for (const c of pool) {
    if (used.has(c.id)) continue;
    const p = c.profile || (c.profile = profile(c.text));
    const dw = relDiff(target.words, p.words);
    const dc = relDiff(target.chars, p.chars);
    const dd = relDiff(target.density, p.density);
    if (dw > TOL.words || dc > TOL.chars || dd > TOL.density) continue;
    let ok = true;
    for (const [k, s] of Object.entries(want)) {
      if (!s) continue;
      if (Math.sign(target[k] - p[k]) !== s) { ok = false; break; }
    }
    if (!ok) continue;
    const d = dw + dc + dd;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ------------------------------------------------------------------------------------------------
// THE QUESTION, AND THE ANSWER FORMAT
//
// r4 asked RI-MTH03 §D's quality question and demanded a single `PICK:` line. The r4 judge showed
// that one line cannot express it. The question presupposes shipped ⇒ better; in this pack the
// shipped-RPG passages are repeatedly the WEAKER writing (quest-log telemetry, alphabetised topic
// dumps, verbatim duplicate lines) while the other side is assured prose. So on most trials the two
// halves of the question have OPPOSITE answers, and one line has to throw one away.
//
// The two prior judges then "disagreed" on 14 of 15 rows — one scored 15/15 picking the reference,
// the other 1/15 — while agreeing about every single passage. They answered different questions and
// the pack recorded it as disagreement. That is a whole round lost to an answer format.
//
// So: TWO axes, scored separately.
//   PROV: which side is the shipped-RPG text.   -> this is the LEAK DETECTOR. High PROV with
//                                                  chance QUAL means the blinding is broken.
//   QUAL: which side is the better writing.     -> this is the ITEM's question, and the only one
//                                                  RI-MTH03 §E's picked-ours row should fire on.
const QUESTION = {
  books: 'two passages of in-world book prose',
  dialogue: 'two sets of spoken NPC dialogue lines',
  journal: 'two sets of quest-journal entries',
};

const PROMPT = (kind, n, packName, total) => `# Blind comparison — W1-PROSE-TICS, trial ${n} of ${total} (${kind})

You are judging ${QUESTION[kind]}. You do **not** know where either came from and you must not try
to find out from anything but the words: file size, encoding, formatting and metadata are not
evidence and using them is cheating.

**Every proper noun on both sides has been replaced with an INVENTED name**, drawn from one
generator shared by both sides, consistent within a passage and unrelated between passages. No name
you read is the name the author wrote, on either side. Two rounds of this comparison were decided
without reading a word — once by counting setting names, once by counting the \`[NAME-n]\` tokens
that were supposed to fix that — so **names carry no information here and reasoning about them is
reasoning about the masking code.** Do not try to reconstruct them.

**Artifacts**
- \`A.txt\`
- \`B.txt\`

**Kind:** text (${kind} register)
**Piece under review:** W1-PROSE-TICS

## The two questions

Answer **both**, separately. They are not the same question and on this material they frequently
have opposite answers — that is the finding, not a mistake.

1. **\`PROV:\`** — which of the two is the work of a game writer for a shipped RPG, and which is
   placeholder? This is a provenance question.
2. **\`QUAL:\`** — which of the two is the better piece of writing, judged as writing? This is the
   question the piece is actually being scored on.

If your two answers differ, say so plainly and say why. A judge who reports high confidence on
\`PROV:\` and a coin-flip on \`QUAL:\` is telling the builder that the blinding is broken, which is
worth more than either answer alone.

## How to answer

Write your answer to \`../../${packName}.answers/<your-agent-id>/${'${trial-dir}'}.md\` — **outside the pack**,
in your own directory. Do **not** write into this directory: a previous round of this comparison
ended up with fifteen plaintext answer files sitting in the folder the prompt told the next judge
to work in, which is an answer key with a friendly filename.

Your answer must contain, in order:

1. \`PROV: A\` or \`PROV: B\` — one line, nothing else on it.
2. \`QUAL: A\` or \`QUAL: B\` — one line, nothing else on it.
3. \`CONFIDENCE: high | medium | low\` (state which axis it applies to if they differ)
4. Three to six bullet points of **specific, checkable evidence** — quoted lines, counted
   constructions, named habits. No general impressions, no "it feels modern".
5. \`WEAKEST POINT:\` one sentence naming the strongest argument *against* your own pick.

Do not hedge, do not decline, do not say the two are equivalent. If they genuinely read as
equivalent, that is itself a finding — pick the one that is marginally more suspect and say so.

## What your score will and will not mean

Both sides are drawn from **one author each**. Recognise the voice in one trial and the rest sort
themselves, so ${total} trials carry roughly **${'as many bits as there are registers'}** — three, not ${total}.
**A clean sweep is about 1-in-8 by chance, not 1-in-${2 ** 15}.** Any number taken from this pack must
be quoted with that baseline. Say in your answer if you found yourself voice-matching rather than
judging; the r4 judge did, and it was the most useful line in its verdict.

**Answer all trials before looking at any mapping.** A judge who peeks at one reveal has
contaminated the rest. The mapping lives in \`../../${packName}.reveal/\` and is not yours to open
until every answer is written.
`;

// ------------------------------------------------------------------------------------------------

function selfTest() {
  console.log('build-r2-packs --self-test');
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };

  const r1 = mulberry32(7); const r2 = mulberry32(7);
  t(r1() === r2(), 'the PRNG is seeded and reproducible');
  t(mulberry32(7)() !== mulberry32(8)(), 'and a different seed gives a different stream');
  const p = pick(mulberry32(1), [1, 2, 3, 4, 5], 3);
  t(p.length === 3 && new Set(p).size === 3, 'pick() returns n distinct items');

  console.log('\n  pairing — the channel r4 matched on words alone and lost on chars and density');
  const mk = (id, text) => ({ id, text });
  const target = profile('Aa bb cc dd ee ff gg hh ii jj.');
  const pool = [
    mk('same', 'Kk ll mm nn oo pp qq rr ss tt.'),
    mk('longer', 'Kk ll mm nn oo pp qq rr ss tt uu vv ww xx yy zz aa bb cc dd ee ff gg hh.'),
  ];
  t(matchProfile(target, pool, new Set()).id === 'same', 'matchProfile picks the nearest legal partner');
  t(matchProfile(target, pool, new Set(['same'])) === null,
    'and returns NULL rather than an out-of-tolerance partner — a trial with no legal partner is dropped, not shipped');
  const dense = mk('dense', 'He met Ravik and Solmar and Kethan and Orun and Vekhu today.');
  const sparse = profile('He met the reeve and the clerk and the porter and the smith now.');
  t(matchProfile(sparse, [dense], new Set()) === null,
    'a name-dense passage is NOT paired with a name-sparse one of the same length (capital_density 14/15 in r4)');

  console.log('\n  the prompt — the four defects the r4 pack shipped');
  const pr = PROMPT('books', 1, 'prose-tics-r5', 15);
  t(/PROV:/.test(pr) && /QUAL:/.test(pr), 'the prompt asks BOTH axes, so provenance and quality cannot be silently conflated');
  t(!/^PICK:/m.test(pr), 'and no longer offers a single PICK: line that cannot express the question');
  t(/prose-tics-r5\.reveal/.test(pr) && !/prose-tics-r[1-4]\.reveal/.test(pr),
    'the reveal pointer names THIS pack (r4 pointed all fifteen prompts at r2\'s key)');
  t(/answers\//.test(pr) && !/write your answer to `?answer\.md`? in this directory/i.test(pr),
    'answers are directed OUTSIDE the pack (r4 accumulated fifteen plaintext answer files inside it)');
  t(/1-in-8/.test(pr) && /not 1-in-32768/.test(pr), 'the real chance baseline is stated in the prompt');
  t(!/em dash|contraction|Morrowind|Vvardenfell|exclamation/.test(pr),
    'and the prompt still names neither the rule, the tell, nor the two corpora');

  console.log('\n  masking — no marker exists to count');
  const ref = 'The Nerevarine came to Balmora. Dagoth Ur is served by his seven kin, called ash '
    + 'vampires by the Ashlanders of Vvardenfell.';
  const our = 'The clerk came up from Lilmoth. The Xul-Aneekh will not say so, and Gideon is far.';
  const npool = makeNamePool(1);
  const mr = renameText(ref, properNounsAcross([{ text: ref }]), mulberry32(3), npool);
  const mo = renameText(our, properNounsAcross([{ text: our }]), mulberry32(4), npool);
  t((mr.text.match(REDACTION_RE) || []).length === 0 && (mo.text.match(REDACTION_RE) || []).length === 0,
    'neither side carries a redaction marker — the r4 channel does not exist to be counted');
  t(settingNounAudit(mr.text).length === 0 && settingNounAudit(mo.text).length === 0,
    'and the r1 setting-noun rule is clean on both');
  t(settingNounAudit(ref).length > 0, '  (control: the SAME audit is red on the unmasked text, so it is not inert)');

  console.log('\n  residue — the hard stop that keeps wiki markup out of the pool');
  t(RESIDUE.test('he first volume|OBlink=OB:Brief History of the Empire, v 1'), 'residue detector RED on the template that opened r1 t01');
  t(!RESIDUE.test('The road runs east.'), 'and quiet on clean prose');

  console.log(bad ? `\nSELF-TEST FAILED (${bad})` : '\nself-test passed');
  return bad ? 1 : 0;
}

// ------------------------------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const seed = Number(argv[argv.indexOf('--seed') + 1]) || 20260810;
  const outRel = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/packs/prose-tics-r5';
  const only = argv.includes('--register') ? argv[argv.indexOf('--register') + 1] : null;
  const perReg = Number(argv[argv.indexOf('--per-register') + 1]) || 5;
  const out = path.join(ROOT, outRel);
  const reveal = path.join(ROOT, outRel + '.reveal');
  const packName = path.basename(outRel);
  const COMMIT = headCommit();

  const ours = ourCorpus();
  const ref = referenceCorpus();
  const rng = mulberry32(seed);
  const namePool = makeNamePool(seed ^ 0x9e3779b9);

  // Each side's proper-noun vocabulary, gathered from that side alone, so the two sets never
  // inform each other. This is what closes the "name that only ever opens a sentence" hole.
  const oursNames = properNounsAcross([...ours.books, ...ours.dialogue, ...ours.journal]);
  const refNames = properNounsAcross([...ref.books, ...ref.dialogue.slice(0, 20000), ...ref.journal]);
  console.log(`name vocabulary: ours ${oursNames.size}, reference ${refNames.size}`);

  const touched = new Set();
  const rdir = path.join(ROOT, 'reports/prose-tics/rewrites');
  for (const f of fs.readdirSync(rdir)) {
    if (!f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(rdir, f), 'utf8').split('\n')) {
      if (!line.trim() || line.trim().startsWith('//')) continue;
      touched.add(JSON.parse(line).file);
    }
  }

  // Over-sample documents this run actually edited, in every register the run edited, so the judge
  // is shown the work and not the untouched corpus. (A books-only version of this once nearly
  // handed a judge dialogue bundles assembled from lines nobody had edited.)
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
  const dropped = [];
  let n = 0;
  for (const [kind, getOurs, getRef] of REG) {
    if (only && kind !== only) continue;
    let mine = getOurs(ours);
    if (kind === 'books') {
      const hit = mine.filter((d) => touched.has(d.file));
      if (hit.length >= perReg) mine = hit;
    }
    // Wiki residue is a hard stop, not a warning: r1 shipped `MWlink=Morrowind:Dagoth Ur (god)`
    // inside a pack. Anything still showing markup is simply not eligible.
    const theirs = getRef(ref).filter((d) => !RESIDUE.test(d.text));

    const used = new Set();
    let placed = 0;
    // shuffle our candidates and walk until `perReg` of them find a legal partner.
    // The wanted SIGNS alternate so that "denser side is the reference" and "longer side is the
    // reference" are each true about half the time by construction, not by luck.
    for (const m of pick(rng, mine, mine.length)) {
      if (placed >= perReg) break;
      const target = profile(m.text);
      const want = { density: placed % 2 ? 1 : -1, chars: (placed >> 1) % 2 ? 1 : -1 };
      const partner = matchProfile(target, theirs, used, want)
        // second choice: keep the density balance, let the length sign fall where it may
        || matchProfile(target, theirs, used, { density: want.density })
        || matchProfile(target, theirs, used);
      if (!partner) { dropped.push({ kind, id: m.id, why: 'no reference passage inside tolerance' }); continue; }
      used.add(partner.id);
      placed++; n++;

      const oursIsA = rng() < 0.5;
      const dirName = `t${String(n).padStart(2, '0')}-${kind}`;
      const dir = path.join(out, dirName);
      fs.mkdirSync(dir, { recursive: true });

      // RE-NAME both sides with the same function and the same shared pool, seeded per passage so
      // a name in one trial cannot be matched against the same name in another.
      const mineMasked = renameText(m.text, oursNames, mulberry32(seed + n * 7919), namePool);
      const theirsMasked = renameText(partner.text, refNames, mulberry32(seed + n * 104729), namePool);
      const aText = oursIsA ? mineMasked.text : theirsMasked.text;
      const bText = oursIsA ? theirsMasked.text : mineMasked.text;

      // fail-closed, per side, before anything is written
      for (const [label, txt] of [['A', aText], ['B', bText]]) {
        const leaks = settingNounAudit(txt);
        const markers = txt.match(REDACTION_RE) || [];
        if (leaks.length || markers.length) {
          console.error(`build-r2-packs: REFUSING to write trial ${n} — ${label}.txt carries `
            + `${leaks.length} setting noun(s)/residue and ${markers.length} redaction marker(s) after masking:`);
          console.error('  ' + [...new Set([...leaks, ...markers])].slice(0, 12).join(', '));
          console.error('  Fix the masker. Do not lower the audit.');
          process.exit(3);
        }
      }
      fs.writeFileSync(path.join(dir, 'A.txt'), aText + '\n');
      fs.writeFileSync(path.join(dir, 'B.txt'), bText + '\n');
      fs.writeFileSync(path.join(dir, 'PROMPT.md'),
        PROMPT(kind, n, packName, perReg * REG.length).replace('${trial-dir}', dirName));
      fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({
        schema: 'elder-souls/blind-pack@2',
        trial: n,
        register: kind,
        kind: 'text',
        piece: 'W1-PROSE-TICS',
        built_by: 'the BUILDER of W1-PROSE-TICS, who does not answer these',
        answers_go_in: `../../${packName}.answers/<agent-id>/`,
        masking: 'proper nouns RE-NAMED (not redacted) from one shared generator; no marker to count',
        paired_on: ['words', 'chars', 'proper-noun density'],
        chance_baseline: 'one author per side: effective trials ~= registers (3). A sweep is ~1-in-8.',
        corpus_commit: COMMIT,
        a_profile: profile(aText),
        b_profile: profile(bText),
        seed,
      }, null, 2) + '\n');

      mapping.push({
        trial: n, dir: dirName, register: kind,
        ours: oursIsA ? 'A' : 'B', ours_id: m.id, ref_id: partner.id,
        name_map_ours: mineMasked.map, name_map_ref: theirsMasked.map,
      });
    }
    if (placed < perReg) console.warn(`  ${kind}: only ${placed}/${perReg} trials had a legal partner`);
  }

  fs.writeFileSync(path.join(reveal, 'mapping.json'), JSON.stringify({
    schema: 'elder-souls/blind-pack-reveal@2',
    piece: 'W1-PROSE-TICS',
    seed,
    corpus_commit: COMMIT,
    rebuild: `node tools/prose/build-r2-packs.mjs --out ${outRel} --seed ${seed}  (exact only at corpus_commit)`,
    do_not_open_until: 'every answer is written, outside the pack',
    dropped_for_no_legal_partner: dropped,
    trials: mapping,
  }, null, 2) + '\n');

  fs.mkdirSync(path.join(ROOT, outRel + '.answers'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, outRel + '.answers', 'README.md'),
    `# ${packName} — answers\n\nOne directory per judge: \`<agent-id>/tNN-<register>.md\`.\n\n`
    + `Answers live HERE and never inside the pack. \`prose-tics-r4\` accumulated fifteen plaintext\n`
    + `answer files inside its own trial directories, in the exact filename its PROMPT told the next\n`
    + `judge to create — an answer key that a judge would \`cat\` before writing, to check it was not\n`
    + `clobbering something. Same structural argument that already puts \`.reveal/\` outside the pack.\n`);

  fs.writeFileSync(path.join(out, 'README.md'), `# W1-PROSE-TICS — blind pack \`${packName}\`

${n} trials across **books**, **dialogue**, **journal**. Each trial pairs one of our passages with
one from the reference corpus. Side randomised on a seeded shuffle (seed \`${seed}\`).

**Built by the piece's builder, answered by nobody who built it** (RULES.md 25). Answers go in
\`../${packName}.answers/<agent-id>/\`; the key is in \`../${packName}.reveal/\`.

## What this round changed, and why

**1. Proper nouns are RE-NAMED, not redacted.** Two previous rounds were decided without reading a
word: r1 by counting setting names, r4 by counting the \`[NAME-n]\` tokens introduced to fix r1.
There is no marker in this pack to count. The cost is real and is stated in
\`tools/blind/mask-text.mjs\`: **the text is altered, not merely redacted**, so nothing about names
is judgeable here.

**2. Passages are paired on proper-noun density and character count, not word count alone.** r4
matched on words — and the gate scores \`words\` at chance on that pack while \`chars\` scores 15/15
and \`capital_density\` 14/15. The cost is a selection bias, stated once: this pack samples the
band where the two corpora are mechanically comparable, so its verdict does not generalise to the
name-saturated end of the reference corpus.

**3. The pack was gated before any judge saw it.** \`node tools/blind/leakcheck.mjs --pack
${outRel}\` runs ~40 mechanical discriminators and refuses the pack if any decides it. Its output
for this pack is in \`../${packName}.reveal/leakcheck.json\` — including every rule that scored at
chance, which is the point.

**4. Two answer axes, not one.** \`PROV:\` (which is the shipped-RPG text) and \`QUAL:\` (which is
the better writing). In r4 two judges "disagreed" on 14 of 15 rows while agreeing about every
passage, because a single \`PICK:\` line could not say which question they had answered.

## The baseline, before anyone quotes a score

One author per side. Recognise the voice once and the rest sort themselves, so ${n} trials carry
roughly as many bits as there are registers. **A clean sweep is about 1-in-8 by chance, not
1-in-${2 ** 15}.** Quote 1-in-8.

## Also worth running

\`\`\`
node tools/blind/leakcheck.mjs --self-test
node tools/blind/mask-text.mjs --self-test
node tools/check-prose.mjs --self-test
node tools/prose/tic-detector.mjs --self-test
\`\`\`
`);

  console.log(`built ${n} blind trials in ${outRel} (${dropped.length} candidate(s) dropped for having no legal partner)`);
  console.log(`mapping hidden in ${outRel}.reveal/mapping.json`);

  // ---- THE GATE. Fail-closed: a pack that does not pass is not a pack. ----
  console.log('\n--- gate: node tools/blind/leakcheck.mjs --pack ' + outRel + ' ---');
  let gate = 0;
  try {
    const o = execFileSync(process.execPath, [
      path.join(ROOT, 'tools/blind/leakcheck.mjs'), '--pack', outRel,
      '--json', path.join(outRel + '.reveal', 'leakcheck.json'),
    ], { cwd: ROOT, encoding: 'utf8' });
    console.log(o);
  } catch (e) {
    gate = e.status || 1;
    console.log(e.stdout || '');
    console.error(e.stderr || '');
  }
  if (gate) {
    console.error(`\nbuild-r2-packs: THE GATE FAILED (exit ${gate}). The pack is written but MUST NOT be judged.`);
    console.error('Nothing measured through a decidable pack means anything. Fix the builder or drop the register.');
    return 3;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
