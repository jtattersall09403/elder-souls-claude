// sabotage.mjs — THE SABOTAGE CONTROL, AS A FACILITY ANY PIECE CAN USE.
//
// `PLAYTHROUGH-CRITIC.md` §10 names "the control is never run" as the most likely failure in the
// corpus. It is not the only one. Three separate agents on this tree, on one day, shipped a
// control that WAS run, exited 0, and measured nothing — each in a different way:
//
//   1. THE ARMS AGREED.        W1-04 round 3 (e37d327). `__w1_04_townSolids(false)` nulled
//      `engine._townCell` BEFORE calling `_settleSettlementSolids()`, whose off-branch reads
//      `if (this._townCell && this.sim.cell === this._townCell)`. With the handle gone that
//      branch is dead code, `sim.cell` kept the wall set, and BOTH arms were the walls-on arm.
//      Fifteen walks, byte-identical `with_walls` and `walls_cut`. The report was green.
//
//   2. EACH GUARD MEASURED INERT ALONE.  W1-SOULS round 3 (3124790). Two guards for one defect
//      — the `_alive` identity key in `sim/souls.js` and the `souls.reset()` boundary call in
//      `engine.js`. Delete either one: the number stays 252/342 and the arm passes. Delete both:
//      the same six-body fight pays 0. A one-factor delete-the-fix reports BOTH halves inert, so
//      the next agent removes one in good faith and the defect returns.
//
//   3. THE CONTROL HAD NOTHING IN IT.  W1-13 round 4 (b900460). The clause that set the item's
//      score compared "NPCs moved by the rest" between a rested arm and a control — at a hearth
//      whose roster was `{}`. 0 vs 0. Both arms agreed, and they agreed about an empty town.
//
// ROUND 2 ADDS TWO MORE, BOTH FOUND INSIDE THIS FILE by `critic-w1-25.mjs`
// (`corpus/90-verdicts/wave1/W1-25-r1.md`, gap
// `GAP-W1-25-the-control-facility-has-an-optional-control`):
//
//   4. THE TEARDOWN SHORT-CIRCUITED UPSTREAM.  W1-14 round 3. `--break=nocast` skips the cast, so
//      all 55 rows exit at `NOT_DELIVERED` before `readDial()` — the comparator under test never
//      ran in the control arm. The arms differ LOUDLY (33 coupled vs 0) and the difference is
//      about the delivery gate, not about the dials. Round 1 had no name for this shape.
//
//   5. NOTHING WAS MEASURED AT ALL.  The critic's own first run of section A read
//      `magnitude_coupled` off the top level of an artifact instead of off `.summary`, so BOTH
//      arms measured `undefined`. `canon()` maps `undefined`, `null` and a missing field all to
//      the string `'null'`, the arms "agreed", and this facility returned **INERT** — a
//      confident, publishable claim that breaking it changed nothing, about a measurement that
//      never happened. The flagship verdict, produced by a typo, inside the tool built to
//      prevent exactly that. `undefined === undefined` must never read as "the arms agree".
//
// Those are five DIFFERENT failures and a naive "did A and B differ?" check catches exactly one
// of them. This module catches all five, and it is the same code path in every case:
//
//   NO_MEASUREMENT  every arm's value canonicalises to nothing. No arm measured anything, so
//                   "the arms agree" is a statement about two absences (round-2 shape 5).
//   VACUOUS         an in-scope arm has no support — the measurement ranged over zero units, so
//                   "the arms agree" is a statement about an empty set and not about the build.
//   SHORT_CIRCUIT   the intact arm ranged over a population and a BROKEN arm ranged over a
//                   fraction of it. The teardown removed the units instead of changing what the
//                   comparator computed on them (round-2 shape 4).
//   INERT           NO ARM differs from any other. The break did nothing.
//   MASKED          arms differ, but no single factor moves it at all. There are k guards where
//                   the piece measured one, and each one measures inert alone.
//
// plus UNDERPOWERED (differs, below the declared margin), WRONG_DIRECTION, and ERROR (an arm
// threw, or the control did not declare enough about itself to be graded — see SUPPORT below).
//
// THE CONTRACT, in one line: **a control FAILS when its arms agree.** `passed` is false for
// every verdict except OK, and the CLI's exit code carries the reason.
//
// ---------------------------------------------------------------------------------------------
// SUPPORT: WHY IT IS MANDATORY, AND WHY THE NUMBER ALONE IS NOT ENOUGH.
//
// Round 1 shipped `support` as an OPTIONAL integer. `Number.isFinite(undefined)` is false, the
// arm's support became `null`, and the vacuity filter skipped it. Omit the field and the entire
// W1-13 check was silently disabled for that control, and **the verdict on missing evidence was
// `OK`**. A control facility whose default answer to "you told me nothing" is "you pass" is the
// defect it was built to catch, one level up.
//
// Round 2 decides it two ways, and the difference between them is the argument:
//
//   (a) SUPPORT IS MANDATORY, AND ITS ABSENCE IS A VERDICT — not a throw. Every arm must return
//       a finite `support`. An arm that does not gets `VERDICT.ERROR` with
//       `error_kind:'support_undeclared'`, exit 7. A VERDICT rather than a throw because a
//       suite of forty controls must still report the other thirty-nine; a throw takes the whole
//       run down and the missing evidence disappears with it. It is non-zero either way, which
//       is the only property that matters for a gate.
//
//   (b) THE NUMBER'S MEANING MUST BE DECLARED, AND WITHOUT IT THERE IS NO PASS. This is the
//       harder half and it is the one the critic's section A is about. W1-14-r3's control,
//       replayed from the builder's own two artifacts:
//
//           support = "effects the census EXAMINED"  -> 55 / 55 -> OK       (the inert control passes)
//           support = "effects that were DELIVERED"  -> 55 /  0 -> VACUOUS  (it is caught)
//
//       Same control, same two files, opposite verdicts. And the facility CANNOT TELL THEM
//       APART FROM THE DATA: `{value:33, support:55} vs {value:0, support:55}` is byte-identical
//       in shape to a perfect control (W1-04's fixed arm is `67 -> 0` over 360 units). There is
//       no rule over the numbers that separates them, because the difference is not in the
//       numbers. It is in what the caller meant.
//
//       So the facility refuses to award a PASS to a control that never said what one unit of
//       support is. `spec.unit` is a required string — "magic effects that reached readDial()",
//       "walks attempted", "NPCs on the roster". Its absence produces `VERDICT.ERROR` with
//       `error_kind:'support_unit_undeclared'`.
//
//       This check is LAST in the cascade on purpose: an undeclared unit must never convert a
//       failure into a pass, and must never hide a defect the facility can see. It only ever
//       withholds a pass. And because `unit` is carried onto the result, a report can list every
//       control on the tree beside the thing it counted, which is how a human catches the
//       W1-14 reading that no rule can.
//
//       It does not stop a caller writing the wrong number. Nothing can. It stops a caller
//       collecting a pass without ever having stated the claim.
//
// ---------------------------------------------------------------------------------------------
// WHAT MAKES THIS DIFFERENT FROM WRITING THE SAME CHECK FOUR MORE TIMES. A caller supplies two
// things and nothing else: a way to MEASURE, and a list of FACTORS it can break. The factorial
// enumeration, the support accounting, the agreement test, the masking analysis and the
// verdict are here, once. `tools/composition/matrix-probe.mjs` and
// `tools/experience/breakage-probe.mjs` are both callers, and neither one re-implements "did the
// arms differ".
//
// RULES.md #4: this module's own falsifier is `tools/experience/sabotage.mjs --self-test`, which
// runs a synthetic case per verdict with known answers AND re-runs them with this module's
// comparator deliberately broken nine ways, requiring the suite to go red under every one. Any
// break that leaves every case green is a check that does no work, and the runner names it and
// exits non-zero. An instrument that cannot be made to fail is not an instrument.
'use strict';

