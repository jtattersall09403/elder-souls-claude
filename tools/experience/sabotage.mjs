#!/usr/bin/env node
// sabotage.mjs — THE SABOTAGE CONTROL, as a command any piece can run.
//
// `PLAYTHROUGH-CRITIC.md` §4.5 is binding: every number this project produces is only ever
// interpreted as a difference from a control, and §10 names "the control is never run" as the
// most likely failure in the corpus. The failure that actually happened here three times in one
// day is worse than that: **the control WAS run, exited 0, and measured nothing.**
//
// This command is the facility's front door and its falsifier.
//
//   node tools/experience/sabotage.mjs --self-test
//       Fourteen controls with known verdicts — one per verdict, plus the three collisions
//       critic-w1-25.mjs constructed — then a SEPARABILITY matrix requiring every case to reach
//       the verdict it declares AND no two cases declaring different verdicts to land on the
//       same one. Then the same fourteen with THIS FACILITY deliberately broken TEN ways, one
//       per check it contains. Exit 0 only if all fourteen behave, nine distinct verdicts are
//       covered with no collision, and every one of the ten breaks goes red. A break that leaves
//       its target green is named as an inert arm and fails the run — the rule the sibling
//       instrument `tools/harness/w1-16-r4-offline.mjs` set. RULES.md #4 applied to the
//       instrument that enforces RULES.md #4.
//
//   node tools/experience/sabotage.mjs --cases
//       Replays the FIVE real inert controls this tree shipped green, from ten cases (see
//       `sabotage-cases.mjs` for the artifact for every number). Exit 0 only if the facility
//       goes RED on each historically broken version and GREEN on each fixed one. The nine
//       artifacts are read from TRACKED TWINS under reports/experience/sabotage-corpus/, so a
//       fresh clone can run this; `tools/experience/sabotage-corpus.mjs` writes and hash-verifies
//       them.
//
//   node tools/experience/sabotage.mjs --self-test --cases --out reports/experience/w1/sabotage.json
//
//   node tools/experience/sabotage.mjs --break=comparator --self-test
//       Show it failing. Exit 0 here would mean the suite cannot detect its own defect.
//
// EXIT: 0 everything behaved · 2 INERT · 3 VACUOUS · 4 MASKED · 5 UNDERPOWERED ·
//       6 WRONG_DIRECTION · 7 ERROR (an arm threw, or the control declared no `support` / no
//       `unit`) · 8 a case could not be built from disk · 9 usage · 10 NO_MEASUREMENT ·
//       11 SHORT_CIRCUIT.
//
// USING IT FROM ANOTHER PIECE — the point of the whole file:
//
//   import { runControl, VERDICT } from './lib/sabotage.mjs';
//   const r = await runControl({
//     id: 'my-thing', what: '...', metric: 'hits landed',
//     factors: [{ id: 'guard', what: 'the check I added in foo.js' }],
//     unit: 'hits that reached the damage resolver',   // REQUIRED: what one unit of support is
//     measure: async (broken) => { ...; return { value, support }; },   // support is REQUIRED
//     margin: { kind: 'relative', min: 0.5 }, direction: 'lower',
//   });
//   if (!r.passed) { /* r.why says which of the three shapes it is */ }
//
// `tools/composition/matrix-probe.mjs` and `tools/experience/breakage-probe.mjs` both call it
// this way and neither re-implements "did the arms differ".
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runControl, runSuite, formatSuite, VERDICT, EXIT_FOR,
  breakFacility, repairFacility, facilityBreaks,
} from './lib/sabotage.mjs';
import { historicalCases, provenance, REPO } from './sabotage-cases.mjs';

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// The synthetic suite. Six controls whose right answer is known by construction, one per
// verdict. They are deliberately trivial: their job is to pin the facility's behaviour, not to
// measure the game. The REAL evidence that this facility works is `--cases`.

const UNIT = 'synthetic units the fixture declares it ranged over';

