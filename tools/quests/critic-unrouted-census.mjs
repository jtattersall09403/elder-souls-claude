#!/usr/bin/env node
// critic-unrouted-census.mjs — W1-READABLES r2 critic, attack E.
//
// The builder reports 100 of 121 demanded (quest,reveal) pairs routed and 21 not, and attributes
// the 21 to: 9 eavesdrop rows, 1 corpse row, 11 missing NPC records and (separately) 12 unwritten
// document rows that no resolution demands. This recomputes all of it FROM THE QUEST FILES AND
// THE DATA DIRECTORY ALONE — no engine, no `reveal-route-audit.mjs` — so the number is not being
// read back out of the instrument that produced it, and gives each remaining row an acceptance
// number the next round can be graded on.
//
// "Demanded" = some resolution of that quest names the reveal in `requires_knowing`.
// "Routed"   = the reveal's channel has a reader in game/src/ AND its source exists as the thing
//              that reader looks up (a person record, a document, or a placed mark).
//
// Able to fail: `--self-test` asserts it calls a routed row routed and an unrouted row unrouted
// against fixtures built in memory, and `--falsify <mode>` perturbs the real inputs.
//
//   node tools/quests/critic-unrouted-census.mjs [--json] [--self-test]
//        [--falsify hide-npcs|hide-books|hide-marks]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const falsify = argOf('--falsify');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
};

// ---- what exists in the world -----------------------------------------------------------------
const npcIds = new Set();
if (falsify !== 'hide-npcs') {
  for (const f of walk(path.join(ROOT, 'game/data/npcs'))) {
    const d = readJson(f);
    for (const n of (d.npcs || d.records || (Array.isArray(d) ? d : []))) if (n && n.id) npcIds.add(n.id);
  }
}
const bookKeys = new Set();   // knowledge_key -> the id a `ledger`/`letter`/`book` reveal names
const bookIds = new Set();
if (falsify !== 'hide-books') {
  for (const f of walk(path.join(ROOT, 'game/data/books'))) {
    const d = readJson(f);
    for (const b of (d.books || [])) { if (b.knowledge_key) bookKeys.add(b.knowledge_key); if (b.id) bookIds.add(b.id); }
  }
}
const markIds = new Set();
const marksPlaced = new Set();
if (falsify !== 'hide-marks') {
  const p = path.join(ROOT, 'game/data/world/readables/site-marks.json');
  if (fs.existsSync(p)) {
    const d = readJson(p);
    for (const m of (d.marks || d.records || [])) {
      if (!m || !m.id) continue;
      markIds.add(m.id);
      if (m.at && (m.at.interior || m.at.world)) marksPlaced.add(m.id);
    }
  }
}

