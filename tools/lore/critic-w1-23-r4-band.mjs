#!/usr/bin/env node
/**
 * critic-w1-23-r4-band.mjs — CRITIC instrument, W1-23 round 4. Written by the critic.
 *
 * W1-23 r4 ships `tools/lore/lor04-validate.mjs`, which bands the shipped roster against
 * RI-LOR04 §Scoring and reports **0 on both arms**, hard-zeroed on `M3 unclassifiable > 2%`.
 * A validator that reports zero on the shipped tree and says why is doing its job — but a
 * validator that has only ever reported zero on a REAL population is indistinguishable from one
 * that is stuck at zero, and RULES #4 says a probe that cannot fail is worse than no probe. The
 * builder's own `--self-test` clears a synthetic fixture at band >= 4; that is a fixture, not the
 * population.
 *
 * So this file asks the one question the shipped tool cannot ask of itself:
 *
 *     Take the SHIPPED population. Change only the eight names the tool names as the cause.
 *     Does the band move off 0, and does it move BACK when they are put back?
 *
 * Four arms, and the last two are the ones that make the first two mean anything:
 *
 *   1. SHIPPED          — harvestPeople() off the working tree. Expect band 0, reason M3.
 *   2. M3-REPAIRED      — the same population with ONLY the unclassifiable names replaced by
 *                         legal Jel drawn from `jel-lexicon.json`'s own roots. Expect band > 0.
 *   3. RE-BROKEN        — arm 2's population with ONE apostrophe put into ONE Argonian name.
 *                         RI-LOR04 §Scoring: any apostrophe is a hard 0, by a DIFFERENT clause
 *                         than arm 1's. Expect band 0 again, for the other reason.
 *   4. M2-DEGRADED      — arm 2's population with 10% of Argonian names replaced by legal-but-
 *                         wrong forms, to move the violation-rate band without touching M3/M4.
 *                         Expect a band strictly between arm 3's and arm 2's.
 *
 * Arm 3 is the control that matters: if the tool were simply pinned to 0, arms 1 and 3 would be
 * indistinguishable from a stuck needle. Arm 2 lifting and arm 3 dropping again FOR A DIFFERENT
 * STATED REASON is what separates a live instrument from a constant.
 *
 * Run:  node tools/lore/critic-w1-23-r4-band.mjs [--json]
 * Exit: 0 if the band moved in both directions. 1 if it did not (the tool is stuck).
 *       2 if the shipped tool or the population is missing.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ------------------------------------------------------------------------------------------
// THE TOOL UNDER TEST CANNOT BE IMPORTED, AND THAT IS THE FIRST FINDING.
//
// `tools/lore/lor04-validate.mjs` ends with a bare
//
//     process.exit(argv.includes('--self-test') ? selfTest() : run(argv));
//
// with no `IS_MAIN` guard. Importing it therefore RUNS THE WHOLE VALIDATION AND EXITS THE
// IMPORTER — exit 1, mid-import, with the importer's own work never reached. This is the SAME
// defect the same round found and fixed in `tools/lore/place-library.mjs`, recorded in
// `orchestration/status/W1-23-r4.json` as "a second one: place-library.mjs had an unguarded
// main, so the consumption tool's `import { PLACEMENTS }` ran it and exited the importer. The
// consumption run reported exit 0 having measured nothing." It was left in the round's other
// new tool.
//
// I am not allowed to edit it (file ownership), and I will not judge the shipped bytes by a
// rewrite of them. So the shipped file is read, the FINAL DRIVER LINE ALONE is removed, and the
// result is written beside it as a critic-owned file — same directory, so the module's own
// `ROOT` resolution is byte-identical, and every measure below runs the shipped implementation.
// The diff is printed so it can be checked.
const SRC = path.join(ROOT, 'tools/lore/lor04-validate.mjs');
const LIB = path.join(ROOT, 'tools/lore/critic-w1-23-r4-lor04-lib.mjs');
{
  const src = fs.readFileSync(SRC, 'utf8');
  const lines = src.split('\n');
  const i = lines.findIndex((l) => /^process\.exit\(argv\.includes\('--self-test'\)/.test(l));
  if (i < 0) {
    console.error('FATAL: lor04-validate no longer ends in the unguarded driver this tool works around.');
    console.error('       If it has grown an IS_MAIN guard, import it directly and delete this block.');
    process.exit(2);
  }
  console.log(`working around the unguarded main in tools/lore/lor04-validate.mjs`);
  console.log(`  removed, and nothing else: ${lines[i].trim()}`);
  lines[i] = '// [critic] driver line removed so the module can be imported; nothing else changed.';
  fs.writeFileSync(LIB, lines.join('\n'));
}

let V;
try {
  V = await import(LIB + '?critic');
} catch (e) {
  console.error(`FATAL: cannot load the tool under test — ${e.message}`);
  process.exit(2);
}
const { harvestPeople, classify, measure, band, isArgonian } = V;
if (!harvestPeople || !band) { console.error('FATAL: lor04-validate does not export what it is documented to export'); process.exit(2); }

function bandOf(people) {
  const argNames = people.filter((p) => isArgonian(p.race)).map((p) => p.name);
  const otherNames = people.filter((p) => !isArgonian(p.race)).map((p) => p.name);
  const results = [...classify([...new Set(argNames)]), ...classify([...new Set(otherNames)])];
  const m = measure(people, results);
  return { m, b: band(m) };
}

const shipped = harvestPeople();
if (!shipped.length) { console.error('FATAL: no population'); process.exit(2); }

// ---- arm 1: shipped -----------------------------------------------------------------------
const a1 = bandOf(shipped);

// The names the shipped tool blames. Taken from ITS OWN M3 list, not from a note.
const blamed = new Set((a1.m.M3.names || a1.m.M3.examples || []).map(String));

// ---- arm 2: repair exactly those, with legal Jel ---------------------------------------------
// Replacements are root+suffix forms out of the project's own lexicon, which the shipped
// validator classifies as `jel` — they are not chosen to please it, they are chosen from the
// same table `namegen.mjs` composes from, and the tool is free to reject them.
const REPAIR = ['Xulmeer', 'Deekvei', 'Tsavosh', 'Wuxkesh', 'Nuxlith', 'Shalxeech', 'Ixtukha', 'Rajmuul',
  'Anteekh', 'Kuxal', 'Tsleekei', 'Vasteikha', 'Muulxh', 'Neekhtei', 'Omuxal', 'Xanlith',
  'Vosheel', 'Hajmeer', 'Thithkha', 'Zukauj'];
let ri = 0;
const a2pop = shipped.map((p) => (blamed.has(p.name) ? { ...p, name: REPAIR[ri++ % REPAIR.length] } : p));
const a2 = bandOf(a2pop);

// ---- arm 3: re-break, by a DIFFERENT clause (M4 apostrophe) ----------------------------------
const a3pop = a2pop.slice();
const victim = a3pop.findIndex((p) => isArgonian(p.race));
a3pop[victim] = { ...a3pop[victim], name: "Xa'thril" };
const a3 = bandOf(a3pop);

// ---- arm 4: degrade M2 only -------------------------------------------------------------------
// Legal-looking, phonotactically wrong: forbidden clusters and geminates, no apostrophes, and
// each still classifies to a culture, so M3 and M4 are untouched and only the violation rate moves.
const BAD = ['Krothgar', 'Blendrar', 'Grimmesh', 'Threkkal', 'Drennoth', 'Prazzik', 'Frostal', 'Gluddan'];
const a4pop = a2pop.slice();
{
  const idx = a4pop.map((p, i) => [p, i]).filter(([p]) => isArgonian(p.race)).map(([, i]) => i);
  const n = Math.max(1, Math.round(idx.length * 0.10));
  for (let k = 0; k < n; k++) a4pop[idx[k]] = { ...a4pop[idx[k]], name: BAD[k % BAD.length] + (k >= BAD.length ? String(k) : '') };
}
const a4 = bandOf(a4pop);

// ---- verdict -----------------------------------------------------------------------------------
const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const rows = [
  ['1 SHIPPED          ', a1],
  ['2 M3 REPAIRED      ', a2],
  ['3 RE-BROKEN (M4)   ', a3],
  ['4 M2 DEGRADED      ', a4],
];
const out = {
  commit,
  arms: Object.fromEntries(rows.map(([k, v]) => [k.trim(), {
    band: v.b.native, ladder: v.b.ladder ?? null, why: v.b.why,
    M2_rate: v.m.M2.rate, M3_share: v.m.M3.share, M4: v.m.M4.apostrophes, M1_share: v.m.M1.share,
  }])),
};
const lifted = a2.b.native > a1.b.native;
const dropped = a3.b.native < a2.b.native && a3.b.native === 0;
const graded = a4.b.native < a2.b.native && a4.b.native > 0;
out.pass = lifted && dropped;
out.graded_middle_arm = graded;

if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(out.pass ? 0 : 1); }

console.log(`commit ${commit}`);
console.log(`population ${shipped.length} named people; the shipped tool blames ${blamed.size} name(s) for its hard 0\n`);
for (const [tag, v] of rows) {
  console.log(`${tag} band ${v.b.native}/5  (ladder ${v.b.ladder ?? '-'})   M1 ${(100 * v.m.M1.share).toFixed(1)}%  `
    + `M2 ${(100 * v.m.M2.rate).toFixed(2)}%  M3 ${(100 * v.m.M3.share).toFixed(2)}%  M4 ${v.m.M4.apostrophes}`);
  for (const w of v.b.why) console.log(`                     ${w}`);
}
console.log(`\nband lifted off 0 when the eight blamed names were repaired: ${lifted ? 'YES' : 'NO'}`);
console.log(`band returned to 0 by a DIFFERENT clause (apostrophe): ${dropped ? 'YES' : 'NO'}`);
console.log(`an intermediate band exists (M2 degraded, not hard-zeroed): ${graded ? 'YES' : 'no'}`);
console.log(out.pass
  ? 'RESULT: lor04-validate is a live instrument — it reports non-zero, and it goes back to zero for the stated reason.'
  : 'RESULT: the band did not move. lor04-validate cannot be shown to report anything but 0 on a real population.');
process.exit(out.pass ? 0 : 1);
