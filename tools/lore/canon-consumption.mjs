#!/usr/bin/env node
// Does anything read the canon register? — the RI-MTH07 / ARBITRATION §3 demonstration.
//
// Owner: W1-23. Binding: RI-MTH07 (CONSUMPTION — name the world-side consumer and show the
// world changing when the model is perturbed), AGENT-PROTOCOL ("a probe that cannot fail is
// worse than no probe").
//
// Fourteen subsystems in this project have been scored zero for having a model nobody reads, and
// `corpus/60-lore/data/canon-facts.json` was one of them for the whole of wave 1: its only
// readers were two scripts under `corpus/80-methods/`. This runs the REAL modules the engine
// runs — `game/src/world/canon.js` and `game/src/character/converse.js` — over the REAL shipped
// data, and does three things a document could not survive:
//
//   1. DISAGREEMENT. Put one topic to two different people and get two incompatible answers,
//      each of which the register says that person holds.
//   2. PERTURBATION. Strike a holder out of the register in memory, re-ask, and watch the answer
//      change or vanish. If the answer does not move, the register is not being read.
//   3. FAIL-CLOSED. Point a `voiced_by` at a book nobody wrote and confirm `resolve()` goes red,
//      which is what makes the engine's boot throw meaningful.
//
// Reads no browser and steps no simulation: this is the same code path the engine takes, one
// layer down. The engine-level half — that `_installCanon()` runs at boot and `getCanonState()`
// answers — is confirmed separately in the page.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanonRegistry } from '../../game/src/world/canon.js';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function loadTopics() {
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => read(`game/data/dialogue/topics/${f}`));
}
function loadWorldIndex() {
  const books = new Set();
  const bdir = path.join(ROOT, 'game/data/books');
  for (const f of fs.readdirSync(bdir)) {
    const d = read(`game/data/books/${f}`);
    const list = Array.isArray(d.books) ? d.books : (d.id ? [d] : []);
    for (const b of list) if (b.id) books.add(b.id);
  }
  const topics = new Map();
  for (const doc of loadTopics()) {
    for (const t of (doc.topics || [])) {
      if (!t || typeof t.id !== 'string') continue;
      const k = t.id.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const set = topics.get(k) || new Set();
      for (const i of (t.infos || [])) set.add(i.a || null);
      topics.set(k, set);
    }
  }
  const npcs = new Set();
  const ndir = path.join(ROOT, 'game/data/npcs');
  for (const f of fs.readdirSync(ndir)) for (const n of (read(`game/data/npcs/${f}`).npcs || [])) if (n.id) npcs.add(n.id);
  return { books, topics, npcs };
}

/** Everybody in the province, as `infoFor` sees them. */
function population() {
  const out = [];
  const ndir = path.join(ROOT, 'game/data/npcs');
  for (const f of fs.readdirSync(ndir)) for (const n of (read(`game/data/npcs/${f}`).npcs || [])) out.push(n);
  return out;
}

