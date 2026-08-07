#!/usr/bin/env node
// The contradiction census — RI-LOR06 "Comparison method" steps 4 and 5, run against the
// SHIPPED tree rather than against the registry's own prose.
//
// Owner: W1-23. Binding sources: RI-LOR06 §1 (every contradiction is registered or is a bug),
// RI-LOR06 Comparison method §4 (fully-voiced disputes, bar ≥8) and §5 (adjudicator hunt),
// RI-MTH07 / ARBITRATION §3 (a register nothing reads is a document).
//
// WHY THIS FILE EXISTS.
// `corpus/80-methods/canon-check.py --validate-registry` checks that the registry is
// well-formed. It has passed since the day the registry was seeded, and it would keep passing
// if every fact in it described a game that does not exist. RI-LOR06's own comparison method
// asks a harder question in step 4 — *how many disputed facts have BOTH sides actually spoken
// by a real book or a real NPC in the build* — and sets the failure bar at eight. That step had
// never been run by anything, because nothing existed that could read the registry and the game
// at the same time. This does.
//
// Three checks, each of which can go red on its own:
//
//   VOICED   Every `positions[].voiced_by` id must name a book, a dialogue info or an NPC that
//            is really in `game/data/**`. A dispute all of whose positions resolve is FULLY
//            VOICED. A position that resolves to nothing is a position nobody in the world
//            holds — RI-LOR06's "a note dressed as a dispute".
//   EDGES    Every `contradicts[]` edge in a shipped book must carry a `cf` that names a
//            registry fact, and that fact must be `disputed: true`. RI-LOR06 §1: there is no
//            third category between "registered" and "bug".
//   ADJUDGE  §5's adjudicator hunt, mechanised: any shipped text that both matches an
//            adjudicating phrase and sits on a registered dispute's subject is printed for
//            review. Narration settling a dispute is a hard fail; a named speaker being sure of
//            themselves is the texture working, so this REPORTS and does not grade.
//
// Exit 1 on VOICED or EDGES failure. `--json` for machine use. `--self-test` breaks each check
// on purpose and asserts it goes red, because a probe that cannot fail is worse than no probe.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = path.join(ROOT, 'corpus/60-lore/data/canon-facts.json');

