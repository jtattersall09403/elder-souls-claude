#!/usr/bin/env node
// critic-w1-25.mjs — GRADING THE SABOTAGE FACILITY BY USING IT, NOT BY READING IT.
//
// Subject: W1-25, `tools/experience/lib/sabotage.mjs`. This file writes NOTHING under game/ and
// does not import or modify the subject except through its published entry points
// (`runControl`, `runSuite`, `VERDICT`). RULES #22: the subject does not grade itself.
//
// Five sections, each runnable alone. Every one of them carries its own teardown, and the
// teardown is RUN and shown going red (RULES #6): a critic instrument that has never been
// watched fail is a second copy of the builder's experiment.
//
//   --a  THE FACILITY, POINTED AT ANOTHER PIECE'S CONTROL.
//        W1-14-r3 shipped `--break=nocast` as its dials control and declared it working; a human
//        critic (corpus/90-verdicts/wave1/W1-14-r3.json, `inert_control:RI-MAG06`) found it inert
//        in RULES #6's second sense — the teardown exits at `NOT_DELIVERED` before `readDial()`
//        is ever called. Replayed here from the builder's own two artifacts, under the three
//        support declarations a caller could honestly write. The facility's verdict is not a
//        property of the control. It is a property of which number the caller called `support`.
//
//   --b  ARE THE FIVE VERDICTS DISTINGUISHABLE? A canonical case per verdict, then four
//        adversarial cases built to make two categories collide.
//
//   --c  A FOURTH HISTORICAL FAILURE, added to the replay corpus from artifacts on disk.
//
//   --d  THE "4 OF 41" CROSSINGS NUMBER, recounted independently against the data.
//
//   --e  THE ZERO-EVENT SESSION, recounted over every trace on the tree.
//
// EXIT: 0 every section behaved as this critic declared · 1 a declared expectation missed ·
//       8 an artifact this critic replays is not on the tree (never a pass) · 9 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT } from './lib/sabotage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const want = (k) => argv.includes(`--${k}`);
const ALL = !argv.some((a) => /^--[abcde]$/.test(a));
const say = (s) => process.stdout.write(s + '\n');
const outPath = (() => { const i = argv.findIndex((a) => a.startsWith('--out')); if (i < 0) return null; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; })();

