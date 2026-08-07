#!/usr/bin/env node
// A duplicate topic id across game/data/dialogue/topics/**/*.json is a defect that nothing
// currently detects. Checked over the JSON with no engine and no browser.
//
// WHY THIS EXISTS
// ----------------
// `game/src/character/converse.js buildTopicIndex()` merges every topic record sharing an id
// across every file in the tree, BY DESIGN — its own header says a topic id may be declared more
// than once and the reader is supposed to see every info written for it, wherever it lives. That
// is the right behaviour for the common case (`the-tides` legitimately collects a fisher's line,
// a saxhleel line and a warmblood line from three different files). It is the WRONG behaviour,
// silently, the moment two files declare the SAME id meaning TWO DIFFERENT THINGS — an old stub
// and a newly-authored scene, say — because `infoFor()` then picks between them by a specificity
// score nobody who wrote either file was thinking about when they chose that id.
//
// That is exactly the W1-17 round-1 hard fail: `main-quest-argument.json` and `50-mainline.json`
// both declare a topic record with id `the-steward-of-the-count` — Q-MAIN-26's own entry topic —
// and the eleven-year-old third-person stub in `50-mainline.json` (d:20, no race filter) outscores
// the just-authored, race-specific greeting for any player outside {saxhleel,naga,dunmer} clearing
// disposition 20. Nothing on the tree caught it: `check-quests.mjs` checks quest ids and
// `hooks.json` cross-references, never the topic files' own id space; `check-content.mjs` checks
// that a quest resolution has not disappeared; `tools/dialogue/build-graph.mjs`'s unreachable-INFO
// lint only flags a strict filter superset, a different failure shape entirely, and in any case
// currently cannot even run (a pre-existing duplicate id throws before it reaches any lint). This
// tool asks one narrow, cheap question instead: does more than one FILE declare the same topic id?
// It says nothing about whether the collision is harmless (two legitimately complementary infos)
// or a shadow (a stub eating a scene) — that judgement needs a player-signature sweep like
// `corpus/90-verdicts/wave1/artifacts/W1-17-act5-r1/gen-converse-node-repro.mjs` ran by hand for
// this one case — but every collision is now at least VISIBLE, which the round-1 one was not.
//
// WARNING, NOT AN ERROR, AND DELIBERATELY SO — same precedent as `tools/check-prose.mjs`, whose
// own header names `tools/check-quests.mjs`'s attribute-scale audit as the reason: `game/data/
// dialogue/topics/**` is a shared tree that a dozen other pieces own, and cross-file id reuse is
// not new or rare here. This tool's own first run found SIX pre-existing collisions on the tree
// (the-witness, reading-the-count, the-cutters-terms, the-steward-of-the-count, the-sill, the-
// opening-of-the-count) — three of them nothing to do with W1-17 at all. A fail-closed assertion
// landed on top of six live collisions would turn a shared gate red for every agent on the box
// over content none of them own, which RULES.md rule 13 names as a defect this project has
// already paid for. It prints loudly and exits 0. `--strict` exits non-zero, for a piece that
// wants to hold its own line or a future pre-commit hook once the backlog is cleared.
//
// USAGE
//   node tools/check-dialogue-topics.mjs             # the gate: loud warnings, exit 0
//   node tools/check-dialogue-topics.mjs --strict     # exit 1 if any collision is found
//   node tools/check-dialogue-topics.mjs --self-test  # prove it goes red, and prove it stays quiet
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPICS_DIR = path.join(ROOT, 'game', 'data', 'dialogue', 'topics');

// Local re-implementation of `game/src/core/topics.js topicKey()` — copied rather than imported
// so this check has no dependency on the engine module tree, the same isolation `check-prose.mjs`
// chose for its own text primitives. Kept in lockstep by the self-test below, which asserts the
// two known-equal spellings the core module's own docstring gives as examples.
function topicKey(id) {
  return String(id == null ? '' : id)
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/** { key -> [{ id, file, group }] } across every *.json in `dir`. Exported for the self-test. */
export function scanTopicFiles(dir) {
  const byKey = new Map();
  if (!fs.existsSync(dir)) return byKey;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const doc = readJSON(path.join(dir, f));
    if (!doc || !Array.isArray(doc.topics)) continue;
    for (const t of doc.topics) {
      if (!t || typeof t.id !== 'string') continue;
      const key = topicKey(t.id);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ id: t.id, file: f, group: doc.group || null });
    }
  }
  return byKey;
}

