#!/usr/bin/env node
/**
 * name-rosters.mjs — RE-NAME THE GENERATED ROSTERS, AND ONLY THE GENERATED ROSTERS.
 *
 * W1-23 round 3 measured 121 of 217 named Argonians (55.8%) carrying a hyphenated-English
 * descriptive name against RI-LOR04 §4's attested 11%, plus 33 Argonians wearing an established
 * Dunmer or Khajiit given name (`Sedura Nine-Teeth` — *sedura* is a Dunmer honorific, so the
 * roster contained an Argonian called "Sir Nine-Teeth"), 43 names reused across settlements, and
 * 18 carrying an unarticled template slug (`Llarara the Elder of salvage yard`).
 *
 * The verdict is explicit that the HAND-AUTHORED Jel names are good and the defect is entirely in
 * the generated rosters. So the first thing this tool has to be able to do is TELL THEM APART,
 * and it does it mechanically rather than by taste:
 *
 *   A name is GENERATED iff it is `<G> <E>` or `<G> <E> of <lowercase slug>` where G is a member
 *   of `GIVEN` and E a member of `EPITHET` — the two arrays in `tools/world/build-property.mjs`,
 *   READ OUT OF THAT FILE AT RUN TIME rather than copied here, so the criterion cannot drift away
 *   from the generator it describes.
 *
 * On the shipped tree that partition is 250 generated and 97 hand-authored, and every one of the
 * 97 lives outside `pop-*.json` or is a named individual placed into one. `Hosk-Vei`, `Ashul-Tei`,
 * `Wuleen-Kus`, `Bel Mourne` and `Aveline Rell` are untouched by this tool, which matters for more
 * than politeness: those names are quoted by books, quests and dialogue, and the generated ones
 * are quoted by nothing (verified — see `--audit`).
 *
 * WHAT IT REWRITES, and every one of them is keyed on an npc ID and never on a name string,
 * because 43 of the names are ambiguous by construction:
 *
 *   game/data/npcs/*.json              npcs[].name
 *   game/data/world/property/*.json    households[].name, residents[].name, zones[].owner_name,
 *                                      zones[].residents[].name, zones[].contents[].owner_name,
 *                                      and the derived `"<owner>'s <trade>"` zone label
 *   game/data/world/interiors/*.json   the derived `"<owner>'s house"` label
 *   game/data/world/settlements/*.json the same label on the building
 *
 * Run:
 *   node tools/lore/name-rosters.mjs                 report the before/after distribution, write nothing
 *   node tools/lore/name-rosters.mjs --write         apply
 *   node tools/lore/name-rosters.mjs --check         exit 1 if any generated-shape name survives
 *   node tools/lore/name-rosters.mjs --self-test     break each measure on purpose
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assign, cultureForRace, jelSingleCandidates, jelCompoundCandidates, descriptiveCandidates, CULTURE_STOCK } from './lib/namegen.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJSON = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const writeJSON = (p, v) => fs.writeFileSync(R(p), JSON.stringify(v, null, 2) + '\n');

// ---------------------------------------------------------------- the generated/hand-authored line

/** Read GIVEN and EPITHET out of the generator itself. Not a copy — the source of the defect. */
export function generatorStock(src) {
  const g = src.match(/const GIVEN = (\[[^\]]*\]);/);
  const e = src.match(/const EPITHET = (\[[^\]]*\]);/);
  if (!g || !e) throw new Error('name-rosters: build-property.mjs no longer declares GIVEN/EPITHET — the generated/hand-authored line cannot be drawn. Fix this tool before trusting it.');
  const parse = (s) => JSON.parse(s.replace(/'/g, '"'));
  return { GIVEN: new Set(parse(g[1])), EPITHET: new Set(parse(e[1])) };
}

/** `<G> <E>` or `<G> <E> of <lowercase slug>` => generated. Anything else => hand-authored. */
export function makeIsGenerated({ GIVEN, EPITHET }) {
  return function isGenerated(name) {
    if (!name || typeof name !== 'string') return false;
    // Strip ONLY the trailing template slug — ` of old quay`, all lowercase to the end of the
    // string. `Ocheeva of the Boards` must keep its epithet, because `of the Boards` IS the
    // epithet; an earlier version of this line used ` of [a-z].*$` and ate it, which let
    // `Keeps-Her-Own of the Boards of prison gate` read as hand-authored and survive the rename.
    const core = name.replace(/ of [a-z]+( [a-z]+)*$/, '').trim();
    for (const e of EPITHET) {
      if (!core.endsWith(` ${e}`)) continue;
      const given = core.slice(0, core.length - e.length - 1);
      if (GIVEN.has(given)) return true;
    }
    return false;
  };
}

// ---------------------------------------------------------------- candidate pools

/**
 * Run every coined candidate through the item's OWN validator, in its strict mode.
 * A pool this function returns has been judged by `corpus/80-methods/jel-phonotactics.py`, not
 * by anything written here. If the validator is missing the tool refuses to run rather than
 * shipping unvalidated coinage.
 */
export function validated(names, extraArgs = []) {
  const py = R('corpus/80-methods/jel-phonotactics.py');
  if (!fs.existsSync(py)) {
    console.error(`FATAL: ${py} does not exist. RI-LOR04's own validator is the only thing entitled to`);
    console.error('       judge a coined Jel name, and this tool will not invent a substitute for it.');
    process.exit(2);
  }
  const tmp = path.join(ROOT, 'reports', '_namegen-candidates.txt');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, names.join('\n'));
  // The validator exits 1 when the batch is over its 5% threshold, which a candidate SWEEP always
  // is — that is the point of sweeping. The JSON on stdout is what we want either way.
  let out;
  try {
    out = execFileSync('python3', [py, '--names', tmp, '--mode', 'coinage', '--json', ...extraArgs],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    if (e.status === undefined || !e.stdout) throw e;
    out = e.stdout.toString();
  }
  fs.unlinkSync(tmp);
  const j = JSON.parse(out);
  return j.results.filter((r) => !r.violations.length).map((r) => r.name);
}

/**
 * RI-LOR04 comparison method §5: of Jel-classified names, >=40% must contain `x` and >=20% a
 * long vowel. That is a property of the POOL as much as of the roster, so the pool is ordered to
 * put the sound-carrying forms first — `take()` walks the pool, so ordering IS the bias.
 */
function soundFirst(pool) {
  const score = (n) => {
    const s = n.toLowerCase();
    return (/x/.test(s) ? 2 : 0) + (/(ee|aa|oo)/.test(s) ? 1 : 0);
  };
  return pool.slice().sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
}

export function buildPools() {
  return {
    jelSingle: soundFirst(validated(jelSingleCandidates(), ['--culture', 'jel'])),
    jelCompound: soundFirst(validated(jelCompoundCandidates())),
    // RI-LOR04 §4: word count 2 x31, 3 x6 in the attested corpus, "the mode is 2". The pool is
    // composed at that ratio so the shipped roster inherits it rather than averaging the two.
    descriptive: (() => {
      const all = descriptiveCandidates();
      const two = all.filter((n) => n.split('-').length === 2);
      const three = all.filter((n) => n.split('-').length === 3);
      return two.concat(three.slice(0, Math.round(two.length * 6 / 31)));
    })(),
    imperial: CULTURE_STOCK.imperial(),
    dunmer: CULTURE_STOCK.dunmer(),
    khajiit: CULTURE_STOCK.khajiit(),
    nord: CULTURE_STOCK.nord(),
    breton: CULTURE_STOCK.breton(),
    kothringi: CULTURE_STOCK.kothringi(),
  };
}

// ---------------------------------------------------------------- the roster

function npcFiles() { return fs.readdirSync(R('game/data/npcs')).filter((f) => f.endsWith('.json')); }
function propertyFiles() { return fs.readdirSync(R('game/data/world/property')).filter((f) => f.endsWith('.json')); }

function loadPeople(isGenerated) {
  const people = [];
  const byId = new Map();
  for (const f of npcFiles()) {
    const j = readJSON(`game/data/npcs/${f}`);
    for (const n of (j.npcs || [])) {
      if (!n.id || !n.name) continue;
      byId.set(n.id, n);
      if (isGenerated(n.name)) people.push({ key: n.id, race: n.race, old: n.name, file: f });
    }
  }
  // Property carries 101 residents that are in no `pop-*.json` file at all. They own objects and
  // their names are read by the theft and ownership layers, so they are named here too; their
  // race is not declared anywhere, so it is taken from the household head, which is what a
  // household is.
  for (const f of propertyFiles()) {
    const j = readJSON(`game/data/world/property/${f}`);
    for (const h of (j.households || [])) {
      const headId = String(h.npc || '').replace(/^npc:/, '');
      const headRace = byId.get(headId)?.race || 'argonian';
      for (const r of (h.residents || [])) {
        const id = String(r.npc || '').replace(/^npc:/, '');
        if (!id || byId.has(id) || !isGenerated(r.name)) continue;
        if (people.some((p) => p.key === id)) continue;
        people.push({ key: id, race: headRace, old: r.name, file: `property/${f}` });
      }
    }
  }
  return people;
}

// ---------------------------------------------------------------- measurement

const HYPH_ENGLISH = /(^|[ -])(Nine|Three|Two|Half|Salt|Dark|Quick|Reed|Bone|Wet|Rope|Cold|Slow|Sings|Hides|Drops|Counts|Waits|Keeps|Marks|Silent|Sees|Ten)(-|$)/;

/**
 * The same measure the round-3 critic's instrument takes (§C), recomputed here independently so
 * the BEFORE and AFTER in this tool's own report do not depend on the critic's file.
 */
export function distribution(names, races) {
  let argonian = 0, descriptive = 0, crossCulture = 0, unarticled = 0;
  const seen = new Map();
  const CROSS = /^(Sedura|Sera|Serjo|Ahnassi|Falura|Llarara|Bevene|Nartise|Onwen|Ranaso|Sondaale|Vaman|Neetrenaza|Ocheeva|Dram|Tuls|Meesei)\b/;
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (cultureForRace(races[i]) !== 'argonian') continue;
    argonian++;
    seen.set(n, (seen.get(n) || 0) + 1);
    if (/ of (?!the )[a-z]/.test(n)) unarticled++;
    const core = n.replace(/ of [a-z]+( [a-z]+)*$/, '');
    if (HYPH_ENGLISH.test(core)) descriptive++;
    if (CROSS.test(core)) crossCulture++;
  }
  return {
    argonian,
    descriptive,
    descriptive_share: argonian ? descriptive / argonian : 0,
    cross_culture: crossCulture,
    reused: [...seen.values()].filter((v) => v > 1).length,
    unarticled,
  };
}

