// absence.mjs — the third thing TOOL-LOOP rule 1 names, and the one this project keeps skipping.
//
// > "If the tool cannot be written honestly — because the system it measures does not exist —
// >  then write it so it reports the absence and exits non-zero with a reason. Never stub it to
// >  pass."
//
// Writing nothing and stubbing to pass are OPPOSITE errors; the rule names a third thing, and
// this module is it. TOOL-COVERAGE-R1's Ruling 2 made it binding for twelve tools.
//
// WHAT MAKES THIS A MEASUREMENT AND NOT A NOTE. An absence-reporter that hard-codes "audio is
// absent" is a reading of the design document (RI-MTH07, TOOL-LOOP question 3) and would go on
// saying so for a year after audio shipped. So every reporter built on this module BOOTS THE
// GAME and confirms the absence from the running build.
//
// ---------------------------------------------------------------------------------------------
// ROUND 3 — four bugs, and the two the round-2 critic found are the ones that mattered.
//
// BUG 3 — `needs` was a list of GUESSES the library never validated. For 8 of the 12 reporters
//   EVERY name in `needs` was absent from the 322-method surface: `getHeapSnapshot`, `gc`,
//   `getHeapStats`, `getStreamingState`, `getResidentAssets`, `getResourceRegistry`,
//   `getAssetManifest`, `getAudioStats`, `getAudioLog`, `audioState`, `musicState`,
//   `getMusicLog`, `recordAudio` — not one of them was ever a method this build would have. So
//   `surfaceSaysAbsent` was a CONSTANT `true` and the exit-21 ARRIVED fuse — the only reason
//   these files are instruments rather than notes — was UNREACHABLE BY CONSTRUCTION. The critic
//   demonstrated it: a running quest runtime plus one invented name still reported ABSENT.
//
//   FIX. Every `needs` entry is validated at load against TWO sources and the run REFUSES
//   (exit 22, `NEEDS_UNVALIDATED`) when a name matches neither:
//     - the LIVE harness surface, or
//     - a named amendment: `{ method, amendment: 'A-JRN9' }`, where the amendment must appear in
//       the running build's `getCapabilityReport().harness_amendments_absent` AND the amendment
//       register (`corpus/88-journeys/JOURNEY-CRITIC-FLEET.md`) must name that method on that
//       amendment's row. An unvalidated `needs` entry is `cmb-reach --verify` with a longer fuse.
//
// BUG 4 — the substring->prefix fix OVER-CORRECTED. The build packs three absent systems into
//   one `not_implemented` entry:
//     "heap/GC access (A-JRN9), dialogue state (A-JRN13), resource registry (A-JRN14). A-JRN2
//      (gamepad) and A-JRN4 ... landed with W1-08/W1-29 ..."
//   A prefix match reports `dialogue state` and `resource registry` — both genuinely absent,
//   both named right there — as ARRIVED, i.e. "go delete this file". Bug 1 said ABSENT while
//   quoting "it landed"; bug 4 said ARRIVED while quoting "it is not implemented".
//
//   FIX. `what` is parsed as a LIST OF SYSTEMS: split into sentences, drop the sentences that
//   declare something LANDED, split the rest on the build's own separators, strip the amendment
//   parentheticals. Every reporter additionally declares its `amendment` where it has one, and
//   `harness_amendments_absent` is a structural cross-check that no string parse can fake.
//
// BUG 5 (this round, fail-closed) — ARRIVED now requires POSITIVE EVIDENCE. It used to mean
//   "the build stopped declaring it and the methods are there", which is the absence of a
//   declaration, not the presence of a system. A reporter must supply `arrived({handle})`
//   returning `{ ok, evidence }`; with no such probe the best state available is UNCONFIRMED.
//
// EXIT CODES — there is deliberately no exit 0. Nothing here measures anything.
//   20 ABSENT / UNCONFIRMED    21 ARRIVED (replace this file)    22 NEEDS_UNVALIDATED
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, REPORTS_DIR, ensureDir, writeJson, log, EXIT } from './cli.mjs';
import { launchGame, DETERMINISTIC_CHROMIUM_ARGS } from './browser.mjs';