function main() {
  let fails = 0;
  const bad = (m) => { fails++; console.log(`  FAIL ${m}`); };
  const ok = (m) => console.log(`  ok   ${m}`);

  const doc = read('game/data/lore/canon.json');
  const idx = buildTopicIndex(loadTopics());
  const world = loadWorldIndex();
  const pop = population();
  const PLAYER = { race: 'dunmer', upbringing: null };

  console.log(`register : game/data/lore/canon.json — ${doc.facts.length} facts, ${doc.counts.disputed} disputed, ${doc.counts.voiced_sources} voiced sources`);
  console.log(`world    : ${world.books.size} books, ${world.topics.size} topics, ${pop.length} people\n`);

  // ---------------------------------------------------------------- 0. the register resolves
  console.log('RESOLVE  every source the register says holds a position is in this build');
  const reg = new CanonRegistry(doc);
  const r = reg.resolve(world);
  if (r.ok) ok(`${r.checked} references resolved`);
  else { bad(`${r.unresolved.length} unresolved:\n       ${r.unresolved.slice(0, 8).join('\n       ')}`); }

  // ---------------------------------------------------------------- 1. the register is fallible
  console.log('\nFAIL-CLOSED  break the register on purpose and confirm it goes red');
  const broken = JSON.parse(JSON.stringify(doc));
  const d = broken.facts.find((f) => f.disputed);
  d.positions[0].voiced_by = ['book:a-book-nobody-wrote'];
  const rb = new CanonRegistry(broken).resolve(world);
  if (!rb.ok) ok(`a voiced_by naming a book nobody wrote is caught (${d.id})`);
  else bad('a dangling voiced_by resolved clean — the boot throw is decorative');
  const noHolders = JSON.parse(JSON.stringify(doc));
  delete noHolders.facts.find((f) => f.disputed).positions[0].holders;
  if (!new CanonRegistry(noHolders).resolve(world).ok) ok('a position with no holders is caught');
  else bad('a position nobody can hold resolved clean');

  // ---------------------------------------------------------------- 2. no answers are shipped
  console.log('\nSEALED   the shipped register carries no ruling on any dispute');
  const text = JSON.stringify(doc);
  // The header PROSE names the field, on purpose, to say where the answers live. What must not
  // exist is the field itself on any fact, or any ruling's words anywhere in the bytes.
  const carrying = doc.facts.filter((f) => Object.prototype.hasOwnProperty.call(f, 'authorially_true'));
  if (carrying.length) bad(`${carrying.length} fact(s) ship an \`authorially_true\` field`);
  else ok('no fact in the shipped file carries an `authorially_true` field');
  const seals = doc.facts.filter((f) => f.disputed && !f.deliberately_open && typeof f.truth_seal === 'string' && f.truth_seal.length === 64);
  if (seals.length === doc.facts.filter((f) => f.disputed && !f.deliberately_open).length) ok(`${seals.length} disputes carry a sha256 seal instead`);
  else bad('a dispute with a ruling is shipping without its seal');
  const src = read('corpus/60-lore/data/canon-facts.json');
  const leaks = src.facts.filter((f) => f.disputed && !f.deliberately_open)
    .map((f) => String(f.authorially_true).replace(/^partial:/, '').trim())
    .filter((t) => t.length >= 24 && text.includes(t.slice(0, 40)));
  if (leaks.length) bad(`${leaks.length} ruling(s) leaked verbatim into the build`);
  else ok(`${src.facts.filter((f) => f.disputed).length} rulings stay in the corpus; the build carries sha256 seals`);

  // ---------------------------------------------------------------- 3. THE PROVINCE DISAGREES
  console.log('\nDISAGREE  one topic, two people, two incompatible answers');
  const disputes = doc.facts.filter((f) => f.disputed);
  let shown = 0;
  const tagged = [];
  for (const doc2 of loadTopics()) {
    for (const t of (doc2.topics || [])) for (const i of (t.infos || [])) if (i.cf && i.pos) tagged.push({ topic: t.id, ...i });
  }
  const byTopic = new Map();
  for (const x of tagged) { const a = byTopic.get(x.topic) || []; a.push(x); byTopic.set(x.topic, a); }
  const pairs = [];
  for (const [topic, rows] of byTopic) {
    const sides = new Set(rows.map((x) => `${x.cf}/${x.pos}`));
    if (sides.size >= 2) pairs.push({ topic, rows });
  }
  for (const { topic, rows } of pairs) {
    // Find a real person in the province for each side, and ask them the same word.
    const heard = [];
    for (const row of rows) {
      const who = pop.find((n) => reg.stanceOf(n, row.cf) === row.pos && n.actor === row.a);
      if (!who) continue;
      const got = infoFor(idx, topic, { ...who, topics: [topic] }, PLAYER, reg);
      if (got && got.cf === row.cf && got.pos === row.pos) heard.push({ who, got });
    }
    const sides = new Set(heard.map((h) => h.got.pos));
    if (sides.size >= 2) {
      shown++;
      console.log(`  ${topic}  [${heard[0].got.cf}]`);
      for (const h of heard) console.log(`     ${h.who.actor.padEnd(12)} ${(h.who.settlement || '-').padEnd(10)} pos ${h.got.pos}  "${h.got.text.slice(0, 92)}…"`);
    }
  }
  if (shown >= 3) ok(`${shown} topics on which two real people in the province give incompatible registered answers`);
  else bad(`only ${shown} topic(s) produced a live disagreement — the gate is not reaching people`);

  // ---------------------------------------------------------------- 4. PERTURBATION
  console.log('\nPERTURB  strike a holder out of the register and re-ask the same person');
  let moved = 0, tried = 0;
  for (const { topic, rows } of pairs) {
    for (const row of rows) {
      const who = pop.find((n) => reg.stanceOf(n, row.cf) === row.pos && n.actor === row.a);
      if (!who) continue;
      const before = infoFor(idx, topic, { ...who, topics: [topic] }, PLAYER, reg);
      if (!before || before.pos !== row.pos) continue;
      tried++;
      // Strike this speaker out of EVERY holder list on the position, not just `actors`. A
      // first version removed the actor alone and 4 of 11 lines survived — correctly, because
      // the speaker also matched by faction. A perturbation that leaves another route open
      // measures the route it forgot, not the model.
      const cut = JSON.parse(JSON.stringify(doc));
      const f = cut.facts.find((x) => x.id === row.cf);
      const p = f.positions.find((x) => x.id === row.pos);
      const foldId = (x) => String(x || '').toLowerCase().replace(/^the[_\s-]+/, '').replace(/[_\s-]+/g, '-');
      if (p.holders.actors) p.holders.actors = p.holders.actors.filter((a) => a !== who.actor);
      if (p.holders.factions) p.holders.factions = p.holders.factions.filter((x) => foldId(x) !== foldId(who.faction));
      const after = infoFor(idx, topic, { ...who, topics: [topic] }, PLAYER, new CanonRegistry(cut));
      const changed = !after || after.text !== before.text;
      if (changed) moved++;
      if (moved <= 3 && changed) {
        console.log(`  ${topic} / ${who.actor}: ${row.cf}/${row.pos} holder removed`);
        console.log(`     before "${before.text.slice(0, 76)}…"`);
        console.log(`     after  ${after ? `"${after.text.slice(0, 76)}…"` : '(no answer — the line is gone)'}`);
      }
    }
  }
  if (tried && moved === tried) ok(`${moved}/${tried} registered lines vanish for a speaker the register stops crediting`);
  else bad(`${moved}/${tried} moved — a line that survives its holder being struck is not gated by the register`);

  // ---------------------------------------------------------------- 5. the control
  console.log('\nCONTROL  an untagged line is NOT affected by the register');
  const plain = tagged.length ? null : null;
  let controlOk = true, controlN = 0;
  for (const n of pop.slice(0, 200)) {
    for (const t of (n.topics || []).slice(0, 3)) {
      const with_ = infoFor(idx, t, n, PLAYER, reg);
      const without = infoFor(idx, t, n, PLAYER, null);
      if (with_ && with_.cf) continue;              // tagged; the gate is supposed to matter
      controlN++;
      if ((with_ && with_.text) !== (without && without.text)) { controlOk = false; }
    }
  }
  if (controlOk && controlN > 50) ok(`${controlN} untagged answers are byte-identical with and without the register`);
  else bad(`the register changed ${controlN ? 'an untagged answer' : 'nothing measurable'} — it is not a narrow gate`);
  void plain;

  // ---------------------------------------------------------------- 6. reach
  console.log('\nREACH    how many people in the province hold a registered stance');
  let holders = 0;
  const perFact = new Map();
  for (const n of pop) {
    let any = false;
    for (const f of disputes) { const st = reg.stanceOf(n, f.id); if (st) { any = true; perFact.set(f.id, (perFact.get(f.id) || 0) + 1); } }
    if (any) holders++;
  }
  console.log(`  ${holders} of ${pop.length} people hold at least one registered position (${(100 * holders / pop.length).toFixed(0)}%)`);
  const silent = disputes.filter((f) => !perFact.get(f.id));
  if (silent.length) console.log(`  disputes no living person holds: ${silent.map((f) => f.id).join(', ')}`);
  if (holders >= pop.length * 0.5) ok('a majority of the province takes a side on something');
  else bad(`only ${holders} people take any side — the register is describing a world it does not touch`);

  console.log(fails ? `\nCANON CONSUMPTION: ${fails} FAILED` : '\nCANON CONSUMPTION: PASS');
  return fails ? 1 : 0;
}

process.exit(main());
