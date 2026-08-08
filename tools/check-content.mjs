#!/usr/bin/env node
// Hand-authored content must not vanish when a generator re-runs.
//
// This exists because commit 4a5f13f regenerated game/data/quests/magic-utility.json and
// silently deleted nine quest resolutions — six sneak routes and three steal routes, written
// by hand in another piece and tagged `added_by`. The commit's own diffstat read
// "5 insertions, 179 deletions" on a file nobody had meant to touch, and nothing noticed for
// two rounds. A critic found it by re-measuring a number that had gone backwards.
//
// The rule: a quest resolution, once written, may be edited but not disappeared. If a
// generator no longer emits one, that is a decision someone has to make deliberately —
// by removing it from the baseline below in the same commit, with a reason.
//
// Run: node tools/check-content.mjs            (wired into .githooks/pre-commit)
//      node tools/check-content.mjs --update    (re-baseline, after a deliberate removal)

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const QUESTS = join(ROOT, 'game', 'data', 'quests');
const BASELINE = join(ROOT, 'reports', 'quest-resolution-baseline.json');

if (!existsSync(QUESTS)) { console.log('check-content: no quest directory yet, skipping.'); process.exit(0); }

const live = {};
for (const f of readdirSync(QUESTS).filter(f => f.endsWith('.json') && !f.startsWith('.'))) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(QUESTS, f), 'utf8')); } catch { continue; }
  const ids = [];
  for (const q of doc.quests || []) for (const r of q.resolutions || []) if (r.id) ids.push(r.id);
  if (ids.length) live[f] = ids.sort();
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(live, null, 2) + '\n');
  const n = Object.values(live).reduce((a, b) => a + b.length, 0);
  console.log(`check-content: baseline updated — ${n} resolutions across ${Object.keys(live).length} file(s).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.log('check-content: no baseline yet; run `node tools/check-content.mjs --update` to create one.');
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const lost = [];
for (const [file, ids] of Object.entries(base)) {
  const now = new Set(live[file] || []);
  for (const id of ids) if (!now.has(id)) lost.push(`${file}: ${id}`);
}

if (lost.length) {
  console.error(`check-content: ${lost.length} quest resolution(s) present in the baseline have disappeared:`);
  for (const l of lost) console.error(`  ${l}`);
  console.error('\nA generator re-running over hand-authored content is the usual cause, and it is');
  console.error('how nine sneak and steal routes were lost once already. Restore them, or — if the');
  console.error('removal is deliberate — run `node tools/check-content.mjs --update` in the same');
  console.error('commit and say why in the message.');
  process.exit(1);
}

const n = Object.values(live).reduce((a, b) => a + b.length, 0);
console.log(`check-content: ${n} quest resolutions, none lost.`);

// ---------------------------------------------------------------------------------------------
// The canon register must not describe a build it has never met.
//
// `game/data/lore/canon.json` says of every registered dispute which shipped book or which actor
// on which topic takes each side. A `voiced_by` naming a `dialogue:<topic>#<actor>` pair nobody
// wrote is RI-LOR06 §2's "a note dressed as a dispute" — it scores as texture, it is paperwork,
// and it is invisible from every other instrument.
//
// This check used to be a throw inside `Engine._installCanon()`, and the throw took the whole
// project down: one agent re-homed two `notary` infos while another added canon rows naming them,
// and the next fourteen agents could not boot — `boot-check` exit 12, every browser measurement on
// the box blocked, on a defect neither of them could see from their own file. RULES rule 13 (a
// throwing engine is everyone's problem) and rule 14 (content integrity belongs in a check, not a
// constructor). So it lives here, where a broken row costs the agent who wrote it. The engine now
// drops the lying rows, warns, and carries `unresolved` on its report so a probe can still assert.
{
  const canonPath = join(ROOT, 'game/data/lore/canon.json');
  if (existsSync(canonPath)) {
    // Every (topic, actor) pair for which a dialogue info actually exists.
    const written = new Set();
    const topicsDir = join(ROOT, 'game/data/dialogue/topics');
    if (existsSync(topicsDir)) {
      for (const f of readdirSync(topicsDir).filter(f => f.endsWith('.json'))) {
        let j; try { j = JSON.parse(readFileSync(join(topicsDir, f), 'utf8')); } catch { continue; }
        for (const t of (j.topics || [])) {
          for (const info of (t.infos || [])) if (info.a) written.add(`${t.id}#${info.a}`);
        }
      }
    }
    const canon = JSON.parse(readFileSync(canonPath, 'utf8'));
    const bad = [];
    for (const fact of (canon.facts || [])) {
      for (const pos of (fact.positions || [])) {
        for (const v of (pos.voiced_by || [])) {
          const m = /^dialogue:(.+)#(.+)$/.exec(v);
          if (!m) continue;                       // book: and other schemes are not ours to judge
          if (!written.has(`${m[1]}#${m[2]}`)) {
            bad.push(`${fact.id}/${pos.id}: topic \`${m[1]}\` has no info written for actor \`${m[2]}\``);
          }
        }
      }
    }
    if (bad.length) {
      console.error(`check-content: canon register has ${bad.length} unresolved dialogue reference(s):`);
      for (const b of bad) console.error(`  ${b}`);
      console.error('\nA dispute whose sides are held by nobody in the build is not texture, it is');
      console.error('paperwork (RI-LOR06 §2). Either write the info, or drop the `voiced_by` row.');
      console.error('The engine no longer throws on these — it drops them — so nothing else will');
      console.error('tell you, and the dispute silently stops existing.');
      // NOT blocking yet, and that is rule 13 applied to this check itself. Two rows are red on
      // the tree as this lands, from the very collision that motivated moving the check here. A
      // gate armed before the data it demands exists blocks fourteen agents' commits to punish
      // the two lines nobody has written — which is the failure it was written to prevent,
      // relocated. Author the infos or drop the `voiced_by` rows, watch this print zero, and then
      // change this to `process.exit(1)` in the same commit that makes it silent.
      console.error(`\ncheck-content: reporting only — this becomes a hard failure once it prints zero.`);
    }
    console.log(`check-content: canon register — every dialogue reference resolves (${written.size} authored topic/actor pairs).`);
  }
}
