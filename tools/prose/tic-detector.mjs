#!/usr/bin/env node
// tools/prose/tic-detector.mjs — measure machine-writing tics in EVERY player-facing text we ship,
// against Morrowind's own text, register by register.
//
// WHY THIS EXISTS
// ---------------
// The W1-LIBRARY round-1 critic measured Morrowind's real book corpus for the first time and found
// that a single token separates our books from Morrowind's at 92.5%: "eleven" appears in 49 of our
// 65 books and 7 of Morrowind's 241. That is a fingerprint, and there is no reason to believe it
// stops at the books. This tool generalises the measurement to all shipped player-facing text and
// gives the fix a pass/fail it cannot argue with.
//
// THREE REGISTERS, NEVER MIXED
//   books    ours: game/data/books/*.json books[].text
//            ref : {{Game Book}} pages in the vendored UESP extract, Lore: text (the mw-book-stats set)
//   dialogue ours: game/data/dialogue/** spoken lines (topics, greetings, rumours, race-gated, npcs)
//            ref : corpus/40-dialogue/data/morrowind-dialogue.csv.gz, DialogueText (69,876 rows)
//   journal  ours: game/data/quests/*.json quests[].journal[].text
//            ref : {{Journal Entries}} templates on Morrowind: quest pages in the same extract
//                  (393 pages — nobody in this project had used them before W1-PROSE-TICS)
//   item     ours: items[].description, weapons[].line  (no clean Morrowind reference; measured
//                  against the book register and flagged as such, never scored)
//
// RULES ARE PRE-REGISTERED. tools/prose/rules.pre-registered.json is written and hashed before any
// corpus is read. This tool reports ALL of them, not the best one, so the reader can do their own
// multiple-comparisons arithmetic.
//
// USAGE
//   node tools/prose/tic-detector.mjs --self-test
//   node tools/prose/tic-detector.mjs [--out reports/prose-tics/baseline.json] [--top 15]
//   node tools/prose/tic-detector.mjs --grep RULE-01 --register books   # show the offending sentences
//
// SELF-TEST: exercises tokenisation, every rule against a hand-counted fixture, the separation
// statistic against a constructed corpus with a known answer, and — the part that matters — a
// MUTATION check that injects the tic into a clean corpus and asserts the detector goes red.
// It exits non-zero if the reference corpora are missing rather than passing vacuously.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTRACT = path.join(ROOT, 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz');
const DIALOGUE_CSV = path.join(ROOT, 'corpus/40-dialogue/data/morrowind-dialogue.csv.gz');
const RULES_FILE = path.join(ROOT, 'tools/prose/rules.pre-registered.json');
const CACHE = path.join(ROOT, 'reports/prose-tics/.ref-cache.json');

// ---------------------------------------------------------------- text utilities

