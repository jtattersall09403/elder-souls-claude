#!/usr/bin/env node
// stream-audit.mjs — ABSENCE-REPORTER.
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
//   what is resident, requested and evicted as the player crosses region borders, and whether any asset is fetched twice or held after its region is four cells behind
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// wave-1 pieces W1-01..W1-05 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
stream-audit.mjs — ABSENCE-REPORTER for: the province: 13 regions, 8 settlements, 250 interiors, roads.

USAGE
  node tools/platform/stream-audit.mjs --traverse regionA:regionD --minutes 20 --out reports/platform/<runId>

OPTIONS
  --traverse A:B the region traverse the real instrument would drive
  --minutes N    traverse length
  --out PATH     write the report JSON
  --help

WHY NO NUMBER
  the province: 13 regions, 8 settlements, 250 interiors, roads is declared not_implemented by this build
  (owner: wave-1 pieces W1-01..W1-05). This tool emits no measurement and
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
  tool: 'tools/platform/stream-audit.mjs',
  items: ["RI-PLT03 (load, streaming and hitches)"],
  system: 'the province: 13 regions, 8 settlements, 250 interiors, roads',
  owner: 'wave-1 pieces W1-01..W1-05',
  measures: 'what is resident, requested and evicted as the player crosses region borders, and whether any asset is fetched twice or held after its region is four cells behind',
  amendment: 'A-JRN14',
  // `getStreamingState`/`getResidentAssets` were invented. `getResourceRegistry` is what
  // A-JRN14's register row actually names; `getLoadState` and `getWorldStats` are live and
  // carry the build's own `_unmeasurable`/`_declared_incomplete` markers.
  needs: [{ method: 'getResourceRegistry', amendment: 'A-JRN14' }, 'getLoadState', 'getWorldStats'],
}, args);

process.exit(exit);
