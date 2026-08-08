#!/usr/bin/env node
// the two soul ledgers must agree — the world's cached roll-up against the statblocks that pay.
//
// WHY THIS EXISTS. This project kept two totals for the same thing and never once compared them.
//
//   * `game/data/combat/enemies/*.json` `souls` — THE TRUTH. `game/src/sim/souls.js`
//     `awardFor(stat, awardHour)` reads `Engine.data.enemies[e.id].souls` at the moment a body
//     goes alive->dead and adds it to `sim.progression.soulsHeld`. This is the only producer of
//     souls in the build. A kill consults this and nothing else.
//   * `game/data/world/population-posts.json` — A CACHE. `tools/world/build-population.mjs`
//     precomputes `post.souls` per post plus `report.souls`, `report.by_tier`, `report.by_region`
//     and `report.crossing.{souls,level_if_fully_cleared}` by walking
//     `encounters.json` x the statblocks at generation time, and freezes the answer in the file.
//     `game/src/world/population.js report()` sums `p.souls` into `souls_total`, which is what
//     `__HARNESS.populationReport()` hands any probe that asks the world what it is worth.
//
// On 2026-08-08 the first was re-anchored (W1-SOULS round 3 re-derived seven statblocks, e.g.
// `inf_trash` 64->42) and the second was not regenerated. The world file went on publishing
// **16,335** souls for the 267 road bodies where the statblocks paid **10,679** — +53.0% on every
// derived row — and its crossing headline said a full clear of the Stormhold->Lilmoth road reached
// **level 5** where it reached **level 3**. `W1-SOULS-r3.md` §2.1 is the finding; its last sentence
// is the defect: *nothing in the tree reads both files.*
//
// So this reads both. It recomputes every cached figure from `population-posts.json`'s own posts
// x `encounters.json` x the shipped statblocks x `progression/levels.json`, and fails on any drift,
// naming the file and the row. It shares no code with `tools/world/build-population.mjs` (which
// writes the cache) or with `tools/progression/derive-soul-values.mjs` (which owns the values), so
// a bug in either generator cannot hide inside this comparison.
//
// It is NOT the same assertion as `build-population.mjs --check`. That one demands the whole file
// be byte-identical to a fresh generation, so any legitimate model edit turns it red and it cannot
// say which number moved. This one asserts exactly the join between the two ledgers and names the
// rows, which is the thing that was never checked.
//
//   node tools/check-souls-world.mjs                  # the gate. exit 1 on drift.
//   node tools/check-souls-world.mjs --totals         # ONE LINE: what the world is worth today.
//   node tools/check-souls-world.mjs --verbose        # every row, agreeing or not
//   node tools/check-souls-world.mjs --json <path>    # machine-readable report
//   node tools/check-souls-world.mjs --self-break     # RULES 4: prove this instrument can go red
//
// Wired into `tools/check-data.mjs`, which `.githooks/pre-commit` runs on every commit that
// touches `game/data/`. Nobody has to remember it.
//
// CAVEAT, declared. A few encounter templates carry members with `absent_when_flag` (a quest can
// remove bodies from a post). Both the generator and this checker count the DEFAULT composition —
// every member, flag ignored — because that is what the cached figure means. The templates that
// have a conditional member are listed under `--verbose` so the caveat is checkable, not assumed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const PATHS = {
  posts: 'game/data/world/population-posts.json',
  encounters: 'game/data/world/encounters.json',
  levels: 'game/data/progression/levels.json',
  statblocks: 'game/data/combat/enemies',
};

function readJSON(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return { __missing: rel };
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { return { __bad: `${rel}: ${e.message}` }; }
}

// ---- ABSENCE-REPORTER. If the system this measures is not here, say so and exit non-zero. -----
const fatal = [];
const popDoc = readJSON(PATHS.posts);
const encDoc = readJSON(PATHS.encounters);
const lvlDoc = readJSON(PATHS.levels);
for (const [k, d] of [['posts', popDoc], ['encounters', encDoc], ['levels', lvlDoc]]) {
  if (d.__missing) fatal.push(`${PATHS[k]} does not exist — there is no ledger to reconcile.`);
  if (d.__bad) fatal.push(d.__bad);
}
if (!fatal.length) {
  if (!Array.isArray(popDoc.posts)) fatal.push(`${PATHS.posts} has no \`posts\` array.`);
  if (!popDoc.report) fatal.push(`${PATHS.posts} has no \`report\` block — nothing caches a total.`);
  if (!Array.isArray(encDoc.encounters)) fatal.push(`${PATHS.encounters} has no \`encounters\` array.`);
  if (!Array.isArray(lvlDoc.levels)) fatal.push(`${PATHS.levels} has no \`levels\` array.`);
}
if (fatal.length) {
  console.error('check-souls-world: cannot run.');
  for (const f of fatal) console.error(`  ${f}`);
  process.exit(2);
}