function syntheticSuite() {
  const fixed = (map, support = 10) => async (broken) => {
    const k = broken.slice().sort().join('+') || '(intact)';
    if (!(k in map)) throw new Error(`synthetic: no arm ${k}`);
    const v = map[k];
    return typeof v === 'object' && v !== null && 'value' in v ? v : { value: v, support };
  };
  return [
    // ---- one case per verdict. Nine verdicts, nine cases, and `--separability` requires every
    // one of them to produce a verdict none of the others produce. ------------------------------
    {
      id: 'synthetic.live', what: 'a control that works', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 40 }),
      margin: { kind: 'relative', min: 0.5 }, direction: 'lower',
    },
    {
      id: 'synthetic.inert', what: 'the W1-04 shape: breaking it changes nothing', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'a break verb that does not break anything' }],
      measure: fixed({ '(intact)': 100, g: 100 }),
      expect: VERDICT.INERT,
    },
    {
      id: 'synthetic.vacuous', what: 'the W1-13 shape: the control arm is empty', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }),
      expect: VERDICT.VACUOUS,
    },
    {
      id: 'synthetic.masked', what: 'the W1-SOULS shape: two guards, neither load-bearing alone', metric: 'n', unit: UNIT,
      factors: [{ id: 'a', what: 'guard A' }, { id: 'b', what: 'guard B' }],
      measure: fixed({ '(intact)': 252, a: 252, b: 252, 'a+b': 0 }),
      expect: VERDICT.MASKED,
    },
    {
      id: 'synthetic.underpowered', what: 'it moves, but not by the declared margin', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 96 }),
      margin: { kind: 'relative', min: 0.5 },
      expect: VERDICT.UNDERPOWERED,
    },
    {
      id: 'synthetic.wrong-direction', what: 'breaking it made the number go UP', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 180 }),
      direction: 'lower',
      expect: VERDICT.WRONG_DIRECTION,
    },
    // ---- ROUND 2: the two shapes that had no name --------------------------------------------
    {
      // Shape 5. Both arms measured `undefined` — the critic hit this with a misspelt field name
      // on a real artifact and round 1 answered INERT: a positive claim that the break changed
      // nothing, about a measurement that never happened.
      id: 'synthetic.no-measurement', what: 'a misspelt field: both arms return undefined', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': { value: undefined, support: 55 }, g: { value: undefined, support: 55 } }),
      expect: VERDICT.NO_MEASUREMENT,
    },
    {
      // Shape 4. W1-14-r3's `--break=nocast`, in miniature: the teardown stops the units reaching
      // the comparator, so the arms differ loudly about the removal and not about the mechanism.
      id: 'synthetic.short-circuit', what: 'the W1-14 shape: the teardown exits upstream of the comparator', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'a teardown that skips the cast entirely' }],
      measure: fixed({ '(intact)': { value: 33, support: 55 }, g: { value: 0, support: 4 } }),
      expect: VERDICT.SHORT_CIRCUIT,
    },
    {
      // Round 1's default answer to "you told me nothing" was OK, and `support` was optional.
      id: 'synthetic.support-undeclared', what: 'measure() returns no support at all', metric: 'n', unit: UNIT,
      factors: [{ id: 'g', what: 'the guard' }],
      measure: async (broken) => ({ value: broken.length ? 40 : 100 }),   // no `support` key
      expect: VERDICT.ERROR,
    },
  ];
}

/**
 * The three collisions the critic constructed, kept as fixtures with the answers round 2 owes
 * them. Run alongside the synthetic suite: these are the cases that were classified as something
 * else in round 1, and they are the acceptance for the cascade changes.
 */
