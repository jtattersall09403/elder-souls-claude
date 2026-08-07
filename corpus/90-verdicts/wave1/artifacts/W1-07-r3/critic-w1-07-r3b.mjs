#!/usr/bin/env node
// critic-w1-07-r3b.mjs — CRITIC's own census of who can talk to whom.
//
// Round 3's best finding was its own: "race changes the topic list" passed while a Saxhleel —
// the native race of the province — was offered ZERO topics by 3 of 4 Helstrom NPCs. That is a
// differentiation measure satisfied by a difference in the WRONG DIRECTION. This probe asks
// what else has that shape, and it does not use `chr-talk-probe.mjs` (the builder's) or
// `creation-audit.mjs`'s new `dialogue` section (also the builder's) to do it.
//
// It runs in bare Node against the shipped data and the shipped `converse.js`, so it measures
// the same functions the engine calls without needing the browser (the live cross-check is
// critic-w1-07-r3c). Five questions:
//
//   Q1  MUTE PAIRS      — (npc, race) pairs offered zero topics.
//   Q2  MUTE PER RACE   — is any RACE systematically worse off? (the Saxhleel shape)
//   Q3  MUTE PER PLACE  — is any SETTLEMENT effectively silent for some race?
//   Q4  DIRECTION       — where a race gate fires, does it ADD or REMOVE? A gate set that only
//                         ever subtracts makes "the list differs by race" true and the game
//                         worse for whoever is subtracted from.
//   Q5  DEPTH           — how many topics does each race get, best/worst, and the ratio.
import fs from 'node:fs';
import path from 'node:path';
import { buildTopicIndex, topicsFor, infoFor } from '../../game/src/character/converse.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const say = (s) => process.stdout.write(s + '\n');

const races = D('progression/races.json').races.map((r) => r.id);
const topicDocs = fs.readdirSync(path.join(ROOT, 'game/data/dialogue/topics'))
  .filter((f) => f.endsWith('.json')).map((f) => D('dialogue/topics/' + f));
const idx = buildTopicIndex(topicDocs);

// Every NPC record the build ships, from every npc file.
const npcs = [];
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/npcs'))) {
  if (!f.endsWith('.json')) continue;
  const doc = D('npcs/' + f);
  for (const n of (doc.npcs || [])) npcs.push({ ...n, _file: f });
}

const UPB = 'lukiul';
const out = { npcs: npcs.length, races: races.length, pairs: npcs.length * races.length, mute: [], by_race: {}, by_place: {}, direction: {}, depth: {} };

say(`NPC records: ${npcs.length}   races: ${races.length}   (npc,race) pairs: ${npcs.length * races.length}`);

// ---- Q1/Q2/Q3/Q5 -------------------------------------------------------------------------
const counts = {};            // npc -> race -> topic count
for (const n of npcs) {
  counts[n.id] = {};
  for (const r of races) {
    const t = topicsFor(idx, n, { race: r, upbringing: UPB });
    counts[n.id][r] = t.length;
    if (!t.length) out.mute.push({ npc: n.id, race: r, place: n.settlement || n.state || null, file: n._file, listed_topics: (n.topics || []).length });
  }
}
say(`\nQ1 MUTE (npc,race) pairs offered zero topics: ${out.mute.length} of ${npcs.length * races.length}`);
for (const m of out.mute) say(`   MUTE  ${m.npc.padEnd(28)} to ${m.race.padEnd(10)} (${m.listed_topics} topics on record, ${m.place})`);

say('\nQ2 topics offered, per race, summed over every NPC in the build:');
const raceTotals = races.map((r) => ({ race: r, total: npcs.reduce((a, n) => a + counts[n.id][r], 0), mute: npcs.filter((n) => !counts[n.id][r]).length }));
raceTotals.sort((a, b) => b.total - a.total);
for (const rt of raceTotals) say(`   ${rt.race.padEnd(10)} ${String(rt.total).padStart(4)} topics   mute with ${rt.mute} of ${npcs.length} people`);
out.by_race = Object.fromEntries(raceTotals.map((r) => [r.race, { total: r.total, mute_npcs: r.mute }]));
const best = raceTotals[0], worst = raceTotals[raceTotals.length - 1];
out.depth = { best: best.race, best_total: best.total, worst: worst.race, worst_total: worst.total, ratio: +(worst.total / best.total).toFixed(3) };
say(`   spread: best ${best.race} ${best.total}; worst ${worst.race} ${worst.total}; ratio ${out.depth.ratio}`);

