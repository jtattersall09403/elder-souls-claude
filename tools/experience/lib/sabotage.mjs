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
// Those are three DIFFERENT failures and a naive "did A and B differ?" check catches exactly one
// of them. This module catches all three, and it is the same code path in every case:
//
//   INERT       the fully-broken arm equals the intact arm. The break did nothing.
//   MASKED      the fully-broken arm differs, but no single factor moves it at all. There are
//               k guards where the piece measured one, and each one measures inert alone.
//   VACUOUS     the INTACT arm has no support — the measurement ranged over zero units, so
//               "the arms agree" is a statement about an empty set and not about the build.
//
// plus UNDERPOWERED (differs, below the declared margin) and WRONG_DIRECTION.
//
// THE CONTRACT, in one line: **a control FAILS when its arms agree.** `passed` is false for
// every verdict except OK, and the CLI's exit code carries the reason.
//
// WHAT MAKES THIS DIFFERENT FROM WRITING THE SAME CHECK FOUR MORE TIMES. A caller supplies two
// things and nothing else: a way to MEASURE, and a list of FACTORS it can break. The factorial
// enumeration, the support accounting, the agreement test, the masking analysis and the
// verdict are here, once. `tools/composition/matrix-probe.mjs` and
// `tools/experience/breakage-probe.mjs` in this same piece are both callers, and neither one
// re-implements "did the arms differ".
//
// RULES.md #4: this module's own falsifier is `tools/experience/sabotage.mjs --self-test`, which
// runs six synthetic cases with known verdicts AND re-runs them with this module's comparator
// deliberately broken (`--break=comparator|support|factorial`), requiring the suite to go red.
// An instrument that cannot be made to fail is not an instrument.
'use strict';

export const VERDICT = {
  OK: 'OK',
  INERT: 'INERT',
  MASKED: 'MASKED',
  VACUOUS: 'VACUOUS',
  UNDERPOWERED: 'UNDERPOWERED',
  WRONG_DIRECTION: 'WRONG_DIRECTION',
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
};

/**
 * Deliberate defects, injected by `--self-test --break=<id>`, so the suite can be shown going
 * red. Nothing in normal operation sets these; `assertUnbroken()` refuses to produce a verdict
 * while one is set unless the caller opted in.
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
// The control itself.

/**
 * Run a sabotage control.
 *
 * @param {object} spec
 * @param {string} spec.id           short id, used in reports
 * @param {string} spec.what         one sentence: what is being measured
 * @param {string} [spec.metric]     the name of the number
 * @param {Array<{id:string,what:string}>} spec.factors   the things that can be broken (>= 1)
 * @param {function} spec.measure    async (brokenIds:string[], ctx) =>
 *                                     { value, support, detail? }
 *                                   `support` is THE NUMBER OF UNITS THE MEASUREMENT RANGED
 *                                   OVER — bodies in the fight, walks attempted, NPCs in the
 *                                   roster. It is not the value. A measurement over zero units
 *                                   is VACUOUS however tidy its value looks.
 * @param {object} [spec.margin]     see meetsMargin; default {kind:'differs'}
 * @param {'lower'|'higher'|'any'} [spec.direction]  which way breaking it should move the number
 * @param {number} [spec.minSupport] default 1
 * @param {string} [spec.expect]     a VERDICT this case is expected to produce (used when
 *                                   replaying a historically broken instrument: the broken one
 *                                   is EXPECTED to be INERT, and a run where it is not is the
 *                                   failure).
 * @param {boolean} [spec.full]      full factorial (default true, capped at k=4)
 * @param {object} [spec.ctx]        passed through to measure()
 */
