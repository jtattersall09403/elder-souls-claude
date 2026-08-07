#!/usr/bin/env node
// check-souls-corpus.mjs — the soul economy's CORPUS is internally consistent, checked over the
// markdown and the JSON with no engine and no browser.
//
// =================================================================================================
// WHY THIS IS A CHECK AND NOT A CONSTRUCTOR
// =================================================================================================
//
// `RULES` 14: content integrity belongs in a check, not in a constructor. The soul derivation
// (`tools/progression/derive-soul-values.mjs`) rests on twenty-four separate rows of
// `RI-PRG06`, and round 2 guarded exactly ONE of them — a hard-coded `PUBLISHED_R1_TRASH =
// [35, 190]` inside the derivation itself. The round-2 verdict's F-3 counted the rest:
//
//   > The tool guards one of those twenty-four rows. The other twenty-three can drift between
//   > §2, §3 and the JSON with nothing red, which is the check-not-constructor rule applied
//   > only once.
//
// The whole rescale argument — *"§2's bands are not independent data: they are the min and max
// of §3's own per-region roster, so a rule that rescales §3's values rescales §2's bands by the
// same factor"* — is the load-bearing claim of the entire round-2 re-anchor. It is arithmetic,
// and arithmetic that nothing asserts is a coincidence waiting to be edited.
//
// So all twenty-four are checked here, and against the MARKDOWN as well as the JSON, because
// the item is the markdown and the JSON is a transcription of it. Three ways they can disagree
// and all three are checked:
//
//   B1  §2's eighteen published band rows == the min/max of §3's own roster, IN THE MARKDOWN.
//   B2  the six region totals and counts in §3's section headers == the sum of their own rows.
//   B3  the JSON `RI-PRG06-souls-yield.json` (which the derivation reads) == the markdown
//       (which is the item) — region by region, row by row.
//
// and then the three §1 header figures that `--check`'s L120 guard and `--census` both stand on:
//
//   H1  §1's `world_total_souls` == the sum of §3's six region totals.
//   H2  §1's `souls_for_L120` == cum(120) on the SHIPPED curve, game/data/progression/levels.json.
//   H3  §1's `farm_multiple_for_L120` == souls_for_L120 / world_total_souls, in RI-PRG06 method
//       10's band of 1.8-2.6.
//
// -------------------------------------------------------------------------------------------
// WHAT THIS DELIBERATELY DOES NOT ASSERT
// -------------------------------------------------------------------------------------------
//
// **Method 6's band separation.** §2 claims its bands are "deliberately non-overlapping at the
// edges so that 'am I in the right region' is answerable from a single kill"; method 6 caps the
// adjacent overlap at 25% of the lower band's width; the published bands overlap by 32-76% on
// five pairs out of five. That is a contradiction INSIDE the item — since §2's bands are exactly
// the min/max of §3's roster (B1, proved here), the two cannot be reconciled without moving §3's
// values, which §7 froze and §1's cumulative column depends on. It is filed as AQ-1 against
// `RI-PRG06` and it is somebody's ruling to make, not this check's to enforce: arming it would
// land a fail-closed assertion on data nobody has authored (`RULES` 13) and would take the whole
// project's boot-check down over a corpus question. It is REPORTED here, with the numbers, and
// by `derive-soul-values --check`.
//
// Run:  node tools/check-souls-corpus.mjs          (exit 1 on any drift)
//       node tools/check-souls-corpus.mjs --json
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const say = (s) => { if (!has('json')) console.log(s); };

const MD_PATH = 'corpus/20-progression/RI-PRG06-souls-yield-and-pace.md';
const JSON_PATH = 'corpus/20-progression/RI-PRG06-souls-yield.json';

const failures = [];
const fail = (id, msg) => { failures.push({ id, msg }); console.error(`FAIL ${id}: ${msg}`); };

/**
 * Parse the ITEM — §2's published band table and §3's per-region rosters — out of the markdown.
 *
 * Deliberately independent of `RI-PRG06-souls-yield.json`: the JSON is a transcription and B3
 * exists to check the transcription. Lifted from the round-2 critic's own instrument
 * (`tools/progression/critic-souls-r2.mjs` arm C1), which is where these two regexes were first
 * written and proved.
 */