/** Collisions only: every key declared by more than one distinct file. */
export function findCollisions(byKey) {
  const out = [];
  for (const [key, rows] of byKey) {
    const files = [...new Set(rows.map((r) => r.file))];
    if (files.length > 1) out.push({ key, rows, files });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function report(dir) {
  const byKey = scanTopicFiles(dir);
  const collisions = findCollisions(byKey);
  return { byKey, collisions };
}

// ------------------------------------------------------------------ self-test
function selfTest() {
  let bad = 0;
  const assertT = (cond, msg) => { if (!cond) { bad++; console.error('FAIL: ' + msg); } };

  // topicKey parity with core/topics.js's own documented examples (rule 4: the fold this tool
  // depends on must behave the same way the reader it is warning about does).
  assertT(topicKey('the-steward-of-the-count') === 'the steward of the count', 'topicKey slug fold');
  assertT(topicKey("the cutters' terms") === topicKey('the-cutters-terms'), 'topicKey apostrophe fold');

  // Rule 4 — break the instrument on purpose and confirm it goes red. A synthetic tree with two
  // files declaring the same id must be caught; a clean tree must report zero.
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ck-dlg-'));
  try {
    fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify({ group: 'a', topics: [{ id: 'shared-id', infos: [{ x: 'from a' }] }] }));
    fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify({ group: 'b', topics: [{ id: 'shared-id', infos: [{ x: 'from b' }] }] }));
    const dirty = report(tmp);
    assertT(dirty.collisions.length === 1, 'a synthetic two-file collision is caught');
    assertT(dirty.collisions[0]?.files?.length === 2, 'the collision names both files');

    fs.rmSync(path.join(tmp, 'b.json'));
    fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify({ group: 'b', topics: [{ id: 'not-shared', infos: [{ x: 'from b' }] }] }));
    const clean = report(tmp);
    assertT(clean.collisions.length === 0, 'a clean two-file tree with distinct ids reports zero');

    // Same id, folded spellings — dashed vs spaced — must still collide, because that is exactly
    // the slug-vs-prose fold `converse.js buildTopicIndex()` performs before it merges.
    fs.rmSync(path.join(tmp, 'b.json'));
    fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify({ group: 'b', topics: [{ id: 'shared id', infos: [{ x: 'from b, spaced' }] }] }));
    const folded = report(tmp);
    assertT(folded.collisions.length === 1, 'a folded-spelling collision (dash vs space) is still caught');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Confirmed positive on the SHIPPED tree — this must currently be non-zero, because the round-1
  // verdict this tool exists to make routine found the collision by hand and this is the check
  // that should have. If this ever reads 0 it means either the tree's known collisions were
  // resolved (good — update this assertion) or the scanner broke (bad — investigate).
  const live = report(TOPICS_DIR);
  assertT(live.collisions.length >= 1, 'the shipped tree has at least the one known collision (the-steward-of-the-count and siblings)');

  console.log(bad ? `SELF-TEST FAILED (${bad})` : 'self-test passed (instrument goes red on a synthetic collision, quiet on a clean tree, and finds the known live one)');
  return bad ? 1 : 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const strict = argv.includes('--strict');

  const { byKey, collisions } = report(TOPICS_DIR);

  if (!collisions.length) {
    console.log(`check-dialogue-topics: ${byKey.size} topic id(s) across ${fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json')).length} files, 0 cross-file collisions.`);
    return 0;
  }

  console.warn(`check-dialogue-topics: WARNING — ${collisions.length} topic id(s) declared in more than one file.`);
  console.warn('  buildTopicIndex() merges these BY DESIGN and infoFor() picks between them by a');
  console.warn('  specificity score; a collision is not automatically wrong, but every one of them is a');
  console.warn('  place a same-id record can silently shadow the one an author meant a player to hear.');
  console.warn('  See corpus/90-verdicts/wave1/W1-17-act5-r1.md for what that looked like once it shipped.');
  for (const c of collisions) {
    const spellings = [...new Set(c.rows.map((r) => r.id))];
    console.warn(`  "${c.key}"  <-  ${c.rows.map((r) => `${r.id} (${r.file})`).join('  &  ')}` + (spellings.length > 1 ? '   [also a spelling fold, not just a repeat]' : ''));
  }

  if (strict) { console.error('check-dialogue-topics: --strict'); return 1; }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
