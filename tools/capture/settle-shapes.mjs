#!/usr/bin/env node
/**
 * settle-shapes.mjs — does G3 actually discriminate, and by WHICH gate?
 *
 * =================================================================================================
 * WHY THIS EXISTS: THE CRITIC'S P6 CANNOT FAIL AGAINST THE REBUILT PROOF
 * =================================================================================================
 * `critic-r1-probe.mjs --metric` (P6) is the attack that found the R1 blind spot, and it was a good
 * attack: it fed shapes of change to the service's own `judge()` at its own threshold and three
 * unsettled worlds came back SETTLED. It is not wrong. But against the REBUILT proof it has become
 * INERT, and a builder who reported "P6 held" as evidence that G3 works would be reporting nothing.
 * Measured, and this is the whole reason for this file:
 *
 *   P6 calls  judge({ resid, d1, d2, threshold, gap, frames })  with
 *   resid = { queued: 0, built: 0, tiles_queued: 0, tiles_resident: 25 }   -- and no `ran`
 *
 * The R6 rebuild made every gate fail closed, so a residency reading that does not say `ran: true`
 * is a REFUSAL (that is exactly what R6 asked for: "record 'gate did not run' in the proof instead
 * of pass: true"). And P6 passes no `d13`, so G3 declines to rule at all. The consequence:
 *
 *   - all five of P6's rows are refused by G1 before G3 is consulted;
 *   - P6's `wrong` predicate is `verdict === 'SETTLED' && ought === 'unsettled'`, i.e. it counts
 *     only false PASSES;
 *   - so five blanket refusals score as "no blind spot found", and P6 reports held no matter what
 *     G3 does. Deleting G3b and G3c entirely leaves P6 green. That was confirmed by deleting them.
 *
 * A probe that cannot fail is worse than no probe (TOOL-LOOP rule 3.2). P6 must not be edited — it
 * is the critic's instrument and it still holds the R1 build to account. This file is the
 * SUPPLEMENT that exercises the thing P6 can no longer reach: it hands `judge()` a COMPLETE
 * residency reading and a COMPLETE triad, so the verdict is decided by G3 and by nothing else.
 *
 * AND IT ASSERTS WHICH GATE FIRED, not merely the verdict. The R1 critic's sharpest methodological
 * point was about `falsify.mjs` A2f: a test that passes for a reason other than the one it names is
 * not evidence for the thing it names. A case that ought to fail on accumulation and instead fails
 * on residency is a FAILED case here, even though the verdict matches.
 *
 * =================================================================================================
 * THE CASE THAT CARRIES THE ARGUMENT
 * =================================================================================================
 * `settle.mjs` states an honest limit: the critic's slow loader (d1 = 0.060, d2 = 0.055) and the
 * measured settled marauders-coast frame (d1 = 0.0644, d2 = 0.0640) are NUMERICALLY THE SAME PAIR,
 * so no function of (d1, d2) can certify one and refuse the other. Both are below. They are
 * separated here by |A-C| alone — 0.110 against 0.066 — which is the entire justification for
 * collecting a third comparison. If those two rows ever come out the same way, G3c is not working
 * and the claim in settle.mjs's header is false.
 *
 * USAGE
 *   node tools/capture/settle-shapes.mjs            # assert; non-zero if any case is misjudged
 *   node tools/capture/settle-shapes.mjs --json     # the table as JSON
 *   node tools/capture/settle-shapes.mjs --table    # the table as text (default alongside assert)
 *
 * Offline. No daemon, no browser, ~40 ms.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT, ensureDir } from '../lib/cli.mjs';
import { judge, UnsettledError, THRESHOLD, GAP, RISE_ABS, RISE_RATIO, ACC_RATIO, ACC_FLOOR } from './settle.mjs';

const USAGE = `settle-shapes.mjs — feed shapes of change to judge() with a COMPLETE residency
reading and a COMPLETE triad, and assert both the verdict and which gate produced it.
  --json     emit JSON     --out <dir>   where to write SETTLE-SHAPES.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const TOTAL_BLOCKS = 5184;
/** A diff record of the shape __CAPD_TRIAD returns. */
const D = (frac) => ({
  frac,
  changed_blocks: Math.round(frac * TOTAL_BLOCKS),
  total_blocks: TOTAL_BLOCKS,
  max_block_delta: 40,
  mean_block_delta: 1,
  px_changed_frac: frac,
  px_total: 82944,
  block: 4,
  delta_floor: 8,
});

