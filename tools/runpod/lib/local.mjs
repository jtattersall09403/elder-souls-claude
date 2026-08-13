import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export function runProcess(command, args, {
  cwd,
  env,
  signal,
  capture = true,
  allowFailure = false,
  log,
  stdin = 'ignore',
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: process.platform !== 'win32',
      stdio: [stdin, 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const emit = (kind, chunk) => {
      const value = chunk.toString();
      if (capture) kind === 'stdout' ? stdout += value : stderr += value;
      if (log) log(value.replace(/\n$/, ''), kind);
    };
    child.stdout.on('data', (chunk) => emit('stdout', chunk));
    child.stderr.on('data', (chunk) => emit('stderr', chunk));
    const abort = () => {
      killed = true;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch { /* process already exited */ }
      const hardKill = setTimeout(() => {
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch { /* process already exited */ }
      }, 10_000);
      hardKill.unref();
    };
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }
    child.on('error', reject);
    child.on('close', (code, closeSignal) => {
      if (signal) signal.removeEventListener('abort', abort);
      const result = { code: code ?? (killed ? 130 : 1), signal: closeSignal, stdout, stderr };
      if (!allowFailure && result.code !== 0) {
        const error = new Error(`${command} exited ${result.code}${closeSignal ? ` (${closeSignal})` : ''}`);
        error.result = result;
        reject(error);
      } else resolve(result);
    });
  });
}

export async function commandExists(name) {
  const result = await runProcess('sh', ['-c', `command -v "$1" >/dev/null 2>&1`, 'sh', name], { allowFailure: true });
  return result.code === 0;
}

export async function createSnapshot({ repoRoot, revision, paths, tempDir, log }) {
  const archivePath = path.join(tempDir, 'source.tar.gz');
  const revisionResult = await runProcess('git', ['rev-parse', `${revision || 'HEAD'}^{commit}`], { cwd: repoRoot });
  const resolvedRevision = revisionResult.stdout.trim();
  let dirty = false;
  let fileCount = 0;

  if (revision) {
    await runProcess('git', ['archive', '--format=tar.gz', `--output=${archivePath}`, resolvedRevision, '--', ...paths], {
      cwd: repoRoot,
      log,
    });
    const count = await runProcess('git', ['ls-tree', '-r', '--name-only', resolvedRevision, '--', ...paths], { cwd: repoRoot });
    fileCount = count.stdout.trim() ? count.stdout.trim().split('\n').length : 0;
  } else {
    const listed = await runProcess('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...paths], { cwd: repoRoot });
    // `git ls-files --cached` includes tracked paths deleted in the worktree. Omit those so the
    // archive represents the exact working bytes instead of failing tar or resurrecting HEAD.
    const files = listed.stdout.split('\0').filter(Boolean).filter((file) => {
      try { fs.lstatSync(path.join(repoRoot, file)); return true; }
      catch { return false; }
    });
    if (!files.length) throw new Error(`snapshot paths selected no files: ${paths.join(', ')}`);
    const status = await runProcess('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths], { cwd: repoRoot });
    dirty = Boolean(status.stdout.trim());
    fileCount = files.length;
    const listPath = path.join(tempDir, 'snapshot-files');
    fs.writeFileSync(listPath, Buffer.from(`${files.join('\0')}\0`));
    await runProcess('tar', ['--null', '--files-from', listPath, '--create', '--gzip', '--file', archivePath], {
      cwd: repoRoot,
      log,
    });
  }

  const bytes = fs.statSync(archivePath).size;
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(archivePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  const sha256 = hash.digest('hex');
  return { archivePath, revision: resolvedRevision, dirty, fileCount, bytes, sha256, paths };
}

export function findSshKey(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.RUNPOD_SSH_KEY,
    path.join(os.homedir(), '.ssh', 'id_ed25519'),
    path.join(os.homedir(), '.ssh', 'id_rsa'),
  ].filter(Boolean).map((item) => path.resolve(item));
  return candidates.find((item) => fs.existsSync(item) && fs.statSync(item).isFile()) || null;
}

export async function makeEphemeralSshKey(tempDir) {
  const keyPath = path.join(tempDir, 'runpod_ed25519');
  await runProcess('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'elder-souls-ephemeral-runpod', '-f', keyPath]);
  fs.chmodSync(keyPath, 0o600);
  return { keyPath, publicKey: fs.readFileSync(`${keyPath}.pub`, 'utf8').trim(), ephemeral: true };
}

export async function sshKeyMaterial(explicitPath, tempDir) {
  const existing = findSshKey(explicitPath);
  if (!existing) return makeEphemeralSshKey(tempDir);
  const publicFile = `${existing}.pub`;
  let publicKey;
  if (fs.existsSync(publicFile)) publicKey = fs.readFileSync(publicFile, 'utf8').trim();
  else publicKey = (await runProcess('ssh-keygen', ['-y', '-f', existing])).stdout.trim();
  return { keyPath: existing, publicKey, ephemeral: false };
}

export function sshArgs({ host, port, keyPath, knownHostsPath }) {
  return [
    '-i', keyPath,
    '-p', String(port),
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', `UserKnownHostsFile=${knownHostsPath}`,
    `root@${host}`,
  ];
}

export function scpArgs({ host, port, keyPath, knownHostsPath }) {
  return [
    '-i', keyPath,
    '-P', String(port),
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', `UserKnownHostsFile=${knownHostsPath}`,
  ];
}

export function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'elder-souls-runpod-'));
}

export function removeTempDir(tempDir) {
  if (tempDir?.startsWith(os.tmpdir() + path.sep)) fs.rmSync(tempDir, { recursive: true, force: true });
}
