#!/usr/bin/env node
// visual-reading.mjs — `render.process.measurement`. HOW A VISUAL NUMBER IS TAKEN.
//
// Subsystem: `render.process.measurement` — "How a visual number is taken: capture protocol,
// poses, repeatability" (`corpus/00-doctrine/subsystems.json`). Judged by RI-VIS03
// (`visual.process.measurement` is in its `judges` list), RI-VIS01, RI-VIS06, RI-VIS09, RI-CAM07,
// RI-UIX06.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS FILE EXISTS, IN SIX LINES THAT ARE ALL ON DISK IN THIS REPOSITORY.
//
//  1. A check asserted a canvas existed, with non-zero dimensions, and no page errors.
//     ALL THREE WERE TRUE OF A BLACK SCREEN the owner was looking at.
//  2. A distinctness measure returned 8 distinct images from ONE UNCHANGED ROOM after two fixed
//     steps. It was hashing the step counter.
//  3. `interior.meshes` was quoted as a renderer read for a headline number. It is a BUILD
//     RECORD: empty the scene group and it still reports 127 meshes of a room that is not there.
//     (`corpus/90-verdicts/wave1/W1-04-r3.md` §Row-4; `reports/w1-04-r4-survey.md` (c).)
//  4. A colour check compared a 0–255 luma overshoot against a threshold of 40, while its own
//     reference item specifies ΔE. Converted properly it is a hard fail at 58.291 dE2000.
//     (`orchestration/status/W1-21-r3.json` FD6.)
//  5. A camera projection was blind because posing a camera never wrote its yaw, so every visual
//     verdict taken through a posed camera had to be re-read.
//  6. A chart font sheared every glyph, so published NUMBERS could be read as different numbers.
//
// Not one of those is a bug in a metric. Every one is a bug in the ACT OF READING — and each was
// caught by a different person, late, by accident. So: a visual number does not count until it
// has been taken through a reading that answers five questions, and this module is the shape that
// refuses to produce a number without them.
//
//   Q1  WHAT SURFACE WAS READ?          `surface`, from a closed set, and a CLAIM CLASS that it
//                                        must be admissible for. A BUILD_RECORD can never support
//                                        a claim about what is on screen. That is failure 3, made
//                                        structurally unsayable rather than remembered.
//   Q2  CAN IT TELL THE SUBJECT FROM     the CLOCK 2×2. Hold the subject and let time pass: the
//       TIME PASSING?                    number must NOT move. Change the subject at fixed time:
//                                        it MUST. That is failure 2 in both directions, and it is
//                                        RULES.md rule 8 ("one instant is a still target in
//                                        time") turned into two arms instead of a warning.
//   Q3  WHAT IS THE NULL CONTROL?        `factors`, run through `tools/experience/lib/sabotage.mjs`
//                                        — the facility that already knows the five ways a control
//                                        agrees with itself. NOT re-implemented here (rule 10).
//   Q4  IN WHAT UNITS?                   `unit` on the value and `unit` on the band, and they must
//                                        be the same string. That is failure 4, which is one
//                                        string comparison and cost a wave its colour verdict.
//   Q5  HOW IS IT SHOWN ABLE TO FAIL?    the DEGENERATE SUBJECT. The same predicate, run against a
//                                        subject that is definitionally a failure — a black frame,
//                                        an emptied scene. It MUST go red. That is failure 1, and
//                                        it is the one a passing suite never notices, because the
//                                        green arm is the only arm anybody runs.
//
// Q3 and Q5 are NOT the same control and conflating them is how failure 1 survived. Q3 breaks the
// MECHANISM and asks whether the number depends on it. Q5 breaks the SUBJECT and asks whether the
// PREDICATE can ever say no. A probe can pass Q3 perfectly and still be `canvas !== null`.
//
// ---------------------------------------------------------------------------------------------
// RULES.md rule 4 — THE FALSIFIER. `--self-test` replays all six failures above as synthetic
// readings with known verdicts, plus a clean control, and then re-runs the whole suite with each
// of this module's own checks disabled in turn, requiring the suite to go red under every one.
// The clean control is load-bearing: an instrument that voids everything is exactly as useless as
// one that voids nothing, and failure 1 was a check whose green arm had never been tried against
// a subject that should have been red.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT as SAB, canon, valuesDiffer, measuredNothing } from '../experience/lib/sabotage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------------------------------------------------------------------------------------------
// Q1. THE SURFACES, AND WHAT EACH ONE IS ALLOWED TO SUPPORT.

/** What was actually read. Closed set. */
export const SURFACE = {
  /** Pixels that came out of the renderer: a screenshot, a readPixels, a canvas hash. */
  FRAMEBUFFER: 'FRAMEBUFFER',
  /** The live scene graph, traversed at read time — what the renderer would draw next frame. */
  SCENE_GRAPH: 'SCENE_GRAPH',
  /** A record the BUILDER wrote when it built something. Survives the thing being deleted. */
  BUILD_RECORD: 'BUILD_RECORD',
  /** Authored data on disk, read without booting anything. */
  DATA_FILE: 'DATA_FILE',
  /** Text/DOM read out of the page rather than out of the renderer. */
  DOM: 'DOM',
  /** A number the simulation computed, not a picture. */
  SIM_STATE: 'SIM_STATE',
};