/** An absent artifact is an absence, never a pass (RULES #24). */
function artifact(rel) {
  const p = path.join(REPO, rel);
  if (!fs.existsSync(p)) { const e = new Error(`ABSENT: ${rel}`); e.absent = true; throw e; }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const replay = (table) => async (broken) => {
  const k = broken.length ? broken.slice().sort().join('+') : '(intact)';
  if (!(k in table)) throw new Error(`no recorded arm "${k}"`);
  return table[k];
};

const findings = [];
const checks = [];
function check(id, got, wanted, note) {
  const ok = got === wanted;
  checks.push({ id, got, wanted, ok, note: note || null });
  say(`${ok ? 'ok  ' : 'MISS'}  ${id.padEnd(56)} ${String(got).padEnd(16)} (this critic declared ${wanted})`);
  if (note) say(`        ${note}`);
  return ok;
}

// =============================================================================================
// A. THE FACILITY, POINTED AT A CONTROL ANOTHER BUILDER DECLARED SOUND.
// =============================================================================================
//
// W1-14-r3's dials census asks, for each of 55 magic effects, whether the effect's magnitude
// dial is COUPLED (moving it moves the world) or BLIND. Its control arm is `--break=nocast`.
// The builder's own status file (orchestration/status/W1-14-r3.json, R3C) reads:
//
//   "with the treatment arms not casting, 55/55 NOT_DELIVERED, 0 ACTIVE, and coupled 0 / blind 0
//    on ALL THREE dials. The instrument cannot manufacture a coupling out of arena noise."
//
// The critic's finding (W1-14-r3.json, gap `inert_control:RI-MAG06`): every row exits at
//   if (!base.delivered) { row.verdict='NOT_DELIVERED'; continue; }
// BEFORE readDial() runs. The comparator under test never executed in the control arm. The arms
// differ enormously — 33 coupled vs 0 — and the difference is about the delivery gate.
//
// So: does the facility catch it unaided?

async function sectionA() {
  say('\n=== A — the facility pointed at W1-14-r3\'s `--break=nocast`, a shipped control a human critic found inert ===\n');
  const relI = 'reports/w1-14-r3/dials.json';
  const relB = 'reports/w1-14-r3/dials-break-nocast.json';
  // The numbers live under `summary`. My first run of this section read the top level, got
  // `undefined` in BOTH arms, and the facility reported INERT on undefined == undefined — a
  // fourth way to get a green-looking control out of a comparison of two nothings, found by
  // accident in the act of grading. Recorded rather than quietly fixed.
  const I = artifact(relI).summary, B = artifact(relB).summary;
  if (!I || !B) throw Object.assign(new Error('ABSENT: dials artifacts no longer carry `summary`'), { absent: true });
  const F = [{ id: 'nocast', what: '--break=nocast — the builder\'s declared teardown for the dials census' }];
  const base = {
    what: 'does the magnitude-dial census manufacture couplings out of arena noise? (W1-14-r3\'s own control question)',
    metric: 'magnitude_coupled, of 55 effects',
    factors: F,
  };

  // S1 — "support is how many effects the census examined." Both arms examined all 55.
  const s1 = await runControl({ ...base, id: 'A1 support = effects examined (55 / 55)',
    measure: replay({ '(intact)': { value: I.magnitude_coupled, support: I.total },
                      nocast:     { value: B.magnitude_coupled, support: B.total } }) });

  // S2 — "support is how many effects the measurement actually ranged over", i.e. rows that
  // delivered and therefore reached the comparator. 55 in the intact arm, 0 in the control.
  const s2 = await runControl({ ...base, id: 'A2 support = effects delivered  (55 / 0)',
    measure: replay({ '(intact)': { value: I.magnitude_coupled, support: I.active },
                      nocast:     { value: B.magnitude_coupled, support: B.active } }) });

  // S3 — the caller declares no support at all. `Number.isFinite(undefined)` is false, so the
  // arm's support becomes null and the vacuity filter (`a.support !== null && ...`) skips it.
  const s3 = await runControl({ ...base, id: 'A3 support not declared at all',
    measure: replay({ '(intact)': { value: I.magnitude_coupled },
                      nocast:     { value: B.magnitude_coupled } }) });

  check('A1  support = "effects examined"', s1.verdict, VERDICT.OK,
    'The facility passes the control the human critic ruled inert. 33 -> 0 is a real difference and the facility has no way to know it is a difference about the delivery gate.');
  check('A2  support = "effects delivered"', s2.verdict, VERDICT.VACUOUS,
    'Same two artifacts, same control, opposite verdict — reached only because the caller chose the other number.');
  check('A3  support omitted', s3.verdict, VERDICT.OK,
    '`support` is optional. Omit it and the entire W1-13 vacuity check is silently disabled for that control; nothing warns.');

  // ---- MY OWN TEARDOWN, RUN AND SHOWN GOING RED (RULES #6) --------------------------------
  // If A2's VACUOUS were structural — a property of the control rather than of the number I
  // handed it — then forging the control arm's support up to 55 would not change it. It does.
  const teardown = await runControl({ ...base, id: 'A2-teardown support forged to 55 in the control arm',
    measure: replay({ '(intact)': { value: I.magnitude_coupled, support: I.total },
                      nocast:     { value: B.magnitude_coupled, support: 55 } }) });
  check('A2-teardown  forge the control arm\'s support to 55', teardown.verdict, VERDICT.OK,
    'MY control arm goes red exactly as declared: the VACUOUS in A2 is carried entirely by one caller-supplied integer, not by anything the facility observed.');

  // ---- A4: found by accident, kept on purpose -------------------------------------------------
  // The first run of this section read `magnitude_coupled` off the top level of the artifact
  // instead of off `.summary`, so both arms measured `undefined`. `canon(undefined)` is the
  // string 'null' in both arms, the arms "agree", and the facility returns INERT — a confident
  // statement that BREAKING IT CHANGED NOTHING, about a measurement that never happened.
  const s4 = await runControl({ ...base, id: 'A4 both arms measured undefined (a misspelt field)',
    measure: replay({ '(intact)': { value: undefined, support: 55 }, nocast: { value: undefined, support: 55 } }) });
  check('A4  both arms undefined', s4.verdict, VERDICT.INERT,
    'The facility has no verdict for "nothing was measured". A typo in a field name produces INERT — which reads as a finding about the build, is indistinguishable in the report from a real W1-04, and is the exact class of error the piece exists to catch.');
  const s4t = await runControl({ ...base, id: 'A4-teardown one arm given a real value',
    measure: replay({ '(intact)': { value: 33, support: 55 }, nocast: { value: undefined, support: 55 } }) });
  check('A4-teardown  give the intact arm a real value', s4t.verdict, VERDICT.OK,
    'red as declared: the INERT in A4 comes from both arms being unmeasured, not from anything structural.');

  findings.push({
    id: 'A-NULL-IS-NOT-A-MEASUREMENT',
    severity: 'major',
    claim: 'A control whose measure() returns undefined or null in both arms is reported INERT — a positive claim that the break did nothing — rather than as a measurement that did not happen. `canon()` maps undefined, null and a missing field all to the string "null", so a misspelt field name produces the piece\'s flagship verdict. I hit this on my first run of section A against a real artifact.',
    evidence: { A4: s4.verdict, A4_teardown: s4t.verdict, canon_of_undefined: 'null' },
    remedy: 'A NO_MEASUREMENT verdict (or reuse ERROR) when every arm\'s value canonicalises to "null". Three lines beside the existing support check, and it is the same argument the piece already makes for VACUOUS: a statement about an empty set is not a statement about the build.',
  });

  findings.push({
    id: 'A-VERDICT-IS-A-FUNCTION-OF-SUPPORT',
    severity: 'major',
    claim: 'The facility catches the strongest real inert control available (W1-14-r3 `--break=nocast`) ONLY IF the caller happens to declare `support` as delivered-rows rather than examined-rows, and not at all if the caller omits `support`. Two of the three honest readings pass it.',
    evidence: { intact: relI, broken: relB, A1: s1.verdict, A2: s2.verdict, A3: s3.verdict, teardown: teardown.verdict },
    remedy: '`runControl` should REFUSE a spec whose measure() returns no `support` on any arm (throw, or force VERDICT.ERROR) exactly as it refuses a spec with no factors — `if (!factors.length) throw`. And the docstring\'s "number of units the measurement ranged over" needs the operative sentence: units that REACHED THE COMPARATOR, not units enumerated.',
  });

  findings.push({
    id: 'A-FOURTH-SHAPE-IS-NOT-IN-THE-TAXONOMY',
    severity: 'major',
    claim: 'W1-14-r3 is a FOURTH failure shape and the five verdicts have no name for it: the teardown short-circuits UPSTREAM of the mechanism under test, so the arms differ loudly and the difference is about the short-circuit. The facility\'s three documented shapes are arms-agree, no-single-factor-effect and empty-population; this one is none of them. It is caught, when it is caught, as a side effect of support accounting.',
    evidence: { verdict_source: 'corpus/90-verdicts/wave1/W1-14-r3.json gap `inert_control:RI-MAG06`' },
    remedy: 'A sixth verdict — SHORT_CIRCUIT — triggered when the broken arm\'s support collapses relative to the intact arm (support_broken / support_intact below a declared floor, default 1.0 for a teardown that should not change the population). Cheap: the numbers are already on every arm record.',
  });
  return { A1: s1, A2: s2, A3: s3, teardown };
}

// =============================================================================================
// B. ARE THE FIVE VERDICTS DISTINGUISHABLE, OR ONLY NAMED?
// =============================================================================================

async function sectionB() {
  say('\n=== B — five verdicts, five canonical cases, then four cases built to collide two of them ===\n');
  const fix = (map, support = 10) => async (broken) => {
    const k = broken.slice().sort().join('+') || '(intact)';
    if (!(k in map)) throw new Error(`no arm ${k}`);
    const v = map[k];
    return (v && typeof v === 'object' && 'value' in v) ? v : { value: v, support };
  };
  const one = [{ id: 'g', what: 'the guard' }];
  const two = [{ id: 'a', what: 'guard A' }, { id: 'b', what: 'guard B' }];
  const out = {};

  // ---- canonical: one case per verdict ------------------------------------------------------
  const canon = [
    ['B-OK',              VERDICT.OK,              { factors: one, measure: fix({ '(intact)': 100, g: 40 }), margin: { kind: 'relative', min: 0.5 }, direction: 'lower' }],
    ['B-INERT',           VERDICT.INERT,           { factors: one, measure: fix({ '(intact)': 100, g: 100 }) }],
    ['B-VACUOUS',         VERDICT.VACUOUS,         { factors: one, measure: fix({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }) }],
    ['B-MASKED',          VERDICT.MASKED,          { factors: two, measure: fix({ '(intact)': 252, a: 252, b: 252, 'a+b': 0 }) }],
    ['B-UNDERPOWERED',    VERDICT.UNDERPOWERED,    { factors: one, measure: fix({ '(intact)': 100, g: 96 }), margin: { kind: 'relative', min: 0.5 } }],
    ['B-WRONG_DIRECTION', VERDICT.WRONG_DIRECTION, { factors: one, measure: fix({ '(intact)': 100, g: 180 }), direction: 'lower' }],
  ];
  const seen = new Map();
  for (const [id, wanted, spec] of canon) {
    const r = await runControl({ id, what: 'canonical', metric: 'n', ...spec });
    out[id] = r; seen.set(r.verdict, (seen.get(r.verdict) || 0) + 1);
    check(id, r.verdict, wanted);
  }
  check('B-DISTINCT  six canonical cases produce six distinct verdicts', seen.size, 6,
    'The categories are separable on the cases each was written for. That is the floor, not the test.');

  // ---- collision 1: a MASKED defect whose joint effect is small ------------------------------
  // Two guards for one defect, exactly the W1-SOULS shape, but the joint effect is 5% and the
  // caller declared a 50% margin. UNDERPOWERED is checked BEFORE MASKED in the verdict cascade
  // (lib/sabotage.mjs, `else if (!marginRes.ok)` precedes `else if (masked)`), so the report
  // says "your control is weak" and never says "you have two guards and each reads inert alone".
  const c1 = await runControl({ id: 'B-COLLIDE-1 masked defect, small joint effect, 50% margin declared',
    what: 'two guards for one defect where breaking both moves the number 5%', metric: 'n',
    factors: two, measure: fix({ '(intact)': 252, a: 252, b: 252, 'a+b': 240 }), margin: { kind: 'relative', min: 0.5 } });
  out['B-COLLIDE-1'] = c1;
  check('B-COLLIDE-1  masked + under margin', c1.verdict, VERDICT.UNDERPOWERED,
    'MASKED is unreachable behind an unmet margin. `redundant_guards` comes back [] and `factors_inert_alone` still lists both, but the VERDICT — the thing the exit code and the report headline carry — says the control is underpowered. The next agent deletes a guard in good faith, which is the exact harm the MASKED verdict exists to prevent.');

  // ---- collision 2: cancellation. A single factor moves it; both together restore it. --------
  // `armsAgree` compares ONLY intact against all-broken, so a control with a demonstrated live
  // factor is reported INERT — and the `why` string asserts "breaking a + b changed nothing"
  // while the record's own `factor_effects` shows factor a moving 100 -> 40.
  const c2 = await runControl({ id: 'B-COLLIDE-2 factor A moves it, A+B restores it',
    what: 'a live guard whose partner cancels it', metric: 'n',
    factors: two, measure: fix({ '(intact)': 100, a: 40, b: 100, 'a+b': 100 }) });
  out['B-COLLIDE-2'] = c2;
  check('B-COLLIDE-2  cancellation', c2.verdict, VERDICT.INERT,
    `INERT on a control with a live factor. The record self-contradicts: factors_that_move_it_alone=${JSON.stringify(c2.factors_that_move_it_alone)}, minimal_breaking_set=${JSON.stringify(c2.minimal_breaking_set)}, and the why-string says "changed nothing".`);

  // ---- collision 3: VACUOUS swallows INERT ---------------------------------------------------
  // An empty population AND agreeing arms. VACUOUS is checked first, so the report never says
  // the break did nothing. Defensible ordering — but the two facts are independent and only one
  // is reported, and the piece's own docstring calls them different failures.
  const c3 = await runControl({ id: 'B-COLLIDE-3 empty population AND arms agree',
    what: 'both defects at once', metric: 'n', factors: one,
    measure: fix({ '(intact)': { value: 0, support: 0 }, g: { value: 0, support: 0 } }) });
  out['B-COLLIDE-3'] = c3;
  check('B-COLLIDE-3  vacuous + inert', c3.verdict, VERDICT.VACUOUS,
    'Only one of two independent defects is reported. Recoverable from `arms_agree: ' + c3.arms_agree + '` in the record, but not from the verdict.');

  // ---- collision 4: the documented escape hatch is unenforced ---------------------------------
  // lib/sabotage.mjs: "`supportArms: 'intact'` narrows this ... and a caller that narrows it must
  // say why, in `support_note`." Nothing reads `support_note`. Narrow it, omit the note, and the
  // W1-13 shape passes with a one-word spec change.
  const c4 = await runControl({ id: 'B-COLLIDE-4 the W1-13 case with supportArms:"intact" and no support_note',
    what: 'the vacuity check opted out of, exactly as the docstring forbids', metric: 'n', factors: one,
    supportArms: 'intact',
    measure: fix({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }) });
  out['B-COLLIDE-4'] = c4;
  check('B-COLLIDE-4  supportArms:"intact", support_note omitted', c4.verdict, VERDICT.OK,
    'The canonical W1-13 failure passes. The docstring makes `support_note` mandatory and no code path reads it; `runControl` does not carry the field into its result, so a downstream report cannot even audit for it.');

  // ---- MY OWN TEARDOWN (RULES #6) -------------------------------------------------------------
  // If these four collisions were artifacts of how I built the fixtures rather than of the
  // cascade, repairing the one thing I claim causes each should flip each verdict. Run it.
  const t1 = await runControl({ ...{ id: 'B-COLLIDE-1-teardown same case, margin dropped',
    what: 't', metric: 'n', factors: two, measure: fix({ '(intact)': 252, a: 252, b: 252, 'a+b': 240 }) } });
  const t2 = await runControl({ id: 'B-COLLIDE-2-teardown same case, B removed from the factor list',
    what: 't', metric: 'n', factors: [{ id: 'a', what: 'guard A' }], measure: fix({ '(intact)': 100, a: 40 }) });
  const t4 = await runControl({ id: 'B-COLLIDE-4-teardown same case, supportArms left at its default',
    what: 't', metric: 'n', factors: one, measure: fix({ '(intact)': { value: 25, support: 52 }, g: { value: 0, support: 0 } }) });
  check('B-COLLIDE-1-teardown  drop the margin', t1.verdict, VERDICT.MASKED,
    'red as declared: the masking was always visible, the margin check outranked it.');
  check('B-COLLIDE-2-teardown  drop the cancelling factor', t2.verdict, VERDICT.OK,
    'red as declared: factor A is live, and the INERT in B-COLLIDE-2 is produced by comparing intact against all-broken alone.');
  check('B-COLLIDE-4-teardown  restore the default support scope', t4.verdict, VERDICT.VACUOUS,
    'red as declared: the escape hatch, not the data, is what passed B-COLLIDE-4.');
  Object.assign(out, { 'B-COLLIDE-1-teardown': t1, 'B-COLLIDE-2-teardown': t2, 'B-COLLIDE-4-teardown': t4 });

  findings.push({
    id: 'B-CASCADE-ORDER-HIDES-MASKED',
    severity: 'major',
    claim: 'MASKED is last in the verdict cascade and is therefore unreachable whenever the joint effect misses the declared margin or the direction. The one verdict in the taxonomy that exists to stop an agent deleting a guard in good faith is the one most easily shadowed.',
    evidence: { case: 'B-COLLIDE-1', got: c1.verdict, with_margin_dropped: t1.verdict },
    remedy: 'Hoist the masking test above margin and direction — it is a statement about the structure of the effect, and margin/direction are statements about its size and sign. Or report a verdict LIST rather than a scalar, which the record already has all the fields for.',
  });
  findings.push({
    id: 'B-INERT-IS-DECIDED-ON-TWO-ARMS',
    severity: 'moderate',
    claim: '`armsAgree` compares the intact arm against the all-broken arm and nothing else, so a control with a demonstrably live factor is reported INERT under cancellation, with a `why` string that asserts the opposite of the record\'s own `factor_effects`.',
    evidence: { case: 'B-COLLIDE-2', verdict: c2.verdict, moves_alone: c2.factors_that_move_it_alone },
    remedy: 'armsAgree should be `distinct_values === 1` — no arm differs from any other — which is already computed one line above it and is the honest reading of "the arms agree".',
  });
  findings.push({
    id: 'B-SUPPORT-NOTE-UNENFORCED',
    severity: 'moderate',
    claim: 'The documented obligation on `supportArms: "intact"` ("a caller that narrows it must say why, in support_note") is enforced nowhere and `support_note` is not even copied into the result, so the W1-13 failure the facility was built for is one spec key away from passing, unauditably.',
    evidence: { case: 'B-COLLIDE-4', got: c4.verdict, with_default_scope: t4.verdict },
    remedy: 'Three lines: throw when `supportArms === "intact"` and `support_note` is empty, and carry `support_note` and `support_scope` onto the result so a report can list every control that opted out.',
  });
  return out;
}

// =============================================================================================
// C. A FOURTH HISTORICAL FAILURE, ADDED FROM DISK.
// =============================================================================================

async function sectionC() {
  say('\n=== C — a fourth real failure added to the replay corpus, from artifacts another agent wrote ===\n');
  const relI = 'reports/w1-14-r3/dials.json', relB = 'reports/w1-14-r3/dials-break-nocast.json';
  const I = artifact(relI).summary, B = artifact(relB).summary;
  const r = await runControl({
    id: 'w1-14-r3.NOCAST — the teardown that exits before the comparator',
    what: 'W1-14-r3\'s dials control: `--break=nocast` skips the cast, so all 55 rows exit at NOT_DELIVERED before readDial() runs',
    metric: 'magnitude_coupled, of 55 effects',
    source: `${relI} + ${relB}`,
    factors: [{ id: 'nocast', what: 'tools/harness/w1-14-r3-dials.mjs --break=nocast' }],
    measure: replay({
      '(intact)': { value: I.magnitude_coupled, support: I.active, detail: { active: I.active, not_delivered: (I.not_delivered || []).length } },
      nocast: { value: B.magnitude_coupled, support: B.active, detail: { active: B.active, not_delivered: (B.not_delivered || []).length } },
    }),
    expect: VERDICT.VACUOUS,
  });
  check('C  w1-14-r3 nocast, support = delivered rows', r.verdict, VERDICT.VACUOUS,
    'A fourth case the corpus can carry, and it is the only one of the four where the facility\'s verdict depends on a judgement the facility cannot make for itself.');

  // Provenance. The eight shipped cases replay SEVEN files, and reports/.gitignore excludes
  // every one of them (`*` with `!**/*.md`, `!blog-feed.jsonl`, `!**/*baseline*.json`).
  const replayed = [
    'reports/w1-04-r3-collision.json',
    'reports/critic-souls-r3-INTACT.json',
    'reports/critic-souls-r3-DELETED-identity.json',
    'reports/critic-souls-r3-DELETED-boundary.json',
    'reports/critic-souls-r3-DELETED-identity-boundary.json',
    'reports/runs/W1-13-R4/clock-consequences.json',
    'reports/journeys/w1-13-r4-jrn06/journey.json',
    relI, relB,
  ];
  const { execSync } = await import('node:child_process');
  const untracked = replayed.filter((f) => {
    try { execSync(`git -C ${REPO} ls-files --error-unmatch ${JSON.stringify(f)}`, { stdio: 'ignore' }); return false; }
    catch { return true; }
  });
  check('C-PROVENANCE  replayed artifacts NOT under version control', untracked.length, 9,
    `${untracked.length}/${replayed.length} are excluded by reports/.gitignore. A fresh clone has none of them and --cases exits 8.`);
  // Authenticity: the replayed numbers are corroborated by files that ARE tracked and were
  // written by other agents, so these are real artifacts and not a transcription into a fixture.
  const corroborate = [
    ['252', 'corpus/90-verdicts/wave1/W1-SOULS-r3.json', 'souls paid by the same six-body fight'],
    ['67', 'corpus/90-verdicts/wave1/W1-04-r3.md', 'collision shapes in the settlement cell'],
    ['roster', 'corpus/90-verdicts/wave1/W1-13-r4.md', 'the empty control roster'],
  ];
  const corroborated = corroborate.filter(([needle, file]) => {
    const p = path.join(REPO, file);
    return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(needle);
  });
  check('C-AUTHENTIC  replayed numbers corroborated by tracked verdicts', corroborated.length, 3,
    'The 8/8 is a real replay, not a transcription: 252/342, 67->0 and roster_n 0 each appear in a tracked verdict written by a different agent.');

  findings.push({
    id: 'C-REGRESSION-CORPUS-IS-UNTRACKED',
    severity: 'major',
    claim: `--cases 8/8 is real — every number is corroborated by an independently tracked verdict (252/342 in W1-SOULS-r3.json, 67->0 in W1-04-r3.md, roster_n 0 in W1-13-r4.md) — but all ${untracked.length} artifacts it replays are excluded by reports/.gitignore. On a fresh clone --cases reports ABSENT and exits 8. The regression corpus that makes this facility evidence rather than assertion survives only as long as this container does.`,
    evidence: { untracked, gitignore: 'reports/.gitignore' },
    remedy: 'reports/.gitignore already carries the exemption and the exact argument for it — `!**/*baseline*.json`, added because "a baseline exists to be yesterday\'s, so regenerating it destroys the only thing it was for." These nine files are baselines by that definition and cannot be regenerated at all: the pre-fix `__w1_04_townSolids` and the two deleted souls guards do not exist at HEAD. Add `!**/sabotage-case-*.json`, copy the nine under that name, and point sabotage-cases.mjs at the copies. Under 100 KB.',
  });
  return { case4: r, untracked };
}

// =============================================================================================
// D. "ONLY 4 OF 41 DECLARED SEAM CROSSINGS HAVE ANY DATA BEHIND THEM AT ALL."
// =============================================================================================
//
// RI-CMP01 asks for each crossing DEMONSTRATED FIRING IN A TRACE. What the tool accepts as
// evidence is a JSON pointer existing in a data file, matched against a hand-written table of
// 56 patterns in tools/composition/matrix-scan.mjs — and every pattern is rooted in the SOURCE
// system's own data directory. A crossing declared on the TARGET's side is invisible to it.

const D_PROBES = [
  { cell: 'QST->ROS', file: 'game/data/world/encounters.json', key: 'absent_when_flag',
    why: 'Q-MAIN-23 res_sign_the_clause sets `the_sixty_are_protected`; the net-throwers of dres-raid-party carry `absent_when_flag` on it. ARBITRATION AR-3 names this crossing in as many words: "a quest whose resolution changes an encounter\'s composition".' },
  { cell: 'WLD->ROS', file: 'game/data/world/encounters.json', key: 'absent_when_flag',
    why: 'the same field read as world-state -> roster: a world flag removes two bodies from a spawn.' },
  { cell: 'DIS->ROS', file: 'game/data/world/encounters.json', key: 'hostile_below_disposition',
    why: 'an encounter that is hostile only below a disposition threshold.' },
  { cell: 'LOR->ROS', file: 'game/data/world/encounters.json', key: 'true_name_topic',
    why: 'knowing a lore topic opens a parley on an encounter — ARBITRATION AR-3\'s "a lore fact that is also a boss\'s weakness", twice (the-sallow-wife, the-twin-lamps).' },
];

function deepKeys(o, hit, out, p = '') {
  if (!o || typeof o !== 'object') return out;
  for (const k of Object.keys(o)) { const q = `${p}/${k}`; if (k === hit) out.push({ pointer: q, value: o[k] }); deepKeys(o[k], hit, out, q); }
  return out;
}

async function sectionD() {
  say('\n=== D — recounting "only 4 of 41 crossings have any data behind them at all" ===\n');
  const claims = artifact('reports/composition/w1/claims.json');
  const noData = new Set((claims.crossing_cells_with_no_data_claim || []).map((c) => c.cell || c));
  const rows = [];
  for (const p of D_PROBES) {
    const abs = path.join(REPO, p.file);
    const present = fs.existsSync(abs) ? deepKeys(JSON.parse(fs.readFileSync(abs, 'utf8')), p.key, []) : [];
    const missed = present.length > 0 && noData.has(p.cell);
    rows.push({ ...p, occurrences: present.length, sample: present.slice(0, 2), reported_as_no_data: noData.has(p.cell), missed_by_the_tool: missed });
    say(`  ${p.cell.padEnd(11)} ${p.key.padEnd(26)} occurrences=${String(present.length).padEnd(3)} ` +
        `matrix-scan said no-data=${noData.has(p.cell)}  ${missed ? '<< MISSED' : ''}`);
  }
  const missed = rows.filter((r) => r.missed_by_the_tool);
  check('D  crossings with data that matrix-scan reported as having none', missed.length, 4,
    'All four live in ONE file — game/data/world/encounters.json — and that file produces zero claims out of the 564 the tool read, because no pattern in the table globs it.');

  // Is the crossing merely declared, or demonstrated? RI-CMP01 wants a trace.
  const probes = ['tools/quests/encounter-seam-probe.mjs', 'tools/quests/critic-ar3-endtoend.mjs',
                  'tools/quests/faction-seam-probe.mjs', 'tools/world/crossing-consumption.mjs',
                  'tools/world/crossing-deletefix.mjs'].filter((f) => fs.existsSync(path.join(REPO, f)));
  say(`  existing crossing/seam probes on the tree, none cited by W1-25: ${probes.join(', ')}`);
  check('D-PROBES  purpose-built crossing probes already on the tree', probes.length >= 4, true,
    'QST->ROS is not only data-backed, it has a dedicated CONSUMPTION probe written for AR-3 that spawns the encounter with the flag clear and set and counts bodies.');

  // MY TEARDOWN (RULES #6): if my four hits were an artifact of a too-loose key search, then
  // searching for a key that is NOT in the file must return zero. It does.
  const bogus = deepKeys(JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/encounters.json'), 'utf8')), 'absent_when_moon_is_full', []);
  check('D-teardown  the same search for a field that does not exist', bogus.length, 0,
    'red as declared: the search is not matching on substrings or on shape, so the four hits are four real fields.');

  findings.push({
    id: 'D-THE-4-OF-41-IS-A-PROPERTY-OF-THE-SCANNER',
    severity: 'critical',
    claim: 'The piece\'s most consequential number is wrong and wrong in the direction that condemns other pieces. At least 8 of 41 crossings are data-backed, not 4. The four missed — QST->ROS, WLD->ROS, DIS->ROS, LOR->ROS — all sit in game/data/world/encounters.json, which contributed zero of the tool\'s 30 claims because every one of matrix-scan.mjs\'s 56 patterns is rooted in the SOURCE system\'s directory and these couplings are declared on the TARGET\'s. Two of them (absent_when_flag, true_name_topic) are the exact crossings ARBITRATION AR-3 names as its worked examples, and QST->ROS was built deliberately by W1-19 round 2 to answer a seam_sterile verdict, with a probe on the tree to demonstrate it.',
    evidence: { rows, existing_probes: probes, encounters_claims_from_that_file: 0, files_read: claims.files_read },
    remedy: 'matrix-scan needs target-side patterns. Four lines against one file closes half the error: world/encounters.json at `members[].absent_when_flag` -> QST->ROS and WLD->ROS, at `hostile_below_disposition` -> DIS->ROS, at `parley.true_name_topic` -> LOR->ROS. Then the tool needs the check it does not have: an inventory of every existing tools/**/*seam*.mjs and crossing*.mjs, so a crossing another piece already DEMONSTRATED cannot be reported as having no data.',
  });
  findings.push({
    id: 'D-SHAPE-OF-THE-REAL-ABSENCE',
    severity: 'note',
    claim: 'The 37 no-data crossings are not scattered: every one has ROS (roster) or BOS (boss) as its source or its target, plus two DUN and two SCH. The finding worth publishing is not a count, it is that the enemy roster and the bosses are the seam-dead systems and everything else touches something. The piece reported the count.',
    evidence: { no_data_cells: [...noData] },
    remedy: 'State it that way in reports/composition/w1/stage1.md; it survives the scanner being wrong about any individual cell, and it is directly actionable.',
  });
  return { rows, missed: missed.length, probes };
}

// =============================================================================================
// E. THE ZERO-EVENT SESSION.
// =============================================================================================

function walkTraces(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTraces(p, out);
    else if (e.name.endsWith('.jsonl') && /trace/.test(e.name)) out.push(p);
  }
  return out;
}

async function sectionE() {
  say('\n=== E — "zero events on every trace this project has ever recorded" ===\n');
  const files = walkTraces(path.join(REPO, 'reports'));
  const rows = [];
  for (const f of files) {
    let frames = 0, ev = 0; const kinds = {};
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      frames++;
      for (const e of (o.events || [])) { ev++; kinds[e.type] = (kinds[e.type] || 0) + 1; }
    }
    rows.push({ file: path.relative(REPO, f), frames, events: ev, kinds: Object.keys(kinds).length, top: Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 8) });
  }
  rows.sort((a, b) => b.events - a.events);
  const withEvents = rows.filter((r) => r.events > 5);
  const totalEv = rows.reduce((s, r) => s + r.events, 0);
  for (const r of rows.slice(0, 6)) say(`  ${String(r.frames).padStart(6)} fr  ev=${String(r.events).padStart(4)}  kinds=${String(r.kinds).padStart(2)}  ${r.file}`);
  say(`  ... ${rows.length} traces, ${rows.reduce((s, r) => s + r.frames, 0)} frames, ${totalEv} events total`);

  const opening = rows.find((r) => /sessions\/exp-w1-opening/.test(r.file));
  check('E1  the 36,000-frame session carries zero events', opening ? opening.events : -1, 0);
  // How many of these existed BEFORE W1-25 wrote its own report? A claim about "every trace this
  // project has ever recorded" must be judged against the tree as it was when it was made.
  const ref = fs.existsSync(path.join(REPO, 'reports/experience/w1/anecdote-and-shape.md'))
    ? fs.statSync(path.join(REPO, 'reports/experience/w1/anecdote-and-shape.md')).mtimeMs : Infinity;
  const predating = withEvents.filter((r) => fs.statSync(path.join(REPO, r.file)).mtimeMs <= ref);
  check('E2  traces carrying substantive events (>5)', withEvents.length > 5, true,
    `${withEvents.length} traces, top five being W1-09's RI-CMB07 combat exemplars at 493-553 events over 24-28 kinds. ` +
    `${predating.length} of them already existed when W1-25 wrote its own anecdote report, so the overstatement is not a timing artifact. ` +
    `The recorder works and the vocabulary is adequate; what has never been recorded is a SESSION that does anything.`);
  check('E2b  event-bearing traces that predate the claim', predating.length > 5, true,
    `${predating.length} predate reports/experience/w1/anecdote-and-shape.md.`);

  // Is the closed vocabulary the fault (RULES #15)?
  const { EVENT_TYPES } = await import(path.join(REPO, 'game/src/sim/events.js'));
  const consequence = ['journal', 'journal_write', 'quest_stage', 'topic', 'topic_select', 'item',
                       'death', 'level_up', 'bonfire_rest', 'dialogue_open', 'save_write', 'player_respawn'];
  const absent = consequence.filter((t) => !EVENT_TYPES.has(t));
  check('E3  consequence names missing from the closed vocabulary', absent.length, 0,
    `${EVENT_TYPES.size} names in game/src/sim/events.js and every consequence name an anecdote needs is present. RULES #15 is NOT the fault here.`);

  // The mirror shim: the lowercase HARNESS.md §5 names carry no payload.
  const ex = withEvents[0];
  let mirrors = 0, payloads = 0;
  if (ex) for (const line of fs.readFileSync(path.join(REPO, ex.file), 'utf8').split('\n')) {
    if (!line.trim()) continue; let o; try { o = JSON.parse(line); } catch { continue; }
    for (const e of (o.events || [])) { if (e.mirrors) mirrors++; else payloads++; }
  }
  check('E4  mirror events carry no payload', mirrors > 0, true,
    `in ${ex ? ex.file : 'n/a'}: ${mirrors} of ${mirrors + payloads} events are {type, f, mirrors:"UPPERCASE"} stubs. The closed §5 vocabulary is satisfied by empty shells over a parallel uppercase vocabulary that carries the data — RULES #10's two parallel implementations, in the trace format itself.`);

  findings.push({
    id: 'E-THE-CLAIM-OVERSTATES',
    severity: 'moderate',
    claim: 'The narrow claims are true and load-bearing: the one recorded session is 36,000 frames with zero events, and the journey traces carry five boot events each. The generalisation is not. Five traces on this tree carry 493-553 events across 24-28 kinds including hit, stagger, block_success, death and detect. "verified_anecdotes_per_hour is 0 by construction on every trace this project has ever recorded" is false as written, and it matters because it points the remedy at the recorder instead of at the fixture.',
    evidence: { traces: rows.length, with_events: withEvents.length, top: withEvents.slice(0, 6).map((r) => ({ file: r.file, events: r.events, kinds: r.kinds })) },
    remedy: 'Restate as: no SESSION or JOURNEY run has ever produced a consequence event, while combat exemplars produce hundreds. Then the diagnosis follows — RULES #8, a still target. The session script walks and never fights, talks, takes or dies.',
  });
  findings.push({
    id: 'E-FAULT-IS-THE-FIXTURE-NOT-THE-RECORDER',
    severity: 'major',
    claim: 'Fault located, against the three candidates the brief names. NOT the recorder: the same trace writer emits 553 events in the combat exemplars. NOT the vocabulary: all 179 names are present and every consequence name an anecdote needs is in the list, so RULES #15 does not bite. It is the session fixture — a ten-minute run that never enters combat, opens dialogue, writes a journal entry or picks anything up, which is RULES #8 exactly.',
    evidence: { recorder_proof: withEvents.map((r) => r.file), vocabulary_size: EVENT_TYPES.size, missing_consequence_names: absent },
    remedy: 'The cheapest real number in this whole piece: point tools/experience/anecdote-trace.mjs at reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl. It has a death, six staggers, a guard break and a block_success in 9,000 frames. It will score low on A2 (proper noun) and A4 (locatable) because it is an arena, and THAT is the finding RI-EXP02 wants — a build whose only recorded consequences happen in a room with no name.',
  });
  return { rows: rows.slice(0, 12), with_events: withEvents.length, vocabulary: EVENT_TYPES.size, mirrors };
}

