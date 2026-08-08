// graded.mjs — A CHECK WITH AN EMPTY SAMPLE SET MUST REPORT `EMPTY`, NEVER `PASS`.
//
// Written by W1-21 round 3. The W1-21 round-2 verdict §2 tabulated every graded check this piece
// ships and found **eleven of fifteen return PASS on an empty sample set** — three of them by
// construction, on absence:
//
//   FD7   `gradient_bits === null || gradient_bits >= 7`   passes when nothing was measured
//   FD6   `edgeFringe()` returns `{worst: 0}` on zero edge pixels, and `0 <= 40`
//   K4    a bare `catch { continue }` drops a whole sweep position and grades the rest
//
// and one — `ui-forbidden`'s U4 — which "records no sample count at all: a run that opened five
// menus and a run that opened none produce byte-identical output". That is the round-1 defect
// this piece was already failed for, one level down: round 1's grader filtered the unmeasurable
// screens out and reported `PASS over N screens`; round 2 fixed that one check and left the
// shape everywhere else.
//
// THE MECHANISM, and it is deliberately small.
//
// `push(id, what, { samples, sample_of, expected, pass, detail })` and there is no way to spell a
// check that does not declare what it counted:
//
//   * `samples` is REQUIRED. Omitting it throws at grade time rather than defaulting to
//     something — a default is how the missing sample count got shipped in the first place.
//   * `samples === 0` yields status `EMPTY`. **The predicate is never called.** `pass` is passed
//     as a thunk precisely so that a grader cannot accidentally evaluate `[].every(...) === true`
//     over nothing. This is the "refuse to grade a check that measured nothing" clause, held by
//     construction rather than by everyone remembering.
//   * `expected` is optional and covers the other half: a run that measured 9 of 10 declared
//     viewpoints has samples > 0 and is still not a full measurement. That is `PARTIAL`, and it
//     is not a pass either.
//   * `EMPTY` and `PARTIAL` are `pass: false` everywhere they are read, so a tool that already
//     said `checks.every(c => c.pass)` gets the right answer without being rewritten.
//
// EXIT CODES. Every tool in this set documents `0 = pass · 1 = fail · 2 = could not measure`, and
// that vocabulary already had the right word in it: a check that sampled nothing did not fail,
// it did not run. `exitCode()` returns 1 if anything FAILed, else 2 if anything is EMPTY or
// PARTIAL, else 0. A green exit now means every check both ran and passed.

export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const EMPTY = 'EMPTY';
export const PARTIAL = 'PARTIAL';

/** True only for a check that both sampled something and passed. */
export const isPass = (c) => c.status === PASS;
/** True for a check that could not be graded at all — no samples, or fewer than it declared. */
export const isUngraded = (c) => c.status === EMPTY || c.status === PARTIAL;

/**
 * One graded check.
 *
 * @param {string} id            the check's id in its item (FD6, K4, U4 ...)
 * @param {string} what          the clause, in the item's words
 * @param {object} spec
 * @param {number} spec.samples  HOW MANY THINGS WERE LOOKED AT. Required.
 * @param {string} spec.sample_of  what one sample IS ("captures", "viewpoints", "enemy regions")
 * @param {number} [spec.expected] how many there should have been, when that is knowable
 * @param {boolean|function} spec.pass  the predicate. A function is only called when samples > 0.
 * @param {string} [spec.detail] the numbers, for a human
 * @param {object} [spec.counts] sub-counts, for the published sample table
 */
export function gradeCheck(id, what, spec) {
  if (!spec || typeof spec !== 'object') throw new Error(`graded: ${id} has no spec`);
  const { samples, sample_of, expected, pass, detail, counts } = spec;
  if (typeof samples !== 'number' || !Number.isFinite(samples) || samples < 0) {
    throw new Error(`graded: ${id} must declare a finite non-negative \`samples\` — got ${JSON.stringify(samples)}`);
  }
  if (!sample_of) throw new Error(`graded: ${id} must say what a sample IS (\`sample_of\`)`);

  let status, ok;
  if (samples === 0) {
    // The predicate is deliberately NOT evaluated. This is the whole point of the module.
    status = EMPTY; ok = false;
  } else if (typeof expected === 'number' && samples < expected) {
    status = PARTIAL; ok = false;
  } else {
    ok = typeof pass === 'function' ? !!pass() : !!pass;
    status = ok ? PASS : FAIL;
  }
  const rec = {
    id, what, status, pass: ok,
    samples, sample_of,
    detail: detail === undefined ? null : detail,
  };
  if (typeof expected === 'number') rec.expected = expected;
  if (counts) rec.counts = counts;
  if (status === EMPTY) {
    rec.detail = `NOT GRADED — 0 ${sample_of} sampled. ` + (rec.detail || '');
  } else if (status === PARTIAL) {
    rec.detail = `NOT GRADED — ${samples} of ${expected} ${sample_of} sampled. ` + (rec.detail || '');
  }
  return rec;
}

/** A little collector, so a tool's grading section reads the way it did before. */
export function grader() {
  const checks = [];
  const push = (id, what, spec) => { checks.push(gradeCheck(id, what, spec)); return checks[checks.length - 1]; };
  return {
    checks,
    push,
    get ok() { return checks.length > 0 && checks.every(isPass); },
    get exit() { return exitCode(checks); },
    get native() { return `${checks.filter(isPass).length}/${checks.length}`; },
    lines() { return checks.map(line); },
  };
}

/** 1 = something failed · 2 = something could not be measured · 0 = everything ran and passed. */
export function exitCode(checks) {
  if (!checks.length) return 2;
  if (checks.some((c) => c.status === FAIL)) return 1;
  if (checks.some(isUngraded)) return 2;
  return 0;
}

/** One printable line, with the sample count always visible. */
export function line(c) {
  const n = `${c.samples}${typeof c.expected === 'number' && c.expected !== c.samples ? `/${c.expected}` : ''} ${c.sample_of}`;
  return `  ${c.status.padEnd(7)} ${c.id} ${c.what} — [n=${n}] ${c.detail || ''}`;
}

/** The sample table the round-3 brief asks be published, as markdown rows. */
export function sampleTable(checks, opts = {}) {
  const rows = [
    `| ${opts.tool ? 'Tool | ' : ''}Check | Status | Samples | One sample is | Detail |`,
    `|${opts.tool ? '---|' : ''}---|---|---|---|---|`,
  ];
  for (const c of checks) {
    const n = `${c.samples}${typeof c.expected === 'number' ? ` of ${c.expected}` : ''}`;
    rows.push(`| ${opts.tool ? `\`${opts.tool}\` | ` : ''}${c.id} | **${c.status}** | ${n} | ${c.sample_of} | ${String(c.detail || '').replace(/\|/g, '\\|').slice(0, 160)} |`);
  }
  return rows.join('\n');
}
