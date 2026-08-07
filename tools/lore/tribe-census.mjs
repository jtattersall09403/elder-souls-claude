#!/usr/bin/env node
// tribe-census — RI-LOR08's comparison method, checks 1, 2 and 6.
//
// Owner: W1-TRIBES. Binding: corpus/60-lore/RI-LOR08-argonian-tribes.md, RI-LOR06 §4, RI-MTH07.
//
// WHY THIS EXISTS. CF-C023 recorded that this province's natives were undifferentiated: six canon
// tribe names, zero occurrences each, and four constructed *institutions* doing the work a society
// should do. The correction is cheap to fake. Scatter the six names through dialogue as texture and
// every string search in the project goes green while nothing about the world has changed — which
// is exactly the failure W1-23's registry report warned about in as many words: "if tribes are
// wanted, they need a faction each, not a mention each."
//
// So this tool refuses to count mentions. It asks four questions a mention cannot answer:
//
//   PRESENCE       does each people have a MOUTH (dialogue infos), a BODY (NPC records) and a TEXT
//                  (a book that names it)? A people with two of the three is decoration.
//   DIFFERENTIATION do any two peoples answer the same on three or more of RI-LOR08's five axes —
//                  diet, the Hist, the Empire, Argonians with Imperial names, and the refusal? Two
//                  peoples colliding on 3+ means the second is a hat. This is the check that taste
//                  would pass and arithmetic does not.
//   POSITION       does each people hold at least one position in a registered dispute, so that its
//                  view is a game object rather than a paragraph? Read out of the SHIPPED register
//                  (game/data/lore/canon.json), not the corpus half, because the shipped half is
//                  what the engine gates on.
//   REFUSAL        is each people's "will not" actually spoken by one of its own people in the
//                  build? RI-LOR08 §2: a people with no refusal has not been differentiated, it has
//                  been described.
//
// THE AXIS TABLE IS TRANSCRIBED, NOT DERIVED, and that is a real limitation stated up front. The
// five axes live in prose in RI-LOR08 §2 and nothing machine-readable holds them. The table below
// is this tool's transcription; a critic checking check 2 must read §2 and confirm the transcription
// before trusting the collision count. What the tool guarantees is narrower and still worth having:
// **the collision arithmetic is not done by the person who wants it to pass.**
//
//   node tools/lore/tribe-census.mjs             # census, exit 1 on any failure
//   node tools/lore/tribe-census.mjs --verbose   # print every axis and every hit
//   node tools/lore/tribe-census.mjs --self-test # break each check on purpose, confirm it goes red
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/** Transcribed from corpus/60-lore/RI-LOR08-argonian-tribes.md §2. See the header note. */
export const PEOPLES = [
  {
    id: 'agacephs', name: 'Agacephs', faction: 'agacephs', region: 'deep-marshes',
    names: ['Agaceph'],
    axes: { diet: 'nothing-chased', hist: 'live-under-it-no-well', empire: 'no-dealings-no-hostility', lukiul: 'pity', refuses: 'give-a-direction' },
  },
  {
    id: 'paatru', name: 'Paatru', faction: 'paatru', region: 'clay-moor',
    names: ['Paatru'],
    axes: { diet: 'clay-buried-eggs', hist: 'in-a-pit-descend-on-a-rope', empire: 'never-met-one', lukiul: 'not-enemies-dead', refuses: 'cross-another-bridge' },
  },
  {
    id: 'sarpa', name: 'Sarpa', faction: 'sarpa', region: 'stone-forest',
    names: ['Sarpa'],
    axes: { diet: 'carrion-and-taken-eggs', hist: 'a-stump-the-true-tree-is-overhead', empire: 'weigh-the-coin-and-drop-it', lukiul: 'cannot-see-the-difference', refuses: 'land-uninvited' },
  },
  {
    id: 'archein', name: 'Archein', faction: 'archein', region: 'blackwood',
    names: ['Archein'],
    axes: { diet: 'imperial-food-in-courses', hist: 'walled-and-decanted-into-a-cup', empire: 'are-its-rural-governance', lukiul: 'invented-the-category', refuses: 'deal-at-the-quay' },
  },
  {
    id: 'miredancers', name: 'Miredancers', faction: 'miredancers', region: 'eastern-rootlands',
    names: ['Miredancer', 'Gee-Rusleel'],
    axes: { diet: 'feed-anyone-at-length', hist: 'a-named-office-that-descends', empire: 'cordial-and-unhelpful', lukiul: 'a-name-is-a-thing-you-are-between', refuses: 'stop-the-speaker-drinking' },
  },
  {
    id: 'dead-water', name: 'Dead-Water', faction: 'dead-water', region: 'thornmarsh',
    names: ['Dead-Water', 'Naga-Kur'],
    axes: { diet: 'what-they-take', hist: 'keep-none-visit-the-nearest', empire: 'close-the-tracks', lukiul: 'no-opinion-at-all', refuses: 'leave-a-body' },
  },
];

