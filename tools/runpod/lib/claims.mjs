// Per-process Pod claims — the guard that works *between sibling agents in one container*.
//
// Why this exists, and why the name tag was not enough.
//
// The first version of the cleanup guard scoped ownership to a slug hashed from
// CLAUDE_CODE_SESSION_ID. That was measured wrong: on 2026-08-14 four runs started by three
// different sibling agents (pids 16932, 2919, 12075, 4498) all carried the *same* slug
// `e9b0d69d`, because CLAUDE_CODE_SESSION_ID is scoped to the **container**, not to the agent.
// So a bare cleanup still saw a sibling's live Pod as its own and terminated it — the exact bug
// the guard was written to stop, reported by the agent it happened to.
//
// The name tag is still right for what it covers: it survives a container restart and is visible
// across worktrees, which no local file can do. What it cannot do is separate two agents inside
// one container. A pid can — and inside one container a pid is meaningful, checkable and cheap.
// The two mechanisms cover each other's blind spot, so both are used:
//
//   name tag  -> "is this Pod from a different container / a different account user?"
//   claim     -> "is a process in *this* container still working with this Pod right now?"
//
// Claims live in /tmp because /tmp is exactly container-scoped: shared by every sibling agent,
// and gone after the restart that would make its pids meaningless anyway.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CLAIM_DIR = process.env.ELDER_SOULS_CLAIM_DIR || path.join(os.tmpdir(), 'elder-souls-runpod-claims');

/** Linux exposes a process start time, which makes a recycled pid detectable. */
export function processStartTicks(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // The comm field can contain spaces and parentheses, so parse after the final ')'.
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return fields[19] || null; // starttime is field 22 overall, index 19 after pid and comm
  } catch { return null; }
}

export function claimPath(podId) {
  return path.join(CLAIM_DIR, `${String(podId).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
}

export function claimPod(podId, meta = {}) {
  fs.mkdirSync(CLAIM_DIR, { recursive: true });
  const claim = {
    schema: 'elder-souls/runpod-claim@1',
    podId,
    pid: process.pid,
    startTicks: processStartTicks(process.pid),
    claimedAt: new Date().toISOString(),
    ...meta,
  };
  fs.writeFileSync(claimPath(podId), `${JSON.stringify(claim, null, 2)}\n`);
  return claim;
}

export function releasePod(podId) {
  try { fs.rmSync(claimPath(podId), { force: true }); return true; }
  catch { return false; }
}

export function readClaims() {
  const claims = new Map();
  let entries = [];
  try { entries = fs.readdirSync(CLAIM_DIR); } catch { return claims; }
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const claim = JSON.parse(fs.readFileSync(path.join(CLAIM_DIR, entry), 'utf8'));
      if (claim?.podId) claims.set(claim.podId, claim);
    } catch { /* a half-written claim is not a reason to fail a cleanup */ }
  }
  return claims;
}

/**
 * Is the process that claimed this Pod still running?
 *
 * A dead pid means a crashed run, and its Pod is exactly what cleanup exists to reap. A live pid
 * that is not us means a sibling agent is mid-capture, and its Pod must not be touched.
 */
export function isClaimLive(claim, { now = Date.now() } = {}) {
  if (!claim?.pid) return false;
  try { process.kill(claim.pid, 0); }
  catch { return false; }
  // The pid is alive, but pids get recycled. If we recorded a start time and it no longer
  // matches, this is a different process wearing the same number.
  if (claim.startTicks) {
    const current = processStartTicks(claim.pid);
    if (current && current !== claim.startTicks) return false;
  }
  return true;
}
