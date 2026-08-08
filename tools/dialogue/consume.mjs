// CONSUMPTION — RI-MTH07 §B, mandatory under `corpus/00-doctrine/ARBITRATION.md` §3.
//
//   node tools/dialogue/consume.mjs
//
// The rule this project keeps paying for: *for every model you ship, name the world-side consumer
// and demonstrate it by perturbing the model and watching an entity change behaviour.* Eighteen
// subsystems here have shipped a correct, instrumented model that nothing in the running world
// reads, and a sibling piece shipped 186 authored rows naming who reveals a quest with zero
// readers in `game/src`. So every field W1-17 authors is listed below with the shipped source
// that reads it, and then each one is BROKEN and a named person is watched changing what they say.
//
// THE READERS, field by field, all in `game/src/character/converse.js` unless stated:
//
//   x            infoFor() -> `text`, returned through Conversation.say() to
//                Engine.conversationSay() (game/src/engine.js:2486) — the words on the screen.
//   a            infoFor() `matchesActor`; an info tagged for somebody else's mouth is skipped.
//   cell         infoFor() `inCell(npc, info.cell)` — Morrowind filter field 6, the SPEAKER's
//                place, plus 2 points of specificity.
//   d            infoAllowed() `Number(disposition) < Number(info.d)` and the `dScore` term.
//   requires.*   infoAllowed() race / upbringing whitelists and `knows` / `knows_all`.
//   forbids.*    infoAllowed() blacklists.
//   to           Engine.conversationSay() -> learnTopics(sim.quest.topicsKnown, [topic, ...to])
//                (game/src/sim/quest/topic-supply.js:200) and questEngine.noteTopicLearned().
//                Morrowind's AddTopic, and the main quest's whole bootstrap.
//   id / root    buildTopicIndex() and topicsFor(), called from engine.js:2198.
//
// WHAT IS RUN. The shipped modules are imported and called directly. `infoFor()` and
// `buildTopicIndex()` are the exact functions `Engine.conversationSay()` calls, and
// `learnTopics()` is the exact function it hands the `to` list to. There is no second
// implementation here: a re-implementation would be measuring itself (RULES §10).
//
// WHAT THIS DOES NOT COVER, said plainly: these arms prove the reader changes its answer, not
// that the answer reaches a pixel. The browser half is `tools/harness/chr-talk-probe.mjs`.
'use strict';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';
import { learnTopics } from '../../game/src/sim/quest/topic-supply.js';
import { loadTopicDocs, loadNpcs } from './answer-census.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
// W1-17 r2: `upbringing` was `marsh`, which is not one of the four the roster declares
// (`game/data/progression/race-reactions.json#upbringings` = interior / lukiul / foreign-born /
// blackrose) and which the shipped `character/reaction.js raceTerm()` THROWS on. The consumption
// tool was certifying the dialogue against a character the game cannot construct. See the header
// of `answer-census.mjs` for the full account and `assertPlayersAreConstructible()` for the guard.
const P = (over = {}) => ({ race: 'saxhleel', upbringing: 'interior', disposition: 60, knows: new Set(), ...over });
const BREAK = process.argv.includes('--break');

const npcs = loadNpcs();
const find = (pred) => npcs.find(pred);
const say = (docs, npc, topic, player) => {
  const r = infoFor(buildTopicIndex(docs), topic, npc, player);
  return r ? { text: r.text, cell: r.cell, actor: r.actor, from: r.from, to: r.to } : null;
};
const short = (t) => (t == null ? '(nothing — this person has no answer)'
  : Array.isArray(t) ? (t.length ? t.join(', ') : '(no topics)') : `"${String(t).slice(0, 100)}…"`);

