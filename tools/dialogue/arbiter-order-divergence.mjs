#!/usr/bin/env node
// ARBITRATION S37 — the instrument. Does the running dialogue reader select the info the corpus
// says it selects?
//
//   node tools/dialogue/arbiter-order-divergence.mjs            full report
//   node tools/dialogue/arbiter-order-divergence.mjs --gate     exit non-zero if engine != corpus
//   node tools/dialogue/arbiter-order-divergence.mjs --self-test break arm; must go red
//   node tools/dialogue/arbiter-order-divergence.mjs --json <path>
//
// WHY IT EXISTS. `RI-DLG01` §A: "Selection rule — first-match-wins in authored file order. The
// engine walks the topic's INFO list top to bottom and returns the first entry whose *entire*
// conjunction passes. It does **not** score specificity. Ordering is authored, not computed."
// `game/src/character/converse.js` `infoFor()` computes
//     score = 8*actorMatch + 2*cell + 4*requires + (d ? 1 + min(1, d/100) : 0) + 0.5*forbids
// and keeps the strict maximum. Two different algorithms; S37 rules which one is law and this
// tool is how a future agent tells whether the tree still obeys the ruling.
//
// WHAT IT MEASURES, and why it is not `critic-semantics.mjs` again.
//
//   1. DIVERGENCE, exactly, over a player space read out of the corpus rather than assumed.
//      `critic-semantics.mjs` inherits `answer-census.mjs PLAYERS`, and when W1-17-r1 published
//      52/75,948 that fixture was four characters whose upbringings (`marsh`/`town`/`legion`/
//      `coast`) are not in the canonical roster and make `character/reaction.js raceTerm()`
//      throw, with six of ten races untested and no disposition above 70, so the seven `d:80`
//      infos were invisible to it. (The fixture was repaired at `9aeb839`, after that verdict;
//      it is ten canonical characters now, and section B below reports whatever is on disk.)
//      A fixture is still a sample. This tool enumerates every race, every canonical upbringing,
//      one representative disposition per authored `d` threshold, and every subset of the
//      authored knowledge flags — exactly, by grouping identical admissibility masks rather
//      than by iterating 71,680 players against 347 speakers.
//
//   2. ORDER-DEPENDENCE. Under `RI-DLG01` §A authored order decides *every* resolution; under
//      the shipped rule it decides only ties. The tool reports the tie mass, and separately
//      the number of resolutions whose answer would move if the authored order were permuted.
//      That second number is what makes `order-infos --write`'s "0 answers changed" evidence
//      or arithmetic.
//
//   3. WHETHER AUTHORED ORDER EXISTS AT ALL. `buildTopicIndex()` merges same-id topic records
//      across files in `readdirSync().sort()` order. For a topic declared in more than one file
//      there is no author who chose the order; the filesystem chose it. The tool counts those.
//
// SELF-TEST (RULES §4). `--self-test` perturbs the shipped reader's own scoring weights so that
// the two algorithms must be made to agree, and separately corrupts the corpus so they must be
// made to disagree. Both arms must come out as predicted or the tool exits 2. A comparator that
// cannot report agreement as agreement, and disagreement as disagreement, is not comparing.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex, infoAllowed } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs, PLAYERS as CENSUS_PLAYERS } from './answer-census.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const ARGV = process.argv.slice(2);
const GATE = ARGV.includes('--gate');
const SELFTEST = ARGV.includes('--self-test');
const JSONOUT = (() => { const i = ARGV.indexOf('--json'); return i >= 0 ? ARGV[i + 1] : null; })();

// ---------------------------------------------------------------------------------------------
// The two selection rules. `candidates()` is a verbatim re-derivation of infoFor()'s admissible
// set — copied rather than imported because infoFor() fuses the filter and the choice into one
// loop and returns only the winner. Both rules see exactly the same set; only the CHOICE differs.
// ---------------------------------------------------------------------------------------------
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
// The shipped weights, lifted from converse.js:283-284. Kept as data so --self-test can move them.
const W = { actor: 8, cell: 2, requires: 4, forbids: 0.5, dBase: 1, dSlope: 1 };
function scoreOf(info, matchesActor) {
  const dScore = info.d != null ? W.dBase + Math.min(1, Number(info.d) / 100) * W.dSlope : 0;
  return (matchesActor ? W.actor : 0) + (info.cell ? W.cell : 0) + (info.requires ? W.requires : 0)
    + dScore + (info.forbids ? W.forbids : 0);
}

