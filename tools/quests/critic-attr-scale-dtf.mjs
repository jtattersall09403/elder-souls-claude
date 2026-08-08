#!/usr/bin/env node
// critic-attr-scale-dtf.mjs — the W1-ATTR-SCALE critic's own delete-the-fix, plus the two
// things the builder's instrument does not report about itself.
//
// ---------------------------------------------------------------------------------------------
// 1. DELETE-THE-FIX, LIKE FOR LIKE
// ---------------------------------------------------------------------------------------------
// The builder's 42 edits landed inside e7ed252, a commit that ALSO carried W1-FACTIONS-r2 growing
// three faction files from 8 quests to 17 and reformatting them 2-space to 1-space. So
// `git show e7ed252^:<file>` is NOT a control arm — it is a different tree with different
// content, and comparing against it would measure the faction round, not this one.
//
// Instead: load the pre-fix book and the current book, and for every (quest, resolution, kind)
// that exists in BOTH, restore the pre-fix requires block on an in-memory copy of the CURRENT
// tree. Nothing is written to disk. That is the builder's own method, re-implemented from the
// reference item rather than from its code, which is the only version of it a critic may use.
//
// This tool FAILS (exit 1) when the revert does NOT change the numbers, because a delete-the-fix
// whose control arm is identical to its positive arm is the inert control RULES.md rule 6 names,
// and it is the failure this project has paid for most often. `--self-test` proves that: it
// reverts nothing and requires the tool to go red.
//
// ---------------------------------------------------------------------------------------------
// 2. THE RESERVE, MEASURED AGAINST WHAT A CHARACTER CAN ACTUALLY REACH
// ---------------------------------------------------------------------------------------------
// attr-scale-audit's whole argument is its RESERVE of 2: "one more than the margin that failed"
// in W1-19 round 1, where nine gates clamped to exactly the ceiling shut Act IV for 11 of 40
// signatures. The reserve is subtracted from `reachable_ceiling`, which is
//
//     at_creation + earned_points + bought_points
//
// and `bought_points` was added to the sweep by W1-SOULS **29 minutes after this piece landed**,
// raising every ceiling by exactly 2 — the size of the reserve. This prints, per attribute, the
// tool's own caps beside the ceiling reachable WITHOUT the bought stream, so the margin the
// reserve actually buys is a number rather than an assumption.
//
// ---------------------------------------------------------------------------------------------
// 3. THE INJECTION SWEEP
// ---------------------------------------------------------------------------------------------
// Break the check on purpose: walk a demand up through every band on the resolution this piece
// fixed and print where the auditor starts calling it a defect. An instrument that never goes
// red is not an instrument.
//
// Run:  node tools/quests/critic-attr-scale-dtf.mjs [--base <git-ref>] [--list] [--json]
//       node tools/quests/critic-attr-scale-dtf.mjs --self-test
// Exit: 0 the fix reproduces, 1 it does not (or the self-test caught a hole), 2 cannot run.
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audit, loadBook, RESERVE } from './attr-scale-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

/** The commit that carried the W1-ATTR-SCALE edits. Its parent is the pre-fix tree. */
const DEFAULT_BASE = 'e7ed252^';