/** Fold a topic id the way `game/src/core/topics.js` folds it, so prose and slug spellings meet. */
export function fold(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

/**
 * Everything the shipped build can be said to contain, in the id vocabulary the registry uses.
 *
 * Built by reading `game/data/**` directly rather than by trusting `index.json`, for the same
 * reason `Engine._opacityWorldIndex()` gives: a file listed in the manifest and dropped by the
 * loader would otherwise still resolve.
 */
export function buildWorldIndex(gameData = path.join(ROOT, 'game/data')) {
  const books = new Map();      // book id -> {title, author, file, contradicts[]}
  const topics = new Map();     // folded topic key -> [{a, x, cf, pos, file}]
  const npcs = new Set();
  const bookText = new Map();   // book id -> full text

  for (const f of walk(path.join(gameData, 'books'))) {
    const doc = readJson(f);
    const list = Array.isArray(doc.books) ? doc.books : (doc.id ? [doc] : []);
    for (const b of list) {
      if (!b.id) continue;
      books.set(b.id, {
        title: b.title || null, author: b.author || null,
        file: path.relative(ROOT, f), contradicts: b.contradicts || [],
      });
      const t = Array.isArray(b.pages) ? b.pages.join('\n') : (b.text || '');
      bookText.set(b.id, String(t));
    }
  }
  for (const f of walk(path.join(gameData, 'dialogue/topics'))) {
    const doc = readJson(f);
    for (const t of (doc.topics || [])) {
      if (!t || typeof t.id !== 'string') continue;
      const k = fold(t.id);
      const rows = topics.get(k) || [];
      for (const i of (t.infos || [])) {
        rows.push({ topic: t.id, a: i.a || null, x: i.x || '', cf: i.cf || null, pos: i.pos || null, file: path.relative(ROOT, f) });
      }
      topics.set(k, rows);
    }
  }
  for (const f of walk(path.join(gameData, 'npcs'))) {
    const doc = readJson(f);
    for (const n of (doc.npcs || [])) if (n && n.id) npcs.add(n.id);
  }
  return { books, topics, npcs, bookText };
}

/**
 * Resolve one `voiced_by` id against the build.
 *
 * The vocabulary is deliberately the same as `world/opacity.json`'s, so that a reader who knows
 * one register knows the other:
 *
 *   `book:<id>`               a shipped book asserts this position
 *   `dialogue:<topic>#<actor>` a shipped info, written for that actor's mouth, asserts it
 *   `npc:<id>`                a named person asserts it on their own record
 */
export function resolveVoice(id, world) {
  const [kind, rest] = String(id).split(':');
  if (kind === 'book') return world.books.has(rest) ? { ok: true, kind } : { ok: false, kind, why: 'no such book' };
  if (kind === 'npc') return world.npcs.has(rest) ? { ok: true, kind } : { ok: false, kind, why: 'no such npc' };
  if (kind === 'dialogue') {
    const [topic, actor] = String(rest).split('#');
    const rows = world.topics.get(fold(topic));
    if (!rows) return { ok: false, kind, why: `no such topic \`${topic}\`` };
    if (!actor) return { ok: true, kind };
    const hit = rows.find((r) => r.a === actor);
    return hit ? { ok: true, kind } : { ok: false, kind, why: `topic \`${topic}\` has no info written for actor \`${actor}\`` };
  }
  return { ok: false, kind: kind || '?', why: 'unknown id prefix (expected book: / dialogue: / npc:)' };
}

/** §4. Which registered disputes are actually held by somebody in the shipped world. */
export function censusVoiced(reg, world) {
  const rows = [];
  for (const f of reg.facts) {
    if (!f.disputed) continue;
    const positions = (f.positions || []).map((p) => {
      const ids = p.voiced_by || [];
      const res = ids.map((id) => ({ id, ...resolveVoice(id, world) }));
      return { id: p.id, held_by: p.held_by || [], declared: ids.length, resolved: res.filter((r) => r.ok).length, bad: res.filter((r) => !r.ok) };
    });
    rows.push({
      id: f.id, claim: f.claim,
      positions,
      fully_voiced: positions.length >= 2 && positions.every((p) => p.resolved >= 1),
      silent_positions: positions.filter((p) => p.resolved === 0).map((p) => p.id),
      dangling: positions.flatMap((p) => p.bad.map((b) => `${f.id}/${p.id}: ${b.id} — ${b.why}`)),
    });
  }
  return rows;
}

/** §1. Every contradiction edge in a shipped book is registered, or it is a bug. */
export function censusEdges(reg, world) {
  const byId = new Map(reg.facts.map((f) => [f.id, f]));
  const edges = [];
  for (const [id, b] of world.books) {
    for (const c of b.contradicts) {
      const e = { from: id, to: c.book, on: c.on || null, cf: c.cf || null, file: b.file, problems: [] };
      if (!world.books.has(c.book)) e.problems.push(`names \`${c.book}\`, which is not a book in this build`);
      if (!c.cf) e.problems.push('carries no `cf` — an unregistered contradiction is a bug by RI-LOR06 §1');
      else if (!byId.has(c.cf)) e.problems.push(`cites \`${c.cf}\`, which is not in the registry`);
      else if (!byId.get(c.cf).disputed) e.problems.push(`cites \`${c.cf}\`, which is not marked \`disputed\``);
      edges.push(e);
    }
  }
  return edges;
}

/** §5. Adjudicator hunt, narrowed to text that sits on a registered dispute. */
const ADJUDICATORS = /\b(in (fact|truth)|the truth is|it turns out|we now know|has been (proved|settled)|proved (that|to be)|settles the (matter|question)|beyond dispute)\b/i;

export function huntAdjudicators(reg, world) {
  const subjects = [];
  for (const f of reg.facts) {
    if (!f.disputed) continue;
    for (const w of String(f.claim).toLowerCase().match(/[a-z]{5,}/g) || []) subjects.push({ w, fact: f.id });
  }
  const hits = [];
  const consider = (label, text, where) => {
    const t = String(text);
    const m = t.match(ADJUDICATORS);
    if (!m) return;
    const lower = t.toLowerCase();
    const touched = [...new Set(subjects.filter((s) => lower.includes(s.w)).map((s) => s.fact))];
    if (!touched.length) return;
    const i = Math.max(0, t.indexOf(m[0]) - 60);
    hits.push({ where: label, file: where, facts: touched, phrase: m[0], excerpt: t.slice(i, i + 200).replace(/\s+/g, ' ') });
  };
  for (const [id, txt] of world.bookText) consider(`book:${id}`, txt, world.books.get(id).file);
  for (const [, rows] of world.topics) for (const r of rows) consider(`dialogue:${r.topic}#${r.a || '-'}`, r.x, r.file);
  return hits;
}

function main(argv) {
  const asJson = argv.includes('--json');
  if (argv.includes('--self-test')) return selfTest();

  const reg = readJson(REGISTRY);
  const world = buildWorldIndex();
  const voiced = censusVoiced(reg, world);
  const edges = censusEdges(reg, world);
  const adj = huntAdjudicators(reg, world);

  const fully = voiced.filter((v) => v.fully_voiced);
  const dangling = voiced.flatMap((v) => v.dangling);
  const badEdges = edges.filter((e) => e.problems.length);
  const BAR = 8;

  const summary = {
    books: world.books.size,
    dialogue_topics: world.topics.size,
    registry_facts: reg.facts.length,
    disputed: voiced.length,
    fully_voiced: fully.length,
    bar_fully_voiced: BAR,
    contradiction_edges: edges.length,
    unregistered_edges: edges.filter((e) => !e.cf).length,
    bad_edges: badEdges.length,
    dangling_voices: dangling.length,
    adjudicator_hits: adj.length,
  };

  const ok = fully.length >= BAR && badEdges.length === 0 && dangling.length === 0;

  if (asJson) {
    console.log(JSON.stringify({ ok, summary, voiced, bad_edges: badEdges, adjudicators: adj }, null, 2));
    return ok ? 0 : 1;
  }

  console.log(`registry : ${path.relative(ROOT, REGISTRY)}`);
  console.log(`build    : ${world.books.size} books, ${world.topics.size} dialogue topics, ${world.npcs.size} npcs\n`);

  console.log(`VOICED   RI-LOR06 method §4 — a dispute is fully voiced when every position is spoken by a shipped source.`);
  for (const v of voiced) {
    const mark = v.fully_voiced ? ' ok ' : 'SILENT';
    const detail = v.positions.map((p) => `${p.id}:${p.resolved}/${p.declared}`).join(' ');
    console.log(`  ${mark}  ${v.id}  ${detail}   ${v.claim.slice(0, 66)}`);
    for (const d of v.dangling) console.log(`         DANGLING ${d}`);
  }
  console.log(`  fully voiced: ${fully.length} / ${voiced.length}   bar ≥${BAR}  ${fully.length >= BAR ? 'PASS' : 'FAIL'}\n`);

  console.log(`EDGES    RI-LOR06 §1 — every contradiction in shipped content is registered, or it is a bug.`);
  console.log(`  edges: ${edges.length}   unregistered: ${summary.unregistered_edges}   malformed: ${badEdges.length}`);
  for (const e of badEdges.slice(0, 40)) console.log(`    ${e.from} -> ${e.to}  (${e.on})\n      ${e.problems.join('\n      ')}`);
  if (badEdges.length > 40) console.log(`    … and ${badEdges.length - 40} more`);
  console.log('');

  console.log(`ADJUDGE  RI-LOR06 method §5 — text that settles a registered dispute. Reported, not graded.`);
  if (!adj.length) console.log('  no hits.');
  for (const h of adj) console.log(`  ${h.where}  [${h.facts.join(',')}]  "${h.phrase}"\n     …${h.excerpt}…`);
  console.log('');

  console.log(ok ? 'CANON CENSUS: PASS' : 'CANON CENSUS: FAIL');
  return ok ? 0 : 1;
}

/**
 * Break each check on purpose and confirm it goes red. AGENT-PROTOCOL: "a probe that cannot fail
 * is worse than no probe."
 */
function selfTest() {
  let fails = 0;
  const t = (name, cond) => { if (!cond) { fails++; console.log(`  FAIL ${name}`); } else console.log(`  ok   ${name}`); };

  const world = {
    books: new Map([
      ['a', { title: 'A', author: 'x', file: 'f', contradicts: [{ book: 'b', on: 'the tree', cf: 'CF-D001' }] }],
      ['b', { title: 'B', author: 'y', file: 'f', contradicts: [] }],
    ]),
    topics: new Map([['the hist', [{ topic: 'the-hist', a: 'rootkeeper', x: 'It is the tree.', file: 'f' }]]]),
    npcs: new Set(['jeeh-ei']),
    bookText: new Map([['a', 'In truth nothing survives the sap, and the matter is closed.']]),
  };
  const good = {
    facts: [{
      id: 'CF-D001', claim: 'What survives when a soul returns to the Hist?', disputed: true,
      positions: [
        { id: 'A', held_by: ['x'], voiced_by: ['book:a'] },
        { id: 'B', held_by: ['y'], voiced_by: ['dialogue:the-hist#rootkeeper'] },
      ],
    }],
  };

  t('a well-formed dispute counts as fully voiced', censusVoiced(good, world)[0].fully_voiced === true);

  const silent = JSON.parse(JSON.stringify(good));
  silent.facts[0].positions[1].voiced_by = [];
  t('a position nobody voices is NOT fully voiced', censusVoiced(silent, world)[0].fully_voiced === false);

  const dangles = JSON.parse(JSON.stringify(good));
  dangles.facts[0].positions[1].voiced_by = ['book:does-not-exist'];
  const dv = censusVoiced(dangles, world)[0];
  t('a dangling voiced_by is caught', dv.dangling.length === 1 && !dv.fully_voiced);

  const wrongActor = JSON.parse(JSON.stringify(good));
  wrongActor.facts[0].positions[1].voiced_by = ['dialogue:the-hist#dres-factor'];
  t('a voice attributed to an actor with no info there is caught',
    censusVoiced(wrongActor, world)[0].dangling.length === 1);

  t('a registered edge is clean', censusEdges(good, world).filter((e) => e.problems.length).length === 0);

  const w2 = JSON.parse(JSON.stringify({ b: [...world.books] }));
  const unreg = new Map(w2.b);
  unreg.get('a').contradicts[0].cf = null;
  t('an edge with no cf is caught',
    censusEdges(good, { ...world, books: unreg }).filter((e) => e.problems.length).length === 1);

  const w3 = new Map(JSON.parse(JSON.stringify([...world.books])));
  w3.get('a').contradicts[0].cf = 'CF-999';
  t('an edge citing a fact not in the registry is caught',
    censusEdges(good, { ...world, books: w3 }).filter((e) => e.problems.length).length === 1);

  const notDisputed = JSON.parse(JSON.stringify(good));
  notDisputed.facts[0].disputed = false;
  t('an edge citing a fact that is not marked disputed is caught',
    censusEdges(notDisputed, world).filter((e) => e.problems.length).length === 1);

  t('the adjudicator hunt sees "in truth" on a dispute subject',
    huntAdjudicators(good, world).length === 1);

  const quiet = { ...world, bookText: new Map([['a', 'The sapwell is cut at the turn of the tide.']]) };
  t('the adjudicator hunt is silent on ordinary prose', huntAdjudicators(good, quiet).length === 0);

  console.log(fails ? `SELF-TEST: ${fails} FAILED` : 'SELF-TEST: PASS');
  return fails ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