// ---- the statblock ledger — the one a kill consults -------------------------------------------
const sbCache = new Map();
const sbMissing = new Set();
function soulsOfStatblock(id) {
  if (sbCache.has(id)) return sbCache.get(id);
  const p = join(ROOT, PATHS.statblocks, `${id}.json`);
  let v = null;
  if (existsSync(p)) {
    try { const j = JSON.parse(readFileSync(p, 'utf8')); v = Number.isFinite(j.souls) ? j.souls : 0; }
    catch { v = null; }
  }
  if (v === null) sbMissing.add(id);
  sbCache.set(id, v);
  return v;
}
// --self-break perturbs the SOURCE ledger, which must make the comparison red.
const BREAK = has('--self-break');
if (BREAK) {
  const target = val('--break-statblock', 'inf_trash');
  const real = soulsOfStatblock(target);
  if (real === null) { console.error(`check-souls-world --self-break: no statblock ${target}`); process.exit(2); }
  sbCache.set(target, real + 1);
}

const templates = new Map(encDoc.encounters.map((e) => [e.id, e]));
const conditional = encDoc.encounters
  .filter((e) => (e.members || []).some((m) => m.absent_when_flag))
  .map((e) => e.id);

function templateSouls(id) {
  const t = templates.get(id);
  if (!t) return null;
  let n = 0;
  for (const m of t.members || []) {
    const s = soulsOfStatblock(m.statblock);
    if (s === null) return null;
    n += (m.count || 0) * s;
  }
  return n;
}
function templateBodies(id) {
  const t = templates.get(id);
  if (!t) return null;
  return (t.members || []).reduce((a, m) => a + (m.count || 0), 0);
}

// ---- recompute every cached figure, independently ---------------------------------------------
const rows = [];         // { row, cached, computed }
const unknownTemplates = new Set();
let total = 0, totalBodies = 0;
const byTier = {}, byRegion = {};
const CROSSING_LEGS = new Set(popDoc.report.crossing?.legs || []);
let crossSouls = 0, crossBodies = 0;

for (const q of popDoc.posts) {
  if (!templates.has(q.encounter)) { unknownTemplates.add(q.encounter); continue; }
  const s = templateSouls(q.encounter);
  const b = templateBodies(q.encounter);
  if (s === null) continue;
  rows.push({ row: `posts[${q.id}].souls  (${q.encounter})`, cached: q.souls, computed: s, kind: 'post' });
  rows.push({ row: `posts[${q.id}].bodies (${q.encounter})`, cached: q.bodies, computed: b, kind: 'post_bodies' });
  total += s; totalBodies += b;
  (byTier[q.tier] ||= { souls: 0, bodies: 0 }).souls += s;
  byTier[q.tier].bodies += b;
  (byRegion[q.region] ||= { souls: 0, bodies: 0 }).souls += s;
  byRegion[q.region].bodies += b;
  if (CROSSING_LEGS.has(q.leg)) { crossSouls += s; crossBodies += b; }
}

// the level a full clear of the crossing buys, off RI-PRG01's shipped curve
function levelForSouls(t) {
  let lvl = 1;
  for (const r of lvlDoc.levels) { if (r.cumulative > t) break; lvl = r.level; }
  return lvl;
}

const rep = popDoc.report;
rows.push({ row: 'report.souls', cached: rep.souls, computed: total, kind: 'headline' });
rows.push({ row: 'report.bodies', cached: rep.bodies, computed: totalBodies, kind: 'headline' });
for (const [t, v] of Object.entries(byTier)) {
  rows.push({ row: `report.by_tier.${t}.souls`, cached: rep.by_tier?.[t]?.souls, computed: v.souls, kind: 'tier' });
}
for (const [r, v] of Object.entries(byRegion)) {
  rows.push({ row: `report.by_region.${r}.souls`, cached: rep.by_region?.[r]?.souls, computed: v.souls, kind: 'region' });
}
if (rep.crossing) {
  rows.push({ row: 'report.crossing.souls', cached: rep.crossing.souls, computed: crossSouls, kind: 'crossing' });
  rows.push({ row: 'report.crossing.bodies', cached: rep.crossing.bodies, computed: crossBodies, kind: 'crossing' });
  rows.push({
    row: 'report.crossing.level_if_fully_cleared',
    cached: rep.crossing.level_if_fully_cleared, computed: levelForSouls(crossSouls), kind: 'crossing',
  });
}

const drift = rows.filter((r) => r.cached !== r.computed);

