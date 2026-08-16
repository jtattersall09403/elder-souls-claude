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
// =========================================================================================
// ROUND 2 — THIS CHECK IS THE THING THAT FAILED, AND THIS HEADER IS WHY
// =========================================================================================
// Round 1's version of this file **could not fail on the file the defect actually lived in.**
// Three of the round-1 critic's five controls went green when they should have gone red, and
// all three are repaired here. `HAZARDS` §31 was written from this verdict and is the spec:
//
//   D. **It regenerated the file it was scanning.** To learn what a leak looks like it did
//      `await import('./gen-greetings.mjs')` — and that module had an unguarded top-level
//      `fs.writeFileSync(OUT, ...)`. So: hand-author the leak back into shipped
//      `greetings.json`, run the check, and it **exits 0 with the leak gone from the file**.
//      It deleted the evidence and reported the absence of evidence, across 1,500 of the
//      4,988 strings it reached. Repaired twice over, because either half alone would do and
//      a future edit should not be able to resurrect it: (1) **this file no longer imports
//      any generator** — it reads `gen-greetings.mjs` as TEXT, strips comments, and pulls the
//      authored string literals out of the STANCE/ADDRESS tables; (2) `gen-greetings.mjs`
//      now guards its write behind `RUN_DIRECTLY`. And belt-and-braces on top: this check
//      **hashes every file it is about to read, re-hashes them after, and exits 4 if any byte
//      moved** — so a check that mutates its own evidence can never again report a pass.
//
//   E. **`TEXT_KEYS` was a six-name allow-list, which is a denylist of everything else.**
//      Injecting the leak into a `faction-refusals.json` line — 59 player-facing strings
//      across 7 factions, all spoken by `FactionRefusals.speak()` — went undetected, *while
//      this header claimed to catch leaks "authored directly into a hand-written JSON file"*.
//      Repaired by inversion: **every string in scope is now scanned**, minus a short,
//      documented `META_KEYS` list of keys that are never rendered, and the count of what is
//      excluded is **printed on every run** so the shape of the hole is visible instead of
//      trusted (`HAZARDS` §31 rule 3).
//
//   C. **It tested the function, not the wiring.** Repaired via `tools/lib/call-site.mjs`:
//      each scanned surface must name the SHIPPED call site that renders it, or the check
//      goes red. Read that file for what a text-level call-site assertion does and does not
//      prove — it is weaker than driving the engine and stronger than round 1's nothing.
//
// SELF-TEST (`--self-test`): proves the PREDICATE can fail, by re-checking the known leaked
// string against the live pattern list. It has never been sufficient and is not now:
// `HAZARDS` §31 rule 4 — *a self-test against a fixture proves the predicate; only
// hand-authoring the defect into the SHIPPED artefact proves the pipeline.* Round 2's
// controls D and E are recorded in `orchestration/status/W1-DIALOGUE-AUTHORING-LEAK-r2.json`.
//
// Usage:
//   node tools/dialogue/check-authoring-leaks.mjs               # scan, exit 0/1
//   node tools/dialogue/check-authoring-leaks.mjs --self-test    # also prove the predicate
//   node tools/dialogue/check-authoring-leaks.mjs --list-excluded  # dump the excluded keys
//
// Exit codes: 0 pass · 1 leak found · 2 wiring assertion failed · 3 predicate self-test failed
//             · 4 THIS CHECK MUTATED ITS OWN EVIDENCE (the §31 tripwire) · 5 IO/scope error.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import { assertCallSites, reportCallSites, stripLineComments } from '../lib/call-site.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);

// Imperatives addressed to a writer, not to a character. Each entry is [regex, why].
// Kept deliberately narrow (see the book corpus's own prose, which legitimately contains
// "must be" etc.) — this list targets META-INSTRUCTION shapes, not ordinary imperative
// dialogue ("Leave the grove" is a character talking; "keep it under N words" is a brief to a
// writer).
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

// -----------------------------------------------------------------------------------------
// SCOPE, INVERTED. Round 1 whitelisted six key names; a leak under any other key was invisible.
// Now: scan EVERY string, and subtract only keys documented as never reaching a player. Each
// entry carries its reason, because an undocumented exclusion is how the hole comes back.
// -----------------------------------------------------------------------------------------
export const META_KEYS = new Map([
  ['note', 'design/provenance note about the data; never rendered'],
  ['_note', 'design note (underscore convention for non-data)'],
  ['notes', 'design notes array'],
  ['order_note', 'note about declared merge order'],
  ['corpus_item', 'citation of the governing reference item'],
  ['provenance', 'how this file was produced'],
  ['honest_statement', "provenance's own volume-vs-labour declaration"],
  ['register_anchor', 'provenance: the corpus register this file answers to'],
  ['why', 'design rationale block'],
  ['owner', 'which wave-1 piece owns the file'],
  ['source', 'the reference item this file is built from'],
  ['generated_by', 'the generator that writes this file'],
  ['schema', 'schema identifier'],
  ['method', 'how a number in this file was derived'],
  ['rationale', 'design rationale'],
]);