/** ARRIVED gets its own code so a CI job can tell "still missing" from "go rewrite this". */
export const EXIT_SYSTEM_ARRIVED = 21;
/** A `needs` entry that names nothing. The run is refused; no absence verdict is produced. */
export const EXIT_NEEDS_UNVALIDATED = 22;

/** The amendment register: the corpus's own table of harness amendments and their methods. */
export const AMENDMENT_REGISTER = 'corpus/88-journeys/JOURNEY-CRITIC-FLEET.md';

/**
 * Parse `getCapabilityReport().not_implemented[].what` as the LIST OF SYSTEMS it is.
 * Exported so a critic can run it against any string without booting anything.
 */
export function parseDeclaredSystems(what) {
  const raw = String(what || '');
  // 1. Sentences. The build's own separator between "these are absent" and "these landed".
  const sentences = raw.split(/(?<=[.;])\s+/);
  const LANDED = /\b(landed|implemented|shipped|already|driven runner-side|is driven)\b/i;
  const out = [];
  const dropped = [];
  for (const s of sentences) {
    if (LANDED.test(s)) { dropped.push(s.trim()); continue; }
    // 2. Strip the parentheticals FIRST — "(fps, frame time, TTFP wall clock, hitch durations)"
    //    carries commas of its own, and splitting before stripping turns one system into four
    //    fragments ("Tier-H performance numbers (fps", "frame time", …). The amendment ids
    //    inside those parentheses are recovered separately by `amendmentsNamedIn`.
    const flat = s.replace(/\([^)]*\)/g, ' ');
    // 3. The build's own list separators between systems.
    for (let seg of flat.split(/,| and (?=[a-z])/)) {
      seg = seg.replace(/[.;]\s*$/, '').replace(/\s+/g, ' ').trim();
      if (seg) out.push(seg);
    }
  }
  return { systems: out, sentences_dropped_as_landed: dropped };
}

/** Amendment ids named inside a `what` string, e.g. "heap/GC access (A-JRN9)" -> ['A-JRN9']. */
export function amendmentsNamedIn(what) {
  return [...new Set(String(what || '').match(/A-JRN\d+/g) || [])];
}

/** Does the amendment register name `method` on `amendment`'s row? */
function registerNames(amendment, method) {
  const p = path.join(REPO_ROOT, AMENDMENT_REGISTER);
  if (!fs.existsSync(p)) return { ok: false, why: `${AMENDMENT_REGISTER} does not exist on this tree` };
  const text = fs.readFileSync(p, 'utf8');
  const row = text.split('\n').find((l) => l.includes(`**${amendment}**`) || l.includes(`| ${amendment} `));
  if (!row) return { ok: false, why: `${AMENDMENT_REGISTER} has no row for ${amendment}` };
  if (!row.includes(method)) {
    return { ok: false, why: `${AMENDMENT_REGISTER}'s ${amendment} row does not name "${method}". It reads: ${row.trim().slice(0, 200)}` };
  }
  return { ok: true, row: row.trim().slice(0, 240) };
}

/** Normalise a `needs` entry to { method, amendment|null }. */
function normNeed(n) {
  if (typeof n === 'string') return { method: n, amendment: null };
  return { method: String(n.method), amendment: n.amendment ? String(n.amendment) : null };
}

