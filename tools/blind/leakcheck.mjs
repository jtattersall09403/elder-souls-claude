#!/usr/bin/env node
// tools/blind/leakcheck.mjs — the gate that must pass BEFORE a blind pack is handed to a judge.
//
// WHY THIS EXISTS
// ---------------
// Round 1 of W1-PROSE-TICS shipped a pack decidable by counting the word "Vvardenfell": 17/17,
// no reading. The fix was a masker that replaced every proper noun with `[NAME-n]`. Round 4's
// judge then found that COUNTING THE `[NAME-n]` TOKENS decides the pack 15/15, margins 1.6x-7x,
// median ~3.5x — one shell command, no domain knowledge. The mask verified what it CONTAINED and
// leaked through how many tokens it ADDED.
//
// That is the same defect twice, and both times it was found by a judge AFTER the scores were
// taken, which makes every score through that pack uninterpretable — including the flattering
// ones. So the check moves in front of the judge and becomes fail-closed.
//
// WHAT IT IS
// ----------
// A battery of cheap mechanical discriminators. Each one is a statistic over a single file. For
// every trial it computes the statistic on both sides, picks the larger, and is scored against the
// reveal key. A discriminator that names the reference side far more often than chance is a
// channel through which the pack can be decided without reading a word.
//
// IT REPORTS EVERY RULE, NOT JUST THE HITS. The judge that found the `[NAME-n]` leak pre-declared
// four candidate channels and reported that TWO OF THEM FAILED when scored (9/15 and 5/15, at or
// below chance) as plainly as the one that hit. A battery that only ever prints hits is one nobody
// can trust, because you cannot tell a detector from a rubber stamp. Every rule appears in the
// table with its score, every time.
//
// GOODHART, AND WHY THE BATTERY IS SPLIT IN TWO
// ---------------------------------------------
// The pack builder pairs passages to minimise some of these same statistics. A gate you optimise
// against stops being evidence — pass it by construction and it tells you nothing. So every rule
// declares `matched`:
//
//   * `matched: true`  — the builder actively pairs on this statistic. A pass here is BY
//                        CONSTRUCTION and is reported as such. It is not evidence of blindness.
//   * `matched: false` — held out. The builder never sees it. A pass here IS evidence.
//
// The two blocks are printed separately and the summary never conflates them.
//
// THE BASELINE IS NOT 1-IN-270
// ----------------------------
// With one author per side, fifteen trials do not carry fifteen bits. The r4 judge measured this:
// recognise the voice once and sort the remaining fourteen by matching it. Effective independent
// trials are closer to the number of REGISTERS than to the number of trials — three, not fifteen —
// so chance gets a clean sweep about one time in eight, not one in 32768. The gate prints the
// register-blocked score next to the raw one and the header says which to quote.
//
// USAGE
//   node tools/blind/leakcheck.mjs --pack reports/packs/<name>            # gate a built pack
//   node tools/blind/leakcheck.mjs --pack <name> --json out.json          # machine-readable
//   node tools/blind/leakcheck.mjs --pack <name> --waive redaction_tokens:"reason"
//   node tools/blind/leakcheck.mjs --self-test                            # prove the gate works
//
// EXIT CODES
//   0  no unwaived leak — the pack may be dispatched
//   3  at least one channel decides the pack; DO NOT dispatch a judge
//   4  structural defect (answer key inside the pack, reveal pointer wrong, key missing)
//   1  usage / IO error

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ------------------------------------------------------------------------------------------------
// small numeric helpers

function logChoose(n, k) {
  let r = 0;
  for (let i = 1; i <= k; i++) r += Math.log(n - k + i) - Math.log(i);
  return r;
}
/** P(X >= k) for X ~ Binomial(n, 1/2). Exact, via logs, fine for n up to a few thousand. */
export function binomTail(k, n) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let s = 0;
  for (let i = k; i <= n; i++) s += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, s);
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------------------------------------
// text primitives used by the statistics. Deliberately dumb: everything here is something a person
// with a shell and no knowledge of Elder Scrolls, Black Marsh or English prose could compute.

