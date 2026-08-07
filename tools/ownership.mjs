#!/usr/bin/env node
// ownership.mjs — the file-ownership registry: who is touching what, right now.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
//
// A dozen agents run at once and collide in ways nobody planned. In one day: one agent's
// `git add -A` staged another's temporary delete-the-fix; a builder restored a whole engine.js
// around an experiment while three others were writing it; two agents independently fixed the
// same dangling skill id; a critic's own artifact was overwritten by its own sabotage run because
// every run wrote the same path. None of that is a parallelism problem — the floor stays at 12
// agents. It is a VISIBILITY problem: nobody could see what anybody else was about to touch.
//
// This tool answers three questions from `orchestration/status/*.json`, the file every agent
// already writes (RULES.md rule 1):
//   1. which files each in-flight ("live") piece has declared,
//   2. which files two or more LIVE pieces both claim, undeclared,
//   3. which live pieces declare NOTHING — the number that matters, because a piece that
//      declares nothing is invisible to everyone else no matter how careful they are.
//
// ---------------------------------------------------------------------------------------------
// THE CONVENTION (orchestration/RULES.md rule 16)
// ---------------------------------------------------------------------------------------------
//
// A status file may add two plain arrays of repo-relative paths:
//   "files_touched":  [...]   -- paths you have already written
//   "files_claimed":  [...]   -- paths you expect to write next
// A path ending in "/" is a directory claim (e.g. "game/src/sim/quest/") and collides with any
// path under it. That is the whole shape — cheap on purpose, because an agent mid-task will not
// maintain anything heavier, and a registry nobody updates is worse than no registry.
//
// ---------------------------------------------------------------------------------------------
// COLLISION VS. DELIBERATE REDUNDANCY
// ---------------------------------------------------------------------------------------------
//
// This project's whole method is independent criticism (RULES.md rule 22). Two critics attacking
// the same piece from different angles, or two builders testing competing hypotheses on the same
// file, are WANTED, not a bug. A status file may declare:
//   "redundant_with": ["<other task_id>", ...]
// naming a live piece it deliberately overlaps. Declaring it from either side is enough. This
// tool never reports a pair that has declared each other as a conflict, and `--conflicts` never
// fails on one. The goal is to make collisions visible, not to make a second independent look
// cost anything — a registry that punished redundancy would train agents to stop declaring their
// files at all, which is the one failure mode worse than the one this tool exists to fix.
//
// ---------------------------------------------------------------------------------------------
// ADVISORY, NOT ENFORCED — AND WHY, ARGUED AGAINST THE PRECEDENT
// ---------------------------------------------------------------------------------------------
//
// `tools/check-quests.mjs` is a fail-closed shared gate over content nobody owns, and this
// project has paid for that pattern four times: a dangling reference used to throw from inside
// `new QuestEngine(...)`, so one author's unfinished hook failed every OTHER agent's boot-check,
// because every agent boot-checks before it measures. The fix there was to move the assertion out
// of the constructor and into a check that runs at commit time, over data that is actually
// structurally verifiable against the shipped tree (does the quest a hook names exist? yes or no
// — nobody has to trust the author's memory).
//
// An ownership conflict is a different kind of claim. It is SELF-REPORTED: the only evidence that
// piece A is "in" game/src/engine.js is that piece A's own status file says so, written by an
// agent under exactly the pressure (kill-without-warning restarts, a budget to finish) that makes
// stale fields likely. A `files_claimed` entry an agent never got round to deleting after
// finishing that file is not a lie, it is normal decay — and normal decay is not something a
// fail-closed gate should be allowed to act on. If `--conflicts` were wired into boot-check or
// the pre-commit hook the way check-quests is, one agent's stale claim would turn the gate red for
// everybody on the box, over a collision that may not even be real — exactly the four-times-paid
// failure this file's own header is warning against, made worse because there is no way to verify
// the claim against the tree the way a quest reference can be verified.
//
// So: THIS TOOL IS ADVISORY. It is not wired into `.githooks/pre-commit` or
// `tools/boot-check.mjs`, and it must not be. Its non-zero exit on `--conflicts` is for a
// DISPATCHER to check by choice before adding a thirteenth agent to a busy area (see
// `orchestration/TICK.md` §3) — a decision a person or an orchestrating agent can weigh against
// what it already knows, not a gate that silently blocks a commit no one asked it to judge. If
// this ever earns real trust — every live piece declaring files, few stale entries in practice —
// promoting the `--for`/`--conflicts` check into something stronger would be a fair call to
// revisit. It has not earned that yet, and a registry that starts enforced never gets the chance
// to find out, because the first false positive teaches everyone to stop declaring.
//
// ---------------------------------------------------------------------------------------------
// USAGE
// ---------------------------------------------------------------------------------------------
//
//   node tools/ownership.mjs                 human report: declared files, conflicts, blind pieces
//   node tools/ownership.mjs --conflicts     conflict check only; EXITS NON-ZERO if any undeclared
//                                             overlap exists among live pieces
//   node tools/ownership.mjs --for <path>    who -- among live pieces -- is in this file right now
//   node tools/ownership.mjs --self-test     prove a real overlap goes red and a declared-redundant
//                                             one stays quiet (RULES.md rule 4)

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const STATUS_DIR = join(ROOT, 'orchestration', 'status');