function checkoutQuestBook(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attr-dtf-'));
  let names;
  try {
    names = execFileSync('git', ['ls-tree', '--name-only', ref, 'game/data/quests/'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter((s) => s.endsWith('.json'));
  } catch (e) {
    console.error(`critic-attr-scale-dtf: cannot read '${ref}' from git — ${e.message}`);
    process.exit(2);
  }
  if (!names.length) { console.error(`critic-attr-scale-dtf: '${ref}' has no game/data/quests/*.json`); process.exit(2); }
  for (const n of names) {
    const buf = execFileSync('git', ['show', `${ref}:${n}`], { cwd: ROOT, maxBuffer: 1 << 28 });
    fs.writeFileSync(path.join(dir, path.basename(n)), buf);
  }
  return { dir, files: names.length };
}

/** Restore `old`'s requires.attributes / requires.skills onto a deep copy of `now`. */
function revertOnto(now, old, { enabled = true } = {}) {
  const ix = new Map();
  for (const { quest: q } of old) {
    for (const r of q.resolutions || []) {
      ix.set(`${q.id}::${r.id}`, {
        attributes: { ...((r.requires || {}).attributes || {}) },
        skills: { ...((r.requires || {}).skills || {}) },
      });
    }
  }
  const copy = JSON.parse(JSON.stringify(now));
  const changes = [];
  if (!enabled) return { book: copy, changes };     // --self-test's null arm
  for (const { file, quest: q } of copy) {
    for (const r of q.resolutions || []) {
      const o = ix.get(`${q.id}::${r.id}`);
      if (!o) continue;
      r.requires = r.requires || {};
      for (const kind of ['attributes', 'skills']) {
        const cur = r.requires[kind] || {};
        if (JSON.stringify(cur) === JSON.stringify(o[kind])) continue;
        changes.push({ file, quest: q.id, resolution: r.id, kind, from: { ...cur }, to: { ...o[kind] } });
        r.requires[kind] = { ...o[kind] };
        if (!Object.keys(o[kind]).length) delete r.requires[kind];
      }
    }
  }
  return { book: copy, changes };
}

const row = (r) => ({
  defects: r.counts.defects,
  ladder_inversions: r.ladder_inversions,
  nonviolent_resolutions_reachable: r.non_combat.nonviolent_resolutions_reachable,
  nonviolent_resolutions_authored: r.non_combat.nonviolent_resolutions_authored,
  nonviolent_resolution_pct: +(r.non_combat.nonviolent_resolution_fraction * 100).toFixed(1),
  shut_by_defect: r.non_combat.nonviolent_resolutions_shut_by_defect,
  quest_level_reachable: r.non_combat.quests_with_a_nonviolent_resolution_REACHABLE,
  quests: r.counts.quests,
});
const differs = (a, b) => JSON.stringify(row(a)) !== JSON.stringify(row(b));

function load() {
  const sweepPath = path.join(ROOT, 'reports/faction-signature-sweep.json');
  if (!fs.existsSync(sweepPath)) {
    console.error('critic-attr-scale-dtf: reports/faction-signature-sweep.json does not exist — no ceilings, no audit.');
    console.error('Run: node tools/quests/faction-signature-sweep.mjs --out reports/faction-signature-sweep.json');
    process.exit(2);
  }
  return {
    sweep: JSON.parse(fs.readFileSync(sweepPath, 'utf8')),
    skillsDoc: JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/skills.json'), 'utf8')),
    now: loadBook(path.join(ROOT, 'game/data/quests')),
  };
}

// ---------------------------------------------------------------------------------------------
// self-test: the control arm must be able to go red
// ---------------------------------------------------------------------------------------------
function selfTest() {
  const { sweep, skillsDoc, now } = load();
  const { dir } = checkoutQuestBook(arg('base', DEFAULT_BASE));
  const old = loadBook(dir);
  const bad = [];

  // 1. A revert that reverts NOTHING must be reported as no-change, not as a reproduction.
  const nul = revertOnto(now, old, { enabled: false });
  if (differs(audit(now, sweep, skillsDoc, 'p10'), audit(nul.book, sweep, skillsDoc, 'p10'))) {
    bad.push('the null revert changed the numbers — the copy is not a copy');
  }
  if (nul.changes.length !== 0) bad.push('the null revert reported changes');

  // 2. The real revert must change them. If it does not, there is nothing to delete.
  const real = revertOnto(now, old);
  if (!differs(audit(now, sweep, skillsDoc, 'p10'), audit(real.book, sweep, skillsDoc, 'p10'))) {
    bad.push('the real revert changed nothing — the fix is inert, or the base is wrong');
  }

  // 3. The auditor must go red on an injected defect and green without it. A classifier that
  //    cannot fail would make every number above meaningless.
  const inject = (need) => {
    const b = JSON.parse(JSON.stringify(now));
    for (const { quest: q } of b) for (const r of q.resolutions || []) {
      if (q.id === 'Q-BLAK-01' && r.id === 'res_hold') {
        r.requires = r.requires || {};
        r.requires.attributes = { ...(r.requires.attributes || {}), personality: need };
      }
    }
    return audit(b, sweep, skillsDoc, 'p10').counts.defects;
  };
  if (inject(99) === 0) bad.push('personality 99 is not a defect — the attribute classifier is dead');
  if (inject(10) !== 0) bad.push('personality 10 is a defect — the attribute classifier fires on everything');

  fs.rmSync(dir, { recursive: true, force: true });
  for (const b of bad) console.log(`  RED  ${b}`);
  console.log(`critic-attr-scale-dtf --self-test: ${4 - bad.length}/4`);
  return bad.length;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
if (has('self-test')) process.exit(selfTest() ? 1 : 0);

const { sweep, skillsDoc, now } = load();
const base = arg('base', DEFAULT_BASE);
const { dir, files } = checkoutQuestBook(base);
const old = loadBook(dir);
const { book: reverted, changes } = revertOnto(now, old);

const sheet = arg('sheet', 'p10');
const A = audit(now, sweep, skillsDoc, sheet);
const B = audit(reverted, sweep, skillsDoc, sheet);

const renames = changes.filter((c) => JSON.stringify(Object.keys(c.from).sort()) !== JSON.stringify(Object.keys(c.to).sort()));
let cells = 0;
for (const c of changes) for (const k of new Set([...Object.keys(c.from), ...Object.keys(c.to)])) if (c.from[k] !== c.to[k]) cells++;

// the reserve, measured
const margins = {};
for (const [a, c] of Object.entries(sweep.per_attribute)) {
  const rc = c.reachable_ceiling;
  margins[a] = {
    bought_points: c.bought_points === undefined ? null : c.bought_points,
    hard_cap_the_tool_enforces: rc.from_median - RESERVE,
    ceiling_without_the_bought_stream_median: c.at_creation.median + c.earned_points,
    margin_at_hard_cap: (c.at_creation.median + c.earned_points) - (rc.from_median - RESERVE),
    specialist_cap_the_tool_enforces: rc.from_p10 - RESERVE,
    ceiling_without_the_bought_stream_p10: c.at_creation.p10 + c.earned_points,
    margin_at_specialist_cap: (c.at_creation.p10 + c.earned_points) - (rc.from_p10 - RESERVE),
  };
}

// the injection sweep
const injection = [];
for (const need of [16, 18, 20, 21, 22, 23, 24, 25, 32, 34, 99]) {
  const b = JSON.parse(JSON.stringify(now));
  for (const { quest: q } of b) for (const r of q.resolutions || []) {
    if (q.id === 'Q-BLAK-01' && r.id === 'res_hold') {
      r.requires = r.requires || {};
      r.requires.attributes = { ...(r.requires.attributes || {}), personality: need };
    }
  }
  const rep = audit(b, sweep, skillsDoc, sheet);
  const d = rep.demands.find((x) => x.quest === 'Q-BLAK-01' && x.resolution === 'res_hold' && x.key === 'personality');
  injection.push({ need, band: d.band, defect: d.defect, auditor_exit: rep.counts.defects ? 1 : 0 });
}

const reproduces = differs(A, B);
const out = {
  tool: 'critic-attr-scale-dtf', base, base_files: files, sheet,
  sweep_is_tracked_by_git: false,
  sweep_note: 'reports/faction-signature-sweep.json is gitignored (reports/.gitignore). Every band below is a claim about a file that is not in the commit.',
  resolutions_reverted: changes.length, key_renames: renames.length, demand_cells_reverted: cells,
  current: row(A), reverted: row(B), reproduces,
  defect_bands_after_revert: B.defects.reduce((m, d) => ({ ...m, [d.band]: (m[d.band] || 0) + 1 }), {}),
  reserve_margins: margins,
  injection_sweep: injection,
};
fs.rmSync(dir, { recursive: true, force: true });

if (has('json')) { console.log(JSON.stringify(out, null, 2)); process.exit(reproduces ? 0 : 1); }

console.log(`critic-attr-scale-dtf — delete-the-fix against ${base} (${files} quest files), sheet ${sheet}.`);
console.log(`reports/faction-signature-sweep.json is GITIGNORED: every ceiling below is a claim about a file the commit does not contain.\n`);
console.log(`resolutions reverted ${changes.length}  (key renames ${renames.length}, demand cells ${cells})\n`);
const fmt = (t, r) => `${t.padEnd(10)} defects=${String(r.defects).padStart(3)}  ladder_inversions=${r.ladder_inversions}  ` +
  `nonviolent ${r.nonviolent_resolutions_reachable}/${r.nonviolent_resolutions_authored} = ${r.nonviolent_resolution_pct}%  ` +
  `shut_by_defect=${r.shut_by_defect}  quest-level ${r.quest_level_reachable}/${r.quests}`;
console.log(fmt('CURRENT', out.current));
console.log(fmt('REVERTED', out.reverted));
console.log(`\ndefect bands after revert: ${JSON.stringify(out.defect_bands_after_revert)}`);
console.log(`\nTHE RESERVE, MEASURED. The tool subtracts ${RESERVE} from a ceiling that now includes a bought`);
console.log(`stream. This is the margin that survives if the bought stream is not spent on that attribute:`);
console.log('  attribute      hard cap   ceiling w/o bought   margin    specialist cap   p10 w/o bought   margin');
for (const [a, m] of Object.entries(margins)) {
  console.log(`  ${a.padEnd(13)} ${String(m.hard_cap_the_tool_enforces).padStart(6)}   ${String(m.ceiling_without_the_bought_stream_median).padStart(16)}   ${String(m.margin_at_hard_cap).padStart(6)}   ${String(m.specialist_cap_the_tool_enforces).padStart(14)}   ${String(m.ceiling_without_the_bought_stream_p10).padStart(14)}   ${String(m.margin_at_specialist_cap).padStart(6)}`);
}
console.log('\nINJECTION SWEEP — a personality demand walked up through the bands on Q-BLAK-01 res_hold:');
for (const i of injection) console.log(`  personality ${String(i.need).padStart(3)} -> ${i.band.padEnd(12)} defect=${i.defect}  auditor exit ${i.auditor_exit}`);
if (has('list')) {
  console.log('\nreverted cells:');
  for (const c of changes) console.log(`  ${c.quest} ${c.resolution} ${c.kind}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
}
console.log(`\n${reproduces ? 'THE FIX REPRODUCES: the control arm is genuinely different from the positive arm.'
  : 'THE FIX DOES NOT REPRODUCE: reverting all 42 edits changed nothing. Inert fix, or wrong base.'}`);
process.exit(reproduces ? 0 : 1);
