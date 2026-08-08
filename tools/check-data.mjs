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
// The two soul ledgers must agree.
//
// `game/data/combat/enemies/*.json` `souls` is what a kill actually pays —
// `game/src/sim/souls.js awardFor()` reads it and nothing else. `game/data/world/
// population-posts.json` caches a precomputed roll-up of the same quantity, which
// `game/src/world/population.js report()` publishes as `souls_total`. On 2026-08-08 the
// first was re-anchored and the second was not regenerated, so the world published 16,335
// souls where the statblocks paid 10,679 — +53% on every derived row, and a crossing
// headline of "level 5" for a road that pays level 3 — for a whole day, because NOTHING IN
// THE TREE READ BOTH FILES. (`W1-SOULS-r3.md` §2.1.)
//
// It runs here rather than in a constructor (RULES 14) and here rather than in its own
// forgettable command, because `.githooks/pre-commit` already runs check-data on every
// commit that touches `game/data/` — which is every commit that can cause the drift.
// Armed only after the regeneration that made it silent (RULES 13).
//
// Standalone, with the row-by-row detail and the falsifiability arm:
//   node tools/check-souls-world.mjs [--verbose] [--json <path>] [--self-break]
// And the one line that answers "what is the world worth today":
//   node tools/check-souls-world.mjs --totals
{
  const souls = join(ROOT, 'tools', 'check-souls-world.mjs');
  if (existsSync(souls)) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [souls], { encoding: 'utf8' });
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) {
      process.stderr.write(r.stderr || '');
      console.error('\ncheck-data: the world\'s cached soul totals do not match the statblocks that pay.');
      console.error('Regenerate the cache — never hand-edit it:  node tools/world/build-population.mjs --write');
      process.exit(1);
    }
  } else {
    console.error('check-data: tools/check-souls-world.mjs is missing — the soul-ledger reconciliation is NOT running.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// A LIVE OBJECT must not come back from a save as a plain one.
//
// `save/fight.js`'s SKIP list omitted `ai`, so the save serialised the live `SoulsAI` and the
// load assigned the plain object back over the instance. The next fixed step threw
// `this.ai.step is not a function` and killed every stepping probe in the project — while
// boot-check stayed green, because boot does not step. Every agent here boot-checks before it
// measures, so that was not one agent's problem (RULES 13).
//
// It runs here, over the real classes with no browser and no engine (~100 ms), because
// .githooks/pre-commit already runs check-data on every commit that touches game/ data, and
// because rule 14 says content and shape integrity belong in a check rather than in a
// constructor. Armed only after being shown BOTH ways: silent on the repaired tree, and 15
// findings when run against the pre-fix source at HEAD~ — including five frame stamps that
// were never being rebased and that nobody had noticed.
//
// Standalone, with the per-assertion detail and the falsifiability arm:
//   node tools/check-save-shape.mjs [--verbose]
//   node tools/check-save-shape.mjs --self-break
{
  const shape = join(ROOT, 'tools', 'check-save-shape.mjs');
  if (existsSync(shape)) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [shape], { encoding: 'utf8' });
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) {
      process.stderr.write(r.stderr || '');
      console.error('\ncheck-data: a live object does not survive the save/load round trip.');
      console.error('This does not fail at the load. It fails on the NEXT FIXED STEP, in whoever');
      console.error('happens to be measuring, with an error about the caller and not about the save.');
      process.exit(1);
    }
  } else {
    console.error('check-data: tools/check-save-shape.mjs is missing — the save round trip is NOT being shape-checked.');
    process.exit(1);
  }
}

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

