// md.mjs — read the corpus's own markdown tables into machine-readable specs.
//
// Four phantom tools are the same shape: `beats-from-md.mjs`, `classes-from-md.mjs`,
// `builds-from-md.mjs`, `probes-from-md.mjs`. Each takes a reference item, finds a table in it,
// and emits the machine-readable form the item's other methods consume. RI-EXP01 says why they
// must exist at all:
//
//   "`RI-EXP01.beats.json` is the machine-readable §D table and is GENERATED FROM THIS FILE by
//    `tools/experience/beats-from-md.mjs` SO THE TWO CANNOT DRIFT."
//
// That is the whole point and it constrains the implementation: the generator must read the
// prose item, never a hand-maintained copy, and it must fail loudly when the table's shape
// changes rather than silently emitting fewer rows. A generator that quietly drops a row it
// could not parse re-introduces exactly the drift it exists to prevent.
'use strict';

import fs from 'node:fs';

/** Split a markdown table row into cells, honouring escaped pipes and inline code. */
export function splitRow(line) {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '', inCode = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') { inCode = !inCode; cur += c; continue; }
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (line) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim()) && line.includes('-');

/**
 * Every markdown table in `text`, as {header:[], rows:[[]], line, section}.
 * `section` is the nearest preceding heading, so a caller can say "the table under §D".
 */
export function tables(text) {
  const lines = text.split('\n');
  const out = [];
  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = /^(#{2,6})\s+(.*)$/.exec(l);
    if (h) { section = h[2].trim(); continue; }
    if (!l.trim().startsWith('|')) continue;
    if (i + 1 >= lines.length || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(l);
    const rows = [];
    let j = i + 2;
    for (; j < lines.length; j++) {
      const r = lines[j];
      if (!r.trim().startsWith('|')) break;
      const cells = splitRow(r);
      if (cells.length >= 2) rows.push(cells);
    }
    out.push({ header, rows, line: i + 1, section });
    i = j - 1;
  }
  return out;
}

/** The first table whose header matches every one of `mustHave` (case-insensitive substring). */
export function findTable(text, mustHave, sectionMatch = null) {
  for (const t of tables(text)) {
    if (sectionMatch && !new RegExp(sectionMatch, 'i').test(t.section || '')) continue;
    const joined = t.header.join(' | ').toLowerCase();
    if (mustHave.every((m) => joined.includes(m.toLowerCase()))) return t;
  }
  return null;
}

/** Strip markdown emphasis, links and code fences from a cell so a value is comparable. */
export function plain(cell) {
  return String(cell || '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "0:08" / "1:05" -> minutes. "0:00" -> 0. Returns null when not a time. */
export function parseMinutes(cell) {
  const s = plain(cell);
  const m = /^(\d+):(\d{2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = /^(\d+(?:\.\d+)?)\s*min/.exec(s);
  if (n) return Number(n[1]);
  return null;
}

/** "±2" / "+0/−0" / "±8" -> {plus, minus}. Handles the corpus's unicode minus. */
export function parseTolerance(cell) {
  const s = plain(cell).replace(/[−–—]/g, '-');
  let m = /^±\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) return { plus: Number(m[1]), minus: Number(m[1]) };
  m = /^\+\s*(\d+(?:\.\d+)?)\s*\/\s*-\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) return { plus: Number(m[1]), minus: Number(m[2]) };
  const n = Number(s);
  if (Number.isFinite(n)) return { plus: n, minus: n };
  return null;
}

/** "≤ 14" / "18-32" / ">= 7" / "0" -> a comparable band. */
export function parseBand(cell) {
  const s = plain(cell).replace(/[−–—]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=');
  let m = /^<=\s*(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { op: '<=', value: Number(m[1]), raw: s };
  m = /^>=\s*(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { op: '>=', value: Number(m[1]), raw: s };
  m = /^>\s*(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { op: '>', value: Number(m[1]), raw: s };
  m = /^<\s*(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { op: '<', value: Number(m[1]), raw: s };
  m = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (m) return { op: 'between', min: Number(m[1]), max: Number(m[2]), raw: s };
  m = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (m) return { op: 'ratio', value: Number(m[1]), of: Number(m[2]), raw: s };
  const n = Number(s);
  if (Number.isFinite(n)) return { op: '==', value: n, raw: s };
  return { op: 'prose', raw: s };
}

export function readItem(p) {
  if (!fs.existsSync(p)) throw new Error(`reference item not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

/**
 * The drift guard. A generator that emits fewer rows than the table has is silently dropping
 * spec, which is the failure these tools exist to prevent. Callers pass the parsed rows and
 * the source table; this throws when they disagree.
 */
export function assertNoDrift(sourceTable, emitted, what) {
  const expected = sourceTable.rows.filter((r) => r.some((c) => c.trim())).length;
  if (emitted.length !== expected) {
    throw new Error(
      `${what}: parsed ${emitted.length} of ${expected} table rows from the item at line ` +
      `${sourceTable.line}. A generator that drops rows it could not parse re-introduces the ` +
      `drift it exists to prevent (RI-EXP01 step 3). Fix the parser or the table, not this check.`);
  }
}
