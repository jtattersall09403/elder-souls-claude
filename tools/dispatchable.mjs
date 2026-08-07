#!/usr/bin/env node
// dispatchable.mjs — answer, before an agent is spawned, whether this piece needs one.
//
// Written after the orchestrator dispatched a successor to a piece whose status file already read
// `state: "complete"`, and the agent spent 92k tokens correctly proving there was nothing to do.
// That is the single most expensive orchestration error available, it had already happened once
// before, and a written rule ("never dispatch a piece that is already done") had failed to stop it
// inside an hour. A rule you have to remember is not a control; this is.
//
//   node tools/dispatchable.mjs              # every piece, grouped by what it needs
//   node tools/dispatchable.mjs W1-13-r3     # one piece: exits 0 if worth dispatching, 3 if not
//
// The judgement is deliberately narrow. This says whether a piece has *declared itself finished*,
// not whether it is any good — a complete builder that has never been judged is exactly what the
// tick should be dispatching a critic for, and this reports that as its own category rather than
// hiding it in "done".
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const STATUS = join(ROOT, 'orchestration', 'status');
const VERDICTS = join(ROOT, 'corpus', '90-verdicts');

/** Every verdict on disk, by the piece key it judges, so "finished but unjudged" is answerable. */
function judgedPieces() {
  const seen = new Set();
  const walk = d => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'artifacts') walk(p); continue; }
      if (!p.endsWith('.json')) continue;
      try {
        const v = JSON.parse(readFileSync(p, 'utf8'));
        const piece = String(v.piece_id || v.piece || '');
        const scored = typeof (v.score?.overall_0_10 ?? v.score_0_10) === 'number';
        if (piece && scored) seen.add(piece.toLowerCase().replace(/-r\d+$/, ''));
      } catch { }
    }
  };
  walk(VERDICTS);
  return seen;
}

const judged = judgedPieces();
const rows = [];
if (existsSync(STATUS)) {
  for (const f of readdirSync(STATUS).filter(f => f.endsWith('.json'))) {
    let j; try { j = JSON.parse(readFileSync(join(STATUS, f), 'utf8')); } catch { continue; }
    const id = j.task_id || basename(f, '.json');
    const state = String(j.state || 'unknown');
    const key = id.toLowerCase().replace(/-r\d+$/, '').replace(/^critic-/, '');
    const isCritic = /^(critic|judge)-/.test(id);
    rows.push({
      id, state, file: `orchestration/status/${f}`,
      next: String(j.next_step || '').slice(0, 80),
      complete: /complete/i.test(state),
      blocked: /blocked/i.test(state),
      hasVerdict: judged.has(key),
      isCritic,
    });
  }
}

/** Four answers, and only the first two are reasons to spawn a builder. */
function classify(r) {
  if (r.blocked) return 'blocked — read the reason before you re-dispatch';
  if (!r.complete) return 'IN PROGRESS or unfinished — a successor continues from next_step';
  if (r.complete && !r.hasVerdict && !r.isCritic) return 'FINISHED BUT UNJUDGED — dispatch a CRITIC, not a builder';
  return 'done and judged — do NOT dispatch a builder; re-dispatch only against a verdict';
}

const target = process.argv[2];
if (target) {
  const r = rows.find(x => x.id.toLowerCase() === target.toLowerCase());
  if (!r) { console.log(`dispatchable: no status file for "${target}" — nothing has claimed it, so dispatching is fine.`); process.exit(0); }
  const verdict = classify(r);
  console.log(`${r.id}: ${r.state} — ${verdict}`);
  if (r.next) console.log(`  next_step: ${r.next}`);
  console.log(`  ${r.file}`);
  process.exit(/do NOT dispatch/.test(verdict) ? 3 : 0);
}

const groups = new Map();
for (const r of rows) {
  const k = classify(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const order = [
  'FINISHED BUT UNJUDGED — dispatch a CRITIC, not a builder',
  'IN PROGRESS or unfinished — a successor continues from next_step',
  'blocked — read the reason before you re-dispatch',
  'done and judged — do NOT dispatch a builder; re-dispatch only against a verdict',
];
for (const k of order) {
  const list = groups.get(k) || [];
  if (!list.length) continue;
  console.log(`\n${k}  (${list.length})`);
  for (const r of list.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`  ${r.id.padEnd(28)} ${r.state}${r.next ? `  · ${r.next}` : ''}`);
  }
}
console.log(`\ndispatchable: ${rows.length} piece(s) with a status file. Check one before you spawn: node tools/dispatchable.mjs <task-id>`);