function parseItemMarkdown() {
  const md = fs.readFileSync(path.join(ROOT, MD_PATH), 'utf8');
  const num = (s) => Number(String(s).replace(/[, *]/g, ''));

  // §2 — "| R1 | 35 – 190 | 700 – 900 | 3,000 | 1.0x |"
  const published = {};
  for (const m of md.matchAll(/^\|\s*(R[1-6])\s*\|\s*([\d,]+)\s*[–-]\s*([\d,]+)\s*\|\s*([\d,]+)\s*[–-]\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/gm)) {
    published[m[1]] = { trash: [num(m[2]), num(m[3])], miniboss: [num(m[4]), num(m[5])], boss: [num(m[6]), num(m[6])] };
  }

  // §3 — "**R1 — 93 enemies, 12,665 souls, 1.8 h**" then "| swarm-vermin | trash | 34 | 35 | 1,190 |"
  const roster = {};
  const marks = [...md.matchAll(/^\*\*(R[1-6]) — ([\d,]+) enemies, ([\d,]+) souls, ([\d.]+) h\*\*$/gm)];
  for (let i = 0; i < marks.length; i++) {
    const region = marks[i][1];
    const body = md.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : md.length);
    const rows = [];
    for (const m of body.matchAll(/^\|\s*\**([a-z0-9-]+|R[1-6] (?:final )?boss)\**\s*\|\s*(trash|miniboss|boss)\s*\|\s*([\d,]+)\s*\|\s*\**([\d,]+)\**\s*\|\s*([\d,]+)\s*\|/gm)) {
      rows.push({ archetype: m[1], tier: m[2], count: num(m[3]), souls_each: num(m[4]), total: num(m[5]) });
    }
    roster[region] = { region, enemy_count: num(marks[i][2]), region_souls: num(marks[i][3]), hours: Number(marks[i][4]), rows };
  }
  return { published, roster };
}

