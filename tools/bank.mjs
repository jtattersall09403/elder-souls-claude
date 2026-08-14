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
//   node tools/bank.mjs "headline"            # stage everything, attribute it, LAND it, verify it
//   node tools/bank.mjs "headline" --dry-run  # print the message and stop
//
// Anything after the headline that is not a flag is appended as the message body, before the
// generated attribution block.
//
// ---------------------------------------------------------------------------------------------
// 2026-08-14: THIS TOOL WAS THE LARGEST SINGLE SOURCE OF LOST WORK, AND HERE IS WHAT CHANGED
// ---------------------------------------------------------------------------------------------
//
// Commit `06dafd04` — a bank — deleted 18 files and 22,209 lines of finished agent work in one go.
// The forensic is in `tools/land.mjs`'s header and in HAZARDS §2f. In one line: the bank staged the
// **working tree** and committed it with **origin as a parent**, and a second parent is a claim that
// your tree already accounts for that branch. It did not. Every file that had arrived since this
// disk was last updated was therefore recorded as a deliberate deletion, and git believed it.
//
// So the two dangerous halves are gone:
//   * `git add -A` is no longer staged against origin. The changed set is now the working tree
//     measured **against HEAD** — the commit this disk was actually checked out from — which is the
//     only baseline under which "absent" honestly means "removed".
//   * `git commit` is no longer how it reaches the branch. `tools/land.mjs` does a real three-way
//     merge with `git merge-tree`, takes no `.git/index.lock`, retries when a sibling lands first,
//     and verifies the bytes against the remote blob before claiming success.
//
// Everything else here is unchanged and deliberately so: the parse guard, the push gate, the
// attribution block, and the fact that this stages other agents' in-flight work on purpose (rule 28)
// because an hour of unbanked work dies with the next container restart.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const words = argv.filter(a => !a.startsWith('--'));
const headline = words[0];
if (!headline) {
  console.error('usage: node tools/bank.mjs "headline" [body...] [--dry-run]');
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

// `git commit-tree` does not run hooks, and `.githooks/pre-commit` was quietly doing real work on
// every bank: regenerating `orchestration/INDEX.md` (the orientation index a dozen agents read
// instead of rediscovering 441 tools), and republishing `docs/` (GitHub Pages serves it from this
// branch, so a stale page is a silent lie about where the project is). Losing that silently would be
// exactly the kind of invisible regression this whole exercise exists to stop, so it runs here
// instead, explicitly, in the same order and with the same non-blocking temperament the hook had.
for (const [label, cmd] of [['gen-index', ['tools/gen-index.mjs']], ['publish', ['tools/publish.mjs']]]) {
  try { execFileSync('node', cmd, { cwd: ROOT, stdio: 'pipe', timeout: 180_000 }); }
  catch { console.log(`bank: ${label} failed — its generated files may be stale in this commit.`); }
}

// The five-minute wait for `.git/index.lock` is gone, and with it the eight consecutive refusals
// that once left the tree unbanked for a quarter of an hour. Nothing below this line takes the
// index lock: the changed set is read with `git diff`/`git ls-files`, and `land.mjs` stages into a
// private index (`GIT_INDEX_FILE`). A dozen agents can commit throughout, and this cannot lose to
// them or make them lose to it.
//
// What is staged is the working tree measured AGAINST HEAD, never against origin. That is the whole
// repair. A file a sibling pushed an hour ago is absent from this disk and also absent from HEAD, so
// it is not a change and is not carried. Measured against origin — the old recipe — the identical
// situation reads as "this file was deleted", which is how twenty files went at a stroke.
const staged = [
  ...git('diff', '--name-only', 'HEAD').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].map(s => s.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
if (!staged.length) { console.log('bank: nothing to bank.'); process.exit(0); }

// Paths the gates below decide must not ship. `land.mjs` takes them as `--exclude`, which is the
// same behaviour the old `git restore --staged` had — drop the offender, bank the other forty files
// — without needing an index to restore them out of.
const exclude = [];

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
    console.log(`bank: ${broken.length} staged file(s) do not parse — excluding them rather than committing a broken tree:`);
    for (const p of broken) console.log(`    ${p}`);
    exclude.push(...broken);
    for (const p of broken) staged.splice(staged.indexOf(p), 1);
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
    const stillStaged = new Set(staged);
    const toUnstage = [...new Set(uniq.filter((p) => stillStaged.has(p.importer)).map((p) => p.importer))];
    console.log(`bank: PUSH GATE — ${uniq.length} unresolved import problem(s) the deployed site would 404 on:`);
    for (const p of uniq) {
      const owner = ownerOf(p.rel);
      const fixable = stillStaged.has(p.importer);
      console.log(`  ${p.kind.padEnd(15)} ${p.rel}  (imported by ${p.importer})${owner ? `  — claimed by (live): ${owner}` : ''}`);
      console.log(`  ${''.padEnd(15)}   ${fixable ? 'part of this bank — excluding it from the commit' : 'ALREADY AT HEAD — this is live on the deployed site right now'}`);
    }
    if (toUnstage.length) {
      exclude.push(...toUnstage);
      for (const p of toUnstage) { const i = staged.indexOf(p); if (i !== -1) staged.splice(i, 1); }
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
  lines.push('Nothing that was already on the branch was reverted to put it there — this is a real');
  lines.push('three-way merge (tools/land.mjs), not a snapshot wearing a merge parent.');
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

// The commit AND the push, in one operation, because a bank that commits without pushing is an hour
// of work sitting on a disk that has been reclaimed twice in a day. `land()` merges rather than
// snapshots, retries when a sibling lands first, and returns only when it has pushed.
const { land, verify } = await import('./land.mjs');
let result;
try {
  result = land(ROOT, msg, { exclude });
} catch (e) {
  console.error(`bank: LAND FAILED — nothing was pushed. ${e.message}`);
  process.exit(1);
}
if (!result.landed) { console.log(`bank: ${result.reason}.`); process.exit(0); }

console.log(`\nbank: landed ${result.commit.slice(0, 10)} — ${result.changed.length} path(s) across ${byPiece.size} named piece(s), attempt ${result.attempt}.`);
for (const d of result.decisions) {
  console.log(`  conflict ${d.path}: resolved ${d.why}${d.rescue ? ` — the other side is preserved at ${d.rescue}` : ''}`);
}

// Verify against the remote blob, never against local state (hazard 2). This tool once printed
// failure and exited 0, so every retry loop in the fleet believed a lie; the exit code here tracks
// whether the bytes are actually on the branch and nothing else.
const bad = verify(ROOT, result.changed.filter(p => !p.startsWith('reports/land-rescue/')));
if (bad.length) {
  console.error(`bank: VERIFICATION FAILED for ${bad.length} path(s) — THIS WORK IS NOT BANKED:`);
  for (const b of bad.slice(0, 20)) console.error(`  ${b.path}: ${b.why}`);
  process.exit(1);
}
console.log(`bank: verified ${result.changed.length} path(s) against the remote blob.`);
