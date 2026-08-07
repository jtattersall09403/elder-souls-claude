// absence.mjs — the third thing TOOL-LOOP rule 1 names, and the one this project keeps skipping.
//
// > "If the tool cannot be written honestly — because the system it measures does not exist —
// >  then write it so it reports the absence and exits non-zero with a reason. Never stub it to
// >  pass."
//
// Writing nothing and stubbing to pass are OPPOSITE errors; the rule names a third thing, and
// this module is it. TOOL-COVERAGE-R1's Ruling 2 made it binding for twelve tools (4 audio,
// 8 platform) and gave the sharp reason on the platform side: `RI-PLT01` rule T1 names
// `tools/platform/perf-run.mjs` as the enforcer of its own rule —
//
// > "The tooling enforces this (tools/platform/perf-run.mjs refuses to emit Tier-H fields when
// >  the renderer is software) SO THAT A WELL-MEANING CRITIC CANNOT REPORT A SwiftShader FRAME
// >  TIME AS EVIDENCE."
//
// — so the item's defence against its own worst failure mode was a tool that did not exist, and
// nothing stopped that critic. An absent enforcer is a live risk, not a neutral deferral.
//
// WHAT MAKES THIS A MEASUREMENT AND NOT A NOTE. An absence-reporter that hard-codes "audio is
// absent" is a reading of the design document (RI-MTH07, TOOL-LOOP question 3) and would go on
// saying so for a year after audio shipped. So every reporter built on this module BOOTS THE
// GAME and confirms the absence from the running build:
//
//   - the system is named in `getCapabilityReport().not_implemented`, and
//   - the harness methods the real instrument would need are genuinely missing or return a
//     `_unmeasurable` marker.
//
// Three outcomes, all non-zero, and the third is the one that matters:
//
//   EXIT 20  ABSENT      — confirmed against the running build. The dimension is `corpus_debt`
//                          against the named owner, never a zero against a builder.
//   EXIT 20  UNCONFIRMED — the build does not declare the absence and the methods are missing
//                          anyway, or vice versa. Something has moved and nobody updated the
//                          declaration; a reader must not treat that as either state.
//   EXIT 21  ARRIVED     — the system EXISTS now. This file is no longer an honest instrument
//                          for it and must be replaced by a real one. A reporter that quietly
//                          returned 0 the day its subject shipped would be the stub-to-pass
//                          failure with a delay fuse on it.
//
// There is deliberately no exit 0. Nothing here measures anything, so nothing here may succeed.
'use strict';

import path from 'node:path';
import { REPO_ROOT, REPORTS_DIR, ensureDir, writeJson, log, EXIT } from './cli.mjs';
import { launchGame } from './browser.mjs';

/** ARRIVED gets its own code so a CI job can tell "still missing" from "go rewrite this". */
export const EXIT_SYSTEM_ARRIVED = 21;

/**
 * @param {object} spec
 * @param {string} spec.tool        this file's repo-relative path
 * @param {string[]} spec.items     the reference items that name it
 * @param {string} spec.system      substring matched against getCapabilityReport().not_implemented[].what
 * @param {string} spec.owner       who owns the absent system
 * @param {string} spec.measures    one line: what the real instrument would measure
 * @param {string[]} spec.needs     harness method names the real instrument would require
 * @param {(ctx) => Promise<object>} [spec.probe]  extra live evidence, e.g. audioMB, renderer
 * @param {(ctx) => Promise<object>} [spec.enforce] a rule this tool enforces even while the
 *                                                 system is absent (perf-run's T1 refusal)
 */
