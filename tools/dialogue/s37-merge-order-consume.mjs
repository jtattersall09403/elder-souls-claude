#!/usr/bin/env node
// s37-merge-order-consume.mjs — CONSUMPTION (RI-MTH07) for the declared topic-file merge order.
//
//   node tools/dialogue/s37-merge-order-consume.mjs          all arms; exit 1 if the fix is inert
//   node tools/dialogue/s37-merge-order-consume.mjs --json <path>
//
// THE MODEL: `game/data/dialogue/topics/_manifest.json`, the declared order of the topic files.
// THE WORLD-SIDE CONSUMER: `Engine.conversationSay()` -> `character/converse.js infoFor()`, which
// resolves against `buildTopicIndex(this.data.character.topicDocs)`. The manifest is read by
// `buildTopicIndex()` and by nothing else, so this tool perturbs the ORDER THE DOCS ARRIVE IN and
// watches what a speaker says.
//
// WHY THE MANIFEST EXISTS, and it is worse than ARBITRATION S37 knew. S37 says the merge order was
// inherited from `readdirSync().sort()`. It was inherited from TWO different sorts that disagreed:
//
//   * every tool built its doc list with `readdirSync().sort()` — by FILENAME;
//   * the engine built its with `Object.keys(out.topics).sort()` (`game/src/engine.js` loadData),
//     keyed on `doc.id || basename`. Three of the 21 topic files carry a top-level `id`
//     (06-opening-roots, 45-speaker-coverage, main-quest-argument), so each sorted to a different
//     position in the running game than in every instrument pointed at it.
//
// 92 of 468 topic ids are declared in more than one file and hold 488 of the 1,280 INFOs; 36 of
// those 92 involve one of the three files that move. Under the scoring reader this was survivable,
// because order only broke ties. Under RI-DLG01 §A first-match-wins the order IS the algorithm, so
// the shipped game and its own gate were resolving two different corpora.
//
// THE ARMS.
//   1. ENGINE-ORDER vs TOOL-ORDER, through the shipped reader. Must be ZERO differing answers:
//      the manifest normalises both to one declared order, so how the docs arrived stops mattering.
//   2. The same comparison through the PRE-MANIFEST reader (--pre). Must be NON-ZERO, or the
//      manifest fixed nothing and this whole file is theatre. This is the control, and it is the
//      arm that has to be watched going red (RULES 6: a control never seen failing is not evidence).
//   3. BREAK: feed the shipped reader a deliberately hostile arrival order (reversed). Must still
//      be zero — the declared order wins over any arrival order, not just over the two accidental
//      ones. Fed to the PRE-MANIFEST reader it must move, which proves arm 3 is not vacuous.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';
import { loadNpcs } from './answer-census.mjs';
import { topicKey } from '../../game/src/core/topics.js';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const ARGV = process.argv.slice(2);
const JSONOUT = (() => { const i = ARGV.indexOf('--json'); return i >= 0 ? ARGV[i + 1] : null; })();
const PRE = (() => { const i = ARGV.indexOf('--pre'); return i >= 0 ? ARGV[i + 1] : null; })();

const DIR = path.join(ROOT, 'game/data/dialogue/topics');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));

