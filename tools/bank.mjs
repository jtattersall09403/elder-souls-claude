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
//
// Anything after the headline that is not a flag is appended as the message body, before the
// generated attribution block.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

// If another process is mid-commit, do not race it. `git add -A` while an agent sits between its
// own `git add` and its `git commit --only` is how that agent's staged work ends up in this
// commit instead of its own — a critic named the gap precisely: the rule tells a *finishing*
// agent how to behave and says nothing to a *waiting* one. This is the orchestrator's half of
// that. It is not airtight (the lock exists only for the moments git holds it), but it converts
// the most common collision into a retry.
if (existsSync(join(ROOT, '.git', 'index.lock'))) {
  console.log('bank: another commit is in progress — not staging over it. Retry in a moment.');
  process.exit(1);
}

git('add', '-A');
const staged = git('diff', '--cached', '--name-only').split('\n').map(s => s.trim()).filter(Boolean);
if (!staged.length) { console.log('bank: nothing to bank.'); process.exit(0); }

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
lines.push('', 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>');

const msg = lines.join('\n');
if (dryRun) { console.log(msg); process.exit(0); }

try {
  execFileSync('git', ['commit', '-q', '-F', '-'], { cwd: ROOT, input: msg, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`\nbank: committed ${staged.length} path(s) across ${byPiece.size} named piece(s).`);
} catch (e) {
  console.error('bank: commit failed (another agent may hold the index lock — retry).');
  process.exit(1);
}
