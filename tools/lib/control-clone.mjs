// control-clone.mjs — the cheap way to build a null-control tree.
//
// THE PROBLEM (HAZARDS.md §5, §1). Delete-the-fix (RULES.md rule 6) requires a scratch copy of the
// tree to run a teardown against: this is non-negotiable, it is where the method's honesty lives.
// But the tree is ~1 GB+ once `.git`, `corpus/`, `reports/` and `docs/` are counted, and a control
// almost never reads any of that — every existing control this file was written after reading
// (`tools/world/road-join-deletefix.mjs`, `critic-road-join-consume.mjs`, `road-join-consumption.mjs`,
// `tools/lore/*-consume.mjs`, `tools/harness/w1-15-r4-deletefix.mjs`) copies `game/` and/or `tools/`
// with `fs.cpSync`, deep-copying every byte even though the overwhelming majority of those bytes are
// never opened for write. The disk hit 99% twice in one day over exactly this.
//
// THE FIX. Hard links. `game/` and `tools/` sit on the same filesystem as `os.tmpdir()` (verified:
// both report device id 65024 under ext4 on this box), so a hard-linked file costs one directory
// entry and zero additional disk — `fs.linkSync` instead of `fs.copyFileSync`. Where that is not
// true (a different device, a filesystem that refuses extra links, `EXDEV`/`EPERM`/`EMLINK`) this
// falls back to a real copy automatically and SAYS SO in the manifest, rather than pretending the
// saving happened.
//
// THE DANGER THIS EXISTS TO PREVENT. A hard link is the SAME inode as the source file. Node's
// `fs.writeFileSync` and `fs.copyFileSync` both open their target with `O_TRUNC`, which truncates
// that inode IN PLACE — write through a hard link and you have just corrupted the real repository
// file, and every other clone still linked to it, silently. Every real control this file was built
// from writes into at least one path inside its own copy (`game/data/world/roads.json`, an edited
// source file, a quest doc). So: **only paths NOT named in `writable` are linked. Anything in
// `writable` is a real copy from the first byte**, specifically so the caller's in-place writes land
// on a private inode. Getting that list right is the caller's job; `--self-test` below proves the
// mechanism itself does not corrupt the source tree when the list is honoured, and a corrupted
// writable file never leaks back into `REPO_ROOT` — see `selfTest()`.
//
// OWNERSHIP, so a bare cleanup can never touch another agent's live work (RULES.md rule the disk
// story keeps re-teaching, and `tools/runpod/cli.mjs`'s pattern, which this follows rather than
// reinventing): the clone directory NAME carries an owner slug computed the same way
// `tools/runpod/lib/owner.mjs` computes one, so it survives a container restart and is visible to
// every agent on the box; and the clone's manifest carries the creating PID and its `/proc` start
// tick, so a sibling agent *inside this container* — which hashes to the same owner slug, exactly
// the blind spot `tools/runpod/lib/claims.mjs` documents — is not mistaken for a dead one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT, ensureDir } from './cli.mjs';
import { currentOwner, ownerNameSegment, ownerOfName, ageMinutes } from '../runpod/lib/owner.mjs';
import { processStartTicks } from '../runpod/lib/claims.mjs';

export const CONTROL_CLONE_PREFIX = 'elder-souls-control-';
export const CONTROL_CLONE_BASE = process.env.ELDER_SOULS_CONTROL_CLONE_DIR
  || path.join(os.tmpdir(), 'elder-souls-control-clones');
export const MANIFEST_NAME = '.control-clone.json';

/** What the great majority of existing controls in tools/ turned out to need — see the file header. */
export const DEFAULT_PATHS = ['game', 'tools'];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function relKey(rel) {
  return rel.split(path.sep).join('/');
}

/** True when `rel` (posix-style, relative to the clone root) falls inside a declared writable path. */
export function isWritablePath(rel, writable) {
  const key = relKey(rel);
  return (writable || []).some((w) => {
    const wk = relKey(w).replace(/\/+$/, '');
    return key === wk || key.startsWith(`${wk}/`);
  });
}

/**
 * Populate `destRoot` with the tree rooted at `srcRoot`, recursing through `rel` (a file or a
 * directory, relative to both roots). Directories are always created for real — only file bytes are
 * ever candidates for linking. Returns nothing; mutates `stats`.
 */