export const VERDICT = {
  OK: 'OK',
  INERT: 'INERT',
  MASKED: 'MASKED',
  VACUOUS: 'VACUOUS',
  UNDERPOWERED: 'UNDERPOWERED',
  WRONG_DIRECTION: 'WRONG_DIRECTION',
  NO_MEASUREMENT: 'NO_MEASUREMENT',
  SHORT_CIRCUIT: 'SHORT_CIRCUIT',
  ERROR: 'ERROR',
};

/** Exit codes. There is no "0 but". OK is the only pass. */
export const EXIT_FOR = {
  OK: 0,
  INERT: 2,
  VACUOUS: 3,
  MASKED: 4,
  UNDERPOWERED: 5,
  WRONG_DIRECTION: 6,
  ERROR: 7,
  // 8 (a case could not be built from disk) and 9 (usage) belong to the CLI, not to a verdict.
  NO_MEASUREMENT: 10,
  SHORT_CIRCUIT: 11,
};

/** The default fraction of the intact arm's support a broken arm must retain. See SHORT_CIRCUIT. */
export const DEFAULT_SUPPORT_FLOOR = 0.5;

/**
 * Deliberate defects, injected by `--self-test --break=<id>`, so the suite can be shown going
 * red. Nothing in normal operation sets these.
 *
 * Every entry here is a check in this file that could otherwise silently do nothing. Round 1 had
 * three; round 2 has nine, one per check added or changed.
 */
