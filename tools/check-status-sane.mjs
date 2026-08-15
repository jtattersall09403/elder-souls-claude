#!/usr/bin/env node
// check-status-sane.mjs — STATUS.md is the owner's window. Keep it a window.
//
// Written 2026-08-15 after the orchestrator corrupted STATUS.md itself: a Python slice assignment
// was given a string where it needed a list, so it spliced the file CHARACTER BY CHARACTER and turned
// a 176-line status page into 1,635 lines of single letters. Nothing noticed. It was found only
// because someone went looking for a line number.
//
// The file's whole value is being trustworthy and readable on a phone, and it had no guard at all.
//
//   node tools/check-status-sane.mjs             warn (exit 1) if STATUS.md is not a status page
//   node tools/check-status-sane.mjs --self-test prove the checks can fail
//
// Deliberately three cheap checks, not a linter. Resist growing this: the owner already called an
// over-engineered status tracker exactly that, and was right.

import { readFileSync } from 'node:fs';

const MAX_LINES = 260;        // one screen is ~40; 260 is generous headroom for honest detail
const MAX_TINY_FRAC = 0.15;   // fraction of non-blank lines allowed to be 1-2 chars
const MIN_LINES = 20;         // a status page that says almost nothing is also a failure

function check(text) {
  const lines = text.split('\n');
  const nonBlank = lines.filter(l => l.trim().length > 0);
  const tiny = nonBlank.filter(l => l.trim().length <= 2);
  const tinyFrac = nonBlank.length ? tiny.length / nonBlank.length : 0;
  const problems = [];
  if (lines.length > MAX_LINES)
    problems.push(`${lines.length} lines — over the ${MAX_LINES} ceiling. STATUS.md is one screen, not a report.`);
  if (lines.length < MIN_LINES)
    problems.push(`${lines.length} lines — under the ${MIN_LINES} floor. Did it get truncated?`);
  if (tinyFrac > MAX_TINY_FRAC)
    problems.push(`${(tinyFrac * 100).toFixed(1)}% of non-blank lines are 1-2 characters — this is the character-splice corruption shape.`);
  return { lines: lines.length, tinyFrac, problems };
}

if (process.argv.includes('--self-test')) {
  const good = readFileSync('STATUS.md', 'utf8');
  const spliced = [...good].join('\n');                 // the exact corruption that happened
  const truncated = good.split('\n').slice(0, 5).join('\n');
  const arms = [
    ['live STATUS.md', check(good).problems.length === 0],
    ['character-spliced', check(spliced).problems.length > 0],
    ['truncated', check(truncated).problems.length > 0],
  ];
  for (const [name, ok] of arms) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
  const pass = arms.every(a => a[1]);
  console.log(pass ? 'self-test OK — the arms disagree, so corruption is actually detected.'
                   : 'self-test VACUOUS — this check proves nothing.');
  process.exit(pass ? 0 : 1);
}

const r = check(readFileSync('STATUS.md', 'utf8'));
if (!r.problems.length) { console.log(`status-sane: ok — ${r.lines} lines, ${(r.tinyFrac*100).toFixed(1)}% tiny.`); process.exit(0); }
console.error('status-sane: FAIL');
for (const p of r.problems) console.error(`  ${p}`);
process.exit(1);