// Directories whose JSON carries text the player can be shown. Each MUST have a wired,
// asserted consumer below — a surface with no call site is either dead data or a stale scope.
const SCAN_DIRS = ['game/data/dialogue', 'game/data/books'];

// The shipped call sites that render the surfaces above. Round-1 control C: with the call
// site reverted and the fixed function untouched, all three checks exited 0.
const CALL_SITES = [
  {
    file: 'game/src/engine.js',
    why: 'engine loads dialogue/greetings.json and dialogue/faction-refusals.json, and speaks both',
    must_contain: [
      "dialogue/faction-refusals.json",
      'new FactionRefusals(',
      '.factionRefusals.speak(',
      'greetingFor',
    ],
  },
  {
    file: 'game/src/character/converse.js',
    why: 'greetingFor() is what turns a greetings.json pool into the line an NPC says',
    must_contain: ['export function greetingFor(', 'greetingFor(this.data'],
  },
  {
    file: 'game/src/sim/quest/refusal.js',
    why: 'FactionRefusals.speak() is what turns faction-refusals.json into a spoken refusal',
    must_contain: ['export class FactionRefusals', 'speak(factionId'],
  },
  {
    file: 'game/src/engine.js',
    why: 'books/*.json reach the reading UI through foldBooks() (see tools/books/check-book-fold.mjs)',
    must_contain: ['foldBooks(this.data.books)'],
  },
];

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkJson(p));
    else if (f.endsWith('.json')) out.push(p);
  }
  return out;
}

/** SHA-256 of every file this run will read. The §31 tripwire's before/after. */
function fingerprint(files) {
  const m = new Map();
  for (const f of files) m.set(f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
  return m;
}

function scanValue(v, filePath, keyPath, keyName, acc) {
  if (typeof v === 'string') {
    if (META_KEYS.has(keyName)) {
      acc.excluded++;
      acc.excludedByKey.set(keyName, (acc.excludedByKey.get(keyName) || 0) + 1);
      return;
    }
    acc.scanned++;
    const why = matchAny(v);
    if (why) acc.hits.push({ file: path.relative(ROOT, filePath), key: keyPath, why, text: v });
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => scanValue(x, filePath, `${keyPath}[${i}]`, keyName, acc));
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) scanValue(v[k], filePath, `${keyPath}.${k}`, k, acc);
  }
}

function scanShippedData(files) {
  const acc = { hits: [], scanned: 0, excluded: 0, excludedByKey: new Map() };
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
      acc.hits.push({ file: path.relative(ROOT, f), key: '(parse)', why: `unparseable JSON: ${e.message}`, text: '' });
      continue;
    }
    scanValue(data, f, '', '', acc);
  }
  return acc;
}

// -----------------------------------------------------------------------------------------
// THE AUTHORED SOURCE, READ AS TEXT. Round 1 did `await import('./gen-greetings.mjs')` and the
// import wrote the file this check then scanned. This reads the bytes instead: comments are
// stripped first (this file's own header, and the generator's, QUOTE the leaked string — a
// scanner that did not strip comments would flag the explanation of the bug as the bug), then
// the STANCE and ADDRESS table regions are located and their string literals extracted.
// -----------------------------------------------------------------------------------------
const GEN = 'tools/dialogue/gen-greetings.mjs';

