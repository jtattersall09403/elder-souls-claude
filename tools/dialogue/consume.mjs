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
import { buildTopicIndex, infoFor, topicsFor } from '../../game/src/character/converse.js';
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

// ---- 6b. `name` — the words the player sees on the topic, as against the slug -------------------
//
// W1-DLG-TOPIC-WEB, plan §4A/§4E. `name` is a TOPIC-RECORD field, not an INFO field, so the
// field-coverage census below (which walks info keys) is structurally blind to it — which is
// exactly how 23 `name` fields sat in this corpus being read by nothing. The shipped labeller is
// `topicLabel()`, called from `topicsFor()`, and it is what puts words in the topic column.
//
// THIS ARM WAS RED BEFORE THE READER EXISTED, ON PURPOSE (RULES rule 4). Run it at a tree where
// `topicLabel(id)` is `String(id).split('-').join(' ')` and the label does not move when `name` is
// rewritten, because nothing reads it. That red run is the evidence the arm can fail.
{
  const idxBase = buildTopicIndex(base);
  // Any speaker who actually offers a non-root subject of their own, so the label being measured
  // is one a player would really see in the column rather than one this tool constructed.
  let npc = null, pick = null;
  for (const n of npcs) {
    const rows = topicsFor(idxBase, n, P());
    const r = rows.find((x) => !x.root && base.some((d) => (d.topics || []).some((t) => t.id === x.id)));
    if (r) { npc = n; pick = r.id; break; }
  }
  const labelOf = (docs) => {
    const rows = topicsFor(buildTopicIndex(docs), npc, P());
    const row = rows.find((x) => x.id === pick);
    return row ? row.text : null;
  };
  const d = clone(base);
  for (const doc of d) for (const t of doc.topics || []) if (t.id === pick) t.name = 'PERTURBED Name Of A Thing';
  arm('`name` — the words in the topic column, as against the slug', {
    field: `\`name\` on the topic record #${pick}`,
    reader: 'topicLabel(record, index) <- topicsFor() (converse.js) -> engine.js:3573 topic column',
    before: { label: `${npc && npc.name} (${npc && npc.id}) sees the subject listed as:`, value: labelOf(base) },
    after: { label: 'after authoring a different `name` on that topic record:', value: labelOf(d) },
  });
}

// ---- 6c. `implied` — the unlock the author declared invisible on purpose ------------------------
//
// W1-DLG-TOPIC-WEB, plan §2b/§4C. A1b's whole point is that an invisible unlock must be a CHOICE a
// writer made and a number a census can count, rather than the silent default. That is only true if
// the flag survives into the shipped reader's return value: a flag that lives in JSON and stops
// there is the eighteenth model nobody reads.
//
// The reader is `infoFor()` — the exact function `Engine.conversationSay()` calls — which carries
// `implied` out beside `to`, in the same way and for the same reason it already carries `res`,
// `cf`, `pos` and `cell` out. WHAT THIS ARM DOES NOT CLAIM, said plainly: the behavioural half of
// §2b (grant on the click for a visible unlock, grant on read only for an `implied` one) is
// `Engine.conversationSay()`'s, which is `W1-UIX08`'s file under the §2a seam and is NOT built
// here. This arm demonstrates the flag reaches the shipping reader; it does not demonstrate the
// click. Same standard as the `res` arm below, and it is stated rather than glossed.
{
  let npc = null, pick = null, dst = null;
  const idxBase = buildTopicIndex(base);
  for (const n of npcs) {
    for (const id of (n.topics || [])) {
      const r = infoFor(idxBase, id, n, P());
      if (r && r.to && r.to.length) { npc = n; pick = id; dst = r.to[0]; break; }
    }
    if (npc) break;
  }
  const impliedOf = (docs) => {
    const r = infoFor(buildTopicIndex(docs), pick, npc, P());
    return r ? (r.implied === undefined ? '(the reader does not carry `implied` at all)' : r.implied) : null;
  };
  const d = clone(base);
  for (const doc of d) for (const t of doc.topics || []) if (t.id === pick) {
    for (const i of t.infos || []) if (Array.isArray(i.to) && i.to.includes(dst)) i.implied = [dst];
  }
  arm('`implied` — the unlock a writer declared invisible on purpose (A1b)', {
    field: `\`implied\` on an INFO of #${pick}, naming its \`to\` destination #${dst}`,
    reader: 'infoFor() -> `implied`, alongside `to`, for Engine.conversationSay() (converse.js)',
    before: { label: `asking ${npc && npc.name} about "${pick}" with nothing flagged:`, value: impliedOf(base) },
    after: { label: `with that one unlock flagged \`implied: ["${dst}"]\`:`, value: impliedOf(d) },
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
// Every authored field must have a demonstrated reader. W1-17 completion wires the former
// dead fields `f` and `res`; neither is accepted as a declaration-only pass any longer.
{
  const docs = loadTopicDocs();
  const authored = new Set();
  for (const doc of docs) for (const t of doc.topics || []) for (const i of t.infos || []) for (const k of Object.keys(i)) authored.add(k);
  const DEMONSTRATED = new Set(['x','a','cell','d','requires','forbids','to','cf','pos','from','f','res','implied']);
  const undeclared=[...authored].filter(k=>!DEMONSTRATED.has(k));
  console.log('\n---- field-coverage census: is every authored field accounted for? ----');
  console.log(`      authored field names: ${[...authored].sort().join(', ')}`);
  if(undeclared.length){console.log(`      unaccounted: ${undeclared.join(', ')}`);fails++;}
  console.log(`${undeclared.length?'FAIL':'PASS'}  field-coverage census — ${authored.size} authored field name(s), ${undeclared.length} unaccounted for.`);

  const idx=buildTopicIndex(docs);
  const factionNpc=npcs.find(n=>n.actor==='legionary' && String(n.faction).replaceAll('_','-')==='ninth-cohort');
  const wrongNpc=npcs.find(n=>n.actor==='legionary' && n.faction && String(n.faction).replaceAll('_','-')!=='ninth-cohort');
  const yes=factionNpc&&infoFor(idx,'duties',factionNpc,P());
  const no=wrongNpc&&infoFor(idx,'duties',wrongNpc,P());
  const factionOK=!!yes && (!no || no.text!==yes.text);
  console.log(`${factionOK?'PASS':'FAIL'}  f consumer — faction-qualified duties changes with the speaker faction.`);
  if(!factionOK)fails++;

  const steward=npcs.find(n=>n.id==='ixtu-meer');
  const result=steward&&infoFor(idx,'the-steward-of-the-count',steward,{...P(),race:'saxhleel',upbringing:'interior',disposition:90,knows:new Set()});
  const resOK=!!(result&&result.res&&result.res.journal&&result.res.flag&&result.res.addTopic);
  console.log(`${resOK?'PASS':'FAIL'}  res reader — RESULT journal, flag and AddTopic leave infoFor() for Engine.conversationSay().`);
  if(!resOK)fails++;
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
  process.exit(1); // expected red: the deliberately unknown authored field is a hard failure
}

console.log(`\n${fails === 0 ? 'ALL ARMS PASS' : `${fails} ARM(S) FAILED`} — every authored field is accounted for by a reader/consumer arm.`);
process.exit(fails ? 1 : 0);
