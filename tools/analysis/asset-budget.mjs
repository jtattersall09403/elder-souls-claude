#!/usr/bin/env node
// asset-budget.mjs — ABSENCE-REPORTER.
//
// Named by: RI-PLT02 M-M2 (asset budget D1-D8).
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
//   RI-PLT02 D6 is a census of TEXTURE FORMATS. This build ships no texture tree and
//   A-JRN14 (resource registry) is declared absent, so there is nothing to census. Walking
//   game/data/**.json and reporting bytes would answer a different question in the right
//   units, which is the substitution TOOL-COVERAGE-R1 section 1 ruled illegitimate.
//
// WHAT THE REAL INSTRUMENT WOULD MEASURE
//   RI-PLT02 B.2 rows D1-D5 and D8 over the shipped build, plus a texture-format census for D6 (>= 90% compressed)
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// wave-1 pieces W1-01..W1-05 (the asset tree RI-PLT02 B.2 budgets) — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
asset-budget.mjs — ABSENCE-REPORTER for: the province: 13 regions, 8 settlements, 250 interiors, roads.

USAGE
  node tools/analysis/asset-budget.mjs --manifest game/data/index.json --out reports/platform/<runId>

OPTIONS
  --manifest PATH  the asset manifest the real instrument would walk
  --out PATH       write the report JSON
  --help

WHY NO NUMBER
  the province: 13 regions, 8 settlements, 250 interiors, roads is declared not_implemented by this build
  (owner: wave-1 pieces W1-01..W1-05 (the asset tree RI-PLT02 B.2 budgets)). This tool emits no measurement and
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
  tool: 'tools/analysis/asset-budget.mjs',
  items: ["RI-PLT02 M-M2 (asset budget D1-D8)"],
  system: 'the province: 13 regions, 8 settlements, 250 interiors, roads',
  owner: 'wave-1 pieces W1-01..W1-05 (the asset tree RI-PLT02 B.2 budgets)',
  measures: 'RI-PLT02 B.2 rows D1-D5 and D8 over the shipped build, plus a texture-format census for D6 (>= 90% compressed)',
  amendment: 'A-JRN14',
  needs: [{ method: 'getResourceRegistry', amendment: 'A-JRN14' }, 'getWorldStats'],
}, args);

process.exit(exit);
