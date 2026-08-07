#!/usr/bin/env node
// derive-soul-values.mjs — the soul value of every shipped enemy, DERIVED from its own
// statblock, and written back into `game/data/combat/enemies/*.json` as a `souls` field.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
//
// `RI-PRG02` §2 specifies two streams of attribute points: one earned by skill use, one BOUGHT
// with souls. The bought stream was implemented (`engine.js _spendSouls()`) and unfundable —
// nothing in `game/src/**` ever added to `soulsHeld` except recovering your own bloodstain, so
// the only way to have souls was to have been handed them by a probe. `sim/souls.js` is the
// source; this tool is where its numbers come from.
//
// The numbers are DERIVED rather than invented. There is exactly ONE anchored constant (`K`) and
// one hand-set table (`TIER_PREMIUM`, and only its `elite` row is exercised by the shipped
// roster). Everything else falls out of fields that already exist on the statblock and that
// somebody else owns: `hp`, `poise`, `armour_rating`, `weapon.attack_rating`, `tier`.
//
// ---------------------------------------------------------------------------------------------
// THE MODEL
// ---------------------------------------------------------------------------------------------
//
//   ehp    = hp x (1 + armour_rating/100) x (1 + poise/200)
//   threat = weapon.attack_rating / 120                       (120 = the roster's modal rating)
//   souls  = round( K x ehp x threat x TIER_PREMIUM[tier] )
//
// `ehp` is "how much fight is in this body": hit points, plus the flat per-hit subtraction
// `armour_rating` applies in `combat/resolve.js mitigate()`, plus the stagger resistance that
// buys the thing extra uninterrupted swings. `threat` is what it does back. Both are read off
// fields the combat piece already owns, so a combat pass that buffs an enemy re-derives its
// soul value here rather than leaving the two silently out of step (RI-PRG06 "how we lose" #2).
//
// PROPS PAY NOTHING. `tier: "prop"`, `archetype: DUMMY|FIXTURE` and `hp >= 99999` are all
// forced to 0. Sixteen of the twenty-three shipped statblocks are camera rigs, material
// samples and training dummies with 99,999 hp; under a mass model an unguarded one of those is
// an infinite soul farm, and the training dummy in particular is hittable by design.
//
// ---------------------------------------------------------------------------------------------
// THE ANCHOR, AND WHAT IT IS NOT
// ---------------------------------------------------------------------------------------------
//
// `K` is fixed by ONE corpus number: `RI-PRG06` §1's region-1 row is **12,665 souls across 93
// enemies = 136.18 souls for the average region-1 kill**. `inf_trash` ("Marsh sentry") is the
// only statblock actually placed in the world (`game/data/world/encounters.json`, both
// encounters) and the lowest-`danger_tier` region it is placed in is `western-rootlands`, the
// province's sole `danger_tier: 1` region. So `inf_trash` IS the average region-1 kill, and
// `K` is whatever makes it worth 136.
//
// This is a PER-KILL anchor and deliberately not a world-total one. RI-PRG06 method 1 wants the
// whole shipped roster summed and run through RI-PRG01's curve to land at L93. The shipped world
// contains **nine placed enemies**, not 576 or 1,230, so that assertion cannot be honestly run
// and this tool does not pretend to run it — it would be a fail-closed assertion landed before
// its data exists. `--check` asserts the two things that ARE true today: every fightable value
// sits inside one of RI-PRG06 §2's bands, and every prop is worth zero.
//
// Run:  node tools/progression/derive-soul-values.mjs            (report only, writes nothing)
//       node tools/progression/derive-soul-values.mjs --write    (write the `souls` field)
//       node tools/progression/derive-soul-values.mjs --check    (assert; exit 1 on failure)
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'game/data/combat/enemies');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);

/** RI-PRG06 §1, region-1 row: 12,665 souls / 93 enemies. */
export const R1_MEAN_KILL = 12665 / 93;
/** The statblock that anchors it — see the header. */
export const ANCHOR_ID = 'inf_trash';
/** The roster's modal `weapon.attack_rating`; makes `threat` 1.0 for an ordinary infantryman. */
export const MODAL_ATTACK_RATING = 120;