// Identical to the test tools/gen-index.mjs uses for "in flight", on purpose: this tool and
// INDEX.md must never disagree about who counts as live.
const DONE_RE = /complete|blocked/i;

function uniqStrings(a) {
  return Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && x))] : [];
}

/** Read every status file in `dir` into a flat record. Pure I/O, no judgement. */
function loadRecords(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    let j;
    try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const task_id = j.task_id || f.replace(/\.json$/, '');
    out.push({
      task_id,
      file: f,
      state: j.state || '?',
      live: !DONE_RE.test(j.state || ''),
      files_touched: uniqStrings(j.files_touched),
      files_claimed: uniqStrings(j.files_claimed),
      redundant_with: uniqStrings(j.redundant_with),
    });
  }
  return out;
}

function declared(rec) {
  return new Set([...rec.files_touched, ...rec.files_claimed]);
}

// A directory claim ("game/src/sim/quest/") collides with anything under it; otherwise exact
// path equality. Cheap: still just string comparison, no glob engine.
function pathsOverlap(a, b) {
  if (a === b) return true;
  if (a.endsWith('/') && b.startsWith(a)) return true;
  if (b.endsWith('/') && a.startsWith(b)) return true;
  return false;
}

function isDeclaredRedundant(a, b) {
  return a.redundant_with.includes(b.task_id) || b.redundant_with.includes(a.task_id);
}

/** Core computation, pure — no disk, no process.exit — so --self-test can drive it directly and
 *  so the CLI's three modes (report / --conflicts / --for) share one answer. */
function analyse(records) {
  const live = records.filter((r) => r.live);
  const conflicts = [];  // { claimants:[id,id], files:[overlap,...] } -- undeclared
  const redundant = [];  // same shape -- declared wanted, reported but never a conflict
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const aFiles = [...declared(a)], bFiles = [...declared(b)];
      const overlaps = new Set();
      for (const pa of aFiles) for (const pb of bFiles) {
        if (pathsOverlap(pa, pb)) overlaps.add(pa === pb ? pa : `${pa} ~ ${pb}`);
      }
      if (!overlaps.size) continue;
      const entry = { claimants: [a.task_id, b.task_id], files: [...overlaps] };
      (isDeclaredRedundant(a, b) ? redundant : conflicts).push(entry);
    }
  }
  const blind = live.filter((r) => declared(r).size === 0).map((r) => r.task_id);
  return { live, conflicts, redundant, blind };
}

// ---- reporting -------------------------------------------------------------------------------

function printFullReport(live, conflicts, redundant, blind) {
  console.log(`ownership: ${live.length} live piece(s).\n`);

  console.log('Declared files, by live piece:');
  for (const r of live) {
    const files = declared(r);
    if (!files.size) { console.log(`  ${r.task_id}  [${r.state}]  -- declares nothing`); continue; }
    console.log(`  ${r.task_id}  [${r.state}]`);
    for (const p of r.files_touched) console.log(`    touched  ${p}`);
    for (const p of r.files_claimed) if (!r.files_touched.includes(p)) console.log(`    claimed  ${p}`);
  }

  console.log(`\nConflicts — undeclared overlap among live pieces: ${conflicts.length}`);
  for (const c of conflicts) console.log(`  CONFLICT  ${c.files.join(', ')}  <-  ${c.claimants.join(' , ')}`);

  console.log(`\nDeclared redundancy — wanted, not a conflict: ${redundant.length}`);
  for (const r of redundant) console.log(`  redundant  ${r.files.join(', ')}  <-  ${r.claimants.join(' , ')}`);

  console.log(`\nDeclares nothing — invisible to everyone else: ${blind.length}/${live.length}`);
  for (const b of blind) console.log(`  BLIND  ${b}`);
}

function printConflicts(conflicts, redundant, liveCount) {
  if (!conflicts.length) {
    const note = redundant.length ? ` (${redundant.length} declared-redundant overlap(s) not counted)` : '';
    console.log(`ownership --conflicts: clean. 0 undeclared overlaps among ${liveCount} live piece(s).${note}`);
    return;
  }
  console.error(`ownership --conflicts: ${conflicts.length} undeclared overlap(s) among live pieces:`);
  for (const c of conflicts) console.error(`  ${c.files.join(', ')}  <-  ${c.claimants.join(' , ')}`);
  console.error('If this is wanted (a second critic, a competing hypothesis), have either side add');
  console.error('"redundant_with": ["<other task_id>"] to its status file. Otherwise, dispatch the');
  console.error('next agent somewhere unclaimed instead of into this file.');
}

