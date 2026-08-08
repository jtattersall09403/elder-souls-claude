#!/usr/bin/env node
// critic-w1-17 instrument 4 — SIGNPOSTING, AND THE AUTHOR'S HAND SHOWING THROUGH SIX MOUTHS.
//
//   node tools/dialogue/critic-figures.mjs
//   node tools/dialogue/critic-figures.mjs --break
//
// Two jobs, both of them things `voice-metrics.mjs` cannot reach because it measures sentence
// LENGTH and lexical diversity and nothing about what a sentence DOES.
//
// 1. SIGNPOSTING, tree-wide. `check-prose.mjs` exports `epigramKind()`, whose `echo_direction`
//    is "the closing sentence reuses a word from the line and is an imperative" — i.e. the line
//    ends by telling the player where to go. Under ARBITRATION S8/S35 that is the nearest thing
//    this corpus has to a quest marker. The builder measured 0.00 on its own new file against a
//    tree-wide 2.7 per 10k and left it there. This runs it per FILE over the whole dialogue tree
//    so the offenders are named rather than averaged away.
//
// 2. THE AUTHOR'S FINGERPRINT. RI-DLG06 asks whether six archetypes sound different. A metric
//    built on words-per-sentence says sapcutter and legionary are indistinguishable, and to the
//    ear they are not remotely alike. The reverse case is the dangerous one: a rhetorical FIGURE
//    used at the same rate in all six mouths is one writer doing six voices, and no length
//    statistic can see it. Two figures are counted, both picked by reading the corpus first:
//
//      terminal_question  the line ends by turning and asking the player something directly.
//                         Good once. As a house style it is the narrator leaning in, and in a
//                         RUMOUR — overheard gossip, not a conversation — it is also a nudge
//                         toward an action, which is signposting without an imperative.
//      antithesis         "It is not X, it is Y" / "That's not X, that's Y" / "X, not Y" —
//                         the corrective epigram. Morrowind's NPCs do this rarely; a writer
//                         landing a point does it constantly.
//
// BREAK ARM (RULES §4): --break feeds each counter a synthetic corpus that is 100% the figure it
// counts and 0% otherwise, and the rates must go to the ceiling and the floor respectively. A
// counter that cannot separate all-of-it from none-of-it is not counting.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { epigramKind } from '../check-prose.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BREAK = process.argv.includes('--break');

