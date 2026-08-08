#!/usr/bin/env node
/**
 * critic-martial-r4-fingerprint.mjs — W1-LIBRARY-MARTIAL round-4 critic.
 *
 * WHY THIS EXISTS. The piece's own hand-off says "the critic should read the PROSE, not the
 * gate", and `tools/check-prose.mjs` is green on all seven martial files. This tool measures
 * three things check-prose does not look at, against Morrowind's OWN 241 books rather than
 * against an asserted reference:
 *
 *   F1  bare Arabic numerals per 10k words  (check-prose's RULE-06 penalises SPELLED counts
 *       four..twenty, so de-spelling is the cheapest way to make it green; that trade is
 *       invisible to every gate in the tree)
 *   F2  ALL-CAPS section headings per text  (check-prose reads sentences; a heading is not one)
 *   F3  the ", WHICH ..." appositive in headings (RULE-17/RULE-28 in prose — the same move,
 *       relocated to where the tic detector does not go)
 *
 * The Morrowind arm requires the dumped reference corpus:
 *     python3 tools/uesp/mw-book-stats.py --dump <dir>
 * and this tool EXITS NON-ZERO if that directory is absent, rather than reporting our numbers
 * with no bar beside them (RULES.md rule 24: never stub a tool to pass).
 *
 * Rule 4: run with --selftest to break the instrument on purpose and watch it go red.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BOOKS = path.join(ROOT, 'game/data/books');
const MARTIAL = new Set([
  'the-drill-book.json', 'the-arms-of-the-province.json', 'the-ford-arguments.json',
  'the-schools-and-the-quarrels.json', 'the-body-and-the-dark.json',
  'the-long-service.json', 'the-short-arms.json',
]);

// A heading: a whole line in caps, optionally numbered or roman-numeralled, at least 8 chars.
const HEADING = /^\s*(?:[IVXLC]+\.\s*|\d+\.\s*)?[A-Z][A-Z ,'’\-]{7,}[.:]?\s*$/;
// Era dates are excluded from the numeral count: "3E 391" is in-world dating, not a de-spelling.
const stripDates = (t) => t.replace(/\b[1-4]E\s*\d+/g, ' ').replace(/\bYear\s+\d+/gi, ' ');
const words = (t) => t.split(/\s+/).filter(Boolean).length;
const digits = (t) => (t.match(/(?<![\w.])\d+(?![\w])/g) || []).length;

function measure(texts) {
  let w = 0, d = 0, n = 0, withDigit = 0, withHeadings = 0, headings = 0, whichHeadings = 0;
  for (const raw of texts) {
    n++;
    const t = stripDates(raw);
    w += words(t);
    const dd = digits(t);
    d += dd;
    if (dd) withDigit++;
    const hs = raw.split(/\n+/).filter((l) => HEADING.test(l));
    if (hs.length >= 2) { withHeadings++; headings += hs.length; }
    whichHeadings += hs.filter((h) => /,\s*(WHICH|SINCE|AND|BECAUSE)\b/.test(h)).length;
  }
  return {
    texts: n, words: w,
    f1_digits_per_10k: +(d / w * 10000).toFixed(1),
    f1_texts_with_a_bare_digit_pct: +(withDigit / n * 100).toFixed(1),
    f2_texts_with_2plus_caps_headings_pct: +(withHeadings / n * 100).toFixed(1),
    f2_caps_headings_total: headings,
    f3_headings_with_which_appositive: whichHeadings,
  };
}

function ourTexts(pick) {
  const out = [];
  for (const f of fs.readdirSync(BOOKS)) {
    if (!f.endsWith('.json')) continue;
    if (pick(f) !== true) continue;
    for (const b of (JSON.parse(fs.readFileSync(path.join(BOOKS, f), 'utf8')).books || [])) {
      out.push(String(b.text || ''));
    }
  }
  return out;
}

const mwDir = process.argv.find((a) => a.startsWith('--mw='))?.slice(5);
const selftest = process.argv.includes('--selftest');

if (!mwDir || !fs.existsSync(mwDir)) {
  console.error('critic-martial-r4-fingerprint: no Morrowind reference corpus.');
  console.error('  run: python3 tools/uesp/mw-book-stats.py --dump <dir>   then pass --mw=<dir>');
  console.error('  REFUSING to print our own numbers with no bar beside them.');
  process.exit(2);
}
const mw = fs.readdirSync(mwDir).map((f) => fs.readFileSync(path.join(mwDir, f), 'utf8'));
if (mw.length < 200) { console.error(`only ${mw.length} reference books; expected 241`); process.exit(2); }

const rows = {
  'MORROWIND (241 shipped books)': measure(mw),
  'OURS — the 43 martial texts': measure(ourTexts((f) => MARTIAL.has(f))),
  'OURS — the rest of the library': measure(ourTexts((f) => !MARTIAL.has(f))),
};
if (selftest) {
  // Rule 4. Feed the martial arm the REFERENCE texts. If the instrument is real, the martial
  // row must collapse onto the Morrowind row; if it stays high, it is measuring nothing.
  rows['SELFTEST — martial arm fed reference text'] = measure(mw);
}
for (const [k, v] of Object.entries(rows)) console.log(k.padEnd(34), JSON.stringify(v));

const ours = rows['OURS — the 43 martial texts'];
const ref = rows['MORROWIND (241 shipped books)'];
const ratio = +(ours.f1_digits_per_10k / ref.f1_digits_per_10k).toFixed(1);
console.log(`\nF1 numeral ratio ours:Morrowind = ${ratio}x`);
console.log(`F2 caps-heading ratio           = ${+(ours.f2_texts_with_2plus_caps_headings_pct / ref.f2_texts_with_2plus_caps_headings_pct).toFixed(1)}x`);
// The gate: a corpus that reads as one hand fails. 3x on either fingerprint is the line.
const fail = ratio > 3 || ours.f2_texts_with_2plus_caps_headings_pct > ref.f2_texts_with_2plus_caps_headings_pct * 3;
console.log(fail ? '\nFAIL — the martial block carries a fingerprint the reference does not.' : '\nPASS');
process.exit(fail ? 1 : 0);