/** What the number is going to be used to say. Closed set. */
export const CLAIM = {
  /** "The player can see X." "The frame shows X." Anything about the picture. */
  ON_SCREEN: 'ON_SCREEN',
  /** "X is in the scene and would be drawn." Weaker than ON_SCREEN: it may be occluded or fogged. */
  IN_THE_SCENE: 'IN_THE_SCENE',
  /** "X was built / authored." Says nothing about whether anything draws it. */
  AUTHORED: 'AUTHORED',
  /** "The simulation computes X." */
  SIMULATED: 'SIMULATED',
};

/**
 * The admissibility matrix. THIS IS THE `interior.meshes` KILL, and it is a table rather than a
 * convention because a convention is what was in force when the number was published.
 *
 * Read it downward: a claim may only be supported by a surface listed against it.
 */
export const ADMISSIBLE = {
  ON_SCREEN: [SURFACE.FRAMEBUFFER],
  IN_THE_SCENE: [SURFACE.FRAMEBUFFER, SURFACE.SCENE_GRAPH],
  AUTHORED: [SURFACE.FRAMEBUFFER, SURFACE.SCENE_GRAPH, SURFACE.BUILD_RECORD, SURFACE.DATA_FILE, SURFACE.SIM_STATE],
  SIMULATED: [SURFACE.FRAMEBUFFER, SURFACE.SCENE_GRAPH, SURFACE.SIM_STATE, SURFACE.DOM],
};

export const SURFACE_NOTE = {
  BUILD_RECORD: 'a build record survives the thing it records being deleted — this is exactly what `interior.meshes` did, reporting 127 meshes of an emptied room',
  DATA_FILE: 'authored data says what was written, never what is drawn (RULES.md rule 5: sixteen subsystems shipped a correct model nothing reads)',
  SCENE_GRAPH: 'the scene graph says what would be drawn, not what a player sees — occlusion, fog, fade and the camera all sit between it and the frame',
  DOM: 'the DOM is not the renderer; a string in the DOM may be behind the canvas, clipped, or transparent',
  SIM_STATE: 'a simulation number is not a picture',
  FRAMEBUFFER: 'pixels out of the renderer — the only surface that can support a claim about what is on screen',
};

// ---------------------------------------------------------------------------------------------
// Q4. UNITS.
//
// Failure 4 in one line: `overshoot_luma_0_255 = 151` was graded against `band ΔE ≤ 40`. Both are
// "colour error", both are positive reals, and nothing in the code knew they were different
// quantities. The fix is not clever; it is that a value and a band each carry a unit string and
// the two must be equal. The list below is advisory — an unknown unit is allowed, because the
// alternative is a registry that blocks the next metric — but a CONFUSABLE pair is named in the
// failure text, because "these two units are both colour error" is precisely the reasoning that
// produced the wrong number.

export const CONFUSABLE = [
  ['dE2000', 'luma_0_255', 'CIEDE2000 colour difference vs an 8-bit luma delta. This exact substitution published a pass where the item specifies a hard fail (W1-21 FD6: 151 luma read against a ΔE band of 40; the same edges are 58.291 dE2000).'],
  ['dE2000', 'dE76', 'ΔE*ab (1976) and CIEDE2000 differ by more than 2x on saturated hues.'],
  ['px', 'frac', 'a pixel count and a fraction of the frame are not interchangeable at any resolution.'],
  ['px', 'ndc', 'NDC is resolution-independent and pixels are not; RI-CAM07 §C thresholds are NDC.'],
  ['m', 'cm', 'RI-CAM07 §D foot-IK bars are metres. 0.020 m and 0.020 cm differ by 100x.'],
  ['deg', 'rad', ''],
  ['count', 'frac', 'a count is not a rate; a rate is not a count.'],
];

export function unitsConflict(a, b) {
  if (a === b) return null;
  for (const [x, y, why] of CONFUSABLE) {
    if ((a === x && b === y) || (a === y && b === x)) return why || `${x} and ${y} are different quantities`;
  }
  return `the value is in ${JSON.stringify(a)} and the band is in ${JSON.stringify(b)} — these are not the same unit, so the comparison has no meaning`;
}

// ---------------------------------------------------------------------------------------------
// Verdicts.