const BREAKS = new Set();
export function breakFacility(id) { BREAKS.add(String(id)); }
export function repairFacility() { BREAKS.clear(); }
export function facilityBreaks() { return [...BREAKS]; }

// ---------------------------------------------------------------------------------------------
// Value comparison. A measurement's "value" may be a number, a string, an array or an object;
// what matters is only whether two arms produced THE SAME THING.

/** Stable, order-insensitive-for-object-keys serialisation, so `{a:1,b:2}` == `{b:2,a:1}`. */
export function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'nonfinite:' + String(v);
  if (typeof v !== 'object') return typeof v + ':' + String(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}

/**
 * Did this arm measure anything at all?
 *
 * `canon()` flattens `undefined`, `null` and a missing field to the same string as a deliberate
 * `null` result. That flattening is right for COMPARING two arms and catastrophic for JUDGING
 * them: two arms that measured nothing "agree", and round 1 called that INERT. So the emptiness
 * is tested here, before the comparison, and it is tested on the raw value rather than on the
 * canonical form.
 *
 * An empty array and an empty object are NOT nothing — `[]` is a real answer to "which towns
 * kept their walls" and the W1-04 case depends on it.
 */
export function measuredNothing(v) {
  if (BREAKS.has('null-is-a-value')) return false;   // round-1 behaviour: undefined is a value
  return v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
}

/** Do two arm values differ at all? This is the whole item, and it is three lines. */
export function valuesDiffer(a, b) {
  // --break=comparator: the failure this module exists to catch, applied to itself. Every pair
  // now reads as different, so an INERT case reports OK and the self-test must notice.
  if (BREAKS.has('comparator')) return true;
  return canon(a) !== canon(b);
}

/** Numeric magnitude of a value, or null when the value is not a number. */
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

/**
 * Is the observed change big enough?
 *   {kind:'differs'}                 any difference at all
 *   {kind:'absolute', min:n}         |b-a| >= n
 *   {kind:'relative', min:f}         |b-a| / max(|a|,eps) >= f   (f = 0.5 is "by >= 50%")
 */
export function meetsMargin(intact, broken, margin) {
  const m = margin || { kind: 'differs' };
  if (m.kind === 'differs') return { ok: valuesDiffer(intact, broken), observed: null, want: null };
  const a = num(intact), b = num(broken);
  if (a === null || b === null) {
    return { ok: false, observed: null, want: m.min, why: 'a numeric margin was declared over a non-numeric value' };
  }
  const d = Math.abs(b - a);
  if (m.kind === 'absolute') return { ok: d >= m.min, observed: d, want: m.min };
  const base = Math.max(Math.abs(a), 1e-12);
  const rel = d / base;
  return { ok: rel >= m.min, observed: rel, want: m.min };
}

// ---------------------------------------------------------------------------------------------
// Arm enumeration.

/** All 2^k subsets of the factor ids, smallest first. Capped: see `enumerateArms`. */
function subsets(ids) {
  const out = [[]];
  for (const id of ids) for (const s of out.slice()) out.push([...s, id]);
  out.sort((x, y) => x.length - y.length || x.join(',').localeCompare(y.join(',')));
  return out;
}

/**
 * Which arms to run.
 *
 * Full factorial to k = 4 (16 arms). Beyond that, the intact arm, every singleton and the
 * all-broken arm — enough to separate INERT from MASKED, which is what the verdict turns on,
 * without 2^12 browser runs.
 *
 * `--break=factorial` drops every arm but intact and all-broken: the W1-SOULS shape becomes
 * invisible, MASKED can never be reported, and the self-test must catch that.
 */
export function enumerateArms(factorIds, { full = true } = {}) {
  const ids = [...factorIds];
  if (BREAKS.has('factorial')) return [[], ids.slice()];
  if (!full || ids.length > 4) {
    const arms = [[]];
    for (const id of ids) arms.push([id]);
    if (ids.length > 1) arms.push(ids.slice());
    return arms;
  }
  return subsets(ids);
}

// ---------------------------------------------------------------------------------------------
// Spec validation. A malformed SPEC throws; a malformed MEASUREMENT is a verdict.
//
// The line between them: a spec is written by the caller and is wrong at author time, so it can
// never be right and there is nothing to report about the build. A measurement is produced at
// run time and its absence IS the finding. `runSuite` catches these throws and records them as
// suite failures so one bad spec cannot take forty controls down with it.

export class SpecError extends Error {}

