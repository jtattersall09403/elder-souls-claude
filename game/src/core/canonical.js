// Canonical serialisation — RI-JRN05 §C, binding.
//
//  1. Object keys sorted lexicographically at every depth.
//  2. Arrays whose order is semantic keep it; arrays whose order is incidental are sorted
//     by stable id BEFORE they reach here (the save builder does that, not this file —
//     see save/state.js). This file never reorders an array, because it cannot know which
//     kind it is looking at.
//  3. Integers stay integers; other numbers are rounded to 6 decimal places (= 1 µm).
//  4. undefined / NaN / Infinity / functions / non-toJSON class instances are DEFECTS and
//     throw here rather than serialising to something plausible.
'use strict';

export class CanonicalError extends Error {}

function roundFloat(n) {
  if (Number.isInteger(n)) return n;
  // 6 dp, and normalise -0 to 0 so a sign flip does not show up as a diff.
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

function walk(v, path, out) {
  const t = typeof v;
  if (v === null) { out.push('null'); return; }
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new CanonicalError(`non-finite number at ${path}: ${v}`);
    out.push(JSON.stringify(roundFloat(v)));
    return;
  }
  if (t === 'boolean') { out.push(v ? 'true' : 'false'); return; }
  if (t === 'string') { out.push(JSON.stringify(v)); return; }
  if (t === 'undefined') throw new CanonicalError(`undefined at ${path} — state lives in a closure or a field was forgotten`);
  if (t === 'function') throw new CanonicalError(`function at ${path} — state must be data`);
  if (t === 'bigint' || t === 'symbol') throw new CanonicalError(`${t} at ${path} is not serialisable`);
  if (Array.isArray(v)) {
    out.push('[');
    for (let i = 0; i < v.length; i++) { if (i) out.push(','); walk(v[i], `${path}[${i}]`, out); }
    out.push(']');
    return;
  }
  // Plain objects only. A class instance without toJSON means state lives somewhere the
  // save cannot see, which is exactly the bug RI-JRN05 rule 4 is about.
  if (typeof v.toJSON === 'function') { walk(v.toJSON(), path, out); return; }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalError(`class instance (${v.constructor && v.constructor.name}) at ${path} without toJSON()`);
  }
  const keys = Object.keys(v).sort();
  out.push('{');
  for (let i = 0; i < keys.length; i++) {
    if (i) out.push(',');
    out.push(JSON.stringify(keys[i]), ':');
    walk(v[keys[i]], path ? `${path}.${keys[i]}` : keys[i], out);
  }
  out.push('}');
}

/** @returns {string} the canonical JSON text. Deterministic for structurally equal input. */
export function canonicalise(value) {
  const out = [];
  walk(value, '', out);
  return out.join('');
}

/** Every leaf path in a canonicalised object, for the manifest set-difference (M4). */
export function leafPaths(value, prefix = '', acc = []) {
  if (value === null || typeof value !== 'object') { acc.push(prefix); return acc; }
  if (Array.isArray(value)) { acc.push(prefix + '[]'); return acc; }
  for (const k of Object.keys(value).sort()) leafPaths(value[k], prefix ? `${prefix}.${k}` : k, acc);
  return acc;
}

/** Field-level diff between two canonicalisable objects, ignoring a declared volatile set. */
export function stateDiff(a, b, volatile = []) {
  const vol = new Set(volatile);
  const diff = [];
  const seen = new Set();
  const rec = (x, y, p) => {
    if (vol.has(p)) return;
    const bothObj = x && y && typeof x === 'object' && typeof y === 'object'
      && !Array.isArray(x) && !Array.isArray(y);
    if (bothObj) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)]).values()) {
        rec(x[k], y[k], p ? `${p}.${k}` : k);
      }
      return;
    }
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
      for (let i = 0; i < x.length; i++) rec(x[i], y[i], `${p}[${i}]`);
      return;
    }
    if (seen.has(p)) return;
    let ca, cb;
    try { ca = canonicalise(x === undefined ? null : x); } catch (e) { ca = 'ERR:' + e.message; }
    try { cb = canonicalise(y === undefined ? null : y); } catch (e) { cb = 'ERR:' + e.message; }
    if (ca !== cb) { seen.add(p); diff.push({ path: p, a: ca.slice(0, 300), b: cb.slice(0, 300) }); }
  };
  rec(a, b, '');
  return diff;
}
