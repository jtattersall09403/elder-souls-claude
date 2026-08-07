#!/usr/bin/env node
// tools/prose/apply-rewrites.mjs — apply AUTHORED sentence rewrites to game/data JSON.
//
// This is deliberately NOT a search-and-replace. Each record names one exact sentence and the
// sentence that replaces it; a substituted synonym would be the same fingerprint in a hat, so the
// unit of change here is a whole sentence written by hand. The tool's only job is to put the
// authored sentence into the right JSON string without reformatting the file around it.
//
//   reports/prose-tics/rewrites/*.jsonl   {"file":"game/data/books/x.json","before":"…","after":"…"}
//
// Guarantees, all enforced:
//   * `before` must occur EXACTLY ONCE in the target file (as JSON-escaped text). Zero or two is a
//     hard error — an ambiguous replacement is how a rewrite silently lands in the wrong book.
//   * the file must still parse as JSON afterwards, and every other string in it must be unchanged.
//   * --check runs the whole thing without writing, so a batch can be validated before it lands.
//
// USAGE
//   node tools/prose/apply-rewrites.mjs reports/prose-tics/rewrites/books-01.jsonl [--check]
//   node tools/prose/apply-rewrites.mjs --self-test

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// JSON string-body encoding of a plain text fragment, so it can be found inside a .json file
// without re-serialising the whole document (which would reformat every other line).
export function esc(s) {
  return JSON.stringify(s).slice(1, -1);
}

export function applyOne(src, before, after) {
  const b = esc(before);
  const a = esc(after);
  const first = src.indexOf(b);
  if (first < 0) return { ok: false, reason: 'not found', src };
  if (src.indexOf(b, first + 1) >= 0) return { ok: false, reason: 'ambiguous (occurs more than once)', src };
  return { ok: true, src: src.slice(0, first) + a + src.slice(first + b.length) };
}

function stringsOf(o, out = []) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) for (const v of o) stringsOf(v, out);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) stringsOf(v, out);
  return out;
}

function run(files, check) {
  const byFile = new Map();
  let n = 0;
  for (const f of files) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim() || line.trim().startsWith('//')) continue;
      const r = JSON.parse(line);
      if (!byFile.has(r.file)) byFile.set(r.file, []);
      byFile.get(r.file).push(r);
      n++;
    }
  }
  let failed = 0;
  let applied = 0;
  for (const [rel, recs] of byFile) {
    const abs = path.join(ROOT, rel);
    const original = fs.readFileSync(abs, 'utf8');
    let src = original;
    const beforeStrings = stringsOf(JSON.parse(original)).length;
    for (const r of recs) {
      const res = applyOne(src, r.before, r.after);
      if (!res.ok) {
        console.error(`  FAIL ${rel}: ${res.reason}\n       before: ${r.before.slice(0, 110)}`);
        failed++;
        continue;
      }
      src = res.src;
      applied++;
    }
    let parsed;
    try {
      parsed = JSON.parse(src);
    } catch (e) {
      console.error(`  FAIL ${rel}: result is not valid JSON (${e.message}) — file left untouched`);
      failed++;
      continue;
    }
    if (stringsOf(parsed).length !== beforeStrings) {
      console.error(`  FAIL ${rel}: string count changed — structure was damaged`);
      failed++;
      continue;
    }
    if (!check) fs.writeFileSync(abs, src);
    console.log(`  ${check ? 'would patch' : 'patched'} ${rel}  (${recs.length} rewrites)`);
  }
  console.log(`${applied}/${n} rewrites ${check ? 'validated' : 'applied'}, ${failed} failed`);
  return failed ? 1 : 0;
}

function selfTest() {
  console.log('apply-rewrites --self-test');
  let bad = 0;
  const t = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) bad++; };

  const src = '{\n  "a": "There were eleven of us on the quay.",\n  "b": "Nothing here."\n}';
  const r1 = applyOne(src, 'There were eleven of us on the quay.', 'The whole crew was on the quay, and every one of us saw it.');
  t(r1.ok, 'a unique sentence is replaced');
  t(JSON.parse(r1.src).a === 'The whole crew was on the quay, and every one of us saw it.', 'the replacement lands in the right key');
  t(JSON.parse(r1.src).b === 'Nothing here.', 'nothing else in the file moves');

  const r2 = applyOne(src, 'not present anywhere', 'x');
  t(!r2.ok && r2.reason === 'not found', 'a missing sentence is a hard error, not a silent no-op');

  const dup = '{"a":"Same line.","b":"Same line."}';
  const r3 = applyOne(dup, 'Same line.', 'Other.');
  t(!r3.ok && r3.reason.startsWith('ambiguous'), 'an ambiguous sentence is refused rather than guessed');

  // the escaping path: a sentence carrying a quote, a backslash and a newline must round-trip
  const tricky = JSON.stringify({ a: 'He said "no" \\ then\nleft.' });
  const r4 = applyOne(tricky, 'He said "no" \\ then\nleft.', 'He said no and left.');
  t(r4.ok && JSON.parse(r4.src).a === 'He said no and left.', 'quotes, backslashes and newlines survive the escape path');

  console.log(bad ? 'SELF-TEST FAILED' : 'self-test passed');
  return bad ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) process.exit(selfTest());
const check = argv.includes('--check');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: apply-rewrites.mjs <rewrites.jsonl…> [--check] | --self-test');
  process.exit(2);
}
process.exit(run(files, check));
