#!/usr/bin/env node
// faction-signature-sweep.mjs — what a REAL character sheet looks like, across every signature
// the build can produce, so a rank ladder is set against the sheets that exist rather than a
// best case.
//
// The main quest's own gates clamped with a margin of exactly zero and shut Act IV for 11 of 40
// signatures. This is the instrument that stops the faction ladders repeating it: for every
// (race x upbringing x class) signature it reads back the composed attribute sheet and the
// composed skill sheet from the SHIPPED character builder, and reports, per faction, the highest
// favoured attribute and the two highest favoured skills a fresh character of that signature has.
//
// Run: node tools/quests/faction-signature-sweep.mjs [--out report.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `
faction-signature-sweep.mjs — measure the attribute and skill floor across every signature.

USAGE
  node tools/quests/faction-signature-sweep.mjs [--out <file>] [--quiet]
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const QUIET = !!args.quiet;
const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };

const gates = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/quests/faction-gates.json'), 'utf8'));
const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const CLASSES = ['salt-blade', 'ledger-hand', 'reed-walker', 'root-speaker', 'wet-foot', 'sap-reader'];

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const rows = await page.evaluate((cfg) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const out = [];
    for (const race of cfg.RACES) {
      for (const upbringing of cfg.UPBRINGINGS) {
        for (const klass of cfg.CLASSES) {
          try {
            H.setCharacter({ race, upbringing, class: klass, birthsign: 'raj-xul' });
            out.push({ race, upbringing, class: klass, attributes: H.getPlayerStats().attributes, skills: H.getSkills() });
          } catch (e) { out.push({ race, upbringing, class: klass, error: String(e).slice(0, 160) }); }
        }
      }
    }
    return out;
  }, { RACES, UPBRINGINGS, CLASSES });

  const ok = rows.filter((r) => !r.error);
  const report = { tool: 'faction-signature-sweep', signatures: ok.length, errors: rows.length - ok.length, attribute_ids: Object.keys(ok[0].attributes).sort(), per_attribute: {}, per_faction: [] };

  // ---- PER-ATTRIBUTE CEILINGS -----------------------------------------------------------------
  // A `resolutions[].requires.attributes` demand has exactly the same failure mode as a rank
  // gate's, and nothing was checking it. `Q-XULA-08` — the Xul-Aneekh's own rank-7 quest — asked
  // 24 WILLPOWER on three of its four endings. Willpower is governed by `warding` and `veiling`
  // and nothing else, so it is worth base + 12 and no more, and a saxhleel/lukiul/ledger-hand
  // starting at 10 tops out at 22 with both skills at 90. The line's ceiling quest had no
  // reachable ending for that character and the probe walked into it at rank 7.
  //
  // So the ceiling every attribute actually has is measured here and written down: what a
  // signature starts with, plus 6 for each skill in the game whose use raises it.
  const skillsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/skills.json'), 'utf8'));
  const governedCount = {};
  for (const s of skillsDoc.skills) governedCount[s.governing] = (governedCount[s.governing] || 0) + 1;
  const POINTS_PER_SKILL = 6;   // 15/30/45/60/75/90 — character/derive.js:359

  // ---- THE SECOND STREAM: BOUGHT POINTS (W1-SOULS) ------------------------------------------
  //
  // RI-PRG02 §2 specifies TWO streams of attribute points. The block above is the EARNED one.
  // The BOUGHT one is one point per level, freely allocated (RI-PRG01 "what a level buys"), and
  // it was worth exactly zero in every sweep before this because souls had no source: nothing in
  // `game/src/**` added to `soulsHeld` except recovering a bloodstain, so `soulsToNextLevel()`
  // could never be paid and the ceilings below were the ceilings of a game with half its
  // progression missing. `tools/quests/attr-scale-audit.mjs`'s own header says the bands "move
  // with it" the day somebody wires kill-souls — and they would not have, because this file had
  // no bought term at all. It has one now.
  //
  // The number is DERIVED FROM THE WORLD THAT SHIPS, not from the design budget, and that is
  // the whole point of computing it here rather than writing it down: sum the `souls` value of
  // every hand-placed enemy in `game/data/world/encounters.json`, run the total through
  // RI-PRG01's shipped curve, and the level it reaches is how many points a 100%-clear character
  // can buy. When the world gains its enemies the number rises on its own and these bands move
  // with it, which is exactly the property the audit was written to rely on.
  //
  // A level buys +1 to ANY attribute, so a character concentrating every purchase in one
  // attribute adds the whole total to that one ceiling. That is what is added below.
  const enemyDir = path.join(ROOT, 'game/data/combat/enemies');
  const soulsOf = {};
  for (const f of fs.readdirSync(enemyDir)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(enemyDir, f), 'utf8'));
    soulsOf[doc.id] = Number(doc.souls) || 0;
  }
  const encounters = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/encounters.json'), 'utf8'));
  let worldSouls = 0, placed = 0;
  for (const enc of encounters.encounters || []) {
    for (const m of enc.members || []) { worldSouls += (soulsOf[m.statblock] || 0) * (m.count || 0); placed += (m.count || 0); }
  }
  const levels = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/levels.json'), 'utf8'));
  let bought = 0, spent = 0;
  for (const row of levels.levels || []) { if (spent + row.souls > worldSouls) break; spent += row.souls; bought++; }
  report.bought_stream = {
    note: 'RI-PRG02 §2 second stream — one attribute point per level, souls-bought, freely allocated. '
      + 'Derived from the enemies the world actually places, so it rises on its own as the world is populated.',
    placed_enemies: placed,
    world_souls: worldSouls,
    points_from_a_100pc_clear: bought,
    souls_spent_to_get_them: spent,
    design_target_for_comparison: {
      source: 'RI-PRG06 §1 — typical first clear L82, 100% clear L93',
      points_typical_first_clear: 81,
      world_souls_designed: 1124285,
      shortfall_note: 'The world places ' + placed + ' hand-placed enemies against RI-PRG06 §7\'s planning '
        + 'figure of ~1,230. Until the roster is placed, the bought stream is worth ' + bought + ' point(s), '
        + 'not 81, and every ceiling below is that much short of the designed one.',
    },
  };

  for (const a of report.attribute_ids) {
    const vals = ok.map((r) => r.attributes[a] || 0).sort((x, y) => x - y);
    const st = { min: vals[0], p10: vals[Math.floor(vals.length * 0.1)], median: vals[Math.floor(vals.length / 2)], max: vals[vals.length - 1] };
    const g = governedCount[a] || 0;
    const earned = POINTS_PER_SKILL * g;
    report.per_attribute[a] = {
      at_creation: st,
      skills_that_raise_it: g,
      earned_points: earned,
      bought_points: bought,
      reachable_ceiling: { from_p10: st.p10 + earned + bought, from_median: st.median + earned + bought, from_max: st.max + earned + bought },
      // What the ceiling WOULD be once RI-PRG06's roster is placed. Reported, never asserted on:
      // landing a band on a world that does not exist yet is a fail-closed assertion before its
      // data, and this project has paid for that twice.
      ceiling_at_design_budget: { from_p10: st.p10 + earned + 81, from_median: st.median + earned + 81, from_max: st.max + earned + 81 },
    };
  }

  for (const f of gates.factions) {
    const attrBest = [], s1 = [], s2 = [];
    const deadAttrs = f.favoured_attributes.filter((a) => ok[0].attributes[a] === undefined);
    const deadSkills = f.favoured_skills.filter((s) => ok[0].skills[s] === undefined);
    for (const r of ok) {
      attrBest.push(Math.max(...f.favoured_attributes.map((a) => r.attributes[a] || 0)));
      const sk = f.favoured_skills.map((s) => r.skills[s] || 0).sort((x, y) => y - x);
      s1.push(sk[0]); s2.push(sk[1]);
    }
    const stat = (a) => ({ min: Math.min(...a), p10: a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.1)], median: a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], max: Math.max(...a) });
    report.per_faction.push({
      id: f.id, name: f.name,
      favoured_attributes: f.favoured_attributes, dead_attributes: deadAttrs,
      favoured_skills: f.favoured_skills, dead_skills: deadSkills,
      at_creation: { best_favoured_attribute: stat(attrBest), best_favoured_skill: stat(s1), second_favoured_skill: stat(s2) },
      declared_rank1: { attribute: f.ranks[1].attribute, skill_1: f.ranks[1].skill_1, skill_2: f.ranks[1].skill_2 },
      declared_rank7: { attribute: f.ranks[7].attribute, skill_1: f.ranks[7].skill_1, skill_2: f.ranks[7].skill_2 },
      signatures_meeting_rank1_attribute: attrBest.filter((v) => v >= (f.ranks[1].attribute || 0)).length,
    });
  }

  say(`signatures: ${report.signatures}  attributes on the sheet: ${report.attribute_ids.join(', ')}`);
  for (const p of report.per_faction) {
    say(`\n${p.id}`);
    if (p.dead_attributes.length) say(`  DEAD FAVOURED ATTRIBUTES (not on any sheet): ${p.dead_attributes.join(', ')}`);
    if (p.dead_skills.length) say(`  DEAD FAVOURED SKILLS: ${p.dead_skills.join(', ')}`);
    say(`  best favoured attribute at creation: min ${p.at_creation.best_favoured_attribute.min} p10 ${p.at_creation.best_favoured_attribute.p10} med ${p.at_creation.best_favoured_attribute.median} max ${p.at_creation.best_favoured_attribute.max}`);
    say(`  best favoured skill     at creation: min ${p.at_creation.best_favoured_skill.min} p10 ${p.at_creation.best_favoured_skill.p10} med ${p.at_creation.best_favoured_skill.median} max ${p.at_creation.best_favoured_skill.max}`);
    say(`  2nd  favoured skill     at creation: min ${p.at_creation.second_favoured_skill.min} p10 ${p.at_creation.second_favoured_skill.p10} med ${p.at_creation.second_favoured_skill.median} max ${p.at_creation.second_favoured_skill.max}`);
    say(`  rank1 asks attr ${p.declared_rank1.attribute} / s1 ${p.declared_rank1.skill_1} — signatures already meeting the attribute: ${p.signatures_meeting_rank1_attribute}/${report.signatures}`);
  }
  if (args.out) writeJson(args.out, report);
  await handle.close();
  process.exit(0);
} catch (e) {
  console.error(String(e && e.stack || e));
  if (handle) await handle.close().catch(() => {});
  process.exit(2);
}