export const READING = {
  OK: 'OK',
  SURFACE_INADMISSIBLE: 'SURFACE_INADMISSIBLE',
  UNIT_MISMATCH: 'UNIT_MISMATCH',
  NOTHING_READ: 'NOTHING_READ',
  READS_THE_CLOCK: 'READS_THE_CLOCK',
  BLIND_TO_SUBJECT: 'BLIND_TO_SUBJECT',
  PASSES_ON_DEGENERATE: 'PASSES_ON_DEGENERATE',
  DEGENERATE_NOT_GRADEABLE: 'DEGENERATE_NOT_GRADEABLE',
  NULL_CONTROL_FAILED: 'NULL_CONTROL_FAILED',
  UNDECLARED: 'UNDECLARED',
  ERROR: 'ERROR',
};

export const EXIT_FOR = {
  OK: 0,
  UNDECLARED: 2,
  SURFACE_INADMISSIBLE: 3,
  UNIT_MISMATCH: 4,
  NOTHING_READ: 5,
  READS_THE_CLOCK: 6,
  BLIND_TO_SUBJECT: 7,
  PASSES_ON_DEGENERATE: 8,
  NULL_CONTROL_FAILED: 9,
  ERROR: 10,
  DEGENERATE_NOT_GRADEABLE: 11,
};

// ---------------------------------------------------------------------------------------------
// Deliberate self-defects (rule 4). Nothing in normal operation sets these.

const BREAKS = new Set();
export function breakReading(id) { BREAKS.add(String(id)); }
export function repairReading() { BREAKS.clear(); }
export const READING_BREAKS = [
  'admissibility',   // Q1 off: a build record may support an on-screen claim
  'units',           // Q4 off: any unit grades against any band
  'clock',           // Q2 half off: the time arm is not compared
  'subject',         // Q2 other half off: the subject arm is not compared
  'degenerate',      // Q5 off: the degenerate subject is never graded
  'null',            // Q3 off: the sabotage control's verdict is ignored
  'nothing',         // the "nobody measured anything" guard off
];

// ---------------------------------------------------------------------------------------------
// Provenance.