function collisionSuite() {
  const fixed = (map, support = 10) => async (broken) => {
    const k = broken.slice().sort().join('+') || '(intact)';
    if (!(k in map)) throw new Error(`collision: no arm ${k}`);
    const v = map[k];
    return typeof v === 'object' && v !== null && 'value' in v ? v : { value: v, support };
  };
  const two = [{ id: 'a', what: 'guard A' }, { id: 'b', what: 'guard B' }];
  return [
    {
      // ROUND 1: UNDERPOWERED. MASKED was last in the cascade, so any unmet margin shadowed the
      // one verdict that exists to stop an agent deleting a guard in good faith.
      id: 'collide.masked-under-margin', what: 'two guards for one defect, joint effect 5%, 50% margin declared',
      metric: 'n', unit: UNIT, factors: two,
      measure: fixed({ '(intact)': 252, a: 252, b: 252, 'a+b': 240 }),
      margin: { kind: 'relative', min: 0.5 },
      expect: VERDICT.MASKED,
    },
    {
      // ROUND 1: INERT — on a control with a demonstrably live factor, while the same record's
      // `factors_that_move_it_alone` said ["a"] and the why-string said "changed nothing".
      id: 'collide.cancellation', what: 'factor A moves it 100->40; A+B restores it to 100',
      metric: 'n', unit: UNIT, factors: two,
      measure: fixed({ '(intact)': 100, a: 40, b: 100, 'a+b': 100 }),
      // no expect: this control DID demonstrate a live guard, so it passes — with `cancellation`
      // on the record and the all-broken arm named in `why` as the arm that carries no effect.
    },
    {
      // ROUND 1: VACUOUS, with the agreement never mentioned. Still VACUOUS (an empty population
      // is the more severe reading) but `concurrent_failures` now carries INERT beside it.
      id: 'collide.vacuous-and-inert', what: 'empty population AND agreeing arms',
      metric: 'n', unit: UNIT, factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': { value: 0, support: 0 }, g: { value: 0, support: 0 } }),
      expect: VERDICT.VACUOUS,
    },
    {
      // ROUND 1: OK. The canonical W1-13 case passed on a one-word spec change, because the
      // documented obligation on the escape hatch was enforced nowhere.
      id: 'collide.support-note-omitted', what: 'the W1-13 case with supportArms:"intact" and no support_note',
      metric: 'n', unit: UNIT, factors: [{ id: 'g', what: 'the guard' }],
      supportArms: 'intact',
      measure: fixed({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }),
      expect: VERDICT.ERROR,
    },
    {
      // ROUND 1: OK. A control that never said what it counted collected a pass.
      id: 'collide.unit-undeclared', what: 'a control that would pass and never said what one unit is',
      metric: 'n', factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 40 }),
      expect: VERDICT.ERROR,
    },
  ];
}

/**
 * The falsification half. Each entry names a defect injected into the facility itself and the
 * synthetic case that MUST stop behaving under it. If a break does not change any verdict, the
 * facility has a check that does no work and this command says so and exits non-zero.
 *
 * Round 1 had three; round 2 has ten, one per check added or changed. The rule the sibling
 * instrument `tools/harness/w1-16-r4-offline.mjs` set is the rule here: under the break EVERY
 * targeted arm must go red, and an arm that stays green is named as inert and fails the run.
 */
const FACILITY_BREAKS = [
  { id: 'comparator', must_break: 'synthetic.inert', why: 'valuesDiffer() always true — INERT becomes undetectable, which is exactly the W1-04 failure' },
  { id: 'support', must_break: 'synthetic.vacuous', why: 'support accounting off — an empty control arm reads as a real difference, which is exactly the W1-13 failure' },
  { id: 'factorial', must_break: 'synthetic.masked', why: 'only intact and all-broken arms are run — MASKED can never be reported, which is exactly the W1-SOULS failure' },
  { id: 'support-optional', must_break: 'synthetic.support-undeclared', why: 'ROUND 1 EXACTLY: a missing `support` silently becomes null and every check downstream skips the arm, so the facility answers OK to a control that told it nothing' },
  { id: 'null-is-a-value', must_break: 'synthetic.no-measurement', why: 'undefined stops counting as "nothing measured", so two unmeasured arms canonicalise to agreement and return INERT — the flagship verdict, produced by a typo' },
  { id: 'short-circuit-blind', must_break: 'synthetic.short-circuit', why: 'the support-collapse test is skipped, so a teardown that exits upstream of the comparator reads as a large clean effect' },
  { id: 'cascade-order', must_break: 'collide.masked-under-margin', why: 'MASKED goes back to the bottom of the cascade and is shadowed by any unmet margin — the collision the critic constructed' },
  { id: 'two-arm-agreement', must_break: 'collide.cancellation', why: '`the arms agree` goes back to intact-vs-all-broken alone, so a control with a live factor is reported INERT under cancellation' },
  { id: 'support-note-optional', must_break: 'collide.support-note-omitted', why: 'the escape hatch stops demanding its documented note, and the canonical W1-13 case passes on a one-word spec change' },
  { id: 'unit-optional', must_break: 'collide.unit-undeclared', why: 'a control that never said what one unit of support is collects a pass again' },
];

