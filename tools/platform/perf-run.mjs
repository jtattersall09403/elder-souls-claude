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
// 2. THE REFUSAL — live. RI-PLT01 T1 DELEGATES ITS OWN ENFORCEMENT to this path:
//
//      "The tooling enforces this (tools/platform/perf-run.mjs refuses to emit Tier-H fields
//       when the renderer is software) so that a well-meaning critic cannot report a
//       SwiftShader frame time as evidence."
//
// ---------------------------------------------------------------------------------------------
// ROUND 3. TOOL-COVERAGE-R2 §3 broke the round-2 gate two ways, and both are closed here.
//
// DEFEAT 1 — twenty lines running IN THE PAGE. `readRenderer()` asks the page, and the page is
//   the side under test. One init script patching `WebGLRenderingContext.prototype.getParameter`
//   turned SwiftShader into "NVIDIA GeForce RTX 4070/PCIe/SSE2" and T1 went ADMISSIBLE. Meanwhile
//   `tools/lib/browser.mjs` had launched Chromium with `--use-angle=swiftshader` — on the NODE
//   side, where the page cannot reach it — and the gate never consulted it.
//
//   FIX. `handle.chromiumArgs` (added to browser.mjs this round) carries the exact flag list this
//   runner passed. `launchArgAudit()` reads it Node-side. When the harness itself asked Chromium
//   for a software backend, T1 REFUSES whatever the page says about itself. A page cannot forge a
//   flag it never saw.
//
// DEFEAT 2 — "not on the ban list" was treated as "attested GPU". `Microsoft Basic Render
//   Driver` (WARP), `WebKit WebGL` (the masked string a browser returns when it REFUSES to
//   identify the GPU), `Google Inc. (Google)` (the masked vendor string) and SwiftShader's own
//   `Subzero Device` all read ADMISSIBLE, because the test was `hit.length === 0 && classOk &&
//   s.length > 0`. T1's direction is "may not produce a Tier-H score AT ALL", so the safe default
//   on an UNIDENTIFIABLE renderer is refusal.
//
//   FIX. A fail-closed allowlist: the string must name an attestable GPU vendor family, must not
//   match the known-software-the-markers-miss list, and must not be a masked string. Anything
//   else is `identified: false` and refused, with the four-marker hit reported separately so the
//   item's own rule is still visible.
//
// FALSIFIABILITY IS PRESERVED, and this is the part that needs care. `--t1-only
// --attest-renderer STR --device-class C` evaluates the RULE against a manifest and does NOT
// consult this container's environment — otherwise the gate would refuse everything, which is
// the same defect as passing everything (TOOL-COVERAGE-R2's opening paragraph). Manifest mode
// says loudly that it consulted no environment. Any mode that DOES boot cross-checks the page
// renderer and the launch flags, and an attestation that disagrees with them is
// `attestation_contradicts_environment`.
//
// EXIT CODES: 20 the measurement could not be taken (the normal outcome here); 21 the Tier-H
//             capability has ARRIVED and this file must be replaced; 22 a `needs` entry names
//             nothing; 2 usage.
'use strict';

import { parseArgs, wantsHelp, usage, EXIT } from '../lib/cli.mjs';
import { reportAbsence, readRenderer, t1Verdict, launchArgAudit } from '../lib/absence.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const USAGE = `
perf-run.mjs — RI-PLT01 frame budget. ABSENCE-REPORTER + the rule-T1 enforcer.

USAGE
  node tools/platform/perf-run.mjs --scenarios F1,F2,F3,F4,F5 --seed 4711 --out reports/platform/<runId>
  node tools/platform/perf-run.mjs --t1-only --attest-renderer STR --device-class C
  node tools/platform/perf-run.mjs --t1-only --live
  node tools/platform/perf-run.mjs --self-test

