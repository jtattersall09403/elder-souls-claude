#!/usr/bin/env node
// A duplicate topic id across game/data/dialogue/topics/**/*.json is a defect that nothing
// currently detects. Checked over the JSON with no engine and no browser, by IMPORTING AND
// RUNNING the shipped `game/src/character/converse.js infoAllowed()` — the exact function
// `infoFor()` calls — rather than re-implementing its filter rules and risking a second, drifting
// copy (RULES.md rule 10).
//
// WHY THIS EXISTS
// ----------------
// `buildTopicIndex()` merges every topic record sharing an id across every file in the tree, BY
// DESIGN — its own header says so, and that is the right behaviour for the common case: several
// files legitimately split one topic id into complementary infos (a warmblood merchant's line in
// one file, a saxhleel one in another, disjoint `requires.race` sets, never both valid for the
// same player). A raw "does more than one file declare this id" scan flags that pattern too, and
// on the shipped tree that pattern accounts for the overwhelming majority of matches: a first,
// naive version of this tool found 63 same-id pairs, of which a spot check showed most were
// EXACTLY this — race-complementary infos that can never simultaneously be `infoAllowed()` for
// any one player, so `infoFor()` never has to choose between them and no shadow can occur. A gate
// that fires on that is noise, and noise is how a warning stops being read (`check-prose.mjs`'s
// own header names the same danger for its ratchet).
//
// So this tool asks the question that actually matters: for a same-id pair across two files,
// **can a single player context make BOTH infos `infoAllowed()` at once?** If no such context
// exists, the two files can never compete for the same player and this is the intended additive
// pattern — quiet. If one does exist, `infoFor()`'s specificity score is the only thing deciding
// which text that player hears, and that is exactly the shape of the W1-17 round-1 hard fail:
// `main-quest-argument.json` and `50-mainline.json` both declare `the-steward-of-the-count` —
// Q-MAIN-26's own entry topic — and the eleven-year-old third-person stub in `50-mainline.json`
// (d:20, no race filter — allowed for EVERY race above disposition 20) genuinely overlaps the
// just-authored, race-specific greeting (`forbids` only 3 races, no `d`) for the 7 races neither
// excludes, and specificity picks the stub. Nothing else on the tree catches this shape:
// `check-quests.mjs` never reads the topic files' own id space; `tools/dialogue/build-graph.mjs`'s
// unreachable-INFO lint only flags a strict filter superset (and currently cannot even run — a
// pre-existing duplicate id throws before it reaches any lint); every existing browser probe that
// asks "does this topic answer" only checks that *some* text came back, never *whose*.
//
// WARNING, NOT AN ERROR, AND DELIBERATELY SO — same precedent as `tools/check-prose.mjs`, whose
// own header names `tools/check-quests.mjs`'s attribute-scale audit as the reason: `game/data/
// dialogue/topics/**` is a shared tree a dozen other pieces own, and this tool's first honest run
// still finds live (context-overlapping) collisions that predate W1-17 entirely. A fail-closed
// assertion landed on top of a live backlog would turn a shared gate red for every agent on the
// box over content none of them wrote, which RULES.md rule 13 names as a defect this project has
// already paid for twice. It prints loudly and exits 0. `--strict` exits non-zero, for a piece
// that wants to hold its own line or a future pre-commit hook once the backlog is cleared.
//
// USAGE
//   node tools/check-dialogue-topics.mjs             # the gate: loud warnings, exit 0
//   node tools/check-dialogue-topics.mjs --strict     # exit 1 if any LIVE collision is found
//   node tools/check-dialogue-topics.mjs --all        # also list the partitioned (quiet) pairs
//   node tools/check-dialogue-topics.mjs --self-test  # prove it goes red, and prove it stays quiet
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTopicIndex, infoAllowed } from '../game/src/character/converse.js';
import { topicKey } from '../game/src/core/topics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPICS_DIR = path.join(ROOT, 'game', 'data', 'dialogue', 'topics');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadDocs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, doc: readJSON(path.join(dir, f)) }))
    .filter((d) => d.doc && Array.isArray(d.doc.topics));
}

