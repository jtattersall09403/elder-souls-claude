#!/usr/bin/env node
// music-coverage.mjs — ABSENCE-REPORTER.
//
// Named by: RI-AUD04 (music policy).
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
//   the fraction of a session with music playing, by state, from music-log.json sampled off musicState() - RI-AUD04 wants silence to be the default and music to be an event
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// RI-AUD01..03 / wave-1 piece W1-25 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
music-coverage.mjs — ABSENCE-REPORTER for: audio.

USAGE
  node tools/analysis/music-coverage.mjs --run reports/runs/<runId>

OPTIONS
  --run DIR      a run directory carrying music-log.json
  --out PATH     write the report JSON
  --help

WHY NO NUMBER
  audio is declared not_implemented by this build
  (owner: RI-AUD01..03 / wave-1 piece W1-25). This tool emits no measurement and
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
  tool: 'tools/analysis/music-coverage.mjs',
  items: ["RI-AUD04 (music policy)"],
  system: 'audio',
  owner: 'RI-AUD01..03 / wave-1 piece W1-25',
  measures: 'the fraction of a session with music playing, by state, from music-log.json sampled off musicState() - RI-AUD04 wants silence to be the default and music to be an event',
  needs: ["musicState", "getMusicLog"],
}, args);

process.exit(exit);
