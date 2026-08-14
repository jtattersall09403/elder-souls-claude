#!/usr/bin/env node
// tools/stranded-check.mjs
//
// Dispatched 2026-08-14 (reports/stranded-triage/2026-08-14-triage.md) to catch the class that
// report triaged by hand: a status file claims a non-terminal state (building/measuring/running/
// in_progress) while the piece has actually landed or moved on, because the agent's turn ended
// before it could write the final word and its own deliverables surfaced later under an
// unrelated bank commit's headline (rule 28's cost, paid here a third time — see critic-w1-20,
// critic-w1-attr-scale in OWNERSHIP-SWEEP-20260814.json, and W1-20-r3-remediation in this
// dispatch's own report).
//
// WHAT THIS CHECKS, per live (non-terminal) status file:
//   1. Its OWN freshness via `git log -1 --format=%ct -- <status file>` — NOT fs.stat mtime.
//      mtime is proven wrong on this tree (OWNERSHIP-SWEEP-20260814.md: hundreds of files share
//      one checkout-cluster mtime) and this dispatch found it wrong a second, independent way:
//      orchestration/status/W1-18.json's mtime read 11.5h old while its last REAL commit was
//      2026-08-09 -- 122h old, a 10x error in the direction that makes a five-day-dead piece
//      look like today's work.
//   2. Whether anything under its declared files (files_touched + files_claimed; falls back to
//      outputs_written + outputs_expected for the status-file schema that uses those names
//      instead -- W1-00-fix2 uses this shape and a files_touched-only reader undercounts it,
//      the same blind-spot family as the status/state bug OWNERSHIP-SWEEP-20260814 fixed) has a
//      commit AFTER the status file's own last commit. If so: the piece kept moving on the
//      branch after its status file stopped saying so -- a STRANDED-CANDIDATE, not proof of
//      anything, but exactly the lead a human/orchestrator should read before trusting the state
//      field.
//   3. Whether the piece's own `next_step` text names a `corpus/90-verdicts/**` path that
//      already exists on disk and post-dates the status file -- the reusable technique
//      OWNERSHIP-SWEEP-20260814.md named directly (the check that cleared critic-w1-20 and
//      critic-w1-attr-scale by hand). Automated here so it stops being a manual pass.
//
// This is a WARNING tool. It never clears a claim and never edits a file; it prints candidates
// for a human/agent to verify the way this dispatch verified them (read the diff, read the
// verdict, don't guess). Exit code is always 0 on a normal run; --self-test exits non-zero if a
// known-stranded fixture is not flagged.
//
// Usage:
//   node tools/stranded-check.mjs                 # scan the live tree, print candidates
//   node tools/stranded-check.mjs --task <id>      # check one piece by task_id / filename stem
//   node tools/stranded-check.mjs --self-test      # prove it fires on a real, already-verified case

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim();
const STATUS_DIR = path.join(ROOT, 'orchestration', 'status');

const NON_TERMINAL_RE = /(^|\s)(building|measuring|running|in progress)(\s|$)/;

function norm(s) {
  return String(s).toLowerCase().replace(/[_-]/g, ' ');
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function statusFileCommitEpoch(relPath) {
  const out = git(['log', '-1', '--format=%ct', '--', relPath]);
  return out ? Number(out) : null;
}

// Declared, not a defect: reports/blog-feed.jsonl is union-merged (RULES rule 27, every piece
// appends one line there) and carries no per-piece signal -- every live piece "has a commit"
// touching it within minutes. Excluding it is the same move OWNERSHIP-SWEEP-20260814 made for
// the conflict computation, applied here to the drift computation instead.
const NO_SIGNAL_PATHS = new Set(['reports/blog-feed.jsonl']);

function declaredPaths(j) {
  const out = new Set();
  for (const key of ['files_touched', 'files_claimed', 'outputs_written', 'outputs_expected']) {
    const v = j[key];
    if (Array.isArray(v)) for (const p of v) if (typeof p === 'string' && p.trim()) out.add(p.trim());
  }
  return [...out].filter((p) => !p.startsWith('orchestration/status/') && !NO_SIGNAL_PATHS.has(p));
}

function commitsSince(relPath, epoch) {
  if (!epoch) return [];
  // directory claims end in '/'; everything else is a literal pathspec.
  const since = new Date(epoch * 1000).toISOString();
  const out = git(['log', '--since', since, '--format=%H %cI %s', '--', relPath]);
  return out ? out.split('\n') : [];
}

function verdictPathsInNextStep(text) {
  if (!text || typeof text !== 'string') return [];
  const re = /corpus\/90-verdicts\/[A-Za-z0-9_\-./]+\.(?:md|json)/g;
  return [...new Set(text.match(re) || [])];
}

function loadCandidates(onlyTask) {
  const files = fs.readdirSync(STATUS_DIR).filter((f) => f.endsWith('.json'));
  const results = [];
  for (const f of files) {
    const taskId = f.replace(/\.json$/, '');
    if (onlyTask && taskId !== onlyTask && f !== onlyTask) continue;
    const rel = path.join('orchestration', 'status', f);
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    } catch (e) {
      continue;
    }
    const stateRaw = j.state || j.status || '';
    if (!NON_TERMINAL_RE.test(norm(stateRaw))) continue;
    results.push({ file: f, rel, taskId, stateRaw, json: j });
  }
  return results;
}

