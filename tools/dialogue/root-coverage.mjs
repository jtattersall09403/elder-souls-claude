#!/usr/bin/env node
// root-coverage.mjs — can the province answer the nine words the player is given?
//
// Owner: W1-SPEAKERS. Binding: RI-DLG01 §A ("the player begins with exactly nine topics,
// granted at character creation"), RI-MTH07 / ARBITRATION §3 (CONSUMPTION).
//
// WHY THIS EXISTS.
// W1-26 round 2 measured, through the live reader, that seven of the nine ROOT topics were
// listed by ZERO speakers in the province, and that the nine root answers are written for six
// ARCHETYPES while the NPC records carry EIGHTEEN actor names. It fixed the opening (villager,
// clerk) and left 200 of 336 speakers unable to answer any of the nine. This is the instrument
// for the rest of it.
//
// It runs the SHIPPED reader (`game/src/character/converse.js`) over the SHIPPED data in bare
// Node. It counts nothing out of a file: every number below is what `infoFor()` returned when
// asked, which is the same call `Conversation.say()` makes. A count of infos in a file is not
// coverage — that is the whole reason this is not a grep.
//
// FOUR QUESTIONS
//   Q1 COVERAGE   per NPC record, how many of the nine roots produce an answer.
//   Q2 BY ACTOR   which actor names are mute, and how many people wear them.
//   Q3 SAMENESS   the contrast the coverage number exists to protect. If everybody answers and
//                 everybody says the SAME sentence, the number is closed and the thing it was
//                 measuring is destroyed. Reported as distinct answers per root, and as the
//                 share of the population receiving the single most common answer.
//   Q4 PLACE      does a settlement-specific answer reach the settlement it was written for?
//                 `cell` is authored 39 times across the roots. Whether anything READS it is
//                 the question; a Stormhold line delivered in Thorn is the failure.
//
// SELF-TEST (`--self-test`). A probe that cannot fail is worse than no probe
// (AGENT-PROTOCOL §"Two failure modes"). Four mutations, each of which MUST move a number:
//   M1 strip every generic (no-`a`) info      -> coverage must FALL
//   M2 strip every actor-matched info         -> per-actor distinctness must FALL
//   M3 collapse every root answer to one string -> Q3 sameness must go RED while Q1 stays green
//   M4 relabel every NPC's settlement         -> Q4 must go RED if cell is read, and must NOT
//                                                move at all if it is not. Either way it is
//                                                reported, never assumed.

import fs from 'node:fs';
import path from 'node:path';
import { buildTopicIndex, infoFor, topicsFor } from '../../game/src/character/converse.js';
import { topicKey } from '../../game/src/core/topics.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const say = (s) => process.stdout.write(s + '\n');
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));

const ARGS = new Set(process.argv.slice(2));
const JSON_OUT = ARGS.has('--json');

// ---------------------------------------------------------------------------- load
function loadTopicDocs() {
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => D('dialogue/topics/' + f));
}
function loadNpcs() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'game/data/npcs'))) {
    if (!f.endsWith('.json')) continue;
    const doc = D('npcs/' + f);
    for (const n of (doc.npcs || [])) {
      if (!Array.isArray(n.topics)) continue;   // the 336 the headline is measured over
      out.push({ ...n, _file: f, settlement: n.settlement || doc.settlement || null });
    }
  }
  return out;
}

// The filter context. A root is asked by a character who has been through the census, so
// `topics_known` holds all nine; disposition is the NPC's own base, which is what the world
// starts them at before any persuasion.
const UPB = 'lukiul';
const RACE = 'argonian';

function census(idx, npcs, roots) {
  const per = [];
  for (const n of npcs) {
    const answers = {};
    let ok = 0;
    for (const r of roots) {
      const info = infoFor(idx, r.id, n, {
        race: n.race === 'argonian' ? RACE : (n.race || RACE),
        upbringing: UPB,
        disposition: n.disposition == null ? 50 : n.disposition,
      });
      if (info) { ok++; answers[r.id] = info; }
      else answers[r.id] = null;
    }
    per.push({ npc: n, ok, answers });
  }
  return per;
}