function reportFor(live, target) {
  const norm = target.replace(/^\.\//, '');
  const hits = live.filter((r) => [...declared(r)].some((p) => pathsOverlap(p, norm)));
  if (!hits.length) { console.log(`ownership --for ${norm}: nobody live has declared this file.`); return; }
  console.log(`ownership --for ${norm}: ${hits.length} live piece(s):`);
  for (const r of hits) {
    const touched = r.files_touched.some((p) => pathsOverlap(p, norm));
    const claimed = r.files_claimed.some((p) => pathsOverlap(p, norm));
    const kind = touched && claimed ? 'touched+claimed' : touched ? 'touched' : 'claimed';
    console.log(`  ${r.task_id}  [${r.state}]  ${kind}`);
  }
  if (hits.length > 1) {
    let allDeclared = true;
    for (let i = 0; i < hits.length && allDeclared; i++) {
      for (let j = i + 1; j < hits.length; j++) if (!isDeclaredRedundant(hits[i], hits[j])) { allDeclared = false; break; }
    }
    console.log(allDeclared ? '  (declared redundant -- wanted overlap)' : '  UNDECLARED OVERLAP -- check before adding a third.');
  }
}

// ---- self-test ---------------------------------------------------------------------------
// A probe that cannot fail is worse than no probe (RULES.md rule 4). Each case writes REAL status
// files to a temp status dir and drives the actual loadRecords()/analyse() path -- not a
// reimplementation -- so this proves the shipped tool, not a model of it.
function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'ownership-selftest-'));
  const write = (name, obj) => writeFileSync(join(dir, name), JSON.stringify(obj));
  let failures = 0;
  const fail = (msg) => { console.error(`ownership --self-test: FAILED — ${msg}`); failures++; };

  try {
    // 1. A real, undeclared overlap between two live pieces must be caught.
    write('a.json', { task_id: 'a', state: 'building', files_claimed: ['game/src/engine.js'] });
    write('b.json', { task_id: 'b', state: 'building', files_touched: ['game/src/engine.js'] });
    let { conflicts, redundant } = analyse(loadRecords(dir));
    if (conflicts.length !== 1 || !conflicts[0].files.includes('game/src/engine.js')) fail('did not catch a real undeclared overlap on the same file');
    if (redundant.length !== 0) fail('a real undeclared overlap was reported as redundant');

    // 2. The same overlap, declared redundant from one side, must stay quiet.
    write('a.json', { task_id: 'a', state: 'building', files_claimed: ['game/src/engine.js'], redundant_with: ['b'] });
    ({ conflicts, redundant } = analyse(loadRecords(dir)));
    if (conflicts.length !== 0) fail('a declared-redundant overlap was still reported as a conflict');
    if (redundant.length !== 1) fail('a declared-redundant overlap was not recorded at all');

    // 3. A directory claim collides with a file written under it.
    write('a.json', { task_id: 'a', state: 'building', files_claimed: ['game/src/sim/quest/'] });
    write('b.json', { task_id: 'b', state: 'building', files_touched: ['game/src/sim/quest/goals.js'] });
    ({ conflicts } = analyse(loadRecords(dir)));
    if (conflicts.length !== 1) fail('a directory claim did not collide with a file written under it');

    // 4. A live piece that declares nothing is flagged blind.
    write('a.json', { task_id: 'a', state: 'building' });
    write('b.json', { task_id: 'b', state: 'building', files_touched: ['game/src/sim/quest/goals.js'] });
    write('c.json', { task_id: 'c', state: 'researching' });
    let res = analyse(loadRecords(dir));
    if (!res.blind.includes('a') || !res.blind.includes('c')) fail('did not flag a piece that declares nothing');
    if (res.blind.includes('b')) fail('flagged a piece that DID declare a file as blind');

    // 5. A completed piece never counts as live, even naming the same file.
    write('a.json', { task_id: 'a', state: 'complete', files_touched: ['game/src/engine.js'] });
    write('b.json', { task_id: 'b', state: 'building', files_claimed: ['game/src/engine.js'] });
    write('c.json', { task_id: 'c', state: 'complete', files_touched: ['game/src/engine.js'] });
    res = analyse(loadRecords(dir));
    if (res.conflicts.length !== 0) fail('a completed piece was treated as live and produced a conflict');

    console.log(`ownership --self-test: ${failures === 0 ? 'PASS (5/5)' : `${failures} FAILURE(S)`}`);
    return failures ? 1 : 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- CLI ---------------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--self-test')) process.exit(selfTest());

const records = loadRecords(STATUS_DIR);

const forIx = args.indexOf('--for');
if (forIx !== -1) {
  const target = args[forIx + 1];
  if (!target) { console.error('ownership: --for requires a path, e.g. --for game/src/engine.js'); process.exit(2); }
  reportFor(records.filter((r) => r.live), target);
  process.exit(0);
}

const { live, conflicts, redundant, blind } = analyse(records);

if (args.includes('--conflicts')) {
  printConflicts(conflicts, redundant, live.length);
  process.exit(conflicts.length ? 1 : 0);
}

printFullReport(live, conflicts, redundant, blind);
process.exit(0);