/**
 * @param {object} spec
 * @param {string} spec.tool        this file's repo-relative path
 * @param {string[]} spec.items     the reference items that name it
 * @param {string} spec.system      matched against the PARSED system list of not_implemented[].what
 * @param {string} [spec.amendment] the harness amendment this system is blocked on, if any.
 *                                  Cross-checked against harness_amendments_absent — a structural
 *                                  signal no string parse can fake.
 * @param {string} spec.owner       who owns the absent system
 * @param {string} spec.measures    one line: what the real instrument would measure
 * @param {(string|{method:string,amendment?:string})[]} spec.needs
 *                                  harness methods the real instrument requires. A bare string
 *                                  MUST be live on this build's surface; anything absent must
 *                                  carry the amendment that owns it.
 * @param {(ctx) => Promise<object>} [spec.probe]    extra live evidence
 * @param {(ctx) => Promise<object>} [spec.enforce]  a rule this tool enforces while absent
 * @param {(ctx) => Promise<{ok:boolean,evidence:any}>} [spec.arrived]
 *                                  POSITIVE evidence that the system works. Required for ARRIVED.
 */
export async function reportAbsence(spec, args = {}) {
  const outPath = args.out
    ? path.resolve(String(args.out))
    : path.join(REPORTS_DIR, 'absence', path.basename(spec.tool).replace(/\.mjs$/, '') + '.json');

  let handle = null;
  const needs = (spec.needs || []).map(normNeed);
  const record = {
    schema: 'elder-souls/absence-report@3',
    tool: spec.tool,
    items: spec.items,
    system: spec.system,
    amendment: spec.amendment || null,
    owner: spec.owner,
    what_the_real_instrument_would_measure: spec.measures,
    harness_methods_required: needs,
    generated_at: new Date().toISOString(),
    rule: 'orchestration/TOOL-LOOP.md rule 1; TOOL-COVERAGE-R1 Ruling 2; TOOL-COVERAGE-R2 §2',
  };

  try {
    handle = await launchGame({ width: 320, height: 240, timeout: Number(args.timeout || 90000) });
    // AGENT-PROTOCOL: never step with the renderer live.
    await handle.page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* not fatal */ } });

    const cap = await handle.hOpt('getCapabilityReport');
    const surface = await handle.page.evaluate(
      () => Object.keys(window.__HARNESS || {}).filter((k) => typeof window.__HARNESS[k] === 'function').sort());
    const amendmentsAbsent = (cap && cap.harness_amendments_absent) || [];
    const amendmentsPresent = (cap && cap.harness_amendments_implemented) || [];

    // ---- BUG 3: validate `needs` before anything else. ------------------------------------
    const validation = [];
    for (const n of needs) {
      if (surface.includes(n.method)) {
        validation.push({ ...n, state: 'live', why: 'present on this build\'s harness surface' });
        continue;
      }
      if (!n.amendment) {
        validation.push({
          ...n, state: 'UNVALIDATED',
          why: `"${n.method}" is not on the live surface (${surface.length} methods) and no ` +
               `amendment is declared for it. A needs entry that names nothing makes the ` +
               `absence signal a constant and the ARRIVED fuse unreachable — TOOL-COVERAGE-R2 §2 ` +
               `bug 3. Declare it as { method: "${n.method}", amendment: "A-JRNn" } and make sure ` +
               `${AMENDMENT_REGISTER} names it, or delete it.`,
        });
        continue;
      }
      const reg = registerNames(n.amendment, n.method);
      const declaredAbsent = amendmentsAbsent.includes(n.amendment);
      if (reg.ok && declaredAbsent) {
        validation.push({ ...n, state: 'declared-absent', why: `${n.amendment} is in this build's harness_amendments_absent and ${AMENDMENT_REGISTER} names ${n.method} on its row`, register_row: reg.row });
      } else if (reg.ok && !declaredAbsent) {
        validation.push({
          ...n, state: 'UNVALIDATED',
          why: `${AMENDMENT_REGISTER} names ${n.method} under ${n.amendment}, but the RUNNING ` +
               `build does not list ${n.amendment} in harness_amendments_absent ` +
               `(absent: [${amendmentsAbsent.join(', ')}]; implemented: [${amendmentsPresent.join(', ')}]). ` +
               `The method is missing from the surface anyway, so the build and its own ` +
               `declaration disagree and this reporter may not speak for either.`,
        });
      } else {
        validation.push({ ...n, state: 'UNVALIDATED', why: reg.why });
      }
    }
    record.needs_validation = validation;
    const unvalidated = validation.filter((v) => v.state === 'UNVALIDATED');
    if (unvalidated.length) {
      record.state = 'NEEDS_UNVALIDATED';
      record.exit = EXIT_NEEDS_UNVALIDATED;
      record.why =
        `this reporter's \`needs\` list names ${unvalidated.length} method(s) that are neither on ` +
        `the live harness surface nor traceable to a declared amendment: ` +
        `${unvalidated.map((u) => u.method).join(', ')}. NO ABSENCE VERDICT IS PRODUCED. ` +
        `An unvalidated needs entry makes "the surface says absent" a constant true, which is ` +
        `exactly how a running system plus one invented name reported ABSENT ` +
        `(TOOL-COVERAGE-R2 §2 bug 3). ` + unvalidated.map((u) => u.why).join(' | ');
      return finish(record, outPath, handle, EXIT_NEEDS_UNVALIDATED);
    }

    // ---- BUG 4: the declaration, parsed as a list of systems. ------------------------------
    const notImplemented = (cap && cap.not_implemented) || [];
    const parsedEntries = notImplemented.map((n) => ({
      what: n.what, owner: n.owner, surfaced_as: n.surfaced_as,
      ...parseDeclaredSystems(n.what),
      amendments_named: amendmentsNamedIn(n.what),
    }));
    const wanted = String(spec.system).toLowerCase().trim();
    const declared = parsedEntries.filter((e) => e.systems.some((s) => {
      const t = s.toLowerCase().trim();
      return t === wanted || t.startsWith(wanted + ' ') || t.startsWith(wanted + ':');
    }));
    record.declaration_parse = parsedEntries;

    const amendmentSaysAbsent = spec.amendment ? amendmentsAbsent.includes(spec.amendment) : null;
    const buildSaysAbsent = declared.length > 0 || amendmentSaysAbsent === true;

    // ---- The surface. Only the two live signals count. ------------------------------------
    const presentMethods = validation.filter((v) => v.state === 'live').map((v) => v.method);
    const absentMethods = validation.filter((v) => v.state === 'declared-absent').map((v) => v.method);

    // A method that EXISTS but answers `_unmeasurable` is still an absence, and the build says so
    // on purpose. ONLY the explicit marker counts. A THROW is not evidence of absence: calling a
    // method with no arguments makes `setPadProfile()` throw "unknown pad profile 'undefined'",
    // which says nothing about whether the capability exists. Throws are recorded, not counted.
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
      harness_surface_size: surface.length,
      declared_not_implemented: declared,
      amendment_declared_absent: amendmentSaysAbsent,
      harness_amendments_absent: amendmentsAbsent,
      harness_methods_present: presentMethods,
      harness_methods_absent: absentMethods,
      present_but_declared_unmeasurable: declaredUnmeasurable,
      zero_arg_probe_threw: probeThrew,     // recorded, NOT counted as absence
    };

    if (spec.probe) record.live_evidence = await spec.probe({ handle, cap });
    if (spec.enforce) record.enforcement = await spec.enforce({ handle, cap });

    const extraMarkers = (record.live_evidence && record.live_evidence._unmeasurable_markers) || [];
    const surfaceSaysAbsent = absentMethods.length > 0
      || declaredUnmeasurable.length > 0
      || extraMarkers.length > 0;

    // ---- BUG 5: ARRIVED demands positive evidence. ------------------------------------------
    let arrived = null;
    if (!buildSaysAbsent && !surfaceSaysAbsent && spec.arrived) {
      arrived = await spec.arrived({ handle, cap });
      record.arrival_evidence = arrived;
    }

    let state, exit, why;
    if (buildSaysAbsent && surfaceSaysAbsent) {
      state = 'ABSENT'; exit = EXIT.MEASUREMENT_FAIL;
      why = `${spec.system} is not implemented in this build. Owner: ${spec.owner}. ` +
            `The build declares it (${declared.map((d) => d.surfaced_as || d.what).join(' | ') || (spec.amendment + ' is in harness_amendments_absent')})` +
            (absentMethods.length ? ` and the harness methods the real instrument needs are absent: ${absentMethods.join(', ')}` : '') +
            (declaredUnmeasurable.length ? ` and the methods that DO exist declare themselves unusable: ${declaredUnmeasurable.join('; ')}` : '') +
            `. NO NUMBER IS EMITTED. Every dimension blocked only by this is corpus_debt against ` +
            `${spec.owner}, never a zero against a build (TOOL-LOOP rule 1).`;
    } else if (!buildSaysAbsent && !surfaceSaysAbsent && arrived && arrived.ok) {
      state = 'ARRIVED'; exit = EXIT_SYSTEM_ARRIVED;
      why = `${spec.system} EXISTS NOW and was exercised, not merely declared: ` +
            `${JSON.stringify(arrived.evidence)}. The build no longer declares it under ` +
            `not_implemented and every harness method the real instrument needs is present ` +
            `(${presentMethods.join(', ') || 'n/a'}). This file is an absence-reporter and is no ` +
            `longer an honest instrument for it. REPLACE IT with a real one that measures ` +
            `${spec.measures}. Exiting ${EXIT_SYSTEM_ARRIVED}, not 0: a reporter that returned 0 ` +
            `the day its subject shipped would be a stub that passes, with a delay fuse on it.`;
    } else if (!buildSaysAbsent && !surfaceSaysAbsent) {
      // Fail closed. The absence of a declaration is not the presence of a system.
      state = 'UNCONFIRMED'; exit = EXIT.MEASUREMENT_FAIL;
      why = `${spec.system} is no longer declared absent and every needed method is present, but ` +
            (spec.arrived
              ? `the positive-evidence probe did NOT succeed (${arrived ? JSON.stringify(arrived) : 'it returned nothing'}). `
              : `this reporter declares no positive-evidence probe, so nothing here has SEEN the ` +
                `system work. `) +
            `ARRIVED requires evidence that the system does its job, not merely that nobody said ` +
            `it does not (TOOL-COVERAGE-R2 §2: "fail closed on ambiguity"). Reported as neither ` +
            `absent nor present.`;
    } else {
      state = 'UNCONFIRMED'; exit = EXIT.MEASUREMENT_FAIL;
      why = `the build and its own surface disagree about ${spec.system}. ` +
            `declared_not_implemented=${declared.length > 0}; ` +
            (spec.amendment ? `${spec.amendment} in harness_amendments_absent=${amendmentSaysAbsent}; ` : '') +
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
  process.stdout.write(`  system  : ${record.system}${record.amendment ? ` [${record.amendment}]` : ''}\n`);
  process.stdout.write(`  owner   : ${record.owner}\n`);
  process.stdout.write(`  would measure: ${record.what_the_real_instrument_would_measure}\n`);
  if (record.needs_validation) {
    process.stdout.write(`  needs   : ${record.needs_validation.map((v) => `${v.method}[${v.state}]`).join(', ') || '(none)'}\n`);
  }
  if (record.enforcement) {
    process.stdout.write(`  ENFORCED: ${JSON.stringify(record.enforcement)}\n`);
  }
  process.stdout.write(`  ${record.why}\n`);
  log(`wrote ${path.relative(REPO_ROOT, outPath)}`);
  const close = handle ? handle.close() : Promise.resolve();
  return close.catch(() => {}).then(() => exit);
}

