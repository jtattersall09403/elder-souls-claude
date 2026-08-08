#!/usr/bin/env node
// Runs the cost instrument on the commit path, and never, ever blocks it.
//
// COST.md §6: "Refresh cadence: every bank. tools/bank.mjs runs every few minutes and the
// pre-commit hook already regenerates and stages docs/progress.html, so the cost ledger
// regenerates on that same path — no new schedule, no separate job to fall behind." And: "It must
// never be *blocking* on the commit path (rule 13): a cost report that stops the fleet has cost
// more than it saves." A fail-closed check has stopped this whole box twice.
//
// This file COMPUTES NOTHING. It shells out to the instrument (`tools/cost.mjs`, owned by the
// COST-INSTRUMENT piece) with a timeout, and its only other job is honesty about failure: on a
// non-zero exit, a timeout, or a crash it writes `docs/data/cost-ledger.error.json`, which
// tools/cost-report.mjs turns into a red banner naming the timestamp of the last GOOD reading.
// Serving the previous number with no warning is the failure mode this exists to prevent.
//
//   node tools/cost-refresh.mjs              # run the instrument if it exists
//   node tools/cost-refresh.mjs --timeout 40 # seconds (default 25)
//
// Exit code is ALWAYS 0. There is no failure of this tool that should stop a commit; the failure
// is published on the page instead, which is where the owner will actually see it.

import { existsSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const INSTRUMENT = 'tools/cost.mjs';
const LEDGER = join(ROOT, 'docs', 'data', 'cost-ledger.json');
const MARKER = join(ROOT, 'docs', 'data', 'cost-ledger.error.json');

const at = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const timeoutSec = Number(at('--timeout', '25')) || 25;

function fail(message) {
  try {
    mkdirSync(dirname(MARKER), { recursive: true });
    writeFileSync(MARKER, JSON.stringify({ at: new Date().toISOString(), message }, null, 2) + '\n');
  } catch { /* even the marker is best-effort; nothing here may throw on the commit path */ }
  console.error(`cost-refresh: ${message} (published as a failure banner; the commit is not affected)`);
}

const instrumentPath = join(ROOT, INSTRUMENT);
if (!existsSync(instrumentPath)) {
  // Not a failure. The instrument is a separate piece and may not have landed; the page already
  // renders an honest "has not landed" state naming the path it is waiting for. Writing a failure
  // marker here would cry wolf on every commit until it does.
  try { rmSync(MARKER, { force: true }); } catch { }
  console.log(`cost-refresh: ${INSTRUMENT} does not exist yet — nothing to run. The page says so itself.`);
  process.exit(0);
}

const r = spawnSync(process.execPath, [instrumentPath], {
  cwd: ROOT, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 32 * 1024 * 1024,
});

if (r.error && r.error.code === 'ETIMEDOUT') {
  fail(`${INSTRUMENT} did not finish within ${timeoutSec}s and was killed. The transcript grows every hour, so if this persists the instrument needs an incremental roll-up rather than a full re-parse.`);
} else if (r.error) {
  fail(`${INSTRUMENT} could not be run — ${r.error.message}`);
} else if (r.status !== 0) {
  const tail = String(r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' / ').slice(0, 500);
  fail(`${INSTRUMENT} exited ${r.status}${tail ? `: ${tail}` : ''}`);
} else if (!existsSync(LEDGER)) {
  fail(`${INSTRUMENT} exited 0 but wrote no ledger at docs/data/cost-ledger.json — see the contract in orchestration/COST.md §6.1.`);
} else {
  try { rmSync(MARKER, { force: true }); } catch { }
  if (r.stdout && r.stdout.trim()) console.log(r.stdout.trim());
  console.log('cost-refresh: ledger refreshed.');
}
process.exit(0);
