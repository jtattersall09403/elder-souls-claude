#!/usr/bin/env node
// load-run.mjs — ABSENCE-REPORTER.
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
// WHAT THE REAL INSTRUMENT WOULD MEASURE
//   time to first playable and time to first input under a throttled network on attested hardware, cold and warm
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// attested real hardware (RI-PLT01 T1); RI-PLT03 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
load-run.mjs — ABSENCE-REPORTER for: Tier-H performance numbers.

USAGE
  node tools/platform/load-run.mjs --profile phone-mid --network fast3g --cold --out reports/platform/<runId>

OPTIONS
  --profile P    device profile
  --network N    throttling profile
  --cold         cold-cache run
  --tier S|H     structural or hardware-attested
  --device-class C
  --out PATH     write the report JSON
  --help

WHY NO NUMBER
  Tier-H performance numbers is declared not_implemented by this build
  (owner: attested real hardware (RI-PLT01 T1); RI-PLT03). This tool emits no measurement and
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
  tool: 'tools/platform/load-run.mjs',
  items: ["RI-PLT03 (load, streaming and hitches)"],
  system: 'Tier-H performance numbers',
  owner: 'attested real hardware (RI-PLT01 T1); RI-PLT03',
  measures: 'time to first playable and time to first input under a throttled network on attested hardware, cold and warm',
  needs: ["getLoadState", "getPerfStats"],
}, args);

process.exit(exit);
