#!/usr/bin/env node
// opacity-resolve.mjs — does the opacity register point at anything?
//
// Owner: W1-OPACITY. Binding: RI-WLD09 §B1, orchestration/TOOL-LOOP.md rule 1.
//
// WHY THIS TOOL EXISTS, AND WHY IT IS NOT `opacity-audit.py`.
// The Python auditor checks the SEAL side: that every declared mystery has an authored answer,
// that the answer hashes to what the game data records, and that no game string states it. It
// does not check that the evidence ids resolve — it counts evidence bullets and stops. So a
// register could pass `--seals --leak-scan` CLEAN while every id in it named nothing, which is
// the exact shape of the 74 unsatisfiable `opens_by.topic` gates this tree has already paid for
// once: a model that scores and cannot fire.
//
// This tool checks the OTHER side, in an independent implementation (node, not python; its own
// sha256, not the auditor's), and it checks four things the auditor structurally cannot:
//
//   R1 RESOLUTION   every anchor / evidence / false_account / refusal_topic names a record that
//                   is actually in game/data/**.
//   R2 COMPOSITION  §B1's quotas, computed off the register rather than restated from it.
//   R3 THE SPLIT    a `settleable` mystery's `settles` sentence must NOT reach its sealed
//                   answer. Settleable means the player can close a factual sub-question; if
//                   settling it reaches the answer the mystery is a puzzle, which §B1 and M-OP3
//                   both fail. Measured with the leak scan's own character-5-gram Jaccard.
//   R4 CONSUMPTION  a world-side reader exists in game/src and is on the boot path. RI-MTH07 /
//                   ARBITRATION §3. If it does not, this tool REPORTS THE ABSENCE AND EXITS 1
//                   rather than passing — a register nothing reads is a text file.
//
//   R5 STRICT LEAK  every sealed answer and every declared leak n-gram, against EVERY string in
//                   game/data/** and game/src/**, regardless of key — plus a check that the
//                   sealed half is not reachable from anything the build ships.
//
// R5 EXISTS BECAUSE THE PYTHON LEAK SCAN HAS A HOLE, and it is in the worst possible place.
// `opacity-audit.py` harvests only keys in its TEXT_KEYS list — text|body|line|response|entry|
// prose|greeting|rumour|description|note|inscription|journal. A dialogue INFO writes its prose
// under `x`. Measured on this tree: 2,699 strings are inside that list and **4,292 further
// prose-length strings are outside it, 1,102 of them under `x` alone** — so the entire dialogue
// layer, which is exactly where a leak would be written, was never being scanned. A CLEAN from
// the auditor alone is therefore not evidence about dialogue, item names, book titles, quest
// `outcome`/`truth`/`stated_objective` fields, or anything hard-coded in game/src.
//
// It is offline and takes about a second. It is meant to run in CI beside `check-data`.
//
//   node tools/world/opacity-resolve.mjs
//   node tools/world/opacity-resolve.mjs --json reports/opacity-resolve.json
//   node tools/world/opacity-resolve.mjs --break <id>   # self-test: see SELF-TEST below
//
// SELF-TEST. `--break` perturbs the loaded register IN MEMORY (never on disk) and asserts the
// tool goes red, because a probe that cannot fail is worse than no probe (AGENT-PROTOCOL §"Two
// failure modes"). Modes: `evidence` (point M-05's first evidence id at a book that does not
// exist), `seal` (flip a hex digit), `count` (drop half the register), `split` (make a
// settleable mystery's `settles` a copy of its sealed answer), `consumer` (pretend game/src has
// no reader). Each must produce a non-zero exit and name the right check.
//
// EXIT 0 clean | 1 one or more checks failed | 2 usage | 10 an input artifact is missing

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'game/data');
const REG = path.join(DATA, 'world/opacity.json');
const SEALED = path.join(ROOT, 'corpus/50-world/sealed/SEALED-ANSWERS.md');
const SRC = path.join(ROOT, 'game/src');

const FUZZY_JACCARD = 0.35;          // RI-WLD09 §M-OP1, the same threshold as the leak scan
const QUOTAS = {                     // RI-WLD09 §B1's table. Edit there first, then here.
  total: 24, place: 8, object: 6, creature: 4, phenomenon: 3, person: 3,
  encounterable: 18, within_three_hours: 6, max_reward: 6,
  min_evidence: 3, min_evidence_classes: 2, min_two_false_accounts: 8,
};

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
const BREAK = opt('--break');
const JSONOUT = opt('--json');
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
    .split('\n').filter((l) => l.startsWith('//')).join('\n') + '\n');
  process.exit(2);
}

