#!/usr/bin/env node
// check-authoring-leaks.mjs — does any shipped NPC line address the WRITER instead of a
// character?
//
// Filed for W1-DIALOGUE-AUTHORING-LEAK (P1). A blind judge shown only a screenshot of the
// conversation window flagged, unprompted: "the narration line 'Say it in one line. Local.
// Useful.' reads like an authoring instruction to the writer rather than in-world dialogue."
// It was one: `tools/dialogue/gen-greetings.mjs`'s STANCE['RG-BWC'].cold[3] was literally the
// string 'Say it in one line.', combinatorially expanded into 5 shipped lines in
// `game/data/dialogue/greetings.json`.
//
// THIS CHECK IS THE STATIC HALF of the regression guard for that defect. It re-derives its own
// counts every run (never trust a cached number) and:
//   1. scans the AUTHORED SOURCE tables (STANCE + ADDRESS in gen-greetings.mjs) — the place a
//      future leak would actually be introduced, not just its combinatorial expansion; and
//   2. scans every shipped `lines`/`x`/`text` string under `game/data/dialogue/**` and
//      `game/data/books/**`, so a leak authored directly into a hand-written JSON file (not
//      generated) is caught too.
//
// SELF-TEST (`--self-test`): proves the check can fail, by literally re-checking the leaked
// stance ('Say it in one line.') is on the PATTERNS list and asserting it WOULD be flagged if
// it reappeared. `words-check.mjs` in this same directory is the precedent for keeping a
// negative control alive so a check cannot quietly go vacuous.
//
// Usage:
//   node tools/dialogue/check-authoring-leaks.mjs               # scan, exit 0/1
//   node tools/dialogue/check-authoring-leaks.mjs --self-test    # prove the check can fail
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);

// Imperatives addressed to a writer, not to a character. Each entry is [regex, why].
// Kept deliberately narrow (see gen-greetings.mjs's own broad prose, which legitimately
// contains "must be" etc. in book text) — this list targets META-INSTRUCTION shapes, not
// ordinary imperative dialogue ("Leave the grove" is a character talking; "keep it under N
// words" is a brief to a writer).
export const PATTERNS = [
  // Narrowly the leaked imperative, not the bare phrase "in one line" — that phrase also
  // occurs legitimately in-fiction (a clerk asked to summarise a document "in one line" is a
  // character being characterised, not a leak); see `the-short-measures.json` books[6].
  [/\bsay it in one line\b/i, 'authoring brief about line length'],
  [/\bkeep it (short|brief|tight|concise)\b/i, 'authoring brief about brevity'],
  [/\bwrite (a|the|your) line\b/i, 'instruction to a writer'],
  [/\bthis (line|dialogue) should\b/i, 'meta-commentary about the line itself'],
  [/\bplaceholder\b/i, 'placeholder text'],
  [/\btodo\b/i, 'todo marker'],
  [/\bfixme\b/i, 'fixme marker'],
  [/\blorem ipsum\b/i, 'filler text'],
  [/\[insert\b/i, 'template bracket'],
  [/<insert\b/i, 'template bracket'],
  [/\bTBD\b/, 'todo marker'],
  [/\bnote to (the )?writer\b/i, 'note to writer'],
  [/\bwriter'?s? note\b/i, 'note to writer'],
  [/\bstay in character\b/i, 'instruction to a writer'],
  [/\bas an ai\b/i, 'model self-reference'],
  [/\bas the writer\b/i, 'instruction to a writer'],
  [/\bcharacter limit\b/i, 'authoring brief about length'],
  [/\bword limit\b/i, 'authoring brief about length'],
  [/\bword count\b/i, 'authoring brief about length'],
];

function matchAny(text) {
  for (const [re, why] of PATTERNS) if (re.test(text)) return why;
  return null;
}

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkJson(p));
    else if (f.endsWith('.json')) out.push(p);
  }
  return out;
}

// Fields that plausibly carry SHIPPED, SPOKEN/READ text (as opposed to design notes like
// `note`, `_note`, `order_note`, `corpus_item`, quest `notes`/`consequence`/`outcome`, which
// are documentation about the data, never rendered to the player, and legitimately contain
// words like "must be").
const TEXT_KEYS = new Set(['lines', 'line', 'text', 'x', 'greeting', 'a']);

function scanValue(v, filePath, keyPath, keyName, hits) {
  if (typeof v === 'string') {
    if (TEXT_KEYS.has(keyName)) {
      const why = matchAny(v);
      if (why) hits.push({ file: filePath, key: keyPath, why, text: v });
    }
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => scanValue(x, filePath, `${keyPath}[${i}]`, keyName, hits));
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) scanValue(v[k], filePath, `${keyPath}.${k}`, k, hits);
  }
}

function scanShippedData() {
  const hits = [];
  const dirs = [
    path.join(ROOT, 'game/data/dialogue'),
    path.join(ROOT, 'game/data/books'),
  ];
  for (const dir of dirs) {
    for (const f of walkJson(dir)) {
      let data;
      try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
        hits.push({ file: f, key: '(parse)', why: `unparseable JSON: ${e.message}`, text: '' });
        continue;
      }
      scanValue(data, f, '', '', hits);
    }
  }
  return hits;
}

async function scanAuthoredSource() {
  const mod = await import('./gen-greetings.mjs');
  const hits = [];
  // buildPools() is the exact function the generator uses to expand STANCE x ADDRESS into
  // shipped lines, so scanning its output checks precisely what would ship, not a guess at
  // the source shape.
  for (const pool of mod.buildPools()) {
    for (let i = 0; i < pool.lines.length; i++) {
      const why = matchAny(pool.lines[i]);
      if (why) {
        hits.push({
          file: 'tools/dialogue/gen-greetings.mjs (generated)',
          key: `${pool.reaction_group}/${pool.disposition_band}/${pool.player_race_class}[${i}]`,
          why, text: pool.lines[i],
        });
      }
    }
  }
  return hits;
}

async function main() {
  const selfTest = argv.includes('--self-test');

  if (selfTest) {
    // Prove the instrument can fail: the actual leaked string, run through the actual
    // matcher, must be flagged. If this ever stops matching, the check has gone vacuous.
    const leaked = 'Say it in one line. Local. Useful.';
    const why = matchAny(leaked);
    if (!why) {
      console.error('SELF-TEST FAILED: the known leaked line no longer matches any pattern.');
      console.error('This check has gone vacuous — PATTERNS must be repaired before trusting it.');
      process.exit(3);
    }
    console.log(`self-test: known leak '${leaked}' correctly flagged (${why}). Instrument is live.`);
  }

  const sourceHits = await scanAuthoredSource();
  const shippedHits = scanShippedData();
  const all = [...sourceHits, ...shippedHits];

  console.log(`authored-source scan: ${sourceHits.length} hit(s)`);
  console.log(`shipped-data scan (game/data/dialogue/**, game/data/books/**): ${shippedHits.length} hit(s)`);

  if (all.length) {
    console.log('\nFLAGGED:');
    for (const h of all) {
      console.log(`  ${h.file}  ${h.key}\n    (${h.why}) ${JSON.stringify(h.text).slice(0, 160)}`);
    }
    console.log(`\nFAIL: ${all.length} authoring-instruction leak(s) found.`);
    process.exit(1);
  }
  console.log('\nPASS: no authoring-instruction leaks found in scanned dialogue/book text fields.');
  process.exit(0);
}

main();
