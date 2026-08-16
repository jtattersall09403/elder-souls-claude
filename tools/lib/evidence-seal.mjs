// evidence-seal.mjs — take the evidence fingerprint BEFORE any other module body can run.
//
// =========================================================================================
// WHY THIS EXISTS — HAZARDS §31, AND THE CORRECTION TO ITS OWN REMEDY
// =========================================================================================
// §31's defect: `check-authoring-leaks.mjs` imported `gen-greetings.mjs`, which had a top-level
// `fs.writeFileSync`, so the check REGENERATED the file it was about to scan — deleting the
// hand-authored leak and then reporting its absence.
//
// Round 2's remedy was a SHA-256 tripwire: hash every watched file, re-hash after, exit 4 if a
// byte moved. The round-2 critic falsified it, and the hole is the idiomatic case:
//
//   | where the generator import sits                  | exit | evidence |
//   | inside scanAuthoredSource() (round 1's placement) | 4    | survives |
//   | a static top-level `import` — THE ORDINARY FORM   | 0 "PASS" | DELETED |
//   | top of main()                                     | 0 "PASS" | DELETED |
//
// The cause is ESM evaluation order, and it is not a bug in Node: **every `import` in a module
// is evaluated before ANY of that module's own body statements.** Round 2 took its fingerprint
// inside `main()`, so by the time it ran, the imported generator had already rewritten the
// file — and the "before" hash was the hash of the file AFTER the damage. A tripwire that runs
// after the thing it watches for is not a tripwire.
//
// **`HAZARDS` §31's stated fix — "take the fingerprint at MODULE SCOPE" — is necessary and NOT
// sufficient, and this file is where that correction lives.** Module scope is still the
// importer's body, which still runs after all of its imports. The only hook ESM gives you that
// runs before another module's body is *being that other module, earlier in the import list*.
// So the fingerprint is taken HERE, in this module's own body, and the invariant that makes it
// work is mechanical:
//
//   **THIS MODULE MUST BE THE FIRST `import` STATEMENT IN ANY CHECK THAT USES IT.**
//
// ESM evaluates a module's imports in source order, depth-first, so the first import's body
// runs before the second import's body. `verifySeal()` does not take that on trust: it reads
// the caller's own source, strips comments, finds the first `import` statement, resolves it,
// and fails if it is not this file. Both ways of defeating the seal are therefore closed:
//
//   * generator imported AFTER the seal  -> the seal was already taken -> hashes differ -> red
//   * generator imported BEFORE the seal -> the first-import assertion fails            -> red
//
// WHAT IT WATCHES. Every `.json` under `game/data/**` (the shipped evidence) and every `.mjs`
// under `tools/dialogue`, `tools/books` and `tools/lib` (the authored sources a check reads as
// text, and the instruments themselves). Measured 2026-08-16: 588 JSON files, 15 MB, whole
// hash pass under 0.3 s including node start-up — cheap enough that narrowing it would buy
// nothing and would reintroduce the "the hole is where nobody looked" failure.
//
// IT MUST NOT WRITE AND MUST NOT IMPORT ANYTHING THAT WRITES (§31 rule 1). It imports only
// node builtins.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..', '..');

/** Repo-relative watch roots. `dir` is walked recursively for files ending in `ext`. */
const WATCH = [
  { dir: 'game/data', ext: '.json' },
  { dir: 'tools/dialogue', ext: '.mjs' },
  { dir: 'tools/books', ext: '.mjs' },
  { dir: 'tools/lib', ext: '.mjs' },
];

function walk(dir, ext, out) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return out; }
  for (const f of entries.sort()) {
    const p = path.join(dir, f);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, ext, out);
    else if (f.endsWith(ext)) out.push(p);
  }
  return out;
}

function collect() {
  const out = [];
  for (const w of WATCH) walk(path.join(ROOT, w.dir), w.ext, out);
  return out;
}

