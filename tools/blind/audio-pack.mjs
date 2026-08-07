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
  owner: 'RI-AUD01/02 -> W1-11 (combat impact); RI-AUD03 -> W1-22 (regional ambience, BUILT)',
  measures: 'a blind A/B pack of loudness-normalised, metadata-stripped audio clips from our build and from the reference, in one form, per RI-MTH03',
  needs: ['getWorldStats'],
  // The live signal, read from the running build rather than asserted.
  //
  // W1-22 CHANGED WHAT THIS MUST LOOK AT. `audioMB === 0` was the marker, and it is still 0 and
  // always will be: the regional bed is SYNTHESISED, so there are no decoded audio bytes to
  // count and a megabyte total is not evidence of anything either way. Keeping `audioMB === 0`
  // as the sole marker would have this tool reporting ABSENT over a province that makes thirteen
  // distinct sounds — the mirror image of the defect the audio axes were scored on.
  //
  // So the marker is now `getAmbienceState()`. Regional ambience (RI-AUD03) exists when the
  // driver answers with a region and a bed; combat impact audio (RI-AUD01) does not exist at
  // all, and this tool covers both items, so it still reports ABSENT — but for the honest half.
  probe: async ({ handle }) => {
    const ws = await handle.hOpt('getWorldStats');
    const amb = await handle.hOpt('getAmbienceState');
    const markers = [];
    const ambienceLive = !!(amb && amb.available && amb.beds_loaded > 0);
    if (!ambienceLive) markers.push('getAmbienceState() reports no beds (RI-AUD03 unbuilt)');
    markers.push('no combat impact audio: RI-AUD01 has no hit, parry, block or footstep sound (owner W1-11)');
    if (ws && ws._declared_incomplete) markers.push('getWorldStats()._declared_incomplete');
    return {
      audioMB: ws ? ws.audioMB : null,
      audio_synthesised: ws ? ws.audioSynthesised === true : null,
      ambience_beds: ws ? ws.ambienceBeds : null,
      ambience_data_kb: ws ? ws.ambienceDataKB : null,
      ri_aud03_regional_ambience: ambienceLive ? 'BUILT (W1-22) — capture with __HARNESS.ambienceCapture()' : 'ABSENT',
      ri_aud01_combat_impact: 'ABSENT (W1-11)',
      _unmeasurable_markers: markers,
    };
  },
}, args);

process.exit(exit);
