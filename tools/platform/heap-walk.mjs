#!/usr/bin/env node
// heap-walk.mjs — ABSENCE-REPORTER.
//
// Named by: RI-PLT02 (memory and asset budgets, M-M1..M-M8).
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
//   a heap-snapshot diff across a session loop: retained-by-constructor, detached DOM/GL objects, and which constructor grew between snapshots
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// A-JRN9 / runner-side or later pieces (RI-PLT02) — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
heap-walk.mjs — ABSENCE-REPORTER for: heap/GC access.

USAGE
  node tools/platform/heap-walk.mjs --in reports/platform/<runId>

OPTIONS
  --in DIR       the leak-run.mjs run directory whose snapshots would be diffed
  --out PATH     write the report JSON
  --help

WHY NO NUMBER
  heap/GC access is declared not_implemented by this build
  (owner: A-JRN9 / runner-side or later pieces (RI-PLT02)). This tool emits no measurement and
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
  tool: 'tools/platform/heap-walk.mjs',
  items: ["RI-PLT02 (memory and asset budgets, M-M1..M-M8)"],
  system: 'heap/GC access',
  owner: 'A-JRN9 / runner-side or later pieces (RI-PLT02)',
  measures: 'a heap-snapshot diff across a session loop: retained-by-constructor, detached DOM/GL objects, and which constructor grew between snapshots',
  needs: ["getHeapSnapshot", "gc", "getHeapStats"],
}, args);

process.exit(exit);