let COMMIT = null;
export function commit() {
  if (COMMIT !== null) return COMMIT;
  try { COMMIT = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { COMMIT = 'unknown'; }
  return COMMIT;
}

export function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// ---------------------------------------------------------------------------------------------
// The band.

/**
 * `{unit, min?, max?}`. `grade(v)` is true when the value is inside the band. A band with neither
 * bound is not a band and is refused: RI-VIS03's whole premise is "compared against a band, with
 * a stated fail threshold", and "it looks flat" is not a verdict.
 */
export function gradeBand(band, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (band.min !== undefined && value < band.min) return false;
  if (band.max !== undefined && value > band.max) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// THE READING.

/**
 * @param {object} spec
 * @param {string} spec.id
 * @param {string} spec.claim         the sentence this number will be used to support
 * @param {keyof CLAIM} spec.claim_class
 * @param {keyof SURFACE} spec.surface     what was actually read
 * @param {string} spec.unit               the unit of `value`
 * @param {{unit:string,min?:number,max?:number}} spec.band
 * @param {string} spec.support_unit       what ONE unit of support is, in words (sabotage's rule)
 * @param {(ctx:{subject:string,t:number,broken:string[],degenerate:boolean}) => Promise<{value:any,support:number,artifact?:Buffer|string}>} spec.read
 * @param {Array<{id:string,what:string}>} spec.subjects   >= 2. Q2's subject arm.
 * @param {number} [spec.clock_steps]      how far time is advanced for Q2's time arm. Default 1.
 * @param {{what:string}} spec.degenerate  Q5. A subject that is definitionally a failure.
 * @param {Array<{id:string,what:string}>} spec.factors    Q3. Handed to sabotage.mjs.
 * @param {object} [spec.margin]           sabotage margin
 * @param {string} [spec.item]             the reference item this reading serves
 * @param {'FIDELITY'|'ART_DIRECTION'|null} [spec.side]  RI-VIS01 §B side, when it has one
 */
export async function takeReading(spec) {
  const t0 = Date.now();
  const problems = [];
  const need = ['id', 'claim', 'claim_class', 'surface', 'unit', 'band', 'support_unit', 'read', 'subjects', 'degenerate', 'factors'];
  for (const k of need) if (spec[k] === undefined || spec[k] === null) problems.push(`\`${k}\` was not declared`);
  if (spec.subjects && spec.subjects.length < 2) problems.push('`subjects` needs at least 2 — Q2 cannot tell a reading that sees the subject from one that sees the clock with only one subject');
  if (spec.factors && spec.factors.length < 1) problems.push('`factors` needs at least 1 — a reading with no null control is a number with nothing under it');
  if (spec.band && spec.band.min === undefined && spec.band.max === undefined) problems.push('`band` states no threshold. RI-VIS03: "compared against a band, with a stated fail threshold"');
  if (spec.band && !spec.band.unit) problems.push('`band.unit` was not declared — this is the one string that separates 151 luma from 40 ΔE');

  const base = {
    schema: 'elder-souls/visual-reading@1',
    id: spec.id || '(unnamed)',
    claim: spec.claim || null,
    claim_class: spec.claim_class || null,
    surface: spec.surface || null,
    surface_note: SURFACE_NOTE[spec.surface] || null,
    unit: spec.unit || null,
    band: spec.band || null,
    item: spec.item || null,
    side: spec.side || null,
    provenance: { commit: commit(), tool: 'tools/render/visual-reading.mjs', taken_utc: new Date().toISOString() },
  };

  if (problems.length) {
    return { ...base, verdict: READING.UNDECLARED, passed: false, why: problems.join('; '), ms: Date.now() - t0 };
  }

  // ---- Q1 admissibility (static; no run needed, and that is the point) ------------------------
  const allowed = ADMISSIBLE[spec.claim_class] || [];
  if (!BREAKS.has('admissibility') && !allowed.includes(spec.surface)) {
    return {
      ...base,
      verdict: READING.SURFACE_INADMISSIBLE,
      passed: false,
      why: `a ${spec.claim_class} claim cannot be supported by a ${spec.surface} reading. ` +
        `${SURFACE_NOTE[spec.surface] || ''} Admissible surfaces for ${spec.claim_class}: ${allowed.join(', ')}.`,
      ms: Date.now() - t0,
    };
  }

  // ---- Q4 units (static) ---------------------------------------------------------------------
  const uc = BREAKS.has('units') ? null : unitsConflict(spec.unit, spec.band.unit);
  if (uc) {
    return { ...base, verdict: READING.UNIT_MISMATCH, passed: false, why: uc, ms: Date.now() - t0 };
  }

  const call = async (o) => {
    const r = await spec.read({ subject: o.subject, t: o.t || 0, broken: o.broken || [], degenerate: !!o.degenerate });
    const out = { value: r ? r.value : null, support: r && Number.isFinite(r.support) ? r.support : null };
    if (r && r.artifact !== undefined && r.artifact !== null) {
      out.artifact_sha256 = sha256(Buffer.isBuffer(r.artifact) ? r.artifact : Buffer.from(String(r.artifact)));
    }
    return out;
  };

  const S = spec.subjects;
  const clockSteps = Number.isFinite(spec.clock_steps) ? spec.clock_steps : 1;
  const cells = {};
  let threw = null;
  try {
    cells.s0_t0 = await call({ subject: S[0].id, t: 0 });
    cells.s0_t1 = await call({ subject: S[0].id, t: clockSteps });
    cells.s1_t0 = await call({ subject: S[1].id, t: 0 });
  } catch (e) { threw = String((e && e.message) || e); }

  if (threw) return { ...base, verdict: READING.ERROR, passed: false, why: `the read threw: ${threw}`, cells, ms: Date.now() - t0 };

  // ---- "nobody measured anything" -------------------------------------------------------------
  // sabotage.mjs's round-2 shape 5, applied at the reading level: if every cell is null then the
  // clock arm "agrees" and the subject arm "agrees" and the reading reports a confident nothing.
  const allNothing = Object.values(cells).every((c) => measuredNothing(c.value));
  if (!BREAKS.has('nothing') && allNothing) {
    return { ...base, verdict: READING.NOTHING_READ, passed: false, cells,
      why: `every cell of the 2x2 returned null/undefined. NOTHING WAS READ, so the arms do not "agree" — ` +
        `there is no reading for them to agree about. A misspelt field name reaches this state and has.`,
      ms: Date.now() - t0 };
  }

  // ---- Q2 the CLOCK 2x2 -----------------------------------------------------------------------
  const timeMoved = valuesDiffer(cells.s0_t0.value, cells.s0_t1.value);
  const subjectMoved = valuesDiffer(cells.s0_t0.value, cells.s1_t0.value);
  const clock = {
    subject_held: S[0].id,
    steps: clockSteps,
    at_t0: cells.s0_t0.value,
    at_t1: cells.s0_t1.value,
    moved_with_time_alone: timeMoved,
    other_subject: S[1].id,
    other_subject_value: cells.s1_t0.value,
    moved_with_subject: subjectMoved,
  };

  // ---- Q5 the DEGENERATE SUBJECT ---------------------------------------------------------------
  let degenerate = null;
  if (!BREAKS.has('degenerate')) {
    let dcell;
    try { dcell = await call({ subject: S[0].id, t: 0, degenerate: true }); }
    catch (e) { dcell = { value: null, support: null, error: String((e && e.message) || e) }; }
    // EMPTY IS NOT A PASS AND IT IS NOT A FAIL EITHER. `tools/lib/graded.mjs` was written for
    // exactly this law after eleven of fifteen graded checks in one piece returned PASS on an
    // empty sample set — FD6 among them, whose `edgeFringe()` returns `{worst: 0}` over zero edge
    // pixels and then compares 0 against a maximum. A degenerate subject that produced no samples
    // has not shown the predicate can say no; it has shown nothing, and calling that either a
    // pass or a demonstrated red would be the same mistake in two directions.
    const gradeable = Number.isFinite(dcell.support) && dcell.support >= 1;
    degenerate = {
      what: spec.degenerate.what,
      value: dcell.value,
      support: dcell.support,
      gradeable,
      in_band: gradeable ? gradeBand(spec.band, dcell.value) : null,
      status: gradeable ? 'GRADED' : 'EMPTY',
    };
  }

  // ---- Q3 the NULL CONTROL, through sabotage.mjs (not re-implemented here) ---------------------
  let nul = null;
  if (!BREAKS.has('null')) {
    nul = await runControl({
      id: `${spec.id}:null`,
      what: `the mechanism under ${spec.id}`,
      metric: spec.id,
      unit: spec.support_unit,
      factors: spec.factors,
      margin: spec.margin,
      supportArms: spec.supportArms,
      support_note: spec.support_note,
      supportFloor: spec.supportFloor,
      measure: async (broken) => {
        const c = await call({ subject: S[0].id, t: 0, broken });
        return { value: c.value, support: c.support === null ? 0 : c.support };
      },
    });
  }

  // ---- the cascade ----------------------------------------------------------------------------
  //
  // ORDER, and the reason for it. `PASSES_ON_DEGENERATE` outranks both discrimination arms
  // because RULES.md rule 4 — "a probe that cannot fail is worse than no probe" — is a statement
  // about whether the check has a red state at all, and a probe with no red state has no
  // discrimination worth measuring. `canvas !== null` is blind to its subject AND passes on a
  // black screen; reporting only the first would send the next agent to fix the resolution of a
  // check that can never say no.
  //
  // Every condition that held is recorded in `concurrent_failures`, so the collisions the cascade
  // necessarily creates are reported rather than swallowed by whichever test ran first. That is
  // sabotage.mjs's own round-2 lesson and it applies here unchanged.
  const held = [];
  if (degenerate && degenerate.in_band === true) held.push(READING.PASSES_ON_DEGENERATE);
  if (degenerate && degenerate.gradeable === false) held.push(READING.DEGENERATE_NOT_GRADEABLE);
  if (!BREAKS.has('clock') && timeMoved) held.push(READING.READS_THE_CLOCK);
  if (!BREAKS.has('subject') && !subjectMoved) held.push(READING.BLIND_TO_SUBJECT);
  if (nul && !nul.passed) held.push(READING.NULL_CONTROL_FAILED);

  const common = { ...base, cells, clock, degenerate, null_control: nul, concurrent_failures: held, reading_breaks: [...BREAKS], ms: Date.now() - t0 };

  if (held.includes(READING.PASSES_ON_DEGENERATE)) {
    return { ...common, verdict: READING.PASSES_ON_DEGENERATE, passed: false,
      why: `run against ${spec.degenerate.what} — a subject that is definitionally a failure — the reading returned ` +
        `${JSON.stringify(degenerate.value)} ${spec.unit}, which is INSIDE the band ${JSON.stringify(spec.band)}. THE PREDICATE CANNOT SAY NO. ` +
        `This is the "a canvas exists, it has non-zero dimensions, and there are no page errors" shape: all three were true of a black screen.` +
        (held.length > 1 ? ` ALSO HELD: ${held.filter((h) => h !== READING.PASSES_ON_DEGENERATE).join(', ')}.` : '') };
  }
  if (held.includes(READING.DEGENERATE_NOT_GRADEABLE)) {
    return { ...common, verdict: READING.DEGENERATE_NOT_GRADEABLE, passed: false,
      why: `the degenerate subject (${spec.degenerate.what}) produced ${degenerate.support} sample(s), so Q5 was never answered: ` +
        `the predicate has not been shown able to say no. EMPTY is not a pass and it is not a demonstrated red — ` +
        `tools/lib/graded.mjs exists because eleven of fifteen checks in one piece returned PASS over an empty sample set. ` +
        `Supply a degenerate subject the reading can actually grade, or say plainly that Q5 is unanswerable for this claim.` +
        (held.length > 1 ? ` ALSO HELD: ${held.filter((h) => h !== READING.DEGENERATE_NOT_GRADEABLE).join(', ')}.` : '') };
  }
  if (held.includes(READING.READS_THE_CLOCK)) {
    return { ...common, verdict: READING.READS_THE_CLOCK, passed: false,
      why: `with the subject held at ${S[0].id} and only ${clockSteps} step(s) of time passing, the reading moved from ` +
        `${JSON.stringify(cells.s0_t0.value)} to ${JSON.stringify(cells.s0_t1.value)}. It cannot distinguish the thing under test from ` +
        `time passing — this is the "8 distinct images from one unchanged room" shape, where the measure was hashing the step counter.` +
        (held.length > 1 ? ` ALSO HELD: ${held.filter((h) => h !== READING.READS_THE_CLOCK).join(', ')}.` : '') };
  }
  if (held.includes(READING.BLIND_TO_SUBJECT)) {
    return { ...common, verdict: READING.BLIND_TO_SUBJECT, passed: false,
      why: `changing the subject from ${S[0].id} to ${S[1].id} at fixed time did not move the reading ` +
        `(both ${JSON.stringify(cells.s0_t0.value)}). The instrument does not see its own subject, so no number it produces is ` +
        `about the thing it names. RULES.md rule 8: the easiest fixture collects the most data and distinguishes nothing.` +
        (held.length > 1 ? ` ALSO HELD: ${held.filter((h) => h !== READING.BLIND_TO_SUBJECT).join(', ')}.` : '') };
  }
  if (held.includes(READING.NULL_CONTROL_FAILED)) {
    return { ...common, verdict: READING.NULL_CONTROL_FAILED, passed: false,
      why: `the null control came back ${nul.verdict}: ${nul.why}` };
  }

  const value = cells.s0_t0.value;
  const inBand = gradeBand(spec.band, value);
  return {
    ...common,
    verdict: READING.OK,
    passed: true,
    value,
    support: cells.s0_t0.support,
    support_unit: spec.support_unit,
    in_band: inBand,
    artifact_sha256: cells.s0_t0.artifact_sha256 || null,
    why: `read ${JSON.stringify(value)} ${spec.unit} off the ${spec.surface} over ${cells.s0_t0.support} ${spec.support_unit}; ` +
      `held still through ${clockSteps} step(s) of time; moved when the subject changed; ` +
      `went ${JSON.stringify(degenerate ? degenerate.value : null)} (out of band) on ${spec.degenerate.what}; ` +
      `and the null control moved it (${nul ? nul.why : 'skipped'}). ` +
      `Band ${JSON.stringify(spec.band)}: ${inBand === null ? 'not gradeable (non-numeric value)' : inBand ? 'IN BAND' : 'OUT OF BAND'}.`,
  };
}

/** Run several readings and roll them up. `expect` replays a historically broken instrument. */
export async function runReadings(specs, { onResult } = {}) {
  const results = [];
  for (const s of specs) {
    const r = await takeReading(s);
    if (s.expect) { r.expected_verdict = s.expect; r.as_expected = r.verdict === s.expect; }
    if (onResult) onResult(r);
    results.push(r);
  }
  const bad = results.filter((r) => (r.expected_verdict ? !r.as_expected : !r.passed));
  return {
    schema: 'elder-souls/visual-reading-suite@1',
    n: results.length,
    ok: bad.length === 0,
    failures: bad.map((r) => `${r.id}: got ${r.verdict}, wanted ${r.expected_verdict || 'OK'}`),
    exit: bad.length === 0 ? 0 : (EXIT_FOR[bad[0].verdict] || 1),
    results,
  };
}

export function formatSuite(suite) {
  const out = [];
  for (const r of suite.results) {
    const want = r.expected_verdict || 'OK';
    const ok = r.expected_verdict ? r.as_expected : r.passed;
    out.push(`${ok ? 'ok  ' : 'FAIL'}  ${String(r.id).padEnd(38)} ${r.verdict.padEnd(22)} (wanted ${want})`);
    out.push(`      ${r.why}`);
  }
  out.push(`${suite.ok ? 'PASS' : 'FAIL'}  ${suite.n - suite.failures.length}/${suite.n} readings behaved as declared.`);
  for (const f of suite.failures) out.push(`  ! ${f}`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// SELF-TEST — the six failures at the head of this file, replayed.

function cases() {
  const twoSubjects = [{ id: 'room-A', what: 'the first interior' }, { id: 'room-B', what: 'a different interior' }];
  const oneFactor = [{ id: 'meshes', what: 'empty the room group' }];

  // A reading that behaves. Value depends on the subject and on the factor, not on the clock; it
  // goes red on a black frame.
  const honest = {
    id: 'clean--edge-density-on-the-frame',
    claim: 'the interior frame has edge structure',
    claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
    unit: 'frac', band: { unit: 'frac', min: 0.02 },
    support_unit: 'pixels graded',
    subjects: twoSubjects, factors: oneFactor,
    degenerate: { what: 'an all-black 1920x1080 frame' },
    read: async ({ subject, degenerate, broken }) => {
      if (degenerate) return { value: 0.0, support: 2073600 };
      if (broken.includes('meshes')) return { value: 0.0, support: 2073600 };
      return { value: subject === 'room-A' ? 0.081 : 0.064, support: 2073600 };
    },
  };

  return [
    { ...honest, expect: READING.OK },

    // FAILURE 1 — the canvas check. Three true things about a black screen.
    { id: 'failure-1--canvas-exists-nonzero-no-errors',
      claim: 'the game is rendering', claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'count', band: { unit: 'count', min: 1 }, support_unit: 'canvases inspected',
      subjects: twoSubjects, factors: oneFactor,
      degenerate: { what: 'an all-black 1920x1080 frame' },
      // The tell: it returns 1 no matter what, including on the black frame.
      read: async ({ subject }) => ({ value: 1, support: 1, detail: subject }),
      expect: READING.PASSES_ON_DEGENERATE },

    // FAILURE 2 — hashing the step counter. Moves with time, on one unchanged room.
    { id: 'failure-2--distinctness-hashes-the-step-counter',
      claim: 'the eight town centres render eight distinct images',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'count', band: { unit: 'count', min: 8 }, support_unit: 'captures compared',
      subjects: twoSubjects, factors: oneFactor,
      degenerate: { what: 'the same eight captures taken from one unmoved pose' },
      // The real one held TWO defects at once — a step-counter hash also produces distinct values
      // over an emptied scene — and `concurrent_failures` is where that is recorded. Here the
      // degenerate arm is the empty capture set, so the clock defect is isolated.
      read: async ({ t, degenerate }) => (degenerate ? { value: 1, support: 8 } : { value: 8 + t, support: 8 }),
      expect: READING.READS_THE_CLOCK },

    // FAILURE 3 — `interior.meshes` as a renderer read. Refused before it is ever run.
    { id: 'failure-3--interior-meshes-quoted-as-a-renderer-read',
      claim: 'the room draws 127 meshes on screen',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.BUILD_RECORD,
      unit: 'count', band: { unit: 'count', min: 100 }, support_unit: 'meshes recorded at build time',
      subjects: twoSubjects, factors: oneFactor,
      degenerate: { what: 'an emptied scene group' },
      read: async () => ({ value: 127, support: 127 }),
      expect: READING.SURFACE_INADMISSIBLE },

    // The same build record, supporting the claim it actually can support.
    { id: 'failure-3b--the-same-build-record-under-an-AUTHORED-claim',
      claim: 'the builder authored 127 meshes for this room',
      claim_class: CLAIM.AUTHORED, surface: SURFACE.BUILD_RECORD,
      unit: 'count', band: { unit: 'count', min: 100 }, support_unit: 'interior build records read',
      subjects: twoSubjects, factors: oneFactor,
      degenerate: { what: 'a room with no authored contents' },
      read: async ({ subject, degenerate, broken }) => {
        if (degenerate || broken.includes('meshes')) return { value: 0, support: 1 };
        return { value: subject === 'room-A' ? 127 : 113, support: 1 };
      },
      expect: READING.OK },

    // FAILURE 4 — luma graded against a ΔE band.
    { id: 'failure-4--luma-overshoot-graded-against-a-dE-band',
      claim: 'UI edge fringing is within the ΔE bar',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'luma_0_255', band: { unit: 'dE2000', max: 40 }, support_unit: 'edge pixels graded',
      subjects: twoSubjects, factors: oneFactor,
      degenerate: { what: 'a flat grey frame with no edges' },
      read: async () => ({ value: 151, support: 98659 }),
      expect: READING.UNIT_MISMATCH },

    // FAILURE 5 — the posed camera whose yaw was never written: every pose reads the same.
    { id: 'failure-5--posed-camera-never-wrote-its-yaw',
      claim: 'the projection differs between two camera poses',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'ndc', band: { unit: 'ndc', min: 0.28 }, support_unit: 'joints projected',
      subjects: [{ id: 'yaw-0', what: 'camera behind' }, { id: 'yaw-180', what: 'camera in front' }],
      factors: oneFactor,
      degenerate: { what: 'a camera with a null projection matrix' },
      read: async ({ degenerate }) => (degenerate ? { value: 0, support: 13 } : { value: 0.44, support: 13 }),
      expect: READING.BLIND_TO_SUBJECT },

    // FAILURE 6 — the sheared chart font. The reading is fine; the null control is inert, because
    // nothing about the number depends on the mechanism it names.
    { id: 'failure-6--the-glyph-renderer-nothing-depends-on',
      claim: 'published chart numbers are legible',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'frac', band: { unit: 'frac', min: 0.9 }, support_unit: 'glyphs rendered',
      subjects: twoSubjects, factors: [{ id: 'shear', what: 'apply the shear transform to every glyph' }],
      degenerate: { what: 'a chart with no glyphs drawn at all' },
      read: async ({ subject, degenerate }) => {
        if (degenerate) return { value: 0, support: 240 };
        return { value: subject === 'room-A' ? 0.97 : 0.93, support: 240 };
      },
      expect: READING.NULL_CONTROL_FAILED },

    // Undeclared: no degenerate subject at all.
    { id: 'undeclared--no-degenerate-subject',
      claim: 'something', claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'frac', band: { unit: 'frac', min: 0.1 }, support_unit: 'pixels',
      subjects: twoSubjects, factors: oneFactor, degenerate: null,
      read: async () => ({ value: 0.5, support: 10 }),
      expect: READING.UNDECLARED },

    // The degenerate subject produced no samples. This is FD6's own shape — `edgeFringe()`
    // returns `{worst: 0}` over zero edge pixels and 0 is inside a `max` band — and the answer is
    // neither "it passed" nor "it went red". It is EMPTY.
    { id: 'degenerate-empty--zero-samples-is-not-a-red',
      claim: 'UI edge fringing is inside the ΔE bar', claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'dE2000', band: { unit: 'dE2000', max: 8 }, support_unit: 'edge pixels graded',
      subjects: twoSubjects, factors: [{ id: 'colourspace', what: 'grade in luma instead of ΔE' }],
      degenerate: { what: 'a capture set with zero graded edge pixels' },
      read: async ({ subject, degenerate, broken }) => {
        if (degenerate) return { value: 0, support: 0 };
        if (broken.includes('colourspace')) return { value: 151, support: 98659 };
        return { value: subject === 'room-A' ? 58.291 : 41.2, support: 98659 };
      },
      expect: READING.DEGENERATE_NOT_GRADEABLE },

    // Nothing read at all — a misspelt field.
    { id: 'nothing-read--misspelt-field',
      claim: 'something', claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'frac', band: { unit: 'frac', min: 0.1 }, support_unit: 'pixels',
      subjects: twoSubjects, factors: oneFactor, degenerate: { what: 'a black frame' },
      read: async () => ({ value: undefined, support: 10 }),
      expect: READING.NOTHING_READ },
  ];
}

async function selfTest(jsonOut) {
  const run = async () => {
    const s = await runReadings(cases());
    return s.results.map((r) => ({ id: r.id, want: r.expected_verdict || 'OK', got: r.verdict, ok: r.expected_verdict ? r.as_expected : r.passed }));
  };

  repairReading();
  const base = await run();
  const baseBad = base.filter((r) => !r.ok);

  const lines = ['visual-reading --self-test', '', 'A. the six published failures, replayed, plus controls:'];
  for (const r of base) lines.push(`   ${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(52)} got ${r.got.padEnd(22)} want ${r.want}`);
  lines.push(`   ${baseBad.length === 0 ? 'PASS' : 'FAIL'}  ${base.length - baseBad.length}/${base.length}`);
  lines.push('', 'B. the falsifier — each of this module\'s own checks disabled in turn.');
  lines.push('   The suite MUST go red under every one; a break that leaves it green is a check that does nothing:');

  const inert = [];
  const breakRows = [];
  for (const b of READING_BREAKS) {
    repairReading(); breakReading(b);
    const r = await run();
    repairReading();
    const bad = r.filter((x) => !x.ok);
    if (!bad.length) inert.push(b);
    breakRows.push({ break: b, broke: bad.length, cases: bad.map((x) => `${x.id}(${x.want}->${x.got})`) });
    lines.push(`   ${bad.length ? 'went red' : 'STAYED GREEN'}  --break=${b.padEnd(14)} ${bad.length} case(s): ${bad.map((x) => `${x.id.split('--')[0]}(${x.want}->${x.got})`).join(', ') || '-'}`);
  }

  const ok = baseBad.length === 0 && inert.length === 0;
  lines.push('');
  if (inert.length) lines.push(`   ! ${inert.length} break(s) left the suite green: ${inert.join(', ')}`);
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${base.length} readings, ${READING_BREAKS.length} deliberate self-defects, ${inert.length} inert.`);
  process.stdout.write(lines.join('\n') + '\n');

  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify({
      schema: 'elder-souls/visual-reading-selftest@1', commit: commit(), ok,
      cases: base, falsifier: breakRows, inert_breaks: inert,
    }, null, 2));
    process.stderr.write(`visual-reading: wrote ${jsonOut}\n`);
  }
  return ok ? 0 : 1;
}

const USAGE = `
visual-reading.mjs — render.process.measurement. A visual reading that carries its own provenance,
its own null, its own clock control and its own degenerate subject.

USAGE
  node tools/render/visual-reading.mjs --self-test [--json out.json]

  As a library:
    import { takeReading, SURFACE, CLAIM } from 'tools/render/visual-reading.mjs';

FIVE QUESTIONS A READING MUST ANSWER (and cannot be constructed without answering):
  Q1  what surface was read          \`surface\` + \`claim_class\`, checked against ADMISSIBLE
  Q2  subject or the clock?          \`subjects\` (>=2) — the CLOCK 2x2
  Q3  what is the null control       \`factors\` — run through tools/experience/lib/sabotage.mjs
  Q4  in what units                  \`unit\` and \`band.unit\`, which must match
  Q5  how is it shown able to fail   \`degenerate\` — the predicate must go red on it

EXIT  0 ok · 2 undeclared · 3 surface · 4 units · 5 nothing read · 6 clock · 7 blind · 8 degenerate
      9 null control · 10 error
`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h') || !argv.length) { process.stdout.write(USAGE.trimStart()); process.exit(argv.length ? 0 : 2); }
  const ji = argv.indexOf('--json');
  if (argv.includes('--self-test')) process.exit(await selfTest(ji >= 0 ? argv[ji + 1] : null));
  process.stdout.write(USAGE.trimStart());
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