/**
 * A residency reading of the shape the READ-ONLY probe returns when the world really is there.
 * P6's object omits `ran` and `read_only`, which is why every one of its rows is refused by G1
 * before G3 is reached.
 */
const RESIDENT = { ran: true, read_only: true, queued: 0, want: 25, built: 0, tiles_queued: 0, tiles_resident: 25 };

/** The set-structure block. G3c records `overlap`; it gates on gamma. */
const SET = (d1, d2, overlap) => {
  const c1 = Math.round(d1 * TOTAL_BLOCKS), c2 = Math.round(d2 * TOTAL_BLOCKS);
  const both = Math.round(Math.min(c1, c2) * overlap);
  return { changed_1: c1, changed_2: c2, changed_13: 0, both, either: c1 + c2 - both, total_blocks: TOTAL_BLOCKS, overlap, jaccard: both / Math.max(1, c1 + c2 - both) };
};

/**
 * Each case: what the world is doing, the triad it produces, the verdict it must get, and — when it
 * must be refused — the SUB-GATE that must be the one to refuse it.
 *
 * The d13 values are not free parameters. They follow from what the world is doing:
 *   ARRIVAL is non-stationary. New content lands in blocks that had not changed before and STAYS
 *   changed, so the two changed-sets are near-disjoint and |A-C| approaches |A-B| + |B-C|.
 *   AMBIENT motion is stationary. The cover that swayed in the first interval is the cover that
 *   sways in the second, over the same blocks, so |A-C| is about the size of ONE interval.
 * `overlap` is set consistently with that and is recorded, not gated on.
 */
const CASES = [
  {
    id: 'steady-arrival',
    what: "30% of blocks arrive per interval, still arriving. The critic's P6 row 1, and the shape "
      + 'that defeats both max(0,d1-d2) and max(0,d2-d1) because it decelerates by nothing and '
      + 'accelerates by nothing.',
    d1: 0.30, d2: 0.30, d13: 0.55, overlap: 0.08,
    expect: 'unsettled', by: 'G3c_accumulation',
  },
  {
    id: 'slow-steady-arrival',
    what: "a slow loader, still arriving across both intervals. The critic's P6 row 2.",
    d1: 0.060, d2: 0.055, d13: 0.110, overlap: 0.05,
    expect: 'unsettled', by: 'G3c_accumulation',
  },
  {
    id: 'settled-marauders-coast',
    what: 'THE CONTROL FOR THE ROW ABOVE, and the reason the third frame is taken. A real measured '
      + 'settled frame from SETTLE-CALIBRATION.json (marauders-coast, night-clear). Its (d1, d2) is '
      + '(0.0644, 0.0640) — numerically the SAME PAIR as the slow loader above. Nothing computed '
      + 'from d1 and d2 can separate these two rows. |A-C| does: 0.066 against 0.110.',
    d1: 0.0644, d2: 0.0640, d13: 0.0660, overlap: 0.93,
    expect: 'SETTLED', by: null,
  },
  {
    id: 'accelerating-arrival',
    what: "the world explodes into existence AFTER the delivered frame. The critic's P6 row 3, and "
      + 'the worst of the three: B is the frame that ships and d2 is B\'s own interval, which the old '
      + 'gate clamped to zero with max() and never looked at.',
    d1: 0.02, d2: 0.14, d13: 0.150, overlap: 0.10,
    expect: 'unsettled', by: 'G3b_acceleration',
  },
  {
    id: 'burst-then-stop',
    what: "the builder's calibrated streaming case: content arrived in the first interval and "
      + 'stopped. This is the population the R1 threshold was fitted to, and G3a must still catch it.',
    d1: 0.0293, d2: 0.0174, d13: 0.0300, overlap: 0.55,
    expect: 'unsettled', by: 'G3a_deceleration',
  },
  {
    id: 'settled-live-cover',
    what: "ground cover swaying at a steady rate. The critic's P6 row 5, which must NOT be refused: "
      + 'a gate that refuses a legitimate capture is the same defect as one that refuses nothing.',
    d1: 0.087, d2: 0.0865, d13: 0.0900, overlap: 0.94,
    expect: 'SETTLED', by: null,
  },
  {
    id: 'settled-eastern-rootlands',
    what: 'the real settled frame with the largest measured rise in the whole calibration '
      + '(d1 = 0.1281, d2 = 0.1429, rise = 0.0149, ratio 1.116). It is the reason G3b ANDs an '
      + 'absolute bound with a ratio bound instead of using either alone: an absolute rise bound at '
      + 'RISE_ABS would refuse this legitimate frame.',
    d1: 0.1281, d2: 0.1429, d13: 0.1450, overlap: 0.90,
    expect: 'SETTLED', by: null,
  },
  {
    id: 'settled-thornmarsh',
    what: 'the real settled frame with the largest measured d2/d1 ratio (1.769). It is the reason '
      + 'G3b is not a ratio bound alone: a ratio bound at RISE_RATIO would refuse this legitimate '
      + 'frame. Its rise is only 0.0019, far under RISE_ABS, so the AND lets it through.',
    d1: 0.0025, d2: 0.0044, d13: 0.0050, overlap: 0.60,
    expect: 'SETTLED', by: null,
  },
  {
    id: 'still-frame',
    what: 'nothing is moving at all. Ten of the eighteen G1-clean calibration frames look like this.',
    d1: 0, d2: 0, d13: 0, overlap: 1,
    expect: 'SETTLED', by: null,
  },
];