const AXES = ['diet', 'hist', 'empire', 'lukiul', 'refuses'];
const COLLISION_BAR = 3;          // RI-LOR08 comparison method check 2
const REFUSAL_TOPIC = 'what-we-will-not-do';

// ---------------------------------------------------------------- the build
export function loadBuild(over = {}) {
  const npcs = [];
  const npcDir = path.join(ROOT, 'game/data/npcs');
  for (const f of fs.readdirSync(npcDir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(npcDir, f), 'utf8'));
    for (const n of (d.npcs || [])) npcs.push(n);
  }
  const infos = [];
  const topicDir = path.join(ROOT, 'game/data/dialogue/topics');
  for (const f of fs.readdirSync(topicDir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(topicDir, f), 'utf8'));
    for (const t of (d.topics || [])) for (const i of (t.infos || [])) infos.push({ topic: t.id, ...i });
  }
  const books = [];
  const bookDir = path.join(ROOT, 'game/data/books');
  for (const f of fs.readdirSync(bookDir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(bookDir, f), 'utf8'));
    for (const b of (Array.isArray(d.books) ? d.books : [])) books.push(b);
  }
  const canon = rd('game/data/lore/canon.json');
  return { npcs, infos, books, canon, ...over };
}

/** Fold an id the province spells two ways — same rule as game/src/world/canon.js#fold. */
const fold = (s) => (s ? String(s).toLowerCase().replace(/^the[_\s-]+/, '').replace(/[_\s-]+/g, '-') : null);

export function census(build, peoples = PEOPLES) {
  const rows = [];
  const actorsOf = new Map();
  for (const n of build.npcs) {
    const f = fold(n.faction);
    if (!f) continue;
    if (!actorsOf.has(f)) actorsOf.set(f, new Set());
    if (n.actor) actorsOf.get(f).add(n.actor);
  }

  for (const p of peoples) {
    const key = fold(p.faction);
    const npcs = build.npcs.filter((n) => fold(n.faction) === key);
    const actors = actorsOf.get(key) || new Set();
    const infos = build.infos.filter((i) => i.a && actors.has(i.a));
    const re = new RegExp(`\\b(${p.names.map((s) => s.replace(/[-]/g, '[- ]')).join('|')})s?\\b`, 'i');
    const books = build.books.filter((b) => re.test(b.text || '') || re.test(b.title || '') || re.test(b.unreliability || ''));
    // A stance the SHIPPED register credits this people with, matched the way the engine matches it.
    const held = [];
    for (const f of (build.canon.facts || [])) {
      if (!f.disputed) continue;
      for (const pos of (f.positions || [])) {
        const fx = (pos.holders && pos.holders.factions) || [];
        if (fx.some((x) => fold(x) === key)) held.push(`${f.id}/${pos.id}`);
      }
    }
    const refusal = infos.filter((i) => i.topic === REFUSAL_TOPIC);
    rows.push({ ...p, npcs: npcs.length, actors: [...actors], infos: infos.length, books: books.map((b) => b.id), held, refusal: refusal.length });
  }

  // check 2 — pairwise axis collisions
  const collisions = [];
  for (let i = 0; i < peoples.length; i++) {
    for (let j = i + 1; j < peoples.length; j++) {
      const shared = AXES.filter((a) => peoples[i].axes[a] === peoples[j].axes[a]);
      if (shared.length >= COLLISION_BAR) collisions.push({ a: peoples[i].id, b: peoples[j].id, on: shared });
    }
  }

  const failures = [];
  for (const r of rows) {
    if (!r.npcs) failures.push(`${r.name}: no NPC in this build carries faction \`${r.faction}\` — the people has no body.`);
    if (!r.infos) failures.push(`${r.name}: no dialogue info is written for any of its actors — the people has no mouth.`);
    if (!r.books.length) failures.push(`${r.name}: no shipped book names it — the people has no text.`);
    if (!r.held.length) failures.push(`${r.name}: holds no position in any registered dispute — its view is a paragraph, not a game object.`);
    if (!r.refusal) failures.push(`${r.name}: nothing it will not do is spoken on \`${REFUSAL_TOPIC}\` — RI-LOR08 §2, a people with no refusal has been described and not differentiated.`);
  }
  for (const c of collisions) failures.push(`${c.a} and ${c.b} answer the same on ${c.on.length} axes (${c.on.join(', ')}) — one of them is decoration.`);

  return { rows, collisions, failures };
}