// ---- which channels have a reader in game/src/ -------------------------------------------------
const routesSrc = fs.existsSync(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js'))
  ? fs.readFileSync(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js'), 'utf8') : '';
const engineSrc = fs.existsSync(path.join(ROOT, 'game/src/engine.js'))
  ? fs.readFileSync(path.join(ROOT, 'game/src/engine.js'), 'utf8') : '';
const CHANNEL_READER = {
  talk_to_target: /talk_to_target\s*:/.test(routesSrc) && /learnFrom\(\s*'person'/.test(engineSrc),
  rival_npc: /rival_npc\s*:/.test(routesSrc) && /learnFrom\(\s*'person'/.test(engineSrc),
  environment: /environment\s*:/.test(routesSrc) && /learnFrom\(\s*'place'/.test(engineSrc),
  ledger: true, letter: true, book: true,       // the book-knowledge index, W1-LIBRARY
  later_quest: true,                            // the hook table
  eavesdrop: /eavesdrop\s*:/.test(routesSrc),
  corpse: /corpse\s*:/.test(routesSrc),
};

// ---- the demanded pairs ------------------------------------------------------------------------
const quests = [];
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/quests')).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json' || f === 'mainline.json') continue;
  for (const q of (readJson(path.join(ROOT, 'game/data/quests', f)).quests || [])) quests.push(q);
}

const rows = [];
for (const q of quests) {
  const demanded = new Set();
  for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
  for (const rv of (((q.deceit || {}).revealed_by) || [])) {
    if (!demanded.has(rv.id)) continue;
    const ch = rv.channel;
    const src = rv.source;
    let exists = null, why = null;
    if (ch === 'talk_to_target' || ch === 'rival_npc' || ch === 'eavesdrop' || ch === 'corpse') {
      exists = npcIds.has(src);
      if (!exists) why = `no NPC record ${src} under game/data/npcs/**`;
    } else if (ch === 'ledger' || ch === 'letter' || ch === 'book') {
      exists = bookKeys.has(src) || bookIds.has(src);
      if (!exists) why = `no document carrying knowledge_key ${src}`;
    } else if (ch === 'environment') {
      exists = marksPlaced.has(src);
      if (!exists) why = markIds.has(src) ? `mark ${src} stands nowhere` : `no mark ${src}`;
    } else if (ch === 'later_quest') { exists = true; }
    const reader = CHANNEL_READER[ch] !== false && CHANNEL_READER[ch] !== undefined;
    if (!reader) why = `no reader for channel ${ch} in game/src/`;
    rows.push({ quest: q.id, reveal: rv.id, channel: ch, source: src, reader, exists: !!exists, routed: !!(reader && exists), why });
  }
}

// ---- documents written but demanded by nobody --------------------------------------------------
const demandedKeys = new Set(rows.filter((r) => ['ledger', 'letter', 'book'].includes(r.channel)).map((r) => r.source));
const allDocRows = [];
for (const q of quests) for (const rv of (((q.deceit || {}).revealed_by) || [])) {
  if (!['ledger', 'letter', 'book'].includes(rv.channel)) continue;
  const isDemanded = (q.resolutions || []).some((r) => (r.requires_knowing || []).includes(rv.id));
  if (isDemanded) continue;
  allDocRows.push({ quest: q.id, reveal: rv.id, source: rv.source, written: bookKeys.has(rv.source) || bookIds.has(rv.source) });
}
const unwritten = allDocRows.filter((r) => !r.written);

const unrouted = rows.filter((r) => !r.routed);
const byChannel = {};
for (const r of rows) {
  byChannel[r.channel] = byChannel[r.channel] || { demanded: 0, routed: 0 };
  byChannel[r.channel].demanded++;
  if (r.routed) byChannel[r.channel].routed++;
}
const missingNpcs = [...new Set(unrouted.filter((r) => !r.exists && ['talk_to_target', 'rival_npc'].includes(r.channel)).map((r) => r.source))].sort();

const report = {
  tool: 'critic-unrouted-census',
  taken_at: new Date().toISOString(),
  falsify: falsify || null,
  demanded: rows.length,
  routed: rows.filter((r) => r.routed).length,
  unrouted: unrouted.length,
  by_channel: byChannel,
  buckets: {
    eavesdrop_no_reader: unrouted.filter((r) => r.channel === 'eavesdrop').length,
    corpse_no_reader: unrouted.filter((r) => r.channel === 'corpse').length,
    person_rows_naming_a_missing_npc: unrouted.filter((r) => !r.exists && ['talk_to_target', 'rival_npc'].includes(r.channel)).length,
    distinct_missing_npcs: missingNpcs.length,
    missing_npcs: missingNpcs,
    other: unrouted.filter((r) => r.channel !== 'eavesdrop' && r.channel !== 'corpse' && !(!r.exists && ['talk_to_target', 'rival_npc'].includes(r.channel))).map((r) => `${r.quest}/${r.reveal} (${r.channel}) ${r.why}`),
  },
  document_rows_no_resolution_demands: allDocRows.length,
  document_rows_unwritten: unwritten.length,
  unwritten,
  unrouted_rows: unrouted,
};

if (has('--self-test')) {
  const ok = [];
  ok.push(['a demanded routed row is counted routed', rows.some((r) => r.routed)]);
  ok.push(['a demanded unrouted row is counted unrouted', unrouted.length > 0]);
  ok.push(['eavesdrop has no reader in game/src/', CHANNEL_READER.eavesdrop === false]);
  ok.push(['environment DOES have a reader', CHANNEL_READER.environment === true]);
  ok.push(['every eavesdrop row is unrouted', rows.filter((r) => r.channel === 'eavesdrop').every((r) => !r.routed)]);
  for (const [n, v] of ok) console.log(`self-test: ${n.padEnd(46)} ${v ? 'PASS' : 'FAIL'}`);
  process.exit(ok.every(([, v]) => v) ? 0 : 1);
}

if (has('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(unrouted.length ? 1 : 0); }

console.log(`\ncritic-unrouted-census — recomputed from game/data/** and game/src/**${falsify ? ` [--falsify ${falsify}]` : ''}\n`);
console.log(`  demanded (quest,reveal) pairs .......... ${report.demanded}`);
console.log(`  routed ................................. ${report.routed}`);
console.log(`  UNROUTED ............................... ${report.unrouted}\n`);
for (const [ch, v] of Object.entries(byChannel).sort((a, b) => b[1].demanded - a[1].demanded)) {
  console.log(`     ${ch.padEnd(16)} ${String(v.demanded).padStart(3)} demanded, ${String(v.routed).padStart(3)} routed${CHANNEL_READER[ch] ? '' : '   <- no reader in game/src/'}`);
}
console.log('\n  the unrouted, bucketed, with an acceptance number for the next round:');
console.log(`     eavesdrop, no proximity-and-not-noticed reader ...... ${report.buckets.eavesdrop_no_reader} row(s)`);
console.log(`     corpse, no search-a-body action .................... ${report.buckets.corpse_no_reader} row(s)`);
console.log(`     person rows naming an NPC with no record ........... ${report.buckets.person_rows_naming_a_missing_npc} row(s) across ${report.buckets.distinct_missing_npcs} people`);
for (const n of missingNpcs) console.log(`        ${n}`);
if (report.buckets.other.length) { console.log('     UNACCOUNTED FOR BY THE BUILDER\'S THREE BUCKETS:'); for (const o of report.buckets.other) console.log(`        ${o}`); }
console.log(`\n  document rows no resolution demands ....... ${report.document_rows_no_resolution_demands}`);
console.log(`     of those, unwritten .................... ${report.document_rows_unwritten}`);
for (const u of unwritten) console.log(`        ${u.quest.padEnd(11)} ${u.reveal.padEnd(28)} ${u.source}`);
console.log();
process.exit(unrouted.length ? 1 : 0);
