// buildkey.mjs — "which code drew this picture?"
//
// S34 keys the capture cache on the build so that "a stale picture cannot outlive the code that
// drew it". A git sha alone is not enough here: the working tree is routinely dirty (every builder
// in this project is mid-edit), and two different dirty trees share one HEAD sha. So the key is
// the *content* of game/, with the git sha carried alongside as human-readable provenance.
//
// Two hashes, for two different jobs:
//   stat signature  — path + size + mtime_ns over game/**. Cheap (single-digit ms). Used as a
//                     CHANGE DETECTOR only, never as the cache key: mtime moves without content
//                     moving, so it can only ever over-invalidate, which is the safe direction.
//   content hash    — sha256 over (relpath, sha256(bytes)) for every file in game/**. This is the
//                     cache key. Computed only when the stat signature has moved.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GAME_DIR, REPO_ROOT, gitInfo } from '../lib/cli.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Cheap change detector over game/**: path + size + mtime. NOT a cache key. */
export function statSignature(dir = GAME_DIR) {
  const h = crypto.createHash('sha256');
  const files = walk(dir).sort();
  for (const f of files) {
    const s = fs.statSync(f);
    h.update(path.relative(REPO_ROOT, f));
    h.update('\0' + s.size + '\0' + s.mtimeMs + '\n');
  }
  return { sig: h.digest('hex'), files: files.length };
}

/** The real thing: content hash of game/**. This is what the cache is keyed on. */
export function contentHash(dir = GAME_DIR) {
  const h = crypto.createHash('sha256');
  const files = walk(dir).sort();
  let bytes = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f);
    bytes += buf.length;
    h.update(path.relative(REPO_ROOT, f));
    h.update('\0');
    h.update(crypto.createHash('sha256').update(buf).digest());
    h.update('\n');
  }
  return { hash: h.digest('hex'), files: files.length, bytes };
}

/**
 * The full build identity recorded on every capture.
 *   build_key  — the cache key component. `game@<12 hex of content hash>`.
 *   git        — HEAD sha and dirtiness, for a human reading the manifest.
 */
export function buildKey(dir = GAME_DIR) {
  const c = contentHash(dir);
  const g = (() => { try { return gitInfo(); } catch { return null; } })();
  return {
    build_key: 'game@' + c.hash.slice(0, 16),
    game_content_sha256: c.hash,
    game_files: c.files,
    game_bytes: c.bytes,
    git_sha: g && (g.sha || g.commit || g.head) || null,
    git_dirty: g ? (g.dirty !== undefined ? g.dirty : null) : null,
    git: g,
  };
}
