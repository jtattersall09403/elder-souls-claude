#!/usr/bin/env node
// critic-w1-17 instrument 2 — FIRST-MATCH-WINS versus THE SHIPPED SCORING READER.
//
//   node tools/dialogue/critic-semantics.mjs
//   node tools/dialogue/critic-semantics.mjs --break
//
// WHY THIS EXISTS. RI-DLG01 §A is unambiguous about the selection rule:
//
//   "Selection rule — first-match-wins in authored file order. The engine walks the topic's
//    INFO list top to bottom and returns the first entry whose *entire* conjunction passes.
//    It does **not** score specificity. Ordering is authored, not computed. ... our
//    implementation keeps first-match-wins semantics ... but MUST expose a lint that flags any
//    INFO whose filter set is a strict superset of an earlier INFO's in the same topic."
//
// `game/src/character/converse.js infoFor()` does not do that. It computes
//   score = 8*actorMatch + 2*cell + 4*requires + dScore + 0.5*forbids
// and keeps the strict maximum, breaking ties by authored order. Its own comment says so.
//
// That matters far beyond style, because the whole of W1-17's headline rests on a lint written
// for the OTHER semantics:
//
//   * `build-graph.mjs`'s unreachable-INFO lint implements RI-DLG01 §D's "filter[j] ⊇ filter[i]
//     ⇒ j unreachable" rule. Under first-match-wins that is sound. Under scoring it is neither
//     sound nor complete: a strictly-narrower later info OUTSCORES the earlier one and is very
//     much reachable (this is why the three survivors are demonstrably spoken), while a genuine
//     shadow under scoring is a TIE broken by file order, which the superset test never sees.
//   * `order-infos.mjs --write` sorts each topic most-constrained-first — a first-match-wins
//     repair — and `answer-census.mjs --diff` found it changed 0 of 75,151 answers. That is
//     presented as proof the fix was safe. It is equally consistent with the fix being
//     irrelevant, because the reader it was measured against only consults order on ties.
//
// So this tool measures three things the project has never measured:
//
//   A. TIE MASS — how many resolutions are decided by authored order at all. If this is small,
//      `order-infos --write` could not have changed much whatever it did, and its inertness is
//      not evidence of care.
//   B. SEMANTIC DIVERGENCE — resolve every (speaker, player, topic) under the shipped scoring
//      reader and under RI-DLG01 §A's mandated first-match-wins reader, and count how many
//      answers differ. This is the number that says whether the corpus is authored for one rule
//      and read by another.
//   C. TRUE SHADOWS UNDER THE SHIPPED RULE — infos that no (speaker, player) pair in the whole
//      province can ever hear, computed against the reader that actually runs, not against the
//      superset test.
//
// BREAK ARM (RULES §4): --break makes the reference reader identical to the shipped one, so
// divergence must collapse to 0 and the tool exits 1. A comparator that cannot report agreement
// as agreement is not comparing.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex, infoAllowed } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs, PLAYERS } from './answer-census.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const BREAK = process.argv.includes('--break');

// ---- a verbatim re-derivation of infoFor()'s candidate filter, so both readers see exactly the
// same admissible set and only the CHOICE RULE differs. Copied deliberately rather than imported,
// because infoFor() fuses the filter and the choice into one loop.
function inCell(npc, cell) {
  if (!cell) return true;
  const want = String(cell).toLowerCase();
  for (const v of [npc.settlement, npc.cell, npc.interior, npc.home_interior, npc.work_interior]) {
    if (!v) continue;
    const s = String(v).toLowerCase();
    if (s === want || s.startsWith(want + '-') || s.startsWith(want + '.')) return true;
  }
  return false;
}
function candidates(t, npc, player) {
  const actor = npc.actor || null;
  const out = [];
  for (let i = 0; i < t.infos.length; i++) {
    const info = t.infos[i];
    if (!infoAllowed(info, player)) continue;
    if (info.cell && !inCell(npc, info.cell)) continue;
    const matchesActor = actor && info.a === actor;
    if (!matchesActor && info.a) continue;
    const dScore = info.d != null ? 1 + Math.min(1, Number(info.d) / 100) : 0;
    const score = (matchesActor ? 8 : 0) + (info.cell ? 2 : 0) + (info.requires ? 4 : 0) + dScore + (info.forbids ? 0.5 : 0);
    out.push({ i, info, score });
  }
  return out;
}
// THE SHIPPED RULE: strict maximum, first of the tied group wins.
const byScore = (c) => { let b = null; for (const x of c) if (!b || x.score > b.score) b = x; return b; };
// RI-DLG01 §A's RULE: the first admissible entry in authored order, full stop.
const byOrder = (c) => (c.length ? c[0] : null);

