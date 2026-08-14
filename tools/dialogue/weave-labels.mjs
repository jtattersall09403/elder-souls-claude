// W1-DLG-TOPIC-WEB §4C — apply an authored rewrite of an answer, and REFUSE it unless it actually
// made the unlock visible.
//
//   node tools/dialogue/weave-labels.mjs --patch <patch.json> [--apply]
//   node tools/dialogue/weave-labels.mjs --worklist [--limit N] [--offset N] [--file <name>]
//   node tools/dialogue/weave-labels.mjs --flag <flags.json> [--apply]
//   node tools/dialogue/weave-labels.mjs --delete <deletions.json> [--apply]
//
// WHY THIS EXISTS RATHER THAN A HAND EDIT PER FILE. Step C rewrites ~840 answers so that the
// destination of every `to` entry is a word the player was actually shown. Three things make that
// unsafe by hand and all three are checkable:
//
//   1. **The index you edit is not the index the player reads.** 92 of the 470 topic ids are
//      declared in more than one file, so an info's position in its own file and its position in
//      the merged record `buildTopicIndex()` hands the player are different numbers. Addressing
//      the wrong one edits somebody else's sentence. This tool takes the MERGED key (`topic#k`,
//      exactly what `visibility.tsv`'s `info_id` column prints) and resolves it back to the file
//      and the local index itself.
//   2. **A rewrite that does not achieve visibility is worse than no rewrite**, because it costs a
//      good sentence and buys nothing. So every patched answer is re-measured with the SAME matcher
//      `build-graph.mjs --visibility` uses, and a patch that leaves any of that info's `to`
//      destinations invisible is REJECTED by name, with the label it failed to place. `--apply`
//      writes nothing at all if any patch in the file is rejected.
//   3. **A rewrite must not change what the character means** (plan §9). This tool cannot judge
//      that — `tools/dialogue/answer-census.mjs --diff` is the guard and it is run around the whole
//      pass — but it does refuse a patch that DELETES more than it adds, which is the mechanical
//      half: a "rewrite" that throws the answer away and writes a keyword list is caught here.
//
// SAFE ON DISK. Eleven of the twenty-two topic files do NOT round-trip through
// `JSON.stringify(doc, null, 2)` — some escape non-ASCII as `\u00a7`, one writes its `to` arrays on
// a single line — so nothing here re-serialises a document. Each edit swaps the exact bytes of the
// one value it names, in that file's own encoding, and every touched file is re-parsed and
// re-checked afterwards. A patch changes the string it names and nothing else in the file.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { loadTopicRecordsAsRead, labelForRecord, visibilityOf } from './build-graph.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(ROOT, 'game/data/dialogue/topics');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const APPLY = !!arg('apply', false);

// ---- THE WRITER: surgical, because these files do not share one format ------------------------
//
// Eleven of the twenty-two topic files do not round-trip through `JSON.stringify(doc, null, 2)`,
// for two unrelated reasons: `00-roots.json` and friends escape non-ASCII as `§` / `—`
// where `stringify` emits the literal character, and `60-roads.json` writes `"to": ["a", "b"]` on
// one line where `stringify` explodes it over four. Re-serialising the document would therefore
// reformat between 25 and 408 bytes of files this edit has no business touching, in a tree where a
// dozen agents land concurrently and every reformatted line is a merge conflict somebody else pays
// for.
//
// So nothing here re-serialises a document. Each edit finds the exact bytes of the value it is
// replacing, in whichever of the two encodings that file happens to use, and swaps in the new value
// in the SAME encoding. A value whose encoded form is not found exactly once is refused rather than
// guessed at, and every file is re-parsed and re-checked after the swap.
const filePath = (f) => path.join(DIR, f);
const readRaw = (f) => fs.readFileSync(filePath(f), 'utf8');
const encPlain = (s) => JSON.stringify(s);
const encAscii = (s) => JSON.stringify(s).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/** Replace `oldVal`'s encoded form with `newVal`'s, in whichever encoding the file uses. */
function swapValue(raw, oldVal, newVal, what) {
  for (const enc of [encPlain, encAscii]) {
    const needle = enc(oldVal);
    const first = raw.indexOf(needle);
    if (first < 0) continue;
    if (raw.indexOf(needle, first + 1) >= 0) return { error: `${what}: its encoded form occurs more than once in the file; refusing to guess which` };
    return { raw: raw.slice(0, first) + enc(newVal) + raw.slice(first + needle.length) };
  }
  return { error: `${what}: could not find its encoded form in the file under either encoding` };
}

