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

const PROMPT = (kind, n) => `# Blind comparison — W1-PROSE-TICS round 2, trial ${n} (${kind})

You are judging two passages of ${kind === 'books' ? 'in-world book prose' : kind === 'dialogue' ? 'spoken NPC dialogue' : 'quest-journal entries'}.
One comes from a shipped commercial RPG. One was written for a project imitating that RPG.
You do **not** know which is which and you must not try to find out from anything but the words:
file size, encoding, formatting and metadata are not evidence and using them is cheating.

**Artifacts**
- \`A.txt\`
- \`B.txt\`

**Kind:** text (${kind} register)
**Piece under review:** W1-PROSE-TICS

## The question

Which of these two is the imitation? Answer A or B and quote the lines that decided it.

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
  t(!/eleven|nobody|em dash|elder-souls|Morrowind/.test(pr),
    'PROMPT names neither the rule, the tell, nor the two corpora by name');
  t(/PICK: A/.test(pr) && /WEAKEST POINT/.test(pr), 'PROMPT still demands a pick and a self-criticism');

  console.log(bad ? 'SELF-TEST FAILED' : 'self-test passed');
  return bad ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const seed = Number(argv[argv.indexOf('--seed') + 1]) || 20260807;
  const outRel = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/packs/prose-tics-r2';
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

  const REG = [
    ['books', (o) => o.books.filter((d) => words(d.text) >= 250), (r) => r.books.filter((d) => words(d.text) >= 250)],
    ['dialogue', (o) => bundle(o.dialogue, 260), (r) => bundle(r.dialogue, 260)],
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
    const theirs = getRef(ref);
    const chosen = pick(rng, mine, 5);
    const used = new Set();
    for (const m of chosen) {
      n++;
      const partner = matchLength(words(m.text), theirs, used);
      used.add(partner.id);
      const oursIsA = rng() < 0.5;
      const dir = path.join(out, `t${String(n).padStart(2, '0')}-${kind}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'A.txt'), (oursIsA ? m.text : partner.text) + '\n');
      fs.writeFileSync(path.join(dir, 'B.txt'), (oursIsA ? partner.text : m.text) + '\n');
      fs.writeFileSync(path.join(dir, 'PROMPT.md'), PROMPT(kind, n));
      fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({
        schema: 'elder-souls/blind-pack@1',
        trial: n,
        register: kind,
        kind: 'text',
        piece: 'W1-PROSE-TICS',
        built_by: 'the BUILDER of W1-PROSE-TICS, who does not answer these',
        sampling_note: kind === 'books'
          ? 'ours is drawn only from books this run edited, so the judge sees the work'
          : 'ours is a length-matched bundle of shipped lines, sampled seeded',
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
