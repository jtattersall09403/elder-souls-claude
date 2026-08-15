#!/usr/bin/env node
/**
 * check-race-art.mjs — every race string in the shipped NPC data must have a declared body plan.
 *
 * WHY THIS IS A CHECK AND NOT A THROW. `game/src/render/lib/race-art.js` returns `humanoid` for an
 * unmapped race rather than throwing, because a throwing renderer is not one agent's problem, it is
 * everyone's (`RULES.md` 13/14). The fail-closed half lives here.
 *
 * WHAT IT WOULD HAVE CAUGHT. Run against the tree before W1-F10 round 2 it reports `argonian` (181
 * records) and `naga` (2) as drawn by a predicate that named neither, i.e. 183 of 408 NPCs on the
 * wrong body plan. That is the defect `W1-F10-CHARACTERS` §7 fix 1 names.
 *
 * MAKE IT FAIL ON PURPOSE (`RULES.md` 4):
 *   node tools/check-race-art.mjs --self-test
 * injects a race string no map carries and asserts this tool exits non-zero on it. A check that
 * has never been seen to go red is not evidence.
 *
 *   node tools/check-race-art.mjs            # exit 0 iff every shipped race string is declared
 *   node tools/check-race-art.mjs --json     # machine-readable census, incl. npcs_per_art_family
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const argv = process.argv.slice(2);
const asJSON = argv.includes('--json');
const selfTest = argv.includes('--self-test');

const { artFamilyForRace, isDeclaredRace, knownRaceStrings } =
  await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);

const dir = join(ROOT, 'game/data/npcs');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const byRace = new Map();
let total = 0;
for (const f of files) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const items = Array.isArray(d) ? d : (d.npcs || d.records || []);
  for (const n of items) {
    total++;
    const r = n.race == null ? '(absent)' : String(n.race);
    byRace.set(r, (byRace.get(r) || 0) + 1);
  }
}

const undeclared = [...byRace.entries()].filter(([r]) => !isDeclaredRace(r)).sort((a, b) => b[1] - a[1]);
const perFamily = {};
for (const [r, n] of byRace) {
  const fam = artFamilyForRace(r === '(absent)' ? null : r);
  perFamily[fam] = (perFamily[fam] || 0) + n;
}

const out = {
  tool: 'check-race-art',
  npc_files: files.length,
  npc_records: total,
  race_strings_in_use: Object.fromEntries([...byRace.entries()].sort((a, b) => b[1] - a[1])),
  declared_race_strings: knownRaceStrings(),
  npcs_per_art_family: perFamily,
  undeclared: Object.fromEntries(undeclared),
  ok: undeclared.length === 0,
};

if (selfTest) {
  // Break it on purpose: a string no map carries must be reported, and must be reported with its
  // count, or this tool is decoration.
  const bogus = 'not-a-race-' + Date.now();
  const declared = isDeclaredRace(bogus);
  const fam = artFamilyForRace(bogus);
  const armWouldFail = !declared;
  console.log(`self-test: isDeclaredRace('${bogus}') = ${declared} (want false)`);
  console.log(`self-test: artFamilyForRace('${bogus}') = '${fam}' (want 'humanoid' — degrade, never throw)`);
  console.log(`self-test: the failing arm ${armWouldFail ? 'GOES RED' : 'DOES NOT GO RED'}`);
  if (!armWouldFail || fam !== 'humanoid') { console.error('self-test FAILED'); process.exit(1); }
  console.log('self-test passed: the check can fail, and the renderer degrades instead of throwing.');
  process.exit(0);
}

if (asJSON) { console.log(JSON.stringify(out, null, 2)); process.exit(out.ok ? 0 : 1); }

console.log(`check-race-art: ${total} NPC records over ${files.length} files`);
for (const [r, n] of [...byRace.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(r).padEnd(12)} ${String(n).padStart(4)}  -> ${artFamilyForRace(r === '(absent)' ? null : r)}${isDeclaredRace(r) ? '' : '   *** UNDECLARED ***'}`);
}
console.log(`  npcs_per_art_family: ${JSON.stringify(perFamily)}`);
if (!out.ok) {
  console.error(`\nFAIL: ${undeclared.length} race string(s) are drawn by a default rather than a decision: ${undeclared.map(([r, n]) => `${r} (${n})`).join(', ')}`);
  console.error('Add them to RACE_ART in game/src/render/lib/race-art.js, with a reason.');
  process.exit(1);
}
console.log('\nOK: every race string in the shipped data has a declared body plan.');