// ---------------------------------------------------------------------------- run
function run(idx, npcs, { quiet = false } = {}) {
  const roots = (idx.roots || []).slice();
  const per = census(idx, npcs, roots);

  // Q1 -----------------------------------------------------------------------
  const answeringAny = per.filter((p) => p.ok > 0).length;
  const answeringAll = per.filter((p) => p.ok === roots.length).length;
  const perRoot = {};
  for (const r of roots) perRoot[r.id] = per.filter((p) => p.answers[r.id]).length;

  // Q2 -----------------------------------------------------------------------
  const byActor = new Map();
  for (const p of per) {
    const a = p.npc.actor || '(none)';
    const e = byActor.get(a) || { n: 0, answered: 0, roots: 0 };
    e.n++; if (p.ok > 0) e.answered++; e.roots += p.ok;
    byActor.set(a, e);
  }

  // Q3 — the contrast ---------------------------------------------------------
  // For each root: how many DISTINCT answer strings does the province produce, and what share
  // of the answering population hears the single most common one. A root answered by everybody
  // with one string scores distinct=1, share=1.00 — closed and worthless.
  const sameness = {};
  for (const r of roots) {
    const counts = new Map();
    for (const p of per) {
      const a = p.answers[r.id];
      if (!a) continue;
      counts.set(a.text, (counts.get(a.text) || 0) + 1);
    }
    const total = [...counts.values()].reduce((x, y) => x + y, 0);
    const top = [...counts.values()].sort((x, y) => y - x)[0] || 0;
    sameness[r.id] = { distinct: counts.size, answered: total, top_share: total ? top / total : 0 };
  }
  // The population-level figure: over every (npc, root) pair that answers, how often is the
  // answer the most common one for that root.
  let pairs = 0, topPairs = 0;
  for (const r of roots) { pairs += sameness[r.id].answered; topPairs += Math.round(sameness[r.id].top_share * sameness[r.id].answered); }
  const dullness = pairs ? topPairs / pairs : 0;

  // Q4 — place ---------------------------------------------------------------
  // An answer is MISPLACED when the info that produced it carries a `cell` that the speaker's
  // settlement does not start with. That is measured off the returned info's provenance, so it
  // is a statement about what the reader actually chose, not about the file.
  const placed = { checked: 0, misplaced: 0, examples: [] };
  for (const p of per) {
    for (const r of roots) {
      const a = p.answers[r.id];
      if (!a || !a._cell) continue;
      placed.checked++;
      const s = String(p.npc.settlement || '');
      if (!s.startsWith(a._cell)) {
        placed.misplaced++;
        if (placed.examples.length < 6) placed.examples.push(`${p.npc.id} (in ${s || 'nowhere'}) answers "${r.id}" with the ${a._cell} line`);
      }
    }
  }

  const res = {
    npcs: per.length, roots: roots.length,
    answering_any: answeringAny, answering_all: answeringAll,
    per_root: perRoot,
    by_actor: Object.fromEntries([...byActor].map(([k, v]) => [k, v])),
    sameness, dullness,
    place: placed,
    mute_actors: [...byActor].filter(([, v]) => v.answered === 0).map(([k, v]) => `${k} (${v.n})`),
  };
  if (quiet) return res;

  say(`NPC records carrying a topics array: ${per.length}      root topics: ${roots.length}`);
  say('');
  say(`Q1 COVERAGE   answer at least one root : ${answeringAny} of ${per.length}`);
  say(`              answer ALL ${roots.length} roots        : ${answeringAll} of ${per.length}`);
  say('');
  say('   per root, speakers who produce an answer:');
  for (const r of roots) say(`     ${r.id.padEnd(24)} ${String(perRoot[r.id]).padStart(4)}`);
  say('');
  say('Q2 BY ACTOR   (people wearing the name / how many can answer / mean roots each)');
  for (const [a, v] of [...byActor].sort((x, y) => y[1].n - x[1].n)) {
    const flag = v.answered === 0 ? '   MUTE' : '';
    say(`     ${a.padEnd(14)} ${String(v.n).padStart(4)} ${String(v.answered).padStart(6)}   ${(v.roots / v.n).toFixed(2)}${flag}`);
  }
  say('');
  say('Q3 SAMENESS   distinct answers per root, and the share hearing the commonest one');
  for (const r of roots) {
    const s = sameness[r.id];
    say(`     ${r.id.padEnd(24)} distinct ${String(s.distinct).padStart(3)}   commonest reaches ${(s.top_share * 100).toFixed(0)}% of ${s.answered}`);
  }
  say(`     DULLNESS (share of all answering pairs hearing their root's commonest line): ${(dullness * 100).toFixed(1)}%`);
  say('');
  say(`Q4 PLACE      settlement-gated answers delivered: ${placed.checked}, MISPLACED: ${placed.misplaced}`);
  for (const e of placed.examples) say(`     ${e}`);
  return res;
}

