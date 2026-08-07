#!/usr/bin/env node
// w1-library-gates.mjs — does reading the book actually OPEN the door?
//
// The round-1 verdict's acceptance test for the biggest gap was stated exactly:
//
//   "the acceptance test is the probe already written: `critic-w1-library-consume.mjs` must show
//    `available: true` after reading and `false` before"
//
// `critic-w1-library-consume.mjs` now shows the clause `you have not learned book_<key>` present
// in the control and ABSENT after the book is read, on all three quests — which is the book gate
// opening. But `available` stays **false**, because each of those three resolutions is a
// CONJUNCTION and the book is one term of it. The others are a skill floor (`root_speech 0/45`)
// and reveals that arrive through other channels (`rev_keeper`). Reporting "the clause went away"
// and stopping there would be arguing that the door is open by pointing at one unlocked bolt.
//
// So this probe draws every OTHER bolt and leaves the book one alone. For each of the three
// resolutions: satisfy the skill floors with `setSkills`, grant the non-book reveals with
// `questReveal`, and then run the pair —
//
//   * WITHOUT reading the book  -> `available` must be FALSE, and the only remaining `why` must
//     be the book clause. If anything else is left, the fixture is incomplete and the run says so
//     rather than claiming a result.
//   * WITH the book read        -> `available` must be TRUE.
//
// That is the difference between "a string disappeared from a list" and "the player can now take
// the non-violent exit, and reading the book is what did it". It is also the delete-the-fix
// target: disconnect `_readBook` and the WITH leg must go false.
//
// Run:  node tools/harness/w1-library-gates.mjs
// Exit: 0 only if every resolution is false-without-the-book and true-with-it.

import { readFileSync, readdirSync } from 'node:fs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-library-gates.mjs'); process.exit(0); }

// The three resolutions are found by READING THE QUEST DATA, not by naming them here: a quest
// that stops gating on a book must make this probe report fewer cases, not silently pass.
const BOOK_KEYS = new Map();
for (const f of readdirSync('game/data/books').filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/books/${f}`, 'utf8'));
  for (const b of (Array.isArray(doc.books) ? doc.books : doc.id ? [doc] : [])) {
    if (b.knowledge_key) BOOK_KEYS.set(b.knowledge_key, b.id);
  }
}
const CASES = [];
for (const f of readdirSync('game/data/quests').filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`game/data/quests/${f}`, 'utf8'));
  for (const q of (doc.quests || [])) {
    for (const r of (q.resolutions || [])) {
      const need = ((r.requires && r.requires.knowledge) || []).filter((k) => BOOK_KEYS.has(k));
      if (!need.length) continue;
      CASES.push({
        quest: q.id, resolution: r.id, method: r.method,
        books: need.map((k) => ({ key: k, id: BOOK_KEYS.get(k) })),
        skills: (r.requires && r.requires.skills) || null,
      });
    }
  }
}
if (!CASES.length) { console.error('no resolution on disk gates on a book knowledge_key: nothing to measure.'); process.exit(1); }

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate((CASES) => {
  const H = window.__HARNESS;
  const rows = [];

  const resolutionOf = (questId, resId) => {
    const st = H.questResolutions(questId);
    const list = Array.isArray(st) ? st : (st && st.resolutions) || [];
    return list.find((r) => r.id === resId) || null;
  };

  for (const c of CASES) {
    const row = { quest: c.quest, resolution: c.resolution, method: c.method, books: c.books.map((b) => b.id) };
    try {
      try { H.questOpen(c.quest); } catch (e) { row.open_error = String(e).slice(0, 160); }
      let r = resolutionOf(c.quest, c.resolution);
      if (!r) { row.error = 'resolution not reported by the engine'; rows.push(row); continue; }
      row.why_at_start = (r.why || []).slice();

      // --- draw every bolt EXCEPT the book's.
      // 1. skill floors, read out of the engine's own refusal strings ("root_speech 0/45"), so
      //    the fixture cannot drift away from the data it is standing in for.
      const patch = {};
      for (const w of (r.why || [])) {
        const m = /^([a-z_]+)\s+(-?\d+)\/(\d+)$/.exec(String(w));
        if (m) patch[m[1].replace(/_/g, '-')] = Number(m[3]);
      }
      if (Object.keys(patch).length) { try { H.setSkills(patch); } catch (e) { row.setskills_error = String(e).slice(0, 160); } }
      row.skills_raised = patch;

      // 2. reveals that arrive through channels other than a book.
      r = resolutionOf(c.quest, c.resolution);
      const reveals = [];
      for (const w of (r.why || [])) {
        const m = /^you do not know (\S+)$/.exec(String(w));
        if (m && !/^book_/.test(m[1])) reveals.push(m[1]);
      }
      for (const id of reveals) { try { H.questReveal(c.quest, id); } catch (e) { row.reveal_errors = (row.reveal_errors || []).concat(`${id}: ${String(e).slice(0, 90)}`); } }
      row.reveals_granted = reveals;

      // --- LEG 1: everything but the book.
      r = resolutionOf(c.quest, c.resolution);
      row.without_book = { available: !!r.available, why: (r.why || []).slice() };
      // The fixture is only honest if the ONLY thing left is the book. Say so either way.
      row.only_the_book_remains = (r.why || []).length > 0 && (r.why || []).every((w) => /^you have not learned book_/.test(String(w)));

      // --- LEG 2: read the book, through the same door a player uses.
      for (const b of c.books) { H.openMenu('book', { id: b.id }); try { H.closeMenu(); } catch {} }
      r = resolutionOf(c.quest, c.resolution);
      row.with_book = { available: !!r.available, why: (r.why || []).slice() };

      row.pass = row.without_book.available === false && row.with_book.available === true && row.only_the_book_remains;
    } catch (e) { row.error = String(e).slice(0, 260); }
    rows.push(row);
  }
  return { rows };
}, CASES);

out.page_errors = errors;
out.summary = {
  cases: out.rows.length,
  closed_without_the_book: out.rows.filter((r) => r.without_book && r.without_book.available === false).length,
  open_with_the_book: out.rows.filter((r) => r.with_book && r.with_book.available === true).length,
  fixture_isolated_the_book: out.rows.filter((r) => r.only_the_book_remains).length,
};
const ok = out.rows.length > 0 && out.rows.every((r) => r.pass);
out.verdict = ok ? 'PASS' : 'FAIL';
console.log(JSON.stringify(out, null, 2));
writeJson(args.out || 'reports/w1-library-gates.json', out);
await handle.close();
process.exit(ok ? 0 : 1);
