#!/usr/bin/env node
// land.mjs — put work on the integration branch without reverting anybody else's.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS, with the forensic that produced it
// ---------------------------------------------------------------------------------------------
//
// On 2026-08-14 at least eight agents had finished, pushed work silently reverted. The orchestrator's
// standing diagnosis was "a shared working tree plus a shared branch, so pushes race". Half of that
// is wrong and it matters, because the wrong half is what worktrees and branch-per-agent were bought
// to fix and neither stopped the losses.
//
// **There is no push race.** Git rejects a non-fast-forward push. Two agents pushing the same branch
// at the same instant cannot overwrite each other; the loser is told to fetch and try again.
//
// The real mechanism, read off commit `06dafd04` — the single largest loss found, 18 files and
// 22,209 lines of finished agent work destroyed in one commit:
//
//   merge-base d7702f04 ── 18 commits of agents' pushed work ──▶ e469e6df   (origin, "theirs")
//        └───────────────── 2 local commits ─────────────────▶ a8e4c938   ("ours", the shared tree)
//
//   06dafd04 was recorded as a MERGE of both. Its tree was not a merge of both. Its tree was a
//   `git add -A` SNAPSHOT of the shared working tree — a tree that had never received any of those
//   18 commits' files. All 18 files that the merge deleted were files ADDED between the base and
//   theirs. Verified: `git diff --diff-filter=D --name-only e469e6df 06dafd04` → 18 paths, and every
//   one of them is absent from d7702f04.
//
// **A second parent is a claim.** It tells git "my tree already accounts for that branch". When the
// tree is a snapshot rather than a merge result, the claim is a lie, and git believes it for good:
// every later merge reads those absences as deliberate deletions and never brings the files back.
// That is why the work did not come back on its own, and why nine agents' worktrees changed nothing
// — worktrees stop two agents writing one file; they do not stop a snapshot being labelled a merge.
//
// The fix is proven against the incident rather than against a story about it. Re-running that exact
// merge through `git merge-tree --write-tree`:
//
//   of the 18 files the real merge destroyed, kept = 18, lost = 0
//   of the files ours had added,             kept =  1, lost = 0
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS DOES
// ---------------------------------------------------------------------------------------------
//
//   1. OURS  = HEAD's tree + whatever the working tree changed **relative to HEAD**.
//              Never relative to origin. That single word is the whole defect: a file another agent
//              pushed is absent from this shared working tree and also absent from HEAD, so it is
//              not a change and is not staged. Diffed against *origin* it looks like a deletion, and
//              that is the deletion that has been eating this project.
//   2. TREE  = `git merge-tree --write-tree --merge-base $(merge-base HEAD origin) OURS THEIRS`.
//              A real three-way merge: rename detection, per-hunk content merge, no working tree, no
//              index, and crucially **no `.git/index.lock`** — so it cannot lose a race with the
//              dozen agents committing beside it.
//   3. Conflicts are resolved by written policy, never by asking anybody (rule 0) and never by
//              blocking (rule 13). The losing side is written into the tree at
//              `reports/land-rescue/<utc>/<path>` so that no resolution can destroy anything.
//   4. C     = `commit-tree TREE -p THEIRS -p OURS`, pushed. Rejected push ⇒ refetch and redo,
//              because rejection means somebody else landed first, which is the system working.
//   5. The local branch ref is moved to **OURS**, not to C. OURS is the one commit whose tree is
//              byte-identical to this working tree, so `git status` goes clean without a checkout,
//              nothing on disk is touched (hazard 2b), and next time `merge-base(HEAD, tip)` is OURS
//              exactly — because C has OURS as a parent. The next land therefore carries only what
//              changed since this one.
//   6. Verified against the remote blob, never against local state (hazard 2).
//
// Append-only files are handled declaratively rather than by hand: `.gitattributes` marks
// `reports/blog-feed.jsonl` as `merge=union`, and `merge-tree` honours it (tested). Ten lines from
// nine agents were lost three times in forty minutes to whole-file staging of that one file; a union
// merge keeps both sides' lines with no code and no policy.
//
// ---------------------------------------------------------------------------------------------
//   node tools/land.mjs "headline" [body...]        # land the shared tree (what bank.mjs now calls)
//   node tools/land.mjs "headline" --paths a,b,c    # land only these paths — for a single agent
//   node tools/land.mjs "headline" --dry-run        # say what would land, touch nothing
//   node tools/land.mjs "headline" --allow-deletions  # yes, I really did delete those files
//   node tools/land.mjs --sync                      # pull others' work into the shared tree, safely
//   node tools/land.mjs --self-test                 # prove it, including that the old way loses work
//
// Exit codes are honest. `bank.mjs` once printed failure and exited 0, so every retry loop in the
// fleet believed a lie; anything less than "the bytes are on the remote" exits non-zero here.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// ------------------------------------------------------------------------------------------------
// git helpers. Every one of them takes an explicit root so the self-test drives THIS code against a
// real throwaway repository rather than a reimplementation of it — a self-test that re-writes the
// logic it is testing proves only that the author can write it twice.
// ------------------------------------------------------------------------------------------------
const git = (root, args, opts = {}) =>
  execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    stdio: ['pipe', 'pipe', opts.quiet ? 'pipe' : 'pipe'],
    env: { ...process.env, ...(opts.env || {}) },
    input: opts.input,
  }).trim();

