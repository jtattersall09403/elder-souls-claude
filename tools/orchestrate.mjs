#!/usr/bin/env node
// Dispatch registry + resume planner.
//   node tools/orchestrate.mjs            report status of every registered task
//   node tools/orchestrate.mjs --resume   print relaunch prompts for incomplete tasks
// A task is complete when every file in outputs_expected exists and is non-trivial.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...a) => join(ROOT, ...a);
const REG = P('orchestration', 'registry.json');
const MIN_BYTES = 400; // a file smaller than this is a stub, not a deliverable

const registry = JSON.parse(readFileSync(REG, 'utf8'));

function globish(pat) {
  // supports a single trailing * wildcard on the basename, plus plain dir/ prefixes
  if (!pat.includes('*')) return existsSync(P(pat)) ? [P(pat)] : [];
  const dir = P(dirname(pat));
  if (!existsSync(dir)) return [];
  const base = pat.split('/').pop().replace('*', '');
  return readdirSync(dir).filter(f => f.startsWith(base)).map(f => join(dir, f));
}

function ok(pat) {
  const hits = globish(pat);
  return hits.some(h => { try { return statSync(h).size >= MIN_BYTES; } catch { return false; } });
}

function statusOf(task) {
  const sf = P('orchestration', 'status', `${task.id}.json`);
  let st = null;
  if (existsSync(sf)) { try { st = JSON.parse(readFileSync(sf, 'utf8')); } catch { } }
  const done = task.outputs_expected.filter(ok);
  const missing = task.outputs_expected.filter(p => !ok(p));
  const state = missing.length === 0 ? 'complete'
    : done.length > 0 ? 'partial'
      : st ? 'started-nothing-written' : 'not-started';
  return { st, done, missing, state };
}

const rows = registry.tasks.map(t => ({ t, ...statusOf(t) }));
const resume = process.argv.includes('--resume');

if (!resume) {
  const w = Math.max(...rows.map(r => r.t.id.length));
  console.log(`\n  ${'TASK'.padEnd(w)}  STATE                     DONE/EXPECTED  NEXT STEP`);
  console.log('  ' + '-'.repeat(w + 62));
  for (const r of rows) {
    const n = `${r.done.length}/${r.t.outputs_expected.length}`;
    const next = (r.st?.next_step || '').slice(0, 44);
    console.log(`  ${r.t.id.padEnd(w)}  ${r.state.padEnd(24)}  ${n.padEnd(13)}  ${next}`);
  }
  const inc = rows.filter(r => r.state !== 'complete');
  console.log(`\n  ${rows.length - inc.length}/${rows.length} complete. ${inc.length} outstanding.`);
  if (inc.length) console.log('  Run with --resume for relaunch prompts.\n');

  mkdirSync(P('orchestration', 'status'), { recursive: true });
  writeFileSync(P('orchestration', 'STATUS.json'), JSON.stringify({
    generated: new Date().toISOString(),
    complete: rows.length - inc.length, total: rows.length,
    tasks: rows.map(r => ({
      id: r.t.id, title: r.t.title, state: r.state,
      done: r.done.length, expected: r.t.outputs_expected.length,
      missing: r.missing, next_step: r.st?.next_step || null,
      findings: r.st?.findings?.length || 0,
    })),
  }, null, 2));
} else {
  for (const r of rows.filter(x => x.state !== 'complete')) {
    console.log(`\n${'='.repeat(78)}\nTASK ${r.t.id} — ${r.t.title}   [${r.state}]\n${'='.repeat(78)}`);
    console.log(`You are ${r.state === 'not-started' ? 'starting' : 'RESUMING'} task "${r.t.id}".

FIRST read, in order:
  1. orchestration/AGENT-PROTOCOL.md   — the durability protocol; it is binding
  2. ${r.t.brief}   — your full brief
  3. orchestration/status/${r.t.id}.json   — ${r.st ? 'your predecessor\'s checkpoint: findings, decisions and next_step. CONTINUE FROM IT; do not restart.' : '(does not exist yet — create it as your first action)'}

Still missing (${r.missing.length}):
${r.missing.map(m => '  - ' + m).join('\n')}
${r.done.length ? `\nAlready written (do NOT rewrite; extend only if incomplete):\n${r.done.map(m => '  - ' + m).join('\n')}` : ''}

Write each deliverable to disk the moment it is ready, and update your status file as you go.`);
  }
}