export function validateSpec(spec) {
  const factors = (spec.factors || []).map((f) => (typeof f === 'string' ? { id: f, what: f } : f));
  if (!factors.length) throw new SpecError(`sabotage(${spec.id}): a control with no factors is not a control`);

  // The escape hatch, now enforced. Round 1's docstring said a caller narrowing the support
  // scope "must say why, in `support_note`" and NO CODE PATH READ IT — `runControl` did not even
  // copy the field onto the result, so a downstream report could not audit for it. The canonical
  // W1-13 failure was one spec key away from passing, unauditably. Now it is a SpecError, and
  // the note is carried onto the result so a report can list every control that opted out.
  if (spec.supportArms === 'intact' && !String(spec.support_note || '').trim() && !BREAKS.has('support-note-optional')) {
    throw new SpecError(
      `sabotage(${spec.id}): supportArms:'intact' narrows the vacuity check to the intact arm, which is ` +
      `exactly how the W1-13 empty-control failure passes. A caller that narrows it must say why, in ` +
      `\`support_note\`. That obligation was documented and unenforced through round 1; it is enforced now.`);
  }
  return factors;
}

// ---------------------------------------------------------------------------------------------
// The control itself.

/**
 * Run a sabotage control.
 *
 * @param {object} spec
 * @param {string} spec.id           short id, used in reports
 * @param {string} spec.what         one sentence: what is being measured
 * @param {string} [spec.metric]     the name of the number
 * @param {string} spec.unit         REQUIRED FOR A PASS. What ONE UNIT OF SUPPORT IS, in words.
 *                                   "magic effects that reached readDial()", "walks attempted",
 *                                   "NPCs on the roster at the hearth". See SUPPORT at the head
 *                                   of this file: the whole W1-14 argument is about which of two
 *                                   readings of one integer the caller meant, and this is where
 *                                   the caller says so. Omitting it produces ERROR, never OK.
 * @param {Array<{id:string,what:string}>} spec.factors   the things that can be broken (>= 1)
 * @param {function} spec.measure    async (brokenIds:string[], ctx) =>
 *                                     { value, support, detail? }
 *                                   `support` is MANDATORY on every arm and is THE NUMBER OF
 *                                   UNITS THAT REACHED THE COMPARATOR — not the number
 *                                   enumerated, not the number the loop started with. That one
 *                                   word is what separates a control the facility catches from
 *                                   the same control it passes. A measurement over zero units is
 *                                   VACUOUS however tidy its value looks; a measurement whose
 *                                   broken arm reached a fraction of the intact arm's units is
 *                                   SHORT_CIRCUIT however far apart the two values are.
 * @param {object} [spec.margin]     see meetsMargin; default {kind:'differs'}
 * @param {'lower'|'higher'|'any'} [spec.direction]  which way breaking it should move the number
 * @param {number} [spec.minSupport] default 1
 * @param {number} [spec.supportFloor] fraction of the intact arm's support a broken arm must
 *                                   retain before SHORT_CIRCUIT fires. Default 0.5. Set 0 for a
 *                                   control whose break legitimately removes bodies — and say
 *                                   why in `support_note`.
 * @param {'all'|'intact'} [spec.supportArms]  narrow the vacuity check. Requires `support_note`.
 * @param {string} [spec.support_note]  why the support scope or floor was narrowed.
 * @param {string} [spec.expect]     a VERDICT this case is expected to produce (used when
 *                                   replaying a historically broken instrument: the broken one
 *                                   is EXPECTED to be INERT, and a run where it is not is the
 *                                   failure).
 * @param {boolean} [spec.full]      full factorial (default true, capped at k=4)
 * @param {object} [spec.ctx]        passed through to measure()
 */