/** String literals inside `const <NAME> = { ... };`, brace-matched, comments already stripped. */
function literalsInTable(code, name) {
  const start = code.indexOf(`const ${name} = {`);
  if (start === -1) return null;
  let depth = 0; let i = code.indexOf('{', start); const open = i;
  let q = null;
  for (; i < code.length; i++) {
    const c = code[i];
    if (q) {
      if (c === '\\') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return null;
  const body = code.slice(open, i + 1);
  const out = [];
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(body))) {
    const raw = m[1] !== undefined ? m[1] : m[2];
    out.push(raw.replace(/\\(['"\\])/g, '$1'));
  }
  return out;
}

function scanAuthoredSource() {
  const abs = path.join(ROOT, GEN);
  if (!fs.existsSync(abs)) {
    return { hits: [{ file: GEN, key: '(missing)', why: 'the authored greeting source is gone — this check\'s scope is stale', text: '' }], counts: {} };
  }
  const code = stripLineComments(fs.readFileSync(abs, 'utf8'));
  const hits = []; const counts = {};
  for (const table of ['STANCE', 'ADDRESS']) {
    const lits = literalsInTable(code, table);
    if (lits === null) {
      hits.push({ file: GEN, key: `(const ${table})`, why: `could not locate/parse the ${table} table — fix this check, do not assume it is clean`, text: '' });
      continue;
    }
    counts[table] = lits.length;
    for (const s of lits) {
      const why = matchAny(s);
      if (why) hits.push({ file: GEN, key: `${table} literal`, why, text: s });
    }
  }
  return { hits, counts };
}

function main() {
  const selfTest = argv.includes('--self-test');

  if (selfTest) {
    // Prove the PREDICATE can fail. Necessary, never sufficient — see the header, §31 rule 4.
    const leaked = 'Say it in one line. Local. Useful.';
    const why = matchAny(leaked);
    if (!why) {
      console.error('SELF-TEST FAILED: the known leaked line no longer matches any pattern.');
      console.error('This check has gone vacuous — PATTERNS must be repaired before trusting it.');
      process.exit(3);
    }
    console.log(`self-test: known leak '${leaked}' correctly flagged (${why}). Predicate is live.`);
    console.log('  (A predicate self-test is NOT a pipeline proof — HAZARDS §31 rule 4.)');
  }

  // ---- the §31 tripwire, opened before anything else reads --------------------------------
  const dataFiles = SCAN_DIRS.flatMap((d) => walkJson(path.join(ROOT, d)));
  if (dataFiles.length === 0) {
    console.error(`FAIL: scope is empty — none of ${SCAN_DIRS.join(', ')} contain JSON. Has the data layout moved?`);
    process.exit(5);
  }
  const watched = [...dataFiles, path.join(ROOT, GEN)].filter((f) => fs.existsSync(f));
  const before = fingerprint(watched);

  const source = scanAuthoredSource();
  const data = scanShippedData(dataFiles);

  const after = fingerprint(watched);
  const mutated = [...before.keys()].filter((f) => before.get(f) !== after.get(f));
  if (mutated.length) {
    console.error('\nEVIDENCE-MUTATION TRIPWIRE (HAZARDS §31): this check changed the bytes it was');
    console.error('scanning. That is exactly the round-1 defect — a check that regenerates its own');
    console.error('evidence deletes the leak and then reports its absence. Files changed under it:');
    for (const f of mutated) console.error(`  ${path.relative(ROOT, f)}`);
    console.error('No verdict from this run may be believed. Exit 4.');
    process.exit(4);
  }

  // ---- report ------------------------------------------------------------------------------
  console.log(`scope: ${dataFiles.length} JSON files under ${SCAN_DIRS.join(', ')}`);
  console.log(`authored source (${GEN}, read as TEXT — not imported): ` +
    `${Object.entries(source.counts).map(([k, v]) => `${k} ${v} literals`).join(', ')} · ${source.hits.length} hit(s)`);
  console.log(`shipped data: ${data.scanned} strings scanned · ${source.hits.length + data.hits.length} hit(s)`);
  console.log(`evidence-mutation tripwire: ${watched.length} files hashed before and after — 0 changed`);

  console.log(`\nSCOPE HOLE, STATED (HAZARDS §31 rule 3): ${data.excluded} string(s) under ` +
    `${data.excludedByKey.size} key name(s) were EXCLUDED as never-rendered metadata:`);
  for (const [k, n] of [...data.excludedByKey.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${k.padEnd(18)} ${META_KEYS.get(k)}`);
  }
  console.log('  A leak authored into one of those keys is invisible here — by design, and the');
  console.log('  count is printed so that is a decision a reader can audit, not an assumption.');
  if (argv.includes('--list-excluded')) {
    console.log('\n  full META_KEYS list:');
    for (const [k, v] of META_KEYS) console.log(`    ${k.padEnd(18)} ${v}`);
  }

  const wired = reportCallSites('check-authoring-leaks', assertCallSites(ROOT, CALL_SITES));

  const all = [...source.hits, ...data.hits];
  if (all.length) {
    console.log('\nFLAGGED:');
    for (const h of all) {
      console.log(`  ${h.file}  ${h.key}\n    (${h.why}) ${JSON.stringify(h.text).slice(0, 160)}`);
    }
    console.log(`\nFAIL: ${all.length} authoring-instruction leak(s) found.`);
    process.exit(1);
  }
  if (!wired) {
    console.log('\nFAIL: no leaks in the data, but a shipped call site is missing — the surfaces');
    console.log('above may no longer reach a player, so a clean scan of them proves nothing.');
    process.exit(2);
  }
  console.log('\nPASS: no authoring-instruction leaks in any scanned string, and every scanned');
  console.log('surface still has its shipped call site.');
  process.exit(0);
}

main();
