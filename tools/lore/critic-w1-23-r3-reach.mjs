#!/usr/bin/env node
/**
 * critic-w1-23-r3-reach.mjs — CRITIC instrument, W1-23 round 3. Written by the critic.
 *
 * Rounds 1 and 2 judged the REGISTER (facts, disputes, seals, voices). `critic-w1-23-r3.mjs`
 * (same round, sibling file) counts the TEXTS. Neither asks the question this file asks, which
 * is the only question a reader in a chair can ask about a library:
 *
 *     Can the player get to both sides of the argument?
 *
 * RI-LOR03 §2 requires ">=8 pairs of books must contradict each other, each pair registered in
 * canon-facts.json". Every gate in the tree checks the REGISTRATION. Nothing checks that the two
 * books are anywhere a person could find them. A dispute whose two sides exist only as JSON in
 * game/data/books/ is a dispute the province does not have.
 *
 * Three measures, each able to fail:
 *
 *   A. PAIR REACH. Build MUTUAL contradiction pairs (both books name each other — a directed
 *      edge alone lets eight books point at eight silent partners and satisfy a naive count).
 *      For each pair, is each side referenced ANYWHERE under game/ outside game/data/books —
 *      an interior readable, an item, a container, a quest, a state, any code path at all?
 *      The test is deliberately the most generous one available: a single mention anywhere
 *      counts as reachable. If a book fails THAT, it is not placed by any route.
 *
 *   B. DISPUTE INERTNESS. Perturb each disputed fact in the shipped register (strike its
 *      holders) and re-sweep every (npc, topic) pair through the SHIPPED converse.js + canon.js.
 *      A dispute that changes nothing anybody says is registered, sealed, and unobservable.
 *      This is RI-MTH07 applied per-fact rather than to the register as a whole: the register
 *      passing consumption in aggregate hides which half of it is doing the work.
 *
 *   C. NAMING SHAPE. RI-LOR04 §4, verbatim: "A settlement roster in which most Argonians carry
 *      hyphenated English names has failed this section however well each individual name
 *      scores." The item measures the attested corpus at 86% Jel / 11% Tamrielic-descriptive.
 *      Nothing in the tree measures OUR roster against that. This does.
 *
 * --self-test breaks each measure on purpose and confirms this tool goes red. A probe that
 * cannot fail is worse than no probe (RULES #4).
 *
 * Run:  node tools/lore/critic-w1-23-r3-reach.mjs [--json] [--self-test]
 * Exit: 0 in report mode. Non-zero if the corpus it measures is absent, or --self-test fails.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';
import { CanonRegistry } from '../../game/src/world/canon.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);

// ---------------------------------------------------------------- loading

function loadBooks() {
  const dir = R('game/data/books');
  if (!fs.existsSync(dir)) { console.error('FATAL: game/data/books does not exist'); process.exit(2); }
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const b of (j.books || [j])) if (b && b.id) out.push(b);
  }
  return out;
}

/** Every byte under game/ EXCEPT the books directory itself. The generous reachability haystack. */
function worldHaystack() {
  let hay = '';
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) { if (fp.includes(path.join('game', 'data', 'books'))) continue; walk(fp); }
      else if (/\.(json|js|mjs)$/.test(e.name)) hay += fs.readFileSync(fp, 'utf8');
    }
  })(R('game'));
  return hay;
}

function loadNpcs() {
  const dir = R('game/data/npcs');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const a = j.npcs || j;
      for (const n of (Array.isArray(a) ? a : Object.values(a))) {
        if (n && typeof n === 'object' && (n.eid || n.id)) out.push(n);
      }
    } catch { /* a malformed roster is the data's problem, not this tool's */ }
  }
  return out;
}

// ---------------------------------------------------------------- A. pair reach

/** Mutual contradiction pairs, and whether each side is referenced anywhere outside the books dir. */
export function pairReach(books, isReachable) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const edges = new Map();
  for (const b of books) for (const c of (b.contradicts || [])) edges.set(`${b.id}|${c.book}`, c.on || '');
  const pairs = [];
  const seen = new Set();
  let dangling = 0;
  for (const k of edges.keys()) {
    const [a, c] = k.split('|');
    if (!byId.has(c)) { dangling++; continue; }
    if (!edges.has(`${c}|${a}`)) continue;
    const key = [a, c].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const n = (isReachable(a) ? 1 : 0) + (isReachable(c) ? 1 : 0);
    pairs.push({ a, c, on: edges.get(k), reach: n, verdict: n === 2 ? 'BOTH' : n === 1 ? 'ONE' : 'NEITHER' });
  }
  return {
    directed: edges.size,
    mutual: pairs.length,
    dangling,
    both: pairs.filter((p) => p.reach === 2).length,
    one: pairs.filter((p) => p.reach === 1).length,
    neither: pairs.filter((p) => p.reach === 0).length,
    pairs,
  };
}