OPTIONS
  --scenarios LIST       RI-PLT01 §D scenarios. Read, recorded, and NOT run: see below.
  --seed N               recorded in the artifact
  --tier S|H             S = structural (determinism, decoupling); H = hardware-attested
  --t1-only              evaluate rule T1 and exit; take no other step
  --live                 with --t1-only: BOOT and judge THIS container — the page's renderer AND
                         the Chromium flags this runner passed, read Node-side
  --attest-renderer STR  a renderer string to test T1 against. With --t1-only and no --live this
                         is MANIFEST MODE: the rule alone, no environment consulted, so a real
                         GPU string must make T1 stop refusing. That is the falsification handle
                         and it must keep working, or the refusal is a constant.
                         In a LIVE run it is cross-checked against the page and the launch flags.
  --env-args A,B,C       manifest mode only: the launch flags to judge the manifest against.
                         Use "none" for a clean environment. Defaults to not consulting one.
  --device-class C       phone-mid | phone-high | laptop-integrated | desktop-discrete
  --out PATH             write the report JSON
  --self-test            the T1 falsification battery (no browser)
  --help

WHY NO NUMBER
  Tier-H performance numbers are declared not_implemented by this build (owner: attested real
  hardware) and RI-PLT01 T1 forbids emitting them from a software renderer at all. Dimensions
  blocked only by this are corpus_debt against the absent hardware attestation, never a zero
  against a build.

EXIT CODES
  20  the measurement could not be taken (expected)
  21  the Tier-H capability has arrived — replace this file with a real instrument
  22  a needs entry names nothing (the run is refused, no verdict produced)
  2   usage
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const attest = args['attest-renderer'] ? String(args['attest-renderer']) : null;
const deviceClass = args['device-class'] ? String(args['device-class']) : null;