let fails = 0;
function arm(name, { field, reader, before, after, mustDiffer = true }) {
  const changed = JSON.stringify(before.value) !== JSON.stringify(after.value);
  const ok = changed === mustDiffer;
  if (!ok) fails++;
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      field   ${field}`);
  console.log(`      reader  ${reader}`);
  console.log(`      ${before.label}`);
  console.log(`          ${short(before.value)}`);
  console.log(`      ${after.label}`);
  console.log(`          ${short(after.value)}`);
  if (!ok) console.log(`      ^ expected the answer to ${mustDiffer ? 'CHANGE' : 'HOLD'} and it did not.`);
}

const base = loadTopicDocs();
const mine = () => clone(base);
function editInfo(docs, topicId, pred, fn) {
  for (const doc of docs) for (const t of doc.topics || []) if (t.id === topicId) for (const i of t.infos || []) if (pred(i)) fn(i);
  return docs;
}

console.log('CONSUMPTION — game/data/dialogue/topics/** against its shipped readers');
console.log(`roster: ${npcs.length} people from game/data/npcs/**`);

// ---- 1. `x` — the words themselves -----------------------------------------------------------
{
  const npc = find((n) => n.actor === 'villager' && n.settlement === 'lilmoth');
  const b = say(base, npc, 'lilmoth', P());
  const d = editInfo(mine(), 'lilmoth', (i) => i.a === 'villager' && i.cell === 'lilmoth', (i) => { i.x = 'PERTURBED: the lamps were sold last winter.'; });
  arm('the text a person speaks', {
    field: '`x` on topics/05-asking-around.json#lilmoth',
    reader: 'infoFor() -> Conversation.say() -> Engine.conversationSay() (engine.js:2486)',
    before: { label: `${npc.name} (${npc.id}) asked about "lilmoth":`, value: b && b.text },
    after: { label: 'after rewriting that one string:', value: (say(d, npc, 'lilmoth', P()) || {}).text },
  });
}

// ---- 2. `a` — whose mouth it is written for ---------------------------------------------------
{
  const npc = find((n) => n.actor === 'villager' && n.settlement === 'lilmoth');
  const b = say(base, npc, 'lilmoth', P());
  const d = editInfo(mine(), 'lilmoth', (i) => i.a === 'villager' && i.cell === 'lilmoth', (i) => { i.a = 'innkeeper'; });
  arm('the actor gate', {
    field: '`a` (Morrowind filter field 3, Class)',
    reader: 'infoFor() `matchesActor` — an info written for another actor is skipped outright',
    before: { label: `${npc.name} is a villager and the info says villager:`, value: b && b.text },
    after: { label: 'after retagging that info to `innkeeper`, the same villager says:', value: (say(d, npc, 'lilmoth', P()) || {}).text },
  });
}

// ---- 3. `cell` — where the answer was written for ---------------------------------------------
{
  const here = find((n) => n.actor === 'merchant' && n.settlement === 'stormhold');
  const there = find((n) => n.actor === 'merchant' && n.settlement === 'gideon');
  arm('the place gate — one actor, one word, two towns', {
    field: '`cell` (Morrowind filter field 6, the SPEAKER\'s place)',
    reader: 'infoFor() `inCell(npc, info.cell)` plus 2 points of specificity score',
    before: { label: `${here.name}, a merchant standing in Stormhold, asked about "stormhold":`, value: (say(base, here, 'stormhold', P()) || {}).text },
    after: { label: `${there.name}, a merchant standing in Gideon, asked the same word:`, value: (say(base, there, 'stormhold', P()) || {}).text },
  });
}

// ---- 4. `d` — the disposition bar --------------------------------------------------------------
{
  const npc = find((n) => n.actor === 'rootkeeper' && n.settlement === 'thorn');
  arm('the disposition bar', {
    field: '`d` on topics/05-asking-around.json#the-covenant (d:30)',
    reader: 'infoAllowed() `Number(disposition) < Number(info.d)` -> false (converse.js:139)',
    before: { label: `${npc.name} to a Saxhleel they think well of (disposition 60):`, value: (say(base, npc, 'the-covenant', P({ disposition: 60 })) || {}).text },
    after: { label: 'the same word put by the same person at disposition 10:', value: (say(base, npc, 'the-covenant', P({ disposition: 10 })) || {}).text },
  });
}

// ---- 5. `requires.race` — who is asking --------------------------------------------------------
{
  const npc = find((n) => n.actor === 'townsman' && n.settlement === 'gideon');
  arm('the race gate — two players, one speaker, one word', {
    field: '`requires.race` on topics/05-asking-around.json#the-lukiul',
    reader: 'infoAllowed() race whitelist (converse.js:127)',
    before: { label: `${npc.name} answering a Saxhleel:`, value: (say(base, npc, 'the-lukiul', P({ race: 'saxhleel' })) || {}).text },
    after: { label: 'the same person answering a Dunmer:', value: (say(base, npc, 'the-lukiul', P({ race: 'dunmer' })) || {}).text },
  });
}

// ---- 6. `to` — AddTopic, and what the player walks away holding ---------------------------------
{
  const npc = find((n) => n.actor === 'legionary' && n.settlement === 'stormhold');
  const run = (docs) => {
    const r = say(docs, npc, 'the-cart-roads', P());
    const known = ['the-cart-roads'];
    learnTopics(known, ['the-cart-roads', ...((r && r.to) || [])]);   // exactly what conversationSay() does
    return known.slice(1).sort();
  };
  const d = editInfo(mine(), 'the-cart-roads', (i) => i.a === 'legionary' && i.cell === 'stormhold', (i) => { i.to = []; });
  arm('AddTopic — the words the player leaves the conversation holding', {
    field: '`to` on topics/05-asking-around.json#the-cart-roads',
    reader: 'Engine.conversationSay() -> learnTopics(sim.quest.topicsKnown, [topic, ...info.to]) (engine.js:2504, topic-supply.js:200)',
    before: { label: `after asking ${npc.name} about the cart roads, topicsKnown gains:`, value: run(base) },
    after: { label: 'with that one `to` list emptied, the same question yields:', value: run(d) },
  });
}

// ---- 7. DELETE-THE-FIX (RULES §6) — take this round's whole file away ---------------------------
{
  const npc = find((n) => n.actor === 'legionary' && n.settlement === 'stormhold');
  const without = base.filter((d) => d.group !== 'asking-around');
  arm('delete-the-fix: remove 05-asking-around.json entirely', {
    field: 'the whole file this round authored',
    reader: 'buildTopicIndex() over game/data/dialogue/topics/**',
    before: { label: `${npc.name} asked about "the-north-wall" with the file present:`, value: (say(base, npc, 'the-north-wall', P()) || {}).text },
    after: { label: 'with the file removed:', value: (say(without, npc, 'the-north-wall', P()) || {}).text },
  });
}

// ---- 8. The cell ladder, every pair of it --------------------------------------------------------
// `check-dialogue-topics.mjs` warns that where two files declare one topic id and a player can
// reach both, "infoFor()'s specificity score, not authorial intent, decides which one they hear."
// This round added 17 such pairs deliberately: the new info carries `a` AND `cell`, the record it
// merges with carries `a` alone, so the new one strictly dominates in its own town and loses
// everywhere else. That is a claim, so it is checked on every info rather than asserted.
{
  // A line is DEAD when no player at all hears it, not when the first player tried does not.
  // The first draft of this arm asked one Saxhleel and reported six failures; four were real —
  // `the-provincial-office` and `the-tides` both carry clerk and fisher infos gated on
  // `requires.race` whose whitelists between them cover all ten races, and a race gate outscores
  // a cell gate 12 to 10, so those four lines were unspeakable by anybody and were re-homed
  // before shipping. The other two were the probe's fault: they are heard, by the races the
  // race-gated infos do not claim. So the sweep is over every race the corpus gates on and four
  // dispositions, which is the same definition `tools/dialogue/shadow-audit.mjs` uses.
  const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
  const DISP = [0, 25, 60, 90];
  const idx = buildTopicIndex(base);
  const hears = (npc, topicId, text) => {
    for (const race of RACES) for (const disposition of DISP) {
      const r = infoFor(idx, topicId, npc, { race, upbringing: 'town', disposition, knows: new Set() });
      if (r && r.text === text) return `${race}/d${disposition}`;
    }
    return null;
  };
  const asking = base.find((d) => d.group === 'asking-around');
  let checked = 0, wrong = 0;
  for (const t of asking.topics) {
    for (const info of t.infos) {
      if (!info.a || !info.cell) continue;
      const inTown = find((n) => n.actor === info.a && n.settlement === info.cell);
      const away = find((n) => n.actor === info.a && n.settlement && n.settlement !== info.cell);
      if (!inTown) { console.log(`\n  ! no ${info.a} lives in ${info.cell} — that info can never be heard`); wrong++; continue; }
      checked++;
      if (!hears(inTown, t.id, info.x)) {
        wrong++;
        console.log(`\n  ! DEAD  ${t.id} / ${info.a}@${info.cell}: no player of any race at any disposition hears this line`);
        continue;
      }
      if (away && hears(away, t.id, info.x)) {
        wrong++;
        console.log(`\n  ! LEAK  ${t.id}: a ${info.a} in ${away.settlement} says the ${info.cell} line`);
      }
    }
  }
  console.log(`\n${wrong === 0 ? 'PASS' : 'FAIL'}  the cell ladder — ${checked} authored (actor, town) infos, each reachable by`);
  console.log(`      some player from that actor in that town, and by no speaker of that actor elsewhere.`);
  console.log(`      ${wrong} exception(s).`);
  if (wrong) fails++;
}

// ---- THE FIELD-COVERAGE CENSUS, and the two fields it was written to catch ---------------------
//
// W1-17 round 2. Every arm above proves that ONE field has a reader. None of them could ever
// notice a field that nobody thought to write an arm for — which is exactly how `res` survived a
// whole round inside this tool's own subject matter. The round-1 critic put it plainly: *"that is
// a twentieth authored-model-with-no-reader, it is in W1-17's own data, and consume.mjs — the tool
// written to catch exactly this — has no arm for it."*
//
// So this arm does not test a field. It enumerates every field name authored on any info in
// `game/data/dialogue/topics/**` and requires each one to be either DEMONSTRATED (perturbing it
// moves an answer through the shipped reader) or DECLARED dead below, with a reason. A new field
// that is neither fails the tool. That is the guard the previous round did not have.
{
  const docs = loadTopicDocs();
  const authored = new Set();
  for (const doc of docs) for (const t of doc.topics || []) for (const i of t.infos || []) for (const k of Object.keys(i)) authored.add(k);

  // Fields whose reader is demonstrated by an arm above, or by the census the arms are built on.
  const DEMONSTRATED = new Set(['x', 'a', 'cell', 'd', 'requires', 'forbids', 'to', 'cf', 'pos', 'from']);

  // Fields with NO world-side reader, kept deliberately, each with the reason it was not cut.
  const DECLARED_DEAD = {
    f: 'Morrowind filter field 4 (Faction), 4 infos on `duties` and `the-ninth-cohort`. '
      + '`infoAllowed()` has no faction branch, so it is not read by anything. KEPT rather than cut '
      + 'because its three referents are live factions with members in the world (rootkeepers 22, '
      + 'ninth-cohort 44, house-dres 2), so it is one `if` away from working — and `infoAllowed()` '
      + 'belongs to `game/src/character/converse.js`, which W1-17 r2 does not own and which seam '
      + 'ruling S37 is currently deciding. Reported here so it cannot hide; not silently deleted.',
  };

  // Fields CUT this round, which must not come back without a reader. `res` and `q` were a pair:
  // 13 infos carrying `q: true` ("this info opens a quest") and
  // `res: {journal: [<quest-id>, 10]}` (Morrowind's RESULT SCRIPT, which RI-DLG01 §A pairs with
  // AddTopic as the file's most important structural fact). Both were dead TWICE OVER:
  //   1. no reader — `infoFor()` does not carry either field out of its return literal, and
  //      nothing in `game/src/**` mentions them;
  //   2. no referent — all thirteen quest ids (`q-under-drain`, `q-heirs-clause`, `q-dead-pay`, …)
  //      appear NOWHERE in the 120-quest register under `game/data/quests/**`. They name journal
  //      entries for quests that were never authored.
  // Wiring them would have meant inventing thirteen quests, which is volume this round was
  // explicitly told not to add, to feed a reader that would then advance a journal for a quest
  // that does not exist. They were cut. This list is the guard that keeps them cut.
  const CUT = {
    res: '13 infos. No reader in game/src/** AND all 13 quest ids name no quest in game/data/quests/**.',
    q: '13 infos, always paired with `res`. build-graph.mjs reads the TOPIC-level `quest` field (25 topics), not this one.',
  };

  const undeclared = [...authored].filter((k) => !DEMONSTRATED.has(k) && !(k in DECLARED_DEAD));
  const resurrected = Object.keys(CUT).filter((k) => authored.has(k));

  console.log('\n---- field-coverage census: is every authored field accounted for? ----');
  console.log(`      authored field names: ${[...authored].sort().join(', ')}`);
  for (const [k, why] of Object.entries(DECLARED_DEAD)) {
    if (authored.has(k)) console.log(`\n      DECLARED DEAD  \`${k}\`\n        ${why.replace(/\s+/g, ' ')}`);
  }
  for (const [k, why] of Object.entries(CUT)) {
    console.log(`      CUT this round \`${k}\` — ${why}${authored.has(k) ? '   *** BUT IT IS BACK ***' : ''}`);
  }
  const bad = undeclared.length + resurrected.length;
  if (undeclared.length) console.log(`\n      ! ${undeclared.length} field(s) with no arm and no declaration: ${undeclared.join(', ')}`);
  if (resurrected.length) console.log(`      ! ${resurrected.length} cut field(s) re-authored without a reader: ${resurrected.join(', ')}`);
  console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'}  field-coverage census — ${authored.size} authored field name(s), ${bad} unaccounted for.`);
  if (bad) fails++;
}

// ---- `res` — THE POSITIVE CONTROL FOR A FIELD WITH NO READER ----------------------------------
//
// Cutting a dead field is only honest if you can show it was dead. So this arm puts `res` BACK, in
// memory, on the thirteen infos that carried it, and runs the same census the positive controls
// run. `x` moves every answer in the province; `res` moves none, because nothing reads it. The arm
// asserts the ZERO — it is the one arm here whose `mustDiffer` is false — and it is paired with a
// live control in the same run so that a zero produced by a broken harness cannot pass as a zero
// produced by a dead field.
{
  const RES_TOPICS = ['the-dead-pay', 'the-heirs-clause', 'the-unfinished-survey', 'the-man-in-the-water',
    'the-unlisted-well', 'the-under-drain', 'the-thinning', 'the-cleared-ground', 'the-lung-wage',
    'the-petition', 'the-thorn-charter', 'the-listening-at-soulrest', 'the-removed-name'];
  const answersOver = (docs) => {
    const idx = buildTopicIndex(docs);
    const out = [];
    for (const npc of npcs) for (const tid of RES_TOPICS) {
      const r = infoFor(idx, tid, npc, P());
      out.push(r ? r.text : null);
    }
    return out;
  };
  const baseAnswers = answersOver(base);

  const withRes = mine();
  let injected = 0;
  for (const doc of withRes) for (const t of doc.topics || []) {
    if (!RES_TOPICS.includes(t.id)) continue;
    for (const i of t.infos || []) { i.res = { journal: [`q-${t.id}`, 10] }; i.q = true; injected++; }
  }
  const resAnswers = answersOver(withRes);
  const resChanged = resAnswers.filter((v, n) => v !== baseAnswers[n]).length;

  // The live control, in the same run, over the same topics and the same speakers.
  const withX = mine();
  let xEdited = 0;
  for (const doc of withX) for (const t of doc.topics || []) {
    if (!RES_TOPICS.includes(t.id)) continue;
    for (const i of t.infos || []) { i.x = 'PERTURBED'; xEdited++; }
  }
  const xChanged = answersOver(withX).filter((v, n) => v !== baseAnswers[n]).length;

  console.log('\n---- `res` (Morrowind RESULT SCRIPT): the field this round CUT, and the proof it was dead ----');
  console.log(`      re-injected \`res\`+\`q\` onto ${injected} info(s) over ${RES_TOPICS.length} topics x ${npcs.length} speakers`);
  console.log(`        answers changed:  ${resChanged}     <- must be 0; nothing in game/src reads it`);
  console.log(`      positive control — \`x\` perturbed on the SAME ${xEdited} info(s), same speakers, same run`);
  console.log(`        answers changed:  ${xChanged}     <- must be > 0, or this harness is measuring nothing`);
  const ok = resChanged === 0 && xChanged > 0;
  if (!ok) fails++;
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  \`res\` had no reader (0 changed) against a live control in the same run (${xChanged} changed).`);
  if (!ok && xChanged === 0) console.log('      ^ the CONTROL did not move either — this is an inert control, not a dead field (RULES 6).');
}

// ---- the break arm (RULES 4) -------------------------------------------------------------------
// `--break` re-runs the field-coverage census with a field name the corpus does not declare, to
// confirm the census can actually fail. Round 1's consume.mjs had no `--break` at all (0
// occurrences in the source), which the critic recorded.
if (BREAK) {
  const docs = loadTopicDocs();
  for (const doc of docs) for (const t of doc.topics || []) for (const i of t.infos || []) { i.zzz_undeclared = 1; break; }
  const authored = new Set();
  for (const doc of docs) for (const t of doc.topics || []) for (const i of t.infos || []) for (const k of Object.keys(i)) authored.add(k);
  const caught = authored.has('zzz_undeclared');
  console.log(`\nBREAK ARM: injected an undeclared field \`zzz_undeclared\`; the census ${caught ? 'SEES it and would FAIL' : 'DOES NOT SEE IT — the census is inert'}.`);
  if (!caught) { console.error('the field-coverage census cannot fail; refusing to report it as a pass.'); process.exit(2); }
}

console.log(`\n${fails === 0 ? 'ALL ARMS PASS' : `${fails} ARM(S) FAILED`} — every field named above has a reader that changed its answer when the field moved, or is declared dead with a reason.`);
process.exit(fails ? 1 : 0);