/**
 * The one hand-set table in the model, and it is stated as hand-set rather than dressed up.
 *
 * RI-PRG06 §2's own within-region ratios are: miniboss / top-of-trash ~3.9x, boss / top-of-trash
 * ~14.8x, averaged over all six regions. The mass model above already supplies part of that on
 * its own (a champion carries seven times a sentry's hit points), so the premium here is only
 * the residual — the "this is a set-piece" part that mass does not explain. The split cannot be
 * measured, because RI-PRG06's roster is a budget rather than statblocks on disk.
 *
 * Only `elite` is exercised by the shipped roster (`champion_hist_marked`), and 1.6 is chosen so
 * that champion lands at 2,423 — above RI-PRG06's R2 miniboss band (2,000-2,400) and below its
 * R1 boss value (3,000), which is where a named champion belongs. `miniboss` and `boss` are
 * PROVISIONAL and are declared here so that the first statblock carrying either tier gets a
 * number rather than a crash.
 */
export const TIER_PREMIUM = { trash: 1.0, elite: 1.6, miniboss: 2.6, boss: 4.0 };

/** RI-PRG06 §2, the shipped-roster-relevant rows. Used by `--check` only. */
export const PRG06_BANDS = [
  { region: 'R1', trash: [35, 190], miniboss: [700, 900], boss: 3000 },
  { region: 'R2', trash: [140, 520], miniboss: [2000, 2400], boss: 8000 },
  { region: 'R3', trash: [330, 1250], miniboss: [4200, 5200], boss: 20000 },
  { region: 'R4', trash: [760, 2600], miniboss: [9000, 12000], boss: 38000 },
  { region: 'R5', trash: [1200, 4200], miniboss: [13000, 16000], boss: 50000 },
  { region: 'R6', trash: [2100, 6200], miniboss: [20000, 25000], boss: 95000 },
];

export const SOULS_NOTE = 'DERIVED by tools/progression/derive-soul-values.mjs from this statblock\'s own '
  + 'hp/poise/armour_rating/attack_rating/tier — do not hand-edit, re-run the tool (it has a --check mode '
  + 'that fails if the field and the derivation have drifted). Read by game/src/sim/souls.js, which is the '
  + 'ONLY producer of soulsHeld apart from recovering your own bloodstain. RI-PRG06 §3 owns the soul budget, '
  + 'RI-PRG01 owns the curve it is spent on, and seam S15 forbids souls buying anything but a level. Props '
  + 'are zero so a 99,999-hp training dummy is not an infinite farm.';

/** A body that cannot be farmed: camera rigs, material samples, training dummies, fixtures. */
export function isProp(d) {
  return d.tier === 'prop' || d.archetype === 'DUMMY' || d.archetype === 'FIXTURE' || d.hp >= 99999;
}

/** "How much fight is in this body", in raw damage the player has to land. */
export function effectiveHp(d) {
  return d.hp * (1 + (d.armour_rating || 0) / 100) * (1 + (d.poise || 0) / 200);
}

/** What it does back, relative to an ordinary infantryman. */
export function threatFactor(d) {
  return ((d.weapon && d.weapon.attack_rating) || MODAL_ATTACK_RATING) / MODAL_ATTACK_RATING;
}

/** The unscaled quantity `K` is applied to. */
export function threatMass(d) {
  return effectiveHp(d) * threatFactor(d) * (TIER_PREMIUM[d.tier] || 0);
}

export function loadRoster(dir = DIR) {
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    out[f] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return out;
}

/** K, solved from the anchor rather than typed in. */
export function solveK(roster) {
  const anchor = Object.values(roster).find((d) => d.id === ANCHOR_ID);
  if (!anchor) throw new Error(`derive-soul-values: anchor statblock '${ANCHOR_ID}' is not on disk`);
  const m = threatMass(anchor);
  if (!(m > 0)) throw new Error(`derive-soul-values: anchor '${ANCHOR_ID}' has zero threat mass`);
  return R1_MEAN_KILL / m;
}

export function soulsFor(d, K) {
  if (isProp(d)) return 0;
  return Math.round(K * threatMass(d));
}

