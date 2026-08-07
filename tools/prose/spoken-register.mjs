#!/usr/bin/env node
// spoken-register.mjs — the dialogue-voice half of W1-PROSE-TICS.
//
// WHY THIS EXISTS AND WHY IT IS A SEPARATE TOOL
// ---------------------------------------------------------------------------------------------
// tic-detector.mjs left one thing standing. In the dialogue register, RULE-36 (contraction
// avoidance) separates our NPC lines from Morrowind's at 0.844 balanced accuracy: ours 212.21
// "do not / is not / cannot" per 10,000 words against their 21.39, while we use contractions at
// 16.6 per 10k against their 326.81. Morrowind's NPCs talk. Ours read aloud.
//
// The tempting fix is one line of sed. `s/do not/don't/` would take RULE-36 from 9.9x to about
// parity in a second, without changing one word of the writing — the same move as respelling an
// em dash as `--`, which this piece has already caught itself being offered once.
//
// So this tool exists to make that move detectable. Every rule it carries is tagged
// `contraction_blind`. A blind rule is one that a contraction swap CANNOT move, by construction:
// nominalisation density, sentence-initial conjunctions, discourse openers, front-loaded
// subordinate clauses, sentence length. The self-test asserts exactly that — it applies a pure
// mechanical contraction swap to a corpus and requires that every blind rule measures IDENTICALLY
// afterwards, and that the non-blind controls move. If someone later "fixes" the voice with a
// regex, the non-blind rules go green, the blind rules do not move, and the gap between the two
// is the lie, printed as `BLIND-GAP` in the summary.
//
// Rules are loaded from rules.spoken-register.pre-registered.json, which was written and hashed
// BEFORE any measurement (sha256 in the output). 18 rules; all 18 are reported.
//
// Usage:
//   node tools/prose/spoken-register.mjs                 measure and print
//   node tools/prose/spoken-register.mjs --json out.json write the full measurement
//   node tools/prose/spoken-register.mjs --by-source     per-file breakdown of our side
//   node tools/prose/spoken-register.mjs --examples ID   print our lines that fire rule ID
//   node tools/prose/spoken-register.mjs --self-test     break it on purpose, assert it goes red
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  words, sentences, ourCorpus, referenceCorpus, measure, separation, bundle, zTest,
} from './tic-detector.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const RULES_FILE = path.join(HERE, 'rules.spoken-register.pre-registered.json');
const BUNDLE_WORDS = 250;

// ---------------------------------------------------------------------------------------------
// rules

export function loadSpokenRules(file = RULES_FILE) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    meta: raw,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    rules: raw.rules.map((r) => ({
      ...r,
      kind: r.metric ? 'metric' : 'match',
      test: r.metric ? null : new RegExp(r.re, r.flags),
    })),
  };
}

// countRule in tic-detector keys metrics off rule.name starting with "mean"; SR-18 is
// `metric: "mean_sentence_words"` with a name that does not, so it is counted here instead.
function count(rule, text) {
  if (rule.kind === 'metric') {
    const ss = sentences(text).map(words);
    if (!ss.length) return 0;
    return ss.reduce((a, b) => a + b, 0) / ss.length;
  }
  const re = new RegExp(rule.test.source, rule.test.flags.includes('g') ? rule.test.flags : rule.test.flags + 'g');
  const m = text.match(re);
  return m ? m.length : 0;
}

function measureRule(rule, docs) {
  if (rule.kind === 'metric') {
    const vals = [];
    let w = 0;
    for (const d of docs) { const dw = words(d.text); if (!dw) continue; w += dw; vals.push(count(rule, d.text)); }
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { metric: true, value: mean, docs: docs.length, words: w };
  }
  return measure({ ...rule, kind: 'match' }, docs);
}