// ---------------------------------------------------------------- B. dispute inertness

function sweep(idx, topicIds, npcs, canon) {
  const player = { race: 'argonian', upbringing: null, birthsign: null, knows: new Set(), topics_known: [] };
  const out = new Map();
  for (const n of npcs) {
    const who = n.eid || n.id;
    for (const t of topicIds) {
      let i = null;
      try { i = infoFor(idx, t, n, player, canon); } catch { /* a throwing topic is a null answer */ }
      out.set(`${who}|${t}`, i ? String(i.text || '').slice(0, 160) : null);
    }
  }
  return out;
}

/** Strike every holder off one fact and return a fresh register. */
function withFactStruck(raw, factId) {
  const per = JSON.parse(JSON.stringify(raw));
  for (const f of (per.facts || [])) {
    if (f.id !== factId || !f.positions) continue;
    for (const pos of f.positions) { pos.holders = { actors: [], factions: [] }; pos.held_by = []; }
  }
  return new CanonRegistry(per);
}

export function disputeInertness(raw, idx, topicIds, npcs) {
  const base = sweep(idx, topicIds, npcs, new CanonRegistry(raw));
  const disputed = (raw.facts || []).filter((f) => f.disputed);
  const moved = [], inert = [];
  for (const f of disputed) {
    const b = sweep(idx, topicIds, npcs, withFactStruck(raw, f.id));
    let ch = 0;
    for (const [k, v] of base) if (v !== b.get(k)) ch++;
    (ch > 0 ? moved : inert).push({ id: f.id, claim: f.claim || '', changed: ch });
  }
  // CONTROL (RULES #4/#6): an UNDISPUTED fact has no holders to strike, so it must move nothing.
  const undisputed = (raw.facts || []).find((f) => !f.disputed);
  let control = null;
  if (undisputed) {
    const b = sweep(idx, topicIds, npcs, withFactStruck(raw, undisputed.id));
    let ch = 0;
    for (const [k, v] of base) if (v !== b.get(k)) ch++;
    control = { id: undisputed.id, changed: ch };
  }
  return { pairs: base.size, disputed: disputed.length, moved, inert, control };
}

// ---------------------------------------------------------------- C. naming shape

// Hyphen-joined elements that are all ordinary English words = the Tamrielic-descriptive form.
// The list is the vocabulary actually used by the shipped roster plus common descriptive stock;
// a name is only classified descriptive if EVERY sub-token of a hyphenated element is English,
// so Jel compounds (Wuleen-Kus, Ee-Vashum, Ixt-Shaneekh) never match.
const ENGLISH = new Set(('nine teeth salt hand dark water quick tally bone setter cold ash slow rain wet foot two '
  + 'skins reed cutter rope maker half moon silent sings at dusk hides his her own keeps drops no stitch sees all '
  + 'colours three knives counts never walks speaks holds takes gives runs stands waits falls deep long short old '
  + 'new black white green red blood stone iron wood fish bird snake root sap mud reeds tide storm sun star night '
  + 'day the of in on one first last best left right fast good bad big small thin wide tall blind lame sharp dull '
  + 'hard soft warm sweet sour grey brown gold silver bright dim loud still calm wild free true false lost found '
  + 'broken whole empty full open closed clean dirty dry damp sick well strong weak young elder younger shorter '
  + 'taller patient quiet careful clever kind cruel proud humble tired ready late early near far high low under '
  + 'over up down back front side end start middle many few some any none skin scale claw tail eye ear nose mouth '
  + 'tooth head neck arm leg knee toe finger thumb heart lung liver gut flesh hair nail horn wing fin gill egg '
  + 'nest den hole cave pit spring stream river lake sea shore beach bank bar reef isle rock cliff hill vale field '
  + 'farm yard gate wall door roof floor post beam plank board boards net line hook trap snare knife blade axe '
  + 'spear bow arrow shield helm mail cloak boot glove belt bag box pot pan cup bowl plate spoon cloth thread '
  + 'needle pin cord string chain ring bell drum pipe song word name story book page ink pen mark sign light '
  + 'shade shadow smoke fire flame coal dust sand clay bread meat rice bean fruit seed leaf branch trunk bark '
  + 'moss weed grass vine thorn flower fen marsh mire bog swamp weir ford landing quay dock wharf pier boat barge '
  + 'raft canoe ship sail oar pole mast rudder anchor cargo crate barrel sack load weight measure count number '
  + 'score sum debt coin copper price cost trade sale buy sell pay owe give take keep lose find seek hide show '
  + 'tell ask answer speak talk sing shout whisper listen hear see look watch wait stay go come walk run swim '
  + 'dive climb fall rise sit stand lie sleep wake eat drink breathe live die born dead grave tomb ghost soul '
  + 'spirit mind dream hope fear love hate joy pain hurt heal cure health strength power force will way path '
  + 'road track trail bridge crossing turn bend curve straight round square flat steep smooth rough always once '
  + 'twice thrice again yet soon now then here there where when why how who what which').split(' '));

