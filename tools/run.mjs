#!/usr/bin/env node
// run.mjs — run a command, keep all of its output, show only the part a decision needs.
//
// Why. Probes, censuses, journeys and self-tests in this project routinely print thousands of
// lines, and an agent reads every one of them into its context to find the four that matter. With
// a dozen agents running, that is the single largest avoidable cost in the project — and it is
// avoidable *deterministically*, with no model in the loop and no judgement about what is
// interesting: failures, non-zero exits, outliers and the tail are mechanical to select.
//
// Nothing is discarded. The full stream is written to reports/runs/ and the path is printed, so
// anything the filter drops is one `sed -n` away. That matters: this project has been bitten
// repeatedly by instruments that hid the evidence that would have contradicted them, and a filter
// that deleted output would be the same defect wearing a different hat.
//
//   node tools/run.mjs [--head N] [--tail N] [--grep RE] [--label NAME] -- <command...>
//
// Exits with the command's own exit code, so it is safe to drop into an existing pipeline.
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const dashdash = argv.indexOf('--');
if (dashdash < 0 || dashdash === argv.length - 1) {
  console.error('usage: node tools/run.mjs [--head N] [--tail N] [--grep RE] [--label NAME] -- <command...>');
  process.exit(2);
}
const opts = argv.slice(0, dashdash);
const cmd = argv.slice(dashdash + 1);
const flag = (name, dflt) => {
  const i = opts.indexOf(`--${name}`);
  return i >= 0 && opts[i + 1] != null ? opts[i + 1] : dflt;
};
const HEAD = Number(flag('head', 25));
const TAIL = Number(flag('tail', 25));
const label = String(flag('label', cmd.join(' ').replace(/[^\w.-]+/g, '-'))).slice(0, 60);
const extra = flag('grep', null);

// What always survives the filter. These are the shapes that carry a decision: something failed,
// something is out of band, something refused to run, or something is a hard gate speaking.
const INTERESTING = [
  /\b(fail(ed|ure|s)?|error|throw|exception|refus|reject|violation|breach)\b/i,
  /\b(unmeasurable|unfalsifiable|vacuous|dangling|missing|absent|orphan|no consumer)\b/i,
  /\b(HARD[- ]?FAIL|NOT SATISFIED|BLOCKED|RED|exit(ed)? [1-9])\b/,
  /\b(out of band|above|below)\b.*\b(ceiling|floor|band|bar|threshold)\b/i,
  /\b(0 of|0\/\d|none of)\b/i,
  extra ? new RegExp(extra, 'i') : null,
].filter(Boolean);

const outDir = join(ROOT, 'reports', 'runs', '_raw');
mkdirSync(outDir, { recursive: true });
const stampSafe = String(process.hrtime.bigint());   // no wall clock needed, only uniqueness
const logPath = join(outDir, `${label}-${stampSafe}.log`);
const log = createWriteStream(logPath);

const head = [], tail = [], hits = [];
let n = 0;
function line(l) {
  n++;
  log.write(l + '\n');
  if (head.length < HEAD) head.push([n, l]);
  tail.push([n, l]);
  if (tail.length > TAIL) tail.shift();
  if (hits.length < 200 && INTERESTING.some(re => re.test(l))) hits.push([n, l]);
}

const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, env: process.env });
let buf = '';
const onData = d => {
  buf += d.toString();
  const parts = buf.split('\n');
  buf = parts.pop();
  for (const p of parts) line(p);
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);

child.on('close', code => {
  if (buf) line(buf);
  log.end();
  const shown = new Set([...head, ...hits, ...tail].map(([i]) => i));
  const show = [...head, ...hits, ...tail].sort((a, b) => a[0] - b[0]);
  let last = 0;
  const rows = [];
  for (const [i, l] of show) {
    if (rows.length && rows[rows.length - 1][0] === i) continue;
    if (i > last + 1 && last) rows.push([-1, `  … ${i - last - 1} line(s) not shown`]);
    rows.push([i, l]);
    last = i;
  }
  for (const [i, l] of rows) console.log(i < 0 ? l : l);
  console.log(`\n[run] ${cmd.join(' ')}`);
  console.log(`[run] exit ${code} · ${n} line(s) · ${shown.size} shown (${hits.length} matched a failure shape)`);
  console.log(`[run] full output: ${logPath.slice(ROOT.length + 1)}`);
  process.exit(code ?? 0);
});
child.on('error', e => { console.error(`[run] could not start: ${e.message}`); process.exit(127); });
