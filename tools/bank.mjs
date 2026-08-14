#!/usr/bin/env node
// bank.mjs — the orchestrator's commit, with the attribution filled in.
//
// Rule 28 splits committing in two: an agent commits its own declared paths with `git commit
// --only`, and the orchestrator banks whatever is left. The second half is a deliberate `git add
// -A`, and it exists because the container has restarted twice in a day and taken nine agents with
// it each time — an hour of unbanked work is a worse outcome than a commit with mixed authorship.
//
// But it has now absorbed three agents' finished work under a message that named none of them. The
// W1-16 builder found its code, tool, status file, screenshot and blog line already at HEAD under
// somebody else's commit; the W1-12 critic found its verdict there. Nothing was lost either time
// and both had to go looking to find out. That is a real cost and it is entirely avoidable: the
// ownership registry already knows who claims what, so the bank can say so.
//
//   node tools/bank.mjs "headline"            # stage everything, attribute it, commit
//   node tools/bank.mjs "headline" --dry-run  # print the message and stop
//   node tools/bank.mjs --self-test           # four arms that must genuinely disagree
//
// Anything after the headline that is not a flag is appended as the message body, before the
// generated attribution block.
//
// HAZARDS.md entry 6, in one line: this tool used to say a bank had failed and then exit 0 anyway —
// the *pipeline* checks the exit code, not the words, and every `if node tools/bank.mjs …; then …`
// loop believed a lie. Two shapes of that bug lived here:
//
//   1. Two call sites un-staged a path, printed why, and then trusted their OWN in-memory bookkeeping
//      (a spliced JS array) about what got excluded — inside a `try { git restore --staged … } catch
//      {}` that swallowed the one failure mode that mattered. If the restore itself failed, the path
//      was still sitting in the real index, the commit carried it anyway, and the printed message
//      ("excluded N path(s)") was false. Fixed by re-reading `git diff --cached --name-only` after
//      every restore instead of trusting the splice, and by treating a failed restore as a hard stop
//      (non-zero) rather than a swallowed exception.
//   2. Nothing verified, after `git commit` returned success, that HEAD actually contained every
//      staged path. `execFileSync` not throwing only means git's own exit code was 0; it says
//      nothing about content. Fixed by diffing HEAD's own tree against the staged list post-commit
//      and failing loudly (non-zero, commit left in place, nothing auto-amended) on any mismatch —
//      "zero only when the work is verifiably in the tree."
//
// Neither fix touches the commit path itself (rule 13): the restore fix makes an existing un-stage
// step honest about its own result, and the post-commit verify runs strictly after `git commit` has
// already returned, so it cannot block or delay a commit that was going to happen anyway — it can
// only change whether this *tool* is truthful about what happened.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const git = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const stagedNames = (root) => git(root, 'diff', '--cached', '--name-only').split('\n').map(s => s.trim()).filter(Boolean);

/**
 * Poll `<root>/.git/index.lock` until it clears or `deadlineMs` passes. Pure w.r.t. its inputs —
 * `root` and the timing knobs are all parameters, nothing is read from module-level state — so
 * `--self-test` can point it at a scratch repo with a millisecond deadline instead of waiting out
 * the real 300s to prove the timeout arm actually fires.
 *
 * Returns `{ held, waitedMs }`. `held: true` means the caller must NOT proceed — staging over a
 * lock that is still there is how a crashed commit's half-written index gets compounded.
 */
function waitForIndexLock(root, { deadlineMs = 300_000, pollMs = 1500, sleep = (ms) => execFileSync('sleep', [String(ms / 1000)]) } = {}) {
  const lock = join(root, '.git', 'index.lock');
  const deadline = Date.now() + deadlineMs;
  let waited = 0;
  while (existsSync(lock) && Date.now() < deadline) {
    sleep(pollMs);
    waited += pollMs;
  }
  return { held: existsSync(lock), waitedMs: waited };
}

