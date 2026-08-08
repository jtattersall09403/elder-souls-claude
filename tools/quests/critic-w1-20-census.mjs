#!/usr/bin/env node
// critic-w1-20-census.mjs — the W1-20 critic's static census. Declared under `method_deviations`.
//
// Every number in the W1-20 verdict that is a COUNT over shipped data is produced here, so that a
// reader can re-derive it with one command instead of trusting a table. It answers four questions
// the verdict scores on:
//
//   Q1  RI-QST01 volume.  Quests per faction line and mean quests per rank, against the item's
//       hard-fail floor of 18 total / no empty rank band / mean >= 2.0.
//   Q2  RI-QST01 honesty.  "Any faction line where every quest is honest (deceit == null
//       throughout) -> fail."
//   Q3  RI-QST03 method 4, the COMPLETABILITY hard fail.  Total earnable faction_reputation per
//       line against that line's own rank-7 requirement. Hard fail if earnable < rank-7, and hard
//       fail if earnable == 0 (the Fighters Guild bug). Warn above 1.6x.
//   Q4  The consumer census.  Which factions own a `faction_interior` anywhere in the populated
//       world, and which carry expulsion/readmission — i.e. which ladders can reach the property,
//       trespass and discipline systems at all.
//
// Q3 sums the QUEST-level and RESOLUTION-level `faction_reputation` the way `mergeConsequences()`
// does, which is the whole point: reading either alone gives half the true figure, and reading the
// resolution alone is how the round came to report 10 where a player receives 20.
//
// RUN: node tools/quests/critic-w1-20-census.mjs [--out <file>]
// Exit 0 = no hard fail. Exit 1 = at least one RI-QST01 or RI-QST03 hard fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `critic-w1-20-census.mjs — faction volume, honesty, completability and consumers.\n  --out <file>   default reports/critic-w1-20/census.json\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-w1-20', 'census.json');

const QDIR = path.join(ROOT, 'game', 'data', 'quests');
const gates = JSON.parse(fs.readFileSync(path.join(QDIR, 'faction-gates.json'), 'utf8'));

// ---- read every quest once.
const quests = [];
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json') && x !== 'hooks.json' && x !== 'faction-gates.json')) {
  let doc; try { doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')); } catch { continue; }
  for (const q of doc.quests || []) quests.push({ ...q, _file: f });
}

// ---- Q3 helper: what one quest pays a faction, the way mergeConsequences() sums it.
// The quest-level consequences apply on completion AND the chosen resolution's do too, so a
// player receives BOTH. Taking the max, or reading only the resolution, understates it.
function paysBestCase(q, fac) {
  const atQuest = (((q.consequences || {}).faction_reputation) || {})[fac] || 0;
  let bestRes = 0;
  for (const r of q.resolutions || []) {
    const v = (((r.consequences || {}).faction_reputation) || {})[fac] || 0;
    if (v > bestRes) bestRes = v;
  }
  return { quest_level: atQuest, best_resolution: bestRes, total: atQuest + bestRes };
}

const lines = [];
const hardFails = [];
const warnings = [];

for (const f of gates.factions) {
  const id = f.id;
  const ranks = f.ranks || [];
  const rank7 = (ranks.find((r) => r.rank === 7) || {}).reputation ?? null;

  const mine = quests.filter((q) => q.category === 'faction' && q.faction === id);
  const total = mine.length;
  const perRank = ranks.length ? total / ranks.length : 0;
  const withDeceit = mine.filter((q) => q.deceit != null).length;

  // Empty rank bands: which ranks 0-7 have no quest gated at them.
  const byGate = {};
  for (const q of mine) {
    const g = q.rank_gate && q.rank_gate.min_rank != null ? q.rank_gate.min_rank : 0;
    byGate[g] = (byGate[g] || 0) + 1;
  }
  const emptyBands = ranks.map((r) => r.rank).filter((r) => !byGate[r]);

  // Q3 — earnable, over EVERY quest in the book that pays this faction, not only its own line.
  let earnable = 0;
  const payers = [];
  for (const q of quests) {
    const p = paysBestCase(q, id);
    if (p.total > 0) { earnable += p.total; payers.push({ quest: q.id, ...p }); }
  }

  const line = {
    faction: id, ranks: ranks.length, rank7_reputation: rank7,
    faction_category_quests: total,
    mean_quests_per_rank: +perRank.toFixed(2),
    quests_with_deceit: withDeceit,
    empty_rank_bands: emptyBands,
    earnable_reputation_best_case: earnable,
    earnable_over_rank7: rank7 ? +(earnable / rank7).toFixed(2) : null,
    paying_quests: payers.length,
  };

  // RI-QST01 hard fails.
  if (total < 18) hardFails.push(`RI-QST01 volume: ${id} has ${total} faction quests, below the floor of 18`);
  if (perRank < 2.0) hardFails.push(`RI-QST01 volume: ${id} mean quests per rank ${perRank.toFixed(2)}, below the floor of 2.0`);
  if (emptyBands.length) hardFails.push(`RI-QST01 volume: ${id} has ${emptyBands.length} EMPTY rank band(s): ${emptyBands.join(', ')}`);
  if (total > 0 && withDeceit === 0) hardFails.push(`RI-QST01 honesty: ${id} has ${total} faction quests and deceit == null on every one`);

  // RI-QST03 method 4 hard fails.
  if (earnable === 0) hardFails.push(`RI-QST03 §4: ${id} earnable reputation is 0 — the Fighters Guild bug`);
  else if (rank7 != null && earnable < rank7) hardFails.push(`RI-QST03 §4: ${id} earnable ${earnable} < rank-7 requirement ${rank7} — the ladder cannot be completed`);
  else if (rank7 != null && earnable > 1.6 * rank7) warnings.push(`RI-QST03 §4: ${id} earnable ${earnable} is ${(earnable / rank7).toFixed(2)}x its rank-7 requirement of ${rank7} — above the 1.6x slack warning, gating is loose`);

  lines.push(line);
}