/** Which RI-PRG06 band, if any, a value falls in. Returns a label or null. */
function bandOf(souls) {
  for (const b of PRG06_BANDS) {
    if (souls >= b.trash[0] && souls <= b.trash[1]) return `${b.region} trash`;
    if (souls >= b.miniboss[0] && souls <= b.miniboss[1]) return `${b.region} miniboss`;
    if (souls === b.boss) return `${b.region} boss`;
  }
  return null;
}

/**
 * `--pace` — HOW LONG IS A LEVEL, in kills and in minutes, against RI-PRG01's shipped curve.
 *
 * Balance is a real question and this is the answer, stated in numbers so it can be argued with.
 *
 * MINUTES come from RI-PRG06 §1's own region-1 row and nothing else: 1.8 h across a roster of 93
 * at the 78% kill rate §1's "typical" column is defined at = 72.5 killed enemies in 108 minutes =
 * **1.49 minutes per killed enemy**, travel, looting and deaths included. That is deliberately
 * NOT a time-to-kill measured in the fight: `tools/lib/combat-node.mjs` puts a straight sword
 * through a Marsh sentry in 21.7-23.4 s of continuous swinging (15 landed hits through
 * armour_rating 30), but the node arena runs no stealth perception so the enemy never turns, and
 * a fight figure from there is not a figure about the shipped game. The two are consistent —
 * 22 s of fighting inside 89 s of being somewhere — and only the corpus figure is used here.
 */
function pace(roster, rows) {
  const levels = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/levels.json'), 'utf8')).levels;
  const anchor = rows.find((r) => r.id === ANCHOR_ID);
  const S = anchor.souls;
  const night = Math.round(S * 1.35);
  const MIN_PER_KILL = 108 / (93 * 0.78);
  const reach = (souls) => { let s = 0, l = 1; for (const r of levels) { if (s + r.souls > souls) break; s += r.souls; l = r.level; } return { level: l, spare: souls - s }; };

  console.log('');
  console.log(`--pace  the baseline kill is ${ANCHOR_ID} at ${S} souls (${night} at night)`);
  console.log(`        minutes use RI-PRG06 §1's own R1 row: 108 min / (93 x 0.78 killed) = ${MIN_PER_KILL.toFixed(2)} min per killed enemy`);
  console.log('');
  console.log('  ' + 'level'.padStart(6) + 'souls'.padStart(9) + 'kills'.padStart(8) + 'minutes'.padStart(10) + '   night kills');
  for (const n of [2, 3, 5, 10, 14, 20]) {
    const row = levels.find((r) => r.level === n);
    if (!row) continue;
    console.log('  ' + String(n).padStart(6) + String(row.souls).padStart(9)
      + (row.souls / S).toFixed(1).padStart(8) + (row.souls / S * MIN_PER_KILL).toFixed(1).padStart(10)
      + '   ' + (row.souls / night).toFixed(1));
  }
  console.log('');
  // What the world that SHIPS can actually fund, which is the honest headline.
  const enc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/encounters.json'), 'utf8'));
  const byId = {}; for (const r of rows) byId[r.id] = r.souls;
  let worldSouls = 0, placed = 0;
  for (const e of enc.encounters || []) for (const m of e.members || []) { worldSouls += (byId[m.statblock] || 0) * (m.count || 0); placed += (m.count || 0); }
  const crossing = (enc.encounters[0].members || []).reduce((a, m) => a + (byId[m.statblock] || 0) * (m.count || 0), 0);
  const r2 = reach(crossing), r3 = reach(crossing * 1.35), r4 = reach(worldSouls);
  console.log(`  the crossing (${enc.encounters[0].id}) pays ${crossing} souls -> level ${r2.level}, ${r2.spare} spare toward the next`);
  console.log(`  the same encounter at night pays ${Math.round(crossing * 1.35)} -> level ${r3.level}`);
  console.log(`  EVERY hand-placed enemy in the world (${placed}) pays ${worldSouls} -> level ${r4.level}`);
  console.log(`  RI-PRG06 §7's planning figure is ~1,230 placed enemies for a first clear at L82.`);
  console.log(`  So the curve, the values and the loop are right and the WORLD IS EMPTY: the`);
  console.log(`  ceiling is a world-population problem, not a soul-economy one.`);
}