// ---------------------------------------------------------------------------
// AR-3: a faction a player can JOIN must reach the guard. W1-FACTIONS round 3.
//
// `Engine.syncFactionStandings()` walks `sanction.json`'s `faction_law_factor.standing_ids` —
// quest-book faction id -> the key `standingKey()` tests — and that is the entire crossing
// between eighteen quests of faction fiction and whether a guard in Gideon arrests you sooner.
// The map had seven entries. FOUR named factions that appear in zero quest files and have no
// `joins_faction` anywhere in the build, and `the_imperial_assize` — eighteen quests, ending
// with a court's seal — was not in it at all. So a third of the faction content crossed the
// seam nowhere, and the file's `spread_claim` counted rows no player can stand in.
//
// Nothing caught it because nothing checked it. Three assertions, and each is a class:
//
//   A. every faction the quest book lets you JOIN has a standing_ids entry;
//   B. every standing_ids entry names a faction you can join, and a row that exists;
//   C. `standingKey()` can actually return every row of the table — a row nothing can select
//      is priced, published in the spread, and dead.
//
// Plus: the published spread is RECOMPUTED here from the table and the join paths, so a claim
// cannot drift away from the data again.
{
  const SANCTION = join(ROOT, 'game', 'data', 'crime', 'sanction.json');
  const QDIR = join(ROOT, 'game', 'data', 'quests');
  if (existsSync(SANCTION) && existsSync(QDIR)) {
    let doc = null;
    try { doc = JSON.parse(readFileSync(SANCTION, 'utf8')); } catch { /* shape checked elsewhere */ }
    const flf = doc && doc.faction_law_factor;
    if (flf && Array.isArray(flf.rows)) {
      const bad = [];
      // Every faction id the quest book grants membership in, from anywhere in any quest file.
      const joinable = new Set();
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const x of o) walk(x); return; }
        if (Array.isArray(o.joins_faction)) for (const f of o.joins_faction) joinable.add(f);
        for (const v of Object.values(o)) walk(v);
      };
      for (const f of readdirSync(QDIR).filter((f) => f.endsWith('.json') && f !== 'hooks.json')) {
        try { walk(JSON.parse(readFileSync(join(QDIR, f), 'utf8'))); } catch { /* check-quests owns JSON validity */ }
      }
      const ids = flf.standing_ids || {};
      const dead = flf.standing_ids_unreachable || {};
      const mapped = Object.keys(ids).filter((k) => !k.startsWith('_'));
      const rowKeys = new Set(flf.rows.map((r) => r.standing));

      // A. joinable -> mapped
      for (const f of [...joinable].sort()) {
        if (!mapped.includes(f)) {
          bad.push(`${f} can be JOINED by a quest resolution but has no faction_law_factor.standing_ids entry — the whole line crosses to the crime system nowhere. Add a standing key and a row, or say in standing_ids_unreachable why it does not deserve one.`);
        }
      }
      // B. mapped -> joinable, and mapped -> a row that exists
      for (const f of mapped) {
        if (!joinable.has(f)) {
          bad.push(`standing_ids maps ${f}, which no quest resolution joins — Engine.syncFactionStandings() can never write its standing. Move it to standing_ids_unreachable or give it a join path.`);
        }
        const key = ids[f];
        if (![...rowKeys].some((k) => k.split(':')[0] === String(key).split(':')[0])) {
          bad.push(`standing_ids maps ${f} -> "${key}", for which faction_law_factor.rows has no row.`);
        }
      }
      for (const f of Object.keys(dead).filter((k) => !k.startsWith('_'))) {
        if (joinable.has(f)) bad.push(`${f} is listed in standing_ids_unreachable but a quest resolution DOES join it — move it back into standing_ids.`);
      }

      // C. every row must be selectable by standingKey().
      try {
        const { standingKey } = await import('../game/src/sim/crime/sanction.js');
        const reachableKeys = new Set();
        for (const r of flf.rows) {
          if (r.standing === 'none') { reachableKeys.add('none'); continue; }
          const [fac, band] = String(r.standing).split(':');
          const rank = /^\d/.test(band || '') ? Number(String(band).match(/\d+/)[0]) : 1;
          const got = standingKey({ [fac]: /4\+|3\+/.test(band || '') ? rank + 1 : rank });
          if (got === r.standing) reachableKeys.add(r.standing);
          else bad.push(`faction_law_factor row "${r.standing}" is priced but standingKey() never returns it (it returned "${got}") — nothing can select this row.`);
        }
        // The published spread, recomputed. Reachable = rows whose faction is in standing_ids.
        const liveFacs = new Set(mapped.map((f) => String(ids[f]).split(':')[0]));
        const all = flf.rows.map((r) => r.imperial_law).filter((x) => typeof x === 'number');
        const live = flf.rows.filter((r) => r.standing === 'none' || liveFacs.has(String(r.standing).split(':')[0])).map((r) => r.imperial_law);
        const spread = (xs) => Math.round((Math.max(...xs) / Math.min(...xs)) * 100) / 100;
        const claim = flf.spread_claim;
        const declared = (claim && typeof claim === 'object') ? claim.over_all_rows : claim;
        const reach = (claim && typeof claim === 'object') ? claim.reachable_by_play : null;
        const near = (a, b) => a != null && Math.abs(a - b) <= 0.02;
        if (!near(declared, spread(all))) bad.push(`faction_law_factor.spread_claim.over_all_rows says ${declared}; the table computes ${spread(all)}.`);
        if (reach == null) bad.push('faction_law_factor.spread_claim declares no reachable_by_play figure. A spread over rows nobody can stand in is not a claim about the shipped game.');
        else if (!near(reach, spread(live))) bad.push(`faction_law_factor.spread_claim.reachable_by_play says ${reach}; the rows a player can actually reach compute ${spread(live)}.`);
        if (!bad.length) {
          console.log(`check-data: faction_law_factor — ${mapped.length} joinable factions mapped, ${reachableKeys.size}/${flf.rows.length} rows selectable, spread ${spread(all)}x declared / ${spread(live)}x reachable.`);
        }
      } catch (e) {
        bad.push(`could not import standingKey() to check row selectability — ${e.message}`);
      }

      if (bad.length) {
        console.error(`check-data: ${bad.length} problem(s) in game/data/crime/sanction.json faction_law_factor:`);
        for (const b of bad) console.error(`  ${b}`);
        console.error('\nThis table is the ONLY crossing between a faction questline and whether a guard');
        console.error('arrests you sooner (AR-3). A faction that is missing from it has no effect on the');
        console.error('world outside its own journal, however many quests it ships.');
        process.exit(1);
      }
    }
  }
}
