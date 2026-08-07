#!/usr/bin/env node
// hitch-census.mjs — ABSENCE-REPORTER.
//
// Named by: RI-PLT03 (load, streaming and hitches).
//
// The system it would measure does not exist in this build, so there is no honest number to
// emit. TOOL-LOOP rule 1 names the third thing between "write nothing" and "stub it to pass":
// report the absence and exit non-zero with a reason. TOOL-COVERAGE-R1's Ruling 2 made that
// binding for this file, and was right to: writing nothing left the dimension looking like a
// builder's zero.
//
// It is NOT a hard-coded note. It boots the game and confirms the absence against the RUNNING
// build — the system named in `getCapabilityReport().not_implemented`, and the harness methods
// the real instrument would need genuinely missing — so it stops being true the moment the
// system ships, and says so by exiting 21 rather than 0.
//
//   Hitch DURATIONS are frame times by another name. RI-PLT01 T1 forbids them from a
//   software renderer as flatly as it forbids fps, and this harness is SwiftShader.
//
// WHAT THE REAL INSTRUMENT WOULD MEASURE
//   every frame over the budget, bucketed by cause (stream-in, GC, shader compile, decode), with duration and count per bucket
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// attested real hardware (RI-PLT01 T1); RI-PLT03 M-L4/M-L5 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
hitch-census.mjs — ABSENCE-REPORTER for: Tier-H performance numbers.

USAGE
  node tools/platform/hitch-census.mjs --in reports/platform/<runId>

OPTIONS
  --in DIR       the load-run.mjs run directory whose frames would be censused
  --out PATH     write the report JSON
  --help

WHY NO NUMBER
  Tier-H performance numbers is declared not_implemented by this build
  (owner: attested real hardware (RI-PLT01 T1); RI-PLT03 M-L4/M-L5). This tool emits no measurement and
  exits non-zero. A zero here would convert an unmeasured dimension into a measured-and-failing
  one and charge a builder for the corpus's gap.

EXIT CODES
  20  the absence was confirmed against the running build (expected)
  21  the system has ARRIVED — replace this file with a real instrument
  2   usage
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const exit = await reportAbsence({
  tool: 'tools/platform/hitch-census.mjs',
  items: ["RI-PLT03 (load, streaming and hitches)"],
  system: 'Tier-H performance numbers',
  owner: 'attested real hardware (RI-PLT01 T1); RI-PLT03 M-L4/M-L5',
  measures: 'every frame over the budget, bucketed by cause (stream-in, GC, shader compile, decode), with duration and count per bucket',
  needs: ['getPerfStats', 'getLoadState'],
  // TOOL-COVERAGE-R2 §4's wider ruling, recorded here rather than silently carried:
  // this file refuses the Tier-H NUMBER, which is correct, but RI-PLT01 P7 makes GC pause
  // COUNTS AND ATTRIBUTION Tier-S — scoreable in this container. That half is NOT measured by
  // this file and is NOT covered by this ABSENT verdict. `tools/platform/decoupling.mjs` is the
  // worked example of the split (M6 promoted from a refusal to a real Tier-S instrument in tool
  // round 3); the same is owed here and was not done in that round.
  tier_s_half_not_measured_here: {
    quantity: 'GC collection counts and their attribution to the sim window or outside it ' +
              '(RI-PLT01 M5/P5/P6, Tier-S, weight 4)',
    why_not_here: 'this reporter refuses the Tier-H hitch DURATIONS (P7). The counts are a ' +
                  'different measurement with a different tier and must not be read as covered ' +
                  'by this refusal.',
    owner: 'tool round 4, per TOOL-COVERAGE-R2 §4',
  },
}, args);

process.exit(exit);
