#!/usr/bin/env node
// check-append-only.mjs — the shared record may be added to, never rewritten.
//
// `reports/blog-feed.jsonl` is how every agent tells the project owner what it found, and it is the
// one file the whole fleet writes to. It is append-only by convention, and convention lost: an agent
// rewrote a line **in place**, leaving a record carrying one task's id and screenshots under another
// task's title. The agent whose line it was noticed, repaired its own row, removed the two shots
// that were not theirs, and left the other's words alone — which is the right behaviour and is also
// the reason we know it happened at all. Nothing else would have caught it.
//
// A line that has already been committed is somebody's account of something they measured. Editing
// it is not a merge conflict, it is a change to the record.
//
//   node tools/check-append-only.mjs            # compare the working tree against HEAD
//   node tools/check-append-only.mjs --staged   # compare the index against HEAD (the hook's mode)
//
// Exits 1 naming the changed lines. This is a *warning* in the pre-commit hook, for the reason
// rule 13 gives: a dozen agents append concurrently and a hard gate over a line somebody else
// mangled would block the wrong person. Seeing it is the point.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FILES = ['reports/blog-feed.jsonl'];
const staged = process.argv.includes('--staged');

let bad = 0;
for (const rel of FILES) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;

  let head;
  try { head = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { continue; }                       // new file — nothing to preserve yet

  let now;
  if (staged) {
    try { now = execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
    catch { continue; }                     // not staged this time
  } else {
    now = readFileSync(abs, 'utf8');
  }

  const a = head.split('\n');
  const b = now.split('\n');
  // Every line that existed before must still be there, unchanged, in the same position. Anything
  // after that is a legitimate append.
  const changed = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '') continue;
    if (b[i] !== a[i]) changed.push({ n: i + 1, was: a[i], now: b[i] });
  }
  if (b.length < a.length) changed.push({ n: a.length, was: `(${a.length} lines)`, now: `(${b.length} lines) — the file got SHORTER` });

  if (changed.length) {
    bad += changed.length;
    console.error(`check-append-only: ${rel} — ${changed.length} line(s) that were already committed have changed:`);
    for (const c of changed.slice(0, 6)) {
      console.error(`  line ${c.n}`);
      console.error(`    was: ${String(c.was).slice(0, 150)}`);
      console.error(`    now: ${String(c.now ?? '(deleted)').slice(0, 150)}`);
    }
    if (changed.length > 6) console.error(`  … and ${changed.length - 6} more`);
    console.error('');
    console.error('  This file is append-only. Each line is an agent\'s account of something it');
    console.error('  measured, and the project owner reads it. Append your row; do not edit anyone');
    console.error('  else\'s. If you have genuinely mangled your own line, fix that line and say so.');
  }
}

if (!bad) console.log('check-append-only: the shared record has only been appended to.');
process.exit(bad ? 1 : 0);