/**
 * The `[...]` immediately following `"<key>"` after `fromIndex`, as {start, end, text}. A balanced
 * scan rather than a regex, because a `to` array's strings can contain brackets.
 */
function findArrayAfter(raw, key, fromIndex) {
  const at = raw.indexOf(`"${key}"`, fromIndex);
  if (at < 0) return null;
  const open = raw.indexOf('[', at);
  if (open < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return { start: open, end: i + 1, text: raw.slice(open, i + 1) }; }
  }
  return null;
}

/** Re-serialise a string array in the style the array it replaces was written in. */
function renderArray(list, sampleText, indentOfLine) {
  if (!list.length) return '[]';
  if (!sampleText.includes('\n')) return '[' + list.map((s) => encPlain(s)).join(', ') + ']';
  const inner = indentOfLine + '  ';
  return '[\n' + list.map((s) => inner + encPlain(s)).join(',\n') + '\n' + indentOfLine + ']';
}

/** The indentation of the line `index` sits on. */
function indentAt(raw, index) {
  const nl = raw.lastIndexOf('\n', index);
  return raw.slice(nl + 1, index).match(/^\s*/)[0];
}

/** 1 wherever a character is inside a JSON string literal, so brace scans cannot be fooled by prose. */
function stringMask(raw) {
  const mask = new Uint8Array(raw.length);
  let inStr = false, esc = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      mask[i] = 1;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') { inStr = false; mask[i] = 0; }
    } else if (c === '"') { inStr = true; }
  }
  return mask;
}

