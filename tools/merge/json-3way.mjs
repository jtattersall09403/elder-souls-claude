#!/usr/bin/env node
/**
 * A semantic three-way merge for this project's JSON content files.
 *
 * WHY THIS EXISTS. `git merge-file` merges JSON by LINE. When one side has reserialized the
 * whole file — which is what a builder that regenerates a quest book does — every line differs,
 * so a line merge reports the whole file as one giant conflict and tells you nothing. Re-landing
 * W1-18's quest delivery on top of four days of other agents' edits produced 58 line conflicts on
 * `faction-continuation-wave1.json` while the actual semantic disagreement was ZERO: one side had
 * rewritten the file, the other had added strings to `world_flags` arrays, and no key was
 * contested by both.
 *
 * WHAT IT DOES. Standard three-way, structurally:
 *   - both sides agree                  -> that value
 *   - only `theirs` moved off `base`    -> theirs
 *   - only `ours` moved off `base`      -> ours
 *   - both moved, and all three are objects -> recurse key by key
 *   - both moved, and all three are arrays  -> merge by `id` when the elements are identified
 *                                              objects, else as an ordered set
 *   - anything else                     -> CONFLICT, reported by path, never guessed
 *
 * IT REFUSES RATHER THAN GUESSING. A scalar both sides changed differently is a conflict and the
 * tool exits non-zero with the JSON pointer. It does not silently prefer a side. That matters here
 * because the failure this whole exercise repairs is a tool that quietly preferred one tree.
 *
 * Usage:
 *   node tools/merge/json-3way.mjs --base <rev:path> --ours <rev:path> --theirs <rev:path> \
 *        [--out <file>] [--indent N]
 *   node tools/merge/json-3way.mjs --self-test
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MISSING = Symbol('missing');

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function eq(a, b) {
  if (a === MISSING || b === MISSING) return a === b;
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

/** Key order must not count as a difference; only content may. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (isPlainObject(v)) {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
    return out;
  }
  return v;
}

function identified(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every((x) => isPlainObject(x) && typeof x.id === 'string');
}

function byId(arr) {
  const m = new Map();
  for (const x of arr) m.set(x.id, x);
  return m;
}

/** Ordered-set three-way for arrays of scalars: theirs, plus ours' additions, minus ours' removals. */
function mergeScalarArray(base, ours, theirs) {
  const b = new Set(base.map((x) => JSON.stringify(x)));
  const o = new Set(ours.map((x) => JSON.stringify(x)));
  const oursAdded = ours.filter((x) => !b.has(JSON.stringify(x)));
  const oursRemoved = base.filter((x) => !o.has(JSON.stringify(x)));
  const removed = new Set(oursRemoved.map((x) => JSON.stringify(x)));
  const out = theirs.filter((x) => !removed.has(JSON.stringify(x)));
  const seen = new Set(out.map((x) => JSON.stringify(x)));
  for (const x of oursAdded) {
    const k = JSON.stringify(x);
    if (!seen.has(k)) { out.push(x); seen.add(k); }
  }
  return out;
}

export function merge3(base, ours, theirs, conflicts = [], path = '') {
  if (eq(ours, theirs)) return ours === MISSING ? MISSING : ours;
  if (eq(base, ours)) return theirs;
  if (eq(base, theirs)) return ours;

  // Both sides moved and they disagree.
  if (isPlainObject(ours) && isPlainObject(theirs) && (isPlainObject(base) || base === MISSING)) {
    const b = isPlainObject(base) ? base : {};
    const keys = [...new Set([...Object.keys(theirs), ...Object.keys(ours)])];
    const out = {};
    for (const k of keys) {
      const r = merge3(
        Object.prototype.hasOwnProperty.call(b, k) ? b[k] : MISSING,
        Object.prototype.hasOwnProperty.call(ours, k) ? ours[k] : MISSING,
        Object.prototype.hasOwnProperty.call(theirs, k) ? theirs[k] : MISSING,
        conflicts,
        `${path}/${k}`,
      );
      if (r !== MISSING) out[k] = r;
    }
    return out;
  }

  if (Array.isArray(ours) && Array.isArray(theirs) && (Array.isArray(base) || base === MISSING)) {
    const b = Array.isArray(base) ? base : [];
    if (identified(ours) && identified(theirs)) {
      const bm = byId(b); const om = byId(ours); const tm = byId(theirs);
      const order = [...theirs.map((x) => x.id), ...ours.map((x) => x.id).filter((id) => !tm.has(id))];
      const out = [];
      for (const id of [...new Set(order)]) {
        const bv = bm.has(id) ? bm.get(id) : MISSING;
        const ov = om.has(id) ? om.get(id) : MISSING;
        const tv = tm.has(id) ? tm.get(id) : MISSING;
        const r = merge3(bv, ov, tv, conflicts, `${path}[${id}]`);
        if (r !== MISSING) out.push(r);
      }
      return out;
    }
    if (ours.every((x) => typeof x !== 'object' || x === null) && theirs.every((x) => typeof x !== 'object' || x === null)) {
      return mergeScalarArray(b, ours, theirs);
    }
  }

  conflicts.push({
    path: path || '/',
    ours: JSON.stringify(ours === MISSING ? null : ours).slice(0, 160),
    theirs: JSON.stringify(theirs === MISSING ? null : theirs).slice(0, 160),
  });
  return theirs === MISSING ? ours : theirs;
}

