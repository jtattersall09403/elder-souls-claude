#!/usr/bin/env node
// s37-unhearable.mjs — which INFOs can no player hear from any speaker, under the reader that
// ACTUALLY RUNS. Names them, rather than counting them.
//
//   node tools/dialogue/s37-unhearable.mjs                 report + exit 1 if any are unhearable
//   node tools/dialogue/s37-unhearable.mjs --json <path>
//   node tools/dialogue/s37-unhearable.mjs --reader <path>  point at an alternative reader module
//   node tools/dialogue/s37-unhearable.mjs --break          RULES 4: reverse authored order; the
//                                                           set MUST move, or this tool is not
//                                                           reading order and is worthless
//
// WHY IT EXISTS, and why it is not `critic-reach.mjs`.
//
// ARBITRATION S37 prices its own ruling at "+6 unhearable INFOs, 8 -> 14", and a builder landing
// it has to show those six rather than assert them. Two instruments were already in the tree and
// neither can:
//
//   * `tools/dialogue/arbiter-order-divergence.mjs` §E computes 8 and 14 exactly, over the whole
//     canonical player space — but it reports COUNTS. It never says which INFOs.
//   * `tools/dialogue/critic-reach.mjs` names them, and is now STALE. It does not call the
//     reader; it MODELS it, and the model it hard-codes at its own line 111 is
//         (matchesActor ? 8 : 0) + (info.cell ? 2 : 0) + (info.requires ? 4 : 0) + ...
//     — the specificity score S37 deleted. It reported 6 before this change and 6 after it, with
//     a byte-identical output, because it is measuring an algorithm that no longer exists. Its
//     causes still read "always outscored", and under first-match-wins nothing is outscored by
//     anything. That is exactly the defect the W1-17 round-1 critic named when it said "every
//     instrument in this round was built on the losing side of that disagreement", and it is not
//     mine to repair: W1-17-r2 owns that file, has finished, and its published 136 -> 6 headline
//     is measured with it. Reported, not touched. See orchestration/status/W1-DLG-S37.json.
//
// So this tool CALLS `infoFor()`. Not a copy of it, not a model of it — the function the game
// calls, imported from the module the game imports. It cannot go green by being out of date, for
// the same reason the S37 gate cannot.
//
// METHOD, and why it is affordable. An INFO is heard iff SOME (speaker, player) resolution
// returns it, so the honest question ranges over 71,680 canonical players x 369 speakers x 468
// topics = 1.46 billion resolutions, which is not callable. But `infoFor()`'s answer for one
// topic depends on the player only through WHICH INFOS THE PLAYER ADMITS, and on the speaker only
// through which infos the speaker's actor row and cell admit. Both take very few distinct values
// per topic. So we bucket players and speakers by those bitmasks, keep one REAL representative of
// each bucket, and call the real `infoFor()` once per distinct (topic, speaker-mask, player-mask).
// That is exact — every distinct resolution class is actually executed — and it is a few tens of
// thousands of calls instead of a few billion.
//
// The player axes are read out of the corpus, not assumed: every race and upbringing in
// `race-reactions.json`, one representative disposition per authored `d` threshold (those
// partition [0,100] into every class the corpus can distinguish), and every subset of the
// knowledge flags the corpus's own gates name.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';
import { loadTopicDocs, loadNpcs } from './answer-census.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const ARGV = process.argv.slice(2);
const BREAK = ARGV.includes('--break');
const JSONOUT = (() => { const i = ARGV.indexOf('--json'); return i >= 0 ? ARGV[i + 1] : null; })();
const READER = (() => { const i = ARGV.indexOf('--reader'); return i >= 0 ? ARGV[i + 1] : null; })();

const readerPath = READER
  ? url.pathToFileURL(path.resolve(ROOT, READER)).href
  : new URL('../../game/src/character/converse.js', import.meta.url).href;
const reader = await import(readerPath);
const { buildTopicIndex, infoAllowed, infoFor } = reader;
for (const [n, f] of Object.entries({ buildTopicIndex, infoAllowed, infoFor })) {
  if (typeof f !== 'function') { console.error(`reader ${readerPath} does not export ${n}()`); process.exit(2); }
}

// Speaker-side filter field 6 — Cell. Copied from converse.js, which does not export it. This is
// a FILTER under both algorithms and was never in dispute; the copy is inert with respect to the
// selection rule the tool is measuring.
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
const factionKey = (v) => String(v || '').toLowerCase().replace(/[_\s]+/g, '-');

const docs = loadTopicDocs();
const npcs = loadNpcs();

// --break: reverse every authored info list. Under first-match-wins that must move the answer in
// any topic with more than one live candidate, so it must move this census. If it does not, the
// tool is not reading authored order and no number it prints means anything.
if (BREAK) {
  let touched = 0;
  for (const d of docs) for (const t of (d.topics || [])) {
    if (Array.isArray(t.infos) && t.infos.length > 1) { t.infos.reverse(); touched++; }
  }
  console.log(`--break: authored order reversed in ${touched} topic record(s).`);
}

// ---- the player space, read out of the corpus ------------------------------------------------
const rr = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8'));
const races = rr.races.slice();
const upbringings = rr.upbringings.map((u) => u.id);
const dSet = new Set(), knowsSet = new Set();
for (const doc of docs) for (const t of (doc.topics || [])) for (const i of (t.infos || [])) {
  if (i.d != null) dSet.add(Number(i.d));
  for (const k of ['requires', 'forbids']) {
    const g = i[k]; if (!g) continue;
    for (const f of ['knows', 'knows_all']) if (Array.isArray(g[f])) for (const x of g[f]) knowsSet.add(x);
  }
}
const dispositions = [0, ...[...dSet].sort((a, b) => a - b)];
const flags = [...knowsSet].sort();
const players = [];
for (const race of races) for (const upbringing of upbringings) for (const disposition of dispositions) {
  for (let m = 0; m < (1 << flags.length); m++) {
    const knows = new Set();
    for (let b = 0; b < flags.length; b++) if (m & (1 << b)) knows.add(flags[b]);
    players.push({ race, upbringing, disposition, knows });
  }
}

