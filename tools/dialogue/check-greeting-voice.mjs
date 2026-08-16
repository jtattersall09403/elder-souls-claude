#!/usr/bin/env node
// check-greeting-voice.mjs — does a greeting tell you WHICH group is speaking, or just that
// somebody is?
//
// =========================================================================================
// WHY THIS EXISTS
// =========================================================================================
// W1-DIALOGUE-AUTHORING-LEAK round 1 replaced an authoring-instruction leak with a correct but
// anonymous line, and had no instrument that could tell the difference. The round-1 critic did
// it by hand and the numbers were unambiguous: of the **30** shipped lines containing `writ`,
// **25 belonged to RG-LEDGER** — the writ-house clerks, whose own ADDRESS fragment is *"Name,
// and what the writ says under it."* — and the 5 remaining were the new RG-BWC line, its only
// intruder. It transplanted natively into RG-LEDGER, RG-COURT and RG-EMPIRE.
//
// `CLAUDE.md`: *Morrowind wins everywhere outside the fight*, and greetings are how a town
// tells you what it is. A greeting that would sit unchanged in three other factions is doing
// the job of none of them.
//
// =========================================================================================
// THE PREDICATE, AND ITS HONEST LIMIT
// =========================================================================================
// Derived from the shipped file every run, never asserted:
//
//   A token is **`g`-exclusive** if it appears in the greeting lines of reaction group `g` and
//   in NO other group's lines, across all of `game/data/dialogue/greetings.json`.
//
// A guarded slot passes if its line contains at least one `g`-exclusive token. That is a
// necessary condition for "this line could only belong to this group", not a sufficient one —
// **it cannot judge whether a line is any good, and it must not be read as doing so.** It
// catches the specific, measured failure: a replacement whose every content word is common
// property. Whether the writing earns its faction stays a human judgement, and the round-2
// status file records that judgement separately rather than pointing at this exit code.
//
// NEGATIVE CONTROL (`--self-test`, and it runs in the normal pass too): the predicate is
// re-run with round 1's rejected line substituted into the same slot, and this check FAILS if
// that line passes. The instrument must be able to fail on the exact thing that was wrong, or
// it is decoration (`HAZARDS` §31 rule 4 in spirit: the failing direction is written first).
//
// SCOPE, STATED (`HAZARDS` §31 rule 3): only the cells in `GUARDED` are a gate. Every other
// cell is printed as a **census**, so the reader can see how much of the corpus is unguarded
// rather than infer from a green exit that all of it was checked. That census is the honest
// shape of the hole: this piece owns one cell and did not audit the other 299.
//
// Exit codes: 0 pass · 1 a guarded slot has no group-exclusive token · 2 the negative control
// passed the predicate (the instrument cannot fail) · 3 IO/scope.
//
// Usage: node tools/dialogue/check-greeting-voice.mjs [--census]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);

// The cells this piece owns and therefore gates. Adding a cell here is how the gate widens.
const GUARDED = [
  { group: 'RG-BWC', band: 'cold', slot: 3, owner: 'W1-DIALOGUE-AUTHORING-LEAK r2 (P1)' },
];

// Round 1's replacement, kept verbatim as the permanent negative control. It is a correct fix
// (no leak) and an anonymous line, which is precisely the state this check must be able to
// call out.
const REJECTED_R1_LINE = 'The writ says nothing about talk.';

/** Content tokens: lowercase words of 3+ letters, minus a small closed-class stop list. The
 * stop list is short on purpose — an over-long one manufactures exclusivity out of nothing. */
const STOP = new Set(['the', 'and', 'you', 'your', 'for', 'not', 'but', 'are', 'was', 'has', 'have',
  'that', 'this', 'with', 'from', 'they', 'them', 'their', 'his', 'her', 'its', 'our', 'out',
  'about', 'will', 'can', 'all', 'any', 'one', 'two', 'who', 'what', 'when', 'where', 'how',
  'here', 'there', 'now', 'then', 'than', 'too', 'get', 'got', 'let', 'say', 'said', 'take',
  'come', 'want', 'know', 'like', 'make', 'made', 'more', 'some', 'yours', 'mine', 'been', 'were']);

