#!/usr/bin/env node
// method-guard-control.mjs — W1-FACTIONS round 3. GAP-FCT-02.
//
// A PERMANENT control for the build's only violence-consistency guard
// (`game/src/sim/quest/defs.js`, "resolution X is method Y and violence_required true").
//
// WHY IT EXISTS. The guard worked by membership in `RES_METHODS_NONVIOLENT`. A `method` value the
// set had never heard of was silently waved through, so the guard was blind to 38 of the build's
// 383 resolutions and nothing said so. The round-2 critic proved it with a throwaway script; a
// throwaway script cannot stop it happening again. This is that script, kept, and run by
// `tools/check-quests.mjs`.
//
// It does not check that the data is clean. It checks that THE GUARD CAN STILL SAY NO — by
// breaking the data on purpose, in memory, and demanding red:
//
//   CONTROL   a method that has always been in the set (`refuse`) + violence_required:true
//             -> must go RED. If it does not, the harness is not reaching the guard at all.
//   TEST      each of round 2's five new methods + violence_required:true
//             -> must go RED. Before the fix, all five went GREEN.
//   VOCAB     a method nobody has ever declared (`gaslight`)
//             -> must go RED, because the vocabulary is closed.
//   BASELINE  the shipped data, unmutated -> must be CLEAN.
//
// Exit 0 = every mutation went red and the baseline is clean. Any other exit means the guard is
// not doing its job and no "check-quests PASS" in this build may be cited about violence.
//
//   node tools/quests/method-guard-control.mjs [--quiet]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestBook } from '../../game/src/sim/quest/defs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QDIR = path.join(ROOT, 'game/data/quests');
const QUIET = process.argv.includes('--quiet');
const say = (s) => { if (!QUIET) console.log(s); };

/** Load the quest docs the way `Engine` does: id -> parsed file. */
function loadDocs() {
  const docs = {};
  for (const f of fs.readdirSync(QDIR).sort()) {
    if (!f.endsWith('.json') || f === 'hooks.json') continue;
    docs[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  }
  return docs;
}

/** Every problem the book reports, whether it throws on load or collects. */
function problemsOf(docs) {
  try {
    const b = new QuestBook(docs);
    return b.problems || [];
  } catch (e) {
    return [`THREW: ${String(e.message || e)}`];
  }
}

const MENTIONS = (probs, resId) => probs.filter((p) => p.includes(resId));

// ---- BASELINE ------------------------------------------------------------------------------
const base = problemsOf(loadDocs());
say(`baseline QuestBook over game/data/quests/**: ${base.length ? `${base.length} problem(s)` : 'clean'}`);
for (const p of base.slice(0, 8)) say(`    ${p}`);

// Pick a real victim: the first resolution in the build for each method we want to test, so the
// mutation is applied to shipped content and not to a fixture this tool made up.
function findVictim(docs, pred) {
  for (const key of Object.keys(docs).sort()) {
    for (const q of docs[key].quests || []) {
      for (const r of q.resolutions || []) if (pred(r, q)) return { file: key, quest: q.id, res: r.id };
    }
  }
  return null;
}

/** Mutate one resolution in a FRESH copy of the docs and ask the guard. */
function mutate(where, patch) {
  const docs = loadDocs();
  for (const q of docs[where.file].quests || []) {
    if (q.id !== where.quest) continue;
    for (const r of q.resolutions || []) if (r.id === where.res) Object.assign(r, patch);
  }
  return problemsOf(docs);
}

const cases = [];
function runCase(label, methodForVictim, patch, must) {
  const v = findVictim(loadDocs(), (r) => r.method === methodForVictim && r.violence_required !== true);
  if (!v) { cases.push({ label, ok: false, note: `no shipped resolution with method ${methodForVictim} to mutate` }); return; }
  const probs = mutate(v, patch);
  const mine = MENTIONS(probs, v.res).filter((p) => !MENTIONS(base, v.res).includes(p));
  const red = mine.length > 0;
  cases.push({ label, victim: `${v.quest}.${v.res}`, method_used: methodForVictim, red, expected_red: must, ok: red === must, problem: mine[0] || null });
}

// CONTROL — a method that has been in the set since the guard was written.
runCase('CONTROL refuse', 'refuse', { violence_required: true }, true);

// TEST — round 2's five.
for (const m of ['comply', 'expose', 'lie', 'sabotage', 'investigate']) {
  runCase(`TEST ${m}`, m, { violence_required: true }, true);
}

// VOCAB — a word nobody declared. Applied to a `persuade` victim so only the method changes.
runCase('VOCAB gaslight', 'persuade', { method: 'gaslight' }, true);

// NEGATIVE CONTROL — the guard must NOT fire on an untouched non-violent resolution. Without
// this, a guard that reported every resolution as a problem would score 7/7 above.
{
  const v = findVictim(loadDocs(), (r) => r.method === 'comply' && r.violence_required !== true);
  const probs = v ? mutate(v, {}) : [];
  const mine = v ? MENTIONS(probs, v.res).filter((p) => !MENTIONS(base, v.res).includes(p)) : ['no victim'];
  cases.push({ label: 'NEGATIVE unmutated comply', victim: v && `${v.quest}.${v.res}`, red: mine.length > 0, expected_red: false, ok: mine.length === 0, problem: mine[0] || null });
}

say('');
for (const c of cases) {
  say(`  ${c.ok ? 'pass' : 'FAIL'}  ${c.label.padEnd(26)} ${c.victim || ''} -> guard ${c.red ? 'RED' : 'GREEN'} (wanted ${c.expected_red ? 'RED' : 'GREEN'})`);
  if (c.problem) say(`          ${c.problem}`);
  if (c.note) say(`          ${c.note}`);
}

const passed = cases.filter((c) => c.ok).length;
const baselineClean = base.length === 0;
say(`\nbaseline clean: ${baselineClean}   guard control: ${passed}/${cases.length}`);
const ok = baselineClean && passed === cases.length;
say(ok ? 'PASS — the violence guard can still say no' : 'FAIL — the violence guard is blind or the shipped data is dirty');
process.exit(ok ? 0 : 1);