export async function runControl(spec) {
  const t0 = Date.now();
  const factors = (spec.factors || []).map((f) => (typeof f === 'string' ? { id: f, what: f } : f));
  if (!factors.length) throw new Error(`sabotage(${spec.id}): a control with no factors is not a control`);
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
    const support = Number.isFinite(r && r.support) ? Number(r.support) : null;
    arms.push({
      arm: key,
      broken: broken.slice(),
      value: r ? r.value : null,
      support,
      detail: r && r.detail !== undefined ? r.detail : undefined,
      error: r && r.error ? r.error : undefined,
      canon: canon(r ? r.value : null),
    });
  }

  const intact = arms.find((a) => a.broken.length === 0);
  const allBroken = arms.reduce((best, a) => (a.broken.length > (best ? best.broken.length : -1) ? a : best), null);
  const minSupport = Number.isFinite(spec.minSupport) ? spec.minSupport : 1;

  // ---- support accounting (case 3) ----------------------------------------------------------
  // `--break=support` disables it, which is exactly the W1-13 hole: 0 vs 0 then reads as a
  // legitimate agreement failure instead of as a measurement with no subject.
  const supportChecked = !BREAKS.has('support');
  const unsupported = supportChecked
    ? arms.filter((a) => a.support !== null && a.support < minSupport).map((a) => a.arm)
    : [];
  const intactUnsupported = supportChecked && intact && intact.support !== null && intact.support < minSupport;

  // ---- agreement (case 1) -------------------------------------------------------------------
  const distinct = new Set(arms.map((a) => a.canon));
  const armsAgree = !(intact && allBroken && valuesDiffer(intact.value, allBroken.value));

  // ---- per-factor main effects (case 2) -----------------------------------------------------
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
  const marginRes = intact && allBroken ? meetsMargin(intact.value, allBroken.value, spec.margin) : { ok: false };
  const ai = intact ? num(intact.value) : null;
  const ab = allBroken ? num(allBroken.value) : null;
  let directionOk = true, directionObserved = null;
  if (spec.direction && spec.direction !== 'any' && ai !== null && ab !== null) {
    directionObserved = ab < ai ? 'lower' : ab > ai ? 'higher' : 'same';
    directionOk = directionObserved === spec.direction;
  }

  // ---- verdict, in order of severity --------------------------------------------------------
  let verdict, why;
  if (errored) {
    verdict = VERDICT.ERROR;
    why = `an arm threw: ${errored}`;
  } else if (intactUnsupported) {
    verdict = VERDICT.VACUOUS;
    why = `the intact arm ranged over ${intact.support} unit(s) (minimum ${minSupport}). ` +
      `Whatever the arms did, they did it to an empty set — this is the W1-13 "roster {} in every arm" shape.`;
  } else if (armsAgree) {
    verdict = VERDICT.INERT;
    why = `the fully-broken arm produced the same ${spec.metric || 'value'} as the intact arm ` +
      `(${JSON.stringify(intact ? intact.value : null)}). Breaking ${ids.join(' + ')} changed nothing, ` +
      `so this control never measured the thing it names — this is the W1-04 "both arms were the walls-on arm" shape.`;
  } else if (!directionOk) {
    verdict = VERDICT.WRONG_DIRECTION;
    why = `breaking it moved the number ${directionObserved}, and the control declared ${spec.direction}.`;
  } else if (!marginRes.ok) {
    verdict = VERDICT.UNDERPOWERED;
    why = `the arms differ but by ${marginRes.observed === null ? 'an unquantifiable amount' : marginRes.observed}` +
      `, under the declared margin of ${marginRes.want}.`;
  } else if (masked) {
    verdict = VERDICT.MASKED;
    why = `the number moves only when ALL of ${ids.join(' + ')} are broken; every single-factor arm is ` +
      `byte-identical to intact. There are ${factors.length} guards here where the piece measured one, and each ` +
      `measures inert alone — this is the W1-SOULS "delete either and the number stays green" shape. The next ` +
      `agent deletes one in good faith.`;
  } else {
    verdict = VERDICT.OK;
    why = `breaking ${minimalMover ? minimalMover.join(' + ') : ids.join(' + ')} moved ` +
      `${spec.metric || 'the value'} from ${JSON.stringify(intact.value)} to ${JSON.stringify(allBroken.value)}` +
      (marginRes.observed !== null ? ` (${marginRes.observed} vs required ${marginRes.want})` : '') + '.';
  }

  const result = {
    id: spec.id,
    what: spec.what || null,
    metric: spec.metric || null,
    verdict,
    passed: verdict === VERDICT.OK,
    why,
    arms_agree: armsAgree,
    factors: factors.map((f) => ({ id: f.id, what: f.what || null })),
    arms,
    distinct_values: distinct.size,
    intact_value: intact ? intact.value : null,
    broken_value: allBroken ? allBroken.value : null,
    intact_support: intact ? intact.support : null,
    unsupported_arms: unsupported,
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
 */
export async function runSuite(specs, { onResult } = {}) {
  const results = [];
  for (const s of specs) {
    const r = await runControl(s);
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
  return {
    results,
    judged,
    n: results.length,
    failures: failures.map((f) => `${f.id}: got ${f.verdict}, wanted ${f.expected}`),
    ok: failures.length === 0,
    exit: failures.length === 0 ? 0 : (EXIT_FOR[results.find((r) => (r.expected_verdict ? !r.as_expected : !r.passed)).verdict] || 1),
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
    for (const a of r.arms) {
      lines.push(`        ${a.arm.padEnd(30)} value=${JSON.stringify(a.value)}  support=${a.support}` +
        (a.error ? `  ERROR ${a.error}` : ''));
    }
  }
  lines.push(`${suite.ok ? 'PASS' : 'FAIL'}  ${suite.n - suite.failures.length}/${suite.n} controls behaved as declared.`);
  for (const f of suite.failures) lines.push(`  ! ${f}`);
  return lines.join('\n');
}
