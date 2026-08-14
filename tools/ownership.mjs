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
//                                             one stays quiet (RULES.md rule 4), and prove the
//                                             freshness fix (2026-08-14) both directions
//
// Every report now shows each live piece's age (time since its status file last changed) and a
// [STALE? verify before trusting] hint past 2 days. This is deliberately not a second gate --
// see ADVISORY note below -- it exists so a human or orchestrator glancing at `--for <path>`
// output does not have to open five status files by hand to notice a claim has gone quiet.

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const STATUS_DIR = join(ROOT, 'orchestration', 'status');

// ---------------------------------------------------------------------------------------------
// FRESHNESS — added 2026-08-14, orchestration/status/OWNERSHIP-SWEEP-20260814.json
// ---------------------------------------------------------------------------------------------
//
// The sweep that added this found the registry over-reporting for two structural reasons, not
// one: agents genuinely forget to clear a finished claim, but a LARGE share of the "live" count
// was never real disagreement about whether a piece was done — it was this tool failing to read
// the field that said so.
//
//   1. 78 of 452 status files (2026-08-14 count) record completion in `"status"`, not `"state"`.
//      The old code read only `j.state`, so every one of those 78 displayed as state `?` and
//      counted live regardless of what its own `status` field said — 20 of them literally say
//      `"status": "done"`, 31 say `"complete"`. Fix: read `state`, falling back to `status`.
//   2. The terminal-word regex was tested against raw text, so `"builder_delivery_complete"`
//      never matched `/complete/` at a word boundary the way plain `"complete"` does, and
//      (worse, the other direction) a naive substring test would have wrongly matched
//      `"builder_delivery_incomplete"`. Fix: normalise `_`/`-` to spaces before testing, so
//      compound machine-generated state strings get real word boundaries either way.
//
// Neither change makes the tool trust prose (`next_step` text is NOT parsed here — that is a
// judgement call an orchestrator should still make by eye, and it is exactly the kind of soft
// signal a fail-closed gate must not act on per the ADVISORY note below). Both changes only make
// the tool read the two structured fields agents already write, correctly.
const TERMINAL_WORD_RE =
  /\b(complete|completed|done|closed|landed|committed|published|banked|fixed|satisfied|delivered|filed|blocked)\b/i;

// A builder handed to a critic has, by definition, stopped editing its own claimed files -- a
// critic reads and judges, it does not write source. `built_awaiting_critic` is the calibration
// case the sweep was dispatched with by name: state text alone (no "complete"/"done" word) but
// unambiguously means "my own edits are finished". Matches "awaiting critic", "awaiting a fresh
// critic", "awaiting recriticism", "awaiting fresh recriticism" -- "critic" is a substring of
// "recriticism", so a short-window search after "awaiting" catches all of them without
// enumerating every phrasing. `(?!al)` excludes "awaiting a critical fix", where "critic" is
// only the first six letters of an unrelated word.
const AWAITING_CRITIC_RE = /\bawaiting\b[\s\S]{0,20}\bcritic(?!al)/i;

function normaliseForMatch(s) {
  return String(s || '').replace(/[_-]+/g, ' ');
}

/** True if the piece's own recorded state text asserts an endpoint. Tests BOTH `state` and
 *  `status` (see FRESHNESS note above) rather than picking one -- a file that carries a specific
 *  `state` and a stale-looking `status`, or vice versa, must not have the terminal one shadowed
 *  by the other. An explicit `ownership_claim_released` always wins outright, because that is a
 *  fact about the CLAIM (retired by a sweep), not a guess from state text. */
function isTerminal(j) {
  if (j && j.ownership_claim_released) return true;
  const combined = normaliseForMatch(`${(j && j.state) || ''} ${(j && j.status) || ''}`);
  return TERMINAL_WORD_RE.test(combined) || AWAITING_CRITIC_RE.test(combined);
}

function uniqStrings(a) {
  return Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && x))] : [];
}

/** Whole days since this status file's content last actually changed.
 *
 *  This MUST be git-log-based, not mtime. Measured directly on this tree: hundreds of status
 *  files share the exact same millisecond mtime (`2026-08-14T08:15:24.4xxZ`, 452 files fall into
 *  five such clusters) because a checkout/bank pass touched them without changing their content --
 *  mtime answers "when was this last written to disk", not "when did anyone last work on this
 *  piece", and on a tree with a whole-tree bank running every few minutes (RULES.md, HAZARDS.md
 *  §12) those are different questions with very different answers. `git log -1` per file is a
 *  subprocess per live piece, not per tool-call round-trip (rule 19b's actual target), and is
 *  only run for LIVE pieces -- the ones this report displays -- so the cost is bounded by the
 *  live count (~50-200), not the full 452. */
function ageDays(relPath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', relPath],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!out) return null;
    return (Date.now() / 1000 - Number(out)) / 86400;
  } catch { return null; }
}

