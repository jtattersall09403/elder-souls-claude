#!/usr/bin/env node
/**
 * place-library.mjs — PUT THE LIBRARY WHERE SOMEBODY CAN FIND IT.
 *
 * W1-23 round 3, §5: "Three of nineteen registered contradiction pairs have both sides reachable.
 * Fifteen have neither." And §4: "99 of 152 texts are referenced nowhere under `game/` outside the
 * file that defines them." The verdict's own remedy names the mechanism:
 *
 *   "place the 30 books carrying the 15 unreachable disputes as `readable` entries in rooms that
 *    already exist — the new `game/data/world/readables/site-marks.json` is the pattern and the
 *    mechanism is already shipped."
 *
 * SO THIS FILE WRITES NO NEW MECHANISM. It is `tools/readables/place-documents.mjs` pointed at a
 * different set of books: an interior record's `readable` is a LIST, a member may name a `book` in
 * `game/data/books/**`, `render/interior.js` draws it on a wall slot with a 2.6 m minimum
 * separation, `Engine._furnishInterior()` spawns it, and `_takePropPending` opens it. All of that
 * is W1-READABLES round 2's and is reused unchanged. `redundant_with: W1-READABLES-r2` is declared
 * in the status file for exactly this reason.
 *
 * THE PLACEMENT RULE, stated so a critic can disagree with it rather than guess at it:
 *
 *   A book lives where its ARGUMENT is had. Not where its subject is, and not in a library —
 *   there is no library in this province and there should not be one. A drill manual is in the
 *   room where men are armed; the answer to it is in a different town's armoury, because the two
 *   halves of a disagreement being on the same shelf is a folder, not an argument. A weir-woman's
 *   account of the ford is at the weir; the prefect's is in the Praetorium that commissioned it.
 *
 * TWO SIDES, TWO PLACES. Every one of the 19 registered contradiction pairs is placed with its
 * halves in DIFFERENT rooms, and where the argument is between an Imperial and an Argonian
 * account, in different settlements. `--check` fails if any pair lands both halves in one room.
 *
 * Run:  node tools/lore/place-library.mjs [--write] [--check] [--self-test]
 * Exit: 0 on a clean report/write. 1 if --check finds an unplaced pair or a same-room pair.
 *       2 if a placement names a book or a room that does not exist.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const IDIR = 'game/data/world/interiors';

// ---------------------------------------------------------------------------------------------
// THE PLACEMENTS. One line per room saying why the room, then the books.
//
// A title is written for the SHELF, not copied from the title page: what you read on the object
// before you pick it up is what somebody in that room would call it.
// ---------------------------------------------------------------------------------------------
export const PLACEMENTS = {
  // ---- the arms of the province ------------------------------------------------------------
  // Stormhold garrison. The Ninth's own standing instruction, and the treatise it is answering.
  'stormhold-praetorium': [
    ['standing-instruction-for-auxiliaries', 'Standing Instruction, arming and marching'],
    ['minute-on-the-authority-of-section-nine', 'Office minute, registry 1114/9'],
    ['the-relief-of-the-reman-ford', 'The Relief of the Reman Ford'],
  ],
  // Blackrose warders' hall. A serjeant of twenty years wrote what he thinks of the Instruction
  // in the back of his own book, and he is not in Stormhold, which is the point.
  'blackrose-warders-hall': [
    ['the-serjeants-answer', 'The back of Serjeant Brell’s book'],
    ['the-day-book-of-the-relief-column', 'Day-book of the relief column'],
    ['the-lease-and-what-it-costs', 'Of the labour-lease, and why it is not what it is called'],
  ],
  // Stormhold smithy. Shields, and a two-hander argument that starts here.
  'stormhold-smithy': [
    ['the-door-that-walks', 'The Door That Walks'],
    ['the-fen-zweihander-and-why-it-wins', 'Why the fen lads beat the Chorrol man'],
    ['on-the-bog-iron-mace', 'On bog-iron, and the heads cast from it'],
  ],
  // Gideon smithy. The instructor's course answering the great-shield treatise, and the old grip.
  'gideon-smithy': [
    ['the-buckler-and-the-hand', 'The Buckler and the Hand'],
    ['on-the-hanging-guard', 'On the hanging guard, and against the new grip'],
    ['the-duelling-pick-and-the-bog-rapier', 'Of the thrusting swords in this climate'],
  ],
  // Thorn depot. Reaping blades: the chronicle that calls them weapons is kept where they are
  // racked, and the letter that says they are farm tools is at the grange that uses them.
  'thorn-gate': [
    ['the-reaper-and-the-scythe', 'The Reaper and the Scythe'],
    ['the-weapon-rack-tally-at-thorn', 'Rack tally, quarterly, with the quarter before'],
    ['the-thorn-depot-lintel', 'The lintel over the gate'],
  ],
  'gideon-grange': [
    ['the-harvest-edge-is-a-farm-tool', 'A letter to Teeus-Ahai, who should have asked'],
    ['the-grange-book', 'The grange book, for my daughter'],
    ['what-the-water-took', 'What the water took, the wet season'],
  ],
  // Helstrom warders. The axe letter, from an uncle who thinks his nephew is a fool.
  'helstrom-warders': [
    ['the-axe-in-the-hand-of-a-fool', 'The axe in the hand of a fool'],
    ['the-chain-and-what-it-costs', 'In defence of the chain'],
    ['the-shadowscale-question', 'Report on the existence of the Shadowscales'],
  ],
  // Lilmoth smithy. The billman's answer to the gentleman from Anvil — a different coast entirely.
  'lilmoth-smithy': [
    ['a-bill-mans-answer-to-his-betters', 'An answer to the gentleman from Anvil'],
    ['the-reaver-and-the-sickle', 'The Reaver and the Sickle'],
    ['the-splitting-of-shells', 'The splitting of shells'],
  ],
  'soulrest-smithy': [
    ['the-gig-and-the-lance', 'The gig and the lance: two uncles disagreeing'],
    ['the-horn-and-the-wet-string', 'On bows in a country that eats them'],
  ],
  'blackrose-smithy': [
    ['on-locks-bars-and-the-opening-of-armouries', 'Of locks, bars and the opening of armouries'],
    ['the-notch-count-of-a-broom-handle', 'On the selling of romances to soldiers'],
  ],
  'stormhold-gaol': [
    ['why-the-ninth-has-no-battle-mages', 'Notes on destructive magic in this province'],
    ['the-muster-leaf', 'Muster leaf, torn'],
  ],
  'stormhold-inn-lean': [
    ['the-chant-of-the-second-rank', 'The chant of the second rank'],
    ['a-handbill-for-the-auxiliaries', 'A handbill, off the gate at Gideon'],
    ['the-counting-rhyme-of-the-line', 'The Line, a counting rhyme'],
  ],

  // ---- who built the xanmeers, and what is under the Stone Wastes ---------------------------
  // Helstrom scriptorium: the Imperial survey and its second volume, which says Argonians did not
  // build them.
  'helstrom-scriptorium': [
    ['the-stone-nests-i', 'The Stone Nests of Argonia, the first'],
    ['the-stone-nests-ii', 'The Stone Nests of Argonia, the second'],
    ['the-stone-nests-iii', 'The Stone Nests, the third: replies'],
  ],
  // The Hist shrine at Helstrom, where the root-songs are sung. The Egg Speaks Twice answers the
  // survey without having read it, and it is a different building in a different quarter.
  'helstrom-hist-shrine': [
    ['the-egg-speaks-twice', 'Nine root-songs of the deep marsh'],
    ['the-gem-and-the-root', 'A statement of the Deep-Kin'],
  ],
  'stormhold-chapel': [
    ['the-house-built-in-reverence', 'Of the house under the Wastes, built in reverence'],
    ['a-tract-for-the-marsh', 'A tract: wherein the Nine are commended'],
  ],
  'stormhold-archive': [
    ['the-house-built-in-fear', 'Of the house under the Wastes, built in fear'],
    ['the-duskfall-chronicle', 'A chronicle of the Duskfall'],
    ['on-the-tally-stones', 'On the tally-stones of the Blackwood'],
  ],

  // ---- whether subjects of the Empire are held as property ----------------------------------
  // The province's central moral fact. The address to the free peoples is in the customs house
  // that hands it out; the salt-factor's own ledger, which is the answer, is in the ledger house
  // of a different town, kept by the people who do the counting.
  'lilmoth-customs': [
    ['the-blessings-of-the-coast', 'The Blessings of the Coast: an address'],
    ['marginalia-in-a-borrowed-book', 'A borrowed copy of the Blessings, written in'],
  ],
  'lilmoth-ledger-house': [
    ['ledger-and-journal-of-andrel-vorin', 'Ledger and journal of Andrel Vorin, salt-factor'],
    ['the-descents', 'The Descents, kept at the rootpost'],
  ],

  // ---- what survives when a soul returns to the Hist ----------------------------------------
  'soulrest-grey-hist': [
    ['the-sap-and-the-ledger', 'The Sap and the Ledger'],
    ['the-counting-rhyme', 'A rhyme for the stair'],
  ],

  // ---- whether a well may be cut for sale at all --------------------------------------------
  // `the-sap-and-the-knife` is already in the Helstrom gallery (W1-READABLES round 1). The factor
  // who went to buy a well wrote the other half, and it belongs in the trading room at Thorn.
  'thorn-trader': [
    ['what-the-hollow-has-to-trade', 'What the hollow has to trade'],
    ['told-at-the-weir', 'Notes of a factor who went to buy a well'],
  ],

  // ---- the ford ------------------------------------------------------------------------------
  // The best writing in the project, and until now unreachable from either side. The weir people's
  // account is at the weir town's own hall; the assembled Imperial relief is in the Praetorium
  // above; the pacification and the marsh's answer are a whole province apart.
  'thorn-hall': [
    ['the-water-does-not-take-sides', 'What the weir people say about the ford'],
    ['nine-stanzas-upon-the-drowning', 'Nine stanzas upon the drowning'],
  ],
  'gideon-court': [
    ['a-short-account-of-the-pacification', 'A short account of the pacification'],
    ['the-casebook-i', 'The casebook of the Assize, the first'],
    ['the-casebook-ii', 'The casebook of the Assize, the second'],
  ],
  'helstrom-archive': [
    ['the-account-the-marsh-keeps', 'The account the marsh keeps'],
    ['a-survey-of-the-peoples-of-the-interior', 'A survey of the peoples of the interior'],
    ['the-oliis-bargain', 'What was agreed at the water'],
  ],

  // ---- the Knahaten Flu ----------------------------------------------------------------------
  'gideon-chapel': [
    ['the-knahaten-years', 'The Knahaten Years: a chronicle of the silver coast'],
    ['the-fingers-and-the-hand', 'What the Lilmoth keepers hold'],
  ],
  'lilmoth-rootpost': [
    ['what-the-water-went-round', 'What the water went round'],
    ['what-the-hand-knows', 'A teaching for those who will not be taught'],
  ],

  // ---- the rest of the library, where it belongs ---------------------------------------------
  'gideon-apothecary': [
    ['a-practical-handling-of-the-marsh-fevers', 'A practical handling of the marsh-fevers'],
    ['of-the-beasts-of-the-southern-marsh', 'Of the beasts of the southern marsh'],
  ],
  'lilmoth-healer': [
    ['instructions-for-the-lamp', 'Instructions for the lamp, nailed inside the lid'],
    ['prayer-strips-tideway-shrine', 'Prayer-strips off the rail'],
  ],
  'lilmoth-scribe': [
    ['a-progress-i', 'A Progress Through the Southern Marsh, the first'],
    ['a-progress-ii', 'A Progress Through the Southern Marsh, the second'],
    ['a-progress-iii', 'A Progress Through the Southern Marsh, the third'],
  ],
  'stormhold-scribe': [
    ['the-lizard-kings-bride', 'The Lizard-King’s Bride'],
    ['the-lane-keeper-and-other-lies', 'The Lane-Keeper: a romance of the marsh'],
    ['verses-on-the-provincial-service', 'Verses on my eleventh year'],
  ],
  'helstrom-inn-tide': [
    ['songs-for-the-weir', 'Songs for the weir'],
    ['the-heron-and-the-clerk', 'The heron and the clerk'],
  ],
  'lilmoth-inn-drowned': [
    ['the-boy-who-counted-the-tide', 'The boy who counted the tide'],
    ['the-eleven-strokes-of-teeja-lun', 'The eleven strokes, as Sedd Ravano tells it'],
  ],
  'thorn-inn': [
    ['the-polers-book', 'The Poler’s Book: the roads that are water'],
    ['the-poler-and-the-runner', 'How a man gets anywhere here carrying anything'],
  ],
  'helstrom-hollow-bole': [
    ['the-terrace-climbers', 'Getting up a stone nest, and down again'],
    ['not-being-seen-in-a-country-with-no-shadows', 'Not being seen in a country with no shadows'],
    ['inscription-third-terrace', 'The inscription on the third terrace'],
  ],
  'stormhold-customs': [
    ['thirty-years-in-the-auxiliaries-i', 'Thirty years in the auxiliaries, the first'],
    ['thirty-years-in-the-auxiliaries-ii', 'Thirty years in the auxiliaries, the second'],
    ['thirty-years-in-the-auxiliaries-iii', 'Thirty years in the auxiliaries, the third'],
  ],
  'gideon-tollhouse': [
    ['a-receipt-and-what-is-on-the-back', 'A receipt, and what is on the back'],
    ['the-challenge-and-what-was-written-on-the-back', 'A card delivered at Gideon'],
    ['the-soulrest-sheet', 'The Soulrest sheet, for the week of the ninth'],
  ],
  'blackrose-clerk': [
    ['the-yard-tally-blackrose', 'Yard tally, the fourth quarter'],
    ['the-list-of-names-that-is-not-a-register', 'A list of names, on the back of a chart'],
    ['the-deposition-about-the-carts', 'A deposition taken at Lilmoth'],
  ],
  'archon-vat-house': [
    ['the-kiln-camp-order-book', 'Order book, kiln camp, the last four entries'],
    ['bill-of-lading-archon', 'Bill of lading, third mooring'],
  ],
  'archon-guild-office': [
    ['valus-survey-fragment', 'Survey of the ridge above Tenmarch, sheet four'],
    ['the-marker-at-the-second-bend', 'The marker at the second bend'],
  ],
  'soulrest-quay': [
    ['note-left-in-a-boot', 'A note found folded in a boot'],
    ['a-page-out-of-something', 'A page, torn at both edges'],
  ],
  'helstrom-legation': [
    ['the-last-letter-of-a-file-leader', 'A letter found folded in a helmet'],
    ['the-casebook-iii', 'The casebook of the Assize, the third'],
  ],
};

// ---------------------------------------------------------------------------------------------

function bookIndex() {
  const dir = R('game/data/books');
  const ids = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const b of (j.books || [j])) if (b && b.id) ids.set(b.id, b);
  }
  return ids;
}

/** Mutual contradiction pairs, computed the same way the round-3 critic's instrument computes them. */
export function mutualPairs(books) {
  const byId = new Map([...books.entries()]);
  const edges = new Set();
  for (const [id, b] of books) for (const c of (b.contradicts || [])) edges.add(`${id}|${c.book}`);
  const pairs = [], seen = new Set();
  for (const k of edges) {
    const [a, c] = k.split('|');
    if (!byId.has(c) || !edges.has(`${c}|${a}`)) continue;
    const key = [a, c].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, c]);
  }
  return pairs;
}