/**
 * Cases about the gates that are NOT G3 — because R6 also required that a gate which could not run
 * says so instead of passing, and §3c of the verdict is that G1/G2 used to fail OPEN silently.
 */
const RESIDENCY_CASES = [
  {
    id: 'absent-world',
    what: 'a photograph of nothing: the picture is perfectly stable because the world was never '
      + 'built. 5 of 5 "absent" controls in the calibration look exactly like this, and it is the '
      + 'loophole the whole settle proof exists to close.',
    resid: { ran: true, read_only: true, queued: 23, want: 25, built: 0, tiles_queued: 0, tiles_resident: 2 },
    d1: 0, d2: 0, d13: 0, expect: 'unsettled', by: 'G1_residency',
  },
  {
    id: 'gate-did-not-run',
    what: 'the residency probe threw, or the camera was outside the province. R1 substituted '
      + '{queued: 0, ...} here and recorded G1 pass: true, so a manifest saying "settled, G1 pass" '
      + 'could mean "the gate never ran" and no reader could tell. It must now REFUSE.',
    resid: { ran: false, why: 'provinceResidency() threw' },
    d1: 0, d2: 0, d13: 0, expect: 'unsettled', by: ['G1_residency', 'G2_quiescence'],
  },
  {
    id: 'mutating-probe',
    what: 'the residency probe ran but did not declare itself read-only — i.e. it was the old '
      + 'streamAround(x, z, 0), which rebuilds three camera-following discs and releases every tile '
      + 'outside the new want-set, BETWEEN the frames the proof compares. Measured by the critic '
      + 'taking tilesResident 25 -> 0 and meshes 247 -> 5. A gate cannot demolish what it certifies.',
    resid: { ran: true, read_only: false, queued: 0, want: 25, built: 0, tiles_queued: 0, tiles_resident: 25 },
    d1: 0, d2: 0, d13: 0, expect: 'unsettled', by: 'G1_residency',
  },
  {
    id: 'streamer-still-busy',
    what: 'everything the camera needs is built, but the streamer still has work queued — so more '
      + 'is about to land. G2 exists for this and it must fire even though G1 is clean.',
    resid: { ran: true, read_only: true, queued: 0, want: 25, built: 0, tiles_queued: 6, tiles_resident: 25 },
    d1: 0, d2: 0, d13: 0, expect: 'unsettled', by: 'G2_quiescence',
  },
];

