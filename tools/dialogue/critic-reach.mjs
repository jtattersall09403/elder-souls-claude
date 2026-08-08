#!/usr/bin/env node
// critic-w1-17 instrument 3 — CAN ANY PLAYER, ANYWHERE, EVER HEAR THIS LINE?
//
//   node tools/dialogue/critic-reach.mjs
//   node tools/dialogue/critic-reach.mjs --break
//
// WHY THIS EXISTS. W1-17's headline is "unreachable INFOs 194 -> 3", and the two instruments
// behind it cannot support it:
//
//   * `build-graph.mjs`'s lint implements RI-DLG01 §D's superset test, which is the correct test
//     for FIRST-MATCH-WINS. `converse.js infoFor()` does not take the first match; it takes the
//     strict maximum of a specificity score. `tools/dialogue/critic-semantics.mjs` measures 0
//     ties in 75,948 resolutions, so authored order decides nothing at all — which makes the
//     superset test neither sound nor complete against the reader that runs.
//   * `shadow-audit.mjs` audits exactly the records the lint nominated (3 of them) and reports
//     "0 genuinely unreachable". It is a confirmer of the lint's output, not an audit of the
//     corpus: by construction it can never find a line the lint missed.
//
// So nothing in the tree asks the question a player cares about: *is there any character I could
// roll, and any person I could stand in front of, who would say this sentence to me?*
//
// METHOD. The winner of a candidate set under `infoFor()` is the highest-SCORING admissible info,
// and the score is a function of the info's own fields only — never of the player. So for a fixed
// (topic, speaker) the infos have a fixed priority order, and info j is heard iff some player
// satisfies j's player-side gates while failing those of every info above it. That is decidable
// by enumeration over the player-gate domains, which are small and are read out of the corpus
// rather than assumed:
//
//   race         the 10 authored in requires.race / forbids.race
//   upbringing   the 4 in game/data/progression/race-reactions.json — the roster the shipped
//                `character/reaction.js raceTerm()` accepts. NOTE: `answer-census.mjs PLAYERS`
//                uses `marsh` / `town` / `legion` / `coast`, none of which are on it; raceTerm()
//                THROWS on all four. The project's census, its shadow audit and its CONSUMPTION
//                tool all run against characters the game cannot construct.
//   disposition  every authored `d` value, plus 0 and 100
//   knows        the empty set, the full set, and each authored flag alone
//
// Speaker-side gates (`a`, `cell`) are evaluated against the real 347-person roster, so a line
// written for an actor nobody in the province is, or for a town no such actor stands in, is
// correctly reported dead.
//
// BREAK ARM (RULES §4): --break forces every player-side gate true. The dead count must MOVE, and
// it moves UP, not down — 133 -> 226 — because a lower-scoring info is only ever reachable when a
// player-side gate blocks the info above it. Disabling the gates therefore collapses 93 infos into
// the "always outscored" bucket, which goes 3 -> 96. That is the arm: the instrument is reading
// the gates, and it also measures something worth knowing on its own — 93 of this corpus's infos
// exist solely because a race, upbringing, knowledge or disposition gate above them can close.
// If the two arms agree, the gates are not being read and the tool exits 2.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs } from './answer-census.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BREAK = process.argv.includes('--break');
const VERBOSE = process.argv.includes('--all');

const docs = loadTopicDocs();
const npcs = loadNpcs();
const idx = buildTopicIndex(docs);

// ---- the player-gate domains, read out of the corpus ------------------------------------------
const RACES = new Set(), UPS = new Set(), KNOWS = new Set(), DS = new Set([0, 100]);
for (const [, t] of idx) for (const i of t.infos) {
  if (i.d != null) DS.add(Number(i.d));
  for (const g of [i.requires, i.forbids]) {
    if (!g) continue;
    (g.race || []).forEach((x) => RACES.add(x));
    (g.upbringing || []).forEach((x) => UPS.add(x));
    [...(g.knows || []), ...(g.knows_all || [])].forEach((x) => KNOWS.add(x));
  }
}
const upRoster = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8')).upbringings.map((u) => u.id);
for (const u of upRoster) UPS.add(u);
const races = [...RACES].sort(), ups = [...UPS].sort(), ds = [...DS].sort((a, b) => a - b);
const knowsSets = [new Set(), new Set(KNOWS), ...[...KNOWS].map((k) => new Set([k]))];