function checkOne(cand) {
  const epoch = statusFileCommitEpoch(cand.rel);
  const findings = [];

  for (const p of declaredPaths(cand.json)) {
    const commits = commitsSince(p, epoch);
    if (commits.length) {
      findings.push({
        kind: 'post-status-commit',
        path: p,
        count: commits.length,
        latest: commits[0],
      });
    }
  }

  for (const vp of verdictPathsInNextStep(cand.json.next_step)) {
    const full = path.join(ROOT, vp);
    if (fs.existsSync(full)) {
      const commits = commitsSince(vp, epoch);
      findings.push({
        kind: 'named-verdict-exists',
        path: vp,
        postdatesStatus: commits.length > 0,
      });
    }
  }

  return { ...cand, statusEpoch: epoch, findings };
}

function main() {
  const args = process.argv.slice(2);
  const selfTest = args.includes('--self-test');
  const taskIdx = args.indexOf('--task');
  const onlyTask = taskIdx >= 0 ? args[taskIdx + 1] : null;

  if (selfTest) {
    // Known-stranded fixture, checked in this order because the first (the piece this tool was
    // built to catch) gets its own state corrected by this same dispatch and stops qualifying as
    // a candidate on any run after the first -- that is success, not a broken fixture, so fall
    // through to a second real fixture this dispatch deliberately left non-terminal.
    //
    //   1. W1-20-r3-remediation -- landed at 1be74605 ('HAZARDS 9: ...'), a bank commit whose
    //      headline never mentions the piece, under a status file that still said "in_progress"
    //      until this dispatch corrected it. See reports/stranded-triage/2026-08-14-triage.md.
    //   2. W1-DOOR-YAW-SWEEP -- left "in_progress" on purpose (real work remains, PARTIAL not
    //      DONE), but reports/door-yaw/sweep-after.json and friends were written to disk AFTER
    //      this status file's own last commit, so the underlying files_touched paths still show
    //      post-status drift even though the piece itself is correctly still open.
    const fixtures = ['W1-20-r3-remediation.json', 'W1-DOOR-YAW-SWEEP.json'];
    let checked = null;
    let usedFixture = null;
    for (const fx of fixtures) {
      const target = loadCandidates(fx);
      if (target.length === 0) continue; // already resolved by a prior triage pass -- try the next one
      const c = checkOne(target[0]);
      if (c.findings.some((f) => f.kind === 'post-status-commit')) {
        checked = c;
        usedFixture = fx;
        break;
      }
    }
    if (!checked) {
      console.error(
        'SELF-TEST FAIL: none of the known-stranded fixtures (' + fixtures.join(', ') + ') produced a finding. ' +
          'Either both were resolved to a terminal state (re-run against a pre-triage copy of the tree) or the ' +
          'detection logic itself is broken -- do not assume the former without checking.'
      );
      process.exit(1);
    }
    console.log(`SELF-TEST PASS: ${usedFixture} flagged as a stranded-candidate:`);
    for (const f of checked.findings) {
      console.log(`  - ${f.kind}: ${f.path}${f.count ? ` (${f.count} commit(s) after status, latest: ${f.latest})` : ''}`);
    }

    // Negative arm: a piece with a genuinely terminal state must never be flagged, because the
    // scanner should not even consider it. Use a synthetic in-memory check rather than relying on
    // any particular file staying 'done' forever.
    const fakeDone = { state: 'done' };
    const isCandidate = NON_TERMINAL_RE.test(norm(fakeDone.state));
    if (isCandidate) {
      console.error('SELF-TEST FAIL: a "done" state was misclassified as non-terminal.');
      process.exit(1);
    }
    console.log('SELF-TEST PASS: a terminal state ("done") is correctly excluded from candidates.');
    process.exit(0);
  }

  const candidates = loadCandidates(onlyTask);
  if (candidates.length === 0) {
    console.log(onlyTask ? `stranded-check: no non-terminal status file matching "${onlyTask}"` : 'stranded-check: no non-terminal status files found.');
    return;
  }

  let flagged = 0;
  for (const cand of candidates) {
    const checked = checkOne(cand);
    if (checked.findings.length === 0) continue;
    flagged++;
    console.log(`\n=== ${checked.taskId} (state: "${checked.stateRaw}") ===`);
    console.log(`  status file's own last commit: ${checked.statusEpoch ? new Date(checked.statusEpoch * 1000).toISOString() : 'unknown (uncommitted?)'}`);
    for (const f of checked.findings) {
      if (f.kind === 'post-status-commit') {
        const hub = f.count >= 5 ? '  [hub file, many owners -- read the diff, do not trust the count alone]' : '';
        console.log(`  STRANDED-CANDIDATE: ${f.path} has ${f.count} commit(s) after this status file's last write.${hub}`);
        console.log(`    latest: ${f.latest}`);
      } else if (f.kind === 'named-verdict-exists') {
        console.log(`  next_step names ${f.path}, which already exists on disk${f.postdatesStatus ? ' (and postdates this status file)' : ''}.`);
      }
    }
  }
  console.log(`\nstranded-check: ${candidates.length} non-terminal status file(s) scanned, ${flagged} flagged for human verification. Warning only -- nothing was changed.`);
}

main();