const WORD_RE = /[\p{L}][\p{L}\p{M}'’-]*/gu;
const SENT_SPLIT = /(?<=[.!?…])["'”’)\]]*\s+/;

const words = (t) => t.match(WORD_RE) || [];
const lines = (t) => t.split('\n');
/** Sentences, split at terminal punctuation AND at line breaks — a line without a full stop is
 *  still a unit, and treating it as a continuation is what let the old masker mistake every
 *  capitalised line-opener for a proper noun. */
export function sentences(t) {
  const out = [];
  for (const line of lines(t)) for (const s of line.split(SENT_SPLIT)) if (s.trim()) out.push(s.trim());
  return out;
}
const count = (t, re) => (t.match(re) || []).length;
const per1k = (n, t) => (t.length ? (1000 * n) / t.length : 0);
const perKw = (n, t) => { const w = words(t).length; return w ? (1000 * n) / w : 0; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

/** Tokens capitalised somewhere that is NOT the opening of a sentence, a line, a quotation, a
 *  parenthesis or a clause after `:` `;` `--`. This is the "how many names does this passage
 *  carry" statistic, and it is the one that survives re-naming: you no longer count `[NAME-n]`,
 *  you count capitals. It is held OUT of nothing — the builder pairs on it, so it is `matched`. */
export function midSentenceCapitals(t) {
  let n = 0;
  for (const s of sentences(t)) {
    // strip a leading run of openers so `"Nevertheless` and `(Perhaps` count as sentence-initial
    const body = s.replace(/^[\s"'“”‘’(\[\-—–*#>]+/, '');
    const toks = body.match(WORD_RE) || [];
    for (let i = 1; i < toks.length; i++) {
      const prev = body.slice(0, body.indexOf(toks[i]));
      void prev;
      if (/^\p{Lu}/u.test(toks[i])) n++;
    }
  }
  return n;
}
export function distinctCapitalised(t) {
  const s = new Set();
  for (const w of words(t)) if (/^\p{Lu}/u.test(w) && w !== 'I') s.add(w.toLowerCase());
  return s.size;
}
/** Any bracketed all-caps marker: `[NAME-3]`, `[REDACTED]`, `<NAME>`, `{{NAME}}`. The channel
 *  round 4 died of. */
export const REDACTION_RE = /\[[A-Z][A-Z0-9_]*(?:-\d+)?\]|<[A-Z][A-Z0-9_]*(?:-\d+)?>|\{\{[A-Z][A-Z0-9_]*(?:-\d+)?\}\}/g;

function longestRepeatedSentence(t) {
  const seen = new Map();
  let best = 0;
  for (const s of sentences(t)) {
    const k = s.replace(/\s+/g, ' ').toLowerCase();
    if (k.length < 40) continue;
    const c = (seen.get(k) || 0) + 1;
    seen.set(k, c);
    if (c > 1) best = Math.max(best, k.length);
  }
  return best;
}
function alphaSortedness(t) {
  const heads = sentences(t).map((s) => (s.match(WORD_RE) || [''])[0].toLowerCase()).filter(Boolean);
  if (heads.length < 3) return null;
  let asc = 0;
  for (let i = 1; i < heads.length; i++) if (heads[i] >= heads[i - 1]) asc++;
  return asc / (heads.length - 1);
}

// ------------------------------------------------------------------------------------------------
// THE BATTERY
//
// Every rule: { id, group, matched, describe, stat, probe }
//   stat(text) -> number | null      null == this rule abstains on this file
//   probe {more, less}               MANDATORY. --self-test asserts stat(more) > stat(less).
//                                    A rule with no probe, or a probe that does not move it, is an
//                                    inert probe and the self-test refuses to ship it. (RULES.md 4)
//
// `matched: true` means the pack builder pairs on this statistic, so a pass is by construction.

const P = (more, less) => ({ more, less });

export const STATS = [
  // ---- what the machinery ADDS. This is the round-4 leak. Held out: the builder does not pair
  // on it, because after the fix there are no redaction tokens at all and a nonzero count here is
  // itself the alarm.
  {
    id: 'redaction_tokens', group: 'redaction', matched: false,
    describe: 'count of bracketed redaction markers ([NAME-3], [REDACTED], <NAME>)',
    stat: (t) => count(t, REDACTION_RE),
    probe: P('He met [NAME-1] and [NAME-2] at the gate.', 'He met the clerk at the gate.'),
  },
  {
    id: 'redaction_density', group: 'redaction', matched: false,
    describe: 'redaction markers per 1000 words',
    stat: (t) => perKw(count(t, REDACTION_RE), t),
    probe: P('[NAME-1] saw [NAME-2].', 'The reeve saw the clerk and the whole of the assembled court besides.'),
  },
  {
    id: 'redaction_distinct', group: 'redaction', matched: false,
    describe: 'distinct redaction ids in the file',
    stat: (t) => new Set(t.match(REDACTION_RE) || []).size,
    probe: P('[NAME-1] [NAME-2] [NAME-3]', '[NAME-1] [NAME-1] [NAME-1]'),
  },

  // ---- what the CORPORA differ on. The builder pairs on these, so a pass is by construction.
  {
    id: 'words', group: 'size', matched: true,
    describe: 'word count',
    stat: (t) => words(t).length,
    probe: P('one two three four five', 'one two'),
  },
  {
    id: 'chars', group: 'size', matched: true,
    describe: 'character count',
    stat: (t) => t.length,
    probe: P('aaaaaaaaaa', 'aa'),
  },
  {
    id: 'mid_sentence_capitals', group: 'names', matched: true,
    describe: 'capitalised tokens not opening a sentence, line, quote or clause (proper-noun load)',
    stat: (t) => midSentenceCapitals(t),
    probe: P('The road runs to Ghal and then to Vekhu and on to Sarim.', 'The road runs east and then north and on to the sea.'),
  },
  {
    id: 'capital_density', group: 'names', matched: true,
    describe: 'proper-noun load per 1000 words',
    stat: (t) => perKw(midSentenceCapitals(t), t),
    probe: P('He saw Ghal and Vekhu.', 'He saw the man who kept the register and said nothing at all about any of it.'),
  },
  {
    id: 'distinct_capitalised', group: 'names', matched: true,
    describe: 'distinct capitalised word forms',
    stat: (t) => distinctCapitalised(t),
    probe: P('Ghal met Vekhu and Sarim and Orun.', 'Ghal met Ghal and Ghal and Ghal.'),
  },

  // ---- held out from here down. The builder never optimises any of these.
  {
    id: 'sentences', group: 'shape', matched: false,
    describe: 'sentence count',
    stat: (t) => sentences(t).length || null,
    probe: P('One. Two. Three. Four.', 'One and two and three and four.'),
  },
  {
    id: 'mean_sentence_words', group: 'shape', matched: false,
    describe: 'mean words per sentence',
    stat: (t) => { const s = sentences(t); return s.length ? mean(s.map((x) => words(x).length)) : null; },
    probe: P('A very long sentence indeed with a great many words in it and no stop until here.', 'Short. Short. Short.'),
  },
  {
    id: 'sd_sentence_words', group: 'shape', matched: false,
    describe: 'standard deviation of sentence length',
    stat: (t) => { const s = sentences(t); return s.length > 2 ? sd(s.map((x) => words(x).length)) : null; },
    probe: P('Yes. A sentence with considerably more words in it than the one before it had. No.', 'One two three. One two three. One two three.'),
  },
  {
    id: 'mean_word_len', group: 'shape', matched: false,
    describe: 'mean word length in characters',
    stat: (t) => { const w = words(t); return w.length ? mean(w.map((x) => x.length)) : null; },
    probe: P('administrative jurisdiction constituted', 'a b c'),
  },
  {
    id: 'vocab_size', group: 'vocab', matched: false,
    describe: 'distinct lowercased word forms',
    stat: (t) => new Set(words(t).map((w) => w.toLowerCase())).size,
    probe: P('alpha beta gamma delta epsilon', 'alpha alpha alpha alpha alpha'),
  },
  {
    id: 'type_token_ratio', group: 'vocab', matched: false,
    describe: 'distinct forms / total tokens',
    stat: (t) => { const w = words(t); return w.length ? new Set(w.map((x) => x.toLowerCase())).size / w.length : null; },
    probe: P('alpha beta gamma delta', 'alpha alpha alpha alpha'),
  },
  {
    id: 'hapax_ratio', group: 'vocab', matched: false,
    describe: 'share of word forms occurring exactly once',
    stat: (t) => {
      const w = words(t).map((x) => x.toLowerCase());
      if (!w.length) return null;
      const c = new Map(); for (const x of w) c.set(x, (c.get(x) || 0) + 1);
      return [...c.values()].filter((n) => n === 1).length / c.size;
    },
    probe: P('alpha beta gamma delta', 'alpha alpha beta beta'),
  },
  {
    id: 'long_word_ratio', group: 'vocab', matched: false,
    describe: 'share of words longer than 8 characters',
    stat: (t) => { const w = words(t); return w.length ? w.filter((x) => x.length > 8).length / w.length : null; },
    probe: P('administrative jurisdiction constituted', 'the cat sat on the mat'),
  },
  {
    id: 'comma_density', group: 'punct', matched: false,
    describe: 'commas per 1000 characters',
    stat: (t) => per1k(count(t, /,/g), t),
    probe: P('a, b, c, d, e, f', 'a b c d e f'),
  },
  {
    id: 'semicolon_density', group: 'punct', matched: false,
    describe: 'semicolons per 1000 characters',
    stat: (t) => per1k(count(t, /;/g), t),
    probe: P('a; b; c; d', 'a b c d'),
  },
  {
    id: 'colon_density', group: 'punct', matched: false,
    describe: 'colons per 1000 characters',
    stat: (t) => per1k(count(t, /:/g), t),
    probe: P('one: two: three', 'one two three'),
  },
  {
    id: 'question_density', group: 'punct', matched: false,
    describe: 'question marks per 1000 characters',
    stat: (t) => per1k(count(t, /\?/g), t),
    probe: P('Who? What? Why?', 'Who. What. Why.'),
  },
  {
    id: 'exclamation_density', group: 'punct', matched: false,
    describe: 'exclamation marks per 1000 characters',
    stat: (t) => per1k(count(t, /!/g), t),
    probe: P('Stop! Go! Now!', 'Stop. Go. Now.'),
  },
  {
    id: 'dash_density', group: 'punct', matched: false,
    describe: 'em/en dashes and double hyphens per 1000 characters',
    stat: (t) => per1k(count(t, /—|–|--/g), t),
    probe: P('a — b — c', 'a, b, c'),
  },
  {
    id: 'quote_density', group: 'punct', matched: false,
    describe: 'quotation marks of any kind per 1000 characters',
    stat: (t) => per1k(count(t, /["“”]/g), t),
    probe: P('He said "yes" and "no" and "wait".', 'He agreed and refused and waited.'),
  },
  {
    id: 'apostrophe_density', group: 'punct', matched: false,
    describe: "apostrophes per 1000 characters",
    stat: (t) => per1k(count(t, /['’]/g), t),
    probe: P("don't can't won't", 'do not cannot will not'),
  },
  {
    id: 'ellipsis_density', group: 'punct', matched: false,
    describe: 'ellipses per 1000 characters',
    stat: (t) => per1k(count(t, /\.\.\.|…/g), t),
    probe: P('well ... perhaps ... no', 'well perhaps no'),
  },
  {
    id: 'paren_density', group: 'punct', matched: false,
    describe: 'parentheses and brackets per 1000 characters',
    stat: (t) => per1k(count(t, /[()[\]]/g), t),
    probe: P('a (b) c [d]', 'a b c d'),
  },
  {
    id: 'lines', group: 'layout', matched: false,
    describe: 'line count',
    stat: (t) => lines(t).length,
    probe: P('a\nb\nc\nd', 'a b c d'),
  },
  {
    id: 'blank_line_ratio', group: 'layout', matched: false,
    describe: 'share of lines that are blank',
    stat: (t) => { const l = lines(t); return l.length ? l.filter((x) => !x.trim()).length / l.length : null; },
    probe: P('a\n\nb\n\nc', 'a\nb\nc'),
  },
  {
    id: 'mean_line_len', group: 'layout', matched: false,
    describe: 'mean characters per non-blank line',
    stat: (t) => { const l = lines(t).filter((x) => x.trim()); return l.length ? mean(l.map((x) => x.length)) : null; },
    probe: P('aaaaaaaaaaaaaaaaaaaa', 'a\na\na'),
  },
  {
    id: 'trailing_ws_lines', group: 'layout', matched: false,
    describe: 'lines ending in whitespace',
    stat: (t) => lines(t).filter((x) => /\s$/.test(x) && x.trim()).length,
    probe: P('a  \nb  \n', 'a\nb\n'),
  },
  {
    id: 'double_space_after_stop', group: 'layout', matched: false,
    describe: 'occurrences of two spaces after a full stop',
    stat: (t) => count(t, /[.!?]  +/g),
    probe: P('One.  Two.  Three.', 'One. Two. Three.'),
  },
  {
    id: 'tab_count', group: 'layout', matched: false,
    describe: 'tab characters',
    stat: (t) => count(t, /\t/g),
    probe: P('a\tb\tc', 'a b c'),
  },
  {
    id: 'non_ascii_ratio', group: 'charclass', matched: false,
    describe: 'share of characters outside ASCII (curly quotes, accents, dashes)',
    stat: (t) => (t.length ? [...t].filter((c) => c.charCodeAt(0) > 127).length / t.length : null),
    probe: P('“yes” — he said, don’t', '"yes" - he said, don\'t'),
  },
  {
    id: 'digit_ratio', group: 'charclass', matched: false,
    describe: 'share of characters that are digits',
    stat: (t) => (t.length ? count(t, /\d/g) / t.length : null),
    probe: P('12 of 340 in 1998', 'twelve of three hundred'),
  },
  {
    id: 'uppercase_ratio', group: 'charclass', matched: false,
    describe: 'share of letters that are uppercase',
    stat: (t) => { const l = t.match(/\p{L}/gu) || []; return l.length ? l.filter((c) => /\p{Lu}/u.test(c)).length / l.length : null; },
    probe: P('THE ROAD RUNS EAST', 'the road runs east'),
  },
  {
    id: 'allcaps_words', group: 'artefact', matched: false,
    describe: 'ALL-CAPS words of 3+ letters (headings, shouted stage directions)',
    stat: (t) => count(t, /\b\p{Lu}{3,}\b/gu),
    probe: P('CHAPTER ONE. The road runs east.', 'Chapter one. The road runs east.'),
  },
  {
    id: 'opens_lowercase', group: 'artefact', matched: false,
    describe: 'file begins with a lowercase letter (a truncated extraction)',
    stat: (t) => (/^\s*\p{Ll}/u.test(t) ? 1 : 0),
    probe: P('he wind blew over the plain.', 'The wind blew over the plain.'),
  },
  {
    id: 'repeated_sentence', group: 'artefact', matched: false,
    describe: 'length of the longest sentence appearing verbatim more than once',
    stat: (t) => longestRepeatedSentence(t),
    probe: P('I have slain the beast and this will make my task more difficult now. I have slain the beast and this will make my task more difficult now.',
             'I have slain the beast. The task is now harder than it was before, by some way.'),
  },
  {
    id: 'alpha_sortedness', group: 'ordering', matched: false,
    describe: 'share of adjacent sentences whose opening words are in non-decreasing alphabetical order',
    stat: (t) => alphaSortedness(t),
    probe: P('Alpha runs. Beta runs. Gamma runs. Delta runs.', 'Zebra runs. Alpha runs. Yak runs. Beta runs.'),
  },
  {
    id: 'contraction_density', group: 'register', matched: false,
    describe: "contractions (n't, 'll, 're, 've, 'd, 's) per 1000 words",
    stat: (t) => perKw(count(t, /\w['’](?:t|ll|re|ve|d|s|m)\b/gi), t),
    probe: P("I don't know and I won't say and I'm not going.", 'I do not know and I will not say and I am not going.'),
  },
];

const STAT_IDS = new Set(STATS.map((s) => s.id));

// ------------------------------------------------------------------------------------------------
// scoring

/**
 * Classify a rule's result.
 *
 * THE THRESHOLD IS CALIBRATED AGAINST THE NULL, NOT CHOSEN. Two earlier versions of this function
 * were wrong and L3 of the self-test caught both, which is the whole reason L3 exists.
 *
 *   v1 flagged on raw accuracy alone (>=80% of >=8 decided trials). Measured against 60 null packs
 *      it raised at least one LEAK on 35% of them. With 40 rules and 15 trials that is roughly 1.4
 *      false alarms per pack by arithmetic, and a gate that fails a third of clean packs is a gate
 *      that gets ignored, which is the same as no gate.
 *   v2 added "and the rule must win inside every register", on the theory that a real channel
 *      sweeps and a chance artefact concentrates. Measured: **still 35%.** A rule scoring 12/15 is
 *      usually 4/5 in each register anyway, so the extra condition was very nearly implied by the
 *      first and bought nothing. It is kept in the OUTPUT as information and dropped from the
 *      decision, because a condition that never changes an answer is decoration.
 *
 * v3, here, is the ordinary multiple-comparison correction and nothing cleverer: a rule is a LEAK
 * when its exact binomial tail survives Bonferroni over the size of the battery
 * (p_raw * family <= 0.05), and a WATCH when it clears the uncorrected 0.05. On 15 decided trials
 * that means 14/15 flags, 12-13/15 watches, 11/15 is chance — and the pack-level false-alarm rate
 * is ~5% by construction rather than by hope. The measured rate is printed by --self-test every
 * run, so if the battery grows and the correction stops holding, that number moves and the ceiling
 * assertion fails.
 *
 * WATCH is not a pass. It is the band where 15 trials with one author per side cannot tell a
 * channel from luck, and the honest response to a WATCH is to look at it, not to ship past it.
 */
export const FAMILY_ALPHA = 0.05;

export function classify(decided, hits, blocksWon = 1, blocksDecided = 1, family = 1) {
  const best = Math.max(hits, decided - hits);
  const acc = decided ? best / decided : 0;
  void blocksWon; void blocksDecided;              // reported, deliberately not decided on — see v2
  if (decided < 5) return { level: 'CHANCE', acc, best };
  const p = binomTail(best, decided);
  if (p * family <= FAMILY_ALPHA) return { level: 'LEAK', acc, best };
  if (p <= FAMILY_ALPHA) return { level: 'WATCH', acc, best };
  return { level: 'CHANCE', acc, best };
}

/**
 * trials: [{ id, register, a, b, refSide }]  — refSide is 'A' or 'B'
 * returns { rules: [...], sideBalance, registers }
 */
export function scoreBattery(trials, statList = STATS) {
  const registers = [...new Set(trials.map((t) => t.register || '-'))];
  const rules = statList.map((rule) => {
    let decided = 0, hits = 0;
    const perTrial = [];
    const byReg = new Map(registers.map((r) => [r, { d: 0, h: 0 }]));
    for (const t of trials) {
      let sa, sb;
      try { sa = rule.stat(t.a); sb = rule.stat(t.b); } catch { sa = null; sb = null; }
      if (sa == null || sb == null || !Number.isFinite(sa) || !Number.isFinite(sb) || sa === sb) {
        perTrial.push({ trial: t.id, pick: null, sa, sb });
        continue;
      }
      const pick = sa > sb ? 'A' : 'B';
      decided++;
      const hit = pick === t.refSide;
      if (hit) hits++;
      const r = byReg.get(t.register || '-'); r.d++; if (hit) r.h++;
      perTrial.push({ trial: t.id, pick, sa, sb, hit });
    }
    // register-blocked: does the rule's majority direction hold inside EVERY register?
    const dir = hits >= decided - hits ? 1 : 0;   // 1 == "larger side is the reference"
    let blocksWon = 0, blocksDecided = 0;
    for (const [, r] of byReg) {
      if (!r.d) continue;
      blocksDecided++;
      const won = dir ? r.h : r.d - r.h;
      if (won / r.d > 0.5) blocksWon++;
    }
    const { level, acc, best } = classify(decided, hits, blocksWon, blocksDecided, statList.length);
    return {
      id: rule.id, group: rule.group, matched: !!rule.matched, describe: rule.describe,
      decided, hits, best, acc, level,
      direction: dir ? 'larger ⇒ reference' : 'smaller ⇒ reference',
      p_raw: decided ? binomTail(best, decided) : 1,
      blocks: `${blocksWon}/${blocksDecided}`,
      p_blocked: blocksDecided ? binomTail(blocksWon, blocksDecided) : 1,
      perTrial,
    };
  });
  const refIsA = trials.filter((t) => t.refSide === 'A').length;
  return {
    rules,
    registers,
    sideBalance: { refIsA, n: trials.length, p: binomTail(Math.max(refIsA, trials.length - refIsA), trials.length) },
  };
}

// ------------------------------------------------------------------------------------------------
// pack IO + structural checks

function readTrialDirs(packDir) {
  return fs.readdirSync(packDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** Structural defects that make a pack unusable regardless of statistics. Each of these is a
 *  defect this project has actually shipped. */
export function structuralCheck(packDir) {
  const problems = [];
  const notes = [];
  const packName = path.basename(packDir);
  const revealDir = packDir + '.reveal';

  if (!fs.existsSync(revealDir)) problems.push(`no reveal directory at ${path.relative(ROOT, revealDir)} — the key must be a SIBLING of the pack`);
  const inside = fs.existsSync(path.join(packDir, 'mapping.json')) || fs.existsSync(path.join(packDir, `${packName}.reveal`));
  if (inside) problems.push('the reveal key is INSIDE the pack directory');

  for (const t of readTrialDirs(packDir)) {
    const dir = path.join(packDir, t);
    for (const f of fs.readdirSync(dir)) {
      // D2: two judges' answers sitting in the directory the prompt tells the next judge to write to
      if (/^answer/i.test(f)) problems.push(`${t}/${f} — an answer key in the pack. Answers belong in a sibling <pack>.answers/<judge-id>/`);
      if (/mapping|reveal|key\b/i.test(f)) problems.push(`${t}/${f} — looks like a mapping inside the pack`);
    }
    const promptPath = path.join(dir, 'PROMPT.md');
    if (!fs.existsSync(promptPath)) { problems.push(`${t}/PROMPT.md missing`); continue; }
    const prompt = fs.readFileSync(promptPath, 'utf8');
    // D3: r4's every PROMPT.md pointed at ../prose-tics-r2.reveal/ — a DIFFERENT pack's key.
    for (const m of prompt.match(/\.\.\/[A-Za-z0-9._-]+\.reveal\/?/g) || []) {
      const named = m.replace(/^\.\.\//, '').replace(/\/$/, '');
      if (named !== `${packName}.reveal`) {
        problems.push(`${t}/PROMPT.md points at ${m} — that is a DIFFERENT pack's answer key (this pack is ${packName})`);
      }
    }
    // D2 again, from the other end: the prompt must not send the judge's answer into the pack
    if (/write your answer to `?answer\.md`? in this directory/i.test(prompt)) {
      problems.push(`${t}/PROMPT.md tells the judge to write answer.md INTO the pack — that is how a pack acquires a plaintext answer key`);
    }
    if (!/PICK|PROV|QUAL/.test(prompt)) notes.push(`${t}/PROMPT.md names no answer field`);
  }
  return { problems, notes };
}

export function loadPack(packDir) {
  const revealPath = path.join(packDir + '.reveal', 'mapping.json');
  if (!fs.existsSync(revealPath)) throw new Error(`no key at ${revealPath}`);
  const reveal = JSON.parse(fs.readFileSync(revealPath, 'utf8'));
  const byDir = new Map((reveal.trials || []).map((t) => [t.dir, t]));
  const trials = [];
  for (const d of readTrialDirs(packDir)) {
    const key = byDir.get(d);
    if (!key) continue;
    const files = fs.readdirSync(path.join(packDir, d));
    const af = files.find((f) => /^A\./.test(f));
    const bf = files.find((f) => /^B\./.test(f));
    if (!af || !bf) continue;
    trials.push({
      id: d,
      register: key.register || '-',
      a: fs.readFileSync(path.join(packDir, d, af), 'utf8'),
      b: fs.readFileSync(path.join(packDir, d, bf), 'utf8'),
      refSide: key.ours === 'A' ? 'B' : 'A',
    });
  }
  return { trials, reveal };
}

// ------------------------------------------------------------------------------------------------
// report

function fmt(n) {
  if (n == null) return '   -  ';
  if (n >= 1000 || Number.isInteger(n)) return String(Math.round(n)).padStart(6);
  return n.toFixed(3).padStart(6);
}

export function report(result, { waivers = new Map(), quiet = false } = {}) {
  const out = [];
  const say = (s = '') => { out.push(s); if (!quiet) console.log(s); };

  const n = result.rules[0]?.perTrial.length || 0;
  const nreg = result.registers.length;
  say(`leakcheck — ${STATS.length} mechanical discriminators over ${n} trials in ${nreg} register(s)`);
  say('');
  say('BASELINE. With one author per side, the trials are not independent: recognise the voice once');
  say(`and the rest sort themselves. Effective independent trials ≈ the number of registers (${nreg}),`);
  say(`so a clean sweep by chance is about 1-in-${2 ** nreg}, NOT 1-in-${2 ** n}. Quote the blocked column.`);
  say('');

  const rows = (rules) => {
    say('  rule                      grp        score   acc   p(raw)  blocks p(blk)  verdict');
    say('  ' + '-'.repeat(84));
    for (const r of rules) {
      const w = waivers.get(r.id);
      const level = w && r.level === 'LEAK' ? 'WAIVED' : r.level;
      const mark = level === 'LEAK' ? '  <<< LEAK' : level === 'WATCH' ? '  <-- watch' : level === 'WAIVED' ? '  (waived)' : '';
      say(`  ${r.id.padEnd(25)} ${(r.group || '').padEnd(10)} ${String(r.best).padStart(2)}/${String(r.decided).padStart(2)}  ${r.acc.toFixed(2)}  ${r.p_raw.toExponential(1).padStart(7)}  ${r.blocks.padStart(5)} ${r.p_blocked.toFixed(3)}  ${level}${mark}`);
      if (w) say(`      waiver: ${w}`);
    }
    say('');
  };

  const held = result.rules.filter((r) => !r.matched).sort((a, b) => b.acc - a.acc || b.decided - a.decided);
  const matched = result.rules.filter((r) => r.matched).sort((a, b) => b.acc - a.acc || b.decided - a.decided);

  say('HELD OUT — the builder never optimises these, so a pass here is EVIDENCE.');
  rows(held);
  say('MATCHED BY CONSTRUCTION — the builder pairs passages on these. A pass here is NOT evidence,');
  say('it is the design working; a FAILURE here means the matching did not hold.');
  rows(matched);

  say(`side balance: reference is A in ${result.sideBalance.refIsA}/${result.sideBalance.n} trials (p=${result.sideBalance.p.toFixed(3)})`);
  if (result.sideBalance.p < 0.05) say('  <<< LEAK  the A/B coin is biased — a judge who always answers A beats chance');
  say('');

  const leaks = result.rules.filter((r) => r.level === 'LEAK' && !waivers.has(r.id));
  const waived = result.rules.filter((r) => r.level === 'LEAK' && waivers.has(r.id));
  const watch = result.rules.filter((r) => r.level === 'WATCH');
  const chance = result.rules.filter((r) => r.level === 'CHANCE');

  say(`SUMMARY: ${leaks.length} leak(s), ${waived.length} waived, ${watch.length} watch, ${chance.length} at chance.`);
  say(`  Reported at chance (this line is the point — a battery that only prints hits is a rubber stamp):`);
  say('  ' + (chance.map((r) => `${r.id} ${r.best}/${r.decided}`).join(', ') || '(none)'));
  say('');
  say(`  The battery is deliberately over-sensitive: with ${STATS.length} rules and ${n} trials some`);
  say('  false alarms are expected. A flagged rule is a thing to fix or to waive IN WRITING, not a proof.');
  return { text: out.join('\n'), leaks, waived, watch, chance };
}

// ------------------------------------------------------------------------------------------------
// SELF-TEST
//
// Three layers, and the third is the one the brief for this repair insisted on: the leak detector
// must itself be checked for the failure it is built to detect.
//
//   L1 per-rule liveness — every rule declares a probe pair and must respond to it. A rule that
//                          cannot move is an inert probe (RULES.md 4) and must not ship.
//   L2 arms that disagree — a deliberately leaky pack MUST be caught; a clean pack MUST pass; and
//                          for every arm, removing the injection must remove the flag (RULES.md 6,
//                          delete-the-fix, run on the fixture rather than on the code).
//   L3 the detector's own failure mode — a battery that cries wolf is as useless as one that never
//                          fires. Run the null 60 times with different seeds and MEASURE the
//                          false-alarm rate. If it is above the stated ceiling the self-test fails.

const LOREM = ('road river gate hall market ledger seal rope basket water reed mud stone bridge fence '
  + 'clerk reeve porter guard smith weaver carter warden cook boy woman man child stranger '
  + 'walked carried counted signed opened waited refused agreed answered watched left arrived paid '
  + 'slow heavy quiet wide narrow damp cold early late honest careful old new small large '
  + 'because although before after while until when since though so and but or if then that which').split(' ');

function synthPassage(rng, { sentences: ns = 14 } = {}) {
  const out = [];
  for (let i = 0; i < ns; i++) {
    const len = 6 + Math.floor(rng() * 14);
    const w = [];
    for (let j = 0; j < len; j++) w.push(LOREM[Math.floor(rng() * LOREM.length)]);
    let s = w.join(' ');
    if (rng() < 0.25) s = s.replace(/ /, ', ');
    s = s[0].toUpperCase() + s.slice(1) + (rng() < 0.08 ? '?' : '.');
    out.push(s);
  }
  return out.join(' ') + '\n';
}

/** A null pack: 2N passages from ONE generator, split by a coin. Nothing systematically differs,
 *  so no rule should beat chance except by luck — which is exactly what L3 measures. */
export function synthPack(seed, n = 15) {
  const rng = mulberry32(seed);
  const regs = ['books', 'dialogue', 'journal'];
  const trials = [];
  for (let i = 0; i < n; i++) {
    const ours = synthPassage(rng);
    const ref = synthPassage(rng);
    const oursIsA = rng() < 0.5;
    trials.push({
      id: `t${String(i + 1).padStart(2, '0')}`,
      register: regs[i % regs.length],
      a: oursIsA ? ours : ref,
      b: oursIsA ? ref : ours,
      refSide: oursIsA ? 'B' : 'A',
    });
  }
  return trials;
}

/** Each injector alters ONLY the reference side and only through one channel. */
export const INJECTORS = {
  redaction_tokens: (t, rng) => t.replace(/\b(clerk|reeve|porter|guard|smith|warden)\b/g,
    () => `[NAME-${1 + Math.floor(rng() * 9)}]`),
  words: (t, rng) => t + synthPassage(rng, { sentences: 10 }),
  mid_sentence_capitals: (t) => t.replace(/\b(clerk|reeve|porter|guard|smith|warden)\b/g, 'Vekhu'),
  non_ascii_ratio: (t) => t.replace(/'/g, '’').replace(/,/g, '，'),
  digit_ratio: (t) => t.replace(/\b(water|stone|rope)\b/g, '4172'),
  repeated_sentence: (t) => { const s = sentences(t); return s.length ? t + ' ' + s[0] + ' ' + s[0] : t; },
  alpha_sortedness: (t) => sentences(t).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1).join(' ') + '\n',
  // NB: `join('\n\n')` looks like it injects blank lines and does NOT move the ratio — one blank
  // per non-blank line is 0.5, which is exactly what the single-line clean side already scores.
  // The self-test caught that: the arm was uncaught, which is an arm that was never an arm.
  blank_line_ratio: (t) => sentences(t).join('\n\n\n') + '\n',
  trailing_ws_lines: (t) => sentences(t).map((s) => s + '   ').join('\n') + '\n',
  allcaps_words: (t) => 'CHAPTER THE FIRST\n' + t.replace(/\b(ledger|market)\b/g, (m) => m.toUpperCase()),
  opens_lowercase: (t) => t[0].toLowerCase() + t.slice(1),
  double_space_after_stop: (t) => t.replace(/([.?]) /g, '$1  '),
  semicolon_density: (t) => t.replace(/\. /g, '; '),
  contraction_density: (t) => t.replace(/\b(that|which|because)\b/g, "don't"),
  type_token_ratio: (t) => t.replace(/\b\w{5,}\b/g, 'thing'),
  tab_count: (t) => t.replace(/, /g, ',\t'),
};

function injectPack(trials, injector, seed) {
  const rng = mulberry32(seed ^ 0x5bf03635);
  return trials.map((t) => {
    const refText = t.refSide === 'A' ? t.a : t.b;
    const hurt = injector(refText, rng);
    return { ...t, a: t.refSide === 'A' ? hurt : t.a, b: t.refSide === 'B' ? hurt : t.b };
  });
}

function selfTest() {
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };
  console.log('leakcheck --self-test');

  // ---------- L1: every rule must be alive ----------
  console.log('\nL1 — per-rule liveness (an inert probe is worse than no probe, RULES.md 4)');
  let dead = 0;
  for (const r of STATS) {
    if (!r.probe) { console.log(`  FAIL  ${r.id} declares no probe`); bad++; dead++; continue; }
    const more = r.stat(r.probe.more), less = r.stat(r.probe.less);
    const ok = more != null && less != null && more > less;
    if (!ok) { console.log(`  FAIL  ${r.id} does not respond to its own probe (${more} vs ${less})`); bad++; dead++; }
  }
  t(dead === 0, `all ${STATS.length} rules respond to their declared probe`);
  t(new Set(STATS.map((s) => s.id)).size === STATS.length, 'rule ids are unique');
  t(STATS.some((s) => s.matched) && STATS.some((s) => !s.matched), 'the battery is split into matched and held-out blocks');

  // ---------- L2: arms that genuinely disagree ----------
  console.log('\nL2 — arms that disagree: a leaky pack must be caught, a clean pack must pass');
  const SEED = 20260808;
  const clean = synthPack(SEED);
  const cleanRes = scoreBattery(clean);
  const cleanRep = report(cleanRes, { quiet: true });
  t(cleanRep.leaks.length === 0, `CLEAN arm passes the gate (0 leaks; ${cleanRep.chance.length}/${STATS.length} at chance)`);

  let caught = 0, armCount = 0;
  for (const [id, inj] of Object.entries(INJECTORS)) {
    armCount++;
    const leaky = injectPack(clean, inj, SEED);
    const res = scoreBattery(leaky);
    const rep = report(res, { quiet: true });
    const flagged = rep.leaks.map((r) => r.id);
    const hit = flagged.includes(id);
    if (hit) caught++;
    t(hit, `LEAKY arm "${id}" is caught (${flagged.length} rule(s) fired: ${flagged.slice(0, 4).join(', ')}${flagged.length > 4 ? ', …' : ''})`);
    // delete-the-fix on the fixture: remove the injection, the flag must go away. If it does not,
    // the arm was never the cause and the detection is an accident.
    const cleanFlag = cleanRep.leaks.some((r) => r.id === id);
    t(!cleanFlag, `  and "${id}" does NOT fire on the same pack with the injection removed (control is not inert)`);
    // and the two arms must genuinely differ, not both be the positive arm
    t(rep.leaks.length > cleanRep.leaks.length, `  and the two arms disagree (${rep.leaks.length} leaks vs ${cleanRep.leaks.length})`);
  }
  t(caught === armCount, `every one of the ${armCount} injected channels was caught`);

  // an injected leak must also survive the register-blocking view — otherwise the blocked column
  // is decorative
  const rb = scoreBattery(injectPack(clean, INJECTORS.redaction_tokens, SEED)).rules.find((r) => r.id === 'redaction_tokens');
  t(rb.blocks === '3/3', 'the register-blocked column moves too (redaction leak wins in all 3 registers)');

  // ---------- L3: the detector's own failure mode ----------
  console.log('\nL3 — the detector checked for the failure it is built to detect');
  console.log('     (a battery that only ever reports hits is a rubber stamp; measure the null)');
  let packsWithLeak = 0, totalLeaks = 0, totalWatch = 0;
  const N = 60;
  const byRule = new Map();
  for (let i = 0; i < N; i++) {
    const rep = report(scoreBattery(synthPack(1000 + i * 7)), { quiet: true });
    if (rep.leaks.length) packsWithLeak++;
    totalLeaks += rep.leaks.length;
    totalWatch += rep.watch.length;
    for (const r of rep.leaks) byRule.set(r.id, (byRule.get(r.id) || 0) + 1);
  }
  const fpPack = packsWithLeak / N;
  const fpRule = totalLeaks / (N * STATS.length);
  console.log(`     ${N} null packs: ${packsWithLeak} raised >=1 LEAK (${(100 * fpPack).toFixed(0)}%),`
    + ` ${totalLeaks} leak-flags and ${totalWatch} watch-flags over ${N * STATS.length} rule-evaluations`
    + ` (per-rule false-alarm ${(100 * fpRule).toFixed(2)}%).`);
  if (byRule.size) console.log('     noisiest rules on the null: '
    + [...byRule].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}/${N}`).join(', '));
  t(fpPack <= 0.12, `null false-alarm rate ${(100 * fpPack).toFixed(0)}% is at or under the 12% ceiling (the gate does not cry wolf)`);

  // the converse of L3: the detector must not be silently unable to fire. Prove sensitivity is
  // real by measuring detection on the null-plus-one-channel, which is the arm above, and by
  // checking the classifier's own arithmetic.
  const K = STATS.length;
  t(classify(15, 15, 3, 3, K).level === 'LEAK', 'classify: 15/15 is a leak (survives Bonferroni over the battery)');
  t(classify(15, 14, 3, 3, K).level === 'LEAK', 'classify: 14/15 is a leak');
  t(classify(15, 13, 3, 3, K).level === 'WATCH', 'classify: 13/15 is a WATCH — 40 rules on 15 trials cannot call that a channel');
  t(classify(15, 12, 3, 3, K).level === 'WATCH', 'classify: 12/15 is a watch');
  t(classify(15, 11, 3, 3, K).level === 'CHANCE', 'classify: 11/15 is chance');
  t(classify(15, 8, 3, 3, K).level === 'CHANCE', 'classify: 8/15 is chance');
  t(classify(15, 0, 3, 3, K).level === 'LEAK', 'classify: 0/15 is a leak too — an inverted rule is still a rule');
  t(classify(4, 4, 1, 1, K).level === 'CHANCE', 'classify: 4/4 decided trials is too few to flag anything');
  t(classify(15, 15, 3, 3, 1).level === 'LEAK', 'classify: with a one-rule battery the correction vanishes and 15/15 still flags');
  t(classify(15, 12, 3, 3, 1).level === 'LEAK', 'classify: ... and 12/15 becomes a leak, because there is nothing to correct for');
  t(Math.abs(binomTail(15, 15) - Math.pow(0.5, 15)) < 1e-12, 'binomTail(15,15) = 2^-15');
  t(Math.abs(binomTail(0, 15) - 1) < 1e-12, 'binomTail(0,15) = 1');

  // ---------- structural checks go red on the real defects ----------
  console.log('\nL4 — structural checks, against the four defects r4 actually shipped');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leakcheck-selftest-'));
  const pk = path.join(tmp, 'demo');
  fs.mkdirSync(path.join(pk, 't01-books'), { recursive: true });
  fs.mkdirSync(pk + '.reveal', { recursive: true });
  fs.writeFileSync(path.join(pk + '.reveal', 'mapping.json'), '{"trials":[]}');
  const good = '# trial\nAnswers go in `../demo.answers/<judge-id>/`.\nPROV: A\nQUAL: A\nThe mapping lives in `../demo.reveal/`.\n';
  fs.writeFileSync(path.join(pk, 't01-books', 'PROMPT.md'), good);
  fs.writeFileSync(path.join(pk, 't01-books', 'A.txt'), 'a\n');
  fs.writeFileSync(path.join(pk, 't01-books', 'B.txt'), 'b\n');
  t(structuralCheck(pk).problems.length === 0, 'structural check is QUIET on a well-formed pack');

  fs.writeFileSync(path.join(pk, 't01-books', 'PROMPT.md'), good.replace('../demo.reveal/', '../prose-tics-r2.reveal/'));
  t(structuralCheck(pk).problems.some((p) => /DIFFERENT pack/.test(p)), 'and RED on a PROMPT pointing at another pack\'s key (defect D3)');

  fs.writeFileSync(path.join(pk, 't01-books', 'PROMPT.md'), good);
  fs.writeFileSync(path.join(pk, 't01-books', 'answer.md'), 'PICK: A\n');
  t(structuralCheck(pk).problems.some((p) => /answer key in the pack/.test(p)), 'and RED on an answer key sitting inside the pack (defect D2)');

  fs.rmSync(path.join(pk, 't01-books', 'answer.md'));
  fs.writeFileSync(path.join(pk, 't01-books', 'PROMPT.md'), good + '\nWrite your answer to `answer.md` in this directory.\n');
  t(structuralCheck(pk).problems.some((p) => /INTO the pack/.test(p)), 'and RED on a PROMPT that tells the judge to write answer.md into the pack');

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(bad ? `\nSELF-TEST FAILED (${bad})` : '\nself-test passed');
  return bad ? 1 : 0;
}

// ------------------------------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const pi = argv.indexOf('--pack');
  if (pi < 0) {
    console.error('usage: node tools/blind/leakcheck.mjs --pack <dir> [--json out] [--waive id:reason]\n'
      + '       node tools/blind/leakcheck.mjs --self-test');
    return 1;
  }
  const packDir = path.resolve(ROOT, argv[pi + 1]);
  const waivers = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--waive') continue;
    const [id, ...rest] = (argv[i + 1] || '').split(':');
    if (!STAT_IDS.has(id)) { console.error(`--waive: no such rule "${id}"`); return 1; }
    if (!rest.join(':').trim()) { console.error(`--waive ${id}: a waiver without a written reason is not a waiver`); return 1; }
    waivers.set(id, rest.join(':').trim());
  }

  // Structural problems do not short-circuit the battery: a pack with an answer key in it is
  // unjudgeable AND may also be decidable, and a builder fixing one wants to see the other in the
  // same run. Both are reported; the exit code takes the worse of the two.
  const st = structuralCheck(packDir);
  if (st.problems.length) {
    console.log(`STRUCTURAL DEFECTS in ${path.relative(ROOT, packDir)} — the pack cannot be judged as it stands:`);
    for (const p of st.problems) console.log('  * ' + p);
    console.log('');
  }
  for (const n of st.notes) console.log('note: ' + n);

  let pack;
  try { pack = loadPack(packDir); } catch (e) { console.error(String(e.message)); return 4; }
  if (!pack.trials.length) { console.error('no trials found (does the reveal mapping name the trial directories?)'); return 4; }

  const result = scoreBattery(pack.trials);
  const rep = report(result, { waivers });

  const ji = argv.indexOf('--json');
  if (ji >= 0) {
    fs.writeFileSync(path.resolve(ROOT, argv[ji + 1]), JSON.stringify({
      pack: path.relative(ROOT, packDir),
      trials: pack.trials.length,
      registers: result.registers,
      effective_trials: result.registers.length,
      chance_sweep: `1-in-${2 ** result.registers.length}`,
      side_balance: result.sideBalance,
      rules: result.rules.map(({ perTrial, ...r }) => r),
      leaks: rep.leaks.map((r) => r.id),
      waived: [...waivers],
      pass: rep.leaks.length === 0,
    }, null, 2) + '\n');
  }

  if (rep.leaks.length) {
    console.log('\nGATE FAILED. Do not dispatch a judge: this pack is decidable without reading it.');
    console.log('Fix the builder, or waive the channel IN WRITING with --waive <id>:"<reason>".');
    return st.problems.length ? 4 : 3;
  }
  if (st.problems.length) {
    console.log('\nGATE FAILED on structure (above). No channel beat the battery, but the pack is still unjudgeable.');
    return 4;
  }
  console.log('\nGATE PASSED on the held-out channels. This is necessary, not sufficient:');
  console.log('RI-MTH03 M6 (a fresh agent asked "what is the tell?") is still owed once per wave.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