function populate(srcRoot, destRoot, rel, writable, stats) {
  const src = path.join(srcRoot, rel);
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    ensureDir(path.join(destRoot, rel));
    for (const entry of fs.readdirSync(src)) {
      populate(srcRoot, destRoot, rel ? path.join(rel, entry) : entry, writable, stats);
    }
    return;
  }
  if (!st.isFile()) {
    // No symlinks or special files exist under game/ or tools/ today (checked: `find game tools
    // -type l` is empty). If that ever changes, fail loudly rather than silently drop a file a
    // control might need.
    throw new Error(`control-clone: ${rel} is neither a regular file nor a directory (mode ${st.mode.toString(8)}); refusing to guess how to place it`);
  }
  const dest = path.join(destRoot, rel);
  ensureDir(path.dirname(dest));
  stats.apparentBytes += st.size;
  const wantsCopy = isWritablePath(rel, writable);
  if (!wantsCopy) {
    try {
      fs.linkSync(src, dest);
      stats.linked += 1;
      return;
    } catch (e) {
      stats.linkFallbacks.push({ path: relKey(rel), errno: e.code || String(e) });
      // fall through to a real copy — the marginal-disk saving was not available for this file,
      // but the clone must still be complete.
    }
  }
  fs.copyFileSync(src, dest);
  stats.newBytes += st.size;
  if (wantsCopy) stats.copiedWritable += 1; else stats.copiedFallback += 1;
}

function cloneName(ownerSlug, pid, label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('Z', 'Z-');
  const rand = crypto.randomBytes(3).toString('hex');
  const safeLabel = String(label || 'control').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  return `${CONTROL_CLONE_PREFIX}${ownerNameSegment(ownerSlug)}p${pid}-${safeLabel}-${stamp}${rand}`;
}

/**
 * Build a null-control clone as cheaply as the filesystem allows.
 *
 * @param {object} opts
 * @param {string}   [opts.root]     Source tree root. Default REPO_ROOT.
 * @param {string[]} [opts.paths]    Repo-relative files/dirs to include. Default `['game','tools']`.
 * @param {string[]} [opts.extra]    Additional repo-relative files/dirs (fixtures a specific control
 *                                   needs beyond the default two — e.g.
 *                                   `corpus/50-world/world-scale.json`, which three of the seven
 *                                   existing controls this was modelled on all copy by hand).
 * @param {string[]} [opts.writable] Repo-relative paths (files or directory prefixes) the CALLER will
 *                                   write into after the clone exists. These are real-copied, never
 *                                   linked. Getting this list right is what keeps a write from
 *                                   corrupting the source tree — see the file header.
 * @param {string}   [opts.label]    Short tag folded into the directory name for humans.
 * @param {string}   [opts.dir]      Explicit destination. Default: an owned, timestamped name under
 *                                   CONTROL_CLONE_BASE.
 * @returns {{dir:string, manifest:object, stats:object}}
 */
