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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// An NPC's `settlement` must be a place the world can answer for.
//
// This exists because NPC records kept acquiring settlement strings that are not
// settlements. `widow-ineel` and `herbwife-ossa` said `thornmarsh` (the stilt district of
// Thorn, not a town); `rootlands-keeper`, `rootlands-drowned-speaker` and
// `rootlands-band-elder` said `rootlands` (not a town, and not a region either — the world
// has `western-rootlands` and `eastern-rootlands`). Each was found by hand, a round apart,
// and nothing caught the class.
//
// WHY IT MATTERS, and why a junk value is worse than no value. Two consumers key on this
// string — `RumourBook.pick()` for what the town is saying and `RoadBook.forNpc()` for the
// way out of it — and both are written as:
//
//     npc.settlement || <the settlement the PLAYER is standing in>
//
// That fallback is deliberate: an NPC spawned from a state file usually has no settlement of
// its own, and without it four people stood in Soulrest and not one could tell you the road
// out. A junk string is not caught by the fallback, it DEFEATS it — `"rootlands" || fallback`
// is `"rootlands"`, every rumour row filters out on `r.settlement !== settlement`, the road
// book's `bySettlement` lookup misses, and the person silently answers nothing. So
// `settlement: null` is fine and must stay fine; a string that resolves to nothing is not.
//
// THE KEY SPACE is settlement records UNION rumour buckets, not the settlements directory
// alone. `tidewrack` is the opening prison barge: no settlement record and no road out of it
// (correctly — there is no road off a barge), but it does have rumours, so the three people
// aboard can answer for where they are. That is the bar this checks: can this person answer
// for the place they claim?
const NPCS = join(ROOT, 'game', 'data', 'npcs');
if (existsSync(NPCS)) {
  const known = new Set();
  const SETTLEMENTS = join(ROOT, 'game', 'data', 'world', 'settlements');
  if (existsSync(SETTLEMENTS)) {
    for (const f of readdirSync(SETTLEMENTS)) if (f.endsWith('.json')) known.add(f.slice(0, -5));
  }
  const RUMOURS = join(ROOT, 'game', 'data', 'dialogue', 'rumours.json');
  if (existsSync(RUMOURS)) {
    try {
      const doc = JSON.parse(readFileSync(RUMOURS, 'utf8'));
      for (const k of Object.keys(doc.rumours || {})) known.add(k);
      for (const r of doc.race_gated || []) if (r && r.settlement) known.add(r.settlement);
    } catch { /* rumours.json shape is checked elsewhere; do not fail the build on it here */ }
  }

  // Only assert once there is a key space to assert against. A fail-closed check that runs
  // before its data exists takes the engine down for every other agent, which has happened
  // four times in this project; an empty `known` means the world data is mid-move, not that
  // every NPC is wrong.
  if (known.size) {
    const bad = [];
    let seen = 0;
    for (const f of readdirSync(NPCS).filter(f => f.endsWith('.json') && !f.startsWith('.'))) {
      let doc;
      try { doc = JSON.parse(readFileSync(join(NPCS, f), 'utf8')); } catch { continue; }
      for (const n of (Array.isArray(doc) ? doc : (doc.npcs || []))) {
        if (!n || typeof n !== 'object') continue;
        seen++;
        if (n.settlement == null) continue;   // deliberate, and handled by the fallback
        if (!known.has(n.settlement)) bad.push(`${f}: ${n.id || '(no id)'} -> "${n.settlement}"`);
      }
    }

    if (bad.length) {
      console.error(`check-data: ${bad.length} of ${seen} NPC record(s) name a settlement that does not exist:`);
      for (const b of bad) console.error(`  ${b}`);
      console.error(`\nKnown settlements: ${[...known].sort().join(', ')}`);
      console.error('\nRumourBook.pick() and RoadBook.forNpc() both key on this string. A value that');
      console.error('resolves to nothing is worse than none at all: both consumers fall back to the');
      console.error('settlement the PLAYER is standing in when the field is null, and a junk string');
      console.error('defeats that fallback — the NPC can never tell you what the town is saying or');
      console.error('the way out of it, and nothing goes red.');
      console.error('\nUse `null` for someone who belongs to no town (a hermit, a river-band elder, a');
      console.error('roving quest actor) — that is correct and supported. Use a real id otherwise, and');
      console.error('leave a `settlement_note` saying what it was and why it changed.');
      process.exit(1);
    }

    console.log(`check-data: ${seen} NPC records, every settlement resolves (${known.size} known places).`);
  }
}