// ---------------------------------------------------------------------------------------------
// RI-PLT01 rule T1. Rebuilt this round — see tools/platform/perf-run.mjs for the whole argument.
// ---------------------------------------------------------------------------------------------

/** The renderer manifest T1 gates on. Read from the page, not assumed. */
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

/**
 * The Chromium launch arguments THIS RUNNER passed, read Node-side.
 *
 * TOOL-COVERAGE-R2 §3: the page is the side under test. Twenty lines patching
 * `WebGLRenderingContext.prototype.getParameter` turned SwiftShader into an RTX 4070 and nothing
 * noticed, because `--use-angle=swiftshader` sits in `DETERMINISTIC_CHROMIUM_ARGS` on the Node
 * side and the gate never consulted it. A flag the harness itself passed cannot be forged from
 * inside the page.
 */
export const SOFTWARE_BACKEND_FLAGS = [
  /--use-angle=swiftshader/i,
  /--use-gl=swiftshader/i,
  /--use-gl=angle.*swiftshader/i,
  /--enable-unsafe-swiftshader/i,
  /--use-gl=(swiftshader|osmesa)/i,
  /--disable-gpu\b/i,
  /--override-use-software-gl-for-tests/i,
  /--use-angle=(swiftshader|null)/i,
];

/** @returns {{args:string[], software_flags:string[], requested_software:boolean}} */
export function launchArgAudit(chromiumArgs) {
  const list = Array.isArray(chromiumArgs) ? chromiumArgs.map(String) : DETERMINISTIC_CHROMIUM_ARGS.map(String);
  const hit = list.filter((a) => SOFTWARE_BACKEND_FLAGS.some((rx) => rx.test(a)));
  return { args: list, software_flags: hit, requested_software: hit.length > 0 };
}

