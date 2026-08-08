// W1-READABLES — put each document in the room the quest sends you to.
//
// An interior record's `readable` was one {id, title} pair that drew a book-shaped box on a
// shelf and had nothing written in it. It may now be a LIST, and a member may name a `book` in
// `game/data/books/**`. The existing record stays first in every list and is untouched, so the
// 83 rooms that already had a shelf book still have exactly the shelf book they had.
//
// WHERE EACH ONE GOES, and the rule: a document lives in the room where the person who owns it
// stands. Those posts are not invented here — they are `npc.post.at_building`, authored by
// W1-GIVER-PRESENCE, and `travelToGiver()` is the world's own call that walks you to them.
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'game/data/world/interiors';

const PLACEMENTS = {
  // Hosk-Vei, ledgerer of the Drowned Court, posted at soulrest-court-steps. Four volumes of the
  // Tally, because the archive under the burial stair is where the Tally is and where Q-MAIN-06,
  // Q-MAIN-13 and Q-MAIN-30 all send you.
  // ...and the FIVE `channel: book` rows that have been counted routed since W1-LIBRARY round 2
  // on the strength of the book EXISTING. None of the nine `knowledge_key` books this build
  // shipped was an object in any room, so a player could satisfy those five reveals only through
  // `openMenu('book')`, which is the harness door. They are placed here for the same reason the
  // ledgers are, and the audit now requires placement of both.
  'soulrest-court-steps': [
    { id: 'the-drowned-tally-tenth-volume', title: 'The Drowned Tally, tenth volume', book: 'the-drowned-tally-tenth-volume' },
    { id: 'the-drowned-tally-fourth-volume', title: 'The Drowned Tally, fourth volume', book: 'the-drowned-tally-fourth-volume' },
    { id: 'the-drowned-tally-appendix', title: 'A short appendix, bound at the back', book: 'the-drowned-tally-appendix' },
    { id: 'the-drowned-tally-severances', title: 'Three leaves, kept out of order', book: 'the-drowned-tally-severances' },
    { id: 'the-drowned-tally-sixth-volume', title: 'The Drowned Tally, sixth volume', book: 'the-drowned-tally-sixth-volume' },
    { id: 'the-drowned-tally-eleventh-volume', title: 'The Drowned Tally, the current leaves', book: 'the-drowned-tally-eleventh-volume' },
    { id: 'the-seventh-recension', title: 'The Seventh Recension, the clauses entire', book: 'the-seventh-recension' },
    { id: 'for-the-ninth-clause', title: 'An answer to the archive', book: 'for-the-ninth-clause' },
    { id: 'against-the-ninth-clause', title: 'On what was done to the fair copies', book: 'against-the-ninth-clause' },
    { id: 'the-court-and-the-tide', title: 'A clerk’s handbook, much annotated', book: 'the-court-and-the-tide' },
    { id: 'the-commonplace-book-of-ivo-sarn', title: 'A commonplace book, returned to the chapter', book: 'the-commonplace-book-of-ivo-sarn' },
  ],
  // Neeja-Xul, posted at blackrose-shrine. Q-MAIN-07 says the book is under the bench in the
  // cutting yard behind the reed-walk, and this build has no interior for the yard; it is in the
  // room the woman who owns it is standing in, which is the nearest honest place for it.
  'blackrose-shrine': [
    { id: 'the-grandmother-yard-book', title: 'A yard book, older than the bench', book: 'the-grandmother-yard-book' },
  ],
  // Cuiro-Vaneth, harbourmaster, posted at archon-guild-office. Q-MAIN-08's tide-house.
  'archon-guild-office': [
    { id: 'the-archon-true-manifest', title: 'A second manifest, not the office copy', book: 'the-archon-true-manifest' },
  ],
  // Ashul-Tei, rootkeeper, posted at helstrom-undertemple. The letter the Deep-Kin have held for
  // eleven years and shown to no one. Read in the gallery, under her eye, like everything else
  // here: carrying it out of Helstrom is a RESOLUTION of Q-MAIN-10 with a consequence on it, and
  // not something a player does to a prop.
  'helstrom-undertemple': [
    { id: 'the-stewards-letter', title: 'A letter in Jel, taken off a body', book: 'the-stewards-letter' },
  ],
  // The Wet Ledger's own house at Lilmoth. Q-MAIN-16's giver sits at Soulrest; the book does not.
  'lilmoth-ledger-house': [
    { id: 'the-wet-ledger-private-book', title: 'The book behind the counter', book: 'the-wet-ledger-private-book' },
  ],
  // Ruvela Sath, posted at gideon-grange, and the compact meets behind her counting floor.
  'gideon-grange': [
    { id: 'the-compact-share-book', title: 'The compact’s share book', book: 'the-compact-share-book' },
  ],
  // Sesh-Anaat, rootkeeper, posted at thorn-sapwell. The order's own list of the seven.
  'thorn-sapwell': [
    { id: 'the-cutters-list', title: 'A short list, in seven hands', book: 'the-cutters-list' },
    { id: 'the-leave-book-of-thorn', title: 'The leave book, eleven entries', book: 'the-leave-book-of-thorn' },
  ],
  // Harbourmistress Tesh is posted at lilmoth-customs and Q-LILM-01 gates on this book.
  'lilmoth-customs': [
    { id: 'the-rootless-egg', title: 'The Rootless Egg', book: 'the-rootless-egg' },
  ],
};
// Two more that go in rooms already listed above.
PLACEMENTS['lilmoth-ledger-house'].push({ id: 'the-articles-of-the-wet-ledger', title: 'The articles of the house', book: 'the-articles-of-the-wet-ledger' });
// Speaker Teel-Ashaan has no `post` in `game/data/npcs/**` at all, so the giver rule cannot place
// Q-DEEP-01's book. It goes in the Deep-Kin's own gallery instead, which is where the argument it
// is part of happens, and this is the one placement in the file that is a judgement rather than a
// lookup.
PLACEMENTS['helstrom-undertemple'].push({ id: 'the-sap-and-the-knife', title: 'The Sap and the Knife', book: 'the-sap-and-the-knife' });

// every book id named above must exist, or the placement is a shelf with a hole in it
const bookIds = new Set();
for (const f of fs.readdirSync('game/data/books')) {
  const d = JSON.parse(fs.readFileSync(path.join('game/data/books', f), 'utf8'));
  for (const b of (Array.isArray(d.books) ? d.books : (d.id ? [d] : []))) bookIds.add(b.id);
}

let rooms = 0, docs = 0;
for (const [room, list] of Object.entries(PLACEMENTS)) {
  const p = path.join(DIR, `${room}.json`);
  const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
  const existing = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
  const have = new Set(existing.map((r) => r.id));
  const next = existing.slice();
  for (const d of list) {
    if (!bookIds.has(d.book)) throw new Error(`${room}: no book '${d.book}' in game/data/books/**`);
    if (have.has(d.id)) continue;
    next.push(d);
    docs++;
  }
  rec.readable = next;
  fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
  rooms++;
  console.log(`${room.padEnd(24)} ${existing.length} -> ${next.length} readable(s)`);
}
console.log(`placed ${docs} documents across ${rooms} rooms`);