const gitTry = (root, args, opts = {}) => {
  try { return { ok: true, out: git(root, args, opts) }; }
  catch (e) { return { ok: false, out: String(e.stdout || '') + String(e.stderr || ''), err: e }; }
};

const exists = (root, rev) => gitTry(root, ['cat-file', '-e', rev], { quiet: true }).ok;

/** Which branch are we landing on? The checked-out one, unless told otherwise. */
function currentBranch(root) {
  const b = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (b === 'HEAD') throw new Error('land: detached HEAD — pass --branch <name>');
  return b;
}

// ------------------------------------------------------------------------------------------------
// Conflict policy. Declared here, in one place, so it can be argued with.
// ------------------------------------------------------------------------------------------------

// Files that are DERIVED from the tree. A conflict in one of these is not a disagreement about
// anything; it is two agents having regenerated the same artifact from different inputs. Take
// theirs — the pre-commit hook regenerates all of them on the very next commit anyway, so the only
// thing a clever resolution buys is the chance to be wrong.
const GENERATED = [
  'orchestration/INDEX.md',
  'corpus/00-doctrine/INDEX.md',
  'docs/index.html',
  'docs/progress.html',
  'docs/status.json',
  'docs/data/',
  'docs/play/',
];
const isGenerated = (p) => GENERATED.some((g) => (g.endsWith('/') ? p.startsWith(g) : p === g));

/**
 * Paths this agent claims, straight from the status registry (RULES rule 16) — the same source
 * `bank.mjs` uses for attribution and `ownership.mjs` uses for collision warnings. A conflict inside
 * a path somebody actively claims should resolve to the claimant, not to whoever pushed last.
 */
function claimedPaths(root) {
  const dir = join(root, 'orchestration', 'status');
  const out = [];
  if (!existsSync(dir)) return out;
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const f of names.filter((f) => f.endsWith('.json'))) {
    let j; try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    if (/abandoned|superseded/i.test(String(j.state || ''))) continue;
    for (const p of [...(j.files_claimed || []), ...(j.files_touched || [])]) {
      if (typeof p === 'string') out.push(p);
    }
  }
  return out;
}
// ------------------------------------------------------------------------------------------------
// The landing itself
// ------------------------------------------------------------------------------------------------

/**
 * Build OURS: HEAD's tree with the working tree's changes applied, computed in a private index so
 * `.git/index.lock` is never taken and no other agent's commit can be raced.
 *
 * `paths` restricts what is carried. Passing nothing means "everything this working tree changed",
 * which is the orchestrator's bank (rule 28) and is deliberate: an hour of unbanked work dies with
 * the next container restart, and this box has restarted twice in a day.
 */