const PLAYERS = [];
for (const race of races) for (const upbringing of ups) for (const disposition of ds) for (const knows of knowsSets) PLAYERS.push({ race, upbringing, disposition, knows });

// ---- the player-side half of infoAllowed(), verbatim ------------------------------------------
function playerAllows(info, p) {
  if (BREAK) return true;
  const req = info.requires || null, forb = info.forbids || null;
  if (req && Array.isArray(req.race) && req.race.indexOf(p.race) < 0) return false;
  if (req && Array.isArray(req.upbringing) && req.upbringing.indexOf(p.upbringing) < 0) return false;
  if (forb && Array.isArray(forb.race) && forb.race.indexOf(p.race) >= 0) return false;
  if (forb && Array.isArray(forb.upbringing) && forb.upbringing.indexOf(p.upbringing) >= 0) return false;
  if (info.d != null && Number(p.disposition) < Number(info.d)) return false;
  if (p.knows) {
    if (req && Array.isArray(req.knows) && !req.knows.some((k) => p.knows.has(k))) return false;
    if (req && Array.isArray(req.knows_all) && !req.knows_all.every((k) => p.knows.has(k))) return false;
    if (forb && Array.isArray(forb.knows) && forb.knows.some((k) => p.knows.has(k))) return false;
  }
  return true;
}
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
const scoreOf = (info, matchesActor) =>
  (matchesActor ? 8 : 0) + (info.cell ? 2 : 0) + (info.requires ? 4 : 0)
  + (info.d != null ? 1 + Math.min(1, Number(info.d) / 100) : 0) + (info.forbids ? 0.5 : 0);

// ---- reachability ------------------------------------------------------------------------------
const reachable = new Set();          // "topic#idx"
const speakerAdmits = new Map();      // "topic#idx" -> true if some speaker passes the speaker gates
const memo = new Map();

for (const [, t] of idx) {
  for (const npc of npcs) {
    const actor = npc.actor || null;
    const cand = [];
    for (let i = 0; i < t.infos.length; i++) {
      const info = t.infos[i];
      if (info.cell && !inCell(npc, info.cell)) continue;
      const matchesActor = actor && info.a === actor;
      if (!matchesActor && info.a) continue;
      cand.push({ i, info, s: scoreOf(info, matchesActor) });
      speakerAdmits.set(`${t.id}#${i}`, true);
    }
    if (!cand.length) continue;
    cand.sort((a, b) => (b.s - a.s) || (a.i - b.i));   // infoFor(): strict max, first of a tie
    // MEMO KEY — CORRECTED IN W1-17 ROUND 2, AND THE OLD KEY WAS WRONG IN A WAY THAT MOVED THE
    // HEADLINE NUMBER. `memo` is a single Map shared across every topic, and the key used to be
    // `JSON.stringify(cand.map(c => c.i))` — the candidate INDEX LIST and nothing else. Two
    // unrelated topics whose surviving candidates happen to sit at the same indices (`[2,3]` is
    // extremely common) therefore shared one winner set, and whichever topic was visited first
    // decided reachability for all of them. Measured: `reading-the-count#2` was reported dead
    // while `ledgerer-hosk-vei` demonstrably says it at disposition 0 and 15 through the shipped
    // `infoFor()`. The key must identify the actual candidates and their scores, not their
    // positions, so it now carries the topic and the (index, score) pairs. `--break` still moves
    // the count, so the gates are still being read.
    const sig = `${t.id}|${JSON.stringify(cand.map((c) => [c.i, c.s]))}`;
    let winners = memo.get(sig);
    if (!winners) {
      winners = new Set();
      for (const p of PLAYERS) {
        for (const c of cand) if (playerAllows(c.info, p)) { winners.add(c.i); break; }
      }
      memo.set(sig, winners);
    }
    for (const i of winners) reachable.add(`${t.id}#${i}`);
  }
}