export function words(s) {
  const m = String(s).match(/[A-Za-z'’-]+/g);
  return m ? m.length : 0;
}

export function sentences(s) {
  return String(s)
    .split(/(?<=[.!?])["'”’)]?\s+/)
    .map((x) => x.trim())
    .filter((x) => words(x) > 0);
}

// Player-visible text only: strip the substitution codes and stage directions the player never reads
// as prose, so a %PCName does not count as a word on our side and not on theirs.
export function normalise(s) {
  return String(s)
    .replace(/%[A-Za-z]+/g, ' ')
    .replace(/@[^@]+@/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- rules

export function loadRules(file = RULES_FILE) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw.rules.map((r) => ({
    ...r,
    test: r.kind === 'metric' ? null : new RegExp(r.re, r.flags),
  }));
}

export function countRule(rule, text) {
  if (rule.kind === 'metric') {
    const ss = sentences(text).map(words);
    if (!ss.length) return 0;
    const mean = ss.reduce((a, b) => a + b, 0) / ss.length;
    if (rule.name.startsWith('mean')) return mean;
    const v = ss.reduce((a, b) => a + (b - mean) ** 2, 0) / ss.length;
    return Math.sqrt(v);
  }
  const re = new RegExp(rule.test.source, rule.test.flags.includes('g') ? rule.test.flags : rule.test.flags + 'g');
  const m = text.match(re);
  return m ? m.length : 0;
}

export function matchesFor(rule, text) {
  if (rule.kind === 'metric') return [];
  const re = new RegExp(rule.test.source, rule.test.flags.includes('g') ? rule.test.flags : rule.test.flags + 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

// ---------------------------------------------------------------- our corpus

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// A document is the unit the presence statistic is computed over. For books that is a book; for
// dialogue it is one line (matching a Morrowind INFO row); for journal it is one entry.
export function ourCorpus() {
  const reg = { books: [], dialogue: [], journal: [], item: [] };

  for (const f of walkFiles(path.join(ROOT, 'game/data/books'))) {
    const d = readJSON(f);
    for (const b of d.books || []) {
      if (typeof b.text === 'string' && b.text.trim())
        reg.books.push({ id: b.id, file: path.relative(ROOT, f), text: normalise(b.text) });
    }
  }

  for (const f of walkFiles(path.join(ROOT, 'game/data/dialogue'))) {
    const d = readJSON(f);
    const rel = path.relative(ROOT, f);
    const push = (id, t) => {
      if (typeof t === 'string' && t.trim()) reg.dialogue.push({ id, file: rel, text: normalise(t) });
    };
    for (const t of d.topics || []) for (const [i, inf] of (t.infos || []).entries()) push(`${t.id}#${i}`, inf.x);
    for (const [i, g] of (d.greetings || []).entries()) push(g.id || `greet${i}`, g.x);
    for (const [i, p] of (d.pools || []).entries())
      for (const [j, l] of (p.lines || []).entries()) push(`pool${i}#${j}`, l);
    for (const [i, l] of (d.lines || []).entries()) push(l.id || `line${i}`, l.x || l.text);
    for (const [i, l] of (d.race_gated || []).entries()) push(l.id || `rg${i}`, l.x);
    for (const [i, n] of (d.nodes || []).entries()) push(n.id || `node${i}`, n.line);
    for (const [town, arr] of Object.entries(d.rumours || {}))
      if (Array.isArray(arr)) arr.forEach((r, i) => push(`rumour:${town}#${i}`, typeof r === 'string' ? r : r.x));
    for (const [i, q] of (d.questions || []).entries()) {
      push(`q${i}`, q.text);
      for (const [j, a] of (q.answers || []).entries()) push(`q${i}a${j}`, a.text);
    }
    for (const [i, l] of (d.slavery_lines_sample?.lines || []).entries()) push(`slave${i}`, l.text);
  }
  for (const f of walkFiles(path.join(ROOT, 'game/data/npcs'))) {
    const d = readJSON(f);
    for (const n of d.npcs || [])
      if (n.lines?.greeting)
        reg.dialogue.push({ id: `npc:${n.id}`, file: path.relative(ROOT, f), text: normalise(n.lines.greeting) });
  }
  for (const f of walkFiles(path.join(ROOT, 'game/data/world'))) {
    const d = readJSON(f);
    for (const m of d.mysteries || [])
      for (const [i, r] of (m.refusals || []).entries())
        if (r.x) reg.dialogue.push({ id: `refusal:${m.id}#${i}`, file: path.relative(ROOT, f), text: normalise(r.x) });
  }

  for (const f of walkFiles(path.join(ROOT, 'game/data/quests'))) {
    const d = readJSON(f);
    for (const q of d.quests || [])
      for (const [i, j] of (q.journal || []).entries())
        if (j.text) reg.journal.push({ id: `${q.id}#${j.stage ?? i}`, file: path.relative(ROOT, f), text: normalise(j.text) });
  }

  for (const f of walkFiles(path.join(ROOT, 'game/data/items'))) {
    const d = readJSON(f);
    for (const it of d.items || [])
      if (it.description) reg.item.push({ id: it.id, file: path.relative(ROOT, f), text: normalise(it.description) });
  }
  for (const f of walkFiles(path.join(ROOT, 'game/data/weapons'))) {
    const d = readJSON(f);
    for (const w of d.weapons || [])
      if (w.line) reg.item.push({ id: w.id, file: path.relative(ROOT, f), text: normalise(w.line) });
  }
  return reg;
}

// ---------------------------------------------------------------- reference corpora

function xzLines(file) {
  const buf = execFileSync('xz', ['-dc', file], { maxBuffer: 1 << 30 });
  return buf.toString('utf8').split('\n').filter(Boolean);
}

export function stripWiki(t) {
  let s = t;
  // leading infobox templates
  while (s.trimStart().startsWith('{{')) {
    let i = s.indexOf('{{');
    let depth = 0;
    let j = i;
    while (j < s.length) {
      if (s.startsWith('{{', j)) { depth++; j += 2; }
      else if (s.startsWith('}}', j)) { depth--; j += 2; if (depth === 0) break; }
      else j++;
    }
    if (j >= s.length) break;
    s = s.slice(j);
  }
  s = s.replace(/\{\{(?:Lore Link|Quest Link|Place Link|Book Link|Small|Anchor|Huh)\|([^{}|]*?)\|([^{}]*?)\}\}/g, '$2');
  s = s.replace(/\{\{(?:Lore Link|Quest Link|Place Link|Book Link|Small|Anchor)\|([^{}|]*?)\}\}/g, '$1');
  s = s.replace(/\{\{[^{}]*\}\}/g, ' ').replace(/\{\{[^{}]*\}\}/g, ' ');
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/^\{\|[\s\S]*?^\|\}/gm, ' ');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/^=+\s*(.*?)\s*=+\s*$/gm, '$1');
  s = s.replace(/^[*#:;]+/gm, '');
  return s.replace(/[ \t]+/g, ' ').trim();
}

function buildReference() {
  if (!fs.existsSync(EXTRACT)) throw new Error(`reference extract missing: ${EXTRACT}`);
  if (!fs.existsSync(DIALOGUE_CSV)) throw new Error(`reference dialogue missing: ${DIALOGUE_CSV}`);

  const pages = new Map();
  for (const line of xzLines(EXTRACT)) {
    const d = JSON.parse(line);
    pages.set(d.title, d.text || '');
  }

  // --- books: exactly the mw-book-stats.py population (shipped {{Game Book}} pages, Lore: text)
  const GAMES = ['Morrowind', 'Tribunal', 'Bloodmoon'];
  const shipped = new Set();
  for (const [title, text] of pages) {
    const i = title.indexOf(':');
    if (i < 0) continue;
    if (!GAMES.includes(title.slice(0, i))) continue;
    if (!text.includes('{{Game Book')) continue;
    shipped.add(title.slice(i + 1));
  }
  const books = [];
  for (const name of [...shipped].sort()) {
    const lore = pages.get(`Lore:${name}`);
    if (lore == null) continue;
    const body = stripWiki(lore);
    if (words(body) < 20) continue;
    books.push({ id: name, text: normalise(body) });
  }

  // --- journal: {{Journal Entries|id=..|<stage>|<flag>|<text> ...}} on Morrowind:/Tribunal:/Bloodmoon: quest pages
  const journal = [];
  for (const [title, text] of pages) {
    const ns = title.slice(0, title.indexOf(':'));
    if (!GAMES.includes(ns)) continue;
    const re = /\{\{Journal Entries\b([\s\S]*?)\n\}\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const body = m[1];
      const parts = body.split('\n|').slice(1);
      // parts run: id=..., then repeating (stage, flag, text)
      let qid = title;
      const fields = [];
      for (const p of parts) {
        if (/^id\s*=/.test(p.trim())) { qid = p.trim().replace(/^id\s*=\s*/, ''); continue; }
        fields.push(p);
      }
      for (let k = 0; k + 2 < fields.length + 1; k += 3) {
        const stage = (fields[k] || '').trim();
        const body2 = fields[k + 2];
        if (body2 == null) break;
        const t = normalise(stripWiki(body2.trim()));
        if (words(t) >= 5) journal.push({ id: `${qid}#${stage}`, text: t });
      }
    }
  }

  // --- dialogue: the CSV
  const csv = zlib.gunzipSync(fs.readFileSync(DIALOGUE_CSV)).toString('utf8');
  const dialogue = [];
  {
    const rows = parseCSV(csv);
    const head = rows[0].map((h) => h.replace(/^﻿/, '').replace(/^"|"$/g, ''));
    const ti = head.indexOf('DialogueText');
    const ii = head.indexOf('InfoId');
    for (let r = 1; r < rows.length; r++) {
      const t = normalise(rows[r][ti] || '');
      if (words(t) < 1) continue;
      dialogue.push({ id: rows[r][ii] || `row${r}`, text: t });
    }
  }
  return { books, dialogue, journal };
}

// minimal RFC4180 CSV reader (the file has embedded commas, quotes and newlines)
export function parseCSV(s) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function referenceCorpus({ useCache = true } = {}) {
  if (useCache && fs.existsSync(CACHE)) {
    const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (c.schema === 'elder-souls/prose-tic-refcache@1') return c.data;
  }
  const data = buildReference();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ schema: 'elder-souls/prose-tic-refcache@1', data }));
  return data;
}

// ---------------------------------------------------------------- statistics

export function measure(rule, docs) {
  let hits = 0;
  let w = 0;
  let present = 0;
  const metricVals = [];
  for (const d of docs) {
    const n = countRule(rule, d.text);
    const dw = words(d.text);
    w += dw;
    if (rule.kind === 'metric') { if (dw) metricVals.push(n); continue; }
    hits += n;
    if (n > 0) present++;
  }
  if (rule.kind === 'metric') {
    const mean = metricVals.length ? metricVals.reduce((a, b) => a + b, 0) / metricVals.length : 0;
    return { metric: true, value: mean, docs: docs.length, words: w };
  }
  return {
    metric: false,
    hits,
    words: w,
    docs: docs.length,
    present,
    presence_pct: docs.length ? (100 * present) / docs.length : 0,
    per10k: w ? (10000 * hits) / w : 0,
  };
}

// Accuracy of "presence >= 1 => ours" over the pooled document sets, against the majority baseline.
export function separation(ours, ref) {
  const n = ours.docs + ref.docs;
  if (!n) return { accuracy: 0, baseline: 0, lift: 0 };
  const correct = ours.present + (ref.docs - ref.present);
  const baseline = Math.max(ours.docs, ref.docs) / n;
  return {
    accuracy: correct / n,
    baseline,
    lift: correct / n - baseline,
  };
}

// Two-proportion z-test on document presence. Reported so the reader can apply Bonferroni at 46.
export function zTest(a, b) {
  const p1 = a.present / Math.max(1, a.docs);
  const p2 = b.present / Math.max(1, b.docs);
  const p = (a.present + b.present) / Math.max(1, a.docs + b.docs);
  const se = Math.sqrt(p * (1 - p) * (1 / Math.max(1, a.docs) + 1 / Math.max(1, b.docs)));
  if (!se) return 0;
  return (p1 - p2) / se;
}

const REGISTERS = [
  ['books', 'books'],
  ['dialogue', 'dialogue'],
  ['journal', 'journal'],
];

export function runAll({ ours, ref, rules }) {
  const out = { schema: 'elder-souls/prose-tics@1', rules_sha256: null, registers: {} };
  for (const [ourKey, refKey] of REGISTERS) {
    const o = ours[ourKey];
    const r = ref[refKey];
    const rows = [];
    for (const rule of rules) {
      const mo = measure(rule, o);
      const mr = measure(rule, r);
      if (rule.kind === 'metric') {
        rows.push({ id: rule.id, name: rule.name, family: rule.family, metric: true, ours: mo.value, ref: mr.value, ratio: mr.value ? mo.value / mr.value : null });
        continue;
      }
      rows.push({
        id: rule.id,
        name: rule.name,
        family: rule.family,
        metric: false,
        ours_per10k: mo.per10k,
        ref_per10k: mr.per10k,
        ratio: mr.per10k ? mo.per10k / mr.per10k : null,
        ours_hits: mo.hits,
        ref_hits: mr.hits,
        ours_presence_pct: mo.presence_pct,
        ref_presence_pct: mr.presence_pct,
        ...separation(mo, mr),
        z: zTest(mo, mr),
      });
    }
    out.registers[ourKey] = {
      ours_docs: o.length,
      ours_words: o.reduce((a, d) => a + words(d.text), 0),
      ref_docs: r.length,
      ref_words: r.reduce((a, d) => a + words(d.text), 0),
      rows,
    };
  }
  return out;
}

// ---------------------------------------------------------------- self-test

function assert(cond, msg) {
  if (!cond) { console.error(`  FAIL  ${msg}`); process.exitCode = 1; return false; }
  console.log(`  ok    ${msg}`);
  return true;
}

function selfTest() {
  console.log('tic-detector --self-test');
  let ok = true;

  // 1. tokenisation
  ok &= assert(words('one two three') === 3, 'words() counts three words');
  ok &= assert(words("don't stop") === 2, "words() keeps the apostrophe inside a contraction");
  ok &= assert(sentences('A. B! C?').length === 3, 'sentences() splits on . ! ?');
  ok &= assert(normalise('%PCName said  x') === 'said x', 'normalise() drops %PCName and squeezes space');

  // 2. every rule compiles and none matches the empty string pathologically
  const rules = loadRules();
  ok &= assert(rules.length === 46, `all 46 pre-registered rules load (got ${rules.length})`);
  let compiled = 0;
  for (const r of rules) { if (r.kind === 'metric' || r.test instanceof RegExp) compiled++; }
  ok &= assert(compiled === rules.length, 'every rule compiled');

  // 3. hand-counted fixture
  const fixture =
    'There were eleven of us on the quay and nineteen in the boat. ' +
    'It is not a boat but a barge, which is to say a raft with ambitions — a long one — and that is what matters. ' +
    "I do not think anybody counted; we had rope, tar and a lamp. " +
    "You can't count in that rain.";
  const byId = Object.fromEntries(rules.map((r) => [r.id, r]));
  const hand = {
    'RULE-01': 1, 'RULE-02': 1, 'RULE-05': 2, 'RULE-15': 1, 'RULE-21': 2,
    'RULE-22': 1, 'RULE-23': 1, 'RULE-37': 1,
  };
  for (const [id, n] of Object.entries(hand)) {
    const got = countRule(byId[id], fixture);
    ok &= assert(got === n, `${id} (${byId[id].name}) counts ${n} in the fixture (got ${got})`);
  }
  ok &= assert(countRule(byId['RULE-09'], fixture) === 1, 'RULE-09 finds "eleven of us"');
  ok &= assert(countRule(byId['RULE-26'], fixture) === 1, 'RULE-26 finds the tricolon "rope, tar and a lamp"');

  // 4. a rule must be able to score ZERO — a rule that always fires measures nothing
  for (const r of rules) {
    if (r.kind === 'metric') continue;
    if (countRule(r, 'The dog.') !== 0) { ok &= assert(false, `${r.id} fires on neutral text`); }
  }
  ok &= assert(true, 'no rule fires on neutral text ("The dog.")');

  // 5. the separation statistic, against a constructed answer
  const clean = Array.from({ length: 80 }, (_, i) => ({ id: `c${i}`, text: 'The tide came up over the stones and went down again with the light.' }));
  const ticced = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, text: 'There were eleven of us and the tide came up over the stones.' }));
  const mo = measure(byId['RULE-01'], ticced);
  const mr = measure(byId['RULE-01'], clean);
  const sep = separation(mo, mr);
  ok &= assert(Math.abs(sep.accuracy - 1) < 1e-9, 'separation() is 1.00 when the rule perfectly sorts the two sets');
  ok &= assert(Math.abs(sep.baseline - 0.8) < 1e-9, 'separation() reports the 0.80 majority baseline');

  // 6. MUTATION CHECK — break the thing it measures and confirm the instrument goes red.
  //    Half of the "clean" corpus is deliberately infected; separation must fall, and the
  //    infected corpus must be flagged. A detector that cannot go red is not a detector.
  const infected = clean.map((d, i) => (i % 2 ? d : { ...d, text: d.text + ' Eleven of them, I counted.' }));
  const mi = measure(byId['RULE-01'], infected);
  ok &= assert(mi.present === 40, `mutation: 40 of 80 clean docs go red after injection (got ${mi.present})`);
  ok &= assert(mi.per10k > 0, 'mutation: rate is non-zero after injection');
  const sepAfter = separation(mo, mi);
  ok &= assert(sepAfter.accuracy < sep.accuracy, `mutation: separation degrades when the reference is infected (${sep.accuracy.toFixed(3)} -> ${sepAfter.accuracy.toFixed(3)})`);
  const sepClean = separation(measure(byId['RULE-01'], clean), clean);
  ok &= assert(sepClean.accuracy === 0.5, 'a rule that fires on neither side scores 0.50, not 1.00');

  // 7. the reference corpora must actually be there. Vacuous pass is a failure.
  let ref;
  try {
    ref = referenceCorpus({ useCache: false });
  } catch (e) {
    ok &= assert(false, `reference corpora readable: ${e.message}`);
    return process.exitCode || 1;
  }
  ok &= assert(ref.books.length >= 200, `Morrowind book reference loaded (${ref.books.length} books, expect ~241)`);
  ok &= assert(ref.dialogue.length >= 60000, `Morrowind dialogue reference loaded (${ref.dialogue.length} rows, expect 69,876)`);
  ok &= assert(ref.journal.length >= 1000, `Morrowind journal reference loaded (${ref.journal.length} entries from {{Journal Entries}})`);
  const jw = ref.journal.reduce((a, d) => a + words(d.text), 0);
  ok &= assert(jw > 50000, `journal reference has real text (${jw} words)`);
  ok &= assert(!ref.journal.some((d) => /\{\{|\[\[/.test(d.text)), 'journal reference has no leftover wikitext');

  // 8. our corpus must be non-empty in every register
  const ours = ourCorpus();
  ok &= assert(ours.books.length >= 60, `our books extracted (${ours.books.length})`);
  ok &= assert(ours.dialogue.length >= 500, `our dialogue extracted (${ours.dialogue.length} lines)`);
  ok &= assert(ours.journal.length >= 200, `our journal extracted (${ours.journal.length} entries)`);
  ok &= assert(ours.item.length >= 20, `our item text extracted (${ours.item.length})`);

  console.log(process.exitCode ? 'SELF-TEST FAILED' : 'self-test passed');
  return process.exitCode || 0;
}

// ---------------------------------------------------------------- cli

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toFixed(d);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();

  const grepIdx = argv.indexOf('--grep');
  const rules = loadRules();

  if (grepIdx >= 0) {
    const id = argv[grepIdx + 1];
    const regIdx = argv.indexOf('--register');
    const reg = regIdx >= 0 ? argv[regIdx + 1] : 'books';
    const rule = rules.find((r) => r.id === id || r.name === id);
    if (!rule) { console.error(`no such rule: ${id}`); return 2; }
    const ours = ourCorpus();
    for (const d of ours[reg] || []) {
      for (const m of matchesFor(rule, d.text)) {
        const s = sentences(d.text).find((x) => x.includes(m.text)) || d.text.slice(Math.max(0, m.index - 90), m.index + 120);
        console.log(`${d.file}\t${d.id}\t${s}`);
      }
    }
    return 0;
  }

  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? argv[outIdx + 1] : 'reports/prose-tics/baseline.json';
  const topIdx = argv.indexOf('--top');
  const top = topIdx >= 0 ? Number(argv[topIdx + 1]) : 15;

  const ours = ourCorpus();
  const ref = referenceCorpus();
  const res = runAll({ ours, ref, rules });
  res.rules_sha256 = execFileSync('sha256sum', [RULES_FILE]).toString().split(' ')[0];
  res.rules_tested = rules.length;
  res.bonferroni_z = 3.30; // two-sided 0.05/46
  res.item_register_note =
    'The item/description register (items[].description, weapons[].line) has no clean Morrowind ' +
    'counterpart in the vendored sources and is measured but never scored.';
  res.item = { docs: ours.item.length, words: ours.item.reduce((a, d) => a + words(d.text), 0),
    rows: rules.filter((r) => !r.kind).map((r) => { const m = measure(r, ours.item); return { id: r.id, name: r.name, per10k: m.per10k, hits: m.hits }; }) };

  fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, out), JSON.stringify(res, null, 2) + '\n');

  for (const [reg, r] of Object.entries(res.registers)) {
    console.log(`\n== ${reg}: ours ${r.ours_docs} docs / ${r.ours_words} words   ref ${r.ref_docs} docs / ${r.ref_words} words`);
    const rows = r.rows.filter((x) => !x.metric).slice().sort((a, b) => b.lift - a.lift).slice(0, top);
    console.log('  rule      lift   acc    base   ours/10k  ref/10k   ratio  ours%  ref%   z      name');
    for (const x of rows) {
      console.log(
        `  ${x.id}  ${fmt(x.lift, 3)}  ${fmt(x.accuracy, 3)}  ${fmt(x.baseline, 3)}  ` +
        `${fmt(x.ours_per10k).padStart(8)}  ${fmt(x.ref_per10k).padStart(7)}  ` +
        `${(x.ratio == null ? 'inf' : fmt(x.ratio, 1)).padStart(6)}  ${fmt(x.ours_presence_pct, 1).padStart(5)}  ` +
        `${fmt(x.ref_presence_pct, 1).padStart(5)}  ${fmt(x.z, 1).padStart(5)}  ${x.name}`
      );
    }
    for (const x of r.rows.filter((y) => y.metric)) {
      console.log(`  ${x.id}  metric ${x.name}: ours ${fmt(x.ours)}  ref ${fmt(x.ref)}  ratio ${fmt(x.ratio)}`);
    }
  }
  console.log(`\nwrote ${out}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