/** The `{ … }` object containing `index`. */
function objectSpanAround(raw, mask, index) {
  let depth = 0, start = -1;
  for (let i = index; i >= 0; i--) {
    if (mask[i]) continue;
    if (raw[i] === '}') depth++;
    else if (raw[i] === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (mask[i]) continue;
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
  }
  return null;
}

/**
 * Locate the exact bytes of one INFO's `x` value and of the object it sits in. Refuses anything it
 * cannot pin down uniquely rather than editing an approximation.
 */
function locateInRaw(raw, oldText, what) {
  for (const enc of [encPlain, encAscii]) {
    const needle = enc(oldText);
    const first = raw.indexOf(needle);
    if (first < 0) continue;
    if (raw.indexOf(needle, first + 1) >= 0) return { error: `${what}: its \`x\` text occurs more than once in the file; refusing to guess which` };
    const mask = stringMask(raw);
    const obj = objectSpanAround(raw, mask, first);
    if (!obj) return { error: `${what}: found the text but not the info object around it` };
    return { enc, xStart: first, xEnd: first + needle.length, obj, mask };
  }
  return { error: `${what}: could not find its \`x\` text in the file under either encoding` };
}

const records = loadTopicRecordsAsRead();
const labelOf = (id) => labelForRecord(records.get(id) || { id });

/** `topic#k` -> the merged info, plus the file and local index that produced it. */
function locate(key) {
  const hash = key.lastIndexOf('#');
  const id = key.slice(0, hash);
  const k = Number(key.slice(hash + 1));
  const rec = records.get(id);
  if (!rec) return { error: `no topic record '${id}'` };
  const info = rec.infos[k];
  if (!info) return { error: `${id} has ${rec.infos.length} merged info(s); #${k} does not exist` };
  return { id, k, info, file: info._file, idx: info._idx };
}

const wordCount = (s) => (String(s).match(/[A-Za-z0-9'’]+/g) || []).length;

// ---- --worklist: what is left to do, in a form that can be written against -------------------
if (arg('worklist', false)) {
  const only = arg('file', null);
  const limit = Number(arg('limit', 40));
  const offset = Number(arg('offset', 0));
  const items = [];
  for (const [id, rec] of records) {
    rec.infos.forEach((info, k) => {
      if (only && info._file !== only) return;
      const text = String(info.x == null ? '' : info.x);
      const impliedSet = new Set(Array.isArray(info.implied) ? info.implied : []);
      const missing = (info.to || []).filter((d) => !impliedSet.has(d) && visibilityOf(text, labelOf(d)).matcher !== 'strict');
      if (missing.length) items.push({ key: `${id}#${k}`, file: info._file, a: info.a || null, missing: missing.map((d) => ({ id: d, label: labelOf(d) })), x: text });
    });
  }
  console.log(JSON.stringify({ remaining_infos: items.length, remaining_occurrences: items.reduce((a, b) => a + b.missing.length, 0), items: items.slice(offset, offset + limit) }, null, 1));
  process.exit(0);
}

// ---- the three edit operations, all through the surgical writer ------------------------------
//
// Each operation collects per-file raw-text edits, verifies EVERY file re-parses and says what the
// edit claimed afterwards, and only then writes. A rejection anywhere writes nothing anywhere:
// a half-applied pass leaves the corpus in a state neither census describes.
const pending = new Map();          // file -> current raw text
const rawOf = (f) => { if (!pending.has(f)) pending.set(f, readRaw(f)); return pending.get(f); };
const expectations = [];            // {file, id, idx, check(info)} — re-checked after every edit

function commit(label) {
  let bad = 0;
  for (const [f, raw] of pending) {
    let doc;
    try { doc = JSON.parse(raw); } catch (e) { console.error(`REJECT ${f}: the edited file no longer parses — ${e.message}`); bad++; continue; }
    for (const e of expectations.filter((x) => x.file === f)) {
      const rec = (doc.topics || []).find((t) => t.id === e.id);
      const info = rec && rec.infos[e.idx];
      if (!info) { console.error(`REJECT ${f}: ${e.id}#${e.idx} is gone after the edit`); bad++; continue; }
      const err = e.check(info);
      if (err) { console.error(`REJECT ${f}: ${e.id}#${e.idx} — ${err}`); bad++; }
    }
  }
  if (bad) { console.error(`\n${bad} post-edit verification failure(s). NOTHING WRITTEN.`); process.exit(1); }
  if (APPLY) { for (const [f, raw] of pending) fs.writeFileSync(filePath(f), raw); console.log(`${label}: applied to ${[...pending.keys()].join(', ')}`); }
  else console.log('(dry run — pass --apply to write)');
}

// ---- --flag: mark `to` entries as deliberate implications (A1b) -------------------------------
if (arg('flag', false)) {
  const spec = JSON.parse(fs.readFileSync(path.resolve(String(arg('flag'))), 'utf8'));
  let n = 0, bad = 0;
  for (const [key, dsts] of Object.entries(spec)) {
    const loc = locate(key);
    if (loc.error) { console.error(`REJECT ${key}: ${loc.error}`); bad++; continue; }
    const list = Array.isArray(dsts) ? dsts : [dsts];
    const notThere = list.filter((d) => !(loc.info.to || []).includes(d));
    if (notThere.length) { console.error(`REJECT ${key}: ${notThere.join(', ')} — not among its \`to\` destinations`); bad++; continue; }
    const raw = rawOf(loc.file);
    const at = locateInRaw(raw, String(loc.info.x == null ? '' : loc.info.x), key);
    if (at.error) { console.error(`REJECT ${at.error}`); bad++; continue; }
    const toArr = findArrayAfter(raw, 'to', at.obj.start);
    if (!toArr || toArr.start > at.obj.end) { console.error(`REJECT ${key}: could not find its \`to\` array`); bad++; continue; }
    const want = [...new Set([...(loc.info.implied || []), ...list])];
    const existing = findArrayAfter(raw, 'implied', at.obj.start);
    const inObj = existing && existing.start < at.obj.end;
    const indent = indentAt(raw, raw.lastIndexOf('"to"', toArr.start));
    let next;
    if (inObj) next = raw.slice(0, existing.start) + renderArray(want, existing.text, indentAt(raw, raw.lastIndexOf('"implied"', existing.start))) + raw.slice(existing.end);
    else next = raw.slice(0, toArr.end) + `,\n${indent}"implied": ` + renderArray(want, toArr.text, indent) + raw.slice(toArr.end);
    pending.set(loc.file, next);
    expectations.push({ file: loc.file, id: loc.id, idx: loc.idx, check: (info) => list.every((d) => (info.implied || []).includes(d)) ? null : `\`implied\` does not carry ${list.join(', ')}` });
    n += list.length;
  }
  if (bad) { console.error(`\n${bad} rejection(s); nothing written.`); process.exit(1); }
  console.log(`flag: ${n} occurrence(s) marked \`implied\` across ${pending.size} file(s).`);
  commit('flag');
  process.exit(0);
}

// ---- --delete: remove a `to` edge, under §4C's reachability test ------------------------------
if (arg('delete', false)) {
  const spec = JSON.parse(fs.readFileSync(path.resolve(String(arg('delete'))), 'utf8'));
  let n = 0, bad = 0;
  for (const [key, dsts] of Object.entries(spec)) {
    const loc = locate(key);
    if (loc.error) { console.error(`REJECT ${key}: ${loc.error}`); bad++; continue; }
    const list = Array.isArray(dsts) ? dsts : [dsts];
    const notThere = list.filter((d) => !(loc.info.to || []).includes(d));
    if (notThere.length) { console.error(`REJECT ${key}: ${notThere.join(', ')} — not among its \`to\` destinations`); bad++; continue; }
    const raw = rawOf(loc.file);
    const at = locateInRaw(raw, String(loc.info.x == null ? '' : loc.info.x), key);
    if (at.error) { console.error(`REJECT ${at.error}`); bad++; continue; }
    const toArr = findArrayAfter(raw, 'to', at.obj.start);
    if (!toArr || toArr.start > at.obj.end) { console.error(`REJECT ${key}: could not find its \`to\` array`); bad++; continue; }
    const want = (loc.info.to || []).filter((d) => !list.includes(d));
    const indent = indentAt(raw, raw.lastIndexOf('"to"', toArr.start));
    pending.set(loc.file, raw.slice(0, toArr.start) + renderArray(want, toArr.text, indent) + raw.slice(toArr.end));
    expectations.push({ file: loc.file, id: loc.id, idx: loc.idx, check: (info) => list.some((d) => (info.to || []).includes(d)) ? `\`to\` still carries ${list.join(', ')}` : null });
    n += list.length;
  }
  if (bad) { console.error(`\n${bad} rejection(s); nothing written.`); process.exit(1); }
  console.log(`delete: ${n} edge occurrence(s) removed across ${pending.size} file(s).`);
  console.log("REMEMBER: §4C's safety test is REACHABILITY, not orphaning. Re-run");
  console.log('  node tools/dialogue/build-graph.mjs --out /tmp/dlg --visibility');
  console.log('and confirm `unreachable_from_greeting` has not grown (A5c).');
  commit('delete');
  process.exit(0);
}

// ---- --patch: the rewrite pass ----------------------------------------------------------------
const patchPath = arg('patch', null);
if (!patchPath) { console.error('usage: --worklist | --patch <file> | --flag <file> | --delete <file>   [--apply]'); process.exit(2); }
const patch = JSON.parse(fs.readFileSync(path.resolve(String(patchPath)), 'utf8'));

let ok = 0, rejected = 0;
for (const [key, newText] of Object.entries(patch)) {
  const loc = locate(key);
  if (loc.error) { console.error(`REJECT ${key}: ${loc.error}`); rejected++; continue; }
  const before = String(loc.info.x == null ? '' : loc.info.x);
  const text = String(newText);
  // Guard 3: a rewrite that mostly deletes is a keyword list wearing a diff.
  if (wordCount(text) < wordCount(before)) {
    console.error(`REJECT ${key}: the rewrite is SHORTER than the original (${wordCount(before)} -> ${wordCount(text)} words). Step C adds words to an answer; it does not replace one.`);
    rejected++; continue;
  }
  // Guard 2: did it actually work? Same matcher as the census.
  const impliedSet = new Set(Array.isArray(loc.info.implied) ? loc.info.implied : []);
  const stillMissing = (loc.info.to || []).filter((d) => !impliedSet.has(d) && visibilityOf(text, labelOf(d)).matcher !== 'strict');
  if (stillMissing.length) {
    console.error(`REJECT ${key}: still invisible after the rewrite — ${stillMissing.map((d) => `"${labelOf(d)}"`).join(', ')}`);
    rejected++; continue;
  }
  const raw = rawOf(loc.file);
  const swapped = swapValue(raw, before, text, key);
  if (swapped.error) { console.error(`REJECT ${swapped.error}`); rejected++; continue; }
  pending.set(loc.file, swapped.raw);
  expectations.push({ file: loc.file, id: loc.id, idx: loc.idx, check: (info) => info.x === text ? null : 'the text on disk is not the text the patch asked for' });
  ok++;
}

console.log(`patch: ${ok} accepted, ${rejected} rejected, across ${pending.size} file(s).`);
if (rejected) { console.error('\nNOTHING WRITTEN. Fix the rejected entries and re-run — a partial application would leave the corpus in a state neither census describes.'); process.exit(1); }
commit('patch');