function tokens(line) {
  return (String(line).toLowerCase().match(/[a-z']{3,}/g) || []).filter((w) => !STOP.has(w));
}

function main() {
  const file = path.join(ROOT, 'game/data/dialogue/greetings.json');
  if (!fs.existsSync(file)) { console.error(`FAIL: ${file} does not exist.`); process.exit(3); }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pools = doc.pools || [];
  if (pools.length === 0) { console.error('FAIL: greetings.json has no pools — scope is stale.'); process.exit(3); }

  // token -> Set of groups that use it. Derived from the file, this run.
  const owners = new Map();
  for (const p of pools) {
    for (const l of p.lines) {
      for (const t of tokens(l)) {
        if (!owners.has(t)) owners.set(t, new Set());
        owners.get(t).add(p.reaction_group);
      }
    }
  }
  const exclusiveTo = (g, line) => tokens(line).filter((t) => {
    const s = owners.get(t);
    return s && s.size === 1 && s.has(g);
  });

  const groups = [...new Set(pools.map((p) => p.reaction_group))];
  console.log(`derived from ${file.replace(ROOT + '/', '')}: ${pools.length} cells, `
    + `${pools.reduce((n, p) => n + p.lines.length, 0)} lines, ${groups.length} reaction groups, `
    + `${owners.size} content tokens, ${[...owners.values()].filter((s) => s.size === 1).length} of them exclusive to one group.`);

  // ---- the gate ---------------------------------------------------------------------------
  let failed = 0;
  console.log(`\nGATED CELLS (${GUARDED.length} of ${pools.length} — everything else is census only):`);
  for (const g of GUARDED) {
    const cells = pools.filter((p) => p.reaction_group === g.group && p.disposition_band === g.band);
    if (cells.length === 0) { console.log(`  FAIL ${g.group}/${g.band}: cell not found`); failed++; continue; }
    for (const c of cells) {
      const line = c.lines[g.slot];
      const ex = exclusiveTo(g.group, line);
      const ok = ex.length > 0;
      if (!ok) failed++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${g.group}/${g.band}[${g.slot}] (${c.player_race_class}) `
        + `exclusive tokens: ${ex.length ? ex.join(', ') : '(NONE — this line is common property)'}`);
      console.log(`         ${JSON.stringify(line)}`);
    }
  }

  // ---- the negative control ----------------------------------------------------------------
  const bwcCold = pools.find((p) => p.reaction_group === 'RG-BWC' && p.disposition_band === 'cold');
  const r1Ex = bwcCold ? exclusiveTo('RG-BWC', REJECTED_R1_LINE) : [];
  console.log(`\nNEGATIVE CONTROL — round 1's rejected line ${JSON.stringify(REJECTED_R1_LINE)}`);
  console.log(`  RG-BWC-exclusive tokens in it: ${r1Ex.length ? r1Ex.join(', ') : '(none)'}`);
  const writOwners = owners.get('writ');
  console.log(`  who uses the word "writ" in the shipped file: ${writOwners ? [...writOwners].sort().join(', ') : '(nobody)'}`);
  if (r1Ex.length > 0) {
    console.log('\nFAIL (negative control): the predicate accepts the line the critic rejected, so');
    console.log('it cannot distinguish a faction voice from an anonymous one. Repair the predicate');
    console.log('before trusting any pass above.');
    process.exit(2);
  }
  console.log('  -> correctly rejected: every content word in it is shared with another group.');

  // ---- census -------------------------------------------------------------------------------
  if (argv.includes('--census')) {
    console.log('\nCENSUS (not a gate) — slots per group whose line carries a group-exclusive token:');
    for (const g of groups) {
      const gp = pools.filter((p) => p.reaction_group === g);
      let hit = 0; let tot = 0;
      for (const p of gp) for (const l of p.lines) { tot++; if (exclusiveTo(g, l).length) hit++; }
      console.log(`  ${g.padEnd(12)} ${String(hit).padStart(4)} / ${tot}`);
    }
  } else {
    console.log('\n(run with --census for the per-group table of how much of the corpus is unguarded)');
  }

  if (failed) {
    console.log(`\nFAIL: ${failed} guarded slot(s) carry no token exclusive to their reaction group.`);
    console.log('A greeting is how a town tells you what it is; this one would sit unchanged in');
    console.log('another faction. Name a referent that belongs to this group and nobody else.');
    process.exit(1);
  }
  console.log('\nPASS: every guarded slot names something only its own group says.');
  process.exit(0);
}

main();