function main() {
  const roster = loadRoster();
  const K = solveK(roster);
  const rows = [];
  for (const [file, d] of Object.entries(roster)) {
    const souls = soulsFor(d, K);
    rows.push({ file, id: d.id, tier: d.tier, archetype: d.archetype, hp: d.hp, souls, band: bandOf(souls) });
  }
  rows.sort((a, b) => a.souls - b.souls || (a.id < b.id ? -1 : 1));

  if (!has('json')) {
    console.log(`derive-soul-values: K = ${K.toFixed(6)}  (anchor ${ANCHOR_ID} -> ${R1_MEAN_KILL.toFixed(2)} souls, RI-PRG06 §1 R1 mean kill)`);
    console.log('');
    console.log('  ' + 'id'.padEnd(23) + 'tier'.padEnd(10) + 'hp'.padStart(7) + 'souls'.padStart(8) + '  RI-PRG06 band');
    for (const r of rows) {
      console.log('  ' + r.id.padEnd(23) + String(r.tier).padEnd(10) + String(r.hp).padStart(7)
        + String(r.souls).padStart(8) + '  ' + (r.souls === 0 ? '— (prop, unfarmable)' : (r.band || 'OUTSIDE EVERY BAND')));
    }
    const fightable = rows.filter((r) => r.souls > 0);
    console.log('');
    console.log(`  ${fightable.length} fightable statblocks, ${rows.length - fightable.length} props at zero.`);
  }

  let bad = 0;
  if (has('check')) {
    for (const r of rows) {
      if (r.souls === 0 && !isProp(roster[r.file])) { console.error(`FAIL ${r.id}: fightable statblock worth 0 souls`); bad++; }
      if (r.souls > 0 && isProp(roster[r.file])) { console.error(`FAIL ${r.id}: prop is farmable for ${r.souls} souls`); bad++; }
      if (r.souls > 0 && !r.band) { console.error(`FAIL ${r.id}: ${r.souls} souls is outside every RI-PRG06 §2 band`); bad++; }
    }
    // The `souls` field on disk must equal what this tool computes, or the source and its
    // derivation have drifted and the numbers in the world are nobody's.
    for (const r of rows) {
      const on = roster[r.file].souls;
      if (on !== undefined && on !== r.souls) { console.error(`FAIL ${r.id}: shipped souls=${on}, derived ${r.souls}`); bad++; }
      if (on === undefined) { console.error(`FAIL ${r.id}: no \`souls\` field on disk — run with --write`); bad++; }
    }
    console.log(bad === 0 ? 'derive-soul-values --check: clean.' : `derive-soul-values --check: ${bad} failure(s).`);
  }

  if (has('write')) {
    for (const [file, d] of Object.entries(roster)) {
      const souls = soulsFor(d, K);
      if (d.souls === souls) continue;
      // SURGICAL. A `JSON.parse` -> `JSON.stringify` round trip re-encodes every `0.0` as `0`
      // and unescapes every `§`, which turned a two-line addition into an 87-line diff
      // across 22 files that other agents are editing at the same time. The field is inserted
      // as text before the closing brace instead, so the diff is exactly what changed.
      const p = path.join(DIR, file);
      const raw = fs.readFileSync(p, 'utf8');
      const end = raw.lastIndexOf('}');
      if (end < 0) throw new Error(`derive-soul-values: ${file} has no closing brace`);
      const head = raw.slice(0, end).replace(/\s*$/, '');
      const add = ',\n ' + JSON.stringify('souls') + ': ' + souls
        + ',\n ' + JSON.stringify('_souls_note') + ': ' + JSON.stringify(SOULS_NOTE) + '\n';
      fs.writeFileSync(p, head + add + raw.slice(end));
      console.log(`  wrote ${file}: souls=${souls}`);
    }
  }

  if (has('pace')) pace(roster, rows);

  if (has('json')) console.log(JSON.stringify({ tool: 'derive-soul-values', K, anchor: ANCHOR_ID, rows }, null, 2));
  process.exit(bad === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