export async function runControl(spec) {
  const t0 = Date.now();
  const factors = validateSpec(spec);
  const ids = factors.map((f) => f.id);
  const armPlans = enumerateArms(ids, { full: spec.full !== false });

  const arms = [];
  let errored = null;
  for (const broken of armPlans) {
    const key = broken.length ? broken.join('+') : '(intact)';
    let r;
    try {
      r = await spec.measure(broken.slice(), spec.ctx);
    } catch (e) {
      r = { value: null, support: 0, error: String((e && e.message) || e) };
      errored = errored || `${key}: ${r.error}`;
    }
    // `--break=support-optional` restores round 1 exactly: a missing support silently becomes
    // null and every check downstream skips the arm. The self-test must catch that.
    const declared = Number.isFinite(r && r.support);
    const support = declared ? Number(r.support) : null;
    arms.push({
      arm: key,
      broken: broken.slice(),
      value: r ? r.value : null,
      support,
      support_declared: declared || BREAKS.has('support-optional'),
      detail: r && r.detail !== undefined ? r.detail : undefined,
      error: r && r.error ? r.error : undefined,
      canon: canon(r ? r.value : null),
      measured_nothing: measuredNothing(r ? r.value : undefined),
    });
  }

  const intact = arms.find((a) => a.broken.length === 0);
  const allBroken = arms.reduce((best, a) => (a.broken.length > (best ? best.broken.length : -1) ? a : best), null);
  const minSupport = Number.isFinite(spec.minSupport) ? spec.minSupport : 1;
  const supportFloor = Number.isFinite(spec.supportFloor) ? spec.supportFloor : DEFAULT_SUPPORT_FLOOR;

  // ---- shape 5: nothing was measured ---------------------------------------------------------
  // Tested FIRST, on the raw values, because every other verdict below is a statement about a
  // measurement and there is not one here. Round 1 reported this as INERT.
  const armsMeasuredNothing = arms.filter((a) => a.measured_nothing).map((a) => a.arm);
  const nothingMeasured = arms.length > 0 && armsMeasuredNothing.length === arms.length;

  // ---- support accounting (shapes 3 and 4) ---------------------------------------------------
  // `--break=support` disables it, which is exactly the W1-13 hole: 0 vs 0 then reads as a
  // legitimate agreement failure instead of as a measurement with no subject.
  //
  // EVERY arm must have a population, not only the intact one. W1-13's rested arm had 52 people
  // in it and its control had none: the value differed (25 vs 0) and the clause passed, and the
  // difference was between a town and an empty set. `supportArms: 'intact'` narrows this to the
  // intact arm for the rare control whose whole point is that breaking it empties the
  // population; `validateSpec` now requires a `support_note` to say why.
  const undeclared = arms.filter((a) => !a.support_declared).map((a) => a.arm);
  const supportChecked = !BREAKS.has('support');
  const scope = spec.supportArms === 'intact' ? [intact].filter(Boolean) : arms;
  const unsupported = supportChecked
    ? scope.filter((a) => a.support !== null && a.support < minSupport).map((a) => a.arm)
    : [];
  const intactUnsupported = supportChecked && unsupported.length > 0;

  // SHORT_CIRCUIT (round-2 shape 4). The intact arm ranged over a real population and a broken
  // arm ranged over a fraction of it: the teardown removed the units before the comparator saw
  // them, so the difference between the arms is about the removal and not about the mechanism.
  // W1-14-r3 is the case — 55 effects reach readDial() intact, 0 reach it under `--break=nocast`.
  // Narrowing the support scope (which already demands a note) opts out, because that is the
  // declaration that says "this break is SUPPOSED to empty the population".
  const scCheck = supportChecked && !BREAKS.has('short-circuit-blind') && spec.supportArms !== 'intact';
  const iSup = intact && intact.support !== null ? intact.support : null;
  const collapsed = scCheck && iSup !== null && iSup >= minSupport
    ? arms.filter((a) => a.broken.length > 0 && a.support !== null && a.support < iSup * supportFloor)
      .map((a) => ({ arm: a.arm, support: a.support, of: iSup, retained: iSup ? a.support / iSup : null }))
    : [];

  // ---- agreement (shape 1) -------------------------------------------------------------------
  // Round 1 compared the intact arm against the all-broken arm AND NOTHING ELSE, so a control
  // with a demonstrably live factor came back INERT under cancellation — while the same record's
  // `factors_that_move_it_alone` named the live factor and the `why` string said "changed
  // nothing". The honest reading of "the arms agree" is that NO ARM differs from any other.
  //
  // Written through `valuesDiffer` rather than off `distinct.size` so that `--break=comparator`
  // still bites: the comparator is the thing under test.
  const distinct = new Set(arms.map((a) => a.canon));
  const armsAgree = BREAKS.has('two-arm-agreement')
    ? !(intact && allBroken && valuesDiffer(intact.value, allBroken.value))   // round-1 behaviour
    : arms.length > 0 && arms.every((a) => !valuesDiffer(arms[0].value, a.value));

  // ---- per-factor main effects (shape 2) -----------------------------------------------------
  const singletonArms = arms.filter((a) => a.broken.length === 1);
  const effects = singletonArms.map((a) => ({
    factor: a.broken[0],
    moved: intact ? valuesDiffer(intact.value, a.value) : null,
    value: a.value,
    intact_value: intact ? intact.value : null,
  }));
  const movingFactors = effects.filter((e) => e.moved).map((e) => e.factor);
  const inertFactors = effects.filter((e) => e.moved === false).map((e) => e.factor);
  const masked = factors.length >= 2 && !armsAgree && singletonArms.length >= 2 && movingFactors.length === 0;

  // The smallest broken-set that moves the number. Names the mechanism precisely: for the
  // W1-SOULS case it is {identity,boundary} and neither half alone.
  const movers = arms
    .filter((a) => a.broken.length > 0 && intact && valuesDiffer(intact.value, a.value))
    .sort((x, y) => x.broken.length - y.broken.length);
  const minimalMover = movers.length ? movers[0].broken.slice() : null;

  // ---- margin and direction -----------------------------------------------------------------
  // Measured on the arm that CARRIES THE EFFECT. Normally that is the all-broken arm. Under
  // cancellation — factor a moves the number and a+b restores it — the all-broken arm carries no
  // effect at all, and measuring the margin there reported a live 60% guard as UNDERPOWERED.
  const allBrokenMoves = !!(intact && allBroken && allBroken.broken.length > 0 && valuesDiffer(intact.value, allBroken.value));
  const cancellation = !armsAgree && !allBrokenMoves && movers.length > 0;
  const effectArm = allBrokenMoves ? allBroken : (movers[0] || allBroken);
  const marginRes = intact && effectArm ? meetsMargin(intact.value, effectArm.value, spec.margin) : { ok: false };
  const ai = intact ? num(intact.value) : null;
  const ab = effectArm ? num(effectArm.value) : null;
  let directionOk = true, directionObserved = null;
  if (spec.direction && spec.direction !== 'any' && ai !== null && ab !== null) {
    directionObserved = ab < ai ? 'lower' : ab > ai ? 'higher' : 'same';
    directionOk = directionObserved === spec.direction;
  }

  // ---- did the caller say what it counted? ---------------------------------------------------
  const unit = typeof spec.unit === 'string' && spec.unit.trim() ? spec.unit.trim() : null;
  const unitDeclared = !!unit || BREAKS.has('unit-optional');

  // ---- verdict, in order of severity --------------------------------------------------------
  //
  // ORDERING, and what changed in round 2. `MASKED` used to be LAST, so any unmet margin or
  // wrong direction shadowed it — and MASKED is the one verdict that exists to stop an agent
  // deleting a guard in good faith. A masked defect whose joint effect is 5% against a declared
  // 50% margin came back UNDERPOWERED ("your control is weak") instead of MASKED ("you have two
  // guards and each reads inert alone"). Masking is a statement about the STRUCTURE of the
  // effect; margin and direction are statements about its SIZE and SIGN. Structure outranks.
  //
  // Every condition that held is also recorded in `concurrent_failures`, so the collisions the
  // cascade necessarily creates — an empty population that ALSO has agreeing arms, a
  // short-circuit that ALSO leaves the arm empty — are reported rather than swallowed by
  // whichever test happened to run first.
  // `--break=cascade-order` puts MASKED back where round 1 had it — last — so the self-test can
  // watch the one verdict that stops a guard being deleted in good faith vanish behind a margin.
  const maskedOutranksSize = !BREAKS.has('cascade-order');

  const held = [];
  if (nothingMeasured) held.push(VERDICT.NO_MEASUREMENT);
  if (intactUnsupported) held.push(VERDICT.VACUOUS);
  if (collapsed.length) held.push(VERDICT.SHORT_CIRCUIT);
  if (armsAgree) held.push(VERDICT.INERT);
  if (masked) held.push(VERDICT.MASKED);
  if (!directionOk) held.push(VERDICT.WRONG_DIRECTION);
  if (!marginRes.ok && !armsAgree) held.push(VERDICT.UNDERPOWERED);

  let verdict, why, errorKind = null;
  if (errored) {
    verdict = VERDICT.ERROR;
    errorKind = 'arm_threw';
    why = `an arm threw: ${errored}`;
  } else if (nothingMeasured) {
    verdict = VERDICT.NO_MEASUREMENT;
    why = `every arm (${armsMeasuredNothing.join(', ')}) returned null/undefined as its ` +
      `${spec.metric || 'value'}. NOTHING WAS MEASURED. The arms do not "agree" — there is no measurement ` +
      `for them to agree about, and reporting INERT here would be a positive claim that breaking ` +
      `${ids.join(' + ')} changed nothing. A misspelt field name reaches this state, and did: ` +
      `critic-w1-25.mjs hit it on its first run against a real artifact and got INERT out of round 1.`;
  } else if (undeclared.length) {
    verdict = VERDICT.ERROR;
    errorKind = 'support_undeclared';
    why = `arm(s) ${undeclared.join(', ')} returned no finite \`support\`. A control that cannot say what it ` +
      `ranged over is not a control: without it, VACUOUS cannot be told from OK, and round 1's answer to ` +
      `"you told me nothing" was OK. measure() must return { value, support } on every arm, where support ` +
      `is the number of units that REACHED THE COMPARATOR.`;
  } else if (intactUnsupported) {
    verdict = VERDICT.VACUOUS;
    why = `arm(s) ${unsupported.join(', ')} ranged over fewer than ${minSupport} unit(s) ` +
      `(${scope.map((a) => `${a.arm}=${a.support}`).join(', ')}${unit ? `; a unit is ${unit}` : ''}). Whatever these arms did, they did it to an ` +
      `empty set — this is the W1-13 "the control contained zero people" shape, and no difference between ` +
      `an inhabited arm and an empty one is evidence about the mechanism.` +
      (collapsed.length ? ` It is ALSO a SHORT_CIRCUIT: the intact arm reached ${iSup} unit(s) and ` +
        `${collapsed.map((c) => `${c.arm} reached ${c.support}`).join(', ')}.` : '');
  } else if (collapsed.length) {
    verdict = VERDICT.SHORT_CIRCUIT;
    why = `the intact arm's measurement reached ${iSup} unit(s) and ` +
      `${collapsed.map((c) => `${c.arm} reached only ${c.support} (${Math.round((c.retained || 0) * 100)}%)`).join(', ')} ` +
      `— below the declared floor of ${Math.round(supportFloor * 100)}%. The teardown removed the units UPSTREAM of the ` +
      `comparator instead of changing what the comparator computed on them, so however far apart the two ` +
      `values are, the difference is about the removal. This is the W1-14-r3 \`--break=nocast\` shape: all 55 ` +
      `rows exited at NOT_DELIVERED before readDial() was ever called, and the arms differed 33 to 0.`;
  } else if (armsAgree) {
    verdict = VERDICT.INERT;
    why = `no arm produced a different ${spec.metric || 'value'} from any other ` +
      `(${JSON.stringify(intact ? intact.value : null)}, ${arms.length} arm(s)). Breaking ${ids.join(' + ')} changed nothing, ` +
      `so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.`;
  } else if (masked && maskedOutranksSize) {
    verdict = VERDICT.MASKED;
    why = `the number moves only when ALL of ${ids.join(' + ')} are broken; every single-factor arm is ` +
      `byte-identical to intact. There are ${factors.length} guards here where the piece measured one, and each ` +
      `measures inert alone — this is the W1-SOULS "delete either and the number stays green" shape. The next ` +
      `agent deletes one in good faith.` +
      (!marginRes.ok ? ` (The joint effect is also under the declared margin of ${marginRes.want}; round 1 reported ` +
        `that instead, and "your control is weak" is not the finding that stops the deletion.)` : '');
  } else if (!directionOk) {
    verdict = VERDICT.WRONG_DIRECTION;
    why = `breaking it moved the number ${directionObserved}, and the control declared ${spec.direction}.`;
  } else if (!marginRes.ok) {
    verdict = VERDICT.UNDERPOWERED;
    why = `the arms differ but by ${marginRes.observed === null ? 'an unquantifiable amount' : marginRes.observed}` +
      `, under the declared margin of ${marginRes.want}.`;
  } else if (masked) {
    // Only reachable with `--break=cascade-order`, which restores round 1's ordering so the
    // self-test can watch MASKED disappear behind an unmet margin. Never taken in normal running.
    verdict = VERDICT.MASKED;
    why = `masked, reported from round 1's position at the bottom of the cascade (--break=cascade-order).`;
  } else if (!unitDeclared) {
    verdict = VERDICT.ERROR;
    errorKind = 'support_unit_undeclared';
    why = `this control would have passed, and it never said what one unit of \`support\` is. Declare ` +
      `\`unit\` — "magic effects that reached readDial()", "walks attempted", "NPCs on the roster". ` +
      `W1-14-r3's control reads OK when its 55 means "effects examined" and VACUOUS when it means "effects ` +
      `delivered", off the same two files, and NO RULE OVER THE NUMBERS CAN SEPARATE THEM: {33,55} vs {0,55} ` +
      `is the same shape as a perfect control. So the facility declines to pass a control that never stated ` +
      `the claim. This check is last in the cascade and can only ever withhold a pass, never hide a defect.`;
  } else {
    verdict = VERDICT.OK;
    why = `breaking ${minimalMover ? minimalMover.join(' + ') : ids.join(' + ')} moved ` +
      `${spec.metric || 'the value'} from ${JSON.stringify(intact.value)} to ${JSON.stringify(effectArm.value)}` +
      (marginRes.observed !== null ? ` (${marginRes.observed} vs required ${marginRes.want})` : '') +
      `, over ${iSup} ${unit || 'unit(s)'}.` +
      (cancellation ? ` NOTE: the all-broken arm carries no effect — breaking ${minimalMover.join(' + ')} moves the ` +
        `number and breaking everything restores it. The factors CANCEL, so the evidence is in the ` +
        `${minimalMover.join('+')} arm and not in the headline comparison. Round 1 compared intact against ` +
        `all-broken alone and called this INERT.` : '');
  }

  const result = {
    id: spec.id,
    what: spec.what || null,
    metric: spec.metric || null,
    unit,
    verdict,
    passed: verdict === VERDICT.OK,
    why,
    error_kind: errorKind,
    concurrent_failures: held,
    arms_agree: armsAgree,
    nothing_measured: nothingMeasured,
    arms_measuring_nothing: armsMeasuredNothing,
    factors: factors.map((f) => ({ id: f.id, what: f.what || null })),
    arms,
    distinct_values: distinct.size,
    intact_value: intact ? intact.value : null,
    broken_value: allBroken ? allBroken.value : null,
    effect_arm: effectArm ? effectArm.arm : null,
    cancellation,
    intact_support: intact ? intact.support : null,
    arms_without_support: undeclared,
    unsupported_arms: unsupported,
    support_collapse: collapsed,
    support_floor: supportFloor,
    support_scope: spec.supportArms === 'intact' ? 'intact' : 'all',
    support_note: spec.support_note || null,
    min_support: minSupport,
    factor_effects: effects,
    factors_that_move_it_alone: movingFactors,
    factors_inert_alone: inertFactors,
    minimal_breaking_set: minimalMover,
    redundant_guards: masked ? ids.slice() : [],
    margin: spec.margin || { kind: 'differs' },
    margin_observed: marginRes.observed,
    margin_met: !!marginRes.ok,
    direction: spec.direction || 'any',
    direction_observed: directionObserved,
    facility_breaks: facilityBreaks(),
    ms: Date.now() - t0,
  };

  if (spec.expect) {
    result.expected_verdict = spec.expect;
    result.as_expected = verdict === spec.expect;
  }
  return result;
}