// ---------------------------------------------------------------- helpers
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const grams = (s, n = 5) => { const t = norm(s); const o = new Set(); for (let i = 0; i + n <= t.length; i++) o.add(t.slice(i, i + n)); return o; };
const jaccard = (a, b) => { let inter = 0; for (const g of a) if (b.has(g)) inter++; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; };
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
/** The topic fold, byte-identical to game/src/core/topics.js topicKey(). */
const topicKey = (id) => String(id ?? '').toLowerCase().replace(/[‘’'`]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

function need(p, what) {
  if (!fs.existsSync(p)) {
    process.stderr.write(`MISSING ${path.relative(ROOT, p)} — ${what}\n`);
    process.exit(10);
  }
  return p;
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- the world index
function worldIndex() {
  const ix = { book: new Set(), dialogue: new Set(), npc: new Set(), poi: new Set(), region: new Set(), item: new Set(), enemy: new Set() };
  for (const p of walk(DATA)) {
    const rel = path.relative(DATA, p).split(path.sep).join('/');
    let doc; try { doc = readJson(p); } catch { continue; }
    if (rel.startsWith('books/')) { for (const b of (doc.books || [doc])) if (b && b.id) ix.book.add(b.id); }
    else if (rel.startsWith('dialogue/topics/')) { for (const t of (doc.topics || [])) if (t && typeof t.id === 'string') ix.dialogue.add(topicKey(t.id)); }
    else if (rel.startsWith('npcs/')) { for (const n of (doc.npcs || [])) if (n && n.id) ix.npc.add(n.id); }
    else if (rel.startsWith('items/')) { for (const it of (doc.items || [])) if (it && it.id) ix.item.add(it.id); }
    else if (rel.startsWith('combat/enemies/')) { if (doc.id) ix.enemy.add(doc.id); }
    else if (rel === 'world/pois.json') { for (const q of (doc.pois || [])) ix.poi.add(q.id); }
    else if (rel === 'world/regions.json') { for (const r of (doc.regions || [])) ix.region.add(r.id); }
  }
  return ix;
}

// ---------------------------------------------------------------- the sealed half
function parseSealed() {
  const src = fs.readFileSync(need(SEALED, 'the authorial half of the register'), 'utf8');
  const marks = [...src.matchAll(/^### (M-\d+)\s+—\s+(.+?)\s*$/gm)];
  const out = new Map();
  for (let i = 0; i < marks.length; i++) {
    const body = src.slice(marks[i].index + marks[i][0].length, i + 1 < marks.length ? marks[i + 1].index : src.length);
    const m = body.match(/^>\s+\*\*SEALED ANSWER\.\*\*\s*([\s\S]+?)(?=\n\n|\n\*\*)/m);
    const answer = m ? m[1].replace(/\n>\s*/g, ' ').trim().replace(/\s+/g, ' ') : '';
    out.set(marks[i][1], { id: marks[i][1], name: marks[i][2], answer });
  }
  return out;
}

// ---------------------------------------------------------------- R4, consumption
function findConsumers() {
  const hits = [];
  const files = [];
  (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else if (e.name.endsWith('.js')) files.push(p); } })(SRC);
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    if (/OpacityRegister|_installOpacity|setOpacity\(|refusalFor\(|getOpacityState/.test(t)) hits.push(rel);
    if (rel.endsWith('engine.js') && !/world\/opacity\.json'\)\s*out\.opacity/.test(t.replace(/\s+/g, ' '))) {
      hits.push('!engine-loadData-branch-missing');
    }
  }
  return hits;
}

// ---------------------------------------------------------------- run
const reg = readJson(need(REG, 'the public half of the opacity register (RI-WLD09 §B1)'));
const sealed = parseSealed();
const ix = worldIndex();
let consumers = findConsumers();
let mysteries = reg.mysteries.map((m) => JSON.parse(JSON.stringify(m)));

// ---- deliberate breakage, in memory only ------------------------------------------------
if (BREAK) {
  const target = mysteries.find((m) => m.id === 'M-05') || mysteries[0];
  if (BREAK === 'evidence') target.evidence[0] = 'book:a-book-that-was-never-written';
  else if (BREAK === 'seal') target.seal = target.seal.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
  else if (BREAK === 'count') mysteries = mysteries.slice(0, 12);
  else if (BREAK === 'split') {
    const s = mysteries.find((m) => m.resolution && m.resolution.kind === 'settleable');
    s.resolution.settles = sealed.get(s.id).answer;
  } else if (BREAK === 'consumer') consumers = [];
  else if (BREAK === 'leak' || BREAK === 'substring') { /* handled at the R5 scan, below */ }
  else { process.stderr.write(`--break: unknown mode ${JSON.stringify(BREAK)}\n`); process.exit(2); }
  process.stderr.write(`[self-test] perturbed in memory: ${BREAK}\n`);
}

const fail = [];
const report = { register: path.relative(ROOT, REG), mysteries: mysteries.length };

// ---- R1 resolution ----------------------------------------------------------------------
let checked = 0;
for (const m of mysteries) {
  const check = (id, where) => {
    checked++;
    const i = String(id).indexOf(':');
    if (i < 0) { fail.push(`R1 DANGLE   ${m.id} ${where} ${id}: no kind prefix`); return; }
    const kind = id.slice(0, i);
    const rest = kind === 'dialogue' ? topicKey(id.slice(i + 1)) : id.slice(i + 1);
    if (!ix[kind]) { fail.push(`R1 KIND     ${m.id} ${where} ${id}: unknown kind ${JSON.stringify(kind)}`); return; }
    if (!ix[kind].has(rest)) fail.push(`R1 DANGLE   ${m.id} ${where} ${id}: no such ${kind} in game/data/**`);
  };
  for (const a of (m.anchors || [])) check(a, 'anchor');
  for (const e of (m.evidence || [])) check(e, 'evidence');
  for (const f of (m.false_accounts || [])) check(f, 'false_account');
  for (const t of (m.refusal_topics || [])) check(`dialogue:${t}`, 'refusal_topic');
  if ((m.evidence || []).length < QUOTAS.min_evidence) fail.push(`R1 THIN     ${m.id}: ${(m.evidence || []).length} evidence < ${QUOTAS.min_evidence}`);
  const cls = new Set((m.evidence || []).map((e) => ({ book: 'book', dialogue: 'dialogue', npc: 'dialogue', poi: 'geometry', region: 'observation', item: 'item', enemy: 'observation' })[String(e).split(':')[0]]).filter(Boolean));
  if (cls.size < QUOTAS.min_evidence_classes) fail.push(`R1 CLASSES  ${m.id}: evidence spans ${cls.size} content class(es) < ${QUOTAS.min_evidence_classes}`);
  if (!(m.refusals || []).length) fail.push(`R1 MUTE     ${m.id}: no authored refusal — the world has no way to decline about it`);
  for (const r of (m.refusals || [])) if (!r.x || String(r.x).trim().length < 20) fail.push(`R1 MUTE     ${m.id}: a refusal with no line in it`);
}
report.ids_checked = checked;

// ---- R2 composition ---------------------------------------------------------------------
const by = {};
for (const m of mysteries) by[m.kind] = (by[m.kind] || 0) + 1;
const comp = {
  total: mysteries.length, by_kind: by,
  encounterable: mysteries.filter((m) => m.encounterable).length,
  within_three_hours: mysteries.filter((m) => Number(m.reachable_hours) <= 3).length,
  with_reward: mysteries.filter((m) => m.has_reward).length,
  settleable: mysteries.filter((m) => m.resolution && m.resolution.kind === 'settleable').length,
  sealed: mysteries.filter((m) => !m.resolution || m.resolution.kind === 'sealed').length,
  with_two_false_accounts: mysteries.filter((m) => (m.false_accounts || []).length >= 2).length,
};
report.composition = comp;
if (comp.total < QUOTAS.total) fail.push(`R2 COUNT    ${comp.total} mysteries < ${QUOTAS.total}`);
for (const k of ['place', 'object', 'creature', 'phenomenon', 'person']) {
  if ((by[k] || 0) < QUOTAS[k]) fail.push(`R2 KIND     ${by[k] || 0} of kind ${k} < ${QUOTAS[k]}`);
}
if (comp.encounterable < QUOTAS.encounterable) fail.push(`R2 HIDDEN   ${comp.encounterable} encounterable in ordinary play < ${QUOTAS.encounterable}`);
if (comp.within_three_hours < QUOTAS.within_three_hours) fail.push(`R2 LATE     ${comp.within_three_hours} within 3 hours < ${QUOTAS.within_three_hours}`);
if (comp.with_reward > QUOTAS.max_reward) fail.push(`R2 REWARD   ${comp.with_reward} mysteries pay out > ${QUOTAS.max_reward} — a mystery with a reward is a puzzle`);
if (comp.with_two_false_accounts < QUOTAS.min_two_false_accounts) fail.push(`R2 ACCOUNTS ${comp.with_two_false_accounts} with >=2 false accounts < ${QUOTAS.min_two_false_accounts}`);
if (comp.settleable === 0) fail.push('R2 SPLIT    no mystery is settleable — the world yields to nothing, which is not the Morrowind shape');
if (comp.sealed === 0) fail.push('R2 SPLIT    every mystery is settleable — nothing is finally refused');

// ---- R3 the split, and the seal cross-check ---------------------------------------------
const split = [];
for (const m of mysteries) {
  const s = sealed.get(m.id);
  if (!s) { fail.push(`R3 NOANSWER ${m.id}: declared in the register with no sealed answer`); continue; }
  const want = sha256(`${m.id}\n${norm(s.answer)}`);
  if (want !== m.seal) fail.push(`R3 SEALMISS ${m.id}: register seal ${String(m.seal).slice(0, 12)}… != recomputed ${want.slice(0, 12)}…`);
  if (!m.resolution || !m.resolution.stays_open) { fail.push(`R3 NOSPLIT  ${m.id}: no resolution.stays_open`); continue; }
  const ag = grams(s.answer);
  const openJ = jaccard(ag, grams(m.resolution.stays_open));
  if (openJ >= FUZZY_JACCARD) fail.push(`R3 OPENLEAK ${m.id}: resolution.stays_open is ${openJ.toFixed(2)} similar to the sealed answer — it states what it is supposed to leave open`);
  if (m.resolution.kind === 'settleable') {
    if (!m.resolution.settles) { fail.push(`R3 NOSPLIT  ${m.id}: settleable with no settles sentence`); continue; }
    const j = jaccard(ag, grams(m.resolution.settles));
    split.push({ id: m.id, jaccard: Number(j.toFixed(3)) });
    if (j >= FUZZY_JACCARD) fail.push(`R3 PUZZLE   ${m.id}: what the player can settle is ${j.toFixed(2)} similar to the sealed answer — settling it reaches the answer, so this is a puzzle, not a mystery`);
  } else if (m.resolution.settles) {
    fail.push(`R3 NOSPLIT  ${m.id}: marked sealed but declares a settlement`);
  }
}
report.split = { settleable: split, max_jaccard: split.length ? Math.max(...split.map((x) => x.jaccard)) : 0 };

// ---- R4 consumption ---------------------------------------------------------------------
report.consumers = consumers;
if (!consumers.length) {
  fail.push('R4 NOREADER game/src contains no reader for the opacity register. RI-MTH07 / '
    + 'ARBITRATION §3: a register nothing reads is a text file, and this tool will not report '
    + 'a text file as content.');
} else if (consumers.includes('!engine-loadData-branch-missing')) {
  fail.push('R4 DROPPED  engine.js loadData() has no `world/opacity.json` branch, so the file is '
    + 'fetched at boot and then discarded. Every other reader is downstream of a value that is '
    + 'always undefined.');
}

// ---- R5 the strict leak scan ------------------------------------------------------------
// Every string anywhere under game/data/**, plus every string and comment-free literal under
// game/src/**, plus the deployed entry points. No key filter: if it is a string in the build,
// it is scanned.
function everyString(node, file, out) {
  if (typeof node === 'string') { if (node.trim()) out.push([file, node]); return; }
  if (Array.isArray(node)) { for (const v of node) everyString(v, file, out); return; }
  if (node && typeof node === 'object') { for (const k of Object.keys(node)) everyString(node[k], file, out); }
}
const strings = [];
for (const p of walk(DATA)) {
  let doc; try { doc = readJson(p); } catch { continue; }
  everyString(doc, path.relative(ROOT, p), strings);
}
// `--break leak` plants a declared n-gram, and `--break substring` plants a 60-character run of
// a real sealed answer, in a synthetic string that the scan cannot tell from a shipped one.
// Both must go red; a leak scan that has never caught a leak is a scan nobody has tested.
if (BREAK === 'leak') {
  const first = [...fs.readFileSync(SEALED, 'utf8').matchAll(/`"([^"]+)"`/g)][0][1];
  strings.push(['(synthetic)/books/planted.json', `A perfectly ordinary sentence about ${first}, in a book.`]);
}
if (BREAK === 'substring') {
  const a = [...sealed.values()][0].answer;
  strings.push(['(synthetic)/dialogue/planted.json', `Well, ${a.slice(20, 110)}`]);
}
(function srcWalk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) srcWalk(p);
    else if (/\.(js|html|css)$/.test(e.name)) strings.push([path.relative(ROOT, p), fs.readFileSync(p, 'utf8')]);
  }
})(SRC);
report.strict_scan = { strings: strings.length };

// The declared n-grams live in the corpus half; re-read them here rather than trusting the
// register, which by design carries no prose from the answers at all.
const sealedSrc = fs.readFileSync(SEALED, 'utf8');
const ngramMarks = [...sealedSrc.matchAll(/^### (M-\d+)\s+—/gm)];
const NGRAMS = new Map();
for (let i = 0; i < ngramMarks.length; i++) {
  const body = sealedSrc.slice(ngramMarks[i].index, i + 1 < ngramMarks.length ? ngramMarks[i + 1].index : sealedSrc.length);
  NGRAMS.set(ngramMarks[i][1], [...body.matchAll(/`"([^"]+)"`/g)].map((x) => x[1]));
}
const normedStrings = strings.map(([f, t]) => [f, norm(t)]);
let ngramCount = 0;
for (const [mid, list] of NGRAMS) {
  if (list.length < 5) fail.push(`R5 NGRAMS   ${mid}: ${list.length} declared leak n-grams < 5`);
  for (const ng of list) {
    ngramCount++;
    const n = norm(ng);
    if (!n) continue;
    for (const [f, t] of normedStrings) if (t.includes(n)) fail.push(`R5 LEAK     ${mid}: n-gram ${JSON.stringify(ng)} appears in ${f}`);
  }
}
report.strict_scan.ngrams = ngramCount;
for (const [mid, s] of sealed) {
  const ag = grams(s.answer);
  for (const [f, t] of normedStrings) {
    if (t.length < 40) continue;
    const j = jaccard(ag, grams(t));
    if (j >= FUZZY_JACCARD) fail.push(`R5 PARAPHRASE ${mid}: ${f} is ${j.toFixed(2)} similar to the sealed answer`);
  }
}
// The hard version of "the sealed answers file shipped by accident" (RI-WLD09 §How-we-lose):
// no shipped string may contain a 40-character or longer run of any sealed answer. That is a
// much lower bar to clear than a declared n-gram and it catches a partial copy-paste, which is
// how such a file actually escapes — not by being moved wholesale but by somebody quoting a
// sentence of it into a book because it was good.
const RUN = 40;
for (const [mid, sa] of sealed) {
  const a = norm(sa.answer);
  const runs = [];
  for (let i = 0; i + RUN <= a.length; i += 8) runs.push(a.slice(i, i + RUN));
  for (const [f, t] of normedStrings) {
    for (const r of runs) if (t.includes(r)) { fail.push(`R5 SUBSTRING ${mid}: a ${RUN}-char run of the sealed answer appears in ${f}`); break; }
  }
}

// The SOFT version: a shipped string that names the sealed file by path. This is a warning and
// not a failure, deliberately. The repo serves its own root in the harness, so a pointer is
// findable there; a deployed build ships `game/` and not `corpus/`, so it is not findable in
// production. It is worth a critic's eye and it is not worth a red build, and pretending
// otherwise would make this tool cry wolf on an accurate authoring note.
const pointers = [];
for (const [f, t] of strings) {
  if (/SEALED-ANSWERS|50-world\/sealed/.test(t) && !f.startsWith('tools' + path.sep)) pointers.push(f);
}
report.strict_scan.pointers = [...new Set(pointers)];

// ---------------------------------------------------------------- output
process.stdout.write(`opacity-resolve — ${mysteries.length} mysteries, ${checked} ids checked against game/data/**\n`);
process.stdout.write(`  strict leak: ${strings.length} strings (every key, game/data + game/src), ${ngramCount} declared n-grams\n`);
for (const f of report.strict_scan.pointers) process.stdout.write(`  R5 POINTER  ${f} names the sealed answers file by path (warning, not a failure)\n`);
process.stdout.write(`  composition: ${JSON.stringify(comp)}\n`);
process.stdout.write(`  consumers:   ${consumers.join(', ') || '(none)'}\n`);
process.stdout.write(`  split:       ${comp.settleable} settleable / ${comp.sealed} sealed, max settles-vs-answer Jaccard ${report.split.max_jaccard}\n`);
for (const f of fail) process.stdout.write(`  ${f}\n`);
process.stdout.write(fail.length ? `\n${fail.length} FAILURES\n` : '\nCLEAN\n');
report.failures = fail;
if (JSONOUT) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, JSONOUT)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, JSONOUT), JSON.stringify(report, null, 1));
}
process.exit(fail.length ? 1 : 0);
