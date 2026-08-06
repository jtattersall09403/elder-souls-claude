#!/usr/bin/env node
// Regenerates the published site: build status + blog -> docs/index.html
// Wired into .githooks/pre-commit so the page never goes stale.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
for (const t of ['tools/progress.mjs', 'tools/blog.mjs']) {
  try { process.stdout.write(execFileSync('node', [join(ROOT, t)], { cwd: ROOT }).toString()); }
  catch (e) { console.error(`publish: ${t} failed —`, e.message); process.exitCode = 1; }
}