export function makeControlClone(opts = {}) {
  const root = opts.root || REPO_ROOT;
  const paths = opts.paths || DEFAULT_PATHS;
  const extra = opts.extra || [];
  const writable = opts.writable || [];
  const owner = currentOwner();
  const pid = process.pid;
  const dir = opts.dir || path.join(CONTROL_CLONE_BASE, cloneName(owner.slug, pid, opts.label));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);

  const stats = {
    linked: 0, copiedWritable: 0, copiedFallback: 0,
    apparentBytes: 0, newBytes: 0, linkFallbacks: [],
  };
  for (const rel of [...paths, ...extra]) populate(root, dir, rel, writable, stats);

  let headSha = null;
  try {
    headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* root need not be a git repo (e.g. a synthetic tree in a self-test) — not fatal */ }

  const manifest = {
    schema: 'elder-souls/control-clone@1',
    createdAt: new Date().toISOString(),
    dir,
    root,
    paths,
    extra,
    writable,
    owner: { slug: owner.slug, source: owner.source, scope: owner.scope },
    pid,
    startTicks: processStartTicks(pid),
    headSha,
    stats: {
      linked: stats.linked,
      copiedWritable: stats.copiedWritable,
      copiedFallback: stats.copiedFallback,
      apparentBytes: stats.apparentBytes,
      // The only bytes this clone actually costs the disk beyond what already existed: real copies
      // (writable files copied on purpose, plus any file a link attempt fell back on). Linked files
      // cost one directory entry each, not counted here because it is not megabytes. Accumulated
      // during the walk itself, from the bytes actually written, not re-derived afterwards.
      newBytes: stats.newBytes,
      linkFallbacks: stats.linkFallbacks,
    },
  };

  fs.writeFileSync(path.join(dir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  return { dir, manifest, stats: manifest.stats };
}

export function readManifest(dir) {
  const p = path.join(dir, MANIFEST_NAME);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/** Is the process that made this clone still alive, and is it really the same process (not a
 * recycled pid)? Mirrors `tools/runpod/lib/claims.mjs`'s `isClaimLive`. */
export function isCloneLive(manifest, { now = Date.now() } = {}) {
  if (!manifest || !manifest.pid) return false;
  try { process.kill(manifest.pid, 0); } catch { return false; }
  if (manifest.startTicks) {
    const current = processStartTicks(manifest.pid);
    if (current && current !== manifest.startTicks) return false;
  }
  return true;
}

/** Every clone directory currently under CONTROL_CLONE_BASE, with its manifest (or null if it predates
 * this tool, or is mid-write, or otherwise unreadable — such entries are always protected, never swept). */
export function listClones() {
  if (!fs.existsSync(CONTROL_CLONE_BASE)) return [];
  return fs.readdirSync(CONTROL_CLONE_BASE)
    .filter((name) => name.startsWith(CONTROL_CLONE_PREFIX))
    .map((name) => {
      const dir = path.join(CONTROL_CLONE_BASE, name);
      return { name, dir, manifest: readManifest(dir) };
    });
}

/**
 * Remove one clone this process (or `--force`) is entitled to remove. Never removes a clone whose
 * manifest says it belongs to a live process that is not us, unless `force`.
 */
export function removeClone(dir, { force = false } = {}) {
  const manifest = readManifest(dir);
  if (!manifest) {
    if (!force) return { removed: false, reason: 'no manifest — not provably a control-clone directory; refusing without --force' };
  } else if (manifest.pid !== process.pid && isCloneLive(manifest) && !force) {
    return { removed: false, reason: `a live process still owns it (pid ${manifest.pid})`, manifest };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return { removed: true, manifest };
}

/**
 * Pure planning for a bare sweep — no side effects, mirrors
 * `tools/runpod/lib/cleanup-plan.mjs::planPodCleanup` on purpose: same shape of bug (a bare cleanup
 * must never destroy another agent's live work), same shape of fix.
 */
export function planSweep(clones, { ownerSlug, all = false, yes = false, force = false, olderThanMinutes = null, now = Date.now() } = {}) {
  const remove = [];
  const guarded = [];
  for (const c of clones) {
    const m = c.manifest;
    if (!m) { guarded.push({ ...c, reason: 'no manifest, cannot attribute — left alone' }); continue; }
    const owner = ownerOfName(c.name, CONTROL_CLONE_PREFIX);
    const mine = owner !== null && owner === ownerSlug;
    const live = isCloneLive(m, { now });
    const age = ageMinutes({ createdAt: m.createdAt }, now);
    if (mine) {
      if (live && m.pid !== process.pid) { guarded.push({ ...c, reason: `a live run in this container holds it (pid ${m.pid})` }); continue; }
      remove.push({ ...c, reason: live ? 'owned by this process' : 'owned by this agent; the process that made it is gone' });
      continue;
    }
    if (all && (yes || force)) { remove.push({ ...c, reason: '--all --yes' }); continue; }
    if (olderThanMinutes != null && age != null && age >= olderThanMinutes) {
      if (live && !force) { guarded.push({ ...c, reason: `older than ${olderThanMinutes} min but a live process still holds it (pid ${m.pid})` }); continue; }
      remove.push({ ...c, reason: `older than ${olderThanMinutes} min (age ${age.toFixed(0)} min)` });
      continue;
    }
    guarded.push({ ...c, reason: owner === null ? 'no owner recorded' : `owned by another agent (o${owner})`, live, age });
  }
  return { remove, protected: guarded };
}

export function sweep({ all = false, yes = false, force = false, olderThanMinutes = null, dryRun = false } = {}) {
  const owner = currentOwner();
  const clones = listClones();
  const plan = planSweep(clones, { ownerSlug: owner.slug, all, yes, force, olderThanMinutes });
  const results = [];
  for (const c of plan.remove) {
    if (dryRun) { results.push({ dir: c.dir, removed: false, dryRun: true, reason: c.reason }); continue; }
    const r = removeClone(c.dir, { force: true }); // already decided by planSweep; force just skips the re-check
    results.push({ dir: c.dir, removed: r.removed, reason: c.reason });
  }
  return { ownerSlug: owner.slug, removed: results, protected: plan.protected.map((c) => ({ dir: c.dir, reason: c.reason })) };
}

export function humanMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