let total = 0;
const dead = [];
for (const [, t] of idx) for (let i = 0; i < t.infos.length; i++) {
  total++;
  const k = `${t.id}#${i}`;
  if (reachable.has(k)) continue;
  const info = t.infos[i];
  dead.push({
    k, topic: t.id, i,
    cause: !speakerAdmits.has(k)
      ? (info.a && !npcs.some((n) => n.actor === info.a) ? `no such actor in the roster: ${info.a}`
        : info.cell ? `no ${info.a || 'speaker'} stands in ${info.cell}` : 'no speaker passes its gates')
      : 'always outscored — a higher-scoring info is admissible to every player this one is',
    filter: { a: info.a, cell: info.cell, d: info.d, req: info.requires, forb: info.forbids },
    x: String(info.x || '').slice(0, 100),
    from: t.infos[i].from || null,
  });
}

const byCause = {};
for (const d of dead) { const c = d.cause.replace(/: .*/, ''); byCause[c] = (byCause[c] || 0) + 1; }

console.log('critic-reach — every info in the province, against the reader that actually runs');
console.log(`mode: ${BREAK ? 'BREAK (all player gates forced true)' : 'shipped'}`);
console.log(`player space: ${races.length} races x ${ups.length} upbringings x ${ds.length} dispositions x ${knowsSets.length} knowledge sets = ${PLAYERS.length}`);
console.log(`speakers: ${npcs.length}   topics: ${idx.size}   infos: ${total}`);
console.log('');
console.log(`INFOS NO PLAYER CAN EVER HEAR FROM ANY SPEAKER:  ${dead.length}  (${(100 * dead.length / total).toFixed(1)}%)`);
console.log(`build-graph.mjs reports:                          3`);
console.log(`shadow-audit.mjs audits:                          3 (exactly the 3 the lint nominated)`);
console.log('');
console.log('by cause:');
for (const [c, n] of Object.entries(byCause).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`);
console.log('');
const show = VERBOSE ? dead : dead.slice(0, 30);
for (const d of show) {
  console.log(`  ${d.k}`);
  console.log(`      filter ${JSON.stringify(d.filter)}`);
  console.log(`      cause  ${d.cause}`);
  console.log(`      text   "${d.x}…"`);
}
if (!VERBOSE && dead.length > 30) console.log(`  … ${dead.length - 30} more (--all)`);

fs.mkdirSync(path.join(ROOT, 'reports/critic-w1-17'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `reports/critic-w1-17/reach${BREAK ? '-break' : ''}.json`),
  JSON.stringify({ mode: BREAK ? 'break' : 'shipped', players: PLAYERS.length, speakers: npcs.length, infos: total, dead: dead.length, by_cause: byCause, rows: dead }, null, 2));

if (BREAK) {
  const outscored = byCause['always outscored — a higher-scoring info is admissible to every player this one is'] || 0;
  console.log('\nBREAK ARM: player gates disabled.');
  console.log(`  "always outscored" bucket: ${outscored}  (shipped arm: 3)`);
  if (outscored <= 3) { console.log('  BREAK ARM FAILED — disabling every player gate changed nothing; the gates are not being read.'); process.exit(2); }
  console.log(`  OK — ${outscored - 3} infos are reachable ONLY because a player-side gate can close above them.`);
  process.exit(0);
}
console.log(dead.length ? '\nFAIL: authored dialogue exists that no character can reach.' : '\nPASS');
process.exit(dead.length ? 1 : 0);
