#!/usr/bin/env node
// Every data file the game's index references must exist.
//
// This exists because commit 65275dc deleted game/data/dialogue/topics/thorn.json while
// game/data/index.json still listed it, and the game stopped booting. Nothing caught it:
// the build has no compile step, and the failure only surfaces when something loads the
// index at runtime. Two separate critics lost a round to it and had to measure in
// throwaway worktrees pinned to an older commit — which is worse than a broken build,
// because their verdicts then describe a version of the game that no longer exists.
//
// Run: node tools/check-data.mjs   (wired into .githooks/pre-commit)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const INDEX = join(ROOT, 'game', 'data', 'index.json');

if (!existsSync(INDEX)) {
  console.error('check-data: game/data/index.json is missing');
  process.exit(1);
}

let idx;
try { idx = JSON.parse(readFileSync(INDEX, 'utf8')); }
catch (e) { console.error('check-data: game/data/index.json is not valid JSON —', e.message); process.exit(1); }

// The index nests differently in different sections, so collect every string that looks
// like a data path rather than assuming a shape that will drift.
const refs = [...new Set([...JSON.stringify(idx).matchAll(/"([^"]*\.json)"/g)].map(m => m[1]))];
const missing = refs.filter(r => !existsSync(join(ROOT, 'game', 'data', r)));

if (missing.length) {
  console.error(`check-data: ${missing.length} of ${refs.length} indexed data file(s) do not exist:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('\nThe game will not boot. Either restore the file or remove its entry from');
  console.error('game/data/index.json — do not commit the index and the tree out of step.');
  console.error('\nIf the file is tracked and something deleted it:');
  for (const m of missing) console.error(`  git checkout HEAD -- game/data/${m}`);
  console.error('\nDeleting an indexed file to make a probe run is not a fix — it breaks the');
  console.error('build for every other agent. Restore it, or remove the index entry and say so.');
  process.exit(1);
}

console.log(`check-data: ${refs.length} indexed data files, all present.`);