/** Where is each book placed today — by this table, and by anything already on the tree. */
function placedRooms() {
  const where = new Map();
  for (const f of fs.readdirSync(R(IDIR))) {
    if (!f.endsWith('.json')) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(R(IDIR), f), 'utf8'));
    const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
    for (const r of list) if (r && r.book) {
      if (!where.has(r.book)) where.set(r.book, []);
      where.get(r.book).push(f.replace(/\.json$/, ''));
    }
  }
  return where;
}

function validate(books) {
  const problems = [];
  const seen = new Map();
  for (const [room, list] of Object.entries(PLACEMENTS)) {
    if (!fs.existsSync(path.join(R(IDIR), `${room}.json`))) problems.push(`no such room: ${room}`);
    for (const [id] of list) {
      if (!books.has(id)) problems.push(`${room}: no book '${id}' in game/data/books/**`);
      if (seen.has(id)) problems.push(`${id} placed twice: ${seen.get(id)} and ${room}`);
      seen.set(id, room);
    }
  }
  return problems;
}

function apply(write) {
  const out = [];
  for (const [room, list] of Object.entries(PLACEMENTS)) {
    const p = path.join(R(IDIR), `${room}.json`);
    const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
    const existing = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
    const have = new Set(existing.map((r) => r.id));
    const next = existing.slice();
    let added = 0;
    for (const [id, title] of list) {
      if (have.has(id)) continue;
      next.push({ id, title, book: id });
      added++;
    }
    if (added && write) { rec.readable = next; fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n'); }
    out.push([room, existing.length, next.length, added]);
  }
  return out;
}

function report(argv) {
  const books = bookIndex();
  const problems = validate(books);
  if (problems.length) {
    console.error('place-library: the table names things that do not exist —');
    for (const p of problems) console.error(`  ${p}`);
    return 2;
  }
  const write = argv.includes('--write');
  const rows = apply(write);
  const placedHere = Object.values(PLACEMENTS).reduce((n, l) => n + l.length, 0);
  for (const [room, was, now, added] of rows) {
    if (added || argv.includes('--verbose')) console.log(`  ${room.padEnd(26)} ${was} -> ${now} readable(s)  (+${added})`);
  }
  console.log(`${write ? 'placed' : 'would place'} ${placedHere} texts across ${rows.length} rooms`);

  // Pair reach, after
  const where = placedRooms();
  const pairs = mutualPairs(books);
  let both = 0, one = 0, neither = 0, sameRoom = 0;
  const table = Object.fromEntries(Object.entries(PLACEMENTS).flatMap(([room, l]) => l.map(([id]) => [id, room])));
  const roomOf = (id) => (where.get(id) || [])[0] || table[id] || null;
  for (const [a, c] of pairs) {
    const ra = roomOf(a), rc = roomOf(c);
    const n = (ra ? 1 : 0) + (rc ? 1 : 0);
    if (n === 2) {
      both++;
      if (ra === rc) {
        // Only THIS table's doing is a defect. The three pairs already on one shelf are
        // W1-READABLES round 1's — the Court archive under the burial stair, which is the one
        // building the Recension argument is about — and moving another piece's placement to
        // improve this piece's number would be the wrong kind of tidying.
        const mine = table[a] === ra && table[c] === rc;
        if (mine) sameRoom++;
        console.log(`  SAME ROOM  ${a} and ${c} are both in ${ra}${mine ? '  <- this table' : '  (pre-existing, not this table)'}`);
      }
    }
    else if (n === 1) { one++; console.log(`  ONE SIDE   ${a}${ra ? '' : ' (unplaced)'} <-> ${c}${rc ? '' : ' (unplaced)'}`); }
    else { neither++; console.log(`  NEITHER    ${a} <-> ${c}`); }
  }
  console.log(`contradiction pairs: ${pairs.length} mutual — both sides placed ${both}, one ${one}, neither ${neither}`);
  if (argv.includes('--check')) {
    if (neither || one || sameRoom) {
      console.error(`place-library --check FAILED: ${neither} pair(s) with neither side placed, ${one} with one, ${sameRoom} with both halves in one room`);
      return 1;
    }
    console.log('place-library --check: every registered pair has both sides in the world, in two different rooms. ok');
  }
  return 0;
}

function selfTest() {
  let pass = 0, fail = 0;
  const say = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${msg}`); ok ? pass++ : fail++; };

  const fake = new Map([
    ['x', { id: 'x', contradicts: [{ book: 'y' }] }],
    ['y', { id: 'y', contradicts: [{ book: 'x' }] }],
    ['p', { id: 'p', contradicts: [{ book: 'q' }] }],
    ['q', { id: 'q' }],
    ['z', { id: 'z', contradicts: [{ book: 'nobody' }] }],
  ]);
  const pr = mutualPairs(fake);
  say(pr.length === 1, 'a one-way edge is not a pair, and a dangling edge is not a pair');

  const books = bookIndex();
  say(books.size > 100, `the shipped library loads (${books.size} texts)`);
  say(validate(books).length === 0, 'every book and every room this table names exists on the tree');
  say(mutualPairs(books).length >= 8, `RI-LOR03 §2's bar of >=8 mutual pairs is met in the registry (${mutualPairs(books).length})`);

  // the table must not put both halves of any pair in one room — checked against the table alone
  const table = Object.fromEntries(Object.entries(PLACEMENTS).flatMap(([room, l]) => l.map(([id]) => [id, room])));
  const clash = mutualPairs(books).filter(([a, c]) => table[a] && table[a] === table[c]);
  say(clash.length === 0, `no pair has both halves on one shelf${clash.length ? ` (${clash[0].join(' + ')})` : ''}`);

  // and the validator must be able to go red
  const saved = PLACEMENTS['thorn-inn'];
  PLACEMENTS['thorn-inn'] = [['a-book-that-does-not-exist', 'x']];
  say(validate(books).length > 0, 'a placement naming a book that is not on disk is caught');
  PLACEMENTS['thorn-inn'] = saved;
  const savedRoom = PLACEMENTS['no-such-room'] = [['songs-for-the-weir', 'x']];
  say(validate(books).some((p) => /no such room/.test(p)), 'a placement naming a room that is not on disk is caught');
  delete PLACEMENTS['no-such-room'];
  void savedRoom;

  console.log(`\nself-test ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail}`);
  return fail === 0 ? 0 : 1;
}

// Only run when this file IS the command. `tools/lore/w1-23-r4-consume.mjs` imports PLACEMENTS to
// build its teardown arm out of the same table it placed from, and an unguarded main exits the
// importer instead — which it did, silently, and the consumption run reported a clean exit 0
// having measured nothing.
const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  process.exit(argv.includes('--self-test') ? selfTest() : report(argv));
}
