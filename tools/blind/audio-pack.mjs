#!/usr/bin/env node
// audio-pack.mjs — ABSENCE-REPORTER.
//
// Named by: RI-AUD01 (combat impact audio), RI-AUD03 (regional ambience).
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
//   A blind pack with no clips in it is not a blind pack. RI-MTH03 is explicit that a
//   pack in which one side is empty is discriminable on that alone, so no pack directory is
//   written: an empty pack on disk is worse than none, because someone will judge it.
//
// WHAT THE REAL INSTRUMENT WOULD MEASURE
//   a blind A/B pack of loudness-normalised, metadata-stripped audio clips from our build and from the reference, in one form, per RI-MTH03
//
// Until it exists, every dimension blocked ONLY by this is `corpus_debt` against
// RI-AUD01..03 / wave-1 piece W1-25 — never a zero against a build.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { reportAbsence } from '../lib/absence.mjs';

const USAGE = `
audio-pack.mjs — ABSENCE-REPORTER for: audio.

USAGE
  node tools/blind/audio-pack.mjs --run reports/runs/<runId> --out packs/aud-w<N>

OPTIONS
  --run DIR      the run to draw clips from
  --in DIR       alternative input directory (RI-AUD03 section M)
  --lufs N       loudness normalisation target
  --strip-meta   strip metadata from every clip
  --out DIR      pack directory
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
  tool: 'tools/blind/audio-pack.mjs',
  items: ["RI-AUD01 (combat impact audio)", "RI-AUD03 (regional ambience)"],
  system: 'audio',
  owner: 'RI-AUD01..03 / wave-1 piece W1-25',
  measures: 'a blind A/B pack of loudness-normalised, metadata-stripped audio clips from our build and from the reference, in one form, per RI-MTH03',
  needs: ["getAudioLog", "recordAudio", "audioState"],
}, args);

process.exit(exit);