// The context sweep. Not exhaustive — exhaustive is `corpus/90-verdicts/wave1/artifacts/
// W1-17-act5-r1/gen-converse-node-repro.mjs`'s job for one file under active judgement — but wide
// enough that a genuine race/disposition/knowledge partition (the common, intended pattern) reads
// as partitioned and a genuine overlap (the round-1 defect's shape) reads as live. Races and
// upbringings are read from the shipped rosters rather than hand-copied, so this sweep does not
// silently go stale the day a new race ships.
function loadRaces() {
  const d = readJSON(path.join(ROOT, 'game', 'data', 'progression', 'races.json'));
  return (d && Array.isArray(d.races) && d.races.length) ? d.races : ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
}
const RACES = loadRaces();
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const DISPOSITIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function contextsFor(infos) {
  // Every knowledge key EITHER info's requires/forbids ever names, so the sweep can pass a
  // maximally-permissive `knows` set (satisfies every requires.knows/knows_all at once) as well
  // as the empty set — both directions, since infoAllowed()'s knowledge gate is fail-closed one
  // way (RI-JRN07 M-Q14) and permissive the other.
  const allKnows = new Set();
  for (const info of infos) {
    for (const k of (info.requires?.knows || [])) allKnows.add(k);
    for (const k of (info.requires?.knows_all || [])) allKnows.add(k);
  }
  const knowsVariants = [new Set(), allKnows];
  const ctxs = [];
  for (const race of RACES) {
    for (const upbringing of UPBRINGINGS) {
      for (const disposition of DISPOSITIONS) {
        for (const knows of knowsVariants) {
          ctxs.push({ race, upbringing, disposition, knows });
        }
      }
    }
  }
  return ctxs;
}

/**
 * True if there exists a player context under which BOTH infos are `infoAllowed()` — meaning an
 * NPC whose actor makes both candidates eligible would have `infoFor()` choose between them by
 * specificity score alone, which is the shape that let round 1's shadow ship silent.
 */
function overlaps(infoA, infoB) {
  for (const ctx of contextsFor([infoA, infoB])) {
    if (infoAllowed(infoA, ctx) && infoAllowed(infoB, ctx)) return true;
  }
  return false;
}

/** Would a single NPC's own `topics[]`/`a` ever put both infos in `infoFor()`'s candidate loop?
 *  An actor-less info (`a` unset) is a candidate for EVERY npc (`converse.js infoFor()`'s own
 *  comment: "written for nobody in particular"); an actor-specific info is a candidate only for
 *  an npc whose `actor` equals it. */
function actorCoexists(infoA, infoB) {
  if (!infoA.a || !infoB.a) return true;         // either side is universal
  return infoA.a === infoB.a;                     // both specific: only the same actor sees both
}

export function scan(dir) {
  const files = loadDocs(dir);
  const idx = buildTopicIndex(files.map((f) => f.doc));
  // key -> [{ file, group, info }] — every (file, info) pair under that folded key, so a
  // collision can be judged info-by-info rather than file-by-file (one file may hold several
  // infos for one id, some of which partition cleanly and some of which do not).
  const byKey = new Map();
  for (const { file, doc } of files) {
    for (const t of doc.topics) {
      if (!t || typeof t.id !== 'string') continue;
      const key = topicKey(t.id);
      if (!byKey.has(key)) byKey.set(key, { id: t.id, entries: [] });
      for (const info of (t.infos || [])) byKey.get(key).entries.push({ file, group: doc.group || null, info });
    }
  }

  const live = [];
  const partitioned = [];
  for (const [key, { id, entries }] of byKey) {
    const fileList = [...new Set(entries.map((e) => e.file))];
    if (fileList.length < 2) continue;
    let isLive = false;
    const witnessPairs = [];
    for (let i = 0; i < entries.length && !isLive; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (a.file === b.file) continue;
        if (!actorCoexists(a.info, b.info)) continue;
        if (overlaps(a.info, b.info)) { isLive = true; witnessPairs.push([a, b]); break; }
      }
    }
    (isLive ? live : partitioned).push({ key, id, files: fileList, entries, witnessPairs });
  }
  live.sort((a, b) => a.key.localeCompare(b.key));
  partitioned.sort((a, b) => a.key.localeCompare(b.key));
  return { totalKeys: byKey.size, totalFiles: files.length, live, partitioned };
}

