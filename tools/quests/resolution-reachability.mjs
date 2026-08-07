#!/usr/bin/env node
// resolution-reachability.mjs — can the player ACTUALLY take any of the endings a quest offers?
//
// Why this exists. The rank ladders were checked for reachability and the RESOLUTIONS were not,
// and a resolution carries the same three kinds of demand a rank does: an attribute, a skill and
// a purse. `game/data/quests/faction-xul-aneekh.json Q-XULA-08` — the Xul-Aneekh's own rank-7
// quest, the end of the line — asks **24 willpower** on three of its four endings. Willpower is
// governed by `warding` and `veiling` and by nothing else in the game, so it is worth
// `base + 6 per governing skill` and no more (`character/derive.js:359`, +1 per multiple of 15).
// Measured over 240 signatures through the shipped character builder, that ceiling is 22 for a
// p10 sheet and 23 for a median one. The line's last quest had NO reachable ending for most of
// the characters the build can produce, and `tools/quests/faction-probe.mjs` walked into it at
// rank 7 with every other gate cleared.
//
// The numbers are not restated here. They are read from `reports/faction-signature-sweep.json`,
// which is a live sweep of the character builder, so this tool cannot drift from the sheet.
//
// A quest FAILS if EVERY one of its resolutions is out of reach on the chosen sheet. A single
// out-of-reach ending is fine and is reported as a note — that is a build the player did not
// take. A quest with no reachable ending at all is a dead end.
//
// Run:  node tools/quests/resolution-reachability.mjs [--sheet p10|median|max] [--quest Q-XULA-08]
// Exit: 0 = every quest has at least one reachable ending. 1 = at least one dead end.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SHEET = String(arg('sheet', 'p10'));
const ONLY = arg('quest', null);
const PREFIX = arg('prefix', null);

const SWEEP_PATH = path.join(ROOT, 'reports/faction-signature-sweep.json');
if (!fs.existsSync(SWEEP_PATH)) {
  console.error(`resolution-reachability: ${SWEEP_PATH} does not exist.\nRun: node tools/quests/faction-signature-sweep.mjs --out reports/faction-signature-sweep.json`);
  process.exit(2);
}
const sweep = JSON.parse(fs.readFileSync(SWEEP_PATH, 'utf8'));
if (!sweep.per_attribute) {
  console.error('resolution-reachability: the sweep report has no per_attribute block — re-run the sweep with the current tool.');
  process.exit(2);
}
const key = SHEET === 'median' ? 'from_median' : SHEET === 'max' ? 'from_max' : 'from_p10';
const attrCeiling = {};
for (const [a, v] of Object.entries(sweep.per_attribute)) attrCeiling[a] = v.reachable_ceiling[key];
// A skill runs to 100 by use, so a skill demand is reachable unless it exceeds that.
const SKILL_CEILING = 100;

const QDIR = path.join(ROOT, 'game/data/quests');
const problems = [];
const notes = [];
let quests = 0, resolutions = 0;

for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of (Array.isArray(doc) ? doc : doc.quests || [])) {
    if (ONLY && q.id !== ONLY) continue;
    if (PREFIX && !q.id.startsWith(PREFIX)) continue;
    const rs = q.resolutions || [];
    if (!rs.length) continue;
    quests++;
    const verdicts = [];
    for (const r of rs) {
      resolutions++;
      const need = r.requires || {};
      const blocks = [];
      for (const [a, want] of Object.entries(need.attributes || {})) {
        if (attrCeiling[a] === undefined) { blocks.push(`'${a}' is not an attribute on the sheet`); continue; }
        if (want > attrCeiling[a]) blocks.push(`${a} ${want} > ceiling ${attrCeiling[a]} (${sweep.per_attribute[a].skills_that_raise_it} skill(s) raise it)`);
      }
      for (const [s, want] of Object.entries(need.skills || {})) {
        if (want > SKILL_CEILING) blocks.push(`${s} ${want} > ${SKILL_CEILING}`);
      }
      verdicts.push({ id: r.id, blocks, violence: !!r.violence_required });
    }
    const reachable = verdicts.filter((v) => !v.blocks.length);
    if (!reachable.length) {
      problems.push(`${q.id} (${f}): NO reachable ending on a ${SHEET} sheet — ` + verdicts.map((v) => `${v.id}: ${v.blocks.join('; ')}`).join(' | '));
    } else {
      const peaceful = reachable.filter((v) => !v.violence);
      if (!peaceful.length) problems.push(`${q.id} (${f}): every reachable ending requires violence on a ${SHEET} sheet`);
      for (const v of verdicts) if (v.blocks.length) notes.push(`${q.id} ${v.id}: ${v.blocks.join('; ')}`);
    }
  }
}

console.log(`resolution-reachability: ${quests} quests, ${resolutions} resolutions, against a ${SHEET} sheet.`);
console.log('attribute ceilings used: ' + Object.entries(attrCeiling).map(([a, v]) => `${a} ${v}`).join(', '));
if (notes.length) {
  console.log(`\n${notes.length} ending(s) out of reach for this sheet (fine — a build the player did not take):`);
  for (const n of notes.slice(0, 30)) console.log('   ' + n);
  if (notes.length > 30) console.log(`   … and ${notes.length - 30} more`);
}
if (problems.length) {
  console.error(`\n${problems.length} DEAD END(S):`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('\nEvery quest has at least one reachable ending, and at least one of those needs no violence.');
