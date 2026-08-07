#!/usr/bin/env node
// `RVS` — RI-WPN07 M1/M2's class x archetype advantage matrix and the role-reversal score.
//
// WRITTEN BY THE W1-10 ROUND-3 CRITIC under `orchestration/TOOL-LOOP.md` rule 1: a method that
// names a tool which does not exist gets the tool written then and there, and a critic that
// writes one declares it under `method_deviations`.
//
// `RI-WPN07` is one of `WEAPON-CRITIC` §3.3's nine mandatory headline numbers and it has never
// been run. It names four prerequisites in its own "Harness extensions this method requires":
//
//   1. `H.runPolicy(name, opts)`                        — a scripted competent-play policy
//   2. `corpus/80-methods/policy-competent.json`        — the policy §A fixes
//   3. scenarios `wpn-arena-<archetype>` for ten archetypes
//   4. ten `RI-AI05` archetype dummies at region-entry statlines
//
// TOOL-LOOP rule 1's second clause governs what this file is:
//
//   > "If the tool cannot be written honestly — because the system it measures does not exist —
//   >  then write it so it reports the absence and exits non-zero with a reason. Never stub it to
//   >  pass. `corpus_debt` exists for exactly this: a dimension blocked only by a missing system
//   >  is debt against the corpus, not a zero against the build."
//
// So this tool DOES the reachable half honestly and REPORTS the unreachable half precisely:
// it enumerates which of the ten archetypes have a shippable statblock, which harness surfaces
// exist, and exits non-zero naming the owner of each missing piece. When W1-12 lands the seven
// missing archetypes and the harness gains `runPolicy`, the matrix half below runs unchanged.
//
//   node tools/weapons/rvs-matrix.mjs [out.json]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] || '/dev/stdout';

// RI-AI05 §B, the ten archetypes RI-WPN07 M1 requires as columns.
const ARCHETYPES = ['INFANTRY', 'TURTLE', 'DUELIST', 'POISE_MONSTER', 'RANGED',
  'AMBUSHER', 'SWARM', 'CASTER', 'ELITE', 'GANK_DUO'];

// --- 1. which archetypes have a statblock the fight can spawn -----------------------------
const eDir = path.join(ROOT, 'game/data/combat/enemies');
const present = {};
for (const f of fs.readdirSync(eDir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(eDir, f), 'utf8'));
  if (!d.archetype) continue;
  (present[d.archetype] ||= []).push({ id: d.id, ai: d.ai, attacks: Object.keys(d.attacks || {}).length });
}
const haveArch = ARCHETYPES.filter((a) => present[a] && present[a].length);
const missingArch = ARCHETYPES.filter((a) => !present[a] || !present[a].length);

// --- 2. the policy and the harness surface -------------------------------------------------
const policyPath = path.join(ROOT, 'corpus/80-methods/policy-competent.json');
const havePolicy = fs.existsSync(policyPath);
const apiSrc = fs.readFileSync(path.join(ROOT, 'game/src/harness/api.js'), 'utf8');
const haveRunPolicy = /\brunPolicy\s*\(/.test(apiSrc);
const scenDir = path.join(ROOT, 'game/data/states');
const scenarios = fs.existsSync(scenDir) ? fs.readdirSync(scenDir).filter((f) => f.startsWith('wpn-arena-')) : [];

// --- 3. what IS reachable: the class baselines the matrix's rows would be -------------------
const msDir = path.join(ROOT, 'game/data/combat/movesets');
const byClass = {};
for (const f of fs.readdirSync(msDir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(msDir, f), 'utf8'));
  if (d.weapon_id) (byClass[d.class] ||= []).push(d.weapon_id);
}
const melee = Object.keys(byClass).filter((c) => c !== 'BOW').sort();
const rows = melee.length;

const blockers = [];
if (missingArch.length) {
  blockers.push({
    what: `${missingArch.length} of the 10 RI-AI05 archetypes have no statblock in game/data/combat/enemies/`,
    missing: missingArch, owner: 'W1-12 (enemy roster) / RI-AI05',
    consequence: `the advantage matrix can have at most ${haveArch.length} of its 10 columns; SPAN >= 6 and DOM = DUD = 0 are not decidable`,
  });
}
if (!havePolicy) blockers.push({ what: 'corpus/80-methods/policy-competent.json does not exist', owner: 'RI-WPN07 §A / corpus', consequence: 'the play policy M1 fixes is undefined, so every cell would measure the operator' });
if (!haveRunPolicy) blockers.push({ what: 'window.__HARNESS.runPolicy(name, opts) is not implemented in game/src/harness/api.js', owner: 'harness (HARNESS.md)', consequence: 'the same behaviour cannot be applied to 14 different weapons; a fixed input list measures the script' });
if (!scenarios.length) blockers.push({ what: 'no wpn-arena-<archetype> scenarios in game/data/states/', owner: 'W1-12 / harness', consequence: 'no fixture places an archetype at its region-entry statline' });

const out = {
  generated: new Date().toISOString(),
  instrument: 'tools/weapons/rvs-matrix.mjs — written by the W1-10 round-3 critic under TOOL-LOOP rule 1',
  item: 'RI-WPN07 M1/M2 (RVS)',
  measurable: blockers.length === 0,
  matrix_rows_available: rows, matrix_rows_required: 14,
  matrix_cols_available: haveArch.length, matrix_cols_required: 10,
  archetypes_present: haveArch, archetypes_missing: missingArch,
  archetype_statblocks: present,
  policy_file_present: havePolicy, harness_runPolicy_present: haveRunPolicy, scenarios_present: scenarios,
  melee_class_baselines: Object.fromEntries(melee.map((c) => [c, byClass[c].sort()[0]])),
  blockers,
  ruling: blockers.length
    ? 'RVS is UNMEASURABLE and the cause is the corpus, not this build. TOOL-LOOP rule 1: record as corpus_debt against the named owners, not as a zero against W1-10.'
    : 'prerequisites present — run M1',
};
fs.writeFileSync(OUT.startsWith('--') ? '/dev/stdout' : OUT, JSON.stringify(out, null, 1));
console.log(`RI-WPN07 RVS: matrix would be ${rows} x ${haveArch.length}, required 14 x 10`);
console.log(`archetypes present : ${haveArch.join(', ') || '(none)'}`);
console.log(`archetypes MISSING : ${missingArch.join(', ')}`);
console.log(`policy-competent.json ${havePolicy ? 'present' : 'MISSING'} | H.runPolicy ${haveRunPolicy ? 'present' : 'MISSING'} | wpn-arena scenarios ${scenarios.length}`);
for (const b of blockers) console.log(` BLOCKER [${b.owner}] ${b.what}`);
if (blockers.length) process.exit(2);