/**
 * Run a list of controls and roll them up.
 *
 * `as_expected` is what a REPLAY of a historically broken instrument is scored on: a case that
 * declares `expect: 'INERT'` passes the suite by going red, and the suite fails if it goes green.
 * A case with no `expect` must reach OK.
 *
 * A `SpecError` from one control is recorded as that control's failure rather than allowed to
 * take the whole suite down — one malformed spec must not delete thirty-nine measurements.
 */
export async function runSuite(specs, { onResult } = {}) {
  const results = [];
  for (const s of specs) {
    let r;
    try {
      r = await runControl(s);
    } catch (e) {
      if (!(e instanceof SpecError)) throw e;
      r = {
        id: s.id, what: s.what || null, metric: s.metric || null, unit: null,
        verdict: VERDICT.ERROR, passed: false, why: String(e.message), error_kind: 'spec_error',
        concurrent_failures: [VERDICT.ERROR], arms: [], arms_agree: null, spec_error: true,
      };
      if (s.expect) { r.expected_verdict = s.expect; r.as_expected = s.expect === VERDICT.ERROR; }
    }
    if (onResult) onResult(r);
    results.push(r);
  }
  const judged = results.map((r) => ({
    id: r.id,
    verdict: r.verdict,
    expected: r.expected_verdict || VERDICT.OK,
    ok: r.expected_verdict ? r.as_expected : r.passed,
  }));
  const failures = judged.filter((j) => !j.ok);
  const firstBad = results.find((r) => (r.expected_verdict ? !r.as_expected : !r.passed));
  return {
    results,
    judged,
    n: results.length,
    failures: failures.map((f) => `${f.id}: got ${f.verdict}, wanted ${f.expected}`),
    ok: failures.length === 0,
    exit: failures.length === 0 ? 0 : (EXIT_FOR[firstBad ? firstBad.verdict : ''] || 1),
  };
}

