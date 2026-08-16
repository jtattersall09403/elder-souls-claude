// Independent critic simulation. Replicates engine.js's loader (line ~12004:
// `out[b][doc.id || basename] = doc` over `index.files` order) and its OLD inline fold
// (engine.js:4567 pre-fix, recovered from `git show 43d26e6e^`), then compares against the
// REAL shipped foldBooks(). Written from the source read this turn, not from the builder's script.
import fs from 'node:fs';
import { foldBooks } from '/home/user/elder-souls-claude/game/src/data/fold-books.js';
const R = '/home/user/elder-souls-claude/game/data/';
const index = JSON.parse(fs.readFileSync(R + 'index.json', 'utf8'));
const bookEntries = index.files.filter(e => e.path.startsWith('books/'));
console.log('books/*.json entries in index.json:', bookEntries.length);
console.log('manifest.json position (1-based):', bookEntries.findIndex(e => e.path === 'books/manifest.json') + 1);

function loadInOrder(entries) {
  const out = {};
  for (const e of entries) {
    const doc = JSON.parse(fs.readFileSync(R + e.path, 'utf8'));
    const key = doc.id || e.path.split('/').pop().replace(/\.json$/, '');
    out[key] = doc;                       // exactly engine.js's line
  }
  return out;
}
// The OLD fold, verbatim from git show 43d26e6e^:game/src/engine.js
function oldFold(dataBooks) {
  const books = new Map();
  for (const doc of Object.values(dataBooks || {})) {
    if (Array.isArray(doc.books)) for (const b of doc.books) books.set(b.id, b);
    else if (doc.id) books.set(doc.id, doc);
  }
  return books;
}
const textless = m => [...m.entries()].filter(([, b]) => typeof b.text !== 'string' || !b.text).map(([id]) => id).sort();

const real = loadInOrder(bookEntries);
console.log('distinct file-keys in data.books:', Object.keys(real).length, '(collision if < ' + bookEntries.length + ')');

const oldOut = oldFold(real), newOut = foldBooks(real);
const oldBad = textless(oldOut), newBad = textless(newOut);
console.log('\n--- REAL load order ---');
console.log('OLD fold: total ids', oldOut.size, '| textless', oldBad.length);
console.log('NEW fold: total ids', newOut.size, '| textless', newBad.length);
if (newBad.length) console.log('NEW fold textless ids:', newBad.join(', '));
console.log('\nthe textless ids under the OLD fold:');
oldBad.forEach((id, i) => console.log(String(i + 1).padStart(3) + '. ' + id));

// ---- ORDER-INDEPENDENCE: the property the fix actually claims ----
function fp(m) { return [...m.keys()].sort().map(id => id + ' ' + ((m.get(id).text || '').length)).join('\n'); }
const baseNew = fp(newOut), baseOld = fp(oldOut);
let rng = 12345; const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let newVary = 0, oldVary = 0; const oldCounts = new Set([oldBad.length]);
const N = 500;
for (let t = 0; t < N; t++) {
  const sh = [...bookEntries];
  for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
  const d = loadInOrder(sh);
  if (fp(foldBooks(d)) !== baseNew) newVary++;
  const o = oldFold(d);
  if (fp(o) !== baseOld) oldVary++;
  oldCounts.add(textless(o).length);
}
console.log('\n--- ' + N + ' shuffled load orders ---');
console.log('NEW foldBooks() differed from baseline in:', newVary, 'of', N, '=> order-independent:', newVary === 0);
console.log('OLD fold differed from baseline in:', oldVary, 'of', N);
console.log('OLD fold textless-count range across shuffles:', Math.min(...oldCounts), '..', Math.max(...oldCounts));