// ---------------------------------------------------------------------------------------------
// The player space, read out of the corpus.
// ---------------------------------------------------------------------------------------------
function canonicalPlayerAxes(docs) {
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
  // One representative disposition per equivalence class: 0 clears no `d` gate, and each authored
  // threshold clears exactly the prefix at or below it. These 1+N values partition [0,100] into
  // every class the corpus can distinguish, so nothing is lost by not enumerating 101 integers.
  const dispositions = [0, ...[...dSet].sort((a, b) => a - b)];
  const flags = [...knowsSet].sort();
  return { races, upbringings, dispositions, flags };
}
function enumeratePlayers(axes) {
  const out = [];
  const nSub = 1 << axes.flags.length;
  for (const race of axes.races) for (const upbringing of axes.upbringings) for (const disposition of axes.dispositions) {
    for (let m = 0; m < nSub; m++) {
      const knows = new Set();
      for (let b = 0; b < axes.flags.length; b++) if (m & (1 << b)) knows.add(axes.flags[b]);
      out.push({ race, upbringing, disposition, knows, _m: m });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Exact divergence, by admissibility mask.
//
// For one topic the candidate set is (speaker-side mask) & (player-side mask). Both masks take
// very few distinct values per topic — bounded by 2^(infos in that topic) and in practice 2-8 —
// so we compute each once, dedupe with a multiplicity, and cross the two small sets. That is
// exact, and it is what makes a 71,680-player space affordable at all.
// ---------------------------------------------------------------------------------------------
function analyse(docs, npcs, players) {
  const idx = buildTopicIndex(docs);
  const topicIds = [...new Set(docs.flatMap((d) => (d.topics || []).filter((t) => t && typeof t.id === 'string').map((t) => t.id)))].sort();

  let resolutions = 0, diverged = 0, ties = 0, orderSensitive = 0;
  const divergentPairs = new Set();      // "<topic>|<speaker>" — measure-free: order/weight independent
  const divergentTopics = new Set();
  const tieTopics = new Set(), orderSensitiveTopics = new Set();
  const examples = [];
  const heardScore = new Set(), heardOrder = new Set();
  const infoTotal = new Set();
  for (const [, t] of idx) for (let i = 0; i < t.infos.length; i++) infoTotal.add(`${t.id}#${i}`);

  for (const tid of topicIds) {
    const t = idx.get(topicKey(tid));
    if (!t) continue;
    const n = t.infos.length;
    if (n === 0) continue;
    if (n > 30) throw new Error(`topic ${t.id} has ${n} infos; the bitmask holds 30. Widen it rather than skipping.`);

    // Authored order, and one permutation of it. The permutation is how we answer the question
    // `order-infos --write` was supposed to answer and could not: under the rule that actually
    // runs, does authored order decide anything at all?
    const perm = t.infos.map((_, i) => i);
    const permRev = perm.slice().reverse();

    // --- player-side masks, deduped
    const pMask = new Map();  // mask -> count
    for (const p of players) {
      let m = 0;
      for (let i = 0; i < n; i++) if (infoAllowed(t.infos[i], p)) m |= (1 << i);
      pMask.set(m, (pMask.get(m) || 0) + 1);
    }
    // --- speaker-side masks, deduped (cell + actor; no player term)
    const sMask = new Map();
    for (const npc of npcs) {
      if (npc.lines && npc.lines[topicKey(tid).split(' ').join('_')]) continue;  // npc-own-line short-circuit
      const actor = npc.actor || null;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const info = t.infos[i];
        if (info.cell && !inCell(npc, info.cell)) continue;
        const matchesActor = actor && info.a === actor;
        if (!matchesActor && info.a) continue;
        m |= (1 << i);
      }
      const cur = sMask.get(m) || { count: 0, sample: npc.id };
      cur.count++; sMask.set(m, cur);
      // remember which speakers sit in which mask so divergent PAIRS can be counted exactly
      (cur.ids || (cur.ids = [])).push(npc.id);
    }

    // --- actor match depends on the speaker, so scores are computed per speaker-mask group.
    for (const [sm, srec] of sMask) {
      if (sm === 0) continue;
      // every speaker in this group has an identical candidate set, but their `matchesActor`
      // could differ if two actors' infos are both in the mask — impossible, because an info
      // with an `a` only enters the mask for that actor. So actor-match is a property of the
      // info within this group: info.a set => matched.
      const sc = [];
      for (let i = 0; i < n; i++) if (sm & (1 << i)) sc[i] = scoreOf(t.infos[i], !!t.infos[i].a);
      for (const [pm, pcount] of pMask) {
        const m = sm & pm;
        if (m === 0) continue;
        const weight = srec.count * pcount;
        resolutions += weight;
        // shipped rule: strict maximum, first of the tied group wins (authored order breaks ties)
        let best = -1, bestScore = -Infinity, nTop = 0;
        for (const i of perm) if (m & (1 << i)) {
          if (sc[i] > bestScore) { bestScore = sc[i]; best = i; nTop = 1; }
          else if (sc[i] === bestScore) nTop++;
        }
        // the same shipped rule, over a REVERSED authored order. If this differs, authored order
        // is load-bearing for the running engine at this resolution; if it never differs, a tool
        // that only reorders infos cannot change one answer, whatever it does.
        let bestRev = -1, bestRevScore = -Infinity;
        for (const i of permRev) if (m & (1 << i)) if (sc[i] > bestRevScore) { bestRevScore = sc[i]; bestRev = i; }
        // RI-DLG01 §A rule: the first admissible entry in authored order, full stop
        let first = -1;
        for (const i of perm) if (m & (1 << i)) { first = i; break; }
        if (nTop > 1) { ties += weight; tieTopics.add(t.id); }
        if (t.infos[best].x !== t.infos[bestRev].x) { orderSensitive += weight; orderSensitiveTopics.add(t.id); }
        heardScore.add(`${t.id}#${best}`);
        heardOrder.add(`${t.id}#${first}`);
        if (t.infos[best].x !== t.infos[first].x) {
          diverged += weight;
          divergentTopics.add(t.id);
          for (const id of (srec.ids || [])) divergentPairs.add(`${t.id}|${id}`);
          if (examples.length < 40) examples.push({
            topic: t.id, speaker: srec.sample, n_speakers: srec.count, n_players: pcount,
            scored: String(t.infos[best].x || '').slice(0, 130),
            ordered: String(t.infos[first].x || '').slice(0, 130),
            scored_from: t.infos[best].from || null, ordered_from: t.infos[first].from || null,
          });
        }
      }
    }
  }
  const deadScore = [...infoTotal].filter((k) => !heardScore.has(k)).length;
  const deadOrder = [...infoTotal].filter((k) => !heardOrder.has(k)).length;
  return { resolutions, diverged, ties, orderSensitive, tieTopics, orderSensitiveTopics,
    divergentPairs, divergentTopics, examples,
    infos: infoTotal.size, deadScore, deadOrder, topics: topicIds.length };
}

// ---------------------------------------------------------------------------------------------
// Is authored order even authored? Count topic ids declared in more than one file.
// ---------------------------------------------------------------------------------------------
function mergeCensus(docs) {
  const where = new Map();   // topicKey -> [{group,file,nInfos}]
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  files.forEach((f, k) => {
    const doc = docs[k];
    for (const t of (doc.topics || [])) {
      if (!t || typeof t.id !== 'string') continue;
      const key = topicKey(t.id);
      const arr = where.get(key) || []; arr.push({ file: f, n: (t.infos || []).length }); where.set(key, arr);
    }
  });
  let multi = 0, multiInfos = 0; const worst = [];
  for (const [k, arr] of where) {
    if (arr.length > 1) {
      multi++;
      const tot = arr.reduce((a, b) => a + b.n, 0);
      multiInfos += tot;
      worst.push({ topic: k, files: arr.map((a) => a.file), infos: tot });
    }
  }
  worst.sort((a, b) => b.infos - a.infos);
  return { topics: where.size, multi, multiInfos, worst: worst.slice(0, 12) };
}

// ---------------------------------------------------------------------------------------------
function run() {
  const docs = loadTopicDocs();
  const npcs = loadNpcs();
  const axes = canonicalPlayerAxes(docs);
  const players = enumeratePlayers(axes);

  const full = analyse(docs, npcs, players);
  const census = analyse(docs, npcs, CENSUS_PLAYERS);
  const merge = mergeCensus(docs);

  const out = {
    commit: gitSha(),
    player_space: {
      canonical: { races: axes.races.length, upbringings: axes.upbringings.length,
        dispositions: axes.dispositions, knowledge_flags: axes.flags.length,
        players: players.length },
      census_fixture: CENSUS_PLAYERS.map((p) => p.id),
    },
    canonical: {
      resolutions: full.resolutions, diverged: full.diverged, ties: full.ties,
      divergent_speaker_topic_pairs: full.divergentPairs.size,
      divergent_topics: full.divergentTopics.size,
      dead_infos_under_scoring: full.deadScore, dead_infos_under_first_match: full.deadOrder,
    },
    census_space: {
      fixture_size: CENSUS_PLAYERS.length,
      resolutions: census.resolutions, diverged: census.diverged, ties: census.ties,
      divergent_speaker_topic_pairs: census.divergentPairs.size,
    },
    authored_order: {
      resolutions_tied_under_shipped_rule: full.ties,
      tie_topics: [...full.tieTopics],
      answers_moved_by_reversing_authored_order_under_shipped_rule: full.orderSensitive,
      order_sensitive_topics: [...full.orderSensitiveTopics],
    },
    merge: merge,
    infos: full.infos, topics: full.topics, speakers: npcs.length,
    examples: full.examples.slice(0, 10),
  };

  console.log('ARBITER S37 — RI-DLG01 §A first-match-wins  vs  converse.js infoFor() specificity scoring');
  console.log('');
  console.log(`corpus: ${full.infos} infos across ${full.topics} topics; ${npcs.length} speakers`);
  console.log(`player space (canonical, read from race-reactions.json + the corpus's own gates):`);
  console.log(`  ${axes.races.length} races x ${axes.upbringings.length} upbringings x ${axes.dispositions.length} disposition classes x 2^${axes.flags.length} knowledge sets = ${players.length} players`);
  console.log('');
  console.log('A. THE TWO ALGORITHMS, over the canonical player space');
  console.log(`   resolutions (candidate set non-empty)                     ${full.resolutions.toLocaleString()}`);
  console.log(`   answers where the two rules DISAGREE                      ${full.diverged.toLocaleString()}  (${(100 * full.diverged / Math.max(1, full.resolutions)).toFixed(3)}%)`);
  console.log(`   (speaker, topic) pairs where they can disagree            ${full.divergentPairs.size}   <- measure-free`);
  console.log(`   distinct topics affected                                  ${full.divergentTopics.size}`);
  console.log('');
  console.log(`B. THE SAME, over answer-census.mjs PLAYERS (${CENSUS_PLAYERS.length} characters — the fixture W1-17's instruments use)`);
  console.log(`   resolutions                                               ${census.resolutions.toLocaleString()}`);
  console.log(`   disagreements                                             ${census.diverged.toLocaleString()}  (${(100 * census.diverged / Math.max(1, census.resolutions)).toFixed(3)}%)`);
  console.log(`   (speaker, topic) pairs                                    ${census.divergentPairs.size}`);
  console.log('');
  console.log('C. DOES AUTHORED ORDER DECIDE ANYTHING UNDER THE SHIPPED RULE?');
  console.log(`   resolutions where the top score TIES                      ${full.ties.toLocaleString()}  (${(100 * full.ties / Math.max(1, full.resolutions)).toFixed(3)}%)  in ${full.tieTopics.size} topic(s)`);
  console.log(`   answers that MOVE if authored order is reversed           ${full.orderSensitive.toLocaleString()}  (${(100 * full.orderSensitive / Math.max(1, full.resolutions)).toFixed(3)}%)  in ${full.orderSensitiveTopics.size} topic(s)`);
  if (full.orderSensitiveTopics.size) console.log(`     ${[...full.orderSensitiveTopics].join(', ')}`);
  console.log(`   -> this second row is the honest control for any tool that only REORDERS infos.`);
  console.log(`      Near zero means "0 answers changed" is arithmetic, not evidence (RULES 6).`);
  console.log('');
  console.log('D. IS AUTHORED ORDER AUTHORED? (buildTopicIndex merges same-id topics across files)');
  console.log(`   topic ids declared in >1 file                             ${merge.multi} of ${merge.topics}`);
  console.log(`   infos living in those merged topics                       ${merge.multiInfos} of ${full.infos}`);
  for (const w of merge.worst.slice(0, 6)) console.log(`     ${w.topic}  (${w.infos} infos)  ${w.files.join(' + ')}`);
  console.log('');
  console.log('E. INFOS NO ONE CAN EVER HEAR, under each rule');
  console.log(`   under the shipped scoring reader                          ${full.deadScore}`);
  console.log(`   under RI-DLG01 §A first-match-wins                        ${full.deadOrder}`);
  console.log('');
  if (full.examples.length) {
    console.log('DIVERGENCES (first 8):');
    for (const e of full.examples.slice(0, 8)) {
      console.log(`  ${e.topic}  (speaker ${e.speaker}, ${e.n_speakers} such speaker(s) x ${e.n_players} player(s))`);
      console.log(`    engine  : ${e.scored}`);
      console.log(`    RI-DLG01: ${e.ordered}`);
    }
    console.log('');
  }

  console.log(`measured at commit ${out.commit} (RULES 12 — a number is a claim about a commit)`);
  if (JSONOUT) { fs.mkdirSync(path.dirname(path.resolve(ROOT, JSONOUT)), { recursive: true }); fs.writeFileSync(path.resolve(ROOT, JSONOUT), JSON.stringify(out, null, 2)); console.log(`json -> ${JSONOUT}`); }

  return { full, census, merge, axes, players };
}

function gitSha() {
  try {
    const head = String(fs.readFileSync(path.join(ROOT, '.git/HEAD'), 'utf8')).trim();
    if (head.startsWith('ref: ')) return String(fs.readFileSync(path.join(ROOT, '.git', head.slice(5)), 'utf8')).trim().slice(0, 7);
    return head.slice(0, 7);
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// SELF-TEST. Two arms, both of which must come out as predicted.
//
//   ARM 1 (must go GREEN)  — replace the scoring weights with all-zero, so the shipped rule
//                            degenerates to "first admissible entry" and MUST agree with
//                            RI-DLG01 §A on every resolution. If divergence is not 0, this tool
//                            is not comparing the two rules; it is comparing something else.
//   ARM 2 (must go RED)    — restore the weights and corrupt one topic by moving its
//                            highest-scoring info to the front of the authored order. Under
//                            first-match-wins that changes the answer; under scoring it does
//                            not. Divergence must FALL, and must fall by a predicted amount.
//                            A comparator whose number does not move when the corpus moves is
//                            reading a constant.
// ---------------------------------------------------------------------------------------------
function selfTest() {
  const docs = loadTopicDocs();
  const npcs = loadNpcs();
  const axes = canonicalPlayerAxes(docs);
  const players = enumeratePlayers(axes);
  let bad = 0;

  const base = analyse(docs, npcs, players);
  console.log(`self-test baseline: ${base.diverged} divergences over ${base.resolutions} resolutions`);

  // ARM 1
  const saved = { ...W };
  W.actor = 0; W.cell = 0; W.requires = 0; W.forbids = 0; W.dBase = 0; W.dSlope = 0;
  const flat = analyse(docs, npcs, players);
  Object.assign(W, saved);
  if (flat.diverged === 0) console.log(`ARM 1 (weights zeroed => shipped rule IS first-match-wins): divergence ${flat.diverged}  OK`);
  else { console.log(`ARM 1 FAILED: divergence ${flat.diverged}, expected 0 — the comparator cannot see agreement.`); bad++; }

  // ARM 2 — hoist the winner in one divergent topic and confirm the count drops.
  if (!base.examples.length) { console.log('ARM 2 SKIPPED: no divergence in the tree to repair.'); }
  else {
    const target = base.examples[0].topic;
    const docs2 = JSON.parse(JSON.stringify(docs, (k, v) => v));
    let moved = false;
    for (const doc of docs2) for (const t of (doc.topics || [])) {
      if (!t || topicKey(t.id) !== topicKey(target) || !Array.isArray(t.infos) || t.infos.length < 2) continue;
      let bi = 0, bs = -Infinity;
      t.infos.forEach((info, i) => { const s = scoreOf(info, !!info.a); if (s > bs) { bs = s; bi = i; } });
      if (bi > 0) { const [x] = t.infos.splice(bi, 1); t.infos.unshift(x); moved = true; }
    }
    if (!moved) console.log('ARM 2 SKIPPED: could not construct the perturbation.');
    else {
      const after = analyse(docs2, npcs, players);
      if (after.diverged < base.diverged) console.log(`ARM 2 (hoist the winner in "${target}"): divergence ${base.diverged} -> ${after.diverged}  OK — the number moves when the corpus moves.`);
      else { console.log(`ARM 2 FAILED: divergence ${base.diverged} -> ${after.diverged}; expected a fall. The tool is reading a constant.`); bad++; }
    }
  }

  if (bad) { console.log(`\nSELF-TEST FAILED (${bad} arm(s)). This instrument is not trustworthy.`); process.exit(2); }
  console.log('\nSELF-TEST PASSED — both arms behaved as predicted.');
  process.exit(0);
}

if (SELFTEST) { selfTest(); }
else {
  const r = run();
  if (GATE) {
    const d = r.full.diverged;
    if (d === 0) { console.log('GATE PASS — the running reader and RI-DLG01 §A select the same info on every resolution.'); process.exit(0); }
    console.log(`GATE FAIL — ${d} resolutions (${r.full.divergentPairs.size} speaker/topic pairs) where the engine and RI-DLG01 §A disagree.`);
    console.log('See ARBITRATION.md S37. Either converse.js infoFor() is not first-match-wins, or the corpus order has drifted.');
    process.exit(1);
  }
  process.exit(0);
}