/** Everything the self-test runs on HEAD. */
const allSuite = () => [...syntheticSuite(), ...collisionSuite()];

/**
 * SEPARABILITY (the critic's standard, applied to nine verdicts instead of five).
 *
 * "Construct a case for each verdict that the other four would classify differently, and require
 * the facility to agree." Six canonical cases producing six distinct verdicts was round 1's
 * floor and it hid three collisions. So: every case in the suite declares the verdict it is
 * built for, and the matrix requires (a) the facility to agree with each declaration and (b) no
 * two declared-different cases to land on the same verdict. A cascade that collapses two
 * categories fails (b) even when every individual case still "passes".
 */
function separability(results) {
  const byVerdict = new Map();
  const rows = [];
  for (const r of results) {
    const declared = r.expected_verdict || VERDICT.OK;
    const agrees = r.verdict === declared;
    rows.push({ id: r.id, declared, got: r.verdict, agrees });
    if (!byVerdict.has(r.verdict)) byVerdict.set(r.verdict, []);
    byVerdict.get(r.verdict).push(r.id);
  }
  // Cases that declare DIFFERENT verdicts must not land on the same one.
  const collisions = [];
  for (const [v, ids] of byVerdict) {
    const declaredSet = new Set(ids.map((id) => (results.find((r) => r.id === id).expected_verdict || VERDICT.OK)));
    if (ids.length > 1 && declaredSet.size > 1) collisions.push({ verdict: v, cases: ids, declared: [...declaredSet] });
  }
  const covered = [...byVerdict.keys()].sort();
  return { rows, collisions, covered, ok: rows.every((r) => r.agrees) && collisions.length === 0 };
}

