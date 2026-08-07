#!/usr/bin/env node
// audio-sync.mjs — ABSENCE-REPORTER.
//
// Named by: RI-AUD01 (combat impact audio, M1-M8).
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
//   the offset between each hit frame and its impact sample onset, per weapon class and material, against RI-AUD01's tolerance
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// RI-AUD01..03 / wave-1 piece W1-25 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
audio-sync.mjs — ABSENCE-REPORTER for: audio.

USAGE
  node tools/analysis/audio-sync.mjs --run reports/runs/<runId>

OPTIONS
  --run DIR      a run directory carrying audio-log.json
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
  tool: 'tools/analysis/audio-sync.mjs',
  items: ["RI-AUD01 (combat impact audio, M1-M8)"],
  system: 'audio',
  owner: 'RI-AUD01..03 / wave-1 piece W1-25',
  measures: 'the offset between each hit frame and its impact sample onset, per weapon class and material, against RI-AUD01\'s tolerance',
  needs: ['getWorldStats', 'getCombatState'],
  // The live signal, read from the running build rather than asserted: the engine reports
  // audioMB: 0 and getCapabilityReport() declares "audio" not_implemented (owner W1-25). The
  // day either changes, this reporter stops saying ABSENT.
  probe: async ({ handle }) => {
    const ws = await handle.hOpt('getWorldStats');
    const markers = [];
    if (ws && Number(ws.audioMB) === 0) markers.push('getWorldStats().audioMB === 0');
    if (ws && ws._declared_incomplete) markers.push('getWorldStats()._declared_incomplete');
    return { audioMB: ws ? ws.audioMB : null, _unmeasurable_markers: markers };
  },
}, args);

process.exit(exit);