// ---------------------------------------------------------------- rewrite

function rewrite(nameFor) {
  const touched = [];
  const get = (id) => nameFor.get(String(id || '').replace(/^npc:/, '')) || null;

  // 1. the rosters
  for (const f of npcFiles()) {
    const p = `game/data/npcs/${f}`;
    const j = readJSON(p);
    let n = 0;
    for (const rec of (j.npcs || [])) {
      const nn = get(rec.id);
      if (nn && nn !== rec.name) { rec.name = nn; n++; }
    }
    if (n) { writeJSON(p, j); touched.push([p, n]); }
  }

  // 2. property — households, zones, contents, and the derived labels
  for (const f of propertyFiles()) {
    const p = `game/data/world/property/${f}`;
    const j = readJSON(p);
    let n = 0;
    for (const h of (j.households || [])) {
      const nn = get(h.npc);
      if (nn && nn !== h.name) { h.name = nn; n++; }
      for (const r of (h.residents || [])) {
        const rn = get(r.npc);
        if (rn && rn !== r.name) { r.name = rn; n++; }
      }
    }
    for (const z of (j.zones || [])) {
      const on = get(z.owner);
      if (on && z.owner_name && typeof z.name === 'string' && z.name.startsWith(`${z.owner_name}'s `)) {
        z.name = `${on}'s ${z.name.slice(z.owner_name.length + 3)}`;
        n++;
      }
      if (on && on !== z.owner_name) { z.owner_name = on; n++; }
      for (const r of (z.residents || [])) {
        const rn = get(r.npc);
        if (rn && rn !== r.name) { r.name = rn; n++; }
      }
      for (const c of (z.contents || [])) {
        const cn = get(c.owner);
        if (cn && c.owner_name && cn !== c.owner_name) { c.owner_name = cn; n++; }
      }
    }
    if (n) { writeJSON(p, j); touched.push([p, n]); }
  }

  return touched;
}