/** RI-PLT01 rule T1's four banned substrings. The item's own list. */
export const T1_SOFTWARE_MARKERS = ['swiftshader', 'llvmpipe', 'software', 'mesa'];

/**
 * Renderer strings that are software or unidentifiable but miss all four markers. T1's direction
 * is "may not produce a Tier-H score AT ALL", so the safe default on an unidentifiable renderer
 * is refusal: this is a fail-closed allowlist, not a denylist.
 *
 * Every entry was ADMISSIBLE under round 2 (TOOL-COVERAGE-R2 §3's table).
 */
export const T1_KNOWN_SOFTWARE_UNLISTED = [
  { rx: /microsoft basic render driver/i, what: 'WARP — Windows\' pure software rasteriser' },
  { rx: /\bwarp\b/i, what: 'WARP — Windows\' pure software rasteriser' },
  { rx: /subzero/i, what: 'SwiftShader\'s own Subzero backend, named without the word' },
  { rx: /\bswrast\b/i, what: 'Mesa\'s software rasteriser' },
  { rx: /virgl|virtio/i, what: 'a paravirtualised GPU; not attested hardware' },
  { rx: /\bnull\b.*renderer|renderer.*\bnull\b/i, what: 'the null backend' },
];
export const T1_MASKED_STRINGS = [
  { rx: /^webkit webgl$/i, what: 'the masked string a browser returns when it REFUSES to identify the GPU' },
  { rx: /^mozilla$/i, what: 'a masked vendor string' },
  { rx: /^google inc\.?(\s*\(google\))?$/i, what: 'the masked vendor string; identifies nothing' },
  { rx: /^webgl$/i, what: 'a masked string' },
  { rx: /^generic renderer$/i, what: 'a masked string' },
];
/** The vendor families a Tier-H attestation may name. Fail-closed: anything else is unidentified. */
export const T1_ATTESTABLE_VENDORS = [
  /\bnvidia\b/i, /\bgeforce\b/i, /\bquadro\b/i, /\brtx\b/i,
  /\bamd\b/i, /\bradeon\b/i, /\bnavi\b/i,
  /\bintel\b/i, /\barc\b/i, /\biris\b/i,
  /\bapple\b/i, /\bm[123]\b/i,
  /\badreno\b/i, /\bmali\b/i, /\bpowervr\b/i, /\bxclipse\b/i, /\bimmortalis\b/i,
];

