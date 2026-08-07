#!/usr/bin/env node
// tools/prose/mkspec.mjs — turn a compact authored-rewrite table into a full rewrites spec for
// apply-info-rewrites.mjs, filling `before` from disk and CHECKING it against a short prefix.
//
// WHY. A hand-typed `before` for fifty lines is fifty chances to mistype a string and get a
// "not what the rewrite expected" refusal that tells you nothing. But dropping `before` entirely
// disables apply-info-rewrites' concurrent-edit guard, and on this tree that guard is the only
// thing standing between a mis-typed topic id and a silently clobbered line in someone else's
// file. So the table carries a short `g` (guard) prefix: enough to prove the address is right,
// short enough to type. The generator reads the line from disk, asserts it starts with `g`, and
// writes the full text into `before` so the applier's exact-match guard still runs.
//
// INPUT (JSON): { file, rule, log, rewrites: [ { topic, index, g, after }, ... ] }
// USAGE: node tools/prose/mkspec.mjs <table.json> <out-spec.json>
//        node tools/prose/mkspec.mjs --self-test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function resolveOne(doc, r) {
  const t = (doc.topics || []).find((x) => x.id === r.topic);
  if (!t) return { ok: false, why: `no topic "${r.topic}"` };
  const inf = (t.infos || [])[r.index];
  if (!inf) return { ok: false, why: `topic "${r.topic}" has no info #${r.index}` };
  const on = String(inf.x ?? '');
  if (r.g && !on.startsWith(r.g)) {
    return { ok: false, why: `guard failed at ${r.topic}#${r.index}: expected a line starting ${JSON.stringify(r.g)}, found ${JSON.stringify(on.slice(0, Math.max(40, r.g.length + 10)))}` };
  }
  if (on === r.after) return { ok: false, why: `${r.topic}#${r.index}: after is identical to what is on disk` };
  return { ok: true, before: on };
}

function selfTest() {
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };
  console.log('mkspec --self-test');
  const doc = { topics: [{ id: 'a', infos: [{ x: 'Hello there, friend.' }, { x: 'Second line.' }] }] };
  t(resolveOne(doc, { topic: 'a', index: 0, g: 'Hello there', after: 'X' }).before === 'Hello there, friend.', 'fills before from disk when the guard matches');
  const g = resolveOne(doc, { topic: 'a', index: 1, g: 'Hello there', after: 'X' });
  t(!g.ok && /guard failed/.test(g.why), 'refuses when the guard prefix does not match the addressed line (mis-addressed rewrite)');
  t(!resolveOne(doc, { topic: 'zz', index: 0, g: 'x', after: 'X' }).ok, 'refuses an unknown topic');
  t(!resolveOne(doc, { topic: 'a', index: 7, g: 'x', after: 'X' }).ok, 'refuses an index that does not exist');
  const same = resolveOne(doc, { topic: 'a', index: 0, g: 'Hello', after: 'Hello there, friend.' });
  t(!same.ok && /identical/.test(same.why), 'refuses a no-op rewrite (a table entry that was never edited)');
  t(resolveOne(doc, { topic: 'a', index: 0, after: 'X' }).ok, 'a guardless entry still resolves, for a deliberate override');
  console.log(bad ? `SELF-TEST FAILED (${bad})` : 'self-test passed');
  return bad ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const [tablePath, outPath] = argv.filter((a) => !a.startsWith('--'));
  if (!tablePath || !outPath) { console.error('usage: mkspec.mjs <table.json> <out-spec.json>'); return 2; }
  const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
  const docs = new Map();
  const out = [];
  const problems = [];
  const seen = new Set();
  for (const r of table.rewrites) {
    const rel = r.file || table.file;
    if (!docs.has(rel)) docs.set(rel, JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    const key = `${rel}|${r.topic}|${r.index}`;
    if (seen.has(key)) { problems.push(`${key}: addressed twice in the same table`); continue; }
    seen.add(key);
    const res = resolveOne(docs.get(rel), r);
    if (!res.ok) { problems.push(res.why); continue; }
    out.push({ file: rel, topic: r.topic, index: r.index, before: res.before, after: r.after });
  }
  if (problems.length) {
    console.error(`mkspec: ${problems.length} problem(s), NOTHING written:`);
    for (const p of problems) console.error('  ' + p);
    return 1;
  }
  fs.writeFileSync(outPath, JSON.stringify({ rule: table.rule, log: table.log, rewrites: out }, null, 2));
  console.log(`mkspec: resolved ${out.length} rewrite(s) -> ${outPath}`);
  return 0;
}

process.exit(main());
