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

// Two address shapes, because the dialogue tree has two. `topic`+`index` addresses a topic info;
// `greeting` addresses a record in a `greetings` array by its own id — which is stabler than an
// index, since greetings are appended to and reordered by the generator that feeds some of them.
export function resolveOne(doc, r) {
  let inf, label;
  if (r.rumour != null) {
    // rumours.json is `rumours: { <town>: [ ... ] }`, and an entry is either a bare string or a
    // record with its own id. Only the id'd ones are addressable — a bare string has no stable
    // address at all, and inventing one from its index would break the moment a town gains a
    // rumour. Searched across every town so the table does not have to repeat the town name.
    for (const arr of Object.values(doc.rumours || {})) {
      const hit = (arr || []).find((x) => x && typeof x === 'object' && x.id === r.rumour);
      if (hit) { inf = hit; break; }
    }
    if (!inf) return { ok: false, why: `no rumour with id "${r.rumour}" (bare-string rumours are not addressable)` };
    label = `rumour ${r.rumour}`;
  } else if (r.array != null) {
    // The general shape, for the flat top-level arrays the dialogue tree also uses
    // (`lines`, `race_gated`). Addressed by `id` where the records carry one and by `index`
    // where they do not — and where it is by index, the guard prefix is doing all the work of
    // proving the address, which is exactly what it is for.
    const arr = doc[r.array];
    if (!Array.isArray(arr)) return { ok: false, why: `no array "${r.array}" in this file` };
    inf = r.id != null ? arr.find((x) => x && x.id === r.id) : arr[r.index];
    if (!inf) return { ok: false, why: `${r.array}: no entry ${r.id != null ? `with id "${r.id}"` : `#${r.index}`}` };
    label = `${r.array}[${r.id ?? r.index}]`;
  } else if (r.greeting != null) {
    inf = (doc.greetings || []).find((g) => g.id === r.greeting);
    if (!inf) return { ok: false, why: `no greeting "${r.greeting}"` };
    label = `greeting ${r.greeting}`;
  } else {
    const t = (doc.topics || []).find((x) => x.id === r.topic);
    if (!t) return { ok: false, why: `no topic "${r.topic}"` };
    inf = (t.infos || [])[r.index];
    if (!inf) return { ok: false, why: `topic "${r.topic}" has no info #${r.index}` };
    label = `${r.topic}#${r.index}`;
  }
  const on = String(inf.x ?? inf.text ?? '');
  if (r.g && !on.startsWith(r.g)) {
    return { ok: false, why: `guard failed at ${label}: expected a line starting ${JSON.stringify(r.g)}, found ${JSON.stringify(on.slice(0, Math.max(40, r.g.length + 10)))}` };
  }
  if (on === r.after) return { ok: false, why: `${label}: after is identical to what is on disk` };
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
  const gdoc = { greetings: [{ id: 'lil-w1', x: 'Friend, Lilmoth is yours today.' }, { id: 'lil-w2', x: 'It is you, dry-one.' }] };
  t(resolveOne(gdoc, { greeting: 'lil-w2', g: 'It is you', after: 'X' }).before === 'It is you, dry-one.', 'addresses a greeting by its own id, not by index');
  const gg = resolveOne(gdoc, { greeting: 'lil-w1', g: 'It is you', after: 'X' });
  t(!gg.ok && /guard failed at greeting lil-w1/.test(gg.why), 'the guard names the greeting when it refuses');
  t(!resolveOne(gdoc, { greeting: 'nope', g: 'x', after: 'X' }).ok, 'refuses an unknown greeting id');
  const rdoc = { rumours: { thorn: ['a bare string rumour', { id: 'thorn-tree', x: 'The tree has said four words.' }], gideon: [{ id: 'gideon-well', x: 'The well is sealed.' }] } };
  t(resolveOne(rdoc, { rumour: 'gideon-well', g: 'The well', after: 'X' }).before === 'The well is sealed.', 'finds an id-bearing rumour in any town without being told the town');
  t(resolveOne(rdoc, { rumour: 'thorn-tree', g: 'The tree', after: 'X' }).ok, 'and finds one that sits beside a bare-string rumour');
  const rr = resolveOne(rdoc, { rumour: 'nope', g: 'x', after: 'X' });
  t(!rr.ok && /not addressable/.test(rr.why), 'refuses an unknown rumour id and says bare strings have no address');
  const adoc = { lines: [{ text: 'Are you free?' }, { text: 'Second.' }], race_gated: [{ id: 'rg1', x: 'Gated line.' }] };
  t(resolveOne(adoc, { array: 'lines', index: 0, g: 'Are you free', after: 'X' }).before === 'Are you free?', 'array shape reads `text` as well as `x`');
  t(resolveOne(adoc, { array: 'race_gated', id: 'rg1', g: 'Gated', after: 'X' }).ok, 'array shape addresses by id when the records carry one');
  t(!resolveOne(adoc, { array: 'nope', index: 0, g: 'x', after: 'X' }).ok, 'refuses an array the file does not have');
  const am = resolveOne(adoc, { array: 'lines', index: 1, g: 'Are you free', after: 'X' });
  t(!am.ok && /guard failed/.test(am.why), 'and the guard still catches a mis-addressed index');
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
    const key = `${rel}|${r.array ?? ''}|${r.rumour ?? r.greeting ?? r.id ?? r.topic}|${r.index ?? ''}`;
    if (seen.has(key)) { problems.push(`${key}: addressed twice in the same table`); continue; }
    seen.add(key);
    const res = resolveOne(docs.get(rel), r);
    if (!res.ok) { problems.push(res.why); continue; }
    out.push(r.array != null
      ? { file: rel, array: r.array, id: r.id, index: r.index, before: res.before, after: r.after }
      : r.rumour != null
      ? { file: rel, rumour: r.rumour, before: res.before, after: r.after }
      : r.greeting != null
        ? { file: rel, greeting: r.greeting, before: res.before, after: r.after }
        : { file: rel, topic: r.topic, index: r.index, before: res.before, after: r.after });
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