const docs = loadTopicDocs();
const npcs = loadNpcs();
const idx = buildTopicIndex(docs);
const topicIds = [...new Set(docs.flatMap((d) => (d.topics || []).filter((t) => t && typeof t.id === 'string').map((t) => t.id)))].sort();

let resolutions = 0, ties = 0, diverged = 0, tieTopics = new Set();
const divergences = [];
const heardScore = new Set(), heardOrder = new Set();
const infoTotal = new Set();

for (const [, t] of idx) for (let i = 0; i < t.infos.length; i++) infoTotal.add(`${t.id}#${i}`);

for (const npc of npcs) {
  for (const p of PLAYERS) {
    for (const tid of topicIds) {
      if (npc.lines && npc.lines[topicKey(tid).split(' ').join('_')]) continue; // npc-own-line short-circuit
      const t = idx.get(topicKey(tid));
      if (!t) continue;
      const c = candidates(t, npc, p);
      if (!c.length) continue;
      resolutions++;
      const s = byScore(c);
      const o = BREAK ? byScore(c) : byOrder(c);
      const top = Math.max(...c.map((x) => x.score));
      const nTop = c.filter((x) => x.score === top).length;
      if (nTop > 1) { ties++; tieTopics.add(t.id); }
      heardScore.add(`${t.id}#${s.i}`);
      heardOrder.add(`${t.id}#${o.i}`);
      if (s.i !== o.i) {
        diverged++;
        if (divergences.length < 12) divergences.push({ npc: npc.id, actor: npc.actor, player: p.id, topic: t.id, scored: s.info.x, ordered: o.info.x });
      }
    }
  }
}

const dead = [...infoTotal].filter((k) => !heardScore.has(k));

console.log('critic-semantics — RI-DLG01 §A first-match-wins vs the shipped scoring reader');
console.log(`mode: ${BREAK ? 'BREAK (reference reader = shipped reader)' : 'shipped'}`);
console.log(`space: ${npcs.length} speakers x ${PLAYERS.length} players x ${topicIds.length} topics`);
console.log('');
console.log(`A. resolutions (a candidate set was non-empty)      ${resolutions}`);
console.log(`   decided by a TIE, i.e. by authored order          ${ties}  (${(100 * ties / Math.max(1, resolutions)).toFixed(2)}%)`);
console.log(`   distinct topics that ever tie                     ${tieTopics.size}`);
console.log('');
console.log(`B. answers where the two rules DISAGREE              ${diverged}  (${(100 * diverged / Math.max(1, resolutions)).toFixed(2)}%)`);
console.log('');
console.log(`C. infos in the corpus                               ${infoTotal.size}`);
console.log(`   never spoken by ANY speaker to ANY player`);
console.log(`     under the SHIPPED scoring reader                ${dead.length}`);
console.log(`     under RI-DLG01 §A first-match-wins              ${[...infoTotal].filter((k) => !heardOrder.has(k)).length}`);
console.log('');
for (const d of divergences) {
  console.log(`  ${d.topic}  (${d.actor} ${d.npc}, ${d.player})`);
  console.log(`    scored : ${String(d.scored).slice(0, 110)}`);
  console.log(`    ordered: ${String(d.ordered).slice(0, 110)}`);
}
if (dead.length) {
  console.log('');
  console.log(`  first 25 infos no one in the province can ever hear (shipped reader):`);
  for (const k of dead.slice(0, 25)) console.log(`    ${k}`);
}

if (BREAK) {
  if (diverged === 0) { console.log('\nBREAK ARM OK — with the reference rule replaced by the shipped rule, divergence is 0.'); process.exit(1); }
  console.log('\nBREAK ARM FAILED — the comparator reports disagreement between a reader and itself.');
  process.exit(2);
}
console.log(diverged > 0
  ? '\nFAIL: the corpus is read by a rule RI-DLG01 §A does not specify, and the two rules give different answers.'
  : '\nPASS: the two rules agree on every resolution in the province.');
process.exit(diverged > 0 ? 1 : 0);