// ---------------------------------------------------------------------------- self-test
function clone(docs) { return JSON.parse(JSON.stringify(docs)); }

function selfTest() {
  const docs = loadTopicDocs();
  const npcs = loadNpcs();
  const base = run(buildTopicIndex(clone(docs)), npcs, { quiet: true });
  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { pass++; say(`   PASS  ${name}${detail ? '  — ' + detail : ''}`); }
    else { fail++; say(`   FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
  };
  say(`BASELINE  answering_any ${base.answering_any}/${base.npcs}  dullness ${(base.dullness * 100).toFixed(1)}%  misplaced ${base.place.misplaced}/${base.place.checked}`);
  say('');

  // M1 — strip the generic (actorless) tier.
  {
    const d = clone(docs);
    for (const doc of d) for (const t of (doc.topics || [])) if (t.root) t.infos = (t.infos || []).filter((i) => i.a);
    const r = run(buildTopicIndex(d), npcs, { quiet: true });
    check('M1 removing every generic info lowers coverage', r.answering_any < base.answering_any,
      `${base.answering_any} -> ${r.answering_any}`);
  }
  // M2 — strip the actor tier.
  {
    const d = clone(docs);
    for (const doc of d) for (const t of (doc.topics || [])) if (t.root) t.infos = (t.infos || []).filter((i) => !i.a);
    const r = run(buildTopicIndex(d), npcs, { quiet: true });
    const lostVoices = r.dullness > base.dullness;
    check('M2 removing every actor info makes the province duller', lostVoices,
      `dullness ${(base.dullness * 100).toFixed(1)}% -> ${(r.dullness * 100).toFixed(1)}%`);
  }
  // M3 — collapse every root answer to one string. Coverage must NOT move; sameness must.
  {
    const d = clone(docs);
    for (const doc of d) for (const t of (doc.topics || [])) if (t.root) for (const i of (t.infos || [])) i.x = 'One sentence for everybody.';
    const r = run(buildTopicIndex(d), npcs, { quiet: true });
    check('M3 one string for everybody leaves COVERAGE untouched', r.answering_any === base.answering_any,
      `${r.answering_any}`);
    check('M3 one string for everybody drives DULLNESS to 100%', r.dullness > 0.999,
      `${(base.dullness * 100).toFixed(1)}% -> ${(r.dullness * 100).toFixed(1)}%`);
  }
  // M4 — move everybody to a settlement that exists but is not theirs.
  {
    const moved = npcs.map((n) => ({ ...n, settlement: n.settlement === 'gideon' ? 'thorn' : 'gideon' }));
    const r = run(buildTopicIndex(clone(docs)), moved, { quiet: true });
    if (base.place.checked === 0) {
      check('M4 place check is LIVE (a cell-gated answer was delivered to somebody)', false,
        'zero cell-gated answers were returned by the reader — `cell` is not being read, so Q4 is vacuous');
    } else {
      check('M4 moving everybody out of their town raises MISPLACED', r.place.misplaced > base.place.misplaced,
        `${base.place.misplaced} -> ${r.place.misplaced}`);
    }
  }
  say('');
  say(`SELF-TEST ${pass} pass  ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------- main
if (ARGS.has('--self-test')) {
  process.exit(selfTest());
}

const idx = buildTopicIndex(loadTopicDocs());
const npcs = loadNpcs();
const res = run(idx, npcs);

if (JSON_OUT) say('\n' + JSON.stringify(res, null, 1));

// GATES. Deliberately about the two things together, because either alone is satisfiable by a
// change that makes the game worse.
const GATE_COVERAGE = 336;      // every speaker in the province answers the nine words
const GATE_DULLNESS = 0.60;     // no more than 60% of answering pairs hear their root's commonest line
let bad = 0;
say('');
if (res.answering_any < GATE_COVERAGE) { say(`RED   coverage ${res.answering_any} < ${GATE_COVERAGE}`); bad++; }
else say(`GREEN coverage ${res.answering_any}/${res.npcs}`);
if (res.dullness > GATE_DULLNESS) { say(`RED   dullness ${(res.dullness * 100).toFixed(1)}% > ${(GATE_DULLNESS * 100).toFixed(0)}% — the number is closed and the contrast is gone`); bad++; }
else say(`GREEN dullness ${(res.dullness * 100).toFixed(1)}%`);
if (res.place.checked && res.place.misplaced) { say(`RED   ${res.place.misplaced} settlement-gated answers delivered in the wrong settlement`); bad++; }
process.exit(bad ? 1 : 0);