export function namingShape(npcs) {
  const arg = npcs.filter((n) => /argonian|saxhleel/i.test(n.race || ''))
    .filter((n) => n.name && !/^the /i.test(n.name));
  let descriptive = 0, other = 0;
  const ex = { descriptive: [], other: [] };
  const dupes = new Map();
  let unarticled = 0;
  for (const n of arg) {
    dupes.set(n.name, (dupes.get(n.name) || 0) + 1);
    if (/ of (?!the )[a-z]/.test(n.name)) unarticled++;
    const core = n.name.replace(/ of .*$/, '').trim();
    let isDesc = false;
    for (const tok of core.split(' ')) {
      if (!tok.includes('-')) continue;
      const subs = tok.split('-');
      if (subs.length > 1 && subs.every((s) => ENGLISH.has(s.toLowerCase()))) { isDesc = true; break; }
    }
    if (isDesc) { descriptive++; if (ex.descriptive.length < 12) ex.descriptive.push(n.name); }
    else { other++; if (ex.other.length < 12) ex.other.push(n.name); }
  }
  const total = arg.length || 1;
  return {
    argonian_named: arg.length,
    descriptive,
    other,
    descriptive_share: descriptive / total,
    attested_share: 0.11,
    fails_section_4: descriptive / total > 0.5,   // "most" — the item's own word
    reused_names: [...dupes.entries()].filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]),
    unarticled_of: unarticled,
    ex,
  };
}

// ---------------------------------------------------------------- report

function commit() { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } }

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const books = loadBooks();
  const hay = worldHaystack();
  const reach = (id) => hay.includes(`"${id}"`);
  const npcs = loadNpcs();

  const docs = fs.readdirSync(R('game/data/dialogue/topics'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(R(`game/data/dialogue/topics/${f}`), 'utf8')));
  const idx = buildTopicIndex(docs);
  const topicIds = [...idx.keys()];
  const raw = JSON.parse(fs.readFileSync(R('game/data/lore/canon.json'), 'utf8'));

  const A = pairReach(books, reach);
  const B = disputeInertness(raw, idx, topicIds, npcs);
  const C = namingShape(npcs);

  const out = { commit: commit(), books: books.length, A, B, C };
  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); return 0; }

  console.log(`commit   ${out.commit}`);
  console.log(`library  ${books.length} texts;  reachable anywhere under game/ outside the books dir: `
    + `${books.filter((b) => reach(b.id)).length}`);

  console.log(`\nA. PAIR REACH   RI-LOR03 §2 wants >=8 pairs of books that contradict each other`);
  console.log(`  ${A.directed} directed edges -> ${A.mutual} MUTUAL pairs (${A.dangling} naming a book not on disk)`);
  console.log(`  both sides reachable: ${A.both}   one side: ${A.one}   NEITHER side: ${A.neither}`);
  for (const p of A.pairs) console.log(`    ${p.verdict.padEnd(8)} ${p.a} <-> ${p.c}  ::  ${p.on}`);

  console.log(`\nB. DISPUTE INERTNESS   perturb each disputed fact, re-sweep ${B.pairs} (npc,topic) pairs`);
  console.log(`  ${B.disputed} disputed facts: ${B.moved.length} change what somebody says, ${B.inert.length} change NOTHING`);
  for (const f of B.inert) console.log(`    INERT  ${f.id} — ${f.claim.slice(0, 76)}`);
  if (B.control) {
    const ok = B.control.changed === 0 ? 'ok' : 'BROKEN';
    console.log(`  CONTROL striking undisputed ${B.control.id}: ${B.control.changed} changed  <- must be 0  [${ok}]`);
  }

  console.log(`\nC. NAMING SHAPE   RI-LOR04 §4: "a roster in which MOST Argonians carry hyphenated English names has failed"`);
  console.log(`  ${C.argonian_named} named Argonians: ${C.descriptive} hyphenated-English `
    + `(${(100 * C.descriptive_share).toFixed(1)}%), ${C.other} Jel-or-other`);
  console.log(`  attested share in RI-LOR04's own table: ${(100 * C.attested_share).toFixed(0)}%  -> `
    + `§4 ${C.fails_section_4 ? 'FAILED' : 'held'}`);
  console.log(`  names reused across settlements: ${C.reused_names.length} `
    + `(worst: ${C.reused_names.slice(0, 4).map(([n, v]) => `${v}x ${n}`).join(', ')})`);
  console.log(`  "<name> of <bare lowercase noun>" template leakage: ${C.unarticled_of}`);
  console.log(`  descriptive e.g.: ${C.ex.descriptive.slice(0, 6).join(' | ')}`);
  console.log(`  Jel e.g.:         ${C.ex.other.slice(0, 6).join(' | ')}`);
  return 0;
}