function buildOurs(root, { paths = null, exclude = [], allowDeletions = false } = {}) {
  const idx = join(tmpdir(), `land-idx-${process.pid}-${Date.now()}`);
  const env = { GIT_INDEX_FILE: idx };
  try {
    const head = git(root, ['rev-parse', 'HEAD']);
    git(root, ['read-tree', head], { env });
    // `add -A` here is safe precisely because the index was seeded from HEAD, which is the commit
    // this working tree was checked out from. Seeded from origin instead — the old recipe — the same
    // command stages a revert of every file that arrived since.
    const addArgs = ['add', '-A', '--'];
    git(root, paths && paths.length ? [...addArgs, ...paths] : ['add', '-A'], { env });
    if (exclude.length) {
      const tracked = git(root, ['diff', '--cached', '--name-only', head], { env }).split('\n').filter(Boolean);
      const drop = tracked.filter((p) => exclude.some((x) => p === x || p.startsWith(x.replace(/\/*$/, '/'))));
      if (drop.length) git(root, ['reset', '-q', head, '--', ...drop], { env });
    }

    // ------------------------------------------------------------------------------------------
    // THE THIRD MECHANISM — found by this tool deleting a file on its own first real run.
    //
    // Fixing the origin-vs-HEAD defect leaves one hole, and it is not small. `HEAD` is only a
    // faithful description of this disk if this disk was CHECKED OUT from it. In a shared tree it is
    // not: HEAD advances through merges and `reset --mixed` all day, while the files those commits
    // introduced were written in some other agent's worktree and never touched this disk at all. So
    // HEAD's tree is a superset of the disk, and `add -A` reads the difference as deletions —
    // faithfully, and catastrophically. On the first live bank this deleted a screenshot an agent
    // had pushed twenty minutes earlier. One file, but the mechanism has no upper bound.
    //
    // There is no way to tell "an agent deliberately deleted this" from "this was never written
    // here" by looking at the tree, because both are exactly "in HEAD, not on disk". So stop trying
    // to tell them apart and make the asymmetry the answer instead: a wrongly-kept file is a dead
    // byte somebody deletes later; a wrongly-deleted file is an agent's afternoon. **Deletions are
    // not carried unless they were asked for** — by naming the path in `--paths`, which is an
    // explicit claim, or by `--allow-deletions`. Everything suppressed is printed, never silent.
    //
    // The standing cure for the underlying drift is `land.mjs --sync`, which writes the branch's
    // files onto this disk without touching anything anybody is editing.
    const deletions = git(root, ['diff', '--cached', '--name-only', '--diff-filter=D', head], { env })
      .split('\n').filter(Boolean);
    const namedExplicitly = (p) => (paths || []).some((x) => p === x || p.startsWith(x.replace(/\/*$/, '/')));
    const suppressed = allowDeletions ? [] : deletions.filter((p) => !namedExplicitly(p));
    if (suppressed.length) git(root, ['reset', '-q', head, '--', ...suppressed], { env });

    const changed = git(root, ['diff', '--cached', '--name-only', head], { env }).split('\n').filter(Boolean);
    const tree = git(root, ['write-tree'], { env });
    return { head, tree, changed, suppressed, idx };
  } finally {
    try { rmSync(idx, { force: true }); } catch { }
  }
}

/** Read a merge-tree result. Exit 0 = clean, 1 = conflicts, anything else = a real error. */
function mergeTree(root, base, ours, theirs) {
  let out, code = 0;
  try {
    out = execFileSync('git', ['merge-tree', '--write-tree', '-z', '--name-only', '--merge-base', base, ours, theirs],
      { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    code = e.status;
    out = String(e.stdout || '');
    if (code !== 1) throw new Error(`land: merge-tree failed (${code}): ${String(e.stderr || '').slice(0, 800)}`);
  }
  // -z output: <tree>NUL then NUL-separated conflicted filenames, then a NUL and the message block.
  const parts = out.split('\0');
  const tree = parts.shift().trim();
  const conflicts = [];
  for (const p of parts) {
    if (p === '') break;                 // the empty field that opens the informational messages
    conflicts.push(p);
  }
  return { tree, conflicts: [...new Set(conflicts)], clean: code === 0 };
}

/**
 * Resolve conflicts into a real tree — no markers, nothing lost.
 *
 * A conflicted blob out of `merge-tree` carries `<<<<<<<` markers. Shipping one breaks the game and
 * this project has shipped a broken import to the owner's phone before, so markers never reach the
 * tree. For each conflicted path a side wins by policy; the losing side is written into the tree
 * under `reports/land-rescue/<utc>/`, which is the difference between "resolved" and "discarded".
 */
function resolveConflicts(root, mergedTree, conflicts, { ours, theirs, mine }) {
  if (!conflicts.length) return { tree: mergedTree, decisions: [] };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const idx = join(tmpdir(), `land-res-${process.pid}-${Date.now()}`);
  const env = { GIT_INDEX_FILE: idx };
  const decisions = [];
  try {
    git(root, ['read-tree', mergedTree], { env });
    for (const path of conflicts) {
      const oursBlob = gitTry(root, ['rev-parse', `${ours}:${path}`], { quiet: true });
      const theirsBlob = gitTry(root, ['rev-parse', `${theirs}:${path}`], { quiet: true });
      const claimedByMe = mine.some((c) => path === c || (c.endsWith('/') && path.startsWith(c)));
      let winner, loser, why;
      if (isGenerated(path)) { winner = theirsBlob; loser = oursBlob; why = 'generated — regenerated next commit'; }
      else if (claimedByMe) { winner = oursBlob; loser = theirsBlob; why = 'claimed in the status registry'; }
      else { winner = theirsBlob; loser = oursBlob; why = 'not claimed here — the pushed side wins'; }
      if (!winner.ok) { winner = winner === oursBlob ? theirsBlob : oursBlob; why += ' (other side absent)'; }
      if (!winner.ok) continue;                                     // present on neither side: leave it
      const mode = (gitTry(root, ['ls-tree', winner === oursBlob ? ours : theirs, path], { quiet: true }).out || '100644').split(/\s+/)[0] || '100644';
      git(root, ['update-index', '--add', '--cacheinfo', `${mode},${winner.out},${path}`], { env });
      if (loser.ok) {
        const rescue = `reports/land-rescue/${stamp}/${path}`;
        git(root, ['update-index', '--add', '--cacheinfo', `100644,${loser.out},${rescue}`], { env });
        decisions.push({ path, why, rescue });
      } else decisions.push({ path, why, rescue: null });
    }
    return { tree: git(root, ['write-tree'], { env }), decisions };
  } finally { try { rmSync(idx, { force: true }); } catch { } }
}

/**
 * One landing attempt. Returns { landed, commit, ours, changed, conflicts, decisions } or throws.
 * `attempts` exists because a rejected push is not an error — it means a sibling landed first, which
 * is the only thing standing between two agents and a lost file. Redo the merge against the new tip.
 */
export function land(root, message, opts = {}) {
  const branch = opts.branch || currentBranch(root);
  const remote = opts.remote || 'origin';
  const maxAttempts = opts.attempts ?? 5;
  let last = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const f = gitTry(root, ['fetch', '-q', remote, branch]);
    if (!f.ok && attempt === 1 && !exists(root, `${remote}/${branch}`)) {
      throw new Error(`land: cannot fetch ${remote}/${branch}: ${f.out.slice(0, 400)}`);
    }
    const theirs = exists(root, `${remote}/${branch}`) ? git(root, ['rev-parse', `${remote}/${branch}`]) : null;

    const ours = buildOurs(root, opts);
    if (!ours.changed.length && theirs && ours.head === theirs) {
      return { landed: false, reason: 'nothing to land', changed: [], commit: null };
    }

    const oursCommit = ours.changed.length
      ? git(root, ['commit-tree', ours.tree, '-p', ours.head, '-m', message])
      : ours.head;

    // Is the remote already contained in what we have? Then there is nothing to merge and the
    // landing is an ordinary fast-forward. `--is-ancestor` signals by exit code, so it must go
    // through gitTry — calling it through git() would throw on the (normal) "no" answer.
    const remoteAlreadyOurs = !theirs || theirs === ours.head ||
      gitTry(root, ['merge-base', '--is-ancestor', theirs, ours.head], { quiet: true }).ok;

    let commit, conflicts = [], decisions = [];
    if (remoteAlreadyOurs) {
      commit = oursCommit;
      if (opts.dryRun) return { landed: false, reason: 'dry-run', changed: ours.changed, conflicts, decisions, commit: null };
    } else {
      const base = git(root, ['merge-base', ours.head, theirs]);
      const m = mergeTree(root, base, oursCommit, theirs);
      conflicts = m.conflicts;
      // Only pay for the ownership registry (417 status files) when there is actually a conflict
      // to arbitrate. Reading it on every land would be a tax on the common case.
      const mine = conflicts.length ? (opts.mine || claimedPaths(root)) : [];
      const r = resolveConflicts(root, m.tree, conflicts, { ours: oursCommit, theirs, mine });
      decisions = r.decisions;
      if (opts.dryRun) return { landed: false, reason: 'dry-run', changed: ours.changed, conflicts, decisions, tree: r.tree, commit: null };
      commit = git(root, ['commit-tree', r.tree, '-p', theirs, '-p', oursCommit, '-m', message]);
    }
    const push = gitTry(root, ['push', remote, `${commit}:refs/heads/${branch}`]);
    if (push.ok) {
      // Move the local branch to OURS — the one commit whose tree IS this working tree. Not to the
      // merge: the merge's tree contains files this disk has never seen, and pointing HEAD at it
      // would make the next `add -A` stage their deletion. That is the bug, one level up.
      const moved = gitTry(root, ['reset', '--mixed', '-q', oursCommit]);
      if (!moved.ok) gitTry(root, ['update-ref', `refs/heads/${branch}`, oursCommit]);   // index.lock held; ref move needs no lock
      gitTry(root, ['fetch', '-q', remote, branch]);
      try {
        appendFileSync(join(root, '.git', 'es-land-journal.jsonl'),
          JSON.stringify({ at: new Date().toISOString(), commit, ours: oursCommit, branch, files: ours.changed.length, conflicts: conflicts.length }) + '\n');
      } catch { }
      return { landed: true, commit, ours: oursCommit, changed: ours.changed, suppressed: ours.suppressed || [], conflicts, decisions, attempt };
    }
    last = push.out;
    if (!/non-fast-forward|fetch first|rejected|stale info/i.test(push.out)) {
      throw new Error(`land: push failed for a reason that is not contention:\n${push.out.slice(0, 1200)}`);
    }
    // Somebody landed while we merged. Good. Go round again against the new tip.
  }
  throw new Error(`land: ${maxAttempts} attempts all lost the race — the branch is moving faster than we can merge.\n${String(last).slice(0, 600)}`);
}

/**
 * Verify against the remote blob (hazard 2). Local state is not evidence; this re-fetches and
 * compares object ids, so a "success" that did not actually change the remote is caught.
 */
export function verify(root, paths, { branch, remote = 'origin', commit, ours, decisions = [] } = {}) {
  const b = branch || currentBranch(root);
  gitTry(root, ['fetch', '-q', remote, b]);
  const bad = [];

  // Part one, and the part that actually matters: is the commit we pushed ON the branch? Everything
  // else is detail. A commit that pushed successfully and is not an ancestor of the tip has been
  // overwritten by somebody, which is the disease itself and must be shouted about.
  if (commit) {
    if (!gitTry(root, ['merge-base', '--is-ancestor', commit, `${remote}/${b}`], { quiet: true }).ok) {
      bad.push({ path: `(commit ${commit.slice(0, 10)})`, why: `pushed, but it is NOT an ancestor of ${remote}/${b} — something overwrote it` });
    }
  }

  // Part two: did each path we carried arrive with the content we committed? Compare against the
  // commit we made, NOT against the file on disk. The first version of this compared to disk and
  // cried failure five times on its first live run: four were generated files the conflict policy
  // had deliberately resolved to the other side, and the fifth was a live agent rewriting its own
  // file in the seconds between our snapshot and our check. Neither is a loss, and a verifier that
  // reports losses that are not losses gets ignored — which is how a real one gets missed.
  const overridden = new Set(decisions.filter((d) => /generated|not claimed/.test(d.why)).map((d) => d.path));
  const src = commit || ours;
  for (const p of paths) {
    if (overridden.has(p)) continue;                       // policy chose the other side, on purpose
    const want = src ? gitTry(root, ['rev-parse', `${src}:${p}`], { quiet: true })
      : (existsSync(join(root, p)) ? { ok: true, out: git(root, ['hash-object', '--', join(root, p)]) } : { ok: false });
    const got = gitTry(root, ['rev-parse', `${remote}/${b}:${p}`], { quiet: true });
    if (!want.ok) { if (got.ok && src) bad.push({ path: p, why: 'we recorded a deletion but it is still on the remote' }); continue; }
    if (!got.ok) { bad.push({ path: p, why: 'NOT ON THE REMOTE' }); continue; }
    if (want.out !== got.out) {
      // The branch may simply have moved on since we landed — a later commit legitimately changing
      // the file is not our landing failing. Ours is fine as long as it was there when we put it there.
      const atOurs = commit ? gitTry(root, ['rev-parse', `${commit}:${p}`], { quiet: true }) : { ok: false };
      if (atOurs.ok && atOurs.out === want.out) continue;
      bad.push({ path: p, why: `remote blob differs (committed ${want.out.slice(0, 8)} vs remote ${got.out.slice(0, 8)})` });
    }
  }
  return bad;
}

/**
 * `--sync`: bring other agents' landed work into this shared working tree, without touching a single
 * file anybody is editing. Only paths that are (a) on the remote, (b) identical between HEAD and the
 * working tree — i.e. nobody here has touched them — are written. Never a checkout, never a reset
 * --hard (hazard 2b). This is what stops the shared tree drifting a day behind the branch and every
 * measurement being taken against files the rest of the fleet replaced hours ago.
 */
export function sync(root, { branch, remote = 'origin', dryRun = false } = {}) {
  const b = branch || currentBranch(root);
  gitTry(root, ['fetch', '-q', remote, b]);
  const tip = git(root, ['rev-parse', `${remote}/${b}`]);
  const head = git(root, ['rev-parse', 'HEAD']);
  if (tip === head) return { written: [], skipped: [], tip };
  const dirty = new Set(git(root, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean));
  const written = [], skipped = [];
  for (const line of git(root, ['diff', '--name-status', head, tip]).split('\n').filter(Boolean)) {
    const [status, path] = line.split('\t');
    if (!path) continue;
    if (dirty.has(path)) { skipped.push({ path, why: 'edited here — left alone' }); continue; }
    if (status === 'D') { skipped.push({ path, why: 'deletion — never applied by sync' }); continue; }
    if (dryRun) { written.push(path); continue; }
    try {
      const blob = execFileSync('git', ['cat-file', 'blob', `${tip}:${path}`], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), blob);
      written.push(path);
    } catch (e) { skipped.push({ path, why: `could not write: ${String(e.message).slice(0, 120)}` }); }
  }
  return { written, skipped, tip };
}

// ------------------------------------------------------------------------------------------------
// The self-test
// ------------------------------------------------------------------------------------------------
//
// HAZARDS §0 names the failure this has to avoid: a suite whose arms all fabricate the disputed
// input identically, so they can only argue downstream of an assumption none of them tests.
//
// **The disputed input here is the base — the commit an agent's changes are measured against.** The
// old recipe assumes it is `origin/<branch>`; this tool discovers it as `HEAD`. So the self-test
// hands NEITHER arm a base. Each arm runs its own real code and reaches its own answer, in a real
// repository with a real remote, from a working tree that is genuinely stale in the way the shared
// tree on this box is genuinely stale. Nothing is injected.
//
// Three arms, and they are required to disagree:
//   CURRENT     the recipe in HAZARDS §2, verbatim — MUST LOSE WORK, or the fix is fixing nothing
//   LAND        this module's exported `land()`, the real one — MUST KEEP BOTH SIDES
//   SABOTAGED   `land()` with base discovery forced back to origin, one word changed — MUST LOSE
//               WORK. This is RULES rule 6's "confirm your control is not itself inert": if the
//               sabotaged arm passed, LAND's passes would prove nothing about the mechanism.

function sh(cwd, cmd) { return execFileSync('bash', ['-c', cmd], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

/** A throwaway world: a bare remote, and ONE shared working tree — the configuration that loses work. */
function makeWorld(label) {
  const dir = mkdtempSync(join(tmpdir(), `land-selftest-${label}-`));
  const remote = join(dir, 'remote.git'), work = join(dir, 'work');
  sh(dir, `git init -q --bare remote.git`);
  mkdirSync(work, { recursive: true });
  sh(work, `git init -q .`);
  sh(work, `git symbolic-ref HEAD refs/heads/main`);          // works on an unborn branch; checkout -b does not
  sh(work, `git remote add origin ${remote}`);
  // The repository this tool lives in sets core.hooksPath globally; a throwaway world must not run
  // the game's twenty-second pre-commit hook, and must not be able to touch the real tree.
  sh(work, `git config user.email selftest@local && git config user.name selftest && git config core.hooksPath ${join(dir, 'nohooks')}`);
  mkdirSync(join(work, 'reports'), { recursive: true });
  writeFileSync(join(work, '.gitattributes'), 'reports/*.jsonl merge=union\n');
  writeFileSync(join(work, 'reports', 'blog-feed.jsonl'), '{"line":"base-1"}\n');
  writeFileSync(join(work, 'shared.txt'), 'header\n\n\n\n\n\n\n\n\n\nfooter\n');
  sh(work, `git add -A && git commit -qm base && git push -q origin main`);
  sh(dir, `git -C remote.git symbolic-ref HEAD refs/heads/main`);   // else a later clone checks out nothing
  return { dir, remote, work };
}

/**
 * The recipe as HAZARDS §2 has it. Reproduced here exactly, comments and all, because the claim
 * "the current scheme loses work" is only worth anything if the arm really is the current scheme.
 */
function landTheOldWay(work, msg) {
  sh(work, `
    set -e
    git fetch -q origin main
    export GIT_INDEX_FILE=$(mktemp -u /tmp/idx-old-XXXXXX)
    git read-tree origin/main
    git add -A
    TREE=$(git write-tree); P=$(git rev-parse origin/main)
    C=$(git commit-tree "$TREE" -p "$P" -m ${JSON.stringify(msg)})
    unset GIT_INDEX_FILE
    git push -q origin "$C":main
  `);
}

const remoteHas = (work, path) => {
  sh(work, `git fetch -q origin main`);
  try { return execFileSync('git', ['cat-file', 'blob', `origin/main:${path}`], { cwd: work, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch { return null; }
};

function selfTest() {
  const results = [];
  const record = (scenario, arm, expected, got, detail) => {
    const pass = expected === got;
    results.push({ scenario, arm, expected, got, pass, detail });
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${scenario.padEnd(30)} ${arm.padEnd(10)} expected=${expected.padEnd(9)} got=${got}${detail ? `   (${detail})` : ''}`);
  };

  // --- Scenario 1: two agents, two different new files, one shared working tree ---------------
  // Agent A writes and lands. Agent B — who never fetched, whose working tree therefore has never
  // contained A's file — writes and lands. Does A's file survive?
  //
  // RULES rule 6 names a fourth failure shape: **two guards for one defect**, where deleting either
  // alone changes nothing and only deleting both moves the number. That is exactly what is here, and
  // the first version of this suite got it wrong — sabotaging base discovery alone kept passing, and
  // a lazier author would have called that a green light. It is not. `land()` has TWO independent
  // guards against this loss: the base is HEAD not origin, and deletions are not carried unless
  // asked for. Either one alone is sufficient in this scenario. So it runs as a 2x2, and only the
  // corner with both guards removed is allowed to be red.
  for (const arm of ['current', 'land', 'sab-base', 'sab-deletions', 'sab-both']) {
    const { work } = makeWorld(`s1-${arm}`);
    writeFileSync(join(work, 'agent-a.txt'), 'A did an hour of work\n');
    if (arm === 'current') landTheOldWay(work, 'A lands'); else land(work, 'A lands', { branch: 'main', mine: [] });
    // B's working tree is the SAME directory and was never updated with A's file. Simulate exactly
    // that: remove A's file from the disk the way a stale tree "has" no such file, without telling
    // git anything. (For the land arm this is legitimate too — HEAD after A's land is A's own
    // snapshot, which DOES contain agent-a.txt, so deleting it is a genuine deletion and would
    // rightly be honoured. So instead we make a second, genuinely stale tree.)
    rmSync(join(work, 'agent-a.txt'), { force: true });
    // Rewind HEAD to before A's landing and restore the index, which is what "a tree that never saw
    // A's push" actually is: HEAD is the old base, the disk has no agent-a.txt, and nothing is dirty.
    sh(work, `git reset -q --mixed HEAD~1 2>/dev/null || true`);
    writeFileSync(join(work, 'agent-b.txt'), 'B did an hour of work\n');
    let err = null;
    const brokenBase = arm === 'sab-base' || arm === 'sab-both';
    const brokenDeletions = arm === 'sab-deletions' || arm === 'sab-both';
    try {
      if (arm === 'current') landTheOldWay(work, 'B lands');
      else {
        // Sabotage guard 1 by pointing HEAD at origin's tip without touching the disk — which is
        // precisely the wrong base discovery, one behaviour changed and nothing else.
        if (brokenBase) sh(work, `git fetch -q origin main && git update-ref refs/heads/main $(git rev-parse origin/main)`);
        land(work, 'B lands', { branch: 'main', mine: [], allowDeletions: brokenDeletions });
      }
    } catch (e) { err = String(e.message).slice(0, 160); }
    const a = remoteHas(work, 'agent-a.txt'), b = remoteHas(work, 'agent-b.txt');
    const got = err ? 'error' : (a && b) ? 'both' : a ? 'only-A' : b ? 'only-B' : 'neither';
    // Only the both-guards-removed corner may lose work. The single-sabotage corners MUST still
    // pass — if one of them went red, the guards would not be independent and this comment is wrong.
    const expected = (arm === 'current' || arm === 'sab-both') ? 'only-B' : 'both';
    record('two agents, two files', arm, expected, got, err || `A=${!!a} B=${!!b}`);
  }

  // --- Scenario 2: the append-only shared log, which was clobbered three times in forty minutes ---
  for (const arm of ['current', 'land']) {
    const { work } = makeWorld(`s2-${arm}`);
    appendFileSync(join(work, 'reports', 'blog-feed.jsonl'), '{"line":"A"}\n');
    if (arm === 'current') landTheOldWay(work, 'A blogs'); else land(work, 'A blogs', { branch: 'main', mine: [] });
    sh(work, `git reset -q --mixed HEAD~1 2>/dev/null || true`);
    writeFileSync(join(work, 'reports', 'blog-feed.jsonl'), '{"line":"base-1"}\n{"line":"B"}\n');   // B never saw A's line
    let err = null;
    try { if (arm === 'current') landTheOldWay(work, 'B blogs'); else land(work, 'B blogs', { branch: 'main', mine: [] }); }
    catch (e) { err = String(e.message).slice(0, 160); }
    const feed = remoteHas(work, 'reports/blog-feed.jsonl') || '';
    const got = err ? 'error' : (feed.includes('"A"') && feed.includes('"B"')) ? 'both' : feed.includes('"A"') ? 'only-A' : 'only-B';
    record('append-only blog feed', arm, arm === 'land' ? 'both' : 'only-B', got, err || feed.replace(/\n/g, '|'));
  }

  // --- Scenario 3: both agents edit the SAME file, in different places -------------------------
  for (const arm of ['current', 'land']) {
    const { work } = makeWorld(`s3-${arm}`);
    const p = join(work, 'shared.txt');
    writeFileSync(p, readFileSync(p, 'utf8').replace('header', 'header\nA-EDIT'));
    if (arm === 'current') landTheOldWay(work, 'A edits'); else land(work, 'A edits', { branch: 'main', mine: [] });
    sh(work, `git reset -q --mixed HEAD~1 2>/dev/null || true`);
    writeFileSync(p, 'header\n\n\n\n\n\n\n\n\n\nfooter\nB-EDIT\n');                      // B's copy predates A's edit
    let err = null;
    try { if (arm === 'current') landTheOldWay(work, 'B edits'); else land(work, 'B edits', { branch: 'main', mine: [] }); }
    catch (e) { err = String(e.message).slice(0, 160); }
    const s = remoteHas(work, 'shared.txt') || '';
    const got = err ? 'error' : s.includes('<<<<<<<') ? 'markers' : (s.includes('A-EDIT') && s.includes('B-EDIT')) ? 'both' : s.includes('A-EDIT') ? 'only-A' : 'only-B';
    record('same file, two regions', arm, arm === 'land' ? 'both' : 'only-B', got, err || '');
  }

  // --- Scenario 4: the 06dafd04 shape — a snapshot commit wearing a merge parent ----------------
  // This is the one that cost 18 files. The old arm claims the remote as a parent while its tree is
  // a snapshot; land() puts a real merge under that parent.
  for (const arm of ['current', 'land']) {
    const { work } = makeWorld(`s4-${arm}`);
    mkdirSync(join(work, 'reports', 'run'), { recursive: true });
    for (let i = 0; i < 18; i++) writeFileSync(join(work, 'reports', 'run', `artifact-${i}.json`), `{"n":${i}}\n`);
    land(work, 'the fleet lands 18 artifacts', { branch: 'main', mine: [] });
    sh(work, `git reset -q --mixed HEAD~1`);
    rmSync(join(work, 'reports', 'run'), { recursive: true, force: true });     // this tree never had them
    writeFileSync(join(work, 'orchestrator.txt'), 'the bank\n');
    let err = null;
    try { if (arm === 'current') landTheOldWay(work, 'In-flight agent work'); else land(work, 'In-flight agent work', { branch: 'main', mine: [] }); }
    catch (e) { err = String(e.message).slice(0, 160); }
    let kept = 0; for (let i = 0; i < 18; i++) if (remoteHas(work, `reports/run/artifact-${i}.json`)) kept++;
    record('18 artifacts vs a bank', arm, arm === 'land' ? '18-kept' : '0-kept', err ? 'error' : `${kept}-kept`, err || '');
  }

  // --- Scenario 5: land must still be able to DELETE, or it is just an append machine ----------
  {
    const { work } = makeWorld('s5');
    land(work, 'seed', { branch: 'main', mine: [] });
    rmSync(join(work, 'shared.txt'), { force: true });
    land(work, 'delete shared.txt on purpose', { branch: 'main', mine: [], paths: ['shared.txt'] });
    const got = remoteHas(work, 'shared.txt') === null ? 'deleted' : 'still-there';
    record('a real deletion lands', 'land', 'deleted', got, 'a merge-only scheme that cannot delete is its own bug');
  }

  // --- Scenario 6: contention — the loser of a push race must retry, not overwrite --------------
  {
    const { work } = makeWorld('s6');
    // Land from a second clone behind our back, between our fetch and our push, by landing there
    // first and only then landing here from a stale HEAD.
    const other = join(dirname(work), 'other');
    sh(dirname(work), `git clone -q ${join(dirname(work), 'remote.git')} other`);
    sh(other, `git config user.email o@l && git config user.name o && git config core.hooksPath /dev/null`);
    writeFileSync(join(other, 'other-agent.txt'), 'landed first\n');
    sh(other, `git add -A && git commit -qm other && git push -q origin main`);
    writeFileSync(join(work, 'mine.txt'), 'landed second\n');
    let err = null;
    try { land(work, 'second lander', { branch: 'main', mine: [] }); } catch (e) { err = String(e.message).slice(0, 160); }
    const got = err ? 'error' : (remoteHas(work, 'other-agent.txt') && remoteHas(work, 'mine.txt')) ? 'both' : 'lost-one';
    record('lost the push race', 'land', 'both', got, err || '');
  }

  console.log('');
  const fails = results.filter((r) => !r.pass);
  const armSummary = {};
  for (const r of results) { armSummary[r.arm] ||= { pass: 0, fail: 0 }; armSummary[r.arm][r.pass ? 'pass' : 'fail']++; }
  console.log('  arms:', JSON.stringify(armSummary));
  // The suite is only meaningful if the arms actually disagreed about the outcome, so say so.
  const disagreements = results.filter((r) => r.arm === 'land').filter((l) =>
    results.some((o) => o.scenario === l.scenario && o.arm !== 'land' && o.got !== l.got)).length;
  console.log(`  scenarios where LAND and the other arms reached DIFFERENT outcomes: ${disagreements}`);
  if (!disagreements) {
    console.log('  SELF-TEST IS VACUOUS: every arm agreed, so nothing here distinguishes the fix from the bug.');
    return 1;
  }
  if (fails.length) { console.log(`\n  ${fails.length} check(s) failed.`); return 1; }
  console.log('\n  All arms behaved as the diagnosis predicts. Read the 2x2 in scenario 1 carefully:');
  console.log('  land() carries TWO independent guards (base=HEAD, and deletions are opt-in). Removing');
  console.log('  either one alone still keeps both agents\' work; removing BOTH loses an agent, exactly');
  console.log('  like the old recipe does. That is RULES rule 6\'s fourth shape, reported as such rather');
  console.log('  than dressed up as one clean fix — a single-sabotage arm passing is not a green light.');
  return 0;
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(`--${n}`);
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? null : argv[i + 1]; };

  if (flag('self-test')) process.exit(selfTest());

  if (flag('sync')) {
    const r = sync(HERE, { dryRun: flag('dry-run') });
    console.log(`land --sync: ${r.written.length} file(s) brought in from the branch, ${r.skipped.length} left alone.`);
    for (const s of r.skipped.slice(0, 20)) console.log(`   skipped ${s.path} — ${s.why}`);
    process.exit(0);
  }

  const words = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { if (['paths', 'exclude', 'branch', 'remote'].includes(argv[i].slice(2))) i++; continue; }
    words.push(argv[i]);
  }
  if (!words.length) {
    console.error('usage: node tools/land.mjs "headline" [body...] [--paths a,b] [--exclude p] [--dry-run] [--sync] [--self-test]');
    process.exit(2);
  }
  // `--paths` IS COMMA-SEPARATED, AND SPACE-SEPARATING IT SILENTLY LANDS ONLY THE FIRST PATH.
  // Caught 2026-08-15: `--paths a.md b.mjs c.json` landed `a.md`, swept `b.mjs` and `c.json` into the
  // commit MESSAGE as body paragraphs, and printed "1 path(s) ... verified 1 path(s)" — a success
  // line for a bank that carried a quarter of what it was given. Refusing is one-sided (§0b): a
  // message word that is also an existing path in this repo is never prose, and this guard can only
  // ever stop a bank, never widen one.
  const strayPaths = words.slice(1).filter((w) => !w.startsWith('-') && existsSync(join(HERE, w)));
  if (strayPaths.length) {
    console.error(`land: REFUSED — ${strayPaths.length} message word(s) are existing paths in this repo:`);
    for (const p of strayPaths) console.error(`         ${p}`);
    console.error('       `--paths` takes ONE comma-separated argument. You almost certainly meant:');
    console.error(`         --paths ${[val('paths'), ...strayPaths].filter(Boolean).join(',')}`);
    console.error('       If a path really is part of your headline, put the whole message in one quoted argument.');
    process.exit(2);
  }
  const opts = {
    paths: val('paths') ? val('paths').split(',').map((s) => s.trim()).filter(Boolean) : null,
    exclude: val('exclude') ? val('exclude').split(',').map((s) => s.trim()).filter(Boolean) : [],
    branch: val('branch') || undefined,
    remote: val('remote') || undefined,
    dryRun: flag('dry-run'),
    allowDeletions: flag('allow-deletions'),
  };
  const message = words.length > 1
    ? `${words[0]}\n\n${words.slice(1).join('\n\n')}\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
    : `${words[0]}\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>`;

  let r;
  try { r = land(HERE, message, opts); }
  catch (e) { console.error(`land: ${e.message}`); process.exit(1); }

  if (!r.landed) { console.log(`land: ${r.reason}${r.changed?.length ? ` (${r.changed.length} path(s) would land)` : ''}`); process.exit(opts.dryRun ? 0 : 0); }
  console.log(`land: ${r.commit.slice(0, 10)} — ${r.changed.length} path(s), attempt ${r.attempt}.`);
  for (const d of r.decisions) console.log(`   conflict ${d.path}: ${d.why}${d.rescue ? ` — other side kept at ${d.rescue}` : ''}`);
  if (r.suppressed?.length) {
    console.log(`land: ${r.suppressed.length} path(s) are in HEAD but not on this disk. NOT carried as deletions —`);
    console.log('      in a shared tree that almost always means "written in another agent\'s worktree", not "removed".');
    for (const p of r.suppressed.slice(0, 12)) console.log(`   kept ${p}`);
    if (r.suppressed.length > 12) console.log(`   … and ${r.suppressed.length - 12} more`);
    console.log('      Run `node tools/land.mjs --sync` to bring them onto this disk, or pass --allow-deletions if you meant it.');
  }

  const bad = verify(HERE, r.changed.filter((p) => !p.startsWith('reports/land-rescue/')),
    { branch: opts.branch, commit: r.commit, ours: r.ours, decisions: r.decisions });
  if (bad.length) {
    console.error(`land: VERIFICATION FAILED against the remote blob for ${bad.length} path(s) — this is NOT banked:`);
    for (const b of bad.slice(0, 20)) console.error(`   ${b.path}: ${b.why}`);
    process.exit(1);                     // exit code tracks reality, not git's opinion of itself
  }
  console.log(`land: verified ${r.changed.length} path(s) against the remote blob.`);
}