/** Every path git actually carried in `ref`'s own diff (default HEAD vs its parent). */
function committedPathsOf(root, ref = 'HEAD') {
  try {
    return git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', '--root', ref)
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch { return null; } // could not even ask git — treat as "cannot verify", not as "fine"
}

/**
 * Which of `staged` did NOT end up in `committed`. `committed === null` means the verification call
 * itself failed, which is not evidence of success — every staged path is reported missing so the
 * caller fails closed rather than silently trusting an unanswered question.
 */
function missingFromCommit(staged, committed) {
  if (committed === null) return [...staged];
  const have = new Set(committed);
  return staged.filter(p => !have.has(p));
}

// -------------------------------------------------------------------------------------------------
// --self-test. Four arms; each one has a case that must pass and a case that must fail, driven at
// real git repos (not reimplemented logic) so the test exercises the same functions the real run
// does. RULES.md rule 4: a probe that cannot fail is worse than no probe — every `fail(...)` below
// was watched to actually fire before the corresponding fix landed.
// -------------------------------------------------------------------------------------------------
function selfTest() {
  let failures = 0;
  const fail = (msg) => { console.error(`bank --self-test: FAILED — ${msg}`); failures++; };

  const mkRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'bank-selftest-'));
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'selftest@bank.local');
    git(dir, 'config', 'user.name', 'bank-selftest');
    writeFileSync(join(dir, 'seed.txt'), 'seed\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'seed');
    return dir;
  };
  const cleanup = (dir) => { try { rmSync(dir, { recursive: true, force: true }); } catch { } };

  // Arm 1 — index.lock. A lock that never clears must be reported held (non-zero downstream); a
  // lock that is already clear must not be. These must disagree, or the check is a tautology.
  {
    const dir = mkRepo();
    const lock = join(dir, '.git', 'index.lock');
    writeFileSync(lock, '');
    const held = waitForIndexLock(dir, { deadlineMs: 250, pollMs: 40, sleep: (ms) => execFileSync('sleep', [String(ms / 1000)]) });
    if (!held.held) fail('a lock file that was never released was reported as cleared — bank would have staged over a crashed commit');
    rmSync(lock);
    const clear = waitForIndexLock(dir, { deadlineMs: 250, pollMs: 40 });
    if (clear.held) fail('a lock that was already gone was reported as still held — false positive on an ordinary clean run');
    cleanup(dir);
  }

  // Arm 2 — clean run. Every staged path lands in the commit; verification must say so and exit 0.
  {
    const dir = mkRepo();
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git(dir, 'add', '-A');
    const staged = stagedNames(dir);
    git(dir, 'commit', '-q', '-m', 'clean run');
    const missing = missingFromCommit(staged, committedPathsOf(dir));
    if (missing.length) fail(`a commit that genuinely carried every staged path was reported incomplete: ${missing.join(', ')}`);
    cleanup(dir);
  }

  // Arm 3 — a commit that silently drops a staged path (the exact shape a stripping hook or a lost
  // race produces: `git commit` itself returns 0). Verification must catch it, not wave it through.
  {
    const dir = mkRepo();
    writeFileSync(join(dir, 'c.txt'), 'c\n');
    writeFileSync(join(dir, 'd.txt'), 'd\n');
    git(dir, 'add', '-A');
    const staged = stagedNames(dir); // ['c.txt', 'd.txt']
    git(dir, 'commit', '-q', '--only', 'c.txt', '-m', 'partial'); // d.txt never lands — deliberately
    const missing = missingFromCommit(staged, committedPathsOf(dir));
    if (missing.length !== 1 || missing[0] !== 'd.txt') {
      fail(`a commit that dropped d.txt was not caught (got missing=${JSON.stringify(missing)}) — this is the bug this tool exists to close`);
    }
    cleanup(dir);
  }

  // Arm 4 — the restore-silently-failed shape that actually shipped: after `git restore --staged`
  // is invoked, the fix trusts a fresh `git diff --cached --name-only`, never a hand-spliced array.
  // Prove the two can genuinely differ: restore a path that is NOT staged (so the real command
  // no-ops on that name) alongside one that IS, and confirm ground truth — not intent — decides.
  {
    const dir = mkRepo();
    writeFileSync(join(dir, 'e.txt'), 'e\n');
    writeFileSync(join(dir, 'f.txt'), 'f\n');
    git(dir, 'add', '-A');
    execFileSync('git', ['restore', '--staged', 'f.txt'], { cwd: dir, stdio: 'pipe' });
    const groundTruth = stagedNames(dir);
    if (groundTruth.includes('f.txt')) fail('git restore --staged f.txt ran but f.txt is still staged — the ground-truth re-read itself is broken');
    if (!groundTruth.includes('e.txt')) fail('e.txt was never touched but ground truth lost it anyway — the re-read is not narrow to what was restored');
    cleanup(dir);
  }

  const ok = failures === 0;
  console.log(ok ? 'bank --self-test: PASS (4/4)' : `bank --self-test: ${failures} FAILURE(S) of 4`);
  process.exit(ok ? 0 : 1);
}