say('\nQ3 per settlement/state, the worst-served race:');
const places = {};
for (const n of npcs) { const p = n.settlement || n.state || n._file; (places[p] = places[p] || []).push(n); }
for (const [p, list] of Object.entries(places)) {
  const per = races.map((r) => ({ r, t: list.reduce((a, n) => a + counts[n.id][r], 0) }));
  per.sort((a, b) => a.t - b.t);
  const muteHere = races.filter((r) => list.every((n) => !counts[n.id][r]));
  out.by_place[p] = { npcs: list.length, worst: per[0].r, worst_topics: per[0].t, best: per[per.length - 1].r, best_topics: per[per.length - 1].t, silent_races: muteHere };
  say(`   ${p.padEnd(26)} ${String(list.length).padStart(2)} people  worst ${per[0].r}=${per[0].t}  best ${per[per.length - 1].r}=${per[per.length - 1].t}` +
      (muteHere.length ? `   SILENT FOR: ${muteHere.join(', ')}` : ''));
}

// ---- Q4 direction of the gates -------------------------------------------------------------
// For every (npc, topic) the record lists, count how many races get an answer. A topic answered
// for 1 race out of 10 is a gate that SUBTRACTS from nine people; a topic answered for 10 is
// ungated. The interesting number is the shape of the distribution.
let pairs = 0, answeredAll = 0, subtractive = 0, singleRace = 0;
const hist = {};
const worstTopics = [];
for (const n of npcs) for (const id of (n.topics || [])) {
  pairs++;
  const got = races.filter((r) => !!infoFor(idx, id, n, { race: r, upbringing: UPB }));
  hist[got.length] = (hist[got.length] || 0) + 1;
  if (got.length === races.length) answeredAll++;
  else { subtractive++; worstTopics.push({ npc: n.id, topic: id, answered_for: got.length, races: got }); }
  if (got.length <= 1) singleRace++;
}
say(`\nQ4 (npc,topic) pairs on record: ${pairs}`);
say(`   answered for all ${races.length} races : ${answeredAll}`);
say(`   answered for fewer            : ${subtractive}   (of which 0 or 1 race: ${singleRace})`);
say(`   histogram races-answered -> count: ${JSON.stringify(hist)}`);
for (const w of worstTopics.filter((x) => x.answered_for < races.length).slice(0, 40)) {
  say(`     ${w.npc.padEnd(26)} ${w.topic.padEnd(26)} answered for ${w.answered_for}: ${w.races.join(',')}`);
}
out.direction = { pairs, answered_all: answeredAll, subtractive, single_race: singleRace, hist, examples: worstTopics.slice(0, 60) };

// ---- Q6 does the ANSWER differ, not just the list? ------------------------------------------
let varying = 0, constant = 0;
const varyingList = [];
for (const n of npcs) for (const id of (n.topics || [])) {
  const texts = new Set();
  for (const r of races) { const i = infoFor(idx, id, n, { race: r, upbringing: UPB }); if (i) texts.add(i.text); }
  if (texts.size > 1) { varying++; varyingList.push({ npc: n.id, topic: id, distinct: texts.size }); } else constant++;
}
say(`\nQ6 (npc,topic) pairs whose ANSWER text differs by race: ${varying}; identical for every race: ${constant}`);
out.answer_variation = { varying, constant, examples: varyingList.slice(0, 40) };

fs.mkdirSync(path.join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-07-r3'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-07-r3/talk-census-critic.json'), JSON.stringify(out, null, 2));
say('\nwrote corpus/90-verdicts/wave1/artifacts/W1-07-r3/talk-census-critic.json');