/**
 * Render a suite as a table a human reads in five seconds. Deliberately plain text: this ends up
 * in `tools/run.mjs` output and in status files.
 */
export function formatSuite(suite) {
  const lines = [];
  for (const r of suite.results) {
    const want = r.expected_verdict || 'OK';
    const ok = r.expected_verdict ? r.as_expected : r.passed;
    lines.push(`${ok ? 'ok  ' : 'FAIL'}  ${r.id.padEnd(34)} ${r.verdict.padEnd(16)} (wanted ${want})`);
    lines.push(`      ${r.why}`);
    if (r.concurrent_failures && r.concurrent_failures.length > 1) {
      lines.push(`      ALSO HELD: ${r.concurrent_failures.filter((v) => v !== r.verdict).join(', ')}`);
    }
    for (const a of (r.arms || [])) {
      lines.push(`        ${a.arm.padEnd(30)} value=${JSON.stringify(a.value)}  support=${a.support}` +
        (a.error ? `  ERROR ${a.error}` : ''));
    }
  }
  lines.push(`${suite.ok ? 'PASS' : 'FAIL'}  ${suite.n - suite.failures.length}/${suite.n} controls behaved as declared.`);
  for (const f of suite.failures) lines.push(`  ! ${f}`);
  return lines.join('\n');
}