// ---- the census ------------------------------------------------------------------------------
const idx = buildTopicIndex(docs);
const topicIds = [...new Set(docs.flatMap((d) => (d.topics || [])
  .filter((t) => t && typeof t.id === 'string').map((t) => t.id)))].sort();

const heard = new Set();          // "<topic id>#<index>"
const all = [];                   // {key, topic, index, info}
let calls = 0, resolutionClasses = 0;

for (const tid of topicIds) {
  const t = idx.get(topicKey(tid));
  if (!t || !t.infos.length) continue;
  const n = t.infos.length;
  if (n > 30) { console.error(`topic ${t.id} has ${n} infos; the bitmask holds 30.`); process.exit(2); }
  for (let i = 0; i < n; i++) all.push({ key: `${t.id}#${i}`, topic: t.id, index: i, info: t.infos[i] });

  // An info's identity in the RETURNED literal. infoFor() returns a fresh object, so the winner
  // is matched back to its index on the fields the literal carries. Where two infos are identical
  // on all of them they are indistinguishable to any consumer, and both are marked heard.
  const ident = (o) => JSON.stringify([o.x ?? o.text ?? null, o.a ?? o.actor ?? null, o.cell ?? null, o.from ?? null]);
  const byIdent = new Map();
  for (let i = 0; i < n; i++) {
    const k = ident(t.infos[i]);
    if (!byIdent.has(k)) byIdent.set(k, []);
    byIdent.get(k).push(i);
  }

  // player buckets — one real representative each
  const pMask = new Map();
  for (const p of players) {
    let m = 0;
    for (let i = 0; i < n; i++) if (infoAllowed(t.infos[i], p)) m |= (1 << i);
    if (!pMask.has(m)) pMask.set(m, p);
  }
  // speaker buckets — one real representative each. The npc-own-line short-circuit returns before
  // the topic list is consulted at all, so those speakers cannot make a corpus info heard.
  const lk = topicKey(tid).split(' ').join('_');
  const sMask = new Map();
  for (const npc of npcs) {
    if (npc.lines && npc.lines[lk]) continue;
    const actor = npc.actor || null;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const info = t.infos[i];
      if (info.cell && !inCell(npc, info.cell)) continue;
      if (info.f && factionKey(npc.faction) !== factionKey(info.f)) continue;
      const matchesActor = actor && info.a === actor;
      if (!matchesActor && info.a) continue;
      m |= (1 << i);
    }
    if (m && !sMask.has(m)) sMask.set(m, npc);
  }

  for (const [sm, npc] of sMask) for (const [pm, p] of pMask) {
    if ((sm & pm) === 0) continue;
    resolutionClasses++;
    // THE LIVE READER. Not a model of it.
    const got = infoFor(idx, tid, npc, p);
    calls++;
    if (!got) continue;
    for (const i of (byIdent.get(ident(got)) || [])) heard.add(`${t.id}#${i}`);
  }
}

const dead = all.filter((a) => !heard.has(a.key));

// ---- report ----------------------------------------------------------------------------------
const commit = (() => {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); }
  catch { return 'unknown'; }
})();

console.log(`s37-unhearable — the LIVE reader: ${path.relative(ROOT, url.fileURLToPath(readerPath))}`);
console.log(`corpus: ${all.length} infos across ${topicIds.length} topics; ${npcs.length} speakers`);
console.log(`player space: ${races.length} races x ${upbringings.length} upbringings x ${dispositions.length} dispositions x ${1 << flags.length} knowledge sets = ${players.length.toLocaleString()}`);
console.log(`resolution classes actually executed through infoFor(): ${calls.toLocaleString()}`);
console.log(`\nINFOS NO PLAYER CAN EVER HEAR FROM ANY SPEAKER:  ${dead.length}  (${(100 * dead.length / all.length).toFixed(1)}%)\n`);
for (const d of dead) {
  const f = {};
  for (const k of ['a', 'cell', 'd', 'requires', 'forbids']) if (d.info[k] !== undefined) f[k] = d.info[k];
  console.log(`  ${d.key}   [${d.info.from || 'no group'}]`);
  console.log(`      filter ${JSON.stringify(f)}`);
  console.log(`      text   ${JSON.stringify(String(d.info.x || '').slice(0, 110))}`);
}

if (JSONOUT) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, JSONOUT)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, JSONOUT), JSON.stringify({
    commit, reader: path.relative(ROOT, url.fileURLToPath(readerPath)), broken: BREAK,
    infos: all.length, topics: topicIds.length, speakers: npcs.length,
    players: players.length, resolution_classes: calls,
    unhearable: dead.length,
    keys: dead.map((d) => d.key),
    detail: dead.map((d) => ({ key: d.key, topic: d.topic, index: d.index, from: d.info.from || null, a: d.info.a || null, cell: d.info.cell || null, d: d.info.d ?? null, text: d.info.x || null })),
  }, null, 2) + '\n');
  console.log(`\njson -> ${JSONOUT}`);
}
console.log(`\nmeasured at commit ${commit} (RULES 12 — a number is a claim about a commit)`);

if (BREAK) { console.log('\n--break arm: compare this set with the unbroken run. If it did not move, this tool does not read authored order.'); process.exit(0); }
if (dead.length) { console.error('\nFAIL: authored dialogue exists that no character can reach (RI-DLG01 §D).'); process.exit(1); }
console.log('\nOK: every authored info is reachable by somebody.');
