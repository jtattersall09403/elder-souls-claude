#!/usr/bin/env node
// perf-run.mjs — RI-PLT01's frame-budget runner, AND the enforcer of RI-PLT01 rule T1.
//
// TWO JOBS, and the second one is live today even though the first cannot be.
//
// 1. THE MEASUREMENT — absent. `getCapabilityReport().not_implemented` carries
//    "Tier-H performance numbers (fps, frame time, TTFP wall clock, hitch durations)", owner
//    "attested real hardware", surfaced as `getPerfStats()._unmeasurable`. This harness renders
//    through SwiftShader. An fps figure taken here is inadmissible by construction, so none is
//    emitted, and this tool exits non-zero with the reason (TOOL-LOOP rule 1).
//
// 2. THE REFUSAL — live, and it is why this file could not go on not existing. RI-PLT01 T1:
//
//      "A manifest whose renderer string contains SwiftShader, llvmpipe, software or Mesa may
//       not produce a Tier-H score at all — not a low one, not a provisional one. The tooling
//       enforces this (tools/platform/perf-run.mjs refuses to emit Tier-H fields when the
//       renderer is software) so that a well-meaning critic cannot report a SwiftShader frame
//       time as evidence."
//
//    The item DELEGATES ITS OWN ENFORCEMENT to this path. While it did not exist, the item's
//    defence against its own worst failure mode was a sentence, and nothing stopped that critic
//    (TOOL-COVERAGE-R1, Ruling 2). `--tier H` now refuses, by reading the renderer string out of
//    the page through WEBGL_debug_renderer_info rather than trusting a manifest anyone can type.
//
//    `--attest-renderer STR --device-class C` exists so the refusal can be FALSIFIED: hand it a
//    real GPU string and a valid device class and T1 stops refusing — which is the only way to
//    tell a working gate from a function that returns false.
//
// EXIT CODES: 20 the measurement could not be taken (the normal outcome here); 21 the Tier-H
//             capability has ARRIVED and this file must be replaced; 2 usage.
'use strict';

import { parseArgs, wantsHelp, usage, EXIT } from '../lib/cli.mjs';
import { reportAbsence, readRenderer, t1Verdict } from '../lib/absence.mjs';

const USAGE = `
perf-run.mjs — RI-PLT01 frame budget. ABSENCE-REPORTER + the rule-T1 enforcer.

USAGE
  node tools/platform/perf-run.mjs --scenarios F1,F2,F3,F4,F5 --seed 4711 --out reports/platform/<runId>
  node tools/platform/perf-run.mjs --scenarios F1,F2,F3,F4,F5 --tier H --out reports/platform/<runId>-hw
  node tools/platform/perf-run.mjs --t1-only [--attest-renderer STR --device-class C]

OPTIONS
  --scenarios LIST       RI-PLT01 §D scenarios. Read, recorded, and NOT run: see below.
  --seed N               recorded in the artifact
  --tier S|H             S = structural (determinism, decoupling); H = hardware-attested
  --t1-only              evaluate rule T1 against this environment and exit; take no other step
  --attest-renderer STR  the renderer string to test T1 against instead of this page's own.
                         This is the falsification handle: a real GPU string must make T1 STOP
                         refusing, or the refusal is a constant rather than a check.
  --device-class C       phone-mid | phone-high | laptop-integrated | desktop-discrete
  --out PATH             write the report JSON
  --help

WHY NO NUMBER
  Tier-H performance numbers are declared not_implemented by this build (owner: attested real
  hardware) and RI-PLT01 T1 forbids emitting them from a software renderer at all. Emitting one
  anyway would convert an unmeasured dimension into a measured-and-passing one, which is the
  exact failure RI-CHR01 names about a different checker. Dimensions blocked only by this are
  corpus_debt against the absent hardware attestation, never a zero against a build.

EXIT CODES
  20  the measurement could not be taken (expected)
  21  the Tier-H capability has arrived — replace this file with a real instrument
  2   usage
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const attest = args['attest-renderer'] ? String(args['attest-renderer']) : null;
const deviceClass = args['device-class'] ? String(args['device-class']) : null;

// --t1-only: the enforcement alone, with no boot when a renderer string is supplied. This is the
// mode a critic uses to check a manifest they were handed.
if (args['t1-only'] && attest) {
  const v = t1Verdict(attest, deviceClass);
  process.stdout.write(JSON.stringify({ tool: 'tools/platform/perf-run.mjs', mode: 't1-only', ...v }, null, 2) + '\n');
  process.stdout.write(v.tier_h_admissible
    ? 'T1: ADMISSIBLE — this renderer/device-class pair may carry a Tier-H score. ' +
      'perf-run does NOT thereby produce one: the measurement is still absent from this build.\n'
    : `T1: REFUSED — ${v.software_markers_hit.length ? 'renderer string contains ' + v.software_markers_hit.join(', ') : 'device class is not one of the four attested classes'}. No Tier-H field may be emitted.\n`);
  // Non-zero either way: admissible is a statement about the manifest, never a measurement.
  process.exit(EXIT.MEASUREMENT_FAIL);
}

const exit = await reportAbsence({
  tool: 'tools/platform/perf-run.mjs',
  items: ['RI-PLT01 (frame budget, M1-M15)'],
  system: 'Tier-H performance numbers',
  owner: 'attested real hardware (RI-PLT01 T1); no owner assigned in the corpus — TOOL-COVERAGE-R1 Ruling 2 asks for one',
  measures: 'frame time p50/p95/p99 and hitch counts over RI-PLT01 §D scenarios F1..F5 on ' +
            'attested hardware, plus TTFP wall clock',
  needs: ['getPerfStats', 'getLoadState'],
  probe: async ({ handle }) => {
    const renderer = await readRenderer(handle);
    const perf = await handle.hOpt('getPerfStats');
    const load = await handle.hOpt('getLoadState');
    const markers = [];
    if (perf && perf._unmeasurable) markers.push('getPerfStats()._unmeasurable');
    if (load && load._unmeasurable) markers.push('getLoadState()._unmeasurable');
    return {
      renderer,
      _unmeasurable_markers: markers,
      // The fields are named, and pointedly not their values: a reader must be able to see WHAT
      // was refused without the refusal handing over the number anyway.
      tier_h_fields_withheld: ['fps', 'frame_time_p50', 'frame_time_p95', 'frame_time_p99', 'hitch_count', 'hitch_ms', 'ttfp_ms'],
      scenarios_requested: args.scenarios ? String(args.scenarios).split(',').map((s) => s.trim()) : [],
      seed: args.seed === undefined ? null : Number(args.seed),
      tier_requested: args.tier ? String(args.tier) : 'S',
    };
  },
  enforce: async ({ handle }) => {
    const renderer = attest ? { unmaskedRenderer: attest } : await readRenderer(handle);
    const str = renderer.unmaskedRenderer || renderer.renderer || '';
    const v = t1Verdict(str, deviceClass);
    return {
      rule: 'RI-PLT01 T1',
      source: attest ? '--attest-renderer (falsification handle)' : 'WEBGL_debug_renderer_info on this page',
      ...v,
      action: v.tier_h_admissible
        ? 'T1 does not refuse this renderer. The Tier-H fields are STILL withheld, because the ' +
          'measurement itself is absent from this build — T1 admissibility is a property of the ' +
          'manifest, not a measurement.'
        : 'REFUSED. No Tier-H field may be emitted from this environment, and any verdict citing ' +
          'one from it is inadmissible under RI-PLT01 T1.',
    };
  },
}, args);

process.exit(exit);