/** Read every status file in `dir` into a flat record. Pure I/O, no judgement. */
function loadRecords(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    let j;
    try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const task_id = j.task_id || f.replace(/\.json$/, '');
    const stateText = (j.state || j.status || '?');
    const live = !isTerminal(j);
    out.push({
      task_id,
      file: f,
      state: stateText,
      live,
      released: !!j.ownership_claim_released,
      // Only live pieces are ever displayed with an age, so only they pay the git-log subprocess.
      ageDays: live ? ageDays(relative(ROOT, join(dir, f))) : null,
      files_touched: uniqStrings(j.files_touched),
      files_claimed: uniqStrings(j.files_claimed),
      redundant_with: uniqStrings(j.redundant_with),
    });
  }
  return out;
}

function fmtAge(d) {
  if (d === null || d === undefined) return 'age?';
  if (d < 1) return `${Math.round(d * 24)}h old`;
  return `${d.toFixed(1)}d old`;
}

function declared(rec) {
  return new Set([...rec.files_touched, ...rec.files_claimed]);
}

// ---------------------------------------------------------------------------------------------
// UNION-MERGE PATHS — added 2026-08-14, same sweep as FRESHNESS above
// ---------------------------------------------------------------------------------------------
// A path git itself already knows is safe for two agents to write concurrently
// (`.gitattributes`, `merge=union`) must not be reported as a `CONFLICT`. Measured directly: of
// 500 conflicts in the full report before this fix, 228 (45.6%) were pairs that share NOTHING
// but `reports/blog-feed.jsonl` — which every piece touches by RULES.md rule 27 and which git
// merges by keeping BOTH sides' lines, never a real collision. This is the same "cries wolf"
// complaint the sweep was dispatched over, from a second, independent mechanism: not a stale
// claim, but a file where an "overlap" was never meaningful in the first place. Kept OUT of the
// exclusion, deliberately: this only removes the specific paths git's own attributes name as
// union-safe -- a directory claim like `docs/shots/` still conflicts, because two agents writing
// DIFFERENT filenames under it never collide on disk either, but two agents who both claim the
// exact same screenshot filename should still be told so.
function loadUnionMergePaths() {
  const paths = new Set();
  try {
    const txt = readFileSync(join(ROOT, '.gitattributes'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*(\S+)\s+.*\bmerge=union\b/);
      if (m) paths.add(m[1]);
    }
  } catch { /* no .gitattributes -- nothing to exclude */ }
  return paths;
}
const UNION_MERGE_PATHS = loadUnionMergePaths();

// A directory claim ("game/src/sim/quest/") collides with anything under it; otherwise exact
// path equality. Cheap: still just string comparison, no glob engine. Scoped to exact-path
// equality only (not the directory-prefix arms) because a union-merge declaration in
// .gitattributes names one specific file, never a directory.
function pathsOverlap(a, b) {
  if (a === b) return UNION_MERGE_PATHS.has(a) ? false : true;
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

  console.log('Declared files, by live piece (age = time since the status file last changed;');
  console.log('a live piece several days old with no active-sounding next_step is worth a look):');
  for (const r of live) {
    const files = declared(r);
    const age = fmtAge(r.ageDays);
    const staleHint = (r.ageDays !== null && r.ageDays >= 2) ? '  [STALE? verify before trusting]' : '';
    if (!files.size) { console.log(`  ${r.task_id}  [${r.state}]  (${age})${staleHint}  -- declares nothing`); continue; }
    console.log(`  ${r.task_id}  [${r.state}]  (${age})${staleHint}`);
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
    const age = fmtAge(r.ageDays);
    const staleHint = (r.ageDays !== null && r.ageDays >= 2) ? '  [STALE? verify before trusting]' : '';
    console.log(`  ${r.task_id}  [${r.state}]  (${age})  ${kind}${staleHint}`);
  }
  if (hits.length > 1) {
    let allDeclared = true;
    for (let i = 0; i < hits.length && allDeclared; i++) {
      for (let j = i + 1; j < hits.length; j++) if (!isDeclaredRedundant(hits[i], hits[j])) { allDeclared = false; break; }
    }
    console.log(allDeclared ? '  (declared redundant -- wanted overlap)' : '  UNDECLARED OVERLAP -- check before adding a third.');
  }
}