const sentences = (t) => String(t).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const wordsOf = (t) => (String(t).match(/[A-Za-z'’]+/g) || []).length;

const TERMINAL_Q = (t) => {
  const s = sentences(t);
  if (!s.length) return 0;
  const L = s[s.length - 1];
  if (!L.endsWith('?')) return 0;
  // Only count a question aimed at the PLAYER — second person, or a bare invitation.
  return /\b(you|your|yours)\b/i.test(L) || /^(would|will|do|did|have|has|are|is|can|could|shall|who|which|what|why|how|whose)\b/i.test(L) ? 1 : 0;
};
const ANTITHESIS = /\b(?:is|are|was|were|it['’]s|that['’]s|isn['’]t|aren['’]t)\s+not\s+[^.,;!?]{2,60}?[,.]?\s*(?:it|that|they|he|she)?\s*(?:is|are|was|were|['’]s)\s+/i;
const ANTITHESIS2 = /\bnot\s+(?:a|an|the)\s+[a-z'’\- ]{2,30},\s+(?:a|an|the)\b/i;
const antithesisCount = (t) => sentences(t).reduce((n, s) => n + ((ANTITHESIS.test(s) || ANTITHESIS2.test(s)) ? 1 : 0), 0);

// ---- collect the corpus -----------------------------------------------------------------------
/** [{ file, actor, kind, text }] */
const rows = [];
const TDIR = path.join(ROOT, 'game/data/dialogue/topics');
for (const f of fs.readdirSync(TDIR).filter((x) => x.endsWith('.json')).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(TDIR, f), 'utf8'));
  for (const t of doc.topics || []) {
    if (!t || typeof t.id !== 'string') continue;
    for (const i of t.infos || []) if (i.x) rows.push({ file: `topics/${f}`, actor: i.a || '(anyone)', kind: 'info', text: String(i.x) });
  }
}
const rum = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/dialogue/rumours.json'), 'utf8'));
for (const [s, arr] of Object.entries(rum.rumours || {})) for (const r of arr || []) {
  const x = typeof r === 'string' ? r : r && r.x; if (x) rows.push({ file: 'rumours.json', actor: `rumour:${s}`, kind: 'rumour', text: String(x) });
}
for (const r of rum.race_gated || []) if (r && r.x) rows.push({ file: 'rumours.json', actor: `rumour:${r.settlement}`, kind: 'rumour', text: String(r.x) });

if (BREAK) {
  rows.length = 0;
  for (let i = 0; i < 50; i++) rows.push({ file: 'ALL-FIGURE', actor: 'x', kind: 'info', text: 'The wall is old and the gate is shut. It is not a wall, it is a debt. Do you know why?' });
  for (let i = 0; i < 50; i++) rows.push({ file: 'NO-FIGURE', actor: 'x', kind: 'info', text: 'The wall is old and the gate is shut. Rain came in through the roof last winter.' });
}

// ---- tally ------------------------------------------------------------------------------------
function tally(sel) {
  const t = { entries: 0, words: 0, tq: 0, ant: 0, dir: 0, q: 0, st: 0 };
  for (const r of sel) {
    t.entries++; t.words += wordsOf(r.text);
    t.tq += TERMINAL_Q(r.text);
    t.ant += antithesisCount(r.text);
    const k = epigramKind(r.text);
    if (k === 'echo_direction') t.dir++;
    else if (k === 'echo_question') t.q++;
    else if (k === 'echo_statement') t.st++;
  }
  return t;
}
const per10k = (n, w) => (w ? 10000 * n / w : 0);
const pct = (n, e) => (e ? 100 * n / e : 0);

const groupBy = (key) => {
  const m = new Map();
  for (const r of rows) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};

console.log('critic-figures — signposting and rhetorical figure across the whole dialogue tree');
console.log(`mode: ${BREAK ? 'BREAK (synthetic all-figure / no-figure corpora)' : 'shipped'}`);
const all = tally(rows);
console.log(`corpus: ${all.entries} entries, ${all.words} words\n`);

console.log('1. SIGNPOSTING — echo_direction (a line closing on an imperative that reuses its own word)');
console.log('   per 10k words. Morrowind reference in check-prose.mjs: 1.08. Tree-wide claim: 2.7.\n');
console.log('   ' + 'file'.padEnd(34) + 'entries  words   dir/10k   ech_q/10k  ech_st/10k');
const byFile = [...groupBy('file')].map(([k, v]) => [k, tally(v)]).sort((a, b) => per10k(b[1].dir, b[1].words) - per10k(a[1].dir, a[1].words));
for (const [f, t] of byFile) {
  console.log('   ' + f.padEnd(34) + String(t.entries).padStart(6) + String(t.words).padStart(8)
    + per10k(t.dir, t.words).toFixed(2).padStart(9) + per10k(t.q, t.words).toFixed(2).padStart(11) + per10k(t.st, t.words).toFixed(2).padStart(11));
}
console.log('   ' + 'ALL'.padEnd(34) + String(all.entries).padStart(6) + String(all.words).padStart(8)
  + per10k(all.dir, all.words).toFixed(2).padStart(9) + per10k(all.q, all.words).toFixed(2).padStart(11) + per10k(all.st, all.words).toFixed(2).padStart(11));

console.log('\n   worst offending lines (echo_direction):');
let shown = 0;
for (const r of rows) {
  if (epigramKind(r.text) !== 'echo_direction') continue;
  if (shown++ >= 14) break;
  console.log(`     ${r.file} [${r.actor}]`);
  console.log(`       "${r.text.slice(0, 190)}"`);
}
console.log(`     (${rows.filter((r) => epigramKind(r.text) === 'echo_direction').length} in total)`);

console.log('\n2. THE AUTHOR\'S HAND — the same figure in every mouth');
console.log('   terminal_question: the line ends by turning and asking the player something.');
console.log('   antithesis: the "it is not X, it is Y" corrective.\n');
console.log('   ' + 'archetype / actor'.padEnd(24) + 'entries   term-Q%   antith/10k');
const ARCH = ['rootkeeper', 'magister', 'sapcutter', 'mudborn', 'legionary', 'archivist'];
for (const a of ARCH) {
  const t = tally(rows.filter((r) => r.actor === a));
  if (!t.entries) { console.log('   ' + a.padEnd(24) + '     — no lines'); continue; }
  console.log('   ' + a.padEnd(24) + String(t.entries).padStart(7) + pct(t.tq, t.entries).toFixed(1).padStart(10) + per10k(t.ant, t.words).toFixed(2).padStart(13));
}
const others = tally(rows.filter((r) => r.kind === 'info' && !ARCH.includes(r.actor)));
console.log('   ' + '(all other actors)'.padEnd(24) + String(others.entries).padStart(7) + pct(others.tq, others.entries).toFixed(1).padStart(10) + per10k(others.ant, others.words).toFixed(2).padStart(13));
const rums = tally(rows.filter((r) => r.kind === 'rumour'));
console.log('   ' + 'rumours (overheard)'.padEnd(24) + String(rums.entries).padStart(7) + pct(rums.tq, rums.entries).toFixed(1).padStart(10) + per10k(rums.ant, rums.words).toFixed(2).padStart(13));

console.log('\n   the same figure, per FILE — the number that says whose hand it is:');
console.log('   ' + 'file'.padEnd(34) + 'entries   term-Q%   antith/10k');
for (const [f, t] of [...groupBy('file')].map(([k, v]) => [k, tally(v)]).sort((a, b) => pct(b[1].tq, b[1].entries) - pct(a[1].tq, a[1].entries))) {
  console.log('   ' + f.padEnd(34) + String(t.entries).padStart(7) + pct(t.tq, t.entries).toFixed(1).padStart(10) + per10k(t.ant, t.words).toFixed(2).padStart(13));
}

if (BREAK) {
  const A = tally(rows.filter((r) => r.file === 'ALL-FIGURE')), N = tally(rows.filter((r) => r.file === 'NO-FIGURE'));
  const ok = pct(A.tq, A.entries) === 100 && pct(N.tq, N.entries) === 0 && A.ant > 0 && N.ant === 0;
  console.log(`\nBREAK ARM: all-figure term-Q ${pct(A.tq, A.entries).toFixed(0)}% / antith ${A.ant};  no-figure term-Q ${pct(N.tq, N.entries).toFixed(0)}% / antith ${N.ant}`);
  console.log(ok ? 'BREAK ARM OK — both counters separate all-of-it from none-of-it.' : 'BREAK ARM FAILED — a counter cannot tell the figure from its absence.');
  process.exit(ok ? 0 : 2);
}
process.exit(0);