// ---- --totals: the one line the orchestrator needs --------------------------------------------
if (has('--totals')) {
  const fresh = drift.length === 0;
  console.log(
    `souls (from the statblocks, ${totalBodies} placed bodies over ${popDoc.posts.length} posts): ` +
    `${total}  |  crossing ${crossSouls} -> level ${levelForSouls(crossSouls)}  |  ` +
    `population-posts.json cache ${fresh ? 'AGREES' : `is STALE at ${rep.souls} — run tools/world/build-population.mjs --write`}`
  );
  process.exit(fresh ? 0 : 1);
}

// ---- report ------------------------------------------------------------------------------------
const report = {
  tool: 'tools/check-souls-world.mjs',
  ran_at: new Date().toISOString(),
  self_break: BREAK,
  inputs: PATHS,
  statblock_ledger: Object.fromEntries([...sbCache.entries()].sort()),
  computed: {
    posts: popDoc.posts.length, bodies: totalBodies, souls: total,
    crossing: { souls: crossSouls, bodies: crossBodies, level_if_fully_cleared: levelForSouls(crossSouls) },
    by_tier: byTier, by_region: byRegion,
  },
  cached: {
    posts: rep.posts, bodies: rep.bodies, souls: rep.souls,
    crossing: rep.crossing ? { souls: rep.crossing.souls, bodies: rep.crossing.bodies, level_if_fully_cleared: rep.crossing.level_if_fully_cleared } : null,
  },
  rows_compared: rows.length,
  drift: drift.map((d) => ({ row: d.row, cached: d.cached, computed: d.computed })),
  unknown_templates: [...unknownTemplates],
  missing_statblocks: [...sbMissing],
  templates_with_conditional_members: conditional,
};
if (has('--json')) {
  const out = val('--json');
  writeFileSync(join(ROOT, out), JSON.stringify(report, null, 1) + '\n');
  console.log(`check-souls-world: wrote ${out}`);
}

if (has('--verbose')) {
  for (const r of rows) console.log(`  ${r.cached === r.computed ? 'ok  ' : 'DRIFT'} ${r.row}: cached ${r.cached}, statblocks ${r.computed}`);
  if (conditional.length) console.log(`  note: ${conditional.length} template(s) carry an \`absent_when_flag\` member and are counted at full composition: ${conditional.join(', ')}`);
}

let bad = false;
if (unknownTemplates.size) {
  console.error(`check-souls-world: ${unknownTemplates.size} post(s) name an encounter template that does not exist: ${[...unknownTemplates].join(', ')}`);
  bad = true;
}
if (sbMissing.size) {
  console.error(`check-souls-world: ${sbMissing.size} statblock(s) named by an encounter do not exist under ${PATHS.statblocks}/: ${[...sbMissing].join(', ')}`);
  bad = true;
}

if (drift.length) {
  console.error(`check-souls-world: THE TWO SOUL LEDGERS DISAGREE — ${drift.length} of ${rows.length} compared rows.`);
  console.error(`  cache : ${PATHS.posts}`);
  console.error(`  truth : ${PATHS.statblocks}/*.json  (game/src/sim/souls.js awardFor() reads THIS on every kill)`);
  const pct = rep.souls ? Math.round(((rep.souls - total) / (total || 1)) * 1000) / 10 : 0;
  console.error(`  headline: report.souls ${rep.souls} cached vs ${total} paid — ${pct > 0 ? '+' : ''}${pct}%`);
  for (const d of drift.slice(0, 40)) console.error(`  ${d.row}: cached ${d.cached}, statblocks ${d.computed}`);
  if (drift.length > 40) console.error(`  ... and ${drift.length - 40} more (use --verbose)`);
  console.error('');
  console.error('  The statblocks are the truth: a kill pays statblock.souls and never reads the cache.');
  console.error('  Fix by regenerating the cache, never by editing it:');
  console.error('    node tools/world/build-population.mjs --write');
  console.error('  If you meant to change what an enemy is worth, that is the souls economy');
  console.error('  (corpus RI-PRG06 / tools/progression/derive-soul-values.mjs) — regenerate afterwards.');
  bad = true;
}

if (BREAK) {
  // RULES 4: the instrument must be able to go red. Under --self-break the source ledger is
  // perturbed by +1 soul on one statblock, so a checker that actually reads it MUST report drift.
  if (drift.length) {
    console.log(`check-souls-world --self-break: RED as required — ${drift.length} row(s) moved when one statblock's souls changed by 1. The instrument reads the statblocks.`);
    process.exit(0);
  }
  console.error('check-souls-world --self-break: STILL GREEN after perturbing a statblock. This checker does not read the statblock ledger; it is inert. FAIL.');
  process.exit(1);
}

if (bad) process.exit(1);

console.log(
  `check-souls-world: ${rows.length} rows agree. ${popDoc.posts.length} posts, ${totalBodies} bodies, ` +
  `${total} souls; the crossing pays ${crossSouls} -> level ${levelForSouls(crossSouls)}. ` +
  `Cache and statblocks are the same ledger.`
);
