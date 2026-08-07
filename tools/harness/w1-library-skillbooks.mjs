#!/usr/bin/env node
// w1-library-skillbooks.mjs — is RI-LOR03 §2's `skill book` overlay a MODEL or a text file?
//
// The round-1 verdict's single biggest gap was that both mechanical consumers the two items name
// were dead code: `topics_taught` and `knowledge_key` were read by ZERO files in `game/src/`, so
// the critic could open all sixty books in the engine and read `topicsKnown: []` afterwards.
// Round 2 also took the overlay from 1 tagged book to 32, and a third declared field with no
// reader would have been the same failure a third time (`RI-MTH07`, mandatory under
// `ARBITRATION.md` §3). This probe exists so that claim is a measurement rather than a promise.
//
// It asks four questions, and the last two are the ones that matter:
//
//   1. Does reading a skill book raise the skill it names, in the running world?
//   2. Does reading it TWICE raise it twice? (It must not. `booksRead` is the guard.)
//   3. Does the grant survive a SAVE AND LOAD — and, more to the point, does the *idempotence*
//      survive one? A world that forgets it read the book lets a player farm a level by
//      reloading, which is the same class of defect as a purse destroyed on a round trip.
//      Audit the running world after the load, not the bytes.
//   4. THE CONTROL, and without it the rest is worth nothing: a book with NO `skill_book` field,
//      read the same way in the same session, must move no skill at all. If every read moves a
//      skill then the probe is measuring the passage of time, not the book.
//
// Run:  node tools/harness/w1-library-skillbooks.mjs
// Exit: 0 only if all four hold.

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-library-skillbooks.mjs'); process.exit(0); }

// Straight off disk. Naming ids in the probe would let a retagged corpus turn it into a no-op.
const WITH = [], WITHOUT = [];
for (const f of readdirSync('game/data/books').filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  for (const b of (Array.isArray(doc.books) ? doc.books : doc.id ? [doc] : [])) {
    (typeof b.skill_book === 'string' && b.skill_book ? WITH : WITHOUT).push({ id: b.id, skill: b.skill_book || null });
  }
}
if (!WITH.length) { console.error('no book on disk carries `skill_book`: nothing to measure, and that is the finding.'); process.exit(1); }

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate(({ WITH, WITHOUT }) => {
  const H = window.__HARNESS;
  const res = { tagged_on_disk: WITH.length, rows: [], control: null, reload: null };
  // `getSkillSheet()` is the world's own register: {skillId: {value, progress, to_next, ...}}.
  const sheetOf = () => H.getSkillSheet();
  const skillValue = (id) => { const s = sheetOf()[id]; return s ? s.value : null; };
  const read = (id) => { try { H.closeMenu(); } catch {} H.openMenu('book', { id }); const u = H.getUIState(); try { H.closeMenu(); } catch {} return u && u.book ? u.book.pages : 0; };

  for (const b of WITH) {
    const row = { id: b.id, skill: b.skill };
    try {
      row.before = skillValue(b.skill);
      if (row.before === null) { row.error = 'no such skill on the character sheet'; res.rows.push(row); continue; }
      // RI-PRG03 §4's REST CLAMP is live here and it is not this item's rule to bend: a skill
      // may gain at most +3 levels between HEARTH rests. Seven of the 32 tags are speechcraft
      // and six are root-speech, so from the fourth book in a skill onwards the correct grant is
      // ZERO and a probe demanding +1 would be demanding that books ignore progression's own
      // ceiling. So: read `levels_since_rest` and require +1 only while there is headroom.
      row.levels_since_rest_before = (sheetOf()[b.skill] || {}).levels_since_rest || 0;
      row.pages = read(b.id);
      row.after_first_read = skillValue(b.skill);
      row.gained = row.after_first_read - row.before;
      row.rest_clamped = row.levels_since_rest_before >= 3;
      read(b.id);
      row.after_second_read = skillValue(b.skill);
      row.idempotent = row.after_second_read === row.after_first_read;
      // `getQuestState()` reports `booksRead` (the live array); the SAVE BLOB spells the same
      // thing `dialogue.books_read`. Two spellings for one fact is a trap, and reading the wrong
      // one made the first run of this probe report `in_books_read: false` on all 32 while the
      // consumer was working perfectly.
      row.in_books_read = (H.getQuestState().booksRead || []).includes(b.id);
      row.pass = row.gained === (row.rest_clamped ? 0 : 1) && row.idempotent && row.in_books_read;
    } catch (e) { row.error = String(e).slice(0, 200); }
    res.rows.push(row);
  }

  // ---- THE CONTROL. A book with no `skill_book`, read the same way, must move nothing.
  try {
    const c = { books_tried: 0, any_skill_moved: false };
    const flat = () => { const sh = sheetOf(), m = {}; for (const k of Object.keys(sh)) m[k] = sh[k].value; return m; };
    const before = flat();
    for (const b of WITHOUT.slice(0, 8)) { read(b.id); c.books_tried++; }
    const after = flat();
    c.moved = Object.keys(before).filter((k) => before[k] !== after[k]);
    c.any_skill_moved = c.moved.length > 0;
    c.pass = !c.any_skill_moved;
    res.control = c;
  } catch (e) { res.control = { error: String(e).slice(0, 200) }; }

  // ---- RELOAD. Save AFTER the books have been read, disturb nothing, load, read the same book
  // again, and assert the skill does NOT move. If `books_read` did not survive the round trip
  // the world has forgotten, and a level is farmable by reloading.
  try {
    const b = WITH[0];
    const r = { book: b.id, skill: b.skill };
    const blob = H.saveState();
    r.blob_books_read = ((blob.dialogue && blob.dialogue.books_read) || []).length;
    r.blob_has_this_book = ((blob.dialogue && blob.dialogue.books_read) || []).includes(b.id);
    r.before_load = skillValue(b.skill);
    H.loadState(blob);
    r.after_load = skillValue(b.skill);
    r.books_read_after_load = (H.getQuestState().booksRead || []).includes(b.id);
    read(b.id);
    r.after_reread = skillValue(b.skill);
    r.farmable = r.after_reread !== r.after_load;
    r.skill_survived_load = r.after_load === r.before_load;
    r.pass = r.blob_has_this_book && r.books_read_after_load && !r.farmable && r.skill_survived_load;
    res.reload = r;
  } catch (e) { res.reload = { error: String(e).slice(0, 300) }; }

  return res;
}, { WITH, WITHOUT });

out.page_errors = errors;
const rows = out.rows.filter((r) => !r.error);
out.summary = {
  tagged: out.tagged_on_disk,
  measured: rows.length,
  raised_by_one: rows.filter((r) => r.gained === 1).length,
  correctly_zero_under_the_rest_clamp: rows.filter((r) => r.rest_clamped && r.gained === 0).length,
  idempotent: rows.filter((r) => r.idempotent).length,
  recorded_in_booksRead: rows.filter((r) => r.in_books_read).length,
  control_moved_no_skill: !!(out.control && out.control.pass),
  reload_not_farmable: !!(out.reload && out.reload.pass),
};
const ok = rows.length > 0 && rows.every((r) => r.pass) && out.summary.control_moved_no_skill && out.summary.reload_not_farmable;
out.verdict = ok ? 'PASS' : 'FAIL';

console.log(JSON.stringify({ verdict: out.verdict, summary: out.summary, control: out.control, reload: out.reload, first_rows: out.rows.slice(0, 4) }, null, 2));
writeJson(args.out || 'reports/w1-library-skillbooks.json', out);
await handle.close();
process.exit(ok ? 0 : 1);
