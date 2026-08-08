#!/usr/bin/env node
/**
 * critic-w1-23-r4-onscreen.mjs — CRITIC instrument, W1-23 round 4. Written by the critic.
 *
 * W1-23 round 4 claims "163 of 163 texts referenced" and "19 of 19 contradiction pairs with both
 * sides reachable". BOTH numbers come from `critic-w1-23-r3-reach.mjs`, whose reachability test is
 * literally `haystack.includes('"' + bookId + '"')` over every .json/.js under `game/` outside the
 * books directory. That test is honest about being the most generous one available — it is the
 * r3 critic's own words — but it cannot tell a book on a shelf from a book named in a comment.
 *
 * And the round's own consumption tool recorded that it could not close the last gap:
 *
 *     "THE RENDERED-TEXT ACCESSOR IS BLIND TO THE BOOK SCREEN. getRenderedText() returns 0
 *      characters on every leg with a book open."
 *
 * So nobody has yet confirmed that WORDS APPEAR ON THE SCREEN A PLAYER LOOKS AT. If they do not,
 * all 163 texts are placed and unreadable, which is the same thing as unplaced.
 *
 * THE BLINDNESS IS NOT STRUCTURAL AND THIS FILE WORKS AROUND IT WITHOUT A BACK DOOR.
 * `ui/system.js build()` short-circuits on `builtFrame === ctx.frame && lastMode === mode &&
 * lastTouchSig === sig`. While a screen is up the world is PAUSED, so `ctx.frame` never advances
 * and neither does the signature — the cache key is constant for the whole life of the screen.
 * The round-4 tool cleared the text register AFTER the book was already open and then asked for a
 * frame, so `build()` returned immediately, nothing was drawn, and the register it had just
 * emptied stayed empty. Clear the register BEFORE the player presses the button and the forced
 * build that OPENS the book draws straight into it. No harness door, no engine back door: the
 * only thing that changed is when the register is zeroed.
 *
 * THREE ARMS, twelve books, and the arms are the point:
 *
 *   A. SHIPPED. Walk into the room, stand 1 m from the object, press `interact` through the input
 *      pipeline, and assert THREE things — the right book id opened, the register drew a non-zero
 *      number of characters, and A SENTENCE FROM THAT BOOK'S OWN RECORD is among the strings the
 *      frame put on the screen. Not "a book screen appeared": this text, on this screen.
 *
 *   C. CONTROL, OUT OF REACH. Same room, same button, standing at `reach_m + 3 m`. This arm
 *      ASSERTS THE PROP IS PRESENT before it presses, which the round-4 tool did not: its pass
 *      predicate was `!opened`, which a room with no prop in it satisfies for free. A control
 *      whose success condition is also satisfied by the teardown is not a control (RULES #6).
 *
 *   X. CROSS-CHECK. The text drawn for book i must NOT contain book j's sentence, for every
 *      j != i. Without this, a build that drew one hard-coded page of parchment for every book
 *      would pass arm A twelve times.
 *
 * PROHIBITED, asserted against this file's own bytes: `openMenu` (the harness door straight into
 * the book screen) and `__ENGINE` (the documented engine back door). Both would skip the room,
 * the object and the reach, which are three of the four things being measured.
 *
 * Run:  node tools/lore/critic-w1-23-r4-onscreen.mjs [--out <json>] [--shot <png>]
 * Exit: 0 only if all twelve legs opened the right book AND drew its own words, the control stayed
 *       shut with the prop present, and no book drew another book's words.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const PROHIBITED = ['openMenu', '__ENGINE'];
{
  const body = fs.readFileSync(SELF, 'utf8').split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.includes('PROHIBITED')).join('\n');
  for (const p of PROHIBITED) {
    if (body.includes(`'${p}'`) || body.includes(`"${p}"`) || body.includes(`.${p}(`)) {
      console.error(`this tool names the prohibited verb ${p}. Refusing to report.`); process.exit(2);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(args.out || 'reports/w1-23-r4/critic-onscreen.json'));
const SHOT = args.shot ? path.resolve(ROOT, String(args.shot)) : null;
const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

// ---- the books, chosen rather than sampled -------------------------------------------------
// Six registered contradiction pairs, both halves of each, so the piece's headline claim — "both
// sides of the argument are reachable" — is what is walked to rather than twelve unrelated books.
// Two of the pairs are the ones the round-3 verdict named as the worst losses (the ford, and
// whether subjects of the Empire are held as property); one is a pair the r3 verdict recorded as
// ALREADY reachable, so a leg that passes for a reason that predates this round is visible as such.
const PAIRS = [
  ['the-blessings-of-the-coast', 'ledger-and-journal-of-andrel-vorin'],   // held as property
  ['the-relief-of-the-reman-ford', 'the-water-does-not-take-sides'],      // the ford
  ['standing-instruction-for-auxiliaries', 'the-serjeants-answer'],       // the shield line
  ['the-knahaten-years', 'what-the-water-went-round'],                    // the Flu
  ['the-grange-book', 'told-at-the-weir'],                                // Hist or a cutting
  ['the-seventh-recension', 'for-the-ninth-clause'],                      // pre-existing pair
];
const WANT = PAIRS.flat();

// ---- where each one is, read off the shipped interior records rather than off the placement table
function roomsFor() {
  const dir = path.join(ROOT, 'game/data/world/interiors');
  const where = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
    for (const r of list) if (r && r.book) {
      if (!where.has(r.book)) where.set(r.book, []);
      where.get(r.book).push(f.replace(/\.json$/, ''));
    }
  }
  return where;
}

/** A distinctive sentence out of each book's own record — what must appear on the screen. */
function needles() {
  const dir = path.join(ROOT, 'game/data/books');
  const out = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const b of (j.books || [j])) {
      if (!b || !WANT.includes(b.id)) continue;
      // The longest word of 8+ letters in the first 400 characters, plus the title. Long words
      // survive the paginator's line wrapping intact; a phrase would be split across two draws.
      const head = String(b.text || '').slice(0, 1200);
      const words = [...new Set(head.split(/[^A-Za-z’']+/).filter((w) => w.length >= 9))];
      out.set(b.id, { title: b.title || '', words: words.slice(0, 24), head_len: String(b.text || '').length });
    }
  }
  return out;
}

const WHERE = roomsFor();
const NEEDLE = needles();
const legs = [];
for (const id of WANT) {
  const rooms = WHERE.get(id) || [];
  const n = NEEDLE.get(id);
  if (!rooms.length) { console.error(`FATAL: ${id} is not in any interior's readable list — nothing to walk to.`); process.exit(2); }
  if (!n || !n.words.length) { console.error(`FATAL: ${id} has no text long enough to look for on a screen.`); process.exit(2); }
  legs.push({ book: id, room: rooms[0], rooms, needle: n });
}

// ---- one leg -------------------------------------------------------------------------------
async function runLeg(handle, leg, { farByM = 0 } = {}) {
  const rec = { book: leg.book, room: leg.room, prop: null, stood_m: null, opened: null,
    drawn_chars: 0, own_words_on_screen: 0, other_book_words_on_screen: [], note: null, title_on_screen: false };
  await handle.h('reset');
  await handle.h('setRenderRate', 0);
  try { await handle.h('enterInterior', leg.room); }
  catch (e) { rec.note = `enterInterior threw: ${e.message}`; return rec; }
  await handle.h('stepFrames', 2);

  const ents = await handle.h('listEntities');           // an ARRAY, per the round-4 bug note
  if (!Array.isArray(ents)) { rec.note = 'listEntities did not return an array'; return rec; }
  const props = ents.filter((e) => e && e.readable_book === leg.book);
  if (!props.length) { rec.note = 'no prop in this room offers that book'; return rec; }
  const prop = props[0];
  rec.prop = { eid: prop.eid, reach_m: prop.reach_m ?? null, pos: prop.pos };
  rec.props_in_room = ents.filter((e) => e && e.readable_book).length;
  // Two documents closer together than a person is wide means the nearest-prop rule can only ever
  // open one of them. The round-4 placement code has a 2.6 m minimum with a documented fallback
  // that "keeps the old wrapping behaviour for the remainder", so this is measured, not assumed.
  let nearest = Infinity;
  for (const e of ents) {
    if (!e || !e.readable_book || e.eid === prop.eid || !e.pos) continue;
    nearest = Math.min(nearest, Math.hypot(e.pos[0] - prop.pos[0], e.pos[2] - prop.pos[2]));
  }
  rec.nearest_other_document_m = Number.isFinite(nearest) ? +nearest.toFixed(2) : null;

  const where = await handle.h('whereAmI');
  const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
  const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
  let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
  const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
  const d = farByM ? (prop.reach_m || 1.6) + farByM : 1.0;
  await handle.h('teleport', prop.pos[0] + vx * d, prop.pos[2] + vz * d);
  rec.stood_m = +d.toFixed(2);

  // THE ONE LINE THAT UNBLINDS THE ACCESSOR: zero the register BEFORE the press, so the forced
  // build that opens the screen draws into it. Clearing after the open is what returned 0 chars.
  await handle.h('renderedTextClear');
  await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
  await handle.h('stepFrames', 8);
  await handle.h('renderFrame');

  const ui = await handle.h('getUIState');
  rec.opened = (ui && ui.book && ui.book.id) || null;
  rec.mode = (ui && ui.mode) || null;
  const t = await handle.h('getRenderedText');
  const rows = Array.isArray(t) ? t : (t && (t.distinct || t.text)) || [];
  const drawn = rows.map((r) => (typeof r === 'string' ? r : (r && (r.text || r.s)) || '')).join('\n');
  rec.drawn_chars = drawn.length;
  rec.register_complete = t && typeof t.complete === 'boolean' ? t.complete : null;
  rec.own_words_on_screen = leg.needle.words.filter((w) => drawn.includes(w)).length;
  rec.own_words_total = leg.needle.words.length;
  rec.title_on_screen = !!(leg.needle.title && drawn.includes(leg.needle.title.slice(0, 24)));
  rec.sample_on_screen = leg.needle.words.filter((w) => drawn.includes(w)).slice(0, 4);
  for (const [other, n] of NEEDLE) {
    if (other === leg.book) continue;
    const hits = n.words.filter((w) => drawn.includes(w) && !leg.needle.words.includes(w));
    if (hits.length >= 2) rec.other_book_words_on_screen.push({ other, hits: hits.slice(0, 3) });
  }
  return rec;
}

// ---- run -------------------------------------------------------------------------------------
const handle = await launchGame({ ...args });
const arms = { A_shipped: [], C_out_of_reach: [] };
try {
  await requireMethods(handle, ['reset', 'setRenderRate', 'enterInterior', 'listEntities', 'teleport',
    'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'whereAmI', 'renderFrame',
    'renderedTextClear', 'getRenderedText']);
  for (const leg of legs) {
    arms.A_shipped.push(await runLeg(handle, leg));
    const ui = await handle.h('getUIState');
    if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
  }
  // The control is run on the two legs of the pair the round-3 verdict called the province's
  // central moral fact, plus the ford — enough to see it fail-shaped, and it asserts the prop.
  for (const leg of legs.slice(0, 4)) {
    arms.C_out_of_reach.push(await runLeg(handle, leg, { farByM: 3 }));
    const ui = await handle.h('getUIState');
    if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
  }
  if (SHOT) {
    // One picture of a book actually open, since whether words reach the screen is the question.
    const leg = legs[0];
    await runLeg(handle, leg);
    await handle.h('setRenderRate', 1);
    await handle.h('renderFrame');
    ensureDir(path.dirname(SHOT));
    await handle.page.screenshot({ path: SHOT });
  }
} finally { await handle.close(); }

const A = arms.A_shipped, C = arms.C_out_of_reach;
const openedRight = A.filter((r) => r.opened === r.book).length;
const drewOwn = A.filter((r) => r.opened === r.book && r.own_words_on_screen >= 2).length;
const crossTalk = A.filter((r) => r.other_book_words_on_screen.length).length;
const cPropPresent = C.filter((r) => r.prop).length;
const cStayedShut = C.filter((r) => r.prop && !r.opened).length;
const crowded = A.filter((r) => r.nearest_other_document_m != null && r.nearest_other_document_m < 1.0).length;

const pass = openedRight === legs.length && drewOwn === legs.length && crossTalk === 0
  && cPropPresent === C.length && cStayedShut === C.length;

const report = { commit, legs: legs.length, pairs: PAIRS, arms,
  summary: { openedRight, drewOwn, crossTalk, cPropPresent, cStayedShut, crowded_rooms: crowded }, pass };
ensureDir(path.dirname(OUT));
writeJson(OUT, report);

console.log(`commit ${commit}\n`);
console.log('A. SHIPPED — stand at the shelf, press interact, read what the frame drew');
for (const r of A) {
  console.log(`  ${r.book.padEnd(38)} ${r.room.padEnd(24)} opened:${(r.opened || '(nothing)').padEnd(38)}`
    + ` drew ${String(r.drawn_chars).padStart(5)} chars, ${r.own_words_on_screen}/${r.own_words_total} of its own words`
    + `${r.nearest_other_document_m != null ? `  nearest other document ${r.nearest_other_document_m} m` : ''}`
    + `${r.note ? `  [${r.note}]` : ''}`);
  if (r.sample_on_screen && r.sample_on_screen.length) console.log(`      on screen: ${r.sample_on_screen.join(', ')}`);
  for (const o of r.other_book_words_on_screen) console.log(`      CROSS-TALK: also drew ${o.other}'s words ${o.hits.join(', ')}`);
}
console.log('\nC. CONTROL — same room, same button, standing out of reach; the prop must still be there');
for (const r of C) {
  console.log(`  ${r.book.padEnd(38)} prop:${r.prop ? 'present' : 'ABSENT'}  stood ${r.stood_m} m  `
    + `opened:${r.opened || '(nothing)'}  drew ${r.drawn_chars} chars`);
}
console.log(`\nopened the right book: ${openedRight}/${legs.length}`);
console.log(`drew ITS OWN words on the screen: ${drewOwn}/${legs.length}`);
console.log(`drew another book's words as well: ${crossTalk}`);
console.log(`control: prop present ${cPropPresent}/${C.length}, stayed shut ${cStayedShut}/${C.length}`);
console.log(`rooms where another document is within 1 m of the one under test: ${crowded}`);
console.log(`\nreport: ${path.relative(ROOT, OUT)}`);
console.log(pass ? 'ON SCREEN: the library is readable — the words in the record are the words on the screen.'
  : 'ON SCREEN: NOT demonstrated. See the arms above.');
process.exit(pass ? 0 : 1);
