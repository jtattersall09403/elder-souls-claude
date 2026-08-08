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
//       Six synthetic controls with known verdicts, then the same six with THIS FACILITY
//       deliberately broken in three ways. Exit 0 only if all six behave and all three breaks
//       are caught. RULES.md #4 applied to the instrument that enforces RULES.md #4.
//
//   node tools/experience/sabotage.mjs --cases
//       Replays the three real inert controls this tree shipped green (see
//       `sabotage-cases.mjs` for the artifact for every number). Exit 0 only if the facility
//       goes RED on each historically broken version and GREEN on each fixed one.
//
//   node tools/experience/sabotage.mjs --self-test --cases --out reports/experience/w1/sabotage.json
//
//   node tools/experience/sabotage.mjs --break=comparator --self-test
//       Show it failing. Exit 0 here would mean the suite cannot detect its own defect.
//
// EXIT: 0 everything behaved · 2 INERT · 3 VACUOUS · 4 MASKED · 5 UNDERPOWERED ·
//       6 WRONG_DIRECTION · 7 an arm threw · 8 a case could not be built from disk · 9 usage.
//
// USING IT FROM ANOTHER PIECE — the point of the whole file:
//
//   import { runControl, VERDICT } from './lib/sabotage.mjs';
//   const r = await runControl({
//     id: 'my-thing', what: '...', metric: 'hits landed',
//     factors: [{ id: 'guard', what: 'the check I added in foo.js' }],
//     measure: async (broken) => { ...; return { value, support }; },
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
import { historicalCases, REPO } from './sabotage-cases.mjs';

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// The synthetic suite. Six controls whose right answer is known by construction, one per
// verdict. They are deliberately trivial: their job is to pin the facility's behaviour, not to
// measure the game. The REAL evidence that this facility works is `--cases`.

function syntheticSuite() {
  const fixed = (map, support = 10) => async (broken) => {
    const k = broken.slice().sort().join('+') || '(intact)';
    if (!(k in map)) throw new Error(`synthetic: no arm ${k}`);
    const v = map[k];
    return typeof v === 'object' && v !== null && 'value' in v ? v : { value: v, support };
  };
  return [
    {
      id: 'synthetic.live', what: 'a control that works', metric: 'n',
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 40 }),
      margin: { kind: 'relative', min: 0.5 }, direction: 'lower',
    },
    {
      id: 'synthetic.inert', what: 'the W1-04 shape: breaking it changes nothing', metric: 'n',
      factors: [{ id: 'g', what: 'a break verb that does not break anything' }],
      measure: fixed({ '(intact)': 100, g: 100 }),
      expect: VERDICT.INERT,
    },
    {
      id: 'synthetic.vacuous', what: 'the W1-13 shape: the control arm is empty', metric: 'n',
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }),
      expect: VERDICT.VACUOUS,
    },
    {
      id: 'synthetic.masked', what: 'the W1-SOULS shape: two guards, neither load-bearing alone', metric: 'n',
      factors: [{ id: 'a', what: 'guard A' }, { id: 'b', what: 'guard B' }],
      measure: fixed({ '(intact)': 252, a: 252, b: 252, 'a+b': 0 }),
      expect: VERDICT.MASKED,
    },
    {
      id: 'synthetic.underpowered', what: 'it moves, but not by the declared margin', metric: 'n',
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 96 }),
      margin: { kind: 'relative', min: 0.5 },
      expect: VERDICT.UNDERPOWERED,
    },
    {
      id: 'synthetic.wrong-direction', what: 'breaking it made the number go UP', metric: 'n',
      factors: [{ id: 'g', what: 'the guard' }],
      measure: fixed({ '(intact)': 100, g: 180 }),
      direction: 'lower',
      expect: VERDICT.WRONG_DIRECTION,
    },
  ];
}

/**
 * The falsification half. Each entry names a defect injected into the facility itself and the
 * synthetic case that MUST stop behaving under it. If a break does not change any verdict, the
 * facility has a check that does no work and this command says so and exits non-zero.
 */
const FACILITY_BREAKS = [
  { id: 'comparator', must_break: 'synthetic.inert', why: 'valuesDiffer() always true — INERT becomes undetectable, which is exactly the W1-04 failure' },
  { id: 'support', must_break: 'synthetic.vacuous', why: 'support accounting off — an empty control arm reads as a real difference, which is exactly the W1-13 failure' },
  { id: 'factorial', must_break: 'synthetic.masked', why: 'only intact and all-broken arms are run — MASKED can never be reported, which is exactly the W1-SOULS failure' },
];

async function selfTest() {
  // A break forced on the command line must SURVIVE the falsification half, or `--break=X
  // --self-test` would silently measure an unbroken facility and report a pass.
  const forced = facilityBreaks();
  const resetToForced = () => { repairFacility(); for (const f of forced) breakFacility(f); };

  say('SELF-TEST — six synthetic controls with known verdicts.');
  resetToForced();
  const clean = await runSuite(syntheticSuite());
  say(formatSuite(clean));
  say('');
  if (forced.length) {
    say(`(falsification half skipped: the facility is already broken on purpose with --break=${forced.join(',')})`);
    return { ok: clean.ok, clean, breaks: [] };
  }
  say('SELF-TEST, FALSIFICATION HALF — break the facility on purpose; each break must go red.');
  const breakRows = [];
  for (const b of FACILITY_BREAKS) {
    repairFacility();
    breakFacility(b.id);
    const broken = await runSuite(syntheticSuite());
    repairFacility();
    const target = broken.judged.find((j) => j.id === b.must_break);
    const caught = target ? !target.ok : false;
    breakRows.push({ break: b.id, why: b.why, must_break: b.must_break, got: target ? target.verdict : null, caught });
    say(`  ${caught ? 'ok  ' : 'FAIL'}  --break=${b.id.padEnd(11)} ${b.must_break} -> ${target ? target.verdict : '(missing)'}` +
      `${caught ? '' : '   <-- the break changed nothing; that check does no work'}`);
  }
  const allCaught = breakRows.every((r) => r.caught);
  const ok = clean.ok && allCaught;
  say('');
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — ${clean.n - clean.failures.length}/${clean.n} synthetic verdicts correct, ` +
    `${breakRows.filter((r) => r.caught).length}/${breakRows.length} injected defects caught.`);
  return { ok, clean, breaks: breakRows };
}

async function historical() {
  say('HISTORICAL REPLAY — three controls this tree shipped green, replayed from the artifacts.');
  const { cases, absent } = historicalCases();
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
    out.self_test = { ok: st.ok, results: st.clean.results, breaks: st.breaks, failures: st.clean.failures };
    if (!st.ok) { bad++; worst = Math.max(worst, 1); }
    say('');
  }
  if (has('cases')) {
    const h = await historical();
    out.historical = {
      ok: h.ok,
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