function runCase(c, resid) {
  const set = c.overlap === undefined ? null : SET(c.d1, c.d2, c.overlap);
  let proof, verdict;
  try {
    proof = judge({ resid, d1: D(c.d1), d2: D(c.d2), d13: D(c.d13), set, threshold: THRESHOLD, gap: GAP, frames: 24 });
    verdict = 'SETTLED';
  } catch (e) {
    if (!(e instanceof UnsettledError)) throw e;
    proof = e.proof; verdict = 'unsettled';
  }
  const g3 = proof.gates.G3_stability;
  // Which gates actually refused? Named, so a case cannot pass for a reason other than its own.
  const refusers = [];
  if (!proof.gates.G1_residency.pass) refusers.push('G1_residency');
  if (!proof.gates.G2_quiescence.pass) refusers.push('G2_quiescence');
  for (const k of ['G3a_deceleration', 'G3b_acceleration', 'G3c_accumulation']) {
    if (g3[k] && g3[k].pass === false) refusers.push(k);
  }
  const verdictOk = verdict === c.expect;
  // A refusal must come from the gate the case names, and ONLY from it: a steady arrival that is
  // caught by residency instead of accumulation has not demonstrated that accumulation works.
  const want = c.by === null || c.by === undefined ? [] : (Array.isArray(c.by) ? c.by : [c.by]);
  const gateOk = c.expect === 'SETTLED'
    ? refusers.length === 0
    : (refusers.length === want.length && want.every((g) => refusers.includes(g)));
  return {
    id: c.id, what: c.what,
    d1: c.d1, d2: c.d2, d13: c.d13,
    excess: g3.G3a_deceleration ? g3.G3a_deceleration.excess : null,
    rise: g3.G3b_acceleration ? g3.G3b_acceleration.rise : null,
    gamma: g3.G3c_accumulation ? g3.G3c_accumulation.gamma : null,
    expect: c.expect, got: verdict,
    must_be_refused_by: want, refused_by: refusers,
    ok: verdictOk && gateOk,
    why_not: verdictOk ? (gateOk ? null : `refused by [${refusers.join(', ')}], expected exactly [${want.join(', ')}]`) : `expected ${c.expect}, got ${verdict}`,
  };
}

const rows = [
  ...CASES.map((c) => runCase(c, RESIDENT)),
  ...RESIDENCY_CASES.map((c) => runCase(c, c.resid)),
];

const bad = rows.filter((r) => !r.ok);

// The pair that carries the whole argument for taking a third frame.
const slow = rows.find((r) => r.id === 'slow-steady-arrival');
const coast = rows.find((r) => r.id === 'settled-marauders-coast');
const separation = {
  claim: 'settle.mjs states that no function of (d1, d2) can separate a slow loader from the '
    + 'measured settled marauders-coast frame. This is the check of that claim, and of the third '
    + 'frame that resolves it.',
  slow_loader: { d1: slow.d1, d2: slow.d2, d13: slow.d13, gamma: slow.gamma, verdict: slow.got },
  settled_coast: { d1: coast.d1, d2: coast.d2, d13: coast.d13, gamma: coast.gamma, verdict: coast.got },
  d1_d2_are_within: Math.max(Math.abs(slow.d1 - coast.d1), Math.abs(slow.d2 - coast.d2)),
  separated: slow.got !== coast.got,
  separated_by: 'd13 / max(d1, d2) — gamma ' + slow.gamma + ' vs ' + coast.gamma + ', bound ' + ACC_RATIO,
};

const report = {
  schema: 'elder-souls/settle-shapes@1',
  ran_at: new Date().toISOString(),
  what: 'G3 discrimination with a COMPLETE residency reading and a COMPLETE triad — the region '
    + 'critic-r1-probe.mjs --metric can no longer reach, because every one of its rows is refused '
    + 'by the fail-closed G1 before G3 is consulted.',
  bounds: { THRESHOLD, RISE_ABS, RISE_RATIO, ACC_RATIO, ACC_FLOOR, GAP },
  cases: rows.length,
  misjudged: bad.length,
  verdict: bad.length ? 'G3 MISJUDGED A SHAPE' : 'every shape judged correctly, by the gate that should judge it',
  separation,
  rows,
};

const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);
fs.writeFileSync(path.join(OUT, 'SETTLE-SHAPES.json'), JSON.stringify(report, null, 2));

if (args.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  log('shape                        d1       d2       d13     excess    rise    gamma   expect     got        refused by');
  for (const r of rows) {
    log(`${r.ok ? ' ' : '!'} ${r.id.padEnd(26)} ${String(r.d1).padEnd(8)} ${String(r.d2).padEnd(8)} ${String(r.d13).padEnd(7)} ` +
      `${String(r.excess ?? '-').padEnd(9)} ${String(r.rise ?? '-').padEnd(7)} ${String(r.gamma ?? '-').padEnd(7)} ` +
      `${r.expect.padEnd(10)} ${r.got.padEnd(10)} ${r.refused_by.join(',') || '-'}`);
  }
  log('');
  log(`the pair no (d1,d2) function can separate: slow loader gamma=${slow.gamma} -> ${slow.got}; ` +
    `settled coast gamma=${coast.gamma} -> ${coast.got}; separated=${separation.separated}`);
  for (const r of bad) log(`MISJUDGED ${r.id}: ${r.why_not}`);
}

process.stdout.write(`${report.verdict}: ${bad.length} of ${rows.length} shapes misjudged\n`);
process.exit(bad.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