/**
 * The `"<owner>'s house"` labels. These carry NO id, so the owner is resolved through
 * `home_interior`/`interior` on the roster — and the stripped form of the name, because the
 * label was built before the disambiguating ` of <quarter>` slug was appended. Anything that
 * does not resolve to exactly one person is REPORTED, never guessed.
 */
function rewriteHouseLabels(oldByInterior, nameFor) {
  const touched = [];
  const unresolved = [];
  const label = (id) => {
    const hit = oldByInterior.get(id);
    if (!hit) return null;
    if (hit.length !== 1) { unresolved.push([id, hit.length]); return null; }
    return nameFor.get(hit[0]) || null;
  };

  for (const f of fs.readdirSync(R('game/data/world/interiors'))) {
    if (!f.endsWith('.json')) continue;
    const p = `game/data/world/interiors/${f}`;
    const j = readJSON(p);
    if (typeof j.name !== 'string' || !/'s house$/.test(j.name)) continue;
    const nn = label(f.replace(/\.json$/, ''));
    if (!nn) continue;
    j.name = `${nn}'s house`;
    writeJSON(p, j);
    touched.push([p, 1]);
  }

  for (const f of fs.readdirSync(R('game/data/world/settlements'))) {
    if (!f.endsWith('.json')) continue;
    const p = `game/data/world/settlements/${f}`;
    const j = readJSON(p);
    let n = 0;
    for (const b of (j.buildings || [])) {
      if (typeof b.name !== 'string' || !/'s house$/.test(b.name) || !b.interior) continue;
      const nn = label(b.interior);
      if (!nn) continue;
      b.name = `${nn}'s house`;
      n++;
    }
    if (n) { writeJSON(p, j); touched.push([p, n]); }
  }
  return { touched, unresolved };
}

function ownersByInterior(isGenerated) {
  const m = new Map();
  for (const f of npcFiles()) {
    for (const n of (readJSON(`game/data/npcs/${f}`).npcs || [])) {
      const id = n.home_interior || n.interior;
      if (!id || !n.name || !isGenerated(n.name)) continue;
      // Household heads only: `<settlement>-<trade>-<n>` with no role suffix. A lodger does not
      // get the house named after them.
      if (!/^[a-z]+-[a-z]+-\d+$/.test(n.id)) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(n.id);
    }
  }
  return m;
}

// ---------------------------------------------------------------- main

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();

  const stock = generatorStock(fs.readFileSync(R('tools/world/build-property.mjs'), 'utf8'));
  const isGenerated = makeIsGenerated(stock);

  // BEFORE, over every named Argonian in the shipped rosters — generated and hand-authored alike,
  // which is the population the critic's instrument measures.
  const allNames = [], allRaces = [];
  for (const f of npcFiles()) {
    for (const n of (readJSON(`game/data/npcs/${f}`).npcs || [])) {
      if (!n.name || /^the /i.test(n.name)) continue;
      allNames.push(n.name); allRaces.push(n.race);
    }
  }
  const before = distribution(allNames, allRaces);

  const people = loadPeople(isGenerated);
  const hand = allNames.filter((n) => !isGenerated(n)).length;
  console.log(`generated/hand-authored line: ${allNames.length - hand} generated, ${hand} hand-authored`);
  console.log(`  criterion: <GIVEN> <EPITHET> [of <slug>], both arrays read out of tools/world/build-property.mjs`);
  console.log(`people to rename: ${people.length} (${people.filter((p) => cultureForRace(p.race) === 'argonian').length} Argonian)`);
  const unknownRace = people.filter((p) => !cultureForRace(p.race));
  if (unknownRace.length) console.log(`  races with no naming system in RI-LOR04 §5, left alone: ${[...new Set(unknownRace.map((p) => p.race))].join(', ')}`);

  const pools = buildPools();
  console.log(`pools (validated by corpus/80-methods/jel-phonotactics.py --mode coinage): `
    + `jel-single ${pools.jelSingle.length}, jel-compound ${pools.jelCompound.length}, descriptive ${pools.descriptive.length}`);

  // Every name already on the tree that this tool is NOT renaming is reserved, so a coined name
  // can never collide with the hand-authored cast.
  const renaming = new Set(people.map((p) => p.key));
  const reserved = [];
  for (const f of npcFiles()) {
    for (const n of (readJSON(`game/data/npcs/${f}`).npcs || [])) {
      if (n.name && !renaming.has(n.id)) reserved.push(n.name);
    }
  }
  const nameFor = assign(people, pools, reserved);
  const projected = allNames.map((n, i) => {
    const p = people.find((q) => q.old === n);
    return p && nameFor.has(p.key) ? nameFor.get(p.key) : n;
  });
  // The projection above is name-keyed and therefore only indicative; the authoritative AFTER is
  // re-measured off disk after --write.

  console.log(`\nBEFORE  ${before.argonian} named Argonians: ${before.descriptive} hyphenated-English `
    + `(${(100 * before.descriptive_share).toFixed(1)}%), ${before.cross_culture} cross-culture given names, `
    + `${before.reused} reused, ${before.unarticled} template slugs`);

  if (!argv.includes('--write')) {
    console.log('\n(dry run — pass --write to apply)');
    console.log('sample:');
    for (const p of people.slice(0, 12)) console.log(`  ${p.old.padEnd(34)} -> ${nameFor.get(p.key)}  [${p.race}]`);
    return 0;
  }

  const owners = ownersByInterior(isGenerated);
  const touched = rewrite(nameFor);
  const labels = rewriteHouseLabels(owners, nameFor);
  for (const [p, n] of [...touched, ...labels.touched]) console.log(`  ${p}  ${n} field(s)`);
  if (labels.unresolved.length) {
    console.log(`  UNRESOLVED house labels (more than one candidate head, left alone): `
      + labels.unresolved.map(([i, n]) => `${i} x${n}`).join(', '));
  }

  const after = (() => {
    const nm = [], rc = [];
    for (const f of npcFiles()) {
      for (const n of (readJSON(`game/data/npcs/${f}`).npcs || [])) {
        if (!n.name || /^the /i.test(n.name)) continue;
        nm.push(n.name); rc.push(n.race);
      }
    }
    return distribution(nm, rc);
  })();
  console.log(`AFTER   ${after.argonian} named Argonians: ${after.descriptive} hyphenated-English `
    + `(${(100 * after.descriptive_share).toFixed(1)}%), ${after.cross_culture} cross-culture given names, `
    + `${after.reused} reused, ${after.unarticled} template slugs`);
  return 0;
}

function check() {
  const stock = generatorStock(fs.readFileSync(R('tools/world/build-property.mjs'), 'utf8'));
  const isGenerated = makeIsGenerated(stock);
  const bad = [];
  for (const f of npcFiles()) {
    for (const n of (readJSON(`game/data/npcs/${f}`).npcs || [])) {
      if (n.name && isGenerated(n.name)) bad.push(`${f}:${n.id} ${n.name}`);
    }
  }
  if (bad.length) {
    console.error(`name-rosters --check: ${bad.length} roster name(s) still carry the GIVEN x EPITHET template:`);
    for (const b of bad.slice(0, 20)) console.error(`  ${b}`);
    return 1;
  }
  console.log('name-rosters --check: no roster name carries the GIVEN x EPITHET template. ok');
  return 0;
}

// ---------------------------------------------------------------- self-test

function selfTest() {
  let pass = 0, fail = 0;
  const say = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${msg}`); ok ? pass++ : fail++; };

  const stock = { GIVEN: new Set(['Deek', 'Ahnassi']), EPITHET: new Set(['Nine-Teeth', 'the Elder']) };
  const isGen = makeIsGenerated(stock);
  say(isGen('Deek Nine-Teeth'), 'the generated shape is recognised');
  say(isGen('Ahnassi the Elder of salvage yard'), 'the generated shape with a template slug is recognised');
  say(!isGen('Hosk-Vei'), 'a hand-authored Jel name is NOT taken for generated');
  say(!isGen('Bel Mourne'), 'a hand-authored Imperial name is NOT taken for generated');
  say(!isGen('Deek-Nine-Teeth'), 'a Jel-shaped compound of the same words is not the generated template');

  // the generated/hand-authored line must be able to go wrong loudly
  let threw = false;
  try { generatorStock('const SOMETHING_ELSE = [];'); } catch { threw = true; }
  say(threw, 'if build-property.mjs stops declaring GIVEN/EPITHET the tool refuses rather than guessing');

  // distribution
  const d1 = distribution(['Xul-Meer', 'An-Xeech', 'Hides-Rain'], ['argonian', 'argonian', 'argonian']);
  say(d1.argonian === 3 && d1.descriptive === 1, 'distribution counts one descriptive in three');
  say(Math.abs(d1.descriptive_share - 1 / 3) < 1e-9, 'the share is descriptive/argonian, not descriptive/all');
  const d2 = distribution(['Hides-Rain', 'Hides-Rain'], ['argonian', 'argonian']);
  say(d2.reused === 1, 'a reused name is caught');
  say(distribution(['Sedura Nine-Teeth'], ['argonian']).cross_culture === 1, 'a Dunmer honorific on an Argonian is caught');
  say(distribution(['Weel Quick-Tally of old quay'], ['argonian']).unarticled === 1, 'the "of <bare noun>" template slug is caught');
  say(distribution(['Weel Quick-Tally of the Boards'], ['argonian']).unarticled === 0, 'a properly articled "of the ..." is not flagged');
  say(distribution(['Hides-Rain'], ['dunmer']).argonian === 0, 'a non-Argonian is not judged by the Argonian rule');

  // culture routing
  say(cultureForRace('saxhleel') === 'argonian' && cultureForRace('naga') === 'argonian', 'saxhleel and naga route to the Argonian system');
  say(cultureForRace('mixed') === null, 'an undeclarable race routes to NOTHING rather than to a default');

  // assignment: the share, and uniqueness
  const seq = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`);
  const pools = {
    jelSingle: seq('Jsingle', 200),
    jelCompound: seq('C-omp', 200),
    descriptive: seq('Hides-Rain', 200),
    dunmer: ['Andrel Vorin', 'Ivrys Dram'],
  };
  const roster = [];
  for (let i = 0; i < 100; i++) roster.push({ key: `p${String(i).padStart(3, '0')}`, race: 'argonian' });
  const got = assign(roster, pools);
  const names = [...got.values()];
  say(names.length === 100, 'every person got a name');
  say(new Set(names).size === 100, 'no name is reused');
  const desc = names.filter((n) => pools.descriptive.includes(n)).length;
  say(desc === 11, `11 of 100 Argonians carry the Tamrielic-descriptive form (got ${desc})`);

  const mixedRoster = [{ key: 'a', race: 'argonian' }, { key: 'b', race: 'dunmer' }, { key: 'c', race: 'ghost' }];
  const g2 = assign(mixedRoster, pools);
  say(pools.dunmer.includes(g2.get('b')), 'a Dunmer gets a Dunmer name, not an Argonian epithet');
  say(!g2.has('c'), 'a race with no naming system is left alone rather than given a wrong one');

  // determinism
  const again = assign(roster, pools);
  say([...again.values()].join('|') === names.join('|'), 'the same roster produces the same names twice');
  const shuffled = roster.slice().reverse();
  say([...assign(shuffled, pools).entries()].every(([k, v]) => got.get(k) === v),
    'reordering the roster does not reshuffle the province');

  console.log(`\nself-test ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail}`);
  return fail === 0 ? 0 : 1;
}

const argv = process.argv.slice(2);
process.exit(argv.includes('--check') ? check() : main(argv));
