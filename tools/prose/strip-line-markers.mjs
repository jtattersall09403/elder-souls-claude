#!/usr/bin/env node
// tools/prose/strip-line-markers.mjs — remove the em dash used as a LINE MARKER (a bullet, a
// ledger column rule, an inscription lead-in) from shipped text.
//
// Why this is a separate tool from apply-rewrites.mjs, and why it is allowed to be mechanical:
// apply-rewrites is for AUTHORED sentences and refuses an ambiguous match on purpose, because a
// prose rewrite that lands in the wrong book is a silent corruption. A line marker is not prose.
// "— It held." occurs twelve times in one leave-book and every occurrence is the same typographic
// device, so the uniqueness rule cannot apply and the change carries no authorial judgement.
//
// It ONLY touches a dash that opens a line (optionally after whitespace) and is followed by a
// space. It never touches a dash inside a sentence — that is a rhetorical figure and gets rewritten
// by hand, not stripped.
//
// USAGE
//   node tools/prose/strip-line-markers.mjs game/data/books/*.json [--check]
//   node tools/prose/strip-line-markers.mjs --self-test

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Applied to the JSON SOURCE TEXT, exactly like apply-rewrites.mjs, so the surrounding file is not
// reformatted. Re-serialising these files is not a no-op — none of them round-trips through
// JSON.stringify byte-for-byte — so a tool that parses and re-writes would bury four real edits in
// a whole-file diff.
//   \n inside a JSON string is the two characters backslash + n.
//   a marker at the very start of a value sits immediately after the opening quote.
export function stripMarkers(src) {
  let n = 0;
  let out = src.replace(/\\n([ \t]*)—[ \t]+/g, (m, ws) => { n++; return '\\n' + ws; });
  // Only an UNESCAPED quote opens a JSON value. `\"` is a quotation mark inside the prose, and a
  // dash after one is an inline figure — this tool stripped a real one before the lookbehind was
  // added ("Who has hanged a pirate this year?" — Four.).
  out = out.replace(/(?<!\\)"([ \t]*)—[ \t]+/g, (m, ws) => { n++; return '"' + ws; });
  return { text: out, changed: n };
}

function run(files, check) {
  let total = 0;
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    const src = fs.readFileSync(abs, 'utf8');
    const r = stripMarkers(src);
    if (!r.changed) continue;
    const before = JSON.parse(src);
    let after;
    try { after = JSON.parse(r.text); } catch (e) {
      console.error(`  FAIL ${path.relative(ROOT, abs)}: result is not valid JSON (${e.message})`);
      return 1;
    }
    if (JSON.stringify(Object.keys(after)) !== JSON.stringify(Object.keys(before))) {
      console.error(`  FAIL ${path.relative(ROOT, abs)}: top-level shape changed`);
      return 1;
    }
    total += r.changed;
    console.log(`  ${check ? 'would strip' : 'stripped'} ${r.changed}\t${path.relative(ROOT, abs)}`);
    if (!check) fs.writeFileSync(abs, r.text);
  }
  console.log(`${total} line markers ${check ? 'found' : 'stripped'}`);
  return 0;
}

function selfTest() {
  console.log('strip-line-markers --self-test');
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };

  const J = (o) => JSON.stringify(o, null, 2);
  const one = J({ a: '— It held.' });
  t(JSON.parse(stripMarkers(one).text).a === 'It held.', 'a marker at the very start of a value is stripped');

  const many = J({ a: 'x\n— It held.\n— It held.' });
  t(stripMarkers(many).changed === 2,
    'a repeated marker is stripped every time (this is why it is not an authored rewrite)');

  const inline = J({ a: 'Not quiet — silent, in a city, at midday.' });
  t(stripMarkers(inline).text === inline, 'an INLINE dash is left completely alone');
  const tight = J({ a: 'The tide—and this matters—turned.' });
  t(stripMarkers(tight).changed === 0, 'an unspaced inline dash pair is left alone');
  const attrib = J({ a: 'It is told so. — A.C.)' });
  t(stripMarkers(attrib).changed === 0, 'a dash that follows text on the same line is left alone');
  // REGRESSION: an escaped quote inside the prose is not the start of a JSON value. Without the
  // lookbehind this stripped a real inline dash out of a marginalia book.
  const quoted = J({ a: 'beside "Who has hanged a pirate this year?" — Four.' });
  t(stripMarkers(quoted).changed === 0, 'a dash after an ESCAPED quote inside the prose is left alone');
  const indented = J({ a: 'x\n  — indented marker' });
  t(JSON.parse(stripMarkers(indented).text).a === 'x\n  indented marker', 'leading whitespace is preserved');

  // the instrument must be able to go red, and must be able to stay green
  const clean = J({ a: 'Nothing to do here.' });
  t(stripMarkers(clean).changed === 0, 'a clean file reports zero changes');
  t(stripMarkers(J({ a: 'x\n— y' })).changed === 1, 'and the same file with one marker injected reports one');

  // it must not damage a document: every OTHER string survives untouched
  const mixed = J({ a: 'x\n— marker', b: 'Not quiet — silent.', c: 'plain' });
  const after = JSON.parse(stripMarkers(mixed).text);
  t(after.b === 'Not quiet — silent.' && after.c === 'plain', 'sibling strings are unchanged');

  console.log(bad ? 'SELF-TEST FAILED' : 'self-test passed');
  return bad ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) process.exit(selfTest());
const check = argv.includes('--check');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: strip-line-markers.mjs <files…> [--check] | --self-test'); process.exit(2); }
process.exit(run(files, check));
