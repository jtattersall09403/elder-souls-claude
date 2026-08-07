#!/usr/bin/env node
// apply-source-rewrites.mjs — apply authored rewrites to a SOURCE file (a .mjs generator), by
// exact string match, refusing anything it is not certain about.
//
// tools/prose/apply-rewrites.mjs applies authored sentences to shipped game JSON. It cannot be
// used on tools/dialogue/gen-greetings.mjs, because that is not JSON: the text there lives inside
// JavaScript string literals with their own quoting, and the 1,500 shipped greeting lines are
// COMPOSED from it at build time. Editing the output instead of the generator is how a fix gets
// silently reverted by the next `node tools/dialogue/gen-greetings.mjs`.
//
// The rules this tool will not break:
//   * every `from` must appear EXACTLY ONCE in the target file. Zero occurrences is a stale
//     rewrite record and it exits non-zero; two or more is ambiguous and it exits non-zero.
//   * `--check` reports without writing.
//   * `--self-test` breaks it on purpose: a missing string, a duplicated string, and a rewrite
//     that would produce a syntactically invalid file must all be refused.
//
// Usage:
//   node tools/prose/apply-source-rewrites.mjs <rewrites.jsonl> [--check]
//   node tools/prose/apply-source-rewrites.mjs --self-test
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function readRewrites(file) {
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => r.from && r.to && r.file);
}

// Returns { text, applied, errors } — never throws on a bad rewrite, so the caller sees ALL of
// them rather than only the first.
export function applyAll(text, rewrites) {
  let out = text;
  const applied = [];
  const errors = [];
  for (const [i, r] of rewrites.entries()) {
    const n = out.split(r.from).length - 1;
    if (n === 0) { errors.push(`#${i} [${r.group || '?'}/${r.band || '?'}] NOT FOUND: ${r.from.slice(0, 70)}…`); continue; }
    if (n > 1) { errors.push(`#${i} [${r.group || '?'}/${r.band || '?'}] AMBIGUOUS (${n} occurrences): ${r.from.slice(0, 70)}…`); continue; }
    out = out.replace(r.from, r.to);
    applied.push(r);
  }
  return { text: out, applied, errors };
}

function assert(cond, msg) { console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${msg}`); return cond ? 1 : 0; }

async function selfTest() {
  let ok = 1;
  const src = "const A = ['one', 'two'];\nconst B = ['two', 'three'];\n";

  // refuses a rewrite whose target is not present
  let r = applyAll(src, [{ file: 'x', from: "'nine'", to: "'ten'" }]);
  ok &= assert(r.errors.length === 1 && r.applied.length === 0 && r.text === src,
    'refuses a rewrite whose source string is absent, and changes nothing');

  // refuses an ambiguous rewrite
  r = applyAll(src, [{ file: 'x', from: "'two'", to: "'TWO'" }]);
  ok &= assert(r.errors.length === 1 && /AMBIGUOUS \(2 occurrences\)/.test(r.errors[0]) && r.text === src,
    'refuses an ambiguous rewrite (2 occurrences) rather than picking one');

  // applies an unambiguous one
  r = applyAll(src, [{ file: 'x', from: "'three'", to: "'THREE'" }]);
  ok &= assert(r.applied.length === 1 && r.text.includes("'THREE'"), 'applies an unambiguous rewrite');

  // reports EVERY bad rewrite, not just the first
  r = applyAll(src, [{ file: 'x', from: "'nine'", to: "'x'" }, { file: 'x', from: "'ten'", to: "'y'" }]);
  ok &= assert(r.errors.length === 2, 'reports every bad rewrite, not only the first');

  // --- the check that matters: a rewrite that breaks the file's syntax must be caught.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-'));
  const bad = path.join(tmp, 'bad.mjs');
  fs.writeFileSync(bad, "export const A = ['one'];\n");
  const broken = applyAll(fs.readFileSync(bad, 'utf8'), [{ file: bad, from: "'one'", to: "'one" }]);
  fs.writeFileSync(bad, broken.text);
  let threw = false;
  try { await import(`file://${bad}?t=${Date.now()}`); } catch { threw = true; }
  ok &= assert(threw, 'a rewrite that produces invalid JavaScript is detectable by re-importing the file');
  ok &= assert(await syntaxOk(bad) === false, 'and syntaxOk() reports it as broken');
  fs.writeFileSync(bad, "export const A = ['one'];\n");
  ok &= assert(await syntaxOk(bad) === true, 'and reports a valid file as fine');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(ok ? 'self-test passed' : 'SELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

export async function syntaxOk(file) {
  try { await import(`file://${path.resolve(file)}?t=${Date.now()}_${Math.random()}`); return true; }
  catch (e) { return e instanceof SyntaxError ? false : true; }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('usage: apply-source-rewrites.mjs <rewrites.jsonl> [--check]'); process.exit(2); }
  const check = argv.includes('--check');

  const rewrites = readRewrites(path.resolve(ROOT, file));
  const targets = [...new Set(rewrites.map((r) => r.file))];
  let bad = 0;
  for (const t of targets) {
    const abs = path.resolve(ROOT, t);
    const before = fs.readFileSync(abs, 'utf8');
    const mine = rewrites.filter((r) => r.file === t);
    const { text, applied, errors } = applyAll(before, mine);
    for (const e of errors) console.error(`  ERROR ${t} ${e}`);
    bad += errors.length;
    console.log(`  ${t}: ${applied.length}/${mine.length} applied${errors.length ? `, ${errors.length} REFUSED` : ''}`);
    if (!check && !errors.length && text !== before) {
      fs.writeFileSync(abs, text);
      if (t.endsWith('.mjs') && !(await syntaxOk(abs))) {
        fs.writeFileSync(abs, before);
        console.error(`  ERROR ${t}: rewrite produced invalid JavaScript — REVERTED`);
        process.exit(3);
      }
    }
  }
  if (bad) { console.error(`\n${bad} rewrite(s) refused; nothing written for the affected file.`); process.exit(4); }
  console.log(check ? '\ncheck only, nothing written' : '\nwritten');
}

main().catch((e) => { console.error(e); process.exit(1); });