// =============================================================================================

(async () => {
  const report = { schema: 'critic-w1-25/1', at: new Date().toISOString(), subject: 'W1-25', sections: {} };
  try {
    if (ALL || want('a')) report.sections.A = await sectionA();
    if (ALL || want('b')) report.sections.B = await sectionB();
    if (ALL || want('c')) report.sections.C = await sectionC();
    if (ALL || want('d')) report.sections.D = await sectionD();
    if (ALL || want('e')) report.sections.E = await sectionE();
  } catch (e) {
    if (e.absent) { say(`\nABSENT — ${e.message}\nA case this critic replays is not on the tree. That is an absence, not a pass.`); process.exit(8); }
    throw e;
  }
  report.checks = checks;
  report.findings = findings;
  const bad = checks.filter((c) => !c.ok);
  say(`\n${bad.length ? 'MISSED' : 'ALL'}  ${checks.length - bad.length}/${checks.length} checks behaved as this critic declared.`);
  for (const b of bad) say(`  ! ${b.id}: got ${b.got}, declared ${b.wanted}`);
  say(`\n${findings.length} finding(s):`);
  for (const f of findings) say(`  [${f.severity}] ${f.id}\n      ${f.claim}`);
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(REPO, outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(REPO, outPath), JSON.stringify(report, null, 2));
    say(`\nwrote ${outPath}`);
  }
  process.exit(bad.length ? 1 : 0);
})();
