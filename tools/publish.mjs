#!/usr/bin/env node
// Regenerates the published site: build status + blog -> docs/index.html
// Wired into .githooks/pre-commit so the page never goes stale.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
for (const t of ['tools/progress.mjs', 'tools/blog.mjs']) {
  try { process.stdout.write(execFileSync('node', [join(ROOT, t)], { cwd: ROOT }).toString()); }
  catch (e) { console.error(`publish: ${t} failed —`, e.message); process.exitCode = 1; }
}

// Every image the page references must exist under docs/, because that is all GitHub Pages
// serves. A writing agent that references a corpus/ path, or copies its image after writing
// the post, gets a broken image on a public page and no error anywhere — so check it here.
const page = join(ROOT, 'docs', 'index.html');
if (existsSync(page)) {
  const html = readFileSync(page, 'utf8');
  const missing = [...new Set([...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map(m => m[1]))]
    .filter(s => !/^https?:/.test(s) && !existsSync(join(ROOT, 'docs', s)));
  if (missing.length) {
    console.error(`publish: ${missing.length} image(s) referenced by docs/index.html do not exist under docs/:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exitCode = 1;
  }
}