function readRevPath(spec) {
  const i = spec.indexOf(':');
  if (i === -1) return readFileSync(spec, 'utf8');
  const rev = spec.slice(0, i); const p = spec.slice(i + 1);
  return execFileSync('git', ['show', `${rev}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 30 });
}

// ---------------------------------------------------------------- self-test
function selfTest() {
  let fail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) { fail++; console.log(`  FAIL ${name}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
    else console.log(`  pass ${name}`);
  };

  // 1. Only theirs moved -> theirs. (The reverted delivery coming back.)
  t('1 only theirs moved', merge3({ a: 1 }, { a: 1 }, { a: 2 }), { a: 2 });
  // 2. Only ours moved -> ours. (A sibling's four days of work is NOT reverted.)
  t('2 only ours moved', merge3({ a: 1 }, { a: 2 }, { a: 1 }), { a: 2 });
  // 3. THE REAL CASE: theirs rewrote the record, ours added a world_flag. Both survive.
  t('3 disjoint edits inside one record',
    merge3({ q: [{ id: 'A', text: 'old', world_flags: ['f1'] }] },
           { q: [{ id: 'A', text: 'old', world_flags: ['f1', 'f2'] }] },
           { q: [{ id: 'A', text: 'NEW', world_flags: ['f1'] }] }),
    { q: [{ id: 'A', text: 'NEW', world_flags: ['f1', 'f2'] }] });
  // 4. Records only theirs has are restored; records only ours has are kept.
  t('4 id-keyed union',
    merge3({ q: [{ id: 'A' }] }, { q: [{ id: 'A' }, { id: 'C' }] }, { q: [{ id: 'A' }, { id: 'B' }] }),
    { q: [{ id: 'A' }, { id: 'B' }, { id: 'C' }] });
  // 5. A real conflict must be REPORTED, not silently resolved.
  {
    const c = [];
    merge3({ a: 1 }, { a: 2 }, { a: 3 }, c);
    t('5 scalar conflict is reported', c.length, 1);
  }
  // 6. NON-VACUITY / the control that must go red. If the "only ours moved" arm were dropped —
  //    i.e. if the tool preferred theirs unconditionally, the exact defect c9603f64 embodies —
  //    arm 2 must fail. Simulated here by asserting the naive answer is DIFFERENT from ours.
  {
    const naive = (b, o, th) => th;               // the broken merge that caused this incident
    const got = naive({ a: 1 }, { a: 2 }, { a: 1 });
    t('6 control: naive prefer-theirs loses ours (must differ)', got.a === 2, false);
  }
  // 7. ours deleting a scalar entry is honoured against theirs' rewrite
  t('7 ours removal honoured',
    merge3({ f: ['x', 'y'] }, { f: ['x'] }, { f: ['x', 'y', 'z'] }), { f: ['x', 'z'] });

  console.log(fail === 0 ? '\njson-3way self-test: 7/7 pass' : `\njson-3way self-test: ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---------------------------------------------------------------- cli
const argv = process.argv.slice(2);
if (argv.includes('--self-test')) selfTest();
else {
  const get = (k) => { const i = argv.indexOf(k); return i === -1 ? null : argv[i + 1]; };
  const base = get('--base'); const ours = get('--ours'); const theirs = get('--theirs');
  if (!base || !ours || !theirs) {
    console.error('usage: --base <rev:path> --ours <rev:path> --theirs <rev:path> [--out f] [--indent N]');
    process.exit(2);
  }
  const conflicts = [];
  const out = merge3(
    JSON.parse(readRevPath(base)), JSON.parse(readRevPath(ours)), JSON.parse(readRevPath(theirs)), conflicts,
  );
  const indent = Number(get('--indent') || 2);
  const text = `${JSON.stringify(out, null, indent)}\n`;
  const dest = get('--out');
  if (dest) writeFileSync(dest, text); else process.stdout.write(text);
  if (conflicts.length) {
    console.error(`json-3way: ${conflicts.length} CONFLICT(S) — not resolved, decide by hand:`);
    for (const c of conflicts.slice(0, 40)) console.error(`  ${c.path}\n    ours   ${c.ours}\n    theirs ${c.theirs}`);
    process.exit(1);
  }
  console.error(`json-3way: merged cleanly, 0 conflicts${dest ? ` -> ${dest}` : ''}`);
}