// ------------------------------------------------------------------ self-test
function selfTest() {
  let bad = 0;
  const assertT = (cond, msg) => { if (!cond) { bad++; console.error('FAIL: ' + msg); } };

  assertT(topicKey('the-steward-of-the-count') === 'the steward of the count', 'topicKey slug fold (imported from core/topics.js)');

  // Rule 4 — break the instrument on purpose and confirm it goes red, and confirm it stays quiet
  // on the pattern it is explicitly supposed to let through.
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ck-dlg-'));
  try {
    // (1) A genuine shadow: one file's info is unconditional (no requires/forbids/d at all,
    // matches literally everyone), the other is actor-matched with a race whitelist that leaves
    // most races able to hit BOTH — this must be reported LIVE.
    fs.writeFileSync(path.join(tmp, 'stub.json'), JSON.stringify({ group: 'stub', topics: [{ id: 'the-shared-line', infos: [{ a: 'keeper', x: 'the old stub' }] }] }));
    fs.writeFileSync(path.join(tmp, 'scene.json'), JSON.stringify({ group: 'scene', topics: [{ id: 'the-shared-line', infos: [{ a: 'keeper', x: 'the new scene', forbids: { race: ['dunmer'] } }] }] }));
    const shadow = scan(tmp);
    assertT(shadow.live.some((c) => c.key === 'the shared line'), 'a genuine overlapping shadow (unconditional stub vs a mostly-open scene) is reported LIVE');

    fs.rmSync(path.join(tmp, 'stub.json'));
    fs.rmSync(path.join(tmp, 'scene.json'));

    // (2) The intended pattern: two files split ONE topic id by disjoint race lists (exactly
    // "boots" in the shipped tree, 40-race-gated.json vs 45-speaker-coverage.json) — this must
    // NOT be reported live, because no player can ever be offered both.
    fs.writeFileSync(path.join(tmp, 'warm.json'), JSON.stringify({ group: 'warm', topics: [{ id: 'boots', infos: [{ a: 'merchant', x: 'warmblood line', requires: { race: ['dunmer', 'imperial', 'nord'] } }] }] }));
    fs.writeFileSync(path.join(tmp, 'cold.json'), JSON.stringify({ group: 'cold', topics: [{ id: 'boots', infos: [{ a: 'merchant', x: 'saxhleel line', requires: { race: ['saxhleel', 'naga'] } }] }] }));
    const partition = scan(tmp);
    assertT(!partition.live.some((c) => c.key === 'boots'), 'a race-disjoint split (the shipped "boots" pattern) is NOT reported live');
    assertT(partition.partitioned.some((c) => c.key === 'boots'), 'and is recorded in the quiet, partitioned bucket instead');

    fs.rmSync(path.join(tmp, 'warm.json'));
    fs.rmSync(path.join(tmp, 'cold.json'));

    // (3) Different actors entirely, no requires at all — never candidates for the same NPC.
    fs.writeFileSync(path.join(tmp, 'x.json'), JSON.stringify({ group: 'x', topics: [{ id: 'weather', infos: [{ a: 'fisher', x: 'a' }] }] }));
    fs.writeFileSync(path.join(tmp, 'y.json'), JSON.stringify({ group: 'y', topics: [{ id: 'weather', infos: [{ a: 'guard', x: 'b' }] }] }));
    const disjointActor = scan(tmp);
    assertT(!disjointActor.live.some((c) => c.key === 'weather'), 'two different specific actors never coexist for one NPC — not reported live');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Confirmed positive on the SHIPPED tree. If this ever reads 0 live, either the known W1-17
  // shadow was actually resolved (good — update this assertion) or the scanner broke (bad).
  const shipped = scan(TOPICS_DIR);
  assertT(shipped.live.some((c) => c.key === 'the steward of the count'), 'the shipped tree still reports the known W1-17 shadow ("the steward of the count") LIVE');
  assertT(shipped.partitioned.length > 0, 'the shipped tree has at least one intended, partitioned same-id split (the check would be all-noise otherwise)');

  console.log(bad ? `SELF-TEST FAILED (${bad})` : 'self-test passed: goes red on a genuine overlap, stays quiet on the intended race-partition pattern, and finds the known live shadow on the shipped tree.');
  return bad ? 1 : 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const strict = argv.includes('--strict');
  const all = argv.includes('--all');

  const { totalKeys, totalFiles, live, partitioned } = scan(TOPICS_DIR);

  if (!live.length) {
    console.log(`check-dialogue-topics: ${totalKeys} topic id(s) across ${totalFiles} files; ${partitioned.length} same-id split(s) all cleanly partitioned; 0 live (overlapping) collisions.`);
    return 0;
  }

  console.warn(`check-dialogue-topics: WARNING — ${live.length} topic id(s) declared in more than one file WITH an overlapping player context — a real player could be offered either file's info and `);
  console.warn('  `infoFor()`\'s specificity score, not authorial intent, decides which one they hear.');
  console.warn(`  (${partitioned.length} more same-id split(s) exist but partition cleanly by race/disposition/knowledge — no player can reach both, so they are not listed here${all ? '' : '; pass --all to see them'}.)`);
  console.warn('  See corpus/90-verdicts/wave1/W1-17-act5-r1.md for what an unnoticed one of these looked like once shipped.');
  for (const c of live) {
    console.warn(`  "${c.key}"  <-  ${c.files.join('  &  ')}  (${c.witnessPairs.length} overlapping info pair(s) of ${c.entries.length} total)`);
  }
  if (all && partitioned.length) {
    console.warn(`\n  ${partitioned.length} partitioned (quiet) same-id split(s):`);
    for (const c of partitioned) console.warn(`  "${c.key}"  <-  ${c.files.join('  &  ')}`);
  }

  if (strict) { console.error('check-dialogue-topics: --strict'); return 1; }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