// ---------------------------------------------------------------- self-test
function selfTest() {
  let ok = 0, bad = 0;
  const t = (cond, what) => { if (cond) { ok++; } else { bad++; console.error(`  FAIL ${what}`); } };
  const build = loadBuild();

  t(census(build).failures.length === 0, 'the shipped build passes');

  // Each check broken on purpose, one at a time.
  const noBody = { ...build, npcs: build.npcs.filter((n) => fold(n.faction) !== 'sarpa') };
  t(census(noBody).failures.some((f) => /Sarpa: no NPC/.test(f)), 'PRESENCE/body goes red when a people has no NPC');

  const noMouth = { ...build, infos: build.infos.filter((i) => i.a !== 'paatru-clay' && i.a !== 'paatru-edge') };
  t(census(noMouth).failures.some((f) => /Paatru: no dialogue info/.test(f)), 'PRESENCE/mouth goes red when a people has no info');

  const noText = { ...build, books: [] };
  t(census(noText).failures.filter((f) => /no shipped book names it/.test(f)).length === PEOPLES.length,
    'PRESENCE/text goes red for every people when the books go away');

  const noStance = { ...build, canon: { facts: (build.canon.facts || []).map((f) => ({ ...f, positions: (f.positions || []).map((p) => ({ ...p, holders: { ...(p.holders || {}), factions: [] } })) })) } };
  t(census(noStance).failures.filter((f) => /holds no position/.test(f)).length === PEOPLES.length,
    'POSITION goes red when the register credits no people with a stance');

  const noRefusal = { ...build, infos: build.infos.filter((i) => i.topic !== REFUSAL_TOPIC) };
  t(census(noRefusal).failures.filter((f) => /nothing it will not do/.test(f)).length === PEOPLES.length,
    'REFUSAL goes red when the refusal topic is emptied');

  // A seventh people copied off a sixth — the "six hats" failure, which is the one taste passes.
  const hat = PEOPLES.concat([{ ...PEOPLES[0], id: 'copycat', name: 'Copycat', faction: 'agacephs' }]);
  const c = census(build, hat);
  t(c.collisions.some((x) => x.b === 'copycat' && x.on.length === 5), 'DIFFERENTIATION goes red on a people copied off another');

  // …and the arithmetic is not one-sided: changing three of five is still a collision, four is not.
  const near = [PEOPLES[0], { ...PEOPLES[1], axes: { ...PEOPLES[1].axes, diet: PEOPLES[0].axes.diet, hist: PEOPLES[0].axes.hist, empire: PEOPLES[0].axes.empire } }];
  t(census(build, near).collisions.length === 1, 'DIFFERENTIATION goes red at exactly three shared axes');
  const far = [PEOPLES[0], { ...PEOPLES[1], axes: { ...PEOPLES[1].axes, diet: PEOPLES[0].axes.diet, hist: PEOPLES[0].axes.hist } }];
  t(census(build, far).collisions.length === 0, 'DIFFERENTIATION stays quiet at two shared axes');

  console.log(`\nTRIBE CENSUS SELF-TEST: ${bad ? 'FAIL' : 'PASS'} (${ok}/${ok + bad})`);
  return bad ? 1 : 0;
}

// ---------------------------------------------------------------- main
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const verbose = argv.includes('--verbose');
  const build = loadBuild();
  const { rows, collisions, failures } = census(build);

  console.log(`registry : game/data/lore/canon.json (${(build.canon.facts || []).length} facts)`);
  console.log(`build    : ${build.npcs.length} npcs, ${build.infos.length} dialogue infos, ${build.books.length} books\n`);
  console.log('PRESENCE  a people needs a body, a mouth, a text, a registered position and a refusal.');
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of rows) {
    const bad = !r.npcs || !r.infos || !r.books.length || !r.held.length || !r.refusal;
    console.log(`  ${bad ? 'FAIL' : ' ok '}  ${pad(r.name, 12)} ${pad(r.region, 18)} npc ${pad(r.npcs, 2)} info ${pad(r.infos, 3)} book ${pad(r.books.length, 2)} pos ${pad(r.held.length, 2)} refusal ${r.refusal}`);
    if (verbose) {
      console.log(`          actors: ${r.actors.join(', ') || '(none)'}`);
      console.log(`          books : ${r.books.join(', ') || '(none)'}`);
      console.log(`          holds : ${r.held.join(', ') || '(none)'}`);
      for (const a of AXES) console.log(`          ${pad(a, 8)} ${r.axes[a]}`);
    }
  }
  console.log(`\nDIFFER    no two peoples may answer the same on ${COLLISION_BAR} or more of the five axes.`);
  if (!collisions.length) console.log(`   ok   ${rows.length} peoples, ${(rows.length * (rows.length - 1)) / 2} pairs, worst overlap ${worstOverlap(rows)} of ${AXES.length}`);
  for (const c of collisions) console.log(`  FAIL  ${c.a} / ${c.b}: ${c.on.join(', ')}`);

  if (failures.length) {
    console.log(`\nTRIBE CENSUS: FAIL — ${failures.length} problem(s)`);
    for (const f of failures) console.log(`  - ${f}`);
    return 1;
  }
  console.log('\nTRIBE CENSUS: PASS');
  return 0;
}

function worstOverlap(rows) {
  let w = 0;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    w = Math.max(w, AXES.filter((a) => rows[i].axes[a] === rows[j].axes[a]).length);
  }
  return w;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