export const T1_DEVICE_CLASSES = ['phone-mid', 'phone-high', 'laptop-integrated', 'desktop-discrete'];

/**
 * RI-PLT01 rule T1, as a predicate.
 *
 * @param {string} rendererString  the renderer to judge
 * @param {string} deviceClass     one of T1_DEVICE_CLASSES
 * @param {object} [env]           { launch: launchArgAudit(...), pageRenderer: string|null }
 *                                 The environment the runner controls. When it requested a
 *                                 software backend, or when an attestation contradicts what the
 *                                 page actually reports, T1 refuses whatever the string says.
 */
export function t1Verdict(rendererString, deviceClass, env = {}) {
  const s = String(rendererString || '');
  const hit = T1_SOFTWARE_MARKERS.filter((m) => s.toLowerCase().includes(m));
  const classOk = T1_DEVICE_CLASSES.includes(String(deviceClass || ''));

  const unlisted = T1_KNOWN_SOFTWARE_UNLISTED.filter((e) => e.rx.test(s));
  const masked = T1_MASKED_STRINGS.filter((e) => e.rx.test(s.trim()));
  const vendorNamed = T1_ATTESTABLE_VENDORS.some((rx) => rx.test(s));
  const identified = s.length > 0 && vendorNamed && masked.length === 0 && unlisted.length === 0;

  const launch = env.launch || null;
  const envSoftware = !!(launch && launch.requested_software);
  const pageRenderer = env.pageRenderer == null ? null : String(env.pageRenderer);
  const pageIsSoftware = pageRenderer == null ? null
    : T1_SOFTWARE_MARKERS.some((m) => pageRenderer.toLowerCase().includes(m))
      || T1_KNOWN_SOFTWARE_UNLISTED.some((e) => e.rx.test(pageRenderer));
  const contradiction = pageRenderer != null && pageRenderer !== s && pageIsSoftware && hit.length === 0;

  const refusals = [];
  if (hit.length) refusals.push(`renderer string contains ${hit.join(', ')}`);
  if (unlisted.length) refusals.push(`renderer is known software the four markers miss: ${unlisted.map((u) => u.what).join('; ')}`);
  if (masked.length) refusals.push(`renderer string is masked and identifies nothing: ${masked.map((m) => m.what).join('; ')}`);
  if (!identified && !hit.length && !unlisted.length && !masked.length) {
    refusals.push(s.length
      ? `renderer "${s}" names no attestable GPU vendor, so it is UNIDENTIFIED. T1 says a ` +
        `software renderer "may not produce a Tier-H score at all", and the fail-closed reading ` +
        `of an unidentifiable string is refusal, not admission.`
      : 'no renderer string at all');
  }
  if (!classOk) refusals.push(`device class ${JSON.stringify(deviceClass || null)} is not one of ${T1_DEVICE_CLASSES.join(', ')}`);
  if (envSoftware) {
    refusals.push(
      `THIS RUNNER launched Chromium with ${launch.software_flags.join(' ')} — a software ` +
      `backend it requested itself. Read Node-side, where the page cannot reach it. Whatever ` +
      `the page reports about its own renderer, the frames were drawn in software.`);
  }
  if (contradiction) {
    refusals.push(
      `attestation_contradicts_environment: the attested renderer is "${s}" but this page ` +
      `reports "${pageRenderer}", which is software. An attestation is a claim about the ` +
      `machine, and this machine disagrees with it.`);
  }

  return {
    renderer: s || null,
    device_class: deviceClass || null,
    software_markers_hit: hit,
    known_software_unlisted: unlisted.map((u) => u.what),
    masked_string: masked.map((m) => m.what),
    identified,
    device_class_valid: classOk,
    environment_requested_software: envSoftware,
    environment_software_flags: launch ? launch.software_flags : null,
    page_renderer: pageRenderer,
    page_renderer_is_software: pageIsSoftware,
    attestation_contradicts_environment: contradiction,
    refused_because: refusals,
    tier_h_admissible: refusals.length === 0,
    rule: 'RI-PLT01 T1: "A manifest whose renderer string contains SwiftShader, llvmpipe, ' +
          'software or Mesa may not produce a Tier-H score at all — not a low one, not a ' +
          'provisional one." Read fail-closed: an UNIDENTIFIABLE renderer is refused too, and a ' +
          'runner that asked Chromium for a software backend is refused whatever the page says.',
  };
}
