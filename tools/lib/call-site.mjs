// call-site.mjs — assert that a fix is WIRED, not merely correct.
//
// WHY THIS EXISTS. `HAZARDS` §31 rule 2, and `RI-MTH07` §A's "orphan model" row: *a correct rule
// with no caller*. The W1-DIALOGUE-AUTHORING-LEAK round-1 critic ran this control —
//
//   revert `engine.js`'s call site, leave `foldBooks()` itself correct
//
// — and **all three of that round's checks exited 0**. The game would have shipped 24 books
// rendering the literal word "undefined" and nothing would have gone red, because every check
// imported the fixed function and asked the function whether it was fixed. `RI-MTH07` §D3:
// *a comment asserting a check is not a check*. This project has now found four instances of
// the same shape.
//
// WHAT THIS CAN AND CANNOT DO. It reads shipped source as TEXT and asserts a required call
// site is present (and, optionally, that a known-bad shape is absent). That is strictly weaker
// than driving the running engine — a call site inside dead code still matches. It is strictly
// stronger than nothing, which is what the round-1 checks had, and it is what a Node-only pass
// can honestly buy. Every caller must say so in its own output rather than implying more.
//
// IT MUST NOT WRITE, AND IT MUST NOT IMPORT ANYTHING THAT WRITES (`HAZARDS` §31 rule 1). It
// reads files with `fs.readFileSync` and imports nothing from `game/` or `tools/` at all.
'use strict';

import fs from 'node:fs';
import path from 'node:path';

/** Source with `//` line comments removed, so a call site quoted in a COMMENT cannot satisfy an
 * assertion about the code. Quote-aware: a `//` inside a string literal survives. Deliberately
 * simple — it does not attempt regex-literal or template-literal parsing, and callers should
 * pick needles that cannot plausibly appear inside one. */
export function stripLineComments(src) {
  const out = [];
  for (const line of String(src).split('\n')) {
    let q = null; let cut = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '\\') { i++; continue; }
        if (c === q) q = null;
      } else if (c === '"' || c === "'" || c === '`') {
        q = c;
      } else if (c === '/' && line[i + 1] === '/') { cut = i; break; }
    }
    out.push(cut === -1 ? line : line.slice(0, cut));
  }
  return out.join('\n');
}

/**
 * @typedef {Object} CallSite
 * @property {string} file      repo-relative path to the SHIPPED source that must do the calling
 * @property {(string|RegExp)[]} must_contain  every one of these must appear in the code (not comments)
 * @property {(string|RegExp)[]} [must_not_contain]  none of these may appear (the known-bad shape)
 * @property {string} why       one line a human can read when it goes red
 */

/**
 * Assert every call site. Returns `{ ok, results }`; the caller decides the exit code, prints
 * the results, and states the limitation above. Never throws on a failed assertion — a check
 * that dies on its first finding hides the rest.
 *
 * @param {string} root  absolute repo root
 * @param {CallSite[]} sites
 */
export function assertCallSites(root, sites) {
  const results = [];
  for (const s of sites) {
    const abs = path.join(root, s.file);
    if (!fs.existsSync(abs)) {
      results.push({ ...s, ok: false, missing: [`(file does not exist: ${s.file})`], present_bad: [] });
      continue;
    }
    const code = stripLineComments(fs.readFileSync(abs, 'utf8'));
    const hit = (n) => (n instanceof RegExp ? n.test(code) : code.includes(n));
    const missing = (s.must_contain || []).filter((n) => !hit(n)).map(String);
    const presentBad = (s.must_not_contain || []).filter((n) => hit(n)).map(String);
    results.push({ ...s, ok: missing.length === 0 && presentBad.length === 0, missing, present_bad: presentBad });
  }
  return { ok: results.every((r) => r.ok), results };
}

/** Print a `assertCallSites` result block. Returns the same `ok` for convenience. */
export function reportCallSites(label, { ok, results }) {
  console.log(`\n${label} — WIRING (shipped call sites, read as text; see tools/lib/call-site.mjs`);
  console.log('  on what this proves and what it does not):');
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.file} — ${r.why}`);
    for (const m of r.missing) console.log(`         missing from the code: ${m}`);
    for (const b of r.present_bad) console.log(`         known-bad shape is back: ${b}`);
  }
  if (!ok) {
    console.log('  A fix nothing calls scores zero (RI-MTH07 §A, orphan model). Either the call');
    console.log('  site moved — in which case update this list and say where it went — or the fix');
    console.log('  has been unwired and the data below is being checked for a consumer that is');
    console.log('  no longer there.');
  }
  return ok;
}
