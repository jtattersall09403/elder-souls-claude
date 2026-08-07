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
  const report = { tool: 'faction-signature-sweep', signatures: ok.length, errors: rows.length - ok.length, attribute_ids: Object.keys(ok[0].attributes).sort(), per_faction: [] };

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