function hashAll(files) {
  const m = new Map();
  for (const f of files) {
    try { m.set(f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')); }
    catch { m.set(f, '(unreadable)'); }
  }
  return m;
}

// ---------------------------------------------------------------------------------------
// THE SEAL ITSELF. This runs at import-evaluation time — i.e. before the importing module's
// body, and before any import that module lists after this one. That is the whole point of
// the file and it is why there is executable code at module scope here.
// ---------------------------------------------------------------------------------------
const SEALED_FILES = collect();
const SEAL = hashAll(SEALED_FILES);
const SEALED_AT = Date.now();

/** Comments removed so an `import` quoted inside one cannot satisfy or defeat the assertion. */
function stripComments(src) {
  const out = [];
  let block = false;
  for (const line of String(src).split('\n')) {
    let res = ''; let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (block) { if (c === '*' && line[i + 1] === '/') { block = false; i++; } continue; }
      if (q) { res += c; if (c === '\\') { res += line[i + 1] || ''; i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; res += c; continue; }
      if (c === '/' && line[i + 1] === '/') break;
      if (c === '/' && line[i + 1] === '*') { block = true; i++; continue; }
      res += c;
    }
    out.push(res);
  }
  return out.join('\n');
}

/** The first `import` statement's specifier in a source file, or null if there is none. */
export function firstImportSpecifier(src) {
  const code = stripComments(src);
  const re = /(^|\n)\s*import\s+(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/;
  const m = re.exec(code);
  return m ? m[2] : null;
}

/**
 * Re-hash the sealed set and check the caller sealed FIRST.
 *
 * @param {string} callerUrl `import.meta.url` of the check calling this.
 * @returns {{ok:boolean, mutated:string[], watched:number, held_ms:number,
 *            first_import:?string, first_import_ok:boolean, reason:?string}}
 */
export function verifySeal(callerUrl) {
  const now = hashAll(SEALED_FILES);
  const mutated = SEALED_FILES.filter((f) => SEAL.get(f) !== now.get(f)).map((f) => path.relative(ROOT, f));

  // Is this module genuinely the caller's first import? If not, a generator listed above it
  // ran before the seal was taken and the hashes above are the hashes of the damage.
  let first = null; let firstOk = false; let reason = null;
  try {
    const callerPath = fileURLToPath(callerUrl);
    const src = fs.readFileSync(callerPath, 'utf8');
    first = firstImportSpecifier(src);
    if (first === null) {
      reason = 'the caller has no import statement at all — verifySeal() cannot have been imported';
    } else if (first.startsWith('.')) {
      firstOk = path.resolve(path.dirname(callerPath), first) === SELF;
      if (!firstOk) reason = `the caller's FIRST import is ${JSON.stringify(first)}, not the evidence seal — `
        + 'that module\'s body ran before the fingerprint was taken, so the fingerprint may be of the damage';
    } else {
      reason = `the caller's FIRST import is ${JSON.stringify(first)} (a bare/builtin specifier), not the evidence seal`;
    }
  } catch (e) {
    reason = `could not read the caller's source to verify import order: ${e.message}`;
  }

  return {
    ok: mutated.length === 0 && firstOk,
    mutated,
    watched: SEALED_FILES.length,
    held_ms: Date.now() - SEALED_AT,
    first_import: first,
    first_import_ok: firstOk,
    reason,
  };
}

/**
 * Print the seal result and exit 4 if it is broken. Callers that want to report more before
 * dying should call `verifySeal()` themselves.
 */
export function reportSeal(name, r) {
  if (r.ok) {
    console.log(`evidence seal (${name}): ${r.watched} files hashed at MODULE-IMPORT time, 0 changed; `
      + 'seal is this check\'s first import (HAZARDS §31, corrected).');
    return true;
  }
  console.error('\nEVIDENCE-MUTATION TRIPWIRE (HAZARDS §31, module-scope seal).');
  if (r.mutated.length) {
    console.error('This check changed the bytes it was scanning — the round-1 defect exactly: a check');
    console.error('that regenerates its own evidence deletes the leak and then reports its absence.');
    console.error(`Files changed under it (${r.mutated.length}):`);
    for (const f of r.mutated.slice(0, 20)) console.error(`  ${f}`);
    if (r.mutated.length > 20) console.error(`  … and ${r.mutated.length - 20} more`);
  }
  if (!r.first_import_ok) {
    console.error(`Import-order assertion FAILED: ${r.reason}`);
    console.error('The seal must be the FIRST import statement in the file, because ESM evaluates');
    console.error('every import before the importing module\'s own body.');
  }
  console.error('No verdict from this run may be believed. Exit 4.');
  return false;
}