// ---------------------------------------------------------------------------------------------
// --self-test: the T1 battery. No browser — every case is a string and a flag list, which is
// exactly what the rule is about. The critic's four ADMISSIBLE strings are cases 5-8.
// ---------------------------------------------------------------------------------------------
if (args['self-test']) {
  let failed = 0;
  const ok = (name, pass, detail) => {
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
    if (!pass) failed++;
  };
  const CLEAN = { launch: launchArgAudit([]), pageRenderer: null };
  const SW = { launch: launchArgAudit(DETERMINISTIC_CHROMIUM_ARGS), pageRenderer: null };
  const v = (s, c, e) => t1Verdict(s, c, e || CLEAN);

  // The green case FIRST. A gate that cannot pass measures nothing.
  const good = v('NVIDIA GeForce RTX 4070/PCIe/SSE2', 'desktop-discrete');
  ok('GREEN: a real GPU on a clean environment is ADMISSIBLE',
    good.tier_h_admissible === true, `identified=${good.identified}, refused_because=[]`);

  ok('the four RI-PLT01 markers still refuse',
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)', 'Mesa Intel(R) UHD Graphics', 'Software Rasterizer']
      .every((s) => v(s, 'desktop-discrete').tier_h_admissible === false),
    'swiftshader / llvmpipe / mesa / software all refused');

  ok('a bad device class refuses a real GPU',
    v('NVIDIA GeForce RTX 4070', 'gaming-pc').tier_h_admissible === false
    && v('NVIDIA GeForce RTX 4070', null).tier_h_admissible === false,
    'gaming-pc and (none) both refused');

  // TOOL-COVERAGE-R2 §3's table. All four were ADMISSIBLE in round 2.
  const R2_TABLE = [
    ['Microsoft Basic Render Driver', 'WARP'],
    ['WebKit WebGL', 'the masked string'],
    ['Google Inc. (Google)', 'the masked vendor'],
    ['ANGLE (Google, Vulkan 1.3.0 (Subzero Device (0x0000C0DE)))', 'Subzero without the word'],
  ];
  for (const [s, what] of R2_TABLE) {
    const r = v(s, 'desktop-discrete');
    ok(`fail-closed: ${JSON.stringify(s)} (${what}) is REFUSED`,
      r.tier_h_admissible === false,
      r.refused_because.join(' | ').slice(0, 150));
  }

  // The Node-side environment check — the spoof the critic ran.
  const spoofed = t1Verdict('NVIDIA GeForce RTX 4070/PCIe/SSE2', 'desktop-discrete', SW);
  ok('a page claiming an RTX 4070 is REFUSED when THIS RUNNER asked for a software backend',
    spoofed.tier_h_admissible === false && spoofed.environment_requested_software === true,
    `flags read Node-side: ${spoofed.environment_software_flags.join(' ')}`);

  const contradicted = t1Verdict('NVIDIA GeForce RTX 4070/PCIe/SSE2', 'desktop-discrete',
    { launch: launchArgAudit([]), pageRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' });
  ok('attestation_contradicts_environment: attested GPU vs a software page renderer',
    contradicted.tier_h_admissible === false && contradicted.attestation_contradicts_environment === true,
    contradicted.refused_because.find((r) => r.startsWith('attestation_contradicts')) || '');

  // A null control: the environment check must not refuse when the environment is clean.
  ok('null control: a clean environment does NOT refuse on its own',
    launchArgAudit([]).requested_software === false
    && v('AMD Radeon RX 7900 XTX', 'desktop-discrete').tier_h_admissible === true,
    'no software flags, a real GPU, admissible');

  // And the whole set is discriminating, not a constant either way.
  const all = [...R2_TABLE.map(([s]) => s), 'NVIDIA GeForce RTX 4070', 'llvmpipe']
    .map((s) => v(s, 'desktop-discrete').tier_h_admissible);
  ok('the gate DISCRIMINATES (some admissible, some not)',
    new Set(all).size === 2, `verdicts: ${JSON.stringify(all)}`);

  process.stdout.write(`\nperf-run T1 self-test: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// --t1-only, MANIFEST MODE. The rule alone. No environment is consulted unless --env-args says
// so, and the artifact says which — an admissible verdict here is a statement about a manifest,
// never about this container.
// ---------------------------------------------------------------------------------------------
if (args['t1-only'] && attest && !args.live) {
  if (args['env-args'] === true) {
    // parseArgs swallows a value that begins with "--", so `--env-args --use-angle=swiftshader`
    // silently becomes a bare boolean and the audit would find nothing. A flag that quietly
    // means the opposite of what was typed is the defect this round exists to close.
    usage('--env-args needs a value and the value starts with "--", so it must be written joined:\n' +
          '  --env-args=--use-angle=swiftshader,--use-gl=angle\n' +
          '  --env-args none        (judge against a clean environment)\n', EXIT.USAGE);
  }
  const envArgs = args['env-args'] === undefined ? null
    : (String(args['env-args']) === 'none' ? [] : String(args['env-args']).split(','));
  const env = envArgs === null ? {} : { launch: launchArgAudit(envArgs) };
  const v = t1Verdict(attest, deviceClass, env);
  const out = {
    tool: 'tools/platform/perf-run.mjs',
    mode: 't1-only/manifest',
    environment_consulted: envArgs === null
      ? 'NONE. This is the rule evaluated against a manifest string. It says nothing about the ' +
        'machine this ran on. Use --live to judge THIS container.'
      : `--env-args ${envArgs.join(' ') || '(empty)'}`,
    ...v,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(v.tier_h_admissible
    ? 'T1: ADMISSIBLE (manifest) — this renderer/device-class pair may carry a Tier-H score. ' +
      'perf-run does NOT thereby produce one: the measurement is still absent from this build, ' +
      'and no environment was consulted.\n'
    : `T1: REFUSED — ${v.refused_because.join(' | ')}\n`);
  // Non-zero either way: admissible is a statement about a manifest, never a measurement.
  process.exit(EXIT.MEASUREMENT_FAIL);
}

// ---------------------------------------------------------------------------------------------
// The live run. The absence report, with T1 enforced against BOTH the page and the environment.
// ---------------------------------------------------------------------------------------------
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
      launch_arg_audit: launchArgAudit(handle.chromiumArgs),
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
    const page = await readRenderer(handle);
    const pageStr = page.unmaskedRenderer || page.renderer || '';
    const judged = attest || pageStr;
    // BOTH halves, always: what the page says, and what this runner actually asked Chromium for.
    const env = { launch: launchArgAudit(handle.chromiumArgs), pageRenderer: pageStr };
    const v = t1Verdict(judged, deviceClass, env);
    return {
      rule: 'RI-PLT01 T1',
      source: attest ? '--attest-renderer, CROSS-CHECKED against this page and this runner\'s launch flags'
                     : 'WEBGL_debug_renderer_info on this page, CROSS-CHECKED against this runner\'s launch flags',
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