function main() {
  const { published, roster } = parseItemMarkdown();
  const J = rd(JSON_PATH);
  const LEVELS = rd('game/data/progression/levels.json').levels;
  const span = (xs) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  const report = { tool: 'check-souls-corpus', rows_checked: 0, failures: [], method6: null };

  const regions = Object.keys(roster).sort();
  if (regions.length !== 6) fail('B0', `§3 has ${regions.length} region blocks in the markdown, expected 6`);
  if (Object.keys(published).length !== 6) fail('B0', `§2 has ${Object.keys(published).length} band rows, expected 6`);

  say(`check-souls-corpus: ${MD_PATH}`);
  say('');
  say('  B1/B2  §2\'s bands are the min/max of §3\'s own roster, and §3\'s rows sum to its headers');
  say('  ' + 'region'.padEnd(8) + 'tier'.padEnd(10) + 'from §3\'s roster'.padStart(18) + '§2 publishes'.padStart(18) + '   ');

  // ---- B1: eighteen band rows -----------------------------------------------------------------
  for (const region of regions) {
    const g = { trash: [], miniboss: [], boss: [] };
    for (const r of roster[region].rows) g[r.tier].push(r.souls_each);
    for (const tier of ['trash', 'miniboss', 'boss']) {
      const derived = span(g[tier]);
      const pub = published[region] && published[region][tier];
      report.rows_checked++;
      const ok = derived && pub && derived[0] === pub[0] && derived[1] === pub[1];
      say('  ' + region.padEnd(8) + tier.padEnd(10)
        + (derived ? `${derived[0]}-${derived[1]}` : '—').padStart(18)
        + (pub ? `${pub[0]}-${pub[1]}` : '—').padStart(18) + (ok ? '   ok' : '   DRIFT'));
      if (!ok) {
        fail('B1', `§2's ${region} ${tier} band is ${pub ? pub.join('-') : 'absent'}, but §3's own ${region} `
          + `${tier} roster spans ${derived ? derived.join('-') : 'nothing'}. The rescale argument — "§2's bands `
          + 'ARE the min/max of §3\'s roster, so rescaling the values rescales the bands" — is what the whole '
          + 'derivation stands on, and it has stopped being true.');
      }
    }
    // ---- B2: the region header equals the sum of its own rows --------------------------------
    const sumS = roster[region].rows.reduce((a, r) => a + r.count * r.souls_each, 0);
    const sumN = roster[region].rows.reduce((a, r) => a + r.count, 0);
    report.rows_checked++;
    if (sumS !== roster[region].region_souls || sumN !== roster[region].enemy_count) {
      fail('B2', `§3's ${region} header says ${roster[region].enemy_count} enemies / ${roster[region].region_souls} souls, `
        + `its own rows sum to ${sumN} / ${sumS}.`);
    }
    // and the per-row total column
    for (const r of roster[region].rows) {
      if (r.count * r.souls_each !== r.total) {
        fail('B2', `§3 ${region} row '${r.archetype}': ${r.count} x ${r.souls_each} = ${r.count * r.souls_each}, `
          + `the table's total column says ${r.total}.`);
      }
    }
  }

  // ---- B3: the JSON the derivation reads == the markdown --------------------------------------
  say('');
  say('  B3     the JSON the derivation reads == the markdown the item IS');
  for (const region of regions) {
    const jr = J.regions.find((x) => x.region === region);
    if (!jr) { fail('B3', `${JSON_PATH} has no ${region} block`); continue; }
    const m = roster[region];
    if (jr.enemy_count !== m.enemy_count || jr.region_souls !== m.region_souls) {
      fail('B3', `${region}: JSON says ${jr.enemy_count}/${jr.region_souls}, markdown says ${m.enemy_count}/${m.region_souls}`);
    }
    if (jr.roster.length !== m.rows.length) {
      fail('B3', `${region}: JSON has ${jr.roster.length} roster rows, markdown has ${m.rows.length}`);
    }
    for (const jrow of jr.roster) {
      const mr = m.rows.find((r) => r.souls_each === jrow.souls_each && r.count === jrow.count && r.tier === (jrow.tier || 'trash'));
      report.rows_checked++;
      if (!mr) {
        fail('B3', `${region}: the JSON carries a ${jrow.tier || 'trash'} row of ${jrow.count} x ${jrow.souls_each} `
          + 'that the markdown does not.');
      }
    }
  }

  // ---- H1/H2/H3: §1's header figures ----------------------------------------------------------
  const cum120 = LEVELS.filter((r) => r.level <= 120).reduce((a, r) => a + r.souls, 0);
  const sumRegions = J.regions.reduce((a, r) => a + r.region_souls, 0);
  const ratio = J.souls_for_L120 / J.world_total_souls;
  say('');
  say('  H1/H2/H3  §1\'s header figures, which --census and --check\'s L120 guard both stand on');
  say(`    world_total_souls        ${J.world_total_souls}   (§3's six regions sum to ${sumRegions})`);
  say(`    souls_for_L120           ${J.souls_for_L120}   (cum(120) on the shipped curve is ${cum120})`);
  say(`    farm_multiple_for_L120   ${J.farm_multiple_for_L120}   (computed ${ratio.toFixed(4)}, band 1.8-2.6)`);
  if (sumRegions !== J.world_total_souls) fail('H1', `§1 declares ${J.world_total_souls}, §3's regions sum to ${sumRegions}`);
  if (J.souls_for_L120 !== cum120) {
    fail('H2', `RI-PRG06's souls_for_L120 is ${J.souls_for_L120} and the SHIPPED curve `
      + `(game/data/progression/levels.json) cumulates to ${cum120} at level 120. The item and the curve `
      + 'have drifted, and RI-PRG06 method 10 is measured against both.');
  }
  if (Math.abs(J.farm_multiple_for_L120 - ratio) > 0.01) {
    fail('H3', `§1's farm_multiple_for_L120 is ${J.farm_multiple_for_L120}, computed ${ratio.toFixed(4)}`);
  }
  if (!(ratio >= 1.8 && ratio <= 2.6)) {
    fail('H3', `the farm multiple ${ratio.toFixed(3)} is outside RI-PRG06 method 10's 1.8-2.6. §1: level 120 `
      + '"is not, and must not become, a first-clear level".');
  }

  // ---- METHOD 6: reported, never armed. AQ-1. -------------------------------------------------
  const pairs = [];
  for (let i = 0; i + 1 < regions.length; i++) {
    const lo = published[regions[i]].trash, hi = published[regions[i + 1]].trash;
    const overlap = Math.max(0, lo[1] - hi[0]);
    pairs.push({ pair: `${regions[i]}/${regions[i + 1]}`, lo, hi, overlap, pct: overlap / (lo[1] - lo[0]) });
  }
  const over = pairs.filter((p) => p.pct > 0.25);
  report.method6 = { ceiling: 0.25, pairs, over: over.length, of: pairs.length, armed: false, filed_as: 'AQ-1 against RI-PRG06' };
  say('');
  say('  METHOD 6  band separation — REPORTED, NEVER ARMED (AQ-1; see the header)');
  for (const p of pairs) {
    say(`    ${p.pair.padEnd(8)} ${String(p.lo[0]).padStart(5)}-${String(p.lo[1]).padEnd(6)} vs `
      + `${String(p.hi[0]).padStart(5)}-${String(p.hi[1]).padEnd(6)}  overlap ${String(p.overlap).padStart(5)}`
      + ` = ${(p.pct * 100).toFixed(1)}% of the lower band's width${p.pct > 0.25 ? '   > 25%' : ''}`);
  }
  say(`    ${over.length} of ${pairs.length} adjacent trash-band pairs exceed the 25% ceiling. Scale-invariant.`);
  say('    §2 says the bands are "deliberately non-overlapping at the edges so that \'am I in the');
  say('    right region\' is answerable from a single kill". On the published numbers they are not.');

  report.failures = failures;
  if (has('json')) console.log(JSON.stringify(report, null, 2));
  else {
    say('');
    say(failures.length === 0
      ? `check-souls-corpus: clean — ${report.rows_checked} corpus rows checked, 0 drift.`
      : `check-souls-corpus: ${failures.length} failure(s) over ${report.rows_checked} rows checked.`);
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