function load() {
  return files.map((f) => ({ file: f, doc: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
}
// The tools' order: readdirSync().sort(), i.e. by filename.
function toolOrder(rows) { return rows.slice().sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)).map((r) => r.doc); }
// The engine's order: Object.keys(out.topics).sort(), keyed on `doc.id || basename`.
// Replicated from game/src/engine.js loadData()/out.character.topicDocs.
function engineOrder(rows) {
  const keyed = rows.map((r) => ({ k: r.doc.id || r.file.replace(/\.json$/, ''), doc: r.doc }));
  return keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((r) => r.doc);
}
function reversedOrder(rows) { return toolOrder(rows).slice().reverse(); }

// A small but real resolution space: every topic, every distinct speaker actor+cell, a spread of
// players. It does not need to be exhaustive — this arm asks whether the answers MOVE, and one
// moved answer is the whole finding.
const npcs = loadNpcs();
const rr = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8'));
const PLAYERS = [];
for (const race of rr.races) for (const disposition of [0, 30, 60, 90]) {
  PLAYERS.push({ race, upbringing: rr.upbringings[0].id, disposition, knows: new Set() });
}
// one speaker per distinct (actor, settlement) — the two speaker-side filter fields
const SPEAKERS = (() => {
  const seen = new Set(), out = [];
  for (const n of npcs) {
    const k = `${n.actor || '-'}|${n.settlement || n.cell || '-'}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(n);
  }
  return out;
})();

async function readerAt(p) {
  const href = p ? url.pathToFileURL(path.resolve(ROOT, p)).href
    : new URL('../../game/src/character/converse.js', import.meta.url).href;
  const m = await import(href);
  if (typeof m.buildTopicIndex !== 'function' || typeof m.infoFor !== 'function') {
    console.error(`reader ${href} does not export buildTopicIndex/infoFor`); process.exit(2);
  }
  return m;
}

/** Answers that differ between two doc arrival orders, through one reader. */
function compare(mod, docsA, docsB) {
  let idxA, idxB;
  try { idxA = mod.buildTopicIndex(docsA); idxB = mod.buildTopicIndex(docsB); }
  catch (e) { return { error: e.message }; }
  const ids = [...new Set(docsA.flatMap((d) => (d.topics || []).filter((t) => t && typeof t.id === 'string').map((t) => t.id)))].sort();
  let compared = 0, differing = 0;
  const topics = new Set(); const examples = [];
  for (const tid of ids) {
    if (!idxA.get(topicKey(tid)) || !idxB.get(topicKey(tid))) continue;
    for (const npc of SPEAKERS) for (const p of PLAYERS) {
      const a = mod.infoFor(idxA, tid, npc, p);
      const b = mod.infoFor(idxB, tid, npc, p);
      compared++;
      const ta = a ? a.text : null, tb = b ? b.text : null;
      if (ta !== tb) {
        differing++; topics.add(tid);
        if (examples.length < 6) examples.push({ topic: tid, speaker: npc.id, actor: npc.actor || null, race: p.race, disposition: p.disposition, a: String(ta || '').slice(0, 90), b: String(tb || '').slice(0, 90) });
      }
    }
  }
  return { compared, differing, topics: [...topics], examples };
}

const rows = load();
const orders = { tool: toolOrder(rows), engine: engineOrder(rows), reversed: reversedOrder(rows) };
const shipped = await readerAt(null);
const pre = PRE ? await readerAt(PRE) : null;

const out = { commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })(), arms: {} };

console.log('s37-merge-order-consume — CONSUMPTION (RI-MTH07) for the declared topic-file merge order');
console.log(`model    : game/data/dialogue/topics/_manifest.json`);
console.log(`consumer : Engine.conversationSay() -> character/converse.js infoFor() over buildTopicIndex()`);
console.log(`space    : ${orders.tool.length} topic docs, ${SPEAKERS.length} distinct (actor, place) speakers, ${PLAYERS.length} players\n`);

function say(label, r, expect) {
  if (r.error) { console.log(`  ${label.padEnd(46)} THREW: ${r.error.slice(0, 90)}`); return 'threw'; }
  const verdict = expect === 'zero' ? (r.differing === 0 ? 'OK' : 'FAIL') : (r.differing > 0 ? 'OK' : 'FAIL');
  console.log(`  ${label.padEnd(46)} ${String(r.differing).padStart(6)} / ${String(r.compared).padStart(7)} answers differ  in ${String(r.topics.length).padStart(3)} topic(s)   ${verdict}`);
  return verdict;
}

let bad = 0;
console.log('ARM 1 — SHIPPED reader (manifest read). Arrival order must stop mattering:');
const a1 = compare(shipped, orders.tool, orders.engine);
const a1b = compare(shipped, orders.tool, orders.reversed);
if (say('engine arrival order vs tool arrival order', a1, 'zero') !== 'OK') bad++;
if (say('reversed arrival order vs tool arrival order', a1b, 'zero') !== 'OK') bad++;
out.arms.shipped = { engine_vs_tool: a1, reversed_vs_tool: a1b };

if (pre) {
  console.log('\nARM 2 — THE CONTROL: the PRE-MANIFEST reader, same corpus, same comparison.');
  console.log('        This MUST move, or the manifest fixed nothing (RULES 6).');
  const a2 = compare(pre, orders.tool, orders.engine);
  const a2b = compare(pre, orders.tool, orders.reversed);
  if (say('engine arrival order vs tool arrival order', a2, 'nonzero') !== 'OK') bad++;
  if (say('reversed arrival order vs tool arrival order', a2b, 'nonzero') !== 'OK') bad++;
  out.arms.pre = { engine_vs_tool: a2, reversed_vs_tool: a2b };
  if (a2.examples.length) {
    console.log('\n  what the running game said vs what every instrument measured, BEFORE the manifest:');
    for (const e of a2.examples.slice(0, 3)) {
      console.log(`    ${e.topic}  (${e.speaker}, actor ${e.actor}, ${e.race} d${e.disposition})`);
      console.log(`      tool order  : ${e.a}`);
      console.log(`      engine order: ${e.b}`);
    }
  }
} else {
  console.log('\nARM 2 SKIPPED — pass --pre <path to a pre-manifest converse.js> to run the control.');
  console.log('        Without it this tool has only ever been seen passing, which is half a probe.');
}

console.log('\nARM 3 — the fail-closed half: a topic file outside the manifest must be an ERROR.');
{
  const rogue = JSON.parse(JSON.stringify(orders.tool));
  rogue.push({ group: 'a-group-nobody-declared', topics: [{ id: 'duties', infos: [{ x: 'rogue' }] }] });
  let threw = null;
  try { shipped.buildTopicIndex(rogue); } catch (e) { threw = e.message; }
  if (threw) { console.log(`  unlisted topic file rejected                    OK — "${threw.slice(0, 80)}..."`); }
  else { console.log('  unlisted topic file was SILENTLY APPENDED       FAIL — the manifest is advisory, not declared.'); bad++; }
  out.arms.fail_closed = { threw };

  // and the manifest itself must be required when corpus docs are present
  let threw2 = null;
  const noManifest = orders.tool.filter((d) => d.schema !== 'elder-souls/dialogue-topic-manifest@1');
  try { shipped.buildTopicIndex(noManifest); } catch (e) { threw2 = e.message; }
  if (threw2) console.log(`  missing manifest rejected                      OK — "${threw2.slice(0, 80)}..."`);
  else { console.log('  missing manifest was tolerated                 FAIL — accidental order can come back.'); bad++; }
  out.arms.fail_closed.threw_missing = threw2;

  // ...but a hand-built fixture with no groups must still work, or every unit test in the tree dies
  let ok3 = false;
  try { const i = shipped.buildTopicIndex([{ topics: [{ id: 'x', infos: [{ x: 'hello' }] }] }]); ok3 = !!i.get(topicKey('x')); } catch { ok3 = false; }
  if (ok3) console.log('  hand-built fixture (no groups) still loads     OK — the assertion is narrow.');
  else { console.log('  hand-built fixture THREW                       FAIL — this breaks every bare unit test (RULES 13).'); bad++; }
  out.arms.fail_closed.fixture_ok = ok3;
}

if (JSONOUT) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, JSONOUT)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, JSONOUT), JSON.stringify(out, null, 2) + '\n');
  console.log(`\njson -> ${JSONOUT}`);
}
console.log(`\nmeasured at commit ${out.commit} (RULES 12 — a number is a claim about a commit)`);
if (bad) { console.error(`\nFAIL — ${bad} arm(s) did not behave as the manifest requires.`); process.exit(1); }
console.log('\nOK — the declared order is read, the arrival order is inert, and an undeclared file is refused.');