// ---- Q4 the consumer census.
const propDir = path.join(ROOT, 'game', 'data', 'world', 'property');
const halls = {};
function walkZones(o) {
  if (Array.isArray(o)) { for (const v of o) walkZones(v); return; }
  if (o && typeof o === 'object') {
    if (o.class === 'faction_interior' && o.faction) (halls[o.faction] = halls[o.faction] || []).push(o.id);
    for (const v of Object.values(o)) walkZones(v);
  }
}
for (const f of fs.readdirSync(propDir).filter((x) => x.endsWith('.json'))) {
  try { walkZones(JSON.parse(fs.readFileSync(path.join(propDir, f), 'utf8'))); } catch { /* skip */ }
}

const disc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'data', 'progression', 'faction-discipline.json'), 'utf8'));
const withDiscipline = (disc.factions || []).map((x) => x.faction);
const withReadmission = (disc.factions || []).filter((x) => x.readmission).map((x) => x.faction);

const out = {
  commit_note: 'run `git rev-parse --short HEAD` alongside this file; every number is a count over shipped data',
  total_quests_in_book: quests.length,
  lines,
  consumers: {
    faction_interior_zones_by_faction: Object.fromEntries(Object.entries(halls).map(([k, v]) => [k, v.length])),
    ladders_with_no_hall_anywhere: gates.factions.map((f) => f.id).filter((id) => !Object.keys(halls).some((h) => id.replace(/^the_/, '').replace(/_/g, '-') === h)),
    lines_with_expulsion: withDiscipline,
    lines_with_readmission: withReadmission,
  },
  hard_fails: hardFails,
  warnings,
};
writeJson(OUT, out);

console.log(`critic-w1-20-census: ${quests.length} quests in the book; wrote ${OUT}`);
console.log(`${'faction'.padEnd(22)} ${'q'.padStart(3)} ${'q/rank'.padStart(7)} ${'deceit'.padStart(7)} ${'empty bands'.padStart(12)} ${'earnable'.padStart(9)} ${'/rank7'.padStart(7)}`);
for (const l of lines) {
  console.log(`${l.faction.padEnd(22)} ${String(l.faction_category_quests).padStart(3)} ${String(l.mean_quests_per_rank).padStart(7)} ${String(l.quests_with_deceit).padStart(7)} ${String(l.empty_rank_bands.length).padStart(12)} ${String(l.earnable_reputation_best_case).padStart(9)} ${String(l.earnable_over_rank7).padStart(7)}`);
}
console.log(`\nfaction_interior zones: ${JSON.stringify(out.consumers.faction_interior_zones_by_faction)}`);
console.log(`ladders with NO hall anywhere: ${out.consumers.ladders_with_no_hall_anywhere.join(', ')}`);
console.log(`expulsion+readmission: ${withReadmission.join(', ')}`);
console.log(`\nHARD FAILS (${hardFails.length}):`);
for (const h of hardFails) console.log(`  ! ${h}`);
console.log(`WARNINGS (${warnings.length}):`);
for (const w of warnings) console.log(`  ~ ${w}`);
process.exit(hardFails.length ? 1 : 0);
