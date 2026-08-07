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