// ---------------------------------------------------------------------------------------------
// THE MOVE THIS TOOL EXISTS TO CATCH.
// A purely mechanical contraction swap: no word order changes, no clause changes, nothing a
// reader would call rewriting. Used by --self-test as the mutation, and never used on shipped
// text by anything in this repo.
export function mechanicalContract(s) {
  return String(s)
    .replace(/\bdo not\b/g, "don't").replace(/\bDo not\b/g, "Don't")
    .replace(/\bdoes not\b/g, "doesn't").replace(/\bDoes not\b/g, "Doesn't")
    .replace(/\bdid not\b/g, "didn't").replace(/\bDid not\b/g, "Didn't")
    .replace(/\bis not\b/g, "isn't").replace(/\bIs not\b/g, "Isn't")
    .replace(/\bare not\b/g, "aren't").replace(/\bAre not\b/g, "Aren't")
    .replace(/\bwas not\b/g, "wasn't").replace(/\bWas not\b/g, "Wasn't")
    .replace(/\bwere not\b/g, "weren't").replace(/\bWere not\b/g, "Weren't")
    .replace(/\bwould not\b/g, "wouldn't").replace(/\bWould not\b/g, "Wouldn't")
    .replace(/\bcould not\b/g, "couldn't").replace(/\bCould not\b/g, "Couldn't")
    .replace(/\bwill not\b/g, "won't").replace(/\bWill not\b/g, "Won't")
    .replace(/\bhave not\b/g, "haven't").replace(/\bHave not\b/g, "Haven't")
    .replace(/\bhas not\b/g, "hasn't").replace(/\bHas not\b/g, "Hasn't")
    .replace(/\bcannot\b/g, "can't").replace(/\bCannot\b/g, "Can't");
}

// ---------------------------------------------------------------------------------------------
// run

export function runSpoken({ ourDocs, refDocs, rules }) {
  const ob = bundle(ourDocs, BUNDLE_WORDS);
  const rb = bundle(refDocs, BUNDLE_WORDS);
  const rows = [];
  for (const rule of rules) {
    const o = measureRule(rule, ob);
    const r = measureRule(rule, rb);
    if (rule.kind === 'metric') {
      rows.push({
        id: rule.id, name: rule.name, contraction_blind: !!rule.contraction_blind, prior: rule.prior,
        metric: true, ours: o.value, ref: r.value, ratio: r.value ? o.value / r.value : null,
      });
      continue;
    }
    const sep = separation(o, r);
    // DIRECTION MATTERS AND THE FIRST VERSION OF THIS SUMMARY GOT IT WRONG.
    // separation() scores the classifier "this rule fires => ours". A rule Morrowind uses far MORE
    // than we do therefore scores BELOW 0.5 — and the first run of this tool read that as "does not
    // separate" and reported a blind-gap of +0.271. It is the opposite: bAcc 0.178 means
    // "fires => MORROWIND" is right 82.2% of the time, which is a strong separator pointing the
    // other way, and the rules that expose our dialogue worst all point that way. The honest
    // statistic is direction-agnostic.
    const sepStrength = Math.max(sep.balanced_accuracy, 1 - sep.balanced_accuracy);
    rows.push({
      id: rule.id, name: rule.name, contraction_blind: !!rule.contraction_blind, prior: rule.prior,
      metric: false,
      ours_per10k: o.per10k, ref_per10k: r.per10k,
      ratio: r.per10k ? o.per10k / r.per10k : (o.per10k ? Infinity : null),
      ours_presence_pct: o.presence_pct, ref_presence_pct: r.presence_pct,
      ours_hits: o.hits, ref_hits: r.hits,
      accuracy: sep.accuracy, baseline: sep.baseline, lift: sep.lift,
      balanced_accuracy: sep.balanced_accuracy,
      separation: sepStrength,
      direction: sep.balanced_accuracy >= 0.5 ? 'ours-more' : 'morrowind-more',
      z: zTest(o, r),
    });
  }
  // The headline for a blind/non-blind split: the strongest SEPARATION in each half, in either
  // direction. Using raw balanced accuracy here was the bug described above.
  const best = (pred) => rows.filter((x) => !x.metric && pred(x))
    .reduce((a, b) => (a && a.separation >= b.separation ? a : b), null);
  const blind = best((x) => x.contraction_blind);
  const notBlind = best((x) => !x.contraction_blind);
  return {
    schema: 'elder-souls/spoken-register@1',
    our_bundles: ob.length, ref_bundles: rb.length,
    our_words: ourDocs.reduce((a, d) => a + words(d.text), 0),
    ref_words: refDocs.reduce((a, d) => a + words(d.text), 0),
    rows,
    summary: {
      best_non_blind: notBlind && { id: notBlind.id, separation: notBlind.separation, direction: notBlind.direction, ratio: notBlind.ratio },
      best_blind: blind && { id: blind.id, separation: blind.separation, direction: blind.direction, ratio: blind.ratio },
      blind_gap: blind && notBlind ? notBlind.separation - blind.separation : null,
      blind_gap_means:
        'How much MORE the best contraction-movable rule separates than the best rule a contraction '
        + 'swap cannot touch. It is the price of the shortcut: a gap near zero means a mechanical '
        + 'do-not->dont pass would buy almost nothing, because an equally strong separator survives '
        + 'it untouched. A large positive gap would mean the shortcut really would have worked, and '
        + 'the honest fix would still be to rewrite rather than respell.',
    },
  };
}