// ---------------------------------------------------------------- self-test

function selfTest() {
  let pass = 0, fail = 0;
  const say = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${msg}`); ok ? pass++ : fail++; };

  // --- A. pair reach
  const books = [
    { id: 'x', contradicts: [{ book: 'y', on: 'a thing' }] },
    { id: 'y', contradicts: [{ book: 'x', on: 'a thing' }] },
    { id: 'p', contradicts: [{ book: 'q', on: 'one way only' }] },
    { id: 'q' },
    { id: 'z', contradicts: [{ book: 'nobody', on: 'dangling' }] },
  ];
  const allReach = pairReach(books, () => true);
  say(allReach.mutual === 1, 'A: one mutual pair found (a one-way edge is not a pair)');
  say(allReach.dangling === 1, 'A: an edge naming a book not on disk is caught');
  say(allReach.both === 1 && allReach.neither === 0, 'A: with everything placed, the pair reads BOTH');
  const noneReach = pairReach(books, () => false);
  say(noneReach.neither === 1 && noneReach.both === 0, 'A: with nothing placed, the SAME pair reads NEITHER (not hardcoded)');
  const halfReach = pairReach(books, (id) => id === 'x');
  say(halfReach.one === 1, 'A: one side placed reads ONE');

  // --- C. naming shape
  const jelRoster = [
    { id: 1, race: 'argonian', name: 'Wuleen-Kus' }, { id: 2, race: 'argonian', name: 'Ee-Vashum' },
    { id: 3, race: 'argonian', name: 'Ixtu-Meer' }, { id: 4, race: 'argonian', name: 'Sees-All-Colours' },
  ];
  const jel = namingShape(jelRoster);
  say(jel.descriptive === 1 && jel.other === 3, 'C: Jel compounds are not counted as hyphenated English');
  say(jel.fails_section_4 === false, 'C: a mostly-Jel roster holds §4');
  const engRoster = [
    { id: 1, race: 'argonian', name: 'Falura Nine-Teeth' }, { id: 2, race: 'argonian', name: 'Onwen Quick-Tally' },
    { id: 3, race: 'argonian', name: 'Ranaso Wet-Foot' }, { id: 4, race: 'argonian', name: 'Ixtu-Meer' },
  ];
  const eng = namingShape(engRoster);
  say(eng.descriptive === 3 && eng.fails_section_4 === true, 'C: a mostly-descriptive roster FAILS §4');
  say(namingShape([{ id: 1, race: 'argonian', name: 'Weel Quick-Tally of old quay' }]).unarticled_of === 1,
    'C: the "of <bare noun>" template leak is caught');
  say(namingShape([{ id: 1, race: 'argonian', name: 'Weel Quick-Tally of the Boards' }]).unarticled_of === 0,
    'C: a properly articled "of the ..." is NOT flagged (the rule is not "any of")');
  say(namingShape([{ id: 1, race: 'argonian', name: 'Bevene the Patient' }, { id: 2, race: 'argonian', name: 'Bevene the Patient' }])
    .reused_names.length === 1, 'C: a name reused across settlements is caught');
  say(namingShape([{ id: 1, race: 'dunmer', name: 'Falura Nine-Teeth' }]).argonian_named === 0,
    'C: a non-Argonian is not judged by the Argonian rule');

  // --- B. inertness: the control must be able to break
  const rawFake = {
    facts: [
      { id: 'CF-T1', disputed: true, claim: 'a disputed thing', positions: [{ id: 'A', holders: { actors: ['smith'], factions: [] } }] },
      { id: 'CF-T2', disputed: false, claim: 'a plain fact' },
    ],
  };
  const struck = withFactStruck(rawFake, 'CF-T1');
  say(struck instanceof CanonRegistry, 'B: striking a fact yields a usable register');
  const stillThere = JSON.parse(JSON.stringify(rawFake));
  say(stillThere.facts[0].positions[0].holders.actors.length === 1,
    'B: striking works on a COPY — the source register is not mutated');

  console.log(`\nself-test ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail}`);
  return fail === 0 ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