// ---- what you are about to commit -----------------------------------------------------------
// Twice in one session an agent finished, ran `git add -A`, and swept a neighbour's in-flight work
// into its own commit — once burying a critic's staged verdict, tools, screenshot and blog line
// under a builder's message. Rule 17 already warns about it in prose, and prose lost twice in a
// day. So this reads the index directly and names, before the commit lands, every staged path that
// a DIFFERENT live piece has declared.
//
// It warns rather than blocks, deliberately. The committer is sometimes the legitimate claimant,
// the orchestrator banks the whole tree on purpose (rule 28), and a hard block with a dozen agents
// committing concurrently would deadlock the fleet to prevent a recoverable attribution error.
// What was missing was never permission — it was seeing the list in time to run `git restore
// --staged` on the three lines that are not yours.
function reportStaged(live, me) {
  let staged = [];
  try {
    staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((l) => l.trim()).filter(Boolean);
  } catch { console.log('ownership --staged: no git index to read.'); return 0; }
  if (!staged.length) { console.log('ownership --staged: nothing staged.'); return 0; }

  const foreign = [];
  for (const path of staged) {
    const owners = live.filter((r) => (!me || r.task_id.toLowerCase() !== me.toLowerCase())
      && [...declared(r)].some((p) => pathsOverlap(p, path)));
    if (owners.length) foreign.push({ path, owners: owners.map((r) => r.task_id) });
  }

  console.log(`ownership --staged: ${staged.length} path(s) staged${me ? `, committing as ${me}` : ''}.`);
  if (!foreign.length) {
    console.log('  none of them is declared by another live piece.');
    return 0;
  }
  console.log(`  ${foreign.length} staged path(s) are declared by ANOTHER live piece:`);
  for (const f of foreign) console.log(`    ${f.path}\n      claimed by ${f.owners.join(', ')}`);
  console.log('\n  If that work is not yours, unstage it before you commit:');
  console.log(`    git restore --staged ${foreign.slice(0, 8).map((f) => f.path).join(' ')}${foreign.length > 8 ? ' ...' : ''}`);
  console.log('  If it IS yours, or you are the orchestrator banking the tree, say so in the commit message.');
  return foreign.length;
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

    // 6. FRESHNESS, 2026-08-14. A status file that uses "status" instead of "state" (78 of 452
    // real files do) must be read as terminal when its status text says so -- this is the actual
    // bug the sweep found, not a hypothetical.
    write('a.json', { task_id: 'a', status: 'done', files_touched: ['game/src/engine.js'] });
    res = analyse(loadRecords(dir));
    if (res.live.some((r) => r.task_id === 'a')) fail('a "status": "done" piece (no "state" field) was still read as live');

    // 7. A compound, underscore-joined terminal word must match at the real word boundary --
    // AND a piece whose compound word is the NEGATION ("incomplete") must not be caught by a
    // naive substring test on "complete". Both directions, same case shape, on purpose.
    write('a.json', { task_id: 'a', status: 'builder_delivery_complete', files_touched: ['x'] });
    write('b.json', { task_id: 'b', status: 'builder_delivery_incomplete', files_touched: ['y'] });
    res = analyse(loadRecords(dir));
    if (res.live.some((r) => r.task_id === 'a')) fail('"builder_delivery_complete" (status) was not read as terminal');
    if (!res.live.some((r) => r.task_id === 'b')) fail('"builder_delivery_incomplete" (status) was wrongly read as terminal -- substring-matched "complete" inside "incomplete"');

    // 8. An explicit released claim is terminal regardless of what state/status still say --
    // this is what a sweep writes when it retires a claim without touching the piece's own
    // record of what happened (append-only, RULES.md rule 1's spirit applied to this registry).
    write('a.json', { task_id: 'a', state: 'building', files_touched: ['game/src/engine.js'], ownership_claim_released: { date: '2026-08-14', reason: 'test' } });
    res = analyse(loadRecords(dir));
    if (res.live.some((r) => r.task_id === 'a')) fail('ownership_claim_released did not override a non-terminal state');

    // 9. "built_awaiting_critic" (the sweep's own named calibration case, W1-03-builder) reads
    // terminal even though it contains no complete/done/closed word -- the builder hands off, it
    // does not keep editing. And the negative twin: a state that merely mentions "critic" while
    // still describing itself as running must NOT be caught by an overly broad match.
    write('a.json', { task_id: 'a', state: 'built_awaiting_critic', files_touched: ['x'] });
    write('b.json', { task_id: 'b', state: 'awaiting a critical fix before continuing', files_touched: ['y'] });
    res = analyse(loadRecords(dir));
    if (res.live.some((r) => r.task_id === 'a')) fail('"built_awaiting_critic" was not read as terminal (the sweep\'s named calibration case)');
    if (!res.live.some((r) => r.task_id === 'b')) fail('"awaiting a critical fix" was wrongly read as terminal -- "critic" substring-matched inside "critical"');

    console.log(`ownership --self-test: ${failures === 0 ? 'PASS (9/9)' : `${failures} FAILURE(S)`}`);
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

const stagedIx = args.indexOf('--staged');
if (stagedIx !== -1) {
  // `--staged [my-task-id]` — the task id, when given, is excluded from "another live piece",
  // because your own claims are the whole point of having made them.
  const n = reportStaged(live, args[stagedIx + 1] && !args[stagedIx + 1].startsWith('--') ? args[stagedIx + 1] : null);
  process.exit(n ? 1 : 0);
}

if (args.includes('--conflicts')) {
  printConflicts(conflicts, redundant, live.length);
  process.exit(conflicts.length ? 1 : 0);
}

printFullReport(live, conflicts, redundant, blind);
process.exit(0);