export async function reportAbsence(spec, args = {}) {
  const outPath = args.out
    ? path.resolve(String(args.out))
    : path.join(REPORTS_DIR, 'absence', path.basename(spec.tool).replace(/\.mjs$/, '') + '.json');

  let handle = null;
  const record = {
    schema: 'elder-souls/absence-report@1',
    tool: spec.tool,
    items: spec.items,
    system: spec.system,
    owner: spec.owner,
    what_the_real_instrument_would_measure: spec.measures,
    harness_methods_required: spec.needs || [],
    generated_at: new Date().toISOString(),
    rule: 'orchestration/TOOL-LOOP.md rule 1; corpus/80-methods/TOOL-COVERAGE-R1.md Ruling 2',
  };

  try {
    handle = await launchGame({ width: 320, height: 240, timeout: Number(args.timeout || 90000) });
    // AGENT-PROTOCOL: never step with the renderer live.
    await handle.page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* not fatal */ } });

    const cap = await handle.hOpt('getCapabilityReport');
    // The match is a PREFIX, not a substring, and the difference is not pedantry. The build's
    // heap/GC entry reads "heap/GC access (A-JRN9), dialogue state (A-JRN13), resource registry
    // (A-JRN14). A-JRN2 (gamepad) and A-JRN4 ... landed with W1-08/W1-29" — a substring match on
    // "gamepad" hits it and this module would report gamepad ABSENT while quoting a sentence
    // that says it LANDED. That was found by pointing this library at an implemented system and
    // watching it lie, which is the only way that class of bug is ever found. A not_implemented
    // entry counts only when it is ABOUT the system, i.e. its `what` begins with the name.
    const declared = ((cap && cap.not_implemented) || [])
      .filter((n) => n && String(n.what).toLowerCase().startsWith(String(spec.system).toLowerCase()));

    const methods = {};
    for (const m of spec.needs || []) {
      methods[m] = await handle.page.evaluate(
        (name) => !!(window.__HARNESS && typeof window.__HARNESS[name] === 'function'), m);
    }
    const presentMethods = Object.entries(methods).filter(([, v]) => v).map(([k]) => k);
    const absentMethods = Object.entries(methods).filter(([, v]) => !v).map(([k]) => k);

    // A method that EXISTS but answers `_unmeasurable` is still an absence, and the build says so
    // on purpose: `getPerfStats()._unmeasurable` and `getLoadState()._unmeasurable` are the
    // shipped examples, and RI-PLT01 T1's whole point is that the number behind them may not be
    // reported. Treating "the method exists" as "the capability exists" would make this reporter
    // say ARRIVED about a build that is loudly telling it the opposite.
    // ONLY the explicit marker counts. A THROW is not evidence of absence: calling every named
    // method with no arguments makes `setPadProfile()` throw "unknown pad profile 'undefined'"
    // and `gamepad()` throw "the real input path is detached in mode 'harness'", neither of
    // which says anything about whether the capability exists. Throws are recorded so a reader
    // can see what was tried, and are excluded from the verdict. (Also found by the
    // implemented-system falsification.)
    const declaredUnmeasurable = [];
    const probeThrew = [];
    for (const m of presentMethods) {
      const r = await handle.page.evaluate(async (name) => {
        try {
          const v = await window.__HARNESS[name]();
          if (v && typeof v === 'object' && (v._unmeasurable || v._declared_incomplete)) {
            return { marker: v._unmeasurable ? '._unmeasurable' : '._declared_incomplete' };
          }
          return null;
        } catch (e) { return { threw: String(e && e.message || e) }; }
      }, m);
      if (r && r.marker) declaredUnmeasurable.push(`${m}()${r.marker}`);
      else if (r && r.threw) probeThrew.push(`${m}() threw on a zero-argument call: ${r.threw}`);
    }

    record.build = {
      capability_report_available: cap !== undefined,
      declared_not_implemented: declared,
      harness_methods_present: presentMethods,
      harness_methods_absent: absentMethods,
      present_but_declared_unmeasurable: declaredUnmeasurable,
      // Recorded, NOT counted as absence — see the comment above.
      zero_arg_probe_threw: probeThrew,
    };

    if (spec.probe) record.live_evidence = await spec.probe({ handle, cap });
    if (spec.enforce) record.enforcement = await spec.enforce({ handle, cap });

    const extraMarkers = (record.live_evidence && record.live_evidence._unmeasurable_markers) || [];
    const buildSaysAbsent = declared.length > 0;
    const surfaceSaysAbsent = absentMethods.length > 0
      || declaredUnmeasurable.length > 0
      || extraMarkers.length > 0;

    let state, exit, why;
    if (buildSaysAbsent && surfaceSaysAbsent) {
      state = 'ABSENT'; exit = EXIT.MEASUREMENT_FAIL;
      why = `${spec.system} is not implemented in this build. Owner: ${spec.owner}. ` +
            `The build declares it (${declared.map((d) => d.surfaced_as || d.what).join(' | ')})` +
            (absentMethods.length ? ` and the harness methods the real instrument needs are absent: ${absentMethods.join(', ')}` : '') +
            (declaredUnmeasurable.length ? ` and the methods that DO exist declare themselves unusable: ${declaredUnmeasurable.join('; ')}` : '') +
            `. NO NUMBER IS EMITTED. Every dimension blocked only by this is corpus_debt against ` +
            `${spec.owner}, never a zero against a build (TOOL-LOOP rule 1).`;
    } else if (!buildSaysAbsent && !surfaceSaysAbsent) {
      state = 'ARRIVED'; exit = EXIT_SYSTEM_ARRIVED;
      why = `${spec.system} APPEARS TO EXIST NOW: the build no longer declares it under ` +
            `not_implemented and every harness method the real instrument needs is present ` +
            `(${presentMethods.join(', ') || 'n/a'}). This file is an absence-reporter and is no ` +
            `longer an honest instrument for it. REPLACE IT with a real one that measures ` +
            `${spec.measures}. Exiting ${EXIT_SYSTEM_ARRIVED}, not 0: a reporter that returned 0 ` +
            `the day its subject shipped would be a stub that passes, with a delay fuse on it.`;
    } else {
      state = 'UNCONFIRMED'; exit = EXIT.MEASUREMENT_FAIL;
      why = `the build and its own surface disagree about ${spec.system}. ` +
            `declared_not_implemented=${buildSaysAbsent}; ` +
            `harness methods absent=[${absentMethods.join(', ') || 'none'}], ` +
            `present=[${presentMethods.join(', ') || 'none'}], ` +
            `present-but-unmeasurable=[${declaredUnmeasurable.join('; ') || 'none'}]. ` +
            `Something has moved and the declaration was not updated. This is reported as ` +
            `neither absent nor present, because a reader must not be allowed to assume either.`;
    }
    record.state = state;
    record.why = why;
    record.exit = exit;
    return finish(record, outPath, handle, exit);
  } catch (e) {
    record.state = 'UNCONFIRMED';
    record.why = `the absence could not be confirmed against a running build: ${e && e.message || e}. ` +
                 'An absence asserted from a file rather than observed in the world is the design ' +
                 'document again (RI-MTH07), so this exits non-zero rather than reporting ABSENT.';
    record.exit = EXIT.MEASUREMENT_FAIL;
    return finish(record, outPath, handle, EXIT.MEASUREMENT_FAIL);
  }
}