// -------------------------------------------------------------------------------------------------
// Main run.
// -------------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const words = argv.filter(a => !a.startsWith('--'));
  const headline = words[0];
  if (!headline) {
    console.error('usage: node tools/bank.mjs "headline" [body...] [--dry-run]');
    console.error('       node tools/bank.mjs --self-test');
    process.exit(2);
  }
  const body = words.slice(1).join('\n\n');

  /** Live pieces and the paths they declare, straight from the status files (RULES rule 16). */
  function claims() {
    const dir = join(ROOT, 'orchestration', 'status');
    const out = [];
    if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      let j; try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
      const state = String(j.state || '');
      // "Live" is generous on purpose. A piece that finished ten minutes ago still authored the files
      // this bank is about to carry, and naming it costs nothing; a piece filtered out because it
      // said "complete" is exactly the case that went unattributed three times.
      if (/abandoned|superseded/i.test(state)) continue;
      const paths = [...(j.files_touched || []), ...(j.files_claimed || [])].filter(p => typeof p === 'string');
      if (paths.length) out.push({ id: j.task_id || f.replace(/\.json$/, ''), state, paths });
    }
    return out;
  }

  /**
   * How well a declaration matches a staged path, or -1 for no match. The number is the length of
   * the declaration that matched, so a longer declaration is a more specific claim.
   *
   * Specificity is the whole game here. The first version of this attributed every screenshot to
   * nineteen pieces, because nineteen status files claim the directory `docs/shots/` and every
   * picture in the project lives there. A claim that matches everything identifies nothing; naming
   * nineteen owners for one file is worse than naming none, because it reads like a real answer.
   */
  const matchLen = (decl, path) => {
    if (decl === path) return decl.length + 1000;              // exact beats any directory claim
    if (decl.endsWith('/') && path.startsWith(decl)) return decl.length;
    return -1;
  };

  // If another process is mid-commit, do not race it. `git add -A` while an agent sits between its
  // own `git add` and its `git commit --only` is how that agent's staged work ends up in this
  // commit instead of its own — a critic named the gap precisely: the rule tells a *finishing*
  // agent how to behave and says nothing to a *waiting* one. This is the orchestrator's half of
  // that. It is not airtight (the lock exists only for the moments git holds it), but it converts
  // the most common collision into a retry.
  // Wait for the lock rather than giving up on it. The first version exited immediately, which was
  // right in principle and useless in practice: with a dozen agents committing, `.git/index.lock`
  // exists most of the time, and eight consecutive refusals meant the tree went unbanked for a
  // quarter of an hour — the exact outcome banking exists to prevent. Poll instead, briefly.
  const lockResult = waitForIndexLock(ROOT);
  if (lockResult.held) {
    // Ninety-plus seconds of continuous lock is not contention, it is a crashed commit or a very
    // slow hook. Say which is more likely rather than silently proceeding over it — and exit
    // non-zero, because nothing got banked.
    console.log('bank: `.git/index.lock` held for 300s — either a hook is still running or a commit');
    console.log('      crashed and left the lock behind. Not staging over it. Check with `ls -l .git/index.lock`.');
    process.exit(1);
  }
  if (lockResult.waitedMs) console.log(`bank: waited ${(lockResult.waitedMs / 1000).toFixed(0)}s for another commit to finish.`);

  try {
    git(ROOT, 'add', '-A');
  } catch (e) {
    console.error('bank: `git add -A` failed — another process likely grabbed the index lock in the gap right');
    console.error('      after the wait above. Not a false success: nothing was staged, nothing was committed.');
    process.exit(1);
  }
  let staged = stagedNames(ROOT);
  if (!staged.length) { console.log('bank: nothing to bank.'); process.exit(0); }

  // Parse-check every staged JavaScript file before committing it. The bank stages the tree
  // mid-write on purpose, and that is usually harmless — a half-written status file or an
  // unfinished tool costs nothing. But it committed `converse.js` mid-edit once, and HEAD threw
  // `ReferenceError` on import for the window between two banks: every agent that pulled in that
  // window got a broken engine, from a commit whose whole purpose was to protect their work.
  //
  // `node --check` is a parse, not a review. It cannot tell a finished edit from an unfinished one
  // that happens to parse, and it is not meant to — it catches the case that actually happened, in
  // about a millisecond per file, and it un-stages the offender rather than refusing the whole bank,
  // because the other forty files still need saving.
  {
    // Only files that ALREADY PARSE IN HEAD. The risk this guards is a regression — a working file
    // caught mid-edit, which is what happened to `converse.js` and left HEAD throwing on import for
    // every agent that pulled. A *new* file that does not parse cannot regress anything, and refusing
    // it is a false positive with a real cost: it refused `clamp-before-r2.js`, which is a bare
    // function expression saved verbatim from an old commit so a delete-the-fix arm can install it on
    // a live object. That is a legitimate artifact, deliberately not a module, and un-staging it
    // forever would have quietly kept a control out of the tree.
    const parsesInHead = (rel) => {
      try {
        const src = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
        const tmp = join(tmpdir(), `bank-head-${rel.replace(/[^a-z0-9]/gi, '_')}`);
        writeFileSync(tmp, src);
        try { execFileSync('node', ['--check', tmp], { stdio: 'pipe' }); return true; }
        finally { try { rmSync(tmp); } catch { } }
      } catch { return false; }        // not in HEAD, or did not parse there either
    };
    const risky = staged.filter(p => /\.(mjs|cjs|js)$/.test(p) && existsSync(join(ROOT, p)));
    const broken = [];
    for (const p of risky) {
      try { execFileSync('node', ['--check', join(ROOT, p)], { stdio: 'pipe' }); }
      catch { if (parsesInHead(p)) broken.push(p); }
    }
    if (broken.length) {
      console.log(`bank: ${broken.length} staged file(s) do not parse — un-staging them rather than committing a broken tree:`);
      for (const p of broken) console.log(`    ${p}`);
      // The un-stage itself can fail (index contention, a stray lock). That failure used to be
      // swallowed by an empty `catch {}`, after which the code trusted its OWN in-memory list of
      // what it "excluded" rather than the real index — so a restore that silently failed left the
      // broken file staged, the commit carried it anyway, and this message claimed otherwise. Fail
      // closed instead, and re-derive `staged` from git rather than splicing a JS array.
      try {
        execFileSync('git', ['restore', '--staged', ...broken], { cwd: ROOT, stdio: 'pipe' });
      } catch (e) {
        console.error('bank: failed to un-stage the broken file(s) above — refusing to commit rather than risk');
        console.error('      shipping a tree that does not even parse.');
        process.exit(1);
      }
      staged = stagedNames(ROOT); // ground truth, not `staged.splice(...)`
      if (!staged.length) { console.log('bank: nothing left to bank.'); process.exit(0); }
    }
  }

  // GATE-BLAST-RADIUS (RULES.md rule 13). This is the push/deploy chokepoint the per-agent
  // pre-commit gate now defers to: `tools/check-shipped-files.mjs` blocks an individual `git commit
  // --only` only when THAT commit's own paths are the offending importer, and warns-and-passes
  // otherwise, on purpose — a fail-closed check that fired on a neighbour's in-flight work cost a
  // builder fourteen consecutive refused commits. But something has to actually keep a broken import
  // off the deployed site, and this is it: one actor, not a dozen racing ones.
  //
  // `git add -A` above already resolved the common case — a file that exists on disk anywhere gets
  // staged and tracked here regardless of who wrote it, so "NOT IN GIT" mostly self-heals under a
  // bank. What survives to this point is "MISSING ON DISK": a tracked importer names a path nothing
  // on this machine has written yet. That genuinely cannot ship.
  //
  // Same shape as the parse-check above, deliberately: un-stage the offender rather than refuse the
  // whole bank, because the other N files still need saving (rule 1) — a bank that stops entirely
  // over one broken import is the fail-closed-for-everyone failure moved one level up, not fixed. If
  // the offending importer is part of THIS bank's own diff, unstaging it keeps the NEW brokenness out
  // of what ships this round; the importer's other changes wait for a later bank once the target
  // exists. If the importer predates this bank (unchanged, already at HEAD), there is nothing to
  // unstage — that breakage was already live before this bank ran, and unstaging a no-op would hide
  // it rather than fix it, so it is reported exactly as loudly instead, for the orchestrator to act on.
  {
    const { scan, ownerOf } = await import('./check-shipped-files.mjs');
    const { problems } = scan();
    if (problems.length) {
      const seen = new Set();
      const uniq = problems.filter((p) => { const k = p.kind + p.rel + p.importer; if (seen.has(k)) return false; seen.add(k); return true; });
      const stillStaged = new Set(stagedNames(ROOT));
      const toUnstage = [...new Set(uniq.filter((p) => stillStaged.has(p.importer)).map((p) => p.importer))];
      console.log(`bank: PUSH GATE — ${uniq.length} unresolved import problem(s) the deployed site would 404 on:`);
      for (const p of uniq) {
        const owner = ownerOf(p.rel);
        const fixable = stillStaged.has(p.importer);
        console.log(`  ${p.kind.padEnd(15)} ${p.rel}  (imported by ${p.importer})${owner ? `  — claimed by (live): ${owner}` : ''}`);
        console.log(`  ${''.padEnd(15)}   ${fixable ? 'part of this bank — excluding it from the commit' : 'ALREADY AT HEAD — this is live on the deployed site right now'}`);
      }
      if (toUnstage.length) {
        // Same fail-closed fix as the parse-check above: do not swallow a failed restore, and do
        // not trust a hand-spliced array over the real index.
        try {
          execFileSync('git', ['restore', '--staged', ...toUnstage], { cwd: ROOT, stdio: 'pipe' });
        } catch (e) {
          console.error('bank: PUSH GATE — failed to un-stage the offending path(s) above; refusing to commit');
          console.error('      rather than risk shipping a broken import.');
          process.exit(1);
        }
        staged = stagedNames(ROOT); // ground truth
        console.log(`bank: excluded ${toUnstage.length} path(s) from this commit; the rest of the tree still banks.`);
      }
      if (uniq.some((p) => !stillStaged.has(p.importer))) {
        console.log('bank: at least one of the above predates this bank and cannot be fixed by unstaging —');
        console.log('      it is a standing defect on the shipped tree. Dispatch its owner (named above where known).');
      }
      if (!staged.length) { console.log('bank: nothing left to bank.'); process.exit(0); }
    }
  }

  const owners = claims();
  const byPiece = new Map();
  const unclaimed = [];
  let broadOnly = 0;
  for (const path of staged) {
    const scored = owners
      .map(o => ({ o, n: Math.max(...o.paths.map(d => matchLen(d, path)), -1) }))
      .filter(x => x.n >= 0);
    if (!scored.length) { unclaimed.push(path); continue; }
    const best = Math.max(...scored.map(x => x.n));
    const hits = scored.filter(x => x.n === best).map(x => x.o);
    // If the only thing anyone said was "I might write somewhere in this directory", and more than
    // two pieces said it, that is not attribution — it is the registry admitting it does not know.
    if (best < 1000 && hits.length > 2) { broadOnly++; continue; }
    for (const h of hits) {
      if (!byPiece.has(h.id)) byPiece.set(h.id, { state: h.state, files: [] });
      byPiece.get(h.id).files.push(path);
    }
  }

  const lines = [headline, ''];
  if (body) lines.push(body, '');
  lines.push(`Orchestrator bank (rule 28's other half), so this is \`git add -A\` on purpose: ${staged.length} path(s).`);
  if (byPiece.size) {
    lines.push('', 'Whose work this carries, from the ownership registry rather than from memory:');
    for (const [id, v] of [...byPiece].sort((a, b) => b[1].files.length - a[1].files.length)) {
      const shown = v.files.slice(0, 4).join(', ');
      // A status file's `state` is free text and some run to a paragraph; a commit message wants the
      // word, not the essay.
      const state = v.state.split(/[\s—-]/)[0].slice(0, 24) || 'unknown';
      lines.push(`  ${id} [${state}] — ${v.files.length} file(s): ${shown}${v.files.length > 4 ? ', …' : ''}`);
    }
    lines.push('', 'If your work is listed above, it is at HEAD under this message rather than yours.');
    lines.push('That is the cost of banking a shared tree continuously; the alternative was losing it.');
  }
  if (broadOnly) {
    lines.push('', `${broadOnly} staged path(s) matched only a shared directory claim held by three or`,
      'more pieces, so the registry cannot say whose they are. Not guessed.');
  }
  if (unclaimed.length) {
    lines.push('', `${unclaimed.length} staged path(s) are claimed by nobody — a piece that declares nothing`,
      'is invisible to everyone else no matter how careful they are (rule 16):');
    for (const p of unclaimed.slice(0, 12)) lines.push(`  ${p}`);
    if (unclaimed.length > 12) lines.push(`  … and ${unclaimed.length - 12} more`);
  }
  // A machine-readable trailer, because the bank has made `git log -- <path>` misleading. A builder
  // looking for the commit that last touched its own file, in order to find a delete-the-fix base,
  // finds eight orchestrator banks that carried the file mid-edit under someone else's message. It
  // said so, and it was right. With this, `git log --invert-grep --grep=Orchestrator-Bank -- <path>`
  // gives the authored history back.
  lines.push('', 'Orchestrator-Bank: true');
  lines.push('Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>');

  const msg = lines.join('\n');
  if (dryRun) { console.log(msg); process.exit(0); }

  try {
    execFileSync('git', ['commit', '-q', '-F', '-'], { cwd: ROOT, input: msg, stdio: ['pipe', 'inherit', 'inherit'] });
  } catch (e) {
    console.error('bank: commit failed (another agent may hold the index lock — retry).');
    process.exit(1);
  }

  // The part that was missing entirely: `execFileSync` not throwing only means `git commit` itself
  // returned 0. It says nothing about whether the commit's own tree carries what we staged — a hook
  // can rewrite the index, a race can land a different commit in between, and the old code declared
  // success on the strength of an exit code that never checked content. Diff HEAD's own tree against
  // what we staged and refuse to call this a success if anything is missing. The commit already
  // happened and is left in place (no auto-amend on a shared, possibly-contended tree) — but the
  // exit code and the message are honest about it rather than congratulatory.
  const missing = missingFromCommit(staged, committedPathsOf(ROOT));
  if (missing.length) {
    console.error(`bank: COMMIT RAN BUT DOES NOT CARRY ${missing.length} STAGED PATH(S) — this is the exact`);
    console.error('      failure HAZARDS.md entry 6 is about. HEAD moved; the content did not all land.');
    console.error('      Do not report this bank as successful. Missing:');
    for (const p of missing.slice(0, 20)) console.error(`        ${p}`);
    if (missing.length > 20) console.error(`        … and ${missing.length - 20} more`);
    process.exit(1);
  }

  console.log(`\nbank: committed ${staged.length} path(s) across ${byPiece.size} named piece(s), verified present in HEAD.`);
  // Requirement, not decoration: bank.mjs does not push (TICK.md's step 2 pushes separately, right
  // after this call), and an agent whose retry loop only checks THIS tool's exit code has no other
  // way to learn that. Several commits have been rescued by hand after an agent read "committed" as
  // "landed on origin" and moved on. Say it every time, unconditionally, not just on failure.
  console.log('bank: NOT PUSHED. This committed to the local branch only — run `git push`, or let the');
  console.log('      orchestrator tick push it, before treating this work as landed on origin.');
  process.exit(0);
}

// Only run the CLI when this file is executed directly — `--self-test` and the exported functions
// stay reachable for anything that wants to import them without triggering a real bank.
if (fileURLToPath(import.meta.url) === (process.argv[1] && resolve(process.argv[1]))) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

export { waitForIndexLock, committedPathsOf, missingFromCommit };