async function selfTest() {
  // A break forced on the command line must SURVIVE the falsification half, or `--break=X
  // --self-test` would silently measure an unbroken facility and report a pass.
  const forced = facilityBreaks();
  const resetToForced = () => { repairFacility(); for (const f of forced) breakFacility(f); };

  say('SELF-TEST — one synthetic control per verdict, plus the three collisions the critic built.');
  resetToForced();
  const clean = await runSuite(allSuite());
  say(formatSuite(clean));
  say('');

  const sep = separability(clean.results);
  say('SEPARABILITY — every case must reach the verdict it declares, and no two cases declaring');
  say('different verdicts may land on the same one.');
  say(`  verdicts covered (${sep.covered.length}): ${sep.covered.join(', ')}`);
  for (const r of sep.rows) if (!r.agrees) say(`  MISS  ${r.id} declared ${r.declared}, got ${r.got}`);
  for (const c of sep.collisions) say(`  COLLISION  ${c.cases.join(' + ')} all read ${c.verdict} while declaring ${c.declared.join('/')}`);
  say(`  ${sep.ok ? 'ok  ' : 'FAIL'}  ${sep.rows.filter((r) => r.agrees).length}/${sep.rows.length} agree, ${sep.collisions.length} collision(s).`);
  say('');

  if (forced.length) {
    say(`(falsification half skipped: the facility is already broken on purpose with --break=${forced.join(',')})`);
    return { ok: clean.ok && sep.ok, clean, sep, breaks: [] };
  }
  say('SELF-TEST, FALSIFICATION HALF — break the facility on purpose; each break must go red.');
  const breakRows = [];
  for (const b of FACILITY_BREAKS) {
    repairFacility();
    breakFacility(b.id);
    const broken = await runSuite(allSuite());
    repairFacility();
    const target = broken.judged.find((j) => j.id === b.must_break);
    const caught = target ? !target.ok : false;
    breakRows.push({ break: b.id, why: b.why, must_break: b.must_break, got: target ? target.verdict : null, caught });
    say(`  ${caught ? 'ok  ' : 'FAIL'}  --break=${b.id.padEnd(21)} ${b.must_break.padEnd(30)} -> ${target ? target.verdict : '(missing)'}` +
      `${caught ? '' : '   <-- STILL GREEN: the break changed nothing, so that check does no work'}`);
  }
  const stillGreen = breakRows.filter((r) => !r.caught).map((r) => r.break);
  const allCaught = stillGreen.length === 0;
  const ok = clean.ok && sep.ok && allCaught;
  say('');
  if (stillGreen.length) {
    say(`SELF-TEST FAILURE — these arms are INERT (the facility stayed green with the check removed): ${stillGreen.join(', ')}`);
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — ${clean.n - clean.failures.length}/${clean.n} verdicts correct, ` +
    `${sep.covered.length} distinct verdicts covered, ${sep.collisions.length} collision(s), ` +
    `${breakRows.filter((r) => r.caught).length}/${breakRows.length} injected defects caught.`);
  return { ok, clean, sep, breaks: breakRows };
}

async function historical() {
  say('HISTORICAL REPLAY — five controls this tree shipped green, replayed from the artifacts.');
  const { cases, absent } = historicalCases();
  const tracked = provenance.filter((p) => p.tracked).length;
  say(`  provenance: ${tracked}/${provenance.length} artifacts read from the TRACKED twin under ` +
      `reports/experience/sabotage-corpus/; ${provenance.length - tracked} fell back to a gitignored original.`);
  for (const p of provenance) if (!p.tracked) say(`    UNTRACKED  ${p.origin} — run sabotage-corpus.mjs --sync`);
  for (const a of absent) say(`  ABSENT  ${a.case}: ${a.why}`);
  if (!cases.length) {
    say('  no historical case could be built from disk. Nothing was measured.');
    return { ok: false, absent, suite: null };
  }
  const suite = await runSuite(cases);
  say(formatSuite(suite));
  return { ok: suite.ok && absent.length === 0, absent, suite };
}

async function main() {
  if (has('help') || argv.length === 0) {
    say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'));
    process.exit(argv.length === 0 ? 9 : 0);
  }
  for (const a of argv) if (a.startsWith('--break=')) breakFacility(a.slice('--break='.length));
  const forced = facilityBreaks();
  if (forced.length) say(`!! FACILITY DELIBERATELY BROKEN: ${forced.join(', ')} — a PASS here is a FAILURE of the suite.\n`);

  const out = { tool: 'tools/experience/sabotage.mjs', at: new Date().toISOString(), forced_breaks: forced };
  let bad = 0, worst = 0;

  if (has('self-test')) {
    const st = await selfTest();
    out.self_test = { ok: st.ok, results: st.clean.results, separability: st.sep, breaks: st.breaks, failures: st.clean.failures };
    if (!st.ok) { bad++; worst = Math.max(worst, 1); }
    say('');
  }
  if (has('cases')) {
    const h = await historical();
    out.historical = {
      ok: h.ok,
      provenance: [...provenance],
      absent: h.absent,
      results: h.suite ? h.suite.results : [],
      failures: h.suite ? h.suite.failures : ['no case could be built'],
    };
    if (!h.ok) {
      bad++;
      if (h.absent.length && !h.suite) worst = Math.max(worst, 8);
      else if (h.suite) worst = Math.max(worst, EXIT_FOR[(h.suite.results.find((r) => (r.expected_verdict ? !r.as_expected : !r.passed)) || {}).verdict] || 1);
    }
    say('');
  }
  if (!has('self-test') && !has('cases')) { say('nothing selected: pass --self-test and/or --cases'); process.exit(9); }

  const o = arg('out', null);
  if (o) {
    const p = path.isAbsolute(o) ? o : path.join(REPO, o);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    say(`wrote ${path.relative(REPO, p)}`);
  }

  // With a deliberate break in place the suite is SUPPOSED to fail; exit 0 only when it did.
  if (forced.length) {
    const failed = bad > 0;
    say(failed
      ? `ok — the facility went red under --break=${forced.join(',')}, which is what RULES #4 asks of it.`
      : `FAIL — the facility stayed green with ${forced.join(',')} broken. It cannot detect its own defect.`);
    process.exit(failed ? 0 : 1);
  }
  process.exit(bad ? (worst || 1) : 0);
}

main().catch((e) => { console.error('sabotage: ' + ((e && e.stack) || e)); process.exit(7); });