function finish(record, outPath, handle, exit) {
  ensureDir(path.dirname(outPath));
  writeJson(outPath, record);
  process.stdout.write(`${record.state} ${record.tool}\n`);
  process.stdout.write(`  items   : ${record.items.join(', ')}\n`);
  process.stdout.write(`  system  : ${record.system}\n`);
  process.stdout.write(`  owner   : ${record.owner}\n`);
  process.stdout.write(`  would measure: ${record.what_the_real_instrument_would_measure}\n`);
  if (record.enforcement) {
    process.stdout.write(`  ENFORCED: ${JSON.stringify(record.enforcement)}\n`);
  }
  process.stdout.write(`  ${record.why}\n`);
  log(`wrote ${path.relative(REPO_ROOT, outPath)}`);
  const close = handle ? handle.close() : Promise.resolve();
  return close.catch(() => {}).then(() => exit);
}

/** The renderer manifest RI-PLT01 T1 gates on. Read from the page, not assumed. */
export async function readRenderer(handle) {
  return handle.page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { available: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      available: true,
      unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      unmaskedVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    };
  });
}

/** RI-PLT01 rule T1, as a predicate. The four banned substrings are the item's own. */
export const T1_SOFTWARE_MARKERS = ['swiftshader', 'llvmpipe', 'software', 'mesa'];
export function t1Verdict(rendererString, deviceClass) {
  const s = String(rendererString || '');
  const hit = T1_SOFTWARE_MARKERS.filter((m) => s.toLowerCase().includes(m));
  const CLASSES = ['phone-mid', 'phone-high', 'laptop-integrated', 'desktop-discrete'];
  const classOk = CLASSES.includes(String(deviceClass || ''));
  return {
    renderer: s || null,
    device_class: deviceClass || null,
    software_markers_hit: hit,
    device_class_valid: classOk,
    tier_h_admissible: hit.length === 0 && classOk && s.length > 0,
    rule: 'RI-PLT01 T1: "A manifest whose renderer string contains SwiftShader, llvmpipe, ' +
          'software or Mesa may not produce a Tier-H score at all — not a low one, not a ' +
          'provisional one." deviceClass must be one of ' + CLASSES.join(', ') + '.',
  };
}
