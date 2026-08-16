// RI-MTH07 §B perturbation for defect 2, run by the critic, independently of the builder's script.
// Consumer chain, traced this turn from source:
//   Engine._buildUI()  -> foldBooks(this.data.books)            game/src/engine.js:4577
//   UISystem._bookModel -> this.data.books.get(this.bookId)     game/src/ui/system.js:1646
//   drawBook            -> wrap(m.book.text, ...)               game/src/ui/screens/text.js:240
// The ENTITY-SIDE observable is the wrapped lines the page actually draws.
import fs from 'node:fs';
import { foldBooks } from '/home/user/elder-souls-claude/game/src/data/fold-books.js';
import { wrap } from '/home/user/elder-souls-claude/game/src/ui/type.js';
import { faceOf } from '/home/user/elder-souls-claude/game/src/ui/type.js';

const R = '/home/user/elder-souls-claude/game/data/';
const index = JSON.parse(fs.readFileSync(R + 'index.json', 'utf8'));
const entries = index.files.filter(e => e.path.startsWith('books/'));
const dataBooks = {};
for (const e of entries) {
  const doc = JSON.parse(fs.readFileSync(R + e.path, 'utf8'));
  dataBooks[doc.id || e.path.split('/').pop().replace(/\.json$/, '')] = doc;
}
function naiveFold(db) {
  const m = new Map();
  for (const doc of Object.values(db)) {
    if (Array.isArray(doc.books)) for (const b of doc.books) m.set(b.id, b);
    else if (doc.id) m.set(doc.id, doc);
  }
  return m;
}
const ID = process.argv[2] || 'the-sap-and-the-ledger';
const face = faceOf('ink');
for (const [label, map] of [['PRE-FIX (naive fold)', naiveFold(dataBooks)], ['POST-FIX (real foldBooks)', foldBooks(dataBooks)]]) {
  const b = map.get(ID);
  const lines = wrap(b.text, face, 18, 420);
  console.log('== ' + label + ' ==');
  console.log('  record keys      :', Object.keys(b).join(', '));
  console.log('  typeof b.text    :', typeof b.text);
  console.log('  text length      :', (typeof b.text === 'string' ? b.text.length : 'n/a'));
  console.log('  wrap() line count:', lines.length);
  console.log('  FIRST DRAWN LINE : ' + JSON.stringify(lines[0]));
  console.log('  LAST DRAWN LINE  : ' + JSON.stringify(lines[lines.length - 1]));
  console.log('');
}
