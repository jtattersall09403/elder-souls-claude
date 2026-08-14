// Loud disk failures.
//
// On 2026-08-14 the container filled to 100% and captures kept "succeeding" while writing nothing:
// an ENOSPC swallowed by a best-effort write looks exactly like a clean run, which is the worst
// shape a tool can have. Everything here exists to turn that into a stop.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_HEADROOM_BYTES = 64 * 1024 * 1024; // a capture sequence is comfortably under this

export function classifyWriteError(error, target) {
  const code = error?.code || null;
  if (code === 'ENOSPC') {
    return {
      kind: 'disk-full',
      fatal: true,
      code,
      message: `the disk is full (ENOSPC) while writing ${target}. Nothing after this point was saved. Free space and re-run; do not treat this run as evidence.`,
    };
  }
  if (code === 'EDQUOT') {
    return { kind: 'quota-exceeded', fatal: true, code, message: `the filesystem quota is exhausted (EDQUOT) while writing ${target}.` };
  }
  if (code === 'EROFS') {
    return { kind: 'read-only', fatal: true, code, message: `the filesystem is read-only (EROFS) while writing ${target}.` };
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return { kind: 'permission', fatal: true, code, message: `permission denied (${code}) while writing ${target}.` };
  }
  return { kind: 'write-failed', fatal: true, code, message: `${code || 'write error'} while writing ${target}: ${error?.message || error}` };
}

export class DiskError extends Error {
  constructor(classification, target) {
    super(classification.message);
    this.name = 'DiskError';
    this.kind = classification.kind;
    this.code = classification.code;
    this.target = target;
  }
}

async function freeBytes(directory) {
  // fs.statfs landed in Node 18.15; `df` is the fallback so this works on any box the fleet uses.
  if (typeof fsp.statfs === 'function') {
    const stats = await fsp.statfs(directory);
    return Number(stats.bavail) * Number(stats.bsize);
  }
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { stdout } = await promisify(execFile)('df', ['-kP', directory]);
  const line = stdout.trim().split('\n').at(-1) || '';
  const available = Number(line.split(/\s+/)[3]);
  if (!Number.isFinite(available)) throw new Error(`could not read free space for ${directory}`);
  return available * 1024;
}

/**
 * Refuse to start writing artefacts when the filesystem cannot hold them. Throws DiskError.
 * `requiredBytes` is a floor, not a prediction: the point is to fail before the capture, not after.
 */
export async function guardArtifactWrite(directory, { requiredBytes = DEFAULT_HEADROOM_BYTES, label = 'artifacts' } = {}) {
  await fsp.mkdir(directory, { recursive: true });
  let available;
  try { available = await freeBytes(directory); }
  catch (error) {
    // Not being able to measure is not a reason to proceed blindly, but it is also not proof of a
    // full disk; say so and continue rather than blocking every run on a statfs quirk.
    return { checked: false, availableBytes: null, requiredBytes, reason: error.message };
  }
  if (available < requiredBytes) {
    throw new DiskError({
      kind: 'disk-full',
      fatal: true,
      code: 'ENOSPC',
      message: `refusing to write ${label} to ${directory}: ${(available / 1048576).toFixed(1)} MiB free, ${(requiredBytes / 1048576).toFixed(1)} MiB required. The disk is full (ENOSPC territory) and a run started now would produce a clean-looking result with missing frames. Free space first.`,
    }, directory);
  }
  return { checked: true, availableBytes: available, requiredBytes };
}

/** Write a file, and make any disk failure loud and specific rather than a swallowed best effort. */
export function writeFileLoud(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  } catch (error) {
    const classification = classifyWriteError(error, file);
    throw new DiskError(classification, file);
  }
  return file;
}
