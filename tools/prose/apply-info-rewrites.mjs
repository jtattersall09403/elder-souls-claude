#!/usr/bin/env node
// tools/prose/apply-info-rewrites.mjs — apply authored rewrites to dialogue topic infos, by
// (file, topic id, info index), and record every one to a JSONL so the pass is auditable.
//
// WHY NOT THE EXISTING APPLIER. `apply-source-rewrites.mjs` matches on the text itself, which is
// right for a sweep that changes a construction and wrong for a pass that REWRITES a line. Two of
// the round-2 lines are being replaced wholesale and several share opening clauses, so a
// text-match applier would either miss them or hit the wrong one. Addressing by topic id and
// index cannot be ambiguous, and it fails loudly when the index has moved under it — which
// matters on a tree where other agents are editing the same directory.
//
// SAFETY, and each of these exists because the round-1 tool that edited shipped prose had a bug
// its own output number could not see:
//   * refuses if the addressed info does not exist, or if `before` does not match what is on disk
//     (so a concurrent edit is a hard stop, not a silent overwrite);
//   * re-parses the file after writing and refuses to leave it on disk if the JSON broke;
//   * writes the JSONL record for every applied rewrite, before/after, so the pass can be read
//     back or reverted by a successor who was not here.
//
// USAGE
//   node tools/prose/apply-info-rewrites.mjs <rewrites.json> [--dry-run]
//   node tools/prose/apply-info-rewrites.mjs --self-test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function applyOne(doc, topicId, index, before, after) {
  const t = (doc.topics || []).find((x) => x.id === topicId);
  if (!t) return { ok: false, why: `no topic "${topicId}"` };
  const inf = (t.infos || [])[index];
  if (!inf) return { ok: false, why: `topic "${topicId}" has no info #${index}` };
  if (before != null && inf.x !== before) {
    return { ok: false, why: `info ${topicId}#${index} is not what the rewrite expected — it has been edited since. On disk: ${JSON.stringify(inf.x).slice(0, 120)}` };
  }
  inf.x = after;
  return { ok: true };
}

// The second address shape: a record in a `greetings` array, by its own id. Greetings files are
// appended to and partly generator-fed, so an index into them is not a stable address; the id is.
export function applyOneGreeting(doc, id, before, after) {
  const g = (doc.greetings || []).find((x) => x.id === id);
  if (!g) return { ok: false, why: `no greeting "${id}"` };
  if (before != null && g.x !== before) {
    return { ok: false, why: `greeting ${id} is not what the rewrite expected — it has been edited since. On disk: ${JSON.stringify(g.x).slice(0, 120)}` };
  }
  g.x = after;
  return { ok: true };
}

function selfTest() {
  let bad = 0;
  const t = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) bad++; };
  console.log('apply-info-rewrites --self-test');
  const mk = () => ({ topics: [{ id: 'a', infos: [{ x: 'one' }, { x: 'two' }] }] });

  let d = mk();
  t(applyOne(d, 'a', 1, 'two', 'TWO').ok && d.topics[0].infos[1].x === 'TWO', 'applies the addressed info');
  t(d.topics[0].infos[0].x === 'one', 'and leaves its sibling alone');
  t(!applyOne(mk(), 'zz', 0, 'one', 'X').ok, 'refuses an unknown topic');
  t(!applyOne(mk(), 'a', 9, 'one', 'X').ok, 'refuses an index that does not exist');
  const stale = applyOne(mk(), 'a', 0, 'SOMETHING ELSE', 'X');
  t(!stale.ok && /edited since/.test(stale.why), 'refuses when the line on disk is not what the rewrite expected (concurrent edit)');
  d = mk();
  t(applyOne(d, 'a', 0, null, 'X').ok, 'a null `before` means "apply regardless", for a deliberate override');

  const mkg = () => ({ greetings: [{ id: 'g1', x: 'one' }, { id: 'g2', x: 'two' }] });
  let gd = mkg();
  t(applyOneGreeting(gd, 'g2', 'two', 'TWO').ok && gd.greetings[1].x === 'TWO', 'applies the addressed greeting by id');
  t(gd.greetings[0].x === 'one', 'and leaves its sibling greeting alone');
  t(!applyOneGreeting(mkg(), 'nope', 'one', 'X').ok, 'refuses an unknown greeting id');
  const gstale = applyOneGreeting(mkg(), 'g1', 'SOMETHING ELSE', 'X');
  t(!gstale.ok && /edited since/.test(gstale.why), 'refuses a greeting whose text has changed under it (concurrent edit)');
  console.log(bad ? `SELF-TEST FAILED (${bad})` : 'self-test passed');
  return bad ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const specPath = argv.find((a) => !a.startsWith('--'));
  if (!specPath) { console.error('usage: apply-info-rewrites.mjs <rewrites.json> [--dry-run]'); return 2; }
  const dry = argv.includes('--dry-run');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  const byFile = new Map();
  for (const r of spec.rewrites) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }

  const records = [];
  const problems = [];
  for (const [rel, list] of byFile) {
    const abs = path.join(ROOT, rel);
    const raw = fs.readFileSync(abs, 'utf8');
    const doc = JSON.parse(raw);
    for (const r of list) {
      if (r.greeting != null) {
        const before = (doc.greetings || []).find((x) => x.id === r.greeting)?.x;
        const res = applyOneGreeting(doc, r.greeting, r.before ?? before, r.after);
        if (!res.ok) { problems.push(`${rel} greeting ${r.greeting}: ${res.why}`); continue; }
        records.push({ file: rel, greeting: r.greeting, rule: spec.rule, before, after: r.after });
        continue;
      }
      const t = (doc.topics || []).find((x) => x.id === r.topic);
      const before = t?.infos?.[r.index]?.x;
      const res = applyOne(doc, r.topic, r.index, r.before ?? before, r.after);
      if (!res.ok) { problems.push(`${rel} ${r.topic}#${r.index}: ${res.why}`); continue; }
      records.push({ file: rel, topic: r.topic, index: r.index, rule: spec.rule, before, after: r.after });
    }
    if (problems.length) continue;
    const out = JSON.stringify(doc, null, 2) + '\n';
    try { JSON.parse(out); } catch (e) { problems.push(`${rel}: rewrite produced invalid JSON — ${e.message}`); continue; }
    if (!dry) fs.writeFileSync(abs, out);
  }

  if (problems.length) {
    console.error(`apply-info-rewrites: ${problems.length} problem(s), NOTHING written:`);
    for (const p of problems) console.error('  ' + p);
    return 1;
  }
  if (!dry && spec.log) {
    const logPath = path.join(ROOT, spec.log);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
  console.log(`apply-info-rewrites: ${dry ? 'would apply' : 'applied'} ${records.length} rewrite(s) across ${byFile.size} file(s)${spec.log && !dry ? `, logged to ${spec.log}` : ''}`);
  return 0;
}

process.exit(main());