// ---------------------------------------------------------------------------------------------
// self-test — break the thing it measures on purpose

function assert(cond, msg) {
  console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${msg}`);
  return cond ? 1 : 0;
}

async function selfTest() {
  let ok = 1;
  const { rules, sha256, meta } = loadSpokenRules();

  ok &= assert(rules.length === 18, `18 rules loaded (got ${rules.length})`);
  ok &= assert(meta.written_before_measurement === true, 'rule file declares pre-registration');
  ok &= assert(!!meta.amendment_v2, 'the v2 amendment is declared in the rule file, not hidden');
  ok &= assert(rules.filter((r) => r.contraction_blind).length === 13,
    `13 of them are contraction-blind (got ${rules.filter((r) => r.contraction_blind).length})`);

  // --- the central assertion: blind means blind.
  const doc = (i, t) => ({ id: `d${i}`, text: t });
  const written = [
    'I do not know. The administration is not in a position to make a determination.',
    'It cannot be said that the arrangement was not understood by the parties.',
    'She did not answer, and the commission has not published its findings.',
    'They are not permitted here, although the exemption was not withdrawn.',
  ];
  const swapped = written.map(mechanicalContract);
  ok &= assert(swapped[0].includes("don't") && !swapped[0].includes('do not'),
    'the mechanical swap actually swaps');

  const A = written.map((t, i) => doc(i, t));
  const B = swapped.map((t, i) => doc(i, t));
  let blindMoved = 0; let nonBlindMoved = 0;
  for (const r of rules) {
    const a = measureRule(r, A); const b = measureRule(r, B);
    const va = r.kind === 'metric' ? a.value : a.hits;
    const vb = r.kind === 'metric' ? b.value : b.hits;
    if (r.contraction_blind) { if (Math.abs(va - vb) > 1e-9) { blindMoved++; console.log(`      moved: ${r.id} ${va} -> ${vb}`); } }
    else if (va !== vb) nonBlindMoved++;
  }
  ok &= assert(blindMoved === 0, `a pure contraction swap moves ZERO blind rules (moved ${blindMoved})`);
  ok &= assert(nonBlindMoved >= 2, `and it does move the non-blind controls (moved ${nonBlindMoved} of 3)`);

  // --- a real rewrite must move the blind rules, or the blind rules are inert.
  const spoken = [
    "Don't know. Nobody up the office will say yes or no, and I'm not asking twice.",
    'Well — nobody said it out loud, but everyone signed.',
    "And she never answered. So the board sat on it. That's where it is now.",
    "Look, they can't be here. But the paper says they can. Go ask the clerk.",
  ].map((t, i) => doc(i, t));
  let blindMovedOnRewrite = 0;
  for (const r of rules) {
    if (!r.contraction_blind) continue;
    const a = measureRule(r, A); const b = measureRule(r, spoken);
    const va = r.kind === 'metric' ? a.value : a.hits;
    const vb = r.kind === 'metric' ? b.value : b.hits;
    if (Math.abs(va - vb) > 1e-9) blindMovedOnRewrite++;
  }
  ok &= assert(blindMovedOnRewrite >= 4,
    `an actual rewrite DOES move the blind rules (moved ${blindMovedOnRewrite}) — so they are not inert`);

  // --- separation must degrade when the reference is infected, not just when ours changes.
  const clean = Array.from({ length: 40 }, (_, i) => doc(i, 'The boat came in on the tide and the crew went up the boards.'));
  const tic = Array.from({ length: 40 }, (_, i) => doc(i, 'The administration does not consider the determination to be a determination.'));
  const nomin = rules.find((r) => r.id === 'SR-09');
  const s1 = separation(measureRule(nomin, tic), measureRule(nomin, clean));
  const s2 = separation(measureRule(nomin, tic), measureRule(nomin, [...clean.slice(0, 20), ...tic.slice(0, 20)]));
  ok &= assert(s1.balanced_accuracy === 1 && s2.balanced_accuracy < s1.balanced_accuracy,
    `separation degrades when the reference is infected (${s1.balanced_accuracy.toFixed(3)} -> ${s2.balanced_accuracy.toFixed(3)})`);

  // --- a rule that fires on neither side must score 0.50, not 1.00.
  const dead = rules.find((r) => r.id === 'SR-10');
  const sd = separation(measureRule(dead, clean), measureRule(dead, clean));
  ok &= assert(Math.abs(sd.balanced_accuracy - 0.5) < 1e-9,
    `a rule firing on neither side scores 0.50 not 1.00 (got ${sd.balanced_accuracy.toFixed(3)})`);

  // --- no rule may fire on ordinary neutral prose. NOT "The dog." — that IS a two-word sentence
  // and SR-14 is right to fire on it; the first version of this assertion was wrong, not SR-14.
  const neutral = [doc(0, 'The boat came in on the tide and the crew went up the boards to the shed.')];
  const fired = rules.filter((r) => r.kind !== 'metric' && measureRule(r, neutral).hits > 0).map((r) => r.id);
  ok &= assert(fired.length === 0, `no rule fires on a neutral declarative (fired: ${fired.join(',') || 'none'})`);

  // --- and SR-14 must still fire on the thing it is for.
  const sr14 = rules.find((r) => r.id === 'SR-14');
  ok &= assert(measureRule(sr14, [doc(0, 'The dog.')]).hits === 1
    && measureRule(sr14, [doc(0, 'The boat came in on the tide.')]).hits === 0,
    'SR-14 fires on a two-word sentence and not on a seven-word one');

  // --- SR-15 must be case-sensitive on "I", or it matches every stray lowercase i.
  const sr15 = rules.find((r) => r.id === 'SR-15');
  ok &= assert(measureRule(sr15, [doc(0, 'i think')]).hits === 0 && measureRule(sr15, [doc(0, 'I think')]).hits === 1,
    'SR-15 is case-sensitive on the first-person pronoun');

  // --- the real corpora must load, and must NOT be vacuous.
  const ours = ourCorpus();
  const ref = await referenceCorpus();
  ok &= assert(ours.dialogue.length > 500, `our dialogue loaded (${ours.dialogue.length} lines)`);
  ok &= assert(ref.dialogue.length > 60000, `Morrowind dialogue loaded (${ref.dialogue.length} rows)`);
  if (!ref.dialogue.length) { console.log('reference missing — refusing to pass vacuously'); process.exit(2); }

  // --- THE ASSERTION THIS TOOL IS FOR, run on the REAL shipped corpus rather than a toy one.
  // Every line of shipped dialogue is mechanically contracted and every blind rule must measure
  // identically. A toy corpus proved SR-14 and SR-18 blind when they are not; the real corpus is
  // what caught them. This runs on the live text, so it also fails if someone adds dialogue whose
  // spelling makes a blind rule gameable.
  const liveA = ours.dialogue.map((d) => ({ id: d.id, text: d.text }));
  const liveB = ours.dialogue.map((d) => ({ id: d.id, text: mechanicalContract(d.text) }));
  const drift = [];
  for (const r of rules) {
    const a = measureRule(r, liveA); const b = measureRule(r, liveB);
    const va = r.kind === 'metric' ? a.value : a.hits;
    const vb = r.kind === 'metric' ? b.value : b.hits;
    const moved = Math.abs(va - vb) > 1e-9;
    if (r.contraction_blind && moved) drift.push(`${r.id} ${va} -> ${vb}`);
  }
  ok &= assert(drift.length === 0,
    `LIVE CORPUS: a mechanical contraction swap of all ${ours.dialogue.length} shipped lines moves ZERO blind rules`
    + `${drift.length ? ` (moved: ${drift.join('; ')})` : ''}`);
  const c1 = measureRule(rules.find((r) => r.id === 'SR-01'), liveA).hits;
  const c2 = measureRule(rules.find((r) => r.id === 'SR-01'), liveB).hits;
  ok &= assert(c1 > 0 && c2 === 0,
    `and the same swap DOES annihilate SR-01 on the live corpus (${c1} -> ${c2}) — the mutation is real, not a no-op`);

  console.log(ok ? 'self-test passed' : 'SELF-TEST FAILED');
  console.log(`rules sha256 ${sha256}`);
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// cli

function fmt(rows) {
  const hdr = ['rule', 'blind', 'sep', 'dir', 'ours/10k', 'ref/10k', 'ratio', 'ours%', 'ref%', 'z', 'name'];
  console.log(`  ${hdr[0].padEnd(7)} ${hdr[1].padEnd(5)} ${hdr[2].padStart(5)} ${hdr[3].padEnd(9)} ${hdr[4].padStart(9)} ${hdr[5].padStart(8)} ${hdr[6].padStart(7)} ${hdr[7].padStart(6)} ${hdr[8].padStart(6)} ${hdr[9].padStart(6)}  ${hdr[10]}`);
  for (const r of [...rows].sort((a, b) => (b.separation || 0) - (a.separation || 0))) {
    if (r.metric) {
      console.log(`  ${r.id.padEnd(7)} ${(r.contraction_blind ? 'blind' : '-').padEnd(5)} metric          ours ${r.ours.toFixed(2)}  ref ${r.ref.toFixed(2)}  ratio ${r.ratio.toFixed(2)}   ${r.name}`);
      continue;
    }
    const rt = r.ratio === null ? 'n/a' : r.ratio === Infinity ? 'inf' : r.ratio.toFixed(1);
    console.log(`  ${r.id.padEnd(7)} ${(r.contraction_blind ? 'blind' : '-').padEnd(5)} ${r.separation.toFixed(3).padStart(5)} ${(r.direction === 'ours-more' ? 'ours+' : 'MW+').padEnd(9)} ${r.ours_per10k.toFixed(2).padStart(9)} ${r.ref_per10k.toFixed(2).padStart(8)} ${rt.padStart(7)} ${r.ours_presence_pct.toFixed(1).padStart(6)} ${r.ref_presence_pct.toFixed(1).padStart(6)} ${r.z.toFixed(1).padStart(6)}  ${r.name}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();

  const { rules, sha256 } = loadSpokenRules();
  const ours = ourCorpus();
  const ref = await referenceCorpus();

  if (argv.includes('--by-source')) {
    const NEG = rules.find((r) => r.id === 'SR-01');
    const CON = rules.find((r) => r.id === 'SR-02');
    const by = new Map();
    for (const d of ours.dialogue) {
      if (!by.has(d.file)) by.set(d.file, []);
      by.get(d.file).push(d);
    }
    console.log('  file'.padEnd(56), 'lines'.padStart(6), 'words'.padStart(7), 'neg/10k'.padStart(9), 'con/10k'.padStart(9));
    for (const [f, ds] of [...by].sort((a, b) => measureRule(NEG, b[1]).hits - measureRule(NEG, a[1]).hits)) {
      const n = measureRule(NEG, ds); const c = measureRule(CON, ds);
      console.log(`  ${f.padEnd(56)} ${String(ds.length).padStart(6)} ${String(n.words).padStart(7)} ${n.per10k.toFixed(1).padStart(9)} ${c.per10k.toFixed(1).padStart(9)}`);
    }
    return;
  }

  const exI = argv.indexOf('--examples');
  if (exI >= 0) {
    const id = argv[exI + 1];
    const rule = rules.find((r) => r.id === id);
    if (!rule) { console.error(`no rule ${id}`); process.exit(2); }
    let n = 0;
    for (const d of ours.dialogue) {
      const c = count(rule, d.text);
      if (c > 0) { console.log(`${String(c).padStart(2)}  ${d.file}  ${d.id}\n    ${d.text}`); n++; }
    }
    console.log(`\n${n} of ${ours.dialogue.length} lines fire ${id}`);
    return;
  }

  const res = runSpoken({ ourDocs: ours.dialogue, refDocs: ref.dialogue, rules });
  res.rules_sha256 = sha256;
  console.log(`== dialogue register: ours ${ours.dialogue.length} lines / ${res.our_words} words`);
  console.log(`   ref ${ref.dialogue.length} rows / ${res.ref_words} words   [bundled to ${BUNDLE_WORDS} w: ${res.our_bundles} vs ${res.ref_bundles}]`);
  fmt(res.rows);
  const s = res.summary;
  console.log(`\n  BLIND-GAP  best non-blind ${s.best_non_blind.id} sep ${s.best_non_blind.separation.toFixed(3)}`
    + `   best blind ${s.best_blind.id} sep ${s.best_blind.separation.toFixed(3)}`
    + `   gap ${s.blind_gap >= 0 ? '+' : ''}${s.blind_gap.toFixed(3)}`);
  console.log(`  rules sha256 ${sha256}`);

  const ji = argv.indexOf('--json');
  if (ji >= 0 && argv[ji + 1]) {
    fs.mkdirSync(path.dirname(path.resolve(ROOT, argv[ji + 1])), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, argv[ji + 1]), `${JSON.stringify(res, null, 2)}\n`);
    console.log(`  wrote ${argv[ji + 1]}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
